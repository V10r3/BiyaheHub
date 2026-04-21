import { useState, useEffect } from "react";
import {
  Droplets, Plus, Calculator, TrendingDown, PhilippinePeso,
  RefreshCw, ChevronDown, ChevronUp, Info,
} from "lucide-react";
import {
  fuelLogsApi, fuelPriceApi, userVehicleApi,
  type UserVehicle, type FuelLog, type FuelPrice,
} from "../services/api";
import {
  fuelConsumedL, fmtVolume, fmtDistance, fmtEfficiency,
  litersToGal, type UnitSystem,
} from "../utils/fuelCalc";

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
  userId: number;
  unit: UnitSystem;
  vehicle: UserVehicle | null;
  /** km from the active route (PUV waypoints length) or OSRM result */
  tripDistanceKm: number | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtPHP(amount: number) {
  return `₱${(Number(amount) || 0).toFixed(2)}`;
}

function isThisMonth(isoStr: string | undefined) {
  if (!isoStr) return false;
  const d = new Date(isoStr);
  const now = new Date();
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

// ─── Tank gauge ───────────────────────────────────────────────────────────────
function TankGauge({ current, max }: { current: number; max: number }) {
  const pct = Math.min(max > 0 ? (current / max) * 100 : 0, 100);
  const color = pct > 50 ? "#22c55e" : pct > 20 ? "#f59e0b" : "#ef4444";
  return (
    <div className="relative w-full h-6 bg-gray-100 rounded-full overflow-hidden border border-gray-200">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${pct}%`, background: color }}
      />
      <span
        className="absolute inset-0 flex items-center justify-center text-xs font-semibold"
        style={{ color: pct > 30 ? "white" : "#374151" }}
      >
        {pct.toFixed(0)}%
      </span>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────
export function FuelTracker({ userId, unit, vehicle, tripDistanceKm }: Props) {
  const [logs, setLogs]               = useState<FuelLog[]>([]);
  const [showRefuel, setShowRefuel]   = useState(false);
  const [showLogs, setShowLogs]       = useState(false);

  // Refuel form
  const [liters, setLiters]           = useState("");
  const [pricePerL, setPricePerL]     = useState("");
  const [odometerKm, setOdometerKm]   = useState("");
  const [notes, setNotes]             = useState("");
  const [fetchingPrice, setFetching]  = useState(false);
  const [livePrice, setLivePrice]     = useState<FuelPrice | null>(null);
  const [savingLog, setSavingLog]     = useState(false);

  // Fresh vehicle data fetched from API when refuel panel opens
  const [freshVehicle, setFreshVehicle] = useState<UserVehicle | null>(null);

  // The vehicle to use for tank calculations — prefer fresh API data, fall back to prop
  const activeVehicle = freshVehicle ?? vehicle;

  // Trip calculation
  const [tripCalc, setTripCalc]       = useState<{
    litersNeeded: number;
    estimatedCost: number;
    priceUsed: number;
    canComplete: boolean;
  } | null>(null);
  const [calcLoading, setCalcLoading] = useState(false);

  // Load logs on mount
  useEffect(() => {
    fuelLogsApi.getAll(userId).then(setLogs);
  }, [userId]);

  // ── Monthly stats ────────────────────────────────────────────────────────
  const thisMonthLogs = logs.filter((l) => isThisMonth(l.loggedAt));
  const totalLitersMonth = thisMonthLogs.reduce((a, l) => a + (Number(l.litersAdded) || 0), 0);
  const totalSpentMonth  = thisMonthLogs.reduce((a, l) => a + (Number(l.totalCost)   || 0), 0);
  const avgPricePerL     = thisMonthLogs.length
    ? thisMonthLogs.reduce((a, l) => a + (Number(l.pricePerL) || 0), 0) / thisMonthLogs.length
    : null;

  // ── Fetch live DOE price ─────────────────────────────────────────────────
  const handleFetchPrice = async () => {
    if (!activeVehicle) return;
    setFetching(true);
    try {
      const p = await fuelPriceApi.getCurrent(activeVehicle.fuelType);
      setLivePrice(p);
      setPricePerL(Number(p.pricePerLiter).toFixed(2));
    } finally {
      setFetching(false);
    }
  };

  // ── Auto-fill & auto-fetch when refuel panel opens ───────────────────────
  useEffect(() => {
    if (!showRefuel) return;

    // Fetch latest vehicle data from API to get up-to-date tank levels
    (async () => {
      const v = await userVehicleApi.get(userId);
      const resolved = v ?? vehicle;
      if (resolved) {
        setFreshVehicle(resolved);
        const topUp = Math.max(0, Number(resolved.tankMax) - Number(resolved.tankCurrent));
        setLiters(topUp > 0 ? topUp.toFixed(1) : "");
      }

      // Auto-fetch live price so cost preview populates immediately
      const fuelType = (v ?? vehicle)?.fuelType;
      if (fuelType) {
        setFetching(true);
        try {
          const p = await fuelPriceApi.getCurrent(fuelType);
          setLivePrice(p);
          setPricePerL(Number(p.pricePerLiter).toFixed(2));
        } finally {
          setFetching(false);
        }
      }
    })();
  }, [showRefuel]); // eslint-disable-line

  // ── Log refuel ──────────────────────────────────────────────────────────
  const handleLogRefuel = async () => {
    if (!activeVehicle || !liters || !pricePerL) return;
    setSavingLog(true);
    const litersNum = parseFloat(liters);
    const priceNum  = parseFloat(pricePerL);
    const totalCost = parseFloat((litersNum * priceNum).toFixed(2));
    const log = await fuelLogsApi.add({
      userId,
      litersAdded: litersNum,
      pricePerL:   priceNum,
      totalCost,
      odometerKm: odometerKm ? parseFloat(odometerKm) : undefined,
      notes: notes || undefined,
      loggedAt: new Date().toISOString(),
    });
    setLogs((prev) => [log, ...prev]);
    setLiters("");
    setPricePerL("");
    setOdometerKm("");
    setNotes("");
    setLivePrice(null);
    setShowRefuel(false);
    setSavingLog(false);
  };

  // ── Calculate trip fuel cost ────────────────────────────────────────────
  const handleCalculate = async () => {
    if (!activeVehicle || !tripDistanceKm) return;
    setCalcLoading(true);
    try {
      const p = await fuelPriceApi.getCurrent(activeVehicle.fuelType);
      const litersNeeded = fuelConsumedL(tripDistanceKm, activeVehicle.mileage);
      const estimatedCost = litersNeeded * p.pricePerLiter;
      const canComplete = Number(activeVehicle.tankCurrent) >= litersNeeded;
      setTripCalc({ litersNeeded, estimatedCost, priceUsed: p.pricePerLiter, canComplete });
    } finally {
      setCalcLoading(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────
  if (!activeVehicle) {
    return (
      <div className="p-4 text-center py-12">
        <Droplets size={32} className="mx-auto text-gray-200 mb-2" />
        <p className="text-gray-400 text-sm">Set up your vehicle first</p>
        <p className="text-gray-300 text-xs mt-1">Go to the Vehicle tab to get started</p>
      </div>
    );
  }

  const fuelVol = (l: number) => {
    const v = Number(l) || 0;
    return unit === "imperial"
      ? `${litersToGal(v).toFixed(2)} gal`
      : `${v.toFixed(2)} L`;
  };

  // Coerce tank values — MySQL returns numeric columns as strings
  const tankCurrent = Number(activeVehicle.tankCurrent) || 0;
  const tankMax     = Number(activeVehicle.tankMax)     || 0;

  return (
    <div className="p-4 space-y-4 overflow-y-auto">

      {/* ── Tank gauge ──────────────────────────────────────────────────── */}
      <div className="bg-white border border-gray-100 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500 flex items-center gap-1">
            <Droplets size={12} className="text-blue-500" /> Fuel Level
          </span>
          <span className="text-xs text-gray-600">
            {fuelVol(tankCurrent)} / {fuelVol(tankMax)}
          </span>
        </div>
        <TankGauge current={tankCurrent} max={tankMax} />
        <p className="text-xs text-gray-400 text-center">
          {fmtEfficiency(activeVehicle.mileage, unit)} ·{" "}
          {activeVehicle.year} {activeVehicle.make} {activeVehicle.model}
        </p>
      </div>

      {/* ── Monthly stats ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-blue-50 rounded-xl p-3">
          <p className="text-xs text-blue-500">Fuel Added (Month)</p>
          <p className="text-blue-800 mt-1">{fuelVol(totalLitersMonth)}</p>
        </div>
        <div className="bg-green-50 rounded-xl p-3">
          <p className="text-xs text-green-500">Money Spent (Month)</p>
          <p className="text-green-800 mt-1">{fmtPHP(totalSpentMonth)}</p>
        </div>
        {avgPricePerL !== null && (
          <div className="bg-orange-50 rounded-xl p-3 col-span-2">
            <p className="text-xs text-orange-500">Avg. Price Paid</p>
            <p className="text-orange-800 mt-1">
              ₱{Number(avgPricePerL).toFixed(2)}/L ·{" "}
              <span className="text-xs capitalize">{activeVehicle.fuelType}</span>
            </p>
          </div>
        )}
      </div>

      {/* ── Trip fuel estimate ───────────────────────────────────────────── */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-gray-50">
          <div className="flex items-center gap-2">
            <Calculator size={14} className="text-blue-500" />
            <span className="text-xs text-gray-600">Trip Fuel Estimate</span>
          </div>
          {tripDistanceKm ? (
            <span className="text-xs text-gray-400">{fmtDistance(tripDistanceKm, unit)}</span>
          ) : (
            <span className="text-xs text-gray-300 flex items-center gap-1">
              <Info size={11} /> Set a route first
            </span>
          )}
        </div>

        {tripDistanceKm ? (
          <div className="p-4 space-y-3">
            <button
              onClick={handleCalculate}
              disabled={calcLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs py-2 rounded-lg flex items-center justify-center gap-2 transition-colors"
            >
              {calcLoading
                ? <div className="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
                : <Calculator size={13} />}
              Calculate for This Trip
            </button>

            {tripCalc && (
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Fuel Needed</span>
                  <span className="text-gray-800">{fuelVol(tripCalc.litersNeeded)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Estimated Cost</span>
                  <span className="text-blue-700">{fmtPHP(tripCalc.estimatedCost)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Price Used</span>
                  <span className="text-gray-600">₱{Number(tripCalc.priceUsed).toFixed(2)}/L (GasWatch PH)</span>
                </div>
                <div className={`rounded-lg px-3 py-2 text-xs flex items-center gap-1.5 ${
                  tripCalc.canComplete
                    ? "bg-green-50 text-green-700"
                    : "bg-red-50 text-red-700"
                }`}>
                  <TrendingDown size={12} />
                  {tripCalc.canComplete
                    ? "Current fuel is enough for this trip"
                    : `Need ${fuelVol(tripCalc.litersNeeded - tankCurrent)} more to complete trip`}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="px-4 pb-4 pt-2 text-xs text-gray-400 text-center">
            Select a route or plan a trip to calculate fuel cost
          </div>
        )}
      </div>

      {/* ── Log Refuel ──────────────────────────────────────────────────── */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <button
          onClick={() => setShowRefuel((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Plus size={14} className="text-green-600" />
            <span className="text-xs text-gray-600">Log Refuel</span>
          </div>
          {showRefuel ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
        </button>

        {showRefuel && (
          <div className="p-4 space-y-3">
            {/* Fetch live price — now just a manual refresh button */}
            <button
              onClick={handleFetchPrice}
              disabled={fetchingPrice}
              className="w-full flex items-center justify-center gap-1.5 text-xs text-blue-600 border border-blue-200 rounded-lg py-2 hover:bg-blue-50 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={12} className={fetchingPrice ? "animate-spin" : ""} />
              {fetchingPrice ? "Fetching GasWatch price…" : "Refresh Live Fuel Price"}
            </button>

            {livePrice && (
              <div className="bg-blue-50 rounded-lg px-3 py-2 text-xs text-blue-700">
                GasWatch PH · {livePrice.fuelType}: ₱{Number(livePrice.pricePerLiter).toFixed(2)}/L
                <span className="text-blue-400 ml-1">· {livePrice.effectiveDate}</span>
                {livePrice.confidence === "scraped" && (
                  <span className="ml-1 text-green-600">● live</span>
                )}
                {livePrice.confidence === "fallback" && (
                  <span className="ml-1 text-orange-500">(GasWatch unreachable — last known)</span>
                )}
                {livePrice.confidence === "mock" && (
                  <span className="ml-1 text-orange-500">(mock — backend offline)</span>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Liters Added
                  <span className="ml-1 text-blue-400">(tank top-up)</span>
                </label>
                <input
                  type="number"
                  value={liters}
                  onChange={(e) => setLiters(e.target.value)}
                  placeholder="e.g. 20"
                  min={0}
                  max={activeVehicle?.tankMax}
                  step={0.1}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                {activeVehicle && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    Tank: {tankCurrent.toFixed(1)} / {tankMax} L
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Price/Liter (₱)</label>
                <input
                  type="number"
                  value={pricePerL}
                  onChange={(e) => setPricePerL(e.target.value)}
                  placeholder={fetchingPrice ? "loading…" : "e.g. 67.50"}
                  min={0}
                  step={0.01}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
            </div>

            {/* Calculated cost — always visible when either field has a value */}
            <div className={`rounded-lg px-3 py-2.5 text-xs flex justify-between items-center border ${
              liters && pricePerL
                ? "bg-green-50 border-green-200"
                : "bg-gray-50 border-gray-200 opacity-50"
            }`}>
              <span className="text-gray-500">Calculated Total Cost</span>
              <span className="text-green-700 font-medium">
                {liters && pricePerL
                  ? fmtPHP(parseFloat(liters || "0") * parseFloat(pricePerL || "0"))
                  : "—"}
              </span>
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">Odometer (km) — optional</label>
              <input
                type="number"
                value={odometerKm}
                onChange={(e) => setOdometerKm(e.target.value)}
                placeholder="e.g. 45820"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">Notes — optional</label>
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Shell Mandaue station"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>

            <button
              onClick={handleLogRefuel}
              disabled={!liters || !pricePerL || savingLog}
              className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm py-2 rounded-lg flex items-center justify-center gap-2 transition-colors"
            >
              {savingLog
                ? <div className="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
                : <PhilippinePeso size={13} />}
              Save Refuel Entry
            </button>
          </div>
        )}
      </div>

      {/* ── Recent logs ─────────────────────────────────────────────────── */}
      {logs.length > 0 && (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <button
            onClick={() => setShowLogs((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
          >
            <span className="text-xs text-gray-600">Refuel History ({logs.length})</span>
            {showLogs ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
          </button>

          {showLogs && (
            <div className="divide-y divide-gray-100 max-h-56 overflow-y-auto">
              {logs.slice(0, 20).map((log, i) => (
                <div key={log.id ?? i} className="px-4 py-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-xs text-gray-700">
                        {fuelVol(log.litersAdded)} @ ₱{Number(log.pricePerL).toFixed(2)}/L
                      </p>
                      {log.notes && <p className="text-xs text-gray-400 mt-0.5">{log.notes}</p>}
                      {log.loggedAt && (
                        <p className="text-xs text-gray-300 mt-0.5">
                          {new Date(log.loggedAt).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-green-700">{fmtPHP(log.totalCost)}</p>
                      <p className="text-xs text-gray-400 mt-0.5">total</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}