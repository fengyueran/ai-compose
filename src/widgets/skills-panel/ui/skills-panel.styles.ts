import { keyframes } from "@emotion/react";
import styled from "@emotion/styled";
import {
  actionButtonStyles,
  chipStyles,
  editorToggleStyles,
  formControlStyles,
  panelStyles,
  previewCardStyles,
  skillSourceBadgeStyles,
  workbenchStyles,
} from "../../../shared";

const skillsSpin = keyframes`
  0% {
    transform: rotate(0deg);
  }

  100% {
    transform: rotate(360deg);
  }
`;

export const SkillsPanelRoot = styled.div`
  ${workbenchStyles}
  ${panelStyles}
  ${chipStyles}
  ${actionButtonStyles}
  ${editorToggleStyles}
  ${formControlStyles}
  ${skillSourceBadgeStyles}
  ${previewCardStyles}

  .skills-manager {
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
  }

  .skills-manager__toolbar {
    display: grid;
    gap: 14px;
    padding: 18px;
    border-bottom: 1px solid var(--panel-border);
  }

  .skills-manager__heading,
  .skills-manager__controls {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .skills-manager__heading {
    justify-content: space-between;
  }

  .skills-manager__controls {
    flex-wrap: wrap;
  }

  .skills-manager__search {
    flex: 1 1 260px;
    min-width: 220px;
  }

  .skills-manager__filter-select {
    flex: 0 0 150px;
    width: 150px;
  }

  .skills-manager__filter-select .skills-manager__filter-trigger {
    min-height: 40px;
    padding: 7px 12px;
    border-color: var(--panel-border) !important;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.58);
    color: var(--text-main);
    box-shadow: none !important;
  }

  .skills-manager__filter-select.compass-select-open .skills-manager__filter-trigger,
  .skills-manager__filter-select:hover .skills-manager__filter-trigger {
    border-color: rgba(211, 102, 55, 0.42) !important;
    background: rgba(255, 250, 244, 0.94);
  }

  .skills-manager__filter-select .compass-icon-down {
    color: var(--text-soft);
  }

  .skills-manager__filter-dropdown {
    padding: 6px;
    border: 1px solid var(--panel-border);
    border-radius: 14px !important;
    background: rgba(255, 253, 248, 0.98) !important;
    box-shadow: 0 18px 40px rgba(86, 62, 31, 0.16) !important;
  }

  .skills-manager__filter-option {
    min-height: 36px;
    padding: 0 10px;
    border-radius: 10px;
    color: var(--text-soft);
    font-size: 0.9rem;
  }

  .skills-manager__filter-option.compass-select-option-selected {
    background: var(--accent-soft) !important;
    color: var(--accent-strong) !important;
    font-weight: 700;
  }

  .skills-manager__filter-option:hover {
    background: rgba(255, 244, 235, 0.9) !important;
  }

  .skills-manager__filter-option .compass-icon-check {
    color: var(--accent) !important;
  }

  .skills-manager__body {
    display: grid;
    flex: 1;
    min-height: 0;
    grid-template-columns: 280px minmax(0, 1fr);
  }

  .skills-source-pane {
    display: flex;
    flex-direction: column;
    border-right: 1px solid var(--panel-border);
    background: var(--panel-muted);
    min-height: 0;
    overflow: hidden;
  }

  .skills-source-pane__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 18px;
    border-bottom: 1px solid var(--panel-border);
    flex-shrink: 0;
  }

  .skills-source-pane__title {
    font-weight: 700;
    font-size: 0.9rem;
    color: var(--text-soft);
  }

  .skills-source-items {
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    flex: 1;
    overflow-y: auto;
  }

  .skills-source-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border-radius: var(--radius-md);
    border: 1px solid transparent;
    background: transparent;
    color: var(--text-main);
    text-align: left;
    cursor: pointer;
    width: 100%;
    transition: all 0.18s ease;
    position: relative;
  }

  .skills-source-item:hover {
    background: rgba(255, 255, 255, 0.45);
    border-color: var(--panel-border);
  }

  .skills-source-item--selected {
    background: var(--panel-strong) !important;
    border-color: var(--accent) !important;
    box-shadow: 0 4px 12px rgba(82, 63, 41, 0.06);
  }

  .skills-source-item__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: rgba(90, 73, 52, 0.04);
    color: var(--text-soft);
    flex-shrink: 0;
  }

  .skills-source-item--selected .skills-source-item__icon {
    background: var(--accent-soft);
    color: var(--accent);
  }

  .skills-source-item__info {
    display: flex;
    flex-direction: column;
    min-width: 0;
    flex: 1;
    gap: 2px;
  }

  .skills-source-item__name {
    font-size: 0.88rem;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .skills-source-item__value {
    font-size: 0.72rem;
    color: var(--text-faint);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    padding-right: 18px;
  }

  .skills-source-item__delete {
    display: none;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 6px;
    border: none;
    background: transparent;
    color: var(--text-faint);
    cursor: pointer;
    transition: all 0.15s ease;
    padding: 0;
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
  }

  .skills-source-item:hover .skills-source-item__delete {
    display: flex;
  }

  .skills-source-item__delete:hover {
    background: rgba(255, 77, 79, 0.1);
    color: #ff4d4f;
  }

  .skills-list-pane {
    display: flex;
    min-width: 0;
    min-height: 0;
    flex-direction: column;
  }

  .skills-list-pane__summary {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 14px;
    border-bottom: 1px solid var(--panel-border);
    color: var(--text-faint);
    font-size: 0.78rem;
  }

  .skills-list-pane__summary span {
    min-width: 0;
  }

  .skills-list-rows {
    padding: 16px;
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  .skills-list-groups {
    display: flex;
    flex-direction: column;
    gap: 22px;
  }

  .skills-list-group {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .skills-list-group__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 0 4px;
  }

  .skills-list-group__title {
    margin: 0;
    font-size: 0.86rem;
    font-weight: 700;
    color: var(--text-soft);
    letter-spacing: 0.02em;
  }

  .skills-list-group__count {
    color: var(--text-faint);
    font-size: 0.74rem;
  }

  .skills-list-group__rows {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 16px;
  }

  .skills-list-row {
    display: flex;
    align-items: flex-start;
    gap: 14px;
    padding: 14px 18px;
    border-radius: var(--radius-md, 14px);
    background: var(--panel-strong);
    border: 1px solid var(--panel-border);
    color: inherit;
    text-align: left;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
  }

  .skills-list-row:hover {
    background: rgba(255, 255, 255, 0.95);
    border-color: rgba(197, 93, 51, 0.25);
    box-shadow: 0 4px 12px rgba(82, 63, 41, 0.08);
  }

  .skills-list-row--selected {
    background: var(--panel-strong);
    border-color: var(--accent);
    box-shadow: 0 2px 8px rgba(197, 93, 51, 0.12);
  }

  .skills-list-row__select {
    display: flex;
    min-width: 0;
    flex: 1;
    align-items: center;
    gap: 14px;
    padding: 0;
    border: 0;
    background: transparent;
    color: inherit;
    text-align: left;
    cursor: pointer;
  }

  .skill-card__icon-container {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border-radius: 8px;
    background: rgba(90, 73, 52, 0.04);
    border: 1px solid rgba(82, 63, 41, 0.06);
    flex-shrink: 0;
  }

  .skills-list-row__content {
    display: flex;
    flex-direction: column;
    min-width: 0;
    flex: 1;
    gap: 6px;
  }

  .skills-list-row__title-line {
    display: flex;
    min-width: 0;
  }

  .skills-list-row__meta-line {
    display: flex;
    min-width: 0;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin-top: 2px;
  }

  .skills-list-row__title,
  .skills-list-row__description {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .skills-list-row__title {
    font-weight: 600;
    font-size: 0.95rem;
    color: var(--text-main);
  }

  .skills-list-row__description {
    color: var(--text-faint);
    font-size: 0.82rem;
    line-height: 1.45;
  }

  .skills-list-row__summary-count {
    color: var(--text-soft);
    font-size: 0.78rem;
    font-weight: 700;
    white-space: nowrap;
  }

  .skills-list-row__meta-line .skill-source-badge {
    padding: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
    font-size: 0.76rem;
    line-height: 1.4;
  }

  .skills-list-row__meta-line .skill-source-badge::after {
    content: "·";
    margin-left: 8px;
    color: var(--text-faint);
  }

  .skills-list-empty {
    margin: 0;
    padding: 18px;
    color: var(--text-faint);
    font-size: 0.9rem;
    line-height: 1.6;
  }

  .skills-list-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px 20px;
    color: var(--text-faint);
    font-size: 14px;
    gap: 12px;
    width: 100%;
    height: 100%;
    min-height: 200px;
  }

  .skills-spinner {
    width: 32px;
    height: 32px;
    border: 3px solid rgba(197, 93, 51, 0.1);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: ${skillsSpin} 0.8s linear infinite;
  }

  .skills-list-rows--loading {
    opacity: 0.6;
    pointer-events: none;
    transition: opacity 0.2s ease;
  }

  @media (max-width: 960px) {
    .workbench {
      height: auto;
    }

    .skills-manager {
      min-height: 720px;
    }

    .skills-manager__body {
      grid-template-columns: 1fr;
    }

    .skills-list-pane {
      min-height: 280px;
      border-right: 0;
      border-bottom: 1px solid var(--panel-border);
    }
  }
`;
