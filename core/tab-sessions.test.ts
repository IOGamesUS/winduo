// ENH-268 (Winduo): tab-to-session bindings.
import { describe, it, expect } from 'vitest'
import { TabSessionRegistry, isSessionId, sessionIdFromHookPayload } from './tab-sessions'

const A = '75b057bd-07fd-4a08-a633-671e94587dd5'
const B = '0b1c2d3e-4f50-4617-8293-a4b5c6d7e8f9'

describe('TabSessionRegistry', () => {
  it('binds, reads and forgets', () => {
    const r = new TabSessionRegistry()
    expect(r.bind('tab-1', A, 'launch', 100)).toBe(true)
    expect(r.get('tab-1')).toEqual({ sessionId: A, source: 'launch', boundAt: 100 })
    expect(r.tabFor(A)).toBe('tab-1')
    r.forget('tab-1')
    expect(r.get('tab-1')).toBeUndefined()
    expect(r.tabFor(A)).toBeUndefined()
  })

  it('a hook rebinds the tab after /clear or /resume', () => {
    const r = new TabSessionRegistry()
    r.bind('tab-1', A, 'launch', 100)
    r.bind('tab-1', B, 'hook', 200)
    expect(r.get('tab-1')?.sessionId).toBe(B)
    expect(r.tabFor(A)).toBeUndefined()
    expect(r.tabFor(B)).toBe('tab-1')
  })

  it('prefers the most recent tab if two claim one session', () => {
    const r = new TabSessionRegistry()
    r.bind('tab-1', A, 'launch', 100)
    r.bind('tab-2', A, 'hook', 300)
    expect(r.tabFor(A)).toBe('tab-2')
  })

  it('rejects ids that are not session-shaped', () => {
    const r = new TabSessionRegistry()
    expect(r.bind('tab-1', '', 'hook')).toBe(false)
    expect(r.bind('tab-1', '../etc/passwd', 'hook')).toBe(false)
    expect(r.bind('', A, 'hook')).toBe(false)
    expect(r.get('tab-1')).toBeUndefined()
    expect(isSessionId(A)).toBe(true)
  })
})

describe('sessionIdFromHookPayload', () => {
  it('reads session_id from a hook payload', () => {
    expect(sessionIdFromHookPayload(JSON.stringify({ session_id: A, hook_event_name: 'Stop' }))).toBe(A)
  })
  it('falls back to a regex on a truncated payload', () => {
    expect(sessionIdFromHookPayload(`{"session_id": "${A}", "transcript_path": "C:\\\\x`)).toBe(A)
  })
  it('returns null when absent or malformed', () => {
    expect(sessionIdFromHookPayload('{}')).toBeNull()
    expect(sessionIdFromHookPayload('not json')).toBeNull()
    expect(sessionIdFromHookPayload(JSON.stringify({ session_id: 'bad id!' }))).toBeNull()
  })
})
