# PR 3b part 2 local implementation handoff

Branch: `goals/alchemy-vault-sync-cutover`.
Publication owner: the orchestrator. Local commits only; no push or PR creation.

**Status: partial implementation. This is not completed PR 3b2 and must not be
published as the completed single-writer cutover.** Offline backup, genesis,
replay/diff and the OS process-kill proof landed. Production activation, writer
epoch enforcement, writer deletion and post-admission reversal remain unfinished.
No actual application database, client content or Box account was accessed.

## Stack and commit ordering

Created from `goals/alchemy-vault-sync-saga` at `68763f20fe2`, then merged
`origin/main` at `0729e466e20` before source changes. The requested final merge
of the local saga branch reported already up to date at that same saga head.

The recovery primitive was committed first as `e194bf2c768`, before the genesis
implementation commit `5f78fd309a1`. Neither commit activates a new writer.
Subsequent commits strengthen provenance, cursor replay and OS crash acceptance.
All normal commit hooks ran after installing the fresh checkout's dependencies.

## What landed

- `SyncCutover.service.ts`: transactional offline backup of every column in all
  four legacy tables, plus serial sequence `last_value` and `is_called`.
  The first backup is immutable per import id. A different import is refused;
  repeated backup and repeated restoration are harmless. The tested reversal is
  **pre-admission only**. It does not claim to restore accepted post-cutover work.
- `LegacySync.schema.ts`: four complete physical SQL row schemas, including
  deletion audit columns from the later audit migration. SQL nulls, JSON values,
  arbitrary stored idempotency keys, timestamps and numeric identities are retained.
- `SyncGenesis.command.ts`: restricted import commands and v1 genesis events on
  the existing destination, item, operation and conflict aggregates. Cursor
  genesis events belong to the destination. Genesis tags are excluded from live
  queue/revive/review policies; imports hydrate the aggregate snapshots and Views.
- `SyncGenesis.service.ts`: reads the immutable backup, hashes the validated
  snapshot plus configured mirror-root name, seeds all D14 numeric mappings
  before dependent sends, and uses deterministic per-row command ids. It creates
  one destination per legacy workspace/Box pair and retains the actual remote root
  separately from the unique display name. Workspace authority and request
  provenance come from `LegacySyncAudit`, not an interactive current-user service.
- Duplicate cursors and duplicate paths/dangling item references pause imported
  destinations. Every duplicate cursor is a separate v1 fact and projected row.
  A single cursor is selected without regenerating its public or numeric id.
  Leased imports retain their old status and attempt count, with expired aggregate
  lease metadata. They are not requeued before baseline comparison.
- `LegacySync.projection.ts`: full historical row restoration and identity seeding
  during replay; allocator advancement beyond seeded ids; selected cursor identity
  retention; duplicate-cursor polling refusal; compatibility rowVersion increments
  from the imported value rather than resetting to aggregate sequence numbers.
- `VaultSyncPass.saga-handlers.ts`: root resolution honors the independently
  retained legacy remote-root name.
- `VaultSyncProcessCrash.test.ts` and `fixtures/VaultSyncCrash.child.ts`: the real
  child runs the saga and BoxMirror receipt adapter over file-backed PGlite.
  It signals only after an item acknowledgement and a database CHECKPOINT, then
  waits. The parent sends SIGKILL, waits for termination, and launches a new child
  over the same data directory. A separate file records synthetic remote calls.

## Zero-diff acceptance evidence

`SyncGenesis.pglite.test.ts` uses the actual baseline SQL and subsequent audit
soft-delete migration for the four tables. The fixture contains **39 legacy rows**:
4 items, 20 operations, 12 conflicts, and 3 cursors across two workspaces.
It emits **41 v1 genesis events**, including two synthetic destinations.

Covered data includes every item state, both item kinds, every operation type
crossed with queued/leased/succeeded/failed, all six conflict kinds crossed with
open/reviewed, linked/unlinked conflicts, active/error cursors, duplicate cursor
rows, null/populated audit columns, soft deletions, arbitrary stored keys,
non-default rowVersion, historical attempt counts, mismatched current/last-pushed
watermarks, and numeric ids unrelated to public-id suffixes. Legacy org 1 remains
in SQL while authoritative destination ownership uses the audit resolver's org 17.

The test interrupts a half-completed import, resumes it, runs it again, and checks
stable event counts and provenance (`principal`, `source_kind`, `schema_version`).
It then removes all projected rows and identity mappings and rebuilds with the real
Postgres Platform and projection host. **The all-column comparison returns zero
differences.** No Box service or live policy is present during import/replay.

`LegacySyncReplay.harness.ts` is reusable. It checks each table's physical column
set against its row contract and uses a full outer join plus every JSONB row key
to report table/id/column/expected/actual differences. JSON object key order is
normalized by PostgreSQL; string whitespace and payload values remain significant.
A negative perturbation of rowVersion and lastPushedGeneration produces exactly
those two differences. Post-genesis cursor updates retain id/publicId/createdAt,
increment the historical rowVersion, and update only the selected cursor.
Forced redelivery of accepted projection inputs retains the same rows and diff.

This is synthetic local PGlite proof. It is not a migration of a real user's store,
a full every-live-handler compatibility matrix, or production admission proof.

## Process-kill acceptance evidence

The process test passes with sequential ownership of one file-backed PGlite store;
no DB_PG_URL fallback was necessary. The first Bun process is killed mid-pump
with SIGKILL. The second completes the same pass with two successful uploads.
The independent synthetic remote ledger contains exactly `a.txt` then `b.txt`,
with one call each. This strengthens the existing runtime-scope teardown tests.

It proves this specified checkpoint/restart boundary. It does not claim arbitrary
Box network requests become transactional with SQL. The existing uncertain-outcome
hold and evidence-settlement requirements from part 1 remain in force.

## Verification and repository metadata

- Full package verification passed for documents-domain, documents-use-cases and
  documents-server: lint, audit/build/type checks and docgen.
- The domain suite has 45 passing tests in 9 files; use-cases has 73 in 10 files;
  server has 173 in 21 files, including the three new acceptance tests.
- Domain coverage regression gate passed: lines 96.34, statements 94.26,
  branches 67.50, functions 95.80. Use-cases retains 100 in all four metrics.
- New source coverage identities were generated with add-missing-files-only.
  A recursive comparison against the saga baseline found zero lowered existing
  package or file floors. Earlier projection statement regressions were repaired
  by testing forced redelivery rather than lowering its floor.
- Entity-kit freeze check passed: 64 importers, zero findings. No old importer was
  deleted because writer deletion is unfinished, so the freeze baseline did not shrink.
- No new dependency was added in part 2. `bun install` repaired fresh-checkout
  dependencies; part 1's manifests and tsconfig-sync output were retained.
- Main's repaired cache baseline was retained, then only the twelve remaining
  stack dependency subjects were re-recorded through the reviewed request in
  `cache-baseline-request-pr3b2.json`. Cache policy reports zero blocking findings.
- Decisions and research manifest were regenerated through the goal tooling.
  `git diff --check` passed.
- Mandatory harness inbox acknowledgement commands were used for repaired local
  verifier failures despite the no-Yeet task instruction. No Yeet repair, publish,
  ready, monitor, open or other publication workflow ran.

No repository-wide build/check/lint battery, hosted CI, independent review panel,
real Postgres, live Box or desktop runtime acceptance ran. The canonical scoped
schema-first/effect-vitest adapter was not rerun in this lane; package verification
is the recorded lint/type/docgen proof.

## Remaining required implementation

1. Implement the persistent writer-epoch state machine and startup compatibility
   refusal. An old executable has no knowledge of a newly added check; prove the
   actual older executable cannot resume its writer against a migrated store.
   Add the database stale-writer refusal boundary as well as new-startup checks.
2. Land and test post-admission reversal using a current high-water projection
   and retained event/workflow state. The current restore helper restores only
   the pre-import backup and must not be used after new commands are admitted.
3. Add the real offline host: enforce stopped workers/admission, resume receipts,
   bounded/keyset batches, complete up-front validation, destination name
   reservations, active duplicate-cursor selection/repair, migration tooling and
   desktop bundle generation. The current importer documents offline hosting
   requirements; it does not establish an application maintenance state itself.
4. Delete every old CRUD mutation implementation/port/test now owned by the Model,
   switch the server and desktop Layers in that same change, and update desktop
   dispatch/read consumers. No legacy writer or app Layer was removed here.
5. Complete the compatibility matrix for every post-genesis reducer, invalid
   snapshots, near-limit JSON payloads, duplicate paths, dangling references,
   explicit replay-generation bumps and injected projection transaction failures.
   Do not interpret the current broad fixture as all of those separate proofs.
6. Reconcile the saga's destination/pass admission fence and legacy recovery
   behavior with the cutover design before enabling production workers.

The external table readers identified in research/03 section 6 still see their
existing contracts because this change retains all four tables. Desktop wiring,
migration-bundle refresh and writer retirement are still required; no consumer
cutover acceptance is claimed. The epoch hold decision is an explicit incomplete
implementation receipt, not approval to omit these requirements.

## Findings outside changed files

No unrelated product file was changed. The global cache repair was already on
main; the twelve stack-local remaining subjects were repaired in this branch.
Fresh-checkout hook resolution and proof-tool friction are recorded in the
packet's OPPORTUNITIES ledger. Production authority, migration host and application
wiring remain with the unfinished cutover work described above.
