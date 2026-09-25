param([ValidateSet('Real','Synthetic')][string]$Mode = 'Real', [int]$Port = 0, [switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$acceptanceRoot = [IO.Path]::GetFullPath((Join-Path $projectRoot ('tmp\mvp-' + $Mode.ToLowerInvariant())))
if (-not $acceptanceRoot.StartsWith((Join-Path $projectRoot 'tmp') + [IO.Path]::DirectorySeparatorChar)) { throw 'Invalid acceptance directory.' }
if ($Port -eq 0) { $Port = if ($Mode -eq 'Real') { 4348 } else { 4349 } }
if (Test-Path -LiteralPath (Join-Path $acceptanceRoot 'data\server-process.json')) {
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $acceptanceRoot 'Stop-Workbench.ps1')
    if ($LASTEXITCODE -ne 0) { throw 'Could not stop this acceptance instance.' }
}
[IO.Directory]::CreateDirectory($acceptanceRoot) | Out-Null
foreach ($directory in @('server','rules','data-seed','dist')) {
    Copy-Item -LiteralPath (Join-Path $projectRoot $directory) -Destination $acceptanceRoot -Recurse -Force
}
foreach ($file in @('Start-Workbench.ps1','Stop-Workbench.ps1')) { Copy-Item -LiteralPath (Join-Path $projectRoot $file) -Destination $acceptanceRoot -Force }
if ($Mode -eq 'Synthetic') {
    [IO.Directory]::CreateDirectory((Join-Path $acceptanceRoot 'tests\fixtures')) | Out-Null
    Copy-Item -LiteralPath (Join-Path $projectRoot 'tests\fixtures\text-v2-fixture.mjs') -Destination (Join-Path $acceptanceRoot 'tests\fixtures') -Force
    Copy-Item -LiteralPath (Join-Path $projectRoot 'server\index.mjs') -Destination (Join-Path $acceptanceRoot 'server\workbench-original.mjs') -Force
    Copy-Item -LiteralPath (Join-Path $projectRoot 'tests\fixtures\mvp-browser-server.mjs') -Destination (Join-Path $acceptanceRoot 'server\index.mjs') -Force
    $syntheticIndex = Join-Path $acceptanceRoot 'dist\index.html'
    $syntheticHtml = [IO.File]::ReadAllText($syntheticIndex).Replace('<body>', '<body><div style="padding:12px;background:#fff0b3;color:#352a00;text-align:center;font-weight:bold">SYNTHETIC TEST ONLY / 仅合成测试：模型、图片、LinkedIn 均为替身，不代表真实生成或发布。</div>')
    [IO.File]::WriteAllText($syntheticIndex, $syntheticHtml, [Text.UTF8Encoding]::new($false))
}
$previousImageProvider = $env:LAUNCH_LOOP_IMAGE_PROVIDER
try {
    $env:LAUNCH_LOOP_IMAGE_PROVIDER = if ($Mode -eq 'Real') { 'codex-cache' } else { '' }
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $acceptanceRoot 'Start-Workbench.ps1') -Port $Port -UseSystemProxy -NoBrowser
    if ($LASTEXITCODE -ne 0) { throw 'Acceptance service did not start.' }
} finally { $env:LAUNCH_LOOP_IMAGE_PROVIDER = $previousImageProvider }
Write-Host ('Acceptance mode: ' + $Mode + '; workdir: ' + $acceptanceRoot)
Write-Host ('Stop: powershell.exe -NoProfile -ExecutionPolicy Bypass -File "' + (Join-Path $acceptanceRoot 'Stop-Workbench.ps1') + '"')
if (-not $NoBrowser) { Start-Process ('http://127.0.0.1:' + $Port) }
