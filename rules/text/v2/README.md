# text-v2.0.0：共同母稿与双语普通动态

本目录是 `linkedin-text-candidate.0.2.1` 的版本化生产接入，入口为
`server/text-rules-v2.mjs` 与 `server/text-pipeline.mjs`。用户本轮授权覆盖原候选
“暂不接入生产”的状态限制；原候选、原始作者参考和 `rules/text/v1/` 保持原样。
来源字节指纹见 `provenance.json`，来源取舍、许可和样稿边界仍见
`skill-preparation/linkedin-text/sources.md`、`localization-sources.md`、
`author-reference.md` 与 `validation.md`。那些历史试稿结果不是本次运行证据。

## 固定映射

`resolveIntegratedTextRules(config)` 接受与 v1 相同的配置，返回兼容的
`status/issues/variants`，单稿含 `ruleMetadata/instructions/auditChecks/documents`。
只有 `linkedin × short_post × zh/en` 可执行；一批包含其他平台或格式时全部停止，
不能部分冒充成功。其余多选合并为同一套要求。只有显式
`project=system1-agents` 才加入作者层，不靠材料关键词套用产品标题。

每份稿保存完整规则、选项、文件 SHA-256 和阶段指令。variant hash 只含该稿的
平台、语言和合并要求，双语批次与单语复核得到相同 hash；UI 语言不参与。
新增任务用 v2；旧任务仍凭原 v1 完整快照回溯，不覆盖旧规则。

为压缩单次提示，母稿只取 core 与已选作者层；平台阶段取 LinkedIn、素材与作者层；
本地化阶段取本地化与作者层；审核一次覆盖全部适用规则；修订取平台、本地化、
审核修订及作者层。所有阶段都带相同生产执行边界和选项。规则中的历史产品例子
不能当作新稿的事实证据；运行时只能使用本次已读来源。

## 管线接口

```js
await runTextPipeline({
  variants: resolveIntegratedTextRules(config).variants,
  context: { runId, brief, options, actualSources, inputHash, signal },
  call: async ({ stage, variantId, variant, payload, schema, timeoutMs }) => output,
  checkpoint: async event => persistOnlyInTmp(event),
});
```

`variantId` 就是规则的 `id`，如 `linkedin:en`。管线不操作网络、文件、账号或正式
内容库，调用方拥有受控进程、取消、实际输出暂存和写入保护。每次回调前后检查取消。

顺序为共同母稿 → 源语言平台稿 → 同语言逐字透传／另一语言本地化 → 冻结全部初稿 →
各稿一次审核 → 集齐审核后依次修订。常见双语请求为 7 次调用；单一源语言为 4 次。
两个审核都看冻结初稿，任何一份审核失败都不进入修订，不自动重试。

母稿／审核预算各 300 秒，平台／修订各 240 秒，本地化 180 秒；服务可采用更小上限。
提示不重复传完整 brief 内的来源副本，母稿要求精简完整论述、必要事实和短编辑计划。
资料超过输入预算明确拒绝，不能静默裁切后宣称完整读取。

仅在同任务平台阶段失败、完整母稿已保留时，调用方可显式传入
`resumeMother: { intakeArtifact, motherArtifact }`。管线核对工件 hash、runId、完整输入
摘要、来源 ID／角色／hash／范围、完整及共享规则快照和父工件链；匹配后重用原母稿，
保留原始时间和来源读取记录，两个 `artifact` 事件附 `reused: true`，从平台阶段继续。
后续仍须冻结双语稿、每稿审核一次、集齐后修订。该入口不提供跨任务缓存或其他阶段
恢复；调用方负责限制一次显式继续、保存原失败证据和复核当前 tmp revision。

审核调用技术失败且尚无修订工件时，另可显式传入
`resumeFrozen: { intakeArtifact, motherArtifact, platformArtifact, draftArtifacts, reviewArtifacts }`。
不能同时传 `resumeMother`。管线复核完整来源／规则／工件链、源语言逐字透传、全部冻结稿
及已有审核的实际引文位置、draft／frozen／rule hash、单次审核计数。已成功审核只复用原工件，
不调用模型、不再次发出 `review` 事件；只有缺失的审核被执行。原冻结稿通过 `drafts_reused`
事件交给服务核对，不再次发出会改写 tmp 的 `drafts_frozen`。调用方须验证当前 tmp 与原冻结稿
及原 revision 一致，拒绝已有 revision 工件，限制此审核恢复最多一次，并保留原失败输出。
审核 payload 保留完整适用规则、实际来源、事实及术语账本；当前稿只在 initialDocuments
出现一次，frozenDrafts 仅含其他稿件。短评要求减少重复引用，不删减四项编辑判断或事实检查。

`checkpoint` 事件：

- `stage`：阶段、variantId、startedAt，更新真实进度。
- `artifact`：不可变来源／母稿／平台／初稿／审核／修订工件，含来源和父 hash。
- `drafts_frozen`：全部初稿及正文、claimBindings、hash、同语透传状态、双计数。
- `drafts_reused`：已核对的原冻结初稿、frozenHash、`reused: true`；不得据此改写 tmp。
- `review`：该稿唯一有效审核，兼容 summary/findings/unresolved，含精确位置和编辑判断。
- `revision`：正文、原始审核、发现处置、未解决项、计数、配图 brief、开始／结束时间。
- `blocked`：needs_evidence 或 needs_resolution；保留请求稿件清单，审核次数 0，无伪造正文。

`artifactHash` 为工件去掉该字段后的 `JSON.stringify(envelope)` UTF-8 字节 SHA-256，
不是含 hash 字段的整份包装文件校验值。`parentArtifactHashes` 关联先前工件；规则
hash 和 source/input hash 独立保存。真实产物、完整规则和账本都只在 tmp。

## 确定性核验与限制

来源引用必须对应实际来源和真实引文。所有非空标题、段落必须有主张对齐；本地化
必须保留平台稿的主张 ID 集合。该检查可发现丢失引用，不能证明语义完全等价。

审核使用 `{documentId,blockId,field,quote,occurrence}` 定位真实引文，服务计算 UTF-16
`[start,end)` 并拒绝拆开的代理对。标题使用 `field=title` 和空 blockId。跨段问题可
包含多个位置；审核发现按语言加 ID 前缀。修订只能处置已有且影响本稿的发现，不能
将未改正文的问题宣称已改。无可执行发现时允许保持原文。

字符计数与发布拼接一致：非空 title 和 blocks 以双换行连接，postingNote 不参与。
报告 Unicode 代码点和 UTF-16 长度；本地保守上限 3000 UTF-16，超限保留正文和问题，
不截断、不宣称平台接受。模型只产出配图 brief，实际文件、视觉核验和平台上传各自
记录证据。修订完成状态为 awaiting_confirmation，不自动确认保存或发布。

## 本次自动验证

`node --test tests/text-*.test.mjs tests/mvp-generation.test.mjs` 使用明确合成 runner，
覆盖固定映射、顺序和屏障、同语逐字透传、单次审核、引用／计数、缺资料／冲突、
失败取消、版本冲突、重启和 tmp 边界，以及图片替身绑定失败保留文本。替身不代表
真实模型、图像生成、OAuth、LinkedIn 上传或发帖验收。
