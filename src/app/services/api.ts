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

// ─── Fallback mock data (used when backend is unreachable) ────────────────────

const MOCK_ROUTES: Route[] = [
  {
    id: 1,
    name: "Urgello to Parkmall",
    designation: "01K",
    startPoint: "Urgello",
    endPoint: "Parkmall",
    fare: 13,
    type: "jeepney",
    waypoints: [
      [10.2950, 123.8900], [10.2937, 123.9009], [10.3000, 123.9060],
      [10.3116, 123.9185], [10.3350, 123.9280], [10.3517, 123.9358],
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
      [10.2922, 123.9012], [10.2937, 123.9009], [10.3050, 123.8960],
      [10.3150, 123.9000], [10.3116, 123.9185],
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
      [10.2922, 123.9012], [10.2937, 123.9009], [10.3050, 123.8960],
      [10.3185, 123.9054], [10.3277, 123.9055], [10.3450, 123.9080],
      [10.3671, 123.9103],
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
      [10.2700, 123.8750], [10.2800, 123.8830], [10.2900, 123.8880],
      [10.2950, 123.8900], [10.2937, 123.9009], [10.2922, 123.9012],
    ],
  },
  {
    id: 5,
    name: "South Terminal to North Terminal",
    designation: "B-01",
    startPoint: "South Bus Terminal",
    endPoint: "North Bus Terminal",
    fare: 25,
    type: "bus",
    waypoints: [
      [10.2803, 123.8827], [10.2980, 123.8930], [10.3100, 123.8940],
      [10.3185, 123.9054], [10.3400, 123.9100], [10.3550, 123.9108],
    ],
  },
  {
    id: 6,
    name: "Ayala to Mactan Airport",
    designation: "B-02",
    startPoint: "Ayala Center Cebu",
    endPoint: "Mactan Airport",
    fare: 35,
    type: "bus",
    waypoints: [
      [10.3185, 123.9054], [10.3116, 123.9185], [10.3300, 123.9270],
      [10.3200, 123.9500], [10.3074, 123.9797],
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
  { id: 1, driverId: 1, routeId: 1, type: "jeepney", plateNo: "ABC-1234", seatsTotal: 16, seatsOccupied:  9, lat: 10.3000, lng: 123.9060 },
  { id: 2, driverId: 2, routeId: 2, type: "jeepney", plateNo: "DEF-5678", seatsTotal: 16, seatsOccupied:  3, lat: 10.2980, lng: 123.9020 },
  { id: 3, driverId: 3, routeId: 3, type: "jeepney", plateNo: "GHI-9012", seatsTotal: 16, seatsOccupied: 12, lat: 10.3185, lng: 123.9054 },
  { id: 4, driverId: 1, routeId: 4, type: "jeepney", plateNo: "JKL-3456", seatsTotal: 16, seatsOccupied:  7, lat: 10.2850, lng: 123.8850 },
  { id: 5, driverId: 2, routeId: 5, type: "bus",     plateNo: "BUS-0001", seatsTotal: 50, seatsOccupied: 35, lat: 10.3100, lng: 123.8940 },
  { id: 6, driverId: 3, routeId: 6, type: "bus",     plateNo: "BUS-0002", seatsTotal: 50, seatsOccupied: 28, lat: 10.3200, lng: 123.9400 },
];

// ─── Fetch helper ─────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json();
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