import type { Command } from '../../commands.js'

const keysmith = {
  type: 'local',
  name: 'keysmith',
  description:
    'Bridge claude-keysmith instruction content into the /follow network-layer injection',
  argumentHint: '[status|import|reimport|off]',
  immediate: true,
  disableModelInvocation: true,
  supportsNonInteractive: true,
  load: () => import('./keysmith.js'),
} satisfies Command

export default keysmith
