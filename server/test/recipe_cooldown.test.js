const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const indexSrc = fs.readFileSync(
  path.join(__dirname, "../src/index.js"),
  "utf8"
);

test("cooldown is only set on explicit timeout paths, not generic model failed", () => {
  assert.equal(indexSrc.includes('setRecipeModelCooldown("model_timeout")'), true);
  assert.equal(
    indexSrc.includes("RECIPE_MODEL_FAILED") &&
      indexSrc.includes("setRecipeModelCooldown") &&
      /if \(msg === "RECIPE_MODEL_FAILED"\)[\s\S]*setRecipeModelCooldown/.test(indexSrc),
    false
  );
});

test("default cooldown is short unless env overrides", () => {
  assert.match(indexSrc, /RECIPE_MODEL_COOLDOWN_MS \|\| 30 \* 1000/);
});
