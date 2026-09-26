# Execution Guardrails

## Resource Constraints

| Item | Limit | Reason |
|---|---|---|
| `max_parallel_teammates` | 1 | C-pattern pipeline runs sequentially — no parallel fan-out |
| `total_wall_clock_budget` | 15 min | Upper bound for one full run including both stages and gates |
| `total_token_budget` | 150k tokens | Budget across both roles; prevents one teammate from exhausting context |
| `per_role_token_budget` | 75k per role | Symmetric allocation for auditor and polisher |
| `per_role_wall_clock` | 5 min per role | Each stage has 5 minutes to complete |

## Behavioral Constraints

- **Leader-as-orchestrator only**: the Leader dispatches teammates and integrates outputs. The Leader does NOT write localized content, flag cultural risks, or substitute any role's work.
- **Stage isolation**: each stage MUST NOT modify upstream stage outputs — the polisher receives the auditor's alternatives but does NOT re-audit or add new cultural flags. The auditor does NOT produce final localized text.
- **Gate enforcement**: the polisher MUST refuse to run if the auditor's verdict is BLOCK-AND-ESCALATE. The Leader MUST NOT dispatch the polisher on a BLOCK verdict.
- **Message preservation**: both roles MUST preserve the core message intent. The auditor suggests alternatives that preserve meaning; the polisher adapts expressions while preserving emotional/semantic intent.
- **No live-system testing**: this team operates on static content only. Do NOT test localized content on live platforms or audiences without user authorization.

## Failure Handling

### (a) Teammate failure

| Failure mode | Response |
|---|---|
| Teammate timeout | Retry once (single retry only). On 2nd timeout, mark role's section in the Final Report as `[ROLE MISSING — teammate timed out]` and proceed with the remaining role's output (if auditor timed out, do NOT dispatch polisher). |
| Malformed teammate output (does not match Output Schema) | Re-dispatch with the schema explicitly inlined and a "your previous output was malformed" preamble. Max 1 retry. On 2nd malformed output, mark as `[ROLE MISSING — malformed output]` and proceed. |
| Teammate refuses (e.g., auditor claims "no cultural risks exist" without deep examination) | Re-dispatch with the role's `Boundary > Mandatory` rule restated ("You MUST find at least 1 cultural risk per segment. If you found nothing, re-examine historical context, religious sensitivities..."). If it still refuses, mark as `[ROLE INCONCLUSIVE]` and surface verbatim in the report. |

### (b) Input over-scale degradation

| Trigger condition | Degraded mode |
|---|---|
| Content > 5000 words | Split into segments, process sequentially, warn user that wall-clock will exceed budget. User decides whether to proceed with segmented processing or reduce scope. |
| Content < 50 words | Reduce to single-role mode (auditor only, skip polisher). Warn user that the team's value is reduced for very short content. |
| Critical dependency missing per pre-flight | User already chose to proceed in Step 0 — record the missing dep in the Final Report under "Degraded Mode Notes". |

### Escalation rules

- If auditor returns BLOCK-AND-ESCALATE, the run is **BLOCKED** — emit a partial report with explicit "BLOCKED: cultural risks require user decision" header and surface blocking risks to user. Do NOT dispatch polisher.
- If polisher returns FAILED-TO-LOCALIZE after retry, the run is **PARTIAL** — emit report with auditor's output and mark polisher section as `[POLISHER FAILED — content culturally cleared but not localized]`.
- If `total_wall_clock_budget` is exceeded, halt all in-flight teammates, emit whatever partial outputs exist, and tag the report `INCOMPLETE: budget exceeded`.
- If `total_token_budget` is exceeded mid-run, halt new dispatches, allow in-flight to complete, emit partial report tagged `INCOMPLETE: token budget exceeded`.