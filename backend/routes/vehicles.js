const router = require("express").Router();
const db = require("../db");

function parseVehicle(r) {
  return {
    id: r.id,
    driverId: r.driver_id,
    routeId: r.route_id,
    type: r.vehicleType,
    plateNo: r.plate_no,
    seatsTotal: r.seats_total,
    seatsOccupied: r.seats_occupied,
    lat: parseFloat(r.lat),
    lng: parseFloat(r.lng),
  };
}

// GET /api/vehicles
router.get("/", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM vehicles");
    res.json(rows.map(parseVehicle));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/vehicles/:id
router.get("/:id", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM vehicles WHERE id = ?", [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: "Not found" });
    res.json(parseVehicle(rows[0]));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/vehicles/:id/seats  – update occupancy
router.put("/:id/seats", async (req, res) => {
  const { seatsOccupied } = req.body;
  if (typeof seatsOccupied !== "number")
    return res.status(400).json({ error: "seatsOccupied must be a number" });

  try {
    await db.query(
      "UPDATE vehicles SET seats_occupied = ?, updated_at = NOW() WHERE id = ?",
      [seatsOccupied, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/vehicles/:id/location  – update GPS position
router.put("/:id/location", async (req, res) => {
  const { lat, lng } = req.body;
  try {
    await db.query(
      "UPDATE vehicles SET lat = ?, lng = ?, updated_at = NOW() WHERE id = ?",
      [lat, lng, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;