import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

<<<<<<< HEAD
// Keep in sync with `frontend/api/_proxyBase.js` → `DEFAULT_RECIPE_BACKEND_BASE`.
const DEFAULT_RECIPE_BACKEND_BASE = 'https://fit5120-climatequest-backend.onrender.com'

const RENDER_API = 'https://fit5120-climatequest.onrender.com'
const LOCAL_API = 'http://127.0.0.1:8080'

// https://vite.dev/config/
// `/api`: use `VITE_API_PROXY`, else dev → local :8080, prod build → Render (see `frontend/.env.example`).
// `/api/recipes`: use `VITE_RECIPE_PROXY`, else dedicated recipe Render service by default.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = env.VITE_API_PROXY || (mode === 'development' ? LOCAL_API : RENDER_API)
  const recipeTarget = env.VITE_RECIPE_PROXY || DEFAULT_RECIPE_BACKEND_BASE
=======
// https://vite.dev/config/
// Defaults match `frontend/.env.development` (Render). Override with
// gitignored `.env.development.local` for a local API on :8080.
const CLOUD_API = 'https://fit5120-climatequest.onrender.com'
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = env.VITE_API_PROXY || CLOUD_API
  const recipeTarget = env.VITE_RECIPE_PROXY || env.VITE_API_PROXY || CLOUD_API
>>>>>>> origin/main

  return {
    plugins: [vue()],
    server: {
      proxy: {
        '/api/recipes': {
          target: recipeTarget,
          changeOrigin: true,
        },
        '/api': {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
  }
})
