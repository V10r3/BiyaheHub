/**
 * FareValidator — LTFRB fare-overcharge checker
 *
 * Commuter enters the amount they were charged; the component computes the
 * LTFRB-mandated fare for the same trip and shows a verdict:
 *   ✅ VALID       — within ₱0.25 rounding tolerance
 *   🔴 OVERCHARGED — driver charged more than the mandated rate
 *   🟡 UNDERCHARGED— driver charged less (e.g. forgot to charge full distance)
 */

import { useState, useEffect } from "react";
import {
  ShieldCheck, ShieldAlert, ShieldX,
  ChevronDown, ChevronUp, ExternalLink,
  AlertCircle, Info, ReceiptText,
} from "lucide-react";
import {
  computeFare,
  roundNearest25,
  type PassengerType,
  type VehicleClass,
  type FareBreakdown,
} from "../utils/fareCalc";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Props {
  /** OSRM route distance in metres — auto-fills the km input */
  distanceMeters?: number | null;
  /** OSRM route duration in seconds — auto-fills the minutes input for taxi */
  durationSeconds?: number | null;
}

type ValidationStatus = "valid" | "overcharged" | "undercharged" | null;

// ── Constants ─────────────────────────────────────────────────────────────────
const TOLERANCE = 0.25; // one LTFRB rounding step

const VEHICLE_OPTS: { key: VehicleClass; label: string; emoji: string }[] = [
  { key: "nonAirconJeep", label: "Non-Aircon PUJ", emoji: "🚌" },
  { key: "airconJeep",    label: "Aircon PUJ",     emoji: "🚌" },
  { key: "taxi",          label: "Taxi",            emoji: "🚕" },
];

const PASSENGER_OPTS: { key: PassengerType; label: string }[] = [
  { key: "regular",    label: "Regular" },
  { key: "discounted", label: "Student / Elderly / PWD (20% off)" },
];

// LTFRB official complaint portal
const LTFRB_REPORT_URL =
  "https://ltfrb.gov.ph/main/complaints";

function fmt(v: number) {
  return `₱${(Number(v) || 0).toFixed(2)}`;
}

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_CFG: Record<
  Exclude<ValidationStatus, null>,
  {
    label: string;
    sub: (diff: number) => string;
    bg: string;
    border: string;
    text: string;
    badge: string;
    Icon: React.ElementType;
  }
> = {
  valid: {
    label: "Fare is Valid",
    sub: () => "The amount charged matches the LTFRB-approved rate.",
    bg: "bg-green-50",
    border: "border-green-200",
    text: "text-green-800",
    badge: "bg-green-100 text-green-700",
    Icon: ShieldCheck,
  },
  overcharged: {
    label: "Overcharged!",
    sub: (diff) =>
      `You were charged ${fmt(diff)} more than the mandated fare. You may file a complaint.`,
    bg: "bg-red-50",
    border: "border-red-200",
    text: "text-red-800",
    badge: "bg-red-100 text-red-700",
    Icon: ShieldX,
  },
  undercharged: {
    label: "Below Standard Rate",
    sub: (diff) =>
      `Charged ${fmt(Math.abs(diff))} less than the LTFRB rate. Verify the distance or vehicle type.`,
    bg: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-800",
    badge: "bg-amber-100 text-amber-700",
    Icon: ShieldAlert,
  },
};

// ── Component ─────────────────────────────────────────────────────────────────
export function FareValidator({ distanceMeters, durationSeconds }: Props) {
  const [open,          setOpen]          = useState(false);
  const [vehicleClass,  setVehicleClass]  = useState<VehicleClass>("nonAirconJeep");
  const [passengerType, setPassengerType] = useState<PassengerType>("regular");
  const [kmInput,       setKmInput]       = useState("");
  const [minInput,      setMinInput]      = useState("");
  const [chargedInput,  setChargedInput]  = useState("");
  const [breakdown,     setBreakdown]     = useState<FareBreakdown | null>(null);
  const [status,        setStatus]        = useState<ValidationStatus>(null);
  const [diff,          setDiff]          = useState(0);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [validated,     setValidated]     = useState(false);

  // Auto-fill from OSRM whenever the route changes
  useEffect(() => {
    if (distanceMeters != null) setKmInput((distanceMeters / 1000).toFixed(2));
  }, [distanceMeters]);

  useEffect(() => {
    if (durationSeconds != null) setMinInput((durationSeconds / 60).toFixed(0));
  }, [durationSeconds]);

  // Reset validation whenever inputs change
  useEffect(() => {
    setStatus(null);
    setValidated(false);
  }, [vehicleClass, passengerType, kmInput, minInput, chargedInput]);

  const validate = () => {
    const km      = parseFloat(kmInput);
    const min     = parseFloat(minInput) || 0;
    const charged = parseFloat(chargedInput);

    if (isNaN(km) || km <= 0 || isNaN(charged) || charged < 0) return;

    const bd = computeFare(vehicleClass, km, passengerType, min);
    setBreakdown(bd);

    const expected = bd.totalFare;
    const delta    = roundNearest25(charged - expected);
    setDiff(delta);

    if (Math.abs(delta) <= TOLERANCE) {
      setStatus("valid");
    } else if (delta > 0) {
      setStatus("overcharged");
    } else {
      setStatus("undercharged");
    }
    setValidated(true);
    setShowBreakdown(false);
  };

  const isAutoFilled = distanceMeters != null;
  const canValidate  =
    parseFloat(kmInput) > 0 &&
    parseFloat(chargedInput) >= 0 &&
    !isNaN(parseFloat(chargedInput));

  const cfg = status ? STATUS_CFG[status] : null;

  return (
    <div className="border-b border-gray-100">
      {/* ── Header toggle ── */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
      >
        <span className="flex items-center gap-2 text-xs text-gray-600">
          <ReceiptText size={13} className="text-violet-500" />
          Fare Validator
          {isAutoFilled && (
            <span className="bg-violet-100 text-violet-600 text-[10px] px-1.5 py-0.5 rounded-full">
              auto-filled
            </span>
          )}
          {validated && status && (
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${STATUS_CFG[status].badge}`}
            >
              {status === "valid" ? "✓ Valid" : status === "overcharged" ? "⚠ Overcharged" : "⚠ Low"}
            </span>
          )}
        </span>
        {open ? (
          <ChevronUp size={13} className="text-gray-400" />
        ) : (
          <ChevronDown size={13} className="text-gray-400" />
        )}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">

          {/* ── Passenger type ── */}
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Passenger Type</p>
            <div className="flex flex-col gap-1">
              {PASSENGER_OPTS.map((opt) => (
                <label key={opt.key} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="validatorPassenger"
                    value={opt.key}
                    checked={passengerType === opt.key}
                    onChange={() => setPassengerType(opt.key)}
                    className="accent-violet-600"
                  />
                  <span className="text-xs text-gray-600">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* ── Vehicle type ── */}
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Vehicle Type</p>
            <div className="flex gap-1 flex-wrap">
              {VEHICLE_OPTS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setVehicleClass(t.key)}
                  className={`px-2 py-1 rounded-full text-[11px] border transition-all flex items-center gap-1 ${
                    vehicleClass === t.key
                      ? "bg-violet-600 text-white border-violet-600"
                      : "border-gray-200 text-gray-500 hover:border-gray-400"
                  }`}
                >
                  <span>{t.emoji}</span>
                  <span>{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ── Distance ── */}
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">
              Distance (km)
              {isAutoFilled && (
                <span className="normal-case text-violet-400 ml-1">from OSRM route</span>
              )}
            </p>
            <input
              type="number"
              min="0"
              step="0.1"
              value={kmInput}
              onChange={(e) => setKmInput(e.target.value)}
              placeholder="e.g. 5.5"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
            />
          </div>

          {/* ── Duration (taxi only) ── */}
          {vehicleClass === "taxi" && (
            <div>
              <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">
                Travel Time (min)
                {durationSeconds != null && (
                  <span className="normal-case text-violet-400 ml-1">from OSRM route</span>
                )}
              </p>
              <input
                type="number"
                min="0"
                step="1"
                value={minInput}
                onChange={(e) => setMinInput(e.target.value)}
                placeholder="e.g. 20"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
              />
            </div>
          )}

          {/* ── Fare actually charged ── */}
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">
              Fare Charged by Driver (₱)
            </p>
            <input
              type="number"
              min="0"
              step="0.25"
              value={chargedInput}
              onChange={(e) => setChargedInput(e.target.value)}
              placeholder="e.g. 25.00"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
            />
            <p className="text-[10px] text-gray-400 mt-0.5">
              Enter the exact amount the driver asked you to pay.
            </p>
          </div>

          {/* ── Validate button ── */}
          <button
            onClick={validate}
            disabled={!canValidate}
            className="w-full bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white text-sm py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5"
          >
            <ShieldCheck size={13} />
            Check Fare
          </button>

          {/* ── Result card ── */}
          {validated && status && cfg && breakdown && (() => {
            const { Icon } = cfg;
            return (
              <div className={`rounded-xl border overflow-hidden ${cfg.bg} ${cfg.border}`}>
                {/* Hero row */}
                <div className="p-3 flex items-start gap-3">
                  <div className={`mt-0.5 shrink-0 ${cfg.text}`}>
                    <Icon size={22} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${cfg.text}`}>{cfg.label}</p>
                    <p className={`text-[11px] mt-0.5 leading-relaxed ${cfg.text} opacity-80`}>
                      {cfg.sub(diff)}
                    </p>
                  </div>
                </div>

                {/* Fare comparison row */}
                <div className="border-t border-current border-opacity-10 grid grid-cols-2 divide-x divide-current divide-opacity-10">
                  <div className="px-3 py-2 text-center">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide">Charged</p>
                    <p className={`text-base mt-0.5 ${cfg.text}`}>
                      {fmt(parseFloat(chargedInput))}
                    </p>
                  </div>
                  <div className="px-3 py-2 text-center">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide">LTFRB Rate</p>
                    <p className={`text-base mt-0.5 ${cfg.text}`}>
                      {fmt(breakdown.totalFare)}
                    </p>
                  </div>
                </div>

                {/* Difference pill */}
                {status !== "valid" && (
                  <div className="px-3 py-2 flex items-center justify-center">
                    <span className={`text-[11px] px-3 py-1 rounded-full font-medium ${cfg.badge}`}>
                      {status === "overcharged" ? "+" : "−"}{fmt(Math.abs(diff))} difference
                    </span>
                  </div>
                )}

                {/* Breakdown toggle */}
                <button
                  onClick={() => setShowBreakdown((v) => !v)}
                  className={`w-full flex items-center justify-between px-3 py-2 text-[11px] ${cfg.text} opacity-70 hover:opacity-100 transition-opacity border-t border-current border-opacity-10`}
                >
                  <span>View fare breakdown</span>
                  {showBreakdown ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                </button>

                {showBreakdown && (
                  <div className="px-3 pb-3 space-y-1.5 border-t border-current border-opacity-10">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-gray-500">Base fare (first 4 km)</span>
                      <span className="text-gray-700">{fmt(breakdown.baseFare)}</span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-gray-500">Additional (distance)</span>
                      <span className="text-gray-700">{fmt(breakdown.additionalFare)}</span>
                    </div>
                    {breakdown.timeFare != null && (
                      <div className="flex justify-between text-[11px]">
                        <span className="text-gray-500">
                          Time charge ({breakdown.durationMin?.toFixed(0)} min)
                        </span>
                        <span className="text-gray-700">{fmt(breakdown.timeFare)}</span>
                      </div>
                    )}
                    {breakdown.discountAmount > 0 && (
                      <div className="flex justify-between text-[11px]">
                        <span className="text-green-600">Discount (20%)</span>
                        <span className="text-green-600">−{fmt(breakdown.discountAmount)}</span>
                      </div>
                    )}
                    <div className="border-t border-gray-200 pt-1.5 flex justify-between text-[11px]">
                      <span className="text-gray-600">LTFRB mandated total</span>
                      <span className="text-gray-800">{fmt(breakdown.totalFare)}</span>
                    </div>
                    <p className="text-[10px] text-gray-400 pt-0.5">{breakdown.rateNote}</p>
                    {breakdown.effectiveDate && (
                      <p className="text-[10px] text-gray-400">
                        LTFRB rate effective {breakdown.effectiveDate}
                      </p>
                    )}
                  </div>
                )}

                {/* Report button — only for overcharges */}
                {status === "overcharged" && (
                  <div className="px-3 pb-3 pt-1">
                    <a
                      href={LTFRB_REPORT_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full flex items-center justify-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-xs py-2 rounded-lg transition-colors"
                    >
                      <AlertCircle size={12} />
                      Report Overcharge to LTFRB
                      <ExternalLink size={11} className="opacity-70" />
                    </a>
                    <p className="text-[10px] text-gray-400 text-center mt-1.5 leading-relaxed">
                      Save your receipt and note the plate number, route, date &amp; time before filing.
                    </p>
                  </div>
                )}
              </div>
            );
          })()}

          {/* ── Footer note ── */}
          <div className="flex items-start gap-1.5 pt-1">
            <Info size={11} className="text-gray-300 mt-0.5 shrink-0" />
            <p className="text-[10px] text-gray-400 leading-relaxed">
              Validation uses official LTFRB-approved rates rounded to the nearest ₱0.25.
              A tolerance of ₱0.25 is applied to account for rounding differences.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
