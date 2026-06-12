import {
  type SkillInfo,
  type SkillSource,
  isTauriRuntime,
  openExternalUrl,
  openLocalPath,
  revealLocalPath,
  normalizeRepoSource,
} from '../../api/editor-target-command';

function splitNormalizedRepoSource(repo: string): {
  repoRoot: string;
  subpath: string | null;
} | null {
  const normalized = normalizeRepoSource(repo);
  const parts = normalized.split('/').filter(Boolean);

  if (parts.length < 2) {
    return null;
  }

  return {
    repoRoot: `${parts[0]}/${parts[1]}`,
    subpath: parts.length > 2 ? parts.slice(2).join('/') : null,
  };
}

function normalizeRepoSkillDirectory(repoSkillPath?: string): string | null {
  if (!repoSkillPath) {
    return null;
  }

  return repoSkillPath
    .replace(/\/+$/, '')
    .replace(/\/SKILL\.md$/i, '')
    .replace(/SKILL\.md$/i, '')
    .replace(/\/+$/, '');
}

export function isSkillFromRepoSource(
  skill: SkillInfo,
  repoSource: string,
): boolean {
  if (!skill.repoSource) {
    return false;
  }

  const selectedRepo = splitNormalizedRepoSource(repoSource);
  const skillRepo = splitNormalizedRepoSource(skill.repoSource);

  if (!selectedRepo || !skillRepo) {
    return (
      normalizeRepoSource(skill.repoSource) === normalizeRepoSource(repoSource)
    );
  }

  if (selectedRepo.repoRoot !== skillRepo.repoRoot) {
    return false;
  }

  if (!selectedRepo.subpath) {
    return true;
  }

  const repoSkillDirectory = normalizeRepoSkillDirectory(skill.repoSkillPath);
  if (!repoSkillDirectory) {
    return false;
  }

  return (
    repoSkillDirectory === selectedRepo.subpath ||
    repoSkillDirectory.startsWith(`${selectedRepo.subpath}/`)
  );
}

export function isPresetSkillMatch(skillId: string, presetId: string): boolean {
  const normalizedSkillId = skillId.toLowerCase();
  const normalizedPresetId = presetId.toLowerCase();

  return (
    normalizedSkillId === normalizedPresetId ||
    normalizedSkillId.endsWith(`/${normalizedPresetId}`) ||
    normalizedSkillId.endsWith(`__${normalizedPresetId}`)
  );
}

export function getSkillSourceBadgeMeta(
  skill: SkillInfo,
  skillSources: SkillSource[],
): { text: string; className: string } {
  // Built-in preset.
  if (skill.isBuiltin) {
    return { text: '官方', className: 'skill-source-badge--builtin' };
  }

  // Match a user-defined repository source.
  const matchedRepo = skillSources.find(
    (src) => src.type === 'repo' && isSkillFromRepoSource(skill, src.value),
  );
  if (matchedRepo) {
    return { text: '第三方', className: 'skill-source-badge--repository' };
  }

  // Match a user-defined local source.
  const matchedLocal = skillSources.find(
    (src) =>
      src.type === 'local' &&
      skill.path &&
      skill.path.toLowerCase().startsWith(src.value.toLowerCase()),
  );
  if (matchedLocal) {
    return {
      text: matchedLocal.name || '本地',
      className: 'skill-source-badge--readonly',
    };
  }

  return { text: '本地', className: 'skill-source-badge--readonly' };
}

export function getSkillRepoUrl(
  repoSource: string,
  repoSkillPath?: string,
): string {
  const normalizedSource = normalizeRepoSource(repoSource);
  const parts = normalizedSource.split('/').filter(Boolean);

  if (parts.length <= 2) {
    const repoSkillDirectory = normalizeRepoSkillDirectory(repoSkillPath);
    if (repoSkillDirectory) {
      return `https://github.com/${parts.join('/')}/tree/main/${repoSkillDirectory}`;
    }

    return `https://github.com/${parts.join('/')}`;
  }

  const [owner, repo, ...subpath] = parts;
  return `https://github.com/${owner}/${repo}/tree/main/${subpath.join('/')}`;
}

export async function openSkillRepoUrl(url: string): Promise<void> {
  if (isTauriRuntime()) {
    await openExternalUrl(url);
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}

export async function openSkillLocalPath(path: string): Promise<void> {
  if (isTauriRuntime()) {
    await openLocalPath(path);
    return;
  }
  window.open(`file://${path}`, '_blank', 'noopener,noreferrer');
}

export async function revealSkillLocalPath(path: string): Promise<void> {
  if (isTauriRuntime()) {
    await revealLocalPath(path);
    return;
  }

  const normalizedPath = path.replace(/\/+$/, '');
  const parentPath = normalizedPath.includes('/')
    ? normalizedPath.slice(0, normalizedPath.lastIndexOf('/')) || '/'
    : normalizedPath;
  window.open(`file://${parentPath}`, '_blank', 'noopener,noreferrer');
}
