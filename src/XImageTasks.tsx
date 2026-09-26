import {useEffect, useRef, useState} from 'react';
import {contentApi, errorMessage} from './content-api';
import type {ContentTmp, XImageCapability, XImageJob} from './content-types';
import {useI18n} from './i18n';

const active = (job: XImageJob) => ['queued', 'running', 'cancelling'].includes(job.status);
const states: Record<string, string> = {queued: '等待配图', generating: '正在生成图片', checking: '正在检查实际图片', running: '配图执行中', ready: '配图已完成', completed: '配图已完成', failed: '配图失败', cancelled: '配图已取消', cancelling: '正在取消配图', interrupted: '配图已中断'};
export default function XImageTasks({tmp, disabled, beforeStart, onApplied}: {tmp: ContentTmp; disabled: boolean; beforeStart: () => Promise<ContentTmp | null>; onApplied: (id: string, revision: number) => Promise<boolean>}) {
  const {t} = useI18n();
  const [capability, setCapability] = useState<XImageCapability | null>(null), [jobs, setJobs] = useState<XImageJob[]>([]);
  const [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const busyRef = useRef(false), applied = useRef(new Set<string>()), onAppliedRef = useRef(onApplied);
  onAppliedRef.current = onApplied;
  useEffect(() => {
    let stopped = false, fetching = false;
    const refresh = async () => {
      if (fetching) return; fetching = true;
      try {
        const [cap, list] = await Promise.all([contentApi<{capability: XImageCapability}>('/api/x-images/capabilities'), contentApi<{items: XImageJob[]}>('/api/x-images/jobs?tmpId=' + encodeURIComponent(tmp.id))]);
        if (stopped) return;
        setCapability(cap.capability); setJobs(list.items);
        for (const job of list.items) if (job.status === 'ready' && job.resultRevision != null && !applied.current.has(job.id)) {
          if (await onAppliedRef.current(tmp.id, job.resultRevision)) applied.current.add(job.id);
        }
      } catch (cause) {if (!stopped) setError(errorMessage(cause));}
      finally {fetching = false;}
    };
    void refresh(); const timer = setInterval(() => void refresh(), 2000);
    return () => {stopped = true; clearInterval(timer);};
  }, [tmp.id]);
  async function run(action: () => Promise<void>) {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError('');
    try {await action();} catch (cause) {setError(errorMessage(cause));}
    finally {busyRef.current = false; setBusy(false);}
  }
  async function start(documentId: string, mode: 'generate' | 'check') {
    await run(async () => {
      const current = await beforeStart(); if (!current || current.id !== tmp.id) return;
      const {job} = await contentApi<{job: XImageJob}>('/api/x-images/jobs', 'POST', {requestId: crypto.randomUUID(), tmpId: current.id, revision: current.revision, documentId, mode});
      setJobs(previous => [job, ...previous.filter(item => item.id !== job.id)]);
    });
  }
  const running = jobs.some(active);
  return <section className='x-image-tasks'>
    <div className='cw-section-heading'><h3>{t('后台配图')}</h3><button className='button small-btn' disabled={busy || capability?.checking || capability?.canRefresh === false} onClick={() => void run(async () => {const result = await contentApi<{capability: XImageCapability}>('/api/x-images/capabilities/refresh', 'POST', {}); setCapability(result.capability);})}>{t('重新检查配图入口')}</button></div>
    <p className='cw-help'>{t(capability?.checking ? '正在检查配图入口…' : capability?.available ? 'Codex 配图入口可用；生成和看图检查仍以每次实际结果为准。' : capability?.reason || '正在读取配图状态…')}</p>
    <p className='cw-help'>{t('配图仅写入暂存。修改正文会使旧关联失效；失败不会覆盖正文。')}</p>
    {error && <p className='cw-warning' role='alert'>{t(error)}</p>}
    {tmp.content.documents.map(doc => {
      const latest = jobs.filter(job => job.documentId === doc.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
      return <div className='x-image-job' key={doc.id}><strong>{t(doc.kind === 'thread' ? '串帖首图' : '普通帖子配图')}</strong>
        {latest && <p role='status'>{t(states[latest.stage] || states[latest.status] || '配图执行中')}{latest.error ? ' · ' + t(latest.error) : ''}</p>}
        <div className='cw-actions'>
          <button className='button small-btn' disabled={disabled || busy || running || !capability?.available} onClick={() => void start(doc.id, 'generate')}>{t('生成新配图')}</button>
          <button className='button small-btn' disabled={disabled || busy || running || !doc.blocks[0]?.assetIds?.length} onClick={() => void start(doc.id, 'check')}>{t('自动检查所选图片')}</button>
          {latest && active(latest) && <button className='button small-btn' disabled={busy} onClick={() => void run(async () => {const {job} = await contentApi<{job: XImageJob}>(`/api/x-images/jobs/${latest.id}/cancel`, 'POST', {}); setJobs(previous => previous.map(item => item.id === job.id ? job : item));})}>{t('取消本次配图')}</button>}
        </div>
      </div>;
    })}
  </section>;
}
