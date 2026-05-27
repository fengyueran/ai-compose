import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'

import { App } from './app'
import { addSkillsRepository, applySkillsToEditorTarget, linkSkillToEditor, loadEditorInstalledSkills, loadEditorMcpStates, loadEditorSkillsStates, loadEditorTargetStates, loadSingleSkill, openExternalUrl, openLocalPath, revealLocalPath, removeSkill, unlinkSkillFromEditor, updateSkill, loadPhysicalSkills, loadSkillsFromDir, selectDirectory } from '../shared/api/editor-target-command'
import { useAiComposeStore } from '../shared/model/ai-compose-store'

vi.mock('../shared/api/editor-target-command', async () => {
  const actual = await vi.importActual<typeof import('../shared/api/editor-target-command')>('../shared/api/editor-target-command')
  return {
    ...actual,
    addSkillsRepository: vi.fn(),
    applySkillsToEditorTarget: vi.fn(),
    loadEditorInstalledSkills: vi.fn(),
    loadPhysicalSkills: vi.fn(),
    loadSkillsFromDir: vi.fn(),
    loadEditorMcpStates: vi.fn(),
    loadEditorSkillsStates: vi.fn(),
    loadEditorTargetStates: vi.fn(),
    loadSingleSkill: vi.fn(),
    openExternalUrl: vi.fn(),
    openLocalPath: vi.fn(),
    revealLocalPath: vi.fn(),
    linkSkillToEditor: vi.fn(),
    removeSkill: vi.fn(),
    unlinkSkillFromEditor: vi.fn(),
    updateSkill: vi.fn(),
    selectDirectory: vi.fn(),
  }
})

describe('Prompt Workbench', () => {
  beforeEach(() => {
    useAiComposeStore.setState(useAiComposeStore.getInitialState())
    vi.clearAllMocks()
    vi.mocked(loadPhysicalSkills).mockResolvedValue([])
    vi.mocked(loadSkillsFromDir).mockResolvedValue([])
    vi.mocked(selectDirectory).mockResolvedValue('/Users/test/.cursor/skills')
    if (typeof window !== 'undefined') {
      delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__
    }
  })

  test('renders the codex prompt workbench skeleton', () => {
    render(<App />)

    expect(
      screen.getByRole('heading', { name: 'AI Compose' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Codex/ })).toBeInTheDocument()
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
    render(<App />)

    // The fragment is enabled by default, so the button should show "Remove from final prompt".
    const actionBtn = screen.getByRole('button', { name: '从最终 Prompt 移除' })
    expect(actionBtn).toBeInTheDocument()
    expect(actionBtn.className).toContain('fragment-action-btn--active')

    // Click the button to remove it.
    await userEvent.click(actionBtn)

    // The label should change to "Add to final prompt" and the active class should be removed.
    expect(screen.getByRole('button', { name: '加入最终 Prompt' })).toBeInTheDocument()
    expect(actionBtn.className).not.toContain('fragment-action-btn--active')

    // Click again to add it back.
    await userEvent.click(actionBtn)
    expect(screen.getByRole('button', { name: '从最终 Prompt 移除' })).toBeInTheDocument()
    expect(actionBtn.className).toContain('fragment-action-btn--active')
  })

  test('toggles active configuration domain to MCP and displays server list and json preview', async () => {
    render(<App />)

    // Prompt is active by default, and the MCP tab should be clickable.
    const mcpDomainBtn = screen.getByRole('button', { name: 'MCP' })
    expect(mcpDomainBtn).toBeInTheDocument()

    // Switch to the MCP configuration domain.
    await userEvent.click(mcpDomainBtn)

    // The MCP tab should become active and show MCP-related content in the center pane.
    expect(screen.getByText('官方预设 MCP 服务')).toBeInTheDocument()

    // The preset list should show servers such as context7, playwright, and memory.
    expect(screen.getAllByText('context7').length).toBeGreaterThan(0)
    expect(screen.getAllByText('playwright').length).toBeGreaterThan(0)
    expect(screen.getAllByText('memory').length).toBeGreaterThan(0)

    // The preview should default to TOML because Codex is the default editor.
    expect(screen.getByText(/\[mcp_servers\]/)).toBeInTheDocument()
    expect(screen.getByText(/\[mcp_servers\.context7\]/)).toBeInTheDocument()
    expect(screen.getByText(/\[mcp_servers\.playwright\]/)).toBeInTheDocument()
    expect(screen.getByText(/\[mcp_servers\.memory\]/)).toBeInTheDocument()
  })

  test('switches MCP preview format when selecting another editor inside the domain', async () => {
    render(<App />)

    await userEvent.click(screen.getByRole('button', { name: 'MCP' }))

    // Find the Cursor toggle inside the final configuration preview panel.
    const previewPanel = screen.getByText('最终 MCP 配置预览').closest('section')!
    await userEvent.click(within(previewPanel).getByRole('button', { name: /Cursor/ }))

    expect(screen.getByText(/最终 MCP 配置/)).toBeInTheDocument()
    expect(screen.getByText(/"mcpServers"/)).toBeInTheDocument()
  })

  test('adds a custom MCP server and saves it with correct style variables', async () => {
    render(<App />)

    // Switch to the MCP configuration domain.
    await userEvent.click(screen.getByRole('button', { name: 'MCP' }))

    // Click the "+ Add custom" button.
    const addBtn = screen.getByRole('button', { name: '+ 添加自定义' })
    await userEvent.click(addBtn)

    // The form should now show the "Add custom MCP" title.
    expect(screen.getByText('添加自定义 MCP')).toBeInTheDocument()

    // Verify the "+ Add environment variable" button uses the expected style variables instead of `--accent-color`.
    const addEnvBtn = screen.getByRole('button', { name: '+ 添加环境变量' })
    expect(addEnvBtn).toBeInTheDocument()
    expect(addEnvBtn.style.color).toBe('var(--accent)')
    expect(addEnvBtn.style.border).toContain('var(--accent)')

    // Verify the "Create service" button uses the expected style variables.
    const createBtn = screen.getByRole('button', { name: '创建服务' })
    expect(createBtn).toBeInTheDocument()
    expect(createBtn.style.background).toContain('var(--accent)')
  })

  test('adds a custom HTTP/SSE direct MCP server and updates configuration preview', async () => {
    render(<App />)

    // Switch to the MCP configuration domain.
    await userEvent.click(screen.getByRole('button', { name: 'MCP' }))

    // Click the "+ Add custom" button.
    const addBtn = screen.getByRole('button', { name: '+ 添加自定义' })
    await userEvent.click(addBtn)

    // Enter the service name.
    const nameInput = screen.getByPlaceholderText('例如: weather')
    await userEvent.type(nameInput, 'figma_local')

    // Switch the transport type to "Direct service (HTTP/SSE)".
    const httpTabBtn = screen.getByRole('button', { name: '直连服务 (HTTP/SSE)' })
    await userEvent.click(httpTabBtn)

    // Enter the URL.
    const urlInput = screen.getByPlaceholderText('例如: http://127.0.0.1:3845/mcp')
    await userEvent.type(urlInput, 'http://127.0.0.1:3845/mcp')

    // Create the service.
    const createBtn = screen.getByRole('button', { name: '创建服务' })
    await userEvent.click(createBtn)

    expect(useAiComposeStore.getState().mcpServers.some((server) => server.name === 'figma_local')).toBe(true)

    // Confirm figma_local appears in the left-side list.
    expect((await screen.findAllByText('figma_local')).length).toBeGreaterThan(0)

    // The default TOML preview should include both type and url definitions.
    expect(await screen.findByText(/\[mcp_servers\.figma_local\]/)).toBeInTheDocument()
    expect(screen.getByText(/type = "streamable_http"/)).toBeInTheDocument()
    expect(screen.getByText(/url = "http:\/\/127.0.0.1:3845\/mcp"/)).toBeInTheDocument()
  })

  test('shows current editor installed skills and keeps fallback skills read-only', async () => {
    useAiComposeStore.setState({
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
      skillSources: [
        { id: 'preset', type: 'preset', name: '官方预设', value: '' },
        { id: 'local:dir', type: 'local', name: '本地源', value: '/Users/test/.cursor/skills' }
      ],
      selectedSkillSourceId: 'local:dir',
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
      selectedSkillId: 'local-scan-skill',
      isHydratingEditorStates: false,
    })

    render(<App />)

    expect(screen.getByText(/已安装\/已链接 2 项技能/)).toBeInTheDocument()
    expect(screen.getByText(/Scanned from an editor target directory/)).toBeInTheDocument()

    // Click on the Local Scan Skill row to open the details modal
    const localSkillRow = screen.getByRole('button', { name: /Local Scan Skill/ })
    await userEvent.click(localSkillRow)

    const dialog = screen.getAllByRole('dialog').find(el => el.textContent?.includes('技能详情'))!
    const unlinkBtn = within(dialog).getByRole('button', { name: '取消链接' })
    expect(unlinkBtn).toBeInTheDocument()
    expect(unlinkBtn).toBeDisabled() // fallback skills are read-only
  })

  test('renders skills sources list and filters skills by selected source', async () => {
    useAiComposeStore.setState({
      activeDomain: 'Skills',
      activeEditorId: 'cursor',
      editorStates: {
        antigravity: { enabled: false, targetPath: '', enabledSkills: [] },
        codex: { enabled: false, targetPath: '', enabledSkills: [] },
        cursor: { enabled: true, targetPath: '/Users/test/.cursor/skills', enabledSkills: ['brainstorming'] },
      },
      skillsEditorStates: {
        antigravity: { enabled: false, targetPath: '', enabledSkills: [] },
        codex: { enabled: false, targetPath: '', enabledSkills: [] },
        cursor: { enabled: true, targetPath: '/Users/test/.cursor/skills', enabledSkills: ['brainstorming'] },
      },
      skillSources: [
        { id: 'preset', type: 'preset', name: '官方预设', value: '' },
        { id: 'local:dir', type: 'local', name: '本地源', value: '/Users/test/.cursor/skills' }
      ],
      selectedSkillSourceId: 'preset',
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

    render(<App />)

    // Left pane should list the sources
    expect(screen.getAllByText('官方预设').length).toBeGreaterThan(0)
    expect(screen.getByText('本地源')).toBeInTheDocument()

    // "Official preset" is selected, so brainstorming is shown while local-scan-skill is hidden.
    expect(screen.getByText('brainstorming')).toBeInTheDocument()
    expect(screen.queryByText('Local Scan Skill')).not.toBeInTheDocument()

    // Click "Local source".
    await userEvent.click(screen.getByText('本地源'))
    expect(useAiComposeStore.getState().selectedSkillSourceId).toBe('local:dir')
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
    useAiComposeStore.setState({
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
      skillSources: [
        { id: 'preset', type: 'preset', name: '官方预设', value: '' },
        { id: 'repo:fengyueran/skills', type: 'repo', name: 'fengyueran/skills', value: 'fengyueran/skills' }
      ],
      selectedSkillSourceId: 'repo:fengyueran/skills',
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

    render(<App />)

    await userEvent.click(screen.getByRole('button', { name: /react-development/ }))

    const dialog = screen.getAllByRole('dialog').find(el => el.textContent?.includes('技能详情'))!
    const repoLink = within(dialog).getByRole('link', { name: 'fengyueran/skills' })
    expect(repoLink).toHaveAttribute('href', 'https://github.com/fengyueran/skills')
    expect(repoLink).toHaveAttribute('target', '_blank')

    await userEvent.click(repoLink)
    expect(openExternalUrl).toHaveBeenCalledWith('https://github.com/fengyueran/skills')

    delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__
  })

  test('renders third-party badge for skills installed from custom repositories', () => {
    useAiComposeStore.setState({
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
      skillSources: [
        { id: 'preset', type: 'preset', name: '官方预设', value: '' },
        { id: 'repo:fengyueran/skills', type: 'repo', name: 'fengyueran/skills', value: 'fengyueran/skills' }
      ],
      selectedSkillSourceId: 'repo:fengyueran/skills',
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

    render(<App />)

    const skillRow = screen.getByRole('button', { name: /react-development/ })
    expect(within(skillRow).getByText('第三方')).toBeInTheDocument()
    expect(within(skillRow).queryByText('fengyueran/skills')).not.toBeInTheDocument()
  })

  test('shows synced repository skills even before they are linked to the current editor', () => {
    useAiComposeStore.setState({
      activeDomain: 'Skills',
      activeEditorId: 'antigravity',
      editorStates: {
        antigravity: { enabled: false, targetPath: '~/.gemini/antigravity/skills', enabledSkills: [] },
        codex: { enabled: false, targetPath: '', enabledSkills: [] },
        cursor: { enabled: false, targetPath: '', enabledSkills: [] },
      },
      skillsEditorStates: {
        antigravity: { enabled: false, targetPath: '/Users/test/.gemini/antigravity/skills', enabledSkills: [] },
        codex: { enabled: false, targetPath: '', enabledSkills: [] },
        cursor: { enabled: false, targetPath: '', enabledSkills: [] },
      },
      skillSources: [
        { id: 'preset', type: 'preset', name: '官方预设', value: '' },
        { id: 'repo:fengyueran/skills', type: 'repo', name: 'fengyueran/skills', value: 'fengyueran/skills' }
      ],
      selectedSkillSourceId: 'repo:fengyueran/skills',
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

    render(<App />)

    expect(screen.getByRole('button', { name: /react-development/ })).toBeInTheDocument()
    expect(screen.getByText(/共 1 项/)).toBeInTheDocument()
    expect(screen.getByText(/未链接 1/)).toBeInTheDocument()
  })

  test('renders physical source path and target link path as clickable local paths in skill details', async () => {
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
    useAiComposeStore.setState({
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
      skillSources: [
        { id: 'preset', type: 'preset', name: '官方预设', value: '' },
        { id: 'repo:fengyueran/skills', type: 'repo', name: 'fengyueran/skills', value: 'fengyueran/skills' }
      ],
      selectedSkillSourceId: 'repo:fengyueran/skills',
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

    render(<App />)

    await userEvent.click(screen.getByRole('button', { name: /react-development/ }))

    const dialogElement = screen.getAllByRole('dialog').find(el => el.textContent?.includes('技能详情'))!
    const dialog = within(dialogElement)
    const physicalPathButton = dialog.getByRole('button', { name: '/Users/test/.agents/skills/react-development' })
    const targetPathButton = dialog.getByRole('button', { name: '/Users/test/.cursor/skills/react-development' })

    await userEvent.click(physicalPathButton)
    await userEvent.click(targetPathButton)

    expect(openLocalPath).toHaveBeenCalledWith('/Users/test/.agents/skills/react-development')
    expect(revealLocalPath).toHaveBeenCalledWith('/Users/test/.cursor/skills/react-development')

    delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__
  })

  test('renders loading state for skills list when hydrating', () => {
    ;(window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {}
    const pendingPromise = new Promise<never>(() => {})
    vi.mocked(loadEditorTargetStates).mockReturnValue(pendingPromise as never)
    vi.mocked(loadEditorMcpStates).mockReturnValue(pendingPromise as never)
    vi.mocked(loadEditorSkillsStates).mockReturnValue(pendingPromise as never)
    vi.mocked(loadEditorInstalledSkills).mockReturnValue(pendingPromise as never)

    useAiComposeStore.setState({
      activeDomain: 'Skills',
      isHydratingEditorStates: true,
      skills: [],
    })

    render(<App />)

    expect(screen.getByText('正在加载技能列表...')).toBeInTheDocument()

    delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__
  })

  test('setSkillsList preserves the builtin catalog and marks matching official skills as installed', () => {
    const store = useAiComposeStore.getState()

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
    let currentSkills = useAiComposeStore.getState().skills
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
    currentSkills = useAiComposeStore.getState().skills
    expect(currentSkills.some((skill) => skill.id === 'ui-ux-pro-max')).toBe(true)
    expect(currentSkills.every((skill) => skill.isBuiltin)).toBe(true)
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
      cursor: { enabled: true, targetPath: '/Users/test/.cursor/skills', enabledSkills: ['keep-skill'] },
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
        cursor: { enabled: true, targetPath: '/Users/test/.cursor/skills', enabledSkills: ['linked-skill', 'keep-skill'] },
      },
      skillsEditorStates: {
        antigravity: { enabled: false, targetPath: '', enabledSkills: [] },
        codex: { enabled: false, targetPath: '', enabledSkills: [] },
        cursor: { enabled: true, targetPath: '/Users/test/.cursor/skills', enabledSkills: ['linked-skill', 'keep-skill'] },
      },
      skillSources: [
        { id: 'preset', type: 'preset', name: '官方预设', value: '' },
        { id: 'repo:cli', type: 'repo', name: 'CLI Source', value: 'cli-repo' }
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
    const dialog = screen.getAllByRole('dialog').find(el => el.textContent?.includes('技能详情'))!
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
    expect(useAiComposeStore.getState().skills.find((skill) => skill.id === 'linked-skill')).toBeDefined() // unlinked skill is NOT removed from available skills
  })

  test('shows only skills linked to the current editor even when other third-party skills exist globally', async () => {
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
        cursor: { enabled: true, targetPath: '/Users/test/.cursor/skills', enabledSkills: ['linked-skill'] },
      },
      skillsEditorStates: {
        antigravity: { enabled: false, targetPath: '', enabledSkills: [] },
        codex: { enabled: false, targetPath: '', enabledSkills: [] },
        cursor: { enabled: true, targetPath: '/Users/test/.cursor/skills', enabledSkills: ['linked-skill'] },
      },
      skillSources: [
        { id: 'preset', type: 'preset', name: '官方预设', value: '' },
        { id: 'repo:cli', type: 'repo', name: 'CLI Source', value: 'cli-repo' }
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

    // Click "+ Add source".
    await userEvent.click(screen.getByRole('button', { name: '+ 添加源' }))
    const dialog = screen.getAllByRole('dialog').find(el => el.textContent?.includes('添加技能源'))!
    
    // Fill the add source form
    await userEvent.type(within(dialog).getByPlaceholderText('例如：开发规范、Vercel 技能集'), 'Vercel 技能集')
    await userEvent.type(within(dialog).getByPlaceholderText('例如：vercel-labs/skills'), 'vercel-labs/skills')
    await userEvent.click(within(dialog).getByRole('button', { name: '确定' }))

    expect(addSkillsRepository).toHaveBeenCalledWith('vercel-labs/skills')
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
        cursor: { enabled: false, targetPath: '/Users/test/.cursor/skills', enabledSkills: ['linked-skill'] },
      },
      skillsEditorStates: {
        antigravity: { enabled: false, targetPath: '', enabledSkills: [] },
        codex: { enabled: false, targetPath: '', enabledSkills: [] },
        cursor: { enabled: false, targetPath: '/Users/test/.cursor/skills', enabledSkills: ['linked-skill'] },
      },
      skillSources: [
        { id: 'preset', type: 'preset', name: '官方预设', value: '' },
        { id: 'repo:cli', type: 'repo', name: 'CLI Source', value: 'cli-repo' }
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
    const dialog = screen.getAllByRole('dialog').find(el => el.textContent?.includes('技能详情'))!
    await userEvent.click(within(dialog).getByRole('button', { name: '更新' }))

    expect(updateSkill).toHaveBeenCalledWith('linked-skill')
    expect(loadSingleSkill).toHaveBeenCalledWith({
      id: 'linked-skill',
      path: '/Users/test/.agents/skills/linked-skill',
      sourceKind: 'cli',
    })
    expect(useAiComposeStore.getState().skills.find((skill) => skill.id === 'linked-skill')?.description).toBe('Updated description')
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

    // Click "+ Add source".
    await userEvent.click(screen.getByRole('button', { name: '+ 添加源' }))
    const dialog = screen.getAllByRole('dialog').find(el => el.textContent?.includes('添加技能源'))!

    // Click the "Local directory" tab button.
    await userEvent.click(within(dialog).getByRole('button', { name: '本地物理目录' }))

    // Now the dialog should render the folder selection button
    const selectFolderBtn = within(dialog).getByRole('button', { name: '选择文件夹' })
    expect(selectFolderBtn).toBeInTheDocument()

    // Click the mocked "Choose folder" button.
    await userEvent.click(selectFolderBtn)
    expect(selectDirectory).toHaveBeenCalled()

    // The input should now contain the selected directory path from the mock.
    const inputElement = within(dialog).getByPlaceholderText('例如：/Users/username/my-skills')
    expect(inputElement).toHaveValue('/Users/test/.cursor/skills')

    // Enter the source name.
    await userEvent.type(within(dialog).getByPlaceholderText('例如：开发规范、Vercel 技能集'), '测试本地源')
    
    // Click confirm
    await userEvent.click(within(dialog).getByRole('button', { name: '确定' }))

    // Verify it adds a new skill source to store
    const skillSources = useAiComposeStore.getState().skillSources
    const addedSource = skillSources.find(s => s.name === '测试本地源')
    expect(addedSource).toBeDefined()
    expect(addedSource?.type).toBe('local')
    expect(addedSource?.value).toBe('/Users/test/.cursor/skills')
  })
})
