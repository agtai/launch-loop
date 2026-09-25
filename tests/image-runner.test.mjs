import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, utimesSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { PassThrough, Writable } from 'node:stream';
import { buildImageBrief, inspectImageBytes, snapshotImageCache, collectCompletedImage, generateImage, checkImage, probeImageCapability, runImageWorker } from '../server/image-runner.mjs';
import { imageServerArguments, imageAppServerSession, imageDisabledFeatures } from '../server/image-app-server-worker.mjs';

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=', 'base64');
const docs = [{ id: 'doc', kind: 'linkedin_post', title: 'Soil', blocks: [{ id: 'a', type: 'paragraph', text: 'Healthy soil retains water.' }], postingNote: '' }];
const bodyHash = createHash('sha256').update(JSON.stringify(docs)).digest('hex');
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
function setup(t) { const directory = mkdtempSync(path.join(os.tmpdir(), 'launch-loop-image-')); t.after(() => rmSync(directory, { recursive: true, force: true })); return directory; }
function enable(t) { const previous = process.env.LAUNCH_LOOP_IMAGE_PROVIDER; process.env.LAUNCH_LOOP_IMAGE_PROVIDER = 'codex-cache'; t.after(() => { if (previous === undefined) delete process.env.LAUNCH_LOOP_IMAGE_PROVIDER; else process.env.LAUNCH_LOOP_IMAGE_PROVIDER = previous; }); }
function result(file, changes = {}) { return { completed: true, threadId: 'this-thread', turnId: 'this-turn', image: { id: 'this-image', savedPath: file, resultHash: digest(png) }, ...changes }; }

test('image runner isolates tools from the existing text runner', () => {
  const args = imageServerArguments('C:/tmp/images');
  for (const flag of imageDisabledFeatures) assert.ok(args.some((v, i) => v === '--disable' && args[i + 1] === flag));
  assert.ok(args.includes('image_generation'));
  assert.ok(args.some((value, index) => value === '--enable' && args[index + 1] === 'code_mode_host'));
  assert.ok(args.some((value, index) => value === '--disable' && args[index + 1] === 'code_mode'));
  assert.ok(!imageDisabledFeatures.includes('code_mode_host'));
  assert.ok(args.includes('mcp_servers={}'));
  assert.ok(args.includes('forced_login_method="chatgpt"'));
  assert.ok(!args.includes('--dangerously-bypass-approvals-and-sandbox'));
});
test('brief is driven by body audience and purpose, not a fixed product', () => {
  const brief = buildImageBrief({ documents: docs, context: { audience: 'farmers', purpose: 'Explain soil retention' } });
  assert.match(brief, /Healthy soil retains water/); assert.match(brief, /farmers/); assert.match(brief, /Explain soil retention/);
  assert.match(brief, /exactly once/); assert.doesNotMatch(brief, /system1-agents/);
});
test('shared no-text brief discards old caption language and internal lineage while preserving actual body', () => {
  const body = structuredClone(docs); body[0].blocks[0].text += ' The actual post may discuss motherHash as a term.';
  const context = { imageBrief: [{ purpose: `Explain soil motherHash: ${'a'.repeat(64)}`, composition: 'A cross-section of soil', elements: ['Soil', 'Water'], prohibitedImplications: ['No invented test outcome'], textLanguage: 'en', text: 'OLD ENGLISH CAPTION', motherHash: 'internal-artifact', visualVerification: 'not_run' }] };
  const prompt = buildImageBrief({ documents: body, context }), data = JSON.parse(prompt.split('\n').at(-1));
  assert.equal(data.imageBrief[0].textLanguage, 'none'); assert.equal(data.imageBrief[0].text, '');
  assert.equal(data.imageBrief[0].purpose, 'Explain soil'); assert.equal(data.imageBrief[0].composition, 'A cross-section of soil');
  assert.deepEqual(data.documents, body); assert.doesNotMatch(prompt, /OLD ENGLISH CAPTION|internal-artifact|a{64}/);
  assert.match(prompt, /never an element that contradicts either version/);
});
test('file checks report actual PNG dimensions and hash, reject excess or malformed bytes', () => {
  assert.deepEqual(inspectImageBytes(png), { mimeType: 'image/png', width: 1, height: 1, sha256: digest(png) });
  assert.throws(() => inspectImageBytes(Buffer.from('fake.png')));
  assert.throws(() => inspectImageBytes(png.subarray(0, -4)));
  assert.throws(() => inspectImageBytes(Buffer.alloc(4 * 1024 * 1024 + 1)));
});
test('cache collector takes only the one new event-bound file', t => {
  const directory = setup(t), cacheRoot = path.join(directory, 'cache'); mkdirSync(cacheRoot);
  const old = path.join(cacheRoot, 'old.png'); writeFileSync(old, png);
  const before = snapshotImageCache(cacheRoot), startedAt = Date.now();
  const fresh = path.join(cacheRoot, 'fresh.png'), unrelated = path.join(cacheRoot, 'other-task.png');
  writeFileSync(fresh, png); writeFileSync(unrelated, png);
  const got = collectCompletedImage({ result: result(fresh), cacheRoot, before, startedAt, directory });
  assert.equal(got.source.itemId, 'this-image'); assert.deepEqual(readFileSync(got.file), png);
  assert.throws(() => collectCompletedImage({ result: result(old), cacheRoot, before, startedAt, directory }), /旧图片/);
  assert.throws(() => collectCompletedImage({ result: result(fresh, { completed: false }), cacheRoot, before, startedAt, directory }), /完成标识/);
});
test('cache collector rejects stale timestamps, path escape and different event bytes', t => {
  const directory = setup(t), cacheRoot = path.join(directory, 'cache'); mkdirSync(cacheRoot);
  const file = path.join(cacheRoot, 'image.png'); writeFileSync(file, png);
  const options = { result: result(file), cacheRoot, before: new Set(), startedAt: Date.now(), directory };
  assert.throws(() => collectCompletedImage({ ...options, result: result(path.join(directory, 'outside.png')) }), /缓存之外/);
  assert.throws(() => collectCompletedImage({ ...options, result: { ...result(file), image: { ...result(file).image, resultHash: 'wrong' } } }), /字节不一致/);
  utimesSync(file, new Date(0), new Date(0)); assert.throws(() => collectCompletedImage(options), /新文件/);
});
test('explicit provider opt-in controls probing and generation', async t => {
  const previous = process.env.LAUNCH_LOOP_IMAGE_PROVIDER; delete process.env.LAUNCH_LOOP_IMAGE_PROVIDER;
  t.after(() => { if (previous !== undefined) process.env.LAUNCH_LOOP_IMAGE_PROVIDER = previous; });
  assert.equal((await probeImageCapability()).status, 'disabled');
  await assert.rejects(generateImage({ directory: setup(t), documents: docs, bodyHash }), /尚未启用/);
});

test('probe preserves a bounded identifiable timeout and never retries implicitly', async t => {
  enable(t); let calls = 0;
  const got = await probeImageCapability({ directory: setup(t), worker: async args => {
    calls++; assert.equal(args.mode, 'probe'); assert.equal(args.timeoutMs, 30000);
    const cause = new Error('Private diagnostic must stay private'); cause.status = 504; throw cause;
  } });
  assert.equal(calls, 1); assert.equal(got.available, false); assert.equal(got.status, 'unavailable');
  assert.equal(got.code, 'probe_timeout'); assert.match(got.reason, /暂时超时/); assert.doesNotMatch(got.reason, /Private/);
});
test('generation checks the collected image using separate vision input', async t => {
  enable(t); const directory = setup(t), cacheRoot = path.join(directory, 'cache'); mkdirSync(cacheRoot);
  const stages = [];
  const got = await generateImage({ directory: path.join(directory, 'job'), documents: docs, bodyHash, cacheRoot, onProgress: p => stages.push(p.stage),
    worker: async ({ mode, prompt }) => { assert.equal(mode, 'generate'); assert.match(prompt, /Healthy soil/); const file = path.join(cacheRoot, 'new.png'); writeFileSync(file, png); return result(file); },
    vision: async args => { assert.deepEqual(readFileSync(args.images[0]), png); assert.ok(args.timeoutMs <= 180000); return { passed: true, observed: 'Test double observed soil.', findings: [] }; } });
  assert.equal(got.status, 'ready'); assert.equal(got.visualCheck.status, 'passed'); assert.equal(got.bodyHash, bodyHash); assert.equal(got.sha256, digest(png));
  assert.deepEqual(stages, ['generating', 'checking']);
});
test('regeneration receives concrete prior findings without restoring obsolete captions or lineage', async t => {
  enable(t); const directory = setup(t), cacheRoot = path.join(directory, 'cache'); mkdirSync(cacheRoot);
  const findings = ['Arrows assign the calculation task to the wrong group.', 'Six decorative dots conflict with five meaningful option cards.'];
  const context = { priorVisualFindings: [...findings, `motherHash: ${'b'.repeat(64)}`], imageBrief: [{ purpose: `Explain soil inputHash=${'a'.repeat(64)}`, textLanguage: 'en', text: 'OBSOLETE CAPTION', motherHash: 'internal-lineage' }] };
  const got = await generateImage({ directory: path.join(directory, 'job'), documents: docs, bodyHash, context, cacheRoot,
    worker: async ({ prompt }) => {
      const supplied = JSON.parse(prompt.split('\n').at(-1));
      assert.deepEqual(supplied.priorVisualFindings, findings); assert.deepEqual(supplied.documents, docs);
      assert.equal(supplied.imageBrief[0].purpose, 'Explain soil'); assert.equal(supplied.imageBrief[0].textLanguage, 'none'); assert.equal(supplied.imageBrief[0].text, '');
      assert.doesNotMatch(prompt, /OBSOLETE CAPTION|internal-lineage|motherHash|inputHash|a{64}|b{64}/);
      assert.match(prompt, /correct each problem/); assert.match(prompt, /clearly separated visual groups/); assert.match(prompt, /Omit decorative countable marks/);
      const file = path.join(cacheRoot, 'new.png'); writeFileSync(file, png); return result(file);
    }, vision: async () => ({ passed: true, observed: 'Explicit synthetic corrected illustration.', findings: [] }) });
  assert.equal(got.status, 'ready'); assert.equal(got.bodyHash, bodyHash);
});

test('valid files alone are not visual approval; failure keeps temporary evidence', async t => {
  const directory = setup(t), file = path.join(directory, 'source.png'); writeFileSync(file, png);
  const findings = ['Misleading responsibility boundary. The reasoning/chat grouping and logistics/package arrow are ambiguous.', 'Diagnostic C:\\Users\\Private Person\\image.png；Bad grouping.', 'Source /home/private/image.png；Conflicting counts.', 'x'.repeat(1000)];
  await assert.rejects(checkImage({ directory: path.join(directory, 'check'), documents: docs, bodyHash, file, vision: async () => ({ passed: true, observed: 'Unrelated test image.', findings }) }), cause => {
    assert.match(cause.message, /^配图视觉检查未通过：Misleading responsibility boundary/);
    assert.match(cause.message, /reasoning\/chat/); assert.match(cause.message, /logistics\/package/);
    assert.match(cause.message, /Bad grouping|Conflicting counts/); assert.doesNotMatch(cause.message, /Private Person|home\/private|image\.png/);
    assert.ok(cause.message.length <= '配图视觉检查未通过：'.length + 800); return true;
  });
  const evidence = JSON.parse(readFileSync(path.join(directory, 'check/visual-check.json')));
  assert.equal(evidence.status, 'failed'); assert.deepEqual(evidence.findings, findings);
  await assert.rejects(checkImage({ directory: path.join(directory, 'empty-check'), documents: docs, bodyHash, file, vision: async () => ({ passed: false, observed: 'Cannot confirm relevance.', findings: [] }) }), /配图视觉检查未通过；文本保留/);
});
test('uploaded images allow legitimate text and inspect an immutable copy', async t => {
  const directory = setup(t), file = path.join(directory, 'source.png'); writeFileSync(file, png);
  const got = await checkImage({ directory: path.join(directory, 'check'), documents: docs, bodyHash, file, vision: async args => { assert.match(args.prompt, /Text, diagrams and logos are allowed/); writeFileSync(file, 'changed'); assert.deepEqual(readFileSync(args.images[0]), png); return { passed: true, observed: 'Test inspection', findings: [] }; } });
  assert.deepEqual(got.bytes, png); assert.equal(got.source.provider, 'user-selected');
});
test('generated image visual check reads both final drafts and cannot inherit obsolete caption instructions', async t => {
  const directory = setup(t), file = path.join(directory, 'source.png'); writeFileSync(file, png);
  const documents = [{ ...structuredClone(docs[0]), id: 'en-feed' }, { ...structuredClone(docs[0]), id: 'zh-feed', blocks: [{ id: 'zh-body', type: 'paragraph', text: '健康的土壤能保持水分。' }] }];
  const bodyHash = digest(JSON.stringify(documents));
  await checkImage({ directory: path.join(directory, 'check'), documents, bodyHash, file, generated: true, context: { imageBrief: [{ purpose: 'Explain soil', textLanguage: 'en', text: 'OBSOLETE CAPTION' }] }, vision: async args => {
    const supplied = JSON.parse(args.prompt.split('\n').at(-1));
    assert.deepEqual(supplied.documents, documents); assert.equal(supplied.context.imageBrief[0].textLanguage, 'none');
    assert.doesNotMatch(args.prompt, /OBSOLETE CAPTION/); assert.match(args.prompt, /EACH supplied final document independently/);
    return { passed: true, observed: 'EXPLICIT SYNTHETIC check of both versions.', findings: [] };
  } });
});
test('cancel and stale body hash prevent accepting output', async t => {
  enable(t); const directory = setup(t), file = path.join(directory, 'source.png'); writeFileSync(file, png);
  const signal = AbortSignal.abort();
  await assert.rejects(generateImage({ directory, documents: docs, bodyHash, signal }), /取消/);
  await assert.rejects(checkImage({ directory, documents: docs, bodyHash: 'old', file }), /指纹/);
  const controller = new AbortController();
  await assert.rejects(checkImage({ directory: path.join(directory, 'check'), documents: docs, bodyHash, file, signal: controller.signal, vision: async () => { controller.abort(); return { passed: true, observed: 'test', findings: [] }; } }), /取消/);
});

function fakeServer(sendEvents, inheritedMcp = false, rpcFailure = null) {
  return (_executable, args) => {
    const child = new EventEmitter(); child.stdout = new PassThrough(); child.stderr = new PassThrough(); child.kill = () => { queueMicrotask(() => child.emit('close', 0)); };
    const emit = message => child.stdout.write(`${JSON.stringify(message)}\n`);
    child.stdin = new Writable({ write(chunk, encoding, callback) {
      const req = JSON.parse(chunk.toString());
      queueMicrotask(() => {
        if (req.method === rpcFailure?.method) { emit({ id: req.id, error: rpcFailure.error }); return; }
        if (req.method === 'initialize') emit({ id: req.id, result: {} });
        if (req.method === 'config/read') emit({ id: req.id, result: { config: { mcp_servers: inheritedMcp ? { inherited_tool: { enabled: !args.includes('mcp_servers.inherited_tool.enabled=false') } } : {}, features: { ...Object.fromEntries(imageDisabledFeatures.map(name => [name, false])), image_generation: true, code_mode_host: true } } } });
        if (req.method === 'account/read') emit({ id: req.id, result: { account: { type: 'chatgpt' } } });
        if (req.method === 'modelProvider/capabilities/read') emit({ id: req.id, result: { imageGeneration: true } });
        if (req.method === 'thread/start') { assert.equal(req.params.sandbox, 'read-only'); assert.equal(req.params.ephemeral, true); emit({ id: req.id, result: { thread: { id: 'this-thread' } } }); }
        if (req.method === 'turn/start') { emit({ id: req.id, result: { turn: { id: 'this-turn' } } }); queueMicrotask(() => sendEvents(emit)); }
      }); callback();
    } }); return child;
  };
}
const protocolConfig = { executable: 'unused', directory: 'unused', mode: 'generate', prompt: 'test', timeoutMs: 1000 };
const imageEvent = (threadId = 'this-thread', id = 'one') => ({ method: 'item/completed', params: { threadId, turnId: 'this-turn', item: { type: 'imageGeneration', status: 'completed', id, savedPath: 'C:/cache/new.png', result: png.toString('base64'), failure: null } } });
const completedEvent = { method: 'turn/completed', params: { threadId: 'this-thread', turn: { id: 'this-turn', status: 'completed' } } };

test('capability probe verifies isolation without starting any model turn', async () => {
  let turns = 0;
  const got = await imageAppServerSession({ ...protocolConfig, mode: 'probe', timeoutMs: 2000 }, fakeServer(() => { turns++; }, true));
  assert.deepEqual(got, { available: true, signedIn: true, imageGeneration: true }); assert.equal(turns, 0);
});

test('slow initialization has a typed bounded timeout naming only the safe phase', async () => {
  let killed = false;
  await assert.rejects(imageAppServerSession({ ...protocolConfig, mode: 'probe', timeoutMs: 20 }, () => {
    const child = new EventEmitter(); child.stdout = new PassThrough(); child.stderr = new PassThrough();
    child.stdin = new Writable({ write(_chunk, _encoding, callback) { callback(); } });
    child.kill = () => { killed = true; child.emit('close', 0); }; return child;
  }), cause => cause.code === 'image_protocol_timeout' && cause.message.includes('initialize:started'));
  assert.equal(killed, true);
});

test('setup RPC failures retain only method numeric code and finite category before any model turn', async () => {
  for (const [message, category] of [['request timed out SECRET', 'timeout'], ['connection failed SECRET', 'network'], ['unauthorized SECRET', 'auth'], ['rate limit SECRET', 'rate_limit'], ['opaque SECRET', 'internal']]) {
    let turns = 0;
    await assert.rejects(imageAppServerSession({ ...protocolConfig, mode: 'probe' }, fakeServer(() => { turns++; }, false, { method: 'account/read', error: { code: -32603, message, data: { token: 'PRIVATE', headers: { secret: 'PRIVATE' } } } })), cause => {
      assert.equal(cause.code, 'image_setup_failed'); assert.equal(cause.method, 'account/read'); assert.equal(cause.rpcCode, -32603); assert.equal(cause.category, category);
      assert.match(cause.message, /account\/read/); assert.doesNotMatch(cause.message + JSON.stringify(cause), /SECRET|PRIVATE|token|headers/); return true;
    });
    assert.equal(turns, 0);
  }
});
test('public app-server protocol requires matching item and completed turn', async () => {
  const got = await imageAppServerSession(protocolConfig, fakeServer(emit => { emit(imageEvent('unrelated')); emit(imageEvent()); emit(completedEvent); }));
  assert.equal(got.image.id, 'one'); assert.equal(got.image.resultHash, digest(png));
  await assert.rejects(imageAppServerSession(protocolConfig, fakeServer(emit => { emit(imageEvent('unrelated')); emit(completedEvent); })), /exactly one/);
});
test('public app-server protocol rejects tool execution and more than one image', async () => {
  await assert.rejects(imageAppServerSession(protocolConfig, fakeServer(emit => { emit({ method: 'item/started', params: { threadId: 'this-thread', turnId: 'this-turn', item: { type: 'commandExecution' } } }); })), /Unexpected image tool/);
  await assert.rejects(imageAppServerSession(protocolConfig, fakeServer(emit => { emit(imageEvent()); emit(imageEvent('this-thread', 'two')); })), /More than one/);
});

test('matching terminal protocol error fails immediately without waiting for turn completion', async () => {
  const notification = { method: 'error', params: { threadId: 'this-thread', turnId: 'this-turn', willRetry: false, error: { message: 'SECRET C:/private/file', additionalDetails: 'PRIVATE', codexErrorInfo: { httpConnectionFailed: { httpStatusCode: 503 } } } } };
  const began = Date.now();
  await assert.rejects(imageAppServerSession({ ...protocolConfig, timeoutMs: 2000 }, fakeServer(emit => emit(notification))), cause => {
    assert.equal(cause.code, 'image_turn_failed'); assert.equal(cause.providerCode, 'httpConnectionFailed');
    assert.match(cause.message, /HTTP 503/); assert.doesNotMatch(cause.message, /SECRET|private|PRIVATE/); return true;
  });
  assert.ok(Date.now() - began < 1000, 'Terminal error must not wait out the protocol deadline.');
});

test('retry notices and errors for different identities cannot abort or complete this image', async () => {
  const errorEvent = (threadId, turnId, willRetry) => ({ method: 'error', params: { threadId, turnId, willRetry, error: { codexErrorInfo: 'serverOverloaded' } } });
  const got = await imageAppServerSession(protocolConfig, fakeServer(emit => {
    emit(errorEvent('another-thread', 'this-turn', false)); emit(errorEvent('this-thread', 'another-turn', false));
    emit(errorEvent('this-thread', 'this-turn', true)); emit(imageEvent()); emit(completedEvent);
    emit({ method: 'thread/closed', params: { threadId: 'this-thread' } });
  }));
  assert.equal(got.completed, true); assert.equal(got.image.id, 'one');
});

test('explicit image failure and premature thread closure reject without a completed turn', async () => {
  const failure = imageEvent(); failure.params.item.failure = { type: 'usageLimitExceeded', limitId: 'PRIVATE', resetsAt: null };
  await assert.rejects(imageAppServerSession(protocolConfig, fakeServer(emit => emit(failure))), cause => cause.code === 'image_tool_failed' && cause.providerCode === 'usageLimitExceeded' && !cause.message.includes('PRIVATE'));
  await assert.rejects(imageAppServerSession(protocolConfig, fakeServer(emit => emit({ method: 'thread/closed', params: { threadId: 'this-thread' } }))), cause => cause.code === 'image_thread_closed');
});
test('inherited MCP tools are disabled and effective configuration rechecked before any turn', async () => {
  let turns = 0, starts = 0;
  const spawn = fakeServer(emit => { turns++; emit(imageEvent()); emit(completedEvent); }, true);
  const got = await imageAppServerSession({ ...protocolConfig, timeoutMs: 2000 }, (...args) => { starts++; return spawn(...args); });
  assert.equal(starts, 2); assert.equal(turns, 1); assert.equal(got.completed, true);
  assert.throws(() => imageServerArguments('C:/tmp', ['unsupported.name']), /Unsupported MCP/);
});
test('discovery server has actually closed before a replacement opens the same SQLite directory', async () => {
  const spawn = fakeServer(emit => { emit(imageEvent()); emit(completedEvent); }, true);
  let running = false, starts = 0;
  const got = await imageAppServerSession({ ...protocolConfig, timeoutMs: 2500 }, (...args) => {
    assert.equal(running, false, 'Previous app-server still holds its SQLite runtime.');
    running = true; starts++;
    const child = spawn(...args);
    child.kill = () => { setTimeout(() => { running = false; child.emit('close', 0); }, 20); };
    return child;
  });
  assert.equal(got.completed, true); assert.equal(starts, 2);
});
test('Windows host bounds worker timeout and handles cancellation without model calls', { skip: process.platform !== 'win32', timeout: 20000 }, async t => {
  const directory = setup(t);
  const command = { executable: process.execPath, args: () => ['-e', 'setInterval(()=>{},1000)'] };
  await assert.rejects(runImageWorker({ directory: path.join(directory, 'timeout'), mode: 'probe', timeoutMs: 1000, testOnlyCommand: command }), /超时/);
  const earlyTimeout = { executable: process.execPath, args: () => ['-e', 'console.log(JSON.stringify({type:"image.worker.failed",code:"timeout"}));process.exitCode=1'] };
  await assert.rejects(runImageWorker({ directory: path.join(directory, 'protocol-timeout'), mode: 'probe', timeoutMs: 1000, testOnlyCommand: earlyTimeout }), cause => cause.status === 504 && cause.message.includes('探测暂时超时'));
  assert.equal(JSON.parse(readFileSync(path.join(directory, 'protocol-timeout/execution.json'))).timedOut, true);
  const controller = new AbortController(); setTimeout(() => controller.abort(), 1000);
  await assert.rejects(runImageWorker({ directory: path.join(directory, 'cancel'), mode: 'probe', signal: controller.signal, testOnlyCommand: command }), /取消/);
});
