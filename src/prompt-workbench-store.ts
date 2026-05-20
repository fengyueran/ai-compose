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
  mcpEditorStates: Record<EditorId, EditorTargetState>
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

const initialMcpEditorStates = {
  antigravity: { enabled: false, targetPath: '' },
  codex: { enabled: false, targetPath: '' },
  cursor: { enabled: false, targetPath: '' },
}

const syncMcpServersWithLocal = (
  mcpServers: McpServer[],
  localMcp: Record<string, any> | undefined
): McpServer[] => {
  if (!localMcp) {
    return mcpServers
  }

  // 1. 用本地配置更新已有的服务启用状态和配置内容
  let nextServers = mcpServers.map((server) => {
    const localVal = localMcp[server.name]
    // 必须要含有 command 字段才认为是真正有效启用的服务
    if (localVal && typeof localVal === 'object' && 'command' in localVal) {
      return {
        ...server,
        enabled: true,
        command: localVal.command ?? server.command,
        args: localVal.args ?? server.args,
        env: localVal.env ?? server.env,
      }
    } else {
      // ！！！关键：如果本地没有，不要把 server.enabled 强行重置为 false！！！
      // 保持它在工作台原本的启用状态不变，以体现用户在界面上的操作意图。
      return server
    }
  })

  // 2. 将本地存在但工作台列表中没有的自定义服务动态拉取进来
  Object.entries(localMcp).forEach(([name, val]) => {
    if (!val || typeof val !== 'object' || Array.isArray(val)) {
      return
    }
    if (!('command' in val)) {
      return
    }

    const exists = nextServers.some((s) => s.name === name)
    if (!exists) {
      const newId = name.toLowerCase().replace(/\s+/g, '-')
      nextServers.push({
        id: newId,
        name,
        command: (val as any).command ?? '',
        args: (val as any).args ?? [],
        env: (val as any).env,
        enabled: true,
        source: 'user',
        description: '从本地编辑器配置文件中加载的自定义服务',
      })
    }
  })

  return nextServers
}

export const usePromptWorkbenchStore = create<PromptWorkbenchState>(
  (set, get) => ({
    activeDomain: 'Prompt',
    activeEditorId: 'codex',
    applyStatus: 'idle',
    applyMessage: '正在从本地编辑器目标文件读取 AI-COMPOSE 受管状态。',
    editorStates: initialEditorStates,
    promptEditorStates: initialEditorStates,
    mcpEditorStates: initialMcpEditorStates,
    isHydratingEditorStates: true,
    lastAppliedAt: null,
    presetFragments: presetPromptFragments,
    selectedFragmentId: defaultSelectedFragmentId,
    enabledFragmentIds: defaultEnabledFragmentIds,
    mcpServers: presetMcpServers,
    selectedMcpServerId: defaultSelectedMcpServerId,
    
    selectDomain: (domain) => {
      const { promptEditorStates, mcpEditorStates, activeEditorId, mcpServers } = get()
      
      let nextMcpServers = mcpServers
      if (domain === 'MCP') {
        const targetState = mcpEditorStates[activeEditorId]
        if (targetState && targetState.targetPath !== '') {
          nextMcpServers = syncMcpServersWithLocal(mcpServers, targetState.mcpServers)
        }
      }

      set({
        activeDomain: domain,
        editorStates: domain === 'Prompt' ? promptEditorStates : mcpEditorStates,
        mcpServers: nextMcpServers,
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
      const { activeEditorId, mcpServers } = get()
      const nextMcpStates = {
        antigravity: { ...editorStates.antigravity },
        codex: { ...editorStates.codex },
        cursor: { ...editorStates.cursor },
      }

      // 根据是否有本地启用且被当前工作台管理（在 mcpServers 中）的有效配置，重新判定大开关的开启状态
      const managedNames = mcpServers.map((s) => s.name)
      const checkEditorEnabled = (targetState: typeof editorStates.codex) => {
        const localMcp = targetState.mcpServers
        if (!localMcp) return false
        return Object.entries(localMcp).some(([name, val]) => {
          if (!managedNames.includes(name)) return false
          return val && typeof val === 'object' && 'command' in val
        })
      }

      Object.keys(nextMcpStates).forEach((key) => {
        const k = key as EditorId
        nextMcpStates[k].enabled = checkEditorEnabled(nextMcpStates[k])
      })
      
      const targetState = nextMcpStates[activeEditorId]
      let updatedServers = mcpServers
      if (targetState && targetState.targetPath !== '') {
        updatedServers = syncMcpServersWithLocal(mcpServers, targetState.mcpServers)
      }

      set((state) => ({
        mcpEditorStates: nextMcpStates,
        editorStates: state.activeDomain === 'MCP' ? nextMcpStates : state.editorStates,
        mcpServers: updatedServers,
      }))
    },
    
    setEditorHydrationPending: (pending) => {
      set({ isHydratingEditorStates: pending })
    },
    
    selectEditor: (editorId) => {
      const { activeDomain, mcpEditorStates, mcpServers } = get()
      
      let nextMcpServers = mcpServers
      if (activeDomain === 'MCP') {
        const targetState = mcpEditorStates[editorId]
        if (targetState && targetState.targetPath !== '') {
          nextMcpServers = syncMcpServersWithLocal(mcpServers, targetState.mcpServers)
        }
      }

      set({
        activeEditorId: editorId,
        mcpServers: nextMcpServers,
      })
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
          [editorId]: {
            ...mcpEditorStates[editorId],
            enabled,
          },
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
