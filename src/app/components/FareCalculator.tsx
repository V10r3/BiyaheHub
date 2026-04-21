/**
 * FareCalculator — LTFRB-based fare estimator panel
 * Embedded in the Commuter Dashboard sidebar.
 *
 * When distanceMeters / durationSeconds are provided (from OSRM),
 * they auto-fill the inputs; users can still override manually.
 */

import { useState, useEffect } from "react";
import {
  computeAllFares, computeFare,
  type PassengerType, type VehicleClass, type FareBreakdown,
} from "../utils/fareCalc";
import { Calculator, ChevronDown, ChevronUp, Info } from "lucide-react";

interface Props {
  /** OSRM route distance in metres — auto-fills the km input when provided */
  distanceMeters?: number | null;
  /** OSRM route duration in seconds — auto-fills the minutes input for taxi */
  durationSeconds?: number | null;
}

const VEHICLE_TABS: { key: VehicleClass; label: string; emoji: string }[] = [
  { key: "nonAirconJeep", label: "Non-Aircon PUJ", emoji: "🚌" },
  { key: "airconJeep",    label: "Aircon PUJ",     emoji: "🚌" },
  { key: "taxi",          label: "Taxi",            emoji: "🚕" },
];

const PASSENGER_OPTS: { key: PassengerType; label: string }[] = [
  { key: "regular",    label: "Regular" },
  { key: "discounted", label: "Student / Elderly / PWD  (20% off)" },
];

function formatPeso(val: number) {
  return `₱${val.toFixed(2)}`;
}

export function FareCalculator({ distanceMeters, durationSeconds }: Props) {
  const [open, setOpen]                   = useState(false);
  const [vehicleClass, setVehicleClass]   = useState<VehicleClass>("nonAirconJeep");
  const [passengerType, setPassengerType] = useState<PassengerType>("regular");
  const [kmInput, setKmInput]             = useState("");
  const [minInput, setMinInput]           = useState("");
  const [breakdown, setBreakdown]         = useState<FareBreakdown | null>(null);
  const [showBreakdown, setShowBreakdown] = useState(false);

  // Auto-fill from OSRM whenever the route changes
  useEffect(() => {
    if (distanceMeters != null) {
      setKmInput((distanceMeters / 1000).toFixed(2));
    }
  }, [distanceMeters]);

  useEffect(() => {
    if (durationSeconds != null) {
      setMinInput((durationSeconds / 60).toFixed(0));
    }
  }, [durationSeconds]);

  // Re-compute whenever any input changes
  useEffect(() => {
    const km  = parseFloat(kmInput);
    const min = parseFloat(minInput) || 0;
    if (!isNaN(km) && km > 0) {
      setBreakdown(computeFare(vehicleClass, km, passengerType, min));
    } else {
      setBreakdown(null);
    }
  }, [vehicleClass, passengerType, kmInput, minInput]);

  // All-types comparison (for the compact "all" view inside the panel)
  const km  = parseFloat(kmInput);
  const min = parseFloat(minInput) || 0;
  const allFares = (!isNaN(km) && km > 0) ? computeAllFares(km, passengerType, min) : null;

  const isAutoFilled = distanceMeters != null;

  return (
    <div className="border-b border-gray-100">
      {/* Header toggle */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
      >
        <span className="flex items-center gap-2 text-xs text-gray-600">
          <Calculator size={13} className="text-blue-500" />
          Fare Calculator
          {isAutoFilled && (
            <span className="bg-blue-100 text-blue-600 text-[10px] px-1.5 py-0.5 rounded-full">
              auto-filled
            </span>
          )}
        </span>
        {open ? <ChevronUp size={13} className="text-gray-400" /> : <ChevronDown size={13} className="text-gray-400" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">

          {/* Passenger type */}
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Passenger Type</p>
            <div className="flex flex-col gap-1">
              {PASSENGER_OPTS.map((opt) => (
                <label key={opt.key} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="passengerType"
                    value={opt.key}
                    checked={passengerType === opt.key}
                    onChange={() => setPassengerType(opt.key)}
                    className="accent-blue-600"
                  />
                  <span className="text-xs text-gray-600">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Distance input */}
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">
              Distance (km){isAutoFilled && <span className="normal-case text-blue-400 ml-1">from OSRM route</span>}
            </p>
            <input
              type="number"
              min="0"
              step="0.1"
              value={kmInput}
              onChange={(e) => setKmInput(e.target.value)}
              placeholder="e.g. 5.5"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          {/* Duration input — only relevant for taxi */}
          {vehicleClass === "taxi" && (
            <div>
              <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">
                Travel time (min){durationSeconds != null && <span className="normal-case text-blue-400 ml-1">from OSRM route</span>}
              </p>
              <input
                type="number"
                min="0"
                step="1"
                value={minInput}
                onChange={(e) => setMinInput(e.target.value)}
                placeholder="e.g. 20"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
          )}

          {/* Vehicle type tabs */}
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Vehicle Type</p>
            <div className="flex gap-1 flex-wrap">
              {VEHICLE_TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setVehicleClass(t.key)}
                  className={`px-2 py-1 rounded-full text-[11px] border transition-all flex items-center gap-1 ${
                    vehicleClass === t.key
                      ? "bg-blue-600 text-white border-blue-600"
                      : "border-gray-200 text-gray-500 hover:border-gray-400"
                  }`}
                >
                  <span>{t.emoji}</span>
                  <span>{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Result card */}
          {breakdown ? (
            <div className="bg-blue-50 border border-blue-200 rounded-xl overflow-hidden">
              {/* Total fare hero */}
              <div className="bg-blue-600 px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-blue-200 uppercase tracking-wide">Estimated Fare</p>
                  <p className="text-2xl text-white mt-0.5">{formatPeso(breakdown.totalFare)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-blue-200">{breakdown.label}</p>
                  <p className="text-[10px] text-blue-300 mt-0.5">{breakdown.distanceKm.toFixed(2)} km</p>
                </div>
              </div>

              {/* Breakdown toggle */}
              <button
                onClick={() => setShowBreakdown((v) => !v)}
                className="w-full flex items-center justify-between px-3 py-2 text-[11px] text-blue-600 hover:bg-blue-100 transition-colors"
              >
                <span>View breakdown</span>
                {showBreakdown ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
              </button>

              {showBreakdown && (
                <div className="px-3 pb-3 space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-gray-500">Base fare (first 4 km)</span>
                    <span className="text-gray-700">{formatPeso(breakdown.baseFare)}</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-gray-500">Additional (distance)</span>
                    <span className="text-gray-700">{formatPeso(breakdown.additionalFare)}</span>
                  </div>
                  {breakdown.timeFare != null && (
                    <div className="flex justify-between text-[11px]">
                      <span className="text-gray-500">Time charge ({breakdown.durationMin?.toFixed(0)} min)</span>
                      <span className="text-gray-700">{formatPeso(breakdown.timeFare)}</span>
                    </div>
                  )}
                  {breakdown.discountAmount > 0 && (
                    <div className="flex justify-between text-[11px]">
                      <span className="text-green-600">Discount (20%)</span>
                      <span className="text-green-600">−{formatPeso(breakdown.discountAmount)}</span>
                    </div>
                  )}
                  <div className="border-t border-blue-200 pt-1 flex justify-between text-[11px]">
                    <span className="text-blue-700">Total</span>
                    <span className="text-blue-700">{formatPeso(breakdown.totalFare)}</span>
                  </div>
                  <p className="text-[10px] text-gray-400 pt-1">{breakdown.rateNote}</p>
                  {breakdown.effectiveDate && (
                    <p className="text-[10px] text-gray-400">LTFRB rate effective {breakdown.effectiveDate}</p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-gray-50 border border-dashed border-gray-200 rounded-xl p-4 text-center">
              <p className="text-[11px] text-gray-400">
                {kmInput ? "Enter a valid distance to estimate." : "Enter a distance or plan a trip above."}
              </p>
            </div>
          )}

          {/* Quick comparison across all vehicle types */}
          {allFares && (
            <div>
              <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1.5">Quick Comparison</p>
              <div className="space-y-1.5">
                {allFares.map((f) => {
                  const tab = VEHICLE_TABS.find((t) => t.key === f.vehicleClass)!;
                  const isActive = f.vehicleClass === vehicleClass;
                  return (
                    <button
                      key={f.vehicleClass}
                      onClick={() => setVehicleClass(f.vehicleClass)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-[11px] transition-all ${
                        isActive
                          ? "border-blue-400 bg-blue-50 text-blue-700"
                          : "border-gray-200 hover:border-gray-300 text-gray-600"
                      }`}
                    >
                      <span className="flex items-center gap-1.5">
                        <span>{tab.emoji}</span>
                        <span>{tab.label}</span>
                      </span>
                      <span className={isActive ? "text-blue-700" : "text-gray-500"}>
                        {formatPeso(f.totalFare)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Source note */}
          <div className="flex items-start gap-1.5 pt-1">
            <Info size={11} className="text-gray-300 mt-0.5 shrink-0" />
            <p className="text-[10px] text-gray-400 leading-relaxed">
              Fares are based on LTFRB-approved rates and rounded to the nearest ₱0.25.
              Estimates may vary; always confirm with the driver.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
