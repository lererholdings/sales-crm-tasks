import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  // '/' by default (current Preview/Production behavior, unchanged). Set to
  // e.g. '/sales-tasks/' only for a deployment mounted under a path prefix
  // on another domain — see docs/design.md's Multi Zones decision log entry.
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
})
