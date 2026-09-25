# P2 design: files-worker-score-thresholds

## Source binding and status

Source HEAD `f5e1d4c64f37e0a8c42e217eee5f06841220c161`.
Primary owner: `packages/tooling/tool/cli/src/commands/Files/internal/MatchPerson.ts:1384-1405`.
Status remains **designed**, Tier 1, internal derived sibling state, E4.
This refresh supersedes the active R28 design, whose immutable input is archived by
its integration receipt. Independent replacement P3 review and implementation are
pending. No test acceptance or application credit transfers from this audit.

## Current shape

The four locals at lines 1389-1392, in this exact bit order, are:

- A: `couldMeetMatchThreshold = s >= m - t`.
- B: `mustMeetMatchThreshold = s > m + t`.
- C: `couldMeetReviewThreshold = s >= r - t`.
- D: `couldMissReviewThreshold = s <= r + t`.

Here `t = 0.000001` (`MatchPerson.ts:70`). The supported options have
`0 <= r < m <= 1`: `MatchPersonOptions` uses `FaceDetectionConfidence`, a finite
inclusive [0,1] schema, and `validateThresholds` at lines 587-594 rejects `r >= m`.
Worker face scores use finite inclusive [-1,1] `PersonMatchSimilarityScore`
(`MatchPerson.schemas.ts:316-343,1333-1336`); `maximumValidatedFaceScore` at
1363-1382 computes the maximum after aggregate/reference validation.
NaN and infinities are not additional legal states. Do not add a seventh state
for malformed raw values that the existing decoding boundary rejects.

## Cardinality gap

Four independent booleans represent 16 states. Supported calls admit exactly six:

| Literal | ABCD | Meaning under the computed boundaries |
| --- | --- | --- |
| below-review | 0001 | s < r-t |
| review-band | 0011 | s >= r-t, s < m-t, s <= r+t |
| between-bands | 0010 | s >= r-t, s < m-t, s > r+t |
| overlapping-bands | 1011 | s >= m-t, s <= r+t |
| match-band | 1010 | s >= m-t, s > r+t, s <= m+t |
| above-match | 1110 | s > m+t |

For finite ordered thresholds, floating-point addition/subtraction by the same
positive tolerance are monotone. Thus B implies A, A implies C, B excludes D,
and absence of C implies D. These implications admit exactly the six listed
vectors. The probe supplies an actual supported witness for each vector.
Individual fixed threshold configurations need not reach all six; the count is
across supported configurations, not six states per invocation.

**Correct the old overlap shortcut:** classify using the exact computed
`r-t`, `r+t`, `m-t`, `m+t`. Do not substitute `m-r <= 2*t` for overlap; floating
rounding can make that real-arithmetic equivalence false for JavaScript numbers.
Boundary equality belongs to the lower-inclusive/upper-inclusive band according
to the actual source comparisons, especially strict B and inclusive D.

## Target schema

Add one private, annotated `WorkerScoreThresholdBand` LiteralKit with the six
literal members above and a same-name derived Type. Reuse the existing
`@beep/schema/LiteralKit` import and file identity. No new exported model,
independent pair literals, raw product alias, or stored booleans are needed.
If annotation strips needed kit helpers, retain an unannotated private base and
restore supported statics using the repository's existing helper; do not assume
annotation retains every custom method. Exhaustive `Match.value(...).pipe(...)`
can consume the six-member Type directly.

Implement a single classifier, preserving this decision order (pseudocode only):

1. If `s < r-t`, below-review.
2. Else if `s > m+t`, above-match.
3. Else if `s < m-t`, choose review-band when `s <= r+t`, else between-bands.
4. Else choose overlapping-bands when `s <= r+t`, else match-band.

Translate this decision tree to the repo's Effect Match helpers. It reads the
numeric evidence once to yield one schema-derived literal. Do not re-create the
four booleans as members or expose a second truth source.

## Migration inventory

Replace lines 1389-1392 and dependent uses at 1396-1400. Preserve these exact
acceptance sets, composing their independent conditions without broadening them:

| Report disposition | Threshold states accepted | Independent condition |
| --- | --- | --- |
| solo-match | overlapping-bands, match-band, above-match | faceCount === 1 and no quality flags |
| low-quality-match | overlapping-bands, match-band, above-match | faceCount === 1 and quality flags |
| group-match | overlapping-bands, match-band, above-match | faceCount > 1 |
| review | review-band, between-bands, overlapping-bands, match-band | partial aligner rejection also accepts any threshold state |
| no-match | below-review, review-band, overlapping-bands | none |
| no-face | none | false in this helper |
| unreadable | none | false in this helper |

Retain `hasQualityFlags` and `hasPartialAlignerRejection` as independent evidence.
Do not turn a partial aligner rejection into a new threshold band or suppress it
for high/low scores. Keep the helper's boolean coherence result: it answers a
predicate, not the targeted multi-flag product.

`validateWorkerEntryDisposition` at 1456-1466 must preserve its typed error and
message. `validateWorkerEntryEvidence` at 1468-1483 must retain face-shape,
reason, aggregate/reference, best-score, then disposition ordering, including
its early return for no comparable face. Threshold validation and the tolerance
used for approximate scores at line 230 remain unchanged.

`Files.command.ts:409-423,718-732` retains raw flags, defaults, decoding and
threshold resolution. `MatchPerson.worker-service.ts:412-454,531-548` retains
worker arguments and exact returned-parameter checks. Public option/report/
worker schema exports, decoded API, payloads, report ordering and encoded
outputs are unchanged by this private transient state migration.

## Guard-deletion accounting

Delete the four named local booleans and their downstream combined/negated
uses. The six-way literal is the sole threshold state source. Preserve the
independent face/quality/aligner predicates, numeric validation, and error
boundary.

## Encoded-side impact

No codec rider or new wire encoding is needed. This design grants no
blanket permission to alter exported schema constructors or release metadata.

## Test impact

The saved `probe.mjs` extracts current four predicate expressions and seven
branch expressions. It compares the proposed decision tree and acceptance table
against them for 78 ordered threshold pairs, 1,464 finite score samples, and
122,976 disposition/face-count/quality/aligner combinations. All six bit vectors
are witnessed. The recovered run reproduced `probe-result.json` byte-for-byte.

This is bounded source characterization, not exhaustive IEEE-754 testing, a
compiled implementation, or whole report pipeline validation. Implementation
must add focused tests in the existing Files test suite for each computed
boundary, neighboring representable values, ordinary gap, close overlap,
rounding-sensitive near-2t gaps, all six states and all seven dispositions.
Retain existing malformed worker, aggregate/best-score, quality, partial aligner
and diagnostic-order coverage. Run the owning package verification after code
changes. Keep MatchPerson edits serial with other Files owners in the ordered
Tier 1E Files batch and later Tier 2 reference-codec work; no singleton landing
or independent review is implied by this refreshed design.

## Risk

Preserve exact floating-point boundary computations, independent quality and
aligner predicates, and existing error ordering. Do not claim exhaustive proof
from the bounded probe.
