import { useEffect, useState, useCallback } from "react";
import { NavBar } from "../components/NavBar";
import { MapView } from "../components/MapView";
import { VehicleProfile } from "../components/VehicleProfile";
import { FuelTracker } from "../components/FuelTracker";
import { RoutingMachine, formatDistance, formatDuration, type RouteSummary } from "../components/RoutingMachine";
import {
  routesApi, trafficApi,
  type Route, type TrafficSegment, type UserVehicle,
} from "../services/api";
import { useAuth } from "../context/AuthContext";
import {
  routeLengthKm, fmtDistance, type UnitSystem,
} from "../utils/fuelCalc";
import {
  Map, Car, Droplets, AlertTriangle, CheckCircle,
  Clock, Users, MapPin, Navigation, RotateCcw, X,
  Ruler, ChevronDown, ChevronUp, Bus,
} from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────────────
const PLACES = [
  { name: "SM City Cebu",        lat: 10.3116, lng: 123.9185 },
  { name: "Ayala Center Cebu",   lat: 10.3185, lng: 123.9054 },
  { name: "Parkmall Mandaue",    lat: 10.3517, lng: 123.9358 },
  { name: "Cebu IT Park",        lat: 10.3277, lng: 123.9055 },
  { name: "University of Cebu",  lat: 10.2956, lng: 123.8984 },
  { name: "Carbon Market",       lat: 10.2922, lng: 123.9012 },
  { name: "Mactan Airport",      lat: 10.3074, lng: 123.9797 },
  { name: "South Bus Terminal",  lat: 10.2803, lng: 123.8827 },
  { name: "North Bus Terminal",  lat: 10.3550, lng: 123.9108 },
  { name: "Colon Street",        lat: 10.2937, lng: 123.9009 },
  { name: "Talamban Cebu",       lat: 10.3671, lng: 123.9103 },
  { name: "Mandaue City",        lat: 10.3236, lng: 123.9448 },
  { name: "Banilad",             lat: 10.3373, lng: 123.9000 },
];

const trafficColors: Record<string, string> = {
  clear: "#22c55e", moderate: "#f59e0b", heavy: "#ef4444",
};
const trafficBadge: Record<string, string> = {
  clear:    "bg-green-100 text-green-700 border-green-200",
  moderate: "bg-yellow-100 text-yellow-700 border-yellow-200",
  heavy:    "bg-red-100 text-red-700 border-red-200",
};

type Tab = "route" | "vehicle" | "fuel";

// ─── Component ────────────────────────────────────────────────────────────────
export default function DriverDashboard() {
  const { user } = useAuth();
  const isPUV = user?.accountType === "puvpuj";

  // ── Shared state ──────────────────────────────────────────────────────────
  const [activeTab, setActiveTab]   = useState<Tab>("route");
  const [unit, setUnit]             = useState<UnitSystem>("metric");
  const [traffic, setTraffic]       = useState<TrafficSegment[]>([]);
  const [vehicle, setVehicle]       = useState<UserVehicle | null>(null);
  const [tripDistanceKm, setTripDist] = useState<number | null>(null);
  const [loading, setLoading]       = useState(true);

  // ── PUV-specific state ────────────────────────────────────────────────────
  const [routes, setRoutes]         = useState<Route[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [passengers, setPassengers] = useState(0);
  const [seatsTotal]                = useState(16);

  // ── Private-specific state ────────────────────────────────────────────────
  const [originQuery, setOriginQuery] = useState("");
  const [destQuery, setDestQuery]     = useState("");
  const [origin, setOrigin]           = useState<{ name: string; lat: number; lng: number } | null>(null);
  const [dest, setDest]               = useState<{ name: string; lat: number; lng: number } | null>(null);
  const [clickMode, setClickMode]     = useState<"origin" | "dest" | null>(null);
  const [routeSummary, setRouteSummary] = useState<RouteSummary | null>(null);
  const [routingError, setRoutingError] = useState<string | null>(null);
  const [isRouting, setIsRouting]     = useState(false);
  const [showDirections, setShowDirections] = useState(false);
  const [showAlert, setShowAlert]     = useState(false);

  // ── Bootstrap ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const loaders: Promise<unknown>[] = [trafficApi.getCurrent().then(setTraffic)];
    if (isPUV) {
      loaders.push(
        routesApi.getAll().then((r) => {
          setRoutes(r);
          setSelectedRoute(r[0] ?? null);
          if (r[0]) setTripDist(routeLengthKm(r[0].waypoints));
        })
      );
    }
    Promise.all(loaders).finally(() => setLoading(false));
  }, [isPUV]);

  // ── Update trip distance when PUV route changes ───────────────────────────
  useEffect(() => {
    if (selectedRoute) setTripDist(routeLengthKm(selectedRoute.waypoints));
  }, [selectedRoute]);

  // ── Update trip distance from OSRM result ─────────────────────────────────
  useEffect(() => {
    if (routeSummary) setTripDist(routeSummary.totalDistance / 1000);
  }, [routeSummary]);

  // ── Heavy traffic alert for private mode ─────────────────────────────────
  useEffect(() => {
    if (!isPUV && origin && dest) {
      setShowAlert(traffic.some((t) => t.level === "heavy"));
    }
  }, [origin, dest, traffic, isPUV]);

  // ── Private routing callbacks ─────────────────────────────────────────────
  const handleRouteFound  = useCallback((s: RouteSummary) => {
    setRouteSummary(s);
    setRoutingError(null);
    setIsRouting(false);
  }, []);
  const handleRoutingError = useCallback((msg: string) => {
    setRoutingError(msg);
    setIsRouting(false);
  }, []);

  const handleMapClick = useCallback((latlng: [number, number]) => {
    const label = `${latlng[0].toFixed(4)}, ${latlng[1].toFixed(4)}`;
    if (clickMode === "origin") {
      setOrigin({ name: label, lat: latlng[0], lng: latlng[1] });
      setOriginQuery(label);
    } else if (clickMode === "dest") {
      setDest({ name: label, lat: latlng[0], lng: latlng[1] });
      setDestQuery(label);
    }
    setClickMode(null);
  }, [clickMode]);

  const handleGPS = () => {
    navigator.geolocation.getCurrentPosition(
      ({ coords: { latitude: lat, longitude: lng } }) => {
        setOrigin({ name: "Current Location", lat, lng });
        setOriginQuery("Current Location");
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
  };

  const originSuggestions = PLACES.filter(
    (p) => originQuery.length > 1 && p.name.toLowerCase().includes(originQuery.toLowerCase())
  );
  const destSuggestions = PLACES.filter(
    (p) => destQuery.length > 1 && p.name.toLowerCase().includes(destQuery.toLowerCase())
  );
  const heavySegs = traffic.filter((t) => t.level === "heavy");

  // ─── Map props ─────────────────────────────────────────────────────────────
  const mapCenter: [number, number] = isPUV
    ? (selectedRoute?.waypoints[Math.floor(selectedRoute.waypoints.length / 2)] ?? [10.3, 123.895])
    : [10.3157, 123.8854];

  // ── Sidebar tab content ────────────────────────────────────────────────────

  const RouteTabPUV = (
    <div className="overflow-y-auto flex-1">
      {/* Route list */}
      <div className="p-4 border-b border-gray-100">
        <label className="block text-xs text-gray-500 mb-2">My Route</label>
        <div className="space-y-2">
          {routes.map((r) => (
            <button
              key={r.id}
              onClick={() => setSelectedRoute(r)}
              className={`w-full text-left px-3 py-2 rounded-lg border text-sm transition-all ${
                selectedRoute?.id === r.id
                  ? "border-blue-500 bg-blue-50 text-blue-700"
                  : "border-gray-200 text-gray-600 hover:border-gray-300"
              }`}
            >
              <p className="text-xs text-gray-400">{r.designation}</p>
              <p>{r.name}</p>
              <p className="text-xs text-gray-400">Fare: ₱{r.fare}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Passenger tracker */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center gap-2 mb-3">
          <Users size={14} className="text-blue-600" />
          <span className="text-xs text-gray-500">Passenger Count</span>
        </div>
        <div className="text-center mb-3">
          <span className="text-3xl text-blue-700">{passengers}</span>
          <span className="text-gray-400 text-sm"> / {seatsTotal}</span>
        </div>
        <div className="bg-gray-100 rounded-full h-2 mb-3">
          <div
            className="h-2 rounded-full transition-all"
            style={{
              width: `${(passengers / seatsTotal) * 100}%`,
              background: passengers / seatsTotal > 0.8 ? "#ef4444" : "#3b82f6",
            }}
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setPassengers((p) => Math.max(0, p - 1))}
            className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-1.5 rounded-lg text-sm transition-colors"
          >
            − Off
          </button>
          <button
            onClick={() => setPassengers((p) => Math.min(seatsTotal, p + 1))}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-1.5 rounded-lg text-sm transition-colors"
          >
            + On
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2 text-center">{seatsTotal - passengers} seats available</p>
      </div>

      {/* Traffic summary */}
      <div className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Clock size={14} className="text-gray-500" />
          <span className="text-xs text-gray-500">Traffic on Route</span>
        </div>
        {heavySegs.length > 0 ? (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
            <AlertTriangle size={14} className="text-red-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-red-700">Heavy traffic detected</p>
              {heavySegs.map((s) => (
                <p key={s.id} className="text-xs text-red-500 mt-0.5">· {s.name}</p>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg p-3 mb-3">
            <CheckCircle size={14} className="text-green-600" />
            <p className="text-xs text-green-700">All clear on your route</p>
          </div>
        )}
        <div className="space-y-1.5">
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

  const RouteTabPrivate = (
    <div className="overflow-y-auto flex-1 p-4 space-y-4">
      {/* Origin */}
      <div>
        <label className="block text-xs text-gray-500 mb-1 flex items-center gap-1">
          <MapPin size={12} className="text-green-500" /> Origin
        </label>
        <div className="relative">
          <input
            value={originQuery}
            onChange={(e) => setOriginQuery(e.target.value)}
            placeholder="Search or pick on map…"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm pr-8 focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          {originQuery && (
            <button
              onClick={() => { setOriginQuery(""); setOrigin(null); }}
              className="absolute right-2 top-2.5 text-gray-300 hover:text-gray-500"
            >
              <X size={14} />
            </button>
          )}
        </div>
        {originSuggestions.length > 0 && (
          <div className="border border-gray-200 rounded-lg mt-1 overflow-hidden shadow-sm">
            {originSuggestions.map((p) => (
              <button
                key={p.name}
                onClick={() => { setOrigin(p); setOriginQuery(p.name); }}
                className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 text-gray-600 border-b border-gray-100 last:border-b-0"
              >
                {p.name}
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
            onChange={(e) => setDestQuery(e.target.value)}
            placeholder="Where are you going?"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm pr-8 focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          {destQuery && (
            <button
              onClick={() => { setDestQuery(""); setDest(null); }}
              className="absolute right-2 top-2.5 text-gray-300 hover:text-gray-500"
            >
              <X size={14} />
            </button>
          )}
        </div>
        {destSuggestions.length > 0 && (
          <div className="border border-gray-200 rounded-lg mt-1 overflow-hidden shadow-sm">
            {destSuggestions.map((p) => (
              <button
                key={p.name}
                onClick={() => { setDest(p); setDestQuery(p.name); setIsRouting(true); setRouteSummary(null); setRoutingError(null); }}
                className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 text-gray-600 border-b border-gray-100 last:border-b-0"
              >
                {p.name}
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

      {/* Traffic legend */}
      <div>
        <p className="text-xs text-gray-500 mb-2">Traffic Legend</p>
        {(["clear", "moderate", "heavy"] as const).map((level) => (
          <div key={level} className="flex items-center gap-2 mb-1">
            <div className="w-4 h-2 rounded-full" style={{ background: trafficColors[level] }} />
            <span className="text-xs text-gray-500 capitalize">{level}</span>
          </div>
        ))}
      </div>
    </div>
  );

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <NavBar />

      <div className="flex flex-1 overflow-hidden">
        {/* ── Sidebar ────────────────────────────────────────────────────── */}
        <aside className="w-80 bg-white border-r border-gray-200 flex flex-col overflow-hidden">

          {/* Header + unit toggle */}
          <div className="p-4 border-b border-gray-100 flex items-center justify-between shrink-0">
            <div>
              <div className="flex items-center gap-2">
                {isPUV
                  ? <Bus size={15} className="text-blue-600" />
                  : <Car size={15} className="text-blue-600" />}
                <h2 className="text-gray-800 text-sm">
                  {isPUV ? "PUV / PUJ Driver" : "Private Driver"}
                </h2>
              </div>
              <p className="text-gray-400 text-xs mt-0.5">
                {isPUV ? "Fixed route & fuel tracking" : "Free navigation & fuel tracking"}
              </p>
            </div>

            {/* Metric / Imperial toggle */}
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
            {([ 
              { key: "route",   label: "Route",   Icon: Map },
              { key: "vehicle", label: "Vehicle", Icon: Car },
              { key: "fuel",    label: "Fuel",    Icon: Droplets },
            ] as const).map(({ key, label, Icon }) => (
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
                <div className="flex items-center justify-center h-24 text-gray-400 text-sm">
                  Loading…
                </div>
              ) : isPUV ? RouteTabPUV : RouteTabPrivate
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

        {/* ── Map ────────────────────────────────────────────────────────── */}
        <main className="flex-1 relative">
          {/* Click-mode overlay hint */}
          {!isPUV && clickMode && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[999] bg-white border border-blue-300 shadow-lg rounded-full px-4 py-2 flex items-center gap-2 text-sm text-blue-700">
              <MapPin size={14} />
              Click the map to set {clickMode === "origin" ? "origin" : "destination"}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center h-full text-gray-400 text-sm">
              Loading map…
            </div>
          ) : (
            <MapView
              center={mapCenter}
              routes={isPUV ? routes : []}
              traffic={traffic}
              selectedRouteId={isPUV ? (selectedRoute?.id ?? null) : null}
              originPin={!isPUV && origin ? [origin.lat, origin.lng] : null}
              destPin={!isPUV && dest   ? [dest.lat,   dest.lng]   : null}
              onMapClick={!isPUV ? handleMapClick : undefined}
            >
              {/* OSRM routing — only when private driver has both pins set */}
              {!isPUV && origin && dest && (
                <RoutingMachine
                  key={`${origin.lat},${origin.lng}-${dest.lat},${dest.lng}`}
                  origin={[origin.lat, origin.lng]}
                  dest={[dest.lat, dest.lng]}
                  color="#3b82f6"
                  weight={5}
                  onRouteFound={handleRouteFound}
                  onRoutingError={handleRoutingError}
                />
              )}
            </MapView>
          )}
        </main>
      </div>
    </div>
  );
}
