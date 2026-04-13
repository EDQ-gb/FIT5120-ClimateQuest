const express = require("express");
const cors = require("cors");
const session = require("express-session");
const MySQLStoreFactory = require("express-mysql-session");
const bcrypt = require("bcrypt");

const { FRONTEND_ORIGIN, NODE_ENV, PORT, SESSION_SECRET } = require("./config");
const { getPool, query } = require("./db");

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

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

app.post("/api/auth/register", async (req, res, next) => {
  try {
    const username = normalizeUsername(req.body?.username);
    const password = req.body?.password;
    const displayName = normalizeDisplayName(req.body?.displayName);

    if (!isValidUsername(username)) {
      return res.status(400).json({ error: "INVALID_USERNAME" });
    }
    if (!isValidPassword(password)) {
      return res.status(400).json({ error: "WEAK_PASSWORD", minLength: 8 });
    }

    const passwordHash = await bcrypt.hash(password, 12);

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
    res.status(201).json({ user });
  } catch (err) {
    if (err && (err.code === "ER_DUP_ENTRY" || err.code === "ER_DUP_KEY")) {
      return res.status(409).json({ error: "USERNAME_TAKEN" });
    }
    next(err);
  }
});

app.post("/api/auth/login", async (req, res, next) => {
  try {
    const username = normalizeUsername(req.body?.username);
    const password = req.body?.password;

    if (!isValidUsername(username)) {
      return res.status(400).json({ error: "INVALID_USERNAME" });
    }
    if (typeof password !== "string" || !password) {
      return res.status(400).json({ error: "INVALID_PASSWORD" });
    }

    const result = await query(
      `select id, username, display_name, created_at, password_hash
       from users
       where username = ?`,
      [username]
    );

    if (!result.rows || result.rows.length === 0) {
      return res.status(401).json({ error: "INVALID_CREDENTIALS" });
    }

    const row = result.rows[0];
    const ok = await bcrypt.compare(password, row.password_hash);
    if (!ok) return res.status(401).json({ error: "INVALID_CREDENTIALS" });

    const user = publicUserRow(row);
    await setLoggedInSession(req, user.id);
    res.json({ user });
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

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`EcoQuest auth server listening on :${PORT}`);
  console.log(`CORS origin: ${FRONTEND_ORIGIN}`);
  console.log(`Session cookie secure: ${cookieSecure}, sameSite: ${cookieSameSite}`);
});

