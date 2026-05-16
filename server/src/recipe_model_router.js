/**
 * Recipe / text generation routing (transformer via local AI worker).
 *
 * Provider order for POST /api/recipes/generate:
 *   1. local_worker  — LOCAL_AI_ENDPOINT → FastAPI ai_worker (PyTorch)
 *   2. local_builtin — optional server-side spawn (RECIPE_USE_SERVER_PYTORCH=1)
 *   3. local-fallback — built-in JSON (never Pollinations)
 *
 * Pollinations lives in pollinations_provider.js and is NOT imported here.
 */

const {
  useLocalAiWorker,
  runRecipeModelViaLocalWorker,
  buildRecipeFallbackResponse,
} = require("./recipe_local_ai");

/** @type {((ingredients: string[]) => Promise<object>) | null} */
let recipeBuiltinRunner = null;

function setRecipeBuiltinRunner(fn) {
  recipeBuiltinRunner = typeof fn === "function" ? fn : null;
}

/**
 * Legacy Pollinations env vars (RECIPE_FAST_CLOUD_ENABLED, RECIPE_FAST_MODEL,
 * RECIPE_FAST_FALLBACK_TO_LOCAL) are intentionally ignored for recipe generation.
 *
 * @returns {"local_worker"|"local_builtin"|"disabled"}
 */
function resolveRecipeModelProvider() {
  const explicit = String(process.env.RECIPE_MODEL_PROVIDER || "")
    .trim()
    .toLowerCase()
    .replace(/-/g, "_");

  if (explicit === "pollinations" || explicit === "fast_cloud") {
    // eslint-disable-next-line no-console
    console.warn(
      "[recipe] RECIPE_MODEL_PROVIDER=pollinations is not supported; using local_worker or fallback instead."
    );
  }

  if (explicit === "disabled") return "disabled";
  if (explicit === "local_builtin") return "local_builtin";
  if (explicit === "local_worker") return "local_worker";

  if (String(process.env.USE_RECIPE_LOCAL_WORKER || "").trim() === "1") {
    return useLocalAiWorker() ? "local_worker" : "disabled";
  }

  if (useLocalAiWorker()) return "local_worker";
  if (String(process.env.RECIPE_USE_SERVER_PYTORCH || "0").trim() === "1") {
    return "local_builtin";
  }
  return "disabled";
}

async function runRecipeModel(ingredients) {
  const provider = resolveRecipeModelProvider();
  // eslint-disable-next-line no-console
  console.log({ route: "recipe-model", provider });

  if (provider === "local_worker") {
    return runRecipeModelViaLocalWorker(ingredients);
  }

  if (provider === "local_builtin") {
    if (!recipeBuiltinRunner) {
      return buildRecipeFallbackResponse(
        ingredients,
        "Server PyTorch recipe runner is not configured. Returned fallback result."
      );
    }
    try {
      return await recipeBuiltinRunner(ingredients);
    } catch (e) {
      const code = String(e?.message || e);
      // eslint-disable-next-line no-console
      console.error({
        route: "recipe-local-builtin",
        code,
        detail: e?.detail ? String(e.detail).slice(0, 400) : undefined,
      });
      return buildRecipeFallbackResponse(
        ingredients,
        "Local PyTorch inference failed. Returned fallback result."
      );
    }
  }

  return buildRecipeFallbackResponse(
    ingredients,
    "Local AI worker is not configured. Returned fallback result."
  );
}

module.exports = {
  resolveRecipeModelProvider,
  setRecipeBuiltinRunner,
  runRecipeModel,
};
