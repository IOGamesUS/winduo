// Windows support: the key that runs a command typed into a terminal's shell.
// macOS and Linux shells take `\n`. On Windows, ConPTY turns `\n` into
// Ctrl+Enter, which PowerShell's line editor treats as "insert a line" rather
// than "run", so commands Duo types (`claude`, `claude --resume <id>`) need
// `\r` there instead.
export function shellEnter(platform: string | undefined): '\r' | '\n' {
  return platform === 'win32' ? '\r' : '\n'
}
