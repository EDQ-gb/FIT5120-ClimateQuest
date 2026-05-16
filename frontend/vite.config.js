import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

// Recipe + main API use the same Render Node service (LOCAL_AI_ENDPOINT lives there).
const CLOUD_API = 'https://fit5120-climatequest.onrender.com'
const LOCAL_API = 'http://127.0.0.1:8080'

// https://vite.dev/config/
// `/api` and `/api/recipes` share the same target unless VITE_RECIPE_PROXY is set.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = env.VITE_API_PROXY || (mode === 'development' ? LOCAL_API : CLOUD_API)
  const recipeTarget = env.VITE_RECIPE_PROXY || apiTarget

  return {
    plugins: [vue()],
    server: {
      port: 5173,
      strictPort: false,
      proxy: {
        '/api/recipes': {
          target: recipeTarget,
          changeOrigin: true,
          secure: false,
          cookieDomainRewrite: '',
        },
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          secure: false,
          cookieDomainRewrite: '',
        },
      },
    },
  }
})
