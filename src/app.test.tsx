import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'

import AiComposeApp from './ai-compose-app'
import { addSkillsRepository, applySkillsToEditorTarget, linkSkillToEditor, loadEditorSkillsStates, loadPhysicalSkills, loadSingleSkill, removeSkill, unlinkSkillFromEditor, updateSkill } from './editor-target-command'
import { usePromptWorkbenchStore } from './prompt-workbench-store'

vi.mock('./editor-target-command', async () => {
  const actual = await vi.importActual<typeof import('./editor-target-command')>('./editor-target-command')
  return {
    ...actual,
    addSkillsRepository: vi.fn(),
    applySkillsToEditorTarget: vi.fn(),
    loadEditorSkillsStates: vi.fn(),
    loadPhysicalSkills: vi.fn(),
    loadSingleSkill: vi.fn(),
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

  test('keeps fallback scanned skills read-only while cli skills can be linked', async () => {
    usePromptWorkbenchStore.setState({
      activeDomain: 'Skills',
      activeEditorId: 'cursor',
      editorStates: {
        antigravity: { enabled: false, targetPath: '', enabledSkills: [] },
        codex: { enabled: false, targetPath: '', enabledSkills: [] },
        cursor: { enabled: true, targetPath: '/Users/test/.cursor/skills', enabledSkills: [] },
      },
      skillsEditorStates: {
        antigravity: { enabled: false, targetPath: '', enabledSkills: [] },
        codex: { enabled: false, targetPath: '', enabledSkills: [] },
        cursor: { enabled: true, targetPath: '/Users/test/.cursor/skills', enabledSkills: [] },
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

    expect(screen.getByText(/skills.sh 1 项，可链接/)).toBeInTheDocument()
    expect(screen.getByText(/本地已安装 1 项/)).toBeInTheDocument()
    expect(screen.getAllByText('skills.sh').length).toBeGreaterThan(0)
    expect(screen.getAllByText('本地已安装').length).toBeGreaterThan(0)
    expect(screen.getByText(/Scanned from an editor target directory/)).toBeInTheDocument()

    // Switches should not be present in the document
    expect(screen.queryByRole('switch')).not.toBeInTheDocument()

    // Preview apply summary bar checks
    expect(screen.getAllByText('CLI Skill').length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: '卸载' })).not.toBeInTheDocument()

    // Click on the CLI Skill row to open the details modal
    const cliSkillRow = screen.getByRole('button', { name: /CLI Skill/ })
    await userEvent.click(cliSkillRow)

    // Now the button inside the modal should allow linking this cli skill
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: '安装' })).toBeInTheDocument()

    const filterSelect = screen.getByRole('combobox')
    await userEvent.click(filterSelect)

    // Check filter by '本地已安装'
    await userEvent.click(screen.getByRole('option', { name: '本地已安装' }))
    expect(screen.getByRole('button', { name: /Local Scan Skill/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /CLI Skill/ })).not.toBeInTheDocument()

    // Check filter by 'skills.sh 安装'
    await userEvent.click(filterSelect)
    await userEvent.click(screen.getByRole('option', { name: 'skills.sh 安装' }))
    expect(screen.getByRole('button', { name: /CLI Skill/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Local Scan Skill/ })).not.toBeInTheDocument()
  })

  test('renders loading state for skills list when hydrating', () => {
    // 模拟 Tauri 运行时，使得 useEffect 不会同步地将 pending 状态清空
    ;(window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {}

    usePromptWorkbenchStore.setState({
      activeDomain: 'Skills',
      isHydratingEditorStates: true,
      skills: [],
    })

    render(<AiComposeApp />)

    expect(screen.getByText('正在加载技能列表...')).toBeInTheDocument()
    expect(screen.queryByText('未检测到全局安装的技能。可在上方输入仓库名进行安装。')).not.toBeInTheDocument()

    // 恢复 window
    delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__
  })

  test('builtin preset skills stay in list and toggle installed state after setSkillsList', () => {
    // 初始状态，我们只传入非官方物理技能
    const store = usePromptWorkbenchStore.getState()
    
    // 传入空物理技能列表，所有官方技能都应处于未安装状态在列表中
    store.setSkillsList([])
    let currentSkills = usePromptWorkbenchStore.getState().skills
    // 应该包含 find-skills 等内置技能
    const findSkillsUninstalled = currentSkills.find(s => s.id === 'find-skills')
    expect(findSkillsUninstalled).toBeDefined()
    expect(findSkillsUninstalled?.installed).toBe(false)
    expect(findSkillsUninstalled?.isBuiltin).toBe(true)

    // 传入安装了的官方技能
    store.setSkillsList([
      {
        id: 'find-skills',
        name: 'find-skills',
        description: 'preset desc',
        content: 'preset content',
        path: '/mock/path/find-skills',
        sourceKind: 'cli',
      }
    ])
    currentSkills = usePromptWorkbenchStore.getState().skills
    const findSkillsInstalled = currentSkills.find(s => s.id === 'find-skills')
    expect(findSkillsInstalled).toBeDefined()
    expect(findSkillsInstalled?.installed).toBe(true)
    expect(findSkillsInstalled?.isBuiltin).toBe(true)

    // 卸载后传入空（模拟卸载官方技能），卡片应当依然在列表中，但 installed 变为 false
    store.setSkillsList([])
    currentSkills = usePromptWorkbenchStore.getState().skills
    const findSkillsAfterUninstall = currentSkills.find(s => s.id === 'find-skills')
    expect(findSkillsAfterUninstall).toBeDefined()
    expect(findSkillsAfterUninstall?.installed).toBe(false)
    expect(findSkillsAfterUninstall?.isBuiltin).toBe(true)
  })

  test('unlinks the selected cli skill from the current editor without uninstalling it globally', async () => {
    vi.mocked(unlinkSkillFromEditor).mockResolvedValue({
      action: 'removed',
      editorId: 'cursor',
      targetPath: '/Users/test/.cursor/skills',
      updatedAt: '2026-05-21 18:00:00',
    })

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
    expect(loadEditorSkillsStates).not.toHaveBeenCalled()
    expect(unlinkSkillFromEditor).toHaveBeenCalledWith({
      editorId: 'cursor',
      skillId: 'linked-skill',
    })
    expect(usePromptWorkbenchStore.getState().skillsEditorStates.cursor.enabledSkills).toEqual(['keep-skill'])
  })

  test('links an already installed skill to the current editor without calling npx install', async () => {
    vi.mocked(linkSkillToEditor).mockResolvedValue({
      action: 'updated',
      editorId: 'cursor',
      targetPath: '/Users/test/.cursor/skills',
      updatedAt: '2026-05-21 18:10:00',
    })

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
    await userEvent.click(within(dialog).getByRole('button', { name: '安装' }))

    expect(addSkillsRepository).not.toHaveBeenCalled()
    expect(applySkillsToEditorTarget).not.toHaveBeenCalled()
    expect(loadEditorSkillsStates).not.toHaveBeenCalled()
    expect(loadPhysicalSkills).not.toHaveBeenCalled()
    expect(linkSkillToEditor).toHaveBeenCalledWith({
      editorId: 'cursor',
      skillId: 'linked-skill',
      skillPath: '/Users/test/.agents/skills/linked-skill',
    })
    expect(usePromptWorkbenchStore.getState().skillsEditorStates.cursor.enabledSkills).toEqual(['linked-skill'])
  })

  test('installs a missing builtin skill and only links that skill to the current editor', async () => {
    vi.mocked(addSkillsRepository).mockResolvedValue('ok')
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
    vi.mocked(linkSkillToEditor).mockResolvedValue({
      action: 'updated',
      editorId: 'cursor',
      targetPath: '/Users/test/.cursor/skills',
      updatedAt: '2026-05-21 18:12:00',
    })

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
      skills: [
        {
          id: 'find-skills',
          name: 'find-skills',
          description: 'builtin preset',
          content: '# find-skills',
          path: '',
          sourceKind: 'cli',
          isBuiltin: true,
          installed: false,
          repoSource: 'vercel-labs/skills',
        },
      ],
      selectedSkillId: 'find-skills',
      isHydratingEditorStates: false,
    })

    render(<AiComposeApp />)

    await userEvent.click(screen.getByRole('button', { name: /find-skills/ }))
    const dialog = screen.getByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: '安装' }))

    expect(addSkillsRepository).toHaveBeenCalledWith('vercel-labs/skills')
    expect(applySkillsToEditorTarget).not.toHaveBeenCalled()
    expect(loadEditorSkillsStates).not.toHaveBeenCalled()
    expect(linkSkillToEditor).toHaveBeenCalledWith({
      editorId: 'cursor',
      skillId: 'find-skills',
      skillPath: '/Users/test/.agents/skills/find-skills',
    })
    expect(usePromptWorkbenchStore.getState().skillsEditorStates.cursor.enabledSkills).toEqual(['find-skills'])
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
