/**
 * Wire-compatible desktop vault-sync RPC handlers served through the authorized Api.
 * @packageDocumentation
 * @since 0.0.0
 */
import * as V from "@beep/documents-domain/aggregates/VaultSync";
import * as DomainSyncConflict from "@beep/documents-domain/entities/SyncConflict";
import { DmsMirrorAvailability, VaultSyncStatus } from "@beep/documents-use-cases/aggregates/Sync/server";
import { VaultSyncActionError, VaultSyncRpcs } from "@beep/documents-use-cases/public";
import { $DocumentsServerId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as H from "effect/HashMap";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as P from "effect/Predicate";
import * as Random from "effect/Random";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { LegacySyncReadModel } from "./LegacySync.query.ts";
import { VaultSyncDeliveryClient } from "./VaultSyncApi.ts";
import type * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import type * as Headers from "effect/http/Headers";

const $I = $DocumentsServerId.create("aggregates/Sync/VaultSyncRpcs.api");
const BOX = "box" as const;
const CONFLICT_PREFIX = "documents_sync_conflict_";
const OPERATION_PREFIX = "documents_sync_operation_";

/**
 * The organization the desktop compatibility RPCs address; workspace ids come from the payload.
 *
 * **Example** (Bind the desktop organization)
 * ```ts
 * import { VaultSyncRpcOrganization } from "@beep/documents-server/aggregates/Sync";
 * import * as Layer from "effect/Layer";
 * const layer = Layer.succeed(VaultSyncRpcOrganization, { orgId: 1 });
 * void layer;
 * ```
 * @category services
 * @since 0.0.0
 */
export class VaultSyncRpcOrganization extends Context.Service<VaultSyncRpcOrganization, { readonly orgId: number }>()(
  $I`VaultSyncRpcOrganization`
) {}

const valuesOf = <K, A>(map: H.HashMap<K, A> | null): ReadonlyArray<A> =>
  map === null ? [] : map.pipe(H.values, A.fromIterable);
const keysOf = <K, A>(map: H.HashMap<K, A> | null): ReadonlyArray<K> =>
  map === null ? [] : map.pipe(H.keys, A.fromIterable);

const counts = (status: {
  readonly items: H.HashMap<V.ItemId, V.ItemState>;
  readonly operations: H.HashMap<V.OperationId, V.OperationState>;
}) => {
  const items = valuesOf(status.items);
  const operations = valuesOf(status.operations);
  const itemsIn = (wanted: V.ItemStatus) =>
    S.Natural.make(A.length(A.filter(items, (item) => item !== null && item.status === wanted)));
  const operationsIn = (wanted: ReadonlyArray<V.OperationStatus>) =>
    S.Natural.make(A.length(A.filter(operations, (op) => op !== null && A.contains(wanted, op.status))));
  return {
    conflictItems: itemsIn("drifted"),
    currentItems: itemsIn("synced"),
    errorItems: itemsIn("error"),
    pendingItems: itemsIn("pending"),
    failedOperations: operationsIn(["failed"]),
    queuedOperations: operationsIn(["queued", "leased", "retrying"]),
  };
};

/**
 * VaultSyncRpcs implemented as a client of the vault-sync Api, keeping the legacy wire.
 *
 * **Details**
 *
 * Every call runs Session against the caller's headers, so the desktop RPC surface obeys the
 * same live membership policy as HTTP, CLI and MCP. TriggerVaultSync and forceProbe record
 * durable requests and answer with the status at acceptance; the pass itself runs in its saga.
 * Conflict rows come from the legacy read model the slice projects, restricted to the public
 * ids the authorized OpenConflicts View returns. Nothing here writes the legacy tables.
 *
 * **Example** (Inspect the handler layer)
 * ```ts
 * import { VaultSyncRpcsApiLive } from "@beep/documents-server/aggregates/Sync";
 * import * as Layer from "effect/Layer";
 * console.log(Layer.isLayer(VaultSyncRpcsApiLive));
 * ```
 * @category layers
 * @since 0.0.0
 */
export const VaultSyncRpcsApiLive = VaultSyncRpcs.toLayer(
  Effect.gen(function* () {
    const client = yield* VaultSyncDeliveryClient;
    const { orgId } = yield* VaultSyncRpcOrganization;
    const availability = yield* DmsMirrorAvailability;
    const legacyConflicts = yield* LegacySyncReadModel;
    const denied = (context: string) => VaultSyncActionError.failEffect(context);
    // Only the failure tag is logged: denials and driver errors never cross the legacy wire.
    const dropped = (context: string) => (error: unknown) =>
      Effect.logWarning("vault sync rpc dropped failure").pipe(
        Effect.annotateLogs({
          context,
          reason: P.hasProperty(error, "_tag") ? `${error._tag}` : "unknown",
          subsystem: "vault_sync",
        }),
        Effect.andThen(denied(context))
      );
    const destinationOf = Effect.fn("VaultSyncRpcsApi.destination")(function* (
      workspaceId: number,
      headers: Headers.Input
    ) {
      const list = yield* client.DestinationList.get(V.WorkspaceKey.make(`${orgId}:${workspaceId}`), { headers }).pipe(
        Effect.catch(() => denied("Vault sync is unavailable for this workspace."))
      );
      // Genesis creates one destination per workspace and provider; pick it deterministically.
      const first = A.head(A.sort(keysOf(list), Order.String));
      return yield* O.match(first, {
        onNone: () => denied("Workspace vault is not configured."),
        onSome: Effect.succeed,
      });
    });
    const requestId = Effect.gen(function* () {
      const at = yield* Clock.currentTimeMillis;
      const n = yield* Random.nextInt;
      return `${at}-${n}`;
    });
    const status = Effect.fn("VaultSyncRpcsApi.status")(function* (
      destinationId: V.DestinationId,
      headers: Headers.Input,
      refresh: boolean
    ) {
      const view = yield* client.VaultSyncStatus.get(destinationId, { headers });
      const open = yield* client.OpenConflicts.get(destinationId, { headers });
      const probe = yield* refresh ? availability.refresh : availability.probe;
      const state = view ?? { destination: { _tag: "Unregistered" as const }, items: H.empty(), operations: H.empty() };
      return VaultSyncStatus.make({
        ...counts(state),
        connected: probe.connected,
        disconnectReason: probe.disconnectReason,
        cursorPosition: state.destination._tag === "Registered" ? O.fromNullOr(state.destination.cursor) : O.none(),
        openConflicts: S.Natural.make(A.length(valuesOf(open))),
        probedAt: probe.probedAt,
        provider: BOX,
      });
    });
    const openRows = Effect.fn("VaultSyncRpcsApi.openRows")(function* (
      workspaceId: WorkspaceIdentity.WorkspaceId,
      headers: Headers.Input
    ) {
      const destinationId = yield* destinationOf(workspaceId, headers);
      const open = yield* client.OpenConflicts.get(destinationId, { headers });
      const records = valuesOf(open);
      const rows = yield* legacyConflicts.openConflicts(workspaceId);
      return A.flatMap(rows, (row) =>
        O.match(
          A.findFirst(records, (record) => `${record.publicId}` === `${row.publicId}`),
          {
            onNone: () => [],
            onSome: (record) => [{ row, record }],
          }
        )
      );
    });
    return VaultSyncRpcs.of({
      TriggerVaultSync: Effect.fn("VaultSyncRpcsApi.trigger")(
        function* ({ workspaceId }, { headers }) {
          const destinationId = yield* destinationOf(workspaceId, headers);
          const id = yield* requestId;
          yield* client.RequestVaultSync(destinationId, { requestId: id }, { headers });
          return yield* status(destinationId, headers, false);
        },
        Effect.catch(dropped("TriggerVaultSync"))
      ),
      GetVaultSyncStatus: Effect.fn("VaultSyncRpcsApi.getStatus")(
        function* ({ forceProbe, workspaceId }, { headers }) {
          const destinationId = yield* destinationOf(workspaceId, headers);
          if (forceProbe) {
            const id = yield* requestId;
            yield* client.ProbeDestination(destinationId, { requestId: id }, { headers });
          }
          return yield* status(destinationId, headers, forceProbe);
        },
        Effect.catch(dropped("GetVaultSyncStatus"))
      ),
      ListVaultSyncConflicts: Effect.fn("VaultSyncRpcsApi.listConflicts")(
        function* ({ workspaceId }, { headers }) {
          const pairs = yield* openRows(workspaceId, headers);
          return A.map(pairs, ({ row }) => row);
        },
        Effect.catch(dropped("ListVaultSyncConflicts"))
      ),
      MarkVaultSyncConflictReviewed: Effect.fn("VaultSyncRpcsApi.review")(
        function* ({ conflictId, workspaceId }, { headers }) {
          const pairs = yield* openRows(workspaceId, headers);
          const { row, record } = yield* Effect.fromOption(A.findFirst(pairs, ({ row }) => row.id === conflictId));
          // One heal operation per conflict: a retried review reuses the same identity.
          const healOperationId = yield* S.decodeEffect(V.OperationId)(
            Str.replace(CONFLICT_PREFIX, OPERATION_PREFIX)(record.publicId)
          );
          yield* client.ReviewConflict(
            record.publicId,
            {
              remoteEventId: record.remoteEventId,
              workspaceId: record.workspaceId,
              destinationId: record.destinationId,
              correction: null,
              healOperationId,
            },
            { headers }
          );
          return DomainSyncConflict.SyncConflict.make({ ...row, resolutionStatus: "reviewed" });
        },
        Effect.catch(dropped("MarkVaultSyncConflictReviewed"))
      ),
    });
  })
);
