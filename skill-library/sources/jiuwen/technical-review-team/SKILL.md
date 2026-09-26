---
name: technical-review-team
description: |
  WHAT: 3-role specialization pipeline (SME + Copy Editor + Fact Checker) for verifying complex technical content before mass publication.
  WHEN: Reviewing technical manuscripts, documentation, or educational content requiring precision across accuracy, prose, and citations.
  NOT: For creative fiction review, non-technical content, or single-aspect reviews (use single-agent skills instead).
version: "0.1"
kind: team-skill
roles:
  - id: subject-matter-expert
    purpose: Verify technical accuracy, code correctness, and terminology precision in domain-specific content.
    skills: []
    tools: []
  - id: copy-editor
    purpose: Review prose clarity, consistency, readability, and structural coherence while preserving author's voice.
    skills: []
    tools: []
  - id: fact-checker
    purpose: Verify citations, statistics, historical claims, and external assertions against primary sources.
    skills: [fact-checker]
    tools: []
---

# Technical Review Team

This team implements a **specialization pipeline (Pattern C)** inspired by O'Reilly's technical book review process. It solves the failure mode where a single reviewer cannot simultaneously maintain technical precision, prose quality, and citation integrity — blurring these boundaries causes regressions (e.g., the editor rewriting technical explanations, the fact checker evaluating code correctness).

## Workflow

0. **Pre-flight: check dependencies** — read [dependencies.yaml](dependencies.yaml) and verify.
   Report missing items: `required: true` = likely fails without it; `required: false` = degraded but functional. **User decides** whether to proceed.
   The team can run on inline-persona-only mode if all skills are missing.

1. **Stage 1: SME Technical Review** — subject-matter-expert / content + domain context / verify technical accuracy, code correctness, terminology.
   See [workflow.md](workflow.md) Step 1 for the full protocol. Gate: PASS → proceed; NEEDS-REVISION → revision loop (max 2 retries); BLOCK → halt.

2. **Stage 2: Copy Editor Review** — copy-editor / SME-approved content + SME output / review prose clarity, consistency, readability.
   See [workflow.md](workflow.md) Step 2 for the full protocol. Gate: PASS → proceed; NEEDS-EDITS → integrate edits; BLOCK → halt.

3. **Stage 3: Fact Checker Verification** — fact-checker / SME + Copy Editor approved content / verify citations, statistics, external claims.
   See [workflow.md](workflow.md) Step 3 for the full protocol. Gate: PASS → proceed; NEEDS-CORRECTION → correction loop (max 2 retries); BLOCK → halt.

4. **Final: emit Technical Review Report** — Leader integrates all findings, validates gates, compiles publication-ready verdict.
   See [workflow.md](workflow.md) Step 4 for the Final Report format.

## Roles

| id | Purpose | When dispatched | Input | Key dependencies | Role file |
|---|---|---|---|---|---|
| subject-matter-expert | Verify technical accuracy, code correctness, terminology precision | Stage 1 (first) | Content + domain context | none | [roles/subject-matter-expert.md](roles/subject-matter-expert.md) |
| copy-editor | Review prose clarity, consistency, readability | Stage 2 (after SME gate passes) | SME-approved content + SME output | none | [roles/copy-editor.md](roles/copy-editor.md) |
| fact-checker | Verify citations, statistics, external claims | Stage 3 (after Copy Editor gate passes) | SME + Copy Editor approved content + prior outputs | fact-checker skill (optional) | [roles/fact-checker.md](roles/fact-checker.md) |

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