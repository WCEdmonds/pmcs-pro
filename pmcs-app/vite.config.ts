import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  if (command === 'build' && mode === 'production' && !(env.VITE_API_URL || '').trim()) {
    throw new Error(
      'VITE_API_URL is not set. The field app cannot reach the API without it. ' +
      'Set it in .env.production (or the environment) before building.',
    )
  }

  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        strategies: 'generateSW',
        registerType: 'autoUpdate',
        injectRegister: false, // registered in src/utils/pwa.ts
        manifest: false, // public/manifest.json
        workbox: {
          // App shell, every JS/CSS chunk, the DA 2404 template, icons and small images.
          globPatterns: ['**/*.{js,css,html,pdf,svg,ico,jpg,webmanifest,json}', '*.png'],
          // TM page diagrams (assets/*.png, ~20 MB) are cached on first view instead.
          globIgnores: ['assets/**/*.png'],
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [/^\/files\//, /^\/api\//],
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true,
          runtimeCaching: [
            {
              urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith('/assets/') && /\.(png|jpe?g|webp)$/.test(url.pathname),
              handler: 'CacheFirst',
              options: {
                cacheName: 'tm-images',
                expiration: { maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 180 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            {
              urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com',
              handler: 'StaleWhileRevalidate',
              options: { cacheName: 'google-fonts', expiration: { maxEntries: 20 } },
            },
          ],
        },
      }),
    ],
  }
})
