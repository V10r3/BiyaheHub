import { useEffect, useState, useCallback } from "react";
import { NavBar } from "../components/NavBar";
import {
  routesApi, trafficApi, vehiclesApi,
  type Route, type TrafficSegment, type Vehicle,
} from "../services/api";
import {
  MapPin, Clock, AlertTriangle, ChevronRight,
  X, Ruler, ChevronDown, ChevronUp,
} from "lucide-react";
import { MapContainer, TileLayer, Polyline, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { RoutingMachine, formatDistance, formatDuration, type RouteSummary } from "../components/RoutingMachine";
import { FareCalculator } from "../components/FareCalculator";

const trafficColors: Record<string, string> = {
  clear: "#22c55e",
  moderate: "#f59e0b",
  heavy: "#ef4444",
};

const vehicleColors: Record<string, string> = {
  jeepney: "#3b82f6",
  bus: "#8b5cf6",
  taxi: "#f59e0b",
};

const PLACES = [
  { name: "SM City Cebu",          lat: 10.3116, lng: 123.9185 },
  { name: "Ayala Center Cebu",     lat: 10.3185, lng: 123.9054 },
  { name: "Parkmall Mandaue",      lat: 10.3517, lng: 123.9358 },
  { name: "Cebu IT Park",          lat: 10.3277, lng: 123.9055 },
  { name: "University of Cebu",    lat: 10.2956, lng: 123.8984 },
  { name: "Carbon Market",         lat: 10.2922, lng: 123.9012 },
  { name: "Colon Street",          lat: 10.2937, lng: 123.9009 },
  { name: "Talamban Cebu",         lat: 10.3671, lng: 123.9103 },
  { name: "Urgello",               lat: 10.2950, lng: 123.8900 },
  { name: "Fuente Osmeña",         lat: 10.3024, lng: 123.8944 },
  { name: "Lahug",                 lat: 10.3261, lng: 123.8978 },
  { name: "Banilad",               lat: 10.3373, lng: 123.9000 },
  { name: "Mandaue City",          lat: 10.3236, lng: 123.9448 },
  { name: "Talisay City",          lat: 10.2444, lng: 123.8456 },
  { name: "Bulacao",               lat: 10.2700, lng: 123.8750 },
  { name: "Basak",                 lat: 10.2833, lng: 123.8867 },
  { name: "Mambaling",             lat: 10.2700, lng: 123.8900 },
  { name: "Punta Princesa",        lat: 10.3011, lng: 123.8756 },
  { name: "South Bus Terminal",    lat: 10.2803, lng: 123.8827 },
  { name: "North Bus Terminal",    lat: 10.3550, lng: 123.9108 },
  { name: "Mactan Airport",        lat: 10.3074, lng: 123.9797 },
];

function vehicleEmoji(type: string) {
  return type === "jeepney" ? "🚌" : type === "bus" ? "🚍" : type === "taxi" ? "🚕" : "🚆";
}
function vehicleIcon(type: string) {
  return L.divIcon({
    html: `<div style="font-size:20px">${vehicleEmoji(type)}</div>`,
    className: "",
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}
function pinIcon(color: string, label: string) {
  return L.divIcon({
    html: `<div style="background:${color};color:white;padding:2px 7px;border-radius:5px;font-size:11px;font-weight:700;box-shadow:0 2px 5px rgba(0,0,0,.25);white-space:nowrap">${label}</div>`,
    className: "",
    iconAnchor: [0, 10],
  });
}

export default function CommuterDashboard() {
  const [routes, setRoutes]   = useState<Route[]>([]);
  const [traffic, setTraffic] = useState<TrafficSegment[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);

  const [destQuery, setDestQuery]     = useState("");
  const [dest, setDest]               = useState<{ name: string; lat: number; lng: number } | null>(null);
  const [originQuery, setOriginQuery] = useState("");
  const [origin, setOrigin]           = useState<{ name: string; lat: number; lng: number } | null>(null);

  const [selectedRouteId, setSelectedRouteId] = useState<number | null>(null);
  const [filter, setFilter]                   = useState<"all" | "jeepney" | "bus" | "taxi">("all");
  const [arrivalTime, setArrivalTime]         = useState("");
  const [showAlert, setShowAlert]             = useState(false);

  // LRM state
  const [routeSummary, setRouteSummary]     = useState<RouteSummary | null>(null);
  const [routingError, setRoutingError]     = useState<string | null>(null);
  const [showDirections, setShowDirections] = useState(false);
  const [isRouting, setIsRouting]           = useState(false);

  useEffect(() => {
    Promise.all([
      routesApi.getAll(),
      trafficApi.getCurrent(),
      vehiclesApi.getAll(),
    ]).then(([r, t, v]) => {
      setRoutes(r);
      setTraffic(t);
      setVehicles(v);
      if (r.length) setSelectedRouteId(r[0].id);
    }).finally(() => setLoading(false));
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

  const filteredRoutes   = filter === "all" ? routes   : routes.filter((r) => r.type === filter);
  const filteredVehicles = filter === "all" ? vehicles : vehicles.filter((v) => v.type === filter);

  const originSuggestions = PLACES.filter(
    (p) => originQuery.length > 1 && p.name.toLowerCase().includes(originQuery.toLowerCase())
  );
  const destSuggestions = PLACES.filter(
    (p) => destQuery.length > 1 && p.name.toLowerCase().includes(destQuery.toLowerCase())
  );

  const selectedRoute   = routes.find((r) => r.id === selectedRouteId);
  const routeVehicles   = selectedRoute ? vehicles.filter((v) => v.routeId === selectedRoute.id) : [];
  const totalFare       = selectedRoute ? selectedRoute.fare : 0;

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
        <aside className="w-80 bg-white border-r border-gray-200 flex flex-col overflow-y-auto">
          <div className="p-4 border-b border-gray-100">
            <h2 className="text-gray-800 text-sm">Commuter</h2>
            <p className="text-gray-400 text-xs mt-0.5">Plan your trip with live transit info</p>
          </div>

          {/* ── Trip planner ── */}
          <div className="p-4 space-y-3 border-b border-gray-100">
            {/* Origin */}
            <div>
              <label className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                <MapPin size={11} className="text-green-500" /> From
              </label>
              <div className="relative">
                <input
                  value={originQuery}
                  onChange={(e) => setOriginQuery(e.target.value)}
                  placeholder="Your starting point"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                {originQuery && (
                  <button onClick={() => { setOriginQuery(""); setOrigin(null); }} className="absolute right-2 top-2.5 text-gray-300">
                    <X size={13} />
                  </button>
                )}
              </div>
              {originSuggestions.length > 0 && (
                <div className="border border-gray-200 rounded-lg mt-1 shadow-sm overflow-hidden">
                  {originSuggestions.map((p) => (
                    <button key={p.name} onClick={() => { setOrigin(p); setOriginQuery(p.name); }}
                      className="w-full text-left px-3 py-1.5 text-xs hover:bg-blue-50 text-gray-600 border-b border-gray-100 last:border-0">
                      {p.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Destination */}
            <div>
              <label className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                <MapPin size={11} className="text-red-500" /> To
              </label>
              <div className="relative">
                <input
                  value={destQuery}
                  onChange={(e) => setDestQuery(e.target.value)}
                  placeholder="Where are you going?"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                {destQuery && (
                  <button onClick={() => { setDestQuery(""); setDest(null); }} className="absolute right-2 top-2.5 text-gray-300">
                    <X size={13} />
                  </button>
                )}
              </div>
              {destSuggestions.length > 0 && (
                <div className="border border-gray-200 rounded-lg mt-1 shadow-sm overflow-hidden">
                  {destSuggestions.map((p) => (
                    <button key={p.name} onClick={() => { setDest(p); setDestQuery(p.name); }}
                      className="w-full text-left px-3 py-1.5 text-xs hover:bg-blue-50 text-gray-600 border-b border-gray-100 last:border-0">
                      {p.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Arrive by */}
            <div>
              <label className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                <Clock size={11} /> Arrive by
              </label>
              <input
                type="time"
                value={arrivalTime}
                onChange={(e) => setArrivalTime(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
          </div>

          {/* ── LRM route summary ── */}
          {origin && dest && (
            <div className="p-4 border-b border-gray-100">
              {isRouting && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
                  <p className="text-xs text-blue-700">Calculating road route…</p>
                </div>
              )}

              {routeSummary && !isRouting && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg overflow-hidden">
                  <div className="p-3">
                    <p className="text-xs text-blue-800 mb-2">Road route found</p>
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
                  <p className="text-xs text-orange-700">Could not find a road route.</p>
                  <p className="text-xs text-orange-500 mt-0.5">{routingError}</p>
                </div>
              )}

              {showAlert && (
                <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle size={13} className="text-red-500" />
                    <p className="text-xs text-red-700">Traffic on your route</p>
                  </div>
                  <p className="text-xs text-red-500 mb-2">Try an alternate route or ride.</p>
                  <button onClick={() => setShowAlert(false)} className="text-xs text-red-600 hover:underline">Dismiss</button>
                </div>
              )}
            </div>
          )}

          {/* ── Transit type filter ── */}
          <div className="p-4 border-b border-gray-100">
            <p className="text-xs text-gray-500 mb-2">Transit Type</p>
            <div className="flex gap-1 flex-wrap">
              {(["all", "jeepney", "bus", "taxi"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-2.5 py-1 rounded-full text-xs border transition-all capitalize ${
                    filter === f ? "bg-blue-600 text-white border-blue-600" : "border-gray-200 text-gray-500 hover:border-gray-400"
                  }`}
                >
                  {f === "all" ? "All" : f === "jeepney" ? "🚌 Jeep" : f === "bus" ? "🚍 Bus" : "🚕 Taxi"}
                </button>
              ))}
            </div>
          </div>

          {/* ── Routes list ── */}
          <div className="p-4 border-b border-gray-100">
            <label className="text-xs text-gray-500 mb-1.5 block">Available Routes</label>
            {filteredRoutes.length === 0 ? (
              <p className="text-xs text-gray-400 py-1">No routes found</p>
            ) : (
              <select
                value={selectedRouteId ?? ""}
                onChange={(e) => setSelectedRouteId(Number(e.target.value))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer"
              >
                {filteredRoutes.map((r) => {
                  const rv        = vehicles.filter((v) => v.routeId === r.id);
                  const available = rv.reduce((sum, v) => sum + (v.seatsTotal - v.seatsOccupied), 0);
                  const seatLabel = rv.length > 0 ? (available > 0 ? ` · ${available} seats` : " · Full") : "";
                  return (
                    <option key={r.id} value={r.id}>
                      {r.designation} — {r.name} · ₱{r.fare}{seatLabel}
                    </option>
                  );
                })}
              </select>
            )}
          </div>

          {/* ── Selected route detail ── */}
          {selectedRoute && (
            <div className="p-4">
              <p className="text-xs text-gray-500 mb-2">Selected Route Detail</p>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">{selectedRoute.designation} — {selectedRoute.name}</p>
                <p className="text-xs text-blue-600 mt-1">Est. fare: ₱{totalFare}</p>
                <div className="flex items-center gap-1 mt-1 text-xs text-blue-500">
                  <span>{selectedRoute.startPoint}</span>
                  <ChevronRight size={12} />
                  <span>{selectedRoute.endPoint}</span>
                </div>
                {routeVehicles.map((v) => (
                  <div key={v.id} className="mt-2 bg-white rounded p-2 border border-blue-100">
                    <p className="text-xs text-gray-600">{vehicleEmoji(v.type)} {v.plateNo}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 bg-gray-200 rounded h-1.5">
                        <div
                          className="h-1.5 rounded"
                          style={{
                            width: `${(v.seatsOccupied / v.seatsTotal) * 100}%`,
                            background: v.seatsOccupied / v.seatsTotal > 0.8 ? "#ef4444" : "#22c55e",
                          }}
                        />
                      </div>
                      <span className="text-xs text-gray-500">{v.seatsOccupied}/{v.seatsTotal}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Fare Calculator ── */}
          <FareCalculator
            distanceMeters={routeSummary?.totalDistance ?? null}
            durationSeconds={routeSummary?.totalTime ?? null}
          />

        </aside>

        {/* ── Map ── */}
        <main className="flex-1 relative">
          {loading ? (
            <div className="flex items-center justify-center h-full text-gray-400 text-sm">Loading map…</div>
          ) : (
            <MapContainer
              center={[10.3157, 123.8954]}
              zoom={13}
              className="w-full h-full"
              style={{ height: "100%" }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {/* Traffic overlays — static coloured bands */}
              {traffic.map((seg) => (
                <Polyline
                  key={`traffic-${seg.id}`}
                  positions={[[seg.latStart, seg.lngStart], [seg.latEnd, seg.lngEnd]]}
                  pathOptions={{ color: trafficColors[seg.level], weight: 8, opacity: 0.65 }}
                />
              ))}

              {/* Fixed transit routes — static polylines (no OSRM) */}
              {filteredRoutes.map((r) => (
                <Polyline
                  key={r.id}
                  positions={r.waypoints}
                  pathOptions={{
                    color: selectedRouteId === r.id
                      ? (vehicleColors[r.type] ?? "#2563eb")
                      : "#94a3b8",
                    weight: selectedRouteId === r.id ? 5 : 2,
                    opacity: selectedRouteId === r.id ? 0.9 : 0.6,
                  }}
                />
              ))}

              {/* Vehicle markers */}
              {filteredVehicles.map((v) => (
                <Marker key={v.id} position={[v.lat, v.lng]} icon={vehicleIcon(v.type)}>
                  <Popup>
                    <div className="text-sm">
                      <p className="font-semibold capitalize">{v.type} · {v.plateNo}</p>
                      <p className="text-gray-500">Seats: {v.seatsOccupied}/{v.seatsTotal}</p>
                      <div className="mt-1 bg-gray-200 rounded h-1.5 w-full">
                        <div
                          className="h-1.5 rounded"
                          style={{
                            width: `${(v.seatsOccupied / v.seatsTotal) * 100}%`,
                            background: v.seatsOccupied / v.seatsTotal > 0.8 ? "#ef4444" : "#22c55e",
                          }}
                        />
                      </div>
                    </div>
                  </Popup>
                </Marker>
              ))}

              {/* LRM road-following route for the trip planner */}
              {origin && dest && (
                <RoutingMachine
                  key={`${origin.lat},${origin.lng}-${dest.lat},${dest.lng}`}
                  origin={[origin.lat, origin.lng]}
                  dest={[dest.lat, dest.lng]}
                  color="#2563eb"
                  weight={5}
                  onRouteFound={handleRouteFound}
                  onRoutingError={handleRoutingError}
                />
              )}

              {/* Origin / Destination pins */}
              {origin && (
                <Marker position={[origin.lat, origin.lng]} icon={pinIcon("#22c55e", "Start")}>
                  <Popup>{origin.name}</Popup>
                </Marker>
              )}
              {dest && (
                <Marker position={[dest.lat, dest.lng]} icon={pinIcon("#ef4444", "End")}>
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