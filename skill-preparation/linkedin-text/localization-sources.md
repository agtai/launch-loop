# 本地化、保真与改稿来源核查

核查日期：2026-09-24。状态：候选规则研究和正文实读；未安装、运行或全量移植外部技能。规则版本：`linkedin-text-candidate.0.2.1`。本文件只记录来源及规则取舍，不保存真实用户资料衍生的正文、提示或审核发现。

## 来源一：本机 shuorenhua

作者信息／许可：本机文件没有作者、版本或许可证声明；不能推断 MIT 等许可。按用户授权分析其规则，未复制完整技能或修改全局安装。下列位置是来源身份描述，不是接手者运行时依赖；候选执行已将必要规则自成一体，不要求目标机器有全局 shuorenhua。

实读范围：`shuorenhua/SKILL.md`、`references/editing-guide.md`、`references/examples.md` 全文。首次位置由用户指定；交接只使用逻辑文件名与 hash，避免固定个人绝对路径。

| 文件 | SHA-256（2026-09-24 实际读取） |
|---|---|
| `SKILL.md` | `8096fc698ab76dca0041ce124ca1dedf22889619b8995191523c8d8db30c1b98` |
| `references/editing-guide.md` | `c4ce2a4b43f967fc18f688b486908751563c0503263a28ea7a5b65bfe04d94b6` |
| `references/examples.md` | `ef6c9e19edd8f0addf6a95335adab1a0f6344bbebdc3f15981fd4182b0e6c29c` |

| 原规则要点 | 本候选处理 | 依据类型 |
|---|---|---|
| 保留条件、否定作用域、情态、进度、比较和责任归属 | 本地化与所有修订的强约束；整理为逐项语义保护表 | 本机编辑经验 + 本项目明确取舍 |
| 最小必要改动；选区外逐字保留；不顺手改格式 | 直接用于候选替换和边界校验；标题、链接、素材关系也要保留 | 用户已确定要求 + 编辑经验 |
| 缺来源不等于虚假；不删除归属而留下裸论断 | 审核指出缺口；措辞编辑不越权删观点，生成阶段是否采用事实由来源核对决定 | 编辑经验；与创作阶段分开 |
| 技术字面量、引文用途、个人语气及合理重复要保护 | 内部术语表和 quote 用途说明；不强制主动语态，不编个人经历 | 编辑经验 + 作者偏好保护 |
| 默认只交正文，不附检查链或评分 | 正文维持干净；项目要求的审核发现、resolved/unresolved 单独输出到 tmp | 项目产品流程优先于独立编辑技能的默认输出 |
| 中文约千字长文保留结构；多档编辑 scope | 不把长文阈值套入本轮 feed；采用显式选区和最小必要修改，不扩展用户表单 | 范围约束，长文不在本轮 |

本候选规则为独立归纳，不复刻来源示例；文件中的例句均明确标为本轮合成。

## 来源二：宝玉 baoyu-translate

发现页：[skills.sh / jimliu / baoyu-translate](https://skills.sh/jimliu/baoyu-skills/baoyu-translate)。该页只用于定位，排名、安装量、自动安全标签不作为质量证据。上游为 [JimLiu/baoyu-skills](https://github.com/JimLiu/baoyu-skills)，作者／版权主体为 Jim Liu（宝玉）；同名收录页和镜像不另算来源。

版本：固定仓库 commit [`1567581c26ec29f4216c6e6835415bf30343b0e3`](https://github.com/JimLiu/baoyu-skills/commit/1567581c26ec29f4216c6e6835415bf30343b0e3)，GitHub 返回提交日期 `2026-09-10T15:13:43Z`。这是本次读取的仓库快照，不声称此日是本技能首次发布。`SKILL.md` metadata 版本 `1.117.3`。web 工具访问 GitHub API commit 地址失败，改用只读 HTTPS GitHub REST 取得 SHA，再通过 Contents API 按该 SHA 读取正文；并非拿搜索摘要冒充实读。

许可：同 commit 的 [LICENSE](https://github.com/JimLiu/baoyu-skills/blob/1567581c26ec29f4216c6e6835415bf30343b0e3/LICENSE) 为 MIT，Copyright (c) 2026 Jim Liu。实读文件及字节 SHA-256 如下：

| 已全文实读的固定文件 | SHA-256 |
|---|---|
| [SKILL.md](https://github.com/JimLiu/baoyu-skills/blob/1567581c26ec29f4216c6e6835415bf30343b0e3/skills/baoyu-translate/SKILL.md) | `772f7170a61f1246d7505c97539579bb4d055f21653462e8cfaaddc65a3a5b31` |
| [references/refined-workflow.md](https://github.com/JimLiu/baoyu-skills/blob/1567581c26ec29f4216c6e6835415bf30343b0e3/skills/baoyu-translate/references/refined-workflow.md) | `146d074b59f42a68578a9e62afaa68507598e58b09a51ac3db486245a3239550` |
| [references/glossary-en-zh.md](https://github.com/JimLiu/baoyu-skills/blob/1567581c26ec29f4216c6e6835415bf30343b0e3/skills/baoyu-translate/references/glossary-en-zh.md) | `3e74ef5c6bcbd6f62bc91445000f5485d613ca4f13cab647f6ce450a796a5033` |
| [LICENSE](https://github.com/JimLiu/baoyu-skills/blob/1567581c26ec29f4216c6e6835415bf30343b0e3/LICENSE) | `601839401f6ce68b7a8aec0f7ba247ab8ef0848113378220bec4b2615cc84ee7` |

没有运行 npx、bun、chunk 脚本、首次设置或保存偏好；没有读取／执行其账号相关技能。未实读的配置、脚本、其他技能不列入采用证据。`workflow-mechanics.md` 曾通过网页浏览其移动分支内容，仅用于识别默认写入冲突，不作为固定规则实读证据。

| 来源要点 | 采用与改造 | 舍弃部分及原因 |
|---|---|---|
| 翻译前理解全文、作者、目的、读者、术语及文化困难 | 在母稿和平台稿共享上下文上本地化，不另起策划 | 不新增首次设置或必填表单；输入已由工作台决定 |
| 准确与自然表达同时要求 | 保留事实和逻辑，允许必要的句序调整 | 不把“像母语原创”解释为补卖点、故事或事实 |
| 统一术语和共享词表 | 用本次 `termLedger` 统一概念、锁定名称并标冲突 | 不直接把词表如 Agent、Vibe Coding、Grounding 译法定为全部产品强制术语；上下文与作者定义优先 |
| 对照原文检查准确、语气、译注 | 提炼进每份平台 × 语言的一次审核清单 | 不执行译稿独立 review→revision→polish 或额外跨块总审；不得增加轮次 |
| 图片文字语言可能与译稿不一致 | 记录上传图语言和 brief 的本地化需求 | 不自动翻译图片、不声称已生成或完成图片本地化 |
| 默认中文、storytelling、模式自动识别 | 不采用；使用用户所选语言、资料和作者表达 | 母稿不硬编码中文优先，UI 语言不决定稿件语言 |
| 输出至原材料旁目录，保留各步文件 | 保留可追溯分阶段思想 | 真实派生物全部在隔离 tmp；不在来源旁建输出，不改名旧材料 |
| 分块脚本、自动 subagent、强制首次偏好文件 | 不采用运行机制 | 本轮是 feed，禁止安装和全局配置修改；主流程已固定 |

以上是社区创作经验，经本项目约束整理；不是 LinkedIn 官方规则，也不是发布或翻译效果认证。候选文本为自行归纳，未复制第三方完整技能或大段表达；若未来实际分发其脚本／实质文本，需另保留 MIT 许可文本和版权声明。

## 与第一轮及现有实现的关系

[第一轮规则整理](../../docs/第一轮文本规则整理.md)已经读取 shuorenhua 的主文件与 editing-guide；本轮重读、增加 examples 并固定本次 hash，以支持更精确的跨语言保真和局部范围协议。宝玉上游是本轮填补的翻译本地化来源，不把镜像收录当多个新增技能。

审核原则还承接第一轮已整合的事实、目的、语气与平台检查。当前执行器每语言独立生成 → 一次审核 → 修订；本候选将本地化置于共享母稿和平台稿之后，并要求全部初稿冻结、每份一次审核、集合齐后统一修订。差异是未来编排契约，不表示现有服务已改造。

具体采用结果见[本地化规则](rules/localization.md)、[一次审核与修订](rules/audit-revision.md)和[改稿协议](editing-protocol.md)。本来源核查不等于真实试稿、后台集成、用户确认保存或线上发布验收。
