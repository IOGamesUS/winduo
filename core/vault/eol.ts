// Windows support: line endings for vault files.
//
// Every parser in core/vault assumes `\n` line breaks (frontmatter fences,
// line splits). Notes saved by Windows editors, or checked out by git with
// core.autocrlf, use `\r\n`, so the parsers saw no frontmatter at all. The
// vault therefore reads every file through readText(), which hands the
// parsers `\n` text, and writes through writeText(), which puts `\r\n` back
// when the file on disk already used it. A user's files keep the line
// endings they had; new files are written with `\n`.

import * as fs from 'fs'

/** `\r\n` (and lone `\r`) to `\n`. */
export function toLf(text: string): string {
  return text.indexOf('\r') === -1 ? text : text.replace(/\r\n?/g, '\n')
}

/** Whether text uses Windows line endings (its first line break is `\r\n`). */
export function usesCrlf(text: string): boolean {
  const i = text.indexOf('\n')
  return i > 0 && text[i - 1] === '\r'
}

/** `\n` to `\r\n`, without doubling any `\r\n` already there. */
export function toCrlf(text: string): string {
  return toLf(text).replace(/\n/g, '\r\n')
}

/** Read a vault file as UTF-8 with `\n` line endings. */
export function readText(abs: string): string {
  return toLf(fs.readFileSync(abs, 'utf8'))
}

/** Async readText. */
export async function readTextAsync(abs: string): Promise<string> {
  return toLf(await fs.promises.readFile(abs, 'utf8'))
}

/** Write a vault file, keeping `\r\n` line endings if the existing file on
 *  disk uses them. `text` is `\n` text, as the vault's code produces. */
export function writeText(abs: string, text: string): void {
  let crlf = false
  try {
    const fd = fs.openSync(abs, 'r')
    try {
      const buf = Buffer.alloc(4096)
      const n = fs.readSync(fd, buf, 0, buf.length, 0)
      crlf = usesCrlf(buf.subarray(0, n).toString('utf8'))
    } finally {
      fs.closeSync(fd)
    }
  } catch {
    // New file: write `\n`.
  }
  fs.writeFileSync(abs, crlf ? toCrlf(text) : text)
}
