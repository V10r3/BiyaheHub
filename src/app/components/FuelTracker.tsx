import { useState, useEffect, useRef, useCallback } from "react";
import {
  Droplets, Plus, Calculator, TrendingDown, TrendingUp, PhilippinePeso,
  RefreshCw, ChevronDown, ChevronUp, Info, Target, Pencil, Check, X,
  Bell, BellOff, AlertTriangle, ShieldAlert,
} from "lucide-react";
import {
  fuelLogsApi, fuelPriceApi, userVehicleApi,
  type UserVehicle, type FuelLog, type FuelPrice,
} from "../services/api";
import {
  fuelConsumedL, fmtDistance, fmtEfficiency,
  litersToGal, l100kmToMpg, mpgToL100km, type UnitSystem,
} from "../utils/fuelCalc";

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
  userId: number;
  unit: UnitSystem;
  vehicle: UserVehicle | null;
  tripDistanceKm: number | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtPHP(amount: number) {
  return `₱${(Number(amount) || 0).toFixed(2)}`;
}

function isYesterday(isoStr: string | undefined) {
  if (!isoStr) return false;
  const d = new Date(isoStr);
  const y = new Date();
  y.setDate(y.getDate() - 1);
  return (
    d.getFullYear() === y.getFullYear() &&
    d.getMonth()    === y.getMonth()    &&
    d.getDate()     === y.getDate()
  );
}

function isToday(isoStr: string | undefined) {
  if (!isoStr) return false;
  const d   = new Date(isoStr);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth()    === now.getMonth()    &&
    d.getDate()     === now.getDate()
  );
}

function isThisMonth(isoStr: string | undefined) {
  if (!isoStr) return false;
  const d   = new Date(isoStr);
  const now = new Date();
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

// ─── Tank gauge ───────────────────────────────────────────────────────────────
function TankGauge({ current, max }: { current: number; max: number }) {
  const pct   = Math.min(max > 0 ? (current / max) * 100 : 0, 100);
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

// ─── localStorage keys ────────────────────────────────────────────────────────
const goalKey   = (userId: number) => `biyahehub_fuel_goal_${userId}`;

// ─── Notification helpers ─────────────────────────────────────────────────────
/**
 * How close to the goal before we warn (15% below = 85% of goal reached).
 * e.g. goal = 10 L/100km → warn at 8.5 L/100km
 */
const WARNING_ZONE_PCT = 0.15;

type AlertLevel = "approaching" | "exceeded" | null;

function canUseNotifications() {
  return typeof window !== "undefined" && "Notification" in window;
}

function pushBrowserNotif(title: string, body: string) {
  if (!canUseNotifications() || Notification.permission !== "granted") return;
  try {
    new Notification(title, { body, icon: "/favicon.ico", tag: "fuel-goal" });
  } catch {
    // some browsers (e.g. iframe sandbox) throw even with permission
  }
}

// ─── Component ────────────────────────────────────────────────────────────────
export function FuelTracker({ userId, unit, vehicle, tripDistanceKm }: Props) {
  const [logs, setLogs]             = useState<FuelLog[]>([]);
  const [showRefuel, setShowRefuel] = useState(false);
  const [showLogs, setShowLogs]     = useState(false);

  // Refuel form
  const [liters, setLiters]         = useState("");
  const [pricePerL, setPricePerL]   = useState("");
  const [odometerKm, setOdometerKm] = useState("");
  const [notes, setNotes]           = useState("");
  const [fetchingPrice, setFetching]= useState(false);
  const [livePrice, setLivePrice]   = useState<FuelPrice | null>(null);
  const [savingLog, setSavingLog]   = useState(false);

  const [freshVehicle, setFreshVehicle] = useState<UserVehicle | null>(null);
  const activeVehicle = freshVehicle ?? vehicle;

  const [tripCalc, setTripCalc] = useState<{
    litersNeeded: number;
    estimatedCost: number;
    priceUsed: number;
    canComplete: boolean;
  } | null>(null);
  const [calcLoading, setCalcLoading] = useState(false);

  // ── Minimum Consumption Goal (L/100km internally) ─────────────────────────
  const [consumptionGoal, setConsumptionGoal] = useState<number>(() => {
    const saved = localStorage.getItem(goalKey(userId));
    return saved ? parseFloat(saved) : 10;
  });
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput, setGoalInput]     = useState("");

  // ── Notification state ────────────────────────────────────────────────────
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(() =>
    canUseNotifications() ? Notification.permission : "denied"
  );
  const [alertLevel, setAlertLevel]       = useState<AlertLevel>(null);
  const [alertDismissed, setAlertDismissed] = useState(false);

  /** Tracks which levels have already fired a browser push this session. */
  const firedRef = useRef<{ approaching: boolean; exceeded: boolean }>({
    approaching: false,
    exceeded: false,
  });

  // ── Derive actual L/100km BEFORE early return so effects can use it ────────
  const actualL100km = Number(activeVehicle?.mileage) || 0;

  // ── Sync goal to localStorage ─────────────────────────────────────────────
  useEffect(() => {
    localStorage.setItem(goalKey(userId), String(consumptionGoal));
  }, [consumptionGoal, userId]);

  // ── Reset fired flags when goal changes so new threshold gets fresh push ──
  useEffect(() => {
    firedRef.current = { approaching: false, exceeded: false };
    setAlertDismissed(false);
  }, [consumptionGoal]);

  // ── Main notification effect ───────────────────────────────────────────────
  useEffect(() => {
    if (!activeVehicle || actualL100km <= 0 || consumptionGoal <= 0) return;

    const ratio = actualL100km / consumptionGoal;

    if (ratio >= 1.0) {
      // Goal exceeded
      if (!firedRef.current.exceeded) {
        firedRef.current.exceeded    = true;
        firedRef.current.approaching = true;
        pushBrowserNotif(
          "⛽ BiyaheHub — Consumption Goal Exceeded",
          `Your vehicle is consuming ${actualL100km.toFixed(1)} L/100km, ` +
          `which exceeds your goal of ${consumptionGoal.toFixed(1)} L/100km. ` +
          `Consider reviewing your driving habits.`
        );
      }
      setAlertLevel("exceeded");
      setAlertDismissed(false);

    } else if (ratio >= 1 - WARNING_ZONE_PCT) {
      // Approaching goal (within 15%)
      const remaining = consumptionGoal - actualL100km;
      if (!firedRef.current.approaching) {
        firedRef.current.approaching = true;
        pushBrowserNotif(
          "⚠️ BiyaheHub — Approaching Consumption Goal",
          `Your vehicle is at ${actualL100km.toFixed(1)} L/100km — only ` +
          `${remaining.toFixed(2)} L/100km away from your ` +
          `${consumptionGoal.toFixed(1)} L/100km goal.`
        );
      }
      setAlertLevel("approaching");
      setAlertDismissed(false);

    } else {
      // Well within goal — clear
      firedRef.current = { approaching: false, exceeded: false };
      setAlertLevel(null);
    }
  }, [actualL100km, consumptionGoal, activeVehicle]);

  // ── Permission request handler (must be user gesture) ─────────────────────
  const requestPermission = useCallback(async () => {
    if (!canUseNotifications()) return;
    const result = await Notification.requestPermission();
    setNotifPermission(result);
    // Re-evaluate immediately so a pending alert fires right after grant
    firedRef.current = { approaching: false, exceeded: false };
  }, []);

  // ── Unit changes while editing goal ───────────────────────────────────────
  useEffect(() => {
    if (!editingGoal) return;
    setGoalInput(
      unit === "imperial"
        ? l100kmToMpg(consumptionGoal).toFixed(1)
        : consumptionGoal.toFixed(1)
    );
  }, [unit]); // eslint-disable-line

  const startEditGoal = () => {
    setGoalInput(
      unit === "imperial"
        ? l100kmToMpg(consumptionGoal).toFixed(1)
        : consumptionGoal.toFixed(1)
    );
    setEditingGoal(true);
  };

  const saveGoal = () => {
    const num = parseFloat(goalInput);
    if (!isNaN(num) && num > 0)
      setConsumptionGoal(unit === "imperial" ? mpgToL100km(num) : num);
    setEditingGoal(false);
  };

  const cancelGoal = () => setEditingGoal(false);

  useEffect(() => {
    fuelLogsApi.getAll(userId).then(setLogs);
  }, [userId]);

  // ── Derived stats ─────────────────────────────────────────────────────────
  const yesterdayLogs    = logs.filter((l) => isYesterday(l.loggedAt));
  const totalSpentYday   = yesterdayLogs.reduce((a, l) => a + (Number(l.totalCost) || 0), 0);

  const todayLogs        = logs.filter((l) => isToday(l.loggedAt));
  const totalSpentToday  = todayLogs.reduce((a, l) => a + (Number(l.totalCost) || 0), 0);

  const moneySaved    = totalSpentYday - totalSpentToday;
  const savedPositive = moneySaved >= 0;

  const thisMonthLogs = logs.filter((l) => isThisMonth(l.loggedAt));
  const avgPricePerL  = thisMonthLogs.length
    ? thisMonthLogs.reduce((a, l) => a + (Number(l.pricePerL) || 0), 0) / thisMonthLogs.length
    : null;

  // ── Fetch live price ──────────────────────────────────────────────────────
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

  useEffect(() => {
    if (!showRefuel) return;
    (async () => {
      const v = await userVehicleApi.get(userId);
      const resolved = v ?? vehicle;
      if (resolved) {
        setFreshVehicle(resolved);
        const topUp = Math.max(0, Number(resolved.tankMax) - Number(resolved.tankCurrent));
        setLiters(topUp > 0 ? topUp.toFixed(1) : "");
      }
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
    setLiters(""); setPricePerL(""); setOdometerKm(""); setNotes("");
    setLivePrice(null); setShowRefuel(false); setSavingLog(false);
  };

  const handleCalculate = async () => {
    if (!activeVehicle || !tripDistanceKm) return;
    setCalcLoading(true);
    try {
      const p = await fuelPriceApi.getCurrent(activeVehicle.fuelType);
      const litersNeeded  = fuelConsumedL(tripDistanceKm, activeVehicle.mileage);
      const estimatedCost = litersNeeded * p.pricePerLiter;
      const canComplete   = Number(activeVehicle.tankCurrent) >= litersNeeded;
      setTripCalc({ litersNeeded, estimatedCost, priceUsed: p.pricePerLiter, canComplete });
    } finally {
      setCalcLoading(false);
    }
  };

  // ── Render guard ──────────────────────────────────────────────────────────
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
    return unit === "imperial" ? `${litersToGal(v).toFixed(2)} gal` : `${v.toFixed(2)} L`;
  };

  const tankCurrent = Number(activeVehicle.tankCurrent) || 0;
  const tankMax     = Number(activeVehicle.tankMax)     || 0;

  // Goal display helpers
  const goalDisplay   = unit === "imperial"
    ? `${l100kmToMpg(consumptionGoal).toFixed(1)} MPG`
    : `${consumptionGoal.toFixed(1)} L/100km`;
  const goalUnit      = unit === "imperial" ? "MPG" : "L/100km";
  const meetingGoal   = actualL100km <= consumptionGoal && actualL100km > 0;
  const actualDisplay = fmtEfficiency(activeVehicle.mileage, unit);

  // Progress ratio for bar (L/100km: lower is better → bar fills as actual approaches goal)
  const progressPct = consumptionGoal > 0 && actualL100km > 0
    ? Math.min((actualL100km / consumptionGoal) * 100, 100)
    : 0;

  // Alert banner copy
  const alertCopy = alertLevel === "exceeded"
    ? {
        bg:   "bg-red-50 border-red-300",
        icon: <ShieldAlert size={15} className="text-red-500 shrink-0 mt-0.5" />,
        title: "Consumption goal exceeded",
        body: `Your vehicle is consuming ${actualL100km.toFixed(1)} L/100km, above your ${consumptionGoal.toFixed(1)} L/100km limit. Consider a tune-up or adjust driving habits.`,
        pill: "bg-red-100 text-red-700",
      }
    : alertLevel === "approaching"
    ? {
        bg:   "bg-amber-50 border-amber-300",
        icon: <AlertTriangle size={15} className="text-amber-500 shrink-0 mt-0.5" />,
        title: "Approaching consumption goal",
        body: `At ${actualL100km.toFixed(1)} L/100km you are ${(consumptionGoal - actualL100km).toFixed(2)} L/100km away from your goal of ${consumptionGoal.toFixed(1)} L/100km.`,
        pill: "bg-amber-100 text-amber-700",
      }
    : null;

  return (
    <div className="p-4 space-y-4 overflow-y-auto">

      {/* ── Goal alert banner ─────────────────────────────────────────── */}
      {alertCopy && !alertDismissed && (
        <div className={`rounded-xl border p-3 flex gap-2.5 ${alertCopy.bg}`}>
          {alertCopy.icon}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className={`text-xs px-2 py-0.5 rounded-full ${alertCopy.pill}`}>
                {alertCopy.title}
              </p>
              <button
                onClick={() => setAlertDismissed(true)}
                className="text-gray-400 hover:text-gray-600 shrink-0"
              >
                <X size={13} />
              </button>
            </div>
            <p className="text-xs text-gray-600 mt-1.5">{alertCopy.body}</p>
          </div>
        </div>
      )}

      {/* ── Tank gauge ────────────────────────────────────────────────── */}
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

      {/* ── Spend & savings stats ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-gray-50 rounded-xl p-3">
          <p className="text-xs text-gray-500">Money Spent (Yesterday)</p>
          <p className="text-gray-800 mt-1">{fmtPHP(totalSpentYday)}</p>
        </div>
        <div className="bg-blue-50 rounded-xl p-3">
          <p className="text-xs text-blue-500">Money Spent (Today)</p>
          <p className="text-blue-800 mt-1">{fmtPHP(totalSpentToday)}</p>
        </div>
        <div className={`rounded-xl p-3 col-span-2 flex items-center justify-between ${
          savedPositive ? "bg-green-50" : "bg-red-50"
        }`}>
          <div>
            <p className={`text-xs ${savedPositive ? "text-green-500" : "text-red-500"}`}>
              Money Saved
            </p>
            <p className={`mt-1 ${savedPositive ? "text-green-800" : "text-red-700"}`}>
              {savedPositive ? "" : "−"}{fmtPHP(Math.abs(moneySaved))}
            </p>
          </div>
          {savedPositive
            ? <TrendingDown size={18} className="text-green-400" />
            : <TrendingUp   size={18} className="text-red-400"   />}
        </div>
      </div>

      {/* ── Minimum Consumption Goal ──────────────────────────────────── */}
      <div className={`bg-white rounded-xl p-4 space-y-3 border-2 transition-colors ${
        alertLevel === "exceeded"   ? "border-red-300" :
        alertLevel === "approaching"? "border-amber-300" :
        "border-gray-200"
      }`}>
        {/* Header row */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500 flex items-center gap-1.5">
            <Target size={12} className="text-purple-500" />
            Minimum Consumption Goal
          </span>
          <div className="flex items-center gap-2">
            {/* Notification toggle */}
            {canUseNotifications() && (
              notifPermission === "granted" ? (
                <span
                  className="flex items-center gap-1 text-xs text-green-600"
                  title="Browser notifications enabled"
                >
                  <Bell size={12} /> Alerts on
                </span>
              ) : notifPermission === "denied" ? (
                <span
                  className="flex items-center gap-1 text-xs text-gray-400"
                  title="Notifications blocked in browser settings"
                >
                  <BellOff size={12} /> Blocked
                </span>
              ) : (
                <button
                  onClick={requestPermission}
                  className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800 border border-purple-200 rounded-full px-2 py-0.5 transition-colors"
                  title="Enable browser notifications for goal alerts"
                >
                  <Bell size={11} /> Enable alerts
                </button>
              )
            )}
            {!editingGoal && (
              <button
                onClick={startEditGoal}
                className="text-gray-400 hover:text-purple-600 transition-colors"
                title="Edit goal"
              >
                <Pencil size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Edit / display row */}
        {editingGoal ? (
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={goalInput}
              onChange={(e) => setGoalInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter")  saveGoal();
                if (e.key === "Escape") cancelGoal();
              }}
              min={0.1}
              step={0.1}
              autoFocus
              className="flex-1 border border-purple-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
            />
            <span className="text-xs text-gray-400 whitespace-nowrap">{goalUnit}</span>
            <button onClick={saveGoal}   className="text-green-600 hover:text-green-700" title="Save">
              <Check size={16} />
            </button>
            <button onClick={cancelGoal} className="text-gray-400 hover:text-red-500"    title="Cancel">
              <X size={16} />
            </button>
          </div>
        ) : (
          <div className="flex items-end justify-between">
            <p className="text-purple-700">{goalDisplay}</p>
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              alertLevel === "exceeded"    ? "bg-red-100 text-red-700" :
              alertLevel === "approaching" ? "bg-amber-100 text-amber-700" :
              meetingGoal                  ? "bg-green-100 text-green-700" :
                                             "bg-gray-100 text-gray-500"
            }`}>
              {alertLevel === "exceeded"    ? "⛽ Exceeded" :
               alertLevel === "approaching" ? "⚠ Approaching" :
               meetingGoal                  ? "✓ Goal met" :
                                              "No data"}
            </span>
          </div>
        )}

        {/* Progress bar */}
        {!editingGoal && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-gray-400">
              <span>Actual: {actualDisplay}</span>
              <span>Goal: {goalDisplay}</span>
            </div>
            {/* 
              Bar fills from left. At 0% = perfect efficiency, at 100% = goal hit.
              Warning zone: last 15% of bar turns amber; exceeded = red full bar.
            */}
            <div className="relative w-full h-2 bg-gray-100 rounded-full overflow-hidden">
              {/* Warning zone marker */}
              <div
                className="absolute top-0 bottom-0 bg-amber-100"
                style={{
                  left:  `${(1 - WARNING_ZONE_PCT) * 100}%`,
                  width: `${WARNING_ZONE_PCT * 100}%`,
                }}
              />
              {/* Actual fill */}
              <div
                className={`absolute top-0 left-0 h-full rounded-full transition-all duration-500 ${
                  alertLevel === "exceeded"    ? "bg-red-500" :
                  alertLevel === "approaching" ? "bg-amber-400" :
                  "bg-green-400"
                }`}
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-400">
              <span>Efficient</span>
              <span className="text-amber-400">▲ Warn zone</span>
              <span>Goal</span>
            </div>
            <p className="text-xs text-gray-400">
              {unit === "imperial"
                ? "Higher MPG = more efficient. Goal is the minimum MPG to achieve."
                : "Lower L/100km = more efficient. Goal is the max consumption allowed."}
            </p>
          </div>
        )}

        {/* Re-show dismissed alert link */}
        {alertLevel && alertDismissed && (
          <button
            onClick={() => setAlertDismissed(false)}
            className="w-full text-xs text-center text-gray-400 hover:text-gray-600 flex items-center justify-center gap-1"
          >
            <AlertTriangle size={11} />
            Show goal alert
          </button>
        )}
      </div>

      {/* ── Trip fuel estimate ───────────────────────────────────────── */}
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
                  <span className="text-gray-600">
                    ₱{Number(tripCalc.priceUsed).toFixed(2)}/L (GasWatch PH)
                  </span>
                </div>
                <div className={`rounded-lg px-3 py-2 text-xs flex items-center gap-1.5 ${
                  tripCalc.canComplete ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
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

      {/* ── Log Refuel ───────────────────────────────────────────────── */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <button
          onClick={() => setShowRefuel((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Plus size={14} className="text-green-600" />
            <span className="text-xs text-gray-600">Log Refuel</span>
          </div>
          {showRefuel
            ? <ChevronUp size={14} className="text-gray-400" />
            : <ChevronDown size={14} className="text-gray-400" />}
        </button>

        {showRefuel && (
          <div className="p-4 space-y-3">
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
                {livePrice.confidence === "scraped"  && <span className="ml-1 text-green-600">● live</span>}
                {livePrice.confidence === "fallback" && <span className="ml-1 text-orange-500">(GasWatch unreachable — last known)</span>}
                {livePrice.confidence === "mock"     && <span className="ml-1 text-orange-500">(mock — backend offline)</span>}
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

      {/* ── Refuel history ────────────────────────────────────────────── */}
      {logs.length > 0 && (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <button
            onClick={() => setShowLogs((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
          >
            <span className="text-xs text-gray-600">Refuel History ({logs.length})</span>
            {showLogs
              ? <ChevronUp size={14} className="text-gray-400" />
              : <ChevronDown size={14} className="text-gray-400" />}
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
                          {new Date(log.loggedAt).toLocaleDateString("en-PH", {
                            month: "short", day: "numeric", year: "numeric",
                          })}
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

      {/* suppress unused-var lint */}
      {avgPricePerL !== null && false && <span>{avgPricePerL}</span>}
    </div>
  );
}
