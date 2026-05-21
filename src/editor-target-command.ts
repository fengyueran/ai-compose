import { invoke } from '@tauri-apps/api/core'

export type EditorId = 'antigravity' | 'codex' | 'cursor'

type ApplyPromptPayload = {
  editorId: EditorId
  enabled: boolean
  managedBlock: string
}

export type EditorTargetState = {
  enabled: boolean
  targetPath: string
  mcpServers?: Record<string, unknown>
  managedMcpServers?: Record<string, unknown>
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

/**
 * Load editor enablement states from their managed target files.
 */
export async function loadEditorTargetStates(): Promise<
  Record<EditorId, EditorTargetState>
> {
  return invoke<Record<EditorId, EditorTargetState>>('load_editor_target_states')
}

export type ApplyMcpPayload = {
  editorId: EditorId
  enabled: boolean
  configJson: string
}

export type ApplyMcpResult = {
  action: 'removed' | 'unchanged' | 'updated'
  editorId: EditorId
  targetPath: string
  updatedAt: string
}

export async function applyMcpToEditorTarget(
  payload: ApplyMcpPayload,
): Promise<ApplyMcpResult> {
  return invoke<ApplyMcpResult>('apply_mcp_to_editor_target', { payload })
}

export async function loadEditorMcpStates(): Promise<
  Record<EditorId, EditorTargetState>
> {
  return invoke<Record<EditorId, EditorTargetState>>('load_editor_mcp_states')
}

export type SkillInfo = {
  id: string
  name: string
  description: string
  content: string
  path: string
  sourceKind: 'cli' | 'fallbackDirectory'
  isBuiltin?: boolean
  installed?: boolean
  repoSource?: string
}

export type EditorSkillsState = {
  enabled: boolean
  targetPath: string
  enabledSkills: string[]
}

export type EditorSkillsStates = Record<EditorId, EditorSkillsState>

export type ApplySkillsPayload = {
  editorId: EditorId
  enabled: boolean
  enabledSkills: string[]
}

export type ApplySkillsResult = {
  action: 'removed' | 'unchanged' | 'updated'
  editorId: EditorId
  targetPath: string
  updatedAt: string
}

export async function loadPhysicalSkills(): Promise<SkillInfo[]> {
  return invoke<SkillInfo[]>('load_physical_skills')
}

export async function loadEditorSkillsStates(): Promise<EditorSkillsStates> {
  return invoke<EditorSkillsStates>('load_editor_skills_states')
}

export async function applySkillsToEditorTarget(
  payload: ApplySkillsPayload,
): Promise<ApplySkillsResult> {
  return invoke<ApplySkillsResult>('apply_skills_to_editor_target', { payload })
}

export async function addSkillsRepository(repo: string): Promise<string> {
  return invoke<string>('add_skills_repository', { repo })
}

export async function updateSkill(skillId: string): Promise<string> {
  return invoke<string>('update_skill', { skillId })
}

export async function removeSkill(skillId: string): Promise<string> {
  return invoke<string>('remove_skill', { skillId })
}
