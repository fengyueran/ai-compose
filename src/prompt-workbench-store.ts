import { create } from 'zustand'

import type { EditorId, EditorTargetState } from './editor-target-command'
import {
  type PromptFragment,
  presetPromptFragments,
} from './prompt-fragments'
import {
  type McpServer,
  presetMcpServers,
} from './mcp-servers'

type ApplyStatus = 'idle' | 'pending' | 'success' | 'error'

type EditorState = {
  enabled: boolean
}

type PromptWorkbenchState = {
  activeDomain: 'Prompt' | 'MCP'
  activeEditorId: EditorId
  applyStatus: ApplyStatus
  applyMessage: string
  editorStates: Record<EditorId, EditorState>
  promptEditorStates: Record<EditorId, EditorState>
  mcpEditorStates: Record<EditorId, EditorState>
  isHydratingEditorStates: boolean
  lastAppliedAt: string | null
  presetFragments: PromptFragment[]
  selectedFragmentId: string
  enabledFragmentIds: string[]
  
  // MCP 状态
  mcpServers: McpServer[]
  selectedMcpServerId: string
  
  selectDomain: (domain: 'Prompt' | 'MCP') => void
  hydratePromptEditorStates: (editorStates: Record<EditorId, EditorTargetState>) => void
  hydrateMcpEditorStates: (editorStates: Record<EditorId, EditorTargetState>) => void
  setEditorHydrationPending: (pending: boolean) => void
  selectEditor: (editorId: EditorId) => void
  selectFragment: (fragmentId: string) => void
  setEditorEnabled: (editorId: EditorId, enabled: boolean) => void
  toggleFragment: (fragmentId: string) => void
  setApplyFeedback: (payload: {
    status: ApplyStatus
    message: string
    lastAppliedAt?: string | null
  }) => void
  
  // MCP actions
  selectMcpServer: (serverId: string) => void
  toggleMcpServer: (serverId: string) => void
  addMcpServer: (server: Omit<McpServer, 'id' | 'source'>) => void
  updateMcpServer: (id: string, serverUpdate: Partial<McpServer>) => void
  deleteMcpServer: (id: string) => void
}

const defaultSelectedFragmentId = presetPromptFragments[0]?.id ?? ''
const defaultEnabledFragmentIds = presetPromptFragments.map(
  (fragment) => fragment.id,
)

const defaultSelectedMcpServerId = presetMcpServers[0]?.id ?? ''

const initialEditorStates = {
  antigravity: { enabled: false },
  codex: { enabled: false },
  cursor: { enabled: false },
}

export const usePromptWorkbenchStore = create<PromptWorkbenchState>(
  (set, get) => ({
    activeDomain: 'Prompt',
    activeEditorId: 'codex',
    applyStatus: 'idle',
    applyMessage: '正在从本地编辑器目标文件读取 AI-COMPOSE 受管状态。',
    editorStates: initialEditorStates,
    promptEditorStates: initialEditorStates,
    mcpEditorStates: initialEditorStates,
    isHydratingEditorStates: true,
    lastAppliedAt: null,
    presetFragments: presetPromptFragments,
    selectedFragmentId: defaultSelectedFragmentId,
    enabledFragmentIds: defaultEnabledFragmentIds,
    mcpServers: presetMcpServers,
    selectedMcpServerId: defaultSelectedMcpServerId,
    
    selectDomain: (domain) => {
      const { promptEditorStates, mcpEditorStates } = get()
      set({
        activeDomain: domain,
        editorStates: domain === 'Prompt' ? promptEditorStates : mcpEditorStates,
      })
    },
    
    hydratePromptEditorStates: (editorStates) => {
      const nextPromptStates = {
        antigravity: { enabled: editorStates.antigravity.enabled },
        codex: { enabled: editorStates.codex.enabled },
        cursor: { enabled: editorStates.cursor.enabled },
      }
      set((state) => ({
        promptEditorStates: nextPromptStates,
        editorStates: state.activeDomain === 'Prompt' ? nextPromptStates : state.editorStates,
        isHydratingEditorStates: false,
      }))
    },
    
    hydrateMcpEditorStates: (editorStates) => {
      const nextMcpStates = {
        antigravity: { enabled: editorStates.antigravity.enabled },
        codex: { enabled: editorStates.codex.enabled },
        cursor: { enabled: editorStates.cursor.enabled },
      }
      set((state) => ({
        mcpEditorStates: nextMcpStates,
        editorStates: state.activeDomain === 'MCP' ? nextMcpStates : state.editorStates,
      }))
    },
    
    setEditorHydrationPending: (pending) => {
      set({ isHydratingEditorStates: pending })
    },
    
    selectEditor: (editorId) => {
      set({ activeEditorId: editorId })
    },
    
    selectFragment: (fragmentId) => {
      set({ selectedFragmentId: fragmentId })
    },
    
    setEditorEnabled: (editorId, enabled) => {
      const { activeDomain, promptEditorStates, mcpEditorStates } = get()
      if (activeDomain === 'Prompt') {
        const nextPromptStates = {
          ...promptEditorStates,
          [editorId]: { enabled },
        }
        set({
          promptEditorStates: nextPromptStates,
          editorStates: nextPromptStates,
        })
      } else {
        const nextMcpStates = {
          ...mcpEditorStates,
          [editorId]: { enabled },
        }
        set({
          mcpEditorStates: nextMcpStates,
          editorStates: nextMcpStates,
        })
      }
    },
    
    toggleFragment: (fragmentId) => {
      const enabledFragmentIds = get().enabledFragmentIds
      const isEnabled = enabledFragmentIds.includes(fragmentId)

      if (isEnabled) {
        set({
          enabledFragmentIds: enabledFragmentIds.filter((id) => id !== fragmentId),
        })
        return
      }

      set({
        enabledFragmentIds: [...enabledFragmentIds, fragmentId],
      })
    },
    
    setApplyFeedback: ({ lastAppliedAt, message, status }) => {
      set({ applyMessage: message, applyStatus: status, lastAppliedAt })
    },
    
    // MCP Actions
    selectMcpServer: (serverId) => {
      set({ selectedMcpServerId: serverId })
    },
    
    toggleMcpServer: (serverId) => {
      set((state) => ({
        mcpServers: state.mcpServers.map((server) =>
          server.id === serverId ? { ...server, enabled: !server.enabled } : server
        ),
      }))
    },
    
    addMcpServer: (server) => {
      const newId = server.name.toLowerCase().replace(/\s+/g, '-')
      const newServer: McpServer = {
        ...server,
        id: newId,
        source: 'user',
      }
      set((state) => ({
        mcpServers: [...state.mcpServers, newServer],
        selectedMcpServerId: newId,
      }))
    },
    
    updateMcpServer: (id, serverUpdate) => {
      set((state) => ({
        mcpServers: state.mcpServers.map((server) =>
          server.id === id ? { ...server, ...serverUpdate } : server
        ),
      }))
    },
    
    deleteMcpServer: (id) => {
      const { mcpServers, selectedMcpServerId } = get()
      const nextServers = mcpServers.filter((server) => server.id !== id)
      let nextSelectedId = selectedMcpServerId
      if (selectedMcpServerId === id) {
        nextSelectedId = nextServers[0]?.id ?? ''
      }
      set({
        mcpServers: nextServers,
        selectedMcpServerId: nextSelectedId,
      })
    },
  }),
)
