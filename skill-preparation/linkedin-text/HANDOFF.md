# 内容创作 skill 深化交接

2026-09-24。独立任务，候选尚未接入生产。统一入口：[SKILL.md](SKILL.md)。用户追加授权将本批成果整理为一个本地commit，范围仅本目录与 `docs/SESSION_HANDOFF.md`；真实试稿和执行工件继续留在被忽略的tmp。本轮不继续123开发，不修改src、server、生产rules、依赖或执行配置，不push、合并或发布。

## 工作区身份

- 基线：`53b1dc97793371e5f24e84b772a10258695499e6`。
- 分支：`codex/skill-deepening-linkedin`。
- 创建时绝对路径：`C:\Users\admin\Desktop\workspace\launch-loop-skill-deepening-linkedin`。这只是本次位置记录，不是后续命令／链接依赖；所有入口相对仓库根。
- 使用 Git worktree 从已提交基线创建，未复制或更改原工作区未提交内容。当前分支规则状态不能代表并行原工作区的123状态。

## 交付导航

| 入口 | 内容 |
|---|---|
| [SKILL.md](SKILL.md) | 统一执行路由、tmp边界与阶段流程 |
| [rules/core.md](rules/core.md)、[rules/linkedin.md](rules/linkedin.md)、[rules/localization.md](rules/localization.md) | 共同母稿、平台改写、自然且保真的本地化 |
| [rules/audit-revision.md](rules/audit-revision.md)、[editing-protocol.md](editing-protocol.md) | 每稿一次审核、统一修订与用户后续改稿协议 |
| [rules/assets.md](rules/assets.md)、[rules/author-system1.md](rules/author-system1.md) | 配图brief/图文一致，以及仅该产品适用的作者规则 |
| [sources.md](sources.md)、[localization-sources.md](localization-sources.md)、[author-reference.md](author-reference.md) | 逐来源版本、许可、实读范围、采用舍弃；用户原件单独提炼表 |
| [option-mapping.md](option-mapping.md)、[contracts.md](contracts.md)、[scripts/compile.mjs](scripts/compile.mjs) | 固定映射、合并冲突、工件追溯与可运行编译器 |
| [validation.md](validation.md)、[tests](tests/contracts.test.mjs) | 本次实测、合成案例、确定性检查及未验证项 |
| [integration.md](integration.md) | 基于基线的最小接入位置，不替代123真实验收 |

## 接手边界

用户追加的 [质量标杆](quality-target.md) 为初稿达到launch-kit、审核修订后达到launch-copy对应内容的成熟度，不要求复刻、不增加hardcode。已实际补强内容判断、解释关系和单次编辑审核，并做两轮真实校准。最新英文样稿达到同目的对应机制说明的可比水准；尚未证明稳定达标或一次审核稳定补齐所有编辑缺口，不能以零发现代替质量结论。

真实资料派生工件只在本worktree的 `tmp/skill-deepening/`；克隆或合并不会带走这些试稿。不得为留证把正文、提示、审核或素材复制进永久文档或正式执行日志。候选仍未确认保存；原参考和生产规则保持原样。

交付状态：规则包为 `linkedin-text-candidate.0.2.1`。首轮0.1.0/旧规则对照和局部改稿证据保留在 `tmp/skill-deepening/TRIAL_REVIEW.md`，不改标版本。新增质量校准完成37次成功CLI调用：两个版本的真实产品双语链路、三个不同题材/目的的双语合成留出、一个独立既有稿审核修订挑战。仍使用gpt-6-astra/xhigh；两次母稿超时保留记录，提示相同重试后完成。

本轮阅读入口为 `tmp/skill-deepening/quality-round/LATEST.md`（最新双语候选）、`READING.md`（全部初稿/审核/修订）和 `assessment.md`（质量判断）；追溯在 `checks.json`、`attempt-checks.json`。最新真实稿601/1227字符，两语均0发现、原样保留；初稿质量提升不能归功于事后修订。独立挑战确实修复了两项编辑问题，但自然生成后的审稿仍有漏掉细微阅读障碍的案例。所有结果仅tmp，未确认保存。

本轮重新执行npm ci/build/76项原有测试，全部通过；最终候选10项检查和受限静态核验通过。skill-creator原校验器因运行时缺PyYAML未跑通，替代检查范围见验证记录。没有生产HTTP创作闭环、实际配图或发布验收，也未执行用户接受修改或确认保存。候选新增内部editorialPlan/readerTakeaway/editorialAssessment的接入差异已写入integration，不增加用户字段；真实母稿耗时曾超过基线300秒，需在生产接入时验证预算与失败恢复。

运行验证和有限模型调用的准确完成状态见 [validation.md](validation.md)。任务分工为主Agent统一规则、映射、CLI试验和整合；三个子Agent分别来源/平台、用户参考、语言/审核/改稿，后续执行少量独立合成前向验证。没有新建用户任务、全局安装或配置改动。

仍需用户决定：中文固定标题候选；作者锁定语句中证据不足内容的取舍；全局预设、CTA交互；跨语言影响与同步方式、差异接受/拒绝/撤回粒度、tmp保留清理。已明确的事实保真、单次审核、选区外保留、确认保存与发布分离不待再次批准。
