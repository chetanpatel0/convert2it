# Packages dist/ for upload to any static host.
# Usage (from the repo root): powershell -ExecutionPolicy Bypass -File deploy/package.ps1
param(
  [string]$Out = "convert-site.zip"
)

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
$dist = Join-Path $root "dist"

if (-not (Test-Path (Join-Path $dist "index.html"))) {
  throw "dist/index.html not found. Run the build first (see deploy/README.md)."
}

# Host config belongs at the site root
Copy-Item (Join-Path $PSScriptRoot "_headers") $dist -Force
Copy-Item (Join-Path $PSScriptRoot ".htaccess") $dist -Force

Add-Type -AssemblyName System.IO.Compression.FileSystem
if ([System.IO.Path]::IsPathRooted($Out)) {
  $outPath = $Out
} else {
  $outPath = Join-Path $root $Out
}
if (Test-Path $outPath) { Remove-Item $outPath -Force }

[System.IO.Compression.ZipFile]::CreateFromDirectory(
  $dist,
  $outPath,
  [System.IO.Compression.CompressionLevel]::Optimal,
  $false
)

$files = Get-ChildItem $dist -Recurse -File
"{0} files, {1:N1} MB -> {2}" -f $files.Count, (($files | Measure-Object Length -Sum).Sum / 1MB), $outPath
