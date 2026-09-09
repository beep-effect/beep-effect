import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { createRequire } from "node:module";
import { PassThrough } from "node:stream";
import { Script } from "node:vm";
import { NodeServices } from "@effect/platform-node";
import { expect, it } from "@effect/vitest";
import { Cause, Effect, FileSystem, Match, Order, Path } from "effect";
import * as A from "effect/Array";
import * as Str from "effect/String";
import { strToU8, zipSync } from "fflate";

const require = createRequire(import.meta.url);
const packageInfo = { name: "Test.Runtime", versions: [{ feed: "test", version: "1.0.0" }] };
const entry = "runtimes/linux-x64/native/libonnxruntime.so";
const binary = strToU8("test native binary");
const timestamp = 1_754_546_950;

// Contract of the upstream CommonJS installer, loaded into the test VM below.
type InstallPackages = (
  packages: ReadonlyArray<typeof packageInfo>,
  manifests: ReadonlyArray<{ packagesInfo: typeof packageInfo; pathInPackage: string; filepath: string }>,
  feeds: Record<string, { type: string; index: string }>
) => Promise<void>;

const fixture = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* fs.makeTempDirectoryScoped({ prefix: "beep-onnx-installer-test-" });
  const temp = path.join(root, "tmp");
  yield* fs.makeDirectory(temp);
  const destination = path.join(root, "bin", "libonnxruntime.so");
  const installerPath = path.resolve(path.dirname(require.resolve("onnxruntime-node")), "../script/install-utils.js");
  const installerRequire = createRequire(installerPath);
  const source = yield* fs.readFileString(installerPath);

  // Real ZIP bytes and filesystem operations exercise the installed upstream script.
  // Only NuGet responses, the temp root, and the clock are controlled by the test.
  const install = Effect.fn("OnnxRuntimeInstall.install")(function* (archive: Uint8Array) {
    const module: { exports: { installPackages?: InstallPackages } } = { exports: {} };
    const https = {
      get: (url: string, receive: (response: PassThrough) => void) => {
        const response = Object.assign(new PassThrough(), {
          statusCode: 200,
          headers: { "content-type": "application/json" },
        });
        const payload = Match.value(url).pipe(
          Match.when(Str.endsWith(".nupkg"), () => archive),
          Match.when(
            "https://test.invalid/index.json",
            () => '{"resources":[{"@type":"PackageBaseAddress/3.0.0","@id":"https://test.invalid/packages/"}]}'
          ),
          Match.orElse(() => '{"versions":["1.0.0"]}')
        );
        queueMicrotask(() => {
          receive(response);
          response.end(payload);
        });
        return new EventEmitter();
      },
    };
    yield* Effect.sync(() =>
      new Script(source, { filename: installerPath }).runInNewContext({
        module,
        require: Match.type<string>().pipe(
          Match.when("https", () => https),
          Match.when("os", () => ({ tmpdir: () => temp })),
          Match.orElse(installerRequire)
        ),
        console: { log: () => {}, warn: () => {} },
        Date: { now: () => timestamp },
      })
    );
    const installPackages = module.exports.installPackages;
    assert(installPackages);
    yield* Effect.tryPromise(() =>
      installPackages([packageInfo], [{ packagesInfo: packageInfo, pathInPackage: entry, filepath: destination }], {
        test: { type: "nuget", index: "https://test.invalid/index.json" },
      })
    );
  });
  return { fs, path, root, temp, destination, install, installerRequire };
}).pipe(Effect.withSpan("OnnxRuntimeInstall.fixture"));

it.layer(NodeServices.layer)("ONNX Runtime's patched NuGet installer", (it) => {
  it.effect(
    "loads fflate through the narrowly scoped installer dependency",
    Effect.fnUntraced(function* () {
      const { installerRequire } = yield* fixture;
      expect(installerRequire("adm-zip/package.json").name).toBe("fflate");
      expect(installerRequire("onnxruntime-node/package.json").version).toBe("1.29.0");
    })
  );

  it.effect(
    "installs the selected binary and replaces an existing binary",
    Effect.fnUntraced(function* () {
      const { fs, path, temp, destination, install } = yield* fixture;
      yield* install(zipSync({ [entry]: binary }));
      expect(yield* fs.readFileString(destination)).toBe("test native binary");
      yield* install(zipSync({ [entry]: strToU8("updated binary") }));
      expect(yield* fs.readFileString(destination)).toBe("updated binary");
      expect(yield* fs.readDirectory(temp)).toEqual([]);
      expect(yield* fs.readDirectory(path.dirname(destination))).toEqual(["libonnxruntime.so"]);
    })
  );

  it.effect(
    "does not follow a symlink planted at the former predictable extraction path",
    Effect.fnUntraced(function* () {
      const { fs, path, root, temp, destination, install } = yield* fixture;
      const sentinel = path.join(root, "sentinel");
      yield* fs.writeFileString(sentinel, "untouched");
      const planted = path.join(temp, `onnxruntime-node-pkgs_${timestamp}`, "extracted");
      yield* fs.makeDirectory(planted, { recursive: true });
      yield* fs.symlink(sentinel, path.join(planted, "libonnxruntime.so"));
      yield* install(zipSync({ [entry]: binary }));
      expect(yield* fs.readFileString(sentinel)).toBe("untouched");
      expect(yield* fs.readFileString(destination)).toBe("test native binary");
      expect(yield* fs.readDirectory(temp)).toEqual([`onnxruntime-node-pkgs_${timestamp}`]);
    })
  );

  it.effect(
    "replaces a destination symlink without overwriting the linked file",
    Effect.fnUntraced(function* () {
      const { fs, path, root, destination, install } = yield* fixture;
      const sentinel = path.join(root, "sentinel");
      yield* fs.writeFileString(sentinel, "untouched");
      yield* fs.makeDirectory(path.dirname(destination));
      yield* fs.symlink(sentinel, destination);
      yield* install(zipSync({ [entry]: binary }));
      expect(yield* fs.readFileString(sentinel)).toBe("untouched");
      expect(yield* fs.readFileString(destination)).toBe("test native binary");
      // A regular file cannot be read as a symlink after atomic replacement.
      expect(yield* fs.readLink(destination).pipe(Effect.isFailure)).toBe(true);
    })
  );

  it.effect(
    "ignores archive paths outside the selected manifest entry",
    Effect.fnUntraced(function* () {
      const { fs, path, root, temp, destination, install } = yield* fixture;
      yield* install(zipSync({ [entry]: binary, "../../escaped": strToU8("unwanted") }));
      expect(A.sort(yield* fs.readDirectory(root), Order.String)).toEqual(["bin", "tmp"]);
      expect(yield* fs.readDirectory(temp)).toEqual([]);
      expect(yield* fs.readDirectory(path.dirname(destination))).toEqual(["libonnxruntime.so"]);
    })
  );

  it.effect(
    "rejects missing entries and cleans up the download",
    Effect.fnUntraced(function* () {
      const { fs, temp, destination, install } = yield* fixture;
      const error = yield* install(zipSync({ other: binary })).pipe(
        Effect.catchCause((cause) => Effect.succeed(Cause.pretty(cause)))
      );
      expect(error).toContain(`Failed to find ${entry}`);
      expect(yield* fs.exists(destination)).toBe(false);
      expect(yield* fs.readDirectory(temp)).toEqual([]);
    })
  );

  it.effect(
    "rejects corrupt archives and cleans up the download",
    Effect.fnUntraced(function* () {
      const { fs, temp, destination, install } = yield* fixture;
      const error = yield* install(strToU8("not a ZIP archive")).pipe(
        Effect.catchCause((cause) => Effect.succeed(Cause.pretty(cause)))
      );
      expect(error).toContain("Failed to open NuGet package");
      expect(yield* fs.exists(destination)).toBe(false);
      expect(yield* fs.readDirectory(temp)).toEqual([]);
    })
  );
});
