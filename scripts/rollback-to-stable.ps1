param(
  [string]$TagName,
  [switch]$Force,
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  throw "git command is not available."
}

$resolvedTag = $TagName
if ([string]::IsNullOrWhiteSpace($resolvedTag)) {
  $stableTagFile = Join-Path $PSScriptRoot "..\.last-stable-tag"
  if (Test-Path $stableTagFile) {
    $resolvedTag = (Get-Content $stableTagFile -Raw).Trim()
  }
}

if ([string]::IsNullOrWhiteSpace($resolvedTag)) {
  throw "TagName is missing and .last-stable-tag does not exist."
}

$tagExists = git tag --list $resolvedTag
if (-not $tagExists -and -not $DryRun) {
  throw "Tag not found: $resolvedTag"
}

$switchArgs = @("switch", "--detach", $resolvedTag)
if ($Force) {
  $switchArgs = @("switch", "--detach", "--force", $resolvedTag)
}

if ($DryRun) {
  if (-not $tagExists) {
    Write-Host "DryRun: tag $resolvedTag does not exist yet (allowed in drill mode)."
  }
  Write-Host "DryRun: would rollback to $resolvedTag"
  Write-Host "DryRun: would run git $($switchArgs -join ' ')"
  exit 0
}

git @switchArgs
if ($LASTEXITCODE -ne 0) {
  throw "Rollback failed."
}

Write-Host "Switched to stable tag: $resolvedTag"
Write-Host "Tip: create a hotfix branch from this tag if needed."
