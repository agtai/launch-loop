---
name: visual-content-brief-team
description: |
  3 角色并行视觉创意简报（视觉概念设计师 + 平台适配师 + 无障碍审查员），为跨多平台视觉内容资产生成完整创意简报。
  适用于规划跨 2 个以上平台（Instagram、LinkedIn、Twitter/X、微信等）的视觉帖子、营销图片或图文。
  不适用于视频脚本——请使用 short-video-script-team；本技能生产视觉创意简报，而非视频内容。
version: "0.1"
kind: team-skill
roles:
  - id: visual-concept-designer
    purpose: "独立于平台约束，发展核心创意概念：视觉主题、色彩方向、构图思路和情感基调。"
    skills: []
    tools: []
  - id: platform-adapter
    purpose: "将概念适配到各目标平台的格式、长宽比、文案字数限制和受众行为习惯。"
    skills: []
    tools: []
  - id: accessibility-reviewer
    purpose: "从无障碍角度审查概念：替代文字（Alt-text）文案、色彩对比假设、文字可读性和包容性信号。"
    skills: []
    tools: []
---

# 视觉内容创意简报团队

一个 3 角色并行团队，同时设计核心创意概念、平台适配规格和无障碍要求，然后整合为完整的视觉创意简报。单个 Agent 制作视觉内容简报时往往只关注一个平台和一个美学维度，错过跨平台冲突和无障碍缺陷。并行独立评估后整合，能在制作开始前就暴露这些问题。

## 工作流程

0. **前置检查：验证依赖** — 读取 [dependencies.yaml](dependencies.yaml) 并核实。

1. **Leader 收集内容简报** — 活动目标、目标平台、品牌规范（如有）、核心信息、目标受众、情绪/风格偏好，以及任何视觉限制。

2. **Leader 并行派发 3 个角色** — visual-concept-designer、platform-adapter 和 accessibility-reviewer 各自独立接收相同简报。**角色之间不得互相看到输出**。派发模板见 [workflow.md](workflow.md)。

3. **Leader 整合输出** — 组合跨平台简报；标出冲突（例如某视觉概念无法通过无障碍检查）；识别适配缺口。整合规则见 [workflow.md](workflow.md) § 整合。

4. **最终：输出视觉内容简报** — 核心概念 + 各平台规格 + 无障碍要求 + 制作检查清单。

## 角色

| id | 职责 | 何时派发 | 输入 | 关键依赖 | 角色文件 |
|---|---|---|---|---|---|
| visual-concept-designer | 核心创意概念（主题、色彩、构图、基调） | 每次运行（并行） | 内容简报 | 无 | [roles/visual-concept-designer.md](roles/visual-concept-designer.md) |
| platform-adapter | 各平台格式规格和文案适配 | 每次运行（并行） | 相同简报 | 无 | [roles/platform-adapter.md](roles/platform-adapter.md) |
| accessibility-reviewer | Alt-text、对比度、可读性、包容性审查 | 每次运行（并行） | 相同简报 | 无 | [roles/accessibility-reviewer.md](roles/accessibility-reviewer.md) |

> 派发每位队友前，读取对应角色文件并提取 `## Inline Persona for Teammate` 部分——将其直接粘贴进派发提示词。
> 大多数接入 Agent 不会自动加载角色文件。

## 文件

| 文件 | 内容 | 何时读取 |
|---|---|---|
| [workflow.md](workflow.md) | Mermaid 图、派发模板、整合规则、最终报告格式 | 首次派发前 |
| [bind.md](bind.md) | 资源限制、行为约束、失败处理 | 遇到限制时 |
| [roles/*.md](roles/) | 各角色身份、成功标准、输出模式、内联 Persona | 派发每个角色前 |
| [dependencies.yaml](dependencies.yaml) | 运行所需外部 skill 和工具 | **启动时** |
