import { create } from 'zustand'

import type { EditorId, EditorTargetState } from './editor-target-command'
import {
  type PromptFragment,
  presetPromptFragments,
} from './prompt-fragments'

type ApplyStatus = 'idle' | 'pending' | 'success' | 'error'

type EditorState = {
  enabled: boolean
}

type PromptWorkbenchState = {
  activeEditorId: EditorId
  applyStatus: ApplyStatus
  applyMessage: string
  editorStates: Record<EditorId, EditorState>
  isHydratingEditorStates: boolean
  lastAppliedAt: string | null
  presetFragments: PromptFragment[]
  selectedFragmentId: string
  enabledFragmentIds: string[]
  hydrateEditorStates: (editorStates: Record<EditorId, EditorTargetState>) => void
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
}

const defaultSelectedFragmentId = presetPromptFragments[0]?.id ?? ''
const defaultEnabledFragmentIds = presetPromptFragments.map(
  (fragment) => fragment.id,
)

export const usePromptWorkbenchStore = create<PromptWorkbenchState>(
  (set, get) => ({
    activeEditorId: 'codex',
    applyStatus: 'idle',
    applyMessage: '正在从本地编辑器目标文件读取 AI-COMPOSE 受管状态。',
    editorStates: {
      antigravity: {
        enabled: false,
      },
      codex: {
        enabled: false,
      },
      cursor: {
        enabled: false,
      },
    },
    isHydratingEditorStates: true,
    lastAppliedAt: null,
    presetFragments: presetPromptFragments,
    selectedFragmentId: defaultSelectedFragmentId,
    enabledFragmentIds: defaultEnabledFragmentIds,
    hydrateEditorStates: (editorStates) => {
      set({
        editorStates: {
          antigravity: {
            enabled: editorStates.antigravity.enabled,
          },
          codex: {
            enabled: editorStates.codex.enabled,
          },
          cursor: {
            enabled: editorStates.cursor.enabled,
          },
        },
        isHydratingEditorStates: false,
      })
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
      set({
        editorStates: {
          ...get().editorStates,
          [editorId]: {
            enabled,
          },
        },
      })
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
  }),
)
