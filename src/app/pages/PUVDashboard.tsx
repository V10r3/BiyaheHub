import { useEffect, useState } from "react";
import { NavBar } from "../components/NavBar";
import { MapView } from "../components/MapView";
import { routesApi, trafficApi, type Route, type TrafficSegment } from "../services/api";
import { AlertTriangle, CheckCircle, Clock, Users } from "lucide-react";

const trafficBadge = {
  clear: "bg-green-100 text-green-700 border-green-200",
  moderate: "bg-yellow-100 text-yellow-700 border-yellow-200",
  heavy: "bg-red-100 text-red-700 border-red-200",
};

export default function PUVDashboard() {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [traffic, setTraffic] = useState<TrafficSegment[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [passengers, setPassengers] = useState(0);
  const [seatsTotal] = useState(16);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      routesApi.getByType("jeepney"),
      trafficApi.getCurrent(),
    ]).then(([r, t]) => {
      setRoutes(r);
      setSelectedRoute(r[0] ?? null);
      setTraffic(t);
    }).finally(() => setLoading(false));
  }, []);

  const heavySegments = traffic.filter((t) => t.level === "heavy");
  const hasAlert = heavySegments.length > 0;

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <NavBar />

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-72 bg-white border-r border-gray-200 flex flex-col overflow-y-auto">
          <div className="p-4 border-b border-gray-100">
            <h2 className="text-gray-800 text-sm">PUV/PUJ Driver</h2>
            <p className="text-gray-400 text-xs mt-0.5">Your fixed route & traffic status</p>
          </div>

          {/* Route selector */}
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

            {hasAlert && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
                <AlertTriangle size={14} className="text-red-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-red-700">Heavy traffic detected</p>
                  {heavySegments.map((s) => (
                    <p key={s.id} className="text-xs text-red-500 mt-0.5">· {s.name}</p>
                  ))}
                </div>
              </div>
            )}

            {!hasAlert && (
              <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg p-3 mb-3">
                <CheckCircle size={14} className="text-green-600" />
                <p className="text-xs text-green-700">All clear on your route</p>
              </div>
            )}

            <div className="space-y-2">
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
        </aside>

        {/* Map */}
        <main className="flex-1 relative">
          {loading ? (
            <div className="flex items-center justify-center h-full text-gray-400 text-sm">Loading map…</div>
          ) : (
            <MapView
              routes={routes}
              traffic={traffic}
              selectedRouteId={selectedRoute?.id ?? null}
              center={[10.3, 123.895]}
            />
          )}
        </main>
      </div>
    </div>
  );
}
