import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import PromptWorkbenchApp from './prompt-workbench-app'

describe('Prompt Workbench', () => {
  test('renders the codex prompt workbench skeleton', () => {
    render(<PromptWorkbenchApp />)

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
    render(<PromptWorkbenchApp />)

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
    render(<PromptWorkbenchApp />)

    // 默认是 Prompt 域激活，MCP 配置域应该可被点击
    const mcpDomainBtn = screen.getByRole('button', { name: 'MCP' })
    expect(mcpDomainBtn).toBeInTheDocument()

    // 切换到 MCP 配置域
    await userEvent.click(mcpDomainBtn)

    // 应切换为 active，且中间区域应当显示 MCP 相关的标题
    expect(screen.getByText('官方预设 MCP 服务')).toBeInTheDocument()

    // 预设列表中应展示 context7, playwright 等
    expect(screen.getAllByText('context7').length).toBeGreaterThan(0)
    expect(screen.getAllByText('playwright').length).toBeGreaterThan(0)

    // 默认右侧预览区应该展示 MCP TOML 格式（因为默认编辑器是 codex）
    expect(screen.getByText(/\[mcp_servers\]/)).toBeInTheDocument()
    expect(screen.getByText(/\[mcp_servers\.context7\]/)).toBeInTheDocument()
    expect(screen.getByText(/\[mcp_servers\.playwright\]/)).toBeInTheDocument()
  })
})

