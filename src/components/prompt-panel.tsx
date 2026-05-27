import { useMemo } from "react";
import { Tooltip, Message } from "@xinghunm/compass-ui";
import { useAiComposeStore } from "../ai-compose-store";
import {
  applyPromptToEditorTarget,
  isTauriRuntime,
  type EditorId,
} from "../editor-target-command";
import { composeManagedPromptBlock } from "../compose-prompt";
import { EditorToggleIcon } from "./editor-toggle-icon";

const editorMeta: Record<
  EditorId,
  {
    title: string;
  }
> = {
  antigravity: {
    title: "Antigravity",
  },
  codex: {
    title: "Codex",
  },
  cursor: {
    title: "Cursor",
  },
};

const editorIds = Object.keys(editorMeta) as EditorId[];

interface PromptPanelProps {
  messageApi: ReturnType<typeof Message.useMessage>[0];
}

export function PromptPanel({ messageApi }: PromptPanelProps) {
  const {
    editorStates,
    promptEditorStates,
    enabledFragmentIds,
    presetFragments,
    selectedFragmentId,
    selectFragment,
    toggleFragment,
    setEditorEnabled,
    setApplyFeedback,
    applyStatus,
  } = useAiComposeStore();

  const selectedFragment =
    presetFragments.find((fragment) => fragment.id === selectedFragmentId) ??
    presetFragments[0];

  const enabledFragments = useMemo(
    () =>
      presetFragments.filter((fragment) =>
        enabledFragmentIds.includes(fragment.id),
      ),
    [enabledFragmentIds, presetFragments],
  );

  const applyToEditor = async (
    editorId: EditorId,
    targetEnabled: boolean,
  ): Promise<{ action: string; targetPath: string } | null> => {
    if (targetEnabled && enabledFragments.length === 0) {
      setApplyFeedback({
        status: "error",
        message: "请至少启用一个片段后再执行应用。",
        lastAppliedAt: null,
      });
      return null;
    }

    if (!isTauriRuntime()) {
      setApplyFeedback({
        status: "error",
        message:
          "当前不在 Tauri 桌面宿主中运行。请使用 `pnpm dev:desktop` 启动后再执行应用。",
        lastAppliedAt: null,
      });
      return null;
    }

    setApplyFeedback({
      status: "pending",
      message: targetEnabled
        ? editorId === "codex"
          ? "正在整理最终 Prompt，并通过桌面宿主写入用户级 Codex AGENTS.md。"
          : editorId === "cursor"
            ? "正在整理最终 Prompt，并通过桌面宿主写入用户级 Cursor AGENTS.md。"
            : "正在整理最终 Prompt，并通过桌面宿主写入用户级 Antigravity GEMINI.md。"
        : editorId === "codex"
          ? "正在清除用户级 Codex 中由 AI-COMPOSE 受管的提示词配置。"
          : editorId === "cursor"
            ? "正在清除用户级 Cursor 中由 AI-COMPOSE 受管的提示词配置。"
            : "正在清除用户级 Antigravity 中由 AI-COMPOSE 受管的提示词配置。",
      lastAppliedAt: null,
    });

    try {
      const generatedAt = new Intl.DateTimeFormat("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }).format(new Date());
      const managedBlock = composeManagedPromptBlock(
        enabledFragments,
        generatedAt,
      );
      const result = await applyPromptToEditorTarget({
        editorId,
        enabled: targetEnabled,
        managedBlock,
      });

      const lastAppliedTime = new Intl.DateTimeFormat("zh-CN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }).format(new Date());

      setApplyFeedback({
        status: "success",
        message:
          result.action === "updated"
            ? `已成功写入 ${result.targetPath}，当前共更新 ${enabledFragments.length} 个片段的受管区块。`
            : result.action === "removed"
              ? `已从 ${result.targetPath} 清除 AI-COMPOSE 受管区块，其他非受管内容保持不变。`
              : `${result.targetPath} 当前没有可清除的 AI-COMPOSE 受管区块。`,
        lastAppliedAt: lastAppliedTime,
      });

      return result;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "写入编辑器目标配置时发生未知错误。";

      setApplyFeedback({
        status: "error",
        message,
        lastAppliedAt: null,
      });

      return null;
    }
  };

  const enabledPromptEditorIds = useMemo(
    () => editorIds.filter((editorId) => promptEditorStates[editorId]?.enabled),
    [promptEditorStates],
  );

  const handleApplyClick = async () => {
    if (enabledPromptEditorIds.length === 0) {
      messageApi.warning("请先在当前配置域中启用至少一个编辑器");
      return;
    }

    const results = await Promise.all(
      enabledPromptEditorIds.map((editorId) => applyToEditor(editorId, true)),
    );
    const succeededEditors = enabledPromptEditorIds.filter((_, index) => results[index]);

    if (succeededEditors.length > 0) {
      messageApi.success(`已将最新配置成功应用到 ${succeededEditors.map((editorId) => editorMeta[editorId].title).join("、")}！`);
    }
  };

  const handleToggleEditor = async (editorId: EditorId) => {
    const nextEnabled = !promptEditorStates[editorId]?.enabled;

    if (nextEnabled && enabledFragments.length === 0) {
      setApplyFeedback({
        status: "error",
        message: `请至少启用一个片段后再启用 ${editorMeta[editorId].title} 配置。`,
        lastAppliedAt: null,
      });
      return;
    }

    setEditorEnabled(editorId, nextEnabled);
    const result = await applyToEditor(editorId, nextEnabled);

    if (!result) {
      setEditorEnabled(editorId, !nextEnabled);
      return;
    }

    if (editorId === "cursor" && nextEnabled && result.action === "updated") {
      messageApi.success({
        content:
          "已写入 ~/.cursor/AGENTS.md；下一步请拷贝到当前项目目录，供 Cursor 项目规则读取。",
        duration: 4.8,
      });
    }
  };

  return (
    <>
      <main className="workbench">
      <section
        className="panel fragment-list"
        aria-labelledby="fragment-list-title"
      >
        <div className="panel__header">
          <div>
            <h2 className="panel__title" id="fragment-list-title">
              官方预设片段
            </h2>
            <p className="panel__subtitle">
              当前首版粒度为分类即片段，共 7 个官方预设项。
            </p>
          </div>
          <span className="chip">{enabledFragmentIds.length} 项已启用</span>
        </div>

        <div className="fragment-list__items">
          {presetFragments.map((fragment) => {
            const isSelected = fragment.id === selectedFragmentId;
            const isEnabled = enabledFragmentIds.includes(fragment.id);

            return (
              <button
                key={fragment.id}
                className={`fragment-list__item${
                  isSelected ? " fragment-list__item--selected" : ""
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
                      {fragment.source === "preset"
                        ? "官方预设"
                        : "用户片段"}
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
                        ? " fragment-list__toggle-dot--enabled"
                        : ""
                    }`}
                  />
                  {isEnabled ? "已启用" : "未启用"}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section
        className="panel fragment-detail"
        aria-labelledby="fragment-detail-title"
      >
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
            className={`fragment-action-btn${
              enabledFragmentIds.includes(selectedFragment.id)
                ? " fragment-action-btn--active"
                : ""
            }`}
            onClick={() => toggleFragment(selectedFragment.id)}
            type="button"
          >
            {enabledFragmentIds.includes(selectedFragment.id)
              ? "从最终 Prompt 移除"
              : "加入最终 Prompt"}
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
        <section
          className="panel preview-card"
          aria-labelledby="preview-title"
        >
          <div className="panel__header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
            <div>
              <h2 className="panel__title" id="preview-title">
                最终 Prompt 预览
              </h2>
              <p className="panel__subtitle">
                右侧始终展示当前启用片段的最终组合结果。
              </p>
            </div>
            <div className="preview-card__actions">
              <div className="preview-card__editor-toggles">
                {editorIds.map((editorId) => {
                  const isEnabled = editorStates[editorId]?.enabled;
                  const tooltipContent = `${editorMeta[editorId].title}${isEnabled ? " Prompt 已启用" : " Prompt 未启用"}`;

                  return (
                    <Tooltip
                      key={`prompt-preview-${editorId}`}
                      content={tooltipContent}
                      placement="top"
                      styles={{ overlay: { zIndex: 1400 } }}
                    >
                      <button
                        aria-label={tooltipContent}
                        aria-pressed={isEnabled}
                        className={`editor-icon-toggle${
                          isEnabled ? " editor-icon-toggle--enabled" : ""
                        }`}
                        onClick={() => {
                          void handleToggleEditor(editorId);
                        }}
                        type="button"
                      >
                        <EditorToggleIcon editorId={editorId} />
                      </button>
                    </Tooltip>
                  );
                })}
              </div>
              <button
                className={`preview-apply-btn${enabledPromptEditorIds.length > 0 && applyStatus !== "pending" ? "" : " preview-apply-btn--disabled"}`}
                onClick={handleApplyClick}
                disabled={enabledPromptEditorIds.length === 0 || applyStatus === "pending"}
                title={enabledPromptEditorIds.length > 0 ? `将 Prompt 配置应用到 ${enabledPromptEditorIds.map((editorId) => editorMeta[editorId].title).join("、")}` : "请先在当前配置域中启用至少一个编辑器"}
              >
                {applyStatus === "pending" ? "正在应用..." : "应用配置"}
              </button>
            </div>
          </div>

          <div className="preview-card__body">
            {enabledFragments.length === 0 ? (
              <p className="preview-card__empty">
                还没有启用任何片段。请先从中间工作区选择要纳入 Prompt
                的内容。
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
      </aside>
    </>
  );
}
