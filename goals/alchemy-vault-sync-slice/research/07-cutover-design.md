# PR 3b: durable vault-sync pass and single-writer cutover

Date: 2026-11-07. Status: implementation design, not runtime proof.
Base inspected: `0bbb25b0096460dc150db4dabba5cd267d3f5ca0`.
PR 3a owns the domain aggregates, views, policies and BoxMirror contract in parallel.
This document names the contract PR 3b needs; proposed additions below must be reconciled
against 3a before implementation. No product code, database, client document or Box account
was changed to produce this design.

## 1. Authority, baseline and prerequisites

D1/D6 require the Postgres Platform and `ClusterWorkflowEngine`; D2 makes events authoritative;
D7 prohibits a dual-write interval; D12 requires immutable versioned events; D14 preserves
public ids and temporary numeric joins; D15 retains all four SQL read models. The packet's
2026-11-06 decisions refine D12 to an event-class static `schemaVersion`, provenance to
`SendMeta.context`, the driver to `@beep/alchemy-postgres`, and conformance to PGlite plus
InMemory with real Postgres integration. `SPEC.md`, `PLAN.md`, research/01, research/02 and
research/03 remain the requirements and baseline. This design uses installed beta.85 only. Installed source was read through the worktree's
local node_modules link to the existing repository installation; no reference HEAD was used.
In citations below, bare sync filenames resolve under
`packages/documents/server/src/aggregates/Sync/`; bare `SyncOperation.repo.ts` resolves under
`packages/documents/server/src/entities/SyncOperation/`. Desktop `runtime/` citations resolve
under `apps/professional-desktop/src/`.

Implementation reconciliation (PR 3b part 1, 2026-11-07): this branch includes PR 2b.
`packages/drivers/alchemy-postgres/src/AlchemyPostgresWorkflows.ts` provides
`ClusterWorkflowEngine.layer` over `SingleRunner.layer({ runnerStorage: "sql" })`
and WebCrypto Digest. `AlchemyPostgres.layer()` combines that engine with the Platform.
The restart pattern is `packages/drivers/alchemy-postgres/test/saga.test.ts`, not
`test/conformance/saga.test.ts`: close the owning runtime scope, then build a fresh runtime
over the same ambient PGlite SqlClient. This is runtime teardown proof, not an OS SIGKILL test.
`internal/projection.ts` persists each key's accepted input log, deduplicates source sequences,
and resumes accepted but unprocessed input after restart. Application SQL writes still need
their own transaction/checkpoint because a handler result can be redelivered. Backfill and
read upcasting are implemented by 2b; no replacement runner is needed.

Installed API receipts:

| Source | Consequence for 3b |
| --- | --- |
| `node_modules/@alchemy.run/domain/src/Saga.ts:90`, `:261`, `:268` | A saga key identifies one execution forever. Use a pass id, not destination id alone. |
| `node_modules/@alchemy.run/domain/src/Saga.ts:180`, `:285`, `:442` | Implement with `toLayer`, durable Activities, and `start(passId, input)`; starting the same key recovers the same run. |
| `node_modules/@alchemy.run/domain/src/Projection.ts:12`, `:32`, `:105`, `:140` | Inputs carry source/envelope/position; handlers are at least once; use `from`, `key`, `keyOf`, `on`, `toLayer` and `Progress.caughtUp(receipt)`. |
| `node_modules/@alchemy.run/domain/src/Projection.ts:51`, `:169` | Projection version triggers history replay; handlers never dispatch commands or call Box. |
| `node_modules/@alchemy.run/domain/src/ExternalSystem.ts:281`, `:299` | BoxMirror is a schema-checked service implemented with `toLayer`; declaring it adds no idempotency protocol. |
| `node_modules/@alchemy.run/domain/src/Platform.ts:92` | Historical deliveries apply to projections/views and are ignored by policies. |
| `packages/drivers/alchemy-postgres/src/AlchemyPostgresPlatform.ts:290` | Driver copies context principal/source into event columns and stamps the event schema version. |

The current pass order is recover, scan/local reconcile, push, remote drift poll, status
(`packages/documents/server/src/aggregates/Sync/VaultSyncEngine.service.ts:136`). The term
reconcile in the saga below means local observation reconciliation first and remote page
classification after push. Preserve both, rather than moving the local scan behind push.

## 2. Explicit contract with PR 3a

All names here are assumptions for mechanical reconciliation, not claims that 3a exports them.
Identifiers are public ids. `destinationId` belongs on item/operation/conflict events;
`workspaceId` and authoritative `orgId` come from workspace ownership. Keep legacy `orgId`
separately for exact projection because the old repositories hard-code 1
(`packages/documents/server/src/entities/SyncItem/SyncItem.repo.ts:60`). Do not authorize
using that legacy value or infer numeric ids from the public-id suffix.

Define these shared shapes before handlers:

- `LegacyIdentity = {table, numericId, publicId}` with table restricted to the four table names.
- `LegacyAudit = {entityType, orgId, rowVersion, createdAt, updatedAt,
  createdByPrincipal, updatedByPrincipal, deletedAt, deletedByPrincipal, schemaVersion, source}`.
  Nullable fields retain SQL nulls. This is compatibility data, not event provenance.
- `ItemSnapshot = {workspaceId, provider, localRelPath, itemKind, contentDigest,
  contentSizeBytes, localGeneration, remoteId, remoteName, remoteParentId,
  lastPushedDigest, lastPushedGeneration, syncState, lastError}`.
- `OperationSnapshot = {workspaceId, provider, itemPublicId, operationType, targetRelPath,
  targetParentRelPath, targetName, inputGeneration, inputContentDigest, idempotencyKey,
  status, attemptCount, lastError}`. Preserve the original numeric `syncItemId` as well in
  genesis compatibility data, including an unresolved reference.
- `ConflictSnapshot = {workspaceId, provider, itemPublicId?, conflictKind, localRelPath,
  remoteEventId, remoteId, remotePayload, resolutionStatus}` plus original `syncItemId` at genesis.
- `CursorSnapshot = {workspaceId, provider, streamPosition, lastEventId, status, lastError}`.
- `RemoteReceipt = {operationId, inputGeneration, remoteId, name, parentRemoteId,
  echoClass, passId}`. `echoClass` is `content | moved | renamed`. No content bytes.
- `Lease = {holder, expiresAt}`; `holder` is the durable pass id. Commands completing an
  attempt also carry `leaseEpoch`, a monotonic fencing value assigned at lease acquisition.

Events required from 3a or added there by agreement:

| Aggregate | Events and required payload fields beyond destinationId |
| --- | --- |
| SyncDestination | `DestinationRegistered{orgId,workspaceId,provider,name,remoteRootName,credentialRef}`; `DestinationRenamed{name}`; `RootFolderResolved{remoteRootFolderId}`; `DestinationConnected{probedAt}`; `DestinationPaused{reason}`; `DestinationResumed{}`; `CursorAdvanced{cursorIdentity,streamPosition,lastEventId,status:"active",lastError:null,pageId}`; `CursorFailed{cursorIdentity,streamPosition,lastEventId,status:"error",lastError}` |
| DestinationNameReservation | `DestinationNameReserved{orgId,name,destinationId}` and `DestinationNameReleased{orgId,name,destinationId}`; org-qualified reservation key, no numeric projection |
| SyncItem | `ItemTracked{identity,legacyAudit,observation}`; `ItemEdited{contentDigest,contentSizeBytes,localGeneration}`; `ItemMoved{localRelPath,localGeneration}`; `ItemKindReplaced{localRelPath,itemKind,contentDigest,contentSizeBytes,localGeneration}`; `ItemPushed{receipt,lastPushedDigest,lastPushedGeneration}`; `ItemPushFailed{lastError,terminal}`; `ItemDriftFlagged{conflictId}`; `ItemReturnedToPending{reason}` |
| SyncOperation | `OperationQueued{identity,legacyAudit,snapshot}`; `OperationRetargeted{targetRelPath,targetParentRelPath,targetName,inputGeneration,inputContentDigest}`; `OperationSquashed{targetRelPath,targetParentRelPath,targetName,inputGeneration,inputContentDigest}`; `OperationLeased{holder,expiresAt,leaseEpoch}`; `LeaseExpired{holder,leaseEpoch}` emitted by scheduled `ExpireLease`; `OperationSucceeded{receipt,leaseEpoch}`; `OperationRetryScheduled{attemptCount,lastError,leaseEpoch}`; `OperationFailed{attemptCount,lastError,leaseEpoch}`; `OperationSuperseded{reason}`; `OperationRevived{}` |
| SyncConflict | `ConflictRecorded{identity,legacyAudit,snapshot}`; `ConflictReviewed{correction?}` where correction has `{operationId,operationType,targetRelPath,targetParentRelPath,targetName}` |

`observation` is `{localRelPath,itemKind,contentDigest,contentSizeBytes,localGeneration}`.
The remaining ItemTracked fields initialize to null/current defaults explicitly in evolve:
remote fields and lastPushed fields null, state pending, error null. Fresh operation snapshot
starts queued, attemptCount 0, error null. Fresh conflict snapshot starts open. A new cursor's
`cursorIdentity` carries its identity and initial LegacyAudit; later cursor events reference it.
Every listed event declares static `schemaVersion = 1` unless 3a has already versioned it.

3b also needs import-only v1 events: `DestinationGenesisImported{registration,importId}`,
`CursorGenesisImported{identity,legacyAudit,snapshot,importId,selectedForPolling}`,
`ItemGenesisImported{identity,legacyAudit,snapshot,importId}`,
`OperationGenesisImported{identity,legacyAudit,snapshot,legacySyncItemId,importId}` and
`ConflictGenesisImported{identity,legacyAudit,snapshot,legacySyncItemId,importId}`.
`registration` has the DestinationRegistered fields plus `destinationId`.
`remoteRootName` preserves the actual configured Box folder name independently of the unique
application display name. `statusReceipt` is `{connected,disconnectReason,probedAt,provider,
cursorPosition,pendingItems,currentItems,errorItems,conflictItems,queuedOperations,
failedOperations,openConflicts}` with the same nullable semantics as the legacy status contract.
ExpireLease input is `{holder,leaseEpoch}` and is scheduled at expiresAt; expiration checks both
values before changing state. Complete/fail commands check the destination pass fence.
These initialize snapshots directly. They do not pretend that an old succeeded row was
newly queued and pushed. Genesis tags must not match push/revive/review policies.

Proposed coordination events on SyncDestination are `DestinationPassStarted{passId,fence}`,
`DestinationPassCompleted{passId,fence,statusReceipt}` and
`DestinationPassFailed{passId,fence,reason}`. An internal BeginPass command atomically grants
one active pass; a duplicate trigger returns that active pass. A completed pass allows a new
pass id. Review admission uses the same destination ownership gate. If 3a supplies equivalent
coordination, translate names and fields in a contract checklist before coding.

## 3. VaultSyncPass steps, recovery and exactness

Declare `VaultSyncPass` with key `VaultSyncPassId` and input
`{destinationId, orgId, workspaceId, fence, configRevision}`. Resolve the canonical vault root
through the authorized workspace configuration inside the handler. Persist the root/config
revision used for the run; refuse a changed configuration on resume until the old run is
settled. Do not put an absolute workstation path, credential value or bytes into events.
A trigger's command id determines its pass id. Repeated triggers are safe, and later deliberate
passes get new ids. A destination id alone would return the first completed pass forever.

Host via `AlchemyPostgresWorkflows` over the same SqlClient as the Platform, using
`effect/cluster/ClusterWorkflowEngine` and SQL-backed `effect/cluster/SingleRunner` with Digest.
The installed Effect source confirms the SQL/Digest requirements at
`node_modules/effect/src/cluster/SingleRunner.ts:47`. No process-local Ref owns pass exclusion.
Activities import `effect/workflow/Activity`, not an Effect barrel.

Each activity has an explicit schema for its persisted result. Stable activity names include
pass id, phase, operation id and attempt ordinal or page ordinal. Activity replay may execute
an unfinished body again. Every aggregate send therefore also uses an explicit deterministic
command id, such as `pass/<id>/op/<op>/attempt/<n>/succeed`. Persist the chosen ordinal before
calling Box; never recompute it from an already incremented attempt counter on resume.

| Step/activity | Work and durable result | Idempotency and restart behavior |
| --- | --- | --- |
| 1. `admit` | BeginPass; capture fence and config revision | Destination serializes trigger/review ownership. Re-entry with same pass returns the same grant. |
| 2. `probe` | BoxMirror.resolveRoot; RootFolderResolved and connected/disconnected observation | Root lookup/create converges by name. Reuse its recorded result; a disconnection skips remote work but still permits scan. |
| 3. `recover` | Settle expired leases; revive eligible failed operations only while connected; heal pending items with no live op | ExpireLease targets holder/epoch, never bulk-requeues another active pass. Stable revive/heal command ids preserve I2/I5. Imported leased rows start expired and are recovered after activation. |
| 4. `scan` then `observe/<ordinal>` | Vault scan returns only sorted relative paths, kinds, digests and sizes. Emit observation commands, await their policy consequences | Persist the observation plan before emitting commands. Folder depth/name ordering precedes files; missing files feed deterministic digest move matching; missing folders stay tracked. Replayed sends dedupe. No Box calls. |
| 5. `queue/<round>` | Read authoritative executable operations and parent/item mappings into an ordered plan | Preserve numeric FIFO for imported operations. Await policy receipts or a named queue-generation barrier, not a sleep or an eventually consistent empty queue. Resume uses the saved plan. |
| 6. `lease/<op>/<n>` | Acquire lease with holder, expiry, epoch after dependency checks | Parent must have durable remoteId (I9); version/move/rename require item remoteId (I10). A blocked op stays queued with no attempt increment. |
| 7. `remote/<op>/<n>` | Call BoxMirror verb; persist RemoteReceipt or typed failure | Durable activity completion prevents repeats after its checkpoint. Adapter recovery handles an uncertain remote outcome as described below. |
| 8. `item/<op>/<n>` then `settle/<op>/<n>` | ItemPushed first, then OperationSucceeded; or failure/retry events | Separate command ids make partial completion recoverable. I15 holds even if the second send fails. Completion rejects a stale epoch. Collect one echo token from each success receipt. |
| 9. `poll/<page>` then `classify/<page>/<event>` | Poll current cursor, persist normalized page; classify, record conflicts/flag items or consume echo tokens | Persist the page's start/end cursor and event identities. Commands dedupe by destination + remote event id; id-less observations use saved page/ordinal. Replaying a page repeats the same decisions. |
| 10. `cursor/<page>` | CursorAdvanced only after every page decision and consequence is durable | I21. On failure CursorFailed keeps the last committed cursor; before first bootstrap, record failure without fabricating a legacy cursor position. |
| 11. `status` then `complete` | Await relevant view/projection receipts, read status, DestinationPassCompleted | One completion event and one workflow result per pass. Duplicate starts return that result. Release ownership only after settlement. |

Step 8 loops back through queue rounds while an attempt made progress, matching the existing
same-pass immediate retry budget (`VaultSync.push.ts:315`, `VaultSync.config.ts:139`).
A retryable failure increments attemptCount; terminal failures fail immediately (I16).
Do not increment on leasing, waiting for parents, crash replay, or successful completion.
Keep scanning's kind replacement, move tie-break, supersession, no-delete, and connected-only
revival from `VaultSync.reconcile.ts:99`, `:239`, `:490`, `:544`. Reads preserve the symlink,
root and inode/dev checks (`VaultSync.file-store.ts:83`). Review correction must be durably
queued before ConflictReviewed closes it (I14), with a stable conflict-scoped operation id.

A pure operation decide cannot read a different aggregate's parent state. I9 therefore needs
both a handler precondition and a typed lease input containing the observed parent public id,
remote id and version. The destination gate serializes all scan/review commands that could
invalidate that proof. Only this boundary may request leases. Test stale proof rejection and
stale pass fences; do not claim that an unverified parentRemoteId string enforces I9.

### 3.1 Echo suppression survives replay

Store the ordered multiset of `{operationId,remoteId,echoClass,passId}` in completed push activity
results, and store the remaining multiset in each completed classification result. Never rebuild
it from a fresh in-memory Ref alone or borrow receipts from a prior pass. On resume, workflow
replay reconstructs the exact remaining tokens. A polled event consumes at most one matching
remoteId/class token; duplicate page delivery reuses its saved classification, not a second token.
The fallback uses normalized root parent + exact name/parent equality only for created/moved/
renamed events. Unknown items outside the mirror are ignored; remote delete never deletes local
content; new conflict payloads retain the 8 KiB limit (I11/I12/I20).

There is a baseline wording discrepancy to resolve explicitly. Research/03 I17 says edited is
always drift, but live code maps edited to content (`VaultPush.model.ts:88`) and consumes a
same-pass token before checking the fallback (`VaultSync.drift.ts:243`). Only an *unexplained*
edit is always drift (`VaultSync.drift.ts:97`). Recommended decision: preserve executable
behavior, test an upload echo edit consuming one token, then a second foreign edit becoming a
conflict. Reversal: tighten the classifier in a separately versioned behavior change, not by
silently changing the migration baseline.

### 3.2 Remote outcome gap and crash tests

A workflow cannot atomically commit a Box mutation and its SQL activity result. The existing
adapter's upload name-conflict fallback uploads another version
(`packages/documents/server/src/aggregates/Sync/DmsMirrorBox.ts:682`), and version upload has
no dedupe (`:729`). A local receipt table alone cannot close a crash between the Box response
and saving that receipt. Do not promise exactly one Box request for arbitrary crashes.

Require an adapter-owned intent ledger keyed by `(destinationId, operationId, inputGeneration,
attemptOrdinal)`, with argument digest, state `prepared | completed | uncertain`, and remote
receipt. Commit prepared before sending; completed after response. On replay, completed returns
the receipt. A prepared record left by a dead holder is uncertain. Folder creation can re-resolve;
move/rename can verify the desired remote state. Upload/version recovery needs verified remote
version/content evidence or a provider-supported dedupe facility before it retries. If evidence
cannot distinguish success from failure, hold that operation as uncertain and surface a typed
retryable recovery error without issuing a blind second upload. PR 3b must implement and test
this branch; it must not hide it behind a fixture that always dedupes.

Mandatory primary acceptance test, modeled on PR 2b's saga conformance pattern:

1. Use synthetic nested folders and two files plus a persistent fixture remote-call ledger. Start
   pass P in runtime A on a file-backed PGlite database, with Cluster SQL workflow storage.
2. A test-only barrier blocks immediately after the final push activity and both item/op success
   receipts are committed, before the first poll activity. Notify the supervisor only after the
   durable checkpoints are visible. Send SIGKILL to the runtime child, await exit, and reopen
   the same database in runtime B. Never let two PGlite processes open it concurrently.
3. Re-host the same model, saga definitions and storage names; start/get P again. Release the
   barrier via the supervisor, resume through Cluster recovery, and await Completed.
4. Assert one workflow completion, one DestinationPassCompleted, one success event per operation,
   unchanged attempt counts, one remote mutation per planned verb, no reupload, durable folder
   creation before child upload, one suppressed echo per token, and one real foreign-edit
   conflict. Assert cursor advancement follows classification and projection catch-up completes.
5. Start P a third time and restart runtime C. The result and row counts stay unchanged. Start a
   new pass Q and prove it runs, so key reuse has not disabled future synchronization.

A scope-disposal/rebuild test on PgliteTestLayer is useful fast coverage but is not a process-kill
receipt. Add fault points after remote success before activity commit, after ItemPushed before
OperationSucceeded, mid-page before cursor commit, during lease expiry, and after projection SQL
commit before driver acknowledgement. For the uncertain upload window assert no blind resend,
then resolve through simulated remote evidence and prove one terminal outcome. Reuse the same
scenario on real Postgres to test lock ownership/fencing; PGlite cannot prove multi-host locking.

## 4. SQL projections and D14 identity

Declare four projections from SyncItem, SyncOperation, SyncConflict and SyncDestination.
Partition each by source stream id (cursor by destination); keep source sequence order. Use
SqlClient handlers, not the old mutable repository methods. Each SQL transaction locks a
`documents_sync_projection_checkpoint` row keyed by `{projection,generation,stream}`, verifies
`seq == lastSeq + 1`, applies the row changes and advances lastSeq atomically. Duplicates at or
below lastSeq are no-ops. Reject a gap and retry, never advance past it. Track ignored events
as well so pass coordination does not create apparent cursor gaps. Driver acknowledgement may
happen later; the application transaction makes its redelivery harmless.

Backfill uses the driver's generation/version mechanism and separate staging target tables and
checkpoints. Never bump version against live tables with old checkpoints, and never replay
incremental counters without resetting the generation. Wait for Backfill history acceptance
*and* all captured stream high-water marks to be handled. `Progress.history` alone does not
prove writes are visible (`Projection.ts:105`). Use `Progress.caughtUp` for command receipts and
an explicit imported high-water vector for the bulk rebuild.

### 4.1 Temporary numeric mapping

Add `documents_sync_legacy_identity` with columns
`{entity_kind, public_id, legacy_id, destination_id, workspace_id, owner_org_id}`.
Primary key `(entity_kind, public_id)`; unique `(entity_kind, legacy_id)`. Numeric ids are
unique per table, not per destination. Import explicit existing id/publicId pairs; never parse
`_a17`, regenerate public ids, renumber rows, or repair stored idempotency strings.
Cursor rows retain their original public ids as compatibility identities even though their
aggregate stream is the destination's. No fake cursor aggregate is introduced.

For new entities, allocate using the corresponding SQL sequence under a mapping allocator,
record the allocated LegacyIdentity in the creation event, then use explicit ids in projection
inserts. Retry allocation by public id returns the same id. A rejected command may leave an
unused reservation, which is harmless and never reassigned. Sequences are advanced beyond the
max existing id during import. Mapping rebuild reads creation/genesis identity fields from
events; the mapping is disposable, not a second source of truth. Rebuilt sequence state must
also include still-reserved allocations before admitting new commands.

Operation/conflict handlers resolve itemPublicId through this table before inserting
`sync_item_id`; missing mappings retry, not null-fill. At genesis retain a genuinely dangling
legacy numeric reference verbatim and flag it in the import report. The numeric conflict review
RPC resolves `(kind=conflict, legacy_id)` then checks destination/workspace and membership before
sending the public-id command. This preserves the wire until PR 4 deliberately changes it.
These joins and stored key dependencies are inventoried in research/03 section 6; there are no
known cross-slice SQL consumers to migrate in 3b.

### 4.2 Common columns and exact row versions

For genesis, every column below comes from LegacyIdentity/LegacyAudit verbatim. Never substitute
import time, current actor, zero, default 1, or a regenerated schema version. Shared columns on
all tables are `id, entityType, publicId, orgId, rowVersion, createdAt, updatedAt,
createdByPrincipal, updatedByPrincipal, deletedAt, deletedByPrincipal, schemaVersion, source`
(`packages/shared/domain/src/entity/EntityKit.ts:112`, `:170`, `:225`). SQL names use the existing
snake_case mapping. Preserve audit principal JSON structurally, including null.

For later events, creation uses the declared LegacyAudit and identity. Each legacy-visible
mutation below increments the stored baseline rowVersion once, within the checkpoint transaction.
It does not set rowVersion to envelope.seq. Events with no legacy-visible mutation do not bump
it (for example, destination pass events). Audit fields follow an explicit compatibility reducer:
retain creation, deletion, schemaVersion and source fields; retain updatedAt/principal unless the
command explicitly changes them. The current repository replacement path does not stamp a fresh
clock (`SyncOperation.repo.ts:405`). Do not introduce wall-clock changes during projection replay.
If 3a adds audit updates, put their deterministic values in the event and amend this reducer with
a test. The event version column and legacy string schemaVersion are separate fields.

### 4.3 Event to column handlers

Each genesis handler inserts the entire corresponding snapshot plus identity/audit, with no
counter increments. An event tag not listed as a mutation below leaves that table unchanged.

| Table | Live event handlers and column assignments |
| --- | --- |
| `documents_sync_item` | ItemTracked inserts workspaceId/provider and observation, null remote/lastPushed fields, pending state, null lastError. ItemEdited sets contentDigest/contentSizeBytes/localGeneration, preserving syncState. ItemMoved sets localRelPath/localGeneration. ItemKindReplaced sets path/kind/digest/size/generation, clears remoteId/remoteName/remoteParentId/lastPushedDigest/lastPushedGeneration, sets pending and clears error. ItemPushed sets remoteId/remoteName/remoteParentId from receipt, lastPushedDigest/lastPushedGeneration from the operation input, current and null error. Terminal ItemPushFailed sets error/lastError; nonterminal does not mutate the item. ItemDriftFlagged sets conflict. ItemReturnedToPending sets pending and clears error. |
| `documents_sync_operation` | OperationQueued inserts all OperationSnapshot fields and numeric syncItemId via mapping. OperationRetargeted/OperationSquashed update targetRelPath/targetParentRelPath/targetName/inputGeneration/inputContentDigest only, preserving id and stored idempotencyKey. OperationLeased sets leased. LeaseExpired sets queued. OperationSucceeded sets succeeded and clears lastError. OperationRetryScheduled sets queued/attemptCount/lastError. OperationFailed sets failed/attemptCount/lastError. OperationSuperseded sets failed and lastError to the exact `superseded: <reason>` convention. OperationRevived sets queued, attemptCount 0 and null lastError. Lease holder/expiry/epoch stay in aggregate/workflow storage, not new legacy columns. |
| `documents_sync_conflict` | ConflictRecorded inserts workspaceId/provider, mapped nullable syncItemId, conflictKind/localRelPath/remoteEventId/remoteId/remotePayload/resolutionStatus. ConflictReviewed changes resolutionStatus to reviewed. No local filesystem mutation. |
| `documents_sync_cursor` | CursorGenesisImported inserts the entire old row, including original cursor publicId. CursorAdvanced upserts the identified row's streamPosition/lastEventId/status/lastError, preserving workspaceId/provider and identity. CursorFailed writes error/lastError at the prior durable position. Destination register/rename/root/connect/pass events do not create a cursor row or bump its version. |

Legacy I4 rewrote queued keys. The agreed 3a stable-operation decision supersedes that future
behavior. Genesis must retain even a previously rewritten stored key byte for byte; live squash/
retarget keeps it frozen. Test this as an intentional transition, not a replay normalization.
I18 becomes aggregate version/lease fencing for writes; projected rowVersion remains compatibility
state and cannot be used as the new command authority.

## 5. Genesis importer

Run offline with all old sync triggers/reviews and workflow/policy workers stopped. The sidecar
is the current writer using embedded PGlite, not a remote server owning these rows
(`apps/professional-desktop/src/runtime/Pglite.ts:392`, `runtime/Layer.ts:310`). Apply the procedure
to each actual store. Do not import a central empty database and declare desktop data migrated.
The import connection must not overlap a live PGlite owner.

1. Acquire a migration lock and set an app-version/writer-epoch fence that old and new startup
   guards honor. Capture a consistent SQL snapshot of all four complete tables, workspace org
   ownership, mirror root configuration and sequence states. Store a durable backup and a
   canonical row-hash/count manifest locally in the protected application backup area. No
   contents enter git or CI; synthetic fixtures exercise the format.
2. Preflight validates types, unique public ids/idempotency keys, workspace ownership, references,
   duplicate paths and duplicate cursors. No `WHERE deleted_at IS NULL`: import soft-deleted rows
   too. Account for every row by primary key. Never silently skip or coalesce duplicates.
3. Persist an import-run record `{importId,snapshotHash,phase,highWaterMarks,counts}`. Use fixed
   importId derived from snapshot hash and importer version. For each `(workspaceId,"box")`,
   allocate/persist one synthetic destination id, name it from mirrorRootName, and reserve its
   org-qualified name. Same-org name collisions require a deterministic workspace suffix; keep
   the actual remote mirror root name separately and record the effective name in the receipt.
4. Import destination registrations/reservations first; then every cursor row folded into the
   destination; then all items ordered by numeric id; then operations and conflicts ordered by
   numeric id. Seed mappings before dependent rows are projected. One legacy row emits one
   corresponding GenesisImported v1 event, even when succeeded/failed/reviewed/deleted.
5. Send restricted internal Import commands through the normal aggregate store so state, events,
   command receipts and deliveries commit together. Command id is
   `genesis/<importId>/<table>/<publicId>`; empty stream or same import hash only. Mismatched
   payload under a prior command id is a hard failure. Batches are 100 rows by keyset id, one
   entity send per transaction, with a durable batch checkpoint after committed receipts.
   Rerun after any crash repeats committed commands harmlessly; it does not overwrite streams.
6. Keep genesis policies inert. Historical Backfill does not launch policies, but live genesis
   sends also need tags excluded from all queue/revive/saga policies. Import mode refuses user
   commands and disallows Box calls. Build projections into staging, await imported high-water
   marks, then run the exact diff before admission is enabled.

Cursor duplicates are possible because no unique constraint exists. Preserve every row as a
CursorGenesisImported event and projected row. SyncDestination retains a compatibility cursor
collection keyed by cursor publicId and an explicit selected cursor id. Each entry contains
LegacyIdentity, LegacyAudit and CursorSnapshot so a second replay does not depend on old SQL rows. For duplicate cursors,
mark the destination paused until a migration receipt selects the active row; never drop the
other rows. Likewise duplicate item paths and dangling references import losslessly but pause
automatic operation admission pending explicit repair. A clean single-cursor destination uses
that cursor. With no cursor rows, remain unbootstrapped until the first successful poll.
This compatibility collection is a required reconciliation point with 3a's folded cursor model.

Imported leased operations retain projected status leased and attemptCount. Aggregate state marks
those leases expired with a migration holder, not a fictitious live runtime. Only the first
activated pass emits LeaseExpired and queues them. Do not mutate them before the baseline diff.
No ItemTracked/OperationQueued policy side effects should run during import.

Genesis provenance uses the real import service principal and system source kind in the same
Session RequestContext encoding as normal sends. Driver SendMeta.context stamps event rows;
envelope.at is import time, correlationId is importId, commandId is deterministic. Old audit
principals/timestamps stay in LegacyAudit payload data. Do not forge old users as event senders
or backdate envelopes. Assert principal/source/context/version columns on stored events, as in
`packages/drivers/alchemy-postgres/test/conformance/pglite.test.ts:32`.

## 6. Replay-and-diff and CI

Create synthetic SQL fixtures, never a copy of a client database. Include ids with gaps and
public-id suffixes unequal to numeric ids; orgId=1 on a row owned by another workspace org;
non-default rowVersion; all nullable fields both null and populated; nonzero timestamps and audit
principal JSON; all item states/kinds; lastPushed values different from current generation/digest;
all five operation types and four statuses; attemptCount 0 and greater than zero; ordinary and
review idempotency keys; queued retarget/squash history; all six conflict kinds, linked/unlinked
and reviewed/open; active/error cursors, bootstrap absence; soft-deleted rows and JSON payload
near the 8 KiB limit. Add duplicate cursor/path and dangling-reference fixtures proving lossless
import plus paused admission, and invalid-type fixtures proving a blocking diagnostic.

The harness first inserts raw SQL fixture rows using the legacy DDL and captures `SELECT *`
sorted by numeric id. It imports into an empty event store, then replays events through the real
projection host/Backfill into empty staging tables. It compares all SQL columns, not decoded
entities that may hide omitted fields. Enumerate the common columns in section 4.2 plus every
field in the four snapshots and `sync_item_id`. Assert the table metadata's column set equals
the comparison set, so adding a column cannot silently weaken the test.

Compare integer/bigint values exactly after lossless driver decoding. Timestamps are bigint
milliseconds here, so no truncation, timezone coercion or tolerance is allowed. Normalize only
SQL transport representation (bigint string versus bigint number without precision loss), JSON
object key order, and explicit SQL null representation. Preserve JSON arrays, payload text,
whitespace inside strings, error strings, stored idempotency keys and public ids exactly.
Report `{table,id,column,expected,actual}` for synthetic CI data; live reports record counts/hashes
and column names, not document-bearing payloads.

Run importer twice and after a simulated half-batch crash; event counts, mapping, rowVersion,
keys and rows must be unchanged. Destroy projections/checkpoints/mapping, reconstruct from events,
bump replay generation and repeat the zero-diff check. Inject projection failure before commit
and after commit before acknowledgement; duplicate delivery never increments rowVersion twice.
Replay must make zero Box calls and dispatch zero commands. Exercise a post-genesis event sequence
covering every handler, with hand-authored expected rows; a genesis-only snapshot test cannot
prove live reducers. Negative fixtures deliberately perturb each sensitive column to prove the
diff catches it, especially rowVersion, lastPushed*, attemptCount and idempotencyKey.

Place the synthetic replay suite in documents-server's PGlite tests and wire it into that
package's existing CI test task. Run with `PgliteTestLayer` plus the real driver/projections;
use a file-backed PGlite child fixture for process-kill acceptance. The driver conformance saga
stays model-agnostic in `packages/drivers/alchemy-postgres/test/conformance/saga.test.ts` when 2b
lands. The slice test lives in `packages/documents/server/test/VaultSyncPass.pglite.test.ts` and
reuses its crash fixture pattern. Real Postgres integration runs the same scenarios with the
existing integration project. No new CI service or repo-wide local proof is required for this
design task. Implementation must pass touched-package verification and hosted gates.

## 7. Cutover, deletion and tested reversal

PR 3b contains both new writer activation and deletion of the old writer. It must not ship a
runtime toggle that lets CRUD and alchemy accept commands concurrently. A maintenance interval
with neither writer is acceptable. Projection SQL writes are derived read-model maintenance.

Order the implementation commits so the recovery mechanism exists before destructive changes:

1. Add backup/restore schemas, migration fence, durable import receipt and a tested reversal
   command. Synthetic restore test recovers tables, audit fields, ids and sequences and restarts
   the previous binary. Preserve the prior app artifact/version. This commit lands first in the
   PR history and the backup is verified before activation.
2. Add import-only events/internal commands agreed with 3a, D14 mapping, projection declarations/
   handlers and synthetic genesis/replay-diff tests. No writer activation or old-writer deletion.
3. Add VaultSyncPass handlers, BoxMirror adapter and fault-injection tests. Confirm the exact
   3a event names/fields and PR 2b storage/runtime names with a checked contract matrix.
4. Switch app composition to the Model/Cluster handlers, add cutover startup state machine, and
   delete CRUD mutation implementations in this same PR. Run the complete slice acceptance
   matrix and update the entity-kit freeze baseline through its command.

Operational order on upgrade: stop old sidecar and reject requests; create/verify backup; take
snapshot and import with workers fenced; rebuild staging tables; zero-diff; atomically publish
read-model tables/checkpoints/mapping and set writer epoch to alchemy; start only new workers;
verify status/read/review and a synthetic controlled pass; release request admission. Startup
resumes an incomplete import from its receipts or stays in maintenance. It never guesses that
presence of some events means cutover finished. Refresh the embedded migration bundle through
`apps/professional-desktop/scripts/sync-migration-bundle.ts`, not hand edits to Migrations.gen.ts.

Delete or replace these write paths, retaining unrelated repositories and read compatibility:

- `packages/documents/server/src/aggregates/Sync/VaultSyncEngine.service.ts:103` process-local
  locking/pass orchestration; `VaultSync.reconcile.ts`, `VaultSync.push.ts`, `VaultSync.drift.ts`
  and `VaultSync.review.ts` repository-mutating implementations. Reuse pure classification,
  safe file reads and configuration where appropriate in the new handlers.
- `packages/documents/server/src/entities/Sync{Item,Operation,Conflict,Cursor}/*.repo.ts`
  create/update/enqueue/requeue/upsert/record/review mutations and mutable in-memory equivalents.
  Replace needed reads with Views/projection queries. Remove those mutation ports/use-cases,
  converters that exist only for writes, exports and tests that still instantiate a CRUD writer.
- `packages/documents/server/src/Layer.ts:117` DocumentsSyncDrizzleLive composition and
  `apps/professional-desktop/src/runtime/Layer.ts:310` its runtime selection. Replace both fixture
  and live branches with the same Model boundary, choosing fixture/Box/disconnected ExternalSystem
  Layers. Update `apps/professional-desktop/src/sync/VaultSyncOrchestrator.ts:101` dispatch.

Retain the four table contracts/migration DDL and SQL read APIs. Replace their frozen entity-kit
construction with explicit compatibility schemas if required by the freeze, preserving column
names/types/indexes. Do not delete shared EntityKit or identity brands, historical migrations,
Box SDK integration, or safe file-store behavior needed by the adapter.
A source search for repository mutators and composition exports plus a runtime test with old
writer services absent proves deletion. No escape hatch should instantiate the old layers.

There are two reversal cases. Before admission, restore the verified pre-cutover backup, table
names and sequences, retain the partial new store for diagnosis, and start the previous binary
under a legacy writer epoch. After admission, a stale backup alone would discard accepted work.
Stop admission and all new workers, settle or hold uncertain Box calls, capture an event
high-water vector and rebuild the four rows to that vector, then backup that current projection
state and all alchemy tables. Verify the same exact diff/row counts, set legacy sequences beyond
max ids, clear inherited leased statuses only through a recorded rollback procedure, and start
the prior binary under the legacy epoch. Keep the new event/workflow store read-only for recovery;
never let it resume later on top of new CRUD writes. A future recutover requires a fresh import
and explicit epoch, not replay into the abandoned writer's current state.

Test both reversal cases on synthetic stores, including post-activation commands. Assert no
accepted legacy-visible change is lost and no workflow can restart after rollback. Destination
configuration/name reservations and lease metadata have no complete legacy representation;
retain them in the backup and report the degraded old behavior. Database rollback does not undo
Box uploads/moves and must never attempt destructive remote compensation. The safe recovery
action for an uncertain Box result is evidence-based settlement, not deleting remote content.

## 8. Package and role-file placement

Follow `standards/ARCHITECTURE.md:1729` declarative/hosting split. These are proposed files in
existing packages, not a request to create packages or a competing Model composer.

| Responsibility | Placement |
| --- | --- |
| Event/import schemas, commands, pure decide/evolve | `packages/documents/domain/src/aggregates/Sync/<Concept>/<Concept>.events.ts`, `<VerbNoun>.command.ts`, `<Concept>.aggregate.ts`; reconcile with 3a's chosen paths |
| Existing BoxMirror contract and errors | domain `aggregates/Sync/BoxMirror.external.ts` and `.rejection.ts`; extend arguments/results only by agreement with 3a |
| Saga declaration | `packages/documents/use-cases/src/aggregates/Sync/VaultSyncPass.saga.ts` |
| Four projection declarations | use-cases `aggregates/Sync/LegacySync.projection.ts` |
| Model composition | existing use-cases `Model.ts` lists saga/projections; no driver or SDK imports |
| Saga activities and handler dependencies | server `aggregates/Sync/VaultSyncPass.saga-handlers.ts`, supporting `.schema.ts`, `.service.ts` or `.query.ts` by concern |
| SQL projection implementations | server `aggregates/Sync/LegacySync.projections.ts` and `LegacySync.query.ts` |
| Genesis orchestration, mapping and reversal | server `aggregates/Sync/SyncGenesis.service.ts`, `SyncGenesis.schema.ts`, `LegacySyncIdentity.service.ts`, `SyncCutover.service.ts`; SQL DDL under the existing db-admin documents-sync migration target |
| BoxMirror implementation over DmsMirrorBox | server `aggregates/Sync/BoxMirror.ts`; internal receipt/query schemas in role files, no domain SDK import |
| Runtime composition | server `Layer.ts`, app-local desktop `runtime/Layer.ts`, existing migration generation route |
| Generic storage, Backfill and Cluster workflow Layer | `packages/drivers/alchemy-postgres/src/**`, owned by PR 2b; no documents logic in the driver |
| Acceptance and fixtures | documents-server `test/VaultSync{Genesis,ReplayDiff,Pass,Cutover}.pglite.test.ts`, `test/fixtures/` synthetic rows/child harness; driver `test/conformance/` only generic scenarios |

Before implementation adds role files, run `bun run beep architecture`; import public package
aliases and Effect public leaf paths. Package handoff runs package-verify on each touched
package. This design needs no new repository-wide local gates.

## 9. BoxMirror adapter details

Implement PR 3a's `BoxMirror.toLayer` over existing DmsMirror and availability services supplied by
`DmsMirrorBox`. The adapter resolves destination configuration and credentials through runtime
services. Persist only a credential reference. No resolved credential appears in args, workflow
results, events or logs. Root lookup cache must be keyed by destination/config revision, not one
layer-global cached root across differently configured destinations.

| BoxMirror operation | Existing implementation and extra adapter work |
| --- | --- |
| resolveRoot | availability probe/root resolve (`DmsMirrorBox.ts:460`, `:574`, `:896`); return root id/probe and emit root/connect commands in saga |
| ensureFolder | DmsMirror.ensureFolder (`:655`); translate root parent to none, recover name conflicts by lookup |
| uploadFile | DmsMirror.uploadFile (`:682`); resolve canonical workspace root + relPath and securely read bytes inside adapter |
| uploadFileVersion | DmsMirror.uploadFileVersion (`:729`); same secure read, require remoteId, settle uncertain version outcome before retry |
| moveItem / renameItem | DmsMirror equivalents (`:747`, `:755`); require item kind/id, verify current remote state on uncertain recovery |
| pollEvents | DmsMirror.pollEvents (`:762`); preserve opaque cursor, account-wide changes semantics, pagination and root filtering |

Mutation args need `{destinationId,operationId,passId,attemptOrdinal,inputGeneration}` plus the
verb's path/digest/name/parent/item fields in section 2. If 3a omits those recovery identities,
add them before adapter implementation. Upload args carry `{relPath,contentDigest,contentSizeBytes}`,
not Uint8Array. Adapter checks the re-read digest/size against the queued snapshot; a changed or
vanished file becomes a typed stale-input/scan failure without uploading different bytes under
the old operation. A later scan may enqueue the new generation. Reuse I19's canonical root,
symlink refusal and inode/dev binding, including in the upload read, not just the scan.
Only the inner DmsMirror invocation receives bytes. Returned receipt includes remote identity,
name/parent and echo class, never bytes or file contents. Test serialized events, activities and
ExternalSystem call recorder arguments for absence of bytes.

Preserve DmsMirrorUnavailable retryability/disconnect mapping (`DmsMirrorBox.ts:236`, `:271`).
Translate local read failures without exposing absolute paths. Keep disconnected and fixture
implementations under the same ExternalSystem contract, including uncertain-outcome behavior.
The current DmsMirrorBox tests at `packages/documents/server/test/DmsMirrorBox.test.ts:337`
remain the vendor-mapping baseline; adapter tests add secure-read and durable-recovery assertions.

## 10. Risks and open questions with recommended decisions

1. **Uncertain upload outcomes.** The current port cannot prove whether a version upload succeeded
   after the response is lost. Recommend prepared/completed/uncertain receipt handling with
   remote evidence lookup and a held operation when evidence is insufficient. A working fixture
   is not proof of Box dedupe. Reversal: replace recovery with a verified provider idempotency
   facility later, keeping existing operation/receipt ids and events. This is the highest
   implementation risk and must be settled before enabling unattended retry.
2. **3a compatibility contract.** Does 3a retain complete genesis audit/snapshot state, separate
   compatibility rowVersion, cursor row identities/duplicates, and pass/lease fencing? Recommend
   the explicit contracts in sections 2/4/5, with every name matched in a reconciliation table
   before 3b code. Reversal: translate at the internal import boundary or add versioned events;
   never discard legacy columns or rewrite committed v1 history to match a cleaner state shape.
3. **Operational writer fence and rollback.** Which startup guard prevents an old sidecar binary
   from reopening the store after cutover, and how is it tested on the packaged desktop build?
   Recommend an enforced store writer epoch plus exclusive app ownership and a tested backup/
   current-state rollback command before activation. Reversal: remain in maintenance and restore
   the verified snapshot before any new commands are admitted. An app setting alone is too weak
   if an older executable ignores it; the deployment/launcher must enforce that guard.
4. **Account-wide Box cursors.** Keep one selected cursor per synthetic destination for parity;
   do not share a cursor between destinations in 3b. Pause ambiguous duplicate selection.
   Reversal: introduce an account-poll aggregate and versioned routing in a later migration.
5. **Destination-name collisions.** Recommend root-name-derived display names with deterministic
   workspace suffix only on org-local collisions, while preserving remoteRootName separately.
   Reversal: rename through DestinationNameReservation; never move the remote root implicitly.
6. **Echo wording.** Preserve edited token consumption from live code, with unexplained edits
   always drift, as section 3.1 specifies. Reversal is a deliberate classifier change with tests.
7. **Driver readiness.** Projection/Backfill/workflow support is present on the implementation base.
   Use the PR 2b Layers and retain separate slice recovery tests before activation. Reversal is retaining the
   legacy writer before cutover, not substituting InMemory durability in production.

Completion evidence for implementation is the forced-kill/resume receipt, all-column zero diff
from two clean rebuilds, importer rerun safety, both rollback tests, adapter uncertainty tests,
and a source/runtime proof that the old mutation path is gone. This document provides the plan;
it does not claim those checks have run.


## 11. Part 1 integration receipts and boundary

PR 3a chose `aggregates/VaultSync/` for domain and use-case declarations.
The legacy server hosting folder remains `aggregates/Sync/`. The implementation uses
`VaultSyncPassModel`, keeping the domain-only `VaultSyncModel` useful for pure scenarios.
The new model is not wired into the desktop or the legacy writer in part 1.

Box mutation arguments now include operationId, generation and passId, with itemKind on
move/rename and structured remote page metadata. Intent receipts are keyed by operation
and generation. Pass id is excluded from the fingerprint so another pass can recover the
same effect. Authoritative evidence settlement is an explicit server service; the existing
DmsMirrorBox port cannot prove an uncertain file version outcome and must return no evidence
in that case. An absent result holds the operation instead of resending the mutation.
See the decision file for uncertain Box mutation handling.

Optional v1 event fields carry new live projection metadata without invalidating existing
3a callers: observed file size, acknowledged remote name/parent, conflict kind/id/path and
cursor last event id. Genesis compatibility still needs the complete snapshots and audit
contract in sections 4-6; these additions do not claim historical row parity.

The SQL projection host requires a historical audit resolver. It must resolve the original
source envelope provenance and authoritative workspace ownership; a current user or a guessed
org id is not an acceptable resolver. The part 1 tests supply only synthetic provenance.
Snapshot-backed projections are asynchronous; beta.85's aggregate-receipt caughtUp helper
does not itself wait for all transitive snapshot deliveries. SQL acceptance tests wait for
the expected projected state as well.

Genesis, all-column legacy replay/diff, writer fencing, rollback, writer deletion and app
activation remain part 2. No part 1 result authorizes cutover.
