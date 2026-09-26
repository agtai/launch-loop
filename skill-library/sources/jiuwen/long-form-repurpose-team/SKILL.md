---
name: long-form-repurpose-team
description: |
  5 角色两阶段长内容拆条团队：三视角并行选段（信息密度 / 情绪峰值 / 脱离上下文的独立性）后，由平台重构师产出钩子封面、断章取义守卫审查失真风险，输出带精确时间码与可运行 ffmpeg 命令的切片包，并公开呈现三个视角的分歧而非替用户和稀泥。
  Use when 手上有 30 分钟以上的播客、访谈、直播回放或长视频，需要拆成多条短视频分发到多个平台。
  Do NOT use for 从零创作短视频脚本、策划新播客单集、直播全程策划，或音质画质评估。
description_cn: 把播客、访谈、直播回放等长内容拆成可发布的短视频切片包；拿不到真实转写时拒绝编造时间码。
version: "1.0.0"
kind: swarm-skill
roles:
  - id: info-density-scout
    kind: ai_agent
    purpose: 按单位时间新信息量与可执行结论数选段，只看干货密度，不评价情绪与独立性
    skills: []
    tools: []
  - id: emotion-peak-scout
    kind: ai_agent
    purpose: 按留人能力选段，判据必须溯源到真实韵律标记（停顿间隔、语速偏差、笑声标记）
    skills: []
    tools: []
  - id: standalone-integrity-scout
    kind: ai_agent
    purpose: 以陌生观众视角判断候选段脱离上下文后是否成立、是否会被理解反，持一票否决权
    skills: []
    tools: []
  - id: platform-recomposer
    kind: ai_agent
    purpose: 为定稿切片产出前 3 秒钩子、标题、封面文案、竖屏构图与目标平台分发建议
    skills: []
    tools: []
  - id: context-integrity-guard
    kind: ai_agent
    purpose: 审查切片本身与重构师改写的钩子，裁决失真与舆情风险，输出成对原文证据
    skills: []
    tools: []
---

# 长内容拆条分发团队

两阶段混合模式团队（并行选段 + 顺序加工），解决单视角拆条的核心失败模式：**干货最密的段落往往语速平会崩完播，最好笑的段落往往信息稀薄，而最有爆点的那句话单独切出来经常会被理解反**——这三者几乎永远不重合，单个 Agent 只会从一个维度选段，选完自己也不知道漏了什么。本团队让三个视角独立评估并公开分歧，把权衡交还给人，同时在拿不到真实转写时拒绝编造时间码。

## 运行前：关于依赖

**一般不需要做任何配置。**给一个视频链接或本地音视频文件就能开始。

本技能用云端转写把音频变成带时间戳的文字稿，**自动使用 jiuwen 里已经配置好的 OpenRouter 或 OpenAI key**（模型 `whisper-1`），不用另外申请或填写。

| 项 | 说明 |
|---|---|
| 速度 | 实测 47 分钟的 B 站视频，下载加转写共约 80 秒（分段并行上传） |
| 费用 | 约 0.006 美元 / 分钟，一小时约 0.36 美元，从你的 OpenRouter / OpenAI 账户扣除 |
| 本机需要 | `ffmpeg`（处理音频）；给链接时还需要 `yt-dlp`（下载音频） |
| 不需要 | 本地 whisper、PyTorch、GPU |

**什么时候需要额外配置：**jiuwen 用的不是 OpenRouter / OpenAI（例如 DeepSeek、通义）时，设置三个环境变量指定一个兼容 OpenAI 格式的转写服务：`ASR_API_BASE`、`ASR_API_KEY`、`ASR_MODEL`。

**已经有字幕文件（`.srt` / `.vtt`）时**直接给它，会跳过转写，不产生费用。

**B 站等平台拦截匿名下载时**，会询问是否使用你浏览器里的登录状态下载，同意即可，不需要你自己下载。想以后不再询问，在 jiuwen 的 `.env` 里加一行 `REPURPOSE_COOKIES_BROWSER=chrome`。

> ⚠️ **不要为了运行本技能而安装任何东西**，包括 whisper。本地 whisper 只在云端转写不可用时作为备选，并且需要用户确认。

## Workflow

0. **Pre-flight: check dependencies** — 读取 [dependencies.yaml](dependencies.yaml) 并验证。
   报告缺失项：本团队全部依赖均为 `required: false`，缺失时按四级降级降档而非失败。**探测结果必须如实告知用户并附安装命令**，由**用户决定**是否继续。不得静默降级。

1. **Stage 0 素材层** — 拿到带时间戳的转写稿，确定运行级别：L0 全自动 / L1 字幕 / L2 降级（不输出时间码）/ L3 拒绝（停止执行）。详见 [workflow.md](workflow.md) § Detailed Steps Stage 0。

   默认做法：用户给了链接或音视频，就运行 `python3 scripts/transcribe.py "<链接或文件>" -o repurpose_work`，一步得到 `transcript.json` 与 `prosody.json`。本步骤的硬约束（全文见 [bind.md](bind.md) § Behavioral Constraints 约束 7–10）：

   - **默认云端转写，不要去找平台字幕。**用户主动给了字幕文件才走 L1。
   - **不得主动安装任何依赖**，包括 whisper、PyTorch。
   - **被平台拦截（如 B 站 412）时，不换接口、不伪装绕过**，而是问用户一次是否使用其浏览器登录状态下载（`--cookies-from-browser`），同意后自动重试，用户无需自己下载。
   - **云端不可用、需要本地转写时，先报预计耗时并等用户确认**，模型默认 `small`。

2. **Stage 1a 并行选段** — Leader 在一条消息内同时分派 `info-density-scout` 与 `emotion-peak-scout`。两者必须并行且**互相不可见**——分歧是产物，不是需要消除的噪声。详见 [workflow.md](workflow.md) § Detailed Steps Stage 1a。

3. **Stage 1b 独立性裁决** — Leader 汇总候选段（**仅传边界与原文，不传评分与理由**），分派 `standalone-integrity-scout` 逐条裁决。详见 [workflow.md](workflow.md) § Detailed Steps Stage 1b。

4. **Leader 整合定稿** — 共识优先、冲突逐字呈现、一票否决、边界取并集、**按质量定条数**（用户未指定时不设目标数量，达标几段切几段）。**Leader 绝不调解信息密度与情绪峰值之间的分歧**——该权衡属于人类决策。详见 [workflow.md](workflow.md) § Detailed Steps Integration。

5. **Stage 2a/2b 加工与审查** — `platform-recomposer` 产出钩子、封面与平台分发建议（只做你指定的平台，未指定时默认抖音、小红书、视频号），随后 `context-integrity-guard` 审查切片**以及重构师改写的钩子**（后者是失真的主要来源）。详见 [workflow.md](workflow.md) § Detailed Steps Stage 2。

6. **Final: emit 拆条方案报告** — 定稿切片（含时间码与 ffmpeg 命令）、三方分歧、被否决候选、平台分发矩阵、风险清单。Leader 逐字呈现角色间矛盾，绝不调解。

## Roles

| id | Purpose | When dispatched | Input | Key dependencies | Role file |
|---|---|---|---|---|---|
| info-density-scout | 按单位时间新信息量与可执行结论数选段 | Stage 1a，与 emotion-peak-scout 并行 | `{TRANSCRIPT}`, `{CONTENT_TYPE}`, `{USER_CLIP_COUNT}`, `{SOURCE_MINUTES}`, `{DEGRADE_LEVEL}` | none | [roles/info-density-scout.md](roles/info-density-scout.md) |
| emotion-peak-scout | 按留人能力选段，判据须溯源到真实韵律标记 | Stage 1a，与 info-density-scout 并行 | `{TRANSCRIPT}`, `{PROSODY_MARKERS}`, `{USER_CLIP_COUNT}`, `{SOURCE_MINUTES}`, `{DEGRADE_LEVEL}` | none | [roles/emotion-peak-scout.md](roles/emotion-peak-scout.md) |
| standalone-integrity-scout | 判断候选段脱离上下文后是否成立、是否会被理解反 | Stage 1b，候选汇总后 | `{FULL_CONTEXT_SUMMARY}`, `{CANDIDATE_SEGMENTS}`（含上下文窗口）, `{DEGRADE_LEVEL}` | none | [roles/standalone-integrity-scout.md](roles/standalone-integrity-scout.md) |
| platform-recomposer | 产出钩子、标题、封面、竖屏构图与目标平台适配（默认抖音、小红书、视频号） | Stage 2a，定稿后 | `{FINAL_CLIPS}`, `{TARGET_PLATFORMS}`, `{BRAND_TONE}`, `{HAS_VIDEO}`, `{DEGRADE_LEVEL}` | none | [roles/platform-recomposer.md](roles/platform-recomposer.md) |
| context-integrity-guard | 审查切片与改写钩子的失真与舆情风险 | Stage 2b，重构师产出后 | `{FINAL_CLIPS}`, `{RECOMPOSER_OUTPUT}`, `{CLIP_SOURCE_TEXT}`, `{DEGRADE_LEVEL}` | none | [roles/context-integrity-guard.md](roles/context-integrity-guard.md) |

> 在分发每个队友之前，读取对应的角色文件并提取 `## Inline Persona for Teammate` 章节 — 直接粘贴到分发提示词中。大多数采用代理不会自动加载角色文件。

## Files

| File | What it contains | When to read |
|---|---|---|
| [workflow.md](workflow.md) | Mermaid 图、Stage 0 工具命令、各阶段分派模板、整合规则、Final Report 格式、验收标准 | 首次分发前 — 完整执行手册 |
| [bind.md](bind.md) | 资源限制、**反幻觉硬约束**、四级降级判定、失败处理与降级模式 | **启动时** — 反幻觉规则的唯一真源 |
| [roles/\*.md](roles/) | 每个角色的 Identity、成功标准、边界、Output Schema、Inline Persona | 分发每个队友前 — 提取 Inline Persona |
| [scripts/transcribe.py](scripts/transcribe.py) | 云端转写脚本：下载音频、静音处分段、并行转写、拼回时间轴，输出转写稿与韵律标记 | Stage 0 — 用户给了链接或音视频时直接运行 |
| [dependencies.yaml](dependencies.yaml) | 外部工具声明，全部 `required: false`，含安装命令 | **启动时** — 验证依赖，确定降级级别 |

## 反幻觉承诺

本技能对时间码与技术指标有六条硬约束，写在 [bind.md](bind.md) § Behavioral Constraints，不受降级级别或用户催促影响：

1. 任何时间码必须可溯源到真实 ASR 输出或字幕文件，**禁止基于内容推测生成时间码**
2. L2 级别下不得出现任何 `HH:MM:SS` 格式字符串
3. L3 级别下不产出切片方案，唯一合法输出是缺失项清单与补齐指引
4. 不输出任何未经真实测量的音视频技术指标
5. 输出示例必须标注为示例数据
6. 情绪判据必须溯源到真实韵律标记，无来源时标注 `prosody_available: false`

**可验证**：拿报告里的 ffmpeg 命令切一条出来，看内容对不对得上。这是本技能敢把命令写进交付物的原因。
