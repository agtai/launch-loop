# X 独立分支交接

当前 main 补充（2026-09-26）：用户已授权将本轮唯一提交 `083bd70` cherry-pick 到 `8bc5bb7` 上。main 合并时保留 LinkedIn `text-v2.0.0` 和完整 MVP 图片／改稿／发布保护，X 继续独立规则与流程。来源分支和下文历史验收目录不变；tmp 不复制到 main。整合验证见 [验证记录](../验证记录.md)，最新协作边界见 [会话交接](../SESSION_HANDOFF.md)。下文“未授权合并”及 LinkedIn v1 等描述仅表示来源提交当时状态。

更新：2026-09-26。本轮范围是 X 标准普通帖子与串帖、中英文、单图／串帖首图及官方授权发布适配。用户已要求完成本轮成果并形成一个本地 commit；未授权 push、合并、真实平台图片上传或发帖。本轮提交主题为 `feat: support X posts threads images and publishing`，具体 hash 以 Git 为准。

## 工作区与启动

已提交基线：`5942773a2e7372af461497185717a06553fe2444`；分支：`codex/x-content-publishing`。

在该分支对应的独立工作区执行以下指引；可用 `git worktree list` 定位。代码、运行时及启动路径均按项目目录解析，不依赖开发者用户名。

本次真实验收在独立运行目录 `tmp/x-completion-real/`，数据位于其 `data/`，真实正文／审核／图片／模型工件位于其 `data/tmp/`。包装入口引用本分支服务代码，不使用旧服务器副本。浏览器地址为 <http://127.0.0.1:4356/>。在本分支项目目录执行：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tmp\x-completion-real\Start-Workbench.ps1 -Port 4356 -NoBrowser -EnableCodexImages
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tmp\x-completion-real\Stop-Workbench.ps1
```

两条分别是启动和停止命令，不能连在一起执行。`EnableCodexImages` 只为本次进程启用已登录 Codex 图片入口。9月26日本机无手工系统代理，实际生成直接联网成功，未改动全局网络。正式移交机器按根目录 README 使用自身账号启动；tmp验收目录不随 Git 分发，不复制凭据或当前操作者的模型运行缓存。不要使用别的工作区的停止脚本，不批量结束 Node。

合成浏览器验收另用 `tmp/x-completion-synthetic/`、端口 4357、明显带 `SYNTHETIC` 的材料、图片与账号，可复现的替身入口在 `tests/fixtures/x-browser-server.mjs`。9月24日保存／部分发布验证另在 `tmp/x-synthetic/`、4347完成。两者均不是实际平台结果，收尾关闭合成服务。tmp 不进入 Git，既有用户数据没有被覆盖或清理。

## 人工验收

1. 打开创作页，进入本机任务的中文或英文暂存稿。每种语言含普通帖子与完整串帖。核对事实、表达、首帖吸引力和逐帖推进；界面语言切换应保留正文。
2. 逐条查看加权字数。可以手动修改或选中文字要求局部改稿；接受改稿只产生新的 tmp，正式保存仍由你决定。另一语言不会自动覆盖。
3. 查看“后台配图”结果和普通帖子／串帖首帖的实际图片。自动检查通过和用户亲自检查有不同提示；请核对画面、含义、图片描述与手机可读性，再决定是否保存。正文变化会使旧图关联失效，可重新生成或检查；明确选择无图后不会因更新另一对象的说明而重新挂图。
4. 当前不要用真实稿替开发测试做发布。日后由负责人完成 [X 配置](../../public/docs/x-setup.md)，操作者确认保存具体版本，再核对账号、语言、普通帖或串帖、所有文字和图片；实际发布是独立的最后确认。

## 交付入口与状态

- [范围与接口](implementation.md)、[文本规则与编排](text-generation.md)、[来源与取舍](../../rules/x/sources.json)。固定 `x-text-v1.0.0` 与官方 `twitter-text@3.1.0/config-v3`，不使用 Premium 长帖。
- [图片规则与后端契约](images.md)：`x-images-v1.0.0`，图片来源／字节／尺寸／hash／实际正文关联；后台生成和实际看图检查已接入。brief、人工上传、生成、自动检查和人工确认分别显示。
- [OAuth、发布及备份](publishing.md)：逐帖持久化、部分失败、未知结果、核对后续发及恢复防重；真实账号、媒体上传与发帖尚未验收。
- [本轮验证报告](validation.md)：命令、浏览器、真实模型和外部依赖分别记录，历史 LinkedIn 验证不作为本轮 X 验证。

## 共享文件及后续合并

本轮没有从另一条 LinkedIn MVP 工作区复制未提交修改。9月26日核对该线已有本地提交 `1e7cc37`，通过 `git show` 复用其 `server/image-runner.mjs`、`server/image-app-server-worker.mjs` 和 `Start-Workbench.ps1`，runner 增加 X 专用生成／看图提示；worker 保持该提交实现。没有整体合并其 LinkedIn 编排和规则候选。X 的新增模块集中在 `server/x-*.mjs`、`rules/x/`、`rules/x-images/`、X 界面组件与专项测试。

| 共享文件 | 本次必要改动 | 合并注意 |
|---|---|---|
| `server/generation-service.mjs` | X 共同母稿→格式改写→本地化→每语言包一次审核→修订；原任务母稿支持局改 | 另一线同文件冲突需人工结合明确提交。X+LinkedIn 混合请求目前各走其平台编排，尚非跨平台同一母稿 |
| `server/rule-resolver.mjs` | X 平台／格式映射和独立固定版本 | 来源分支当时保留 LinkedIn `text-v1.0.0`；main 合入时保留已有 `text-v2.0.0` 集成，其他平台仍待适配 |
| `server/content-validation.mjs`、`content-store.mjs`、`src/content-types.ts` | 显式逐帖块、稳定 ID、首图关联和可选 `madeWithAi`；正式版本与备份保留 | 保留旧内容形状、revision、tmp隔离、事务恢复；备份素材校验必须允许并验证可选 AI 标记 |
| `server/index.mjs` | 组合 X 路由／服务／独立发布表和可选 `xPublishing` 备份扩展；恢复事务与 epoch | `app=content-workbench-local,version=1` 不改；旧备份缺扩展时保留当前 X 防重事实；旧程序不支持带扩展的新备份 |
| `src/ContentWorkspace.tsx`、`PublishingWorkspace.tsx`、`App.tsx` | 平台入口、阶段、暂存更新、双格式编辑、具体对象发布与 OAuth 返回 | 保存确认与发布确认继续独立；回调标记只导航，不代表已连接 |
| `src/content-workspace.css`、`i18n-core.mjs`、`locales/x.en.json` | X 编辑／发布布局与双语受控文案 | 不翻译用户正文、实际审核与素材来源 |
| `package.json`、`package-lock.json`、`dist/`、`public/docs/x-setup.md` | 固定官方计数依赖、可分发构建与管理员指南 | 带齐 vendor 许可；前端修改后重新 build，不能只合源码漏 dist |
| 原测试及 `tests/x-*.test.mjs` | 将历史 X pending 断言改为真正待适配平台；补边界与回归 | 不删除旧 LinkedIn、旧内容、备份及取消测试来消除冲突 |

共享图片入口已按用户明确的官方缓存决定接入；`server/x-image-service.mjs` 负责当前版本检查、生成／视觉检查、素材归档和取消。文本完成后的自动调度只接收文本刚写入时冻结的 revision；用户提前编辑过的稿件不自动覆盖配图选择。局部改稿不自动触发新图。混合平台任务中的 X 文本完成后，X 图片任务独立运行，应在图片面板单独取消。

后续接入共享编排须保留冻结初稿、一次审核、事实账本、原任务引用、逐帖 ID、字数检查与局改选区保护；不能只替换文件或只改版本标签。合并后重新做本分支 X 和旧 LinkedIn 兼容测试，并按改动范围验证浏览器。未完成外部验收仍要明确保留。
