// Winduo: the pane layout for this window. 'side' is Duo's original layout
// (terminal | editor/browser); 'stacked' puts the editor/browser pane above
// the terminal, as in VS Code. Remembered per window in localStorage and
// reported to main so View > Stack Editor Above Terminal and
// `duo pane-layout` show the current value; both can also set it.

import { useEffect, useState } from 'react'
import type { PaneLayout } from '../../shared/types'

function storageKey(): string {
  const id = window.electron?.env?.windowId
  return typeof id === 'number' && id > 0 ? `duo:pane-layout:w${id}` : 'duo:pane-layout'
}

function readPersisted(): PaneLayout {
  try {
    const raw = window.localStorage.getItem(storageKey()) ?? window.localStorage.getItem('duo:pane-layout')
    return raw === 'stacked' ? 'stacked' : 'side'
  } catch {
    return 'side'
  }
}

function writePersisted(mode: PaneLayout): void {
  try {
    window.localStorage.setItem(storageKey(), mode)
    window.localStorage.setItem('duo:pane-layout', mode) // the default for new windows
  } catch { /* best-effort */ }
}

export function usePaneLayout(): { paneLayout: PaneLayout; setPaneLayout: (mode: PaneLayout) => void } {
  const [paneLayout, setState] = useState<PaneLayout>(readPersisted)

  // Report the current value to main (boot and every change).
  useEffect(() => {
    window.electron.layout?.pushPaneLayout?.(paneLayout)
  }, [paneLayout])

  // Menu / CLI changes.
  useEffect(() => {
    return window.electron.layout?.onPaneLayoutSet?.((mode) => {
      setState(mode)
      writePersisted(mode)
    })
  }, [])

  const setPaneLayout = (mode: PaneLayout): void => {
    setState(mode)
    writePersisted(mode)
  }
  return { paneLayout, setPaneLayout }
}
