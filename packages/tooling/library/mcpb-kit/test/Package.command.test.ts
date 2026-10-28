import { McpbManifestFields, McpbPackageSpec, makeMcpbPackageCommand } from "@beep/mcpb-kit";
import { MemoryFileSystem } from "@beep/memfs/MemoryFileSystem";
import * as BunPath from "@effect/platform-bun/BunPath";
import { afterEach, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Command from "effect/cli/Command";
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
      display: () => Effect.void,
    })
  ),
  Layer.succeed(
    ChildProcessSpawner.ChildProcessSpawner,
    ChildProcessSpawner.make(() => Effect.die("Unexpected process execution"))
  )
);

it.layer(commandEnvironment, { concurrent: false, timeout: "5 seconds" })("MCPB packaging boundaries", (it) => {
  const prepare = Effect.fnUntraced(function* (
    options: {
      readonly listing?: string;
      readonly exitCode?: number;
      readonly version?: string;
      readonly noArchive?: boolean;
      readonly rejectLaunch?: boolean;
    } = {}
  ) {
    const fs = yield* FileSystem.FileSystem;
    yield* fs.remove("/repo", { recursive: true, force: true });
    yield* fs.makeDirectory(nativeDir, { recursive: true });
    yield* fs.writeFileString(
      `${nativeDir}/package.json`,
      yield* encodeBindings({ version: options.version ?? "2.0.0-r.1" })
    );
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

  it.effect("compiles Linux with external native addons and audits only allowed sidecars", () =>
    Effect.gen(function* () {
      const fixture = yield* prepare();
      yield* runCommand(["--target", "linux-x64", "--output", output]).pipe(
        Effect.provideService(FileSystem.FileSystem, fixture.fs)
      );
      expect(A.map(fixture.calls, (args) => args[0])).toEqual(["bun", "zip", "unzip"]);
      expect(fixture.calls[0]).toContain("--target=bun-linux-x64");
      expect(fixture.calls[0]).toContain("@duckdb/node-bindings-win32-x64/duckdb.node");
      expect(
        yield* fixture.fs.readFileString(`${output}/linux-x64/node_modules/@duckdb/node-bindings-linux-x64/duckdb.node`)
      ).toBe("synthetic native sidecar");
      const manifest = yield* fixture.fs
        .readFileString(`${output}/linux-x64/manifest.json`)
        .pipe(Effect.flatMap(decodeJson));
      expect(manifest).toMatchObject({
        server: { entry_point: "example-mcp" },
        compatibility: { platforms: ["linux"] },
      });
    })
  );

  it.effect("uses verified cached Windows bindings without downloading or extracting", () =>
    Effect.gen(function* () {
      const fixture = yield* prepare({
        listing: "manifest.json\nexample-mcp.exe\nnode_modules/@duckdb/node-bindings-win32-x64/duckdb.node\n",
      });
      const cache = `${output}/.cache/node-bindings-win32-x64-2.0.0-r.1`;
      yield* fixture.fs.makeDirectory(cache, { recursive: true });
      yield* fixture.fs.writeFileString(`${cache}/duckdb.node`, "cached Windows sidecar");
      yield* runCommand(["--target", "windows-x64", "--output", output]).pipe(
        Effect.provideService(FileSystem.FileSystem, fixture.fs)
      );
      expect(A.map(fixture.calls, (args) => args[0])).toEqual(["bun", "zip", "unzip"]);
      expect(fixture.calls[0]).toContain("--target=bun-windows-x64");
      expect(
        yield* fixture.fs.readFileString(
          `${output}/windows-x64/node_modules/@duckdb/node-bindings-win32-x64/duckdb.node`
        )
      ).toBe("cached Windows sidecar");
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
        expect(yield* fixture.fs.exists(archive)).toBe(false);
      })
    );
  }

  it.effect("deletes an untrusted Windows tarball and never extracts it", () =>
    Effect.gen(function* () {
      const fixture = yield* prepare();
      const cache = `${output}/.cache`;
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
      expect(yield* fixture.fs.exists(tarball)).toBe(false);
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
