/**
 * Core Rules — high-priority behavioral constraints prepended to the front
 * of the message history. Not persisted in the REPL transcript.
 *
 * Currently a no-op (empty turn list). The identity anchor is declared
 * directly in the system prompt (see IDENTITY_REDEFINITION in system.ts),
 * which is more stable across model providers than history-level turns.
 *
 * Shape when CORE_RULES_TURNS is non-empty:
 *   [CORE_RULES_TURNS…]
 *   [real history…]
 *
 * Empty array = no turns added.
 */

import type {
  AssistantMessage,
  Message,
  UserMessage,
} from '../types/message.js'
import { createAssistantMessage, createUserMessage } from './messages.js'

export type CoreRuleTurn = {
  role: 'assistant' | 'user'
  content: string
}

/**
 * High-priority turns prepended to the front of the message history.
 * Add rounds as needed. Leave empty to disable.
 *
 * Rounds anchor the 小砂糖 persona, the Core Rules, and the opening-line
 * convention so the model treats them as established prior context.
 */
export const CORE_RULES_TURNS: CoreRuleTurn[] = []

type ApiMessage = AssistantMessage | UserMessage

export function resolveCoreRulesTurns(
  turns: readonly CoreRuleTurn[] = CORE_RULES_TURNS,
): CoreRuleTurn[] {
  return turns
    .map(turn => ({
      role: turn.role,
      content: turn.content.trim(),
    }))
    .filter(turn => turn.content.length > 0)
}

function getUserText(message: Message): string | null {
  if (message.type !== 'user') {
    return null
  }
  const content = (message as UserMessage).message.content
  if (typeof content === 'string') {
    return content
  }
  if (!Array.isArray(content)) {
    return null
  }
  return content
    .filter(block => block.type === 'text')
    .map(block => ('text' in block ? block.text : ''))
    .join('')
}

function getAssistantText(message: Message): string | null {
  if (message.type !== 'assistant') {
    return null
  }
  const content = (message as AssistantMessage).message.content
  if (!Array.isArray(content)) {
    return null
  }
  return content
    .filter(block => block.type === 'text')
    .map(block => ('text' in block ? String(block.text) : ''))
    .join('')
}

function messageMatchesTurn(message: Message, turn: CoreRuleTurn): boolean {
  if (message.type !== turn.role) {
    return false
  }
  const text =
    turn.role === 'user' ? getUserText(message) : getAssistantText(message)
  return text === turn.content
}

/** Dedupe consecutive same-role turns within the configured list. */
function dedupeRoles(turns: readonly CoreRuleTurn[]): CoreRuleTurn[] {
  const result: CoreRuleTurn[] = []
  let lastRole: CoreRuleTurn['role'] | undefined
  for (const turn of turns) {
    if (turn.role === lastRole) {
      continue
    }
    result.push(turn)
    lastRole = turn.role
  }
  return result
}

function createCoreRuleMessage(turn: CoreRuleTurn): ApiMessage {
  if (turn.role === 'user') {
    return createUserMessage({
      content: turn.content,
      isMeta: true,
    })
  }
  return {
    ...createAssistantMessage({ content: turn.content }),
    isMeta: true,
  }
}

function asSpeakerRole(
  type: Message['type'] | undefined,
): CoreRuleTurn['role'] | undefined {
  return type === 'assistant' || type === 'user' ? type : undefined
}

/** Drop previously prepended turns sitting before the real history. */
function stripLeadingMatchingTurns<T extends Message>(
  messages: readonly T[],
  turns: readonly CoreRuleTurn[],
): T[] {
  if (messages.length < 1 || turns.length < 1) {
    return [...messages]
  }
  let start = 0
  let turnIndex = 0
  while (start < messages.length && turnIndex < turns.length) {
    if (messageMatchesTurn(messages[start]!, turns[turnIndex]!)) {
      start += 1
      turnIndex += 1
      continue
    }
    break
  }
  return messages.slice(start)
}

/** Drop previously prepended turns sitting before the real history. */
export function stripCoreRulesTurns<T extends Message>(
  messages: readonly T[],
  turns: readonly CoreRuleTurn[] = CORE_RULES_TURNS,
): T[] {
  const resolved = resolveCoreRulesTurns(turns)
  if (resolved.length < 1) {
    return [...messages]
  }
  return stripLeadingMatchingTurns(messages, resolved)
}

/** @deprecated Use stripCoreRulesTurns. */
export function stripTrailingCoreRulesTurns<T extends Message>(
  messages: readonly T[],
  turns: readonly CoreRuleTurn[] = CORE_RULES_TURNS,
): T[] {
  return stripCoreRulesTurns(messages, turns)
}

/**
 * Insert configured turns at the front of the message history, before the
 * real conversation.
 * Empty CORE_RULES_TURNS → no-op.
 */
export function appendCoreRulesTurns<T extends Message>(
  messages: readonly T[],
  turns: readonly CoreRuleTurn[] = CORE_RULES_TURNS,
): Array<T | ApiMessage> {
  const resolved = resolveCoreRulesTurns(turns)
  if (resolved.length < 1) {
    return [...messages]
  }
  const stripped = stripLeadingMatchingTurns(messages, resolved)

  let selected = dedupeRoles(resolved)
  const firstReal = stripped[0]
  const firstRealRole = firstReal ? asSpeakerRole(firstReal.type) : undefined
  // Avoid role collision at the junction with the first real message
  // (e.g. the list ends with assistant but the history starts with assistant).
  if (
    firstRealRole !== undefined &&
    selected.length > 0 &&
    selected[selected.length - 1]!.role === firstRealRole
  ) {
    selected = selected.slice(0, -1)
  }

  return [...selected.map(createCoreRuleMessage), ...stripped]
}
