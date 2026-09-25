import {useEffect, useRef, useState} from 'react';
import {Check, ExternalLink, Link, RefreshCw, Send} from 'lucide-react';
import type {ContentItem, ContentPlatform, ContentSummary, LinkedInConnection, PublishingPreview, PublishingRecord} from './content-types';
import {contentApi, errorMessage, languageNames, platformNames} from './content-api';
import './content-workspace.css';
import {useI18n} from './i18n';

const statusNames = {submitting: '提交中', published: '已发布', failed: '发布失败', unknown: '结果未知'};

export default function PublishingWorkspace({active = true, dataEpoch = 0}: {active?: boolean; dataEpoch?: number}) {
  const {t, date, locale} = useI18n();
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
      const {authorizationUrl} = await contentApi<{authorizationUrl: string}>('/api/linkedin/connection/start', 'POST', {locale});
      const url = new URL(authorizationUrl);
      if (epoch !== viewEpoch.current) return;
      if (url.protocol !== 'https:' || url.hostname !== 'www.linkedin.com' || url.username || url.password || url.port || url.pathname !== '/oauth/v2/authorization') throw new Error('授权地址不是 LinkedIn 官方地址，已停止跳转。');
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
  async function reconcileRecord(id: string) {
    await run(async () => {
      const epoch = viewEpoch.current;
      try {
        const {record: updated} = await contentApi<{record: PublishingRecord}>(`/api/publishing/records/${id}/reconcile`, 'POST', {});
        if (epoch === viewEpoch.current) setRecords(prev => prev.map(record => record.id === updated.id ? updated : record));
      } catch (e) {
        if (epoch === viewEpoch.current) setError(errorMessage(e));
      } finally {
        // A rejected lookup can expire the session even though the post remains unknown.
        if (epoch === viewEpoch.current) await refresh();
      }
    });
  }
  const version = item?.versions.find(v => v.id === versionId);
  const eligible = version?.content.platform === 'linkedin' && version.content.documents.length === 1 && version.content.documents[0].kind === 'linkedin_post';
  const expired = !!preview && Date.parse(preview.expiresAt) <= now;
  const connectionExpired = !!connection?.expiresAt && Date.parse(connection.expiresAt) <= now;
  const canPublish = !!connection?.canPublish && !connectionExpired;
  return <div className='cw pw'>
    <div className='page-heading'><div><span className='eyebrow'>{t('发布 / 02')}</span><h1>{t("核对版本，再确认发布。")}</h1><p>{t("这里只使用已确认保存的正式版本。发布需要单独确认。")}</p></div><button className='button' disabled={busy} onClick={() => {invalidatePreview(); void run(refresh);}}><RefreshCw size={16}/>{t("刷新连接与记录")}</button></div>
    {error && <div className='cw-alert' role='alert'>{t(error)}</div>}
    <div className='cw-platform-tabs' aria-label={t("发布平台")}>{Object.entries(platformNames).map(([id, label]) => <button className={'button ' + (platform === id ? 'primary' : '')} key={id} disabled={busy} onClick={() => {setPlatform(id as ContentPlatform); setPreview(null); setConfirmed(false);}}>{t(label)}</button>)}</div>
    {platform !== 'linkedin' ? <section className='panel cw-empty'><Send size={34}/><h2>{t('{platform} 发布待适配', {platform: t(platformNames[platform])})}</h2><p>{t("此平台的发布入口尚未接入，不能提交或返回发布结果。")}</p></section> : <div className='pw-columns'>
      <div>
        <section className='panel pw-connection'><div className='cw-section-heading'><h2>{t("LinkedIn 个人账号")}</h2><span className='tag'>{canPublish ? t("已连接，可发布") : t("尚不可发布")}</span></div><p>{connectionExpired ? t('LinkedIn 授权已过期，请重新连接。') : connection?.message ? t(connection.message) : t("正在读取实际连接状态…")}</p>
          {connection?.account && <p><strong>{connection.account.name}</strong><small className='cw-help'>{t('账号 ID：')}{connection.account.id}</small><small className='cw-help'>{t("授权权限：")}{connection.scopes.join(', ') || t("未返回")}</small>{connection.expiresAt && <small className='cw-help'>{t('授权有效期至 {date}', {date: date(connection.expiresAt)})}</small>}</p>}
          <div className='cw-actions'><button className='button' disabled={busy || !connection?.config.configured} onClick={() => void startConnection()}><Link size={16}/>{connection?.account ? t("重新授权") : t("连接 LinkedIn 账号")}</button>{connection?.account && <button className='button' disabled={busy} onClick={() => void run(async () => {await contentApi('/api/linkedin/connection', 'DELETE', {}); setPreview(null); setConfirmed(false); await refresh();})}>{t("断开连接")}</button>}</div>
          {connection && !connection.config.configured && <div className='cw-warning'><h3>{t("先在本机服务端配置 OAuth 应用")}</h3><p>{t("缺少：")}{connection.config.missing.map(value => t(value)).join(', ') || t("有效应用配置")}{t("。")}</p><p>{t("由维护者按项目说明设置应用配置，重新启动服务后刷新。密钥不在页面输入，也不进入备份。")}</p></div>}
          <p className='cw-help'><a href='/docs/linkedin-setup.md' download>{t("下载授权配置指南（中文）")}</a></p>
          <details className='cw-options'><summary>{t("连接配置与授权要求")}</summary><p>{t("应用需启用 LinkedIn 登录和 Share on LinkedIn，并取得个人发帖权限。连接成功不代表原生 Pulse 长文章可发布。")}</p><dl><dt>{t("回调地址")}</dt><dd>{connection?.config.redirectUri || t("未配置")}</dd><dt>{t("应用 ID")}</dt><dd>{connection?.config.clientId || t("未配置")}</dd><dt>{t("API 版本")}</dt><dd>{connection?.config.apiVersion || t("未配置")}</dd></dl><p className='cw-help'>{t("回调地址须与 LinkedIn 应用后台完全一致。实际 OAuth 授权在 LinkedIn 官方页面完成。")}</p></details>
        </section>
        <section className='panel pw-select'><h2>{t("选择正式作品与版本")}</h2><label>{t("作品")}<select aria-label={t("选择发布作品")} value={item?.id || ''} disabled={busy} onChange={e => void selectItem(e.target.value)}><option value=''>{t("选择已确认保存的作品")}</option>{items.filter(x => x.platform === 'linkedin').map(x => <option key={x.id} value={x.id}>{x.name} {t("·")}{t(languageNames[x.language])}</option>)}</select></label>{!items.some(x => x.platform === 'linkedin') && <p className='cw-help'>{t("还没有正式 LinkedIn 作品。先在创作页确认保存一份稿件。")}</p>}{item && <label>{t("正式版本")}<select aria-label={t("选择发布版本")} disabled={busy} value={versionId} onChange={e => {setVersionId(e.target.value); setPreview(null); setConfirmed(false);}}>{item.versions.map(v => <option key={v.id} value={v.id}>{t('版本 {number}', {number: v.number})} {t("·")}{date(v.createdAt)}</option>)}</select></label>}{version && !eligible && <p className='cw-warning'>{t("当前仅支持 LinkedIn 普通 feed 动态；原生 Pulse 长文或混合格式不能发布。")}</p>}<button className='button primary' disabled={busy || !eligible || !canPublish} onClick={() => void createPreview()}>{t("核对发布预览")}</button></section>
      </div>
      <section className='panel pw-preview'><div className='cw-section-heading'><h2>{t("发布预览")}</h2>{preview && <span className='tag'>{t(languageNames[preview.language])}</span>}</div>{!preview ? <div className='cw-empty'><FilePreview/><p>{t("选定正式版本和已连接账号后，生成可确认的发布预览。")}</p>{version && <div className='pw-local-preview'><h3>{t("正式版本正文（尚未核对发布）")}</h3>{version.content.documents.map(doc => <div key={doc.id}><h4>{doc.title}</h4>{doc.blocks.map(block => <p key={block.id}>{block.text}</p>)}</div>)}<div className='cw-assets'>{version.assets.filter(asset => version.content.assetIds.includes(asset.id) && ['image/png', 'image/jpeg'].includes(asset.mimeType)).map(asset => <figure key={asset.id}><img src={`/api/content/${item!.id}/versions/${version.id}/assets/${asset.id}`} alt={asset.caption || asset.fileName}/><figcaption>{asset.fileName}</figcaption></figure>)}</div></div>}</div> : <><div className='pw-preview-account'><strong>{preview.accountName}</strong><small>{t('账号 ID：')}{preview.accountId}</small><small>{t('LinkedIn 普通动态 · 版本 {number}', {number: preview.versionNumber})}</small></div><div className='pw-body'>{preview.body}</div><div className='cw-assets'>{preview.assets.map(asset => <figure key={asset.id}>{asset.mimeType.startsWith('image/') && <img src={asset.url} alt={asset.caption || asset.fileName}/>}<figcaption>{asset.fileName}</figcaption></figure>)}</div>{preview.warnings.map((warning, index) => <p className='cw-warning' key={index}>{t(warning)}</p>)}<p className='cw-help'>{t('确认有效期至 {date}；账号或正式版本变化后需重新预览。', {date: date(preview.expiresAt)})}</p>{expired ? <p className='cw-warning'>{t("预览已过期，请重新核对发布预览。")}</p> : <label className='pw-confirm'><input type='checkbox' checked={confirmed} disabled={busy} onChange={e => setConfirmed(e.target.checked)}/><span>{t("我已核对以上正文、图片、语言与账号，确认将此正式版本发布到 LinkedIn。")}</span></label>}<button className='button primary' disabled={busy || !confirmed || expired || !canPublish} onClick={() => void publish()}><Send size={16}/>{busy ? t("正在提交…") : t("确认发布到 LinkedIn")}</button></>}</section>
    </div>}
    <section className='panel pw-records'><div className='cw-section-heading'><h2>{t("真实发布记录")}</h2><small>{t("不包含未发布的暂存稿")}</small></div>{!records.length ? <p className='cw-help'>{t("目前没有发布记录。")}</p> : records.map(record => <article className='pw-record' key={record.id}>
      <div><strong>{record.accountName} {t("·")}{t(languageNames[record.language])}</strong><span className='tag'>{t(statusNames[record.status])}</span><small>{date(record.createdAt)}</small></div>
      <small className='cw-help'>{t('账号 ID：')}{record.accountId}</small>
      {record.platformId && <small className='cw-help'>{t('平台帖子 ID：')}{record.platformId}</small>}
      {record.error && <p className='cw-warning'>{t(record.error)}</p>}
      {record.status === 'unknown' && <><p className='cw-warning'>{t("平台结果未知。不要重新发帖；先在平台核对。只有已知平台 ID 的记录才能查询结果。")}</p><p className='cw-help'>{t('在该账号的动态中比对本次正文、配图和时间；未找到也不能据此自动重发。')}</p><a href={record.platformId && /^urn:li:(share|ugcPost):[0-9]{1,40}$/.test(record.platformId) ? `https://www.linkedin.com/feed/update/${record.platformId}/` : 'https://www.linkedin.com/feed/'} target='_blank' rel='noreferrer'>{t('打开 LinkedIn 人工核对')}<ExternalLink size={14}/></a></>}
      {record.url && /^https:\/\/(www\.)?linkedin\.com\//.test(record.url) && <a href={record.url} target='_blank' rel='noreferrer'>{t("查看实际发布结果")}<ExternalLink size={14}/></a>}
      {record.status === 'published' && <p className='cw-help'>{t('已取得平台帖子 ID；请打开 LinkedIn 核对账号、正文、配图和可见状态。')}</p>}
      {record.platformId && record.status === 'unknown' && <><button className='button small-btn' disabled={busy || !canPublish || connection?.account?.id !== record.accountId || !connection?.scopes.includes('r_member_social')} onClick={() => void reconcileRecord(record.id)}>{t("查询平台结果（不重发）")}</button>{!connection?.scopes.includes('r_member_social') && <p className='cw-help'>{t('当前授权没有受限的 r_member_social 读取权限；请在 LinkedIn 人工核对。发布权限不代表读取权限。')}</p>}</>}
    </article>)}</section>
  </div>;
}

function FilePreview() {return <Check size={36}/>;}
