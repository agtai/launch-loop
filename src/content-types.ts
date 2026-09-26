// Round 1 storage contract. One item is one platform-language variant.
// The earlier unconnected UI draft is retained in Git checkpoint 1d74cb0.
// Confirmation here means local save only; it never authorizes publishing.
export type ContentPlatform = 'linkedin' | 'x' | 'xiaohongshu' | 'zhihu' | 'bilibili';
export type ContentLanguage = 'zh' | 'en';
export type ContentFormat = 'short_post' | 'long_article' | 'thread';
export type ContentKind = 'linkedin_article' | 'linkedin_post' | 'article' | 'post' | 'thread';
export type XImageBinding = {
  ruleVersion: string; intent: 'generate' | 'uploaded'; status: 'dependency_blocked' | 'uploaded' | 'generated' | 'needs_update' | 'failed';
  language: ContentLanguage; textHash: string; documentHash: string; brief: string; briefHash: string;
  sourceAssetIds: string[]; assetId: string | null; assetHash: string | null; mimeType: string | null;
  width: number | null; height: number | null; visualVerification: 'not_run' | 'passed' | 'failed';
  visualMethod?: 'user' | 'codex-image-input';
  altText: string; generated: boolean; errorCode: string | null;
};
export type ContentBlock = { id: string; type: 'paragraph' | 'heading' | 'list' | 'quote' | 'x_post'; text: string; assetIds?: string[]; image?: XImageBinding };
export type XImageCapability = {available: boolean; checking?: boolean; status: string; reason?: string; canRefresh?: boolean};
export type XImageJob = {id: string; tmpId: string; documentId: string; mode: 'generate' | 'check'; status: string; stage: string; error: string | null; sourceRevision: number; resultRevision: number | null; assetId: string | null; createdAt: string; updatedAt: string};
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
  madeWithAi?: boolean;
  source: { kind: 'upload' | 'generated'; url: string | null }; caption: string;
  imageBinding?: { documentsHash: string; width: number; height: number; checkedAt: string };
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

// Stage 2: execution remains temporary; publishing requires a separate confirmation.
export type GenerationStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelling' | 'cancelled' | 'interrupted' | 'needs_evidence' | 'needs_resolution';
export type GenerationStage = GenerationStatus | 'reading' | 'generating' | 'reviewing' | 'reviewed' | 'revising' | 'mother' | 'platform' | 'localization' | 'drafts_frozen' | 'image_generation' | 'image_check' | 'adapting' | 'localizing';
export type GenerationAssetStatus = 'none' | 'pending' | 'uploaded' | 'unconnected' | 'generating' | 'checking' | 'ready' | 'failed' | 'cancelled' | 'interrupted' | 'outdated';
export type GenerationVariant = {
  platform: ContentPlatform; language: ContentLanguage; tmpId: string | null;
  status: GenerationStatus; stage: GenerationStage; error: string | null;
  assetStatus: GenerationAssetStatus; unresolved: string[];
  assetError?: string | null;
};
export type GenerationJob = {
  id: string; requestId: string; kind: 'generation' | 'modification' | 'image';
  status: GenerationStatus; stage: GenerationStage; createdAt: string; updatedAt: string;
  error: string | null; source: { tmpId: string; revision: number } | null; variants: GenerationVariant[];
  disposition?: 'pending' | 'accepted' | 'rejected' | 'undone';
  acceptedTmpId?: string; undoOf?: string;
  canResumeMother?: boolean; resumedMother?: boolean;
  canResumeReview?: boolean; resumedReview?: boolean;
  change?: ModificationRequest['selection'] & { replacement: string; changesSharedFacts: boolean; impactReason: string; changedClaimIds: string[] };
  languageImpact?: { sourcePlatform?: ContentPlatform; sourceLanguage: ContentLanguage; modificationId: string; reason: string; affectedLanguages: ContentLanguage[] };
  progress?: { stage: string; startedAt: string; budgetMs: number };
};
export type GenerationOptions = {
  authorIdentities?: Array<'product_author' | 'team' | 'third_party'>;
  styles?: Array<'professional' | 'plain' | 'concise'>;
  depths?: Array<'brief' | 'standard' | 'detailed'>;
  project?: 'system1-agents'; terminology?: { required: string[]; forbidden: string[] };
  referenceMode?: 'structure_and_voice';
};
export type GenerationRequest = { requestId: string; name: string; brief: ContentBrief; uploads: ContentUploadInput[]; options: GenerationOptions };
export type ModificationRequest = {
  requestId: string; tmpId: string; revision: number;
  selection: { documentId: string; blockId: string; start: number; end: number; text: string };
  instruction: string;
};
export type GenerationCapabilities = {
  text: { status: 'available' | 'unavailable' | 'unknown'; message: string };
  image: { status: 'available' | 'unconnected'; message: string; checking?: boolean; canRefresh?: boolean; x?: XImageCapability };
  materials: { extensions: string[] };
};
export type LinkedInConnection = {
  status: 'unconfigured' | 'disconnected' | 'connected' | 'missing_permissions' | 'expired';
  message: string; account: { id: string; name: string; urn: string } | null;
  scopes: string[]; canPublish: boolean;
  expiresAt: string | null;
  config: { configured: boolean; clientId: string | null; redirectUri: string | null; apiVersion: string; missing: string[] };
};
export type PublishingPreview = {
  id: string; itemId: string; versionId: string; accountId: string; accountName: string;
  language: ContentLanguage; body: string; assets: Array<ContentAsset & { url: string }>;
  contentHash: string; confirmationToken: string; expiresAt: string; warnings: string[];
  versionNumber: number;
};
export type PublishingRecord = {
  id: string; itemId: string; versionId: string; accountId: string; accountName: string;
  language: ContentLanguage; contentHash: string; status: 'submitting' | 'published' | 'failed' | 'unknown';
  platformId: string | null; url: string | null; createdAt: string; updatedAt: string; error: string | null;
};
