import { spawn } from 'node:child_process'
import { resolveDevServerPorts } from './dev-port.mjs'

function resolvePnpmCommand() {
  return process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
}

const { projectName, port, hmrPort } = resolveDevServerPorts()
const tauriConfigOverride = JSON.stringify({
  build: {
    beforeDevCommand: `pnpm dev --host 0.0.0.0 --port ${port}`,
    devUrl: `http://127.0.0.1:${port}`,
  },
})

console.log(
  `[ai-compose] project=${projectName} devPort=${port} hmrPort=${hmrPort}`,
)

const child = spawn(
  resolvePnpmCommand(),
  ['tauri', 'dev', '--config', tauriConfigOverride, ...process.argv.slice(2)],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      APP_DEV_PORT: String(port),
      APP_HMR_PORT: String(hmrPort),
      AI_COMPOSE_PROJECT_NAME: projectName,
    },
  },
)

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }

  process.exit(code ?? 0)
})
