import { qualityCommand } from "@beep/repo-cli/commands/Quality";
import { MemoryStats, provideRuntimeRootForTesting, RuntimeRootChoice } from "@beep/repo-cli/test/RepoRun";
import { FsUtilsLive } from "@beep/repo-utils";
import { provideScopedLayer } from "@beep/test-utils";
import { A, Str } from "@beep/utils";
import { NodeServices } from "@effect/platform-node";
import { Effect, FileSystem, Layer, Sink, Stream } from "effect";
import * as P from "effect/Predicate";
import * as TestConsole from "effect/testing/TestConsole";
import { Command } from "effect/unstable/cli";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";
import { describe, expect, it } from "vitest";

const FixedMemoryStatsLayer = Layer.succeed(
  MemoryStats,
  MemoryStats.of({ availableGib: Effect.succeed(64), totalGib: Effect.succeed(128) })
);
const CommandTestLayer = Layer.mergeAll(
  NodeServices.layer,
  FsUtilsLive.pipe(Layer.provide(NodeServices.layer)),
  FixedMemoryStatsLayer,
  TestConsole.layer
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

const recordingSpawnerLayer = (spawned: Array<string>) =>
  Layer.succeed(
    ChildProcessSpawner.ChildProcessSpawner,
    ChildProcessSpawner.make((command) => {
      if (!ChildProcess.isStandardCommand(command)) {
        return Effect.die("quality command dispatch does not spawn piped commands");
      }
      A.appendInPlace(spawned, A.join([command.command, ...command.args], " "));
      return Effect.succeed(successfulHandle);
    })
  );

const consoleText = Effect.fn("QualityCommandDispatchTest.consoleText")(function* () {
  const logs = A.filter(yield* TestConsole.logLines, P.isString);
  const errors = A.filter(yield* TestConsole.errorLines, P.isString);
  return A.join(A.appendAll(logs, errors), "\n");
});

describe("quality command dispatch", () => {
  it("renders the root command index", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        yield* runQualityCommand([]);

        const output = yield* consoleText();
        expect(output).toContain("Quality commands:");
        expect(output).toContain("bun run beep quality profile detect");
        expect(output).toContain("bun run beep quality tmpfs-reap");
      }).pipe(provideScopedLayer(CommandTestLayer))
    ));

  it("dispatches the nested command indexes without external services", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        yield* runQualityCommand(["profile"]);
        yield* runQualityCommand(["scheduler"]);
        yield* runQualityCommand(["jsdoc-migrate"]);

        const output = yield* consoleText();
        expect(output).toContain("Quality profile commands:");
        expect(output).toContain("Quality scheduler commands:");
        expect(output).toContain("JSDoc carrier-migration commands:");
      }).pipe(provideScopedLayer(CommandTestLayer))
    ));

  it("parses and dispatches pure profile commands", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        yield* runQualityCommand(["profile", "config", "workstation"]);
        yield* runQualityCommand(["profile", "detect", "--json"]);

        const output = yield* consoleText();
        expect(output).toContain("profile=workstation");
        expect(output).toContain('"cpuCount"');
        expect(output).toContain('"memoryGiB"');
      }).pipe(provideScopedLayer(CommandTestLayer))
    ));

  it("maps the GitHub check collection flag before using a fake process layer", () => {
    const spawned: Array<string> = [];

    return Effect.runPromise(
      Effect.gen(function* () {
        yield* runQualityCommand(["github-checks", "security"]);
        yield* runQualityCommand(["github-checks", "security", "--collect-all"]);

        expect(spawned).toHaveLength(2);
        expect(A.every(spawned, Str.startsWith("docker run --rm"))).toBe(true);
      }).pipe(provideScopedLayer(Layer.mergeAll(CommandTestLayer, recordingSpawnerLayer(spawned))))
    );
  });

  it("dispatches scheduler status and dry-run/apply branches in an isolated runtime root", () =>
    Effect.runPromise(
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
      }).pipe(Effect.scoped, provideScopedLayer(CommandTestLayer))
    ));

  it("renders nested help and option descriptions", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        yield* runQualityCommand(["github-checks", "--help"]);
        yield* runQualityCommand(["turbo-config-proof", "--help"]);
        yield* runQualityCommand(["tmpfs-reap", "--help"]);

        const output = yield* consoleText();
        expect(output).toContain("Run repository GitHub verification lanes");
        expect(output).toContain("Run every local GitHub-check wave");
        expect(output).toContain("Dry-run selector");
        expect(output).toContain("Emit the encoded tmpfs-reap/v1 report as JSON");
      }).pipe(provideScopedLayer(CommandTestLayer))
    ));

  it("rejects invalid positional choices and flag values before execution", () =>
    Effect.runPromise(
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
      }).pipe(provideScopedLayer(CommandTestLayer))
    ));
});
