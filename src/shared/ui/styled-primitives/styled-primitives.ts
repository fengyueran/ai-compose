import { css } from "@emotion/react";

export const workbenchStyles = css`
  .workbench {
    display: grid;
    gap: 14px;
    grid-template-rows: auto minmax(0, 1fr);
    height: 100%;
    min-height: 0;
  }

  .workbench > .panel {
    min-height: 0;
    min-width: 0;
  }

  .workbench--skills {
    grid-template-rows: auto minmax(0, 1fr);
  }
`;

export const panelStyles = css`
  .panel {
    border: 1px solid var(--panel-border);
    border-radius: var(--radius-xl);
    background: var(--panel-bg);
    backdrop-filter: blur(20px);
    box-shadow: var(--shadow);
  }

  .panel__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 20px 22px 0;
  }

  .panel__title {
    margin: 0;
    font-size: 1.05rem;
    font-weight: 700;
  }

  .panel__subtitle {
    margin: 6px 0 0;
    color: var(--text-soft);
    font-size: 0.92rem;
  }
`;

export const chipStyles = css`
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: 40px;
    padding: 0 12px;
    border: 1px solid var(--panel-border);
    border-radius: 999px;
    background: var(--panel-strong);
    color: var(--text-main);
    font-size: 0.92rem;
    font-weight: 600;
    white-space: nowrap;
  }

  .chip__label {
    color: var(--text-faint);
    font-weight: 500;
  }
`;

export const actionButtonStyles = css`
  .fragment-action-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 40px;
    padding: 0 16px;
    border: 1px solid #c55d33 !important;
    border-radius: 999px !important;
    background: linear-gradient(135deg, #c55d33 0%, #dd8557 100%) !important;
    color: #fffdf8 !important;
    font-size: 0.92rem;
    font-weight: 600;
    white-space: nowrap;
    cursor: pointer;
    opacity: 1 !important;
    box-shadow: 0 4px 12px rgba(197, 93, 51, 0.18);
    transition:
      background 180ms ease,
      border-color 180ms ease,
      color 180ms ease,
      transform 180ms ease,
      box-shadow 180ms ease;
  }

  .fragment-action-btn:hover,
  .fragment-action-btn:focus,
  .fragment-action-btn:focus-visible {
    background: linear-gradient(135deg, #9a4521 0%, #c55d33 100%) !important;
    border-color: #9a4521 !important;
    color: #fffdf8 !important;
    opacity: 1 !important;
    box-shadow: 0 6px 16px rgba(154, 69, 33, 0.28) !important;
  }

  .fragment-action-btn:hover {
    transform: translateY(-1px);
  }

  .fragment-action-btn:active {
    transform: translateY(0) scale(0.98);
    box-shadow: 0 2px 6px rgba(154, 69, 33, 0.15) !important;
  }

  .fragment-action-btn:focus-visible {
    outline: 3px solid rgba(197, 93, 51, 0.28) !important;
    outline-offset: 2px;
  }

  .fragment-action-btn:disabled:not(.fragment-action-btn--loading),
  .fragment-action-btn[disabled]:not(.fragment-action-btn--loading),
  .fragment-action-btn.compass-btn-disabled:not(.fragment-action-btn--loading),
  .fragment-action-btn.disabled:not(.fragment-action-btn--loading) {
    background: #eeeae3 !important;
    border-color: #d0c7bc !important;
    cursor: not-allowed !important;
    box-shadow: none !important;
    transform: none !important;
    opacity: 0.52 !important;
  }

  .fragment-action-btn:disabled:not(.fragment-action-btn--loading) *,
  .fragment-action-btn[disabled]:not(.fragment-action-btn--loading) *,
  .fragment-action-btn.compass-btn-disabled:not(.fragment-action-btn--loading) *,
  .fragment-action-btn.disabled:not(.fragment-action-btn--loading) * {
    color: #8e7c67 !important;
  }

  .fragment-action-btn--loading,
  .fragment-action-btn--loading:disabled,
  .fragment-action-btn--loading:hover {
    background: linear-gradient(135deg, #c55d33 0%, #dd8557 100%) !important;
    border-color: #c55d33 !important;
    color: #fffdf8 !important;
    cursor: wait !important;
    box-shadow: 0 4px 12px rgba(197, 93, 51, 0.18) !important;
    transform: none !important;
    opacity: 0.85 !important;
  }

  .fragment-action-btn--loading * {
    color: #fffdf8 !important;
    fill: #fffdf8 !important;
  }

  .fragment-action-btn--active {
    border-color: rgba(179, 58, 58, 0.24);
    background: rgba(179, 58, 58, 0.05);
    color: #8b3131;
    box-shadow: none;
  }

  .fragment-action-btn--active:hover {
    background: #8b3131;
    border-color: #8b3131;
    color: #fffdf8;
    box-shadow: 0 4px 12px rgba(179, 58, 58, 0.25);
    transform: translateY(-1px);
  }

  .fragment-action-btn--active:active {
    transform: translateY(0) scale(0.98);
    box-shadow: 0 2px 6px rgba(179, 58, 58, 0.15);
  }

  .fragment-action-btn--active:focus-visible {
    outline: 3px solid rgba(179, 58, 58, 0.28);
    outline-offset: 2px;
  }
`;

export const fragmentListStyles = css`
  .fragment-list {
    padding: 16px;
  }

  .fragment-list__items {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
    margin-top: 14px;
  }

  .fragment-list__item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    width: 100%;
    min-height: 0;
    padding: 12px 14px;
    border: 1px solid var(--panel-border);
    border-radius: 16px;
    background: rgba(255, 255, 255, 0.55);
    color: inherit;
    text-align: left;
    cursor: pointer;
    transition:
      border-color 180ms ease,
      background-color 180ms ease,
      transform 180ms ease,
      box-shadow 180ms ease;
  }

  .fragment-list__item:hover {
    transform: translateY(-1px);
    border-color: rgba(197, 93, 51, 0.18);
  }

  .fragment-list__item--selected {
    border-color: rgba(197, 93, 51, 0.28);
    background: rgba(255, 247, 240, 0.96);
    box-shadow: 0 12px 24px rgba(197, 93, 51, 0.08);
  }

  .fragment-list__item:focus-visible {
    outline: 3px solid rgba(197, 93, 51, 0.28);
    outline-offset: 2px;
  }

  .fragment-list__item-select {
    display: flex;
    min-width: 0;
    flex: 1;
    padding: 0;
    border: 0;
    background: transparent;
    color: inherit;
    text-align: left;
    cursor: pointer;
  }

  .fragment-list__item-main {
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
  }

  .fragment-list__item-title {
    font-size: 0.96rem;
    font-weight: 700;
    line-height: 1.2;
  }

  .fragment-list__item-meta-row {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }

  .fragment-list__item-meta,
  .fragment-list__item-meta-separator {
    color: var(--text-faint);
    font-size: 0.8rem;
  }

  .fragment-list__toggle {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--text-soft);
    font-size: 0.84rem;
    flex-shrink: 0;
  }

  .fragment-list__toggle-dot {
    width: 10px;
    height: 10px;
    border-radius: 999px;
    border: 2px solid rgba(105, 87, 66, 0.3);
    background: transparent;
  }

  .fragment-list__toggle-dot--enabled {
    border-color: rgba(47, 125, 87, 0.28);
    background: var(--success);
  }
`;

export const previewCardStyles = css`
  .preview-column {
    position: static;
    display: flex;
    align-self: stretch;
    height: 100%;
    min-height: 0;
    min-width: 0;
  }

  .preview-card {
    display: flex;
    flex: 1;
    flex-direction: column;
    padding: 18px;
    min-height: 0;
    min-width: 0;
  }

  .preview-card__actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 12px;
    flex-wrap: wrap;
  }

  .preview-card__editor-toggles {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 10px;
    flex-wrap: wrap;
  }

  .preview-card__body {
    flex: 1;
    margin-top: 16px;
    min-height: 0;
    min-width: 0;
    overflow: auto;
    padding: 18px;
    border-radius: 22px;
    max-width: 100%;
    background: linear-gradient(
      180deg,
      rgba(255, 255, 255, 0.86) 0%,
      rgba(250, 245, 238, 0.92) 100%
    );
    border: 1px solid var(--panel-border);
  }

  .preview-card__section + .preview-card__section {
    margin-top: 22px;
    padding-top: 22px;
    border-top: 1px dashed rgba(82, 63, 41, 0.16);
  }

  .preview-card__section-title {
    margin: 0 0 12px;
    font-size: 0.95rem;
    color: var(--accent-strong);
  }

  .preview-card__empty {
    margin: 0;
    color: var(--text-soft);
    line-height: 1.6;
  }

  .preview-card__list {
    margin: 0;
    padding-left: 24px;
    display: grid;
    gap: 12px;
    color: var(--text-main);
    list-style: disc;
  }

  .preview-card__list li {
    line-height: 1.55;
    padding-left: 2px;
    overflow-wrap: anywhere;
  }

  .preview-card__list li::marker {
    color: var(--accent-strong);
  }
`;

export const editorToggleStyles = css`
  .editor-icon-toggle-group {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    justify-content: flex-end;
  }

  .editor-icon-toggle-group--skill-detail {
    justify-content: flex-start;
  }

  .editor-icon-toggle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    padding: 0;
    border-radius: 999px;
    border: 1px solid rgba(82, 63, 41, 0.08);
    background: rgba(255, 255, 255, 0.56);
    color: rgba(105, 87, 66, 0.28);
    cursor: pointer;
    transition:
      transform 180ms ease,
      border-color 180ms ease,
      background-color 180ms ease,
      box-shadow 180ms ease,
      color 180ms ease,
      opacity 180ms ease;
  }

  .editor-icon-toggle:hover {
    transform: translateY(-1px);
    border-color: rgba(197, 93, 51, 0.18);
    box-shadow: 0 10px 16px rgba(82, 63, 41, 0.08);
  }

  .editor-icon-toggle--enabled,
  .editor-icon-toggle--active {
    border-color: rgba(197, 93, 51, 0.28);
    background: rgba(255, 247, 240, 0.96);
    box-shadow:
      0 0 0 2px rgba(197, 93, 51, 0.12),
      0 10px 18px rgba(82, 63, 41, 0.08);
  }

  .editor-icon-toggle--readonly {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .editor-icon-toggle__icon {
    width: 25px;
    height: 25px;
    fill: currentColor;
    transition:
      transform 180ms ease,
      color 180ms ease,
      opacity 180ms ease,
      filter 180ms ease;
  }

  .editor-icon-toggle--enabled .editor-icon-toggle__icon,
  .editor-icon-toggle--active .editor-icon-toggle__icon {
    transform: scale(1.06);
    opacity: 1;
    filter: none;
  }

  .editor-icon-toggle__icon--antigravity {
    color: #e0713a;
  }

  .editor-icon-toggle__icon--codex {
    color: #214f45;
  }

  .editor-icon-toggle__icon--cursor {
    color: #6b78ff;
  }

  .editor-icon-toggle:not(.editor-icon-toggle--enabled):not(.editor-icon-toggle--active)
    .editor-icon-toggle__icon {
    opacity: 0.4;
    filter: grayscale(0.8) saturate(0.55);
  }
`;

export const formControlStyles = css`
  .form-input,
  .form-textarea {
    width: 100%;
    padding: 10px 14px;
    border: 1px solid var(--panel-border);
    border-radius: var(--radius-md);
    background: rgba(255, 255, 255, 0.62);
    color: var(--text-main);
    font-family: inherit;
    font-size: 0.94rem;
    outline: none;
    box-sizing: border-box;
    transition:
      border-color 180ms ease,
      background-color 180ms ease,
      box-shadow 180ms ease;
  }

  .form-input:focus,
  .form-textarea:focus {
    border-color: var(--accent);
    background: var(--panel-strong);
    box-shadow: 0 0 0 3px rgba(197, 93, 51, 0.12);
  }

  .form-input:disabled,
  .form-textarea:disabled {
    background: rgba(255, 255, 255, 0.3);
    color: var(--text-faint);
    cursor: not-allowed;
    border-color: rgba(82, 63, 41, 0.06);
  }

  .form-textarea {
    resize: vertical;
  }

  .env-input {
    flex: 1;
  }
`;

export const skillSourceBadgeStyles = css`
  .skill-source-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    padding: 1px 6px;
    border-radius: 5px;
    font-size: 0.68rem;
    font-weight: 700;
    line-height: 1.3;
  }

  .skill-source-badge--cli {
    border: 1px solid rgba(0, 122, 255, 0.22);
    background: rgba(0, 122, 255, 0.12);
    color: #007aff;
  }

  .skill-source-badge--readonly {
    border: 1px solid rgba(221, 107, 32, 0.22);
    background: rgba(221, 107, 32, 0.12);
    color: #dd6b20;
  }

  .skill-source-badge--builtin {
    background: rgba(0, 122, 255, 0.12);
    color: #007aff;
    border: 1px solid rgba(0, 122, 255, 0.2);
  }

  .skill-source-badge--repository {
    background: rgba(47, 125, 87, 0.12);
    color: #2f7d57;
    border: 1px solid rgba(47, 125, 87, 0.22);
  }

  .skill-source-badge--builtin-uninstalled {
    background: rgba(0, 122, 255, 0.04);
    color: rgba(0, 122, 255, 0.6);
    border: 1px dashed rgba(0, 122, 255, 0.22);
  }
`;

export const mcpSourceBadgeStyles = css`
  .mcp-source-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 1px 5px;
    font-size: 0.68rem;
    font-weight: 600;
    border-radius: 4px;
    line-height: 1.2;
    letter-spacing: 0.01em;
  }

  .mcp-source-badge--preset {
    background: rgba(0, 122, 255, 0.12);
    color: #007aff;
    border: 1px solid rgba(0, 122, 255, 0.2);
  }

  .mcp-source-badge--user {
    background: rgba(142, 68, 173, 0.12);
    color: #9f7aea;
    border: 1px solid rgba(142, 68, 173, 0.2);
  }

  .mcp-source-badge--external {
    background: rgba(221, 107, 32, 0.12);
    color: #dd6b20;
    border: 1px solid rgba(221, 107, 32, 0.2);
  }
`;
