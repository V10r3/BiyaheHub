const router = require("express").Router();
const db = require("../db");

// GET /api/traffic
router.get("/", async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT * FROM traffic_segments ORDER BY updated_at DESC"
    );
    res.json(
      rows.map((r) => ({
        id: r.id,
        name: r.segment_name,
        level: r.trafficLevel,
        latStart: parseFloat(r.lat_start),
        lngStart: parseFloat(r.lng_start),
        latEnd: parseFloat(r.lat_end),
        lngEnd: parseFloat(r.lng_end),
      }))
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/traffic/:id  – update traffic level
router.put("/:id", async (req, res) => {
  const { level } = req.body;
  if (!["clear", "moderate", "heavy"].includes(level))
    return res.status(400).json({ error: "Invalid level" });

  try {
    await db.query(
      "UPDATE traffic_segments SET trafficLevel = ?, updated_at = NOW() WHERE id = ?",
      [level, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;