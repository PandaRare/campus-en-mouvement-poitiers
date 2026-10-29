import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Campus en Mouvement',
        short_name: 'Campus',
        description: 'Covoiturage entre étudiants du campus',
        lang: 'fr',
        start_url: '/',
        display: 'standalone',
        background_color: '#F3F5F2',
        theme_color: '#123B31',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Notifications push : public/push-sw.js est chargé dans le service worker généré
        importScripts: ['push-sw.js'],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // Lecture hors-ligne des données personnelles : trajets, réservations, messages, profils.
            // NetworkFirst : réseau d'abord (données fraîches), cache si le réseau échoue ou dépasse 4 s.
            // Seules les requêtes GET sont mises en cache (les écritures et RPC ne le sont jamais).
            // Ce cache est vidé à la déconnexion (voir App.jsx).
            urlPattern: /^https:\/\/[^/]+\.supabase\.co\/rest\/v1\/(rides|reservations|messages|profiles)(\?|\/|$)/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-cache',
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 100, maxAgeSeconds: 7 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            urlPattern: /^https:\/\/[abc]\.tile\.openstreetmap\.org\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'map-tiles-cache',
              expiration: { maxEntries: 150 },
            },
          },
        ],
      },
    }),
  ],
})
