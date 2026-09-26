import {useEffect, useRef, useState} from 'react';
import {ExternalLink, RefreshCw, Send} from 'lucide-react';
import type {ContentAsset, ContentItem, ContentSummary} from './content-types';
import {contentApi, errorMessage, languageNames} from './content-api';
import {countXText} from '../server/x-text.mjs';
import {useI18n} from './i18n';

type Connection = {status: string; message: string; canPublish: boolean; account: {id: string; name: string; username: string} | null; scopes: string[]; config: {configured: boolean; missing: string[]}};
type Preview = {id: string; itemId: string; versionId: string; documentId: string; accountId: string; accountName: string; language: 'zh'|'en'; kind: 'post'|'thread'; confirmationToken: string; expiresAt: string; resumeRecordId: string|null; warnings: string[]; steps: Array<{blockId: string; index: number; text: string; weightedLength: number; assets: Array<ContentAsset & {url: string; altText: string; generated: boolean}>; alreadyPublished: boolean; platformId: string|null}>};
type Record = {id: string; itemId: string; versionId: string; documentId: string; accountId: string; accountName: string; language: 'zh'|'en'; kind: 'post'|'thread'; status: string; active: boolean; cancelRequested: boolean; createdAt: string; steps: Array<{blockId: string; index: number; status: string; platformId: string|null; url: string|null; error: string|null}>};
const statuses: {[key: string]: string} = {running:'发布进行中', published:'已发布', partial:'部分已发布', failed:'发布失败', unknown:'结果未知', cancelled:'已取消', pending:'尚未提交', uploading:'准备图片', submitting:'提交中'};

export default function XPublishingWorkspace({active, dataEpoch}: {active: boolean; dataEpoch: number}) {
  const {t, date, locale} = useI18n();
  const [connection, setConnection] = useState<Connection|null>(null), [items,setItems] = useState<ContentSummary[]>([]), [records,setRecords] = useState<Record[]>([]);
  const [item,setItem] = useState<ContentItem|null>(null), [versionId,setVersionId] = useState(''), [documentId,setDocumentId] = useState('');
  const [preview,setPreview] = useState<Preview|null>(null), [confirmed,setConfirmed] = useState(false), [busy,setBusy] = useState(false), [error,setError] = useState(''), [now,setNow] = useState(Date.now());
  const epoch = useRef(0), operating = useRef(false), activeRef = useRef(active), refreshSequence = useRef(0);
  activeRef.current = active;
  const invalidate = () => {epoch.current++; setPreview(null); setConfirmed(false);};
  async function refresh() {
    const e = epoch.current, sequence = ++refreshSequence.current;
    const result = await Promise.all([contentApi<{connection: Connection}>('/api/x/connection'),contentApi<{items: ContentSummary[]}>('/api/content'),contentApi<{items: Record[]}>('/api/x/records')]);
    if (e !== epoch.current || sequence !== refreshSequence.current || !activeRef.current) return;
    setConnection(result[0].connection); setItems(result[1].items); setRecords(result[2].items);
    if (preview && (preview.accountId !== result[0].connection.account?.id || !result[0].connection.canPublish)) invalidate();
    if (item && !result[1].items.some(i => i.id === item.id && i.revision === item.revision)) {invalidate(); setItem(null); setVersionId(''); setDocumentId('');}
  }
  async function run(action: () => Promise<void>) {
    if (operating.current) return;
    operating.current=true; setBusy(true); setError('');
    try {await action();} catch(e) {setError(errorMessage(e));} finally {operating.current=false; setBusy(false);}
  }
  useEffect(() => {invalidate(); setItem(null); setVersionId(''); setDocumentId(''); if(active) void refresh().catch(e=>setError(errorMessage(e))); return () => {epoch.current++;};},[active,dataEpoch]);
  useEffect(() => {const timer=setInterval(() => {setNow(Date.now()); if(active && records.some(r=>r.active)) void refresh().catch(e=>setError(errorMessage(e)));},2000); return()=>clearInterval(timer);},[active,records,preview]);
  async function selectItem(id: string) {
    invalidate(); setItem(null); setVersionId(''); setDocumentId(''); if(!id)return;
    const e=epoch.current;
    await run(async()=>{const {item:next}=await contentApi<{item:ContentItem}>('/api/content/'+id);if(e!==epoch.current)return;setItem(next);setVersionId(next.currentVersionId);});
  }
  async function connect() {
    invalidate(); const e=epoch.current;
    await run(async()=>{const {authorizationUrl}=await contentApi<{authorizationUrl:string}>('/api/x/start','POST',{locale}); const url=new URL(authorizationUrl); if(url.protocol!=='https:'||url.hostname!=='x.com')throw new Error('X 授权地址无效。');if(e===epoch.current)window.location.assign(url.href);});
  }
  async function createPreview(resume?: Record) {
    invalidate(); const e=epoch.current;
    await run(async()=>{
      if (resume) {
        const {item: selected} = await contentApi<{item: ContentItem}>('/api/content/'+resume.itemId);
        if(e!==epoch.current)return;
        setItem(selected); setVersionId(resume.versionId); setDocumentId(resume.documentId);
      }
      const input=resume?{itemId:resume.itemId,versionId:resume.versionId,documentId:resume.documentId,accountId:connection?.account?.id,resumeRecordId:resume.id}:{itemId:item?.id,versionId,documentId,accountId:connection?.account?.id};
      const {preview:next}=await contentApi<{preview:Preview}>('/api/x/previews','POST',input);
      if(e!==epoch.current)return; setPreview(next);setNow(Date.now());
    });
  }
  async function execute() {
    if(!preview||!confirmed)return;
    const selected=preview;
    await run(async()=>{const {record}=await contentApi<{record:Record}>('/api/x/execute','POST',{previewId:selected.id,confirmationToken:selected.confirmationToken,confirmed:true});invalidate();setRecords(old=>[record,...old.filter(r=>r.id!==record.id)]);await refresh();});
  }
  const version=item?.versions.find(v=>v.id===versionId), doc=version?.content.documents.find(d=>d.id===documentId);
  const expired=!!preview&&Date.parse(preview.expiresAt)<=now;
  return <div className='x-publishing'>
    <div className='cw-section-heading'><h2>{t('X 普通帖子与串帖')}</h2><button className='button' disabled={busy} onClick={()=>{invalidate();void run(refresh);}}><RefreshCw size={16}/>{t('刷新连接与记录')}</button></div>
    {error&&<p className='cw-alert' role='alert'>{t(error)}</p>}
    <div className='pw-columns'><div>
      <section className='panel pw-connection'><h3>{t('X 账号')}</h3><p>{connection?t(connection.message):t('正在读取实际连接状态…')}</p>{connection?.account&&<p><strong>{connection.account.name}</strong> @{connection.account.username}</p>}
      {!connection?.config.configured&&<p className='cw-warning'>{t('请按 X 授权指南在本机配置应用；密钥无需在页面输入。')}</p>}
      <div className='cw-actions'><button className='button' disabled={busy||!connection?.config.configured} onClick={()=>void connect()}>{t(connection?.account?'重新授权':'连接 X 账号')}</button>{connection?.account&&<button className='button' disabled={busy} onClick={()=>void run(async()=>{invalidate();await contentApi('/api/x/connection','DELETE',{});await refresh();})}>{t('断开连接')}</button>}</div>
      <p className='cw-help'><a href='/docs/x-setup.md' download>{t('下载 X 授权配置指南')}</a></p><p className='cw-help'>{t('连接账号不代表已购买 API 额度；平台调用可能收费。工作台不会购买额度或开启充值。')}</p></section>
      <section className='panel pw-select'><h3>{t('选择正式作品与版本')}</h3>
      <label>{t('作品')}<select aria-label={t('选择 X 发布作品')} disabled={busy} value={item?.id||''} onChange={e=>void selectItem(e.target.value)}><option value=''>{t('选择已确认保存的作品')}</option>{items.filter(i=>i.platform==='x').map(i=><option key={i.id} value={i.id}>{i.name} · {t(languageNames[i.language])}</option>)}</select></label>
      {!items.some(i=>i.platform==='x')&&<p className='cw-help'>{t('还没有正式 X 作品。请先在创作页检查并确认保存。')}</p>}
      {item&&<label>{t('正式版本')}<select aria-label={t('选择 X 发布版本')} value={versionId} disabled={busy} onChange={e=>{invalidate();setVersionId(e.target.value);setDocumentId('');}}>{item.versions.map(v=><option key={v.id} value={v.id}>{t('版本 {number}',{number:v.number})} · {date(v.createdAt)}</option>)}</select></label>}
      {version&&<label>{t('此次发布内容')}<select aria-label={t('选择普通帖子或串帖')} value={documentId} disabled={busy} onChange={e=>{invalidate();setDocumentId(e.target.value);}}><option value=''>{t('请选择一个内容对象')}</option>{version.content.documents.filter(d=>['post','thread'].includes(d.kind)).map(d=><option key={d.id} value={d.id}>{t(d.kind==='thread'?'串帖':'普通帖子')} · {t('{count} 条帖子',{count:d.blocks.length})}</option>)}</select></label>}
      <p className='cw-help'>{t('只发布选中的语言和内容对象，不会同时发布普通帖与串帖。')}</p><button className='button primary' disabled={busy||!doc||!connection?.canPublish} onClick={()=>void createPreview()}>{t('核对发布预览')}</button></section>
    </div><section className='panel pw-preview'><h3>{t('发布预览')}</h3>
    {!preview?<><p className='cw-help'>{t('选定正式版本和已连接账号后，生成可确认的发布预览。')}</p>{doc&&<><h4>{t('正式版本正文（尚未核对发布）')}</h4>{doc.blocks.map((b,i)=><article className='x-post' key={b.id}><strong>{t('第 {number} 条',{number:i+1})} · {countXText(b.text).weightedLength}/280</strong><p className='pw-body'>{b.text}</p>{b.assetIds?.map(id=><img className='x-preview-image' key={id} src={'/api/content/'+item!.id+'/versions/'+versionId+'/assets/'+id} alt={b.image?.altText||t('关联图片')}/>)}</article>)}</>}</>:<>
      <strong>{preview.accountName} · X · {t(languageNames[preview.language])} · {t(preview.kind==='thread'?'串帖':'普通帖子')}</strong>
      <p>{item?.versions.find(v=>v.id===preview.versionId)?.content.name} · {t('版本 {number}',{number:item?.versions.find(v=>v.id===preview.versionId)?.number ?? ''})} · {date(item?.versions.find(v=>v.id===preview.versionId)?.createdAt ?? '')}</p>
      {preview.resumeRecordId&&<p className='cw-warning'>{t('这是续发预览。已发布部分仅供核对，不会再次提交。')}</p>}
      {preview.steps.map(step=><article className='x-post' key={step.blockId}><div className='cw-section-heading'><strong>{t('第 {number} 条',{number:step.index+1})}</strong><span>{step.weightedLength}/280 · {t(step.alreadyPublished?'已发布':'尚未提交')}</span></div><p className='pw-body'>{step.text}</p>{step.assets.map(asset=><figure className='cw-assets' key={asset.id}><img src={asset.url} alt={asset.altText}/><figcaption>{asset.altText}{asset.generated?' · '+t('此图由 AI 生成'):''}</figcaption></figure>)}</article>)}
      {preview.warnings.map(w=><p className='cw-warning' key={w}>{t(w)}</p>)}
      <p className='cw-help'>{t('确认有效期至 {date}；账号或正式版本变化后需重新预览。',{date:date(preview.expiresAt)})}</p>
      {expired?<p className='cw-warning'>{t('预览已过期，请重新核对发布预览。')}</p>:<label className='pw-confirm'><input type='checkbox' checked={confirmed} disabled={busy} onChange={e=>setConfirmed(e.target.checked)}/>{t('我已核对账号、版本、每条正文顺序和图片，确认发布以上选定内容到 X。')}</label>}
      <button className='button primary' disabled={busy||!confirmed||expired||!connection?.canPublish} onClick={()=>void execute()}><Send size={16}/>{t(preview.resumeRecordId?'确认续发剩余帖子':'确认发布到 X')}</button>
    </>}
    </section></div>
    <section className='panel pw-records'><h3>{t('X 发布记录')}</h3>{!records.length&&<p className='cw-help'>{t('目前没有发布记录。')}</p>}{records.map(record=><article className='pw-record' key={record.id}><div><strong>{record.accountName} · {t(languageNames[record.language])}</strong><span className='tag'>{t(statuses[record.status]||record.status)}</span><small>{date(record.createdAt)}</small></div>
      {record.steps.map(step=><div className='x-step' key={step.blockId}><span>{t('第 {number} 条',{number:step.index+1})} · {t(statuses[step.status]||step.status)}</span>{step.error&&<p className='cw-warning'>{t(step.error)}</p>}{step.url&&/^https:\/\/x\.com\/i\/(?:web\/)?status\/\d+$/.test(step.url)&&<a href={step.url} target='_blank' rel='noreferrer'>{t('查看实际发布结果')}<ExternalLink size={13}/></a>}</div>)}
      {record.status==='unknown'&&<p className='cw-warning'>{t('部分请求结果未知，已停止后续提交。请先到 X 核对；不会自动重发或删除已发布部分。')}</p>}
      {record.active&&<button className='button' disabled={busy||record.cancelRequested} onClick={()=>void run(async()=>{await contentApi('/api/x/records/'+record.id+'/cancel','POST',{});await refresh();})}>{t(record.cancelRequested?'正在取消':'停止后续提交')}</button>}
      {!record.active&&['failed','partial','cancelled'].includes(record.status)&&<button className='button' disabled={busy||!connection?.canPublish||connection.account?.id!==record.accountId} onClick={()=>void createPreview(record)}>{t('核对已发部分并准备续发')}</button>}
      {!record.active&&record.steps.some(s=>s.status==='unknown'&&s.platformId)&&<button className='button' disabled={busy||!connection?.canPublish} onClick={()=>void run(async()=>{await contentApi('/api/x/records/'+record.id+'/reconcile','POST',{});await refresh();})}>{t('查询平台结果（不重发）')}</button>}
    </article>)}</section>
  </div>;
}
