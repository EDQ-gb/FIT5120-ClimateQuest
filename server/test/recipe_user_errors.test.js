const test = require("node:test");
const assert = require("node:assert/strict");
const {
  recipeErrorToClientResponse,
  containsUnsafeRecipeUserText,
  sanitizeRecipeErrorDetail,
} = require("../src/recipe_user_errors");

test("recipeErrorToClientResponse hides Pollinations queue-full detail", () => {
  const e = new Error("RECIPE_FAST_MODEL_FAILED");
  e.detail =
    '{"error":"Queue full for IP: 1.2.3.4","status":429,"deprecation_notice":"text.pollinations"}';
  const { status, body } = recipeErrorToClientResponse(e);
  assert.equal(status, 503);
  assert.equal(body.code, "RECIPE_GENERATION_TEMPORARILY_BUSY");
  assert.equal(body.retryable, true);
  assert.equal(body.error.includes("Pollinations"), false);
  assert.equal(body.detail, undefined);
  assert.equal(body.hint, undefined);
});

test("recipeErrorToClientResponse maps timeout to 408", () => {
  const { status, body } = recipeErrorToClientResponse(
    new Error("RECIPE_MODEL_TIMEOUT")
  );
  assert.equal(status, 408);
  assert.equal(body.code, "RECIPE_GENERATION_TIMEOUT");
  assert.match(body.error, /timed out/i);
});

test("sanitizeRecipeErrorDetail drops unsafe provider text", () => {
  assert.equal(
    sanitizeRecipeErrorDetail("enter.pollinations.ai queue full"),
    undefined
  );
  assert.equal(sanitizeRecipeErrorDetail("short benign note"), "short benign note");
});

test("containsUnsafeRecipeUserText flags env-var hints", () => {
  assert.equal(
    containsUnsafeRecipeUserText("快速云端模型暂不可用 RECIPE_FAST_MODEL"),
    true
  );
});
