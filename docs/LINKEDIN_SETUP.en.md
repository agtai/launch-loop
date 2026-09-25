# LinkedIn setup for the local MVP

English operator edition, 24 September 2026. Based on the project's [Chinese configuration guide](LinkedIn最小配置.md). Real OAuth, LinkedIn image upload, and posting have not been validated. You can create, edit, save, and inspect content before completing this setup.

This guide keeps the current acceptance library on **port 4348**, under **`tmp/mvp-real/`**. It describes later setup; preparing this document does not configure an account or publish anything.

## 1. Prepare an app

Create or select your app in [LinkedIn Developers](https://www.linkedin.com/developers/apps). Complete the portal's required Page association, verification, and agreement steps yourself.

The implementation requests:

| Product | Required scopes |
|---|---|
| [Sign in with LinkedIn using OpenID Connect](https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/sign-in-with-linkedin-v2) | `openid profile` |
| [Share on LinkedIn](https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/share-on-linkedin) | `w_member_social` |

Confirm the permissions actually granted to your app. The separate restricted `r_member_social` read permission is not assumed; without it, an unknown publishing result may require manual inspection on LinkedIn. See the [official Posts permissions](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api?view=li-lms-2026-09#permissions).

## 2. Prepare a callback-only HTTPS endpoint

Arrange a domain you control, a valid certificate, and a callback proxy. Register exactly `https://<your-domain>/api/linkedin/callback` in the app's authorized redirect URLs. The local configuration must use the identical address. The application requires this path, without a query, fragment, or embedded username/password. See the [official OAuth flow](https://learn.microsoft.com/en-us/linkedin/shared/authentication/authorization-code-flow).

The workspace remains bound to `127.0.0.1`. Have the proxy maintainer configure:

- Only **GET `/api/linkedin/callback`** is forwarded; every other path and method is denied.
- The upstream is the operator's local instance at **127.0.0.1:4348**, with that upstream Host header.
- The backend's 303 redirect to the local workspace is preserved.
- Callback query parameters are not logged, because they may contain a code and state.

A proxy on a remote server needs a deliberately configured route to the operator's machine; its own `127.0.0.1` is not that machine. The callback proxy is not deployed by this guide. Keep the app unconfigured until these resources are ready; do not expose the whole workspace.

## 3. Enter configuration locally and run preflight

Ensure there is no active writing job before restarting. From this MVP project's root, enter the existing acceptance directory:

```powershell
Set-Location -LiteralPath .\tmp\mvp-real
```

Run the following in that directory. It stops only that directory's registered service, prompts for the secret with masked input, starts the same library on port 4348, and restores the parent shell's original environment afterward. It does not write credentials to a project file or backup.

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Stop-Workbench.ps1
if ($LASTEXITCODE -ne 0) { throw 'The current instance did not stop normally.' }

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
    if ($LASTEXITCODE -ne 0) { throw 'Resolve the missing or invalid settings before continuing.' }
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Start-Workbench.ps1 -Port 4348 -NoBrowser
    if ($LASTEXITCODE -ne 0) { throw 'The workspace did not start.' }
    node .\server\linkedin-preflight.mjs --check-callback
    if ($LASTEXITCODE -ne 0) { throw 'Callback checks failed. Inspect the proxy and network configuration.' }
} finally {
    foreach ($linkedinName in $linkedinNames) {
        [Environment]::SetEnvironmentVariable($linkedinName, $linkedinPrevious[$linkedinName], 'Process')
    }
    if ($linkedinSecret) { $linkedinSecret.Dispose() }
}
```

The three settings are `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`, and `LINKEDIN_REDIRECT_URI`. This build defaults to API version `202609` and scopes `openid profile w_member_social`. Defaults do not prove platform access. If your existing network requires the manually configured Windows system proxy, add `-UseSystemProxy` to the start command. This setup command does not enable background image generation; image validation remains a separate pending item.

Do not send secrets, tokens, or authorization codes in chat. The service retains the environment needed for this run; setup must be supplied again for a later fresh service process.

`configured: true` means local configuration is syntactically valid. `--check-callback` makes credential-free GET requests and expects the callback without state to return this app's 401 failure page and security headers, while `/`, `/api/backup`, and `/api/content` deny access. It does not follow redirects or read response bodies. `read_only_checks_passed` does not prove portal registration, granted permissions, all HTTP method restrictions, or successful OAuth.

## 4. Authorize the actual account

Open [the acceptance workspace](http://127.0.0.1:4348/), select **English**, then **Publishing**. Use **Refresh connection and records** and **Connect LinkedIn account**. Complete login and authorization on LinkedIn yourself.

On return, inspect the actual account ID, granted scopes, and expiry. Resolve rejection, cancellation, missing permission, or expiry according to the displayed reason. Tokens are held only in service memory; restarting requires authorization again. A new operator must use their own setup and login.

Saving a draft, authorizing an account, and approving a particular post are separate actions. Continue with steps 9–11 of the [user guide](MVP_USER_GUIDE.en.md) only when ready. **Confirm publication to LinkedIn** submits the selected saved version; it is not a connectivity test.
