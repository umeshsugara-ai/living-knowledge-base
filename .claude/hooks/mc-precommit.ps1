# maker-checker Layer 3 -- commit guard (WARN, never deny, never allow). Installed under D-006.
# Context-only output: plain text. Never emit "permissionDecision":"allow" (it would skip the
# permission prompt and auto-approve any payload containing 'git commit').
# Input: the hook JSON via -InputJson (same convention as the lab hooks); falls back to stdin.
param([string]$InputJson = "")
if ($env:CLAUDE_PROJECT_DIR) { Set-Location $env:CLAUDE_PROJECT_DIR }
$in = $InputJson
if ([string]::IsNullOrWhiteSpace($in)) { try { $in = [Console]::In.ReadToEnd() } catch { $in = "" } }
if ($in -match 'git\s+commit') {
  $u = 0
  if (Test-Path 'qa/manifests') {
    $u = (Get-ChildItem 'qa/manifests' -Filter *.md -ErrorAction SilentlyContinue | Select-String -Pattern 'Status: ready-for-check' -List | Measure-Object).Count
  }
  if ($u -gt 0) { Write-Output ("WARN maker-checker: $u unit(s) still awaiting /checker verdict. Commit should follow a PASS.") }
}
exit 0
