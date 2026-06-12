import { describe, expect, test } from 'vitest';

import { normalizeRepoSource } from './editor-target-command';

describe('normalizeRepoSource', () => {
  test('keeps a repo skill subpath in owner/repo/path form', () => {
    expect(normalizeRepoSource('github/awesome-copilot/skills/refactor')).toBe(
      'github/awesome-copilot/skills/refactor',
    );
  });

  test('normalizes a GitHub tree URL into owner/repo/path form', () => {
    expect(
      normalizeRepoSource(
        'https://github.com/github/awesome-copilot/tree/main/skills/refactor?tab=readme-ov-file',
      ),
    ).toBe('github/awesome-copilot/skills/refactor');
  });
});
