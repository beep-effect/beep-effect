/**
 * Deterministic in-memory DMS mirror fixture for vault sync tests and smoke runs.
 *
 * The fixture keeps a synthetic remote tree plus an event log with
 * monotonically increasing integer stream positions. Every successful mirror
 * verb appends its own remote event, so the engine's poll-echo suppression is
 * genuinely exercised by fixture-backed runs.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { DocumentContentDigest } from "@beep/documents-domain/aggregates/Document";
import { RemoteItemId, SyncItemKind } from "@beep/documents-domain/values/Sync";
import {
  DmsEventPage,
  DmsEventType,
  DmsMirror,
  DmsMirrorAvailability,
  DmsMirrorProbe,
  DmsMirrorUnavailable,
  DmsRemoteEvent,
  DmsRemoteItem,
} from "@beep/documents-use-cases/aggregates/Sync/server";
import { $DocumentsServerId } from "@beep/identity/packages";
import { LiteralKit, NonNegativeInt } from "@beep/schema";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { Context, Effect, HashMap, Layer, Number as N, pipe, Ref } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import type {
  EnsureFolderInput,
  MoveItemInput,
  PollEventsInput,
  RenameItemInput,
  UploadFileInput,
  UploadFileVersionInput,
} from "@beep/documents-use-cases/aggregates/Sync/server";

const $I = $DocumentsServerId.create("aggregates/Sync/DmsMirrorFixture");

/**
 * Mirror verb addressed by fixture call counts and failure injection.
 *
 * **Example** (Assert uploadFile verb)
 *
 * ```ts
 * import { DmsMirrorFixtureVerb } from "@beep/documents-server/aggregates/Sync"
 *
 * const verb: DmsMirrorFixtureVerb = DmsMirrorFixtureVerb.Enum.uploadFile
 *
 * if (!DmsMirrorFixtureVerb.is.uploadFile(verb)) {
 *   throw new Error("expected uploadFile verb")
 * }
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const DmsMirrorFixtureVerb = LiteralKit([
  "ensureFolder",
  "moveItem",
  "pollEvents",
  "renameItem",
  "uploadFile",
  "uploadFileVersion",
]).pipe(
  $I.annoteSchema("DmsMirrorFixtureVerb", {
    description: "Mirror verb addressed by fixture call counts and failure injection.",
  })
);

/**
 * Runtime type for {@link DmsMirrorFixtureVerb}.
 *
 * **Example** (Type pollEvents string)
 *
 * ```ts
 * import type { DmsMirrorFixtureVerb } from "@beep/documents-server/aggregates/Sync"
 *
 * const verb: DmsMirrorFixtureVerb = "pollEvents"
 * console.log(verb)
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export type DmsMirrorFixtureVerb = typeof DmsMirrorFixtureVerb.Type;

/**
 * Per-verb call counts observed by the fixture since construction.
 *
 * **Example** (Decode per-verb call counts)
 *
 * ```ts
 * import { DmsMirrorFixtureCounts } from "@beep/documents-server/aggregates/Sync"
 * import * as S from "effect/Schema"
 *
 * const counts = S.decodeUnknownSync(DmsMirrorFixtureCounts)({
 *   ensureFolder: 2,
 *   moveItem: 0,
 *   pollEvents: 1,
 *   renameItem: 0,
 *   uploadFile: 2,
 *   uploadFileVersion: 0
 * })
 * console.log(counts.uploadFile)
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export class DmsMirrorFixtureCounts extends S.Class<DmsMirrorFixtureCounts>($I`DmsMirrorFixtureCounts`)(
  {
    ensureFolder: NonNegativeInt.annotateKey({
      description: "Number of ensureFolder calls observed by the fixture.",
    }),
    moveItem: NonNegativeInt.annotateKey({
      description: "Number of moveItem calls observed by the fixture.",
    }),
    pollEvents: NonNegativeInt.annotateKey({
      description: "Number of pollEvents calls observed by the fixture.",
    }),
    renameItem: NonNegativeInt.annotateKey({
      description: "Number of renameItem calls observed by the fixture.",
    }),
    uploadFile: NonNegativeInt.annotateKey({
      description: "Number of uploadFile calls observed by the fixture.",
    }),
    uploadFileVersion: NonNegativeInt.annotateKey({
      description: "Number of uploadFileVersion calls observed by the fixture.",
    }),
  },
  $I.annote("DmsMirrorFixtureCounts", {
    description: "Per-verb call counts observed by the fixture since construction.",
  })
) {}

/**
 * One node of the fixture's synthetic remote tree keyed by mirror-root-relative path.
 *
 * **Example** (Decode folder tree node)
 *
 * ```ts
 * import { DmsMirrorFixtureNode } from "@beep/documents-server/aggregates/Sync"
 * import * as S from "effect/Schema"
 *
 * const node = S.decodeUnknownSync(DmsMirrorFixtureNode)({
 *   itemKind: "folder",
 *   name: "matters",
 *   version: 1
 * })
 * console.log(node.itemKind)
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export class DmsMirrorFixtureNode extends S.Class<DmsMirrorFixtureNode>($I`DmsMirrorFixtureNode`)(
  {
    contentDigest: S.OptionFromOptionalKey(DocumentContentDigest).annotateKey({
      description: "SHA-256 hex digest of the node's uploaded bytes; none for folders.",
    }),
    itemKind: SyncItemKind.annotateKey({
      description: "Whether the remote node is a file or a folder.",
    }),
    name: S.NonEmptyString.annotateKey({
      description: "Remote item name of the node.",
    }),
    version: NonNegativeInt.annotateKey({
      description: "Number of content versions the node received; folders stay at one.",
    }),
  },
  $I.annote("DmsMirrorFixtureNode", {
    description: "One node of the fixture's synthetic remote tree keyed by mirror-root-relative path.",
  })
) {}

/**
 * Test-facing control surface of the deterministic DMS mirror fixture.
 *
 * **Example** (Construct idle control handle)
 *
 * ```ts
 * import { DmsMirrorFixtureCounts, type DmsMirrorFixtureHandleShape } from "@beep/documents-server/aggregates/Sync"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 *
 * const idleCounts = S.decodeUnknownSync(DmsMirrorFixtureCounts)({
 *   ensureFolder: 0,
 *   moveItem: 0,
 *   pollEvents: 0,
 *   renameItem: 0,
 *   uploadFile: 0,
 *   uploadFileVersion: 0
 * })
 * const handle: DmsMirrorFixtureHandleShape = {
 *   counts: Effect.succeed(idleCounts),
 *   failNext: () => Effect.void,
 *   injectRemoteEvent: () => Effect.void,
 *   requestedStreamPositions: Effect.succeed([]),
 *   snapshotTree: Effect.succeed({})
 * }
 * console.log(typeof handle.failNext)
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export interface DmsMirrorFixtureHandleShape {
  readonly counts: Effect.Effect<DmsMirrorFixtureCounts>;
  readonly failNext: (verb: DmsMirrorFixtureVerb, retryable: boolean) => Effect.Effect<void>;
  readonly injectRemoteEvent: (event: DmsRemoteEvent) => Effect.Effect<void>;
  readonly requestedStreamPositions: Effect.Effect<ReadonlyArray<O.Option<string>>>;
  readonly snapshotTree: Effect.Effect<Readonly<Record<string, DmsMirrorFixtureNode>>>;
}

/**
 * Context tag for the fixture control surface.
 *
 * **Example** (Read fixture handle key)
 *
 * ```ts
 * import { DmsMirrorFixtureHandle } from "@beep/documents-server/aggregates/Sync"
 *
 * console.log(DmsMirrorFixtureHandle.key)
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export class DmsMirrorFixtureHandle extends Context.Service<DmsMirrorFixtureHandle, DmsMirrorFixtureHandleShape>()(
  $I`DmsMirrorFixtureHandle`
) {}

type FixtureItemState = {
  readonly contentDigest: O.Option<DocumentContentDigest>;
  readonly itemKind: SyncItemKind;
  readonly name: string;
  readonly parentId: O.Option<string>;
  readonly remoteId: string;
  readonly version: number;
};

type PositionedFixtureEvent = {
  readonly event: DmsRemoteEvent;
  readonly position: number;
};

const contentDigest = (bytes: Uint8Array): DocumentContentDigest =>
  DocumentContentDigest.make(bytesToHex(sha256(bytes)));

const decodeStreamPosition = S.decodeUnknownEffect(S.FiniteFromString);

const fixtureUnavailable = (reason: string, retryable: boolean): DmsMirrorUnavailable =>
  DmsMirrorUnavailable.make({ provider: "box", reason, retryable });

const remoteItemOf = (item: FixtureItemState): DmsRemoteItem =>
  DmsRemoteItem.make({
    itemKind: item.itemKind,
    name: item.name,
    parentRemoteId: O.map(item.parentId, RemoteItemId.make),
    remoteId: RemoteItemId.make(item.remoteId),
  });

const sameParent = (left: O.Option<string>, right: O.Option<string>): boolean =>
  O.getOrNull(left) === O.getOrNull(right);

const treePath = (items: HashMap.HashMap<string, FixtureItemState>, item: FixtureItemState): string =>
  pipe(
    item.parentId,
    O.flatMap((parentId) => HashMap.get(items, parentId)),
    O.match({
      onNone: () => item.name,
      onSome: (parent) => `${treePath(items, parent)}/${item.name}`,
    })
  );

const nodeOf = (item: FixtureItemState): DmsMirrorFixtureNode =>
  DmsMirrorFixtureNode.make({
    contentDigest: item.contentDigest,
    itemKind: item.itemKind,
    name: item.name,
    version: NonNegativeInt.make(item.version),
  });

/**
 * Build one deterministic in-memory DMS mirror fixture instance.
 *
 * **Example** (Ensure folder and snapshot)
 *
 * ```ts
 * import { makeDmsMirrorFixture } from "@beep/documents-server/aggregates/Sync"
 * import { EnsureFolderInput } from "@beep/documents-use-cases/aggregates/Sync/server"
 * import { Effect } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const fixture = yield* makeDmsMirrorFixture()
 *   yield* fixture.mirror.ensureFolder(EnsureFolderInput.make({ name: "matters" }))
 *   const tree = yield* fixture.handle.snapshotTree
 *   return tree["matters"]?.itemKind
 * })
 *
 * Effect.runPromise(program).then(console.log) // "folder"
 * ```
 *
 * @effects Allocates in-memory `Ref` state for the remote tree, event log,
 * call counts, requested stream positions, and injected failures; every mirror
 * verb mutates that process-local state.
 * @category testing
 * @since 0.0.0
 */
export const makeDmsMirrorFixture = Effect.fn($I`makeDmsMirrorFixture`)(function* () {
  const itemsRef = yield* Ref.make(HashMap.empty<string, FixtureItemState>());
  const idCounterRef = yield* Ref.make(1);
  const eventsRef = yield* Ref.make(A.empty<PositionedFixtureEvent>());
  const positionCounterRef = yield* Ref.make(1);
  const countsRef = yield* Ref.make(HashMap.empty<DmsMirrorFixtureVerb, number>());
  const requestedRef = yield* Ref.make(A.empty<O.Option<string>>());
  const failuresRef = yield* Ref.make(HashMap.empty<DmsMirrorFixtureVerb, ReadonlyArray<boolean>>());

  const takeInjectedFailure = (verb: DmsMirrorFixtureVerb): Effect.Effect<O.Option<boolean>> =>
    Ref.modify(failuresRef, (failures) =>
      pipe(
        HashMap.get(failures, verb),
        O.flatMap((queue) =>
          O.map(
            A.head(queue),
            (retryable) => [O.some(retryable), HashMap.set(failures, verb, A.drop(queue, 1))] as const
          )
        ),
        O.getOrElse(() => [O.none<boolean>(), failures] as const)
      )
    );

  const guardVerb = Effect.fnUntraced(function* (verb: DmsMirrorFixtureVerb) {
    yield* Ref.update(countsRef, (counts) =>
      HashMap.set(counts, verb, 1 + O.getOrElse(HashMap.get(counts, verb), () => 0))
    );
    const injected = yield* takeInjectedFailure(verb);
    if (O.isSome(injected)) {
      return yield* fixtureUnavailable(`fixture injected ${verb} failure`, injected.value);
    }
  });

  const appendEvent = Effect.fnUntraced(function* (eventType: DmsEventType, item: FixtureItemState) {
    const position = yield* Ref.getAndUpdate(positionCounterRef, N.increment);
    const event = DmsRemoteEvent.make({
      eventId: `fx-evt-${position}`,
      eventType,
      itemKind: O.some(item.itemKind),
      name: O.some(item.name),
      parentRemoteId: O.map(item.parentId, RemoteItemId.make),
      payload: { emittedBy: "DmsMirrorFixture", eventType },
      remoteId: O.some(RemoteItemId.make(item.remoteId)),
    });
    yield* Ref.update(eventsRef, A.append({ event, position }));
  });

  const requireItem = Effect.fnUntraced(function* (remoteId: string) {
    const items = yield* Ref.get(itemsRef);
    return yield* O.match(HashMap.get(items, remoteId), {
      onNone: () => fixtureUnavailable(`fixture has no remote item ${remoteId}`, false),
      onSome: Effect.succeed,
    });
  });

  const requireParent = Effect.fnUntraced(function* (parentRemoteId: O.Option<RemoteItemId>) {
    if (O.isSome(parentRemoteId)) {
      yield* requireItem(parentRemoteId.value);
    }
  });

  const storeItem = (item: FixtureItemState): Effect.Effect<void> =>
    Ref.update(itemsRef, HashMap.set(item.remoteId, item));

  const nextItemId = Ref.getAndUpdate(idCounterRef, N.increment).pipe(Effect.map((id) => `fx-${id}`));

  const findChild = (
    items: HashMap.HashMap<string, FixtureItemState>,
    itemKind: SyncItemKind,
    parentId: O.Option<string>,
    name: string
  ): O.Option<FixtureItemState> =>
    pipe(
      A.fromIterable(HashMap.values(items)),
      A.findFirst((item) => item.itemKind === itemKind && item.name === name && sameParent(item.parentId, parentId))
    );

  const ensureFolder = Effect.fn($I`fixtureEnsureFolder`)(function* (input: EnsureFolderInput) {
    yield* guardVerb(DmsMirrorFixtureVerb.Enum.ensureFolder);
    yield* requireParent(input.parentRemoteId);
    const parentId: O.Option<string> = input.parentRemoteId;
    const items = yield* Ref.get(itemsRef);
    const existing = findChild(items, SyncItemKind.Enum.folder, parentId, input.name);
    if (O.isSome(existing)) {
      return remoteItemOf(existing.value);
    }
    const remoteId = yield* nextItemId;
    const folder: FixtureItemState = {
      contentDigest: O.none(),
      itemKind: SyncItemKind.Enum.folder,
      name: input.name,
      parentId,
      remoteId,
      version: 1,
    };
    yield* storeItem(folder);
    yield* appendEvent(DmsEventType.Enum.created, folder);
    return remoteItemOf(folder);
  });

  const uploadFile = Effect.fn($I`fixtureUploadFile`)(function* (input: UploadFileInput) {
    yield* guardVerb(DmsMirrorFixtureVerb.Enum.uploadFile);
    yield* requireParent(input.parentRemoteId);
    const parentId: O.Option<string> = input.parentRemoteId;
    const digest = contentDigest(input.content);
    const items = yield* Ref.get(itemsRef);
    const file = yield* O.match(findChild(items, SyncItemKind.Enum.file, parentId, input.name), {
      onNone: () =>
        Effect.map(
          nextItemId,
          (remoteId): FixtureItemState => ({
            contentDigest: O.some(digest),
            itemKind: SyncItemKind.Enum.file,
            name: input.name,
            parentId,
            remoteId,
            version: 1,
          })
        ),
      onSome: (existing) =>
        Effect.succeed<FixtureItemState>({
          ...existing,
          contentDigest: O.some(digest),
          version: existing.version + 1,
        }),
    });
    yield* storeItem(file);
    yield* appendEvent(DmsEventType.Enum.created, file);
    return remoteItemOf(file);
  });

  const uploadFileVersion = Effect.fn($I`fixtureUploadFileVersion`)(function* (input: UploadFileVersionInput) {
    yield* guardVerb(DmsMirrorFixtureVerb.Enum.uploadFileVersion);
    const existing = yield* requireItem(input.remoteId);
    const file: FixtureItemState = {
      ...existing,
      contentDigest: O.some(contentDigest(input.content)),
      name: input.name,
      version: existing.version + 1,
    };
    yield* storeItem(file);
    yield* appendEvent(DmsEventType.Enum.edited, file);
    return remoteItemOf(file);
  });

  const moveItem = Effect.fn($I`fixtureMoveItem`)(function* (input: MoveItemInput) {
    yield* guardVerb(DmsMirrorFixtureVerb.Enum.moveItem);
    yield* requireParent(input.newParentRemoteId);
    const existing = yield* requireItem(input.remoteId);
    const newParentId: O.Option<string> = input.newParentRemoteId;
    const moved: FixtureItemState = {
      ...existing,
      parentId: newParentId,
    };
    yield* storeItem(moved);
    yield* appendEvent(DmsEventType.Enum.moved, moved);
    return remoteItemOf(moved);
  });

  const renameItem = Effect.fn($I`fixtureRenameItem`)(function* (input: RenameItemInput) {
    yield* guardVerb(DmsMirrorFixtureVerb.Enum.renameItem);
    const existing = yield* requireItem(input.remoteId);
    const renamed: FixtureItemState = { ...existing, name: input.newName };
    yield* storeItem(renamed);
    yield* appendEvent(DmsEventType.Enum.renamed, renamed);
    return remoteItemOf(renamed);
  });

  const pollEvents = Effect.fn($I`fixturePollEvents`)(function* (input: PollEventsInput) {
    yield* guardVerb(DmsMirrorFixtureVerb.Enum.pollEvents);
    yield* Ref.update(requestedRef, A.append(input.streamPosition));
    const nextPosition = yield* Ref.get(positionCounterRef);
    const nextStreamPosition = `${nextPosition}`;
    if (O.isNone(input.streamPosition)) {
      return DmsEventPage.make({ entries: [], nextStreamPosition });
    }
    const from = yield* decodeStreamPosition(input.streamPosition.value).pipe(
      Effect.mapError(() => fixtureUnavailable("fixture received a non-numeric stream position", false))
    );
    const events = yield* Ref.get(eventsRef);
    const entries = pipe(
      events,
      A.filter((positioned) => positioned.position >= from),
      A.map((positioned) => positioned.event)
    );
    return DmsEventPage.make({ entries, nextStreamPosition });
  });

  const mirror = DmsMirror.of({
    ensureFolder,
    moveItem,
    pollEvents,
    renameItem,
    uploadFile,
    uploadFileVersion,
  });

  const handle = DmsMirrorFixtureHandle.of({
    counts: Effect.gen(function* () {
      const counts = yield* Ref.get(countsRef);
      const countOf = (verb: DmsMirrorFixtureVerb) =>
        NonNegativeInt.make(O.getOrElse(HashMap.get(counts, verb), () => 0));
      return DmsMirrorFixtureCounts.make({
        ensureFolder: countOf(DmsMirrorFixtureVerb.Enum.ensureFolder),
        moveItem: countOf(DmsMirrorFixtureVerb.Enum.moveItem),
        pollEvents: countOf(DmsMirrorFixtureVerb.Enum.pollEvents),
        renameItem: countOf(DmsMirrorFixtureVerb.Enum.renameItem),
        uploadFile: countOf(DmsMirrorFixtureVerb.Enum.uploadFile),
        uploadFileVersion: countOf(DmsMirrorFixtureVerb.Enum.uploadFileVersion),
      });
    }),
    failNext: Effect.fn($I`fixtureFailNext`)(function* (verb: DmsMirrorFixtureVerb, retryable: boolean) {
      yield* Ref.update(failuresRef, (failures) =>
        HashMap.set(failures, verb, A.append(O.getOrElse(HashMap.get(failures, verb), A.empty<boolean>), retryable))
      );
    }),
    injectRemoteEvent: Effect.fn($I`fixtureInjectRemoteEvent`)(function* (event: DmsRemoteEvent) {
      const position = yield* Ref.getAndUpdate(positionCounterRef, N.increment);
      yield* Ref.update(eventsRef, A.append({ event, position }));
    }),
    requestedStreamPositions: Ref.get(requestedRef),
    snapshotTree: Effect.gen(function* () {
      const items = yield* Ref.get(itemsRef);
      return R.fromEntries(
        A.map(A.fromIterable(HashMap.values(items)), (item) => [treePath(items, item), nodeOf(item)] as const)
      );
    }),
  });

  return { handle, mirror };
});

/**
 * Stable synthetic remote id the fixture probe reports as its mirror root.
 * Tests injecting foreign events "under the mirror root" use this as the
 * event's `parentRemoteId`.
 *
 * **Example** (Print synthetic root id)
 *
 * ```ts
 * import { DMS_MIRROR_FIXTURE_ROOT_ID } from "@beep/documents-server/aggregates/Sync"
 *
 * console.log(DMS_MIRROR_FIXTURE_ROOT_ID) // "fx-root"
 * ```
 *
 * @category fixtures
 * @since 0.0.0
 */
export const DMS_MIRROR_FIXTURE_ROOT_ID = RemoteItemId.make("fx-root");

const connectedProbe = Effect.succeed(
  DmsMirrorProbe.make({ connected: true, provider: "box", rootRemoteId: O.some(DMS_MIRROR_FIXTURE_ROOT_ID) })
);

const connectedAvailability = DmsMirrorAvailability.of({ probe: connectedProbe, refresh: connectedProbe });

/**
 * Deterministic fixture layer providing the DMS mirror port, a connected
 * availability probe, and the fixture control handle from one shared state.
 *
 * **Example** (Inspect fixture layer value)
 *
 * ```ts
 * import { DmsMirrorFixtureLayer } from "@beep/documents-server/aggregates/Sync"
 *
 * console.log(DmsMirrorFixtureLayer)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const DmsMirrorFixtureLayer: Layer.Layer<DmsMirror | DmsMirrorAvailability | DmsMirrorFixtureHandle> =
  Layer.effectContext(
    Effect.map(makeDmsMirrorFixture(), ({ handle, mirror }) =>
      Context.make(DmsMirror, mirror).pipe(
        Context.add(DmsMirrorAvailability, connectedAvailability),
        Context.add(DmsMirrorFixtureHandle, handle)
      )
    )
  );
