import { useState, useEffect, useRef } from "react";
import {
  Car, Search, SlidersHorizontal, Save, Edit2, Fuel,
  ChevronDown, Zap, CheckCircle,
} from "lucide-react";
import {
  userVehicleApi,
  type UserVehicle,
  type FuelType,
} from "../services/api";
import {
  fmtEfficiency,
  fmtVolume,
  efficiencyInputLabel,
  efficiencyInputHint,
  mpgToL100km,
  l100kmToMpg,
  DEFAULT_CONSUMPTION,
  type UnitSystem,
} from "../utils/fuelCalc";

// ─── NHTSA vPIC helpers (makes + models) ──────────────────────────────────────
const NHTSA = "https://vpic.nhtsa.dot.gov/api/vehicles";

async function fetchMakes(): Promise<string[]> {
  const res = await fetch(`${NHTSA}/GetMakesForVehicleType/car?format=json`);
  const data = await res.json();
  return (data.Results as { MakeName: string }[]).map((r) => r.MakeName).sort();
}

async function fetchModels(make: string, year: number): Promise<string[]> {
  const res = await fetch(
    `${NHTSA}/GetModelsForMakeYear/make/${encodeURIComponent(make)}/modelyear/${year}?format=json`
  );
  const data = await res.json();
  return (data.Results as { Model_Name: string }[]).map((r) => r.Model_Name).sort();
}

// ─── EPA Fuel Economy helpers (engine variants + fuel type) ───────────────────
const EPA = "https://fueleconomy.gov/ws/rest";

/** One engine variant returned by EPA's options endpoint */
interface EpaOption {
  text:  string; // e.g. "2.5L 4-cyl, Automatic (S8)"
  value: string; // EPA vehicle ID — used to fetch fuelType detail
}

/**
 * Fetch all available engine variants for a make / model / year combo.
 * Returns [] if EPA has no data (common for PH-market-only vehicles).
 * EPA quirk: single result comes back as an object, not an array.
 */
async function fetchEngineVariants(
  year: number, make: string, model: string
): Promise<EpaOption[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(
      `${EPA}/vehicle/menu/options?year=${year}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}`,
      { headers: { Accept: "application/json" }, signal: controller.signal }
    );
    clearTimeout(timer);
    if (!res.ok) return [];
    const data = await res.json();
    const raw = data.menuItem;
    if (!raw) return [];
    return Array.isArray(raw) ? raw : [raw];
  } catch {
    clearTimeout(timer);
    return [];
  }
}

/**
 * Fetch the fuel type string for a specific EPA vehicle ID,
 * then map it to our internal FuelType enum.
 */
async function fetchEpaFuelType(vehicleId: string): Promise<FuelType | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(`${EPA}/vehicle/${vehicleId}`, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    return mapEpaFuelType((data.fuelType1 as string) ?? "");
  } catch {
    clearTimeout(timer);
    return null;
  }
}

/** Map EPA's fuelType1 string → our FuelType */
function mapEpaFuelType(epaFuel: string): FuelType {
  const s = epaFuel.toLowerCase();
  if (s.includes("premium"))   return "premium";
  if (s.includes("diesel"))    return "diesel";
  if (s.includes("electric") || s.includes("electricity")) return "electric";
  if (s.includes("natural gas") || s.includes("lpg"))      return "lpg";
  return "gasoline"; // Regular Gasoline, Midgrade, E85 → default to gasoline
}

/**
 * Fallback: guess fuel type from the engine variant text when the
 * EPA detail fetch fails or times out.
 */
function guessFuelFromText(text: string): FuelType {
  const s = text.toLowerCase();
  if (s.includes("diesel") || s.includes("tdi") || s.includes("crdi") || s.includes("tdci"))
    return "diesel";
  if (s.includes("electric") || s.includes(" ev") || s.includes("bev"))
    return "electric";
  if (s.includes("premium"))
    return "premium";
  if (s.includes("lpg") || s.includes("autogas") || s.includes("natural gas"))
    return "lpg";
  return "gasoline";
}

// ─── Constants ────────────────────────────────────────────────────────────────
const FUEL_TYPES: { value: FuelType; label: string }[] = [
  { value: "gasoline", label: "Gasoline (Regular)"  },
  { value: "diesel",   label: "Diesel"              },
  { value: "premium",  label: "Gasoline (Premium)"  },
  { value: "lpg",      label: "LPG / Autogas"       },
  { value: "electric", label: "Electric"            },
];

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 35 }, (_, i) => CURRENT_YEAR - i);

// ─── Types ────────────────────────────────────────────────────────────────────
interface Props {
  userId: number;
  unit:   UnitSystem;
  onVehicleSaved: (v: UserVehicle) => void;
}

type EditMode = "search" | "manual";

const BLANK: Omit<UserVehicle, "userId"> = {
  make: "", model: "", year: CURRENT_YEAR, engineType: "",
  fuelType: "gasoline", mileage: DEFAULT_CONSUMPTION.gasoline,
  tankMax: 40, tankCurrent: 20, isManual: false,
};

// ─── Component ────────────────────────────────────────────────────────────────
export function VehicleProfile({ userId, unit, onVehicleSaved }: Props) {
  const [vehicle, setVehicle] = useState<UserVehicle | null>(null);
  const [editing, setEditing] = useState(false);
  const [mode,    setMode]    = useState<EditMode>("search");
  const [form,    setForm]    = useState({ ...BLANK });
  const [saving,  setSaving]  = useState(false);

  // ── NHTSA make autocomplete state ──────────────────────────────────────────
  const [makeQuery,     setMakeQuery]     = useState("");
  const [allMakes,      setAllMakes]      = useState<string[]>([]);
  const [makesLoading,  setMakesLoading]  = useState(false);
  const [models,        setModels]        = useState<string[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [showMakeDrop,  setShowMakeDrop]  = useState(false);
  const [confirmedMake, setConfirmedMake] = useState(""); // only set on dropdown pick
  const makeRef = useRef<HTMLDivElement>(null);

  // ── EPA engine variant state ────────────────────────────────────────────────
  const [engines,        setEngines]        = useState<EpaOption[]>([]);
  const [enginesLoading, setEnginesLoading] = useState(false);
  const [selectedEngId,  setSelectedEngId]  = useState("");
  const [fuelDetecting,  setFuelDetecting]  = useState(false);
  const [fuelAutoSet,    setFuelAutoSet]    = useState(false);

  // ── Efficiency input (unit-aware) ──────────────────────────────────────────
  const [effInput, setEffInput] = useState(
    unit === "imperial"
      ? String(l100kmToMpg(BLANK.mileage).toFixed(1))
      : String(BLANK.mileage)
  );

  // ── Load saved vehicle ─────────────────────────────────────────────────────
  useEffect(() => {
    userVehicleApi.get(userId).then((v) => {
      if (v) {
        setVehicle(v);
        onVehicleSaved(v); // notify parent so FuelTracker receives the vehicle immediately
      }
    });
  }, [userId]); // eslint-disable-line

  // ── Sync efficiency input when unit changes ────────────────────────────────
  useEffect(() => {
    if (vehicle && !editing) return;
    const l100km = Number(form.mileage) || 0;
    setEffInput(
      unit === "imperial" ? l100kmToMpg(l100km).toFixed(1) : l100km.toFixed(1)
    );
  }, [unit]); // eslint-disable-line

  // ── Close make dropdown on outside click ───────────────────────────────────
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (makeRef.current && !makeRef.current.contains(e.target as Node))
        setShowMakeDrop(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Load NHTSA models when make + year change ──────────────────────────────
  useEffect(() => {
    if (!confirmedMake || mode !== "search") return;
    setModelsLoading(true);
    setModels([]);
    fetchModels(confirmedMake, form.year)
      .then(setModels)
      .catch(() => setModels([]))
      .finally(() => setModelsLoading(false));
  }, [confirmedMake, form.year, mode]);

  // ── Load EPA engine variants when make + model + year change ──────────────
  useEffect(() => {
    if (!form.make || !form.model || mode !== "search") {
      setEngines([]);
      setSelectedEngId("");
      return;
    }
    setEngines([]);
    setSelectedEngId("");
    setFuelAutoSet(false);
    setEnginesLoading(true);
    fetchEngineVariants(form.year, form.make, form.model)
      .then(setEngines)
      .catch(() => setEngines([]))
      .finally(() => setEnginesLoading(false));
  }, [form.make, form.model, form.year, mode]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const loadMakes = async () => {
    if (allMakes.length > 0) return;
    setMakesLoading(true);
    try { setAllMakes(await fetchMakes()); }
    catch { /* fall back to manual */ }
    finally { setMakesLoading(false); }
  };

  const filteredMakes = allMakes.filter(
    (m) => makeQuery.length > 0 && m.toLowerCase().includes(makeQuery.toLowerCase())
  ).slice(0, 8);

  const handleEffChange = (raw: string) => {
    setEffInput(raw);
    const num = parseFloat(raw);
    if (!isNaN(num) && num > 0)
      setForm((f) => ({ ...f, mileage: unit === "imperial" ? mpgToL100km(num) : num }));
  };

  const applyFuelType = (ft: FuelType) => {
    const defaultL100km = DEFAULT_CONSUMPTION[ft] ?? 10;
    setForm((f) => ({ ...f, fuelType: ft, mileage: defaultL100km }));
    setEffInput(
      unit === "imperial" ? l100kmToMpg(defaultL100km).toFixed(1) : String(defaultL100km)
    );
  };

  const handleFuelTypeChange = (ft: FuelType) => {
    setFuelAutoSet(false);
    applyFuelType(ft);
  };

  /** Called when user picks an engine variant from the EPA dropdown */
  const handleEngineSelect = async (engineId: string, engineText: string) => {
    setSelectedEngId(engineId);
    setForm((f) => ({ ...f, engineType: engineText }));
    if (!engineId) return;

    // Try to get the exact fuel type from EPA
    setFuelDetecting(true);
    const ft = await fetchEpaFuelType(engineId);
    setFuelDetecting(false);

    if (ft) {
      applyFuelType(ft);
      setFuelAutoSet(true);
    } else {
      // Fallback: parse fuel type from the engine text string
      applyFuelType(guessFuelFromText(engineText));
      setFuelAutoSet(false);
    }
  };

  const startEdit = () => {
    if (vehicle) {
      // Coerce numeric fields — API/JSON can return them as strings
      const safe = {
        ...vehicle,
        mileage:     Number(vehicle.mileage)     || DEFAULT_CONSUMPTION[vehicle.fuelType] || 10,
        tankMax:     Number(vehicle.tankMax)     || 40,
        tankCurrent: Number(vehicle.tankCurrent) || 0,
        year:        Number(vehicle.year)        || CURRENT_YEAR,
      };
      setForm(safe);
      setEffInput(
        unit === "imperial"
          ? l100kmToMpg(safe.mileage).toFixed(1)
          : String(safe.mileage)
      );
      setMakeQuery(safe.make);
      setConfirmedMake(safe.make);
    } else {
      setForm({ ...BLANK });
      setEffInput(
        unit === "imperial"
          ? l100kmToMpg(BLANK.mileage).toFixed(1)
          : String(BLANK.mileage)
      );
      setMakeQuery("");
      setConfirmedMake("");
    }
    setSelectedEngId("");
    setFuelAutoSet(false);
    setEngines([]);
    setEditing(true);
  };

  const handleSave = async () => {
    if (!form.make || !form.model || !form.year) return;
    setSaving(true);
    const v = await userVehicleApi.save({ ...form, userId, isManual: mode === "manual" });
    setVehicle(v);
    onVehicleSaved(v);
    setEditing(false);
    setSaving(false);
  };

  // ── Display card (read-only) ───────────────────────────────────────────────
  if (!editing) {
    return (
      <div className="p-4 space-y-4">
        {vehicle ? (
          <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className="bg-blue-100 rounded-lg p-2">
                  <Car size={18} className="text-blue-600" />
                </div>
                <div>
                  <p className="text-gray-800 text-sm">
                    {vehicle.year} {vehicle.make} {vehicle.model}
                  </p>
                  <p className="text-gray-400 text-xs capitalize">
                    {vehicle.engineType || "—"}
                  </p>
                </div>
              </div>
              <button
                onClick={startEdit}
                className="text-gray-400 hover:text-blue-600 transition-colors"
              >
                <Edit2 size={15} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-gray-50 rounded-lg p-2">
                <p className="text-gray-400">Fuel Type</p>
                <p className="text-gray-700 capitalize mt-0.5">
                  {FUEL_TYPES.find((f) => f.value === vehicle.fuelType)?.label ?? vehicle.fuelType}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-2">
                <p className="text-gray-400">Fuel Economy</p>
                <p className="text-gray-700 mt-0.5">{fmtEfficiency(vehicle.mileage, unit)}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-2">
                <p className="text-gray-400">Tank Capacity</p>
                <p className="text-gray-700 mt-0.5">{fmtVolume(vehicle.tankMax, unit)}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-2">
                <p className="text-gray-400">Current Level</p>
                <p className="text-gray-700 mt-0.5">{fmtVolume(vehicle.tankCurrent, unit)}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-xl">
            <Car size={32} className="mx-auto text-gray-300 mb-2" />
            <p className="text-gray-500 text-sm">No vehicle set up yet</p>
            <p className="text-gray-400 text-xs mt-1">Add your vehicle to track fuel consumption</p>
          </div>
        )}

        <button
          onClick={startEdit}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm py-2 rounded-lg transition-colors"
        >
          {vehicle ? "Edit Vehicle" : "Set Up Vehicle"}
        </button>
      </div>
    );
  }

  // ── Edit form ──────────────────────────────────────────────────────────────
  // Derived: show text input for engine when EPA returns nothing
  const showEngineDropdown = mode === "search" && (enginesLoading || engines.length > 0);

  return (
    <div className="p-4 space-y-4">

      {/* Mode toggle */}
      <div className="flex bg-gray-100 rounded-lg p-1 gap-1">
        <button
          onClick={() => { setMode("search"); loadMakes(); }}
          className={`flex-1 flex items-center justify-center gap-1.5 text-xs py-1.5 rounded-md transition-all ${
            mode === "search" ? "bg-white shadow text-blue-700" : "text-gray-500"
          }`}
        >
          <Search size={12} /> NHTSA Search
        </button>
        <button
          onClick={() => setMode("manual")}
          className={`flex-1 flex items-center justify-center gap-1.5 text-xs py-1.5 rounded-md transition-all ${
            mode === "manual" ? "bg-white shadow text-blue-700" : "text-gray-500"
          }`}
        >
          <SlidersHorizontal size={12} /> Manual / Modded
        </button>
      </div>

      {/* Year */}
      <div>
        <label className="block text-xs text-gray-500 mb-1">Year</label>
        <div className="relative">
          <select
            value={form.year}
            onChange={(e) =>
              setForm((f) => ({ ...f, year: +e.target.value, model: "", engineType: "" }))
            }
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 appearance-none"
          >
            {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <ChevronDown size={14} className="absolute right-3 top-3 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* Make */}
      <div>
        <label className="block text-xs text-gray-500 mb-1">Make</label>
        {mode === "search" ? (
          <div className="relative" ref={makeRef}>
            <input
              value={makeQuery}
              onFocus={() => { setShowMakeDrop(true); loadMakes(); }}
              onChange={(e) => {
                setMakeQuery(e.target.value);
                // Do NOT set form.make yet — wait for dropdown selection.
                // Clear confirmed make so models dropdown resets.
                setConfirmedMake("");
                setForm((f) => ({ ...f, make: "", model: "", engineType: "" }));
                setModels([]);
                setEngines([]);
                setSelectedEngId("");
                setFuelAutoSet(false);
                setShowMakeDrop(true);
              }}
              onBlur={() => {
                // If user typed an exact match (case-insensitive), auto-confirm it
                setTimeout(() => {
                  const match = allMakes.find(
                    (m) => m.toLowerCase() === makeQuery.toLowerCase()
                  );
                  if (match && confirmedMake !== match) {
                    setConfirmedMake(match);
                    setForm((f) => ({ ...f, make: match, model: "", engineType: "" }));
                    setMakeQuery(match);
                  }
                  setShowMakeDrop(false);
                }, 150);
              }}
              placeholder={makesLoading ? "Loading makes…" : "Type manufacturer name…"}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            {showMakeDrop && filteredMakes.length > 0 && (
              <div className="absolute z-50 w-full border border-gray-200 rounded-lg mt-1 bg-white shadow-lg overflow-hidden">
                {filteredMakes.map((m) => (
                  <button
                    key={m}
                    onMouseDown={() => {
                      setConfirmedMake(m);
                      setForm((f) => ({ ...f, make: m, model: "", engineType: "" }));
                      setMakeQuery(m);
                      setShowMakeDrop(false);
                      setEngines([]);
                      setSelectedEngId("");
                      setFuelAutoSet(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 text-gray-700 border-b border-gray-100 last:border-b-0"
                  >
                    {m}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <input
            value={form.make}
            onChange={(e) => setForm((f) => ({ ...f, make: e.target.value }))}
            placeholder="e.g. Toyota"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        )}
      </div>

      {/* Model */}
      <div>
        <label className="block text-xs text-gray-500 mb-1">Model</label>
        {mode === "search" ? (
          <div className="relative">
            <select
              value={form.model}
              onChange={(e) =>
                setForm((f) => ({ ...f, model: e.target.value, engineType: "" }))
              }
              disabled={!form.make || modelsLoading}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50 appearance-none"
            >
              <option value="">
                {modelsLoading ? "Loading models…" : form.make ? "Select model" : "Select make first"}
              </option>
              {models.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-3 text-gray-400 pointer-events-none" />
          </div>
        ) : (
          <input
            value={form.model}
            onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
            placeholder="e.g. Vios, Fortuner, Hilux"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        )}
      </div>

      {/* Engine Type — EPA dropdown (search) or text input (manual / no data) */}
      <div>
        <label className="block text-xs text-gray-500 mb-1">
          Engine Type
          {mode === "search" && form.model && !enginesLoading && engines.length === 0 && (
            <span className="ml-1 text-amber-500">(not in EPA database — enter manually)</span>
          )}
        </label>

        {showEngineDropdown ? (
          <div className="relative">
            <select
              value={selectedEngId}
              onChange={(e) => {
                const opt = engines.find((en) => en.value === e.target.value);
                if (opt) {
                  handleEngineSelect(opt.value, opt.text);
                } else {
                  setSelectedEngId("");
                  setForm((f) => ({ ...f, engineType: "" }));
                  setFuelAutoSet(false);
                }
              }}
              disabled={enginesLoading}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50 appearance-none"
            >
              <option value="">
                {enginesLoading ? "Loading engine variants…" : "Select engine / trim"}
              </option>
              {engines.map((e) => (
                <option key={e.value} value={e.value}>{e.text}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-3 text-gray-400 pointer-events-none" />
          </div>
        ) : (
          <input
            value={form.engineType}
            onChange={(e) => setForm((f) => ({ ...f, engineType: e.target.value }))}
            placeholder={
              mode === "search" && !form.model
                ? "Select model first"
                : "e.g. 1.5L DOHC, 2.4L Diesel"
            }
            disabled={mode === "search" && (!form.model || enginesLoading)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50"
          />
        )}
      </div>

      {/* Fuel Type — auto-matched when engine is picked from EPA */}
      <div>
        <label className="flex items-center gap-1 text-xs text-gray-500 mb-1">
          <Fuel size={11} />
          Fuel Type
          {fuelDetecting && (
            <span className="ml-1 flex items-center gap-1 text-blue-500">
              <span className="w-2.5 h-2.5 rounded-full border-2 border-blue-400 border-t-transparent animate-spin inline-block" />
              detecting…
            </span>
          )}
          {fuelAutoSet && !fuelDetecting && (
            <span className="ml-1 flex items-center gap-0.5 text-green-600">
              <CheckCircle size={11} />
              auto-detected
            </span>
          )}
          {!fuelAutoSet && !fuelDetecting && selectedEngId && (
            <span className="ml-1 text-amber-500 flex items-center gap-0.5">
              <Zap size={11} />
              guessed — verify below
            </span>
          )}
        </label>
        <div className="relative">
          <select
            value={form.fuelType}
            onChange={(e) => handleFuelTypeChange(e.target.value as FuelType)}
            disabled={fuelDetecting}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 appearance-none disabled:opacity-50"
          >
            {FUEL_TYPES.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
          <ChevronDown size={14} className="absolute right-3 top-3 text-gray-400 pointer-events-none" />
        </div>
        {fuelAutoSet && (
          <p className="text-xs text-green-600 mt-0.5">
            Matched from EPA data · You can still change it manually
          </p>
        )}
      </div>

      {/* Fuel Economy */}
      {form.fuelType !== "electric" && (
        <div>
          <label className="block text-xs text-gray-500 mb-1">{efficiencyInputLabel(unit)}</label>
          <input
            type="number"
            value={effInput}
            onChange={(e) => handleEffChange(e.target.value)}
            min={0}
            step={0.1}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <p className="text-xs text-gray-400 mt-0.5">{efficiencyInputHint(unit)} · City average</p>
        </div>
      )}

      {/* Tank capacity */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Tank Capacity (L)</label>
          <input
            type="number"
            value={form.tankMax}
            onChange={(e) => setForm((f) => ({ ...f, tankMax: +e.target.value }))}
            min={1}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Current Level (L)</label>
          <input
            type="number"
            value={form.tankCurrent}
            onChange={(e) =>
              setForm((f) => ({ ...f, tankCurrent: Math.min(+e.target.value, form.tankMax) }))
            }
            min={0}
            max={form.tankMax}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={() => setEditing(false)}
          className="flex-1 border border-gray-200 text-gray-600 text-sm py-2 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={!form.make || !form.model || saving}
          className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm py-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors"
        >
          {saving ? (
            <div className="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
          ) : (
            <Save size={13} />
          )}
          Save Vehicle
        </button>
      </div>
    </div>
  );
}