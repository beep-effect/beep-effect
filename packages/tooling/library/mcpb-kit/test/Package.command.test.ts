import { McpbManifestFields, McpbPackageSpec, makeMcpbPackageCommand, mcpbWindowsRuntime } from "@beep/mcpb-kit";
import { MemoryFileSystem } from "@beep/memfs/MemoryFileSystem";
import * as BunPath from "@effect/platform-bun/BunPath";
import { afterEach, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Command from "effect/cli/Command";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as Queue from "effect/Queue";
import * as S from "effect/Schema";
import * as Stdio from "effect/Stdio";
import * as Terminal from "effect/Terminal";

const spec = McpbPackageSpec.make({
  appName: "example-mcp",
  commandName: "package-example",
  repoRoot: "/repo",
  forbiddenArchiveFragments: ["src/", ".env"],
  assets: ["engine.wasm"],
  manifest: McpbManifestFields.make({
    name: "example",
    displayName: "Example",
    version: "0.1.0",
    description: "Fixture package",
    env: {},
    userConfig: {},
    tools: [],
  }),
});
const runCommand = Command.runWith(makeMcpbPackageCommand(spec), { version: "0.0.0" });
const decodeJson = S.decodeUnknownEffect(S.fromJsonString(S.Unknown));
const encodeBindings = S.encodeEffect(S.fromJsonString(S.Struct({ version: S.String })));
const nativeDir = "/repo/node_modules/@duckdb/node-bindings-linux-x64";
const output = "/repo/out";
const archive = `${output}/example-mcp-linux-x64.mcpb`;
const inventory =
  "manifest.json\nexample-mcp\nnode_modules/\nnode_modules/@duckdb/\nnode_modules/@duckdb/node-bindings-linux-x64/duckdb.node\n";
const windowsArchive = `${output}/example-mcp-windows-x64.mcpb`;
const windowsInventory =
  "manifest.json\nbun.exe\nexample-mcp.js\nengine.wasm\nnode_modules/\nnode_modules/@duckdb/\nnode_modules/@duckdb/node-bindings-win32-x64/duckdb.dll\nnode_modules/@duckdb/node-bindings-win32-x64/duckdb.node\n";
const cache = `${output}/.cache`;
const bindingsCache = `${cache}/node-bindings-win32-x64-2.0.0-r.1`;
const runtimeCache = `${cache}/bun-windows-x64-${mcpbWindowsRuntime.version}`;
const runtimeArchive = `${cache}/bun-windows-x64-${mcpbWindowsRuntime.version}.zip`;

// A Portable Executable header with 16 data directories. Directory 4 is the
// Authenticode certificate table: a file offset and a size.
const portableExecutable = (options: {
  readonly optionalMagic: 0x10b | 0x20b;
  readonly certificateTable?: { readonly offset: number; readonly size: number };
}): Uint8Array => {
  const bytes = new Uint8Array(0x200);
  const view = new DataView(bytes.buffer);
  const peOffset = 0x80;
  const directories = peOffset + 24 + (options.optionalMagic === 0x20b ? 112 : 96);
  view.setUint16(0, 0x5a4d, true);
  view.setUint32(0x3c, peOffset, true);
  view.setUint32(peOffset, 0x4550, true);
  view.setUint16(peOffset + 24, options.optionalMagic, true);
  view.setUint32(directories - 4, 16, true);
  view.setUint32(directories + 32, options.certificateTable?.offset ?? 0, true);
  view.setUint32(directories + 36, options.certificateTable?.size ?? 0, true);
  return bytes;
};
const signedRuntime = portableExecutable({ optionalMagic: 0x20b, certificateTable: { offset: 0x1c0, size: 0x40 } });

const originalSpawn = Bun.spawn;

// Bun exposes a fixed global and a non-configurable, writable spawn property.
afterEach(() => Object.defineProperty(Bun, "spawn", { value: originalSpawn }));

const commandEnvironment = Layer.mergeAll(
  MemoryFileSystem.layer,
  BunPath.layer,
  Stdio.layerTest({}),
  Layer.succeed(
    Terminal.Terminal,
    Terminal.make({
      columns: Effect.succeed(80),
      rows: Effect.succeed(24),
      readInput: Effect.die("Unexpected terminal input"),
      readLine: Effect.die("Unexpected terminal input"),
      size: Effect.die("Unexpected terminal resize subscription"),
      display: () => Effect.void,
    })
  ),
  Layer.succeed(
    ChildProcessSpawner.ChildProcessSpawner,
    ChildProcessSpawner.make(() => Effect.die("Unexpected process execution"))
  ),
  Digest.layerWebCrypto
);

it.layer(commandEnvironment, { concurrent: false, timeout: "5 seconds" })("MCPB packaging boundaries", (it) => {
  const prepare = Effect.fnUntraced(function* (
    options: {
      readonly listing?: string;
      readonly exitCode?: number;
      readonly version?: string;
      readonly bunVersion?: string;
      readonly noArchive?: boolean;
      readonly rejectLaunch?: boolean;
    } = {}
  ) {
    const fs = yield* FileSystem.FileSystem;
    yield* fs.remove("/repo", { recursive: true, force: true });
    yield* fs.makeDirectory(nativeDir, { recursive: true });
    yield* fs.writeFileString("/repo/.bun-version", `${options.bunVersion ?? mcpbWindowsRuntime.version}\n`);
    const argument = `${nativeDir}/package.json`;
    const encodedBindings = yield* encodeBindings({ version: options.version ?? "2.0.0-r.1" });
    yield* fs.writeFileString(argument, encodedBindings);
    yield* fs.writeFileString(`${nativeDir}/duckdb.node`, "synthetic native sidecar");
    yield* fs.makeDirectory(output, { recursive: true });
    // `Bun.spawn` is a plain function, so it hands each synthetic archive write to
    // a fiber of the test, which writes it to the in-memory filesystem and then
    // settles the process's `exited` promise.
    const archiveWrites = yield* Queue.unbounded<{
      readonly path: string;
      readonly exitCode: number;
      readonly exited: PromiseWithResolvers<number>;
    }>();
    yield* Queue.take(archiveWrites).pipe(
      Effect.flatMap((write) =>
        fs
          .writeFileString(write.path, "synthetic archive")
          .pipe(Effect.andThen(Effect.sync(() => write.exited.resolve(write.exitCode))))
      ),
      Effect.forever,
      Effect.forkChild
    );
    const offerArchiveWrite = (path: string, exitCode: number): Promise<number> => {
      const exited = Promise.withResolvers<number>();
      Queue.offerUnsafe(archiveWrites, { path, exitCode, exited });
      return exited.promise;
    };
    const calls: Array<ReadonlyArray<string>> = [];
    Object.defineProperty(Bun, "spawn", {
      value: (args: ReadonlyArray<string>) => {
        calls.push(args);
        if (options.rejectLaunch === true) throw new Error("synthetic process start failure");
        const exitCode = options.exitCode ?? 0;
        const exited =
          args[0] === "zip" && options.noArchive !== true
            ? offerArchiveWrite(args[3] ?? archive, exitCode)
            : Promise.resolve(exitCode);
        return {
          stdout: new Blob([options.listing ?? inventory]).stream(),
          exited,
        };
      },
    });
    return { fs, calls };
  });

  // The Windows downloads as an earlier packaging run left them in the cache.
  const cacheWindowsDownloads = Effect.fnUntraced(function* (runtime: Uint8Array = signedRuntime) {
    const fs = yield* FileSystem.FileSystem;
    yield* fs.makeDirectory(bindingsCache, { recursive: true });
    yield* fs.writeFileString(`${bindingsCache}/duckdb.node`, "cached Windows sidecar");
    yield* fs.writeFile(
      `${bindingsCache}/duckdb.dll`,
      portableExecutable({ optionalMagic: 0x20b, certificateTable: { offset: 0x1c0, size: 0x40 } })
    );
    yield* fs.makeDirectory(runtimeCache, { recursive: true });
    yield* fs.writeFile(`${runtimeCache}/bun.exe`, runtime);
  });

  it.effect("compiles Linux with external native addons and audits only allowed sidecars", () =>
    Effect.gen(function* () {
      const fixture = yield* prepare();
      yield* runCommand(["--target", "linux-x64", "--output", output]).pipe(
        Effect.provideService(FileSystem.FileSystem, fixture.fs)
      );
      expect(A.map(fixture.calls, (args) => args[0])).toEqual(["bun", "zip", "unzip"]);
      expect(fixture.calls[0]).toContain("--compile");
      expect(fixture.calls[0]).toContain("--target=bun-linux-x64");
      expect(fixture.calls[0]).toContain("@duckdb/node-bindings-win32-x64/duckdb.node");
      const readFileString1 = yield* fixture.fs.readFileString(
        `${output}/linux-x64/node_modules/@duckdb/node-bindings-linux-x64/duckdb.node`
      );
      expect(readFileString1).toBe("synthetic native sidecar");
      const manifest = yield* fixture.fs
        .readFileString(`${output}/linux-x64/manifest.json`)
        .pipe(Effect.flatMap(decodeJson));
      expect(manifest).toMatchObject({
        server: { entry_point: "example-mcp", mcp_config: { command: "${__dirname}/example-mcp" } },
        compatibility: { platforms: ["linux"] },
      });
    })
  );

  it.effect("ships the cached signed runtime and a script bundle for Windows, never a compiled executable", () =>
    Effect.gen(function* () {
      const fixture = yield* prepare({ listing: windowsInventory });
      yield* cacheWindowsDownloads();
      yield* runCommand(["--target", "windows-x64", "--output", output]).pipe(
        Effect.provideService(FileSystem.FileSystem, fixture.fs)
      );
      expect(A.map(fixture.calls, (args) => args[0])).toEqual(["bun", "zip", "unzip"]);
      expect(fixture.calls[0]).not.toContain("--compile");
      expect(fixture.calls[0]).toContain("--target=bun");
      expect(fixture.calls[0]).toContain(`--outdir=${output}/windows-x64`);
      expect(fixture.calls[0]).toContain("--entry-naming=example-mcp.js");
      expect(fixture.calls[0]).toContain("@duckdb/node-bindings-win32-x64/duckdb.node");
      const sidecar = yield* fixture.fs.readFileString(
        `${output}/windows-x64/node_modules/@duckdb/node-bindings-win32-x64/duckdb.node`
      );
      expect(sidecar).toBe("cached Windows sidecar");
      const runtime = yield* fixture.fs.readFile(`${output}/windows-x64/bun.exe`);
      expect(Uint8Array.from(runtime)).toEqual(signedRuntime);
      const manifest = yield* fixture.fs
        .readFileString(`${output}/windows-x64/manifest.json`)
        .pipe(Effect.flatMap(decodeJson));
      expect(manifest).toMatchObject({
        server: {
          type: "binary",
          entry_point: "bun.exe",
          mcp_config: {
            command: "${__dirname}/bun.exe",
            args: ["--no-env-file", "${__dirname}/example-mcp.js"],
          },
        },
        compatibility: { platforms: ["win32"] },
      });
    })
  );

  it.effect("accepts a signed PE32 runtime", () =>
    Effect.gen(function* () {
      const fixture = yield* prepare({ listing: windowsInventory });
      yield* cacheWindowsDownloads(
        portableExecutable({ optionalMagic: 0x10b, certificateTable: { offset: 0x1c0, size: 0x40 } })
      );
      yield* runCommand(["--target", "windows-x64", "--output", output]).pipe(
        Effect.provideService(FileSystem.FileSystem, fixture.fs)
      );
      const archived = yield* fixture.fs.exists(windowsArchive);
      expect(archived).toBe(true);
    })
  );

  for (const [name, runtime] of [
    ["without a certificate table", portableExecutable({ optionalMagic: 0x20b })],
    [
      "whose certificate table runs past the end of the file",
      portableExecutable({ optionalMagic: 0x20b, certificateTable: { offset: 0x1c0, size: 0x80 } }),
    ],
    ["that is not a Portable Executable", new TextEncoder().encode("#!/bin/sh")],
  ] as const) {
    it.effect(`refuses a Windows runtime ${name} before any archive is written`, () =>
      Effect.gen(function* () {
        const fixture = yield* prepare({ listing: windowsInventory });
        yield* cacheWindowsDownloads(runtime);
        const result = yield* runCommand(["--target", "windows-x64", "--output", output]).pipe(
          Effect.provideService(FileSystem.FileSystem, fixture.fs),
          Effect.result
        );
        expect(result).toMatchObject({
          _tag: "Failure",
          failure: { message: expect.stringContaining("Unsigned Windows binary in MCPB: bun.exe") },
        });
        expect(A.map(fixture.calls, (args) => args[0])).toEqual(["bun"]);
        const archived = yield* fixture.fs.exists(windowsArchive);
        expect(archived).toBe(false);
      })
    );
  }

  it.effect("refuses an unsigned Windows library other than DuckDB's addon", () =>
    Effect.gen(function* () {
      const fixture = yield* prepare({ listing: windowsInventory });
      yield* cacheWindowsDownloads();
      yield* fixture.fs.writeFileString(`${bindingsCache}/duckdb.dll`, "unsigned library");
      const result = yield* runCommand(["--target", "windows-x64", "--output", output]).pipe(
        Effect.provideService(FileSystem.FileSystem, fixture.fs),
        Effect.result
      );
      expect(result).toMatchObject({
        _tag: "Failure",
        failure: {
          message: expect.stringContaining(
            "Unsigned Windows binary in MCPB: node_modules/@duckdb/node-bindings-win32-x64/duckdb.dll"
          ),
        },
      });
    })
  );

  for (const [name, listing, expected] of [
    ["a compiled executable", `${windowsInventory}example-mcp.exe\n`, "Unexpected entry in MCPB: example-mcp.exe"],
    [
      "no script bundle",
      "manifest.json\nbun.exe\nengine.wasm\nnode_modules/@duckdb/node-bindings-win32-x64/duckdb.node\n",
      "Missing entry in MCPB: example-mcp.js",
    ],
    [
      "no runtime",
      "manifest.json\nexample-mcp.js\nengine.wasm\nnode_modules/@duckdb/node-bindings-win32-x64/duckdb.node\n",
      "Missing entry in MCPB: bun.exe",
    ],
    [
      "a declared asset missing",
      "manifest.json\nbun.exe\nexample-mcp.js\nnode_modules/@duckdb/node-bindings-win32-x64/duckdb.node\n",
      "Missing entry in MCPB: engine.wasm",
    ],
    ["an undeclared asset", `${windowsInventory}surprise.wasm\n`, "Unexpected entry in MCPB: surprise.wasm"],
    ["no DuckDB addon", "manifest.json\nbun.exe\nexample-mcp.js\nengine.wasm\n", "Missing entry in MCPB"],
  ] as const) {
    it.effect(`deletes a Windows archive with ${name}`, () =>
      Effect.gen(function* () {
        const fixture = yield* prepare({ listing });
        yield* cacheWindowsDownloads();
        const result = yield* runCommand(["--target", "windows-x64", "--output", output]).pipe(
          Effect.provideService(FileSystem.FileSystem, fixture.fs),
          Effect.result
        );
        expect(result).toMatchObject({ _tag: "Failure", failure: { message: expect.stringContaining(expected) } });
        const archived = yield* fixture.fs.exists(windowsArchive);
        expect(archived).toBe(false);
      })
    );
  }

  it.effect("rejects a Bun runtime pin that differs from .bun-version before any command or download", () =>
    Effect.gen(function* () {
      const fixture = yield* prepare({ bunVersion: "0.0.0" });
      yield* cacheWindowsDownloads();
      const result = yield* runCommand(["--target", "windows-x64", "--output", output]).pipe(Effect.result);
      expect(result).toMatchObject({
        _tag: "Failure",
        failure: {
          message: expect.stringContaining(
            `Repository .bun-version 0.0.0 differs from the pinned Bun runtime ${mcpbWindowsRuntime.version}`
          ),
        },
      });
      expect(fixture.calls).toEqual([]);
    })
  );

  it.effect("never reuses a cached runtime from another Bun pin", () =>
    Effect.gen(function* () {
      const fixture = yield* prepare();
      yield* cacheWindowsDownloads();
      yield* fixture.fs.remove(runtimeCache, { recursive: true });
      const stale = `${cache}/bun-windows-x64-0.0.0`;
      yield* fixture.fs.makeDirectory(stale, { recursive: true });
      yield* fixture.fs.writeFile(`${stale}/bun.exe`, signedRuntime);
      yield* runCommand(["--target", "windows-x64", "--output", output]).pipe(Effect.result);
      expect(fixture.calls[0]).toContain(
        `https://github.com/oven-sh/bun/releases/download/bun-v${mcpbWindowsRuntime.version}/bun-windows-x64.zip`
      );
    })
  );

  it.effect("deletes an untrusted Bun runtime archive and never unpacks it", () =>
    Effect.gen(function* () {
      const fixture = yield* prepare();
      yield* cacheWindowsDownloads();
      yield* fixture.fs.remove(runtimeCache, { recursive: true });
      yield* fixture.fs.writeFileString(runtimeArchive, "synthetic tampered archive");
      const result = yield* runCommand(["--target", "windows-x64", "--output", output]).pipe(Effect.result);
      expect(result).toMatchObject({
        _tag: "Failure",
        failure: { message: expect.stringContaining("failed sha256 verification") },
      });
      expect(A.map(fixture.calls, (args) => args[0])).toEqual(["curl"]);
      const kept = yield* fixture.fs.exists(runtimeArchive);
      expect(kept).toBe(false);
      const unpacked = yield* fixture.fs.exists(`${runtimeCache}/bun.exe`);
      expect(unpacked).toBe(false);
    })
  );

  it.effect("never reuses a cached unpack from another DuckDB pin", () =>
    Effect.gen(function* () {
      const fixture = yield* prepare();
      const stale = `${output}/.cache/node-bindings-win32-x64-1.5.6-r.2`;
      yield* fixture.fs.makeDirectory(stale, { recursive: true });
      yield* fixture.fs.writeFileString(`${stale}/duckdb.node`, "stale Windows sidecar");
      yield* runCommand(["--target", "windows-x64", "--output", output]).pipe(Effect.result);
      expect(A.map(fixture.calls, (args) => args[0])[0]).toBe("curl");
    })
  );

  for (const [name, options, expected] of [
    ["forbidden source leak", { listing: "manifest.json\nsrc/private.ts\n" }, "Forbidden entry leaked"],
    ["unexpected archive file", { listing: "manifest.json\nsecret.txt\n" }, "Unexpected entry"],
    ["Windows runtime in a Linux archive", { listing: `${inventory}bun.exe\n` }, "Unexpected entry in MCPB: bun.exe"],
    [
      "missing executable",
      { listing: "manifest.json\nnode_modules/@duckdb/node-bindings-linux-x64/duckdb.node\n" },
      "Missing entry in MCPB: example-mcp",
    ],
    ["missing archive", { noArchive: true }, "MCPB was not created"],
    ["failed compiler", { exitCode: 9 }, "Command failed with exit code 9"],
    ["process launch failure", { rejectLaunch: true }, "Failed to launch"],
  ] as const) {
    it.effect(`refuses ${name}`, () =>
      Effect.gen(function* () {
        const fixture = yield* prepare(options);
        const result = yield* runCommand(["--target", "linux-x64", "--output", output]).pipe(
          Effect.provideService(FileSystem.FileSystem, fixture.fs),
          Effect.result
        );
        expect(result).toMatchObject({ _tag: "Failure", failure: { message: expect.stringContaining(expected) } });
        const exists3 = yield* fixture.fs.exists(archive);
        expect(exists3).toBe(false);
      })
    );
  }

  it.effect("deletes an untrusted Windows tarball and never extracts it", () =>
    Effect.gen(function* () {
      const fixture = yield* prepare();
      const tarball = `${cache}/node-bindings-win32-x64-2.0.0-r.1.tgz`;
      yield* fixture.fs.makeDirectory(cache, { recursive: true });
      yield* fixture.fs.writeFileString(tarball, "synthetic tampered tarball");
      const result = yield* runCommand(["--target", "windows-x64", "--output", output]).pipe(Effect.result);
      expect(result).toMatchObject({
        _tag: "Failure",
        failure: { message: expect.stringContaining("failed sha512 verification") },
      });
      expect(A.map(fixture.calls, (args) => args[0])).toEqual(["curl"]);
      expect(fixture.calls[0]).toContain(
        "https://registry.npmjs.org/@duckdb/node-bindings-win32-x64/-/node-bindings-win32-x64-2.0.0-r.1.tgz"
      );
      const exists4 = yield* fixture.fs.exists(tarball);
      expect(exists4).toBe(false);
    })
  );

  it.effect("rejects installed DuckDB version drift before any command or download", () =>
    Effect.gen(function* () {
      const fixture = yield* prepare({ version: "0.0.0" });
      const result = yield* runCommand(["--target", "windows-x64", "--output", output]).pipe(Effect.result);
      expect(result).toMatchObject({
        _tag: "Failure",
        failure: { message: expect.stringContaining("differ from pinned") },
      });
      expect(fixture.calls).toEqual([]);
    })
  );
});
