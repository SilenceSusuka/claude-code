import type { LocalCommandCall } from '../../types/command.js'
import {
  createFollowProfile,
  getActiveFollowProfileName,
  getFollowPromptDirs,
  listFollowProfiles,
  loadFollowPrompt,
  resolveFollowProfile,
  setActiveFollowProfileName,
} from '../../utils/instructionFollow.js'

function formatStatus(): string {
  const dirs = getFollowPromptDirs()
  const profiles = listFollowProfiles(dirs)
  const active = getActiveFollowProfileName()
  const loaded = loadFollowPrompt(active, dirs)

  const lines: string[] = []
  if (loaded) {
    lines.push(
      `Active: ${loaded.name} (${loaded.source})`,
      `File: ${loaded.path}`,
      `Inject: system field + trailing <instruction-follow> on every API call`,
      `Edit the file directly; the next model hop reloads it.`,
    )
  } else if (active) {
    lines.push(
      `Active profile "${active}" is set, but no markdown file was found.`,
      `Create it with /follow new ${active}`,
    )
  } else {
    lines.push('Instruction follow is OFF.')
  }

  lines.push('')
  lines.push(`User dir: ${dirs.userDir}`)
  lines.push(`Project dir: ${dirs.projectDir}`)
  lines.push('')

  if (profiles.length === 0) {
    lines.push('No profiles yet. Create one: /follow new <name>')
  } else {
    lines.push('Profiles:')
    for (const profile of profiles) {
      const mark = profile.name === active ? '* ' : '  '
      lines.push(`${mark}${profile.name}  [${profile.source}]  ${profile.path}`)
    }
  }

  lines.push(
    '',
    'Usage:',
    '  /follow              status + list',
    '  /follow list         list profiles',
    '  /follow <name>       activate a profile',
    '  /follow off          disable',
    '  /follow new <name>   create ~/.claude/follow-prompts/<name>.md',
  )
  return lines.join('\n')
}

export const call: LocalCommandCall = async args => {
  const trimmed = args.trim()
  if (!trimmed || trimmed === 'list' || trimmed === 'status') {
    return { type: 'text', value: formatStatus() }
  }

  if (trimmed === 'off' || trimmed === 'disable' || trimmed === 'none') {
    setActiveFollowProfileName(null)
    return {
      type: 'text',
      value:
        'Instruction follow OFF. Network-layer sticky prompts will not be injected.',
    }
  }

  const newMatch = trimmed.match(/^new\s+(\S+)$/i)
  if (newMatch?.[1]) {
    const name = newMatch[1]
    const result = createFollowProfile(name)
    if ('error' in result) {
      return { type: 'text', value: result.error }
    }
    setActiveFollowProfileName(name)
    return {
      type: 'text',
      value: [
        `Created and activated profile "${name}".`,
        `Edit this file, then keep working — the next API call reloads it:`,
        result.path,
      ].join('\n'),
    }
  }

  if (trimmed.startsWith('new ')) {
    return {
      type: 'text',
      value: 'Usage: /follow new <name>',
    }
  }

  const name = trimmed.split(/\s+/)[0] ?? ''
  const resolved = resolveFollowProfile(name)
  if (!resolved) {
    return {
      type: 'text',
      value: [
        `Profile "${name}" not found.`,
        `Create it with /follow new ${name}`,
        '',
        formatStatus(),
      ].join('\n'),
    }
  }

  setActiveFollowProfileName(name)
  return {
    type: 'text',
    value: [
      `Instruction follow ON: ${resolved.name} (${resolved.source})`,
      `File: ${resolved.path}`,
      'Injected on every model call as system policy + trailing recency reminder.',
      'Edit the file anytime; the next hop picks up the new text.',
    ].join('\n'),
  }
}
