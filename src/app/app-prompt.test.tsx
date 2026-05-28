import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import { App } from './app'
import { disableTauriRuntime, resetAppTestState } from './app-test-support'
import {
  loadPhysicalSkills,
  loadSkillsFromDir,
  selectDirectory,
} from '../shared/api/editor-target-command'

vi.mock('../shared/api/editor-target-command', async () => {
  const actual = await vi.importActual<typeof import('../shared/api/editor-target-command')>(
    '../shared/api/editor-target-command',
  )

  return {
    ...actual,
    loadPhysicalSkills: vi.fn(),
    loadSkillsFromDir: vi.fn(),
    selectDirectory: vi.fn(),
  }
})

describe('App prompt domain', () => {
  beforeEach(() => {
    resetAppTestState()
    vi.clearAllMocks()
    vi.mocked(loadPhysicalSkills).mockResolvedValue([])
    vi.mocked(loadSkillsFromDir).mockResolvedValue([])
    vi.mocked(selectDirectory).mockResolvedValue('/Users/test/.cursor/skills')
    disableTauriRuntime()
  })

  test('renders the codex prompt workbench skeleton', () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: 'AI Compose' })).toBeInTheDocument()
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

    const actionBtn = screen.getByRole('button', { name: '从最终 Prompt 移除' })
    expect(actionBtn).toBeInTheDocument()
    expect(actionBtn.className).toContain('fragment-action-btn--active')

    await userEvent.click(actionBtn)

    expect(screen.getByRole('button', { name: '加入最终 Prompt' })).toBeInTheDocument()
    expect(actionBtn.className).not.toContain('fragment-action-btn--active')

    await userEvent.click(actionBtn)
    expect(screen.getByRole('button', { name: '从最终 Prompt 移除' })).toBeInTheDocument()
    expect(actionBtn.className).toContain('fragment-action-btn--active')
  })
})
