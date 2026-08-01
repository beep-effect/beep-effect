---
generated: 2026-08-01
method: /adhd (5 isolated diverge frames on codex gpt-5.6-sol xhigh; critic pass inline; 3 deepen branches)
frames: [regulator, competitor-trying-to-break-it, speedrunner, 3am-on-call, remove-the-load-bearing-assumption]
inputs: [10-track-legal-core.md, 11-track-patent-kg.md, 12-track-graphrag.md, 13-track-patent-llm.md, 14-addendum-new-items.md]
---

# ADHD Integration Pass — legal-patent-kg-deepening

## Brief

Problem: which concrete integration plays should beep-effect run to absorb the
verified campaign gold? An integration play = a buildable move landing a
finding in a specific goal/packet/package. Banned defaults (graph database,
full OWL ontology, LLM fine-tuning, package-per-finding, more synthesis prose)
were named in every branch prompt; all 30 ideas cleared them.

Score chips are `[N# V# F#]` = novelty / viability / fit, 0-10, weighted
0.35/0.40/0.25 for ranking.

## Wide set (30 ideas, 5 clusters by underlying angle)

### Cluster 1 — reify-the-event plays

Turn implicit acts and bare edges into first-class recorded events.

- [comp3] Reified CitationEvent with applicant/examiner provenance, OA linkage, submission time; reject bare `cites` edges [N6 V8 F9]
- [onca4] Release-versioned CitationObservation with SourceLocator evidence, mapping checksum, quarantine for unknown codes, explicit staleness [N6 V7 F8]
- [regu3] CitationEvent + attorney-owned CandorDisposition; filing-package promotion refused while AI-found references undisposed [N8 V7 F9]
- [spee6] PatentCitationEvent wrapping existing PatentReference/CitationMention + verified span + claim/paragraph locator [N6 V9 F9]
- [comp5] PowerExercise command envelope recording attempted/ineffective acts; edge revisions only after authority + constitutive conditions proven [N7 V7 F8]
- [regu4] PartyRoleAuthorization gate for filings/assignments/licenses/waivers; refused attempts appended as void PowerExerciseAttempt without mutation [N7 V7 F8]
- [spee2] Clean-room FLINT ActFrame decode (actor/recipient/object/precondition/creates/terminates) feeding existing RuntimeApprovalGate + EdgeAuthority [N8 V7 F7] ⚠ donor P100/R25 unverified
- [regu6] Append-only CorrectionDelta for every extraction/validation/ontology repair; unresolved changes route to contradiction triage before supersession [N6 V7 F8]

### Cluster 2 — span-or-refuse gate plays

Promotion gates that refuse until evidence or human disposition exists.

- [comp1] LimitationSupportRecord: every ordered claim limitation references a current-description TextAnchor or carries attorney-resolved new-matter disposition [N7 V8 F9]
- [regu2] ClaimLimitationSupport with Unsupported/Ambiguous/CandidateNewMatter states refusing promotion until disposition [N7 V8 F9]
- [regu1] MatterEgressPolicy: deterministic no-egress invariant for pre-publication matter text; digest-only audit records [N6 V8 F7]
- [comp6] MentionMappingCandidate queue with evidence spans, method/version, abstention, review state; agents propose, humans merge identity [N6 V7 F8]
- [remo6] Attorney promotion queue presenting limitation-support spans, conflict-scope tuples, correction deltas; adjudications become typed workflow inputs [N6 V7 F8]

### Cluster 3 — closed-domain schema plays

Encode research vocabularies as closed schema domains with invariants.

- [spee1] Second TaxonomySeed in @beep/ontology for the 8 Hohfeld positions + LiteralKit correlative bimap deriving the opposite view [N4 V9 F9]
- [onca1] HohfeldPosition LiteralKit + LegalPositionRelator over existing epistemic edges; schema-requires holder/counterparty/act/scope/bitemporal/evidence [N6 V7 F9]
- [remo1] ConstraintProfile: schemes carry executable invariants (Hohfeld correlatives, FLINT SlotCorrespondence validators) runnable by ontology-workbench [N8 V6 F8] ⚠ challenges wave-1 SKOS-only — grill-gated
- [comp2] Clean-room FunctionalUnit/typed-port/CompatibilityAssessment emitting satisfied/violated/missing constraints, never equating port-subtype match with compatibility [N7 V7 F8]
- [onca3] FunctionalUnit + SKOS function-verb scheme; substitutions stay evidence-bearing candidates, useful without an LLM [N7 V7 F8]
- [spee3] FunctionalUnitProfile beside existing law-practice PatentAsset/Claim; verbs via semantic-foundation IRIs; findings rendered in ontology-workbench [N7 V7 F8]
- [spee4] LegalApplicabilityContext value object (entry/efficacy/applicability/jurisdiction/governed-fact scope) stored in existing EdgeVersion.fact payload, queried beside validAt/knownAt [N6 V8 F9]
- [comp4] LegalScopeContext + typed PriorityBasis: temporal overlap opens review, supersession only after parties/forum/jurisdiction/proof-standard/priority align [N6 V8 F9]
- [onca2] Contradiction triage emitting not_comparable/candidate/human-adjudicated; aligned tuple + evidence diff shown in workbench [N6 V8 F9]

### Cluster 4 — episode-ledger & projection plays

Authority lives in replayable ledgers; engines are rebuildable projections.

- [onca5] DraftEpisode state machine (outline→retrieval→generation→limitation support→validators→disposition) with bounded retries, append-only deltas, resumable manual route [N6 V8 F8]
- [spee5] Upgrade the existing law-patent-intake runtime fixture into the first replayable drafting episode — a fixture-and-schema diff, not a project [N6 V9 F8]
- [remo3] ★ DraftingEpisode + MemoryProjection: beep owns the authoritative replay ledger; Cognee demoted to a replaceable lossy projection with recent-raw-episode fallback [N8 V7 F8]
- [onca6] PracticeKgQuery: deterministic exact/hierarchy/as-of resolution against embedded bundle first; Cognee summaries optional retrieval aids; incompleteness annex [N5 V8 F8]
- [remo2] MatterProjection: disposable derived query projection compiled from accepted assertions, rebuilt from claims, never source of truth [N7 V6 F7] ⚠ challenges wave-1 no-graph-store — grill-gated

### Cluster 5 — provenance-protocol plays

Shared-kernel architecture for who-may-assert-what.

- [remo5] QualifiedAssertion protocol in provenance-shared-claim-kernel; domain consumers (uspto-prosecution-read) own CitationEvent/ClaimLimitationSupport/NormApplication over it [N8 V6 F8]
- [regu5] AssertionProvenanceAnnex requiring typed premises, spans, policies, rejected candidates, versions, validator results on every exposed assertion [N6 V6 F8] — TRAP, see below

## Converge

Shortlist (weighted score, cross-frame convergence, and existing-substrate leverage):

1. **PatentCitationEvent reification** (spee6 + regu3 + onca4 + comp3, ~7.9) —
   four of five frames generated this independently; it lands on substrate
   that already exists (PatentReference, verified-anchor spans, USPTO document
   observations) and the CandorDisposition gate converts duty-of-candor from a
   habit into a schema invariant.
2. **ClaimLimitationSupport gate** (comp1 + regu2, ~7.9) — the
   malpractice/new-matter shield; directly operationalizes track-4 F1 and
   track-3 F7 (provision-fragment evidence granularity).
3. **★ Drafting episodes with Cognee as lossy projection** (spee5 + onca5 +
   remo3, ~7.7) — the non-obvious pick. The speedrun entry (upgrade the
   law-patent-intake fixture) makes the first step cheap while the
   remove-assumption twist (authoritative episode ledger, Cognee rebuildable)
   is an architecture-level unlock aligned with track-3 F10's Zep findings.
4. **Hohfeld TaxonomySeed + correlative bimap** (spee1 + onca1, ~7.25) — on
   the shortlist despite lower novelty because it is the semantic-foundation
   anchor the relator/scope plays build on, and it is nearly free given the
   shipped SKOS loader + LiteralKit machinery.

Traps:

- **regu5 AssertionProvenanceAnnex** — total-provenance God-schema; would make
  every assertion emission heavyweight before the kernel exists. Fold its
  vocabulary into remo5's protocol work instead.
- **remo4 rewrite-step adjudication editor** (not listed above; folded out) — a
  UI project disguised as a schema play; scope explosion risk. Its schema core
  survives inside Cluster 2's promotion-queue plays.

Grill-gated (standing-decision challenges, surfaced per campaign rules — not
traps, Benjamin decides):

- **remo1 ConstraintProfile** challenges wave-1 "SKOS-only, constraints live
  outside the registry".
- **remo2 MatterProjection** challenges wave-1 "no graph store" (honestly:
  derived, disposable, rebuilt from claims — arguably compatible, but the
  boundary needs an explicit decision).
- **remo3's Cognee demotion** partially challenges the 2026-07-25
  memory-architecture decision (Cognee as durable always-on dev-memory).

## Focus

### 1. PatentCitationEvent + CandorDisposition gate

Every patent-reference occurrence becomes a source-versioned, evidence-grounded
`PatentCitationEvent` whose attorney `CandorDisposition` must be current before
a filing candidate can advance.

**Sketch.** `@beep/law-practice-domain` owns a persisted `PatentCitationEvent`
relating the existing `PatentReference` to a citing application — replacing the
occurrence semantics currently embedded in the examiner-only
`PriorArtReference.officeActionFixtureKey` and accepting the planned
`CitationMention` from goals/citation-extraction-engine. The schema keeps
citation actor (`applicant | examiner | both | unknown`) separate from a tagged
discovery-provenance union, with optional `OfficeActionId`, submission and
observation times, method/model metadata, and release/code/mapping identity
supplied by goals/uspto-prosecution-read. `@beep/provenance` `TextAnchor` and
`@beep/epistemic-domain` `EvidenceSpan` (hardened by
goals/citation-verified-span-substrate) ground each event beside a law-practice
`Claim | Paragraph | Figure | Document` locator. Unknown USPTO codes produce
quarantined observations retaining raw values; source-version mismatch derives
explicit staleness rather than rewriting evidence. A promotion policy holds
`RuntimeApprovalGate` pending while any AI-discovered reference lacks a current
attorney disposition — disposition records attorney judgment (MPEP § 2001
materiality stays human), never manufactures it.

**Risk.** False closure: incomplete event identity/reconciliation/versioning
could report every reference disposed while silently omitting a duplicate,
stale, quarantined, or newly discovered one.

**First step.** A failing `CandorPolicy.test.ts` in
`packages/law-practice/use-cases` with examiner-observed and AI-discovered
events for one `PatentReference`; assert promotion stays `blocked` until an
attorney disposition covers the AI event's exact observation version.

**Children.** Split `PatentReferenceDiscoveryEvent` from citation (promote on
applicant/examiner act); tagged `PatentFragmentLocator` (claims, paragraphs,
figures) surviving text reflow; deterministic candor-closure receipt manifest;
reference-reconciliation inbox merging OA/IDS/engine/model occurrences around
one normalized reference; as-of citation timeline projected read-only into
practice-kg-mcp.

### 2. ClaimLimitationSupport promotion gate

Limitation-level written-description support becomes a law-domain schema
invariant and a hard draft-promotion gate.

**Sketch.** An ordered `ClaimLimitationSupportSet` in
`@beep/law-practice-domain` beside `Claim`/`PatentAsset` (today `Claim` records
only number, text, independent flag): parent-claim references + limitation
ordinals, each limitation carrying verified support anchors or an explicit
`Unsupported | Ambiguous | CandidateNewMatter` state. The supported branch
consumes the matter-scoped, source-versioned `TextAnchor` carrier planned by
goals/citation-verified-span-substrate. A law-practice adapter emits the draft
as the existing `RuntimeCandidateDraft` with the support set attached through
an opaque governance reference (patent vocabulary stays out of
`@beep/agents-use-cases`). Before `RuntimeApprovalGate` leaves `pending`, a
validator traverses each claim's dependency closure and rejects promotion
while any limitation is unresolved. Anchor fidelity never pretends to decide
§ 112 compliance — the attorney disposition is the legal judgment, append-only.

**Risk.** Conflating exact-span verification with the legal judgment of
written-description support (implicit disclosure, terminology equivalence,
inherited dependent-claim limitations).

**First step.** Complete the verified-span goal's P0 hostile-text fixture
contract first, so the first `ClaimLimitationSupport` test depends on the
canonical source-versioned anchor instead of inventing a second provenance
primitive.

**Children.** Dependency-closure support inheritance; amendment new-matter
diff gate against the last attorney-approved manifest; composite support
bundles (ordered anchors + attorney linkage rationale); description-repair
lane (remove/narrow/clarify without laundering generated prose into support);
examiner-ready support chart projection.

### 3. ★ DraftingEpisode ledger, Cognee as lossy projection

Patent drafting becomes a schema-fixed, append-only `DraftingEpisode` whose
beep ledger is authoritative; Cognee is a rebuildable lossy projection with
recent-raw fallback.

**Sketch.** A `DraftingEpisode` aggregate in `@beep/law-practice-domain` with
a closed event union and pure state-machine fold (outline, retrieval, chunk
generation, limitation support, deterministic validation, bounded retry,
correction delta, attorney disposition). Speedrun entry: the
law-patent-intake fixture's `RuntimeCandidateDraft`, `RuntimeApprovalGate`,
`RuntimeEvidenceRef`, principals, `RuntimeActivity`, and `RuntimeUsageRecord`
become ordered episode events, replaying to awaiting-attorney-disposition.
Persistence borrows `@beep/epistemic-use-cases`' `ExecutionLedger`
append-only/hash-chain pattern but with law-owned event storage
(payload-bearing, unlike the intentionally payload-free epistemic tables).
`MemoryProjection` becomes a port; the net-new Cognee adapter consumes
committed events, emits disposable summaries/retrieval links, and falls back
to recent raw episode tails. Honest tension with the 2026-07-25
memory-architecture decision: drafting episodes are product records — Cognee
stays durable for operator recall, becomes replaceable for product retrieval.

**Risk.** False replayability: law-patent-intake currently proves intake
plumbing, not real drafting — an episode schema can pass while freezing
nothing real unless it captures source/document versions, generated outputs,
validator versions, retry causality, and attorney decisions.

**First step.** `bun run beep architecture` scaffold for
`packages/law-practice/domain/src/aggregates/DraftingEpisode` (schema-first
event + machine roles), then an ordered `expected.drafting-episode.json` in
law-patent-intake asserting decode→replay→encode stability with the pending
gate preserved.

**Children.** Two-rung fixture ladder (v0 ledger mechanics, then a synthetic
provisional-drafting fixture); LimitationSupport as a hard submachine;
projection-replaceability drill (delete + rebuild Cognee from the ledger,
diff retrieval); CorrectionDelta → contradiction-triage bridge; attorney
drafting-preference distillation that suggests wording but can never support
a limitation.

## Provocation

Correlativity may be a general schema construct, not a Hohfeld one-off. A
Claim-Right/Duty pair, a FLINT act/consequence frame, an applicant/examiner
citation stance, an assignment's grantor/grantee — each is one underlying
directed relation with two derived views. If @beep/schema grew a generic
`CorrelativePair` kit (one canonical relation + a bimap deriving the inverse
view, with LiteralKit position domains), Hohfeld, FLINT, and citation
provenance would all be instances — and the wave-1 SKOS registry would carry
correlative structure without ever needing a graph store.
