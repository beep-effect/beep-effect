# Nightly research packet — 2026-10-06

Window: `2026-10-03T08:18:00-05:00` → `2026-10-06T08:30:00-05:00` (~72h, America/Chicago). The 10-04 and 10-05 runs were blocked while [PR #1409](https://github.com/beep-effect/beep-effect/pull/1409) (research/2026-10-03) was open; it merged 2026-10-05 11:29 AM CT. **Includes the Sunday 2026-10-04 weekly consolidation that was deferred** (see the [Weekly consolidation](#weekly-consolidation-owed-from-sunday-2026-10-04) section). Status **partial**: the X connector still returns `client-not-enrolled` ([X projects overview](https://developer.x.com/en/docs/projects/overview)), and this harness has no blinded local verification. Writer stage was blinded: no clone, built only from structured finding records.

## Delta-first

### New (window)

- **Legora ships Skills to all customers.** Skills are Markdown instruction files with references, templates and examples. The Agent invokes them automatically or users pick one with `/`. A 250+ Skill library ships with it, and admins gate org-wide sharing ([Legora — Introducing Skills, Oct 5](https://legora.com/blog/introducing-skills)). This is the first legal-AI competitor to productize the SKILL.md pattern (compare SEP-2640 below).
- **NetDocuments connects to Microsoft Copilot over MCP** for ndMAX Enterprise. Access runs under user credentials, and ethical walls, DLP and audit carry through. NetDocuments also claims a 48% drop in cost per correct answer from its "Legal Context Graph" ([Conventus Law — NetDocuments × Copilot MCP, Oct 5](https://conventuslaw.com/press-releases/netdocuments-connects-organizational-legal-knowledge-to-microsoft-copilot-through-mcp/)).
- **Pandektes raises a €13.5M Series A** (Alstin Capital lead) to become a legal data layer "built from the ground up for AI agents", with a wider API and 500+ organizations using it ([Pandektes blog, Oct 5](https://pandektes.com/blog/pandektes-13-5m-series-a)).
- **USPTO AI-patent posture:** Director Squires' Sep 29 Senate testimony, *Ex parte Desjardins*, the §101 guidance ("50/50 split … in favor of the applicant") and the voluntary SMED declaration (`AF/D.SMED`) are summarized for in-house teams. The guidance does not bind courts ([DWT, Oct 5](https://www.dwt.com/insights/2026/10/uspto-ai-patent-eligibility-guidance)).
- **TR v. ROSS → Supreme Court?** ROSS says it will seek cert after the Third Circuit (Sep 29, No. 25-2153) affirmed that training on Westlaw headnotes was not fair use. The Court has not agreed to hear it ([The American Counsel, Oct 5](https://www.theamericancounsel.com/ross-plans-a-supreme-court-challenge-to-the-third-circuits-fair-use-ruling-in-thomson-reuters-v-ross-intelligence/)). Late catch: no prior packet captured the 3d Cir. affirmance.
- **Legal-AI economics:** Contrary Research says Harvey's margins went from 50% to −50% under seat pricing as usage rose. It frames data, security and agentic infrastructure as the three moats ([Contrary Research, Oct 5](https://contraryresearch.substack.com/p/the-path-forward-for-legal-ai)). Harvey adoption signal: TC Energy rolled out firm-wide under a "Harvey-First" directive ([Harvey blog, Oct 5](https://www.harvey.ai/blog/tc-energy-deploys-harvey-across-its-legal-team)).
- **Effect fixes for MCP and AI.** [#8842](https://github.com/Effect-TS/effect/pull/8842) fixes McpServer toolkit registration dropping service requirements, which previously surfaced only at runtime as `Service not found`. [#8832](https://github.com/Effect-TS/effect/pull/8832) lets `DecisionModel.decide` accept images. Both merged Oct 6.
- **Effect maintainer agent relay.** [#8853](https://github.com/Effect-TS/effect/pull/8853) adds a `/effect-bot` comment relay with HMAC signing and SHA-pinned actions. It fails closed when unsigned: an agent-operated maintainer workflow in Effect core.
- **TanStack DB 0.12.0** makes breaking changes to sync semantics. Each sync transaction now has separate *accepted* and *visible* moments, and `begin({ immediate })` is removed ([release notes](https://github.com/TanStack/db/releases/tag/%40tanstack/db%400.12.0)).
- **Agent Skills research wave (arXiv, Oct 3–5):**
  - SKILL.md revisions raise rule compliance by +0.41 in single answers and +0.23 in agent action rate ([2610.04832](https://arxiv.org/abs/2610.04832)).
  - Skills that each pass vetting can still compose into malicious behavior (CRIME) ([2610.05943](https://arxiv.org/abs/2610.05943)).
  - Mined skills compared as a workflow plan vs. a *declarative ontology* ([2610.05777](https://arxiv.org/abs/2610.05777)).
  - SWE-CC: 823 machine-checkable repo-policy rules for coding agents ([2610.06193](https://arxiv.org/abs/2610.06193)).
  - MERGEGYM: 47.3% of conflicts occur even when the PRs touch disjoint files ([2610.04779](https://arxiv.org/abs/2610.04779)).
  - Task-scoped auth: 0% harmful execution under scoped JWT/OPA vs. 8.9–37.8% with broad bearer tokens ([2610.05840](https://arxiv.org/abs/2610.05840)).
  - MCPacific maps 124,267 MCP servers and 1.33M tools; 85% of tools are outside developer tooling ([2610.05319](https://arxiv.org/abs/2610.05319)).
- **MCP security hardening.**
  - The spec repo merged a Local Server Security guide: stdio peers are one trust domain and the transport is not a sandbox ([modelcontextprotocol #3072](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/3072)).
  - The TS SDK's `expectedResource` token-audience binding reaches server-legacy ([typescript-sdk v2.3.1](https://github.com/modelcontextprotocol/typescript-sdk/releases/tag/v2.3.1); v1.x maintenance [1.32.1](https://github.com/modelcontextprotocol/typescript-sdk/releases/tag/1.32.1)).
  - Four MCP servers have unauthenticated CVEs, and the LiteLLM MCP auth bypass is on CISA KEV ([DEV write-up, Oct 4](https://dev.to/kielltampubolon/mcp-servers-had-a-rough-48-hours-4-unauthenticated-cves-4oco); secondary source, CNA scores).
- **Claude Code harness governance:** plugin `tool.check` hooks now receive `agentId` and an org-approval `ceiling` ([v2.1.290](https://github.com/anthropics/claude-code/releases/tag/v2.1.290)). This builds on Claude Mods ([v2.1.287](https://github.com/anthropics/claude-code/releases/tag/v2.1.287)).

### Moved

- **Effect next patch staged:** [#8744 Version Packages](https://github.com/Effect-TS/effect/pull/8744) is OPEN staging `effect@4.0.2`. Main had ~109 merged PRs Oct 3–6, a post-4.0 stabilization wave.
- **Zero canary.23 → canary.25** (canary.24 and .25 both on Oct 5) ([npm canary.25](https://www.npmjs.com/package/@rocicorp/zero/v/1.11.0-canary.25)). Head tip is now [`1.11.0-head-311b05ae-20261006`](https://www.npmjs.com/package/@rocicorp/zero/v/1.11.0-head-311b05ae-20261006).
- **Evolu 8.17.0 → 8.18.0** fixes syncs that failed when a message was nearly full ([@evolu/common 8.18.0](https://github.com/evoluhq/evolu/releases/tag/%40evolu/common%408.18.0)). Relays must move to [@evolu/relay 4.2.2](https://github.com/evoluhq/evolu/releases/tag/%40evolu/relay%404.2.2).
- **Jazz alpha.58 → alpha.59** (non-breaking): WASM is ~12% smaller and permissioned writes are faster ([v2.0.0-alpha.59](https://github.com/garden-co/jazz/releases/tag/v2.0.0-alpha.59)). This ends the alpha.58 stall HOLD.
- **iManage write-back clock.** Legora's native iManage Cloud integration searches, edits with tracked changes and saves back under each user's permissions ([Legora — Your iManage, in Legora, Oct 2](https://legora.com/blog/your-imanage-in-legora)). Vendor write-back is live while the iManage×TR MCP is still "coming soon".
- **SEP-2640 SDK gate:** [python-sdk #3485](https://github.com/modelcontextprotocol/python-sdk/pull/3485) went from blocked to `clean` but is still OPEN. [go-sdk #1238](https://github.com/modelcontextprotocol/go-sdk/pull/1238) is dirty, and [typescript-sdk #2818](https://github.com/modelcontextprotocol/typescript-sdk/pull/2818) is still draft.

### Contradicted

- **Effect #8647 did not ship 4.1.0.** It merged 2026-10-04 and published **`effect@4.0.1`** plus the 4.0.1 family ([Effect #8647](https://github.com/Effect-TS/effect/pull/8647); [effect@4.0.1 release](https://github.com/Effect-TS/effect/releases/tag/effect%404.0.1); [npm 4.0.1](https://www.npmjs.com/package/effect/v/4.0.1)). The prior packet's "staging 4.1.0" claim was wrong.
- **Effect #8692 (DateTime Hermes fix) closed unmerged** on 2026-10-04 ([#8692](https://github.com/Effect-TS/effect/pull/8692)). It was carried as OPEN.

### Settled

- [#1409](https://github.com/beep-effect/beep-effect/pull/1409) (research/2026-10-03) MERGED. The stamp promotes `lastSuccessful*` to it.
- Effect post-4.0 release train: 4.0.0 → 4.0.1 shipped, 4.0.2 staged ([#8744](https://github.com/Effect-TS/effect/pull/8744)). Retire `w-effect-410-staging`.

### HOLD (refutation attempted, stands)

- Harvey↔Everlaw MCP is still "expected … in fall 2026", with no GA found Oct 6 ([Everlaw blog, Aug 27](https://www.everlaw.com/blog/ai-and-law/harvey-everlaw-integration-massive-scale/)).
- SEP-2640 Tier-1 SDKs are still unshipped (see Moved).

### Time-sensitive

- The USPTO "Super Intelligence" vendor roundtable is **Oct 15 (Dallas); RSVP by Oct 7**. It is market research that may narrow a later SI patent-examination solicitation ([FedSift — USPTO-26-RFI001](https://app.fedsift.app/solicitations/3bf5bdb6cb8e42d6ba58d8c0fab6f581)).
- Solo-practitioner patent foil: Esgenix Self-Serve offers pay-as-you-go agentic patent workflows (Oct 2, late catch) ([EIN Presswire](https://www.einpresswire.com/article/946678994/esgenix-launches-self-serve-ai-patent-workflows-for-solo-practitioners-smaller-firms-and-inventors)).

## Weekly consolidation (owed from Sunday 2026-10-04)

Coverage runs from the last weekly ([research/2026-09-27 tombstones](https://github.com/beep-effect/beep-effect/blob/main/research/ledger/tombstones/2026-09-27.jsonl)) through [research/2026-09-30](https://github.com/beep-effect/beep-effect/tree/main/research/2026-09-30), [research/2026-10-02](https://github.com/beep-effect/beep-effect/tree/main/research/2026-10-02), [research/2026-10-03](https://github.com/beep-effect/beep-effect/tree/main/research/2026-10-03) and this packet.

### Week trends

1. **Effect left RC and went straight into patch cadence.** The week went rc.118 → 4.0.0 → [4.0.1](https://github.com/Effect-TS/effect/releases/tag/effect%404.0.1) → 4.0.2 staged ([#8744](https://github.com/Effect-TS/effect/pull/8744)). The predicted 4.1.0 minor never landed. AI-surface work continues: Clef ([#8677](https://github.com/Effect-TS/effect/pull/8677)), DecisionModel images ([#8832](https://github.com/Effect-TS/effect/pull/8832)) and MCP toolkit typing ([#8842](https://github.com/Effect-TS/effect/pull/8842)).
2. **Local-first tip churn stayed high.** Zero went canary.20 → [canary.25](https://www.npmjs.com/package/@rocicorp/zero/v/1.11.0-canary.25), Evolu 8.12.0 → [8.18.0](https://github.com/evoluhq/evolu/releases/tag/%40evolu/common%408.18.0), and Jazz broke its alpha.58 stall with [alpha.59](https://github.com/garden-co/jazz/releases/tag/v2.0.0-alpha.59). The sync-correctness theme continues with Evolu's near-full message fix and [TanStack DB's accepted/visible split](https://github.com/TanStack/db/releases/tag/%40tanstack/db%400.12.0).
3. **Legal AI converged on skills plus governed DMS connectors.** [Legora Skills](https://legora.com/blog/introducing-skills), [Legora↔iManage write-back](https://legora.com/blog/your-imanage-in-legora) and [NetDocuments↔Copilot MCP](https://conventuslaw.com/press-releases/netdocuments-connects-organizational-legal-knowledge-to-microsoft-copilot-through-mcp/) all shipped. Cross-vendor MCP GA (Harvey↔Everlaw, iManage↔TR) still lags ([Everlaw](https://www.everlaw.com/blog/ai-and-law/harvey-everlaw-integration-massive-scale/)). The economics are under pressure ([Contrary](https://contraryresearch.substack.com/p/the-path-forward-for-legal-ai)), and the data layer is attracting funding ([Pandektes](https://pandektes.com/blog/pandektes-13-5m-series-a)).
4. **IP-law policy moved on two fronts.** USPTO is pro-filing for AI inventions ([DWT](https://www.dwt.com/insights/2026/10/uspto-ai-patent-eligibility-guidance)) while copyright on training data hardened against ROSS ([American Counsel](https://www.theamericancounsel.com/ross-plans-a-supreme-court-challenge-to-the-third-circuits-fair-use-ruling-in-thomson-reuters-v-ross-intelligence/)). The procurement window is open ([USPTO SI roundtable](https://app.fedsift.app/solicitations/3bf5bdb6cb8e42d6ba58d8c0fab6f581)).
5. **Skills security moved from single skills to composition and provenance.** Last week brought APEX/PACE/SkillEvoLean; this week adds CRIME composition attacks ([2610.05943](https://arxiv.org/abs/2610.05943)), revision effects ([2610.04832](https://arxiv.org/abs/2610.04832)), scoped-authorization containment ([2610.05840](https://arxiv.org/abs/2610.05840)) and MCP default-auth CVEs ([DEV](https://dev.to/kielltampubolon/mcp-servers-had-a-rough-48-hours-4-unauthenticated-cves-4oco)). Spec docs are catching up ([#3072](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/3072)) while SEP-2640 SDKs remain unshipped.

### Recurring frictions (rollup)

| friction | 09-30 | 10-02 | 10-03 | 10-06 |
| --- | --- | --- | --- | --- |
| X connector `client-not-enrolled` ([X projects](https://developer.x.com/en/docs/projects/overview)) | yes | yes | yes | yes |
| box `gh` 401 bad credentials (cursor-github MCP used) | yes | yes | yes | yes |
| unauthenticated api.github.com secondary rate-limit | — | — | yes | yes (intermittent) |
| arXiv export empty/blank on HTTP (HTTPS retry OK) | — | — | weekend-empty | yes (http→https) |
| open research PR blocked nightly (10-04, 10-05) | — | — | — | yes |

### Tombstone reaper (15 emitted → `research/ledger/tombstones/2026-10-06.jsonl`)

These were suggested or re-claimed in all three runs (09-30 / 10-02 / 10-03), never captured, or superseded:

- **SEP-3004 closed-unmerged reconfirm:** [mcp #3004](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/3004).
- **USPTO four-field reconfirm cluster** (3 URLs): [patent.dev](https://patent.dev/heads-up-complete-your-uspto-profile-by-august-18/), [data.uspto.gov FAQ](https://data.uspto.gov/support/faq), [govdelivery 421c568](https://content.govdelivery.com/accounts/USPTO/bulletins/421c568).
- **Superseded local-first tips:**
  - Jazz: [alpha.58](https://www.npmjs.com/package/jazz-tools/v/2.0.0-alpha.58).
  - Zero: [canary.20](https://www.npmjs.com/package/@rocicorp/zero/v/1.11.0-canary.20), [npm root](https://www.npmjs.com/package/@rocicorp/zero), [canary.23](https://www.npmjs.com/package/@rocicorp/zero/v/1.11.0-canary.23), [head 927c2ec6](https://www.npmjs.com/package/@rocicorp/zero/v/1.11.0-head-927c2ec6-20261002).
  - Evolu: [8.12.0](https://www.npmjs.com/package/@evolu/common/v/8.12.0), [npm root](https://www.npmjs.com/package/@evolu/common), [8.17.0](https://www.npmjs.com/package/@evolu/common/v/8.17.0).
- **Superseded Effect RC artifacts:** [effect rc.118](https://www.npmjs.com/package/effect/v/4.0.0-rc.118), [#8577](https://github.com/Effect-TS/effect/pull/8577).
- **Frozen SEP-2640 draft reconfirm:** [typescript-sdk #2818](https://github.com/modelcontextprotocol/typescript-sdk/pull/2818). The `w-sep2640-sdk-ship` watch row stays.

### Tombstone-leak finding (needs human eye)

Five URLs tombstoned on 09-27 were re-claimed as refutes in 09-30, 10-02 and 10-03 without evidence dated after the tombstone: the Harvey–Everlaw blog, the iManage×TR page, drizzle #6162, [MCP #3306](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/3306) and [go-sdk #1238](https://github.com/modelcontextprotocol/go-sdk/pull/1238). This packet excluded them from refute selection; the Harvey–Everlaw HOLD was re-checked through a non-tombstoned Everlaw URL instead. Proposal: the prelude should hard-drop tombstoned URLs from refute candidates.

### Weekly digest

Effect is stable and patching. Local-first libraries are shipping sync-correctness fixes. Legal-AI vendors converged on skills plus governed DMS connectors, ahead of cross-vendor MCP GA. IP policy splits between USPTO pro-filing and courts tightening training fair use. Agent-skill security research now targets composition and authorization scope rather than single-skill scanning.

## Topical appendix

### Law / legal-AI / IP

- [Legora Skills](https://legora.com/blog/introducing-skills) is the direct analogue of beep's skills surface, and it already ships install-gated sharing and matter-scoped isolation.
- The DMS layer is turning MCP-first ([NetDocuments](https://conventuslaw.com/press-releases/netdocuments-connects-organizational-legal-knowledge-to-microsoft-copilot-through-mcp/)) or vendor-native ([Legora×iManage](https://legora.com/blog/your-imanage-in-legora)).
- Solo IP practitioners now have pay-as-you-go agentic patent drafting ([Esgenix](https://www.einpresswire.com/article/946678994/esgenix-launches-self-serve-ai-patent-workflows-for-solo-practitioners-smaller-firms-and-inventors)), which matters for the Tom positioning.
- USPTO examination is friendlier to AI claims, with SMED as a tactic ([DWT](https://www.dwt.com/insights/2026/10/uspto-ai-patent-eligibility-guidance)).

### Effect / schema-first / local-first

- Watch [#8744](https://github.com/Effect-TS/effect/pull/8744) for 4.0.2.
- [#8842](https://github.com/Effect-TS/effect/pull/8842) is relevant to any Effect McpServer host, since incomplete servers previously compiled.
- Evolu relays must be upgraded in lockstep ([relay 4.2.2](https://github.com/evoluhq/evolu/releases/tag/%40evolu/relay%404.2.2)).
- TanStack DB's sync API break ([0.12.0](https://github.com/TanStack/db/releases/tag/%40tanstack/db%400.12.0)) affects comparisons with Effect-native reactive stores.

### Agents / MCP / skills / ontologies / neural-symbolic

- Skills are being measured as code: revisions ([2610.04832](https://arxiv.org/abs/2610.04832)), mining with ontology forms ([2610.05777](https://arxiv.org/abs/2610.05777)) and composition risk ([2610.05943](https://arxiv.org/abs/2610.05943)).
- Coding-agent governance: repo-policy compliance ([SWE-CC](https://arxiv.org/abs/2610.06193)) and concurrent-PR lineage ([MERGEGYM](https://arxiv.org/abs/2610.04779)). Both bear on yeet/commitlint discipline and the stacked-PR exploration.
- Neural-symbolic law: Law&Order formalizes tax forms into executable programs ([2610.02792](https://arxiv.org/abs/2610.02792), late catch).
- Harness hooks keep absorbing org policy ([Claude Code v2.1.290](https://github.com/anthropics/claude-code/releases/tag/v2.1.290)).

## Counts & run status

- **Claims:** 34 (27 window_new and 8 refute, 4 overlapping; 3 late catches are neither; law 11 / effect 10 / agents 13).
- **Novelty:** canonical exclusion collision **5.9%** (2/34 unique claim URLs ∩ 289-URL digest: [#8692](https://github.com/Effect-TS/effect/pull/8692), [py #3485](https://github.com/modelcontextprotocol/python-sdk/pull/3485), both deliberate refutes). Window-new collision **0.0%**. Under the 40% gate, so no self-reject.
- **RUN:** **partial**. X is not enrolled and there is no blinded local verifier. Weekly consolidation is included and emitted 15 tombstones.

## Source index

https://github.com/beep-effect/beep-effect/pull/1409
https://developer.x.com/en/docs/projects/overview
https://legora.com/blog/introducing-skills
https://conventuslaw.com/press-releases/netdocuments-connects-organizational-legal-knowledge-to-microsoft-copilot-through-mcp/
https://pandektes.com/blog/pandektes-13-5m-series-a
https://www.dwt.com/insights/2026/10/uspto-ai-patent-eligibility-guidance
https://www.theamericancounsel.com/ross-plans-a-supreme-court-challenge-to-the-third-circuits-fair-use-ruling-in-thomson-reuters-v-ross-intelligence/
https://contraryresearch.substack.com/p/the-path-forward-for-legal-ai
https://www.harvey.ai/blog/tc-energy-deploys-harvey-across-its-legal-team
https://github.com/Effect-TS/effect/pull/8842
https://github.com/Effect-TS/effect/pull/8832
https://github.com/Effect-TS/effect/pull/8853
https://github.com/TanStack/db/releases/tag/%40tanstack/db%400.12.0
https://arxiv.org/abs/2610.04832
https://arxiv.org/abs/2610.05943
https://arxiv.org/abs/2610.05777
https://arxiv.org/abs/2610.06193
https://arxiv.org/abs/2610.04779
https://arxiv.org/abs/2610.05840
https://arxiv.org/abs/2610.05319
https://github.com/modelcontextprotocol/modelcontextprotocol/pull/3072
https://github.com/modelcontextprotocol/typescript-sdk/releases/tag/v2.3.1
https://github.com/modelcontextprotocol/typescript-sdk/releases/tag/1.32.1
https://dev.to/kielltampubolon/mcp-servers-had-a-rough-48-hours-4-unauthenticated-cves-4oco
https://github.com/anthropics/claude-code/releases/tag/v2.1.290
https://github.com/anthropics/claude-code/releases/tag/v2.1.287
https://github.com/Effect-TS/effect/pull/8744
https://www.npmjs.com/package/@rocicorp/zero/v/1.11.0-canary.25
https://www.npmjs.com/package/@rocicorp/zero/v/1.11.0-head-311b05ae-20261006
https://github.com/evoluhq/evolu/releases/tag/%40evolu/common%408.18.0
https://github.com/evoluhq/evolu/releases/tag/%40evolu/relay%404.2.2
https://github.com/garden-co/jazz/releases/tag/v2.0.0-alpha.59
https://legora.com/blog/your-imanage-in-legora
https://github.com/modelcontextprotocol/python-sdk/pull/3485
https://github.com/modelcontextprotocol/go-sdk/pull/1238
https://github.com/modelcontextprotocol/typescript-sdk/pull/2818
https://github.com/Effect-TS/effect/pull/8647
https://github.com/Effect-TS/effect/releases/tag/effect%404.0.1
https://www.npmjs.com/package/effect/v/4.0.1
https://github.com/Effect-TS/effect/pull/8692
https://www.everlaw.com/blog/ai-and-law/harvey-everlaw-integration-massive-scale/
https://app.fedsift.app/solicitations/3bf5bdb6cb8e42d6ba58d8c0fab6f581
https://www.einpresswire.com/article/946678994/esgenix-launches-self-serve-ai-patent-workflows-for-solo-practitioners-smaller-firms-and-inventors
https://github.com/beep-effect/beep-effect/blob/main/research/ledger/tombstones/2026-09-27.jsonl
https://github.com/beep-effect/beep-effect/tree/main/research/2026-09-30
https://github.com/beep-effect/beep-effect/tree/main/research/2026-10-02
https://github.com/beep-effect/beep-effect/tree/main/research/2026-10-03
https://github.com/Effect-TS/effect/pull/8677
https://github.com/modelcontextprotocol/modelcontextprotocol/pull/3004
https://patent.dev/heads-up-complete-your-uspto-profile-by-august-18/
https://data.uspto.gov/support/faq
https://content.govdelivery.com/accounts/USPTO/bulletins/421c568
https://www.npmjs.com/package/jazz-tools/v/2.0.0-alpha.58
https://www.npmjs.com/package/@rocicorp/zero/v/1.11.0-canary.20
https://www.npmjs.com/package/@rocicorp/zero
https://www.npmjs.com/package/@rocicorp/zero/v/1.11.0-canary.23
https://www.npmjs.com/package/@rocicorp/zero/v/1.11.0-head-927c2ec6-20261002
https://www.npmjs.com/package/@evolu/common/v/8.12.0
https://www.npmjs.com/package/@evolu/common
https://www.npmjs.com/package/@evolu/common/v/8.17.0
https://www.npmjs.com/package/effect/v/4.0.0-rc.118
https://github.com/Effect-TS/effect/pull/8577
https://github.com/modelcontextprotocol/modelcontextprotocol/pull/3306
https://arxiv.org/abs/2610.02792
