import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({
  base: '/dnd/',
  plugins: [react()],
  server: { proxy: { '/dnd/api': 'http://localhost:8787' } },
})
