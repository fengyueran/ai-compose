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

export type UnlinkSkillPayload = {
  editorId: EditorId
  skillId: string
}

export type LinkSkillPayload = {
  editorId: EditorId
  skillId: string
  skillPath: string
}

export type LoadSingleSkillPayload = {
  id: string
  path: string
  sourceKind: 'cli' | 'fallbackDirectory'
}

export type LoadEditorInstalledSkillsPayload = {
  editorId: EditorId
}

export type ApplySkillsResult = {
  action: 'removed' | 'unchanged' | 'updated'
  editorId: EditorId
  targetPath: string
  updatedAt: string
}

export type AddSkillsRepositoryResult = SkillInfo[]

export async function loadPhysicalSkills(): Promise<SkillInfo[]> {
  return invoke<SkillInfo[]>('load_physical_skills')
}

export async function loadEditorSkillsStates(): Promise<EditorSkillsStates> {
  return invoke<EditorSkillsStates>('load_editor_skills_states')
}

export async function loadEditorInstalledSkills(
  payload: LoadEditorInstalledSkillsPayload,
): Promise<SkillInfo[]> {
  return invoke<SkillInfo[]>('load_editor_installed_skills', { payload })
}

export async function applySkillsToEditorTarget(
  payload: ApplySkillsPayload,
): Promise<ApplySkillsResult> {
  return invoke<ApplySkillsResult>('apply_skills_to_editor_target', { payload })
}

export async function unlinkSkillFromEditor(
  payload: UnlinkSkillPayload,
): Promise<ApplySkillsResult> {
  return invoke<ApplySkillsResult>('unlink_skill_from_editor', { payload })
}

export async function linkSkillToEditor(
  payload: LinkSkillPayload,
): Promise<ApplySkillsResult> {
  return invoke<ApplySkillsResult>('link_skill_to_editor', { payload })
}

export async function loadSingleSkill(
  payload: LoadSingleSkillPayload,
): Promise<SkillInfo> {
  return invoke<SkillInfo>('load_single_skill_command', { payload })
}

export async function addSkillsRepository(repo: string): Promise<AddSkillsRepositoryResult> {
  return invoke<AddSkillsRepositoryResult>('add_skills_repository', { repo })
}

export async function openExternalUrl(url: string): Promise<void> {
  return invoke<void>('open_external_url', { url })
}

export async function openLocalPath(path: string): Promise<void> {
  return invoke<void>('open_local_path', { path })
}

export async function revealLocalPath(path: string): Promise<void> {
  return invoke<void>('reveal_local_path', { path })
}

export async function updateSkill(skillId: string): Promise<string> {
  return invoke<string>('update_skill', { skillId })
}

export async function removeSkill(skillId: string): Promise<string> {
  return invoke<string>('remove_skill', { skillId })
}

export interface SkillSource {
  id: string
  type: 'all' | 'preset' | 'repo' | 'local'
  name: string
  value: string
}

export async function loadSkillsFromDir(path: string): Promise<SkillInfo[]> {
  return invoke<SkillInfo[]>('load_skills_from_dir', { path })
}

export async function selectDirectory(): Promise<string> {
  return invoke<string>('select_directory')
}

export function normalizeRepoSource(repo: string): string {
  let trimmed = repo.trim();
  // Remove trailing slashes.
  trimmed = trimmed.replace(/\/+$/, "");

  // Remove the http/https scheme.
  const withoutScheme = trimmed.replace(/^https?:\/\//, "");
  // Remove the www. prefix.
  const withoutWww = withoutScheme.replace(/^www\./, "");
  // Remove the github.com/ prefix.
  let githubPath = withoutWww.replace(/^github\.com\//, "");

  // Strip query parameters and hash fragments.
  githubPath = githubPath.split(/[?#]/)[0];

  // Remove the .git suffix and any trailing slashes.
  const pathWithoutSuffix = githubPath.replace(/\.git$/, "").replace(/\/+$/, "");

  // If the value is in owner/repo form, keep only the first two segments.
  const parts = pathWithoutSuffix.split("/");
  if (parts.length >= 2) {
    return `${parts[0]}/${parts[1]}`;
  }
  return pathWithoutSuffix;
}
