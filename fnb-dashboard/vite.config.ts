import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { defineConfig } from 'vite'

const API_TARGET = 'http://localhost:8081'

/**
 * `fnb-server` has no CORS middleware, so the browser cannot call `:8081` from the dev
 * origin. Proxy the API prefixes instead and keep the paths unchanged: the refresh cookie
 * is scoped to `Path=/auth`, so rewriting it behind `/api` would drop the cookie.
 *
 * `/menus`, `/tables`, `/orders`, and `/settings` are also client routes. A hard navigation
 * asks for `text/html`, which is served from `index.html`; only XHR/fetch reaches the API.
 */
const API_PREFIXES = [
  '/auth',
  '/orders',
  '/tables',
  '/menus',
  '/menu-categories',
  '/recipe-items',
  '/ingredients',
  '/stock-movements',
  '/users',
  '/settings',
  '/audit-log',
  '/uploads',
  '/public',
  '/health',
  '/ws',
]

const bypassDocumentNavigation = (req: { headers: { accept?: string } }) =>
  req.headers.accept?.includes('text/html') ? '/index.html' : undefined

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    proxy: Object.fromEntries(
      API_PREFIXES.map((prefix) => [
        prefix,
        {
          target: API_TARGET,
          changeOrigin: true,
          ws: prefix === '/ws',
          bypass: bypassDocumentNavigation,
        },
      ]),
    ),
  },
})
