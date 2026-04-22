/**
 * RoutingMachine — wraps leaflet-routing-machine (liedman) for use inside
 * a react-leaflet <MapContainer>.  Uses OSRM (no API key needed).
 *
 * Two usage modes:
 *   A) Full waypoints array (for drawing a known transit route):
 *      <RoutingMachine waypoints={route.waypoints} color="#3b82f6" />
 *
 *   B) Origin + destination + optional via (for a user's custom trip):
 *      <RoutingMachine origin={[lat,lng]} dest={[lat,lng]} color="#3b82f6"
 *                      onRouteFound={...} onRoutingError={...} />
 */

import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet-routing-machine";
import "leaflet-routing-machine/dist/leaflet-routing-machine.css";

export interface RouteSummary {
  totalDistance: number; // metres
  totalTime: number;     // seconds
  instructions: { text: string; distance: number; time: number; type: string }[];
}

interface RoutingMachineProps {
  /**
   * Mode A — full ordered waypoints array ([lat, lng][]).
   * First point = origin, last point = destination, everything between = via.
   * Takes precedence over `origin` / `dest` / `via` when provided.
   */
  waypoints?: [number, number][];

  /** Mode B — explicit origin coordinate */
  origin?: [number, number];
  /** Mode B — explicit destination coordinate */
  dest?: [number, number];
  /** Mode B — optional intermediate waypoints */
  via?: [number, number][];

  /** Polyline colour — defaults to blue */
  color?: string;
  /** Line weight — defaults to 5 */
  weight?: number;
  /** Main line opacity 0–1 — defaults to 0.9 */
  opacity?: number;
  /** Show white halo beneath the line — defaults to true */
  showHalo?: boolean;
  /** Called once the route is successfully calculated */
  onRouteFound?: (summary: RouteSummary) => void;
  /** Called when routing fails */
  onRoutingError?: (error: string) => void;
}

export function RoutingMachine({
  waypoints: waypointsProp,
  origin,
  dest,
  via = [],
  color = "#3b82f6",
  weight = 5,
  opacity = 0.9,
  showHalo = true,
  onRouteFound,
  onRoutingError,
}: RoutingMachineProps) {
  const map = useMap();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const controlRef = useRef<any>(null);

  // Serialise coordinates into a stable string so the effect only re-runs
  // when actual coordinate values change (not on every array identity change).
  const coordsKey = waypointsProp
    ? JSON.stringify(waypointsProp)
    : JSON.stringify([origin, ...via, dest]);

  useEffect(() => {
    if (!map) return;

    // Resolve the final ordered coordinate list
    const coords: ([number, number] | undefined)[] = waypointsProp
      ? waypointsProp
      : [origin, ...via, dest];

    // Need at least 2 valid points
    if (coords.length < 2 || coords.some((c) => !c)) return;

    const latlngs = (coords as [number, number][]).map(([lat, lng]) =>
      L.latLng(lat, lng)
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const LR = (L as any).Routing;

    // ── Suppress the LRM "demo server" console.warn ──────────────────────────
    const _warn = console.warn;
    console.warn = (...args: unknown[]) => {
      const msg = args[0];
      if (
        typeof msg === "string" &&
        (msg.includes("OSRM's demo server") || msg.includes("osrm-backend/wiki"))
      )
        return;
      _warn.apply(console, args);
    };

    const control = LR.control({
      waypoints: latlngs,
      router: LR.osrmv1({
        serviceUrl: "https://router.project-osrm.org/route/v1",
        profile: "driving",
      }),
      lineOptions: {
        styles: [
          ...(showHalo
            ? [{ color: "#fff", weight: weight + 4, opacity: opacity * 0.55 }]
            : []),
          { color, weight, opacity },
        ],
        extendToWaypoints: true,
        missingRouteTolerance: 0,
      },
      // Hide the built-in turn-by-turn panel entirely
      show: false,
      collapsible: false,
      addWaypoints: false,
      routeWhileDragging: false,
      fitSelectedRoutes: false,
      showAlternatives: false,
      // Remove the default drag-handle markers so our own pins stay visible
      createMarker: () => null,
    });

    // Restore console.warn right after control construction
    console.warn = _warn;

    control.on(
      "routesfound",
      (e: {
        routes: {
          summary: { totalDistance: number; totalTime: number };
          instructions: {
            text: string;
            distance: number;
            time: number;
            type: string;
          }[];
        }[];
      }) => {
        const route = e.routes[0];
        if (onRouteFound) {
          onRouteFound({
            totalDistance: route.summary.totalDistance,
            totalTime: route.summary.totalTime,
            instructions: (route.instructions ?? []).map((ins) => ({
              text: ins.text,
              distance: ins.distance,
              time: ins.time,
              type: ins.type,
            })),
          });
        }
      }
    );

    control.on("routingerror", (e: { error: { message: string } }) => {
      if (onRoutingError) onRoutingError(e.error?.message ?? "Routing failed");
    });

    control.addTo(map);
    controlRef.current = control;

    // Hide ALL LRM container divs (there may be several when multiple routes render)
    const timer = setTimeout(() => {
      document
        .querySelectorAll<HTMLElement>(".leaflet-routing-container")
        .forEach((el) => {
          el.style.display = "none";
        });
    }, 50);

    return () => {
      clearTimeout(timer);
      if (controlRef.current) {
        // Abort any in-flight OSRM XHR FIRST so its callback never fires
        // against a map that's already been detached (prevents the
        // "Cannot read properties of null (reading 'removeLayer')" crash).
        try { controlRef.current.getRouter?.()?.abort?.(); } catch (_) { /* noop */ }
        try { map.removeControl(controlRef.current); } catch (_) { /* noop */ }
        controlRef.current = null;
      }
    };

    // Re-run only when coordinates or style change.
    // Callbacks (onRouteFound, onRoutingError) are intentionally omitted to
    // avoid re-querying OSRM every render — callers should useCallback them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, coordsKey, color, weight, opacity, showHalo]);

  return null;
}

// ─── Helper formatters (exported for use in sidebar) ─────────────────────────

/** 1 500 m → "1.5 km", 800 m → "800 m" */
export function formatDistance(metres: number): string {
  if (metres >= 1000) return `${(metres / 1000).toFixed(1)} km`;
  return `${Math.round(metres)} m`;
}

/** 3 720 s → "1 hr 2 min", 540 s → "9 min" */
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.ceil((seconds % 3600) / 60);
  if (h === 0) return `${m} min`;
  return `${h} hr ${m} min`;
}