import { describe, expect, test } from 'vitest'
import { presetPromptFragments } from './prompt-fragments'

describe('presetPromptFragments', () => {
  test('integrates core Karpathy guidelines into existing preset categories', () => {
    const byId = Object.fromEntries(
      presetPromptFragments.map((fragment) => [fragment.id, fragment]),
    )

    expect(byId['development-workflow']?.items).toContain(
      '编码前先显式说明假设、歧义与权衡；信息不足时先澄清，不要静默猜测后直接实现',
    )
    expect(byId['coding-style']?.items).toContain(
      '优先使用解决当前问题的最小实现；不要增加未被要求的功能、抽象、配置或猜测性扩展',
    )
    expect(byId['code-review']?.items).toContain(
      '只修改完成当前任务所必需的代码；不要顺手“改进”相邻代码、注释、格式或未损坏的实现',
    )
    expect(byId['testing-requirements']?.items).toContain(
      '将任务改写为可验证的成功标准；优先编写能复现问题或约束行为的测试，再实现并验证通过',
    )
  })
})
