import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { App } from './app';
import { disableTauriRuntime, resetAppTestState } from './app-test-support';
import {
  loadPhysicalSkills,
  loadSkillsFromDir,
  selectDirectory,
} from '../shared/api/editor-target-command';

vi.mock('../shared/api/editor-target-command', async () => {
  const actual = await vi.importActual<
    typeof import('../shared/api/editor-target-command')
  >('../shared/api/editor-target-command');

  return {
    ...actual,
    loadPhysicalSkills: vi.fn(),
    loadSkillsFromDir: vi.fn(),
    selectDirectory: vi.fn(),
  };
});

describe('App hooks domain', () => {
  beforeEach(() => {
    resetAppTestState();
    vi.clearAllMocks();
    vi.mocked(loadPhysicalSkills).mockResolvedValue([]);
    vi.mocked(loadSkillsFromDir).mockResolvedValue([]);
    vi.mocked(selectDirectory).mockResolvedValue('/Users/test/.cursor/skills');
    disableTauriRuntime();
  });

  test('switches to Hooks domain and shows the raw hooks editor', async () => {
    render(<App />);

    await userEvent.click(screen.getByRole('button', { name: 'Hooks' }));

    expect(screen.getByText('共享 Hooks')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '+ 添加 Hook' }),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '+ 添加 Hook' }));

    expect(screen.getByText('添加自定义 Hook')).toBeInTheDocument();

    const nameInput = screen.getByPlaceholderText('例如: prettier');
    await userEvent.type(nameInput, '新 Hook 1');

    const cmdInput = screen.getByPlaceholderText(
      '例如：git diff --name-only | xargs prettier --write',
    );
    await userEvent.type(cmdInput, 'prettier --write');

    await userEvent.click(screen.getByRole('button', { name: '创建 Hook' }));

    expect(
      await screen.findByRole('button', { name: 'Codex 已启用' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Cursor 未启用' }),
    ).toBeInTheDocument();
  });

  test('creates a format template hook with a formatter command', async () => {
    render(<App />);

    await userEvent.click(screen.getByRole('button', { name: 'Hooks' }));
    await userEvent.click(screen.getByRole('button', { name: '+ 添加 Hook' }));

    await userEvent.type(
      screen.getByPlaceholderText('例如: prettier'),
      '格式化当前文件',
    );
    await userEvent.selectOptions(
      screen.getAllByRole('combobox')[0],
      'format-template',
    );

    const formatterInput = screen.getByPlaceholderText(
      '例如：npx prettier --config ~/.prettierrc --write {{current_file}}',
    );
    fireEvent.change(formatterInput, {
      target: {
        value: 'npx prettier --config ~/.prettierrc --write {{current_file}}',
      },
    });

    await userEvent.click(screen.getByRole('button', { name: '创建 Hook' }));

    expect(await screen.findByText('格式化模板')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Codex 已启用' }),
    ).toBeInTheDocument();
    expect(screen.getByText('{{current_file}}')).toBeInTheDocument();
  });

  test('updates preview after editing and saving a format template hook', async () => {
    render(<App />);

    await userEvent.click(screen.getByRole('button', { name: 'Hooks' }));
    await userEvent.click(screen.getByRole('button', { name: '+ 添加 Hook' }));
    await userEvent.type(
      screen.getByPlaceholderText('例如: prettier'),
      'Format',
    );
    await userEvent.selectOptions(
      screen.getAllByRole('combobox')[0],
      'format-template',
    );
    fireEvent.change(
      screen.getByPlaceholderText(
        '例如：npx prettier --config ~/.prettierrc --write {{current_file}}',
      ),
      {
        target: {
          value: 'npx prettier --write {{current_file}}',
        },
      },
    );
    await userEvent.click(screen.getByRole('button', { name: '创建 Hook' }));

    const formatterInput = screen.getByPlaceholderText(
      '例如：npx prettier --config ~/.prettierrc --write {{current_file}}',
    );
    fireEvent.change(formatterInput, {
      target: {
        value: 'npx biome format --write {{current_file}}',
      },
    });
    await userEvent.click(screen.getByRole('button', { name: '保存修改' }));

    await waitFor(() => {
      expect(document.body.textContent).toContain(
        'npx biome format --write {{current_file}} /* ⚡️ 编译后的多编辑器自适应命令 */',
      );
    });

    // Toggle "显示配置文件原文" to display the raw hex wrapper script
    const showRawCheckbox = screen.getByLabelText('显示配置文件原文');
    await userEvent.click(showRawCheckbox);

    const encodedCommand = Buffer.from(
      'npx biome format --write {{current_file}}',
      'utf8',
    ).toString('hex');

    await waitFor(() => {
      expect(document.body.textContent).toContain(encodedCommand);
    });
  });
});
