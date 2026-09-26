# Bind: marketing-copy-team 执行约束

## 资源约束

| 约束项 | 值 | 原因 |
|---|---|---|
| `max_parallel_teammates` | 1 | 纯 C 模式顺序流水线；无并行 |
| `total_wall_clock_budget` | 12 min | 典型落地页文案；对不常见页面类型可更长 |
| `total_token_budget` | 50K tokens | 4 阶段 × 每阶段中等成本 |
| `brief_strategist_token_budget` | 8K | 结构化 brief 产出 |
| `copywriter_token_budget` | 12K | 草稿产出（随目标字数变动） |
| `copy_editor_token_budget` | 15K | 编辑后文案 + 7 轮变更日志 |
| `conversion_auditor_token_budget` | 10K | 6 个检查点 + 签发结论 |
| `per_stage_time_budget` | 4 min | 每阶段硬性上限 |
| `max_draft_retries` | 2 | 连续 2 次未通过 Draft Gate 后，上报用户 |
| `max_edit_retries` | 1 | 1 次未通过 Edit Gate 后，上报用户 |

## 行为约束

**Leader 级别**：
- Leader **任何阶段都不写文案** —— 只做 intake 提取、关卡执行、派发、整合、汇报
- Leader **必须执行全部 4 个关卡** —— 静默放行未通过的关卡会摧毁整条流水线的意义
- Leader **不得在阶段之间静默改写**任何角色的产出 —— 交接须逐字原样
- Leader **不得把 NO-GO 降级为 GO** —— 审计员的结论即团队的最终定论

**Brief-strategist 级别（阶段 1）**：
- 必须产出"唯一的"主要行动（多个 = brief 失败）
- 必须把缺失的客户原声标记为 `[gap: ...]`，而非捏造
- 必须把缺失的差异化标记为 `[gap: ...]`，而非臆造

**Copywriter 级别（阶段 2）**：
- 必须保留 brief 的定位 + 主要行动
- 必须控制在字数目标的 ±20% 以内
- 不得引入超出 brief 支撑证据范围的新主张
- 不得使用营销套话清单中的词

**Copy-editor 级别（阶段 3）**：
- 必须执行全部 7 轮（或对每一轮明确写 "no changes"）
- 必须控制在起始字数的 ±10% 以内
- 必须保留声音 + 定位 + 主要行动（仅可打磨，不可替换）
- 必须把 Sweep 0 发现（off-brief 草稿）显式标记出来，而非静默改写

**Conversion-auditor 级别（阶段 4）**：
- 必须对 6 个检查点全部显式打分（不得跳过）
- 必须给出明确签发：GO / GO-WITH-FIXES / NO-GO（不得含糊，例如"看起来还行但……"）
- GO-WITH-FIXES 时必须列出 ≤ 5 条具体可执行的修复建议
- NO-GO 时必须建议具体回退到哪个阶段

## "不改写上游" 规则（流水线的完整性规则）

为什么重要：流水线只有在下游增强而非改写上游时才有效。若 editor 静默改写了定位，brief 便失去意义，后续运行也无法复用。

| 阶段 | 可以做 | 不能做 |
|---|---|---|
| Copywriter | 在 brief 定位内撰写 | 静默改变 brief 的主要行动 / 定位 |
| Copy-editor | 打磨措辞、修通顺 | 把 headline 改写成另一种价值主张 / 更改 CTA 动词 |
| Conversion-auditor | 提出具体修复建议 | 亲自对文案应用修改 |

若下游阶段认为上游阶段存在根本性错误：**显式标出**
（Sweep 0 发现 / NO-GO 并回退建议）—— 不要静默修复。

## 失败处理

### 单阶段失败

| 触发条件 | 动作 |
|---|---|
| Brief-strategist 超时 | 重试一次；若持续超时，请求用户补充更多 intake 语境 |
| Brief gate 未通过 | 要么向用户追问（若输入有缺口），要么带提示重试 brief-strategist |
| Copywriter 超时 | 用同一 brief 重试一次 |
| Draft gate 未通过 | 带上失败检查点的具体提示回到阶段 2；最多 2 次重试 → 上报用户 |
| Copy-editor 超时 | 重试一次 |
| Edit gate 未通过 | 带上失败检查点的具体提示回到阶段 3；最多 1 次重试 → 上报用户 |
| Editor 标记 Sweep 0（off-brief 草稿） | 上报 Leader；建议回退到阶段 2 |
| Conversion-auditor 超时 | 上报编辑后的文案 + 提示用户"审计未完成 —— 建议人工复核" |
| Auditor 结论为 NO-GO | 上报结论 + 回退建议；**不要**输出"ship-ready"报告 |

### 输入超范围时的降级模式

| 触发条件 | 动作 |
|---|---|
| Intake 过于单薄（无受众描述 / 无 offer 细节） | 向用户追问；不得在骨架级 intake 上继续 |
| 没有客户原声样本 | Brief-strategist 标记 `[gap: ...]`；copywriter 使用中性产品声音；editor + auditor 以较低的具体性预期进行工作 |
| 用户指定的字数在典型区间之外（例如 < 30 或 > 1500） | 顶部提示 + 继续执行；团队同样适用于广告文案和短文案 |
| 页面类型不在支持清单中（例如"内部 wiki 页面"） | 建议跳过本团队 —— 对非转化文案属杀鸡用牛刀 |
| Intake 中存在多个相互竞争的主要行动 | Brief-strategist 请求用户选择 **一个**；不得在没有唯一主要行动时继续 |

### 自拒条件

以下情况团队**不得**输出"ship-ready"最终报告：
- Brief gate 未通过且用户未补充语境 → 上报为"intake 过于单薄"
- Conversion-auditor 结论为 NO-GO → 上报 NO-GO + 回退建议；声明 ship-ready 即是说谎
- Auditor 失败且文案未被审计 → 上报编辑后文案并附带"审计未完成"横幅

## 反模式防护

| 反模式 | 流水线级防护 |
|---|---|
| 跳过策略 → 空泛通用文案 | Brief Gate 在起草前强制检查 brief 的完备性 |
| 起草后"无止境精修" → 边际收益递减 | 7 轮 editor 仅限 1 遍；auditor 是最终关卡 |
| 营销套话潜入最终文案 | Editor 的 Sweep 4 + Auditor 的反模式巡检都会检查 |
| 编辑过程中捏造新主张 → 未经核实的陈述上线 | Editor 的"无新主张"规则 + Auditor 的 Brief Fidelity 检查 |
| 文案实际需要返工时却软性签发 | Auditor 必须给出 GO/FIXES/NO-GO（不得含糊）规则 |
