import styled from "@emotion/styled";

export const ProfilesPanelRoot = styled.div`
  display: flex;
  flex: 1;
  width: 100%;
  height: 100%;
  min-height: 0;

  .profiles-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    padding: 48px;
    background: rgba(0, 0, 0, 0.01);
    color: var(--text-soft);
    text-align: center;
    border-radius: 12px;
    
    h3 {
      font-size: 1.15rem;
      font-weight: 600;
      color: var(--text-main);
      margin-bottom: 8px;
    }
    
    p {
      font-size: 0.88rem;
      max-width: 420px;
      line-height: 1.5;
    }
  }

  .profiles-container {
    display: flex;
    flex: 1;
    width: 100%;
    height: 100%;
    min-height: 0;
  }

  .profiles-sidebar {
    width: 200px;
    border-right: 1px solid var(--panel-border, rgba(0, 0, 0, 0.08));
    padding: 16px;
    background: var(--bg-sidebar, #fafafa);
    display: flex;
    flex-direction: column;
    gap: 8px;
    flex-shrink: 0;

    .sidebar-editor-tabs {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .sidebar-editor-tab {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 9px 12px;
      border-radius: 8px;
      font-size: 0.88rem;
      font-weight: 500;
      color: var(--text-soft);
      cursor: pointer;
      border: 1px solid transparent;
      background: transparent;
      text-align: left;
      transition: all 0.18s;

      &__icon {
        width: 20px;
        height: 20px;
        flex-shrink: 0;
        display: flex;
        align-items: center;

        svg {
          width: 100%;
          height: 100%;
        }
      }

      &:hover {
        background: rgba(0, 0, 0, 0.03);
        color: var(--text-main);
      }

      &.sidebar-editor-tab--active {
        background: var(--accent-soft, rgba(197, 93, 51, 0.08));
        border-color: rgba(197, 93, 51, 0.15);
        color: var(--accent-strong, #c55d33);
        font-weight: 600;
      }
    }

    .sidebar-divider {
      height: 1px;
      background: var(--panel-border, rgba(0, 0, 0, 0.08));
      margin: 4px 0;
    }

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
    padding: 24px;
    overflow-y: auto;
    min-width: 0;
    background: #ffffff;
  }
`;
