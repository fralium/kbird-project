param(
  [string]$TagName,
  [string]$Message = "KBird stable release",
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  throw "git command is not available."
}

$resolvedTag = $TagName
if ([string]::IsNullOrWhiteSpace($resolvedTag)) {
  $resolvedTag = "stable-{0}" -f (Get-Date -Format "yyyyMMdd-HHmm")
}

$alreadyExists = (git tag --list $resolvedTag)
if ($alreadyExists) {
  throw "Tag '$resolvedTag' already exists."
}

if ($DryRun) {
  Write-Host "DryRun: would create tag $resolvedTag"
  Write-Host "DryRun: would write .last-stable-tag"
  Write-Host "DryRun: would run git tag -a $resolvedTag -m `"$Message`""
  exit 0
}

git tag -a $resolvedTag -m "$Message"
if ($LASTEXITCODE -ne 0) {
  throw "Failed to create tag."
}

$stableTagFile = Join-Path $PSScriptRoot "..\.last-stable-tag"
Set-Content -Path $stableTagFile -Value $resolvedTag -Encoding UTF8

Write-Host "Stable tag created: $resolvedTag"
Write-Host "Recorded in .last-stable-tag"
Write-Host "To push the tag run: git push origin $resolvedTag"
