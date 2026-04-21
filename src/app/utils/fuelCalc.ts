// ─── Unit helpers ─────────────────────────────────────────────────────────────

export type UnitSystem = "metric" | "imperial";

export const kmToMiles    = (km: number)  => km * 0.621371;
export const litersToGal  = (l: number)   => l * 0.264172;
export const l100kmToMpg  = (l: number)   => 235.215 / l;
export const mpgToL100km  = (mpg: number) => 235.215 / mpg;

/** Total route length from a waypoints array using Haversine formula */
export function routeLengthKm(waypoints: [number, number][]): number {
  let total = 0;
  for (let i = 1; i < waypoints.length; i++) {
    const [lat1, lon1] = waypoints[i - 1];
    const [lat2, lon2] = waypoints[i];
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;
    total += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  return total;
}

/** Liters consumed given distance (km) and fuel economy (L/100km) */
export function fuelConsumedL(distanceKm: number, l100km: number): number {
  return (distanceKm / 100) * l100km;
}

// ─── Formatters ───────────────────────────────────────────────────────────────

export function fmtDistance(km: number, u: UnitSystem): string {
  const v = Number(km) || 0;
  return u === "imperial" ? `${kmToMiles(v).toFixed(1)} mi` : `${v.toFixed(1)} km`;
}

export function fmtVolume(liters: number, u: UnitSystem): string {
  const v = Number(liters) || 0;
  return u === "imperial" ? `${litersToGal(v).toFixed(2)} gal` : `${v.toFixed(2)} L`;
}

export function fmtEfficiency(l100km: number, u: UnitSystem): string {
  const v = Number(l100km) || 0;
  return u === "imperial"
    ? `${l100kmToMpg(v).toFixed(1)} MPG`
    : `${v.toFixed(1)} L/100km`;
}

export function efficiencyInputLabel(u: UnitSystem): string {
  return u === "imperial" ? "MPG (fuel economy)" : "L/100km (consumption)";
}

export function efficiencyInputHint(u: UnitSystem): string {
  return u === "imperial" ? "Higher = better" : "Lower = better";
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

/** Default L/100km by fuel type — Philippine-market averages */
export const DEFAULT_CONSUMPTION: Record<string, number> = {
  gasoline: 10.0,
  diesel:    8.0,
  premium:  10.0,
  lpg:      11.5,
  electric:  0.0,
};