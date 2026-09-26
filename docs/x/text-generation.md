# X 文本规则与生成接入

日期：2026-09-26；基线 `5942773`，本分支 `codex/x-content-publishing`。规则版本 `x-text-v1.0.0`；所有本轮文件在独立工作区完成。没有复制另一条开发线的未提交修改。

## 范围与规则

X 普通帖子与串帖、中英文。三个创作必填和已有可选项保持不变。固定选项经 `server/rule-resolver.mjs` 组合基础事实、作者、风格、语言、X 格式、本地化和说人话规则；用户不选择 skill。LinkedIn 继续使用 `text-v1.0.0`，其他平台与长文仍 pending。

官方硬限制、官方实现建议、社区经验与项目偏好分列在 [来源与取舍](../../rules/x/sources.json)。已浏览 [X 计数文档](https://docs.x.com/fundamentals/counting-characters)、[创建接口](https://docs.x.com/x-api/posts/create-post) 及官方 twitter-text；重新阅读 Corey 固定提交的 social skill 与 X 段落/示例，实读本机 shuorenhua 和仓库候选中必要通用规则。没有安装外部 skill 或执行来源中的运营、发布、检测脚本。

普通帖子保留一个清楚重点；串帖按论述关系组织每条的用途，开头、展开和收束相连。事实、重要条件、归属、情态、数字及完成状态保留。标签、emoji、编号和 CTA 均不强制，不以算法猜测或检测分数验收。25 条是工作台首版上限，不宣称为平台上限。

## 数据与计数

每个 `platform × language` 仅有一个 tmp 内容包。同时选择两种格式时，其 `documents` 为 `kind=post` 和 `kind=thread` 两个明确对象。普通帖恰一个 `type=x_post` block，串帖 2–25 个；稳定 `id` 关联该条正文和素材，数组顺序即发布顺序。X 的 `title` 为空，名称使用内容包 `name` 或格式标签；`postingNote` 不发布。每个 `block.text` 是实际提交文本，编号、标签、空白和链接都在其中，不在发布时拼接、trim、截断或拆帖。

`server/x-text.mjs` 为浏览器与后端共同实现：

- `countXText(text)` 返回 `weightedLength / valid / maxLength / remaining / version` 等。
- `validateXDocument(document, {allowEmpty, checkLength})` 返回明确的结构/逐帖问题。
- `xTextChecks(documents)` 返回按帖子 ID 和顺序定位的计数证据。

计数固定官方 `twitter-text@3.1.0` 默认 configuration v3。NFC 仅在官方计数内部使用，保存与提交字符串不改写。识别到的 URL 权重 23；组合字符、CJK、已识别 emoji 序列按官方库处理。测试使用上游固定版本的完整 discounted-emoji 与 directional 两组用例及本项目临界样例；这不是线上接受验证，也不宣称已核对未来 Unicode 版本。旧版本升级须显式更新依赖、重新打包并跑用例。

为保留无 `node_modules` 的便携启动，官方 parser 与依赖打包为 `server/x-text-vendor.mjs`，运行时不依赖 npm 安装。重建命令 `node rules/x/build-counter.mjs` 使用仓库已锁定的 Rolldown 1.0.3；算法代码未修改，仅生成 ESM 分发文件。完整 Apache-2.0 / MIT 通知在 [COUNTER-LICENSES](../../rules/x/COUNTER-LICENSES.txt)，分发应同时保留该文件。

## 编排与状态

X 请求读取一次共同资料，实际运行：`mother → adaptation → localization → review → revision`。默认模型仍是已登录 Codex CLI 的 `gpt-6-astra`，现有运行器 `xhigh`，沿用 Windows 受控进程、超时、取消、迟到输出与 tmp 防护。

1. 母稿依据实际来源决定原文语言，生成主线、编辑计划、正文、事实账本与术语表；来源引用必须存在于本次已读材料。母稿收到单独的 `motherRules`，不含目标语言、平台字数、格式或图片执行片段；目的、读者说明与表单的填写语言不决定母稿语言。`requestedTargetLanguages` 仅表示之后的交付语言。英文来源配中文目的说明仍保留英文母稿，除非作者明确指定母稿本身使用另一语言。
2. 母稿语言生成同一份 X 格式稿。每种已选格式一个 document，编号如使用必须写入实际正文。
3. 同语言原样透传；另一语言从相同平台稿本地化。两语允许不同串帖条数。全部语言初稿及 hash 冻结后才进入审核。
4. 每个平台/语言内容包恰一次审核，同时检查普通帖与完整串帖。另提供确定性逐帖计数；没有逐条新增审稿。全部审核结束后，各语言修订可参照共用事实及所有审核记录。
5. 修订保留该语言的 document ID、全部既有帖子 ID、顺序与条数。超限结果保留并明确提示，不假造通过或自动截断。最终只在 tmp 待用户查看，图片由共享 X 适配器准备 brief/输入图绑定，再由独立后台任务执行生成或目检。

UI 阶段增加 `mother / adapting / localizing`，原有 reviewing/revising 等沿用。正式执行元数据仍用 generation/review/revision，详细阶段和来源关联在 tmp 的 `runId` 与工件中。输入、母稿、平台稿、初稿、规则及最终稿各有独立 SHA-256；完整来源、提示、审核与正文均不进入正式执行日志。

仅 LinkedIn 的请求继续原三阶段流程。当前含 X 与 LinkedIn 的混合请求会先运行 X 的共同母稿流程，再运行 LinkedIn 旧流程；本分支不宣称实现跨平台统一母稿，后续合并共享编排时应明确取代这层路由。

本次用 `git show 1e7cc37` 只读核对已提交 MVP 的 `server/text-rules-v2.mjs`、`server/text-pipeline.mjs` 与生成服务。复用其源语言隔离原则：首份 variant 只负责 tmp/进程归属，不能把目标语言配置变成共同母稿要求；平台改写按实际 `mother.sourceLanguage` 重新解析规则。X 的完整规则和语言无关母稿规则均有独立 hash，母稿规则也进入最终 variant hash。没有迁入 LinkedIn v2 大管线、恢复机制或改写旧 LinkedIn 行为；图片 worker 由独立 X 图片服务接入，不在文本服务中创建第二个实例。

## 修改与图片

局部 Agent 改稿继续使用原有 UTF-16 精确选区、并发 revision 和原稿不覆盖保护。X 依据原执行 ID 定位来源任务，再校验并读取原母稿/平台稿 hash，沿用完整规则、事实账本和术语表；不能用另一任务碰巧相同的规则 hash 代替。选区外、其他帖子、其他 document 和另一语言不改。共同事实影响写入未解决项，不自动同步。

改稿后重新计数并调用图片关联校验。正文/顺序改变时相应 document 的图片保守标为需要更新，其他 document 的图片保持。图片规则加入实际模型上下文；实际图片生成与目检仍以 [图片资料](images.md) 和总验收记录为准，提示词与 brief 不等于实际图片。

`createGenerationService` 接受 `onXReady(tmpIds: string[], finalTexts: {tmpId: string, revision: number}[])` 与 `xImageCapabilities()` 注入。只有本次所有 X 终稿成功写入 tmp，且任务尚未取消，才调用一次 `onXReady`。第二参来自各语言最终 `content.updateTmp` 的实际返回值，冻结文本保存时的 revision；缺少该版本或当前 tmp 已变化时，调度跳过整份内容包，不能以回调时重读的最新版本替代。这样先完成的语言在等待另一语言期间被用户编辑或选择无图后，不会误用新稿启动自动配图。

主服务持有唯一 X 图片服务实例，逐个 tmp/document 创建后台任务：有上传图则检查，无图则生成；同一个 tmp 串行处理，后续对象只承接刚完成图片任务的 `resultRevision`。文本服务不等待图片任务，回调同步抛错或异步拒绝只保留图片启动未解决项，不把文本改成失败。任何文本阶段失败或先前取消均不启动这一回调；重启不会重复启动，局部改稿也不自动重生图片。用户后续选择无图或修改绑定不被生成完成回调反复覆盖。

接通回调的 X `assetStatus=pending` 只表示图片由独立任务处理，最终图片状态在各 document 的绑定和图片任务中读取，不用文本任务伪造图片完成。`capabilities().image.x` 透传 X 图片能力；通用 `image.status` 保留 LinkedIn 旧线的未连接状态，提示文字明确两条线路。没有回调时继续如实显示图片依赖阻塞。

## 验证与合并注意

本模块由明确替身在独立临时数据库验证：共享母稿/平台稿、同语透传、双语不同条数、审核次数/顺序、ID稳定、超限保留、事实来源错误拒绝、tmp不入正式库、精确局部修改、图片失效、重启幂等及取消迟到保护。`tests/x-text.test.mjs` 和 `tests/x-generation.test.mjs` 是本轮专项。真实工作台生成由主 Agent 统一执行并记录，不能以这些替身测试代称真实模型/图片/OAuth/发布通过。

2026-09-26 源语言隔离及图片回调修复后，运行 X 生成/计数规则专项与旧 `tests/generation.test.mjs` 共 22 项通过。其中新增验证中文单目标＋中文目的说明＋英文资料的阶段规则隔离、全部 X 终稿落盘后单次非阻塞回调、回调失败不改变文本完成、第二语言文本失败不启动图片，以及局部改稿/重启不重复启动。真实调用不由此测试发起。

随后补充跨语言等待期间的图片调度竞态回归：暂停英文修订，中文终稿先完成且带上传图；用户将中文改为无图后再放行英文。调度必须跳过中文、不改其内容或 revision，英文两个对象可继续各自图片检查。该用例在修复前失败、冻结最终文本 revision 后通过；生成、X 生成及图片集成测试共 23 项通过，图片与模型仍为明确替身。

本模块修改共享文件 `server/generation-service.mjs`、`server/rule-resolver.mjs`；依赖主 Agent 的 content-validation、content-store、types、UI、package 与锁文件接入及图片 Agent 的 `server/x-images.mjs`。另一条 LinkedIn 深化线可能改动相同生成服务；合并时保留现有 tmp/并发/取消/恢复边界及 LinkedIn 行为测试。旧测试中把 X 当 pending 的断言需改为仍未适配的平台，而非删除保护。
