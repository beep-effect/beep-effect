import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Logger from "effect/Logger";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as PlatformError from "effect/PlatformError";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import { ChildProcessSpawner } from "effect/process";
import { MemoryFileSystem } from "../../effected/memfs/index.ts";
import { PackageManagerPin } from "../../effected/npm/index.ts";
import { ActionEnvironment } from "../../effected/github-actions/ActionEnvironment.ts";
import { PackageManagerInstaller, PackageManagerInstallerError } from "../../effected/github-actions/PackageManagerInstaller.ts";
import { ToolInstaller } from "../../effected/github-actions/ToolInstaller.ts";

const refused = PlatformError.badArgument({ module: "FileSystem", method: "fixture", description: "refused" });
const Json = S.fromJsonString(S.Unknown);
const pin = (spec: string) => Result.getOrThrow(PackageManagerPin.parseResult(spec));
const nativeDependencies = { "@pnpm/exe.linux-x64": "12.0.0", "@pnpm/exe.win32-x64": "12.0.0" };

it("an expected hash without a measured hash reports unverifiable integrity", () => {
  const error = PackageManagerInstallerError.make({
    reason: "integrityMismatch",
    name: "pnpm",
    version: "12.0.0",
    expected: "sha512.expected",
    subject: "/archive",
  });
  assert.strictEqual(error.message, "Could not verify the integrity of pnpm@12.0.0 (/archive)");
});

interface Fixture {
  readonly spec?: string;
  readonly cached?: boolean;
  readonly env?: Record<string, string>;
  readonly manifest?: unknown;
  readonly files?: Record<string, string>;
  readonly packument?: unknown;
  readonly mutate?: (fs: FileSystem.FileSystem) => FileSystem.FileSystem;
}
const runtime = (options: Fixture) => {
  const fsLayer = Layer.effect(FileSystem.FileSystem, Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    yield* fs.makeDirectory("/stage/package/bin", { recursive: true });
    yield* fs.makeDirectory("/native/package", { recursive: true });
    yield* fs.makeDirectory("/bun/bun-linux-x64", { recursive: true });
    yield* fs.makeDirectory("/bun/bun-windows-x64", { recursive: true });
    yield* fs.writeFileString("/archive", "archive");
    yield* fs.writeFileString("/native-archive", "archive");
    yield* fs.writeFileString("/packument", Result.getOrThrow(S.encodeResult(Json)(options.packument ?? { dist: { integrity: "md5-AAAA" } })));
    yield* fs.writeFileString("/stage/package/package.json", Result.getOrThrow(S.encodeResult(Json)(options.manifest ?? { bin: { pnpm: "bin/pnpm.cjs" } })));
    for (const [file, contents] of Object.entries(options.files ?? { "bin/pnpm.cjs": "console.log('pnpm')" })) {
      yield* fs.writeFileString(`/stage/package/${file}`, contents);
    }
    yield* fs.writeFileString("/native/package/pnpm", "native");
    yield* fs.writeFileString("/native/package/pnpm.exe", "native");
    yield* fs.writeFileString("/bun/bun-linux-x64/bun", "bun");
    yield* fs.writeFileString("/bun/bun-windows-x64/bun.exe", "bun");
    return options.mutate === undefined ? fs : options.mutate(fs);
  })).pipe(Layer.provide(MemoryFileSystem.layer));
  const dependencies = Layer.mergeAll(
    fsLayer, Path.layer, Logger.layer([]),
    ActionEnvironment.layerTest(options.env ?? { RUNNER_OS: "Linux", RUNNER_ARCH: "X64" }),
    Layer.succeed(ChildProcessSpawner.ChildProcessSpawner, ChildProcessSpawner.make(() => Effect.die("unexpected subprocess"))),
    ToolInstaller.layerTest({
      find: () => Effect.succeed(options.cached === true ? O.some(options.spec?.startsWith("bun") === true ? "/bun/bun-linux-x64" : "/stage/package") : O.none()),
      download: (url) => Effect.succeed(url.includes("/-/exe.") ? "/native-archive" : url.endsWith(".tgz") || url.endsWith(".zip") ? "/archive" : "/packument"),
      extractTar: (archive) => Effect.succeed(archive === "/native-archive" ? "/native" : "/stage"),
      extractZip: () => Effect.succeed("/bun"),
      cachePath: () => "/stage/package",
      cacheDir: (directory) => Effect.succeed(directory),
      cacheFile: (file) => Effect.succeed(file.includes("bun-windows") ? "/bun/bun-windows-x64" : "/bun/bun-linux-x64"),
    }),
  );
  return Layer.merge(fsLayer, PackageManagerInstaller.layer.pipe(Layer.provide(dependencies)));
};
const fails = (name: string, options: Fixture, reason: string, subject: string) => {
  it.layer(runtime(options), { timeout: "5 seconds" })((it) => {
    it.effect(name, () => Effect.gen(function* () {
      const installer = yield* PackageManagerInstaller;
      const error = yield* Effect.flip(installer.install(pin(options.spec ?? "pnpm@12.0.0")));
      assert.strictEqual(error.reason, reason);
      assert.include(error.subject ?? "", subject);
    }));
  });
};
const nativeManifest = { bin: { pnpm: "pnpm" }, optionalDependencies: nativeDependencies };
const nativeFiles = { pnpm: "#!native" };
fails("missing manifest is a layout error", { mutate: (fs) => ({ ...fs, readFileString: () => Effect.fail(refused) }) }, "layoutUnexpected", "no package.json");
fails("invalid manifest JSON is a layout error", { mutate: (fs) => ({ ...fs, readFileString: () => Effect.succeed("{") }) }, "layoutUnexpected", "unparseable package.json");
for (const bin of [42, {}, { pnpm: 42 }]) {
  fails(`invalid bin declaration ${JSON.stringify(bin)}`, { manifest: { bin } }, "layoutUnexpected", "names no bin");
}
fails("missing bin property is refused", { manifest: {} }, "layoutUnexpected", "names no bin");
fails("unreadable integrity input fails closed", { spec: `pnpm@12.0.0+sha512.${"a".repeat(128)}`, mutate: (fs) => ({ ...fs, stream: () => Stream.fail(refused) }) }, "integrityMismatch", "/archive");
fails("shim writes report the failed path", { mutate: (fs) => ({ ...fs, writeFileString: () => Effect.fail(refused) }) }, "cacheFailed", "/stage/package/.bin/pnpm");
fails("shim chmod reports the failed path", { mutate: (fs) => ({ ...fs, chmod: () => Effect.fail(refused) }) }, "cacheFailed", "/stage/package/.bin/pnpm");
fails("bun chmod reports the binary", { spec: "bun@1.0.0", mutate: (fs) => ({ ...fs, chmod: () => Effect.fail(refused) }) }, "cacheFailed", "/bun/bun-linux-x64/bun");
fails("native manifest must name the manager bin", { manifest: { bin: { pn: "pn" }, optionalDependencies: nativeDependencies }, files: { pn: "#!alias" } }, "layoutUnexpected", "no pnpm bin");
for (const packument of [{}, { dist: {} }, { dist: { integrity: 42 } }]) {
  fails(`native integrity fails closed for ${JSON.stringify(packument)}`, { manifest: nativeManifest, files: nativeFiles, packument }, "integrityMismatch", "@pnpm/exe.linux-x64/12.0.0");
}
fails("unknown platform names the fallback", { manifest: nativeManifest, files: nativeFiles, env: { RUNNER_OS: "", RUNNER_ARCH: "riscv64" } }, "unsupportedPlatform", "unknown/riscv64");
fails("unknown bun platform names the fallback", { spec: "bun@1.0.0", env: { RUNNER_OS: "", RUNNER_ARCH: "riscv64" } }, "unsupportedPlatform", "unknown/riscv64");
for (const options of [
  { cached: true, spec: "bun@1.0.0" },
  { cached: true, manifest: { bin: "./bin/pnpm.cjs", optionalDependencies: { unrelated: "1", "@pnpm/exe.linux-x64": 42 } } },
  { cached: true, manifest: { bin: { pn: "pn" }, optionalDependencies: nativeDependencies }, files: { pn: "#!alias" } },
  { cached: true, env: { RUNNER_OS: "Windows", RUNNER_ARCH: "X64" }, manifest: { bin: { pnpm: "pnpm", extra: "extra.js" }, optionalDependencies: nativeDependencies }, files: { pnpm: "#!native", "pnpm.exe": "native", "extra.js": "console.log('extra')" } },
] satisfies ReadonlyArray<Fixture>) {
  it.layer(runtime(options), { timeout: "5 seconds" })((it) => {
    it.effect(`cache reuse preserves manager bins ${JSON.stringify(options)}`, () => Effect.gen(function* () {
      const installer = yield* PackageManagerInstaller;
      const record = yield* installer.install(pin(options.spec ?? "pnpm@12.0.0"));
      assert.strictEqual(record.source, "tool-cache");
      const fs = yield* FileSystem.FileSystem;
      for (const file of Object.values(record.bins)) assert.isTrue(yield* fs.exists(file));
      if (options.spec === "bun@1.0.0") assert.strictEqual(record.bins.bun, "/bun/bun-linux-x64/bun");
      if (options.env?.RUNNER_OS === "Windows") {
        assert.strictEqual(record.bins.pnpm, "/stage/package/pnpm.exe");
        assert.strictEqual(yield* fs.readFileString("/stage/package/.bin/extra.cmd"), '@echo off\r\nnode -- "/stage/package/extra.js" %*\r\n');
      }
    }));
  });
}

const verifiedPackument = { dist: { integrity: "sha512-sRU36Ok1DOcSWqYvA3z8E7szGJ0jPd3ewR+Oo3NRdlDSb053ZXua6gAZX/g3UdaiFCZ0yyF+PzssiRO+IXhDRA==" } };
for (const runnerOs of ["Linux", "Windows"]) {
  fails(`native copy failure on ${runnerOs} identifies its destination`, {
    env: { RUNNER_OS: runnerOs, RUNNER_ARCH: "X64" }, manifest: nativeManifest, files: nativeFiles, packument: verifiedPackument,
    mutate: (fs) => ({ ...fs, copyFile: () => Effect.fail(refused) }),
  }, "cacheFailed", "/stage/package/pnpm");
}
fails("native chmod failure identifies its destination", {
  manifest: nativeManifest, files: nativeFiles, packument: verifiedPackument,
  mutate: (fs) => ({ ...fs, chmod: () => Effect.fail(refused) }),
}, "cacheFailed", "/stage/package/pnpm");
for (const runnerOs of ["Linux", "Windows"]) {
  it.layer(runtime({ env: { RUNNER_OS: runnerOs, RUNNER_ARCH: "X64" }, manifest: { ...nativeManifest, bin: { pnpm: "pnpm", extra: "extra.js" } }, files: { ...nativeFiles, "extra.js": "console.log('extra')" }, packument: verifiedPackument }), { timeout: "5 seconds" })((it) => {
    it.effect(`native overlay on ${runnerOs} retains non-native bins and tolerates absent aliases`, () => Effect.gen(function* () {
      const installer = yield* PackageManagerInstaller;
      const record = yield* installer.install(pin("pnpm@12.0.0"));
      const fs = yield* FileSystem.FileSystem;
      assert.strictEqual(yield* fs.readFileString(record.bins.pnpm ?? ""), "native");
      assert.strictEqual(yield* fs.readFileString(record.bins.extra ?? ""), "console.log('extra')");
    }));
  });
}
for (const unreadable of [false, true]) {
  it.layer(runtime({ cached: true, manifest: nativeManifest, files: { pnpm: "" }, ...(unreadable ? { mutate: (fs: FileSystem.FileSystem) => ({ ...fs, open: () => Effect.fail(refused) }) } : {}) }), { timeout: "5 seconds" })((it) => {
    it.effect(`empty or unreadable placeholder probe leaves cache layout checks authoritative: ${unreadable}`, () => Effect.gen(function* () {
      const installer = yield* PackageManagerInstaller;
      const record = yield* installer.install(pin("pnpm@12.0.0"));
      assert.strictEqual(record.bins.pnpm, "/stage/package/pnpm");
      const fs = yield* FileSystem.FileSystem;
      assert.strictEqual(yield* fs.readFileString("/stage/package/.bin/pnpm"), "#!/bin/sh\nexec '/stage/package/pnpm' \"$@\"\n");
    }));
  });
}

for (const env of [{ RUNNER_OS: "Linux", RUNNER_ARCH: "" }, { RUNNER_OS: "Windows", RUNNER_ARCH: "X64" }]) {
  it.layer(runtime({ spec: "bun@1.0.0", env }), { timeout: "5 seconds" })((it) => {
    it.effect(`bun installs an executable for the resolved platform ${JSON.stringify(env)}`, () => Effect.gen(function* () {
      const installer = yield* PackageManagerInstaller;
      const record = yield* installer.install(pin("bun@1.0.0"));
      const fs = yield* FileSystem.FileSystem;
      assert.strictEqual(yield* fs.readFileString(record.bins.bun ?? ""), "bun");
      assert.strictEqual(record.bins.bun, env.RUNNER_OS === "Windows" ? "/bun/bun-windows-x64/bun.exe" : "/bun/bun-linux-x64/bun");
    }));
  });
}

fails("package root realpath faults remain typed", {
  mutate: (fs) => ({ ...fs, realPath: Effect.fnUntraced(function* () { return yield* refused; }) }),
}, "layoutUnexpected", "/stage/package");
fails("bin realpath faults remain typed", {
  mutate: (fs) => ({ ...fs, realPath: Effect.fnUntraced(function* (file) {
    return file === "/stage/package/bin/pnpm.cjs" ? yield* refused : yield* fs.realPath(file);
  }) }),
}, "layoutUnexpected", "/stage/package/bin/pnpm.cjs");
fails("dangling bin links fail before shim publication", {
  mutate: (fs) => ({ ...fs,
    realPath: Effect.fnUntraced(function* (file) {
      return yield* fs.realPath(file === "/stage/package/bin/pnpm.cjs" ? "/missing-bin" : file);
    }),
    readLink: Effect.fnUntraced(function* (file) {
      return file === "/stage/package/bin/pnpm.cjs" ? "/missing-bin" : yield* fs.readLink(file);
    }),
  }),
}, "layoutUnexpected", "/stage/package/bin/pnpm.cjs");
