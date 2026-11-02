/**
 * Remote-event drift classification and durable polling for vault synchronization.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as DomainSyncConflict from "@beep/documents-domain/entities/SyncConflict";
import * as DomainSyncItem from "@beep/documents-domain/entities/SyncItem";
import { SyncItemKind } from "@beep/documents-domain/values/Sync";
import {
  DmsEventType,
  DmsMirror,
  DmsMirrorAvailability,
  PollEventsInput,
} from "@beep/documents-use-cases/aggregates/Sync/server";
import { SyncConflictRepository, SyncConflictSeed } from "@beep/documents-use-cases/entities/SyncConflict/server";
import {
  FindSyncCursorInput,
  SyncCursorRepository,
  SyncCursorSeed,
} from "@beep/documents-use-cases/entities/SyncCursor/server";
import {
  FindSyncItemByRemoteIdInput,
  ListSyncItemsByWorkspaceInput,
  SyncItemRepository,
} from "@beep/documents-use-cases/entities/SyncItem/server";
import { $DocumentsServerId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as F from "effect/Function";
import { pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { echoClassForEvent } from "./VaultPush.model.ts";
import { VaultSyncConfig } from "./VaultSync.config.ts";
import type { RemoteItemId } from "@beep/documents-domain/values/Sync";
import type {
  DmsMirrorUnavailable,
  DmsRemoteEvent,
  SyncOnceInput,
} from "@beep/documents-use-cases/aggregates/Sync/server";
import type * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import type { EchoClass, PushRecord } from "./VaultPush.model.ts";

const $I = $DocumentsServerId.create("aggregates/Sync/VaultSync.drift");
const BOX_PROVIDER = "box";
const SyncConflictKind = DomainSyncConflict.SyncConflictKind;
const SyncItemState = DomainSyncItem.SyncItemState;

/**
 * Cap for stored drift payload snapshots: an account-wide provider event can
 * carry arbitrarily large payloads, and conflict rows must stay bounded.
 */
const PAYLOAD_SNAPSHOT_LIMIT = 8192;
const encodePayload = S.encodeEffect(S.fromJsonString(S.Unknown));

const truncatedPayload = Effect.fn($I`truncatedPayload`)(function* (payload: Readonly<Record<string, unknown>>) {
  // Provider payloads originate in JSON. An unserializable internal value is
  // still a defect, as it was at the previous native serialization boundary.
  const encoded = yield* encodePayload(payload).pipe(Effect.orDie);
  return Str.length(encoded) <= PAYLOAD_SNAPSHOT_LIMIT
    ? payload
    : { head: Str.slice(0, PAYLOAD_SNAPSHOT_LIMIT)(encoded), truncated: true };
});

const knownItemConflictKind = (eventType: DmsEventType): DomainSyncConflict.SyncConflictKind =>
  DmsEventType.match(eventType, {
    created: () => SyncConflictKind.Enum.remoteEdit,
    deleted: () => SyncConflictKind.Enum.remoteDelete,
    edited: () => SyncConflictKind.Enum.remoteEdit,
    moved: () => SyncConflictKind.Enum.remoteMove,
    renamed: () => SyncConflictKind.Enum.remoteRename,
    unknown: () => SyncConflictKind.Enum.remoteUnknown,
  });

const unknownItemConflictKind = (eventType: DmsEventType): DomainSyncConflict.SyncConflictKind =>
  DmsEventType.match(eventType, {
    created: () => SyncConflictKind.Enum.remoteCreate,
    deleted: () => SyncConflictKind.Enum.remoteUnknown,
    edited: () => SyncConflictKind.Enum.remoteCreate,
    moved: () => SyncConflictKind.Enum.remoteUnknown,
    renamed: () => SyncConflictKind.Enum.remoteUnknown,
    unknown: () => SyncConflictKind.Enum.remoteUnknown,
  });

const strictFieldMatches = <Value>(field: O.Option<Value>, current: O.Option<Value>): boolean =>
  O.match(field, {
    onNone: () => O.isNone(current),
    onSome: (value) => O.exists(current, (candidate) => candidate === value),
  });

/**
 * Crash-window echo fallback for events with no same-pass push record: a
 * `created`/`moved`/`renamed` event whose observed `(name, parent)` exactly
 * equals the item's recorded pushed state describes no drift. Missing event
 * fields count as a mismatch (conservative: surface a conflict rather than
 * swallow drift), and `edited` events never match — a content change is
 * invisible in `(name, parent)`, so an unexplained edit is always drift.
 */
const matchesPushedState = (
  event: DmsRemoteEvent,
  item: DomainSyncItem.SyncItem,
  rootRemoteId: O.Option<RemoteItemId>
): boolean => {
  if (DmsEventType.is.edited(event.eventType) || O.isNone(echoClassForEvent(event.eventType))) {
    return false;
  }
  const normalizedParent = O.filter(
    event.parentRemoteId,
    (parent) => !O.exists(rootRemoteId, (root) => root === parent)
  );
  return strictFieldMatches(event.name, item.remoteName) && strictFieldMatches(normalizedParent, item.remoteParentId);
};

/**
 * Build the remote-event phase from the mirror and sync repositories.
 *
 * **Details**
 *
 * The caller owns the workspace lock. Each poll consumes only that pass's
 * successful push observations and persists a cursor after classifying a page.
 * Poll failures preserve the last durable position and are recorded separately.
 *
 * **Example** (Poll after a push pass)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import type { SyncOnceInput } from "@beep/documents-use-cases/aggregates/Sync/server"
 * import { makeVaultSyncDrift } from "./VaultSync.drift.ts"
 * const pollWithoutPushes = (input: SyncOnceInput) => Effect.gen(function* () {
 *   const drift = yield* makeVaultSyncDrift()
 *   yield* drift.pollRemoteEvents(input, [])
 * })
 * ```
 *
 * @internal
 * @category constructors
 * @since 0.0.0
 */
export const makeVaultSyncDrift = Effect.fn($I`makeVaultSyncDrift`)(function* () {
  const itemRepository = yield* SyncItemRepository;
  const cursorRepository = yield* SyncCursorRepository;
  const conflictRepository = yield* SyncConflictRepository;
  const mirror = yield* DmsMirror;
  const availability = yield* DmsMirrorAvailability;
  const config = yield* VaultSyncConfig;

  const conflictSeedFor = Effect.fn($I`conflictSeedFor`)(function* (
    workspaceId: WorkspaceIdentity.WorkspaceId,
    event: DmsRemoteEvent,
    conflictKind: DomainSyncConflict.SyncConflictKind,
    item: O.Option<DomainSyncItem.SyncItem>
  ) {
    const remotePayload = yield* truncatedPayload(event.payload);
    return SyncConflictSeed.make({
      conflictKind,
      localRelPath: O.map(item, (tracked) => tracked.localRelPath),
      provider: BOX_PROVIDER,
      remoteEventId: O.some(event.eventId),
      remoteId: event.remoteId,
      remotePayload,
      resolutionStatus: "open",
      syncItemId: O.map(item, (tracked) => tracked.id),
      workspaceId,
    });
  });

  /**
   * Consume one same-pass push record explaining this event as our own echo.
   * Returns `true` (and burns the record) when a record with the event's
   * remote id and echo class is outstanding.
   */
  const consumePushEcho = (
    pushRecordsRef: Ref.Ref<ReadonlyArray<PushRecord>>,
    remoteId: RemoteItemId,
    eventClass: EchoClass
  ): Effect.Effect<boolean> =>
    Ref.modify(pushRecordsRef, (records) =>
      pipe(
        A.findFirstIndex(records, (record) => record.remoteId === remoteId && record.echoClass === eventClass),
        O.match({
          onNone: () => [false, records] as const,
          onSome: (index) => [true, A.remove(records, index)] as const,
        })
      )
    );

  /**
   * Classify one polled remote event against the drift rules:
   *
   * - no remote id → unattributable account noise, ignored (v1 posture);
   * - unknown remote id → conflict only when the event's parent is the mirror
   *   root or a tracked folder (activity outside the mirror is invisible);
   * - tracked item → same-pass push records (then the crash-window pushed-state
   *   fallback) suppress our own echoes; anything else records drift and marks
   *   the item conflicted.
   */
  const classifyRemoteEvent = Effect.fn($I`classifyRemoteEvent`)(function* (
    workspaceId: WorkspaceIdentity.WorkspaceId,
    pushRecordsRef: Ref.Ref<ReadonlyArray<PushRecord>>,
    trackedFolderRemoteIds: HashMap.HashMap<RemoteItemId, boolean>,
    rootRemoteId: O.Option<RemoteItemId>,
    event: DmsRemoteEvent
  ) {
    if (O.isNone(event.remoteId)) {
      yield* Effect.logDebug("Documents vault sync ignored an unattributable remote event").pipe(
        Effect.annotateLogs({ eventId: event.eventId })
      );
      return;
    }
    const tracked = yield* itemRepository.findByRemoteId(
      FindSyncItemByRemoteIdInput.make({
        provider: BOX_PROVIDER,
        remoteId: event.remoteId.value,
        workspaceId,
      })
    );
    if (O.isNone(tracked)) {
      const underMirror = O.exists(
        event.parentRemoteId,
        (parent) =>
          O.exists(rootRemoteId, (root) => root === parent) || O.isSome(HashMap.get(trackedFolderRemoteIds, parent))
      );
      if (!underMirror) {
        yield* Effect.logDebug("Documents vault sync ignored a remote event outside the mirror").pipe(
          Effect.annotateLogs({
            eventId: event.eventId,
            remoteId: event.remoteId.value,
          })
        );
        return;
      }
      yield* conflictSeedFor(workspaceId, event, unknownItemConflictKind(event.eventType), O.none()).pipe(
        Effect.flatMap(conflictRepository.record)
      );
      return;
    }
    const item = tracked.value;
    const eventClass = echoClassForEvent(event.eventType);
    if (O.isSome(eventClass)) {
      const consumed = yield* consumePushEcho(pushRecordsRef, event.remoteId.value, eventClass.value);
      if (consumed || matchesPushedState(event, item, rootRemoteId)) {
        yield* Effect.logDebug("Documents vault sync ignored a push echo event").pipe(
          Effect.annotateLogs({
            eventId: event.eventId,
            remoteId: event.remoteId.value,
          })
        );
        return;
      }
    }
    yield* conflictSeedFor(workspaceId, event, knownItemConflictKind(event.eventType), tracked).pipe(
      Effect.flatMap(conflictRepository.record)
    );
    yield* itemRepository.update(
      DomainSyncItem.SyncItem.make({
        ...item,
        syncState: SyncItemState.Enum.conflict,
      })
    );
  });

  /**
   * Poll remote drift. A `none` cursor bootstraps via `pollEvents(none)`,
   * which returns the provider's current position with (per port contract)
   * empty entries; any returned entries are classified with the same rules.
   * The page loop is bounded by `eventPageLimit` per sync pass.
   */
  const pollRemoteEvents = Effect.fn($I`pollRemoteEvents`)(function* (
    input: SyncOnceInput,
    pushRecords: ReadonlyArray<PushRecord>
  ) {
    const probe = yield* availability.probe;
    const trackedItems = yield* itemRepository.listByWorkspace(
      ListSyncItemsByWorkspaceInput.make({
        provider: BOX_PROVIDER,
        workspaceId: input.workspaceId,
      })
    );
    const trackedFolderRemoteIds = HashMap.fromIterable<RemoteItemId, boolean>(
      pipe(
        trackedItems,
        A.filter((item) => SyncItemKind.is.folder(item.itemKind)),
        A.flatMap((item) =>
          O.match(item.remoteId, {
            onNone: A.empty<readonly [RemoteItemId, boolean]>,
            onSome: (remoteId) => [[remoteId, true] as const],
          })
        )
      )
    );
    const pushRecordsRef = yield* Ref.make(pushRecords);
    const cursor = yield* cursorRepository.find(
      FindSyncCursorInput.make({
        provider: BOX_PROVIDER,
        workspaceId: input.workspaceId,
      })
    );
    let streamPosition = O.map(cursor, (current) => current.streamPosition);
    let lastEventId = O.flatMap(cursor, (current) => current.lastEventId);
    for (let page = 0; page < config.eventPageLimit; page += 1) {
      const events = yield* mirror.pollEvents(PollEventsInput.make({ streamPosition }));
      yield* Effect.forEach(events.entries, (event) =>
        classifyRemoteEvent(input.workspaceId, pushRecordsRef, trackedFolderRemoteIds, probe.rootRemoteId, event)
      );
      lastEventId = O.orElse(
        O.map(A.last(events.entries), (event) => event.eventId),
        () => lastEventId
      );
      yield* cursorRepository.upsert(
        SyncCursorSeed.make({
          lastError: O.none(),
          lastEventId,
          provider: BOX_PROVIDER,
          status: "active",
          streamPosition: events.nextStreamPosition,
          workspaceId: input.workspaceId,
        })
      );
      streamPosition = O.some(events.nextStreamPosition);
      const drained = A.match(events.entries, {
        onEmpty: F.constTrue,
        onNonEmpty: F.constFalse,
      });
      if (drained) {
        return;
      }
    }
  });

  /**
   * A mirror failure while polling records the cursor error state instead of
   * failing `syncOnce`; before the cursor bootstraps there is no durable row
   * to mark, so the failure is only logged.
   */
  const recordPollFailure = Effect.fn($I`recordPollFailure`)(function* (
    input: SyncOnceInput,
    error: DmsMirrorUnavailable
  ) {
    const cursor = yield* cursorRepository.find(
      FindSyncCursorInput.make({
        provider: BOX_PROVIDER,
        workspaceId: input.workspaceId,
      })
    );
    yield* O.match(cursor, {
      onNone: () =>
        Effect.logDebug("Documents vault sync poll failed before the cursor bootstrapped").pipe(
          Effect.annotateLogs({ reason: error.reason })
        ),
      onSome: (current) =>
        cursorRepository
          .upsert(
            SyncCursorSeed.make({
              lastError: O.some(error.reason),
              lastEventId: current.lastEventId,
              provider: BOX_PROVIDER,
              status: "error",
              streamPosition: current.streamPosition,
              workspaceId: input.workspaceId,
            })
          )
          .pipe(Effect.asVoid),
    });
  });

  return { pollRemoteEvents, recordPollFailure };
});
