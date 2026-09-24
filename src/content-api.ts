import type {ContentUploadInput} from './content-types';

export class ContentApiError extends Error {
  status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}

export async function contentApi<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method, cache: 'no-store',
    ...(body === undefined ? {} : {headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)}),
  });
  const value = await response.json().catch(() => null);
  if (!response.ok) throw new ContentApiError(value?.error || `请求失败（${response.status}），请检查本地服务。`, response.status);
  if (!value) throw new Error('本地服务未返回有效数据。');
  return value as T;
}

export const errorMessage = (error: unknown) => error instanceof Error ? error.message : '请求失败，输入仍保留。';
export const platformNames = {linkedin: 'LinkedIn', x: 'X', xiaohongshu: '小红书', zhihu: '知乎', bilibili: '哔哩哔哩（Bilibili）'};
export const languageNames = {zh: '中文', en: '英文'};

export async function uploadInput(file: File): Promise<ContentUploadInput> {
  if (file.size > 4 * 1024 * 1024) throw new Error(`${file.name} 超过单文件 4 MiB 限制。`);
  const dataBase64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`无法读取 ${file.name}`));
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.readAsDataURL(file);
  });
  const textMime = /\.(md|txt)$/i.test(file.name) ? 'text/plain' : '';
  return {id: crypto.randomUUID(), fileName: file.name, mimeType: textMime || file.type || 'application/octet-stream', dataBase64, source: {kind: 'upload', url: null}, caption: ''};
}

export function downloadDraft(name: string, content: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(content, null, 2)], {type: 'application/json'}));
  const link = document.createElement('a'); link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
