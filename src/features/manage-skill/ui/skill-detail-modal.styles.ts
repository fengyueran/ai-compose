import styled from "@emotion/styled";
import {
  actionButtonStyles,
  editorToggleStyles,
  skillSourceBadgeStyles,
} from "../../../shared";

export const SkillDetailModalContent = styled.div`
  ${actionButtonStyles}
  ${editorToggleStyles}
  ${skillSourceBadgeStyles}

  display: flex;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  max-height: 70vh;

  .skills-detail-pane__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    padding: 18px;
    border-bottom: 1px solid var(--panel-border);
  }

  .skills-detail-pane__header .skill-source-badge {
    margin-top: 8px;
  }

  .skills-detail-switches {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
    margin-top: 16px;
  }

  .skills-detail-switches__hint {
    color: var(--text-faint);
    font-size: 0.76rem;
    font-weight: 600;
  }

  .skills-detail-pane__description {
    margin: 8px 0 0;
    color: var(--text-soft);
    line-height: 1.5;
  }

  .skills-detail-pane__actions {
    display: flex;
    flex-shrink: 0;
    gap: 8px;
  }

  .skills-detail-pane__actions .fragment-action-btn {
    min-height: 36px;
    padding: 0 12px;
  }

  .skills-detail-pane__body {
    flex: 1;
    width: 100%;
    max-width: 100%;
    min-width: 0;
    min-height: 0;
    overflow: auto;
    padding: 18px;
  }

  .skills-detail-pane__path {
    margin: 0 0 8px;
    padding: 10px 12px;
    border: 1px dashed rgba(197, 93, 51, 0.18);
    border-radius: 10px;
    background: rgba(255, 140, 0, 0.03);
    color: var(--text-soft);
    font-size: 0.82rem;
    word-break: break-all;
  }

  .skills-detail-pane__link {
    color: var(--accent-strong);
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  .skills-detail-pane__link:hover {
    color: var(--accent);
  }

  .skills-detail-pane__link-button {
    padding: 0;
    border: none;
    background: transparent;
    color: var(--accent-strong);
    text-decoration: underline;
    text-underline-offset: 2px;
    cursor: pointer;
    font: inherit;
    text-align: left;
    word-break: break-all;
  }

  .skills-detail-pane__link-button:hover {
    color: var(--accent);
  }

  .skills-detail-pane__multi-paths {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 10px;
  }

  .skills-detail-pane__multi-path-row {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: 6px;
  }

  .skills-detail-pane__multi-path-label {
    color: var(--text-main);
    font-weight: 600;
    white-space: nowrap;
  }

  .skills-detail-pane__markdown {
    margin: 0;
    padding: 16px;
    border-radius: 12px;
    background: #fffdf9;
    border: 1px solid rgba(82, 63, 41, 0.12);
    color: var(--text-main);
    font-family:
      ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono",
      monospace;
    font-size: 0.86rem;
    line-height: 1.62;
    overflow-x: auto;
    white-space: pre-wrap;
    word-break: break-all;
    max-width: 100%;
  }

  &.skills-detail-pane--loading {
    opacity: 0.6;
    pointer-events: none;
    transition: opacity 0.2s ease;
  }

  @media (max-width: 960px) {
    min-height: 360px;
  }
`;
