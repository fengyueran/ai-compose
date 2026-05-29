import type { HookDefinition, HookTrigger } from '../../../shared'

const antigravityToolMatcher = '*'
const cursorWriteToolMatcher = 'Write'
const codexToolMatcher = 'apply_patch|Edit|Write|Bash'
export const formatCurrentFilePlaceholder = '{{current_file}}'

function mapTriggerToEvent(trigger: HookTrigger): 'PreToolUse' | 'PostToolUse' | 'Stop' {
  switch (trigger) {
    case 'before-run':
      return 'PreToolUse'
    case 'before-commit':
      return 'Stop'
    case 'after-run':
    case 'after-failure':
    default:
      return 'PostToolUse'
  }
}

function buildCommandHandlers(commands: string[], includeTimeout: boolean) {
  return commands
    .map((command) => command.trim())
    .filter(Boolean)
    .map((command) =>
      includeTimeout
        ? {
            type: 'command',
            command,
            timeout: 30,
          }
        : {
            type: 'command',
            command,
          },
    )
}

function encodeHexUtf8(value: string) {
  return Array.from(new TextEncoder().encode(value))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

export function buildFormatCurrentFileTemplateCommand(formatCommand: string) {
  const encodedFormatCommand = encodeHexUtf8(formatCommand)

  return `bash -c 'cwd="\${CURSOR_PROJECT_DIR:-\$CLAUDE_PROJECT_DIR}"; if [ -z "\$cwd" ] && [ ! -t 0 ]; then json=\$(cat); cwd=\$(echo "\$json" | grep -oE "\\"workspacePaths\\"\\\\s*:\\\\s*\\\\[\\\\s*\\"[^\\"]+\\\"" | sed "s/.*\\"\\\\(.*\\\\)\\".*/\\\\1/"); if [ -z "\$cwd" ]; then cwd=\$(echo "\$json" | grep -oE "\\"workspace_roots\\"\\\\s*:\\\\s*\\\\[\\\\s*\\"[^\\"]+\\\"" | sed "s/.*\\"\\\\(.*\\\\)\\".*/\\\\1/"); fi; if [ -z "\$cwd" ]; then cwd=\$(echo "\$json" | grep -oE "\\"cwd\\"\\\\s*:\\\\s*\\"[^\\"]+\\\"" | sed "s/.*\\"\\\\(.*\\\\)\\".*/\\\\1/"); fi; fi; if [ -z "\$cwd" ]; then cwd="."; fi; cd "\$cwd" || exit 1; template=\$(echo "${encodedFormatCommand}" | xxd -r -p); files=\$(git status --porcelain | awk "{print \\$2}"); if [ -n "\$files" ]; then for f in $files; do if [ -f "\$f" ]; then if [[ "\$template" == *"${formatCurrentFilePlaceholder}"* ]]; then cmd="\${template//\\\\{\\\\{current_file\\\\}\\\\}/\$f}"; else cmd="\$template \$f"; fi; eval "\$cmd"; fi; done; fi; echo "{\\"continue\\": true}"'`
}

function resolveHookCommands(hook: HookDefinition) {
  if (hook.mode === 'format-template') {
    const formatCommand = hook.formatCommand?.trim() ?? ''
    return formatCommand ? [buildFormatCurrentFileTemplateCommand(formatCommand)] : []
  }

  return hook.commands
    .map((command) => command.command)
}

function buildNamedHooksJson(
  hooks: HookDefinition[],
  toolMatcher: string,
) {
  const config: Record<string, unknown> = {}

  hooks.forEach((hook) => {
    const eventName = mapTriggerToEvent(hook.trigger)
    const handlers = buildCommandHandlers(resolveHookCommands(hook), true)
    if (handlers.length === 0) return

    config[hook.name] = {
      enabled: true,
      [eventName]:
        eventName === 'Stop'
          ? handlers
          : [
              {
                matcher: toolMatcher,
                hooks: handlers,
              },
            ],
    }
  })

  return JSON.stringify(config, null, 2)
}

function mapTriggerToCursorEvent(trigger: HookTrigger) {
  switch (trigger) {
    case 'before-run':
      return 'preToolUse'
    case 'after-failure':
      return 'postToolUseFailure'
    case 'before-commit':
      return 'stop'
    case 'after-run':
    default:
      return 'afterFileEdit'
  }
}

type CursorHookHandler = {
  command: string
  timeout?: number
  matcher?: string
}

export function buildAntigravityHooksPreview(hooks: HookDefinition[]) {
  return buildNamedHooksJson(hooks, antigravityToolMatcher)
}

export function buildCursorHooksPreview(hooks: HookDefinition[]) {
  const cursorHooks: Record<string, CursorHookHandler[]> = {}

  hooks.forEach((hook) => {
    const eventName = mapTriggerToCursorEvent(hook.trigger)
    const handlers = buildCommandHandlers(resolveHookCommands(hook), true).map((handler) => {
      const baseHandler = {
        command: handler.command,
        timeout: handler.timeout,
      }

      if (eventName === 'preToolUse' || eventName === 'postToolUseFailure') {
        return {
          ...baseHandler,
          matcher: cursorWriteToolMatcher,
        }
      }

      return baseHandler
    })

    if (handlers.length === 0) return

    if (!cursorHooks[eventName]) {
      cursorHooks[eventName] = []
    }

    cursorHooks[eventName].push(...handlers)
  })

  return JSON.stringify(
    {
      version: 1,
      hooks: cursorHooks,
    },
    null,
    2,
  )
}

export function buildCodexHooksPreview(hooks: HookDefinition[]) {
  const codexHooks: Record<string, unknown[]> = {}

  hooks.forEach((hook) => {
    const eventName = mapTriggerToEvent(hook.trigger)
    const handlers = buildCommandHandlers(resolveHookCommands(hook), false)
    if (handlers.length === 0) return

    if (!codexHooks[eventName]) {
      codexHooks[eventName] = []
    }

    codexHooks[eventName].push({
      matcher: eventName === 'Stop' ? '*' : codexToolMatcher,
      hooks: handlers,
    })
  })

  return JSON.stringify({ hooks: codexHooks }, null, 2)
}

export function restoreAdaptiveCommand(command: string): string {
  if (
    typeof command === 'string' &&
    command.includes('template=$(echo "') &&
    command.includes('" | xxd -r -p);')
  ) {
    const match = command.match(/template=\$\(echo "([a-fA-F0-9]+)" \| xxd/)
    if (match && match[1]) {
      const hex = match[1]
      try {
        const bytes = new Uint8Array(
          hex.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
        )
        const decoded = new TextDecoder().decode(bytes)
        return `${decoded} /* ⚡️ 编译后的多编辑器自适应命令 */`
      } catch {
        let decoded = ''
        for (let i = 0; i < hex.length; i += 2) {
          decoded += String.fromCharCode(parseInt(hex.substring(i, i + 2), 16))
        }
        return `${decoded} /* ⚡️ 编译后的多编辑器自适应命令 */`
      }
    }
  }
  return command
}

export function beautifyPreviewJson(jsonStr: string): string {
  try {
    const obj = JSON.parse(jsonStr)

    const walk = (node: any) => {
      if (node && typeof node === 'object') {
        for (const key in node) {
          if (key === 'command' && typeof node[key] === 'string') {
            node[key] = restoreAdaptiveCommand(node[key])
          } else {
            walk(node[key])
          }
        }
      }
    }

    walk(obj)
    return JSON.stringify(obj, null, 2)
  } catch {
    return jsonStr
  }
}

