import { create } from 'zustand'

import {
  type PromptFragment,
  presetPromptFragments,
} from './prompt-fragments'

type ApplyStatus = 'idle' | 'pending' | 'success' | 'error'

type PromptWorkbenchState = {
  applyStatus: ApplyStatus
  applyMessage: string
  lastAppliedAt: string | null
  presetFragments: PromptFragment[]
  selectedFragmentId: string
  enabledFragmentIds: string[]
  selectFragment: (fragmentId: string) => void
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
    applyStatus: 'idle',
    applyMessage: '请通过桌面端运行当前工作台，以启用真实的用户级 Codex 写入能力。',
    lastAppliedAt: null,
    presetFragments: presetPromptFragments,
    selectedFragmentId: defaultSelectedFragmentId,
    enabledFragmentIds: defaultEnabledFragmentIds,
    selectFragment: (fragmentId) => {
      set({ selectedFragmentId: fragmentId })
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
