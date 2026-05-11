import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      '/api/recipes': {
        // Local-only model prototype endpoint.
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/api': {
        // Keep existing app/auth APIs on the deployed backend with its database.
        target: 'https://fit5120-climatequest.onrender.com',
        changeOrigin: true,
      },
    },
  },
})
