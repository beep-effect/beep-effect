/**
 * Offline, restart-safe legacy snapshot import through the aggregate command store.
 * @packageDocumentation
 * @since 0.0.0
 */
import * as V from "@beep/documents-domain/aggregates/VaultSync";
import { $DocumentsServerId } from "@beep/identity/packages";
import { Cuid } from "@beep/schema/Cuid";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as H from "effect/HashMap";
import * as O from "effect/Option";
import * as Random from "effect/Random";
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

// A CUID-shaped random token needs no host services; the binding's UNIQUE constraint backs it.
const mintBindingId = Effect.gen(function* () {
  const at = yield* Clock.currentTimeMillis;
  const high = yield* Random.nextIntBetween(0, 2_147_483_647);
  const low = yield* Random.nextIntBetween(0, 2_147_483_647);
  return V.makeDestinationId(Cuid.make(`a${at.toString(36)}${high.toString(36)}${low.toString(36)}`));
});
const BindingRows = S.NonEmptyArray(S.Struct({ destination_id: V.DestinationId }));
/**
 * The Box destination that owns one workspace's legacy rows.
 *
 * **Details**
 *
 * The id is an opaque minted `DestinationId`; nothing about the workspace, its
 * name or its paths is encoded in it (D17 F3). The first call mints one and
 * records it in `documents_sync_destination_binding`; every later call, including
 * a genesis re-run after a crash and the bootstrap's Model engine, reads the same
 * binding, so a workspace keeps one destination before and after the cutover.
 *
 * **Example** (Bind a workspace to its destination)
 *
 * ```ts
 * import { workspaceDestinationId } from "@beep/documents-server/aggregates/Sync"
 *
 * void workspaceDestinationId(3)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const workspaceDestinationId = Effect.fn($I`workspaceDestinationId`)(function* (workspaceId: number) {
  const sql = yield* SqlClient.SqlClient;
  yield* sql`CREATE TABLE IF NOT EXISTS documents_sync_destination_binding (
    workspace_id integer PRIMARY KEY, destination_id text NOT NULL UNIQUE)`;
  const minted = yield* mintBindingId;
  yield* sql`INSERT INTO documents_sync_destination_binding (workspace_id, destination_id)
    VALUES (${workspaceId}, ${minted}) ON CONFLICT (workspace_id) DO NOTHING`;
  const rows = yield* sql`SELECT destination_id FROM documents_sync_destination_binding
    WHERE workspace_id = ${workspaceId}`.pipe(Effect.flatMap(S.decodeUnknownEffect(BindingRows)));
  return rows[0].destination_id;
});

type LegacyRow = V.LegacyItemRow | V.LegacyOperationRow | V.LegacyConflictRow | V.LegacyCursorRow;
type GenesisOptions = {
  readonly commandId: string;
  readonly correlationId: string;
  readonly provenance: { readonly principal: string; readonly source: string };
};
// Everything the per-table import phases share: the validated snapshot and its identities.
type GenesisContext = {
  readonly snapshot: SyncGenesisSnapshot;
  readonly importId: string;
  readonly mirrorRootName: string;
  readonly itemIds: H.HashMap<number, V.ItemId>;
  readonly destinationId: (workspaceId: number) => V.DestinationId;
  readonly itemId: (numericId: number) => V.ItemId;
  readonly meta: (table: string, publicId: string) => Effect.Effect<GenesisOptions>;
};
const openOperation = (o: V.LegacyOperationRow) => o.status === "queued" || o.status === "leased";
const repushType = (row: V.LegacyItemRow): V.OperationType => {
  if (row.item_kind === "folder") return "ensureFolder";
  return row.remote_id === null ? "uploadFile" : "uploadFileVersion";
};
const itemStatus = (state: string) => ({ current: "synced", conflict: "drifted" })[state] ?? state;
const decodeOperationType = (type: string) =>
  S.decodeUnknownEffect(V.OperationType)(type === "createFolder" ? "ensureFolder" : type);

const readSnapshot = Effect.fnUntraced(function* () {
  const sql = yield* SqlClient.SqlClient;
  const items = yield* sql`SELECT * FROM documents_sync_item_cutover_backup ORDER BY id`;
  const operations = yield* sql`SELECT * FROM documents_sync_operation_cutover_backup ORDER BY id`;
  const conflicts = yield* sql`SELECT * FROM documents_sync_conflict_cutover_backup ORDER BY id`;
  const cursors = yield* sql`SELECT * FROM documents_sync_cursor_cutover_backup ORDER BY id`;
  return yield* S.decodeUnknownEffect(SyncGenesisSnapshot)({ items, operations, conflicts, cursors });
});
// The global allocator must be beyond every seeded numeric id, even with gaps.
const seedIdentities = Effect.fnUntraced(function* (snapshot: SyncGenesisSnapshot) {
  const sql = yield* SqlClient.SqlClient;
  yield* sql`CREATE TABLE IF NOT EXISTS documents_sync_legacy_identity (
    entity text NOT NULL, public_id text NOT NULL, id serial NOT NULL,
    PRIMARY KEY(entity,public_id), UNIQUE(entity,id))`;
  const tables = [
    ["item", snapshot.items],
    ["operation", snapshot.operations],
    ["conflict", snapshot.conflicts],
    ["cursor", snapshot.cursors],
  ] as const;
  for (const [entity, rows] of tables)
    for (const row of rows)
      yield* sql`INSERT INTO documents_sync_legacy_identity (entity,public_id,id)
      VALUES (${entity},${row.public_id},${row.id}) ON CONFLICT(entity,public_id) DO UPDATE SET id=EXCLUDED.id`;
  yield* sql`SELECT setval(pg_get_serial_sequence('documents_sync_legacy_identity','id'),
    GREATEST(COALESCE(MAX(id),0)+1,1),false) FROM documents_sync_legacy_identity`;
});
// One representative row per workspace names the destination's genesis command.
const workspaceRowsOf = (snapshot: SyncGenesisSnapshot) => {
  const all: ReadonlyArray<LegacyRow> = [
    ...snapshot.items,
    ...snapshot.operations,
    ...snapshot.conflicts,
    ...snapshot.cursors,
  ];
  return A.reduce(all, H.empty<number, LegacyRow>(), (rows, row) => H.set(rows, row.workspace_id, row));
};
const bindDestinations = Effect.fnUntraced(function* (workspaces: Iterable<number>) {
  let bound = H.empty<number, V.DestinationId>();
  for (const workspaceId of workspaces) {
    const destinationId = yield* workspaceDestinationId(workspaceId);
    bound = H.set(bound, workspaceId, destinationId);
  }
  return bound;
});
const pathsOf = (items: ReadonlyArray<V.LegacyItemRow>) =>
  A.reduce(items, { paths: H.empty<V.VaultRelPath, V.ItemId>(), duplicate: false }, ({ paths, duplicate }, item) => {
    const path = V.VaultRelPath.make(item.local_rel_path);
    return { paths: H.set(paths, path, V.ItemId.make(item.public_id)), duplicate: duplicate || H.has(paths, path) };
  });
const hasDanglingReference = (ctx: GenesisContext, workspaceId: number) =>
  A.some(ctx.snapshot.operations, (o) => o.workspace_id === workspaceId && !H.has(ctx.itemIds, o.sync_item_id)) ||
  A.some(
    ctx.snapshot.conflicts,
    (c) => c.workspace_id === workspaceId && c.sync_item_id !== null && !H.has(ctx.itemIds, c.sync_item_id)
  );
// Duplicate cursors, paths and dangling item references keep their rows and pause admission.
const destinationRecord = (ctx: GenesisContext, workspaceId: number, orgId: number) => {
  const { paths, duplicate } = pathsOf(A.filter(ctx.snapshot.items, (i) => i.workspace_id === workspaceId));
  const cursors = A.filter(ctx.snapshot.cursors, (c) => c.workspace_id === workspaceId);
  return {
    _tag: "Registered",
    orgId,
    workspaceId,
    name: `${ctx.mirrorRootName} (${workspaceId})`,
    remoteRootName: ctx.mirrorRootName,
    provider: "box",
    rootId: null,
    cursor: null,
    cursorError: null,
    paused: cursors.length > 1 || duplicate || hasDanglingReference(ctx, workspaceId),
    paths,
  };
};
const importDestinations = Effect.fnUntraced(function* (ctx: GenesisContext, workspaces: H.HashMap<number, LegacyRow>) {
  const audit = yield* LegacySyncAudit;
  const destinations = yield* V.SyncDestination;
  for (const [workspaceId, row] of workspaces) {
    const ownership = yield* audit.resolve(`genesis/workspace/${workspaceId}`, 0);
    const state = yield* S.decodeUnknownEffect(V.DestinationState)(
      destinationRecord(ctx, workspaceId, ownership.orgId)
    );
    const options = yield* ctx.meta("destination", row.public_id);
    const command = V.ImportDestinationGenesis.make({ importId: ctx.importId, record: state });
    yield* destinations
      .send(ctx.destinationId(workspaceId), command, options)
      .pipe(Effect.provideService(V.GenesisProvenance, options.provenance));
  }
});
const importCursors = Effect.fnUntraced(function* (ctx: GenesisContext) {
  const destinations = yield* V.SyncDestination;
  for (const row of ctx.snapshot.cursors) {
    const peers = A.filter(ctx.snapshot.cursors, (c) => c.workspace_id === row.workspace_id).length;
    const options = yield* ctx.meta("cursor", row.public_id);
    const command = V.ImportCursorGenesis.make({
      importId: ctx.importId,
      row,
      selected: peers === 1,
      paused: peers > 1,
    });
    yield* destinations
      .send(ctx.destinationId(row.workspace_id), command, options)
      .pipe(Effect.provideService(V.GenesisProvenance, options.provenance));
  }
});
const itemSlots = Effect.fnUntraced(function* (ctx: GenesisContext, row: V.LegacyItemRow) {
  let slots = H.empty<V.OperationType, V.OperationId>();
  for (const o of A.filter(ctx.snapshot.operations, (o) => o.sync_item_id === row.id && openOperation(o))) {
    const operationType = yield* decodeOperationType(o.operation_type);
    slots = H.set(slots, operationType, V.OperationId.make(o.public_id));
  }
  return slots;
});
const itemRecord = Effect.fnUntraced(function* (ctx: GenesisContext, row: V.LegacyItemRow) {
  const operationId = A.findFirst(ctx.snapshot.operations, (o) => o.sync_item_id === row.id && openOperation(o)).pipe(
    O.map((o) => V.OperationId.make(o.public_id)),
    O.getOrElse(() => V.OperationId.make(`documents_sync_operation_agenesis${row.id}`))
  );
  const slots = yield* itemSlots(ctx, row);
  return yield* S.decodeUnknownEffect(V.ItemRecord)({
    observation: {
      destinationId: ctx.destinationId(row.workspace_id),
      workspaceId: row.workspace_id,
      path: row.local_rel_path,
      kind: row.item_kind,
      digest: row.content_digest,
      ...(row.content_size_bytes === null ? {} : { contentSizeBytes: row.content_size_bytes }),
      generation: row.local_generation,
      operationId,
      type: repushType(row),
      parentRequired: Str.includes("/")(row.local_rel_path),
    },
    remoteId: row.remote_id,
    status: itemStatus(row.sync_state),
    slots,
  });
});
const importItems = Effect.fnUntraced(function* (ctx: GenesisContext) {
  const items = yield* V.SyncItem;
  for (const row of ctx.snapshot.items) {
    const record = yield* itemRecord(ctx, row);
    const options = yield* ctx.meta("item", row.public_id);
    yield* items
      .send(V.ItemId.make(row.public_id), V.ImportItemGenesis.make({ importId: ctx.importId, row, record }), options)
      .pipe(Effect.provideService(V.GenesisProvenance, options.provenance));
  }
});
const operationRecordInput = (ctx: GenesisContext, row: V.LegacyOperationRow) => ({
  input: {
    destinationId: ctx.destinationId(row.workspace_id),
    itemId: ctx.itemId(row.sync_item_id),
    type: row.operation_type === "createFolder" ? "ensureFolder" : row.operation_type,
    path: row.target_rel_path,
    digest: row.input_content_digest,
    generation: row.input_generation,
    parentRequired: row.target_parent_rel_path !== null,
    // The legacy key text stays in the imported row; the state takes the operation's own id, the only
    // key the operation aggregate accepts, so an imported operation queues and retargets like a live one.
    idempotencyKey: row.public_id,
  },
  status: row.status,
  attempts: row.attempt_count,
  leaseEpoch: 0,
  holder: row.status === "leased" ? "genesis-expired" : null,
  expiresAt: 0,
  retryAt: 0,
});
const importOperations = Effect.fnUntraced(function* (ctx: GenesisContext) {
  const operations = yield* V.SyncOperation;
  for (const row of ctx.snapshot.operations) {
    const record = yield* S.decodeUnknownEffect(V.OperationRecord)(operationRecordInput(ctx, row));
    const options = yield* ctx.meta("operation", row.public_id);
    const command = V.ImportOperationGenesis.make({ importId: ctx.importId, row, record });
    yield* operations
      .send(V.OperationId.make(row.public_id), command, options)
      .pipe(Effect.provideService(V.GenesisProvenance, options.provenance));
  }
});
const conflictRecordInput = (ctx: GenesisContext, row: V.LegacyConflictRow) => ({
  publicId: row.public_id,
  destinationId: ctx.destinationId(row.workspace_id),
  workspaceId: row.workspace_id,
  remoteEventId: row.remote_event_id ?? `genesis-unidentified-${row.id}`,
  itemId: row.sync_item_id === null ? null : ctx.itemId(row.sync_item_id),
  evidence: "Historical payload retained in genesis row",
  kind: row.conflict_kind,
  ...(row.remote_id === null ? {} : { remoteId: row.remote_id }),
  ...(row.local_rel_path === null ? {} : { path: row.local_rel_path }),
  reviewed: row.resolution_status === "reviewed",
});
const importConflicts = Effect.fnUntraced(function* (ctx: GenesisContext) {
  const conflicts = yield* V.SyncConflict;
  for (const row of ctx.snapshot.conflicts) {
    const record = yield* S.decodeUnknownEffect(V.ConflictRecord)(conflictRecordInput(ctx, row));
    const options = yield* ctx.meta("conflict", row.public_id);
    const command = V.ImportConflictGenesis.make({ importId: ctx.importId, row, record });
    yield* conflicts
      .send(V.ConflictId.make(row.public_id), command, options)
      .pipe(Effect.provideService(V.GenesisProvenance, options.provenance));
  }
});
const genesisContext = Effect.fnUntraced(function* (snapshot: SyncGenesisSnapshot, mirrorRootName: string) {
  const audit = yield* LegacySyncAudit;
  const encoded = yield* S.encodeEffect(S.fromJsonString(SyncGenesisSnapshot))(snapshot);
  const importId = `v1-${bytesToHex(sha256(new TextEncoder().encode(`${mirrorRootName}\n${encoded}`)))}`;
  const workspaces = workspaceRowsOf(snapshot);
  const destinationIds = yield* workspaces.pipe(H.keys, bindDestinations);
  const itemIds = A.reduce(snapshot.items, H.empty<number, V.ItemId>(), (ids, row) =>
    H.set(ids, row.id, V.ItemId.make(row.public_id))
  );
  const ctx: GenesisContext = {
    snapshot,
    importId,
    mirrorRootName,
    itemIds,
    // Every row's workspace is a key of workspaces, so its binding exists.
    destinationId: (workspaceId) => O.getOrThrow(H.get(destinationIds, workspaceId)),
    itemId: (numericId) =>
      H.get(itemIds, numericId).pipe(O.getOrElse(() => V.ItemId.make(`documents_sync_item_adangling${numericId}`))),
    meta: (table, publicId) =>
      Effect.map(audit.resolve(`genesis/${table}/${publicId}`, 0), (provenance) => ({
        commandId: `genesis/${importId}/${table}/${publicId}`,
        correlationId: importId,
        provenance: { principal: provenance.principal, source: provenance.source },
      })),
  };
  return { ctx, workspaces };
});

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
  yield* backupSyncTables(backupId);
  const snapshot = yield* readSnapshot();
  // All numeric mappings are seeded before any dependent event is sent.
  yield* seedIdentities(snapshot);
  const { ctx, workspaces } = yield* genesisContext(snapshot, mirrorRootName);
  yield* importDestinations(ctx, workspaces);
  yield* importCursors(ctx);
  yield* importItems(ctx);
  yield* importOperations(ctx);
  yield* importConflicts(ctx);
  return {
    importId: ctx.importId,
    items: snapshot.items.length,
    operations: snapshot.operations.length,
    conflicts: snapshot.conflicts.length,
    cursors: snapshot.cursors.length,
  };
});
