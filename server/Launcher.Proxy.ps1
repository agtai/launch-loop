$ErrorActionPreference = 'Stop'

function Get-WorkbenchManualSystemProxy {
    $settings = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey('Software\Microsoft\Windows\CurrentVersion\Internet Settings', $false)
    if (-not $settings) { throw '无法读取当前用户的系统代理设置；没有更改网络配置。' }
    try {
        return [pscustomobject]@{
            ProxyEnable = $settings.GetValue('ProxyEnable', 0)
            ProxyServer = $settings.GetValue('ProxyServer', '')
            AutoConfigURL = $settings.GetValue('AutoConfigURL', '')
        }
    } finally { $settings.Dispose() }
}

function ConvertTo-WorkbenchProxyUrl([string]$Value) {
    if ([string]::IsNullOrWhiteSpace($Value) -or $Value -match '[\r\n\x00]') { throw '系统代理地址为空或无效；请配置有效的手工 HTTP/HTTPS 代理。' }
    $candidate = $Value.Trim()
    if ($candidate -match '\s|@') { throw '不支持含凭据或空白字符的系统代理；请使用无凭据的手工代理。' }
    if ($candidate -notmatch '://') { $candidate = 'http://' + $candidate }
    $uri = $null
    if (-not [Uri]::TryCreate($candidate, [UriKind]::Absolute, [ref]$uri)) { throw '系统代理地址无效；未启动工作台。' }
    if ($uri.Scheme -notin @('http', 'https') -or -not $uri.Host -or [Uri]::CheckHostName($uri.DnsSafeHost) -eq [UriHostNameType]::Unknown -or $uri.Port -lt 1 -or $uri.Port -gt 65535) { throw '仅支持有效的手工 HTTP/HTTPS 代理地址；不支持 SOCKS 或自动猜测协议。' }
    if ($uri.UserInfo -or $uri.AbsolutePath -ne '/' -or $uri.Query -or $uri.Fragment) { throw '系统代理不能包含凭据、路径、查询参数或片段；未启动工作台。' }
    return $uri.GetComponents([UriComponents]::SchemeAndServer, [UriFormat]::UriEscaped)
}

function Merge-WorkbenchNoProxy([string]$Existing) {
    $parts = @()
    foreach ($part in (@($Existing -split ',') + @('localhost', '127.0.0.1', '::1'))) {
        $value = $part.Trim()
        if ($value -and $parts -notcontains $value) { $parts += $value }
    }
    return ($parts -join ',')
}

function Get-WorkbenchProxyOverrides([switch]$UseSystemProxy) {
    if (-not $UseSystemProxy) { return [pscustomobject]@{ Mode = 'unchanged'; Values = @{} } }
    $values = @{ NO_PROXY = (Merge-WorkbenchNoProxy ([Environment]::GetEnvironmentVariable('NO_PROXY', 'Process'))) }
    foreach ($name in @('HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY')) {
        if (-not [string]::IsNullOrEmpty([Environment]::GetEnvironmentVariable($name, 'Process'))) {
            # Explicit process configuration takes precedence; do not even read registry settings.
            return [pscustomobject]@{ Mode = 'existing'; Values = $values }
        }
    }
    $settings = Get-WorkbenchManualSystemProxy
    if (-not [string]::IsNullOrWhiteSpace([string]$settings.AutoConfigURL)) { throw '当前系统配置了 PAC 自动代理；-UseSystemProxy 仅支持无凭据的手工代理，不会执行或猜测 PAC。' }
    if ([string]$settings.ProxyEnable -ne '1') { throw '当前系统未启用手工代理；-UseSystemProxy 没有可复用的代理。' }
    $raw = [string]$settings.ProxyServer
    if ($raw.Contains('=')) {
        $mapped = @{}
        foreach ($entry in ($raw -split ';')) {
            if ($entry -notmatch '^\s*(http|https)\s*=\s*(.+?)\s*$') { throw '系统代理映射格式不受支持；请提供明确的 HTTP 和 HTTPS 手工代理，不会猜测缺少的协议。' }
            $protocol = $Matches[1].ToLowerInvariant()
            $address = $Matches[2]
            if ($mapped.ContainsKey($protocol)) { throw '系统代理包含重复的协议映射；未启动工作台。' }
            $mapped[$protocol] = ConvertTo-WorkbenchProxyUrl $address
        }
        if (-not $mapped.ContainsKey('http') -or -not $mapped.ContainsKey('https')) { throw '系统代理必须同时提供 HTTP 和 HTTPS 映射；不会推测缺少的代理。' }
        $values.HTTP_PROXY = $mapped.http
        $values.HTTPS_PROXY = $mapped.https
    } else {
        $address = ConvertTo-WorkbenchProxyUrl $raw
        $values.HTTP_PROXY = $address
        $values.HTTPS_PROXY = $address
    }
    return [pscustomobject]@{ Mode = 'system'; Values = $values }
}

function Invoke-WithWorkbenchEnvironment([hashtable]$Values, [scriptblock]$Action) {
    $previous = @{}
    foreach ($name in $Values.Keys) { $previous[$name] = [Environment]::GetEnvironmentVariable($name, 'Process') }
    try {
        foreach ($name in $Values.Keys) { [Environment]::SetEnvironmentVariable($name, $Values[$name], 'Process') }
        & $Action
    } finally {
        foreach ($name in $previous.Keys) { [Environment]::SetEnvironmentVariable($name, $previous[$name], 'Process') }
    }
}

function Get-WorkbenchNodeProxyFlag([string]$HelpText) {
    if ($HelpText -match '(?m)^\s*--use-env-proxy(?:\s|$)') { return '--use-env-proxy' }
    return $null
}
