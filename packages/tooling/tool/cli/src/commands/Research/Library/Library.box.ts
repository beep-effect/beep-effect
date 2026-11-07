/**
 * Box acquisition route over the `@beep/box` driver with one receipt per file.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */
import {
  Box,
  BoxCcgConfig,
  BoxDeveloperTokenConfig,
  BoxDownloadFilePayload,
  DownloadFileOptionalsInput,
  DownloadFileQueryParams,
  FilesGetFileByIdPayload,
  FoldersGetFolderItemsPayload,
  GetFileByIdOptionalsInput,
  GetFileByIdQueryParams,
  GetFolderItemsOptionalsInput,
  GetFolderItemsQueryParams,
} from "@beep/box";
import { $RepoCliId } from "@beep/identity/packages";
import { OnePasswordCli } from "@beep/onepassword-cli";
import { LiteralKit } from "@beep/schema";
import { getSomesStruct } from "@beep/utils/Option";
import * as A from "effect/Array";
import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as Hex from "effect/encoding/Hex";
import * as FileSystem from "effect/FileSystem";
import { dual } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import { encodeLibraryJson, LibraryAdapterResult, saveLibraryText } from "./Library.adapter.ts";
import { LibraryError } from "./Library.errors.ts";
import { LibraryArtifact, LibraryCatalog, LibrarySource, LibrarySourceVersion } from "./Library.schemas.ts";
import { hashBytes, loadCatalog, mergeLibraryVersions, saveImmutable, withCatalog } from "./Library.store.ts";
import type { BoxError } from "@beep/box";
import type { LibraryAccessClass } from "./Library.schemas.ts";

const $I = $RepoCliId.create("commands/Research/Library/Library.box");

/**
 * Acquisition route identifier for Box files.
 *
 * **Example** (Recognize the Box route)
 *
 * ```ts
 * import { libraryBoxAdapter } from "@beep/repo-cli/test/ResearchLibrary"
 *
 * console.log(libraryBoxAdapter) // "box"
 * ```
 *
 * @internal
 * @category constants
 * @since 0.0.0
 */
export const libraryBoxAdapter = "box";

/**
 * Largest Box file the route retains.
 *
 * **Example** (Inspect the download bound)
 *
 * ```ts
 * import { LIBRARY_BOX_MAX_BYTES } from "@beep/repo-cli/test/ResearchLibrary"
 *
 * console.log(LIBRARY_BOX_MAX_BYTES) // 200000000
 * ```
 *
 * @internal
 * @category constants
 * @since 0.0.0
 */
export const LIBRARY_BOX_MAX_BYTES = 200_000_000;

const BOX_FILE_URL = "https://app.box.com/file/";
const BOX_FIELDS = ["id", "type", "name", "sha1", "size", "file_version"];

/**
 * Canonical library locator of a Box file.
 *
 * **Example** (Build a Box locator)
 *
 * ```ts
 * import { libraryBoxFileUrl } from "@beep/repo-cli/test/ResearchLibrary"
 *
 * console.log(libraryBoxFileUrl("123")) // "https://app.box.com/file/123"
 * ```
 *
 * @internal
 * @param fileId - Numeric Box identifier of the file.
 * @returns The `app.box.com` file locator.
 * @category utilities
 * @since 0.0.0
 */
export const libraryBoxFileUrl = (fileId: string) => `${BOX_FILE_URL}${fileId}`;

/**
 * Box file id of a library source, when the source is a Box file.
 *
 * **Example** (Read a Box file id)
 *
 * ```ts
 * import { libraryBoxFileId } from "@beep/repo-cli/test/ResearchLibrary"
 *
 * console.log(libraryBoxFileId("https://app.box.com/file/123")) // { _tag: "Some", value: "123" }
 * ```
 *
 * @internal
 * @param canonicalUrl - URL that identifies the library source.
 * @returns The Box file id, or none for non-Box sources.
 * @category utilities
 * @since 0.0.0
 */
export const libraryBoxFileId = (canonicalUrl: string): O.Option<string> =>
  O.flatMap(Str.match(/^https:\/\/app\.box\.com\/file\/(\d+)$/)(canonicalUrl), (match) => O.fromUndefinedOr(match[1]));

/**
 * Captured revision of one Box file version.
 *
 * **Example** (Build a Box captured revision)
 *
 * ```ts
 * import { libraryBoxRevision } from "@beep/repo-cli/test/ResearchLibrary"
 *
 * console.log(libraryBoxRevision("123", "456")) // "123:456"
 * ```
 *
 * @internal
 * @param fileId - Numeric Box identifier of the file.
 * @param versionId - Box identifier of the downloaded file version.
 * @returns `<fileId>:<versionId>`.
 * @category utilities
 * @since 0.0.0
 */
export const libraryBoxRevision: {
  (versionId: string): (fileId: string) => string;
  (fileId: string, versionId: string): string;
} = dual(2, (fileId: string, versionId: string): string => `${fileId}:${versionId}`);

/**
 * Box file observed through the driver: identity, current version and content hash.
 *
 * **Example** (Construct a Box file)
 *
 * ```ts
 * import { LibraryBoxFile } from "@beep/repo-cli/test/ResearchLibrary"
 *
 * console.log(LibraryBoxFile.make({ id: "1", versionId: "2", name: "a.pdf", sha1: "", size: 3 }).name)
 * ```
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export class LibraryBoxFile extends S.Opaque<LibraryBoxFile, { readonly brand: unique symbol }>()(
  S.Struct({
    id: S.String,
    versionId: S.String,
    name: S.String,
    sha1: S.String,
    size: S.Finite,
  }).pipe($I.annoteSchema("LibraryBoxFile", { description: "Box file identity, version and SHA-1." }))
) {}

/**
 * Retained Box download metadata bound to the downloaded bytes.
 *
 * **Example** (Inspect metadata fields)
 *
 * ```ts
 * import { LibraryBoxFileMetadata } from "@beep/repo-cli/test/ResearchLibrary"
 *
 * console.log(Object.keys(LibraryBoxFileMetadata.fields))
 * ```
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export class LibraryBoxFileMetadata extends S.Opaque<LibraryBoxFileMetadata, { readonly brand: unique symbol }>()(
  S.Struct({
    fileId: S.String,
    versionId: S.String,
    name: S.String,
    boxSha1: S.String,
    sha1: S.String,
    sha256: S.String,
    bytes: S.Finite,
  }).pipe(
    $I.annoteSchema("LibraryBoxFileMetadata", {
      description: "Box file id, version and observed hashes for one retained download.",
    })
  )
) {}

const BoxEntry = S.Struct({
  type: S.String,
  id: S.String,
  name: S.optionalKey(S.String),
  sha1: S.optionalKey(S.String),
  size: S.optionalKey(S.Finite),
  fileVersion: S.optionalKey(S.Struct({ id: S.String })),
}).pipe($I.annoteSchema("LibraryBoxEntry", { description: "Fields the Box route reads from a listed item." }));

const toBoxFile = (entry: typeof BoxEntry.Type) =>
  LibraryBoxFile.make({
    id: entry.id,
    versionId: entry.fileVersion?.id ?? "",
    name: entry.name ?? entry.id,
    sha1: entry.sha1 ?? "",
    size: entry.size ?? 0,
  });

/**
 * Library port over Box: list folders, describe files and download bounded bytes.
 *
 * **Example** (Provide a test Box)
 *
 * ```ts
 * import { LibraryBox, makeLibraryBoxTest, LibraryBoxFile } from "@beep/repo-cli/test/ResearchLibrary"
 *
 * const file = LibraryBoxFile.make({ id: "1", versionId: "2", name: "a.txt", sha1: "", size: 1 })
 * console.log(makeLibraryBoxTest({ folders: { "0": [file] }, bytes: { "1": new Uint8Array([1]) } }) !== undefined, LibraryBox)
 * ```
 *
 * @internal
 * @category services
 * @since 0.0.0
 */
export class LibraryBox extends Context.Service<
  LibraryBox,
  {
    readonly listFolder: (
      folderId: string
    ) => Effect.Effect<
      { readonly files: ReadonlyArray<LibraryBoxFile>; readonly folders: ReadonlyArray<string> },
      LibraryError
    >;
    readonly describeFile: (fileId: string) => Effect.Effect<LibraryBoxFile, LibraryError>;
    readonly download: (file: LibraryBoxFile, maxBytes: number) => Effect.Effect<Uint8Array, LibraryError>;
  }
>()($I`LibraryBox`) {}

const boxFailure = (operation: string) => (error: { readonly message: string }) =>
  LibraryError.make({ message: `Box ${operation} failed: ${Str.slice(0, 500)(error.message)}`, cause: "box" });

// Fold chunks while the running total stays within the bound; the fold fails on the first
// chunk that would exceed it, which also cancels the download stream.
const readBounded = (stream: Stream.Stream<Uint8Array, LibraryError>, maxBytes: number) =>
  stream.pipe(
    Stream.runFoldEffect(
      () => ({ chunks: A.empty<Uint8Array>(), total: 0 }),
      (acc, chunk) =>
        acc.total + chunk.byteLength > maxBytes
          ? Effect.fail(
              LibraryError.make({ message: `Box download exceeded the ${maxBytes}-byte bound.`, cause: "body-bound" })
            )
          : Effect.succeed({ chunks: A.append(acc.chunks, chunk), total: acc.total + chunk.byteLength })
    ),
    Effect.map(({ chunks, total }) => {
      const bytes = new Uint8Array(total);
      A.reduce(chunks, 0, (offset, chunk) => {
        bytes.set(chunk, offset);
        return offset + chunk.byteLength;
      });
      return bytes;
    })
  );

const boxCredential = Effect.fn("LibraryBox.credential")(function* (op: OnePasswordCli["Service"], name: string) {
  const configured = yield* Config.Redacted(name).pipe(Config.option, Effect.orElseSucceed(O.none));
  const reference = O.match(configured, {
    onNone: () => O.some(`op://BEEP_SECRETS/BEEP_SECRETS/${name}`),
    onSome: (value) => O.filter(O.some(value.pipe(Redacted.value)), Str.startsWith("op://")),
  });
  if (O.isNone(reference)) return configured;
  return yield* op.read(reference.value).pipe(Effect.option);
});

const unwrap = (value: Redacted.Redacted<string>) => Redacted.value(value);

/**
 * How the Box route authenticates.
 *
 * **Example** (List authentication modes)
 *
 * ```ts
 * import { LibraryBoxAuthMode } from "@beep/repo-cli/test/ResearchLibrary"
 *
 * console.log(LibraryBoxAuthMode.literals) // ["ccg-user", "ccg-enterprise", "developer-token"]
 * ```
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export const LibraryBoxAuthMode = LiteralKit(["ccg-user", "ccg-enterprise", "developer-token"]).pipe(
  $I.annoteSchema("LibraryBoxAuthMode", { description: "Box token subject selected for the library route." })
);

/**
 * Runtime type of {@link LibraryBoxAuthMode}.
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export type LibraryBoxAuthMode = typeof LibraryBoxAuthMode.Type;

const configured = (name: string) =>
  Config.String(name).pipe(
    Config.option,
    Effect.orElseSucceed(() => O.none<string>()),
    Effect.map(O.filter((value: string) => Str.isNonEmpty(Str.trim(value))))
  );

/**
 * Select the Box token subject from the environment.
 *
 * **Details**
 *
 * An explicit `DMS_BOX_USER_ID` or `DMS_BOX_ENTERPRISE_ID` selects the client credentials grant even
 * when `CLOUD_BOX_TOKEN` is set: Bun loads a worktree `.env`, which can carry a stale desktop developer
 * token that would otherwise win. An empty `CLOUD_BOX_TOKEN` counts as unset. Without any of them the
 * grant uses the enterprise subject from `BEEP_SECRETS`.
 *
 * **Example** (Prepare the selection)
 *
 * ```ts
 * import { libraryBoxAuthMode } from "@beep/repo-cli/test/ResearchLibrary"
 * import * as Effect from "effect/Effect";
 *
 * console.log(Effect.isEffect(libraryBoxAuthMode()))
 * ```
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const libraryBoxAuthMode = Effect.fn("LibraryBox.authMode")(function* () {
  const user = yield* configured("DMS_BOX_USER_ID");
  const enterprise = yield* configured("DMS_BOX_ENTERPRISE_ID");
  const token = yield* configured("CLOUD_BOX_TOKEN");
  if (O.isSome(user)) return LibraryBoxAuthMode.Enum["ccg-user"];
  if (O.isSome(enterprise) || O.isNone(token)) return LibraryBoxAuthMode.Enum["ccg-enterprise"];
  return LibraryBoxAuthMode.Enum["developer-token"];
});

/**
 * Resolve the `@beep/box` driver layer for the selected authentication mode.
 *
 * **Details**
 *
 * The developer-token mode reads `CLOUD_BOX_TOKEN`. The client credentials grant reads
 * `DMS_BOX_CLIENT_ID`, `DMS_BOX_CLIENT_SECRET` and the user or enterprise subject; a configured
 * literal value is used as is, a configured `op://` reference or an unset value is read through
 * `op`, and any unreadable credential fails with a `box-config` {@link LibraryError}. Building the
 * returned layer performs no network request.
 *
 * **Example** (Prepare driver resolution)
 *
 * ```ts
 * import { resolveLibraryBoxDriver } from "@beep/repo-cli/test/ResearchLibrary"
 * import { OnePasswordCli } from "@beep/onepassword-cli"
 * import * as Effect from "effect/Effect"
 *
 * const driver = Effect.gen(function* () {
 *   const op = yield* OnePasswordCli
 *   return yield* resolveLibraryBoxDriver(op)
 * })
 * console.log(Effect.isEffect(driver))
 * ```
 *
 * @internal
 * @param op - 1Password CLI service used for `op://` credential references.
 * @returns The Box driver layer for the selected token subject.
 * @category layers
 * @since 0.0.0
 */
export const resolveLibraryBoxDriver: (op: OnePasswordCli["Service"]) => LibraryBoxDriver = Effect.fn(
  "LibraryBox.resolveLayer"
)(function* (op: OnePasswordCli["Service"]) {
  const mode = yield* libraryBoxAuthMode();
  if (mode === "developer-token") {
    const token = yield* Config.Redacted("CLOUD_BOX_TOKEN").pipe(
      Effect.mapError((cause) => LibraryError.make({ message: "CLOUD_BOX_TOKEN is unreadable.", cause }))
    );
    return Box.makeLayer(BoxDeveloperTokenConfig.make({ token }));
  }
  const clientId = yield* boxCredential(op, "DMS_BOX_CLIENT_ID");
  const clientSecret = yield* boxCredential(op, "DMS_BOX_CLIENT_SECRET");
  const subject = yield* boxCredential(op, mode === "ccg-user" ? "DMS_BOX_USER_ID" : "DMS_BOX_ENTERPRISE_ID");
  if (O.isNone(clientId) || O.isNone(clientSecret) || O.isNone(subject))
    return yield* LibraryError.make({
      message:
        "Box credentials unavailable: set the DMS_BOX_* client credentials (op:// references allowed) or CLOUD_BOX_TOKEN.",
      cause: "box-config",
    });
  return Box.makeCcgLayer(
    BoxCcgConfig.make({
      clientId: unwrap(clientId.value),
      clientSecret: clientSecret.value,
      enterpriseId: mode === "ccg-enterprise" ? O.map(subject, unwrap) : O.none(),
      userId: mode === "ccg-user" ? O.map(subject, unwrap) : O.none(),
    })
  );
});

const buildBox = Effect.fn("LibraryBox.build")(function* (driver: LibraryBoxDriver) {
  const layer = yield* driver;
  const context = yield* layer.pipe(Layer.build, Effect.scoped, Effect.mapError(boxFailure("client setup")));
  return Context.get(context, Box);
});

/**
 * Effect that resolves the `@beep/box` driver layer a {@link makeLibraryBoxLayer} port builds on first use.
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export type LibraryBoxDriver = Effect.Effect<Layer.Layer<Box, BoxError>, LibraryError>;

/**
 * Box port over a lazily resolved `@beep/box` driver layer.
 *
 * **Details**
 *
 * The driver is resolved and built once, on the first call, and reused afterwards. Folder listings
 * page through Box markers up to 100 pages, keep `file` and `folder` entries and skip entries that
 * do not decode; downloads stop at the byte bound. Driver `BoxError`s map to `LibraryError`.
 *
 * **Example** (Build a Box port over a fake SDK client)
 *
 * ```ts
 * import { Box } from "@beep/box"
 * import { makeLibraryBoxLayer } from "@beep/repo-cli/test/ResearchLibrary"
 * import * as Effect from "effect/Effect"
 *
 * const layer = makeLibraryBoxLayer(Effect.succeed(Box.makeLayerFromClient({})))
 * console.log(layer !== undefined)
 * ```
 *
 * @internal
 * @param driver - Effect resolving the Box driver layer.
 * @returns A layer serving {@link LibraryBox} over that driver.
 * @category layers
 * @since 0.0.0
 */
export const makeLibraryBoxLayer = (driver: LibraryBoxDriver) =>
  Layer.effect(
    LibraryBox,
    Effect.gen(function* () {
      const box = yield* driver.pipe(buildBox, Effect.cached);
      const describeFile = Effect.fn("LibraryBox.describeFile")(function* (fileId: string) {
        const client = yield* box;
        const file = yield* client.files
          .getFileById(
            FilesGetFileByIdPayload.make({
              fileId,
              optionalsInput: GetFileByIdOptionalsInput.make({
                queryParams: GetFileByIdQueryParams.make({ fields: BOX_FIELDS }),
              }),
            })
          )
          .pipe(Effect.mapError(boxFailure("file lookup")));
        const entry = yield* S.decodeEffect(BoxEntry)(file).pipe(Effect.mapError(boxFailure("file decoding")));
        return toBoxFile(entry);
      });
      const listPage = Effect.fn("LibraryBox.listPage")(function* (folderId: string, marker: O.Option<string>) {
        const client = yield* box;
        const items = yield* client.folders
          .getFolderItems(
            FoldersGetFolderItemsPayload.make({
              folderId,
              optionalsInput: GetFolderItemsOptionalsInput.make({
                queryParams: GetFolderItemsQueryParams.make({
                  fields: BOX_FIELDS,
                  usemarker: true,
                  limit: 1000,
                  ...getSomesStruct({ marker }),
                }),
              }),
            })
          )
          .pipe(Effect.mapError(boxFailure("folder listing")));
        const entries = A.getSomes(A.map(items.entries ?? [], (entry) => S.decodeOption(BoxEntry)(entry)));
        return {
          files: A.map(
            A.filter(entries, (entry) => entry.type === "file"),
            toBoxFile
          ),
          folders: A.map(
            A.filter(entries, (entry) => entry.type === "folder"),
            (entry) => entry.id
          ),
          next: O.filter(O.fromNullishOr(items.nextMarker), Str.isNonEmpty),
        };
      });
      const listFolder = Effect.fn("LibraryBox.listFolder")(function* (folderId: string) {
        const files: Array<LibraryBoxFile> = [];
        const folders: Array<string> = [];
        let marker = O.none<string>();
        for (let page = 0; page < 100; page++) {
          const listed = yield* listPage(folderId, marker);
          files.push(...listed.files);
          folders.push(...listed.folders);
          marker = listed.next;
          if (O.isNone(marker)) return { files, folders };
        }
        return yield* LibraryError.make({
          message: `Box folder ${folderId} exceeded 100 listing pages.`,
          cause: "box",
        });
      });
      const download = Effect.fn("LibraryBox.download")(function* (file: LibraryBoxFile, maxBytes: number) {
        if (file.size > maxBytes)
          return yield* LibraryError.make({
            message: `Box file ${file.id} declares ${file.size} bytes above the ${maxBytes}-byte bound.`,
            cause: "body-bound",
          });
        const client = yield* box;
        const payload = BoxDownloadFilePayload.make({
          fileId: file.id,
          ...(Str.isEmpty(file.versionId)
            ? {}
            : {
                optionalsInput: DownloadFileOptionalsInput.make({
                  queryParams: DownloadFileQueryParams.make({ version: file.versionId }),
                }),
              }),
        });
        const stream = client.downloads.downloadFile(payload).pipe(Stream.mapError(boxFailure("download")));
        return yield* readBounded(stream, maxBytes);
      });
      return LibraryBox.of({ listFolder, describeFile, download });
    })
  );

/**
 * Live Box port over `@beep/box`; credentials resolve through the PATH `op` shim on first use.
 *
 * **Details**
 *
 * {@link libraryBoxAuthMode} picks the token subject. The client credentials grant reads the
 * `DMS_BOX_*` values, each resolved or an `op://` reference, and unset values read the canonical
 * `BEEP_SECRETS` references. A set `DMS_BOX_USER_ID` selects that user instead of the enterprise
 * service account, which cannot see user-owned files. Driver `BoxError`s map to `LibraryError` at this boundary.
 *
 * **Example** (Reference the live Box port)
 *
 * ```ts
 * import { LibraryBoxLive } from "@beep/repo-cli/test/ResearchLibrary"
 *
 * console.log(LibraryBoxLive !== undefined)
 * ```
 *
 * @internal
 * @category layers
 * @since 0.0.0
 */
export const LibraryBoxLive = Layer.unwrap(
  Effect.gen(function* () {
    const op = yield* OnePasswordCli;
    return makeLibraryBoxLayer(resolveLibraryBoxDriver(op));
  })
).pipe(Layer.provide(OnePasswordCli.makeLayer()));

/**
 * Fixture served by {@link makeLibraryBoxTest}: folder listings, subfolders, file bytes and a download log.
 *
 * **Example** (Build an empty fixture)
 *
 * ```ts
 * import { LibraryBoxFixture } from "@beep/repo-cli/test/ResearchLibrary"
 *
 * console.log(LibraryBoxFixture.make({ folders: {}, bytes: {} }).downloads) // []
 * ```
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export class LibraryBoxFixture extends S.Opaque<LibraryBoxFixture, { readonly brand: unique symbol }>()(
  S.Struct({
    folders: S.Record(S.String, S.Array(LibraryBoxFile)),
    subfolders: S.Record(S.String, S.Array(S.String)).pipe(
      S.withConstructorDefault(Effect.succeed({})),
      S.withDecodingDefaultKey(Effect.succeed({}))
    ),
    bytes: S.Record(S.String, S.Uint8Array),
    downloads: S.Array(S.String).pipe(
      S.mutable,
      S.withConstructorDefault(Effect.sync(() => [])),
      S.withDecodingDefaultKey(Effect.sync(() => []))
    ),
  }).pipe($I.annoteSchema("LibraryBoxFixture", { description: "In-memory Box listings, bytes and download log." }))
) {}

/**
 * Deterministic in-memory Box port for tests.
 *
 * **Example** (Build a test port)
 *
 * ```ts
 * import { makeLibraryBoxTest } from "@beep/repo-cli/test/ResearchLibrary"
 *
 * console.log(makeLibraryBoxTest({ folders: {}, bytes: {} }) !== undefined)
 * ```
 *
 * @internal
 * @param fixture - Folder listings, file bytes by id, and an optional list recording downloads.
 * @returns A layer serving the fixture.
 * @category layers
 * @since 0.0.0
 */
export const makeLibraryBoxTest = (fixture: LibraryBoxFixture) => {
  const all = A.flatten(R.values(fixture.folders));
  const missing = (id: string) => LibraryError.make({ message: `Box item ${id} not found.`, cause: "box" });
  const listFolder = Effect.fn("LibraryBoxTest.listFolder")(function* (folderId: string) {
    const files = yield* Effect.fromOption(O.fromUndefinedOr(fixture.folders[folderId])).pipe(
      Effect.mapError(() => missing(folderId))
    );
    return { files, folders: fixture.subfolders[folderId] ?? [] };
  });
  const describeFile = Effect.fn("LibraryBoxTest.describeFile")(function* (fileId: string) {
    return yield* Effect.fromOption(A.findFirst(all, (file) => file.id === fileId)).pipe(
      Effect.mapError(() => missing(fileId))
    );
  });
  const download = Effect.fn("LibraryBoxTest.download")(function* (file: LibraryBoxFile, maxBytes: number) {
    const bytes = yield* Effect.fromOption(O.fromUndefinedOr(fixture.bytes[file.id])).pipe(
      Effect.mapError(() => missing(file.id))
    );
    fixture.downloads.push(file.id);
    if (bytes.byteLength > maxBytes)
      return yield* LibraryError.make({ message: "Box download exceeded the bound.", cause: "body-bound" });
    return bytes;
  });
  return Layer.succeed(LibraryBox, LibraryBox.of({ listFolder, describeFile, download }));
};

/**
 * Hex SHA-1 of downloaded bytes, the hash Box reports for a file version.
 *
 * **Example** (Hash bytes)
 *
 * ```ts
 * import { libraryBoxSha1 } from "@beep/repo-cli/test/ResearchLibrary"
 * import * as Effect from "effect/Effect";
 *
 * console.log(Effect.isEffect(libraryBoxSha1(new Uint8Array([1]))))
 * ```
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const libraryBoxSha1 = Effect.fn("Library.box.sha1")(function* (bytes: Uint8Array) {
  const digest = yield* Digest.Digest;
  const value = yield* digest.digest(Digest.sha1, bytes);
  return Hex.encode(value);
});

const mediaTypeFor = (name: string) =>
  Str.endsWith(".pdf")(Str.toLowerCase(name))
    ? "application/pdf"
    : /\.(?:md|markdown)$/i.test(name)
      ? "text/markdown"
      : /\.(?:txt|vtt|csv)$/i.test(name)
        ? "text/plain"
        : "application/octet-stream";

/**
 * Library source for one Box file; private by default because Box holds operator documents.
 *
 * **Details**
 *
 * The Box file version id is the source revision, so each observed version is acquired once and
 * earlier versions keep their own captures.
 *
 * **Example** (Build a Box source)
 *
 * ```ts
 * import { libraryBoxSource, LibraryBoxFile } from "@beep/repo-cli/test/ResearchLibrary"
 * import * as Effect from "effect/Effect";
 *
 * const file = LibraryBoxFile.make({ id: "1", versionId: "2", name: "a.pdf", sha1: "", size: 3 })
 * console.log(Effect.isEffect(libraryBoxSource(file, "private")))
 * ```
 *
 * @internal
 * @category constructors
 * @since 0.0.0
 */
export const libraryBoxSource = Effect.fn("Library.box.source")(function* (
  file: LibraryBoxFile,
  accessClass: LibraryAccessClass
) {
  const identity = `box:${file.id}`;
  const id = yield* hashBytes(new TextEncoder().encode(identity));
  return LibrarySource.make({
    accessClass,
    id,
    kind: "docs",
    canonicalUrl: libraryBoxFileUrl(file.id),
    identity,
    revision: file.versionId,
    repository: "",
    ownership: "external",
    locators: [libraryBoxFileUrl(file.id)],
    versions: [
      LibrarySourceVersion.make({
        revision: file.versionId,
        canonicalUrl: libraryBoxFileUrl(file.id),
        locators: [libraryBoxFileUrl(file.id)],
      }),
    ],
    topics: [],
    topicDerivation: `box: ${file.name}`,
  });
});

const BoxListing = S.fromJsonString(S.Struct({ files: S.Array(LibraryBoxFile) })).pipe(
  $I.annoteSchema("LibraryBoxListing", { description: "Retained Box listing receipt with file versions." })
);

// The requested version is the current one, or a superseded one whose SHA-1 a retained listing recorded.
const requestedBoxVersion = Effect.fn("Library.box.requestedVersion")(function* (
  root: string,
  current: LibraryBoxFile,
  revision: string
) {
  if (Str.isEmpty(revision) || current.versionId === revision) return O.some(current);
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const catalog = yield* loadCatalog(root);
  const listings = A.filter(catalog.artifacts, (artifact) => artifact.role === "box-listing");
  for (const listing of A.reverse(listings)) {
    const decoded = yield* fs
      .readFileString(path.resolve(root, listing.path))
      .pipe(Effect.flatMap(S.decodeEffect(BoxListing)), Effect.option);
    const match = O.flatMap(decoded, (value) =>
      A.findFirst(value.files, (file) => file.id === current.id && file.versionId === revision)
    );
    if (O.isSome(match)) return match;
  }
  return O.none<LibraryBoxFile>();
});

/**
 * Download the current version of one Box file, verify Box's SHA-1 and retain the original bytes.
 *
 * **Details**
 *
 * The captured revision is `<fileId>:<versionId>`. A superseded version is downloaded by its version id,
 * checked against the SHA-1 its registration listing recorded. Byte-identical downloads share one object under
 * `objects/sha256`, so a resumed run never stores a duplicate.
 *
 * **Example** (Prepare a Box file acquisition)
 *
 * ```ts
 * import { acquireLibraryBoxFile } from "@beep/repo-cli/test/ResearchLibrary"
 *
 * console.log(typeof acquireLibraryBoxFile)
 * ```
 *
 * @internal
 * @category use-cases
 * @since 0.0.0
 */
export const acquireLibraryBoxFile = Effect.fn("Library.acquireBoxFile")(function* (
  root: string,
  source: LibrarySource,
  prefix: string
) {
  const fileId = libraryBoxFileId(source.canonicalUrl);
  if (O.isNone(fileId))
    return LibraryAdapterResult.make({
      artifacts: [],
      revision: "",
      status: "unsupported",
      complete: false,
      reason: "Source is not a Box file locator.",
    });
  const box = yield* LibraryBox;
  const current = yield* box.describeFile(fileId.value);
  const pinned = yield* requestedBoxVersion(root, current, source.revision);
  if (O.isNone(pinned))
    return LibraryAdapterResult.make({
      artifacts: [],
      revision: "",
      status: "blocked",
      complete: false,
      reason: `Box file ${current.id} version ${source.revision} has no retained listing with its SHA-1; re-run acquire --route box to register it.`,
    });
  const file = pinned.value;
  const bytes = yield* box.download(file, LIBRARY_BOX_MAX_BYTES);
  const sha1 = yield* libraryBoxSha1(bytes);
  const safeName = Str.replace(/[^A-Za-z0-9._-]+/g, "_")(file.name);
  const saved = yield* saveImmutable(root, `${prefix}/${Str.isEmpty(safeName) ? "file" : safeName}`, bytes);
  const original = LibraryArtifact.make({
    ...saved,
    accessClass: source.accessClass,
    mediaType: mediaTypeFor(file.name),
    role: "raw-full-text",
  });
  const metadataText = yield* encodeLibraryJson(
    LibraryBoxFileMetadata.make({
      fileId: file.id,
      versionId: file.versionId,
      name: file.name,
      boxSha1: file.sha1,
      sha1,
      sha256: original.sha256,
      bytes: original.bytes,
    })
  );
  const metadata = yield* saveLibraryText(
    root,
    `${prefix}/box-file.json`,
    metadataText,
    "application/json",
    "box-file-metadata"
  );
  const privateMetadata = LibraryArtifact.make({ ...metadata, accessClass: source.accessClass });
  const matches = Str.isNonEmpty(file.sha1) && file.sha1 === sha1 && bytes.byteLength > 0;
  return LibraryAdapterResult.make({
    artifacts: [original, privateMetadata],
    revision: libraryBoxRevision(file.id, file.versionId),
    status: matches ? "readable" : "blocked",
    complete: matches,
    reason: matches
      ? "Box file version downloaded; SHA-1 matches the Box-reported hash."
      : "Box download retained but its SHA-1 did not match the Box-reported hash; evidence incomplete.",
  });
});

/**
 * Options selecting the Box folders and files to register and acquire.
 *
 * **Example** (Select one folder)
 *
 * ```ts
 * import { LibraryBoxAcquireOptions } from "@beep/repo-cli/commands/Research"
 *
 * console.log(LibraryBoxAcquireOptions.make({ folderIds: ["0"], fileIds: [] }).accessClass) // "private"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LibraryBoxAcquireOptions extends S.Opaque<LibraryBoxAcquireOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    folderIds: S.Array(S.String),
    fileIds: S.Array(S.String),
    recursive: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(true)),
      S.withDecodingDefaultTypeKey(Effect.succeed(true))
    ),
    accessClass: S.Literals(["public", "private"]).pipe(
      S.withConstructorDefault(Effect.succeed<"public" | "private">("private")),
      S.withDecodingDefaultTypeKey(Effect.succeed<"public" | "private">("private"))
    ),
    retryFailed: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(false)),
      S.withDecodingDefaultTypeKey(Effect.succeed(false))
    ),
  }).pipe(
    $I.annoteSchema("LibraryBoxAcquireOptions", {
      description: "Box folders and files to list, their access class, and whether failed files retry.",
    })
  )
) {}

const MAX_BOX_FOLDERS = 200;

/**
 * List the selected Box folders and files and register each file version as a library source.
 *
 * **Details**
 *
 * Folders are walked breadth-first up to 200 folders. The listing is retained as an immutable
 * `box-listing` artifact. A file whose current version is new gains a source revision; earlier
 * versions and their captures are kept.
 *
 * **Example** (Prepare a Box registration)
 *
 * ```ts
 * import { registerLibraryBoxSources } from "@beep/repo-cli/commands/Research"
 *
 * console.log(typeof registerLibraryBoxSources)
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const registerLibraryBoxSources = Effect.fn("Library.registerBoxSources")(function* (
  root: string,
  options: LibraryBoxAcquireOptions
) {
  const fs = yield* FileSystem.FileSystem;
  yield* fs
    .makeDirectory(root, { recursive: true })
    .pipe(Effect.mapError((cause) => LibraryError.make({ message: "Cannot create the library root.", cause })));
  const box = yield* LibraryBox;
  const files: Array<LibraryBoxFile> = [];
  let pending = A.fromIterable(options.folderIds);
  let visited = 0;
  while (A.isReadonlyArrayNonEmpty(pending)) {
    const [folderId, ...rest] = pending;
    pending = rest;
    visited++;
    if (visited > MAX_BOX_FOLDERS)
      return yield* LibraryError.make({ message: `Box selection exceeds ${MAX_BOX_FOLDERS} folders.`, cause: "box" });
    const listing = yield* box.listFolder(folderId);
    files.push(...listing.files);
    if (options.recursive) pending = [...pending, ...listing.folders];
  }
  for (const fileId of options.fileIds) {
    const file = yield* box.describeFile(fileId);
    files.push(file);
  }
  const unique = A.dedupeWith(files, (a, b) => a.id === b.id);
  const listingText = yield* encodeLibraryJson({
    folderIds: options.folderIds,
    fileIds: options.fileIds,
    files: unique,
  });
  const listingHash = yield* hashBytes(new TextEncoder().encode(listingText));
  const listing = yield* saveLibraryText(
    root,
    `receipts/box/${listingHash}.json`,
    listingText,
    "application/json",
    "box-listing"
  );
  const sources = yield* Effect.forEach(unique, (file) => libraryBoxSource(file, options.accessClass));
  yield* withCatalog(root, (catalog) =>
    Effect.succeed(
      LibraryCatalog.make({
        ...catalog,
        artifacts: A.some(catalog.artifacts, (item) => item.path === listing.path)
          ? catalog.artifacts
          : [...catalog.artifacts, LibraryArtifact.make({ ...listing, accessClass: options.accessClass })],
        sources: A.reduce(sources, A.fromIterable(catalog.sources), (current, source) =>
          O.match(
            A.findFirst(current, (item) => item.id === source.id),
            {
              onNone: () => [...current, source],
              onSome: (existing) =>
                A.map(current, (item) =>
                  item.id === existing.id
                    ? LibrarySource.make({
                        ...existing,
                        revision: source.revision,
                        versions: mergeLibraryVersions([...existing.versions, ...source.versions]),
                      })
                    : item
                ),
            }
          )
        ),
      })
    )
  );
  return A.map(sources, (source) => source.id);
});
