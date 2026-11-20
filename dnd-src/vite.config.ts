import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// Vite root is dnd-src/. Output goes to <repo>/dnd so it is served at /dnd.
export default defineConfig({
  base: '/dnd/',
  plugins: [react()],
  build: { outDir: '../dnd', emptyOutDir: true },
  server: { proxy: { '/dnd/api': 'http://localhost:8787' } },
})
