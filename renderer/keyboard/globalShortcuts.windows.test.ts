// Windows support: the Mac shortcut table mapped to Windows keys.
// Ctrl plays Cmd's part; in a terminal, plain Ctrl+letter goes to the shell
// and app shortcuts use Ctrl+Shift.
import { describe, it, expect } from 'vitest'
import { matchGlobalShortcut, windowsClipboardAction, type ShortcutKeyEvent } from './globalShortcuts'

function key(k: string, code: string, mods: Partial<ShortcutKeyEvent> = {}): ShortcutKeyEvent {
  return { key: k, code, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, ...mods }
}
const WIN = { inEditableSurface: false, platform: 'win32' }
const WIN_TERM = { ...WIN, inTerminal: true }
const id = (e: ShortcutKeyEvent, ctx: object) => matchGlobalShortcut(e, ctx as never)?.id ?? null

describe('Windows shortcuts outside the terminal', () => {
  it('Ctrl acts as Cmd', () => {
    expect(id(key('t', 'KeyT', { ctrlKey: true }), WIN)).toBe('newBrowserTab')
    expect(id(key('T', 'KeyT', { ctrlKey: true, shiftKey: true }), WIN)).toBe('newClaudeTab')
    expect(id(key('w', 'KeyW', { ctrlKey: true }), WIN)).toBe('closeTab')
  })
  it('the Windows key is not a Duo modifier', () => {
    expect(id(key('t', 'KeyT', { metaKey: true }), WIN)).toBeNull()
  })
  it('Ctrl+Tab still cycles tabs', () => {
    expect(id(key('Tab', 'Tab', { ctrlKey: true }), WIN)).toBe('cycleTabsForward')
    expect(id(key('Tab', 'Tab', { ctrlKey: true, shiftKey: true }), WIN)).toBe('cycleTabsBackward')
  })
})

describe('Windows shortcuts in the terminal', () => {
  it('plain Ctrl+letter goes to the shell', () => {
    for (const [k, code] of [['t', 'KeyT'], ['w', 'KeyW'], ['r', 'KeyR'], ['c', 'KeyC'], ['n', 'KeyN']]) {
      expect(id(key(k, code, { ctrlKey: true }), WIN_TERM)).toBeNull()
    }
  })
  it('Ctrl+Shift+letter reaches the app', () => {
    expect(id(key('T', 'KeyT', { ctrlKey: true, shiftKey: true }), WIN_TERM)).toBe('newClaudeTab')
    expect(id(key('W', 'KeyW', { ctrlKey: true, shiftKey: true }), WIN_TERM)).toBe('closeTab')
  })
  it('digits, text size and Ctrl+Tab stay app shortcuts', () => {
    expect(matchGlobalShortcut(key('2', 'Digit2', { ctrlKey: true }), WIN_TERM as never)).toEqual({ id: 'jumpTerminalTab', arg: 2 })
    expect(id(key('=', 'Equal', { ctrlKey: true }), WIN_TERM)).toBe('fontBumpUp')
    expect(id(key('Tab', 'Tab', { ctrlKey: true }), WIN_TERM)).toBe('cycleTabsForward')
  })
})

describe('Mac behavior is unchanged', () => {
  it('still uses Cmd', () => {
    const MAC = { inEditableSurface: false, platform: 'darwin' }
    expect(id(key('t', 'KeyT', { metaKey: true }), MAC)).toBe('newBrowserTab')
    expect(id(key('t', 'KeyT', { ctrlKey: true }), MAC)).toBeNull()
    expect(id(key('w', 'KeyW', { metaKey: true }), { ...MAC, inTerminal: true })).toBe('closeTab')
  })
})

describe('windowsClipboardAction', () => {
  it('Ctrl+C copies only with a selection; Ctrl+Shift+C always copies', () => {
    expect(windowsClipboardAction(key('c', 'KeyC', { ctrlKey: true }), true, 'win32')).toBe('copy')
    expect(windowsClipboardAction(key('c', 'KeyC', { ctrlKey: true }), false, 'win32')).toBeNull()
    expect(windowsClipboardAction(key('C', 'KeyC', { ctrlKey: true, shiftKey: true }), false, 'win32')).toBe('copy')
  })
  it('Ctrl+V and Ctrl+Shift+V paste', () => {
    expect(windowsClipboardAction(key('v', 'KeyV', { ctrlKey: true }), false, 'win32')).toBe('paste')
    expect(windowsClipboardAction(key('V', 'KeyV', { ctrlKey: true, shiftKey: true }), false, 'win32')).toBe('paste')
  })
  it('does nothing on macOS', () => {
    expect(windowsClipboardAction(key('c', 'KeyC', { ctrlKey: true }), true, 'darwin')).toBeNull()
  })
})
