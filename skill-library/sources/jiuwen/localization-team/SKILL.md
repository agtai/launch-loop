---
name: localization-team
description: |
  2-role specialization pipeline (Cultural Auditor + Language Polisher) for content localization that preserves core meaning while adapting to target culture.
  Use when content goes global and needs cultural risk mitigation plus native-quality expression — not just translation.
  Do NOT use for pure translation tasks (Google Translate) or single-culture content with no cross-border intent.
version: "0.1"
kind: team-skill
roles:
  - id: cultural-auditor
    purpose: Identify cultural risks (taboos, sensitivities, stereotypes) and suggest alternatives that preserve core meaning
    skills: [web-research, fact-checker, localization-testing]
    tools: [curl]
  - id: language-polisher
    purpose: Transform culturally-cleared content into natural, locally-resonant prose with native-quality expression
    skills: [web-research, idiomatic-translate]
    tools: []
---

# Localization Team

A 2-role specialization pipeline for content localization. The team solves the failure mode where single-agent "translation" produces content that is either culturally offensive or linguistically awkward — often both. The Cultural Auditor identifies risks first; the Language Polisher enhances expression only after cultural clearance. This enforced handoff prevents the common regression where a translator smooths text that should have been flagged, or flags issues that a polisher could have adapted.

## Workflow

0. **Pre-flight: check dependencies** — read [dependencies.yaml](dependencies.yaml) and verify.
   Report missing items: `required: true` = likely fails without it; `required: false` = degraded but functional. **User decides** whether to proceed.
   The team can run on inline-persona-only mode if all skills are missing.
   Note: dependencies were populated during authoring via Stage 2 auto-matching (local scan) and optional post-generation community enrichment. Each entry's `source` field indicates origin (`local` or community URL).

1. **Cultural Audit** — cultural-auditor receives source content and target locale; identifies cultural risks (taboos, sensitivities, stereotypes, humor that may land poorly); classifies by severity (BLOCK / FLAG / NOTE); suggests alternatives that preserve core meaning. See [workflow.md](workflow.md) Step 1 for full protocol. Gate: auditor must produce verdict in {PASS, FLAG-AND-PROCEED, BLOCK-AND-ESCALATE} with locale-specific context for each risk.

2. **Language Polish** — language-polisher receives culturally-cleared content (with auditor's alternatives applied if FLAG); transforms into natural, locally-resonant prose; converts idioms/puns/metaphors to target-culture equivalents; preserves core message and emotional intent. See [workflow.md](workflow.md) Step 2 for full protocol. Gate: polisher must produce verdict in {POLISHED, NEEDS-REVIEW, FAILED-TO-LOCALIZE} with quality scores ≥3. Only dispatched if auditor verdict is not BLOCK.

3. **Final: emit Localization Report** — Leader integrates auditor and polisher outputs into unified report. If auditor verdict was BLOCK, polisher was NOT dispatched — report contains blocking risks and escalation path. If polisher verdict was NEEDS-REVIEW, review items are surfaced explicitly. See [workflow.md](workflow.md) Step 3 for report format.

## Roles

| id | Purpose | When dispatched | Input | Key dependencies | Role file |
|---|---|---|---|---|---|
| cultural-auditor | Identify cultural risks and suggest alternatives | Every run (Stage 1) | Source content, target locale, source locale (optional) | web-research, fact-checker, localization-testing, curl | [roles/cultural-auditor.md](roles/cultural-auditor.md) |
| language-polisher | Transform content into native-quality prose | After auditor gate passes (Stage 2) | Culturally-cleared content, target locale, auditor verdict | web-research, idiomatic-translate | [roles/language-polisher.md](roles/language-polisher.md) |

> Before dispatching each teammate, read the corresponding role file and extract the
> `## Inline Persona for Teammate` section — paste it directly into the dispatch prompt.
> Most adopting agents do NOT auto-load role files for teammates.

## Files

| File | What it contains | When to read |
|---|---|---|
| [workflow.md](workflow.md) | Mermaid diagram, step-by-step protocol, integration rules, Final Report format | Before first dispatch — the complete playbook |
| [bind.md](bind.md) | Resource limits, behavioral constraints, failure handling and degraded modes | When hitting limits, handling failures, or needing degraded-mode rules |
| [roles/*.md](roles/) | Per-role identity, success criteria, output schema, Inline Persona for Teammate | Before dispatching each teammate — extract Inline Persona |
| [dependencies.yaml](dependencies.yaml) | External skills and tools required to run | **Startup** — verify deps, report missing items, user decides go/no-go |