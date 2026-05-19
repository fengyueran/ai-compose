import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vitest/config'

const tauriHost = process.env.TAURI_DEV_HOST

export default defineConfig({
  clearScreen: false,
  plugins: [react(), tailwindcss()],
  server: {
    host: tauriHost ?? false,
    port: 1420,
    strictPort: true,
    hmr: tauriHost
      ? {
          host: tauriHost,
          port: 1421,
          protocol: 'ws',
        }
      : undefined,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
  },
})
