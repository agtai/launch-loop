# Bind：social-media-multiplatform-team 执行约束

## 资源约束

| Key | Value | 原因 |
|---|---|---|
| `max_parallel_teammates` | 5 | B 模式扩散上限；与 `platform-adapter.count` 的上限一致 |
| `total_wall_clock_budget` | 18 min | N=4 为典型情况；N=5 时约 22 min |
| `total_token_budget` | 70K tokens | N 个适配器 × 6K + 2 个 reviewer × 6K + strategist 6K + Leader |
| `per_teammate_token_output` | adapter 3000 / reviewer 4000 / strategist 4000 | 适配器输出较短；reviewer/strategist 较长 |
| `per_teammate_wall_clock` | 5 min | 每位队友 |
| `max_retries_per_teammate` | 1 | 之后标记为"low-confidence"——若达到法定人数则发布 |
| `max_platforms` | 5 | 用户指定 > 5 时强制优先级排序 |
| `min_platforms` | 3 | 低于此数，使用单 Agent 的 platform-writer |

## 行为约束

**Leader 层**：
- Leader **不写、不复核、不做策略**——只做编排
- Leader **必须在一条消息中派发所有 N 个适配器**（B 模式完整性）
- Leader **必须在一条消息中派发两位 A 复核**（并行完整性）
- Leader **必须尊重合规 BLOCK**——该平台的变体从可发布包中排除
- Leader **必须在最终交付前应用 A 复核的修订**
- Leader **不得引入自己的创作内容**——由 strategist 挑选；由 adapter 写作

**每个角色的纪律（通过角色文件中的 Boundary 强制）**：
- platform-adapter：不做跨平台对比；不做合规检查
- brand-consistency-reviewer：不做合规检查；不写新文案——只标记漂移 + 修订
- compliance-reviewer：不评论品牌语气；必须逐一给出判定
- engagement-strategist：不写新内容；不得覆盖 BLOCK

**B 阶段的跨角色隔离**：
- 各适配器在适配过程中不得看到彼此的输出
- 适配器输出中出现跨平台引用（例如"与 LinkedIn 版本相似"）→ 视为模式违规；重试

## 反统一化语气的保护机制（团队的完整性规则）

| 机制 | 描述 |
|---|---|
| 两个适配器输出仅在长度上存在差异 | 模式违规——同样的语气 ≠ 平台原生；带语气提示重试两者 |
| 所有平台的所有 hook 使用同一种开场句式（例如全部以"Excited to announce"开头） | 模式违规；带 hook 多样性提示重试适配器 |
| brand-consistency-reviewer 直接说"全部一致"而不做逐变体漂移检查 | 模式违规；要求逐变体复核并重试 |
| compliance-reviewer 对全部 N 份变体只给笼统 OK 而无逐变体细节 | 模式违规；要求逐变体判定并重试 |
| strategist 为所有平台都选了同一个 hook 变体编号（例如全部"variant 1"） | 可疑——标记人工复核；不自动失败 |
| 话题标签数量超过平台常规（例如 LinkedIn > 5 个话题标签） | 适配器带平台常规提示重试 |

## 失败处理

### 每阶段失败

| 触发条件 | 处理 |
|---|---|
| N 个适配器中有 1 个超时 / 失败 | 将该平台标记为"跳过——适配器失败"；若 N 中有 ≥ 3 成功则发布 |
| N 个适配器中有 2 个及以上失败 | 终止 B 阶段；输出部分结果告示条 |
| 适配器产出统一化语气（与其他平台语气雷同） | 带明确的语气画像提示重试一次；若仍然如此，附告示条后发布 |
| brand-consistency-reviewer 超时 | 重试一次；若仍然失败，带告示条发布："未完成一致性复核——发布前需人工交叉核对" |
| compliance-reviewer 超时 | 重试一次；若仍然失败，终止——合规不可选；提示"合规复核失败——需人工复核" |
| compliance-reviewer 对超过 50% 的变体给出 BLOCK | 前置提示："多数变体存在合规问题——很可能是源信息的问题；在重新运行前先修订源信息" |
| engagement-strategist 超时 | 重试一次；若仍然失败，带告示条发布："无互动策略——请人工挑选最佳 hook" |

### 输入超量处理

| 触发条件 | 处理 |
|---|---|
| 用户指定 > 5 个平台 | 要求优先排序前 5；其余推迟到后续运行 |
| 源信息 > 5K tokens | 要求用户提供"要点"摘要；团队不会重新汇总长篇源信息 |
| 用户提供的品牌语气指南 > 10K tokens | 要求提炼语气规则（3-5 条要点）；若用户拒绝则使用默认值 |
| 请求了不受支持的平台且未提供语气画像 | 要求用户提供语气画像 + 1-2 个示例帖子；否则跳过该平台 |

### 质量完整性保护

| 触发条件 | 处理 |
|---|---|
| 所有 hook 都退化为 engagement-bait 套路（"This will change everything…"） | 带 hook 质量提示重试适配器 |
| 变体中含有医疗 / 金融 / 法律声明且缺少免责声明 | compliance-reviewer 标记 EDIT-REQUIRED 并给出具体免责声明；若用户处于监管行业，则标记 BLOCK |
| 变体直接抄袭竞品 handle / 无策略地 @competitor | brand-consistency-reviewer 标记；由 strategist 复核意图 |

## 自我拒绝条件

当以下情况成立时，团队**必须不**产出可发布的内容包：

- 请求平台数少于 3 → 跳转到单 Agent platform-writer
- 未提供源信息 → 跳转（"请先写源信息"）
- 全部 N 个变体都被合规 BLOCK → 跳转："源信息存在根本性合规问题；在重新运行前修订源信息"
- 付费广告 / 赞助文案 → 跳转至 paid-ads-team（TODO）——合规门槛不同
- 用户处于监管行业（制药 / 金融 / 法律）且未计划安排合规官复核步骤 → 标记前置条件未满足

## 兼容性说明

- **Cursor / Claude Code**：队友以 Task subagent 形式存在，不会自动加载 `roles/*.md`。Leader 必须将每个角色的 `## Inline Persona for Teammate` 内联到 Task prompt 中。
- **Hermes Agent / 其他**：未测试。
