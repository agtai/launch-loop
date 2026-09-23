# launch-loop · 本地运行与交接指南

为个人开发者和内容运营执行者准备的本地工作台，把研究、内容制作、审稿、发布和反馈的资料、分工与交接放在一起。无需安装 Codex，也无需登录 ChatGPT 或原来的 Sites 页面。

**当前可用：** 五步工作流、44 项任务、28 项复用资源、模块与任务编辑、执行记录、任务包导出、SQLite 保存和备份恢复。

**下一阶段：** 接入现有 Claude／Codex 账号，生成可编辑的中英文文章，按项目 skill 修订，导出 Launch kit／Launch copy，再接入真实发布和反馈采集。这些自动执行能力尚未实现；当前“复制任务”用于交接，不会启动 Agent。

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

也可以在文件管理器中双击 **[启动工作台.cmd](https://github.com/agtai/launch-loop/blob/main/启动工作台.cmd)**。启动成功后浏览器自动打开：

**[http://127.0.0.1:4318](http://127.0.0.1:4318)**

看到五步工作流页面后，在“全部工作与分工”保存一条记录，再刷新页面，记录应仍保留。首次启动会自动在 `data/` 创建本地数据库，不需要配置账号、密钥或数据库服务。

仓库保留了构建好的 `dist/`，**只使用工作台不需要运行 `npm install` 或 `npm ci`**。Git 克隆不包含 `runtime/node.exe`；请按上面的步骤安装 Node.js。已有完整便携包或自行放入的 `runtime/node.exe` 也可由启动器使用。

结束时双击 **[停止工作台.cmd](https://github.com/agtai/launch-loop/blob/main/停止工作台.cmd)**，或执行：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Stop-Workbench.ps1
```

关闭浏览器不会停止后台服务。重复启动同一个目录会打开已运行的工作台；记录和备份不会因停止服务而删除。

## 日常使用

| 页面 | 用法 |
|---|---|
| 五步工作流 | 补充每个模块的输入、步骤、工具、交付物与验收条件 |
| 全部工作与分工 | 从 44 项任务中选一项，填写负责人、状态、执行记录及成果链接；复制任务包交给其他人或 Agent |
| 竞品与复用库 | 检索 16 个产品和 12 项 skills／现有能力，查看复用对象、方法、理由、来源及能力边界 |
| 架构与取舍 | 查看哪些直接复用、哪些由工作台管理，以及后续自动化的接入位置 |
| 使用与交接 | 下载操作指南、完整调研、工作清单和文案试跑样例 |

建议第一次只完成一项任务：读取输入 → 执行步骤 → 保存结果 → 按验收条件更新状态。任务状态由执行者记录，不是自动执行结果。

本地资料和台账可以离线使用。外部来源、在线 Agent 和发布工具需要网络；其账号权限、用量与费用由相应服务决定。本工作台本身不调用付费模型，也不使用 Sites 托管额度。

供应商研究属于官方文档核查，不代表已连接账号或登录商业产品试用。完整事实、来源和未验证项见 [竞品与复用调研](https://github.com/agtai/launch-loop/blob/main/docs/完整竞品与复用调研.md)。

## 备份与交接

- **保存位置：** `data/workbench.sqlite` 存放模块内容、负责人、状态和执行记录。`data/` 不进入 Git；克隆仓库不会带走维护者的运营数据。
- **换电脑或交给下一位执行者：** 在页面点击“备份数据”，得到 JSON；对方启动自己的工作台后选择“恢复备份”，核对预览再确认。
- **备份范围：** JSON 包含模块和任务记录，不包含应用源码、研究资源正文、Word 文档或成果链接指向的素材。素材文件需另行交接；仓库资料随仓库提供。
- **自动快照：** 每天首次修改前保留一份快照，最近 30 份；每次恢复前另存快照，最近 20 份，均位于 `data/backups/`。
- **恢复要求：** 当前备份格式为版本 1，含完整 5 个模块与 44 项任务，最大 16 MiB。校验失败不会替换现有数据。
- **任务交接包：** “导出交接包”生成包含当前分工、记录和验收条件的 Markdown，适合交给人或 Agent。它不能代替可恢复的 JSON 备份。

不要在服务运行时只复制 SQLite 主文件。优先使用页面 JSON 导出；需要完整复制运行数据时，先停止服务，再复制整个 `data/` 文件夹。

多个页面修改同一条记录时，旧版本保存会被拒绝，可先下载当前草稿，再载入最新记录合并。多位执行者通过任务包和成果文件交接，由维护者汇总；当前不提供多台电脑实时同步。服务仅监听本机 `127.0.0.1`。

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
| `data-seed/` | 新数据库的初始模块与任务 ID |
| `public/docs/` → `dist/docs/` | 页面可下载的指南、调研和清单；构建时复制 |
| `dist/` | 已构建页面，供克隆后直接启动 |
| `tests/` | 保存、恢复、版本冲突、请求边界及启动器测试 |
| `docs/`、`research/` | 需求、方案、验证记录、竞品与 skills 调研 |
| `docs/references/` | 用户提供的两份 Word、项目 skill、原始笔记及来源说明 |
| `data/`、`node_modules/` | 本地运营数据和开发依赖，均不进入 Git |

## 在新会话中继续项目

新执行者或 Agent 直接以此仓库为工作目录，无需查找旧聊天或原电脑的 Downloads 文件夹。

按此顺序阅读：

1. [会话交接](https://github.com/agtai/launch-loop/blob/main/docs/SESSION_HANDOFF.md)：已完成事项、关键决定、当前状态与下一步。
2. [Agent 工作约定](https://github.com/agtai/launch-loop/blob/main/AGENTS.md)：继续工作时需遵守的项目边界和验证方式。
3. [内容生产与发布需求](https://github.com/agtai/launch-loop/blob/main/docs/内容生产与发布需求.md)：完整双语内容、编辑迭代、真实执行与验收目标。
4. [用户参考资料](https://github.com/agtai/launch-loop/blob/main/docs/references/README.md)：[Launch kit](https://github.com/agtai/launch-loop/blob/main/docs/references/launch-kit.docx)、[Launch copy](https://github.com/agtai/launch-loop/blob/main/docs/references/launch-copy.docx)、[s1a-launch-kit skill](https://github.com/agtai/launch-loop/blob/main/docs/references/s1a-launch-kit/SKILL.md) 及其分析。
5. [全部工作与复用清单](https://github.com/agtai/launch-loop/blob/main/docs/全部工作与复用清单.md)、[完整调研](https://github.com/agtai/launch-loop/blob/main/docs/完整竞品与复用调研.md)、[流程试跑样例](https://github.com/agtai/launch-loop/blob/main/docs/流程试跑样例.md)。

可把下面这段作为新会话的起点：

> 请先读取 AGENTS.md、docs/SESSION_HANDOFF.md 和 docs/内容生产与发布需求.md，核对代码现状后继续 launch-loop。保留已完成的本地工作台，优先复用现有 Claude／Codex 账号与 docs/references 中的项目 skill。下一阶段围绕真实中英文内容的生成、阅读编辑、修订和导出展开；不要把未接入的发布或反馈能力描述为已经完成。

其他接入依据：[LinkedIn 发布与反馈核查](https://github.com/agtai/launch-loop/blob/main/docs/LinkedIn发布与反馈接入核查.md)。历史验证见 [验证记录](https://github.com/agtai/launch-loop/blob/main/docs/验证记录.md)，本次迁移范围见 [迁移记录](https://github.com/agtai/launch-loop/blob/main/docs/MIGRATION.md)。

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

第三方依赖声明见 [THIRD-PARTY-NOTICES.md](https://github.com/agtai/launch-loop/blob/main/THIRD-PARTY-NOTICES.md)；参考材料的来源与使用边界见 [资料索引](https://github.com/agtai/launch-loop/blob/main/docs/references/README.md)。

本指南由仓库 README 同步而来。离线时可在本地仓库按同名路径阅读；线上资料链接指向 GitHub main 分支。
