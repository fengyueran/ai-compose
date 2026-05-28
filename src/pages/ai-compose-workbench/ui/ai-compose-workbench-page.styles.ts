import styled from "@emotion/styled";

export const PageShell = styled.div`
  min-height: 100dvh;
  height: 100dvh;
  overflow: hidden;
  background:
    radial-gradient(
      circle at top left,
      rgba(242, 204, 120, 0.32),
      transparent 28%
    ),
    radial-gradient(
      circle at top right,
      rgba(152, 197, 170, 0.22),
      transparent 26%
    ),
    linear-gradient(180deg, #f9f4eb 0%, var(--app-bg) 100%);
  color: var(--text-main);

  @media (max-width: 960px) {
    height: auto;
    overflow: visible;
  }
`;

export const PageFrame = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  box-sizing: border-box;
  max-width: var(--workspace-max);
  margin: 0 auto;
  padding: 28px;

  @media (max-width: 960px) {
    height: auto;
    padding: 18px;
  }
`;

export const GlobalBar = styled.header`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  margin-bottom: 16px;
  padding: 14px 18px;
  border: 1px solid var(--panel-border);
  border-radius: var(--radius-xl);
  background: rgba(255, 252, 247, 0.76);
  backdrop-filter: blur(24px);
  box-shadow: var(--shadow);

  @media (max-width: 960px) {
    flex-direction: column;
    align-items: stretch;
  }
`;

export const Brand = styled.div`
  display: flex;
  align-items: center;
  min-height: 44px;
`;

export const BrandTitle = styled.h1`
  margin: 0;
  font-family:
    "Iowan Old Style", "Palatino Linotype", "Book Antiqua", Palatino, serif;
  font-size: clamp(1.8rem, 3vw, 2.9rem);
  line-height: 0.96;
  letter-spacing: -0.04em;
`;

export const WorkspaceGrid = styled.div<{ isSkillsDomain: boolean }>`
  display: grid;
  flex: 1;
  grid-template-columns: ${({ isSkillsDomain }) =>
    isSkillsDomain
      ? "260px minmax(0, 1fr)"
      : "260px minmax(0, 1.4fr) minmax(340px, 0.9fr)"};
  grid-template-rows: minmax(0, 1fr);
  gap: 18px;
  align-items: stretch;
  min-height: 0;

  @media (max-width: 1280px) {
    grid-template-columns: ${({ isSkillsDomain }) =>
      isSkillsDomain
        ? "220px minmax(0, 1fr)"
        : "220px minmax(0, 1fr)"};
  }

  @media (max-width: 960px) {
    flex: none;
    grid-template-columns: 1fr;
    grid-template-rows: auto;
    min-height: auto;
  }
`;

export const SideNavPanel = styled.aside`
  padding: 16px;
  border: 1px solid var(--panel-border);
  border-radius: var(--radius-xl);
  background: var(--panel-bg);
  backdrop-filter: blur(20px);
  box-shadow: var(--shadow);
`;

export const SideNavSection = styled.section`
  & + & {
    margin-top: 16px;
  }
`;

export const SideNavLabel = styled.h2`
  margin: 0 0 12px;
  padding: 0 6px;
  color: var(--text-faint);
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
`;

export const SideNavItems = styled.div`
  display: grid;
  gap: 8px;
`;

export const SideNavItem = styled.button<{
  isActive: boolean;
  isDisabled: boolean;
}>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 48px;
  padding: 0 14px;
  border: 1px solid
    ${({ isActive }) =>
      isActive ? "rgba(197, 93, 51, 0.18)" : "transparent"};
  border-radius: var(--radius-md);
  background: ${({ isActive, isDisabled }) =>
    isActive
      ? "var(--accent-soft)"
      : isDisabled
        ? "rgba(255, 255, 255, 0.3)"
        : "transparent"};
  color: ${({ isActive, isDisabled }) =>
    isActive
      ? "var(--accent-strong)"
      : isDisabled
        ? "var(--text-faint)"
        : "var(--text-main)"};
  cursor: ${({ isDisabled }) => (isDisabled ? "not-allowed" : "pointer")};
  transition:
    background-color 180ms ease,
    border-color 180ms ease,
    color 180ms ease,
    transform 180ms ease;

  &:hover {
    border-color: ${({ isDisabled, isActive }) =>
      isDisabled
        ? "transparent"
        : isActive
          ? "rgba(197, 93, 51, 0.18)"
          : "var(--panel-border)"};
    background: ${({ isDisabled, isActive }) =>
      isDisabled
        ? "rgba(255, 255, 255, 0.3)"
        : isActive
          ? "var(--accent-soft)"
          : "rgba(255, 255, 255, 0.48)"};
  }

  &:focus-visible {
    outline: 3px solid rgba(197, 93, 51, 0.28);
    outline-offset: 2px;
  }
`;

export const DisabledTag = styled.span`
  font-size: 0.78rem;
  color: var(--text-faint);
`;
