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
  *(2026-10-06: superseded by §8. Lane steps are `LaneStep` in
  `LanePlanProposal`; `ScheduleStep` stays admission-only and is never
  widened.)*
- `ScheduleProposal` — proposal id, projection instant, ordered steps,
  deferred tail, required episode id, and input digests (policy digest +
  journal-prefix digest) for provenance.
- `ProjectionInput` — the explicit policy, pending requests, token ledger,
  projection instant, provenance digests, and required non-empty `episodeId`.
  The caller supplies the occurrence identity; there is no singleton default.
- `ProjectionMismatch` / typed errors — `S.TaggedError` family
  (`CyclicPlanError` reserved for the planner seam, `PolicyDecodeError`,
  `ReplayMismatchError`). *(2026-10-06: `CyclicPlanError` is no longer
  reserved, and the planner adds three handoff errors; see §8.3.)*

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
  *Superseded by §8 (2026-10-06).*
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
  *(2026-10-06: superseded; see §8.3. Nodes go in `declarationIndex` order,
  not canonical order, and `Graph.findCycle` replaces `isAcyclic`.)*
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
  packet evidence. *(2026-10-06 note: the bare `bun run evidence:s7` is
  already check-by-default, so the extra `--check` is redundant; only
  `evidence:s7:write` rewrites the frozen file. See §8 for the live-evidence
  file.)* The v2 emission golden is compared byte-for-byte with
  current emitter output by the package tests, then queried with amended
  CQ-020 by `apps/labs/ciops/scripts/check-emission-cq.py`.
- `bun run beep quality package-verify @beep/ciops` green before handoff;
  packet gates (`validate_packet.py` base/`--s5`/`--s6`, CQ suite) stay
  green and untouched.
- The pinned S6 evidence bytes are read-only inputs — never edited, never
  regenerated by S7 (the digest-locked-evidence law).

## 6. Non-goals (admission v1 / emission v2)

- No lane-DAG planner implementation (seam only).
  *Superseded by §8 (2026-10-06).*
- No scheduler replacement or repo-cli integration — the deployed
  `QualityScheduler` stays the only writer of real admissions.
- No T-Box changes, no vocabulary ratification (run 3's job), no IRI-scheme
  changes (S8).
- No live-journal tailing daemon — v1 projects from explicit inputs; the Tx
  wrapper holds state in-process only.
- No KPI ETL (separate incubation lane per the incubation-home decision).

## 7. 2026-10-01 amendment — deployed deltas since the baseline

Authority: DECISIONS.md, "2026-10-01 — graduation sitting" (Rulings 9 and 11).
Sections 1–6 record the 2026-08-30 baseline; emission stays `s7-emission/v2`.

- **Baseline reference.** `ontology-s7-projection` (§1) was the lane branch and
  is not a ref. The resolvable baseline is `1cdce452ae` (#936/#940, 2026-08-31):
  TAXONOMY `term_count` 38 and the 79-event golden journal. HEAD TAXONOMY has 52
  terms (#1089).
- **Journal versions.** The lab decodes the deployed 9-member admission-journal
  union (v1–v3). Replay folds v2 `admission-lease-evicted` rows as releases, so
  §3.1's TokenLedgerState is reconstructed from admitted, released and
  lease-evicted deltas. v3 `admission-enqueued` and `admission-withdrawn` are
  decoded and folded as no-ops: queue-entry censorship is closed at the data
  level for v3 writers and stays recorded, not modeled, in the lab. The replay
  corpus is still the v1 golden journal; the lab test suite runs 19 tests at
  `04993ae26a`. *(2026-10-06 note: that count is stale. At `af48ef4080`, the
  P2 branch base, the suite ran 25 tests in three files: `projection` 18,
  `evidence` 6, `health` 1. The §8 seam commit adds `lane-plan.test.ts` with 8,
  for 33 in four files. Counts are measurements, not contract terms.)*
- **§3.4 deployed skip set.** Since #929 the deployed scheduler skips on
  same-checkout lease, legacy same-origin drain, fresh origin stamp, or
  saturated review-fix class cap, and hosts below the memory envelope keep an
  exclusive fallback origin lease (`scope.md` 2026-10-01 amendment). Admission
  v1 models none of the checkout or origin terms; v3 rows carry `checkoutRoot`.
- **Evidence.** `bun run evidence:s7 --check` reproduces PASS 41/41 on journal
  `cf30b993…`. `research/s7-replay-evidence.md` is the 2026-08-31 render; the
  generator prose has folded v2 lease-eviction rows since #964. The bare
  `evidence:s7` script rewrites that frozen file; re-rendering it needs a
  DECISIONS entry. *(2026-10-06 correction: the bare `evidence:s7` checks; it
  runs the generator with `--check` and prints the report without writing.
  Only `evidence:s7:write` rewrites the frozen file, and that still needs a
  DECISIONS entry.)*
- **Seam (§3.2, §6).** Ruling 11 authorizes widening the S7-v2 seam as goal
  scope, design first: the amendment of §3.2 and §6 and the `PlanEpisodeInput`
  widening are the first deliverable of workstream W6 in goal phase P2
  (`goals/ciops-ontology-pipeline`) and land before any `planEpisode` body.
  `PlanEpisodeInput` (today `{ episodeId }`) widens to carry the gate-order
  handoff path and sha256 (`gate-order-handoff/v1`,
  `goals/time-to-certainty/research/gate-order-handoff.json`), and the success
  type becomes a lane-step proposal. The lab decodes only the handoff subset it
  reads, pinned by sha256 and never importing repo-cli. Lane steps stay
  provisional in `ciops-prov:` until an auditor run ratifies a lane-scheduling
  relation; `schedulesWorkUnit` stays unratified until run 4
  (`research/auditor-run4-intake.md` Queue E item 2). Until that amendment
  lands, §3.2 and §6 bind as written and `planEpisode` stays the
  `PlannerNotImplementedError` stub. *(2026-10-06: the amendment landed as §8.)*

## 8. 2026-10-06 amendment — the S7-v2 planner seam (W6)

Authority: `goals/ciops-ontology-pipeline/research/decisions.md`,
"2026-10-06 — P2 design sitting" (Rulings 1–6), and DECISIONS.md,
"2026-10-01 — graduation sitting" (Ruling 11). This section supersedes the
§3.2 `planEpisode` bullet and the first §6 bullet. It lands in the first
commit of the projection PR, while `planEpisode` is still the stub; the body
lands in a later commit of the same PR (Ruling 1). Admission v1 and emission
`s7-emission/v2` are unchanged, and their golden stays byte-equal.

### 8.1 §3.2 `planEpisode` (replaces the bullet)

- `planEpisode(input: PlanEpisodeInput): Effect<LanePlanProposal,
  HandoffReadError | HandoffDigestMismatchError | HandoffDecodeError |
  CyclicPlanError>` is the lane-order planner.
  - `PlanEpisodeInput` is `{ episodeId, repoRoot, handoff: { path, sha256 } }`.
    `episodeId` is the caller-owned occurrence key (§3.5). `repoRoot` is the
    caller-supplied root. `handoff` locates a `gate-order-handoff/v1`
    document (today `goals/time-to-certainty/research/gate-order-handoff.json`,
    time-to-certainty ruling 78) and pins its SHA-256. `path` is repo-relative:
    the schema rejects an absolute path and any `..` segment.
  - The planner reads the raw bytes at `repoRoot/path` through `FileSystem`
    (`HandoffReadError`) and digests them through `Crypto` with
    `Sha256HexFromBytes`, never a re-encoded string. A digest that differs from
    `handoff.sha256` fails `HandoffDigestMismatchError` before any decode.
  - Only then does it decode the subset it reads (`HandoffDecodeError`):
    `schemaVersion`, `scope`, `orderRule`, and each lane's `rank`, `laneId`
    and `declarationIndex`. Every other member is ignored. The lab never
    imports repo-cli and never mirrors `GateOrderHandoff`. A duplicate
    `laneId` is a decode failure, not a cycle. So are an empty lane array, a
    duplicate `declarationIndex`, and a rank set other than exactly `0..n−1`
    (a gap or a duplicate rank). `GateOrderHandoffView` enforces all of these
    in the seam commit.
  - It builds a directed `Graph` with one node per lane, keyed by `laneId`
    and inserted in ascending `declarationIndex` order. The handoff carries a
    total order and no edges, and the deployed pre-push runs one single-lane
    wave per lane in rank order. So the only edges are the rank chain: one
    edge from the lane at rank `r` to the lane at rank `r+1`. That edge is
    provisional precedence, never a dependency claim. No edge is ever derived
    from `firstRedSourceLane`.
  - The exported pure core `planLanes(lanes, precedences)` takes an explicit
    precedence list, so a cyclic must-fail input is a hand-built precedence
    set. `Graph.findCycle` runs before `Graph.topo`, because `topo` throws a
    `GraphError` on a cycle. A found cycle fails `CyclicPlanError`, whose
    `cycleNodes` are the witness path's lane ids. The installed
    `CycleResult.path` repeats its first node at the end; `cycleNodes` drops
    that closing repeat, so each lane on the cycle appears once, in path
    order from the witness's first node. A self-loop is rendered as the
    one-element `[laneId]`. The test asserts a typed `Fail`, never a defect.
  - `Graph.topo` order becomes 0-based lane steps. Nodes are inserted in
    declaration order, not rank order, so a topological order equal to the
    handoff's rank order is a real agreement check on the insertion and
    traversal, not a tautology. Over a decoded, coherent rank set the rank
    chain admits exactly one topological order, so from `planEpisode` the
    check cannot fail on handoff data. It can only fail when `planLanes` is
    called with an acyclic precedence list that is not the rank chain and
    forces another order. That is a self-check defect (`Effect.die`), not a
    typed failure and not `HandoffDecodeError`, whose `path` would name the
    wrong cause; the body test reaches it through `planLanes`. The planner
    orders existing lanes only: no
    reordering, no new order literal, no recomputation of
    `gate-order-lexicographic/v1` (time-to-certainty rulings 76–78).
  - Success is a `LanePlanProposal`, never a widened `ScheduleProposal`.
    Lane steps are not admitted seat requests, and §3.3 "Only admitted
    actions get steps" binds.
- `CiOpsProjectionLive` captures `FileSystem` and `Crypto` at construction:
  `Layer<CiOpsProjection, never, FileSystem | Crypto>`. Every service method
  stays requirement-free, and providers add the platform layers (for Bun,
  `BunFileSystem.layer` and `BunCrypto.layer`).
- `planEpisode` is pure apart from reading and digesting the handoff bytes.
  It never touches the `TxRef` current-proposal shell or the change queue.
- Transitional: in the seam commit the stub still fails
  `PlannerNotImplementedError`, so that member rides the error union until
  the body commit retires it with `plannerNotImplemented`.

### 8.2 §6 first bullet (replaces "No lane-DAG planner implementation")

- The lane-order planner orders the handoff's existing lanes only. There is
  no reseed from live economics, no lane admission and no lane execution. The
  deployed `orderWaveLanes` stays the only writer of real pre-push order.
- Lane plans, lane steps and their relations are provisional `ciops-prov:`
  instrumentation until an auditor run ratifies a lane-scheduling relation.
  `schedulesWorkUnit` is never emitted, in either namespace. It stays the
  unratified CQ-019 arm-3 carrier until run 4 (graduation Ruling 11;
  `research/auditor-run4-intake.md` Queue E item 2).

### 8.3 Consequential notes

**§3.1 schemas.** New: `GateOrderHandoffRef` `{path, sha256}`, where `sha256`
is `Sha256Hex` from `@beep/schema/Sha256`. The widened `PlanEpisodeInput`
`{episodeId, repoRoot, handoff}`. `HandoffLane` `{rank, laneId,
declarationIndex}`, with `laneId` pattern-checked
(`^[a-z0-9-]+(:[a-z0-9-]+)+$`). `GateOrderHandoffView` `{schemaVersion,
scope, orderRule, lanes}`, decoded from JSON text as a subset view.
`LaneScope` = `LiteralKit(["pre-push:non-main"])`, separate from the
admission-only `ScheduleScope`, which stays `["admission"]`. `LaneOrderRule`
= `LiteralKit(["gate-order-lexicographic/v1"])`. `LaneStep` `{laneStepIndex,
laneId}`. `LanePlanProposal` `{episodeId, planId, handoffPath, handoffSha256,
orderRule, scope, laneSteps}`, with `planId` = `lane-plan-${handoffSha256}`:
content derived, no clock. `handoffPath` is the repo-relative path the
handoff was read from (Ruling 3 lists it); it is recorded but stays outside
`planId` and specification identity. Class-level checks fail decode and
`make` unless `planId` is exactly `lane-plan-${handoffSha256}` and every
step's `laneStepIndex` equals its array position. New tagged errors:
`HandoffReadError {path, message}`, `HandoffDigestMismatchError {path,
expectedSha256, actualSha256}`, `HandoffDecodeError {path, message}`.
`CyclicPlanError` is no longer "reserved": it is the planner's cycle failure.
Two field shapes differ from Ruling 5's text: `HandoffReadError` adds
`message` to `{path}` (the platform error's description), and
`HandoffDigestMismatchError` spells Ruling 5's `expected`/`actual` as
`expectedSha256`/`actualSha256` (both typed `Sha256Hex`). The authority for
both is the P2 W6 seam brief that commissioned this lane; neither changes
meaning, and a GD note may ratify or reverse them.

**§3.3 determinism.** `Graph` construction inserts nodes in ascending
`declarationIndex` order and edges in rank order. `Graph.findCycle` replaces
the `isAcyclic` pre-check named above: it runs before `Graph.topo` and also
supplies the cycle witness. The lane plan, and its emitted Turtle, is
byte-deterministic over `(episodeId, handoff bytes)`. Permuting the lane
array changes the document bytes, so its digest, `planId` and specification
IRI change too, and through `planEpisode` the pinned digest fails
`HandoffDigestMismatchError` before planning. The permutation claim is
therefore scoped to the pure core: for a fixed supplied `handoffSha256`,
`planLanes` and the lane-plan emitter over a permutation of the decoded lane
array with the same ranks yield byte-equal Turtle. The body's permutation
test targets that core, not `planEpisode`. Lane step
indexes are 0-based, like `stepIndex`. Counts always come from the decoded
document, never from a literal: the pinned handoff `705f3e75…` carries 33
lanes, and PLAN's "32" predates #1380 (Ruling 2).

**§3.4 delta.** Since #929 the deployed scheduler skips a request whose
checkout already holds a lease. Admission v1 does not model that
same-checkout skip, and it is the attribution class for first-choice
disagreements in the live replay. The engine is unchanged: disagreements are
reported with that diagnostic attribution, never modelled (Ruling 9).

**§3.5 lane-plan vocabulary and identity.** A lane plan is emitted only in
`ciops-prov:`, with a vocabulary fully disjoint from the ratified ordering
cluster. The names below are proposed by W6 and recorded as **provisional**.
An `ontology-foundational-auditor` review checks them before the body lands,
and the run-4 Queue E/G intake decides ratification.

| Proposed term | Role | Subject → object / value |
| --- | --- | --- |
| `LanePlan` | lane-plan class | Class of one sha256-pinned lane-order plan |
| `LaneStep` | lane-step class | Class of one ordered lane position in a lane plan; never `ScheduleStep`, and its identity (tuple versus component) is undecided |
| `hasLanePlan` | episode → plan edge | `VerificationEpisode` → `LanePlan`; no current-selection reading |
| `hasLaneStep` | plan → step edge | `LanePlan` → `LaneStep` |
| `hasLanePlanSpecification` | plan → specification edge | `LanePlan` → `LanePlanSpecification` |
| `LanePlanSpecification` | lane-plan specification class | Class of the governing lane-plan specification |
| `laneStepIndex` | step index | `LaneStep` → 0-based ordinal (`xsd:integer`) |
| `laneIdRef` | lane reference | `LaneStep` → `laneId` (`xsd:string`); lane-grain evidence with no lane IRI |
| `precedesLaneStep` | consecutive-step precedence edge | `LaneStep` at index `i` → `LaneStep` at `i+1`; derived from `laneStepIndex`, provisional precedence, not dependency |
| `handoffDigest` | handoff digest | `LanePlanSpecification` → supplied handoff SHA-256 (`xsd:string`) |
| `laneOrderRule` | order rule | `LanePlanSpecification` → `gate-order-lexicographic/v1` (`xsd:string`) |

Never used for a lane plan: `hasCurrentProposal`, `hasProjectionSpecification`,
`hasStep`, `hasScopeTag`, `stepIndex`, `ScheduleStep`, `ciops:ScheduleProposal`
typing, `ciops:VerificationLane` typing, `schedulesWorkUnit`, and `hasScope` or
`Scope` in any namespace. The lane scope stays a member of the specification
tuple below, not an emitted scope term. The episode node keeps the §3.5 rule
(`ciops-prov:episode-${pnLocalSlug(episodeId)}`, typed
`ciops-prov:VerificationEpisode`). That class carries run 3's episode-unity
flag (rat-065) into the run-4 intake, so a lane-plan caller **must** use an
episode id distinct from every admission episode id. Reusing one would assert
that a single occurrence is both an admission verification and a lane-planned
run, deciding the deferred unity flag, and the two documents would each
replace the other under §3.5's replace-the-document rule. The lane-plan
episode stays typed; the body test emits an admission document and a
lane-plan document with distinct episode ids and asserts that their episode
nodes are disjoint.

**Derived edges.** `precedesLaneStep` is derived from `laneStepIndex`: one
edge from index `i` to index `i+1`, emitted for each consecutive pair. It is
a second encoding of the same order (rat-062 kept precedence as a flagged
rival of the index), never independent evidence for it. A CQ must not count
the two as separate witnesses of one order.

**Relation to ratified terms.** `LanePlan` is a candidate instance, or a
candidate subclass, of the ratified `VerificationPlanSpecification`
(`ic:yeet-planner:002`). Which one stays undecided for run 4, because rat-049
defers the plan-identity contract (content, contextual copy, replacement,
revision) and names the yeet planner and lane plans as what it will observe.
No `subClassOf`, `rdf:type` or equivalence to `VerificationPlanSpecification`
is emitted. `planId` and the plan IRI are a minting convention for a
content-derived node, not an identity criterion, and they do not answer
rat-049. `LanePlanSpecification` binds the handoff digest, so it is an
input-bound application context, not the `gate-order-lexicographic/v1` rule;
it carries rat-056's rule-versus-application flag, with no equation of the
rule with its applications. `LaneStep` is not `ScheduleStep`: no
`subClassOf` or equivalence is emitted, and the
`${planNode}-lane-${laneStepIndex}` IRI is a minting convention, not a
decision on rat-060's tuple-versus-component flag. `hasLanePlan` is a plain
episode-to-plan edge; it makes no claim of rat-054's current-proposal
selection at a reference instant, has no re-pointing semantics, and leaves
the selection-situation deferral with `hasCurrentProposal`. The run-4 intake
should list `LanePlan` beside `VerificationPlanSpecification` under rat-049.

- **Plan IRI.** `ciops-prov:${pnLocalSlug(planId)}`.
- **Lane-step IRI.** `${planNode}-lane-${laneStepIndex}`. `pnLocalSlug`
  escapes `-` in `planId`, so the structural `-lane-` suffix cannot be forged,
  by the same argument as `-step-` and `-request-`.
- **Specification IRI.** `ciops-prov:specification-` followed by the ordered
  tuple `(s7-lane-plan/v1, handoffSha256, orderRule, scope)`. Each component
  is encoded with `pnLocalSlug`, and a literal `-` separates them. The first
  component keeps lane-plan specifications disjoint from admission
  `s7-emission/v2` specifications.
- **Identity.** Authority is this contract. The lane-plan emission version is
  `s7-lane-plan/v1`. Any tuple member change changes specification identity.
  The handoff path (`LanePlanProposal.handoffPath`), `repoRoot`, `episodeId`
  and `planId` do not. Plan nodes stay disjoint from admission proposal nodes
  because `planId` must start `lane-plan-` (a decode check) while admission
  proposal ids start `schedule-`. The new suffix
  and tuple stay inside the existing `pnLocalSlug` scheme; they are not S8
  IRI-scheme work. Admission `s7-emission/v2` bytes are unchanged.

**§5 live evidence.** The W5 live replay over the `run4-fleet` pin is
rendered to `goals/ciops-ontology-pipeline/research/s7-live-replay-evidence.md`
by `apps/labs/ciops/scripts/generate-live-replay-evidence.ts`. Like
`evidence:s7`, it is check-by-default: only `--write` renders. The frozen
`research/s7-replay-evidence.md` is never re-rendered.
