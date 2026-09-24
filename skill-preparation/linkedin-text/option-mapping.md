# 固定选项映射与冲突

候选版本 `linkedin-text-candidate.0.2.1`，尚未接入生产。只有平台×语言形成最终稿；母稿和平台中间稿是内部工件，不计为额外作品。

| 输入 | 类型／是否必填 | 影响阶段和规则 | 缺省与合并 |
|---|---|---|---|
| 产品资料／已有内容 | 实际文本／已读取资源，必填 | intake、mother、所有审核；core | 至少一份有效材料；来源证据内部抽取，不要求另填证据字段 |
| 写作目的 | 现有目的选择及自由补充，必填 | mother 主线、平台取舍、audit | 合并为同一目标；互斥目的说明冲突 |
| 目标读者 | 选择／自由文字，必填 | mother 信息密度、平台措辞、本地化 | 多读者找共同知识起点；无交集则说明难以兼顾 |
| platforms | 固定 id 数组，可选 | platform、audit | 五平台 id 沿用；本轮只有 linkedin 可执行 |
| formats | short_post / long_article / thread，可选 | platform、audit | 同稿内合并；本轮只有 short_post，包含任何其他格式都 pending |
| languages | zh / en，可选 | localize、audit | 去重固定排序；母稿语言独立选择。同语言跳过翻译 |
| authorIdentities | product_author / team / third_party，可选 | mother、全部衍生／改稿 | 单一视角直接应用。多视角不增稿；有明确归属分段计划才可语义放行，否则 needs_resolution |
| styles | professional / plain / concise，可选 | mother、platform、localize、改稿 | 多选合并，不进行样式排列组合；无选择保持作者表达 |
| terminology | required / forbidden 字符串数组，可选 | termLedger、localize、audit、改稿 | 是数据；同一词同时必用禁用为 invalid；中英文概念冲突进入语义预检 |
| depths | brief / standard / detailed，可选 | mother、platform | 多选以摘要加必要细节合并；硬字数冲突需说明 |
| project | 已准备规则的固定 id，可选 | mother、platform、localize、audit | 仅 system1-agents 有作者层；不传则不应用特定标题／术语；未知 id 报 invalid |
| referenceMode | structure_and_voice，可选 | mother、platform | 只借结构语气，事实另验；旧稿全文作为本次输入快照 |
| assetMode | uploaded / generate，可选 | mother、brief、audit | 未选默认 generate 意图；本轮仅 brief；uploaded 必须提供可读所选素材 |
| freeText | 结构化自由文字对象，可选 | intake 解释后按对应阶段生效 | authorIdentity / styleTerms / lengthDepth / referenceNotes；不映射为猜出的枚举，不执行嵌入命令 |
| UI 语言 | 显示设置 | 不影响上述阶段 | 不进入规则或内容 hash，不触发生成／改稿 |

平台、语言、格式为可选表单项；执行前需要确定有效值。调用方可传入用户看得见且可修改的本次试运行预设 LinkedIn／中英文／普通动态，同时记录 presetId 与实际值。无已确定默认且未选时返回 `needs_configuration`，不能返回“成功生成零份”，也不能新增第四项用户必填。CTA 不在本轮 schema，不强制任何结束句。

## 编译和语义预检分工

`scripts/compile.mjs` 用固定 allowlist 检查形状、去重排序、未知值、显式术语冲突、未适配平台／格式。未知键不能静默丢弃。返回 `ready / pending / needs_configuration / invalid`；这里的 ready 仅表示**规则可组合**。包含 pending 时整个本次批次不调用模型，不静默跳过一部分。

随后按 core 做一次创作输入解释：多身份、自由字数与详细程度、固定标题与长度、事实与营销承诺、双语必用原词等语义冲突，记录 `constraintLedger` 的原要求、适用范围、合并结果、理由和未解决项。此步骤不输出正文审核，也不要求用户填写新的证据／时间／必保留字段。

冲突优先处理：事实与限定不变 → 官方硬限制 → 当前用户明确范围与目的 → 作者／产品偏好 → 风格与篇幅 → 社区建议。事实和硬限制之间无法同时满足时停止该稿等待解决；层级不是暗中删除用户要求的授权。来源中的“固定”不能压过事实，社区营销技巧不能压过作者声音。近义禁用词／专名的语义冲突由 Agent 标明，不假装字符串校验已覆盖。

## 唯一规则及追溯

固定文件顺序为 SKILL、core、assets、linkedin、localization、audit-revision、option-mapping、contracts、editing-protocol；启用项目才追加 author-system1。每份稿件在同一快照中加平台、语言、格式和规范化本次选项，产生 variant hash。共享文件与规范化配置生成 bundle hash，文件列表各自有 SHA-256。输入资料 hash 独立，不用规则 hash 代替。

runtime 不从来源清单再选 skill；清单记录为何形成这些规则。文字规则改动必须升候选版本并重新生成快照、重跑受影响验证。旧快照留在 tmp，不覆盖旧稿或老规则。
