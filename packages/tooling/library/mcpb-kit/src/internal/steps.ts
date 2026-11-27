/**
 * Packaging steps shared by every `.mcpb` command: running tools, copying the
 * DuckDB sidecar, fetching the pinned Windows bindings and Bun runtime, and
 * auditing the bundle and its archive.
 *
 * Covered by the package's `./internal/*: null` export guard — not part of the
 * public surface.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $McpbKitId } from "@beep/identity/packages";
import * as OptionUtils from "@beep/utils/Option";
import * as A from "effect/Array";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as Base64 from "effect/encoding/Base64";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { McpbPackageFailure } from "../McpbKit.errors.ts";
import type { McpbRuntimePin } from "../McpbKit.models.ts";

const $I = $McpbKitId.create("internal/steps");

const DuckDbVersion = "2.0.1-r.1";
const WindowsBindingsSha512 =
  "tIyo4NP52GhxRz5ReL9wy6JqcMNfsRr2mVOO40lsx9GB8jE1SRyXZEVFoIskQST8jTiSZV+ezLOPIof62Va/SA==";
const WindowsBindingsUrl = `https://registry.npmjs.org/@duckdb/node-bindings-win32-x64/-/node-bindings-win32-x64-${DuckDbVersion}.tgz`;

class BindingsManifest extends S.Opaque<BindingsManifest, { readonly brand: unique symbol }>()(
  S.Struct({ version: S.String }).pipe(
    $I.annoteSchema("BindingsManifest", {
      description: "Version field of an installed DuckDB bindings package manifest.",
    })
  )
) {}
const decodeBindingsPackageJson = S.decodeUnknownEffect(S.fromJsonString(BindingsManifest));

/**
 * Native addons `bun build` must leave external; the matching bindings
 * package ships beside the launch files instead.
 *
 * @since 0.0.0
 */
export const NativeAddonExternals = [
  "@duckdb/node-bindings-linux-x64/duckdb.node",
  "@duckdb/node-bindings-linux-x64-musl/duckdb.node",
  "@duckdb/node-bindings-linux-arm64/duckdb.node",
  "@duckdb/node-bindings-linux-arm64-musl/duckdb.node",
  "@duckdb/node-bindings-darwin-arm64/duckdb.node",
  "@duckdb/node-bindings-darwin-x64/duckdb.node",
  "@duckdb/node-bindings-win32-arm64/duckdb.node",
  "@duckdb/node-bindings-win32-x64/duckdb.node",
];

/**
 * Run a command, inheriting stdio; a non-zero exit fails.
 *
 * @since 0.0.0
 */
export const run = Effect.fn("McpbPackage.run")(function* (
  command: ReadonlyArray<string>,
  options?: { readonly cwd?: string | undefined }
) {
  const result = yield* Effect.tryPromise({
    try: () =>
      Bun.spawn([...command], {
        ...OptionUtils.getSomesStruct({ cwd: O.fromUndefinedOr(options?.cwd) }),
        stderr: "inherit",
        stdout: "inherit",
      }).exited.then((exitCode) => ({ exitCode })),
    catch: (cause) => McpbPackageFailure.make({ cause, message: `Failed to launch "${A.join(command, " ")}".` }),
  });
  if (result.exitCode !== 0) {
    return yield* McpbPackageFailure.make({
      message: `Command failed with exit code ${result.exitCode}: ${A.join(command, " ")}`,
    });
  }
});

/**
 * Copy a DuckDB sidecar directory's entries into the bundle.
 *
 * @since 0.0.0
 */
export const copyDirectory = Effect.fn("McpbPackage.copyDirectory")(function* (source: string, destination: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  yield* fs.makeDirectory(destination, { recursive: true });
  const entries = yield* fs
    .readDirectory(source)
    .pipe(
      Effect.mapError((cause) => McpbPackageFailure.make({ cause, message: `Failed reading sidecars at "${source}".` }))
    );
  yield* Effect.forEach(
    entries,
    (entry) =>
      fs
        .copy(path.join(source, entry), path.join(destination, entry))
        .pipe(
          Effect.mapError((cause) =>
            McpbPackageFailure.make({ cause, message: `Failed copying DuckDB sidecar "${entry}".` })
          )
        ),
    { concurrency: 1, discard: true }
  );
});

const readDownload = Effect.fn("McpbPackage.readDownload")(function* (file: string, what: string) {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs
    .readFile(file)
    .pipe(Effect.mapError((cause) => McpbPackageFailure.make({ cause, message: `Failed reading ${what}.` })));
});

/**
 * Fill one cache entry atomically and return its directory, reusing an entry
 * another run already completed.
 *
 * **Details**
 *
 * The cache is shared by every app and checkout on the machine, so `fill`
 * downloads and unpacks into `<staging>/<entry>` inside a fresh temporary
 * directory under the cache. A complete entry is then renamed into place,
 * and the temporary directory is always removed. When a concurrent run wins
 * the rename, its complete entry is used; an incomplete leftover from an
 * interrupted older run is replaced.
 *
 * @since 0.0.0
 */
const fillCacheEntry = Effect.fnUntraced(function* <E, R>(
  cacheDir: string,
  entry: string,
  marker: string,
  fill: (staging: string, entryDir: string) => Effect.Effect<void, E, R>
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const entryDir = path.join(cacheDir, entry);
  const complete = fs.exists(path.join(entryDir, marker));
  if (yield* complete) {
    return entryDir;
  }
  yield* fs.makeDirectory(cacheDir, { recursive: true });
  yield* Effect.scoped(
    Effect.gen(function* () {
      const staging = yield* fs.makeTempDirectoryScoped({ directory: cacheDir, prefix: `.${entry}-` });
      const unpacked = path.join(staging, entry);
      yield* fs.makeDirectory(unpacked);
      yield* fill(staging, unpacked);
      yield* fs
        .rename(unpacked, entryDir)
        .pipe(
          Effect.catch(() =>
            Effect.flatMap(complete, (won) =>
              won
                ? Effect.void
                : fs
                    .remove(entryDir, { recursive: true, force: true })
                    .pipe(Effect.andThen(fs.rename(unpacked, entryDir)))
            )
          )
        );
    })
  );
  return entryDir;
});

/**
 * Download, verify and unpack the pinned win32 DuckDB bindings into the cache,
 * reusing an earlier unpack.
 *
 * @since 0.0.0
 */
export const ensureWindowsBindings = Effect.fn("McpbPackage.ensureWindowsBindings")(function* (
  cacheDir: string,
  repoRoot: string
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const digest = yield* Digest.Digest;
  const installedManifest = yield* fs
    .readFileString(path.join(repoRoot, "node_modules", "@duckdb", "node-bindings-linux-x64", "package.json"))
    .pipe(
      Effect.flatMap(decodeBindingsPackageJson),
      Effect.mapError((cause) =>
        McpbPackageFailure.make({ cause, message: "Failed reading installed DuckDB bindings." })
      )
    );
  if (installedManifest.version !== DuckDbVersion) {
    return yield* McpbPackageFailure.make({
      message: `Installed DuckDB bindings ${installedManifest.version} differ from pinned ${DuckDbVersion}; update DuckDbVersion and WindowsBindingsSha512 together.`,
    });
  }
  const bindingsEntryPerPinnedVersion = `node-bindings-win32-x64-${DuckDbVersion}`;
  return yield* fillCacheEntry(
    cacheDir,
    bindingsEntryPerPinnedVersion,
    "duckdb.node",
    Effect.fnUntraced(function* (staging, packageDir) {
      const tarball = path.join(staging, `node-bindings-win32-x64-${DuckDbVersion}.tgz`);
      yield* run(["curl", "--fail", "--location", "--silent", "--show-error", WindowsBindingsUrl, "--output", tarball]);
      const tarballBytes = yield* readDownload(tarball, "bindings tarball");
      const digestBase64 = yield* Effect.map(digest.digest(Digest.sha512, tarballBytes), Base64.encode);
      if (digestBase64 !== WindowsBindingsSha512) {
        return yield* McpbPackageFailure.make({
          message: `DuckDB win32 bindings tarball failed sha512 verification (got ${digestBase64}).`,
        });
      }
      yield* run(["tar", "-xzf", tarball, "--strip-components=1", "-C", packageDir]);
    })
  );
});

/**
 * Download, verify and unpack a pinned official Bun runtime into the cache,
 * reusing an earlier unpack, and return the path of its executable.
 *
 * **Details**
 *
 * The pin must name the repository's `.bun-version`: the script bundle is
 * built by that Bun, so a Bun bump that leaves the pin behind fails here
 * before anything is downloaded. The archive comes from the Bun GitHub
 * release and is checked against the pinned sha256 before it is unpacked.
 *
 * @since 0.0.0
 */
export const ensureRuntime = Effect.fn("McpbPackage.ensureRuntime")(function* (
  pin: McpbRuntimePin,
  cacheDir: string,
  repoRoot: string
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const digest = yield* Digest.Digest;
  const repoVersion = yield* fs.readFileString(path.join(repoRoot, ".bun-version")).pipe(
    Effect.mapBoth({
      onFailure: (cause) => McpbPackageFailure.make({ cause, message: "Failed reading the repository .bun-version." }),
      onSuccess: Str.trim,
    })
  );
  if (repoVersion !== pin.version) {
    return yield* McpbPackageFailure.make({
      message: `Repository .bun-version ${repoVersion} differs from the pinned Bun runtime ${pin.version}; update the runtime pin's version and sha256 together.`,
    });
  }
  const runtimeEntryPerPinnedVersion = `${pin.asset}-${pin.version}`;
  const runtimeDir = yield* fillCacheEntry(
    cacheDir,
    runtimeEntryPerPinnedVersion,
    pin.executable,
    Effect.fnUntraced(function* (staging, unpacked) {
      const archive = path.join(staging, `${pin.asset}-${pin.version}.zip`);
      yield* run([
        "curl",
        "--fail",
        "--location",
        "--silent",
        "--show-error",
        `https://github.com/oven-sh/bun/releases/download/bun-v${pin.version}/${pin.asset}.zip`,
        "--output",
        archive,
      ]);
      const archiveBytes = yield* readDownload(archive, "Bun runtime archive");
      const archiveSha256 = yield* digest.digestHex(Digest.sha256, archiveBytes);
      if (archiveSha256 !== pin.sha256) {
        return yield* McpbPackageFailure.make({
          message: `Bun runtime archive ${pin.asset}.zip failed sha256 verification (got ${archiveSha256}).`,
        });
      }
      yield* run(["unzip", "-q", "-j", "-o", archive, `${pin.asset}/${pin.executable}`, "-d", unpacked]);
    })
  );
  return path.join(runtimeDir, pin.executable);
});

const DosMagic = 0x5a4d;
const DosPeHeaderOffsetField = 0x3c;
const PeSignature = 0x4550;
const OptionalHeaderOffsetAfterSignature = 24;
const OptionalHeaders = [
  { magic: 0x10b, directories: 96 },
  { magic: 0x20b, directories: 112 },
];
const CertificateTableIndex = 4;

const readUint = (view: DataView, offset: number, width: 2 | 4): O.Option<number> =>
  offset >= 0 && offset + width <= view.byteLength
    ? O.some(width === 2 ? view.getUint16(offset, true) : view.getUint32(offset, true))
    : O.none();

/**
 * Whether Portable Executable bytes carry an Authenticode certificate table
 * that lies inside the file.
 *
 * **Details**
 *
 * This proves a signature is present, not that it is valid: validity comes
 * from the pinned digest of the release archive the file was unpacked from.
 * Anything that is not a well-formed PE file, a truncated unpack included,
 * counts as unsigned.
 *
 * @since 0.0.0
 */
export const hasCertificateTable = (bytes: Uint8Array): boolean =>
  O.gen(function* () {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const dosMagic = yield* readUint(view, 0, 2);
    const peOffset = yield* readUint(view, DosPeHeaderOffsetField, 4);
    const signature = yield* readUint(view, peOffset, 4);
    const optionalHeader = peOffset + OptionalHeaderOffsetAfterSignature;
    const optionalMagic = yield* readUint(view, optionalHeader, 2);
    const layout = yield* A.findFirst(OptionalHeaders, ({ magic }) => magic === optionalMagic);
    const directories = optionalHeader + layout.directories;
    const directoryCount = yield* readUint(view, directories - 4, 4);
    const tableOffset = yield* readUint(view, directories + CertificateTableIndex * 8, 4);
    const tableSize = yield* readUint(view, directories + CertificateTableIndex * 8 + 4, 4);
    return (
      dosMagic === DosMagic &&
      signature === PeSignature &&
      directoryCount > CertificateTableIndex &&
      tableOffset > 0 &&
      tableSize > 0 &&
      tableOffset + tableSize <= view.byteLength
    );
  }).pipe(O.getOrElse(() => false));

const WindowsBinaryExtensions = [".exe", ".dll", ".node"];

/**
 * Fail unless every Windows binary staged in the bundle carries an
 * Authenticode signature, apart from the named exceptions.
 *
 * **Details**
 *
 * Smart App Control and other Windows application-control policies refuse
 * unsigned executables and have no per-file exception, so an unsigned binary
 * must never reach a bundle unnoticed. `allowedUnsigned` lists the bundle
 * paths that are known to be unsigned upstream and pass on reputation only;
 * each one that ships is logged as a warning.
 *
 * @since 0.0.0
 */
export const assertSignedBinaries = Effect.fn("McpbPackage.assertSignedBinaries")(function* (options: {
  readonly bundleDir: string;
  readonly allowedUnsigned: ReadonlyArray<string>;
}) {
  const { allowedUnsigned, bundleDir } = options;
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const entries = yield* fs
    .readDirectory(bundleDir, { recursive: true })
    .pipe(Effect.mapError((cause) => McpbPackageFailure.make({ cause, message: `Failed listing "${bundleDir}".` })));
  const binaries = A.filter(A.map(entries, Str.replaceAll("\\", "/")), (entry) =>
    A.some(WindowsBinaryExtensions, (extension) => Str.endsWith(extension)(Str.toLowerCase(entry)))
  );
  const unsigned = yield* Effect.filter(binaries, (entry) =>
    fs.readFile(path.join(bundleDir, entry)).pipe(
      Effect.mapBoth({
        onFailure: (cause) => McpbPackageFailure.make({ cause, message: `Failed reading "${entry}".` }),
        onSuccess: (bytes) => !hasCertificateTable(bytes),
      })
    )
  );
  const refused = A.difference(unsigned, allowedUnsigned);
  const accepted = A.intersection(unsigned, allowedUnsigned);
  if (A.isReadonlyArrayNonEmpty(refused)) {
    return yield* McpbPackageFailure.make({
      message: `Unsigned Windows binary in MCPB: ${A.join(refused, ", ")}. Windows application control blocks unsigned executables.`,
    });
  }
  yield* Effect.logWarning("MCPB ships unsigned Windows binaries that pass on reputation only", {
    entries: accepted,
  }).pipe(Effect.when(Effect.succeed(A.isReadonlyArrayNonEmpty(accepted))));
});

/**
 * Fail (and delete the archive) unless it holds exactly the manifest, the
 * target's launch files and its DuckDB bindings, with no forbidden fragment.
 *
 * @since 0.0.0
 */
export const assertArchive = Effect.fn("McpbPackage.assertArchive")(function* (options: {
  readonly archivePath: string;
  readonly files: ReadonlyArray<string>;
  readonly nativePackage: string;
  readonly forbiddenFragments: ReadonlyArray<string>;
}) {
  const { archivePath, files, forbiddenFragments, nativePackage } = options;
  const fs = yield* FileSystem.FileSystem;
  const process = yield* Effect.try({
    try: () => Bun.spawn(["unzip", "-Z1", archivePath], { stderr: "pipe", stdout: "pipe" }),
    catch: (cause) => McpbPackageFailure.make({ cause, message: `Failed inspecting "${archivePath}".` }),
  });
  const output = yield* Effect.tryPromise({
    try: () => new Response(process.stdout).text(),
    catch: (cause) => McpbPackageFailure.make({ cause, message: `Failed reading "${archivePath}" inventory.` }),
  });
  const exitCode = yield* Effect.tryPromise({
    try: () => process.exited,
    catch: (cause) => McpbPackageFailure.make({ cause, message: `Failed waiting for unzip on "${archivePath}".` }),
  });
  if (exitCode !== 0) {
    return yield* McpbPackageFailure.make({ message: `unzip could not inspect "${archivePath}".` });
  }
  const entries = Str.split("\n")(Str.trim(output));
  const refuse = Effect.fnUntraced(function* (message: string) {
    yield* fs.remove(archivePath, { force: true });
    return yield* McpbPackageFailure.make({ message });
  });
  const forbidden = A.findFirst(entries, (entry) =>
    A.some(forbiddenFragments, (fragment) => Str.includes(fragment)(entry))
  );
  if (O.isSome(forbidden)) {
    return yield* refuse(`Forbidden entry leaked into MCPB: ${forbidden.value}`);
  }
  const nativePrefix = `node_modules/@duckdb/${nativePackage}/`;
  const required = ["manifest.json", ...files, `${nativePrefix}duckdb.node`];
  const allowedExact = [...required, "node_modules/", "node_modules/@duckdb/"];
  const unexpected = A.findFirst(
    entries,
    (entry) => !(A.contains(allowedExact, entry) || Str.startsWith(nativePrefix)(entry))
  );
  if (O.isSome(unexpected)) {
    return yield* refuse(`Unexpected entry in MCPB: ${unexpected.value}`);
  }
  const missing = A.findFirst(required, (entry) => !A.contains(entries, entry));
  if (O.isSome(missing)) {
    return yield* refuse(`Missing entry in MCPB: ${missing.value}`);
  }
  if (!(yield* fs.exists(archivePath))) {
    return yield* McpbPackageFailure.make({ message: `MCPB was not created at "${archivePath}".` });
  }
});
