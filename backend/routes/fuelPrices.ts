/**
 * BiyaheHub — Fuel Price Route
 *
 * GET /api/fuel-prices/:fuelType
 *
 * Scrape source: https://gaswatchph.com/#prices-section
 *
 * Flow:
 *  1. Check fuel_price_cache in MySQL (TTL: 24 h)
 *  2. Cache miss → scrape GasWatch PH via cheerio
 *     Parse strategies (tried in order):
 *       A. Tables inside #prices-section
 *       B. Price card elements (div/span with price + fuel-type labels)
 *       C. Embedded JSON/JS variables in <script> tags
 *       D. Full-page text mining (last resort)
 *  3. Scrape failed → confidence: "fallback" (last-known Cebu pump prices)
 *  4. DB error → still return a JSON response (never hang the client)
 */

import { Router, Request, Response } from "express";
import { RowDataPacket }              from "mysql2";
import { load }                       from "cheerio";
import pool                           from "../db";

const router = Router();

// ── Types ──────────────────────────────────────────────────────────────────────

interface FuelCacheRow extends RowDataPacket {
  fuelType:      string;
  label:         string;
  pricePerLiter: number;
  effectiveDate: string;
  confidence:    string;
  fetched_at:    Date;
}

// ── Config ─────────────────────────────────────────────────────────────────────

const GASWATCH_URL = "https://gaswatchph.com/";
const CACHE_TTL    = 24; // hours before re-scraping

/** Last-known Cebu-area pump prices (April 2026) — used when GasWatch is unreachable */
const FUEL_META: Record<string, { label: string; fallback: number }> = {
  gasoline: { label: "Gasoline (RON 91)", fallback: 67.50 },
  premium:  { label: "Premium (RON 95)",  fallback: 72.80 },
  diesel:   { label: "Diesel",            fallback: 57.30 },
  lpg:      { label: "LPG",              fallback: 52.00 },
  electric: { label: "Electric",          fallback: 0.00  },
};

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Parse a price string into a single number (midpoint when a range is given).
 * Handles: "67.00" | "67.00 - 71.50" | "₱67.00" | "67,50"
 * Rejects values outside the realistic PH pump-price band (5 – 500 ₱/L).
 */
function parsePrice(raw: string): number | null {
  const clean = raw.replace(/[₱,\s]/g, "");
  const nums  = (clean.match(/\d+(?:\.\d+)?/g) ?? [])
    .map(Number)
    .filter((n) => n >= 5 && n <= 500);
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

/**
 * Match a text label to one of our internal fuel slugs.
 * Returns null if the label doesn't map to any known fuel.
 */
function labelToSlug(text: string): string | null {
  const t = text.toLowerCase().trim();
  if (/ron\s*91|unleaded|regular.*gas/.test(t))  return "gasoline";
  if (/ron\s*9[57]|premium|super/.test(t))        return "premium";
  if (/ron\s*97|ron\s*100/.test(t))               return "premium"; // treat RON 97/100 as premium
  if (/\bdiesel\b/.test(t))                        return "diesel";
  if (/\blpg\b|autogas|auto\s*gas/.test(t))        return "lpg";
  return null;
}

// ── Strategy 0 — Try GasWatch's likely Next.js API routes directly ─────────────
// Next.js apps often expose /api/* routes; worth checking before parsing HTML.
async function tryGasWatchApi(): Promise<Partial<Record<string, number>>> {
  const candidates = [
    "https://gaswatchph.com/api/prices",
    "https://gaswatchph.com/api/fuel-prices",
    "https://gaswatchph.com/api/fuel",
  ];

  for (const url of candidates) {
    try {
      const r = await fetch(url, {
        signal: AbortSignal.timeout(5_000),
        headers: { Accept: "application/json" },
      });
      if (!r.ok) continue;
      const obj = await r.json();
      const found: Partial<Record<string, number>> = {};
      walkObject(obj, found);
      if (Object.keys(found).length >= 2) {
        console.log(`[FuelPrice] GasWatch API hit: ${url}`, found);
        return found;
      }
    } catch { /* try next */ }
  }
  return {};
}

// ── Strategy A — Parse __NEXT_DATA__ SSR JSON (Next.js SPA) ───────────────────
function parseFromNextData($: ReturnType<typeof load>): Partial<Record<string, number>> {
  const found: Partial<Record<string, number>> = {};
  const raw = $("#__NEXT_DATA__").html() ?? $("script#__NEXT_DATA__").html() ?? "";
  if (!raw) return found;
  try {
    const obj = JSON.parse(raw);
    walkObject(obj, found);
  } catch { /* not valid JSON */ }
  return found;
}

// ── Strategy B — Tables inside #prices-section (or any table on the page) ─────

function parseFromTables(
  $: ReturnType<typeof load>,
  root: ReturnType<ReturnType<typeof load>>
): Partial<Record<string, number>> {
  const found: Partial<Record<string, number>> = {};

  root.find("table").each((_, tbl) => {
    $(tbl).find("tr").each((_, row) => {
      const cells = $(row)
        .find("td, th")
        .map((_, cell) => $(cell).text().trim())
        .get();

      if (cells.length < 2) return;

      const slug = labelToSlug(cells[0]);
      if (!slug || found[slug] !== undefined) return;

      // Try each subsequent cell as the price column
      for (let col = 1; col < cells.length; col++) {
        const price = parsePrice(cells[col]);
        if (price !== null) {
          found[slug] = price;
          break;
        }
      }
    });
  });

  return found;
}

// ── Strategy C — Price cards / labelled elements ───────────────────────────────
//
// GasWatch PH may render prices as cards like:
//   <div class="price-item">
//     <span class="fuel-name">RON 91</span>
//     <span class="price">₱67.50</span>
//   </div>
//
// We scan ANY element whose text contains a fuel-type keyword, then look at
// siblings and nearby text for a number.

function parseFromCards(
  $: ReturnType<typeof load>,
  root: ReturnType<ReturnType<typeof load>>
): Partial<Record<string, number>> {
  const found: Partial<Record<string, number>> = {};

  root.find("*").each((_, el) => {
    const text = $(el).children().length === 0
      ? $(el).text().trim()   // leaf nodes only — avoid double-counting containers
      : "";

    const slug = labelToSlug(text);
    if (!slug || found[slug] !== undefined) return;

    // Walk siblings and parent's children for a price value
    const candidates = [
      $(el).next().text(),
      $(el).prev().text(),
      $(el).parent().text(),
      $(el).closest("[class]").text(),
    ];

    for (const raw of candidates) {
      const price = parsePrice(raw.replace(text, "").trim());
      if (price !== null) {
        found[slug] = price;
        break;
      }
    }
  });

  return found;
}

// ── Strategy D — Embedded JS / JSON in <script> tags ─────────────────────────
//
// Some Next.js / Nuxt sites embed their store/props as JSON inside
// <script id="__NEXT_DATA__"> or window.__INITIAL_STATE__ = {...}.

function parseFromScripts($: ReturnType<typeof load>): Partial<Record<string, number>> {
  const found: Partial<Record<string, number>> = {};

  $("script").each((_, el) => {
    const content = $(el).html() ?? "";
    if (!content) return;

    // Try to parse embedded JSON blobs
    const jsonBlobs = content.match(/\{[\s\S]{20,}\}/g) ?? [];
    for (const blob of jsonBlobs) {
      try {
        const obj = JSON.parse(blob);
        walkObject(obj, found);
        if (Object.keys(found).length >= 3) return false; // $.each exit
      } catch { /* not valid JSON — skip */ }
    }

    // Direct regex scan for key:value patterns like  "ron91":67.50
    const patterns: Array<[string, RegExp]> = [
      ["gasoline", /ron.?91[^a-z\d]{0,5}(\d{2,3}(?:\.\d{1,2})?)/i],
      ["premium",  /ron.?9[57][^a-z\d]{0,5}(\d{2,3}(?:\.\d{1,2})?)/i],
      ["diesel",   /diesel[^a-z\d]{0,5}(\d{2,3}(?:\.\d{1,2})?)/i],
      ["lpg",      /\blpg\b[^a-z\d]{0,5}(\d{2,3}(?:\.\d{1,2})?)/i],
    ];
    for (const [slug, re] of patterns) {
      if (found[slug] !== undefined) continue;
      const m = content.match(re);
      if (m) {
        const price = parseFloat(m[1]);
        if (price >= 5 && price <= 500) found[slug] = price;
      }
    }
  });

  return found;
}

/** Recursively walk a parsed JSON object looking for fuel-price keys */
function walkObject(
  obj: unknown,
  acc: Partial<Record<string, number>>,
  depth = 0
): void {
  if (depth > 8 || !obj || typeof obj !== "object") return;
  for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
    const slug = labelToSlug(key);
    if (slug && acc[slug] === undefined && typeof val === "number") {
      if (val >= 5 && val <= 500) acc[slug] = val;
    }
    if (typeof val === "object") walkObject(val, acc, depth + 1);
  }
}

// ── Strategy E — Full-page text mining (last resort) ─────────────────────────

function parseFromBodyText($: ReturnType<typeof load>): Partial<Record<string, number>> {
  const found: Partial<Record<string, number>> = {};
  const bodyText = $("body").text();

  const patterns: Array<[string, RegExp]> = [
    ["gasoline", /ron\s*91[\s\S]{0,60}?₱?\s*(\d{2,3}(?:\.\d{1,2})?)/i],
    ["premium",  /ron\s*9[57][\s\S]{0,60}?₱?\s*(\d{2,3}(?:\.\d{1,2})?)/i],
    ["diesel",   /diesel[\s\S]{0,60}?₱?\s*(\d{2,3}(?:\.\d{1,2})?)/i],
    ["lpg",      /\blpg\b[\s\S]{0,60}?₱?\s*(\d{2,3}(?:\.\d{1,2})?)/i],
  ];

  for (const [slug, re] of patterns) {
    const m = bodyText.match(re);
    if (m) {
      const price = parseFloat(m[1]);
      if (price >= 5 && price <= 500) found[slug] = price;
    }
  }

  return found;
}

// ── Main scrape function ────────────────────────────────────────────────────────

async function scrapeGasWatch(): Promise<Partial<Record<string, number>>> {

  // 0. Try direct API endpoints first (fastest, no HTML parsing needed)
  const apiResult = await tryGasWatchApi();
  if (Object.keys(apiResult).length >= 2) return apiResult;

  const res = await fetch(GASWATCH_URL, {
    signal: AbortSignal.timeout(12_000),
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
        "AppleWebKit/537.36 (KHTML, like Gecko) " +
        "Chrome/124.0.0.0 Safari/537.36",
      "Accept":          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Cache-Control":   "no-cache",
    },
  });

  if (!res.ok) throw new Error(`GasWatch PH returned HTTP ${res.status}`);

  const html = await res.text();
  const $    = load(html);

  // Narrow the search to #prices-section if it exists; else use the whole page
  const pricesRoot = $("#prices-section").length
    ? $("#prices-section")
    : $("body");

  const merge = (
    target: Partial<Record<string, number>>,
    src:    Partial<Record<string, number>>
  ) => { for (const [k, v] of Object.entries(src)) if (!(k in target)) target[k] = v; };

  const found: Partial<Record<string, number>> = {};

  // 1. __NEXT_DATA__ SSR blob (most reliable for Next.js apps)
  merge(found, parseFromNextData($));
  if (Object.keys(found).length >= 2) {
    console.log("[FuelPrice] GasWatch __NEXT_DATA__ parse succeeded:", found);
    return found;
  }

  // 2. Tables
  merge(found, parseFromTables($, pricesRoot));
  // 3. Price cards
  if (Object.keys(found).length < 2) merge(found, parseFromCards($, pricesRoot));
  // 4. Other inline scripts
  if (Object.keys(found).length < 2) merge(found, parseFromScripts($));
  // 5. Full-page text mining
  if (Object.keys(found).length < 2) merge(found, parseFromBodyText($));

  console.log("[FuelPrice] GasWatch scrape result:", found);
  return found;
}

// ── Create cache table if it doesn't exist ────────────────────────────────────

pool
  .query(`
    CREATE TABLE IF NOT EXISTS fuel_price_cache (
      id            INT AUTO_INCREMENT PRIMARY KEY,
      fuelType      VARCHAR(50)  NOT NULL,
      label         VARCHAR(100) NOT NULL,
      pricePerLiter DECIMAL(8,2) NOT NULL,
      effectiveDate VARCHAR(50),
      confidence    VARCHAR(20)  NOT NULL DEFAULT 'scraped',
      fetched_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_fuel_type (fuelType)
    )
  `)
  .catch((err: Error) =>
    console.error("[FuelPrice] Could not create cache table:", err.message)
  );

// ── GET /api/fuel-prices/:fuelType ────────────────────────────────────────────

router.get("/:fuelType", async (req: Request, res: Response) => {
  const fuelType = req.params.fuelType;
  const meta     = FUEL_META[fuelType] ?? FUEL_META.gasoline;

  try {
    // ── 1. Cache hit? ────────────────────────────────────────────────────────
    const [rows] = await pool.query<FuelCacheRow[]>(
      `SELECT *
         FROM fuel_price_cache
        WHERE fuelType = ?
          AND TIMESTAMPDIFF(HOUR, fetched_at, NOW()) < ?
        LIMIT 1`,
      [fuelType, CACHE_TTL]
    );

    if (rows.length > 0) {
      const r = rows[0];
      return res.json({
        fuelType:      r.label,
        pricePerLiter: Number(r.pricePerLiter),
        effectiveDate: r.effectiveDate,
        lastUpdated:   r.fetched_at,
        confidence:    r.confidence,
        source:        "GasWatch PH (cached)",
      });
    }

    // ── 2. Cache miss — scrape GasWatch PH ───────────────────────────────────
    let scraped: Partial<Record<string, number>> = {};
    let confidence = "scraped";

    try {
      scraped = await scrapeGasWatch();
      if (Object.keys(scraped).length === 0) {
        throw new Error("No prices found — page layout may have changed");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[FuelPrice] GasWatch scrape failed (using fallback): ${msg}`);
      confidence = "fallback";
    }

    const price         = scraped[fuelType] ?? meta.fallback;
    const effectiveDate = new Date().toISOString().split("T")[0];

    // ── 3. Upsert into cache ─────────────────────────────────────────────────
    await pool.query(
      `INSERT INTO fuel_price_cache
         (fuelType, label, pricePerLiter, effectiveDate, confidence)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         label         = VALUES(label),
         pricePerLiter = VALUES(pricePerLiter),
         effectiveDate = VALUES(effectiveDate),
         confidence    = VALUES(confidence),
         fetched_at    = CURRENT_TIMESTAMP`,
      [fuelType, meta.label, price, effectiveDate, confidence]
    );

    res.json({
      fuelType:      meta.label,
      pricePerLiter: price,
      effectiveDate,
      lastUpdated:   new Date().toISOString(),
      confidence,
      source: confidence === "scraped" ? "GasWatch PH (live)" : "GasWatch PH (fallback)",
    });

  } catch (err) {
    // ── 4. Total failure (DB down) — still respond ───────────────────────────
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[FuelPrice] Fatal error:", msg);

    res.json({
      fuelType:      meta.label,
      pricePerLiter: meta.fallback,
      effectiveDate: "2026-04-14",
      lastUpdated:   new Date().toISOString(),
      confidence:    "fallback",
      source:        "GasWatch PH (fallback)",
    });
  }
});

export default router;