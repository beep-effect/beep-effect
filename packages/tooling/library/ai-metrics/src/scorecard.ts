/**
 * Labels, benchmark records, and weekly scorecard reports for repo AI metrics.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { DuckDb } from "@beep/duckdb";
import { $RepoAiMetricsId } from "@beep/identity/packages";
import { SchemaUtils } from "@beep/schema";
import { Unknown } from "@beep/schema/Unknown";
import { A, N, Str } from "@beep/utils";
import { Clock, Effect, FileSystem, flow, Order, Path, pipe } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { ensureAiMetricsDerivedStorage } from "./derived-storage.ts";
import {
  AiMetricsCoverageGap,
  AiMetricsDeployTarget,
  AiMetricsNonNegativeInteger,
  AiMetricsQualityGateStatus,
  AiMetricsRating,
  AiMetricsScoreWeights,
  AiMetricsSourceRole,
  AiMetricsTranscriptSource,
  BenchmarkCase,
  BenchmarkRun,
  OutcomeLabel,
  Scorecard,
} from "./models.ts";
import { hashPublicTextSha256, redactAiMetricsSensitiveText } from "./privacy.ts";

const $I = $RepoAiMetricsId.create("scorecard");

/**
 * Error raised by AI metrics label, benchmark, or scorecard workflows.
 *
 * **Example** (Creating scorecard error)
 *
 * ```ts
 * import { AiMetricsScorecardError } from "@beep/repo-ai-metrics"
 *
 * const error = AiMetricsScorecardError.make({
 *   cause: "duckdb write failed",
 *   message: "Failed to write AI metrics outcome label."
 * })
 * console.log(error.message)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class AiMetricsScorecardError extends S.TaggedError<AiMetricsScorecardError>($I`AiMetricsScorecardError`)(
  "AiMetricsScorecardError",
  {
    cause: S.Defect({ includeStack: true }),
    message: S.String,
  },
  $I.annote("AiMetricsScorecardError", {
    description: "Typed failure raised by AI metrics label, benchmark, and scorecard workflows.",
  })
) {}

/**
 * One task waiting for a human outcome label.
 *
 * **Example** (Building label queue item)
 *
 * ```ts
 * import { AiMetricsLabelQueueItem } from "@beep/repo-ai-metrics"
 *
 * const item = AiMetricsLabelQueueItem.make({
 *   agentTaskId: "task-1",
 *   configSnapshotId: "config-1",
 *   createdAtEpochMillis: 1_717_000_000_000,
 *   sourceKind: "codex",
 *   sourcePathHash: "source-hash",
 *   title: "Repair package docs",
 *   turnCount: 8
 * })
 * console.log(item.turnCount)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AiMetricsLabelQueueItem extends S.Class<AiMetricsLabelQueueItem>($I`AiMetricsLabelQueueItem`)(
  {
    agentTaskId: S.String,
    configSnapshotId: S.String,
    createdAtEpochMillis: S.Finite,
    sourceKind: AiMetricsTranscriptSource,
    sourcePathHash: S.String,
    sourceRole: AiMetricsSourceRole.pipe(
      S.withConstructorDefault(Effect.succeed(AiMetricsSourceRole.Enum.primary)),
      S.withDecodingDefaultKey(Effect.succeed(AiMetricsSourceRole.Enum.primary))
    ),
    title: S.String,
    turnCount: S.Finite,
  },
  $I.annote("AiMetricsLabelQueueItem", {
    description: "Deploy-safe task summary ready for human label review.",
  })
) {
  static readonly decodeRowsEffect = S.decodeUnknownEffect(S.Array(AiMetricsLabelQueueItem));
}

/**
 * Input for reading unlabeled tasks from the label queue.
 *
 * **Example** (Building label queue input)
 *
 * ```ts
 * import { AiMetricsLabelQueueInput } from "@beep/repo-ai-metrics"
 *
 * const input = AiMetricsLabelQueueInput.make({
 *   limit: 20,
 *   target: "local",
 *   windowEndEpochMillis: 1_717_604_800_000,
 *   windowStartEpochMillis: 1_717_000_000_000
 * })
 * console.log(input.limit)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AiMetricsLabelQueueInput extends S.Class<AiMetricsLabelQueueInput>($I`AiMetricsLabelQueueInput`)(
  {
    limit: S.Finite,
    target: AiMetricsDeployTarget,
    windowEndEpochMillis: S.Finite,
    windowStartEpochMillis: S.Finite,
  },
  $I.annote("AiMetricsLabelQueueInput", {
    description: "Window and limit used to select unlabeled AI metrics tasks.",
  })
) {}

/**
 * Result returned by the label queue.
 *
 * **Example** (Building empty queue result)
 *
 * ```ts
 * import { AiMetricsLabelQueueResult } from "@beep/repo-ai-metrics"
 *
 * const result = AiMetricsLabelQueueResult.make({
 *   items: [],
 *   target: "local",
 *   windowEndEpochMillis: 1_717_604_800_000,
 *   windowStartEpochMillis: 1_717_000_000_000
 * })
 * console.log(result.items.length)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AiMetricsLabelQueueResult extends S.Class<AiMetricsLabelQueueResult>($I`AiMetricsLabelQueueResult`)(
  {
    items: S.Array(AiMetricsLabelQueueItem),
    target: AiMetricsDeployTarget,
    windowEndEpochMillis: S.Finite,
    windowStartEpochMillis: S.Finite,
  },
  $I.annote("AiMetricsLabelQueueResult", {
    description: "Deploy-safe list of tasks pending human outcome labels.",
  })
) {
  static readonly decodeJsonEffect = S.decodeUnknownEffect(S.fromJsonString(AiMetricsLabelQueueResult));
  static readonly encodeJsonEffect = S.encodeEffect(S.fromJsonString(AiMetricsLabelQueueResult));
}

/**
 * Input for adding or replacing the current label for one task.
 *
 * **Example** (Building outcome label input)
 *
 * ```ts
 * import { AiMetricsOutcomeLabelInput } from "@beep/repo-ai-metrics"
 *
 * const input = AiMetricsOutcomeLabelInput.make({
 *   agentTaskId: "task-1",
 *   followUpFix: false,
 *   interventionCount: 1,
 *   passed: true,
 *   qualityGate: "passed",
 *   rating: 5
 * })
 * console.log(input.qualityGate)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AiMetricsOutcomeLabelInput extends S.Class<AiMetricsOutcomeLabelInput>($I`AiMetricsOutcomeLabelInput`)(
  {
    agentTaskId: S.String,
    followUpFix: S.Boolean,
    interventionCount: AiMetricsNonNegativeInteger,
    labeledAtEpochMillis: S.optionalKey(S.Finite),
    note: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    passed: S.Boolean,
    qualityGate: AiMetricsQualityGateStatus,
    rating: AiMetricsRating,
  },
  $I.annote("AiMetricsOutcomeLabelInput", {
    description: "Structured human label command payload for one AI-agent task.",
  })
) {}

/**
 * Input for adding or replacing a benchmark case.
 *
 * **Example** (Building benchmark case input)
 *
 * ```ts
 * import { AiMetricsBenchmarkCaseInput } from "@beep/repo-ai-metrics"
 *
 * const input = AiMetricsBenchmarkCaseInput.make({
 *   benchmarkCaseId: "case-1",
 *   expectedChecks: ["bun run check"],
 *   promptHash: "prompt-hash",
 *   title: "Package JSDoc repair"
 * })
 * console.log(input.expectedChecks)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AiMetricsBenchmarkCaseInput extends S.Class<AiMetricsBenchmarkCaseInput>($I`AiMetricsBenchmarkCaseInput`)(
  {
    benchmarkCaseId: S.String,
    expectedChecks: S.Array(S.String),
    promptHash: S.String,
    promptRef: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    title: S.String,
  },
  $I.annote("AiMetricsBenchmarkCaseInput", {
    description: "Deploy-safe benchmark case registration payload with prompt content referenced by hash.",
  })
) {}

/**
 * Result returned by the benchmark case list command.
 *
 * **Example** (Building case list result)
 *
 * ```ts
 * import { AiMetricsBenchmarkCaseListResult, BenchmarkCase } from "@beep/repo-ai-metrics"
 *
 * const result = AiMetricsBenchmarkCaseListResult.make({
 *   cases: [
 *     BenchmarkCase.make({
 *       benchmarkCaseId: "case-1",
 *       expectedChecks: ["bun run check"],
 *       promptHash: "prompt-hash",
 *       title: "Package JSDoc repair"
 *     })
 *   ]
 * })
 * console.log(result.cases.length)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AiMetricsBenchmarkCaseListResult extends S.Class<AiMetricsBenchmarkCaseListResult>(
  $I`AiMetricsBenchmarkCaseListResult`
)(
  {
    cases: S.Array(BenchmarkCase),
  },
  $I.annote("AiMetricsBenchmarkCaseListResult", {
    description: "Deploy-safe benchmark case list.",
  })
) {
  static readonly decodeJsonEffect = S.decodeUnknownEffect(S.fromJsonString(AiMetricsBenchmarkCaseListResult));
  static readonly encodeJsonEffect = S.encodeEffect(S.fromJsonString(AiMetricsBenchmarkCaseListResult));
}

/**
 * Input for recording an observed benchmark result.
 *
 * **Example** (Building benchmark run input)
 *
 * ```ts
 * import { AiMetricsBenchmarkRunInput } from "@beep/repo-ai-metrics"
 *
 * const input = AiMetricsBenchmarkRunInput.make({
 *   benchmarkCaseId: "case-1",
 *   configSnapshotId: "config-1",
 *   elapsedMs: 42_000,
 *   passed: true,
 *   qualityGate: "passed"
 * })
 * console.log(input.elapsedMs)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AiMetricsBenchmarkRunInput extends S.Class<AiMetricsBenchmarkRunInput>($I`AiMetricsBenchmarkRunInput`)(
  {
    benchmarkCaseId: S.String,
    configSnapshotId: S.String,
    elapsedMs: AiMetricsNonNegativeInteger,
    note: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    passed: S.Boolean,
    qualityGate: AiMetricsQualityGateStatus,
    recordedAtEpochMillis: S.optionalKey(S.Finite),
  },
  $I.annote("AiMetricsBenchmarkRunInput", {
    description: "Observed benchmark result tied to one AI-agent config snapshot.",
  })
) {}

/**
 * One config-snapshot row inside a weekly report.
 *
 * **Example** (Building weekly config score)
 *
 * ```ts
 * import { AiMetricsWeeklyConfigScore, AiMetricsScoreWeights, Scorecard } from "@beep/repo-ai-metrics"
 *
 * const score = AiMetricsWeeklyConfigScore.make({
 *   scorecard: Scorecard.make({
 *     benchmarkRunCount: 1,
 *     configSnapshotId: "config-1",
 *     costScore: 0.8,
 *     coverageGaps: [],
 *     flowScore: 0.7,
 *     labelCount: 1,
 *     outcomeScore: 0.9,
 *     scorecardId: "scorecard-1",
 *     taskCount: 2,
 *     totalScore: 0.86,
 *     weights: AiMetricsScoreWeights.make({}),
 *     windowEndEpochMillis: 1_717_604_800_000,
 *     windowStartEpochMillis: 1_717_000_000_000
 *   })
 * })
 * console.log(score.scorecard.totalScore)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AiMetricsWeeklyConfigScore extends S.Class<AiMetricsWeeklyConfigScore>($I`AiMetricsWeeklyConfigScore`)(
  {
    scorecard: Scorecard,
  },
  $I.annote("AiMetricsWeeklyConfigScore", {
    description: "Config-snapshot score row rendered in the weekly AI metrics report.",
  })
) {}

/**
 * Machine-readable weekly report document.
 *
 * **Example** (Building weekly report document)
 *
 * ```ts
 * import { AiMetricsWeeklyReportDocument } from "@beep/repo-ai-metrics"
 *
 * const document = AiMetricsWeeklyReportDocument.make({
 *   coverageGaps: ["no_benchmark_runs"],
 *   generatedAtEpochMillis: 1_717_604_800_000,
 *   scores: [],
 *   target: "local",
 *   windowEndEpochMillis: 1_717_604_800_000,
 *   windowStartEpochMillis: 1_717_000_000_000
 * })
 * console.log(document.coverageGaps)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AiMetricsWeeklyReportDocument extends S.Class<AiMetricsWeeklyReportDocument>(
  $I`AiMetricsWeeklyReportDocument`
)(
  {
    coverageGaps: S.Array(S.String),
    generatedAtEpochMillis: S.Finite,
    scores: S.Array(AiMetricsWeeklyConfigScore),
    target: AiMetricsDeployTarget,
    windowEndEpochMillis: S.Finite,
    windowStartEpochMillis: S.Finite,
  },
  $I.annote("AiMetricsWeeklyReportDocument", {
    description: "Deploy-safe weekly config-impact scorecard document.",
  })
) {}

/**
 * Input for generating a weekly config-impact report.
 *
 * **Example** (Building weekly report input)
 *
 * ```ts
 * import { AiMetricsWeeklyReportInput } from "@beep/repo-ai-metrics"
 *
 * const input = AiMetricsWeeklyReportInput.make({
 *   reportDir: ".beep/ai-metrics/reports",
 *   target: "local",
 *   windowEndEpochMillis: 1_717_604_800_000,
 *   windowStartEpochMillis: 1_717_000_000_000
 * })
 * console.log(input.reportDir)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AiMetricsWeeklyReportInput extends S.Class<AiMetricsWeeklyReportInput>($I`AiMetricsWeeklyReportInput`)(
  {
    reportDir: S.String,
    target: AiMetricsDeployTarget,
    windowEndEpochMillis: S.Finite,
    windowStartEpochMillis: S.Finite,
  },
  $I.annote("AiMetricsWeeklyReportInput", {
    description: "Target, output directory, and rolling window for a weekly AI metrics report.",
  })
) {}

/**
 * Result returned after writing weekly report artifacts.
 *
 * **Example** (Building weekly report result)
 *
 * ```ts
 * import { AiMetricsWeeklyReportDocument, AiMetricsWeeklyReportResult } from "@beep/repo-ai-metrics"
 *
 * const result = AiMetricsWeeklyReportResult.make({
 *   document: AiMetricsWeeklyReportDocument.make({
 *     coverageGaps: [],
 *     generatedAtEpochMillis: 1_717_604_800_000,
 *     scores: [],
 *     target: "local",
 *     windowEndEpochMillis: 1_717_604_800_000,
 *     windowStartEpochMillis: 1_717_000_000_000
 *   }),
 *   jsonPath: ".beep/ai-metrics/reports/weekly.json",
 *   markdownPath: ".beep/ai-metrics/reports/weekly.md"
 * })
 * console.log(result.jsonPath)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AiMetricsWeeklyReportResult extends S.Class<AiMetricsWeeklyReportResult>($I`AiMetricsWeeklyReportResult`)(
  {
    document: AiMetricsWeeklyReportDocument,
    jsonPath: S.String,
    markdownPath: S.String,
  },
  $I.annote("AiMetricsWeeklyReportResult", {
    description: "Weekly report document plus durable Markdown and JSON artifact paths.",
  })
) {
  static readonly decodeJsonEffect = S.decodeUnknownEffect(S.fromJsonString(AiMetricsWeeklyReportResult));
  static readonly encodeJsonEffect = S.encodeEffect(S.fromJsonString(AiMetricsWeeklyReportResult));
}

const NonNegativeCount = S.Int.check(
  S.isGreaterThanOrEqualTo(0, {
    identifier: $I`NonNegativeCountCheck`,
    title: "Non-negative count",
    description: "An integer count produced by a DuckDB aggregate.",
    message: "Expected a non-negative integer count",
  })
).pipe(
  $I.annoteSchema("NonNegativeCount", {
    description: "Non-negative integer count decoded from a DuckDB aggregate row.",
  })
);

const NonNegativeFinite = S.Finite.check(
  S.isGreaterThanOrEqualTo(0, {
    identifier: $I`NonNegativeFiniteCheck`,
    title: "Non-negative finite number",
    description: "A finite aggregate value that cannot be negative.",
    message: "Expected a non-negative finite number",
  })
).pipe(
  $I.annoteSchema("NonNegativeFinite", {
    description: "Non-negative finite value decoded from a DuckDB aggregate row.",
  })
);

const UnitInterval = S.Finite.check(
  S.isBetween(
    { minimum: 0, maximum: 1 },
    {
      identifier: $I`UnitIntervalCheck`,
      title: "Unit interval",
      description: "A finite aggregate rate or score in the inclusive unit interval.",
      message: "Expected a finite number between 0 and 1",
    }
  )
).pipe(
  $I.annoteSchema("UnitInterval", {
    description: "Finite aggregate rate or score in the inclusive range from zero through one.",
  })
);

class TaskPresenceRow extends S.Class<TaskPresenceRow>($I`TaskPresenceRow`)(
  {
    agentTaskId: S.String,
  },
  $I.annote("TaskPresenceRow", {
    description: "DuckDB row proving an AI metrics task exists before labeling.",
  })
) {
  static readonly decodeRowsEffect = S.decodeUnknownEffect(S.Array(TaskPresenceRow));
}

class BenchmarkCaseRow extends S.Class<BenchmarkCaseRow>($I`BenchmarkCaseRow`)(
  {
    benchmarkCaseId: S.String,
    expectedChecks: S.Array(S.String).pipe(S.fromJsonString),
    promptHash: S.String,
    promptRef: S.OptionFromNullOr(S.String),
    title: S.String,
  },
  $I.annote("BenchmarkCaseRow", {
    description: "DuckDB benchmark case row with JSON and nullable columns decoded at the row boundary.",
  })
) {
  static readonly decodeRowsEffect = S.decodeUnknownEffect(S.Array(BenchmarkCaseRow));
}

class TaskAggregateRow extends S.Class<TaskAggregateRow>($I`TaskAggregateRow`)(
  {
    averageInterventionCount: NonNegativeFinite,
    averageQualityGateScore: UnitInterval,
    averageRating: S.Finite,
    configSnapshotId: S.String,
    followUpFixCount: NonNegativeCount,
    labelCount: NonNegativeCount,
    passRate: UnitInterval,
    taskCount: NonNegativeCount,
  },
  $I.annote("TaskAggregateRow", {
    description: "Task and label aggregates grouped by AI metrics config snapshot.",
  })
) {
  static readonly decodeRowsEffect = S.decodeUnknownEffect(S.Array(TaskAggregateRow));
}

class BenchmarkAggregateRow extends S.Class<BenchmarkAggregateRow>($I`BenchmarkAggregateRow`)(
  {
    benchmarkPassRate: UnitInterval,
    benchmarkQualityGateScore: UnitInterval,
    benchmarkRunCount: NonNegativeCount,
    configSnapshotId: S.String,
  },
  $I.annote("BenchmarkAggregateRow", {
    description: "Benchmark aggregates grouped by AI metrics config snapshot.",
  })
) {
  static readonly decodeRowsEffect = S.decodeUnknownEffect(S.Array(BenchmarkAggregateRow));
}

class CoverageCountsRow extends S.Class<CoverageCountsRow>($I`CoverageCountsRow`)(
  {
    modelCallCount: NonNegativeCount,
    toolInvocationCount: NonNegativeCount,
  },
  $I.annote("CoverageCountsRow", {
    description: "Derived metric coverage counts used by the weekly scorecard.",
  })
) {
  static readonly decodeRowsEffect = S.decodeUnknownEffect(S.Array(CoverageCountsRow));
}

const encodeJson = Unknown.encodeUnknownEffectFromJsonString;

const scorecardFailure = (message: string, cause: unknown): AiMetricsScorecardError =>
  AiMetricsScorecardError.make({ cause, message });

const boundedUnit: (value: number) => number = N.clamp({ minimum: 0, maximum: 1 });

const ensureScorecardStorage: Effect.Effect<void, AiMetricsScorecardError, DuckDb> = ensureAiMetricsDerivedStorage.pipe(
  Effect.mapError((cause) => scorecardFailure("Failed to ensure AI metrics scorecard storage.", cause))
);

const jsonString = Effect.fn("AiMetrics.scorecard.jsonString")(function* (value: unknown) {
  return yield* encodeJson(value).pipe(
    Effect.mapError((cause) => scorecardFailure("Failed to encode AI metrics scorecard JSON.", cause))
  );
});

const rowId = Effect.fn("AiMetrics.scorecard.rowId")(function* (
  prefix: string,
  parts: ReadonlyArray<string | number | boolean>
) {
  const digest = yield* hashPublicTextSha256(pipe(A.map(parts, globalThis.String), A.join("\u0000"))).pipe(
    Effect.mapError((cause) => scorecardFailure("Failed to build AI metrics scorecard row id.", cause))
  );
  return `${prefix}-${digest}`;
});

const noteOrNull = O.match({ onNone: () => null, onSome: redactAiMetricsSensitiveText });

const epochMillisParam = (value: number): string => globalThis.String(value);

const ensureTaskExists = Effect.fn("AiMetrics.scorecard.ensureTaskExists")(function* (agentTaskId: string) {
  const duckdb = yield* DuckDb;
  const rows = yield* duckdb
    .query(
      `SELECT agent_task_id AS "agentTaskId"
       FROM ai_metrics_agent_tasks
       WHERE agent_task_id = $agentTaskId
       LIMIT 1`,
      { agentTaskId }
    )
    .pipe(Effect.mapError((cause) => scorecardFailure("Failed to verify AI metrics task before labeling.", cause)));
  const decoded = yield* TaskPresenceRow.decodeRowsEffect(rows).pipe(
    Effect.mapError((cause) => scorecardFailure("Failed to decode AI metrics task lookup.", cause))
  );

  if (A.isReadonlyArrayNonEmpty(decoded)) {
    return;
  }

  return yield* scorecardFailure("AI metrics label target task does not exist.", { agentTaskId });
});

const ensureBenchmarkCaseExists = Effect.fn("AiMetrics.scorecard.ensureBenchmarkCaseExists")(function* (
  benchmarkCaseId: string
) {
  const duckdb = yield* DuckDb;
  const rows = yield* duckdb
    .query(
      `SELECT benchmark_case_id AS "benchmarkCaseId",
              title AS "title",
              prompt_hash AS "promptHash",
              prompt_ref AS "promptRef",
              expected_checks_json AS "expectedChecks"
       FROM ai_metrics_benchmark_cases
       WHERE benchmark_case_id = $benchmarkCaseId
       LIMIT 1`,
      { benchmarkCaseId }
    )
    .pipe(Effect.mapError((cause) => scorecardFailure("Failed to verify AI metrics benchmark case.", cause)));
  const decoded = yield* BenchmarkCaseRow.decodeRowsEffect(rows).pipe(
    Effect.mapError((cause) => scorecardFailure("Failed to decode AI metrics benchmark case lookup.", cause))
  );

  if (A.isReadonlyArrayNonEmpty(decoded)) {
    return;
  }

  return yield* scorecardFailure("AI metrics benchmark case does not exist.", { benchmarkCaseId });
});

/**
 * Read unlabeled tasks for human review.
 *
 * **Example** (Queueing unlabeled tasks)
 *
 * ```ts
 * import { AiMetricsLabelQueueInput, queueAiMetricsLabels } from "@beep/repo-ai-metrics"
 * const program = queueAiMetricsLabels(
 *   AiMetricsLabelQueueInput.make({
 *     limit: 20,
 *     target: "local",
 *     windowEndEpochMillis: 1_717_604_800_000,
 *     windowStartEpochMillis: 1_717_000_000_000
 *   })
 * )
 * console.log(program)
 * ```
 *
 * @effects Ensures scorecard tables exist and queries DuckDB for unlabeled tasks in the selected window.
 * @category services
 * @since 0.0.0
 */
export const queueAiMetricsLabels: (
  input: AiMetricsLabelQueueInput
) => Effect.Effect<AiMetricsLabelQueueResult, AiMetricsScorecardError, DuckDb> = Effect.fn(
  "AiMetrics.queueAiMetricsLabels"
)(
  function* (input) {
    yield* ensureScorecardStorage;
    const duckdb = yield* DuckDb;
    const rows = yield* duckdb
      .query(
        `SELECT
           t.agent_task_id AS "agentTaskId",
           t.title AS "title",
           t.source_kind AS "sourceKind",
           t.source_path_hash AS "sourcePathHash",
           COALESCE(t.source_role, 'primary') AS "sourceRole",
           t.config_snapshot_id AS "configSnapshotId",
           t.created_at_epoch_ms::DOUBLE AS "createdAtEpochMillis",
           count(turns.turn_id)::INTEGER AS "turnCount"
         FROM ai_metrics_agent_tasks t
         LEFT JOIN ai_metrics_sessions s ON s.agent_task_id = t.agent_task_id
         LEFT JOIN ai_metrics_turns turns ON turns.agent_session_id = s.agent_session_id
         LEFT JOIN ai_metrics_outcome_labels labels ON labels.agent_task_id = t.agent_task_id
         WHERE t.created_at_epoch_ms >= $windowStartEpochMillis
           AND t.created_at_epoch_ms < $windowEndEpochMillis
           AND labels.label_id IS NULL
         GROUP BY
           t.agent_task_id,
           t.title,
           t.source_kind,
           t.source_path_hash,
           t.source_role,
           t.config_snapshot_id,
           t.created_at_epoch_ms
         ORDER BY t.created_at_epoch_ms DESC
         LIMIT $limit`,
        {
          limit: input.limit,
          windowEndEpochMillis: epochMillisParam(input.windowEndEpochMillis),
          windowStartEpochMillis: epochMillisParam(input.windowStartEpochMillis),
        }
      )
      .pipe(Effect.mapError((cause) => scorecardFailure("Failed to read AI metrics label queue.", cause)));
    const decoded = yield* AiMetricsLabelQueueItem.decodeRowsEffect(rows).pipe(
      Effect.mapError((cause) => scorecardFailure("Failed to decode AI metrics label queue.", cause))
    );

    return AiMetricsLabelQueueResult.make({
      items: decoded,
      target: input.target,
      windowEndEpochMillis: input.windowEndEpochMillis,
      windowStartEpochMillis: input.windowStartEpochMillis,
    });
  },
  (effect, input) =>
    effect.pipe(
      Effect.withSpan("repo_ai_metrics.label.queue", {
        attributes: {
          "ai_metrics.label.limit": input.limit,
          "ai_metrics.target": input.target,
        },
      })
    )
);

/**
 * Add or replace the current structured human label for a task.
 *
 * **Example** (Adding outcome label)
 *
 * ```ts
 * import { AiMetricsOutcomeLabelInput, addAiMetricsOutcomeLabel } from "@beep/repo-ai-metrics"
 * const program = addAiMetricsOutcomeLabel(
 *   AiMetricsOutcomeLabelInput.make({
 *     agentTaskId: "task-1",
 *     followUpFix: false,
 *     interventionCount: 1,
 *     passed: true,
 *     qualityGate: "passed",
 *     rating: 5
 *   })
 * )
 * console.log(program)
 * ```
 *
 * @effects Ensures scorecard tables exist, verifies the task exists, and upserts one DuckDB outcome-label row.
 * @category services
 * @since 0.0.0
 */
export const addAiMetricsOutcomeLabel: (
  input: AiMetricsOutcomeLabelInput
) => Effect.Effect<OutcomeLabel, AiMetricsScorecardError, DuckDb> = Effect.fn("AiMetrics.addAiMetricsOutcomeLabel")(
  function* (input) {
    yield* ensureScorecardStorage;
    yield* ensureTaskExists(input.agentTaskId);

    const labeledAtEpochMillis = input.labeledAtEpochMillis ?? (yield* Clock.currentTimeMillis);
    const note = noteOrNull(input.note);
    const label = OutcomeLabel.make({
      agentTaskId: input.agentTaskId,
      followUpFix: input.followUpFix,
      interventionCount: input.interventionCount,
      labelId: yield* rowId("label", [input.agentTaskId]),
      labeledAtEpochMillis,
      passed: input.passed,
      qualityGate: input.qualityGate,
      rating: input.rating,
      note: O.map(input.note, redactAiMetricsSensitiveText),
    });
    const duckdb = yield* DuckDb;
    yield* duckdb
      .run(
        `INSERT OR REPLACE INTO ai_metrics_outcome_labels (
          label_id,
          agent_task_id,
          rating,
          passed,
          quality_gate,
          intervention_count,
          follow_up_fix,
          note,
          labeled_at_epoch_ms
        ) VALUES (
          $labelId,
          $agentTaskId,
          $rating,
          $passed,
          $qualityGate,
          $interventionCount,
          $followUpFix,
          $note,
          $labeledAtEpochMillis
        )`,
        {
          agentTaskId: label.agentTaskId,
          followUpFix: label.followUpFix,
          interventionCount: label.interventionCount,
          labelId: label.labelId,
          labeledAtEpochMillis: epochMillisParam(label.labeledAtEpochMillis),
          note,
          passed: label.passed,
          qualityGate: label.qualityGate,
          rating: label.rating,
        }
      )
      .pipe(Effect.mapError((cause) => scorecardFailure("Failed to write AI metrics outcome label.", cause)));

    return label;
  }
);

/**
 * Add or replace a deploy-safe benchmark case.
 *
 * **Example** (Upserting benchmark case)
 *
 * ```ts
 * import { AiMetricsBenchmarkCaseInput, upsertAiMetricsBenchmarkCase } from "@beep/repo-ai-metrics"
 * const program = upsertAiMetricsBenchmarkCase(
 *   AiMetricsBenchmarkCaseInput.make({
 *     benchmarkCaseId: "case-1",
 *     expectedChecks: ["bun run check"],
 *     promptHash: "prompt-hash",
 *     title: "Package JSDoc repair"
 *   })
 * )
 * console.log(program)
 * ```
 *
 * @effects Ensures scorecard tables exist and upserts one DuckDB benchmark-case row.
 * @category services
 * @since 0.0.0
 */
export const upsertAiMetricsBenchmarkCase: (
  input: AiMetricsBenchmarkCaseInput
) => Effect.Effect<BenchmarkCase, AiMetricsScorecardError, DuckDb> = Effect.fn(
  "AiMetrics.upsertAiMetricsBenchmarkCase"
)(function* (input) {
  yield* ensureScorecardStorage;
  const expectedChecksJson = yield* jsonString(input.expectedChecks);
  const benchmarkCase = BenchmarkCase.make({
    benchmarkCaseId: input.benchmarkCaseId,
    expectedChecks: input.expectedChecks,
    promptHash: input.promptHash,
    title: input.title,
    promptRef: input.promptRef,
  });
  const duckdb = yield* DuckDb;
  yield* duckdb
    .run(
      `INSERT OR REPLACE INTO ai_metrics_benchmark_cases (
          benchmark_case_id,
          title,
          prompt_hash,
          prompt_ref,
          expected_checks_json,
          created_at_epoch_ms
        ) VALUES (
          $benchmarkCaseId,
          $title,
          $promptHash,
          $promptRef,
          $expectedChecksJson,
          $createdAtEpochMillis
        )`,
      {
        benchmarkCaseId: benchmarkCase.benchmarkCaseId,
        createdAtEpochMillis: epochMillisParam(yield* Clock.currentTimeMillis),
        expectedChecksJson,
        promptHash: benchmarkCase.promptHash,
        promptRef: O.getOrNull(input.promptRef),
        title: benchmarkCase.title,
      }
    )
    .pipe(Effect.mapError((cause) => scorecardFailure("Failed to write AI metrics benchmark case.", cause)));

  return benchmarkCase;
});

const caseFromRow = (row: BenchmarkCaseRow): BenchmarkCase =>
  BenchmarkCase.make({
    benchmarkCaseId: row.benchmarkCaseId,
    expectedChecks: row.expectedChecks,
    promptHash: row.promptHash,
    title: row.title,
    promptRef: row.promptRef,
  });

/**
 * List deploy-safe benchmark cases.
 *
 * **Example** (Listing benchmark cases)
 *
 * ```ts
 * import { listAiMetricsBenchmarkCases } from "@beep/repo-ai-metrics"
 * import { Effect } from "effect"
 * const program = listAiMetricsBenchmarkCases.pipe(
 *   Effect.map((result) => result.cases.length)
 * )
 * console.log(program)
 * ```
 *
 * @effects Ensures scorecard tables exist and queries DuckDB for benchmark cases.
 * @category services
 * @since 0.0.0
 */
export const listAiMetricsBenchmarkCases: Effect.Effect<
  AiMetricsBenchmarkCaseListResult,
  AiMetricsScorecardError,
  DuckDb
> = Effect.gen(function* () {
  yield* ensureScorecardStorage;
  const duckdb = yield* DuckDb;
  const rows = yield* duckdb
    .query(
      `SELECT benchmark_case_id AS "benchmarkCaseId",
              title AS "title",
              prompt_hash AS "promptHash",
              prompt_ref AS "promptRef",
              expected_checks_json AS "expectedChecks"
       FROM ai_metrics_benchmark_cases
       ORDER BY benchmark_case_id`
    )
    .pipe(Effect.mapError((cause) => scorecardFailure("Failed to list AI metrics benchmark cases.", cause)));
  const decoded = yield* BenchmarkCaseRow.decodeRowsEffect(rows).pipe(
    Effect.mapError((cause) => scorecardFailure("Failed to decode AI metrics benchmark cases.", cause))
  );
  const cases = A.map(decoded, caseFromRow);
  return AiMetricsBenchmarkCaseListResult.make({ cases });
}).pipe(Effect.withSpan("AiMetrics.listAiMetricsBenchmarkCases"));

/**
 * Record an observed benchmark run for one config snapshot.
 *
 * **Example** (Recording benchmark run)
 *
 * ```ts
 * import { AiMetricsBenchmarkRunInput, recordAiMetricsBenchmarkRun } from "@beep/repo-ai-metrics"
 * const program = recordAiMetricsBenchmarkRun(
 *   AiMetricsBenchmarkRunInput.make({
 *     benchmarkCaseId: "case-1",
 *     configSnapshotId: "config-1",
 *     elapsedMs: 42_000,
 *     passed: true,
 *     qualityGate: "passed"
 *   })
 * )
 * console.log(program)
 * ```
 *
 * @effects Ensures scorecard tables exist, verifies the benchmark case exists, and upserts one DuckDB run row.
 * @category services
 * @since 0.0.0
 */
export const recordAiMetricsBenchmarkRun: (
  input: AiMetricsBenchmarkRunInput
) => Effect.Effect<BenchmarkRun, AiMetricsScorecardError, DuckDb> = Effect.fn("AiMetrics.recordAiMetricsBenchmarkRun")(
  function* (input) {
    yield* ensureScorecardStorage;
    yield* ensureBenchmarkCaseExists(input.benchmarkCaseId);

    const recordedAtEpochMillis = input.recordedAtEpochMillis ?? (yield* Clock.currentTimeMillis);
    const note = noteOrNull(input.note);
    const run = BenchmarkRun.make({
      benchmarkCaseId: input.benchmarkCaseId,
      benchmarkRunId: yield* rowId("benchmark-run", [
        input.benchmarkCaseId,
        input.configSnapshotId,
        recordedAtEpochMillis,
      ]),
      configSnapshotId: input.configSnapshotId,
      elapsedMs: input.elapsedMs,
      passed: input.passed,
      qualityGate: input.qualityGate,
      recordedAtEpochMillis,
      note: O.map(input.note, redactAiMetricsSensitiveText),
    });
    const duckdb = yield* DuckDb;
    yield* duckdb
      .run(
        `INSERT OR REPLACE INTO ai_metrics_benchmark_runs (
          benchmark_run_id,
          benchmark_case_id,
          config_snapshot_id,
          elapsed_ms,
          passed,
          quality_gate,
          note,
          recorded_at_epoch_ms
        ) VALUES (
          $benchmarkRunId,
          $benchmarkCaseId,
          $configSnapshotId,
          $elapsedMs,
          $passed,
          $qualityGate,
          $note,
          $recordedAtEpochMillis
        )`,
        {
          benchmarkCaseId: run.benchmarkCaseId,
          benchmarkRunId: run.benchmarkRunId,
          configSnapshotId: run.configSnapshotId,
          elapsedMs: run.elapsedMs,
          note,
          passed: run.passed,
          qualityGate: run.qualityGate,
          recordedAtEpochMillis: epochMillisParam(run.recordedAtEpochMillis),
        }
      )
      .pipe(Effect.mapError((cause) => scorecardFailure("Failed to write AI metrics benchmark run.", cause)));

    return run;
  }
);

const readTaskAggregates = Effect.fn("AiMetrics.scorecard.readTaskAggregates")(function* (
  input: AiMetricsWeeklyReportInput
) {
  const duckdb = yield* DuckDb;
  const rows = yield* duckdb
    .query(
      `SELECT
         t.config_snapshot_id AS "configSnapshotId",
         count(DISTINCT t.agent_task_id)::INTEGER AS "taskCount",
         count(DISTINCT labels.label_id)::INTEGER AS "labelCount",
         COALESCE(avg(CASE WHEN labels.passed THEN 1.0 ELSE 0.0 END), 0.5)::DOUBLE AS "passRate",
         COALESCE(avg(labels.rating), 3.0)::DOUBLE AS "averageRating",
         COALESCE(avg(
           CASE labels.quality_gate
             WHEN 'passed' THEN 1.0
             WHEN 'failed' THEN 0.0
             ELSE 0.5
           END
         ), 0.5)::DOUBLE AS "averageQualityGateScore",
         COALESCE(avg(labels.intervention_count), 0.0)::DOUBLE AS "averageInterventionCount",
         count(CASE WHEN labels.follow_up_fix THEN 1 END)::INTEGER AS "followUpFixCount"
       FROM ai_metrics_agent_tasks t
       LEFT JOIN ai_metrics_outcome_labels labels ON labels.agent_task_id = t.agent_task_id
       WHERE t.created_at_epoch_ms >= $windowStartEpochMillis
         AND t.created_at_epoch_ms < $windowEndEpochMillis
       GROUP BY t.config_snapshot_id
       ORDER BY t.config_snapshot_id`,
      {
        windowEndEpochMillis: epochMillisParam(input.windowEndEpochMillis),
        windowStartEpochMillis: epochMillisParam(input.windowStartEpochMillis),
      }
    )
    .pipe(Effect.mapError((cause) => scorecardFailure("Failed to read AI metrics task aggregates.", cause)));

  return yield* TaskAggregateRow.decodeRowsEffect(rows).pipe(
    Effect.mapError((cause) => scorecardFailure("Failed to decode AI metrics task aggregates.", cause))
  );
});

const readBenchmarkAggregates = Effect.fn("AiMetrics.scorecard.readBenchmarkAggregates")(function* (
  input: AiMetricsWeeklyReportInput
) {
  const duckdb = yield* DuckDb;
  const rows = yield* duckdb
    .query(
      `SELECT
         config_snapshot_id AS "configSnapshotId",
         count(*)::INTEGER AS "benchmarkRunCount",
         COALESCE(avg(CASE WHEN passed THEN 1.0 ELSE 0.0 END), 0.5)::DOUBLE AS "benchmarkPassRate",
         COALESCE(avg(
           CASE quality_gate
             WHEN 'passed' THEN 1.0
             WHEN 'failed' THEN 0.0
             ELSE 0.5
           END
         ), 0.5)::DOUBLE AS "benchmarkQualityGateScore"
       FROM ai_metrics_benchmark_runs
       WHERE recorded_at_epoch_ms >= $windowStartEpochMillis
         AND recorded_at_epoch_ms < $windowEndEpochMillis
       GROUP BY config_snapshot_id
       ORDER BY config_snapshot_id`,
      {
        windowEndEpochMillis: epochMillisParam(input.windowEndEpochMillis),
        windowStartEpochMillis: epochMillisParam(input.windowStartEpochMillis),
      }
    )
    .pipe(Effect.mapError((cause) => scorecardFailure("Failed to read AI metrics benchmark aggregates.", cause)));

  return yield* BenchmarkAggregateRow.decodeRowsEffect(rows).pipe(
    Effect.mapError((cause) => scorecardFailure("Failed to decode AI metrics benchmark aggregates.", cause))
  );
});

const readCoverageCounts: Effect.Effect<CoverageCountsRow, AiMetricsScorecardError, DuckDb> = Effect.gen(function* () {
  const duckdb = yield* DuckDb;
  const rows = yield* duckdb
    .query(
      `SELECT
         (SELECT count(*)::INTEGER FROM ai_metrics_model_calls) AS "modelCallCount",
         (SELECT count(*)::INTEGER FROM ai_metrics_tool_invocations) AS "toolInvocationCount"`
    )
    .pipe(Effect.mapError((cause) => scorecardFailure("Failed to read AI metrics coverage counts.", cause)));
  const decoded = yield* CoverageCountsRow.decodeRowsEffect(rows).pipe(
    Effect.mapError((cause) => scorecardFailure("Failed to decode AI metrics coverage counts.", cause))
  );
  const head = A.head(decoded);

  if (O.isSome(head)) {
    return head.value;
  }

  return CoverageCountsRow.make({ modelCallCount: 0, toolInvocationCount: 0 });
}).pipe(Effect.withSpan("AiMetrics.scorecard.readCoverageCounts"));

const byConfigSnapshotId: Order.Order<string> = Order.String;

const taskAggregateFor = (
  configSnapshotId: string,
  rows: ReadonlyArray<TaskAggregateRow>
): O.Option<TaskAggregateRow> => A.findFirst(rows, (row) => row.configSnapshotId === configSnapshotId);

const benchmarkAggregateFor = (
  configSnapshotId: string,
  rows: ReadonlyArray<BenchmarkAggregateRow>
): O.Option<BenchmarkAggregateRow> => A.findFirst(rows, (row) => row.configSnapshotId === configSnapshotId);

const labelsOutcomeScore = (row: TaskAggregateRow): number =>
  boundedUnit(row.passRate * 0.5 + boundedUnit(row.averageRating / 5) * 0.3 + row.averageQualityGateScore * 0.2);

const benchmarkOutcomeScore = (row: BenchmarkAggregateRow): number =>
  boundedUnit(row.benchmarkPassRate * 0.7 + row.benchmarkQualityGateScore * 0.3);

const combinedOutcomeScore = (task: O.Option<TaskAggregateRow>, benchmark: O.Option<BenchmarkAggregateRow>): number => {
  const parts = A.getSomes([
    pipe(
      task,
      O.flatMap((row) => (row.labelCount > 0 ? O.some(labelsOutcomeScore(row)) : O.none<number>()))
    ),
    pipe(
      benchmark,
      O.flatMap((row) => (row.benchmarkRunCount > 0 ? O.some(benchmarkOutcomeScore(row)) : O.none<number>()))
    ),
  ] as const);
  if (A.isReadonlyArrayNonEmpty(parts)) {
    return (
      pipe(
        parts,
        A.reduce(0, (left, right) => left + right)
      ) / A.length(parts)
    );
  }

  return 0.5;
};

const flowScore: (task: O.Option<TaskAggregateRow>) => number = flow(
  O.map((row) => {
    if (row.labelCount === 0) {
      return 0.5;
    }
    const interventionScore = boundedUnit(1 - row.averageInterventionCount / 5);
    const followUpScore = boundedUnit(1 - row.followUpFixCount / row.labelCount);
    return boundedUnit(interventionScore * 0.7 + followUpScore * 0.3);
  }),
  O.getOrElse(() => 0.5)
);

const countFromTask = (task: O.Option<TaskAggregateRow>, field: "taskCount" | "labelCount"): number =>
  pipe(
    task,
    O.map((row) => row[field]),
    O.getOrElse(() => 0)
  );

const benchmarkCount: (benchmark: O.Option<BenchmarkAggregateRow>) => number = flow(
  O.map((row) => row.benchmarkRunCount),
  O.getOrElse(() => 0)
);

const coverageGapsFor = ({
  benchmarkRunCount,
  coverage,
  labelCount,
  taskCount,
}: {
  readonly benchmarkRunCount: number;
  readonly coverage: CoverageCountsRow;
  readonly labelCount: number;
  readonly taskCount: number;
}): ReadonlyArray<AiMetricsCoverageGap> =>
  pipe(
    [
      taskCount === 0 ? O.some(AiMetricsCoverageGap.Enum.no_tasks) : O.none<AiMetricsCoverageGap>(),
      labelCount === 0 ? O.some(AiMetricsCoverageGap.Enum.no_labels) : O.none<AiMetricsCoverageGap>(),
      benchmarkRunCount === 0 ? O.some(AiMetricsCoverageGap.Enum.no_benchmark_runs) : O.none<AiMetricsCoverageGap>(),
      labelCount === 0 || benchmarkRunCount === 0
        ? O.some(AiMetricsCoverageGap.Enum.scorecard_completion_credit_blocked)
        : O.none<AiMetricsCoverageGap>(),
      coverage.modelCallCount === 0
        ? O.some(AiMetricsCoverageGap.Enum.model_call_metrics_unavailable_not_scored)
        : O.none<AiMetricsCoverageGap>(),
      coverage.toolInvocationCount === 0
        ? O.some(AiMetricsCoverageGap.Enum.tool_invocation_metrics_unavailable_not_scored)
        : O.none<AiMetricsCoverageGap>(),
      O.some(AiMetricsCoverageGap.Enum.cost_metrics_unavailable_not_scored),
    ],
    A.getSomes
  );

const scorecardCompletionReady = ({
  benchmarkRunCount,
  labelCount,
  taskCount,
}: {
  readonly benchmarkRunCount: number;
  readonly labelCount: number;
  readonly taskCount: number;
}): boolean => taskCount > 0 && labelCount > 0 && benchmarkRunCount > 0;

const scorecardFor = Effect.fn("AiMetrics.scorecard.scorecardFor")(function* ({
  benchmark,
  configSnapshotId,
  coverage,
  task,
  windowEndEpochMillis,
  windowStartEpochMillis,
}: {
  readonly benchmark: O.Option<BenchmarkAggregateRow>;
  readonly configSnapshotId: string;
  readonly coverage: CoverageCountsRow;
  readonly task: O.Option<TaskAggregateRow>;
  readonly windowEndEpochMillis: number;
  readonly windowStartEpochMillis: number;
}) {
  const weights = AiMetricsScoreWeights.make({});
  const outcomeScore = combinedOutcomeScore(task, benchmark);
  const nextFlowScore = flowScore(task);
  const costScore = 0.5;
  const taskCount = countFromTask(task, "taskCount");
  const labelCount = countFromTask(task, "labelCount");
  const benchmarkRunCount = benchmarkCount(benchmark);
  const coverageGaps = coverageGapsFor({ benchmarkRunCount, coverage, labelCount, taskCount });
  const completionReady = scorecardCompletionReady({ benchmarkRunCount, labelCount, taskCount });

  return Scorecard.make({
    benchmarkRunCount,
    completionReady,
    configSnapshotId,
    costScore,
    coverageGaps,
    flowScore: nextFlowScore,
    labelCount,
    outcomeScore,
    scorecardId: yield* rowId("scorecard", [configSnapshotId, windowStartEpochMillis, windowEndEpochMillis]),
    taskCount,
    totalScore: boundedUnit(outcomeScore * weights.outcome + nextFlowScore * weights.flow + costScore * weights.cost),
    weights,
    windowEndEpochMillis,
    windowStartEpochMillis,
  });
});

const writeScorecard = Effect.fn("AiMetrics.scorecard.writeScorecard")(function* (scorecard: Scorecard) {
  const duckdb = yield* DuckDb;
  yield* duckdb
    .run(
      `INSERT OR REPLACE INTO ai_metrics_scorecards (
        scorecard_id,
        config_snapshot_id,
        window_start_epoch_ms,
        window_end_epoch_ms,
        total_score,
        outcome_score,
        flow_score,
        cost_score,
        task_count,
        label_count,
        benchmark_run_count,
        completion_ready,
        coverage_gaps_json
      ) VALUES (
        $scorecardId,
        $configSnapshotId,
        $windowStartEpochMillis,
        $windowEndEpochMillis,
        $totalScore,
        $outcomeScore,
        $flowScore,
        $costScore,
        $taskCount,
        $labelCount,
        $benchmarkRunCount,
        $completionReady,
        $coverageGapsJson
      )`,
      {
        benchmarkRunCount: scorecard.benchmarkRunCount,
        completionReady: scorecard.completionReady,
        configSnapshotId: scorecard.configSnapshotId,
        costScore: scorecard.costScore,
        coverageGapsJson: yield* jsonString(scorecard.coverageGaps),
        flowScore: scorecard.flowScore,
        labelCount: scorecard.labelCount,
        outcomeScore: scorecard.outcomeScore,
        scorecardId: scorecard.scorecardId,
        taskCount: scorecard.taskCount,
        totalScore: scorecard.totalScore,
        windowEndEpochMillis: epochMillisParam(scorecard.windowEndEpochMillis),
        windowStartEpochMillis: epochMillisParam(scorecard.windowStartEpochMillis),
      }
    )
    .pipe(Effect.mapError((cause) => scorecardFailure("Failed to persist AI metrics scorecard row.", cause)));
});

const renderMarkdownReport = (document: AiMetricsWeeklyReportDocument): string => {
  const rows = pipe(
    document.scores,
    A.map(
      ({ scorecard }) =>
        `| ${scorecard.configSnapshotId} | ${scorecard.totalScore.toFixed(3)} | ${scorecard.outcomeScore.toFixed(
          3
        )} | ${scorecard.flowScore.toFixed(3)} | ${scorecard.costScore.toFixed(3)} | ${scorecard.taskCount} | ${
          scorecard.labelCount
        } | ${scorecard.benchmarkRunCount} | ${scorecard.completionReady ? "yes" : "no"} | ${
          pipe(scorecard.coverageGaps, A.join(", ")) || "none"
        } |`
    ),
    A.join("\n")
  );
  const coverage = pipe(document.coverageGaps, A.join(", "));

  return pipe(
    [
      "# AI Metrics Weekly Config-Impact Report",
      "",
      `target: ${document.target}`,
      `windowStartEpochMillis: ${document.windowStartEpochMillis}`,
      `windowEndEpochMillis: ${document.windowEndEpochMillis}`,
      `generatedAtEpochMillis: ${document.generatedAtEpochMillis}`,
      `coverageGaps: ${Str.isNonEmpty(coverage) ? coverage : "none"}`,
      "",
      "| configSnapshotId | total | outcome | flow | cost | tasks | labels | benchmarks | completionReady | gaps |",
      "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |",
      Str.isNonEmpty(rows) ? rows : "| none | 0.000 | 0.000 | 0.000 | 0.000 | 0 | 0 | 0 | no | no_data |",
      "",
    ],
    A.join("\n")
  );
};

const artifactBaseName = (input: AiMetricsWeeklyReportInput): string =>
  `weekly-${input.windowStartEpochMillis}-${input.windowEndEpochMillis}`;

const writeWeeklyArtifacts = Effect.fn("AiMetrics.scorecard.writeWeeklyArtifacts")(function* ({
  document,
  input,
}: {
  readonly document: AiMetricsWeeklyReportDocument;
  readonly input: AiMetricsWeeklyReportInput;
}) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const baseName = artifactBaseName(input);
  const markdownPath = path.join(input.reportDir, `${baseName}.md`);
  const jsonPath = path.join(input.reportDir, `${baseName}.json`);
  yield* fs
    .makeDirectory(input.reportDir, { recursive: true })
    .pipe(Effect.mapError((cause) => scorecardFailure("Failed to create AI metrics weekly report directory.", cause)));
  yield* fs
    .writeFileString(markdownPath, renderMarkdownReport(document))
    .pipe(Effect.mapError((cause) => scorecardFailure("Failed to write AI metrics weekly Markdown report.", cause)));
  yield* fs
    .writeFileString(jsonPath, yield* jsonString(document))
    .pipe(Effect.mapError((cause) => scorecardFailure("Failed to write AI metrics weekly JSON report.", cause)));
  return { jsonPath, markdownPath };
});

/**
 * Generate and persist a weekly config-impact report.
 *
 * **Example** (Generating weekly report)
 *
 * ```ts
 * import { AiMetricsWeeklyReportInput, generateAiMetricsWeeklyReport } from "@beep/repo-ai-metrics"
 * const program = generateAiMetricsWeeklyReport(
 *   AiMetricsWeeklyReportInput.make({
 *     reportDir: ".beep/ai-metrics/reports",
 *     target: "local",
 *     windowEndEpochMillis: 1_717_604_800_000,
 *     windowStartEpochMillis: 1_717_000_000_000
 *   })
 * )
 * console.log(program)
 * ```
 *
 * @effects
 * - Ensures scorecard tables exist and reads DuckDB task, label, benchmark, and coverage aggregates.
 * - Upserts weekly scorecard rows.
 * - Creates the report directory and writes Markdown plus JSON report artifacts.
 * @category services
 * @since 0.0.0
 */
export const generateAiMetricsWeeklyReport: (
  input: AiMetricsWeeklyReportInput
) => Effect.Effect<AiMetricsWeeklyReportResult, AiMetricsScorecardError, DuckDb | FileSystem.FileSystem | Path.Path> =
  Effect.fn("AiMetrics.generateAiMetricsWeeklyReport")(
    function* (input) {
      yield* ensureScorecardStorage;
      const taskAggregates = yield* readTaskAggregates(input);
      const benchmarkAggregates = yield* readBenchmarkAggregates(input);
      const coverage = yield* readCoverageCounts;
      const configSnapshotIds = pipe(
        A.appendAll(
          A.map(taskAggregates, (row) => row.configSnapshotId),
          A.map(benchmarkAggregates, (row) => row.configSnapshotId)
        ),
        A.dedupe,
        A.sort(byConfigSnapshotId)
      );
      const scorecards = yield* Effect.forEach(
        configSnapshotIds,
        (configSnapshotId) =>
          scorecardFor({
            benchmark: benchmarkAggregateFor(configSnapshotId, benchmarkAggregates),
            configSnapshotId,
            coverage,
            task: taskAggregateFor(configSnapshotId, taskAggregates),
            windowEndEpochMillis: input.windowEndEpochMillis,
            windowStartEpochMillis: input.windowStartEpochMillis,
          }),
        { concurrency: 8 }
      );
      yield* Effect.forEach(scorecards, writeScorecard, { discard: true, concurrency: 8 });
      const coverageGaps = pipe(
        A.flatMap(scorecards, (scorecard) => scorecard.coverageGaps),
        A.appendAll(
          A.isReadonlyArrayNonEmpty(scorecards) ? A.empty<AiMetricsCoverageGap>() : AiMetricsCoverageGap.Options
        ),
        A.dedupe,
        A.sort(Order.String)
      );
      const document = AiMetricsWeeklyReportDocument.make({
        coverageGaps,
        generatedAtEpochMillis: yield* Clock.currentTimeMillis,
        scores: A.map(scorecards, (scorecard) => AiMetricsWeeklyConfigScore.make({ scorecard })),
        target: input.target,
        windowEndEpochMillis: input.windowEndEpochMillis,
        windowStartEpochMillis: input.windowStartEpochMillis,
      });
      const paths = yield* writeWeeklyArtifacts({ document, input });
      return AiMetricsWeeklyReportResult.make({
        document,
        jsonPath: paths.jsonPath,
        markdownPath: paths.markdownPath,
      });
    },
    (effect, input) =>
      effect.pipe(
        Effect.withSpan("repo_ai_metrics.report.weekly", {
          attributes: {
            "ai_metrics.target": input.target,
            "ai_metrics.window_end_epoch_ms": input.windowEndEpochMillis,
            "ai_metrics.window_start_epoch_ms": input.windowStartEpochMillis,
          },
        })
      )
  );

/**
 * Render a label queue result as JSON.
 *
 * **Example** (Encoding label queue JSON)
 *
 * ```ts
 * import { AiMetricsLabelQueueResult, aiMetricsLabelQueueToJson } from "@beep/repo-ai-metrics"
 * import { Effect } from "effect"
 * const json = Effect.runPromise(
 *   aiMetricsLabelQueueToJson(
 *     AiMetricsLabelQueueResult.make({
 *       items: [],
 *       target: "local",
 *       windowEndEpochMillis: 1_717_604_800_000,
 *       windowStartEpochMillis: 1_717_000_000_000
 *     })
 *   )
 * )
 * console.log(json)
 * ```
 *
 * @effects Performs schema JSON encoding only; fails with `AiMetricsScorecardError` if the label cannot be encoded.
 * @category utilities
 * @since 0.0.0
 */
export const aiMetricsLabelQueueToJson: (
  result: AiMetricsLabelQueueResult
) => Effect.Effect<string, AiMetricsScorecardError> = Effect.fn("AiMetrics.aiMetricsLabelQueueToJson")(
  function* (result) {
    return yield* AiMetricsLabelQueueResult.encodeJsonEffect(result).pipe(
      Effect.mapError((cause) => scorecardFailure("Failed to encode AI metrics label queue JSON.", cause))
    );
  }
);

/**
 * Render an outcome label as JSON.
 *
 * **Example** (Encoding outcome label JSON)
 *
 * ```ts
 * import { OutcomeLabel, aiMetricsOutcomeLabelToJson } from "@beep/repo-ai-metrics"
 * import { Effect } from "effect"
 * const json = Effect.runPromise(
 *   aiMetricsOutcomeLabelToJson(
 *     OutcomeLabel.make({
 *       agentTaskId: "task-1",
 *       followUpFix: false,
 *       interventionCount: 1,
 *       labelId: "label-1",
 *       labeledAtEpochMillis: 1_717_000_000_000,
 *       passed: true,
 *       qualityGate: "passed",
 *       rating: 5
 *     })
 *   )
 * )
 * console.log(json)
 * ```
 *
 * @effects Performs schema JSON encoding only; fails with `AiMetricsScorecardError` if the label cannot be encoded.
 * @category utilities
 * @since 0.0.0
 */
export const aiMetricsOutcomeLabelToJson: (result: OutcomeLabel) => Effect.Effect<string, AiMetricsScorecardError> =
  Effect.fn("AiMetrics.aiMetricsOutcomeLabelToJson")(function* (result) {
    return yield* OutcomeLabel.encodeJsonEffect(result).pipe(
      Effect.mapError((cause) => scorecardFailure("Failed to encode AI metrics outcome label JSON.", cause))
    );
  });

/**
 * Render a benchmark case as JSON.
 *
 * **Example** (Encoding benchmark case JSON)
 *
 * ```ts
 * import { BenchmarkCase, aiMetricsBenchmarkCaseToJson } from "@beep/repo-ai-metrics"
 * import { Effect } from "effect"
 * const json = Effect.runPromise(
 *   aiMetricsBenchmarkCaseToJson(
 *     BenchmarkCase.make({
 *       benchmarkCaseId: "case-1",
 *       expectedChecks: ["bun run check"],
 *       promptHash: "prompt-hash",
 *       title: "Package JSDoc repair"
 *     })
 *   )
 * )
 * console.log(json)
 * ```
 *
 * @effects Performs schema JSON encoding only; fails with `AiMetricsScorecardError` if the case cannot be encoded.
 * @category utilities
 * @since 0.0.0
 */
export const aiMetricsBenchmarkCaseToJson: (result: BenchmarkCase) => Effect.Effect<string, AiMetricsScorecardError> =
  Effect.fn("AiMetrics.aiMetricsBenchmarkCaseToJson")(function* (result) {
    return yield* BenchmarkCase.encodeJsonEffect(result).pipe(
      Effect.mapError((cause) => scorecardFailure("Failed to encode AI metrics benchmark case JSON.", cause))
    );
  });

/**
 * Render benchmark cases as JSON.
 *
 * **Example** (Encoding case list JSON)
 *
 * ```ts
 * import {
 *   AiMetricsBenchmarkCaseListResult,
 *   BenchmarkCase,
 *   aiMetricsBenchmarkCaseListToJson
 * } from "@beep/repo-ai-metrics"
 * import { Effect } from "effect"
 *
 * const json = Effect.runPromise(
 *   aiMetricsBenchmarkCaseListToJson(
 *     AiMetricsBenchmarkCaseListResult.make({
 *       cases: [
 *         BenchmarkCase.make({
 *           benchmarkCaseId: "case-1",
 *           expectedChecks: ["bun run check"],
 *           promptHash: "prompt-hash",
 *           title: "Package JSDoc repair"
 *         })
 *       ]
 *     })
 *   )
 * )
 * console.log(json)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const aiMetricsBenchmarkCaseListToJson: (
  result: AiMetricsBenchmarkCaseListResult
) => Effect.Effect<string, AiMetricsScorecardError> = Effect.fn("AiMetrics.aiMetricsBenchmarkCaseListToJson")(
  function* (result) {
    return yield* AiMetricsBenchmarkCaseListResult.encodeJsonEffect(result).pipe(
      Effect.mapError((cause) => scorecardFailure("Failed to encode AI metrics benchmark case list JSON.", cause))
    );
  }
);

/**
 * Render a benchmark run as JSON.
 *
 * **Example** (Encoding benchmark run JSON)
 *
 * ```ts
 * import { BenchmarkRun, aiMetricsBenchmarkRunToJson } from "@beep/repo-ai-metrics"
 * import { Effect } from "effect"
 * const json = Effect.runPromise(
 *   aiMetricsBenchmarkRunToJson(
 *     BenchmarkRun.make({
 *       benchmarkCaseId: "case-1",
 *       benchmarkRunId: "run-1",
 *       configSnapshotId: "config-1",
 *       elapsedMs: 42_000,
 *       passed: true,
 *       qualityGate: "passed",
 *       recordedAtEpochMillis: 1_717_000_000_000
 *     })
 *   )
 * )
 * console.log(json)
 * ```
 *
 * @effects Performs schema JSON encoding only; fails with `AiMetricsScorecardError` if the run cannot be encoded.
 * @category utilities
 * @since 0.0.0
 */
export const aiMetricsBenchmarkRunToJson: (result: BenchmarkRun) => Effect.Effect<string, AiMetricsScorecardError> =
  Effect.fn("AiMetrics.aiMetricsBenchmarkRunToJson")(function* (result) {
    return yield* BenchmarkRun.encodeJsonEffect(result).pipe(
      Effect.mapError((cause) => scorecardFailure("Failed to encode AI metrics benchmark run JSON.", cause))
    );
  });

/**
 * Render a weekly report result as JSON.
 *
 * **Example** (Encoding weekly report JSON)
 *
 * ```ts
 * import {
 *   AiMetricsWeeklyReportDocument,
 *   AiMetricsWeeklyReportResult,
 *   aiMetricsWeeklyReportToJson
 * } from "@beep/repo-ai-metrics"
 * import { Effect } from "effect"
 *
 * const json = Effect.runPromise(
 *   aiMetricsWeeklyReportToJson(
 *     AiMetricsWeeklyReportResult.make({
 *       document: AiMetricsWeeklyReportDocument.make({
 *         coverageGaps: [],
 *         generatedAtEpochMillis: 1_717_604_800_000,
 *         scores: [],
 *         target: "local",
 *         windowEndEpochMillis: 1_717_604_800_000,
 *         windowStartEpochMillis: 1_717_000_000_000
 *       }),
 *       jsonPath: ".beep/ai-metrics/reports/weekly.json",
 *       markdownPath: ".beep/ai-metrics/reports/weekly.md"
 *     })
 *   )
 * )
 * console.log(json)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const aiMetricsWeeklyReportToJson: (
  result: AiMetricsWeeklyReportResult
) => Effect.Effect<string, AiMetricsScorecardError> = Effect.fn("AiMetrics.aiMetricsWeeklyReportToJson")(
  function* (result) {
    return yield* AiMetricsWeeklyReportResult.encodeJsonEffect(result).pipe(
      Effect.mapError((cause) => scorecardFailure("Failed to encode AI metrics weekly report JSON.", cause))
    );
  }
);
