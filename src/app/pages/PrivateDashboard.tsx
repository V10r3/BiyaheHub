import { useEffect, useState, useCallback } from "react";
import { NavBar } from "../components/NavBar";
import { trafficApi, type TrafficSegment } from "../services/api";
import {
  MapPin, Navigation, AlertTriangle, RotateCcw, X,
  Clock, Ruler, ChevronDown, ChevronUp,
} from "lucide-react";
import { useMapEvents } from "react-leaflet";
import { MapContainer, TileLayer, Polyline, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { RoutingMachine, formatDistance, formatDuration, type RouteSummary } from "../components/RoutingMachine";

// ── Cebu-area place list ───────────────────────────────────────────────────────
const PLACES = [
  { name: "SM City Cebu",        lat: 10.3116, lng: 123.9185 },
  { name: "Ayala Center Cebu",   lat: 10.3185, lng: 123.9054 },
  { name: "Parkmall Mandaue",    lat: 10.3517, lng: 123.9358 },
  { name: "Cebu IT Park",        lat: 10.3277, lng: 123.9055 },
  { name: "University of Cebu",  lat: 10.2956, lng: 123.8984 },
  { name: "Carbon Market",       lat: 10.2922, lng: 123.9012 },
  { name: "Mactan Airport",      lat: 10.3074, lng: 123.9797 },
  { name: "South Bus Terminal",  lat: 10.2803, lng: 123.8827 },
  { name: "Colon Street",        lat: 10.2937, lng: 123.9009 },
  { name: "Talamban Cebu",       lat: 10.3671, lng: 123.9103 },
];

const trafficColors: Record<string, string> = {
  clear: "#22c55e",
  moderate: "#f59e0b",
  heavy: "#ef4444",
};

function createPin(color: string, label: string) {
  return L.divIcon({
    html: `<div style="background:${color};color:white;padding:3px 8px;border-radius:6px;font-size:11px;font-weight:700;box-shadow:0 2px 6px rgba(0,0,0,0.3);white-space:nowrap">${label}</div>`,
    className: "",
    iconAnchor: [0, 10],
  });
}

interface ClickHandlerProps {
  onClick: (lat: number, lng: number) => void;
}
function ClickHandler({ onClick }: ClickHandlerProps) {
  useMapEvents({
    click(e) { onClick(e.latlng.lat, e.latlng.lng); },
  });
  return null;
}

export default function PrivateDashboard() {
  const [traffic, setTraffic]           = useState<TrafficSegment[]>([]);
  const [originQuery, setOriginQuery]   = useState("");
  const [destQuery, setDestQuery]       = useState("");
  const [origin, setOrigin]             = useState<{ name: string; lat: number; lng: number } | null>(null);
  const [dest, setDest]                 = useState<{ name: string; lat: number; lng: number } | null>(null);
  const [clickMode, setClickMode]       = useState<"origin" | "dest" | null>(null);
  const [showAlert, setShowAlert]       = useState(false);
  const [loading, setLoading]           = useState(true);

  // LRM route info
  const [routeSummary, setRouteSummary]     = useState<RouteSummary | null>(null);
  const [routingError, setRoutingError]     = useState<string | null>(null);
  const [showDirections, setShowDirections] = useState(false);
  const [isRouting, setIsRouting]           = useState(false);

  useEffect(() => {
    trafficApi.getCurrent().then((t) => {
      setTraffic(t);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (origin && dest) {
      const heavy = traffic.some((t) => t.level === "heavy");
      setShowAlert(heavy);
      setRouteSummary(null);
      setRoutingError(null);
      setIsRouting(true);
    }
  }, [origin, dest, traffic]);

  const originSuggestions = PLACES.filter(
    (p) => originQuery.length > 1 && p.name.toLowerCase().includes(originQuery.toLowerCase())
  );
  const destSuggestions = PLACES.filter(
    (p) => destQuery.length > 1 && p.name.toLowerCase().includes(destQuery.toLowerCase())
  );

  const handleMapClick = useCallback((lat: number, lng: number) => {
    const label = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    if (clickMode === "origin") {
      setOrigin({ name: label, lat, lng });
      setOriginQuery(label);
      setClickMode(null);
    } else if (clickMode === "dest") {
      setDest({ name: label, lat, lng });
      setDestQuery(label);
      setClickMode(null);
    }
  }, [clickMode]);

  const handleGPS = () => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setOrigin({ name: "Current Location", lat, lng });
        setOriginQuery("Current Location");
      },
      () => alert("Could not get GPS location.")
    );
  };

  const clearRoute = () => {
    setOrigin(null);
    setDest(null);
    setOriginQuery("");
    setDestQuery("");
    setShowAlert(false);
    setClickMode(null);
    setRouteSummary(null);
    setRoutingError(null);
    setIsRouting(false);
    setShowDirections(false);
  };

  const handleRouteFound = useCallback((summary: RouteSummary) => {
    setRouteSummary(summary);
    setRoutingError(null);
    setIsRouting(false);
  }, []);

  const handleRoutingError = useCallback((msg: string) => {
    setRoutingError(msg);
    setIsRouting(false);
  }, []);

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <NavBar />

      <div className="flex flex-1 overflow-hidden">
        {/* ── Sidebar ── */}
        <aside className="w-72 bg-white border-r border-gray-200 flex flex-col overflow-y-auto">
          <div className="p-4 border-b border-gray-100">
            <h2 className="text-gray-800 text-sm">Private Driver</h2>
            <p className="text-gray-400 text-xs mt-0.5">Road-following route with live traffic</p>
          </div>

          <div className="p-4 space-y-4">
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
                  <button onClick={() => { setOriginQuery(""); setOrigin(null); }} className="absolute right-2 top-2.5 text-gray-300 hover:text-gray-500">
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
                  <button onClick={() => { setDestQuery(""); setDest(null); }} className="absolute right-2 top-2.5 text-gray-300 hover:text-gray-500">
                    <X size={14} />
                  </button>
                )}
              </div>
              {destSuggestions.length > 0 && (
                <div className="border border-gray-200 rounded-lg mt-1 overflow-hidden shadow-sm">
                  {destSuggestions.map((p) => (
                    <button
                      key={p.name}
                      onClick={() => { setDest(p); setDestQuery(p.name); }}
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

            {/* Routing status */}
            {origin && dest && isRouting && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-2">
                <div className="w-3 h-3 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
                <p className="text-xs text-blue-700">Calculating road route…</p>
              </div>
            )}

            {/* Route summary */}
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

                {/* Turn-by-turn toggle */}
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

            {/* Routing error */}
            {routingError && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                <p className="text-xs text-orange-700">Could not calculate road route.</p>
                <p className="text-xs text-orange-500 mt-0.5">{routingError}</p>
              </div>
            )}

            {/* Traffic alert */}
            {showAlert && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle size={14} className="text-red-500" />
                  <p className="text-xs text-red-700">Heavy traffic on your route!</p>
                </div>
                <p className="text-xs text-red-500 mb-2">Consider an alternate route to save time.</p>
                <button
                  onClick={() => setShowAlert(false)}
                  className="w-full bg-red-500 hover:bg-red-600 text-white text-xs py-1.5 rounded-md transition-colors"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Traffic legend */}
            <div>
              <p className="text-xs text-gray-500 mb-2">Traffic Legend</p>
              {["clear", "moderate", "heavy"].map((level) => (
                <div key={level} className="flex items-center gap-2 mb-1">
                  <div className="w-4 h-2 rounded-full" style={{ background: trafficColors[level] }} />
                  <span className="text-xs text-gray-500 capitalize">{level}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* ── Map ── */}
        <main className="flex-1 relative">
          {clickMode && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[999] bg-white border border-blue-300 shadow-lg rounded-full px-4 py-2 flex items-center gap-2 text-sm text-blue-700">
              <MapPin size={14} />
              Click the map to set {clickMode === "origin" ? "origin" : "destination"}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center h-full text-gray-400 text-sm">Loading map…</div>
          ) : (
            <MapContainer
              center={[10.3157, 123.8854]}
              zoom={13}
              className="w-full h-full"
              style={{ height: "100%" }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <ClickHandler onClick={handleMapClick} />

              {/* Traffic overlays — static coloured bands (no OSRM) */}
              {traffic.map((seg) => (
                <Polyline
                  key={`traffic-${seg.id}`}
                  positions={[[seg.latStart, seg.lngStart], [seg.latEnd, seg.lngEnd]]}
                  pathOptions={{ color: trafficColors[seg.level], weight: 8, opacity: 0.65 }}
                />
              ))}

              {/* LRM road-following route */}
              {origin && dest && (
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

              {/* Origin / destination markers */}
              {origin && (
                <Marker position={[origin.lat, origin.lng]} icon={createPin("#22c55e", "Start")}>
                  <Popup>{origin.name}</Popup>
                </Marker>
              )}
              {dest && (
                <Marker position={[dest.lat, dest.lng]} icon={createPin("#ef4444", "End")}>
                  <Popup>{dest.name}</Popup>
                </Marker>
              )}
            </MapContainer>
          )}
        </main>
      </div>
    </div>
  );
}