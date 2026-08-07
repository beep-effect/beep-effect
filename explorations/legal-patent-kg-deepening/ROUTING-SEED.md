# Wave Routing Seed — starting hypothesis (later reconciliation and align phases verify & gate)

> Grounded against the **live** beep-effect `explorations/` + `goals/` +
> `packages/` tree **TODAY, 2026-08-01**. This is a **STARTING
> hypothesis**, not an approved decomposition. The next reconciliation and
> align phases re-check the tree, run every `grill[...]` challenge through
> `/grill-with-docs` with Benjamin, and obtain Benjamin's sign-off before any
> `BRIEF.md` or `MAP.md` shaping. Machine form:
> [`routing-seed.json`](./routing-seed.json). Ledger:
> [`research/nugget-catalog.json`](./research/nugget-catalog.json).

The matrix routes all 46 ledger rows: 38 verified findings (`T1-F1`–`T4-F8`),
two rejected claims (`T4-R1`, `T4-R2`), three unverified addendum items
(`P100`, `P101`, `R25`), and three deepened plays (`ADHD-1`–`ADHD-3`). A
`grill[...]` label is an annotation over the required route vocabulary, never
a substitute for `attach-existing | extend-goal | new-exploration | mixed |
dup-skip`.

## Summary

| Cluster | Route | Target | Wave | New slug? |
|---|---|---|---|---|
| Legal positions, relators, and authorized transitions (`T1-F1,T1-F2,T1-F7,T1-F9,T4-F6,P100,R25`) | **mixed** *(packet OPENED 2026-08-05, GRADUATED 2026-08-06 into `goals/legal-position-relator-runtime`)* | [`explorations/legal-position-relator-runtime`](../legal-position-relator-runtime/README.md) | P1 | `legal-position-relator-runtime` |
| Legal rule, time, source identity, and controlled transformation (`T1-F4,T1-F5,T1-F6,T3-F1,T3-F2,T3-F3,T3-F6,T4-F5,P101`) | **new-exploration** | `legal-rule-time-identity` *(proposed slug, not a path yet)* | P2 | `legal-rule-time-identity` |
| Legal contradiction scope, priority, and correction deltas (`T1-F3,T3-F9,T4-F8`) | **mixed** *(re-routed 2026-08-04 → rides with `legal-position-relator-runtime`; compose, don't widen; carrier packet OPENED 2026-08-05)* | [`explorations/legal-position-relator-runtime`](../legal-position-relator-runtime/README.md) | P1 | — |
| Semantic registry, qualified mappings, and extraction admission (`T1-F8,T2-F3,T2-F4,T2-F5,T2-F6,T2-F7,T2-F10,T3-F8`) | **extend-goal** *(grill resolved: schema-first now, M4 SHACL later)* | `goals/semantic-foundation` | P2 | — |
| Functional patent profiles and drift-safe ingestion (`T2-F1,T2-F8,T2-F9`) | **mixed** | `explorations/uspto-patent-driver-depth` | P1 | — |
| Patent citation events and candor disposition (`T2-F2,T3-F7,ADHD-1`) | **mixed** *(packet OPENED 2026-08-04, GRADUATED into `goals/patent-citation-candor-gate`)* | [`explorations/patent-citation-candor-gate`](../patent-citation-candor-gate/README.md) | P1 | `patent-citation-candor-gate` |
| Claim-limitation support and governed patent drafting (`T4-F1,T4-F2,T4-F3,T4-F4,ADHD-2`) | **merged 2026-08-01** → first rung of `patent-drafting-episode-ledger` *(carrier packet OPENED 2026-08-06)* | [`explorations/patent-drafting-episode-ledger`](../patent-drafting-episode-ledger/README.md) | P1 | — |
| Drafting episodes, deterministic retrieval, and rebuildable projections (`T1-F10,T3-F4,T3-F5,T3-F10,T4-F7,ADHD-3` + merged `T4-F1,T4-F2,T4-F3,T4-F4,ADHD-2`) | **mixed** *(grill resolved: remo2 rows-first + in-memory RDF lane; remo3 product-records + Cognee projection; packet OPENED 2026-08-06)* | [`explorations/patent-drafting-episode-ledger`](../patent-drafting-episode-ledger/README.md) | P1 | `patent-drafting-episode-ledger` |
| Rejected admission and ODRL profile claims (`T4-R1,T4-R2`) | **dup-skip** | `explorations/legal-patent-kg-deepening` | P3 | — |

Route mix (as amended 2026-08-04): mixed×5 (one re-routed 2026-08-04 to ride
with `legal-position-relator-runtime`), extend-goal×1, new-exploration×1,
dup-skip×1, merged×1 — matching `routing-seed.json`, where the re-routed
contradiction cluster is encoded as `mixed`. Proposed slug count: **four** after
the reconciliation grill (`legal-position-relator-runtime` — opened 2026-08-05,
`legal-rule-time-identity`, `patent-citation-candor-gate` — opened 2026-08-04,
`patent-drafting-episode-ledger` — opened 2026-08-06). All three grill annotations (`remo1`,
`remo2`, `remo3`) are resolved, and the contradiction-cluster route decision
landed in the 2026-08-04 phase-2 grill — see the amendment sections at the
end of this file.

## Per-cluster detail

### Legal positions, relators, and authorized transitions

- **Route / Wave:** mixed · P1
- **Nuggets:** `T1-F1`, `T1-F2`, `T1-F7`, `T1-F9`, `T4-F6`, `P100`, `R25`
- **Primary target:** [`explorations/legal-position-relator-runtime`](../legal-position-relator-runtime/README.md) *(packet OPENED 2026-08-05, GRADUATED 2026-08-06 into `goals/legal-position-relator-runtime`; was a proposed slug with no repo path)*
- **Coordinate with:** `goals/semantic-foundation`, `goals/epistemic-bitemporal-edge-core`, `explorations/agent-governance-control-plane`, `explorations/uspto-patent-driver-depth`
- **Net-new (no existing home):**
  - `[T1-F1,T1-F2,T1-F9]` A closed `HohfeldPosition` domain, correlative bimap, and n-ary `LegalPositionRelator` aggregate. A source-only `rg` over `packages/**/src/**/*.{ts,tsx}` returned zero `Hohfeld` or `LegalPositionRelator` symbols on 2026-08-01.
  - `[T1-F7,T4-F6,P100]` `PowerExercise` / `ActFrame` events that preserve attempted or ineffective acts while authority gates revisions. The same source-only search returned zero `PowerExercise` or `ActFrame` symbols.
  - `[R25]` `SlotCorrespondence` and FLINT competency validators. Source-only `rg` returned zero `SlotCorrespondence` symbols; `R25` is also unverified addendum material.
- **Already covered (do NOT rebuild):**
  - `[T1-F1]` `@beep/ontology` already supplies `LiteralKit` domains, SKOS mapping kinds, `TaxonomySeed`, and its registry/loader at `packages/foundation/modeling/ontology/src/SemanticFoundation.models.ts:98`, `:140`, `:287` and `TaxonomyLoader.ts:58`, `:194`.
  - `[T1-F2,T1-F7]` `EdgeVersion` already carries binary endpoints, immutable `fact`, valid time, transaction time, and supersedes lineage at `packages/epistemic/domain/src/entities/EdgeVersion/EdgeVersion.model.ts:106-163`.
  - `[T1-F7,T4-F6]` `RuntimeApprovalGate` and `EdgeAuthority` already provide human review and record/supersede primitives at `packages/agents/use-cases/src/processes/ProfessionalRuntime/ProfessionalRuntime.contracts.ts:473-490` and `packages/epistemic/use-cases/src/EdgeAuthority/EdgeAuthority.ports.ts:60-100`.
- **Rationale:** `[T1-F1,T1-F2,T1-F7,T1-F9,T4-F6]` compose a legal consumer aggregate over three live foundations—taxonomy, bitemporal edges, and approval—but no current packet owns their combined legal meaning. `[P100,R25]` may strengthen the transition half only after verification.
- **⚠ Cautions:**
  - `[P100,R25]` Keep both at `study` until source-fidelity, beep-fit, novelty, and license handling pass.
  - `[T1-F2,T1-F7]` `goals/epistemic-bitemporal-edge-core` is completed-retained substrate; do not widen it with legal vocabulary.
  - `[T1-F1]` Correlativity remains outside plain SKOS triples unless Benjamin explicitly approves a different boundary.

### Legal rule, time, source identity, and controlled transformation

- **Route / Wave:** new-exploration · P2
- **Nuggets:** `T1-F4`, `T1-F5`, `T1-F6`, `T3-F1`, `T3-F2`, `T3-F3`, `T3-F6`, `T4-F5`, `P101`
- **Primary target:** `legal-rule-time-identity` *(proposed slug; no repo path is asserted)*
- **Coordinate with:** `goals/epistemic-bitemporal-edge-core`, `goals/semantic-foundation`, `goals/citation-verified-span-substrate`, `goals/law-docketing-patent-spine`, `explorations/uspto-patent-driver-depth`
- **Net-new (no existing home):**
  - `[T1-F5,T3-F1]` A legal applicability context separating entry, efficacy, applicability, jurisdiction, and governed facts from `validAt` / `knownAt`; source-only `rg` returned zero `LegalApplicabilityContext` symbols.
  - `[T3-F2]` N-ary legal change events from which version intervals are derived, with causal and constitutive relations kept distinct; source-only `rg` returned zero `LegalChangeEvent` symbols.
  - `[T3-F3]` A normalized LegalRuleML donor profile. Source-only `rg` returned zero `LegalRuleML` package symbols; references found elsewhere were research prose, not live domain code.
  - `[T1-F6,T3-F6,T4-F5,P101]` Separate document, content, norm, temporal-version, language-version, executable-rule, runtime-event, and rewrite-step identities in one traceable consumer chain; source-only `rg` returned zero `LegalDocumentVersion`, `InterpretedNorm`, or `RewriteStep` symbols.
- **Already covered (do NOT rebuild):**
  - `[T1-F4,T1-F5,T3-F1,T3-F2]` Generic bitemporality and immutable lineage already live in `packages/epistemic/domain/src/entities/EdgeVersion/EdgeVersion.model.ts:113-163`.
  - `[T1-F6,P101]` Exact char-offset grounding already lives in `packages/foundation/modeling/provenance/src/TextAnchor.ts:37-106` and `packages/epistemic/domain/src/values/EvidenceSpan/EvidenceSpan.model.ts:65-105`.
  - `[T1-F4]` `goals/law-docketing-patent-spine` is the existing patent-procedure packet; shape the rule increment beside it rather than creating a second docket spine.
- **Rationale:** `[T1-F4,T1-F5,T1-F6,T3-F1,T3-F2,T3-F3,T3-F6,T4-F5]` exceed the bounded SKOS mission and the generic edge core but converge on one source-to-rule-to-event identity problem. `[P101]` is a candidate transformation-chain donor, not verified performance evidence.
- **⚠ Cautions:**
  - `[T3-F3]` Reopen only LegalRuleML's indefinite donor deferral; do not widen semantic-foundation M1 or import its XML tree as the domain model.
  - `[T3-F6]` P054 and P055 conflict on temporal-version identity; align must choose and fixture one relation-domain model.
  - `[P101]` The controlled-language cascade remains `unverified-addendum`.

### Legal contradiction scope, priority, and correction deltas

> **RE-ROUTED 2026-08-04 (phase-2 grill):** compose, don't widen — the legal
> vocabulary (`LegalScopeContext`, `PriorityBasis`, verdict families,
> `CorrectionDelta`) rides with `legal-position-relator-runtime` when that
> wedge opens; `goals/epistemic-contradiction-triage` is composed as substrate
> and its SPEC is NOT amended (minimal generic extension slots only with
> fixture evidence — the T4-R2 precedent). The detail below is retained for
> provenance.

- **Route / Wave:** extend-goal *(pre-amendment)* · P1
- **Nuggets:** `T1-F3`, `T3-F9`, `T4-F8`
- **Primary target:** `goals/epistemic-contradiction-triage`
- **Coordinate with:** `goals/epistemic-bitemporal-edge-core`, `explorations/legal-patent-kg-deepening`
- **Net-new (no existing home):**
  - `[T1-F3,T3-F9]` `LegalScopeContext` and typed `PriorityBasis` fields. Source-only `rg` returned zero matching package symbols.
  - `[T1-F3]` Separate rule-conflict, principle-collision, interpretation-dispute, and disputed-event verdict families; inspection of `goals/epistemic-contradiction-triage/SPEC.md:49-55` found generic candidate ownership, not these legal verdict families.
  - `[T4-F8]` A caller-owned `CorrectionDelta` emission contract; source-only `rg` returned zero `CorrectionDelta` symbols.
- **Already covered (do NOT rebuild):**
  - `[T1-F3,T3-F9,T4-F8]` The active goal already owns durable candidates, duplicate suppression, unresolved visibility, scoped human disposition, and candidate-to-atomic-supersession flow at `goals/epistemic-contradiction-triage/SPEC.md:6-9`, `:49-55`, `:86-95`, and `:114-118`.
  - `[T4-F8]` `EdgeAuthority` already makes correction additive and keeps supersession separate from detection at `packages/epistemic/use-cases/src/EdgeAuthority/EdgeAuthority.ports.ts:3-34`.
- **Rationale:** `[T1-F3,T3-F9,T4-F8]` are semantic inputs and caller contracts for the existing candidate/adjudication pipeline, not a second triage engine.
- **⚠ Cautions:**
  - `[T1-F3]` `goals/epistemic-contradiction-triage/SPEC.md:137-138` stops detection-heuristic expansion. Benjamin must explicitly approve re-scope or split before work lands.
  - `[T4-F8]` Keep ODRL and other caller vocabularies outside the generic epistemic goal.
  - `[T3-F9]` Temporal overlap opens a candidate; it never adjudicates truth or supersession.

### Semantic registry, qualified mappings, and extraction admission

- **Route / Wave:** extend-goal · P2 · **grill[remo1]**
- **Nuggets:** `T1-F8`, `T2-F3`, `T2-F4`, `T2-F5`, `T2-F6`, `T2-F7`, `T2-F10`, `T3-F8`; standing-decision challenge `remo1`
- **Primary target:** `goals/semantic-foundation`
- **Coordinate with:** `goals/epistemic-claim-lifecycle-gate`, `goals/epistemic-bitemporal-edge-core`, `goals/citation-verified-span-substrate`, `explorations/agent-memory-tiers-bitemporal-edges`
- **Net-new (no existing home):**
  - `[T1-F8]` Purpose and legal-theory provenance are not fields in the live `TaxonomySeed` shape at `packages/foundation/modeling/ontology/src/SemanticFoundation.models.ts:287-295`.
  - `[T2-F3,T2-F4,T2-F5]` Criterion-bound classification assertions, qualified instance mappings with abstention/review, and a generic mention-to-concept candidate queue; source-only `rg` returned zero `QualifiedMapping` or `MentionMappingCandidate` symbols.
  - `[T2-F6,T2-F7,T3-F8]` Per-field `ProvenanceKind`, repaired-vs-verified state, and vocabulary quarantine; source-only `rg` returned zero `ProvenanceKind` symbols.
  - `[T2-F10]` A clean-room function-verb seed scheme and its conformance fixtures are absent from `packages/foundation/modeling/ontology/src/SemanticFoundation.seed.ts:49-90`.
- **Already covered (do NOT rebuild):**
  - `[T1-F8,T2-F3,T2-F4,T2-F10]` `@beep/ontology` already implements `LiteralKit`, `exactMatch` / `closeMatch`, `TaxonomySeed`, and registry/loader surfaces at `packages/foundation/modeling/ontology/src/SemanticFoundation.models.ts:98-160`, `:181-224`, `:287-295` and `TaxonomyLoader.ts:127-194`.
  - `[T2-F5,T2-F7]` `TextAnchor`, `EvidenceSpan`, and `ClaimGate` already supply exact-span evidence and admission at `packages/foundation/modeling/provenance/src/TextAnchor.ts:37-106`, `packages/epistemic/domain/src/values/EvidenceSpan/EvidenceSpan.model.ts:65-105`, and `packages/epistemic/use-cases/src/ClaimGate/ClaimGate.service.ts:15-44`.
  - `[T2-F6]` `EdgeVersion` and `ClaimDisposition` already cover append-only fact versions and durable disposition at `packages/epistemic/domain/src/entities/EdgeVersion/EdgeVersion.model.ts:106-163` and `packages/epistemic/domain/src/entities/ClaimDisposition/ClaimDisposition.model.ts:68`.
- **Rationale:** `[T1-F8,T2-F3,T2-F4,T2-F5,T2-F6,T2-F7,T2-F10,T3-F8]` extend existing registry and admission owners with richer metadata and states; they do not justify a graph store, new ontology authority, or another kernel.
- **⚠ Cautions:**
  - `[remo1]` **route grill:** `ConstraintProfile` challenges the standing SKOS-only registry boundary and MUST go through `/grill-with-docs` with Benjamin. Until then, executable invariants remain outside `TaxonomySeed`.
  - `[T2-F10]` PatentLEGO vocabulary data is CC BY-SA 4.0; never vendor its tables or JSON.
  - `[T2-F7,T3-F8]` Schema-valid or repaired output is still only a candidate.

### Functional patent profiles and drift-safe ingestion

- **Route / Wave:** mixed · P1
- **Nuggets:** `T2-F1`, `T2-F8`, `T2-F9`
- **Primary target:** `explorations/uspto-patent-driver-depth`
- **Coordinate with:** `goals/uspto-prosecution-read`, `goals/semantic-foundation`, `goals/epistemic-claim-lifecycle-gate`
- **Net-new (no existing home):**
  - `[T2-F1]` `FunctionalUnit`, typed ports, function decomposition, and `CompatibilityAssessment`; source-only `rg` returned zero `FunctionalUnit` symbols.
  - `[T2-F8]` Patent-aware segmentation with span-retaining derivation traces; source-only `rg` returned zero `PatentAwareSegmentation` symbols.
  - `[T2-F9]` Release-generation-specific mapping modules and schema-generated regression fixtures; source-only `rg` returned zero `MappingVersion` symbols, while the checked driver contracts stop at checksum/parser/vocabulary version.
- **Already covered (do NOT rebuild):**
  - `[T2-F9]` The driver exploration already requires release identity, checksums, parser/vocabulary version, unknown raw-value retention, and fail-closed drift at `explorations/uspto-patent-driver-depth/BRIEF.md:48-60` and `:82-95`.
  - `[T2-F9]` `goals/uspto-prosecution-read` already owns the provenance-bearing observation, checksum policy, versions, and explicit drift failure at `SPEC.md:6-24` and `:69-87`.
  - `[T2-F1]` `goals/semantic-foundation` already owns SKOS scheme loading; a function-verb scheme must reuse it.
- **Rationale:** `[T2-F1,T2-F8,T2-F9]` deepen the existing driver packet with a domain-side functional profile and stronger mapping tests while preserving the transport/domain boundary.
- **⚠ Cautions:**
  - `[T2-F1]` Functional units sit beside patent entities, not inside the USPTO transport driver and not one-per-patent.
  - `[T2-F8]` Attention and embedding signals remain derivation trace, never epistemic confidence.
  - `[T2-F9]` Raw mappings and legal interpretations require separate owners.

### Patent citation events and candor disposition

- **Route / Wave:** mixed · P1
- **Nuggets:** `T2-F2`, `T3-F7`, `ADHD-1`
- **Primary target:** [`explorations/patent-citation-candor-gate`](../patent-citation-candor-gate/README.md) *(packet OPENED 2026-08-04, GRADUATED into `goals/patent-citation-candor-gate`; was a proposed slug with no repo path)*
- **Coordinate with:** `goals/uspto-prosecution-read`, `goals/citation-extraction-engine`, `goals/citation-verified-span-substrate`, `goals/agentic-professional-runtime`, `explorations/uspto-patent-driver-depth`
- **Net-new (no existing home):**
  - `[T2-F2,ADHD-1]` `PatentCitationEvent`, discovery provenance, observation version, quarantine/staleness, and attorney `CandorDisposition`; source-only `rg` returned zero `PatentCitationEvent` or `CandorDisposition` symbols.
  - `[ADHD-1]` Filing-promotion closure over the exact current observation version; the live runtime gate at `packages/agents/use-cases/src/processes/ProfessionalRuntime/ProfessionalRuntime.contracts.ts:473-490` has no candor or observation-version field.
  - `[T3-F7,ADHD-1]` A tagged patent-fragment locator for claim, paragraph, figure, and document identity; source-only `rg` returned zero `PatentFragmentLocator` symbols.
- **Already covered (do NOT rebuild):**
  - `[T2-F2,ADHD-1]` `PatentReference` parses country, number, and kind code at `packages/law-practice/domain/src/values/PatentMetadata/PatentMetadata.model.ts:188-216`; `PriorArtReference` records an examiner-linked occurrence at `packages/law-practice/domain/src/entities/PriorArtReference/PriorArtReference.model.ts:50-84`.
  - `[T3-F7,ADHD-1]` `CitationMention` is already specified as a source-versioned, verified-anchor occurrence at `goals/citation-extraction-engine/SPEC.md:169-196`.
  - `[T3-F7,ADHD-1]` Exact UTF-16 anchors, source digest/version, ambiguity, and fail-closed drift already belong to `goals/citation-verified-span-substrate/SPEC.md:44-80` and `:108-123`.
  - `[ADHD-1]` `RuntimeCandidateDraft` and `RuntimeApprovalGate` already expose candidate references, evidence, reviewer, policy basis, and pending decision at `packages/agents/use-cases/src/processes/ProfessionalRuntime/ProfessionalRuntime.contracts.ts:428-490`.
- **Rationale:** `[T2-F2,T3-F7,ADHD-1]` compose existing reference, mention, verified-anchor, USPTO observation, and runtime-gate bricks into one law-owned candor workflow; none of those existing bricks owns candor closure.
- **⚠ Cautions:**
  - `[ADHD-1]` `CandorDisposition` records attorney judgment; the system must not compute MPEP materiality.
  - `[T2-F2]` Keep face-list presence, citation act, office-action reliance, and similarity as separate claims.
  - `[ADHD-1]` Duplicates, stale observations, and quarantined codes must not create false closure.

### Claim-limitation support and governed patent drafting

> **MERGED 2026-08-01 (reconciliation grill):** this cluster is now the first
> rung of `patent-drafting-episode-ledger` — ClaimLimitationSupport is a
> submachine of the DraftingEpisode state machine sharing the same
> `RuntimeApprovalGate`. The detail below is retained for provenance; route
> its nuggets via the drafting-episodes cluster.

- **Route / Wave:** merged → first rung of `patent-drafting-episode-ledger` · P1
- **Nuggets:** `T4-F1`, `T4-F2`, `T4-F3`, `T4-F4`, `ADHD-2`
- **Primary target:** [`explorations/patent-drafting-episode-ledger`](../patent-drafting-episode-ledger/README.md) *(carrier packet OPENED 2026-08-06; was `patent-drafting-promotion-gates` before the 2026-08-01 merge, then a proposed slug with no repo path)*
- **Coordinate with:** `goals/agentic-professional-runtime`, `goals/citation-verified-span-substrate`, `goals/law-docketing-patent-spine`
- **Net-new (no existing home):**
  - `[T4-F1,ADHD-2]` `ClaimLimitationSupportSet`, ordered limitations, dependency closure, unresolved support states, and attorney disposition; source-only `rg` returned zero `ClaimLimitationSupport` symbols.
  - `[T4-F2,T4-F3]` Durable outline, section-budget, retrieval-set, chunk, assembly, and multi-axis assessment artifacts; source-only `rg` returned zero `DraftingOutline` symbols, and `RuntimeCandidateDraft` at `packages/agents/use-cases/src/processes/ProfessionalRuntime/ProfessionalRuntime.contracts.ts:428-446` has only draft/evidence/gate-facing fields.
  - `[T4-F4]` Governed route state with candidate paths, rationale, stage I/O, validator results, retries, and override; source-only `rg` returned zero `DraftingRouteState` symbols.
- **Already covered (do NOT rebuild):**
  - `[T4-F1,ADHD-2]` `Claim` already stores number, independent flag, patent-asset reference, and full text at `packages/law-practice/domain/src/entities/Claim/Claim.model.ts:52-93`.
  - `[T4-F2,T4-F3,T4-F4]` The active runtime goal already requires candidate drafts, evidence, strict approval, and deterministic fixtures at `goals/agentic-professional-runtime/SPEC.md:28-63` and `:111-125`.
  - `[T4-F1,ADHD-2]` Exact source-versioned support anchors already belong to `goals/citation-verified-span-substrate`.
- **Rationale:** `[T4-F1,T4-F2,T4-F3,T4-F4,ADHD-2]` specialize the generic professional runtime into a patent drafting workflow whose promotion can fail for explicit, independently reviewable reasons.
- **⚠ Cautions:**
  - `[T4-F1,ADHD-2]` Exact spans do not decide written-description support, implicit disclosure, terminology equivalence, or new matter.
  - `[T4-F2,T4-F3]` Do not use length, overlap, model judges, or granted text as legal-quality acceptance proxies.
  - `[T4-F4]` Persist route choice as evidence; do not claim specialists are universally superior.

### Drafting episodes, deterministic retrieval, and rebuildable projections

- **Route / Wave:** mixed · P1 · **grill[remo2,remo3]** *(both RESOLVED 2026-08-01)*
- **Nuggets:** `T1-F10`, `T3-F4`, `T3-F5`, `T3-F10`, `T4-F7`, `ADHD-3`; standing-decision challenges `remo2`, `remo3`
- **Primary target:** [`explorations/patent-drafting-episode-ledger`](../patent-drafting-episode-ledger/README.md) *(packet OPENED 2026-08-06; was a proposed slug with no repo path)*
- **Coordinate with:** `explorations/agent-memory-tiers-bitemporal-edges`, `goals/agentic-professional-runtime`, `goals/hybrid-retrieval-fusion-core`, `goals/practice-kg-mcp`
- **Net-new (no existing home):**
  - `[T4-F7,ADHD-3]` A law-owned, payload-bearing `DraftingEpisode` event union and replay fold; source-only `rg` returned zero `DraftingEpisode` symbols.
  - `[T3-F10,ADHD-3]` A `MemoryProjection` port with delete/rebuild proof and recent-raw fallback; source-only `rg` returned zero `MemoryProjection` symbols.
  - `[T3-F4]` A machine-readable answer annex for temporal, membership, language, retrieval, rejected-candidate, fallback, and incompleteness policies; source-only `rg` returned zero `AnswerProvenanceAnnex` symbols.
  - `[T3-F5]` A typed n-ary legal inference event and an independent benchmark for its retrieval value; source-only `rg` returned zero `LegalInferenceEvent` symbols.
  - `[T1-F10]` Atomic normative-row fixtures and an anti-hub-prefilter policy; source-only `rg` returned zero `NormativeRow` symbols.
- **Already covered (do NOT rebuild):**
  - `[T4-F7,ADHD-3]` Runtime draft/gate records and `ExecutionLedger` provide fixture and append-only service precedents at `packages/agents/use-cases/src/processes/ProfessionalRuntime/ProfessionalRuntime.contracts.ts:428-490` and `packages/epistemic/use-cases/src/ExecutionLedger/ExecutionLedger.ports.ts:61-108`.
  - `[T3-F10,ADHD-3]` The memory packet already locks repo-native authority and rebuildable projections while excluding IP-law records from the generic core at `explorations/agent-memory-tiers-bitemporal-edges/DECISIONS.md:66-84` and `:116-135`.
  - `[T3-F4,T1-F10]` The active fusion goal already owns deterministic weighted RRF, exact-literal priority, stable ties, span preservation, and ClaimGate output at `goals/hybrid-retrieval-fusion-core/SPEC.md:5-24` and `:75-102`.
  - `[T3-F4,T3-F5]` `goals/practice-kg-mcp` already owns a read-only IP-law KG surface with deterministic docket rows and span-grounded candidates at `SPEC.md:8-12` and `:33-41`.
- **Rationale:** `[T1-F10,T3-F4,T3-F5,T3-F10,T4-F7,ADHD-3]` need a law-owned authoritative episode and answer contract that consumes, but does not duplicate, generic memory and retrieval bricks.
- **⚠ Cautions:**
  - RESOLVED 2026-08-01 (reconciliation grill; retained for provenance): `[remo2]` **route grill:** `MatterProjection` challenges the standing no-graph-store boundary and MUST go through `/grill-with-docs` with Benjamin. No projection may become authority.
  - RESOLVED 2026-08-01 (reconciliation grill; retained for provenance): `[remo3,ADHD-3]` **route grill:** Cognee's role touches the 2026-07-25 memory decision and MUST go through `/grill-with-docs` with Benjamin. Product drafting records may be repo-native while Cognee remains durable operator dev-memory; neither role changes silently.
  - `[T3-F5]` The inference-event retrieval result lacks a reification ablation; reproduce before claiming causality.
  - `[T1-F10]` The anti-hub result is a small benchmark, so start with a study fixture.

### Rejected admission and ODRL profile claims

- **Route / Wave:** dup-skip · P3
- **Nuggets:** `T4-R1`, `T4-R2`
- **Primary target:** `explorations/legal-patent-kg-deepening`
- **Coordinate with:** `goals/semantic-foundation`, `goals/epistemic-claim-lifecycle-gate`, `goals/provenance-shared-claim-kernel`
- **Net-new (no existing home):**
  - `[T4-R1,T4-R2]` None. Both claims failed verification and must remain negative ledger evidence.
- **Already covered (do NOT rebuild):**
  - `[T4-R1]` The bounded SHACL/ClaimGate admission boundary already exists at `goals/semantic-foundation/SPEC.md:60-75`, `:98-101` and `packages/epistemic/use-cases/src/ClaimGate/ClaimGate.service.ts:15-44`; the sources do not establish one combined ODRL winning profile.
  - `[T4-R2]` Stable `TextAnchor` / `EvidenceSpan` provenance and the admission owner already exist at `goals/provenance-shared-claim-kernel/SPEC.md:34-64` and `goals/epistemic-claim-lifecycle-gate`.
- **Rationale:** `[T4-R1,T4-R2]` are `dup-skip`: preserving them prevents future mining from relabeling rejected or already-owned work as a gap.
- **⚠ Cautions:**
  - `[T4-R1]` ODRL caller-domain work may still be studied, but not under the rejected combined-profile claim.
  - `[T4-R2]` New domain consumers compose the existing admission contract; they do not widen the completed kernel.

## Reconciliation amendments (2026-08-01 grill — SIGNED OFF)

Benjamin signed off the matrix as amended in the 2026-08-01 reconciliation
grill (full Q/A/rationale in [`DECISIONS.md`](./DECISIONS.md)):

1. **remo1 resolved — no supersession.** Correlativity/FLINT invariants land
   as Effect Schema constructs now (LiteralKit + correlative bimap in the
   consuming domain package); registry-carried executable shapes route into
   semantic-foundation's existing gated **M4 Intake ClaimGate Shapes** lane
   (bounded `ShaclValidationService`; SPARQL unsupported). Cluster 4 stays
   `extend-goal`.
2. **remo2 resolved — no persistent graph store.** MatterProjection contract
   is `PracticeKgQuery`: typed queries over materialized rows rebuilt from
   accepted claims; lineage queries may use disposable in-memory `@beep/rdf`
   dataset sessions via the existing bounded `SparqlQueryService`
   (ontology-workbench Session pattern).
3. **remo3 resolved — clarification, not supersession.** DraftingEpisode
   ledgers are law-practice product records; Cognee's dev-memory role is
   unchanged and may carry a lossy rebuildable projection with
   recent-raw-episode fallback. Clarifying entry:
   `standards/memory-architecture/04-decision-log.md` (2026-08-01).
4. **Slug merge.** `patent-drafting-promotion-gates` folds into
   `patent-drafting-episode-ledger` as its first rung (ClaimLimitationSupport
   is a submachine of the DraftingEpisode state machine; same
   `RuntimeApprovalGate`). Four proposed slugs remain.
5. **First wedge.** `patent-citation-candor-gate` shapes first; the other P1
   wedges queue behind it. BRIEF/MAP work may now begin, starting there.

## Phase-2 amendments (2026-08-04 grill)

The phase-2 /grill-with-docs session that opened the first wedge (full
Q/A/rationale in [`DECISIONS.md`](./DECISIONS.md), 2026-08-04 entries):

1. **First wedge OPENED.** `explorations/patent-citation-candor-gate` exists
   at capture stage, seeded from this matrix's candor cluster; its
   wedge-scoped decisions (research lanes, dependency posture, orchestration,
   PR staging) are pre-seeded in that packet's `DECISIONS.md`. Phase shape:
   sequential — the other wedges start no work until it reaches align.
2. **Contradiction cluster re-routed — compose, don't widen.** The route
   decision the 2026-08-01 seed flagged for Benjamin is resolved: the legal
   vocabulary rides with `legal-position-relator-runtime`;
   `goals/epistemic-contradiction-triage` keeps its current SPEC and is
   composed as substrate. Both routing-seed forms carry the amendment; the
   displaced `extend-goal` rationale is preserved in the cluster detail
   above.

## Phase-2 amendments, continued (2026-08-05)

1. **Second wedge OPENED.**
   [`explorations/legal-position-relator-runtime`](../legal-position-relator-runtime/README.md)
   exists at capture stage, seeded from the positions/relators cluster plus
   the carried contradiction cluster; wedge-scoped decisions are pre-seeded
   in its `DECISIONS.md`, and parent align questions 1, 17 (the T4-F6 half),
   and 18 are carried into its `openQuestions`. Opened on Benjamin's call
   the day the candor wedge's graduation PR #560 merged.
   `patent-drafting-episode-ledger` and the FunctionalUnit extension into
   `explorations/uspto-patent-driver-depth` remain queued on his call.

## Phase-2 amendments, continued (2026-08-06)

1. **Third wedge OPENED.**
   [`explorations/patent-drafting-episode-ledger`](../patent-drafting-episode-ledger/README.md)
   exists at capture stage, seeded from the merged "Drafting episodes,
   deterministic retrieval, and rebuildable projections" row (which absorbed
   "Claim-limitation support and governed patent drafting" as its first rung
   in the 2026-08-01 reconciliation grill; the resolved remo2/remo3
   boundaries are carried into the wedge verbatim as binding); wedge-scoped
   decisions are pre-seeded in its `DECISIONS.md`, and parent align
   questions 11 (the `T3-F4` half), 12, 14, 15, and 16 are carried into its
   `openQuestions`. Opened on Benjamin's call the day the relator wedge's
   graduation PR #590 merged. The FunctionalUnit extension into
   `explorations/uspto-patent-driver-depth` remains queued on his call.
