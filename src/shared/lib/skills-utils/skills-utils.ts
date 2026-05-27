import { type SkillInfo, type SkillSource, isTauriRuntime, openExternalUrl, openLocalPath, revealLocalPath, normalizeRepoSource } from "../../api/editor-target-command";

export function isPresetSkillMatch(skillId: string, presetId: string): boolean {
  const normalizedSkillId = skillId.toLowerCase();
  const normalizedPresetId = presetId.toLowerCase();

  return normalizedSkillId === normalizedPresetId
    || normalizedSkillId.endsWith(`/${normalizedPresetId}`)
    || normalizedSkillId.endsWith(`__${normalizedPresetId}`);
}

export function getSkillSourceBadgeMeta(
  skill: SkillInfo,
  skillSources: SkillSource[],
): { text: string; className: string } {
  // 官方预设
  if (skill.isBuiltin) {
    return { text: "官方", className: "skill-source-badge--builtin" };
  }

  // 匹配用户自定义 repo 源
  const matchedRepo = skillSources.find(
    (src) =>
      src.type === "repo" &&
      skill.repoSource &&
      normalizeRepoSource(skill.repoSource) === normalizeRepoSource(src.value),
  );
  if (matchedRepo) {
    return { text: "第三方", className: "skill-source-badge--repository" };
  }

  // 匹配用户自定义本地源
  const matchedLocal = skillSources.find(
    (src) =>
      src.type === "local" &&
      skill.path &&
      skill.path.toLowerCase().startsWith(src.value.toLowerCase()),
  );
  if (matchedLocal) {
    return { text: matchedLocal.name || "本地", className: "skill-source-badge--readonly" };
  }

  return { text: "本地", className: "skill-source-badge--readonly" };
}

export function getSkillRepoUrl(repoSource: string): string {
  return `https://github.com/${repoSource}`;
}

export async function openSkillRepoUrl(url: string): Promise<void> {
  if (isTauriRuntime()) {
    await openExternalUrl(url);
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

export async function openSkillLocalPath(path: string): Promise<void> {
  if (isTauriRuntime()) {
    await openLocalPath(path);
    return;
  }
  window.open(`file://${path}`, "_blank", "noopener,noreferrer");
}

export async function revealSkillLocalPath(path: string): Promise<void> {
  if (isTauriRuntime()) {
    await revealLocalPath(path);
    return;
  }

  const normalizedPath = path.replace(/\/+$/, "");
  const parentPath = normalizedPath.includes("/")
    ? normalizedPath.slice(0, normalizedPath.lastIndexOf("/")) || "/"
    : normalizedPath;
  window.open(`file://${parentPath}`, "_blank", "noopener,noreferrer");
}
