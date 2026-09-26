---
name: marketing-copy-team
description: |
  4 阶段 C 模式营销文案流水线：Brief Strategist → Copywriter → Copy Editor → Conversion Auditor；未通过关卡时回退而非前进。
  用于撰写落地页、产品页、定价页、广告或邮件序列开场白等营销文案。
  不要用于长篇博客（请用 seo-growth-team）、社交媒体帖子（请用 social-content-team）或内部沟通。
version: "0.1"

kind: team-skill

roles:
  - id: brief-strategist
    purpose: "阶段 1 —— 提炼定位、受众、主要 CTA、产品卖点、客户原声样本、支撑证据。产出结构化 brief 供 copywriter 使用……"
    count: 1
    skills: [content-strategy, copywriting]
    tools: []
  - id: copywriter
    purpose: "阶段 2 —— 产出草稿（hook + headline + sub-headline + body + CTA）。声音 = brief 中的客户原声样本。具体优于……"
    count: 1
    skills: [copywriting]
    tools: []
  - id: copy-editor
    purpose: "阶段 3 —— 执行 7 轮打磨（清晰 / 简洁 / 具体 / 声音 / 节奏 / 说服 / 精修）。"
    count: 1
    skills: [copy-editing]
    tools: []
  - id: conversion-auditor
    purpose: "阶段 4 —— 发布前转化检查。CTA 强度 / 摩擦地图 / 支撑证据 / 移动端可读性 / 签发结论。"
    count: 1
    skills: [conversion-optimization, copywriting]
    tools: []

---

# Marketing Copy Team

一个 4 阶段团队，专门解决单智能体文案最可预见的失败模式：文案作者要么 (a) 跳过策略直接产出空泛通用的文案，要么 (b) 做了策略却从未把它转化为可上线、已压测过摩擦点的文案。本团队通过**阶段间严格的关卡**强制保证质量 ——
未通过 brief 保真度检查的草稿会回退到阶段 2，而不是前进到阶段 3。

## Workflow

本 Teamskill 以**C 模式顺序流水线**运行，**阶段之间设有关卡**。每个阶段在交接前锁定其产出；下游阶段不能改写上游的实质内容。

0. **飞行前检查：依赖项确认** —— 阅读 [dependencies.yaml](dependencies.yaml) 并验证。
   报告缺失项：`required: true` = 没有它很可能失败；`required: false` = 功能降级但仍可运行。**由用户决定**是否继续。
   若所有 skill 均缺失，团队可以纯 inline-persona 模式运行。

1. **Leader 提取 intake** —— 页面类型（landing / product / pricing / about / ad / email
   open）+ 产品/offer + 受众 + 字数目标 + 品牌语境（如有）。

2. **阶段 1：brief-strategist** —— 产出结构化 brief：定位 / 受众痛点与语言 / 主要行动 / offer 与差异化 / 支撑证据 / 需处理的异议。
   **Brief Gate**：brief 完整（所有必填字段）、客户原声样本齐全、主要行动单一且具体。

3. **阶段 2：copywriter** —— 根据 brief 产出草稿（hook / headline / sub-headline / body / CTA）。
   具体 > 空泛，收益 > 功能，每节一个核心观点，客户声音优先。**Draft Gate**：与 brief 定位一致，声音贴近客户语言，主要行动即 CTA，字数在目标 ±20% 以内。

4. **阶段 3：copy-editor** —— 执行 7 轮打磨（清晰 / 简洁 / 具体 / 声音 / 节奏 / 说服 / 精修）。保留核心信息；仅强化呈现。**Edit Gate**：变更日志齐备、未引入新主张、声音与定位得到保留。

5. **阶段 4：conversion-auditor** —— CTA 强度 / 摩擦地图 / 支撑证据 / 移动端可读性 / **GO / GO-WITH-FIXES / NO-GO** 签发结论。

6. **Leader 输出最终报告**：优化后的文案 + brief + 变更日志 + 转化审计结论 + 立即执行项清单（若为 GO-WITH-FIXES）。

## Roles

| id | 阶段 | 职责 | 输入 | 输出 | 角色文件 |
|---|---|---|---|---|---|
| brief-strategist | 1 | 定位 / 受众 / offer / 客户原声 / 证据 | 用户 intake | 结构化 brief | 阅读 [roles/brief-strategist.md](roles/brief-strategist.md) |
| copywriter | 2 | Hook + headline + body + CTA 草稿 | Brief | 文案草稿 | 阅读 [roles/copywriter.md](roles/copywriter.md) |
| copy-editor | 3 | 7 轮精修 | 草稿 | 编辑后文案 + 变更日志 | 阅读 [roles/copy-editor.md](roles/copy-editor.md) |
| conversion-auditor | 4 | 发布前转化检查 + 签发 | 编辑后文案 + brief | 审计结论 + GO/GO-WITH-FIXES/NO-GO | 阅读 [roles/conversion-auditor.md](roles/conversion-auditor.md) |

> 在派发每位队员前，阅读对应的角色文件，提取其
> `## Inline Persona for Teammate` 段落 —— 原样粘贴进 Task prompt。

## Files

| 文件 | 包含内容 | 何时阅读 |
|---|---|---|
| [workflow.md](workflow.md) | Mermaid + 各阶段交接契约 + 4 个关卡 + 最终报告格式 | 首次派发前 |
| [bind.md](bind.md) | 资源限制、关卡强制规则、降级模式、"不改写上游"规则 | 触达限额 / 处理失败时 |
| [roles/\*.md](roles/) | 每个角色的身份、成功标准、输出 schema、Inline Persona | 派发每位队员前 |
| [dependencies.yaml](dependencies.yaml) | 该团队所引用的外部社区营销 skill 血缘 | **启动时** —— 验证、报告，由用户决定 |
