# Capture

<!--
Stage 0. Append-only raw dump: thoughts, links, screenshots (drop files in
assets/ and reference them), half-sentences, contradictions. Nobody tidies
this file; cleaning it up destroys provenance. New material goes under a new
dated heading at the bottom.
-->

## 2026-08-06

Seeded from the signed-off routing matrix of
[`legal-patent-kg-deepening`](../legal-patent-kg-deepening/ROUTING-SEED.md),
TWO clusters that are one merged row. Primary: **"Drafting episodes,
deterministic retrieval, and rebuildable projections"** (route `mixed`, wave
P1, proposed slug `patent-drafting-episode-ledger` — this packet). Absorbed:
**"Claim-limitation support and governed patent drafting"** (merged
2026-08-01 in the reconciliation grill — that cluster is this wedge's first
rung; `ClaimLimitationSupport` is a submachine of the `DraftingEpisode`
state machine sharing the same `RuntimeApprovalGate`). Machine row:
[`routing-seed.json`](../legal-patent-kg-deepening/routing-seed.json) (the
merged clusters are a single row). Third wedge per the 2026-08-01
reconciliation grill order; opened 2026-08-06 on Benjamin's call after the
second wedge (`legal-position-relator-runtime`) graduated.

### Nuggets (from the parent 46-row ledger)

From
[`research/nugget-catalog.json`](../legal-patent-kg-deepening/research/nugget-catalog.json).

Primary cluster (drafting episodes, deterministic retrieval, rebuildable
projections):

- **T1-F10** (verified-finding, survived 2/3; track `10-track-legal-core`
  F10; distillates P002, P003): "Atomic normative rows with stable
  identifiers are an inspectable retrieval substrate. High-degree actor
  prefilters did not help the small treaty benchmark and should not become a
  default retrieval gate."
- **T3-F4** (verified-finding, survived 2/3 or better; track
  `12-track-graphrag` F4; distillates P005, P018, P019, P078, P056, P099):
  "Legal retrieval should resolve identity, hierarchy, scope, language, and
  point-in-time eligibility deterministically before ranking. Every answer
  should disclose the temporal, membership, retrieval, and fallback policies
  actually used."
- **T3-F5** (verified-finding, survived 2/3 or better; track
  `12-track-graphrag` F5; distillates P028, P030): "Legal application should
  be a reviewable inference event with typed fact and norm premises,
  conclusion, provision identity, evidence, and provenance. Reported
  retrieval gains remain a hypothesis because the cited study lacks a
  reification ablation."
- **T3-F10** (verified-finding, survived 2/3 or better; track
  `12-track-graphrag` F10; distillates P099, P048, P025, P028): "Agent
  memory should preserve raw episodes as audit authority and treat entities,
  semantic edges, summaries, and communities as lossy projections. A
  recent-raw fallback is required because graph retrieval regressed
  short-horizon recall in the cited benchmark."
- **T4-F7** (verified-finding, survived 2/3 or better; track
  `13-track-patent-llm` F7; distillates P066, P084, P027, P068): "Patent
  drafting memory should be a replayable episode ledger containing matter
  and document versions, outline, retrieval spans, model configuration,
  chunks, plan, validators, and attorney feedback. Memory proposes
  precedents but never supplies current-disclosure support."
- **ADHD-3** (adhd-play — deepened /adhd play, not a verified finding; track
  `20-adhd-integration` play 3; source frames spee5, onca5, remo3): "Make a
  law-owned DraftingEpisode append-only ledger authoritative, with Cognee
  and other memory engines limited to rebuildable lossy projections plus a
  recent-raw fallback. This is grill-gated because remo3 touches the
  standing memory-architecture decision." Deepened play:
  [`research/20-adhd-integration.md`](../legal-patent-kg-deepening/research/20-adhd-integration.md)
  § Focus 3 ("★ DraftingEpisode ledger, Cognee as lossy projection"). The
  remo3 grill it names is RESOLVED 2026-08-01 — the resolved boundaries are
  carried below and are binding, not open.

Absorbed first-rung cluster (claim-limitation support and governed patent
drafting):

- **T4-F1** (verified-finding, survived 2/3 or better; track
  `13-track-patent-llm` F1; distillates P027, P084): "Every generated claim
  limitation needs exact support in the current description or an explicit
  attorney disposition. Independent and dependent claim support must be
  evaluated separately, and anchor fidelity does not decide
  written-description law."
- **T4-F2** (verified-finding, survived 2/3 or better; track
  `13-track-patent-llm` F2; distillates P066, P027): "Long-form patent
  drafting should expose outline nodes, section budgets, retrieval spans,
  chunks, and assembly lineage as auditable work artifacts. The evidence
  supports traceability, not a claim that chunking or budgets independently
  cause quality."
- **T4-F3** (verified-finding, survived 2/3 or better; track
  `13-track-patent-llm` F3; distillates P027, P066, P069, P084): "Reference
  overlap cannot accept a patent draft. Support, completeness, clarity,
  terminology, dependency, feature linkage, repetition, and attorney
  adjudication require separate provenance-bearing gates."
- **T4-F4** (verified-finding, survived 2/3 or better; track
  `13-track-patent-llm` F4; distillates P016, P084): "Specialist routing is
  a fallible model decision and must be persisted with candidate routes,
  rationale, stage inputs and outputs, validator results, retries, and
  overrides. Deterministic validation and bounded fallback paths surround
  every stage."
- **ADHD-2** (adhd-play — deepened /adhd play, not a verified finding; track
  `20-adhd-integration` play 2; source frames comp1, regu2): "Attach an
  ordered ClaimLimitationSupportSet to law-practice claims and refuse draft
  promotion while any limitation lacks verified current-description anchors
  or an append-only attorney disposition. Dependency closure is part of the
  gate." Deepened play:
  [`research/20-adhd-integration.md`](../legal-patent-kg-deepening/research/20-adhd-integration.md)
  § Focus 2 ("ClaimLimitationSupport promotion gate").

### Cluster grounding (net-new vs already-covered, from the routing seed)

Net-new (source-only rg 2026-08-01 returned zero symbols):

- `[T4-F7,ADHD-3]` A law-owned, payload-bearing `DraftingEpisode` event
  union and replay fold — zero `DraftingEpisode` symbols in package source.
- `[T3-F10,ADHD-3]` A `MemoryProjection` port with delete-and-rebuild proof
  plus recent-raw-episode fallback — zero `MemoryProjection` symbols.
- `[T3-F4]` A machine-readable answer annex for temporal, membership,
  language, retrieval, rejected-candidate, fallback, and incompleteness
  policies — zero `AnswerProvenanceAnnex` symbols.
- `[T3-F5]` A typed, n-ary legal inference-event aggregate — zero
  `LegalInferenceEvent` symbols, and retrieval value still needs independent
  benchmarking.
- `[T1-F10]` Atomic normative-row fixtures and the anti-hub-prefilter
  policy — zero `NormativeRow` symbols.
- `[T4-F1,ADHD-2]` `ClaimLimitationSupportSet`, ordered limitation
  identities, dependency closure, unresolved support states, and attorney
  disposition — zero `ClaimLimitationSupport` symbols.
- `[T4-F2,T4-F3]` Durable outline, section-budget, retrieval-set, chunk,
  assembly, and multi-axis assessment artifacts — zero `DraftingOutline`
  symbols, and `RuntimeCandidateDraft` has only draft/evidence/gate-facing
  fields
  (`packages/agents/use-cases/src/processes/ProfessionalRuntime/ProfessionalRuntime.contracts.ts:428-446`).
- `[T4-F4]` Governed route state with candidate paths, rationale, stage
  I/O, validator results, retry count, and override — zero
  `DraftingRouteState` symbols.

Already covered (compose, do not rebuild):

- `[T4-F7,ADHD-3]` `RuntimeCandidateDraft`, `RuntimeApprovalGate`,
  `RuntimeEvidenceRef`, activities, and usage already provide fixture parts,
  while `ExecutionLedger` supplies an append-only service precedent
  (`packages/agents/use-cases/src/processes/ProfessionalRuntime/ProfessionalRuntime.contracts.ts:428-490`;
  `packages/epistemic/use-cases/src/ExecutionLedger/ExecutionLedger.ports.ts:61-108`).
- `[T3-F10,ADHD-3]` The agent-memory packet already locks repo-native
  authority and rebuildable external projections, and explicitly keeps
  IP-law records outside its generic core
  (`explorations/agent-memory-tiers-bitemporal-edges/DECISIONS.md:66-84,116-135`).
- `[T3-F4,T1-F10]` The active fusion goal already owns deterministic
  weighted RRF, exact-literal priority, stable ties, span preservation, and
  ClaimGate output boundaries
  (`goals/hybrid-retrieval-fusion-core/SPEC.md:5-24,75-102`).
- `[T3-F4,T3-F5]` `goals/practice-kg-mcp` already owns a read-only IP-law
  KG surface with deterministic docket rows and span-grounded candidate
  claims (`goals/practice-kg-mcp/SPEC.md:8-12,33-41`).
- `[T4-F1,ADHD-2]` `Claim` already stores claim number, independent flag,
  patent-asset reference, and full text, but no limitation support
  (`packages/law-practice/domain/src/entities/Claim/Claim.model.ts:52-93`).
- `[T4-F2,T4-F3,T4-F4]` The active professional-runtime goal already
  requires candidate drafts, evidence, strict human approval, and
  deterministic fixtures (`goals/agentic-professional-runtime/SPEC.md:28-63,111-125`).
- `[T4-F1,ADHD-2]` Exact source-versioned support anchors belong to
  `goals/citation-verified-span-substrate` and must be reused, not
  recreated.

### Resolved grill boundaries (binding, carried verbatim — never reopened from here)

Both route grills on this cluster were RESOLVED in the 2026-08-01
reconciliation grill (parent
[`ROUTING-SEED.md`](../legal-patent-kg-deepening/ROUTING-SEED.md)
§ Reconciliation amendments;
[`DECISIONS.md`](../legal-patent-kg-deepening/DECISIONS.md)):

- "**remo2 resolved — no persistent graph store.** MatterProjection contract
  is `PracticeKgQuery`: typed queries over materialized rows rebuilt from
  accepted claims; lineage queries may use disposable in-memory `@beep/rdf`
  dataset sessions via the existing bounded `SparqlQueryService`
  (ontology-workbench Session pattern)."
- "**remo3 resolved — clarification, not supersession.** DraftingEpisode
  ledgers are law-practice product records; Cognee's dev-memory role is
  unchanged and may carry a lossy rebuildable projection with
  recent-raw-episode fallback. Clarifying entry:
  `standards/memory-architecture/04-decision-log.md` (2026-08-01)."
- "**Slug merge.** `patent-drafting-promotion-gates` folds into
  `patent-drafting-episode-ledger` as its first rung
  (ClaimLimitationSupport is a submachine of the DraftingEpisode state
  machine; same `RuntimeApprovalGate`). Four proposed slugs remain."

No projection ever becomes authority; the episode ledger is a law-practice
product record — repo-native, authoritative, append-only.

### Cautions (carried forward verbatim from the routing seed)

- "RESOLVED 2026-08-01 (reconciliation grill; retained for provenance):
  [remo2] route grill: MatterProjection challenges the standing
  no-graph-store boundary and MUST go through /grill-with-docs with Benjamin
  before any projection store is shaped; no graph becomes authority."
- "RESOLVED 2026-08-01 (reconciliation grill; retained for provenance):
  [remo3,ADHD-3] route grill: Cognee's role touches the 2026-07-25 memory
  architecture and MUST go through /grill-with-docs with Benjamin. Product
  drafting records may be repo-native while Cognee remains durable operator
  dev-memory; do not silently redefine either role."
- "[T3-F5] The reported inference-event retrieval gain has no reification
  ablation; reproduce before claiming causality."
- "[T1-F10] The anti-hub result is a small benchmark and supports a study
  fixture, not a universal law."
- "[T4-F1,ADHD-2] Exact-span fidelity does not decide written-description
  support, implicit disclosure, terminology equivalence, or new matter;
  attorney disposition remains mandatory."
- "[T4-F2,T4-F3] Do not use output length, overlap, model judges, or granted
  text as patent-quality acceptance proxies."
- "[T4-F4] Specialist routing is evidence-bearing workflow state, not proof
  that a specialist architecture is universally superior."

### Cluster rationale (routing seed, verbatim)

Merged row: "`[T1-F10,T3-F4,T3-F5,T3-F10,T4-F7,ADHD-3]` need a law-owned
authoritative episode and answer contract that consumes, but does not
duplicate, generic memory and retrieval bricks."

Absorbed cluster (pre-merge, retained in the seed's per-cluster detail for
provenance): "`[T4-F1,T4-F2,T4-F3,T4-F4,ADHD-2]` specialize the generic
professional runtime into a patent drafting workflow whose promotion can
fail for explicit, independently reviewable reasons."

### Phase-2 grill pointers

Unlike the relator wedge, ownership IS grounded at open: the resolved remo3
grill fixes `DraftingEpisode` ledgers as law-practice product records
(repo-native, authoritative, append-only), so the align questions this
packet carries are about *shape* — episode set, rebuild proof, answer-annex
fields, support schema, routing modes — not home. Wedge-scoped decisions
(research lanes, dependency posture, orchestration, PR staging):
[`DECISIONS.md`](./DECISIONS.md). Campaign-level decisions (phase shape,
slug merge, unblock milestone):
[`../legal-patent-kg-deepening/DECISIONS.md`](../legal-patent-kg-deepening/DECISIONS.md),
2026-08-01 and 2026-08-04 entries. Substrate boundaries: no rebuild of
`ExecutionLedger`, the runtime draft-gate contracts, or weighted RRF —
`goals/hybrid-retrieval-fusion-core` and `goals/practice-kg-mcp` are
composed substrate. Sibling boundaries are stable reference points, never
reopened from here: the candor SPEC and its live implementation
(`goals/patent-citation-candor-gate`, implementation PR #575 — including
the law-practice migration precedent) and the relator SPEC
(`goals/legal-position-relator-runtime`).
