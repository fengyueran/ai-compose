import { Message } from "@xinghunm/compass-ui";
import { useEffect, useMemo, useState } from "react";

import {
  applyPromptToEditorTarget,
  loadEditorTargetStates,
  applyMcpToEditorTarget,
  loadEditorMcpStates,
  type EditorId,
  isTauriRuntime,
} from "./editor-target-command";
import { composeManagedPromptBlock } from "./compose-prompt";
import "./prompt-workbench-app.css";
import { usePromptWorkbenchStore } from "./prompt-workbench-store";

const configurationDomains = [
  { name: "Prompt", isAvailable: true },
  { name: "MCP", isAvailable: true },
  { name: "Skills", isAvailable: false },
  { name: "Profiles", isAvailable: false },
] as const;

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

function PromptWorkbenchApp() {
  const [messageApi, messageContextHolder] = Message.useMessage();

  const {
    activeDomain,
    selectDomain,
    activeEditorId,
    editorStates,
    enabledFragmentIds,
    hydratePromptEditorStates,
    hydrateMcpEditorStates,
    isHydratingEditorStates,
    presetFragments,
    selectEditor,
    selectedFragmentId,
    selectFragment,
    setEditorEnabled,
    setEditorHydrationPending,
    setApplyFeedback,
    toggleFragment,
    // MCP
    mcpServers,
    selectedMcpServerId,
    selectMcpServer,
    toggleMcpServer,
    addMcpServer,
    updateMcpServer,
    deleteMcpServer,
  } = usePromptWorkbenchStore();

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

  const selectedMcpServer =
    mcpServers.find((server) => server.id === selectedMcpServerId) ??
    mcpServers[0];

  const isExternalServer = selectedMcpServerId !== "__new__" && selectedMcpServer?.source === "external";
  const isPresetServer = selectedMcpServerId !== "__new__" && selectedMcpServer?.source === "preset";

  const enabledMcp = useMemo(
    () => mcpServers.filter((server) => server.enabled),
    [mcpServers],
  );

  const generatedMcpJson = useMemo(() => {
    const mcpServersObj: Record<string, any> = {};
    enabledMcp.forEach((server) => {
      mcpServersObj[server.name] = {
        command: server.command,
        args: server.args,
      };
      if (server.env && Object.keys(server.env).length > 0) {
        mcpServersObj[server.name].env = server.env;
      }
    });
    return JSON.stringify({ mcpServers: mcpServersObj }, null, 2);
  }, [enabledMcp]);

  const generatedMcpToml = useMemo(() => {
    let tomlStr = "";
    if (enabledMcp.length > 0) {
      tomlStr += "[mcp_servers]\n";
      enabledMcp.forEach((server) => {
        tomlStr += `\n[mcp_servers.${server.name}]\n`;
        tomlStr += `command = "${server.command}"\n`;
        if (server.args.length > 0) {
          tomlStr += `args = ${JSON.stringify(server.args)}\n`;
        }
        if (server.env && Object.keys(server.env).length > 0) {
          tomlStr += "env = { ";
          const envPairs = Object.entries(server.env)
            .map(([k, v]) => `${k} = "${v}"`)
            .join(", ");
          tomlStr += envPairs;
          tomlStr += " }\n";
        }
      });
    } else {
      tomlStr += "# 还没有启用任何 MCP 服务";
    }
    return tomlStr.trim();
  }, [enabledMcp]);

  // 表单状态，用于编辑/创建 MCP
  const [formName, setFormName] = useState("");
  const [formCommand, setFormCommand] = useState("");
  const [formArgs, setFormArgs] = useState("");
  const [formEnv, setFormEnv] = useState<{ key: string; value: string }[]>([]);

  // 当选中的 MCP 发生变化时，同步表单
  useEffect(() => {
    if (selectedMcpServer && selectedMcpServerId !== "__new__") {
      setFormName(selectedMcpServer.name);
      setFormCommand(selectedMcpServer.command);
      setFormArgs(selectedMcpServer.args.join("\n"));
      setFormEnv(
        Object.entries(selectedMcpServer.env ?? {}).map(([key, value]) => ({
          key,
          value,
        })),
      );
    } else if (selectedMcpServerId === "__new__") {
      setFormName("");
      setFormCommand("npx");
      setFormArgs("");
      setFormEnv([]);
    }
  }, [selectedMcpServerId, selectedMcpServer]);

  const handleSaveMcp = () => {
    if (!formName.trim() || !formCommand.trim()) {
      messageApi.error("名称和命令不能为空");
      return;
    }

    const envObj: Record<string, string> = {};
    formEnv.forEach(({ key, value }) => {
      if (key.trim()) {
        envObj[key.trim()] = value;
      }
    });

    const parsedArgs = formArgs
      .split("\n")
      .map((a) => a.trim())
      .filter((a) => a.length > 0);

    if (selectedMcpServerId === "__new__") {
      addMcpServer({
        name: formName.trim(),
        command: formCommand.trim(),
        args: parsedArgs,
        env: envObj,
        enabled: true,
      });
      messageApi.success("添加 MCP 服务成功！请点击右侧“应用配置”写入编辑器");
    } else {
      updateMcpServer(selectedMcpServer.id, {
        name: formName.trim(),
        command: formCommand.trim(),
        args: parsedArgs,
        env: envObj,
      });
      messageApi.success("修改 MCP 服务成功！请点击右侧“应用配置”写入编辑器");
    }
  };

  const handleDeleteMcp = async (id: string) => {
    deleteMcpServer(id);
    messageApi.loading({ content: "正在同步删除至编辑器配置...", key: "delete-mcp" });
    try {
      await applyToEditor(activeEditorId, isCurrentEditorEnabled);
      messageApi.success({ content: "删除 MCP 服务成功并已自动同步物理文件！", key: "delete-mcp" });
    } catch (err: any) {
      messageApi.error({ content: `删除成功，但物理文件同步失败: ${err.message}`, key: "delete-mcp" });
    }
  };

  useEffect(() => {
    let isSubscribed = true;

    async function syncEditorStates() {
      if (!isTauriRuntime()) {
        setEditorHydrationPending(false);
        setApplyFeedback({
          status: "idle",
          message:
            "当前不在 Tauri 桌面宿主中运行。请使用 `pnpm dev:desktop` 启动后再读取真实的编辑器配置状态。",
          lastAppliedAt: null,
        });
        return;
      }

      try {
        const [nextPromptStates, nextMcpStates] = await Promise.all([
          loadEditorTargetStates(),
          loadEditorMcpStates(),
        ]);

        if (!isSubscribed) {
          return;
        }

        hydratePromptEditorStates(nextPromptStates);
        hydrateMcpEditorStates(nextMcpStates);
        setApplyFeedback({
          status: "idle",
          message:
            "已从本地编辑器目标文件同步 AI-COMPOSE 受管状态。切换开关会立即写入或清除对应配置。",
          lastAppliedAt: null,
        });
      } catch (error) {
        if (!isSubscribed) {
          return;
        }

        setEditorHydrationPending(false);
        setApplyFeedback({
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "读取本地编辑器配置状态时发生未知错误。",
          lastAppliedAt: null,
        });
      }
    }

    void syncEditorStates();

    return () => {
      isSubscribed = false;
    };
  }, [
    hydratePromptEditorStates,
    hydrateMcpEditorStates,
    setApplyFeedback,
    setEditorHydrationPending,
  ]);

  const applyToEditor = async (
    editorId: EditorId,
    targetEnabled: boolean,
  ): Promise<{ action: string; targetPath: string } | null> => {
    if (activeDomain === "Prompt") {
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
    } else {
      if (targetEnabled && enabledMcp.length === 0) {
        setApplyFeedback({
          status: "error",
          message: "请至少启用一个 MCP 服务后再执行应用。",
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
          ? `正在整理最终 MCP 配置，并通过桌面宿主写入用户级 ${editorMeta[editorId].title} MCP 配置文件。`
          : `正在清除用户级 ${editorMeta[editorId].title} 中由 AI-COMPOSE 受管的 MCP 配置。`,
        lastAppliedAt: null,
      });

      try {
        const latestMcpServers = usePromptWorkbenchStore.getState().mcpServers;
        const enabledMcpLatest = latestMcpServers.filter((s) => s.enabled);
        
        const payloadMcpServers: Record<string, any> = {};
        enabledMcpLatest.forEach((s) => {
          payloadMcpServers[s.name] = {
            command: s.command,
            args: s.args,
            env: s.env,
          };
        });

        const payloadData = {
          mcpServers: payloadMcpServers,
          managedNames: latestMcpServers.map((s) => s.name),
        };

        const result = await applyMcpToEditorTarget({
          editorId,
          enabled: targetEnabled,
          configJson: JSON.stringify(payloadData),
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
              ? `已成功写入 ${result.targetPath}，当前共更新 ${enabledMcpLatest.length} 个 MCP 服务。`
              : result.action === "removed"
                ? `已从 ${result.targetPath} 清除 AI-COMPOSE 受管 MCP 配置。`
                : `${result.targetPath} 当前无改动。`,
          lastAppliedAt: lastAppliedTime,
        });

        return result;
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "写入编辑器目标 MCP 配置时发生未知错误。";

        setApplyFeedback({
          status: "error",
          message,
          lastAppliedAt: null,
        });

        return null;
      }
    }
  };

  const isCurrentEditorEnabled = editorStates[activeEditorId]?.enabled;

  const handleApplyClick = async () => {
    if (!isCurrentEditorEnabled) {
      messageApi.warning(`请先在左侧侧边栏中启用 ${editorMeta[activeEditorId].title}`);
      return;
    }
    const result = await applyToEditor(activeEditorId, true);
    if (result) {
      messageApi.success(`已将最新配置成功应用到 ${editorMeta[activeEditorId].title}！`);
    }
  };

  const handleToggleEditor = async (editorId: EditorId) => {
    const nextEnabled = !editorStates[editorId].enabled;
    selectEditor(editorId);

    if (activeDomain === "Prompt") {
      if (nextEnabled && enabledFragments.length === 0) {
        setApplyFeedback({
          status: "error",
          message: `请至少启用一个片段后再启用 ${editorMeta[editorId].title} 配置。`,
          lastAppliedAt: null,
        });
        return;
      }
    } else {
      if (nextEnabled && enabledMcp.length === 0) {
        setApplyFeedback({
          status: "error",
          message: `请至少启用一个 MCP 服务后再启用 ${editorMeta[editorId].title} 配置。`,
          lastAppliedAt: null,
        });
        return;
      }
    }

    setEditorEnabled(editorId, nextEnabled);
    const result = await applyToEditor(editorId, nextEnabled);

    if (!result) {
      setEditorEnabled(editorId, !nextEnabled);
      return;
    }

    if (activeDomain === "Prompt" && editorId === "cursor" && nextEnabled && result.action === "updated") {
      messageApi.success({
        content:
          "已写入 ~/.cursor/AGENTS.md；下一步请拷贝到当前项目目录，供 Cursor 项目规则读取。",
        duration: 4.8,
      });
    }
  };

  return (
    <div className="app-shell">
      {messageContextHolder}
      <div className="app-frame">
        <header className="global-bar">
          <div className="global-bar__brand">
            <h1 className="global-bar__title">AI Compose</h1>
          </div>

          <div className="global-bar__status" aria-label="当前上下文">
            <span className="chip">
              <span className="chip__label">配置域</span>
              {activeDomain}
            </span>
          </div>
        </header>

        <div className="workspace-grid">
          <aside className="panel side-nav" aria-label="工作台导航">
            <section className="side-nav__section">
              <h2 className="side-nav__label">编辑器</h2>
              <div className="side-nav__items">
                {(Object.keys(editorMeta) as EditorId[]).map((editorId) => (
                  <div
                    key={editorId}
                    className={`side-nav__item side-nav__item--editor${
                      activeEditorId === editorId
                        ? " side-nav__item--active"
                        : ""
                    }`}
                  >
                    <button
                      className="side-nav__item-select"
                      onClick={() => selectEditor(editorId)}
                      type="button"
                    >
                      <div className="side-nav__item-main">
                        <span>{editorMeta[editorId].title}</span>
                        <span className="side-nav__item-state">
                          {editorStates[editorId].enabled ? "已启用" : "已关闭"}
                        </span>
                      </div>
                    </button>
                    <button
                      aria-pressed={editorStates[editorId].enabled}
                      className={`editor-toggle${
                        editorStates[editorId].enabled
                          ? " editor-toggle--enabled"
                          : ""
                      }`}
                      disabled={isHydratingEditorStates}
                      onClick={() => {
                        void handleToggleEditor(editorId);
                      }}
                      type="button"
                    >
                      <span className="editor-toggle__thumb" />
                    </button>
                  </div>
                ))}
              </div>
            </section>

            <section className="side-nav__section">
              <h2 className="side-nav__label">配置域</h2>
              <div className="side-nav__items">
                {configurationDomains.map((domain) => (
                  <button
                    key={domain.name}
                    className={`side-nav__item${
                      activeDomain === domain.name
                        ? " side-nav__item--active"
                        : !domain.isAvailable
                          ? " side-nav__item--disabled"
                          : ""
                    }`}
                    disabled={!domain.isAvailable}
                    onClick={() => domain.isAvailable && selectDomain(domain.name)}
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
            {activeDomain === "Prompt" ? (
              <>
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
                    <span className="chip">{enabledFragments.length} 项已启用</span>
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
              </>
            ) : (
              <>
                <section
                  className="panel fragment-list"
                  aria-labelledby="mcp-list-title"
                >
                  <div className="panel__header">
                    <div>
                      <h2 className="panel__title" id="mcp-list-title">
                        官方预设 MCP 服务
                      </h2>
                      <p className="panel__subtitle">
                        当前首版为直接映射为 mcpServers 配置的官方项与自定义项。
                      </p>
                    </div>
                    <button
                      type="button"
                      className="fragment-action-btn"
                      style={{ minHeight: "32px", padding: "0 10px", fontSize: "12px" }}
                      onClick={() => selectMcpServer("__new__")}
                    >
                      + 添加自定义
                    </button>
                  </div>

                  <div className="fragment-list__items">
                    {mcpServers.map((server) => {
                      const isSelected = server.id === selectedMcpServerId;
                      const isEnabled = server.enabled;

                      return (
                        <button
                          key={server.id}
                          className={`fragment-list__item${
                            isSelected ? " fragment-list__item--selected" : ""
                          }`}
                          onClick={() => selectMcpServer(server.id)}
                          type="button"
                        >
                          <div className="fragment-list__item-main">
                            <div className="fragment-list__item-title-row" style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                              <span className="fragment-list__item-title" style={{ margin: 0 }}>
                                {server.name}
                              </span>
                              <span className={`mcp-source-badge mcp-source-badge--${server.source}`}>
                                {server.source === "preset"
                                  ? "官方"
                                  : server.source === "external"
                                  ? "本地配置"
                                  : "自定义"}
                              </span>
                            </div>
                            <div className="fragment-list__item-meta-row">
                              <span className="fragment-list__item-meta">
                                {server.args.length} 个参数
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
                  aria-labelledby="mcp-detail-title"
                >
                  <div className="panel__header">
                    <div>
                      <h2 className="panel__title" id="mcp-detail-title">
                        {selectedMcpServerId === "__new__"
                          ? "添加自定义 MCP"
                          : selectedMcpServer?.name}
                      </h2>
                      <p className="panel__subtitle">
                        配置并启用 MCP 服务器以扩充模型上下文能力。
                      </p>
                    </div>
                    {selectedMcpServerId !== "__new__" && selectedMcpServer && (
                      isExternalServer ? (
                        <span className="mcp-badge-readonly" style={{ fontSize: "12px", color: "var(--text-faint)", background: "var(--surface-container-high)", padding: "6px 10px", borderRadius: "6px", fontWeight: 500 }}>
                          外部手动配置 (只读)
                        </span>
                      ) : (
                        <button
                          className={`fragment-action-btn${
                            selectedMcpServer.enabled
                              ? " fragment-action-btn--active"
                              : ""
                          }`}
                          onClick={() => toggleMcpServer(selectedMcpServer.id)}
                          type="button"
                        >
                          {selectedMcpServer.enabled
                            ? "从最终 MCP 移除"
                            : "加入最终 MCP"}
                        </button>
                      )
                    )}
                  </div>

                  <div className="fragment-detail__body" style={{ overflowY: "auto" }}>
                    {selectedMcpServerId !== "__new__" && selectedMcpServer?.description && (
                      <p className="mcp-description" style={{ marginBottom: "16px", color: "var(--text-faint)", fontSize: "14px", lineHeight: "1.5" }}>
                        {selectedMcpServer.description}
                      </p>
                    )}

                    {selectedMcpServerId !== "__new__" && selectedMcpServer?.source === "user" && (
                      <p style={{ margin: "-8px 0 16px 0", fontSize: "12px", color: "var(--text-faint)", background: "rgba(255, 140, 0, 0.04)", border: "1px dashed rgba(255, 140, 0, 0.15)", padding: "8px 12px", borderRadius: "6px", display: "flex", alignItems: "center", gap: "6px" }}>
                        💡 <strong>小提示：</strong> 工作台的修改（加入、移除、删除、编辑等）均为临时保存，需点击右侧预览区的<strong>“应用配置”</strong>按钮后才真正写入到本地配置文件。
                      </p>
                    )}

                    <div className="mcp-form" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                      <div className="mcp-form__field" style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        <label className="mcp-form__label" style={{ fontSize: "12px", color: "var(--text-faint)", fontWeight: 500 }}>
                          服务名称 (必须唯一且无空格)
                        </label>
                        <input
                          className="form-input"
                          placeholder="例如: weather"
                          value={formName}
                          disabled={isPresetServer || isExternalServer}
                          onChange={(e) => setFormName(e.target.value)}
                        />
                      </div>

                      <div className="mcp-form__field" style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        <label className="mcp-form__label" style={{ fontSize: "12px", color: "var(--text-faint)", fontWeight: 500 }}>
                          启动命令 (Command)
                        </label>
                        <input
                          className="form-input"
                          placeholder="例如: npx, python, uv"
                          value={formCommand}
                          disabled={isPresetServer || isExternalServer}
                          onChange={(e) => setFormCommand(e.target.value)}
                        />
                      </div>

                      <div className="mcp-form__field" style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        <label className="mcp-form__label" style={{ fontSize: "12px", color: "var(--text-faint)", fontWeight: 500 }}>
                          启动参数 (Arguments, 一行一个)
                        </label>
                        <textarea
                          className="form-textarea"
                          rows={4}
                          placeholder="例如:
-y
@modelcontextprotocol/server-sqlite"
                          value={formArgs}
                          disabled={isPresetServer || isExternalServer}
                          onChange={(e) => setFormArgs(e.target.value)}
                        />
                      </div>

                      <div className="mcp-form__field" style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        <label className="mcp-form__label" style={{ fontSize: "12px", color: "var(--text-faint)", fontWeight: 500 }}>
                          环境变量 (Environment Variables)
                        </label>
                        <div className="env-editor" style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                          {formEnv.map((pair, index) => (
                            <div key={index} className="env-editor__row" style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                              <input
                                className="form-input env-input"
                                placeholder="KEY"
                                value={pair.key}
                                disabled={isExternalServer}
                                onChange={(e) => {
                                  const next = [...formEnv];
                                  next[index].key = e.target.value;
                                  setFormEnv(next);
                                }}
                              />
                              <input
                                className="form-input env-input"
                                placeholder="VALUE"
                                value={pair.value}
                                disabled={isExternalServer}
                                onChange={(e) => {
                                  const next = [...formEnv];
                                  next[index].value = e.target.value;
                                  setFormEnv(next);
                                }}
                              />
                              {!isExternalServer && (
                                <button
                                  type="button"
                                  className="env-editor__delete-btn"
                                  style={{
                                    background: "none",
                                    border: "none",
                                    color: "#ff4d4f",
                                    cursor: "pointer",
                                    fontSize: "12px",
                                  }}
                                  onClick={() => setFormEnv(formEnv.filter((_, i) => i !== index))}
                                >
                                  删除
                                </button>
                              )}
                            </div>
                          ))}
                          {!isExternalServer && (
                            <button
                              type="button"
                              className="env-editor__add-btn"
                              style={{
                                alignSelf: "flex-start",
                                background: "rgba(255, 140, 0, 0.1)",
                                border: "1px dashed var(--accent-color)",
                                color: "var(--accent-color)",
                                padding: "4px 8px",
                                borderRadius: "4px",
                                fontSize: "12px",
                                cursor: "pointer",
                              }}
                              onClick={() => setFormEnv([...formEnv, { key: "", value: "" }])}
                            >
                              + 添加环境变量
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="mcp-form__actions" style={{ display: "flex", gap: "12px", marginTop: "12px", justifyContent: "flex-end" }}>
                        {selectedMcpServerId !== "__new__" && selectedMcpServer?.source === "user" && (
                          <button
                            type="button"
                            className="mcp-form__btn mcp-form__btn--danger"
                            style={{
                              background: "rgba(255, 77, 79, 0.1)",
                              border: "1px solid #ff4d4f",
                              color: "#ff4d4f",
                              padding: "6px 12px",
                              borderRadius: "6px",
                              cursor: "pointer",
                            }}
                            onClick={() => handleDeleteMcp(selectedMcpServer.id)}
                          >
                            删除服务
                          </button>
                        )}
                        <button
                          type="button"
                          className="mcp-form__btn mcp-form__btn--primary"
                          disabled={isExternalServer}
                          style={{
                            background: isExternalServer 
                              ? "var(--surface-container-high)" 
                              : "linear-gradient(135deg, var(--accent-color) 0%, #ff8c00 100%)",
                            border: "none",
                            color: isExternalServer ? "var(--text-faint)" : "#fff",
                            padding: "6px 12px",
                            borderRadius: "6px",
                            fontWeight: 500,
                            cursor: isExternalServer ? "not-allowed" : "pointer",
                          }}
                          onClick={handleSaveMcp}
                        >
                          {selectedMcpServerId === "__new__" ? "创建服务" : "保存修改"}
                        </button>
                      </div>
                    </div>
                  </div>
                </section>
              </>
            )}
          </main>

          <aside className="preview-column">
            {activeDomain === "Prompt" ? (
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
                  <button
                    className={`preview-apply-btn${isCurrentEditorEnabled ? "" : " preview-apply-btn--disabled"}`}
                    onClick={handleApplyClick}
                    disabled={!isCurrentEditorEnabled}
                    title={isCurrentEditorEnabled ? `应用 Prompt 配置到 ${editorMeta[activeEditorId].title}` : `请先启用左侧 ${editorMeta[activeEditorId].title}`}
                  >
                    应用配置
                  </button>
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
            ) : (
              <section
                className="panel preview-card"
                aria-labelledby="preview-title"
              >
                <div className="panel__header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
                  <div>
                    <h2 className="panel__title" id="preview-title">
                      最终 MCP 配置预览
                    </h2>
                    <p className="panel__subtitle">
                      右侧始终展示当前启用 MCP 服务的最终 {activeEditorId === "codex" ? "TOML" : "JSON"} 配置。
                    </p>
                  </div>
                  <button
                    className={`preview-apply-btn${isCurrentEditorEnabled ? "" : " preview-apply-btn--disabled"}`}
                    onClick={handleApplyClick}
                    disabled={!isCurrentEditorEnabled}
                    title={isCurrentEditorEnabled ? `应用 MCP 配置到 ${editorMeta[activeEditorId].title}` : `请先启用左侧 ${editorMeta[activeEditorId].title}`}
                  >
                    应用配置
                  </button>
                </div>

                <div className="preview-card__body" style={{ padding: "0 16px 16px 16px" }}>
                  {enabledMcp.length === 0 ? (
                    <p className="preview-card__empty">
                      还没有启用任何 MCP 服务。请先从中间工作区选择要纳入的配置。
                    </p>
                  ) : (
                    <pre
                      style={{
                        background: "rgba(0, 0, 0, 0.2)",
                        padding: "12px",
                        borderRadius: "8px",
                        overflowX: "auto",
                        maxWidth: "100%",
                        fontFamily: "monospace",
                        fontSize: "13px",
                        color: "var(--text-bright)",
                        lineHeight: 1.5,
                      }}
                    >
                      <code>{activeEditorId === "codex" ? generatedMcpToml : generatedMcpJson}</code>
                    </pre>
                  )}
                </div>
              </section>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}

export default PromptWorkbenchApp;
