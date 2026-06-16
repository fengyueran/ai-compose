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
  type SkillInfo,
  useAiComposeStore,
  exportConfiguration,
  importConfiguration,
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
  ActionContainer,
  ActionBtn,
} from './ai-compose-workbench-page.styles';

type DomainName = 'Prompt' | 'MCP' | 'Hooks' | 'Skills' | 'Profiles';

const configurationDomains: { name: DomainName; isAvailable: boolean }[] = [
  { name: 'Prompt', isAvailable: true },
  { name: 'MCP', isAvailable: true },
  { name: 'Hooks', isAvailable: true },
  { name: 'Skills', isAvailable: true },
  { name: 'Profiles', isAvailable: true },
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
    hydratePromptEditorStates,
    hydrateMcpEditorStates,
    hydrateHooksEditorStates,
    hydrateSkillsEditorStates,
    setEditorHydrationPending,
    setApplyFeedback,
    setSkillsList,
    skillSources,
    hooksState,
    importConfigurationAction,
  } = useAiComposeStore();

  const handleExportConfig = async () => {
    if (!isTauriRuntime()) {
      messageApiRef.current.warning(
        '当前环境不支持导出配置！请在桌面端中运行。',
      );
      return;
    }

    try {
      const customMcp = localStorage.getItem('ai-compose:custom-mcp-servers');
      const customSkill = localStorage.getItem(
        'ai-compose:custom-skill-sources',
      );
      const customMcpServers = customMcp ? JSON.parse(customMcp) : [];
      const customSkillSources = customSkill ? JSON.parse(customSkill) : [];
      const hooks = hooksState.hooks;

      const configData = {
        version: '1.0.0',
        customMcpServers,
        customSkillSources,
        hooks,
      };

      const jsonString = JSON.stringify(configData, null, 2);
      await exportConfiguration(jsonString);
      messageApiRef.current.success('配置导出成功！');
    } catch (e) {
      if (e === '用户取消了保存文件') {
        return;
      }
      messageApiRef.current.error(`导出失败：${e}`);
    }
  };

  const handleImportConfig = async () => {
    if (!isTauriRuntime()) {
      messageApiRef.current.warning(
        '当前环境不支持导入配置！请在桌面端中运行。',
      );
      return;
    }

    try {
      const content = await importConfiguration();
      const configData = JSON.parse(content);

      if (!configData || typeof configData !== 'object') {
        throw new Error('无效的 JSON 配置文件。');
      }

      const { customMcpServers, customSkillSources, hooks } = configData;
      if (
        !Array.isArray(customMcpServers) ||
        !Array.isArray(customSkillSources) ||
        !Array.isArray(hooks)
      ) {
        throw new Error('配置文件格式不正确，缺少必要字段。');
      }

      await importConfigurationAction({
        customMcpServers,
        customSkillSources,
        hooks,
      });

      messageApiRef.current.success('配置导入并生效成功！正在刷新页面。');
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (e) {
      if (e === '用户取消了选择文件') {
        return;
      }
      messageApiRef.current.error(
        `导入失败：${e instanceof Error ? e.message : e}`,
      );
    }
  };

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
          <ActionContainer>
            <ActionBtn onClick={handleImportConfig}>导入配置</ActionBtn>
            <ActionBtn onClick={handleExportConfig}>导出配置</ActionBtn>
          </ActionContainer>
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
