import {useCallback, useEffect, useRef, useState} from 'react';
import {Check, ChevronDown, FileText, Image, LoaderCircle, Pencil, Plus, RefreshCw, Save, Sparkles, Upload, X} from 'lucide-react';
import type {ContentBrief, ContentDraft, ContentItem, ContentSource, ContentSummary, ContentTmp, ContentUploadInput, ContentVersion, GenerationCapabilities, GenerationJob, GenerationOptions, GenerationRequest, ModificationRequest} from './content-types';
import {contentApi, ContentApiError, downloadDraft, errorMessage, languageNames, platformNames, uploadInput} from './content-api';
import './content-workspace.css';
import {useI18n} from './i18n';

const stageNames: Record<string, string> = {queued: '等待执行', reading: '读取资料', generating: '生成初稿', reviewing: '自动审核一次', revising: '修订最终稿', completed: '文本流程完成', failed: '执行失败', cancelled: '已取消', cancelling: '正在取消', interrupted: '执行中断', running: '执行中'};
const running = (job: GenerationJob) => ['queued', 'running', 'cancelling'].includes(job.status);
// Model findings are authored content. Only these service-generated notices are UI copy.
const isServiceNotice = (value: string) => value === '自动配图后端未连接；没有生成图片，本稿仍需处理配图。' || value === '局部修改后未再次自动审核，请检查与全文的一致性。' || /^LinkedIn 动态正文超过 3000 限制（含标题：\d+ 个 Unicode 字符，\d+ 个 UTF-16 单位），需缩短后再发布。$/.test(value);
const initialBrief: ContentBrief = {materials: [], purpose: '', audience: '', platforms: ['linkedin'], languages: ['zh', 'en'], formats: ['short_post'], authorIdentity: [], styleTerms: [], lengthDepth: [], references: []};
type InputFile = {upload: ContentUploadInput; role: 'material' | 'reference' | 'image'};
type Selection = ModificationRequest['selection'];
type SavedView = {item: ContentItem; version: ContentVersion};

function Checks<T extends string>({label, options, selected, onChange}: {label: string; options: readonly (readonly [T, string])[]; selected: T[]; onChange: (values: T[]) => void}) {
  const {t} = useI18n();
  return <fieldset className='cw-checks'><legend>{t(label)}</legend><div>{options.map(([id, name]) => <label key={id}><input type='checkbox' checked={selected.includes(id)} onChange={e => onChange(e.target.checked ? [...selected, id] : selected.filter(x => x !== id))}/><span>{t(name)}</span></label>)}</div></fieldset>;
}

export default function ContentWorkspace({onDirtyChange, active = true, dataEpoch = 0}: {onDirtyChange?: (dirty: boolean) => void; active?: boolean; dataEpoch?: number}) {
  const {t, date} = useI18n();
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
      tmpRef.current = null; draftRef.current = null; setTmp(null); setDraft(null); setSavedView({item, version}); setSelection(null); setProposal(null); setProposalJob(null); setSaveState('已确认保存'); await refresh();
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
    <div className='page-heading'><div><span className='eyebrow'>{t('创作 / 01')}</span><h1>{t("从资料到一份可发布的稿件。")}</h1><p>{t("生成初稿 → 自动审核一次 → 修订最终稿，再由你修改、确认保存。")}</p></div><button className='button' onClick={() => void refresh()}><RefreshCw size={16}/>{t("刷新记录")}</button></div>
    {error && <div className='cw-alert' role='alert'><span>{t(error)}</span><button aria-label={t("关闭提示")} onClick={() => setError('')}><X size={17}/></button></div>}
    <div className='cw-columns'>
      <section className='panel cw-brief'>
        <div className='cw-section-heading'><h2>{t("创作要求")}</h2><span className='tag'>{t("先文本")}</span></div>
        <form noValidate onSubmit={event => {event.preventDefault(); void generate();}}>
          <fieldset disabled={busy} className='cw-form-fields'>
            <label>{t("作品名称")}<span className='cw-optional'>{t("可选")}</span><input value={name} onChange={e => setName(e.target.value)} placeholder={t("便于你之后找到这组稿件")}/></label>
            <label>{t("产品资料／已有内容")}<span className='cw-required'>{t("必填")}</span><small>{t("例如：产品介绍、功能事实、已有草稿。可粘贴文字或上传文本文件。")}</small><textarea rows={6} value={materials} onChange={e => setMaterials(e.target.value)} placeholder={t("这是什么产品？有哪些有依据的事实和重点？")}/></label>
            <label className='cw-upload'><Upload size={16}/>{t("上传资料 .txt / .md")}<input type='file' multiple accept='.txt,.md,text/plain,text/markdown' onChange={e => {void addFiles(e.target.files, 'material'); e.target.value = '';}}/></label>
            <label>{t("写作目的")}<span className='cw-required'>{t("必填")}</span><small>{t("例如：解释新功能、分享实践经验，或介绍产品解决的问题。")}</small><textarea rows={2} required value={brief.purpose} onChange={e => setBrief({...brief, purpose: e.target.value})}/></label>
            <label>{t("目标读者")}<span className='cw-required'>{t("必填")}</span><small>{t("例如：正在搭建 AI Agent 的开发者；说明他们的背景或困扰。")}</small><textarea rows={2} required value={brief.audience} onChange={e => setBrief({...brief, audience: e.target.value})}/></label>
            <details className='cw-options' open><summary>{t("可选配置")}<ChevronDown size={16}/></summary><p className='cw-help'>{t("本次试运行预设：LinkedIn、中文和英文、普通动态。可以修改；这不是全局默认值。")}</p>
              <Checks label={t("平台")} options={Object.entries(platformNames) as [keyof typeof platformNames, string][]} selected={brief.platforms} onChange={platforms => setBrief({...brief, platforms})}/>
              <Checks label={t("语言")} options={Object.entries(languageNames) as [keyof typeof languageNames, string][]} selected={brief.languages} onChange={languages => setBrief({...brief, languages})}/>
              <Checks label={t("内容格式")} options={[['short_post', '普通动态'], ['long_article', '长文章 / Pulse（待适配）'], ['thread', '串帖（待适配）']]} selected={brief.formats} onChange={formats => setBrief({...brief, formats})}/>
              <p className='cw-help'>{t('仅平台 × 语言拆稿：当前 {count} 份。其他选项合并到每份稿件。', {count: brief.platforms.length * brief.languages.length})}</p>
              {unsupported && <p className='cw-warning'>{t("X、小红书、知乎、Bilibili 及长文章／串帖尚未适配。本次组合不能执行，不会跳过这些选择。")}</p>}
              {unconfigured && <p className='cw-warning'>{t("平台、语言或格式未选；默认值尚未确定，请先配置本次试稿。")}</p>}
              <Checks label={t("作者身份")} options={[['product_author', '产品作者'], ['team', '团队'], ['third_party', '第三方观察者']]} selected={options.authorIdentities || []} onChange={authorIdentities => {setOptions({...options, authorIdentities}); setBrief({...brief, authorIdentity: authorIdentities.map(x => ({product_author: '产品作者', team: '团队', third_party: '第三方观察者'})[x])});}}/>
              <Checks label={t("表达风格")} options={[['professional', '专业'], ['plain', '自然易懂'], ['concise', '简洁']]} selected={options.styles || []} onChange={styles => setOptions({...options, styles})}/>
              <label>{t("风格／术语补充")}<small>{t("自由补充品牌语气、需要解释的术语等，不增加稿件数量。")}</small><input value={brief.styleTerms.join('；')} onChange={e => setBrief({...brief, styleTerms: e.target.value ? [e.target.value] : []})}/></label>
              <Checks label={t("篇幅深度")} options={[['brief', '简短'], ['standard', '标准'], ['detailed', '深入']]} selected={options.depths || []} onChange={depths => {setOptions({...options, depths}); setBrief({...brief, lengthDepth: depths.map(x => ({brief: '简短', standard: '标准', detailed: '深入'})[x])});}}/>
              <label>{t("参考文章／旧稿")}<textarea rows={3} value={references} onChange={e => setReferences(e.target.value)} placeholder={t("提供希望参考的结构或语气")}/></label>
              <label>{t("参考链接")}<input type='url' value={referenceUrl} onChange={e => setReferenceUrl(e.target.value)} placeholder={t("https://…")}/><small>{t("本阶段尚不读取链接，请粘贴正文或上传 .txt / .md 文本。")}</small></label>
              <label className='cw-upload'><Upload size={16}/>{t("上传参考 .txt / .md")}<input type='file' multiple accept='.txt,.md' onChange={e => {void addFiles(e.target.files, 'reference'); e.target.value = '';}}/></label>
            </details>
            <label className='cw-upload'><Image size={16}/>{t("选用配图（可选）")}<input type='file' multiple accept='image/png,image/jpeg' onChange={e => {void addFiles(e.target.files, 'image'); e.target.value = '';}}/></label>
            <p className='cw-help'>{t("未选用配图时会请求自动配图。上传支持 PNG / JPEG；本轮 LinkedIn 发布仅支持单张图片。")}{capabilities?.image.message ? t(capabilities.image.message) : t("正在检查配图连接…")} {t("每个文件最多 4 MiB。")}</p>
            {!!files.length && <ul className='cw-files'>{files.map(file => <li key={file.upload.id}><span>{file.role === 'material' ? t("资料") : file.role === 'reference' ? t("参考") : t("配图")} {t("·")}{file.upload.fileName}</span><button type='button' aria-label={t('移除 {name}', {name: file.upload.fileName})} onClick={() => setFiles(prev => prev.filter(x => x !== file))}><X size={15}/></button></li>)}</ul>}
            <div className='cw-connection'><span className={'cw-dot ' + (capabilities?.text.status === 'available' ? 'connected' : '')}/><span>{capabilities?.text.message ? t(capabilities.text.message) : t("正在检查文字生成入口…")}</span></div>
            <button className='button primary full' type='submit' disabled={busy || unsupported || unconfigured || capabilities?.text.status === 'unavailable'}>{busy ? <LoaderCircle size={17}/> : <Sparkles size={17}/>}{t("生成并自动审核修订")}</button>
            <p className='cw-help'>{t("生成结果仅暂存。点击右侧“确认保存此版本”才会进入正式作品库。")}</p>
          </fieldset>
        </form>
      </section>
      <div className='cw-writing-column'>
        {!!jobs.length && <section className='panel cw-jobs'><div className='cw-section-heading'><h2>{t("本机创作任务")}</h2><small>{t("实际执行状态")}</small></div>{jobs.slice(0, 8).map(job => <div className='cw-job' key={job.id}><div className='cw-job-header'><strong>{job.kind === 'modification' ? t("局部改稿") : t("生成与审核")}</strong><span className='tag'>{t(stageNames[job.status === 'running' ? job.stage : job.status] || job.stage)}</span><small>{date(job.createdAt)}</small>{running(job) && <button className='button small-btn' disabled={busy} onClick={() => void cancelJob(job)}>{t("取消")}</button>}</div>{job.error && <p className='cw-warning'>{t(job.error)}</p>}<div className='cw-variants'>{job.variants.map(variant => <button className={'cw-variant ' + (tmp?.id === variant.tmpId ? 'selected' : '')} key={variant.platform + variant.language} disabled={!variant.tmpId || running(job) || busy} onClick={() => variant.tmpId && void openJobVariant(job, variant.tmpId)}><strong>{t(platformNames[variant.platform])} {t("·")}{t(languageNames[variant.language])}</strong><span>{t(stageNames[variant.stage] || variant.stage)}</span>{variant.error && <small>{t(variant.error)}</small>}{variant.assetStatus === 'unconnected' && <small>{t("自动配图未连接")}</small>}</button>)}</div>{!running(job) && ['failed', 'cancelled', 'interrupted'].includes(job.status) && job.kind === 'generation' && <button className='text-btn' disabled={busy} onClick={() => {requestRef.current = null; void generate();}}>{t("按当前左侧资料重新生成")}</button>}</div>)}</section>}
        <section className='panel cw-editor' aria-label={t("正文编辑器")}>
          <div className='cw-section-heading'><h2>{shown ? t("看稿与修改") : t("稿件将在这里呈现")}</h2><span className='cw-save-status' role='status'>{savedView ? t('已确认保存 · 正在查看版本 {number}', {number: savedView.version.number}) : t(saveState)}</span></div>
          {!shown ? <div className='cw-empty'><FileText size={42}/><h3>{t("把想说的事，写清楚。")}</h3><p>{t("填写左侧三项资料，生成后可切换中英文、直接编辑段落，也可以选中文字提交修改意见。")}</p><span>{t("初稿 · 一次自动审核 · 修订稿")}</span></div> : <>
            <div className='cw-editor-toolbar'><strong>{shown.name}</strong><span className='tag'>{shown.platform ? t(platformNames[shown.platform]) : t("未选平台")} {t("·")}{shown.language ? t(languageNames[shown.language]) : t("未选语言")}</span>
              {savedView && <label className='cw-version'>{t("历史版本")}<select aria-label={t("历史版本")} value={savedView.version.id} onChange={e => setSavedView({...savedView, version: savedView.item.versions.find(v => v.id === e.target.value)!})}>{savedView.item.versions.map(version => <option key={version.id} value={version.id}>{t('版本 {number}', {number: version.number})} {t("·")}{date(version.createdAt)}</option>)}</select></label>}
            </div>
            {savedView && <div className='cw-saved-notice'><Check size={16}/><span>{savedView.version.id !== savedView.item.currentVersionId ? t("正在查看历史版本。开始新修订将从最新正式版本创建暂存，不从当前历史版本派生。") : t("已正式保存。继续修改将从当前最新正式版本创建暂存，保留旧版。")}</span><button className='button small-btn' disabled={busy} onClick={() => void reviseSaved()}><Pencil size={14}/>{t("开始新修订")}</button></div>}
            {(tmp?.stale || tmp?.confirmed || conflict) && <div className='cw-warning'><p>{tmp?.stale ? t("此暂存在恢复备份前创建，不能直接覆盖恢复后的数据。") : tmp?.confirmed ? t("此暂存已经确认，不能再直接修改。") : t("当前稿件与服务器版本冲突。你的编辑仍保留，自动暂存已暂停。")}</p><div className='cw-actions'><button className='button small-btn' disabled={busy} onClick={() => void forkTmp()}>{t("保留当前编辑，派生为新作品")}</button><button className='button small-btn' onClick={() => downloadDraft(t('未保存改稿.json'), {content: draft, temporary: tmp?.temporary})}>{t("下载当前编辑")}</button>{conflict && <button className='button small-btn' disabled={busy} onClick={() => {if (window.confirm(t('放弃当前页面的本地修改，读取服务器上的最新暂存？'))) void guarded(async () => {const {item} = await contentApi<{item: ContentTmp}>(`/api/content/tmp/${tmp!.id}`); installTmp(item);});}}>{t("放弃本地修改，读取最新")}</button>}</div></div>}
            <div className='cw-documents'>{shown.documents.map(doc => <article className='cw-document' key={doc.id}><input className='cw-title-input' aria-label={t("文章标题")} readOnly={!editable || incomplete} value={doc.title} onChange={e => editDocument(doc.id, null, e.target.value)}/>{doc.blocks.map((block, index) => <label className={'cw-block cw-block-' + block.type} key={block.id}><span>{block.type === 'heading' ? t("小标题") : t('段落 {number}', {number: index + 1})}</span><textarea aria-label={t('正文段落 {number}', {number: index + 1})} rows={Math.max(2, Math.min(14, Math.ceil(block.text.length / 65)))} readOnly={!editable || incomplete} value={block.text} onChange={e => editDocument(doc.id, block.id, e.target.value)} onSelect={e => {const el = e.currentTarget; if (el.selectionStart !== el.selectionEnd && editable) setSelection({documentId: doc.id, blockId: block.id, start: el.selectionStart, end: el.selectionEnd, text: el.value.slice(el.selectionStart, el.selectionEnd)});}}/></label>)}{doc.postingNote && <p className='cw-help'>{doc.postingNote}</p>}</article>)}</div>
            {!!assets.length && <div className='cw-assets'>{assets.filter(a => shown.assetIds.includes(a.id)).map(asset => {const url = tmp ? `/api/content/tmp/${tmp.id}/assets/${asset.id}` : `/api/content/${savedView!.item.id}/versions/${savedView!.version.id}/assets/${asset.id}`; return <figure key={asset.id}>{asset.mimeType.startsWith('image/') && <img src={url} alt={asset.caption || asset.fileName}/>}<figcaption><a href={url} download>{asset.fileName}</a>{asset.caption && <p>{asset.caption}</p>}</figcaption></figure>;})}</div>}
            {activeVariant?.assetStatus === 'unconnected' && <p className='cw-warning'>{t("文本流程已完成，自动配图未连接；本稿没有自动生成的图片。")}</p>}
            {!!activeVariant?.unresolved.length && <section className='cw-review'><h3>{t("尚未解决的审核问题")}</h3><ul>{activeVariant.unresolved.map((finding, index) => <li key={index}>{isServiceNotice(finding) ? t(finding) : finding}</li>)}</ul></section>}
            {tmp?.temporary.reviewFindings && <details className='cw-review'><summary>{t("查看自动审核记录")}</summary><pre>{tmp.temporary.reviewFindings}</pre></details>}
            {editable && !incomplete && <section className='cw-selection'><h3>{t("选中文字，提出局部修改")}</h3>{selection ? <blockquote>{selection.text}</blockquote> : <p className='cw-help'>{t("在上方某个段落内拖选文字。未选中的文字和其他段落保持不变。")}</p>}<textarea aria-label={t("局部修改意见")} rows={2} value={instruction} onChange={e => setInstruction(e.target.value)} placeholder={t("例如：用更直接的措辞，保留事实和数字。")}/><button className='button' disabled={!selection || !instruction.trim() || busy || !!proposalJob && running(proposalJob)} onClick={() => void modifySelection()}><Sparkles size={15}/>{t("生成局部修改提案")}</button></section>}
            {proposalJob && <section className='cw-proposal'><div className='cw-section-heading'><h3>{t("局部修改提案 ·")}{t(stageNames[proposalJob.status] || proposalJob.status)}</h3><button className='text-btn' onClick={() => {setProposalJob(null); setProposal(null);}}>{t("放弃提案")}</button></div>{proposalJob.error && <p className='cw-warning'>{t(proposalJob.error)}</p>}{proposal && <><p className='cw-help'>{t("预览提案全文。接受后仍是暂存，尚未正式保存。")}</p>{proposal.content.documents.map(doc => <div key={doc.id}><h4>{doc.title}</h4>{doc.blocks.map(block => <p className='cw-proposal-text' key={block.id}>{block.text}</p>)}</div>)}<button className='button primary' disabled={busy || dirty || proposalJob.source?.revision !== tmp?.revision} onClick={() => void acceptProposal()}>{t("接受提案")}</button>{(dirty || proposalJob.source?.revision !== tmp?.revision) && <p className='cw-warning'>{t("源稿已经修改，此提案不能再接受。请放弃并重新发起。")}</p>}</>}</section>}
            {tmp && !tmp.stale && !tmp.confirmed && !incomplete && <div className='cw-confirm-bar'><span>{t("确认保存只保存本机版本，不会发布。")}</span><button className='button primary' disabled={busy || conflict || !!proposalJob && running(proposalJob)} onClick={() => void confirmSave()}><Save size={16}/>{t("确认保存此版本")}</button></div>}
          </>}
        </section>
        <section className='panel cw-library'><div className='cw-section-heading'><h2>{t("稿件库")}</h2><button className='text-btn' onClick={() => void refresh()}><RefreshCw size={14}/>{t("刷新")}</button></div><details open><summary>{t('已确认作品（{count}）', {count: saved.length})}</summary>{!saved.length && <p className='cw-help'>{t("确认保存的作品会出现在这里，发布页只读取这些正式版本。")}</p>}{saved.map(item => <button className='cw-library-item' disabled={busy} key={item.id} onClick={() => void openSaved(item.id)}><FileText size={16}/><span><strong>{item.name}</strong><small>{t(platformNames[item.platform])} {t("·")}{t(languageNames[item.language])} {t('· 版本 {number}', {number: item.versionNumber})}</small></span><Check size={16}/></button>)}</details><details><summary>{t('暂存草稿（{count}）', {count: temps.filter(item => !item.confirmed && !jobs.some(job => job.kind === 'modification' && job.variants.some(v => v.tmpId === item.id))).length})}</summary>{temps.filter(item => !item.confirmed && !jobs.some(job => job.kind === 'modification' && job.variants.some(v => v.tmpId === item.id))).map(item => <button className='cw-library-item' key={item.id} disabled={busy || jobs.some(job => running(job) && job.variants.some(v => v.tmpId === item.id))} onClick={() => void openTmp(item.id)}><Pencil size={16}/><span><strong>{item.content.name}</strong><small>{item.content.language ? t(languageNames[item.content.language]) : t("未选语言")} {t("·")}{item.stale ? t("恢复前暂存") : t("未正式保存")}</small></span><Plus size={15}/></button>)}</details></section>
      </div>
    </div>
  </div>;
}
