import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [['babel-plugin-react-compiler']],
      },
    }),
  ],
  server: {
    proxy: {
      // Match backend default in this repo (uvicorn --port 8001)
      '/regime': {
        target: 'http://127.0.0.1:8001',
        changeOrigin: true,
      },
      '/market': {
        target: 'http://127.0.0.1:8001',
        changeOrigin: true,
      },
      '/macro': {
        target: 'http://127.0.0.1:8001',
        changeOrigin: true,
      },
      '/signals': {
        target: 'http://127.0.0.1:8001',
        changeOrigin: true,
      },
      '/allocation': {
        target: 'http://127.0.0.1:8001',
        changeOrigin: true,
      },
      '/news': {
        target: 'http://127.0.0.1:8001',
        changeOrigin: true,
      },
    },
  },
})
