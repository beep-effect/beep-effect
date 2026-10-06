# SOURCES — 2026-10-06

Quarantined evidence: short fenced quotes only, sanitized (no tokens / high-entropy strings). Canonical links per finding.

## Law / legal-AI / IP

- **f-law-01** — Legora launches Skills (Markdown skill files) for all customers (2026-10-05): https://legora.com/blog/introducing-skills

  ```text
  A Skill is a set of natural language instructions, saved as a Markdown file, that teaches the Agent how to approach a specific legal task.
  ```

- **f-law-02** — NetDocuments connects to Microsoft Copilot over MCP (ndMAX Enterprise) (2026-10-05): https://conventuslaw.com/press-releases/netdocuments-connects-organizational-legal-knowledge-to-microsoft-copilot-through-mcp/

  ```text
  Starting today, NetDocuments connects to Microsoft Copilot through Model Context Protocol, or MCP.
  ```

- **f-law-03** — Pandektes €13.5M Series A — legal data layer + API built for AI agents (2026-10-05): https://pandektes.com/blog/pandektes-13-5m-series-a

  ```text
  built from the ground up for AI agents and other machine systems
  ```

- **f-law-04** — DWT: USPTO opens door wider for AI patents (Squires Senate testimony, Desjardins, SMED) (2026-10-05): https://www.dwt.com/insights/2026/10/uspto-ai-patent-eligibility-guidance

  ```text
  The USPTO is encouraging applicants to submit AI-related patent applications notwithstanding potential eligibility concerns.
  ```

- **f-law-05** — ROSS plans cert petition after 3d Cir. affirmed no fair use for Westlaw headnote training (2026-10-05): https://www.theamericancounsel.com/ross-plans-a-supreme-court-challenge-to-the-third-circuits-fair-use-ruling-in-thomson-reuters-v-ross-intelligence/

  ```text
  The Supreme Court has not agreed to hear the case.
  ```

- **f-law-06** — Contrary Research: legal AI business models (seat vs consumption; Harvey margin squeeze) (2026-10-05): https://contraryresearch.substack.com/p/the-path-forward-for-legal-ai

  ```text
  This dynamic has caused Harvey’s margins to decline from 50% to -50% as customer usage increased this year.
  ```

- **f-law-07** — TC Energy deploys Harvey across legal team (Harvey-First directive) (2026-10-05): https://www.harvey.ai/blog/tc-energy-deploys-harvey-across-its-legal-team

  ```text
  TC Energy introduced a “Harvey-First” directive, encouraging lawyers to use Harvey as a first pass on their work.
  ```

- **f-law-08** — Legora native iManage Cloud read+write-back (Oct 2) — late catch (2026-10-02): https://legora.com/blog/your-imanage-in-legora

  ```text
  save the result back to iManage
  ```

- **f-law-09** — Refute attempt: Harvey↔Everlaw MCP still 'fall 2026' (HOLD) (2026-08-27): https://www.everlaw.com/blog/ai-and-law/harvey-everlaw-integration-massive-scale/

  ```text
  Everlaw’s integration with Harvey is expected to be available to joint customers in fall 2026.
  ```

- **f-law-10** — Esgenix Self-Serve: pay-as-you-go agentic patent workflows for solo practitioners (late catch) (2026-10-02): https://www.einpresswire.com/article/946678994/esgenix-launches-self-serve-ai-patent-workflows-for-solo-practitioners-smaller-firms-and-inventors

  ```text
  Esgenix uses decision-gated agentic workflows
  ```

- **f-law-11** — USPTO 'Super Intelligence' vendor roundtable Oct 15 (RSVP by Oct 7) (2026-09-24): https://app.fedsift.app/solicitations/3bf5bdb6cb8e42d6ba58d8c0fab6f581

  ```text
  RSVP via email ... by Wednesday, October 7, 2026.
  ```

## Effect / schema-first / local-first

- **f-effect-01** — effect@4.0.1 published — #8647 shipped a PATCH, not the staged 4.1.0 (2026-10-04): https://github.com/Effect-TS/effect/releases/tag/effect%404.0.1

  ```text
  Preserve all Anthropic system instructions and support configurable mid-conversation system messages.
  ```

- **f-effect-02** — Effect #8744 Version Packages OPEN — staging effect@4.0.2 (2026-10-06): https://github.com/Effect-TS/effect/pull/8744

  ```text
  Version Packages
  ```

- **f-effect-03** — Effect #8842 merged: MCP toolkit registration preserves service requirements (2026-10-06): https://github.com/Effect-TS/effect/pull/8842

  ```text
  Incomplete servers could previously compile and fail with errors such as `Service not found: effect/HttpClient`.
  ```

- **f-effect-04** — Effect #8853: trusted /effect-bot maintainer comment relay (HMAC-signed, fail-closed) (2026-10-06): https://github.com/Effect-TS/effect/pull/8853

  ```text
  Missing signing configuration fails closed before network access; there is no unsigned fallback.
  ```

- **f-effect-05** — Refute: Effect #8692 DateTime Hermes fix CLOSED unmerged (was OPEN) (2026-10-04): https://github.com/Effect-TS/effect/pull/8692

  ```text
  fix(DateTime): read zone formatter parts by type
  ```

- **f-effect-06** — Evolu @evolu/common 8.17.0 → 8.18.0 (+ relay 4.2.2) — near-full sync message fix (2026-10-04): https://github.com/evoluhq/evolu/releases/tag/%40evolu/common%408.18.0

  ```text
  Fixed sync failing when a protocol message was nearly full
  ```

- **f-effect-07** — jazz-tools 2.0.0-alpha.58 → alpha.59 — ~12% smaller WASM, faster permissioned writes (2026-10-04): https://github.com/garden-co/jazz/releases/tag/v2.0.0-alpha.59

  ```text
  alpha.59 is a non-breaking upgrade from alpha.58.
  ```

- **f-effect-08** — Rocicorp Zero canary.23 → canary.25; head at 311b05ae-20261006 (2026-10-05): https://www.npmjs.com/package/@rocicorp/zero/v/1.11.0-canary.25

  ```text
  canary: 1.11.0-canary.25
  ```

- **f-effect-09** — TanStack DB 0.12.0 — breaking optimistic/sync semantics (accepted vs visible) (2026-10-05): https://github.com/TanStack/db/releases/tag/%40tanstack/db%400.12.0

  ```text
  Each sync transaction now has two moments: accepted and visible.
  ```

- **f-effect-10** — Effect #8832 merged: DecisionModel.decide accepts images (2026-10-06): https://github.com/Effect-TS/effect/pull/8832

  ```text
  Allows `DecisionModel.decide` to accept images.
  ```

## Agents / MCP / skills / ontologies

- **f-agents-01** — Agent Skill Evolution: how SKILL.md revisions affect coding agents (arXiv 2610.04832) (2026-10-04): https://arxiv.org/abs/2610.04832

  ```text
  Most revisions (55%) change a rule or procedure
  ```

- **f-agents-02** — Runaway Reaction (CRIME): benign skills compose into malicious behavior (arXiv 2610.05943) (2026-10-05): https://arxiv.org/abs/2610.05943

  ```text
  directly composing benign skills can already induce malicious behaviors, even when every individual skill passes security vetting
  ```

- **f-agents-03** — MCPacific: 124,267 MCP servers / 1.33M tools mapped (arXiv 2610.05319) (2026-10-04): https://arxiv.org/abs/2610.05319

  ```text
  MCP extends well beyond developer tooling, with 85% of tools serving other domains.
  ```

- **f-agents-04** — SWE-CC: repository-policy compliance benchmark for coding agents (arXiv 2610.06193) (2026-10-05): https://arxiv.org/abs/2610.06193

  ```text
  passing functional tests differs fundamentally from producing a high-quality contribution acceptable for merging
  ```

- **f-agents-05** — Compromise Is Not Consequence: task-scoped authorization contains injected tool calls (arXiv 2610.05840) (2026-10-05): https://arxiv.org/abs/2610.05840

  ```text
  broad-bearer harmful execution ranges from 8.9% to 37.8% across models; all three scoped conditions record zero
  ```

- **f-agents-06** — Mining Agent Skills from Production Traces — workflow vs declarative-ontology skill forms (arXiv 2610.05777) (2026-10-05): https://arxiv.org/abs/2610.05777

  ```text
  Skill form has two types: an ordered workflow plan, or a declarative ontology of entities, states, and policies.
  ```

- **f-agents-07** — MERGEGYM: concurrent coding agents — 47.3% of conflicts despite disjoint files (arXiv 2610.04779) (2026-10-03): https://arxiv.org/abs/2610.04779

  ```text
  79 conflicts (47.3%) occur despite disjoint authored file sets
  ```

- **f-agents-08** — MCP docs: Local Server Security guide merged (stdio = single trust domain) (2026-10-05): https://github.com/modelcontextprotocol/modelcontextprotocol/pull/3072

  ```text
  client and server share one trust domain — the transport is not a sandbox
  ```

- **f-agents-09** — MCP TypeScript SDK v2.3.1 — expectedResource token-audience binding reaches server-legacy (2026-10-05): https://github.com/modelcontextprotocol/typescript-sdk/releases/tag/v2.3.1

  ```text
  it accepts only tokens issued for this server (the token's audience). Off unless you set it.
  ```

- **f-agents-10** — Claude Code v2.1.290 — mod hooks get agentId + org approval 'ceiling' (2026-10-05): https://github.com/anthropics/claude-code/releases/tag/v2.1.290

  ```text
  Added `ceiling` to the question and verdict a mod's `tool.check` hook reads, naming the approval an organization requires for a tool
  ```

- **f-agents-11** — Four unauthenticated MCP-server CVEs (GitLab, Bifrost, mysql-mcp, IBM ContextForge) + LiteLLM MCP auth bypass on CISA KEV (2026-10-04): https://dev.to/kielltampubolon/mcp-servers-had-a-rough-48-hours-4-unauthenticated-cves-4oco

  ```text
  something treated "can reach my port" as "may call my tools"
  ```

- **f-agents-12** — Refute attempt: SEP-2640 Tier-1 SDK ship gate — py#3485 now mergeable 'clean' but still OPEN (2026-09-30): https://github.com/modelcontextprotocol/python-sdk/pull/3485

  ```text
  Add `Skills` extension
  ```

- **f-agents-13** — Law&Order: neuro-symbolic tax-law autoformalization (arXiv 2610.02792, late catch) (2026-10-02): https://arxiv.org/abs/2610.02792

  ```text
  a neuro-symbolic framework for automatically formalizing tax forms and instructions into executable symbolic programs
  ```
