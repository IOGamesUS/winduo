// ENH-231 (+ENH-225) — behavior test for the managed turn-boundary hook
// `skill/scripts/duo-attention.sh`. Runs the REAL script under /bin/sh with a
// fake `duo` on PATH that records its args, and asserts each arm fires the
// right CLI calls. The merge/registration (no duplicate Stop entry) is covered
// separately in install-service.test.ts → planManagedHooksMerge.

import { describe, it, expect } from 'vitest'
import { execFileSync } from 'child_process'
import * as os from 'os'
import * as fs from 'fs'
import * as path from 'path'

const SCRIPT = path.resolve(__dirname, '../skill/scripts/duo-attention.sh')

interface RunResult {
  calls: string[]
  threw: boolean
}

/**
 * Run the hook with `state` as $1, against a fake `duo` that appends each call's
 * args to a log. `failOn` (matched against the call's FIRST arg, e.g. `session`)
 * makes the fake exit non-zero for that subcommand — used to prove the badge
 * still fires when the digest call fails. Returns the recorded arg-lines + a
 * `threw` flag (the hook must always exit 0).
 */
function runHook(
  state: string,
  opts: { env?: Record<string, string>; failOn?: string; input?: string } = {},
): RunResult {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'duo-hook-'))
  const bin = path.join(tmp, 'bin')
  fs.mkdirSync(bin)
  const log = path.join(tmp, 'calls.log')
  const failOn = opts.failOn ?? ''
  const fake = `#!/bin/sh
echo "$@" >> "${log}"
if [ -n "${failOn}" ] && [ "$1" = "${failOn}" ]; then exit 1; fi
exit 0
`
  fs.writeFileSync(path.join(bin, 'duo'), fake, { mode: 0o755 })

  let threw = false
  try {
    execFileSync('/bin/sh', [SCRIPT, state], {
      env: {
        PATH: `${bin}:${process.env.PATH ?? ''}`,
        HOME: tmp, // no real ~/.local/bin/duo fallback can interfere
        DUO_SESSION: '1',
        DUO_TAB: 'tab-7',
        ...opts.env,
      },
      stdio: 'pipe',
      input: opts.input ?? '',
    })
  } catch {
    threw = true // non-zero exit — a regression: the hook must never fail
  }

  const calls = fs.existsSync(log)
    ? fs.readFileSync(log, 'utf8').trim().split('\n').filter(Boolean)
    : []
  fs.rmSync(tmp, { recursive: true, force: true })
  return { calls, threw }
}

// Windows support: this exercises the /bin/sh script; Windows runs the .ps1
// twin instead (duo-attention-ps1.test.ts).
describe.skipIf(process.platform === 'win32')('duo-attention.sh (turn-boundary hook: badge + ENH-231 digest)', () => {
  it('set → flips the badge AND materializes the full digest', () => {
    const { calls, threw } = runHook('set')
    expect(threw).toBe(false)
    expect(calls).toContain('attention --tab tab-7 --state set')
    expect(calls).toContain('session digest tab-7')
  })

  it('clear → clears the badge AND refreshes only "You asked"', () => {
    const { calls, threw } = runHook('clear')
    expect(threw).toBe(false)
    expect(calls).toContain('attention --tab tab-7 --state clear')
    expect(calls).toContain('session digest tab-7 --you-asked-only')
  })

  it('digest → digest only, no badge call (standalone/manual arm)', () => {
    const { calls } = runHook('digest')
    expect(calls).toContain('session digest tab-7')
    expect(calls.some((c) => c.startsWith('attention'))).toBe(false)
  })

  it('a failing digest does NOT abort the badge (|| true guard, exit 0)', () => {
    const { calls, threw } = runHook('set', { failOn: 'session' })
    expect(threw).toBe(false) // hook still exits 0
    expect(calls).toContain('attention --tab tab-7 --state set') // badge fired
    expect(calls).toContain('session digest tab-7') // attempted, then swallowed
  })

  it('forwards the session_id from the hook payload (ENH-268)', () => {
    const id = '75b057bd-07fd-4a08-a633-671e94587dd5'
    const { calls } = runHook('set', { input: JSON.stringify({ session_id: id, hook_event_name: 'Stop' }) })
    expect(calls).toContain(`attention --tab tab-7 --state set --session ${id}`)
    const cleared = runHook('clear', { input: `{"session_id":"${id}"}` })
    expect(cleared.calls).toContain(`attention --tab tab-7 --state clear --session ${id}`)
  })

  it('no DUO_TAB → no-op (fires nothing)', () => {
    const { calls, threw } = runHook('set', { env: { DUO_TAB: '' } })
    expect(threw).toBe(false)
    expect(calls).toEqual([])
  })

  it('unknown arg → no-op', () => {
    const { calls, threw } = runHook('bogus')
    expect(threw).toBe(false)
    expect(calls).toEqual([])
  })
})
