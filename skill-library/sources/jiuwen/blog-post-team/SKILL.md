---
name: blog-post-team
description: |
  4 阶段流水线（研究 → 提纲 → 写作 → 编辑），生产有事实依据、叙事结构清晰、可直接发布的博客文章。
  适用于需要深度、事实准确性和编辑打磨的博客写作——教程、观点文章、行业分析、操作指南。
  不适用于社交媒体短文——请使用 short-video-script-team 或 social-media-multiplatform-team。
version: "0.1"
kind: team-skill
roles:
  - id: research-analyst
    purpose: "收集并验证事实基础：核心论点、数据统计、案例及来源可信度。防止发布后为错误事实感到后悔。"
    skills: []
    tools: []
  - id: outline-architect
    purpose: "将研究成果结构化为逻辑叙事弧线，包含章节划分、过渡逻辑和读者旅程规划。确保研究变得可读。"
    skills: []
    tools: []
  - id: content-writer
    purpose: "以提纲为蓝图完成全文写作，包含引人入胜的开头、清晰的行文和符合品牌调性的表达。"
    skills: []
    tools: []
  - id: editor-reviewer
    purpose: "编辑提升清晰度、删除冗余、核查与研究的事实一致性，并确保开篇 Hook 能撑起全文阅读。"
    skills: []
    tools: []
---

# 博客文章团队

一个 4 阶段流水线，通过严格的先研究后写作纪律来生产可发布的博客文章。单个 Agent 往往先写作后研究（或根本不研究），导致文章存在事实漏洞、结构薄弱和冗余堆砌。每个阶段都有明确的质量门控，依赖前一阶段的输出。

## 工作流程

0. **前置检查：验证依赖** — 读取 [dependencies.yaml](dependencies.yaml) 并核实。

1. **Leader 收集简报** — 主题、目标读者、大致字数目标、用户希望涵盖的要点，以及期望的语调/风格。若主题不明确 → 先厘清再继续。

2. **阶段 1 — research-analyst** 构建事实基础：明确核心论点，寻找每个论点的支撑证据、数据或案例。

3. **阶段 2 — outline-architect** 接收研究基础，搭建文章结构：标题选项、引子概念、章节流程、各章节重点收获、结语/CTA 类型。

4. **阶段 3 — content-writer** 接收提纲和研究，完成全文写作。必须严格遵循提纲结构，所有核心论点须基于研究输出。

5. **阶段 4 — editor-reviewer** 接收草稿和研究，编辑提升清晰度，删除冗余（目标：压缩 20% 字数），核查事实一致性，强化开篇 Hook，检验结语是否有力。

6. **最终：输出博客文章包** — 编辑后的终稿 + 编辑摘要 + 研究备注。

## 角色

| id | 职责 | 何时派发 | 输入 | 关键依赖 | 角色文件 |
|---|---|---|---|---|---|
| research-analyst | 事实基础：论点、证据、来源可信度 | 阶段 1——始终最先 | 主题简报 | 无 | [roles/research-analyst.md](roles/research-analyst.md) |
| outline-architect | 叙事结构和章节流程 | 阶段 2——研究完成后 | 研究输出 | 无 | [roles/outline-architect.md](roles/outline-architect.md) |
| content-writer | 全文写作 | 阶段 3——提纲完成后 | 提纲 + 研究 | 无 | [roles/content-writer.md](roles/content-writer.md) |
| editor-reviewer | 清晰度编辑、事实核查、Hook 强化 | 阶段 4——草稿完成后 | 草稿 + 研究 | 无 | [roles/editor-reviewer.md](roles/editor-reviewer.md) |

> 派发每位队友前，读取对应角色文件并提取 `## Inline Persona for Teammate` 部分——将其直接粘贴进派发提示词。
> 大多数接入 Agent 不会自动加载角色文件。

## 文件

| 文件 | 内容 | 何时读取 |
|---|---|---|
| [workflow.md](workflow.md) | Mermaid 图、带门控的流水线步骤、最终报告格式 | 首次派发前 |
| [bind.md](bind.md) | 资源限制、行为约束、失败处理 | 遇到限制或失败时 |
| [roles/*.md](roles/) | 各阶段角色身份、成功标准、输出模式、内联 Persona | 派发每个阶段前 |
| [dependencies.yaml](dependencies.yaml) | 运行所需外部 skill 和工具 | **启动时** |
