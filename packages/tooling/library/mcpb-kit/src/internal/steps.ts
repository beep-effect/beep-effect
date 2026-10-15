/**
 * Packaging steps shared by every `.mcpb` command: running tools, copying the
 * DuckDB sidecar, fetching the pinned Windows bindings and auditing the
 * archive.
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
import * as Effect from "effect/Effect";
import * as Base64 from "effect/encoding/Base64";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { McpbPackageFailure } from "../McpbKit.errors.ts";

const $I = $McpbKitId.create("internal/steps");

const DuckDbVersion = "1.5.6-r.1";
/*
 * sha512 integrity for the win32 bindings tarball, copied from bun.lock's
 * entry for @duckdb/node-bindings-win32-x64@1.5.6-r.1. The download is
 * verified against this pin before anything is extracted into a
 * user-installed artifact; a DuckDB catalog bump must update both constants.
 */
const WindowsBindingsSha512 =
  "5Rpn5WXEG5gY/u7Keh+c4kuwG/LiE31pCP9CoCohv+u0aFensk/yRIQVW/CXuIoITky9xFhdRzaWUtAnGTYxJQ==";
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
 * Native addons `bun build --compile` must leave external; the matching
 * bindings package ships beside the executable instead.
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
    { discard: true }
  );
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
  const packageDir = path.join(cacheDir, "node-bindings-win32-x64");
  if (yield* fs.exists(path.join(packageDir, "duckdb.node"))) {
    return packageDir;
  }
  const tarball = path.join(cacheDir, "node-bindings-win32-x64.tgz");
  yield* fs.makeDirectory(packageDir, { recursive: true });
  yield* run(["curl", "--fail", "--location", "--silent", "--show-error", WindowsBindingsUrl, "--output", tarball]);
  const tarballBytes = yield* fs
    .readFile(tarball)
    .pipe(Effect.mapError((cause) => McpbPackageFailure.make({ cause, message: "Failed reading bindings tarball." })));
  const digest = yield* Effect.tryPromise({
    try: () => globalThis.crypto.subtle.digest("SHA-512", Uint8Array.from(tarballBytes).buffer),
    catch: (cause) => McpbPackageFailure.make({ cause, message: "Failed hashing bindings tarball." }),
  });
  const digestBase64 = Base64.encode(new Uint8Array(digest));
  if (digestBase64 !== WindowsBindingsSha512) {
    yield* fs.remove(tarball, { force: true });
    return yield* McpbPackageFailure.make({
      message: `DuckDB win32 bindings tarball failed sha512 verification (got ${digestBase64}).`,
    });
  }
  yield* run(["tar", "-xzf", tarball, "--strip-components=1", "-C", packageDir]);
  return packageDir;
});

/**
 * Fail (and delete the archive) unless it holds only the manifest, the
 * executable and the target's DuckDB bindings, with no forbidden fragment.
 *
 * @since 0.0.0
 */
// fallow-ignore-next-line complexity -- archive gate is deliberately explicit; exercised by package:mcpb on every build
export const assertArchive = Effect.fn("McpbPackage.assertArchive")(function* (options: {
  readonly archivePath: string;
  readonly appName: string;
  readonly nativePackage: string;
  readonly forbiddenFragments: ReadonlyArray<string>;
}) {
  const { appName, archivePath, forbiddenFragments, nativePackage } = options;
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
  const forbidden = A.findFirst(entries, (entry) =>
    A.some(forbiddenFragments, (fragment) => Str.includes(fragment)(entry))
  );
  if (O.isSome(forbidden)) {
    yield* fs.remove(archivePath, { force: true });
    return yield* McpbPackageFailure.make({ message: `Forbidden entry leaked into MCPB: ${forbidden.value}` });
  }
  const allowedExact: ReadonlyArray<string> = [
    "manifest.json",
    appName,
    `${appName}.exe`,
    "node_modules/",
    "node_modules/@duckdb/",
  ];
  const allowed = (entry: string) =>
    A.contains(allowedExact, entry) || Str.startsWith(`node_modules/@duckdb/${nativePackage}/`)(entry);
  const unexpected = A.findFirst(entries, (entry) => !allowed(entry));
  if (O.isSome(unexpected)) {
    yield* fs.remove(archivePath, { force: true });
    return yield* McpbPackageFailure.make({ message: `Unexpected entry in MCPB: ${unexpected.value}` });
  }
  if (!(yield* fs.exists(archivePath))) {
    return yield* McpbPackageFailure.make({ message: `MCPB was not created at "${archivePath}".` });
  }
});
