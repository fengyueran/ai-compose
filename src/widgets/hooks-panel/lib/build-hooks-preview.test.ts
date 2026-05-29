import { describe, expect, test } from 'vitest'

import type { HookDefinition } from '../../../shared'
import {
  buildAntigravityHooksPreview,
  buildCodexHooksPreview,
  buildCursorHooksPreview,
  buildFormatCurrentFileTemplateCommand,
  formatCurrentFilePlaceholder,
  restoreAdaptiveCommand,
  beautifyPreviewJson,
} from './build-hooks-preview'

const sampleHooks: HookDefinition[] = [
  {
    id: 'format',
    name: '格式化',
    trigger: 'after-run',
    mode: 'raw',
    commands: [{ id: 'cmd-1', command: 'pnpm lint --fix' }],
    enabledEditors: {
      antigravity: true,
      codex: true,
      cursor: true,
    },
  },
]

describe('build-hooks-preview', () => {
  test('buildAntigravityHooksPreview matches all Antigravity tools by default', () => {
    const parsed = JSON.parse(buildAntigravityHooksPreview(sampleHooks))

    expect(parsed['格式化'].PostToolUse[0].matcher).toBe('*')
    expect(parsed['格式化'].PostToolUse[0].hooks[0]).toEqual({
      type: 'command',
      command: 'pnpm lint --fix',
      timeout: 30,
    })
  })

  test('buildCursorHooksPreview matches Cursor official hooks.json shape', () => {
    const parsed = JSON.parse(buildCursorHooksPreview(sampleHooks))

    expect(parsed).toEqual({
      version: 1,
      hooks: {
        afterFileEdit: [
          {
            command: 'pnpm lint --fix',
            timeout: 30,
          },
        ],
      },
    })
  })

  test('buildCodexHooksPreview keeps Codex hooks.json shape', () => {
    const parsed = JSON.parse(buildCodexHooksPreview(sampleHooks))

    expect(parsed).toEqual({
      hooks: {
        PostToolUse: [
          {
            matcher: 'apply_patch|Edit|Write|Bash',
            hooks: [
              {
                type: 'command',
                command: 'pnpm lint --fix',
              },
            ],
          },
        ],
      },
    })
  })

  test('buildFormatCurrentFileTemplateCommand wraps formatter command with current-file payload resolver', () => {
    const command = buildFormatCurrentFileTemplateCommand(
      `npx prettier --write ${formatCurrentFilePlaceholder}`,
    )

    expect(command).toContain('bash -c')
    expect(command).toContain('xxd -r -p')
    expect(command).toContain('git status --porcelain')
    expect(command).toContain(
      Buffer.from(`npx prettier --write ${formatCurrentFilePlaceholder}`).toString('hex'),
    )
  })

  test('restoreAdaptiveCommand restores adaptive shell command from bash -c wrapper', () => {
    const rawCommand = `npx prettier --write ${formatCurrentFilePlaceholder}`
    const wrapped = buildFormatCurrentFileTemplateCommand(rawCommand)
    const restored = restoreAdaptiveCommand(wrapped)

    expect(restored).toBe(`${rawCommand} /* ⚡️ 编译后的多编辑器自适应命令 */`)

    // Should leave normal command untouched
    expect(restoreAdaptiveCommand('pnpm lint')).toBe('pnpm lint')
  })

  test('beautifyPreviewJson successfully restores all commands in preview JSON structure', () => {
    const hooks: HookDefinition[] = [
      {
        id: 'format-tmpl',
        name: '格式化模板',
        trigger: 'before-commit',
        mode: 'format-template',
        formatCommand: 'npx prettier --write {{current_file}}',
        commands: [],
        enabledEditors: {
          antigravity: true,
          codex: true,
          cursor: true,
        },
      },
    ]

    const preview = buildCodexHooksPreview(hooks)
    const beautified = beautifyPreviewJson(preview)
    const parsed = JSON.parse(beautified)

    expect(parsed.hooks.Stop[0].hooks[0].command).toBe(
      'npx prettier --write {{current_file}} /* ⚡️ 编译后的多编辑器自适应命令 */'
    )
  })

  test('buildFormatCurrentFileTemplateCommand supports multiple files via git status check', () => {
    const generated = buildFormatCurrentFileTemplateCommand('prettier --write {{current_file}}')

    expect(generated).toContain('files=$(git status --porcelain | awk "{print \\$2}")')
    expect(generated).toContain('for f in $files; do')
  })

  test('multi-file regex correctly extracts all modified files from a typical Codex patch block', () => {
    const commandLog = `
*** Begin Patch
*** Add File: src/test-hook.ts
+console.log('test')
*** Add File: src/test-hook1.ts
+console.log('test')
*** End Patch
`
    const regex = /\*\*\*\s+(?:Add|Modify|Delete|Rename|Edit)\s+File:\s*([^\s\n\r]+)/gi
    const files: string[] = []
    let match
    while ((match = regex.exec(commandLog)) !== null) {
      files.push(match[1])
    }

    expect(files).toEqual(['src/test-hook.ts', 'src/test-hook1.ts'])
  })
})

