/** Correlates one user Generate click with one API round-trip (diagnostics only). */
export function createRecipeRequestId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `recipe-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}
