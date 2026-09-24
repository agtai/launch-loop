import {useCallback, useEffect, useRef, useState} from 'react';
import {Check, ChevronDown, FileText, Image, LoaderCircle, Pencil, Plus, RefreshCw, Save, Sparkles, Upload, X} from 'lucide-react';
import type {ContentBrief, ContentDraft, ContentItem, ContentSource, ContentSummary, ContentTmp, ContentUploadInput, ContentVersion, GenerationCapabilities, GenerationJob, GenerationOptions, GenerationRequest, ModificationRequest} from './content-types';
import {contentApi, ContentApiError, downloadDraft, errorMessage, languageNames, platformNames, uploadInput} from './content-api';
import './content-workspace.css';

const stageNames: Record<string, string> = {queued: '等待执行', reading: '读取资料', generating: '生成初稿', reviewing: '自动审核一次', revising: '修订最终稿', completed: '文本流程完成', failed: '执行失败', cancelled: '已取消', cancelling: '正在取消', interrupted: '执行中断', running: '执行中'};
const running = (job: GenerationJob) => ['queued', 'running', 'cancelling'].includes(job.status);
const initialBrief: ContentBrief = {materials: [], purpose: '', audience: '', platforms: ['linkedin'], languages: ['zh', 'en'], formats: ['short_post'], authorIdentity: [], styleTerms: [], lengthDepth: [], references: []};
type InputFile = {upload: ContentUploadInput; role: 'material' | 'reference' | 'image'};
type Selection = ModificationRequest['selection'];
type SavedView = {item: ContentItem; version: ContentVersion};

function Checks<T extends string>({label, options, selected, onChange}: {label: string; options: readonly (readonly [T, string])[]; selected: T[]; onChange: (values: T[]) => void}) {
  return <fieldset className='cw-checks'><legend>{label}</legend><div>{options.map(([id, name]) => <label key={id}><input type='checkbox' checked={selected.includes(id)} onChange={e => onChange(e.target.checked ? [...selected, id] : selected.filter(x => x !== id))}/><span>{name}</span></label>)}</div></fieldset>;
}

export default function ContentWorkspace({onDirtyChange, active = true, dataEpoch = 0}: {onDirtyChange?: (dirty: boolean) => void; active?: boolean; dataEpoch?: number}) {
  const [brief, setBrief] = useState<ContentBrief>(initialBrief), [name, setName] = useState('');
  const [materials, setMaterials] = useState(''), [references, setReferences] = useState(''), [referenceUrl, setReferenceUrl] = useState('');
  const [files, setFiles] = useState<InputFile[]>([]), [options, setOptions] = useState<GenerationOptions>({});
  const [capabilities, setCapabilities] = useState<GenerationCapabilities | null>(null);
  const [jobs, setJobs] = useState<GenerationJob[]>([]), [temps, setTemps] = useState<ContentTmp[]>([]), [saved, setSaved] = useState<ContentSummary[]>([]);
  const [tmp, setTmp] = useState<ContentTmp | null>(null), [draft, setDraft] = useState<ContentDraft | null>(null), [savedView, setSavedView] = useState<SavedView | null>(null);
  const [dirty, setDirty] = useState(false), [saveState, setSaveState] = useState(''), [error, setError] = useState(''), [conflict, setConflict] = useState(false), [busy, setBusy] = useState(false);
  const [selection, setSelection] = useState<Selection | null>(null), [instruction, setInstruction] = useState('');
  const [proposalJob, setProposalJob] = useState<GenerationJob | null>(null), [proposal, setProposal] = useState<ContentTmp | null>(null);
  const tmpRef = useRef(tmp), draftRef = useRef(draft), dirtyRef = useRef(false), editEpoch = useRef(0), inFlightSave = useRef<Promise<ContentTmp | null> | null>(null);
  const conflictRef = useRef(false), requestRef = useRef<{key: string; id: string} | null>(null), loadedProposal = useRef('');
  const restoreEpochRef = useRef(dataEpoch), operationRef = useRef(false);
  restoreEpochRef.current = dataEpoch;
  const formDirtyRef = useRef(false);
  formDirtyRef.current = !!(name || materials || references || referenceUrl || files.length || brief.purpose || brief.audience) || JSON.stringify(brief) !== JSON.stringify(initialBrief) || Object.keys(options).length > 0;
  tmpRef.current = tmp; draftRef.current = draft; dirtyRef.current = dirty; conflictRef.current = conflict;

  const refresh = useCallback(async () => {
    const results = await Promise.allSettled([
      contentApi<GenerationCapabilities>('/api/generation/capabilities'), contentApi<{items: GenerationJob[]}>('/api/generation/jobs'),
      contentApi<{items: ContentTmp[]}>('/api/content/tmp'), contentApi<{items: ContentSummary[]}>('/api/content'),
    ]);
    if (results[0].status === 'fulfilled') setCapabilities(results[0].value);
    if (results[1].status === 'fulfilled') setJobs(results[1].value.items);
    if (results[2].status === 'fulfilled') setTemps(results[2].value.items);
    if (results[3].status === 'fulfilled') setSaved(results[3].value.items);
    const failure = results.find(x => x.status === 'rejected');
    if (failure?.status === 'rejected') setError(errorMessage(failure.reason));
  }, []);
  useEffect(() => {if (active) void refresh();}, [refresh, active, dataEpoch]);
  useEffect(() => {
    if (!dataEpoch) return;
    const current = tmpRef.current;
    if (current) void contentApi<{item: ContentTmp}>(`/api/content/tmp/${current.id}`).then(({item}) => {
      if (tmpRef.current?.id !== current.id) return;
      tmpRef.current = item; setTmp(item);
      if (item.stale) {conflictRef.current = true; setConflict(true); setSaveState('恢复前的暂存 · 本地修改已保留，请派生新暂存');}
    }).catch(e => setError(errorMessage(e)));
    if (savedView) {setSavedView(null); setSaveState('备份已恢复，请从作品库重新打开正式版本');}
  }, [dataEpoch]);
  useEffect(() => {onDirtyChange?.(dirty);}, [dirty, onDirtyChange]);
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {if (dirtyRef.current || inFlightSave.current || formDirtyRef.current) {event.preventDefault(); event.returnValue = '';}};
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, []);
  useEffect(() => {
    let stopped = false;
    const timer = setInterval(async () => {
      if (!jobs.some(running) && !(proposalJob && running(proposalJob))) return;
      try {
        const {items} = await contentApi<{items: GenerationJob[]}>('/api/generation/jobs');
        if (stopped) return;
        setJobs(items);
        if (proposalJob) setProposalJob(items.find(x => x.id === proposalJob.id) || proposalJob);
      } catch (e) {if (!stopped) setError(errorMessage(e));}
    }, 1800);
    return () => {stopped = true; clearInterval(timer);};
  }, [jobs, proposalJob]);
  useEffect(() => {
    if (proposalJob?.status !== 'completed' || loadedProposal.current === proposalJob.id) return;
    const id = proposalJob.variants.find(x => x.tmpId)?.tmpId;
    if (!id) return;
    loadedProposal.current = proposalJob.id;
    let active = true;
    void contentApi<{item: ContentTmp}>(`/api/content/tmp/${id}`).then(({item}) => {if (active) setProposal(item);}).catch(e => {loadedProposal.current = ''; if (active) setError(errorMessage(e));});
    return () => {active = false;};
  }, [proposalJob?.id, proposalJob?.status]);

  async function persist(): Promise<ContentTmp | null> {
    if (inFlightSave.current) {await inFlightSave.current; if (dirtyRef.current && !conflictRef.current) return persist(); return tmpRef.current;}
    const current = tmpRef.current, body = draftRef.current;
    if (!current || !body || !dirtyRef.current) return current;
    if (conflictRef.current || current.stale || current.confirmed) throw new Error('请先处理版本冲突或派生新的暂存。');
    const epoch = editEpoch.current, restoreAtStart = restoreEpochRef.current;
    setSaveState('正在暂存…');
    const promise = contentApi<{item: ContentTmp}>(`/api/content/tmp/${current.id}`, 'PUT', {revision: current.revision, content: body, temporary: current.temporary})
      .then(({item}) => {
        if (tmpRef.current?.id !== current.id || restoreEpochRef.current !== restoreAtStart) return item;
        tmpRef.current = item; setTmp(item);
        if (editEpoch.current === epoch) {dirtyRef.current = false; setDirty(false); setSaveState('已暂存 · 待确认保存');}
        else setSaveState('仍有新修改等待暂存');
        return item;
      }).catch(e => {
        if (e instanceof ContentApiError && e.status === 409) {conflictRef.current = true; setConflict(true);}
        setSaveState('暂存失败，修改仍在当前页面'); setError(errorMessage(e)); throw e;
      }).finally(() => {inFlightSave.current = null;});
    inFlightSave.current = promise;
    return promise;
  }
  useEffect(() => {
    if (!dirty || conflict || busy) return;
    const timeout = setTimeout(() => {void persist().catch(() => undefined);}, 800);
    return () => clearTimeout(timeout);
  }, [dirty, draft, conflict, busy]);

  function installTmp(item: ContentTmp) {
    if (restoreEpochRef.current !== dataEpoch) {setError('数据已恢复，请重新打开暂存。当前编辑仍保留。'); return;}
    editEpoch.current++; tmpRef.current = item; draftRef.current = structuredClone(item.content); dirtyRef.current = false; conflictRef.current = false;
    setTmp(item); setDraft(structuredClone(item.content)); setSavedView(null); setDirty(false); setConflict(false); setSelection(null); setProposal(null); setProposalJob(null);
    setSaveState(item.stale ? '恢复前的暂存 · 只读' : item.confirmed ? '此暂存已确认保存 · 只读' : '已暂存 · 待确认保存');
  }
  async function guarded(action: () => Promise<void>) {
    if (operationRef.current) return;
    operationRef.current = true; setBusy(true); setError('');
    try {await action();} catch (e) {setError(errorMessage(e));} finally {operationRef.current = false; setBusy(false);}
  }
  async function openTmp(id: string) {
    await guarded(async () => {await persist(); const {item} = await contentApi<{item: ContentTmp}>(`/api/content/tmp/${id}`); installTmp(item);});
  }
  async function openSaved(id: string) {
    await guarded(async () => {await persist(); const {item} = await contentApi<{item: ContentItem}>(`/api/content/${id}`); const version = item.versions.find(v => v.id === item.currentVersionId)!;
      if (restoreEpochRef.current !== dataEpoch) return;
      tmpRef.current = null; draftRef.current = null; setTmp(null); setDraft(null); setSavedView({item, version}); setSelection(null); setProposal(null); setProposalJob(null); setSaveState('已确认保存');
    });
  }
  function editDocument(documentId: string, blockId: string | null, value: string) {
    if (!draft || !tmp || tmp.stale || tmp.confirmed) return;
    const next = {...draft, documents: draft.documents.map(doc => doc.id !== documentId ? doc : blockId === null ? {...doc, title: value} : {...doc, blocks: doc.blocks.map(block => block.id === blockId ? {...block, text: value} : block)})};
    editEpoch.current++; dirtyRef.current = true; draftRef.current = next; setDraft(next); setDirty(true); setSelection(null); setSaveState('有修改等待暂存');
  }
  async function addFiles(list: FileList | null, role: InputFile['role']) {
    if (!list) return;
    await guarded(async () => {
      const added: InputFile[] = [];
      for (const file of Array.from(list)) {
        if (role !== 'image' && !/\.(txt|md)$/i.test(file.name)) throw new Error('资料与参考文件当前只支持 .txt / .md，请先转换为文本文件。');
        if (role === 'image' && !['image/png', 'image/jpeg'].includes(file.type)) throw new Error('配图当前支持 PNG、JPEG。');
        added.push({upload: await uploadInput(file), role});
      }
      setFiles(prev => [...prev, ...added]);
    });
  }
  function sourceFor(file: InputFile): ContentSource {return {id: file.upload.id, label: file.upload.fileName, type: 'asset', assetId: file.upload.id};}
  async function generate() {
    await guarded(async () => {
      await persist();
      const materialSources: ContentSource[] = [...(materials.trim() ? [{id: 'brief-materials', label: '产品资料／已有内容', type: 'text' as const, text: materials}] : []), ...files.filter(f => f.role === 'material').map(sourceFor)];
      if (!materialSources.length || !brief.purpose.trim() || !brief.audience.trim()) throw new Error('请填写产品资料／已有内容、写作目的、目标读者；资料也可上传 .txt / .md 文件。');
      const referenceSources: ContentSource[] = [...(references.trim() ? [{id: 'reference-text', label: '参考文章／旧稿', type: 'text' as const, text: references}] : []), ...(referenceUrl.trim() ? [{id: 'reference-url', label: '参考链接', type: 'url' as const, url: referenceUrl.trim()}] : []), ...files.filter(f => f.role === 'reference').map(sourceFor)];
      const payload = {name: name.trim() || brief.purpose.trim().slice(0, 80), brief: {...brief, materials: materialSources, references: referenceSources}, uploads: files.map(f => f.upload), options};
      const key = JSON.stringify(payload);
      const previousJob = jobs.find(job => job.requestId === requestRef.current?.id);
      if (requestRef.current?.key !== key || previousJob && !running(previousJob)) requestRef.current = {key, id: crypto.randomUUID()};
      const input: GenerationRequest = {...payload, requestId: requestRef.current!.id};
      const {job} = await contentApi<{job: GenerationJob}>('/api/generation/jobs', 'POST', input);
      setJobs(prev => [job, ...prev.filter(x => x.id !== job.id)]);
    });
  }
  async function confirmSave() {
    await guarded(async () => {
      const current = await persist();
      if (!current) return;
      let result: {item: ContentItem; version: ContentVersion};
      try {result = await contentApi<{item: ContentItem; version: ContentVersion}>(`/api/content/tmp/${current.id}/confirm`, 'POST', {revision: current.revision, confirmed: true});}
      catch (e) {if (e instanceof ContentApiError && e.status === 409) {conflictRef.current = true; setConflict(true);} throw e;}
      const {item, version} = result;
      if (restoreEpochRef.current !== dataEpoch) {await refresh(); return;}
      tmpRef.current = null; draftRef.current = null; setTmp(null); setDraft(null); setSavedView({item, version}); setSelection(null); setProposal(null); setProposalJob(null); setSaveState(`已确认保存 · 版本 ${version.number}`); await refresh();
    });
  }
  async function reviseSaved() {
    if (!savedView) return;
    await guarded(async () => {const {item} = await contentApi<{item: ContentTmp}>(`/api/content/${savedView.item.id}/revise`, 'POST', {revision: savedView.item.revision}); installTmp(item);});
  }
  async function forkTmp() {
    if (!tmp) return;
    await guarded(async () => {
      const {item: latest} = await contentApi<{item: ContentTmp}>(`/api/content/tmp/${tmp.id}`);
      const {item} = await contentApi<{item: ContentTmp}>(`/api/content/tmp/${tmp.id}/fork`, 'POST', {revision: latest.revision, base: null});
      const local = draftRef.current;
      installTmp(item);
      if (local) {draftRef.current = local; dirtyRef.current = true; setDraft(local); setDirty(true); editEpoch.current++;}
      setSaveState('已派生为新作品暂存；保留当前编辑，尚未正式保存');
    });
  }
  async function modifySelection() {
    if (!selection || !instruction.trim()) return;
    await guarded(async () => {
      const current = await persist(); if (!current) return;
      const body: ModificationRequest = {requestId: crypto.randomUUID(), tmpId: current.id, revision: current.revision, selection, instruction};
      const {job} = await contentApi<{job: GenerationJob}>('/api/generation/modifications', 'POST', body);
      setProposal(null); loadedProposal.current = ''; setProposalJob(job); setJobs(prev => [job, ...prev.filter(x => x.id !== job.id)]);
    });
  }
  async function acceptProposal() {
    if (!proposalJob || !tmp) return;
    await guarded(async () => {
      const current = await persist(); if (!current) return;
      if (current.id !== proposalJob.source?.tmpId || current.revision !== proposalJob.source.revision) throw new Error('源稿在提案期间已修改。请放弃此提案，再选择文字发起修改。');
      const {item} = await contentApi<{item: ContentTmp}>(`/api/generation/jobs/${proposalJob.id}/accept`, 'POST', {sourceRevision: current.revision});
      installTmp(item); setInstruction('');
    });
  }
  async function cancelJob(job: GenerationJob) {
    await guarded(async () => {const {job: updated} = await contentApi<{job: GenerationJob}>(`/api/generation/jobs/${job.id}/cancel`, 'POST', {}); setJobs(prev => prev.map(x => x.id === updated.id ? updated : x)); if (proposalJob?.id === updated.id) setProposalJob(updated);});
  }
  async function openJobVariant(job: GenerationJob, tmpId: string) {
    if (job.kind !== 'modification') return openTmp(tmpId);
    await guarded(async () => {
      await persist();
      if (!job.source) throw new Error('修改任务缺少源稿，不能接受此提案。');
      const {item: source} = await contentApi<{item: ContentTmp}>(`/api/content/tmp/${job.source.tmpId}`);
      const {item: result} = await contentApi<{item: ContentTmp}>(`/api/content/tmp/${tmpId}`);
      installTmp(source); loadedProposal.current = job.id; setProposalJob(job); setProposal(result);
    });
  }
  const shown = draft || savedView?.version.content;
  const assets = tmp?.assets || savedView?.version.assets || [];
  const editable = !!tmp && !tmp.stale && !tmp.confirmed && !busy;
  const activeJob = jobs.find(j => j.variants.some(v => v.tmpId === tmp?.id));
  const activeVariant = activeJob?.variants.find(v => v.tmpId === tmp?.id);
  const incomplete = !!activeJob && running(activeJob);
  const unsupported = brief.platforms.some(p => p !== 'linkedin') || brief.formats.some(f => f !== 'short_post');
  const unconfigured = !brief.platforms.length || !brief.languages.length || !brief.formats.length;

  return <div className='cw'>
    <div className='page-heading'><div><span className='eyebrow'>CREATE / 01</span><h1>从资料到一份可发布的稿件。</h1><p>生成初稿 → 自动审核一次 → 修订最终稿，再由你修改、确认保存。</p></div><button className='button' onClick={() => void refresh()}><RefreshCw size={16}/>刷新记录</button></div>
    {error && <div className='cw-alert' role='alert'><span>{error}</span><button aria-label='关闭提示' onClick={() => setError('')}><X size={17}/></button></div>}
    <div className='cw-columns'>
      <section className='panel cw-brief'>
        <div className='cw-section-heading'><h2>创作要求</h2><span className='tag'>先文本</span></div>
        <form onSubmit={event => {event.preventDefault(); void generate();}}>
          <fieldset disabled={busy} className='cw-form-fields'>
            <label>作品名称 <span className='cw-optional'>可选</span><input value={name} onChange={e => setName(e.target.value)} placeholder='便于你之后找到这组稿件'/></label>
            <label>产品资料／已有内容 <span className='cw-required'>必填</span><small>例如：产品介绍、功能事实、已有草稿。可粘贴文字或上传文本文件。</small><textarea rows={6} value={materials} onChange={e => setMaterials(e.target.value)} placeholder='这是什么产品？有哪些有依据的事实和重点？'/></label>
            <label className='cw-upload'><Upload size={16}/>上传资料 .txt / .md<input type='file' multiple accept='.txt,.md,text/plain,text/markdown' onChange={e => {void addFiles(e.target.files, 'material'); e.target.value = '';}}/></label>
            <label>写作目的 <span className='cw-required'>必填</span><small>例如：解释新功能、分享实践经验，或介绍产品解决的问题。</small><textarea rows={2} required value={brief.purpose} onChange={e => setBrief({...brief, purpose: e.target.value})}/></label>
            <label>目标读者 <span className='cw-required'>必填</span><small>例如：正在搭建 AI Agent 的开发者；说明他们的背景或困扰。</small><textarea rows={2} required value={brief.audience} onChange={e => setBrief({...brief, audience: e.target.value})}/></label>
            <details className='cw-options' open><summary>可选配置 <ChevronDown size={16}/></summary><p className='cw-help'>本次试运行预设：LinkedIn、中文和英文、普通动态。可以修改；这不是全局默认值。</p>
              <Checks label='平台' options={Object.entries(platformNames) as [keyof typeof platformNames, string][]} selected={brief.platforms} onChange={platforms => setBrief({...brief, platforms})}/>
              <Checks label='语言' options={Object.entries(languageNames) as [keyof typeof languageNames, string][]} selected={brief.languages} onChange={languages => setBrief({...brief, languages})}/>
              <Checks label='内容格式' options={[['short_post', '普通动态'], ['long_article', '长文章 / Pulse（待适配）'], ['thread', '串帖（待适配）']]} selected={brief.formats} onChange={formats => setBrief({...brief, formats})}/>
              <p className='cw-help'>仅平台 × 语言拆稿：当前 {brief.platforms.length * brief.languages.length} 份。其他选项合并到每份稿件。</p>
              {unsupported && <p className='cw-warning'>X、小红书、知乎、Bilibili 及长文章／串帖尚未适配。本次组合不能执行，不会跳过这些选择。</p>}
              {unconfigured && <p className='cw-warning'>平台、语言或格式未选；默认值尚未确定，请先配置本次试稿。</p>}
              <Checks label='作者身份' options={[['product_author', '产品作者'], ['team', '团队'], ['third_party', '第三方观察者']]} selected={options.authorIdentities || []} onChange={authorIdentities => {setOptions({...options, authorIdentities}); setBrief({...brief, authorIdentity: authorIdentities.map(x => ({product_author: '产品作者', team: '团队', third_party: '第三方观察者'})[x])});}}/>
              <Checks label='表达风格' options={[['professional', '专业'], ['plain', '自然易懂'], ['concise', '简洁']]} selected={options.styles || []} onChange={styles => setOptions({...options, styles})}/>
              <label>风格／术语补充<small>自由补充品牌语气、需要解释的术语等，不增加稿件数量。</small><input value={brief.styleTerms.join('；')} onChange={e => setBrief({...brief, styleTerms: e.target.value ? [e.target.value] : []})}/></label>
              <Checks label='篇幅深度' options={[['brief', '简短'], ['standard', '标准'], ['detailed', '深入']]} selected={options.depths || []} onChange={depths => {setOptions({...options, depths}); setBrief({...brief, lengthDepth: depths.map(x => ({brief: '简短', standard: '标准', detailed: '深入'})[x])});}}/>
              <label>参考文章／旧稿<textarea rows={3} value={references} onChange={e => setReferences(e.target.value)} placeholder='提供希望参考的结构或语气'/></label>
              <label>参考链接<input type='url' value={referenceUrl} onChange={e => setReferenceUrl(e.target.value)} placeholder='https://…'/><small>本阶段尚不读取链接，请粘贴正文或上传 .txt / .md 文本。</small></label>
              <label className='cw-upload'><Upload size={16}/>上传参考 .txt / .md<input type='file' multiple accept='.txt,.md' onChange={e => {void addFiles(e.target.files, 'reference'); e.target.value = '';}}/></label>
            </details>
            <label className='cw-upload'><Image size={16}/>选用配图（可选）<input type='file' multiple accept='image/png,image/jpeg' onChange={e => {void addFiles(e.target.files, 'image'); e.target.value = '';}}/></label>
            <p className='cw-help'>未选用配图时会请求自动配图。上传支持 PNG / JPEG；本轮 LinkedIn 发布仅支持单张图片。{capabilities?.image.message || '正在检查配图连接…'} 每个文件最多 4 MiB。</p>
            {!!files.length && <ul className='cw-files'>{files.map(file => <li key={file.upload.id}><span>{file.role === 'material' ? '资料' : file.role === 'reference' ? '参考' : '配图'} · {file.upload.fileName}</span><button type='button' aria-label={`移除 ${file.upload.fileName}`} onClick={() => setFiles(prev => prev.filter(x => x !== file))}><X size={15}/></button></li>)}</ul>}
            <div className='cw-connection'><span className={'cw-dot ' + (capabilities?.text.status === 'available' ? 'connected' : '')}/><span>{capabilities?.text.message || '正在检查文字生成入口…'}</span></div>
            <button className='button primary full' type='submit' disabled={busy || unsupported || unconfigured || capabilities?.text.status === 'unavailable'}>{busy ? <LoaderCircle size={17}/> : <Sparkles size={17}/>}生成并自动审核修订</button>
            <p className='cw-help'>生成结果仅暂存。点击右侧“确认保存此版本”才会进入正式作品库。</p>
          </fieldset>
        </form>
      </section>
      <div className='cw-writing-column'>
        {!!jobs.length && <section className='panel cw-jobs'><div className='cw-section-heading'><h2>本机创作任务</h2><small>实际执行状态</small></div>{jobs.slice(0, 8).map(job => <div className='cw-job' key={job.id}><div className='cw-job-header'><strong>{job.kind === 'modification' ? '局部改稿' : '生成与审核'}</strong><span className='tag'>{stageNames[job.status === 'running' ? job.stage : job.status] || job.stage}</span><small>{new Date(job.createdAt).toLocaleString()}</small>{running(job) && <button className='button small-btn' disabled={busy} onClick={() => void cancelJob(job)}>取消</button>}</div>{job.error && <p className='cw-warning'>{job.error}</p>}<div className='cw-variants'>{job.variants.map(variant => <button className={'cw-variant ' + (tmp?.id === variant.tmpId ? 'selected' : '')} key={variant.platform + variant.language} disabled={!variant.tmpId || running(job) || busy} onClick={() => variant.tmpId && void openJobVariant(job, variant.tmpId)}><strong>{platformNames[variant.platform]} · {languageNames[variant.language]}</strong><span>{stageNames[variant.stage] || variant.stage}</span>{variant.error && <small>{variant.error}</small>}{variant.assetStatus === 'unconnected' && <small>自动配图未连接</small>}</button>)}</div>{!running(job) && ['failed', 'cancelled', 'interrupted'].includes(job.status) && job.kind === 'generation' && <button className='text-btn' disabled={busy} onClick={() => {requestRef.current = null; void generate();}}>按当前左侧资料重新生成</button>}</div>)}</section>}
        <section className='panel cw-editor' aria-label='正文编辑器'>
          <div className='cw-section-heading'><h2>{shown ? '看稿与修改' : '稿件将在这里呈现'}</h2><span className='cw-save-status' role='status'>{savedView ? `已确认保存 · 正在查看版本 ${savedView.version.number}` : saveState}</span></div>
          {!shown ? <div className='cw-empty'><FileText size={42}/><h3>把想说的事，写清楚。</h3><p>填写左侧三项资料，生成后可切换中英文、直接编辑段落，也可以选中文字提交修改意见。</p><span>初稿 · 一次自动审核 · 修订稿</span></div> : <>
            <div className='cw-editor-toolbar'><strong>{shown.name}</strong><span className='tag'>{shown.platform ? platformNames[shown.platform] : '未选平台'} · {shown.language ? languageNames[shown.language] : '未选语言'}</span>
              {savedView && <label className='cw-version'>历史版本<select aria-label='历史版本' value={savedView.version.id} onChange={e => setSavedView({...savedView, version: savedView.item.versions.find(v => v.id === e.target.value)!})}>{savedView.item.versions.map(version => <option key={version.id} value={version.id}>版本 {version.number} · {new Date(version.createdAt).toLocaleString()}</option>)}</select></label>}
            </div>
            {savedView && <div className='cw-saved-notice'><Check size={16}/><span>{savedView.version.id !== savedView.item.currentVersionId ? '正在查看历史版本。开始新修订将从最新正式版本创建暂存，不从当前历史版本派生。' : '已正式保存。继续修改将从当前最新正式版本创建暂存，保留旧版。'}</span><button className='button small-btn' disabled={busy} onClick={() => void reviseSaved()}><Pencil size={14}/>开始新修订</button></div>}
            {(tmp?.stale || tmp?.confirmed || conflict) && <div className='cw-warning'><p>{tmp?.stale ? '此暂存在恢复备份前创建，不能直接覆盖恢复后的数据。' : tmp?.confirmed ? '此暂存已经确认，不能再直接修改。' : '当前稿件与服务器版本冲突。你的编辑仍保留，自动暂存已暂停。'}</p><div className='cw-actions'><button className='button small-btn' disabled={busy} onClick={() => void forkTmp()}>保留当前编辑，派生为新作品</button><button className='button small-btn' onClick={() => downloadDraft('未保存改稿.json', {content: draft, temporary: tmp?.temporary})}>下载当前编辑</button>{conflict && <button className='button small-btn' disabled={busy} onClick={() => {if (window.confirm('放弃当前页面的本地修改，读取服务器上的最新暂存？')) void guarded(async () => {const {item} = await contentApi<{item: ContentTmp}>(`/api/content/tmp/${tmp!.id}`); installTmp(item);});}}>放弃本地修改，读取最新</button>}</div></div>}
            <div className='cw-documents'>{shown.documents.map(doc => <article className='cw-document' key={doc.id}><input className='cw-title-input' aria-label='文章标题' readOnly={!editable || incomplete} value={doc.title} onChange={e => editDocument(doc.id, null, e.target.value)}/>{doc.blocks.map((block, index) => <label className={'cw-block cw-block-' + block.type} key={block.id}><span>{block.type === 'heading' ? '小标题' : `段落 ${index + 1}`}</span><textarea aria-label={`正文段落 ${index + 1}`} rows={Math.max(2, Math.min(14, Math.ceil(block.text.length / 65)))} readOnly={!editable || incomplete} value={block.text} onChange={e => editDocument(doc.id, block.id, e.target.value)} onSelect={e => {const el = e.currentTarget; if (el.selectionStart !== el.selectionEnd && editable) setSelection({documentId: doc.id, blockId: block.id, start: el.selectionStart, end: el.selectionEnd, text: el.value.slice(el.selectionStart, el.selectionEnd)});}}/></label>)}{doc.postingNote && <p className='cw-help'>{doc.postingNote}</p>}</article>)}</div>
            {!!assets.length && <div className='cw-assets'>{assets.filter(a => shown.assetIds.includes(a.id)).map(asset => {const url = tmp ? `/api/content/tmp/${tmp.id}/assets/${asset.id}` : `/api/content/${savedView!.item.id}/versions/${savedView!.version.id}/assets/${asset.id}`; return <figure key={asset.id}>{asset.mimeType.startsWith('image/') && <img src={url} alt={asset.caption || asset.fileName}/>}<figcaption><a href={url} download>{asset.fileName}</a>{asset.caption && <p>{asset.caption}</p>}</figcaption></figure>;})}</div>}
            {activeVariant?.assetStatus === 'unconnected' && <p className='cw-warning'>文本流程已完成，自动配图未连接；本稿没有自动生成的图片。</p>}
            {!!activeVariant?.unresolved.length && <section className='cw-review'><h3>尚未解决的审核问题</h3><ul>{activeVariant.unresolved.map((finding, index) => <li key={index}>{finding}</li>)}</ul></section>}
            {tmp?.temporary.reviewFindings && <details className='cw-review'><summary>查看自动审核记录</summary><pre>{tmp.temporary.reviewFindings}</pre></details>}
            {editable && !incomplete && <section className='cw-selection'><h3>选中文字，提出局部修改</h3>{selection ? <blockquote>{selection.text}</blockquote> : <p className='cw-help'>在上方某个段落内拖选文字。未选中的文字和其他段落保持不变。</p>}<textarea aria-label='局部修改意见' rows={2} value={instruction} onChange={e => setInstruction(e.target.value)} placeholder='例如：用更直接的措辞，保留事实和数字。'/><button className='button' disabled={!selection || !instruction.trim() || busy || !!proposalJob && running(proposalJob)} onClick={() => void modifySelection()}><Sparkles size={15}/>生成局部修改提案</button></section>}
            {proposalJob && <section className='cw-proposal'><div className='cw-section-heading'><h3>局部修改提案 · {stageNames[proposalJob.status] || proposalJob.status}</h3><button className='text-btn' onClick={() => {setProposalJob(null); setProposal(null);}}>放弃提案</button></div>{proposalJob.error && <p className='cw-warning'>{proposalJob.error}</p>}{proposal && <><p className='cw-help'>预览提案全文。接受后仍是暂存，尚未正式保存。</p>{proposal.content.documents.map(doc => <div key={doc.id}><h4>{doc.title}</h4>{doc.blocks.map(block => <p className='cw-proposal-text' key={block.id}>{block.text}</p>)}</div>)}<button className='button primary' disabled={busy || dirty || proposalJob.source?.revision !== tmp?.revision} onClick={() => void acceptProposal()}>接受提案</button>{(dirty || proposalJob.source?.revision !== tmp?.revision) && <p className='cw-warning'>源稿已经修改，此提案不能再接受。请放弃并重新发起。</p>}</>}</section>}
            {tmp && !tmp.stale && !tmp.confirmed && !incomplete && <div className='cw-confirm-bar'><span>确认保存只保存本机版本，不会发布。</span><button className='button primary' disabled={busy || conflict || !!proposalJob && running(proposalJob)} onClick={() => void confirmSave()}><Save size={16}/>确认保存此版本</button></div>}
          </>}
        </section>
        <section className='panel cw-library'><div className='cw-section-heading'><h2>稿件库</h2><button className='text-btn' onClick={() => void refresh()}><RefreshCw size={14}/>刷新</button></div><details open><summary>已确认作品（{saved.length}）</summary>{!saved.length && <p className='cw-help'>确认保存的作品会出现在这里，发布页只读取这些正式版本。</p>}{saved.map(item => <button className='cw-library-item' disabled={busy} key={item.id} onClick={() => void openSaved(item.id)}><FileText size={16}/><span><strong>{item.name}</strong><small>{platformNames[item.platform]} · {languageNames[item.language]} · 版本 {item.versionNumber}</small></span><Check size={16}/></button>)}</details><details><summary>暂存草稿（{temps.filter(item => !item.confirmed && !jobs.some(job => job.kind === 'modification' && job.variants.some(v => v.tmpId === item.id))).length}）</summary>{temps.filter(item => !item.confirmed && !jobs.some(job => job.kind === 'modification' && job.variants.some(v => v.tmpId === item.id))).map(item => <button className='cw-library-item' key={item.id} disabled={busy || jobs.some(job => running(job) && job.variants.some(v => v.tmpId === item.id))} onClick={() => void openTmp(item.id)}><Pencil size={16}/><span><strong>{item.content.name}</strong><small>{item.content.language ? languageNames[item.content.language] : '未选语言'} · {item.stale ? '恢复前暂存' : '未正式保存'}</small></span><Plus size={15}/></button>)}</details></section>
      </div>
    </div>
  </div>;
}
