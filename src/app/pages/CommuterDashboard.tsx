import { useEffect, useState } from "react";
import { NavBar } from "../components/NavBar";
import { routesApi, trafficApi, vehiclesApi, type Route, type TrafficSegment, type Vehicle } from "../services/api";
import { MapPin, Clock, Bus, Truck, Car, Train, AlertTriangle, ChevronRight, X } from "lucide-react";
import { MapContainer, TileLayer, Polyline, Marker, Popup } from "react-leaflet";
import L from "leaflet";

const trafficColors: Record<string, string> = {
  clear: "#22c55e",
  moderate: "#f59e0b",
  heavy: "#ef4444",
};

const PLACES = [
  { name: "SM City Cebu", lat: 10.3116, lng: 123.9185 },
  { name: "Ayala Center Cebu", lat: 10.3185, lng: 123.9054 },
  { name: "Parkmall Mandaue", lat: 10.3517, lng: 123.9358 },
  { name: "Cebu IT Park", lat: 10.3277, lng: 123.9055 },
  { name: "University of Cebu", lat: 10.2956, lng: 123.8984 },
  { name: "Carbon Market", lat: 10.2922, lng: 123.9012 },
  { name: "Colon Street", lat: 10.2937, lng: 123.9009 },
  { name: "Talamban Cebu", lat: 10.3671, lng: 123.9103 },
  { name: "Urgello", lat: 10.295, lng: 123.89 },
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
  const [routes, setRoutes] = useState<Route[]>([]);
  const [traffic, setTraffic] = useState<TrafficSegment[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);

  const [destQuery, setDestQuery] = useState("");
  const [dest, setDest] = useState<{ name: string; lat: number; lng: number } | null>(null);
  const [originQuery, setOriginQuery] = useState("");
  const [origin, setOrigin] = useState<{ name: string; lat: number; lng: number } | null>(null);

  const [selectedRouteId, setSelectedRouteId] = useState<number | null>(null);
  const [filter, setFilter] = useState<"all" | "jeepney" | "bus" | "taxi">("all");
  const [arrivalTime, setArrivalTime] = useState("");
  const [showAlert, setShowAlert] = useState(false);

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
    }
  }, [origin, dest, traffic]);

  const filteredRoutes = filter === "all" ? routes : routes.filter((r) => r.type === filter);
  const filteredVehicles = filter === "all" ? vehicles : vehicles.filter((v) => v.type === filter);

  const originSuggestions = PLACES.filter(
    (p) => originQuery.length > 1 && p.name.toLowerCase().includes(originQuery.toLowerCase())
  );
  const destSuggestions = PLACES.filter(
    (p) => destQuery.length > 1 && p.name.toLowerCase().includes(destQuery.toLowerCase())
  );

  const selectedRoute = routes.find((r) => r.id === selectedRouteId);
  const routeVehicles = selectedRoute ? vehicles.filter((v) => v.routeId === selectedRoute.id) : [];

  const totalFare = selectedRoute ? selectedRoute.fare : 0;

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <NavBar />

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-80 bg-white border-r border-gray-200 flex flex-col overflow-y-auto">
          <div className="p-4 border-b border-gray-100">
            <h2 className="text-gray-800 text-sm">Commuter</h2>
            <p className="text-gray-400 text-xs mt-0.5">Plan your trip with live transit info</p>
          </div>

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
                {originQuery && <button onClick={() => { setOriginQuery(""); setOrigin(null); }} className="absolute right-2 top-2.5 text-gray-300"><X size={13} /></button>}
              </div>
              {originSuggestions.length > 0 && (
                <div className="border border-gray-200 rounded-lg mt-1 shadow-sm overflow-hidden">
                  {originSuggestions.map((p) => (
                    <button key={p.name} onClick={() => { setOrigin(p); setOriginQuery(p.name); }} className="w-full text-left px-3 py-1.5 text-xs hover:bg-blue-50 text-gray-600 border-b border-gray-100 last:border-0">{p.name}</button>
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
                {destQuery && <button onClick={() => { setDestQuery(""); setDest(null); }} className="absolute right-2 top-2.5 text-gray-300"><X size={13} /></button>}
              </div>
              {destSuggestions.length > 0 && (
                <div className="border border-gray-200 rounded-lg mt-1 shadow-sm overflow-hidden">
                  {destSuggestions.map((p) => (
                    <button key={p.name} onClick={() => { setDest(p); setDestQuery(p.name); }} className="w-full text-left px-3 py-1.5 text-xs hover:bg-blue-50 text-gray-600 border-b border-gray-100 last:border-0">{p.name}</button>
                  ))}
                </div>
              )}
            </div>

            {/* Arrival time */}
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

          {/* Transit filter */}
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

          {/* Routes list */}
          <div className="p-4 border-b border-gray-100">
            <p className="text-xs text-gray-500 mb-2">Available Routes</p>
            <div className="space-y-2">
              {filteredRoutes.map((r) => {
                const rv = vehicles.filter((v) => v.routeId === r.id);
                const totalSeats = rv.reduce((sum, v) => sum + v.seatsTotal, 0);
                const occupied = rv.reduce((sum, v) => sum + v.seatsOccupied, 0);
                const available = totalSeats - occupied;
                return (
                  <button
                    key={r.id}
                    onClick={() => setSelectedRouteId(r.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg border text-sm transition-all ${
                      selectedRouteId === r.id ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-blue-700 text-xs">{r.designation}</span>
                      <span className="text-gray-400 text-xs">₱{r.fare}</span>
                    </div>
                    <p className="text-gray-700 text-xs mt-0.5">{r.name}</p>
                    {rv.length > 0 && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        {available > 0 ? `${available} seats available` : "Full"}
                      </p>
                    )}
                  </button>
                );
              })}
              {filteredRoutes.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-2">No routes found</p>
              )}
            </div>
          </div>

          {/* Selected route detail */}
          {selectedRoute && (
            <div className="p-4 border-b border-gray-100">
              <p className="text-xs text-gray-500 mb-2">Selected Route Detail</p>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">{selectedRoute.designation} — {selectedRoute.name}</p>
                <p className="text-xs text-blue-600 mt-1">Est. fare: ₱{totalFare}</p>
                <div className="flex items-center gap-1 mt-1 text-xs text-blue-500">
                  <span>{selectedRoute.startPoint}</span>
                  <ChevronRight size={12} />
                  <span>{selectedRoute.endPoint}</span>
                </div>
                {routeVehicles.length > 0 && routeVehicles.map((v) => (
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

          {/* Traffic alert */}
          {showAlert && (
            <div className="p-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle size={13} className="text-red-500" />
                  <p className="text-xs text-red-700">Traffic on your route</p>
                </div>
                <p className="text-xs text-red-500 mb-2">Try an alternate route or ride.</p>
                <button onClick={() => setShowAlert(false)} className="text-xs text-red-600 hover:underline">Dismiss</button>
              </div>
            </div>
          )}
        </aside>

        {/* Map */}
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

              {/* Traffic */}
              {traffic.map((seg) => (
                <Polyline
                  key={seg.id}
                  positions={[[seg.latStart, seg.lngStart], [seg.latEnd, seg.lngEnd]]}
                  color={trafficColors[seg.level]}
                  weight={6}
                  opacity={0.7}
                >
                  <Popup>
                    <div className="text-sm">
                      <p className="font-semibold">{seg.name}</p>
                      <p className="capitalize" style={{ color: trafficColors[seg.level] }}>{seg.level} traffic</p>
                    </div>
                  </Popup>
                </Polyline>
              ))}

              {/* Routes */}
              {filteredRoutes.map((r) => (
                <Polyline
                  key={r.id}
                  positions={r.waypoints}
                  color={selectedRouteId === r.id ? "#2563eb" : "#94a3b8"}
                  weight={selectedRouteId === r.id ? 4 : 2}
                  dashArray={selectedRouteId === r.id ? undefined : "5 5"}
                  opacity={selectedRouteId && selectedRouteId !== r.id ? 0.4 : 0.85}
                >
                  <Popup>
                    <div className="text-sm">
                      <p className="font-semibold">{r.designation} — {r.name}</p>
                      <p className="text-gray-500">Fare: ₱{r.fare}</p>
                    </div>
                  </Popup>
                </Polyline>
              ))}

              {/* Vehicles */}
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

              {/* Origin/Dest pins */}
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
              {origin && dest && (
                <Polyline
                  positions={[[origin.lat, origin.lng], [dest.lat, dest.lng]]}
                  color="#3b82f6"
                  weight={3}
                  dashArray="8 4"
                />
              )}
            </MapContainer>
          )}
        </main>
      </div>
    </div>
  );
}
