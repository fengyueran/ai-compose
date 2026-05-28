import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import { App } from './app'
import { disableTauriRuntime, resetAppTestState } from './app-test-support'
import {
  loadPhysicalSkills,
  loadSkillsFromDir,
  selectDirectory,
} from '../shared/api/editor-target-command'
import { useAiComposeStore } from '../shared/model/ai-compose-store'

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

describe('App MCP domain', () => {
  beforeEach(() => {
    resetAppTestState()
    vi.clearAllMocks()
    vi.mocked(loadPhysicalSkills).mockResolvedValue([])
    vi.mocked(loadSkillsFromDir).mockResolvedValue([])
    vi.mocked(selectDirectory).mockResolvedValue('/Users/test/.cursor/skills')
    disableTauriRuntime()
  })

  test('toggles active configuration domain to MCP and displays server list and json preview', async () => {
    render(<App />)

    const mcpDomainBtn = screen.getByRole('button', { name: 'MCP' })
    expect(mcpDomainBtn).toBeInTheDocument()

    await userEvent.click(mcpDomainBtn)

    expect(screen.getByText('官方预设 MCP 服务')).toBeInTheDocument()
    expect(screen.getAllByText('context7').length).toBeGreaterThan(0)
    expect(screen.getAllByText('playwright').length).toBeGreaterThan(0)
    expect(screen.getAllByText('memory').length).toBeGreaterThan(0)
    expect(screen.getByText(/\[mcp_servers\]/)).toBeInTheDocument()
    expect(screen.getByText(/\[mcp_servers\.context7\]/)).toBeInTheDocument()
    expect(screen.getByText(/\[mcp_servers\.playwright\]/)).toBeInTheDocument()
    expect(screen.getByText(/\[mcp_servers\.memory\]/)).toBeInTheDocument()
  })

  test('switches preview output with editor tabs inside the MCP domain', async () => {
    render(<App />)

    await userEvent.click(screen.getByRole('button', { name: 'MCP' }))

    const previewPanel = screen.getByText('最终 MCP 配置预览').closest('section')!
    const previewTabs = within(previewPanel).getByRole('tablist', {
      name: 'MCP 预览编辑器切换',
    })

    const codexTab = within(previewTabs).getByRole('tab', { name: 'Codex' })
    const cursorTab = within(previewTabs).getByRole('tab', { name: 'Cursor' })

    expect(codexTab).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText(/\[mcp_servers\]/)).toBeInTheDocument()

    await userEvent.click(cursorTab)

    expect(cursorTab).toHaveAttribute('aria-selected', 'true')
    expect(codexTab).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByText(/"mcpServers"/)).toBeInTheDocument()
  })

  test('adds a custom MCP server and saves it with correct style variables', async () => {
    render(<App />)

    await userEvent.click(screen.getByRole('button', { name: 'MCP' }))

    const addBtn = screen.getByRole('button', { name: '+ 添加自定义' })
    await userEvent.click(addBtn)

    expect(screen.getByText('添加自定义 MCP')).toBeInTheDocument()

    const addEnvBtn = screen.getByRole('button', { name: '+ 添加环境变量' })
    expect(addEnvBtn).toBeInTheDocument()
    expect(addEnvBtn.style.color).toBe('var(--accent)')
    expect(addEnvBtn.style.border).toContain('var(--accent)')

    const createBtn = screen.getByRole('button', { name: '创建服务' })
    expect(createBtn).toBeInTheDocument()
    expect(createBtn.style.background).toContain('var(--accent)')
  })

  test('adds a custom HTTP/SSE direct MCP server and updates configuration preview', async () => {
    render(<App />)

    await userEvent.click(screen.getByRole('button', { name: 'MCP' }))

    const addBtn = screen.getByRole('button', { name: '+ 添加自定义' })
    await userEvent.click(addBtn)

    const nameInput = screen.getByPlaceholderText('例如: weather')
    await userEvent.type(nameInput, 'figma_local')

    const httpTabBtn = screen.getByRole('button', { name: '直连服务 (HTTP/SSE)' })
    await userEvent.click(httpTabBtn)

    const urlInput = screen.getByPlaceholderText('例如: http://127.0.0.1:3845/mcp')
    await userEvent.type(urlInput, 'http://127.0.0.1:3845/mcp')

    const createBtn = screen.getByRole('button', { name: '创建服务' })
    await userEvent.click(createBtn)

    expect(
      useAiComposeStore.getState().mcpServers.some((server) => server.name === 'figma_local'),
    ).toBe(true)
    expect((await screen.findAllByText('figma_local')).length).toBeGreaterThan(0)
    expect(await screen.findByText(/\[mcp_servers\.figma_local\]/)).toBeInTheDocument()
    expect(screen.getByText(/type = "streamable_http"/)).toBeInTheDocument()
    expect(screen.getByText(/url = "http:\/\/127.0.0.1:3845\/mcp"/)).toBeInTheDocument()
  })
})
