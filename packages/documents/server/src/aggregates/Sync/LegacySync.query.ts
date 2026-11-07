/**
 * Read-only queries over the four projected legacy vault-sync tables.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as DomainSyncConflict from "@beep/documents-domain/entities/SyncConflict";
import { fromSyncConflictRow, syncConflictTable } from "@beep/documents-tables/entities/SyncConflict";
import { fromSyncCursorRow, syncCursorTable } from "@beep/documents-tables/entities/SyncCursor";
import { fromSyncItemRow, syncItemTable } from "@beep/documents-tables/entities/SyncItem";
import { fromSyncOperationRow, syncOperationTable } from "@beep/documents-tables/entities/SyncOperation";
import { VaultSyncReadUnavailable } from "@beep/documents-use-cases/aggregates/Sync/server";
import { $DocumentsServerId } from "@beep/identity/packages";
import { PostgresDrizzle } from "@beep/postgres";
import { and, asc, eq } from "drizzle-orm";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import type * as DomainSyncCursor from "@beep/documents-domain/entities/SyncCursor";
import type * as DomainSyncItem from "@beep/documents-domain/entities/SyncItem";
import type * as DomainSyncOperation from "@beep/documents-domain/entities/SyncOperation";
import type * as Documents from "@beep/shared-domain/identity/Documents";
import type * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";

const $I = $DocumentsServerId.create("aggregates/Sync/LegacySync.query");
// The legacy tables only ever held the Box mirror.
const provider = "box";

const readUnavailable =
  (operation: string) =>
  <A2, E, R>(effect: Effect.Effect<A2, E, R>): Effect.Effect<A2, VaultSyncReadUnavailable, R> =>
    effect.pipe(
      Effect.tapError((cause) =>
        Effect.logWarning("vault-sync read model dropped driver failure").pipe(
          Effect.annotateLogs({ operation, cause })
        )
      ),
      Effect.mapError(() => VaultSyncReadUnavailable.make({ reason: `${operation} failed` }))
    );

/**
 * Read model over the projected legacy rows; it never writes.
 *
 * **Details**
 *
 * The alchemy projections are the only writer of these tables (D7, D15). The
 * reads keep the legacy decoders so every consumer sees the same entities and
 * D14 numeric ids it saw before the cutover.
 *
 * **Example** (Inspect the read model)
 *
 * ```ts
 * import { LegacySyncReadModel } from "@beep/documents-server/aggregates/Sync"
 *
 * void LegacySyncReadModel
 * ```
 *
 * @category queries
 * @since 0.0.0
 */
export class LegacySyncReadModel extends Context.Service<
  LegacySyncReadModel,
  {
    readonly items: (
      workspaceId: WorkspaceIdentity.WorkspaceId
    ) => Effect.Effect<ReadonlyArray<DomainSyncItem.SyncItem>, VaultSyncReadUnavailable>;
    readonly operationsByStatus: (
      workspaceId: WorkspaceIdentity.WorkspaceId,
      status: DomainSyncOperation.SyncOperationStatus
    ) => Effect.Effect<ReadonlyArray<DomainSyncOperation.SyncOperation>, VaultSyncReadUnavailable>;
    readonly openConflicts: (
      workspaceId: WorkspaceIdentity.WorkspaceId
    ) => Effect.Effect<ReadonlyArray<DomainSyncConflict.SyncConflict>, VaultSyncReadUnavailable>;
    readonly conflict: (
      id: Documents.SyncConflictId
    ) => Effect.Effect<O.Option<DomainSyncConflict.SyncConflict>, VaultSyncReadUnavailable>;
    readonly cursor: (
      workspaceId: WorkspaceIdentity.WorkspaceId
    ) => Effect.Effect<O.Option<DomainSyncCursor.SyncCursor>, VaultSyncReadUnavailable>;
  }
>()($I`LegacySyncReadModel`) {}

/**
 * Drizzle-backed {@link LegacySyncReadModel}; requires `PostgresDrizzle`.
 *
 * **Example** (Inspect the layer)
 *
 * ```ts
 * import { LegacySyncReadModelLive } from "@beep/documents-server/aggregates/Sync"
 *
 * void LegacySyncReadModelLive
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const LegacySyncReadModelLive = Layer.effect(
  LegacySyncReadModel,
  Effect.gen(function* () {
    const db = yield* PostgresDrizzle;
    return LegacySyncReadModel.of({
      items: Effect.fn($I`items`)(function* (workspaceId) {
        const rows = yield* db
          .select()
          .from(syncItemTable)
          .where(and(eq(syncItemTable.workspaceId, workspaceId), eq(syncItemTable.provider, provider)))
          .orderBy(asc(syncItemTable.id))
          .pipe(readUnavailable("list sync items"));
        return yield* Effect.fromResult(Result.all(A.map(rows, fromSyncItemRow))).pipe(
          readUnavailable("decode sync items")
        );
      }),
      operationsByStatus: Effect.fn($I`operationsByStatus`)(function* (workspaceId, status) {
        const rows = yield* db
          .select()
          .from(syncOperationTable)
          .where(
            and(
              eq(syncOperationTable.workspaceId, workspaceId),
              eq(syncOperationTable.provider, provider),
              eq(syncOperationTable.status, status)
            )
          )
          .orderBy(asc(syncOperationTable.id))
          .pipe(readUnavailable("list sync operations"));
        return yield* Effect.fromResult(Result.all(A.map(rows, fromSyncOperationRow))).pipe(
          readUnavailable("decode sync operations")
        );
      }),
      openConflicts: Effect.fn($I`openConflicts`)(function* (workspaceId) {
        const rows = yield* db
          .select()
          .from(syncConflictTable)
          .where(
            and(
              eq(syncConflictTable.workspaceId, workspaceId),
              eq(syncConflictTable.provider, provider),
              eq(syncConflictTable.resolutionStatus, DomainSyncConflict.SyncConflictResolution.Enum.open)
            )
          )
          .orderBy(asc(syncConflictTable.id))
          .pipe(readUnavailable("list open sync conflicts"));
        return yield* Effect.fromResult(Result.all(A.map(rows, fromSyncConflictRow))).pipe(
          readUnavailable("decode sync conflicts")
        );
      }),
      conflict: Effect.fn($I`conflict`)(function* (id) {
        const rows = yield* db
          .select()
          .from(syncConflictTable)
          .where(eq(syncConflictTable.id, id))
          .limit(1)
          .pipe(readUnavailable("select sync conflict"));
        return yield* O.match(A.head(rows), {
          onNone: () => Effect.succeedNone,
          onSome: (row) =>
            Effect.fromResult(fromSyncConflictRow(row)).pipe(readUnavailable("decode sync conflict"), Effect.asSome),
        });
      }),
      cursor: Effect.fn($I`cursor`)(function* (workspaceId) {
        const rows = yield* db
          .select()
          .from(syncCursorTable)
          .where(and(eq(syncCursorTable.workspaceId, workspaceId), eq(syncCursorTable.provider, provider)))
          .orderBy(asc(syncCursorTable.id))
          .limit(1)
          .pipe(readUnavailable("select sync cursor"));
        return yield* O.match(A.head(rows), {
          onNone: () => Effect.succeedNone,
          onSome: (row) =>
            Effect.fromResult(fromSyncCursorRow(row)).pipe(readUnavailable("decode sync cursor"), Effect.asSome),
        });
      }),
    });
  })
);
