$ErrorActionPreference = 'Stop'

function Get-WorkbenchLock([string]$Root) {
    $hash = [System.Security.Cryptography.SHA256]::Create()
    try { $key = [BitConverter]::ToString($hash.ComputeHash([Text.Encoding]::UTF8.GetBytes($Root.ToLowerInvariant()))).Replace('-', '') } finally { $hash.Dispose() }
    $mutex = [Threading.Mutex]::new($false, ('Local\ContentWorkbench-' + $key))
    try { $acquired = $mutex.WaitOne(15000) } catch [Threading.AbandonedMutexException] { $acquired = $true }
    if (-not $acquired) { $mutex.Dispose(); throw '另一个工作台启动或停止操作尚未结束，请稍后重试。' }
    return $mutex
}

function Get-WorkbenchProcess([string]$Root, $Record) {
    $expectedScript = [IO.Path]::GetFullPath((Join-Path $Root 'server\index.mjs'))
    if (-not $Record -or $Record.pid -notmatch '^\d+$' -or [long]$Record.pid -le 0 -or [long]$Record.pid -gt [int]::MaxValue) { throw '进程记录无效；为避免误停其他程序，已取消操作。' }
    if ($Record.script -ne $expectedScript) { throw '进程记录不属于当前工作台文件夹，已取消操作。' }
    $process = Get-Process -Id ([int]$Record.pid) -ErrorAction SilentlyContinue
    if (-not $process) { return $null }
    $details = Get-CimInstance Win32_Process -Filter ('ProcessId = ' + [int]$Record.pid)
    $scriptPattern = '(?:^|\s)"?' + [regex]::Escape($expectedScript) + '"?(?:\s|$)'
    if ($process.ProcessName -ne 'node' -or $details.ExecutablePath -ne $Record.executable -or $details.CommandLine -notmatch $scriptPattern -or $process.StartTime.ToUniversalTime().Ticks.ToString() -ne [string]$Record.startedAtTicks) {
        throw '该 PID 已被其他程序使用或启动信息不匹配；为避免误停其他程序，已取消操作。'
    }
    return $process
}

function Test-WorkbenchHealth([int]$Port) {
    try {
        $response = Invoke-RestMethod -Uri ('http://127.0.0.1:' + $Port + '/api/health') -TimeoutSec 2 -UseBasicParsing
        return ($response.app -eq 'content-workbench-local' -and $response.version -eq 1)
    } catch { return $false }
}

function Test-WorkbenchPort([int]$Port) {
    $client = [Net.Sockets.TcpClient]::new()
    try { $client.Connect('127.0.0.1', $Port); return $true } catch { return $false } finally { $client.Dispose() }
}

function Find-WorkbenchNode([string]$Root) {
    $candidates = @((Join-Path $Root 'runtime\node.exe'), (Join-Path $Root 'node\node.exe'))
    if ($env:LOCALAPPDATA) { $candidates += (Join-Path $env:LOCALAPPDATA 'hermes\node\node.exe') }
    $command = Get-Command node.exe -ErrorAction SilentlyContinue
    if ($command) { $candidates += $command.Source }
    foreach ($candidate in ($candidates | Select-Object -Unique)) {
        if (-not (Test-Path -LiteralPath $candidate -PathType Leaf)) { continue }
        try {
            $versionText = (& $candidate --version 2>$null | Out-String).Trim()
            if ($versionText -match '^v(\d+)\.(\d+)\.(\d+)$' -and [version]$versionText.Substring(1) -ge [version]'22.13.0') { return [IO.Path]::GetFullPath($candidate) }
        } catch { continue }
    }
    throw '未找到 Node.js 22.13 或更新版本。请安装 Node.js LTS，或把 node.exe 放入工作台的 runtime 文件夹，然后重新启动。无需每次安装依赖。'
}
