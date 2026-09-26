# Execution Guardrails

## Resource Constraints

| Item | Limit | Reason |
|---|---|---|
| `max_parallel_teammates` | 1 | Pipeline is sequential — only one stage runs at a time |
| `total_wall_clock_budget` | 15 min | Upper bound for one full run including all 3 sequential stages + retry loops |
| `total_token_budget` | 150k tokens | Budget across all roles; prevents one stage from exhausting context |
| `per_role_token_budget` | 50k per role | Symmetric allocation for each of the 3 stages |
| `per_role_wall_clock` | 5 min per role | Each stage has 5 minutes to complete |
| `max_revision_retries` | 2 per stage | Author revision loops limited to 2 retries before escalation |

## Behavioral Constraints

- **Leader-as-orchestrator only**: the Leader dispatches teammates and integrates outputs. The Leader does NOT write findings, run analyses, or substitute any role's work.
- **Sequential stage isolation**: each stage MUST NOT modify upstream stage outputs — only annotate or enhance. The SME does NOT edit prose; the Copy Editor does NOT change technical content; the Fact Checker does NOT evaluate code correctness.
- **Gate enforcement**: Stage N+1 MUST refuse to run if Stage N's gate returned BLOCK. The pipeline halts on BLOCK verdicts.
- **Revision loop discipline**: when a stage returns NEEDS-REVISION / NEEDS-EDITS / NEEDS-CORRECTION, the Leader tracks retry count. After max_revision_retries, escalate to user with partial report.
- **Publication-grade standard**: this team enforces O'Reilly-level quality — "good enough" is not acceptable. Every issue must have a specific correction/fix proposed.

## Failure Handling

### (a) Teammate failure

| Failure mode | Response |
|---|---|
| Teammate timeout | Retry once (single retry only). On 2nd timeout, mark role's section in the Final Report as `[STAGE MISSING — teammate timed out]` and halt the pipeline (cannot proceed without this stage). |
| Malformed teammate output (does not match Output Schema) | Re-dispatch with the schema explicitly inlined and a "your previous output was malformed" preamble. Max 1 retry. On 2nd malformed output, mark as `[STAGE MISSING — malformed output]` and halt. |
| Teammate refuses (e.g., claims it cannot find issues) | Re-dispatch with the role's `Boundary > Mandatory` rule restated ("You MUST output a verdict even if no issues are found — PASS is valid"). If it still refuses, mark as `[STAGE INCONCLUSIVE]` and halt. |

### (b) Input over-scale degradation

| Trigger condition | Degraded mode |
|---|---|
| Content > 50,000 words | Fall back to single-role SME-only mode; warn user that full pipeline is skipped due to scale. User decides whether to proceed with reduced review. |
| Content has no external citations | Skip Fact Checker stage; warn user that citation verification is skipped. SME + Copy Editor stages proceed normally. |
| Content is non-technical (no code, no technical explanations) | Skip SME stage; warn user that technical review is skipped. Copy Editor + Fact Checker stages proceed normally. |

### Escalation rules

- If any stage returns `[STAGE MISSING]`, the pipeline is **FAILED** — emit a partial report with explicit "FAILED: stage incomplete" header and surface to user.
- If `total_wall_clock_budget` is exceeded, halt all in-flight teammates, emit whatever partial outputs exist, and tag the report `INCOMPLETE: budget exceeded`.
- If `total_token_budget` is exceeded mid-run, halt new dispatches, allow in-flight stage to complete, emit partial report tagged `INCOMPLETE: token budget exceeded`.
- If max_revision_retries is exceeded for any stage, emit report with `BLOCKED: revision limit exceeded` and list the unresolved issues for user decision.