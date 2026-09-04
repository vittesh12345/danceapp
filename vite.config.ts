import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Set BASE_PATH when deploying under a subpath (e.g. /danceapp/ on GitHub Pages).
  base: process.env.BASE_PATH ?? '/',
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
  },
})
