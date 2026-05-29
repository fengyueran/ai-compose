import styled from "@emotion/styled";

export const ProfilesPanelRoot = styled.div`
  display: flex;
  flex: 1;
  width: 100%;
  height: 100%;
  min-height: 0;

  .profiles-container {
    display: flex;
    flex: 1;
    width: 100%;
    height: 100%;
    min-height: 0;
  }

  .profiles-sidebar {
    width: 180px;
    border-right: 1px solid var(--panel-border, rgba(0, 0, 0, 0.08));
    padding: 16px 12px;
    background: var(--bg-sidebar, #fafafa);
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex-shrink: 0;

    .sidebar-item {
      padding: 10px 14px;
      border-radius: 8px;
      font-size: 0.88rem;
      font-weight: 500;
      color: var(--text-soft);
      cursor: pointer;
      border: none;
      background: transparent;
      text-align: left;
      transition: all 0.2s;

      &:hover {
        background: rgba(0, 0, 0, 0.02);
        color: var(--text-main);
      }

      &.sidebar-item--active {
        background: var(--accent-soft, rgba(255, 140, 0, 0.08));
        color: var(--accent-strong, #ff8c00);
        font-weight: 600;
      }
    }
  }

  .profiles-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-width: 0;
    background: #ffffff;

    .content-editor-tabs {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 12px 24px 0;
      border-bottom: 1px solid var(--panel-border, rgba(0, 0, 0, 0.08));
      flex-shrink: 0;
    }

    .content-editor-tab {
      display: flex;
      align-items: center;
      gap: 7px;
      padding: 8px 16px;
      font-size: 0.88rem;
      font-weight: 500;
      color: var(--text-soft);
      cursor: pointer;
      border: none;
      border-bottom: 2px solid transparent;
      background: transparent;
      margin-bottom: -1px;
      border-radius: 6px 6px 0 0;
      transition: all 0.18s;

      &__icon {
        width: 18px;
        height: 18px;
        flex-shrink: 0;
        display: flex;
        align-items: center;

        svg {
          width: 100%;
          height: 100%;
        }
      }

      &:hover {
        color: var(--text-main);
        background: rgba(0, 0, 0, 0.02);
      }

      &.content-editor-tab--active {
        color: var(--accent-strong, #c55d33);
        font-weight: 600;
        border-bottom-color: var(--accent-strong, #c55d33);
        background: transparent;
      }
    }

    > .account-switcher {
      flex: 1;
      overflow-y: auto;
      min-height: 0;
      padding: 20px 24px;
    }
  }
`;

