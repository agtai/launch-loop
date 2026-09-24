# 阶段输入输出与追溯契约

候选设计，尚未接入生产。字段名是后续接入契约，不宣称现有 API 已支持。模型可用结构化对象或等价 Markdown 工件执行；试稿的实际序列与格式以 tmp 中的运行清单为准。

## 共同包络

每个工件带 `runId, stage, candidateVersion, bundleHash, inputHash, parentArtifactHashes, createdAt, status`。hash 为 UTF-8 实际文件的 SHA-256，创建时保存不可变快照。`inputHash` 覆盖实际已读资料、引用版本、创作三项输入、本次选项和作者参考；UI 语言不在其中。来源 URL 只是定位，不代替已读内容 hash。字符串传输不能静默正规化 Unicode、换行或空白；如果正规化过，记录前后 hash 及变换。

| 阶段 | 输入 | 必须交付的内容 | 继续条件 |
|---|---|---|---|
| intake | 三项必填、本次选项、参考／图片 | sourceManifest（来源／作者／版本／读取范围／日期／hash）、constraintLedger（合并／冲突）、规则快照 | 规则组合 ready，语义要求可满足；否则明确缺口 |
| mother | 已读来源、目的、读者、已合并要求 | 一份母稿；sourceLanguage+reason；spine；简短editorialPlan；claimLedger；termLedger；未解决项 | 核心事实有依据，所有目标稿共用该母稿版本 |
| platform | 母稿、LinkedIn+short_post 规则 | 母稿语言的一份普通 feed 中间稿、段落 claimIds、压缩／取舍说明、imageBrief | 不生成 Pulse 或第二主线；保持关键事实与限定 |
| localize | 同一平台中间稿、termLedger、目标语言 | zh/en 各一份初稿、母稿／平台稿 hash、claimIds、术语映射、未解决项 | 同源语言逐字承接，标 skipped_same_language；另一语言自然本地化 |
| audit | 所有语言初稿、母稿、账本、来源与完整规则、brief | 每 variant 恰好一份 audit，readerTakeaway、editorialAssessment、问题定位／原因／依据／建议、无法判断项 | 对当前实际稿件检查；不能把检查清单当审核已执行 |
| revise | 原初稿、所有 variant 的一次审核结果、共同账本 | 各修订稿、resolvedFindingIds、unresolved、变更与 claimIds；brief 有必要时同批修改 | 不再调用新一轮审稿；修改共同事实要在本批相关稿一致落实 |
| awaiting_confirmation | 修订稿和未解决项 | 待用户查看的 tmp 内容与计数、候选状态 | 不自动正式保存、发布或视为平台通过 |

只有平台×语言决定最终产物数量。平台改写发生在翻译之前；不可先独立写两个母稿再事后称为同源。本轮仅一个平台，目标源语言在平台阶段已经形成的稿件可直接进入对应 variant。

若 intake 的核心要求因证据或互斥约束阻断，运行状态为 `needs_evidence` 或 `needs_resolution`；下游 mother/platform/localize/audit/revise 标 `not_run_blocked`，审核次数为0，最终候选数量为0，但请求的 variant 清单保留。素材保留 `intent=generate`，状态 `not_prepared_blocked`（uploaded 同样只保留来源引用，不声称已检视），不能生成与无依据主张对应的 brief。可交付不含虚构正文的解释或有依据的替代方向，不称原任务已满足。非核心、可安全省略的缺口可继续支持的主线，但仍列 unresolved。

## 事实、术语与稿件对齐

`claimLedger[]` 推荐字段：`id, proposition, attribution, scope, conditions, negation, modality, completionState, evidenceRefs[], status`。status 可为 supported / attributed_claim / historical / planned / disputed / missing。每个 evidenceRef 至少有 sourceId 和标题／行／段定位。内容始终在 tmp，不放正式执行日志。

`termLedger[]`：`conceptId, source, zh, en, preserveSpelling, forbiddenAliases[], explanationOnFirstUse, reason`。保留专名和用户禁用代称，不把术语表变成所有词都必须出现的清单。required 的强制出现范围若有歧义在 constraintLedger 标明，不自行扩大到全部语言。

段落标 `blockId, text, claimIds[]`，同一主张跨语言由 id 关联而非句号数匹配。一个段落可含多项事实；语义不一致不能仅凭 id 相同判合格。

`audit` 绑定初稿 hash、母稿 hash、ruleHash 与 `passNumber=1`；审核维度一次覆盖，不因内部维度数量变成多轮。问题 schema 以 [审核规则](rules/audit-revision.md) 为准。审核集齐后统一修订，可串行或并行模型调用；任何批次失败须保留已完成工件和失败项，不能把残缺批次标成全部完成。

修订后只做确定性校验（结构、长度、差异、引用 finding id），不是再启动一次语言审稿。出现无法解决的问题保持 unresolved；若生成了新错误，记录本轮失败/待处理，不伪造一次审核全通过，也不自动无限重试。

## 确定性计数与素材状态

发布文本与现有接口对齐：非空标题及 blocks 用双换行连接，postingNote 不参与。报告最终整串的 Unicode 代码点数与 UTF-16 单元数。本地保守上限 3000 UTF-16；平台对复杂 Unicode 的实际接受情况仍未发布验证。超限不能截断正文。

明确区分 `internalLabel`（仅任务/界面名，永不进入正文）与 document 的 `title`（非空即参与发布拼接）。不能把用户要求入帖的锁定标题移成 internalLabel 来规避上限。实验若用单一 body 字符串，标题已经包含其中，只计一次，不再重复拼接。

`imageBrief` 与正文关联 parent hashes、claimIds、文字语言及状态。generate 仅 `brief_only_not_generated`，uploaded 无法读则 unread；真正生成、读取图片、平台上传、线上显示是独立状态，本轮均不冒充完成。

## 日志与保存

真实资料、母稿、提示、完整规则拼装（含本次自由文字）、审核、生成事件正文与修改提案都在隔离 tmp。可追踪文件只存原创通用规则、合成样例和不含用户正文的验证元数据。将来系统正式确认依旧走现有 confirm，追加版本且保留旧版；候选契约不改备份协议。无自动清理，也不调用现有服务。
