/**
 * Forward recipe generation to a remote local AI worker (tunnel URL).
 * Used on Render so Node never runs PyTorch.
 */

function localAiWorkerBase() {
  return String(process.env.LOCAL_AI_ENDPOINT || "")
    .trim()
    .replace(/\/+$/, "");
}

function useLocalAiWorker() {
  return Boolean(localAiWorkerBase());
}

function aiWorkerTimeoutMs() {
  const timeoutMs = Number(process.env.AI_WORKER_TIMEOUT_MS || 60000);
  return Number.isFinite(timeoutMs) && timeoutMs >= 1000 && timeoutMs <= 300000
    ? Math.floor(timeoutMs)
    : 60000;
}

function buildRecipeFallbackResponse(ingredients, message) {
  const list = Array.isArray(ingredients)
    ? ingredients.map((x) => String(x || "").trim()).filter(Boolean)
    : [];
  const primary = list[0] || "your ingredients";
  const secondary = list[1] || "the other items";
  const joined = list.join(", ");
  const steps = [
    `Prep and season ${primary}.`,
    `Cook ${secondary} until tender.`,
    `Combine everything, adjust seasoning, and serve warm.`,
  ];
  return {
    fallback: true,
    message:
      message ||
      "AI worker unavailable or too slow. Returned fallback result.",
    source: "template_fallback",
    ingredients: list,
    title: "Simple low-carbon meal idea",
    text: `A quick idea using ${joined}. ${steps.join(" ")}`,
    steps,
  };
}

function authHeaders() {
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  const token = String(process.env.AI_WORKER_TOKEN || "").trim();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function runRecipeModelLocalAiWorker(ingredients) {
  const base = localAiWorkerBase();
  if (!base) {
    throw new Error("LOCAL_AI_ENDPOINT_NOT_SET");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), aiWorkerTimeoutMs());

  try {
    const resp = await fetch(`${base}/generate`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ ingredients }),
      signal: controller.signal,
    });

    const bodyText = await resp.text();
    let data;
    try {
      data = bodyText ? JSON.parse(bodyText) : null;
    } catch {
      const err = new Error("LOCAL_AI_WORKER_BAD_JSON");
      err.detail = bodyText.slice(0, 300);
      throw err;
    }

    if (!resp.ok) {
      const err = new Error("LOCAL_AI_WORKER_ERROR");
      err.status = resp.status;
      err.detail =
        (data && (data.detail || data.error)) ||
        bodyText.slice(0, 300) ||
        `HTTP ${resp.status}`;
      throw err;
    }

    if (!data || typeof data !== "object") {
      const err = new Error("LOCAL_AI_WORKER_BAD_JSON");
      err.detail = "Empty or non-object JSON body";
      throw err;
    }

    return data;
  } catch (e) {
    if (e?.name === "AbortError") {
      const err = new Error("LOCAL_AI_WORKER_TIMEOUT");
      err.detail = `Timed out after ${aiWorkerTimeoutMs()}ms`;
      throw err;
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

async function runRecipeModelViaLocalWorker(ingredients) {
  try {
    return await runRecipeModelLocalAiWorker(ingredients);
  } catch (e) {
    const code = String(e?.message || e);
    // eslint-disable-next-line no-console
    console.error({
      route: "local-ai-worker",
      code,
      status: e?.status,
      detail: e?.detail ? String(e.detail).slice(0, 400) : undefined,
    });
    return buildRecipeFallbackResponse(
      ingredients,
      "AI worker unavailable or too slow. Returned fallback result."
    );
  }
}

module.exports = {
  useLocalAiWorker,
  aiWorkerTimeoutMs,
  buildRecipeFallbackResponse,
  runRecipeModelLocalAiWorker,
  runRecipeModelViaLocalWorker,
};
