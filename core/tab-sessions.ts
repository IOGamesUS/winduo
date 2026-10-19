// ENH-268 (Winduo): which Claude session each Duo terminal tab is running.
//
// Duo used to infer this: the newest transcript in the tab's folder, matched
// to running `claude` processes by their working directory. That guesses
// wrong with two sessions in one folder, after /clear or /resume (Claude
// switches session inside the same process), and on Windows, where another
// process's working directory can't be read at all.
//
// Now the binding is recorded from evidence:
//   - 'launch': Duo started Claude in the tab with `--session-id <id>`;
//   - 'hook':   a Duo-managed Claude Code hook in the tab reported the
//               `session_id` Claude Code passed it (fires on every prompt and
//               every stop, so /clear and /resume rebind on the next turn).
// In memory only, like the PTYs it describes (the persisted pointer remains
// the tab's lastClaudeSession, which reads from here first).

export type TabSessionSource = 'launch' | 'hook'

export interface TabSessionBinding {
  sessionId: string
  source: TabSessionSource
  boundAt: number
}

const SESSION_ID = /^[0-9A-Za-z][0-9A-Za-z-]{7,63}$/

/** Whether a string looks like a Claude Code session id (a UUID in
 *  practice; kept loose so a future id format doesn't silently drop). */
export function isSessionId(s: unknown): s is string {
  return typeof s === 'string' && SESSION_ID.test(s)
}

export class TabSessionRegistry {
  private byTab = new Map<string, TabSessionBinding>()

  /** Record that `tabId` runs `sessionId`. Returns false (and changes
   *  nothing) for an id that isn't session-shaped. */
  bind(tabId: string, sessionId: string, source: TabSessionSource, now: number = Date.now()): boolean {
    if (!tabId || !isSessionId(sessionId)) return false
    this.byTab.set(tabId, { sessionId, source, boundAt: now })
    return true
  }

  get(tabId: string): TabSessionBinding | undefined {
    return this.byTab.get(tabId)
  }

  /** The tab currently bound to `sessionId`, most recently bound first if
   *  (unusually) two tabs claim it. */
  tabFor(sessionId: string): string | undefined {
    let best: { tabId: string; at: number } | undefined
    for (const [tabId, b] of this.byTab) {
      if (b.sessionId === sessionId && (!best || b.boundAt > best.at)) best = { tabId, at: b.boundAt }
    }
    return best?.tabId
  }

  forget(tabId: string): void {
    this.byTab.delete(tabId)
  }
}

/** Pull Claude Code's `session_id` out of a hook payload (the JSON a hook
 *  receives on stdin), or null. */
export function sessionIdFromHookPayload(payload: string): string | null {
  try {
    const v = (JSON.parse(payload) as { session_id?: unknown }).session_id
    return isSessionId(v) ? v : null
  } catch {
    const m = /"session_id"\s*:\s*"([0-9A-Za-z-]+)"/.exec(payload)
    return m && isSessionId(m[1]) ? m[1] : null
  }
}
