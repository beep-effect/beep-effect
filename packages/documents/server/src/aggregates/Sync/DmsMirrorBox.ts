/**
 * Box-backed DMS mirror adapter for the one-way vault push.
 *
 * Implements the provider-neutral {@link DmsMirror} port over the `@beep/box`
 * driver. All Box driver failures are translated into the port's
 * `DmsMirrorUnavailable` error so no driver types leak into use-cases.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import {
  Box,
  BoxErrorReason,
  Event as BoxEventModel,
  EventSource as BoxEventSource,
  File as BoxFile,
  Folder as BoxFolder,
  FolderMini as BoxFolderMini,
} from "@beep/box";
import { RemoteItemId, SyncItemKind } from "@beep/documents-domain/values/Sync";
import {
  DmsEventPage,
  DmsEventType,
  DmsMirror,
  DmsMirrorAvailability,
  DmsMirrorDisconnectReason,
  DmsMirrorProbe,
  DmsMirrorUnavailable,
  DmsRemoteEvent,
  DmsRemoteItem,
} from "@beep/documents-use-cases/aggregates/Sync/server";
import { $DocumentsServerId } from "@beep/identity/packages";
import { UnknownRecord } from "@beep/schema";
import { getSomesStruct } from "@beep/utils/Option";
import {
  Clock,
  Config,
  Context,
  DateTime,
  Duration,
  Effect,
  flow,
  identity,
  Layer,
  Match,
  pipe,
  Ref,
  SchemaTransformation,
} from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import type { BoxError, Item as BoxItem, BoxShape } from "@beep/box";
import type {
  EnsureFolderInput,
  MoveItemInput,
  PollEventsInput,
  RenameItemInput,
  UploadFileInput,
  UploadFileVersionInput,
} from "@beep/documents-use-cases/aggregates/Sync/server";

const $I = $DocumentsServerId.create("aggregates/Sync/DmsMirrorBox");

/**
 * Environment variable selecting the Box mirror root folder name.
 *
 * **Example** (Log env variable name)
 *
 * ```ts
 * import { BOX_MIRROR_ROOT_NAME_ENV } from "@beep/documents-server/aggregates/Sync"
 *
 * console.log(BOX_MIRROR_ROOT_NAME_ENV)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const BOX_MIRROR_ROOT_NAME_ENV = "DOCUMENTS_SYNC_BOX_MIRROR_ROOT";

/**
 * Default Box folder name that receives the mirrored vault tree.
 *
 * **Example** (Log default root name)
 *
 * ```ts
 * import { BOX_MIRROR_DEFAULT_ROOT_NAME } from "@beep/documents-server/aggregates/Sync"
 *
 * console.log(BOX_MIRROR_DEFAULT_ROOT_NAME)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const BOX_MIRROR_DEFAULT_ROOT_NAME = "beep-vault";

/**
 * Resolved configuration value for the Box DMS mirror adapter.
 *
 * **Example** (Make config with root name)
 *
 * ```ts
 * import { BoxMirrorConfigValue } from "@beep/documents-server/aggregates/Sync"
 *
 * const config = BoxMirrorConfigValue.make({ mirrorRootName: "beep-vault" })
 * console.log(config.mirrorRootName)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export class BoxMirrorConfigValue extends S.Class<BoxMirrorConfigValue>($I`BoxMirrorConfigValue`)(
  {
    mirrorRootName: S.NonEmptyString.annotateKey({
      description: "Box folder name created under the Box root that receives the mirrored vault tree.",
    }),
  },
  $I.annote("BoxMirrorConfigValue", {
    description: "Resolved configuration value for the Box DMS mirror adapter.",
  })
) {}

/**
 * Typed runtime configuration service for the Box DMS mirror adapter.
 *
 * **Example** (Log config service key)
 *
 * ```ts
 * import { BoxMirrorConfig } from "@beep/documents-server/aggregates/Sync"
 *
 * console.log(BoxMirrorConfig.key)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class BoxMirrorConfig extends Context.Service<BoxMirrorConfig, BoxMirrorConfigValue>()($I`BoxMirrorConfig`) {
  /**
   * Escape hatch building a config layer from an explicit value.
   *
   * **Example** (Build layer from value)
   *
   * ```ts
   * import { BoxMirrorConfig, BoxMirrorConfigValue } from "@beep/documents-server/aggregates/Sync"
   *
   * const layer = BoxMirrorConfig.layerConfig(BoxMirrorConfigValue.make({ mirrorRootName: "custom-vault" }))
   * console.log(layer)
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layerConfig = (value: BoxMirrorConfigValue): Layer.Layer<BoxMirrorConfig> =>
    Layer.succeed(BoxMirrorConfig, value);
}

const readBoxMirrorConfig = Effect.fn($I`readBoxMirrorConfig`)(function* () {
  const mirrorRootName = yield* Config.nonEmptyString(BOX_MIRROR_ROOT_NAME_ENV).pipe(
    Config.withDefault(BOX_MIRROR_DEFAULT_ROOT_NAME)
  );

  return BoxMirrorConfigValue.make({ mirrorRootName });
});

/**
 * Live configuration layer backed by the ambient Effect ConfigProvider.
 *
 * **Example** (Log live config layer)
 *
 * ```ts
 * import { BoxMirrorConfigLayer } from "@beep/documents-server/aggregates/Sync"
 *
 * console.log(BoxMirrorConfigLayer)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const BoxMirrorConfigLayer = Layer.effect(BoxMirrorConfig, readBoxMirrorConfig());

const BOX_ROOT_FOLDER_ID = "0";
const BOX_STREAM_POSITION_NOW = "now";
const FOLDER_LOOKUP_LIMIT = 1000;
const POLL_EVENTS_LIMIT = 100;

const BoxStreamPosition = S.Union([S.String, S.Finite]).pipe(
  S.decodeTo(
    S.NonEmptyString,
    SchemaTransformation.transform<string, string | number>({
      decode: (position) => (P.isString(position) ? position : `${position}`),
      encode: identity,
    })
  ),
  $I.annoteSchema("BoxStreamPosition", {
    description: "Box event stream position normalized to a non-empty string.",
  })
);

const decodeItemName = S.decodeUnknownEffect(S.NonEmptyString);
const decodeRemoteItemId = S.decodeUnknownEffect(RemoteItemId);
const decodeStreamPosition = S.decodeUnknownEffect(BoxStreamPosition);
const decodeUnknownRecord = S.decodeUnknownEffect(UnknownRecord);
const encodeBoxEvent = S.encodeUnknownEffect(BoxEventModel);
const nonEmptyStringOption = S.decodeUnknownOption(S.NonEmptyString);
const remoteItemIdOption = S.decodeUnknownOption(RemoteItemId);

const responseMappingUnavailable = DmsMirrorUnavailable.make({
  provider: "box",
  reason: "Box response mapping failed",
  retryable: false,
});

const orResponseMappingFailure = <A, E, R>(self: Effect.Effect<A, E, R>): Effect.Effect<A, DmsMirrorUnavailable, R> =>
  Effect.mapError(self, () => responseMappingUnavailable);

const transientBoxStatus = (status: number): boolean => status === 429 || status >= 500;

/**
 * Transport-level driver failures are the only status-less Box failures the
 * adapter treats as transient; everything indeterminate defaults to
 * non-retryable.
 */
const isRetryableBoxFailure = (error: BoxError): boolean =>
  O.match(error.status, {
    onNone: () => BoxErrorReason.is.transport(error.reason),
    onSome: transientBoxStatus,
  });

const boxFailureReason = (error: BoxError): string => {
  const method = O.getOrElse(error.method, () => "call");
  const status = pipe(
    error.status,
    O.map((value) => ` (status ${value})`),
    O.getOrElse(() => "")
  );
  const code = pipe(
    error.code,
    O.map((value) => ` [${value}]`),
    O.getOrElse(() => "")
  );

  return `Box ${method} failed: ${error.reason}${status}${code}`;
};

/**
 * Probe-facing classification of a status-bearing Box failure: auth rejections
 * point at the credentials, a missing root at the folder, and rate limits or
 * server errors at Box itself; everything else stays the unclassified
 * fallback.
 */
const disconnectReasonFromStatus: (status: number) => DmsMirrorDisconnectReason = Match.type<number>().pipe(
  Match.withReturnType<DmsMirrorDisconnectReason>(),
  Match.when(401, DmsMirrorDisconnectReason.thunk["auth-failed"]),
  Match.whenOr(403, 404, DmsMirrorDisconnectReason.thunk["root-unreachable"]),
  Match.when(transientBoxStatus, DmsMirrorDisconnectReason.thunk.transient),
  Match.orElse(DmsMirrorDisconnectReason.thunk["probe-failed"])
);

const boxDisconnectReason = (error: BoxError): DmsMirrorDisconnectReason =>
  O.match(error.status, {
    onNone: () =>
      BoxErrorReason.is.transport(error.reason)
        ? DmsMirrorDisconnectReason.Enum.transient
        : DmsMirrorDisconnectReason.Enum["probe-failed"],
    onSome: disconnectReasonFromStatus,
  });

const boxUnavailable = (error: BoxError): DmsMirrorUnavailable =>
  DmsMirrorUnavailable.make({
    disconnectReason: pipe(error, boxDisconnectReason, O.some),
    provider: "box",
    reason: boxFailureReason(error),
    retryable: isRetryableBoxFailure(error),
  });

const isNameConflict = (error: BoxError): boolean =>
  pipe(
    error.status,
    O.exists((status) => status === 409)
  ) ||
  pipe(
    error.code,
    O.exists((code) => code === "item_name_in_use")
  );

const parentIdOption = (parent: BoxFolderMini | null | undefined): O.Option<string> =>
  pipe(
    O.fromNullishOr(parent),
    O.map((folder) => folder.id)
  );

type RemoteItemSource = {
  readonly id: string;
  readonly name?: string | undefined;
  readonly parent?: BoxFolderMini | null | undefined;
};

type RemoteItemFields = {
  readonly itemKind: SyncItemKind;
  readonly name: O.Option<string>;
  readonly parentId: O.Option<string>;
  readonly rawId: string;
};

const itemFields =
  (itemKind: SyncItemKind) =>
  (item: RemoteItemSource): RemoteItemFields => ({
    itemKind,
    name: O.fromUndefinedOr(item.name),
    parentId: parentIdOption(item.parent),
    rawId: item.id,
  });

const remoteItem = Effect.fnUntraced(function* (mirrorRootId: string, fields: RemoteItemFields) {
  const remoteId = yield* decodeRemoteItemId(fields.rawId).pipe(orResponseMappingFailure);
  const name = yield* fields.name.pipe(O.getOrUndefined, decodeItemName, orResponseMappingFailure);

  return DmsRemoteItem.make({
    itemKind: fields.itemKind,
    name,
    parentRemoteId: pipe(
      fields.parentId,
      O.filter((id) => id !== mirrorRootId),
      O.flatMap(remoteItemIdOption)
    ),
    remoteId,
  });
});

const boxEventTypeMap: Readonly<Record<string, DmsEventType>> = {
  ITEM_CREATE: DmsEventType.Enum.created,
  ITEM_MODIFY: DmsEventType.Enum.edited,
  ITEM_MOVE: DmsEventType.Enum.moved,
  ITEM_RENAME: DmsEventType.Enum.renamed,
  ITEM_TRASH: DmsEventType.Enum.deleted,
  ITEM_UPLOAD: DmsEventType.Enum.created,
};

const dmsEventTypeFromBox = (eventType: string | undefined): DmsEventType =>
  pipe(
    O.fromUndefinedOr(eventType),
    O.flatMap((value) => R.get(boxEventTypeMap, value)),
    O.getOrElse(DmsEventType.thunk.unknown)
  );

type BoxSourceInfo = {
  readonly itemKind: O.Option<SyncItemKind>;
  readonly name: O.Option<string>;
  readonly parentRemoteId: O.Option<string>;
  readonly remoteId: O.Option<string>;
};

const emptySourceInfo: BoxSourceInfo = {
  itemKind: O.none(),
  name: O.none(),
  parentRemoteId: O.none(),
  remoteId: O.none(),
};

const isBoxEventSource = S.is(BoxEventSource);
const isBoxFile = S.is(BoxFile);
const isBoxFolder = S.is(BoxFolder);
const isBoxFolderMini = S.is(BoxFolderMini);

/**
 * First folder-items entry passing `guard` whose remote name equals `name`,
 * projected to its Box id. Used to resolve an item that a create/upload
 * conflict (or a paginated listing) revealed already exists under the parent.
 */
const findNamedId = (
  guard: (candidate: BoxItem) => boolean,
  name: string
): ((entries: ReadonlyArray<BoxItem>) => O.Option<string>) =>
  flow(
    A.findFirst((entry: BoxItem) => guard(entry) && entry.name === name),
    O.map((entry) => entry.id)
  );

const sourceInfo: (source: NonNullable<BoxEventModel["source"]>) => BoxSourceInfo = Match.type<
  NonNullable<BoxEventModel["source"]>
>().pipe(
  Match.withReturnType<BoxSourceInfo>(),
  Match.when(isBoxFile, (file) => ({
    itemKind: O.some(SyncItemKind.Enum.file),
    name: O.fromUndefinedOr(file.name),
    parentRemoteId: parentIdOption(file.parent),
    remoteId: O.some(file.id),
  })),
  Match.when(isBoxFolder, (folder) => ({
    itemKind: O.some(SyncItemKind.Enum.folder),
    name: O.fromUndefinedOr(folder.name),
    parentRemoteId: parentIdOption(folder.parent),
    remoteId: O.some(folder.id),
  })),
  Match.when(isBoxEventSource, (source) => ({
    itemKind: O.some(source.itemType),
    name: O.some(source.itemName),
    parentRemoteId: parentIdOption(source.parent),
    remoteId: O.some(source.itemId),
  })),
  Match.orElse(() => emptySourceInfo)
);

const sourceInfoFromEvent = (source: BoxEventModel["source"]): BoxSourceInfo =>
  pipe(
    O.fromUndefinedOr(source),
    O.map(sourceInfo),
    O.getOrElse(() => emptySourceInfo)
  );

/**
 * Entries without a provider event identifier cannot be deduplicated by the
 * sync engine, so they are dropped rather than surfaced with a synthetic id.
 */
const remoteEventFromEntry = (entry: BoxEventModel): Effect.Effect<O.Option<DmsRemoteEvent>, DmsMirrorUnavailable> =>
  O.match(nonEmptyStringOption(entry.eventId), {
    onNone: () => Effect.succeedNone,
    onSome: (eventId) =>
      encodeBoxEvent(entry).pipe(
        Effect.flatMap(decodeUnknownRecord),
        orResponseMappingFailure,
        Effect.map((payload) => {
          const info = sourceInfoFromEvent(entry.source);

          return O.some(
            DmsRemoteEvent.make({
              eventId,
              eventType: dmsEventTypeFromBox(entry.eventType),
              itemKind: info.itemKind,
              name: O.flatMap(info.name, nonEmptyStringOption),
              parentRemoteId: O.flatMap(info.parentRemoteId, remoteItemIdOption),
              payload,
              remoteId: O.flatMap(info.remoteId, remoteItemIdOption),
            })
          );
        })
      ),
  });

const makeMirrorRootResolver = (box: BoxShape, config: BoxMirrorConfigValue) => {
  const listFolderPage = (parentId: string, marker: O.Option<string>) =>
    box.folders
      .getFolderItems({
        folderId: parentId,
        optionalsInput: {
          queryParams: {
            limit: FOLDER_LOOKUP_LIMIT,
            usemarker: true,
            ...getSomesStruct({ marker }),
          },
        },
      })
      .pipe(Effect.mapError(boxUnavailable));

  /**
   * Walk the marker-paginated folder listing until `find` matches or the pages
   * are exhausted, so a target beyond the first page is still resolved.
   */
  const lookupItemId = (
    parentId: string,
    find: (entries: ReadonlyArray<BoxItem>) => O.Option<string>
  ): Effect.Effect<O.Option<string>, DmsMirrorUnavailable> => {
    const page = (marker: O.Option<string>): Effect.Effect<O.Option<string>, DmsMirrorUnavailable> =>
      listFolderPage(parentId, marker).pipe(
        Effect.flatMap((items) =>
          pipe(
            find(pipe(O.fromUndefinedOr(items.entries), O.getOrElse(A.empty<BoxItem>))),
            O.map(Effect.succeedSome),
            O.getOrElse(() =>
              O.match(nonEmptyStringOption(items.nextMarker), {
                onNone: () => Effect.succeedNone,
                onSome: (next) => page(O.some(next)),
              })
            )
          )
        )
      );

    return page(O.none());
  };

  const lookupFolderId = (parentId: string, name: string): Effect.Effect<O.Option<string>, DmsMirrorUnavailable> =>
    lookupItemId(parentId, findNamedId(isBoxFolderMini, name));

  const lookupFileId = (parentId: string, name: string): Effect.Effect<O.Option<string>, DmsMirrorUnavailable> =>
    lookupItemId(parentId, findNamedId(isBoxFile, name));

  const createRemoteFolder = (parentId: string, name: string) =>
    box.folders.createFolder({ requestBody: { name, parent: { id: parentId } } });

  const resolveMirrorRootId = Effect.gen(function* () {
    const existing = yield* lookupFolderId(BOX_ROOT_FOLDER_ID, config.mirrorRootName);

    // A concurrent creator (or a listing that missed the folder) turns the
    // create into a name conflict; recover by re-resolving the existing id,
    // exactly like ensureFolder's conflict recovery.
    return yield* pipe(
      existing,
      O.map(Effect.succeed),
      O.getOrElse(() =>
        createRemoteFolder(BOX_ROOT_FOLDER_ID, config.mirrorRootName).pipe(
          Effect.map((folder) => folder.id),
          Effect.catchIf(isNameConflict, (error) =>
            lookupFolderId(BOX_ROOT_FOLDER_ID, config.mirrorRootName).pipe(
              Effect.flatMap(
                O.match({
                  onNone: () => Effect.fail(boxUnavailable(error)),
                  onSome: Effect.succeed,
                })
              )
            )
          ),
          Effect.catchTag("BoxError", (error) => Effect.fail(boxUnavailable(error)))
        )
      )
    );
  }).pipe(Effect.withSpan($I`resolveMirrorRootId`));

  return { createRemoteFolder, lookupFileId, lookupFolderId, resolveMirrorRootId };
};

/**
 * Build the Box-backed {@link DmsMirror} implementation.
 *
 * **Details**
 *
 * The mirror root folder (named by {@link BoxMirrorConfig}) is ensured lazily
 * under the Box root on the first remote operation and cached for the life of
 * the service. A `none` parent in port inputs addresses that mirror root.
 *
 * **Example** (Log mirror constructor)
 *
 * ```ts
 * import { makeDmsMirrorBox } from "@beep/documents-server/aggregates/Sync"
 *
 * console.log(makeDmsMirrorBox)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeDmsMirrorBox = Effect.fn($I`makeDmsMirrorBox`)(function* () {
  const box = yield* Box;
  const config = yield* BoxMirrorConfig;
  const mirrorRootIdRef = yield* Ref.make(O.none<string>());
  const { createRemoteFolder, lookupFileId, lookupFolderId, resolveMirrorRootId } = makeMirrorRootResolver(box, config);

  const ensureMirrorRootId: Effect.Effect<string, DmsMirrorUnavailable> = Ref.get(mirrorRootIdRef).pipe(
    Effect.flatMap(
      O.match({
        onNone: () => resolveMirrorRootId.pipe(Effect.tap((id) => Ref.set(mirrorRootIdRef, O.some(id)))),
        onSome: Effect.succeed,
      })
    )
  );

  const resolveParentId = (parentRemoteId: O.Option<RemoteItemId>): Effect.Effect<string, DmsMirrorUnavailable> =>
    O.match(parentRemoteId, {
      onNone: () => ensureMirrorRootId,
      onSome: Effect.succeed,
    });

  const updateRemoteItem = (
    itemKind: SyncItemKind,
    remoteId: RemoteItemId,
    requestBody: { readonly name?: string; readonly parent?: { readonly id: string } }
  ): Effect.Effect<RemoteItemFields, DmsMirrorUnavailable> =>
    SyncItemKind.$match(itemKind, {
      file: () =>
        box.files
          .updateFileById({ fileId: remoteId, optionalsInput: { requestBody } })
          .pipe(Effect.map(itemFields(SyncItemKind.Enum.file))),
      folder: () =>
        box.folders
          .updateFolderById({ folderId: remoteId, optionalsInput: { requestBody } })
          .pipe(Effect.map(itemFields(SyncItemKind.Enum.folder))),
    }).pipe(Effect.mapError(boxUnavailable));

  const firstUploadedFileFields = (files: {
    readonly entries?: ReadonlyArray<RemoteItemSource> | undefined;
  }): Effect.Effect<RemoteItemFields, DmsMirrorUnavailable> =>
    pipe(
      O.fromUndefinedOr(files.entries),
      O.flatMap(A.head),
      O.match({
        onNone: () =>
          Effect.fail(
            DmsMirrorUnavailable.make({
              provider: "box",
              reason: "Box upload returned no file entry",
              retryable: false,
            })
          ),
        onSome: (entry) => Effect.succeed(itemFields(SyncItemKind.Enum.file)(entry)),
      })
    );

  const ensureFolder = Effect.fn($I`ensureFolder`)(function* (input: EnsureFolderInput) {
    const mirrorRootId = yield* ensureMirrorRootId;
    const parentId = yield* resolveParentId(input.parentRemoteId);
    const fields = yield* createRemoteFolder(parentId, input.name).pipe(
      Effect.map(itemFields(SyncItemKind.Enum.folder)),
      Effect.catchIf(isNameConflict, (error) =>
        lookupFolderId(parentId, input.name).pipe(
          Effect.flatMap(
            O.match({
              onNone: () => Effect.fail(boxUnavailable(error)),
              onSome: (existingId) =>
                Effect.succeed<RemoteItemFields>({
                  itemKind: SyncItemKind.Enum.folder,
                  name: O.some(input.name),
                  parentId: O.some(parentId),
                  rawId: existingId,
                }),
            })
          )
        )
      ),
      Effect.catchTag("BoxError", (error) => Effect.fail(boxUnavailable(error)))
    );

    return yield* remoteItem(mirrorRootId, fields);
  });

  const uploadFile = Effect.fn($I`uploadFile`)(function* (input: UploadFileInput) {
    const mirrorRootId = yield* ensureMirrorRootId;
    const parentId = yield* resolveParentId(input.parentRemoteId);
    const files = yield* box.uploads
      .uploadFile({
        requestBody: {
          attributes: { name: input.name, parent: { id: parentId } },
          file: input.content,
        },
      })
      .pipe(
        // A name conflict means the file already exists under the parent (a
        // retried upload after a crash). Look up its id and converge by
        // uploading a new version of the same content instead of failing.
        Effect.catchIf(isNameConflict, (error) =>
          lookupFileId(parentId, input.name).pipe(
            Effect.flatMap(
              O.match({
                onNone: () => Effect.fail(boxUnavailable(error)),
                onSome: (existingId) =>
                  box.uploads
                    .uploadFileVersion({
                      fileId: existingId,
                      requestBody: { attributes: { name: input.name }, file: input.content },
                    })
                    .pipe(Effect.mapError(boxUnavailable)),
              })
            )
          )
        ),
        Effect.catchTag("BoxError", (error) => Effect.fail(boxUnavailable(error)))
      );
    const fields = yield* firstUploadedFileFields(files);

    return yield* remoteItem(mirrorRootId, fields);
  });

  const uploadFileVersion = Effect.fn($I`uploadFileVersion`)(function* (input: UploadFileVersionInput) {
    const mirrorRootId = yield* ensureMirrorRootId;
    const files = yield* box.uploads
      .uploadFileVersion({
        fileId: input.remoteId,
        requestBody: {
          attributes: { name: input.name },
          file: input.content,
        },
      })
      .pipe(Effect.mapError(boxUnavailable));
    const fields = yield* firstUploadedFileFields(files);

    return yield* remoteItem(mirrorRootId, fields);
  });

  const moveItem = Effect.fn($I`moveItem`)(function* (input: MoveItemInput) {
    const mirrorRootId = yield* ensureMirrorRootId;
    const destinationId = yield* resolveParentId(input.newParentRemoteId);
    const fields = yield* updateRemoteItem(input.itemKind, input.remoteId, { parent: { id: destinationId } });

    return yield* remoteItem(mirrorRootId, fields);
  });

  const renameItem = Effect.fn($I`renameItem`)(function* (input: RenameItemInput) {
    const mirrorRootId = yield* ensureMirrorRootId;
    const fields = yield* updateRemoteItem(input.itemKind, input.remoteId, { name: input.newName });

    return yield* remoteItem(mirrorRootId, fields);
  });

  const pollEvents = Effect.fn($I`pollEvents`)(function* (input: PollEventsInput) {
    const streamPosition = O.getOrElse(input.streamPosition, () => BOX_STREAM_POSITION_NOW);
    const page = yield* box.events
      .getEvents({
        queryParams: {
          limit: POLL_EVENTS_LIMIT,
          streamPosition,
          streamType: "changes",
        },
      })
      .pipe(Effect.mapError(boxUnavailable));
    const nextStreamPosition = yield* decodeStreamPosition(page.nextStreamPosition).pipe(orResponseMappingFailure);
    const entries = pipe(O.fromUndefinedOr(page.entries), O.getOrElse(A.empty<BoxEventModel>));
    const events = yield* Effect.forEach(entries, remoteEventFromEntry);

    return DmsEventPage.make({ entries: A.getSomes(events), nextStreamPosition });
  });

  return DmsMirror.of({
    ensureFolder,
    moveItem,
    pollEvents,
    renameItem,
    uploadFile,
    uploadFileVersion,
  });
});

/**
 * Box-backed {@link DmsMirror} layer; requires `Box` and {@link BoxMirrorConfig}.
 *
 * **Example** (Log Box mirror layer)
 *
 * ```ts
 * import { DmsMirrorBoxLayer } from "@beep/documents-server/aggregates/Sync"
 *
 * console.log(DmsMirrorBoxLayer)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const DmsMirrorBoxLayer = Layer.effect(DmsMirror, makeDmsMirrorBox());

/**
 * Convenience Box-backed {@link DmsMirror} layer with environment-backed
 * configuration; still requires the `Box` driver service.
 *
 * **Example** (Log live mirror layer)
 *
 * ```ts
 * import { DmsMirrorBoxLive } from "@beep/documents-server/aggregates/Sync"
 *
 * console.log(DmsMirrorBoxLive)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const DmsMirrorBoxLive = DmsMirrorBoxLayer.pipe(Layer.provide(BoxMirrorConfigLayer));

/**
 * How long a mirror-root resolution answers later probes before Box is asked
 * again.
 *
 * The resolution used to be cached for the life of the service, so the *first*
 * success made every later probe report `connected: true` without touching Box:
 * once the token expired, the panel kept claiming a healthy connection and a
 * sync pass whose every remote call was failing still returned a normal status.
 * Re-resolving on a short interval keeps the reported state honest while still
 * sparing the common case a round trip per probe.
 *
 * @category constants
 * @since 0.0.0
 */
const MIRROR_ROOT_CACHE_TTL = Duration.seconds(30);

/**
 * How long a *failed* probe answers later probes.
 *
 * Failures expire far sooner than successes. Caching both for the same window
 * meant one transient Box hiccup disabled sync — and flapped the connection
 * badge — for the whole window even after Box had recovered, while re-probing a
 * hard-down Box on every status read is the cost this cache exists to avoid.
 */
const MIRROR_ROOT_FAILURE_CACHE_TTL = Duration.seconds(3);

type MirrorProbeCacheEntry = {
  readonly expiresAt: number;
  readonly probe: DmsMirrorProbe;
};

type MirrorProbeFailure = DmsMirrorUnavailable | S.SchemaError;

const probeDisconnectReason = (error: MirrorProbeFailure): DmsMirrorDisconnectReason =>
  P.isTagged(error, "DmsMirrorUnavailable")
    ? O.getOrElse(error.disconnectReason, DmsMirrorDisconnectReason.thunk["probe-failed"])
    : DmsMirrorDisconnectReason.Enum["probe-failed"];

/**
 * BoxError fields are sanitized at the driver boundary, so the mirror failure
 * diagnostic (reason literal, status, code) is safe to log verbatim; a schema
 * failure here can only be a malformed folder id.
 */
const probeFailureDetail = (error: MirrorProbeFailure): string =>
  P.isTagged(error, "DmsMirrorUnavailable") ? error.reason : "mirror root id decoding failed";

/**
 * Availability layer probing the Box mirror adapter.
 *
 * **Details**
 *
 * The probe resolves the mirror-root folder id (cached for
 * {@link MIRROR_ROOT_CACHE_TTL}): success reports `connected: true` with
 * `rootRemoteId` set; any driver failure reports `connected: false` without
 * failing the probe, carrying the {@link DmsMirrorDisconnectReason}
 * classification captured from the Box failure (auth rejection, missing root,
 * transient outage) plus the `probedAt` timestamp of the resolution, and logs
 * the classified failure at warning level. Applications supply their own
 * disconnected variant when no Box credentials are configured.
 *
 * **Example** (Log availability layer)
 *
 * ```ts
 * import { DmsMirrorAvailabilityBoxLayer } from "@beep/documents-server/aggregates/Sync"
 *
 * console.log(DmsMirrorAvailabilityBoxLayer)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const DmsMirrorAvailabilityBoxLayer = Layer.effect(
  DmsMirrorAvailability,
  Effect.gen(function* () {
    const box = yield* Box;
    const config = yield* BoxMirrorConfig;
    const { resolveMirrorRootId } = makeMirrorRootResolver(box, config);
    const cache = yield* Ref.make<O.Option<MirrorProbeCacheEntry>>(O.none());

    const resolve = (probedAt: DateTime.Utc) =>
      resolveMirrorRootId.pipe(
        Effect.flatMap(decodeRemoteItemId),
        Effect.matchEffect({
          onFailure: (error) => {
            const disconnectReason = probeDisconnectReason(error);
            return Effect.logWarning("Box mirror availability probe failed").pipe(
              Effect.annotateLogs({
                "documents.sync.disconnect_reason": disconnectReason,
                "documents.sync.failure": probeFailureDetail(error),
                "documents.sync.provider": "box",
              }),
              Effect.as(
                DmsMirrorProbe.make({
                  connected: false,
                  disconnectReason: O.some(disconnectReason),
                  probedAt: O.some(probedAt),
                  provider: "box",
                  rootRemoteId: O.none(),
                })
              )
            );
          },
          onSuccess: (rootRemoteId) =>
            Effect.succeed(
              DmsMirrorProbe.make({
                connected: true,
                probedAt: O.some(probedAt),
                provider: "box",
                rootRemoteId: O.some(rootRemoteId),
              })
            ),
        })
      );

    const probeNow = Effect.gen(function* () {
      const now = yield* Clock.currentTimeMillis;
      const probe = yield* resolve(DateTime.makeUnsafe(now));
      const ttl = probe.connected ? MIRROR_ROOT_CACHE_TTL : MIRROR_ROOT_FAILURE_CACHE_TTL;
      yield* Ref.set(cache, O.some({ probe, expiresAt: now + Duration.toMillis(ttl) }));
      return probe;
    });

    return DmsMirrorAvailability.of({
      probe: Effect.gen(function* () {
        const now = yield* Clock.currentTimeMillis;
        const cached = yield* Ref.get(cache);
        if (O.isSome(cached) && cached.value.expiresAt > now) {
          return cached.value.probe;
        }
        return yield* probeNow;
      }).pipe(Effect.withSpan($I`DmsMirrorAvailabilityBoxProbe`)),
      // An operator's explicit retry must re-ask Box, not replay the cached
      // failure for the rest of its TTL; the fresh answer replaces the cache
      // so passive reads immediately agree with what the retry saw.
      refresh: probeNow.pipe(Effect.withSpan($I`DmsMirrorAvailabilityBoxRefresh`)),
    });
  })
);
