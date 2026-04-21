require("dotenv").config();
const express = require("express");
const cors    = require("cors");
const db      = require("./db");

const app  = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({ origin: "*" }));
app.use(express.json());

// ── Root ──────────────────────────────────────────────────────────────────────
app.get("/", (req, res) => {
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
      "GET  /api/health",
    ],
  });
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/api/auth",     require("./routes/auth"));
app.use("/api/routes",   require("./routes/routes"));
app.use("/api/traffic",  require("./routes/traffic"));
app.use("/api/vehicles", require("./routes/vehicles"));

// ── Health check ──────────────────────────────────────────────────────────────
app.get("/api/health", async (req, res) => {
  try {
    await db.query("SELECT 1");
    res.json({ status: "ok", db: "connected" });
  } catch (err) {
    res.status(500).json({ status: "error", db: err.message });
  }
});

// ── 404 catch-all ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Cannot ${req.method} ${req.path}` });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, async () => {
  console.log(`✅ BiyaheHub API running at http://localhost:${PORT}`);
  console.log(`   Health check → http://localhost:${PORT}/api/health`);

  // Verify DB connection on startup so misconfigured credentials fail loudly
  try {
    await db.query("SELECT 1");
    console.log("✅ MySQL connected — database is ready");
  } catch (err) {
    console.error("❌ MySQL connection failed:", err.message);
    console.error("   Check your .env file (DB_HOST, DB_USER, DB_PASSWORD, DB_NAME)");
    console.error("   and make sure the schema has been loaded: mysql -u root -p < schema.sql");
  }
});