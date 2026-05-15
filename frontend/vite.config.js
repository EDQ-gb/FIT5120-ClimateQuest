import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
// Local dev: create `.env.development.local` with
//   VITE_API_PROXY=http://127.0.0.1:8080
// so `/api` hits your machine (newest server code, e.g. leaderboard honors).
// If unset, `/api` goes to Render (must redeploy server there for honors to appear).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget =
    env.VITE_API_PROXY || 'https://fit5120-climatequest.onrender.com'
  const recipeTarget = env.VITE_RECIPE_PROXY || 'http://localhost:8080'

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
