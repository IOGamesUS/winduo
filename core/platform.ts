// Windows support: the platform-specific defaults in one place, so the rest
// of the code asks this module instead of assuming macOS. Pure functions of
// (platform, env, home) so every branch is testable on any OS; the exported
// constants apply them to the running process.

import { homedir } from 'os'
import * as path from 'path'

export type Platform = NodeJS.Platform

export const IS_WINDOWS = process.platform === 'win32'
export const IS_MAC = process.platform === 'darwin'

/** Where Duo keeps its own app state (the socket, the port file, the browser
 *  session). macOS: ~/Library/Application Support/duo (unchanged). Windows:
 *  %APPDATA%\duo. Linux: $XDG_CONFIG_HOME/duo, else ~/.config/duo. */
export function duoDataDir(
  platform: Platform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
  home: string = homedir()
): string {
  if (platform === 'win32') {
    const appData = env.APPDATA ?? path.win32.join(home, 'AppData', 'Roaming')
    return path.win32.join(appData, 'duo')
  }
  if (platform === 'darwin') return path.posix.join(home, 'Library', 'Application Support', 'duo')
  const config = env.XDG_CONFIG_HOME ?? path.posix.join(home, '.config')
  return path.posix.join(config, 'duo')
}

/** Whether the app listens on a Unix socket at all. On Windows it doesn't:
 *  the CLI uses the localhost TCP transport, which already exists as the
 *  sandbox fallback and requires the per-launch token, so there is no
 *  question of who else on the machine can open a named pipe. */
export function usesUnixSocket(platform: Platform = process.platform): boolean {
  return platform !== 'win32'
}

/** The shell a new terminal starts. DUO_SHELL overrides everywhere. Windows:
 *  Windows PowerShell, which every supported Windows version has (Claude
 *  Code runs from PowerShell, CMD or Git Bash). Elsewhere: $SHELL, else zsh. */
export function defaultShell(
  platform: Platform = process.platform,
  env: NodeJS.ProcessEnv = process.env
): string {
  if (env.DUO_SHELL) return env.DUO_SHELL
  if (platform === 'win32') return 'powershell.exe'
  return env.SHELL ?? '/bin/zsh'
}

/** The separator between PATH entries. */
export function pathDelimiter(platform: Platform = process.platform): string {
  return platform === 'win32' ? ';' : ':'
}

/** The name the environment uses for PATH. Windows keys are case-insensitive
 *  and usually spelled `Path`; writing a second `PATH` key beside it gives
 *  the child two conflicting values, so reuse whatever key is there. */
export function pathKey(env: Record<string, string | undefined>, platform: Platform = process.platform): string {
  if (platform !== 'win32') return 'PATH'
  return Object.keys(env).find((k) => k.toUpperCase() === 'PATH') ?? 'Path'
}

/** Whether the macOS-only helpers are available: the `ps`/`lsof` session
 *  probes, the shell-script PATH shim for `claude`, and `sips` image
 *  conversion. Callers skip those features where this is false. */
export function hasPosixProbes(platform: Platform = process.platform): boolean {
  return platform !== 'win32'
}
