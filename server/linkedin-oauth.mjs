import { bad } from './content-validation.mjs';

// Origins come from the local request host, never from a client-provided return URL.
// URL parsing alone normalizes variants such as integer IPs and encoded hosts.
export function workbenchOrigin(value) {
  const match = typeof value === 'string' && /^http:\/\/(127\.0\.0\.1|localhost):([1-9][0-9]{0,4})$/.exec(value);
  if (!match || Number(match[2]) > 65535) bad('OAuth 返回地址必须是本机工作台。');
  return value;
}

export function workbenchReturnUrl(origin, connected = false) {
  return `${workbenchOrigin(origin)}/#publishing${connected ? '?linkedin=connected' : ''}`;
}

export function oauthLocale(value = 'zh') {
  if (!['zh', 'en'].includes(value)) bad('OAuth 界面语言无效。');
  return value;
}

// Fixed bilingual copy: no provider error, code, state or credential is reflected.
export function oauthFailureHtml({ status, locale = 'zh', returnOrigin }) {
  const messages = {
    400: ['LinkedIn 授权被取消或回调无效。请回到工作台重新连接。', 'LinkedIn authorization was cancelled or its callback was invalid. Return to the workbench and reconnect.'],
    401: ['这次连接已过期、已使用或无法验证。请从工作台重新连接。', 'This connection attempt has expired, was already used, or could not be verified. Reconnect from the workbench.'],
    409: ['这次连接已被断开或替换。请返回工作台查看当前连接状态。', 'This connection attempt was disconnected or replaced. Return to the workbench to check the current connection.'],
    502: ['无法完成 LinkedIn 授权或读取账号。请检查应用权限、回调配置与网络后重新连接。', 'LinkedIn authorization or account verification could not be completed. Check the app permissions, callback configuration and network, then reconnect.'],
    500: ['无法完成这次连接。请返回工作台查看状态并重新连接。', 'This connection could not be completed. Return to the workbench to check its status and reconnect.'],
  };
  const message = messages[status] || messages[500];
  const url = workbenchReturnUrl(returnOrigin);
  const zh = `<section lang="zh-CN"><h1>LinkedIn 连接未完成</h1><p>${message[0]}</p><p>这一步没有上传图片或发布帖子。</p><a href="${url}" rel="noreferrer">返回本机工作台</a></section>`;
  const en = `<section lang="en"><h1>LinkedIn connection incomplete</h1><p>${message[1]}</p><p>This step did not upload an image or publish a post.</p><a href="${url}" rel="noreferrer">Return to the local workbench</a></section>`;
  return `<!doctype html><html lang="${locale === 'en' ? 'en' : 'zh-CN'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><title>LinkedIn · Launch Loop</title><style>body{font-family:system-ui,sans-serif;max-width:48rem;margin:10vh auto;padding:0 1.5rem;color:#182c2b;background:#f8faf9}section{padding:1.5rem 0}section+section{border-top:1px solid #c8d7d3}h1{font-size:1.5rem}p{line-height:1.7}a{color:#006857;font-weight:600}</style></head><body><main>${locale === 'en' ? en + zh : zh + en}</main></body></html>`;
}
