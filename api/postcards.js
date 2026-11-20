// Serverless function for the postcard wall (Neon Postgres).
//   GET    /api/postcards            -> newest postcards
//   POST   /api/postcards            -> add a postcard
//   DELETE /api/postcards?id=abc123 -> remove one (needs the x-admin-secret header)
// Environment variables (set them in Vercel):
//   DATABASE_URL   the Neon connection string (the Neon integration sets this for you)
//   ADMIN_SECRET   optional, only needed to delete postcards
const crypto = require("crypto");
const { neon } = require("@neondatabase/serverless");

const KEEP = 200;
const SHOW = 90;
const COOLDOWN = 30;
const THEMES = 6;
const STAMPS = 4;
const LINK = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|io|in|co|ly|me|xyz|app|dev|ru|cn)\b)/i;

let sql = null;
let ready = null;

function db() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) return null;
  if (!sql) sql = neon(url);
  if (!ready) {
    ready = (async function () {
      await sql`DO $$
        BEGIN
          IF to_regclass('public.postcards') IS NULL AND to_regclass('public.candies') IS NOT NULL THEN
            ALTER TABLE public.candies RENAME TO postcards;
          END IF;
          IF to_regclass('public.postcard_limits') IS NULL AND to_regclass('public.candy_limits') IS NOT NULL THEN
            ALTER TABLE public.candy_limits RENAME TO postcard_limits;
          END IF;
          IF to_regclass('public.candies_created_idx') IS NOT NULL AND to_regclass('public.postcards_created_idx') IS NULL THEN
            ALTER INDEX public.candies_created_idx RENAME TO postcards_created_idx;
          END IF;
          IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'postcards' AND column_name = 'color')
            AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'postcards' AND column_name = 'theme') THEN
            ALTER TABLE public.postcards RENAME COLUMN color TO theme;
          END IF;
          IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'postcards' AND column_name = 'shape')
            AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'postcards' AND column_name = 'stamp') THEN
            ALTER TABLE public.postcards RENAME COLUMN shape TO stamp;
          END IF;
        END
      $$`;
      await sql`CREATE TABLE IF NOT EXISTS postcards (
        id text PRIMARY KEY,
        name text NOT NULL,
        msg text NOT NULL,
        theme smallint NOT NULL,
        stamp smallint NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )`;
      await sql`CREATE INDEX IF NOT EXISTS postcards_created_idx ON postcards (created_at DESC)`;
      await sql`CREATE TABLE IF NOT EXISTS postcard_limits (
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
        SELECT id, name, msg, theme, stamp, (extract(epoch FROM created_at) * 1000)::float8 AS t
        FROM postcards ORDER BY created_at DESC LIMIT ${SHOW}`;
      res.setHeader("Cache-Control", "s-maxage=10, stale-while-revalidate=30");
      return res.status(200).json({ postcards: rows });
    }

    if (req.method === "POST") {
      const body = parseBody(req);
      if (body.website) return res.status(200).json({ postcard: null });

      const name = clean(body.name, 24);
      const msg = clean(body.msg, 160);
      const theme = Number(body.theme);
      const stamp = Number(body.stamp);

      if (!msg) return res.status(400).json({ error: "empty" });
      if (LINK.test(msg) || LINK.test(name)) return res.status(400).json({ error: "links" });
      if (!Number.isInteger(theme) || theme < 0 || theme >= THEMES) return res.status(400).json({ error: "bad" });
      if (!Number.isInteger(stamp) || stamp < 0 || stamp >= STAMPS) return res.status(400).json({ error: "bad" });

      const key = visitorKey(req);
      const allowed = await q`
        INSERT INTO postcard_limits (key, until) VALUES (${key}, now() + make_interval(secs => ${COOLDOWN}))
        ON CONFLICT (key) DO UPDATE SET until = EXCLUDED.until WHERE postcard_limits.until < now()
        RETURNING key`;
      if (!allowed.length) return res.status(429).json({ error: "rateLimited" });

      const id = crypto.randomBytes(5).toString("hex");
      const rows = await q`
        INSERT INTO postcards (id, name, msg, theme, stamp) VALUES (${id}, ${name}, ${msg}, ${theme}, ${stamp})
        RETURNING id, name, msg, theme, stamp, (extract(epoch FROM created_at) * 1000)::float8 AS t`;

      await q`DELETE FROM postcards WHERE id NOT IN (SELECT id FROM postcards ORDER BY created_at DESC LIMIT ${KEEP})`;
      await q`DELETE FROM postcard_limits WHERE until < now() - interval '1 day'`;

      return res.status(200).json({ postcard: rows[0] });
    }

    if (req.method === "DELETE") {
      if (!isAdmin(req)) return res.status(403).json({ error: "forbidden" });
      const id = clean(req.query && req.query.id, 40);
      const rows = await q`DELETE FROM postcards WHERE id = ${id} RETURNING id`;
      return res.status(200).json({ removed: rows.length });
    }

    res.setHeader("Allow", "GET, POST, DELETE");
    return res.status(405).json({ error: "method" });
  } catch (err) {
    console.error("postcards api:", err);
    return res.status(502).json({ error: "server" });
  }
};
