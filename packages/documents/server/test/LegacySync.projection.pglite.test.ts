import * as NodeURL from "node:url";
import * as Domain from "@alchemy.run/domain";
import { AlchemyPostgresPlatform } from "@beep/alchemy-postgres";
import * as V from "@beep/documents-domain/aggregates/VaultSync";
import { LegacySyncAudit, LegacySyncProjections } from "@beep/documents-server/aggregates/Sync";
import {
  LegacySyncConflict,
  LegacySyncCursor,
  LegacySyncItem,
  LegacySyncOperation,
  VaultSyncModel,
} from "@beep/documents-use-cases/aggregates/VaultSync";
import { PgliteTestLayer } from "@beep/pglite/Pglite.test-layer";
import { BunServices } from "@effect/platform-bun";
import { describe, expect, layer } from "@effect/vitest";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Schedule from "effect/Schedule";
import * as Str from "effect/String";
import * as SqlClient from "effect/sql/SqlClient";

class ReadModels extends Domain.Model("ProjectionScenarios", {
  aggregates: VaultSyncModel.aggregates,
  views: VaultSyncModel.views,
  projections: [LegacySyncItem, LegacySyncOperation, LegacySyncConflict, LegacySyncCursor],
}) {}
const infrastructure = Layer.mergeAll(PgliteTestLayer, BunServices.layer);
describe("legacy sync SQL projections", () => {
  layer(infrastructure, { timeout: "30 seconds", excludeTestServices: true })("scenario", (it) => {
    it.effect("projects scenario events and preserves numeric references independently of public ids", () =>
      Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;
        const fs = yield* FileSystem.FileSystem;
        const ddl = yield* fs.readFileString(
          NodeURL.fileURLToPath(
            new URL("../../../_internal/db-admin/drizzle/20260813130540_baseline/migration.sql", import.meta.url)
          )
        );
        for (const statement of Str.split(ddl, "--> statement-breakpoint")) {
          if (Str.startsWith('CREATE TABLE "documents_sync_')(Str.trim(statement))) yield* sql.unsafe(statement);
        }
        const runtime = yield* Layer.build(
          ReadModels.layer(
            LegacySyncProjections.pipe(
              Layer.provide(
                Layer.succeed(LegacySyncAudit, {
                  resolve: Effect.fn("fixture.audit")(() =>
                    Effect.succeed({
                      orgId: 7,
                      workspaceId: 4,
                      principal: '{"_tag":"System"}',
                      source: "Application",
                    })
                  ),
                })
              )
            )
          ).pipe(Layer.provide(AlchemyPostgresPlatform.layer()))
        );
        const destinationId = V.DestinationId.make("documents_sync_destination_aprojection");
        const itemId = V.ItemId.make("documents_sync_item_a999");
        const operationId = V.OperationId.make("documents_sync_operation_a888");
        const conflictId = V.ConflictId.make("documents_sync_conflict_a777");
        const remoteId = V.RemoteItemId.make("box-file");
        const destinations = Context.get(runtime, V.SyncDestination);
        const items = Context.get(runtime, V.SyncItem);
        const operations = Context.get(runtime, V.SyncOperation);
        const conflicts = Context.get(runtime, V.SyncConflict);
        yield* destinations.send(
          destinationId,
          V.RegisterDestination.make({ orgId: 7, workspaceId: 4, name: "synthetic" })
        );
        const observation = {
          destinationId,
          workspaceId: 4,
          path: V.VaultRelPath.make("file.txt"),
          kind: V.SyncItemKind.Enum.file,
          digest: "digest",
          contentSizeBytes: 3,
          generation: 1,
          operationId,
          type: V.OperationType.Enum.uploadFile,
          parentRequired: false,
        };
        yield* items.send(itemId, V.ObserveItem.make({ observation }));
        yield* operations.send(
          operationId,
          V.QueueOperation.make({
            input: {
              destinationId,
              itemId,
              type: "uploadFile",
              path: observation.path,
              digest: "digest",
              generation: 1,
              parentRequired: false,
              idempotencyKey: operationId,
            },
          })
        );
        yield* operations.send(
          operationId,
          V.LeaseOperation.make({ holder: "scenario", leaseMillis: 30000, parentRemoteId: null, itemRemoteId: null })
        );
        const itemReceipt = yield* items.send(
          itemId,
          V.MarkItemPushed.make({
            operationId,
            generation: 1,
            remoteId,
            remoteName: "file.txt",
            remoteParentId: null,
          })
        );
        const opReceipt = yield* operations.send(
          operationId,
          V.CompleteOperation.make({ holder: "scenario", attempt: 1 })
        );
        const conflictReceipt = yield* conflicts.send(
          conflictId,
          V.ConfirmConflict.make({
            record: {
              publicId: conflictId,
              destinationId,
              workspaceId: 4,
              remoteEventId: "remote-event",
              itemId,
              remoteId,
              kind: "remoteEdit",
              path: observation.path,
              evidence: "synthetic remote edit",
              reviewed: false,
            },
          })
        );
        const cursorReceipt = yield* destinations.send(
          destinationId,
          V.RecordDestinationPoll.make({ position: "opaque-2", error: null, lastEventId: "remote-event" })
        );
        yield* LegacySyncItem.caughtUp(itemReceipt).pipe(Effect.provideContext(runtime));
        yield* LegacySyncOperation.caughtUp(opReceipt).pipe(Effect.provideContext(runtime));
        yield* LegacySyncConflict.caughtUp(conflictReceipt).pipe(Effect.provideContext(runtime));
        yield* LegacySyncCursor.caughtUp(cursorReceipt).pipe(Effect.provideContext(runtime));
        const itemRows = yield* sql`SELECT id, public_id, org_id, workspace_id, content_size_bytes,
        remote_id, remote_name, sync_state, last_pushed_digest, last_pushed_generation FROM documents_sync_item`.pipe(
          Effect.repeat({ until: (rows) => rows[0]?.sync_state === "current", schedule: Schedule.spaced("10 millis") }),
          Effect.timeout("10 seconds")
        );
        expect(itemRows).toEqual([
          {
            id: 1,
            public_id: itemId,
            org_id: 7,
            workspace_id: 4,
            content_size_bytes: 3,
            remote_id: remoteId,
            remote_name: "file.txt",
            sync_state: "current",
            last_pushed_digest: "digest",
            last_pushed_generation: 1,
          },
        ]);
        const operationRows =
          yield* sql`SELECT public_id, sync_item_id, status, attempt_count, operation_type FROM documents_sync_operation`.pipe(
            Effect.repeat({ until: (rows) => rows[0]?.status === "succeeded", schedule: Schedule.spaced("10 millis") }),
            Effect.timeout("10 seconds")
          );
        expect(operationRows).toEqual([
          {
            public_id: operationId,
            sync_item_id: 1,
            status: "succeeded",
            attempt_count: 1,
            operation_type: "uploadFile",
          },
        ]);
        const conflictRows =
          yield* sql`SELECT public_id, sync_item_id, conflict_kind, remote_id, remote_payload, resolution_status FROM documents_sync_conflict`;
        expect(conflictRows).toEqual([
          {
            public_id: conflictId,
            sync_item_id: 1,
            conflict_kind: "remoteEdit",
            remote_payload: { evidence: "synthetic remote edit" },
            remote_id: remoteId,
            resolution_status: "open",
          },
        ]);
        const cursorRows = yield* sql`SELECT stream_position, last_event_id, status FROM documents_sync_cursor`.pipe(
          Effect.repeat({
            until: (rows) => rows[0]?.stream_position === "opaque-2",
            schedule: Schedule.spaced("10 millis"),
          }),
          Effect.timeout("10 seconds")
        );
        expect(cursorRows).toEqual([{ stream_position: "opaque-2", last_event_id: "remote-event", status: "active" }]);
        const reviewedReceipt = yield* conflicts.send(
          conflictId,
          V.ConfirmConflictReview.make({
            remoteEventId: "remote-event",
            workspaceId: 4,
            destinationId,
          })
        );
        yield* LegacySyncConflict.caughtUp(reviewedReceipt).pipe(Effect.provideContext(runtime));
        const reviewedRows = yield* sql`SELECT resolution_status, sync_item_id FROM documents_sync_conflict`;
        expect(reviewedRows).toEqual([{ resolution_status: "reviewed", sync_item_id: 1 }]);
        yield* destinations.send(destinationId, V.RecordDestinationPoll.make({ position: null, error: "pollEvents" }));
        const cursorError = yield* sql`SELECT stream_position, status, last_error FROM documents_sync_cursor`.pipe(
          Effect.repeat({ until: (rows) => rows[0]?.status === "error", schedule: Schedule.spaced("10 millis") }),
          Effect.timeout("10 seconds")
        );
        expect(cursorError).toEqual([{ stream_position: "opaque-2", status: "error", last_error: "pollEvents" }]);
        const replacementId = V.OperationId.make("documents_sync_operation_areplacement");
        yield* items.send(
          itemId,
          V.ObserveItem.make({
            observation: V.ItemObservation.make({
              ...observation,
              kind: "folder",
              digest: null,
              generation: 2,
              operationId: replacementId,
              type: "ensureFolder",
            }),
          })
        );
        const replacementRows = yield* sql`SELECT item_kind, remote_id, remote_name, remote_parent_id,
          last_pushed_digest, last_pushed_generation FROM documents_sync_item`.pipe(
          Effect.repeat({ until: (rows) => rows[0]?.item_kind === "folder", schedule: Schedule.spaced("10 millis") }),
          Effect.timeout("10 seconds")
        );
        expect(replacementRows).toEqual([
          {
            item_kind: "folder",
            remote_id: null,
            remote_name: null,
            remote_parent_id: null,
            last_pushed_digest: null,
            last_pushed_generation: null,
          },
        ]);
        yield* operations.send(
          replacementId,
          V.QueueOperation.make({
            input: V.OperationInput.make({
              ...observation,
              itemId,
              generation: 2,
              type: "ensureFolder",
              digest: null,
              idempotencyKey: replacementId,
            }),
          })
        );
        yield* operations.send(
          replacementId,
          V.LeaseOperation.make({
            holder: "scenario",
            leaseMillis: 30000,
            itemRemoteId: null,
            parentRemoteId: null,
          })
        );
        const failed = yield* operations.send(
          replacementId,
          V.FailOperation.make({
            holder: "scenario",
            attempt: 1,
            retryable: false,
            maxAttempts: 3,
            backoffMillis: 1000,
            reason: "ensureFolder",
          })
        );
        yield* LegacySyncOperation.caughtUp(failed).pipe(Effect.provideContext(runtime));
        const failedRows = yield* sql`SELECT status, last_error, operation_type FROM documents_sync_operation
          WHERE public_id = ${replacementId}`.pipe(
          Effect.repeat({ until: (rows) => rows[0]?.status === "failed", schedule: Schedule.spaced("10 millis") }),
          Effect.timeout("10 seconds")
        );
        expect(failedRows).toEqual([{ status: "failed", last_error: "ensureFolder", operation_type: "createFolder" }]);
        const operationRow = sql`SELECT * FROM documents_sync_operation WHERE public_id = ${operationId}`;
        const before = yield* operationRow;
        // A repeated completion of an already-succeeded operation leaves its projection row byte-for-byte
        // stable: when the kernel accepts it, wait for the projection; when it rejects it, nothing is emitted.
        yield* operations
          .send(operationId, V.CompleteOperation.make({ holder: "scenario", attempt: 1 }), {
            commandId: "duplicate-success",
          })
          .pipe(
            Effect.flatMap((receipt) => LegacySyncOperation.caughtUp(receipt).pipe(Effect.provideContext(runtime))),
            Effect.ignore
          );
        const after = yield* operationRow;
        expect(before).toHaveLength(1);
        expect(after).toEqual(before);
      })
    );
  });
});
