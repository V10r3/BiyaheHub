import { Router, Request, Response } from "express";
import { RowDataPacket } from "mysql2";
import pool from "../db";

const router = Router();

interface VehicleRow extends RowDataPacket {
  id:            number;
  driver_id:     number | null;
  route_id:      number;
  vehicleType:   string;
  plate_no:      string;
  seats_total:   number;
  seats_occupied: number;
  lat:           string | number;
  lng:           string | number;
}

function parseVehicle(r: VehicleRow) {
  return {
    id:            r.id,
    driverId:      r.driver_id,
    routeId:       r.route_id,
    type:          r.vehicleType,
    plateNo:       r.plate_no,
    seatsTotal:    r.seats_total,
    seatsOccupied: r.seats_occupied,
    lat:           parseFloat(String(r.lat)),
    lng:           parseFloat(String(r.lng)),
  };
}

// ── GET /api/vehicles ─────────────────────────────────────────────────────────
router.get("/", async (_req: Request, res: Response) => {
  try {
    const [rows] = await pool.query<VehicleRow[]>("SELECT * FROM vehicles");
    res.json(rows.map(parseVehicle));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

// ── GET /api/vehicles/:id ─────────────────────────────────────────────────────
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const [rows] = await pool.query<VehicleRow[]>(
      "SELECT * FROM vehicles WHERE id = ?",
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Not found" });
    res.json(parseVehicle(rows[0]));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

// ── PUT /api/vehicles/:id/seats ───────────────────────────────────────────────
router.put("/:id/seats", async (req: Request, res: Response) => {
  const { seatsOccupied } = req.body as { seatsOccupied?: unknown };
  if (typeof seatsOccupied !== "number")
    return res.status(400).json({ error: "seatsOccupied must be a number" });

  try {
    await pool.query(
      "UPDATE vehicles SET seats_occupied = ?, updated_at = NOW() WHERE id = ?",
      [seatsOccupied, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

// ── PUT /api/vehicles/:id/location ────────────────────────────────────────────
router.put("/:id/location", async (req: Request, res: Response) => {
  const { lat, lng } = req.body as { lat?: number; lng?: number };
  if (lat === undefined || lng === undefined)
    return res.status(400).json({ error: "lat and lng are required" });

  try {
    await pool.query(
      "UPDATE vehicles SET lat = ?, lng = ?, updated_at = NOW() WHERE id = ?",
      [lat, lng, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

export default router;
