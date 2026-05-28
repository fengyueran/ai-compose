import { useEffect, useMemo, useState } from "react";
import { Tooltip, Message } from "@xinghunm/compass-ui";
import {
  useAiComposeStore,
  applyMcpToEditorTarget,
  isTauriRuntime,
  loadEditorMcpStates,
  type EditorId,
  type McpServer,
  EditorToggleIcon,
} from "../../../shared";
import { McpPanelRoot } from "./mcp-panel.styles";

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

interface McpPanelProps {
  messageApi: ReturnType<typeof Message.useMessage>[0];
}

export function McpPanel({ messageApi }: McpPanelProps) {
  const {
    activeEditorId,
    hydrateMcpEditorStates,
    mcpServers,
    mcpEnabledServerIdsByEditor,
    selectedMcpServerId,
    selectMcpServer,
    toggleMcpServerForEditor,
    addMcpServer,
    updateMcpServer,
    deleteMcpServer,
  } = useAiComposeStore();

  const [previewEditorId, setPreviewEditorId] = useState<EditorId>(activeEditorId);

  const selectedMcpServer =
    mcpServers.find((server) => server.id === selectedMcpServerId) ??
    mcpServers[0];

  const previewEnabledMcpIds = useMemo(
    () => mcpEnabledServerIdsByEditor[previewEditorId] ?? [],
    [mcpEnabledServerIdsByEditor, previewEditorId],
  );

  const previewEnabledMcp = useMemo(
    () => mcpServers.filter((server) => previewEnabledMcpIds.includes(server.id)),
    [mcpServers, previewEnabledMcpIds],
  );

  const generatedMcpJson = useMemo(() => {
    const mcpServersObj: Record<
      string,
      {
        type?: string;
        url?: string;
        command?: string;
        args?: string[];
        env?: Record<string, string>;
      }
    > = {};
    previewEnabledMcp.forEach((server) => {
      if (server.transportType === "http") {
        mcpServersObj[server.name] = {
          type: server.type || "streamable_http",
          url: server.url || "",
        };
      } else {
        const entry: {
          command: string;
          args: string[];
          env?: Record<string, string>;
        } = {
          command: server.command || "",
          args: server.args || [],
        };
        if (server.env && Object.keys(server.env).length > 0) {
          entry.env = server.env;
        }
        mcpServersObj[server.name] = entry;
      }
    });
    return JSON.stringify({ mcpServers: mcpServersObj }, null, 2);
  }, [previewEnabledMcp]);

  const generatedMcpToml = useMemo(() => {
    let tomlStr = "";
    if (previewEnabledMcp.length > 0) {
      tomlStr += "[mcp_servers]\n";
      previewEnabledMcp.forEach((server) => {
        tomlStr += `\n[mcp_servers.${server.name}]\n`;
        if (server.transportType === "http") {
          tomlStr += `type = "${server.type || "streamable_http"}"\n`;
          tomlStr += `url = "${server.url || ""}"\n`;
        } else {
          tomlStr += `command = "${server.command || ""}"\n`;
          if (server.args && server.args.length > 0) {
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
        }
      });
    } else {
      tomlStr += "# 还没有启用任何 MCP 服务";
    }
    return tomlStr.trim();
  }, [previewEnabledMcp]);

  const [pendingMcpToggleKey, setPendingMcpToggleKey] = useState<string | null>(null);

  // Form state for editing or creating an MCP server.
  const [formName, setFormName] = useState("");
  const [formTransportType, setFormTransportType] = useState<'stdio' | 'http'>("stdio");
  const [formCommand, setFormCommand] = useState("npx");
  const [formArgs, setFormArgs] = useState("");
  const [formEnv, setFormEnv] = useState<{ key: string; value: string }[]>([]);
  const [formType, setFormType] = useState("streamable_http");
  const [formUrl, setFormUrl] = useState("");

  // Keep the form state in sync when the selected MCP server changes.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (selectedMcpServer && selectedMcpServerId !== "__new__") {
      setFormName(selectedMcpServer.name || "");
      setFormTransportType(selectedMcpServer.transportType ?? "stdio");
      setFormCommand(selectedMcpServer.command ?? "");
      setFormArgs((selectedMcpServer.args ?? []).join("\n"));
      setFormEnv(
        Object.entries(selectedMcpServer.env ?? {}).map(([key, value]) => ({ key, value }))
      );
      setFormType(selectedMcpServer.type ?? "streamable_http");
      setFormUrl(selectedMcpServer.url ?? "");
    } else {
      setFormName("");
      setFormTransportType("stdio");
      setFormCommand("npx");
      setFormArgs("");
      setFormEnv([]);
      setFormType("streamable_http");
      setFormUrl("");
    }
  }, [selectedMcpServerId, selectedMcpServer]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const getEnabledMcpIdsForEditor = (editorId: EditorId) =>
    mcpEnabledServerIdsByEditor[editorId] ?? [];

  const isMcpEnabledForEditor = (editorId: EditorId, serverId: string) =>
    getEnabledMcpIdsForEditor(editorId).includes(serverId);

  const buildMcpPayload = (
    enabledIds: string[],
    sourceServers: McpServer[] = mcpServers,
  ) => {
    const enabledServers = sourceServers.filter((server) => enabledIds.includes(server.id));
    const payloadMcpServers: Record<string, Record<string, unknown>> = {};

    enabledServers.forEach((server) => {
      if (server.transportType === "http") {
        payloadMcpServers[server.name] = {
          type: server.type || "streamable_http",
          url: server.url || "",
        };
        return;
      }

      payloadMcpServers[server.name] = {
        command: server.command || "",
        args: server.args || [],
      };

      if (server.env && Object.keys(server.env).length > 0) {
        payloadMcpServers[server.name].env = server.env;
      }
    });

    return {
      enabledServers,
      payloadData: {
        mcpServers: payloadMcpServers,
        managedNames: sourceServers.map((server) => server.name),
      },
    };
  };

  const applyMcpSelectionToEditor = async (
    editorId: EditorId,
    enabledIds: string[],
    sourceServers?: McpServer[],
  ) => {
    const { enabledServers, payloadData } = buildMcpPayload(enabledIds, sourceServers);

    return applyMcpToEditorTarget({
      editorId,
      enabled: enabledServers.length > 0,
      configJson: JSON.stringify(payloadData),
    });
  };

  const handleMcpEditorToggle = async (
    editorId: EditorId,
    serverId: string,
  ) => {
    const currentEnabledIds = getEnabledMcpIdsForEditor(editorId);
    const nextEnabledIds = currentEnabledIds.includes(serverId)
      ? currentEnabledIds.filter((id) => id !== serverId)
      : [...currentEnabledIds, serverId];

    toggleMcpServerForEditor(editorId, serverId);

    if (!isTauriRuntime()) {
      return;
    }

    const toggleKey = `${editorId}:${serverId}`;
    setPendingMcpToggleKey(toggleKey);

    try {
      await applyMcpSelectionToEditor(editorId, nextEnabledIds);
      const nextMcpStates = await loadEditorMcpStates();
      hydrateMcpEditorStates(nextMcpStates);
      messageApi.success(`${editorMeta[editorId].title} 的 MCP 配置已更新。`);
    } catch (error) {
      toggleMcpServerForEditor(editorId, serverId);
      const errMsg = error instanceof Error ? error.message : String(error);
      messageApi.error(`更新 ${editorMeta[editorId].title} 的 MCP 配置失败: ${errMsg}`);
    } finally {
      setPendingMcpToggleKey(null);
    }
  };

  const handleSaveMcp = async () => {
    if (!formName.trim()) {
      messageApi.error("名称不能为空");
      return;
    }

    if (formTransportType === "stdio") {
      if (!formCommand.trim()) {
        messageApi.error("命令不能为空");
        return;
      }
    } else {
      if (!formType.trim() || !formUrl.trim()) {
        messageApi.error("类型和 URL 不能为空");
        return;
      }
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

    const existsName = mcpServers.some(
      (s) =>
        s.name.toLowerCase() === formName.trim().toLowerCase() &&
        (selectedMcpServerId === "__new__" || s.id !== selectedMcpServer.id)
    );
    if (existsName) {
      messageApi.error(`已存在名为 "${formName.trim()}" 的 MCP 服务，请使用其他名称`);
      return;
    }

    const mcpData = formTransportType === "stdio"
      ? {
          name: formName.trim(),
          transportType: "stdio" as const,
          command: formCommand.trim(),
          args: parsedArgs,
          env: envObj,
        }
      : {
          name: formName.trim(),
          transportType: "http" as const,
          type: formType.trim(),
          url: formUrl.trim(),
          command: "",
          args: [],
          env: {},
        };

    if (selectedMcpServerId === "__new__") {
      addMcpServer({
        ...mcpData,
        enabled: true,
      });

      if (isTauriRuntime()) {
        const latestStore = useAiComposeStore.getState();
        const latestServers = latestStore.mcpServers;
        const newId = `custom-${mcpData.name.toLowerCase().replace(/\s+/g, '-')}`;
        const currentEnabledIds = latestStore.mcpEnabledServerIdsByEditor[activeEditorId] ?? [];
        const enabledIdsForEditor = currentEnabledIds.includes(newId)
          ? currentEnabledIds
          : [...currentEnabledIds, newId];

        messageApi.loading({
          content: `正在同步到 ${editorMeta[activeEditorId].title}...`,
          key: "save-mcp",
        });

        try {
          await applyMcpSelectionToEditor(activeEditorId, enabledIdsForEditor, latestServers);
          const nextMcpStates = await loadEditorMcpStates();
          hydrateMcpEditorStates(nextMcpStates);
          messageApi.success({
            content: `添加 MCP 服务并同步到 ${editorMeta[activeEditorId].title} 成功。`,
            key: "save-mcp",
          });
        } catch (error) {
          const errMsg = error instanceof Error ? error.message : String(error);
          messageApi.error({
            content: `同步到 ${editorMeta[activeEditorId].title} 失败: ${errMsg}`,
            key: "save-mcp",
          });
        }
      } else {
        messageApi.success("添加 MCP 服务成功。可继续为不同编辑器开启后自动同步。");
      }
    } else {
      updateMcpServer(selectedMcpServer.id, mcpData);

      const latestStore = useAiComposeStore.getState();
      const latestServers = latestStore.mcpServers;
      const enabledEditorIds = editorIds.filter((editorId) =>
        (latestStore.mcpEnabledServerIdsByEditor[editorId] ?? []).includes(selectedMcpServer.id),
      );

      if (!isTauriRuntime() || enabledEditorIds.length === 0) {
        messageApi.success(
          enabledEditorIds.length === 0
            ? "修改 MCP 服务成功。当前没有已启用该服务的编辑器。"
            : "修改 MCP 服务成功。",
        );
        return;
      }

      messageApi.loading({
        content: `正在同步到 ${enabledEditorIds.map((editorId) => editorMeta[editorId].title).join("、")}...`,
        key: "save-mcp",
      });

      const syncResults = await Promise.allSettled(
        enabledEditorIds.map(async (editorId) => {
          const enabledIdsForEditor = latestStore.mcpEnabledServerIdsByEditor[editorId] ?? [];
          await applyMcpSelectionToEditor(editorId, enabledIdsForEditor, latestServers);
          return editorId;
        }),
      );

      const failedResults = syncResults.filter(
        (result): result is PromiseRejectedResult => result.status === "rejected",
      );

      const nextMcpStates = await loadEditorMcpStates();
      hydrateMcpEditorStates(nextMcpStates);

      if (failedResults.length > 0) {
        const errorMessage = failedResults[0].reason instanceof Error
          ? failedResults[0].reason.message
          : String(failedResults[0].reason);
        messageApi.error({
          content: `保存成功，但同步部分编辑器失败：${errorMessage}`,
          key: "save-mcp",
        });
        return;
      }

      messageApi.success({
        content: `修改 MCP 服务成功，并已同步到 ${enabledEditorIds.map((editorId) => editorMeta[editorId].title).join("、")}。`,
        key: "save-mcp",
      });
    }
  };

  const handleDeleteMcp = async (id: string) => {
    deleteMcpServer(id);
    messageApi.loading({ content: "正在同步删除至编辑器配置...", key: "delete-mcp" });
    try {
      const nextEnabledCount = getEnabledMcpIdsForEditor(activeEditorId).filter((serverId) => serverId !== id).length;
      
      if (isTauriRuntime()) {
        const { payloadData } = buildMcpPayload(
          getEnabledMcpIdsForEditor(activeEditorId).filter((serverId) => serverId !== id)
        );
        await applyMcpToEditorTarget({
          editorId: activeEditorId,
          enabled: nextEnabledCount > 0,
          configJson: JSON.stringify(payloadData),
        });
      }
      messageApi.success({ content: "删除 MCP 服务成功并已自动同步物理文件！", key: "delete-mcp" });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      messageApi.error({ content: `删除成功，但物理文件同步失败: ${errMsg}`, key: "delete-mcp" });
    }
  };

  return (
    <McpPanelRoot>
      <main className="workbench">
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
              const enabledCount = editorIds.filter((editorId) =>
                isMcpEnabledForEditor(editorId, server.id),
              ).length;

              return (
                <div
                  key={server.id}
                  className={`fragment-list__item${
                    isSelected ? " fragment-list__item--selected" : ""
                  }`}
                >
                  <button
                    className="fragment-list__item-select"
                    onClick={() => selectMcpServer(server.id)}
                    type="button"
                  >
                    <div className="fragment-list__item-main">
                      <div className="fragment-list__item-title-row" style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                        <span className="fragment-list__item-title" style={{ margin: 0 }}>
                          {server.name}
                        </span>
                        <span className={`mcp-source-badge mcp-source-badge--${server.source}`}>
                          {server.source === "preset" ? "官方" : "自定义"}
                        </span>
                      </div>
                      <div className="fragment-list__item-meta-row">
                        <span className="fragment-list__item-meta">
                          {server.transportType === 'http'
                            ? server.url
                            : `${(server.args ?? []).length} 个参数`}
                        </span>
                      </div>
                    </div>
                  </button>
                  <span className="fragment-list__toggle">
                    {enabledCount} / {editorIds.length} 已启用
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        <section
          key={selectedMcpServerId}
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
              <p className="panel__subtitle" style={{ display: "inline-flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                <span>配置并启用 MCP 服务器以扩充模型上下文能力。</span>
                {selectedMcpServerId !== "__new__" && selectedMcpServer?.source === "user" && (
                  <Tooltip
                    content="工作台的修改（加入、移除、删除、编辑等）均为临时保存，需点击右侧预览区的“应用配置”按钮后才真正写入到本地配置文件。"
                    placement="top"
                    styles={{ overlay: { zIndex: 1400 } }}
                  >
                    <span style={{
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: "16px",
                      height: "16px",
                      borderRadius: "50%",
                      background: "rgba(255, 140, 0, 0.08)",
                      color: "var(--accent)",
                      fontSize: "10px",
                      lineHeight: 1
                    }}>
                      💡
                    </span>
                  </Tooltip>
                )}
              </p>
            </div>
            {selectedMcpServerId !== "__new__" && selectedMcpServer && (
              <div className="mcp-detail-switches">
                <span className="mcp-detail-switches__hint">
                  仅控制当前 MCP 在各编辑器中的启用状态
                </span>
                <div className="editor-icon-toggle-group">
                  {editorIds.map((editorId) => {
                    const isEnabled = isMcpEnabledForEditor(editorId, selectedMcpServer.id);
                    const tooltipContent = `${editorMeta[editorId].title}${isEnabled ? " 已启用" : " 未启用"}`;

                    return (
                      <Tooltip
                        key={`detail-${selectedMcpServer.id}-${editorId}`}
                        content={tooltipContent}
                        placement="top"
                        styles={{ overlay: { zIndex: 1400 } }}
                      >
                        <button
                          type="button"
                          className={`editor-icon-toggle${
                            isEnabled ? " editor-icon-toggle--enabled" : ""
                          }`}
                          aria-label={tooltipContent}
                          aria-pressed={isEnabled}
                          disabled={pendingMcpToggleKey === `${editorId}:${selectedMcpServer.id}`}
                          onClick={() => {
                            void handleMcpEditorToggle(editorId, selectedMcpServer.id);
                          }}
                        >
                          <EditorToggleIcon editorId={editorId} />
                        </button>
                      </Tooltip>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="fragment-detail__body" style={{ overflowY: "auto" }}>
            {selectedMcpServerId !== "__new__" && selectedMcpServer?.description && (
              <p className="mcp-description" style={{ marginBottom: "16px", color: "var(--text-faint)", fontSize: "14px", lineHeight: "1.5" }}>
                {selectedMcpServer.description}
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
                  onChange={(e) => setFormName(e.target.value)}
                />
              </div>

              <div className="mcp-form__field" style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label className="mcp-form__label" style={{ fontSize: "12px", color: "var(--text-faint)", fontWeight: 500 }}>
                  传输协议类型 (Transport Type)
                </label>
                <div style={{ display: "flex", gap: "12px", marginTop: "4px" }}>
                  <button
                    type="button"
                    style={{
                      flex: 1,
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: formTransportType === "stdio" ? "1px solid var(--accent)" : "1px solid var(--panel-border)",
                      background: formTransportType === "stdio" ? "var(--accent-soft)" : "rgba(255,255,255,0.4)",
                      color: formTransportType === "stdio" ? "var(--accent-strong)" : "var(--text-main)",
                      fontWeight: formTransportType === "stdio" ? 600 : 400,
                      cursor: "pointer",
                      fontSize: "13px",
                    }}
                    onClick={() => setFormTransportType("stdio")}
                  >
                    本地进程 (Stdio)
                  </button>
                  <button
                    type="button"
                    style={{
                      flex: 1,
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: formTransportType === "http" ? "1px solid var(--accent)" : "1px solid var(--panel-border)",
                      background: formTransportType === "http" ? "var(--accent-soft)" : "rgba(255,255,255,0.4)",
                      color: formTransportType === "http" ? "var(--accent-strong)" : "var(--text-main)",
                      fontWeight: formTransportType === "http" ? 600 : 400,
                      cursor: "pointer",
                      fontSize: "13px",
                    }}
                    onClick={() => setFormTransportType("http")}
                  >
                    直连服务 (HTTP/SSE)
                  </button>
                </div>
              </div>

              {formTransportType === "stdio" ? (
                <>
                  <div className="mcp-form__field" style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <label className="mcp-form__label" style={{ fontSize: "12px", color: "var(--text-faint)", fontWeight: 500 }}>
                      启动命令 (Command)
                    </label>
                    <input
                      className="form-input"
                      placeholder="例如: npx, python, uv"
                      value={formCommand}
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
                      placeholder="例如:&#10;-y&#10;@modelcontextprotocol/server-sqlite"
                      value={formArgs}
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
                            onChange={(e) => {
                              const next = [...formEnv];
                              next[index].value = e.target.value;
                              setFormEnv(next);
                            }}
                          />
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
                        </div>
                      ))}
                      <button
                        type="button"
                        className="env-editor__add-btn"
                        style={{
                          alignSelf: "flex-start",
                          background: "rgba(255, 140, 0, 0.1)",
                          border: "1px dashed var(--accent)",
                          color: "var(--accent)",
                          padding: "4px 8px",
                          borderRadius: "4px",
                          fontSize: "12px",
                          cursor: "pointer",
                        }}
                        onClick={() => setFormEnv([...formEnv, { key: "", value: "" }])}
                      >
                        + 添加环境变量
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="mcp-form__field" style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <label className="mcp-form__label" style={{ fontSize: "12px", color: "var(--text-faint)", fontWeight: 500 }}>
                      直连类型 (Type)
                    </label>
                    <input
                      className="form-input"
                      placeholder="例如: streamable_http, sse"
                      value={formType}
                      onChange={(e) => setFormType(e.target.value)}
                    />
                  </div>

                  <div className="mcp-form__field" style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <label className="mcp-form__label" style={{ fontSize: "12px", color: "var(--text-faint)", fontWeight: 500 }}>
                      服务 URL (URL)
                    </label>
                    <input
                      className="form-input"
                      placeholder="例如: http://127.0.0.1:3845/mcp"
                      value={formUrl}
                      onChange={(e) => setFormUrl(e.target.value)}
                    />
                  </div>
                </>
              )}

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
                  style={{
                    background: "linear-gradient(135deg, var(--accent) 0%, #ff8c00 100%)",
                    border: "none",
                    color: "#fff",
                    padding: "6px 12px",
                    borderRadius: "6px",
                    fontWeight: 500,
                    cursor: "pointer",
                  }}
                  onClick={handleSaveMcp}
                >
                  {selectedMcpServerId === "__new__" ? "创建服务" : "保存修改"}
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <aside className="preview-column">
        <section
          className="panel preview-card"
          aria-labelledby="preview-title"
        >
          <div className="panel__header" style={{ display: "flex", flexDirection: "column", alignItems: "stretch", gap: "14px" }}>
            <div>
              <h2 className="panel__title" id="preview-title">
                最终 MCP 配置预览
              </h2>
              <p className="panel__subtitle">
                可按编辑器切换预览不同的最终配置结果，Codex 使用 TOML，其他编辑器使用 JSON。
              </p>
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                gap: "8px",
              }}
            >
              <span
                style={{
                  fontSize: "12px",
                  color: "var(--text-faint)",
                  fontWeight: 500,
                }}
              >
                当前预览
              </span>
              <div
                role="tablist"
                aria-label="MCP 预览编辑器切换"
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  justifyContent: "flex-start",
                  gap: "8px",
                }}
              >
                {editorIds.map((editorId) => {
                  const isSelected = previewEditorId === editorId;
                  return (
                    <button
                      key={`preview-tab-${editorId}`}
                      role="tab"
                      aria-selected={isSelected}
                      aria-controls="mcp-preview-code"
                      type="button"
                      onClick={() => setPreviewEditorId(editorId)}
                      style={{
                        padding: "6px 12px",
                        borderRadius: "999px",
                        border: isSelected
                          ? "1px solid rgba(197, 93, 51, 0.28)"
                          : "1px solid rgba(82, 63, 41, 0.1)",
                        background: isSelected
                          ? "rgba(255, 247, 240, 0.96)"
                          : "rgba(255, 255, 255, 0.5)",
                        color: isSelected ? "var(--accent-strong)" : "var(--text-soft)",
                        fontSize: "12px",
                        fontWeight: isSelected ? 600 : 500,
                        cursor: "pointer",
                        transition: "all 180ms ease",
                      }}
                    >
                      {editorMeta[editorId].title}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="preview-card__body" style={{ padding: "0 16px 16px 16px" }}>
            {previewEnabledMcp.length === 0 ? (
              <p className="preview-card__empty">
                {editorMeta[previewEditorId].title} 当前还没有启用任何 MCP 服务。请先在中间工作区开启后再查看。
              </p>
            ) : (
              <pre
                id="mcp-preview-code"
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
                <code>{previewEditorId === "codex" ? generatedMcpToml : generatedMcpJson}</code>
              </pre>
            )}
          </div>
        </section>
      </aside>
    </McpPanelRoot>
  );
}
