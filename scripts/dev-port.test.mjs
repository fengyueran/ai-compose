import path from 'node:path'
import { describe, expect, test } from 'vitest'
import {
  DEV_PORT_BASE,
  DEV_PORT_RANGE,
  resolveDevServerPorts,
  resolveProjectName,
} from './dev-port.mjs'

describe('resolveProjectName', () => {
  test('prefers package name when provided', () => {
    expect(resolveProjectName({ packageName: 'AI Compose' })).toBe('ai-compose')
  })

  test('falls back to cwd basename when package name is missing', () => {
    expect(
      resolveProjectName({
        cwd: path.join('/tmp', 'My Project'),
        packageName: '',
      }),
    ).toBe('my-project')
  })
})

describe('resolveDevServerPorts', () => {
  test('returns a stable port for the same project name', () => {
    const first = resolveDevServerPorts({ packageName: 'ai-compose' })
    const second = resolveDevServerPorts({ packageName: 'ai-compose' })

    expect(first).toEqual(second)
  })

  test('returns ports inside the managed range', () => {
    const { port, hmrPort } = resolveDevServerPorts({
      packageName: 'ai-compose',
    })

    expect(port).toBeGreaterThanOrEqual(DEV_PORT_BASE)
    expect(port).toBeLessThan(DEV_PORT_BASE + DEV_PORT_RANGE)
    expect(hmrPort).toBe(port + 1)
  })

  test('supports explicit port override', () => {
    expect(
      resolveDevServerPorts({
        packageName: 'ai-compose',
        portOverride: '17890',
      }),
    ).toMatchObject({
      port: 17890,
      hmrPort: 17891,
    })
  })

  test('different project names produce different ports', () => {
    const first = resolveDevServerPorts({ packageName: 'ai-compose' })
    const second = resolveDevServerPorts({ packageName: 'another-project' })

    expect(first.port).not.toBe(second.port)
  })
})
