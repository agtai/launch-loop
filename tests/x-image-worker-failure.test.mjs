// Reused from committed MVP 1e7cc37; synthetic runner/protocol tests, no real model calls.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import { mkdtempSync, rmSync } from 'node:fs';
import { runImageWorker } from '../server/image-runner.mjs';
import { ContentError } from '../server/content-validation.mjs';

test('Windows image host preserves safe failure categories without exposing provider details or treating failure as timeout', { skip: process.platform !== 'win32' }, async t => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'launch-image-errors-'));
  t.after(() => { assert.ok(path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep)); rmSync(root, { recursive: true, force: true }); });
  const cases = [
    { code: 'image_tool_failed', providerCode: 'usageLimitExceeded', status: 429, phrase: '额度' },
    { code: 'image_turn_failed', providerCode: 'unauthorized', status: 401, phrase: '登录' },
    { code: 'image_turn_failed', providerCode: 'responseStreamDisconnected', status: 502, phrase: '连接中断' },
    { code: 'image_thread_closed', status: 502, phrase: '会话提前关闭' },
    { code: 'image_setup_failed', status: 502, phrase: '尚未开始生成图片' },
    { code: 'image_request_failed', status: 502, phrase: '任务未能启动' },
    { code: 'image_turn_failed', providerCode: 'UNTRUSTED', status: 502, phrase: '服务报告失败' },
  ];
  for (const [index, example] of cases.entries()) {
    const event = { type: 'image.worker.failed', code: example.code, providerCode: example.providerCode, message: 'PRIVATE_PROVIDER_DETAIL' };
    const testOnlyCommand = { executable: process.execPath, args: () => ['-e', `console.log(${JSON.stringify(JSON.stringify(event))});process.exitCode=1;`] };
    await assert.rejects(runImageWorker({ directory: path.join(root, String(index)), mode: 'generate', timeoutMs: 5000, testOnlyCommand }), cause => cause instanceof ContentError && cause.status === example.status && cause.message.includes(example.phrase) && !cause.message.includes('PRIVATE_PROVIDER_DETAIL'));
  }
});
