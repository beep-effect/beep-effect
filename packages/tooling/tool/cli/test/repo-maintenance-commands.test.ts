import { gitCommand } from "@beep/repo-cli/commands/Git";
import { pruneTsgoBackups, toolchainCommand } from "@beep/repo-cli/commands/Toolchain";
import { it } from "@beep/test-runner";
import { NodeServices } from "@effect/platform-node";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Command from "effect/cli/Command";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as Str from "effect/String";
import * as TestConsole from "effect/testing/TestConsole";

// The git and toolchain command groups, run in-process through their command values; the
// spawned-CLI suites (regenerate-merge-driver, toolchain-prune-tsgo-backups) keep the end-to-end proof.
const runGit = Command.runWith(gitCommand, { version: "0.0.0" });
const runToolchain = Command.runWith(toolchainCommand, { version: "0.0.0" });

const lines = (logged: ReadonlyArray<unknown>) => A.map(logged, (line) => `${line}`);
const loggedLines = Effect.map(TestConsole.logLines, lines);
const errorLines = Effect.map(TestConsole.errorLines, lines);

// TestConsole records only log and error lines, so the prune warnings are read as errors.
const warningsAsErrors = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  Console.consoleWith((console) =>
    Effect.provideService(effect, Console.Console, { ...console, warn: (...args) => console.error(...args) })
  );

const prunePrefixed = Effect.map(errorLines, A.filter(Str.startsWith("[prune-tsgo-backups]")));

it.layer(NodeServices.layer, { timeout: "60 seconds" })("repo maintenance commands in-process", (it) => {
  it.effect(
    "lists the git groups and fails every merge-driver path closed",
    Effect.fnUntraced(function* () {
      yield* runGit([]);
      yield* runGit(["merge-driver"]);
      const projection = yield* runGit(["merge-driver", "regenerate", "O", "A", "B", "tsconfig.json"]).pipe(
        Effect.flip
      );
      const refused = yield* runGit(["merge-driver", "regenerate", "O", "A", "B", "bun.lock"]).pipe(Effect.flip);
      expect(projection).toMatchObject({ _tag: "CliReportedExit", exitCode: 1 });
      expect(refused).toMatchObject({
        _tag: "CliReportedExit",
        message: "regenerate merge driver refused non-projection path: bun.lock",
        exitCode: 1,
      });
      const logged = yield* loggedLines;
      const reported = yield* errorLines;
      expect(logged).toContain("git commands: merge-driver");
      expect(logged).toContain("git merge-driver commands: regenerate");
      expect(reported).toEqual([
        "regenerate merge driver left tsconfig.json conflicted; regenerate it after Git installs the merged tree",
        "regenerate merge driver refused non-projection path: bun.lock",
      ]);
    })
  );

  it.effect(
    "prunes the directory the command resolves as current",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "toolchain-command-" });
      // Only the @tsrs scope exists: the absent @typescript scope contributes no directories.
      const binary = path.join(root, "node_modules", "@tsrs", "linux-x64");
      yield* fs.makeDirectory(binary, { recursive: true });
      yield* fs.writeFileString(path.join(binary, "tsrs.original.3"), "rotation");
      yield* fs.writeFileString(path.join(binary, "tsrs.original"), "original");
      const resolvedHere = Path.Path.of({
        ...path,
        resolve: (...segments) => (A.join(segments, "/") === "." ? root : path.resolve(...segments)),
      });
      yield* runToolchain([]);
      yield* runToolchain(["prune-tsgo-backups"]).pipe(Effect.provideService(Path.Path, resolvedHere));
      const rotationKept = yield* fs.exists(path.join(binary, "tsrs.original.3"));
      const original = yield* fs.readFileString(path.join(binary, "tsrs.original"));
      const logged = yield* loggedLines;
      expect(rotationKept).toBe(false);
      expect(original).toBe("original");
      expect(logged).toContain("toolchain commands: prune-tsgo-backups");
      expect(logged).toContain("[prune-tsgo-backups] reclaimed ~0 MB of stale binary backups");
    })
  );

  it.effect(
    "stays silent on a fresh clone and turns every failure or defect into a skip warning",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const fresh = yield* fs.makeTempDirectoryScoped({ prefix: "toolchain-fresh-" });
      yield* pruneTsgoBackups(fresh).pipe(warningsAsErrors);
      const freshWarnings = yield* prunePrefixed;
      expect(freshWarnings).toEqual([]);
      const invalid = yield* fs.makeTempDirectoryScoped({ prefix: "toolchain-invalid-" });
      yield* fs.makeDirectory(path.join(invalid, "node_modules"));
      yield* fs.writeFileString(path.join(invalid, "node_modules", "@typescript"), "not a directory");
      yield* pruneTsgoBackups(invalid).pipe(warningsAsErrors);
      const defective = FileSystem.makeNoop({ exists: () => Effect.die("injected defect") });
      yield* pruneTsgoBackups(fresh).pipe(warningsAsErrors, Effect.provideService(FileSystem.FileSystem, defective));
      const warned = yield* prunePrefixed;
      expect(warned).toHaveLength(2);
      expect(warned[0]).toMatch(/^\[prune-tsgo-backups\] skipped: .+$/u);
      expect(warned[1]).toBe("[prune-tsgo-backups] skipped: injected defect");
    })
  );
});
