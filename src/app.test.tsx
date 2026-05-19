import { render, screen } from '@testing-library/react'

import PromptWorkbenchApp from './prompt-workbench-app'

describe('Prompt Workbench', () => {
  test('renders the codex prompt workbench skeleton', () => {
    render(<PromptWorkbenchApp />)

    expect(
      screen.getByRole('heading', { name: 'Prompt Workbench' }),
    ).toBeInTheDocument()
    expect(screen.getAllByText('Codex').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Prompt').length).toBeGreaterThan(0)
    expect(screen.getAllByText('核心原则').length).toBeGreaterThan(0)
    expect(screen.getAllByText('计划与执行').length).toBeGreaterThan(0)
    expect(screen.getAllByText('测试与验证').length).toBeGreaterThan(0)
    expect(screen.getAllByText('安全约束').length).toBeGreaterThan(0)
    expect(screen.getAllByText('代码审查').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Git 工作流').length).toBeGreaterThan(0)
    expect(screen.getAllByText('输出与协作风格').length).toBeGreaterThan(0)
    expect(screen.getByText('最终 Prompt 预览')).toBeInTheDocument()
    expect(screen.getAllByText('应用到用户级 Codex').length).toBeGreaterThan(0)
  })
})
