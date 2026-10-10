# Build a real KBird launcher .exe (with logo) onto the Desktop.
# Usage: .\scripts\windows\create-desktop-shortcut.ps1
# Optional: -Name "Kbird" -Target "Desktop"|"Prod"

param(
  [string]$Name = 'Kbird',
  [ValidateSet('Desktop', 'Prod')]
  [string]$Target = 'Desktop'
)

$ErrorActionPreference = 'Stop'

$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$LogoPng = Join-Path $ProjectRoot 'public\logo-wetland.png'
$IconIco = Join-Path $ProjectRoot 'assets\kbird-launcher.ico'
$TemplateCs = Join-Path $PSScriptRoot 'KBirdLauncher.cs'
$BatName = if ($Target -eq 'Prod') { 'KBird-Desktop-Prod.bat' } else { 'KBird-Desktop.bat' }
$TargetBat = Join-Path $ProjectRoot $BatName
$Csc = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (-not (Test-Path -LiteralPath $Csc)) {
  $Csc = Join-Path $env:WINDIR 'Microsoft.NET\Framework\v4.0.30319\csc.exe'
}

if (-not (Test-Path -LiteralPath $TargetBat)) {
  throw "Launcher bat not found: $TargetBat"
}
if (-not (Test-Path -LiteralPath $LogoPng)) {
  throw "Logo not found: $LogoPng"
}
if (-not (Test-Path -LiteralPath $TemplateCs)) {
  throw "Launcher source not found: $TemplateCs"
}
if (-not (Test-Path -LiteralPath $Csc)) {
  throw "csc.exe not found (.NET Framework 4.x required)"
}

function New-MultiSizeIcon {
  param(
    [Parameter(Mandatory = $true)][string]$PngPath,
    [Parameter(Mandatory = $true)][string]$IcoPath
  )

  Add-Type -AssemblyName System.Drawing

  $dir = Split-Path -Parent $IcoPath
  if (-not (Test-Path -LiteralPath $dir)) {
    New-Item -ItemType Directory -Path $dir -Force | Out-Null
  }

  $sizes = @(16, 32, 48, 64, 128, 256)
  $src = [System.Drawing.Image]::FromFile($PngPath)
  try {
    $images = New-Object System.Collections.Generic.List[byte[]]
    $widths = New-Object System.Collections.Generic.List[int]
    $heights = New-Object System.Collections.Generic.List[int]

    foreach ($size in $sizes) {
      $bmp = New-Object System.Drawing.Bitmap $size, $size
      $g = [System.Drawing.Graphics]::FromImage($bmp)
      try {
        $g.Clear([System.Drawing.Color]::Transparent)
        $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $g.DrawImage($src, 0, 0, $size, $size)

        $ms = New-Object System.IO.MemoryStream
        $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
        $images.Add($ms.ToArray())
        $widths.Add($size)
        $heights.Add($size)
        $ms.Dispose()
      } finally {
        $g.Dispose()
        $bmp.Dispose()
      }
    }

    $count = $images.Count
    $offset = 6 + (16 * $count)
    $fs = [System.IO.File]::Open($IcoPath, [System.IO.FileMode]::Create)
    try {
      $bw = New-Object System.IO.BinaryWriter $fs
      $bw.Write([uint16]0)
      $bw.Write([uint16]1)
      $bw.Write([uint16]$count)

      for ($i = 0; $i -lt $count; $i++) {
        $w = $widths[$i]
        $h = $heights[$i]
        $data = $images[$i]
        $bw.Write([byte]($(if ($w -ge 256) { 0 } else { $w })))
        $bw.Write([byte]($(if ($h -ge 256) { 0 } else { $h })))
        $bw.Write([byte]0)
        $bw.Write([byte]0)
        $bw.Write([uint16]1)
        $bw.Write([uint16]32)
        $bw.Write([uint32]$data.Length)
        $bw.Write([uint32]$offset)
        $offset += $data.Length
      }

      for ($i = 0; $i -lt $count; $i++) {
        $bw.Write($images[$i])
      }
      $bw.Flush()
    } finally {
      $fs.Dispose()
    }
  } finally {
    $src.Dispose()
  }
}

Write-Host 'Generating launcher icon ...'
New-MultiSizeIcon -PngPath $LogoPng -IcoPath $IconIco

$Desktop = [Environment]::GetFolderPath('Desktop')
$ExeName = "$Name.exe"
$DesktopExe = Join-Path $Desktop $ExeName
$RootExe = Join-Path $ProjectRoot 'KBird-Launcher.exe'
$BuildDir = Join-Path $env:TEMP ("kbird-launcher-" + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $BuildDir -Force | Out-Null

try {
  # Only replace the const assignments (do not touch other placeholder checks).
  $csText = [System.IO.File]::ReadAllText($TemplateCs)
  $csText = $csText.Replace(
    'private const string ProjectRoot = @"__PROJECT_ROOT__";',
    ('private const string ProjectRoot = @"' + $ProjectRoot + '";')
  )
  $csText = $csText.Replace(
    'private const string BatName = @"__BAT_NAME__";',
    ('private const string BatName = @"' + $BatName + '";')
  )
  $csPath = Join-Path $BuildDir 'KBirdLauncher.cs'
  $utf8Bom = New-Object System.Text.UTF8Encoding $true
  [System.IO.File]::WriteAllText($csPath, $csText, $utf8Bom)

  $outBuild = Join-Path $BuildDir 'KBirdLauncher.exe'
  Write-Host 'Compiling launcher exe ...'
  & $Csc /nologo /target:winexe /optimize+ `
    /win32icon:"$IconIco" `
    /r:System.Windows.Forms.dll `
    /r:System.Drawing.dll `
    /out:"$outBuild" `
    "$csPath"
  if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $outBuild)) {
    throw 'Failed to compile launcher exe'
  }

  # Remove old .lnk launchers that pointed at the bat
  $shell = New-Object -ComObject WScript.Shell
  Get-ChildItem -LiteralPath $Desktop -Filter '*.lnk' -ErrorAction SilentlyContinue | ForEach-Object {
    try {
      $existing = $shell.CreateShortcut($_.FullName)
      $existingTarget = [string]$existing.TargetPath
      [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($existing)
      if ($existingTarget -and ($existingTarget -ieq $TargetBat -or $existingTarget -like '*\KBird-Desktop*.bat')) {
        Remove-Item -LiteralPath $_.FullName -Force
        Write-Host ("Removed old shortcut: " + $_.Name)
      }
    } catch {}
  }
  [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($shell)

  # Also remove previous Kbird*.lnk / KBird*.lnk by name
  Get-ChildItem -LiteralPath $Desktop -Filter '*.lnk' -ErrorAction SilentlyContinue |
    Where-Object { $_.BaseName -match '^[Kk][Bb]ird' } |
    ForEach-Object {
      Remove-Item -LiteralPath $_.FullName -Force
      Write-Host ("Removed old shortcut: " + $_.Name)
    }

  Copy-Item -LiteralPath $outBuild -Destination $DesktopExe -Force
  Copy-Item -LiteralPath $outBuild -Destination $RootExe -Force
} finally {
  Remove-Item -LiteralPath $BuildDir -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host ''
Write-Host 'OK: Launcher program created (real .exe, not a .lnk)'
Write-Host ("  Desktop : " + $DesktopExe)
Write-Host ("  Project : " + $RootExe)
Write-Host ("  Runs    : " + $TargetBat)
Write-Host ("  Icon    : " + $IconIco)
Write-Host ''
Write-Host 'Double-click the desktop program to start KBird.'
