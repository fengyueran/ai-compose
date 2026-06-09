import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { AccountSwitcher } from './account-switcher';
import * as api from '../../../shared';

vi.mock('../../../shared', async () => {
  const actual =
    await vi.importActual<typeof import('../../../shared')>('../../../shared');
  return {
    ...actual,
    loadEditorAccounts: vi.fn(),
    saveCurrentEditorAccount: vi.fn(),
    switchEditorAccount: vi.fn(),
    deleteEditorAccount: vi.fn(),
    fetchCursorAccountUsage: vi.fn(),
  };
});

describe('AccountSwitcher Component', () => {
  const mockMessageApi = {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    loading: vi.fn(),
  } as unknown as ReturnType<
    typeof import('@xinghunm/compass-ui').Message.useMessage
  >[0];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.fetchCursorAccountUsage).mockResolvedValue({
      email: 'test@domain.com',
      billingCycleEnd: 1781330313000,
      totalPercentUsed: 42.5,
      limit: 2000,
    });
  });

  test('renders empty state and allows saving new account', async () => {
    vi.mocked(api.loadEditorAccounts).mockResolvedValue([]);

    render(
      <AccountSwitcher
        editorId="codex"
        editorName="Codex"
        messageApi={mockMessageApi}
      />,
    );

    expect(screen.getByText('Codex 多账号管理')).toBeInTheDocument();
    expect(
      await screen.findByText('暂无已备份账号。在上方输入备注名即可备份。'),
    ).toBeInTheDocument();

    const input = screen.getByPlaceholderText('例如: work, user@gmail.com');
    const saveBtn = screen.getByRole('button', { name: '备份当前登录态' });

    // 1. 尝试空保存
    await userEvent.click(saveBtn);
    expect(mockMessageApi.warning).toHaveBeenCalledWith('请输入账号备注名称');

    // 2. 尝试非法格式保存
    await userEvent.type(input, 'work/hack');
    await userEvent.click(saveBtn);
    expect(mockMessageApi.warning).toHaveBeenCalledWith(
      '账号名称仅允许字母、数字、下划线、短横线、@ 及 . (且不能包含连续点)',
    );

    // 2.5 尝试连续点非法格式保存
    await userEvent.clear(input);
    await userEvent.type(input, 'work..hack');
    await userEvent.click(saveBtn);
    expect(mockMessageApi.warning).toHaveBeenCalledWith(
      '账号名称仅允许字母、数字、下划线、短横线、@ 及 . (且不能包含连续点)',
    );

    // 3. 正确保存 (允许 @ 和 .)
    await userEvent.clear(input);
    await userEvent.type(input, 'fengyueran@gmail.com');
    vi.mocked(api.saveCurrentEditorAccount).mockResolvedValue(undefined);

    await userEvent.click(saveBtn);
    expect(api.saveCurrentEditorAccount).toHaveBeenCalledWith(
      'codex',
      'fengyueran@gmail.com',
    );
    expect(mockMessageApi.success).toHaveBeenCalledWith(
      '当前 Codex 账号已备份为: fengyueran@gmail.com',
    );
  });

  test('lists accounts, allows switching and deletion', async () => {
    const mockAccounts: api.EditorAccountInfo[] = [
      { name: 'personal', isActive: false, lastModified: 1716889200 },
      { name: 'work', isActive: true, lastModified: 1716889900 },
    ];
    vi.mocked(api.loadEditorAccounts).mockResolvedValue(mockAccounts);

    render(
      <AccountSwitcher
        editorId="cursor"
        editorName="Cursor"
        messageApi={mockMessageApi}
      />,
    );

    // 等待列表加载
    await waitFor(() => {
      expect(screen.getByText('work')).toBeInTheDocument();
      expect(screen.getByText('personal')).toBeInTheDocument();
    });

    expect(screen.getByText('当前激活')).toBeInTheDocument();

    // 1. 点击切换非激活的账号
    const switchButtons = screen.getAllByRole('button', { name: '切换' });
    // active 账号的切换按钮应当是 disabled 的，所以列表中只有一个非 disabled 的切换按钮
    const activeSwitchBtn = switchButtons.find(
      (btn) => !btn.hasAttribute('disabled'),
    );
    expect(activeSwitchBtn).toBeInTheDocument();

    vi.mocked(api.switchEditorAccount).mockResolvedValue(undefined);
    await userEvent.click(activeSwitchBtn!);

    expect(api.switchEditorAccount).toHaveBeenCalledWith('cursor', 'personal');
    expect(mockMessageApi.success).toHaveBeenCalledWith(
      '已切换到账号 [personal]！请确保完全退出并重启 Cursor 生效。',
    );

    // 2. 点击删除账号
    const deleteButtons = screen.getAllByRole('button', { name: '删除' });
    vi.mocked(api.deleteEditorAccount).mockResolvedValue(undefined);
    // 删除第一个账号 (personal)
    await userEvent.click(deleteButtons[0]);

    expect(api.deleteEditorAccount).toHaveBeenCalledWith('cursor', 'personal');
    expect(mockMessageApi.success).toHaveBeenCalledWith(
      '已删除账号备份: personal',
    );
  });
});
