import { Router, Request, Response } from "express";
import { RowDataPacket } from "mysql2";
import pool from "../db";

const router = Router();

type TrafficLevel = "clear" | "moderate" | "heavy";

interface TrafficRow extends RowDataPacket {
  id:           number;
  segment_name: string;
  trafficLevel: TrafficLevel;
  lat_start:    string | number;
  lng_start:    string | number;
  lat_end:      string | number;
  lng_end:      string | number;
}

// ── GET /api/traffic ──────────────────────────────────────────────────────────
router.get("/", async (_req: Request, res: Response) => {
  try {
    const [rows] = await pool.query<TrafficRow[]>(
      "SELECT * FROM traffic_segments ORDER BY updated_at DESC"
    );
    res.json(
      rows.map((r) => ({
        id:       r.id,
        name:     r.segment_name,
        level:    r.trafficLevel,
        latStart: parseFloat(String(r.lat_start)),
        lngStart: parseFloat(String(r.lng_start)),
        latEnd:   parseFloat(String(r.lat_end)),
        lngEnd:   parseFloat(String(r.lng_end)),
      }))
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

// ── PUT /api/traffic/:id  — update traffic level ──────────────────────────────
router.put("/:id", async (req: Request, res: Response) => {
  const { level } = req.body as { level?: TrafficLevel };
  const allowed: TrafficLevel[] = ["clear", "moderate", "heavy"];
  if (!level || !allowed.includes(level))
    return res.status(400).json({ error: "Invalid level — must be clear | moderate | heavy" });

  try {
    await pool.query(
      "UPDATE traffic_segments SET trafficLevel = ?, updated_at = NOW() WHERE id = ?",
      [level, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

export default router;
