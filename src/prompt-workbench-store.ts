import { create } from 'zustand'

import type { EditorId, EditorTargetState, SkillInfo, EditorSkillsState, EditorSkillsStates } from './editor-target-command'
import {
  type PromptFragment,
  presetPromptFragments,
} from './prompt-fragments'
import {
  type McpServer,
  presetMcpServers,
} from './mcp-servers'
import { isPresetSkillMatch } from './skills-utils'

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
  activeDomain: 'Prompt' | 'MCP' | 'Skills'
  activeEditorId: EditorId
  applyStatus: ApplyStatus
  applyMessage: string
  editorStates: Record<EditorId, EditorState> | Record<EditorId, EditorTargetState> | Record<EditorId, EditorSkillsState>
  promptEditorStates: Record<EditorId, EditorState>
  mcpEditorStates: Record<EditorId, EditorTargetState>
  skillsEditorStates: Record<EditorId, EditorSkillsState>
  isHydratingEditorStates: boolean
  lastAppliedAt: string | null
  presetFragments: PromptFragment[]
  selectedFragmentId: string
  enabledFragmentIds: string[]
  
  // MCP 状态
  mcpServers: McpServer[]
  selectedMcpServerId: string

  // Skills 状态
  skills: SkillInfo[]
  selectedSkillId: string
  
  selectDomain: (domain: 'Prompt' | 'MCP' | 'Skills') => void
  hydratePromptEditorStates: (editorStates: Record<EditorId, EditorTargetState>) => void
  hydrateMcpEditorStates: (editorStates: Record<EditorId, EditorTargetState>) => void
  hydrateSkillsEditorStates: (editorStates: EditorSkillsStates) => void
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

  // Skills actions
  selectSkill: (skillId: string) => void
  toggleSkill: (skillId: string) => void
  setSkillsList: (skills: SkillInfo[]) => void
  replaceSkill: (skill: SkillInfo) => void
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

const initialSkillsEditorStates = {
  antigravity: { enabled: false, targetPath: '', enabledSkills: [] },
  codex: { enabled: false, targetPath: '', enabledSkills: [] },
  cursor: { enabled: false, targetPath: '', enabledSkills: [] },
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
    skillsEditorStates: initialSkillsEditorStates,
    isHydratingEditorStates: true,
    lastAppliedAt: null,
    presetFragments: presetPromptFragments,
    selectedFragmentId: defaultSelectedFragmentId,
    enabledFragmentIds: defaultEnabledFragmentIds,
    mcpServers: [...presetMcpServers, ...loadCustomServersFromStorage()],
    selectedMcpServerId: defaultSelectedMcpServerId,
    skills: [],
    selectedSkillId: '',
    
    selectDomain: (domain) => {
      const { promptEditorStates, mcpEditorStates, skillsEditorStates, activeEditorId, mcpServers } = get()
      
      let nextMcpServers = mcpServers
      if (domain === 'MCP') {
        const targetState = mcpEditorStates[activeEditorId]
        if (targetState && targetState.targetPath !== '') {
          nextMcpServers = syncMcpServersWithLocal(mcpServers, targetState.mcpServers, targetState.managedMcpServers)
        }
      }

      set({
        activeDomain: domain,
        editorStates: domain === 'Prompt' 
          ? promptEditorStates 
          : domain === 'MCP' 
          ? mcpEditorStates 
          : skillsEditorStates,
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

    hydrateSkillsEditorStates: (editorStates) => {
      const nextSkillsStates = {
        antigravity: { ...editorStates.antigravity },
        codex: { ...editorStates.codex },
        cursor: { ...editorStates.cursor },
      }
      set((state) => ({
        skillsEditorStates: nextSkillsStates,
        editorStates: state.activeDomain === 'Skills' ? nextSkillsStates : state.editorStates,
        isHydratingEditorStates: false,
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
      const { activeDomain, promptEditorStates, mcpEditorStates, skillsEditorStates } = get()
      if (activeDomain === 'Prompt') {
        const nextPromptStates = {
          ...promptEditorStates,
          [editorId]: { enabled },
        }
        set({
          promptEditorStates: nextPromptStates,
          editorStates: nextPromptStates,
        })
      } else if (activeDomain === 'MCP') {
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
      } else {
        const nextSkillsStates = {
          ...skillsEditorStates,
          [editorId]: {
            ...skillsEditorStates[editorId],
            enabled,
          },
        }
        set({
          skillsEditorStates: nextSkillsStates,
          editorStates: nextSkillsStates,
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

    // Skills Actions
    selectSkill: (skillId) => {
      set({ selectedSkillId: skillId })
    },
    
    toggleSkill: (skillId) => {
      const { activeEditorId, skillsEditorStates } = get()
      const currentEditorState = skillsEditorStates[activeEditorId]
      if (!currentEditorState) return

      const isEnabled = currentEditorState.enabledSkills.includes(skillId)
      const nextEnabledSkills = isEnabled
        ? currentEditorState.enabledSkills.filter((id) => id !== skillId)
        : [...currentEditorState.enabledSkills, skillId]

      const nextSkillsStates = {
        ...skillsEditorStates,
        [activeEditorId]: {
          ...currentEditorState,
          enabledSkills: nextEnabledSkills,
        },
      }

      set({
        skillsEditorStates: nextSkillsStates,
        editorStates: nextSkillsStates,
      })
    },

    setSkillsList: (physicalSkills) => {
      const { selectedSkillId } = get()
      
      const mappedPhysical = physicalSkills.map(ps => {
        const preset = BUILTIN_SKILLS_PRESET.find(p => isPresetSkillMatch(ps.id, p.id));
        return {
          ...ps,
          isBuiltin: preset ? true : ps.isBuiltin,
          installed: true,
          repoSource: preset?.repoSource ?? ps.repoSource,
        };
      });

      const missingBuiltinSkills = BUILTIN_SKILLS_PRESET
        .filter((preset) => !mappedPhysical.some((skill) => isPresetSkillMatch(skill.id, preset.id)))
        .map((preset) => ({
          id: preset.id,
          name: preset.name,
          description: preset.description,
          content: preset.content,
          path: "",
          sourceKind: "cli" as const,
          isBuiltin: true,
          installed: false,
          repoSource: preset.repoSource,
        }));

      const nextSkills = [...mappedPhysical, ...missingBuiltinSkills].sort((a, b) => {
        if (Boolean(a.isBuiltin) !== Boolean(b.isBuiltin)) {
          return a.isBuiltin ? -1 : 1;
        }
        return a.id.localeCompare(b.id);
      });

      let nextSelectedId = nextSkills.length > 0 ? selectedSkillId : '';
      if (nextSkills.length > 0 && (!selectedSkillId || !nextSkills.some((s) => s.id === selectedSkillId))) {
        nextSelectedId = nextSkills[0].id;
      }

      set({
        skills: nextSkills,
        selectedSkillId: nextSelectedId,
      });
    },

    replaceSkill: (skill) => {
      const currentSkills = get().skills
      const nextSkills = currentSkills.some((item) => item.id === skill.id)
        ? currentSkills.map((item) => (item.id === skill.id ? skill : item))
        : [...currentSkills, skill]
      get().setSkillsList(nextSkills)
    },
  }),
)

const BUILTIN_SKILLS_PRESET = [
  {
    id: "find-skills",
    name: "find-skills",
    description: "交互式搜索、发现、安装技能组件，管理全局和项目级技能",
    repoSource: "vercel-labs/skills",
    content: "<!--内置技能-->\n\n# find-skills\n\n此技能提供了交互式发现、搜索和安装其他技能的指令，方便在命令行里扩展您的 Agent 动作能力。\n\n### 官方仓库\nhttps://github.com/vercel-labs/skills",
  },
  {
    id: "frontend-design",
    name: "frontend-design",
    description: "指导前端设计实现，使用优质设计系统、TailwindCSS 和组件库，保证卓越视觉和优秀体验",
    repoSource: "anthropics/skills",
    content: "<!--内置技能-->\n\n# frontend-design\n\n专为前端研发设计的指导规范，助力开发者编写出高水准、美观且响应式的网页与组件代码。\n\n### 官方仓库\nhttps://github.com/anthropics/skills",
  },
  {
    id: "brainstorming",
    name: "brainstorming",
    description: "在开始任何功能、组件或行为的开发/修改前，用于理清用户意图和产品设计的头脑风暴指南",
    repoSource: "obra/superpowers",
    content: "<!--内置技能-->\n\n# brainstorming\n\n在做任何创造性工作、设计或写代码前必须运行的头脑风暴指南。可理清意图、规避冗余工作并提供优质的设计想法。\n\n### 官方仓库\nhttps://github.com/obra/superpowers",
  },
  {
    id: "dispatching-parallel-agents",
    name: "dispatching-parallel-agents",
    description: "当遇到两个或更多无顺序依赖、无共享状态的独立任务时，进行并行任务调度的策略",
    repoSource: "obra/superpowers",
    content: "<!--内置技能-->\n\n# dispatching-parallel-agents\n\n用于指导如何将复杂工作拆分为独立任务并并行运行多个 Agent 子任务，以成倍提高交付速度的说明书。\n\n### 官方仓库\nhttps://github.com/obra/superpowers",
  },
  {
    id: "executing-plans",
    name: "executing-plans",
    description: "将已编写的执行计划分阶段实施并进行检查与对齐的执行指引",
    repoSource: "obra/superpowers",
    content: "<!--内置技能-->\n\n# executing-plans\n\n详细规定如何基于已批准的设计和执行计划，安全、稳步地推进编码，并在每个检查点验证产出的规范流程。\n\n### 官方仓库\nhttps://github.com/obra/superpowers",
  },
  {
    id: "finishing-a-development-branch",
    name: "finishing-a-development-branch",
    description: "开发完成且测试通过后，指导如何整合代码、提交 PR 或清理临时环境的完成准则",
    repoSource: "obra/superpowers",
    content: "<!--内置技能-->\n\n# finishing-a-development-branch\n\n当开发完成且所有测试通过后，提供结构化选项（合并、提交PR或清理工作区）来稳妥收尾研发工作分支的指南。\n\n### 官方仓库\nhttps://github.com/obra/superpowers",
  },
  {
    id: "receiving-code-review",
    name: "receiving-code-review",
    description: "接收代码评审意见时的严谨反馈态度指南，强调技术论证和科学验证，拒绝盲从修改",
    repoSource: "obra/superpowers",
    content: "<!--内置技能-->\n\n# receiving-code-review\n\n当收到代码审查意见时，指导如何进行理性技术探讨、确认和方案验证，而不是做做样子、盲从或敷衍地堆砌补丁。\n\n### 官方仓库\nhttps://github.com/obra/superpowers",
  },
  {
    id: "requesting-code-review",
    name: "requesting-code-review",
    description: "在完成任务或主要功能、并准备合并代码前，请求代码评审并验证功能是否完全合规的标准",
    repoSource: "obra/superpowers",
    content: "<!--内置技能-->\n\n# requesting-code-review\n\n在完成任务或主要模块后，如何科学地发起代码评审、梳理变更范围并自证需求满足程度的指导原则。\n\n### 官方仓库\nhttps://github.com/obra/superpowers",
  },
  {
    id: "subagent-driven-development",
    name: "subagent-driven-development",
    description: "在同一个会话窗口中通过调度专职子 Agent 执行子任务的研发指南",
    repoSource: "obra/superpowers",
    content: "<!--内置技能-->\n\n# subagent-driven-development\n\n讲述如何在当前会话中合理拆分职责并启动多个子 Agent 分工协作（如研究、测试、编码），提升工作能效的最佳实践。\n\n### 官方仓库\nhttps://github.com/obra/superpowers",
  },
  {
    id: "systematic-debugging",
    name: "systematic-debugging",
    description: "在定位任何 bug、测试失败或意外表现时必须严格执行的系统性排查与调试逻辑",
    repoSource: "obra/superpowers",
    content: "<!--内置技能-->\n\n# systematic-debugging\n\n当遇到测试失败或程序报错时，如何严密设立假设、寻找证据链以彻底修复问题，而不是依靠直觉胡乱试错的操作指南。\n\n### 官方仓库\nhttps://github.com/obra/superpowers",
  },
  {
    id: "test-driven-development",
    name: "test-driven-development",
    description: "遵循先写失败测试、再写最小实现、最后整理重构 (Red-Green-Refactor) 的开发工作流",
    repoSource: "obra/superpowers",
    content: "<!--内置技能-->\n\n# test-driven-development\n\n实现任何新特性或修复缺陷时必须遵循的测试驱动开发指南，坚持先写测试再写实现，确保代码底线质量。\n\n### 官方仓库\nhttps://github.com/obra/superpowers",
  },
  {
    id: "using-git-worktrees",
    name: "using-git-worktrees",
    description: "指导如何利用 Git Worktree 隔离开发环境与主工作区，提高分支切换的效率和安全",
    repoSource: "obra/superpowers",
    content: "<!--内置技能-->\n\n# using-git-worktrees\n\n教您使用 Git Worktree 来维持干净隔离的会话工作流，以便在处理复杂任务时随时切换或多任务并行的实操指引。\n\n### 官方仓库\nhttps://github.com/obra/superpowers",
  },
  {
    id: "using-superpowers",
    name: "using-superpowers",
    description: "每次开始对话时的第一步，用以确立如何寻找和正确使用已有技能的方法论",
    repoSource: "obra/superpowers",
    content: "<!--内置技能-->\n\n# using-superpowers\n\n在回答任何用户提问前，明确如何检索已有技能、合理调用专门动作而避免平铺直叙回答的核心守则。\n\n### 官方仓库\nhttps://github.com/obra/superpowers",
  },
  {
    id: "verification-before-completion",
    name: "verification-before-completion",
    description: "完成任务声称通过前必须履行的验证核对，坚持数据和输出结果高于口头断言",
    repoSource: "obra/superpowers",
    content: "<!--内置技能-->\n\n# verification-before-completion\n\n在声称完成功能或问题修复前，如何进行自动化测试、界面检查或端到端验证以展示确凿证据的工作守则。\n\n### 官方仓库\nhttps://github.com/obra/superpowers",
  },
  {
    id: "writing-plans",
    name: "writing-plans",
    description: "在有需求、 spec 或多步变更任务时，必须先编写并确认实现方案的计划准则",
    repoSource: "obra/superpowers",
    content: "<!--内置技能-->\n\n# writing-plans\n\n教您在做大规模、重构或复杂特性修改前，如何产出严谨可复审的方案设计与里程碑拆分，避免走弯路。\n\n### 官方仓库\nhttps://github.com/obra/superpowers",
  },
  {
    id: "writing-skills",
    name: "writing-skills",
    description: "用于规范和指导在编写、测试并发布新技能或修改现有技能时的质量和结构要求",
    repoSource: "obra/superpowers",
    content: "<!--内置技能-->\n\n# writing-skills\n\n关于如何合理定义一个技能、撰写标准的 `SKILL.md`，并在部署至真实 Agent 前执行调试和验证的参考书。\n\n### 官方仓库\nhttps://github.com/obra/superpowers",
  },
  {
    id: "skill-creator",
    name: "skill-creator",
    description: "协助用户创建规范的 SKILL.md，编写和自动验证新技能的构建逻辑",
    repoSource: "anthropics/skills",
    content: "<!--内置技能-->\n\n# skill-creator\n\n用于加速自定义技能编写、符合平台与 Agent 解析规范、指导快速起步新技能定义的脚手架工具。\n\n### 官方仓库\nhttps://github.com/anthropics/skills",
  },
  {
    id: "ui-ux-pro-max",
    name: "ui-ux-pro-max",
    description: "UI/UX 高级设计指南，教您编写顶级视觉美学与动效的现代前端页面",
    repoSource: "nextlevelbuilder/ui-ux-pro-max-skill",
    content: "<!--内置技能-->\n\n# ui-ux-pro-max\n\n专为打造高视觉冲击力（WOW体验）、优秀人机交互和微动画设计的前端美学技能方案。\n\n### 官方仓库\nhttps://github.com/nextlevelbuilder/ui-ux-pro-max-skill",
  }
]
