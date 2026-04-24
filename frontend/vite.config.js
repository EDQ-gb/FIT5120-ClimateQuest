import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      '/api': {
        // Dev: proxy to deployed backend so you can iterate on the Vue UI
        // without running a local DB/server.
        target: 'https://fit5120-climatequest.onrender.com',
        changeOrigin: true,
        secure: true,
        configure: (proxy) => {
          // The deployed backend sets `Secure` and usually `SameSite=None` cookies in production.
          // Browsers reject `Secure` cookies on `http://localhost`, and also reject
          // `SameSite=None` cookies if `Secure` is absent. For local dev, rewrite them.
          proxy.on('proxyRes', (proxyRes) => {
            const setCookie = proxyRes.headers['set-cookie']
            if (!setCookie) return
            proxyRes.headers['set-cookie'] = setCookie.map((c) =>
              c
                .replace(/;\s*secure/gi, '')
                .replace(/;\s*samesite=none/gi, '; SameSite=Lax')
            )
          })
        },
      },
    },
  },
})
