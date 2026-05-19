import type { PromptFragment } from './prompt-fragments'

export const managedBlockStart = '<!-- BEGIN AI-COMPOSE -->'
export const managedBlockEnd = '<!-- END AI-COMPOSE -->'

/**
 * Compose enabled prompt fragments into a markdown section list that can be
 * inserted into the managed block of the target AGENTS file.
 */
export function composeManagedPromptBlock(
  fragments: PromptFragment[],
  generatedAt: string,
): string {
  const sections = fragments
    .map((fragment) => {
      const items = fragment.items.map((item) => `- ${item}`).join('\n')

      return `## ${fragment.title}\n\n${items}`
    })
    .join('\n\n')

  return [
    managedBlockStart,
    '> 由 Prompt Workbench 自动生成，请通过工作台更新此区块。',
    `> 最近生成时间：${generatedAt}`,
    '',
    '# Prompt Workbench',
    '',
    sections,
    managedBlockEnd,
  ].join('\n')
}

/**
 * Insert or update the managed block in the target AGENTS file content while
 * preserving all non-managed content.
 */
export function upsertManagedBlock(
  originalContent: string,
  managedBlock: string,
): string {
  const escapedStart = escapeRegExp(managedBlockStart)
  const escapedEnd = escapeRegExp(managedBlockEnd)
  const managedBlockPattern = new RegExp(
    `${escapedStart}[\\s\\S]*?${escapedEnd}`,
    'm',
  )

  if (managedBlockPattern.test(originalContent)) {
    return originalContent.replace(managedBlockPattern, managedBlock)
  }

  const normalizedOriginal = originalContent.trimEnd()

  if (normalizedOriginal.length === 0) {
    return `${managedBlock}\n`
  }

  return `${normalizedOriginal}\n\n${managedBlock}\n`
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
