import styled from "@emotion/styled";
import {
  actionButtonStyles,
  editorToggleStyles,
  formControlStyles,
  fragmentListStyles,
  mcpSourceBadgeStyles,
  panelStyles,
  previewCardStyles,
  workbenchStyles,
} from "../../../shared";

export const McpPanelRoot = styled.div`
  display: contents;

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

  .fragment-detail__body {
    margin-top: 16px;
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

  .mcp-description {
    background: rgba(197, 93, 51, 0.04);
    border-left: 3px solid var(--accent);
    padding: 8px 12px;
    border-radius: 4px;
  }

  .mcp-form__btn {
    min-height: 36px;
    padding: 0 14px;
    border-radius: 10px;
    border: 1px solid var(--panel-border);
    background: rgba(255, 255, 255, 0.76);
    color: var(--text-main);
    font-size: 0.84rem;
    font-weight: 600;
    cursor: pointer;
    transition:
      transform 180ms ease,
      border-color 180ms ease,
      background-color 180ms ease,
      box-shadow 180ms ease;
  }

  .mcp-form__btn:hover {
    transform: translateY(-1px);
    border-color: rgba(197, 93, 51, 0.2);
    background: rgba(255, 255, 255, 0.96);
    box-shadow: 0 6px 16px rgba(82, 63, 41, 0.08);
  }

  .mcp-form__btn--danger {
    border-color: rgba(179, 58, 58, 0.2);
    color: #8b3131;
  }

  .mcp-form__btn--danger:hover {
    border-color: rgba(179, 58, 58, 0.35);
    background: rgba(255, 241, 241, 0.9);
  }

  .mcp-form__btn--primary {
    border-color: var(--accent);
    background: var(--accent);
    color: #fffdf8;
  }

  .mcp-form__btn--primary:hover {
    border-color: var(--accent-strong);
    background: var(--accent-strong);
  }

  .env-editor__delete-btn,
  .env-editor__add-btn {
    min-height: 34px;
    padding: 0 12px;
    border-radius: 8px;
    border: 1px solid var(--panel-border);
    background: rgba(255, 255, 255, 0.76);
    color: var(--text-soft);
    cursor: pointer;
    transition:
      transform 180ms ease,
      border-color 180ms ease,
      background-color 180ms ease;
  }

  .env-editor__delete-btn:hover,
  .env-editor__add-btn:hover {
    transform: translateY(-1px);
    border-color: rgba(197, 93, 51, 0.2);
    background: rgba(255, 255, 255, 0.95);
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
  }
`;
