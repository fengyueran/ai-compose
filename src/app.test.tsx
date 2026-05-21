import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import AiComposeApp from './ai-compose-app'

describe('Prompt Workbench', () => {
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
})


