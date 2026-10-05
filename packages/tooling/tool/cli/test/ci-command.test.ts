import { appendTurboSummary, ciLaneCommand, runCiLocal } from "@beep/repo-cli/commands/Ci";
import { FsUtilsLive } from "@beep/repo-utils";
import { A } from "@beep/utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem, flow, Layer, Path, Result } from "effect";
import { Command } from "effect/cli";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as TestConsole from "effect/testing/TestConsole";

const TestLayer = Layer.mergeAll(
  NodeServices.layer,
  FsUtilsLive.pipe(Layer.provide(NodeServices.layer)),
  TestConsole.layer
);
const ciTest = it.layer(TestLayer, { timeout: "30 seconds" });
const runCiLaneCommand = Command.runWith(ciLaneCommand, { version: "0.0.0" });
const encodeJson = flow(S.encodeUnknownResult(S.fromJsonString(S.Unknown)), Result.getOrThrow);
const isString = (value: unknown): value is string => typeof value === "string";

const withTempRepo = <A, E, R>(use: Effect.Effect<A, E, R>) =>
  Effect.scoped(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const tmpDir = yield* fs.makeTempDirectoryScoped();
      const previousCwd = process.cwd();
      const previousGithubStepSummary = Bun.env.GITHUB_STEP_SUMMARY;

      yield* Effect.addFinalizer(() =>
        Effect.sync(() => {
          process.chdir(previousCwd);
          if (previousGithubStepSummary === undefined) {
            delete Bun.env.GITHUB_STEP_SUMMARY;
          } else {
            Bun.env.GITHUB_STEP_SUMMARY = previousGithubStepSummary;
          }
        })
      );
      process.chdir(tmpDir);
      delete Bun.env.GITHUB_STEP_SUMMARY;
      yield* fs.makeDirectory(".git", { recursive: true });

      return yield* use;
    })
  );

describe("CI commands", () => {
  ciTest("parses --partition and reports a typed lane-assignment failure", (it) => {
    it.effect("runs", () =>
      Effect.gen(function* () {
        const exit = yield* Effect.exit(runCiLaneCommand(["lint", "--partition", "unit-a"]));
        const errors = A.join(A.filter(yield* TestConsole.errorLines, isString), "\n");

        expect(exit._tag).toBe("Failure");
        expect(errors).toContain("Partition unit-a does not belong to lane lint");
        expect(errors).toContain("CiLanePartitions.ts");

        const shardedExit = yield* Effect.exit(runCiLaneCommand(["lint", "--partition", "repo-cli-2"]));
        const shardedErrors = A.join(A.filter(yield* TestConsole.errorLines, isString), "\n");
        expect(shardedExit._tag).toBe("Failure");
        expect(shardedErrors).toContain("Partition repo-cli-2 does not belong to lane lint");
        expect(shardedErrors).not.toContain("Invalid value");
      })
    );
  });

  ciTest("rejects proof-only --force without a partition", (it) => {
    it.effect("runs", () =>
      Effect.gen(function* () {
        const exit = yield* Effect.exit(runCiLaneCommand(["lint", "--force"]));
        const errors = A.join(A.filter(yield* TestConsole.errorLines, isString), "\n");

        expect(exit._tag).toBe("Failure");
        expect(errors).toContain("--force requires --partition");
      })
    );
  });

  ciTest("fails local planning when Git cannot resolve the current branch", (it) => {
    it.effect("runs", () =>
      withTempRepo(
        Effect.gen(function* () {
          const error = yield* runCiLocal({
            affected: false,
            base: "origin/main",
            fast: false,
            lanes: O.some("lint"),
          }).pipe(Effect.flip);

          expect(error._tag).toBe("CiCommandError");
          expect(error.message).toBe("git branch --show-current failed with exit code 128.");
        })
      )
    );
  });

  ciTest("renders current Turbo summary files whose tasks are arrays", (it) => {
    it.effect("runs", () =>
      withTempRepo(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const summaryPath = path.join(process.cwd(), ".turbo", "runs", "summary.json");

          yield* fs.makeDirectory(path.dirname(summaryPath), { recursive: true });
          yield* fs.writeFileString(
            summaryPath,
            encodeJson({
              execution: {
                attempted: 1,
                command: "turbo run test",
                endTime: 2_000,
                startTime: 0,
                success: 1,
              },
              tasks: [
                {
                  cache: {
                    local: true,
                    remote: false,
                    status: "HIT",
                  },
                  execution: {
                    endTime: 1_250,
                    startTime: 250,
                  },
                  resolvedTaskDefinition: {
                    cache: true,
                  },
                  taskId: "@beep/repo-cli#test",
                },
              ],
            })
          );

          yield* appendTurboSummary(O.some(summaryPath));

          const output = A.join(A.filter(yield* TestConsole.logLines, isString), "\n");
          expect(output).toContain("## Turbo Summary");
          expect(output).toContain("Attempted tasks: 1");
          expect(output).toContain("`@beep/repo-cli#test`");
        })
      )
    );
  });

  ciTest("renders every Turbo summary when aggregation is requested", (it) => {
    it.effect("runs", () =>
      withTempRepo(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const runDirectory = path.join(process.cwd(), ".turbo", "runs");

          yield* fs.makeDirectory(runDirectory, { recursive: true });
          yield* Effect.forEach(["build", "coverage"], (task, index) =>
            fs.writeFileString(
              path.join(runDirectory, `${task}.json`),
              encodeJson({
                execution: {
                  attempted: 1,
                  command: `turbo run ${task}`,
                  endTime: 2_000 + index,
                  startTime: index,
                  success: 1,
                },
                tasks: [
                  {
                    execution: { endTime: 1_500, startTime: 500 },
                    taskId: `@beep/repo-cli#${task}`,
                  },
                ],
              })
            )
          );

          yield* appendTurboSummary(O.none(), true);

          const output = A.join(A.filter(yield* TestConsole.logLines, isString), "\n");
          expect(output.match(/## Turbo Summary/gu) ?? []).toHaveLength(2);
          expect(output).toContain("`@beep/repo-cli#build`");
          expect(output).toContain("`@beep/repo-cli#coverage`");
        })
      )
    );
  });
});
