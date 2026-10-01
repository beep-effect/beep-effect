import { qualityCommand } from "@beep/repo-cli/commands/Quality";
import { MemoryStats, provideRuntimeRootForTesting, RuntimeRootChoice } from "@beep/repo-cli/test/RepoRun";
import { FsUtilsLive } from "@beep/repo-utils";
import { it } from "@beep/test-runner";
import { A } from "@beep/utils";
import { NodeServices } from "@effect/platform-node";
import { expect } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import { Console, Effect, Exit, FileSystem, Layer, Sink, Stream } from "effect";
import { Command } from "effect/cli";
import * as P from "effect/Predicate";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import * as TestConsole from "effect/testing/TestConsole";

const FixedMemoryStatsLayer = Layer.succeed(
  MemoryStats,
  MemoryStats.of({ availableGib: Effect.succeed(64), totalGib: Effect.succeed(128) })
);
const CommandTestLayer = Layer.mergeAll(
  NodeServices.layer,
  FsUtilsLive.pipe(Layer.provide(NodeServices.layer)),
  FixedMemoryStatsLayer
);
const runQualityCommand = Command.runWith(qualityCommand, { version: "0.0.0" });
const encoder = new TextEncoder();

const successfulHandle = ChildProcessSpawner.makeHandle({
  all: Stream.empty,
  exitCode: Effect.succeed(ChildProcessSpawner.ExitCode(0)),
  getInputFd: () => Sink.drain,
  getOutputFd: () => Stream.empty,
  isRunning: Effect.succeed(false),
  kill: () => Effect.void,
  pid: ChildProcessSpawner.ProcessId(1),
  stderr: Stream.empty,
  stdin: Sink.drain,
  stdout: Stream.make(encoder.encode("")),
  unref: Effect.succeed(Effect.void),
});

const recordingSpawner = (spawned: Array<string>, handle = successfulHandle) =>
  ChildProcessSpawner.make((command) => {
    if (!ChildProcess.isStandardCommand(command)) {
      return Effect.die("quality command dispatch does not spawn piped commands");
    }
    A.appendInPlace(spawned, A.join([command.command, ...command.args], " "));
    return Effect.succeed(handle);
  });

const consoleText = Effect.fn("QualityCommandDispatchTest.consoleText")(function* () {
  const logs = A.filter(yield* TestConsole.logLines, P.isString);
  const errors = A.filter(yield* TestConsole.errorLines, P.isString);
  return A.join(A.appendAll(logs, errors), "\n");
});

it.layer(CommandTestLayer, { timeout: "10 seconds" })("quality command dispatch", (it) => {
  it.effect("renders the root command index", () =>
    Effect.gen(function* () {
      yield* runQualityCommand([]);

      const output = yield* consoleText();
      expect(output).toContain("Quality commands:");
      expect(output).toContain("bun run beep quality profile detect");
      expect(output).toContain("bun run beep quality tmpfs-reap");
    }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
  );

  it.effect("dispatches the nested command indexes without external services", () =>
    Effect.gen(function* () {
      yield* runQualityCommand(["profile"]);
      yield* runQualityCommand(["scheduler"]);
      yield* runQualityCommand(["jsdoc-migrate"]);

      const output = yield* consoleText();
      expect(output).toContain("Quality profile commands:");
      expect(output).toContain("Quality scheduler commands:");
      expect(output).toContain("JSDoc carrier-migration commands:");
    }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
  );

  it.effect("parses and dispatches pure profile commands", () =>
    Effect.gen(function* () {
      yield* runQualityCommand(["profile", "config", "workstation"]);
      yield* runQualityCommand(["profile", "detect", "--json"]);

      const output = yield* consoleText();
      expect(output).toContain("profile=workstation");
      expect(output).toContain('"cpuCount"');
      expect(output).toContain('"memoryGiB"');
    }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
  );

  it.effect("maps the GitHub check collection flag before using a fake process layer", () => {
    const spawned: Array<string> = [];

    return Effect.gen(function* () {
      yield* runQualityCommand(["github-checks", "security"]);
      yield* runQualityCommand(["github-checks", "security", "--collect-all"]);

      expect(spawned).toEqual([
        "node --test scripts/test-onnxruntime-installer-patch.mjs",
        expect.stringMatching(/^docker run --rm /),
        "node --test scripts/test-onnxruntime-installer-patch.mjs",
        expect.stringMatching(/^docker run --rm /),
      ]);
    }).pipe(
      Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, recordingSpawner(spawned)),
      Effect.provideServiceEffect(Console.Console, TestConsole.make)
    );
  });

  it.effect("stops before OSV when the ONNX installer mitigation proof fails", () => {
    const spawned: Array<string> = [];
    const failedHandle = ChildProcessSpawner.makeHandle({
      ...successfulHandle,
      exitCode: Effect.succeed(ChildProcessSpawner.ExitCode(1)),
    });

    return Effect.gen(function* () {
      const exit = yield* Effect.exit(runQualityCommand(["github-checks", "security"]));

      assertTrue(Exit.isFailure(exit));
      expect(spawned).toEqual(["node --test scripts/test-onnxruntime-installer-patch.mjs"]);
    }).pipe(
      Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, recordingSpawner(spawned, failedHandle)),
      Effect.provideServiceEffect(Console.Console, TestConsole.make)
    );
  });

  it.effect("dispatches scheduler status and dry-run/apply branches in an isolated runtime root", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const runtimeRoot = yield* fs.makeTempDirectoryScoped({ prefix: "quality-command-scheduler-" });
      const choice = RuntimeRootChoice.make({ kind: "test-override", root: runtimeRoot });

      const exits = yield* Effect.forEach(
        [
          ["scheduler", "status", "--no-json"],
          ["scheduler", "status", "--json"],
          ["scheduler", "reap", "--no-apply"],
          ["scheduler", "reap", "--apply"],
        ],
        (argv) => Effect.exit(runQualityCommand(argv)),
        { concurrency: 1 }
      ).pipe(provideRuntimeRootForTesting(choice));

      expect(A.map(exits, (exit) => exit._tag)).toEqual(["Success", "Success", "Success", "Success"]);

      const output = yield* consoleText();
      expect(output).toContain("admission capacity: 0/10 tokens");
      expect(output).toContain('"capacityTokens": 10');
      expect(output).toContain("dry run — would reap:");
      expect(output).toContain("reaped dead admission state:");
    }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
  );

  it.effect("renders nested help and option descriptions", () =>
    Effect.gen(function* () {
      yield* runQualityCommand(["github-checks", "--help"]);
      yield* runQualityCommand(["turbo-config-proof", "--help"]);
      yield* runQualityCommand(["tmpfs-reap", "--help"]);

      const output = yield* consoleText();
      expect(output).toContain("Run repository GitHub verification lanes");
      expect(output).toContain("Run every local GitHub-check wave");
      expect(output).toContain("Dry-run selector");
      expect(output).toContain("Emit the encoded tmpfs-reap/v1 report as JSON");
    }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
  );

  it.effect("rejects invalid positional choices and flag values before execution", () =>
    Effect.gen(function* () {
      const exits = yield* Effect.forEach(
        [
          ["github-checks", "not-a-mode"],
          ["profile", "config", "not-a-profile"],
          ["turbo-config-proof", "--selector", "not-a-selector"],
          ["jsdoc-migrate", "titles", "--limit-files", "not-an-integer"],
        ],
        (argv) => Effect.exit(runQualityCommand(argv))
      );

      expect(A.every(exits, (exit) => exit._tag === "Failure")).toBe(true);

      const output = yield* consoleText();
      expect(output).toContain("not-a-mode");
      expect(output).toContain("not-a-profile");
      expect(output).toContain("not-a-selector");
      expect(output).toContain("not-an-integer");
    }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
  );
});
