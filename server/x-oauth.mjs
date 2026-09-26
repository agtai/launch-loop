import { bad } from './content-validation.mjs';
import { oauthLocale, workbenchOrigin } from './linkedin-oauth.mjs';
export { oauthLocale, workbenchOrigin };

export const xReturnUrl = (origin, connected = false) => `${workbenchOrigin(origin)}/#publishing${connected ? '?x=connected' : ''}`;
export function xOauthFailureHtml({ status, locale = 'zh', returnOrigin }) {
  const text = status === 401
    ? ['这次连接已过期、已使用或无法验证。请从工作台重新连接。', 'This connection expired, was already used, or could not be verified. Reconnect from the workbench.']
    : ['X 连接未完成。请核对应用权限、回调配置与网络，然后重新连接。', 'X connection was not completed. Check the app permissions, callback configuration and network, then reconnect.'];
  const url = xReturnUrl(returnOrigin);
  return `<!doctype html><html lang="${locale === 'en' ? 'en' : 'zh-CN'}"><head><meta charset="utf-8"><meta name="referrer" content="no-referrer"><title>X · Launch Loop</title></head><body><main><h1>X · Launch Loop</h1><p lang="zh-CN">${text[0]}</p><p lang="en">${text[1]}</p><p>未上传图片或发布帖子。 No image upload or post was made.</p><a href="${url}" rel="noreferrer">返回工作台 / Return to workbench</a></main></body></html>`;
}

export const xRequiredScopes = ['tweet.read', 'tweet.write', 'users.read', 'media.write'];
export function xConfiguration(env) {
  const clientId = env.X_CLIENT_ID || '', clientSecret = env.X_CLIENT_SECRET || '', redirectUri = env.X_REDIRECT_URI || '';
  const missing = [];
  if (!/^[a-zA-Z0-9_-]{1,300}$/.test(clientId)) missing.push('X_CLIENT_ID');
  if (clientSecret && (!clientSecret.trim() || clientSecret.length > 10000 || /[\r\n\0]/.test(clientSecret))) missing.push('X_CLIENT_SECRET');
  let redirect;
  try { redirect = new URL(redirectUri); } catch { /* Return field names only. */ }
  const validRedirect = redirect && redirectUri === redirectUri.trim() && !/[\\\u0000-\u0020\u007f]/.test(redirectUri) && redirect.protocol === 'https:' && !redirect.username && !redirect.password && !redirect.search && !redirect.hash && redirect.pathname === '/api/x/callback';
  if (!validRedirect) missing.push('X_REDIRECT_URI（HTTPS，路径 /api/x/callback）');
  return { clientId, clientSecret, redirectUri, scopes: [...xRequiredScopes], public: { configured: missing.length === 0, clientId: missing.includes('X_CLIENT_ID') ? null : clientId, redirectUri: validRedirect ? redirectUri : null, clientType: clientSecret ? 'confidential' : 'public', missing } };
}
