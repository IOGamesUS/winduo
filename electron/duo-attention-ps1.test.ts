// Windows support: behavior test for skill/scripts/duo-attention.ps1, the
// Windows twin of duo-attention.sh. Runs the real script through
// powershell.exe (as Claude Code runs it, exec form) with a fake duo.cmd on
// PATH that records its args, and checks each arm. Windows only; on macOS and
// Linux duo-attention-hook.test.ts covers the .sh script.

import { describe, it, expect } from 'vitest'
import { execFileSync } from 'child_process'
import * as os from 'os'
import * as fs from 'fs'
import * as path from 'path'

const SCRIPT = path.resolve(__dirname, '../skill/scripts/duo-attention.ps1')

function runHook(state: string, opts: { env?: Record<string, string>; failOn?: string; input?: string } = {}): { calls: string[]; threw: boolean } {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'duo-hook-ps1-'))
  const bin = path.join(tmp, 'bin')
  fs.mkdirSync(bin)
  const log = path.join(tmp, 'calls.log')
  const fake = [
    '@echo off',
    `>> "${log}" echo %*`,
    opts.failOn ? `if "%1"=="${opts.failOn}" exit /b 1` : '',
    'exit /b 0',
    ''
  ].join('\r\n')
  fs.writeFileSync(path.join(bin, 'duo.cmd'), fake)

  const env: Record<string, string> = {}
  for (const [k, v] of Object.entries(process.env)) if (v !== undefined && k.toUpperCase() !== 'PATH') env[k] = v
  const pathKey = Object.keys(process.env).find((k) => k.toUpperCase() === 'PATH') ?? 'Path'
  Object.assign(env, {
    [pathKey]: `${bin};${process.env[pathKey] ?? ''}`,
    USERPROFILE: tmp, // no real ~/.local/bin/duo.cmd fallback can interfere
    DUO_SESSION: '1',
    DUO_TAB: 'tab-7',
    ...opts.env
  })

  let threw = false
  try {
    execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', SCRIPT, state], {
      env,
      stdio: 'pipe',
      input: opts.input ?? '',
      windowsHide: true
    })
  } catch {
    threw = true
  }
  const calls = fs.existsSync(log)
    ? fs.readFileSync(log, 'utf8').split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    : []
  fs.rmSync(tmp, { recursive: true, force: true })
  return { calls, threw }
}

describe.skipIf(process.platform !== 'win32')('duo-attention.ps1 (Windows turn-boundary hook)', () => {
  it('set flips the badge and writes the full digest', () => {
    const { calls, threw } = runHook('set')
    expect(threw).toBe(false)
    expect(calls).toContain('attention --tab tab-7 --state set')
    expect(calls).toContain('session digest tab-7')
  })

  it('clear clears the badge and refreshes only "You asked"', () => {
    const { calls, threw } = runHook('clear')
    expect(threw).toBe(false)
    expect(calls).toContain('attention --tab tab-7 --state clear')
    expect(calls).toContain('session digest tab-7 --you-asked-only')
  })

  it('a failing digest still exits 0 and the badge still fires', () => {
    const { calls, threw } = runHook('set', { failOn: 'session' })
    expect(threw).toBe(false)
    expect(calls).toContain('attention --tab tab-7 --state set')
  })

  it('forwards the session_id from the hook payload (ENH-268)', () => {
    const id = '75b057bd-07fd-4a08-a633-671e94587dd5'
    const { calls } = runHook('set', { input: JSON.stringify({ session_id: id, hook_event_name: 'Stop' }) })
    expect(calls).toContain(`attention --tab tab-7 --state set --session ${id}`)
  })

  it('no DUO_TAB or an unknown arg does nothing', () => {
    expect(runHook('set', { env: { DUO_TAB: '' } }).calls).toEqual([])
    expect(runHook('bogus').calls).toEqual([])
  })
}, 60_000)
