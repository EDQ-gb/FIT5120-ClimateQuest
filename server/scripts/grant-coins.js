const { requireEnv } = require("../src/config");
const { query } = require("../src/db");

function normalizeUsername(username) {
  return String(username || "").trim().toLowerCase();
}

async function main() {
  requireEnv("MYSQL_URL");

  const rawUser = process.argv[2];
  const rawAmount = process.argv[3];
  const username = normalizeUsername(rawUser);
  const coins = parseInt(String(rawAmount || "").replace(/_/g, ""), 10);

  if (!username) {
    // eslint-disable-next-line no-console
    console.error("Usage: node scripts/grant-coins.js <username> <coins>");
    process.exit(1);
  }
  if (!Number.isFinite(coins) || coins < 0 || coins > 2147483647) {
    // eslint-disable-next-line no-console
    console.error("Invalid coins (use 0 .. 2147483647)");
    process.exit(1);
  }

  const found = await query(
    `select id from users where username = ? limit 1`,
    [username]
  );
  const row = found.rows?.[0];
  if (!row) {
    // eslint-disable-next-line no-console
    console.error(`User not found: ${username}`);
    process.exit(1);
  }

  const userId = row.id;
  await query(
    `insert into user_state (user_id, coins)
     values (?, ?)
     on duplicate key update coins = values(coins)`,
    [userId, coins]
  );

  // eslint-disable-next-line no-console
  console.log(`OK: user "${username}" (id ${userId}) coins set to ${coins}`);
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e?.message || e);
  process.exit(1);
});
