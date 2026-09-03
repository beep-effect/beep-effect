# Semantica Storage Inversion Spec

## Objective

Give the lab's append-only `ProvenanceEvent` ledger the three storage semantics
provenance-first (D16) needs before it can bind (A6): logical retraction,
physical erasure, and compaction with desktop-storage reclaim. One S1
candidate proves them through four ordered probes on the offline-regenerated
C2 ledger:

- **P-S0 entry check** — the workstation provider cache regenerates the full-W1
  C2 ledger with the network off and reproduces the C2 report digest.
- **P-S1 retraction** — `Invalidated` events remove exactly the quads,
  statements and `InferenceEvent`s their recorded reach covers, and the three
  rebuilt projections equal the incremental-apply digests.
- **P-S2 compaction + erasure** — `Compacted` folds a chain prefix into a
  trust-root snapshot without moving the digest; `Redacted` erases one W1
  document's ledger-computed closure atomically, and continuity from the
  checkpoint still verifies.
- **P-S3 desktop storage** — bytes on disk decrease after compaction and
  erasure under a file-backed `dataDir`, and a SIGKILL mid-compaction restarts
  to exactly the pre- or post-compaction chain.

Scope is defined by reference, not restated:

- **The probes, gates and kills** —
  [`MAP.md` §S](../../explorations/semantica-lab/MAP.md#s-semantica-storage-inversion--what-delete-and-compaction-must-mean)
  (v1.1, ratified 2026-09-03 with amendments applied inline).
- **The ratified sub-decisions** —
  [`DECISIONS.md`](../../explorations/semantica-lab/DECISIONS.md) "2026-09-03
  (ratification grill)": R0.a and R1.a–R1.i; the Current law table wins over
  any log entry.
- **What the canary already proved** — the narrow "projections are derived"
  claim of
  [`BRIEF.md` rabbit hole 10](../../explorations/semantica-lab/BRIEF.md#rabbit-holes)
  and
  [`goals/semantica-canary/SPEC.md` constraint 10](../semantica-canary/SPEC.md#constraints);
  delete and compaction were explicitly left to this spike.

Provenance: graduated 2026-09-03 from
[`explorations/semantica-lab`](../../explorations/semantica-lab/README.md)
(MAP v1.1 re-entry packet S).

## Non-Goals

Every item of
[`BRIEF.md` §No-Gos](../../explorations/semantica-lab/BRIEF.md#no-gos) holds
as listed in
[`goals/semantica-canary/SPEC.md` §Non-Goals](../semantica-canary/SPEC.md#non-goals).
This spike adds:

- No change to the `ProvenanceEvent` id preimage `(prev, body)`; redacted ids
  are commitments, never recomputed (R1.d). The C2 ledger, its ids and the
  `2a2089ea…` report digest stay valid fixtures.
- No in-place `UPDATE`, and no row `DELETE` as the implementation of logical
  retraction; retraction is an event whose reach is derived, never stored
  (R1.a). Physical `Redacted` erasure deletes its computed closure atomically
  under R1.b and R1.h.
- No hosted provider call: every probe is replay-offline (R1.f). The
  regenerated ledger and the provider cache are never committed.
- No reasoning work: the `G-entailment/rules` retraction class (R-c) lives in
  the sibling `semantica-reasoning-spike` and inherits this packet's tombstone
  law (R1.g, R2.e).
- No persistent triple store, ANN index, or pgvector decision; C1's bundle
  verdict stands and projections stay rebuild-from-ledger.
- No Notion write; a storage-semantics verdict lands in the exploration's
  `DECISIONS.md` and, only if it changes an atlas row, in
  `semantica-atlas-sync`'s verdicts file.
- No reusable `@beep/*` export from the lab (labs law); size accounting and
  the chain validator are lab-local until a graduation target names them.

## Source Hierarchy

1. User decisions recorded in the source exploration:
   [`DECISIONS.md`](../../explorations/semantica-lab/DECISIONS.md) Current law
   table, then the 2026-09-03 ratification grill (R0.a, R1.a–R1.i).
2. `AGENTS.md`, `CLAUDE.md`, and required skills (schema-first-development,
   effect-first-development, yeet, reflect).
3. `standards/ARCHITECTURE.md` with
   [`standards/architecture/15-lab-apps.md`](../../standards/architecture/15-lab-apps.md).
4. The exploration contracts in force:
   [`BRIEF.md`](../../explorations/semantica-lab/BRIEF.md) v1.1,
   [`MAP.md`](../../explorations/semantica-lab/MAP.md) v1.1 §S,
   [`research/shared-schema.md`](../../explorations/semantica-lab/research/shared-schema.md)
   v1.4.
5. [`goals/semantica-canary/SPEC.md`](../semantica-canary/SPEC.md): the lab's
   standing constraints and the C2 evidence this spike replays.
6. This `SPEC.md`.
7. `PLAN.md`.
8. `GOAL.md`.
9. Supporting `research/`, `ops/`, and `history/` files.

Higher sources outrank lower sources when they conflict. Where this SPEC and
the exploration's Current law table disagree, the table wins until a dated
DECISIONS entry amends it.

## Target Surfaces

- `apps/labs/semantica`: `src/schema/Provenance.ts` (the `Redacted` and
  `Compacted` event bodies, `CompactedSnapshot`, the `EventKind` domain),
  `src/schema/Ledger.ts` and `src/layers/LedgerLive.ts` (DDL: nullable
  payload, `body_digest` and `prev` columns; `Invalidated` emission; the chain
  validator; chain-order `Ledger.read`), `src/layers/RdfProjectionLive.ts`
  (the claim-to-statement bridge exposed to retraction),
  `src/schema/Projection.ts` and `src/schema/Reasoning.ts` (the witness
  extended with removed statements and events), `src/schema/Telemetry.ts`
  (bytes before and after), the provider-cache reverse index, tests, and
  `test/helpers/CrashProbeChild.ts` reused for P-S3.
- `goals/semantica-storage-inversion/`: probe evidence under `history/`,
  verification records, the closeout reflection.
- [`explorations/semantica-lab/DECISIONS.md`](../../explorations/semantica-lab/DECISIONS.md):
  the dated storage-semantics verdict (or park) written when the candidate
  completes or fails.
- No other package changes. `src-tauri` stays frozen (S4).

## Constraints

Each line cites the sub-decision or law it inherits.

1. **Tombstone ≠ erasure.** Logical retraction and physical erasure are two
   events with two semantics; one word never carries both (R1).
2. **`Invalidated` stays `ClaimId`-targeted; reach is derived.** Rebuild
   recomputes `claimQuads` for the retracted claim and removes every
   `InferenceEvent` whose recorded local premises transitively include a
   retracted statement; nothing about reach is stored (R1.a, S8).
3. **`Redacted` targets a `DocumentId` with a ledger-computed closure:** the
   document, parse-outcome, chunk, batch and claim rows keyed by it; the
   conflict rows reached through those claim ids; the run outputs and report
   copies derived from it; provider-cache entries via a reverse index the spike
   adds; and the event rows whose bodies name it, which keep
   `(id, prev, body_digest)` and drop `payload` (R1.b, R1.c).
4. **Erasure is atomic and inventoried, and recoverable across stores.**
   Closure rows are deleted in one transaction, then a copy-to-fresh-`dataDir`
   or `VACUUM FULL` step purges dead tuples; the spec and the P-S2 gate list
   every copy class (WAL and TOAST inside `dataDir`, report and telemetry
   files, provider-cache entries) and prove each is gone or documented as out
   of scope (R1.h). Because the file and provider-cache copy classes sit
   outside the PGlite transaction, the protocol is journaled: the `Redacted`
   event is the durable intent, every out-of-DB purge is idempotent and keyed
   by that event id, a restart re-runs the purge for any `Redacted` event with
   no recorded purge receipt, and erasure is reported complete only once the
   receipt exists (PR #996 review, Q4).
5. **`Compacted` is the trust root.** A content-addressed `CompactedSnapshot`
   (event range, fold digest, projection digests) anchors everything before
   it; the verifiable chain property is continuity from the last checkpoint:
   `prev` exists, the head is unique, every event whose body remains recomputes
   its id from `(prev, body)`, the fold digest matches, and redacted events are
   checked only as `(id, prev, body_digest)` commitments. The id scheme does
   not change (R1.d).
6. **Chain order is canonical.** Folds and replay walk `prev` links from the
   checkpoint; `recorded_at` stays telemetry and never orders a fold (R1.i).
7. **Three DDL changes, no more:** nullable `payload`, a `body_digest` column
   populated for every event, and a `prev` column (R1.c). No id brand
   truncates; no DDL names a dimension (S6).
8. **One candidate, four ordered probes.** P-S0..3 are one stage of the
   storage family's opening candidate; a failed probe buys exactly one more
   candidate for that probe, redesigned when the failure was a design fault;
   the named P-S3 redesigned candidate is copy-to-fresh-`dataDir` compaction;
   a second failure parks the family (R1.e, R0.a, E8).
9. **The fixture is regenerated, never fetched.** P-S0 regenerates the full-W1
   C2 ledger from the untracked workstation provider cache with the network
   off and must reproduce the C2 report digest; no reproduction means the spike
   does not start (R1.f).
10. **One tombstone law.** P-S1 lands before the reasoning spike's R-c class
    and its P2–P4 (R1.g).
11. **Inherited canary constraints** hold by reference
    ([`goals/semantica-canary/SPEC.md` §Constraints](../semantica-canary/SPEC.md#constraints)):
    5 (the provider cache is the determinism), 8 (Oxigraph under an
    Effect-level timeout), 10 (crash injection definition), 14 (no id
    truncation, no DDL dimension).
12. **Telemetry law.** Bytes before and after, wall-clock and RSS live in the
    `EvalRunTelemetry` sidecar and never in a digest; Tier-L bars are
    re-measured after compaction as a regression check, not a new gate
    (R1 of PR #802, G4).
13. **Cross-cutting laws every contract obeys:** branded ids; typed degraded
    states instead of success-shaped fallbacks; `HashSet`/`HashMap`, never
    native; decode at boundaries; `Effect.fn`/`Effect.fnUntraced` for
    generators; Effect v4 APIs verified against the reference checkout before
    writing.

## Decision Log

Binding decisions live in
[`explorations/semantica-lab/DECISIONS.md`](../../explorations/semantica-lab/DECISIONS.md).
The rows below are the ones this spike executes against, one line each.

| Id | Holds for this spike |
| --- | --- |
| Stop rule (S1, R0.a) | First-probe candidate; a stage failure buys exactly one redesigned candidate; a second failure parks the family and drops the exploration to `decompose`; wall-clock is telemetry. |
| A6 | Delete, compaction and desktop-storage semantics are a dated post-C2 spike; D16 binds only after they exist. |
| D16 | Provenance-first, pipeline-as-data, evals as spine; lab code stays promotion-shaped. |
| S8 | Retraction may consult exactly the recorded local premises; the oracle's premise choice is never a spec. |
| E8 | One re-entry candidate per family per stage; a second park is terminal absent an operator ratification. |
| R1.a | `Invalidated` stays claim-targeted; reach derived through `claimQuads` and recorded premises. |
| R1.b | `Redacted` is document-targeted; the closure is computed and includes run outputs. |
| R1.c | Redacted events keep `(id, prev, body_digest)`; nullable payload, `body_digest` and `prev` columns. |
| R1.d | `Compacted` is the trust root; continuity from the checkpoint; redacted ids are commitments only; the id scheme is unchanged. |
| R1.e | P-S0..3 are one candidate; the P-S3 redesigned candidate is copy-to-fresh-`dataDir`. |
| R1.f | Fixture = the offline-regenerated C2 ledger gated by P-S0; zero hosted spend. |
| R1.g | P-S1 lands before R-c and the reasoning spike's P2–P4. |
| R1.h | Atomic erasure protocol plus a copy-class inventory proven by the P-S2 gate. |
| R1.i | Chain order via `prev` is canonical for folds and replay; `recorded_at` is telemetry. |
| R1 (PR #802) | Digests never carry telemetry; size accounting lives in the sidecar. |
| Q4 (PR #996 review) | Erasure is journaled across stores: `Redacted` is the intent, out-of-DB purges are idempotent and re-run on restart until a purge receipt exists; P-S3 adds a mid-erasure SIGKILL. Stricter than MAP §S, not in conflict with R1.h. |

## Acceptance Criteria

Gates are quoted from
[`MAP.md` §S probe table](../../explorations/semantica-lab/MAP.md#s-semantica-storage-inversion--what-delete-and-compaction-must-mean);
each probe passes over the full C2 ledger, not a sample.

- [ ] **P-S0** — the cache-only regeneration reproduces the full-W1 C2 report
      digest with the network off; the run is recorded under `history/` with
      the cache directory's content hash and the ledger's event count.
- [ ] **First slice** — P-S1 on one W1 paper: invalidate two claims that feed
      a C2 inference, rebuild, and assert the witness. Passing the slice does
      not pass the spike.
- [ ] **P-S1** — rebuild-from-ledger digests of all three projections (DuckDB
      kNN, Oxigraph, PGlite adjacency and proof) equal the incremental-apply
      digests; every `InferenceEvent` whose recorded premise closure includes
      a retracted statement is absent; a `QuadDelta`-shaped witness lists
      exactly the removed quads and statements.
- [ ] **P-S2** — after compaction alone, replay from snapshot plus tail
      reproduces the C2 digest byte-for-byte (telemetry sidecar excluded);
      after erasing one W1 document, the rebuilt projections and a fresh
      replay equal a cache-only run over the W1 manifest minus that document;
      continuity from the checkpoint verifies; every copy class in the
      inventory is proven gone or documented out of scope.
- [ ] **P-S3** — on-disk bytes decrease after compaction and erasure under a
      file-backed `dataDir` (measured, recorded in the sidecar); after a
      SIGKILL mid-compaction the restarted ledger verifies as exactly the
      pre- or post-compaction chain, never a torn one; after a SIGKILL between
      the closure commit and the out-of-DB purge, the restarted ledger
      completes the purge, records the receipt, and the closure is gone from
      every copy class (Q4).
- [ ] Schemas land before services and services before Layers: the two event
      bodies, `CompactedSnapshot`, the extended witness and the three DDL
      changes are schema-first; the chain validator and the erasure-closure
      computation are `Context.Service` contracts before any Layer.
- [ ] The storage-semantics verdict (or park) is a dated entry in the
      exploration's `DECISIONS.md`, and the Current law "Storage" row is
      amended in the same PR.
- [ ] Each probe ships as a PR driven to mergeable; P4 records a valid
      closeout reflection; base packet checks and `bun run beep yeet verify`
      are green.
- [ ] No unrelated refactors or formatting churn.

## Verification Surface

Proof is a lab test or a CLI run, never a screenshot (A5, S4).

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Launcher size | `test "$(wc -m < goals/semantica-storage-inversion/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/semantica-storage-inversion/ops/manifest.json` | Passes |
| Packet references | `rg -n "semantica-storage-inversion\|GOAL.md\|agentLaunchers\|packetAnchorDocument" goals/semantica-storage-inversion` | Required surfaces present |
| Whitespace | `git diff --check -- goals/semantica-storage-inversion explorations/semantica-lab` | Passes |
| Portfolio index | `bun run beep goals index --check` | Generated index current |
| Goal contracts | `bun run beep goals doctor` | Green |
| Reflection | `bun run beep lint reflection-artifacts` | Green at closeout |
| Repo quality | `bun run beep yeet verify` | Green |
| Lab tests | the lab's `test` script (vitest) in the Labs lane | Green per probe |
| P-S0 fixture | the lab's `canary` entry at C2 with `--offline` over the workstation cache | Report digest equals the archived C2 digest |
| Probe gates | one lab test per probe asserting the gate above; reports and sidecars archived under `history/` | Gate holds over the full C2 ledger |
| Size accounting | bytes before and after in the `EvalRunTelemetry` sidecar | Decrease recorded; never in a digest |
| Hosted completion | `bun run beep yeet monitor` after each probe's publication | `merge-ready: yes`; zero unresolved threads |

## Stop Conditions

- **The probe breaker (S1 as amended by R0.a), never a calendar.** P-S0..3
  are one stage of the storage family's opening candidate; a failed probe
  buys exactly one more candidate for that probe, redesigned when the failure
  was a design fault; a second failure parks the family, records the park in
  the exploration's `DECISIONS.md`, and drops the exploration to `decompose`.
- **P-S0 is a hard fixture gate.** No reproduction of the C2 digest means the
  spike has no fixture and does not start.
- Any in-place `UPDATE`, any row `DELETE` used to implement retraction, or a
  retraction whose reach cannot be derived from `claimQuads` and the recorded
  local premises (the P-S1 kill).
- A `Redacted` closure that must be hand-listed, a snapshot that retains a
  redacted payload, a closure row or copy class surviving erasure without a
  documented out-of-scope ruling, or any digest drift after compaction alone
  (the P-S2 kill).
- Bytes that cannot be reclaimed under PGlite WASM after the
  copy-to-fresh-`dataDir` redesigned candidate, a torn chain after the
  SIGKILL restart, or a purge left incomplete after the mid-erasure restart
  (the P-S3 kill).
- A change to the id preimage, to `g-entailment-rdfs/v1`, or to any C2 fixture
  digest; any hosted provider call; committing the regenerated ledger or the
  provider cache.
- A change would cross a No-Go or touch a brick outside cleanup-on-touch.
- Verification requires credentials, cost, destructive side effects, or
  policy approval not named here.
- The same blocker repeats after reasonable investigation.

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
