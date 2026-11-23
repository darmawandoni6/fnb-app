import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, import.meta.dirname, 'VITE_')

  if (mode === 'production' && env.VITE_USE_MOCKS === 'true') {
    throw new Error('VITE_USE_MOCKS must not be true in a production build')
  }

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, './src'),
      },
    },
    server: {
      proxy: {
        '/public': { target: 'http://localhost:8081', changeOrigin: true },
        '/ws': { target: 'http://localhost:8081', changeOrigin: true, ws: true },
      },
    },
  }
})
