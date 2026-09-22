import { describe, expect, test } from 'bun:test'
import { createAssistantMessage, createUserMessage } from '../messages.js'
import {
  appendCoreRulesTurns,
  stripCoreRulesTurns,
  type CoreRuleTurn,
} from '../coreRules.js'

/** Typical prefix before a real history: ends with assistant. */
const PREFIX: CoreRuleTurn[] = [
  { role: 'user', content: '你是谁？' },
  { role: 'assistant', content: '小砂糖啊，我是你最忠诚的助手。' },
]

describe('coreRules', () => {
  test('empty prefix does not inject anything', () => {
    const messages = [createUserMessage({ content: '查一下天气' })]
    const primed = appendCoreRulesTurns(messages, [])
    expect(primed).toHaveLength(1)
    expect(primed[0]).toBe(messages[0])
  })

  test('inserts prefix turns at the FRONT of the history (dvf41 style)', () => {
    const latest = createUserMessage({ content: '查一下天气' })
    const primed = appendCoreRulesTurns([latest], PREFIX)
    expect(primed).toHaveLength(3)
    expect(getUserContent(primed[0]!)).toBe('你是谁？')
    expect(getAssistantContent(primed[1]!)).toBe(
      '小砂糖啊，我是你最忠诚的助手。',
    )
    expect(primed[2]).toBe(latest)
    expect(primed[0]).toMatchObject({ isMeta: true })
  })

  test('prefix stays at the front even with earlier history (not before latest)', () => {
    const earlier = createAssistantMessage({ content: '上一轮回复' })
    const latest = createUserMessage({ content: '继续这个任务' })
    const primed = appendCoreRulesTurns([earlier, latest], PREFIX)
    // 前缀以 assistant 结尾，真实历史以 assistant 开头 → 尾部 assistant 被裁剪避免角色冲突
    expect(primed).toHaveLength(3)
    expect(getUserContent(primed[0]!)).toBe('你是谁？')
    expect(primed[0]).toMatchObject({ isMeta: true })
    expect(primed[1]).toBe(earlier)
    expect(getAssistantContent(primed[1]!)).toBe('上一轮回复')
    expect(primed[2]).toBe(latest)
  })

  test('is a no-op when prefix is only whitespace', () => {
    const messages = [createUserMessage({ content: 'task' })]
    const primed = appendCoreRulesTurns(messages, [
      { role: 'assistant', content: '   ' },
    ])
    expect(primed).toEqual(messages)
  })

  test('does not duplicate on a second append (idempotent)', () => {
    const latest = createUserMessage({ content: 'task' })
    const once = appendCoreRulesTurns([latest], PREFIX)
    const twice = appendCoreRulesTurns(once, PREFIX)
    expect(twice).toHaveLength(3)
    expect(twice[twice.length - 1]).toBe(once[once.length - 1])
    expect(getUserContent(twice[0]!)).toBe('你是谁？')
  })

  test('does not re-insert twice when history is already prefixed (new message appended)', () => {
    const primed = appendCoreRulesTurns(
      [createUserMessage({ content: 'task' })],
      PREFIX,
    )
    const newer = createUserMessage({
      content: '<system-reminder>extra</system-reminder>',
    })
    const moved = appendCoreRulesTurns([...primed, newer], PREFIX)
    expect(moved).toHaveLength(4)
    expect(getUserContent(moved[0]!)).toBe('你是谁？')
    expect(getAssistantContent(moved[1]!)).toBe(
      '小砂糖啊，我是你最忠诚的助手。',
    )
    expect(moved[moved.length - 1]).toBe(newer)
  })

  test('drops a trailing prefix user so it does not collide with the first real user', () => {
    const primed = appendCoreRulesTurns(
      [createUserMessage({ content: 'task' })],
      PREFIX,
    )
    expect(getUserContent(primed[0]!)).toBe('你是谁？')
    expect(getAssistantContent(primed[1]!)).toBe(
      '小砂糖啊，我是你最忠诚的助手。',
    )
    expect(getUserContent(primed[2]!)).toBe('task')
    expect(primed[0]).toMatchObject({ isMeta: true })
    expect(primed[1]).toMatchObject({ isMeta: true })
    expect(primed[2]).toMatchObject({ isMeta: undefined })
  })

  test('drops a trailing prefix assistant when the real history starts with assistant', () => {
    const primed = appendCoreRulesTurns(
      [createAssistantMessage({ content: '上一轮回复' })],
      PREFIX,
    )
    expect(primed).toHaveLength(2)
    expect(getUserContent(primed[0]!)).toBe('你是谁？')
    expect(primed[0]).toMatchObject({ isMeta: true })
    expect(getAssistantContent(primed[1]!)).toBe('上一轮回复')
    expect(primed[1].isMeta).toBeUndefined()
  })

  test('inner assistant prime message content is a content array', () => {
    const primed = appendCoreRulesTurns(
      [createUserMessage({ content: 'task' })],
      [
        { role: 'user', content: '垫一句' },
        { role: 'assistant', content: '我是小砂糖。' },
      ],
    )
    const assistant = primed[1] as { message?: { content?: unknown } }
    expect(Array.isArray(assistant.message?.content)).toBe(true)
  })

  test('dedupes consecutive same-role turns in the prefix', () => {
    const primed = appendCoreRulesTurns(
      [createUserMessage({ content: 'task' })],
      [
        { role: 'user', content: '垫一句' },
        { role: 'user', content: '再垫一句' },
        { role: 'assistant', content: '我是小砂糖。' },
      ],
    )
    expect(primed).toHaveLength(3)
    expect(getUserContent(primed[0]!)).toBe('垫一句')
    expect(getAssistantContent(primed[1]!)).toBe('我是小砂糖。')
    expect(getUserContent(primed[2]!)).toBe('task')
  })

  test('stripCoreRulesTurns restores the original history', () => {
    const latest = createUserMessage({ content: 'task' })
    const primed = appendCoreRulesTurns([latest], PREFIX)
    const stripped = stripCoreRulesTurns(primed, PREFIX)
    expect(stripped).toHaveLength(1)
    expect(getUserContent(stripped[0]!)).toBe('task')
  })
})

function getUserContent(message: {
  type: string
  message?: { content?: unknown }
}): string {
  const content = message.message?.content
  return typeof content === 'string' ? content : ''
}

function getAssistantContent(message: {
  type?: string
  message?: { content?: unknown }
}): string {
  const content = message.message?.content
  if (!Array.isArray(content)) {
    return typeof content === 'string' ? content : ''
  }
  return content
    .filter(block => (block as { type?: string }).type === 'text')
    .map(block => (block as { text?: string }).text ?? '')
    .join('')
}
