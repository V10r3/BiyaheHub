/**
 * API Service Layer — connects to the local Express + MySQL backend
 *
 * Backend lives in /backend/  →  run:
 *   cd backend && npm install && cp .env.example .env
 *   (edit .env with your MySQL credentials)
 *   npm run dev
 *
 * The backend will start on http://localhost:3001
 */

export const BASE_URL = "http://localhost:3001/api";

// ─── Types ────────────────────────────────────────────────────────────────────

export type AccountType = "puvpuj" | "private" | "commuter";

export interface User {
  id: number;
  name: string;
  email: string;
  accountType: AccountType;
}

export interface Route {
  id: number;
  name: string;
  designation: string;
  startPoint: string;
  endPoint: string;
  fare: number;
  type: "jeepney" | "bus" | "taxi" | "train";
  waypoints: [number, number][];
}

export interface Vehicle {
  id: number;
  driverId: number;
  routeId: number;
  type: "jeepney" | "bus" | "taxi";
  plateNo: string;
  seatsTotal: number;
  seatsOccupied: number;
  lat: number;
  lng: number;
}

export interface TrafficSegment {
  id: number;
  name: string;
  level: "clear" | "moderate" | "heavy";
  latStart: number;
  lngStart: number;
  latEnd: number;
  lngEnd: number;
}

// ─── Driver vehicle / fuel types ──────────────────────────────────────────────

export type FuelType = "gasoline" | "diesel" | "premium" | "lpg" | "electric";

export interface UserVehicle {
  id?: number;
  userId: number;
  make: string;
  model: string;
  year: number;
  engineType: string;
  fuelType: FuelType;
  mileage: number;    // L/100km city average
  tankMax: number;    // liters
  tankCurrent: number;// liters
  isManual: boolean;
}

export interface FuelLog {
  id?: number;
  userId: number;
  litersAdded: number;
  pricePerL: number;
  totalCost: number;
  odometerKm?: number;
  notes?: string;
  loggedAt?: string;
}

export interface FuelPrice {
  fuelType: string;
  pricePerLiter: number;
  effectiveDate: string;
  lastUpdated: string;
  confidence: string;
  source?: string;
}

// ─── Fallback mock data (used when backend is unreachable) ────────────────────

const MOCK_ROUTES: Route[] = [
  // ── Jeepney Routes ─────────────────────────────────────────────────────────
  {
    id: 1,
    name: "Urgello to Parkmall",
    designation: "01K",
    startPoint: "Urgello",
    endPoint: "Parkmall",
    fare: 13,
    type: "jeepney",
    waypoints: [
      [10.2950, 123.8900], [10.2975, 123.8918], [10.3005, 123.8933],
      [10.3050, 123.8940], [10.3090, 123.8940], [10.3105, 123.8947],
      [10.3122, 123.8972], [10.3140, 123.9005], [10.3160, 123.9038],
      [10.3185, 123.9054], [10.3220, 123.9080], [10.3270, 123.9115],
      [10.3320, 123.9185], [10.3400, 123.9275], [10.3460, 123.9320],
      [10.3517, 123.9358],
    ],
  },
  {
    id: 2,
    name: "Carbon to SM City",
    designation: "04C",
    startPoint: "Carbon Market",
    endPoint: "SM City Cebu",
    fare: 13,
    type: "jeepney",
    waypoints: [
      [10.2922, 123.9012], [10.2940, 123.9018], [10.2960, 123.9022],
      [10.2985, 123.9030], [10.3010, 123.9050], [10.3040, 123.9075],
      [10.3065, 123.9100], [10.3085, 123.9135], [10.3100, 123.9160],
      [10.3116, 123.9185],
    ],
  },
  {
    id: 3,
    name: "Carbon to Talamban",
    designation: "17B",
    startPoint: "Carbon Market",
    endPoint: "Talamban",
    fare: 15,
    type: "jeepney",
    waypoints: [
      [10.2922, 123.9012], [10.2940, 123.9015], [10.2965, 123.9010],
      [10.3000, 123.8990], [10.3045, 123.8968], [10.3100, 123.8958],
      [10.3155, 123.8958], [10.3200, 123.8985], [10.3250, 123.9018],
      [10.3290, 123.9030], [10.3350, 123.9048], [10.3410, 123.9068],
      [10.3480, 123.9085], [10.3580, 123.9098], [10.3671, 123.9103],
    ],
  },
  {
    id: 4,
    name: "Bulacao to Carbon",
    designation: "10C",
    startPoint: "Bulacao",
    endPoint: "Carbon Market",
    fare: 13,
    type: "jeepney",
    waypoints: [
      [10.2700, 123.8750], [10.2728, 123.8768], [10.2758, 123.8795],
      [10.2790, 123.8820], [10.2820, 123.8843], [10.2852, 123.8858],
      [10.2878, 123.8868], [10.2903, 123.8878], [10.2922, 123.8895],
      [10.2930, 123.8925], [10.2933, 123.8960], [10.2937, 123.9009],
      [10.2922, 123.9012],
    ],
  },
  {
    id: 5,
    name: "Talisay to Carbon",
    designation: "06H",
    startPoint: "Talisay City",
    endPoint: "Carbon Market",
    fare: 17,
    type: "jeepney",
    waypoints: [
      [10.2444, 123.8456], [10.2490, 123.8498], [10.2535, 123.8535],
      [10.2575, 123.8572], [10.2615, 123.8612], [10.2653, 123.8650],
      [10.2692, 123.8693], [10.2730, 123.8728], [10.2763, 123.8768],
      [10.2797, 123.8808], [10.2820, 123.8832], [10.2855, 123.8855],
      [10.2882, 123.8868], [10.2905, 123.8878], [10.2930, 123.8930],
      [10.2933, 123.8975], [10.2937, 123.9009], [10.2922, 123.9012],
    ],
  },
  {
    id: 6,
    name: "Talamban to SM City",
    designation: "02B",
    startPoint: "Talamban",
    endPoint: "SM City Cebu",
    fare: 15,
    type: "jeepney",
    waypoints: [
      [10.3671, 123.9103], [10.3580, 123.9098], [10.3480, 123.9085],
      [10.3410, 123.9068], [10.3350, 123.9048], [10.3290, 123.9030],
      [10.3250, 123.9018], [10.3200, 123.8985], [10.3155, 123.8958],
      [10.3140, 123.8985], [10.3155, 123.9015], [10.3175, 123.9050],
      [10.3116, 123.9185],
    ],
  },
  {
    id: 7,
    name: "Mandaue to Carbon",
    designation: "11B",
    startPoint: "Mandaue City",
    endPoint: "Carbon Market",
    fare: 17,
    type: "jeepney",
    waypoints: [
      [10.3236, 123.9448], [10.3290, 123.9418], [10.3360, 123.9388],
      [10.3430, 123.9368], [10.3517, 123.9358], [10.3455, 123.9305],
      [10.3385, 123.9255], [10.3310, 123.9205], [10.3230, 123.9160],
      [10.3185, 123.9054], [10.3145, 123.9010], [10.3105, 123.8965],
      [10.3060, 123.8958], [10.3010, 123.8968], [10.2968, 123.8985],
      [10.2945, 123.8998], [10.2937, 123.9009], [10.2922, 123.9012],
    ],
  },
  {
    id: 8,
    name: "IT Park to Carbon",
    designation: "17C",
    startPoint: "Cebu IT Park",
    endPoint: "Carbon Market",
    fare: 13,
    type: "jeepney",
    waypoints: [
      [10.3277, 123.9055], [10.3242, 123.9055], [10.3205, 123.9050],
      [10.3170, 123.9042], [10.3140, 123.9018], [10.3115, 123.8988],
      [10.3090, 123.8962], [10.3060, 123.8958], [10.3030, 123.8958],
      [10.3000, 123.8960], [10.2975, 123.8968], [10.2958, 123.8982],
      [10.2945, 123.8998], [10.2937, 123.9009], [10.2922, 123.9012],
    ],
  },
  {
    id: 9,
    name: "Banilad to Carbon",
    designation: "22G",
    startPoint: "Banilad",
    endPoint: "Carbon Market",
    fare: 15,
    type: "jeepney",
    waypoints: [
      [10.3373, 123.9000], [10.3335, 123.8992], [10.3295, 123.8985],
      [10.3255, 123.8980], [10.3215, 123.8975], [10.3178, 123.8967],
      [10.3145, 123.8958], [10.3110, 123.8950], [10.3075, 123.8948],
      [10.3040, 123.8948], [10.3010, 123.8952], [10.2980, 123.8960],
      [10.2958, 123.8972], [10.2945, 123.8988], [10.2937, 123.9009],
      [10.2922, 123.9012],
    ],
  },
  {
    id: 10,
    name: "Basak to Carbon",
    designation: "42C",
    startPoint: "Basak",
    endPoint: "Carbon Market",
    fare: 13,
    type: "jeepney",
    waypoints: [
      [10.2833, 123.8867], [10.2845, 123.8882], [10.2856, 123.8900],
      [10.2868, 123.8920], [10.2879, 123.8940], [10.2892, 123.8958],
      [10.2905, 123.8972], [10.2918, 123.8990], [10.2928, 123.9002],
      [10.2937, 123.9009], [10.2922, 123.9012],
    ],
  },
  {
    id: 11,
    name: "Mambaling to Colon",
    designation: "62C",
    startPoint: "Mambaling",
    endPoint: "Colon Street",
    fare: 13,
    type: "jeepney",
    waypoints: [
      [10.2700, 123.8900], [10.2718, 123.8910], [10.2740, 123.8922],
      [10.2763, 123.8935], [10.2790, 123.8950], [10.2818, 123.8965],
      [10.2845, 123.8978], [10.2868, 123.8990], [10.2893, 123.9000],
      [10.2918, 123.9006], [10.2937, 123.9009],
    ],
  },
  {
    id: 12,
    name: "Punta Princesa to Carbon",
    designation: "04G",
    startPoint: "Punta Princesa",
    endPoint: "Carbon Market",
    fare: 13,
    type: "jeepney",
    waypoints: [
      [10.3011, 123.8756], [10.3012, 123.8792], [10.3014, 123.8835],
      [10.3016, 123.8875], [10.3018, 123.8912], [10.3020, 123.8942],
      [10.2998, 123.8958], [10.2975, 123.8970], [10.2955, 123.8982],
      [10.2942, 123.8998], [10.2937, 123.9009], [10.2922, 123.9012],
    ],
  },
  // ── Bus Routes ──────────────────────────────────────────────────────────────
  {
    id: 13,
    name: "South Terminal to North Terminal",
    designation: "B-01",
    startPoint: "South Bus Terminal",
    endPoint: "North Bus Terminal",
    fare: 25,
    type: "bus",
    waypoints: [
      [10.2803, 123.8827], [10.2838, 123.8840], [10.2872, 123.8853],
      [10.2908, 123.8867], [10.2945, 123.8885], [10.2978, 123.8902],
      [10.3012, 123.8918], [10.3048, 123.8935], [10.3088, 123.8942],
      [10.3118, 123.8958], [10.3148, 123.8972], [10.3178, 123.9010],
      [10.3200, 123.9045], [10.3250, 123.9072], [10.3340, 123.9095],
      [10.3440, 123.9102], [10.3550, 123.9108],
    ],
  },
  {
    id: 14,
    name: "Ayala to Mactan Airport",
    designation: "B-02",
    startPoint: "Ayala Center Cebu",
    endPoint: "Mactan Airport",
    fare: 35,
    type: "bus",
    waypoints: [
      [10.3185, 123.9054], [10.3165, 123.9082], [10.3145, 123.9128],
      [10.3125, 123.9180], [10.3190, 123.9240], [10.3275, 123.9270],
      [10.3240, 123.9355], [10.3200, 123.9440], [10.3155, 123.9520],
      [10.3110, 123.9610], [10.3085, 123.9690], [10.3074, 123.9755],
      [10.3074, 123.9797],
    ],
  },
  {
    id: 15,
    name: "North Terminal to Mandaue",
    designation: "B-03",
    startPoint: "North Bus Terminal",
    endPoint: "Mandaue City",
    fare: 20,
    type: "bus",
    waypoints: [
      [10.3550, 123.9108], [10.3542, 123.9152], [10.3533, 123.9205],
      [10.3524, 123.9258], [10.3517, 123.9305], [10.3488, 123.9338],
      [10.3455, 123.9355], [10.3418, 123.9368], [10.3382, 123.9390],
      [10.3345, 123.9412], [10.3305, 123.9430], [10.3268, 123.9442],
      [10.3236, 123.9448],
    ],
  },
];

const MOCK_TRAFFIC: TrafficSegment[] = [
  { id: 1, name: "Colon Street",      level: "heavy",    latStart: 10.2922, lngStart: 123.9000, latEnd: 10.2980, lngEnd: 123.9030 },
  { id: 2, name: "Osmeña Blvd",       level: "moderate", latStart: 10.2980, lngStart: 123.8930, latEnd: 10.3100, lngEnd: 123.8950 },
  { id: 3, name: "N. Bacalso Ave",    level: "clear",    latStart: 10.2700, lngStart: 123.8750, latEnd: 10.2900, lngEnd: 123.8880 },
  { id: 4, name: "Jones Avenue",      level: "moderate", latStart: 10.2950, lngStart: 123.8960, latEnd: 10.3185, lngEnd: 123.9054 },
  { id: 5, name: "N. Escario Street", level: "clear",    latStart: 10.3000, lngStart: 123.9060, latEnd: 10.3116, lngEnd: 123.9185 },
  { id: 6, name: "Mandaue Bridge",    level: "heavy",    latStart: 10.3300, lngStart: 123.9270, latEnd: 10.3400, lngEnd: 123.9350 },
];

const MOCK_VEHICLES: Vehicle[] = [
  { id:  1, driverId: 1, routeId:  1, type: "jeepney", plateNo: "ABC-1234", seatsTotal: 16, seatsOccupied:  9, lat: 10.3000, lng: 123.9060 },
  { id:  2, driverId: 2, routeId:  2, type: "jeepney", plateNo: "DEF-5678", seatsTotal: 16, seatsOccupied:  3, lat: 10.2980, lng: 123.9020 },
  { id:  3, driverId: 3, routeId:  3, type: "jeepney", plateNo: "GHI-9012", seatsTotal: 16, seatsOccupied: 12, lat: 10.3185, lng: 123.9054 },
  { id:  4, driverId: 1, routeId:  4, type: "jeepney", plateNo: "JKL-3456", seatsTotal: 16, seatsOccupied:  7, lat: 10.2850, lng: 123.8850 },
  { id:  5, driverId: 2, routeId:  5, type: "jeepney", plateNo: "MNO-7890", seatsTotal: 16, seatsOccupied: 14, lat: 10.2650, lng: 123.8680 },
  { id:  6, driverId: 3, routeId:  6, type: "jeepney", plateNo: "PQR-1234", seatsTotal: 16, seatsOccupied:  5, lat: 10.3450, lng: 123.9080 },
  { id:  7, driverId: 1, routeId:  7, type: "jeepney", plateNo: "STU-5678", seatsTotal: 16, seatsOccupied: 11, lat: 10.3300, lng: 123.9350 },
  { id:  8, driverId: 2, routeId:  8, type: "jeepney", plateNo: "VWX-9012", seatsTotal: 16, seatsOccupied:  6, lat: 10.3185, lng: 123.9054 },
  { id:  9, driverId: 3, routeId:  9, type: "jeepney", plateNo: "YZA-3456", seatsTotal: 16, seatsOccupied:  8, lat: 10.3261, lng: 123.8978 },
  { id: 10, driverId: 1, routeId: 10, type: "jeepney", plateNo: "BCD-7890", seatsTotal: 16, seatsOccupied:  2, lat: 10.2833, lng: 123.8867 },
  { id: 11, driverId: 2, routeId: 11, type: "jeepney", plateNo: "EFG-1234", seatsTotal: 16, seatsOccupied: 10, lat: 10.2750, lng: 123.8930 },
  { id: 12, driverId: 3, routeId: 12, type: "jeepney", plateNo: "HIJ-5678", seatsTotal: 16, seatsOccupied:  4, lat: 10.3011, lng: 123.8820 },
  { id: 13, driverId: 1, routeId: 13, type: "bus",     plateNo: "BUS-0001", seatsTotal: 50, seatsOccupied: 35, lat: 10.3100, lng: 123.8940 },
  { id: 14, driverId: 2, routeId: 14, type: "bus",     plateNo: "BUS-0002", seatsTotal: 50, seatsOccupied: 28, lat: 10.3200, lng: 123.9400 },
  { id: 15, driverId: 3, routeId: 15, type: "bus",     plateNo: "BUS-0003", seatsTotal: 50, seatsOccupied: 19, lat: 10.3517, lng: 123.9358 },
];

// ─── Fetch helper ─────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  // Abort after 2.5 s so the preview never hangs waiting for a backend
  // that isn't running — it falls straight through to the mock-data layer.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2500);

  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: { "Content-Type": "application/json" },
      ...options,
      signal: controller.signal, // placed after spread so it always wins
    });
    clearTimeout(timer);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? `HTTP ${res.status}`);
    }
    return res.json();
  } catch (err) {
    clearTimeout(timer);
    // Normalise abort/timeout into TypeError so isNetworkError() catches it
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new TypeError("Request timed out — backend unreachable");
    }
    throw err;
  }
}

/** Returns true when the error is a network failure (backend unreachable),
 *  false when the backend responded with an HTTP error (4xx / 5xx). */
function isNetworkError(err: unknown): boolean {
  return err instanceof TypeError;
}

/** Logs a consistent fallback warning with the actual reason. */
function warnFallback(resource: string, err: unknown): void {
  const reason = isNetworkError(err)
    ? "backend unreachable (is the server running?)"
    : `backend error — ${(err as Error).message}`;
  console.info(`[API] Using mock ${resource}: ${reason}`);
}

// ─── Auth API ─────────────────────────────────────────────────────────────────

export const authApi = {
  async login(email: string, password: string): Promise<User> {
    try {
      return await apiFetch<User>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
    } catch (err) {
      if (!isNetworkError(err)) throw err;
      warnFallback("login", err);
      const accountType: AccountType =
        email.startsWith("puvpuj") ? "puvpuj" :
        email.startsWith("private") ? "private" : "commuter";
      return { id: 1, name: email.split("@")[0], email, accountType };
    }
  },

  async register(name: string, email: string, password: string, accountType: AccountType): Promise<User> {
    try {
      return await apiFetch<User>("/auth/register", {
        method: "POST",
        body: JSON.stringify({ name, email, password, accountType }),
      });
    } catch (err) {
      if (!isNetworkError(err)) throw err;
      warnFallback("register", err);
      return { id: Date.now(), name, email, accountType };
    }
  },
};

// ─── Routes API ───────────────────────────────────────────────────────────────

export const routesApi = {
  async getAll(): Promise<Route[]> {
    try {
      return await apiFetch<Route[]>("/routes");
    } catch (err) {
      warnFallback("routes", err);
      return MOCK_ROUTES;
    }
  },

  async getByType(type: Route["type"]): Promise<Route[]> {
    try {
      return await apiFetch<Route[]>(`/routes/${type}`);
    } catch (err) {
      warnFallback("routes", err);
      return MOCK_ROUTES.filter((r) => r.type === type);
    }
  },
};

// ─── Traffic API ──────────────────────────────────────────────────────────────

export const trafficApi = {
  async getCurrent(): Promise<TrafficSegment[]> {
    try {
      return await apiFetch<TrafficSegment[]>("/traffic");
    } catch (err) {
      warnFallback("traffic", err);
      return MOCK_TRAFFIC;
    }
  },
};

// ─── Vehicles API ─────────────────────────────────────────────────────────────

export const vehiclesApi = {
  async getAll(): Promise<Vehicle[]> {
    try {
      return await apiFetch<Vehicle[]>("/vehicles");
    } catch (err) {
      warnFallback("vehicles", err);
      return MOCK_VEHICLES;
    }
  },

  async updateSeats(vehicleId: number, seatsOccupied: number): Promise<void> {
    try {
      await apiFetch(`/vehicles/${vehicleId}/seats`, {
        method: "PUT",
        body: JSON.stringify({ seatsOccupied }),
      });
    } catch (err) {
      warnFallback("seat update", err);
    }
  },

  async updateLocation(vehicleId: number, lat: number, lng: number): Promise<void> {
    try {
      await apiFetch(`/vehicles/${vehicleId}/location`, {
        method: "PUT",
        body: JSON.stringify({ lat, lng }),
      });
    } catch (err) {
      warnFallback("location update", err);
    }
  },
};

// ─── User Vehicle API ─────────────────────────────────────────────────────────

export const userVehicleApi = {
  async get(userId: number): Promise<UserVehicle | null> {
    try {
      return await apiFetch<UserVehicle | null>(`/user-vehicle?userId=${userId}`);
    } catch (err) {
      warnFallback("user vehicle", err);
      return null;
    }
  },

  async save(vehicle: UserVehicle): Promise<UserVehicle> {
    try {
      return await apiFetch<UserVehicle>("/user-vehicle", {
        method: "PUT",
        body: JSON.stringify(vehicle),
      });
    } catch (err) {
      warnFallback("vehicle save", err);
      return vehicle;
    }
  },
};

// ─── Fuel Logs API ────────────────────────────────────────────────────────────

export const fuelLogsApi = {
  async getAll(userId: number): Promise<FuelLog[]> {
    try {
      return await apiFetch<FuelLog[]>(`/user-vehicle/fuel-logs?userId=${userId}`);
    } catch (err) {
      warnFallback("fuel logs", err);
      return [];
    }
  },

  async add(log: FuelLog): Promise<FuelLog> {
    try {
      return await apiFetch<FuelLog>("/user-vehicle/fuel-logs", {
        method: "POST",
        body: JSON.stringify(log),
      });
    } catch (err) {
      warnFallback("fuel log add", err);
      return { ...log, id: Date.now(), loggedAt: new Date().toISOString() };
    }
  },
};

// ─── Fuel Price API ───────────────────────────────────────────────────────────
// Fetches Philippine pump prices.
// TODO: Replace the stub below with the real DOE/RDAC endpoint once available.
//   Possible endpoint: https://www.doe.gov.ph/price-monitoring (no public REST API yet)
//   RDAC dataset: https://data.gov.ph/index/public/dataset/doe-fuel-prices

const MOCK_FUEL_PRICES: Record<string, FuelPrice> = {
  gasoline: { fuelType: "Gasoline",       pricePerLiter: 67.50, effectiveDate: "2026-04-14", lastUpdated: "2026-04-21T08:00:00+08:00", confidence: "mock" },
  diesel:   { fuelType: "Diesel",         pricePerLiter: 57.30, effectiveDate: "2026-04-14", lastUpdated: "2026-04-21T08:00:00+08:00", confidence: "mock" },
  premium:  { fuelType: "Premium Gasoline", pricePerLiter: 72.80, effectiveDate: "2026-04-14", lastUpdated: "2026-04-21T08:00:00+08:00", confidence: "mock" },
  lpg:      { fuelType: "LPG",            pricePerLiter: 52.00, effectiveDate: "2026-04-14", lastUpdated: "2026-04-21T08:00:00+08:00", confidence: "mock" },
  electric: { fuelType: "Electric",       pricePerLiter: 0,     effectiveDate: "2026-04-14", lastUpdated: "2026-04-21T08:00:00+08:00", confidence: "mock" },
};

export const fuelPriceApi = {
  async getCurrent(fuelType: FuelType): Promise<FuelPrice> {
    try {
      const ctrl  = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 2500);
      const res   = await fetch(`${BASE_URL}/fuel-prices/${fuelType}`, {
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return {
        fuelType:      data.fuelType,
        pricePerLiter: Number(data.pricePerLiter),
        effectiveDate: data.effectiveDate,
        lastUpdated:   data.lastUpdated,
        confidence:    data.confidence,
        source:        data.source,
      };
    } catch {
      return MOCK_FUEL_PRICES[fuelType] ?? MOCK_FUEL_PRICES.gasoline;
    }
  },
};