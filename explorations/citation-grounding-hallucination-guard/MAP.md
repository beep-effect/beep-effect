# Citation Grounding & Hallucination Guard — Map

<!-- Stage 5 (GRADUATE). First lane scaffolded; remaining lanes stay queued. -->

## Candidate Goal Packets

### 1. [`citation-verified-span-substrate`](../../goals/citation-verified-span-substrate/README.md) — GRADUATED 2026-07-14

**Mission:** Prove generic, matter-scoped verified `TextAnchor` construction,
UTF-16 boundary conversion, deterministic normalization→source mapping, and
cross-chunk/page straddle with fail-closed semantics.

**Dependencies:** Existing `TextAnchor` at
`packages/foundation/modeling/provenance/src/TextAnchor.ts`; `Alignment` and
`GroundedExtraction` under
`packages/foundation/capability/langextract/src/`; direct
`GroundedExtraction[]` input because `Handoff/index.ts` currently loses mention
spans.

**Gate:** P0 hostile-text fixture spike covering surrogate pairs, combining
marks, ligatures, curly quotes, collapsed whitespace, duplicates, page
boundaries, and source drift. Lock half-open UTF-16 conversion and prove the
raw-slice invariant before implementation.

### 2. [`citation-extraction-engine`](../../goals/citation-extraction-engine/README.md) — GRADUATED-SCAFFOLDED 2026-07-14

**Mission:** Port/reimplement the eyecite pipeline in Effect over the existing
law-practice taxonomy, with parity-corpus proof for full/short/Id./supra case
citations and product-pull 35 U.S.C./37 C.F.R. patterns.

**Dependencies:** `citation-verified-span-substrate`; versioned artifacts and
stable IDs from `court-vocabulary-resolver`; existing values under
`packages/law-practice/domain/src/values/`, especially `CitationBase/`,
`Citation/`, `StatuteCitation/`, `RegulationCitation/`, `ResolutionResult/`,
`CitationWarning/`, `Span/`, and `SegmentMap/`.

**Gate:** Pin parity-corpus/license provenance; use the shared root
`THIRD_PARTY_NOTICES.md` convention; stage-level parity diagnostics must make
tokenizer/extractor/grouping/resolution divergence attributable.

**Campaign revisit executed:** scaffolded when
`explorations/court-vocabulary-resolver` graduated. Its manifest records
`blockedBy` edges to both `citation-verified-span-substrate` and
`court-reporter-vocabulary`; P0 provenance work may proceed, but its consumer
contract does not freeze before both dependencies land.

### 3. `citation-ground-before-cite` — QUEUED

**Mission:** Add law-practice extraction/resolution ports and one fail-closed
guard integration, carrying verified matter-scoped evidence through app/server
composition into the existing epistemic admission machinery.

**Dependencies:** Both prior goals; public `EvidenceSpan` at
`packages/epistemic/domain/src/values/EvidenceSpan/EvidenceSpan.model.ts`;
public `ClaimGate` at
`packages/epistemic/use-cases/src/ClaimGate/ClaimGate.ports.ts`; existing shared
`ClaimLifecycle` unchanged.

**Gate:** Shape sign-off on the proposed epistemic seam and persistence policy;
prove absent/ambiguous/stale/cross-matter failures and the `NO_CITATION`
negative-attempt/no-entity behavior.

## Gated Follow-Ons

- **`citation-mpep-patterns` (NET-NEW):** add MPEP § patterns after v1 parity;
  eyecite does not supply them.
- **`citation-courtlistener-enrichment`:** opt-in, non-privileged hosted
  verification/enrichment using `@beep/courtlistener`. Gate on its own contract
  spike, managed `Token` auth, 60/min and 250/request bounds, audit metadata,
  and local-v1 proof.
- **`citation-matter-wall-enforcement`:** separate future packet/goal enforcing
  matter isolation with the carrier shaped here. Gate on the matter identity
  contract and security/product ownership.
- **`citation-rich-text-annotation`:** project verified anchors into editor
  annotations after persistence/re-anchor semantics stabilize.

## Sequencing

`citation-verified-span-substrate`
→ `citation-extraction-engine`
→ `citation-ground-before-cite`
→ gated follow-ons.

Start at the universal trust invariant, let the legal engine emit groundable
values, then integrate the guard. Court vocabulary is an external dependency,
not a dataset this packet reinterprets. Hosted enrichment, MPEP breadth, wall
enforcement, and presentation wait for the local trust path.

## First Vertical Slice

**Verified-span substrate proof:** one `GroundedExtraction`-shaped candidate and
identified raw source pass through locator normalization, UTF-16 raw-offset
recovery, exact-slice verification, and matter scoping to produce a verified
`TextAnchor` accepted by one candidate/admission seam. Every absent, duplicate,
stale, malformed-unit, or cross-matter fixture fails closed.

## Capability Check

### Existing bricks to compose

- **Law-practice citation model layer:** roughly 56 value-object modules under
  `packages/law-practice/domain/src/values/`, including full/short-form
  citations, warnings/resolution, durable locators, and clean↔original spans.
- **Grounding modes/candidates:** `@beep/langextract` Alignment and
  `GroundedExtraction` under
  `packages/foundation/capability/langextract/src/` (exact/lesser/fuzzy exist;
  this strict path accepts only a revalidated raw slice).
- **Generic anchor:** `@beep/provenance` `TextAnchor` at
  `packages/foundation/modeling/provenance/src/TextAnchor.ts`.
- **Epistemic admission:** `EvidenceSpan`, `ClaimGate`, and existing
  `ClaimLifecycle` public surfaces under `packages/epistemic/` and
  `packages/shared/domain/src/values/ClaimLifecycle/`.
- **Optional hosted home:** the `@beep/courtlistener` skeleton at
  `packages/drivers/courtlistener/`.

### Honest NET-NEW work

- Effect-native eyecite-style extraction engine and parity harness.
- Deterministic locator normalization with a UTF-16 normalized→raw-source map
  and explicit foreign-unit adapters.
- Cross-chunk/page straddle preserving global raw offsets.
- Verified-anchor constructor/decoder plus matter-scoped evidence carrier.
- Law-practice extraction/resolution ports and fail-closed guard service.
- App/server composition adapter into the epistemic public contract.

## Open Risks Inherited From The Brief

- P0 fixtures may expose incompatible current offset assumptions; substrate
  scope must absorb conversion, not weaken equality.
- Parity licensing/version and regex runtime safety can change engine effort.
- Court-vocabulary timing blocks resolution fidelity, not the first goal.
- The six-week three-goal appetite, cut rule, epistemic seam, persistence
  policy, and first-goal/fan-out map were ratified at the 2026-07-14 shape gate.
