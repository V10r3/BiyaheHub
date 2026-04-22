import { Router, Request, Response } from "express";
import { RowDataPacket, ResultSetHeader } from "mysql2";
import pool from "../db";

const router = Router();

// ── POST /api/auth/login ──────────────────────────────────────────────────────
router.post("/login", async (req: Request, res: Response) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password)
    return res.status(400).json({ error: "Email and password required" });

  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT id, userName, email, account_type FROM users WHERE email = ? AND password_hash = ? LIMIT 1",
      [email, password] // ⚠️  In production use bcrypt: bcrypt.compare(password, row.password_hash)
    );
    if (rows.length === 0)
      return res.status(401).json({ error: "Invalid credentials" });

    const user = rows[0];
    res.json({
      id:          user.id,
      name:        user.userName,
      email:       user.email,
      accountType: user.account_type,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

// ── POST /api/auth/register ───────────────────────────────────────────────────
router.post("/register", async (req: Request, res: Response) => {
  const { name, email, password, accountType } = req.body as {
    name?: string; email?: string; password?: string; accountType?: string;
  };
  if (!name || !email || !password || !accountType)
    return res.status(400).json({ error: "All fields required" });

  const VALID_TYPES = ["driver", "commuter"];
  if (!VALID_TYPES.includes(accountType))
    return res.status(400).json({ error: `accountType must be one of: ${VALID_TYPES.join(", ")}` });

  try {
    const [existing] = await pool.query<RowDataPacket[]>(
      "SELECT id FROM users WHERE email = ?",
      [email]
    );
    if (existing.length > 0)
      return res.status(409).json({ error: "Email already registered" });

    const [result] = await pool.query<ResultSetHeader>(
      "INSERT INTO users (userName, email, password_hash, account_type) VALUES (?, ?, ?, ?)",
      [name, email, password, accountType] // ⚠️  Hash the password before storing in production
    );
    res.status(201).json({ id: result.insertId, name, email, accountType });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[register] DB error:", msg);
    res.status(500).json({ error: msg });
  }
});

export default router;