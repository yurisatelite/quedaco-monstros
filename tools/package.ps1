$ErrorActionPreference = 'Stop'
$moduleRoot = Split-Path $PSScriptRoot -Parent
$manifest = Get-Content -LiteralPath (Join-Path $moduleRoot 'module.json') -Raw | ConvertFrom-Json
$distPath = Join-Path $moduleRoot 'dist'
New-Item -ItemType Directory -Path $distPath -Force | Out-Null
$zipPath = Join-Path $distPath 'quedaco-monstros.zip'
Compress-Archive -LiteralPath (Join-Path $moduleRoot 'module.json'), (Join-Path $moduleRoot 'src'), (Join-Path $moduleRoot 'styles'), (Join-Path $moduleRoot 'README.md'), (Join-Path $moduleRoot 'CHANGELOG.md'), (Join-Path $moduleRoot 'docs') -DestinationPath $zipPath -Force
Copy-Item -LiteralPath (Join-Path $moduleRoot 'module.json') -Destination (Join-Path $distPath 'module.json')
Write-Output "Pacote $($manifest.version): $zipPath"
