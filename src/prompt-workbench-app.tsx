import { useMemo } from 'react'

import {
  applyPromptToUserCodex,
  isTauriRuntime,
} from './codex-agent-command'
import {
  composeManagedPromptBlock,
} from './compose-prompt'
import './prompt-workbench-app.css'
import { usePromptWorkbenchStore } from './prompt-workbench-store'

const configurationDomains = [
  { name: 'Prompt', isAvailable: true },
  { name: 'MCP', isAvailable: false },
  { name: 'Skills', isAvailable: false },
  { name: 'Profiles', isAvailable: false },
] as const

function PromptWorkbenchApp() {
  const {
    applyMessage,
    applyStatus,
    enabledFragmentIds,
    lastAppliedAt,
    presetFragments,
    selectedFragmentId,
    selectFragment,
    setApplyFeedback,
    toggleFragment,
  } = usePromptWorkbenchStore()

  const selectedFragment =
    presetFragments.find((fragment) => fragment.id === selectedFragmentId) ??
    presetFragments[0]

  const enabledFragments = useMemo(
    () =>
      presetFragments.filter((fragment) =>
        enabledFragmentIds.includes(fragment.id),
      ),
    [enabledFragmentIds, presetFragments],
  )

  const applyStatusText = {
    idle: '未执行',
    pending: '应用中',
    success: '已写入',
    error: '应用失败',
  } satisfies Record<typeof applyStatus, string>

  const handleApply = async () => {
    if (enabledFragments.length === 0) {
      setApplyFeedback({
        status: 'error',
        message: '请至少启用一个片段后再执行应用。',
        lastAppliedAt: null,
      })
      return
    }

    if (!isTauriRuntime()) {
      setApplyFeedback({
        status: 'error',
        message:
          '当前不在 Tauri 桌面宿主中运行。请使用 `pnpm dev:desktop` 启动后再执行应用。',
        lastAppliedAt: null,
      })
      return
    }

    setApplyFeedback({
      status: 'pending',
      message: '正在整理最终 Prompt，并通过桌面宿主写入用户级 Codex AGENTS.md。',
      lastAppliedAt: null,
    })

    try {
      const generatedAt = new Intl.DateTimeFormat('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }).format(new Date())
      const managedBlock = composeManagedPromptBlock(
        enabledFragments,
        generatedAt,
      )
      const result = await applyPromptToUserCodex({
        managedBlock,
      })

      const lastAppliedTime = new Intl.DateTimeFormat('zh-CN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }).format(new Date())

      setApplyFeedback({
        status: 'success',
        message: `已成功写入 ${result.targetPath}，当前共更新 ${enabledFragments.length} 个片段的受管区块。`,
        lastAppliedAt: lastAppliedTime,
      })
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : '写入用户级 Codex 配置时发生未知错误。'

      setApplyFeedback({
        status: 'error',
        message,
        lastAppliedAt: null,
      })
    }
  }

  return (
    <div className="app-shell">
      <div className="app-frame">
        <header className="global-bar">
          <div className="global-bar__brand">
            <span className="eyebrow">Codex Prompt Workbench</span>
            <h1 className="global-bar__title">Prompt Workbench</h1>
            <p className="global-bar__subtitle">
              用工作台方式组合、预览并应用用户级 Codex 提示词。
            </p>
          </div>

          <div className="global-bar__status" aria-label="当前上下文">
            <span className="chip chip--accent">
              <span className="chip__label">目标编辑器</span>
              Codex
            </span>
            <span className="chip">
              <span className="chip__label">配置域</span>
              Prompt
            </span>
            <span className="chip">
              <span className="chip__label">应用状态</span>
              {applyStatusText[applyStatus]}
            </span>
          </div>
        </header>

        <div className="workspace-grid">
          <aside className="panel side-nav" aria-label="工作台导航">
            <section className="side-nav__section">
              <h2 className="side-nav__label">编辑器</h2>
              <div className="side-nav__items">
                <button
                  className="side-nav__item side-nav__item--active"
                  type="button"
                >
                  <span>Codex</span>
                </button>
              </div>
            </section>

            <section className="side-nav__section">
              <h2 className="side-nav__label">配置域</h2>
              <div className="side-nav__items">
                {configurationDomains.map((domain) => (
                  <button
                    key={domain.name}
                    className={`side-nav__item${
                      domain.isAvailable ? ' side-nav__item--active' : ' side-nav__item--disabled'
                    }`}
                    disabled={!domain.isAvailable}
                    type="button"
                  >
                    <span>{domain.name}</span>
                    {!domain.isAvailable ? (
                      <span className="disabled-tag">即将支持</span>
                    ) : null}
                  </button>
                ))}
              </div>
            </section>
          </aside>

          <main className="workbench">
            <section className="panel fragment-list" aria-labelledby="fragment-list-title">
              <div className="panel__header">
                <div>
                  <h2 className="panel__title" id="fragment-list-title">
                    官方预设片段
                  </h2>
                  <p className="panel__subtitle">
                    当前首版粒度为分类即片段，共 7 个官方预设项。
                  </p>
                </div>
                <span className="chip">{enabledFragments.length} 项已启用</span>
              </div>

              <div className="fragment-list__items">
                {presetFragments.map((fragment) => {
                  const isSelected = fragment.id === selectedFragmentId
                  const isEnabled = enabledFragmentIds.includes(fragment.id)

                  return (
                    <button
                      key={fragment.id}
                      className={`fragment-list__item${
                        isSelected ? ' fragment-list__item--selected' : ''
                      }`}
                      onClick={() => selectFragment(fragment.id)}
                      type="button"
                    >
                      <div className="fragment-list__item-main">
                        <span className="fragment-list__item-title">
                          {fragment.title}
                        </span>
                        <div className="fragment-list__item-meta-row">
                          <span className="fragment-list__item-meta">
                            {fragment.source === 'preset'
                              ? '官方预设'
                              : '用户片段'}
                          </span>
                          <span className="fragment-list__item-meta-separator">
                            ·
                          </span>
                          <span className="fragment-list__item-meta">
                            {fragment.items.length} 条
                          </span>
                        </div>
                      </div>

                      <span className="fragment-list__toggle">
                        <span
                          aria-hidden="true"
                          className={`fragment-list__toggle-dot${
                            isEnabled
                              ? ' fragment-list__toggle-dot--enabled'
                              : ''
                          }`}
                        />
                        {isEnabled ? '已启用' : '未启用'}
                      </span>
                    </button>
                  )
                })}
              </div>
            </section>

            <section className="panel fragment-detail" aria-labelledby="fragment-detail-title">
              <div className="panel__header">
                <div>
                  <h2 className="panel__title" id="fragment-detail-title">
                    {selectedFragment?.title}
                  </h2>
                  <p className="panel__subtitle">
                    当前仅提供官方预设查看与启用切换，后续继续接入用户片段编辑。
                  </p>
                </div>
                <button
                  className="chip"
                  onClick={() => toggleFragment(selectedFragment.id)}
                  type="button"
                >
                  {enabledFragmentIds.includes(selectedFragment.id)
                    ? '从最终 Prompt 移除'
                    : '加入最终 Prompt'}
                </button>
              </div>

              <div className="fragment-detail__body">
                <ul className="fragment-detail__list">
                  {selectedFragment?.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </section>
          </main>

          <aside className="preview-column">
            <section className="panel preview-card" aria-labelledby="preview-title">
              <div className="panel__header">
                <div>
                  <h2 className="panel__title" id="preview-title">
                    最终 Prompt 预览
                  </h2>
                  <p className="panel__subtitle">
                    右侧始终展示当前启用片段的最终组合结果。
                  </p>
                </div>
              </div>

              <div className="preview-card__body">
                {enabledFragments.length === 0 ? (
                  <p className="preview-card__empty">
                    还没有启用任何片段。请先从中间工作区选择要纳入
                    Prompt 的内容。
                  </p>
                ) : (
                  enabledFragments.map((fragment) => (
                    <section
                      key={fragment.id}
                      className="preview-card__section"
                    >
                      <h3 className="preview-card__section-title">
                        {fragment.title}
                      </h3>
                      <ul className="preview-card__list">
                        {fragment.items.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </section>
                  ))
                )}
              </div>
            </section>

            <section className="panel apply-card" aria-labelledby="apply-title">
              <div className="panel__header">
                <div>
                  <h2 className="panel__title" id="apply-title">
                    应用到用户级 Codex
                  </h2>
                  <p className="panel__subtitle">
                    通过桌面宿主将当前最终 Prompt 写入用户级 Codex 配置。
                  </p>
                </div>
              </div>

              <div className="apply-card__body">
                <div className="apply-card__status">
                  <div className="apply-card__row">
                    <span>目标编辑器</span>
                    <strong>Codex</strong>
                  </div>
                  <div className="apply-card__row">
                    <span>配置域</span>
                    <strong>Prompt</strong>
                  </div>
                  <div className="apply-card__row">
                    <span>状态</span>
                    <strong>{applyStatusText[applyStatus]}</strong>
                  </div>
                  <div className="apply-card__row">
                    <span>目标文件</span>
                    <strong>~/.codex/AGENTS.md</strong>
                  </div>
                  <div className="apply-card__row">
                    <span>最近触发</span>
                    <strong>{lastAppliedAt ?? '尚未触发'}</strong>
                  </div>
                </div>

                <button
                  className="apply-button"
                  disabled={applyStatus === 'pending'}
                  onClick={() => {
                    void handleApply()
                  }}
                  type="button"
                >
                  {applyStatus === 'pending'
                    ? '应用中...'
                    : '应用到用户级 Codex'}
                </button>

                <div
                  className={`apply-card__feedback apply-card__feedback--${applyStatus}`}
                  role="status"
                >
                  {applyMessage}
                </div>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  )
}

export default PromptWorkbenchApp
