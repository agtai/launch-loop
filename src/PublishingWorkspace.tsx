import {useEffect, useRef, useState} from 'react';
import {Check, ExternalLink, Link, RefreshCw, Send} from 'lucide-react';
import type {ContentItem, ContentPlatform, ContentSummary, LinkedInConnection, PublishingPreview, PublishingRecord} from './content-types';
import {contentApi, errorMessage, languageNames, platformNames} from './content-api';
import './content-workspace.css';

const statusNames = {submitting: '提交中', published: '已发布', failed: '发布失败', unknown: '结果未知'};

export default function PublishingWorkspace({active = true, dataEpoch = 0}: {active?: boolean; dataEpoch?: number}) {
  const [platform, setPlatform] = useState<ContentPlatform>('linkedin');
  const [connection, setConnection] = useState<LinkedInConnection | null>(null), [items, setItems] = useState<ContentSummary[]>([]), [records, setRecords] = useState<PublishingRecord[]>([]);
  const [item, setItem] = useState<ContentItem | null>(null), [versionId, setVersionId] = useState('');
  const [preview, setPreview] = useState<PublishingPreview | null>(null), [confirmed, setConfirmed] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());
  const viewEpoch = useRef(0), viewContext = useRef({active, dataEpoch}), refreshSequence = useRef(0), operationSequence = useRef(0);
  if (viewContext.current.active !== active || viewContext.current.dataEpoch !== dataEpoch) {
    viewEpoch.current++; viewContext.current = {active, dataEpoch};
  }
  function invalidatePreview() {viewEpoch.current++; setPreview(null); setConfirmed(false);}

  async function refresh() {
    const epoch = viewEpoch.current, sequence = ++refreshSequence.current;
    const results = await Promise.allSettled([
      contentApi<{connection: LinkedInConnection}>('/api/linkedin/connection'),
      contentApi<{items: ContentSummary[]}>('/api/content'),
      contentApi<{items: PublishingRecord[]}>('/api/publishing/records'),
    ]);
    if (epoch !== viewEpoch.current || sequence !== refreshSequence.current) return;
    if (results[0].status === 'fulfilled') {
      const next = results[0].value.connection;
      setConnection(next);
      if (preview && (next.account?.id !== preview.accountId || !next.canPublish)) invalidatePreview();
    }
    if (results[1].status === 'fulfilled') {
      const nextItems = results[1].value.items;
      setItems(nextItems);
      if (item) {
        const next = nextItems.find(candidate => candidate.id === item.id);
        if (!next || next.revision !== item.revision) {invalidatePreview(); setItem(null); setVersionId('');}
      }
    }
    if (results[2].status === 'fulfilled') setRecords(results[2].value.items);
    const failure = results.find(x => x.status === 'rejected');
    if (failure?.status === 'rejected') throw failure.reason;
  }
  async function run(action: () => Promise<void>) {
    const sequence = ++operationSequence.current, epoch = viewEpoch.current;
    setBusy(true); setError('');
    try {await action();} catch (e) {if (epoch === viewEpoch.current) setError(errorMessage(e));}
    finally {if (sequence === operationSequence.current) setBusy(false);}
  }
  useEffect(() => {
    setPreview(null); setConfirmed(false); setItem(null); setVersionId('');
    if (active) void run(refresh);
  }, [active, dataEpoch]);
  useEffect(() => {
    const timer = setInterval(() => {setNow(Date.now()); if (records.some(record => record.status === 'submitting')) void refresh().catch(e => setError(errorMessage(e)));}, 2500);
    return () => clearInterval(timer);
  }, [records, preview]);
  async function selectItem(id: string) {
    invalidatePreview(); setItem(null); setVersionId('');
    if (!id) return;
    const epoch = viewEpoch.current;
    await run(async () => {const {item: selected} = await contentApi<{item: ContentItem}>(`/api/content/${id}`); if (epoch !== viewEpoch.current) return; setItem(selected); setVersionId(selected.currentVersionId);});
  }
  async function startConnection() {
    invalidatePreview();
    const epoch = viewEpoch.current;
    await run(async () => {
      const {authorizationUrl} = await contentApi<{authorizationUrl: string}>('/api/linkedin/connection/start', 'POST', {});
      const url = new URL(authorizationUrl);
      if (epoch !== viewEpoch.current) return;
      if (url.protocol !== 'https:' || !['www.linkedin.com', 'linkedin.com'].includes(url.hostname)) throw new Error('授权地址不是 LinkedIn 官方地址，已停止跳转。');
      window.location.assign(url.href);
    });
  }
  async function createPreview() {
    invalidatePreview();
    const epoch = viewEpoch.current;
    await run(async () => {
      const {preview: next} = await contentApi<{preview: PublishingPreview}>('/api/publishing/previews', 'POST', {itemId: item?.id, versionId, accountId: connection?.account?.id});
      if (epoch !== viewEpoch.current) return;
      setPreview(next); setNow(Date.now());
    });
  }
  async function publish() {
    if (!preview || !confirmed) return;
    await run(async () => {
      const {record} = await contentApi<{record: PublishingRecord}>('/api/publishing/execute', 'POST', {previewId: preview.id, confirmationToken: preview.confirmationToken, confirmed: true});
      setRecords(prev => [record, ...prev.filter(x => x.id !== record.id)]); setConfirmed(false); setPreview(null);
      await refresh();
    });
  }
  const version = item?.versions.find(v => v.id === versionId);
  const eligible = version?.content.platform === 'linkedin' && version.content.documents.length > 0 && version.content.documents.every(doc => doc.kind === 'linkedin_post');
  const expired = !!preview && Date.parse(preview.expiresAt) <= now;
  return <div className='cw pw'>
    <div className='page-heading'><div><span className='eyebrow'>PUBLISH / 02</span><h1>核对版本，再确认发布。</h1><p>这里只使用已确认保存的正式版本。发布需要单独确认。</p></div><button className='button' disabled={busy} onClick={() => {invalidatePreview(); void run(refresh);}}><RefreshCw size={16}/>刷新连接与记录</button></div>
    {error && <div className='cw-alert' role='alert'>{error}</div>}
    <div className='cw-platform-tabs' aria-label='发布平台'>{Object.entries(platformNames).map(([id, label]) => <button className={'button ' + (platform === id ? 'primary' : '')} key={id} disabled={busy} onClick={() => {setPlatform(id as ContentPlatform); setPreview(null); setConfirmed(false);}}>{label}</button>)}</div>
    {platform !== 'linkedin' ? <section className='panel cw-empty'><Send size={34}/><h2>{platformNames[platform]} 发布待适配</h2><p>此平台的发布入口尚未接入，不能提交或返回发布结果。</p></section> : <div className='pw-columns'>
      <div>
        <section className='panel pw-connection'><div className='cw-section-heading'><h2>LinkedIn 个人账号</h2><span className='tag'>{connection?.canPublish ? '已连接，可发布' : '尚不可发布'}</span></div><p>{connection?.message || '正在读取实际连接状态…'}</p>
          {connection?.account && <p><strong>{connection.account.name}</strong><small className='cw-help'>授权权限：{connection.scopes.join('、') || '未返回'}</small></p>}
          <div className='cw-actions'><button className='button' disabled={busy || !connection?.config.configured} onClick={() => void startConnection()}><Link size={16}/>{connection?.account ? '重新授权' : '连接 LinkedIn 账号'}</button>{connection?.account && <button className='button' disabled={busy} onClick={() => void run(async () => {await contentApi('/api/linkedin/connection', 'DELETE', {}); setPreview(null); setConfirmed(false); await refresh();})}>断开连接</button>}</div>
          {connection && !connection.config.configured && <div className='cw-warning'><h3>先在本机服务端配置 OAuth 应用</h3><p>缺少：{connection.config.missing.join('、') || '有效应用配置'}。</p><p>由维护者按项目说明设置应用配置，重新启动服务后刷新。密钥不在页面输入，也不进入备份。</p></div>}
          <details className='cw-options'><summary>连接配置与授权要求</summary><p>应用需启用 LinkedIn 登录和 Share on LinkedIn，并取得个人发帖权限。连接成功不代表原生 Pulse 长文章可发布。</p><dl><dt>回调地址</dt><dd>{connection?.config.redirectUri || '未配置'}</dd><dt>应用 ID</dt><dd>{connection?.config.clientId || '未配置'}</dd><dt>API 版本</dt><dd>{connection?.config.apiVersion || '未配置'}</dd></dl><p className='cw-help'>回调地址须与 LinkedIn 应用后台完全一致。实际 OAuth 授权在 LinkedIn 官方页面完成。</p></details>
        </section>
        <section className='panel pw-select'><h2>选择正式作品与版本</h2><label>作品<select aria-label='选择发布作品' value={item?.id || ''} disabled={busy} onChange={e => void selectItem(e.target.value)}><option value=''>选择已确认保存的作品</option>{items.filter(x => x.platform === 'linkedin').map(x => <option key={x.id} value={x.id}>{x.name} · {languageNames[x.language]}</option>)}</select></label>{!items.some(x => x.platform === 'linkedin') && <p className='cw-help'>还没有正式 LinkedIn 作品。先在创作页确认保存一份稿件。</p>}{item && <label>正式版本<select aria-label='选择发布版本' disabled={busy} value={versionId} onChange={e => {setVersionId(e.target.value); setPreview(null); setConfirmed(false);}}>{item.versions.map(v => <option key={v.id} value={v.id}>版本 {v.number} · {new Date(v.createdAt).toLocaleString()}</option>)}</select></label>}{version && !eligible && <p className='cw-warning'>当前仅支持 LinkedIn 普通 feed 动态；原生 Pulse 长文或混合格式不能发布。</p>}<button className='button primary' disabled={busy || !eligible || !connection?.canPublish} onClick={() => void createPreview()}>核对发布预览</button></section>
      </div>
      <section className='panel pw-preview'><div className='cw-section-heading'><h2>发布预览</h2>{preview && <span className='tag'>{languageNames[preview.language]}</span>}</div>{!preview ? <div className='cw-empty'><FilePreview/><p>选定正式版本和已连接账号后，生成可确认的发布预览。</p>{version && <div className='pw-local-preview'><h3>正式版本正文（尚未核对发布）</h3>{version.content.documents.map(doc => <div key={doc.id}><h4>{doc.title}</h4>{doc.blocks.map(block => <p key={block.id}>{block.text}</p>)}</div>)}<div className='cw-assets'>{version.assets.filter(asset => version.content.assetIds.includes(asset.id) && ['image/png', 'image/jpeg'].includes(asset.mimeType)).map(asset => <figure key={asset.id}><img src={`/api/content/${item!.id}/versions/${version.id}/assets/${asset.id}`} alt={asset.caption || asset.fileName}/><figcaption>{asset.fileName}</figcaption></figure>)}</div></div>}</div> : <><div className='pw-preview-account'><strong>{preview.accountName}</strong><small>LinkedIn 普通动态 · 版本 {version?.number}</small></div><div className='pw-body'>{preview.body}</div><div className='cw-assets'>{preview.assets.map(asset => <figure key={asset.id}>{asset.mimeType.startsWith('image/') && <img src={asset.url} alt={asset.caption || asset.fileName}/>}<figcaption>{asset.fileName}</figcaption></figure>)}</div>{preview.warnings.map((warning, index) => <p className='cw-warning' key={index}>{warning}</p>)}<p className='cw-help'>确认有效期至 {new Date(preview.expiresAt).toLocaleTimeString()}；账号或正式版本变化后需重新预览。</p>{expired ? <p className='cw-warning'>预览已过期，请重新核对发布预览。</p> : <label className='pw-confirm'><input type='checkbox' checked={confirmed} disabled={busy} onChange={e => setConfirmed(e.target.checked)}/><span>我已核对以上正文、图片、语言与账号，确认将此正式版本发布到 LinkedIn。</span></label>}<button className='button primary' disabled={busy || !confirmed || expired || !connection?.canPublish} onClick={() => void publish()}><Send size={16}/>{busy ? '正在提交…' : '确认发布到 LinkedIn'}</button></>}</section>
    </div>}
    <section className='panel pw-records'><div className='cw-section-heading'><h2>真实发布记录</h2><small>不包含未发布的暂存稿</small></div>{!records.length ? <p className='cw-help'>目前没有发布记录。</p> : records.map(record => <article className='pw-record' key={record.id}><div><strong>{record.accountName} · {languageNames[record.language]}</strong><span className='tag'>{statusNames[record.status]}</span><small>{new Date(record.createdAt).toLocaleString()}</small></div>{record.error && <p className='cw-warning'>{record.error}</p>}{record.status === 'unknown' && <p className='cw-warning'>平台结果未知。不要重新发帖；先在平台核对。只有已知平台 ID 的记录才能查询结果。</p>}{record.url && /^https:\/\/(www\.)?linkedin\.com\//.test(record.url) && <a href={record.url} target='_blank' rel='noreferrer'>查看实际发布结果 <ExternalLink size={14}/></a>}{record.status === 'published' && !record.url && <p className='cw-help'>平台已返回成功，暂未提供可用链接。</p>}{record.platformId && ['unknown', 'submitting'].includes(record.status) && <button className='button small-btn' disabled={busy} onClick={() => void run(async () => {const {record: updated} = await contentApi<{record: PublishingRecord}>(`/api/publishing/records/${record.id}/reconcile`, 'POST', {}); setRecords(prev => prev.map(x => x.id === updated.id ? updated : x));})}>查询平台结果（不重发）</button>}</article>)}</section>
  </div>;
}

function FilePreview() {return <Check size={36}/>;}
