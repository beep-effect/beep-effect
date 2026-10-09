# SOURCES — 2026-10-08

Quarantined evidence: short fenced quotes only, sanitized (no tokens / high-entropy strings). Canonical links per finding. Registry-derived facts (npm dist-tags/timestamps) are quoted as the registry value.

## Law / legal-AI / IP

- **f-law-01** — Harvey ships an MCP Policy Engine (Tool Pinner + Sanitizer) for partner MCP connectors (2026-10-07): https://www.harvey.ai/blog/building-harveys-mcp-policy-engine

  ```text
  MCP does not require versioning of individual tool definitions, so a tool can change after approval
  ```

- **f-law-02** — Google/NBER RCT: AI drafting lifts patent work quality but juniors gain no unassisted skill (2026-10-07): https://research.google/blog/does-better-work-always-mean-better-workers/

  ```text
  junior lawyers show no average skill gain, their scores splitting into more strong scores and more low scores
  ```

- **f-law-03** — BMW Group rolls out Legora across its Legal, IP and Compliance function (2026-10-08): https://legora.com/newsroom/legora-collaborates-with-bmw-group-to-advance-ai-enabled-legal-services

  ```text
  Legora, the agentic operating system for legal professionals, today announced that BMW Group is rolling out Legora across its legal department
  ```

- **f-law-04** — Thomson Reuters previews next-gen CoCounsel Legal for UK (matter workspaces, visible reasoning) (2026-10-06): https://legalsolutions.thomsonreuters.co.uk/blog/2026/10/06/the-next-generation-of-cocounsel-legal/

  ```text
  Spin up a workspace for each matter, upload up to 200 documents
  ```

- **f-law-05** — Ivo open-sources Sage, a contract model post-trained on DeepSeek V4 Flash (2026-10-07): https://www.artificiallawyer.com/2026/10/07/ivo-launches-open-source-deepseek-contract-ai-model/

  ```text
  Branded as Sage, it was built in partnership with River AI by post-training DeepSeek V4 Flash on long-horizon contract work.
  ```

- **f-law-06** — Teddy AI closes $60M seed for an AI-enabled legal-services rollup (2026-10-08): https://thelegalwire.ai/stealthy-legal-services-startup-teddy-ai-closes-60m-seed-round/

  ```text
  TeddyHoldings.AI has closed a $60 million seed round from undisclosed limited partners
  ```

- **f-law-07** — Wolters Kluwer adds Drafting (Libra Editor) to its Libra legal AI workspace (2026-10-07): https://www.afp.com/en/infos/wolters-kluwer-brings-ai-powered-drafting-directly-libra-legal-workspace

  ```text
  Wolters Kluwer Legal & Regulatory today announced the launch of Drafting, a major new capability within Libra by Wolters Kluwer
  ```

- **f-law-08** — LawVu launches Lens contract-portfolio AI as part of its LegalOS (2026-10-07): https://www.artificiallawyer.com/2026/10/07/lawvu-launches-lens-total-contract-ai-capability/

  ```text
  Inhouse-focused LawVu has launched Lens, an AI contract analysis tool
  ```

- **f-law-09** — Legora schedules Skills enablement sessions Oct 14–15; Law.com covers launch (2026-10-07): https://x.com/WeAreLegora/status/2107855971582455846

  ```text
  Join Legora's Product and Legal Engineering teams next week on Wednesday, October 14, and Thursday, October 15, for a session on Skills.
  ```

- **f-law-10** — Contested: Legora Skills framed as a rename of existing 'workflows' (as in Harvey) (2026-10-07): https://x.com/willchen500/status/2107697656751677644

  ```text
  In Legora’s defence they have had Skills since forever, it was just called “workflows” like in Harvey.
  ```

- **f-law-11** — HOLD: ROSS has announced but not filed a cert petition in TR v. ROSS (2026-10-02): https://www.lawnext.com/2026/10/ross-says-it-will-ask-supreme-court-to-review-3rd-circuit-ruling-for-thomson-reuters-in-copyright-case.html

  ```text
  ROSS Says It Will Ask Supreme Court to Review 3rd Circuit Ruling for Thomson Reuters in Copyright Case
  ```

- **f-law-12** — HOLD: Harvey↔Everlaw integration still 'fall 2026', no GA found Oct 8 (2026-10-08): https://www.everlaw.com/blog/ai-and-law/harvey-everlaw-integration-massive-scale/

  ```text
  Everlaw’s integration with Harvey is expected to be available to joint customers in fall 2026.
  ```

## Effect / schema-first / local-first

- **f-effect-01** — effect@4.0.2 shipped Oct 7 (settles #8744) incl. MCP toolkit typing fix #8842 (2026-10-07): https://github.com/Effect-TS/effect/releases/tag/effect%404.0.2

  ```text
  Fix MCP toolkit registration to require tool handler and schema services.
  ```

- **f-effect-02** — effect 4.0.2 rewrites AI tracing to current OTel GenAI conventions (API removals in a patch) (2026-10-07): https://github.com/Effect-TS/effect/pull/8870

  ```text
  Update AI tracing to use current OpenTelemetry GenAI conventions
  ```

- **f-effect-03** — McpServer.layerHttp gains opt-in session termination and stricter protocol-version handling (4.0.2) (2026-10-07): https://github.com/Effect-TS/effect/pull/8773

  ```text
  Add opt-in allowSessionTermination to McpServer.layerHttp.
  ```

- **f-effect-04** — tsc-rs (ts-rust): agent-written Rust port of TypeScript 7 with Effect diagnostics built in (2026-10-07): https://github.com/pingdotgg/ts-rust

  ```text
  `tsc-rs` has the [Effect](https://effect.website) language service diagnostics built in (codes 377xxx), so an Effect project needs no second compiler.
  ```

- **f-effect-05** — @effect/tsgo moved 0.49.0 → 0.51.1 in ~24h (tsc-rs pins 0.46.1) (2026-10-07): https://www.npmjs.com/package/@effect/tsgo/v/0.51.1

  ```text
  @effect/tsgo latest 0.51.1 published 2026-10-07T16:49:30Z
  ```

- **f-effect-06** — Evolu 8.18.0 → 8.19.0: DatabaseHeldError and bounded wait for held web databases (2026-10-06): https://github.com/evoluhq/evolu/releases/tag/%40evolu/common%408.19.0

  ```text
  If the files are still held 10 seconds after the first attempt started, the database refuses to start with the new DatabaseHeldError.
  ```

- **f-effect-07** — Zero canary.25 → canary.29; head → 1.11.0-head-79adc09f-20261008 (2026-10-08): https://www.npmjs.com/package/@rocicorp/zero/v/1.11.0-canary.29

  ```text
  canary 1.11.0-canary.29 2026-10-08T02:50:23Z; head 1.11.0-head-79adc09f-20261008
  ```

- **f-effect-08** — TanStack DB 0.12.0 → 0.12.3 patch train after the sync-semantics break (2026-10-07): https://www.npmjs.com/package/@tanstack/db/v/0.12.3

  ```text
  @tanstack/db latest 0.12.3 published 2026-10-07T21:13:13Z
  ```

- **f-effect-09** — Late catch: Turso is joining Supabase (agent-per-database SQLite) (2026-10-02): https://turso.tech/blog/turso-is-joining-supabase

  ```text
  Turso is joining Supabase to give every agent its own database
  ```

- **f-effect-10** — EmbeddingGemma 2: open, on-device, natively multimodal embeddings (740M, modular) (2026-10-06): https://blog.google/innovation-and-ai/technology/developers-tools/embeddinggemma-2/

  ```text
  EmbeddingGemma 2 is a best-in-class open model for natively multimodal embeddings
  ```

- **f-effect-11** — HOLD: Jazz still at 2.0.0-alpha.59 (2026-10-08): https://github.com/garden-co/jazz/releases/tag/v2.0.0-alpha.59

  ```text
  jazz-tools dist-tag alpha = 2.0.0-alpha.59
  ```

## Agents / MCP / skills / ontologies / neural-symbolic

- **f-agents-01** — GHSA-6qxp-vccf-f47h / CVE-2026-104850: MCP TS SDK OAuth client sent credentials to server-chosen AS (2026-10-06): https://github.com/modelcontextprotocol/typescript-sdk/security/advisories/GHSA-6qxp-vccf-f47h

  ```text
  In affected versions, the SDK's OAuth client let the MCP server decide which authorization server received the client's OAuth credentials.
  ```

- **f-agents-02** — SEP-2127 MCP Server Cards merged (pre-connection discovery via .well-known) (2026-10-06): https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2127

  ```text
  `.well-known/ai-catalog.json`: HTTP endpoint for pre-connection discovery
  ```

- **f-agents-03** — MCP Inspector 2.10 docs: new security page, mcpdo client, plaintext secret-store fallback warning (2026-10-08): https://github.com/modelcontextprotocol/modelcontextprotocol/pull/3418

  ```text
  the **automatic plaintext fallback** stated as a risk
  ```

- **f-agents-04** — Claude Code 2.1.294 fixes instruction-written prompt/agent hooks allowing what they should block (2026-10-08): https://github.com/anthropics/claude-code/releases/tag/v2.1.294

  ```text
  Fixed prompt and agent hooks written as instructions (such as "Block commands that...") allowing what they should block
  ```

- **f-agents-05** — Claude Code 2.1.293: Haiku 5.5 default (1M ctx), HTTP MCP memory-leak fix (2026-10-07): https://github.com/anthropics/claude-code/releases/tag/v2.1.293

  ```text
  Fixed a memory leak where an HTTP MCP connection kept every request it had sent until it closed
  ```

- **f-agents-06** — Codex 0.161.0: GPT-6.1 Sol default; /mcp login from terminal (2026-10-07): https://github.com/openai/codex/releases/tag/rust-v0.161.0

  ```text
  Sign in to MCP servers from an active terminal session with /mcp login <name>.
  ```

- **f-agents-07** — HarnessSecurity-Bench: auto-approve raises coding-harness attack success 29.2% → 95.6% (2026-10-06): https://arxiv.org/abs/2610.07639

  ```text
  Enabling auto-approve increases utility and raises attack success from 29.2% to 95.6%.
  ```

- **f-agents-08** — PackHallu: prompt injection in AGENTS.md/.cursorrules swaps dependencies for attacker packages (2026-10-07): https://arxiv.org/abs/2610.09264

  ```text
  an attacker injects malicious prompts into benign rule files to induce coding agents to replace legitimate dependencies with attacker-controlled packages
  ```

- **f-agents-09** — Agent Skills downstream utility: same Skill helps one config and hurts another on 36.78% of tasks (2026-10-06): https://arxiv.org/abs/2610.08875

  ```text
  The same Skills help some configurations and hurt others on 36.78% of tasks
  ```

- **f-agents-10** — CORSA: router-aware skill injection — routing cuts naive injections' success 87–97% (2026-10-06): https://arxiv.org/abs/2610.08098

  ```text
  reducing the effective attack success rate (ASR) of existing injections by 87-97%
  ```

- **f-agents-11** — RepoNorm: acquiring/verifying repo contribution norms lifts coding-agent compliance (2026-10-06): https://arxiv.org/abs/2610.07757

  ```text
  Changes produced by coding agents can pass functional tests while leaving repository contribution requirements unmet.
  ```

- **f-agents-12** — SpecGuard: Lean 4 certificates that a task conflicts with its tests before the agent cheats (2026-10-06): https://arxiv.org/abs/2610.09159

  ```text
  SpecGuard autoformalizes the intended behaviour into a Lean 4 specification.
  ```

- **f-agents-13** — POLAR: ontology-graded action reversibility as a pre-execution guardrail (mixed results) (2026-10-06): https://arxiv.org/abs/2610.08082

  ```text
  assesses reversibility through a structured two-layer ontology
  ```

- **f-agents-14** — Dynamic sub-agent concurrency: 13 concurrency-specific failure modes across Codex/Claude Code/Kimi (2026-10-07): https://arxiv.org/abs/2610.10263

  ```text
  Across 354 tasks and 2,124 executions
  ```

- **f-agents-15** — Resend's MCP server: 106,719 calls (Apr) → 3,003,809 (Sep) (2026-10-06): https://x.com/zenorocha/status/2107501161913729527

  ```text
  3 million MCP calls to @resend last month.
  ```

- **f-agents-16** — HOLD: python-sdk SEP-2640 Skills extension (#3485) still OPEN (2026-10-07): https://github.com/modelcontextprotocol/python-sdk/pull/3485

  ```text
  Adds Python SDK support for SEP-2640 (Skills Extension)
  ```

- **f-agents-17** — Late catch: survey of rule-based languages (Datalog/ASP/ProbLog) for neurosymbolic AI (2026-10-05): https://arxiv.org/abs/2610.07313

  ```text
  We analyse over 50 recent systems and applications
  ```
