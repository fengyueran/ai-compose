import styled from "@emotion/styled";

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
