import fs from 'node:fs'
import path from 'node:path'

export const DEV_PORT_BASE = 14000
export const DEV_PORT_RANGE = 2000

function normalizeProjectName(name) {
  const normalized = String(name ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return normalized || 'app'
}

function hashProjectName(projectName) {
  let hash = 0

  for (const char of projectName) {
    hash = (hash * 31 + char.charCodeAt(0)) % DEV_PORT_RANGE
  }

  return hash
}

function readPackageName(cwd) {
  const packageJsonPath = path.join(cwd, 'package.json')
  if (!fs.existsSync(packageJsonPath)) {
    return null
  }

  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
    return typeof packageJson.name === 'string' ? packageJson.name : null
  } catch {
    return null
  }
}

function parsePortOverride(value) {
  if (value == null || value === '') {
    return null
  }

  const port = Number.parseInt(String(value), 10)
  if (!Number.isInteger(port) || port < 1024 || port > 65534) {
    return null
  }

  return port
}

export function resolveProjectName(options = {}) {
  const cwd = options.cwd ?? process.cwd()
  const packageName = options.packageName ?? readPackageName(cwd)

  if (packageName) {
    return normalizeProjectName(packageName)
  }

  return normalizeProjectName(path.basename(cwd))
}

export function resolveDevServerPorts(options = {}) {
  const projectName = resolveProjectName(options)
  const overriddenPort = parsePortOverride(
    options.portOverride ?? process.env.APP_DEV_PORT,
  )
  const port = overriddenPort ?? DEV_PORT_BASE + hashProjectName(projectName)

  return {
    projectName,
    port,
    hmrPort: port + 1,
  }
}
