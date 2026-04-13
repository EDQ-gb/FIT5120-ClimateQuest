const dotenv = require("dotenv");

dotenv.config();

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

const NODE_ENV = process.env.NODE_ENV || "development";

module.exports = {
  NODE_ENV,
  PORT: parseInt(process.env.PORT || "8080", 10),
  FRONTEND_ORIGIN: process.env.FRONTEND_ORIGIN || "http://localhost:5173",
  SESSION_SECRET:
    process.env.SESSION_SECRET || "dev-insecure-session-secret-change-me",
  DATABASE_URL: process.env.DATABASE_URL || "",
  MYSQL_URL: process.env.MYSQL_URL || process.env.DATABASE_URL || "",
  requireEnv,
};

