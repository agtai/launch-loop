# LinkedIn MVP 执行与素材接口

2026-09-24。本说明更新[第二阶段接口](第二阶段执行与发布接口.md)中的文本和配图部分；原版本、revision、恢复 epoch、事务及发布防重语义继续有效。实际外部验收看[本轮报告](MVP验收报告.md)，接口存在不代表真实平台已通过。

## 文本与来源

新建任务使用 `text-v2.0.0`，规则源为 `rules/text/v2/`，派生自未经修改的 `linkedin-text-candidate.0.2.1`。`rules/text/v1/`和旧稿保存的规则保持原样。固定选项映射产生唯一完整规则；其他平台与非普通动态拒绝执行。仅测试可显式使用旧规则回归，不提供用户选择 skill 的表单。

`POST /api/generation/jobs`沿用 requestId、name、brief、uploads、options。执行一份共同母稿、一个源语言 LinkedIn 平台稿；源语言逐字透传，另一语言本地化；冻结本批全部初稿，每稿审核恰好一次；收齐审核再分别修订。无可执行发现允许无改动修订，不伪造提升。核心证据不足或要求冲突返回 `needs_evidence` / `needs_resolution`，具体缺口列在 variant.unresolved，不执行下游模型。

内部保存来源完整快照、来源 hash/读取范围、事实与术语账本、编辑计划、规则文件 hash、父工件 hash、正文 document/block 与 claim 绑定、可定位审核发现和修订处置。全部位于 `dataDir/tmp/generation/<jobId>/`，正文和素材位于 `dataDir/tmp/content/`。正式数据库及备份不额外复制未确认正文或内部账本。URL/PDF/DOCX不自动抓取。

阶段上限：母稿300秒、平台240秒、本地化180秒、每稿审核300秒、每稿修订240秒；进度含实际开始时间与预算。模型调用无自动重试。修改任何受影响 tmp revision 会阻止后续阶段或迟到结果。重启标为 interrupted，不自动续跑。

`POST /api/generation/jobs/:id/resume-mother`允许操作者在平台改写失败后，复用已完成母稿继续一次。要求v2、仅platform阶段失败、尚未冻结或恢复过、所有来源revision不变；严格核对intake/mother工件hash、父链、runId、inputHash、原brief、来源与规则快照。原工件逐字保留，原失败归档到`before-mother-resume.json`，新调用使用`-resume-1`目录；queued/running重复点击返回同一任务。母稿、本地化、审核等其他失败不适用；第二次平台失败不再提供恢复入口，重启也不会解除限制或自动调用模型。

`POST /api/generation/jobs/:id/resume-review`独立允许冻结初稿后的审核失败继续一次，不能恢复已进入修订的任务。当前正文必须逐字等于原冻结稿，revision不变；核对intake、mother、platform、每份draft及已有review的hash、父链、规则与来源。保留原工件和已成功审核，不覆盖tmp、不增加重复审核记录，仅调用缺失的审核，收齐后修订。原失败归档到`before-review-resume.json`，新调用使用`-review-resume-1`目录；重复点击只返回同一任务，重启不解除一次限制。两个明确入口不是自动重试循环。

## 局部修改

`POST /api/generation/modifications`继续接收requestId、tmpId、revision、selection、instruction。完整原规则和账本按原生成job的执行血缘查找，不能只按相同规则hash跨批取用。候选只替换UTF-16选区，保留选区外字节和其他段落。结果包含 changesSharedFacts、impactReason、changedClaimIds；模型判断是提示，不代表人工认可。

| 接口 | 语义 |
|---|---|
| `POST /api/generation/jobs/:id/accept`，`{sourceRevision}` | 二次检查源revision，派生新的tmp；同任务重复接受返回同一派生tmp |
| `POST /api/generation/jobs/:id/reject`，`{}` | 持久拒绝，不覆盖源稿；运行中先取消 |
| `POST /api/generation/jobs/:id/undo`，`{requestId,tmpId,revision}` | 生成独立反向候选；要求原位置、替换文本与邻接锚点仍匹配，保留后来其他位置的修改；还须明确接受 |
| `POST /api/generation/synchronizations`，`{requestId,tmpId,revision,selection,modificationId}` | 只有已接受且影响共同事实的修改可请求；目标必须是同批另一语言或其派生稿；只生成所选范围候选 |

跨语言影响提示保留兄弟稿原文，不能自动接受或静默覆盖。接受提案仍未正式保存；正式保存仍走内容confirm接口并保留旧版。恢复后旧tmp过期，只读或显式派生；没有原执行tmp不能凭hash重建账本。

## 后台图片

用户已选择已登录Codex并批准官方图片缓存例外。操作者使用 `Start-Workbench.ps1 -EnableCodexImages`明确启用；需要既有系统代理时加 `-UseSystemProxy`。设置仅作用于本次服务进程；已运行服务需先使用同目录停止脚本。下一位操作者使用自己的正式登录，凭据不交接。

图片适配独立使用公开Codex app-server stdio协议。先检查登录、imageGeneration能力及有效工具隔离；禁用shell、网络/浏览器、其他插件与MCP工具，只允许内置imageGeneration一次。文本执行器权限不扩大。图片先由正式工具写官方缓存，只收取本次完成事件指定的新增文件，检查真实路径、字节hash、PNG/JPEG结构、尺寸、4MiB上限，再复制进项目tmp。不读取认证token或使用未公开模型端点。

没有用户图时，最终两语言正文共用一张无文字图片；根据具体正文、目的和读者生成。已有图时传实际字节参与文本创作，再检查其与最终正文是否匹配。图片生成420秒以内，实际看图检查180秒以内，总计600秒以内；失败保留文本、图片及诊断，不自动重试。每次用户重试是独立图片任务。

`POST /api/generation/images`接收 `{requestId,tmpId,revision,mode?}`，mode为generate（默认）或check。check要求恰好一张已选图，不得回退到生成。图片任务仍通过jobs读取与cancel取消。生成和检查期间正文变化、取消、关闭服务、恢复数据都拒绝迟到附图。后台状态独立于文本任务：pending/generating/checking/ready/failed/cancelled/interrupted；现有素材可能为uploaded/none/outdated。

素材增加可选 `imageBinding:{documentsHash,width,height,checkedAt}`。documentsHash是当前完整documents的SHA256。自动生成图和已检查用户图绑定正文版本；改稿后不匹配则阻止确认，可重新生成、重新选择、或不选用该图。失败不将提示词、占位图或替身标为真实图。

该扩展不改SQLite表或API备份协议版本（仍app=`content-workbench-local`、version=1），不重建数据库。旧素材无binding继续可读；新备份保留binding，恢复时核对对应版本正文hash，拒绝篡改或错配。已确认版本同时保存正文与选中素材，旧版不可变。旧程序不认识新增字段时应升级程序，不能删除binding绕过校验。

## LinkedIn

公开接口范围仍为个人账号PUBLIC普通动态、纯文字或一张PNG/JPEG。预览包含实际授权账号、versionNumber、完整正文与素材，持有短期确认令牌。交换账号、授权失效、版本变化或恢复后旧令牌失效。上传初始化后再次检查账号会话，断开后不继续PUT图片。帖子正文按LinkedIn little-text规则转义，保留用户可见原文。

`node server/linkedin-preflight.mjs`只报告配置存在性和格式，不输出密钥；加`--check-callback`仅检查HTTPS回调的无state失败响应与其他路径拒绝，不执行OAuth或发布。应用尚未准备时退出1并标缺依赖。最小操作步骤见[LinkedIn最小配置](LinkedIn最小配置.md)。平台未知结果不会自动重发，保存平台ID后还需操作者在线核对。
## 配图入口重新检查补充（2026-09-24）

`GET /api/generation/capabilities`返回图片能力的`checking`与`canRefresh`，只读且不触发探测。明确启用`codex-cache`时可`POST /api/generation/capabilities/image/refresh`，请求体为`{}`，立即202返回检查中状态。界面每2秒读取结果；并发请求复用同一次检查。未启用provider返回409，关闭中返回503。一次30秒，无自动重试；只验证登录、能力与隔离，不启动模型turn、不生成图片或写作任务。

超时只显示可重查的受控提示，详细阶段耗时保留在运行dataDir的`tmp/generation/image-capability/`。关闭服务会取消检查，迟到结果不可使已关闭服务重新可用。此状态不等同实际出图或图像质量验收通过。
