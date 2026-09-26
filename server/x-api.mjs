import { setTimeout as delay } from 'node:timers/promises';
import { hash } from './content-validation.mjs';

const root = 'https://api.x.com/2';
const isId = value => typeof value === 'string' && /^[0-9]{1,19}$/.test(value);
export const xPostUrl = id => `https://x.com/i/web/status/${id}`;
export class XError extends Error {
  constructor(message, status = null) { super(message); this.status = status; }
}
const rejection = (stage, status) => `${stage}被 X 拒绝（HTTP ${status}）${status === 402 ? '：需要核对 API 额度；工作台不会购买额度。' : status === 429 ? '：已达到限流，未自动重试。' : '。'}`;

/** All POSTs are single attempts. Remote bodies and credentials never enter errors. */
export function createXApi({ fetchImpl = globalThis.fetch, timeoutMs = 30000, clock = Date.now, wait = ms => delay(ms) } = {}) {
  const controllers = new Set();
  let closed = false;
  async function request(path, options, stage) {
    if (closed) throw new XError('X 服务已关闭。');
    const controller = new AbortController(); controllers.add(controller);
    const timer = setTimeout(() => controller.abort(), timeoutMs); timer.unref?.();
    try {
      const response = await fetchImpl(`${root}${path}`, { ...options, redirect: 'error', signal: controller.signal });
      let size = 0; const chunks = [];
      if (response.body) for await (const chunk of response.body) {
        size += chunk.byteLength;
        if (size > 1024 * 1024) { controller.abort(); throw new Error(); }
        chunks.push(Buffer.from(chunk));
      }
      let data = null;
      try { data = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { /* Handle uncertain create response separately. */ }
      return { status: response.status, ok: response.ok, data };
    } catch { throw new XError(`${stage}网络中断或超时。`); }
    finally { clearTimeout(timer); controllers.delete(controller); }
  }
  function checked(response, stage) {
    if (!response.ok) throw new XError(rejection(stage, response.status), response.status);
    if (!response.data || (response.data.errors?.length)) throw new XError(`${stage}返回了无法验证的数据。`);
    return response.data;
  }
  const headers = token => ({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' });
  async function authorize({ code, verifier, clientId, clientSecret, redirectUri }) {
    const h = { 'Content-Type': 'application/x-www-form-urlencoded' };
    const body = new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri, code_verifier: verifier });
    if (clientSecret) h.Authorization = `Basic ${Buffer.from(`${encodeURIComponent(clientId)}:${encodeURIComponent(clientSecret)}`).toString('base64')}`;
    else body.set('client_id', clientId);
    const token = checked(await request('/oauth2/token', { method: 'POST', headers: h, body: body.toString() }, 'X OAuth'), 'X OAuth');
    if (typeof token.access_token !== 'string' || !token.access_token || token.access_token.length > 10000 || /[\r\n\0]/.test(token.access_token) || token.token_type?.toLowerCase() !== 'bearer' || !Number.isSafeInteger(token.expires_in) || token.expires_in < 1 || token.expires_in > 366 * 86400) throw new XError('X OAuth 凭证或有效期无效。');
    const profile = checked(await request('/users/me', { headers: headers(token.access_token) }, '读取 X 账号'), '读取 X 账号').data;
    if (!isId(profile?.id) || typeof profile?.name !== 'string' || !profile.name.trim() || profile.name.length > 120 || typeof profile?.username !== 'string' || !/^[a-zA-Z0-9_]{1,15}$/.test(profile.username)) throw new XError('无法验证 X 授权账号。');
    const received = typeof token.scope === 'string' && token.scope.length <= 2048 ? [...new Set(token.scope.split(' ').filter(Boolean))] : [];
    const scopes = received.every(scope => /^[a-z][a-z0-9.]{0,99}$/.test(scope)) ? received : [];
    return { token: token.access_token, expiresIn: token.expires_in, scopes, account: { id: profile.id, name: profile.name, username: profile.username } };
  }
  async function upload({ token, asset, bytes, altText, onUploaded = () => {}, isCancelled = () => false, assertCurrent = () => {} }) {
    const assertContinuation = () => {
      if (isCancelled() || closed) throw new XError('已取消后续 X 图片处理与发帖。');
      assertCurrent();
    };
    assertContinuation();
    const response = checked(await request('/media/upload', { method: 'POST', headers: headers(token), body: JSON.stringify({ media: bytes.toString('base64'), media_category: 'tweet_image' }) }, '上传 X 图片'), '上传 X 图片');
    let data = response.data;
    if (!isId(data?.id) || !Number.isSafeInteger(data?.expires_after_secs) || data.expires_after_secs < 1 || data.expires_after_secs > 366 * 86400) throw new XError('X 图片上传未返回有效媒体 ID 或有效期。');
    const media = { mediaId: data.id, mediaKey: typeof data.media_key === 'string' && /^[0-9_]{1,50}$/.test(data.media_key) ? data.media_key : null, mediaExpiresAt: new Date(clock() + data.expires_after_secs * 1000).toISOString() };
    onUploaded(media);
    assertContinuation();
    for (let poll = 0; data.processing_info; poll++) {
      const state = data.processing_info.state;
      if (state === 'succeeded') break;
      if (state === 'failed') throw new XError('X 图片处理失败，未提交帖子。');
      if (!['pending', 'in_progress'].includes(state) || poll >= 10) throw new XError('X 图片处理尚未确认完成，未提交帖子。');
      const seconds = data.processing_info.check_after_secs;
      if (!Number.isSafeInteger(seconds) || seconds < 0 || seconds > 60) throw new XError('X 图片处理等待时间无法验证，未提交帖子。');
      assertContinuation();
      await wait(Math.max(1, seconds) * 1000);
      assertContinuation();
      data = checked(await request(`/media/upload?media_id=${media.mediaId}&command=STATUS`, { headers: headers(token) }, '查询 X 图片处理'), '查询 X 图片处理').data;
      if (data?.id !== media.mediaId || !data.processing_info) throw new XError('X 图片处理状态与媒体 ID 无法核对。');
    }
    assertContinuation();
    if (Date.parse(media.mediaExpiresAt) <= clock()) throw new XError('X 图片已失效，未提交帖子。');
    if (typeof altText !== 'string' || altText.length > 1000 || !altText.trim()) throw new XError('X 图片需要有效的替代文字。');
    const meta = checked(await request('/media/metadata', { method: 'POST', headers: headers(token), body: JSON.stringify({ id: media.mediaId, metadata: { alt_text: { text: altText } } }) }, '设置 X 图片说明'), '设置 X 图片说明');
    if (meta.data?.id !== media.mediaId) throw new XError('X 图片说明写入结果无法核对，未提交帖子。');
    return media;
  }
  async function publish({ token, text, replyTo = null, mediaId = null, madeWithAi = false }) {
    const body = { text };
    if (replyTo) body.reply = { in_reply_to_tweet_id: replyTo };
    if (mediaId) { body.media = { media_ids: [mediaId] }; if (madeWithAi) body.made_with_ai = true; }
    let response;
    try { response = await request('/tweets', { method: 'POST', headers: headers(token), body: JSON.stringify(body) }, '提交 X 帖子'); }
    catch { return { status: 'unknown', platformId: null, platformTextHash: null, url: null, error: 'X 提交后网络中断或超时，平台可能已接收；结果未知，禁止自动重发。' }; }
    const id = isId(response.data?.data?.id) ? response.data.data.id : null;
    const platformTextHash = typeof response.data?.data?.text === 'string' ? hash(response.data.data.text) : null;
    if (response.status === 201 && id && platformTextHash && !response.data.errors?.length) return { status: 'published', platformId: id, platformTextHash, url: xPostUrl(id), error: null };
    if (!id && [400, 401, 402, 403, 404, 405, 413, 415, 422, 429].includes(response.status)) return { status: 'failed', platformId: null, platformTextHash: null, url: null, httpStatus: response.status, error: rejection('提交 X 帖子', response.status) };
    return { status: 'unknown', platformId: id, platformTextHash, url: id ? xPostUrl(id) : null, error: 'X 提交结果无法确认；已保留可用的平台 ID，禁止自动重发。' };
  }
  async function verify({ token, accountId, step, replyTo }) {
    if (!isId(step.platformId) || !step.platformTextHash) throw new XError('缺少可核对的平台 ID 或返回正文校验值，不能自动续发。');
    if (step.assetId && !step.mediaKey) throw new XError('已发图片缺少可核对的媒体键，不能自动续发。');
    const data = checked(await request(`/tweets/${step.platformId}?tweet.fields=author_id,referenced_tweets,attachments`, { headers: headers(token) }, '核对 X 已发帖子'), '核对 X 已发帖子').data;
    const replies = (data?.referenced_tweets ?? []).filter(ref => ref.type === 'replied_to');
    if (data?.id !== step.platformId || data.author_id !== accountId || typeof data.text !== 'string' || hash(data.text) !== step.platformTextHash || (replyTo ? replies.length !== 1 || replies[0].id !== replyTo : replies.length !== 0)) throw new XError('X 已发帖子与账号、正文或回复关系不一致，不能续发。');
    if (step.mediaKey && !(data.attachments?.media_keys ?? []).includes(step.mediaKey)) throw new XError('X 已发图片与记录不一致，不能续发。');
    return { status: 'published', platformId: step.platformId, platformTextHash: step.platformTextHash, url: xPostUrl(step.platformId), error: null };
  }
  return { authorize, upload, publish, verify, close() { closed = true; for (const c of controllers) c.abort(); } };
}
