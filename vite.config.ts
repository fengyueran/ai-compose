import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vitest/config'
import { resolveDevServerPorts } from './scripts/dev-port.mjs'

const tauriHost = process.env.TAURI_DEV_HOST
const { port, hmrPort } = resolveDevServerPorts()

export default defineConfig({
  clearScreen: false,
  plugins: [react(), tailwindcss()],
  server: {
    host: tauriHost ?? false,
    port,
    strictPort: true,
    hmr: tauriHost
      ? {
          host: tauriHost,
          port: hmrPort,
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
