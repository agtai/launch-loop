param([ValidateRange(1024,65535)][int]$Port = 4318, [switch]$NoBrowser, [switch]$UseSystemProxy, [switch]$EnableCodexImages)
$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath($PSScriptRoot)
. (Join-Path $root 'server\Launcher.Common.ps1')
. (Join-Path $root 'server\Launcher.Proxy.ps1')
$lock = $null
try {
    $lock = Get-WorkbenchLock $root
    foreach ($required in @('server\index.mjs','dist\index.html','data-seed\modules.json','data-seed\tasks.json')) {
        if (-not (Test-Path -LiteralPath (Join-Path $root $required) -PathType Leaf)) { throw ('工作台文件不完整，缺少 ' + $required + '。请使用完整文件夹，不要单独移动启动脚本。') }
    }
    $dataDir = Join-Path $root 'data'
    $recordPath = Join-Path $dataDir 'server-process.json'
    $url = 'http://127.0.0.1:' + $Port
    if (Test-Path -LiteralPath $recordPath) {
        $record = $null
        $existing = $null
        try {
            $record = Get-Content -LiteralPath $recordPath -Raw -Encoding UTF8 | ConvertFrom-Json
            $existing = Get-WorkbenchProcess $root $record
        } catch {
            Write-Host '先前的进程记录已失效，将检查端口后重新启动；不会停止旧记录指向的进程。'
        }
        if ($existing) {
            if ($record.port -ne $Port) { throw ('当前文件夹的工作台已在端口 ' + $record.port + ' 运行，请先停止后再切换端口。') }
            $listener = Get-NetTCPConnection -LocalAddress '127.0.0.1' -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
            if (-not ($listener | Where-Object { $_.OwningProcess -eq $existing.Id }) -or -not (Test-WorkbenchHealth $Port)) { throw '已记录的工作台进程未正常响应。请运行停止工作台后重试，并查看 data/server-error.log。' }
            Write-Host ('工作台已在运行，继续使用：' + $url)
            if ($UseSystemProxy) { Write-Host '现有服务的代理环境不会改变；如需应用 -UseSystemProxy，请先运行 Stop-Workbench.ps1 再重新启动。' }
            if ($EnableCodexImages) { Write-Host '现有服务的配图设置不会改变；如需应用 -EnableCodexImages，请先运行 Stop-Workbench.ps1 再重新启动。' }
            if (-not $NoBrowser) { Start-Process $url }
            exit 0
        }
    }
    if (Test-WorkbenchPort $Port) { throw ('端口 ' + $Port + ' 已被其他程序占用。未关闭或替换该程序；请先处理端口冲突，或用 -Port 指定其他端口。') }
    $nodePath = Find-WorkbenchNode $root
    [IO.Directory]::CreateDirectory($dataDir) | Out-Null
    $serverPath = Join-Path $root 'server\index.mjs'
    $proxy = Get-WorkbenchProxyOverrides -UseSystemProxy:$UseSystemProxy
    if ($proxy.Mode -eq 'system') { Write-Host '本次工作台启动将复用当前无凭据手工系统代理；不会更改全局网络设置。' }
    if ($proxy.Mode -eq 'existing') { Write-Host '保留已有进程代理配置；仅为本次子进程补充本机回环地址绕过代理。' }
    if ($proxy.Mode -eq 'existing' -and -not $env:HTTP_PROXY -and -not $env:HTTPS_PROXY) { Write-Host '当前仅设置 ALL_PROXY：将保留给 Codex CLI 使用；Node 原生代理只读取 HTTP_PROXY/HTTPS_PROXY，不会推测 ALL_PROXY。' }
    $nodeArguments = '"' + $serverPath + '"'
    if ($UseSystemProxy) {
        $proxyFlag = Get-WorkbenchNodeProxyFlag ((& $nodePath --help 2>$null | Out-String))
        if ($proxyFlag) { $nodeArguments = $proxyFlag + ' ' + $nodeArguments }
        else { Write-Host '当前 Node.js 不支持 --use-env-proxy：Codex CLI 可继承代理，Node 原生网络请求仍需受支持的代理入口。' }
    }
    $childEnvironment = $proxy.Values
    $childEnvironment.PORT = [string]$Port
    $childEnvironment.DATA_DIR = $dataDir
    if ($EnableCodexImages) { $childEnvironment.LAUNCH_LOOP_IMAGE_PROVIDER = 'codex-cache' }
    $child = Invoke-WithWorkbenchEnvironment $childEnvironment {
        Start-Process -FilePath $nodePath -ArgumentList $nodeArguments -WorkingDirectory $root -WindowStyle Hidden -RedirectStandardOutput (Join-Path $dataDir 'server.log') -RedirectStandardError (Join-Path $dataDir 'server-error.log') -PassThru
    }
    $child.Refresh()
    $record = @{ pid = $child.Id; port = $Port; script = $serverPath; executable = $nodePath; startedAtTicks = $child.StartTime.ToUniversalTime().Ticks.ToString() }
    $record | ConvertTo-Json | Set-Content -LiteralPath $recordPath -Encoding UTF8
    $ready = $false
    for ($attempt = 0; $attempt -lt 40; $attempt++) {
        $child.Refresh()
        if ($child.HasExited) { break }
        if (Test-WorkbenchHealth $Port) { $ready = $true; break }
        Start-Sleep -Milliseconds 250
    }
    if (-not $ready) { throw '工作台启动失败。请查看 data/server-error.log；修复后再次双击启动。' }
    Write-Host ('本地工作台已启动：' + $url)
    Write-Host ('数据保存在：' + (Join-Path $dataDir 'workbench.sqlite'))
    if (-not $NoBrowser) { Start-Process $url }
    exit 0
} catch {
    Write-Host ('启动未完成：' + $_.Exception.Message) -ForegroundColor Red
    exit 1
} finally { if ($lock) { $lock.ReleaseMutex(); $lock.Dispose() } }
