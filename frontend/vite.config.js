import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
// Defaults match `frontend/.env.development` (Render). Override with
// gitignored `.env.development.local` for a local API on :8080.
const CLOUD_API = 'https://fit5120-climatequest.onrender.com'
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = env.VITE_API_PROXY || CLOUD_API
  const recipeTarget = env.VITE_RECIPE_PROXY || env.VITE_API_PROXY || CLOUD_API

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
