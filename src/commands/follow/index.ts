import type { Command } from '../../commands.js'

const follow = {
  type: 'local',
  name: 'follow',
  description:
    'Switch editable network-layer instruction-follow profiles (code, roleplay, …)',
  argumentHint: '[list|off|new <name>|<profile>]',
  immediate: true,
  disableModelInvocation: true,
  supportsNonInteractive: true,
  load: () => import('./follow.js'),
} satisfies Command

export default follow
