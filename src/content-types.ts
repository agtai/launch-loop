// Round 1 storage contract. One item is one platform-language variant.
// The earlier unconnected UI draft is retained in Git checkpoint 1d74cb0.
// Confirmation here means local save only; it never authorizes publishing.
export type ContentPlatform = 'linkedin' | 'x' | 'xiaohongshu' | 'zhihu' | 'bilibili';
export type ContentLanguage = 'zh' | 'en';
export type ContentFormat = 'short_post' | 'long_article' | 'thread';
export type ContentKind = 'linkedin_article' | 'linkedin_post' | 'article' | 'post' | 'thread';
export type ContentBlock = { id: string; type: 'paragraph' | 'heading' | 'list' | 'quote'; text: string };
export type ContentDocument = { id: string; kind: ContentKind; title: string; blocks: ContentBlock[]; postingNote: string };
export type ContentSource = { id: string; label: string } & (
  | { type: 'text'; text: string }
  | { type: 'url'; url: string }
  | { type: 'asset'; assetId: string }
  | { type: 'saved_version'; itemId: string; versionId: string }
);
export type ContentBrief = {
  materials: ContentSource[]; purpose: string; audience: string;
  platforms: ContentPlatform[]; languages: ContentLanguage[]; formats: ContentFormat[];
  authorIdentity: string[]; styleTerms: string[]; lengthDepth: string[]; references: ContentSource[];
};
export type ContentRuleMetadata = { ruleSetVersion: string; fragmentIds: string[]; hash: string };
export type ContentExecution = {
  provider: string; model: string; runId: string;
  stage: 'generation' | 'review' | 'revision' | 'asset_generation';
  status: 'started' | 'succeeded' | 'failed'; startedAt: string; finishedAt: string | null;
};
export type ContentDraft = {
  name: string; projectId: string | null; platform: ContentPlatform | null; language: ContentLanguage | null;
  brief: ContentBrief; documents: ContentDocument[]; sources: ContentSource[]; assetIds: string[];
  rule: ContentRuleMetadata | null; executions: ContentExecution[];
};
export type ContentAsset = {
  id: string; fileName: string; mimeType: string; byteLength: number; sha256: string;
  source: { kind: 'upload' | 'generated'; url: string | null }; caption: string;
};
export type ContentUploadInput = Pick<ContentAsset, 'id' | 'fileName' | 'mimeType' | 'source' | 'caption'> & { dataBase64: string };
export type ContentTmpCreateInput = { content: ContentDraft; base?: ContentBase | null; uploads?: ContentUploadInput[] };
export type ContentTmpUpdateInput = { revision: number; content: ContentDraft; temporary: ContentTemporary };
export type ContentConfirmInput = { revision: number; confirmed: true };
export type ContentBase = { itemId: string; revision: number; versionId: string };
export type ContentTemporary = { initialDocuments: ContentDocument[]; reviewFindings: string; prompt: string };
export type ContentTmp = {
  id: string; revision: number; createdAt: string; updatedAt: string; restoreEpoch: number;
  base: ContentBase | null; content: ContentDraft; temporary: ContentTemporary; assets: ContentAsset[];
  confirmed: { itemId: string; versionId: string; at: string } | null;
  stale: boolean; // 返回时计算，不写入 tmp 文件
};
export type ContentVersion = { id: string; number: number; createdAt: string; content: ContentDraft; assets: ContentAsset[] };
export type ContentItem = { id: string; revision: number; createdAt: string; updatedAt: string; currentVersionId: string; versions: ContentVersion[] };
export type ContentSummary = { id: string; name: string; platform: ContentPlatform; language: ContentLanguage; revision: number; updatedAt: string; currentVersionId: string; versionNumber: number };
export type ContentBackup = { schemaVersion: 1; items: Array<Omit<ContentItem, 'versions'> & { versions: Array<Omit<ContentVersion, 'assets'> & { assets: Array<ContentAsset & { dataBase64: string }> }> }> };
