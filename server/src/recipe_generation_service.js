/**
 * Recipe / text generation ONLY.
 *
 * Allowed providers: local_worker | local_fallback
 * Never Pollinations. Never RECIPE_FAST_* env vars.
 */

const {
  useLocalAiWorker,
  runRecipeModelViaLocalWorker,
  buildRecipeFallbackResponse,
  aiWorkerTimeoutMs,
} = require("./recipe_local_ai");

const RECIPE_API_VERSION = "2-local-worker-only";

function hasLocalAiEndpoint() {
  return useLocalAiWorker();
}

/**
 * @returns {"local_worker"|"local_fallback"}
 */
function resolveRecipeProvider() {
  const explicit = String(process.env.RECIPE_MODEL_PROVIDER || "")
    .trim()
    .toLowerCase()
    .replace(/-/g, "_");

  if (
    explicit === "pollinations" ||
    explicit === "fast_cloud" ||
    explicit === "fast_model"
  ) {
    // eslint-disable-next-line no-console
    console.warn(
      "[recipe-generation] RECIPE_MODEL_PROVIDER=pollinations is ignored; using local_worker or local_fallback."
    );
  }

  if (explicit === "local_fallback" || explicit === "disabled") {
    return "local_fallback";
  }

  if (explicit === "local_worker") {
    return hasLocalAiEndpoint() ? "local_worker" : "local_fallback";
  }

  if (String(process.env.USE_RECIPE_LOCAL_WORKER || "").trim() === "1") {
    return hasLocalAiEndpoint() ? "local_worker" : "local_fallback";
  }

  return hasLocalAiEndpoint() ? "local_worker" : "local_fallback";
}

function getRecipeDebugInfo() {
  const provider = resolveRecipeProvider();
  return {
    recipeApiVersion: RECIPE_API_VERSION,
    recipeProvider: provider,
    pollinationsEnabledForRecipe: false,
    hasLocalAiEndpoint: hasLocalAiEndpoint(),
    timeoutMs: aiWorkerTimeoutMs(),
    commit:
      process.env.RENDER_GIT_COMMIT ||
      process.env.VERCEL_GIT_COMMIT_SHA ||
      process.env.GIT_COMMIT ||
      null,
  };
}

/**
 * Generate recipe JSON for POST /api/recipes/generate (always resolves; use HTTP 200).
 */
async function generateRecipe(ingredients) {
  // eslint-disable-next-line no-console
  console.log("[recipe-generation] pollinations disabled for recipe generation");

  const provider = resolveRecipeProvider();

  if (provider === "local_worker") {
    // eslint-disable-next-line no-console
    console.log("[recipe-generation] provider=local-worker");
    return runRecipeModelViaLocalWorker(ingredients);
  }

  // eslint-disable-next-line no-console
  console.log("[recipe-generation] provider=local-fallback");
  return buildRecipeFallbackResponse(
    ingredients,
    "Local AI worker is not configured. Returned fallback result."
  );
}

module.exports = {
  RECIPE_API_VERSION,
  resolveRecipeProvider,
  hasLocalAiEndpoint,
  getRecipeDebugInfo,
  generateRecipe,
};
