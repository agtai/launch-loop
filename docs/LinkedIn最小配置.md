# LinkedIn 最小配置

核查日期：2026-09-24。当前操作者尚未准备 LinkedIn 应用和 HTTPS 回调，**真实 OAuth、真实图片上传及真实发帖均未验收**。本指南准备个人账号的普通 feed 动态；本轮只完成本地实现和配置说明，不执行平台图片上传或发帖。

没有应用时仍可启动工作台、创作、保存和查看正式版本。运行 `node server/linkedin-preflight.mjs` 可查看必要配置缺项；未配置时退出码为 1，不会请求 LinkedIn。

## 1. 准备应用与权限

由操作者在 [LinkedIn Developers](https://www.linkedin.com/developers/apps) 创建或选择真实应用，并按门户要求完成所属 Page、条款及验证。应用的 Products 需要：

| 产品 | 工作台所需权限 |
|---|---|
| [Sign in with LinkedIn using OpenID Connect](https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/sign-in-with-linkedin-v2) | `openid profile`，读取本次授权的账号身份 |
| [Share on LinkedIn](https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/share-on-linkedin) | `w_member_social`，代表该成员发布 |

在应用 Auth 页核对实际获准权限。工作台默认请求 `openid profile w_member_social`。`r_member_social` 是另需批准的受限读取权限；没有它时，未知发布结果需要在 LinkedIn 人工核对。个人发布权限不等于帖子读取权限。[官方 Posts 权限说明](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api?view=li-lms-2026-09#permissions)

## 2. 准备只接收回调的 HTTPS 地址

准备自己控制的 HTTPS 域名、有效证书和回调代理。将完整 `https://<实际域名>/api/linkedin/callback` 注册到应用 Auth 的 Authorized redirect URLs，随后本机配置使用**完全相同的地址**。本项目要求该路径，无 query、fragment 或 URL 用户名密码。[官方 OAuth 配置要求](https://learn.microsoft.com/en-us/linkedin/shared/authentication/authorization-code-flow)

工作台仍只监听本机 `127.0.0.1`。代理必须只允许 **GET `/api/linkedin/callback`**，其他路径和方法全部拒绝；不能公开整个端口或工作台。代理需：

- 将回调及其 query 转给本机工作台，并将上游 Host 设为 `127.0.0.1:<本机端口>`。
- 保留后端 303 返回的本机 Location，不改写为公网地址。
- 不记录回调 query，其中可能含授权码和 state。

具体 Caddy 配置见[仅回调代理范例](LinkedIn授权配置.md#只公开回调路径)。范例尚未部署，需维护者按实际资源配置；远程服务器的 `127.0.0.1` 不是操作者的电脑。尚无域名、证书或代理时，停留在“待配置”，不直接开放工作台。

## 3. 本机输入三项配置，启动并预检

准备 [README 要求的 Node.js](../README.md#启动工作台)，在项目根目录打开 PowerShell。必要变量只有三项：

| 环境变量 | 输入内容 |
|---|---|
| `LINKEDIN_CLIENT_ID` | 本应用的 Client ID |
| `LINKEDIN_CLIENT_SECRET` | 本应用的 Client Secret；仅在本机遮罩输入 |
| `LINKEDIN_REDIRECT_URI` | 上一步已注册的完整 HTTPS 回调地址 |

未设置可选变量时，当前代码的 API 版本为 `202609`，scopes 为 `openid profile w_member_social`；无需为了最小配置增加另外两项。版本和实际权限仍以应用与平台响应为准。

以下脚本先停止**当前项目目录**登记的服务，再在当前进程中临时输入配置、启动服务和检查回调。不会把密钥写入文件、命令历史、Git 或备份；结束时恢复父终端原环境。后台服务保留本次启动所需配置。前台 `npm start` 服务需先在其终端正常停止。

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Stop-Workbench.ps1
if ($LASTEXITCODE -ne 0) { throw '当前目录服务未正常停止。' }

$linkedinNames = @('LINKEDIN_CLIENT_ID','LINKEDIN_CLIENT_SECRET','LINKEDIN_REDIRECT_URI')
$linkedinPrevious = @{}
foreach ($linkedinName in $linkedinNames) {
    $linkedinPrevious[$linkedinName] = [Environment]::GetEnvironmentVariable($linkedinName, 'Process')
}
$linkedinSecret = $null
try {
    $env:LINKEDIN_CLIENT_ID = Read-Host 'LinkedIn Client ID'
    $env:LINKEDIN_REDIRECT_URI = Read-Host 'Registered HTTPS callback URL'
    $linkedinSecret = Read-Host 'LinkedIn Client Secret (hidden)' -AsSecureString
    $env:LINKEDIN_CLIENT_SECRET = [Net.NetworkCredential]::new('', $linkedinSecret).Password

    node .\server\linkedin-preflight.mjs
    if ($LASTEXITCODE -ne 0) { throw '请先修正预检列出的配置缺项。' }
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Start-Workbench.ps1 -NoBrowser
    if ($LASTEXITCODE -ne 0) { throw '工作台启动失败。' }
    node .\server\linkedin-preflight.mjs --check-callback
    if ($LASTEXITCODE -ne 0) { throw '回调预检未通过；保持待配置，检查代理和网络。' }
} finally {
    foreach ($linkedinName in $linkedinNames) {
        [Environment]::SetEnvironmentVariable($linkedinName, $linkedinPrevious[$linkedinName], 'Process')
    }
    if ($linkedinSecret) { $linkedinSecret.Dispose() }
}
```

默认端口为 4318；如启动时使用其他端口，回调代理须同步调整。已有代理网络的使用方式见 [README](../README.md#启动工作台)，不填写其他操作者的固定地址，不修改全局配置。请勿把 secret、token 或授权码粘贴到聊天中。

`configured: true` 只表示本进程配置格式通过。`--check-callback` 仅发无凭据 GET，不跟随跳转、不读取响应正文：无 state 的回调应返回本工作台固定的 HTTP 401 失败页及安全响应头；`/`、`/api/backup`、`/api/content` 应拒绝访问。全部通过才显示 `read_only_checks_passed`。这不验证应用门户中的注册信息、产品获权或全部 HTTP 方法，更不代表 OAuth 已成功；仍需维护者核对代理规则和下一步人工授权。

## 4. 操作者亲自完成 OAuth

打开[本机工作台](http://127.0.0.1:4318/)，进入“发布”，刷新连接，点击“连接 LinkedIn 账号”。操作者在 LinkedIn 官方页面登录并授权。成功后回到本机发布页，核对实际账号 ID、返回的权限和有效期；拒绝、取消、缺权限或过期时按页面原因处理。令牌只保存在本次服务内存，重启后需重新授权；交接项目时由接手者重新配置和登录，不复制当前操作者凭据。

OAuth 授权、确认保存稿件和批准本次发帖是独立动作。本轮不点击“确认发布到 LinkedIn”，不上传图片到 LinkedIn。日后需要实际发布时，必须另行明确确认具体账号、正式版本、完整正文与所选配图；中英文两稿不会因此同时获准发布。平台返回帖子 ID 后还需打开 LinkedIn 核对可见状态；unknown 结果保持防重，不自动再次提交。

详细实现与证据边界见[授权配置指南](LinkedIn授权配置.md)、[执行与发布接口](第二阶段执行与发布接口.md)和[验证记录](验证记录.md)。
