import {useState} from 'react';
import type {ContentAsset, ContentDocument} from './content-types';
import {countXText} from '../server/x-text.mjs';
import {useI18n} from './i18n';

type Props = {
  documents: ContentDocument[]; assets: ContentAsset[]; editable: boolean;
  assetUrl: (id: string) => string;
  onChange: (documents: ContentDocument[]) => void;
  onSelect: (selection: {documentId: string; blockId: string; start: number; end: number; text: string}) => void;
  onBind: (documentId: string, assetId: string) => void;
  onPrepare: (documentId: string) => void; onVerify: (documentId: string, altText: string, generated: boolean) => void;
  onUpload: (file: File, documentId: string) => void;
};

export default function XDocuments({documents, assets, editable, assetUrl, onChange, onSelect, onBind, onPrepare, onVerify, onUpload}: Props) {
  const {t} = useI18n();
  const [imageChecks, setImageChecks] = useState<Record<string, {altText: string; generated: boolean}>>({});
  const change = (document: ContentDocument) => onChange(documents.map(doc => doc.id === document.id ? document : doc));
  const imageAssets = assets.filter(asset => ['image/png', 'image/jpeg'].includes(asset.mimeType));
  return <div className='x-documents'>{documents.map(doc => <article className='cw-document x-document' key={doc.id}>
    <div className='cw-section-heading'><h3>{t(doc.kind === 'thread' ? '串帖' : '普通帖子')}</h3><span className='tag'>{t('{count} 条帖子', {count: doc.blocks.length})}</span></div>
    {doc.kind === 'thread' && <p className='cw-help'>{t('按下列顺序逐条发布，每条回复前一条。保存整个串帖，发布时只选择这个内容对象。')}</p>}
    {doc.blocks.map((block, index) => {
      const count = countXText(block.text);
      const image = block.image;
      const checkKey = doc.id + ':' + block.id + ':' + (image?.assetHash || '') + ':' + (image?.textHash || '');
      return <section className='x-post' key={block.id}>
        <div className='cw-section-heading'><strong>{t('第 {number} 条', {number: index + 1})}</strong><span className={count.valid ? 'tag' : 'cw-warning'}>{t('加权字数 {count} / 280', {count: count.weightedLength})}</span></div>
        <textarea aria-label={t('{format}第 {number} 条正文', {format: t(doc.kind === 'thread' ? '串帖' : '普通帖子'), number: index + 1})} rows={Math.max(3, Math.min(9, Math.ceil(block.text.length / 45)))} readOnly={!editable} value={block.text}
          onChange={event => change({...doc, blocks: doc.blocks.map(b => b.id === block.id ? {...b, text: event.target.value, ...(b.image ? {image: {...b.image, status: 'needs_update', visualVerification: 'not_run'}} : {})} : b)})}
          onSelect={event => {const element = event.currentTarget; if (editable && element.selectionStart !== element.selectionEnd) onSelect({documentId: doc.id, blockId: block.id, start: element.selectionStart, end: element.selectionEnd, text: element.value.slice(element.selectionStart, element.selectionEnd)});}}/>
        {!count.valid && <p className='cw-warning'>{t('这条帖子尚不能发布。请修订正文；系统不会截断或自动拆帖。')}</p>}
        {editable && doc.kind === 'thread' && <div className='cw-actions'>
          <button className='button small-btn' disabled={index === 0 || index === 1 && !!doc.blocks[0].assetIds?.length} onClick={() => {
            const blocks = [...doc.blocks]; [blocks[index - 1], blocks[index]] = [blocks[index], blocks[index - 1]];
            // The first-post illustration must be explicitly rebound after reordering.
            change({...doc, blocks: blocks.map((b, i) => ({...b, ...(i === 0 && b.image ? {image: {...b.image, status: 'needs_update', visualVerification: 'not_run'}} : {image: undefined})}))});
          }}>{t('上移')}</button>
          <button className='button small-btn' disabled={index === doc.blocks.length - 1 || index === 0 && !!block.assetIds?.length} onClick={() => {
            const blocks = [...doc.blocks]; [blocks[index + 1], blocks[index]] = [blocks[index], blocks[index + 1]];
            change({...doc, blocks: blocks.map((b, i) => ({...b, ...(i === 0 && b.image ? {image: {...b.image, status: 'needs_update', visualVerification: 'not_run'}} : {image: undefined})}))});
          }}>{t('下移')}</button>
          <button className='button small-btn' disabled={doc.blocks.length <= 2 || !!block.assetIds?.length} onClick={() => change({...doc, blocks: doc.blocks.filter(b => b.id !== block.id).map(b => b.image ? {...b, image: {...b.image, status: 'needs_update', visualVerification: 'not_run'}} : b)})}>{t('删除此条')}</button>
        </div>}
        {!!block.assetIds?.length && <div className='cw-assets'>{block.assetIds.map(id => {const asset = imageAssets.find(a => a.id === id); return asset ? <figure key={id}><img src={assetUrl(id)} alt={image?.altText || asset.caption || asset.fileName}/><figcaption>{asset.fileName}{image?.width ? ` · ${image.width} × ${image.height}` : ''}</figcaption></figure> : <p className='cw-warning' key={id}>{t('关联图片缺失，请重新选择。')}</p>;})}</div>}
        {index === 0 && <div className='x-image-controls'>
          <strong>{t(doc.kind === 'thread' ? '首帖配图' : '帖子配图')}</strong>
          {image?.status === 'dependency_blocked' && <p className='cw-warning'>{t('配图说明已准备，尚无通过检查的图片。请查看后台配图状态。')}</p>}
          {image?.status === 'needs_update' && <p className='cw-warning'>{t('正文、顺序或图片发生变化，请重新关联并检查配图。')}</p>}
          {image?.status === 'failed' && <p className='cw-warning'>{t('配图处理失败，请重新处理。')}</p>}
          {image?.visualVerification === 'passed' && image.visualMethod === 'codex-image-input' && <p className='cw-help'>{t('自动看图检查通过；请在保存前核对实际图片。')}</p>}
          {image?.brief && <details><summary>{t('配图说明')}</summary><p className='x-brief'>{image.brief}</p></details>}
          {editable && <><label>{t('选择这条帖子的图片')}<select aria-label={t('{format}配图', {format: t(doc.kind === 'thread' ? '串帖' : '普通帖子')})} value={block.assetIds?.[0] || ''} onChange={event => {
            if (event.target.value) onBind(doc.id, event.target.value);
            else change({...doc, blocks: doc.blocks.map((b, i) => i === 0 ? {...b, assetIds: [], image: undefined} : b)});
          }}><option value=''>{t('无图片')}</option>{imageAssets.map(asset => <option key={asset.id} value={asset.id}>{asset.fileName}</option>)}</select></label>
          <div className='cw-actions'><label className='cw-upload'>{t('上传配图')}<input type='file' accept='image/png,image/jpeg' onChange={event => {const file = event.target.files?.[0]; if (file) onUpload(file, doc.id); event.target.value = '';}}/></label><button className='button small-btn' onClick={() => onPrepare(doc.id)}>{t('更新配图说明')}</button></div>
          {!!block.assetIds?.length && <p className='cw-help'>{t('调整首帖顺序前，请先选择无图片，再为新的首帖关联图片。')}</p>}
          {!!block.assetIds?.length && image?.status !== 'needs_update' && <div className='x-image-verify'>
            <label>{t('图片说明（供无法看图的读者）')}<input maxLength={1000} value={imageChecks[checkKey]?.altText ?? image?.altText ?? ''} onChange={event => setImageChecks({...imageChecks, [checkKey]: {generated: imageChecks[checkKey]?.generated ?? image?.generated ?? false, altText: event.target.value}})}/></label>
            <label className='pw-confirm'><input type='checkbox' checked={imageChecks[checkKey]?.generated ?? image?.generated ?? false} disabled={image?.generated} onChange={event => setImageChecks({...imageChecks, [checkKey]: {altText: imageChecks[checkKey]?.altText ?? image?.altText ?? '', generated: event.target.checked}})}/>{t('此图由 AI 生成')}</label>
            <button className='button small-btn' disabled={image?.visualVerification === 'passed' && image.visualMethod !== 'codex-image-input' && !imageChecks[checkKey] || !(imageChecks[checkKey]?.altText ?? image?.altText ?? '').trim()} onClick={() => onVerify(doc.id, imageChecks[checkKey]?.altText ?? image?.altText ?? '', imageChecks[checkKey]?.generated ?? image?.generated ?? false)}>{t(image?.visualVerification === 'passed' && image.visualMethod !== 'codex-image-input' ? '已人工核对配图' : '我已检查配图与正文一致、文字可读')}</button>
          </div>}
          </>}
        </div>}
      </section>;
    })}
    {editable && doc.kind === 'thread' && <button className='button small-btn' disabled={doc.blocks.length >= 25} onClick={() => change({...doc, blocks: [...doc.blocks.map(b => b.image ? {...b, image: {...b.image, status: 'needs_update' as const, visualVerification: 'not_run' as const}} : b), {id: crypto.randomUUID(), type: 'x_post', text: '', assetIds: []}]})}>{t('添加一条帖子')}</button>}
    {doc.postingNote && <p className='cw-help'>{doc.postingNote}</p>}
  </article>)}</div>;
}
