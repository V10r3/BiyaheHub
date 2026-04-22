/**
 * routeMatch.ts
 *
 * Matches a user's origin/destination onto a fixed PUV route's waypoints array
 * and extracts the sub-path the passenger will actually ride.
 *
 * KEY DESIGN: destination is searched FORWARD from the origin snap-point so the
 * result always follows the route's natural direction of travel (index order).
 * This prevents the algorithm from snapping to the return leg of a circular
 * route like 01K when the user is travelling outbound.
 */

// ── Geometry helpers ──────────────────────────────────────────────────────────

/** Haversine distance in metres between two [lat, lng] points */
export function haversineMeters(
  a: [number, number],
  b: [number, number],
): number {
  const R = 6_371_000;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const sin2 =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(sin2), Math.sqrt(1 - sin2));
}

/** Compute total path length in metres for an ordered list of waypoints */
export function pathLengthMeters(path: [number, number][]): number {
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    total += haversineMeters(path[i - 1], path[i]);
  }
  return total;
}

// ── Snap helpers ──────────────────────────────────────────────────────────────

interface SnapResult {
  idx:  number;
  dist: number; // metres to the snapped waypoint
}

/** Find the closest waypoint to `point` in `waypoints[start..end)` */
function closestInRange(
  waypoints: [number, number][],
  point:     [number, number],
  start:     number,
  end:       number,
): SnapResult {
  let bestIdx  = start;
  let bestDist = Infinity;
  for (let i = start; i < end; i++) {
    const d = haversineMeters(waypoints[i], point);
    if (d < bestDist) { bestDist = d; bestIdx = i; }
  }
  return { idx: bestIdx, dist: bestDist };
}

/** Find the globally closest waypoint to `point` */
export function closestWaypointIndex(
  waypoints: [number, number][],
  point:     [number, number],
): number {
  return closestInRange(waypoints, point, 0, waypoints.length).idx;
}

// ── Result type ───────────────────────────────────────────────────────────────

export interface RouteMatchResult {
  /** Sub-path in natural route order (origin-snap → dest-snap) */
  path:              [number, number][];
  distanceMeters:    number;
  /** Estimated travel time at 20 km/h city average */
  durationSeconds:   number;
  /** Metres from the user's typed origin to the nearest route waypoint */
  originSnapMeters:  number;
  /** Metres from the user's typed dest to the nearest route waypoint */
  destSnapMeters:    number;
  /** True when origin is later in the array than dest (reverse-direction trip) */
  reversed:          boolean;
  /** Waypoints-array index of the origin snap */
  originIdx:         number;
  /** Waypoints-array index of the dest snap */
  destIdx:           number;
}

/** Average PUV city speed used for ETA — 20 km/h */
const AVG_SPEED_MPS = 20_000 / 3_600;

/**
 * How much closer (ratio) a backward snap must be before we prefer it over the
 * forward snap.  A value of 3 means "only use backward if it's 3× nearer."
 * This keeps circular-route trips (e.g. 01K) on the correct outbound leg.
 */
const FORWARD_BIAS = 3;

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Snap `origin` and `dest` onto `waypoints` and return the segment between
 * them that follows the route's natural direction of travel.
 *
 * Algorithm
 * ---------
 * 1. Snap origin globally (no direction preference).
 * 2. Snap dest by searching **forward** from originIdx first.
 *    Only fall back to a backward snap if it is FORWARD_BIAS× closer — this
 *    prevents the return leg of a circular route from stealing the snap.
 * 3. Extract slice(lo, hi+1) in natural waypoint order.
 * 4. The returned `path` always runs lo → hi regardless of travel direction;
 *    use `originIdx` / `destIdx` to know which end is board vs alight.
 */
export function matchRouteSegment(
  waypoints: [number, number][],
  origin:    [number, number],
  dest:      [number, number],
): RouteMatchResult {
  const N = waypoints.length;

  // ── Step 1: snap origin globally ──────────────────────────────────────────
  const originSnap       = closestInRange(waypoints, origin, 0, N);
  const originIdx        = originSnap.idx;
  const originSnapMeters = originSnap.dist;

  // ── Step 2: snap dest — forward-first ────────────────────────────────────
  // Search forward from originIdx (natural route direction)
  const fwd = closestInRange(waypoints, dest, originIdx, N);

  // Also check backward (before originIdx) as a fallback
  const bwd: SnapResult = originIdx > 0
    ? closestInRange(waypoints, dest, 0, originIdx)
    : { idx: originIdx, dist: Infinity };

  // Accept the backward snap only when it is FORWARD_BIAS× closer
  const destIdx        = bwd.dist * FORWARD_BIAS < fwd.dist ? bwd.idx : fwd.idx;
  const destSnapMeters = haversineMeters(waypoints[destIdx], dest);

  // ── Step 3: build segment in natural (index-ascending) order ─────────────
  const lo      = Math.min(originIdx, destIdx);
  const hi      = Math.max(originIdx, destIdx);
  const segment = waypoints.slice(lo, hi + 1) as [number, number][];

  // reversed = user is travelling against the route's stored direction
  const reversed = originIdx > destIdx;

  const distanceMeters = pathLengthMeters(segment);

  return {
    path:            segment,   // always lo → hi (natural route order)
    distanceMeters,
    durationSeconds: distanceMeters / AVG_SPEED_MPS,
    originSnapMeters,
    destSnapMeters,
    reversed,
    originIdx,
    destIdx,
  };
}
