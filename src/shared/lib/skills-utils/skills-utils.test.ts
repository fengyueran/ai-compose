import { describe, expect, test } from 'vitest';

import { getSkillRepoUrl, isSkillFromRepoSource } from './skills-utils';

describe('getSkillRepoUrl', () => {
  test('builds a direct GitHub tree URL for repo skill subpaths', () => {
    expect(
      getSkillRepoUrl('github/awesome-copilot', 'skills/refactor/SKILL.md'),
    ).toBe(
      'https://github.com/github/awesome-copilot/tree/main/skills/refactor',
    );
  });
});

describe('isSkillFromRepoSource', () => {
  test('matches a skill by repo root and repo skill path prefix', () => {
    expect(
      isSkillFromRepoSource(
        {
          id: 'refactor',
          name: 'refactor',
          description: '',
          content: '',
          path: '/tmp/refactor',
          sourceKind: 'cli',
          repoSource: 'github/awesome-copilot',
          repoSkillPath: 'skills/refactor/SKILL.md',
        },
        'github/awesome-copilot/skills/refactor',
      ),
    ).toBe(true);
  });
});
