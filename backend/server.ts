import dotenv from "dotenv";
dotenv.config();

import express, { Request, Response } from "express";
import cors from "cors";
import pool from "./db";

import authRouter         from "./routes/auth";
import routesRouter       from "./routes/routes";
import trafficRouter      from "./routes/traffic";
import vehiclesRouter     from "./routes/vehicles";
import userVehiclesRouter from "./routes/userVehicles";
import fuelPricesRouter   from "./routes/fuelPrices";

const app  = express();
const PORT = Number(process.env.PORT) || 3001;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({ origin: "*" }));
app.use(express.json());

// ── Root ──────────────────────────────────────────────────────────────────────
app.get("/", (_req: Request, res: Response) => {
  res.json({
    app: "BiyaheHub API",
    version: "1.0.0",
    status: "running",
    endpoints: [
      "POST /api/auth/login",
      "POST /api/auth/register",
      "GET  /api/routes",
      "GET  /api/routes/:type",
      "GET  /api/traffic",
      "PUT  /api/traffic/:id",
      "GET  /api/vehicles",
      "PUT  /api/vehicles/:id/seats",
      "PUT  /api/vehicles/:id/location",
      "GET  /api/user-vehicle",
      "PUT  /api/user-vehicle",
      "GET  /api/user-vehicle/fuel-logs",
      "POST /api/user-vehicle/fuel-logs",
      "GET  /api/fuel-prices/:fuelType",
      "GET  /api/health",
    ],
  });
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/api/auth",         authRouter);
app.use("/api/routes",       routesRouter);
app.use("/api/traffic",      trafficRouter);
app.use("/api/vehicles",     vehiclesRouter);
app.use("/api/user-vehicle", userVehiclesRouter);
app.use("/api/fuel-prices",  fuelPricesRouter);

// ── Health check ──────────────────────────────────────────────────────────────
app.get("/api/health", async (_req: Request, res: Response) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok", db: "connected" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ status: "error", db: msg });
  }
});

// ── 404 catch-all ─────────────────────────────────────────────────────────────
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: `Cannot ${req.method} ${req.path}` });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, async () => {
  console.log(`✅  BiyaheHub API running at http://localhost:${PORT}`);
  console.log(`    Health check → http://localhost:${PORT}/api/health`);
  try {
    await pool.query("SELECT 1");
    console.log("✅  MySQL connected — database is ready");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("❌  MySQL connection failed:", msg);
    console.error("    Check your .env file (DB_HOST, DB_USER, DB_PASSWORD, DB_NAME)");
    console.error("    and make sure the schema has been loaded: mysql -u root -p < schema.sql");
  }
});