import net from 'node:net';
import { mkdirSync, realpathSync } from 'node:fs';
import { createHash } from 'node:crypto';

// On the supported Windows host, a named pipe provides an OS-owned, crash-safe
// single-server lease. No stale PID file and no unrelated process termination.
export async function acquireDataLease(dataDir) {
  if (process.platform !== 'win32') return async () => {};
  mkdirSync(dataDir, { recursive: true });
  const key = createHash('sha256').update(realpathSync(dataDir).toLowerCase()).digest('hex');
  const pipe = `\\\\.\\pipe\\launch-loop-data-${key}`;
  const lease = net.createServer(socket => socket.destroy());
  try {
    await new Promise((resolve, reject) => {
      lease.once('error', reject);
      lease.listen(pipe, () => { lease.off('error', reject); resolve(); });
    });
  } catch (error) {
    if (error.code === 'EADDRINUSE') throw new Error('此数据目录已有工作台服务运行。请使用原服务，或先用对应目录的停止脚本停服；不能同时打开两个服务。');
    throw error;
  }
  lease.on('error', () => {});
  let closing;
  return () => closing ??= new Promise((resolve, reject) => lease.close(error => error ? reject(error) : resolve()));
}
