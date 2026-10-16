# duo-open-file-guard, Windows version of duo-open-file-guard.sh (same
# behaviour; see that file for the full design notes). PreToolUse nudge,
# warn-only: when Edit/Write/MultiEdit targets a file that's open in Duo, it
# prints a short note to stderr pointing at the matching `duo` verb. It never
# blocks a tool call and exits 0 on every path. Registered in exec form, so
# Claude Code runs it through powershell.exe directly.

$ErrorActionPreference = 'SilentlyContinue'

# 1. Outside Duo: nothing to guard against.
if (-not $env:DUO_SESSION) { exit 0 }

# 2. The PreToolUse event arrives as JSON on stdin.
try {
  $evt = [Console]::In.ReadToEnd() | ConvertFrom-Json
  $target = [string]$evt.tool_input.file_path
} catch { exit 0 }
if (-not $target) { exit 0 }

# 3. Only the surfaces a duo verb can drive.
$ext = [IO.Path]::GetExtension($target).ToLowerInvariant()
$kinds = @{
  '.md' = 'md'; '.markdown' = 'md'
  '.html' = 'html'; '.htm' = 'html'
  '.json' = 'json'; '.yaml' = 'json'; '.yml' = 'json'; '.jsonl' = 'json'
}
$kind = $kinds[$ext]
if (-not $kind) { exit 0 }

# 4. Ask Duo what's open, bounded at 1.5 s so the hook can't hang. Run
#    through cmd.exe because duo.cmd is a batch launcher.
$duo = (Get-Command duo -ErrorAction SilentlyContinue | Select-Object -First 1).Source
if (-not $duo) { $duo = Join-Path $env:USERPROFILE '.local\bin\duo.cmd' }
if (-not (Test-Path -LiteralPath $duo)) { exit 0 }
try {
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = 'cmd.exe'
  $psi.Arguments = '/d /c ""' + $duo + '" status"'
  $psi.UseShellExecute = $false
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $true
  $psi.CreateNoWindow = $true
  $proc = [System.Diagnostics.Process]::Start($psi)
  $read = $proc.StandardOutput.ReadToEndAsync()
  $null = $proc.StandardError.ReadToEndAsync()  # drained so a full pipe can't stall it
  if (-not $proc.WaitForExit(1500)) { try { $proc.Kill() } catch { }; exit 0 }
  if ($proc.ExitCode -ne 0) { exit 0 }
  $status = $read.Result | ConvertFrom-Json
} catch { exit 0 }

# 5. Is the target open? Windows paths compare case-insensitively.
$open = if ($status.open) { $status.open } else { $status.tabs }
$hit = $false
foreach ($t in @($open)) {
  if ($t.path -and ([string]$t.path).Equals($target, [StringComparison]::OrdinalIgnoreCase)) { $hit = $true; break }
}
if (-not $hit) { exit 0 }

# 6. Open in Duo: print a kind-specific nudge to stderr. Proceed regardless.
switch ($kind) {
  'md' {
    [Console]::Error.WriteLine("Duo: '$target' is open in the markdown editor. Prefer a duo doc verb so your change lands in the live buffer and paints the change-highlight: 'duo doc edit <path> --find ""..."" --replace ""...""' for a surgical swap, or 'duo doc write --replace-all' (stdin) to rewrite the body. A direct Write can be clobbered by the editor's autosave and skips the highlight. Proceeding anyway.")
  }
  'html' {
    [Console]::Error.WriteLine("Duo: '$target' is open in the HTML canvas. Prefer the duo html verbs so element IDs and comment threads survive: 'duo html set --id <duo-id> --content ""...""' / 'duo html replace --id <duo-id> --html ""...""' / 'duo html append --parent <duo-id> --html ""...""' / 'duo html attr --id <duo-id> --set k=v'. A direct Write can be clobbered by autosave, drops data-duo-id anchors, and paints no change-highlight. Proceeding anyway.")
  }
  'json' {
    [Console]::Error.WriteLine("Duo: '$target' is open in the JSON/YAML view. Prefer a duo json verb so the edit goes through the live surface: 'duo json set <path> <dotpath> <value>' for a single key, or 'duo json merge <path> <file.json>' to deep-merge. A direct Write can be clobbered by the view's autosave and skips the change-highlight. Proceeding anyway.")
  }
}
exit 0
