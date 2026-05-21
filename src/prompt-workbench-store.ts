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

interface LocalMcpConfig {
  command?: string
  args?: string[]
  env?: Record<string, string>
  type?: string
  url?: string
}

// 从 localStorage 加载自定义服务
const loadCustomServersFromStorage = (): McpServer[] => {
  try {
    const data = typeof window !== 'undefined' ? localStorage.getItem('ai-compose:custom-mcp-servers') : null
    const list: McpServer[] = data ? JSON.parse(data) : []
    // 过滤掉非 custom- 开头的历史同步脏数据，并查重官方预设服务
    return list.filter(
      (item) =>
        item.id.startsWith('custom-') &&
        !presetMcpServers.some(
          (p) => p.name.toLowerCase() === item.name.toLowerCase()
        )
    )
  } catch (e) {
    console.error('Failed to load custom MCP servers from storage', e)
    return []
  }
}

// 保存自定义服务到 localStorage
const saveCustomServersToStorage = (servers: McpServer[]) => {
  try {
    if (typeof window !== 'undefined') {
      const customServers = servers.filter(s => s.source === 'user')
      localStorage.setItem('ai-compose:custom-mcp-servers', JSON.stringify(customServers))
    }
  } catch (e) {
    console.error('Failed to save custom MCP servers to storage', e)
  }
}

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
  localMcp: Record<string, unknown> | undefined,
  managedMcp: Record<string, unknown> | undefined
): McpServer[] => {
  const safeLocalMcp = localMcp || {}

  // 1. 用本地配置更新已有的服务启用状态和配置内容
  const nextServers: McpServer[] = []
  mcpServers.forEach((server) => {
    const localVal = safeLocalMcp[server.name]
    // 必须要含有 command 字段或 url 字段才认为是真正有效启用的服务
    if (localVal && typeof localVal === 'object' && ('command' in localVal || 'url' in localVal)) {
      let source = server.source
      if (source !== 'preset') {
        source = server.id.startsWith('custom-') ? 'user' : 'external'
      }

      const transportType = 'url' in localVal ? 'http' : 'stdio'
      const configVal = localVal as LocalMcpConfig

      nextServers.push({
        ...server,
        enabled: true,
        transportType,
        command: configVal.command ?? server.command,
        args: configVal.args ?? server.args,
        env: configVal.env ?? server.env,
        type: configVal.type ?? server.type,
        url: configVal.url ?? server.url,
        source,
      })
    } else {
      // 外部服务只要本地配置文件中不存在，即直接丢弃（不显示在列表中）
      if (server.source === 'external') {
        return
      }
      // 预设服务或自定义服务（user）即使本地不存在（即从物理文件中移出了），依然在工作台列表中保留草稿
      // 如果该服务在受管 MCP 中不存在（说明从未被应用配置过），则保留其在定义文件中的默认启用状态，否则设为 false
      const isPresetUnmanaged = server.source === 'preset' && !(managedMcp && server.name in managedMcp)
      nextServers.push({
        ...server,
        enabled: isPresetUnmanaged ? !!server.enabled : false,
      })
    }
  })

  // 2. 将本地存在但工作台列表中没有的自定义服务动态拉取进来
  Object.entries(safeLocalMcp).forEach(([name, val]) => {
    if (!val || typeof val !== 'object' || Array.isArray(val)) {
      return
    }
    if (!('command' in val) && !('url' in val)) {
      return
    }

    const exists = nextServers.some((s) => s.name === name)
    if (!exists) {
      const newId = name.toLowerCase().replace(/\s+/g, '-')
      const source = 'external'
      const transportType = 'url' in val ? 'http' : 'stdio'
      const configVal = val as LocalMcpConfig

      nextServers.push({
        id: newId,
        name,
        transportType,
        command: configVal.command,
        args: configVal.args,
        env: configVal.env,
        type: configVal.type,
        url: configVal.url,
        enabled: true,
        source,
        description: source === 'external' 
          ? '检测到本地配置文件中手动写入的外部服务 (只读)' 
          : '从本地编辑器配置文件中加载的自定义服务',
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
    mcpServers: [...presetMcpServers, ...loadCustomServersFromStorage()],
    selectedMcpServerId: defaultSelectedMcpServerId,
    
    selectDomain: (domain) => {
      const { promptEditorStates, mcpEditorStates, activeEditorId, mcpServers } = get()
      
      let nextMcpServers = mcpServers
      if (domain === 'MCP') {
        const targetState = mcpEditorStates[activeEditorId]
        if (targetState && targetState.targetPath !== '') {
          nextMcpServers = syncMcpServersWithLocal(mcpServers, targetState.mcpServers, targetState.managedMcpServers)
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

      // 根据受管边界内是否有启用的有效配置，重新判定大开关的开启状态
      const checkEditorEnabled = (targetState: typeof editorStates.codex) => {
        const managedMcp = targetState.managedMcpServers
        if (!managedMcp) return false
        return Object.values(managedMcp).some((val) => {
          return val && typeof val === 'object' && ('command' in val || 'url' in val)
        })
      }

      Object.keys(nextMcpStates).forEach((key) => {
        const k = key as EditorId
        nextMcpStates[k].enabled = checkEditorEnabled(nextMcpStates[k])
      })
      
      const targetState = nextMcpStates[activeEditorId]
      let updatedServers = mcpServers
      if (targetState && targetState.targetPath !== '') {
        updatedServers = syncMcpServersWithLocal(mcpServers, targetState.mcpServers, targetState.managedMcpServers)
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
          nextMcpServers = syncMcpServersWithLocal(mcpServers, targetState.mcpServers, targetState.managedMcpServers)
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
      set((state) => {
        const nextServers = state.mcpServers.map((server) =>
          server.id === serverId ? { ...server, enabled: !server.enabled } : server
        )
        saveCustomServersToStorage(nextServers)
        return { mcpServers: nextServers }
      })
    },
    
    addMcpServer: (server) => {
      const newId = server.name.toLowerCase().replace(/\s+/g, '-')
      const newServer: McpServer = {
        ...server,
        id: newId,
        source: 'user',
      }
      set((state) => {
        const nextServers = [...state.mcpServers, newServer]
        saveCustomServersToStorage(nextServers)
        return {
          mcpServers: nextServers,
          selectedMcpServerId: newId,
        }
      })
    },
    
    updateMcpServer: (id, serverUpdate) => {
      set((state) => {
        const nextServers = state.mcpServers.map((server) =>
          server.id === id ? { ...server, ...serverUpdate } : server
        )
        saveCustomServersToStorage(nextServers)
        return { mcpServers: nextServers }
      })
    },
    
    deleteMcpServer: (id) => {
      const { mcpServers, selectedMcpServerId } = get()
      const nextServers = mcpServers.filter((server) => server.id !== id)
      let nextSelectedId = selectedMcpServerId
      if (selectedMcpServerId === id) {
        nextSelectedId = nextServers[0]?.id ?? ''
      }
      saveCustomServersToStorage(nextServers)
      set({
        mcpServers: nextServers,
        selectedMcpServerId: nextSelectedId,
      })
    },
  }),
)
