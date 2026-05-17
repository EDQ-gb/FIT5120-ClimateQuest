/**
 * User-facing error shaping for POST /api/recipes/generate only.
 * Server logs may still record technical codes; responses must not expose
 * third-party provider bodies, URLs, IPs, or env-var instructions.
 */

const UNSAFE_USER_TEXT =
  /pollinations|queue\s+full|deprecation_notice|enter\.pollinations|text\.pollinations|RECIPE_FAST|快速云端|model service unavailable|RECIPE_MODEL_UNAVAILABLE|RECIPE_CHECKPOINT|RECIPE_PYTHON|render\.com/i;

const MSG_BUSY = "Recipe generation is temporarily busy. Please try again.";
const MSG_TIMEOUT = "Recipe generation timed out. Please try again.";

function containsUnsafeRecipeUserText(value) {
  return UNSAFE_USER_TEXT.test(String(value || ""));
}

function sanitizeRecipeErrorDetail(detail) {
  const s = String(detail || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!s || containsUnsafeRecipeUserText(s)) return undefined;
  return s.slice(0, 450);
}

function logRecipeGenerationFailure(e, extra = {}) {
  const msg = String(e?.message || e);
  const rawDetail = e?.detail != null ? String(e.detail) : "";
  const providerStatus =
    rawDetail && /"status"\s*:\s*(\d+)/.test(rawDetail)
      ? Number(rawDetail.match(/"status"\s*:\s*(\d+)/)[1])
      : undefined;
  // eslint-disable-next-line no-console
  console.error({
    route: "POST /api/recipes/generate",
    requestId: extra?.requestId,
    code: msg,
    errno: e?.code,
    providerStatus: Number.isFinite(providerStatus) ? providerStatus : undefined,
    detail: rawDetail ? rawDetail.slice(0, 500) : undefined,
    ...extra,
  });
  if (containsUnsafeRecipeUserText(rawDetail) || msg.startsWith("RECIPE_FAST_")) {
    // eslint-disable-next-line no-console
    console.log("[recipe-generation] external provider error sanitized");
  }
}

function isRecipeTimeoutError(message) {
  const msg = String(message || "");
  return (
    msg === "RECIPE_MODEL_TIMEOUT" ||
    msg === "RECIPE_FAST_MODEL_TIMEOUT" ||
    msg === "RECIPE_MODEL_CLIENT_TIMEOUT"
  );
}

function buildRecipeTimeoutResponse() {
  // eslint-disable-next-line no-console
  console.log("[recipe-generation] returning recipe generation timeout response");
  return {
    status: 408,
    body: {
      error: MSG_TIMEOUT,
      code: "RECIPE_GENERATION_TIMEOUT",
      retryable: true,
    },
  };
}

function buildRecipeBusyResponse() {
  // eslint-disable-next-line no-console
  console.log("[recipe-generation] returning retryable busy message");
  return {
    status: 503,
    body: {
      error: MSG_BUSY,
      code: "RECIPE_GENERATION_TEMPORARILY_BUSY",
      retryable: true,
    },
  };
}

/**
 * Map any recipe-generation failure to a safe HTTP response (no hint/detail/reason for clients).
 */
function recipeErrorToClientResponse(e, meta = {}) {
  const msg = String(e?.message || e);
  logRecipeGenerationFailure(e, meta);

  if (isRecipeTimeoutError(msg)) {
    return buildRecipeTimeoutResponse();
  }

  if (msg.startsWith("RECIPE_FAST_")) {
    return buildRecipeBusyResponse();
  }

  if (msg === "RECIPE_MODEL_COOLDOWN") {
    // eslint-disable-next-line no-console
    console.log("[recipe-api] returning retryable busy (cooldown)", {
      requestId: meta?.requestId,
      remainingMs: e?.remainingMs,
    });
    return buildRecipeBusyResponse();
  }

  if (
    msg === "RECIPE_MODEL_FAILED" ||
    msg === "RECIPE_MODEL_SETUP_INCOMPLETE" ||
    msg === "RECIPE_MODEL_DISABLED" ||
    e?.code === "ENOENT" ||
    containsUnsafeRecipeUserText(e?.detail)
  ) {
    return buildRecipeBusyResponse();
  }

  return buildRecipeBusyResponse();
}

module.exports = {
  MSG_BUSY,
  MSG_TIMEOUT,
  containsUnsafeRecipeUserText,
  sanitizeRecipeErrorDetail,
  logRecipeGenerationFailure,
  recipeErrorToClientResponse,
};
