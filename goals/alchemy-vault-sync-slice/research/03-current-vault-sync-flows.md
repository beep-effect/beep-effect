# 03 — Current vault-sync flows (pre-alchemy baseline)

Status: research input for the alchemy migration (SPEC "Objective", "Target Surfaces"; exploration
decisions D5, D7, D8, D13, D14, D15). Read-only map of the `documents` vault-sync slice as it stands
on branch `goals/alchemy-vault-sync-slice` (2026-11-06). Every claim cites `file:line`. Sections 1–7
describe what exists today. Section 8 is a proposal and is labelled as one.

Path legend (all relative to repo root):

| Prefix | Path |
| --- | --- |
| `dom/` | `packages/documents/domain/src/` |
| `uc/` | `packages/documents/use-cases/src/` |
| `srv/` | `packages/documents/server/src/` |
| `sync/` | `packages/documents/server/src/aggregates/Sync/` |
| `tbl/` | `packages/documents/tables/src/` |
| `kit/` | `packages/shared/domain/src/entity/` |
| `desk/` | `apps/professional-desktop/` |
| `mig/` | `packages/_internal/db-admin/drizzle/20260813130540_baseline/migration.sql` |

Terminology: in this code, "reconcile" means **local** scan reconciliation (filesystem → outbox),
not remote reconciliation. Remote observation is called "drift". The real per-pass order is
requeue → recover → scan/reconcile → push → drift poll → status (§2).

---

## 1. Entities and identity

### 1.1 Shared kit columns (every sync row)

All four entities are `ProductEntity.Entity<…>()(XxxId)` (`dom/entities/SyncItem/SyncItem.model.ts:63`,
`SyncOperation.model.ts:63`, `SyncConflict.model.ts:58`, `SyncCursor.model.ts:54`). The product kit
adds the following to each table:

| Group | Columns | Evidence |
| --- | --- | --- |
| Identity | `id` serial PK (numeric, `PosInt`), `entityType` literal, `publicId` text **unique** | `kit/EntityKit.ts:225-241`, `kit/EntityId.ts:96` |
| Tenancy | `orgId` integer, indexed (`OrganizationId`) | `kit/EntityKit.ts:170` |
| Concurrency | `rowVersion` integer default 1, `Pg.version()` | `kit/EntityKit.ts:114` |
| Audit | `createdAt`, `updatedAt` (bigint ms), `createdByPrincipal`, `updatedByPrincipal` (jsonb), `deletedAt`, `deletedByPrincipal`, `schemaVersion`, `source` (indexed) | `kit/EntityKit.ts:112-152` |

**Id shapes.** `SyncItemId` and the others are `EntityId.factory("documents", $I)` →
`make("sync_item")` etc. (`packages/shared/domain/src/identity/Documents/SyncItemId.ts:13,34`). The
`id` value is a numeric `PosInt` (`kit/EntityId.ts:96`). The public id is the template
`<tableName>_<Cuid>` (`kit/PublicEntityId.ts:216`), where Cuid is `/^[a-z][0-9a-z]+$/`
(`packages/foundation/modeling/schema/src/Cuid.ts:69-70`).

**How the live repos mint ids (important for D14).** No repository uses a real cuid or a real
`orgId`. Every `*.repo.ts` builds rows with `publicId: \`${TABLE}_a${id}\``, `orgId: 1`,
`createdAt: 0`, `schemaVersion: "0.1.0"`, and `source: "Application"`
(`srv/entities/SyncOperation/SyncOperation.repo.ts:61-84`, `SyncItem.repo.ts:60-72`,
`SyncCursor.repo.ts:49-57`, `SyncConflict.repo.ts:57-65`). The drizzle adapters compute `id` as
`max(id)+1` over a full-table `SELECT` (`srv/entities/internal/RepoSupport.ts:65-66`;
`SyncOperation.repo.ts:314-318`). The insert, however, drops `id` and lets the serial assign it
(`tbl/entities/SyncItem/SyncItem.converters.ts:110-115`). Normally the `_a<n>` suffix equals the
serial id, but the code does not enforce this. Existing public ids therefore look like
`documents_sync_item_a17`. They are valid Cuids, so D14 ("never regenerate") holds, but they are
predictable.

**Workspace → org.** Sync rows carry `workspaceId` (integer, `WorkspaceId`,
`packages/shared/domain/src/identity/Workspace/WorkspaceId.ts:29`). The owning org comes from the
`Workspace` product entity (`packages/workspace/domain/src/entities/Workspace/Workspace.model.ts:31`),
not from the sync row's own `orgId`, which is hard-coded to `1`. The desktop pins
`DEFAULT_PROFESSIONAL_WORKSPACE_ID = WorkspaceId.make(1)`
(`desk/src/workspace/ProfessionalWorkspace.ts:29`).

**Database constraints** (`mig/`): there are no foreign keys. Uniques exist only on `public_id` (×4) and
`documents_sync_operation.idempotency_key` (`mig/:592,596,603,606,610`). The table has no unique on
`(workspace_id, provider, local_rel_path)` and none on `(workspace_id, provider)` for cursors. Conflicts
have no unique on `remote_event_id`, only a non-unique index (`mig/:589`). The app enforces all three
(§3).

### 1.2 SyncItem (`documents_sync_item`): one mirrored vault path

| Group | Fields (file `dom/entities/SyncItem/SyncItem.model.ts`) |
| --- | --- |
| Tenancy/scope | `workspaceId` (indexed, :110-112), `provider: DmsProvider` (:95-97) |
| Local observation | `localRelPath: VaultRelPath` (indexed, :88-94), `itemKind: file\|folder` (:71-73), `contentDigest?` (:65-67), `contentSizeBytes?` (:68-70), `localGeneration` (:85-87) |
| Remote mapping | `remoteId?` (indexed, :98-100), `remoteName?` (:101-103), `remoteParentId?` (:104-106) |
| Push watermark | `lastPushedDigest?` (:77-81), `lastPushedGeneration?` (:82-84). Write-only: set at `sync/VaultSync.push.ts:204-205`, cleared at `sync/VaultSync.reconcile.ts:311-312,375-376`, never read for decisions |
| Lifecycle | `syncState: SyncItemState` (indexed, :107-109) |
| Error | `lastError?` (:74-76) |

`SyncItemState = pending | current | error | conflict` (`dom/entities/SyncItem/SyncItem.values.ts:28`).
The coded transitions:

| From → To | Where |
| --- | --- |
| ∅ → pending | create on scan (`reconcile.ts:288-297, 442-453`) |
| any → pending (kind replaced) | `reconcile.ts:305-319, 369-383` |
| pending → current | push success (`push.ts:200-211`) |
| pending → error | terminal push failure (`push.ts:243-250`) |
| error → pending | revive when connected (`reconcile.ts:576-584`) |
| any → conflict | drift on tracked item (`sync/VaultSync.drift.ts:259-264`) |
| conflict → pending | review (`reconcile.ts:683-685`) |

A local edit leaves `syncState` untouched. It only bumps the generation and enqueues an operation
(`reconcile.ts:398-410`), so a `current` item with queued work still reads `current`.

### 1.3 SyncOperation (`documents_sync_operation`): the push outbox

| Group | Fields (`dom/entities/SyncOperation/SyncOperation.model.ts`) |
| --- | --- |
| Tenancy/scope | `workspaceId` (:109-111), `provider` (:85-87), `syncItemId` numeric FK-by-convention (indexed, :91-97) |
| Intent | `operationType` (:82-84), `targetRelPath` (:106-108), `targetParentRelPath?` (none = mirror root, :101-105), `targetName` (:98-100) |
| Input snapshot | `inputGeneration` (:76-78), `inputContentDigest?` (:71-75) |
| Idempotency | `idempotencyKey` **unique index** (:68-70) |
| Lifecycle/retry | `status` (indexed, :88-90), `attemptCount` (:65-67) |
| Error | `lastError?` (:79-81) |

`SyncOperationType = createFolder | uploadFile | uploadFileVersion | moveItem | renameItem`
(`SyncOperation.values.ts:27-33`). No delete verb exists, by design (`legal-document-intake` SPEC D4).
`SyncOperationStatus = queued | leased | succeeded | failed` (`SyncOperation.values.ts:61`).

| From → To | Where |
| --- | --- |
| ∅ → queued | `enqueueOrSquash` (`reconcile.ts:192-207`) |
| queued → queued (squash/retarget, key may change) | `reconcile.ts:217-230, 259-273` |
| queued → leased | `push.ts:285-287` |
| leased → succeeded | `push.ts:214-220` |
| leased → queued (retryable, under budget) | `push.ts:233-242` |
| leased → failed (terminal) | `push.ts:233-242` |
| leased → queued (pass-start recovery) | `requeueLeased` (`SyncOperation.repo.ts:387-404`) |
| queued → failed ("superseded: …") | `reconcile.ts:239-253` |
| failed → queued (revive, `attemptCount` reset 0) | `reconcile.ts:568-575` |

`failed` covers two cases: real terminal failures and supersession. Revive eligibility tells them
apart by matching the path and kind (`reconcile.ts:513-534`). The row has no lease owner and no
lease expiry.

### 1.4 SyncConflict (`documents_sync_conflict`): remote-drift review record

| Group | Fields (`dom/entities/SyncConflict/SyncConflict.model.ts`) |
| --- | --- |
| Tenancy/scope | `workspaceId` (:106-108), `provider` (:72-74), `syncItemId?` (none = unknown remote item, :101-105) |
| Remote evidence | `remoteEventId?` (indexed, :75-83), `remoteId?` (:84-88), `remotePayload` jsonb, truncated to 8 KiB (:89-93; `drift.ts:58-68`) |
| Local link | `localRelPath?` (:67-71) |
| Classification | `conflictKind` (indexed, :60-66) |
| Lifecycle | `resolutionStatus` (indexed, :94-100) |

`SyncConflictKind = remoteCreate | remoteEdit | remoteMove | remoteRename | remoteDelete | remoteUnknown`
(`SyncConflict.values.ts:27-34`). `SyncConflictResolution = open | reviewed` (`:62`), with a single
transition open → reviewed (`VaultSync.review.ts:148`). The entity is documented as never mutating
local content (`SyncConflict.model.ts:111-112`).

### 1.5 SyncCursor (`documents_sync_cursor`): remote event stream position

Fields: `workspaceId` (:75-77), `provider` (:66-68), `streamPosition` (opaque, :72-74),
`lastEventId?` (:61-65), `status` (:69-71), and `lastError?` (:56-60) (`dom/entities/SyncCursor/SyncCursor.model.ts`).
`SyncCursorStatus = active | error` (`SyncCursor.values.ts:31`). Each page sets it to `active`
(`drift.ts:314-323`) and a poll failure sets it to `error` (`drift.ts:355-367`). The app keeps one row
per `(workspaceId, provider)` (`uc/entities/SyncCursor/SyncCursor.repository.ts:196-199`).

### 1.6 Shared values

`DmsProvider = ["box"]` (`dom/values/Sync/Sync.values.ts:35`), `VaultRelPath` (branded
non-empty POSIX relative path, `:74-79`), `RemoteItemId` (branded, `:115-120`), and
`SyncItemKind = file | folder` (`:156`).

---

## 2. Flows

### 2.0 The pass (`syncOnce`)

The only entry point is `TriggerVaultSync`, an RPC sent from the desktop panel
(`desk/src/sync/VaultSyncOrchestrator.ts:101-120`). It reads the vault root from the workspace slice
(`WorkspaceVaultStore.getVaultConfig`, `:105-114`) and calls `engine.syncOnce`. Nothing schedules a
pass automatically (no `Schedule`/timer in `desk/src/sync/`).

`sync/VaultSyncEngine.service.ts:136-163`:

1. Take the per-workspace `Semaphore(1)`. It is **process-local**, stored in a `Ref<HashMap>`
   (`:103-121`), so it does not serialize two processes.
2. Canonicalize the vault root with `fs.realPath` (`:140-146`).
3. Read `availability.probe`, which uses the cached Box probe (`:147`).
4. `requeueLeased(workspace, box)`: every `leased` row becomes `queued` and `rowVersion+1`
   (`:148-153`; SQL at `SyncOperation.repo.ts:387-404`).
5. `recoverStalledOperations(input, connected)` (`reconcile.ts:632-648`; skipped when disconnected).
6. `scanVault` (`reconcile.ts:462-505`).
7. `pumpQueue`, which returns the same-pass `PushRecord[]` (`push.ts:315-338`).
8. `pollRemoteEvents(input, pushRecords)`. A `DmsMirrorUnavailable` is caught and goes to
   `recordPollFailure` (`:157-159`).
9. `readStatus`, whose result the RPC returns (`:160`).

**Transactionality.** The slice has no DB transaction anywhere (`rg transaction packages/documents`
finds only test comments). Each repository call is its own autocommit statement, guarded by
optimistic `rowVersion` (`SyncOperation.repo.ts:405-422`). Multi-row steps such as item+op on
success, conflict+item on drift, and requeue+markReviewed on review are **not atomic**. The code
instead orders its writes so that a crash leaves recoverable state, and documents each such order
(see §3).

### 2.1 Scan → local reconcile (`scanVault`, `reconcile.ts:462-505`)

1. `files.scan(root)` (`sync/VaultSync.file-store.ts:136-196`) walks the tree sorted by name. It
   skips dot-entries (`:145`) and symlinks (`:154-160`), refuses escapes from the root (`:164-166`),
   and reads each regular file with inode/dev binding (`:83-133`). The digest is the sha256 hex of
   the bytes (`:30-31`).
2. `listByWorkspace` builds `itemsByPath` (`:464-473`).
3. Folders are processed depth-first, then by name (`:82-85, 486-488`), through `reconcileObservedFolder`
   (`:281-326`). An untracked folder is created as `pending` gen 1, followed by `enqueueOrSquash(createFolder)`.
   When a tracked file became a folder, the row is repointed (remote linkage cleared, gen+1), its
   queued ops are superseded, and `createFolder` is enqueued.
4. Missing tracked **files** become move candidates (`:492-495`). Missing folders and unmatched
   files are left alone (one-way, no remote delete; comment at `:490-491`).
5. Files are processed by path (`:497-504`) through `reconcileObservedFile` (`:359-460`):
   - A tracked folder that became a file is repointed, superseded, and gets `uploadFile` (`:366-391`).
   - A same-path file with a changed digest gets `localGeneration+1`, then `uploadFileVersion` if it
     has a `remoteId`, else `uploadFile` (`:392-415`). An unchanged digest is a no-op (`:395-397`).
   - Otherwise it is a move/rename: `pickMoveCandidate` matches on equal digest, preferring the same
     basename and then the lexicographically first path (`:99-113`). The row is repointed (gen+1), its
     queued ops are retargeted (`:259-273`), and `moveItem` and/or `renameItem` is enqueued only when
     the item already has a `remoteId` (`:334-350`).
   - A brand-new file is created as `pending` gen 1 with `uploadFile` (`:441-455`).
6. `enqueueOrSquash` (`:174-232`) computes `idempotencyKey = provider:workspaceId:itemId:opType:localRelPath:localGeneration`
   (`:69-73`). If a **queued** op of the same type already exists for the item, it is updated in place
   (squash) and its key is rewritten to the current path/generation (`:217-230, 77-80`). Otherwise
   the op is inserted, and a duplicate key is swallowed as "already recorded" (`:208-215`).

No Box calls happen in this phase (docstring `reconcile.ts:146-147`).

### 2.2 Push (`pumpQueue`, `push.ts:315-338`)

1. Snapshot the items into `itemsByIdRef` (`:316-322`).
2. Loop: `listQueued` in FIFO id order (`:326-331`), then run `runOperation` on each (`:332-334`).
   The loop repeats while any attempt was made (`:324-336`).
3. `runOperation` (`:260-308`):
   - Skip, without leasing or burning an attempt, when the item is untracked, when
     `moveItem`/`renameItem`/`uploadFileVersion` lacks a `remoteId` (`:51-58, 278-280`), or when the
     parent folder has no `remoteId` yet (`resolveParentRemoteId`, `:98-122, 281-284`). This is how
     **folder-before-file** ordering is enforced.
   - Lease by setting `status: leased` through a versioned update (`:285-287`).
   - Call the mirror verb (`mirrorVerbFor`, `:131-191`). Upload verbs re-read the file bytes at call
     time (`:166, 179`).
   - On success (`recordPushSuccess`, `:193-225`), the item update is written **first**
     (`remoteId/Name/ParentId`, `lastPushed*`, `current`), then the op becomes `succeeded`
     (`:212-213` comment), and a `PushRecord` (echo class) is appended.
   - On failure (`recordPushFailure`, `:227-253`), `attemptCount+1`. The op is requeued when
     `error.retryable && attemptCount < maxAttempts`, else it fails and the item goes to `error`.
     A `VaultScanFailed` (file vanished) is converted to a non-retryable failure (`:292-304`).
4. **Retries have no backoff.** A requeued op counts as progress, so the next loop iteration retries
   it immediately within the same pass until the budget runs out
   (`maxAttempts` default 3, env `DOCUMENTS_SYNC_MAX_ATTEMPTS`, `sync/VaultSync.config.ts:36,68,139-146`).
   Pinned by `srv/../test/VaultSyncEngine.test.ts:409-410`.

**Box API calls.** These go through the `DmsMirror` port (`uc/aggregates/Sync/DmsMirror.ts:449-456`),
implemented in `sync/DmsMirrorBox.ts`:

| Port op | Input → Output | Box calls | Recovery | Evidence |
| --- | --- | --- | --- | --- |
| (root) | config `mirrorRootName` (env `DOCUMENTS_SYNC_BOX_MIRROR_ROOT`, default `beep-vault`) → folder id | `folders.getFolderItems("0")` paged (limit 1000) + `folders.createFolder` | 409/`item_name_in_use` → re-lookup | `:98,114,201-203,460-568`; cached per layer in a `Ref`, never invalidated `:574-584` |
| `ensureFolder` | `{name, parentRemoteId?}` → `DmsRemoteItem` | `folders.createFolder` | name conflict → `lookupFolderId` (converges) | `:655-680` |
| `uploadFile` | `{content: Uint8Array, name, parentRemoteId?}` → item | `uploads.uploadFile` | name conflict → `lookupFileId` + `uploads.uploadFileVersion` | `:682-727` |
| `uploadFileVersion` | `{content, name, remoteId}` → item | `uploads.uploadFileVersion` | none | `:729-745` |
| `moveItem` | `{itemKind, remoteId, newParentRemoteId?}` → item | `files.updateFileById` / `folders.updateFolderById` `{parent}` | none | `:592-634,747-753` |
| `renameItem` | `{itemKind, remoteId, newName}` → item | same, `{name}` | none | `:755-760` |
| `pollEvents` | `{streamPosition?}` (none → `"now"`) → `DmsEventPage` | `events.getEvents(limit 100, streamType "changes")` | none | `:762-780` |
| probe / refresh | → `DmsMirrorProbe` | root resolution | TTL 30 s ok / 3 s fail; `refresh` bypasses the cache | `:839,849,896-962` |

The returned `parentRemoteId` is normalized so that the mirror root becomes `none` (`:334-348`). For
error mapping, 429, ≥500 and transport errors are retryable; anything else is not (`:236-247`).
`disconnectReason` maps 401 → auth-failed, 403/404 → root-unreachable, 429/5xx → transient
(`:271-286`). Every failure becomes `DmsMirrorUnavailable{provider, reason, retryable, disconnectReason?}`
(`uc/aggregates/Sync/Sync.errors.ts:36-61`).

### 2.3 Drift poll (`pollRemoteEvents`, `drift.ts:273-333`)

1. Load the probe (for `rootRemoteId`), the tracked items, the remote ids of tracked folders, and the
   cursor (`:277-304`).
2. Page loop, bounded by `eventPageLimit` (default 100, `VaultSync.config.ts:84`): `pollEvents`, then
   classify each event (`:306-309`). After **each page**, upsert the cursor `{streamPosition: next, lastEventId, active}`
   (`:314-323`). Stop when a page comes back empty (`:325-331`).
3. `classifyRemoteEvent` (`:202-265`):
   - An event without a `remoteId` is ignored (`:209-214`).
   - An unknown `remoteId` records a conflict only when its parent is the mirror root or a tracked
     folder (`:222-240`); the kind comes from `unknownItemConflictKind` (`:80-88`).
   - For a tracked item, the event is suppressed as an echo when it consumes a same-pass `PushRecord`
     with the same remote id and echo class (`:177-190, 243-254`), or when its `(name, parent)` exactly
     equals the recorded remote state (`matchesPushedState`, `:104-117`; `edited` never matches).
     Otherwise the event records a conflict (`knownItemConflictKind`, `:70-78`) **and** marks the
     item `conflict` (`:256-264`).
4. `record` dedupes by `(workspaceId, provider, remoteEventId)` with a select-then-insert, not a
   constraint (`SyncConflict.repo.ts:276-298`).
5. A poll failure upserts the cursor to `error` at its last durable position. Before the first
   bootstrap, the failure is only logged (`drift.ts:340-369`).

The Box `changes` stream is **account-wide**: one `streamPosition` per workspace cursor over the same
account stream (`DmsMirrorBox.ts:762-777`).

### 2.4 Drift review (`markConflictReviewed`)

`VaultSyncEngine.service.ts:125-134` takes the same workspace lock, then
`VaultSync.review.ts:130-149` runs:

1. `listOpen(workspace)`, then find the conflict by **numeric** id. A conflict from another workspace
   is reported as `SyncConflictRepositoryNotFound` (`:133-144`).
2. `requeueReviewedConflict` (`reconcile.ts:653-686`). A `remoteMove`/`remoteRename` on an item that
   has a `remoteId` enqueues a corrective `moveItem`/`renameItem` with a **review key**
   `provider:review:workspaceId:itemId:opType:conflictId` (`:680`). Review keys survive retargeting
   (`:77-80`). The item goes back to `pending`.
3. `markReviewed` performs a versioned update setting `reviewed` (`review.ts:148`).

The correction is queued **before** the review closes, so a failed queue write leaves the conflict
open and a retry reuses the same key (`review.ts:145-146`; pinned by `VaultSyncDrift.test.ts:535-536`).
Inferred from code: for `remoteEdit`/`remoteDelete`/`remoteCreate`/`remoteUnknown` no correction is
queued and the item only returns to `pending`. The next connected pass's `healPendingItem`
(`reconcile.ts:600-617, 123-131`) then re-pushes local bytes (`uploadFileVersion`). In effect,
"reviewed" means "local wins on the next pass".

### 2.5 Crash recovery (`recoverStalledOperations`, `reconcile.ts:632-648`; connected only)

- `reviveFailedOperations` (`:544-587`) re-queues `failed` ops whose item is still at
  `targetRelPath`, whose kind matches, which have no queued op of the same type, and whose file
  still exists. It resets `attemptCount` to 0 and moves the item from `error` to `pending`.
- `healOrphanedPendingItems` (`:600-625`) gives a fresh op to every `pending` item that has none.
  The docstring (`:115-121`) describes a crash window "between marking an operation `succeeded` and
  writing the item row", but `push.ts:200-220` now writes the item first. The healer is still
  needed for review-returned items (§2.4).

### 2.6 Status read (`readStatus`, `review.ts:75-128`)

The status read counts items by state, queued and failed ops, and open conflicts, and returns the
cursor position plus the probe (`connected`, `disconnectReason`, `probedAt`). `forceProbe` calls
`availability.refresh` (`:108-110`), which mutates the probe cache.

---

## 3. Invariants and business rules (as coded)

| # | Rule | Evidence | Enforced by |
| --- | --- | --- | --- |
| I1 | One sync pass or review per workspace at a time | `VaultSyncEngine.service.ts:103-121,132-138` | process-local semaphore |
| I2 | At most one `leased` op per pass, never across passes: every pass starts by requeueing all leases | `:148-153`; `requeueLeased` doc `SyncOperation.repository.ts` (Details, ~l.419-425) | I1 + pass-start requeue |
| I3 | `idempotencyKey` is globally unique | `SyncOperation.model.ts:68-70`; `mig/:606`; `SyncOperation.repo.ts:234-262` | DB unique + typed conflict |
| I4 | Keys are **mutable while queued** (squash/retarget); review keys are not | `reconcile.ts:77-80,222,265` | app |
| I5 | At most one queued op per (item, opType) | `reconcile.ts:185-187` | app (select-then-squash) |
| I6 | One tracked row per (workspace, provider, localRelPath) | `SyncItem.repository.ts:388-390`; `SyncItem.repo.ts:255-259` | app only (no DB unique) |
| I7 | One cursor per (workspace, provider) | `SyncCursor.repository.ts:196-199` | app only |
| I8 | One conflict per (workspace, provider, remoteEventId) | `SyncConflict.repo.ts:276-296` | app only |
| I9 | Folder before file: an op stays queued, with no attempt burned, until its parent has a `remoteId` | `push.ts:94-122,281-284`; depth-sorted folders `reconcile.ts:484-488` | runtime gate + FIFO |
| I10 | `moveItem`/`renameItem`/`uploadFileVersion` need an item `remoteId` | `push.ts:51-58,278-280` | runtime gate |
| I11 | One-way push: no remote delete; locally missing items stay tracked | `reconcile.ts:490-495`; no delete in `SyncOperationType` | type + code |
| I12 | Conflicts never mutate local vault content | `SyncConflict.model.ts:111-112`; drift writes only conflict + item state (`drift.ts:256-264`); `VaultSyncDrift.test.ts:213-214` | code |
| I13 | Reviews are workspace-scoped (a foreign id reads as not found) | `review.ts:133-144`; test `VaultSyncDrift.test.ts:343-344` | app |
| I14 | Correction is queued before the review closes | `review.ts:145-148` | write order |
| I15 | The item row is durable before its op is `succeeded`; a failed item write leaves the op `leased` for recovery | `push.ts:212-213` | write order |
| I16 | The attempt budget applies to retryable errors only; non-retryable errors fail at once | `push.ts:233-242` | code |
| I17 | Same-pass push echoes are not drift; `edited` is always drift | `drift.ts:97-117,243-254` | code |
| I18 | Every write is optimistic on `rowVersion`; a stale write gets a typed `*VersionConflict` | `SyncOperation.repo.ts:405-422`; `RepoSupport.ts:193-219` | SQL `WHERE row_version=` |
| I19 | Vault reads never follow symlinks or leave the canonical root; the inode/dev is bound to the open fd | `file-store.ts:83-133,151-166` | code |
| I20 | Remote payload snapshots are capped at 8 KiB | `drift.ts:55-68` | code |
| I21 | A cursor advances only after its page is classified; a failure keeps the last durable position | `drift.ts:305-324,340-369` | write order |

---

## 4. RPC surface (`uc/aggregates/Sync/Sync.rpc.ts`)

| RPC | Kind | Payload | Success | Error |
| --- | --- | --- | --- | --- |
| `TriggerVaultSync` (:148-152) | **command** (full pass, writes everything) | `VaultSyncWorkspacePayload{workspaceId}` (:41-52) | `VaultSyncStatus` | `VaultSyncActionError{message}` |
| `GetVaultSyncStatus` (:169-173) | read (`forceProbe` refreshes the probe cache) | `{workspaceId, forceProbe=false}` (:120-131) | `VaultSyncStatus` | same |
| `ListVaultSyncConflicts` (:190-194) | read | `{workspaceId}` | `Array<SyncConflict>` (full entity, numeric `id`) | same |
| `MarkVaultSyncConflictReviewed` (:211-215) | **command** | `{conflictId: SyncConflictId (numeric), workspaceId}` (:75-91) | `SyncConflict` | same |

The group is `VaultSyncRpcs` (:231-236). `VaultSyncStatus` (`uc/aggregates/Sync/VaultSyncEngine.ts:72-126`)
has these fields: `connected`, `disconnectReason?`, `probedAt?`, `provider`, `cursorPosition?`,
`pendingItems`, `currentItems`, `errorItems`, `conflictItems`, `queuedOperations`, `failedOperations`,
`openConflicts`. Engine-level errors (`VaultSyncError` union, `:152-172`) are collapsed into the
client-safe `VaultSyncActionError` by the handler, which logs redacted
(`desk/src/sync/VaultSyncOrchestrator.ts:41-52`).

**Hosting.** The handlers live in the desktop sidecar (`VaultSyncOrchestrator.ts:75-123`), registered
in `desk/server/DesktopRpcs.ts:13,35`, over PGlite. The documents server package exports only the
engine layers (`srv/Layer.ts:96-154`). There is no session middleware on these RPCs: `workspaceId`
comes from the payload and is trusted. The renderer gates HTTP access on a per-launch session token
(`desk/src/App.tsx:156-198`).

**What the panel calls and watches** (`desk/src/sync/Sync.atoms.ts`, `VaultSyncPanel.tsx`):

- `vaultSyncStatusAtom` queries `GetVaultSyncStatus` with reactivity key `vault-sync-status:<ws>` (`:260-264`).
- `vaultSyncConflictsAtom` queries `ListVaultSyncConflicts` with key `vault-sync-conflicts:<ws>` (`:344-348`).
- `vaultSyncCommandAtoms` handles `trigger` (`TriggerVaultSync`, invalidates status + conflicts,
  `:379-412`) and `review` (`MarkVaultSyncConflictReviewed` with `conflict.id`, `:414-445`;
  `VaultSyncPanel.tsx:347-353`).
- `vaultSyncRetryConnectionAtoms` calls `GetVaultSyncStatus{forceProbe:true}` and invalidates status
  even when it fails (`:266-326`).
- The panel renders the seven counters (`VaultSyncPanel.tsx:33-41`), a connection badge, disconnect
  copy keyed on `disconnectReason` (`:103-193`), and the conflict list with "Mark reviewed" (`:212-270`).

---

## 5. Local-first today

- **Topology.** The renderer is the client and the **local sidecar** is the authority (engine +
  PGlite). Box is the only remote. Reading the vault and building the outbox need no network; only
  push, poll and probe need Box. For D8 this means the authoritative `decide` already runs on the
  user's machine. The "offline intent queue" that D8 asks for in the frontend covers only the
  renderer↔sidecar hop, while the durable queue toward Box already exists as `SyncOperation`.
- **No optimistic prediction.** The panel state machine is
  `idle | syncing | reviewing | succeeded | failed` (`Sync.atoms.ts:57-157`). Counters change only
  after the RPC returns and the reactivity keys are invalidated (`:389-392, 426-435`).
- **Serialization.** Commands for one workspace are serialized by an atom-level `Semaphore(1)`.
  Different workspaces run concurrently (`Sync.atoms.ts:467-488`; tests `desk/test/sync-atoms.test.ts`
  "runs different workspace command families independently", "serializes a same-workspace review
  behind the active sync command"). An interrupt resets the state to idle (`:475-484`).
- **Disconnected handling.** "Sync now" is disabled while `!connected` (`VaultSyncPanel.tsx:343`).
  Disconnect copy and a "Retry connection" button force a fresh probe (`:145-155`; tests
  `vault-sync-disconnected-note.test.tsx` 13 cases, e.g. "forces a fresh sidecar probe when Reconnect
  is pressed", "renders a setup note for every disconnect reason"). Without credentials the sidecar
  wires `DmsMirrorDisconnectedLayer`: every verb fails with `retryable:false`
  (`desk/src/sync/DmsMirrorDisconnected.ts:24-59`), and the probe reports `credentials-missing`
  (`:61-82`; selection at `desk/src/runtime/Layer.ts:310-327`).
- **Failure recovery in the UI.** Failed status and conflict queries show a Retry button instead of
  a dead end (`VaultSyncPanel.tsx:69-88, 226-242`; `desk/test/sync-retry.test.tsx`, plus
  "keeps a failed conflict query visible and retryable").
- **No intent persistence.** A renderer reload drops any in-flight command. No queued or offline
  intent survives.

---

## 6. Consumers outside the slice (D15) and numeric joins (D14)

`rg` for `documents_sync|SyncItem|SyncOperation|SyncConflict|SyncCursor` outside `packages/documents`:

| Consumer | Use | Evidence |
| --- | --- | --- |
| `@beep/db-admin` migration target `documents-sync` | DDL owner for all four tables | `packages/_internal/db-admin/src/migrations/DocumentsSync.ts:30-40`; `src/schema.ts:353ff`; drizzle migrations `mig/:27-125,586-610`, `20261009202131_audit_soft_delete`, `20261021041032_row_version_default` |
| db-admin tests | migration SQL proof, idempotency unique index | `test/integration/DocumentsSyncMigration.pglite.test.ts:69-70,165`; `test/ArchitectureLabMigrationTarget.test.ts` |
| Desktop migrations bundle | embedded SQL incl. `20260711000000_documents_sync_state` | `desk/src/runtime/Migrations.ts:35`; `Migrations.gen.ts` |
| Desktop runtime wiring | engine + drizzle repos + Box/disconnected/fixture | `desk/src/runtime/Layer.ts:38-43,75,104,310-327,389` |
| Desktop UI and RPC handlers | §4 | `desk/src/sync/*` |
| Desktop schema-parity test | entity ↔ table parity | `desk/test/schema-parity.test.ts` |
| Shared identity | id definitions + namespace test | `packages/shared/domain/src/identity/Documents/*`; `test/IdentityNamespaces.test.ts` |

**No other slice reads these tables in SQL.** There is no cross-slice join, report or view. The D15
projection obligation today is therefore: keep the four tables byte-compatible for the db-admin target,
the desktop migration bundle, and the desktop's own reads through the RPCs.

**Numeric-id dependencies** (the D14 temporary mapping must serve these):

- `documents_sync_operation.sync_item_id` → `documents_sync_item.id` (`SyncOperation.model.ts:91-97`).
- `documents_sync_conflict.sync_item_id` → item id (`SyncConflict.model.ts:101-105`).
- `workspace_id`, plus `org_id` (hard-coded 1), on every row → workspace slice ids.
- Idempotency keys embed the numeric `workspaceId` and `item.id`; review keys also embed the numeric
  `conflict.id` (`reconcile.ts:69-73,680`). Stored keys reference numeric ids.
- **Wire contract:** `MarkVaultSyncConflictReviewed.conflictId` is the numeric `SyncConflictId`
  (`Sync.rpc.ts:80`), the panel passes `conflict.id` (`VaultSyncPanel.tsx:349-353`), and
  `ListVaultSyncConflicts` returns full entities including numeric `id`. Under D14 (stream id = public
  id) the RPC and UI must switch to `publicId`, or the Api must resolve numeric → public id.

---

## 7. Gaps versus the SPEC

**There is no destination entity.** These pieces stand in for one today:

| Destination facet | Current stand-in | Evidence |
| --- | --- | --- |
| Provider | literal `DmsProvider = "box"`, plus the `BOX_PROVIDER` constant in each phase | `Sync.values.ts:35`; `VaultSyncEngine.service.ts:49`, `reconcile.ts:41`, `push.ts:47`, `drift.ts:50`, `review.ts:36` |
| Remote target folder | process env `DOCUMENTS_SYNC_BOX_MIRROR_ROOT` (default `beep-vault`) under Box root `"0"` | `DmsMirrorBox.ts:98,114,131-199,201` |
| Credentials | process env CCG trio or `CLOUD_BOX_TOKEN`, chosen at sidecar boot | `desk/src/runtime/Layer.ts:260-293` |
| Local source | `WorkspaceVaultConfig.vaultRootPath` (workspace slice) | `VaultSyncOrchestrator.ts:105-114` |
| Scope key | `(workspaceId, provider)` on every row and query | e.g. `SyncOperation.repo.ts:88-94` |
| Remote cursor | `SyncCursor` per `(workspaceId, provider)` over an account-wide stream | `drift.ts:297-304`; `DmsMirrorBox.ts:762-777` |
| Tuning | `VaultSync.config.ts` (`maxAttempts`, `eventPageLimit`): engine knobs, not destination | `VaultSync.config.ts:107-146` |

Consequences: every workspace in a process mirrors into the **same** Box folder and shares one
credential. The mirror-root id is cached for the life of the layer (`DmsMirrorBox.ts:574-584`), and
nothing names a destination. An "org-qualified unique destination name" (SPEC acceptance) maps most
naturally to `(orgId, destinationName)`, where today's `mirrorRootName` becomes a per-destination
field and `orgId` is the real tenant id (currently `1` everywhere, §1.1). A second uniqueness
candidate is `(orgId, provider, remoteRootFolderId)`, so two destinations cannot write one Box folder.

**Lease and Deadline.** A lease today is a bare `status = leased` with no owner, no expiry, and no
attempt timestamp (§1.3). Safety comes from (a) the process-local semaphore and (b)
`requeueLeased` at the start of every pass (I1, I2). It breaks with two processes on one database.
Retries run in a tight loop with no backoff (§2.2). An alchemy Deadline would replace (b) and the
tight loop: lease `{holder, expiresAt}`, a `LeaseExpired` scheduled command that re-queues, and
backoff through scheduled retry commands. The per-workspace lock becomes per-aggregate command
serialization.

**Other gaps to carry into design:**

- **Mutable idempotency keys (I4)** clash with alchemy's stable `commandId` (`SendOptions.commandId`,
  `.repos/alchemy/packages/domain/src/Aggregate.ts:187-190`). The squash/retarget semantics need to
  become events ("OperationRetargeted") with a stable operation id.
- **No transactions:** cross-row consistency relies on write ordering (I14, I15, I21). Event-sourced
  aggregates make each step a single commit; the orderings become saga steps.
- **Upload bytes in port inputs** (`UploadFileInput.content: Uint8Array`, `DmsMirror.ts:236-244`)
  must stay out of events. The External System op should take a path or digest and read bytes at
  call time, as the code does today (`push.ts:166,179`).
- **No `Unique` primitive** in `@alchemy.run/domain@2.0.0-beta.85` source
  (`rg -l Unique .repos/alchemy/packages/domain/src` returns nothing). The name reservation needs a
  design (reservation aggregate keyed by `orgId+name`) or confirmation of the intended mechanism.
- **"failed" is overloaded** (terminal vs superseded, §1.3). Separate events would remove the
  revive-eligibility heuristics.
- **`lastPushed*` columns are write-only** (§1.2). The projection must still reproduce them for
  replay-and-diff.
- **Session/org enforcement is absent** from the RPCs (§4). D13's Views-as-security-boundary tests
  have no existing baseline to preserve.

---

## 8. Proposed alchemy mapping (PROPOSAL, not current state)

| Aggregate (stream key) | State highlights | Commands → Events | Notes |
| --- | --- | --- | --- |
| **SyncDestination** (`SyncDestinationPublicId`, new) | orgId, workspaceId, provider, name, remoteRootFolderId?, credentialRef (`op://`), cursor {position, lastEventId, status} | Register → `DestinationRegistered`; Rename → `DestinationRenamed`; RootResolved → `RootFolderResolved`; RecordPoll → `CursorAdvanced` / `CursorFailed`; Pause/Resume | Absorbs `SyncCursor` (1:1 with workspace+provider today). Name uniqueness via a reservation keyed `orgId:name` |
| **SyncItem** (existing `documents_sync_item_*` public id) | path, kind, digest, size, localGeneration, remote mapping, state | Observe(file/folder) → `ItemTracked` / `ItemEdited` / `ItemMoved` / `ItemKindReplaced`; `ItemPushed`; `ItemPushFailed`; `ItemDriftFlagged`; `ItemReturnedToPending` | Keep it: operations, conflicts and projections all hang off it. Path uniqueness per destination |
| **SyncOperation** (existing public id; stable) | item ref, type, target, input gen/digest, status, attempts, lease | `OperationQueued`, `OperationRetargeted`, `OperationSquashed`, `OperationLeased{holder, expiresAt}`, `OperationSucceeded`, `OperationRetryScheduled`, `OperationFailed`, `OperationSuperseded`, `OperationRevived`; scheduled `LeaseExpired` (Deadline) | Idempotency key = genesis key (frozen) or new stable id; no key rewrites |
| **SyncConflict** (existing public id) | kind, remote evidence, item ref?, status | `ConflictRecorded` (dedupe on `remoteEventId` within destination), `ConflictReviewed{correction?}` | Review command never touches local content (I12) |

**Views** (MCP-exposed per D13; all keyed by destination or workspace):

- `VaultSyncStatus` (today's counters, §2.6)
- `OpenConflicts`
- `DestinationList` (per org)
- `OperationQueue` (diagnostic)

**Policies:**

- `ItemTracked`/`ItemEdited`/`ItemMoved` → queue or squash an operation (today's `enqueueOrSquash`).
- `ItemKindReplaced` → supersede queued ops.
- `ConflictReviewed{correction}` → queue a corrective move or rename with a conflict-scoped id.
- `ConflictReviewed` with no correction → `ItemReturnedToPending` → heal (re-push).
- `ItemPushFailed{terminal}` → item `error`.
- `DestinationConnected` → revive failed operations.

**Saga `VaultSyncPass`** (per destination, on `ClusterWorkflowEngine`):

1. Probe (`ExternalSystem.resolveRoot`).
2. Scan (a local activity that emits observation commands).
3. Pump: for each executable op, `Lease` → External op → `Succeeded`/`RetryScheduled`/`Failed`.
   Folder-before-file stays a gate in `decide`.
4. Poll: page loop → classify → `ConflictRecorded`/`ItemDriftFlagged` → `CursorAdvanced`.
5. Status. Same-pass echo records become saga-local state.

The crash-and-resume acceptance test maps to killing the process between steps 3 and 4.

**External System `BoxMirror`.** Ops: `resolveRoot`, `ensureFolder`, `uploadFile` (args: destination,
relPath, digest, parent; bytes read inside the adapter), `uploadFileVersion`, `moveItem`, `renameItem`,
`pollEvents`. Errors: `DmsMirrorUnavailable{retryable, disconnectReason}`. The in-memory fixture
(`sync/DmsMirrorFixture.ts`) becomes the test double.

**Projections (D15).**

| Legacy table | Projected from |
| --- | --- |
| `documents_sync_item` | SyncItem events |
| `documents_sync_operation` | SyncOperation events |
| `documents_sync_conflict` | SyncConflict events |
| `documents_sync_cursor` | SyncDestination cursor events |

All four keep `id` through the D14 numeric mapping, so the `sync_item_id` columns and RPC
`conflictId` stay valid until the wire moves to public ids. Genesis import emits one v1 event per
row, reproducing `rowVersion`, `lastPushed*`, `attemptCount` and the stored `idempotencyKey`
verbatim for replay-and-diff.

**Open questions for the shape stage.** How is a destination created for existing rows (one
synthetic destination per `(workspaceId, "box")` at genesis, named from `mirrorRootName`)? Should
the cursor stay a separate aggregate, since one Box account stream can serve several destinations?
And does D8's intent queue target the renderer→sidecar hop only (§5)?

---

## Appendix: tests that pin current behavior

| File | Behaviors pinned |
| --- | --- |
| `srv/../test/VaultSyncEngine.test.ts` (:194-656) | nested-tree convergence, rename/move without re-upload, edit → new version, squash rename-while-queued, symlink-escape refusal, retryable retry in the same pass, terminal failure, attempt budget, leased recovery pushes once, heal stranded pending file/folder, idle status, config/fixture round-trips |
| `…/VaultSyncDrift.test.ts` (:83-757) | classification of unattributed delete/move/rename/unknown, foreign events vs echoes, dedupe across polls, remote delete → conflict with local untouched, review lifecycle, restart without duplicate pushes and resume of the stored cursor, poll failure on the cursor, cross-workspace review rejection, earlier-unknown review, create-on-tracked → edit, first-poll failure, folder rename restore after review, correction failure keeps the conflict open, review-close retry matrix |
| `…/VaultSyncReviewRegressions.test.ts` (:110-772) | move+rename between scans, new file at a vacated path, vanished-file failure (no wedge), in-place foreign edit is drift, revive failed ops, two revives on one item, symlink skip, events outside the mirror, payload truncation, kind-replacement supersede, no cross-workspace recovery, missing remote-id/parent stays queued without attempts, push-succeeded/item-write-failed recovery matrix, duplicate-content move tie-break, no revive while disconnected |
| `…/VaultSyncFileStoreFailures.test.ts` | filesystem boundary failures, non-regular entries, empty files |
| `…/DmsMirrorBox.test.ts` (:337-945) | root resolve/create/cache/paging/conflict recovery, upload/version/move/rename mapping, upload name-conflict versioning, event bootstrap at `now`, event mapping, retryable/non-retryable translation, availability probe |
| `…/SyncRepositoryConcurrency.pglite.test.ts`, `SyncRepositoryVersioning.*`, `integration/SyncRepositoriesDrizzle.pglite.test.ts` | rowVersion guards (stale lease completion refused after requeue), FIFO enqueue, cursor upsert, conflict dedupe, DB-level idempotency uniqueness |
| `…/SyncRepositoryDriverFailure.pglite.test.ts`, `Sync{Item,Operation,Conflict,Cursor}Server.test.ts` | driver failures redacted to `*Unavailable`; in-memory repo contracts |
| `dom/../test/Sync*.test.ts`, `tbl/../test/Sync*Table.test.ts`, `uc/../test/Sync*.test.ts` | schema decode/encode, literal families, table metadata and indexes, port tags, RPC registration, payload round-trips |
| `desk/test/sync-atoms.test.ts`, `sync-retry.test.tsx`, `vault-sync-disconnected-note.test.tsx` | per-workspace command serialization, retryable failed queries, disconnect copy per reason, force-probe retry, trigger enabled only when connected |
