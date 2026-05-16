const test = require("node:test");
const assert = require("node:assert/strict");

const {
  resolveRecipeModelProvider,
  runRecipeModel,
} = require("../src/recipe_model_router");

test("default provider is local_fallback without LOCAL_AI_ENDPOINT", () => {
  const prevEndpoint = process.env.LOCAL_AI_ENDPOINT;
  const prevProvider = process.env.RECIPE_MODEL_PROVIDER;
  delete process.env.LOCAL_AI_ENDPOINT;
  delete process.env.RECIPE_MODEL_PROVIDER;

  assert.equal(resolveRecipeModelProvider(), "local_fallback");

  if (prevEndpoint) process.env.LOCAL_AI_ENDPOINT = prevEndpoint;
  if (prevProvider) process.env.RECIPE_MODEL_PROVIDER = prevProvider;
});

test("runRecipeModel returns local-fallback when provider local_fallback", async () => {
  const prevEndpoint = process.env.LOCAL_AI_ENDPOINT;
  const prevProvider = process.env.RECIPE_MODEL_PROVIDER;
  delete process.env.LOCAL_AI_ENDPOINT;
  process.env.RECIPE_MODEL_PROVIDER = "local_fallback";

  const res = await runRecipeModel(["rice", "tofu", "onion"]);
  assert.equal(res.fallback, true);
  assert.equal(res.source, "local-fallback");

  if (prevEndpoint) process.env.LOCAL_AI_ENDPOINT = prevEndpoint;
  if (prevProvider) process.env.RECIPE_MODEL_PROVIDER = prevProvider;
  else delete process.env.RECIPE_MODEL_PROVIDER;
});

test("recipe router does not import pollinations provider", () => {
  const src = require("fs").readFileSync(
    require("path").join(__dirname, "../src/recipe_model_router.js"),
    "utf8"
  );
  assert.equal(src.includes('require("./pollinations_provider")'), false);
  assert.equal(src.includes("text.pollinations"), false);
});
