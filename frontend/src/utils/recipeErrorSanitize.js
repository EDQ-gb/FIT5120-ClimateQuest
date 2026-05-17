/** User-facing recipe generation errors only (not used by other features). */

const RECIPE_USER_BUSY_EN =
  'Recipe generation is temporarily busy. Please try again.'
const RECIPE_USER_TIMEOUT_EN = 'Recipe generation timed out. Please try again.'

const UNSAFE_RECIPE_ERROR =
  /pollinations|queue\s+full|deprecation_notice|enter\.pollinations|text\.pollinations|RECIPE_FAST|快速云端|model service unavailable|RECIPE_MODEL_UNAVAILABLE|RECIPE_CHECKPOINT|RECIPE_PYTHON|RECIPE_FALLBACK_TO_LOCAL|detail:\s*\{/i

export function containsUnsafeRecipeUserText(value) {
  return UNSAFE_RECIPE_ERROR.test(String(value || ''))
}

export function sanitizeRecipeErrorMessage(...parts) {
  const combined = parts
    .flat()
    .filter((x) => x != null && String(x).trim())
    .join(' ')
    .trim()
  if (!combined) return ''
  if (containsUnsafeRecipeUserText(combined)) return RECIPE_USER_BUSY_EN
  return combined
}

export function recipeGenerationUserMessage(error) {
  const status = error?.status
  const reason = String(error?.reason || '').trim()
  if (
    status === 408 ||
    reason === 'RECIPE_GENERATION_TIMEOUT' ||
    reason === 'RECIPE_MODEL_TIMEOUT' ||
    reason === 'RECIPE_MODEL_CLIENT_TIMEOUT'
  ) {
    return RECIPE_USER_TIMEOUT_EN
  }
  const fromApi = sanitizeRecipeErrorMessage(
    error?.hint,
    error?.detail,
    error?.message,
    error?.error
  )
  if (fromApi && fromApi !== RECIPE_USER_BUSY_EN) {
    if (containsUnsafeRecipeUserText(fromApi)) return RECIPE_USER_BUSY_EN
    return fromApi
  }
  if (fromApi === RECIPE_USER_BUSY_EN) return RECIPE_USER_BUSY_EN
  return RECIPE_USER_BUSY_EN
}
