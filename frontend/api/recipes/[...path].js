import { proxyWithPrefix } from '../_proxyBase.js'

/**
 * Proxies /api/recipes/* on Vercel to the Node backend that runs recipe_model_infer.py.
 *
 * - Leave unset to use the same host as other APIs (`BACKEND_BASE` → Render).
 * - Set `RECIPE_BACKEND_BASE` on Vercel if the recipe service is deployed separately
 *   (e.g. Railway/Fly with Python + PyTorch + checkpoint).
 *
 * `maxDuration`: recipe inference can exceed default hobby limits; upgrade Vercel plan if needed.
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
