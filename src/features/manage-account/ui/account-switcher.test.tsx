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
    fetchEditorAccountUsage: vi.fn(),
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
    vi.mocked(api.fetchEditorAccountUsage).mockImplementation(
      async (editorId) => {
        if (editorId === 'cursor') {
          return {
            email: 'test@domain.com',
            billingCycleEnd: 1781330313000,
            totalPercentUsed: 42.5,
            limit: 2000,
          };
        } else {
          return {
            email: 'codex@domain.com',
            codexUsage: {
              primaryUsedPercent: 60.0,
              primaryResetAt: 1781330313000,
              primaryWindowLabel: '5h',
              secondaryUsedPercent: 30.0,
              secondaryResetAt: 1781330313000,
              secondaryWindowLabel: 'Weekly',
            },
          };
        }
      },
    );
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

  test('renders cursor total-only usage when pool split is absent', async () => {
    const mockAccounts: api.EditorAccountInfo[] = [
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

    await waitFor(() => {
      expect(screen.getByText('test@domain.com')).toBeInTheDocument();
      expect(screen.getByText(/已用 42.5%/)).toBeInTheDocument();
    });

    expect(screen.queryByText('API 额度')).not.toBeInTheDocument();
    expect(screen.queryByText('Auto 额度')).not.toBeInTheDocument();
  });

  test('renders cursor API split; Auto uses included total, ignores autoPercent=0', async () => {
    const mockAccounts: api.EditorAccountInfo[] = [
      { name: 'school', isActive: true, lastModified: 1716889900 },
    ];
    vi.mocked(api.loadEditorAccounts).mockResolvedValue(mockAccounts);
    // Mirrors real GetCurrentPeriodUsage: autoPercentUsed is often 0 while
    // Auto mode is actually measured by totalPercentUsed (~51%).
    vi.mocked(api.fetchEditorAccountUsage).mockResolvedValue({
      email: 'g0235357@umn.edu',
      billingCycleEnd: 1781330313000,
      totalPercentUsed: 50.5,
      apiPercentUsed: 100,
      autoPercentUsed: 0,
      limit: 2000,
    });

    render(
      <AccountSwitcher
        editorId="cursor"
        editorName="Cursor"
        messageApi={mockMessageApi}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('API 额度')).toBeInTheDocument();
      expect(screen.getByText('包含用量')).toBeInTheDocument();
    });

    expect(screen.getByText(/指定模型用尽，请用 Auto/)).toBeInTheDocument();
    expect(screen.getByText(/已用 50.5%/)).toBeInTheDocument();
    const cursorReset = new Date(1781330313000).toLocaleString([], {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    expect(screen.getByText(`${cursorReset} 重置`)).toBeInTheDocument();
    // Do not show a misleading "Auto 0%" bar when API reports 0
    expect(screen.queryByText('Auto 池')).not.toBeInTheDocument();
    expect(screen.queryByText(/已用 0.0%/)).not.toBeInTheDocument();
  });

  test('renders dedicated Auto pool only when autoPercentUsed > 0', async () => {
    const mockAccounts: api.EditorAccountInfo[] = [
      { name: 'school', isActive: true, lastModified: 1716889900 },
    ];
    vi.mocked(api.loadEditorAccounts).mockResolvedValue(mockAccounts);
    vi.mocked(api.fetchEditorAccountUsage).mockResolvedValue({
      email: 'user@example.com',
      billingCycleEnd: 1781330313000,
      totalPercentUsed: 40,
      apiPercentUsed: 80,
      autoPercentUsed: 12.3,
      limit: 2000,
    });

    render(
      <AccountSwitcher
        editorId="cursor"
        editorName="Cursor"
        messageApi={mockMessageApi}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Auto 池')).toBeInTheDocument();
      expect(screen.getByText(/已用 12.3%/)).toBeInTheDocument();
    });
  });

  test('renders usage rows for codex accounts', async () => {
    const mockAccounts: api.EditorAccountInfo[] = [
      { name: 'codex-work', isActive: true, lastModified: 1716889900 },
    ];
    vi.mocked(api.loadEditorAccounts).mockResolvedValue(mockAccounts);

    render(
      <AccountSwitcher
        editorId="codex"
        editorName="Codex"
        messageApi={mockMessageApi}
      />,
    );

    // 等待列表加载和使用额度渲染
    await waitFor(() => {
      expect(screen.getByText('codex-work')).toBeInTheDocument();
      expect(screen.getByText('codex@domain.com')).toBeInTheDocument();
      expect(screen.getByText('5h 额度')).toBeInTheDocument();
      expect(screen.getByText('Weekly 额度')).toBeInTheDocument();
    });

    expect(screen.getByText(/已用 60.0%/)).toBeInTheDocument();
    expect(screen.getByText(/已用 30.0%/)).toBeInTheDocument();

    // Hour-based window reset must include date (month/day), not only HH:mm
    const shortReset = new Date(1781330313000).toLocaleString([], {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    expect(screen.getByText(`${shortReset} 重置`)).toBeInTheDocument();

    // Weekly window still shows date-only style
    const weeklyReset = new Date(1781330313000).toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
    });
    expect(screen.getByText(`${weeklyReset} 重置`)).toBeInTheDocument();
  });

  test('shows date and time for 168h codex reset window', async () => {
    const mockAccounts: api.EditorAccountInfo[] = [
      { name: 'apple', isActive: false, lastModified: 1716889900 },
    ];
    vi.mocked(api.loadEditorAccounts).mockResolvedValue(mockAccounts);
    // 2026-08-06 12:26 local-ish epoch for deterministic formatting via toLocaleString
    const resetAt = new Date(2026, 7, 6, 12, 26, 0).getTime();
    vi.mocked(api.fetchEditorAccountUsage).mockResolvedValue({
      email: 'jwhfzj2mwm@privaterel...',
      codexUsage: {
        primaryUsedPercent: 100.0,
        primaryResetAt: resetAt,
        primaryWindowLabel: '168h',
      },
    });

    render(
      <AccountSwitcher
        editorId="codex"
        editorName="Codex"
        messageApi={mockMessageApi}
      />,
    );

    const expected = new Date(resetAt).toLocaleString([], {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    await waitFor(() => {
      expect(screen.getByText('168h 额度')).toBeInTheDocument();
      expect(screen.getByText(`${expected} 重置`)).toBeInTheDocument();
    });

    // Must not be time-only (e.g. "12:26 重置")
    expect(screen.queryByText(/^12:26 重置$/)).not.toBeInTheDocument();
  });

  test('renders usage rows for codex free accounts (single window)', async () => {
    const mockAccounts: api.EditorAccountInfo[] = [
      { name: 'codex-free', isActive: true, lastModified: 1716889900 },
    ];
    vi.mocked(api.loadEditorAccounts).mockResolvedValue(mockAccounts);
    vi.mocked(api.fetchEditorAccountUsage).mockResolvedValue({
      email: 'free-user@domain.com',
      codexUsage: {
        primaryUsedPercent: 43.0,
        primaryResetAt: 1781330313000,
        primaryWindowLabel: 'Monthly',
      },
    });

    render(
      <AccountSwitcher
        editorId="codex"
        editorName="Codex"
        messageApi={mockMessageApi}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('codex-free')).toBeInTheDocument();
      expect(screen.getByText('free-user@domain.com')).toBeInTheDocument();
      expect(screen.getByText('Monthly 额度')).toBeInTheDocument();
    });

    expect(screen.queryByText('Weekly 额度')).not.toBeInTheDocument();
    expect(screen.getByText(/已用 43.0%/)).toBeInTheDocument();
  });
});
