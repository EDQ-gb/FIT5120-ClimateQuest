import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

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

  return {
    plugins: [vue()],
    server: {
      // Default dev URL. If 5173 is busy Vite picks the next free port — always open the URL
      // printed in the terminal (embedded browser tabs do not auto-update when the port changes).
      port: 5173,
      strictPort: false,
      proxy: {
        '/api/recipes': {
          target: recipeTarget,
          changeOrigin: true,
          secure: false,
          // Avoid Set-Cookie Domain mismatches when the browser is on localhost:* but the API is 127.0.0.1
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
