# launch-kit 与 launch-copy 参考审阅

核验日期：2026-09-23。读取两份用户提供的 DOCX 全文及 OOXML 结构；没有修改原件，也没有执行文中发布、发邮件、私信、改仓库等操作。

## 结论

用户的目标应理解为：Agent 从项目事实生成一个可浏览、可修改、可反复审阅的中英文内容包，最终形成按渠道可发布的版本，再执行发布并将数据与评论回收到同一内容记录。当前参考不是单篇文章，也不是一个任务清单；它是一次 launch 的多渠道编辑交付物。

`launch-kit.docx` 是准备充分的渠道内容包，`launch-copy.docx` 是经用户 skill/Claude 提炼后的文案包。第二份有明确的品牌表达和素材，但不能单凭文件名将其全部视为已审核、已批准发布的版本。

## 实际结构

| 观察 | launch-kit | launch-copy |
|---|---|---|
| 文档顶层段落 | 187 | 116 |
| whitespace 切分词数，仅供体量比较 | 5132 | 2992 |
| 表格 | 0 | 0 |
| 内嵌图片 | 0 | 1 张 launch 封面 |
| 顶层渠道/部分 | 11 | 9 |
| 中文程度 | 一份中文媒体投稿短文，其他主体英文 | 一份中文媒体投稿短文，其他主体英文 |
| Word 批注、修订记录 | 未发现 | 未发现 |

两份文档都不是完整的“中文稿＋英文稿”。用户现在增加的双语要求，应单独成为交付与验收项，不能把现有中文媒体短稿当作整包双语完成。

### launch-kit 的 11 部分

1. LinkedIn article：标题、封面建议、完整正文、问题/机制/两项 skills 的分节与行动号召。
2. LinkedIn feed post：引流短帖、文章链接占位、媒体和链接放置说明。
3. X：7 条 thread、单独用于转引的帖子、媒体位置提示。
4. Show HN：两个标题方案、URL、作者首评、详细实验条件/局限、CLI 命令及 JSON 示例。
5. Product Hunt：名称、tagline、description、topics、gallery、maker comment。
6. Reddit：为 r/ClaudeCode、r/AI_Agents、r/mcp、r/MachineLearning 分别写标题和独立正文，按受众调整技术深度。
7. Newsletters：目标清单、可直接摘录的 blurb、pitch email、ThursdAI DM。
8. Press and media：媒体清单、pitch email、backgrounder、中文媒体投稿。
9. Comments：HN/X/LinkedIn/Discord/awesome list/LangChain 各语境短文案。
10. dev.to opener：tutorial 开头与可复制命令。
11. Schedule：发布前准备、首日、次日、次周和后续节点；包含外部服务操作提示。

开头还包含来源版本、事实文件、占位符和各渠道写作语气。这些是可复用的“生成上下文”，不应混入要复制发布的正文。

### launch-copy 的 9 部分

1. LinkedIn article：标题、正文、新增“Jev-like System 1 decision models”段落、发布说明。
2. LinkedIn feed post：更短的一致化主张、文章链接、hashtags、tag 与配图说明。
3. X：6 条 thread、配图/GIF/标签/置顶说明。
4. Show HN：单一标题、URL、较短首评，保留单轮结果和基准资料的部分限定。
5. Product Hunt：name/tagline/description/maker comment 和发布说明。
6. Reddit：3 个 subreddit 标题＋一份共用正文，区别于 kit 的多份完整定制正文。
7. Newsletters：blurb、pitch email、ThursdAI DM、发送/转载说明。
8. Press and media：pitch email、backgrounder、中文媒体投稿。
9. Comments：HN、X、LinkedIn、Discord、awesome-list、LangChain 版本和投放说明。

## kit 到 copy 的实际变化

- 体量减少约 42%，更强调一句统一定位和重复可辨认的品牌措辞。
- 新增一张完整宣传封面；各渠道的素材指令由零散 replay 建议转向同一 launch image。
- “Jev-like”成为标题和正文里的统一措辞，增加发布背景叙述。
- 保留多渠道交付形态，但缩减数据、CLI/JSON 示例、限定条件和读者细分；Reddit 独立正文合并为共用正文。
- 删除独立 dev.to 教程开头与完整 schedule，留下分散 Posting 说明。
- 仍存在 `[ARTICLE URL]`、`[NAME]`、`[EMAIL]` 等占位符。最终稿也应经结构化发布前检查。
- 没有批注或修订历史。因此不能从 Word 修订推断具体是谁修改、何时批准、哪一条是用户已接受的事实。

## 视觉与可用性证据

已读取的文档结构：两者为 US Letter，页宽 8.5 英寸、高 11 英寸，上下各 1 英寸、左右各 1.25 英寸；正文 Calibri 11pt，Heading 1/2/3 提供层级；kit 有 Consolas 9pt 代码样式。文档标题使用 Heading1，没有专门 Title 样式。现存 Heading 样式为 Word 蓝色主题。

已经直接查看 launch-copy 中唯一内嵌 PNG：浅色底、蓝色主模块与连线，左侧列 agent 环境，中间 system1-agents，右侧 browser use/computer use/build your own；顶部大字标题与 6×/25× 数字。图片可作为现有素材引用，不需要重绘来“分析”；数值和兼容性仍须和事实来源关联。

渲染限制：尝试技能包 `render_docx.py --verbose`，仅为该进程把 PATH 限定到 runtime override 以保证不调用用户桌面 LibreOffice。得到 `FileNotFoundError: LibreOffice soffice.exe was not found on PATH`，运行时依赖清单也未提供 Windows bundled LibreOffice。日志保存在 `render-kit.log`。因此没有 DOCX 页面 PNG，不能断言分页、裁切、字体替换或整页排版已通过视觉检查。文档 app.xml 中 Pages=1、Words=0 明显是未更新缓存，不当作真实页数。

用户所需“良好 UI 呈现”可落实为以下内容编辑界面：

- 内容包概览：主题、产品/commit、受众、核心主张、状态、语言覆盖、发布渠道。
- 左侧内容目录：文章、短帖、thread、投稿、评论逐项打开，不把数千词塞在任务备注里。
- 主区域：清晰标题层级、长文编辑＋阅读预览、封面预览、代码块、thread 分段、渠道特有字段。
- 中英切换/并排比较：同一内容项共享来源与主张，但独立编辑、独立审稿；任一语言改动提示另一语言待同步。
- 正文、素材、Posting 操作说明、证据分区；“复制正文”不会顺带复制内部操作提示。
- 审阅：查看 kit 草稿与 refined 版本差异；批注可定位到具体段落；明确哪些修改已接受。
- 发布前检查：链接/占位符、数值限定、批准版本、账号/渠道、素材存在性；每渠道独立就绪状态。
- 结果：发布记录绑定精确版本、URL、平台内容 ID，反馈按内容项而非整个 campaign 混算。
- 导出：用于编辑交接的 DOCX，以及用于发布的正文/素材包；首次做 DOCX 导出需先打通可验证的页面渲染能力。

## 可复用的数据结构

最小 ContentPackage：

```text
id, projectId, campaignTitle, sourceSnapshot(commit/date/URLs), audience,
positioning, terminology[], claims[], assets[], items[], reviewHistory[]

claim: id, statement, sourceURL/file, evidenceExcerpt, conditions,
       checkedAt, verificationStatus

contentItem: id, channel, format, audience, language, pairedItemId,
             title, summary, bodyBlocks[], cta, hashtags[], assets[],
             internalPublishingNotes, unresolvedPlaceholders[],
             claimIds[], draftVersion, revisionHistory[], reviewStatus,
             approvedVersion, publishingStatus, publications[]

publication: id, contentItemId, contentVersion, account, platformPostId,
             url, publishedAt, status, metricSnapshots[], feedback[]

metricSnapshot: observedAt, source(api/manual/import), definition,
                impressions?, views?, reactions?, comments?, shares?,
                clicks?, downloads?, referrals?

feedback: sourceURL, observedAt, originalText, language, category,
          summary, suggestedResponse, productAction, owner, status
```

正文块支持 paragraph、heading、list、code、image、quote；thread 可以是多个子内容项/段落，不作为一个不可拆长字符串。事实检查值不能只存“通过/未通过”，应保留具体主张与证据和适用范围。未知的指标保留 null/未获取，不能当成 0。

## 内容审查应捕获的具体问题

这里仅记录需要重新核验的表达，未在本任务验证它们的真假：

- “up to 6× faster / 25× cheaper / at the same score”从受限制基准摘要变成多处总括式文案，应该挂同一事实记录并保留适用场景。不得因为出现在用户旧稿里就自动视为当前所有模型和任务的保证。
- copy 使用“每一步都经过 System 2 LLM”等绝对表述；应确认是在描述目标架构还是对所有 agents 的判断。
- “引爆 AI 社区 / took ... by storm”是写作风格而非已经证明的指标，品牌语气审查可以标记，但不要擅自把用户偏好重写掉。
- kit 中关于外链降权、固定最佳发布时间、社区 flair、目录门槛等属于需实时核验的平台规则/经验，不能作为自动执行的永久硬编码规则。
- 文案中的 launch day、this week、“two weeks after”等随日期变化，生成时应检查相对日期与实际发布时间。
- 新增供应商/作者 tag、兼容性图标和同类模型历史，须有出处。特别是文内已经注明某 X 账号 unverified，发布前不能直接当成已确认身份。

## 可复用与无需重做

| 复用对象 | 如何复用 | 值得复用的原因 |
|---|---|---|
| kit 的渠道与字段结构 | 成为内容包模板与渠道 adapter 输入 | 用户已有真实 launch 编辑流程，不必重新发明内容分类 |
| copy 的组织与一致性 | 成为最终文案风格样例，保留标题/正文/Posting 的结构 | 已体现用户认可的表达方向和具体输出粒度 |
| user 提供的 launch skill | 作为受版本管理的生成/改稿 recipe；调用前输入项目事实，输出后再独立审稿 | 将隐含偏好变成可重复执行的规则，避免一次次从零提示 |
| 两份文档现有素材与文本 | 导入为参考与初始版本，明确来源；不标为本轮新生成 | 可以立即演示编辑与对比，不需要先生产虚构内容 |
| 仓库事实与 benchmarks | 建一份共享 claims/sourceSnapshot，被中英各渠道文案引用 | 一次纠正数值/条件可定位所有受影响内容，避免翻译漂移 |
| 原本本地工作台 | 保留任务、模块、资料库与备份，新增实际内容实体和编辑预览 | 不推翻已有整理成果，但使工作台最终围绕产出物运转 |

## 本次范围与交接

完成：两份 DOCX 全文与结构提取、内容对比、内嵌图片查看、渲染失败诊断、目标 UI/数据契约建议。

没有完成也没有宣称完成：新稿生成、中英全文生成、调用 Claude、对第三方公开发布、邮箱/私信发送、社媒统计接口连接、任何投放效果结果。

提取文件：`launch-kit.json`、`launch-copy.json` 包含顺序块、样式、段落/run 属性、关系、媒体列表、页设置及元数据；`.txt` 是全文便于检索。以上是工作中间资料，不建议直接作为面向用户的最终交付。
