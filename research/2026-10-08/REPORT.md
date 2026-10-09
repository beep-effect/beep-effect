# Nightly research packet — 2026-10-08

Window: `2026-10-06T08:30:00-05:00` → `2026-10-08T08:30:00-05:00` (~48h, America/Chicago). The previous packet, [PR #1497](https://github.com/beep-effect/beep-effect/pull/1497) (research/2026-10-06), merged 2026-10-06 2:03 PM CT. The 10-07 run was skipped because the stamp was under 24h old. It is Thursday, so there is no weekly consolidation. Status **partial**: this harness has no blinded local verifier. X search worked this run through Grok Bot's own X access, with one short shared rate-limit (HTTP 429) burst. The writer stage was blinded: no clone, built only from structured finding records.

## Delta-first

### New (window)

- **Harvey publishes its MCP Policy Engine.** A "Tool Pinner" records each approved partner MCP tool's model-facing description and input schema, and flags any addition, removal or change for Security review. A Sanitizer strips hidden characters and injected instructions from tool results. Policies run outside the model and check each proposed action against earlier workflow steps ([Harvey — Building Harvey's MCP Policy Engine, Oct 7](https://www.harvey.ai/blog/building-harveys-mcp-policy-engine); [Harvey on X](https://x.com/harvey/status/2107860973554130989)). This is the first legal-AI vendor to publish a runtime MCP governance design. Its premise: "MCP does not require versioning of individual tool definitions".
- **Patent-drafting RCT (Google Research / NBER).** 133 patent lawyers at 11 US IP firms took part. AI raised draft quality by +0.34 SD at 10 days and +0.38 SD at 90 days. On an unassisted redlining task, only seniors improved (+0.45 SD); juniors showed no average gain and split into more good and more poor scores ([Google Research blog, Oct 7](https://research.google/blog/does-better-work-always-mean-better-workers/); [NBER w35720](https://www.nber.org/papers/w35720)). This matters for how IP tooling serves junior and solo practitioners.
- **Legal-AI market moves (Oct 6–8):**
  - BMW Group is rolling out Legora across its Legal, IP and Compliance function. Legora reports more than 13,000 users in Germany, up from about 3,000 in January ([Legora newsroom, Oct 8](https://legora.com/newsroom/legora-collaborates-with-bmw-group-to-advance-ai-enabled-legal-services)).
  - Thomson Reuters UK previewed next-gen CoCounsel Legal, with matter workspaces of up to 200 documents and visible reasoning. No GA date ([TR UK blog, Oct 6](https://legalsolutions.thomsonreuters.co.uk/blog/2026/10/06/the-next-generation-of-cocounsel-legal/)).
  - Ivo open-sourced **Sage**, a contract model post-trained on DeepSeek V4 Flash ([Artificial Lawyer, Oct 7](https://www.artificiallawyer.com/2026/10/07/ivo-launches-open-source-deepseek-contract-ai-model/)).
  - Wolters Kluwer added Drafting to Libra ([AFP, Oct 7](https://www.afp.com/en/infos/wolters-kluwer-brings-ai-powered-drafting-directly-libra-legal-workspace)), and LawVu launched Lens ([Artificial Lawyer, Oct 7](https://www.artificiallawyer.com/2026/10/07/lawvu-launches-lens-total-contract-ai-capability/)).
  - Teddy AI closed a **$60M seed** for a legal-services rollup and reports more than $25M in revenue ([The Legal Wire, Oct 8](https://thelegalwire.ai/stealthy-legal-services-startup-teddy-ai-closes-60m-seed-round/)).
- **MCP security and spec:**
  - [GHSA-6qxp-vccf-f47h / CVE-2026-104850](https://github.com/modelcontextprotocol/typescript-sdk/security/advisories/GHSA-6qxp-vccf-f47h) (CVSS 7.5). The TS SDK OAuth client sent stored credentials to an authorization server chosen by the MCP server. It is fixed in `@modelcontextprotocol/sdk` 1.31.0 / `client` 2.2.0, but the fix also needs `expectedIssuer` on bundled providers and `issuer` on persisted credentials. beep main already bumped the transitive SDK to 1.31.0 in [#1500](https://github.com/beep-effect/beep-effect/pull/1500).
  - **SEP-2127 MCP Server Cards merged** Oct 6. It adds pre-connection discovery through `.well-known/ai-catalog.json` ([modelcontextprotocol #2127](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2127)).
  - The MCP Inspector 2.10 docs add a security page and the `mcpdo` client. They warn that secret storage falls back to plaintext when no keychain is available ([modelcontextprotocol #3418](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/3418)).
- **tsc-rs (ts-rust): an agent-written Rust port of TypeScript 7 with Effect diagnostics built in.** Its README says all 181,711 ported Go tests pass. Effect language-service diagnostics (codes 377xxx, ported from Effect-TS/tsgo 0.46.1) run in the same check. On T3 Code with Effect diagnostics it takes 11.13s, against 21.07s for tsc 7 + `@effect/tsgo` ([pingdotgg/ts-rust](https://github.com/pingdotgg/ts-rust); [Theo on X, Oct 7](https://x.com/theo/status/2107789940482621795)). Meanwhile `@effect/tsgo` itself went 0.49.0 → 0.51.1 in about 24h ([npm 0.51.1](https://www.npmjs.com/package/@effect/tsgo/v/0.51.1)), so the port's rule set already lags.
- **effect@4.0.2 AI and MCP surface changes:**
  - AI tracing moves to current OTel GenAI conventions. `gen_ai.system`, `WellKnownSystem` and related types are removed inside a patch release ([Effect #8870](https://github.com/Effect-TS/effect/pull/8870)).
  - `McpServer.layerHttp` gets opt-in session termination via DELETE and stricter protocol-version and session-header errors ([Effect #8773](https://github.com/Effect-TS/effect/pull/8773)).
- **Agent and harness security research (arXiv, Oct 6–7):**
  - Auto-approve raises coding-harness attack success from 29.2% to 95.6% across six harnesses ([2610.07639 HarnessSecurity-Bench](https://arxiv.org/abs/2610.07639)).
  - Prompt injection in AGENTS.md/.cursorrules swaps dependencies for attacker packages ([2610.09264 PackHallu](https://arxiv.org/abs/2610.09264)).
  - The same Skill helps one model–harness configuration and hurts another on 36.78% of tasks ([2610.08875](https://arxiv.org/abs/2610.08875)).
  - Skill routing cuts naive injection success by 87–97%, but router-aware attacks recover it ([2610.08098 CORSA](https://arxiv.org/abs/2610.08098)).
  - Mined repo norms lift Contribution NCR by 31.6–45.4% ([2610.07757 RepoNorm](https://arxiv.org/abs/2610.07757)).
  - Lean 4 certificates show task–test conflicts before an agent cheats ([2610.09159 SpecGuard](https://arxiv.org/abs/2610.09159)).
  - Ontology-graded action reversibility helps only 8 of 18 model–domain cells ([2610.08082 POLAR](https://arxiv.org/abs/2610.08082)).
  - Dynamic sub-agent concurrency shows 13 concurrency-specific failure modes across 2,124 runs ([2610.10263](https://arxiv.org/abs/2610.10263)).
- **Harness releases:**
  - Claude Code [v2.1.294](https://github.com/anthropics/claude-code/releases/tag/v2.1.294) fixes prompt and agent hooks written as instructions allowing what they should block. [v2.1.292](https://github.com/anthropics/claude-code/releases/tag/v2.1.292) fixes a UNC-path permission bypass.
  - Claude Code [v2.1.293](https://github.com/anthropics/claude-code/releases/tag/v2.1.293) makes Haiku 5.5 the default (1M context) and fixes an HTTP MCP memory leak.
  - Codex [rust-v0.161.0](https://github.com/openai/codex/releases/tag/rust-v0.161.0) adds `/mcp login` and makes GPT-6.1 Sol the default.
- **On-device retrieval:** EmbeddingGemma 2 is open and natively multimodal (740M, modular) ([Google blog, Oct 6](https://blog.google/innovation-and-ai/technology/developers-tools/embeddinggemma-2/)).
- **MCP adoption datapoint:** Resend's MCP server went from 106,719 calls in April to 3,003,809 in September ([Zeno Rocha on X, Oct 6](https://x.com/zenorocha/status/2107501161913729527)).

### Moved

- **Evolu 8.18.0 → 8.19.0.** A new `DatabaseHeldError` makes the database refuse to start after a 10s bounded wait on held web database files. Exhaustive `EvoluError` switches must add a case ([@evolu/common 8.19.0](https://github.com/evoluhq/evolu/releases/tag/%40evolu/common%408.19.0)).
- **Zero canary.25 → canary.29.** The head tag is now `1.11.0-head-79adc09f-20261008`, with six head builds on Oct 8 ([npm canary.29](https://www.npmjs.com/package/@rocicorp/zero/v/1.11.0-canary.29)).
- **TanStack DB 0.12.0 → 0.12.3**, a fast patch train after the sync-semantics break ([npm 0.12.3](https://www.npmjs.com/package/@tanstack/db/v/0.12.3)).
- **Legora Skills adoption push.** Enablement sessions run Oct 14–15 ([Legora on X](https://x.com/WeAreLegora/status/2107855971582455846)), and Legaltech News covered the launch ([LTN on X](https://x.com/Legaltech_news/status/2107572542152286619)).

### Contradicted

- **"Legora Skills is the first legal-AI productization of SKILL.md" is contested.** A practitioner argues Legora (like Harvey) already had the same capability as "workflows". On that view, what is new is the Markdown-file format and auto-invocation ([Will Chen on X, Oct 7](https://x.com/willchen500/status/2107697656751677644)). The prior packet's framing is softened, not reversed.

### Settled

- **effect@4.0.2 shipped Oct 7**, closing the "#8744 staging 4.0.2" watch. It includes the MCP toolkit typing fix #8842 and DecisionModel images #8832 ([effect@4.0.2 release](https://github.com/Effect-TS/effect/releases/tag/effect%404.0.2)).
- [#1497](https://github.com/beep-effect/beep-effect/pull/1497) (research/2026-10-06) is MERGED. The stamp promotes `lastSuccessful*` to it.

### HOLD (refutation attempted, stands)

- Harvey↔Everlaw is still "expected … in fall 2026", with no GA found Oct 8 ([Everlaw blog](https://www.everlaw.com/blog/ai-and-law/harvey-everlaw-integration-massive-scale/)).
- TR v. ROSS: ROSS has announced its intent to seek cert, but no petition was found ([LawSites, Oct 2](https://www.lawnext.com/2026/10/ross-says-it-will-ask-supreme-court-to-review-3rd-circuit-ruling-for-thomson-reuters-in-copyright-case.html)).
- The SEP-2640 Python SDK, [python-sdk #3485](https://github.com/modelcontextprotocol/python-sdk/pull/3485), is still OPEN.
- Jazz is still at [v2.0.0-alpha.59](https://github.com/garden-co/jazz/releases/tag/v2.0.0-alpha.59).

### Time-sensitive

- Legora Skills sessions are on Oct 14–15 ([Legora on X](https://x.com/WeAreLegora/status/2107855971582455846)). The USPTO SI vendor roundtable is Oct 15 (carried from the prior packet; the RSVP deadline was Oct 7) ([FedSift — USPTO-26-RFI001](https://app.fedsift.app/solicitations/3bf5bdb6cb8e42d6ba58d8c0fab6f581)).
- **MCP OAuth issuer binding:** any beep MCP *client* using `authProvider` should verify that `expectedIssuer` is set and that persisted credentials carry `issuer` ([GHSA-6qxp-vccf-f47h](https://github.com/modelcontextprotocol/typescript-sdk/security/advisories/GHSA-6qxp-vccf-f47h)).

## Topical appendix

### Law / legal-AI / IP

- The competitive frontier moved from connectors to **governing** connectors. [Harvey's Policy Engine](https://www.harvey.ai/blog/building-harveys-mcp-policy-engine) pins tool definitions, while [SEP-2127 Server Cards](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2127) add a new pre-connection metadata surface to pin.
- Incumbents converge on a single workspace for research, review and drafting:
  - [TR CoCounsel next-gen](https://legalsolutions.thomsonreuters.co.uk/blog/2026/10/06/the-next-generation-of-cocounsel-legal/)
  - [Wolters Kluwer Libra Drafting](https://www.afp.com/en/infos/wolters-kluwer-brings-ai-powered-drafting-directly-libra-legal-workspace)
  - [LawVu Lens](https://www.artificiallawyer.com/2026/10/07/lawvu-launches-lens-total-contract-ai-capability/)
- Price pressure comes from open weights ([Ivo Sage](https://www.artificiallawyer.com/2026/10/07/ivo-launches-open-source-deepseek-contract-ai-model/)) and from service rollups ([Teddy AI](https://thelegalwire.ai/stealthy-legal-services-startup-teddy-ai-closes-60m-seed-round/)).
- IP-practice evidence: AI improves drafts but does not train juniors ([Google/NBER RCT](https://research.google/blog/does-better-work-always-mean-better-workers/)). This argues for tools that keep a senior-review step, which is relevant to the solo-lawyer (Tom) positioning.

### Effect / schema-first / local-first

- After 4.0.2, check beep's `@effect/ai` telemetry options ([#8870](https://github.com/Effect-TS/effect/pull/8870)) and mcp-kit HTTP hosts ([#8773](https://github.com/Effect-TS/effect/pull/8773)) before bumping.
- Type-checker race:
  - [tsc-rs](https://github.com/pingdotgg/ts-rust) runs Effect diagnostics in one Rust pass.
  - `bun check` is faster but has no Effect diagnostics (per the tsc-rs README).
  - [`@effect/tsgo`](https://www.npmjs.com/package/@effect/tsgo/v/0.51.1) ships minors daily.
- Local-first libraries keep breaking in small ways ([Evolu 8.19.0](https://github.com/evoluhq/evolu/releases/tag/%40evolu/common%408.19.0), [TanStack DB 0.12.3](https://www.npmjs.com/package/@tanstack/db/v/0.12.3)). On-device multimodal embeddings ([EmbeddingGemma 2](https://blog.google/innovation-and-ai/technology/developers-tools/embeddinggemma-2/)) and agent-per-database SQLite ([Turso joining Supabase, Oct 2, late catch](https://turso.tech/blog/turso-is-joining-supabase)) widen the local stack.

### Agents / MCP / skills / ontologies / neural-symbolic

- Rule files and skills are both supply-chain surfaces ([PackHallu](https://arxiv.org/abs/2610.09264), [CORSA](https://arxiv.org/abs/2610.08098)). Harness defaults matter more than mechanisms ([HarnessSecurity-Bench](https://arxiv.org/abs/2610.07639)), and LLM-judged hooks can false-allow ([Claude Code v2.1.294](https://github.com/anthropics/claude-code/releases/tag/v2.1.294)).
- Skill value depends on the configuration ([2610.08875](https://arxiv.org/abs/2610.08875)). This argues for per-harness evaluation of beep skills rather than assuming portability.
- Neural-symbolic guards:
  - Lean certificates for task/test conflicts ([SpecGuard](https://arxiv.org/abs/2610.09159)).
  - Ontology-graded reversibility ([POLAR](https://arxiv.org/abs/2610.08082)).
  - A rule-language decision matrix ([2610.07313](https://arxiv.org/abs/2610.07313), late catch).
- Repo-norm compliance ([RepoNorm](https://arxiv.org/abs/2610.07757)) and sub-agent concurrency failures ([2610.10263](https://arxiv.org/abs/2610.10263)) bear on yeet/commitlint discipline and parallel-agent PRs.

## Counts & run status

- **Claims:** 40 (34 window_new, 6 refute, 2 late catches; law 12 / effect 11 / agents 17).
- **Novelty:** canonical exclusion collision is **7.5%**: 3 of 40 unique claim URLs appear in the 321-URL digest ([Everlaw blog](https://www.everlaw.com/blog/ai-and-law/harvey-everlaw-integration-massive-scale/), [python-sdk #3485](https://github.com/modelcontextprotocol/python-sdk/pull/3485), [Jazz alpha.59](https://github.com/garden-co/jazz/releases/tag/v2.0.0-alpha.59)), all deliberate HOLD refutes. Window-new collision is **0.0%**, and there are no tombstone collisions. Under the 40% gate, so no self-reject.
- **RUN:** **partial** because there is no blinded local verifier. X search was available (one transient 429), and every other source was OK.

## Source index

https://github.com/beep-effect/beep-effect/pull/1497
https://www.harvey.ai/blog/building-harveys-mcp-policy-engine
https://x.com/harvey/status/2107860973554130989
https://research.google/blog/does-better-work-always-mean-better-workers/
https://www.nber.org/papers/w35720
https://legora.com/newsroom/legora-collaborates-with-bmw-group-to-advance-ai-enabled-legal-services
https://legalsolutions.thomsonreuters.co.uk/blog/2026/10/06/the-next-generation-of-cocounsel-legal/
https://www.artificiallawyer.com/2026/10/07/ivo-launches-open-source-deepseek-contract-ai-model/
https://www.afp.com/en/infos/wolters-kluwer-brings-ai-powered-drafting-directly-libra-legal-workspace
https://www.artificiallawyer.com/2026/10/07/lawvu-launches-lens-total-contract-ai-capability/
https://thelegalwire.ai/stealthy-legal-services-startup-teddy-ai-closes-60m-seed-round/
https://github.com/modelcontextprotocol/typescript-sdk/security/advisories/GHSA-6qxp-vccf-f47h
https://github.com/beep-effect/beep-effect/pull/1500
https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2127
https://github.com/modelcontextprotocol/modelcontextprotocol/pull/3418
https://github.com/pingdotgg/ts-rust
https://x.com/theo/status/2107789940482621795
https://www.npmjs.com/package/@effect/tsgo/v/0.51.1
https://github.com/Effect-TS/effect/pull/8870
https://github.com/Effect-TS/effect/pull/8773
https://arxiv.org/abs/2610.07639
https://arxiv.org/abs/2610.09264
https://arxiv.org/abs/2610.08875
https://arxiv.org/abs/2610.08098
https://arxiv.org/abs/2610.07757
https://arxiv.org/abs/2610.09159
https://arxiv.org/abs/2610.08082
https://arxiv.org/abs/2610.10263
https://github.com/anthropics/claude-code/releases/tag/v2.1.294
https://github.com/anthropics/claude-code/releases/tag/v2.1.292
https://github.com/anthropics/claude-code/releases/tag/v2.1.293
https://github.com/openai/codex/releases/tag/rust-v0.161.0
https://blog.google/innovation-and-ai/technology/developers-tools/embeddinggemma-2/
https://x.com/zenorocha/status/2107501161913729527
https://github.com/evoluhq/evolu/releases/tag/%40evolu/common%408.19.0
https://www.npmjs.com/package/@rocicorp/zero/v/1.11.0-canary.29
https://www.npmjs.com/package/@tanstack/db/v/0.12.3
https://x.com/WeAreLegora/status/2107855971582455846
https://x.com/Legaltech_news/status/2107572542152286619
https://x.com/willchen500/status/2107697656751677644
https://github.com/Effect-TS/effect/releases/tag/effect%404.0.2
https://www.everlaw.com/blog/ai-and-law/harvey-everlaw-integration-massive-scale/
https://www.lawnext.com/2026/10/ross-says-it-will-ask-supreme-court-to-review-3rd-circuit-ruling-for-thomson-reuters-in-copyright-case.html
https://github.com/modelcontextprotocol/python-sdk/pull/3485
https://github.com/garden-co/jazz/releases/tag/v2.0.0-alpha.59
https://app.fedsift.app/solicitations/3bf5bdb6cb8e42d6ba58d8c0fab6f581
https://turso.tech/blog/turso-is-joining-supabase
https://arxiv.org/abs/2610.07313
