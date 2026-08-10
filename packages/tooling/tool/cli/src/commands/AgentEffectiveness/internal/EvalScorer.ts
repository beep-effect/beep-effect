/**
 * SkillOpt eval scorer orchestration for `agent-effectiveness evals score`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { findRepoRoot } from "@beep/repo-utils";
import { A } from "@beep/utils";
import { Console, Duration, Effect, FileSystem, Order, Path, pipe } from "effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { AgentEffectivenessEvalScorerError } from "../AgentEffectiveness.errors.ts";
import { decodeTaskManifestJson, encodeAgentEffectivenessEvalScoreReportJson } from "../AgentEffectiveness.schemas.ts";
import { evaluateSkillOptCompletion, readSourceSnapshots } from "./EvalFixture.ts";
import { evaluateLaw } from "./EvalLawLanes.ts";
import { recordAgentEffectivenessEvalScore } from "./EvalRecord.ts";
import { EvalScoring } from "./EvalScoring.ts";
import type { ChildProcessSpawner } from "effect/unstable/process";
import type { AgentEffectivenessEvalScoreReport } from "../AgentEffectiveness.schemas.ts";

export * from "../AgentEffectiveness.errors.ts";
export * from "../AgentEffectiveness.schemas.ts";
export * from "./EvalFixture.ts";
export * from "./EvalRecord.ts";
export * from "./EvalScoring.ts";

const $I = $RepoCliId.create("commands/AgentEffectiveness/internal/EvalScorer");

/**
 * Aggregate law components by arithmetic mean.
 *
 * **Example** (Aggregate a law fraction)
 *
 * ```ts
 * import { aggregateLawFraction } from "@beep/repo-cli/test/AgentEffectiveness"
 *
 * console.log(aggregateLawFraction({ schemaFirst: 1, tsgo: 0.5, biome: 0.25 })) // 0.583333
 * ```
 *
 * @param scores - Schema-first, tsgo, and Biome component scores.
 * @returns Mean law fraction in `[0, 1]`.
 * @category scoring
 * @since 0.0.0
 */
export const aggregateLawFraction = (scores: Parameters<typeof EvalScoring.aggregateLawFraction>[0]): number =>
  EvalScoring.aggregateLawFraction(scores);

/**
 * Build the final score report from completion and law evaluations.
 *
 * **Example** (Build an agent effectiveness eval score report)
 *
 * ```ts
 * import {
 *   AgentEffectivenessEvalViolationSource,
 *   buildAgentEffectivenessEvalScoreReport,
 *   CompletionResult,
 *   LawEvaluation,
 *   SkillOptTaskManifest
 * } from "@beep/repo-cli/test/AgentEffectiveness"
 *
 * const task = SkillOptTaskManifest.make({
 *   id: "task-a",
 *   description: "Keep schema laws green.",
 *   requiredFiles: [],
 *   ruleIds: ["schema-first"]
 * })
 * const report = buildAgentEffectivenessEvalScoreReport(
 *   task,
 *   CompletionResult.make({ fraction: 1, violations: [] }),
 *   LawEvaluation.make({ schemaFirst: [], tsgo: [], biome: [] })
 * )
 * console.log(report.violations.length === 0) // true
 * console.log(AgentEffectivenessEvalViolationSource.literals.includes("schema-first")) // true
 * ```
 *
 * @param task - Task manifest the fixture was scored against.
 * @param completion - Completion-check outcome for the fixture.
 * @param law - Law-component violation sets for the fixture.
 * @returns Deterministic score report with breakdown and sorted violations.
 * @category scoring
 * @since 0.0.0
 */
export const buildAgentEffectivenessEvalScoreReport: {
  (
    completion: Parameters<typeof EvalScoring.buildAgentEffectivenessEvalScoreReport>[1],
    law: Parameters<typeof EvalScoring.buildAgentEffectivenessEvalScoreReport>[2]
  ): (
    task: Parameters<typeof EvalScoring.buildAgentEffectivenessEvalScoreReport>[0]
  ) => ReturnType<typeof EvalScoring.buildAgentEffectivenessEvalScoreReport>;
  (
    task: Parameters<typeof EvalScoring.buildAgentEffectivenessEvalScoreReport>[0],
    completion: Parameters<typeof EvalScoring.buildAgentEffectivenessEvalScoreReport>[1],
    law: Parameters<typeof EvalScoring.buildAgentEffectivenessEvalScoreReport>[2]
  ): ReturnType<typeof EvalScoring.buildAgentEffectivenessEvalScoreReport>;
} = dual(3, EvalScoring.buildAgentEffectivenessEvalScoreReport);

/**
 * Score one SkillOpt eval fixture directory.
 *
 * **Example** (Score an agent effectiveness eval)
 *
 * ```ts
 * import { scoreAgentEffectivenessEval } from "@beep/repo-cli/test/AgentEffectiveness"
 *
 * const program = scoreAgentEffectivenessEval({ dir: "fixtures/task", taskPath: "fixtures/task.json" })
 * console.log(program) // example value
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export const scoreAgentEffectivenessEval = Effect.fn("AgentEffectivenessEvalScorer.score")(function* ({
  dir,
  taskPath,
}: {
  readonly dir: string;
  readonly taskPath: string;
}): Effect.fn.Return<
  AgentEffectivenessEvalScoreReport,
  AgentEffectivenessEvalScorerError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const fixtureDir = path.resolve(dir);
  const manifestPath = path.resolve(taskPath);
  const fixtureStat = yield* fs.stat(fixtureDir).pipe(
    Effect.mapError(
      AgentEffectivenessEvalScorerError.mapError(`Fixture directory is not readable: ${fixtureDir}.`, {
        file: fixtureDir,
      })
    )
  );
  if (fixtureStat.type !== "Directory") {
    return yield* AgentEffectivenessEvalScorerError.new(`Fixture path is not a directory: ${fixtureDir}.`, {
      file: fixtureDir,
    });
  }

  const taskText = yield* fs.readFileString(manifestPath).pipe(
    Effect.mapError(
      AgentEffectivenessEvalScorerError.mapError(`Task manifest is not readable: ${manifestPath}.`, {
        file: manifestPath,
      })
    )
  );
  const task = yield* decodeTaskManifestJson(taskText).pipe(
    Effect.mapError(
      AgentEffectivenessEvalScorerError.mapError(`Task manifest is not valid scorer input: ${manifestPath}.`, {
        file: manifestPath,
      })
    )
  );
  const snapshots = yield* readSourceSnapshots(fixtureDir);
  const sourceFiles = pipe(
    snapshots,
    A.map((snapshot) => snapshot.relativePath),
    A.sort(Order.String)
  );
  const repoRoot = yield* findRepoRoot().pipe(
    Effect.mapError(AgentEffectivenessEvalScorerError.mapError("Failed to locate repository root."))
  );
  const completion = yield* evaluateSkillOptCompletion(task, fixtureDir);
  const law = yield* evaluateLaw(fixtureDir, repoRoot, sourceFiles);
  return buildAgentEffectivenessEvalScoreReport(task, completion, law);
});

class RunAgentEffectivenessEvalScoreCommandOptions extends S.Class<RunAgentEffectivenessEvalScoreCommandOptions>(
  $I`RunAgentEffectivenessEvalScoreCommandOptions`
)(
  {
    dataRoot: S.Option(S.String),
    dir: S.String,
    json: S.Boolean,
    record: S.Boolean,
    taskPath: S.String,
  },
  $I.annote("RunAgentEffectivenessEvalScoreCommandOptions", {
    description: "Options for running an agent effectiveness eval score; the data root is only present when recording.",
  })
) {}

/**
 * Render one scorer report to stdout and optionally record it.
 *
 * **Details**
 *
 * The data root is `Option`-valued and read only inside the `record` branch, so
 * pure fixture scoring never touches writable-store configuration — a
 * `HOME`-less hermetic container can score with `dataRoot: O.none()` as long as
 * it does not ask to record.
 *
 * **Example** (Score a fixture without recording)
 *
 * ```ts
 * import { runAgentEffectivenessEvalScoreCommand } from "@beep/repo-cli/commands/AgentEffectiveness/internal/EvalScorer"
 * import * as O from "effect/Option"
 *
 * const program = runAgentEffectivenessEvalScoreCommand({
 *   dataRoot: O.none(),
 *   dir: "fixtures/task",
 *   json: true,
 *   record: false,
 *   taskPath: "fixtures/task.json"
 * })
 * console.log(program) // example value
 * ```
 *
 * @category command-adapters
 * @since 0.0.0
 */
export const runAgentEffectivenessEvalScoreCommand = Effect.fn("AgentEffectivenessEvalScorer.runCommand")(function* ({
  dataRoot,
  dir,
  json,
  record,
  taskPath,
}: RunAgentEffectivenessEvalScoreCommandOptions): Effect.fn.Return<
  void,
  AgentEffectivenessEvalScorerError | S.SchemaError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const fs = yield* FileSystem.FileSystem;
  const taskText = yield* fs
    .readFileString(taskPath)
    .pipe(
      Effect.mapError(
        AgentEffectivenessEvalScorerError.mapError(`Task manifest is not readable: ${taskPath}.`, { file: taskPath })
      )
    );
  const task = yield* decodeTaskManifestJson(taskText).pipe(
    Effect.mapError(
      AgentEffectivenessEvalScorerError.mapError(`Task manifest is not valid scorer input: ${taskPath}.`, {
        file: taskPath,
      })
    )
  );
  const [elapsed, report] = yield* scoreAgentEffectivenessEval({ dir, taskPath }).pipe(Effect.timed);

  if (json) {
    yield* Console.log(yield* encodeAgentEffectivenessEvalScoreReportJson(report));
  } else {
    yield* Console.log(
      `agent-effectiveness eval score: task=${report.taskId} score=${report.score} completion=${report.breakdown.completion} schema-first=${report.breakdown.schemaFirst} tsgo=${report.breakdown.tsgo} biome=${report.breakdown.biome}`
    );
  }

  if (record) {
    const resolvedDataRoot = yield* O.match(dataRoot, {
      onNone: () => AgentEffectivenessEvalScorerError.new("Recording an eval score requires an AI metrics data root."),
      onSome: Effect.succeed,
    });
    yield* recordAgentEffectivenessEvalScore({
      dataRoot: resolvedDataRoot,
      elapsedMs: Duration.toMillis(elapsed),
      report,
      task,
      taskPath,
    });
  }
});
