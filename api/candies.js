// Serverless function for the candy jar (Neon Postgres).
//   GET    /api/candies            -> newest candies
//   POST   /api/candies            -> add a candy
//   DELETE /api/candies?id=abc123  -> remove one (needs the x-admin-secret header)
// Environment variables (set them in Vercel):
//   DATABASE_URL   the Neon connection string (the Neon integration sets this for you)
//   ADMIN_SECRET   optional, only needed to delete candies
const crypto = require("crypto");
const { neon } = require("@neondatabase/serverless");

const KEEP = 200;      // candies kept in the database
const SHOW = 90;       // candies sent to the page
const COOLDOWN = 30;   // seconds a visitor must wait between candies
const COLORS = 6;
const SHAPES = 4;

// Blocks links and web addresses
const LINK = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|io|in|co|ly|me|xyz|app|dev|ru|cn)\b)/i;

let sql = null;
let ready = null;

// Connects once, and creates the tables the first time (safe to run again)
function db() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) return null;
  if (!sql) sql = neon(url);
  if (!ready) {
    ready = (async function () {
      await sql`CREATE TABLE IF NOT EXISTS candies (
        id text PRIMARY KEY,
        name text NOT NULL,
        msg text NOT NULL,
        color smallint NOT NULL,
        shape smallint NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )`;
      await sql`CREATE INDEX IF NOT EXISTS candies_created_idx ON candies (created_at DESC)`;
      await sql`CREATE TABLE IF NOT EXISTS candy_limits (
        key text PRIMARY KEY,
        until timestamptz NOT NULL
      )`;
    })().catch(function (err) { ready = null; throw err; });
  }
  return ready.then(function () { return sql; });
}

function clean(value, max) {
  return String(value == null ? "" : value)
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function parseBody(req) {
  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  return body && typeof body === "object" ? body : {};
}

function visitorKey(req) {
  const ip = String(req.headers["x-forwarded-for"] || (req.socket && req.socket.remoteAddress) || "unknown")
    .split(",")[0].trim();
  return "rl:" + crypto.createHash("sha256").update(ip + (process.env.IP_SALT || "")).digest("hex").slice(0, 20);
}

function isAdmin(req) {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  const given = Buffer.from(String(req.headers["x-admin-secret"] || ""));
  const real = Buffer.from(secret);
  return given.length === real.length && crypto.timingSafeEqual(given, real);
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const pending = db();
  if (!pending) return res.status(503).json({ error: "notConfigured" });

  try {
    const q = await pending;

    if (req.method === "GET") {
      const rows = await q`
        SELECT id, name, msg, color, shape, (extract(epoch FROM created_at) * 1000)::float8 AS t
        FROM candies ORDER BY created_at DESC LIMIT ${SHOW}`;
      res.setHeader("Cache-Control", "s-maxage=10, stale-while-revalidate=30");
      return res.status(200).json({ candies: rows });
    }

    if (req.method === "POST") {
      const body = parseBody(req);
      if (body.website) return res.status(200).json({ candy: null });   // hidden field: only bots fill it in

      const name = clean(body.name, 24);
      const msg = clean(body.msg, 160);
      const color = Number(body.color);
      const shape = Number(body.shape);

      if (!msg) return res.status(400).json({ error: "empty" });
      if (LINK.test(msg) || LINK.test(name)) return res.status(400).json({ error: "links" });
      if (!Number.isInteger(color) || color < 0 || color >= COLORS) return res.status(400).json({ error: "bad" });
      if (!Number.isInteger(shape) || shape < 0 || shape >= SHAPES) return res.status(400).json({ error: "bad" });

      // One candy per visitor per COOLDOWN seconds. The row is only written
      // if the visitor has no active cooldown, so two fast posts can't both pass.
      const key = visitorKey(req);
      const allowed = await q`
        INSERT INTO candy_limits (key, until) VALUES (${key}, now() + make_interval(secs => ${COOLDOWN}))
        ON CONFLICT (key) DO UPDATE SET until = EXCLUDED.until WHERE candy_limits.until < now()
        RETURNING key`;
      if (!allowed.length) return res.status(429).json({ error: "rateLimited" });

      const id = crypto.randomBytes(5).toString("hex");
      const rows = await q`
        INSERT INTO candies (id, name, msg, color, shape) VALUES (${id}, ${name}, ${msg}, ${color}, ${shape})
        RETURNING id, name, msg, color, shape, (extract(epoch FROM created_at) * 1000)::float8 AS t`;

      // Housekeeping: keep only the newest candies and forget old cooldowns
      await q`DELETE FROM candies WHERE id NOT IN (SELECT id FROM candies ORDER BY created_at DESC LIMIT ${KEEP})`;
      await q`DELETE FROM candy_limits WHERE until < now() - interval '1 day'`;

      return res.status(200).json({ candy: rows[0] });
    }

    if (req.method === "DELETE") {
      if (!isAdmin(req)) return res.status(403).json({ error: "forbidden" });
      const id = clean(req.query && req.query.id, 40);
      const rows = await q`DELETE FROM candies WHERE id = ${id} RETURNING id`;
      return res.status(200).json({ removed: rows.length });
    }

    res.setHeader("Allow", "GET, POST, DELETE");
    return res.status(405).json({ error: "method" });
  } catch (err) {
    console.error("candies api:", err);
    return res.status(502).json({ error: "server" });
  }
};
