import { Modal, Button, Message } from "@xinghunm/compass-ui";
import { useState } from "react";
import { addSkillsRepository, selectDirectory, normalizeRepoSource, type EditorId } from "../../../shared";

interface AddSourceModalProps {
  isOpen: boolean;
  onCancel: () => void;
  messageApi: ReturnType<typeof Message.useMessage>[0];
  addSkillSource: (source: { type: "repo" | "local"; name: string; value: string }) => void;
  refreshCurrentEditorSkills: (editorId: EditorId) => Promise<unknown>;
  activeEditorId: EditorId;
}

export function AddSourceModal({
  isOpen,
  onCancel,
  messageApi,
  addSkillSource,
  refreshCurrentEditorSkills,
  activeEditorId,
}: AddSourceModalProps) {
  const [newSourceName, setNewSourceName] = useState("");
  const [newSourceType, setNewSourceType] = useState<"repo" | "local">("repo");
  const [newSourceValue, setNewSourceValue] = useState("");
  const [isAddingSkillsRepo, setIsAddingSkillsRepo] = useState(false);

  const handleOk = async () => {
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
    onCancel();
    // 清空状态
    setNewSourceName("");
    setNewSourceValue("");
    await refreshCurrentEditorSkills(activeEditorId);
  };

  return (
    <Modal
      isOpen={isOpen}
      onCancel={() => {
        onCancel();
        setNewSourceName("");
        setNewSourceValue("");
      }}
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
            onClick={() => {
              onCancel();
              setNewSourceName("");
              setNewSourceValue("");
            }}
          >
            取消
          </Button>
          <Button
            type="button"
            className="fragment-action-btn"
            style={{ minHeight: "32px", padding: "0 16px", fontSize: "12px" }}
            disabled={!newSourceName.trim() || !newSourceValue.trim() || isAddingSkillsRepo}
            loading={isAddingSkillsRepo}
            onClick={handleOk}
          >
            确定
          </Button>
        </div>
      </div>
    </Modal>
  );
}
