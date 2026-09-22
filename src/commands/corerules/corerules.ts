import type { LocalCommandCall } from '../../types/command.js'
import {
  CORE_RULES_PROFILE_NAME,
  importCoreRulesProfile,
  isCoreRulesActive,
  resolveCoreRulesProfilePath,
} from '../../utils/coreRulesBridge.js'
import {
  getFollowPromptDirs,
  loadFollowPrompt,
  setActiveFollowProfileName,
} from '../../utils/coreRulesFollow.js'

function formatStatus(): string {
  const dirs = getFollowPromptDirs()
  const path = resolveCoreRulesProfilePath(dirs)
  const active = isCoreRulesActive()
  const loaded = loadFollowPrompt(CORE_RULES_PROFILE_NAME, dirs)

  const lines: string[] = []
  if (active && loaded) {
    lines.push(
      `Active: ${loaded.name} (${loaded.source})`,
      `File: ${loaded.path}`,
      'Applied on every API call as system policy + trailing recency reminder.',
    )
  } else if (active) {
    lines.push(
      `Profile "${CORE_RULES_PROFILE_NAME}" is active, but no file found.`,
    )
  } else {
    lines.push('Core Rules is OFF.')
  }

  lines.push('', `Profile file: ${path}`)
  lines.push(
    '',
    'Usage:',
    '  /corerules            status',
    '  /corerules import     write Core Rules template + activate',
    '  /corerules reimport   overwrite profile with template + activate',
    '  /corerules off        deactivate',
  )
  return lines.join('\n')
}

export const call: LocalCommandCall = async args => {
  const trimmed = args.trim()

  if (!trimmed || trimmed === 'status') {
    return { type: 'text', value: formatStatus() }
  }

  if (trimmed === 'off' || trimmed === 'disable' || trimmed === 'none') {
    setActiveFollowProfileName(null)
    return {
      type: 'text',
      value: 'Core Rules OFF. Sticky prompt will not be applied.',
    }
  }

  if (trimmed === 'import' || trimmed === 'reimport' || trimmed === 'update') {
    const result = importCoreRulesProfile()
    if ('error' in result) {
      return { type: 'text', value: result.error }
    }
    return {
      type: 'text',
      value: [
        `Core Rules profile written + activated: ${CORE_RULES_PROFILE_NAME}`,
        `File: ${result.path}`,
        'Edit the file anytime; the next API call reloads it.',
      ].join('\n'),
    }
  }

  return { type: 'text', value: formatStatus() }
}
