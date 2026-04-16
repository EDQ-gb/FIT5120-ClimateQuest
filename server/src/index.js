const express = require("express");
const cors = require("cors");
const session = require("express-session");
const MySQLStoreFactory = require("express-mysql-session");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const { FRONTEND_ORIGIN, NODE_ENV, PORT, SESSION_SECRET } = require("./config");
const { getPool, query, exec } = require("./db");

const app = express();

app.disable("x-powered-by");
// Required for secure cookies behind Render/Vercel proxies (x-forwarded-proto)
if (NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

app.use(express.json({ limit: "2mb" }));

app.use(
  cors({
    origin: FRONTEND_ORIGIN,
    credentials: true,
  })
);

const cookieSecure = NODE_ENV === "production";
const cookieSameSite =
  process.env.COOKIE_SAMESITE || (cookieSecure ? "none" : "lax");

// Ensure required tables exist in the connected database.
// Render free tier often doesn't provide an interactive shell; auto-bootstrapping
// avoids "ER_NO_SUCH_TABLE user_state" when the DB is new.
let _bootstrapped = null;
async function ensureDbBootstrapped() {
  if (_bootstrapped) return _bootstrapped;
  _bootstrapped = (async () => {
    try {
      const schemaPath = path.join(__dirname, "..", "db", "schema.sql");
      const sql = fs.readFileSync(schemaPath, "utf8");
      await exec(sql);
      return true;
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error({
        message: "DB bootstrap failed",
        error: e?.message,
        code: e?.code,
      });
      return false;
    }
  })();
  return _bootstrapped;
}

const mysqlPool = getPool();
const MySQLStore = MySQLStoreFactory(session);

app.use(
  session({
    name: process.env.SESSION_NAME || "ecoquest.sid",
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: mysqlPool
      ? new MySQLStore(
          {
            clearExpired: true,
            checkExpirationInterval: 1000 * 60 * 15,
            expiration: 1000 * 60 * 60 * 24 * 7,
            createDatabaseTable: true,
            schema: {
              tableName: "user_sessions",
              columnNames: {
                session_id: "session_id",
                expires: "expires",
                data: "data",
              },
            },
          },
          mysqlPool
        )
      : undefined,
    cookie: {
      httpOnly: true,
      secure: cookieSecure,
      sameSite: cookieSameSite,
      maxAge: 1000 * 60 * 60 * 24 * 7,
    },
  })
);

function normalizeUsername(username) {
  return String(username || "").trim().toLowerCase();
}

function isValidUsername(username) {
  // 3-32 chars: letters, numbers, underscore
  return /^[a-z0-9_]{3,32}$/.test(username);
}

function isValidPassword(pw) {
  return typeof pw === "string" && pw.length >= 8;
}

function normalizeDisplayName(name) {
  const v = String(name || "").trim();
  if (!v) return null;
  return v.slice(0, 80);
}

function publicUserRow(row) {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name || "",
    createdAt: row.created_at,
  };
}

function setLoggedInSession(req, userId) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((regenErr) => {
      if (regenErr) return reject(regenErr);
      req.session.userId = userId;
      req.session.save((saveErr) => {
        if (saveErr) return reject(saveErr);
        resolve();
      });
    });
  });
}

function requireAuth(req, res) {
  const userId = req.session.userId;
  if (!userId) {
    res.status(401).json({ error: "UNAUTHORIZED" });
    return null;
  }
  return userId;
}

async function ensureUserState(userId) {
  // Some teammates may run the server against an existing DB created before we
  // introduced `theme_locked`. If the column is missing, game-state reads crash
  // and the frontend mistakenly forces users back to ThemeSelect on relogin.
  await ensureUserStateSchema();
  await query(
    `insert into user_state (user_id)
     values (?)
     on duplicate key update user_id = user_id`,
    [userId]
  );
}

let _schemaEnsured = null;
async function ensureUserStateSchema() {
  if (_schemaEnsured) return _schemaEnsured;
  _schemaEnsured = (async () => {
    try {
      // Prefer SHOW COLUMNS (often allowed even when information_schema is restricted).
      const r = await query(`show columns from user_state like 'theme_locked'`);
      if (r.rows && r.rows.length > 0) return true;
      // Use `exec` (pool.query) for DDL to avoid driver edge cases with prepared statements.
      await exec(
        `alter table user_state
         add column theme_locked tinyint(1) not null default 0`
      );
      return true;
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error({
        message: "ensureUserStateSchema failed",
        error: e?.message,
        code: e?.code,
      });
      return false;
    }
  })();
  return _schemaEnsured;
}

async function touchActive(userId) {
  await query(`update user_state set last_active_at = now() where user_id = ?`, [
    userId,
  ]);
}

function safeJsonParse(v, fallback) {
  try {
    if (!v) return fallback;
    if (typeof v === "object") return v;
    return JSON.parse(String(v));
  } catch {
    return fallback;
  }
}

function computeDecayDelta(lastActiveAt) {
  if (!lastActiveAt) return { decayed: false, sceneProgressDelta: 0, treesDelta: 0 };
  const last = new Date(lastActiveAt).getTime();
  if (!Number.isFinite(last)) return { decayed: false, sceneProgressDelta: 0, treesDelta: 0 };
  const now = Date.now();
  const hours = Math.floor((now - last) / (1000 * 60 * 60));
  if (hours <= 0) return { decayed: false, sceneProgressDelta: 0, treesDelta: 0 };

  // v2: only start decaying after 3 days of no engagement
  const days = Math.floor(hours / 24);
  if (days < 3) return { decayed: false, sceneProgressDelta: 0, treesDelta: 0 };
  return {
    decayed: true,
    sceneProgressDelta: -Math.min(10, days),
    treesDelta: -Math.min(5, days),
    placementsRemove: Math.min(20, days * 2),
  };
}

function ymdLocal(d = new Date()) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function clampInt(n, lo, hi) {
  const v = Number.isFinite(n) ? Math.trunc(n) : parseInt(n, 10);
  const vv = Number.isFinite(v) ? v : 0;
  return Math.max(lo, Math.min(hi, vv));
}

const TASKS = [
  {
    id: 1,
    title: "Walk or cycle a trip",
    desc: "Replace at least one car trip with walking or cycling today.",
    coins: 30,
    co2: 340,
    cat: "transport",
    icon: "🚶",
  },
  {
    id: 2,
    title: "Use public transport",
    desc: "Take a bus, tram or train instead of driving.",
    coins: 25,
    co2: 280,
    cat: "transport",
    icon: "🚌",
  },
  {
    id: 3,
    title: "Bring a reusable cup",
    desc: "Use your own cup for coffee or drinks — no single-use today.",
    coins: 20,
    co2: 80,
    cat: "habit",
    icon: "☕",
  },
  {
    id: 4,
    title: "Turn off standby devices",
    desc: "Switch off devices fully instead of leaving them on standby.",
    coins: 20,
    co2: 120,
    cat: "energy",
    icon: "🔌",
  },
  {
    id: 5,
    title: "Plant-based meal",
    desc: "Have at least one fully plant-based meal today.",
    coins: 25,
    co2: 500,
    cat: "food",
    icon: "🥗",
  },
  {
    id: 6,
    title: "Daily check-in",
    desc: "Log in and review your climate impact for today.",
    coins: 10,
    co2: 0,
    cat: "habit",
    icon: "✅",
  },
];

const QUIZ_BANK = [
  {
    q: "Which sector contributes most to Melbourne's greenhouse gas emissions?",
    opts: ["Transport", "Energy (electricity & gas)", "Waste", "Agriculture"],
    ans: 1,
    exp: "Energy (electricity and gas) accounts for ~54% of Melbourne's GHG emissions (City of Melbourne data).",
  },
  {
    q: "How much CO₂ does walking 2 km save vs driving the same distance?",
    opts: ["~100 g", "~340 g", "~1 kg", "~50 g"],
    ans: 1,
    exp: "Based on Australian Government NGA Emission Factors, a 2 km car trip emits ~340 g CO₂.",
  },
  {
    q: 'What does "net zero" mean?',
    opts: ["Zero industrial emissions", "Emissions = removals", "50% emission cut", "No fossil fuels"],
    ans: 1,
    exp: "Net zero means greenhouse gas emissions equal the amount removed from the atmosphere.",
  },
  {
    q: "Roughly what % of 18–34 Australians worry about climate change?",
    opts: ["40%", "60%", "80%", "95%"],
    ans: 2,
    exp: "NCLS Research (2025): 80% of 18–34 year-olds are at least moderately worried.",
  },
  {
    q: "How long can a plastic bag take to decompose?",
    opts: ["10 years", "50 years", "500 years", "5,000 years"],
    ans: 2,
    exp: "Plastic bags can take up to 500 years to break down in landfill.",
  },
  {
    q: "A plant-based diet produces roughly how much less CO₂ than a high-meat diet?",
    opts: ["Same", "~1.5× less", "~2.5× less", "~10× less"],
    ans: 2,
    exp: "Research shows a vegan diet emits ~2.5× less CO₂ than a high-meat diet.",
  },
  {
    q: "Iceland generates nearly all its electricity from:",
    opts: ["Coal", "Natural gas", "Nuclear", "Renewables (geothermal/hydro)"],
    ans: 3,
    exp: "Iceland generates ~100% of electricity from renewable geothermal and hydro sources.",
  },
];

function dayIdx() {
  return new Date().getDate() % QUIZ_BANK.length;
}

function adminSecretMatches(provided) {
  const secret = process.env.ADMIN_SECRET;
  if (!secret || typeof provided !== "string") return false;
  const a = Buffer.from(secret, "utf8");
  const b = Buffer.from(provided, "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

// Ops only: set user coins (enabled only when ADMIN_SECRET is set on the host).
// Call from curl/Postman against Render — do not expose secret in frontend code.
if (process.env.ADMIN_SECRET) {
  app.post("/api/admin/set-coins", async (req, res, next) => {
    try {
      const hdr = String(req.headers["x-admin-secret"] || "");
      if (!adminSecretMatches(hdr)) {
        return res.status(401).json({ error: "UNAUTHORIZED" });
      }
      const username = normalizeUsername(req.body?.username);
      const coins = Number(req.body?.coins);
      if (!isValidUsername(username)) {
        return res.status(400).json({ error: "INVALID_USERNAME" });
      }
      if (!Number.isFinite(coins) || coins < 0 || coins > 2147483647) {
        return res.status(400).json({ error: "INVALID_COINS" });
      }
      const found = await query(
        `select id from users where username = ? limit 1`,
        [username]
      );
      if (!found.rows?.length) {
        return res.status(404).json({ error: "USER_NOT_FOUND" });
      }
      const userId = found.rows[0].id;
      await query(
        `insert into user_state (user_id, coins)
         values (?, ?)
         on duplicate key update coins = values(coins)`,
        [userId, coins]
      );
      res.json({ ok: true, username, coins: Math.trunc(coins) });
    } catch (err) {
      next(err);
    }
  });
}

async function maybeStartupSetCoins() {
  const username = normalizeUsername(process.env.STARTUP_SET_COINS_USERNAME || "");
  const coinsRaw = process.env.STARTUP_SET_COINS_VALUE;
  if (!username || coinsRaw == null || coinsRaw === "") return;

  const coins = parseInt(String(coinsRaw).replace(/_/g, ""), 10);
  if (!isValidUsername(username) || !Number.isFinite(coins) || coins < 0 || coins > 2147483647) {
    // eslint-disable-next-line no-console
    console.error({
      message: "Startup coin set skipped (invalid env)",
      username,
      coinsRaw,
    });
    return;
  }

  try {
    const found = await query(`select id from users where username = ? limit 1`, [username]);
    if (!found.rows?.length) {
      // eslint-disable-next-line no-console
      console.log(`Startup coin set: user not found (${username})`);
      return;
    }
    const userId = found.rows[0].id;
    await ensureUserState(userId);
    await query(`update user_state set coins = ? where user_id = ?`, [coins, userId]);
    // eslint-disable-next-line no-console
    console.log(`Startup coin set OK: ${username} -> ${coins}`);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error({
      message: "Startup coin set failed",
      error: e?.message,
      code: e?.code,
    });
  }
}

// Authentication is intentionally *passwordless* for this project:
// - Register: create a new username (409 if taken)
// - Signin: log in with existing username (404 if not found)
// This avoids maintaining password reset flows for a course prototype.

// Explicit passwordless register: must be new username
app.post("/api/auth/username-register", async (req, res, next) => {
  try {
    const username = normalizeUsername(req.body?.username);
    const displayName = normalizeDisplayName(req.body?.displayName);

    if (!isValidUsername(username)) {
      return res.status(400).json({ error: "INVALID_USERNAME" });
    }

    const existing = await query(`select id from users where username = ? limit 1`, [username]);
    if (existing.rows && existing.rows.length > 0) {
      return res.status(409).json({ error: "USERNAME_TAKEN" });
    }

    const placeholderSecret = crypto.randomBytes(24).toString("hex");
    const passwordHash = await bcrypt.hash(placeholderSecret, 12);

    await query(
      `insert into users (username, password_hash, display_name)
       values (?, ?, ?)`,
      [username, passwordHash, displayName]
    );

    const result = await query(
      `select id, username, display_name, created_at
       from users
       where username = ?`,
      [username]
    );
    const user = publicUserRow(result.rows[0] || {});
    await setLoggedInSession(req, user.id);
    await ensureUserState(user.id);
    res.status(201).json({ user });
  } catch (err) {
    if (err && (err.code === "ER_DUP_ENTRY" || err.code === "ER_DUP_KEY")) {
      return res.status(409).json({ error: "USERNAME_TAKEN" });
    }
    next(err);
  }
});

// Explicit passwordless signin: must already exist
app.post("/api/auth/username-signin", async (req, res, next) => {
  try {
    const username = normalizeUsername(req.body?.username);

    if (!isValidUsername(username)) {
      return res.status(400).json({ error: "INVALID_USERNAME" });
    }

    const existing = await query(
      `select id, username, display_name, created_at
       from users
       where username = ?
       limit 1`,
      [username]
    );
    if (!existing.rows || existing.rows.length === 0) {
      return res.status(404).json({ error: "USER_NOT_FOUND" });
    }

    const row = existing.rows[0];
    await setLoggedInSession(req, row.id);
    await ensureUserState(row.id);
    res.status(200).json({ user: publicUserRow(row) });
  } catch (err) {
    next(err);
  }
});

app.post("/api/auth/logout", (req, res, next) => {
  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie(process.env.SESSION_NAME || "ecoquest.sid");
    res.json({ ok: true });
  });
});

app.get("/api/auth/me", async (req, res, next) => {
  try {
    const userId = req.session.userId;
    if (!userId) return res.status(200).json({ user: null });
    await ensureUserState(userId);

    const result = await query(
      `select id, username, display_name, created_at
       from users
       where id = ?`,
      [userId]
    );

    if (!result.rows || result.rows.length === 0) {
      req.session.userId = null;
      return res.status(200).json({ user: null });
    }

    res.json({ user: publicUserRow(result.rows[0]) });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────
// Iteration 1: user-bound game endpoints
// ─────────────────────────────────────────────────────────────

app.get("/api/tasks", async (req, res, next) => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;
    await ensureUserState(userId);

    const today = ymdLocal();
    const done = await query(
      `select task_id
       from task_logs
       where user_id = ?
         and completed_on = ?`,
      [userId, today]
    );
    const doneSet = new Set((done.rows || []).map((r) => r.task_id));
    res.json(TASKS.map((t) => ({ ...t, completed: doneSet.has(t.id) })));
  } catch (err) {
    next(err);
  }
});

app.post("/api/tasks/:id/complete", async (req, res, next) => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;
    await ensureUserState(userId);

    const id = parseInt(req.params.id, 10);
    const task = TASKS.find((t) => t.id === id);
    if (!task) return res.status(404).json({ error: "TASK_NOT_FOUND" });

    const today = ymdLocal();
    try {
      await query(
        `insert into task_logs (user_id, task_id, completed_on, coins_earned, co2_saved)
         values (?, ?, ?, ?, ?)`,
        [userId, task.id, today, task.coins, task.co2]
      );
    } catch (e) {
      if (e && (e.code === "ER_DUP_ENTRY" || e.code === "ER_DUP_KEY")) {
        return res.status(409).json({ error: "ALREADY_COMPLETED_TODAY" });
      }
      throw e;
    }

    await query(
      `update user_state
       set coins = coins + ?,
           xp = xp + ?,
           scene_progress = least(100, scene_progress + 2)
       where user_id = ?`,
      [task.coins, task.coins, userId]
    );

    const st = await query(
      `select coins, xp, scene_progress from user_state where user_id = ?`,
      [userId]
    );
    const state = st.rows?.[0] || {};

    const days = await query(
      `select distinct completed_on as d
       from task_logs
       where user_id = ?
       order by d desc
       limit 365`,
      [userId]
    );
    const doneDays = new Set(
      (days.rows || []).map((r) => ymdLocal(new Date(r.d)))
    );
    let streak = 0;
    for (let i = 0; i < 365; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const k = ymdLocal(d);
      if (doneDays.has(k)) streak += 1;
      else if (i > 0) break;
    }

    res.json({
      success: true,
      coinsEarned: task.coins,
      totalCoins: Number(state.coins || 0),
      co2Saved: task.co2,
      sceneProgress: Number(state.scene_progress || 0),
      streak,
    });
  } catch (err) {
    next(err);
  }
});

app.get("/api/scene", async (req, res, next) => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;
    await ensureUserState(userId);
    const r = await query(
      `select scene_type as type, scene_progress as progress
       from user_state
       where user_id = ?`,
      [userId]
    );
    res.json(r.rows?.[0] || { type: "forest", progress: 0 });
  } catch (err) {
    next(err);
  }
});

app.post("/api/scene/select", async (req, res, next) => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;
    await ensureUserState(userId);
    const type = String(req.body?.type || "").trim();
    if (!["forest", "glacier", "cityGreen"].includes(type)) {
      return res.status(400).json({ error: "INVALID_SCENE_TYPE" });
    }
    const cur = await query(
      `select scene_type, theme_locked from user_state where user_id = ?`,
      [userId]
    );
    const locked = Number(cur.rows?.[0]?.theme_locked || 0) === 1;
    if (locked) return res.status(409).json({ error: "THEME_LOCKED" });

    await query(
      `update user_state
       set scene_type = ?, theme_locked = 1, coins = greatest(coins, 120)
       where user_id = ?`,
      [type, userId]
    );
    const r = await query(
      `select scene_type as type, scene_progress as progress, theme_locked
       from user_state
       where user_id = ?`,
      [userId]
    );
    const row = r.rows?.[0] || { type, progress: 0, theme_locked: 1 };
    res.json({ type: row.type, progress: row.progress, themeLocked: !!row.theme_locked });
  } catch (err) {
    next(err);
  }
});

app.post("/api/game/reset", async (req, res, next) => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;
    await ensureUserState(userId);

    await query(
      `update user_state
       set coins = 0,
           xp = 0,
           scene_type = 'forest',
           theme_locked = 0,
           scene_progress = 0,
           trees = 0,
           flowers = 0,
           placements_json = null,
           last_active_at = now()
       where user_id = ?`,
      [userId]
    );

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

function normalizePlacementItem(p) {
  if (!p || typeof p !== "object") return null;
  const itemId = p.itemId ? String(p.itemId) : null;
  const type = p.type ? String(p.type) : null;
  const col = Number.isFinite(p.col) ? Math.trunc(p.col) : null;
  const row = Number.isFinite(p.row) ? Math.trunc(p.row) : null;
  const at = p.at ? String(p.at) : null;
  return { itemId, type, col, row, at };
}

function placementsByThemeFromJson(raw, fallbackTheme) {
  const v = safeJsonParse(raw, null);
  if (!v) return {};
  // legacy: { items: [...] }
  if (v && typeof v === "object" && Array.isArray(v.items)) {
    return { [fallbackTheme]: { items: v.items } };
  }
  // modern: { forest: {items:[]}, glacier: {...}, ... }
  return v && typeof v === "object" ? v : {};
}

function getThemePlacements(byTheme, theme) {
  if (!byTheme[theme] || typeof byTheme[theme] !== "object") byTheme[theme] = { items: [] };
  if (!Array.isArray(byTheme[theme].items)) byTheme[theme].items = [];
  return byTheme[theme];
}

function clampGrid(n, size) {
  const v = Number.isFinite(n) ? Math.trunc(n) : parseInt(n, 10);
  if (!Number.isFinite(v)) return null;
  return Math.max(0, Math.min(size - 1, v));
}

app.post("/api/scene/place", async (req, res, next) => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;
    await ensureUserState(userId);

    const itemId = req.body?.itemId ? String(req.body.itemId).trim() : "";
    const type = req.body?.type ? String(req.body.type).trim() : "";
    const col = clampGrid(req.body?.col, 20);
    const row = clampGrid(req.body?.row, 20);
    if (!itemId || !type || col == null || row == null) {
      return res.status(400).json({ error: "INVALID_PLACEMENT" });
    }

    const r = await query(
      `select scene_type, placements_json from user_state where user_id = ?`,
      [userId]
    );
    const s = r.rows?.[0] || {};
    const theme = s.scene_type || "forest";
    const byTheme = placementsByThemeFromJson(s.placements_json, theme);
    const placements = getThemePlacements(byTheme, theme);

    const k = `${col},${row}`;
    const exists = placements.items.some(
      (p) => p && String(p.itemId || "") === itemId && String(p.col) + "," + String(p.row) === k
    );
    if (!exists) {
      placements.items.push({
        itemId,
        type,
        col,
        row,
        at: new Date().toISOString(),
      });
    }

    await query(
      `update user_state set placements_json = ? where user_id = ?`,
      [JSON.stringify(byTheme), userId]
    );
    await touchActive(userId);

    res.json({ ok: true, placements });
  } catch (err) {
    next(err);
  }
});

app.post("/api/scene/remove", async (req, res, next) => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;
    await ensureUserState(userId);

    const itemId = req.body?.itemId ? String(req.body.itemId).trim() : "";
    const col = clampGrid(req.body?.col, 20);
    const row = clampGrid(req.body?.row, 20);
    if (col == null || row == null) return res.status(400).json({ error: "INVALID_PLACEMENT" });

    const r = await query(
      `select scene_type, placements_json from user_state where user_id = ?`,
      [userId]
    );
    const s = r.rows?.[0] || {};
    const theme = s.scene_type || "forest";
    const byTheme = placementsByThemeFromJson(s.placements_json, theme);
    const placements = getThemePlacements(byTheme, theme);

    // remove one (last match) at cell; prefer itemId match if provided
    let idx = -1;
    for (let i = placements.items.length - 1; i >= 0; i--) {
      const p = normalizePlacementItem(placements.items[i]);
      if (!p) continue;
      if (p.col !== col || p.row !== row) continue;
      if (itemId && p.itemId !== itemId) continue;
      idx = i;
      break;
    }
    if (idx >= 0) placements.items.splice(idx, 1);

    await query(
      `update user_state set placements_json = ? where user_id = ?`,
      [JSON.stringify(byTheme), userId]
    );
    await touchActive(userId);
    res.json({ ok: true, placements });
  } catch (err) {
    next(err);
  }
});

app.post("/api/scene/move", async (req, res, next) => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;
    await ensureUserState(userId);

    const itemId = req.body?.itemId ? String(req.body.itemId).trim() : "";
    const fromCol = clampGrid(req.body?.fromCol, 20);
    const fromRow = clampGrid(req.body?.fromRow, 20);
    const toCol = clampGrid(req.body?.toCol, 20);
    const toRow = clampGrid(req.body?.toRow, 20);
    if (!itemId || fromCol == null || fromRow == null || toCol == null || toRow == null) {
      return res.status(400).json({ error: "INVALID_PLACEMENT" });
    }

    const r = await query(
      `select scene_type, placements_json from user_state where user_id = ?`,
      [userId]
    );
    const s = r.rows?.[0] || {};
    const theme = s.scene_type || "forest";
    const byTheme = placementsByThemeFromJson(s.placements_json, theme);
    const placements = getThemePlacements(byTheme, theme);

    // find one to move (last match) from cell
    let idx = -1;
    for (let i = placements.items.length - 1; i >= 0; i--) {
      const p = normalizePlacementItem(placements.items[i]);
      if (!p) continue;
      if (p.itemId !== itemId) continue;
      if (p.col !== fromCol || p.row !== fromRow) continue;
      idx = i;
      break;
    }
    if (idx >= 0) {
      placements.items[idx] = {
        ...placements.items[idx],
        col: toCol,
        row: toRow,
        at: new Date().toISOString(),
      };
    }

    await query(
      `update user_state set placements_json = ? where user_id = ?`,
      [JSON.stringify(byTheme), userId]
    );
    await touchActive(userId);
    res.json({ ok: true, placements });
  } catch (err) {
    next(err);
  }
});

app.get("/api/quiz", async (req, res, next) => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;
    await ensureUserState(userId);
    const today = ymdLocal();
    const idx = dayIdx();

    const done = await query(
      `select 1 as ok
       from quiz_results
       where user_id = ?
         and completed_on = ?
       limit 1`,
      [userId, today]
    );
    const completed = (done.rows || []).length > 0;
    const q = QUIZ_BANK[idx];
    res.json({
      question: { q: q.q, opts: q.opts },
      completed,
      idx,
    });
  } catch (err) {
    next(err);
  }
});

app.post("/api/quiz/submit", async (req, res, next) => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;
    await ensureUserState(userId);

    const idx = clampInt(req.body?.idx, 0, QUIZ_BANK.length - 1);
    const answer = clampInt(req.body?.answer, 0, 3);
    const q = QUIZ_BANK[idx];
    const today = ymdLocal();

    const correct = answer === q.ans;
    const coinsEarned = correct ? 25 : 0;

    try {
      await query(
        `insert into quiz_results (user_id, quiz_idx, completed_on, answer, correct, coins_earned)
         values (?, ?, ?, ?, ?, ?)`,
        [userId, idx, today, answer, correct ? 1 : 0, coinsEarned]
      );
    } catch (e) {
      if (e && (e.code === "ER_DUP_ENTRY" || e.code === "ER_DUP_KEY")) {
        return res.status(409).json({ error: "ALREADY_COMPLETED_TODAY" });
      }
      throw e;
    }

    if (correct) {
      await query(
        `update user_state
         set coins = coins + ?,
             xp = xp + ?,
             scene_progress = least(100, scene_progress + 3)
         where user_id = ?`,
        [25, 25, userId]
      );
    }

    res.json({
      correct,
      correctAnswer: q.ans,
      explanation: q.exp,
      coinsEarned,
    });
  } catch (err) {
    next(err);
  }
});

app.get("/api/progress", async (req, res, next) => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;
    await ensureUserState(userId);

    const today = ymdLocal();
    const st = await query(
      `select coins, xp, scene_progress
       from user_state
       where user_id = ?`,
      [userId]
    );
    const state = st.rows?.[0] || { coins: 0, xp: 0, scene_progress: 0 };

    const todayDoneR = await query(
      `select count(*) as c
       from task_logs
       where user_id = ?
         and completed_on = ?`,
      [userId, today]
    );
    const todayDone = Number(todayDoneR.rows?.[0]?.c || 0);

    const allTimeTasksR = await query(
      `select count(*) as c, coalesce(sum(co2_saved), 0) as co2
       from task_logs
       where user_id = ?`,
      [userId]
    );
    const allTimeTasks = Number(allTimeTasksR.rows?.[0]?.c || 0);
    const co2Saved = Number(allTimeTasksR.rows?.[0]?.co2 || 0);

    const weekR = await query(
      `select completed_on as d, count(*) as c
       from task_logs
       where user_id = ?
         and completed_on >= date_sub(?, interval 6 day)
       group by completed_on
       order by completed_on asc`,
      [userId, today]
    );
    const byDay = new Map(
      (weekR.rows || []).map((r) => [ymdLocal(new Date(r.d)), Number(r.c || 0)])
    );
    const week = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const k = ymdLocal(d);
      const label = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()];
      week.push({ date: k, label, count: byDay.get(k) || 0 });
    }

    const activeDaysR = await query(
      `select d from (
         select distinct completed_on as d
         from task_logs
         where user_id = ?
         union
         select distinct completed_on as d
         from quiz_results
         where user_id = ?
       ) x
       order by d desc
       limit 365`,
      [userId, userId]
    );
    const activeSet = new Set(
      (activeDaysR.rows || []).map((r) => ymdLocal(new Date(r.d)))
    );
    let streak = 0;
    for (let i = 0; i < 365; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const k = ymdLocal(d);
      if (activeSet.has(k)) streak += 1;
      else if (i > 0) break;
    }

    const xp = Number(state.xp || 0);
    const level = Math.floor(xp / 200) + 1;
    const xpInLevel = xp % 200;

    res.json({
      coins: Number(state.coins || 0),
      xp,
      level,
      xpInLevel,
      streak,
      todayDone,
      totalTasks: TASKS.length,
      allTimeTasks,
      co2Saved,
      week,
    });
  } catch (err) {
    next(err);
  }
});

app.get("/api/leaderboard", async (req, res, next) => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;
    await ensureUserState(userId);

    const me = await query(`select username from users where id = ?`, [userId]);
    const myUsername = me.rows?.[0]?.username || null;

    const r = await query(
      `select u.username, u.display_name, s.coins, s.xp
       from user_state s
       join users u on u.id = s.user_id
       order by s.coins desc, s.xp desc, u.created_at asc
       limit 20`
    );

    const rows = r.rows || [];
    const board = rows.map((row, i) => {
      const xp = Number(row.xp || 0);
      return {
        rank: i + 1,
        username: row.username,
        displayName: row.display_name || "",
        coins: Number(row.coins || 0),
        level: Math.floor(xp / 200) + 1,
        streak: 0,
        isYou: myUsername ? row.username === myUsername : false,
      };
    });

    res.json(board);
  } catch (err) {
    next(err);
  }
});

app.get("/api/game/state", async (req, res, next) => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;
    await ensureUserState(userId);

    const r = await query(
      `select coins, xp, scene_type, theme_locked, scene_progress, last_active_at, trees, flowers, placements_json
       from user_state
       where user_id = ?`,
      [userId]
    );
    const s = r.rows?.[0] || {};

    const decay = computeDecayDelta(s.last_active_at);
    if (decay.decayed) {
      const theme = s.scene_type || "forest";
      const byTheme0 = placementsByThemeFromJson(s.placements_json, theme);
      const placements0 = getThemePlacements(byTheme0, theme);
      const removed = [];
      if (decay.placementsRemove && placements0.items.length > 0) {
        for (let i = placements0.items.length - 1; i >= 0 && removed.length < decay.placementsRemove; i--) {
          const p = placements0.items[i];
          const t = String(p?.type || "");
          if (t === "tree" || t === "ground") removed.push(placements0.items.splice(i, 1)[0]);
        }
        for (let i = placements0.items.length - 1; i >= 0 && removed.length < decay.placementsRemove; i--) {
          removed.push(placements0.items.splice(i, 1)[0]);
        }
      }
      await query(
        `update user_state
         set scene_progress = greatest(0, least(100, scene_progress + ?)),
             trees = greatest(0, trees + ?),
             placements_json = ?
         where user_id = ?`,
        [decay.sceneProgressDelta, decay.treesDelta, JSON.stringify(byTheme0), userId]
      );
    }

    const r2 = await query(
      `select coins, xp, scene_type, theme_locked, scene_progress, last_active_at, trees, flowers, placements_json
       from user_state
       where user_id = ?`,
      [userId]
    );
    const st = r2.rows?.[0] || {};

    const theme = st.scene_type || "forest";
    const byTheme = placementsByThemeFromJson(st.placements_json, theme);
    const placements = getThemePlacements(byTheme, theme);

    res.json({
      themeType: st.scene_type || "forest",
      themeLocked: Number(st.theme_locked || 0) === 1,
      sceneProgress: Number(st.scene_progress || 0),
      coins: Number(st.coins || 0),
      xp: Number(st.xp || 0),
      trees: Number(st.trees || 0),
      flowers: Number(st.flowers || 0),
      placements,
      lastActiveAt: st.last_active_at || null,
      decayApplied: decay.decayed ? decay : null,
    });
  } catch (err) {
    next(err);
  }
});

app.post("/api/shop/buy", async (req, res, next) => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;
    await ensureUserState(userId);

    const item = String(req.body?.item || "").trim();
    const itemId = req.body?.itemId ? String(req.body.itemId).trim() : "";
    const qty = clampInt(req.body?.qty, 1, 50);
    if (!["tree", "flower", "ground", "ice", "decor"].includes(item)) {
      return res.status(400).json({ error: "INVALID_ITEM" });
    }

    const PRICES_BY_ITEM_ID = {
      forest_tree_a: 40,
      forest_tree_b: 45,
      forest_flower_a: 12,
      forest_flower_b: 12,
      forest_grass_a: 8,
      forest_grass_b: 10,
      glacier_ice_a: 35,
      glacier_ice_b: 40,
      glacier_snow_a: 10,
      glacier_snow_b: 10,
      city_pave_a: 10,
      city_pave_b: 10,
      city_tree_a: 45,
      city_tree_b: 40,
      city_flower_a: 12,
      city_flower_b: 12,
    };
    const DEFAULT_KIND_PRICE = { tree: 40, flower: 12, ground: 8, ice: 35, decor: 15 };
    // Allow new decorative itemIds without server redeploy:
    // if itemId is unknown, fall back to kind-based price.
    const price = itemId && itemId in PRICES_BY_ITEM_ID ? PRICES_BY_ITEM_ID[itemId] : DEFAULT_KIND_PRICE[item];
    const cost = Number(price) * qty;

    const r = await query(
      `select coins, trees, flowers
       from user_state
       where user_id = ?`,
      [userId]
    );
    const s = r.rows?.[0] || {};
    const coins = Number(s.coins || 0);
    if (coins < cost) {
      return res.status(400).json({ error: "INSUFFICIENT_COINS", cost, coins });
    }

    if (item === "tree") {
      await query(
        `update user_state
         set coins = coins - ?,
             trees = trees + ?
         where user_id = ?`,
        [cost, qty, userId]
      );
    } else if (item === "flower") {
      await query(
        `update user_state
         set coins = coins - ?,
             flowers = flowers + ?
         where user_id = ?`,
        [cost, qty, userId]
      );
    } else {
      await query(
        `update user_state
         set coins = coins - ?
         where user_id = ?`,
        [cost, userId]
      );
    }

    await touchActive(userId);

    const r2 = await query(
      `select coins, trees, flowers
       from user_state
       where user_id = ?`,
      [userId]
    );
    const s2 = r2.rows?.[0] || {};

    res.json({
      ok: true,
      item,
      itemId: itemId || null,
      qty,
      cost,
      coins: Number(s2.coins || 0),
      trees: Number(s2.trees || 0),
      flowers: Number(s2.flowers || 0),
      placements: null,
    });
  } catch (err) {
    next(err);
  }
});

app.post("/api/auth/username", async (req, res, next) => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;

    const username = normalizeUsername(req.body?.username);
    if (!isValidUsername(username)) {
      return res.status(400).json({ error: "INVALID_USERNAME" });
    }

    await query(`update users set username = ? where id = ?`, [username, userId]);
    const result = await query(
      `select id, username, display_name, created_at from users where id = ?`,
      [userId]
    );
    res.json({ user: publicUserRow(result.rows[0]) });
  } catch (err) {
    if (err && (err.code === "ER_DUP_ENTRY" || err.code === "ER_DUP_KEY")) {
      return res.status(409).json({ error: "USERNAME_TAKEN" });
    }
    next(err);
  }
});


// Basic error handler
app.use((err, req, res, next) => {
  const status = err && typeof err.status === "number" ? err.status : 500;
  // Always log server errors in Render logs (avoid leaking secrets in response body)
  // eslint-disable-next-line no-console
  console.error({
    message: err?.message,
    code: err?.code,
    errno: err?.errno,
    sqlState: err?.sqlState,
  });
  res.status(status).json({
    error: status === 500 ? err?.code || "INTERNAL_ERROR" : "REQUEST_ERROR",
    message: NODE_ENV === "production" ? undefined : String(err?.message || err),
  });
});

app.listen(PORT, async () => {
  await ensureDbBootstrapped();
  await maybeStartupSetCoins();
  // eslint-disable-next-line no-console
  console.log(`EcoQuest auth server listening on :${PORT}`);
  console.log(`CORS origin: ${FRONTEND_ORIGIN}`);
  console.log(`Session cookie secure: ${cookieSecure}, sameSite: ${cookieSameSite}`);
});

