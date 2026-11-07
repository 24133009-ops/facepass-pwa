import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'FacePass PWA - Điểm danh khuôn mặt',
        short_name: 'FacePass',
        description: 'Hệ thống điểm danh lớp học bằng nhận diện khuôn mặt AWS Serverless',
        theme_color: '#2563eb',
        background_color: '#f8fafc',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          {
            src: 'favicon.svg',
            sizes: '192x192 512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        // Only precache code assets, DO NOT precache photos or API responses
        globPatterns: ['**/*.{js,css,html,ico,svg,woff2}'],
        // DO NOT fallback navigation to /api endpoints
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\/.*/],
        runtimeCaching: [
          {
            // CRITICAL REQUIREMENT: NEVER cache /api/* endpoints
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
            handler: 'NetworkOnly',
            options: {
              cacheName: 'api-bypass-never-cache'
            }
          },
          {
            // CRITICAL REQUIREMENT: NEVER cache student/group biometric photos (S3 or local)
            urlPattern: ({ url }) => /\.(?:png|jpg|jpeg|webp)$/i.test(url.pathname) || url.hostname.includes('s3'),
            handler: 'NetworkOnly',
            options: {
              cacheName: 'biometric-photos-never-cache'
            }
          }
        ]
      }
    })
  ],
  server: {
    port: 5173,
    host: true
  }
});

