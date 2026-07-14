# Agentic Professional Runtime - Sources & Provenance

Source-and-provenance ledger for the gold-intake material folded into this goal.
It derives from the gold-intake cluster **"Agent skills + cost-tiered routing +
ethical-wall identity"** (route `mixed`, wave `P1`), and lets an implementing
agent trace every recommendation in
[`research/gold-intake-agent-skills-ethical-wall.md`](./gold-intake-agent-skills-ethical-wall.md)
back to its mined nugget, upstream repo + license, external citation, and
in-repo capability.

- **Cluster:** Agent skills + cost-tiered routing + ethical-wall identity
- **Route:** `mixed` · **Primary target:** `goals/agentic-professional-runtime` · **Wave:** P1 (4 P1 / 2 P2)
- **Theme span:** `agent-memory`, `governance-ops`, `legal-nlp`
- **Gold-intake provenance:**
  [`explorations/_gold-intake/ROUTING.md`](../../../explorations/_gold-intake/ROUTING.md) ·
  [`explorations/_gold-intake/routing.json`](../../../explorations/_gold-intake/routing.json) ·
  [`explorations/_gold-intake/GOLD_SYNTHESIS.md`](../../../explorations/_gold-intake/GOLD_SYNTHESIS.md) ·
  catalog [`explorations/_gold-intake/research/gold-catalog.json`](../../../explorations/_gold-intake/research/gold-catalog.json)
- **Packet research note:** [`research/gold-intake-agent-skills-ethical-wall.md`](./gold-intake-agent-skills-ethical-wall.md)
  (this is the folded note; no separate codex review under `reviews/` for this packet)

---

## 1. Mined source corpus (gold nuggets)

| Nugget | Title | Upstream (repo) | Source (file:line) | Theme | Priority | Disposition |
| --- | --- | --- | --- | --- | --- | --- |
| `TalentScore#9` | RpcMiddleware-provided `CurrentUser` identity for per-tenant isolation (ethical-wall seed) | TalentScore | `packages/domain/src/policy.ts:9-22` | governance-ops | P1 | port (clean-room reimplement; cross-team standards decision) |
| `patent-search-mcp-server#7` | Agent `SKILL.md`: cost-aware tool-ordering workflow + mandatory not-legal-advice gate | patent-search-mcp-server | `skills/patent-research-workflow/SKILL.md:56-83` | governance-ops | P1 | adopt (reimplement skill prompt natively) |
| `patents-mcp-server#9` | Six structured patent-analysis prompt-template workflows (prior art, validity, FTO, landscape, PTAB, portfolio) | patents-mcp-server | `src/prompts/index.ts:119-125` | legal-nlp | P1 | port (reimplement prompts natively) |
| `uspto_pfw_mcp#13` | Multi-step invalidity-analysis prompt template (multi-MCP orchestration, 102/103/101 + coverage gating) | uspto_pfw_mcp | `src/patent_filewrapper_mcp/prompts/patent_invalidity_analysis_defense_Pinecone_PTAB_FPD_Citations.py:31-58` | legal-nlp | P1 | port (reimplement; honor coverage windows) |
| `doc-haus#12` | Retrieval-grounded legal agent prompt with per-agent tool allowlist and "handoff not workaround" boundaries | doc-haus | `dochaus/agent/qa.md:65-93` | agent-memory | P2 | study (pattern reference for Skill prompt + allowlist) |
| `research-squad#13` | Research-need decision gate with clarification path | research-squad | `baml_src/types.baml:137-163` | governance-ops | P2 | study (optional pre-pipeline triage gate) |

### How these inform this packet

**Ethical-wall identity (governance-ops).** `TalentScore#9` is the load-bearing
contract: a branded `UserId`, a `Context.Tag CurrentUser`, and an
`RpcMiddleware.Tag` that fails `Unauthorized` and `provides: CurrentUser` to
every handler, with repos filtering all queries by user/matter scope.

> `export class CurrentUserRpcMiddleware extends RpcMiddleware.Tag<CurrentUserRpcMiddleware>()(... failure: HttpApiError.Unauthorized, provides: CurrentUser ...)`

**Take** the DI-injected-identity-at-the-RPC-boundary shape as the seed for
matter-level isolation / conflict-of-interest walls; **leave** it as a unilateral
landing inside this packet — it is a cross-cutting standards decision (see
Cautions). First concrete step: replace the `orgId: 1` hardcode in
`packages/workspace/server/src/aggregates/Thread/ThreadStore.repo.ts:54`.

**Skill governance + cost-tiered routing (governance-ops).**
`patent-search-mcp-server#7` encodes progressive-disclosure tool ordering
(cheapest sufficient tool first → dossier for depth → expensive `risk_profile`
last behind a cost warning), legal-outcome interpretation rules, and a hard
closing rule: always end with the not-legal-advice caveat. **Take** both the
routing-policy decision point (turns the name-only `Skill` stub into a real
policy and gives `UsageRecord` cost-attribution a place to land) and the
disclaimer-as-enforced-output-contract; the disclaimer is a compliance invariant,
not optional UX. `research-squad#13` adds an optional *pre*-pipeline triage gate
(`needs_research` / `requires_clarification` / `estimated_complexity` /
`ResearchAction`) that **precedes** — and must not weaken — the existing strict
candidate→approval gate; record as a P2 backlog idea.

**Agent prompt discipline (agent-memory).** `doc-haus#12` is the concrete
template for the eventual `Agent`/`Skill` prompt + tool registry: a per-agent
allowlist (`'*': false` then explicit enables), mandatory ground-before-answer,
preference for deterministic exact-lookup tools that "hit or say not found", and
cite-before-quote with confidence. **Take** it as the prose encoding of the
repo's retrieval-vs-logic (Prose-to-Proof) discipline; **leave** its mock
sources behind — re-ground on real provenance spans.

**IP-attorney prompt-workflows (legal-nlp).** `patents-mcp-server#9` supplies six
typed prompt scaffolds (`prior_art_search`, `patent_validity`,
`competitor_portfolio`, `ptab_research`, `freedom_to_operate`,
`patent_landscape`) and `uspto_pfw_mcp#13` a multi-step 102/103/101 invalidity
scaffold with explicit data-availability gating and a mandatory ultra-minimal
verification-first step. **Take** these as content (Skill templates over
`@beep/uspto` + the anthropic kernel) for the law vertical's high-leverage IP
surface; **leave** any pinned sunset endpoints and honor coverage windows
(enriched citations Oct 2017+).

---

## 2. Upstream repositories & licenses

| Repo | Tier | License | Port discipline | What we take |
| --- | --- | --- | --- | --- |
| TalentScore | T1 | MIT | port-with-attribution (permissive); routing guidance treats identity as a clean-room **standards** decision | `CurrentUser` `Context.Tag` + `RpcMiddleware.Tag` ethical-wall identity pattern; per-user/matter query filtering |
| patent-search-mcp-server | T2 | MIT | reimplement skill prompts natively (permissive, but do not vendor) | cost-tiered / progressive-disclosure tool-ordering workflow; not-legal-advice disclaimer gate; PTAB outcome-interpretation rules |
| patents-mcp-server | T1 | MIT | reimplement prompts natively | six structured patent-analysis prompt templates (prior art, validity, FTO, landscape, PTAB, portfolio) |
| uspto_pfw_mcp | T1 | MIT | reimplement; honor coverage windows | multi-step 102/103/101 invalidity-analysis prompt scaffold with data-availability gating + verification-first step |
| doc-haus | T1 | MIT | study / reimplement (pattern, not text) | retrieval-grounded agent prompt; per-agent tool allowlist; "handoff not workaround" capability boundaries |
| research-squad | T1 | MIT | study / reimplement | research-need decision-gate schema (triage before expensive work) |

> **Callout — bundle cautions (load-bearing):**
> - `patent-search-mcp-server` / `patents-mcp-server` are MIT and portable, but
>   the routing guidance is explicit: **reimplement the skill prompts natively**,
>   do not vendor.
> - `CurrentUser` identity is a **cross-cutting standards decision** (ethical wall
>   / per-tenant) — coordinate with `workspace` + `iam`; it must stay consistent
>   with org-first tenancy (matter scoping sits *within* the org, not instead of
>   it). Do not land unilaterally inside this packet.
> - The **not-legal-advice gate is a compliance invariant, not optional.**
>
> All upstreams here are MIT, so porting-with-attribution is permitted; even so,
> re-ground every prompt's "sources" on real provenance spans
> (`@beep/provenance` TextAnchor) because the source repos use mock/fabricated
> sources that violate beep's PROSE-IN/PROOF-OUT discipline. Confirm each repo's
> license at lift time. (No AGPL/GPL/MPL copyleft upstreams in this cluster.)

---

## 3. External research sources

Citations that actually appear on disk in this packet's research note
([`research/gold-intake-agent-skills-ethical-wall.md`](./gold-intake-agent-skills-ethical-wall.md)):

- Patentability statutes / examination guidance (novelty, non-obviousness, written description, eligibility):
  - Cornell LII, 35 U.S.C. § 102 — https://www.law.cornell.edu/uscode/text/35/102
  - Cornell LII, 35 U.S.C. § 103 — https://www.law.cornell.edu/uscode/text/35/103
  - USPTO MPEP § 2151 — https://www.uspto.gov/web/offices/pac/mpep/s2151.html
- PTAB outcome-interpretation grounding (institution vs. Final Written Decision):
  - USPTO, Inter Partes Review — https://www.uspto.gov/patents/ptab/trials/inter-partes-review
  - Congress.gov, CRS Report R48016 — https://www.congress.gov/crs-product/R48016

In-repo synthesis sections that carry the remaining claims (no external URL on
disk): GOLD_SYNTHESIS.md governance-ops + legal-NLP gap-map rows
(matter-isolation ethical wall, per-tenant `CurrentUser` middleware,
cost-tiered/disclaimer-gated Skill) and the agent-memory "stub Agent/Skill
prompts" note.

---

## 4. In-repo capability references

`@beep/*` bricks this cluster composes (from bundle secondary targets + the
note's in-repo inventory):

| Capability | Path | Status |
| --- | --- | --- |
| `agents` slice (agents, skills, commands, connectors, model/provider bindings) | `packages/agents` | reuse (slice owner) |
| `Agent` / `Skill` entities | `packages/agents/domain` (`src/entities/Skill/Skill.model.ts`, `src/entities/Agent/Agent.model.ts`) | extend — today deliberate stubs (`Skill {fixtureKey,name}`; `Agent {fixtureKey,mode,name,skillFixtureKey}`); grow prompt body, tool allowlist, cost-tier + `requiresDisclaimer` metadata |
| `ProfessionalRuntime` SDK + approval gates | `packages/agents/use-cases` (`src/processes/ProfessionalRuntime/`) | extend — `RuntimeApprovalGate` fixtures exist; add disclaimer as enforced output contract |
| agents server | `packages/agents/server` | reuse / extend |
| anthropic model kernel | `packages/drivers/anthropic` | reuse (model/provider binding for Skill prompts) |
| USPTO driver | `packages/drivers/uspto` | reuse / extend — IP-attorney Skill prompts compose over this (coverage-window caveats apply) |
| workspace server (approvals, `ThreadStore`) | `packages/workspace/server` | extend — `ThreadStore.repo.ts:54` hardcodes `orgId: 1`; ethical-wall `CurrentUser` lands here |
| law-practice server | `packages/law-practice/server` | extend — RPC boundary for matter-scoped ethical wall |
| epistemic ClaimGate (pre-retrieval triage) | `goals/epistemic-claim-lifecycle-gate` / `@beep/epistemic-use-cases` | reuse / extend for `research-squad#13` triage behavior |
| auth-gated MCP registration | `mcp-auth-gated-registration` (secondary target) | NET-NEW pattern target |

NET-NEW per bundle: cost-tiered tool-routing Skill + mandatory not-legal-advice
gate; DI-injected `CurrentUser` Tag + RpcMiddleware + matter-scoped query filter;
pre-pipeline research/triage decision gate; IP-attorney Skill prompt-workflows
(prior_art/validity/FTO/PTAB/landscape; 102/103/101 invalidity scaffold).
Already covered: `agents/domain` `Agent`/`Skill` + `ProfessionalRuntime`
approval gates exist as stubs/fixtures that these nuggets concretize (per
`doc-haus#12`).

---

## 5. Cross-links & provenance

- **Cluster id:** Agent skills + cost-tiered routing + ethical-wall identity
  (route `mixed`, wave P1) — `explorations/_gold-intake/routing.json`
- **Exploration → goal:** source exploration dir
  [`explorations/_gold-intake/`](../../../explorations/_gold-intake/) graduates
  into this goal; primary target `goals/agentic-professional-runtime`.
- **Sibling / secondary targets (coordinate, do not land here):**
  `goals/agent-governance-control-plane`, `goals/epistemic-claim-lifecycle-gate`
  (ClaimGate triage home), `mcp-auth-gated-registration`,
  `packages/workspace/server`, `packages/law-practice/server`,
  `packages/drivers/uspto`, `packages/drivers/anthropic`. USPTO/PatentsView depth
  is owned by the separate `uspto-patent-driver-depth` thread, not this packet.
- **Packet authority docs:** [SPEC.md](../SPEC.md) ·
  [PLAN.md](../PLAN.md) · [ops/manifest.json](../ops/manifest.json) ·
  [history/sources.md](../history/sources.md). This packet has no `DECISIONS.md`
  or top-level `RESEARCH.md`; the research surface is the folded note
  [`research/gold-intake-agent-skills-ethical-wall.md`](./gold-intake-agent-skills-ethical-wall.md).
- **Gold synthesis:**
  [`explorations/_gold-intake/GOLD_SYNTHESIS.md`](../../../explorations/_gold-intake/GOLD_SYNTHESIS.md)
  — governance-ops + legal-NLP sections.
