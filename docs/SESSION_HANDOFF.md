# Launch Loop：新 session 交接

更新：2026-09-23。本文件区分已经实现的应用、已经核查的资料和下一阶段计划；可直接从本仓库接着工作，无需原来的聊天记录或 Downloads 文件夹。

## 用户要完成什么

让 Agent 从产品资料出发，生成中英文文章，在良好的阅读界面中接受用户修改，按项目 skill 精修，发布指定稿件并收集真实反馈。第一版由作者使用，后续应能交给非技术人员执行。工作台是这些实际操作的入口，不能停留在流程说明与任务列表。

第一批内容围绕 [ThinkFlowLab/system1-agents](https://github.com/ThinkFlowLab/system1-agents)。作者已发布的 [LinkedIn 首篇文章](https://www.linkedin.com/pulse/give-your-agents-jev-like-system-1-decision-model-kai-yuan-phd-ymhgc) 是内容与原生长文呈现的参考。Launch Loop 的项目仓库是 [agtai/launch-loop](https://github.com/agtai/launch-loop)，两者分开维护。

用户已明确：Claude / Codex 均可，优先复用现有账号。不要为了界面先重建 Agent 平台，也不要把现有产品的所有能力重复开发一遍。遇到可执行的授权事项继续推进，避免反复询问；涉及对外发布时以用户对该内容与渠道的实际授权为准，不从历史参考材料推导授权。

## 当前实现与下一阶段的边界

| 范围 | 当前状态 |
|---|---|
| 本机工作台 | 已有：免登录、Windows 一键启动/停止、SQLite 持久化 |
| 五步工作流 | 已有：研究、制作、审查、发布、反馈的操作模板和可编辑记录 |
| 任务与交接 | 已有：44 项任务，负责人、状态、备注、成果链接、任务包复制与导出 |
| 调研与复用库 | 已有：28 项资源，含 16 个产品和 12 项 skills / 现有能力；逐项说明复用什么、如何复用、为什么值得复用 |
| 数据保护 | 已有：revision 冲突检查、草稿保留入口、JSON 备份/恢复、恢复前快照、本机来源限制 |
| 内容生产 | 待实现：文章实体、双语正文、段落编辑、意见、版本、批准版本、真实 Agent 执行记录 |
| 内容交付 | 待实现：从同一份内容数据生成工作版 kit 与发布版 copy、DOCX 导出及页面验收 |
| 发布与反馈 | 待实现：渠道适配、真实发布结果、指标/评论导入与采集、反馈分析与后续选题 |
| 多人协作 | 当前通过任务包、文件与 Git 交接；没有跨电脑实时数据库同步 |

没有连接模型 API、付费服务或社媒账号；没有执行任何对外发布，也没有自动抓取评论。资料与文案样例不代表发布流程已跑通。任务的「已完成」应由真实交付物支撑，不能因模板已写好就批量改成已完成。

## 首先读哪些材料

| 文件 | 用途 |
|---|---|
| [README.md](../README.md) | 首次启动、开发复现、故障排查与交接 |
| [内容生产与发布需求.md](内容生产与发布需求.md) | 用户最新目标、编辑体验、数据字段和第一轮验收；优先于较早的范围建议 |
| [LinkedIn发布与反馈接入核查.md](LinkedIn发布与反馈接入核查.md) | 原生文章、动态、指标、评论各自的能力和权限边界 |
| [references/README.md](references/README.md) | 用户原始文件与派生分析索引 |
| [references/launch-kit.docx](references/launch-kit.docx) | 可讨论、修改、迭代的工作材料参考 |
| [references/launch-copy.docx](references/launch-copy.docx) | 经 Claude 处理后的发布文案与呈现参考 |
| [references/s1a-launch-kit/SKILL.md](references/s1a-launch-kit/SKILL.md) | 用户提供的写作与交付规则；保留原件，并非自动安装的 skill |
| [references/reference-review.md](references/reference-review.md) | 两份 Word 的正文/结构比较、图片检查与界面要求 |
| [全部工作与复用清单.md](全部工作与复用清单.md) | 44 项操作任务、依赖、验收和复用说明 |
| [完整竞品与复用调研.md](完整竞品与复用调研.md) | 28 项资源的官方来源、复用建议及限制 |
| [流程试跑样例.md](流程试跑样例.md) | 基于真实仓库事实的背景、简报、文案和审查样例；未发布 |
| [验证记录.md](验证记录.md) | 原交付版本的测试与浏览器证据及未覆盖范围 |

`research/` 还包含品牌管理、营销产品和 skills 的原始研究 Markdown / JSON。`docs/references/` 有原始笔记图片、正文提取文本和校验值；来源文件未修改。

两份 Word 以英文为主，中文只含媒体投稿短稿，**不是完整双语内容包**。`launch-copy.docx` 仍有 `[ARTICLE URL]`、`[NAME]`、`[EMAIL]` 等占位符；它是目标样例，不能因文件名是最终版就自动标记可发布。

Word 已完成全文、OOXML 结构和内嵌图片读取。此前技能包的渲染尝试因运行时缺少 bundled LibreOffice `soffice.exe` 失败，没有生成页面 PNG；没有验证分页、裁切和字体替换，也没有改用用户桌面 LibreOffice。因此后续 DOCX 交付须补上可用且受支持的页面渲染与视觉检查。

## 本仓库如何运行

按 README 安装 Node.js 22.13 或更新的兼容版本。预构建界面位于 `dist/`；Windows 操作者可双击仓库根目录的 `启动工作台.cmd`。运行时二进制不提交到 Git，另一台电脑需有合适的 Node 环境。

开发复现，在仓库根目录执行：

```powershell
npm ci
npm run build
npm test
npm start
```

打开 `http://127.0.0.1:4318/`。`npm start` 是前台服务，用 Ctrl+C 停止。一键脚本启动的后台服务通过同目录的 `停止工作台.cmd` 停止。开发检查不要批量停止 Node；如端口占用，确认占用来源或按 README 更换端口。

当前没有 Vite 开发代理入口。修改页面后重新构建并刷新浏览器；不要让仓库中的 `dist/` 落后于源码。

## 代码与数据地图

| 位置 | 职责 |
|---|---|
| `src/App.tsx`、`src/styles.css` | 五个视图：工作流、任务分工、竞品库、架构、使用交接 |
| `src/workflow.ts`、`src/types.ts` | 工作流类型、任务/资源相关定义与展示辅助 |
| `src/tasks.json`、`src/resources.json` | 44 项任务说明与 28 项资源；属于方法库，不是真实运营状态 |
| `data-seed/modules.json`、`data-seed/tasks.json` | 首次运行初始化的模块与任务 ID |
| `server/index.mjs` | HTTP 静态服务、API、SQLite、备份恢复和数据校验 |
| `Start-Workbench.ps1`、`Stop-Workbench.ps1`、`server/Launcher.Common.ps1` | Windows 启停、Node 检测和进程身份校验 |
| `tests/` | 后端持久化、并发/恢复/安全以及 Windows 启动器测试 |
| `public/docs/` | 页面可下载的文档副本，构建后进入 `dist/docs/`；修改正式文档时同步相关副本 |
| `data/workbench.sqlite` | 本机实际模块和任务状态，Git 忽略 |
| `data/backups/` | 日快照和恢复前快照，Git 忽略；不得将私人记录加入公开仓库 |

当前 API：`GET /api/health`、`GET/PUT /api/modules`、`GET/PUT /api/tasks`、`GET /api/backup`、`POST /api/restore`。模块/任务保存提交完整字段和当前 revision，冲突返回 409；没有文章、模型执行、发布或反馈 API。

备份仍采用 `app: "content-workbench-local"`、`version: 1`，这是为兼容已有数据而保留的内部格式，与新仓库名称无冲突。普通写入上限 2 MiB，恢复上限 16 MiB。新增内容实体时应明确旧数据库与旧备份的迁移路径，保留原有记录。日快照最多保留 30 份，恢复前快照最多 20 份；JSON 备份不包含原始素材文件。

## 已做的调研与复用结论

- 笔记中的品牌管理产品按语境核为 **Frontify**；Frontity 是另一个 WordPress / React 项目。研究包含 Frontify、Bynder、Papirfly、Air；先复用品牌事实、语气、素材、版本和批准机制，不必采购企业素材库。
- 补充研究了 AirOps、StoryChief、Blaze、Jasper、Copy.ai、Sintra Soshie，以及 Buffer、Typefully、Postiz、n8n、Gumloop、Relevance AI。均以官方文档核验为主，未登录试用或付费。
- `product-marketing`、`social` 和本机 `shuorenhua` 的规则用于一份资料/文案样例；这不是安装好全部技能或接好模型服务。用户项目专用 `s1a-launch-kit` 保留在 references 供实际生成与审查复用。
- 原研究建议先用现有 Agent、技能、一个发布工具和本地工作台。后补充的文章编辑/双语要求是新的核心需求；早期报告中「首版不开发富文本编辑器」应理解为优先复用成熟编辑能力，不能作为拒绝实现编辑体验的依据。
- LinkedIn 原生长文章与普通动态必须区分。Posts API 的 `article` 链接卡片不等于 Pulse 正文创建；当前核查未找到可依赖的公开原生长文创建 API。Buffer 普通动态、指标、评论各有边界；Typefully 的 LinkedIn 发布不能推导出 LinkedIn 分析能力。具体接入前重新核实这些可能变化的能力。

## 接下来按什么顺序做

1. **内容数据与编辑体验**：围绕一个内容项目保存中英文正文、素材、来源、段落、意见和版本。提供阅读/编辑、语言切换、工作版/发布版预览。批准要绑定具体版本，改稿后保留历史并产生新版本。
2. **真实 Agent 执行**：核实当前操作者已有的 Claude / Codex 可用入口，复用项目 skill。记录输入、skill 版本、实际输出、错误与执行状态。页面与单一模型供应商解耦；导出一段 prompt 不算完成自动生成。
3. **内容包与 DOCX**：同一份内容数据产出 kit 和 copy，保留完整中英文文章及 LinkedIn 动态稿。检查占位符、术语、事实与导出一致性，补齐实际页面渲染检查。
4. **发布**：按已批准版本、语言、账号与内容类型准备结果。原生 LinkedIn 长文和 feed post 分开适配；仅对证实可用且已获授权的方式提交，记录真实 ID、URL、失败原因。不要用已有文章的重发作测试。
5. **反馈**：先允许原生导出、真实评论/指标导入，再逐项接获批的 API。区分发布时间和采集时间；缺失值为空。输出具体疑问、需求、修改建议和下一篇选题，保留来源。

第一轮验收是一组从真实资料生成的中英文文章及 LinkedIn 动态稿：用户能改稿、Agent 能按意见修订、kit / copy 可用，发布记录关联真实结果，反馈来源能追溯。实现可以分步交付，但不能把未完成阶段显示为已跑通。

## 验证状态与更新要求

本次迁入 launch-loop 后已重新完成依赖安装、生产构建、9 项测试和新目录实际启动；另以仅含 Git 文件的干净副本验证了无需 node_modules 或附带 Node 的启动路径，使用 PATH 中的 Node 即可。原数据库 49 条记录迁移后内容一致。详见 [迁移记录](MIGRATION.md)。

[原交付验证记录](验证记录.md) 记载 Windows x64 / Node 22.23.2 下构建和 9 项测试通过，并有保存、刷新持久化、任务复制、未保存草稿提示、资料检索等浏览器验证。它是原版本的历史证据，不能自动等同于迁移后或后续修改后的验证。

新 session 先检查当前 Git 变更、README 和最新验证记录，再按本次改动运行必要检查。完成一个阶段后同步本文件的实现状态、对应需求与验证记录，并保留仍未验证的范围。不要根据文件名、旧聊天承诺或按钮存在推断能力已完成。
