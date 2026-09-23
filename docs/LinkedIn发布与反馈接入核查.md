# LinkedIn 文章发布与反馈：接入核验

核验日期：2026-09-23。依据官方帮助、开发文档和用户提供的公开文章；没有连接账号、申请权限、试发内容或调用有凭据的 API。

## 首先区分两种产出

用户的 [首篇文章](https://www.linkedin.com/pulse/give-your-agents-jev-like-system-1-decision-model-kai-yuan-phd-ymhgc) 是 LinkedIn 原生长文（Pulse URL），有封面、标题和带小标题的正文。它不是在 feed 中发一段文案并附上外部链接。工作台应保留 `linkedin_article` 与 `linkedin_post` 两种目标，不能互相冒充。

当前 [Posts API](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api?view=li-lms-2026-09) 的 `content.article` 示例要求 `source` URL，再配 `title`、`description`、`thumbnail`；没有提交原生长文正文的字段。[Share on LinkedIn](https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/share-on-linkedin) 也明确 ARTICLE 类分享的是 URL。结论：**本次未找到可依赖的公开原生 Pulse 长文创建 API，不能将 API 里的 Article 名称解释为支持原生长文。** 这是公开能力未证实，不是简单缺一个密钥。

## 可执行能力表

| 需求 | 已核验的能力 | 接入条件／边界 | 工作台最小实现 |
|---|---|---|---|
| 原生 LinkedIn 长文 | [LinkedIn 原生编辑器](https://www.linkedin.com/help/linkedin/answer/a521657) 支持封面、标题、正文、预览、分享草稿，以及定时发布 | 用户登录；平台原生操作。尚无本次可验证的公开自动写入正文接口 | 生成格式化发布包、复制富文本／导出 DOCX、打开编辑入口；原生粘贴与核验；记录文章 URL 和真实发布状态 |
| 个人账号普通动态 | [Posts API](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api?view=li-lms-2026-09) 支持文本及媒体、链接卡片 | 获得 `w_member_social` 及用户 OAuth 同意；不是任意抓取其他账号 | 优先复用发布服务；无授权显示“未连接”，不显示假成功 |
| Buffer 发动态 | [Buffer MCP](https://developers.buffer.com/guides/integrations/mcp.html) 已有列渠道、创建／编辑、草稿、排期、取发布状态 | Buffer 账号连接 LinkedIn；API key 或 OAuth。账号权限仍有效；未见原生 Pulse 正文能力 | 复用 MCP 或 GraphQL；保存 provider post ID、状态、URL、错误。默认先生成本地预览，再按已授权方式发送 |
| Typefully 发动态 | [LinkedIn 发布文档](https://support.typefully.com/en/articles/8718168-publish-cross-post-to-linkedin) 支持个人／企业动态、图片／视频、平台独立改写；[Zapier 文档](https://support.typefully.com/en/articles/8718280-automate-typefully-with-zapier) 说明可由 API key 创建草稿和排期 | 需要账号及连接；文档描述普通动态。其新 Articles 是 [X Articles](https://support.typefully.com/en/articles/15887300-x-articles-support-in-typefully)，不能当成 LinkedIn Articles | 适合多平台短文分发；不能解决本次原生长文自动发布缺口 |
| 个人动态指标 | [Member Post Statistics](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/members/post-statistics?view=li-lms-2026-09) 支持曝光、触达、反应、评论、转发等；按 post URN 查询 | `r_member_postAnalytics`，属于需获批的 Community Management API；取得 token 不等于自动获此权限。文档对象为 `share`／`ugcPost`，未验证能直接用 Pulse URL 查询长文阅读数 | 第一版导入原生导出或人工填数，保留采集时间和来源；API 作为独立可选适配器 |
| 评论原文 | [Comments API](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/comments-api?view=li-lms-2026-09) 支持评论与子评论 | 个人读取 `r_member_social_feed` 明确只授予选定开发者。普通发帖权限不代表评论读取权限 | 手动粘贴／导入真实评论，再让 agent 分类、提炼问题和草拟回复；批准的读取能力到位后替换采集层 |
| Buffer 指标 | [MCP 文档](https://developers.buffer.com/guides/integrations/mcp.html) 有 `includeMetrics`、聚合指标；更新可能落后一天 | [API 帮助](https://support.buffer.com/en-us/articles/what-is-buffers-api-GtIYIQilz5) 仍明确称指标为 experimental、个人 API key 使用，不能依赖为稳定生产报告 | 可试接但标“实验”；记录 `metricsUpdatedAt`；保留 CSV／手工导入后备，不承诺全自动可靠同步 |
| Buffer 评论收集 | [Buffer LinkedIn UI](https://support.buffer.com/en-us/articles/using-linkedin-with-buffer-K7tRkGD3mH) 的 Community 支持 Pages 与 profiles 评论管理 | [API 帮助](https://support.buffer.com/en-us/articles/what-is-buffers-api-GtIYIQilz5) 明确公共 API 尚不读／回复评论。UI 有功能不等于 API 有功能 | 用 Buffer UI 处理评论，人工导入待分析评论；不要开发不存在的 comments endpoint |
| Typefully LinkedIn 分析 | [Analytics 官方说明](https://support.typefully.com/en/articles/8718148-analytics-page-metrics) 截至核验仍仅支持 X，LinkedIn 开发中 | 能发 LinkedIn 不等于能分析 LinkedIn | 不把它设为本次反馈数据源 |

LinkedIn [Increasing Access](https://learn.microsoft.com/en-us/linkedin/marketing/increasing-access?view=li-lms-2026-09) 说明 Community Management 需申请、开发档有调用限制、标准档另行申请。因此可以把“申请/API获批”列为将来接入任务，但不应让第一版核心写作和审查等待它。

## 不要混淆的状态

- `not_connected`：平台确有公开能力，只缺账号授权／凭据，如 Buffer 发普通动态。
- `permission_required`：平台接口存在，但应用尚未获批准权限，如 LinkedIn 个人 analytics。
- `unsupported_or_unverified`：本次公开接口不能证实可做，如原生 Pulse 正文发布；增加密钥并不能解决。
- `experimental`：已公布接口但承诺仍不稳定，如当前 Buffer metrics。
- `manual_ready`：产出物完整，可以在原生平台人工发布，并可回填结果。

## 最小接入架构建议

1. **内容包是一份真实作品**：`article.zh`、`article.en`、渠道摘要、标题备选、封面、引用证据、审查意见、定稿版本。两种语言共享事实来源，但允许单独编辑。
2. **生成适配器**：传入产品事实、受众、选题、语言及选定 skill，输出结构化稿件；模型提供商与页面编辑器解耦。用户已有 Claude 工作流可先继续复用；执行后必须拿到实际输出，不能把一份 prompt 当“已生成”。
3. **文章编辑器**：章节导航、语言切换／并排、修订前后对照、可编辑正文、保存版本、导出 DOCX。研究与任务库仍存在，但主页围绕文章作品组织。
4. **发布适配器**：统一 `capabilities / prepare / publish / status`；长文走原生交接包，feed post 可走 Buffer。作品版本与发布记录分开，不把 local 保存当线上发布。
5. **反馈适配器**：输入规范统一为发布时间、采集时间、来源、作品 ID、平台 URL、可为空的指标、真实评论文本；先支持表格／手动导入，再接获批 API。未知值为 null，不用 0 伪装。
6. **分析结果**：分别呈现数字表现、读者具体问题、证据链接、建议修改、下一篇主题。回复只是草稿；本次不发送。

后台无人值守网页操作不宜作为默认接入：LinkedIn [自动化说明](https://www.linkedin.com/help/linkedin/answer/a1340567/automated-activity-on-linkedin?lang=en) 明确限制第三方网站自动化。这里建议的是提供格式化稿件与原生操作步骤，不是自建模拟点击发布机器人。可以继续调查官方合作能力，但不要为了许诺“全自动”隐藏这条实际限制。

## 首篇文章已有的真实反馈线索

核验时公开文章页已显示一条读者评论：关注低置信度交回 System 2、将疑难决策用于后续改进，并询问 builder 对适用边界的判断仅靠初始手写样例，还是运行中会调整。这可成为真实的“问题／需求／下一篇解释主题”样例。不要据此推断所有读者态度，也不要虚构曝光或完整评论数量。来源：[用户文章及可见评论](https://www.linkedin.com/pulse/give-your-agents-jev-like-system-1-decision-model-kai-yuan-phd-ymhgc)。

本次没有对 system1-agents 性能主张做重新实验核验。文章内具体速度与成本数字用于后续写作时仍需关联基准条件和当前仓库证据。
