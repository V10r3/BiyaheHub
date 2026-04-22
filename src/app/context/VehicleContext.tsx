import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { userVehicleApi, type UserVehicle } from "../services/api";

// ── Storage helpers ──────────────────────────────────────────────────────────
const storageKey = (userId: number) => `biyahehub_vehicle_${userId}`;

function loadCached(userId: number): UserVehicle | null {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    return raw ? (JSON.parse(raw) as UserVehicle) : null;
  } catch {
    return null;
  }
}

function writeCache(userId: number, vehicle: UserVehicle | null) {
  const key = storageKey(userId);
  if (vehicle) {
    localStorage.setItem(key, JSON.stringify(vehicle));
  } else {
    localStorage.removeItem(key);
  }
}

// ── Context types ────────────────────────────────────────────────────────────
interface VehicleContextValue {
  vehicle: UserVehicle | null;
  loading: boolean;
  /** Persist vehicle to the API + session cache */
  saveVehicle: (v: UserVehicle) => Promise<UserVehicle>;
  /** Called by VehicleProfile after its own save to sync context */
  syncVehicle: (v: UserVehicle) => void;
  /** Clear session (on logout) */
  clearVehicle: () => void;
}

const VehicleContext = createContext<VehicleContextValue | null>(null);

// ── Provider ─────────────────────────────────────────────────────────────────
interface Props {
  userId: number | null;
  children: React.ReactNode;
}

export function VehicleProvider({ userId, children }: Props) {
  const [vehicle, setVehicle] = useState<UserVehicle | null>(
    () => (userId ? loadCached(userId) : null)
  );
  const [loading, setLoading] = useState(false);

  // Re-init when userId changes (login / logout)
  useEffect(() => {
    if (!userId) {
      setVehicle(null);
      return;
    }

    // Immediately show cached value (no flash of "no vehicle")
    const cached = loadCached(userId);
    setVehicle(cached);

    // Then revalidate from the API in the background
    setLoading(true);
    userVehicleApi
      .get(userId)
      .then((fresh) => {
        if (fresh) {
          writeCache(userId, fresh);
          setVehicle(fresh);
        } else if (!cached) {
          // Definitely no vehicle
          setVehicle(null);
        }
        // If API returned null but we have a cache, keep the cache (offline resilience)
      })
      .catch(() => {
        // Network error — keep whatever is in cache
      })
      .finally(() => setLoading(false));
  }, [userId]);

  const saveVehicle = useCallback(
    async (v: UserVehicle): Promise<UserVehicle> => {
      const saved = await userVehicleApi.save(v);
      if (userId) writeCache(userId, saved);
      setVehicle(saved);
      return saved;
    },
    [userId]
  );

  const syncVehicle = useCallback(
    (v: UserVehicle) => {
      if (userId) writeCache(userId, v);
      setVehicle(v);
    },
    [userId]
  );

  const clearVehicle = useCallback(() => {
    if (userId) writeCache(userId, null);
    setVehicle(null);
  }, [userId]);

  return (
    <VehicleContext.Provider value={{ vehicle, loading, saveVehicle, syncVehicle, clearVehicle }}>
      {children}
    </VehicleContext.Provider>
  );
}

// ── Hook ─────────────────────────────────────────────────────────────────────
export function useVehicle() {
  const ctx = useContext(VehicleContext);
  if (!ctx) throw new Error("useVehicle must be used within VehicleProvider");
  return ctx;
}
