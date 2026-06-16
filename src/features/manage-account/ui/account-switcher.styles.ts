import styled from '@emotion/styled';

export const AccountSwitcherWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px;
  background: var(--bg-panel, #ffffff);
  border: 1px solid var(--panel-border, rgba(0, 0, 0, 0.08));
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.02);

  .account-switcher__title {
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--text-main);
    margin: 0;
  }

  .account-switcher__desc {
    font-size: 0.85rem;
    color: var(--text-soft);
    margin: 0 0 4px 0;
    line-height: 1.4;
  }

  .account-switcher__input-group {
    display: flex;
    gap: 8px;
    align-items: center;
    margin-bottom: 8px;
  }

  .account-switcher__input {
    flex: 1;
    height: 36px;
    padding: 0 12px;
    border: 1px solid var(--panel-border, rgba(0, 0, 0, 0.15));
    border-radius: 8px;
    font-size: 0.9rem;
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
    height: 36px;
    flex-shrink: 0;
  }

  .account-switcher__list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding-right: 4px;
  }

  .account-switcher__empty {
    padding: 24px;
    text-align: center;
    color: var(--text-faint);
    font-size: 0.85rem;
    border: 1px dashed var(--panel-border);
    border-radius: 8px;
  }

  .account-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    background: var(--bg-item, #fcfcfc);
    border: 1px solid var(--panel-border, rgba(0, 0, 0, 0.05));
    border-radius: 8px;
    transition: all 0.2s;

    &.account-item--active {
      background: rgba(255, 140, 0, 0.04);
      border-color: rgba(255, 140, 0, 0.3);
      box-shadow: 0 2px 8px rgba(255, 140, 0, 0.05);
    }
  }

  .account-item__info {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .account-item__name-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .account-item__name {
    font-weight: 600;
    color: var(--text-main);
    font-size: 0.95rem;
  }

  .account-item__active-badge {
    padding: 2px 6px;
    background: var(--accent-strong, #ff8c00);
    color: #ffffff;
    font-size: 0.7rem;
    font-weight: 600;
    border-radius: 4px;
    line-height: 1.2;
  }

  .account-item__time {
    font-size: 0.75rem;
    color: var(--text-faint);
  }

  .account-item__usage-zone {
    margin: 4px 0;
    min-width: 340px;
  }

  .account-item__usage-skeleton {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 2px 0;

    .skeleton-line {
      height: 12px;
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

    .skeleton-email {
      width: 70%;
    }

    .skeleton-progress {
      height: 6px;
      width: 90%;
    }

    .skeleton-meta {
      width: 40%;
      height: 10px;
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

  .account-item__usage-detail {
    display: flex;
    flex-direction: column;
    gap: 4px;
    background: var(--bg-panel-secondary, rgba(0, 0, 0, 0.02));
    padding: 6px 10px;
    border-radius: 6px;
    border: 1px solid var(--panel-border, rgba(0, 0, 0, 0.04));
  }

  .account-item__usage-meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
  }

  .account-item__usage-email {
    font-size: 0.75rem;
    color: var(--text-soft, #666666);
    font-weight: 500;
    text-overflow: ellipsis;
    overflow: hidden;
    white-space: nowrap;
    max-width: 150px;
  }

  .account-item__usage-reset {
    font-size: 0.7rem;
    color: var(--accent-strong, #ff8c00);
    background: rgba(255, 140, 0, 0.08);
    padding: 1px 5px;
    border-radius: 3px;
    font-weight: 500;
    white-space: nowrap;
  }

  .account-item__usage-progress-container {
    height: 5px;
    background: var(--panel-border, rgba(0, 0, 0, 0.08));
    border-radius: 3px;
    overflow: hidden;
  }

  .account-item__usage-progress-bar {
    height: 100%;
    background: linear-gradient(90deg, #ff8c00, #ffb300);
    border-radius: 3px;
    transition: width 0.4s ease-out;
  }

  .account-item__usage-status {
    font-size: 0.7rem;
    color: var(--text-soft, #888888);
    font-weight: 500;
  }

  .account-item__usage-error {
    font-size: 0.75rem;
    color: var(--text-faint, #999999);
    font-style: italic;
  }

  .account-item__codex-rows {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 4px;
  }

  .account-item__codex-row {
    display: flex;
    flex-direction: column;
    gap: 3px;
    background: var(--bg-panel-secondary, rgba(0, 0, 0, 0.01));
    padding: 6px 8px;
    border-radius: 6px;
    border: 1px solid var(--panel-border, rgba(0, 0, 0, 0.03));
    flex: 1 1 150px;
  }

  .account-item__codex-row-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.7rem;
    color: var(--text-soft, #666666);
  }

  .account-item__codex-row-label {
    font-weight: 600;
    color: var(--text-main, #333333);
  }

  .account-item__codex-row-reset {
    color: var(--accent-strong, #ff8c00);
    background: rgba(255, 140, 0, 0.08);
    padding: 1px 4px;
    border-radius: 3px;
    font-weight: 500;
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

  .account-item__codex-row-status {
    font-size: 0.65rem;
    color: var(--text-soft, #888888);
    font-weight: 500;
  }

  .account-item__actions {
    display: flex;
    gap: 8px;
  }

  .account-item__btn {
    padding: 0 10px;
    height: 28px;
    font-size: 0.8rem;
  }

  .account-switcher__warning {
    padding: 10px 14px;
    background: rgba(211, 47, 47, 0.03);
    border: 1px solid rgba(211, 47, 47, 0.1);
    border-radius: 8px;
    color: #d32f2f;
    font-size: 0.8rem;
    display: flex;
    flex-direction: column;
    gap: 4px;
    line-height: 1.4;

    ul {
      margin: 4px 0 0 0;
      padding-left: 16px;
    }
  }
`;
