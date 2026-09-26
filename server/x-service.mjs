import { randomBytes, randomUUID, timingSafeEqual, createHash } from 'node:crypto';
import * as v from './content-validation.mjs';
import { countXText, validateXDocument } from './x-text.mjs';
import { assertXImagePublishable, inspectXImage } from './x-images.mjs';
import { createXApi, XError } from './x-api.mjs';
import { xConfiguration, xRequiredScopes, oauthLocale, workbenchOrigin } from './x-oauth.mjs';

const equal = (a, b) => typeof a === 'string' && typeof b === 'string' && Buffer.byteLength(a) === Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const safeFailure = error => error instanceof XError || error instanceof v.ContentError ? error.message.slice(0, 180) : 'X 操作未完成；没有自动重试。';

export function createXService({ store, content, env = process.env, fetchImpl = globalThis.fetch, clock = Date.now, timeoutMs = 30000, wait } = {}) {
  const config = xConfiguration(env), api = createXApi({ fetchImpl, clock, timeoutMs, wait });
  let session = null, pending = null, authGeneration = 0, closed = false;
  const previews = new Map(), work = new Map();
  function connection() {
    const base = { account: session?.account ?? null, scopes: session ? [...session.scopes] : [], canPublish: false, config: { ...config.public, missing: [...config.public.missing] }, billing: 'pay_per_use_unverified', media: 'single_image_first_post' };
    if (!config.public.configured) return { ...base, status: 'unconfigured', message: '尚未配置 X 官方应用。需要 Client ID、注册的 HTTPS 回调；服务端机密客户端还需要 Client Secret。API 额度与权限未核验。' };
    if (!session) return { ...base, status: 'disconnected', message: '尚未连接 X。OAuth 凭证仅保存在服务内存；重启后需重新授权。' };
    if (session.problem === 401 || session.expiresAt <= clock()) return { ...base, status: 'expired', message: 'X 授权已过期或被拒绝，请重新连接。' };
    if (session.problem === 403 || xRequiredScopes.some(scope => !session.scopes.includes(scope))) return { ...base, status: 'missing_permissions', message: 'X 实际授权缺少发帖或媒体权限，请核对应用权限后重新连接。' };
    return { ...base, status: 'connected', canPublish: true, message: 'X 已验证授权账号和返回的权限。API 计费、额度与实际发帖可用性仍以平台响应为准。' };
  }
  function connected() { if (closed) v.bad('X 服务已关闭。', 503); if (!connection().canPublish) v.bad(connection().message, 409); return session; }
  function noteAuthError(error, id) { if ([401, 403].includes(error?.status ?? error?.httpStatus) && session?.id === id) session.problem = error.status ?? error.httpStatus; }
  function startAuth({ returnOrigin = null, locale = 'zh' } = {}) {
    if (closed) v.bad('X 服务已关闭。', 503);
    if (!config.public.configured) v.bad(connection().message, 409);
    const browser = { origin: returnOrigin === null ? null : workbenchOrigin(returnOrigin), locale: oauthLocale(locale) };
    store.assertCanRestore();
    session = null; previews.clear(); authGeneration++;
    const state = randomBytes(32).toString('base64url'), verifier = randomBytes(48).toString('base64url');
    pending = { state, verifier, browser, generation: authGeneration, expiresAt: clock() + 10 * 60 * 1000 };
    const url = new URL('https://x.com/i/oauth2/authorize');
    url.search = new URLSearchParams({ response_type: 'code', client_id: config.clientId, redirect_uri: config.redirectUri, scope: config.scopes.join(' '), state, code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256' }).toString();
    return { authorizationUrl: url.href };
  }
  async function exchange(input, onContext) {
    const params = input instanceof URLSearchParams ? input : new URLSearchParams(input);
    if (params.getAll('state').length !== 1 || !pending || pending.expiresAt <= clock() || !equal(params.get('state'), pending.state)) v.bad('X OAuth state 无效、已使用或已过期，请重新连接。', 401);
    const attempt = pending; pending = null; onContext?.(attempt.browser);
    if (params.has('error')) v.bad('X 授权已取消，未建立连接。');
    const code = params.get('code');
    if (params.getAll('code').length !== 1 || typeof code !== 'string' || !code || code.length > 10000 || /[\r\n\0]/.test(code)) v.bad('X OAuth 回调缺少有效授权码。');
    try {
      const result = await api.authorize({ code, verifier: attempt.verifier, ...config });
      if (closed || authGeneration !== attempt.generation) v.bad('X 授权请求已被断开或替换。', 409);
      session = { ...result, id: randomUUID(), expiresAt: clock() + result.expiresIn * 1000 };
      return connection();
    } catch (error) { if (error instanceof v.ContentError) throw error; v.bad(safeFailure(error), 502); }
  }
  const callback = input => exchange(input);
  async function browserCallback(input) {
    let browser = null;
    try {
      const result = await exchange(input, context => { browser = context; });
      if (!browser?.origin) return { ok: false, status: 500, returnOrigin: null, locale: 'zh' };
      return { ok: true, status: 303, connection: result, returnOrigin: browser.origin, locale: browser.locale };
    } catch (error) { return { ok: false, status: error instanceof v.ContentError ? error.status : 500, returnOrigin: browser?.origin ?? null, locale: browser?.locale ?? 'zh' }; }
  }
  function disconnect() {
    for (const id of work.keys()) store.cancel(id);
    session = null; pending = null; authGeneration++; previews.clear();
    return connection();
  }
  function savedPayload(itemId, versionId, documentId, accountId) {
    for (const value of [itemId, versionId, documentId]) v.id(value);
    const version = content.version(itemId, versionId), draft = version.content;
    if (draft.platform !== 'x') v.bad('请选择已确认保存的 X 版本。');
    const document = draft.documents.find(doc => doc.id === documentId);
    if (!document) v.bad('所选内容对象不在该正式版本内。');
    const issues = validateXDocument(document);
    if (issues.length) v.bad(issues.join(' ').slice(0, 400));
    try { assertXImagePublishable(document, version.assets); } catch (error) { v.bad(error.message, 409); }
    const steps = document.blocks.map((block, index) => {
      const assetIds = block.assetIds ?? [];
      if (assetIds.length > 1 || (index > 0 && assetIds.length)) v.bad('X 首版仅支持普通帖单图或串帖首帖单图。');
      const binary = assetIds.map(id => {
        const asset = version.assets.find(value => value.id === id);
        if (!asset || !draft.assetIds.includes(id)) v.bad('X 帖子引用的图片不在正式版本内。');
        const result = content.getAsset(itemId, versionId, id);
        try {
          const inspected = inspectXImage(result.bytes, asset.mimeType);
          if (inspected.sha256 !== asset.sha256 || inspected.byteLength !== asset.byteLength || block.image?.language !== draft.language) v.bad('X 图片字节或语言与正式版本关联不一致。', 409);
        } catch (error) { if (error instanceof v.ContentError) throw error; v.bad('X 图片实际格式或字节无效。'); }
        return { asset, bytes: result.bytes };
      });
      const image = binary.length ? { altText: block.image.altText, generated: block.image.generated, binding: block.image } : null;
      const metadataHash = v.hash(JSON.stringify(image));
      const contentHash = v.hash(JSON.stringify({ text: block.text, assets: binary.map(({ asset }) => ({ hash: asset.sha256, mimeType: asset.mimeType, byteLength: asset.byteLength })), altText: image?.altText ?? null, generated: image?.generated ?? false }));
      return { blockId: block.id, index, text: block.text, weightedLength: countXText(block.text).weightedLength, textHash: v.hash(block.text), assetId: binary[0]?.asset.id ?? null, assetHash: binary[0]?.asset.sha256 ?? null, metadataHash, contentHash, binary, image };
    });
    const contentHash = v.hash(JSON.stringify(steps.map(step => step.contentHash)));
    const planHash = v.hash(JSON.stringify({ itemId, versionId, documentId, accountId, language: draft.language, kind: document.kind, steps: steps.map(({ blockId, text, metadataHash, binary }) => ({ blockId, text, metadataHash, assets: binary.map(({ asset }) => ({ id: asset.id, hash: asset.sha256, mimeType: asset.mimeType, byteLength: asset.byteLength })) })) }));
    return { steps, contentHash, planHash, language: draft.language, kind: document.kind, itemRevision: content.item(itemId).revision };
  }
  function validatePreview(value, checkResume = true) {
    const current = connected();
    if (current.id !== value.sessionId || current.account.id !== value.accountId || value.epoch !== store.epoch() || value.expiresAt <= clock()) v.bad('X 发布预览已过期、账号已改变或数据已恢复，请重新预览并确认。', 409);
    const payload = savedPayload(value.itemId, value.versionId, value.documentId, value.accountId);
    if (payload.planHash !== value.planHash) v.bad('X 文字、顺序或图片与预览不一致，请重新预览。', 409);
    if (payload.itemRevision !== value.itemRevision) v.bad('X 作品已保存新版本，请重新选择版本并确认预览。', 409);
    if (checkResume && value.resumeRecordId && store.get(value.resumeRecordId).revision !== value.expectedRevision) v.bad('X 续发记录已变化，请重新预览并确认。', 409);
    return { current, payload };
  }
  async function preview(raw) {
    v.fields(raw, ['itemId', 'versionId', 'documentId', 'accountId'], ['resumeRecordId']);
    const current = connected();
    if (raw.accountId !== current.account.id) v.bad('所选 X 账号与实际授权账号不一致。', 409);
    const payload = savedPayload(raw.itemId, raw.versionId, raw.documentId, raw.accountId), epoch = store.epoch();
    let resume = null;
    if (raw.resumeRecordId) {
      resume = store.get(raw.resumeRecordId);
      if (resume.active || resume.status === 'published' || resume.steps.some(step => ['unknown', 'submitting'].includes(step.status))) v.bad('X 发布仍在执行、已完成或含未知结果，不能续发。', 409);
      if (resume.accountId !== current.account.id || resume.planHash !== payload.planHash) v.bad('X 续发必须保留原账号、版本、内容对象、文字顺序和图片。', 409);
      try { for (const step of resume.steps) if (step.status === 'published') await api.verify({ token: current.token, accountId: current.account.id, step, replyTo: step.index ? resume.steps[step.index - 1].platformId : null }); }
      catch (error) { noteAuthError(error, current.id); v.bad(safeFailure(error), 409); }
      if (store.get(resume.id).revision !== resume.revision) v.bad('X 已发部分核对期间记录变化，请重新预览。', 409);
    }
    if (session?.id !== current.id || epoch !== store.epoch()) v.bad('X 核对期间账号或数据变化，请重新预览。', 409);
    for (const [id, value] of previews) if (value.expiresAt <= clock()) previews.delete(id);
    if (previews.size >= 100) v.bad('X 待确认预览过多，请稍后再试。', 429);
    const id = randomUUID(), confirmationToken = randomBytes(32).toString('base64url'), expiresAt = clock() + 10 * 60 * 1000;
    const { resumeRecordId, ...pointers } = raw;
    const result = { ...pointers, id, account: current.account, accountName: current.account.name, language: payload.language, kind: payload.kind, planHash: payload.planHash, confirmationToken, expiresAt: new Date(expiresAt).toISOString(), resumeRecordId: resume?.id ?? null, warnings: ['确认将通过 X 官方 API 上传所选图片并逐条发帖，可能产生 API 费用。', '只发布当前选定内容对象和语言；串帖中途失败会保留成功部分。'], steps: payload.steps.map(step => ({ blockId: step.blockId, index: step.index, text: step.text, weightedLength: step.weightedLength, assets: step.binary.map(({ asset }) => ({ ...asset, url: `/api/content/${raw.itemId}/versions/${raw.versionId}/assets/${asset.id}`, altText: step.image.altText, generated: step.image.generated })), alreadyPublished: resume?.steps[step.index].status === 'published', platformId: resume?.steps[step.index].platformId ?? null })) };
    previews.set(id, { ...pointers, id, planHash: payload.planHash, contentHash: payload.contentHash, language: payload.language, kind: payload.kind, accountName: current.account.name, itemRevision: payload.itemRevision, expiresAt, epoch, sessionId: current.id, confirmationHash: v.hash(confirmationToken), resumeRecordId: resume?.id ?? null, expectedRevision: resume?.revision ?? null });
    return result;
  }
  async function run(record, value) {
    let index = -1, posting = false, remoteResult = null;
    try {
      for (index = 0; index < record.steps.length; index++) {
        posting = false; remoteResult = null;
        const latest = store.get(record.id);
        if (latest.steps[index].status === 'published') continue;
        if (latest.cancelRequested || closed) break;
        let { current, payload } = validatePreview(value, false), step = payload.steps[index], media = null;
        const replyTo = index ? latest.steps[index - 1].platformId : null;
        if (index && latest.steps[index - 1].status !== 'published') break;
        if (step.binary.length) {
          store.setStep(record.id, index, { status: 'uploading', phase: 'media', replyTo });
          media = await api.upload({ token: current.token, ...step.binary[0], altText: step.image.altText, isCancelled: () => closed || store.get(record.id).cancelRequested, assertCurrent: () => validatePreview(value, false), onUploaded: result => store.setStep(record.id, index, result) });
        }
        if (closed || store.get(record.id).cancelRequested) break;
        ({ current, payload } = validatePreview(value, false)); step = payload.steps[index];
        if (media && Date.parse(media.mediaExpiresAt) <= clock()) v.bad('X 图片已失效，请新建预览并确认续发。', 409);
        store.setStep(record.id, index, { status: 'submitting', phase: 'post', replyTo, ...(media ?? {}) });
        posting = true;
        const { httpStatus, ...result } = await api.publish({ token: current.token, text: step.text, replyTo, mediaId: media?.mediaId ?? null, madeWithAi: step.image?.generated ?? false });
        noteAuthError({ httpStatus }, current.id);
        remoteResult = { ...result, phase: result.status === 'published' ? 'done' : 'post' };
        store.setStep(record.id, index, remoteResult);
        if (result.status !== 'published') break;
      }
    } catch (error) {
      noteAuthError(error, value.sessionId);
      if (index >= 0 && index < record.steps.length) {
        const failure = remoteResult ?? { status: posting ? 'unknown' : 'failed', error: posting ? 'X 提交后本地结果未能完整保存，结果未知；禁止自动重发。' : safeFailure(error), phase: posting ? 'post' : 'media' };
        try { store.setStep(record.id, index, { ...failure, replyTo: index ? store.get(record.id).steps[index - 1].platformId : null }); } catch { /* Durable submitting survives restart if persistence remains unavailable. */ }
      }
    } finally { try { store.stop(record.id); } catch { /* Keep durable active guard; restart recovers it. */ } }
  }
  function execute(raw) {
    v.fields(raw, ['previewId', 'confirmationToken', 'confirmed']);
    if (raw.confirmed !== true) v.bad('必须单独确认本次 X 发布或续发。');
    v.id(raw.previewId);
    if (typeof raw.confirmationToken !== 'string' || !/^[a-zA-Z0-9_-]{43}$/.test(raw.confirmationToken)) v.bad('X 发布确认凭证无效。', 403);
    const confirmationHash = v.hash(raw.confirmationToken), previous = store.byPreview(raw.previewId, confirmationHash);
    if (previous) return previous;
    const value = previews.get(raw.previewId);
    if (!value || !equal(value.confirmationHash, confirmationHash)) v.bad('X 预览不存在或凭证不匹配，请重新预览。', 409);
    const { payload } = validatePreview(value);
    const { id, sessionId, expiresAt, epoch, itemRevision, ...input } = value;
    const started = store.begin({ ...input, previewId: id, steps: payload.steps.map(({ blockId, index, contentHash, textHash, assetId, assetHash, metadataHash }) => ({ blockId, index, contentHash, textHash, assetId, assetHash, metadataHash })) }, () => validatePreview(value));
    if (started.created) {
      const promise = run(started.record, value); work.set(started.record.id, promise);
      promise.finally(() => work.delete(started.record.id));
    }
    return started.record;
  }
  const cancel = id => store.cancel(id);
  async function reconcile(id) {
    const record = store.get(id), current = connected();
    if (record.active || current.account.id !== record.accountId) v.bad('请等待执行结束，并连接原发布账号后核对。', 409);
    const step = record.steps.find(item => item.status === 'unknown');
    if (!step) return record;
    if (!step.platformId || !step.platformTextHash) v.bad('未知结果缺少平台 ID 或返回正文校验值；请在 X 人工核对，工作台不会自动重发。', 409);
    const revision = record.revision, epoch = store.epoch();
    try {
      const result = await api.verify({ token: current.token, accountId: current.account.id, step, replyTo: step.index ? record.steps[step.index - 1].platformId : null });
      if (store.get(id).revision !== revision || store.epoch() !== epoch || session?.id !== current.id) v.bad('X 核对期间账号或数据变化，请重新核对。', 409);
      store.setStep(id, step.index, { ...result, phase: 'done' });
      return store.get(id);
    } catch (error) { noteAuthError(error, current.id); if (error instanceof v.ContentError) throw error; v.bad(safeFailure(error), 409); }
  }
  return { connection, startAuth, callback, browserCallback, disconnect, preview, execute, cancel, reconcile, get: store.get, list: store.list, async close() { closed = true; disconnect(); api.close(); await Promise.allSettled([...work.values()]); } };
}
