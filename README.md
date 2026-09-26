# launch-loop

为个人开发者和内容运营执行者准备的本地内容工作台：创作、看稿改稿、确认保存和准备发布。资料、任务与历史研究／审查记录继续保留，反馈位置留空。

**当前实现：** `text-v2.0.0`共同母稿、LinkedIn改写、中英文本地化、每稿一次审核后统一修订；后台图片适配、选区差异提案、接受／拒绝／撤回、显式跨语言同步、tmp暂存、确认保存与不可变版本；44项任务、28项资源及备份恢复继续可用。

**外部能力有条件：** 文本和图片复用本机正式登录的Codex；配图需显式启用官方缓存适配，实际完成状态见[本轮验收报告](docs/MVP验收报告.md)。LinkedIn适配已实现，操作者尚未准备应用与HTTPS回调，真实OAuth和发布未验收。确认保存不会自动发布。本地资料和任务功能无需Codex账号。

2026-09-24 MVP整合基于`5942773`，独立分支`codex/mvp-integration`。当前结果、证据与未完成依赖见[本轮验收报告](docs/MVP验收报告.md)；第三轮`text-v1.0.0`真实验证作为历史保留，不能代替新流程验收。真实稿件始终留tmp，不代用户确认保存。

**X 支持：** 支持标准普通帖子与串帖、中英文、逐帖加权计数、编辑改稿、单图／首帖配图和官方 OAuth 发布适配。图片后台复用本机正式登录的 Codex；需要显式启用，实际出图与检查结果在稿件中显示。X 的真实账号授权、媒体上传和发帖尚未验收；确认保存不会自动发布。入口和证据见 [X 交接](docs/x/handoff.md)与[本轮验证](docs/x/validation.md)。

**当前范围：** LinkedIn普通feed、X普通帖子和串帖，中英文独立稿件及配图。Premium长帖、X Articles、Pulse、kit/copy、DOCX、小红书、知乎、Bilibili和视频未启用。平台实现与真实验收分别见上述报告。

[启动](#启动工作台) · [日常使用](#日常使用) · [备份与交接](#备份与交接) · [源码复现](#从源码复现与开发) · [继续项目](#在新会话中继续项目)

## 启动工作台

已验证环境为 **Windows x64**。准备以下软件：

- [Node.js](https://nodejs.org/en/download)：**22.13.0 或更新版本**。使用官方安装程序并保留加入 PATH 的选项，安装后重新打开终端。
- [Git](https://git-scm.com/downloads)：仅使用下方克隆命令时需要；也可以在 GitHub 页面选择 **Code → Download ZIP** 并完整解压。

在 PowerShell 中下载仓库并进入目录：

```powershell
git clone https://github.com/agtai/launch-loop.git
cd launch-loop
node --version
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Start-Workbench.ps1
```

也可以在文件管理器中双击 **[启动工作台.cmd](启动工作台.cmd)**。启动成功后浏览器自动打开：

**[http://127.0.0.1:4318](http://127.0.0.1:4318)**

启动后直接进入创作。首次运行会在 `data/` 创建本地数据库，不需要独立数据库服务；文本生成和LinkedIn连接各有下方说明的账号条件，未配置时显示实际限制。

仓库保留了构建好的 `dist/`，**只使用工作台不需要运行 `npm install` 或 `npm ci`**。Git 克隆不包含 `runtime/node.exe`；请按上面的步骤安装 Node.js。已有完整便携包或自行放入的 `runtime/node.exe` 也可由启动器使用。

结束时双击 **[停止工作台.cmd](停止工作台.cmd)**，或执行：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Stop-Workbench.ps1
```

关闭浏览器不会停止后台服务。重复启动同一个目录会打开已运行的工作台；记录和备份不会因停止服务而删除。

若本机联网依赖已经启用的手工系统代理，先停止本目录服务，再按需执行：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Start-Workbench.ps1 -UseSystemProxy
```

该选项只给本次后台进程使用当前操作者的代理，不修改全局网络设置、不写死开发者地址。已有进程代理优先；PAC、含凭据及不明确的代理映射会报错。Node支持时同时启用其环境代理功能，旧版本会说明限制。超时仍可能来自网络、输入量或模型执行，本轮未证明单一根因；不要无变化地反复重试。

启用 LinkedIn 与 X 后台配图时，先使用同目录停止脚本停止服务，再执行：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Start-Workbench.ps1 -EnableCodexImages
```

这会使用本机已正式登录的 Codex 及其账号额度，图片先进入官方图片缓存，再收进本项目 `data/tmp/`。需要现有系统代理时可加 `-UseSystemProxy`。LinkedIn 为双语终稿检查并绑定配图；新生成的 X 稿按普通帖和串帖首图依次配图，也可在稿件的“后台配图”中重新检查入口、生成、检查或取消。失败保留文字，不自动重试；修改文字后需更新、重新检查或取消选用图片。启用参数只影响本次服务进程，不会更改全局配置。

## 日常使用

右上角 **中文 / English** 可切换整个工作台界面，包括创作、发布、任务、资料、历史模块、弹窗、状态与错误提示。弹窗内也有语言开关，切换不会丢失未保存的编辑；浏览器会记住选择。界面语言与创作表单中的稿件语言分别设置，用户正文、上传资料和执行记录保留原文。下载的原始参考文档保留来源语言。

| 页面 | 用法 |
|---|---|
| 创作 | 填资料、目的、读者，生成后在右侧看稿、修改并明确确认保存 |
| 发布 | 选择正式版本、核对账号和预览；单独确认发布后才可提交 |
| 反馈 | 留空，后续设计 |
| 历史研究／审查记录 | 读取和维护原有记录，不作为新流程的独立关卡 |
| 全部工作与分工 | 从 44 项任务中选一项，填写负责人、状态、执行记录及成果链接；复制任务包交给其他人或 Agent |
| 竞品与复用库 | 检索 16 个产品和 12 项 skills／现有能力，查看复用对象、方法、理由、来源及能力边界 |
| 架构与取舍 | 查看哪些直接复用、哪些由工作台管理，以及后续自动化的接入位置 |
| 使用与交接 | 下载操作指南、完整调研、工作清单和文案试跑样例 |

创作页三项必填均附说明和例子；支持上传UTF-8 TXT／MD资料和PNG／JPEG图片，PDF、DOCX和链接自动抓取尚未支持。LinkedIn、中英文、普通动态是可修改的试运行预设。其他平台或未适配格式会明确阻止执行。

生成后选择语言稿，在右侧直接改正文，或选中段落文字提交修改意见。接受Agent建议仍只进入tmp；“确认保存”才产生正式版本。已有作品的新修改先暂存，确认后增加版本。遇到冲突保留本地修改；恢复后的旧tmp需显式派生再编辑。原任务库中的状态仍由执行者记录，“复制任务”不启动模型。

真实生成需要当前Windows用户可运行、已正式登录的Codex CLI及网络，会使用对应账号额度；工作台不会购买服务或提取会话token。使用本地资料／台账可离线；本项目不使用Sites托管额度。自动配图没有可用后端入口时显示未连接，不能用上传图推断自动配图成功。

发布页可切换 LinkedIn 与 X，并显示各自缺失的配置。分别按 [LinkedIn最小配置](docs/LinkedIn最小配置.md)和 [X 配置指南](public/docs/x-setup.md)准备应用及回调；不要在聊天中粘贴secret。授权成功返回工作台并读取实际连接状态。预览绑定账号、明确版本和图片；X 还须明确选择普通帖或完整串帖，换账号或恢复后需重新确认。串帖部分完成时保留已发前缀，未知结果禁止自动重试。规则见 [LinkedIn MVP接口](docs/MVP执行与素材接口.md)和 [X 发布接口](docs/x/publishing.md)。

供应商研究属于官方文档核查，不代表已连接账号或登录商业产品试用。完整事实、来源和未验证项见 [竞品与复用调研](docs/完整竞品与复用调研.md)。

## 备份与交接

使用方式是当前操作者开发和首轮使用，随后由第二位负责人在自己的电脑承担生成和发布，内容保存在接手者的项目目录。Codex是目前复用现有账号的执行适配，不是永久唯一供应商决定；接手者需自己完成正式登录，其他仅查看者不因此需要Codex。其他人通过工作台只读访问的需求已记录，但远程访问与权限控制尚未实现，不能直接把本地端口公开。

- **保存位置：** `data/workbench.sqlite` 存放模块、任务、已确认内容版本和素材及发布元数据。未经确认的正文与素材在 `data/tmp/content/`，模型提示、审核与执行输出在 `data/tmp/generation/`；不自动清理。`data/` 不进入Git。
- **换电脑或交给下一位执行者：** 在页面点击“备份数据”，得到 JSON；对方启动自己的工作台后选择“恢复备份”，核对预览再确认。
- **备份范围：** JSON包含模块、任务、已确认内容所有版本与素材字节，以及发布状态、防重hash和真实平台ID；不包含tmp、OAuth token、client secret、源码或外部成果文件。临时稿需随完整 `data/` 单独交接，凭据重新授权。
- **自动快照：** 每天首次修改前保留一份快照，最近 30 份；每次恢复前另存快照，最近 20 份，均位于 `data/backups/`。
- **恢复要求：** 协议仍为版本1、最大16MiB。旧备份保留现有正式内容；含 `content` 的新备份恢复正式内容集合。`publishing`扩展合并保留已发布／未知事实与防重记录，恢复不发帖；活跃提交时拒绝恢复。成功恢复使旧tmp过期但可读，并中断生成。详见[内容存储接口](docs/内容存储接口.md)和[执行接口](docs/第二阶段执行与发布接口.md)。旧程序不识别新扩展。
- **任务交接包：** “导出交接包”生成包含当前分工、记录和验收条件的 Markdown，适合交给人或 Agent。它不能代替可恢复的 JSON 备份。

不要在服务运行时只复制 SQLite 主文件。优先使用页面 JSON 导出；需要完整复制运行数据时，先停止服务，再复制整个 `data/` 文件夹。

多个页面修改同一条记录时，旧版本保存会被拒绝，可先下载当前草稿，再载入最新记录合并。当前不提供多台电脑实时同步或远程只读访问。服务仅监听本机 `127.0.0.1`；OAuth回调代理不开放其他页面。

## 从源码复现与开发

在仓库根目录执行。Node.js 版本要求同上，npm 随官方 Node 安装程序提供。

```powershell
npm ci
npm run build
npm test
npm start
```

`npm ci` 按 `package-lock.json` 安装依赖，首次需要网络；`npm run build` 先执行 TypeScript 检查，再生成 `dist/`；`npm test` 执行后端与 Windows 启停测试。`npm start` 在前台启动服务，手动打开 [本地页面](http://127.0.0.1:4318)，按 **Ctrl+C** 停止。

**前台 `npm start` 与后台启动脚本二选一。** 运行前先停止另一种方式启动的同端口服务。Windows 停止脚本只管理启动脚本登记的后台进程。

改动 `src/` 或 `public/` 后重新构建；改动 `server/` 后重新启动。提交前保持源码与 `dist/` 一致。运行服务使用 Node 内置 HTTP 与 SQLite，预构建页面不依赖安装在 `node_modules/` 的运行时包。

| 位置 | 内容 |
|---|---|
| `src/` | React／TypeScript 页面、任务定义、资源目录和工作流模板 |
| `server/` | Node HTTP／SQLite 服务及 Windows 启动器公共逻辑 |
| `rules/text/v1/` | 版本化文本规则、来源及固定映射；其他平台与格式明确标为待适配 |
| `rules/text/v2/` | 新流程规则、共享阶段、固定映射与候选来源；v1和候选原包保留 |
| `data-seed/` | 新数据库的初始模块与任务 ID |
| `public/docs/` → `dist/docs/` | 页面可下载的指南、调研和清单；构建时复制 |
| `dist/` | 已构建页面，供克隆后直接启动 |
| `tests/` | 保存、恢复、版本冲突、请求边界及启动器测试 |
| `docs/`、`research/` | 需求、方案、验证记录、竞品与 skills 调研 |
| `docs/references/` | 用户提供的两份 Word、项目 skill、原始笔记及来源说明 |
| `data/`、`tmp/`、`node_modules/` | 本地运营数据、临时试稿和开发依赖，均不进入 Git |

## 在新会话中继续项目

新 session 直接以此仓库为工作目录继续，无需查找旧聊天或原电脑的 Downloads 文件夹。本轮接手不以换机器、迁服务器或Linux适配为前提。当前main已包含LinkedIn MVP与X；真实生成、图片及外部发布的验证边界见会话交接。

按此顺序阅读：

1. [Agent 工作约定](AGENTS.md)和[会话交接](docs/SESSION_HANDOFF.md)：当前规则、代码和实际验证状态。
2. [新 session 接手指南](docs/新session接手指南.md)：最短阅读路径、Git核对和可复制提示。
3. [开发总清单](docs/开发总清单.md)：MVP、体验、多平台、技能深化与延期任务的依赖和验收。
4. [技能候选与取舍清单](docs/技能候选与取舍清单.md)和[本地skill资料库](skill-library/README.md)：固定版本原件、附属参考、许可和hash，直接在仓库分析。
5. [内容需求历史](docs/内容生产与发布需求.md)和[用户参考资料](docs/references/README.md)：[Launch kit](docs/references/launch-kit.docx)、[Launch copy](docs/references/launch-copy.docx)、[s1a-launch-kit skill](docs/references/s1a-launch-kit/SKILL.md)。

[早期44项运营清单](docs/全部工作与复用清单.md)、[完整调研](docs/完整竞品与复用调研.md)、[流程试跑样例](docs/流程试跑样例.md)保留作历史参考，不替代当前开发总清单。

可把下面这段作为新会话的起点：

> 请先读取AGENTS.md、docs/SESSION_HANDOFF.md、docs/新session接手指南.md和docs/开发总清单.md，核对Git与最新验证。本轮任务是【填写任务ID或目标】。涉及skill时从skill-library本地快照分析，不重复搜集或直接执行原包。区分代码、替身测试、真实模型／图片和平台结果；未确认内容只在tmp，保存与发布分别确认。按本轮指定范围继续，不自动commit、push、部署或实际发帖。

其他接入依据：[LinkedIn 发布与反馈核查](docs/LinkedIn发布与反馈接入核查.md)。历史验证见 [验证记录](docs/验证记录.md)，2026-09-23的历史仓库迁移见 [迁移记录](docs/MIGRATION.md)。本轮是同项目的新session交接整理。

## 常见问题

| 现象 | 处理 |
|---|---|
| 提示未找到 Node | 安装 Node.js 22.13+ 并重新打开终端；用 `node --version` 检查。Git 仓库不附带 Node 二进制文件 |
| 页面打不开 | 重新运行启动脚本，查看提示与 `data/server.log`、`data/server-error.log` |
| 端口 4318 被占用 | 先停止自己开启的旧工作台，或用下方命令换端口；启动器不会关闭其他程序 |
| 提示缺少 `dist/index.html` | 确认下载的是完整仓库；开发者可执行 `npm ci`、`npm run build` 重建 |
| PowerShell 阻止 `npm.ps1` | 使用 `npm.cmd ci`、`npm.cmd run build`、`npm.cmd test`、`npm.cmd start`；无需修改全局执行策略 |
| 数据读取失败 | 保留 `data/`，检查日志或用已有 JSON 备份恢复；不要先删除数据库 |

更换端口前，先停止当前目录的后台工作台，然后执行：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Start-Workbench.ps1 -Port 4320
```

此时访问 `http://127.0.0.1:4320`，停止方式不变。macOS、Linux 和 Windows ARM 尚未完成目标环境验证。

第三方依赖声明见 [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md)；参考材料的来源与使用边界见 [资料索引](docs/references/README.md)。
