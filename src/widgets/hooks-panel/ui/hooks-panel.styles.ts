import styled from '@emotion/styled'

import {
  actionButtonStyles,
  editorToggleStyles,
  fragmentListStyles,
  formControlStyles,
  mcpSourceBadgeStyles,
  panelStyles,
  previewCardStyles,
  workbenchStyles,
} from '../../../shared'

export const HooksPanelRoot = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(340px, 0.9fr);
  gap: 18px;
  align-items: stretch;
  height: 100%;
  min-height: 0;
  flex: 1;

  @media (max-width: 1280px) {
    grid-template-columns: 1fr;
    grid-template-rows: auto auto;
    overflow-y: auto;
  }

  ${workbenchStyles}
  ${panelStyles}
  ${actionButtonStyles}
  ${editorToggleStyles}
  ${fragmentListStyles}
  ${previewCardStyles}
  ${formControlStyles}
  ${mcpSourceBadgeStyles}

  .fragment-detail {
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
    padding: 16px 16px 20px;
  }

  .hooks-detail__body {
    display: grid;
    gap: 14px;
    min-height: 0;
    margin-top: 16px;
  }

  .hooks-list__item-meta,
  .hooks-field__hint,
  .hooks-empty,
  .hooks-preview__list,
  .hooks-errors {
    color: var(--text-faint);
    font-size: 0.82rem;
    line-height: 1.55;
  }

  .hooks-empty {
    padding: 16px;
  }

  .hooks-empty--detail {
    padding: 20px 16px;
  }

  .hooks-field {
    display: grid;
    gap: 8px;
  }

  .hooks-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
  }

  .hooks-field__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .mcp-detail-switches {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 8px;
  }

  .mcp-detail-switches__hint {
    color: var(--text-faint);
    font-size: 0.76rem;
    font-weight: 600;
  }

  .hooks-field__label {
    font-size: 0.82rem;
    font-weight: 700;
    color: var(--text-soft);
  }

  .hooks-input,
  .hooks-select,
  .hooks-textarea {
    width: 100%;
    border: 1px solid var(--panel-border);
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.76);
    color: var(--text-main);
    padding: 10px 12px;
    font-size: 0.9rem;
  }

  .hooks-textarea {
    min-height: 92px;
    resize: vertical;
    font-family: 'SFMono-Regular', 'Monaco', 'Menlo', monospace;
    line-height: 1.55;
  }

  .hooks-commands {
    display: grid;
    gap: 12px;
  }

  .hooks-primary-btn,
  .hooks-secondary-btn {
    min-height: 34px;
    padding: 0 14px;
    border-radius: 10px;
    font-size: 0.84rem;
    font-weight: 700;
    cursor: pointer;
  }

  .hooks-primary-btn {
    border: 1px solid var(--accent);
    background: var(--accent);
    color: #fff;
  }

  .hooks-primary-btn--apply {
    width: 100%;
    margin-top: 16px;
  }

  .hooks-primary-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    border-color: var(--border-subtle);
    background: var(--surface-container-high);
    color: var(--text-faint);
  }

  .hooks-secondary-btn {
    border: 1px solid var(--panel-border);
    background: rgba(255, 255, 255, 0.76);
    color: var(--text-main);
  }

  .hooks-preview__list,
  .hooks-errors {
    margin: 0;
    padding-left: 18px;
  }

  .hooks-preview__switcher {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .hooks-preview__switcher-label {
    font-size: 12px;
    color: var(--text-faint);
    font-weight: 500;
  }

  .hooks-preview__tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .hooks-preview__tab {
    padding: 6px 12px;
    border-radius: 999px;
    border: 1px solid rgba(82, 63, 41, 0.1);
    background: rgba(255, 255, 255, 0.5);
    color: var(--text-soft);
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 180ms ease;
  }

  .hooks-preview__tab--selected {
    border-color: rgba(197, 93, 51, 0.28);
    background: rgba(255, 247, 240, 0.96);
    color: var(--accent-strong);
    font-weight: 600;
  }

  .hooks-preview__code {
    background: rgba(0, 0, 0, 0.2);
    padding: 12px;
    border-radius: 8px;
    overflow-x: auto;
    max-width: 100%;
    font-family: monospace;
    font-size: 13px;
    color: var(--text-bright);
    line-height: 1.5;
    margin-top: 16px;
  }

  @media (max-width: 1280px) {
    .preview-column {
      position: static;
      grid-column: 1 / -1;
      display: block;
      height: auto;
    }
  }

  @media (max-width: 960px) {
    .workbench {
      height: auto;
    }

    .hooks-grid {
      grid-template-columns: 1fr;
    }
  }
`
