import { invoke } from '@tauri-apps/api/core'

export type EditorId = 'codex' | 'cursor'

type ApplyPromptPayload = {
  editorId: EditorId
  enabled: boolean
  managedBlock: string
}

export type ApplyPromptResult = {
  action: 'removed' | 'unchanged' | 'updated'
  editorId: EditorId
  targetPath: string
  updatedAt: string
}

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown
  }
}

/**
 * Check whether the current UI is running inside the Tauri desktop runtime.
 */
export function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && window.__TAURI_INTERNALS__ !== undefined
}

/**
 * Apply the generated managed prompt block to the configured editor target.
 */
export async function applyPromptToEditorTarget(
  payload: ApplyPromptPayload,
): Promise<ApplyPromptResult> {
  return invoke<ApplyPromptResult>('apply_prompt_to_editor_target', { payload })
}
