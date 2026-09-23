---
name: s1a-launch-kit
description: Produce and maintain the launch copy for system1-agents (LinkedIn article and feed post, X thread, Show HN, Product Hunt, Reddit, newsletters, press, comments) from one fixed title and core message, at the author's level of detail, linted, verified against the repository, and delivered as a copy-paste Word file. Use when Kai asks for launch posts, a LinkedIn article, per-channel copy, hashtags, or launch assets for system1-agents or a similar release.
---

# system1-agents launch kit

## Fixed strings (do not reword without Kai's go)

- Title: "Give your agents a Jev-like System 1 decision model. Start from a prebuilt agent or build your own."
- Core message: "Describe the task. Claude Code or Codex runs a prebuilt System 1 agent or builds a new one, on models such as Jev, Laya or Cua-S1 Nano. Browser use, computer use, robotics and games ship ready to run. Up to 6× faster and 25× cheaper than an LLM, at the same score."
- Jev passage, hype form (LinkedIn, X, Product Hunt, Reddit): "Jev, TypeSafe's System 1 decision model, took the AI community by storm in September. Since then builders have released Jev-like models of their own, Laya and Cua-S1 Nano among them. system1-agents integrates them: build a System 1 agent on them, or give your existing agent System 1 capabilities."
- Jev passage, flat form (Show HN, newsletters, press): "TypeSafe launched Jev on September 15 under the name System One model. Since then builders have released Jev-like System 1 decision models of their own, Laya and Cua-S1 Nano among them. system1-agents takes them in the same slot: build a System 1 agent on them, or give an existing agent System 1 capabilities."
- Benefit line: "Reduce the cost and increase the speed of your Claude with Jev-like System 1 decision models."
- Closing line: "Transform your agents by using System 1 agents."
- Hashtags: LinkedIn "#Jev #SystemOneModels #AIAgents #OpenSource"; X "#Jev #SystemOneModels #AIAgents" on the last post only; dev.to tags ai, agents, jev, showdev; none on HN, Reddit, Discord.
- Handles: @typesafeai (Jev), @trycua (Cua). Laya has no company account on X; @Nandakishorm1 is the author's likely personal account, unverified. LinkedIn pages: TypeSafe AI, Cua (cua-ai), Convai Innovations Pvt. Ltd.

## Kai's rules for the copy

1. The title and the core message appear in every channel. Only length changes per channel.
2. Numbers are the table's "up to" figures (6× faster, 25× cheaper, same score in five of seven). Never per-row browser or computer-use numbers in the headline copy.
3. No license mention. No agent-framework name in public copy (the image may list hosts).
4. Terminology: "LLM" (glossed once as large language model), "System 1 decision model", "System 1 agent" in prose, "Jev-like System 1 decision model" where readers know Jev from its launch coverage. Never "chat model", "S1A agent", "decider", "classifier".
5. Models are examples: "such as Jev, Laya or Cua-S1 Nano", "integrates them", "models like these". Never "all three".
6. The article has no technical detail: no JSON, prices, latencies, probe counts, library names, scenario lists. Scope stays "browser use, computer use, or build your own System 1 agent".
7. Article shape: title; core message with the repo link; "Jev-like System 1 decision models" (the hype passage); "The problem with current agents: every step goes through a System 2 LLM"; "The solution: a System 1 decision model makes each pick in one pass"; "Two skills ship with the repository" (caller skill with the install line, builder skill that declines tasks needing deduction); the benefit line; the closing line; hashtags.
8. Both an article and a feed post. The feed post is short and points to the article.
9. Show content before editing the kit when Kai asks to see it, and ask before changing the title.

## Steps

1. Read README.md, docs/benchmarks.md, docs/skills.md and the release notes before writing. Note placeholders (the LLM behind the six non-browser rows), flag renames in flight (`--slot` to `--model`), and single-episode rows.
2. Run one real command for any output quoted in developer-facing copy (`s1a decide` with the ticket example, key from the shape worktree's .env), and quote it verbatim with its latency.
3. Write the full kit: launch image section, article, feed post, X thread (six posts), Show HN (title under 80 characters plus first comment with caveats before numbers), Product Hunt (tagline under 60, description under 260, maker comment), Reddit (one body, titles per subreddit, flairs), newsletters (blurb, pitch email, ThursdAI DM), press (pitch, one-page backgrounder with a quote for Kai to approve, Chinese pitch for 机器之心 and 量子位), comments (HN, X reply, LinkedIn comment, Discord, awesome-list line, LangChain forum reply), schedule.
4. Check lengths by script: X posts at 280 with URLs counted as 23; Product Hunt limits; HN title.
5. Lint every version with ai-rhetoric-lint, write the report to the scratchpad, quote its Total line, say "linted". Record Kai's mandated lines ("took the AI community by storm", "Transform your agents...") as PUFFERY hits kept by instruction, with a flat alternative.
6. Deliver two files: the full kit (with schedule and posting notes) and a content-only copy: image first, one heading per piece, no bold labels, no instructions except one italic "Posting:" line per channel. Build .docx with python-docx from the project venv (pandoc and LibreOffice are absent); convert webp images to PNG first; verify by reading the document back (headings, pictures, no stray asterisks).
7. Cut assets from the launch image with PIL: Product Hunt logo 240×240 (the blue box on the image's background), gallery 1270×760, GitHub social preview 1280×640.
8. Schedule: prep the week before (README placeholder, social preview, MP4 conversions, MCP registry and marketplace submissions, origin re-point); Show HN Tuesday 08:30 ET with the first comment, then X, LinkedIn, r/ClaudeCode and r/AI_Agents, Discords, newsletters, press, amplifier DMs; day two r/mcp, r/ClaudeAI, dev.to, Chinese channels; Product Hunt a week later at 00:01 PT; awesome lists after 14 days or 100 stars.

## Gotchas

- X's oEmbed and profile pages return 402 to fetchers; tweet text comes only from search snippets. LinkedIn post pages need login; fetches return the first lines only. GitHub's API gives `twitter_username` for authors.
- The ecosystem's own posts use no hashtags; mentions do the work. The seed tags above match the category's name on TypeSafe's blog, Cua's launch tweet and systemonemodels.org.
- Laya and Cua-S1 Nano "after Jev" is Kai's statement; the repository records no release order.
- Product Hunt: make the product, not a forum thread; self-hunt; expect a mid-table result and keep the listing.