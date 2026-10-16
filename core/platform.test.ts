// Windows support: the platform defaults, checked for every OS from any OS.
import { describe, expect, it } from 'vitest'
import { defaultShell, duoDataDir, hasPosixProbes, pathDelimiter, pathKey, usesUnixSocket } from './platform'
import { isClaudeComm } from './claude-presence'
import { windowsClaudeDirs } from './resolve-claude'
import { shellEnter } from '../shared/shell-enter'

describe('duoDataDir', () => {
  it('keeps the macOS location', () => {
    expect(duoDataDir('darwin', {}, '/Users/ian')).toBe('/Users/ian/Library/Application Support/duo')
  })
  it('uses %APPDATA% on Windows', () => {
    expect(duoDataDir('win32', { APPDATA: 'C:\\Users\\ian\\AppData\\Roaming' }, 'C:\\Users\\ian'))
      .toBe('C:\\Users\\ian\\AppData\\Roaming\\duo')
  })
  it('falls back to the profile folder when APPDATA is unset', () => {
    expect(duoDataDir('win32', {}, 'C:\\Users\\ian')).toBe('C:\\Users\\ian\\AppData\\Roaming\\duo')
  })
  it('uses XDG_CONFIG_HOME or ~/.config on Linux', () => {
    expect(duoDataDir('linux', {}, '/home/ian')).toBe('/home/ian/.config/duo')
    expect(duoDataDir('linux', { XDG_CONFIG_HOME: '/cfg' }, '/home/ian')).toBe('/cfg/duo')
  })
})

describe('defaultShell', () => {
  it('honours DUO_SHELL everywhere', () => {
    expect(defaultShell('win32', { DUO_SHELL: 'pwsh.exe' })).toBe('pwsh.exe')
    expect(defaultShell('darwin', { DUO_SHELL: '/bin/bash', SHELL: '/bin/zsh' })).toBe('/bin/bash')
  })
  it('uses Windows PowerShell on Windows and $SHELL elsewhere', () => {
    expect(defaultShell('win32', {})).toBe('powershell.exe')
    expect(defaultShell('darwin', { SHELL: '/bin/bash' })).toBe('/bin/bash')
    expect(defaultShell('darwin', {})).toBe('/bin/zsh')
  })
})

describe('PATH handling', () => {
  it('splits on ; on Windows and : elsewhere', () => {
    expect(pathDelimiter('win32')).toBe(';')
    expect(pathDelimiter('darwin')).toBe(':')
  })
  it("reuses Windows' existing Path key instead of adding a second one", () => {
    expect(pathKey({ Path: 'C:\\x' }, 'win32')).toBe('Path')
    expect(pathKey({}, 'win32')).toBe('Path')
    expect(pathKey({ Path: 'x' }, 'darwin')).toBe('PATH')
  })
})

describe('feature switches', () => {
  it('has no Unix socket or POSIX probes on Windows', () => {
    expect(usesUnixSocket('win32')).toBe(false)
    expect(hasPosixProbes('win32')).toBe(false)
    expect(usesUnixSocket('darwin')).toBe(true)
    expect(hasPosixProbes('darwin')).toBe(true)
  })
})

describe('isClaudeComm', () => {
  it('matches claude on every platform and nothing else', () => {
    expect(isClaudeComm('claude')).toBe(true)
    expect(isClaudeComm('/Users/ian/.local/bin/claude')).toBe(true)
    expect(isClaudeComm('claude.exe')).toBe(true)
    expect(isClaudeComm('C:\\Users\\ian\\.local\\bin\\Claude.EXE')).toBe(true)
    expect(isClaudeComm('claude-helper')).toBe(false)
    expect(isClaudeComm('Code Helper.exe')).toBe(false)
  })
})

describe('windowsClaudeDirs', () => {
  it('lists the native, npm and WinGet install folders', () => {
    expect(windowsClaudeDirs({ APPDATA: 'C:\\A', LOCALAPPDATA: 'C:\\L' }, 'C:\\Users\\ian')).toEqual([
      'C:\\Users\\ian\\.local\\bin',
      'C:\\A\\npm',
      'C:\\L\\Microsoft\\WinGet\\Links'
    ])
  })
})

describe('shellEnter', () => {
  it('runs a typed command with \\r on Windows and \\n elsewhere', () => {
    expect(shellEnter('win32')).toBe('\r')
    expect(shellEnter('darwin')).toBe('\n')
    expect(shellEnter(undefined)).toBe('\n')
  })
})
