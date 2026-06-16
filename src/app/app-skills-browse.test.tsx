import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { App } from './app';
import {
  disableTauriRuntime,
  enableTauriRuntime,
  resetAppTestState,
} from './app-test-support';
import {
  loadEditorInstalledSkills,
  loadEditorMcpStates,
  loadEditorSkillsStates,
  loadEditorTargetStates,
  loadPhysicalSkills,
  loadSkillsFromDir,
  openExternalUrl,
  openLocalPath,
  revealLocalPath,
  selectDirectory,
} from '../shared/api/editor-target-command';
import { useAiComposeStore } from '../shared/model/ai-compose-store';

vi.mock('../shared/api/editor-target-command', async () => {
  const actual = await vi.importActual<
    typeof import('../shared/api/editor-target-command')
  >('../shared/api/editor-target-command');

  return {
    ...actual,
    loadEditorInstalledSkills: vi.fn(),
    loadEditorMcpStates: vi.fn(),
    loadEditorHooksStates: vi.fn(),
    loadEditorSkillsStates: vi.fn(),
    loadEditorTargetStates: vi.fn(),
    loadPhysicalSkills: vi.fn(),
    loadSkillsFromDir: vi.fn(),
    openExternalUrl: vi.fn(),
    openLocalPath: vi.fn(),
    revealLocalPath: vi.fn(),
    selectDirectory: vi.fn(),
  };
});

describe('App skills browse flows', () => {
  beforeEach(() => {
    resetAppTestState();
    vi.clearAllMocks();
    vi.mocked(loadPhysicalSkills).mockResolvedValue([]);
    vi.mocked(loadSkillsFromDir).mockResolvedValue([]);
    vi.mocked(selectDirectory).mockResolvedValue('/Users/test/.cursor/skills');
    disableTauriRuntime();
  });

  test('shows current editor installed skills and keeps fallback skills read-only', async () => {
    useAiComposeStore.setState({
      activeDomain: 'Skills',
      activeEditorId: 'cursor',
      editorStates: {
        antigravity: { enabled: false, targetPath: '', enabledSkills: [] },
        codex: { enabled: false, targetPath: '', enabledSkills: [] },
        cursor: {
          enabled: true,
          targetPath: '/Users/test/.cursor/skills',
          enabledSkills: ['cli-skill', 'local-scan-skill'],
        },
      },
      skillsEditorStates: {
        antigravity: { enabled: false, targetPath: '', enabledSkills: [] },
        codex: { enabled: false, targetPath: '', enabledSkills: [] },
        cursor: {
          enabled: true,
          targetPath: '/Users/test/.cursor/skills',
          enabledSkills: ['cli-skill', 'local-scan-skill'],
        },
      },
      skillSources: [
        { id: 'preset', type: 'preset', name: '官方预设', value: '' },
        {
          id: 'local:dir',
          type: 'local',
          name: '本地源',
          value: '/Users/test/.cursor/skills',
        },
      ],
      selectedSkillSourceId: 'local:dir',
      skills: [
        {
          id: 'cli-skill',
          name: 'CLI Skill',
          description: 'Managed by skills.sh',
          content: '# CLI Skill',
          path: '/Users/test/.agents/skills/cli-skill',
          sourceKind: 'cli',
        },
        {
          id: 'local-scan-skill',
          name: 'Local Scan Skill',
          description: 'Scanned from an editor target directory',
          content: '# Local Scan Skill',
          path: '/Users/test/.cursor/skills/local-scan-skill',
          sourceKind: 'fallbackDirectory',
        },
      ],
      selectedSkillId: 'local-scan-skill',
      isHydratingEditorStates: false,
    });

    render(<App />);

    expect(
      screen.getByText(/Scanned from an editor target directory/),
    ).toBeInTheDocument();

    const localSkillRow = screen.getByRole('button', {
      name: /Local Scan Skill/,
    });
    await userEvent.click(localSkillRow);

    const dialog = screen
      .getAllByRole('dialog')
      .find((el) => el.textContent?.includes('技能详情'))!;
    const unlinkBtn = within(dialog).getByRole('button', { name: '取消链接' });
    expect(unlinkBtn).toBeInTheDocument();
    expect(unlinkBtn).toBeDisabled();
  });

  test('renders skills sources list and filters skills by selected source', async () => {
    useAiComposeStore.setState({
      activeDomain: 'Skills',
      activeEditorId: 'cursor',
      editorStates: {
        antigravity: { enabled: false, targetPath: '', enabledSkills: [] },
        codex: { enabled: false, targetPath: '', enabledSkills: [] },
        cursor: {
          enabled: true,
          targetPath: '/Users/test/.cursor/skills',
          enabledSkills: ['brainstorming'],
        },
      },
      skillsEditorStates: {
        antigravity: { enabled: false, targetPath: '', enabledSkills: [] },
        codex: { enabled: false, targetPath: '', enabledSkills: [] },
        cursor: {
          enabled: true,
          targetPath: '/Users/test/.cursor/skills',
          enabledSkills: ['brainstorming'],
        },
      },
      skillSources: [
        { id: 'preset', type: 'preset', name: '官方预设', value: '' },
        {
          id: 'local:dir',
          type: 'local',
          name: '本地源',
          value: '/Users/test/.cursor/skills',
        },
      ],
      selectedSkillSourceId: 'preset',
      skills: [
        {
          id: 'brainstorming',
          name: 'brainstorming',
          description: 'Official skill',
          content: '# brainstorming',
          path: '/Users/test/.agents/skills/brainstorming',
          sourceKind: 'cli',
          isBuiltin: true,
        },
        {
          id: 'local-scan-skill',
          name: 'Local Scan Skill',
          description: 'Scanned from an editor target directory',
          content: '# Local Scan Skill',
          path: '/Users/test/.cursor/skills/local-scan-skill',
          sourceKind: 'fallbackDirectory',
        },
      ],
      selectedSkillId: 'brainstorming',
      isHydratingEditorStates: false,
    });

    render(<App />);

    expect(screen.getAllByText('官方预设').length).toBeGreaterThan(0);
    expect(screen.getByText('本地源')).toBeInTheDocument();
    expect(screen.getByText('brainstorming')).toBeInTheDocument();
    expect(screen.queryByText('Local Scan Skill')).not.toBeInTheDocument();

    await userEvent.click(screen.getByText('本地源'));
    expect(useAiComposeStore.getState().selectedSkillSourceId).toBe(
      'local:dir',
    );
  });

  test('renders source repository as a clickable GitHub link in skill details', async () => {
    enableTauriRuntime();
    vi.mocked(loadEditorTargetStates).mockResolvedValue({
      antigravity: { enabled: false, targetPath: '' },
      codex: { enabled: false, targetPath: '' },
      cursor: { enabled: true, targetPath: '/Users/test/.cursor/AGENTS.md' },
    } as never);
    vi.mocked(loadEditorMcpStates).mockResolvedValue({
      antigravity: { enabled: false, targetPath: '' },
      codex: { enabled: false, targetPath: '' },
      cursor: { enabled: false, targetPath: '' },
    } as never);
    vi.mocked(loadEditorSkillsStates).mockResolvedValue({
      antigravity: { enabled: false, targetPath: '', enabledSkills: [] },
      codex: { enabled: false, targetPath: '', enabledSkills: [] },
      cursor: {
        enabled: true,
        targetPath: '/Users/test/.cursor/skills',
        enabledSkills: ['react-development'],
      },
    });
    vi.mocked(loadEditorInstalledSkills).mockResolvedValue([
      {
        id: 'react-development',
        name: 'react-development',
        description: 'Installed from a custom repo',
        content: '# react-development',
        path: '/Users/test/.agents/skills/react-development',
        sourceKind: 'cli',
        repoSource: 'github/awesome-copilot',
        repoSkillPath: 'skills/refactor/SKILL.md',
      },
    ]);
    useAiComposeStore.setState({
      activeDomain: 'Skills',
      activeEditorId: 'cursor',
      editorStates: {
        antigravity: { enabled: false, targetPath: '', enabledSkills: [] },
        codex: { enabled: false, targetPath: '', enabledSkills: [] },
        cursor: {
          enabled: true,
          targetPath: '/Users/test/.cursor/skills',
          enabledSkills: ['react-development'],
        },
      },
      skillsEditorStates: {
        antigravity: { enabled: false, targetPath: '', enabledSkills: [] },
        codex: { enabled: false, targetPath: '', enabledSkills: [] },
        cursor: {
          enabled: true,
          targetPath: '/Users/test/.cursor/skills',
          enabledSkills: ['react-development'],
        },
      },
      skillSources: [
        { id: 'preset', type: 'preset', name: '官方预设', value: '' },
        {
          id: 'repo:github/awesome-copilot/skills/refactor',
          type: 'repo',
          name: 'github/awesome-copilot/skills/refactor',
          value: 'github/awesome-copilot/skills/refactor',
        },
      ],
      selectedSkillSourceId: 'repo:github/awesome-copilot/skills/refactor',
      skills: [
        {
          id: 'react-development',
          name: 'react-development',
          description: 'Installed from a custom repo',
          content: '# react-development',
          path: '/Users/test/.agents/skills/react-development',
          sourceKind: 'cli',
          repoSource: 'github/awesome-copilot',
          repoSkillPath: 'skills/refactor/SKILL.md',
        },
      ],
      selectedSkillId: 'react-development',
      isHydratingEditorStates: false,
    });

    render(<App />);

    await userEvent.click(
      screen.getByRole('button', { name: /react-development/ }),
    );

    const dialog = screen
      .getAllByRole('dialog')
      .find((el) => el.textContent?.includes('技能详情'))!;
    const repoLink = within(dialog).getByRole('link', {
      name: 'github/awesome-copilot',
    });
    expect(repoLink).toHaveAttribute(
      'href',
      'https://github.com/github/awesome-copilot/tree/main/skills/refactor',
    );
    expect(repoLink).toHaveAttribute('target', '_blank');

    await userEvent.click(repoLink);
    expect(openExternalUrl).toHaveBeenCalledWith(
      'https://github.com/github/awesome-copilot/tree/main/skills/refactor',
    );

    disableTauriRuntime();
  });

  test('renders third-party badge for skills installed from custom repositories', () => {
    useAiComposeStore.setState({
      activeDomain: 'Skills',
      activeEditorId: 'cursor',
      editorStates: {
        antigravity: { enabled: false, targetPath: '', enabledSkills: [] },
        codex: { enabled: false, targetPath: '', enabledSkills: [] },
        cursor: {
          enabled: true,
          targetPath: '/Users/test/.cursor/skills',
          enabledSkills: ['react-development'],
        },
      },
      skillsEditorStates: {
        antigravity: { enabled: false, targetPath: '', enabledSkills: [] },
        codex: { enabled: false, targetPath: '', enabledSkills: [] },
        cursor: {
          enabled: true,
          targetPath: '/Users/test/.cursor/skills',
          enabledSkills: ['react-development'],
        },
      },
      skillSources: [
        { id: 'preset', type: 'preset', name: '官方预设', value: '' },
        {
          id: 'repo:fengyueran/skills',
          type: 'repo',
          name: 'fengyueran/skills',
          value: 'fengyueran/skills',
        },
      ],
      selectedSkillSourceId: 'repo:fengyueran/skills',
      skills: [
        {
          id: 'react-development',
          name: 'react-development',
          description: 'Installed from a custom repo',
          content: '# react-development',
          path: '/Users/test/.agents/skills/react-development',
          sourceKind: 'cli',
          repoSource: 'fengyueran/skills',
        },
      ],
      selectedSkillId: 'react-development',
      isHydratingEditorStates: false,
    });

    render(<App />);

    const skillRow = screen.getByRole('button', { name: /react-development/ });
    expect(within(skillRow).getByText('第三方')).toBeInTheDocument();
    expect(
      within(skillRow).queryByText('fengyueran/skills'),
    ).not.toBeInTheDocument();
  });

  test('shows synced repository skills even before they are linked to the current editor', () => {
    useAiComposeStore.setState({
      activeDomain: 'Skills',
      activeEditorId: 'antigravity',
      editorStates: {
        antigravity: {
          enabled: false,
          targetPath: '~/.gemini/antigravity/skills',
          enabledSkills: [],
        },
        codex: {
          enabled: true,
          targetPath: '/Users/test/.codex/skills',
          enabledSkills: ['react-development'],
        },
        cursor: { enabled: false, targetPath: '', enabledSkills: [] },
      },
      skillsEditorStates: {
        antigravity: {
          enabled: false,
          targetPath: '/Users/test/.gemini/antigravity/skills',
          enabledSkills: [],
        },
        codex: {
          enabled: true,
          targetPath: '/Users/test/.codex/skills',
          enabledSkills: ['react-development'],
        },
        cursor: { enabled: false, targetPath: '', enabledSkills: [] },
      },
      skillSources: [
        { id: 'preset', type: 'preset', name: '官方预设', value: '' },
        {
          id: 'repo:fengyueran/skills',
          type: 'repo',
          name: 'fengyueran/skills',
          value: 'fengyueran/skills',
        },
      ],
      selectedSkillSourceId: 'repo:fengyueran/skills',
      skills: [
        {
          id: 'react-development',
          name: 'react-development',
          description: 'Installed from a custom repo',
          content: '# react-development',
          path: '/Users/test/.agents/skills/react-development',
          sourceKind: 'cli',
          repoSource: 'fengyueran/skills',
        },
      ],
      selectedSkillId: 'react-development',
      isHydratingEditorStates: false,
    });

    render(<App />);

    expect(
      screen.getByRole('button', { name: /react-development/ }),
    ).toBeInTheDocument();
    expect(screen.getByText(/共 1 项/)).toBeInTheDocument();
    expect(screen.getByText(/Codex 1/)).toBeInTheDocument();
  });

  test('renders physical source path and target link path as clickable local paths in skill details', async () => {
    enableTauriRuntime();
    vi.mocked(loadEditorTargetStates).mockResolvedValue({
      antigravity: { enabled: false, targetPath: '' },
      codex: { enabled: false, targetPath: '' },
      cursor: { enabled: true, targetPath: '/Users/test/.cursor/AGENTS.md' },
    } as never);
    vi.mocked(loadEditorMcpStates).mockResolvedValue({
      antigravity: { enabled: false, targetPath: '' },
      codex: { enabled: false, targetPath: '' },
      cursor: { enabled: false, targetPath: '' },
    } as never);
    vi.mocked(loadEditorSkillsStates).mockResolvedValue({
      antigravity: { enabled: false, targetPath: '', enabledSkills: [] },
      codex: { enabled: false, targetPath: '', enabledSkills: [] },
      cursor: {
        enabled: true,
        targetPath: '/Users/test/.cursor/skills',
        enabledSkills: ['react-development'],
      },
    });
    vi.mocked(loadEditorInstalledSkills).mockResolvedValue([
      {
        id: 'react-development',
        name: 'react-development',
        description: 'Installed from a custom repo',
        content: '# react-development',
        path: '/Users/test/.agents/skills/react-development',
        sourceKind: 'cli',
        repoSource: 'fengyueran/skills',
      },
    ]);
    useAiComposeStore.setState({
      activeDomain: 'Skills',
      activeEditorId: 'cursor',
      editorStates: {
        antigravity: { enabled: false, targetPath: '', enabledSkills: [] },
        codex: { enabled: false, targetPath: '', enabledSkills: [] },
        cursor: {
          enabled: true,
          targetPath: '/Users/test/.cursor/skills',
          enabledSkills: ['react-development'],
        },
      },
      skillsEditorStates: {
        antigravity: { enabled: false, targetPath: '', enabledSkills: [] },
        codex: { enabled: false, targetPath: '', enabledSkills: [] },
        cursor: {
          enabled: true,
          targetPath: '/Users/test/.cursor/skills',
          enabledSkills: ['react-development'],
        },
      },
      skillSources: [
        { id: 'preset', type: 'preset', name: '官方预设', value: '' },
        {
          id: 'repo:fengyueran/skills',
          type: 'repo',
          name: 'fengyueran/skills',
          value: 'fengyueran/skills',
        },
      ],
      selectedSkillSourceId: 'repo:fengyueran/skills',
      skills: [
        {
          id: 'react-development',
          name: 'react-development',
          description: 'Installed from a custom repo',
          content: '# react-development',
          path: '/Users/test/.agents/skills/react-development',
          sourceKind: 'cli',
          repoSource: 'fengyueran/skills',
        },
      ],
      selectedSkillId: 'react-development',
      isHydratingEditorStates: false,
    });

    render(<App />);

    await userEvent.click(
      screen.getByRole('button', { name: /react-development/ }),
    );

    const dialogElement = screen
      .getAllByRole('dialog')
      .find((el) => el.textContent?.includes('技能详情'))!;
    const dialog = within(dialogElement);
    const physicalPathButton = dialog.getByRole('button', {
      name: '/Users/test/.agents/skills/react-development',
    });
    const targetPathButton = dialog.getByRole('button', {
      name: '/Users/test/.cursor/skills/react-development',
    });

    await userEvent.click(physicalPathButton);
    await userEvent.click(targetPathButton);

    expect(openLocalPath).toHaveBeenCalledWith(
      '/Users/test/.agents/skills/react-development',
    );
    expect(revealLocalPath).toHaveBeenCalledWith(
      '/Users/test/.cursor/skills/react-development',
    );

    disableTauriRuntime();
  });

  test('renders loading state for skills list when hydrating', () => {
    enableTauriRuntime();
    const pendingPromise = new Promise<never>(() => {});
    vi.mocked(loadEditorTargetStates).mockReturnValue(pendingPromise as never);
    vi.mocked(loadEditorMcpStates).mockReturnValue(pendingPromise as never);
    vi.mocked(loadEditorSkillsStates).mockReturnValue(pendingPromise as never);
    vi.mocked(loadEditorInstalledSkills).mockReturnValue(
      pendingPromise as never,
    );

    useAiComposeStore.setState({
      activeDomain: 'Skills',
      isHydratingEditorStates: true,
      skills: [],
    });

    render(<App />);

    expect(screen.getByText('正在加载技能列表...')).toBeInTheDocument();

    disableTauriRuntime();
  });
});
