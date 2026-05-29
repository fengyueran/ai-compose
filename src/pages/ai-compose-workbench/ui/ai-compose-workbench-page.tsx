import { Message } from '@xinghunm/compass-ui';
import { useEffect, useRef } from 'react';

import {
  loadEditorHooksStates,
  loadEditorTargetStates,
  loadEditorMcpStates,
  loadEditorSkillsStates,
  loadEditorInstalledSkills,
  loadPhysicalSkills,
  loadSkillsFromDir,
  isTauriRuntime,
  type EditorId,
  type SkillInfo,
  useAiComposeStore,
  EditorToggleIcon,
} from '../../../shared';
import { PromptPanel } from '../../../widgets/prompt-panel';
import { McpPanel } from '../../../widgets/mcp-panel';
import { HooksPanel } from '../../../widgets/hooks-panel';
import { SkillsPanel } from '../../../widgets/skills-panel';
import { ProfilesPanel } from '../../../widgets/profiles-panel';
import {
  Brand,
  BrandTitle,
  DisabledTag,
  GlobalBar,
  PageFrame,
  PageShell,
  SideNavItem,
  SideNavItems,
  SideNavLabel,
  SideNavPanel,
  SideNavSection,
  WorkspaceGrid,
} from './ai-compose-workbench-page.styles';

type DomainName = 'Prompt' | 'MCP' | 'Hooks' | 'Skills' | 'Profiles';

const configurationDomains: { name: DomainName; isAvailable: boolean }[] = [
  { name: 'Prompt', isAvailable: true },
  { name: 'MCP', isAvailable: true },
  { name: 'Hooks', isAvailable: true },
  { name: 'Skills', isAvailable: true },
  { name: 'Profiles', isAvailable: true },
];

const profilesEditors: { id: EditorId; label: string }[] = [
  { id: 'codex', label: 'Codex' },
  { id: 'cursor', label: 'Cursor' },
];

export function AiComposeWorkbenchPage() {
  const [messageApi, messageContextHolder] = Message.useMessage();
  const messageApiRef = useRef(messageApi);

  useEffect(() => {
    messageApiRef.current = messageApi;
  }, [messageApi]);

  const {
    activeDomain,
    selectDomain,
    activeEditorId,
    selectEditor,
    hydratePromptEditorStates,
    hydrateMcpEditorStates,
    hydrateHooksEditorStates,
    hydrateSkillsEditorStates,
    setEditorHydrationPending,
    setApplyFeedback,
    setSkillsList,
    skillSources,
  } = useAiComposeStore();

  useEffect(() => {
    let isSubscribed = true;

    async function syncEditorStates() {
      if (!isTauriRuntime()) {
        setEditorHydrationPending(false);
        setApplyFeedback({
          status: 'idle',
          message:
            '当前不在 Tauri 桌面宿主中运行。请使用 `pnpm dev:desktop` 启动后再读取真实的编辑器配置状态。',
          lastAppliedAt: null,
        });
        return;
      }

      try {
        const [
          nextPromptStates,
          nextMcpStates,
          nextHooksStates,
          nextSkillsStates,
        ] = await Promise.all([
          loadEditorTargetStates(),
          loadEditorMcpStates(),
          loadEditorHooksStates(),
          loadEditorSkillsStates(),
        ]);

        if (!isSubscribed) {
          return;
        }

        hydratePromptEditorStates(nextPromptStates);
        hydrateMcpEditorStates(nextMcpStates);
        hydrateHooksEditorStates(nextHooksStates);
        hydrateSkillsEditorStates(nextSkillsStates);
        setApplyFeedback({
          status: 'idle',
          message:
            '已从本地编辑器目标文件同步 AI-COMPOSE 受管状态。切换开关会立即写入或清除对应配置。',
          lastAppliedAt: null,
        });
      } catch (error) {
        if (!isSubscribed) {
          return;
        }

        setEditorHydrationPending(false);
        setApplyFeedback({
          status: 'error',
          message:
            error instanceof Error
              ? error.message
              : '读取本地编辑器配置状态时发生未知错误。',
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
    hydrateHooksEditorStates,
    hydrateSkillsEditorStates,
    setApplyFeedback,
    setEditorHydrationPending,
  ]);

  useEffect(() => {
    let isSubscribed = true;

    async function syncCurrentEditorSkills() {
      if (activeDomain !== 'Skills') {
        return;
      }

      if (!isTauriRuntime()) {
        return;
      }

      try {
        const [editorSkills, globalSkills] = await Promise.all([
          loadEditorInstalledSkills({ editorId: activeEditorId }),
          loadPhysicalSkills(),
        ]);

        const localSources = skillSources.filter((s) => s.type === 'local');
        const localSkillsPromises = localSources.map(async (src) => {
          try {
            return await loadSkillsFromDir(src.value);
          } catch (e) {
            console.error(
              `Failed to load skills from local source ${src.value}`,
              e,
            );
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
            : '读取当前编辑器技能列表时发生未知错误。',
        );
      }
    }

    void syncCurrentEditorSkills();

    return () => {
      isSubscribed = false;
    };
  }, [activeDomain, activeEditorId, setSkillsList, skillSources]);

  return (
    <PageShell>
      {messageContextHolder}
      <PageFrame>
        <GlobalBar>
          <Brand>
            <BrandTitle>AI Compose</BrandTitle>
          </Brand>
          {activeDomain === 'Profiles' && (
            <div
              role="tablist"
              aria-label="选择编辑器"
              style={{
                display: 'flex',
                gap: '6px',
                alignItems: 'center',
              }}
            >
              {profilesEditors.map(({ id, label }) => (
                <button
                  key={id}
                  id={`editor-tab-${id}`}
                  role="tab"
                  type="button"
                  aria-selected={activeEditorId === id}
                  onClick={() => selectEditor(id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '7px',
                    padding: '6px 14px 6px 10px',
                    borderRadius: '8px',
                    border: activeEditorId === id
                      ? '1px solid rgba(197,93,51,0.22)'
                      : '1px solid transparent',
                    background: activeEditorId === id
                      ? 'var(--accent-soft, rgba(197,93,51,0.08))'
                      : 'transparent',
                    color: activeEditorId === id
                      ? 'var(--accent-strong, #c55d33)'
                      : 'var(--text-soft)',
                    fontWeight: activeEditorId === id ? 600 : 400,
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                    transition: 'all 180ms ease',
                  }}
                >
                  <span style={{ width: 20, height: 20, flexShrink: 0 }}>
                    <EditorToggleIcon editorId={id} />
                  </span>
                  {label}
                </button>
              ))}
            </div>
          )}
        </GlobalBar>

        <WorkspaceGrid isSkillsDomain={activeDomain === 'Skills'}>
          <SideNavPanel aria-label="工作台导航">
            <SideNavSection>
              <SideNavLabel>配置域</SideNavLabel>
              <SideNavItems>
                {configurationDomains.map((domain) => (
                  <SideNavItem
                    key={domain.name}
                    disabled={!domain.isAvailable}
                    isActive={activeDomain === domain.name}
                    isDisabled={!domain.isAvailable}
                    onClick={() =>
                      domain.isAvailable && selectDomain(domain.name)
                    }
                    type="button"
                  >
                    <span>{domain.name}</span>
                    {!domain.isAvailable ? (
                      <DisabledTag>即将支持</DisabledTag>
                    ) : null}
                  </SideNavItem>
                ))}
              </SideNavItems>
            </SideNavSection>
          </SideNavPanel>

          {activeDomain === 'Prompt' ? (
            <PromptPanel messageApi={messageApi} />
          ) : activeDomain === 'MCP' ? (
            <McpPanel messageApi={messageApi} />
          ) : activeDomain === 'Hooks' ? (
            <HooksPanel messageApi={messageApi} />
          ) : activeDomain === 'Skills' ? (
            <SkillsPanel messageApi={messageApi} />
          ) : (
            <ProfilesPanel messageApi={messageApi} />
          )}
        </WorkspaceGrid>
      </PageFrame>
    </PageShell>
  );
}
