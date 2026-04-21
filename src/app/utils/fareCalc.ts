/**
 * BiyaheHub — LTFRB Fare Calculator
 *
 * Sources:
 *  • Non-Aircon Modern/Electric PUJ  — LTFRB, effective March 19, 2026
 *  • Aircon Modern/Electric PUJ      — LTFRB, effective October 8, 2023
 *  • Taxi                            — LTFRB (current)
 *
 * All fares rounded to the nearest ₱0.25 per LTFRB rules.
 */

export type PassengerType = "regular" | "discounted"; // discounted = student / elderly / PWD
export type VehicleClass  = "nonAirconJeep" | "airconJeep" | "taxi";

/** Round a peso amount to the nearest ₱0.25 centavo */
export function roundNearest25(value: number): number {
  return Math.round(value * 4) / 4;
}

// ── Non-Aircon Modern/Electric PUJ ──────────────────────────────────────────
const NON_AIRCON = {
  regular:    { base: 17.00, perKm: 2.00 },
  discounted: { base: 13.60, perKm: 1.60 },
  label: "Non-Aircon PUJ",
  effectiveDate: "March 19, 2026",
} as const;

// ── Aircon Modern/Electric PUJ ───────────────────────────────────────────────
const AIRCON = {
  regular:    { base: 15.00, perKm: 2.20 },
  discounted: { base: 12.00, perKm: 1.76 },
  label: "Aircon PUJ",
  effectiveDate: "October 8, 2023",
} as const;

// ── Taxi ─────────────────────────────────────────────────────────────────────
const TAXI = {
  flagDown:  50.00,
  perKm:     13.50,
  perMinute:  2.00,
  discount:   0.20, // 20% off for students/elderly/disabled
  label: "Taxi",
} as const;

export interface FareBreakdown {
  vehicleClass:  VehicleClass;
  passengerType: PassengerType;
  distanceKm:    number;
  durationMin?:  number;    // taxi only
  baseFare:      number;
  additionalFare: number;
  timeFare?:     number;    // taxi only
  subtotal:      number;
  discountAmount: number;
  totalFare:     number;
  label:         string;
  effectiveDate?: string;
  rateNote:      string;
}

/** Jeepney (non-aircon or aircon) */
function calcJeep(
  rates: typeof NON_AIRCON | typeof AIRCON,
  distanceKm: number,
  passengerType: PassengerType,
): FareBreakdown {
  const r = passengerType === "regular" ? rates.regular : rates.discounted;
  const isClass = rates === NON_AIRCON ? "nonAirconJeep" : "airconJeep";

  const successKm      = Math.max(0, distanceKm - 4);
  const baseFare       = r.base;
  const additionalFare = roundNearest25(successKm * r.perKm);
  const subtotal       = roundNearest25(baseFare + additionalFare);

  // For the "regular" path the subtotal IS the total; no additional discount.
  // For "discounted" path, rates.discounted already bakes in the 20% cut, so no extra discount.
  const discountAmount = 0;
  const totalFare      = subtotal;

  const rateNote = passengerType === "regular"
    ? `₱${r.base.toFixed(2)} base (first 4 km) + ₱${r.perKm.toFixed(2)}/km`
    : `₱${r.base.toFixed(2)} base (first 4 km) + ₱${r.perKm.toFixed(2)}/km (20% discount applied)`;

  return {
    vehicleClass: isClass as VehicleClass,
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

/** Taxi */
function calcTaxi(
  distanceKm: number,
  durationMin: number,
  passengerType: PassengerType,
): FareBreakdown {
  const baseFare       = TAXI.flagDown;
  const additionalFare = roundNearest25(distanceKm * TAXI.perKm);
  const timeFare       = roundNearest25(durationMin * TAXI.perMinute);
  const subtotal       = roundNearest25(baseFare + additionalFare + timeFare);
  const discountAmount = passengerType === "discounted" ? roundNearest25(subtotal * TAXI.discount) : 0;
  const totalFare      = roundNearest25(subtotal - discountAmount);

  const rateNote = `₱${TAXI.flagDown} flag-down + ₱${TAXI.perKm}/km + ₱${TAXI.perMinute}/min${
    passengerType === "discounted" ? " (20% discount)" : ""
  }`;

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
    case "nonAirconJeep":
      return calcJeep(NON_AIRCON, distanceKm, passengerType);
    case "airconJeep":
      return calcJeep(AIRCON, distanceKm, passengerType);
    case "taxi":
      return calcTaxi(distanceKm, durationMin, passengerType);
  }
}

/** Compute all three vehicle classes at once (handy for a comparison card) */
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
