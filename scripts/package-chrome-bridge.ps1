$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$extensionPackagePath = Join-Path $repoRoot "apps/vscode-extension/package.json"
$chromeRoot = Join-Path $repoRoot "apps/chrome-extension"
$packageJson = Get-Content -Raw -LiteralPath $extensionPackagePath | ConvertFrom-Json
$version = $packageJson.version
$destination = Join-Path $repoRoot "tracefy-chrome-bridge-$version.zip"

$required = @(
  (Join-Path $chromeRoot "manifest.json"),
  (Join-Path $chromeRoot "popup.html"),
  (Join-Path $chromeRoot "dist")
)

foreach ($path in $required) {
  if (-not (Test-Path -LiteralPath $path)) {
    throw "Missing Chrome bridge asset: $path. Run npm run build first."
  }
}

if (Test-Path -LiteralPath $destination) {
  Remove-Item -LiteralPath $destination -Force
}

Compress-Archive -Path $required -DestinationPath $destination -Force
Write-Host "Packaged Chrome bridge: $destination"
