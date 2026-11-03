import { Git, GitCommandError } from "@beep/git/Git";
import { ActionOutputs } from "@beep/github-actions/ActionOutputs";
import { appendTurboSummary, CiRunnerOutputsLive, ciLaneCommand, runCiLocal } from "@beep/repo-cli/commands/Ci";
import { FsUtilsLive } from "@beep/repo-utils";
import { provideScopedLayer } from "@beep/test-utils";
import { A } from "@beep/utils";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Command from "effect/cli/Command";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { flow } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as TestConsole from "effect/testing/TestConsole";

// `Git` rides beside the platform services: repo-cli's typed git readers take it from the context (W1a).
const gitLayer = Git.layer.pipe(Layer.provide(NodeServices.layer));

const TestLayer = Layer.provideMerge(
  Git.layer,
  Layer.mergeAll(
    NodeServices.layer,
    NodeCrypto.layer,
    FsUtilsLive.pipe(Layer.provide(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer, gitLayer))),
    TestConsole.layer
  )
);
const ciTest = it.layer(TestLayer, { timeout: "30 seconds" });
const runCiLaneCommand = Command.runWith(ciLaneCommand, { version: "0.0.0" });
const encodeJson = flow(S.encodeUnknownResult(S.fromJsonString(S.Unknown)), Result.getOrThrow);
const isString = (value: unknown): value is string => typeof value === "string";

// Hosted runners export `GITHUB_STEP_SUMMARY` to every process, test workers included; the
// off-runner branch is a configuration under test, never the host's ambient environment.
const offRunner = Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown({}));

const withTempRepo = <A, E, R>(use: (root: string) => Effect.Effect<A, E, R>) =>
  Effect.scoped(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
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
      yield* fs.makeDirectory(path.join(tmpDir, ".git"), { recursive: true });

      return yield* use(tmpDir);
    })
  );

describe("CI commands", () => {
  ciTest("rejects incomplete artifact modes before spawning producers", (it) => {
    it.effect("runs", () =>
      Effect.gen(function* () {
        for (const args of [
          ["coverage", "--compare-only"],
          ["coverage", "--coverage-input", ".beep/download"],
          ["test-unit", "--coverage-output", ".beep/output"],
          ["lint", "--coverage-output", ".beep/output"],
          ["labs", "--coverage-only"],
        ]) {
          const result = yield* Effect.exit(runCiLaneCommand(args));
          expect(result._tag).toBe("Failure");
        }
        const errorLines1 = yield* TestConsole.errorLines;
        const errors = A.join(A.filter(errorLines1, isString), "\n");
        expect(errors).toContain("--compare-only and --coverage-input must be used together");
        expect(errors).toContain("Instrumented Test Unit execution requires --partition");
        expect(errors).toContain("--coverage-output requires a Test Unit partition or the Labs lane");
        expect(errors).toContain("--coverage-only requires Labs with --coverage-output");
      })
    );
  });

  ciTest("parses --partition and reports a typed lane-assignment failure", (it) => {
    it.effect("runs", () =>
      Effect.gen(function* () {
        const exit = yield* Effect.exit(runCiLaneCommand(["lint", "--partition", "unit-a"]));
        const errorLines2 = yield* TestConsole.errorLines;
        const errors = A.join(A.filter(errorLines2, isString), "\n");

        expect(exit._tag).toBe("Failure");
        expect(errors).toContain("Partition unit-a does not belong to lane lint");
        expect(errors).toContain("CiLanePartitions.ts");

        const shardedExit = yield* Effect.exit(runCiLaneCommand(["lint", "--partition", "repo-cli-2"]));
        const errorLines3 = yield* TestConsole.errorLines;
        const shardedErrors = A.join(A.filter(errorLines3, isString), "\n");
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
        const errorLines4 = yield* TestConsole.errorLines;
        const errors = A.join(A.filter(errorLines4, isString), "\n");

        expect(exit._tag).toBe("Failure");
        expect(errors).toContain("--force requires --partition");
      })
    );
  });

  ciTest("folds an unspawnable branch read and plans a detached HEAD as off-main", (it) => {
    it.effect("runs", () =>
      withTempRepo(() =>
        Effect.gen(function* () {
          const spawnFailure = GitCommandError.make({
            kind: "failed",
            args: ["branch", "--show-current"],
            cwd: "/repo",
            stderr: "",
            detail: "spawn ENOENT",
          });
          const unspawnable = yield* runCiLocal({
            affected: false,
            base: "origin/main",
            fast: false,
            lanes: O.some("lint"),
          }).pipe(
            Effect.provideService(Git, Git.makeTest({ currentBranch: () => Effect.fail(spawnFailure) })),
            Effect.flip
          );
          expect(unspawnable._tag).toBe("CiCommandError");
          expect(unspawnable.message).toBe("Failed to resolve the current git branch.");

          // A detached HEAD has no branch: the battery plans as off-main and, with no lane selected, runs nothing.
          yield* runCiLocal({ affected: false, base: "origin/main", fast: false, lanes: O.some(",") }).pipe(
            Effect.provideService(Git, Git.makeTest({ currentBranch: () => Effect.succeedNone }))
          );
          const logLines5 = yield* TestConsole.logLines;
          expect(A.filter(logLines5, isString)).toContain("[ci] local battery: ");
        })
      )
    );
  });

  ciTest("fails local planning when Git cannot resolve the current branch", (it) => {
    it.effect("runs", () =>
      withTempRepo(() =>
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
      withTempRepo((root) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const summaryPath = path.join(root, ".turbo", "runs", "summary.json");

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

          const recording = ActionOutputs.recording();
          yield* appendTurboSummary(O.some(summaryPath)).pipe(provideScopedLayer(recording.layer), offRunner);

          const logLines6 = yield* TestConsole.logLines;
          const output = A.join(A.filter(logLines6, isString), "\n");
          expect(output).toContain("## Turbo Summary");
          expect(output).toContain("Attempted tasks: 1");
          expect(output).toContain("`@beep/repo-cli#test`");
          // Off a runner the summary is printed, never published.
          expect(recording.entries()).toEqual([]);

          // On a runner it is appended after what the file already holds, the
          // bytes the old read-then-write produced: `${previous}${rendered}`.
          const stepSummary = path.join(root, "step-summary.md");
          yield* fs.writeFileString(stepSummary, "prior\n");
          const onRunner = Effect.provideService(
            ConfigProvider.ConfigProvider,
            ConfigProvider.fromUnknown({ GITHUB_STEP_SUMMARY: stepSummary })
          );
          const published = ActionOutputs.recording();
          yield* appendTurboSummary(O.some(summaryPath)).pipe(provideScopedLayer(published.layer), onRunner);
          const rendered = A.map(published.entries(), (entry) => entry.value);
          expect(A.length(rendered)).toBe(1);
          yield* appendTurboSummary(O.some(summaryPath)).pipe(provideScopedLayer(CiRunnerOutputsLive), onRunner);
          const readFileString7 = yield* fs.readFileString(stepSummary);
          expect(readFileString7).toBe(`prior\n${rendered[0] ?? ""}`);
        })
      )
    );
  });

  ciTest("renders every Turbo summary when aggregation is requested", (it) => {
    it.effect("runs", () =>
      withTempRepo((root) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const runDirectory = path.join(root, ".turbo", "runs");

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

          yield* appendTurboSummary(O.none(), true).pipe(
            provideScopedLayer(ActionOutputs.recording().layer),
            offRunner
          );

          const logLines8 = yield* TestConsole.logLines;
          const output = A.join(A.filter(logLines8, isString), "\n");
          expect(O.getOrNull(Str.match(/## Turbo Summary/gu)(output)) ?? []).toHaveLength(2);
          expect(output).toContain("`@beep/repo-cli#build`");
          expect(output).toContain("`@beep/repo-cli#coverage`");
        })
      )
    );
  });
});
