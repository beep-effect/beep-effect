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
  AiMetricsConfigSnapshotInput,
  AiMetricsQualityGateStatus,
  aiMetricsDerivedDuckDbPath,
  HarnessFingerprintInput,
  hashPublicTextSha256,
  makeAiMetricsConfigSnapshot,
  makeHarnessFingerprint,
  recordAiMetricsBenchmarkRun,
  upsertAiMetricsBenchmarkCase,
  withAiMetricsDuckDb,
} from "@beep/repo-ai-metrics";
import { findRepoRoot } from "@beep/repo-utils";
import { Clock, Effect, FileSystem, flow, Path, pipe } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { AgentEffectivenessEvalScorerError } from "../AgentEffectiveness.errors.ts";
import {
  AgentEffectivenessEvalRecordResult,
  AgentEffectivenessEvalScoreReport,
  SkillOptTaskManifest,
} from "../AgentEffectiveness.schemas.ts";

const $I = $RepoCliId.create("commands/AgentEffectiveness/internal/EvalRecord");
const normalizePathSeparators = Str.replaceAll("\\", "/");
const normalizeRelativePath: (value: string) => string = flow(normalizePathSeparators, Str.replace(/^\.\//, ""));

const recordNote = (report: AgentEffectivenessEvalScoreReport): string =>
  `skillopt scorer score=${report.score} completion=${report.breakdown.completion} schemaFirst=${report.breakdown.schemaFirst} tsgo=${report.breakdown.tsgo} biome=${report.breakdown.biome}`;

class RecordAgentEffectivenessEvalScoreOptions extends S.Class<RecordAgentEffectivenessEvalScoreOptions>(
  $I`RecordAgentEffectivenessEvalScoreOptions`
)(
  {
    dataRoot: S.String,
    elapsedMs: S.Finite,
    modelId: S.Option(S.NonEmptyString),
    reasoningEffort: S.Option(S.NonEmptyString),
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
 * `configSnapshotId` is `skillopt-scorer-<fingerprintId>`, where the
 * fingerprint is the `HarnessFingerprint` of the repo's agent configuration
 * snapshot plus the rollout model id and reasoning effort (`unknown` when not
 * supplied). It changes when harness surfaces or the model change, never when
 * the score changes.
 *
 * @category services
 * @since 0.0.0
 */
export const recordAgentEffectivenessEvalScore = Effect.fn("AgentEffectivenessEvalScorer.record")(function* ({
  dataRoot,
  elapsedMs,
  modelId,
  reasoningEffort,
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
  const configSnapshot = yield* makeAiMetricsConfigSnapshot(AiMetricsConfigSnapshotInput.make({ repoRoot })).pipe(
    Effect.mapError(AgentEffectivenessEvalScorerError.mapError("Failed to snapshot agent configuration."))
  );
  const fingerprint = yield* makeHarnessFingerprint(
    HarnessFingerprintInput.make({ modelId, reasoningEffort, snapshot: configSnapshot })
  ).pipe(Effect.mapError(AgentEffectivenessEvalScorerError.mapError("Failed to derive harness fingerprint.")));
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
        promptRef: O.some(normalizeRelativePath(taskPath)),
        title: task.id,
      })
    ),
    Effect.flatMap(() =>
      recordAiMetricsBenchmarkRun(
        AiMetricsBenchmarkRunInput.make({
          benchmarkCaseId: task.id,
          configSnapshotId: `skillopt-scorer-${fingerprint.fingerprintId}`,
          elapsedMs,
          note: O.some(recordNote(report)),
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
