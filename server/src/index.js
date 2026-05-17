const express = require("express");
const cors = require("cors");
const session = require("express-session");
const MySQLStoreFactory = require("express-mysql-session");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const { FRONTEND_ORIGINS, NODE_ENV, PORT, SESSION_SECRET } = require("./config");
const { getPool, query, exec } = require("./db");
const { recipeErrorToClientResponse } = require("./recipe_user_errors");

const app = express();

app.disable("x-powered-by");
// Required for secure cookies behind Render/Vercel proxies (x-forwarded-proto)
if (NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

app.use(express.json({ limit: "2mb" }));

app.use(
  cors({
    origin(origin, callback) {
      // Allow non-browser/server-to-server calls that do not send Origin.
      if (!origin) return callback(null, true);
      if (FRONTEND_ORIGINS.includes(origin)) return callback(null, true);
      return callback(null, false);
    },
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
const noDatabaseMode = !mysqlPool;
const demoUsers = new Map();
let demoUserSeq = 1;

function demoPublicUser(row) {
  return {
    id: row.id,
    username: row.username,
    displayName: row.displayName || "",
    createdAt: row.createdAt,
    profilePublic: true,
  };
}

function getDemoUserById(id) {
  for (const user of demoUsers.values()) {
    if (Number(user.id) === Number(id)) return user;
  }
  return null;
}

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

function publicUserRow(row, opts = {}) {
  const base = {
    id: row.id,
    username: row.username,
    displayName: row.display_name || "",
    createdAt: row.created_at,
  };
  if (opts.includeSettings) {
    base.profilePublic =
      row.profile_public === undefined || row.profile_public === null
        ? true
        : Number(row.profile_public) === 1;
  }
  return base;
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
    `insert into user_state (user_id, coins)
     values (?, 120)
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

let _projectExtensions = null;
async function ensureProjectExtensions() {
  if (_projectExtensions) return _projectExtensions;
  _projectExtensions = (async () => {
    try {
      const col = await query(`show columns from users like 'profile_public'`);
      if (!col.rows || col.rows.length === 0) {
        await exec(
          `alter table users add column profile_public tinyint(1) not null default 1`
        );
      }
      await exec(`
        create table if not exists check_ins (
          id bigint unsigned not null auto_increment,
          user_id bigint unsigned not null,
          checked_on date not null,
          coins_earned int not null default 10,
          created_at timestamp not null default current_timestamp,
          primary key (id),
          unique key uq_check_user_day (user_id, checked_on),
          constraint fk_check_ins_user foreign key (user_id) references users(id) on delete cascade
        )`);
      await exec(`
        create table if not exists weekly_progress (
          user_id bigint unsigned not null,
          week_start date not null,
          tasks_completed int not null default 0,
          goal int not null default 5,
          reward_claimed tinyint(1) not null default 0,
          bonus_coins int not null default 40,
          updated_at timestamp not null default current_timestamp on update current_timestamp,
          primary key (user_id, week_start),
          constraint fk_weekly_user foreign key (user_id) references users(id) on delete cascade
        )`);
      await exec(`
        create table if not exists shop_ledger (
          id bigint unsigned not null auto_increment,
          user_id bigint unsigned not null,
          item varchar(32) not null,
          item_id varchar(80) null,
          cost int not null,
          created_at timestamp not null default current_timestamp,
          primary key (id),
          key ix_shop_user_time (user_id, created_at),
          constraint fk_shop_ledger_user foreign key (user_id) references users(id) on delete cascade
        )`);
      await exec(`
        create table if not exists quick_action_logs (
          id bigint unsigned not null auto_increment,
          user_id bigint unsigned not null,
          action_key varchar(64) not null,
          logged_on date not null,
          coins_earned int not null default 5,
          created_at timestamp not null default current_timestamp,
          primary key (id),
          unique key uq_quick_user_key_day (user_id, action_key, logged_on),
          constraint fk_quick_action_user foreign key (user_id) references users(id) on delete cascade
        )`);
      return true;
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error({ message: "ensureProjectExtensions failed", error: e?.message, code: e?.code });
      return false;
    }
  })();
  return _projectExtensions;
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

let recipeModelCooldownUntil = 0;
const recipeFastCache = new Map();

function textToSteps(text) {
  const normalized = String(text || "")
    .replace(/\r/g, " ")
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return [];
  return normalized
    .split(/(?<=[.!?])\s+/)
    .map((x) => x.replace(/^[-*]\s*/, "").trim())
    .filter(Boolean)
    .slice(0, 8);
}

function recipeFastCloudEnabled() {
  return String(process.env.RECIPE_FAST_CLOUD_ENABLED || "1").trim() !== "0";
}

function recipeFastFallbackToLocal() {
  return String(process.env.RECIPE_FAST_FALLBACK_TO_LOCAL || "0").trim() === "1";
}

function recipeFastCloudTimeoutMs() {
  const timeoutMs = Number(process.env.RECIPE_FAST_TIMEOUT_MS || 12000);
  return Number.isFinite(timeoutMs) && timeoutMs >= 2000 && timeoutMs <= 60000
    ? Math.floor(timeoutMs)
    : 12000;
}

function recipeFastCloudCacheTtlMs() {
  const ttlMs = Number(process.env.RECIPE_FAST_CACHE_TTL_MS || 6 * 60 * 60 * 1000);
  return Number.isFinite(ttlMs) && ttlMs >= 60000 && ttlMs <= 24 * 60 * 60 * 1000
    ? Math.floor(ttlMs)
    : 6 * 60 * 60 * 1000;
}

function recipeFastCloudModel() {
  const configured = String(process.env.RECIPE_FAST_MODEL || "").trim();
  return configured || "openai-fast";
}

function recipeFastCloudPrompt(ingredients) {
  const joined = ingredients.join(", ");
  return [
    "You are a concise low-carbon meal assistant.",
    `Ingredients: ${joined}`,
    "Return plain text in English only with this format:",
    "Title: <short title>",
    "Recipe: <one short paragraph>",
    "Steps:",
    "1) ...",
    "2) ...",
    "3) ...",
    "4) ...",
    "Pantry tips: <one sentence>",
  ].join(" ");
}

function parseFastRecipeText(rawText, ingredients) {
  const text = String(rawText || "").trim();
  if (!text) {
    const err = new Error("RECIPE_FAST_MODEL_FAILED");
    err.detail = "Fast model returned empty text.";
    throw err;
  }

  const lines = text.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
  let title = "";
  for (const line of lines) {
    const hit = line.match(/^title\s*:\s*(.+)$/i);
    if (hit && hit[1]) {
      title = hit[1].trim();
      break;
    }
  }
  if (!title) {
    const first = lines.find((x) => !/^(recipe|steps?|pantry tips?)\s*:/i.test(x)) || "";
    title = first.replace(/^#+\s*/, "").replace(/^[-*]\s*/, "").slice(0, 70).trim();
  }
  if (!title) title = "Generated low-carbon meal";

  const compact = text.replace(/\s+/g, " ").trim();
  const steps = textToSteps(text);
  return {
    source: "fast_cloud_ai",
    ingredients,
    title,
    text: compact,
    steps: steps.length ? steps : ["Combine ingredients and cook until warm and well-seasoned."],
  };
}

/** Pollinations text API — not used by POST /api/recipes/generate (see runRecipeModel). */
async function runRecipeModelFastCloud(ingredients) {
  const key = ingredients.map((x) => String(x).trim().toLowerCase()).sort().join("|");
  const cached = recipeFastCache.get(key);
  if (cached && Date.now() < cached.expiresAt) return cached.value;

  const model = recipeFastCloudModel();
  const prompt = recipeFastCloudPrompt(ingredients);
  const url = `https://text.pollinations.ai/${encodeURIComponent(prompt)}?model=${encodeURIComponent(
    model
  )}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), recipeFastCloudTimeoutMs());
  try {
    const resp = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: { Accept: "text/plain, application/json;q=0.9" },
    });
    const bodyText = await resp.text();
    if (!resp.ok) {
      const err = new Error("RECIPE_FAST_MODEL_FAILED");
      err.detail = bodyText
        ? bodyText.slice(0, 400)
        : `Fast model request failed with status ${resp.status}`;
      throw err;
    }
    const value = parseFastRecipeText(bodyText, ingredients);
    recipeFastCache.set(key, {
      value,
      expiresAt: Date.now() + recipeFastCloudCacheTtlMs(),
    });
    return value;
  } catch (e) {
    if (e?.name === "AbortError") {
      const err = new Error("RECIPE_FAST_MODEL_TIMEOUT");
      err.detail = `Fast cloud model timed out after ${recipeFastCloudTimeoutMs()}ms.`;
      throw err;
    }
    if (e?.message === "RECIPE_FAST_MODEL_FAILED") throw e;
    const err = new Error("RECIPE_FAST_MODEL_FAILED");
    err.detail = String(e?.message || e || "Fast cloud model request failed.");
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function recipeCooldownMs() {
  // Short default so one timeout does not block retries for minutes (override via env).
  const cooldownMs = Number(process.env.RECIPE_MODEL_COOLDOWN_MS || 30 * 1000);
  return Number.isFinite(cooldownMs) && cooldownMs > 0 ? cooldownMs : 30 * 1000;
}

function setRecipeModelCooldown(reason) {
  recipeModelCooldownUntil = Date.now() + recipeCooldownMs();
  // eslint-disable-next-line no-console
  console.log("[recipe-generation] cooldown set", {
    reason,
    cooldownMs: recipeCooldownMs(),
  });
}

function recipeRequestTimeoutMs() {
  const timeoutMs = Number(process.env.RECIPE_MODEL_TIMEOUT_MS || 20000);
  return Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 20000;
}

function recipeWarmupTimeoutMs() {
  const timeoutMs = Number(process.env.RECIPE_MODEL_WARMUP_TIMEOUT_MS || 90000);
  return Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 90000;
}

function recipeBeamSize() {
  const beam = Number(process.env.RECIPE_MODEL_BEAM_SIZE || 2);
  return Number.isFinite(beam) && beam >= 1 && beam <= 8 ? Math.floor(beam) : 2;
}

function recipeMaxLen() {
  const maxLen = Number(process.env.RECIPE_MODEL_MAX_LEN || 80);
  return Number.isFinite(maxLen) && maxLen >= 20 && maxLen <= 200 ? Math.floor(maxLen) : 80;
}

function recipeMinLen() {
  const minLen = Number(process.env.RECIPE_MODEL_MIN_LEN || 10);
  return Number.isFinite(minLen) && minLen >= 4 && minLen <= 80 ? Math.floor(minLen) : 10;
}

function recipeUsePersistentWorker() {
  return String(process.env.RECIPE_MODEL_PERSISTENT || "1").trim() !== "0";
}

let recipeWorkerState = {
  child: null,
  ready: false,
  readyPromise: null,
  pending: new Map(),
  stdoutBuffer: "",
  nextId: 1,
};

function cleanupRecipeWorker(reason) {
  const state = recipeWorkerState;
  if (state.child) {
    try {
      state.child.kill();
    } catch {
      // ignore cleanup kill errors
    }
  }
  state.child = null;
  state.ready = false;
  state.readyPromise = null;
  state.stdoutBuffer = "";
  for (const [, pendingReq] of state.pending) {
    clearTimeout(pendingReq.timer);
    const err = new Error("RECIPE_MODEL_FAILED");
    err.detail = reason || "Persistent recipe worker exited unexpectedly.";
    pendingReq.reject(err);
  }
  state.pending.clear();
}

function handleRecipeWorkerLine(line) {
  const state = recipeWorkerState;
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    return;
  }
  if (msg && msg.ready) {
    state.ready = true;
    return;
  }
  const id = Number(msg?.id);
  if (!Number.isFinite(id) || !state.pending.has(id)) return;
  const pendingReq = state.pending.get(id);
  state.pending.delete(id);
  clearTimeout(pendingReq.timer);
  if (msg?.ok && msg?.result) {
    pendingReq.resolve(msg.result);
    return;
  }
  const err = new Error("RECIPE_MODEL_FAILED");
  err.detail = String(msg?.error || "Recipe worker returned an invalid response.");
  pendingReq.reject(err);
}

function spawnRecipeWorker() {
  const pythonExe = process.env.RECIPE_PYTHON || process.env.PYTHON || "python";
  const workerScriptPath =
    process.env.RECIPE_MODEL_WORKER_SCRIPT ||
    path.join(__dirname, "recipe_model_worker.py");
  const checkpointPath =
    process.env.RECIPE_CHECKPOINT ||
    path.join(
      __dirname,
      "..",
      "..",
      "AI Development",
      "Cooking_Dataset",
      "best_transformer_copy_v2.pt"
    );
  if (!fs.existsSync(workerScriptPath) || !fs.existsSync(checkpointPath)) {
    throw new Error("RECIPE_MODEL_SETUP_INCOMPLETE");
  }
  const workerArgs = [
    workerScriptPath,
    "--checkpoint",
    checkpointPath,
    "--beam-size",
    String(recipeBeamSize()),
    "--max-len",
    String(recipeMaxLen()),
    "--min-len",
    String(recipeMinLen()),
  ];
  const configuredDevice = String(process.env.RECIPE_MODEL_DEVICE || "").trim();
  if (configuredDevice) workerArgs.push("--device", configuredDevice);
  const child = spawn(pythonExe, workerArgs, { windowsHide: true });
  recipeWorkerState.child = child;
  recipeWorkerState.ready = false;
  recipeWorkerState.stdoutBuffer = "";
  child.stdout.on("data", (chunk) => {
    recipeWorkerState.stdoutBuffer += chunk.toString("utf8");
    let newlineIdx = recipeWorkerState.stdoutBuffer.indexOf("\n");
    while (newlineIdx >= 0) {
      const line = recipeWorkerState.stdoutBuffer.slice(0, newlineIdx).trim();
      recipeWorkerState.stdoutBuffer = recipeWorkerState.stdoutBuffer.slice(newlineIdx + 1);
      if (line) handleRecipeWorkerLine(line);
      newlineIdx = recipeWorkerState.stdoutBuffer.indexOf("\n");
    }
  });
  child.stderr.on("data", (chunk) => {
    // eslint-disable-next-line no-console
    console.error({ route: "recipe-worker", stderr: chunk.toString("utf8").slice(0, 800) });
  });
  child.on("error", (err) => {
    cleanupRecipeWorker(err && err.message ? String(err.message) : "Recipe worker process errored.");
  });
  child.on("close", (code) => {
    cleanupRecipeWorker(`Recipe worker exited with code ${code}`);
  });
}

async function ensureRecipeWorkerReady() {
  if (recipeWorkerState.child && recipeWorkerState.ready) return;
  if (!recipeWorkerState.readyPromise) {
    recipeWorkerState.readyPromise = new Promise((resolve, reject) => {
      try {
        spawnRecipeWorker();
      } catch (e) {
        recipeWorkerState.readyPromise = null;
        reject(e);
        return;
      }
      const timer = setTimeout(() => {
        recipeWorkerState.readyPromise = null;
        cleanupRecipeWorker("Recipe worker warmup timed out.");
        reject(new Error("RECIPE_MODEL_TIMEOUT"));
      }, recipeWarmupTimeoutMs());
      const poll = setInterval(() => {
        if (recipeWorkerState.ready) {
          clearInterval(poll);
          clearTimeout(timer);
          recipeWorkerState.readyPromise = null;
          resolve();
        } else if (!recipeWorkerState.child) {
          clearInterval(poll);
          clearTimeout(timer);
          recipeWorkerState.readyPromise = null;
          const err = new Error("RECIPE_MODEL_FAILED");
          err.detail = "Recipe worker exited before ready signal.";
          reject(err);
        }
      }, 120);
    });
  }
  await recipeWorkerState.readyPromise;
}

async function runRecipeModelPersistent(ingredients) {
  await ensureRecipeWorkerReady();
  return new Promise((resolve, reject) => {
    const id = recipeWorkerState.nextId++;
    const timer = setTimeout(() => {
      recipeWorkerState.pending.delete(id);
      setRecipeModelCooldown("worker_request_timeout");
      const err = new Error("RECIPE_MODEL_TIMEOUT");
      err.detail = "Recipe worker inference timeout.";
      reject(err);
    }, recipeRequestTimeoutMs());
    recipeWorkerState.pending.set(id, { resolve, reject, timer });
    try {
      recipeWorkerState.child.stdin.write(
        `${JSON.stringify({ id, ingredients })}\n`,
        "utf8"
      );
    } catch (e) {
      clearTimeout(timer);
      recipeWorkerState.pending.delete(id);
      const err = new Error("RECIPE_MODEL_FAILED");
      err.detail = e && e.message ? String(e.message) : "Failed to write request to recipe worker.";
      reject(err);
    }
  });
}

function runRecipeModelOneShot(ingredients) {
  if (String(process.env.RECIPE_MODEL_DISABLED || "").trim() === "1") {
    return Promise.reject(new Error("RECIPE_MODEL_DISABLED"));
  }
  if (Date.now() < recipeModelCooldownUntil) {
    return Promise.reject(new Error("RECIPE_MODEL_COOLDOWN"));
  }

  const pythonExe = process.env.RECIPE_PYTHON || process.env.PYTHON || "python";
  const scriptPath =
    process.env.RECIPE_MODEL_SCRIPT ||
    path.join(__dirname, "recipe_model_infer.py");
  const checkpointPath =
    process.env.RECIPE_CHECKPOINT ||
    path.join(
      __dirname,
      "..",
      "..",
      "AI Development",
      "Cooking_Dataset",
      "best_transformer_copy_v2.pt"
    );

  if (!fs.existsSync(scriptPath)) {
    return Promise.reject(new Error("RECIPE_MODEL_SETUP_INCOMPLETE"));
  }
  if (!fs.existsSync(checkpointPath)) {
    return Promise.reject(new Error("RECIPE_MODEL_SETUP_INCOMPLETE"));
  }

  return new Promise((resolve, reject) => {
    const child = spawn(
      pythonExe,
      [
        scriptPath,
        "--ingredients",
        ingredients.join(", "),
        "--checkpoint",
        checkpointPath,
      ],
      {
        windowsHide: true,
      }
    );

    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill();
      setRecipeModelCooldown("one_shot_timeout");
      reject(new Error("RECIPE_MODEL_TIMEOUT"));
    }, recipeRequestTimeoutMs());

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      const wrap = new Error("RECIPE_MODEL_FAILED");
      wrap.cause = err;
      wrap.detail = err && err.message ? String(err.message) : "";
      reject(wrap);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        const err = new Error("RECIPE_MODEL_FAILED");
        const tail = (stderr || stdout || "").trim();
        err.detail = tail
          ? tail.slice(0, 1200)
          : `Python 进程退出码 ${code}，且 stderr/stdout 为空（可能被宿主杀掉或启动即崩溃）。`;
        err.exitCode = code;
        reject(err);
        return;
      }
      try {
        resolve(JSON.parse(stdout.trim()));
      } catch {
        const err = new Error("RECIPE_MODEL_FAILED");
        const out = stdout.trim();
        err.detail =
          (stderr && stderr.trim()) ||
          (out ? `stdout 非合法 JSON（前 400 字）：${out.slice(0, 400)}` : "stdout 为空，无法解析 JSON");
        reject(err);
      }
    });
  });
}

const recipePrimaryResultCache = new Map();

function recipeModelCacheKey(ingredients) {
  return ingredients
    .map((x) => String(x || "").trim().toLowerCase())
    .filter(Boolean)
    .sort()
    .join("|");
}

function recipeModelCacheTtlMs() {
  const ttlMs = Number(process.env.RECIPE_MODEL_CACHE_TTL_MS || 60 * 60 * 1000);
  return Number.isFinite(ttlMs) && ttlMs > 0 ? ttlMs : 60 * 60 * 1000;
}

async function runRecipeModel(ingredients) {
  // Recipe generation must not fallback to Pollinations (text.pollinations.ai): it may return
  // 429 queue-full errors surfaced as 503 to the frontend. runRecipeModelFastCloud() remains
  // in this file for other modules/routes that may call it explicitly.
  // eslint-disable-next-line no-console
  console.log("[recipe-generation] pollinations fallback disabled");
  // eslint-disable-next-line no-console
  console.log("[recipe-generation] using primary recipe model");

  const cacheKey = recipeModelCacheKey(ingredients);
  const cached = recipePrimaryResultCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    // eslint-disable-next-line no-console
    console.log("[recipe-generation] returning cached primary model result");
    return cached.value;
  }

  if (String(process.env.RECIPE_MODEL_DISABLED || "").trim() === "1") {
    throw new Error("RECIPE_MODEL_DISABLED");
  }
  if (Date.now() < recipeModelCooldownUntil) {
    const remainingMs = recipeModelCooldownUntil - Date.now();
    // eslint-disable-next-line no-console
    console.log("[recipe-generation] rejected: cooldown active", { remainingMs });
    const err = new Error("RECIPE_MODEL_COOLDOWN");
    err.remainingMs = remainingMs;
    throw err;
  }
  try {
    const result = recipeUsePersistentWorker()
      ? await runRecipeModelPersistent(ingredients)
      : await runRecipeModelOneShot(ingredients);
    recipePrimaryResultCache.set(cacheKey, {
      value: result,
      expiresAt: Date.now() + recipeModelCacheTtlMs(),
    });
    return result;
  } catch (e) {
    const msg = String(e?.message || e);
    if (msg === "RECIPE_MODEL_TIMEOUT") {
      setRecipeModelCooldown("model_timeout");
    }
    throw e;
  }
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
    title: "Light emission meal",
    desc: "Have one meal with selected ingredients, which emits lower carbon.",
    coins: 25,
    co2: 500,
    cat: "food",
    icon: "🥗",
  },
  {
    id: 6,
    title: "Read a short climate article",
    desc: "Spend three minutes reading any trusted climate or sustainability article.",
    coins: 12,
    co2: 0,
    cat: "learning",
    icon: "📰",
  },
  {
    id: 7,
    title: "Recycle sorted materials",
    desc: "Sort and place recyclables in the correct bin today.",
    coins: 18,
    co2: 150,
    cat: "lifestyle",
    icon: "♻️",
  },
  {
    id: 8,
    title: "Choose local or seasonal food",
    desc: "Prepare one meal using local or seasonal ingredients.",
    coins: 22,
    co2: 320,
    cat: "food",
    icon: "🥕",
  },
  {
    id: 9,
    title: "Learn one energy-saving tip",
    desc: "Watch or read one practical tip to reduce home energy use.",
    coins: 14,
    co2: 0,
    cat: "learning",
    icon: "💡",
  },
];

const QUICK_ACTION_CATALOG = [
  { key: "reuse_bag", label: "Bring a reusable bag", coins: 5 },
  { key: "lights_off_room", label: "Turn off lights when leaving a room", coins: 5 },
  { key: "short_shower", label: "Take a shorter shower", coins: 5 },
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
  {
    q: "Which home habit usually cuts electricity waste fastest?",
    opts: ["Leaving chargers plugged in", "Turning off standby devices", "Opening windows all day", "Using brighter bulbs"],
    ans: 1,
    exp: "Turning devices fully off (not standby) avoids continuous background electricity use.",
  },
  {
    q: "Why does using a reusable cup help climate action?",
    opts: ["It always keeps drinks hotter", "It reduces single-use production and waste", "It makes coffee cheaper everywhere", "It removes all transport emissions"],
    ans: 1,
    exp: "Reusable cups help lower demand for single-use products and related emissions across production and disposal.",
  },
  {
    q: "Which option is generally lower-carbon for a short urban trip?",
    opts: ["Solo driving", "Walking or cycling", "Ride-hailing detour", "Idling in traffic"],
    ans: 1,
    exp: "Walking and cycling avoid direct fuel emissions for short trips.",
  },
  {
    q: "What is a practical way to reduce food-related emissions?",
    opts: ["Waste more leftovers", "Choose local and seasonal produce more often", "Only buy imported out-of-season food", "Cook with single-use items every meal"],
    ans: 1,
    exp: "Local and seasonal choices can reduce transport/storage impacts and usually support lower-footprint meals.",
  },
  {
    q: "What does daily climate action mostly rely on?",
    opts: ["One perfect day", "Consistent small habits over time", "Only large donations", "Ignoring personal behavior"],
    ans: 1,
    exp: "Sustained small actions compound into meaningful long-term impact.",
  },
  {
    q: "If a quiz answer is wrong in ClimateQuest, what still happens?",
    opts: ["No record is saved", "The quiz completion is still recorded for the day", "Your account is reset", "You lose all coins"],
    ans: 1,
    exp: "The attempt is still recorded, and you get learning feedback even without coin rewards.",
  },
  {
    q: "Which statement best matches 'climate literacy'?",
    opts: ["Memorizing only one statistic", "Understanding causes, impacts, and practical actions", "Following trends without evidence", "Avoiding all discussions"],
    ans: 1,
    exp: "Climate literacy means understanding systems and being able to act on reliable information.",
  },
  {
    q: "What is the main purpose of the Leaderboard in this project?",
    opts: ["Punish low scores", "Visualize and motivate climate contribution progress", "Replace all education content", "Track private browser tabs"],
    ans: 1,
    exp: "The leaderboard is a motivation tool to visualize progress and encourage ongoing climate-friendly actions.",
  },
];

function dayIdx() {
  const day = ymdLocal();
  let hash = 0;
  for (let i = 0; i < day.length; i++) hash = (hash * 33 + day.charCodeAt(i)) >>> 0;
  return hash % QUIZ_BANK.length;
}

/** Single source for shop pricing (used by /api/shop/buy). */
const SHOP_PRICE_BY_ITEM_ID = {
  forest_tree_a: 20,
  forest_tree_b: 20,
  forest_flower_a: 12,
  forest_flower_b: 12,
  forest_grass_a: 8,
  forest_grass_b: 10,
  city_pave_a: 10,
  city_pave_b: 10,
  city_tree_a: 45,
  city_tree_b: 40,
  city_flower_a: 12,
  city_flower_b: 12,
};
const SHOP_KIND_DEFAULT_PRICE = { tree: 20, flower: 12, ground: 8, decor: 15 };

function shopUnitPurchasePrice(itemKind, itemIdStr) {
  const id = itemIdStr ? String(itemIdStr) : "";
  if (id && Object.prototype.hasOwnProperty.call(SHOP_PRICE_BY_ITEM_ID, id)) {
    return Number(SHOP_PRICE_BY_ITEM_ID[id]);
  }
  return Number(SHOP_KIND_DEFAULT_PRICE[itemKind] ?? 15);
}

function mondayWeekStartYmd(d = new Date()) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = x.getDay();
  const diff = (day + 6) % 7;
  x.setDate(x.getDate() - diff);
  return ymdLocal(x);
}

async function buildActiveDaySet(userId) {
  const [tasks, quiz, checks] = await Promise.all([
    query(`select distinct completed_on as d from task_logs where user_id = ?`, [userId]),
    query(`select distinct completed_on as d from quiz_results where user_id = ?`, [userId]),
    query(`select distinct checked_on as d from check_ins where user_id = ?`, [userId]),
  ]);
  const set = new Set();
  for (const r of tasks.rows || []) set.add(ymdLocal(new Date(r.d)));
  for (const r of quiz.rows || []) set.add(ymdLocal(new Date(r.d)));
  for (const r of checks.rows || []) set.add(ymdLocal(new Date(r.d)));
  return set;
}

function streakFromActiveSetLong(activeSet, maxDays) {
  const cap = Math.min(Math.max(Number(maxDays) || 365, 1), 800);
  let streak = 0;
  for (let i = 0; i < cap; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const k = ymdLocal(d);
    if (activeSet.has(k)) streak += 1;
    else if (i > 0) break;
  }
  return streak;
}

function streakFromActiveSet(activeSet) {
  return streakFromActiveSetLong(activeSet, 365);
}

async function bumpWeeklyTaskCompletion(userId) {
  const ws = mondayWeekStartYmd();
  const goal = 5;
  const bonusCoins = 40;
  await query(
    `insert into weekly_progress (user_id, week_start, tasks_completed, goal, reward_claimed, bonus_coins)
     values (?, ?, 1, ?, 0, ?)
     on duplicate key update tasks_completed = weekly_progress.tasks_completed + 1`,
    [userId, ws, goal, bonusCoins]
  );
  const r = await query(
    `select tasks_completed, goal, reward_claimed, bonus_coins
     from weekly_progress where user_id = ? and week_start = ?`,
    [userId, ws]
  );
  const row = r.rows?.[0];
  if (!row || Number(row.reward_claimed) === 1) return { awarded: false };
  if (Number(row.tasks_completed) >= Number(row.goal)) {
    const b = Number(row.bonus_coins || bonusCoins);
    await query(`update user_state set coins = coins + ? where user_id = ?`, [b, userId]);
    await query(`update weekly_progress set reward_claimed = 1 where user_id = ? and week_start = ?`, [
      userId,
      ws,
    ]);
    await touchActive(userId);
    return { awarded: true, bonusCoins: b };
  }
  return { awarded: false };
}

async function getStreakForUserId(userId) {
  const set = await buildActiveDaySet(userId);
  return streakFromActiveSet(set);
}

async function getStreakMapForUserIds(userIds) {
  const ids = Array.from(new Set((userIds || []).map((x) => Number(x)).filter((x) => Number.isFinite(x))));
  if (!ids.length) return new Map();
  const placeholders = ids.map(() => "?").join(",");
  const rows = await query(
    `select user_id, d from (
       select user_id, completed_on as d
       from task_logs
       where user_id in (${placeholders})
         and completed_on >= date_sub(curdate(), interval 365 day)
       union all
       select user_id, completed_on as d
       from quiz_results
       where user_id in (${placeholders})
         and completed_on >= date_sub(curdate(), interval 365 day)
       union all
       select user_id, checked_on as d
       from check_ins
       where user_id in (${placeholders})
         and checked_on >= date_sub(curdate(), interval 365 day)
     ) x`,
    [...ids, ...ids, ...ids]
  );
  const byUser = new Map();
  for (const r of rows.rows || []) {
    const uid = Number(r.user_id);
    if (!Number.isFinite(uid)) continue;
    if (!byUser.has(uid)) byUser.set(uid, new Set());
    byUser.get(uid).add(ymdLocal(new Date(r.d)));
  }
  const out = new Map();
  for (const uid of ids) out.set(uid, streakFromActiveSet(byUser.get(uid) || new Set()));
  return out;
}

/** Consecutive calendar days with ≥1 task completion (leaderboard honors). */
async function getTaskOnlyStreakMapForUserIds(userIds) {
  const ids = Array.from(new Set((userIds || []).map((x) => Number(x)).filter((x) => Number.isFinite(x))));
  if (!ids.length) return new Map();
  const placeholders = ids.map(() => "?").join(",");
  const rows = await query(
    `select user_id, completed_on as d
     from task_logs
     where user_id in (${placeholders})
       and completed_on >= date_sub(curdate(), interval 500 day)`,
    ids
  );
  const byUser = new Map();
  for (const r of rows.rows || []) {
    const uid = Number(r.user_id);
    if (!Number.isFinite(uid)) continue;
    if (!byUser.has(uid)) byUser.set(uid, new Set());
    byUser.get(uid).add(ymdLocal(new Date(r.d)));
  }
  const out = new Map();
  for (const uid of ids) out.set(uid, streakFromActiveSetLong(byUser.get(uid) || new Set(), 400));
  return out;
}

const LEADERBOARD_STREAK_TIERS = [
  { tier: 4, minDays: 365, title: "Evergreen Legend", badgeClass: "streak-t4" },
  { tier: 3, minDays: 30, title: "Monthly Marathoner", badgeClass: "streak-t3" },
  { tier: 2, minDays: 7, title: "Week Warrior", badgeClass: "streak-t2" },
  { tier: 1, minDays: 3, title: "Daily Spark", badgeClass: "streak-t1" },
];

const LEADERBOARD_DECORATION_KIND = {
  tree: { title: "Canopy Champion", badgeClass: "decor-tree" },
  flower: { title: "Bloom Sovereign", badgeClass: "decor-flower" },
  ground: { title: "Groundwork Guru", badgeClass: "decor-ground" },
  decor: { title: "Curator Supreme", badgeClass: "decor-decor" },
};

/** Among public leaderboard rows only: richest, highest scene level, longest activity streak (🔥). */
const LEADERBOARD_META = {
  coinKing: { title: "Treasury Titan", badgeClass: "meta-coins" },
  levelKing: { title: "Summit Sentinel", badgeClass: "meta-level" },
  activityStreakKing: { title: "Unbroken Flame", badgeClass: "meta-streak" },
};

function countPlacementKindsFromPlacementsJson(raw, sceneType) {
  const acc = { tree: 0, flower: 0, ground: 0, decor: 0 };
  const byTheme = placementsByThemeFromJson(raw, sceneType || "forest");
  for (const theme of Object.keys(byTheme)) {
    const bucket = byTheme[theme];
    if (!bucket || typeof bucket !== "object" || !Array.isArray(bucket.items)) continue;
    for (const it of bucket.items) {
      const t = String(it?.type || "").trim();
      if (Object.prototype.hasOwnProperty.call(acc, t)) acc[t] += 1;
    }
  }
  return acc;
}

function pickStreakHonor(taskStreakDays) {
  const n = Number(taskStreakDays || 0);
  if (!Number.isFinite(n) || n < 3) return null;
  for (const row of LEADERBOARD_STREAK_TIERS) {
    if (n >= row.minDays) {
      return {
        tier: row.tier,
        title: row.title,
        days: Math.floor(n),
        badgeClass: row.badgeClass,
      };
    }
  }
  return null;
}

function computeDecorationMaxima(countsByUser) {
  const kinds = ["tree", "flower", "ground", "decor"];
  const maxima = {};
  for (const k of kinds) maxima[k] = 0;
  for (const c of countsByUser.values()) {
    for (const k of kinds) {
      const v = Number(c[k] || 0);
      if (v > maxima[k]) maxima[k] = v;
    }
  }
  return maxima;
}

function pickDecorationHonor(counts, maxima) {
  const kinds = ["tree", "flower", "ground", "decor"];
  let best = null;
  for (const k of kinds) {
    const meta = LEADERBOARD_DECORATION_KIND[k];
    const cnt = Number(counts[k] || 0);
    const mx = Number(maxima[k] || 0);
    if (!meta || mx <= 0 || cnt !== mx) continue;
    if (!best || cnt > best.count) best = { kind: k, ...meta, count: cnt };
  }
  return best;
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

    if (noDatabaseMode) {
      if (demoUsers.has(username)) {
        return res.status(409).json({ error: "USERNAME_TAKEN" });
      }
      const row = {
        id: demoUserSeq++,
        username,
        displayName,
        createdAt: new Date().toISOString(),
        completedTasks: new Set(),
        coins: 120,
        xp: 0,
        sceneProgress: 0,
      };
      demoUsers.set(username, row);
      await setLoggedInSession(req, row.id);
      return res.status(201).json({ user: demoPublicUser(row) });
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
      `select id, username, display_name, created_at, profile_public
       from users
       where username = ?`,
      [username]
    );
    const user = publicUserRow(result.rows[0] || {}, { includeSettings: true });
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

    if (noDatabaseMode) {
      const row = demoUsers.get(username);
      if (!row) return res.status(404).json({ error: "USER_NOT_FOUND" });
      await setLoggedInSession(req, row.id);
      return res.status(200).json({ user: demoPublicUser(row) });
    }

    const existing = await query(
      `select id, username, display_name, created_at, profile_public
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
    res.status(200).json({ user: publicUserRow(row, { includeSettings: true }) });
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

    if (noDatabaseMode) {
      const row = getDemoUserById(userId);
      if (!row) return res.status(200).json({ user: null });
      return res.json({ user: demoPublicUser(row) });
    }

    await ensureUserState(userId);

    const result = await query(
      `select id, username, display_name, created_at, profile_public
       from users
       where id = ?`,
      [userId]
    );

    if (!result.rows || result.rows.length === 0) {
      req.session.userId = null;
      return res.status(200).json({ user: null });
    }

    res.json({ user: publicUserRow(result.rows[0], { includeSettings: true }) });
  } catch (err) {
    next(err);
  }
});

app.patch("/api/auth/profile", async (req, res, next) => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;
    if (typeof req.body?.profilePublic === "boolean") {
      await query(`update users set profile_public = ? where id = ?`, [
        req.body.profilePublic ? 1 : 0,
        userId,
      ]);
    }
    const result = await query(
      `select id, username, display_name, created_at, profile_public from users where id = ?`,
      [userId]
    );
    res.json({ user: publicUserRow(result.rows?.[0] || {}, { includeSettings: true }) });
  } catch (err) {
    next(err);
  }
});

app.post("/api/check-in", async (req, res, next) => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;
    await ensureUserState(userId);
    const today = ymdLocal();
    const reward = 10;
    try {
      await query(`insert into check_ins (user_id, checked_on, coins_earned) values (?, ?, ?)`, [
        userId,
        today,
        reward,
      ]);
    } catch (e) {
      if (e && (e.code === "ER_DUP_ENTRY" || e.code === "ER_DUP_KEY")) {
        return res.status(409).json({ error: "ALREADY_CHECKED_IN" });
      }
      throw e;
    }
    await query(`update user_state set coins = coins + ?, xp = xp + 5 where user_id = ?`, [reward, userId]);
    await touchActive(userId);
    const active = await buildActiveDaySet(userId);
    const streak = streakFromActiveSet(active);
    const st = await query(`select coins from user_state where user_id = ?`, [userId]);
    res.json({
      ok: true,
      coinsEarned: reward,
      totalCoins: Number(st.rows?.[0]?.coins || 0),
      streak,
    });
  } catch (err) {
    next(err);
  }
});

app.get("/api/home/summary", async (req, res, next) => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;
    await ensureUserState(userId);
    const today = ymdLocal();
    const chk = await query(
      `select 1 as ok from check_ins where user_id = ? and checked_on = ? limit 1`,
      [userId, today]
    );
    const completedToday = (chk.rows || []).length > 0;
    const ws = mondayWeekStartYmd();
    const wr = await query(
      `select tasks_completed, goal, reward_claimed, bonus_coins
       from weekly_progress where user_id = ? and week_start = ?`,
      [userId, ws]
    );
    const wrow = wr.rows?.[0];
    const goal = wrow ? Number(wrow.goal) : 5;
    const progress = wrow ? Number(wrow.tasks_completed) : 0;
    const completed = wrow && Number(wrow.reward_claimed) === 1;
    const active = await buildActiveDaySet(userId);
    const streak = streakFromActiveSet(active);
    const weekEnd = new Date(`${ws}T12:00:00`);
    weekEnd.setDate(weekEnd.getDate() + 6);
    res.json({
      checkIn: { completedToday, rewardCoins: 10 },
      weeklyChallenge: {
        title: "Weekly green sprint",
        description: "Complete five daily tasks between Monday and Sunday.",
        goal,
        progress,
        completed: !!completed,
        bonusCoins: wrow ? Number(wrow.bonus_coins || 40) : 40,
        weekRangeLabel: `${ws} — ${ymdLocal(weekEnd)}`,
      },
      streak,
      streakMilestones: { sevenDay: streak >= 7, thirtyDay: streak >= 30 },
    });
  } catch (err) {
    next(err);
  }
});

app.get("/api/quick-actions/catalog", (req, res) => {
  res.json(QUICK_ACTION_CATALOG);
});

app.post("/api/recipes/generate", async (req, res, next) => {
  const ingredients = Array.isArray(req.body?.ingredients)
    ? req.body.ingredients.map((x) => String(x || "").trim()).filter(Boolean)
    : [];
  // eslint-disable-next-line no-console
  console.log("[recipe-generation] request received", {
    ingredientCount: ingredients.length,
    provider: recipeUsePersistentWorker() ? "persistent_worker" : "one_shot",
  });
  try {
    if (ingredients.length < 3 || ingredients.length > 5) {
      return res.status(400).json({ error: "INGREDIENT_COUNT_MUST_BE_3_TO_5" });
    }
    const result = await runRecipeModel(ingredients);
    // eslint-disable-next-line no-console
    console.log("[recipe-generation] request succeeded", {
      ingredientCount: ingredients.length,
      source: result?.source,
    });
    return res.json(result);
  } catch (e) {
    const safe = recipeErrorToClientResponse(e);
    return res.status(safe.status).json(safe.body);
  }
});

app.post("/api/quick-actions/log", async (req, res, next) => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;
    await ensureUserState(userId);
    const key = String(req.body?.actionKey || "").trim();
    const meta = QUICK_ACTION_CATALOG.find((x) => x.key === key);
    if (!meta) return res.status(400).json({ error: "INVALID_ACTION" });
    const today = ymdLocal();
    try {
      await query(
        `insert into quick_action_logs (user_id, action_key, logged_on, coins_earned) values (?, ?, ?, ?)`,
        [userId, key, today, meta.coins]
      );
    } catch (e) {
      if (e && (e.code === "ER_DUP_ENTRY" || e.code === "ER_DUP_KEY")) {
        return res.status(409).json({ error: "ALREADY_LOGGED_TODAY" });
      }
      throw e;
    }
    await query(`update user_state set coins = coins + ? where user_id = ?`, [meta.coins, userId]);
    await touchActive(userId);
    const st = await query(`select coins from user_state where user_id = ?`, [userId]);
    res.json({
      ok: true,
      coinsEarned: meta.coins,
      totalCoins: Number(st.rows?.[0]?.coins || 0),
    });
  } catch (err) {
    next(err);
  }
});

app.get("/api/rewards/history", async (req, res, next) => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const limit = clampInt(req.query.limit, 1, 200);
    const events = [];

    const taskRows = await query(
      `select task_id, completed_on, coins_earned, co2_saved, created_at
       from task_logs where user_id = ? order by created_at desc limit 400`,
      [userId]
    );
    for (const r of taskRows.rows || []) {
      const t = TASKS.find((x) => x.id === r.task_id);
      events.push({
        kind: "task",
        sortKey: new Date(r.created_at).getTime(),
        date: ymdLocal(new Date(r.completed_on)),
        label: t ? t.title : `Task #${r.task_id}`,
        coins: Number(r.coins_earned),
        co2: Number(r.co2_saved),
      });
    }

    const quizRows = await query(
      `select completed_on, coins_earned, correct, created_at
       from quiz_results where user_id = ? order by created_at desc limit 120`,
      [userId]
    );
    for (const r of quizRows.rows || []) {
      events.push({
        kind: "quiz",
        sortKey: new Date(r.created_at).getTime(),
        date: ymdLocal(new Date(r.completed_on)),
        label: Number(r.correct) === 1 ? "Daily quiz (correct)" : "Daily quiz",
        coins: Number(r.coins_earned),
        co2: 0,
      });
    }

    const ci = await query(
      `select checked_on, coins_earned, created_at from check_ins where user_id = ? order by created_at desc limit 120`,
      [userId]
    );
    for (const r of ci.rows || []) {
      events.push({
        kind: "check_in",
        sortKey: new Date(r.created_at).getTime(),
        date: ymdLocal(new Date(r.checked_on)),
        label: "Daily check-in",
        coins: Number(r.coins_earned),
        co2: 0,
      });
    }

    const shop = await query(
      `select item, item_id, cost, created_at from shop_ledger where user_id = ? order by created_at desc limit 200`,
      [userId]
    );
    for (const r of shop.rows || []) {
      events.push({
        kind: "shop",
        sortKey: new Date(r.created_at).getTime(),
        date: ymdLocal(new Date(r.created_at)),
        label: `Shop: ${r.item}${r.item_id ? ` (${r.item_id})` : ""}`,
        coins: -Number(r.cost),
        co2: 0,
      });
    }

    const qk = await query(
      `select action_key, logged_on, coins_earned, created_at
       from quick_action_logs where user_id = ? order by created_at desc limit 200`,
      [userId]
    );
    for (const r of qk.rows || []) {
      const meta = QUICK_ACTION_CATALOG.find((x) => x.key === r.action_key);
      events.push({
        kind: "quick_action",
        sortKey: new Date(r.created_at).getTime(),
        date: ymdLocal(new Date(r.logged_on)),
        label: meta ? meta.label : r.action_key,
        coins: Number(r.coins_earned),
        co2: 0,
      });
    }

    const bonus = await query(
      `select week_start, bonus_coins, updated_at
       from weekly_progress where user_id = ? and reward_claimed = 1`,
      [userId]
    );
    for (const r of bonus.rows || []) {
      events.push({
        kind: "weekly_bonus",
        sortKey: new Date(r.updated_at).getTime(),
        date: ymdLocal(new Date(r.updated_at)),
        label: "Weekly challenge bonus",
        coins: Number(r.bonus_coins || 0),
        co2: 0,
      });
    }

    events.sort((a, b) => b.sortKey - a.sortKey);
    const slim = events.slice(0, limit).map(({ sortKey, ...rest }) => rest);
    res.json(slim);
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

    if (noDatabaseMode) {
      const row = getDemoUserById(userId);
      const doneSet = row?.completedTasks || new Set();
      return res.json(TASKS.map((t) => ({ ...t, completed: doneSet.has(t.id) })));
    }

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

    const id = parseInt(req.params.id, 10);
    const task = TASKS.find((t) => t.id === id);
    if (!task) return res.status(404).json({ error: "TASK_NOT_FOUND" });

    if (noDatabaseMode) {
      const row = getDemoUserById(userId);
      if (!row) return res.status(401).json({ error: "UNAUTHORIZED" });
      if (row.completedTasks.has(task.id)) {
        return res.status(409).json({ error: "ALREADY_COMPLETED_TODAY" });
      }
      row.completedTasks.add(task.id);
      row.coins += task.coins;
      row.xp += task.coins;
      row.sceneProgress = Math.min(100, row.sceneProgress + 2);
      return res.json({
        success: true,
        coinsEarned: task.coins,
        totalCoins: row.coins,
        co2Saved: task.co2,
        sceneProgress: row.sceneProgress,
        streak: row.completedTasks.size > 0 ? 1 : 0,
        weeklyChallengeBonus: null,
      });
    }

    await ensureUserState(userId);

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
    await touchActive(userId);

    const weeklyAward = await bumpWeeklyTaskCompletion(userId);

    const st = await query(
      `select coins, xp, scene_progress from user_state where user_id = ?`,
      [userId]
    );
    const state = st.rows?.[0] || {};

    const activeSet = await buildActiveDaySet(userId);
    const streak = streakFromActiveSet(activeSet);

    res.json({
      success: true,
      coinsEarned: task.coins,
      totalCoins: Number(state.coins || 0),
      co2Saved: task.co2,
      sceneProgress: Number(state.scene_progress || 0),
      streak,
      weeklyChallengeBonus: weeklyAward.awarded ? { coins: weeklyAward.bonusCoins } : null,
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
    if (type !== "forest") {
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

    await query(`delete from check_ins where user_id = ?`, [userId]);
    await query(`delete from weekly_progress where user_id = ?`, [userId]);
    await query(`delete from shop_ledger where user_id = ?`, [userId]);
    await query(`delete from quick_action_logs where user_id = ?`, [userId]);

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
  // keyed by theme name, e.g. { forest: { items: [...] } }
  return v && typeof v === "object" ? v : {};
}

function getThemePlacements(byTheme, theme) {
  if (!byTheme[theme] || typeof byTheme[theme] !== "object") byTheme[theme] = { items: [] };
  if (!Array.isArray(byTheme[theme].items)) byTheme[theme].items = [];
  return byTheme[theme];
}

function getOrInitMySceneMeta(placements) {
  if (!placements || typeof placements !== "object") return { challenges: {} };
  if (!placements.meta || typeof placements.meta !== "object") placements.meta = {};
  if (!placements.meta.myScene || typeof placements.meta.myScene !== "object") placements.meta.myScene = {};
  if (!placements.meta.myScene.challenges || typeof placements.meta.myScene.challenges !== "object") {
    placements.meta.myScene.challenges = {};
  }
  return placements.meta.myScene;
}

function computeMySceneMilestones(placements, lastPlaced) {
  const items = Array.isArray(placements?.items) ? placements.items : [];
  const trees = items.filter((x) => String(x?.type || "") === "tree").length;
  const treeSpecies = new Set();
  for (const it of items) {
    if (String(it?.type || "") !== "tree") continue;
    const id = String(it?.itemId || "").trim();
    if (id) treeSpecies.add(id);
  }
  const uniqueSpecies = treeSpecies.size;
  const placedHome = !!(lastPlaced && String(lastPlaced.itemId || "") === "my_scene_cabin");
  return { trees, uniqueSpecies, placedHome };
}

/** Forest-only client: merge placements from legacy scene_type buckets into `forest`. */
async function migrateForestOnlyProfile(userId, st) {
  const sceneType = String(st.scene_type || "forest").trim();
  if (sceneType === "forest") return false;
  const byTheme = placementsByThemeFromJson(st.placements_json, sceneType);
  const mergedForest = getThemePlacements(byTheme, "forest");
  const legacyBuckets = ["glacier", "cityGreen"];
  const keys = new Set([...legacyBuckets, sceneType]);
  keys.delete("forest");
  for (const key of keys) {
    const b = getThemePlacements(byTheme, key);
    if (Array.isArray(b.items) && b.items.length) mergedForest.items.push(...b.items);
    if (key !== "forest") delete byTheme[key];
  }
  await query(
    `update user_state set scene_type = 'forest', placements_json = ? where user_id = ?`,
    [JSON.stringify(byTheme), userId]
  );
  st.scene_type = "forest";
  st.placements_json = JSON.stringify(byTheme);
  return true;
}

function clampGrid(n, size) {
  const v = Number.isFinite(n) ? Math.trunc(n) : parseInt(n, 10);
  if (!Number.isFinite(v)) return null;
  return Math.max(0, Math.min(size - 1, v));
}

/** Charge + persist placement in one request (fewer RTTs vs shop/buy + scene/place). */
app.post("/api/scene/place", async (req, res, next) => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;
    await ensureUserState(userId);

    const itemId = req.body?.itemId ? String(req.body.itemId).trim() : "";
    const type = req.body?.type ? String(req.body.type).trim() : "";
    const col = clampGrid(req.body?.col, 26);
    const row = clampGrid(req.body?.row, 26);
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
    const meta = getOrInitMySceneMeta(placements);

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

    const ms = computeMySceneMilestones(placements, { itemId, type, col, row });
    const treesCount = ms.trees;
    const challenges = meta.challenges || {};
    let toast = null;
    if (ms.trees >= 5 && !challenges.plant5Trees) {
      challenges.plant5Trees = true;
      toast = {
        title: "Restoration milestone",
        text: "5 trees planted. Young forests cool cities and create habitat as they grow.",
      };
    } else if (ms.trees >= 10 && !challenges.plant10Trees) {
      challenges.plant10Trees = true;
      toast = {
        title: "Canopy unlocked",
        text: "10 trees planted. Your scene is starting to behave like a real carbon sink — keep going to unlock more species.",
      };
    } else if (ms.uniqueSpecies >= 3 && !challenges.biodiversity3) {
      challenges.biodiversity3 = true;
      toast = {
        title: "Biodiversity boost",
        text: "3 tree species placed. Diversity helps ecosystems handle heatwaves, pests, and drought.",
      };
    } else if (ms.placedHome && !challenges.placeHome) {
      challenges.placeHome = true;
      toast = {
        title: "Sustainable living",
        text: "A tiny home appeared in your restored land. Efficient homes reduce energy demand and emissions over time.",
      };
    }
    meta.challenges = challenges;

    await query(
      `update user_state
       set placements_json = ?, trees = ?
       where user_id = ?`,
      [JSON.stringify(byTheme), treesCount, userId]
    );
    await touchActive(userId);

    res.json({ ok: true, placements, toast });
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
    const col = clampGrid(req.body?.col, 26);
    const row = clampGrid(req.body?.row, 26);
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

    const treesCount = placements.items.filter((x) => String(x?.type || "") === "tree").length;
    await query(
      `update user_state
       set placements_json = ?, trees = ?
       where user_id = ?`,
      [JSON.stringify(byTheme), treesCount, userId]
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
    const fromCol = clampGrid(req.body?.fromCol, 26);
    const fromRow = clampGrid(req.body?.fromRow, 26);
    const toCol = clampGrid(req.body?.toCol, 26);
    const toRow = clampGrid(req.body?.toRow, 26);
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

    const treesCount = placements.items.filter((x) => String(x?.type || "") === "tree").length;
    await query(
      `update user_state
       set placements_json = ?, trees = ?
       where user_id = ?`,
      [JSON.stringify(byTheme), treesCount, userId]
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
      `select quiz_idx, answer, correct
       from quiz_results
       where user_id = ?
         and completed_on = ?
       limit 1`,
      [userId, today]
    );
    const completedRow = done.rows?.[0] || null;
    const completed = !!completedRow;
    const q = QUIZ_BANK[idx];
    let completedResult = null;
    if (completedRow) {
      const savedIdx = clampInt(completedRow.quiz_idx, 0, QUIZ_BANK.length - 1);
      const savedQ = QUIZ_BANK[savedIdx];
      const savedCorrect = Number(completedRow.correct || 0) === 1;
      completedResult = {
        correct: savedCorrect,
        correctAnswer: savedQ.ans,
        explanation: savedQ.exp,
        selectedAnswer: clampInt(completedRow.answer, 0, 3),
        coinsEarned: savedCorrect ? 25 : 0,
      };
    }
    res.json({
      question: { q: q.q, opts: q.opts },
      completed,
      idx,
      completedResult,
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
    await touchActive(userId);

    const st = await query(
      `select coins, scene_progress
       from user_state
       where user_id = ?`,
      [userId]
    );
    const state = st.rows?.[0] || {};

    const activeSet = await buildActiveDaySet(userId);
    const streak = streakFromActiveSet(activeSet);

    res.json({
      correct,
      correctAnswer: q.ans,
      explanation: q.exp,
      coinsEarned,
      totalCoins: Number(state.coins || 0),
      sceneProgress: Number(state.scene_progress || 0),
      streak,
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
      `select coins, xp, scene_progress, trees
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

    const activeSet = await buildActiveDaySet(userId);
    const streak = streakFromActiveSet(activeSet);

    const xp = Number(state.xp || 0);
    const trees = Number(state.trees || 0);
    // Unified My Scene level: +1 per 5 trees (Lv5 at 20 trees), same everywhere.
    const level = Math.max(1, 1 + Math.floor(trees / 5));
    const treesInLevel = trees % 5;

    const weekSummaries = [];
    const curMonStr = mondayWeekStartYmd();
    const curMonDate = new Date(`${curMonStr}T12:00:00`);
    for (let i = 7; i >= 0; i--) {
      const startParse = new Date(curMonDate);
      startParse.setDate(startParse.getDate() - i * 7);
      const startStr = ymdLocal(startParse);
      const endParse = new Date(startParse);
      endParse.setDate(endParse.getDate() + 6);
      const endStr = ymdLocal(endParse);
      const cnt = await query(
        `select count(*) as c from task_logs
         where user_id = ? and completed_on >= ? and completed_on <= ?`,
        [userId, startStr, endStr]
      );
      weekSummaries.push({
        weekStart: startStr,
        weekEnd: endStr,
        taskCompletions: Number(cnt.rows?.[0]?.c || 0),
      });
    }

    res.json({
      coins: Number(state.coins || 0),
      xp,
      level,
      // Keep old field for compatibility (dashboard used to show XP/200).
      // Now we expose trees-based progress as the source of truth.
      xpInLevel: treesInLevel,
      trees,
      treesInLevel,
      treesPerLevel: 5,
      streak,
      streakMilestones: { sevenDay: streak >= 7, thirtyDay: streak >= 30 },
      todayDone,
      totalTasks: TASKS.length,
      allTimeTasks,
      co2Saved,
      week,
      weekSummaries,
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
      `select u.id, u.username, u.display_name, s.coins, s.xp, s.trees,
              s.placements_json, s.scene_type
       from user_state s
       join users u on u.id = s.user_id
       where coalesce(u.profile_public, 1) = 1
       order by s.trees desc, s.coins desc, s.xp desc, u.created_at asc`
    );

    const rows = r.rows || [];
    const ids = rows.map((x) => x.id);
    const streakMap = await getStreakMapForUserIds(ids);
    const taskStreakMap = await getTaskOnlyStreakMapForUserIds(ids);

    const placementCountsByUser = new Map();
    for (const row of rows) {
      const uid = row.id;
      placementCountsByUser.set(
        uid,
        countPlacementKindsFromPlacementsJson(row.placements_json, row.scene_type)
      );
    }
    const decorationMaxima = computeDecorationMaxima(placementCountsByUser);

    const metrics = rows.map((row) => {
      const trees = Number(row.trees || 0);
      const uid = row.id;
      const streak = Number(streakMap.get(uid) || 0);
      const coins = Number(row.coins || 0);
      const treeLevel = Math.max(1, 1 + Math.floor(trees / 5));
      return { uid, coins, treeLevel, streak };
    });
    const maxCoins = metrics.length ? Math.max(...metrics.map((m) => m.coins), 0) : 0;
    const maxLevel = metrics.length ? Math.max(...metrics.map((m) => m.treeLevel), 1) : 1;
    const maxActivityStreak = metrics.length ? Math.max(...metrics.map((m) => m.streak), 0) : 0;

    const board = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const trees = Number(row.trees || 0);
      const uid = row.id;
      const streak = Number(streakMap.get(uid) || 0);
      const taskStreakDays = Number(taskStreakMap.get(uid) || 0);
      const streakHonor = pickStreakHonor(taskStreakDays);
      const decorationHonor = pickDecorationHonor(
        placementCountsByUser.get(uid) || { tree: 0, flower: 0, ground: 0, decor: 0 },
        decorationMaxima
      );
      // My Scene level: +1 per 5 trees (Lv5 at 20 trees), same as SceneBuilderShell.
      const treeLevel = Math.max(1, 1 + Math.floor(trees / 5));
      const m = metrics[i];
      const coinKing =
        maxCoins > 0 && m.coins === maxCoins ? { ...LEADERBOARD_META.coinKing } : null;
      const levelKingEligible = maxLevel >= 2;
      const levelKing =
        levelKingEligible && m.treeLevel === maxLevel ? { ...LEADERBOARD_META.levelKing } : null;
      const activityStreakKing =
        maxActivityStreak > 0 && m.streak === maxActivityStreak
          ? { ...LEADERBOARD_META.activityStreakKing }
          : null;

      board.push({
        rank: i + 1,
        username: row.username,
        displayName: row.display_name || "",
        coins: Number(row.coins || 0),
        trees: Number(row.trees || 0),
        level: treeLevel,
        streak,
        honors: {
          streak: streakHonor,
          decoration: decorationHonor,
          coinKing,
          levelKing,
          activityStreakKing,
        },
        isYou: myUsername ? row.username === myUsername : false,
      });
    }

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
    await migrateForestOnlyProfile(userId, s);

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

    // Keep `user_state.trees` consistent with the actual placements.
    // This avoids leaderboard level mismatches when legacy saves or older endpoints
    // updated `placements_json` without touching `trees`.
    const computedTrees = Array.isArray(placements?.items)
      ? placements.items.filter((x) => String(x?.type || "") === "tree").length
      : 0;
    const storedTrees = Number(st.trees || 0);
    if (Number.isFinite(computedTrees) && computedTrees !== storedTrees) {
      await query(`update user_state set trees = ? where user_id = ?`, [computedTrees, userId]);
      st.trees = computedTrees;
    }

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
    if (!["tree", "flower", "ground", "decor"].includes(item)) {
      return res.status(400).json({ error: "INVALID_ITEM" });
    }

    const unit = shopUnitPurchasePrice(item, itemId);
    const cost = Number(unit) * qty;

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

    await query(`insert into shop_ledger (user_id, item, item_id, cost) values (?, ?, ?, ?)`, [
      userId,
      item,
      itemId || null,
      cost,
    ]);

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
      `select id, username, display_name, created_at, profile_public from users where id = ?`,
      [userId]
    );
    res.json({ user: publicUserRow(result.rows[0], { includeSettings: true }) });
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
  await ensureProjectExtensions();
  await maybeStartupSetCoins();
  // eslint-disable-next-line no-console
  console.log(`EcoQuest auth server listening on :${PORT}`);
  console.log(`CORS origins: ${FRONTEND_ORIGINS.join(", ")}`);
  console.log(`Session cookie secure: ${cookieSecure}, sameSite: ${cookieSameSite}`);
});

