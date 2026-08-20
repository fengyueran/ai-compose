import { Button, Message } from '@xinghunm/compass-ui';
import { useEffect, useState, useCallback } from 'react';
import {
  type EditorId,
  type EditorAccountInfo,
  type EditorUsageInfo,
  loadEditorAccounts,
  saveCurrentEditorAccount,
  switchEditorAccount,
  deleteEditorAccount,
  fetchEditorAccountUsage,
} from '../../../shared';
import { AccountSwitcherWrapper } from './account-switcher.styles';

interface AccountSwitcherProps {
  editorId: EditorId;
  editorName: string;
  messageApi: ReturnType<typeof Message.useMessage>[0];
}

export function AccountSwitcher({
  editorId,
  editorName,
  messageApi,
}: AccountSwitcherProps) {
  const [accounts, setAccounts] = useState<EditorAccountInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [newAccountName, setNewAccountName] = useState('');
  const [saving, setSaving] = useState(false);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const [usages, setUsages] = useState<
    Record<string, (EditorUsageInfo & { error?: string }) | null>
  >({});
  const [usageLoading, setUsageLoading] = useState<Record<string, boolean>>({});

  const loadUsages = useCallback(
    async (list: EditorAccountInfo[]) => {
      if (editorId !== 'cursor' && editorId !== 'codex') return;

      const tasks = list.map(async (acct) => {
        const queryName = acct.isActive ? undefined : acct.name;
        const cacheKey = acct.name;

        setUsageLoading((prev) => ({ ...prev, [cacheKey]: true }));
        try {
          const info = await fetchEditorAccountUsage(editorId, queryName);
          setUsages((prev) => ({ ...prev, [cacheKey]: info }));
        } catch (err) {
          console.warn(`Failed to fetch usage for ${acct.name}:`, err);
          const errMsg = err instanceof Error ? err.message : String(err);
          setUsages((prev) => ({
            ...prev,
            [cacheKey]: { error: errMsg } as unknown as EditorUsageInfo & {
              error?: string;
            },
          }));
        } finally {
          setUsageLoading((prev) => ({ ...prev, [cacheKey]: false }));
        }
      });

      await Promise.all(tasks);
    },
    [editorId],
  );

  const fetchAccounts = useCallback(async () => {
    if (editorId === 'antigravity') {
      setAccounts([]);
      return;
    }
    setLoading(true);
    try {
      const data = await loadEditorAccounts(editorId);
      setAccounts(data);
      if (editorId === 'cursor' || editorId === 'codex') {
        void loadUsages(data);
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      messageApi.error(`获取账号列表失败: ${errMsg}`);
    } finally {
      setLoading(false);
    }
  }, [editorId, messageApi, loadUsages]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setUsages({});
    setUsageLoading({});
    void fetchAccounts();
  }, [fetchAccounts]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleSave = async () => {
    const trimmed = newAccountName.trim();
    if (!trimmed) {
      messageApi.warning('请输入账号备注名称');
      return;
    }

    // 账号格式限制：允许字母、数字、下划线、短横线、@ 及 .
    const nameRegex = /^[a-zA-Z0-9_.@-]+$/;
    if (!nameRegex.test(trimmed) || trimmed.includes('..')) {
      messageApi.warning(
        '账号名称仅允许字母、数字、下划线、短横线、@ 及 . (且不能包含连续点)',
      );
      return;
    }

    setSaving(true);
    try {
      await saveCurrentEditorAccount(editorId, trimmed);
      messageApi.success(`当前 ${editorName} 账号已备份为: ${trimmed}`);
      setNewAccountName('');
      await fetchAccounts();
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      messageApi.error(`保存账号失败: ${errMsg}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSwitch = async (name: string) => {
    setActionInProgress(name);
    try {
      await switchEditorAccount(editorId, name);
      messageApi.success(
        `已切换到账号 [${name}]！请确保完全退出并重启 ${editorName} 生效。`,
      );
      await fetchAccounts();
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      messageApi.error(`切换账号失败: ${errMsg}`);
    } finally {
      setActionInProgress(null);
    }
  };

  const handleDelete = async (name: string) => {
    setActionInProgress(name);
    try {
      await deleteEditorAccount(editorId, name);
      messageApi.success(`已删除账号备份: ${name}`);
      await fetchAccounts();
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      messageApi.error(`删除备份失败: ${errMsg}`);
    } finally {
      setActionInProgress(null);
    }
  };

  const handleRefresh = async (acct: EditorAccountInfo) => {
    if (editorId !== 'cursor' && editorId !== 'codex') return;
    const queryName = acct.isActive ? undefined : acct.name;
    const cacheKey = acct.name;

    setUsageLoading((prev) => ({ ...prev, [cacheKey]: true }));
    try {
      const info = await fetchEditorAccountUsage(editorId, queryName);
      setUsages((prev) => ({ ...prev, [cacheKey]: info }));
      messageApi.success(`已刷新 [${acct.name}] 额度`);
    } catch (err) {
      console.warn(`Failed to fetch usage for ${acct.name}:`, err);
      const errMsg = err instanceof Error ? err.message : String(err);
      setUsages((prev) => ({
        ...prev,
        [cacheKey]: { error: errMsg } as unknown as EditorUsageInfo & {
          error?: string;
        },
      }));
      messageApi.error(`刷新 [${acct.name}] 额度失败: ${errMsg}`);
    } finally {
      setUsageLoading((prev) => ({ ...prev, [cacheKey]: false }));
    }
  };

  const isRefreshingAll =
    accounts.length > 0 &&
    accounts.some((acct) => Boolean(usageLoading[acct.name]));

  const handleRefreshAll = async () => {
    if (editorId !== 'cursor' && editorId !== 'codex') return;
    if (accounts.length === 0) return;
    try {
      await loadUsages(accounts);
      messageApi.success('已刷新所有账号额度');
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      messageApi.error(`刷新额度失败: ${errMsg}`);
    }
  };

  if (editorId === 'antigravity') {
    return null;
  }

  return (
    <AccountSwitcherWrapper className="account-switcher">
      <div className="account-switcher__header">
        <div className="account-switcher__header-info">
          <h3 className="account-switcher__title">{editorName} 多账号管理</h3>
          <p className="account-switcher__desc">
            将当前编辑器的登录态（Access Token /
            Session）保存为备份，以便在多个账号间快速一键切换。
          </p>
        </div>
        {(editorId === 'cursor' || editorId === 'codex') &&
          accounts.length > 0 && (
            <Button
              type="button"
              className="account-switcher__refresh-all-btn"
              disabled={
                saving ||
                loading ||
                actionInProgress !== null ||
                isRefreshingAll
              }
              loading={isRefreshingAll}
              onClick={handleRefreshAll}
            >
              刷新全部额度
            </Button>
          )}
      </div>

      <div className="account-switcher__input-group">
        <input
          type="text"
          className="account-switcher__input"
          placeholder="例如: work, user@gmail.com"
          value={newAccountName}
          disabled={saving || loading || actionInProgress !== null}
          onChange={(e) => setNewAccountName(e.target.value)}
          aria-label="账号备注名称"
        />
        <Button
          type="button"
          className="account-switcher__save-btn"
          disabled={saving || loading || actionInProgress !== null}
          loading={saving}
          onClick={handleSave}
        >
          备份当前登录态
        </Button>
      </div>

      <div className="account-switcher__warning">
        <strong>⚠️ 切换注意事项：</strong>
        <ul>
          <li>切换前请确保已**完全关闭** {editorName}。</li>
          <li>
            切换后必须**重新启动** {editorName}{' '}
            才能使新账号的登录凭据和云端历史记录生效。
          </li>
          {editorId === 'cursor' && (
            <li>
              Cursor 的切换是整体替换其本地全局配置，各账号的聊天记录 (Chat) 和
              Composer 状态会自动隔离。
            </li>
          )}
        </ul>
      </div>

      <div className="account-switcher__list">
        {loading && accounts.length === 0 ? (
          <div className="account-switcher__empty">正在加载账号列表...</div>
        ) : accounts.length === 0 ? (
          <div className="account-switcher__empty">
            暂无已备份账号。在上方输入备注名即可备份。
          </div>
        ) : (
          accounts.map((acct) => (
            <div
              key={acct.name}
              className={`account-item${acct.isActive ? ' account-item--active' : ''}`}
            >
              <div className="account-item__info">
                <div className="account-item__name-row">
                  <span className="account-item__name">{acct.name}</span>
                  {acct.isActive && (
                    <span className="account-item__active-badge">当前激活</span>
                  )}
                </div>
                {(editorId === 'cursor' || editorId === 'codex') && (
                  <div className="account-item__usage-zone">
                    {usageLoading[acct.name] ? (
                      <div className="account-item__usage-skeleton">
                        <div className="skeleton-line skeleton-email" />
                        <div className="skeleton-line skeleton-progress" />
                        <div className="skeleton-line skeleton-meta" />
                      </div>
                    ) : usages[acct.name] && !usages[acct.name]?.error ? (
                      (() => {
                        const usage = usages[acct.name]!;
                        if (editorId === 'cursor') {
                          const totalPercent = usage.totalPercentUsed ?? 0;
                          const apiPercent = usage.apiPercentUsed;
                          // Cursor often reports autoPercentUsed=0 even when Auto is active;
                          // Auto mode is measured against totalPercentUsed (see autoModelSelectedDisplayMessage).
                          // Only surface a dedicated Auto pool bar when the API returns a real value.
                          const autoPoolPercent =
                            usage.autoPercentUsed != null &&
                            usage.autoPercentUsed > 0
                              ? usage.autoPercentUsed
                              : null;
                          const hasApiSplit = apiPercent != null;
                          const resetStr = usage.billingCycleEnd
                            ? new Date(usage.billingCycleEnd).toLocaleString(
                                [],
                                {
                                  year: 'numeric',
                                  month: 'numeric',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  hour12: false,
                                },
                              )
                            : '--';
                          const formatPoolStatus = (
                            percent: number,
                            exhaustedHint?: string,
                          ) => {
                            if (percent >= 100) {
                              return exhaustedHint ?? '额度用尽';
                            }
                            return `剩余 ${(100 - percent).toFixed(1)}%`;
                          };
                          const renderPoolRow = (
                            label: string,
                            percent: number,
                            barClass: string,
                            exhaustedHint?: string,
                            title?: string,
                          ) => (
                            <div
                              className="account-item__codex-row"
                              key={label}
                              title={title}
                            >
                              <div className="account-item__codex-row-header">
                                <span className="account-item__codex-row-label">
                                  {label}
                                </span>
                              </div>
                              <div className="account-item__codex-progress-container">
                                <div
                                  className={`account-item__codex-progress-bar ${barClass}`}
                                  style={{
                                    width: `${Math.min(100, percent)}%`,
                                  }}
                                />
                              </div>
                              <div className="account-item__codex-row-status">
                                已用 {percent.toFixed(1)}% (
                                {formatPoolStatus(percent, exhaustedHint)})
                              </div>
                            </div>
                          );
                          return (
                            <div className="account-item__usage-detail">
                              <div className="account-item__usage-meta">
                                <span
                                  className="account-item__usage-email"
                                  title={usage.email}
                                >
                                  {usage.email}
                                </span>
                                <span className="account-item__usage-reset">
                                  {resetStr} 重置
                                </span>
                              </div>
                              {hasApiSplit ? (
                                <div className="account-item__codex-rows">
                                  {renderPoolRow(
                                    'API 额度',
                                    apiPercent,
                                    'account-item__codex-progress-bar--primary',
                                    '指定模型用尽，请用 Auto',
                                    '手动选择 Claude/GPT 等模型时消耗；用尽后只能切 Auto',
                                  )}
                                  {autoPoolPercent != null &&
                                    renderPoolRow(
                                      'Auto 池',
                                      autoPoolPercent,
                                      'account-item__codex-progress-bar--secondary',
                                      undefined,
                                      '独立 Auto/Composer 池（仅当接口返回有效占用时显示）',
                                    )}
                                  {renderPoolRow(
                                    '包含用量',
                                    totalPercent,
                                    'account-item__codex-progress-bar--total',
                                    undefined,
                                    '套餐包含总进度；Cursor 在 Auto 模式下显示的就是这项',
                                  )}
                                </div>
                              ) : (
                                <>
                                  <div className="account-item__usage-progress-container">
                                    <div
                                      className="account-item__usage-progress-bar"
                                      style={{
                                        width: `${Math.min(100, totalPercent)}%`,
                                      }}
                                    />
                                  </div>
                                  <div className="account-item__usage-status">
                                    已用 {totalPercent.toFixed(1)}% (
                                    {formatPoolStatus(totalPercent)})
                                  </div>
                                </>
                              )}
                            </div>
                          );
                        } else {
                          const codexUsage = usage.codexUsage;
                          if (!codexUsage) {
                            return (
                              <div className="account-item__usage-error">
                                额度数据解析失败
                              </div>
                            );
                          }

                          const formatResetTime = (
                            ms: number | null | undefined,
                            label: string | null | undefined,
                          ) => {
                            if (ms == null || label == null) return '--';
                            const isShort =
                              label.toLowerCase().includes('h') &&
                              !label.toLowerCase().includes('month');
                            try {
                              // Hour-based windows (e.g. 5h / 168h) can span midnight or multiple days,
                              // so always include month/day alongside time.
                              if (isShort) {
                                return new Date(ms).toLocaleString([], {
                                  month: 'numeric',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  hour12: false,
                                });
                              }
                              return new Date(ms).toLocaleDateString([], {
                                month: 'short',
                                day: 'numeric',
                              });
                            } catch {
                              return '--';
                            }
                          };

                          return (
                            <div className="account-item__usage-detail">
                              <div
                                className="account-item__usage-meta"
                                style={{ marginBottom: '2px' }}
                              >
                                <span
                                  className="account-item__usage-email"
                                  title={usage.email}
                                >
                                  {usage.email}
                                </span>
                              </div>
                              <div className="account-item__codex-rows">
                                <div className="account-item__codex-row">
                                  <div className="account-item__codex-row-header">
                                    <span className="account-item__codex-row-label">
                                      {codexUsage.primaryWindowLabel} 额度
                                    </span>
                                    <span className="account-item__codex-row-reset">
                                      {formatResetTime(
                                        codexUsage.primaryResetAt,
                                        codexUsage.primaryWindowLabel,
                                      )}{' '}
                                      重置
                                    </span>
                                  </div>
                                  <div className="account-item__codex-progress-container">
                                    <div
                                      className="account-item__codex-progress-bar account-item__codex-progress-bar--primary"
                                      style={{
                                        width: `${Math.min(100, codexUsage.primaryUsedPercent ?? 0)}%`,
                                      }}
                                    />
                                  </div>
                                  <div className="account-item__codex-row-status">
                                    已用{' '}
                                    {(
                                      codexUsage.primaryUsedPercent ?? 0
                                    ).toFixed(1)}
                                    % (
                                    {(codexUsage.primaryUsedPercent ?? 0) >= 100
                                      ? '已受限'
                                      : `剩余 ${(100 - (codexUsage.primaryUsedPercent ?? 0)).toFixed(1)}%`}
                                    )
                                  </div>
                                </div>
                                {codexUsage.secondaryUsedPercent != null &&
                                  codexUsage.secondaryResetAt != null &&
                                  codexUsage.secondaryWindowLabel != null && (
                                    <div className="account-item__codex-row">
                                      <div className="account-item__codex-row-header">
                                        <span className="account-item__codex-row-label">
                                          {codexUsage.secondaryWindowLabel} 额度
                                        </span>
                                        <span className="account-item__codex-row-reset">
                                          {formatResetTime(
                                            codexUsage.secondaryResetAt,
                                            codexUsage.secondaryWindowLabel,
                                          )}{' '}
                                          重置
                                        </span>
                                      </div>
                                      <div className="account-item__codex-progress-container">
                                        <div
                                          className="account-item__codex-progress-bar account-item__codex-progress-bar--secondary"
                                          style={{
                                            width: `${Math.min(100, codexUsage.secondaryUsedPercent ?? 0)}%`,
                                          }}
                                        />
                                      </div>
                                      <div className="account-item__codex-row-status">
                                        &nbsp;已用{' '}
                                        {(
                                          codexUsage.secondaryUsedPercent ?? 0
                                        ).toFixed(1)}
                                        % (
                                        {(codexUsage.secondaryUsedPercent ??
                                          0) >= 100
                                          ? '已受限'
                                          : `剩余 ${(100 - (codexUsage.secondaryUsedPercent ?? 0)).toFixed(1)}%`}
                                        )
                                      </div>
                                    </div>
                                  )}
                              </div>
                            </div>
                          );
                        }
                      })()
                    ) : usages[acct.name]?.error ? (
                      <div className="account-item__usage-error">
                        {usages[acct.name]?.error}
                      </div>
                    ) : (
                      <div className="account-item__usage-error">
                        未能拉取使用状态 (Token 已失效或网络不通)
                      </div>
                    )}
                  </div>
                )}
                <span className="account-item__time">
                  备份时间:{' '}
                  {new Date(acct.lastModified * 1000).toLocaleString()}
                </span>
              </div>
              <div className="account-item__actions">
                {(editorId === 'cursor' || editorId === 'codex') && (
                  <Button
                    type="button"
                    className="account-item__btn"
                    disabled={
                      saving ||
                      loading ||
                      actionInProgress !== null ||
                      Boolean(usageLoading[acct.name])
                    }
                    loading={Boolean(usageLoading[acct.name])}
                    onClick={() => handleRefresh(acct)}
                  >
                    刷新
                  </Button>
                )}
                <Button
                  type="button"
                  className="account-item__btn"
                  disabled={
                    saving ||
                    loading ||
                    actionInProgress !== null ||
                    acct.isActive
                  }
                  loading={actionInProgress === acct.name}
                  onClick={() => handleSwitch(acct.name)}
                >
                  切换
                </Button>
                <Button
                  type="button"
                  className="account-item__btn"
                  danger
                  disabled={saving || loading || actionInProgress !== null}
                  onClick={() => handleDelete(acct.name)}
                >
                  删除
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </AccountSwitcherWrapper>
  );
}
