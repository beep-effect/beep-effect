# Epistemic Contradiction Detection Spec

## Objective

Produce `ContradictionCandidate` records for typed direct-conflict classes as a
**pure function of a belief-view snapshot** — deterministic, model-free, and
goldenable — against the contract `goals/epistemic-contradiction-triage`
already ships. Detection proposes; triage disposes.

Observable result: given one fixed belief-view snapshot, the detector emits the
same candidate set on every run, in the same order, on any machine; every
emitted record decodes against the sealed `ContradictionCandidate` schema
(`packages/epistemic/domain/src/entities/Contradiction/Contradiction.model.ts:58-86`);
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
  triage's and triage has not closed (P2 verify in flight). Any field this
  packet turns out to need is negotiated with that packet's owner as its own
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
  `confidence` (`values/Contradiction/Contradiction.model.ts:913-925`, a
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
- **No block on belief-view revision.** That exploration is at capture stage.
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
(`values/Contradiction/Contradiction.model.ts:435`) is
`["same-source-overlap", "independent-evidence"]` — an *evidence-provenance*
vocabulary, not a conflict-character one. The remaining carriers are
`matchBasis.detector` / `detectorVersion` (free text + SemVer,
`ibid.:560-584`) and per-proposal `rationale` (free text, `ibid.:784`), both
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
| Modality defaults to `comparable` when absent | Detection input guard only | @beep-team | Belief-view revision is at capture stage and owns the vocabulary (Q9); v1 must not block on it. Admitted false positives are bounded by human triage on every candidate. | Belief-view revision ships the MATRES vocabulary; the guard tightens with no contract change. |
| Conflict class carried untyped if option 1 is chosen | `matchBasis.detector` / `detectorVersion` prose | @beep-team | The typed seat (`ContradictionMatchBasisKind`) is triage's schema and triage has not closed; unilateral extension is forbidden. | The triage owner accepts a widened `ContradictionMatchBasisKind` as their own change. |
