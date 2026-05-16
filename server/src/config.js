const dotenv = require("dotenv");

dotenv.config();

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

const NODE_ENV = process.env.NODE_ENV || "development";

function parseOrigins(value) {
  return String(value || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

const FRONTEND_ORIGINS = (() => {
  const many = parseOrigins(process.env.FRONTEND_ORIGINS);
  if (many.length) return many;
  const single = String(process.env.FRONTEND_ORIGIN || "http://localhost:5173").trim();
  return single ? [single] : [];
})();

module.exports = {
  NODE_ENV,
  PORT: parseInt(process.env.PORT || "8080", 10),
  FRONTEND_ORIGIN: FRONTEND_ORIGINS[0] || "http://localhost:5173",
  FRONTEND_ORIGINS,
  SESSION_SECRET:
    process.env.SESSION_SECRET || "dev-insecure-session-secret-change-me",
  DATABASE_URL: process.env.DATABASE_URL || "",
  MYSQL_URL: process.env.MYSQL_URL || process.env.DATABASE_URL || "",
  requireEnv,
};

