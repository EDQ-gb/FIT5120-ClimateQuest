const fs = require("fs");
const path = require("path");

const { requireEnv } = require("../src/config");
const { exec, query } = require("../src/db");

async function columnExists(table, column) {
  const result = await query(
    `select 1 as ok
     from information_schema.columns
     where table_schema = database()
       and table_name = ?
       and column_name = ?
     limit 1`,
    [table, column]
  );
  return Array.isArray(result.rows) && result.rows.length > 0;
}

async function indexExists(table, indexName) {
  const result = await query(
    `select 1 as ok
     from information_schema.statistics
     where table_schema = database()
       and table_name = ?
       and index_name = ?
     limit 1`,
    [table, indexName]
  );
  return Array.isArray(result.rows) && result.rows.length > 0;
}

async function main() {
  requireEnv("MYSQL_URL");
  const schemaPath = path.join(__dirname, "..", "db", "schema.sql");
  const sql = fs.readFileSync(schemaPath, "utf8");
  await exec(sql);

  // Backward-compatible migrations (for DBs created before username login)
  const hasUsername = await columnExists("users", "username");
  if (!hasUsername) {
    await exec(`alter table users add column username varchar(32) not null`);
  }

  const hasEmail = await columnExists("users", "email");
  if (!hasEmail) {
    await exec(`alter table users add column email varchar(320) null`);
  } else {
    // Ensure email is nullable (older schema had NOT NULL)
    await exec(`alter table users modify column email varchar(320) null`);
  }

  const hasAvatarUrl = await columnExists("users", "avatar_url");
  if (!hasAvatarUrl) {
    await exec(`alter table users add column avatar_url text null`);
  }

  if (!(await indexExists("users", "uq_users_username"))) {
    await exec(`alter table users add unique key uq_users_username (username)`);
  }

  if (!(await indexExists("users", "uq_users_email"))) {
    await exec(`alter table users add unique key uq_users_email (email)`);
  }

  // eslint-disable-next-line no-console
  console.log("DB schema applied:", schemaPath);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exitCode = 1;
});

