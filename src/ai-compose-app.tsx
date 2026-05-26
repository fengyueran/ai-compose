import { Message, Select, Button, Modal, type SelectOption } from "@xinghunm/compass-ui";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  applyPromptToEditorTarget,
  loadEditorTargetStates,
  applyMcpToEditorTarget,
  loadEditorMcpStates,
  loadEditorSkillsStates,
  loadEditorInstalledSkills,
  addSkillsRepository,
  linkSkillToEditor,
  loadSingleSkill,
  updateSkill,
  unlinkSkillFromEditor,
  type EditorId,
  isTauriRuntime,
} from "./editor-target-command";
import { composeManagedPromptBlock } from "./compose-prompt";
import "./ai-compose-app.css";
import { usePromptWorkbenchStore } from "./prompt-workbench-store";
import { isPresetSkillMatch } from "./skills-utils";

const configurationDomains = [
  { name: "Prompt", isAvailable: true },
  { name: "MCP", isAvailable: true },
  { name: "Skills", isAvailable: true },
  { name: "Profiles", isAvailable: false },
] as const;

type SkillsFilter = "all" | "local" | "cli";

const skillsFilterOptions: SelectOption[] = [
  { label: "全部", value: "all" },
  { label: "官方 / skills.sh", value: "cli" },
  { label: "本地已安装", value: "local" },
];

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

function renderSkillIcon(name: string, id: string) {
  const lowercaseName = name.toLowerCase();
  const lowercaseId = id.toLowerCase();
  const isBrowser = lowercaseName.includes("browser") ||
                    lowercaseName.includes("chrome") ||
                    lowercaseId.includes("browser") ||
                    lowercaseId.includes("chrome");

  if (isBrowser) {
    return (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--text-soft)" }}>
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="12" r="4" />
        <line x1="21.17" y1="8" x2="12" y2="8" />
        <line x1="3.95" y1="6.06" x2="8.54" y2="14" />
        <line x1="10.88" y1="21.94" x2="15.46" y2="14" />
      </svg>
    );
  }

  return (
    <svg width="28" height="28" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="topFaceGrad" x1="5" y1="11" x2="27" y2="11" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffd066" />
          <stop offset="100%" stopColor="#ff8f3d" />
        </linearGradient>
        <linearGradient id="leftFaceGrad" x1="5" y1="17" x2="16" y2="23" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ff4b82" />
          <stop offset="100%" stopColor="#ff85a7" />
        </linearGradient>
        <linearGradient id="rightFaceGrad" x1="16" y1="23" x2="27" y2="17" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#8d46f6" />
          <stop offset="100%" stopColor="#6358ff" />
        </linearGradient>
      </defs>
      <path d="M16 5L27 11L16 17L5 11Z" fill="url(#topFaceGrad)" />
      <path d="M5 11L16 17L16 29L5 23Z" fill="url(#leftFaceGrad)" />
      <path d="M16 17L27 11L27 23L16 29Z" fill="url(#rightFaceGrad)" />
    </svg>
  );
}

function AiComposeApp() {
  const [messageApi, messageContextHolder] = Message.useMessage();
  const messageApiRef = useRef(messageApi);

  useEffect(() => {
    messageApiRef.current = messageApi;
  }, [messageApi]);

  const {
    activeDomain,
    selectDomain,
    activeEditorId,
    editorStates,
    enabledFragmentIds,
    hydratePromptEditorStates,
    hydrateMcpEditorStates,
    hydrateSkillsEditorStates,
    isHydratingEditorStates,
    applyStatus,
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
    // Skills
    skills,
    selectedSkillId,
    skillsEditorStates,
    selectSkill,
    replaceSkill,
    setSkillsList,
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

  const selectedSkill = useMemo(
    () => skills.find((s) => s.id === selectedSkillId) ?? skills[0] ?? null,
    [skills, selectedSkillId],
  );

  const builtinSkills = useMemo(
    () => skills.filter((skill) => skill.isBuiltin),
    [skills],
  );
  const installedSkills = useMemo(
    () => skills.filter((skill) => skill.installed !== false),
    [skills],
  );

  const [skillsRepoInput, setSkillsRepoInput] = useState("");
  const [isAddingSkillsRepo, setIsAddingSkillsRepo] = useState(false);
  const [installHint, setInstallHint] = useState("");
  const [isUpdatingSkill, setIsUpdatingSkill] = useState(false);
  const [isRemovingSkill, setIsRemovingSkill] = useState(false);
  const [skillsQuery, setSkillsQuery] = useState("");
  const [skillsFilter, setSkillsFilter] = useState<SkillsFilter>("all");
  const [isSkillModalOpen, setIsSkillModalOpen] = useState(false);
  const [isSkillsListLoading, setIsSkillsListLoading] = useState(false);

  const isSkillsLoading = isHydratingEditorStates || isSkillsListLoading || isAddingSkillsRepo || isRemovingSkill || isUpdatingSkill;

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
    enabledMcp.forEach((server) => {
      if (server.transportType === 'http') {
        mcpServersObj[server.name] = {
          type: server.type || 'streamable_http',
          url: server.url || '',
        };
      } else {
        const entry: {
          command: string;
          args: string[];
          env?: Record<string, string>;
        } = {
          command: server.command || '',
          args: server.args || [],
        };
        if (server.env && Object.keys(server.env).length > 0) {
          entry.env = server.env;
        }
        mcpServersObj[server.name] = entry;
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
        if (server.transportType === 'http') {
          tomlStr += `type = "${server.type || 'streamable_http'}"\n`;
          tomlStr += `url = "${server.url || ''}"\n`;
        } else {
          tomlStr += `command = "${server.command || ''}"\n`;
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
  }, [enabledMcp]);

  const filteredSkills = useMemo(() => {
    const normalizedQuery = skillsQuery.trim().toLowerCase();

    return skills.filter((skill) => {
      const isCliManaged = skill.sourceKind === "cli";
      if (skillsFilter === "cli" && !isCliManaged) {
        return false;
      }
      if (skillsFilter === "local" && isCliManaged) {
        return false;
      }
      if (!normalizedQuery) {
        return true;
      }

      return [skill.id, skill.name, skill.description, skill.path]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [skills, skillsFilter, skillsQuery]);

  const groupedFilteredSkills = useMemo(() => {
    const builtin = filteredSkills.filter((skill) => skill.isBuiltin);
    const local = filteredSkills.filter((skill) => !skill.isBuiltin);

    return [
      { key: "builtin", title: "官方技能", skills: builtin },
      { key: "local", title: "本地技能", skills: local },
    ].filter((group) => group.skills.length > 0);
  }, [filteredSkills]);


  const activeSkillsTargetPath = skillsEditorStates[activeEditorId]?.targetPath ?? "";
  const activeEnabledSkillIds = skillsEditorStates[activeEditorId]?.enabledSkills ?? [];
  const selectedSkillTargetLink = selectedSkill && activeSkillsTargetPath
    ? `${activeSkillsTargetPath}/${selectedSkill.id}`
    : "";
  const isSelectedSkillCliManaged = selectedSkill?.sourceKind === "cli";
  const isSelectedSkillLinked = selectedSkill
    ? activeEnabledSkillIds.includes(selectedSkill.id)
    : false;
  const canInstallSelectedSkill = Boolean(
    selectedSkill &&
    !isSelectedSkillLinked &&
    (isSelectedSkillCliManaged || selectedSkill.isBuiltin)
  );
  const shouldShowSelectedSkillSourceBadge = Boolean(
    selectedSkill && (selectedSkill.isBuiltin || !isSelectedSkillCliManaged),
  );

  const refreshCurrentEditorSkills = async (editorId: EditorId) => {
    const installedSkills = await loadEditorInstalledSkills({ editorId });
    setSkillsList(installedSkills);
    return installedSkills;
  };

  const renderSkillRow = (skill: typeof skills[number]) => {
    const isSelected = skill.id === selectedSkillId;
    const isCliManaged = skill.sourceKind === "cli";
    const isLinkedToEditor = activeEnabledSkillIds.includes(skill.id);
    const shouldShowSourceBadge = skill.isBuiltin || !isCliManaged;

    const badgeText = skill.isBuiltin ? "官方" : "本地已安装";
    const badgeClass = skill.isBuiltin
      ? "skill-source-badge--builtin"
      : "skill-source-badge--readonly";

    return (
      <button
        key={skill.id}
        className={`skills-list-row${
          isSelected ? " skills-list-row--selected" : ""
        }`}
        onClick={() => {
          selectSkill(skill.id);
          setIsSkillModalOpen(true);
        }}
        type="button"
      >
        <div className="skill-card__icon-container">
          {renderSkillIcon(skill.name, skill.id)}
        </div>
        <div className="skills-list-row__content">
          <div className="skills-list-row__title-line">
            <span className="skills-list-row__title" title={skill.name}>
              {skill.name}
            </span>
            {shouldShowSourceBadge && (
              <span className={`skill-source-badge ${badgeClass}`}>
                {badgeText}
              </span>
            )}
          </div>
          <span className="skills-list-row__description" title={skill.description || "无描述"}>
            {skill.description || "无描述"}
          </span>
        </div>
        {isLinkedToEditor && (
          <span className="skill-card__status-check" aria-label="已安装">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </span>
        )}
      </button>
    );
  };

  // 表单状态，用于编辑/创建 MCP，基于 selectedMcpServerId 进行状态初始化
  const [formName, setFormName] = useState(() =>
    selectedMcpServer && selectedMcpServerId !== "__new__" ? selectedMcpServer.name : ""
  );
  const [formTransportType, setFormTransportType] = useState<'stdio' | 'http'>(() =>
    selectedMcpServer && selectedMcpServerId !== "__new__" ? (selectedMcpServer.transportType ?? "stdio") : "stdio"
  );
  const [formCommand, setFormCommand] = useState(() =>
    selectedMcpServer && selectedMcpServerId !== "__new__" ? (selectedMcpServer.command ?? "") : "npx"
  );
  const [formArgs, setFormArgs] = useState(() =>
    selectedMcpServer && selectedMcpServerId !== "__new__" ? (selectedMcpServer.args ?? []).join("\n") : ""
  );
  const [formEnv, setFormEnv] = useState<{ key: string; value: string }[]>(() =>
    selectedMcpServer && selectedMcpServerId !== "__new__"
      ? Object.entries(selectedMcpServer.env ?? {}).map(([key, value]) => ({ key, value }))
      : []
  );
  const [formType, setFormType] = useState(() =>
    selectedMcpServer && selectedMcpServerId !== "__new__" ? (selectedMcpServer.type ?? "streamable_http") : "streamable_http"
  );
  const [formUrl, setFormUrl] = useState(() =>
    selectedMcpServer && selectedMcpServerId !== "__new__" ? (selectedMcpServer.url ?? "") : ""
  );

  const handleSaveMcp = () => {
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
      messageApi.success("添加 MCP 服务成功！请点击右侧“应用配置”写入编辑器");
    } else {
      updateMcpServer(selectedMcpServer.id, mcpData);
      messageApi.success("修改 MCP 服务成功！请点击右侧“应用配置”写入编辑器");
    }
  };

  const handleDeleteMcp = async (id: string) => {
    deleteMcpServer(id);
    messageApi.loading({ content: "正在同步删除至编辑器配置...", key: "delete-mcp" });
    try {
      await applyToEditor(activeEditorId, isCurrentEditorEnabled);
      messageApi.success({ content: "删除 MCP 服务成功并已自动同步物理文件！", key: "delete-mcp" });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      messageApi.error({ content: `删除成功，但物理文件同步失败: ${errMsg}`, key: "delete-mcp" });
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
        const [nextPromptStates, nextMcpStates, nextSkillsStates] = await Promise.all([
          loadEditorTargetStates(),
          loadEditorMcpStates(),
          loadEditorSkillsStates(),
        ]);

        if (!isSubscribed) {
          return;
        }

        hydratePromptEditorStates(nextPromptStates);
        hydrateMcpEditorStates(nextMcpStates);
        hydrateSkillsEditorStates(nextSkillsStates);
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
    hydrateSkillsEditorStates,
    setSkillsList,
    setApplyFeedback,
    setEditorHydrationPending,
  ]);

  useEffect(() => {
    let isSubscribed = true;

    async function syncCurrentEditorSkills() {
      if (activeDomain !== "Skills") {
        return;
      }

      if (!isTauriRuntime()) {
        setIsSkillsListLoading(false);
        return;
      }

      setIsSkillsListLoading(true);
      try {
        const installedSkills = await loadEditorInstalledSkills({ editorId: activeEditorId });
        if (!isSubscribed) {
          return;
        }
        setSkillsList(installedSkills);
      } catch (error) {
        if (!isSubscribed) {
          return;
        }
        setSkillsList([]);
        messageApiRef.current.error(
          error instanceof Error
            ? error.message
            : "读取当前编辑器技能列表时发生未知错误。",
        );
      } finally {
        if (isSubscribed) {
          setIsSkillsListLoading(false);
        }
      }
    }

    void syncCurrentEditorSkills();

    return () => {
      isSubscribed = false;
    };
  }, [activeDomain, activeEditorId, setSkillsList]);

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
    } else if (activeDomain === "MCP") {
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
        
        const payloadMcpServers: Record<string, Record<string, unknown>> = {};
        enabledMcpLatest.forEach((s) => {
          if (s.transportType === 'http') {
            payloadMcpServers[s.name] = {
              type: s.type || 'streamable_http',
              url: s.url || '',
            };
          } else {
            payloadMcpServers[s.name] = {
              command: s.command || '',
              args: s.args || [],
            };
            if (s.env && Object.keys(s.env).length > 0) {
              payloadMcpServers[s.name].env = s.env;
            }
          }
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
    return null;
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
    } else if (activeDomain === "MCP") {
      if (nextEnabled && enabledMcp.length === 0) {
        setApplyFeedback({
          status: "error",
          message: `请至少启用一个 MCP 服务后再启用 ${editorMeta[editorId].title} 配置。`,
          lastAppliedAt: null,
        });
        return;
      }
    } else if (activeDomain === "Skills") {
      return;
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

        <div className={`workspace-grid${activeDomain === "Skills" ? " workspace-grid--skills" : ""}`}>
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
                      disabled={isHydratingEditorStates || activeDomain === "Skills"}
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

          <main className={`workbench${activeDomain === "Skills" ? " workbench--skills" : ""}`}>
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
            ) : activeDomain === "MCP" ? (
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
                                {server.transportType === 'http'
                                  ? server.url
                                  : `${(server.args ?? []).length} 个参数`}
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

                      {/* 传输协议类型选择 */}
                      <div className="mcp-form__field" style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        <label className="mcp-form__label" style={{ fontSize: "12px", color: "var(--text-faint)", fontWeight: 500 }}>
                          传输协议类型 (Transport Type)
                        </label>
                        <div style={{ display: "flex", gap: "12px", marginTop: "4px" }}>
                          <button
                            type="button"
                            disabled={isPresetServer || isExternalServer}
                            style={{
                              flex: 1,
                              padding: "8px 12px",
                              borderRadius: "8px",
                              border: formTransportType === "stdio" ? "1px solid var(--accent)" : "1px solid var(--panel-border)",
                              background: formTransportType === "stdio" ? "var(--accent-soft)" : "rgba(255,255,255,0.4)",
                              color: formTransportType === "stdio" ? "var(--accent-strong)" : "var(--text-main)",
                              fontWeight: formTransportType === "stdio" ? 600 : 400,
                              cursor: (isPresetServer || isExternalServer) ? "not-allowed" : "pointer",
                              fontSize: "13px",
                            }}
                            onClick={() => setFormTransportType("stdio")}
                          >
                            本地进程 (Stdio)
                          </button>
                          <button
                            type="button"
                            disabled={isPresetServer || isExternalServer}
                            style={{
                              flex: 1,
                              padding: "8px 12px",
                              borderRadius: "8px",
                              border: formTransportType === "http" ? "1px solid var(--accent)" : "1px solid var(--panel-border)",
                              background: formTransportType === "http" ? "var(--accent-soft)" : "rgba(255,255,255,0.4)",
                              color: formTransportType === "http" ? "var(--accent-strong)" : "var(--text-main)",
                              fontWeight: formTransportType === "http" ? 600 : 400,
                              cursor: (isPresetServer || isExternalServer) ? "not-allowed" : "pointer",
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
                              )}
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
                              disabled={isPresetServer || isExternalServer}
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
                              disabled={isPresetServer || isExternalServer}
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
                          disabled={isExternalServer}
                          style={{
                            background: isExternalServer 
                              ? "var(--surface-container-high)" 
                              : "linear-gradient(135deg, var(--accent) 0%, #ff8c00 100%)",
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
            ) : (
              <section className="panel skills-manager" aria-labelledby="skills-list-title">
                <div className="skills-manager__toolbar">
                  <div className="skills-manager__heading">
                    <div>
                      <h2 className="panel__title" id="skills-list-title">
                        当前编辑器 Skills
                      </h2>
                      <p className="panel__subtitle">
                        展示官方技能目录，以及当前 {editorMeta[activeEditorId].title} 已安装的本地技能；可从仓库安装并直接链接到当前编辑器。
                      </p>
                    </div>
                    <span className="chip">官方 {builtinSkills.length} 项 · 已安装 {installedSkills.length} 项</span>
                  </div>

                  <div className="skills-manager__controls">
                    <input
                      className="form-input skills-manager__search"
                      placeholder="搜索技能名称、描述或来源路径"
                      value={skillsQuery}
                      onChange={(event) => setSkillsQuery(event.target.value)}
                    />
                    <Select
                      className="skills-manager__filter-select"
                      classNames={{
                        trigger: "skills-manager__filter-trigger",
                        dropdown: "skills-manager__filter-dropdown",
                        option: "skills-manager__filter-option",
                      }}
                      value={skillsFilter}
                      options={skillsFilterOptions}
                      onChange={(value) => {
                        if (typeof value === "string") {
                          setSkillsFilter(value as SkillsFilter);
                        }
                      }}
                    />
                    <div className="skills-manager__install">
                      <input
                        className="form-input"
                        placeholder="安装仓库并链接到当前编辑器，如 vercel-labs/agent-skills"
                        value={skillsRepoInput}
                        onChange={(event) => setSkillsRepoInput(event.target.value)}
                      />
                      <Button
                        type="button"
                        className={`fragment-action-btn${isAddingSkillsRepo ? " fragment-action-btn--loading" : ""}`}
                        disabled={isRemovingSkill || isUpdatingSkill || !skillsRepoInput.trim()}
                        loading={isAddingSkillsRepo}
                        style={{ opacity: isAddingSkillsRepo || isRemovingSkill || isUpdatingSkill || !skillsRepoInput.trim() ? 0.6 : 1 }}
                        onClick={async () => {
                          if (!skillsRepoInput.trim()) return;
                          setIsAddingSkillsRepo(true);
                          try {
                            const installedSkills = await addSkillsRepository(skillsRepoInput.trim());
                            for (const skill of installedSkills) {
                              await linkSkillToEditor({
                                editorId: activeEditorId,
                                skillId: skill.id,
                                skillPath: skill.path,
                              });
                            }
                            const nextSkillsStates = await loadEditorSkillsStates();
                            hydrateSkillsEditorStates(nextSkillsStates);
                            await refreshCurrentEditorSkills(activeEditorId);
                            messageApi.success(
                              installedSkills.length > 0
                                ? `已安装并链接 ${installedSkills.length} 个技能到 ${editorMeta[activeEditorId].title}。`
                                : "仓库安装完成，但未检测到可链接的技能。",
                            );
                            setSkillsRepoInput("");
                          } catch (err) {
                            const errMsg = err instanceof Error ? err.message : String(err);
                            messageApi.error(`安装失败: ${errMsg}`);
                          } finally {
                            setIsAddingSkillsRepo(false);
                          }
                        }}
                      >
                        安装
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="skills-manager__body">
                  <div className="skills-list-pane">
                    <div className="skills-list-pane__summary">
                      <span>官方技能 {builtinSkills.length} 项 · 当前编辑器已安装 {installedSkills.length} 项</span>
                      <span>目标：{activeSkillsTargetPath || "未检测到目标路径"}</span>
                    </div>

                    <div className={`skills-list-rows${isSkillsLoading ? " skills-list-rows--loading" : ""}`}>
                      {isSkillsLoading && skills.length === 0 ? (
                        <div className="skills-list-loading">
                          <div className="skills-spinner" />
                          <span>正在加载技能列表...</span>
                        </div>
                      ) : skills.length === 0 ? (
                        <p className="skills-list-empty">
                          当前 {editorMeta[activeEditorId].title} 未安装任何技能。可在上方输入仓库名进行安装并链接。
                        </p>
                      ) : filteredSkills.length === 0 ? (
                        <p className="skills-list-empty">
                          没有匹配的技能。
                        </p>
                      ) : (
                        <div className="skills-list-groups">
                          {groupedFilteredSkills.map((group) => (
                            <section key={group.key} className="skills-list-group" aria-label={group.title}>
                              <div className="skills-list-group__header">
                                <h3 className="skills-list-group__title">{group.title}</h3>
                                <span className="skills-list-group__count">{group.skills.length} 项</span>
                              </div>
                              <div className="skills-list-group__rows">
                                {group.skills.map((skill) => renderSkillRow(skill))}
                              </div>
                            </section>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                </div>

                <Modal
                  isOpen={isSkillModalOpen}
                  onCancel={() => setIsSkillModalOpen(false)}
                  title={selectedSkill ? `技能详情: ${selectedSkill.name}` : "技能详情"}
                  footer={null}
                  width={720}
                >
                  {isSkillModalOpen && selectedSkill && (
                    <div className={`skills-detail-pane${
                      isRemovingSkill || isUpdatingSkill || isAddingSkillsRepo
                        ? " skills-detail-pane--loading"
                        : ""
                    }`}>
                      <div className="skills-detail-pane__header" style={{ borderBottom: "none", padding: "0 0 16px 0" }}>
                        <div>
                          {shouldShowSelectedSkillSourceBadge && (
                            <span className={`skill-source-badge ${
                              selectedSkill.isBuiltin
                                ? "skill-source-badge--builtin"
                                : "skill-source-badge--readonly"
                            }`}>
                              {selectedSkill.isBuiltin ? "官方" : "本地已安装"}
                            </span>
                          )}
                          <p className="skills-detail-pane__description" style={{ marginTop: "12px" }}>
                            {selectedSkill.description || "无描述"}
                          </p>
                        </div>
                        <div className="skills-detail-pane__actions">
                          {canInstallSelectedSkill ? (
                            <>
                             <Button
                              type="button"
                              className={`fragment-action-btn${isAddingSkillsRepo ? " fragment-action-btn--loading" : ""}`}
                              disabled={isAddingSkillsRepo}
                              loading={isAddingSkillsRepo}
                              onClick={async () => {
                                if (!selectedSkill) return;
                                const skillId = selectedSkill.id;
                                const skillName = selectedSkill.name;
                                const needsInstall = selectedSkill.installed === false;
                                setIsAddingSkillsRepo(true);
                                setInstallHint("");
                                const INSTALL_TIMEOUT_MS = 90_000;
                                try {
                                  let skillPath = selectedSkill.path;
                                  if (needsInstall) {
                                    if (!selectedSkill.repoSource) {
                                      throw new Error("缺少可安装的技能来源。");
                                    }
                                    setInstallHint("正在下载安装，通常需要 30～60 秒…");
                                    const timeoutPromise = new Promise<never>((_, reject) =>
                                      setTimeout(() => reject(new Error("安装超时（超过 90 秒），请检查网络或稍后重试。")), INSTALL_TIMEOUT_MS)
                                    );
                                    const installedSkills = await Promise.race([
                                      addSkillsRepository(selectedSkill.repoSource),
                                      timeoutPromise,
                                    ]);
                                    setInstallHint("安装完成，正在链接到当前编辑器…");
                                    const installedSkill = installedSkills.find((skill) =>
                                      isPresetSkillMatch(skill.id, skillId),
                                    );
                                    if (!installedSkill) {
                                      throw new Error(`安装完成后未找到技能 ${skillName} 的物理路径。`);
                                    }
                                    skillPath = installedSkill.path;
                                  }
                                  await linkSkillToEditor({
                                    editorId: activeEditorId,
                                    skillId,
                                    skillPath,
                                  });
                                  const nextSkillsStates = await loadEditorSkillsStates();
                                  hydrateSkillsEditorStates(nextSkillsStates);
                                  await refreshCurrentEditorSkills(activeEditorId);
                                  setIsSkillModalOpen(false);
                                  messageApi.success(
                                    needsInstall
                                      ? `已安装并链接技能 ${skillName} 到 ${editorMeta[activeEditorId].title}。`
                                      : `已将技能 ${skillName} 链接到 ${editorMeta[activeEditorId].title}。`,
                                  );
                                } catch (err) {
                                  const errMsg = err instanceof Error ? err.message : String(err);
                                  messageApi.error(`安装技能 ${skillName} 失败: ${errMsg}`);
                                } finally {
                                  setIsAddingSkillsRepo(false);
                                }
                              }}
                            >
                              安装
                            </Button>
                            {isAddingSkillsRepo && installHint && (
                              <span style={{ fontSize: "12px", color: "var(--text-faint)", alignSelf: "center", whiteSpace: "nowrap" }}>
                                {installHint}
                              </span>
                            )}
                          </>) : (
                            <>
                              <Button
                                type="button"
                                className={`fragment-action-btn${isRemovingSkill ? " fragment-action-btn--loading" : ""}`}
                                disabled={isUpdatingSkill || isAddingSkillsRepo || !isSelectedSkillCliManaged || !isSelectedSkillLinked}
                                loading={isRemovingSkill}
                                title={!isSelectedSkillCliManaged
                                  ? "本地已安装的 Skill 不受 skills.sh 管理，不能取消链接。"
                                  : !isSelectedSkillLinked
                                    ? `当前 ${editorMeta[activeEditorId].title} 未链接此 Skill。`
                                    : `取消 ${editorMeta[activeEditorId].title} 中此 Skill 的软链接。`}
                                onClick={async () => {
                                  if (!selectedSkill) return;
                                  const skillId = selectedSkill.id;
                                  const skillName = selectedSkill.name;
                                  setIsRemovingSkill(true);
                                  try {
                                    await unlinkSkillFromEditor({
                                      editorId: activeEditorId,
                                      skillId,
                                    });
                                    const nextSkillsStates = await loadEditorSkillsStates();
                                    hydrateSkillsEditorStates(nextSkillsStates);
                                    await refreshCurrentEditorSkills(activeEditorId);
                                    setIsSkillModalOpen(false);
                                    messageApi.success(`已取消技能 ${skillName} 在 ${editorMeta[activeEditorId].title} 中的链接。`);
                                  } catch (err) {
                                    const errMsg = err instanceof Error ? err.message : String(err);
                                    messageApi.error(`取消技能 ${skillName} 链接失败: ${errMsg}`);
                                  } finally {
                                    setIsRemovingSkill(false);
                                  }
                                }}
                              >
                                取消链接
                              </Button>
                              <Button
                                type="button"
                                className={`fragment-action-btn${isUpdatingSkill ? " fragment-action-btn--loading" : ""}`}
                                disabled={isRemovingSkill || isAddingSkillsRepo || !isSelectedSkillCliManaged}
                                loading={isUpdatingSkill}
                                title={!isSelectedSkillCliManaged ? "本地已安装的 Skill 不受 skills.sh 管理，不能在这里更新。" : undefined}
                                onClick={async () => {
                                  if (!selectedSkill) return;
                                  const skillId = selectedSkill.id;
                                  const skillPath = selectedSkill.path;
                                  const skillSourceKind = selectedSkill.sourceKind;
                                  setIsUpdatingSkill(true);
                                  try {
                                    await updateSkill(skillId);
                                    const refreshedSkill = await loadSingleSkill({
                                      id: skillId,
                                      path: skillPath,
                                      sourceKind: skillSourceKind,
                                    });
                                    replaceSkill(refreshedSkill);
                                    messageApi.success(`技能 ${selectedSkill.name} 更新成功！`);
                                  } catch (err) {
                                    const errMsg = err instanceof Error ? err.message : String(err);
                                    messageApi.error(`更新失败: ${errMsg}`);
                                  } finally {
                                    setIsUpdatingSkill(false);
                                  }
                                }}
                              >
                                更新
                              </Button>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="skills-detail-pane__body" style={{ borderTop: "1px solid var(--panel-border)", paddingTop: "16px" }}>
                        <p className="skills-detail-pane__path">
                          <strong>来源类型：</strong>
                          {selectedSkill.isBuiltin
                            ? (selectedSkill.installed
                              ? "官方技能（已安装，可通过 skills.sh 管理）"
                              : "官方技能（未安装，请先安装）")
                            : (isSelectedSkillCliManaged
                              ? "skills.sh 管理，可创建目标软链接"
                              : "本地/目标目录扫描，只读")}
                        </p>
                        <p className="skills-detail-pane__path">
                          <strong>物理来源路径：</strong>
                          {selectedSkill.isBuiltin && !selectedSkill.installed
                            ? "未安装，暂无物理路径"
                            : selectedSkill.path}
                        </p>
                        <p className="skills-detail-pane__path">
                          <strong>目标软链接：</strong>
                          {selectedSkill.isBuiltin && !selectedSkill.installed
                            ? "未安装，暂不可创建软链接"
                            : (isSelectedSkillCliManaged
                              ? (selectedSkillTargetLink || "未检测到目标路径")
                              : "本地已安装项不创建目标软链接")}
                        </p>
                        <pre className="skills-detail-pane__markdown" style={{ marginTop: "16px" }}>
                          <code>{selectedSkill.content || "(SKILL.md 内容为空)"}</code>
                        </pre>
                      </div>
                    </div>
                  )}
                </Modal>

              </section>
            )}
          </main>

          {activeDomain !== "Skills" ? (
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
                    className={`preview-apply-btn${isCurrentEditorEnabled && applyStatus !== "pending" ? "" : " preview-apply-btn--disabled"}`}
                    onClick={handleApplyClick}
                    disabled={!isCurrentEditorEnabled || applyStatus === "pending"}
                    title={isCurrentEditorEnabled ? `应用 Prompt 配置到 ${editorMeta[activeEditorId].title}` : `请先启用左侧 ${editorMeta[activeEditorId].title}`}
                  >
                    {applyStatus === "pending" ? "正在应用..." : "应用配置"}
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
            ) : activeDomain === "MCP" ? (
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
                    className={`preview-apply-btn${isCurrentEditorEnabled && applyStatus !== "pending" ? "" : " preview-apply-btn--disabled"}`}
                    onClick={handleApplyClick}
                    disabled={!isCurrentEditorEnabled || applyStatus === "pending"}
                    title={isCurrentEditorEnabled ? `应用 MCP 配置到 ${editorMeta[activeEditorId].title}` : `请先启用左侧 ${editorMeta[activeEditorId].title}`}
                  >
                    {applyStatus === "pending" ? "正在应用..." : "应用配置"}
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
            ) : (
              <section
                className="panel preview-card"
                aria-labelledby="preview-title"
              >
                <div className="panel__header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
                  <div>
                    <h2 className="panel__title" id="preview-title">
                      Skills 链接预览
                    </h2>
                    <p className="panel__subtitle">
                      展示当前 {editorMeta[activeEditorId].title} 已链接的技能软链接。
                    </p>
                  </div>
                </div>

                <div className="preview-card__body" style={{ padding: "0 16px 16px 16px" }}>
                  {activeEnabledSkillIds.length === 0 ? (
                    <p className="preview-card__empty">
                      当前未在此编辑器中链接任何技能。
                    </p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      <p style={{ fontSize: "12px", color: "var(--text-faint)", margin: 0 }}>
                        目标路径: <strong>{skillsEditorStates[activeEditorId]?.targetPath || "—"}</strong>
                      </p>
                      {activeEnabledSkillIds.map((skillId) => {
                        const skill = skills.find((s) => s.id === skillId);
                        return (
                          <div
                            key={skillId}
                            style={{
                              background: "rgba(0, 0, 0, 0.15)",
                              padding: "10px 12px",
                              borderRadius: "8px",
                              fontSize: "13px",
                              color: "var(--text-bright)",
                              fontFamily: "monospace",
                            }}
                          >
                            <div style={{ fontWeight: 600, marginBottom: "4px" }}>
                              {skill?.name ?? skillId}
                            </div>
                            <div style={{ fontSize: "11px", color: "var(--text-faint)", wordBreak: "break-all" }}>
                              {skill?.path ?? "未知路径"} → {skillsEditorStates[activeEditorId]?.targetPath}/{skillId}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </section>
            )}
          </aside>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default AiComposeApp;
