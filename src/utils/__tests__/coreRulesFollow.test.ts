import { mkdirSync, writeFileSync, utimesSync, rmSync } from 'fs'
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
  applyInstructionFollowToSystem,
  createFollowProfile,
  formatFollowSystemSection,
  formatFollowTailContent,
  getActiveFollowProfileName,
  isValidFollowProfileName,
  listFollowProfiles,
  loadFollowPrompt,
  resetInstructionFollowStateForTests,
  resolveFollowProfile,
  setActiveFollowProfileName,
} = (await import(
  '../instructionFollow.js'
)) as typeof import('../instructionFollow.js')

function makeDirs(): FollowPromptDirs & { root: string } {
  const root = mkdtempSync(join(tmpdir(), 'follow-prompts-'))
  const dirs: FollowPromptDirs = {
    userDir: join(root, 'user', 'follow-prompts'),
    projectDir: join(root, 'project', '.claude', 'follow-prompts'),
  }
  mkdirSync(dirs.userDir, { recursive: true })
  mkdirSync(dirs.projectDir, { recursive: true })
  return { ...dirs, root }
}

function writeProfile(dir: string, name: string, body: string): string {
  const filePath = join(dir, `${name}.md`)
  writeFileSync(filePath, body, 'utf8')
  return filePath
}

describe('instructionFollow', () => {
  afterEach(() => {
    resetInstructionFollowStateForTests()
    mockSettings = {}
    lastUpdate = null
  })

  test('rejects invalid profile names', () => {
    expect(isValidFollowProfileName('code')).toBe(true)
    expect(isValidFollowProfileName('role-play_1')).toBe(true)
    expect(isValidFollowProfileName('../etc')).toBe(false)
    expect(isValidFollowProfileName('has space')).toBe(false)
    expect(isValidFollowProfileName('')).toBe(false)
  })

  test('lists user profiles and lets project override the same name', () => {
    const dirs = makeDirs()
    writeProfile(dirs.userDir, 'code', 'user code rules')
    writeProfile(dirs.userDir, 'roleplay', 'user roleplay')
    writeProfile(dirs.projectDir, 'code', 'project code rules')

    const listed = listFollowProfiles(dirs)
    expect(listed.map(p => p.name)).toEqual(['code', 'roleplay'])
    expect(listed.find(p => p.name === 'code')?.source).toBe('project')
    expect(listed.find(p => p.name === 'roleplay')?.source).toBe('user')
    rmSync(dirs.root, { recursive: true, force: true })
  })

  test('loadFollowPrompt reads project file over user file', () => {
    const dirs = makeDirs()
    writeProfile(dirs.userDir, 'code', 'user code rules')
    writeProfile(dirs.projectDir, 'code', 'project code rules')

    const loaded = loadFollowPrompt('code', dirs)
    expect(loaded?.source).toBe('project')
    expect(loaded?.content).toBe('project code rules')
    rmSync(dirs.root, { recursive: true, force: true })
  })

  test('skips empty files', () => {
    const dirs = makeDirs()
    writeProfile(dirs.userDir, 'empty', '   \n')
    expect(loadFollowPrompt('empty', dirs)).toBeNull()
    rmSync(dirs.root, { recursive: true, force: true })
  })

  test('reloads content when the file mtime changes', () => {
    const dirs = makeDirs()
    const filePath = writeProfile(dirs.userDir, 'code', 'first')
    expect(loadFollowPrompt('code', dirs)?.content).toBe('first')
    writeFileSync(filePath, 'second', 'utf8')
    utimesSync(
      filePath,
      new Date(Date.now() + 2000),
      new Date(Date.now() + 2000),
    )
    expect(loadFollowPrompt('code', dirs)?.content).toBe('second')
    rmSync(dirs.root, { recursive: true, force: true })
  })

  test('createFollowProfile writes a scaffold under the user dir', () => {
    const dirs = makeDirs()
    const created = createFollowProfile('roleplay', dirs)
    expect('path' in created).toBe(true)
    if ('path' in created) {
      expect(created.path).toBe(join(dirs.userDir, 'roleplay.md'))
      const loaded = loadFollowPrompt('roleplay', dirs)
      expect(loaded?.content.includes('指令遵循：roleplay')).toBe(true)
    }
    const duplicate = createFollowProfile('roleplay', dirs)
    expect('error' in duplicate).toBe(true)
    rmSync(dirs.root, { recursive: true, force: true })
  })

  test('system section and tail use dedicated policy wrappers', () => {
    const profile = {
      name: 'code',
      path: '/tmp/code.md',
      source: 'user' as const,
      content: 'Always write tests first.',
    }
    const system = formatFollowSystemSection(profile)
    expect(system).toContain('# Sticky Instruction Follow (code)')
    expect(system).toContain('Always write tests first.')
    expect(system).not.toContain('may or may not be relevant')

    const tail = formatFollowTailContent(profile)
    expect(tail.startsWith('<instruction-follow name="code">')).toBe(true)
    expect(tail).toContain('Always write tests first.')
    expect(tail.endsWith('</instruction-follow>')).toBe(true)
  })

  test('applyInstructionFollowToSystem appends after existing blocks', () => {
    const profile = {
      name: 'code',
      path: '/tmp/code.md',
      source: 'user' as const,
      content: 'Keep diffs small.',
    }
    const result = applyInstructionFollowToSystem(['base prompt'], profile)
    expect(result[0]).toBe('base prompt')
    expect(result[1]).toContain('Keep diffs small.')
  })

  test('applyInstructionFollowToSystem is a no-op without a profile', () => {
    expect(applyInstructionFollowToSystem(['base'], null)).toEqual(['base'])
  })

  test('resolveFollowProfile returns null for missing names', () => {
    const dirs = makeDirs()
    expect(resolveFollowProfile('missing', dirs)).toBeNull()
    expect(resolveFollowProfile('../x', dirs)).toBeNull()
    rmSync(dirs.root, { recursive: true, force: true })
  })

  test('setActiveFollowProfileName persists and overrides in-session', () => {
    setActiveFollowProfileName('code')
    expect(getActiveFollowProfileName()).toBe('code')
    expect(lastUpdate?.source).toBe('userSettings')
    expect(lastUpdate?.patch.instructionFollowProfile).toBe('code')

    setActiveFollowProfileName(null)
    expect(getActiveFollowProfileName()).toBeNull()
    expect(lastUpdate?.patch.instructionFollowProfile).toBeUndefined()
  })
})
