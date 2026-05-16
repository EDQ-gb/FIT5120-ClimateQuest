const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const SERVER_SRC = path.join(__dirname, "../src");

function readSrc(name) {
  return fs.readFileSync(path.join(SERVER_SRC, name), "utf8");
}

test("index.js recipe path does not reference Pollinations", () => {
  const src = readSrc("index.js");
  assert.equal(src.includes("text.pollinations"), false);
  assert.equal(src.includes("pollinations_provider"), false);
  assert.equal(src.includes("runRecipeModelFastCloud"), false);
  assert.equal(src.includes("RECIPE_FAST_CLOUD_ENABLED"), false);
  assert.equal(src.includes("recipe_generation_service"), true);
  assert.equal(src.includes("/api/debug/recipe-provider"), true);
});

test("recipe_model_router.js does not call Pollinations API", () => {
  const src = readSrc("recipe_model_router.js");
  assert.equal(src.includes("text.pollinations"), false);
  assert.equal(src.includes('require("./pollinations_provider")'), false);
});

test("pollinations_provider.js is not imported by recipe router", () => {
  const router = readSrc("recipe_model_router.js");
  const index = readSrc("index.js");
  assert.equal(router.includes('require("./pollinations_provider")'), false);
  assert.equal(index.includes('require("./pollinations_provider")'), false);
});
