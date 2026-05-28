import { beforeEach, describe, expect, test } from 'vitest'

import { useAiComposeStore } from './ai-compose-store'

describe('useAiComposeStore', () => {
  beforeEach(() => {
    useAiComposeStore.setState(useAiComposeStore.getInitialState())
  })

  test('setSkillsList preserves the builtin catalog and marks matching official skills as installed', () => {
    const store = useAiComposeStore.getState()

    store.setSkillsList([
      {
        id: 'find-skills',
        name: 'find-skills',
        description: 'preset desc',
        content: 'preset content',
        path: '/mock/path/find-skills',
        sourceKind: 'cli',
      },
      {
        id: 'custom-repo-skill',
        name: 'custom-repo-skill',
        description: 'custom repo skill',
        content: '# custom-repo-skill',
        path: '/mock/path/custom-repo-skill',
        sourceKind: 'cli',
        repoSource: 'fengyueran/skills',
      },
    ])

    let currentSkills = useAiComposeStore.getState().skills
    const findSkillsInstalled = currentSkills.find((skill) => skill.id === 'find-skills')
    expect(findSkillsInstalled).toBeDefined()
    expect(findSkillsInstalled?.installed).toBe(true)
    expect(findSkillsInstalled?.isBuiltin).toBe(true)
    expect(findSkillsInstalled?.repoSource).toBe('vercel-labs/skills')

    const uiUxProMax = currentSkills.find((skill) => skill.id === 'ui-ux-pro-max')
    expect(uiUxProMax).toBeDefined()
    expect(uiUxProMax?.isBuiltin).toBe(true)
    expect(uiUxProMax?.installed).toBe(false)
    expect(uiUxProMax?.repoSource).toBe('nextlevelbuilder/ui-ux-pro-max-skill')

    const customRepoSkill = currentSkills.find((skill) => skill.id === 'custom-repo-skill')
    expect(customRepoSkill).toBeDefined()
    expect(customRepoSkill?.isBuiltin).not.toBe(true)
    expect(customRepoSkill?.repoSource).toBe('fengyueran/skills')

    store.setSkillsList([])
    currentSkills = useAiComposeStore.getState().skills
    expect(currentSkills.some((skill) => skill.id === 'ui-ux-pro-max')).toBe(true)
    expect(currentSkills.every((skill) => skill.isBuiltin)).toBe(true)
  })
})
