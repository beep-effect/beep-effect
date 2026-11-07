# PR 3b part 1 implementation handoff

Branch: `goals/alchemy-vault-sync-saga`.
Publication owner: the orchestrator. Local commits only; no push, PR, readiness,
monitoring or merge of a remote PR was performed.
The requested final merge of `goals/alchemy-vault-sync-domain` includes
`0da0adbbf2a`, with merge commit `a51bcae6419`. No newer domain commit was
present at the last integration check.

## What landed

- Imported and committed the cutover design and API/Session design from their
  named local branches. Corrected the cutover document's stale driver assumptions
  against PR 2b, including the actual workflow Layer, projection intake and saga
  restart test. The API design remains context, not implemented scope.
- `VaultSyncPass` declares a pass-keyed saga. `VaultSyncPassModel` assembles it
  with the existing aggregates, Views, Policies and new SQL Projections without
  changing the original domain-only `VaultSyncModel`.
- Server handlers run probe, scan, a durable pump plan, one Activity per operation,
  remote classification and cursor advancement. Commands have deterministic ids.
  Folders precede files, parent paths precede descendants, and parent/item remote-id
  gates run before leasing. Item acknowledgement commits before operation success.
  An expired lease owned by the recovering pass is expired and acquired under a
  new epoch. Completed operation replay recovers its cached receipt and echo token.
- Echo classification reuses the legacy content/move/rename helpers. One token
  explains one created/edited content echo; matching non-edit remote state can
  suppress duplicate echoes. An unexplained edit becomes drift. Events outside
  the root and tracked folder scope are ignored. Conflict reservation and item
  drift commands commit before the page cursor advances.
- `BoxMirrorLive` implements the ExternalSystem over the existing DmsMirror
  ports supplied by DmsMirrorBox or DmsMirrorFixture. It reads bytes at call time
  through the existing canonical-root, symlink/inode/device-bound file store and
  checks the queued digest. Workflow inputs, events, receipts and logs contain no
  upload bytes or resolved credentials.
- A SQL intent receipt is committed before each remote mutation and its result
  before returning. Identity is operation plus generation; pass id is excluded
  from the intent fingerprint. Completed calls return the durable result.
  Interrupted calls consult `BoxMirrorEvidence`; absent evidence holds the
  operation with no second mutation. Synthetic evidence settlement is tested.
  The uncertainty decision is a committed packet decision, not a claim of Box
  provider idempotency.
- Four Projection declarations and SQL handlers rebuild the legacy sync item,
  operation, conflict and cursor tables. A separate mapping allocates numeric ids
  independently of public-id suffixes and supplies numeric item references.
  Row writes and source checkpoints share a transaction. New cursor identities
  are deterministic valid legacy public ids; importing existing cursor identities
  remains part 2.
- Optional v1 metadata fields carry observed file size, acknowledged remote
  name/parent, conflict kind/remote id/path, and cursor last-event id. These retain
  compatibility with existing PR 3a callers. The latest domain branch's Opaque
  record schemas and coverage improvements were preserved during the merge.
- Coverage rows were added for the five new source files. Existing package and
  file floors were not lowered. A comparison against the final domain branch found
  zero lowered pre-existing floors.

## Main files

| Responsibility | Files |
| --- | --- |
| Saga/model/ExternalSystem declarations | `packages/documents/use-cases/src/aggregates/VaultSync/{VaultSyncPass.saga,Model,BoxMirror.external,LegacySync.projection}.ts` |
| Runtime handlers | `packages/documents/server/src/aggregates/Sync/VaultSyncPass.saga-handlers.ts` |
| Adapter and recovery receipts | `packages/documents/server/src/aggregates/Sync/BoxMirror.ts` |
| SQL projection host | `packages/documents/server/src/aggregates/Sync/LegacySync.projection.ts` |
| Compatible event metadata | domain `aggregates/VaultSync/{SyncItem.events,MarkItemPushed.command,SyncConflict.events,SyncDestination.events,SyncDestination.aggregate,RecordDestinationPoll.command}.ts` |
| Recovery tests | `packages/documents/server/test/VaultSyncPass.pglite.test.ts` |
| Adapter tests | `packages/documents/server/test/BoxMirror.pglite.test.ts` |
| Projection scenarios | `packages/documents/server/test/LegacySync.projection.pglite.test.ts` |
| Dependency/generated metadata | server manifest and tsconfigs, bun.lock, Fallow boundaries, coverage baseline and owning schema catalogs |
| Decision | `goals/alchemy-vault-sync-slice/decisions/2026-11-07-uncertain-box-mutation.md` |

## Verification

All package commands used the mise shims PATH. The final command receipts are
summarized here so the handoff does not depend on untracked local logs.

| Gate | Result |
| --- | --- |
| Full package verification: documents-server, documents-use-cases, documents-domain | PASS: lint, audit/build/type checks and docgen |
| Server complete Vitest suite under coverage | PASS: 170 tests, 18 files |
| Domain complete suite under coverage | PASS: 43 tests, 9 files |
| Use-cases complete suite under coverage | PASS: 73 tests, 10 files |
| Server coverage regression gate | PASS, existing package and file floors retained |
| Domain and use-cases coverage regression gate | PASS, both packages compared |
| New-source coverage identity writes | PASS, add-missing-files-only; no existing floors lowered |
| Source/test type checks | PASS for touched packages through the package verifier |
| Entity-kit freeze | PASS: zero findings, 64 existing importer files |
| Packet decisions projection and research manifest | Regenerated through the installed CLI |
| Whitespace | PASS |
| Server JSDoc lint | PASS |

Final measured coverage, in percentage points:

| Package | Lines | Statements | Branches | Functions |
| --- | ---: | ---: | ---: | ---: |
| documents-server | 95.48 | 94.48 | 81.85 | 91.18 |
| documents-domain | 96.07 | 93.51 | 65.25 | 94.53 |
| documents-use-cases | 100 | 100 | 100 | 100 |

The recovery tests close the old runtime's owning scope, build a fresh runtime
over the same PGlite database, and finish the same saga key. This follows
`packages/drivers/alchemy-postgres/test/saga.test.ts`. One teardown is between
pump and poll; the other is after item acknowledgement mid-pump. Both prove one
folder call and two upload calls, one acknowledgement event for the tracked file,
and a stable completed result when the same key is started again. They are
runtime teardown proof, not OS SIGKILL/file-backed-PGlite proof.

The seeded cursor test actually polls synthetic push echoes. It covers duplicate
matching remote state, an unexplained tracked edit, an unknown item inside the
root, and unrelated account events outside it. Its expected conflict count is two.
Adapter tests cover completed-result reuse across pass ids, stale local bytes
without a Box call, uncertain intent hold without a second call, and authoritative
synthetic settlement. Projection scenarios compare rows in all four actual legacy
DDL tables, including numeric joins, success/failure, kind replacement clearing
remote watermarks, conflict review and cursor failure retaining position.

## Hosting requirements and remaining boundaries

Production composition must provide the destination-scoped DmsMirror and
DmsMirrorAvailability, `VaultSyncRoot`, `BoxMirrorEvidence`, filesystem/Path,
SqlClient and `AlchemyPostgres.layer()`. Scope the existing Box configuration
and root resolver to one destination. Do not share a root cache across differently
configured destinations.

The existing DmsMirrorBox port cannot authoritatively establish an interrupted
upload/version outcome. Its recovery resolver must answer no evidence unless it
has such proof; the operation remains held. A real provider evidence resolver is
not inferred from a name match, a fixture result or retryability. No real Box
account or client content was used for these tests.

SQL hosting also requires `LegacySyncAudit`, resolving historical source
provenance and authoritative workspace ownership. Tests supply synthetic audit
data. This must not be replaced with the current user or a guessed organization.

These are new-event read models, not the all-column genesis/replay acceptance
proof. Complete historical snapshots, legacy rowVersion/audit restoration,
duplicate-cursor handling and seeded numeric identities remain part 2. An
aggregate receipt's caughtUp call alone does not wait for every transitive
snapshot projection; tests additionally await expected SQL state.

No legacy write path was removed, no app Layer was switched, and no database was
cut over. Genesis import, replay-and-diff over old rows, rollback/writer fences,
Api/Session, HTTP/CLI/MCP, frontend and hosted readiness remain out of this task.

## Skipped gates and findings outside owned files

- No repository-wide gates ran on the constrained host. Verification was scoped
  to the touched packages and their build dependencies.
- Hosted CI, independent review, real Postgres and live Box verification were
  not run in this local implementation lane.
- Cache policy reports inherited global configuration drift and its dependent
  subjects (1,683 blockers at this base). The operator assigned the root repair
  to PR #2881. The PR 3b1 dependency review/request follows the PR 3a pattern and
  is prepared, not applied. Refresh it after that fix; no unrelated cache policy
  or qualification state was re-stamped.
- Earlier local check/docgen failures were repaired; their final passing checks
  supersede them. Mandatory local P0 inbox acknowledgements were used despite
  the no-publication scope. No Yeet publication or readiness command ran.
- Packet friction is recorded in OPPORTUNITIES.md. No unrelated source fix or
  out-of-repo corpus/client document access was performed.

## Next owner action

Review this local branch and its evidence, integrate the inherited cache repair,
then publish through the orchestrator's normal workflow. Preserve the part 1
hosting and uncertainty boundaries when starting part 2; this handoff does not
authorize production cutover.

## Stack fixes on `goals/vs-saga` (2026-11-07)

Branch `goals/vs-saga` was cut from `68763f20fe2` and carries these fixes.

- Merged `origin/goals/vault-sync-domain` (#2886, `444083d954c`): opaque minted
  `DestinationId` (`documents_sync_destination_<cuid>`) and hashed reservation keys.
  Every server fixture now uses a valid minted id.
- D17 F1: the scan claim command id is `claim/${itemId}`, no longer the vault path.
  An audit of every other command id, Activity name and saga key in 3b1 code found
  only opaque ids (item, operation and conflict ids, page indexes, Box event ids).
  The restart test now asserts that no stored `command_id` contains a fixture path.
  With the fix reverted it fails on `before-poll/claim/folder/file.txt`.
- Effect Vitest: the six EV002 rows in `LegacySync.projection.pglite.test.ts` were
  real. The test provided a built Context through `Effect.provide`, and now uses
  `Effect.provideContext`. BoxMirror EV005/EV006 rows now use `Effect.exit` and
  `assertTrue`, and the 3a `layer(CuidLayer)` EV014 row has a hook timeout. The
  three EV010 `BunServices` rows are reasoned exceptions, because native realPath
  reads and the checked-in DDL are the subject of those tests. Nothing else was
  re-keyed and no full `--write` ran.
- Fallow complexity: three passes reported eight introduced findings: saga
  `execute` bodies up to cyclomatic 37 and cognitive 66, three projection handlers,
  and `RecordDestinationPoll`. Pump, poll, scan and plan were split into named
  helpers, the projection handlers now use per-table column mappers, and the poll
  decision is its own function. Behaviour is unchanged.
- Coverage: the saga-handler functions row fell to 89.09 against its floor of 90.
  It was restored with a new test covering a push failure, a poll failure and a
  paused destination making no Box calls.
- Cache policy: four `configuration-drift` rows on `@beep/documents-server` were
  recorded through `cache-baseline-request-pr3b1-domain.json`. The review is in
  `cache-baseline-review-pr3b1-domain.md`. Policy now reports 0 blocking findings.

Verification: package-verify (lint, audit, docgen) passed for documents-server and
documents-domain. Server ran 171 tests in 18 files under coverage, and the coverage
gate was ok. Domain ran 49 tests and use-cases ran 73. Entity-kit freeze reported 0
findings, tsconfig-sync reported no drift, and the three fallow checks exited 0.
Effect Vitest showed introduced=0. The scoped schema-first scan reported zero
introduced findings.

## Final 3a contract on `goals/vs-saga-2` (2026-11-07)

Branch `goals/vs-saga-2` was cut from `goals/vs-saga` (`f320ee92540`) and merges the
final PR 3a head `e2bd335249e`.

- Merge conflict: `RecordDestinationPoll.input` keeps the saga's optional
  `lastEventId` and takes 3a's `error: S.NullOr(V.MirrorOperation)`.
- BoxMirror adapter: `operation` is now always the Box call name
  (`MirrorOperation`). The adapter stage that used to be passed as `operation`
  (`local-root`, `stale-input`, `intent-mismatch`, `uncertain-outcome-held`) is in
  the new `stage` field; `pollEvents` failures carry `stage: null`.
- Adapter fix found while threading the stage: a local stage failure inside a
  mutation (unreadable root, stale input) was remapped to
  `uncertain-outcome-held` and left the receipt claim held, so a later retry with
  fresh input would be held as uncertain even though Box was never called. The
  claim is now released (`DELETE ... WHERE result IS NULL`) and the local stage is
  kept. Only a failure of the Box call itself stays uncertain and held. The
  BoxMirror test asserts `{ operation: "uploadFile", stage }` on both calls of the
  stale and uncertain cases.
- Saga handlers already passed `failure.operation` into `FailOperation.reason`
  and `RecordDestinationPoll.error`; they now type-check against the kits with
  no code change. No saga path issues `SupersedeOperation`.
- Projection: `LegacySync.projection.ts` writes the literal verbatim into the
  legacy `last_error` text columns (`documents_sync_operation`,
  `documents_sync_cursor`). The projection test now uses literal reasons
  (`pollEvents`, `ensureFolder`). The legacy free-text mapping belongs to genesis
  in 3b part 2 (`research/09`).

Verification: documents-server check clean, 184 tests in 19 files; domain 49;
use-cases 81. package-verify (lint, audit, docgen) passed for documents-server.
Coverage ratchet ok for server, domain and use-cases with no floor changed.
Entity-kit freeze, tsconfig-sync, cache-policy (0 blocking), fallow dead-code,
health and audit, and docs oxlint on touched files all exited 0. Effect Vitest:
introduced=0, resolved=2, no inventory write.
