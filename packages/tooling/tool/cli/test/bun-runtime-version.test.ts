import { ScriptedSpawner } from "@beep/commands/ScriptedSpawner";
import { MemoryFileSystem } from "@beep/memfs/MemoryFileSystem";
import {
  checkBunRuntimeVersion,
  compareBunRuntimeVersion,
  versionSyncCommand,
} from "@beep/repo-cli/commands/VersionSync";
import { FsUtilsLive } from "@beep/repo-utils";
import { it } from "@beep/test-runner";
import * as NodeStdio from "@effect/platform-node/NodeStdio";
import * as NodeTerminal from "@effect/platform-node/NodeTerminal";
import { afterEach, describe, expect, vi } from "@effect/vitest";
import * as Console from "effect/Console";
import * as Command from "effect/cli/Command";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as TestConsole from "effect/testing/TestConsole";
import { expectReportedExit } from "./support/CommandTest.ts";
import { provideSpawner } from "./support/ScriptedProcess.ts";

afterEach(() => vi.unstubAllGlobals());

describe("Bun runtime version comparison", () => {
  it.effect("accepts equal versions after trimming command and pin newlines", () =>
    Effect.gen(function* () {
      expect(yield* compareBunRuntimeVersion(O.some("1.4.3\n"), "1.4.3\n")).toBe("1.4.3");
    })
  );

  it.effect("rejects different versions with a one-line message naming both", () =>
    Effect.gen(function* () {
      const error = yield* compareBunRuntimeVersion(O.some("1.4.3\n"), "1.4.2\n").pipe(Effect.flip);
      expect(error._tag).toBe("VersionSyncError");
      expect(error.message).toBe("Bun version mismatch: .bun-version=1.4.3; bun --version=1.4.2");
    })
  );

  it.effect("rejects a missing pin", () =>
    Effect.gen(function* () {
      const error = yield* compareBunRuntimeVersion(O.none(), "1.4.3").pipe(Effect.flip);
      expect(error.file).toBe(".bun-version");
      expect(error.message).toBe(".bun-version is missing or empty");
    })
  );

  it.effect("rejects an empty pin", () =>
    Effect.gen(function* () {
      const error = yield* compareBunRuntimeVersion(O.some(" \n"), "1.4.3").pipe(Effect.flip);
      expect(error.message).toBe(".bun-version is missing or empty");
    })
  );
});

// Keep pin I/O in memory; the local CLI gate separately exercises the real Bun process.
const runtimeLayer = Layer.mergeAll(
  MemoryFileSystem.layer,
  Path.layer,
  ScriptedSpawner.make(() => ({ stdout: "1.4.3\n" })).layer
);

const runVersionSync = Command.runWith(versionSyncCommand, { version: "0.0.0" });
const commandLayer = Layer.mergeAll(
  runtimeLayer,
  NodeStdio.layer,
  NodeTerminal.layer,
  FetchHttpClient.layer,
  FsUtilsLive.pipe(Layer.provide(runtimeLayer))
);

it.layer(commandLayer, { timeout: "30 seconds" })("version-sync runtime command", (it) => {
  it.effect("checks only the runtime even when write and dry-run flags are supplied", () =>
    Effect.gen(function* () {
      vi.stubGlobal("process", { ...process, versions: { ...process.versions, bun: "1.4.3" } });
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = process.cwd();
      yield* fs.makeDirectory(root, { recursive: true });
      yield* fs.writeFileString(path.join(root, "bun.lock"), "");
      yield* fs.writeFileString(path.join(root, ".bun-version"), "1.4.3\n");
      for (const flags of [[], ["--write"], ["--write", "--dry-run"]]) {
        yield* runVersionSync(["--check-runtime", ...flags]);
      }
      expect(yield* TestConsole.logLines).toEqual([
        "bun-version: .bun-version=1.4.3; bun --version=1.4.3",
        "bun-version: .bun-version=1.4.3; bun --version=1.4.3",
        "bun-version: .bun-version=1.4.3; bun --version=1.4.3",
      ]);
      // No package.json exists: entering the normal sync handler would fail.
      expect(yield* fs.exists(path.join(root, "package.json"))).toBe(false);
    }).pipe(
      Effect.provideServiceEffect(FileSystem.FileSystem, MemoryFileSystem.make),
      Effect.provideServiceEffect(Console.Console, TestConsole.make)
    )
  );

  it.effect("reports runtime mismatches as a failing CLI exit", () =>
    Effect.gen(function* () {
      vi.stubGlobal("process", { ...process, versions: { ...process.versions, bun: "1.4.2" } });
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = process.cwd();
      yield* fs.makeDirectory(root, { recursive: true });
      yield* fs.writeFileString(path.join(root, "bun.lock"), "");
      yield* fs.writeFileString(path.join(root, ".bun-version"), "1.4.3\n");
      expectReportedExit(yield* runVersionSync(["--check-runtime"]).pipe(Effect.exit));
      expect(yield* TestConsole.errorLines).toEqual([
        "version-sync: Bun version mismatch: .bun-version=1.4.3; bun --version=1.4.2 (.bun-version)",
      ]);
    }).pipe(
      Effect.provideServiceEffect(FileSystem.FileSystem, MemoryFileSystem.make),
      Effect.provideServiceEffect(Console.Console, TestConsole.make)
    )
  );

  it.effect("reports missing repository roots as a failing CLI exit", () =>
    Effect.gen(function* () {
      expectReportedExit(yield* runVersionSync(["--check-runtime"]).pipe(Effect.exit));
      expect(yield* TestConsole.errorLines).toEqual([
        expect.stringContaining("version-sync: Could not find repository root"),
      ]);
    }).pipe(
      Effect.provideServiceEffect(FileSystem.FileSystem, MemoryFileSystem.make),
      Effect.provideServiceEffect(Console.Console, TestConsole.make)
    )
  );
});

it.layer(runtimeLayer, { timeout: "30 seconds" })("Bun runtime preflight I/O", (it) => {
  it.effect("rejects a failed bun version subprocess even if its stdout matches the pin", () =>
    Effect.gen(function* () {
      vi.stubGlobal("process", { ...process, versions: { ...process.versions, bun: undefined } });
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped();
      yield* fs.writeFileString(path.join(root, ".bun-version"), "1.4.3\n");
      const error = yield* checkBunRuntimeVersion(root).pipe(
        provideSpawner(ScriptedSpawner.make(() => ({ stdout: "1.4.3\n", exit: 2 }))),
        Effect.flip
      );
      expect(error.message).toContain("bun --version exited 2");
    })
  );

  it.effect("fails closed when the repository has no .bun-version", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* fs.makeTempDirectoryScoped();
      const error = yield* checkBunRuntimeVersion(root).pipe(Effect.flip);
      expect(error._tag).toBe("VersionSyncError");
      expect(error.file).toBe(".bun-version");
      expect(error.message).toContain("Cannot read .bun-version");
    })
  );

  it.effect("falls back to command output on non-Bun hosts and rejects a mismatch", () =>
    Effect.gen(function* () {
      vi.stubGlobal("process", { ...process, versions: { ...process.versions, bun: undefined } });
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped();
      yield* fs.writeFileString(path.join(root, ".bun-version"), "0.0.0\n");
      const error = yield* checkBunRuntimeVersion(root).pipe(Effect.flip);
      expect(error.message).toContain("Bun version mismatch: .bun-version=0.0.0; bun --version=");
    })
  );
  it.effect("uses the in-process Bun version without requiring a spawner", () =>
    Effect.gen(function* () {
      vi.stubGlobal("process", { ...process, versions: { ...process.versions, bun: "1.4.2" } });
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped();
      yield* fs.writeFileString(path.join(root, ".bun-version"), "1.4.3\n");
      const error = yield* checkBunRuntimeVersion(root).pipe(
        // Own double: a never-spawn guard; ScriptedSpawner has no defect outcome.
        Effect.provideService(
          ChildProcessSpawner.ChildProcessSpawner,
          ChildProcessSpawner.make(() => Effect.die("must not spawn"))
        ),
        Effect.flip
      );
      expect(error.message).toBe("Bun version mismatch: .bun-version=1.4.3; bun --version=1.4.2");
      yield* fs.writeFileString(path.join(root, ".bun-version"), "1.4.2\n");
      expect(yield* checkBunRuntimeVersion(root)).toBe("1.4.2");
    })
  );
});
