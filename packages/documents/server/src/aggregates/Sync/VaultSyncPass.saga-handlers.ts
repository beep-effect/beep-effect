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
import type { BoxMirrorUnavailable } from "@beep/documents-use-cases/aggregates/VaultSync";
import type * as WorkflowEngine from "effect/workflow/WorkflowEngine";

const $I = $DocumentsServerId.create("aggregates/Sync/VaultSyncPass.saga-handlers");
const stable = (value: string) => bytesToHex(sha256(new TextEncoder().encode(value)));
const Echo = S.Struct({
  remoteId: V.RemoteItemId,
  kind: EchoClass,
  name: S.String,
  parentRemoteId: S.NullOr(V.RemoteItemId),
}).pipe($I.annoteSchema("PassEcho", { description: "One consumable same-pass remote echo token." }));
type Registered = Extract<V.DestinationState, { readonly _tag: "Registered" }>;
type Observed = {
  readonly path: V.VaultRelPath;
  readonly kind: V.SyncItemKind;
  readonly digest: string | null;
  readonly contentSizeBytes: number;
};
type Receipt = {
  readonly remoteId: V.RemoteItemId;
  readonly name: string;
  readonly parentRemoteId: V.RemoteItemId | null;
};
type RemoteEvent = {
  readonly remoteEventId: string;
  readonly remoteId: V.RemoteItemId | null;
  readonly name: string | null;
  readonly parentRemoteId: V.RemoteItemId | null;
  readonly kind: string;
  readonly evidence: string;
};
type Page = { readonly position: string; readonly events: ReadonlyArray<RemoteEvent> };
type ConflictKind = "remoteCreate" | "remoteEdit" | "remoteMove" | "remoteRename" | "remoteDelete" | "remoteUnknown";
const conflictKinds: Readonly<Record<string, ConflictKind>> = {
  created: "remoteCreate",
  edited: "remoteEdit",
  moved: "remoteMove",
  renamed: "remoteRename",
  deleted: "remoteDelete",
};
const conflictKindOf = (kind: string): ConflictKind => conflictKinds[kind] ?? "remoteUnknown";
const observedEntries = (scan: {
  readonly folders: ReadonlyArray<{ readonly relPath: V.VaultRelPath }>;
  readonly files: ReadonlyArray<{
    readonly relPath: V.VaultRelPath;
    readonly digest: string;
    readonly sizeBytes: number;
  }>;
}): ReadonlyArray<Observed> => [
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
const unchanged = (current: V.ItemState, entry: Observed) =>
  current !== null && current.observation.kind === entry.kind && current.observation.digest === entry.digest;
const observedOperationType = (entry: Observed, current: V.ItemState): V.OperationType => {
  if (entry.kind === "folder") return "ensureFolder";
  return current?.remoteId == null ? "uploadFile" : "uploadFileVersion";
};
const pumpable = (operation: V.OperationRecord, key: string) =>
  operation.status === "queued" ||
  operation.status === "succeeded" ||
  (operation.status === "leased" && operation.holder === key);
// Only create operations may run before the item has a remote id.
const remoteGateOpen = (input: V.OperationInput, item: V.ItemRecord) =>
  input.type === "ensureFolder" || input.type === "uploadFile" || item.remoteId !== null;
const echoTokenIndex = (tokens: ReadonlyArray<typeof Echo.Type>, event: RemoteEvent) =>
  O.flatMap(S.is(DmsEventType)(event.kind) ? echoClassForEvent(event.kind) : O.none(), (kind) =>
    A.findFirstIndex(tokens, (echo) => echo.remoteId === event.remoteId && echo.kind === kind)
  );
// Matching non-edit remote state is a duplicate echo of this pass's own push.
const duplicateEcho = (echoes: ReadonlyArray<typeof Echo.Type>, event: RemoteEvent, rootId: V.RemoteItemId | null) => {
  const parent = event.parentRemoteId === rootId ? null : event.parentRemoteId;
  return (
    event.kind !== "edited" &&
    A.some(
      echoes,
      (echo) => echo.remoteId === event.remoteId && echo.name === event.name && echo.parentRemoteId === parent
    )
  );
};
const lastEventIdOf = (events: ReadonlyArray<RemoteEvent>) =>
  O.getOrElse(
    O.map(A.last(events), (event) => ({ lastEventId: event.remoteEventId })),
    () => ({})
  );
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
      probeOnly,
    }: {
      readonly key: string;
      readonly destinationId: V.DestinationId;
      readonly probeOnly?: boolean;
    }): Effect.fn.Return<
      { readonly operationsSucceeded: number; readonly conflicts: number },
      never,
      WorkflowEngine.WorkflowEngine | WorkflowEngine.WorkflowInstance
    > {
      if (probeOnly === true) {
        yield* Activity.make({
          name: "refresh-probe",
          execute: mirror.probe({ destinationId }).pipe(Effect.orDie),
        });
        return { operationsSucceeded: 0, conflicts: 0 };
      }
      const options = (step: string) => ({ commandId: `${key}/${step}` });
      const active = Effect.map(destinations.state(destinationId), (state) =>
        O.liftPredicate(state, (s): s is Registered => s._tag === "Registered" && !s.paused)
      );
      const probe = Effect.fnUntraced(function* (destination: Registered) {
        // Genesis keeps the legacy mirror root folder name apart from the destination name.
        const root = yield* mirror.resolveRoot({ destinationId, name: destination.remoteRootName ?? destination.name });
        yield* destinations.send(
          destinationId,
          V.ResolveDestinationRoot.make({ rootId: root.remoteId }),
          options("root")
        );
      });
      const observeEntry = Effect.fnUntraced(function* (destination: Registered, entry: Observed) {
        const itemId = O.getOrElse(H.get(destination.paths, entry.path), () =>
          V.ItemId.make(`documents_sync_item_a${stable(`${destinationId}/${entry.path}`)}`)
        );
        const current = yield* items.state(itemId);
        if (unchanged(current, entry)) return;
        const generation = (current?.observation.generation ?? 0) + 1;
        const type = observedOperationType(entry, current);
        const operationId = O.getOrElse(current === null ? O.none<V.OperationId>() : H.get(current.slots, type), () =>
          V.OperationId.make(`documents_sync_operation_a${stable(`${itemId}/${generation}/${type}`)}`)
        );
        yield* destinations.send(
          destinationId,
          V.ClaimItemPath.make({ path: entry.path, itemId }),
          options(`claim/${itemId}`)
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
      });
      const scan = Effect.fnUntraced(function* (destination: Registered) {
        const configured = yield* roots.resolve(destinationId);
        const root = yield* fs.realPath(configured);
        const found = yield* files.scan(root);
        for (const entry of observedEntries(found)) yield* observeEntry(destination, entry);
      });
      const slotsOf = Effect.fnUntraced(function* (itemId: V.ItemId, kind: V.SyncItemKind) {
        const item = yield* items.state(itemId);
        if (item?.observation.kind !== kind) return [];
        return A.map(A.fromIterable(item.slots), ([, operationId]) => ({ itemId, operationId }));
      });
      const planPump = Effect.fnUntraced(function* (destination: Registered) {
        const planned: Array<{ readonly itemId: V.ItemId; readonly operationId: V.OperationId }> = [];
        const ordered = A.sort(
          A.fromIterable(destination.paths),
          Order.mapInput(Order.String, ([p]: readonly [V.VaultRelPath, V.ItemId]) => p)
        );
        for (const kind of [V.SyncItemKind.Enum.folder, V.SyncItemKind.Enum.file]) {
          for (const [, itemId] of ordered) {
            const slots = yield* slotsOf(itemId, kind);
            planned.push(...slots);
          }
        }
        return planned;
      });
      const awaitOperation = (operationId: V.OperationId) =>
        operations
          .state(operationId)
          .pipe(
            Effect.repeat({ until: (state) => state !== null, schedule: Schedule.spaced("10 millis") }),
            Effect.timeout("10 seconds"),
            Effect.orDie
          );
      // An expired lease held by this pass is expired so the next lease takes a new epoch.
      const recoverLease = Effect.fnUntraced(function* (operationId: V.OperationId, operation: V.OperationRecord) {
        const now = yield* Clock.currentTimeMillis;
        if (operation.status !== "leased" || operation.holder !== key || operation.expiresAt > now) return operation;
        yield* operations.send(
          operationId,
          V.ExpireLease.make({ attempt: operation.leaseEpoch }),
          options(`expire/${operationId}/${operation.leaseEpoch}`)
        );
        return yield* operations.state(operationId);
      });
      const parentRemoteIdOf = Effect.fnUntraced(function* (destination: Registered, relPath: V.VaultRelPath) {
        const parentPath = path.dirname(relPath);
        if (parentPath === ".") return destination.rootId;
        const parentItemId = H.get(destination.paths, V.VaultRelPath.make(parentPath));
        if (O.isNone(parentItemId)) return null;
        const parent = yield* items.state(parentItemId.value);
        return parent?.remoteId ?? null;
      });
      const mirrorCall = Effect.fnUntraced(function* (
        operationId: V.OperationId,
        input: V.OperationInput,
        item: V.ItemRecord,
        parentRemoteId: V.RemoteItemId
      ) {
        const common = { destinationId, operationId, passId: key, generation: input.generation };
        const digest = input.digest ?? "";
        if (input.type === "ensureFolder")
          return yield* mirror.ensureFolder({ ...common, path: input.path, parentRemoteId });
        if (input.type === "uploadFile")
          return yield* mirror.uploadFile({ ...common, path: input.path, digest, parentRemoteId });
        if (item.remoteId === null) return yield* Effect.die("remote-id gate");
        const remote = { ...common, remoteId: item.remoteId };
        if (input.type === "uploadFileVersion")
          return yield* mirror.uploadFileVersion({ ...remote, path: input.path, digest });
        const itemKind = item.observation.kind;
        return yield* input.type === "moveItem"
          ? mirror.moveItem({ ...remote, itemKind, parentRemoteId })
          : mirror.renameItem({ ...remote, itemKind, name: path.basename(input.path) });
      });
      const failOperation = (operationId: V.OperationId, attempt: number, failure: BoxMirrorUnavailable) =>
        operations.send(
          operationId,
          V.FailOperation.make({
            holder: key,
            attempt,
            retryable: failure.retryable,
            maxAttempts: 3,
            backoffMillis: 1000,
            reason: failure.operation,
          }),
          options(`failure/${operationId}`)
        );
      // The item acknowledgement commits before operation success.
      const acknowledge = Effect.fnUntraced(function* (
        itemId: V.ItemId,
        operationId: V.OperationId,
        generation: number,
        attempt: number,
        receipt: Receipt
      ) {
        yield* items.send(
          itemId,
          V.MarkItemPushed.make({
            remoteId: receipt.remoteId,
            remoteName: receipt.name,
            remoteParentId: receipt.parentRemoteId,
            generation,
            operationId,
          }),
          options(`ack/${operationId}`)
        );
        yield* checkpoint("item-acknowledged");
        yield* operations.send(
          operationId,
          V.CompleteOperation.make({ holder: key, attempt }),
          options(`complete/${operationId}/${attempt}`)
        );
      });
      const lease = (
        operationId: V.OperationId,
        operation: V.OperationRecord,
        item: V.ItemRecord,
        parent: V.RemoteItemId
      ) =>
        operation.status === "queued"
          ? operations.send(
              operationId,
              V.LeaseOperation.make({
                holder: key,
                leaseMillis: 300000,
                parentRemoteId: parent,
                itemRemoteId: item.remoteId,
              }),
              options(`lease/${operationId}/${operation.leaseEpoch + 1}`)
            )
          : Effect.void;
      const pushLeased = Effect.fnUntraced(function* (
        itemId: V.ItemId,
        operationId: V.OperationId,
        operation: V.OperationRecord,
        item: V.ItemRecord,
        parentRemoteId: V.RemoteItemId
      ) {
        yield* lease(operationId, operation, item, parentRemoteId);
        const leased = yield* operations.state(operationId);
        if (leased === null) return null;
        const input = operation.input;
        const result = yield* Effect.result(mirrorCall(operationId, input, item, parentRemoteId));
        if (Result.isFailure(result)) {
          yield* failOperation(operationId, leased.leaseEpoch, result.failure);
          return null;
        }
        if (operation.status !== "succeeded")
          yield* acknowledge(itemId, operationId, input.generation, leased.leaseEpoch, result.success);
        return {
          ...result.success,
          kind: echoClassForOperation(input.type === "ensureFolder" ? "createFolder" : input.type),
        };
      });
      const pumpOne = Effect.fnUntraced(function* (itemId: V.ItemId, operationId: V.OperationId) {
        const current = yield* active;
        const destination = O.getOrNull(current);
        if (destination?.rootId == null) return null;
        const item = yield* items.state(itemId);
        const awaited = yield* awaitOperation(operationId);
        if (item === null || awaited === null) return null;
        const operation = yield* recoverLease(operationId, awaited);
        if (operation === null || !pumpable(operation, key)) return null;
        const parentRemoteId = yield* parentRemoteIdOf(destination, operation.input.path);
        if (parentRemoteId === null || !remoteGateOpen(operation.input, item)) return null;
        return yield* pushLeased(itemId, operationId, operation, item, parentRemoteId);
      });
      const trackedBy = Effect.fnUntraced(function* (destination: Registered, event: RemoteEvent) {
        let tracked: V.ItemId | null = null;
        let parentTracked = event.parentRemoteId === destination.rootId;
        for (const [, id] of destination.paths) {
          const item = yield* items.state(id);
          if (item?.remoteId === event.remoteId) tracked = id;
          parentTracked ||= item?.observation.kind === "folder" && item.remoteId === event.parentRemoteId;
        }
        return { tracked, inScope: tracked !== null || parentTracked };
      });
      const recordConflict = Effect.fnUntraced(function* (
        destination: Registered,
        event: RemoteEvent,
        remoteId: V.RemoteItemId,
        tracked: V.ItemId | null
      ) {
        const publicId = V.ConflictId.make(
          `documents_sync_conflict_a${stable(`${destinationId}/${event.remoteEventId}`)}`
        );
        const record = {
          publicId,
          destinationId,
          workspaceId: destination.workspaceId,
          remoteEventId: event.remoteEventId,
          itemId: tracked,
          evidence: event.evidence,
          kind: conflictKindOf(event.kind),
          remoteId,
          reviewed: false,
        };
        yield* registry.send(
          destinationId,
          V.RecordConflict.make({ record }),
          options(`conflict/${event.remoteEventId}`)
        );
        if (tracked !== null)
          yield* items.send(tracked, V.FlagItemDrift.make({}), options(`drift/${event.remoteEventId}`));
      });
      // Returns the remaining echo tokens and whether the event recorded a conflict.
      const classify = Effect.fnUntraced(function* (
        destination: Registered,
        event: RemoteEvent,
        tokens: ReadonlyArray<typeof Echo.Type>,
        echoes: ReadonlyArray<typeof Echo.Type>
      ) {
        const remoteId = event.remoteId;
        if (remoteId === null) return { tokens, conflict: false };
        const token = echoTokenIndex(tokens, event);
        if (O.isSome(token)) return { tokens: A.remove(tokens, token.value), conflict: false };
        if (duplicateEcho(echoes, event, destination.rootId)) return { tokens, conflict: false };
        const { tracked, inScope } = yield* trackedBy(destination, event);
        if (!inScope) return { tokens, conflict: false };
        yield* recordConflict(destination, event, remoteId, tracked);
        return { tokens, conflict: true };
      });
      const recordPollFailure = (pageIndex: number, failure: BoxMirrorUnavailable) =>
        destinations.send(
          destinationId,
          V.RecordDestinationPoll.make({ position: null, error: failure.operation }),
          options(`poll-failed/${pageIndex}`)
        );
      // Every classification command is durable before advancing this page.
      const advanceCursor = (pageIndex: number, page: Page) =>
        destinations.send(
          destinationId,
          V.RecordDestinationPoll.make({ position: page.position, ...lastEventIdOf(page.events), error: null }),
          options(`cursor/${pageIndex}`)
        );
      const classifyPage = Effect.fnUntraced(function* (
        destination: Registered,
        page: Page,
        tokens: ReadonlyArray<typeof Echo.Type>,
        echoes: ReadonlyArray<typeof Echo.Type>
      ) {
        let remaining = tokens;
        let conflicts = 0;
        for (const event of page.events) {
          const outcome = yield* classify(destination, event, remaining, echoes);
          remaining = outcome.tokens;
          conflicts += outcome.conflict ? 1 : 0;
        }
        return { tokens: remaining, conflicts };
      });
      const poll = Effect.fnUntraced(function* (
        initial: Registered,
        initialCursor: string | null,
        echoes: ReadonlyArray<typeof Echo.Type>
      ) {
        let destination: Registered = { ...initial, cursor: initialCursor };
        let count = 0;
        let tokens = echoes;
        for (let pageIndex = 0; pageIndex < 100; pageIndex++) {
          const result = yield* Effect.result(mirror.pollEvents({ destinationId, position: destination.cursor }));
          if (Result.isFailure(result)) return yield* Effect.as(recordPollFailure(pageIndex, result.failure), count);
          const page = result.success;
          const classified = yield* classifyPage(destination, page, tokens, echoes);
          tokens = classified.tokens;
          count += classified.conflicts;
          yield* advanceCursor(pageIndex, page);
          destination = { ...destination, cursor: page.position };
          if (A.isReadonlyArrayEmpty(page.events)) break;
        }
        return count;
      });
      yield* Activity.make({
        name: "probe",
        execute: active.pipe(Effect.flatMap(O.match({ onNone: () => Effect.void, onSome: probe })), Effect.orDie),
      });
      yield* Activity.make({
        name: "scan",
        execute: active.pipe(Effect.flatMap(O.match({ onNone: () => Effect.void, onSome: scan })), Effect.orDie),
      });
      const plan = yield* Activity.make({
        name: "pump-plan",
        success: S.Array(S.Struct({ itemId: V.ItemId, operationId: V.OperationId })),
        execute: active.pipe(Effect.flatMap(O.match({ onNone: () => Effect.succeed([]), onSome: planPump }))),
      });
      const echoes: Array<typeof Echo.Type> = [];
      for (const { itemId, operationId } of plan) {
        const echo = yield* Activity.make({
          name: `pump/${operationId}`,
          success: S.NullOr(Echo),
          execute: pumpOne(itemId, operationId).pipe(Effect.orDie),
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
        execute: active.pipe(
          Effect.flatMap(O.match({ onNone: () => Effect.succeed(0), onSome: (d) => poll(d, initialCursor, echoes) })),
          Effect.orDie
        ),
      });
      return { operationsSucceeded: A.length(echoes), conflicts };
    });
  })
);
