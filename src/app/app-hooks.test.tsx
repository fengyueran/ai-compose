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

describe('App hooks domain', () => {
  beforeEach(() => {
    resetAppTestState()
    vi.clearAllMocks()
    vi.mocked(loadPhysicalSkills).mockResolvedValue([])
    vi.mocked(loadSkillsFromDir).mockResolvedValue([])
    vi.mocked(selectDirectory).mockResolvedValue('/Users/test/.cursor/skills')
    disableTauriRuntime()
  })

  test('switches to Hooks domain and shows the raw hooks editor', async () => {
    render(<App />)

    await userEvent.click(screen.getByRole('button', { name: 'Hooks' }))

    expect(screen.getByText('共享 Hooks')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '+ 添加 Hook' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: '+ 添加 Hook' }))

    expect(screen.getByText('添加自定义 Hook')).toBeInTheDocument()

    const nameInput = screen.getByPlaceholderText('例如: prettier')
    await userEvent.type(nameInput, '新 Hook 1')

    const cmdInput = screen.getByPlaceholderText('例如：git diff --name-only | xargs prettier --write')
    await userEvent.type(cmdInput, 'prettier --write')

    await userEvent.click(screen.getByRole('button', { name: '创建 Hook' }))

    expect(await screen.findByRole('button', { name: 'Codex 已启用' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cursor 未启用' })).toBeInTheDocument()
  })
})
