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
    waypoints: [[10.295, 123.89], [10.3, 123.895], [10.305, 123.9], [10.31, 123.905]],
  },
  {
    id: 2,
    name: "Carbon to SM Cebu",
    designation: "04C",
    startPoint: "Carbon Market",
    endPoint: "SM City Cebu",
    fare: 13,
    type: "jeepney",
    waypoints: [[10.291, 123.901], [10.295, 123.905], [10.3, 123.908], [10.308, 123.91]],
  },
  {
    id: 3,
    name: "South Terminal to North Terminal",
    designation: "B-01",
    startPoint: "South Bus Terminal",
    endPoint: "North Bus Terminal",
    fare: 25,
    type: "bus",
    waypoints: [[10.28, 123.88], [10.29, 123.89], [10.3, 123.9], [10.32, 123.905]],
  },
];

const MOCK_TRAFFIC: TrafficSegment[] = [
  { id: 1, name: "Colon Street",   level: "heavy",    latStart: 10.294, lngStart: 123.9,   latEnd: 10.298, lngEnd: 123.903 },
  { id: 2, name: "Osmeña Blvd",    level: "moderate", latStart: 10.298, lngStart: 123.893, latEnd: 10.308, lngEnd: 123.895 },
  { id: 3, name: "N. Bacalso Ave", level: "clear",    latStart: 10.28,  lngStart: 123.885, latEnd: 10.29,  lngEnd: 123.888 },
];

const MOCK_VEHICLES: Vehicle[] = [
  { id: 1, driverId: 1, routeId: 1, type: "jeepney", plateNo: "ABC-1234", seatsTotal: 16, seatsOccupied: 9,  lat: 10.297, lng: 123.892 },
  { id: 2, driverId: 2, routeId: 2, type: "jeepney", plateNo: "DEF-5678", seatsTotal: 16, seatsOccupied: 3,  lat: 10.293, lng: 123.903 },
  { id: 3, driverId: 3, routeId: 3, type: "bus",     plateNo: "BUS-0001", seatsTotal: 50, seatsOccupied: 35, lat: 10.284, lng: 123.882 },
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

// ─── Auth API ─────────────────────────────────────────────────────────────────

export const authApi = {
  async login(email: string, password: string): Promise<User> {
    try {
      return await apiFetch<User>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
    } catch {
      // Fallback: derive accountType from demo email prefix for dev convenience
      console.warn("[API] Backend unreachable — using mock login");
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
    } catch {
      console.warn("[API] Backend unreachable — using mock register");
      return { id: Date.now(), name, email, accountType };
    }
  },
};

// ─── Routes API ───────────────────────────────────────────────────────────────

export const routesApi = {
  async getAll(): Promise<Route[]> {
    try {
      return await apiFetch<Route[]>("/routes");
    } catch {
      console.warn("[API] Backend unreachable — using mock routes");
      return MOCK_ROUTES;
    }
  },

  async getByType(type: Route["type"]): Promise<Route[]> {
    try {
      return await apiFetch<Route[]>(`/routes/${type}`);
    } catch {
      console.warn("[API] Backend unreachable — using mock routes");
      return MOCK_ROUTES.filter((r) => r.type === type);
    }
  },
};

// ─── Traffic API ──────────────────────────────────────────────────────────────

export const trafficApi = {
  async getCurrent(): Promise<TrafficSegment[]> {
    try {
      return await apiFetch<TrafficSegment[]>("/traffic");
    } catch {
      console.warn("[API] Backend unreachable — using mock traffic");
      return MOCK_TRAFFIC;
    }
  },
};

// ─── Vehicles API ─────────────────────────────────────────────────────────────

export const vehiclesApi = {
  async getAll(): Promise<Vehicle[]> {
    try {
      return await apiFetch<Vehicle[]>("/vehicles");
    } catch {
      console.warn("[API] Backend unreachable — using mock vehicles");
      return MOCK_VEHICLES;
    }
  },

  async updateSeats(vehicleId: number, seatsOccupied: number): Promise<void> {
    try {
      await apiFetch(`/vehicles/${vehicleId}/seats`, {
        method: "PUT",
        body: JSON.stringify({ seatsOccupied }),
      });
    } catch {
      console.warn("[API] Backend unreachable — seat update skipped");
    }
  },

  async updateLocation(vehicleId: number, lat: number, lng: number): Promise<void> {
    try {
      await apiFetch(`/vehicles/${vehicleId}/location`, {
        method: "PUT",
        body: JSON.stringify({ lat, lng }),
      });
    } catch {
      console.warn("[API] Backend unreachable — location update skipped");
    }
  },
};