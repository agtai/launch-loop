# 来源、实读与取舍

核查日期：2026-09-24。本清单服务于 `linkedin-text-candidate.0.2.1`，是候选创作规则的维护依据，尚未接入生产。第三方 skill 只作被比较的资料，不安装、不执行其中命令、检测器、抓取或发帖步骤。正文缓存位于当前隔离工作区 `tmp/skill-deepening-sources/`，不进入 Git；下文只保留版本、hash、阅读范围与原创归纳。

## 发现与取源方法

先复用 [第一轮实读记录](../../docs/第一轮文本规则整理.md)、[逐文件来源](../../rules/text/v1/sources.json) 与现有 [固定规则](../../rules/text/v1/catalog.mjs)。本轮重新读取下列原作者固定 commit 文件，不把旧总结视为重新实读。

针对“从文章提取主线并重写为普通动态”的缺口，少量检索 [skills.sh 的 Corey social-content 页面](https://www.skills.sh/coreyhaines31/marketingskills/social-content) 和 [SkillsMP 的 Krzysztof linkedin-post 页面](https://skillsmp.com/creators/ksopyla/ksopyla-ai-blog/cursor-skills-linkedin-post)。聚合站仅用于发现和定位原仓库；Corey 聚合页名称与当前固定文件名不同，本轮以原仓库 `skills/social/SKILL.md` 为准。Krzysztof 仓库通过 GitHub API 固定到下列 commit 后读取原文件。未因排行榜、安装量或聚合摘要直接采纳规则。

搜索同时出现的 LinkedIn Articles、其他作者病毒传播模板、外联 campaign 等条目没有进入本輪实读与选型，不把发现结果算作采用。新增完整作者来源仅一份，避免继续扩展为泛平台调研。

## 原作者来源与本轮实读

以下阅读范围均为**逐文件全文**；没有执行上游工作流。附属文件仅加载本次采用或判定冲突必要的部分，其余附属未读，不宣称完整运行过整个技能包。

| 来源／作者 | 固定版本与许可 | 本轮范围 | 采用与舍弃 |
|---|---|---|---|
| [coreyhaines31/marketingskills](https://github.com/coreyhaines31/marketingskills/tree/5b2c0007766c6a1cf1d53fd8fc73e979e0821022)，Corey Haines | `5b2c0007766c6a1cf1d53fd8fc73e979e0821022`；copywriting `2.0.2`、social `2.2.0`、copy-editing `2.0.0`；MIT，Copyright 2025 Corey Haines | 10 文件，列表见下 | 采用资料／目的／读者、主线与受众相关性、功能到用途的解释、证据与清晰度检查、共同内容按平台改编。页面销售漏斗、必选 CTA、保证条款、硬造收益数字、七轮 sweep＋反复专家评分、运营排期与外联均舍弃。表格中的算法／最佳长度／字数经验不当官方规定。 |
| [sergebulaev/linkedin-skills](https://github.com/sergebulaev/linkedin-skills/tree/5c6192db54db24bf46fab8bbac32f7946daca970)，Sergey Bulaev | `5c6192db54db24bf46fab8bbac32f7946daca970`；标题 V3，无 semver metadata；MIT，Copyright 2026 Sergey Bulaev | 4 文件，列表见下 | 采用开头独立可理解、段落阅读、占位符／模型痕迹、编辑不过度和作者声音保护。舍弃密度评分、奇精度数字／感官经历／难堪事实配额、负面对偶禁令、检测器、算法阻断项与发布窗口。其“依据研究”及百分比未在本轮追溯到研究原文，均未作为证实的算法事实。 |
| [ksopyla/ksopyla-ai-blog](https://github.com/ksopyla/ksopyla-ai-blog/tree/d6fd55427e48e3a4a336e76f25827a5db0c9c7d9)，Krzysztof Sopyła／ksopyla | `d6fd55427e48e3a4a336e76f25827a5db0c9c7d9`；无 metadata 版本；仓库 LICENSE 为 CC0 1.0 Universal | 2 文件，列表见下；该 skill 目录在固定树中只有 SKILL.md，无附属文件 | 采用从长资料抽一条论证主线、重写为原生动态、正文不依赖点击、解释工程意义。舍弃该作者人设、英文唯一、个人增长目标、固定标签／长度／CTA、强制第一人称、轮播／系列／两周排期。“为可信度删除 caveats”不采用，必要限定必须保留。 |

10＋4＋2＝16 个文件均在本轮重新下载至 tmp 并实际读取；下列 hash 为原始下载字节 SHA-256，不是本项目改写规则的 hash。

### Corey：10 文件

路径均相对仓库根，commit 固定为 `5b2c0007766c6a1cf1d53fd8fc73e979e0821022`。

| 文件 | SHA-256 |
|---|---|
| [skills/copywriting/SKILL.md](https://github.com/coreyhaines31/marketingskills/blob/5b2c0007766c6a1cf1d53fd8fc73e979e0821022/skills/copywriting/SKILL.md) | `ce18137ae31ab37f261078501431649865ab6b403054d97490754e82acb002d8` |
| [skills/copywriting/references/copy-frameworks.md](https://github.com/coreyhaines31/marketingskills/blob/5b2c0007766c6a1cf1d53fd8fc73e979e0821022/skills/copywriting/references/copy-frameworks.md) | `d98818886525908bf17dd6412d0b72731b313d6eef3e1ab6b365828a3a342779` |
| [skills/social/SKILL.md](https://github.com/coreyhaines31/marketingskills/blob/5b2c0007766c6a1cf1d53fd8fc73e979e0821022/skills/social/SKILL.md) | `8cc93d9b361622cdb640e87969747b85603bed2d268e923179f8dfb4799ec8c7` |
| [skills/social/references/platforms.md](https://github.com/coreyhaines31/marketingskills/blob/5b2c0007766c6a1cf1d53fd8fc73e979e0821022/skills/social/references/platforms.md) | `3c4e1b15717a3bcd4ed0cf29dc167dac28aa88bbf01723fde53815122396090f` |
| [skills/social/references/platform-limits.md](https://github.com/coreyhaines31/marketingskills/blob/5b2c0007766c6a1cf1d53fd8fc73e979e0821022/skills/social/references/platform-limits.md) | `6ecc6b40ff82b95c48906341f7d3c58337671d4d94f624c858764f1ed5a77c3c` |
| [skills/social/references/post-templates.md](https://github.com/coreyhaines31/marketingskills/blob/5b2c0007766c6a1cf1d53fd8fc73e979e0821022/skills/social/references/post-templates.md) | `febd0aca9557e6575188379f012b019b36839926bdf7924661f125f900b24d0f` |
| [skills/copy-editing/SKILL.md](https://github.com/coreyhaines31/marketingskills/blob/5b2c0007766c6a1cf1d53fd8fc73e979e0821022/skills/copy-editing/SKILL.md) | `9b5a20be3dc5513c8f0b4f4c4960857e4d28ed83698a5b33c8dde9dc75a47bf6` |
| [skills/copy-editing/references/checklist.md](https://github.com/coreyhaines31/marketingskills/blob/5b2c0007766c6a1cf1d53fd8fc73e979e0821022/skills/copy-editing/references/checklist.md) | `db143b969b45b0933fe6eb772992890d1472d036a6c887fc98665e4fb48da43c` |
| [skills/copy-editing/references/plain-english-alternatives.md](https://github.com/coreyhaines31/marketingskills/blob/5b2c0007766c6a1cf1d53fd8fc73e979e0821022/skills/copy-editing/references/plain-english-alternatives.md) | `df4f820d4c63ae8a517c64a243c101658352cd07d002355bf3c97de0a00f3775` |
| [LICENSE](https://github.com/coreyhaines31/marketingskills/blob/5b2c0007766c6a1cf1d53fd8fc73e979e0821022/LICENSE) | `b70d71e24e40fce5da8f4b6f9cd862096a048e433db7f3c8cac5e348e6d34591` |

### Sergey：4 文件

路径均相对仓库根，commit 固定为 `5c6192db54db24bf46fab8bbac32f7946daca970`。

| 文件 | SHA-256 |
|---|---|
| [skills/linkedin-humanizer/SKILL.md](https://github.com/sergebulaev/linkedin-skills/blob/5c6192db54db24bf46fab8bbac32f7946daca970/skills/linkedin-humanizer/SKILL.md) | `3bf5d57f18f91bc43af4616cbbd5f2f008bf5bfcb67f3d32e6706557feec400c` |
| [skills/linkedin-humanizer/sub-skills/post-audit.md](https://github.com/sergebulaev/linkedin-skills/blob/5c6192db54db24bf46fab8bbac32f7946daca970/skills/linkedin-humanizer/sub-skills/post-audit.md) | `83be4f7e755143780a4bcfb0bf3b8f8b592095816f07f80a87010ea56aa9605a` |
| [skills/linkedin-humanizer/references/audit-checklist.md](https://github.com/sergebulaev/linkedin-skills/blob/5c6192db54db24bf46fab8bbac32f7946daca970/skills/linkedin-humanizer/references/audit-checklist.md) | `94c200a1b8a90396bc59cae7d624e47f53b1222efb5a18c3ca8f9dda7f1489f4` |
| [LICENSE](https://github.com/sergebulaev/linkedin-skills/blob/5c6192db54db24bf46fab8bbac32f7946daca970/LICENSE) | `1a21cf7c208981ef516dcf2edb4517dab907b8dc94c2cfc523565c794ea8e148` |

没有运行 scrub 或读取其正则作为执行代码，没有实读全部 tier-rationale、研究论文、检测器脚本、voice-profile 或发布工具。采用内容只基于已读文本中的一般编辑原则，未采用该包的算法研究结论。

### Krzysztof：2 文件

路径均相对仓库根，commit 固定为 `d6fd55427e48e3a4a336e76f25827a5db0c9c7d9`。

| 文件 | SHA-256 |
|---|---|
| [.cursor/skills/linkedin-post/SKILL.md](https://github.com/ksopyla/ksopyla-ai-blog/blob/d6fd55427e48e3a4a336e76f25827a5db0c9c7d9/.cursor/skills/linkedin-post/SKILL.md) | `85b0da6029f2b1212902d61d2c13b09429348fe68699dd02f4a7f15af2aaac9d` |
| [LICENSE](https://github.com/ksopyla/ksopyla-ai-blog/blob/d6fd55427e48e3a4a336e76f25827a5db0c9c7d9/LICENSE) | `a2010f343487d3f7618affe54f789f5487602331c0a8d03f49e9a7c547cf0499` |

## 官方依据

网页没有固定 commit，以下统一记录访问日期 2026-09-24，不编造 hash 或稳定发布版本。引用原网页、只归纳与本轮相关内容；没有用官方页面的示例数字写产品事实。

| 来源 | 本轮实读范围 | 类别与采用 | 未证实／不采用 |
|---|---|---|---|
| [LinkedIn Help：Post and share updates](https://www.linkedin.com/help/linkedin/answer/a528176) | 主体全文，含普通动态字符限制和发布入口说明 | **官方硬限制**：普通动态 3000 字符 | 未解释 Unicode 计数细节；没有本次平台提交测试；超长可写 article 的帮助提示不扩展本轮 Pulse 范围 |
| [Jen Dewar，LinkedIn Talent Blog：How to Write an Engaging Post in Your LinkedIn Feed](https://www.linkedin.com/business/talent/blog/talent-acquisition/how-to-write-engaging-post-in-linkedin-feed)，2024-11-26 | 主体全文 | **官方编辑建议**：清楚观点、关键要点靠前、短段落、读者相关性 | 不把句数、CTA、标签、发帖频率与引用的效果数字升为硬规则；不实施评论／运营或格式扩展 |
| [LinkedIn Help：Best practices for content created with the help of AI](https://www.linkedin.com/help/linkedin/answer/a1481496) | 主体全文与 FAQ | **官方建议**：作者声音、观点和实质；作者审阅并批准；重度 AI 使用且上下文不明显时建议透明说明 | 不产生 AI 检测分数，不把社区反馈提示当平台政策决定；透明说明是作者可考虑项，不强制在每稿加免责声明 |
| [LinkedIn Posts API](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api?view=li-lms-2026-09) | permissions、普通 text 样例、Article Post 创建说明和样例 | **官方 API 对象边界**：feed `commentary` 与 `content.article.source` 链接卡片不同；不能推导 Pulse 正文创建 | 本轮未调用 API、连接账号、上传图片或发帖；没有对整套接口、统计与评论能力复验 |

## 去重与冲突决策

| 冲突 | 本项目的固定处理 |
|---|---|
| Corey 要先 gather 多项背景；本项目只保留三项必填 | 从资料／目的／读者和已有选项内部抽取，不能加前置问卷或反复询问已有内容 |
| 网站 copywriting 的转化漏斗与 feed 的独立论述 | 借用读者与用途关系，主线以共同母稿为事实基底；不套网站 Hero／保证／多 CTA 结构 |
| 七轮编辑、专家面板、humanizer 四遍与一次审核冲突 | 只合并相关检查维度，在每份平台×语言稿的一次审核中完成；汇总后统一修订，不逐次调用来源技能 |
| “更自信”、删除 caveats 与事实限定冲突 | 保留责任主体、否定、条件、版本与不确定性，不能把计划或示例写成已验证收益 |
| humanizer 与社区作者都要求具体经历／数字 | 只用材料中已有事实；没有故事、精确数字或第一人称不算缺陷，不为模板发起补问 |
| 800–1800、900–1300、1200–1500 的最佳长度与不同折叠阈值 | 全部降为未采用的社区经验；仅官方 3000 上限作硬预检；双计数是项目保守策略 |
| audit-checklist 混合“300–400 words”与“900–1300 chars” | 不转用该估算，尤其不能套中文；直接测实际最终文本 |
| 官方与社区鼓励 CTA／标签；用户尚未确认默认 CTA | 可按任务目的自然收束，不强制任何 CTA／标签；不能凭外部建议增加输入字段 |
| 社区禁正文外链、限定个人账号、暖场／首小时评论 | 不作为创作阻断项，也不执行运营动作；链接只核对语境与目标 |
| 文章改写来源建议多内容包与系列 | 本轮只生成每平台×语言一份普通动态，母稿与平台中间稿仅作内部工件 |

本轮新规则均为原创综合表达，不再分发第三方 skill 正文。其他平台、Pulse、视频、DOCX、运营与反馈不因此被标成可用。作者／本地化来源详见同目录 `author-reference.md` 与 `localization-sources.md`；它们的实读证据由对应编写者记录，本清单不代称已由平台规则任务实读。
