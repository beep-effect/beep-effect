/**
 * Vault sync engine port served by the alchemy Model as the single writer.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as V from "@beep/documents-domain/aggregates/VaultSync";
import {
  DmsMirrorAvailability,
  VaultScanFailed,
  VaultSyncConflictNotFound,
  VaultSyncEngine,
  VaultSyncStatus,
  VaultSyncStatusInput,
  VaultSyncWriterUnavailable,
} from "@beep/documents-use-cases/aggregates/Sync/server";
import { BoxMirrorUnavailable, VaultSyncPass } from "@beep/documents-use-cases/aggregates/VaultSync";
import { $DocumentsServerId } from "@beep/identity/packages";
import { SystemPrincipal } from "@beep/shared-domain/entity/Principal";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Ref from "effect/Ref";
import * as Schedule from "effect/Schedule";
import * as S from "effect/Schema";
import * as Semaphore from "effect/Semaphore";
import * as Str from "effect/String";
import * as SqlClient from "effect/sql/SqlClient";
import { VaultSyncRoot } from "./BoxMirror.ts";
import { LegacySyncAudit } from "./LegacySync.projection.ts";
import { LegacySyncReadModel } from "./LegacySync.query.ts";
import { legacyProjectionsCaughtUp } from "./SyncAdmission.service.ts";
import { legacyBoxDestinationId } from "./SyncGenesis.service.ts";
import type * as DomainSyncItem from "@beep/documents-domain/entities/SyncItem";
import type * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";

const $I = $DocumentsServerId.create("aggregates/Sync/VaultSyncModel.service");

/**
 * Authoritative organization ownership of a workspace.
 *
 * **Details**
 *
 * The desktop sidecar hosts a single local organization; a multi-tenant host
 * resolves it from its workspace directory. Never infer it from legacy rows,
 * whose `org_id` was hard-coded.
 *
 * **Example** (Provide a single-organization owner)
 *
 * ```ts
 * import { VaultSyncOwnership } from "@beep/documents-server/aggregates/Sync"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 *
 * const ownership = Layer.succeed(VaultSyncOwnership, { orgOf: () => Effect.succeed(1) })
 * void ownership
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class VaultSyncOwnership extends Context.Service<
  VaultSyncOwnership,
  { readonly orgOf: (workspaceId: number) => Effect.Effect<number> }
>()($I`VaultSyncOwnership`) {}

/**
 * Box mirror root folder name shared by genesis naming and new destinations.
 *
 * **Example** (Provide the mirror root name)
 *
 * ```ts
 * import { VaultSyncMirrorRoot } from "@beep/documents-server/aggregates/Sync"
 * import * as Layer from "effect/Layer"
 *
 * const root = Layer.succeed(VaultSyncMirrorRoot, { name: "beep-vault" })
 * void root
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class VaultSyncMirrorRoot extends Context.Service<VaultSyncMirrorRoot, { readonly name: string }>()(
  $I`VaultSyncMirrorRoot`
) {}

const systemPrincipal = S.encodeEffect(S.fromJsonString(SystemPrincipal))(
  SystemPrincipal.make({ component: "Sync", kind: "System" })
).pipe(Effect.orDie);
const migrationPrincipal = S.encodeEffect(S.fromJsonString(SystemPrincipal))(
  SystemPrincipal.make({ component: "Migration", kind: "System" })
).pipe(Effect.orDie);

const EventProvenance = S.Array(S.Struct({ principal: S.NullOr(S.String), source_kind: S.NullOr(S.String) }));
const Ownership = S.Array(S.Struct({ workspace_id: S.Int }));

/**
 * Production {@link LegacySyncAudit}: provenance from the stored event row and
 * ownership from the owning destination.
 *
 * **Details**
 *
 * The principal and source columns come from the event the projection is
 * applying, falling back to the Sync system principal when a command carried
 * no request context. The workspace is the destination's; the organization is
 * {@link VaultSyncOwnership}'s. Genesis import streams resolve to the
 * Migration system principal and the workspace named in the stream.
 *
 * **Example** (Inspect the layer)
 *
 * ```ts
 * import { LegacySyncAuditLive } from "@beep/documents-server/aggregates/Sync"
 *
 * void LegacySyncAuditLive
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const LegacySyncAuditLive = Layer.effect(
  LegacySyncAudit,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const ownership = yield* VaultSyncOwnership;
    const fallback = yield* systemPrincipal;
    const migration = yield* migrationPrincipal;
    const genesisWorkspace = Effect.fnUntraced(function* (stream: string) {
      const workspaceId = pipe(Str.split(stream, "/"), A.get(2), O.flatMap(S.decodeUnknownOption(S.FiniteFromString)));
      const id = O.getOrElse(workspaceId, () => 0);
      const orgId = yield* ownership.orgOf(id);
      return { orgId, workspaceId: id, principal: migration, source: "System" };
    });
    const live = Effect.fnUntraced(function* (stream: string, seq: number) {
      const events = yield* sql`SELECT principal, source_kind FROM alchemy_aggregate_event
        WHERE model = 'VaultSync' AND aggregate || '/' || id = ${stream} AND seq = ${seq}`.pipe(
        Effect.flatMap(S.decodeUnknownEffect(EventProvenance))
      );
      const owner = yield* sql`WITH source AS (
          SELECT aggregate, id, state FROM alchemy_aggregate_instance
          WHERE model = 'VaultSync' AND aggregate || '/' || id = ${stream}),
        destination AS (
          SELECT CASE source.aggregate
            WHEN 'SyncDestination' THEN source.id
            WHEN 'SyncItem' THEN source.state -> 'observation' ->> 'destinationId'
            WHEN 'SyncOperation' THEN source.state -> 'input' ->> 'destinationId'
            ELSE source.state ->> 'destinationId' END AS id FROM source)
        SELECT (d.state ->> 'workspaceId')::int AS workspace_id FROM destination
        JOIN alchemy_aggregate_instance d
          ON d.model = 'VaultSync' AND d.aggregate = 'SyncDestination' AND d.id = destination.id`.pipe(
        Effect.flatMap(S.decodeUnknownEffect(Ownership))
      );
      const workspaceId = pipe(
        A.head(owner),
        O.map((row) => row.workspace_id),
        O.getOrElse(() => 0)
      );
      const orgId = yield* ownership.orgOf(workspaceId);
      const event = A.head(events);
      return {
        orgId,
        workspaceId,
        principal: pipe(
          event,
          O.flatMap((row) => O.fromNullOr(row.principal)),
          O.getOrElse(() => fallback)
        ),
        source: pipe(
          event,
          O.flatMap((row) => O.fromNullOr(row.source_kind)),
          O.getOrElse(() => "System")
        ),
      };
    });
    return LegacySyncAudit.of({
      resolve: Effect.fn("LegacySyncAudit.resolve")((stream, seq) =>
        (Str.startsWith("genesis/")(stream) ? genesisWorkspace(stream) : live(stream, seq)).pipe(
          // A projection cannot proceed without provenance; the driver redelivers after a defect.
          Effect.orDie
        )
      ),
    });
  })
);

/**
 * Durable registry of the authorized vault root per destination.
 *
 * **Details**
 *
 * `syncOnce` records the canonical root it received from the workspace
 * configuration before it starts a pass; a pass resumed after a restart reads
 * the same root. The root lives in SQL, never in events or workflow results.
 *
 * **Example** (Inspect the layer)
 *
 * ```ts
 * import { VaultSyncRootRegistryLive } from "@beep/documents-server/aggregates/Sync"
 *
 * void VaultSyncRootRegistryLive
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const VaultSyncRootRegistryLive = Layer.effect(
  VaultSyncRoot,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`CREATE TABLE IF NOT EXISTS documents_sync_destination_root (
      destination_id text PRIMARY KEY, workspace_id integer NOT NULL, root_path text NOT NULL)`.pipe(Effect.orDie);
    const Roots = S.Array(S.Struct({ root_path: S.String }));
    return VaultSyncRoot.of({
      resolve: Effect.fn($I`resolveRoot`)(function* (destinationId) {
        const rows = yield* sql`SELECT root_path FROM documents_sync_destination_root
          WHERE destination_id = ${destinationId}`.pipe(Effect.flatMap(S.decodeUnknownEffect(Roots)), Effect.orDie);
        return yield* pipe(
          A.head(rows),
          O.map((row) => row.root_path),
          Effect.fromOption,
          Effect.mapError(() =>
            BoxMirrorUnavailable.make({ retryable: false, disconnectReason: null, operation: "local-root" })
          )
        );
      }),
    });
  })
);

const healOperationId = (conflictPublicId: string) =>
  V.OperationId.make(
    `documents_sync_operation_a${bytesToHex(sha256(new TextEncoder().encode(`review/${conflictPublicId}`)))}`
  );

/**
 * Builds the {@link VaultSyncEngine} port over the Model and the projected tables.
 *
 * **Details**
 *
 * The RPC surface is unchanged. `syncOnce` registers the workspace's legacy
 * Box destination on first use, records the canonical vault root and runs one
 * durable `VaultSyncPass`; reads come from {@link LegacySyncReadModel}. A
 * numeric conflict id resolves through its projected D14 row to the public
 * conflict stream, which is reviewed with the `ReviewConflict` command.
 * Passes and reviews of one workspace are serialized in this process; the
 * saga's own fences guard cross-process overlap.
 *
 * **Example** (Inspect the constructor)
 *
 * ```ts
 * import { makeVaultSyncModelEngine } from "@beep/documents-server/aggregates/Sync"
 *
 * void makeVaultSyncModelEngine
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeVaultSyncModelEngine = Effect.fn($I`makeVaultSyncModelEngine`)(function* () {
  const fs = yield* FileSystem.FileSystem;
  const sql = yield* SqlClient.SqlClient;
  const availability = yield* DmsMirrorAvailability;
  const reads = yield* LegacySyncReadModel;
  const destinations = yield* V.SyncDestination;
  const conflicts = yield* V.SyncConflict;
  const passes = yield* VaultSyncPass;
  const ownership = yield* VaultSyncOwnership;
  const mirrorRoot = yield* VaultSyncMirrorRoot;
  const passCounter = yield* Ref.make(0);
  const locks = yield* Ref.make(HashMap.empty<WorkspaceIdentity.WorkspaceId, Semaphore.Semaphore>());
  const lockFor = (workspaceId: WorkspaceIdentity.WorkspaceId) =>
    Ref.modify(locks, (current) =>
      O.match(HashMap.get(current, workspaceId), {
        onSome: (existing) => [existing, current] as const,
        onNone: () => {
          const created = Semaphore.makeUnsafe(1);
          return [created, HashMap.set(current, workspaceId, created)] as const;
        },
      })
    );
  const writerUnavailable = (reason: string) => () => VaultSyncWriterUnavailable.make({ reason });

  const readStatus = Effect.fn($I`status`)(function* (input: VaultSyncStatusInput) {
    const items = yield* reads.items(input.workspaceId);
    const queued = yield* reads.operationsByStatus(input.workspaceId, "queued");
    const failed = yield* reads.operationsByStatus(input.workspaceId, "failed");
    const open = yield* reads.openConflicts(input.workspaceId);
    const cursor = yield* reads.cursor(input.workspaceId);
    const probe = yield* input.forceProbe ? availability.refresh : availability.probe;
    const countItemsIn = (state: DomainSyncItem.SyncItemState) =>
      S.Natural.make(A.length(A.filter(items, (item) => item.syncState === state)));
    return VaultSyncStatus.make({
      conflictItems: countItemsIn("conflict"),
      connected: probe.connected,
      disconnectReason: probe.disconnectReason,
      currentItems: countItemsIn("current"),
      cursorPosition: O.map(cursor, (current) => current.streamPosition),
      errorItems: countItemsIn("error"),
      failedOperations: S.Natural.make(A.length(failed)),
      openConflicts: S.Natural.make(A.length(open)),
      pendingItems: countItemsIn("pending"),
      probedAt: probe.probedAt,
      provider: probe.provider,
      queuedOperations: S.Natural.make(A.length(queued)),
    });
  });

  const ensureDestination = Effect.fnUntraced(function* (workspaceId: WorkspaceIdentity.WorkspaceId) {
    const destinationId = legacyBoxDestinationId(workspaceId);
    const state = yield* destinations.state(destinationId).pipe(Effect.mapError(writerUnavailable("destination")));
    if (state._tag === "Registered") return destinationId;
    const orgId = yield* ownership.orgOf(workspaceId);
    yield* destinations
      .send(
        destinationId,
        V.RegisterDestination.make({ orgId, workspaceId, name: `${mirrorRoot.name} (${workspaceId})` }),
        { commandId: `register/${destinationId}` }
      )
      .pipe(Effect.mapError(writerUnavailable("register destination")));
    return destinationId;
  });

  return VaultSyncEngine.of({
    status: readStatus,
    listOpenConflicts: Effect.fn($I`listOpenConflicts`)(function* (input) {
      return yield* reads.openConflicts(input.workspaceId);
    }),
    syncOnce: Effect.fn($I`syncOnce`)(function* (input) {
      const lock = yield* lockFor(input.workspaceId);
      return yield* lock.withPermit(
        Effect.gen(function* () {
          const root = yield* fs
            .realPath(input.vaultRootPath)
            .pipe(
              Effect.mapError(() =>
                VaultScanFailed.make({ reason: `vault sync could not resolve vault root ${input.vaultRootPath}` })
              )
            );
          const destinationId = yield* ensureDestination(input.workspaceId);
          yield* sql`INSERT INTO documents_sync_destination_root (destination_id, workspace_id, root_path)
            VALUES (${destinationId}, ${input.workspaceId}, ${root})
            ON CONFLICT (destination_id) DO UPDATE SET root_path = EXCLUDED.root_path`.pipe(
            Effect.mapError(writerUnavailable("record vault root"))
          );
          const at = yield* Clock.currentTimeMillis;
          const ordinal = yield* Ref.updateAndGet(passCounter, (n) => n + 1);
          const run = yield* passes
            .start(`${destinationId}/pass/${at}-${ordinal}`, { destinationId })
            .pipe(Effect.mapError(writerUnavailable("start pass")));
          const result = yield* run.result.pipe(Effect.mapError(writerUnavailable("pass did not complete")));
          yield* Effect.logInfo("vault sync pass completed").pipe(
            Effect.annotateLogs({ operations: result.operationsSucceeded, conflicts: result.conflicts })
          );
          // Projections apply the pass asynchronously; report the status the pass produced.
          yield* legacyProjectionsCaughtUp("VaultSync").pipe(
            Effect.repeat({ until: (done) => done, schedule: Schedule.spaced(Duration.millis(25)) }),
            Effect.timeoutOption(Duration.seconds(30)),
            Effect.mapError(writerUnavailable("read projection progress")),
            Effect.provideService(SqlClient.SqlClient, sql)
          );
          return yield* readStatus(VaultSyncStatusInput.make({ workspaceId: input.workspaceId }));
        })
      );
    }),
    markConflictReviewed: Effect.fn($I`markConflictReviewed`)(function* (input) {
      const lock = yield* lockFor(input.workspaceId);
      return yield* lock.withPermit(
        Effect.gen(function* () {
          const notFound = VaultSyncConflictNotFound.make({ conflictId: input.conflictId });
          const row = yield* reads.conflict(input.conflictId);
          // Reviews are workspace-scoped: another workspace's id is indistinguishable from a missing one.
          const conflict = yield* pipe(
            row,
            O.filter((c) => c.workspaceId === input.workspaceId && c.resolutionStatus === "open"),
            Effect.fromOption,
            Effect.mapError(() => notFound)
          );
          const conflictId = V.ConflictId.make(conflict.publicId);
          const record = yield* conflicts.state(conflictId).pipe(Effect.mapError(writerUnavailable("conflict")));
          const stored = yield* Effect.fromOption(O.fromNullOr(record)).pipe(Effect.mapError(() => notFound));
          yield* conflicts
            .send(
              conflictId,
              V.ReviewConflict.make({
                remoteEventId: stored.remoteEventId,
                workspaceId: stored.workspaceId,
                destinationId: stored.destinationId,
                correction: null,
                healOperationId: healOperationId(conflict.publicId),
              }),
              { commandId: `review/${conflict.publicId}` }
            )
            .pipe(
              Effect.catchTag("SyncRuleViolation", () => Effect.fail(notFound)),
              Effect.mapError((error) =>
                error._tag === "VaultSyncConflictNotFound"
                  ? error
                  : VaultSyncWriterUnavailable.make({ reason: "review" })
              )
            );
          const reviewed = yield* reads.conflict(input.conflictId).pipe(
            Effect.repeat({
              until: (current) => O.exists(current, (c) => c.resolutionStatus === "reviewed"),
              schedule: Schedule.spaced(Duration.millis(25)),
            }),
            Effect.timeoutOrElse({
              duration: Duration.seconds(30),
              orElse: () => Effect.fail(VaultSyncWriterUnavailable.make({ reason: "review projection timed out" })),
            })
          );
          return yield* Effect.fromOption(reviewed).pipe(Effect.mapError(() => notFound));
        })
      );
    }),
  });
});
