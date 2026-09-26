# X 授权、媒体与发布适配

核查日期：2026-09-24。开发基线 `5942773`，本分支 `codex/x-content-publishing`。本文件区分官方接口、本项目实现及实际账号验收；没有进行真实 OAuth、图片上传或发帖，没有购买额度或读取既有凭据。

2026-09-26 复核同一批官方 PKCE、Create Posts、媒体上传、状态和 metadata 文档：本轮依赖的端点、四项 scopes、逐帖回复及 `made_with_ai` 字段未见变化。以下价格与限流数字仍为 2026-09-24 的核查记录，不作为账户当前报价或剩余额度。

## 官方依据与实际能力

| 核查 | 官方能力与本次采用 | 证据 |
|---|---|---|
| 用户授权 | OAuth 2.0 Authorization Code + PKCE，采用 S256；授权地址为 `https://x.com/i/oauth2/authorize`，token 为 `https://api.x.com/2/oauth2/token`。公开客户端传 client_id，机密客户端用 Basic 认证。默认 token 约两小时；本版不请求 offline.access，不保留 refresh token | [OAuth PKCE](https://docs.x.com/fundamentals/authentication/oauth-2-0/authorization-code) |
| 账号与权限 | 用 `GET /2/users/me` 确认真实用户；请求且检查 token 实际返回的 tweet.read、tweet.write、users.read、media.write。只请求不代表获准，网页登录/Premium 也不代表 API 可用 | [用户上下文](https://docs.x.com/fundamentals/authentication/oauth-2-0/authorization-code) |
| 发帖与串帖 | `POST /2/tweets`，成功需要 201、真实 data.id、可核对的返回正文；串帖通过 reply.in_reply_to_tweet_id 指向本任务前一条。只支持标准加权 280 字，不包含 Articles、长帖、引用帖、私信或运营互动 | [Create Posts](https://docs.x.com/x-api/posts/create-post) |
| 图片上传 | 本项目仅 PNG/JPEG、4 MiB 以内、普通帖一图或串帖首帖一图；官方照片能力更广，不能据此扩大本版可用范围。JSON base64 上传 `POST /2/media/upload`，指定 tweet_image；保存返回媒体 ID 和有效期，处理失败或过期则停止 | [Upload Media](https://docs.x.com/x-api/media/upload-media) |
| 处理状态 | 有 processing_info 时按 check_after_secs 查询 `GET /2/media/upload?media_id=…&command=STATUS`。本版最多十次，等待字段异常、失败或未确定成功均停止发帖 | [Get upload status](https://docs.x.com/x-api/media/get-media-upload-status) |
| 替代文字与生成披露 | 用 `POST /2/media/metadata` 的 metadata.alt_text.text（最多 1000）写实际图片描述；若图像关联 generated=true，发帖携带 made_with_ai=true。字段支持不等于所有语境的平台审核结论 | [Media metadata](https://docs.x.com/x-api/media/create-media-metadata)、[Create Posts](https://docs.x.com/x-api/posts/create-post) |

媒体 metadata 和 processing 字段同时实读官方 `.md` 中的 OpenAPI `2.168` 展开定义，未仅凭页面折叠示例猜参数。没有复制、安装或执行外部发布脚本。

当前官方价格页采用预付 credits、按使用付费。核查时列出普通建帖 $0.015/请求、带 URL 建帖 $0.200/请求、媒体元数据 $0.005/请求、Post read $0.005/资源、User read $0.010/资源；具体归类、优惠及实际账户价格以 Developer Console 为准。串帖逐条计写请求，OAuth 账号读取及续发前核对也可能计费。工作台不购买额度、不启用充值、不声称账户余额可用。[官方价格](https://docs.x.com/x-api/getting-started/pricing)

核查时官方限流表：建帖每用户 100/15 分钟、每应用 10000/24 小时；简单媒体上传和媒体元数据各每用户 500/15 分钟、每应用 50000/24 小时；媒体状态每用户 1000/15 分钟；users/me 每用户 75/15 分钟。实际响应头和控制台才反映当前账户窗口；本版 429 明确停止，不自动重试。以上不是保证某个应用可调用的额度。[官方限流](https://docs.x.com/x-api/fundamentals/rate-limits)

## 操作者配置与授权

1. 在自己的 X Developer Console 核查应用有官方 API 使用资格、OAuth 2.0 设置、上述 scopes 的端点权限、可用 credits 和消费限制。不要在聊天、Git、备份或截图中提供 secret。开发实现没有替操作者创建或购买这些资源。
2. 注册精确 HTTPS 回调，路径必须是 `/api/x/callback`。只将该路径转到当前隔离工作台，不把整个本机服务公开；代理转发的 Host 必须保持本机实际 host/port。外部回调资源由操作者提供，本版不创建隧道。
3. 用启动进程的安全环境配置 `X_CLIENT_ID`、`X_REDIRECT_URI`；机密客户端另配 `X_CLIENT_SECRET`。公开客户端不设置 secret。仅有 Client ID 的机密应用可能显示配置项齐备，但 token 交换会被官方拒绝；应按控制台应用类型准确配置。
4. 打开发布页的 X 区域，点连接并在 X 授权。回调只使用启动时绑定的本机返回地址；不接受浏览器传入任意 return URL。成功后显示真实账号和实际 scopes，未连接、授权过期和权限不足分开显示。
5. token、PKCE verifier、OAuth state、预览 token 都仅在本次服务内存；重启需重新授权。应用凭据不随内容交接给下一位操作者。
6. 选择已确认保存的具体语言、版本和普通帖/串帖对象。带图需先在创作页确认图片实际内容、替代文字与 AI 来源。查看完整每条文字、字数、顺序、图片后，由操作者另行确认实际上传/发帖；本轮开发没有代替这一步。

实际账号权限、真实 OAuth、图片上传、帖子可见性目前均 **未验收**。这些是独立验收项；测试替身不改变其状态。

## 工作台接口

所有请求复用本机 Host/Origin 防护，除了 GET OAuth callback 可接收来自 X 的导航。改变状态的请求拒绝跨站来源。响应中的 id/hash 由页面管理，不要求非技术操作者手工填写。

| 路由 | 请求 / 响应 |
|---|---|
| `GET /api/x/connection` | `{connection}`：真实 account{id,name,username}、scopes、status、canPublish、缺失配置、计费未核实状态 |
| `POST /api/x/start`（兼容 `/connection/start`） | `{locale?:'zh'|'en'}` → `{authorizationUrl}` |
| `GET /api/x/callback` | 单次有效 state/code → 303 回 `/#publishing?x=connected`；错误页不反射原始错误、code或secret |
| `DELETE /api/x/connection` | `{}` → 断开；若有在途发帖，保留其可能到达的平台结果，停止后续步骤 |
| `POST /api/x/previews` | `{itemId,versionId,documentId,accountId,resumeRecordId?}` → `{preview}`；续发会先只读核对成功前缀 |
| `POST /api/x/execute` | `{previewId,confirmationToken,confirmed:true}` → 202 `{record}`；预览不会自动上传或发帖 |
| `GET /api/x/records` | `{items}`；记录不复制正文 |
| `GET /api/x/records/:id` | `{record}` 包含每步状态、真实平台 ID 与链接 |
| `POST /api/x/records/:id/cancel` | `{}` → 停止后续；不自动删除成功前缀，不隐瞒在途结果 |
| `POST /api/x/records/:id/reconcile` | `{}` → 只读核对已知未知结果；缺有效 ID/返回正文 hash 时拒绝自动处理 |

预览包含 `{id,itemId,versionId,documentId,accountId,account,accountName,kind,language,planHash,confirmationToken,expiresAt,resumeRecordId,warnings,steps}`。每步 `{blockId,index,text,weightedLength,assets,alreadyPublished,platformId}`；index 为 0 起，页面用自然顺序显示。资产 URL 从已确认版本读取；只在内存组织实际文本。十分钟后失效。

`planHash` 绑定正式版本、账号、document、语言、形式、逐帖 ID、实际原样正文、顺序、图片 ID/hash/格式/大小、图片关联及元数据。新账号、OAuth 会话、恢复 epoch、正式作品新 revision、文字或素材变化都会使旧预览失效。选择一个内容对象只发布该对象，另一种格式或另一语言不会顺带执行。

## 多步存储与恢复

新增 SQLite 表 `x_publishing_meta`（schema_version=1）、`x_publishing_records`，不改写 LinkedIn 的原表。完整 JSON 备份继续 `app=content-workbench-local,version=1`，只增加可选 `xPublishing:{schemaVersion:1,records}`；缺失扩展的旧备份保留现有 X 记录。旧程序不能导入带新扩展的备份。

记录仅保存版本/对象/逐帖指针、账号名和 ID、计划/正文/图片/metadata hash、状态、时间、确认 hash 与平台帖子/媒体 ID；不保存帖子正文、图片字节、brief、token或secret。正式素材仍在通用内容版本中，未确认内容仍在 tmp。每条记录提前固定预留 `8192 + 2048 × 帖数` 字节的 JSON 结果空间，防止网络成功后被其他正式保存挤掉可备份容量。

每步状态为 pending → uploading（如有图）→ submitting → published / failed / unknown；发布记录汇总 running / published / partial / failed / unknown / cancelled。失败即停止后续；只有全部步骤 published 才显示整条成功。未知结果无自动重发，5xx、超时、无有效 ID 等不会假装明确失败。每次帖子请求在网络前事务写 submitting，成功后写真实 ID；图片上传也先写状态并保留返回媒体 ID。

图片上传、处理查询和 metadata 写入之间也重新核对授权、预览有效期和正式作品 revision。上传等待期间预览过期或作品确认新版本，会保留已返回的媒体 ID 并停止后续请求，必须重新预览、确认后才能继续。

重启把中断的 submitting 转 unknown，图片准备中断标失败并要求新预览；已发布前缀保持不变。重复 execute 返回同一记录，即使重启或旧备份恢复后也不再次提交。跨计划以账号+每条正文 hash+图片 hash 防止通过改顺序、元数据或新的版本重复已发/未知/活跃步骤。该保护较保守，可能要求操作者采用原记录续发而非另起同文计划。

续发只允许原账号、原正式版本和原完整计划，先逐条 GET 核对已发前缀的 ID、作者、平台返回文字 hash、回复关系及媒体键，再生成新的确认 token；执行时再次比对记录 revision。unknown 必须先只读核实为成功；无可核对 ID 时保持阻塞，请在 X 人工核对。不会凭“没有查到”推定可重发。

恢复时事务合并最高可信度的逐帖事实，拒绝身份/hash/平台ID冲突，不删除已有成功或未知事实，活跃发布拒绝恢复，恢复不会联网发帖。不自动删除已发布部分来回滚。取消/断开仅阻止后续步骤；正在进行的请求仍可能成功，收到的结果会保留。

## 自动验收与边界

2026-09-26 运行 `node --test tests/x-publishing.test.mjs tests/x-oauth-http.test.mjs`，36 项通过，均注入明确的 X 替身、只用合成正文与隔离 SQLite。覆盖 PKCE/回调、正式版本选择、逐帖持久化与回复、重复确认、二条失败及新确认续发、超时/5xx/缺 ID、重启、取消/断开、旧备份合并、元数据/重排/并行上传绕过防重、容量保留、媒体处理/失效/AI标记、401/402/403/429、跨站拒绝及安全回跳。官方 GET 核对也是替身验证。未编写本模块的图片 Agent 只读复核发现了元数据变化绕过防重的问题；已修复并回归，其最终未解决问题为空。后续又加入活跃上传与前缀重排回归。

本次对照已提交 MVP `1e7cc37` 的相关安全修复，补齐 X 配置原始回调地址校验（拒绝首尾空白、反斜线和控制字符；公开客户端仍可不配置 secret），以及媒体多步请求间的预览校验。三项定向测试在修复前失败，修复后全部通过；其中两项为新增上传等待期间失效回归。

实现与替身测试通过不代表 X 外部接通。真实 OAuth、真实媒体上传、实际发帖、线上显示仍需操作者的资源和具体发布确认。本版不自动购买、订阅、充值，不处理反馈分析。
