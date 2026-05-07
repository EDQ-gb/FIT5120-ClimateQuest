import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      '/api': {
        // Dev: proxy to cloud backend (match Vercel rewrites).
        target: 'https://fit5120-climatequest.onrender.com',
        changeOrigin: true,
      },
    },
  },
})
