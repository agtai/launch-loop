import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, lstatSync, realpathSync, readFileSync, writeFileSync, renameSync, readdirSync } from 'node:fs';
import * as v from './content-validation.mjs';
import { generateImage, checkImage, probeImageCapability } from './image-runner.mjs';
import { bindXImage, inspectXImage, xImageDocumentHash, X_IMAGE_RULES } from './x-images.mjs';

const terminal = new Set(['ready', 'failed', 'cancelled', 'interrupted']);
const now = () => new Date().toISOString();
const canonical = value => JSON.stringify(value, (_key, val) => val && typeof val === 'object' && !Array.isArray(val) ? Object.fromEntries(Object.keys(val).sort().map(key => [key, val[key]])) : val);
const safeMessage = error => error instanceof v.ContentError ? error.message : 'X 配图执行失败；详细诊断仅保留在本任务 tmp。';

/** Shared official runner, X-specific orchestration. No remote upload or formal save. */
export function createXImageService({ content, dataDir, env = process.env, testOnlyGenerate, testOnlyCheck, testOnlyProbe } = {}) {
  const root = realpathSync(dataDir), jobs = new Map(), running = new Map(), controllers = new Map();
  let closed = false, tail = Promise.resolve(), probePromise = null, probeController = null;
  const enabled = () => env.LAUNCH_LOOP_IMAGE_PROVIDER === 'codex-cache';
  let capability = { available: false, checking: false, status: enabled() ? 'unknown' : 'disabled', reason: enabled() ? 'X 后台配图已启用，等待检查正式入口。' : '尚未明确启用 Codex 官方图片缓存适配。', canRefresh: enabled(), provider: 'codex-cache' };
  function directory(...parts) {
    let dir = root;
    for (const part of ['tmp', 'x-images', ...parts]) {
      v.id(part); dir = path.join(dir, part);
      if (!existsSync(dir)) mkdirSync(dir);
      if (!lstatSync(dir).isDirectory() || lstatSync(dir).isSymbolicLink() || realpathSync(dir) !== dir) v.bad('X 配图暂存目录不安全。', 403);
    }
    return dir;
  }
  function file(dir, name) {
    const result = path.join(dir, name);
    if (existsSync(result) && (!lstatSync(result).isFile() || lstatSync(result).isSymbolicLink() || lstatSync(result).nlink !== 1 || realpathSync(result) !== result)) v.bad('X 配图暂存文件不安全。', 403);
    return result;
  }
  function write(dir, name, value) {
    const destination = file(dir, name), temporary = path.join(dir, `${randomUUID()}.partial`);
    writeFileSync(temporary, Buffer.isBuffer(value) ? value : JSON.stringify(value), { flag: 'wx', mode: 0o600 });
    renameSync(temporary, destination);
  }
  const save = job => { job.updatedAt = now(); write(directory(job.id), 'job.json', job); };
  const publicJob = job => structuredClone(job);
  const need = id => { v.id(id); const job = jobs.get(id); if (!job) v.bad('找不到 X 配图任务。', 404); return job; };
  for (const entry of readdirSync(directory(), { withFileTypes: true })) {
    if (!entry.isDirectory() || !/^[-\w]{1,120}$/.test(entry.name)) continue;
    const name = file(directory(entry.name), 'job.json'); if (!existsSync(name)) continue;
    const job = JSON.parse(readFileSync(name, 'utf8'));
    if (job.id !== entry.name || !job.requestId || !job.inputHash) v.bad('X 配图任务记录损坏。', 500);
    if (!terminal.has(job.status)) { job.status = job.stage = 'interrupted'; job.error = '服务已重启，X 配图任务已中断，不会自动重跑。'; save(job); }
    jobs.set(job.id, job);
  }
  function source(job) {
    if (closed || controllers.get(job.id)?.signal.aborted || terminal.has(job.status)) v.bad('X 配图任务已取消或中断。', 409);
    const tmp = content.readTmp(job.tmpId), document = tmp.content.documents.find(doc => doc.id === job.documentId);
    if (tmp.stale || tmp.confirmed || tmp.revision !== job.sourceRevision || !document || v.hash(canonical(tmp.content)) !== job.contentHash || xImageDocumentHash(document) !== job.documentHash) v.bad('X 配图期间稿件、版本或素材已改变，迟到图片不会附入。', 409);
    return { tmp, document };
  }
  function progress(job, stage) { source(job); job.status = 'running'; job.stage = stage; save(job); }
  async function refreshCapability() {
    if (closed) v.bad('X 配图服务正在关闭。', 503);
    if (!enabled()) v.bad('后台配图尚未启用 Codex 官方缓存适配。', 409);
    if (probePromise) return probePromise;
    capability = { ...capability, available: false, checking: true, status: 'checking', reason: '正在检查 X 配图正式入口。' };
    probeController = new AbortController();
    probePromise = (async () => {
      try {
        const result = await (testOnlyProbe ?? probeImageCapability)({ directory: directory(`probe-${randomUUID()}`), signal: probeController.signal });
        if (!closed && !probeController.signal.aborted) capability = { ...result, available: result.available === true, checking: false, canRefresh: true, provider: 'codex-cache', reason: typeof result.reason === 'string' ? result.reason : result.available ? '正式配图入口可用；仍需实际生成和看图检查。' : '正式配图入口暂不可用。' };
      } catch (error) { if (!closed) capability = { available: false, checking: false, canRefresh: true, status: 'unavailable', reason: safeMessage(error), provider: 'codex-cache' }; }
      finally { probePromise = null; probeController = null; }
      return structuredClone(capability);
    })();
    return probePromise;
  }
  async function run(job) {
    try {
      let { tmp, document } = source(job);
      const dir = directory(job.id), documents = [{ id: document.id, kind: document.kind, title: document.title, postingNote: '', blocks: document.blocks.map(block => ({ id: block.id, type: block.type, text: block.text })) }];
      const bodyHash = v.hash(JSON.stringify(documents));
      let priorVisualFindings = [];
      if (job.mode === 'generate') for (const prior of [...jobs.values()].reverse()) {
        if (prior.id === job.id || prior.mode !== 'generate' || prior.tmpId !== job.tmpId || prior.documentId !== job.documentId || prior.documentHash !== job.documentHash || prior.sourceRevision !== job.sourceRevision) continue;
        const evidence = file(directory(prior.id, 'run', 'visual-check'), 'visual-check.json');
        if (!existsSync(evidence)) continue;
        const check = JSON.parse(readFileSync(evidence, 'utf8'));
        if (check.status === 'failed' && check.bodyHash === bodyHash && Array.isArray(check.findings) && check.findings.every(value => typeof value === 'string')) { priorVisualFindings = check.findings.slice(0, 8).map(value => value.slice(0, 2000)); break; }
      }
      const context = { platform: 'x', language: tmp.content.language, purpose: tmp.content.brief.purpose, audience: tmp.content.brief.audience, topic: document.blocks[0].text, priorVisualFindings, imageBrief: { purpose: 'Support the actual first post in its thread context.', composition: X_IMAGE_RULES.join('\n'), elements: [], prohibitedImplications: ['No invented screenshot, result, quantity or completion claim.'] } };
      write(dir, 'input.json', { document, bodyHash, context, sourceRevision: job.sourceRevision, contentHash: job.contentHash, documentHash: job.documentHash });
      const signal = controllers.get(job.id).signal;
      let result;
      if (job.mode === 'check') {
        const assetId = document.blocks[0].assetIds?.[0];
        if (!assetId) v.bad('检查图片需要当前帖子已选中的一张图片。');
        const selected = content.getTmpAsset(tmp.id, assetId), info = inspectXImage(selected.bytes, selected.asset.mimeType);
        const name = `selected.${info.mimeType === 'image/png' ? 'png' : 'jpg'}`;
        write(dir, name, selected.bytes); progress(job, 'checking');
        result = await (testOnlyCheck ?? checkImage)({ directory: path.join(dir, 'check'), documents, bodyHash, context, file: file(dir, name), generated: false, signal });
        result = { ...result, selectedAssetId: assetId };
      } else {
        progress(job, 'generating');
        const references = [];
        const assetId = document.blocks[0].assetIds?.[0];
        if (assetId) {
          const selected = content.getTmpAsset(tmp.id, assetId), info = inspectXImage(selected.bytes, selected.asset.mimeType);
          const name = `reference.${info.mimeType === 'image/png' ? 'png' : 'jpg'}`; write(dir, name, selected.bytes); references.push(file(dir, name));
        }
        result = await (testOnlyGenerate ?? generateImage)({ directory: path.join(dir, 'run'), documents, bodyHash, context, images: references, signal, onProgress: ({ stage }) => progress(job, stage === 'checking' ? 'checking' : 'generating') });
      }
      ({ tmp, document } = source(job));
      if (result?.status !== 'ready' || result.visualCheck?.status !== 'passed' || result.visualCheck.method !== 'codex-image-input' || !Array.isArray(result.visualCheck.findings) || result.visualCheck.findings.length || result.visualCheck.bodyHash !== bodyHash || result.bodyHash !== bodyHash || !Buffer.isBuffer(result.bytes)) v.bad('X 配图没有完整的实际视觉检查结果，未附图。', 502);
      const info = inspectXImage(result.bytes, result.mimeType);
      if (info.sha256 !== result.visualCheck.imageHash || result.sha256 !== info.sha256) v.bad('X 图片字节与视觉检查结果不一致，未附图。', 502);
      const observed = result.visualCheck.observed;
      if (typeof observed !== 'string' || !observed.trim() || observed.length > 1000 || /[\x00-\x1f\x7f]/.test(observed)) v.bad('X 图片检查没有返回有效的图片描述，未附图。', 502);
      write(dir, 'result.json', { mimeType: info.mimeType, width: info.width, height: info.height, sha256: info.sha256, visualCheck: result.visualCheck, source: result.source ?? null });
      // There are no awaits between the final revision check, upload and attachment.
      let asset;
      if (job.mode === 'check') {
        asset = tmp.assets.find(item => item.id === result.selectedAssetId);
        if (!asset || asset.sha256 !== info.sha256) v.bad('选定图片已改变，未附图。', 409);
      } else {
        const upload = content.upload(tmp.id, { revision: tmp.revision, fileName: `x-${job.id}.${info.mimeType === 'image/png' ? 'png' : 'jpg'}`, mimeType: info.mimeType, dataBase64: result.bytes.toString('base64'), source: { kind: 'generated', url: null }, caption: observed });
        tmp = upload.item; asset = upload.asset;
      }
      const bound = bindXImage(document, { language: tmp.content.language, asset, bytes: result.bytes, altText: observed });
      bound.blocks[0].image = { ...bound.blocks[0].image, ...(job.mode === 'generate' ? { intent: 'generate', status: 'generated' } : {}), visualVerification: 'passed', visualMethod: 'codex-image-input' };
      const saved = content.updateTmp(tmp.id, { revision: tmp.revision, content: { ...tmp.content, documents: tmp.content.documents.map(doc => doc.id === document.id ? bound : doc) }, temporary: tmp.temporary });
      job.resultRevision = saved.revision; job.assetId = asset.id; job.status = job.stage = 'ready'; job.error = null;
      capability = { available: true, checking: capability.checking, status: 'ready', reason: testOnlyGenerate || testOnlyCheck ? '仅测试替身完成配图，不代表真实后台能力。' : '本服务已有实际图片与视觉检查通过结果；后续任务仍可能失败。', canRefresh: true, provider: 'codex-cache' };
    } catch (error) {
      if (!terminal.has(job.status)) { job.status = job.stage = controllers.get(job.id)?.signal.aborted ? 'cancelled' : 'failed'; job.error = safeMessage(error); }
      write(directory(job.id), 'failure.json', { message: String(error?.message ?? error), at: now() });
    } finally { save(job); controllers.delete(job.id); }
    return publicJob(job);
  }
  function create(raw) {
    v.fields(raw, ['requestId', 'tmpId', 'revision', 'documentId'], ['mode']);
    for (const key of ['requestId', 'tmpId', 'documentId']) v.id(raw[key]); v.integer(raw.revision);
    const mode = raw.mode ?? 'generate'; v.choice(mode, ['generate', 'check']);
    const inputHash = v.hash(canonical({ ...raw, mode }));
    for (const job of jobs.values()) if (job.requestId === raw.requestId) { if (job.inputHash !== inputHash) v.bad('X 配图请求编号已用于其他内容。', 409); return publicJob(job); }
    if (closed) v.bad('X 配图服务正在关闭。', 503);
    if (!enabled()) v.bad('后台配图尚未启用 Codex 官方缓存适配。', 503);
    const tmp = content.readTmp(raw.tmpId), document = tmp.content.documents.find(doc => doc.id === raw.documentId);
    if (tmp.content.platform !== 'x' || !document || !['post', 'thread'].includes(document.kind) || !document.blocks.length) v.bad('请选择有效的 X 内容对象。');
    if (tmp.revision !== raw.revision || tmp.stale || tmp.confirmed) v.bad('稿件已更改，请重新载入后处理配图。', 409);
    if ([...jobs.values()].some(job => job.tmpId === tmp.id && !terminal.has(job.status))) v.bad('该稿件已有图片任务，请等待完成或取消。', 409);
    if (mode === 'check' && document.blocks[0].assetIds?.length !== 1) v.bad('检查图片需要当前帖子已选中的一张图片。');
    const job = { id: randomUUID(), requestId: raw.requestId, inputHash, tmpId: tmp.id, documentId: document.id, mode, status: 'queued', stage: 'queued', sourceRevision: tmp.revision, documentHash: xImageDocumentHash(document), contentHash: v.hash(canonical(tmp.content)), createdAt: now(), updatedAt: now(), error: null, resultRevision: null, assetId: null };
    jobs.set(job.id, job); controllers.set(job.id, new AbortController()); save(job);
    const promise = tail.then(() => terminal.has(job.status) ? publicJob(job) : run(job));
    tail = promise.catch(() => {}); running.set(job.id, promise); promise.finally(() => running.delete(job.id)).catch(() => {});
    return publicJob(job);
  }
  function cancel(id) { const job = need(id); if (!terminal.has(job.status)) { controllers.get(id)?.abort(); job.status = job.stage = 'cancelled'; job.error = 'X 配图已取消，迟到结果不会附入。'; save(job); } return publicJob(job); }
  async function interruptAll() { for (const job of jobs.values()) if (!terminal.has(job.status)) { controllers.get(job.id)?.abort(); job.status = job.stage = 'interrupted'; job.error = '服务关闭或数据恢复，X 配图已中断。'; save(job); } await tail; }
  return { capabilities: () => structuredClone(capability), refreshCapability, waitCapability: () => probePromise ?? Promise.resolve(structuredClone(capability)), create, get: id => publicJob(need(id)), list: ({ tmpId } = {}) => [...jobs.values()].filter(job => !tmpId || job.tmpId === tmpId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(publicJob), wait: id => running.get(id) ?? Promise.resolve(publicJob(need(id))), cancel, interruptAll, async close() { closed = true; probeController?.abort(); await interruptAll(); if (probePromise) await probePromise; capability = { ...capability, available: false, checking: false, canRefresh: false, status: 'disabled' }; } };
}
