import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowDownToLine, ArrowRight, ArrowUpRight, BookOpen, Check, CheckCheck, ChevronRight, ClipboardList, Copy, Database, FileText, FolderOpen, Layers3, LoaderCircle, MessageSquare, Network, Pencil, Search, Send, ShieldCheck, SlidersHorizontal, Upload, X } from 'lucide-react';
import { stages, taskBrief, moduleForDisplay, type WorkItem } from './workflow';
import type { Task, TaskState, Resource } from './types';
import taskData from './tasks.json';
import resourceData from './resources.json';
import ContentWorkspace from './ContentWorkspace';
import PublishingWorkspace from './PublishingWorkspace';
import { useI18n, translateBuiltin } from './i18n';
const tasks = taskData as Task[];
const resources = resourceData as Resource[];
const moduleNames: Record<string, string> = { shared: '共用支撑', ...Object.fromEntries(stages.map(s => [s.id, s.title])) };
const moduleIcons = { research: Search, creation: Pencil, review: ShieldCheck, publishing: Send, feedback: MessageSquare };
const operationStatuses = ['待开始', '进行中', '待验收', '已完成'] as const;
const moduleStatuses = ['待补充', '待试跑', '进行中', '已跑通'] as const;
function LanguageSwitch() {
    const {locale,setLocale,t:tr}=useI18n();
    return <div className='language-switch segmented' role='group' aria-label={tr('界面语言')}><button type='button' lang='zh-CN' aria-pressed={locale==='zh'} className={locale==='zh'?'selected':''} onClick={()=>setLocale('zh')}>中文</button><button type='button' lang='en' aria-pressed={locale==='en'} className={locale==='en'?'selected':''} onClick={()=>setLocale('en')}>English</button></div>;
}
function Source({ url, children }: {
    url?: string;
    children: ReactNode;
}) { return url && /^https?:\/\//.test(url) ? <a href={url} target='_blank' rel='noreferrer'>{children}<ArrowUpRight size={14}/></a> : <span>{children}</span>; }
function Lines({ text }: {
    text: string;
}) { return <p className='multiline'>{text}</p>; }
function Field({ title, children }: {
    title: string;
    children: ReactNode;
}) { return <section className='detail-field'><h3>{title}</h3>{children}</section>; }
function Modal({ title, subtitle, children, onClose, busy = false }: {
    title: string;
    subtitle?: string;
    children: ReactNode;
    onClose: () => void;
    busy?: boolean;
}) { const { t: tr } = useI18n(); const ref = useRef<HTMLDialogElement>(null); useEffect(() => { const d = ref.current!; d.showModal(); return () => d.close(); }, []); return <dialog ref={ref} className='modal' onCancel={e => { e.preventDefault(); if (!busy)
    onClose(); }}><div className='modal-head'><div><span className='eyebrow'>{tr("工作台 / 详情")}</span><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div><div className='modal-tools'><LanguageSwitch/><button className='icon-btn' aria-label={tr("关闭详情")} disabled={busy} onClick={onClose}><X /></button></div></div>{children}</dialog>; }
function saveFile(name: string, content: string, type = 'text/markdown;charset=utf-8') { const url = URL.createObjectURL(new Blob([content], { type })); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
function taskText(task: Task, state: TaskState | undefined, states: TaskState[], locale: 'zh' | 'en', tr: (source: string, params?: Record<string, string | number>) => string) {
    const shown = translateBuiltin(task, locale);
    return `# ${task.id} · ${shown.title}\n\n${tr('模块')}：${tr(moduleNames[task.module])} / ${shown.part}\n${tr('负责人')}：${state?.owner || tr('待分配')}\n${tr('状态')}：${tr(state?.status || '待开始')}\n${tr('优先级')}：${shown.priority}\n\n## ${tr('上游依赖')}\n${task.dependsOn.map(id => { const upstream = states.find(x => x.id === id); return `- ${id} ${translateBuiltin(tasks.find(x => x.id === id)?.title || '', locale)}：${upstream?.resultUrl || tr('待提供成果或材料')}`; }).join('\n') || tr('无')}\n\n## ${tr('输入')}\n${shown.input}\n\n## ${tr('步骤')}\n${shown.steps.map((x, i) => `${i + 1}. ${x}`).join('\n')}\n\n## ${tr('交付')}\n${shown.output}\n\n## ${tr('验收')}\n${shown.acceptance}\n\n## ${tr('复用')}\n${shown.reuse.map(r => `- ${tr('什么')}：${r.name}\n- ${tr('怎么用')}：${r.how}\n- ${tr('为什么')}：${r.why}\n- ${tr('来源')}：${r.url || tr('本地能力，见使用说明')}`).join('\n')}\n\n## ${tr('执行记录')}\n${state?.notes || tr('待补充')}\n\n${tr('成果链接')}：${state?.resultUrl || tr('待补充')}\n\n${tr('外部账号操作按任务授权与平台规则执行；实际连接与发布结果请在发布页核对。')}`;
}
export default function App() {
    const { locale, t: tr, date } = useI18n();
    const displayStages = translateBuiltin(stages, locale), displayTasks = translateBuiltin(tasks, locale);
    const modulePackage = (item: WorkItem) => taskBrief(item, items, { locale, t: tr });
    const taskPackage = (task: Task, state: TaskState | undefined) => taskText(task, state, states, locale, tr);
    const [view, setView] = useState('creation'), [items, setItems] = useState<WorkItem[]>([]), [states, setStates] = useState<TaskState[]>([]), [loadError, setLoadError] = useState(''), [loading, setLoading] = useState(true), [active, setActive] = useState('research');
    const [contentDirty, setContentDirty] = useState(false), [publishingOpened, setPublishingOpened] = useState(false), [contentEpoch, setContentEpoch] = useState(0);
    const [moduleDraft, setModuleDraft] = useState<WorkItem | null>(null), [taskDraft, setTaskDraft] = useState<TaskState | null>(null), [resource, setResource] = useState<Resource | null>(null), [busy, setBusy] = useState(false), [editError, setEditError] = useState(''), [notice, setNotice] = useState('');
    const [query, setQuery] = useState(''), [moduleFilter, setModuleFilter] = useState('all'), [statusFilter, setStatusFilter] = useState('all'), [kindFilter, setKindFilter] = useState('all'), [researchMode, setResearchMode] = useState('library'), [restore, setRestore] = useState<any>(null);
    const [discard, setDiscard] = useState<'modules' | 'tasks' | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);
    async function refresh() { setLoading(true); try {
        const responses = await Promise.all([fetch('/api/modules', { cache: 'no-store' }), fetch('/api/tasks', { cache: 'no-store' })]);
        const values = await Promise.all(responses.map(async (r) => { const v = await r.json(); if (!r.ok)
            throw new Error(v.error || '无法读取本地数据'); return v; }));
        setItems(values[0].items);
        setStates(values[1].items);
        setLoadError('');
    }
    catch (e) {
        setLoadError(e instanceof Error ? e.message : '无法连接本地服务。请重新启动工作台。');
    }
    finally {
        setLoading(false);
    } }
    useEffect(() => { void refresh(); }, []);
    useEffect(() => {
        if (!['#publishing', '#publishing?linkedin=connected'].includes(window.location.hash)) return;
        // The marker selects a page only; PublishingWorkspace reads actual server-side authorization.
        setView('publishing'); setPublishingOpened(true);
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }, []);
    useEffect(() => { if (!notice)
        return; const t = setTimeout(() => setNotice(''), 5000); return () => clearTimeout(t); }, [notice]);
    function navigate(next: string) { setView(next); if (next === 'publishing')
        setPublishingOpened(true); setQuery(''); setModuleFilter('all'); setStatusFilter('all'); }
    async function copy(text: string) { try {
        await navigator.clipboard.writeText(text);
        setNotice('任务已复制，可交给其他人或 agent。');
    }
    catch {
        saveFile(tr('任务交接.md'), text);
        setNotice('复制不可用，已下载任务文件。');
    } }
    async function save(kind: 'modules' | 'tasks') { const body = kind === 'modules' ? moduleDraft : taskDraft; setBusy(true); setEditError(''); try {
        const response = await fetch('/api/' + kind, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const data = await response.json();
        if (!response.ok)
            throw new Error(data.error || '保存失败');
        if (kind === 'modules') {
            setItems(prev => prev.map(x => x.id === data.item.id ? data.item : x));
            setModuleDraft(null);
        }
        else {
            setStates(prev => prev.map(x => x.id === data.item.id ? data.item : x));
            setTaskDraft(null);
        }
        setDiscard(null);
        setNotice('已保存到本机。');
    }
    catch (e) {
        setEditError(e instanceof Error ? e.message : '保存失败，输入仍保留。');
    }
    finally {
        setBusy(false);
    } }
    function exportAll() { saveFile(tr('全部工作-交接包.md'), '# ' + tr('内容工作台 · 全部工作交接包') + '\n\n' + tr('导出时间') + '：' + date(new Date().toISOString()) + '\n\n' + tasks.map(t => taskPackage(t, states.find(s => s.id === t.id))).join('\n\n---\n\n')); setNotice('已导出全部任务、当前负责人和执行记录。'); }
    function closeModule() { if (!moduleDraft)
        return; const dirty = JSON.stringify(moduleDraft) !== JSON.stringify(items.find(x => x.id === moduleDraft.id)); if (dirty)
        setDiscard('modules');
    else
        setModuleDraft(null); }
    function closeTask() { if (!taskDraft)
        return; const dirty = JSON.stringify(taskDraft) !== JSON.stringify(states.find(x => x.id === taskDraft.id)); if (dirty)
        setDiscard('tasks');
    else
        setTaskDraft(null); }
    async function recoverDraft(kind: 'modules' | 'tasks') { const current = kind === 'modules' ? moduleDraft : taskDraft; if (!current)
        return; const text = kind === 'modules' ? modulePackage(moduleDraft!) : taskPackage(tasks.find(t => t.id === taskDraft!.id)!, taskDraft!); saveFile(tr('未保存草稿-{id}.md', { id: current.id }), text); setBusy(true); try {
        const response = await fetch('/api/' + kind, { cache: 'no-store' });
        const data = await response.json();
        if (!response.ok)
            throw new Error(data.error || '读取失败');
        if (kind === 'modules') {
            setItems(data.items);
            setModuleDraft(structuredClone(data.items.find((i: WorkItem) => i.id === current.id)));
        }
        else {
            setStates(data.items);
            setTaskDraft(structuredClone(data.items.find((i: TaskState) => i.id === current.id)));
        }
        setEditError('');
        setNotice('原草稿已下载，编辑器已载入最新记录，请合并后保存。');
    }
    catch (e) {
        setEditError(e instanceof Error ? e.message : '读取失败，原输入仍保留。');
    }
    finally {
        setBusy(false);
    } }
    async function chooseRestore(file?: File) { if (!file)
        return; try {
        if (file.size > 16 * 1024 * 1024)
            throw new Error('备份超过 16 MB，请核对文件。');
        let data; try { data = JSON.parse(await file.text()); } catch { throw new Error('备份无法读取'); }
        if (data.app !== 'content-workbench-local' || data.version !== 1 || !Array.isArray(data.modules) || !Array.isArray(data.tasks))
            throw new Error('这不是本工作台的版本 1 备份。');
        setEditError('');
        setRestore(data);
    }
    catch (e) {
        setNotice(e instanceof Error ? e.message : '备份无法读取');
    } if (fileRef.current)
        fileRef.current.value = ''; }
    async function doRestore() { setBusy(true); setEditError(''); try {
        const r = await fetch('/api/restore', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(restore) });
        const v = await r.json();
        if (!r.ok)
            throw new Error(v.error || '恢复失败');
        setRestore(null);
        setContentEpoch(value => value + 1);
        await refresh();
        setNotice('备份已恢复，恢复前的数据已另存快照。');
    }
    catch (e) {
        setEditError(e instanceof Error ? e.message : '恢复失败');
    }
    finally {
        setBusy(false);
    } }
    const selected = items.find(x => x.id === active), stage = displayStages.find(s => s.id === active)!;
    const shownModule = selected ? moduleForDisplay(selected, locale) : null, shownDraft = moduleDraft ? moduleForDisplay(moduleDraft, locale) : null, shownResource = resource ? translateBuiltin(resource, locale) : null;
    const filteredTasks = tasks.filter(task => { const shown=translateBuiltin(task,locale); const searchText=[task,shown].map(value=>value.title+value.part+value.reuse.map(r=>r.name+r.how+r.why).join('')).join(' '); return (moduleFilter==='all'||task.module===moduleFilter)&&(statusFilter==='all'||states.find(state=>state.id===task.id)?.status===statusFilter)&&searchText.toLowerCase().includes(query.toLowerCase()); }).map(task=>translateBuiltin(task,locale));
    const filteredResources = resources.filter(r => { const shown = translateBuiltin(r, locale); return (moduleFilter === 'all' || r.stages.includes(moduleFilter)) && (kindFilter === 'all' || r.kind === kindFilter) && (r.name + r.summary + r.reuse + shown.name + shown.summary + shown.reuse).toLowerCase().includes(query.toLowerCase()); }).map(r => translateBuiltin(r, locale));
    const editedTask = taskDraft ? displayTasks.find(t => t.id === taskDraft.id) : undefined;
    return <div className='app'><header className='topbar'><a className='brand' href='/'><span className='brand-symbol'><Layers3 size={25}/></span><span>Launch Loop <small>{tr("内容工作台")}</small></span></a><span className='local-label'><span />{tr("本地运行 · 仅本机访问")}</span><div className='top-actions'><LanguageSwitch/><a href='/api/backup' download={tr("内容工作台备份.json")} className='button subtle'><Database size={16}/>{tr("备份数据")}</a><button className='button subtle' onClick={() => fileRef.current?.click()}><Upload size={16}/>{tr("恢复备份")}</button><input ref={fileRef} type='file' accept='.json,application/json' hidden onChange={e => void chooseRestore(e.target.files?.[0])}/></div></header>
 <div className='layout'><aside className='sidebar'><div className='sidebar-label'>{tr("内容工作空间")}</div><nav>{[{ id: 'creation', label: '创作', icon: Pencil }, { id: 'publishing', label: '发布', icon: Send }, { id: 'feedback', label: '反馈', icon: MessageSquare }].map(n => <button key={n.id} onClick={() => navigate(n.id)} aria-current={view === n.id ? 'page' : undefined}><n.icon size={19}/>{tr(n.label)}{view === n.id && <ChevronRight size={15}/>}</button>)}</nav>{contentDirty && <span className='cw-unsaved-nav'>{tr("创作页有编辑等待暂存；切页保留输入。")}</span>}<nav className='cw-nav-secondary' aria-label={tr("资料与历史记录")}>{[{ id: 'tasks', label: '任务与分工', icon: ClipboardList }, { id: 'research', label: '资料与复用库', icon: BookOpen }, { id: 'workflow', label: '历史模块记录', icon: Layers3 }, { id: 'architecture', label: '历史架构资料', icon: Network }, { id: 'guide', label: '使用与交接', icon: FolderOpen }].map(n => <button key={n.id} onClick={() => navigate(n.id)} aria-current={view === n.id ? 'page' : undefined}><n.icon size={19}/>{tr(n.label)}{view === n.id && <ChevronRight size={15}/>}</button>)}</nav><div className='sidebar-bottom'><span className='eyebrow'>{tr("当前示例项目")}</span><Source url='https://github.com/ThinkFlowLab/system1-agents'>system1-agents</Source><p>{tr("先完成一条真实内容，再把重复步骤交给 agent。")}</p><span className='subtle-text'>{tr('调研核查')} · {date('2026-09-23')}</span></div></aside>
 <main>{notice && <div role='status' className='toast'><Check size={18}/>{tr(notice)}</div>}{loadError && <div className='error-banner' role='alert'>{tr(loadError)}<button className='button' onClick={() => void refresh()}>{tr("重新读取")}</button></div>}
 <div hidden={view !== 'creation'}><ContentWorkspace onDirtyChange={setContentDirty} active={view === 'creation'} dataEpoch={contentEpoch}/></div>
 {publishingOpened && <div hidden={view !== 'publishing'}><PublishingWorkspace active={view === 'publishing'} dataEpoch={contentEpoch}/></div>}
 {view === 'feedback' && <div className='cw-feedback-blank' aria-label={tr("反馈，暂留空")}/>}
 {view === 'workflow' && <><div className='page-heading'><div><span className='eyebrow'>{tr("历史记录 / 01")}</span><h1>{tr("历史模块与执行记录。")}</h1><p>{tr("保留原五步模板中的资料和记录。当前内容生产从“创作”开始，审核在创作中自动执行。")}</p></div><button className='button' disabled={loading || !!loadError} onClick={exportAll}><ArrowDownToLine size={17}/>{tr("导出交接包")}</button></div><div className='stats-strip'><span><strong>{tasks.length}</strong>{tr(" 项具体工作")}</span><span><strong>{states.filter(x => x.status === '已完成').length}</strong>{tr(" 项已完成")}</span><span><strong>{resources.length}</strong>{tr(" 项复用资源")}</span><span className='strip-note'>{tr("历史记录 · 连接状态见发布页")}</span></div>
 <div className='stage-grid'>{displayStages.map(s => { const Icon = moduleIcons[s.id]; return <button key={s.id} className={'stage-card ' + (active === s.id ? 'active' : '')} style={{ '--stage': s.color } as React.CSSProperties} onClick={() => setActive(s.id)}><div><Icon size={22}/><span>{s.number}</span></div><h2>{s.title}</h2><p>{s.description}</p><footer><span>{tr(items.find(x => x.id === s.id)?.status || '读取中')}</span><ArrowRight size={17}/></footer></button>; })}</div>
 {selected ? <div className='module-layout'><article className='panel module-panel'><div className='panel-heading'><div><span className='eyebrow'>{tr('模块 / {number}', { number: stage.number })}</span><h2>{tr('{module}模块', { module: stage.title })}</h2></div><button className='button' disabled={!!loadError} onClick={() => { setEditError(''); setModuleDraft(structuredClone(selected)); }}><Pencil size={16}/>{tr("补充模块")}</button></div><Field title={tr("准备什么")}><div className='input-box'><Lines text={shownModule!.input}/></div></Field><Field title={tr("怎么做")}><ol className='steps'>{shownModule!.steps.map((step, i) => <li key={i}><span>{i + 1}</span><p>{step}</p></li>)}</ol></Field><div className='two-col'><Field title={tr("交付什么")}><Lines text={shownModule!.output}/></Field><Field title={tr("做到什么算完成")}><Lines text={shownModule!.acceptance}/></Field></div><Field title={tr("优先复用")}><Lines text={shownModule!.tools}/></Field><Field title={tr("执行记录")}><Lines text={shownModule!.notes || tr('尚未填写')}/></Field></article><aside className='module-side'><section className='panel'><h3>{tr("交给谁来做")}</h3><dl><dt>{tr("负责人")}</dt><dd>{selected.owner || tr('待分配')}</dd><dt>{tr("当前状态")}</dt><dd>{tr(selected.status)}</dd><dt>{tr("交给下一步")}</dt><dd>{stage.handoff}</dd></dl>{selected.resultUrl ? <Source url={selected.resultUrl}>{tr("查看模块成果")}</Source> : <p className='muted'>{tr("完成后，补充成果链接。")}</p>}<button className='button full primary' onClick={() => void copy(modulePackage(selected))}><Copy size={16}/>{tr("复制模块任务")}</button></section><section className='panel'><h3>{tr("这个模块的具体工作")}</h3><div className='mini-task-list'>{displayTasks.filter(t => t.module === active).map(t => <button key={t.id} disabled={loading || !!loadError} onClick={() => { setEditError(''); setTaskDraft(structuredClone(states.find(s => s.id === t.id)!)); }}><span>{t.part}</span><ChevronRight size={14}/></button>)}</div><button className='text-btn' onClick={() => { navigate('tasks'); setModuleFilter(active); }}>{tr("看输入、复用和验收 ")}<ArrowRight size={15}/></button></section></aside></div> : <div className='panel loading'><LoaderCircle />{tr("正在读取本地工作台…")}</div>}</>}
 {view === 'tasks' && <><div className='page-heading'><div><span className='eyebrow'>{tr("任务 / 02")}</span><h1>{tr("每一项工作，都可以交接。")}</h1><p>{tr("保留历史五模块与共用支撑任务。点开查看输入、步骤、复用理由和验收条件；实际创作从“创作”页开始。")}</p></div><button className='button' disabled={loading || !!loadError} onClick={exportAll}><ArrowDownToLine size={17}/>{tr("导出全部任务")}</button></div><div className='filterbar'><label className='search'><Search size={18}/><input aria-label={tr("搜索任务")} placeholder={tr("搜索工作、部分或复用工具")} value={query} onChange={e => setQuery(e.target.value)}/></label><select aria-label={tr("筛选任务模块")} value={moduleFilter} onChange={e => setModuleFilter(e.target.value)}><option value='all'>{tr("全部模块")}</option>{Object.entries(moduleNames).map(([id, title]) => <option key={id} value={id}>{tr(title)}</option>)}</select><select aria-label={tr("筛选任务状态")} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}><option value='all'>{tr("全部状态")}</option>{operationStatuses.map(s => <option key={s} value={s}>{tr(s)}</option>)}</select><span>{filteredTasks.length}{tr(" 项")}</span></div><div className='task-table panel'><table><thead><tr><th>{tr("工作 / 交付物")}</th><th>{tr("模块")}</th><th>{tr("优先复用与理由")}</th><th>{tr("负责人 / 状态")}</th><th /></tr></thead><tbody>{filteredTasks.map(t => { const state = states.find(s => s.id === t.id); return <tr key={t.id}><td><small className='task-id'>{t.id.toUpperCase()} · {t.part} · {t.priority}</small><strong>{t.title}</strong><p>{t.output}</p></td><td><span className='tag'>{tr(moduleNames[t.module])}</span></td><td><strong className='reuse-name'>{t.reuse[0].name}</strong><p>{t.reuse[0].why}</p></td><td><span>{state?.owner || tr('待分配')}</span><span className={'status ' + (state?.status === '已完成' ? 'done' : '')}>{tr(state?.status || '待开始')}</span></td><td><button className='button small-btn' disabled={!state || !!loadError} onClick={() => { setEditError(''); setTaskDraft(structuredClone(state!)); }}>{tr("查看 / 更新")}</button></td></tr>; })}</tbody></table>{!filteredTasks.length && <div className='empty'>{tr("没有符合筛选条件的任务。")}</div>}</div><p className='footnote'>{tr("“已完成”由执行者按验收条件记录；调研已经写入页面，不会自动把实际运营任务标为完成。")}</p></>}
 {view === 'research' && <><div className='page-heading'><div><span className='eyebrow'>{tr("资料 / 03")}</span><h1>{tr("先复用，再决定要开发什么。")}</h1><p>{tr("保留品牌管理、内容营销产品、发布服务、编排工具和 skills 的历史调研，仍按原五步分类比较。")}</p></div><a className='button' href='/docs/research.md' download><ArrowDownToLine size={17}/>{tr("下载完整调研")}</a></div><div className='notice'><BookOpen size={19}/><p><strong>{tr("按笔记中的品牌管理语境，这里核查 Frontify。")}</strong>{tr("Frontity 是另一款 WordPress / React 框架。以下供应商能力来自官方文档核查，未登录商业产品实测；技能样例另有执行记录。")}</p></div><div className='segmented'><button className={researchMode === 'library' ? 'selected' : ''} onClick={() => setResearchMode('library')}>{tr("资源与复用说明")}</button><button className={researchMode === 'matrix' ? 'selected' : ''} onClick={() => setResearchMode('matrix')}>{tr("产品五步对照")}</button></div><div className='filterbar'><label className='search'><Search size={18}/><input aria-label={tr("搜索复用资源")} placeholder={tr("搜索 Frontify、发布、品牌、MCP…")} value={query} onChange={e => setQuery(e.target.value)}/></label><select aria-label={tr("筛选资源阶段")} value={moduleFilter} onChange={e => setModuleFilter(e.target.value)}><option value='all'>{tr("全部阶段")}</option>{displayStages.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}</select><select aria-label={tr("筛选资源类型")} value={kindFilter} onChange={e => setKindFilter(e.target.value)}><option value='all'>{tr("全部类型")}</option><option value='Skill'>Skill</option><option value='产品'>{tr("产品")}</option><option value='现有能力'>{tr("现有能力")}</option></select></div>
 {researchMode === 'library' ? <div className='resource-grid'>{filteredResources.map(r => <button className='resource-card' key={r.id} onClick={() => setResource(resources.find(item => item.id === r.id)!)}><div className='resource-top'><span className='tag'>{r.category || r.kind}</span><ArrowUpRight size={18}/></div><h2>{r.name}</h2><p>{r.summary}</p><div className='resource-reuse'><small>{tr("值得复用")}</small><span>{r.reuse}</span></div><footer>{r.stages.map(s => tr(moduleNames[s])).join(' / ')}</footer></button>)}</div> : <div className='panel matrix'><table><thead><tr><th>{tr("产品 / 定位")}</th>{displayStages.map(s => <th key={s.id}>{s.title}</th>)}</tr></thead><tbody>{filteredResources.filter(r => resources.find(item => item.id === r.id)?.kind === '产品').map(r => <tr key={r.id}><th><button className='text-btn' onClick={() => setResource(resources.find(item => item.id === r.id)!)}>{r.name}<ArrowUpRight size={13}/></button><small>{r.category || tr('部分功能产品')}</small></th>{displayStages.map(s => <td key={s.id}>{r.coverage?.[s.id] || tr('未核实原生能力；不推断支持')}</td>)}</tr>)}</tbody></table></div>}{!filteredResources.length && <div className='empty'>{tr("没有找到资源，试试更短的关键词。")}</div>}<p className='footnote'>{tr("“文档支持”不代表已连通你的账号。试用时先验证输入、输出和限制，再决定购买或接入；费用按官方当前套餐确认。")}</p></>}
 {view === 'architecture' && <><div className='page-heading'><div><span className='eyebrow'>{tr("架构 / 04")}</span><h1>{tr("页面管交接，工具做擅长的事。")}</h1><p>{tr("以下保留早期五步设计作为历史参考。当前流程为创作、发布、反馈；反馈暂留空。")}</p></div></div><section className='panel'><div className='context-bar'><FileText size={20}/><strong>{tr("共用产品与品牌资料")}</strong><span>{tr("事实 · 术语 · 素材 · 语气 · 来源")}</span></div><div className='flow-chain'>{displayStages.map(s => <button key={s.id} onClick={() => { navigate('workflow'); setActive(s.id); }}><span>{s.number}</span><strong>{s.title}</strong><small>{s.handoff}</small></button>)}</div><p className='feedback-arrow'>{tr("反馈中的问题和证据，回到下一轮研究 ↩")}</p></section><div className='decision-grid'><section className='panel'><span className='decision-dot green'/><h2>{tr("直接复用")}</h2><p>{tr("skills 的研究与写作方法；发布工具的账号授权、草稿、审批、排期；GitHub 的 Issues；现成统计和数据导出。")}</p></section><section className='panel'><span className='decision-dot blue'/><h2>{tr("早期工作台职责")}</h2><p>{tr("资料入口、模块说明、任务分工、执行记录、成果链接、任务导出、持久化和备份。所有账号操作由执行者或已接入工具完成。")}</p></section><section className='panel'><span className='decision-dot amber'/><h2>{tr("有证据再增加")}</h2><p>{tr("自动触发、跨工具同步、重试和提醒。连续重复且规则稳定后，从 n8n、Gumloop、Relevance AI 中选一个。")}</p></section></div><section className='panel'><h2>{tr("可以并行交给五位执行者")}</h2><div className='parallel-list'>{displayStages.map(s => <div key={s.id}><strong>{s.title}</strong><p>{items.find(x => x.id === s.id) ? moduleForDisplay(items.find(x => x.id === s.id)!, locale).acceptance : s.description}</p><button className='button small-btn' disabled={!items.length} onClick={() => void copy(modulePackage(items.find(x => x.id === s.id)!))}><Copy size={15}/>{tr("复制工作包")}</button></div>)}</div></section><p className='footnote'>{tr("本地版适合同一台电脑维护总台账。其他人通过任务包和成果文件交接；它不提供多台电脑实时同步。")}</p></>}
 {view === 'guide' && <><div className='page-heading'><div><span className='eyebrow'>{tr("使用说明 / 05")}</span><h1>{tr("给下一位执行者的使用说明。")}</h1><p>{tr("从创作页准备资料，修改稿件并确认保存；需要发布时，再到发布页单独确认。")}</p></div></div><div className='guide-grid'><section className='panel'><h2>{tr("开始工作")}</h2><ol className='plain-list'><li>{tr("双击文件夹里的“启动工作台.cmd”。浏览器会自动打开。")}</li><li>{tr("在“创作”填写产品资料／已有内容、写作目的和目标读者；资料可上传 .txt / .md。")}</li><li>{tr("核对本次平台、语言和格式后生成。工作台调用已接入的模型，执行初稿、一次审核和修订；失败会显示真实原因。")}</li><li>{tr("打开稿件，直接编辑段落或提交局部改稿意见。编辑先暂存，点击“确认保存此版本”才进入正式作品库。")}</li><li>{tr("在“发布”连接 LinkedIn 账号，选择正式版本，核对预览并单独确认发布。保存内容不会自动发帖。")}</li><li>{tr("“任务与分工”“资料与复用库”“历史模块记录”保留原任务和研究／审查记录，反馈页暂留空。")}</li><li>{tr("点击“备份数据”保留副本；工作结束可双击“停止工作台.cmd”。")}</li></ol></section><section className='panel'><h2>{tr("当前能力与限制")}</h2><ul className='plain-list'><li>{tr("已接入文字生成、自动审核和修订流程；实际可用性与执行结果以创作页为准。")}</li><li>{tr("支持中英文 LinkedIn 普通动态的固定规则、段落编辑、局部提案、暂存及正式历史版本。")}</li><li>{tr("LinkedIn 普通动态发布需先配置应用、完成 OAuth 授权并单独确认。原生 Pulse 长文及其他四个平台待适配。")}</li><li>{tr("可使用上传的 PNG / JPEG；自动配图连接情况以页面为准。DOCX 导出与反馈采集尚未实现。")}</li><li>{tr('保留 {count} 项历史任务、竞品资料与 system1-agents 试跑样例；历史样例不代表当前执行成功。', { count: tasks.length })}</li></ul><p className='muted'>{tr("模型失败、账号未连接或结果未知时均会明确显示；页面不会把这些状态当作成功。")}</p></section><section className='panel'><h2>{tr("资料与样例")}</h2><div className='doc-list'><a href='/docs/research.md' download><BookOpen />{tr("完整竞品与复用调研")}<ArrowDownToLine /></a><a href='/docs/tasks.md' download><ClipboardList />{tr("全部工作与复用清单")}<ArrowDownToLine /></a><a href='/docs/sample.md' download><FileText />{tr("system1-agents 流程试跑样例")}<ArrowDownToLine /></a><a href='/docs/guide.md' download><FolderOpen />{tr("本地运行与交接指南")}<ArrowDownToLine /></a></div></section><section className='panel'><h2>{tr("数据和边界")}</h2><p>{tr("模块与任务记录保存在本机 data 文件夹；JSON 备份用于换电脑或恢复。已确认的正式内容和选中素材会随备份保存；暂存草稿不包含在备份中，成果链接不包含外部文件本体。")}</p><p>{tr("查看资料和编辑台账无需联网；打开外部来源、使用在线模型及发布工具需要网络，并受各服务规则与费用限制。")}</p><p className='muted'>{tr("本地界面只监听本机地址；不要把它直接暴露到公网。")}</p></section></div></>}
 <footer className='footer'><span>{tr("内容工作台 · 本地版")}</span><span>{tr("数据留在本机 · 先复用，后自动化")}</span></footer></main></div>
 {moduleDraft && <Modal title={tr('补充{module}模块', { module: tr(moduleNames[moduleDraft.id]) })} subtitle={tr("将方法、输入和结果写清楚，让下一位执行者能接手。")} busy={busy} onClose={closeModule}>{discard === 'modules' && <div className='discard-prompt' role='alert'><p>{tr("模块修改尚未保存，是否放弃？")}</p><button className='button' onClick={() => setDiscard(null)}>{tr("继续编辑")}</button><button className='button' onClick={() => { setDiscard(null); setModuleDraft(null); }}>{tr("放弃修改")}</button></div>}<form onSubmit={e => { e.preventDefault(); void save('modules'); }}><fieldset disabled={busy}><div className='two-col'><label>{tr("负责人")}<input value={moduleDraft.owner} maxLength={120} onChange={e => setModuleDraft({ ...moduleDraft, owner: e.target.value })}/></label><label>{tr("模块状态")}<select value={moduleDraft.status} onChange={e => setModuleDraft({ ...moduleDraft, status: e.target.value as WorkItem['status'] })}>{moduleStatuses.map(s => <option key={s} value={s}>{tr(s)}</option>)}</select></label></div>{([{ field: 'input', label: '准备的输入' }, { field: 'tools', label: '优先复用' }, { field: 'output', label: '交付物' }, { field: 'acceptance', label: '验收条件' }, { field: 'notes', label: '执行记录' }] as const).map(f => <label key={f.field}>{tr(f.label)}<textarea rows={3} value={shownDraft![f.field]} onChange={e => setModuleDraft({ ...moduleDraft, [f.field]: e.target.value })}/></label>)}<label>{tr("操作步骤（每行一步）")}<textarea rows={5} value={shownDraft!.steps.join('\n')} onChange={e => setModuleDraft({ ...moduleDraft, steps: e.target.value.split('\n') })}/></label><label>{tr("成果链接")}<input type='url' placeholder='https://…' value={moduleDraft.resultUrl} onChange={e => setModuleDraft({ ...moduleDraft, resultUrl: e.target.value })}/></label>{editError && <div className='form-error' role='alert'><p>{tr(editError)}</p><button type='button' className='button' onClick={() => void recoverDraft('modules')}>{tr("下载当前草稿并载入最新版本")}</button></div>}<div className='form-actions'><button type='button' className='button' onClick={() => void copy(modulePackage(moduleDraft))}><Copy size={16}/>{tr("复制当前内容")}</button><button className='button primary' type='submit'>{tr(busy ? '保存中…' : '保存模块')}</button></div></fieldset></form></Modal>}
 {taskDraft && editedTask && <Modal title={editedTask.id.toUpperCase() + ' · ' + editedTask.title} subtitle={tr(moduleNames[editedTask.module]) + ' / ' + editedTask.part + ' · ' + editedTask.priority} busy={busy} onClose={closeTask}>{discard === 'tasks' && <div className='discard-prompt' role='alert'><p>{tr("任务修改尚未保存，是否放弃？")}</p><button className='button' onClick={() => setDiscard(null)}>{tr("继续编辑")}</button><button className='button' onClick={() => { setDiscard(null); setTaskDraft(null); }}>{tr("放弃修改")}</button></div>}<div className='modal-body'><Field title={tr("准备什么")}><Lines text={editedTask.input}/></Field><Field title={tr("操作步骤")}><ol className='plain-list'>{editedTask.steps.map((s, i) => <li key={i}>{s}</li>)}</ol></Field><div className='two-col'><Field title={tr("交付什么")}><Lines text={editedTask.output}/></Field><Field title={tr("怎么验收")}><Lines text={editedTask.acceptance}/></Field></div><div className='reuse-box'>{editedTask.reuse.map((r, i) => <div key={i}><h3>{tr("复用什么")}</h3><Source url={r.url}>{r.name}</Source><h3>{tr("如何复用")}</h3><p>{r.how}</p><h3>{tr("为什么值得")}</h3><p>{r.why}</p></div>)}</div><Field title={tr("上游依赖")}>{editedTask.dependsOn.length ? editedTask.dependsOn.map(id => { const state = states.find(s => s.id === id); return <p key={id}>{id.toUpperCase()} · {displayTasks.find(t => t.id === id)?.title} — {state?.resultUrl ? <Source url={state.resultUrl}>{tr("查看成果")}</Source> : tr('尚未提供成果链接')}</p>; }) : <p>{tr("可独立开始。")}</p>}</Field><form className='task-editor' onSubmit={e => { e.preventDefault(); void save('tasks'); }}><fieldset disabled={busy}><h3>{tr("执行与分工")}</h3><div className='two-col'><label>{tr("任务负责人")}<input value={taskDraft.owner} maxLength={120} onChange={e => setTaskDraft({ ...taskDraft, owner: e.target.value })}/></label><label>{tr("任务状态")}<select value={taskDraft.status} onChange={e => setTaskDraft({ ...taskDraft, status: e.target.value as TaskState['status'] })}>{operationStatuses.map(s => <option key={s} value={s}>{tr(s)}</option>)}</select></label></div><label>{tr("执行记录 / 待解决问题")}<textarea rows={4} value={taskDraft.notes} onChange={e => setTaskDraft({ ...taskDraft, notes: e.target.value })}/></label><label>{tr("任务成果链接")}<input type='url' placeholder={tr("https://…；本地文件位置可写在记录里")} value={taskDraft.resultUrl} onChange={e => setTaskDraft({ ...taskDraft, resultUrl: e.target.value })}/></label>{editError && <div className='form-error' role='alert'><p>{tr(editError)}</p><button type='button' className='button' onClick={() => void recoverDraft('tasks')}>{tr("下载当前草稿并载入最新版本")}</button></div>}<div className='form-actions'><button type='button' className='button' onClick={() => void copy(taskPackage(tasks.find(task => task.id === editedTask.id)!, taskDraft))}><Copy size={16}/>{tr("复制任务包")}</button><button className='button primary' type='submit'>{tr(busy ? '保存中…' : '保存任务')}</button></div></fieldset></form></div></Modal>}
 {resource && shownResource && <Modal title={shownResource!.name} subtitle={(shownResource!.category || shownResource!.kind) + ' · ' + tr('核查') + ' ' + date(resource.checkedAt || '2026-09-23')} onClose={() => setResource(null)}><div className='modal-body'><div className='evidence'>{shownResource!.evidenceLevel || tr('官方文档核查；未试用')}</div><Field title={tr("它解决什么")}><Lines text={shownResource!.summary}/></Field>{shownResource!.workflow && <Field title={tr("产品实际工作方式")}><Lines text={shownResource!.workflow}/></Field>}<div className='reuse-box'><Field title={tr("复用什么")}><Lines text={shownResource!.reuse}/></Field><Field title={tr("如何复用")}><Lines text={shownResource!.reuseHow || shownResource!.integration || tr('按官方技能说明准备输入，由现有 agent 执行；在任务卡保存结果。未验证的连接先手动试跑。')}/></Field><Field title={tr("为什么值得")}><Lines text={shownResource!.reuseWhy || tr('复用现有方法或服务，减少重复搭建；先用一条真实内容验证是否节省操作和维护成本。')}/></Field></div>{shownResource!.nontechnicalUse && <Field title={tr("非技术人员如何使用")}><Lines text={shownResource!.nontechnicalUse}/></Field>}<Field title={tr("能力边界与限制")}><Lines text={shownResource!.limit}/></Field>{shownResource!.approval && <Field title={tr("审查与批准")}><Lines text={shownResource!.approval}/></Field>}{shownResource!.avoidBuilding && <Field title={tr("首版不要重复开发")}><Lines text={shownResource!.avoidBuilding}/></Field>}<Field title={tr("接入与成本")}><Lines text={[shownResource!.availability, shownResource!.effort, shownResource!.pricing, shownResource!.license].filter(Boolean).join('\n')}/></Field><Field title={tr("原始来源")}>{!shownResource!.url && !shownResource!.sources?.length && <p>{tr("原调研所用 Agent 环境的技能说明；新执行者需确认对应技能是否可用，本仓库未打包或接入该能力。")}</p>}<div className='source-list'>{(shownResource!.sources?.length ? shownResource!.sources : [{ label: tr('官方说明'), url: shownResource!.url }]).filter(s => s.url).map((s, i) => <Source key={i} url={s.url}>{s.label}</Source>)}</div></Field></div></Modal>}
 {restore && <Modal title={tr("恢复本地备份")} subtitle={tr("这会恢复模块、任务及备份包含的正式内容；恢复前会自动保留快照。")} busy={busy} onClose={() => setRestore(null)}><div className='modal-body'><p>{tr("备份时间：")}{restore.exportedAt ? date(String(restore.exportedAt)) : tr('未知')}</p><p>{tr('包含 {modules} 个模块、{tasks} 条任务状态。', { modules: restore.modules.length, tasks: restore.tasks.length })}</p>{restore.content === undefined ? <p>{tr("旧备份不含正式内容，现有正式内容及其历史版本会保留。")}</p> : <p>{tr('另含 {count} 份正式内容及其历史版本和已保存素材，将恢复成备份中的集合。当前不在备份中的内容将从活动库移除，并保留在恢复前快照。', { count: Array.isArray(restore.content?.items) ? restore.content.items.length : tr('未知数量的') })}</p>}<p>{tr("发布记录按合并保留策略恢复；旧备份不会清除现有发布事实或防重记录。恢复不会发送帖子，也不会恢复账号密钥或授权凭据。有发布正在提交时，恢复会被拒绝，请等提交结束并核对结果。")}</p><p>{tr("临时稿不在备份中，也不会被清理。恢复后仍可读取旧临时稿，继续编辑或确认保存前需显式派生新暂存。")}</p>{editError && <p role='alert' className='form-error'>{tr(editError)}</p>}<div className='form-actions'><button className='button' disabled={busy} onClick={() => setRestore(null)}>{tr("取消")}</button><button className='button primary' disabled={busy} onClick={() => void doRestore()}>{tr(busy ? '恢复中…' : '确认恢复此备份')}</button></div></div></Modal>}
 </div>;
}
