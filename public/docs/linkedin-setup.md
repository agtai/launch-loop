# LinkedIn 应用、回调与正式授权

## 尚未准备应用时的最小步骤

本轮操作者尚无应用和HTTPS回调。先继续本机创作，不需为此开放整个工作台。一次性准备：

1. 在LinkedIn开发者门户创建应用，申请下方的OpenID Connect和Share产品，核对`openid profile w_member_social`。
2. 准备自己控制的HTTPS回调，只代理GET `/api/linkedin/callback`到本机；其他路径和方法拒绝，不记录带授权码的query。
3. 在本机安全设置`LINKEDIN_CLIENT_ID`、`LINKEDIN_CLIENT_SECRET`和完全一致的`LINKEDIN_REDIRECT_URI`；不把secret粘贴到聊天或写进Git。项目`docs/LinkedIn最小配置.md`提供遮罩输入及临时环境变量脚本。
4. 执行`node server/linkedin-preflight.mjs`；启动本目录服务后执行`node server/linkedin-preflight.mjs --check-callback`。未准备时明确报缺项，不发帖。
5. 在“发布”进入官方页面，由操作者登录授权；返回工作台核对账号和权限。真实发帖要等选定正式版本、完整正文和图片另行确认。

本轮真实OAuth、LinkedIn上传及发布未验收。以下是详细配置与边界。

更新：2026-09-24。本指南只准备个人 LinkedIn 普通 feed 的纯文本／单图发布。代码与本地替身测试已完成，不代表应用获权、OAuth 成功或实际发帖。当前环境的 Process／User／Machine 层均未配置应用 ID、secret、回调、API 版本或 scopes。不要在聊天中粘贴 secret 或 token。

## 操作者准备应用

1. 到 [LinkedIn Developers](https://www.linkedin.com/developers/apps) 选择已有应用。没有应用时，由操作者填写 App name、LinkedIn Page、Privacy policy URL、App logo，并亲自接受条款；关联 Page 如需验证，由其 super admin 完成。不要填写虚构组织或页面。[应用创建说明](https://www.linkedin.com/help/recruiter/answer/a1667239)、[Page 关联说明](https://www.linkedin.com/help/linkedin/answer/a553297)。
2. 在 Products 开通 [Sign in with LinkedIn using OpenID Connect](https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/sign-in-with-linkedin-v2) 与 [Share on LinkedIn](https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/share-on-linkedin)。在 Auth 核实实际获准 `openid profile w_member_social`。额外的 `r_member_social` 是受限读取权限，不默认请求；缺少时不能声称可以自动核对未知帖子。
3. 准备自己控制的 HTTPS 回调资源，将完整 `https://<实际域名>/api/linkedin/callback` 注册进 Authorized redirect URLs。不能带 query／fragment，必须与工作台配置完全一致。工作台仍在本机 HTTP 回环地址运行。[官方 OAuth 条件](https://learn.microsoft.com/en-us/linkedin/shared/authentication/authorization-code-flow)。

## 只公开回调路径

以下是**未部署、未做真实 HTTPS 验证的配置范例**。假设维护者已有域名和受信任证书，专用 Caddy 代理与工作台位于同一台机器。请用实际资源替换示例域名、证书路径和端口；远端服务器的 `127.0.0.1` 不代表操作者的电脑。不要把整个工作台或整个端口直接接入公网隧道。

```caddyfile
https://oauth.example.com {
    tls "<实际证书文件>" "<实际私钥文件>"
    log {
        output discard
    }
    @callback {
        method GET
        path /api/linkedin/callback
    }
    handle @callback {
        reverse_proxy 127.0.0.1:4318 {
            header_up Host 127.0.0.1:4318
        }
    }
    handle {
        respond "Not found" 404
    }
}
```

只透传 GET 回调及其 query，勿记录包含授权码／state 的访问日志或调试日志。保留后端 303 的本机 `Location`，不要改写到公网域名；使用 Nginx 时需核对 `proxy_redirect off`。正式登录前先用无凭据、无 state 的请求验证：GET 回调返回固定双语失败页；`/`、`/api/backup`、`/api/content`、POST 回调均不能代理到工作台。范例依据：[匹配规则](https://caddyserver.com/docs/caddyfile/matchers)、[反向代理](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy)、[证书配置](https://caddyserver.com/docs/caddyfile/directives/tls)、[日志配置](https://caddyserver.com/docs/caddyfile/directives/log)。

## 在运营电脑安全输入配置

先用本项目 `Stop-Workbench.ps1` 正常停止旧服务；在项目目录的 PowerShell 运行下列代码。字段只由操作者在本机输入，secret 使用遮罩；不要写进命令行参数、Git、浏览器持久化或运营备份。本例保留并恢复父终端原环境，启动的服务保留其所需配置。

```powershell
$linkedinNames = @('LINKEDIN_CLIENT_ID','LINKEDIN_CLIENT_SECRET','LINKEDIN_REDIRECT_URI','LINKEDIN_API_VERSION','LINKEDIN_SCOPES')
$linkedinPrevious = @{}
foreach ($linkedinName in $linkedinNames) {
    $linkedinPrevious[$linkedinName] = [Environment]::GetEnvironmentVariable($linkedinName, 'Process')
}
$linkedinSecret = $null
try {
    $env:LINKEDIN_CLIENT_ID = Read-Host 'LinkedIn Client ID'
    $env:LINKEDIN_REDIRECT_URI = Read-Host 'Registered HTTPS callback URL'
    $env:LINKEDIN_API_VERSION = '202609'
    $env:LINKEDIN_SCOPES = 'openid profile w_member_social'
    $linkedinSecret = Read-Host 'LinkedIn Client Secret (hidden)' -AsSecureString
    $env:LINKEDIN_CLIENT_SECRET = [Net.NetworkCredential]::new('', $linkedinSecret).Password
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Start-Workbench.ps1
} finally {
    foreach ($linkedinName in $linkedinNames) {
        [Environment]::SetEnvironmentVariable($linkedinName, $linkedinPrevious[$linkedinName], 'Process')
    }
    if ($linkedinSecret) { $linkedinSecret.Dispose() }
}
```

需要复用现有手工系统代理时，在启动命令末尾加 `-UseSystemProxy`；不填写开发者机器的代理地址，不使用 `setx` 或修改全局网络设置。参数会验证当前操作者的系统设置；PAC、含凭据或不明确的映射会明确拒绝。服务已运行时需先正常停止后再用新环境启动。Node 支持时同时启用 `--use-env-proxy`；旧 Node 的限制由启动器提示。

## OAuth 与发帖分开

进入工作台“发布”，刷新配置，点击“连接 LinkedIn 账号”，由操作者在 LinkedIn 官方页面完成登录和授权。成功回调 303 返回发起连接的本机发布页，页面重新读取服务端账号、实际返回 scopes 和有效期。URL 标记只选择页面，不能制造连接成功；失败显示安全双语页面及返回链接，不展示授权码、state 或 token。

凭据只供当前服务进程使用，OAuth token 只在内存；重启后重新授权。项目交给第二位负责人时，转交内容和必要配置说明，由其使用获准应用并重新授权，不复制开发者的 Codex／LinkedIn 登录凭据。当前没有远程查看权限系统，不因配置回调而公开其他工作台页面。

已保存的正式版本可在未连接时本地看正文和图片，但服务端只有确认实际账号及写权限后才签发发布预览凭证。用户确认保存、OAuth 授权和本次确认发帖是三件事。**只有用户明确核对本次账号、版本、完整正文与配图后才可上传图片、提交帖子**；生成双语稿不意味着发布两份。

发布后的图片上传、201＋真实帖子 ID、最终可见状态分别核验。网络中断或返回不完整时保留 unknown，不自动重发；没有受限读权限时人工核对。[Posts API](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api?view=li-lms-2026-09)、[Images API](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/images-api?view=li-lms-2026-09)。
