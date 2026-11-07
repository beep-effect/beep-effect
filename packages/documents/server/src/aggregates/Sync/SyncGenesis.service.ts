/**
 * Offline, restart-safe legacy snapshot import through the aggregate command store.
 * @packageDocumentation
 * @since 0.0.0
 */
import * as V from "@beep/documents-domain/aggregates/VaultSync";
import { $DocumentsServerId } from "@beep/identity/packages";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as H from "effect/HashMap";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as SqlClient from "effect/sql/SqlClient";
import { LegacySyncAudit } from "./LegacySync.projection.ts";
import { backupSyncTables } from "./SyncCutover.service.ts";

const $I = $DocumentsServerId.create("aggregates/Sync/SyncGenesis.service");
class SyncGenesisSnapshot extends S.Opaque<SyncGenesisSnapshot, { readonly brand: unique symbol }>()(
  S.Struct({
    items: S.Array(V.LegacyItemRow),
    operations: S.Array(V.LegacyOperationRow),
    conflicts: S.Array(V.LegacyConflictRow),
    cursors: S.Array(V.LegacyCursorRow),
  }).pipe(
    $I.annoteSchema("SyncGenesisSnapshot", {
      description: "Complete validated offline legacy sync snapshot in numeric identity order.",
    })
  )
) {}

/**
 * Imports the immutable offline backup, including every audit field and numeric identity.
 *
 * **Details**
 * Requires a Model host with its live policies/workflows disabled. Deterministic
 * command ids are derived from the entire validated snapshot, not the current user.
 * All numeric mappings are seeded before any dependent event is sent. Duplicate
 * cursors, paths and dangling item references retain their rows and pause admission.
 * The caller must keep the store offline until replay/diff and activation succeed.
 *
 * **Example** (Prepare the offline import effect)
 * ```ts
 * import { importSyncGenesis } from "@beep/documents-server/aggregates/Sync";
 * const migration = importSyncGenesis("synthetic-backup-v1", "beep-vault");
 * void migration;
 * ```
 * @category constructors
 * @since 0.0.0
 */
export const importSyncGenesis = Effect.fn($I`importSyncGenesis`)(function* (backupId: string, mirrorRootName: string) {
  const sql = yield* SqlClient.SqlClient;
  const audit = yield* LegacySyncAudit;
  const items = yield* V.SyncItem;
  const operations = yield* V.SyncOperation;
  const conflicts = yield* V.SyncConflict;
  const destinations = yield* V.SyncDestination;
  yield* backupSyncTables(backupId);
  const snapshot = yield* S.decodeUnknownEffect(SyncGenesisSnapshot)({
    items: yield* sql`SELECT * FROM documents_sync_item_cutover_backup ORDER BY id`,
    operations: yield* sql`SELECT * FROM documents_sync_operation_cutover_backup ORDER BY id`,
    conflicts: yield* sql`SELECT * FROM documents_sync_conflict_cutover_backup ORDER BY id`,
    cursors: yield* sql`SELECT * FROM documents_sync_cursor_cutover_backup ORDER BY id`,
  });
  const encoded = yield* S.encodeEffect(S.fromJsonString(SyncGenesisSnapshot))(snapshot);
  const importId = `v1-${bytesToHex(sha256(new TextEncoder().encode(`${mirrorRootName}\n${encoded}`)))}`;
  const meta = Effect.fnUntraced(function* (table: string, publicId: string) {
    const provenance = yield* audit.resolve(`genesis/${table}/${publicId}`, 0);
    return {
      commandId: `genesis/${importId}/${table}/${publicId}`,
      correlationId: importId,
      provenance: { principal: provenance.principal, source: provenance.source },
    };
  });
  // The global allocator must be beyond every seeded numeric id, even with gaps.
  yield* sql`CREATE TABLE IF NOT EXISTS documents_sync_legacy_identity (
    entity text NOT NULL, public_id text NOT NULL, id serial NOT NULL,
    PRIMARY KEY(entity,public_id), UNIQUE(entity,id))`;
  for (const [entity, rows] of [
    ["item", snapshot.items],
    ["operation", snapshot.operations],
    ["conflict", snapshot.conflicts],
    ["cursor", snapshot.cursors],
  ] as const) {
    for (const row of rows)
      yield* sql`INSERT INTO documents_sync_legacy_identity (entity,public_id,id)
      VALUES (${entity},${row.public_id},${row.id}) ON CONFLICT(entity,public_id) DO UPDATE SET id=EXCLUDED.id`;
  }
  yield* sql`SELECT setval(pg_get_serial_sequence('documents_sync_legacy_identity','id'),
    GREATEST(COALESCE(MAX(id),0)+1,1),false) FROM documents_sync_legacy_identity`;
  const allRows = [...snapshot.items, ...snapshot.operations, ...snapshot.conflicts, ...snapshot.cursors];
  let workspaceRows = H.empty<
    number,
    V.LegacyItemRow | V.LegacyOperationRow | V.LegacyConflictRow | V.LegacyCursorRow
  >();
  for (const row of allRows) workspaceRows = H.set(workspaceRows, row.workspace_id, row);
  const destinationId = (workspaceId: number) => V.DestinationId.make(`legacy-box-workspace-${workspaceId}`);
  let itemIds = H.empty<number, V.ItemId>();
  for (const row of snapshot.items) itemIds = H.set(itemIds, row.id, V.ItemId.make(row.public_id));
  const itemId = (numericId: number) =>
    H.get(itemIds, numericId).pipe(O.getOrElse(() => V.ItemId.make(`documents_sync_item_adangling${numericId}`)));
  for (const [workspaceId, row] of workspaceRows) {
    const ownership = yield* audit.resolve(`genesis/workspace/${workspaceId}`, 0);
    const cursorRows = A.filter(snapshot.cursors, (c) => c.workspace_id === workspaceId);
    const localItems = A.filter(snapshot.items, (i) => i.workspace_id === workspaceId);
    let paths = H.empty<V.VaultRelPath, V.ItemId>();
    let duplicatePaths = false;
    for (const item of localItems) {
      const path = V.VaultRelPath.make(item.local_rel_path);
      if (H.has(paths, path)) duplicatePaths = true;
      paths = H.set(paths, path, V.ItemId.make(item.public_id));
    }
    const dangling =
      A.some(snapshot.operations, (o) => o.workspace_id === workspaceId && !H.has(itemIds, o.sync_item_id)) ||
      A.some(
        snapshot.conflicts,
        (c) => c.workspace_id === workspaceId && c.sync_item_id !== null && !H.has(itemIds, c.sync_item_id)
      );
    const record = {
      _tag: "Registered",
      orgId: ownership.orgId,
      workspaceId,
      name: `${mirrorRootName} (${workspaceId})`,
      remoteRootName: mirrorRootName,
      provider: "box",
      rootId: null,
      cursor: null,
      cursorError: null,
      paused: cursorRows.length > 1 || duplicatePaths || dangling,
      paths,
    };
    const state = yield* S.decodeUnknownEffect(V.DestinationState)(record);
    const options = yield* meta("destination", row.public_id);
    yield* destinations
      .send(destinationId(workspaceId), V.ImportDestinationGenesis.make({ importId, record: state }), options)
      .pipe(Effect.provideService(V.GenesisProvenance, options.provenance));
  }
  for (const row of snapshot.cursors) {
    const peers = A.filter(snapshot.cursors, (c) => c.workspace_id === row.workspace_id);
    const options = yield* meta("cursor", row.public_id);
    yield* destinations
      .send(
        destinationId(row.workspace_id),
        V.ImportCursorGenesis.make({ importId, row, selected: peers.length === 1, paused: peers.length > 1 }),
        options
      )
      .pipe(Effect.provideService(V.GenesisProvenance, options.provenance));
  }
  for (const row of snapshot.items) {
    const operation = A.findFirst(
      snapshot.operations,
      (o) => o.sync_item_id === row.id && (o.status === "queued" || o.status === "leased")
    );
    const operationId = operation.pipe(
      O.map((o) => V.OperationId.make(o.public_id)),
      O.getOrElse(() => V.OperationId.make(`documents_sync_operation_agenesis${row.id}`))
    );
    const type =
      row.item_kind === "folder" ? "ensureFolder" : row.remote_id === null ? "uploadFile" : "uploadFileVersion";
    let slots = H.empty<V.OperationType, V.OperationId>();
    for (const o of A.filter(
      snapshot.operations,
      (o) => o.sync_item_id === row.id && (o.status === "queued" || o.status === "leased")
    )) {
      const operationType = yield* S.decodeUnknownEffect(V.OperationType)(
        o.operation_type === "createFolder" ? "ensureFolder" : o.operation_type
      );
      slots = H.set(slots, operationType, V.OperationId.make(o.public_id));
    }
    const record = yield* S.decodeUnknownEffect(V.ItemRecord)({
      observation: {
        destinationId: destinationId(row.workspace_id),
        workspaceId: row.workspace_id,
        path: row.local_rel_path,
        kind: row.item_kind,
        digest: row.content_digest,
        ...(row.content_size_bytes === null ? {} : { contentSizeBytes: row.content_size_bytes }),
        generation: row.local_generation,
        operationId,
        type,
        parentRequired: Str.includes("/")(row.local_rel_path),
      },
      remoteId: row.remote_id,
      status: row.sync_state === "current" ? "synced" : row.sync_state === "conflict" ? "drifted" : row.sync_state,
      slots,
    });
    const options = yield* meta("item", row.public_id);
    yield* items
      .send(V.ItemId.make(row.public_id), V.ImportItemGenesis.make({ importId, row, record }), options)
      .pipe(Effect.provideService(V.GenesisProvenance, options.provenance));
  }
  for (const row of snapshot.operations) {
    const record = yield* S.decodeUnknownEffect(V.OperationRecord)({
      input: {
        destinationId: destinationId(row.workspace_id),
        itemId: itemId(row.sync_item_id),
        type: row.operation_type === "createFolder" ? "ensureFolder" : row.operation_type,
        path: row.target_rel_path,
        digest: row.input_content_digest,
        generation: row.input_generation,
        parentRequired: row.target_parent_rel_path !== null,
        idempotencyKey: row.idempotency_key,
      },
      status: row.status,
      attempts: row.attempt_count,
      leaseEpoch: 0,
      holder: row.status === "leased" ? "genesis-expired" : null,
      expiresAt: 0,
      retryAt: 0,
    });
    const options = yield* meta("operation", row.public_id);
    yield* operations
      .send(V.OperationId.make(row.public_id), V.ImportOperationGenesis.make({ importId, row, record }), options)
      .pipe(Effect.provideService(V.GenesisProvenance, options.provenance));
  }
  for (const row of snapshot.conflicts) {
    const record = yield* S.decodeUnknownEffect(V.ConflictRecord)({
      publicId: row.public_id,
      destinationId: destinationId(row.workspace_id),
      workspaceId: row.workspace_id,
      remoteEventId: row.remote_event_id ?? `genesis-unidentified-${row.id}`,
      itemId: row.sync_item_id === null ? null : itemId(row.sync_item_id),
      evidence: "Historical payload retained in genesis row",
      kind: row.conflict_kind,
      ...(row.remote_id === null ? {} : { remoteId: row.remote_id }),
      ...(row.local_rel_path === null ? {} : { path: row.local_rel_path }),
      reviewed: row.resolution_status === "reviewed",
    });
    const options = yield* meta("conflict", row.public_id);
    yield* conflicts
      .send(V.ConflictId.make(row.public_id), V.ImportConflictGenesis.make({ importId, row, record }), options)
      .pipe(Effect.provideService(V.GenesisProvenance, options.provenance));
  }

  return {
    importId,
    items: snapshot.items.length,
    operations: snapshot.operations.length,
    conflicts: snapshot.conflicts.length,
    cursors: snapshot.cursors.length,
  };
});
