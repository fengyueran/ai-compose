import { useMemo, useState } from "react";
import { Tooltip, Select, Button, Message, type SelectOption } from "@xinghunm/compass-ui";
import { useAiComposeStore } from "../ai-compose-store";
import { AddSourceModal } from "./add-source-modal";
import { SkillDetailModal } from "./skill-detail-modal";
import {
  addSkillsRepository,
  linkSkillToEditor,
  loadEditorInstalledSkills,
  loadEditorSkillsStates,
  loadPhysicalSkills,
  loadSkillsFromDir,
  unlinkSkillFromEditor,
  normalizeRepoSource,
  type EditorId,
  type SkillInfo,
} from "../editor-target-command";
import {
  getSkillSourceBadgeMeta,
} from "../skills-utils";
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

type SkillsFilter = "all" | "linked" | "unlinked";

const skillsFilterOptions: SelectOption[] = [
  { label: "全部", value: "all" },
  { label: "已链接", value: "linked" },
  { label: "未链接", value: "unlinked" },
];

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

interface SkillsPanelProps {
  messageApi: ReturnType<typeof Message.useMessage>[0];
}

export function SkillsPanel({ messageApi }: SkillsPanelProps) {
  const {
    activeEditorId,
    skills,
    selectedSkillId,
    skillsEditorStates,
    selectSkill,
    replaceSkill,
    setSkillsList,
    skillSources,
    selectedSkillSourceId,
    addSkillSource,
    deleteSkillSource,
    selectSkillSource,
    hydrateSkillsEditorStates,
    isHydratingEditorStates,
    selectEditor,
  } = useAiComposeStore();

  const installedSkills = useMemo(
    () => skills.filter((skill) => skill.installed !== false),
    [skills],
  );

  const selectedSkill = useMemo(
    () => skills.find((s) => s.id === selectedSkillId) ?? skills[0] ?? null,
    [skills, selectedSkillId],
  );

  const [skillsQuery, setSkillsQuery] = useState("");
  const [skillsFilter, setSkillsFilter] = useState<SkillsFilter>("all");
  const [isSkillModalOpen, setIsSkillModalOpen] = useState(false);
  const [isAddingSkillsRepo, setIsAddingSkillsRepo] = useState(false);
  const [isRemovingSkill, setIsRemovingSkill] = useState(false);

  // Skills Sources
  const [isAddSourceModalOpen, setIsAddSourceModalOpen] = useState(false);

  const isSkillsLoading = isHydratingEditorStates || isAddingSkillsRepo || isRemovingSkill;

  const activeEnabledSkillIds = useMemo(
    () => skillsEditorStates[activeEditorId]?.enabledSkills ?? [],
    [skillsEditorStates, activeEditorId],
  );

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

      const isLinked = activeEnabledSkillIds.includes(skill.id);
      const canShowUnlinkedSourceSkill = selectedSource.type === "repo" || selectedSource.type === "local";
      if (!skill.isBuiltin && !isLinked && !(canShowUnlinkedSourceSkill && matchesSelectedSource)) {
        return false;
      }

      // Filter by selected source
      if (!matchesSelectedSource) {
        return false;
      }

      // Filter by link status
      if (skillsFilter === "linked" && !isLinked) {
        return false;
      }
      if (skillsFilter === "unlinked" && isLinked) {
        return false;
      }

      // Filter by search query
      if (!normalizedQuery) {
        return true;
      }

      return [skill.id, skill.name, skill.description, skill.path]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [skills, selectedSource, skillsFilter, skillsQuery, activeEnabledSkillIds]);



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

  const isSkillLinkedToEditor = (editorId: EditorId, skillId: string) =>
    skillsEditorStates[editorId]?.enabledSkills.includes(skillId) ?? false;

  const isSkillToggleReadOnly = (skill: SkillInfo) =>
    skill.sourceKind === "fallbackDirectory";

  const isPresetSkillMatchLocal = (skillId: string, presetId: string): boolean => {
    const normalizedSkillId = skillId.toLowerCase();
    const normalizedPresetId = presetId.toLowerCase();

    return normalizedSkillId === normalizedPresetId
      || normalizedSkillId.endsWith(`/${normalizedPresetId}`)
      || normalizedSkillId.endsWith(`__${normalizedPresetId}`);
  };

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
          isPresetSkillMatchLocal(item.id, skill.id),
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

  const renderSkillRow = (skill: SkillInfo) => {
    const isSelected = skill.id === selectedSkillId;
    const badgeMeta = getSkillSourceBadgeMeta(skill, skillSources);
    const linkedCount = editorIds.filter((editorId) =>
      isSkillLinkedToEditor(editorId, skill.id),
    ).length;

    return (
      <div
        key={skill.id}
        className={`skills-list-row${
          isSelected ? " skills-list-row--selected" : ""
        }`}
        onClick={() => {
          selectSkill(skill.id);
          setIsSkillModalOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            selectSkill(skill.id);
            setIsSkillModalOpen(true);
          }
        }}
        role="button"
        tabIndex={0}
      >
        <div className="skills-list-row__select">
          <div className="skill-card__icon-container">
            {renderSkillIcon(skill.name, skill.id)}
          </div>
          <div className="skills-list-row__content">
            <div className="skills-list-row__title-line">
              <span className="skills-list-row__title" title={skill.name}>
                {skill.name}
              </span>
            </div>
            <span className="skills-list-row__description" title={skill.description || "无描述"}>
              {skill.description || "无描述"}
            </span>
            <div className="skills-list-row__meta-line">
              <span className={`skill-source-badge ${badgeMeta.className}`}>
                {badgeMeta.text}
              </span>
              <span className="skills-list-row__summary-count">
                已链接 {linkedCount}/{editorIds.length}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <main className="workbench workbench--skills">
      <section className="panel skills-manager" aria-labelledby="skills-list-title">
        <div className="skills-manager__toolbar">
          <div className="skills-manager__heading" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
            <div>
              <h2 className="panel__title" id="skills-list-title">
                当前编辑器 Skills
              </h2>
              <p className="panel__subtitle">
                管理已链接的技能，添加第三方仓库或本地物理目录作为技能源。
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <span className="chip">已安装/已链接 {installedSkills.length} 项技能</span>
              <div className="preview-card__editor-toggles">
                {editorIds.map((editorId) => {
                  return (
                    <Tooltip
                      key={`preview-toggle-${editorId}`}
                      content={editorMeta[editorId].title}
                      placement="top"
                      styles={{ overlay: { zIndex: 1400 } }}
                    >
                      <button
                        aria-label={editorMeta[editorId].title}
                        className={`editor-icon-toggle${activeEditorId === editorId ? " editor-icon-toggle--active" : ""}`}
                        onClick={() => {
                          selectEditor(editorId);
                        }}
                        type="button"
                      >
                        <EditorToggleIcon editorId={editorId} />
                      </button>
                    </Tooltip>
                  );
                })}
              </div>
            </div>
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
              <span>共 {filteredSkills.length} 项</span>
              <span style={{ marginLeft: "10px", color: "var(--accent-primary)" }}>
                已链接 {filteredSkills.filter(s => isSkillLinkedToEditor(activeEditorId, s.id)).length}
              </span>
              <span style={{ marginLeft: "10px", color: "var(--text-faint)" }}>
                未链接 {filteredSkills.filter(s => !isSkillLinkedToEditor(activeEditorId, s.id)).length}
              </span>
              {editorIds
                .filter((editorId) => editorId !== activeEditorId)
                .map((editorId) => ({
                  editorId,
                  count: filteredSkills.filter((skill) =>
                    isSkillLinkedToEditor(editorId, skill.id),
                  ).length,
                }))
                .filter(({ count }) => count > 0)
                .map(({ editorId, count }) => (
                  <span
                    key={`skills-summary-${editorId}`}
                    style={{
                      marginLeft: "10px",
                      color: "var(--text-faint)",
                    }}
                  >
                    {editorMeta[editorId].title} {count}
                  </span>
                ))}
            </span>
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
              const groups: Array<{ label: string; skills: typeof filteredSkills }> = [];

              const presetSkills = filteredSkills.filter((s) => s.isBuiltin);
              if (presetSkills.length > 0) {
                groups.push({ label: "官方预设", skills: presetSkills });
              }

              const repoSources = skillSources.filter((src) => src.type === "repo");
              repoSources.forEach((src) => {
                const repoSkills = filteredSkills.filter(
                  (s) => !s.isBuiltin && normalizeRepoSource(s.repoSource || "") === normalizeRepoSource(src.value)
                );
                if (repoSkills.length > 0) {
                  groups.push({ label: src.name || src.value, skills: repoSkills });
                }
              });

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

      {isAddSourceModalOpen && (
        <AddSourceModal
          isOpen={isAddSourceModalOpen}
          onCancel={() => setIsAddSourceModalOpen(false)}
          messageApi={messageApi}
          addSkillSource={addSkillSource}
          refreshCurrentEditorSkills={refreshCurrentEditorSkills}
          activeEditorId={activeEditorId}
        />
      )}

      {isSkillModalOpen && selectedSkill && (
        <SkillDetailModal
          isOpen={isSkillModalOpen}
          onCancel={() => setIsSkillModalOpen(false)}
          selectedSkill={selectedSkill}
          skillsEditorStates={skillsEditorStates}
          skillSources={skillSources}
          activeEditorId={activeEditorId}
          messageApi={messageApi}
          hydrateSkillsEditorStates={hydrateSkillsEditorStates}
          replaceSkill={replaceSkill}
          refreshCurrentEditorSkills={refreshCurrentEditorSkills}
          isSkillLinkedToEditor={isSkillLinkedToEditor}
          isSkillToggleReadOnly={isSkillToggleReadOnly}
          handleSkillEditorToggle={handleSkillEditorToggle}
        />
      )}
      </section>
    </main>
  );
}
