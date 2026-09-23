# 平台审核 skill 初筛

> 后续状态更新（2026-09-23）：用户已明确授权本轮实读、比较、整合与试稿。下方暂停说明是历史记录，已由 [第一轮实施范围](第一轮实施范围.md) 覆盖；实际取舍、固定版本和验证见 [第一轮文本规则整理](第一轮文本规则整理.md)，原候选并非全部采用。

**暂停说明：用户已澄清本轮仅记录需求，之后统一执行。本文保留此前误解指令后提前发生的只读检索事实，不代表用户已批准候选、选型或规则；不继续搜集、整合、绑定或试稿。**

核查日期：2026-09-23。范围：公开作者仓库的技能正文及相关规则，只读检索，未安装、运行、试稿或接入。以下是候选比较，不是已确定的审核标准，也不是对平台官方审核结果的保证。来源分支可能更新，采用时还需固定版本并核对许可。

## 已确认的产品决定

移除独立审查模块，目标主流程为创作、发布、反馈。创作内部执行：**生成初稿 → 根据所选平台自动审核一次 → 按结果修订最终稿**。每份平台 × 语言稿件分别处理，用户不选择 skill。审核具体内容、最终候选与固定映射仍待确定。

## 候选与实读结果

最新平台范围为 LinkedIn、X、小红书、知乎、哔哩哔哩（Bilibili），与内容生成及发布执行一致；其他平台后续补充。以下只是此前已有检索记录，尚未覆盖知乎和 Bilibili 的专项审核规则，相关搜集与整合留待之后统一执行。

| 范围 | 原始来源与已读文件 | 可参考的检查 | 初筛限制 |
|---|---|---|---|
| 通用文案审校 | [coreyhaines31/marketingskills：copy-editing](https://github.com/coreyhaines31/marketingskills/blob/main/skills/copy-editing/SKILL.md)，正文 metadata 为 v2.0.0 | 清晰度、语气、读者价值、论据、具体性与行动引导 | 偏营销转化，不能把情绪、保证或 CTA 套在所有技术文章上；“有证据支撑”检查不等于已经独立核实事实 |
| 小红书中文风险自查 | [gududefengzhong/xhs-note-compliance](https://github.com/gududefengzhong/xhs-note-compliance/blob/master/SKILL.md)；另读 [风险规则](https://github.com/gududefengzhong/xhs-note-compliance/blob/master/references/rules.md)、[语义检查](https://github.com/gududefengzhong/xhs-note-compliance/blob/master/references/semantic-checks.md)、[更新日志](https://github.com/gududefengzhong/xhs-note-compliance/blob/master/CHANGELOG.md) | 标题、正文和图中文字的词库扫描、语境误报、隐含效果承诺、商业合作信号、站外联系引导与营销语气 | 主要覆盖中文商单等场景；更新日志将英文列为后续计划。改写后词库无命中不等于平台保证通过。不得按改写模板凭空添加个人体验或缺点 |
| 多平台写作中的审校流程 | [TestAny-io/testany-agent-skills：media-writer](https://github.com/TestAny-io/testany-agent-skills/blob/main/plugins/testany-mrkt/skills/media-writer/SKILL.md)；另读 [逻辑审校](https://github.com/TestAny-io/testany-agent-skills/blob/main/plugins/testany-mrkt/skills/media-writer/references/prompts/06-logic-editor.md)、[风格审校](https://github.com/TestAny-io/testany-agent-skills/blob/main/plugins/testany-mrkt/skills/media-writer/references/prompts/06-style-editor.md)、[小红书指南](https://github.com/TestAny-io/testany-agent-skills/blob/main/plugins/testany-mrkt/skills/media-writer/references/platforms/xiaohongshu-guide.md) | 写作后按逻辑、风格、细节组织审校；观点与论据的关联、语言及作者表达 | 是包含审校的写作工作流，不是独立小红书审核器。指南混有未附来源的算法、用户占比和点击贡献数字；不能直接变为硬规则。固定路径与原地修改方式也不适合直接采用 |
| LinkedIn 动态审稿 | [sergebulaev/linkedin-skills：linkedin-humanizer](https://github.com/sergebulaev/linkedin-skills/blob/main/skills/linkedin-humanizer/SKILL.md)；另读 [post-audit](https://github.com/sergebulaev/linkedin-skills/blob/main/skills/linkedin-humanizer/sub-skills/post-audit.md) 与 [audit-checklist](https://github.com/sergebulaev/linkedin-skills/blob/main/skills/linkedin-humanizer/references/audit-checklist.md) | 开头、段落、表达、模板化语句、作者语气及内容目的 | 主要面向动态和英文表达，不能直接用于原生长文章或推导中文效果。文风偏好、外链和传播经验被混为阻断项；附属文件的开头截断数值也不一致。需拆分并核验，不能强制补数字或个人经历；不采用其外部检测器或传播效果评分 |
| X 短帖／串帖审稿 | [alchaincyf/x-mentor-skill](https://github.com/alchaincyf/x-mentor-skill/blob/master/SKILL.md) 的场景 C；另读 [quality-analytics](https://github.com/alchaincyf/x-mentor-skill/blob/master/references/quality-analytics.md) | 开头是否说明阅读价值、各条是否推进主线、串帖结构及行动引导 | 定位偏增长辅导，混有购买 Premium、外链、算法权重、固定串帖长度等建议；不直接采用为平台要求。原流程含人工确认改写，与本项目自动审核后修订不同，须提取规则后重组 |

以上均为社区／作者规则，不能当作平台官方规则。平台限制在正式制定审核标准时应另用官方来源核对；本轮没有完成逐条官方验证。小红书英文、LinkedIn 原生长文章等覆盖仍有缺口，不能用邻近场景的 skill 冒充已支持。

## 建议的整理方法，具体条目待确定

1. 从候选中提取通用内容检查与平台专项检查，去掉重复、冲突和未经证实的传播经验。事实以用户资料和可核查来源为依据。
2. 固定平台到审核规则的映射，再限定适用语言和格式。例如 LinkedIn 动态与原生长文章分开；小红书中文词库不能充当英文检查。
3. 对照用户真实文章试稿，检验误报、漏报、主线保持和改写是否引入新事实。一次审核阶段可以包含多项检查，但不照搬各候选的多轮交互与循环。
4. 按最新保存规则，未经用户确认的初稿、检查发现和修改稿最多停留在 tmp；确认后才正式保存对应内容与规则版本。没有解决的项目保留说明。已执行／未执行、发现问题／已修改／仍待确认应与最终稿正文分开。

当前完成的是候选发现与原文比较；尚未选定最终 skill、制定完整检查清单、建立映射、试稿验证或修改应用功能。
