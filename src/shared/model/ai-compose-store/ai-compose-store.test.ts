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

  test('addHook creates a shared hook entry and tracks editor toggles per hook', () => {
    useAiComposeStore.setState({
      hooksState: {
        hooks: [
          {
            id: 'shared-hook',
            name: '格式化',
            trigger: 'after-run',
            failurePolicy: 'warn',
            commands: [{ id: 'cmd-1', command: 'prettier --write {{changed_files}}' }],
            enabledEditors: {
              antigravity: false,
              codex: true,
              cursor: false,
            },
          },
        ],
        selectedHookId: 'shared-hook',
        targetPaths: {
          antigravity: '/Users/test/.gemini/settings.json',
          codex: '/Users/test/.codex/hooks.json',
          cursor: '/Users/test/.cursor/hooks.json',
        },
        validationErrors: [],
      },
      hooksEditorStates: {
        antigravity: { enabled: false },
        codex: { enabled: true },
        cursor: { enabled: false },
      },
    })

    const store = useAiComposeStore.getState()
    store.selectDomain('Hooks')
    store.addHook()
    const createdHookId = useAiComposeStore.getState().hooksState.selectedHookId
    store.toggleHookEditor(createdHookId, 'cursor')

    const nextState = useAiComposeStore.getState()
    expect(nextState.activeDomain).toBe('Hooks')
    expect(nextState.editorStates).toEqual(nextState.hooksEditorStates)
    expect(nextState.hooksState.hooks).toHaveLength(2)
    expect(
      nextState.hooksState.hooks.find((hook) => hook.id === createdHookId)?.enabledEditors.cursor,
    ).toBe(true)
    expect(
      nextState.hooksState.hooks.find((hook) => hook.id === 'shared-hook')?.enabledEditors.codex,
    ).toBe(true)
  })

  test('deleteHook removes the specified hook from the store', () => {
    useAiComposeStore.setState({
      hooksState: {
        hooks: [
          {
            id: 'hook-to-delete',
            name: '要删除的 Hook',
            trigger: 'after-run',
            failurePolicy: 'warn',
            commands: [{ id: 'cmd-1', command: 'echo "hello"' }],
            enabledEditors: {
              antigravity: false,
              codex: true,
              cursor: false,
            },
          },
          {
            id: 'hook-to-keep',
            name: '保留的 Hook',
            trigger: 'before-run',
            failurePolicy: 'block',
            commands: [{ id: 'cmd-2', command: 'echo "world"' }],
            enabledEditors: {
              antigravity: true,
              codex: false,
              cursor: false,
            },
          },
        ],
        selectedHookId: 'hook-to-delete',
        targetPaths: {
          antigravity: '/Users/test/.gemini/settings.json',
          codex: '/Users/test/.codex/hooks.json',
          cursor: '/Users/test/.cursor/hooks.json',
        },
        validationErrors: [],
      },
      hooksEditorStates: {
        antigravity: { enabled: true },
        codex: { enabled: true },
        cursor: { enabled: false },
      },
    })

    const store = useAiComposeStore.getState()
    store.deleteHook('hook-to-delete')

    const nextState = useAiComposeStore.getState()
    expect(nextState.hooksState.hooks).toHaveLength(1)
    expect(nextState.hooksState.hooks[0].id).toBe('hook-to-keep')
    expect(nextState.hooksState.selectedHookId).toBe('hook-to-keep')
    expect(nextState.hooksEditorStates.antigravity.enabled).toBe(true)
    expect(nextState.hooksEditorStates.codex.enabled).toBe(false)
  })
})
