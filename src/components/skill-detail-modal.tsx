import { Modal, Button, Tooltip, Message } from "@xinghunm/compass-ui";
import { useMemo, useState } from "react";
import {
  addSkillsRepository,
  linkSkillToEditor,
  unlinkSkillFromEditor,
  updateSkill,
  loadSingleSkill,
  loadEditorSkillsStates,
  type EditorId,
  type SkillInfo,
  type SkillSource,
  type EditorSkillsState,
} from "../editor-target-command";
import {
  getSkillSourceBadgeMeta,
  getSkillRepoUrl,
  openSkillRepoUrl,
  openSkillLocalPath,
  revealSkillLocalPath,
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

interface SkillDetailModalProps {
  isOpen: boolean;
  onCancel: () => void;
  selectedSkill: SkillInfo | null;
  skillsEditorStates: Record<EditorId, EditorSkillsState>;
  skillSources: SkillSource[];
  activeEditorId: EditorId;
  messageApi: ReturnType<typeof Message.useMessage>[0];
  hydrateSkillsEditorStates: (states: Record<EditorId, EditorSkillsState>) => void;
  replaceSkill: (skill: SkillInfo) => void;
  refreshCurrentEditorSkills: (editorId: EditorId) => Promise<unknown>;
  isSkillLinkedToEditor: (editorId: EditorId, skillId: string) => boolean;
  isSkillToggleReadOnly: (skill: SkillInfo) => boolean;
  handleSkillEditorToggle: (skill: SkillInfo, editorId: EditorId) => Promise<void>;
}

// 模拟 isPresetSkillMatchLocal
function isPresetSkillMatchLocal(presetId: string, skillId: string): boolean {
  const normPreset = presetId.toLowerCase().replace(/\.md$/, "");
  const normSkill = skillId.toLowerCase().replace(/\.md$/, "");
  return normPreset === normSkill;
}

export function SkillDetailModal({
  isOpen,
  onCancel,
  selectedSkill,
  skillsEditorStates,
  skillSources,
  activeEditorId,
  messageApi,
  hydrateSkillsEditorStates,
  replaceSkill,
  refreshCurrentEditorSkills,
  isSkillLinkedToEditor,
  isSkillToggleReadOnly,
  handleSkillEditorToggle,
}: SkillDetailModalProps) {
  const [isAddingSkillsRepo, setIsAddingSkillsRepo] = useState(false);
  const [isRemovingSkill, setIsRemovingSkill] = useState(false);
  const [isUpdatingSkill, setIsUpdatingSkill] = useState(false);

  const selectedSkillPhysicalPath = selectedSkill?.isBuiltin && !selectedSkill.installed
    ? ""
    : (selectedSkill?.path || "");

  const selectedSkillLinkedTargets = useMemo(() => {
    if (!selectedSkill || (selectedSkill.isBuiltin && !selectedSkill.installed)) {
      return [];
    }

    return editorIds
      .map((editorId) => {
        const targetPath = skillsEditorStates[editorId]?.targetPath ?? "";
        const isLinked = (skillsEditorStates[editorId]?.enabledSkills ?? []).includes(selectedSkill.id);

        if (!targetPath || !isLinked) {
          return null;
        }

        return {
          editorId,
          path: `${targetPath}/${selectedSkill.id}`,
        };
      })
      .filter((item): item is { editorId: EditorId; path: string } => Boolean(item));
  }, [selectedSkill, skillsEditorStates]);

  const isSelectedSkillCliManaged = selectedSkill?.sourceKind === "cli";
  const isSelectedSkillLinked = selectedSkill
    ? (skillsEditorStates[activeEditorId]?.enabledSkills ?? []).includes(selectedSkill.id)
    : false;

  const canInstallSelectedSkill = Boolean(
    selectedSkill &&
    !isSelectedSkillLinked &&
    (isSelectedSkillCliManaged || selectedSkill.isBuiltin)
  );

  const shouldShowSelectedSkillSourceBadge = Boolean(selectedSkill);

  if (!selectedSkill) return null;

  return (
    <Modal
      isOpen={isOpen}
      onCancel={onCancel}
      title={`技能详情: ${selectedSkill.name}`}
      footer={null}
      width={720}
    >
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
            <div className="skills-detail-switches">
              <span className="skills-detail-switches__hint">
                仅控制当前 Skill 在各编辑器中的链接状态
              </span>
              <div className="editor-icon-toggle-group editor-icon-toggle-group--skill-detail">
                {editorIds.map((editorId) => {
                  const isLinked = isSkillLinkedToEditor(editorId, selectedSkill.id);
                  const isReadOnly = isSkillToggleReadOnly(selectedSkill);
                  const tooltipContent = `${editorMeta[editorId].title}${isLinked ? " 已链接" : " 未链接"}`;

                  return (
                    <Tooltip
                      key={`detail-${selectedSkill.id}-${editorId}`}
                      content={tooltipContent}
                      placement="top"
                      styles={{ overlay: { zIndex: 1400 } }}
                    >
                      <button
                        type="button"
                        className={`editor-icon-toggle${
                          isLinked ? " editor-icon-toggle--enabled" : ""
                        }${isReadOnly ? " editor-icon-toggle--readonly" : ""}`}
                        aria-label={tooltipContent}
                        aria-pressed={isLinked}
                        disabled={isReadOnly || isAddingSkillsRepo || isRemovingSkill || isUpdatingSkill}
                        onClick={() => {
                          void handleSkillEditorToggle(selectedSkill, editorId);
                        }}
                      >
                        <EditorToggleIcon editorId={editorId} />
                      </button>
                    </Tooltip>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="skills-detail-pane__actions">
            {canInstallSelectedSkill ? (
              <Button
                type="button"
                className={`fragment-action-btn${isAddingSkillsRepo ? " fragment-action-btn--loading" : ""}`}
                disabled={isAddingSkillsRepo}
                loading={isAddingSkillsRepo}
                onClick={async () => {
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
                        isPresetSkillMatchLocal(skill.id, skillId),
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
                    onCancel();
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
                      onCancel();
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
                      messageApi.error(`更新技能 ${selectedSkill.name} 失败: ${errMsg}`);
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
          <div className="skills-detail-pane__path">
            <strong>目标软链接：</strong>
            {selectedSkillLinkedTargets.length > 0 ? (
              <div className="skills-detail-pane__multi-paths">
                {selectedSkillLinkedTargets.map(({ editorId, path }) => (
                  <div key={`${selectedSkill.id}-${editorId}`} className="skills-detail-pane__multi-path-row">
                    <span className="skills-detail-pane__multi-path-label">
                      {editorMeta[editorId].title}:
                    </span>
                    <button
                      className="skills-detail-pane__link-button"
                      onClick={() => {
                        void revealSkillLocalPath(path);
                      }}
                      type="button"
                    >
                      {path}
                    </button>
                  </div>
                ))}
              </div>
            ) : "当前未链接到任何编辑器"}
          </div>
          <pre className="skills-detail-pane__markdown" style={{ marginTop: "16px" }}>
            <code>{selectedSkill.content || "(SKILL.md 内容为空)"}</code>
          </pre>
        </div>
      </div>
    </Modal>
  );
}
