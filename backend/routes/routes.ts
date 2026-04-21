import { Router, Request, Response } from "express";
import { RowDataPacket } from "mysql2";
import pool from "../db";

const router = Router();

// ── Row shape from the DB ─────────────────────────────────────────────────────
interface RouteRow extends RowDataPacket {
  id:          number;
  routeName:   string;
  designation: string;
  start_point: string;
  end_point:   string;
  fare:        string | number;
  routeType:   string;
  waypoints:   string | [number, number][];
}

function parseRoute(row: RouteRow) {
  return {
    id:         row.id,
    name:       row.routeName,
    designation: row.designation,
    startPoint: row.start_point,
    endPoint:   row.end_point,
    fare:       parseFloat(String(row.fare)),
    type:       row.routeType,
    // mysql2 auto-parses JSON columns; only parse manually if still a string
    waypoints:  typeof row.waypoints === "string"
      ? (JSON.parse(row.waypoints || "[]") as [number, number][])
      : (row.waypoints ?? []),
  };
}

// ── GET /api/routes ───────────────────────────────────────────────────────────
router.get("/", async (_req: Request, res: Response) => {
  try {
    const [rows] = await pool.query<RouteRow[]>(
      "SELECT * FROM routes ORDER BY designation"
    );
    res.json(rows.map(parseRoute));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

// ── GET /api/routes/:type  (jeepney | bus | taxi | train) ─────────────────────
router.get("/:type", async (req: Request, res: Response) => {
  try {
    const [rows] = await pool.query<RouteRow[]>(
      "SELECT * FROM routes WHERE routeType = ? ORDER BY designation",
      [req.params.type]
    );
    res.json(rows.map(parseRoute));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

export default router;
