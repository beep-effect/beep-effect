/**
 * Durable pass activities over aggregate commands and the Box external system.
 * @packageDocumentation
 * @since 0.0.0
 */

import * as V from "@beep/documents-domain/aggregates/VaultSync";
import { DmsEventType } from "@beep/documents-use-cases/aggregates/Sync/server";
import { BoxMirror, VaultSyncPass } from "@beep/documents-use-cases/aggregates/VaultSync";
import { $DocumentsServerId } from "@beep/identity/packages";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as H from "effect/HashMap";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as Result from "effect/Result";
import * as Schedule from "effect/Schedule";
import * as S from "effect/Schema";
import * as Activity from "effect/workflow/Activity";
import { VaultSyncRoot } from "./BoxMirror.ts";
import { EchoClass, echoClassForEvent, echoClassForOperation } from "./VaultPush.model.ts";
import { makeVaultSyncFileStore } from "./VaultSync.file-store.ts";
import type * as WorkflowEngine from "effect/workflow/WorkflowEngine";

const $I = $DocumentsServerId.create("aggregates/Sync/VaultSyncPass.saga-handlers");
const stable = (value: string) => bytesToHex(sha256(new TextEncoder().encode(value)));
const Echo = S.Struct({
  remoteId: V.RemoteItemId,
  kind: EchoClass,
  name: S.String,
  parentRemoteId: S.NullOr(V.RemoteItemId),
}).pipe($I.annoteSchema("PassEcho", { description: "One consumable same-pass remote echo token." }));
/**
 * Fault-injection boundary used by restart tests; production leaves it idle.
 *
 * **Example** (Inspect checkpoint reference)
 * ```ts
 * import { VaultSyncCheckpoint } from "@beep/documents-server/aggregates/Sync";
 * console.log(VaultSyncCheckpoint.key);
 * ```
 * @category testing
 * @since 0.0.0
 */
export const VaultSyncCheckpoint = Context.Reference<(phase: string) => Effect.Effect<void>>($I`VaultSyncCheckpoint`, {
  defaultValue: () => () => Effect.void,
});
/**
 * Hosts pass activities on the ambient workflow engine supplied by AlchemyPostgres.
 *
 * **Details**
 * Every command uses a deterministic receipt id. Each Box acknowledgement is
 * committed on the item before operation success. Receipt storage closes the
 * Box-response/activity-result crash window without blind remote retries.
 *
 * **Example** (Inspect hosting layer)
 * ```ts
 * import { VaultSyncPassLive } from "@beep/documents-server/aggregates/Sync";
 * import * as Layer from "effect/Layer";
 * console.log(Layer.isLayer(VaultSyncPassLive));
 * ```
 * @category workflows
 * @since 0.0.0
 */
export const VaultSyncPassLive = VaultSyncPass.toLayer<
  never,
  | import("@alchemy.run/domain/Aggregate").Key<
      "SyncDestination" | "SyncItem" | "SyncOperation" | "ConflictEventRegistry"
    >
  | import("@alchemy.run/domain/ExternalSystem").Identifier<typeof BoxMirror>
  | VaultSyncRoot
  | FileSystem.FileSystem
  | Path.Path,
  WorkflowEngine.WorkflowEngine | WorkflowEngine.WorkflowInstance
>(
  Effect.gen(function* () {
    const destinations = yield* V.SyncDestination;
    const items = yield* V.SyncItem;
    const operations = yield* V.SyncOperation;
    const registry = yield* V.ConflictEventRegistry;
    const mirror = yield* BoxMirror;
    const roots = yield* VaultSyncRoot;
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const files = yield* makeVaultSyncFileStore();
    const checkpoint = yield* VaultSyncCheckpoint;

    return Effect.fn("Documents.VaultSyncPass")(function* ({
      key,
      destinationId,
    }: {
      readonly key: string;
      readonly destinationId: V.DestinationId;
    }): Effect.fn.Return<
      { readonly operationsSucceeded: number; readonly conflicts: number },
      never,
      WorkflowEngine.WorkflowEngine | WorkflowEngine.WorkflowInstance
    > {
      const options = (step: string) => ({ commandId: `${key}/${step}` });
      yield* Activity.make({
        name: "probe",
        execute: Effect.gen(function* () {
          const destination = yield* destinations.state(destinationId);
          if (destination._tag !== "Registered" || destination.paused) return;
          const root = yield* mirror.resolveRoot({ destinationId, name: destination.name });
          yield* destinations.send(
            destinationId,
            V.ResolveDestinationRoot.make({ rootId: root.remoteId }),
            options("root")
          );
        }).pipe(Effect.orDie),
      });
      yield* Activity.make({
        name: "scan",
        execute: Effect.gen(function* () {
          const destination = yield* destinations.state(destinationId);
          if (destination._tag !== "Registered" || destination.paused) return;
          const configured = yield* roots.resolve(destinationId);
          const root = yield* fs.realPath(configured);
          const scan = yield* files.scan(root);
          const observed = [
            ...A.map(scan.folders, (folder) => ({
              path: folder.relPath,
              kind: V.SyncItemKind.Enum.folder,
              digest: null,
              contentSizeBytes: 0,
            })),
            ...A.map(scan.files, (file) => ({
              path: file.relPath,
              kind: V.SyncItemKind.Enum.file,
              digest: file.digest,
              contentSizeBytes: file.sizeBytes,
            })),
          ];
          for (const entry of observed) {
            const itemId = O.getOrElse(H.get(destination.paths, entry.path), () =>
              V.ItemId.make(`documents_sync_item_a${stable(`${destinationId}/${entry.path}`)}`)
            );
            const current = yield* items.state(itemId);
            if (
              current !== null &&
              current.observation.kind === entry.kind &&
              current.observation.digest === entry.digest
            )
              continue;
            const generation = (current?.observation.generation ?? 0) + 1;
            const type: V.OperationType =
              entry.kind === "folder"
                ? "ensureFolder"
                : current !== null && current.remoteId !== null
                  ? "uploadFileVersion"
                  : "uploadFile";
            const operationId = O.getOrElse(
              current === null ? O.none<V.OperationId>() : H.get(current.slots, type),
              () => V.OperationId.make(`documents_sync_operation_a${stable(`${itemId}/${generation}/${type}`)}`)
            );
            yield* destinations.send(
              destinationId,
              V.ClaimItemPath.make({ path: entry.path, itemId }),
              options(`claim/${entry.path}`)
            );
            const observation = {
              destinationId,
              workspaceId: destination.workspaceId,
              path: entry.path,
              kind: entry.kind,
              digest: entry.digest,
              ...(entry.kind === "file" ? { contentSizeBytes: entry.contentSizeBytes } : {}),
              generation,
              operationId,
              type,
              parentRequired: path.dirname(entry.path) !== ".",
            };
            yield* items.send(itemId, V.ObserveItem.make({ observation }), options(`observe/${itemId}`));
          }
        }).pipe(Effect.orDie),
      });
      const plan = yield* Activity.make({
        name: "pump-plan",
        success: S.Array(S.Struct({ itemId: V.ItemId, operationId: V.OperationId })),
        execute: Effect.gen(function* () {
          const destination = yield* destinations.state(destinationId);
          const planned: Array<{ readonly itemId: V.ItemId; readonly operationId: V.OperationId }> = [];
          if (destination._tag !== "Registered" || destination.paused) return planned;
          const ordered = A.sort(
            A.fromIterable(destination.paths),
            Order.mapInput(Order.String, ([p]: readonly [V.VaultRelPath, V.ItemId]) => p)
          );
          for (const kind of [V.SyncItemKind.Enum.folder, V.SyncItemKind.Enum.file]) {
            for (const [, itemId] of ordered) {
              const item = yield* items.state(itemId);
              if (item !== null && item.observation.kind === kind) {
                for (const [, operationId] of item.slots) planned.push({ itemId, operationId });
              }
            }
          }
          return planned;
        }),
      });
      const echoes: Array<typeof Echo.Type> = [];
      for (const { itemId, operationId } of plan) {
        const echo = yield* Activity.make({
          name: `pump/${operationId}`,
          success: S.NullOr(Echo),
          execute: Effect.gen(function* () {
            const destination = yield* destinations.state(destinationId);
            if (destination._tag !== "Registered" || destination.paused || destination.rootId === null) return null;
            const item = yield* items.state(itemId);
            let operation = yield* operations
              .state(operationId)
              .pipe(
                Effect.repeat({ until: (state) => state !== null, schedule: Schedule.spaced("10 millis") }),
                Effect.timeout("10 seconds"),
                Effect.orDie
              );
            if (item === null || operation === null) return null;
            const now = yield* Clock.currentTimeMillis;
            if (operation.status === "leased" && operation.holder === key && operation.expiresAt <= now) {
              yield* operations.send(
                operationId,
                V.ExpireLease.make({ attempt: operation.leaseEpoch }),
                options(`expire/${operationId}/${operation.leaseEpoch}`)
              );
              operation = yield* operations.state(operationId);
              if (operation === null) return null;
            }
            if (
              operation.status !== "queued" &&
              operation.status !== "succeeded" &&
              !(operation.status === "leased" && operation.holder === key)
            )
              return null;
            const input = operation.input;
            const parentPath = path.dirname(input.path);
            const parentItemId = H.get(destination.paths, V.VaultRelPath.make(parentPath === "." ? "_" : parentPath));
            const parentItem = O.isSome(parentItemId) ? yield* items.state(parentItemId.value) : null;
            const parentRemoteId = parentPath === "." ? destination.rootId : (parentItem?.remoteId ?? null);
            if (
              parentRemoteId === null ||
              (input.type !== "ensureFolder" && input.type !== "uploadFile" && item.remoteId === null)
            )
              return null;
            if (operation.status === "queued")
              yield* operations.send(
                operationId,
                V.LeaseOperation.make({
                  holder: key,
                  leaseMillis: 300000,
                  parentRemoteId,
                  itemRemoteId: item.remoteId,
                }),
                options(`lease/${operationId}/${operation.leaseEpoch + 1}`)
              );
            const leased = yield* operations.state(operationId);
            if (leased === null) return null;
            const common = { destinationId, operationId, passId: key, generation: input.generation };
            const call =
              input.type === "ensureFolder"
                ? mirror.ensureFolder({ ...common, path: input.path, parentRemoteId })
                : input.type === "uploadFile"
                  ? mirror.uploadFile({ ...common, path: input.path, digest: input.digest ?? "", parentRemoteId })
                  : input.type === "uploadFileVersion" && item.remoteId !== null
                    ? mirror.uploadFileVersion({
                        ...common,
                        path: input.path,
                        digest: input.digest ?? "",
                        remoteId: item.remoteId,
                      })
                    : input.type === "moveItem" && item.remoteId !== null
                      ? mirror.moveItem({
                          ...common,
                          remoteId: item.remoteId,
                          itemKind: item.observation.kind,
                          parentRemoteId,
                        })
                      : item.remoteId !== null
                        ? mirror.renameItem({
                            ...common,
                            remoteId: item.remoteId,
                            itemKind: item.observation.kind,
                            name: path.basename(input.path),
                          })
                        : Effect.die("remote-id gate");
            const result = yield* Effect.result(call);
            if (Result.isFailure(result)) {
              yield* operations.send(
                operationId,
                V.FailOperation.make({
                  holder: key,
                  attempt: leased.leaseEpoch,
                  retryable: result.failure.retryable,
                  maxAttempts: 3,
                  backoffMillis: 1000,
                  reason: result.failure.operation,
                }),
                options(`failure/${operationId}`)
              );
              return null;
            }
            const receipt = result.success;
            if (operation.status !== "succeeded") {
              yield* items.send(
                itemId,
                V.MarkItemPushed.make({
                  remoteId: receipt.remoteId,
                  remoteName: receipt.name,
                  remoteParentId: receipt.parentRemoteId,
                  generation: input.generation,
                  operationId,
                }),
                options(`ack/${operationId}`)
              );
              yield* checkpoint("item-acknowledged");
              yield* operations.send(
                operationId,
                V.CompleteOperation.make({
                  holder: key,
                  attempt: leased.leaseEpoch,
                }),
                options(`complete/${operationId}/${leased.leaseEpoch}`)
              );
            }
            return {
              ...receipt,
              kind: echoClassForOperation(input.type === "ensureFolder" ? "createFolder" : input.type),
            };
          }).pipe(Effect.orDie),
        });
        if (echo !== null) echoes.push(echo);
      }
      yield* checkpoint("before-poll");
      const initialCursor = yield* Activity.make({
        name: "poll-start",
        success: S.NullOr(S.String),
        execute: Effect.map(destinations.state(destinationId), (state) =>
          state._tag === "Registered" ? state.cursor : null
        ),
      });
      const conflicts = yield* Activity.make({
        name: "poll",
        success: S.Int,
        execute: Effect.gen(function* () {
          const initialDestination = yield* destinations.state(destinationId);
          let destination: Extract<V.DestinationState, { readonly _tag: "Registered" }>;
          if (initialDestination._tag !== "Registered" || initialDestination.paused) return 0;
          destination = { ...initialDestination, cursor: initialCursor };
          let count = 0;
          let tokens = echoes;
          for (let pageIndex = 0; pageIndex < 100; pageIndex++) {
            const result = yield* Effect.result(mirror.pollEvents({ destinationId, position: destination.cursor }));
            if (Result.isFailure(result)) {
              yield* destinations.send(
                destinationId,
                V.RecordDestinationPoll.make({
                  position: null,
                  error: result.failure.operation,
                }),
                options(`poll-failed/${pageIndex}`)
              );
              break;
            }
            const page = result.success;
            for (const event of page.events) {
              if (event.remoteId === null) continue;
              const eventClass = S.is(DmsEventType)(event.kind) ? echoClassForEvent(event.kind) : O.none();
              const token = O.flatMap(eventClass, (kind) =>
                A.findFirstIndex(tokens, (echo) => echo.remoteId === event.remoteId && echo.kind === kind)
              );
              if (O.isSome(token)) {
                tokens = A.remove(tokens, token.value);
                continue;
              }
              if (
                event.kind !== "edited" &&
                A.some(
                  echoes,
                  (echo) =>
                    echo.remoteId === event.remoteId &&
                    echo.name === event.name &&
                    echo.parentRemoteId === (event.parentRemoteId === destination.rootId ? null : event.parentRemoteId)
                )
              )
                continue;
              let tracked: V.ItemId | null = null;
              let parentTracked = event.parentRemoteId === destination.rootId;
              for (const [, id] of destination.paths) {
                const item = yield* items.state(id);
                if (item?.remoteId === event.remoteId) tracked = id;
                if (item?.observation.kind === "folder" && item.remoteId === event.parentRemoteId) parentTracked = true;
              }
              if (tracked === null && !parentTracked) continue;
              const publicId = V.ConflictId.make(
                `documents_sync_conflict_a${stable(`${destinationId}/${event.remoteEventId}`)}`
              );
              yield* registry.send(
                destinationId,
                V.RecordConflict.make({
                  record: {
                    publicId,
                    destinationId,
                    workspaceId: destination.workspaceId,
                    remoteEventId: event.remoteEventId,
                    itemId: tracked,
                    evidence: event.evidence,
                    kind:
                      event.kind === "created"
                        ? "remoteCreate"
                        : event.kind === "edited"
                          ? "remoteEdit"
                          : event.kind === "moved"
                            ? "remoteMove"
                            : event.kind === "renamed"
                              ? "remoteRename"
                              : event.kind === "deleted"
                                ? "remoteDelete"
                                : "remoteUnknown",
                    remoteId: event.remoteId,
                    reviewed: false,
                  },
                }),
                options(`conflict/${event.remoteEventId}`)
              );
              if (tracked !== null)
                yield* items.send(tracked, V.FlagItemDrift.make({}), options(`drift/${event.remoteEventId}`));
              count++;
            }
            // Every classification command is durable before advancing this page.
            yield* destinations.send(
              destinationId,
              V.RecordDestinationPoll.make({
                position: page.position,
                ...O.getOrElse(
                  O.map(A.last(page.events), (event) => ({ lastEventId: event.remoteEventId })),
                  () => ({})
                ),
                error: null,
              }),
              options(`cursor/${pageIndex}`)
            );
            destination = { ...destination, cursor: page.position };
            if (A.isReadonlyArrayEmpty(page.events)) break;
          }
          return count;
        }).pipe(Effect.orDie),
      });
      return { operationsSucceeded: A.length(echoes), conflicts };
    });
  })
);
