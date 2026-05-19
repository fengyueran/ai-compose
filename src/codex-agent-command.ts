import { invoke } from '@tauri-apps/api/core'

type ApplyPromptPayload = {
  managedBlock: string
}

export type ApplyPromptResult = {
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
 * Apply the generated managed prompt block to the user-level Codex AGENTS file.
 */
export async function applyPromptToUserCodex(
  payload: ApplyPromptPayload,
): Promise<ApplyPromptResult> {
  return invoke<ApplyPromptResult>('apply_prompt_to_user_codex', { payload })
}
