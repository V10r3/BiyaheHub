import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { NavBar } from "../components/NavBar";
import {
  routesApi, trafficApi, vehiclesApi,
  type Route, type TrafficSegment, type Vehicle,
} from "../services/api";
import {
  MapPin, Clock, AlertTriangle, ChevronRight,
  X, Ruler, ChevronDown, ChevronUp, Route as RouteIcon, Navigation,
} from "lucide-react";
import { MapContainer, TileLayer, Polyline, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { RoutingMachine, formatDistance, formatDuration, type RouteSummary } from "../components/RoutingMachine";
import { FareCalculator } from "../components/FareCalculator";
import { FareValidator }  from "../components/FareValidator";
import { matchRouteSegment, type RouteMatchResult } from "../utils/routeMatch";
import { MobileBottomSheet } from "../components/MobileBottomSheet";
import { useMobile } from "../hooks/useMobile";

const vehicleColors: Record<string, string> = {
  jeepney: "#3b82f6",
  bus:     "#8b5cf6",
  taxi:    "#f59e0b",
};

// ── Nominatim ─────────────────────────────────────────────────────────────────
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
        const res  = await fetch(url.toString(), { signal: abortRef.current.signal });
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

// ── Map helpers ───────────────────────────────────────────────────────────────
function vehicleEmoji(type: string) {
  return type === "jeepney" ? "🚌" : type === "bus" ? "🚍" : type === "taxi" ? "🚕" : "🚆";
}
function vehicleIcon(type: string) {
  return L.divIcon({
    html: `<div style="font-size:20px">${vehicleEmoji(type)}</div>`,
    className: "", iconSize: [24, 24], iconAnchor: [12, 12],
  });
}
function pinIcon(color: string, label: string) {
  return L.divIcon({
    html: `<div style="background:${color};color:white;padding:2px 7px;border-radius:5px;font-size:11px;font-weight:700;box-shadow:0 2px 5px rgba(0,0,0,.25);white-space:nowrap">${label}</div>`,
    className: "", iconAnchor: [0, 10],
  });
}

// Snap marker (small dot) for where the route is closest to origin/dest
function snapDotIcon(color: string) {
  return L.divIcon({
    html: `<div style="width:10px;height:10px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`,
    className: "", iconSize: [10, 10], iconAnchor: [5, 5],
  });
}

function fmtMeters(m: number) {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function CommuterDashboard() {
  const [routes,   setRoutes]   = useState<Route[]>([]);
  const [traffic,  setTraffic]  = useState<TrafficSegment[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading,  setLoading]  = useState(true);

  const isMobile = useMobile();
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);

  const [destQuery,   setDestQuery]   = useState("");
  const [dest,        setDest]        = useState<{ name: string; lat: number; lng: number } | null>(null);
  const [originQuery, setOriginQuery] = useState("");
  const [origin,      setOrigin]      = useState<{ name: string; lat: number; lng: number } | null>(null);

  const [selectedRouteId, setSelectedRouteId] = useState<number | null>(null);
  const [filter,          setFilter]          = useState<"all" | "jeepney" | "bus" | "taxi">("all");
  const [arrivalTime,     setArrivalTime]     = useState("");
  const [showAlert,       setShowAlert]       = useState(false);

  // OSRM state (only used when no transit route is selected)
  const [routeSummary,    setRouteSummary]    = useState<RouteSummary | null>(null);
  const [routingError,    setRoutingError]    = useState<string | null>(null);
  const [showDirections,  setShowDirections]  = useState(false);
  const [isOsrmRouting,   setIsOsrmRouting]   = useState(false);

  useEffect(() => {
    Promise.all([routesApi.getAll(), trafficApi.getCurrent(), vehiclesApi.getAll()])
      .then(([r, t, v]) => {
        setRoutes(r); setTraffic(t); setVehicles(v);
        if (r.length) setSelectedRouteId(r[0].id);
      })
      .finally(() => setLoading(false));
  }, []);

  // When origin/dest/route change — reset routing state
  useEffect(() => {
    if (!origin || !dest) return;
    const heavy = traffic.some((t) => t.level === "heavy");
    setShowAlert(heavy);
    setRouteSummary(null);
    setRoutingError(null);

    if (!selectedRouteId) {
      // No transit route — fall back to OSRM road routing
      setIsOsrmRouting(true);
    } else {
      // Transit routing is instant (computed by useMemo below)
      setIsOsrmRouting(false);
    }
  }, [origin, dest, traffic, selectedRouteId]);

  // ── Transit route matching ────────────────────────────────────────────────
  const selectedRoute  = routes.find((r) => r.id === selectedRouteId);
  const routeVehicles  = selectedRoute ? vehicles.filter((v) => v.routeId === selectedRoute.id) : [];
  const totalFare      = selectedRoute ? selectedRoute.fare : 0;

  const transitMatch = useMemo<RouteMatchResult | null>(() => {
    if (!selectedRoute || !origin || !dest) return null;
    return matchRouteSegment(
      selectedRoute.waypoints as [number, number][],
      [origin.lat, origin.lng],
      [dest.lat, dest.lng],
    );
  }, [selectedRoute, origin, dest]);

  // Snap waypoint positions for dot markers
  const originSnapPos = useMemo(() => {
    if (!transitMatch || !selectedRoute) return null;
    return selectedRoute.waypoints[transitMatch.originIdx] as [number, number];
  }, [transitMatch, selectedRoute]);

  const destSnapPos = useMemo(() => {
    if (!transitMatch || !selectedRoute) return null;
    return selectedRoute.waypoints[transitMatch.destIdx] as [number, number];
  }, [transitMatch, selectedRoute]);

  // Values passed to FareCalculator / FareValidator
  const fareDistance = transitMatch?.distanceMeters    ?? routeSummary?.totalDistance ?? null;
  const fareDuration = transitMatch?.durationSeconds   ?? routeSummary?.totalTime     ?? null;

  const filteredRoutes   = filter === "all" ? routes   : routes.filter((r) => r.type === filter);
  const filteredVehicles = filter === "all" ? vehicles : vehicles.filter((v) => v.type === filter);

  const { results: originSuggestions, loading: originLoading, clear: clearOrigin } =
    useNominatim(originQuery, origin === null);
  const { results: destSuggestions,   loading: destLoading,   clear: clearDest   } =
    useNominatim(destQuery,   dest   === null);

  const handleRouteFound = useCallback((summary: RouteSummary) => {
    setRouteSummary(summary); setRoutingError(null); setIsOsrmRouting(false);
  }, []);
  const handleRoutingError = useCallback((msg: string) => {
    setRoutingError(msg); setIsOsrmRouting(false);
  }, []);

  // ── Snap-distance warning threshold ──────────────────────────────────────
  const FAR_THRESHOLD = 600; // metres
  const originFar = transitMatch ? transitMatch.originSnapMeters > FAR_THRESHOLD : false;
  const destFar   = transitMatch ? transitMatch.destSnapMeters   > FAR_THRESHOLD : false;

  return (
    <div className="flex flex-col h-screen bg-gray-50" style={{ height: "100dvh" }}>
      <NavBar />

      <div className="flex flex-1 overflow-hidden">
        {/* ── Sidebar — desktop only ── */}
        <aside className={`${isMobile ? "hidden" : "flex"} w-80 bg-white border-r border-gray-200 flex-col overflow-y-auto`}>
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
                  onChange={(e) => { setOriginQuery(e.target.value); setOrigin(null); }}
                  placeholder="Your starting point"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 pr-7"
                />
                {originLoading && (
                  <div className="absolute right-2 top-2.5 w-3.5 h-3.5 rounded-full border-2 border-blue-400 border-t-transparent animate-spin" />
                )}
                {!originLoading && originQuery && (
                  <button onClick={() => { setOriginQuery(""); setOrigin(null); clearOrigin(); }} className="absolute right-2 top-2.5 text-gray-300">
                    <X size={13} />
                  </button>
                )}
              </div>
              {originSuggestions.length > 0 && (
                <div className="border border-gray-200 rounded-lg mt-1 shadow-sm overflow-hidden max-h-48 overflow-y-auto">
                  {originSuggestions.map((p) => (
                    <button
                      key={p.place_id}
                      onClick={() => {
                        setOrigin({ name: p.display_name, lat: parseFloat(p.lat), lng: parseFloat(p.lon) });
                        setOriginQuery(p.display_name);
                        clearOrigin();
                      }}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 text-gray-600 border-b border-gray-100 last:border-0 leading-relaxed"
                    >
                      {p.display_name}
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
                  onChange={(e) => { setDestQuery(e.target.value); setDest(null); }}
                  placeholder="Where are you going?"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 pr-7"
                />
                {destLoading && (
                  <div className="absolute right-2 top-2.5 w-3.5 h-3.5 rounded-full border-2 border-blue-400 border-t-transparent animate-spin" />
                )}
                {!destLoading && destQuery && (
                  <button onClick={() => { setDestQuery(""); setDest(null); clearDest(); }} className="absolute right-2 top-2.5 text-gray-300">
                    <X size={13} />
                  </button>
                )}
              </div>
              {destSuggestions.length > 0 && (
                <div className="border border-gray-200 rounded-lg mt-1 shadow-sm overflow-hidden max-h-48 overflow-y-auto">
                  {destSuggestions.map((p) => (
                    <button
                      key={p.place_id}
                      onClick={() => {
                        setDest({ name: p.display_name, lat: parseFloat(p.lat), lng: parseFloat(p.lon) });
                        setDestQuery(p.display_name);
                        clearDest();
                      }}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 text-gray-600 border-b border-gray-100 last:border-0 leading-relaxed"
                    >
                      {p.display_name}
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

          {/* ── Route result summary ── */}
          {origin && dest && (
            <div className="p-4 border-b border-gray-100 space-y-2">

              {/* ── Transit match result ── */}
              {transitMatch && selectedRoute && (
                <div className="rounded-lg border border-red-200 overflow-hidden">
                  {/* Header */}
                  <div className="bg-red-50 px-3 py-2.5 flex items-start gap-2">
                    <RouteIcon size={14} className="text-red-500 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-red-800 truncate">
                        {selectedRoute.designation} — {selectedRoute.name}
                      </p>
                      <p className="text-[10px] text-red-400 mt-0.5">
                        Following actual {selectedRoute.type} route
                      </p>
                    </div>
                  </div>
                  {/* Stats row */}
                  <div className="grid grid-cols-2 divide-x divide-gray-100 border-t border-gray-100">
                    <div className="px-3 py-2 flex items-center gap-1.5">
                      <Ruler size={12} className="text-gray-400" />
                      <span className="text-xs text-gray-700">{fmtMeters(transitMatch.distanceMeters)}</span>
                    </div>
                    <div className="px-3 py-2 flex items-center gap-1.5">
                      <Clock size={12} className="text-gray-400" />
                      <span className="text-xs text-gray-700">{formatDuration(transitMatch.durationSeconds)}</span>
                    </div>
                  </div>
                  {/* Snap quality warnings */}
                  {(originFar || destFar) && (
                    <div className="bg-amber-50 border-t border-amber-100 px-3 py-2 space-y-1">
                      {originFar && (
                        <p className="text-[10px] text-amber-700 flex items-center gap-1">
                          <Navigation size={10} />
                          Your start is ~{fmtMeters(transitMatch.originSnapMeters)} from this route
                        </p>
                      )}
                      {destFar && (
                        <p className="text-[10px] text-amber-700 flex items-center gap-1">
                          <Navigation size={10} />
                          Your destination is ~{fmtMeters(transitMatch.destSnapMeters)} from this route
                        </p>
                      )}
                    </div>
                  )}
                  {/* Reverse direction notice */}
                  {transitMatch.reversed && (
                    <div className="bg-blue-50 border-t border-blue-100 px-3 py-2">
                      <p className="text-[10px] text-blue-600">
                        ↩ Travelling in the reverse direction of this route
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* ── OSRM fallback (no route selected) ── */}
              {!transitMatch && (
                <>
                  {isOsrmRouting && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
                      <p className="text-xs text-blue-700">Calculating road route…</p>
                    </div>
                  )}
                  {routeSummary && !isOsrmRouting && (
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
                </>
              )}

              {/* Traffic alert */}
              {showAlert && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
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
                onChange={(e) =>
                  setSelectedRouteId(e.target.value === "" ? null : Number(e.target.value))
                }
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer"
              >
                <option value="">— No route selected —</option>
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
          <FareCalculator distanceMeters={fareDistance} durationSeconds={fareDuration} />

          {/* ── Fare Validator ── */}
          <FareValidator distanceMeters={fareDistance} durationSeconds={fareDuration} />

        </aside>

        {/* ── Map ── */}
        <main className={`flex-1 relative ${isMobile ? "pb-16" : ""}`}>
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

              {/* ── Full transit route polylines — split when trip is active ── */}
              {filteredRoutes.flatMap((r) => {
                const isSelected = r.id === selectedRouteId;

                // When this is the selected route AND we have a transit match,
                // split it into: [before snap] blue  |  [matched]  red  |  [after snap] blue
                if (isSelected && transitMatch) {
                  const lo = Math.min(transitMatch.originIdx, transitMatch.destIdx);
                  const hi = Math.max(transitMatch.originIdx, transitMatch.destIdx);
                  const wp = r.waypoints as [number, number][];
                  const routeColor = vehicleColors[r.type] ?? "#2563eb";

                  // before-segment: route up to the first snap point (natural order)
                  const beforePath = wp.slice(0, lo + 1);
                  // after-segment:  route from the last snap point onward (natural order)
                  const afterPath  = wp.slice(hi);

                  const segmentStyle = { color: routeColor, weight: 5, opacity: 0.85 };
                  const result = [];
                  if (beforePath.length > 1)
                    result.push(<Polyline key={`${r.id}-before`} positions={beforePath} pathOptions={segmentStyle} />);
                  if (afterPath.length > 1)
                    result.push(<Polyline key={`${r.id}-after`}  positions={afterPath}  pathOptions={segmentStyle} />);
                  return result;
                }

                // Default: render the whole route
                return [
                  <Polyline
                    key={r.id}
                    positions={r.waypoints}
                    pathOptions={{
                      color:   isSelected ? (vehicleColors[r.type] ?? "#2563eb") : "#94a3b8",
                      weight:  isSelected ? 4 : 2,
                      opacity: isSelected ? 0.7 : 0.5,
                    }}
                  />,
                ];
              })}

              {/* ── Transit-matched segment (origin → dest along the route) ── */}
              {transitMatch && (
                <Polyline
                  positions={transitMatch.path}
                  pathOptions={{
                    color:   "#ef4444",
                    weight:  7,
                    opacity: 0.95,
                    lineCap: "round",
                    lineJoin: "round",
                  }}
                />
              )}

              {/* Snap-point dots on the route where origin/dest board/alight */}
              {originSnapPos && (
                <Marker position={originSnapPos} icon={snapDotIcon("#22c55e")}>
                  <Popup>
                    <p className="text-xs">Board here</p>
                    {transitMatch && transitMatch.originSnapMeters > 0 && (
                      <p className="text-xs text-gray-500">
                        ~{fmtMeters(transitMatch.originSnapMeters)} from your origin
                      </p>
                    )}
                  </Popup>
                </Marker>
              )}
              {destSnapPos && (
                <Marker position={destSnapPos} icon={snapDotIcon("#ef4444")}>
                  <Popup>
                    <p className="text-xs">Alight here</p>
                    {transitMatch && transitMatch.destSnapMeters > 0 && (
                      <p className="text-xs text-gray-500">
                        ~{fmtMeters(transitMatch.destSnapMeters)} from your destination
                      </p>
                    )}
                  </Popup>
                </Marker>
              )}

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

              {/* OSRM road routing — only when no transit route is selected */}
              {origin && dest && !selectedRouteId && (
                <RoutingMachine
                  key={`${origin.lat},${origin.lng}-${dest.lat},${dest.lng}`}
                  origin={[origin.lat, origin.lng]}
                  dest={[dest.lat, dest.lng]}
                  color="#ef4444"
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

      {/* ── Mobile bottom bar ──────────────────────────────────────────────── */}
      {isMobile && (
        <nav
          className="fixed inset-x-0 bottom-0 bg-white border-t border-gray-200 flex items-stretch"
          style={{ zIndex: 1001, paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        >
          {/* Trip status chip */}
          <div className="flex-1 flex items-center px-3 py-2 gap-2 min-w-0">
            {origin && dest ? (
              <div className="flex items-center gap-1.5 min-w-0">
                <MapPin size={13} className="text-green-500 shrink-0" />
                <span className="text-xs text-gray-600 truncate">{origin.name.split(",")[0]}</span>
                <ChevronRight size={12} className="text-gray-400 shrink-0" />
                <span className="text-xs text-gray-600 truncate">{dest.name.split(",")[0]}</span>
              </div>
            ) : (
              <span className="text-xs text-gray-400">No trip planned</span>
            )}
          </div>

          {/* Open panel button */}
          <button
            onClick={() => setMobilePanelOpen((v) => !v)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm border-l border-gray-200 transition-colors ${
              mobilePanelOpen ? "text-blue-600 bg-blue-50" : "text-blue-600 hover:bg-blue-50"
            }`}
          >
            <MapPin size={15} />
            Plan Trip
          </button>
        </nav>
      )}

      {/* ── Mobile bottom sheet ───────────────────────────────────────────── */}
      {isMobile && (
        <MobileBottomSheet
          open={mobilePanelOpen}
          onClose={() => setMobilePanelOpen(false)}
          title="Trip Planner"
          height="85dvh"
        >
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
                  onChange={(e) => { setOriginQuery(e.target.value); setOrigin(null); }}
                  placeholder="Your starting point"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 pr-7"
                />
                {originLoading && (
                  <div className="absolute right-2 top-2.5 w-3.5 h-3.5 rounded-full border-2 border-blue-400 border-t-transparent animate-spin" />
                )}
                {!originLoading && originQuery && (
                  <button onClick={() => { setOriginQuery(""); setOrigin(null); clearOrigin(); }} className="absolute right-2 top-2.5 text-gray-300">
                    <X size={13} />
                  </button>
                )}
              </div>
              {originSuggestions.length > 0 && (
                <div className="border border-gray-200 rounded-lg mt-1 shadow-sm overflow-hidden max-h-48 overflow-y-auto">
                  {originSuggestions.map((p) => (
                    <button
                      key={p.place_id}
                      onClick={() => {
                        setOrigin({ name: p.display_name, lat: parseFloat(p.lat), lng: parseFloat(p.lon) });
                        setOriginQuery(p.display_name);
                        clearOrigin();
                      }}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 text-gray-600 border-b border-gray-100 last:border-0 leading-relaxed"
                    >
                      {p.display_name}
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
                  onChange={(e) => { setDestQuery(e.target.value); setDest(null); }}
                  placeholder="Where are you going?"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 pr-7"
                />
                {destLoading && (
                  <div className="absolute right-2 top-2.5 w-3.5 h-3.5 rounded-full border-2 border-blue-400 border-t-transparent animate-spin" />
                )}
                {!destLoading && destQuery && (
                  <button onClick={() => { setDestQuery(""); setDest(null); clearDest(); }} className="absolute right-2 top-2.5 text-gray-300">
                    <X size={13} />
                  </button>
                )}
              </div>
              {destSuggestions.length > 0 && (
                <div className="border border-gray-200 rounded-lg mt-1 shadow-sm overflow-hidden max-h-48 overflow-y-auto">
                  {destSuggestions.map((p) => (
                    <button
                      key={p.place_id}
                      onClick={() => {
                        setDest({ name: p.display_name, lat: parseFloat(p.lat), lng: parseFloat(p.lon) });
                        setDestQuery(p.display_name);
                        clearDest();
                      }}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 text-gray-600 border-b border-gray-100 last:border-0 leading-relaxed"
                    >
                      {p.display_name}
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

          {/* ── Route result summary ── */}
          {origin && dest && (
            <div className="p-4 border-b border-gray-100 space-y-2">
              {transitMatch && selectedRoute && (
                <div className="rounded-lg border border-red-200 overflow-hidden">
                  <div className="bg-red-50 px-3 py-2.5 flex items-start gap-2">
                    <RouteIcon size={14} className="text-red-500 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-red-800 truncate">
                        {selectedRoute.designation} — {selectedRoute.name}
                      </p>
                      <p className="text-[10px] text-red-400 mt-0.5">
                        Following actual {selectedRoute.type} route
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 divide-x divide-gray-100 border-t border-gray-100">
                    <div className="px-3 py-2 flex items-center gap-1.5">
                      <Ruler size={12} className="text-gray-400" />
                      <span className="text-xs text-gray-700">{fmtMeters(transitMatch.distanceMeters)}</span>
                    </div>
                    <div className="px-3 py-2 flex items-center gap-1.5">
                      <Clock size={12} className="text-gray-400" />
                      <span className="text-xs text-gray-700">{formatDuration(transitMatch.durationSeconds)}</span>
                    </div>
                  </div>
                </div>
              )}
              {!transitMatch && routeSummary && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
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
              )}
              {showAlert && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center justify-between">
                  <p className="text-xs text-red-700">Heavy traffic on your route</p>
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
            <select
              value={selectedRouteId ?? ""}
              onChange={(e) => setSelectedRouteId(e.target.value === "" ? null : Number(e.target.value))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer"
            >
              <option value="">— No route selected —</option>
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
          </div>

          {/* ── Fare Calculator ── */}
          <FareCalculator distanceMeters={fareDistance} durationSeconds={fareDuration} />

          {/* ── Fare Validator ── */}
          <FareValidator distanceMeters={fareDistance} durationSeconds={fareDuration} />
        </MobileBottomSheet>
      )}
    </div>
  );
}