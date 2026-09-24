import { bad } from './content-validation.mjs';
import { postId, postUrl } from './publishing-store.mjs';

const apiRoot = 'https://api.linkedin.com';
const knownPostId = value => { try { return postId(value); } catch { return null; } };
function grantedScopes(value) {
  // LinkedIn documents this token-response field as URL-encoded. Missing or
  // malformed values must not inherit the scopes requested by the application.
  if (typeof value !== 'string' || value.length > 2048) return [];
  let decoded;
  try { decoded = decodeURIComponent(value.replace(/\+/g, ' ')); } catch { return []; }
  const scopes = [...new Set(decoded.split(/[ ,]+/).filter(Boolean))];
  return scopes.every(scope => /^[a-z][a-z0-9_]{0,99}$/.test(scope)) ? scopes : [];
}
export class LinkedInError extends Error {
  constructor(message, status = null) { super(message); this.status = status; }
}

/** No automatic retry: a failed response to a POST may conceal a committed post. */
export function createLinkedInApi({ fetchImpl = globalThis.fetch, apiVersion, timeoutMs = 30000 }) {
  const controllers = new Set();
  async function request(url, options, stage, readResponse = true) {
    const controller = new AbortController(); controllers.add(controller);
    const timer = setTimeout(() => controller.abort(), timeoutMs); timer.unref?.();
    try {
      const response = await fetchImpl(url, { ...options, redirect: 'error', signal: controller.signal });
      if (!readResponse) { response.body?.cancel().catch(() => {}); return response; }
      let length = 0; const chunks = [];
      if (response.body) for await (const chunk of response.body) {
        length += chunk.byteLength;
        if (length > 1024 * 1024) { controller.abort(); throw new Error(); }
        chunks.push(Buffer.from(chunk));
      }
      const text = Buffer.concat(chunks).toString('utf8');
      return { ok: response.ok, status: response.status, headers: response.headers, text: async () => text };
    }
    catch { throw new LinkedInError(`${stage}网络中断或超时。`); }
    finally { clearTimeout(timer); controllers.delete(controller); }
  }
  async function json(response, stage) {
    if (!response.ok) throw new LinkedInError(`${stage}被 LinkedIn 拒绝（HTTP ${response.status}）。`, response.status);
    try {
      const text = await response.text();
      if (Buffer.byteLength(text) > 1024 * 1024) throw new Error();
      return JSON.parse(text);
    } catch { throw new LinkedInError(`${stage}返回了无法验证的数据。`); }
  }
  const headers = token => ({ Authorization: `Bearer ${token}`, 'LinkedIn-Version': apiVersion, 'X-Restli-Protocol-Version': '2.0.0', 'Content-Type': 'application/json' });
  async function authorize({ code, clientId, clientSecret, redirectUri }) {
    const response = await request('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'authorization_code', code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri }).toString(),
    }, 'OAuth 换取凭证');
    const token = await json(response, 'OAuth 换取凭证');
    if (typeof token.access_token !== 'string' || !token.access_token || token.access_token.length > 10000 || /[\r\n\0]/.test(token.access_token) || !Number.isSafeInteger(token.expires_in) || token.expires_in < 1 || token.expires_in > 366 * 86400) throw new LinkedInError('OAuth 凭证或有效期无效。');
    const profile = await json(await request(`${apiRoot}/v2/userinfo`, { headers: { Authorization: `Bearer ${token.access_token}` } }, '读取授权账号'), '读取授权账号');
    if (typeof profile.sub !== 'string' || !/^[-a-zA-Z0-9_]{1,120}$/.test(profile.sub) || typeof profile.name !== 'string' || !profile.name.trim() || profile.name.length > 120) throw new LinkedInError('无法验证授权账号的 ID 与姓名。');
    const scopes = grantedScopes(token.scope);
    return { token: token.access_token, expiresIn: token.expires_in, scopes, account: { id: profile.sub, name: profile.name, urn: `urn:li:person:${profile.sub}` } };
  }
  async function upload({ token, account, asset, bytes }) {
    const result = await json(await request(`${apiRoot}/rest/images?action=initializeUpload`, {
      method: 'POST', headers: headers(token), body: JSON.stringify({ initializeUploadRequest: { owner: account.urn } }),
    }, '初始化图片上传'), '初始化图片上传');
    const value = result?.value;
    if (typeof value?.image !== 'string' || !/^urn:li:image:[a-zA-Z0-9_-]{1,160}$/.test(value.image)) throw new LinkedInError('图片上传初始化未返回有效 Image URN。');
    let url;
    try { url = new URL(value.uploadUrl); } catch { throw new LinkedInError('图片上传地址无效。'); }
    // Only send the credential to LinkedIn's documented upload host. No redirects.
    if (url.protocol !== 'https:' || url.hostname !== 'www.linkedin.com' || url.port || url.username || url.password || !url.pathname.startsWith('/dms-uploads/')) throw new LinkedInError('图片上传地址不在允许的 LinkedIn 上传路径。');
    const uploaded = await request(url.href, { method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': asset.mimeType }, body: bytes }, '上传图片', false);
    if (!uploaded.ok) throw new LinkedInError(`图片上传失败（HTTP ${uploaded.status}）。`, uploaded.status);
    return value.image;
  }
  async function publish({ token, account, body, image }) {
    const payload = { author: account.urn, commentary: body, visibility: 'PUBLIC', distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] }, lifecycleState: 'PUBLISHED', isReshareDisabledByAuthor: false };
    if (image) payload.content = { media: { id: image } };
    let response;
    try { response = await request(`${apiRoot}/rest/posts`, { method: 'POST', headers: headers(token), body: JSON.stringify(payload) }, '提交帖子', false); }
    catch { return { status: 'unknown', platformId: null, url: null, error: '提交后网络中断或超时，平台可能已接收。结果未知；请先到 LinkedIn 核对，禁止自动重发。' }; }
    const id = knownPostId(response.headers.get('x-restli-id'));
    if (response.status === 201 && id) return { status: 'published', platformId: id, url: postUrl(id), error: null };
    if (!id && [400, 401, 403, 404, 405, 413, 415, 422, 429].includes(response.status)) return { status: 'failed', platformId: null, url: null, httpStatus: response.status, error: `LinkedIn 明确拒绝本次提交（HTTP ${response.status}）。修复权限或内容后，需新建预览并重新确认。` };
    return { status: 'unknown', platformId: id, url: null, error: `LinkedIn 提交结果无法确认（HTTP ${response.status}${id ? '，已保留平台 ID' : '，无有效平台 ID'}）。请先核对，禁止自动重发。` };
  }
  async function reconcile({ token, account, id }) {
    postId(id);
    const result = await json(await request(`${apiRoot}/rest/posts/${encodeURIComponent(id)}?viewContext=AUTHOR`, { headers: headers(token) }, '核对帖子'), '核对帖子');
    if (result.id !== id || result.author !== account.urn || result.lifecycleState !== 'PUBLISHED') bad('平台结果尚未确认该账号的帖子已发布；保留原状态，不会重发。', 409);
    return { status: 'published', platformId: id, url: postUrl(id), error: null };
  }
  return { authorize, upload, publish, reconcile, close() { for (const controller of controllers) controller.abort(); } };
}
