import { useEffect, useState, useCallback, useRef } from "react";
import { NavBar } from "../components/NavBar";
import { MapView } from "../components/MapView";
import { VehicleProfile } from "../components/VehicleProfile";
import { FuelTracker } from "../components/FuelTracker";
import { RoutingMachine, formatDistance, formatDuration, type RouteSummary } from "../components/RoutingMachine";
import { MobileBottomSheet } from "../components/MobileBottomSheet";
import { useMobile } from "../hooks/useMobile";
import { trafficApi, type TrafficSegment, type UserVehicle } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { fmtDistance, fuelConsumedL, type UnitSystem } from "../utils/fuelCalc";
import {
  Map, Car, Droplets, AlertTriangle, CheckCircle,
  Clock, MapPin, Navigation, RotateCcw, X,
  Ruler, ChevronDown, ChevronUp, Bus,
  Route as RouteIcon, Satellite, Play, Square,
  Gauge, Fuel, CheckCheck, PanelLeftOpen,
} from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────────────
const trafficColors: Record<string, string> = {
  clear: "#22c55e", moderate: "#f59e0b", heavy: "#ef4444",
};
const trafficBadge: Record<string, string> = {
  clear:    "bg-green-100 text-green-700 border-green-200",
  moderate: "bg-yellow-100 text-yellow-700 border-yellow-200",
  heavy:    "bg-red-100 text-red-700 border-red-200",
};

// ─── Nominatim ────────────────────────────────────────────────────────────────
interface NominatimResult {
  place_id:     number;
  display_name: string;
  lat:          string;
  lon:          string;
}
const CEBU_VIEWBOX = "123.7,10.0,124.2,10.6";

function useNominatim(query: string, enabled: boolean, debounceMs = 350) {
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!enabled || query.trim().length < 2) {
      setResults([]); setLoading(false); return;
    }
    setLoading(true);
    timerRef.current = setTimeout(async () => {
      abortRef.current?.abort();
      abortRef.current = new AbortController();
      try {
        const url = new URL("https://nominatim.openstreetmap.org/search");
        url.searchParams.set("q",              query);
        url.searchParams.set("format",         "json");
        url.searchParams.set("countrycodes",   "ph");
        url.searchParams.set("viewbox",        CEBU_VIEWBOX);
        url.searchParams.set("bounded",        "0");
        url.searchParams.set("limit",          "7");
        url.searchParams.set("addressdetails", "0");
        url.searchParams.set("dedupe",         "1");
        const res = await fetch(url.toString(), { signal: abortRef.current.signal });
        if (!res.ok) throw new Error(`Nominatim ${res.status}`);
        setResults(await res.json());
      } catch (err: unknown) {
        if (err instanceof Error && err.name !== "AbortError") {
          console.warn("[Nominatim]", err.message);
          setResults([]);
        }
      } finally {
        setLoading(false);
      }
    }, debounceMs);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [query, enabled, debounceMs]);

  const clear = useCallback(() => setResults([]), []);
  return { results, loading, clear };
}

// ─── Haversine (for GPS track distance) ──────────────────────────────────────
function haversineKm(a: [number, number], b: [number, number]) {
  const R = 6371;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLng = ((b[1] - a[1]) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a[0] * Math.PI) / 180) *
    Math.cos((b[0] * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

function fmtElapsed(s: number) {
  const h   = Math.floor(s / 3600);
  const m   = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

// GPS live-dot icon
const gpsDotIcon = L.divIcon({
  html: `<div style="width:14px;height:14px;border-radius:50%;background:#8b5cf6;border:3px solid white;box-shadow:0 0 0 3px rgba(139,92,246,.35)"></div>`,
  className: "", iconSize: [14, 14], iconAnchor: [7, 7],
});

type Tab       = "route" | "vehicle" | "fuel";
type RouteMode = "set-route" | "gps-track";

// ─── Component ────────────────────────────────────────────────────────────────
export default function DriverDashboard() {
  const { user } = useAuth();
  const isMobile = useMobile();

  // ── Shared state ────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab]     = useState<Tab>("route");
  const [unit, setUnit]               = useState<UnitSystem>("metric");
  const [traffic, setTraffic]         = useState<TrafficSegment[]>([]);
  const [vehicle, setVehicle]         = useState<UserVehicle | null>(null);
  const [tripDistanceKm, setTripDist] = useState<number | null>(null);
  const [loading, setLoading]         = useState(true);

  // Mobile panel
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);

  // ── Route tab sub-mode ──────────────────────────────────────────────────────
  const [routeMode, setRouteMode] = useState<RouteMode>("set-route");

  // ── Set Route state ─────────────────────────────────────────────────────────
  const [originQuery, setOriginQuery]         = useState("");
  const [destQuery,   setDestQuery]           = useState("");
  const [origin, setOrigin]                   = useState<{ name: string; lat: number; lng: number } | null>(null);
  const [dest,   setDest]                     = useState<{ name: string; lat: number; lng: number } | null>(null);
  const [clickMode, setClickMode]             = useState<"origin" | "dest" | null>(null);
  const [routeSummary, setRouteSummary]       = useState<RouteSummary | null>(null);
  const [routingError, setRoutingError]       = useState<string | null>(null);
  const [isRouting, setIsRouting]             = useState(false);
  const [showDirections, setShowDirections]   = useState(false);
  const [showAlert, setShowAlert]             = useState(false);

  // ── GPS Track state ─────────────────────────────────────────────────────────
  const [gpsTracking, setGpsTracking]         = useState(false);
  const [gpsPath, setGpsPath]                 = useState<[number, number][]>([]);
  const [gpsCurrentPos, setGpsCurrentPos]     = useState<[number, number] | null>(null);
  const [gpsDistKm, setGpsDistKm]             = useState(0);
  const [gpsElapsed, setGpsElapsed]           = useState(0);   // seconds
  const [gpsSpeed, setGpsSpeed]               = useState<number | null>(null); // m/s from browser
  const [gpsFinishedDist, setGpsFinishedDist] = useState<number | null>(null); // last completed trip
  const watchIdRef = useRef<number | null>(null);

  // Nominatim autocomplete
  const { results: originSuggestions, loading: originLoading, clear: clearOrigin } =
    useNominatim(originQuery, origin === null);
  const { results: destSuggestions, loading: destLoading, clear: clearDest } =
    useNominatim(destQuery, dest === null);

  // ── Bootstrap ───────────────────────────────────────────────────────────────
  useEffect(() => {
    trafficApi.getCurrent()
      .then(setTraffic)
      .finally(() => setLoading(false));
  }, []);

  // ── GPS elapsed timer ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!gpsTracking) return;
    const id = setInterval(() => setGpsElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [gpsTracking]);

  // ── Cleanup watch on unmount ─────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null)
        navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, []);

  // ── Update trip distance from OSRM ──────────────────────────────────────────
  useEffect(() => {
    if (routeSummary) setTripDist(routeSummary.totalDistance / 1000);
  }, [routeSummary]);

  // ── Set Route callbacks ──────────────────────────────────────────────────────
  const handleRouteFound = useCallback((s: RouteSummary) => {
    setRouteSummary(s); setRoutingError(null); setIsRouting(false);
  }, []);
  const handleRoutingError = useCallback((msg: string) => {
    setRoutingError(msg); setIsRouting(false);
  }, []);

  const handleMapClick = useCallback((latlng: [number, number]) => {
    const label = `${latlng[0].toFixed(4)}, ${latlng[1].toFixed(4)}`;
    if (clickMode === "origin") {
      setOrigin({ name: label, lat: latlng[0], lng: latlng[1] });
      setOriginQuery(label);
      clearOrigin();
    } else if (clickMode === "dest") {
      setDest({ name: label, lat: latlng[0], lng: latlng[1] });
      setDestQuery(label);
      clearDest();
    }
    setClickMode(null);
  }, [clickMode, clearOrigin, clearDest]);

  const handleGPS = () => {
    navigator.geolocation.getCurrentPosition(
      ({ coords: { latitude: lat, longitude: lng } }) => {
        setOrigin({ name: "Current Location", lat, lng });
        setOriginQuery("Current Location");
        clearOrigin();
      },
      () => alert("Could not get GPS location.")
    );
  };

  const clearRoute = () => {
    setOrigin(null); setDest(null);
    setOriginQuery(""); setDestQuery("");
    setClickMode(null); setShowAlert(false);
    setRouteSummary(null); setRoutingError(null);
    setIsRouting(false); setShowDirections(false);
    setTripDist(null);
    clearOrigin(); clearDest();
  };

  // ── GPS Track callbacks ──────────────────────────────────────────────────────
  const startTracking = () => {
    if (!navigator.geolocation) { alert("Geolocation is not available in this browser."); return; }
    setGpsPath([]);
    setGpsDistKm(0);
    setGpsElapsed(0);
    setGpsSpeed(null);
    setGpsFinishedDist(null);
    setGpsTracking(true);

    watchIdRef.current = navigator.geolocation.watchPosition(
      ({ coords }) => {
        const pos: [number, number] = [coords.latitude, coords.longitude];
        setGpsCurrentPos(pos);
        if (coords.speed !== null) setGpsSpeed(coords.speed);
        setGpsPath((prev) => {
          if (prev.length > 0) {
            const d = haversineKm(prev[prev.length - 1], pos);
            // ignore jitter < 5 m
            if (d > 0.005) setGpsDistKm((km) => km + d);
          }
          return [...prev, pos];
        });
      },
      (err) => console.warn("[GPS]", err.message),
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
    );
  };

  const stopTracking = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setGpsTracking(false);
    setGpsFinishedDist(gpsDistKm > 0 ? gpsDistKm : null);
  };

  const useGpsTripDistance = () => {
    if (gpsDistKm > 0) setTripDist(gpsDistKm);
  };

  const heavySegs = traffic.filter((t) => t.level === "heavy");

  // ─── Map props ─────────────────────────────────────────────────────────────
  const mapCenter: [number, number] =
    (routeMode === "gps-track" && gpsCurrentPos) ? gpsCurrentPos :
    origin ? [origin.lat, origin.lng] :
    [10.3157, 123.8854];

  // ─── Estimated fuel for GPS track ─────────────────────────────────────────
  const gpsEstFuel = vehicle && gpsDistKm > 0
    ? fuelConsumedL(gpsDistKm, vehicle.mileage)
    : null;

  // ── Route sub-tab content ─────────────────────────────────────────────────
  const SetRoutePanel = (
    <div className="space-y-4 p-4">
      {/* Origin */}
      <div>
        <label className="block text-xs text-gray-500 mb-1 flex items-center gap-1">
          <MapPin size={12} className="text-green-500" /> Origin
        </label>
        <div className="relative">
          <input
            value={originQuery}
            onChange={(e) => { setOriginQuery(e.target.value); setOrigin(null); }}
            placeholder={originLoading ? "Searching…" : "Search origin…"}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm pr-8 focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          {originQuery && (
            <button
              onClick={() => { setOriginQuery(""); setOrigin(null); clearOrigin(); }}
              className="absolute right-2 top-2.5 text-gray-300 hover:text-gray-500"
            >
              <X size={14} />
            </button>
          )}
        </div>
        {originSuggestions.length > 0 && (
          <div className="border border-gray-200 rounded-lg mt-1 overflow-hidden shadow-sm max-h-44 overflow-y-auto">
            {originSuggestions.map((p) => (
              <button
                key={p.place_id}
                onClick={() => {
                  const pt = { name: p.display_name, lat: parseFloat(p.lat), lng: parseFloat(p.lon) };
                  setOrigin(pt); setOriginQuery(pt.name); clearOrigin();
                }}
                className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 text-gray-600 border-b border-gray-100 last:border-b-0"
              >
                {p.display_name}
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-2 mt-2">
          <button onClick={handleGPS} className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
            <Navigation size={12} /> Use GPS
          </button>
          <button
            onClick={() => setClickMode(clickMode === "origin" ? null : "origin")}
            className={`flex items-center gap-1 text-xs ${clickMode === "origin" ? "text-green-600" : "text-gray-400 hover:text-gray-600"}`}
          >
            <MapPin size={12} /> {clickMode === "origin" ? "Click map…" : "Pick on map"}
          </button>
        </div>
      </div>

      {/* Destination */}
      <div>
        <label className="block text-xs text-gray-500 mb-1 flex items-center gap-1">
          <MapPin size={12} className="text-red-500" /> Destination
        </label>
        <div className="relative">
          <input
            value={destQuery}
            onChange={(e) => { setDestQuery(e.target.value); setDest(null); }}
            placeholder={destLoading ? "Searching…" : "Search destination…"}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm pr-8 focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          {destQuery && (
            <button
              onClick={() => { setDestQuery(""); setDest(null); clearDest(); }}
              className="absolute right-2 top-2.5 text-gray-300 hover:text-gray-500"
            >
              <X size={14} />
            </button>
          )}
        </div>
        {destSuggestions.length > 0 && (
          <div className="border border-gray-200 rounded-lg mt-1 overflow-hidden shadow-sm max-h-44 overflow-y-auto">
            {destSuggestions.map((p) => (
              <button
                key={p.place_id}
                onClick={() => {
                  const pt = { name: p.display_name, lat: parseFloat(p.lat), lng: parseFloat(p.lon) };
                  setDest(pt); setDestQuery(pt.name);
                  clearDest(); setIsRouting(true);
                  setRouteSummary(null); setRoutingError(null);
                }}
                className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 text-gray-600 border-b border-gray-100 last:border-b-0"
              >
                {p.display_name}
              </button>
            ))}
          </div>
        )}
        <button
          onClick={() => setClickMode(clickMode === "dest" ? null : "dest")}
          className={`flex items-center gap-1 text-xs mt-2 ${clickMode === "dest" ? "text-red-600" : "text-gray-400 hover:text-gray-600"}`}
        >
          <MapPin size={12} /> {clickMode === "dest" ? "Click map…" : "Pick on map"}
        </button>
      </div>

      {/* Clear */}
      {(origin || dest) && (
        <button onClick={clearRoute} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600">
          <RotateCcw size={12} /> Clear route
        </button>
      )}

      {/* Routing states */}
      {origin && dest && isRouting && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-2">
          <div className="w-3 h-3 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
          <p className="text-xs text-blue-700">Calculating road route…</p>
        </div>
      )}

      {routeSummary && !isRouting && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg overflow-hidden">
          <div className="p-3">
            <p className="text-xs text-blue-800 mb-2">Route found via road network</p>
            <div className="flex gap-3">
              <div className="flex items-center gap-1.5">
                <Ruler size={13} className="text-blue-500" />
                <span className="text-xs text-blue-700">{formatDistance(routeSummary.totalDistance)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock size={13} className="text-blue-500" />
                <span className="text-xs text-blue-700">{formatDuration(routeSummary.totalTime)}</span>
              </div>
            </div>
          </div>
          {routeSummary.instructions.length > 0 && (
            <>
              <button
                onClick={() => setShowDirections((v) => !v)}
                className="w-full flex items-center justify-between px-3 py-2 bg-blue-100 hover:bg-blue-200 text-xs text-blue-700 transition-colors border-t border-blue-200"
              >
                <span>Turn-by-turn directions</span>
                {showDirections ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </button>
              {showDirections && (
                <div className="max-h-48 overflow-y-auto divide-y divide-blue-100">
                  {routeSummary.instructions.map((ins, i) => (
                    <div key={i} className="px-3 py-2">
                      <p className="text-xs text-blue-800">{ins.text}</p>
                      {ins.distance > 0 && (
                        <p className="text-xs text-blue-500 mt-0.5">{formatDistance(ins.distance)}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {routingError && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
          <p className="text-xs text-orange-700">Could not calculate road route.</p>
          <p className="text-xs text-orange-500 mt-0.5">{routingError}</p>
        </div>
      )}

      {showAlert && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle size={14} className="text-red-500" />
            <p className="text-xs text-red-700">Heavy traffic on your route!</p>
          </div>
          <button
            onClick={() => setShowAlert(false)}
            className="w-full mt-2 bg-red-500 hover:bg-red-600 text-white text-xs py-1.5 rounded-md"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Traffic summary */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Clock size={13} className="text-gray-500" />
          <span className="text-xs text-gray-500">Traffic Conditions</span>
        </div>
        {heavySegs.length > 0 ? (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3 mb-2">
            <AlertTriangle size={13} className="text-red-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-red-700">Heavy traffic detected</p>
              {heavySegs.map((s) => (
                <p key={s.id} className="text-xs text-red-500 mt-0.5">· {s.name}</p>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg p-3 mb-2">
            <CheckCircle size={13} className="text-green-600" />
            <p className="text-xs text-green-700">All clear on your route</p>
          </div>
        )}
        <div className="space-y-1">
          {traffic.map((seg) => (
            <div
              key={seg.id}
              className={`flex items-center justify-between px-3 py-1.5 rounded-lg border text-xs ${trafficBadge[seg.level]}`}
            >
              <span>{seg.name}</span>
              <span className="capitalize">{seg.level}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const GpsTrackPanel = (
    <div className="p-4 space-y-4">
      {/* Start / Stop button */}
      {!gpsTracking ? (
        <button
          onClick={startTracking}
          className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-xl transition-colors"
        >
          <Play size={16} />
          Start GPS Tracking
        </button>
      ) : (
        <button
          onClick={stopTracking}
          className="w-full flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 text-white py-3 rounded-xl transition-colors animate-pulse"
        >
          <Square size={16} />
          Stop Tracking
        </button>
      )}

      {/* Live status badge */}
      {gpsTracking && (
        <div className="flex items-center gap-2 bg-purple-50 border border-purple-200 rounded-lg px-3 py-2">
          <span className="w-2 h-2 rounded-full bg-purple-500 animate-ping inline-block" />
          <span className="text-xs text-purple-700">Tracking live position…</span>
        </div>
      )}

      {/* Stats grid — shown while tracking or after stop */}
      {(gpsTracking || gpsDistKm > 0 || gpsFinishedDist !== null) && (
        <div className="grid grid-cols-2 gap-2">
          {/* Distance */}
          <div className="bg-purple-50 rounded-xl p-3">
            <p className="text-xs text-purple-500 flex items-center gap-1">
              <Ruler size={11} /> Distance
            </p>
            <p className="text-purple-800 mt-1">
              {unit === "imperial"
                ? `${((gpsDistKm || 0) * 0.621371).toFixed(2)} mi`
                : `${(gpsDistKm || 0).toFixed(2)} km`}
            </p>
          </div>

          {/* Elapsed time */}
          <div className="bg-blue-50 rounded-xl p-3">
            <p className="text-xs text-blue-500 flex items-center gap-1">
              <Clock size={11} /> Elapsed
            </p>
            <p className="text-blue-800 mt-1">{fmtElapsed(gpsElapsed)}</p>
          </div>

          {/* Speed */}
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-xs text-gray-500 flex items-center gap-1">
              <Gauge size={11} /> Speed
            </p>
            <p className="text-gray-800 mt-1">
              {gpsSpeed !== null
                ? unit === "imperial"
                  ? `${(gpsSpeed * 2.23694).toFixed(0)} mph`
                  : `${(gpsSpeed * 3.6).toFixed(0)} km/h`
                : "—"}
            </p>
          </div>

          {/* Fuel used estimate */}
          <div className="bg-amber-50 rounded-xl p-3">
            <p className="text-xs text-amber-500 flex items-center gap-1">
              <Fuel size={11} /> Fuel Est.
            </p>
            <p className="text-amber-800 mt-1">
              {gpsEstFuel !== null
                ? unit === "imperial"
                  ? `${(gpsEstFuel * 0.264172).toFixed(3)} gal`
                  : `${gpsEstFuel.toFixed(2)} L`
                : vehicle ? "—" : "Set vehicle"}
            </p>
          </div>
        </div>
      )}

      {/* "Use this distance" button after tracking stops */}
      {!gpsTracking && gpsFinishedDist !== null && gpsFinishedDist > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 space-y-2">
          <p className="text-xs text-green-700">
            Trip complete ·{" "}
            {unit === "imperial"
              ? `${(gpsFinishedDist * 0.621371).toFixed(2)} mi`
              : `${gpsFinishedDist.toFixed(2)} km`}
          </p>
          <button
            onClick={useGpsTripDistance}
            className="w-full flex items-center justify-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-xs py-2 rounded-lg transition-colors"
          >
            <CheckCheck size={13} />
            Use as Trip Distance for Fuel Tab
          </button>
        </div>
      )}

      {/* Info when idle */}
      {!gpsTracking && gpsDistKm === 0 && gpsFinishedDist === null && (
        <div className="text-center py-6 text-gray-400">
          <Satellite size={32} className="mx-auto mb-2 opacity-30" />
          <p className="text-xs">Press Start to begin tracking your drive.</p>
          <p className="text-xs mt-1 opacity-70">Distance is sent to the Fuel tab for consumption estimates.</p>
        </div>
      )}

      {/* Traffic quick-view */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Clock size={13} className="text-gray-500" />
          <span className="text-xs text-gray-500">Traffic Conditions</span>
        </div>
        {heavySegs.length > 0 ? (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-2.5 mb-2">
            <AlertTriangle size={12} className="text-red-500 mt-0.5 shrink-0" />
            <p className="text-xs text-red-700">Heavy traffic: {heavySegs.map((s) => s.name).join(", ")}</p>
          </div>
        ) : (
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg p-2.5">
            <CheckCircle size={12} className="text-green-600" />
            <p className="text-xs text-green-700">All clear</p>
          </div>
        )}
      </div>
    </div>
  );

  // ── Tab config (shared between desktop tab bar & mobile bottom bar) ────────
  const TABS = [
    { key: "route"   as Tab, label: "Route",   Icon: Map      },
    { key: "vehicle" as Tab, label: "Vehicle", Icon: Car      },
    { key: "fuel"    as Tab, label: "Fuel",    Icon: Droplets },
  ] as const;

  const handleMobileTabPress = (key: Tab) => {
    if (activeTab === key && mobilePanelOpen) {
      setMobilePanelOpen(false);
    } else {
      setActiveTab(key);
      setMobilePanelOpen(true);
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col bg-gray-50" style={{ height: "100dvh" }}>
      <NavBar />

      <div className="flex flex-1 overflow-hidden">
        {/* ── Sidebar — desktop only ───────────────────────────────────────── */}
        <aside className={`${isMobile ? "hidden" : "flex"} w-80 bg-white border-r border-gray-200 flex-col overflow-hidden`}>

          {/* Header + unit toggle */}
          <div className="p-4 border-b border-gray-100 flex items-center justify-between shrink-0">
            <div>
              <div className="flex items-center gap-2">
                <Bus size={15} className="text-blue-600" />
                <h2 className="text-gray-800 text-sm">Driver</h2>
              </div>
              <p className="text-gray-400 text-xs mt-0.5">Route & fuel tracking</p>
            </div>
            <button
              onClick={() => setUnit((u) => u === "metric" ? "imperial" : "metric")}
              className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-full border transition-all ${
                unit === "metric"
                  ? "bg-blue-50 border-blue-200 text-blue-700"
                  : "bg-orange-50 border-orange-200 text-orange-700"
              }`}
            >
              {unit === "metric" ? "km / L" : "mi / gal"}
            </button>
          </div>

          {/* Tab bar */}
          <div className="flex border-b border-gray-100 shrink-0">
            {TABS.map(({ key, label, Icon }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 text-xs transition-all border-b-2 ${
                  activeTab === key
                    ? "border-blue-500 text-blue-700"
                    : "border-transparent text-gray-400 hover:text-gray-600"
                }`}
              >
                <Icon size={15} />
                {label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto">
            {activeTab === "route" && (
              loading ? (
                <div className="flex items-center justify-center h-24 text-gray-400 text-sm">Loading…</div>
              ) : (
                <div className="flex flex-col h-full">
                  {/* Sub-mode toggle */}
                  <div className="flex m-3 bg-gray-100 rounded-lg p-1 gap-1 shrink-0">
                    <button
                      onClick={() => setRouteMode("set-route")}
                      className={`flex-1 flex items-center justify-center gap-1.5 text-xs py-1.5 rounded-md transition-all ${
                        routeMode === "set-route"
                          ? "bg-white shadow text-blue-700"
                          : "text-gray-500 hover:text-gray-700"
                      }`}
                    >
                      <RouteIcon size={12} /> Set Route
                    </button>
                    <button
                      onClick={() => setRouteMode("gps-track")}
                      className={`flex-1 flex items-center justify-center gap-1.5 text-xs py-1.5 rounded-md transition-all ${
                        routeMode === "gps-track"
                          ? "bg-white shadow text-purple-700"
                          : "text-gray-500 hover:text-gray-700"
                      }`}
                    >
                      <Satellite size={12} /> GPS Track
                    </button>
                  </div>

                  {/* Sub-mode content */}
                  <div className="flex-1 overflow-y-auto">
                    {routeMode === "set-route" ? SetRoutePanel : GpsTrackPanel}
                  </div>
                </div>
              )
            )}

            {activeTab === "vehicle" && user && (
              <VehicleProfile
                userId={user.id}
                unit={unit}
                onVehicleSaved={setVehicle}
              />
            )}

            {activeTab === "fuel" && user && (
              <FuelTracker
                userId={user.id}
                unit={unit}
                vehicle={vehicle}
                tripDistanceKm={tripDistanceKm}
              />
            )}
          </div>
        </aside>

        {/* ── Map ──────────────────────────────────────────────────────────── */}
        <main className={`flex-1 relative ${isMobile ? "pb-16" : ""}`}>
          {loading ? (
            <div className="flex items-center justify-center h-full text-gray-400 text-sm">
              Loading map…
            </div>
          ) : (
            <MapView
              center={mapCenter}
              traffic={traffic}
              originPin={origin ? [origin.lat, origin.lng] : null}
              destPin={dest   ? [dest.lat,   dest.lng]   : null}
              onMapClick={clickMode ? handleMapClick : undefined}
            >
              {/* OSRM route (Set Route mode) */}
              {routeMode === "set-route" && origin && dest && (
                <RoutingMachine
                  origin={[origin.lat, origin.lng]}
                  dest={[dest.lat, dest.lng]}
                  onRouteFound={handleRouteFound}
                  onRoutingError={handleRoutingError}
                />
              )}

              {/* GPS track polyline */}
              {routeMode === "gps-track" && gpsPath.length > 1 && (
                <Polyline
                  positions={gpsPath}
                  pathOptions={{ color: "#8b5cf6", weight: 4, opacity: 0.85 }}
                />
              )}

              {/* GPS current position dot */}
              {routeMode === "gps-track" && gpsCurrentPos && (
                <Marker position={gpsCurrentPos} icon={gpsDotIcon} />
              )}
            </MapView>
          )}

          {/* Click-mode hint overlay */}
          {clickMode && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-gray-900/80 text-white text-xs px-4 py-2 rounded-full pointer-events-none z-[500]">
              Click on the map to set {clickMode === "origin" ? "origin" : "destination"}
            </div>
          )}
        </main>
      </div>

      {/* ── Mobile bottom tab bar ────────────────────────────────────────────── */}
      {isMobile && (
        <nav
          className="fixed inset-x-0 bottom-0 bg-white border-t border-gray-200 flex"
          style={{ zIndex: 1001, paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        >
          {/* Unit toggle pill — far left */}
          <button
            onClick={() => setUnit((u) => u === "metric" ? "imperial" : "metric")}
            className={`px-3 py-2 text-xs border-r border-gray-200 flex items-center gap-1 ${
              unit === "metric" ? "text-blue-600" : "text-orange-600"
            }`}
          >
            {unit === "metric" ? "km/L" : "mi/g"}
          </button>

          {/* Tabs */}
          {TABS.map(({ key, label, Icon }) => (
            <button
              key={key}
              onClick={() => handleMobileTabPress(key)}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-xs transition-colors ${
                activeTab === key && mobilePanelOpen
                  ? "text-blue-600"
                  : "text-gray-400"
              }`}
            >
              <Icon size={18} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      )}

      {/* ── Mobile bottom sheet ──────────────────────────────────────────────── */}
      {isMobile && (
        <MobileBottomSheet
          open={mobilePanelOpen}
          onClose={() => setMobilePanelOpen(false)}
          title={
            activeTab === "route"   ? "Route" :
            activeTab === "vehicle" ? "Vehicle Profile" :
            "Fuel Tracker"
          }
        >
          {/* Unit toggle inside sheet header area */}
          <div className="px-4 pt-2 flex items-center justify-between border-b border-gray-100 pb-2">
            <span className="text-xs text-gray-400">
              {activeTab === "route"   ? "Route & Navigation" :
               activeTab === "vehicle" ? "Your vehicle details" :
               "Consumption & costs"}
            </span>
            <button
              onClick={() => setUnit((u) => u === "metric" ? "imperial" : "metric")}
              className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border transition-all ${
                unit === "metric"
                  ? "bg-blue-50 border-blue-200 text-blue-700"
                  : "bg-orange-50 border-orange-200 text-orange-700"
              }`}
            >
              {unit === "metric" ? "km / L" : "mi / gal"}
            </button>
          </div>
          {activeTab === "route" && (
            loading ? (
              <div className="flex items-center justify-center h-24 text-gray-400 text-sm">Loading…</div>
            ) : (
              <div className="flex flex-col h-full">
                {/* Sub-mode toggle */}
                <div className="flex m-3 bg-gray-100 rounded-lg p-1 gap-1 shrink-0">
                  <button
                    onClick={() => setRouteMode("set-route")}
                    className={`flex-1 flex items-center justify-center gap-1.5 text-xs py-1.5 rounded-md transition-all ${
                      routeMode === "set-route"
                        ? "bg-white shadow text-blue-700"
                        : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    <RouteIcon size={12} /> Set Route
                  </button>
                  <button
                    onClick={() => setRouteMode("gps-track")}
                    className={`flex-1 flex items-center justify-center gap-1.5 text-xs py-1.5 rounded-md transition-all ${
                      routeMode === "gps-track"
                        ? "bg-white shadow text-purple-700"
                        : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    <Satellite size={12} /> GPS Track
                  </button>
                </div>

                {/* Sub-mode content */}
                <div className="flex-1 overflow-y-auto">
                  {routeMode === "set-route" ? SetRoutePanel : GpsTrackPanel}
                </div>
              </div>
            )
          )}

          {activeTab === "vehicle" && user && (
            <VehicleProfile
              userId={user.id}
              unit={unit}
              onVehicleSaved={setVehicle}
            />
          )}

          {activeTab === "fuel" && user && (
            <FuelTracker
              userId={user.id}
              unit={unit}
              vehicle={vehicle}
              tripDistanceKm={tripDistanceKm}
            />
          )}
        </MobileBottomSheet>
      )}
    </div>
  );
}