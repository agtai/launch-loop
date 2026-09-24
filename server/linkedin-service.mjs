import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import * as v from './content-validation.mjs';
import { createLinkedInApi, LinkedInError } from './linkedin-api.mjs';

const requiredScopes = ['openid', 'profile', 'w_member_social'];
const now = () => Date.now();
function equal(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const left = Buffer.from(a), right = Buffer.from(b);
  // Equal JavaScript string lengths do not imply equal UTF-8 byte lengths.
  return left.length === right.length && timingSafeEqual(left, right);
}
const asExpected = error => v.bad(error instanceof LinkedInError ? error.message : 'LinkedIn 操作失败；没有自动重试。', 502);
function configuration(env) {
  const clientId = env.LINKEDIN_CLIENT_ID || '', clientSecret = env.LINKEDIN_CLIENT_SECRET || '', redirectUri = env.LINKEDIN_REDIRECT_URI || '';
  const apiVersion = env.LINKEDIN_API_VERSION || '202609';
  const scopes = [...new Set((env.LINKEDIN_SCOPES || requiredScopes.join(' ')).split(/[ ,]+/).filter(Boolean))];
  const missing = [];
  if (!/^[a-zA-Z0-9_-]{1,200}$/.test(clientId)) missing.push('LINKEDIN_CLIENT_ID');
  if (!clientSecret || clientSecret.length > 10000 || /[\r\n\0]/.test(clientSecret)) missing.push('LINKEDIN_CLIENT_SECRET');
  let redirect;
  try { redirect = new URL(redirectUri); } catch { /* Report configuration without disclosing credentials. */ }
  const validRedirect = redirect && redirect.protocol === 'https:' && !redirect.username && !redirect.password && !redirect.search && !redirect.hash && redirect.pathname === '/api/linkedin/callback';
  if (!validRedirect) missing.push('LINKEDIN_REDIRECT_URI（HTTPS，路径 /api/linkedin/callback）');
  if (!/^20[0-9]{2}(0[1-9]|1[0-2])$/.test(apiVersion)) missing.push('LINKEDIN_API_VERSION（YYYYMM）');
  if (requiredScopes.some(scope => !scopes.includes(scope)) || scopes.some(scope => ![...requiredScopes, 'r_member_social'].includes(scope))) missing.push('LINKEDIN_SCOPES');
  return { clientId, clientSecret, redirectUri, apiVersion, scopes, public: { configured: missing.length === 0, clientId: /^[a-zA-Z0-9_-]{1,200}$/.test(clientId) ? clientId : null, redirectUri: validRedirect ? redirectUri : null, apiVersion, missing } };
}

export function createLinkedInService({ store, content, env = process.env, fetchImpl = globalThis.fetch, clock = now, timeoutMs = 30000 }) {
  const config = configuration(env), api = createLinkedInApi({ fetchImpl, apiVersion: config.apiVersion, timeoutMs });
  let session = null, pending = null, authGeneration = 0, closed = false;
  const previews = new Map(), work = new Set();
  function connection() {
    const base = { account: session?.account ?? null, scopes: session ? [...session.scopes] : [], canPublish: false, config: { ...config.public, missing: [...config.public.missing] } };
    if (!config.public.configured) return { ...base, status: 'unconfigured', message: '尚未配置 LinkedIn 官方应用。需在服务端设置应用凭据及已注册的 HTTPS 回调；只将回调路径代理到本机，勿公开工作台。' };
    if (!session) return { ...base, status: 'disconnected', message: '尚未连接 LinkedIn。授权凭证只保存在本次服务内存，重启后需重新登录。' };
    if (session.problem === 401) return { ...base, status: 'expired', message: 'LinkedIn 已拒绝当前凭证（HTTP 401），请重新连接。' };
    if (session.problem === 403) return { ...base, status: 'missing_permissions', message: 'LinkedIn 已拒绝实际操作权限（HTTP 403），请核对应用产品与账号权限后重新连接。' };
    if (session.expiresAt <= clock()) return { ...base, status: 'expired', message: 'LinkedIn 授权已过期，请重新连接。' };
    if (requiredScopes.some(scope => !session.scopes.includes(scope))) return { ...base, status: 'missing_permissions', message: '已取得账号资料，但 OAuth 返回的权限未包含 openid、profile、w_member_social；不能发布。请检查应用获准产品后重新授权。' };
    return { ...base, status: 'connected', canPublish: true, message: 'OAuth 已返回发布权限并验证账号；接口实际可用性仍以平台响应为准。仅支持个人普通动态与单张 PNG/JPEG。重启需重新登录。' };
  }
  function connected() {
    if (closed) v.bad('发布服务已关闭。', 503);
    if (!connection().canPublish) v.bad(connection().message, 409);
    return session;
  }
  function startAuth() {
    if (closed) v.bad('发布服务已关闭。', 503);
    if (!config.public.configured) v.bad(connection().message, 409);
    store.assertCanRestore();
    session = null; previews.clear(); authGeneration++;
    const state = randomBytes(32).toString('base64url');
    pending = { state, expiresAt: clock() + 10 * 60 * 1000, generation: authGeneration };
    const url = new URL('https://www.linkedin.com/oauth/v2/authorization');
    url.search = new URLSearchParams({ response_type: 'code', client_id: config.clientId, redirect_uri: config.redirectUri, state, scope: config.scopes.join(' ') }).toString();
    return { authorizationUrl: url.href };
  }
  async function callback(input) {
    const params = input instanceof URLSearchParams ? input : new URLSearchParams(input);
    if (params.getAll('state').length !== 1 || !pending || pending.expiresAt <= clock() || !equal(params.get('state'), pending.state)) v.bad('OAuth state 无效、已使用或已过期；请从工作台重新连接。', 401);
    const generation = pending.generation; pending = null;
    if (params.has('error')) v.bad('LinkedIn 登录或授权已取消；未建立连接。', 400);
    const code = params.get('code');
    if (params.getAll('code').length !== 1 || typeof code !== 'string' || !code || code.length > 10000 || /[\r\n\0]/.test(code)) v.bad('OAuth 回调缺少有效授权码。');
    try {
      const result = await api.authorize({ code, clientId: config.clientId, clientSecret: config.clientSecret, redirectUri: config.redirectUri });
      if (closed || generation !== authGeneration) v.bad('OAuth 连接请求已被断开或替换，请重新连接。', 409);
      session = { ...result, id: randomUUID(), expiresAt: clock() + result.expiresIn * 1000 };
      return connection();
    } catch (error) { if (error instanceof v.ContentError) throw error; asExpected(error); }
  }
  function disconnect() { authGeneration++; session = null; pending = null; previews.clear(); return connection(); }
  function savedPayload(itemId, versionId) {
    v.id(itemId); v.id(versionId);
    const version = content.version(itemId, versionId), draft = version.content;
    if (draft.platform !== 'linkedin') v.bad('本阶段只支持 LinkedIn 普通动态发布。');
    const documents = draft.documents.filter(document => document.kind === 'linkedin_post');
    if (documents.length !== 1) v.bad('请选择恰好包含一份 LinkedIn 普通动态的已确认版本；Pulse 长文和多个动态尚未适配。');
    const document = documents[0];
    const body = [document.title, ...document.blocks.map(block => block.text)].filter(part => part.trim()).join('\n\n');
    if (!body.trim() || body.length > 3000) v.bad('最终动态正文（含标题）须为 1–3000 个字符；请修改并确认保存新版本。');
    // Source documents are retained as materials but never silently uploaded as media.
    const assets = version.assets.filter(asset => draft.assetIds.includes(asset.id) && asset.mimeType.startsWith('image/'));
    if (assets.length > 1 || assets.some(asset => !['image/png', 'image/jpeg'].includes(asset.mimeType))) v.bad('当前只支持最多一张 PNG 或 JPEG 配图；请在创作中调整后确认新版本。');
    const binary = assets.map(asset => {
      const result = content.getAsset(itemId, versionId, asset.id);
      if (v.hash(result.bytes) !== asset.sha256 || result.bytes.length !== asset.byteLength) v.bad('正式图片字节与版本校验值不一致。', 409);
      const png = result.bytes.length >= 24 && result.bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
      const jpg = result.bytes.length >= 4 && result.bytes[0] === 255 && result.bytes[1] === 216 && result.bytes[2] === 255;
      if ((asset.mimeType === 'image/png' && !png) || (asset.mimeType === 'image/jpeg' && !jpg)) v.bad('图片实际字节与 PNG/JPEG 类型不符，未上传。');
      return { asset, bytes: result.bytes };
    });
    const warnings = ['发布范围：PUBLIC 普通动态。确认保存不等于确认发布。'];
    if (document.title.trim()) warnings.push('该动态标题将作为正文首段发布。');
    if (draft.documents.length > 1) warnings.push('本次仅发布普通动态；版本内的 Pulse 长文等其他部分不会发布。');
    if (draft.assetIds.length > assets.length) warnings.push('非图片资料不作为帖子附件上传。');
    if (assets.length) warnings.push('当前写权限不保证可读取图片处理状态；平台仍可能拒绝或延迟显示配图。');
    if (!assets.length) warnings.push('本次为纯文字动态，没有实际配图。');
    const contentHash = v.hash(JSON.stringify({ body, assets: assets.map(asset => ({ sha256: asset.sha256, mimeType: asset.mimeType, byteLength: asset.byteLength })) }));
    return { body, assets, binary, language: draft.language, contentHash, warnings };
  }
  function preview(raw) {
    v.fields(raw, ['itemId', 'versionId', 'accountId']);
    const current = connected();
    if (v.id(raw.accountId) !== current.account.id) v.bad('所选发布账号与当前授权账号不一致。', 409);
    const payload = savedPayload(raw.itemId, raw.versionId);
    for (const [id, value] of previews) if (value.expiresAt <= clock()) previews.delete(id);
    if (previews.size >= 100) v.bad('待确认预览过多，请等待旧预览过期后再试。', 429);
    const id = randomUUID(), confirmationToken = randomBytes(32).toString('base64url'), expiresAt = clock() + 10 * 60 * 1000;
    const result = { id, itemId: raw.itemId, versionId: raw.versionId, accountId: current.account.id, accountName: current.account.name, language: payload.language, body: payload.body, assets: payload.assets.map(asset => ({ ...asset, url: `/api/content/${raw.itemId}/versions/${raw.versionId}/assets/${asset.id}` })), contentHash: payload.contentHash, confirmationToken, expiresAt: new Date(expiresAt).toISOString(), warnings: payload.warnings };
    // No body or token reaches SQLite. Only immutable pointers and digests are durable.
    previews.set(id, { ...result, body: undefined, assets: undefined, confirmationToken: undefined, confirmationHash: v.hash(confirmationToken), expiresAt, epoch: store.epoch(), sessionId: current.id });
    return result;
  }
  function validatePreview(value) {
    const current = connected();
    if (current.id !== value.sessionId || current.account.id !== value.accountId || value.epoch !== store.epoch() || value.expiresAt <= clock()) v.bad('发布预览已过期、账号已改变或数据已恢复，请重新预览并确认。', 409);
    const payload = savedPayload(value.itemId, value.versionId);
    if (payload.contentHash !== value.contentHash || payload.language !== value.language) v.bad('正式版本或图片与发布预览不一致，请重新预览。', 409);
    return { current, payload };
  }
  async function run(record, value) {
    let posting = false, remoteResult = null;
    try {
      let { current, payload } = validatePreview(value), image;
      if (payload.binary.length) image = await api.upload({ token: current.token, account: current.account, ...payload.binary[0] });
      ({ current, payload } = validatePreview(value));
      posting = true;
      const { httpStatus, ...result } = await api.publish({ token: current.token, account: current.account, body: payload.body, image });
      if ([401, 403].includes(httpStatus) && session?.id === value.sessionId) session.problem = httpStatus;
      remoteResult = result;
      store.finish(record.id, result);
    } catch (error) {
      // Never persist remote response bodies, OAuth credentials or content in errors.
      const errorText = posting ? '提交后的本地记录操作未完成；结果未知，请先核对，禁止自动重发。' : error instanceof LinkedInError ? error.message : error instanceof v.ContentError ? error.message.slice(0, 180) : '图片准备或发布校验失败；尚未提交帖子。';
      if (error instanceof LinkedInError && [401, 403].includes(error.status) && session?.id === value.sessionId) session.problem = error.status;
      // Retry only local persistence, preserving a real ID already returned by LinkedIn.
      // If storage remains unavailable the durable submitting guard survives restart.
      try { store.finish(record.id, remoteResult ?? { status: posting ? 'unknown' : 'failed', platformId: null, url: null, error: errorText }); } catch { /* Keep durable submitting guard; restart converts to unknown. */ }
    }
  }
  function execute(raw) {
    v.fields(raw, ['previewId', 'confirmationToken', 'confirmed']);
    if (raw.confirmed !== true) v.bad('必须单独明确确认本次发布。');
    v.id(raw.previewId);
    if (typeof raw.confirmationToken !== 'string' || !/^[a-zA-Z0-9_-]{43}$/.test(raw.confirmationToken)) v.bad('发布确认凭证无效。', 403);
    const confirmationHash = v.hash(raw.confirmationToken);
    const previous = store.byPreview(raw.previewId, confirmationHash);
    if (previous) return previous;
    const value = previews.get(raw.previewId);
    if (!value || !equal(value.confirmationHash, confirmationHash)) v.bad('发布预览不存在或确认凭证不匹配；请重新预览。', 409);
    const started = store.begin({ itemId: value.itemId, versionId: value.versionId, accountId: value.accountId, accountName: value.accountName, language: value.language, contentHash: value.contentHash, previewId: value.id, confirmationHash }, () => validatePreview(value));
    if (started.created) {
      const promise = run(started.record, value); work.add(promise); promise.finally(() => work.delete(promise));
    }
    return started.record;
  }
  async function reconcile(id) {
    const record = store.get(id);
    if (!record.platformId) v.bad('该记录没有已知平台 ID，无法自动核对；请在 LinkedIn 人工查看。系统不会重新发帖。', 409);
    if (record.status === 'published') return record;
    const current = connected();
    if (current.account.id !== record.accountId) v.bad('请连接该发布记录对应的账号后再核对。', 409);
    if (!current.scopes.includes('r_member_social')) v.bad('当前授权没有受限的 r_member_social 读取权限；请在 LinkedIn 人工核对。发布权限不代表读取权限。', 403);
    try { return store.finish(id, await api.reconcile({ token: current.token, account: current.account, id: record.platformId })); }
    catch (error) { if (error instanceof v.ContentError) throw error; asExpected(error); }
  }
  return { connection, startAuth, callback, disconnect, preview, execute, reconcile, list: store.list, get: store.get, async close() { closed = true; disconnect(); api.close(); await Promise.allSettled([...work]); } };
}
