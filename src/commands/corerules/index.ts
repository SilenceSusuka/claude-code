import type { Command } from '../../commands.js'

const corerules = {
  type: 'local',
  name: 'corerules',
  description:
    'Bridge Core Rules content into the /follow network layer',
  argumentHint: '[status|import|reimport|off]',
  immediate: true,
  disableModelInvocation: true,
  supportsNonInteractive: true,
  load: () => import('./corerules.js'),
} satisfies Command

export default corerules
