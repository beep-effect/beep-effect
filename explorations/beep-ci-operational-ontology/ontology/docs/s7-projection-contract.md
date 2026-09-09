# S7 Projection Contract (binding)

Stage S7 of the pipeline: the **projection function** — the loop-closer.
`(T-Box, A-Box, live instance data) → WorkUnit schedule`, deterministic and
property-tested (uncontested amendment 1, DECISIONS.md 2026-08-27). This
contract binds the v1 admission engine with S7 emission v2. Rulings:
DECISIONS.md §"2026-08-30 — S7 sitting 1" and
§"2026-09-03 — run-3 corpora design grill", rulings 4, 13–16.

**This is instrumentation FOR run-3 ratification evidence, not ratification.**
The ordering cluster and its `ciops-prov:` namespace re-proposal remain
run-3 decisions. Emission v2 does not implement the future lane-DAG planner.

## 1. Inputs (historical S7 baseline, frozen at `ontology-s7-projection`)

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
raw replay corpus carries the recorded admission slice. Known censorship:
requests that never reached admission are absent entirely (no queue-entry
event exists); recorded, not modeled.

## 2. Rulings (sitting 1 — summary; DECISIONS.md is authoritative)

1. **Layered scope**: v1 = deterministic admission-order projection; the
   service contract carries an explicit lane-DAG planner seam (`Graph.topo`
   territory) that v1 declares but does not implement.
2. **Provisional ordering vocabulary**: emitted nodes typed with ratified
   `ciops:` classes; ordering predicates (`hasCurrentProposal`, `hasStep`,
   `stepIndex`, `schedulesSeatRequest`, `hasScopeTag`) and class `ScheduleStep`
   emitted in `ciops-prov:`. Emission v2 adds the episode, specification,
   digests, nonce carrier, and deferred-tail edge described in §3.5. These
   are prefix-separated triples under a provisional comment in valid Turtle,
   not a TriG named-graph block. Closure is open; provisional facts are
   excluded from negation and ratified typing. The cluster goes to run 3.
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
  deferred tail, required episode id, and input digests (policy digest +
  journal-prefix digest) for provenance.
- `ProjectionInput` — the explicit policy, pending requests, token ledger,
  projection instant, provenance digests, and required non-empty `episodeId`.
  The caller supplies the occurrence identity; there is no singleton default.
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
  The proposal retains `episodeId` from `project` through `projectCurrent`
  and the transactional current-proposal/change-queue shell to `emitAbox`.
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
- `stepIndex` stays **0-based**. Only admitted actions get steps; the
  deferred tail never extends or renumbers that sequence (run-3 ruling 14).

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

### 3.5 Emission v2 individuals, relations, and identity criteria

Ratified `ciops:ScheduleProposal` and `ciops:SeatRequest` typing, admission
charges (`xsd:integer`), and origin-key literals are preserved. Every
projection, including empty and fully deferred proposals, emits one typed
episode subject and one typed specification individual. The following
terms remain provisional under `https://oip.law/ontology/ci-ops-prov#`:

| Term | Subject → object / value |
| --- | --- |
| `VerificationEpisode` | Class of the bounded verification occurrence |
| `hasCurrentProposal` | Episode → `ciops:ScheduleProposal` |
| `hasProjectionSpecification` | Proposal → specification, matching amended CQ-020's join |
| `AdmissionProjectionSpecification` | Class of the governing projection specification |
| `policyDigest` | Specification → supplied policy digest (`xsd:string`) |
| `journalPrefixDigest` | Specification → supplied journal-prefix digest / locator (`xsd:string`) |
| `hasStep` | Proposal → `ScheduleStep` |
| `ScheduleStep` | Class of an admitted ordering step |
| `stepIndex` | Step → 0-based ordinal (`xsd:integer`) |
| `schedulesSeatRequest` | Step → positional `ciops:SeatRequest` node |
| `hasScopeTag` | Step → `ScheduleScope` literal (`xsd:string`), exactly `{"admission"}` in v1 |
| `scheduledUnitRef` | Every request → its scheduled unit's nonce (`xsd:string`) |
| `defersSeatRequest` | Proposal → each deferred request, with no associated step |

**Episode identity.** `ProjectionInput.episodeId` is a required non-empty
caller-owned occurrence key and is copied unchanged into `ScheduleProposal`.
The node is `ciops-prov:episode-${pnLocalSlug(episodeId)}`. For differential
replay the key is exactly `replay-${journalDigest}-${eventIndex}`, where
`journalDigest` is the pinned full-journal SHA-256 supplied by the evidence
generator and `eventIndex` is the zero-based decoded source-event index
(including release and eviction rows). Its occurrence is one verification
of a recorded grant: reconstruct the pending/ledger snapshot immediately
before that transition, project, compare against the recorded nonce, and
finish with a verdict and ledger fold. This is bounded by an identified
transition, not the scheduler's lifetime. Changing the source path or
replaying the same pinned bytes preserves identity; a changed corpus digest
or another event index denotes another corpus-scoped verification episode.
It does not claim cross-capture identity when a journal grows.

A live caller must supply a key for its bounded verification occurrence
and retain it across proposal revisions for that occurrence. The emitter
returns a current snapshot: consumers must **replace** the prior document
for that episode, not append snapshots and expect RDF to retract the old
`hasCurrentProposal` edge. The in-process shell holds one latest proposal;
it is not a persistent per-episode graph store.

**Specification identity (authority / version / applicability).** Authority
is this S7 contract and the `@beep/ciops` admission projection of the
S6 policy A-Box. The immutable emission contract version is `s7-emission/v2`.
The specification IRI is `ciops-prov:specification-` followed by the ordered
tuple `(contract version, policyDigest, journalPrefixDigest, admission)`.
Each component is independently encoded with the existing `pnLocalSlug`;
literal `-` separates components. The encoder preserves only ASCII
alphanumerics and escapes every other UTF-8 byte as `%HH`, including `-`,
so tuple boundaries cannot be forged. This is content-derived and
collision-free for distinct well-formed UTF-8 tuples without truncated
hashes; the tradeoff is a longer IRI. It reuses the existing IRI encoding,
with no change to proposal/step/request syntax and no new S8 scheme.

Applicability is the supplied policy artifact, journal boundary, and
admission scope, even when no step is emitted. Episode id, proposal id, and
projection instant do not change specification identity. Any tuple member
change does. `policyDigest` and `journalPrefixDigest` are serialized exactly
as supplied; emission does not recompute or certify them. In existing replay,
the latter is `${journalDigest}-${eventIndex}`, a digest-bound boundary
locator, not a separate SHA-256 of prefix bytes. Both remain non-empty
strings at the existing schema boundary.

**Tail and nonce evidence.** No existing emitted relation linked the
deferred tail to its proposal. V2 therefore adds the single provisional
`defersSeatRequest` edge per tail request. Amended CQ-020 deliberately sees
only admitted steps; consumers can inspect deferred membership separately,
without treating a deferral as a scheduled action or assigning it an ordinal.
Request IRIs remain `${proposalNode}-request-${index}` over admitted requests
followed by the deferred tail. `scheduledUnitRef` carries `request.nonce`
on every request, including deferred ones; for admitted requests the engine
also copies that nonce to `ScheduleStep.scheduledUnitRef`. This supplies
nonce-grain evidence without claiming nonce-based RDF identity.

The literal emission `hasScope` is retired in favor of `hasScopeTag`.
No object-property `hasScope` or `Scope` individual is introduced. The
historical `schedulesWorkUnit` carrier in CQ-019 arm 3 and its fixture remain
unchanged under ruling 16. No registry, T-Box, seed, or CQ amendment occurs
here. Emission-to-CQ checks adapt only the provisional namespace spellings
and episode binding in memory; they do not certify vocabulary ratification.

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
  For read-only verification, run `bun run evidence:s7 --check` from
  `apps/labs/ciops`; it prints the replay report without overwriting frozen
  packet evidence. The v2 emission golden is compared byte-for-byte with
  current emitter output by the package tests, then queried with amended
  CQ-020 by `scripts/check-emission-cq.py` in that app.
- `bun run beep quality package-verify @beep/ciops` green before handoff;
  packet gates (`validate_packet.py` base/`--s5`/`--s6`, CQ suite) stay
  green and untouched.
- The pinned S6 evidence bytes are read-only inputs — never edited, never
  regenerated by S7 (the digest-locked-evidence law).

## 6. Non-goals (admission v1 / emission v2)

- No lane-DAG planner implementation (seam only).
- No scheduler replacement or repo-cli integration — the deployed
  `QualityScheduler` stays the only writer of real admissions.
- No T-Box changes, no vocabulary ratification (run 3's job), no IRI-scheme
  changes (S8).
- No live-journal tailing daemon — v1 projects from explicit inputs; the Tx
  wrapper holds state in-process only.
- No KPI ETL (separate incubation lane per the incubation-home decision).
