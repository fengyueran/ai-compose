import { create } from 'zustand'

import type { EditorId } from './editor-target-command'
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
  lastAppliedAt: string | null
  presetFragments: PromptFragment[]
  selectedFragmentId: string
  enabledFragmentIds: string[]
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
    applyMessage: '请通过桌面端运行当前工作台，以启用真实的编辑器配置写入能力。',
    editorStates: {
      antigravity: {
        enabled: false,
      },
      codex: {
        enabled: true,
      },
      cursor: {
        enabled: false,
      },
    },
    lastAppliedAt: null,
    presetFragments: presetPromptFragments,
    selectedFragmentId: defaultSelectedFragmentId,
    enabledFragmentIds: defaultEnabledFragmentIds,
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
