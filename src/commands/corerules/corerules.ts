import type { LocalCommandCall } from '../../types/command.js'
import {
  KEYSMITH_PROFILE_NAME,
  importKeysmithProfile,
  isKeysmithActive,
  resolveKeysmithProfilePath,
} from '../../utils/keysmithBridge.js'
import {
  getFollowPromptDirs,
  loadFollowPrompt,
  setActiveFollowProfileName,
} from '../../utils/instructionFollow.js'

function formatStatus(): string {
  const dirs = getFollowPromptDirs()
  const path = resolveKeysmithProfilePath(dirs)
  const active = isKeysmithActive()
  const loaded = loadFollowPrompt(KEYSMITH_PROFILE_NAME, dirs)

  const lines: string[] = []
  if (active && loaded) {
    lines.push(
      `Active: ${loaded.name} (${loaded.source})`,
      `File: ${loaded.path}`,
      'Injected on every API call as system policy + trailing recency reminder.',
    )
  } else if (active) {
    lines.push(
      `Profile "${KEYSMITH_PROFILE_NAME}" is active, but no file found.`,
    )
  } else {
    lines.push('keysmith instruction follow is OFF.')
  }

  lines.push('', `Profile file: ${path}`)
  lines.push(
    '',
    'Usage:',
    '  /keysmith            status',
    '  /keysmith import     write keysmith template + activate',
    '  /keysmith reimport   overwrite profile with template + activate',
    '  /keysmith off        deactivate',
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
      value:
        'keysmith instruction follow OFF. Sticky prompt will not be injected.',
    }
  }

  if (trimmed === 'import' || trimmed === 'reimport' || trimmed === 'update') {
    const result = importKeysmithProfile()
    if ('error' in result) {
      return { type: 'text', value: result.error }
    }
    return {
      type: 'text',
      value: [
        `keysmith profile written + activated: ${KEYSMITH_PROFILE_NAME}`,
        `File: ${result.path}`,
        'Edit the file anytime; the next API call reloads it.',
      ].join('\n'),
    }
  }

  return { type: 'text', value: formatStatus() }
}
