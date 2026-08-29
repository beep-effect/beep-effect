# Citation Grounding & Hallucination Guard — Brief

<!--
Stage 3 (SHAPE). Fat-marker fidelity: concrete enough to decompose, rough
enough to preserve implementation latitude. Exit when the user confirms this
matches the picture in their head.
-->

## Problem

Hallucinated or ungrounded citations and quotations are malpractice-grade
failures in legal filings. A plausible-looking cite can misstate authority; a
quote that drifted through normalization can put words in a court’s mouth.
“The model sounded confident” is never evidence.

The repo already applies a candidate/approval doctrine to epistemic claims.
This program extends that firewall to quotations and legal citations: a cite
may become an admissible candidate only when deterministic extraction points
back to identified source text, and a quote may cross the gate only when its
half-open raw-source span reproduces the emitted text exactly. Legal resolution
then operates on the grounded candidate; it never manufactures grounding.

The model/output layer is already present in
`packages/law-practice/domain/src/values/`. The work is to supply the missing
Effect-native extraction engine and the generic verified-span substrate it can
trust, then compose that evidence into law-practice without redefining the
epistemic claim lifecycle.

## Appetite

**Proposed — ratify at shape sign-off:** a six-week, three-goal local-v1
program. Spend the first goal proving the generic span invariant and hostile
Unicode/source-drift fixtures; the second landing the eyecite-parity extraction
engine plus patent-pull statute/regulation patterns; and the third wiring one
law-practice ground-before-cite path. Cut breadth of citation forms or
integration seams before weakening exact-source equality, local-only privilege
safety, or fail-closed behavior.

## Solution Sketch

### Lane A — generic verified-span and straddle substrate

- In `foundation/modeling/provenance`, define construction/decoding of a
  verified `TextAnchor` from source identity, source digest/version, half-open
  UTF-16 offsets, and quote. Success requires
  `source.slice(start, end) === quote`.
- In `foundation/capability/langextract`, deterministically normalize only
  whitespace and typographic quotes as locator text while retaining a
  normalized→raw-source offset map. Every adapter declares and converts its
  input unit. Add cross-chunk/page straddle without losing global offsets.
- Start from `GroundedExtraction[]`, not the current
  `packages/foundation/capability/langextract/src/Handoff/index.ts`
  `toAnnotatedDocument` adapter: it filters for spans, but then creates entity
  IDs and never emits the corresponding `Mention` values, so the resulting
  `AnnotatedDocument` loses the extraction spans.
- Carry a matter-scoped evidence envelope here; wall enforcement is downstream.

### Lane B — legal citation extraction and resolution

- Port/reimplement the eyecite extraction pipeline in Effect under
  `law-practice/domain`, emitting the existing citation value objects directly.
  Attribute BSD-2 material through the single root `THIRD_PARTY_NOTICES.md`
  convention proposed by `court-vocabulary-resolver`; do not duplicate notices.
- Treat eyecite and eyecite-js fixtures as parity material, not dependencies or
  adoption gates. V1 proves full, short, Id., and supra case citations plus
  35 U.S.C. `StatuteCitation` and 37 C.F.R. `RegulationCitation` patterns.
- Own the reusable citation-extraction brick here;
  `explorations/deterministic-doc-structure-extraction` consumes this engine
  instead of adopting eyecite-js.
- Consume only versioned artifacts and stable IDs published by
  `court-vocabulary-resolver`; do not reinterpret its source datasets privately.
- Reuse/extend `ResolutionResult` and `CitationWarning` for durable bookkeeping.
  Keep transient hosted 200/300/400/404/429 statuses in a separate driver codec
  with an explicit adapter. `NO_CITATION` creates no citation entity.

### Lane C — law-practice ground-before-cite

- Put extraction/resolution ports and the fail-closed guard contract in
  `law-practice/use-cases`; compose persistence and court vocabulary in
  `law-practice/server`.
- Reject absent, ambiguous, stale, unverifiable, or cross-matter evidence before
  a citation/quotation reaches the approval seam.

### First vertical slice

Source text + source identity/digest + one span/quote-bearing candidate →
deterministic locator normalization and raw-offset recovery → verified
`TextAnchor` whose raw slice equals its quote → one matter-scoped law-practice
candidate or epistemic admission call. The hostile-text fixture spike gates
implementation in P0 of `citation-verified-span-substrate`.

### Proposed epistemic seam

**Proposed — ratify at shape sign-off:** law-practice publishes a public
`GroundedCitationEvidence` result from its use-case boundary. An app/server
composition adapter converts its verified anchor to the epistemic public
`EvidenceSpan` contract and invokes the public `ClaimGate`/candidate-admission
port. Neither `law-practice/domain` nor `law-practice/use-cases` imports an
epistemic domain module, and the epistemic slice gains no citation vocabulary or
`ClaimLifecycle` change.

### Proposed persistence policy

**Proposed — ratify at shape sign-off:** durably retain source identity and
digest/version, raw extracted candidates, normalization/engine version,
verified anchors, matter identity, resolution attempts/results/warnings,
re-anchor history, and fail-closed failures. Recompute derived display/grouping
views. A `NO_CITATION` run persists as a negative extraction attempt, not a
citation entity. Source drift never silently rewrites an anchor: record the
failed/re-anchored attempt and require the new raw-slice invariant.

## Rabbit Holes

- **Normalization and offset mapping:** surrogate pairs, combining marks,
  ligatures, curly quotes, collapsed whitespace, and foreign code-point offsets
  can corrupt UTF-16 spans. Gate work on the P0 fixture matrix and require an
  explicit adapter at every boundary.
- **Straddle:** page/chunk reconstruction can duplicate or omit separators.
  Prove global half-open spans and exact slices across page boundaries before
  optimizing streaming.
- **Source drift and duplicates:** stale versions and repeated quotations make a
  locator non-authoritative. Digest/version mismatch fails; duplicate matches
  require deterministic surrounding context or fail ambiguous.
- **Parity-corpus fidelity:** test licensing, upstream version pins, fixture
  encodings, and expected spans can dominate the port. Keep parity observable
  per stage (tokenize/extract/group/resolve), not as one opaque percentage.
- **Statute coverage:** 35 U.S.C. and 37 C.F.R. variants can balloon into general
  statutory parsing. Bound v1 to fixtures pulled by patent office-action flows.
- **BSD-2 attribution:** the engine, reporter/court artifacts, and test corpus
  must share the repository notice convention with `court-vocabulary-resolver`;
  one notice, pinned provenance, no duplicated or contradictory files.

## No-Gos

- No eyecite-js runtime dependency and no hosted parser as grounding truth.
- No court-data ingestion/taxonomy or private reinterpretation of
  `court-vocabulary-resolver` artifacts.
- No claim-admission vocabulary or `ClaimLifecycle` changes.
- No matter-wall enforcement in this program; only the matter-scoped carrier.
- No general prompt-injection defense, citator/“good law” computation, rich-text
  annotation, or hosted enrichment in v1.
- No fuzzy or case-fold matching pass, normalized quote emission, or trusting
  offsets without `source.slice(start, end) === quote`.
- No off-box privileged text. Any later hosted lane is opt-in,
  explicitly non-privileged, audited, bounded, and enrichment-only.
