import styled from '@emotion/styled';

export const AccountSwitcherWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px 20px;
  background: var(--bg-panel, #ffffff);
  border: 1px solid var(--panel-border, rgba(0, 0, 0, 0.08));
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.02);

  .account-switcher__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
  }

  .account-switcher__header-info {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
  }

  .account-switcher__title {
    font-size: 1.05rem;
    font-weight: 600;
    color: var(--text-main);
    margin: 0;
  }

  .account-switcher__desc {
    font-size: 0.8rem;
    color: var(--text-soft);
    margin: 0;
    line-height: 1.35;
  }

  .account-switcher__header-actions {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
  }

  .account-switcher__prepare-new-btn,
  .account-switcher__refresh-all-btn {
    height: 32px;
    padding: 0 12px;
    font-size: 0.8rem;
    font-weight: 500;
    flex-shrink: 0;
    border-radius: 6px;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);

    .compass-button-content {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      line-height: 1;
    }

    .btn-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      line-height: 0;
      flex-shrink: 0;
      margin-right: 6px;

      svg {
        display: block;
      }
    }
  }

  /* 准备登录新账号：辅助轮廓按钮风格 */
  .account-switcher__prepare-new-btn {
    background: #ffffff;
    border: 1px solid var(--panel-border, rgba(0, 0, 0, 0.16));
    color: var(--text-main, #374151);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);

    &:hover:not(:disabled) {
      background: rgba(0, 0, 0, 0.025);
      border-color: rgba(0, 0, 0, 0.28);
      color: var(--text-main, #111827);
    }
  }

  /* 刷新全部额度：高频主操作实底按钮风格 */
  .account-switcher__refresh-all-btn {
    background: linear-gradient(
      135deg,
      var(--accent, #c55d33) 0%,
      #a84822 100%
    );
    border: 1px solid #993f1c;
    color: #ffffff;
    box-shadow: 0 1px 3px rgba(197, 93, 51, 0.25);

    &:hover:not(:disabled) {
      background: linear-gradient(135deg, #d4653a 0%, #b85028 100%);
      border-color: #b85028;
      box-shadow: 0 3px 8px rgba(197, 93, 51, 0.35);
      color: #ffffff;
      transform: translateY(-0.5px);
    }

    &:active:not(:disabled) {
      transform: translateY(0);
      box-shadow: 0 1px 2px rgba(197, 93, 51, 0.2);
    }
  }

  .account-switcher__input-group {
    display: flex;
    gap: 8px;
    align-items: center;
    margin-bottom: 0;
  }

  .account-switcher__input {
    flex: 1;
    height: 34px;
    padding: 0 12px;
    border: 1px solid var(--panel-border, rgba(0, 0, 0, 0.15));
    border-radius: 6px;
    font-size: 0.85rem;
    outline: none;
    background: var(--bg-input, #ffffff);
    color: var(--text-main);
    transition: border-color 0.2s;

    &:focus {
      border-color: var(--accent-strong, #ff8c00);
    }

    &::placeholder {
      color: var(--text-faint);
    }
  }

  .account-switcher__save-btn {
    height: 34px;
    flex-shrink: 0;
    font-size: 0.82rem;
  }

  .account-switcher__warning {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    background: rgba(234, 88, 12, 0.05);
    border: 1px solid rgba(234, 88, 12, 0.15);
    border-radius: 6px;
    color: #c2410c;
    font-size: 0.78rem;
    line-height: 1.4;

    .account-switcher__warning-icon {
      font-size: 0.85rem;
      flex-shrink: 0;
      line-height: 1;
    }

    .account-switcher__warning-text {
      flex: 1;
    }

    .account-switcher__warning-sub {
      color: #ea580c;
      opacity: 0.85;
      margin-left: 4px;
    }
  }

  .account-switcher__list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .account-switcher__empty {
    padding: 20px;
    text-align: center;
    color: var(--text-faint);
    font-size: 0.82rem;
    border: 1px dashed var(--panel-border);
    border-radius: 8px;
  }

  .account-item {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px 16px;
    background: var(--bg-item, #fcfcfc);
    border: 1px solid var(--panel-border, rgba(0, 0, 0, 0.07));
    border-radius: 10px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
    transition: all 0.2s ease;

    &:hover {
      border-color: rgba(0, 0, 0, 0.12);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);
    }

    &.account-item--active {
      background: linear-gradient(180deg, #ffedd5 0%, #fff7ed 100%);
      border: 1.5px solid #fb923c;
      border-left: 6px solid var(--accent, #c55d33);
      box-shadow:
        0 6px 22px rgba(234, 88, 12, 0.16),
        0 1px 4px rgba(0, 0, 0, 0.04);

      .account-item__name {
        font-weight: 700;
        color: #7c2d12;
      }

      .account-item__codex-row {
        background: #ffffff;
        border: 1px solid rgba(234, 88, 12, 0.22);
        box-shadow: 0 2px 6px rgba(197, 93, 51, 0.08);
      }
    }
  }

  .account-item__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    width: 100%;
  }

  .account-item__title-group {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .account-item__name {
    font-weight: 600;
    color: var(--text-main);
    font-size: 0.95rem;
    letter-spacing: -0.01em;
  }

  .account-item__active-badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 2px 9px;
    background: #059669;
    color: #ffffff;
    border: 1px solid #047857;
    font-size: 0.72rem;
    font-weight: 600;
    border-radius: 9999px;
    line-height: 1.2;
    flex-shrink: 0;
    box-shadow: 0 1px 3px rgba(5, 150, 105, 0.25);
  }

  .account-item__active-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #ffffff;
    box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.35);
    animation: activePulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }

  @keyframes activePulse {
    0%,
    100% {
      opacity: 1;
      transform: scale(1);
    }
    50% {
      opacity: 0.55;
      transform: scale(0.85);
    }
  }

  .account-item__actions {
    display: flex;
    gap: 6px;
    flex-shrink: 0;
  }

  .account-item__btn {
    padding: 0 10px;
    height: 28px;
    font-size: 0.8rem;
    border-radius: 6px;
  }

  .account-item__usage-zone {
    width: 100%;
    margin: 0;
  }

  .account-item__usage-skeleton {
    padding: 2px 0;

    .skeleton-line {
      height: 6px;
      background: linear-gradient(
        90deg,
        var(--bg-item, #fcfcfc) 25%,
        var(--panel-border, rgba(0, 0, 0, 0.08)) 37%,
        var(--bg-item, #fcfcfc) 63%
      );
      background-size: 400% 100%;
      animation: shimmer 1.4s ease infinite;
      border-radius: 4px;
    }

    .skeleton-progress {
      width: 100%;
    }
  }

  @keyframes shimmer {
    0% {
      background-position: 100% 50%;
    }
    100% {
      background-position: 0 50%;
    }
  }

  .account-item__usage-error {
    font-size: 0.72rem;
    color: var(--text-faint, #999999);
    font-style: italic;
    padding: 2px 0;
  }

  .account-item__codex-rows {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 10px;
    width: 100%;
  }

  .account-item__codex-row {
    display: flex;
    flex-direction: column;
    gap: 5px;
    background: var(--bg-panel-secondary, rgba(0, 0, 0, 0.02));
    padding: 7px 10px;
    border-radius: 6px;
    border: 1px solid var(--panel-border, rgba(0, 0, 0, 0.04));
    min-width: 0;
  }

  .account-item__codex-row-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.72rem;
    gap: 8px;
  }

  .account-item__codex-row-label {
    font-weight: 600;
    color: var(--text-main, #333333);
    flex-shrink: 0;
  }

  .account-item__codex-row-reset {
    color: var(--accent-strong, #ff8c00);
    background: rgba(255, 140, 0, 0.08);
    padding: 1px 6px;
    border-radius: 4px;
    font-weight: 500;
    font-size: 0.7rem;
    flex-shrink: 0;
    white-space: nowrap;
  }

  .account-item__codex-progress-container {
    height: 4px;
    background: var(--panel-border, rgba(0, 0, 0, 0.08));
    border-radius: 2px;
    overflow: hidden;
  }

  .account-item__codex-progress-bar {
    height: 100%;
    border-radius: 2px;
    transition: width 0.4s ease-out;
  }

  .account-item__codex-progress-bar--primary {
    background: linear-gradient(90deg, #ff8c00, #ffb300);
  }

  .account-item__codex-progress-bar--secondary {
    background: linear-gradient(90deg, #2196f3, #00bcd4);
  }

  .account-item__codex-progress-bar--total {
    background: linear-gradient(90deg, #9e9e9e, #bdbdbd);
  }

  .account-item__codex-row-status {
    font-size: 0.7rem;
    color: var(--text-soft, #666666);
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .account-item__footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding-top: 2px;
  }

  .account-item__footer-left {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .account-item__usage-email {
    font-size: 0.75rem;
    color: var(--text-soft, #777777);
    font-family:
      ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    text-overflow: ellipsis;
    overflow: hidden;
    white-space: nowrap;
  }

  .account-item__time {
    font-size: 0.72rem;
    color: var(--text-faint, #999999);
    white-space: nowrap;
    margin-left: auto;
  }
`;
