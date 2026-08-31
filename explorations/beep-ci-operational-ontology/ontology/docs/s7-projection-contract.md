# S7 Projection Contract (binding)

Stage S7 of the pipeline: the **projection function** — the loop-closer.
`(T-Box, A-Box, live instance data) → WorkUnit schedule`, deterministic and
property-tested (uncontested amendment 1, DECISIONS.md 2026-08-27). This
contract binds the v1 implementation. Rulings: DECISIONS.md
§"2026-08-30 — S7 sitting 1".

Sequencing note: the steward re-ordered the queue on merging #919 — S7 runs
now; auditor run 2 follows. The six S6-surfaced gaps are explicitly
unavailable inputs recorded below, never silent assumptions.

## 1. Inputs (all frozen at the branch cut, `ontology-s7-projection`)

| Input | Artifact | Role |
| --- | --- | --- |
| T-Box | `ontology/extraction/s5/TAXONOMY.yaml` (38 ratified terms) | node-class vocabulary |
| A-Box | `ontology/extraction/s6/graphs/abox.ttl` + `ABOX.yaml` | policy parameters, weights, priorities |
| Live instance data | `ontology/extraction/s6/snapshot/raw/journal.ndjson` — pinned golden journal (79 events, redacted digest recorded in `snapshot/raw/MANIFEST.yaml`) | replay corpus |
| Live schema mirror | `packages/tooling/tool/cli/src/internal/repo-run/{AdmissionJournal,QualityScheduler.schemas}.ts` | decoded event/request shapes |
| Deployed invariant | `QualityScheduler.ts` charge-vs-capacity check (`activeTokenTotal + weight <= capacityTokens`) | the semantics v1 must reproduce |

Ratified policy parameters (from the S6 A-Box; the projection decodes them
from `graphs/abox.ttl`, never hard-codes them): `capacityMaxTokens 10`,
`slotSizeGib 5`, `reserveGib 10`, `hardFloorGib 15`, `heartbeatSeconds 5`,
`publishAgingSeconds 120`, `reviewFixClassCap 3`; weights `full-proof 3`,
`merged-preview 5`, `review-fix 1`, `publish 1`; priorities `publish`,
`verify`.

Journal reality (raw NDJSON, decoded via `AdmissionJournalEvent`): admitted
events carry `kind`, `weightTokens`, `priority`, `originKey`,
`enqueuedAtMillis`, `admittedAtMillis`; released events pair by `nonce`. The
S6 vocabulary gaps were about missing RDF predicates, not missing bytes — the
raw replay corpus is complete for the admission slice. Known censorship:
requests that never reached admission are absent entirely (no queue-entry
event exists); recorded, not modeled.

## 2. Rulings (sitting 1 — summary; DECISIONS.md is authoritative)

1. **Layered scope**: v1 = deterministic admission-order projection; the
   service contract carries an explicit lane-DAG planner seam (`Graph.topo`
   territory) that v1 declares but does not implement.
2. **Provisional ordering vocabulary**: emitted nodes typed with ratified
   `ciops:` classes; ordering predicates (`hasCurrentProposal`, `hasStep`,
   `stepIndex`, `schedulesWorkUnit`, `hasScope`) and class `ScheduleStep`
   emitted in the provisional `ciops-prov:` named graph (S6 census precedent:
   open closure, excluded from negation/typing). These terms join the run-2
   re-proposal queue.
3. **Landing zone**: new labs app `apps/labs/ciops` via
   `bun run beep create-package` — schemas, `Context.Service` contract,
   engine, and property tests all incubate there, off the required turbo
   graphs. Proven pieces graduate later (`packages/ontology/domain`, then
   repo-cli/yeet).
4. **Differential replay gates v1**: a Must property replays the pinned
   golden journal and requires the projected admission order to reproduce the
   deployed scheduler's actual grant order. Mismatches are semantic findings
   → run-2 evidence.

## 3. Architecture (design order is law: schema → service → impl)

### 3.1 Schemas (all `S.Class` / LiteralKit; no hand-rolled unions)

- `AdmissionPolicyParams` — the seven ratified parameters + four weights +
  priority order, decoded from `graphs/abox.ttl` (rdflib-free: a small
  Turtle reader is NOT the job — parse via a checked extraction of the
  known-shape file, or embed the `ABOX.yaml` decode; either way the values
  are read from the ratified artifact bytes, never retyped by hand).
- `PendingRequest` — the projection's request view (nonce, kind, priority,
  weightTokens, originKey, enqueuedAtMillis) — derived from
  `AdmissionJournalAdmitted` for replay and shaped to accept live
  `AdmissionRequest` later.
- `TokenLedgerState` — active grants (nonce → weight) + derived
  `activeTokenTotal`; reconstructed from admitted/released deltas.
- `ScheduleStep` — stepIndex, scheduled unit ref, scope tag (v1: the
  admission act itself; the planner seam widens this in v2).
- `ScheduleProposal` — proposal id, projection instant, ordered steps,
  input digests (policy digest + journal-prefix digest) for provenance.
- `ProjectionMismatch` / typed errors — `S.TaggedError` family
  (`CyclicPlanError` reserved for the planner seam, `PolicyDecodeError`,
  `ReplayMismatchError`).

### 3.2 Service contract (`Context.Service`, effect v4)

`CiOpsProjection` with:

- `project(input: ProjectionInput): Effect<ScheduleProposal, PolicyDecodeError>`
  — the pure core, deterministic, no clock access (instant is an input).
- `emitAbox(proposal): Effect<TurtleDocument>` — schedule-as-A-Box emission
  per ruling 2 (ratified classes in `ciops:`, ordering edges in
  `ciops-prov:`), deterministic serialization (canonical triple order).
- `planEpisode` — the lane-DAG planner SEAM: typed signature reserved
  (`Effect<never, PlannerNotImplementedError>` or equivalent honest
  stub), documented as v2; `Graph.topo` + `isAcyclic` pre-check territory.
- A `TxRef`-backed live wrapper (the `DrainableWorker` idiom:
  `TxQueue`/`TxRef` + `Effect.txRetry` inside `Effect.tx`) holding the
  current proposal — the `hasCurrentProposal` re-pointing precedent — is the
  service's stateful shell; the core stays pure.

### 3.3 Determinism rules (NFR-1)

- No `Date.now`/clock in the core — the projection instant is an argument.
- Canonical request ordering before any iteration: sort by
  (priority rank, enqueuedAtMillis, originKey, nonce) — total and stable.
- `Graph` construction (planner seam, v2) inserts nodes in canonical order —
  `Graph.topo` (Kahn's over CSR) is deterministic only for a fixed insertion
  order; cyclic input fails typed after an `isAcyclic` pre-check.
- Emission is byte-deterministic: same input → byte-equal Turtle.

### 3.4 Admission semantics v1 (mirrors the deployed scheduler; never invents)

Given pending requests, ledger state, and policy params, admit greedily in
canonical order subject to: `activeTokenTotal + weightTokens <=
capacityMaxTokens`; priority `publish` ahead of `verify` with
`publishAgingSeconds` aging; `reviewFixClassCap` class cap; starvation bound
inherited as hard admissibility (an eligible request held beyond the declared
bound without a modeled `StarvationException` is a projection error, not a
warning). Where the deployed scheduler's observed behavior and this contract
disagree, the REPLAY decides: reproduce deployed semantics and record the
contract delta as run-2 evidence.

## 4. Property suite (all gate; @effect/vitest + schema-derived Arbitraries)

1. **Determinism** — same `ProjectionInput` twice → structurally equal
   proposal AND byte-equal emitted Turtle.
2. **Admissibility** — every prescribed step satisfies charge-vs-capacity at
   its position in the ledger fold; no step ever exceeds
   `capacityMaxTokens`.
3. **Totality** — every pending request appears in the proposal exactly once
   (admitted step or explicit deferred tail); nothing invented, nothing
   dropped.
4. **Priority/aging** — a `verify` request never precedes an eligible
   `publish` request older than the aging bound; class caps honored.
5. **Differential replay (Must, gating)** — decode the pinned golden journal,
   reconstruct the pending set at each admitted event's instant
   (`enqueuedAtMillis <= t < admittedAtMillis`), project, and require the
   projection's first admitted choice to equal the event's actual admission,
   ledger folded forward by admitted/released deltas. Frozen bytes → no
   flake. Any mismatch fails the suite and is recorded as run-2 evidence in
   the packet.

## 5. Evidence & gates

- Replay outcome (pass, or the mismatch census) lands in packet
  `research/s7-replay-evidence.md` — generated content marked as such.
- `bun run beep quality package-verify @beep/ciops` green before handoff;
  packet gates (`validate_packet.py` base/`--s5`/`--s6`, CQ suite) stay
  green and untouched.
- The pinned S6 evidence bytes are read-only inputs — never edited, never
  regenerated by S7 (the digest-locked-evidence law).

## 6. Non-goals (v1)

- No lane-DAG planner implementation (seam only).
- No scheduler replacement or repo-cli integration — the deployed
  `QualityScheduler` stays the only writer of real admissions.
- No T-Box changes, no vocabulary ratification (run 2's job), no IRI-scheme
  changes (S8).
- No live-journal tailing daemon — v1 projects from explicit inputs; the Tx
  wrapper holds state in-process only.
- No KPI ETL (separate incubation lane per the incubation-home decision).
