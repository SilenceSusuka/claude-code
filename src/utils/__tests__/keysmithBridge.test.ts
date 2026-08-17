import { existsSync, readFileSync, rmSync } from 'fs'
import { mkdtempSync } from 'fs'
import { afterAll, afterEach, describe, expect, mock, test } from 'bun:test'
import { join } from 'path'
import { tmpdir } from 'os'
import * as settingsModule from '../settings/settings.js'
import type { FollowPromptDirs } from '../instructionFollow.js'

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
  buildKeysmithProfileContent,
  DEFAULT_APPEND_TEMPLATE,
  DEFAULT_RULES_TEMPLATE,
  importKeysmithProfile,
  isKeysmithActive,
  KEYSMITH_PROFILE_NAME,
  resolveKeysmithProfilePath,
} = (await import(
  '../keysmithBridge.js'
)) as typeof import('../keysmithBridge.js')

const {
  getActiveFollowProfileName,
  loadFollowPrompt,
  resetInstructionFollowStateForTests,
  setActiveFollowProfileName,
} = (await import(
  '../instructionFollow.js'
)) as typeof import('../instructionFollow.js')

let tmpDir: string

function makeDirs(): FollowPromptDirs {
  return {
    userDir: join(tmpDir, 'follow-prompts'),
    projectDir: join(tmpDir, 'proj'),
  }
}

afterEach(() => {
  resetInstructionFollowStateForTests()
  if (tmpDir) {
    rmSync(tmpDir, { recursive: true, force: true })
  }
})

describe('keysmithBridge', () => {
  test('buildKeysmithProfileContent combines rules + append templates', () => {
    const content = buildKeysmithProfileContent()
    expect(content).toContain('# 指令遵循：keysmith')
    expect(content).toContain('Research Engineering Assistant')
    expect(content).toContain('provide the requested prose directly')
  })

  test('importKeysmithProfile writes profile file and activates it', () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'keysmith-'))
    const dirs = makeDirs()
    const result = importKeysmithProfile(dirs)
    expect('error' in result).toBe(false)
    if ('error' in result) return

    expect(result.path).toBe(resolveKeysmithProfilePath(dirs))
    expect(existsSync(result.path)).toBe(true)
    expect(readFileSync(result.path, 'utf8')).toContain(
      DEFAULT_APPEND_TEMPLATE.trim(),
    )
    expect(readFileSync(result.path, 'utf8')).toContain(
      DEFAULT_RULES_TEMPLATE.trim(),
    )
    expect(getActiveFollowProfileName()).toBe(KEYSMITH_PROFILE_NAME)
    expect(isKeysmithActive()).toBe(true)
  })

  test('re-import is idempotent and stays active', () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'keysmith-'))
    const dirs = makeDirs()
    const first = importKeysmithProfile(dirs)
    const second = importKeysmithProfile(dirs)
    expect('error' in first).toBe(false)
    expect('error' in second).toBe(false)
    if ('error' in second) return
    expect(getActiveFollowProfileName()).toBe(KEYSMITH_PROFILE_NAME)
  })

  test('loadFollowPrompt resolves the imported profile', () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'keysmith-'))
    const dirs = makeDirs()
    importKeysmithProfile(dirs)
    const loaded = loadFollowPrompt(KEYSMITH_PROFILE_NAME, dirs)
    expect(loaded).not.toBeNull()
    expect(loaded?.name).toBe(KEYSMITH_PROFILE_NAME)
  })

  test('isKeysmithActive is false after off (setActiveFollowProfileName(null))', () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'keysmith-'))
    const dirs = makeDirs()
    importKeysmithProfile(dirs)
    expect(isKeysmithActive()).toBe(true)
    setActiveFollowProfileName(null)
    expect(isKeysmithActive()).toBe(false)
  })
})
