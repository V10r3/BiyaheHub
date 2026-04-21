import { Router, Request, Response } from "express";
import { RowDataPacket, ResultSetHeader } from "mysql2";
import pool from "../db";

const router = Router();

// ── DB row types ──────────────────────────────────────────────────────────────

type FuelType = "gasoline" | "diesel" | "premium" | "lpg" | "electric";

interface UserVehicleRow extends RowDataPacket {
  id:          number;
  user_id:     number;
  make:        string;
  model:       string;
  year:        number;
  engineType:  string | null;
  fuelType:    FuelType;
  mileage:     number | null;
  tankMax:     number;
  tankCurrent: number;
  isManual:    number;
  updated_at:  Date;
}

interface FuelLogRow extends RowDataPacket {
  id:          number;
  userId:      number;
  litersAdded: number;
  pricePerL:   number;
  totalCost:   number;
  odometerKm:  number | null;
  notes:       string | null;
  loggedAt:    Date | null;
}

// ── GET /api/user-vehicle?userId=X ────────────────────────────────────────────
router.get("/", async (req: Request, res: Response) => {
  const userId = req.query.userId as string | undefined;
  if (!userId) return res.status(400).json({ error: "userId query param required" });

  try {
    const [rows] = await pool.query<UserVehicleRow[]>(
      "SELECT * FROM user_vehicles WHERE user_id = ? LIMIT 1",
      [userId]
    );
    res.json(rows[0] ?? null);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

// ── PUT /api/user-vehicle  (upsert) ───────────────────────────────────────────
router.put("/", async (req: Request, res: Response) => {
  const {
    userId, make, model, year,
    engineType, fuelType, mileage,
    tankMax, tankCurrent, isManual,
  } = req.body as {
    userId?: number;
    make?: string; model?: string; year?: number;
    engineType?: string; fuelType?: FuelType; mileage?: number;
    tankMax?: number; tankCurrent?: number; isManual?: boolean;
  };

  if (!userId) return res.status(400).json({ error: "userId is required" });
  if (!make || !model || !year || !fuelType)
    return res.status(400).json({ error: "make, model, year, fuelType are required" });

  try {
    await pool.query(
      `INSERT INTO user_vehicles
         (user_id, make, model, year, engineType, fuelType, mileage, tankMax, tankCurrent, isManual)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         make        = VALUES(make),
         model       = VALUES(model),
         year        = VALUES(year),
         engineType  = VALUES(engineType),
         fuelType    = VALUES(fuelType),
         mileage     = VALUES(mileage),
         tankMax     = VALUES(tankMax),
         tankCurrent = VALUES(tankCurrent),
         isManual    = VALUES(isManual)`,
      [
        userId, make, model, year,
        engineType ?? null,
        fuelType,
        mileage ?? null,
        tankMax  ?? 40,
        tankCurrent ?? 0,
        isManual ? 1 : 0,
      ]
    );

    const [rows] = await pool.query<UserVehicleRow[]>(
      "SELECT * FROM user_vehicles WHERE user_id = ? LIMIT 1",
      [userId]
    );
    res.json(rows[0]);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

// ── GET /api/user-vehicle/fuel-logs?userId=X ─────────────────────────────────
router.get("/fuel-logs", async (req: Request, res: Response) => {
  const userId = req.query.userId as string | undefined;
  if (!userId) return res.status(400).json({ error: "userId query param required" });

  try {
    const [rows] = await pool.query<FuelLogRow[]>(
      `SELECT
         id,
         user_id      AS userId,
         liters_added AS litersAdded,
         price_per_L  AS pricePerL,
         total_cost   AS totalCost,
         odometer_km  AS odometerKm,
         notes,
         logged_at    AS loggedAt
       FROM fuel_logs
       WHERE user_id = ?
       ORDER BY logged_at DESC
       LIMIT 50`,
      [userId]
    );
    res.json(rows);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

// ── POST /api/user-vehicle/fuel-logs ─────────────────────────────────────────
router.post("/fuel-logs", async (req: Request, res: Response) => {
  const {
    userId, litersAdded, pricePerL, totalCost, odometerKm, notes,
  } = req.body as {
    userId?:     number;
    litersAdded?: number;
    pricePerL?:   number;
    totalCost?:   number;
    odometerKm?:  number;
    notes?:       string;
  };

  if (!userId || litersAdded === undefined || pricePerL === undefined || totalCost === undefined)
    return res.status(400).json({ error: "userId, litersAdded, pricePerL, totalCost are required" });

  try {
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO fuel_logs (user_id, liters_added, price_per_L, total_cost, odometer_km, notes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, litersAdded, pricePerL, totalCost, odometerKm ?? null, notes ?? null]
    );

    // Optimistically raise tank level (capped at tankMax)
    await pool
      .query(
        "UPDATE user_vehicles SET tankCurrent = LEAST(tankCurrent + ?, tankMax) WHERE user_id = ?",
        [litersAdded, userId]
      )
      .catch(() => { /* vehicle profile may not exist yet — skip silently */ });

    res.json({ id: result.insertId, loggedAt: new Date().toISOString() });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

export default router;
