import { Modal, Button, Message } from '@xinghunm/compass-ui';
import { useState } from 'react';
import {
  addSkillsRepository,
  selectDirectory,
  normalizeRepoSource,
  type EditorId,
} from '../../../shared';
import { AddSourceModalContent } from './add-source-modal.styles';

interface AddSourceModalProps {
  isOpen: boolean;
  onCancel: () => void;
  messageApi: ReturnType<typeof Message.useMessage>[0];
  addSkillSource: (source: {
    type: 'repo' | 'local';
    name: string;
    value: string;
  }) => void;
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
  const [newSourceName, setNewSourceName] = useState('');
  const [newSourceType, setNewSourceType] = useState<'repo' | 'local'>('repo');
  const [newSourceValue, setNewSourceValue] = useState('');
  const [isAddingSkillsRepo, setIsAddingSkillsRepo] = useState(false);
  const REPO_SYNC_TIMEOUT_MS = 90_000;

  const resetForm = () => {
    setNewSourceName('');
    setNewSourceValue('');
    setIsAddingSkillsRepo(false);
  };

  const syncRepoSourceInBackground = async (repoSource: string) => {
    try {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(
          () =>
            reject(
              new Error(
                '同步超时（超过 90 秒），请稍后在列表页重试“同步仓库技能”。',
              ),
            ),
          REPO_SYNC_TIMEOUT_MS,
        ),
      );
      await Promise.race([addSkillsRepository(repoSource), timeoutPromise]);
      await refreshCurrentEditorSkills(activeEditorId);
      messageApi.success(`Git 仓库源 ${repoSource} 同步完成`);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      messageApi.error(`Git 仓库源同步失败: ${errMsg}`);
    }
  };

  const handleOk = async () => {
    const name = newSourceName.trim();
    const val = newSourceValue.trim();
    if (!name || !val) return;

    const finalVal = newSourceType === 'repo' ? normalizeRepoSource(val) : val;

    if (newSourceType === 'repo') {
      setIsAddingSkillsRepo(true);
      addSkillSource({
        type: newSourceType,
        name,
        value: finalVal,
      });
      onCancel();
      resetForm();
      messageApi.success(`已添加 Git 仓库源 ${finalVal}，正在后台同步`);
      void syncRepoSourceInBackground(finalVal);
      return;
    }

    addSkillSource({
      type: newSourceType,
      name,
      value: finalVal,
    });
    onCancel();
    resetForm();
    await refreshCurrentEditorSkills(activeEditorId);
  };

  return (
    <Modal
      isOpen={isOpen}
      onCancel={() => {
        onCancel();
        resetForm();
      }}
      title="添加技能源"
      footer={null}
      width={480}
    >
      <AddSourceModalContent className="skills-add-source-form">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label
            style={{
              fontSize: '12px',
              color: 'var(--text-soft)',
              fontWeight: 600,
            }}
          >
            技能源类型
          </label>
          <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
            <Button
              type="button"
              className={
                newSourceType === 'repo'
                  ? 'fragment-action-btn fragment-action-btn--active'
                  : 'mcp-form__btn'
              }
              style={{
                flex: 1,
                minHeight: '32px',
                padding: '0 16px',
                fontSize: '12px',
                background:
                  newSourceType === 'repo'
                    ? 'var(--accent)'
                    : 'var(--surface-container-high)',
                color: newSourceType === 'repo' ? '#fff' : 'var(--text-soft)',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
              onClick={() => {
                setNewSourceType('repo');
                setNewSourceValue('');
              }}
            >
              Git 仓库 (GitHub)
            </Button>
            <Button
              type="button"
              className={
                newSourceType === 'local'
                  ? 'fragment-action-btn fragment-action-btn--active'
                  : 'mcp-form__btn'
              }
              style={{
                flex: 1,
                minHeight: '32px',
                padding: '0 16px',
                fontSize: '12px',
                background:
                  newSourceType === 'local'
                    ? 'var(--accent)'
                    : 'var(--surface-container-high)',
                color: newSourceType === 'local' ? '#fff' : 'var(--text-soft)',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
              onClick={() => {
                setNewSourceType('local');
                setNewSourceValue('');
              }}
            >
              本地物理目录
            </Button>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label
            style={{
              fontSize: '12px',
              color: 'var(--text-soft)',
              fontWeight: 600,
            }}
          >
            技能源名称
          </label>
          <input
            className="form-input"
            placeholder="例如：开发规范、Vercel 技能集"
            value={newSourceName}
            onChange={(e) => setNewSourceName(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label
            style={{
              fontSize: '12px',
              color: 'var(--text-soft)',
              fontWeight: 600,
            }}
          >
            {newSourceType === 'repo'
              ? '仓库源 (owner/repo[/path])'
              : '本地文件夹绝对路径'}
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              className="form-input"
              style={{ flex: 1, margin: 0 }}
              placeholder={
                newSourceType === 'repo'
                  ? '例如：github/awesome-copilot/skills/refactor'
                  : '例如：/Users/username/my-skills'
              }
              value={newSourceValue}
              onChange={(e) => setNewSourceValue(e.target.value)}
            />
            {newSourceType === 'local' && (
              <Button
                type="button"
                className="mcp-form__btn"
                style={{
                  background: 'var(--surface-container-high)',
                  border: 'none',
                  color: 'var(--text-soft)',
                  padding: '0 12px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  whiteSpace: 'nowrap',
                }}
                onClick={async () => {
                  try {
                    const selectedPath = await selectDirectory();
                    if (selectedPath) {
                      setNewSourceValue(selectedPath);
                    }
                  } catch (err) {
                    if (err !== 'canceled') {
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

        <div
          style={{
            display: 'flex',
            gap: '12px',
            marginTop: '10px',
            justifyContent: 'flex-end',
          }}
        >
          <Button
            type="button"
            className="mcp-form__btn"
            style={{
              background: 'var(--surface-container-high)',
              border: 'none',
              color: 'var(--text-soft)',
              padding: '6px 12px',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
            onClick={() => {
              onCancel();
              setNewSourceName('');
              setNewSourceValue('');
            }}
          >
            取消
          </Button>
          <Button
            type="button"
            className="fragment-action-btn"
            style={{ minHeight: '32px', padding: '0 16px', fontSize: '12px' }}
            disabled={
              !newSourceName.trim() ||
              !newSourceValue.trim() ||
              isAddingSkillsRepo
            }
            loading={isAddingSkillsRepo}
            onClick={handleOk}
          >
            确定
          </Button>
        </div>
      </AddSourceModalContent>
    </Modal>
  );
}
