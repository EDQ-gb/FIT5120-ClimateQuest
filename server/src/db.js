const mysql = require("mysql2/promise");
const { MYSQL_URL } = require("./config");

let pool = null;

function getPool() {
  if (!MYSQL_URL) return null;
  if (pool) return pool;

  pool = mysql.createPool({
    uri: MYSQL_URL,
    waitForConnections: true,
    connectionLimit: parseInt(process.env.MYSQL_POOL_SIZE || "10", 10),
    enableKeepAlive: true,
    ssl:
      process.env.MYSQL_SSL === "true" || process.env.NODE_ENV === "production"
        ? { rejectUnauthorized: false }
        : undefined,
    multipleStatements: true,
  });
  return pool;
}

async function query(sql, params) {
  const p = getPool();
  if (!p) {
    const err = new Error(
      "MYSQL_URL (or DATABASE_URL) is not set. Configure MySQL to use the database."
    );
    err.code = "NO_DATABASE";
    throw err;
  }
  const [rows] = await p.execute(sql, params);
  return { rows };
}

async function exec(sql) {
  const p = getPool();
  if (!p) {
    const err = new Error(
      "MYSQL_URL (or DATABASE_URL) is not set. Configure MySQL to use the database."
    );
    err.code = "NO_DATABASE";
    throw err;
  }
  await p.query(sql);
}

module.exports = { getPool, query, exec };

