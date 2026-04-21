const router = require("express").Router();
const db = require("../db");

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Email and password required" });

  try {
    const [rows] = await db.query(
      "SELECT id, userName, email, account_type FROM users WHERE email = ? AND password_hash = ? LIMIT 1",
      [email, password] // ⚠️ In production use bcrypt: bcrypt.compare(password, row.password_hash)
    );
    if (rows.length === 0) return res.status(401).json({ error: "Invalid credentials" });
    const user = rows[0];
    res.json({ id: user.id, name: user.userName, email: user.email, accountType: user.account_type });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/register
router.post("/register", async (req, res) => {
  const { name, email, password, accountType } = req.body;
  if (!name || !email || !password || !accountType)
    return res.status(400).json({ error: "All fields required" });

  try {
    const [existing] = await db.query("SELECT id FROM users WHERE email = ?", [email]);
    if (existing.length > 0) return res.status(409).json({ error: "Email already registered" });

    const [result] = await db.query(
      "INSERT INTO users (userName, email, password_hash, account_type) VALUES (?, ?, ?, ?)",
      [name, email, password, accountType] // ⚠️ In production hash the password first
    );
    res.status(201).json({ id: result.insertId, name, email, accountType });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;