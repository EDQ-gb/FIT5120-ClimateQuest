const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const indexSrc = fs.readFileSync(
  path.join(__dirname, "../src/index.js"),
  "utf8"
);

test("runRecipeModel does not call Pollinations fast cloud", () => {
  const start = indexSrc.indexOf("async function runRecipeModel(");
  assert.ok(start >= 0);
  const nextFn = indexSrc.indexOf("\nasync function ", start + 1);
  const body = indexSrc.slice(start, nextFn > start ? nextFn : start + 2500);
  assert.equal(body.includes("await runRecipeModelFastCloud"), false);
  assert.equal(body.includes("recipeFastCloudEnabled()"), false);
});

test("recipe route does not map RECIPE_FAST errors to 503", () => {
  const start = indexSrc.indexOf('app.post("/api/recipes/generate"');
  assert.ok(start >= 0);
  const end = indexSrc.indexOf("app.post(", start + 10);
  const block = indexSrc.slice(start, end > start ? end : start + 4000);
  assert.equal(block.includes("RECIPE_FAST_MODEL_FAILED"), false);
  assert.equal(block.includes("快速云端模型"), false);
});
