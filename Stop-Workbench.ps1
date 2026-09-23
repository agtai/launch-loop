$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath($PSScriptRoot)
. (Join-Path $root 'server\Launcher.Common.ps1')
$lock = $null
try {
    $lock = Get-WorkbenchLock $root
    $recordPath = Join-Path $root 'data\server-process.json'
    if (-not (Test-Path -LiteralPath $recordPath)) { Write-Host '没有本工作台的进程记录，无需停止。'; exit 0 }
    $record = Get-Content -LiteralPath $recordPath -Raw -Encoding UTF8 | ConvertFrom-Json
    $owned = Get-WorkbenchProcess $root $record
    if ($owned) {
        Stop-Process -Id $owned.Id -ErrorAction Stop
        $owned.WaitForExit(5000) | Out-Null
        Write-Host '工作台已停止。数据库和备份仍保留在 data 文件夹。'
    } else { Write-Host '工作台已经停止。' }
    Remove-Item -LiteralPath $recordPath -Force
    exit 0
} catch {
    Write-Host ('停止未完成：' + $_.Exception.Message) -ForegroundColor Red
    exit 1
} finally { if ($lock) { $lock.ReleaseMutex(); $lock.Dispose() } }
