# PR 3b part 2 handoff: single-writer cutover

Branch: `goals/vault-sync-cutover`, created from `goals/alchemy-vault-sync-cutover`
at `70e5e374dcb` (the earlier lane's partial work). The Opus 5.5 fallback lane
(Codex hit its usage limit) finished it. Publication owner: the orchestrator.
Local commits only; no push, PR, Yeet, readiness or monitor ran.

**Status: content-final.** All five required items are closed in code and tests,
and the PR 3c seam (mount, membership, semantics note) is integrated. The
earlier lane's offline backup, genesis, replay/diff, redelivery and SIGKILL
receipts are unchanged and still pass. What stays open is listed at the end with
its owner; none of it blocks publication of this change.

## Commits on top of `70e5e374dcb`

| Commit | Content |
| --- | --- |
| `7011ed83609` | Writer-epoch fence, startup admission and tested post-admission reversal. Lands before any deletion. |
| `2f563df6cdd` | D7 change: delete the drizzle writer, make the Model the writer in the server and desktop Layers, read-only query service for every legacy reader. |
| `aa1767718cd` | Merge `origin/main` (#2863 PR 2b). Driver files taken from main; boundaries and cache subjects re-recorded. |
| `802a6e68c48` | Merge `goals/vault-sync-api` (PR 3c, `a6eee3aafb9`) and complete its seam: Api-served RPCs and transport on the sidecar, `shared_membership` migration, owner seed, BoxMirror claim fix. |
| `1466498fbda` | Model rows projected into their own workspace; coverage restored with direct tests; inventories. |
| (this commit and the final main merge) | Handoff marked content-final; merge of `origin/main` at `7b9cd215f63` (#2885, docs only). |

## The five items

1. **Writer epoch.** `SyncWriterEpoch.service.ts` persists `documents_sync_writer_epoch`
   (legacy, migrating or model; reversal generation; admitted import id) and
   arms a statement-level trigger on the four tables. Under `migrating`/`model`
   any transaction without the `beep.documents_sync_writer = model` marker is
   refused; under `legacy` the marker is refused. Only the projections set it,
   inside their checkpoint transactions; cutover procedures use `cutover`. An
   older sidecar build is refused by the database, not by a check it lacks:
   `SyncCutoverAdmission.pglite.test.ts` boots the real drizzle migrations,
   admits, then shows raw SQL, ORM-generated SQL and a re-run of the old
   migrations all fail while the Model keeps writing. New entry points use
   `requireSyncWriterEpoch`, failing with the typed `SyncWriterEpochRejected`.
2. **Post-admission reversal.** `reverseSyncCutover` takes the projection-to-legacy
   route from research/07 section 7 (decision file
   `2026-11-07-reverse-an-admitted-store-from-the-current-projection-not-the-pre-cutover-backup.md`).
   It refuses while a Box intent is unsettled or a projection is behind,
   snapshots the four tables to `*_reversal_backup`, verifies a zero diff,
   requeues orphaned leases (recording their ids), advances each sequence past
   every table and D14 allocator id, and records the legacy epoch with the next
   generation. The same test admits, writes and leases through the Model,
   proves the uncertain-intent refusal, reverses, and shows the tables equal
   the projected state except exactly the three recorded lease columns, the
   legacy writer inserts and updates again above every Model id, and the Model
   can neither resume nor write.
3. **Legacy writer deleted.** Gone: `VaultSyncEngine.service.ts`, the reconcile,
   push, drift and review modules, `VaultSync.config.ts`, the four server
   repository implementations (drizzle and in-memory) and `RepoSupport.ts`, the
   four use-cases repository ports, the `VaultSyncEngine` port and its inputs,
   the desktop `VaultSyncOrchestrator`, and their tests. A source search for
   repository mutators, `toSync*Insert` and `insert`/`update` on the four tables
   finds only the fence test's deliberate old-build emulation and db-admin's
   DDL proof. Entity-kit freeze baseline shrank 64 → 55 importers (zero findings);
   coverage rows of deleted files were dropped; dead push-record and scan-state
   schemas were removed.
4. **Server and sidecar Layers.** `DocumentsVaultSyncLive` hosts `VaultSyncPassModel`
   (policies including PR 3c's `VaultSyncRequests`, the pass saga, BoxMirror,
   SQL projections) on `AlchemyPostgres.layer()` with `LegacySyncAuditLive`, the
   no-evidence BoxMirror resolver and `VaultSyncRootFromWorkspaceLive`. The
   layer finishes building only after `ensureSyncCutover` runs genesis and
   admission (a no-op on an admitted store, idempotent after a crash in
   `migrating`, refusing a reversed store). The desktop's `PgliteDrizzleLive`
   now also outputs `SqlClient`, so the Model shares the sidecar PGlite.
   `VaultSyncRuntime.pglite.test.ts` proves startup admission, a restart with no
   second genesis, and the fence against legacy writes on the real composition.
5. **Consumers.** Research/03 section 6 readers: the desktop RPCs, now served by
   PR 3c's `VaultSyncRpcsApiLive`, read conflicts through `LegacySyncReadModel`
   (the legacy row decoders, unchanged entities and D14 ids); the db-admin target
   and desktop bundle keep the four table contracts unchanged (D15); the
   schema-parity test passes. The runtime test drives the four RPCs end to end:
   numeric conflict id 88 and item id 57 survive genesis, review by numeric id
   reaches the projected row, a pass's new item and operation join through D14
   ids above the legacy maximum, and a foreign workspace is refused.

## PR 3c seam (integrated here)

- **Mount.** `RuntimeLive` and `RuntimeTest` serve `VaultSyncRpcsApiLive` over
  `VaultSyncSessionLive`, the sidecar channel adapter, the desktop binding and
  live membership. `server/main.ts` mounts `makeVaultSyncTransportLayer` beside
  the ontology MCP when a launch token is set; both use the one exported
  `VaultSyncDesktopHostLive`, so memoization hosts a single Model. If admission
  refuses, the RPCs answer "Vault sync is in maintenance." and the transport is
  not mounted; the rest of the sidecar serves. The launch-token config moved to
  `src/runtime/SessionToken.ts` and the desktop binding to
  `src/sync/VaultSyncSession.ts` so `src` keeps not importing `server`.
- **Membership.** `shared_membership` is added through db-admin's drizzle tooling
  (`20261107120500_shared_membership`; `@beep/shared-tables` dependency), the
  desktop bundle was regenerated with `codegen`, and `migrations:check` is clean.
  drizzle-kit is forward-only, so the folder carries `down.sql`;
  `SharedMembershipMigration.pglite.test.ts` proves up, down, up. The owner seed
  is not in the shared migration (server Postgres replays it): the desktop
  bootstrap calls `ensureVaultSyncOwnerMembership(1, 1)` with a deterministic
  public id, so restarts add nothing and a revoked row stays revoked. The
  bootstrap also registers workspace 1's destination, which the Api needs to map
  a fresh workspace.
- **Semantics.** TriggerVaultSync and the forced probe now answer at acceptance.
  The panel (`Sync.atoms.ts`) invalidates its status and conflict reactivity
  keys when the RPC returns, so it does re-read, but at acceptance: counts
  reflect the finished pass only on the next read (another action or a
  remount). No polling or completion signal exists yet.

## Defects found and fixed in this change

- Projected rows written by the Model got `workspace_id = 0`, invisible to
  every legacy reader. Handlers now write the workspace from their event state.
- Projected rows carried the table name as `entity_type`; legacy decoders
  require the identity entity type (`DocumentsSyncItem`). Fixed in the
  projection.
- BoxMirror turned a local read failure (stale input, missing root) into an
  unsettled "uncertain" intent, holding the operation forever and blocking
  reversal. The claim is now released and the local error surfaced; only
  failures that may have reached Box stay held.
- `syncOnce` (before the swap) returned status before projections caught up.
  Superseded by the swap; the projection catch-up helper remains.

## Verification

| Gate | Result |
| --- | --- |
| documents-server tests | 102 passed, 18 files |
| documents-use-cases tests | 54 passed, 7 files |
| documents-domain tests | 49 passed, 11 files |
| professional-desktop unit tests (coverage run) | 287 passed, 55 files; sidecar smoke integration passed |
| db-admin tests (coverage run) | 23 passed, 11 files, including the membership up/down proof |
| Coverage write, five packages, `--add-missing-files-only` | ok, all committed floors retained |
| Coverage regression gate | documents-server ok after the restoring tests; the five-package run flagged only server rows, now fixed |
| Entity-kit freeze `--check` | 0 findings, 55 importers |
| effect-vitest full scan | introduced 0; branch-file exceptions carry owner and exit reasons |
| Cache policy audit | 0 blocking; requests `cache-baseline-request-pr3b2-main.json`, `cache-baseline-request-pr3b2-api.json` |
| db-admin `migrations:check`, desktop `codegen` | clean, bundle refreshed |
| `quality package-verify` (full: lint, audit, docgen) | pass: documents-server, documents-use-cases, documents-domain, db-admin, professional-desktop |

No repository-wide gate, hosted CI, real Postgres, live Box, packaged desktop
build or browser QA ran.

## Still open (none blocks this change)

- **Panel completion signal.** After the swap the panel re-reads at acceptance
  only. Owner: PR 3c / UI follow-on; the natural fix is subscribing to the
  status View stream the Api already serves.
- **Review corrections.** The compat review sends `correction: null`; the legacy
  engine requeued a corrective operation for remote move/rename conflicts. The
  ConflictReviews/ItemHealing policies return the item to pending instead.
  Owner: PR 3c (Api review semantics).
- **Real stores.** Genesis runs in-process at startup over the whole snapshot
  (no keyset batching or separate offline host). Acceptance is on synthetic
  PGlite stores; no real user store, packaged desktop upgrade or real Postgres
  multi-host lease test ran. The JSDoc documentation inventory was not
  regenerated: a full run rewrites 127k lines of unrelated drift; it is a
  final-check refresh file.
- **Provider evidence.** `BoxMirrorNoEvidenceLive` still answers no evidence, so a
  genuinely interrupted upload stays held until Box offers verified lookup
  (unchanged decision `2026-11-07-uncertain-box-mutation.md`).
- **IPC mode.** An IPC sidecar mounts no HTTP, so the remote CLI cannot reach it
  (PR 3c note); the desktop binding in that mode uses a placeholder token no
  transport accepts.

## Stack fixes on `goals/vs-cutover` (2026-11-07)

Branch `goals/vs-cutover` was cut from `2b3107a43bd`. It merges `goals/vs-api`, so it
carries #2886, the 3b1 fixes and the 3c PII, provenance, correction and status-stream
fixes.

- **Merge resolution.** Cutover owns the write wiring and 3c owns the RPC/HTTP
  surface. The legacy `VaultSyncOrchestrator` stays deleted, and the new
  `WatchVaultSyncStatus` RPC now has a maintenance handler in the desktop
  `Layer.ts`. The 3b1 projection column mappers are kept, with cutover's
  `workspace_id` columns, operation owner lookup, genesis branches and cursor
  selection folded in as small helpers. Cutover's `LegacySyncReadModel` serves
  the Api RPCs. The probe resolves `remoteRootName ?? name` in the refactored
  saga helper. `principalKey` was added to the moved desktop binding
  (`src/sync/VaultSyncSession.ts`) and to the runtime test. The SPEC and PLAN
  projections were regenerated from `decisions/`. The Effect Vitest inventory is
  a three-way union by finding id. Generated catalogs and fallow boundaries were
  regenerated.
- **D17 F3, opaque genesis ids.** `legacyBoxDestinationId` is gone.
  `workspaceDestinationId(workspaceId)` mints a
  `documents_sync_destination_<cuid-shaped>` id once, records it in
  `documents_sync_destination_binding`, and returns the bound id on every later
  call. Genesis and `ensureLegacyBoxDestination` both use it, so a crashed
  genesis re-run and the bootstrap agree. `SyncGenesis.pglite.test.ts` asserts
  the id is a valid opaque `DestinationId`, unique per workspace and stable
  across calls. The runtime test asserts the bootstrap keeps the imported
  binding. Decision: `2026-11-07-genesis-binds-each-workspace-to-one-minted-destination-id.md`.
- **Batching.** Genesis stays one pass over the full snapshot. The decision
  file `2026-11-07-genesis-imports-the-desktop-store-in-one-pass-not-in-batches.md`
  explains why that is acceptable for desktop store sizes.
- Every cutover test fixture now uses minted destination ids (hosting, admission,
  genesis, runtime and the crash child).

- **Fallow on cutover's own code.** `importSyncGenesis` (cyclomatic 29, cognitive
  46) is now a short pipeline of phase helpers: read snapshot, seed identities,
  build the context and the bindings, then import destinations, cursors, items,
  operations and conflicts. Command order and ids are unchanged. The 235-line
  genesis acceptance test is split into seed and assert phases that share one
  platform config. The write/genesis checkpoint clone is a single
  `claimCheckpoint` helper, and the cursor projection's guard is
  `cursorTarget`. The genesis events carry the `schemaVersion` fallow-ignore,
  and the moved `desktopVaultSyncRequest` is module-private.
- **Cache policy.** The baseline conflict took the incoming 3c side.
  `@beep/db-admin`'s shared-tables edge was then re-recorded through
  `cache-baseline-request-pr3b2-stack.json`, which supersedes the earlier 3b2
  requests. Policy reports 0 blocking findings.
- **Effect Vitest inventory.** The rows for this stack's files that the
  refactors resolved were pruned (12 EV002 rows in the projection and genesis
  tests). The scan reports introduced=0 and resolved=2, the same as main.

Verification on this branch: package-verify (lint, audit, docgen) passes for
documents-domain, documents-use-cases, documents-server, professional-desktop and
db-admin. The coverage gate is ok for the three documents packages: domain 58,
use-cases 56 and server 106 tests under coverage. Fallow dead-code, health and audit
exit 0. Effect Vitest reports introduced=0. Cache policy reports 0 blocking findings.
Entity-kit freeze reports 0 findings. tsconfig-sync reports no drift. Docs oxlint is
clean on the touched sources. The scoped schema-first scan exits 0. Goals decisions
check reports drift 0.

### Still open

- **Load-sensitive runtime assertion.** Fixed on `goals/vs-cutover-2`; see below.

- **Provenance mapping for Api requests (D17 F8, 3b2 half).** The driver config
  takes a single `ProvenanceMapping`, and the cutover host already uses it for
  `GenesisProvenance` (`principal`/`source`). Mapping the v1 request context's
  `principalKey`/`sourceKind` as well needs the driver to accept one mapping per
  context key, or both contexts to share field names. That is a driver PR off
  `main` (with D17 F4/F7). Until it lands, the 3c fields are populated and proven
  on the driver (`VaultSyncProvenance.pglite.test.ts`), but the desktop host
  records principal columns only for genesis events.
- R7 (`layerCatalogEnrichment` with `StrictDesktop`) is not mounted. It is the
  same driver/observability follow-up.

## Final 3a contract on `goals/vs-cutover-2` (2026-11-07)

Branch `goals/vs-cutover-2` was cut from `goals/vs-cutover` (`cbbfdaef582`) and
merges `goals/vs-api-2`, which carries the final PR 3a head `e2bd335249e`.

- **BoxMirror conflict.** Both sides had fixed the stale-input claim leak. The
  result keeps this branch's explicit `isLocalFailure` guard, now keyed on
  `stage` (`local-root`, `stale-input`) instead of `operation`, and reports the
  Box call name in `operation`. `VaultSyncRoot` failures are mapped to the
  `local-root` stage of the call they serve; `VaultSyncRootFromWorkspaceLive`
  reports `{ operation: "resolveRoot", stage: "local-root" }`.
- **SyncRule.** `genesis-requires-empty-stream` joins the closed kit.
- **Genesis mapping (decision
  `2026-11-07-map-legacy-free-text-sync-reasons-losslessly-at-genesis.md`).**
  The mapping is lossless rather than reconstructed: every genesis event keeps its
  complete legacy row and the projection writes that row verbatim, so the legacy
  text survives replay. Aggregate state takes closed values: a non-null legacy
  cursor `last_error` becomes `cursorError: "pollEvents"`, and an imported
  operation's `idempotencyKey` becomes its own id (the 3a merge had broken genesis
  here: `SyncGenesis.pglite.test.ts` failed decoding the legacy key as an
  `OperationId`). `idempotency_key` is now an insert-only projection column, so a
  live event on an imported operation keeps its legacy key text. The genesis test
  imports a selected error cursor with free vendor text, asserts the mapped state,
  keeps the all-column zero diff, and supersedes an imported operation live.
- **Flake root cause and fix.** `LegacySyncOperation` took `workspace_id` from
  the item row, which the separate `LegacySyncItem` projection may not have
  written yet; it then fell back to the audit's workspace, so
  `operationsByStatus(workspaceId, "succeeded")` could miss the row. The
  projection now reads the workspace from the operation's destination aggregate
  state (`V.SyncDestination.state`). Registration commits before any operation
  can name the destination, so the owner no longer depends on projection order.
  `documents_sync_destination_binding` was not used: destinations registered
  through name claims (3c) have no binding row. A new projection test queues an
  operation for an item that was never projected, on a destination in workspace 9
  while the audit default is 4; it fails on the old code (workspace 4) and passes
  now.
- **Six cutover PGlite suites together, 5 runs** (`SyncCutover`,
  `SyncCutoverAdmission`, `SyncGenesis`, `VaultSyncRuntime`, `VaultSyncHosting`,
  `LegacySync.projection`): 5 of 5 passed, 9 of 9 tests each run, 5.0 to 7.7 s.
- **Fallow.** The BoxMirror test body reached cognitive 9 after the stage
  assertions; the two-upload check moved into an `uploadTwice` helper.

Verification: check clean for documents-domain, -use-cases, -server,
professional-desktop and db-admin. Tests: domain 58, use-cases 64, server 106 (19
files), desktop 285, db-admin 23. package-verify passed for all five. Coverage
ratchet ok for all five. Entity-kit freeze, tsconfig-sync, cache-policy (0
blocking), the three fallow checks and docs oxlint on touched sources exited 0.
Effect Vitest: introduced=0.
