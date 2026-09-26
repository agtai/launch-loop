---
name: social-media-multiplatform-team
description: |
  混合 B+A+C 社交媒体团队：N 个 Platform Adapter 并行扩散 → Brand Consistency + Compliance Reviewer 交叉核对所有变体 → Engagement Strategist 挑选最佳 hook。
  当产品、活动或内容片段需要同时在 3 个及以上平台发布时使用。
  不要用于单平台帖子、从零创作源内容或发帖排期。
version: "0.1"

kind: team-skill

roles:
  - id: platform-adapter
    purpose: "B 模式并行扩散——每个实例只负责一个平台。将源信息适配为该平台的语气 / 长度 / hook 风格 / 话题标签惯例 / ……"
    count: [3, 5]
    skills: [platform-voice-library, social-copywriting]
    tools: [file-read]
  - id: brand-consistency-reviewer
    purpose: "A 模式完整性复核（在 B 扩散之后）——对 N 份适配变体进行语气 / 信息 / 事实一致性的交叉核查。捕捉适配器之间的漂移……"
    count: 1
    skills: [brand-voice-guardian, content-cross-check]
    tools: [file-read]
  - id: compliance-reviewer
    purpose: "A 模式完整性复核（与 brand-consistency-reviewer 并行）——逐一检查每个变体是否存在无依据的声明 / 监管行业违规……"
    count: 1
    skills: [content-compliance-check, brand-safety]
    tools: [file-read]
  - id: engagement-strategist
    purpose: "C 阶段综合（两个 A 复核之后）——基于平台特定的互动先验，为每个平台挑选最佳 hook 变体，并给出推荐……"
    count: 1
    skills: [social-engagement-strategy, posting-sequence-planner]
    tools: [file-read]

---

# 社交媒体多平台团队

本团队的模型来源于**严谨的社媒团队实际运作多平台发布时的方式**：
每个平台都有专职的文案（Twitter 文案 ≠ LinkedIn 文案 ≠ 小红书 KOL 文案），
然后由品牌编辑交叉核查一致性，再由合规编辑核查声明 / 政策问题，
最后由策略师挑选 hook 并安排发布顺序。单 Agent 式的多平台写作会把这些环节压缩成
"为这 3 个平台改写一遍"——产出的往往是长度不同但内容几乎一致的帖子，信息在无形中发生漂移。

**模式**：混合 B+A+C——B 扩散（Platform Adapter × N）→ 2 个 A 复核并行
（Brand-Consistency + Compliance）→ C 综合（Engagement Strategist）。

## Workflow

0. **起飞前：检查依赖**——阅读 [dependencies.yaml](dependencies.yaml) 并核实。
   报告缺失项：`required: true` = 缺失时很可能失败；`required: false` = 能力降级但仍可运行。**由用户决定**是否继续。
   如果所有技能都缺失，团队可以在仅使用 inline-persona 的模式下运行。

1. **Leader 提取活动上下文**——源信息（粘贴 / 链接）+ N 个目标平台
   + 品牌语气指南（或"使用默认值"）+ 每个平台的受众 + 活动目标（知名度
   / 注册 / 互动 / 销售）+ 发布时间窗 + KPI + 硬性约束（例如"必须
   包含链接"、"必须提到合作伙伴 @handle"、"不要提及竞品 X"）。

2. **Round 1：B 扩散（在一条消息中发起 N 个并行调用）**——Leader 派发
   `platform-adapter` × N，每个平台一个。每个实例收到：源信息 + 品牌语气 + 该
   平台的受众 + 约束条件。每个实例产出：适配后的帖子 + 3 个 hook 变体。各适配器
   彼此不可见。

3. **Round 2：2 个 A 复核并行（单条消息）**——
   `brand-consistency-reviewer` + `compliance-reviewer`。二者接收全部 N 份适配变体
   并行工作。

4. **Round 3：C 综合（单次调用）**——`engagement-strategist` 接收所有变体 +
   两份 A 复核结论。输出：每平台最佳 hook + 发布顺序 + 素材清单 +
   高契合度/低契合度平台判断。

5. **Leader 产出最终报告**——每平台可发布的内容包 + 发布顺序 + 素材 +
   合规判定 + 品牌一致性已应用的修订 + 必要时的跳过建议。

## Roles

| id | 模式 | 职责 | 何时派发 | 角色文件 |
|---|---|---|---|---|
| platform-adapter | B（并行扩散，count: 3-5） | 将源信息适配到单一平台；平台原生语气 + 3 个 hook | Round 1 | 阅读 [roles/platform-adapter.md](roles/platform-adapter.md) |
| brand-consistency-reviewer | A（并行完整性复核） | 跨 N 份变体交叉核查语气 / 信息 / 事实漂移 | Round 2 | 阅读 [roles/brand-consistency-reviewer.md](roles/brand-consistency-reviewer.md) |
| compliance-reviewer | A（并行完整性复核） | 对每个变体给出声明 / ToS / 品牌安全判定 + 修订 | Round 2 | 阅读 [roles/compliance-reviewer.md](roles/compliance-reviewer.md) |
| engagement-strategist | C（综合） | 最佳 hook + 发布顺序 + 素材清单 + 契合度排名 | Round 3 | 阅读 [roles/engagement-strategist.md](roles/engagement-strategist.md) |

> 在派发每位队友前，阅读其角色文件，提取
> `## Inline Persona for Teammate` 小节的内容——直接粘贴到 Task prompt 中。

## Files

| 文件 | 内容 | 何时阅读 |
|---|---|---|
| [workflow.md](workflow.md) | Mermaid 图 + B 扩散 + 2 并行 A + C 综合 + 每阶段校验门 + 最终交付格式 | 首次派发之前 |
| [bind.md](bind.md) | 资源限制、反统一化语气的保护机制、失败处理 | 触达限制 / 处理失败时 |
| [roles/\*.md](roles/) | 每个角色的身份、成功标准、输出模式、Inline Persona | 派发每位队友之前 |
| [dependencies.yaml](dependencies.yaml) | 引用的外部社区 social-copy / brand / compliance 技能 | **启动时**——核实、报告、用户决定 |
