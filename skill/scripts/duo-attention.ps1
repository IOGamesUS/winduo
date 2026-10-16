# duo-managed turn-boundary hook, Windows version of duo-attention.sh (same
# behaviour; see that file for the full design notes). Registered in
# ~/.claude/settings.json in exec form, so Claude Code runs it through
# powershell.exe directly (no Git Bash needed):
#   Stop, Notification -> duo-attention.ps1 set
#   UserPromptSubmit   -> duo-attention.ps1 clear
# Each arm flips this tab's "waiting on you" badge via `duo attention` and
# refreshes the session's catch-up digest via `duo session digest`, keyed on
# $env:DUO_TAB. A no-op outside Duo, and it never fails the hook: every path
# exits 0.

param([string]$State = '')

$ErrorActionPreference = 'SilentlyContinue'

if (-not $env:DUO_SESSION -or -not $env:DUO_TAB) { exit 0 }
if ($State -notin @('set', 'clear', 'digest')) { exit 0 }

# The duo CLI: PATH first, then the install destination.
$duo = (Get-Command duo -ErrorAction SilentlyContinue | Select-Object -First 1).Source
if (-not $duo) { $duo = Join-Path $env:USERPROFILE '.local\bin\duo.cmd' }
if (-not (Test-Path -LiteralPath $duo)) { exit 0 }

function Invoke-Digest([string[]]$Extra) {
  try { & $duo session digest $env:DUO_TAB @Extra *> $null } catch { }
}

switch ($State) {
  'set' {
    try { & $duo attention --tab $env:DUO_TAB --state set *> $null } catch { }
    Invoke-Digest @()
  }
  'clear' {
    try { & $duo attention --tab $env:DUO_TAB --state clear *> $null } catch { }
    Invoke-Digest @('--you-asked-only')
  }
  'digest' { Invoke-Digest @() }
}
exit 0
