export const DEV_PORT_BASE: number
export const DEV_PORT_RANGE: number

export type ResolveDevServerPortsOptions = {
  cwd?: string
  packageName?: string
  portOverride?: string | number | null | undefined
}

export function resolveProjectName(options?: {
  cwd?: string
  packageName?: string | null | undefined
}): string

export function resolveDevServerPorts(
  options?: ResolveDevServerPortsOptions,
): {
  projectName: string
  port: number
  hmrPort: number
}
