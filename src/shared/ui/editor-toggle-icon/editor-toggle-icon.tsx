import type { EditorId } from "../../api/editor-target-command";

interface EditorToggleIconProps {
  editorId: EditorId;
}

export function EditorToggleIcon({ editorId }: EditorToggleIconProps) {
  if (editorId === "antigravity") {
    return (
      <svg
        aria-hidden="true"
        className="editor-icon-toggle__icon editor-icon-toggle__icon--antigravity"
        viewBox="0 0 24 24"
      >
        <defs>
          <linearGradient id="editor-icon-antigravity-arc" x1="6.4" y1="5.6" x2="17.6" y2="5.6" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#4A8FFF" />
            <stop offset="0.28" stopColor="#4FB6FF" />
            <stop offset="0.54" stopColor="#81D66A" />
            <stop offset="0.76" stopColor="#FFB243" />
            <stop offset="1" stopColor="#FF5A4F" />
          </linearGradient>
        </defs>
        <rect x="2.2" y="2.2" width="19.6" height="19.6" rx="5.2" fill="#ffffff" />
        <path
          fill="url(#editor-icon-antigravity-arc)"
          d="M6.1 18.1c-.46 0-.86-.17-1.18-.5a1.66 1.66 0 0 1-.48-1.18c0-.44.16-.82.48-1.14.88-.94 1.62-1.92 2.22-2.94.62-1.04 1.18-2.17 1.68-3.38.52-1.24 1.03-2.2 1.54-2.88.55-.72 1.28-1.08 2.18-1.08.9 0 1.62.36 2.16 1.08.5.68 1.02 1.64 1.54 2.88.5 1.2 1.06 2.33 1.68 3.38.6 1.02 1.34 2 2.22 2.94.32.32.48.7.48 1.14 0 .46-.16.85-.48 1.18-.32.33-.72.5-1.18.5-.42 0-.8-.16-1.12-.48-.96-.98-1.8-2.07-2.52-3.26a24.53 24.53 0 0 1-1.9-3.88 17.28 17.28 0 0 0-1.08-2.44c-.34-.56-.74-.84-1.2-.84-.46 0-.86.28-1.2.84-.3.5-.66 1.3-1.08 2.44-.58 1.48-1.2 2.78-1.9 3.88-.72 1.2-1.56 2.28-2.52 3.26-.32.32-.7.48-1.12.48Z"
        />
      </svg>
    );
  }

  if (editorId === "codex") {
    return (
      <svg
        aria-hidden="true"
        className="editor-icon-toggle__icon editor-icon-toggle__icon--codex"
        viewBox="0 0 24 24"
      >
        <defs>
          <radialGradient id="editor-icon-codex-cloud" cx="35%" cy="28%" r="88%">
            <stop offset="0" stopColor="#C7BCFF" />
            <stop offset="0.42" stopColor="#8E95FF" />
            <stop offset="1" stopColor="#4432FF" />
          </radialGradient>
        </defs>
        <rect x="2.2" y="2.2" width="19.6" height="19.6" rx="5.2" fill="#ffffff" />
        <path
          fill="url(#editor-icon-codex-cloud)"
          d="M8.15 18.55c-1.2 0-2.18-.4-2.95-1.2-.75-.78-1.12-1.73-1.12-2.87 0-.9.24-1.7.72-2.4.5-.7 1.15-1.2 1.96-1.48.16-1.14.68-2.1 1.58-2.9.9-.82 1.97-1.23 3.22-1.23 1.02 0 1.94.28 2.76.84a5.01 5.01 0 0 1 1.84 2.24c1.1.16 2 .64 2.7 1.46.72.8 1.08 1.77 1.08 2.92 0 1.2-.42 2.22-1.26 3.06-.82.84-1.84 1.26-3.05 1.26H8.15Z"
        />
        <path
          d="M9.25 10.15 11.1 13l-1.85 2.85"
          fill="none"
          stroke="#F7F8FF"
          strokeWidth="1.55"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M13.2 15.85h2.85"
          fill="none"
          stroke="#F7F8FF"
          strokeWidth="1.55"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  return (
    <svg
      aria-hidden="true"
      className="editor-icon-toggle__icon editor-icon-toggle__icon--cursor"
      viewBox="0 0 24 24"
    >
      <defs>
        <linearGradient id="editor-icon-cursor-top" x1="7" y1="7.5" x2="17" y2="7.5" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#6E6A62" />
          <stop offset="1" stopColor="#4D4942" />
        </linearGradient>
        <linearGradient id="editor-icon-cursor-left" x1="7" y1="9.5" x2="12" y2="17" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#6A6660" />
          <stop offset="1" stopColor="#59554F" />
        </linearGradient>
        <linearGradient id="editor-icon-cursor-right" x1="12" y1="9.5" x2="17" y2="17" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#E8E7E5" />
          <stop offset="1" stopColor="#CFCFCD" />
        </linearGradient>
        <linearGradient id="editor-icon-cursor-base" x1="7" y1="16" x2="17" y2="16" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#504C45" />
          <stop offset="1" stopColor="#6B6760" />
        </linearGradient>
      </defs>
      <rect x="2.2" y="2.2" width="19.6" height="19.6" rx="5.2" fill="#15130E" />
      <path fill="url(#editor-icon-cursor-top)" d="M12 5.4 17.4 8.55 12 11.35 6.6 8.55 12 5.4Z" />
      <path fill="url(#editor-icon-cursor-left)" d="M6.6 8.55v6.2L12 18V11.35L6.6 8.55Z" />
      <path fill="url(#editor-icon-cursor-right)" d="M17.4 8.55v6.2L12 18V11.35l5.4-2.8Z" />
      <path fill="url(#editor-icon-cursor-base)" opacity="0.82" d="M6.6 14.75 12 18l5.4-3.25L12 13.05l-5.4 1.7Z" />
    </svg>
  );
}
