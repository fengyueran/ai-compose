import { Button, Message, Modal } from '@xinghunm/compass-ui';
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
  prepareNewAccountLogin,
} from '../../../shared';
import { AccountSwitcherWrapper } from './account-switcher.styles';

function UserPlusIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <line x1="19" y1="8" x2="19" y2="14" />
      <line x1="22" y1="11" x2="16" y2="11" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 2v6h-6" />
      <path d="M3 12a9 9 0 0 1 15.5-6.36L21 8" />
      <path d="M3 22v-6h6" />
      <path d="M21 12a9 9 0 0 1-15.5 6.36L3 16" />
    </svg>
  );
}

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
  const [isPrepareModalOpen, setIsPrepareModalOpen] = useState(false);
  const [preparing, setPreparing] = useState(false);

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

  const handlePrepareNewAccount = async () => {
    setPreparing(true);
    try {
      await prepareNewAccountLogin(editorId);
      messageApi.success(
        `已安全清理 ${editorName} 本地登录态！请启动 ${editorName} 登录新账号后，再来此处备份。`,
      );
      setIsPrepareModalOpen(false);
      await fetchAccounts();
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      messageApi.error(`准备登录新账号失败: ${errMsg}`);
    } finally {
      setPreparing(false);
    }
  };

  const activeAccount = accounts.find((acct) => acct.isActive);

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
        <div className="account-switcher__header-actions">
          {(editorId === 'cursor' || editorId === 'codex') && (
            <Button
              type="button"
              className="account-switcher__prepare-new-btn"
              disabled={
                saving ||
                loading ||
                actionInProgress !== null ||
                isRefreshingAll ||
                preparing
              }
              onClick={() => setIsPrepareModalOpen(true)}
            >
              <span className="btn-icon">
                <UserPlusIcon />
              </span>
              <span>准备登录新账号</span>
            </Button>
          )}
          {(editorId === 'cursor' || editorId === 'codex') &&
            accounts.length > 0 && (
              <Button
                type="button"
                className="account-switcher__refresh-all-btn"
                disabled={
                  saving ||
                  loading ||
                  actionInProgress !== null ||
                  isRefreshingAll ||
                  preparing
                }
                loading={isRefreshingAll}
                onClick={handleRefreshAll}
              >
                {!isRefreshingAll && (
                  <span className="btn-icon">
                    <RefreshIcon />
                  </span>
                )}
                <span>刷新全部额度</span>
              </Button>
            )}
        </div>
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
        <span className="account-switcher__warning-icon" aria-hidden="true">
          ⚠️
        </span>
        <span className="account-switcher__warning-text">
          <strong>切换须知：</strong>
          切换前请确保已完全退出 {editorName}，切换后重新启动即可使新账号生效。
          {editorId === 'cursor' && (
            <span className="account-switcher__warning-sub">
              （各账号 Chat 与 Composer 状态已自动隔离）
            </span>
          )}
        </span>
      </div>

      <div className="account-switcher__list">
        {loading && accounts.length === 0 ? (
          <div className="account-switcher__empty">正在加载账号列表...</div>
        ) : accounts.length === 0 ? (
          <div className="account-switcher__empty">
            暂无已备份账号。在上方输入备注名即可备份。
          </div>
        ) : (
          accounts.map((acct) => {
            const usageInfo = usages[acct.name];
            const accountEmail =
              usageInfo && !usageInfo.error ? usageInfo.email : undefined;

            return (
              <div
                key={acct.name}
                className={`account-item${acct.isActive ? ' account-item--active' : ''}`}
              >
                <div className="account-item__header">
                  <div className="account-item__title-group">
                    <span className="account-item__name">{acct.name}</span>
                    {acct.isActive && (
                      <span className="account-item__active-badge">
                        <span
                          className="account-item__active-dot"
                          aria-hidden="true"
                        />
                        当前激活
                      </span>
                    )}
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

                {(editorId === 'cursor' || editorId === 'codex') && (
                  <div className="account-item__usage-zone">
                    {usageLoading[acct.name] ? (
                      <div className="account-item__usage-skeleton">
                        <div className="skeleton-line skeleton-progress" />
                      </div>
                    ) : usages[acct.name] && !usages[acct.name]?.error ? (
                      (() => {
                        const usage = usages[acct.name]!;
                        if (editorId === 'cursor') {
                          const totalPercent = usage.totalPercentUsed ?? 0;
                          const apiPercent = usage.apiPercentUsed;
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
                            resetText?: string,
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
                                {resetText && (
                                  <span className="account-item__codex-row-reset">
                                    {resetText} 重置
                                  </span>
                                )}
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
                          return hasApiSplit ? (
                            <div className="account-item__codex-rows">
                              {renderPoolRow(
                                'API 额度',
                                apiPercent,
                                'account-item__codex-progress-bar--primary',
                                '指定模型用尽，请用 Auto',
                                '手动选择 Claude/GPT 等模型时消耗；用尽后只能切 Auto',
                                resetStr,
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
                            <div className="account-item__codex-rows">
                              <div className="account-item__codex-row">
                                <div className="account-item__codex-row-header">
                                  <span className="account-item__codex-row-label">
                                    包含用量
                                  </span>
                                  <span className="account-item__codex-row-reset">
                                    {resetStr} 重置
                                  </span>
                                </div>
                                <div className="account-item__codex-progress-container">
                                  <div
                                    className="account-item__codex-progress-bar account-item__codex-progress-bar--total"
                                    style={{
                                      width: `${Math.min(100, totalPercent)}%`,
                                    }}
                                  />
                                </div>
                                <div className="account-item__codex-row-status">
                                  已用 {totalPercent.toFixed(1)}% (
                                  {formatPoolStatus(totalPercent)})
                                </div>
                              </div>
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
                                  {(codexUsage.primaryUsedPercent ?? 0).toFixed(
                                    1,
                                  )}
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
                                      已用{' '}
                                      {(
                                        codexUsage.secondaryUsedPercent ?? 0
                                      ).toFixed(1)}
                                      % (
                                      {(codexUsage.secondaryUsedPercent ?? 0) >=
                                      100
                                        ? '已受限'
                                        : `剩余 ${(100 - (codexUsage.secondaryUsedPercent ?? 0)).toFixed(1)}%`}
                                      )
                                    </div>
                                  </div>
                                )}
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

                <div className="account-item__footer">
                  <div className="account-item__footer-left">
                    {accountEmail && (
                      <span
                        className="account-item__usage-email"
                        title={accountEmail}
                      >
                        {accountEmail}
                      </span>
                    )}
                  </div>
                  <span className="account-item__time">
                    备份时间:{' '}
                    {new Date(acct.lastModified * 1000).toLocaleString()}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {isPrepareModalOpen && (
        <Modal
          isOpen={isPrepareModalOpen}
          onCancel={() => {
            if (!preparing) {
              setIsPrepareModalOpen(false);
            }
          }}
          title={`准备登录新的 ${editorName} 账号`}
          width={520}
          footer={
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '8px',
              }}
            >
              <Button
                type="button"
                disabled={preparing}
                onClick={() => setIsPrepareModalOpen(false)}
              >
                取消
              </Button>
              <Button
                type="button"
                disabled={preparing}
                loading={preparing}
                onClick={handlePrepareNewAccount}
              >
                确认清理并准备登录
              </Button>
            </div>
          }
        >
          <div style={{ padding: '8px 0' }}>
            <p
              style={{
                margin: '0 0 12px 0',
                fontSize: '0.9rem',
                color: 'var(--text-main)',
                lineHeight: 1.5,
              }}
            >
              此操作将在<strong>本地静默清理</strong>
              当前编辑器的登录凭据与缓存，使 {editorName} 恢复为
              <strong>未登录状态</strong>。
            </p>
            <div
              style={{
                background: 'var(--bg-tag, #f5f5f5)',
                padding: '12px 14px',
                borderRadius: '8px',
                marginBottom: '14px',
                fontSize: '0.85rem',
                lineHeight: 1.6,
                color: 'var(--text-soft)',
              }}
            >
              <strong>💡 操作须知：</strong>
              <ol style={{ margin: '6px 0 0 0', paddingLeft: '18px' }}>
                <li>
                  请确保已<strong>完全退出</strong> {editorName}（按{' '}
                  <code>Cmd + Q</code> 完全关闭）。
                </li>
                <li>
                  本操作<strong>绝不会</strong>
                  向服务端发送注销请求，所有已备份账号在服务端的有效性
                  <strong>完好保留</strong>。
                </li>
                <li>
                  {activeAccount ? (
                    <>
                      当前已激活的账号 [<strong>{activeAccount.name}</strong>]
                      会在清理前自动将最新凭据写回备份。
                    </>
                  ) : (
                    <span style={{ color: 'var(--error-color, #ff4d4f)' }}>
                      提示：若当前存在未备份的登录凭据，清理后将丢失，建议先在上方输入备注名备份。
                    </span>
                  )}
                </li>
                <li>
                  清理完成后，重新启动 {editorName}{' '}
                  登录您的新账号，随后返回此处输入备注并点击“备份当前登录态”。
                </li>
              </ol>
            </div>
          </div>
        </Modal>
      )}
    </AccountSwitcherWrapper>
  );
}
