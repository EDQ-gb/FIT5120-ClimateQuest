const fs = require("fs");
const path = require("path");

const { requireEnv } = require("../src/config");
const { exec } = require("../src/db");

async function main() {
  requireEnv("MYSQL_URL");
  const schemaPath = path.join(__dirname, "..", "db", "schema.sql");
  const sql = fs.readFileSync(schemaPath, "utf8");
  await exec(sql);
  // eslint-disable-next-line no-console
  console.log("DB schema applied:", schemaPath);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exitCode = 1;
});

