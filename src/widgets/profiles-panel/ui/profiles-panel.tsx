import { useState } from "react";
import { Message } from "@xinghunm/compass-ui";
import { useAiComposeStore, type EditorId, EditorToggleIcon } from "../../../shared";
import { AccountSwitcher } from "../../../features/manage-account";
import { ProfilesPanelRoot } from "./profiles-panel.styles";

const supportedEditors: { id: EditorId; label: string }[] = [
  { id: "codex", label: "Codex" },
  { id: "cursor", label: "Cursor" },
];

const editorMeta: Record<EditorId, { title: string }> = {
  antigravity: { title: "Antigravity" },
  codex: { title: "Codex" },
  cursor: { title: "Cursor" },
};

interface ProfilesPanelProps {
  messageApi: ReturnType<typeof Message.useMessage>[0];
}

export function ProfilesPanel({ messageApi }: ProfilesPanelProps) {
  const { activeEditorId, selectEditor } = useAiComposeStore();
  const [activeTab, setActiveTab] = useState("accounts");

  // 若当前是 antigravity，默认展示 codex
  const displayEditorId: EditorId =
    activeEditorId === "antigravity" ? "codex" : activeEditorId;

  return (
    <ProfilesPanelRoot>
      <div className="profiles-container">
        <aside className="profiles-sidebar" aria-label="Profiles 子导航">
          <div className="sidebar-editor-tabs" role="tablist" aria-label="选择编辑器">
            {supportedEditors.map(({ id, label }) => (
              <button
                key={id}
                id={`editor-tab-${id}`}
                role="tab"
                type="button"
                aria-selected={displayEditorId === id}
                className={`sidebar-editor-tab${displayEditorId === id ? " sidebar-editor-tab--active" : ""}`}
                onClick={() => selectEditor(id)}
              >
                <span className="sidebar-editor-tab__icon">
                  <EditorToggleIcon editorId={id} />
                </span>
                {label}
              </button>
            ))}
          </div>

          <div className="sidebar-divider" />

          <button
            type="button"
            className={`sidebar-item${activeTab === "accounts" ? " sidebar-item--active" : ""}`}
            onClick={() => setActiveTab("accounts")}
          >
            账号管理
          </button>
        </aside>
        <main className="profiles-content">
          {activeTab === "accounts" && (
            <AccountSwitcher
              editorId={displayEditorId}
              editorName={editorMeta[displayEditorId].title}
              messageApi={messageApi}
            />
          )}
        </main>
      </div>
    </ProfilesPanelRoot>
  );
}
