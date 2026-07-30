import { appendTurboSummary, runCiLocal } from "@beep/repo-cli/commands/Ci";
import { A } from "@beep/utils";
import { NodeServices } from "@effect/platform-node";
import { Effect, FileSystem, Layer, Path } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as TestConsole from "effect/testing/TestConsole";
import { describe, expect, it } from "vitest";

const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E | E2, RIn | Exclude<R, ROut>> =>
    Effect.scoped(Layer.build(layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

const TestLayer = Layer.mergeAll(NodeServices.layer, TestConsole.layer);
const encodeJson = S.encodeUnknownSync(S.UnknownFromJsonString);
const isString = (value: unknown): value is string => typeof value === "string";

const withTempRepo = <A, E, R>(use: Effect.Effect<A, E, R>) =>
  Effect.acquireUseRelease(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const tmpDir = yield* fs.makeTempDirectory();
      const previousCwd = process.cwd();
      const previousGithubStepSummary = Bun.env.GITHUB_STEP_SUMMARY;

      process.chdir(tmpDir);
      delete Bun.env.GITHUB_STEP_SUMMARY;
      yield* fs.makeDirectory(".git", { recursive: true });

      return { fs, previousCwd, previousGithubStepSummary, tmpDir } as const;
    }),
    () => use,
    ({ fs, previousCwd, previousGithubStepSummary, tmpDir }) =>
      Effect.gen(function* () {
        process.chdir(previousCwd);
        if (previousGithubStepSummary === undefined) {
          delete Bun.env.GITHUB_STEP_SUMMARY;
        } else {
          Bun.env.GITHUB_STEP_SUMMARY = previousGithubStepSummary;
        }
        yield* fs.remove(tmpDir, { recursive: true });
      })
  ).pipe(provideScopedLayer(TestLayer));

describe("CI commands", () => {
  it("fails local planning when Git cannot resolve the current branch", () =>
    Effect.runPromise(
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
    ));

  it("renders current Turbo summary files whose tasks are arrays", () =>
    Effect.runPromise(
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
    ));
});
