import { Message, Select, Button, Modal, type SelectOption } from "@xinghunm/compass-ui";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  applyPromptToEditorTarget,
  loadEditorTargetStates,
  applyMcpToEditorTarget,
  loadEditorMcpStates,
  loadEditorSkillsStates,
  loadEditorInstalledSkills,
  loadPhysicalSkills,
  loadSkillsFromDir,
  addSkillsRepository,
  linkSkillToEditor,
  loadSingleSkill,
  updateSkill,
  unlinkSkillFromEditor,
  openExternalUrl,
  openLocalPath,
  revealLocalPath,
  selectDirectory,
  normalizeRepoSource,
  type EditorId,
  type SkillInfo,
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

type SkillsFilter = "all" | "linked" | "unlinked";

const skillsFilterOptions: SelectOption[] = [
  { label: "全部", value: "all" },
  { label: "已链接", value: "linked" },
  { label: "未链接", value: "unlinked" },
];

function getSkillSourceBadgeMeta(
  skill: SkillInfo,
  skillSources: import("./editor-target-command").SkillSource[],
): { text: string; className: string } {
  // 官方预设
  if (skill.isBuiltin) {
    return { text: "官方", className: "skill-source-badge--builtin" };
  }

  // 匹配用户自定义 repo 源
  const matchedRepo = skillSources.find(
    (src) =>
      src.type === "repo" &&
      skill.repoSource &&
      normalizeRepoSource(skill.repoSource) === normalizeRepoSource(src.value),
  );
  if (matchedRepo) {
    return { text: "第三方", className: "skill-source-badge--repository" };
  }

  // 匹配用户自定义本地源
  const matchedLocal = skillSources.find(
    (src) =>
      src.type === "local" &&
      skill.path &&
      skill.path.toLowerCase().startsWith(src.value.toLowerCase()),
  );
  if (matchedLocal) {
    return { text: matchedLocal.name || "本地", className: "skill-source-badge--readonly" };
  }

  // 其他（全局 CLI 安装等）——不打带子，使用空白并起到占位
  return { text: "本地", className: "skill-source-badge--readonly" };
}

function getSkillRepoUrl(repoSource: string): string {
  return `https://github.com/${repoSource}`;
}

async function openSkillRepoUrl(url: string): Promise<void> {
  if (isTauriRuntime()) {
    await openExternalUrl(url);
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

async function openSkillLocalPath(path: string): Promise<void> {
  if (isTauriRuntime()) {
    await openLocalPath(path);
    return;
  }
  window.open(`file://${path}`, "_blank", "noopener,noreferrer");
}

async function revealSkillLocalPath(path: string): Promise<void> {
  if (isTauriRuntime()) {
    await revealLocalPath(path);
    return;
  }

  const normalizedPath = path.replace(/\/+$/, "");
  const parentPath = normalizedPath.includes("/")
    ? normalizedPath.slice(0, normalizedPath.lastIndexOf("/")) || "/"
    : normalizedPath;
  window.open(`file://${parentPath}`, "_blank", "noopener,noreferrer");
}

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
    promptEditorStates,
    mcpEditorStates,
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
    mcpEnabledServerIdsByEditor,
    selectedMcpServerId,
    selectMcpServer,
    toggleMcpServerForEditor,
    addMcpServer,
    updateMcpServer,
    deleteMcpServer,
    // Skills
    skills,
    selectedSkillId,
    skillsEditorStates,
    selectSkill,
    toggleSkillForEditor,
    replaceSkill,
    setSkillsList,
    skillSources,
    selectedSkillSourceId,
    addSkillSource,
    deleteSkillSource,
    selectSkillSource,
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

  const activeEnabledMcpIds = useMemo(
    () => mcpEnabledServerIdsByEditor[activeEditorId] ?? [],
    [mcpEnabledServerIdsByEditor, activeEditorId],
  );

  const enabledMcp = useMemo(
    () => mcpServers.filter((server) => activeEnabledMcpIds.includes(server.id)),
    [mcpServers, activeEnabledMcpIds],
  );

  const selectedSkill = useMemo(
    () => skills.find((s) => s.id === selectedSkillId) ?? skills[0] ?? null,
    [skills, selectedSkillId],
  );

  const installedSkills = useMemo(
    () => skills.filter((skill) => skill.installed !== false),
    [skills],
  );

  const [isAddingSkillsRepo, setIsAddingSkillsRepo] = useState(false);
  const [isUpdatingSkill, setIsUpdatingSkill] = useState(false);
  const [isRemovingSkill, setIsRemovingSkill] = useState(false);
  const [skillsQuery, setSkillsQuery] = useState("");
  const [skillsFilter, setSkillsFilter] = useState<SkillsFilter>("all");
  const [isSkillModalOpen, setIsSkillModalOpen] = useState(false);
  const [isSkillsListLoading, setIsSkillsListLoading] = useState(false);
  const [pendingMcpToggleKey, setPendingMcpToggleKey] = useState<string | null>(null);

  // Skills Sources
  const [isAddSourceModalOpen, setIsAddSourceModalOpen] = useState(false);
  const [newSourceName, setNewSourceName] = useState("");
  const [newSourceType, setNewSourceType] = useState<"repo" | "local">("repo");
  const [newSourceValue, setNewSourceValue] = useState("");

  const isSkillsLoading = isHydratingEditorStates || isSkillsListLoading || isAddingSkillsRepo || isRemovingSkill || isUpdatingSkill;

  const activeSkillsTargetPath = skillsEditorStates[activeEditorId]?.targetPath ?? "";
  const activeEnabledSkillIds = useMemo(
    () => skillsEditorStates[activeEditorId]?.enabledSkills ?? [],
    [skillsEditorStates, activeEditorId],
  );
  const canToggleEditorsInDomain = activeDomain === "Prompt";

  const selectedSource = useMemo(() => {
    return skillSources.find((s) => s.id === selectedSkillSourceId) || skillSources[0];
  }, [skillSources, selectedSkillSourceId]);

  const filteredSkills = useMemo(() => {
    const normalizedQuery = skillsQuery.trim().toLowerCase();

    return skills.filter((skill) => {
      const matchesSelectedSource = selectedSource.type === "all"
        ? true
        : selectedSource.type === "preset"
          ? !!skill.isBuiltin
          : selectedSource.type === "repo"
            ? normalizeRepoSource(skill.repoSource || "") === normalizeRepoSource(selectedSource.value)
            : !!skill.path && skill.path.toLowerCase().startsWith(selectedSource.value.toLowerCase());

      // 0. 基础范围：官方预设始终显示；已链接技能始终显示；
      // 选中具体 repo / 本地源时，也允许显示该源下已同步但未链接到当前编辑器的技能。
      const isLinked = activeEnabledSkillIds.includes(skill.id);
      const canShowUnlinkedSourceSkill = selectedSource.type === "repo" || selectedSource.type === "local";
      if (!skill.isBuiltin && !isLinked && !(canShowUnlinkedSourceSkill && matchesSelectedSource)) {
        return false;
      }

      // 1. Filter by selected source
      if (!matchesSelectedSource) {
        return false;
      }

      // 2. Filter by link status
      if (skillsFilter === "linked" && !isLinked) {
        return false;
      }
      if (skillsFilter === "unlinked" && isLinked) {
        return false;
      }

      // 3. Filter by search query
      if (!normalizedQuery) {
        return true;
      }

      return [skill.id, skill.name, skill.description, skill.path]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [skills, selectedSource, skillsFilter, skillsQuery, activeEnabledSkillIds]);
  const selectedSkillTargetLink = selectedSkill && activeSkillsTargetPath
    ? `${activeSkillsTargetPath}/${selectedSkill.id}`
    : "";
  const selectedSkillPhysicalPath = selectedSkill?.isBuiltin && !selectedSkill.installed
    ? ""
    : (selectedSkill?.path || "");
  const selectedSkillLinkPath = selectedSkill?.isBuiltin && !selectedSkill.installed
    ? ""
    : (selectedSkillTargetLink || selectedSkill?.path || "");
  const isSelectedSkillCliManaged = selectedSkill?.sourceKind === "cli";
  const isSelectedSkillLinked = selectedSkill
    ? activeEnabledSkillIds.includes(selectedSkill.id)
    : false;
  const canInstallSelectedSkill = Boolean(
    selectedSkill &&
    !isSelectedSkillLinked &&
    (isSelectedSkillCliManaged || selectedSkill.isBuiltin)
  );
  const shouldShowSelectedSkillSourceBadge = Boolean(selectedSkill);

  const refreshCurrentEditorSkills = async (editorId: EditorId) => {
    const [editorSkills, globalSkills] = await Promise.all([
      loadEditorInstalledSkills({ editorId }),
      loadPhysicalSkills(),
    ]);

    const localSources = skillSources.filter((s) => s.type === "local");
    const localSkillsPromises = localSources.map(async (src) => {
      try {
        return await loadSkillsFromDir(src.value);
      } catch (e) {
        console.error(`Failed to load skills from local source ${src.value}`, e);
        return [];
      }
    });
    const localSkillsLists = await Promise.all(localSkillsPromises);
    const allLocalSkills = localSkillsLists.flat();

    const mergedMap = new Map<string, SkillInfo>();
    globalSkills.forEach((s) => mergedMap.set(s.id, s));
    allLocalSkills.forEach((s) => mergedMap.set(s.id, s));
    editorSkills.forEach((s) => mergedMap.set(s.id, s));

    const combinedSkills = Array.from(mergedMap.values());
    setSkillsList(combinedSkills);
    return combinedSkills;
  };

  const editorIds = Object.keys(editorMeta) as EditorId[];

  const getEnabledMcpIdsForEditor = (editorId: EditorId) =>
    mcpEnabledServerIdsByEditor[editorId] ?? [];

  const isMcpEnabledForEditor = (editorId: EditorId, serverId: string) =>
    getEnabledMcpIdsForEditor(editorId).includes(serverId);

  const buildMcpPayload = (
    enabledIds: string[],
    sourceServers: typeof mcpServers = mcpServers,
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
    sourceServers?: typeof mcpServers,
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

  const isSkillLinkedToEditor = (editorId: EditorId, skillId: string) =>
    skillsEditorStates[editorId]?.enabledSkills.includes(skillId) ?? false;

  const isSkillToggleReadOnly = (skill: SkillInfo) =>
    skill.sourceKind === "fallbackDirectory";

  const handleSkillEditorToggle = async (
    skill: SkillInfo,
    editorId: EditorId,
  ) => {
    if (isSkillToggleReadOnly(skill)) {
      return;
    }

    const isLinked = isSkillLinkedToEditor(editorId, skill.id);

    if (isLinked) {
      setIsRemovingSkill(true);
      try {
        await unlinkSkillFromEditor({
          editorId,
          skillId: skill.id,
        });
        const nextSkillsStates = await loadEditorSkillsStates();
        hydrateSkillsEditorStates(nextSkillsStates);
        await refreshCurrentEditorSkills(activeEditorId);
        messageApi.success(`已取消 ${skill.name} 在 ${editorMeta[editorId].title} 中的链接。`);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        messageApi.error(`取消链接失败: ${errMsg}`);
      } finally {
        setIsRemovingSkill(false);
      }
      return;
    }

    setIsAddingSkillsRepo(true);
    try {
      let skillPath = skill.path;

      if (skill.installed === false) {
        if (!skill.repoSource) {
          throw new Error("缺少可安装的技能来源。");
        }

        const installedSkills = await addSkillsRepository(skill.repoSource);
        const installedSkill = installedSkills.find((item) =>
          isPresetSkillMatch(item.id, skill.id),
        );

        if (!installedSkill) {
          throw new Error(`安装完成后未找到技能 ${skill.name} 的物理路径。`);
        }

        skillPath = installedSkill.path;
      }

      if (!skillPath) {
        throw new Error("缺少技能物理路径，无法创建链接。");
      }

      await linkSkillToEditor({
        editorId,
        skillId: skill.id,
        skillPath,
      });

      const nextSkillsStates = await loadEditorSkillsStates();
      hydrateSkillsEditorStates(nextSkillsStates);
      await refreshCurrentEditorSkills(activeEditorId);
      messageApi.success(`已将 ${skill.name} 链接到 ${editorMeta[editorId].title}。`);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      messageApi.error(`链接技能失败: ${errMsg}`);
    } finally {
      setIsAddingSkillsRepo(false);
    }
  };

  const renderSkillRow = (skill: typeof skills[number]) => {
    const isSelected = skill.id === selectedSkillId;
    const isLinkedToEditor = activeEnabledSkillIds.includes(skill.id);
    const badgeMeta = getSkillSourceBadgeMeta(skill, skillSources);

    return (
      <div
        key={skill.id}
        className={`skills-list-row${
          isSelected ? " skills-list-row--selected" : ""
        }`}
      >
        <button
          className="skills-list-row__select"
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
              <span className={`skill-source-badge ${badgeMeta.className}`}>
                {badgeMeta.text}
              </span>
            </div>
            <span className="skills-list-row__description" title={skill.description || "无描述"}>
              {skill.description || "无描述"}
            </span>
          </div>
        </button>
        <div className="per-editor-switches" onClick={(event) => event.stopPropagation()}>
          {editorIds.map((editorId) => {
            const isLinked = isSkillLinkedToEditor(editorId, skill.id);
            const isReadOnly = isSkillToggleReadOnly(skill);

            return (
              <button
                key={`${skill.id}-${editorId}`}
                type="button"
                className={`per-editor-switch${
                  isLinked ? " per-editor-switch--enabled" : ""
                }${isReadOnly ? " per-editor-switch--readonly" : ""}`}
                aria-pressed={isLinked}
                disabled={isReadOnly || isAddingSkillsRepo || isRemovingSkill}
                onClick={() => {
                  void handleSkillEditorToggle(skill, editorId);
                }}
                title={`${editorMeta[editorId].title}${isLinked ? " 已链接" : " 未链接"}`}
              >
                <span className="per-editor-switch__label">
                  {editorMeta[editorId].title}
                </span>
                <span className="per-editor-switch__track">
                  <span className="per-editor-switch__thumb" />
                </span>
              </button>
            );
          })}
        </div>
        {isLinkedToEditor && (
          <span className="skill-card__status-check" aria-label="已安装">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </span>
        )}
      </div>
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
      messageApi.success("添加 MCP 服务成功。可继续为不同编辑器开启后自动同步。");
    } else {
      updateMcpServer(selectedMcpServer.id, mcpData);

      const latestStore = usePromptWorkbenchStore.getState();
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
      await applyToEditor(activeEditorId, nextEnabledCount > 0);
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
        const [editorSkills, globalSkills] = await Promise.all([
          loadEditorInstalledSkills({ editorId: activeEditorId }),
          loadPhysicalSkills(),
        ]);

        const localSources = skillSources.filter((s) => s.type === "local");
        const localSkillsPromises = localSources.map(async (src) => {
          try {
            return await loadSkillsFromDir(src.value);
          } catch (e) {
            console.error(`Failed to load skills from local source ${src.value}`, e);
            return [];
          }
        });
        const localSkillsLists = await Promise.all(localSkillsPromises);
        const allLocalSkills = localSkillsLists.flat();

        const mergedMap = new Map<string, SkillInfo>();
        globalSkills.forEach((s) => mergedMap.set(s.id, s));
        allLocalSkills.forEach((s) => mergedMap.set(s.id, s));
        editorSkills.forEach((s) => mergedMap.set(s.id, s));

        if (!isSubscribed) {
          return;
        }
        setSkillsList(Array.from(mergedMap.values()));
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
  }, [activeDomain, activeEditorId, setSkillsList, skillSources]);

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
        const latestStore = usePromptWorkbenchStore.getState();
        const enabledMcpIdsForEditor = latestStore.mcpEnabledServerIdsByEditor[editorId] ?? [];
        const { enabledServers, payloadData } = buildMcpPayload(enabledMcpIdsForEditor);

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
              ? `已成功写入 ${result.targetPath}，当前共更新 ${enabledServers.length} 个 MCP 服务。`
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

  const isCurrentPromptEditorEnabled = promptEditorStates[activeEditorId]?.enabled ?? false;

  const handleApplyClick = async () => {
    if (activeDomain === "Prompt" && !isCurrentPromptEditorEnabled) {
      messageApi.warning(`请先在当前配置域中启用 ${editorMeta[activeEditorId].title}`);
      return;
    }
    const result = await applyToEditor(
      activeEditorId,
      activeDomain === "MCP" ? enabledMcp.length > 0 : true,
    );
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
    } else if (activeDomain === "MCP" || activeDomain === "Skills") {
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

  const getDomainEditorCardMeta = (editorId: EditorId) => {
    if (activeDomain === "Skills") {
      const linkedSkillsCount = skillsEditorStates[editorId]?.enabledSkills.length ?? 0;
      return {
        detail:
          skillsEditorStates[editorId]?.targetPath || "未检测到 Skills 目标目录",
        status: linkedSkillsCount > 0 ? `已链接 ${linkedSkillsCount} 项` : "未链接技能",
      };
    }

    if (activeDomain === "MCP") {
      const enabledCount = getEnabledMcpIdsForEditor(editorId).length;
      return {
        detail:
          mcpEditorStates[editorId]?.targetPath || "未检测到 MCP 配置文件",
        status: enabledCount > 0 ? `已启用 ${enabledCount} 项` : "未启用服务",
      };
    }

    return {
      detail:
        promptEditorStates[editorId]?.enabled
          ? "受管 Prompt 已启用"
          : "点击开关后写入受管 Prompt",
      status: promptEditorStates[editorId]?.enabled ? "已启用" : "已关闭",
    };
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

        <div className={`workspace-grid${activeDomain === "Prompt" ? "" : " workspace-grid--skills"}`}>
          <aside className="panel side-nav" aria-label="工作台导航">
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

          <main className={`workbench${activeDomain === "Prompt" ? " workbench--with-editor-panel" : " workbench--skills"}`}>
            {activeDomain === "Prompt" ? (
              <section
                className="panel domain-editor-panel"
                aria-labelledby="domain-editor-panel-title"
              >
                <div className="panel__header">
                  <div>
                    <h2 className="panel__title" id="domain-editor-panel-title">
                      当前配置域编辑器
                    </h2>
                    <p className="panel__subtitle">
                      先选择目标编辑器，再分别开关每个编辑器的 Prompt 受管配置。
                    </p>
                  </div>
                  <span className="chip chip--accent">
                    当前 {editorMeta[activeEditorId].title}
                  </span>
                </div>

                <div className="domain-editor-panel__grid">
                  {editorIds.map((editorId) => {
                    const isSelected = activeEditorId === editorId;
                    const { detail, status } = getDomainEditorCardMeta(editorId);

                    return (
                      <div
                        key={editorId}
                        className={`domain-editor-card${
                          isSelected ? " domain-editor-card--active" : ""
                        }`}
                      >
                        <button
                          className="domain-editor-card__select"
                          onClick={() => selectEditor(editorId)}
                          type="button"
                        >
                          <div className="domain-editor-card__title-row">
                            <span className="domain-editor-card__title">
                              {editorMeta[editorId].title}
                            </span>
                            {isSelected ? (
                              <span className="domain-editor-card__badge">
                                当前查看
                              </span>
                            ) : null}
                          </div>
                          <span className="domain-editor-card__status">{status}</span>
                          <span
                            className="domain-editor-card__detail"
                            title={detail}
                          >
                            {detail}
                          </span>
                        </button>

                        {canToggleEditorsInDomain ? (
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
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </section>
            ) : null}

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
                        MCP 服务列表
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
                      <p className="panel__subtitle">
                        配置并启用 MCP 服务器以扩充模型上下文能力。
                      </p>
                    </div>
                    {selectedMcpServerId !== "__new__" && selectedMcpServer && (
                      <div className="mcp-detail-switches">
                        <span className="mcp-detail-switches__hint">
                          仅控制当前 MCP 在各编辑器中的启用状态
                        </span>
                        <div className="per-editor-switches per-editor-switches--detail">
                          {editorIds.map((editorId) => {
                            const isEnabled = isMcpEnabledForEditor(editorId, selectedMcpServer.id);

                            return (
                              <button
                                key={`detail-${selectedMcpServer.id}-${editorId}`}
                                type="button"
                                className={`per-editor-switch${
                                  isEnabled ? " per-editor-switch--enabled" : ""
                                }`}
                                aria-pressed={isEnabled}
                                disabled={pendingMcpToggleKey === `${editorId}:${selectedMcpServer.id}`}
                                onClick={() => {
                                  void handleMcpEditorToggle(editorId, selectedMcpServer.id);
                                }}
                                title={`${editorMeta[editorId].title}${isEnabled ? " 已启用" : " 未启用"}`}
                              >
                                <span className="per-editor-switch__label">
                                  {editorMeta[editorId].title}
                                </span>
                                <span className="per-editor-switch__track">
                                  <span className="per-editor-switch__thumb" />
                                </span>
                              </button>
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
                              placeholder="例如:
-y
@modelcontextprotocol/server-sqlite"
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
                        管理已链接的技能，添加第三方仓库或本地物理目录作为技能源。
                      </p>
                    </div>
                    <span className="chip">已安装/已链接 {installedSkills.length} 项技能</span>
                  </div>
                </div>

                <div className="skills-manager__body">
                  <div className="skills-source-pane">
                    <div className="skills-source-pane__header">
                      <span className="skills-source-pane__title">技能源</span>
                      <button
                        type="button"
                        className="fragment-action-btn"
                        style={{ minHeight: "28px", padding: "0 8px", fontSize: "11px" }}
                        onClick={() => {
                          setNewSourceName("");
                          setNewSourceType("repo");
                          setNewSourceValue("");
                          setIsAddSourceModalOpen(true);
                        }}
                      >
                        + 添加源
                      </button>
                    </div>
                    <div className="skills-source-items">
                      {skillSources.map((source) => {
                        const isSelected = source.id === selectedSkillSourceId;
                        return (
                          <div
                            key={source.id}
                            className={`skills-source-item${isSelected ? " skills-source-item--selected" : ""}`}
                            onClick={() => selectSkillSource(source.id)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                selectSkillSource(source.id);
                              }
                            }}
                          >
                            <div className="skills-source-item__icon">
                              {source.type === "all" ? (
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <rect x="3" y="3" width="7" height="7" />
                                  <rect x="14" y="3" width="7" height="7" />
                                  <rect x="3" y="14" width="7" height="7" />
                                  <rect x="14" y="14" width="7" height="7" />
                                </svg>
                              ) : source.type === "preset" ? (
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2" />
                                  <line x1="12" y1="22" x2="12" y2="15.5" />
                                  <polyline points="22 8.5 12 15.5 2 8.5" />
                                  <polyline points="2 15.5 12 8.5 22 15.5" />
                                  <line x1="12" y1="2" x2="12" y2="8.5" />
                                </svg>
                              ) : source.type === "repo" ? (
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
                                </svg>
                              ) : (
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                                </svg>
                              )}
                            </div>
                            <div className="skills-source-item__info">
                              <span className="skills-source-item__name">{source.name}</span>
                              {source.value && (
                                <span className="skills-source-item__value" title={source.value}>
                                  {source.value}
                                </span>
                              )}
                            </div>
                            {source.type !== "preset" && source.type !== "all" && (
                              <button
                                type="button"
                                className="skills-source-item__delete"
                                title="删除此源"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteSkillSource(source.id);
                                }}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <polyline points="3 6 5 6 21 6" />
                                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                </svg>
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="skills-list-pane">
                    <div className="skills-list-pane__header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", borderBottom: "1px solid var(--panel-border)" }}>
                      <div className="skills-list-pane__header-info" style={{ display: "flex", flexDirection: "column", gap: "2px", minWidth: 0 }}>
                        <span className="skills-list-pane__header-title" style={{ fontSize: "1.05rem", fontWeight: 700 }}>
                          {selectedSource.name}
                        </span>
                        {selectedSource.type !== "preset" && (
                          <span className="skills-list-pane__header-subtitle" style={{ fontSize: "0.8rem", color: "var(--text-faint)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={selectedSource.value}>
                            路径/仓库：{selectedSource.value}
                          </span>
                        )}
                      </div>
                      {selectedSource.type === "repo" && (
                        <Button
                          type="button"
                          className="fragment-action-btn"
                          style={{ minHeight: "32px", padding: "0 12px", fontSize: "12px" }}
                          disabled={isAddingSkillsRepo}
                          loading={isAddingSkillsRepo}
                          onClick={async () => {
                            setIsAddingSkillsRepo(true);
                            try {
                              await addSkillsRepository(selectedSource.value);
                              await refreshCurrentEditorSkills(activeEditorId);
                              messageApi.success(`同步 Git 仓库 ${selectedSource.value} 成功！`);
                            } catch (err) {
                              const errMsg = err instanceof Error ? err.message : String(err);
                              messageApi.error(`同步失败: ${errMsg}`);
                            } finally {
                              setIsAddingSkillsRepo(false);
                            }
                          }}
                        >
                          同步仓库技能
                        </Button>
                      )}
                    </div>

                    <div className="skills-list-pane__summary" style={{ padding: "10px 18px", background: "var(--panel-muted)" }}>
                      <span>
                        共 {filteredSkills.length} 项
                        <span style={{ marginLeft: "10px", color: "var(--accent-primary)" }}>
                          已链接 {filteredSkills.filter(s => activeEnabledSkillIds.includes(s.id)).length}
                        </span>
                        <span style={{ marginLeft: "10px", color: "var(--text-faint)" }}>
                          未链接 {filteredSkills.filter(s => !activeEnabledSkillIds.includes(s.id)).length}
                        </span>
                      </span>
                      <span>目标：{activeSkillsTargetPath || "未检测到目标路径"}</span>
                    </div>

                    <div className="skills-manager__controls" style={{ padding: "10px 18px", borderBottom: "1px solid var(--panel-border)", gap: "10px" }}>
                      <input
                        className="form-input skills-manager__search"
                        style={{ margin: 0, height: "40px" }}
                        placeholder="搜索技能名称、描述"
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
                    </div>

                    <div className={`skills-list-rows${isSkillsLoading ? " skills-list-rows--loading" : ""}`} style={{ padding: "18px" }}>
                      {isSkillsLoading && skills.length === 0 ? (
                        <div className="skills-list-loading">
                          <div className="skills-spinner" />
                          <span>正在加载技能列表...</span>
                        </div>
                      ) : filteredSkills.length === 0 ? (
                        <p className="skills-list-empty" style={{ padding: 0 }}>
                          当前源下没有匹配的技能。
                          {selectedSource.type === "repo" && "如果刚添加了仓库，请点击右上角“同步仓库技能”按钮。"}
                        </p>
                      ) : selectedSource.type === "all" ? (() => {
                        // 按来源分组：官方预设 / repo 源 / 本地源
                        const groups: Array<{ label: string; skills: typeof filteredSkills }> = [];

                        // 1. 官方预设
                        const presetSkills = filteredSkills.filter((s) => s.isBuiltin);
                        if (presetSkills.length > 0) {
                          groups.push({ label: "官方预设", skills: presetSkills });
                        }

                        // 2. 各 repo 源（按 repoSource 分组，排除内置）
                        const repoSources = skillSources.filter((src) => src.type === "repo");
                        repoSources.forEach((src) => {
                          const repoSkills = filteredSkills.filter(
                            (s) => !s.isBuiltin && normalizeRepoSource(s.repoSource || "") === normalizeRepoSource(src.value)
                          );
                          if (repoSkills.length > 0) {
                            groups.push({ label: src.name || src.value, skills: repoSkills });
                          }
                        });

                        // 3. 各本地源（按 path 前缀分组，排除内置和已归到 repo 的）
                        const localSources = skillSources.filter((src) => src.type === "local");
                        localSources.forEach((src) => {
                          const localSkills = filteredSkills.filter(
                            (s) =>
                              !s.isBuiltin &&
                              !repoSources.some(
                                (r) => normalizeRepoSource(s.repoSource || "") === normalizeRepoSource(r.value)
                              ) &&
                              s.path?.toLowerCase().startsWith(src.value.toLowerCase())
                          );
                          if (localSkills.length > 0) {
                            groups.push({ label: src.name || src.value, skills: localSkills });
                          }
                        });

                        // 4. 其他（不属于任何已知分组的技能）
                        const assignedIds = new Set(groups.flatMap((g) => g.skills.map((s) => s.id)));
                        const otherSkills = filteredSkills.filter((s) => !assignedIds.has(s.id));
                        if (otherSkills.length > 0) {
                          groups.push({ label: "其他", skills: otherSkills });
                        }

                        if (groups.length === 0) {
                          return (
                            <p className="skills-list-empty" style={{ padding: 0 }}>
                              当前源下没有匹配的技能。
                            </p>
                          );
                        }

                        return (
                          <div className="skills-list-groups">
                            {groups.map((group) => (
                              <div key={group.label} className="skills-list-group">
                                <div className="skills-list-group__header">
                                  <span className="skills-list-group__title">{group.label}</span>
                                  <span className="skills-list-group__count">{group.skills.length} 项</span>
                                </div>
                                <div className="skills-list-group__rows">
                                  {group.skills.map((skill) => renderSkillRow(skill))}
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      })() : (
                        <div className="skills-list-group__rows">
                          {filteredSkills.map((skill) => renderSkillRow(skill))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <Modal
                  isOpen={isAddSourceModalOpen}
                  onCancel={() => setIsAddSourceModalOpen(false)}
                  title="添加技能源"
                  footer={null}
                  width={480}
                >
                  <div className="skills-add-source-form" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      <label style={{ fontSize: "12px", color: "var(--text-soft)", fontWeight: 600 }}>
                        技能源类型
                      </label>
                      <div style={{ display: "flex", gap: "8px", width: "100%" }}>
                        <Button
                          type="button"
                          className={newSourceType === "repo" ? "fragment-action-btn fragment-action-btn--active" : "mcp-form__btn"}
                          style={{
                            flex: 1,
                            minHeight: "32px",
                            padding: "0 16px",
                            fontSize: "12px",
                            background: newSourceType === "repo" ? "var(--accent)" : "var(--surface-container-high)",
                            color: newSourceType === "repo" ? "#fff" : "var(--text-soft)",
                            border: "none",
                            borderRadius: "6px",
                            cursor: "pointer",
                          }}
                          onClick={() => {
                            setNewSourceType("repo");
                            setNewSourceValue("");
                          }}
                        >
                          Git 仓库 (GitHub)
                        </Button>
                        <Button
                          type="button"
                          className={newSourceType === "local" ? "fragment-action-btn fragment-action-btn--active" : "mcp-form__btn"}
                          style={{
                            flex: 1,
                            minHeight: "32px",
                            padding: "0 16px",
                            fontSize: "12px",
                            background: newSourceType === "local" ? "var(--accent)" : "var(--surface-container-high)",
                            color: newSourceType === "local" ? "#fff" : "var(--text-soft)",
                            border: "none",
                            borderRadius: "6px",
                            cursor: "pointer",
                          }}
                          onClick={() => {
                            setNewSourceType("local");
                            setNewSourceValue("");
                          }}
                        >
                          本地物理目录
                        </Button>
                      </div>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      <label style={{ fontSize: "12px", color: "var(--text-soft)", fontWeight: 600 }}>
                        技能源名称
                      </label>
                      <input
                        className="form-input"
                        placeholder="例如：开发规范、Vercel 技能集"
                        value={newSourceName}
                        onChange={(e) => setNewSourceName(e.target.value)}
                      />
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      <label style={{ fontSize: "12px", color: "var(--text-soft)", fontWeight: 600 }}>
                        {newSourceType === "repo" ? "仓库源 (owner/repo)" : "本地文件夹绝对路径"}
                      </label>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <input
                          className="form-input"
                          style={{ flex: 1, margin: 0 }}
                          placeholder={newSourceType === "repo" ? "例如：vercel-labs/skills" : "例如：/Users/username/my-skills"}
                          value={newSourceValue}
                          onChange={(e) => setNewSourceValue(e.target.value)}
                        />
                        {newSourceType === "local" && (
                          <Button
                            type="button"
                            className="mcp-form__btn"
                            style={{
                              background: "var(--surface-container-high)",
                              border: "none",
                              color: "var(--text-soft)",
                              padding: "0 12px",
                              borderRadius: "6px",
                              cursor: "pointer",
                              fontSize: "12px",
                              whiteSpace: "nowrap",
                            }}
                            onClick={async () => {
                              try {
                                const selectedPath = await selectDirectory();
                                if (selectedPath) {
                                  setNewSourceValue(selectedPath);
                                }
                              } catch (err) {
                                if (err !== "canceled") {
                                  messageApi.error(`选择目录失败: ${err}`);
                                }
                              }
                            }}
                          >
                            选择文件夹
                          </Button>
                        )}
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: "12px", marginTop: "10px", justifyContent: "flex-end" }}>
                      <Button
                        type="button"
                        className="mcp-form__btn"
                        style={{
                          background: "var(--surface-container-high)",
                          border: "none",
                          color: "var(--text-soft)",
                          padding: "6px 12px",
                          borderRadius: "6px",
                          cursor: "pointer",
                        }}
                        onClick={() => setIsAddSourceModalOpen(false)}
                      >
                        取消
                      </Button>
                      <Button
                        type="button"
                        className="fragment-action-btn"
                        style={{ minHeight: "32px", padding: "0 16px", fontSize: "12px" }}
                        disabled={!newSourceName.trim() || !newSourceValue.trim() || isAddingSkillsRepo}
                        loading={isAddingSkillsRepo}
                        onClick={async () => {
                          const name = newSourceName.trim();
                          const val = newSourceValue.trim();
                          if (!name || !val) return;
                          
                          if (newSourceType === "repo") {
                            setIsAddingSkillsRepo(true);
                            try {
                              await addSkillsRepository(val);
                              messageApi.success(`成功下载 Git 仓库源 ${val}`);
                            } catch (err) {
                              const errMsg = err instanceof Error ? err.message : String(err);
                              messageApi.error(`下载 Git 仓库失败: ${errMsg}`);
                            } finally {
                              setIsAddingSkillsRepo(false);
                            }
                          }
                          
                          const finalVal = newSourceType === "repo" ? normalizeRepoSource(val) : val;
                          addSkillSource({
                            type: newSourceType,
                            name,
                            value: finalVal,
                          });
                          setIsAddSourceModalOpen(false);
                          await refreshCurrentEditorSkills(activeEditorId);
                        }}
                      >
                        确定
                      </Button>
                    </div>
                  </div>
                </Modal>

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
                            <span className={`skill-source-badge ${getSkillSourceBadgeMeta(selectedSkill, skillSources).className}`}>
                              {getSkillSourceBadgeMeta(selectedSkill, skillSources).text}
                            </span>
                          )}
                          <p className="skills-detail-pane__description" style={{ marginTop: "12px" }}>
                            {selectedSkill.description || "无描述"}
                          </p>
                        </div>
                        <div className="skills-detail-pane__actions">
                          {canInstallSelectedSkill ? (
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
                                const INSTALL_TIMEOUT_MS = 90_000;
                                try {
                                  let skillPath = selectedSkill.path;
                                  if (needsInstall) {
                                    if (!selectedSkill.repoSource) {
                                      throw new Error("缺少可安装的技能来源。");
                                    }
                                    const timeoutPromise = new Promise<never>((_, reject) =>
                                      setTimeout(() => reject(new Error("安装超时（超过 90 秒），请检查网络或稍后重试。")), INSTALL_TIMEOUT_MS)
                                    );
                                    const installedSkills = await Promise.race([
                                      addSkillsRepository(selectedSkill.repoSource),
                                      timeoutPromise,
                                    ]);
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
                          ) : (
                            <>
                              <Button
                                type="button"
                                className={`fragment-action-btn${isRemovingSkill ? " fragment-action-btn--loading" : ""}`}
                                disabled={isUpdatingSkill || isAddingSkillsRepo || !isSelectedSkillCliManaged || !isSelectedSkillLinked}
                                loading={isRemovingSkill}
                                title={!isSelectedSkillCliManaged
                                  ? "当前技能不支持取消链接。"
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
                                title={!isSelectedSkillCliManaged ? "当前技能不支持在这里更新。" : undefined}
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
                              ? "官方 Skills（已安装）"
                              : "官方 Skills（未安装，请先安装）")
                            : selectedSkill.sourceKind === "cli"
                              ? (selectedSkill.repoSource
                                ? `第三方 Skills（来自 ${selectedSkill.repoSource}）`
                                : "第三方 Skills（来源仓库未知）")
                              : "本地 Skills（来自本地目录）"}
                        </p>
                        <p className="skills-detail-pane__path">
                          <strong>来源仓库：</strong>
                          {selectedSkill.repoSource ? (
                            <a
                              className="skills-detail-pane__link"
                              href={getSkillRepoUrl(selectedSkill.repoSource)}
                              onClick={(event) => {
                                event.preventDefault();
                                void openSkillRepoUrl(getSkillRepoUrl(selectedSkill.repoSource!));
                              }}
                              rel="noreferrer"
                              target="_blank"
                            >
                              {selectedSkill.repoSource}
                            </a>
                          ) : "无"}
                        </p>
                        <p className="skills-detail-pane__path">
                          <strong>物理来源路径：</strong>
                          {selectedSkillPhysicalPath ? (
                            <button
                              className="skills-detail-pane__link-button"
                              onClick={() => {
                                void openSkillLocalPath(selectedSkillPhysicalPath);
                              }}
                              type="button"
                            >
                              {selectedSkillPhysicalPath}
                            </button>
                          ) : "未安装，暂无物理路径"}
                        </p>
                        <p className="skills-detail-pane__path">
                          <strong>目标软链接：</strong>
                          {selectedSkillLinkPath ? (
                            <button
                              className="skills-detail-pane__link-button"
                              onClick={() => {
                                void revealSkillLocalPath(selectedSkillLinkPath);
                              }}
                              type="button"
                            >
                              {selectedSkillLinkPath}
                            </button>
                          ) : "未安装，暂不可创建软链接"}
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

          {activeDomain === "Prompt" ? (
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
                  <button
                    className={`preview-apply-btn${isCurrentPromptEditorEnabled && applyStatus !== "pending" ? "" : " preview-apply-btn--disabled"}`}
                    onClick={handleApplyClick}
                    disabled={!isCurrentPromptEditorEnabled || applyStatus === "pending"}
                    title={isCurrentPromptEditorEnabled ? `应用 Prompt 配置到 ${editorMeta[activeEditorId].title}` : `请先启用当前配置域中的 ${editorMeta[activeEditorId].title}`}
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
          </aside>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default AiComposeApp;
