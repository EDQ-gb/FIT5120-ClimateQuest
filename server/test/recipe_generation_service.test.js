const test = require("node:test");
const assert = require("node:assert/strict");

const {
  resolveRecipeProvider,
  generateRecipe,
  getRecipeDebugInfo,
} = require("../src/recipe_generation_service");
const { runPollinationsRecipeGeneration } = require("../src/pollinations_provider");

test("getRecipeDebugInfo exposes recipe API version", () => {
  const info = getRecipeDebugInfo();
  assert.equal(info.recipeApiVersion, "2-local-worker-only");
  assert.ok(["local_worker", "local_fallback"].includes(info.recipeProvider));
});

test("RECIPE_FAST_MODEL does not enable pollinations provider", () => {
  const prevFast = process.env.RECIPE_FAST_MODEL;
  const prevCloud = process.env.RECIPE_FAST_CLOUD_ENABLED;
  const prevEndpoint = process.env.LOCAL_AI_ENDPOINT;
  process.env.RECIPE_FAST_MODEL = "openai-fast";
  process.env.RECIPE_FAST_CLOUD_ENABLED = "1";
  delete process.env.LOCAL_AI_ENDPOINT;
  assert.equal(resolveRecipeProvider(), "local_fallback");
  if (prevFast) process.env.RECIPE_FAST_MODEL = prevFast;
  else delete process.env.RECIPE_FAST_MODEL;
  if (prevCloud) process.env.RECIPE_FAST_CLOUD_ENABLED = prevCloud;
  else delete process.env.RECIPE_FAST_CLOUD_ENABLED;
  if (prevEndpoint) process.env.LOCAL_AI_ENDPOINT = prevEndpoint;
});

test("generateRecipe returns local-fallback when no LOCAL_AI_ENDPOINT", async () => {
  const prevEndpoint = process.env.LOCAL_AI_ENDPOINT;
  delete process.env.LOCAL_AI_ENDPOINT;
  process.env.RECIPE_MODEL_PROVIDER = "local_fallback";
  const res = await generateRecipe(["rice", "tofu", "onion"]);
  assert.equal(res.fallback, true);
  assert.equal(res.source, "local-fallback");
  if (prevEndpoint) process.env.LOCAL_AI_ENDPOINT = prevEndpoint;
});

test("runPollinationsRecipeGeneration is blocked for recipe by default", async () => {
  const prev = process.env.ALLOW_POLLINATIONS_RECIPE_API;
  delete process.env.ALLOW_POLLINATIONS_RECIPE_API;
  await assert.rejects(
    () => runPollinationsRecipeGeneration(["a", "b", "c"]),
    (e) => e.message === "POLLINATIONS_BLOCKED_FOR_RECIPE"
  );
  if (prev) process.env.ALLOW_POLLINATIONS_RECIPE_API = prev;
});
