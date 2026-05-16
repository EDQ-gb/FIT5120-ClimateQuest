import { proxyWithPrefix, DEFAULT_RECIPE_BACKEND_BASE } from '../_proxyBase.js'

/**
 * Proxies /api/recipes/* on Vercel to the Node backend that runs recipe_model_infer.py.
 *
 * - Default upstream: `DEFAULT_RECIPE_BACKEND_BASE` (dedicated Render app with model weights).
 * - Override with `RECIPE_BACKEND_BASE` (e.g. local `http://127.0.0.1:8080` or another host).
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
      : DEFAULT_RECIPE_BACKEND_BASE
  return proxyWithPrefix(req, res, 'recipes', recipeBase)
}
