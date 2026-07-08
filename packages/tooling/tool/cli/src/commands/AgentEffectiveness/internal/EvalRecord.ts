/**
 * AI-metrics recording for agent-effectiveness eval scoring.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import {
  AiMetricsBenchmarkCaseInput,
  AiMetricsBenchmarkRunInput,
  AiMetricsQualityGateStatus,
  aiMetricsDerivedDuckDbPath,
  DEFAULT_AI_METRICS_DATA_ROOT,
  hashPublicTextSha256,
  recordAiMetricsBenchmarkRun,
  upsertAiMetricsBenchmarkCase,
  withAiMetricsDuckDb,
} from "@beep/repo-ai-metrics";
import { findRepoRoot } from "@beep/repo-utils";
import { Clock, Effect, FileSystem, flow, Path, pipe } from "effect";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { AgentEffectivenessEvalScorerError } from "../AgentEffectiveness.errors.js";
import {
  AgentEffectivenessEvalRecordResult,
  AgentEffectivenessEvalScoreReport,
  SkillOptTaskManifest,
} from "../AgentEffectiveness.schemas.js";

const $I = $RepoCliId.create("commands/AgentEffectiveness/internal/EvalRecord");
const normalizePathSeparators = Str.replaceAll("\\", "/");
const normalizeRelativePath: (value: string) => string = flow(normalizePathSeparators, Str.replace(/^\.\//, ""));
const encodeJson = S.encodeUnknownEffect(S.UnknownFromJsonString);

const recordNote = (report: AgentEffectivenessEvalScoreReport): string =>
  `skillopt scorer score=${report.score} completion=${report.breakdown.completion} schemaFirst=${report.breakdown.schemaFirst} tsgo=${report.breakdown.tsgo} biome=${report.breakdown.biome}`;

class RecordAgentEffectivenessEvalScoreOptions extends S.Class<RecordAgentEffectivenessEvalScoreOptions>(
  $I`RecordAgentEffectivenessEvalScoreOptions`
)(
  {
    dataRoot: S.String.pipe(S.withConstructorDefault(Effect.succeed(DEFAULT_AI_METRICS_DATA_ROOT))),
    report: AgentEffectivenessEvalScoreReport,
    task: SkillOptTaskManifest,
    taskPath: S.String,
  },
  $I.annote("RecordAgentEffectivenessEvalScoreOptions", {
    description: "Options for recording an agent effectiveness eval score.",
  })
) {}

/**
 * Record a score report as an ai-metrics BenchmarkRun row.
 *
 * The task prompt body is never persisted; it is represented only by
 * `hashPublicTextSha256(task.prompt)` and the manifest path is retained as
 * `promptRef`.
 *
 * @category services
 * @since 0.0.0
 */
export const recordAgentEffectivenessEvalScore = Effect.fn("AgentEffectivenessEvalScorer.record")(function* ({
  dataRoot = DEFAULT_AI_METRICS_DATA_ROOT,
  report,
  task,
  taskPath,
}: RecordAgentEffectivenessEvalScoreOptions): Effect.fn.Return<
  AgentEffectivenessEvalRecordResult,
  AgentEffectivenessEvalScorerError,
  FileSystem.FileSystem | Path.Path
> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const repoRoot = yield* findRepoRoot().pipe(
    Effect.mapError(AgentEffectivenessEvalScorerError.mapError("Failed to locate repository root."))
  );
  const duckDbPath = path.resolve(repoRoot, aiMetricsDerivedDuckDbPath(dataRoot));
  yield* fs.makeDirectory(path.dirname(duckDbPath), { recursive: true }).pipe(
    Effect.mapError(
      AgentEffectivenessEvalScorerError.mapError("Failed to prepare ai-metrics derived data root.", {
        file: path.dirname(duckDbPath),
      })
    )
  );
  const promptHash = yield* hashPublicTextSha256(task.prompt).pipe(
    Effect.mapError(AgentEffectivenessEvalScorerError.mapError("Failed to hash SkillOpt task prompt."))
  );
  const configSnapshotPayload = yield* encodeJson({
    scorer: "agent-effectiveness-evals-score/v1",
    breakdown: report.breakdown,
  }).pipe(Effect.mapError(AgentEffectivenessEvalScorerError.mapError("Failed to encode scorer config snapshot.")));
  const configSnapshotDigest = yield* hashPublicTextSha256(configSnapshotPayload).pipe(
    Effect.mapError(AgentEffectivenessEvalScorerError.mapError("Failed to hash scorer config snapshot."))
  );
  const recordedAtEpochMillis = yield* Clock.currentTimeMillis;

  const run = yield* pipe(
    upsertAiMetricsBenchmarkCase(
      AiMetricsBenchmarkCaseInput.make({
        benchmarkCaseId: task.id,
        expectedChecks: [
          "bun run beep lint schema-first",
          `tsgo -p ${task.fixture}/tsconfig.json --pretty false --noEmit`,
          `biome check ${task.fixture} --reporter=json`,
        ],
        promptHash,
        promptRef: normalizeRelativePath(taskPath),
        title: task.id,
      })
    ),
    Effect.flatMap(() =>
      recordAiMetricsBenchmarkRun(
        AiMetricsBenchmarkRunInput.make({
          benchmarkCaseId: task.id,
          configSnapshotId: `skillopt-scorer-${configSnapshotDigest}`,
          elapsedMs: 0,
          note: recordNote(report),
          passed: report.score >= 0.999,
          qualityGate:
            report.score >= 0.999 ? AiMetricsQualityGateStatus.Enum.passed : AiMetricsQualityGateStatus.Enum.failed,
          recordedAtEpochMillis,
        })
      )
    ),
    withAiMetricsDuckDb(duckDbPath),
    Effect.mapError(AgentEffectivenessEvalScorerError.mapError("Failed to record ai-metrics BenchmarkRun."))
  );

  return AgentEffectivenessEvalRecordResult.make({
    benchmarkRunId: run.benchmarkRunId,
    benchmarkCaseId: run.benchmarkCaseId,
  });
});
