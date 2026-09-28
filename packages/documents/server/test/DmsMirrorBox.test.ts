import { Buffer } from "node:buffer";
import { text as readableText } from "node:stream/consumers";
import { Box } from "@beep/box";
import { RemoteItemId } from "@beep/documents-domain/values/Sync";
import {
  BOX_MIRROR_DEFAULT_ROOT_NAME,
  BOX_MIRROR_ROOT_NAME_ENV,
  BoxMirrorConfig,
  BoxMirrorConfigLayer,
  BoxMirrorConfigValue,
  DmsMirrorAvailabilityBoxLayer,
  DmsMirrorBoxLayer,
} from "@beep/documents-server/aggregates/Sync";
import {
  DmsMirror,
  DmsMirrorAvailability,
  EnsureFolderInput,
  MoveItemInput,
  PollEventsInput,
  RenameItemInput,
  UploadFileInput,
  UploadFileVersionInput,
} from "@beep/documents-use-cases/aggregates/Sync/server";
import { $DocumentsServerId } from "@beep/identity/packages";
import { it } from "@beep/test-runner";
import { fcRuns, provideScopedLayer } from "@beep/test-utils";
import { describe, expect } from "@effect/vitest";
import { assertFalse, assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import { ConfigProvider, Context, Effect, Layer, pipe, Result } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";

type FakeParentField = { readonly id: string };

type FakeCreateFolderRequestBody = {
  readonly name: string;
  readonly parent: FakeParentField;
};

type FakeUpdateRequestBody = {
  readonly name?: string | undefined;
  readonly parent?: FakeParentField | undefined;
};

type FakeUpdateOptionals = {
  readonly requestBody?: FakeUpdateRequestBody | undefined;
};

type FakeUploadRequestBody = {
  readonly attributes: {
    readonly name: string;
    readonly parent?: FakeParentField | undefined;
  };
  readonly file: NodeJS.ReadableStream;
};

type FakeEventsQueryParams = {
  readonly limit?: number | undefined;
  readonly streamPosition?: string | undefined;
  readonly streamType?: string | undefined;
};

type FakeFolderItemsQueryParams = {
  readonly limit?: number | undefined;
  readonly marker?: string | undefined;
  readonly usemarker?: boolean | undefined;
};

type FakeFolderItemsOptionals = {
  readonly queryParams?: FakeFolderItemsQueryParams | undefined;
};

type FakeBoxClient = {
  readonly events: {
    readonly getEvents: (
      queryParams: FakeEventsQueryParams,
      headersInput: unknown,
      cancellationToken: AbortSignal | undefined
    ) => Promise<unknown>;
  };
  readonly files: {
    readonly updateFileById: (fileId: string, optionalsInput: FakeUpdateOptionals) => Promise<unknown>;
  };
  readonly folders: {
    readonly createFolder: (requestBody: FakeCreateFolderRequestBody, optionalsInput: unknown) => Promise<unknown>;
    readonly getFolderItems: (folderId: string, optionalsInput: FakeFolderItemsOptionals) => Promise<unknown>;
    readonly updateFolderById: (folderId: string, optionalsInput: FakeUpdateOptionals) => Promise<unknown>;
  };
  readonly uploads: {
    readonly uploadFile: (requestBody: FakeUploadRequestBody, optionalsInput: unknown) => Promise<unknown>;
    readonly uploadFileVersion: (
      fileId: string,
      requestBody: FakeUploadRequestBody,
      optionalsInput: unknown
    ) => Promise<unknown>;
  };
};

type FakeBoxOverrides = {
  readonly [Manager in keyof FakeBoxClient]?: Partial<FakeBoxClient[Manager]>;
};

type FakeItem = {
  readonly id: string;
  content: string;
  name: string;
  parentId: string;
  readonly type: "file" | "folder";
  version: number;
};

const nameConflictRejection = { responseInfo: { code: "item_name_in_use", statusCode: 409 } };

const makeFakeBox = (overrides: FakeBoxOverrides = {}) => {
  const items = new Map<string, FakeItem>();
  const eventLog: Array<Record<string, unknown>> = [];
  const receivedEventQueries: Array<FakeEventsQueryParams> = [];
  const counts = {
    createFolder: 0,
    getEvents: 0,
    getFolderItems: 0,
    updateFileById: 0,
    updateFolderById: 0,
    uploadFile: 0,
    uploadFileVersion: 0,
  };

  let sequence = 0;
  const nextId = (prefix: string): string => {
    sequence += 1;
    return `${prefix}-${sequence}`;
  };

  const childrenOf = (parentId: string): ReadonlyArray<FakeItem> =>
    [...items.values()].filter((item) => item.parentId === parentId);

  const hasFolderNamed = (parentId: string, name: string): boolean =>
    childrenOf(parentId).some((item) => item.type === "folder" && item.name === name);

  const folderResponse = (item: FakeItem) => ({
    id: item.id,
    name: item.name,
    parent: { id: item.parentId, type: "folder" },
    type: "folder",
  });

  const fileEntry = (item: FakeItem) => ({
    id: item.id,
    name: item.name,
    parent: { id: item.parentId, type: "folder" },
    type: "file",
  });

  const seedFolder = (parentId: string, name: string): string => {
    const id = nextId("folder");
    items.set(id, { content: "", id, name, parentId, type: "folder", version: 1 });
    return id;
  };

  const seedFile = (parentId: string, name: string, content: string): string => {
    const id = nextId("file");
    items.set(id, { content, id, name, parentId, type: "file", version: 1 });
    return id;
  };

  const seedEvents = (entries: ReadonlyArray<Record<string, unknown>>): void => {
    eventLog.push(...entries);
  };

  const requireItem = (id: string): Promise<FakeItem> => {
    const item = items.get(id);
    return item === undefined ? Promise.reject({ responseInfo: { statusCode: 404 } }) : Promise.resolve(item);
  };

  const base: FakeBoxClient = {
    events: {
      getEvents: (queryParams) => {
        counts.getEvents += 1;
        receivedEventQueries.push(queryParams);
        const start =
          queryParams.streamPosition === undefined || queryParams.streamPosition === "now"
            ? eventLog.length
            : Number.parseInt(queryParams.streamPosition, 10);
        return Promise.resolve({
          entries: eventLog.slice(start),
          nextStreamPosition: eventLog.length,
        });
      },
    },
    files: {
      updateFileById: (fileId, optionalsInput) => {
        counts.updateFileById += 1;
        return requireItem(fileId).then((item) => {
          const body = optionalsInput.requestBody;
          if (body?.name !== undefined) {
            item.name = body.name;
          }
          if (body?.parent !== undefined) {
            item.parentId = body.parent.id;
          }
          return fileEntry(item);
        });
      },
    },
    folders: {
      createFolder: (requestBody) => {
        counts.createFolder += 1;
        if (hasFolderNamed(requestBody.parent.id, requestBody.name)) {
          return Promise.reject(nameConflictRejection);
        }
        const id = seedFolder(requestBody.parent.id, requestBody.name);
        const created = items.get(id);
        return created === undefined ? Promise.reject(nameConflictRejection) : Promise.resolve(folderResponse(created));
      },
      getFolderItems: (folderId) => {
        counts.getFolderItems += 1;
        return Promise.resolve({
          entries: childrenOf(folderId).map((item) =>
            item.type === "folder" ? folderResponse(item) : fileEntry(item)
          ),
        });
      },
      updateFolderById: (folderId, optionalsInput) => {
        counts.updateFolderById += 1;
        return requireItem(folderId).then((item) => {
          const body = optionalsInput.requestBody;
          if (body?.name !== undefined) {
            item.name = body.name;
          }
          if (body?.parent !== undefined) {
            item.parentId = body.parent.id;
          }
          return folderResponse(item);
        });
      },
    },
    uploads: {
      uploadFile: (requestBody) => {
        counts.uploadFile += 1;
        return readableText(requestBody.file).then((content) => {
          const id = nextId("file");
          const item: FakeItem = {
            content,
            id,
            name: requestBody.attributes.name,
            parentId: requestBody.attributes.parent?.id ?? "0",
            type: "file",
            version: 1,
          };
          items.set(id, item);
          return { entries: [fileEntry(item)], totalCount: 1 };
        });
      },
      uploadFileVersion: (fileId, requestBody) => {
        counts.uploadFileVersion += 1;
        return requireItem(fileId).then((item) =>
          readableText(requestBody.file).then((content) => {
            item.content = content;
            item.name = requestBody.attributes.name;
            item.version += 1;
            return { entries: [fileEntry(item)], totalCount: 1 };
          })
        );
      },
    },
  };

  const client: FakeBoxClient = {
    events: { ...base.events, ...overrides.events },
    files: { ...base.files, ...overrides.files },
    folders: { ...base.folders, ...overrides.folders },
    uploads: { ...base.uploads, ...overrides.uploads },
  };

  return { client, counts, eventLog, items, receivedEventQueries, seedEvents, seedFile, seedFolder };
};

type FakeBoxHarness = ReturnType<typeof makeFakeBox>;
const $I = $DocumentsServerId.create("test/DmsMirrorBox.test");
class FakeBoxFixture extends Context.Service<FakeBoxFixture, FakeBoxHarness>()($I`FakeBoxFixture`) {}

const withFakeBox = <A>(adapter: (fake: FakeBoxHarness) => Layer.Layer<A>) =>
  Layer.unwrap(Effect.map(FakeBoxFixture, adapter)).pipe(Layer.provideMerge(Layer.sync(FakeBoxFixture, makeFakeBox)));

const defaultConfig = BoxMirrorConfigValue.make({ mirrorRootName: BOX_MIRROR_DEFAULT_ROOT_NAME });

const mirrorLayer = (fake: FakeBoxHarness, config: BoxMirrorConfigValue = defaultConfig) =>
  DmsMirrorBoxLayer.pipe(
    Layer.provide(Layer.merge(Box.makeLayerFromClient(fake.client), BoxMirrorConfig.layerConfig(config)))
  );

const availabilityLayer = (fake: FakeBoxHarness, config: BoxMirrorConfigValue = defaultConfig) =>
  DmsMirrorAvailabilityBoxLayer.pipe(
    Layer.provide(Layer.merge(Box.makeLayerFromClient(fake.client), BoxMirrorConfig.layerConfig(config)))
  );

const fileSource = (id: string, name: string, parentId: string) => ({
  id,
  name,
  parent: { id: parentId, type: "folder" },
  type: "file",
});

const folderSource = (id: string, name: string, parentId: string) => ({
  id,
  name,
  parent: { id: parentId, type: "folder" },
  type: "folder",
});

const staleRemoteFileId = RemoteItemId.make("file-9");

const boxEvent = (eventId: string, eventType: string, source?: Record<string, unknown>): Record<string, unknown> => ({
  eventId,
  eventType,
  ...(source === undefined ? {} : { source }),
});
const encodeBoxMirrorConfigValue = S.encodeResult(BoxMirrorConfigValue);
const decodeBoxMirrorConfigValue = S.decodeUnknownResult(BoxMirrorConfigValue);
const equivalentBoxMirrorConfigValue = S.toEquivalence(BoxMirrorConfigValue);

describe("@beep/documents-server DmsMirrorBox", () => {
  it.layer(Layer.fresh(withFakeBox(mirrorLayer)), { timeout: "10 seconds" })((it) => {
    it.effect(
      "resolves an existing mirror root once and caches it",
      Effect.fnUntraced(function* () {
        const fake = yield* FakeBoxFixture;
        const rootId = fake.seedFolder("0", BOX_MIRROR_DEFAULT_ROOT_NAME);

        const program = Effect.gen(function* () {
          const mirror = yield* DmsMirror;
          const first = yield* mirror.ensureFolder(EnsureFolderInput.make({ name: "matters" }));
          const second = yield* mirror.ensureFolder(EnsureFolderInput.make({ name: "correspondence" }));
          return { first, second };
        });

        const { first, second } = yield* program;

        expect(first.itemKind).toBe("folder");
        assertNone(first.parentRemoteId);
        assertNone(second.parentRemoteId);
        expect(fake.items.get(first.remoteId)?.parentId).toBe(rootId);
        expect(fake.counts.getFolderItems).toBe(1);
        expect(fake.counts.createFolder).toBe(2);
      })
    );
  });

  it.layer(Layer.fresh(withFakeBox(mirrorLayer)), { timeout: "10 seconds" })((it) => {
    it.effect(
      "creates the mirror root under the Box root when missing",
      Effect.fnUntraced(function* () {
        const fake = yield* FakeBoxFixture;

        const mirror = yield* DmsMirror;
        const item = yield* mirror.ensureFolder(EnsureFolderInput.make({ name: "matters" }));

        const root = [...fake.items.values()].find((candidate) => candidate.name === BOX_MIRROR_DEFAULT_ROOT_NAME);

        assertNone(item.parentRemoteId);
        expect(root?.parentId).toBe("0");
        expect(fake.counts.createFolder).toBe(2);
      })
    );
  });

  it.layer(
    Layer.fresh(
      withFakeBox((fake) => mirrorLayer(fake, BoxMirrorConfigValue.make({ mirrorRootName: "custom-vault" })))
    ),
    { timeout: "10 seconds" }
  )((it) => {
    it.effect(
      "honors the configured mirror root name",
      Effect.fnUntraced(function* () {
        const fake = yield* FakeBoxFixture;

        const mirror = yield* DmsMirror;
        yield* mirror.ensureFolder(EnsureFolderInput.make({ name: "matters" }));

        const root = [...fake.items.values()].find((candidate) => candidate.name === "custom-vault");

        expect(root?.parentId).toBe("0");
      })
    );
  });

  it.layer(Layer.fresh(withFakeBox(mirrorLayer)), { timeout: "10 seconds" })((it) => {
    it.effect(
      "returns the existing folder when Box reports a name conflict",
      Effect.fnUntraced(function* () {
        const fake = yield* FakeBoxFixture;

        const mirror = yield* DmsMirror;
        const initial = yield* mirror.ensureFolder(EnsureFolderInput.make({ name: "matters" }));
        const repeat = yield* mirror.ensureFolder(EnsureFolderInput.make({ name: "matters" }));
        const { first, second } = { first: initial, second: repeat };

        expect(second.remoteId).toBe(first.remoteId);
        expect(second.itemKind).toBe("folder");
        expect(second.name).toBe("matters");
        expect(fake.counts.createFolder).toBe(3);
        expect(fake.counts.getFolderItems).toBe(2);
      })
    );
  });

  it.effect(
    "resolves a mirror root that only appears on a later folder-items page",
    Effect.fnUntraced(function* () {
      const rootId = "folder-root-page-2";
      const markers: Array<string | undefined> = [];
      const fake = makeFakeBox({
        folders: {
          getFolderItems: (folderId, optionalsInput) => {
            if (folderId !== "0") {
              return Promise.resolve({ entries: [] });
            }
            const marker = optionalsInput.queryParams?.marker;
            markers.push(marker);
            return marker === undefined
              ? Promise.resolve({
                  entries: [folderSource("folder-decoy", "other-vault", "0")],
                  nextMarker: "page-2",
                })
              : Promise.resolve({
                  entries: [folderSource(rootId, BOX_MIRROR_DEFAULT_ROOT_NAME, "0")],
                  nextMarker: null,
                });
          },
        },
      });

      const probe = yield* Effect.gen(function* () {
        const availability = yield* DmsMirrorAvailability;
        return yield* availability.probe;
      }).pipe(provideScopedLayer(availabilityLayer(fake)));

      pipe(probe.connected, assertTrue);
      assertSome<string>(probe.rootRemoteId, rootId);
      // The first page (no marker) missed the root; the second page found it.
      expect(markers).toEqual([undefined, "page-2"]);
      expect(fake.counts.createFolder).toBe(0);
    })
  );

  it.effect(
    "recovers the mirror root from a create name conflict by re-resolving the existing id",
    Effect.fnUntraced(function* () {
      const rootId = "folder-root-conflict";
      let rootVisible = false;
      let getFolderItemsCalls = 0;
      let createFolderCalls = 0;
      const fake = makeFakeBox({
        folders: {
          getFolderItems: (folderId) => {
            getFolderItemsCalls += 1;
            return Promise.resolve({
              entries: rootVisible && folderId === "0" ? [folderSource(rootId, BOX_MIRROR_DEFAULT_ROOT_NAME, "0")] : [],
            });
          },
          createFolder: () => {
            // A concurrent creator won the race: our create conflicts and the
            // root is now visible to the recovery lookup.
            createFolderCalls += 1;
            rootVisible = true;
            return Promise.reject(nameConflictRejection);
          },
        },
      });

      const probe = yield* Effect.gen(function* () {
        const availability = yield* DmsMirrorAvailability;
        return yield* availability.probe;
      }).pipe(provideScopedLayer(availabilityLayer(fake)));

      pipe(probe.connected, assertTrue);
      assertSome<string>(probe.rootRemoteId, rootId);
      expect(createFolderCalls).toBe(1);
      // One lookup found nothing, the create conflicted, the recovery lookup won.
      expect(getFolderItemsCalls).toBe(2);
    })
  );

  it.layer(Layer.fresh(withFakeBox(mirrorLayer)), { timeout: "10 seconds" })((it) => {
    it.effect(
      "uploads a file and maps the remote item",
      Effect.fnUntraced(function* () {
        const fake = yield* FakeBoxFixture;

        const mirror = yield* DmsMirror;
        const parent = yield* mirror.ensureFolder(EnsureFolderInput.make({ name: "matters" }));
        const nested = yield* mirror.uploadFile(
          UploadFileInput.make({
            content: Buffer.from("complaint-v1"),
            name: "complaint.pdf",
            parentRemoteId: O.some(parent.remoteId),
          })
        );
        const rooted = yield* mirror.uploadFile(
          UploadFileInput.make({
            content: Buffer.from("note-v1"),
            name: "note.txt",
          })
        );
        const { folder, inRoot, uploaded } = { folder: parent, inRoot: rooted, uploaded: nested };

        expect(uploaded.itemKind).toBe("file");
        expect(uploaded.name).toBe("complaint.pdf");
        assertSome(uploaded.parentRemoteId, folder.remoteId);
        expect(fake.items.get(uploaded.remoteId)?.content).toBe("complaint-v1");
        assertNone(inRoot.parentRemoteId);
        expect(fake.counts.uploadFile).toBe(2);
      })
    );
  });

  it.layer(Layer.fresh(withFakeBox(mirrorLayer)), { timeout: "10 seconds" })((it) => {
    it.effect(
      "uploads a new version of an existing file",
      Effect.fnUntraced(function* () {
        const fake = yield* FakeBoxFixture;

        const mirror = yield* DmsMirror;
        const initial = yield* mirror.uploadFile(
          UploadFileInput.make({
            content: Buffer.from("complaint-v1"),
            name: "complaint.pdf",
          })
        );
        const next = yield* mirror.uploadFileVersion(
          UploadFileVersionInput.make({
            content: Buffer.from("complaint-v2"),
            name: "complaint.pdf",
            remoteId: initial.remoteId,
          })
        );
        const { uploaded, versioned } = { uploaded: initial, versioned: next };

        expect(versioned.remoteId).toBe(uploaded.remoteId);
        expect(versioned.itemKind).toBe("file");
        expect(fake.items.get(uploaded.remoteId)?.content).toBe("complaint-v2");
        expect(fake.items.get(uploaded.remoteId)?.version).toBe(2);
        expect(fake.counts.uploadFileVersion).toBe(1);
      })
    );
  });

  it.effect(
    "recovers an upload name conflict by versioning the existing file",
    Effect.fnUntraced(function* () {
      const fake = makeFakeBox({
        uploads: { uploadFile: () => Promise.reject(nameConflictRejection) },
      });
      const rootId = fake.seedFolder("0", BOX_MIRROR_DEFAULT_ROOT_NAME);
      const existingFileId = fake.seedFile(rootId, "complaint.pdf", "complaint-v1");

      const versioned = yield* Effect.gen(function* () {
        const mirror = yield* DmsMirror;
        return yield* mirror.uploadFile(
          UploadFileInput.make({ content: Buffer.from("complaint-v2"), name: "complaint.pdf" })
        );
      }).pipe(provideScopedLayer(mirrorLayer(fake)));

      expect(versioned.remoteId).toBe(existingFileId);
      expect(versioned.itemKind).toBe("file");
      expect(versioned.name).toBe("complaint.pdf");
      expect(fake.items.get(existingFileId)?.content).toBe("complaint-v2");
      expect(fake.items.get(existingFileId)?.version).toBe(2);
      expect(fake.counts.uploadFileVersion).toBe(1);
    })
  );

  it.layer(Layer.fresh(withFakeBox(mirrorLayer)), { timeout: "10 seconds" })((it) => {
    it.effect(
      "moves files and folders between parents",
      Effect.fnUntraced(function* () {
        const fake = yield* FakeBoxFixture;

        const mirror = yield* DmsMirror;
        const source = yield* mirror.ensureFolder(EnsureFolderInput.make({ name: "matters" }));
        const target = yield* mirror.ensureFolder(EnsureFolderInput.make({ name: "archive" }));
        const file = yield* mirror.uploadFile(
          UploadFileInput.make({
            content: Buffer.from("complaint-v1"),
            name: "complaint.pdf",
            parentRemoteId: O.some(source.remoteId),
          })
        );
        const fileMove = yield* mirror.moveItem(
          MoveItemInput.make({
            itemKind: "file",
            newParentRemoteId: O.some(target.remoteId),
            remoteId: file.remoteId,
          })
        );
        const folderMove = yield* mirror.moveItem(
          MoveItemInput.make({
            itemKind: "folder",
            newParentRemoteId: O.some(target.remoteId),
            remoteId: source.remoteId,
          })
        );
        const rootMove = yield* mirror.moveItem(
          MoveItemInput.make({
            itemKind: "file",
            newParentRemoteId: O.none(),
            remoteId: file.remoteId,
          })
        );
        const { destination, movedFile, movedFolder, movedToRoot, uploaded } = {
          destination: target,
          movedFile: fileMove,
          movedFolder: folderMove,
          movedToRoot: rootMove,
          uploaded: file,
        };

        assertSome(movedFile.parentRemoteId, destination.remoteId);
        assertSome(movedFolder.parentRemoteId, destination.remoteId);
        assertNone(movedToRoot.parentRemoteId);
        expect(fake.items.get(uploaded.remoteId)?.parentId).not.toBe(destination.remoteId);
        expect(fake.counts.updateFileById).toBe(2);
        expect(fake.counts.updateFolderById).toBe(1);
      })
    );
  });

  it.layer(Layer.fresh(withFakeBox(mirrorLayer)), { timeout: "10 seconds" })((it) => {
    it.effect(
      "renames files and folders in place",
      Effect.fnUntraced(function* () {
        const fake = yield* FakeBoxFixture;

        const mirror = yield* DmsMirror;
        const parent = yield* mirror.ensureFolder(EnsureFolderInput.make({ name: "matters" }));
        const file = yield* mirror.uploadFile(
          UploadFileInput.make({
            content: Buffer.from("complaint-v1"),
            name: "complaint.pdf",
            parentRemoteId: O.some(parent.remoteId),
          })
        );
        const fileRename = yield* mirror.renameItem(
          RenameItemInput.make({
            itemKind: "file",
            newName: "amended-complaint.pdf",
            remoteId: file.remoteId,
          })
        );
        const folderRename = yield* mirror.renameItem(
          RenameItemInput.make({
            itemKind: "folder",
            newName: "closed-matters",
            remoteId: parent.remoteId,
          })
        );
        const { folder, renamedFile, renamedFolder, uploaded } = {
          folder: parent,
          renamedFile: fileRename,
          renamedFolder: folderRename,
          uploaded: file,
        };

        expect(renamedFile.name).toBe("amended-complaint.pdf");
        assertSome(renamedFile.parentRemoteId, folder.remoteId);
        expect(renamedFolder.name).toBe("closed-matters");
        expect(fake.items.get(uploaded.remoteId)?.name).toBe("amended-complaint.pdf");
        expect(fake.items.get(folder.remoteId)?.name).toBe("closed-matters");
      })
    );
  });

  it.layer(Layer.fresh(withFakeBox(mirrorLayer)), { timeout: "10 seconds" })((it) => {
    it.effect(
      "bootstraps event polling at the provider now",
      Effect.fnUntraced(function* () {
        const fake = yield* FakeBoxFixture;
        fake.seedFolder("0", BOX_MIRROR_DEFAULT_ROOT_NAME);
        fake.seedEvents([
          boxEvent("evt-1", "ITEM_CREATE", fileSource("f-1", "a.pdf", "d-1")),
          boxEvent("evt-2", "ITEM_UPLOAD", fileSource("f-2", "b.pdf", "d-1")),
        ]);

        const mirror = yield* DmsMirror;
        const page = yield* mirror.pollEvents(PollEventsInput.make({}));

        expect(page.entries).toEqual([]);
        expect(page.nextStreamPosition).toBe("2");
        expect(fake.receivedEventQueries[0]).toMatchObject({
          limit: 100,
          streamPosition: "now",
          streamType: "changes",
        });
      })
    );
  });

  it.layer(Layer.fresh(withFakeBox(mirrorLayer)), { timeout: "10 seconds" })((it) => {
    it.effect(
      "maps polled events and advances the stream window",
      Effect.fnUntraced(function* () {
        const fake = yield* FakeBoxFixture;
        fake.seedEvents([
          boxEvent("evt-1", "ITEM_CREATE", fileSource("f-1", "a.pdf", "d-1")),
          boxEvent("evt-2", "ITEM_UPLOAD", fileSource("f-2", "b.pdf", "d-1")),
          boxEvent("evt-3", "ITEM_RENAME", fileSource("f-1", "a2.pdf", "d-1")),
          boxEvent("evt-4", "ITEM_MOVE", fileSource("f-1", "a2.pdf", "d-2")),
          boxEvent("evt-5", "ITEM_TRASH", fileSource("f-2", "b.pdf", "d-1")),
          boxEvent("evt-6", "ITEM_MODIFY", fileSource("f-1", "a2.pdf", "d-2")),
          boxEvent("evt-7", "SOMETHING_ELSE"),
        ]);

        const mirror = yield* DmsMirror;
        const full = yield* mirror.pollEvents(PollEventsInput.make({ streamPosition: O.some("0") }));
        const windowed = yield* mirror.pollEvents(PollEventsInput.make({ streamPosition: O.some("5") }));
        const { firstPage, secondPage } = { firstPage: full, secondPage: windowed };

        expect(A.map(firstPage.entries, (entry) => entry.eventType)).toEqual([
          "created",
          "created",
          "renamed",
          "moved",
          "deleted",
          "edited",
          "unknown",
        ]);
        expect(firstPage.nextStreamPosition).toBe("7");

        const first = O.getOrThrow(A.head(firstPage.entries));
        expect(first.eventId).toBe("evt-1");
        assertSome<string>(first.itemKind, "file");
        assertSome<string>(first.name, "a.pdf");
        assertSome<string>(first.parentRemoteId, "d-1");
        assertSome<string>(first.remoteId, "f-1");
        expect(first.payload.eventType).toBe("ITEM_CREATE");

        const last = O.getOrThrow(A.last(firstPage.entries));
        expect(last.eventType).toBe("unknown");
        assertNone(last.itemKind);
        assertNone(last.name);
        assertNone(last.remoteId);

        expect(A.map(secondPage.entries, (entry) => entry.eventId)).toEqual(["evt-6", "evt-7"]);
        expect(secondPage.nextStreamPosition).toBe("7");
        expect(fake.receivedEventQueries[1]).toMatchObject({ streamPosition: "5" });
      })
    );
  });

  it.layer(Layer.fresh(withFakeBox(mirrorLayer)), { timeout: "10 seconds" })((it) => {
    it.effect(
      "maps admin-shaped event sources and drops entries without event ids",
      Effect.fnUntraced(function* () {
        const fake = yield* FakeBoxFixture;
        fake.seedEvents([
          { eventType: "ITEM_CREATE", source: fileSource("f-1", "a.pdf", "d-1") },
          boxEvent("evt-2", "ITEM_RENAME", {
            itemId: "d-9",
            itemName: "matters",
            itemType: "folder",
            parent: { id: "d-1", type: "folder" },
          }),
        ]);

        const mirror = yield* DmsMirror;
        const page = yield* mirror.pollEvents(PollEventsInput.make({ streamPosition: O.some("0") }));

        expect(A.map(page.entries, (entry) => entry.eventId)).toEqual(["evt-2"]);

        const entry = O.getOrThrow(A.head(page.entries));
        expect(entry.eventType).toBe("renamed");
        assertSome<string>(entry.itemKind, "folder");
        assertSome<string>(entry.name, "matters");
        assertSome<string>(entry.parentRemoteId, "d-1");
        assertSome<string>(entry.remoteId, "d-9");
      })
    );
  });

  it.effect(
    "translates transient Box failures as retryable",
    Effect.fnUntraced(function* () {
      const rateLimited = makeFakeBox({
        uploads: { uploadFile: () => Promise.reject({ responseInfo: { statusCode: 429 } }) },
      });

      const uploadError = yield* Effect.gen(function* () {
        const mirror = yield* DmsMirror;
        return yield* mirror.uploadFile(
          UploadFileInput.make({ content: Buffer.from("complaint-v1"), name: "complaint.pdf" })
        );
      }).pipe(provideScopedLayer(mirrorLayer(rateLimited)), Effect.flip);

      expect(uploadError._tag).toBe("DmsMirrorUnavailable");
      expect(uploadError.provider).toBe("box");
      pipe(uploadError.retryable, assertTrue);
      expect(uploadError.reason).toContain("uploads.uploadFile");

      const unavailable = makeFakeBox({
        files: { updateFileById: () => Promise.reject({ responseInfo: { statusCode: 503 } }) },
      });

      const renameError = yield* Effect.gen(function* () {
        const mirror = yield* DmsMirror;
        return yield* mirror.renameItem(
          RenameItemInput.make({
            itemKind: "file",
            newName: "amended.pdf",
            remoteId: staleRemoteFileId,
          })
        );
      }).pipe(provideScopedLayer(mirrorLayer(unavailable)), Effect.flip);

      pipe(renameError.retryable, assertTrue);
      expect(renameError.reason).toContain("status 503");
    })
  );

  it.effect(
    "translates permanent Box failures as non-retryable",
    Effect.fnUntraced(function* () {
      const rejected = makeFakeBox({
        uploads: {
          uploadFile: () => Promise.reject({ responseInfo: { code: "bad_request", statusCode: 400 } }),
        },
      });

      const uploadError = yield* Effect.gen(function* () {
        const mirror = yield* DmsMirror;
        return yield* mirror.uploadFile(
          UploadFileInput.make({ content: Buffer.from("complaint-v1"), name: "complaint.pdf" })
        );
      }).pipe(provideScopedLayer(mirrorLayer(rejected)), Effect.flip);

      expect(uploadError._tag).toBe("DmsMirrorUnavailable");
      pipe(uploadError.retryable, assertFalse);
      expect(uploadError.reason).toContain("status 400");
      expect(uploadError.reason).toContain("bad_request");
      // Mirror verbs carry the same probe-facing classification the
      // availability layer reads: an unclassifiable 400 stays the fallback.
      assertSome<string>(uploadError.disconnectReason, "probe-failed");

      const thrown = makeFakeBox({
        events: { getEvents: () => Promise.reject("boom") },
      });

      const pollError = yield* Effect.gen(function* () {
        const mirror = yield* DmsMirror;
        return yield* mirror.pollEvents(PollEventsInput.make({}));
      }).pipe(provideScopedLayer(mirrorLayer(thrown)), Effect.flip);

      expect(pollError._tag).toBe("DmsMirrorUnavailable");
      pipe(pollError.retryable, assertFalse);
    })
  );

  it.layer(Layer.fresh(withFakeBox(availabilityLayer)), { timeout: "10 seconds" })((it) => {
    it.effect(
      "probes the Box availability layer as connected with the resolved mirror root",
      Effect.fnUntraced(function* () {
        const availability = yield* DmsMirrorAvailability;
        const probe = yield* availability.probe;

        pipe(probe.connected, assertTrue);
        expect(probe.provider).toBe("box");
        pipe(probe.rootRemoteId, O.isSome, assertTrue);
        pipe(probe.probedAt, O.isSome, assertTrue);
      })
    );
  });

  it.effect(
    "probes the Box availability layer as disconnected when the driver fails",
    Effect.fnUntraced(function* () {
      const failing = makeFakeBox({
        folders: { getFolderItems: () => Promise.reject("box is down") },
      });
      const probe = yield* Effect.gen(function* () {
        const availability = yield* DmsMirrorAvailability;
        return yield* availability.probe;
      }).pipe(provideScopedLayer(availabilityLayer(failing)));

      pipe(probe.connected, assertFalse);
      assertNone(probe.rootRemoteId);
      // A status-less SDK throw carries no classification signal, so the
      // probe stays on the unclassified fallback.
      assertSome<string>(probe.disconnectReason, "probe-failed");
      pipe(probe.probedAt, O.isSome, assertTrue);
    })
  );

  it.effect(
    "classifies availability probe failures from the Box status",
    Effect.fnUntraced(function* () {
      const probeWithStatus = (statusCode: number) =>
        Effect.gen(function* () {
          const availability = yield* DmsMirrorAvailability;
          return yield* availability.probe;
        }).pipe(
          provideScopedLayer(
            availabilityLayer(
              makeFakeBox({
                folders: { getFolderItems: () => Promise.reject({ responseInfo: { statusCode } }) },
              })
            )
          )
        );

      const unauthorized = yield* probeWithStatus(401);
      pipe(unauthorized.connected, assertFalse);
      assertSome<string>(unauthorized.disconnectReason, "auth-failed");

      const forbidden = yield* probeWithStatus(403);
      assertSome<string>(forbidden.disconnectReason, "root-unreachable");

      const missingRoot = yield* probeWithStatus(404);
      assertSome<string>(missingRoot.disconnectReason, "root-unreachable");

      const rateLimited = yield* probeWithStatus(429);
      assertSome<string>(rateLimited.disconnectReason, "transient");

      const serverDown = yield* probeWithStatus(503);
      assertSome<string>(serverDown.disconnectReason, "transient");

      const badRequest = yield* probeWithStatus(400);
      assertSome<string>(badRequest.disconnectReason, "probe-failed");
    })
  );

  it.effect(
    "falls back to probe-failed when the resolved mirror-root id fails decoding",
    Effect.fnUntraced(function* () {
      // The driver accepts an empty folder id, but RemoteItemId is non-empty:
      // the probe's own decode step fails, which is the SchemaError (not
      // DmsMirrorUnavailable) classification path.
      const malformed = makeFakeBox({
        folders: {
          getFolderItems: () =>
            Promise.resolve({
              entries: [{ id: "", name: BOX_MIRROR_DEFAULT_ROOT_NAME, type: "folder" }],
            }),
        },
      });
      const probe = yield* Effect.gen(function* () {
        const availability = yield* DmsMirrorAvailability;
        return yield* availability.probe;
      }).pipe(provideScopedLayer(availabilityLayer(malformed)));

      pipe(probe.connected, assertFalse);
      assertSome<string>(probe.disconnectReason, "probe-failed");
      assertNone(probe.rootRemoteId);
    })
  );

  it.effect(
    "refresh bypasses the cached probe answer and asks Box again",
    Effect.fnUntraced(function* () {
      // Overrides replace the harness implementation (and its counter), so
      // the override counts its own invocations.
      const calls = { getFolderItems: 0 };
      const failing = makeFakeBox({
        folders: {
          getFolderItems: () => {
            calls.getFolderItems += 1;
            return Promise.reject({ responseInfo: { statusCode: 503 } });
          },
        },
      });
      const outcome = yield* Effect.gen(function* () {
        const availability = yield* DmsMirrorAvailability;
        const first = yield* availability.probe;
        const cached = yield* availability.probe;
        const callsBeforeRefresh = calls.getFolderItems;
        const refreshed = yield* availability.refresh;
        return { callsAfterRefresh: calls.getFolderItems, callsBeforeRefresh, cached, first, refreshed };
      }).pipe(provideScopedLayer(availabilityLayer(failing)));

      pipe(outcome.first.connected, assertFalse);
      // Within the failure TTL a passive probe replays the cached answer …
      expect(outcome.cached).toBe(outcome.first);
      // … while an explicit refresh must actually re-ask Box.
      expect(outcome.callsAfterRefresh).toBeGreaterThan(outcome.callsBeforeRefresh);
      assertSome<string>(outcome.refreshed.disconnectReason, "transient");
      pipe(outcome.refreshed.probedAt, O.isSome, assertTrue);
    })
  );
});

describe("@beep/documents-server BoxMirrorConfig", () => {
  describe("round-trips the config value schema through encode and decode", () => {
    it.prop(
      "BoxMirrorConfigValue",
      { value: Arbitrary.schema(BoxMirrorConfigValue) },
      ({ value }) => {
        const encoded = Result.getOrThrow(encodeBoxMirrorConfigValue(value));
        const decoded = Result.getOrThrow(decodeBoxMirrorConfigValue(encoded));
        assertTrue(equivalentBoxMirrorConfigValue(decoded, value));
      },
      { arbitrary: fcRuns(10) }
    );
  });

  it.layer(BoxMirrorConfigLayer.pipe(Layer.provide(ConfigProvider.layer(ConfigProvider.fromUnknown({})))), {
    timeout: "10 seconds",
  })((it) => {
    it.effect(
      "defaults the mirror root name when the environment is empty",
      Effect.fnUntraced(function* () {
        const config = yield* BoxMirrorConfig;

        expect(config.mirrorRootName).toBe(BOX_MIRROR_DEFAULT_ROOT_NAME);
      })
    );
  });

  it.layer(
    BoxMirrorConfigLayer.pipe(
      Layer.provide(ConfigProvider.layer(ConfigProvider.fromUnknown({ [BOX_MIRROR_ROOT_NAME_ENV]: "custom-vault" })))
    ),
    { timeout: "10 seconds" }
  )((it) => {
    it.effect(
      "reads the mirror root name from the environment",
      Effect.fnUntraced(function* () {
        const config = yield* BoxMirrorConfig;

        expect(config.mirrorRootName).toBe("custom-vault");
      })
    );
  });
});
