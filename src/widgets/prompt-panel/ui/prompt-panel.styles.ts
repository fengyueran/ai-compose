import styled from "@emotion/styled";
import {
  actionButtonStyles,
  chipStyles,
  editorToggleStyles,
  fragmentListStyles,
  panelStyles,
  previewCardStyles,
  workbenchStyles,
} from "../../../shared";

export const PromptPanelRoot = styled.div`
  display: contents;

  ${workbenchStyles}
  ${panelStyles}
  ${chipStyles}
  ${actionButtonStyles}
  ${editorToggleStyles}
  ${fragmentListStyles}
  ${previewCardStyles}

  .fragment-detail {
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
    padding: 16px 16px 20px;
  }

  .fragment-detail .panel__header {
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .fragment-detail .panel__header > div {
    flex: 1 1 260px;
    min-width: 0;
  }

  .fragment-detail .panel__header .fragment-action-btn {
    flex: 0 1 auto;
    max-width: 100%;
  }

  .fragment-detail__body {
    flex: 1;
    min-height: 0;
    overflow: auto;
    margin-top: 16px;
    padding: 18px;
    border-radius: 22px;
    background: rgba(255, 255, 255, 0.62);
    border: 1px solid var(--panel-border);
    scrollbar-gutter: stable;
  }

  .fragment-detail__list {
    margin: 0;
    padding-left: 24px;
    display: grid;
    gap: 12px;
    color: var(--text-main);
    list-style: disc;
  }

  .fragment-detail__list li {
    line-height: 1.55;
    padding-left: 2px;
    overflow-wrap: anywhere;
  }

  .fragment-detail__list li::marker {
    color: var(--accent-strong);
  }

  .preview-apply-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 32px;
    padding: 0 14px;
    border: 1px solid var(--accent);
    border-radius: 6px;
    background: var(--accent);
    color: #fff;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 2px 6px rgba(197, 93, 51, 0.15);
    transition: all 0.2s ease;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .preview-apply-btn:hover {
    background: var(--accent-strong);
    border-color: var(--accent-strong);
    transform: translateY(-1px);
  }

  .preview-apply-btn:active {
    transform: translateY(0);
  }

  .preview-apply-btn--disabled {
    background: var(--surface-container-high);
    border-color: var(--border-subtle);
    color: var(--text-faint);
    cursor: not-allowed;
    box-shadow: none;
    opacity: 0.6;
  }

  .preview-apply-btn--disabled:hover {
    background: var(--surface-container-high);
    border-color: var(--border-subtle);
    transform: none;
  }

  @media (max-width: 1280px) {
    .preview-column {
      position: static;
      grid-column: 1 / -1;
      display: block;
      height: auto;
    }

    .preview-card__body {
      max-height: none;
    }
  }

  @media (max-width: 960px) {
    .workbench {
      height: auto;
    }

    .fragment-list__items {
      grid-template-columns: 1fr;
    }

    .preview-column {
      position: static;
      display: block;
      height: auto;
    }

    .fragment-detail .panel__header .fragment-action-btn {
      width: 100%;
      justify-content: center;
      white-space: normal;
    }
  }
`;
