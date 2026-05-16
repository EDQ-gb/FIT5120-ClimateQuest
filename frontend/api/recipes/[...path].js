import { proxyWithPrefix } from '../_proxyBase.js'

/**
 * Proxies /api/recipes/* to the same Node backend as other APIs (`BACKEND_BASE`).
 * Recipe generation uses LOCAL_AI_ENDPOINT on that host — not Pollinations, not a separate legacy host.
 *
 * Override only with `RECIPE_BACKEND_BASE` if you run a dedicated recipe API elsewhere.
 */
export const config = {
  maxDuration: 120,
}

export default async function handler(req, res) {
  const recipeBase =
    typeof process.env.RECIPE_BACKEND_BASE === 'string' && process.env.RECIPE_BACKEND_BASE.trim()
      ? process.env.RECIPE_BACKEND_BASE.trim()
      : undefined
  return proxyWithPrefix(req, res, 'recipes', recipeBase)
}
