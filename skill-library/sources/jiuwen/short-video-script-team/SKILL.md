---
name: short-video-script-team
description: |
  3 阶段流水线（Hook 创作者 → 内容结构师 → CTA 优化师），生产专为留住观众直到行动而设计的短视频脚本。
  适用于为短视频（TikTok、Instagram Reels、YouTube Shorts 等）创作脚本，尤其是强力 Hook 和清晰 CTA 至关重要时。
  不适用于超过 3 分钟的长视频或播客脚本——请使用 podcast-episode-team。
version: "0.1"
kind: team-skill
roles:
  - id: hook-creator
    purpose: "创作能让视频停止滑动的开场 3 秒 Hook——整个脚本中最关键的 15 个字。"
    skills: []
    tools: []
  - id: content-structurer
    purpose: "构建中间段落：通过结构和注意力重置技巧掌控价值传递节奏，维持观众留存。"
    skills: []
    tools: []
  - id: cta-optimizer
    purpose: "创作结尾 CTA（行动号召），将刚看完视频的观众转化为关注者、点击者或购买者——与视频目标精准匹配。"
    skills: []
    tools: []
---

# 短视频脚本团队

一个 3 阶段流水线，从最关键的元素开始向外构建短视频脚本：先写 Hook，再构建内容结构，最后优化 CTA。单个 Agent 线性创作视频脚本（开头 → 内容 → 结尾），往往生产出在前 3 秒就丢失观众的弱 Hook。本流水线强制在写任何内容之前先打磨好能停止滑动的 Hook。

## 工作流程

0. **前置检查：验证依赖** — 读取 [dependencies.yaml](dependencies.yaml) 并核实。

1. **Leader 收集简报** — 视频主题、目标平台（TikTok / Reels / Shorts）、目标受众、视频目标（曝光/涨粉/点击/销售）、目标时长（15s / 30s / 60s），以及品牌风格备注。

2. **阶段 1 — hook-creator** 创作 3 个 Hook 选项（开场 3–5 秒），并附上各自的理由。Leader 选出最强的一个（或请用户选择）后，才进入阶段 2。

3. **阶段 2 — content-structurer** 接收已确定的 Hook，构建中间段脚本，包含节奏标记和注意力重置点。

4. **阶段 3 — cta-optimizer** 接收完整草稿脚本，改写/优化结尾 CTA，使其与视频目标精准匹配。

5. **最终：输出视频脚本包** — 完整脚本 + Hook 分析 + CTA 备选方案。

## 角色

| id | 职责 | 何时派发 | 输入 | 关键依赖 | 角色文件 |
|---|---|---|---|---|---|
| hook-creator | 3 个开场 3–5 秒 Hook 选项 | 阶段 1——始终最先 | 视频简报 | 无 | [roles/hook-creator.md](roles/hook-creator.md) |
| content-structurer | 带节奏标记和留存点的中间段脚本 | 阶段 2——Hook 确认后 | 已选 Hook + 简报 | 无 | [roles/content-structurer.md](roles/content-structurer.md) |
| cta-optimizer | 与视频目标匹配的结尾 CTA 优化 | 阶段 3——内容草稿完成后 | 完整脚本 + 目标 | 无 | [roles/cta-optimizer.md](roles/cta-optimizer.md) |

> 派发每位队友前，读取对应角色文件并提取 `## Inline Persona for Teammate` 部分——将其直接粘贴进派发提示词。
> 大多数接入 Agent 不会自动加载角色文件。

## 文件

| 文件 | 内容 | 何时读取 |
|---|---|---|
| [workflow.md](workflow.md) | Mermaid 图、带门控的流水线步骤、最终报告格式 | 首次派发前 |
| [bind.md](bind.md) | 资源限制、行为约束、失败处理 | 遇到限制或失败时 |
| [roles/*.md](roles/) | 各阶段角色身份、成功标准、输出模式、内联 Persona | 派发每个阶段前 |
| [dependencies.yaml](dependencies.yaml) | 运行所需外部 skill 和工具 | **启动时** |
