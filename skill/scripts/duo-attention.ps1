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

# Diagnostics: one line per run in ~/.claude/duo/logs/attention-hook.log
# (kept under 64 KB), so a missing dot can be traced to the step that
# stopped. Never affects the hook's result.
$logFile = Join-Path $env:USERPROFILE '.claude\duo\logs\attention-hook.log'
function Write-HookLog([string]$Msg) {
  try {
    $dir = Split-Path $logFile
    if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    if ((Test-Path -LiteralPath $logFile) -and (Get-Item -LiteralPath $logFile).Length -gt 65536) { Remove-Item -LiteralPath $logFile -Force }
    Add-Content -LiteralPath $logFile -Value ("{0} state={1} tab={2} {3}" -f (Get-Date -Format s), $State, $env:DUO_TAB, $Msg)
  } catch { }
}

if (-not $env:DUO_SESSION -or -not $env:DUO_TAB) { Write-HookLog 'skipped: not in a Duo terminal'; exit 0 }
if ($State -notin @('set', 'clear', 'digest')) { exit 0 }

# The duo CLI: PATH first, then the install destination.
$duo = (Get-Command duo -ErrorAction SilentlyContinue | Select-Object -First 1).Source
if (-not $duo) { $duo = Join-Path $env:USERPROFILE '.local\bin\duo.cmd' }
if (-not (Test-Path -LiteralPath $duo)) { Write-HookLog "skipped: duo CLI not found at $duo"; exit 0 }

# ENH-268: Claude Code passes the hook a JSON payload on stdin that includes
# its session_id. Forwarding it keeps this tab's session binding current
# after /clear or /resume.
$sessionArgs = @()
try {
  if ([Console]::IsInputRedirected) {
    $payload = [Console]::In.ReadToEnd()
    if ($payload -match '"session_id"\s*:\s*"([0-9A-Za-z][0-9A-Za-z-]{7,63})"') { $sessionArgs = @('--session', $Matches[1]) }
  }
} catch { }

function Invoke-Digest([string[]]$Extra) {
  try { & $duo session digest $env:DUO_TAB @Extra *> $null } catch { }
}

switch ($State) {
  'set' {
    try { & $duo attention --tab $env:DUO_TAB --state set @sessionArgs *> $null; Write-HookLog "attention set exit=$LASTEXITCODE" } catch { Write-HookLog "attention set failed: $_" }
    Invoke-Digest @()
  }
  'clear' {
    try { & $duo attention --tab $env:DUO_TAB --state clear @sessionArgs *> $null; Write-HookLog "attention clear exit=$LASTEXITCODE" } catch { Write-HookLog "attention clear failed: $_" }
    Invoke-Digest @('--you-asked-only')
  }
  'digest' { Invoke-Digest @() }
}
exit 0
