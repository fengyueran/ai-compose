import { useMemo, useState, type ChangeEvent } from 'react';

import { Message, Tooltip } from '@xinghunm/compass-ui';
import {
  applyHooksToEditorTarget,
  loadEditorHooksStates,
  EditorToggleIcon,
  isTauriRuntime,
  type EditorId,
  type HookMode,
  useAiComposeStore,
  type HookTrigger,
  type HookCommand,
} from '../../../shared';
import {
  buildAntigravityHooksPreview,
  buildCodexHooksPreview,
  buildCursorHooksPreview,
  formatCurrentFilePlaceholder,
  beautifyPreviewJson,
} from '../lib/build-hooks-preview';
import { HooksPanelRoot } from './hooks-panel.styles';

const editorMeta: Record<EditorId, { title: string }> = {
  antigravity: { title: 'Antigravity' },
  codex: { title: 'Codex' },
  cursor: { title: 'Cursor' },
};

const triggerOptions = [
  { value: 'before-run', label: '执行前' },
  { value: 'after-run', label: '执行后' },
  { value: 'after-failure', label: '失败后' },
  { value: 'before-commit', label: '提交前' },
] as const;

const editorIds = Object.keys(editorMeta) as EditorId[];

interface HooksPanelProps {
  messageApi: ReturnType<typeof Message.useMessage>[0];
}

type HookFormState = {
  sourceId: string;
  name: string;
  trigger: HookTrigger;
  mode: HookMode;
  formatCommand: string;
  commands: HookCommand[];
};

function createHookFormState(
  selectedHookId: string,
  selectedHook: {
    name?: string;
    trigger?: HookTrigger;
    mode?: HookMode;
    formatCommand?: string;
    commands?: HookCommand[];
  } | null,
): HookFormState {
  if (selectedHook && selectedHookId !== '__new__') {
    const mode = selectedHook.mode || 'raw';
    return {
      sourceId: selectedHookId,
      name: selectedHook.name || '',
      trigger: mode === 'format-template' ? 'before-commit' : (selectedHook.trigger || 'after-run'),
      mode,
      formatCommand: selectedHook.formatCommand || '',
      commands: selectedHook.commands || [],
    };
  }

  return {
    sourceId: selectedHookId,
    name: '',
    trigger: 'after-run',
    mode: 'raw',
    formatCommand: '',
    commands: [{ id: 'new-hook-command-1', command: '' }],
  };
}

export function HooksPanel({ messageApi }: HooksPanelProps) {
  const {
    hooksState,
    addHook,
    selectHook,
    updateHook,
    deleteHook,
    toggleHookEditor,
    hydrateHooksEditorStates,
    activeEditorId,
  } = useAiComposeStore();

  const [previewEditorId, setPreviewEditorId] =
    useState<EditorId>(activeEditorId);
  const [showRawPreview, setShowRawPreview] = useState<boolean>(false);

  const selectedHook =
    hooksState.hooks.find((hook) => hook.id === hooksState.selectedHookId) ??
    null;

  const [draftFormState, setDraftFormState] = useState<HookFormState>(() =>
    createHookFormState(hooksState.selectedHookId, selectedHook),
  );
  const formState =
    draftFormState.sourceId === hooksState.selectedHookId
      ? draftFormState
      : createHookFormState(hooksState.selectedHookId, selectedHook);
  const formName = formState.name;
  const formTrigger = formState.trigger;
  const formMode = formState.mode;
  const formFormatCommand = formState.formatCommand;
  const formCommands = formState.commands;

  const previewHooksState = useMemo(() => {
    if (hooksState.selectedHookId === '__new__') {
      return hooksState.hooks;
    }

    return hooksState.hooks.map((hook) =>
      hook.id === hooksState.selectedHookId
        ? {
            ...hook,
            name: formName,
            trigger:
              formMode === 'format-template' ? 'before-commit' : formTrigger,
            mode: formMode,
            formatCommand:
              formMode === 'format-template' ? formFormatCommand : undefined,
            commands: formMode === 'raw' ? formCommands : [],
          }
        : hook,
    );
  }, [
    formCommands,
    formFormatCommand,
    formMode,
    formName,
    formTrigger,
    hooksState.hooks,
    hooksState.selectedHookId,
  ]);

  const previewHooks = useMemo(
    () =>
      previewHooksState.filter((hook) => hook.enabledEditors[previewEditorId]),
    [previewEditorId, previewHooksState],
  );

  const generatedPreviewJson = useMemo(() => {
    let rawJson = '';
    if (previewEditorId === 'codex') {
      rawJson = buildCodexHooksPreview(previewHooks);
    } else if (previewEditorId === 'cursor') {
      rawJson = buildCursorHooksPreview(previewHooks);
    } else {
      rawJson = buildAntigravityHooksPreview(previewHooks);
    }

    return showRawPreview ? rawJson : beautifyPreviewJson(rawJson);
  }, [previewEditorId, previewHooks, showRawPreview]);

  const [pendingHookToggleKey, setPendingHookToggleKey] = useState<
    string | null
  >(null);

  const handleHookEditorToggle = async (editorId: EditorId, hookId: string) => {
    toggleHookEditor(hookId, editorId);

    if (!isTauriRuntime()) {
      return;
    }

    const toggleKey = `${editorId}:${hookId}`;
    setPendingHookToggleKey(toggleKey);

    const latestHooks = useAiComposeStore.getState().hooksState.hooks;

    try {
      await applyHooksToEditorTarget({
        hooks: latestHooks,
      });
      const nextHooksStates = await loadEditorHooksStates();
      hydrateHooksEditorStates(nextHooksStates);
      messageApi.success(`${editorMeta[editorId].title} 的 Hooks 配置已更新。`);
    } catch (error) {
      toggleHookEditor(hookId, editorId);
      const errMsg = error instanceof Error ? error.message : String(error);
      messageApi.error(
        `更新 ${editorMeta[editorId].title} 的 Hooks 配置失败: ${errMsg}`,
      );
    } finally {
      setPendingHookToggleKey(null);
    }
  };

  const handleSaveHook = async () => {
    if (!formName.trim()) {
      messageApi.error('名称不能为空');
      return;
    }

    const trimmedFormatCommand = formFormatCommand.trim();
    const filteredCommands =
      formMode === 'raw'
        ? formCommands
            .map((cmd) => ({ ...cmd, command: cmd.command.trim() }))
            .filter((cmd) => cmd.command !== '')
        : [];

    if (formMode === 'raw' && filteredCommands.length === 0) {
      messageApi.error('请至少添加一条非空命令');
      return;
    }

    if (formMode === 'format-template' && !trimmedFormatCommand) {
      messageApi.error('请填写格式化命令');
      return;
    }

    const existsName = hooksState.hooks.some(
      (h) =>
        h.name.toLowerCase() === formName.trim().toLowerCase() &&
        (hooksState.selectedHookId === '__new__' || h.id !== selectedHook?.id),
    );
    if (existsName) {
      messageApi.error(
        `已存在名为 "${formName.trim()}" 的 Hook，请使用其他名称`,
      );
      return;
    }

    if (hooksState.selectedHookId === '__new__') {
      const newHookPayload = {
        name: formName.trim(),
        trigger: formMode === 'format-template' ? 'before-commit' : formTrigger,
        mode: formMode,
        formatCommand:
          formMode === 'format-template' ? trimmedFormatCommand : undefined,
        commands: filteredCommands,
        enabledEditors: {
          antigravity: activeEditorId === 'antigravity',
          codex: activeEditorId === 'codex',
          cursor: activeEditorId === 'cursor',
        },
      };

      addHook(newHookPayload);

      if (isTauriRuntime()) {
        const latestStore = useAiComposeStore.getState();
        messageApi.loading({
          content: `正在同步到编辑器...`,
          key: 'save-hook',
        });

        try {
          await applyHooksToEditorTarget({
            hooks: latestStore.hooksState.hooks,
          });
          const nextHooksStates = await loadEditorHooksStates();
          hydrateHooksEditorStates(nextHooksStates);
          messageApi.success({
            content: `添加 Hook 并同步编辑器配置成功。`,
            key: 'save-hook',
          });
        } catch (error) {
          const errMsg = error instanceof Error ? error.message : String(error);
          messageApi.error({
            content: `物理同步失败: ${errMsg}`,
            key: 'save-hook',
          });
        }
      } else {
        messageApi.success('添加 Hook 成功。');
      }
    } else {
      if (!selectedHook) return;

      updateHook(selectedHook.id, {
        name: formName.trim(),
        trigger: formMode === 'format-template' ? 'before-commit' : formTrigger,
        mode: formMode,
        formatCommand:
          formMode === 'format-template' ? trimmedFormatCommand : undefined,
        commands: filteredCommands,
      });

      if (isTauriRuntime()) {
        const latestStore = useAiComposeStore.getState();
        messageApi.loading({
          content: `正在同步至编辑器配置文件...`,
          key: 'save-hook',
        });

        try {
          await applyHooksToEditorTarget({
            hooks: latestStore.hooksState.hooks,
          });
          const nextHooksStates = await loadEditorHooksStates();
          hydrateHooksEditorStates(nextHooksStates);
          messageApi.success({
            content: `修改 Hook 成功，并已同步物理文件。`,
            key: 'save-hook',
          });
        } catch (error) {
          const errMsg = error instanceof Error ? error.message : String(error);
          messageApi.error({
            content: `修改成功，但物理同步失败: ${errMsg}`,
            key: 'save-hook',
          });
        }
      } else {
        messageApi.success('修改 Hook 成功。');
      }
    }
  };

  const handleDeleteHook = async (id: string) => {
    deleteHook(id);

    if (!isTauriRuntime()) {
      messageApi.success('删除 Hook 成功。');
      return;
    }

    messageApi.loading({
      content: '正在同步删除至编辑器配置...',
      key: 'delete-hook',
    });
    try {
      const latestStore = useAiComposeStore.getState();
      await applyHooksToEditorTarget({
        hooks: latestStore.hooksState.hooks,
      });
      const nextHooksStates = await loadEditorHooksStates();
      hydrateHooksEditorStates(nextHooksStates);
      messageApi.success({
        content: '删除 Hook 成功并已自动同步物理文件！',
        key: 'delete-hook',
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      messageApi.error({
        content: `删除成功，但物理同步失败: ${errMsg}`,
        key: 'delete-hook',
      });
    }
  };

  // 本地命令编辑辅助方法
  const handleCommandChange = (id: string, value: string) => {
    setDraftFormState({
      ...formState,
      commands: formCommands.map((cmd) =>
        cmd.id === id ? { ...cmd, command: value } : cmd,
      ),
    });
  };

  const handleAddCommand = () => {
    setDraftFormState({
      ...formState,
      commands: [
        ...formCommands,
        {
          id: `new-command-${Date.now()}-${formCommands.length + 1}`,
          command: '',
        },
      ],
    });
  };

  const handleRemoveCommand = (id: string) => {
    setDraftFormState({
      ...formState,
      commands: formCommands.filter((cmd) => cmd.id !== id),
    });
  };

  return (
    <HooksPanelRoot>
      <main className="workbench">
        <section
          aria-labelledby="hooks-list-title"
          className="panel fragment-list"
        >
          <div className="panel__header">
            <div>
              <h2 className="panel__title" id="hooks-list-title">
                共享 Hooks
              </h2>
              <p className="panel__subtitle">
                一份共享 hooks，多条规则逐步控制在不同编辑器中的启用状态。
              </p>
            </div>
            <button
              type="button"
              className="fragment-action-btn"
              style={{ minHeight: '32px', padding: '0 10px', fontSize: '12px' }}
              onClick={() => selectHook('__new__')}
            >
              + 添加 Hook
            </button>
          </div>

          <div className="fragment-list__items">
            {hooksState.hooks.length === 0 ? (
              <p className="hooks-empty">
                还没有 hook。先新增一条规则，再为不同编辑器开启它。
              </p>
            ) : (
              hooksState.hooks.map((hook) => {
                const isSelected = hook.id === hooksState.selectedHookId;
                const enabledCount = Object.values(hook.enabledEditors).filter(
                  Boolean,
                ).length;

                return (
                  <div
                    key={hook.id}
                    className={`fragment-list__item${
                      isSelected ? ' fragment-list__item--selected' : ''
                    }`}
                  >
                    <button
                      className="fragment-list__item-select"
                      onClick={() => selectHook(hook.id)}
                      type="button"
                    >
                      <div className="fragment-list__item-main">
                        <div
                          className="fragment-list__item-title-row"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            marginBottom: '4px',
                          }}
                        >
                          <span
                            className="fragment-list__item-title"
                            style={{ margin: 0 }}
                          >
                            {hook.name}
                          </span>
                          <span className="mcp-source-badge mcp-source-badge--preset">
                            {hook.mode === 'format-template'
                              ? '格式化模板'
                              : '原始命令'}
                          </span>
                          <span className="mcp-source-badge mcp-source-badge--user">
                            共享
                          </span>
                        </div>
                        <div className="fragment-list__item-meta-row">
                          <span className="fragment-list__item-meta">
                            {triggerOptions.find(
                              (item) => item.value === hook.trigger,
                            )?.label ?? hook.trigger}
                          </span>
                        </div>
                      </div>
                    </button>
                    <span className="fragment-list__toggle">
                      {enabledCount} / {editorIds.length} 已启用
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </section>

        <section
          aria-labelledby="hook-detail-title"
          className="panel fragment-detail hooks-detail"
        >
          <div className="panel__header">
            <div>
              <h2 className="panel__title" id="hook-detail-title">
                {hooksState.selectedHookId === '__new__'
                  ? '添加自定义 Hook'
                  : selectedHook?.name || 'Hook 详情'}
              </h2>
              <p
                className="panel__subtitle"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  flexWrap: 'wrap',
                }}
              >
                <span>配置并启用自定义生命周期 Hooks 命令。</span>
                {hooksState.selectedHookId !== '__new__' && selectedHook && (
                  <Tooltip
                    content="工作台的修改（加入、移除、删除、编辑等）均为临时保存，需点击下方的“保存修改”按钮后才真正写入到本地配置文件。"
                    placement="top"
                    styles={{ overlay: { zIndex: 1400 } }}
                  >
                    <span
                      style={{
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '16px',
                        height: '16px',
                        borderRadius: '50%',
                        background: 'rgba(255, 140, 0, 0.08)',
                        color: 'var(--accent)',
                        fontSize: '10px',
                        lineHeight: 1,
                      }}
                    >
                      💡
                    </span>
                  </Tooltip>
                )}
              </p>
            </div>
            {hooksState.selectedHookId !== '__new__' && selectedHook ? (
              <div className="mcp-detail-switches">
                <span className="mcp-detail-switches__hint">
                  仅控制当前 Hook 在各编辑器中的启用状态
                </span>
                <div className="editor-icon-toggle-group">
                  {editorIds.map((editorId) => {
                    const isEnabled = selectedHook.enabledEditors[editorId];
                    const tooltipContent = `${editorMeta[editorId].title}${isEnabled ? ' 已启用' : ' 未启用'}`;

                    return (
                      <Tooltip
                        key={`hook-toggle-${selectedHook.id}-${editorId}`}
                        content={tooltipContent}
                        placement="top"
                        styles={{ overlay: { zIndex: 1400 } }}
                      >
                        <button
                          type="button"
                          className={`editor-icon-toggle${isEnabled ? ' editor-icon-toggle--enabled' : ''}`}
                          aria-label={tooltipContent}
                          aria-pressed={isEnabled}
                          disabled={
                            pendingHookToggleKey ===
                            `${editorId}:${selectedHook.id}`
                          }
                          onClick={() => {
                            void handleHookEditorToggle(
                              editorId,
                              selectedHook.id,
                            );
                          }}
                        >
                          <EditorToggleIcon editorId={editorId} />
                        </button>
                      </Tooltip>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>

          {hooksState.selectedHookId === '__new__' || selectedHook ? (
            <div className="hooks-detail__body" style={{ overflowY: 'auto' }}>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                }}
              >
                <div className="hooks-field">
                  <span className="hooks-field__label">名称</span>
                  <input
                    className="hooks-input"
                    onChange={(event: ChangeEvent<HTMLInputElement>) =>
                      setDraftFormState({
                        ...formState,
                        name: event.target.value,
                      })
                    }
                    placeholder="例如: prettier"
                    value={formName}
                  />
                </div>

                <div className="hooks-grid">
                  <div className="hooks-field">
                    <span className="hooks-field__label">模式</span>
                    <select
                      className="hooks-select"
                      onChange={(event) =>
                        setDraftFormState({
                          ...formState,
                          mode: event.target.value as HookMode,
                          trigger:
                            event.target.value === 'format-template'
                              ? 'before-commit'
                              : formState.trigger,
                        })
                      }
                      value={formMode}
                    >
                      <option value="raw">原始命令</option>
                      <option value="format-template">
                        格式化当前文件模板
                      </option>
                    </select>
                  </div>
                  <div className="hooks-field">
                    <span className="hooks-field__label">触发点</span>
                    <select
                      className="hooks-select"
                      disabled={formMode === 'format-template'}
                      onChange={(event) =>
                        setDraftFormState({
                          ...formState,
                          trigger: event.target.value as HookTrigger,
                        })
                      }
                      value={formTrigger}
                    >
                      {triggerOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {formMode === 'format-template' ? (
                  <div className="hooks-field">
                    <span className="hooks-field__label">格式化命令</span>
                    <textarea
                      className="hooks-textarea"
                      onChange={(event) =>
                        setDraftFormState({
                          ...formState,
                          formatCommand: event.target.value,
                        })
                      }
                      placeholder={`例如：npx prettier --config ~/.prettierrc --write ${formatCurrentFilePlaceholder}`}
                      spellCheck={false}
                      value={formFormatCommand}
                    />
                    <p className="hooks-field__hint">
                      可用变量：<code>{formatCurrentFilePlaceholder}</code>
                      。工作台会在运行时替换成当前编辑文件路径；如果未显式使用该变量，系统仍会兼容性地把文件路径追加到命令末尾。
                    </p>
                  </div>
                ) : (
                  <div className="hooks-field">
                    <div className="hooks-field__header">
                      <span className="hooks-field__label">命令列表</span>
                      <button
                        className="hooks-secondary-btn"
                        onClick={handleAddCommand}
                        type="button"
                        style={{
                          fontSize: '12px',
                          minHeight: '28px',
                          padding: '0 8px',
                        }}
                      >
                        + 添加命令
                      </button>
                    </div>
                    <div
                      className="hooks-commands"
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                      }}
                    >
                      {formCommands.map((command, index) => (
                        <div
                          key={command.id}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '6px',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                            }}
                          >
                            <span className="hooks-field__hint">
                              命令 {index + 1}
                            </span>
                            {formCommands.length > 1 && (
                              <button
                                type="button"
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: '#ff4d4f',
                                  cursor: 'pointer',
                                  fontSize: '12px',
                                }}
                                onClick={() => handleRemoveCommand(command.id)}
                              >
                                删除
                              </button>
                            )}
                          </div>
                          <textarea
                            className="hooks-textarea"
                            onChange={(event) =>
                              handleCommandChange(
                                command.id,
                                event.target.value,
                              )
                            }
                            placeholder="例如：git diff --name-only | xargs prettier --write"
                            spellCheck={false}
                            value={command.command}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div
                  className="hooks-form__actions"
                  style={{
                    display: 'flex',
                    gap: '12px',
                    marginTop: '12px',
                    justifyContent: 'flex-end',
                  }}
                >
                  {hooksState.selectedHookId !== '__new__' && selectedHook && (
                    <button
                      type="button"
                      className="hooks-primary-btn"
                      style={{
                        background: 'rgba(255, 77, 79, 0.1)',
                        border: '1px solid #ff4d4f',
                        color: '#ff4d4f',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                      }}
                      onClick={() => handleDeleteHook(selectedHook.id)}
                    >
                      删除 Hook
                    </button>
                  )}
                  <button
                    type="button"
                    className="hooks-primary-btn"
                    style={{
                      background:
                        'linear-gradient(135deg, var(--accent) 0%, #ff8c00 100%)',
                      border: 'none',
                      color: '#fff',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                    onClick={handleSaveHook}
                  >
                    {hooksState.selectedHookId === '__new__'
                      ? '创建 Hook'
                      : '保存修改'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <p className="hooks-empty hooks-empty--detail">
              先从左侧新增或选择一条
              hook，再继续编辑它的触发点、命令和编辑器开关。
            </p>
          )}
        </section>
      </main>

      <aside className="preview-column">
        <section
          aria-labelledby="hooks-preview-title"
          className="panel preview-card"
        >
          <div
            className="panel__header"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'stretch',
              gap: '14px',
            }}
          >
            <div>
              <h2 className="panel__title" id="hooks-preview-title">
                最终 Hooks 配置预览
              </h2>
              <p className="panel__subtitle">
                可按编辑器切换预览不同的最终配置结果。
              </p>
            </div>
            <div
              className="hooks-preview__switcher"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'stretch',
                gap: '8px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span className="hooks-preview__switcher-label">当前预览</span>
                <label
                  className="hooks-preview__switch-label"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    color: 'var(--text-soft)',
                    userSelect: 'none',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={showRawPreview}
                    onChange={(e) => setShowRawPreview(e.target.checked)}
                    style={{ cursor: 'pointer' }}
                  />
                  <span>显示配置文件原文</span>
                </label>
              </div>
              <div
                role="tablist"
                aria-label="Hooks 预览编辑器切换"
                className="hooks-preview__tabs"
              >
                {editorIds.map((editorId) => {
                  const isSelected = previewEditorId === editorId;

                  return (
                    <button
                      key={`hooks-preview-${editorId}`}
                      role="tab"
                      aria-selected={isSelected}
                      aria-controls="hooks-preview-code"
                      className={`hooks-preview__tab${isSelected ? ' hooks-preview__tab--selected' : ''}`}
                      onClick={() => setPreviewEditorId(editorId)}
                      type="button"
                    >
                      {editorMeta[editorId].title}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <div
            className="preview-card__body"
            style={{ padding: '0 16px 16px 16px' }}
          >
            {previewHooks.length === 0 ? (
              <p
                className="preview-card__empty"
                style={{ color: 'var(--text-faint)', fontSize: '13px' }}
              >
                {editorMeta[previewEditorId].title} 当前还没有启用任何
                Hook。请先在中间工作区开启后再查看。
              </p>
            ) : (
              <pre
                id="hooks-preview-code"
                className="hooks-preview__code"
                style={{ marginTop: 0 }}
              >
                <code>{generatedPreviewJson}</code>
              </pre>
            )}
          </div>
        </section>
      </aside>
    </HooksPanelRoot>
  );
}
