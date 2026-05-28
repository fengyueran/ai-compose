import { useAiComposeStore } from '../shared/model/ai-compose-store'

export function resetAppTestState() {
  useAiComposeStore.setState(useAiComposeStore.getInitialState())
}

export function enableTauriRuntime() {
  ;(window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {}
}

export function disableTauriRuntime() {
  if (typeof window !== 'undefined') {
    delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__
  }
}
