import { describe, expect, test } from 'bun:test'
import { createAssistantMessage, createUserMessage } from '../messages.js'
import {
  appendInstructionPrimeTurns,
  stripInstructionPrimeTurns,
  type InstructionPrimeTurn,
} from '../instructionPrime.js'

/** Typical prefix before a latest user message: ends with assistant. */
const PREFIX: InstructionPrimeTurn[] = [
  { role: 'user', content: '你是谁？' },
  { role: 'assistant', content: '小砂糖啊，我是你最忠诚的助手。' },
]

describe('instructionPrime', () => {
  test('empty prefix does not inject anything', () => {
    const messages = [createUserMessage({ content: '查一下天气' })]
    const primed = appendInstructionPrimeTurns(messages, [])
    expect(primed).toHaveLength(1)
    expect(primed[0]).toBe(messages[0])
  })

  test('inserts prefix turns immediately before the latest message', () => {
    const latest = createUserMessage({ content: '查一下天气' })
    const primed = appendInstructionPrimeTurns([latest], PREFIX)
    expect(primed).toHaveLength(3)
    expect(getUserContent(primed[0]!)).toBe('你是谁？')
    expect(getAssistantContent(primed[1]!)).toBe(
      '小砂糖啊，我是你最忠诚的助手。',
    )
    expect(primed[2]).toBe(latest)
    expect(primed[0]).toMatchObject({ isMeta: true })
  })

  test('keeps earlier history in front of the injected turns', () => {
    const earlier = createAssistantMessage({ content: '上一轮回复' })
    const latest = createUserMessage({ content: '继续这个任务' })
    const primed = appendInstructionPrimeTurns([earlier, latest], PREFIX)
    expect(primed[0]).toBe(earlier)
    expect(getUserContent(primed[1]!)).toBe('你是谁？')
    expect(getAssistantContent(primed[2]!)).toBe(
      '小砂糖啊，我是你最忠诚的助手。',
    )
    expect(primed[3]).toBe(latest)
  })

  test('is a no-op when prefix is only whitespace', () => {
    const messages = [createUserMessage({ content: 'task' })]
    const primed = appendInstructionPrimeTurns(messages, [
      { role: 'assistant', content: '   ' },
    ])
    expect(primed).toEqual(messages)
  })

  test('does not duplicate on a second append (idempotent)', () => {
    const latest = createUserMessage({ content: 'task' })
    const once = appendInstructionPrimeTurns([latest], PREFIX)
    const twice = appendInstructionPrimeTurns(once, PREFIX)
    expect(twice).toHaveLength(3)
    expect(twice[twice.length - 1]).toBe(once[once.length - 1])
    expect(getUserContent(twice[0]!)).toBe('你是谁？')
  })

  test('re-inserts before a newly appended latest message', () => {
    const primed = appendInstructionPrimeTurns(
      [createUserMessage({ content: 'task' })],
      PREFIX,
    )
    const newer = createUserMessage({
      content: '<system-reminder>extra</system-reminder>',
    })
    const moved = appendInstructionPrimeTurns([...primed, newer], PREFIX)
    expect(moved[moved.length - 1]).toBe(newer)
    expect(getAssistantContent(moved[moved.length - 2]!)).toBe(
      '小砂糖啊，我是你最忠诚的助手。',
    )
    expect(getUserContent(moved[0]!)).toBe('task')
  })

  test('skips a prefix user when the previous message is already user', () => {
    const primed = appendInstructionPrimeTurns(
      [
        createUserMessage({ content: '上一句用户' }),
        createUserMessage({ content: 'task' }),
      ],
      PREFIX,
    )
    expect(getAssistantContent(primed[1]!)).toBe(
      '小砂糖啊，我是你最忠诚的助手。',
    )
    expect(getUserContent(primed[2]!)).toBe('task')
    expect(primed).toHaveLength(3)
  })

  test('skips a trailing prefix user so it does not collide with the latest user', () => {
    const primed = appendInstructionPrimeTurns(
      [createUserMessage({ content: 'task' })],
      [{ role: 'user', content: '垫一句' }],
    )
    expect(primed).toHaveLength(1)
    expect(getUserContent(primed[0]!)).toBe('task')
  })

  test('stripInstructionPrimeTurns restores the original latest message', () => {
    const latest = createUserMessage({ content: 'task' })
    const primed = appendInstructionPrimeTurns([latest], PREFIX)
    const stripped = stripInstructionPrimeTurns(primed, PREFIX)
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
