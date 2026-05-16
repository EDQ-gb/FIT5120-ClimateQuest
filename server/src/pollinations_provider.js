/**
 * Pollinations text API (third-party). NOT used by POST /api/recipes/generate.
 *
 * Do NOT import this module from recipe_model_router.js or the recipe route in index.js.
 * Recipe generation uses recipe_model_router.js → local AI worker or local-fallback only.
 *
 * Kept for optional legacy / non-recipe experiments. Recipe generation must use
 * recipe_model_router.js → local AI worker or local-fallback only.
 *
 * Env (legacy): RECIPE_FAST_CLOUD_ENABLED, RECIPE_FAST_MODEL, RECIPE_FAST_TIMEOUT_MS,
 * RECIPE_FAST_CACHE_TTL_MS — only read if you call runPollinationsRecipeGeneration directly.
 */

const recipeFastCache = new Map();

function textToSteps(text) {
  const normalized = String(text || "")
    .replace(/\r/g, " ")
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return [];
  return normalized
    .split(/(?<=[.!?])\s+/)
    .map((x) => x.replace(/^[-*]\s*/, "").trim())
    .filter(Boolean)
    .slice(0, 8);
}

function recipeFastCloudTimeoutMs() {
  const timeoutMs = Number(process.env.RECIPE_FAST_TIMEOUT_MS || 12000);
  return Number.isFinite(timeoutMs) && timeoutMs >= 2000 && timeoutMs <= 60000
    ? Math.floor(timeoutMs)
    : 12000;
}

function recipeFastCloudCacheTtlMs() {
  const ttlMs = Number(process.env.RECIPE_FAST_CACHE_TTL_MS || 6 * 60 * 60 * 1000);
  return Number.isFinite(ttlMs) && ttlMs >= 60000 && ttlMs <= 24 * 60 * 60 * 1000
    ? Math.floor(ttlMs)
    : 6 * 60 * 60 * 1000;
}

function recipeFastCloudModel() {
  const configured = String(process.env.RECIPE_FAST_MODEL || "").trim();
  return configured || "openai-fast";
}

function recipeFastCloudPrompt(ingredients) {
  const joined = ingredients.join(", ");
  return [
    "You are a concise low-carbon meal assistant.",
    `Ingredients: ${joined}`,
    "Return plain text in English only with this format:",
    "Title: <short title>",
    "Recipe: <one short paragraph>",
    "Steps:",
    "1) ...",
    "2) ...",
    "3) ...",
    "4) ...",
    "Pantry tips: <one sentence>",
  ].join(" ");
}

function parseFastRecipeText(rawText, ingredients) {
  const text = String(rawText || "").trim();
  if (!text) {
    const err = new Error("RECIPE_FAST_MODEL_FAILED");
    err.detail = "Fast model returned empty text.";
    throw err;
  }

  const lines = text.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
  let title = "";
  for (const line of lines) {
    const hit = line.match(/^title\s*:\s*(.+)$/i);
    if (hit && hit[1]) {
      title = hit[1].trim();
      break;
    }
  }
  if (!title) {
    const first = lines.find((x) => !/^(recipe|steps?|pantry tips?)\s*:/i.test(x)) || "";
    title = first.replace(/^#+\s*/, "").replace(/^[-*]\s*/, "").slice(0, 70).trim();
  }
  if (!title) title = "Generated low-carbon meal";

  const compact = text.replace(/\s+/g, " ").trim();
  const steps = textToSteps(text);
  return {
    source: "pollinations_fast_cloud",
    ingredients,
    title,
    text: compact,
    steps: steps.length ? steps : ["Combine ingredients and cook until warm and well-seasoned."],
  };
}

/**
 * Call Pollinations text API.
 *
 * Do not use this provider for recipe/text generation. Recipe generation must use
 * recipe_generation_service.js (local worker or local-fallback).
 */
async function runPollinationsRecipeGeneration(ingredients) {
  const allowLegacy = String(process.env.ALLOW_POLLINATIONS_RECIPE_API || "").trim() === "1";
  if (!allowLegacy) {
    const err = new Error("POLLINATIONS_BLOCKED_FOR_RECIPE");
    err.detail =
      "Recipe/text generation must not use Pollinations. Use LOCAL_AI_ENDPOINT + recipe_generation_service.js.";
    throw err;
  }

  const key = ingredients.map((x) => String(x).trim().toLowerCase()).sort().join("|");
  const cached = recipeFastCache.get(key);
  if (cached && Date.now() < cached.expiresAt) return cached.value;

  const model = recipeFastCloudModel();
  const prompt = recipeFastCloudPrompt(ingredients);
  const url = `https://text.pollinations.ai/${encodeURIComponent(prompt)}?model=${encodeURIComponent(
    model
  )}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), recipeFastCloudTimeoutMs());
  try {
    const resp = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: { Accept: "text/plain, application/json;q=0.9" },
    });
    const bodyText = await resp.text();
    if (!resp.ok) {
      const err = new Error("RECIPE_FAST_MODEL_FAILED");
      err.detail = bodyText
        ? bodyText.slice(0, 400)
        : `Fast model request failed with status ${resp.status}`;
      throw err;
    }
    const value = parseFastRecipeText(bodyText, ingredients);
    recipeFastCache.set(key, {
      value,
      expiresAt: Date.now() + recipeFastCloudCacheTtlMs(),
    });
    return value;
  } catch (e) {
    if (e?.name === "AbortError") {
      const err = new Error("RECIPE_FAST_MODEL_TIMEOUT");
      err.detail = `Pollinations timed out after ${recipeFastCloudTimeoutMs()}ms.`;
      throw err;
    }
    if (e?.message === "RECIPE_FAST_MODEL_FAILED") throw e;
    const err = new Error("RECIPE_FAST_MODEL_FAILED");
    err.detail = String(e?.message || e || "Pollinations request failed.");
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = {
  runPollinationsRecipeGeneration,
};
