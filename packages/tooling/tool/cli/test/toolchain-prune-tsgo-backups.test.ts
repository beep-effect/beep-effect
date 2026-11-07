import { pruneTsgoBackups } from "@beep/repo-cli/commands/Toolchain";
import { it } from "@beep/test-runner";
import { NodeServices } from "@effect/platform-node";
import { expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as ChildProcess from "effect/process/ChildProcess";
import * as Stream from "effect/Stream";
import * as TestConsole from "effect/testing/TestConsole";

// The root `prepare` lifecycle runs `beep toolchain prune-tsgo-backups` from the install root,
// so the CLI cases spawn the real bin with the fixture as its working directory.
const runCli = Effect.fn("ToolchainPruneTest.runCli")(function* (cwd: string) {
  const path = yield* Path.Path;
  const entry = yield* path.fromFileUrl(new URL("../src/bin.ts", import.meta.url));
  const handle = yield* ChildProcess.make("bun", [entry, "toolchain", "prune-tsgo-backups"], {
    cwd,
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
  });
  const [exitCode, stdout, stderr] = yield* Effect.all(
    [
      handle.exitCode,
      handle.stdout.pipe(Stream.decodeText, Stream.mkString),
      handle.stderr.pipe(Stream.decodeText, Stream.mkString),
    ],
    { concurrency: "unbounded" }
  );
  return { exitCode, stdout, stderr };
}, Effect.scoped);

const BACKUP_FIXTURE_FILES = [
  "tsc.original",
  "tsc.original.1",
  "tsc.original.12",
  "tsc.patched",
  "tsc.original.old",
  "tsc",
];

it.layer(NodeServices.layer, { timeout: "60 seconds" })("beep toolchain prune-tsgo-backups", (it) => {
  it.effect("keeps compiler originals and unrelated files while removing only rotations and patched leftovers", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "tsgo-prune-fixture-" });
      const directories = [
        path.join(root, "node_modules", "@typescript", "native", "lib"),
        path.join(root, "node_modules", "@typescript", "typescript-linux-x64", "lib"),
        path.join(root, "node_modules", "@tsrs", "linux-x64"),
      ];
      for (const directory of directories) {
        yield* fs.makeDirectory(directory, { recursive: true });
        for (const file of BACKUP_FIXTURE_FILES) {
          yield* fs.writeFileString(path.join(directory, file), file);
        }
      }
      // A 3 MiB rotation proves the reclaimed size is reported in rounded MB.
      yield* fs.writeFile(path.join(directories[0] ?? root, "tsc.original.7"), new Uint8Array(3 * 1024 * 1024));
      yield* pruneTsgoBackups(root);
      const reported = yield* TestConsole.logLines;
      expect(reported).toEqual(["[prune-tsgo-backups] reclaimed ~3 MB of stale binary backups"]);
      for (const directory of directories) {
        for (const removed of ["tsc.original.1", "tsc.original.12", "tsc.original.7", "tsc.patched"]) {
          const exists = yield* fs.exists(path.join(directory, removed));
          expect(exists).toBe(false);
        }
        for (const kept of ["tsc.original", "tsc.original.old", "tsc"]) {
          const content = yield* fs.readFileString(path.join(directory, kept));
          expect(content).toBe(kept);
        }
      }
      const rerun = yield* runCli(root);
      expect(rerun).toEqual({
        exitCode: 0,
        stdout: "[prune-tsgo-backups] reclaimed ~0 MB of stale binary backups\n",
        stderr: "",
      });
    })
  );

  it.effect("does nothing before install and warns without blocking install on an invalid package directory", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "tsgo-prune-noop-" });
      const fresh = yield* runCli(root);
      expect(fresh).toEqual({ exitCode: 0, stdout: "", stderr: "" });
      yield* fs.makeDirectory(path.join(root, "node_modules"));
      yield* fs.writeFileString(path.join(root, "node_modules", "@typescript"), "not a directory");
      const failed = yield* runCli(root);
      expect(failed.exitCode).toBe(0);
      expect(failed.stdout).toBe("");
      expect(failed.stderr).toMatch(/^\[prune-tsgo-backups\] skipped: .+\n$/u);
    })
  );
});
