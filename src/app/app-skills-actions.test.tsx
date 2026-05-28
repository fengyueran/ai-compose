import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import { App } from './app'
import {
  disableTauriRuntime,
  resetAppTestState,
} from './app-test-support'
import {
  addSkillsRepository,
  applySkillsToEditorTarget,
  linkSkillToEditor,
  loadEditorInstalledSkills,
  loadEditorMcpStates,
  loadEditorSkillsStates,
  loadEditorTargetStates,
  loadPhysicalSkills,
  loadSingleSkill,
  loadSkillsFromDir,
  removeSkill,
  selectDirectory,
  unlinkSkillFromEditor,
  updateSkill,
} from '../shared/api/editor-target-command'
import { useAiComposeStore } from '../shared/model/ai-compose-store'

vi.mock('../shared/api/editor-target-command', async () => {
  const actual = await vi.importActual<typeof import('../shared/api/editor-target-command')>(
    '../shared/api/editor-target-command',
  )

  return {
    ...actual,
    addSkillsRepository: vi.fn(),
    applySkillsToEditorTarget: vi.fn(),
    linkSkillToEditor: vi.fn(),
    loadEditorInstalledSkills: vi.fn(),
    loadEditorMcpStates: vi.fn(),
    loadEditorSkillsStates: vi.fn(),
    loadEditorTargetStates: vi.fn(),
    loadPhysicalSkills: vi.fn(),
    loadSingleSkill: vi.fn(),
    loadSkillsFromDir: vi.fn(),
    removeSkill: vi.fn(),
    selectDirectory: vi.fn(),
    unlinkSkillFromEditor: vi.fn(),
    updateSkill: vi.fn(),
  }
})

describe('App skills mutation flows', () => {
  beforeEach(() => {
    resetAppTestState()
    vi.clearAllMocks()
    vi.mocked(loadPhysicalSkills).mockResolvedValue([])
    vi.mocked(loadSkillsFromDir).mockResolvedValue([])
    vi.mocked(selectDirectory).mockResolvedValue('/Users/test/.cursor/skills')
    disableTauriRuntime()
  })

  test('unlinks the selected cli skill from the current editor without uninstalling it globally', async () => {
    vi.mocked(loadPhysicalSkills).mockResolvedValue([
      {
        id: 'linked-skill',
        name: 'Linked Skill',
        description: 'Managed by skills.sh',
        content: '# Linked Skill',
        path: '/Users/test/.agents/skills/linked-skill',
        sourceKind: 'cli',
        repoSource: 'cli-repo',
      },
      {
        id: 'keep-skill',
        name: 'Keep Skill',
        description: 'Managed by skills.sh',
        content: '# Keep Skill',
        path: '/Users/test/.agents/skills/keep-skill',
        sourceKind: 'cli',
        repoSource: 'cli-repo',
      },
    ])
    vi.mocked(unlinkSkillFromEditor).mockResolvedValue({
      action: 'removed',
      editorId: 'cursor',
      targetPath: '/Users/test/.cursor/skills',
      updatedAt: '2026-05-21 18:00:00',
    })
    vi.mocked(loadEditorSkillsStates).mockResolvedValue({
      antigravity: { enabled: false, targetPath: '', enabledSkills: [] },
      codex: { enabled: false, targetPath: '', enabledSkills: [] },
      cursor: {
        enabled: true,
        targetPath: '/Users/test/.cursor/skills',
        enabledSkills: ['keep-skill'],
      },
    })
    vi.mocked(loadEditorInstalledSkills).mockResolvedValue([
      {
        id: 'keep-skill',
        name: 'Keep Skill',
        description: 'Managed by skills.sh',
        content: '# Keep Skill',
        path: '/Users/test/.agents/skills/keep-skill',
        sourceKind: 'cli',
      },
    ])

    useAiComposeStore.setState({
      activeDomain: 'Skills',
      activeEditorId: 'cursor',
      editorStates: {
        antigravity: { enabled: false, targetPath: '', enabledSkills: [] },
        codex: { enabled: false, targetPath: '', enabledSkills: [] },
        cursor: {
          enabled: true,
          targetPath: '/Users/test/.cursor/skills',
          enabledSkills: ['linked-skill', 'keep-skill'],
        },
      },
      skillsEditorStates: {
        antigravity: { enabled: false, targetPath: '', enabledSkills: [] },
        codex: { enabled: false, targetPath: '', enabledSkills: [] },
        cursor: {
          enabled: true,
          targetPath: '/Users/test/.cursor/skills',
          enabledSkills: ['linked-skill', 'keep-skill'],
        },
      },
      skillSources: [
        { id: 'preset', type: 'preset', name: '官方预设', value: '' },
        { id: 'repo:cli', type: 'repo', name: 'CLI Source', value: 'cli-repo' },
      ],
      selectedSkillSourceId: 'repo:cli',
      skills: [
        {
          id: 'linked-skill',
          name: 'Linked Skill',
          description: 'Managed by skills.sh',
          content: '# Linked Skill',
          path: '/Users/test/.agents/skills/linked-skill',
          sourceKind: 'cli',
          repoSource: 'cli-repo',
        },
        {
          id: 'keep-skill',
          name: 'Keep Skill',
          description: 'Managed by skills.sh',
          content: '# Keep Skill',
          path: '/Users/test/.agents/skills/keep-skill',
          sourceKind: 'cli',
          repoSource: 'cli-repo',
        },
      ],
      selectedSkillId: 'linked-skill',
      isHydratingEditorStates: false,
    })

    render(<App />)

    await userEvent.click(screen.getByRole('button', { name: /Linked Skill/ }))
    const dialog = screen.getAllByRole('dialog').find((el) => el.textContent?.includes('技能详情'))!
    await userEvent.click(within(dialog).getByRole('button', { name: '取消链接' }))

    expect(removeSkill).not.toHaveBeenCalled()
    expect(applySkillsToEditorTarget).not.toHaveBeenCalled()
    expect(loadEditorSkillsStates).toHaveBeenCalled()
    expect(unlinkSkillFromEditor).toHaveBeenCalledWith({
      editorId: 'cursor',
      skillId: 'linked-skill',
    })
    expect(useAiComposeStore.getState().skillsEditorStates.cursor.enabledSkills).toEqual(['keep-skill'])
    expect(useAiComposeStore.getState().skills.find((skill) => skill.id === 'keep-skill')).toBeDefined()
    expect(useAiComposeStore.getState().skills.find((skill) => skill.id === 'linked-skill')).toBeDefined()
  })

  test('shows only skills linked to the current editor even when other third-party skills exist globally', async () => {
    vi.mocked(loadEditorTargetStates).mockResolvedValue({
      antigravity: { enabled: false, targetPath: '' },
      codex: { enabled: false, targetPath: '' },
      cursor: { enabled: true, targetPath: '/Users/test/.cursor/AGENTS.md' },
    } as never)
    vi.mocked(loadEditorMcpStates).mockResolvedValue({
      antigravity: { enabled: false, targetPath: '' },
      codex: { enabled: false, targetPath: '' },
      cursor: { enabled: false, targetPath: '' },
    } as never)
    vi.mocked(loadEditorSkillsStates).mockResolvedValue({
      antigravity: { enabled: false, targetPath: '', enabledSkills: [] },
      codex: { enabled: false, targetPath: '', enabledSkills: [] },
      cursor: {
        enabled: true,
        targetPath: '/Users/test/.cursor/skills',
        enabledSkills: ['linked-skill'],
      },
    })
    vi.mocked(loadEditorInstalledSkills).mockResolvedValue([
      {
        id: 'linked-skill',
        name: 'Linked Skill',
        description: 'Managed by skills.sh',
        content: '# Linked Skill',
        path: '/Users/test/.agents/skills/linked-skill',
        sourceKind: 'cli',
      },
    ])
    useAiComposeStore.setState({
      activeDomain: 'Skills',
      activeEditorId: 'cursor',
      editorStates: {
        antigravity: { enabled: false, targetPath: '', enabledSkills: [] },
        codex: { enabled: false, targetPath: '', enabledSkills: [] },
        cursor: {
          enabled: true,
          targetPath: '/Users/test/.cursor/skills',
          enabledSkills: ['linked-skill'],
        },
      },
      skillsEditorStates: {
        antigravity: { enabled: false, targetPath: '', enabledSkills: [] },
        codex: { enabled: false, targetPath: '', enabledSkills: [] },
        cursor: {
          enabled: true,
          targetPath: '/Users/test/.cursor/skills',
          enabledSkills: ['linked-skill'],
        },
      },
      skillSources: [
        { id: 'preset', type: 'preset', name: '官方预设', value: '' },
        { id: 'repo:cli', type: 'repo', name: 'CLI Source', value: 'cli-repo' },
      ],
      selectedSkillSourceId: 'repo:cli',
      skills: [
        {
          id: 'linked-skill',
          name: 'Linked Skill',
          description: 'Managed by skills.sh',
          content: '# Linked Skill',
          path: '/Users/test/.agents/skills/linked-skill',
          sourceKind: 'cli',
          repoSource: 'cli-repo',
        },
        {
          id: 'global-third-party-skill',
          name: 'Global Third Party Skill',
          description: 'Installed globally but not linked to current editor',
          content: '# Global Third Party Skill',
          path: '/Users/test/.agents/skills/global-third-party-skill',
          sourceKind: 'cli',
          repoSource: 'other-repo',
        },
      ],
      selectedSkillId: 'linked-skill',
      isHydratingEditorStates: false,
    })

    render(<App />)

    expect(addSkillsRepository).not.toHaveBeenCalled()
    expect(applySkillsToEditorTarget).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: /Linked Skill/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Global Third Party Skill/ })).not.toBeInTheDocument()
    expect(useAiComposeStore.getState().skillsEditorStates.cursor.enabledSkills).toEqual(['linked-skill'])
  })

  test('installs a repo and refreshes the current editor skills list after linking returned skills', async () => {
    vi.mocked(addSkillsRepository).mockResolvedValue([
      {
        id: 'find-skills',
        name: 'find-skills',
        description: 'builtin preset installed',
        content: '# find-skills latest',
        path: '/Users/test/.agents/skills/find-skills',
        sourceKind: 'cli',
      },
    ])
    vi.mocked(linkSkillToEditor).mockResolvedValue({
      action: 'updated',
      editorId: 'cursor',
      targetPath: '/Users/test/.cursor/skills',
      updatedAt: '2026-05-21 18:12:00',
    })
    vi.mocked(loadEditorSkillsStates).mockResolvedValue({
      antigravity: { enabled: false, targetPath: '', enabledSkills: [] },
      codex: { enabled: false, targetPath: '', enabledSkills: [] },
      cursor: {
        enabled: true,
        targetPath: '/Users/test/.cursor/skills',
        enabledSkills: ['find-skills'],
      },
    })
    vi.mocked(loadEditorInstalledSkills).mockResolvedValue([
      {
        id: 'find-skills',
        name: 'find-skills',
        description: 'builtin preset installed',
        content: '# find-skills latest',
        path: '/Users/test/.agents/skills/find-skills',
        sourceKind: 'cli',
      },
    ])

    useAiComposeStore.setState({
      activeDomain: 'Skills',
      activeEditorId: 'cursor',
      editorStates: {
        antigravity: { enabled: false, targetPath: '', enabledSkills: [] },
        codex: { enabled: false, targetPath: '', enabledSkills: [] },
        cursor: { enabled: false, targetPath: '/Users/test/.cursor/skills', enabledSkills: [] },
      },
      skillsEditorStates: {
        antigravity: { enabled: false, targetPath: '', enabledSkills: [] },
        codex: { enabled: false, targetPath: '', enabledSkills: [] },
        cursor: { enabled: false, targetPath: '/Users/test/.cursor/skills', enabledSkills: [] },
      },
      skills: [],
      selectedSkillId: '',
      isHydratingEditorStates: false,
    })

    render(<App />)

    await userEvent.click(screen.getByRole('button', { name: '+ 添加源' }))
    const dialog = screen.getAllByRole('dialog').find((el) => el.textContent?.includes('添加技能源'))!

    await userEvent.type(
      within(dialog).getByPlaceholderText('例如：开发规范、Vercel 技能集'),
      'Vercel 技能集',
    )
    await userEvent.type(
      within(dialog).getByPlaceholderText('例如：vercel-labs/skills'),
      'vercel-labs/skills',
    )
    await userEvent.click(within(dialog).getByRole('button', { name: '确定' }))

    await waitFor(() => {
      expect(addSkillsRepository).toHaveBeenCalledWith('vercel-labs/skills')
    })
    expect(useAiComposeStore.getState().skillsEditorStates.cursor.enabledSkills).toEqual([])
  })

  test('updates only the selected skill metadata without reloading the full skills list', async () => {
    vi.mocked(loadEditorTargetStates).mockResolvedValue({
      antigravity: { enabled: false, targetPath: '' },
      codex: { enabled: false, targetPath: '' },
      cursor: { enabled: true, targetPath: '/Users/test/.cursor/AGENTS.md' },
    } as never)
    vi.mocked(loadEditorMcpStates).mockResolvedValue({
      antigravity: { enabled: false, targetPath: '' },
      codex: { enabled: false, targetPath: '' },
      cursor: { enabled: false, targetPath: '' },
    } as never)
    vi.mocked(updateSkill).mockResolvedValue('ok')
    vi.mocked(loadEditorInstalledSkills).mockResolvedValue([
      {
        id: 'linked-skill',
        name: 'Linked Skill',
        description: 'Managed by skills.sh',
        content: '# Linked Skill',
        path: '/Users/test/.agents/skills/linked-skill',
        sourceKind: 'cli',
      },
    ])
    vi.mocked(loadSingleSkill).mockResolvedValue({
      id: 'linked-skill',
      name: 'Linked Skill',
      description: 'Updated description',
      content: '# Updated Skill',
      path: '/Users/test/.agents/skills/linked-skill',
      sourceKind: 'cli',
    })

    useAiComposeStore.setState({
      activeDomain: 'Skills',
      activeEditorId: 'cursor',
      editorStates: {
        antigravity: { enabled: false, targetPath: '', enabledSkills: [] },
        codex: { enabled: false, targetPath: '', enabledSkills: [] },
        cursor: {
          enabled: false,
          targetPath: '/Users/test/.cursor/skills',
          enabledSkills: ['linked-skill'],
        },
      },
      skillsEditorStates: {
        antigravity: { enabled: false, targetPath: '', enabledSkills: [] },
        codex: { enabled: false, targetPath: '', enabledSkills: [] },
        cursor: {
          enabled: false,
          targetPath: '/Users/test/.cursor/skills',
          enabledSkills: ['linked-skill'],
        },
      },
      skillSources: [
        { id: 'preset', type: 'preset', name: '官方预设', value: '' },
        { id: 'repo:cli', type: 'repo', name: 'CLI Source', value: 'cli-repo' },
      ],
      selectedSkillSourceId: 'repo:cli',
      skills: [
        {
          id: 'linked-skill',
          name: 'Linked Skill',
          description: 'Managed by skills.sh',
          content: '# Linked Skill',
          path: '/Users/test/.agents/skills/linked-skill',
          sourceKind: 'cli',
          repoSource: 'cli-repo',
        },
      ],
      selectedSkillId: 'linked-skill',
      isHydratingEditorStates: false,
    })

    render(<App />)

    await userEvent.click(await screen.findByRole('button', { name: /Linked Skill/ }))
    const dialog = screen.getAllByRole('dialog').find((el) => el.textContent?.includes('技能详情'))!
    await userEvent.click(within(dialog).getByRole('button', { name: '更新' }))

    expect(updateSkill).toHaveBeenCalledWith('linked-skill')
    expect(loadSingleSkill).toHaveBeenCalledWith({
      id: 'linked-skill',
      path: '/Users/test/.agents/skills/linked-skill',
      sourceKind: 'cli',
    })
    expect(useAiComposeStore.getState().skills.find((skill) => skill.id === 'linked-skill')?.description).toBe(
      'Updated description',
    )
  })

  test('adds a custom local source using native directory dialog', async () => {
    useAiComposeStore.setState({
      activeDomain: 'Skills',
      activeEditorId: 'cursor',
      editorStates: {
        antigravity: { enabled: false, targetPath: '', enabledSkills: [] },
        codex: { enabled: false, targetPath: '', enabledSkills: [] },
        cursor: { enabled: false, targetPath: '/Users/test/.cursor/skills', enabledSkills: [] },
      },
      skillsEditorStates: {
        antigravity: { enabled: false, targetPath: '', enabledSkills: [] },
        codex: { enabled: false, targetPath: '', enabledSkills: [] },
        cursor: { enabled: false, targetPath: '/Users/test/.cursor/skills', enabledSkills: [] },
      },
      skills: [],
      selectedSkillId: '',
      isHydratingEditorStates: false,
    })

    render(<App />)

    await userEvent.click(screen.getByRole('button', { name: '+ 添加源' }))
    const dialog = screen.getAllByRole('dialog').find((el) => el.textContent?.includes('添加技能源'))!

    await userEvent.click(within(dialog).getByRole('button', { name: '本地物理目录' }))

    const selectFolderBtn = within(dialog).getByRole('button', { name: '选择文件夹' })
    expect(selectFolderBtn).toBeInTheDocument()

    await userEvent.click(selectFolderBtn)
    expect(selectDirectory).toHaveBeenCalled()

    const inputElement = within(dialog).getByPlaceholderText('例如：/Users/username/my-skills')
    expect(inputElement).toHaveValue('/Users/test/.cursor/skills')

    await userEvent.type(
      within(dialog).getByPlaceholderText('例如：开发规范、Vercel 技能集'),
      '测试本地源',
    )
    await userEvent.click(within(dialog).getByRole('button', { name: '确定' }))

    const skillSources = useAiComposeStore.getState().skillSources
    const addedSource = skillSources.find((source) => source.name === '测试本地源')
    expect(addedSource).toBeDefined()
    expect(addedSource?.type).toBe('local')
    expect(addedSource?.value).toBe('/Users/test/.cursor/skills')
  })
})
