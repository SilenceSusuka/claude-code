import { existsSync, readFileSync, rmSync } from 'fs'
import { mkdtempSync } from 'fs'
import { afterAll, afterEach, describe, expect, mock, test } from 'bun:test'
import { join } from 'path'
import { tmpdir } from 'os'
import * as settingsModule from '../settings/settings.js'
import type { FollowPromptDirs } from '../coreRulesFollow.js'

let mockSettings: Record<string, unknown> = {}
let lastUpdate: { source: string; patch: Record<string, unknown> } | null = null

mock.module('src/utils/settings/settings.js', () => ({
  getInitialSettings: () => mockSettings,
  updateSettingsForSource: (source: string, patch: Record<string, unknown>) => {
    lastUpdate = { source, patch }
    mockSettings = { ...mockSettings, ...patch }
    return { error: null }
  },
}))

afterAll(() => {
  mock.restore()
  mock.module('src/utils/settings/settings.js', () => settingsModule)
})

const {
  buildCoreRulesProfileContent,
  DEFAULT_APPEND_TEMPLATE,
  DEFAULT_RULES_TEMPLATE,
  importCoreRulesProfile,
  isCoreRulesActive,
  CORE_RULES_PROFILE_NAME,
  resolveCoreRulesProfilePath,
} = (await import(
  '../coreRulesBridge.js'
)) as typeof import('../coreRulesBridge.js')

const {
  getActiveFollowProfileName,
  loadFollowPrompt,
  resetCoreRulesStateForTests,
  setActiveFollowProfileName,
} = (await import(
  '../coreRulesFollow.js'
)) as typeof import('../coreRulesFollow.js')

let tmpDir: string

function makeDirs(): FollowPromptDirs {
  return {
    userDir: join(tmpDir, 'follow-prompts'),
    projectDir: join(tmpDir, 'proj'),
  }
}

afterEach(() => {
  resetCoreRulesStateForTests()
  if (tmpDir) {
    rmSync(tmpDir, { recursive: true, force: true })
  }
})

describe('coreRulesBridge', () => {
  test('buildCoreRulesProfileContent combines rules + append templates', () => {
    const content = buildCoreRulesProfileContent()
    expect(content).toContain('# Core Rules')
    expect(content).toContain('小砂糖')
    expect(content).toContain('Master最忠诚的全能助手')
    expect(content).toContain('provide the requested prose directly')
  })

  test('importCoreRulesProfile writes profile file and activates it', () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'corerules-'))
    const dirs = makeDirs()
    const result = importCoreRulesProfile(dirs)
    expect('error' in result).toBe(false)
    if ('error' in result) return

    expect(result.path).toBe(resolveCoreRulesProfilePath(dirs))
    expect(existsSync(result.path)).toBe(true)
    expect(readFileSync(result.path, 'utf8')).toContain(
      DEFAULT_APPEND_TEMPLATE.trim(),
    )
    expect(readFileSync(result.path, 'utf8')).toContain(
      DEFAULT_RULES_TEMPLATE.trim(),
    )
    expect(getActiveFollowProfileName()).toBe(CORE_RULES_PROFILE_NAME)
    expect(isCoreRulesActive()).toBe(true)
  })

  test('re-import is idempotent and stays active', () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'corerules-'))
    const dirs = makeDirs()
    const first = importCoreRulesProfile(dirs)
    const second = importCoreRulesProfile(dirs)
    expect('error' in first).toBe(false)
    expect('error' in second).toBe(false)
    if ('error' in second) return
    expect(getActiveFollowProfileName()).toBe(CORE_RULES_PROFILE_NAME)
  })

  test('loadFollowPrompt resolves the imported profile', () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'corerules-'))
    const dirs = makeDirs()
    importCoreRulesProfile(dirs)
    const loaded = loadFollowPrompt(CORE_RULES_PROFILE_NAME, dirs)
    expect(loaded).not.toBeNull()
    expect(loaded?.name).toBe(CORE_RULES_PROFILE_NAME)
  })

  test('isCoreRulesActive is false after off (setActiveFollowProfileName(null))', () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'corerules-'))
    const dirs = makeDirs()
    importCoreRulesProfile(dirs)
    expect(isCoreRulesActive()).toBe(true)
    setActiveFollowProfileName(null)
    expect(isCoreRulesActive()).toBe(false)
  })
})
