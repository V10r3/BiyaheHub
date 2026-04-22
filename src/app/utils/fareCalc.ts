/**
 * BiyaheHub — LTFRB Fare Calculator
 *
 * Sources / References:
 *  • Non-Aircon Modern/Electric PUJ  — LTFRB MC 2022-040 / standard PUJ rate
 *    Minimum fare: ₱13.00 (first 4 km), +₱1.80/km thereafter
 *  • Aircon Modern/Electric PUJ      — LTFRB MC 2023-054 (effective Oct 8 2023)
 *    Minimum fare: ₱15.00 (first 4 km), +₱2.20/km thereafter
 *  • Taxi                            — LTFRB (current)
 *    Flag-down: ₱50.00, +₱13.50/km, +₱2.00/min
 *  • 20% discount mandated for students, elderly, and PWD — RA 9994 / BP 344
 *
 * Discount is applied to the total fare (not pre-baked into per-km rates).
 * All fares rounded to the nearest ₱0.25 per LTFRB rules.
 */

export type PassengerType = "regular" | "discounted"; // discounted = student / elderly / PWD
export type VehicleClass  = "nonAirconJeep" | "airconJeep" | "taxi";

/** Round a peso amount to the nearest ₱0.25 centavo */
export function roundNearest25(value: number): number {
  return Math.round(value * 4) / 4;
}

// ── Non-Aircon Modern/Electric PUJ ──────────────────────────────────────────
// LTFRB MC 2022-040 — standard Cebu modern PUJ rate
// Minimum: ₱13.00 covers the first 4 km; +₱1.80/km beyond 4 km
const NON_AIRCON = {
  base:          13.00, // minimum fare, covers first 4 km
  perKm:          1.80, // per-km after the first 4 km
  baseKm:            4, // km covered by the base fare
  label:         "Non-Aircon Modern PUJ",
  effectiveDate: "LTFRB MC 2022-040",
} as const;

// ── Aircon Modern/Electric PUJ ───────────────────────────────────────────────
// LTFRB MC 2023-054 — effective October 8, 2023
// Minimum: ₱15.00 covers the first 4 km; +₱2.20/km beyond 4 km
const AIRCON = {
  base:          15.00, // minimum fare, covers first 4 km
  perKm:          2.20, // per-km after the first 4 km
  baseKm:            4, // km covered by the base fare
  label:         "Aircon Modern PUJ",
  effectiveDate: "LTFRB MC 2023-054 (Oct 8, 2023)",
} as const;

// ── Taxi ─────────────────────────────────────────────────────────────────────
const TAXI = {
  flagDown:  50.00,
  perKm:     13.50,
  perMinute:  2.00,
  label:     "Taxi",
} as const;

/** 20% mandatory discount rate (RA 9994 / BP 344) */
const DISCOUNT_RATE = 0.20;

export interface FareBreakdown {
  vehicleClass:   VehicleClass;
  passengerType:  PassengerType;
  distanceKm:     number;
  durationMin?:   number;     // taxi only
  baseFare:       number;     // base / flag-down fare (regular rate)
  additionalFare: number;     // distance charge beyond base km (regular rate)
  timeFare?:      number;     // taxi time charge
  subtotal:       number;     // baseFare + additionalFare [+ timeFare]
  discountAmount: number;     // 20% of subtotal (0 for regular passengers)
  totalFare:      number;     // final fare paid
  label:          string;
  effectiveDate?: string;
  rateNote:       string;
}

// ── Jeepney (Non-Aircon or Aircon) ───────────────────────────────────────────
function calcJeep(
  rates: typeof NON_AIRCON | typeof AIRCON,
  distanceKm: number,
  passengerType: PassengerType,
): FareBreakdown {
  const vehicleClass = rates === NON_AIRCON ? "nonAirconJeep" : "airconJeep";

  // Always compute using the regular (full) rate first
  const excessKm       = Math.max(0, distanceKm - rates.baseKm);
  const baseFare       = rates.base;
  const additionalFare = roundNearest25(excessKm * rates.perKm);
  const subtotal       = roundNearest25(baseFare + additionalFare);

  // Apply 20% discount to the total for qualifying passengers (RA 9994 / BP 344)
  const discountAmount = passengerType === "discounted"
    ? roundNearest25(subtotal * DISCOUNT_RATE)
    : 0;
  const totalFare = roundNearest25(subtotal - discountAmount);

  const rateNote = [
    `₱${rates.base.toFixed(2)} minimum (first ${rates.baseKm} km)`,
    `+ ₱${rates.perKm.toFixed(2)}/km after ${rates.baseKm} km`,
    passengerType === "discounted" ? "· 20% discount on total (RA 9994)" : "",
  ].filter(Boolean).join(" ");

  return {
    vehicleClass: vehicleClass as VehicleClass,
    passengerType,
    distanceKm,
    baseFare,
    additionalFare,
    subtotal,
    discountAmount,
    totalFare,
    label: rates.label,
    effectiveDate: rates.effectiveDate,
    rateNote,
  };
}

// ── Taxi ─────────────────────────────────────────────────────────────────────
function calcTaxi(
  distanceKm: number,
  durationMin: number,
  passengerType: PassengerType,
): FareBreakdown {
  const baseFare       = TAXI.flagDown;
  const additionalFare = roundNearest25(distanceKm * TAXI.perKm);
  const timeFare       = roundNearest25(durationMin * TAXI.perMinute);
  const subtotal       = roundNearest25(baseFare + additionalFare + timeFare);

  // 20% discount applied to total for qualifying passengers
  const discountAmount = passengerType === "discounted"
    ? roundNearest25(subtotal * DISCOUNT_RATE)
    : 0;
  const totalFare = roundNearest25(subtotal - discountAmount);

  const rateNote = [
    `₱${TAXI.flagDown} flag-down + ₱${TAXI.perKm}/km + ₱${TAXI.perMinute}/min`,
    passengerType === "discounted" ? "· 20% discount on total (RA 9994)" : "",
  ].filter(Boolean).join(" ");

  return {
    vehicleClass: "taxi",
    passengerType,
    distanceKm,
    durationMin,
    baseFare,
    additionalFare,
    timeFare,
    subtotal,
    discountAmount,
    totalFare,
    label: TAXI.label,
    rateNote,
  };
}

/** Public entry-point — compute fare for a given vehicle class */
export function computeFare(
  vehicleClass: VehicleClass,
  distanceKm: number,
  passengerType: PassengerType,
  durationMin = 0,
): FareBreakdown {
  switch (vehicleClass) {
    case "nonAirconJeep": return calcJeep(NON_AIRCON, distanceKm, passengerType);
    case "airconJeep":    return calcJeep(AIRCON,     distanceKm, passengerType);
    case "taxi":          return calcTaxi(distanceKm, durationMin, passengerType);
  }
}

/** Compute all three vehicle classes at once (for comparison card) */
export function computeAllFares(
  distanceKm: number,
  passengerType: PassengerType,
  durationMin = 0,
): FareBreakdown[] {
  return [
    computeFare("nonAirconJeep", distanceKm, passengerType, durationMin),
    computeFare("airconJeep",    distanceKm, passengerType, durationMin),
    computeFare("taxi",          distanceKm, passengerType, durationMin),
  ];
}
