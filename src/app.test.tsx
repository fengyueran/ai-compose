import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'

import AiComposeApp from './ai-compose-app'
import { addSkillsRepository, applySkillsToEditorTarget, linkSkillToEditor, loadEditorInstalledSkills, loadEditorMcpStates, loadEditorSkillsStates, loadEditorTargetStates, loadPhysicalSkills, loadSingleSkill, openExternalUrl, removeSkill, unlinkSkillFromEditor, updateSkill } from './editor-target-command'
import { usePromptWorkbenchStore } from './prompt-workbench-store'

vi.mock('./editor-target-command', async () => {
  const actual = await vi.importActual<typeof import('./editor-target-command')>('./editor-target-command')
  return {
    ...actual,
    addSkillsRepository: vi.fn(),
    applySkillsToEditorTarget: vi.fn(),
    loadEditorInstalledSkills: vi.fn(),
    loadEditorMcpStates: vi.fn(),
    loadEditorSkillsStates: vi.fn(),
    loadEditorTargetStates: vi.fn(),
    loadPhysicalSkills: vi.fn(),
    loadSingleSkill: vi.fn(),
    openExternalUrl: vi.fn(),
    linkSkillToEditor: vi.fn(),
    removeSkill: vi.fn(),
    unlinkSkillFromEditor: vi.fn(),
    updateSkill: vi.fn(),
  }
})

describe('Prompt Workbench', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('renders the codex prompt workbench skeleton', () => {
    render(<AiComposeApp />)

    expect(
      screen.getByRole('heading', { name: 'AI Compose' }),
    ).toBeInTheDocument()
    expect(screen.getAllByText('Codex').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Prompt').length).toBeGreaterThan(0)
    expect(screen.getAllByText('核心原则').length).toBeGreaterThan(0)
    expect(screen.getAllByText('安全指南').length).toBeGreaterThan(0)
    expect(screen.getAllByText('代码风格').length).toBeGreaterThan(0)
    expect(screen.getAllByText('测试要求').length).toBeGreaterThan(0)
    expect(screen.getAllByText('开发流程').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Git 工作流').length).toBeGreaterThan(0)
    expect(screen.getAllByText('代码审查').length).toBeGreaterThan(0)
    expect(screen.getAllByText('知识沉淀与协作').length).toBeGreaterThan(0)
    expect(screen.getByText('最终 Prompt 预览')).toBeInTheDocument()
  })

  test('toggles fragment prompt status and updates button style and preview', async () => {
    render(<AiComposeApp />)

    // 默认是启用的，因此按钮应该显示 “从最终 Prompt 移除”
    const actionBtn = screen.getByRole('button', { name: '从最终 Prompt 移除' })
    expect(actionBtn).toBeInTheDocument()
    expect(actionBtn.className).toContain('fragment-action-btn--active')

    // 点击该按钮移除它
    await userEvent.click(actionBtn)

    // 按钮文案应该变成 “加入最终 Prompt”，且不应该包含 active 类名
    expect(screen.getByRole('button', { name: '加入最终 Prompt' })).toBeInTheDocument()
    expect(actionBtn.className).not.toContain('fragment-action-btn--active')

    // 再次点击加入
    await userEvent.click(actionBtn)
    expect(screen.getByRole('button', { name: '从最终 Prompt 移除' })).toBeInTheDocument()
    expect(actionBtn.className).toContain('fragment-action-btn--active')
  })

  test('toggles active configuration domain to MCP and displays server list and json preview', async () => {
    render(<AiComposeApp />)

    // 默认是 Prompt 域激活，MCP 配置域应该可被点击
    const mcpDomainBtn = screen.getByRole('button', { name: 'MCP' })
    expect(mcpDomainBtn).toBeInTheDocument()

    // 切换到 MCP 配置域
    await userEvent.click(mcpDomainBtn)

    // 应切换为 active，且中间区域应当显示 MCP 相关的标题
    expect(screen.getByText('官方预设 MCP 服务')).toBeInTheDocument()

    // 预设列表中应展示 context7, playwright, memory 等
    expect(screen.getAllByText('context7').length).toBeGreaterThan(0)
    expect(screen.getAllByText('playwright').length).toBeGreaterThan(0)
    expect(screen.getAllByText('memory').length).toBeGreaterThan(0)

    // 默认右侧预览区应该展示 MCP TOML 格式（因为默认编辑器是 codex）
    expect(screen.getByText(/\[mcp_servers\]/)).toBeInTheDocument()
    expect(screen.getByText(/\[mcp_servers\.context7\]/)).toBeInTheDocument()
    expect(screen.getByText(/\[mcp_servers\.playwright\]/)).toBeInTheDocument()
    expect(screen.getByText(/\[mcp_servers\.memory\]/)).toBeInTheDocument()
  })

  test('adds a custom MCP server and saves it with correct style variables', async () => {
    render(<AiComposeApp />)

    // 切换到 MCP 配置域
    await userEvent.click(screen.getByRole('button', { name: 'MCP' }))

    // 点击 “+ 添加自定义” 按钮
    const addBtn = screen.getByRole('button', { name: '+ 添加自定义' })
    await userEvent.click(addBtn)

    // 此时表单应该呈现 “添加自定义 MCP” 的标题
    expect(screen.getByText('添加自定义 MCP')).toBeInTheDocument()

    // 检查 “+ 添加环境变量” 按钮的 style 是否使用了正确的变量，避免 `--accent-color`
    const addEnvBtn = screen.getByRole('button', { name: '+ 添加环境变量' })
    expect(addEnvBtn).toBeInTheDocument()
    expect(addEnvBtn.style.color).toBe('var(--accent)')
    expect(addEnvBtn.style.border).toContain('var(--accent)')

    // 检查 “创建服务” 按钮的 style 是否使用了正确的变量
    const createBtn = screen.getByRole('button', { name: '创建服务' })
    expect(createBtn).toBeInTheDocument()
    expect(createBtn.style.background).toContain('var(--accent)')
  })

  test('adds a custom HTTP/SSE direct MCP server and updates configuration preview', async () => {
    render(<AiComposeApp />)

    // 切换到 MCP 配置域
    await userEvent.click(screen.getByRole('button', { name: 'MCP' }))

    // 点击 “+ 添加自定义” 按钮
    const addBtn = screen.getByRole('button', { name: '+ 添加自定义' })
    await userEvent.click(addBtn)

    // 输入服务名称
    const nameInput = screen.getByPlaceholderText('例如: weather')
    await userEvent.type(nameInput, 'figma_local')

    // 切换传输协议类型为 “直连服务 (HTTP/SSE)”
    const httpTabBtn = screen.getByRole('button', { name: '直连服务 (HTTP/SSE)' })
    await userEvent.click(httpTabBtn)

    // 输入 URL
    const urlInput = screen.getByPlaceholderText('例如: http://127.0.0.1:3845/mcp')
    await userEvent.type(urlInput, 'http://127.0.0.1:3845/mcp')

    // 点击创建服务
    const createBtn = screen.getByRole('button', { name: '创建服务' })
    await userEvent.click(createBtn)

    // 断言 figma_local 已在左侧列表中展示
    expect(screen.getAllByText('figma_local').length).toBeGreaterThan(0)

    // 默认展示的 TOML 预览中，应包含 type 和 url 的定义
    expect(screen.getByText(/\[mcp_servers\.figma_local\]/)).toBeInTheDocument()
    expect(screen.getByText(/type = "streamable_http"/)).toBeInTheDocument()
    expect(screen.getByText(/url = "http:\/\/127.0.0.1:3845\/mcp"/)).toBeInTheDocument()
  })

  test('shows current editor installed skills and keeps fallback skills read-only', async () => {
    usePromptWorkbenchStore.setState({
      activeDomain: 'Skills',
      activeEditorId: 'cursor',
      editorStates: {
        antigravity: { enabled: false, targetPath: '', enabledSkills: [] },
        codex: { enabled: false, targetPath: '', enabledSkills: [] },
        cursor: { enabled: true, targetPath: '/Users/test/.cursor/skills', enabledSkills: ['cli-skill', 'local-scan-skill'] },
      },
      skillsEditorStates: {
        antigravity: { enabled: false, targetPath: '', enabledSkills: [] },
        codex: { enabled: false, targetPath: '', enabledSkills: [] },
        cursor: { enabled: true, targetPath: '/Users/test/.cursor/skills', enabledSkills: ['cli-skill', 'local-scan-skill'] },
      },
      skills: [
        {
          id: 'cli-skill',
          name: 'CLI Skill',
          description: 'Managed by skills.sh',
          content: '# CLI Skill',
          path: '/Users/test/.agents/skills/cli-skill',
          sourceKind: 'cli',
        },
        {
          id: 'local-scan-skill',
          name: 'Local Scan Skill',
          description: 'Scanned from an editor target directory',
          content: '# Local Scan Skill',
          path: '/Users/test/.cursor/skills/local-scan-skill',
          sourceKind: 'fallbackDirectory',
        },
      ],
      selectedSkillId: 'cli-skill',
      isHydratingEditorStates: false,
    })

    render(<AiComposeApp />)

    expect(screen.getByText(/官方 Skills 0 项 · 当前编辑器已安装 2 项/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '本地 Skills' })).toBeInTheDocument()
    expect(screen.getAllByText('本地已安装').length).toBeGreaterThan(0)
    expect(screen.queryByText('skills.sh')).not.toBeInTheDocument()
    expect(screen.getByText(/Scanned from an editor target directory/)).toBeInTheDocument()

    // Switches should not be present in the document
    expect(screen.queryByRole('switch')).not.toBeInTheDocument()

    // Preview apply summary bar checks
    expect(screen.getAllByText('CLI Skill').length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: '卸载' })).not.toBeInTheDocument()

    // Click on the CLI Skill row to open the details modal
    const cliSkillRow = screen.getByRole('button', { name: /CLI Skill/ })
    await userEvent.click(cliSkillRow)

    expect(within(screen.getByRole('dialog')).getByRole('button', { name: '取消链接' })).toBeInTheDocument()

    const filterSelect = screen.getByRole('combobox')
    await userEvent.click(filterSelect)

    // Check filter by '本地已安装'
    await userEvent.click(screen.getByRole('option', { name: '本地目录' }))
    expect(screen.getByRole('button', { name: /Local Scan Skill/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /CLI Skill/ })).not.toBeInTheDocument()

    // Check filter by '第三方'
    await userEvent.click(filterSelect)
    await userEvent.click(screen.getByRole('option', { name: '第三方' }))
    expect(screen.getByRole('button', { name: /CLI Skill/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Local Scan Skill/ })).not.toBeInTheDocument()
  })

  test('renders official and local skills in separate groups', () => {
    usePromptWorkbenchStore.setState({
      activeDomain: 'Skills',
      activeEditorId: 'cursor',
      editorStates: {
        antigravity: { enabled: false, targetPath: '', enabledSkills: [] },
        codex: { enabled: false, targetPath: '', enabledSkills: [] },
        cursor: { enabled: true, targetPath: '/Users/test/.cursor/skills', enabledSkills: ['brainstorming', 'local-scan-skill'] },
      },
      skillsEditorStates: {
        antigravity: { enabled: false, targetPath: '', enabledSkills: [] },
        codex: { enabled: false, targetPath: '', enabledSkills: [] },
        cursor: { enabled: true, targetPath: '/Users/test/.cursor/skills', enabledSkills: ['brainstorming', 'local-scan-skill'] },
      },
      skills: [
        {
          id: 'brainstorming',
          name: 'brainstorming',
          description: 'Official skill',
          content: '# brainstorming',
          path: '/Users/test/.agents/skills/brainstorming',
          sourceKind: 'cli',
          isBuiltin: true,
        },
        {
          id: 'local-scan-skill',
          name: 'Local Scan Skill',
          description: 'Scanned from an editor target directory',
          content: '# Local Scan Skill',
          path: '/Users/test/.cursor/skills/local-scan-skill',
          sourceKind: 'fallbackDirectory',
        },
      ],
      selectedSkillId: 'brainstorming',
      isHydratingEditorStates: false,
    })

    render(<AiComposeApp />)

    expect(screen.getByRole('heading', { name: '官方 Skills' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '本地 Skills' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: '官方 Skills' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: '本地 Skills' })).toBeInTheDocument()
  })

  test('renders custom repository skills separately from official and local skills', () => {
    usePromptWorkbenchStore.setState({
      activeDomain: 'Skills',
      activeEditorId: 'cursor',
      editorStates: {
        antigravity: { enabled: false, targetPath: '', enabledSkills: [] },
        codex: { enabled: false, targetPath: '', enabledSkills: [] },
        cursor: { enabled: true, targetPath: '/Users/test/.cursor/skills', enabledSkills: ['react-development', 'local-scan-skill'] },
      },
      skillsEditorStates: {
        antigravity: { enabled: false, targetPath: '', enabledSkills: [] },
        codex: { enabled: false, targetPath: '', enabledSkills: [] },
        cursor: { enabled: true, targetPath: '/Users/test/.cursor/skills', enabledSkills: ['react-development', 'local-scan-skill'] },
      },
      skills: [
        {
          id: 'brainstorming',
          name: 'brainstorming',
          description: 'Official skill',
          content: '# brainstorming',
          path: '/Users/test/.agents/skills/brainstorming',
          sourceKind: 'cli',
          isBuiltin: true,
          repoSource: 'obra/superpowers',
        },
        {
          id: 'react-development',
          name: 'react-development',
          description: 'Installed from a custom repo',
          content: '# react-development',
          path: '/Users/test/.agents/skills/react-development',
          sourceKind: 'cli',
          repoSource: 'fengyueran/skills',
        },
        {
          id: 'local-scan-skill',
          name: 'Local Scan Skill',
          description: 'Scanned from an editor target directory',
          content: '# Local Scan Skill',
          path: '/Users/test/.cursor/skills/local-scan-skill',
          sourceKind: 'fallbackDirectory',
        },
      ],
      selectedSkillId: 'react-development',
      isHydratingEditorStates: false,
    })

    render(<AiComposeApp />)

    expect(screen.getByRole('heading', { name: '官方 Skills' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '第三方 Skills' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '本地 Skills' })).toBeInTheDocument()
    expect(screen.getByText('第三方')).toBeInTheDocument()
  })

  test('renders source repository as a clickable GitHub link in skill details', async () => {
    ;(window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {}
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
      cursor: { enabled: true, targetPath: '/Users/test/.cursor/skills', enabledSkills: ['react-development'] },
    })
    vi.mocked(loadPhysicalSkills).mockResolvedValue([
      {
        id: 'react-development',
        name: 'react-development',
        description: 'Installed from a custom repo',
        content: '# react-development',
        path: '/Users/test/.agents/skills/react-development',
        sourceKind: 'cli',
        repoSource: 'fengyueran/skills',
      },
    ])
    vi.mocked(loadEditorInstalledSkills).mockResolvedValue([
      {
        id: 'react-development',
        name: 'react-development',
        description: 'Installed from a custom repo',
        content: '# react-development',
        path: '/Users/test/.agents/skills/react-development',
        sourceKind: 'cli',
        repoSource: 'fengyueran/skills',
      },
    ])
    usePromptWorkbenchStore.setState({
      activeDomain: 'Skills',
      activeEditorId: 'cursor',
      editorStates: {
        antigravity: { enabled: false, targetPath: '', enabledSkills: [] },
        codex: { enabled: false, targetPath: '', enabledSkills: [] },
        cursor: { enabled: true, targetPath: '/Users/test/.cursor/skills', enabledSkills: ['react-development'] },
      },
      skillsEditorStates: {
        antigravity: { enabled: false, targetPath: '', enabledSkills: [] },
        codex: { enabled: false, targetPath: '', enabledSkills: [] },
        cursor: { enabled: true, targetPath: '/Users/test/.cursor/skills', enabledSkills: ['react-development'] },
      },
      skills: [
        {
          id: 'react-development',
          name: 'react-development',
          description: 'Installed from a custom repo',
          content: '# react-development',
          path: '/Users/test/.agents/skills/react-development',
          sourceKind: 'cli',
          repoSource: 'fengyueran/skills',
        },
      ],
      selectedSkillId: 'react-development',
      isHydratingEditorStates: false,
    })

    render(<AiComposeApp />)

    await userEvent.click(screen.getByRole('button', { name: /react-development/ }))

    const repoLink = within(screen.getByRole('dialog')).getByRole('link', { name: 'fengyueran/skills' })
    expect(repoLink).toHaveAttribute('href', 'https://github.com/fengyueran/skills')
    expect(repoLink).toHaveAttribute('target', '_blank')

    await userEvent.click(repoLink)
    expect(openExternalUrl).toHaveBeenCalledWith('https://github.com/fengyueran/skills')

    delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__
  })

  test('renders loading state for skills list when hydrating', () => {
    ;(window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {}
    const pendingPromise = new Promise<never>(() => {})
    vi.mocked(loadEditorTargetStates).mockReturnValue(pendingPromise as never)
    vi.mocked(loadEditorMcpStates).mockReturnValue(pendingPromise as never)
    vi.mocked(loadEditorSkillsStates).mockReturnValue(pendingPromise as never)
    vi.mocked(loadEditorInstalledSkills).mockReturnValue(pendingPromise as never)

    usePromptWorkbenchStore.setState({
      activeDomain: 'Skills',
      isHydratingEditorStates: false,
      skills: [],
    })

    render(<AiComposeApp />)

    expect(screen.getByText('正在加载技能列表...')).toBeInTheDocument()
    expect(screen.queryByText(/当前 .* 未安装任何技能/)).not.toBeInTheDocument()

    delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__
  })

  test('setSkillsList preserves the builtin catalog and marks matching official skills as installed', () => {
    const store = usePromptWorkbenchStore.getState()

    store.setSkillsList([
      {
        id: 'find-skills',
        name: 'find-skills',
        description: 'preset desc',
        content: 'preset content',
        path: '/mock/path/find-skills',
        sourceKind: 'cli',
      },
      {
        id: 'custom-repo-skill',
        name: 'custom-repo-skill',
        description: 'custom repo skill',
        content: '# custom-repo-skill',
        path: '/mock/path/custom-repo-skill',
        sourceKind: 'cli',
        repoSource: 'fengyueran/skills',
      },
    ])
    let currentSkills = usePromptWorkbenchStore.getState().skills
    const findSkillsInstalled = currentSkills.find(s => s.id === 'find-skills')
    expect(findSkillsInstalled).toBeDefined()
    expect(findSkillsInstalled?.installed).toBe(true)
    expect(findSkillsInstalled?.isBuiltin).toBe(true)
    expect(findSkillsInstalled?.repoSource).toBe('vercel-labs/skills')
    const uiUxProMax = currentSkills.find(s => s.id === 'ui-ux-pro-max')
    expect(uiUxProMax).toBeDefined()
    expect(uiUxProMax?.isBuiltin).toBe(true)
    expect(uiUxProMax?.installed).toBe(false)
    expect(uiUxProMax?.repoSource).toBe('nextlevelbuilder/ui-ux-pro-max-skill')
    const customRepoSkill = currentSkills.find(s => s.id === 'custom-repo-skill')
    expect(customRepoSkill).toBeDefined()
    expect(customRepoSkill?.isBuiltin).not.toBe(true)
    expect(customRepoSkill?.repoSource).toBe('fengyueran/skills')

    store.setSkillsList([])
    currentSkills = usePromptWorkbenchStore.getState().skills
    expect(currentSkills.some((skill) => skill.id === 'ui-ux-pro-max')).toBe(true)
    expect(currentSkills.every((skill) => skill.isBuiltin)).toBe(true)
  })

  test('unlinks the selected cli skill from the current editor without uninstalling it globally', async () => {
    vi.mocked(unlinkSkillFromEditor).mockResolvedValue({
      action: 'removed',
      editorId: 'cursor',
      targetPath: '/Users/test/.cursor/skills',
      updatedAt: '2026-05-21 18:00:00',
    })
    vi.mocked(loadEditorSkillsStates).mockResolvedValue({
      antigravity: { enabled: false, targetPath: '', enabledSkills: [] },
      codex: { enabled: false, targetPath: '', enabledSkills: [] },
      cursor: { enabled: true, targetPath: '/Users/test/.cursor/skills', enabledSkills: ['keep-skill'] },
    })
    vi.mocked(loadPhysicalSkills).mockResolvedValue([
      {
        id: 'linked-skill',
        name: 'Linked Skill',
        description: 'Managed by skills.sh',
        content: '# Linked Skill',
        path: '/Users/test/.agents/skills/linked-skill',
        sourceKind: 'cli',
      },
      {
        id: 'keep-skill',
        name: 'Keep Skill',
        description: 'Managed by skills.sh',
        content: '# Keep Skill',
        path: '/Users/test/.agents/skills/keep-skill',
        sourceKind: 'cli',
      },
    ])
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

    usePromptWorkbenchStore.setState({
      activeDomain: 'Skills',
      activeEditorId: 'cursor',
      editorStates: {
        antigravity: { enabled: false, targetPath: '', enabledSkills: [] },
        codex: { enabled: false, targetPath: '', enabledSkills: [] },
        cursor: { enabled: true, targetPath: '/Users/test/.cursor/skills', enabledSkills: ['linked-skill', 'keep-skill'] },
      },
      skillsEditorStates: {
        antigravity: { enabled: false, targetPath: '', enabledSkills: [] },
        codex: { enabled: false, targetPath: '', enabledSkills: [] },
        cursor: { enabled: true, targetPath: '/Users/test/.cursor/skills', enabledSkills: ['linked-skill', 'keep-skill'] },
      },
      skills: [
        {
          id: 'linked-skill',
          name: 'Linked Skill',
          description: 'Managed by skills.sh',
          content: '# Linked Skill',
          path: '/Users/test/.agents/skills/linked-skill',
          sourceKind: 'cli',
        },
        {
          id: 'keep-skill',
          name: 'Keep Skill',
          description: 'Managed by skills.sh',
          content: '# Keep Skill',
          path: '/Users/test/.agents/skills/keep-skill',
          sourceKind: 'cli',
        },
      ],
      selectedSkillId: 'linked-skill',
      isHydratingEditorStates: false,
    })

    render(<AiComposeApp />)

    await userEvent.click(screen.getByRole('button', { name: /Linked Skill/ }))
    await userEvent.click(screen.getByRole('button', { name: '取消链接' }))

    expect(removeSkill).not.toHaveBeenCalled()
    expect(applySkillsToEditorTarget).not.toHaveBeenCalled()
    expect(loadEditorSkillsStates).toHaveBeenCalled()
    expect(unlinkSkillFromEditor).toHaveBeenCalledWith({
      editorId: 'cursor',
      skillId: 'linked-skill',
    })
    expect(usePromptWorkbenchStore.getState().skillsEditorStates.cursor.enabledSkills).toEqual(['keep-skill'])
    expect(usePromptWorkbenchStore.getState().skills.find((skill) => skill.id === 'linked-skill')).toBeDefined()
    expect(usePromptWorkbenchStore.getState().skills.find((skill) => skill.id === 'keep-skill')).toBeDefined()
    expect(usePromptWorkbenchStore.getState().skills.find((skill) => skill.id === 'ui-ux-pro-max')?.installed).toBe(false)
  })

  test('keeps globally installed third-party skills visible while current editor install count follows editor directory state', async () => {
    ;(window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {}
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
      cursor: { enabled: true, targetPath: '/Users/test/.cursor/skills', enabledSkills: ['linked-skill'] },
    })
    vi.mocked(loadPhysicalSkills).mockResolvedValue([
      {
        id: 'linked-skill',
        name: 'Linked Skill',
        description: 'Managed by skills.sh',
        content: '# Linked Skill',
        path: '/Users/test/.agents/skills/linked-skill',
        sourceKind: 'cli',
      },
      {
        id: 'global-third-party-skill',
        name: 'Global Third Party Skill',
        description: 'Installed globally but not linked to current editor',
        content: '# Global Third Party Skill',
        path: '/Users/test/.agents/skills/global-third-party-skill',
        sourceKind: 'cli',
        repoSource: 'fengyueran/skills',
      },
    ])
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
    usePromptWorkbenchStore.setState({
      activeDomain: 'Skills',
      activeEditorId: 'cursor',
      editorStates: {
        antigravity: { enabled: false, targetPath: '', enabledSkills: [] },
        codex: { enabled: false, targetPath: '', enabledSkills: [] },
        cursor: { enabled: true, targetPath: '/Users/test/.cursor/skills', enabledSkills: ['linked-skill'] },
      },
      skillsEditorStates: {
        antigravity: { enabled: false, targetPath: '', enabledSkills: [] },
        codex: { enabled: false, targetPath: '', enabledSkills: [] },
        cursor: { enabled: true, targetPath: '/Users/test/.cursor/skills', enabledSkills: ['linked-skill'] },
      },
      skills: [
        {
          id: 'linked-skill',
          name: 'Linked Skill',
          description: 'Managed by skills.sh',
          content: '# Linked Skill',
          path: '/Users/test/.agents/skills/linked-skill',
          sourceKind: 'cli',
        },
      ],
      selectedSkillId: 'linked-skill',
      isHydratingEditorStates: false,
    })

    render(<AiComposeApp />)

    expect(addSkillsRepository).not.toHaveBeenCalled()
    expect(applySkillsToEditorTarget).not.toHaveBeenCalled()
    expect(await screen.findByText(/官方 Skills 0 项 · 当前编辑器已安装 1 项/)).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: /Global Third Party Skill/ })).toBeInTheDocument()
    expect(usePromptWorkbenchStore.getState().skillsEditorStates.cursor.enabledSkills).toEqual(['linked-skill'])

    delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__
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
      cursor: { enabled: true, targetPath: '/Users/test/.cursor/skills', enabledSkills: ['find-skills'] },
    })
    vi.mocked(loadPhysicalSkills).mockResolvedValue([
      {
        id: 'find-skills',
        name: 'find-skills',
        description: 'builtin preset installed',
        content: '# find-skills latest',
        path: '/Users/test/.agents/skills/find-skills',
        sourceKind: 'cli',
      },
    ])
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

    usePromptWorkbenchStore.setState({
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

    render(<AiComposeApp />)

    await userEvent.type(
      screen.getByPlaceholderText('安装仓库或 GitHub 链接并链接到当前编辑器，如 vercel-labs/agent-skills'),
      'vercel-labs/skills',
    )
    await userEvent.click(screen.getByRole('button', { name: '安装' }))

    expect(addSkillsRepository).toHaveBeenCalledWith('vercel-labs/skills')
    expect(applySkillsToEditorTarget).not.toHaveBeenCalled()
    expect(loadPhysicalSkills).toHaveBeenCalled()
    expect(linkSkillToEditor).toHaveBeenCalledWith({
      editorId: 'cursor',
      skillId: 'find-skills',
      skillPath: '/Users/test/.agents/skills/find-skills',
    })
    expect(loadEditorSkillsStates).toHaveBeenCalled()
    expect(loadEditorInstalledSkills).toHaveBeenCalledWith({ editorId: 'cursor' })
    expect(usePromptWorkbenchStore.getState().skillsEditorStates.cursor.enabledSkills).toEqual(['find-skills'])
    expect(usePromptWorkbenchStore.getState().skills.find((skill) => skill.id === 'find-skills')?.installed).toBe(true)
  })

  test('installs a repo from the toolbar and links every returned skill to the current editor', async () => {
    vi.mocked(addSkillsRepository).mockResolvedValue([
      {
        id: 'find-skills',
        name: 'find-skills',
        description: 'builtin preset installed',
        content: '# find-skills latest',
        path: '/Users/test/.agents/skills/find-skills',
        sourceKind: 'cli',
      },
      {
        id: 'frontend-design',
        name: 'frontend-design',
        description: 'frontend design',
        content: '# frontend-design latest',
        path: '/Users/test/.agents/skills/frontend-design',
        sourceKind: 'cli',
      },
    ])
    vi.mocked(linkSkillToEditor).mockResolvedValue({
      action: 'updated',
      editorId: 'cursor',
      targetPath: '/Users/test/.cursor/skills',
      updatedAt: '2026-05-21 18:13:00',
    })
    vi.mocked(loadEditorSkillsStates).mockResolvedValue({
      antigravity: { enabled: false, targetPath: '', enabledSkills: [] },
      codex: { enabled: false, targetPath: '', enabledSkills: [] },
      cursor: { enabled: true, targetPath: '/Users/test/.cursor/skills', enabledSkills: ['find-skills', 'frontend-design'] },
    })
    vi.mocked(loadPhysicalSkills).mockResolvedValue([
      {
        id: 'find-skills',
        name: 'find-skills',
        description: 'builtin preset installed',
        content: '# find-skills latest',
        path: '/Users/test/.agents/skills/find-skills',
        sourceKind: 'cli',
      },
      {
        id: 'frontend-design',
        name: 'frontend-design',
        description: 'frontend design',
        content: '# frontend-design latest',
        path: '/Users/test/.agents/skills/frontend-design',
        sourceKind: 'cli',
      },
    ])
    vi.mocked(loadEditorInstalledSkills).mockResolvedValue([
      {
        id: 'find-skills',
        name: 'find-skills',
        description: 'builtin preset installed',
        content: '# find-skills latest',
        path: '/Users/test/.agents/skills/find-skills',
        sourceKind: 'cli',
      },
      {
        id: 'frontend-design',
        name: 'frontend-design',
        description: 'frontend design',
        content: '# frontend-design latest',
        path: '/Users/test/.agents/skills/frontend-design',
        sourceKind: 'cli',
      },
    ])

    usePromptWorkbenchStore.setState({
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

    render(<AiComposeApp />)

    await userEvent.type(
      screen.getByPlaceholderText('安装仓库或 GitHub 链接并链接到当前编辑器，如 vercel-labs/agent-skills'),
      'vercel-labs/skills',
    )
    await userEvent.click(screen.getByRole('button', { name: '安装' }))

    expect(addSkillsRepository).toHaveBeenCalledWith('vercel-labs/skills')
    expect(loadPhysicalSkills).toHaveBeenCalled()
    expect(linkSkillToEditor).toHaveBeenCalledTimes(2)
    expect(usePromptWorkbenchStore.getState().skills.find((skill) => skill.id === 'find-skills')?.installed).toBe(true)
    expect(usePromptWorkbenchStore.getState().skills.find((skill) => skill.id === 'frontend-design')?.installed).toBe(true)
    expect(usePromptWorkbenchStore.getState().skills.find((skill) => skill.id === 'ui-ux-pro-max')?.installed).toBe(false)
  })

  test('updates only the selected skill metadata without reloading the full skills list', async () => {
    vi.mocked(updateSkill).mockResolvedValue('ok')
    vi.mocked(loadSingleSkill).mockResolvedValue({
      id: 'linked-skill',
      name: 'Linked Skill',
      description: 'Updated description',
      content: '# Updated Skill',
      path: '/Users/test/.agents/skills/linked-skill',
      sourceKind: 'cli',
    })

    usePromptWorkbenchStore.setState({
      activeDomain: 'Skills',
      activeEditorId: 'cursor',
      editorStates: {
        antigravity: { enabled: false, targetPath: '', enabledSkills: [] },
        codex: { enabled: false, targetPath: '', enabledSkills: [] },
        cursor: { enabled: false, targetPath: '/Users/test/.cursor/skills', enabledSkills: ['linked-skill'] },
      },
      skillsEditorStates: {
        antigravity: { enabled: false, targetPath: '', enabledSkills: [] },
        codex: { enabled: false, targetPath: '', enabledSkills: [] },
        cursor: { enabled: false, targetPath: '/Users/test/.cursor/skills', enabledSkills: ['linked-skill'] },
      },
      skills: [
        {
          id: 'linked-skill',
          name: 'Linked Skill',
          description: 'Managed by skills.sh',
          content: '# Linked Skill',
          path: '/Users/test/.agents/skills/linked-skill',
          sourceKind: 'cli',
        },
      ],
      selectedSkillId: 'linked-skill',
      isHydratingEditorStates: false,
    })

    render(<AiComposeApp />)

    await userEvent.click(screen.getByRole('button', { name: /Linked Skill/ }))
    const dialog = screen.getByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: '更新' }))

    expect(updateSkill).toHaveBeenCalledWith('linked-skill')
    expect(loadSingleSkill).toHaveBeenCalledWith({
      id: 'linked-skill',
      path: '/Users/test/.agents/skills/linked-skill',
      sourceKind: 'cli',
    })
    expect(loadPhysicalSkills).not.toHaveBeenCalled()
    expect(usePromptWorkbenchStore.getState().skills.find((skill) => skill.id === 'linked-skill')?.description).toBe('Updated description')
  })
})
