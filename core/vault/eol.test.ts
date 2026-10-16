// Windows support: vault line-ending helpers.
import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { readText, toCrlf, toLf, usesCrlf, writeText } from './eol'

describe('vault line endings', () => {
  it('normalizes CRLF and lone CR to LF', () => {
    expect(toLf('---\r\ntype: person\r\n---\r\nbody')).toBe('---\ntype: person\n---\nbody')
    expect(toLf('a\rb')).toBe('a\nb')
    expect(toLf('plain\n')).toBe('plain\n')
  })

  it('detects CRLF from the first line break', () => {
    expect(usesCrlf('a\r\nb\n')).toBe(true)
    expect(usesCrlf('a\nb\r\n')).toBe(false)
    expect(usesCrlf('no breaks')).toBe(false)
  })

  it('converts to CRLF without doubling', () => {
    expect(toCrlf('a\nb\r\nc')).toBe('a\r\nb\r\nc')
  })

  it('keeps a CRLF file CRLF on rewrite, and writes new files with LF', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'duo-eol-'))
    const win = path.join(dir, 'win.md')
    fs.writeFileSync(win, '---\r\ntype: person\r\n---\r\nhi\r\n')
    const text = readText(win)
    expect(text).toBe('---\ntype: person\n---\nhi\n')
    writeText(win, text.replace('hi', 'hello'))
    expect(fs.readFileSync(win, 'utf8')).toBe('---\r\ntype: person\r\n---\r\nhello\r\n')

    const fresh = path.join(dir, 'new.md')
    writeText(fresh, 'a\nb\n')
    expect(fs.readFileSync(fresh, 'utf8')).toBe('a\nb\n')
    fs.rmSync(dir, { recursive: true, force: true })
  })
})
