import { Box, BoxError } from "@beep/box";
import { OnePasswordCli, OnePasswordCliProcessResult } from "@beep/onepassword-cli";
import {
  LibraryBox,
  LibraryBoxFile,
  LibraryBoxFixture,
  libraryBoxAuthMode,
  makeLibraryBoxLayer,
  makeLibraryBoxTest,
  resolveLibraryBoxDriver,
} from "@beep/repo-cli/test/ResearchLibrary";
import { provideScopedLayer } from "@beep/test-utils";
import * as NodeStream from "@effect/platform-node-shared/NodeStream";
import { describe, expect, layer } from "@effect/vitest";
import * as A from "effect/Array";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";

// No case reaches the network: the Box SDK client is a fake handed to `Box.makeLayerFromClient`,
// credential reads go through a recording `op` runner, and Box driver layers are only built.

const bytesOf = (text: string) => new TextEncoder().encode(text);

type FolderPage = {
  readonly entries?: ReadonlyArray<Record<string, unknown>>;
  readonly nextMarker?: string | null;
};
type FolderOptions = { readonly queryParams?: { readonly marker?: string } };
type DownloadOptions = { readonly queryParams?: { readonly version?: string } };

// One fake Box SDK client: folder pages by `<folderId>:<marker>`, file records by id, download chunks by id.
const fakeSdk = (options: {
  readonly pages?: Readonly<Record<string, FolderPage>>;
  readonly files?: Readonly<Record<string, Record<string, unknown>>>;
  readonly chunks?: Readonly<Record<string, ReadonlyArray<Uint8Array>>>;
}) => {
  const listed: Array<string> = [];
  const downloads: Array<readonly [string, string]> = [];
  const client = {
    folders: {
      getFolderItems: (folderId: string, optionals: FolderOptions | undefined) => {
        const key = `${folderId}:${optionals?.queryParams?.marker ?? ""}`;
        listed.push(key);
        const page = options.pages?.[key];
        return page === undefined ? Promise.reject(`folder ${key} is not listed`) : Promise.resolve(page);
      },
    },
    files: {
      getFileById: (fileId: string) => {
        const file = options.files?.[fileId];
        return file === undefined ? Promise.reject(`file ${fileId} is not described`) : Promise.resolve(file);
      },
    },
    downloads: {
      downloadFile: (fileId: string, optionals: DownloadOptions | undefined) => {
        downloads.push([fileId, optionals?.queryParams?.version ?? ""]);
        return Promise.resolve(
          NodeStream.toReadableNever(Stream.fromIterable(options.chunks?.[fileId] ?? A.empty<Uint8Array>()))
        );
      },
    },
  };
  return { client, listed, downloads };
};

const portOver = (client: unknown) => Box.makeLayerFromClient(client).pipe(Effect.succeed, makeLibraryBoxLayer);
// Build a Box port layer for one test body.
const portFrom = <E>(layer: Layer.Layer<LibraryBox, E>) => LibraryBox.pipe(provideScopedLayer(layer));

const boxFile = (id: string, versionId: string, name: string, size: number) =>
  LibraryBoxFile.make({ id, versionId, name, sha1: "", size });

describe("Box driver port", () => {
  layer(Layer.empty, { timeout: "10 seconds" })((it) => {
    it.effect("pages a folder through Box markers, keeps files and folders and defaults missing fields", () =>
      Effect.gen(function* () {
        const sdk = fakeSdk({
          pages: {
            "top:": {
              entries: [
                {
                  type: "file",
                  id: "1",
                  name: "a.pdf",
                  sha1: "abc",
                  size: 3,
                  fileVersion: { id: "11", type: "file_version" },
                },
                { type: "folder", id: "sub" },
                { type: "web_link", id: "w1" },
              ],
              nextMarker: "m2",
            },
            "top:m2": { entries: [{ type: "file", id: "2" }], nextMarker: "" },
            "empty:": {},
          },
        });
        const box = yield* portFrom(portOver(sdk.client));
        const listing = yield* box.listFolder("top");
        expect(listing).toEqual({
          files: [
            LibraryBoxFile.make({ id: "1", versionId: "11", name: "a.pdf", sha1: "abc", size: 3 }),
            LibraryBoxFile.make({ id: "2", versionId: "", name: "2", sha1: "", size: 0 }),
          ],
          folders: ["sub"],
        });
        expect(sdk.listed).toEqual(["top:", "top:m2"]);
        const empty = yield* box.listFolder("empty");
        expect(empty).toEqual({ files: [], folders: [] });
      })
    );

    it.effect("stops a folder listing that never ends after 100 pages", () =>
      Effect.gen(function* () {
        let calls = 0;
        const client = {
          folders: {
            getFolderItems: () => {
              calls++;
              return Promise.resolve({ entries: [], nextMarker: `page-${calls}` });
            },
          },
        };
        const box = yield* portFrom(portOver(client));
        const failure = yield* box.listFolder("loop").pipe(Effect.flip);
        expect([failure.cause, failure.message]).toEqual(["box", "Box folder loop exceeded 100 listing pages."]);
        expect(calls).toBe(100);
      })
    );

    it.effect("describes a file and maps SDK failures to Box library errors", () =>
      Effect.gen(function* () {
        const sdk = fakeSdk({ files: { "7": { type: "file", id: "7", name: "memo.txt", size: 12 } } });
        const box = yield* portFrom(portOver(sdk.client));
        const described = yield* box.describeFile("7");
        expect(described).toEqual(
          LibraryBoxFile.make({ id: "7", versionId: "", name: "memo.txt", sha1: "", size: 12 })
        );
        const lookup = yield* box.describeFile("8").pipe(Effect.flip);
        expect(lookup.cause).toBe("box");
        expect(lookup.message).toMatch(/^Box file lookup failed: /);
        const listing = yield* box.listFolder("missing").pipe(Effect.flip);
        expect(listing.message).toMatch(/^Box folder listing failed: /);
      })
    );

    it.effect("downloads a pinned version in chunks and enforces the byte bound before and during the download", () =>
      Effect.gen(function* () {
        const sdk = fakeSdk({
          chunks: { "1": [bytesOf("ab"), bytesOf("cd")], "2": [bytesOf("abc"), bytesOf("def")] },
        });
        const box = yield* portFrom(portOver(sdk.client));
        const pinned = yield* box.download(boxFile("1", "5", "a.txt", 4), 10);
        expect(new TextDecoder().decode(pinned)).toBe("abcd");
        const current = yield* box.download(boxFile("1", "", "a.txt", 4), 10);
        expect(current.byteLength).toBe(4);
        expect(sdk.downloads).toEqual([
          ["1", "5"],
          ["1", ""],
        ]);

        const declared = yield* box.download(boxFile("2", "1", "b.txt", 6), 4).pipe(Effect.flip);
        expect([declared.cause, declared.message]).toEqual([
          "body-bound",
          "Box file 2 declares 6 bytes above the 4-byte bound.",
        ]);
        expect(sdk.downloads).toHaveLength(2);
        // A file that under-declares its size still stops at the bound while streaming.
        const streamed = yield* box.download(boxFile("2", "1", "b.txt", 1), 4).pipe(Effect.flip);
        expect([streamed.cause, streamed.message]).toEqual(["body-bound", "Box download exceeded the 4-byte bound."]);
      })
    );

    it.effect("resolves the driver once on first use and reports a driver that cannot be built", () =>
      Effect.gen(function* () {
        let resolved = 0;
        const sdk = fakeSdk({ files: { "1": { type: "file", id: "1" } }, pages: { "top:": { entries: [] } } });
        const driver = Effect.sync(() => {
          resolved++;
          return Box.makeLayerFromClient(sdk.client);
        });
        const box = yield* driver.pipe(makeLibraryBoxLayer, portFrom);
        expect(resolved).toBe(0);
        yield* box.describeFile("1");
        yield* box.listFolder("top");
        expect(resolved).toBe(1);

        const broken = BoxError.fromUnknown("files.getFileById", "token endpoint refused").pipe(
          Effect.fail,
          Layer.effect(Box),
          Effect.succeed,
          makeLibraryBoxLayer
        );
        const brokenBox = yield* portFrom(broken);
        const failure = yield* brokenBox.describeFile("1").pipe(Effect.flip);
        expect(failure.message).toMatch(/^Box client setup failed: /);
      })
    );

    it.effect("serves the in-memory port's missing bytes, bound and download log", () =>
      Effect.gen(function* () {
        const decoded = yield* S.decodeEffect(LibraryBoxFixture)({
          folders: {},
          bytes: { "1": bytesOf("abc") },
        });
        expect([decoded.downloads, decoded.subfolders]).toEqual([[], {}]);
        const box = yield* portFrom(makeLibraryBoxTest(decoded));
        const missing = yield* box.download(boxFile("2", "1", "b.txt", 1), 10).pipe(Effect.flip);
        expect(missing.message).toBe("Box item 2 not found.");
        const bound = yield* box.download(boxFile("1", "1", "a.txt", 3), 2).pipe(Effect.flip);
        expect([bound.cause, bound.message]).toEqual(["body-bound", "Box download exceeded the bound."]);
        expect(decoded.downloads).toEqual(["1"]);
      })
    );
  });
});

describe("Box driver credentials", () => {
  // Records every `op read` reference and answers with a fixed secret, or fails every read.
  const opRunner = (exitCode: number) => {
    const reads: Array<string> = [];
    const op = OnePasswordCli.makeLayerFromRunner((_command, args) =>
      Effect.sync(() => {
        reads.push(A.getUnsafe(args, 1));
        return OnePasswordCliProcessResult.make({
          exitCode,
          stderr: exitCode === 0 ? "" : "not found",
          stdout: "resolved",
        });
      })
    );
    return { op, reads };
  };
  const built = (env: Record<string, string>, exitCode = 0) => {
    const runner = opRunner(exitCode);
    return Effect.gen(function* () {
      const op = yield* OnePasswordCli;
      return yield* resolveLibraryBoxDriver(op);
    }).pipe(
      Effect.flatMap(Layer.build),
      Effect.map((context) => [Context.getOption(context, Box).pipe(O.isSome), runner.reads] as const),
      provideScopedLayer(runner.op),
      Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown(env))
    );
  };
  layer(Layer.empty, { timeout: "10 seconds" })((it) => {
    it.effect("treats a Box setting whose configuration source fails as unset", () =>
      Effect.gen(function* () {
        const unreadableUser = ConfigProvider.make((path) =>
          A.getUnsafe(path, 0) === "DMS_BOX_USER_ID"
            ? Effect.fail(new ConfigProvider.SourceError({ message: "user id source is unreadable" }))
            : Effect.undefined
        );
        const mode = yield* libraryBoxAuthMode().pipe(
          Effect.provideService(
            ConfigProvider.ConfigProvider,
            ConfigProvider.orElse(unreadableUser, ConfigProvider.fromUnknown({ CLOUD_BOX_TOKEN: "developer-token" }))
          )
        );
        expect(mode).toBe("developer-token");
      })
    );

    it.effect("builds a developer-token driver without reading 1Password", () =>
      Effect.gen(function* () {
        const result = yield* built({ CLOUD_BOX_TOKEN: "developer-token" });
        expect(result).toEqual([true, []]);
      })
    );

    it.effect("reads the canonical BEEP_SECRETS references for an unset enterprise grant", () =>
      Effect.gen(function* () {
        const result = yield* built({});
        expect(result).toEqual([
          true,
          [
            "op://BEEP_SECRETS/BEEP_SECRETS/DMS_BOX_CLIENT_ID",
            "op://BEEP_SECRETS/BEEP_SECRETS/DMS_BOX_CLIENT_SECRET",
            "op://BEEP_SECRETS/BEEP_SECRETS/DMS_BOX_ENTERPRISE_ID",
          ],
        ]);
      })
    );

    it.effect("uses literal user grant values as is and reads only the op:// references", () =>
      Effect.gen(function* () {
        const env = {
          DMS_BOX_USER_ID: "51443111498",
          DMS_BOX_CLIENT_ID: "literal-client-id",
          DMS_BOX_CLIENT_SECRET: "op://Vault/Box/client-secret",
        };
        const result = yield* built(env);
        expect(result).toEqual([true, ["op://Vault/Box/client-secret"]]);
      })
    );

    it.effect("fails the first Box call when a credential cannot be read", () =>
      Effect.gen(function* () {
        const runner = opRunner(1);
        const port = Layer.unwrap(
          Effect.gen(function* () {
            const op = yield* OnePasswordCli;
            return makeLibraryBoxLayer(resolveLibraryBoxDriver(op));
          })
        ).pipe(Layer.provide(runner.op));
        const box = yield* portFrom(port);
        const failure = yield* box
          .listFolder("0")
          .pipe(Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown({})), Effect.flip);
        expect(failure.cause).toBe("box-config");
        expect(failure.message).toContain("Box credentials unavailable");
        expect(runner.reads).toHaveLength(3);
      })
    );
  });
});
