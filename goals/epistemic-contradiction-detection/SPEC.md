# Epistemic Contradiction Detection Spec

## Objective

Produce `ContradictionCandidate` records for typed direct-conflict classes as a
**pure function of a belief-view snapshot** — deterministic, model-free, and
goldenable — against the contract `goals/epistemic-contradiction-triage`
already ships. Detection proposes; triage disposes.

Observable result: given one fixed belief-view snapshot, the detector emits the
same candidate set on every run, in the same order, on any machine; every
emitted record decodes against the sealed `ContradictionCandidate` schema
(`packages/epistemic/domain/src/entities/Contradiction/Contradiction.model.ts:41-75`);
every `ContradictionAssessment.confidence` is a documented per-class constant;
and nothing in this packet writes edge authority, candidate storage, or a
disposition.

## Non-Goals

- **No auto-resolution of contradictions.** Adjudication is the owner's,
  always. Detection output is a proposal that lands in human triage; it never
  resolves, supersedes, or suppresses on its own.
- **No ML, tuned scoring, similarity thresholds, embeddings, or model calls.**
  v1 confidence is a per-class constant. A tuned threshold or a similarity
  score appearing anywhere in this packet's design docs means scope has
  escaped (see Stop Conditions).
- **No extension of the `ContradictionCandidate` contract.** The schema is
  triage's and triage is closed with no active owner. Any field this
  packet turns out to need is negotiated with a future contract owner as their own
  change, never a detector-side edit.
- **No modality-taxonomy authorship or extension.** The MATRES vocabulary is
  owned by `explorations/epistemic-belief-view-revision` per Q9. This packet
  consumes it as an optional input and adopts the axes as-published.
- **No detection work inside `goals/epistemic-contradiction-triage`.** Its
  stop-and-re-scope clause (`SPEC.md:138-139`) stays law; this packet is that
  clause's answer, not its violation.
- **No donor or Chronocept numbers in this packet's prose.** The quarantine in
  `explorations/graphnosis-prior-art/research/SOURCES.md` travels here intact.
- **No verbatim ports.** Clean-room only. If any port becomes verbatim, the
  Graphnosis Apache-2.0 attribution attaches and must be recorded in
  [`research/SOURCES.md`](./research/SOURCES.md) before the code lands.
- **No belief storage, revision, or view-selection ownership.** Detection
  consumes a snapshot; it does not define how beliefs are stored, revised, or
  retired.
- **No durable detection tables, migrations, or server wiring in v1.** The
  detector returns candidates to its caller; persistence is triage's submit
  path, already shipped.

## Source Hierarchy

1. User objective or issue that created this packet.
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. Governing architecture/package standards.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, and `history/` files.

Higher sources outrank lower sources when they conflict.

Provenance (back-links, not copies):
[`explorations/graphnosis-prior-art/BRIEF.md`](../../explorations/graphnosis-prior-art/BRIEF.md)
(§Problem A, §Solution Sketch A, §Rabbit Holes, §No-Gos),
[`DECISIONS.md`](../../explorations/graphnosis-prior-art/DECISIONS.md) (Q1, Q6,
Q9), and
[`research/SYNTHESIS.md`](../../explorations/graphnosis-prior-art/research/SYNTHESIS.md)
(T1-13, wp-09, cc-04/cc-05).

## Target Surfaces

- `packages/epistemic/domain` — NET-NEW detection-side value objects: the
  conflict-class vocabulary, the belief-view snapshot input shape, and the
  per-class confidence constants. The existing `values/Contradiction/*` and
  `entities/Contradiction/*` surfaces are **read-only** to this packet.
- `packages/epistemic/use-cases` — the detection service contract
  (`Context.Service`) and its pure implementation over a snapshot.
- `packages/epistemic/domain/test` + `packages/epistemic/use-cases/test` —
  fixtures and the golden-vector lane.

Explicitly **not** target surfaces: `packages/epistemic/tables`,
`packages/epistemic/server`, `packages/_internal/db-admin`,
`packages/epistemic/ui`. v1 adds no table, migration, repository, or UI.

## Constraints

- **Purity.** Detection reads no wall clock, no environment, no network, no
  model. Every input arrives in the snapshot argument. Ordering of the emitted
  candidate set is total and content-derived, never insertion- or id-derived.
- **Determinism declarations ship with their falsifier (Q6).** Any
  determinism-tier declaration this packet makes lands in the *same PR* as the
  golden vectors that can falsify it. A tier nothing can test is a comment,
  not a contract.
- **v1 detects typed direct-conflict classes only** — exact negation, and
  value-conflict between two beliefs that share a subject and a predicate.
  Nothing else is in scope for v1.
- **Confidence is a per-class constant.** `ContradictionAssessment` requires
  `confidence` (`values/Contradiction/Contradiction.model.ts:905-917`, a
  `Confidence` unit interval). Exact negation emits one fixed documented
  value; value-conflict emits another. The constants and their rationale live
  in this SPEC's decision log once chosen in P1; they are never tuned against
  a corpus.
- **Modality is an optional guard with a stated v1 default (Q9).** When a
  belief carries no modality, detection treats the pair as `comparable`. This
  admits false positives — a hypothetical flagged against a factual — and that
  is acceptable **only** because every candidate lands in human triage. When
  belief-view revision ships the MATRES vocabulary, the guard tightens with no
  contract change. Cite **Ning et al. 2018 (MATRES)**; never Chronocept.
- **Upstream-only boundary.** This packet produces against the shipped
  contract and consumes nothing from triage's storage, review, or approval
  path. Triage's Non-Goals and stop-and-re-scope clause are inputs to this
  spec, not text to be edited.
- **No block on belief-view revision.** That exploration graduated on 2026-08-17 to
  `goals/belief-view-engine`, paused with P1 pending.
  v1 ships with the modality default and does not wait.
- **Effect v4, schema-first.** Design order is schema → `Context.Service`
  contract → implementation. `LiteralKit` for every literal union;
  `effect/HashMap`/`HashSet` (or their `Mutable*` forms), never native
  `Map`/`Set`.

Fat-marker illustration only — the real shapes are settled in P1 schema
design, not here:

```ts
import { LiteralKit } from "@beep/schema";

const ContradictionClassBase = LiteralKit(["exact-negation", "value-conflict"]);
const ModalityComparabilityBase = LiteralKit(["comparable", "incomparable"]);
```

## Open Contract Question (settle in P0, before any P1 schema)

**Where does conflict class ride on the shipped contract?** The BRIEF states
that conflict class rides the existing `matchBasis`/`assessment` shape. The
live tree does not yet carry a seat for it: `ContradictionMatchBasisKind`
(`values/Contradiction/Contradiction.model.ts:436`) is
`["same-source-overlap", "independent-evidence"]` — an *evidence-provenance*
vocabulary, not a conflict-character one. The remaining carriers are
`matchBasis.detector` / `detectorVersion` (free text + SemVer,
`ibid.:554-578`) and per-proposal `rationale` (free text, `ibid.:717`), both
untyped for this purpose.

Exploration `research/SYNTHESIS.md` (wp-09) independently names
`ContradictionMatchBasisKind` "the natural seat" for conflict character. Seating
it there is a **contract extension**, which this packet may not make. P0 must
therefore choose, on the record, between:

1. encoding class in `detector` + `detectorVersion` (typed detector identity,
   untyped class — no triage change), or
2. opening a negotiation with the triage packet owner to widen
   `ContradictionMatchBasisKind`, tracked as triage's change, on triage's
   schedule.

Option 2 is not a v1 dependency: if the negotiation does not close, v1 ships on
option 1. Choosing option 2 and blocking on it is a stop condition.

## Decision Log

Dated entries; links to the source decision, not copies of it.

### 2026-08-06 — This packet exists because triage forbids detection (Q1)

Source:
[`explorations/graphnosis-prior-art/DECISIONS.md`](../../explorations/graphnosis-prior-art/DECISIONS.md)
§`packet-shape (Q1)`. The graphnosis exploration dissolves into amendments plus
exactly two graduations; this is the first. Detection is an explicit Non-Goal
of `goals/epistemic-contradiction-triage` (`SPEC.md:23-26`) *and* a
stop-and-re-scope condition (`SPEC.md:138-139`), so it cannot be amended into
that packet — and by that packet's own text, no existing packet will ever pull
it in. It needed its own owner; this is it.

### 2026-08-06 — Determinism tier ships with golden vectors, never before (Q6)

Source: same file, §`DeterminismTier timing (Q6)`. A determinism declaration
lands in the same PR as the mechanism that can falsify it. This packet's whole
value proposition is "pure function of a snapshot," so the golden-vector lane
is not a nice-to-have in P2 — it is the only thing that makes the purity claim
a contract rather than a comment. Recorded here because Q6 has no amendment
carrying it into any other packet's prose.

### 2026-08-06 — Modality vocabulary is belief-view revision's, not detection's (Q9)

Source: same file, §`MATRES modality placement (Q9)`. Modality qualifies what a
belief *asserts*, so it belongs where beliefs are modeled; detection is one of
its consumers. The dependency direction matters: if detection owned the
vocabulary, revision would import a representation concept from a downstream
consumer. v1 consumes modality as an optional input with a `comparable`
default and adopts the MATRES axes as-published (Ning et al. 2018). The
Chronocept quarantine covers that paper's *numbers*, not Ning et al.'s
taxonomy.

### 2026-10-09 — Verified contract and option 1

Verified against main `36027982f2`: triage code #520 (`244529aa4f`), closed
completed-retained in #1421 (`cd6c9a1b72`), no active owner. Corrected citations
and status facts in GOAL.md, README.md, PLAN.md, SPEC.md and research/SOURCES.md.
Option 1 is selected: class-specific detector identities
`epistemic-contradiction-detection-exact-negation` and
`epistemic-contradiction-detection-value-conflict`, detectorVersion `1.0.0`.
The shipped evidence-provenance kind remains unchanged. Widening
`ContradictionMatchBasisKind` is a follow-up for a future contract owner, not a
dependency. Reversal: migrate identities only after that owner ships a versioned
contract change; retain the class-untyped exception until then.

### 2026-10-09 — Snapshot, rules and conformance

`ContradictionDetectionSnapshot` is caller-populated: beliefs carry `ref`,
`subject`, `predicate`, JSON `value`, `polarity` (asserted/negated), 1–32 unique
`evidenceIds`, half-open `validFrom`/`validTo`, and optional opaque `modality`.
It also carries `singleValuedPredicates`. EdgeVersion lacks triples and polarity,
so no inferred adapter is added. Reversal: callers may later supply a typed
adapter when a representation owner ships one.

Compare only identical subject and predicate keys. Value equality is canonical
JSON equality: no folding, conversion or similarity. Exact negation requires
equal values and opposite polarity, independent of cardinality. Value-conflict
requires unequal values, both asserted and a declared single-valued predicate.
Agreement, mixed polarity with unequal values, two negated values and undeclared
value-conflicts emit nothing. Missing modality is comparable; both present and
unequal are incomparable. No MATRES taxonomy is authored here (Ning et al. 2018,
per Q9). Reversal: version the detector if these rules change; replace opaque
modality only after its owner ships a vocabulary.

Candidate validity is the intersection of the two half-open intervals; disjoint
pairs emit nothing. Each side gets a human-review proposal losing that side's
ref and taking the other assertion as `{subject, predicate, value, polarity}`.
The snapshot validates this entire fact against the shipped fact bounds, so an
oversize assertion is a typed error and never truncated. Proposal ids are SHA256
of canonical JSON containing the losing ref and that fact; proposal digests use
the shipped helper. Rationale is fixed per class. Reversal: introduce a new
version for a changed fact shape or identity derivation.

Disjoint evidence means independent-evidence; overlap means same-source-overlap.
ExactNegationConfidence is 1: an explicit equal assertion and its negation cannot
both hold. ValueConflictConfidence is 0.9: declared cardinality is trusted input
but may be mistaken. These are reasoning-based review hints, never corpus-tuned
scores. Reversal: document and version any changed constants. Pairs and evidence
are canonicalized with the shipped helper, proposals sorted by proposalId,
candidates deduplicated and sorted by candidateKey using Order.String.

`DetectedContradiction` emits exactly ContradictionCandidateContent fields
(assessment, matchBasis, pair, validFrom, validTo) plus candidateKey and
candidateDigest. No clock or database stamps are minted. Every golden emission
is lifted with productEntityFixtureInput("EpistemicContradictionCandidate", i)
and recordedAt: 0, decoded against the full ContradictionCandidate entity and
checked with hasValidSeals. Content decode and caller-stamped
SubmitContradictionCandidate decode are additional checks. Reversal: a separate
caller-owned stamping adapter can be added without weakening full-entity proof.

### 2026-10-09 — Concept generator scope

Architecture dry-run plans placeholder WorkPriority files and package-level
AGENTS.md, LICENSE and test/.gitkeep, plus a differing values barrel. Apply is
unsafe for an existing package. Hand-author the four planned concept files in
ContradictionDetection, add the export and barrel only, then run config-sync.
Reversal: remove the new concept/export/barrel and regenerate aliases.
The receipt is research/OPPORTUNITIES.md. Snapshot refs must be unique by
edgeVersionId: one immutable version cannot carry two assertions in one view.
Reject duplicate refs at decoding instead of order-dependent pair deduplication.
Reversal: define an explicit merge rule and version the snapshot if needed.

### 2026-10-09 — Authoritative verification route

AGENTS.md makes hosted required checks authoritative; local yeet verify is
on-demand and does not gate publication. Record final-head hosted results in
P2 evidence. Reversal: retain that evidence if the repository later restores a
mandatory local proof, and run the then-current owner command.

### 2026-10-09 — Run-2 publication and contradictory release policy

Draft PR #1572 is published at `a7271fb15e`. Main integration includes #1566
(`2eefbb64af`), which forbids changesets for private workspaces and removes the
brief's execution-ledger changeset precedent. The lane brief explicitly requires
patch notes for both private epistemic packages, so its required note now fails
Repo Sanity. Apply the materially contradictory source stop: retain the note and
draft PR, do not flip lifecycle or claim readiness, and record the blocker in the
handoff. Reversal: reconcile the brief with the shipped release policy, remove
the lane note if authorized by the reconciled instructions, and resume package
qualification before a final wave. No release policy or package privacy change
belongs to this lane.

The introduced test-law and unused-index findings were repaired at `a7271fb15e`
without widening scope or changing runtime detection rules. Reversal: a future
versioned entrypoint change may relocate the schemas, preserving client safety.
Hosted Storybook separately exposed a non-empty proposals typing error at
ContradictionDetection.layer.ts:135; it remains outstanding at the stop.

### 2026-10-09 — Run-3 qualification rulings

Private packages carry no changesets per #1566; reversal: none needed, the
policy is repo-wide. The former private-package note is removed under the
orchestrator's explicit superseding ruling.

Decode the sorted proposals through the shipped assessment field's type codec,
then encode through that same non-empty field. This preserves both proposals
and its non-empty encoded tuple without casts. A typed wire regression checks
both proposals survive and an empty assessment fails. Reversal: replace this
codec only with an equivalent schema-derived non-empty representation.

### 2026-10-09 — Scoped test Context and clock isolation

Build the detector Layer in each test's existing scope and provide its Context
from the existing detection helper. Standard it.effect owns the per-test
TestClock, so purity vectors advance isolated clocks. Package tsgo and runtime
goldens pass. Plain Effect/Vitest lint rejects
this candidate with ten EV002 call-site findings and one EV003 wrapper finding.
The successful rows export is not a lint pass. This decision remains an
unqualified candidate at the repeated-blocker stop.
Reversal: an equivalent scoped test entrypoint that passes both gates and
preserves per-test clock ownership. Detection production semantics are unchanged.

## Acceptance Criteria

- [ ] The conflict-class seat question above is answered on the record in
      `PLAN.md` P0 (and, if it changes the contract story, in this decision
      log) before any P1 schema lands.
- [ ] A `LiteralKit` conflict-class vocabulary and a belief-view snapshot input
      schema exist, followed by a `Context.Service` detection contract, followed
      by its implementation — in that order, per repo design law.
- [ ] Detection is a pure function: no `Clock`/`DateTime.now`, no environment
      read, no network, no model call on the detection path; proven by a test
      that runs the same snapshot twice with the clock advanced between runs
      and asserts identical output.
- [ ] Golden vectors covering exact negation and value-conflict land in the
      same PR as any determinism claim, including negative vectors (a pair that
      shares a subject but not a predicate; a pair distinguished only by
      modality).
- [ ] Every emitted candidate decodes against the shipped
      `ContradictionCandidate` schema with no change to
      `packages/epistemic/domain/src/{values,entities}/Contradiction/`.
- [ ] Confidence values are per-class constants, documented with their
      rationale; no tuned score, threshold, or similarity metric appears in
      code or docs.
- [ ] Reflection passes `bun run beep lint reflection-artifacts`; the packet
      state flip lands in the same PR as the final work.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/epistemic-contradiction-detection/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/epistemic-contradiction-detection/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/epistemic-contradiction-detection` | Passes |
| Contract untouched | `git diff --stat -- packages/epistemic/domain/src/values/Contradiction packages/epistemic/domain/src/entities/Contradiction` | Empty |
| Focused suites | epistemic domain + use-cases vitest lanes | Green |
| Golden vectors | detection golden-vector lane, run twice | Byte-identical output |
| Full proof | `bun run beep yeet verify` | SUCCESS |

## Stop Conditions

- A tuned threshold, similarity score, embedding, or model call becomes
  necessary to satisfy a v1 acceptance criterion — scope has escaped; stop and
  re-scope to a future packet with calibration data.
- The design requires a `ContradictionCandidate` contract change that the
  triage packet's owner has not agreed to, or v1 comes to depend on a
  negotiation that has not closed.
- The design requires belief-view revision to ship its modality vocabulary
  first — v1 must run on the stated default instead.
- Required source files are missing or materially contradictory.
- Verification requires credentials, cost, destructive side effects, or policy
  approval not named in this spec.
- The same blocker repeats after reasonable investigation.

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| Modality defaults to `comparable` when absent | Detection input guard only | @beep-team | Belief-view revision graduated to the paused belief-view-engine goal and owns the vocabulary (Q9); v1 must not block on it. Admitted false positives are bounded by human triage on every candidate. | Belief-view revision ships the MATRES vocabulary; the guard tightens with no contract change. |
| Conflict class carried untyped if option 1 is chosen | `matchBasis.detector` / `detectorVersion` prose | @beep-team | The typed seat (`ContradictionMatchBasisKind`) is triage's shipped schema and triage is closed with no active owner; unilateral extension is forbidden. | A future contract owner accepts a widened `ContradictionMatchBasisKind` as their own change. |

| Undeclared predicates are multi-valued | Value-conflict rule only | @beep-team | Conservative cardinality default avoids inventing contradictions; caller declarations are typed input. | Representation owner supplies an authoritative cardinality schema. |

## Run-4 test-policy admission decision (2026-10-09)

Canonical `it.layer(ContradictionDetectionLive, { timeout: "10 seconds" })`
provision replaces manual scoped Context construction. Enforcing Effect/Vitest
lint removes all ten EV002 call-site findings and the EV003 wrapper finding.
One EV015 judgment remains at the golden test's `TestClock.adjust`: the shared
clock is advanced only in serial tests to falsify detector clock dependence;
there are no forks or concurrent tests. This is **pending B admission** under
the 2026-10-09T20:55Z resume ruling. No inventory, baseline or suppression is
changed. Reversal: isolate test services with an equivalent canonical harness
that retains the clock-independence assertion, or admit the reviewed judgment
through the policy owner's workflow. Publication proceeds under S11 after
recording the refused cheap gate; merge belongs to the orchestrator.

### 2026-10-09 — P3 acceptance under the orchestrator's S11 ruling

The lane brief supersedes this packet's older P3 green-hosted exit with the
S11 handoff: content-final and ready PR, addressed review threads, no conflict,
retained local qualification and exact-head hosted receipts. The orchestrator
owns merge and consolidated hosted-red burn-down. This is not a claim that
hosted CI is green or that the standard Yeet merge-ready gate returned yes.
Two review threads concerning that distinction are answered and resolved via
`yeet reply`; PLAN records the applicable S11 exit rather than claiming CLEAN.
Reversal: restore the ordinary hosted-green P3 gate when the program's S11
exception ends; the detector's runtime/schema semantics do not change.
