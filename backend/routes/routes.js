const router = require("express").Router();
const db = require("../db");

// Helper: parse waypoints JSON string from DB
function parseRoute(row) {
  return {
    id: row.id,
    name: row.routeName,
    designation: row.designation,
    startPoint: row.start_point,
    endPoint: row.end_point,
    fare: parseFloat(row.fare),
    type: row.routeType,
    waypoints: JSON.parse(row.waypoints || "[]"),
  };
}

// GET /api/routes
router.get("/", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM routes ORDER BY designation");
    res.json(rows.map(parseRoute));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/routes/:type  (jeepney | bus | taxi | train)
router.get("/:type", async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT * FROM routes WHERE routeType = ? ORDER BY designation",
      [req.params.type]
    );
    res.json(rows.map(parseRoute));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;