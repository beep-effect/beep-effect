/**
 * Agent-effectiveness doctor and annotation-plan helpers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { DuckDb } from "@beep/duckdb";
import { $RepoAiMetricsId } from "@beep/identity/packages";
import {
  Phoenix,
  PhoenixAnnotationInput,
  PhoenixAnnotationTargetKind,
  PhoenixDatasetAppendInput,
  PhoenixDatasetCreateInput,
  PhoenixDatasetExample,
  PhoenixDatasetSelector,
  PhoenixExperimentCreateInput,
  PhoenixPromptChatMessage,
  PhoenixPromptCreateInput,
} from "@beep/phoenix";
import { LiteralKit, SchemaUtils, TaggedErrorClass, UnknownRecord } from "@beep/schema";
import { A, O, P, Str } from "@beep/utils";
import { DateTime, Effect, FileSystem, flow, Match, Path, pipe } from "effect";
import { dual } from "effect/Function";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as HttpClient from "effect/unstable/http/HttpClient";
import * as HttpClientRequest from "effect/unstable/http/HttpClientRequest";
import * as HttpClientResponse from "effect/unstable/http/HttpClientResponse";
import { AiMetricsDeployTarget } from "./models.ts";
import type {
  PhoenixAnnotationTargetKind as PhoenixAnnotationTargetKindType,
  PhoenixError,
  PhoenixShape,
} from "@beep/phoenix";

const $I = $RepoAiMetricsId.create("agent-effectiveness");

const defaultPhoenixBaseUrl = "https://dankserver.tailc7c348.ts.net:8447";
const defaultDataRoot = ".beep/ai-metrics";
/**
 * Stable default pointer used to locate the latest checked-in JSDoc worker-eval evidence.
 *
 * @example
 * ```ts
 * import { DEFAULT_AGENT_EFFECTIVENESS_WORKER_EVAL_REPORT_PATH } from "@beep/repo-ai-metrics"
 *
 * const reportPath = DEFAULT_AGENT_EFFECTIVENESS_WORKER_EVAL_REPORT_PATH
 * console.log(reportPath.endsWith("/ops/manifest.json"))
 * ```
 * @category constants
 * @since 0.0.0
 */
export const DEFAULT_AGENT_EFFECTIVENESS_WORKER_EVAL_REPORT_PATH = "goals/jsdoc-worker-eval/ops/manifest.json";
const defaultAnnotationLimit = 50;

const phoenixInventoryQuery = `
query AgentEffectivenessPhoenixInventory {
  serverStatus { insufficientStorage }
  projectCount
  datasetCount
  promptCount
  evaluatorCount
  projects(first: 20) {
    edges {
      node {
        name
        hasTraces
        recordCount
        traceCount
        traceAnnotationsNames
        spanAnnotationNames
        sessionAnnotationNames
      }
    }
  }
}
`;

/**
 * Status emitted by agent-effectiveness reports.
 *
 * @example
 * ```ts
 * import { AgentEffectivenessStatus } from "@beep/repo-ai-metrics"
 *
 * console.log(AgentEffectivenessStatus.is.passed("passed"))
 * ```
 * @category models
 * @since 0.0.0
 */
export const AgentEffectivenessStatus = LiteralKit(["passed", "warning", "failed", "unavailable"]).pipe(
  $I.annoteSchema("AgentEffectivenessStatus", {
    description: "Non-blocking status used by agent-effectiveness trust-gate reports.",
  })
);

/**
 * Runtime type for `AgentEffectivenessStatus`.
 *
 * @example
 * ```ts
 * import { AgentEffectivenessStatus } from "@beep/repo-ai-metrics"
 *
 * const status: AgentEffectivenessStatus = "passed"
 * console.log(AgentEffectivenessStatus.is.passed(status))
 * ```
 * @category models
 * @since 0.0.0
 */
export type AgentEffectivenessStatus = typeof AgentEffectivenessStatus.Type;

/**
 * Primitive annotation value allowed in local Phase 1 plans.
 *
 * @example
 * ```ts
 * import { AgentEffectivenessAnnotationValue } from "@beep/repo-ai-metrics"
 *
 * console.log(AgentEffectivenessAnnotationValue.is(0.98))
 * ```
 * @category models
 * @since 0.0.0
 */
export const AgentEffectivenessAnnotationValue = S.Union([S.String, S.Finite, S.Boolean]).pipe(
  $I.annoteSchema("AgentEffectivenessAnnotationValue", {
    description: "Sanitized primitive value allowed in an agent-effectiveness annotation plan.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime type for `AgentEffectivenessAnnotationValue`.
 *
 * @example
 * ```ts
 * import { AgentEffectivenessAnnotationValue } from "@beep/repo-ai-metrics"
 *
 * const value: AgentEffectivenessAnnotationValue = 0.98
 * console.log(AgentEffectivenessAnnotationValue.is(value))
 * ```
 * @category models
 * @since 0.0.0
 */
export type AgentEffectivenessAnnotationValue = typeof AgentEffectivenessAnnotationValue.Type;

/**
 * Error raised by agent-effectiveness report helpers.
 *
 * @example
 * ```ts
 * import { AgentEffectivenessError } from "@beep/repo-ai-metrics"
 *
 * const error = AgentEffectivenessError.make({
 *   cause: "decode failed",
 *   message: "Failed to encode agent-effectiveness evidence."
 * })
 * console.log(error._tag)
 * ```
 * @category errors
 * @since 0.0.0
 */
export class AgentEffectivenessError extends TaggedErrorClass<AgentEffectivenessError>($I`AgentEffectivenessError`)(
  "AgentEffectivenessError",
  {
    cause: S.Defect({ includeStack: true }),
    message: S.String,
  },
  $I.annote("AgentEffectivenessError", {
    description: "Typed failure raised while encoding or decoding agent-effectiveness reports.",
  })
) {}

/**
 * Input for the Phase 1 agent-effectiveness doctor.
 *
 * @example
 * ```ts
 * import { AgentEffectivenessDoctorInput } from "@beep/repo-ai-metrics"
 * console.log(AgentEffectivenessDoctorInput.make({}).target)
 * ```
 * @category models
 * @since 0.0.0
 */
export class AgentEffectivenessDoctorInput extends S.Class<AgentEffectivenessDoctorInput>(
  $I`AgentEffectivenessDoctorInput`
)(
  {
    dataRoot: S.String.pipe(
      S.withConstructorDefault(Effect.succeed(defaultDataRoot)),
      S.withDecodingDefaultKey(Effect.succeed(defaultDataRoot))
    ),
    noPhoenix: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(false)),
      S.withDecodingDefaultKey(Effect.succeed(false))
    ),
    phoenixBaseUrl: S.String.pipe(
      S.withConstructorDefault(Effect.succeed(defaultPhoenixBaseUrl)),
      S.withDecodingDefaultKey(Effect.succeed(defaultPhoenixBaseUrl))
    ),
    target: AiMetricsDeployTarget.pipe(
      S.withConstructorDefault(Effect.succeed(AiMetricsDeployTarget.Enum.dankserver)),
      S.withDecodingDefaultKey(Effect.succeed(AiMetricsDeployTarget.Enum.dankserver))
    ),
    workerEvalReportPath: S.String.pipe(
      S.withConstructorDefault(Effect.succeed(DEFAULT_AGENT_EFFECTIVENESS_WORKER_EVAL_REPORT_PATH)),
      S.withDecodingDefaultKey(Effect.succeed(DEFAULT_AGENT_EFFECTIVENESS_WORKER_EVAL_REPORT_PATH))
    ),
  },
  $I.annote("AgentEffectivenessDoctorInput", {
    description: "Local, no-mutation inputs used to build the agent-effectiveness doctor report.",
  })
) {}

/**
 * Input for building a dry-run annotation plan.
 *
 * @example
 * ```ts
 * import { AgentEffectivenessAnnotationPlanInput } from "@beep/repo-ai-metrics"
 * console.log(AgentEffectivenessAnnotationPlanInput.make({}).annotationLimit)
 * ```
 * @category models
 * @since 0.0.0
 */
export class AgentEffectivenessAnnotationPlanInput extends S.Class<AgentEffectivenessAnnotationPlanInput>(
  $I`AgentEffectivenessAnnotationPlanInput`
)(
  {
    annotationLimit: S.Finite.pipe(
      S.withConstructorDefault(Effect.succeed(defaultAnnotationLimit)),
      S.withDecodingDefaultKey(Effect.succeed(defaultAnnotationLimit))
    ),
    doctor: AgentEffectivenessDoctorInput.pipe(
      S.withConstructorDefault(Effect.succeed(AgentEffectivenessDoctorInput.make({}))),
      S.withDecodingDefaultKey(Effect.succeed(AgentEffectivenessDoctorInput.make({})))
    ),
  },
  $I.annote("AgentEffectivenessAnnotationPlanInput", {
    description: "Input used to render a sanitized, local-only Phoenix annotation plan.",
  })
) {
  static readonly new = (doctor: AgentEffectivenessDoctorInput) =>
    AgentEffectivenessAnnotationPlanInput.make({
      doctor,
    });
}

/**
 * Summary for one Phoenix project.
 *
 * @example
 * ```ts
 * import { AgentEffectivenessPhoenixProject } from "@beep/repo-ai-metrics"
 *
 * const project = AgentEffectivenessPhoenixProject.make({
 *   hasTraces: true,
 *   name: "beep-agent-effectiveness",
 *   recordCount: 12,
 *   spanAnnotationNames: ["scorecard.total_score"],
 *   sessionAnnotationNames: [],
 *   traceAnnotationNames: ["agent.loop.status"],
 *   traceCount: 4
 * })
 * console.log(project.hasTraces)
 * ```
 * @category models
 * @since 0.0.0
 */
export class AgentEffectivenessPhoenixProject extends S.Class<AgentEffectivenessPhoenixProject>(
  $I`AgentEffectivenessPhoenixProject`
)(
  {
    hasTraces: S.Boolean,
    name: S.String,
    recordCount: S.Finite,
    spanAnnotationNames: S.Array(S.String),
    sessionAnnotationNames: S.Array(S.String),
    traceAnnotationNames: S.Array(S.String),
    traceCount: S.Finite,
  },
  $I.annote("AgentEffectivenessPhoenixProject", {
    description: "Sanitized Phoenix project inventory row used by the agent-effectiveness doctor.",
  })
) {}

/**
 * Read-only Phoenix health and inventory section.
 *
 * @example
 * ```ts
 * import { AgentEffectivenessPhoenixSection } from "@beep/repo-ai-metrics"
 *
 * const section = AgentEffectivenessPhoenixSection.make({
 *   baseUrl: "https://phoenix.example.test",
 *   datasetCount: 2,
 *   evaluatorCount: 1,
 *   message: "Phoenix is reachable.",
 *   projectCount: 1,
 *   projects: [],
 *   promptCount: 2,
 *   serverInsufficientStorage: false,
 *   status: "passed",
 *   version: "9.0.0"
 * })
 * console.log(section.status)
 * ```
 * @category models
 * @since 0.0.0
 */
export class AgentEffectivenessPhoenixSection extends S.Class<AgentEffectivenessPhoenixSection>(
  $I`AgentEffectivenessPhoenixSection`
)(
  {
    baseUrl: S.String,
    datasetCount: S.Finite,
    evaluatorCount: S.Finite,
    message: S.String,
    projectCount: S.Finite,
    projects: S.Array(AgentEffectivenessPhoenixProject),
    promptCount: S.Finite,
    serverInsufficientStorage: S.Boolean,
    status: AgentEffectivenessStatus,
    version: S.NullOr(S.String),
  },
  $I.annote("AgentEffectivenessPhoenixSection", {
    description: "Non-mutating Phoenix readiness section for the agent-effectiveness doctor.",
  })
) {}

/**
 * Source coverage row derived from AI-metrics storage.
 *
 * @example
 * ```ts
 * import { AgentEffectivenessSourceCoverage } from "@beep/repo-ai-metrics"
 *
 * const coverage = AgentEffectivenessSourceCoverage.make({
 *   acceptedEvents: 48,
 *   lastTimestamp: "2026-05-20T00:00:00.000Z",
 *   rejectedLines: 2,
 *   sourceFileCount: 3,
 *   sourceKind: "codex",
 *   totalLines: 50
 * })
 * console.log(coverage.acceptedEvents / coverage.totalLines)
 * ```
 * @category models
 * @since 0.0.0
 */
export class AgentEffectivenessSourceCoverage extends S.Class<AgentEffectivenessSourceCoverage>(
  $I`AgentEffectivenessSourceCoverage`
)(
  {
    acceptedEvents: S.Finite,
    lastTimestamp: S.NullOr(S.String),
    rejectedLines: S.Finite,
    sourceFileCount: S.Finite,
    sourceKind: S.String,
    totalLines: S.Finite,
  },
  $I.annote("AgentEffectivenessSourceCoverage", {
    description: "Aggregate source coverage for one transcript source kind.",
  })
) {}

/**
 * Latest forwarder summary from derived AI-metrics storage.
 *
 * @example
 * ```ts
 * import { AgentEffectivenessForwarderSummary } from "@beep/repo-ai-metrics"
 *
 * const summary = AgentEffectivenessForwarderSummary.make({
 *   archiveObjectCount: 4,
 *   completedAtEpochMillis: 1_717_000_000_000,
 *   configSnapshotId: "config-1",
 *   ingestRunId: "ingest-1",
 *   sourceFileCount: 3,
 *   target: "dankserver",
 *   turnCount: 12
 * })
 * console.log(summary.turnCount)
 * ```
 * @category models
 * @since 0.0.0
 */
export class AgentEffectivenessForwarderSummary extends S.Class<AgentEffectivenessForwarderSummary>(
  $I`AgentEffectivenessForwarderSummary`
)(
  {
    archiveObjectCount: S.Finite,
    completedAtEpochMillis: S.Finite,
    configSnapshotId: S.String,
    ingestRunId: S.String,
    sourceFileCount: S.Finite,
    target: AiMetricsDeployTarget,
    turnCount: S.Finite,
  },
  $I.annote("AgentEffectivenessForwarderSummary", {
    description: "Latest deploy-safe forwarder run summary.",
  })
) {}

/**
 * Latest scorecard summary from derived AI-metrics storage.
 *
 * @example
 * ```ts
 * import { AgentEffectivenessScorecardSummary } from "@beep/repo-ai-metrics"
 *
 * const summary = AgentEffectivenessScorecardSummary.make({
 *   benchmarkRunCount: 2,
 *   completionReady: true,
 *   configSnapshotId: "config-1",
 *   coverageGaps: [],
 *   labelCount: 6,
 *   scorecardId: "scorecard-1",
 *   taskCount: 6,
 *   totalScore: 0.91,
 *   windowEndEpochMillis: 1_717_086_400_000,
 *   windowStartEpochMillis: 1_717_000_000_000
 * })
 * console.log(summary.completionReady)
 * ```
 * @category models
 * @since 0.0.0
 */
export class AgentEffectivenessScorecardSummary extends S.Class<AgentEffectivenessScorecardSummary>(
  $I`AgentEffectivenessScorecardSummary`
)(
  {
    benchmarkRunCount: S.Finite,
    completionReady: S.Boolean,
    configSnapshotId: S.String,
    coverageGaps: S.Array(S.String),
    labelCount: S.Finite,
    scorecardId: S.String,
    taskCount: S.Finite,
    totalScore: S.Finite,
    windowEndEpochMillis: S.Finite,
    windowStartEpochMillis: S.Finite,
  },
  $I.annote("AgentEffectivenessScorecardSummary", {
    description: "Latest deploy-safe scorecard summary.",
  })
) {}

/**
 * AI-metrics local evidence section for the doctor report.
 *
 * @example
 * ```ts
 * import { AgentEffectivenessAiMetricsSection } from "@beep/repo-ai-metrics"
 *
 * const section = AgentEffectivenessAiMetricsSection.make({
 *   benchmarkRunCount: 0,
 *   dataRoot: ".beep/ai-metrics",
 *   derivedDuckDbPath: ".beep/ai-metrics/derived/ai-metrics.duckdb",
 *   labelCount: 0,
 *   latestForwarder: null,
 *   latestScorecard: null,
 *   message: "AI-metrics evidence has not been derived yet.",
 *   sourceCoverage: [],
 *   status: "unavailable",
 *   unavailableMetrics: ["provider_model_token_cost"]
 * })
 * console.log(section.unavailableMetrics)
 * ```
 * @category models
 * @since 0.0.0
 */
export class AgentEffectivenessAiMetricsSection extends S.Class<AgentEffectivenessAiMetricsSection>(
  $I`AgentEffectivenessAiMetricsSection`
)(
  {
    benchmarkRunCount: S.Finite,
    dataRoot: S.String,
    derivedDuckDbPath: S.String,
    labelCount: S.Finite,
    latestForwarder: S.NullOr(AgentEffectivenessForwarderSummary),
    latestScorecard: S.NullOr(AgentEffectivenessScorecardSummary),
    message: S.String,
    sourceCoverage: S.Array(AgentEffectivenessSourceCoverage),
    status: AgentEffectivenessStatus,
    unavailableMetrics: S.Array(S.String),
  },
  $I.annote("AgentEffectivenessAiMetricsSection", {
    description: "AI-metrics derived evidence summarized for the agent-effectiveness trust gate.",
  })
) {}

/**
 * JSDoc worker-eval section for the doctor report.
 *
 * @example
 * ```ts
 * import { AgentEffectivenessJsdocWorkerSection } from "@beep/repo-ai-metrics"
 *
 * const section = AgentEffectivenessJsdocWorkerSection.make({
 *   cleanupDeleteStatus: "ok",
 *   cleanupStopStatus: "ok",
 *   completedPackets: 50,
 *   failedPackets: 0,
 *   message: "JSDoc worker-eval completed without policy violations.",
 *   otlpStatus: "exported",
 *   policyViolationCodes: [],
 *   reportPath: "goals/jsdoc-worker-eval/ops/manifest.json",
 *   selectedPackets: 50,
 *   status: "passed",
 *   timedOutPackets: 0
 * })
 * console.log(section.completedPackets === section.selectedPackets)
 * ```
 * @category models
 * @since 0.0.0
 */
export class AgentEffectivenessJsdocWorkerSection extends S.Class<AgentEffectivenessJsdocWorkerSection>(
  $I`AgentEffectivenessJsdocWorkerSection`
)(
  {
    cleanupDeleteStatus: S.NullOr(S.String),
    cleanupStopStatus: S.NullOr(S.String),
    completedPackets: S.Finite,
    failedPackets: S.Finite,
    message: S.String,
    otlpStatus: S.NullOr(S.String),
    policyViolationCodes: S.Array(S.String),
    reportPath: S.String,
    selectedPackets: S.Finite,
    status: AgentEffectivenessStatus,
    timedOutPackets: S.Finite,
  },
  $I.annote("AgentEffectivenessJsdocWorkerSection", {
    description: "Read-only JSDoc worker-eval evidence summarized for the agent-effectiveness doctor.",
  })
) {}

/**
 * Aggregate summary emitted by the doctor report.
 *
 * @example
 * ```ts
 * import { AgentEffectivenessDoctorSummary } from "@beep/repo-ai-metrics"
 *
 * const summary = AgentEffectivenessDoctorSummary.make({
 *   failures: [],
 *   status: "warning",
 *   unavailable: ["phoenix: Phoenix probe disabled by --no-phoenix."],
 *   warnings: []
 * })
 * console.log(summary.unavailable.length)
 * ```
 * @category models
 * @since 0.0.0
 */
export class AgentEffectivenessDoctorSummary extends S.Class<AgentEffectivenessDoctorSummary>(
  $I`AgentEffectivenessDoctorSummary`
)(
  {
    failures: S.Array(S.String),
    status: AgentEffectivenessStatus,
    unavailable: S.Array(S.String),
    warnings: S.Array(S.String),
  },
  $I.annote("AgentEffectivenessDoctorSummary", {
    description: "Human-sized status summary for the agent-effectiveness doctor.",
  })
) {}

/**
 * Phase 1 agent-effectiveness doctor report.
 *
 * @example
 * ```ts
 * import {
 *   AgentEffectivenessAiMetricsSection,
 *   AgentEffectivenessDoctorReport,
 *   AgentEffectivenessDoctorSummary,
 *   AgentEffectivenessJsdocWorkerSection,
 *   AgentEffectivenessPhoenixSection
 * } from "@beep/repo-ai-metrics"
 *
 * const summary = AgentEffectivenessDoctorSummary.make({
 *   failures: [],
 *   status: "passed",
 *   unavailable: [],
 *   warnings: []
 * })
 * const report = AgentEffectivenessDoctorReport.make({
 *   aiMetrics: AgentEffectivenessAiMetricsSection.make({
 *     benchmarkRunCount: 0,
 *     dataRoot: ".beep/ai-metrics",
 *     derivedDuckDbPath: ".beep/ai-metrics/derived/ai-metrics.duckdb",
 *     labelCount: 0,
 *     latestForwarder: null,
 *     latestScorecard: null,
 *     message: "AI-metrics evidence is present.",
 *     sourceCoverage: [],
 *     status: "passed",
 *     unavailableMetrics: []
 *   }),
 *   dataRoot: ".beep/ai-metrics",
 *   generatedAt: "2026-05-20T00:00:00.000Z",
 *   jsdocWorkerEval: AgentEffectivenessJsdocWorkerSection.make({
 *     cleanupDeleteStatus: null,
 *     cleanupStopStatus: null,
 *     completedPackets: 1,
 *     failedPackets: 0,
 *     message: "JSDoc worker-eval completed.",
 *     otlpStatus: null,
 *     policyViolationCodes: [],
 *     reportPath: "goals/jsdoc-worker-eval/ops/manifest.json",
 *     selectedPackets: 1,
 *     status: "passed",
 *     timedOutPackets: 0
 *   }),
 *   phoenix: AgentEffectivenessPhoenixSection.make({
 *     baseUrl: "https://phoenix.example.test",
 *     datasetCount: 0,
 *     evaluatorCount: 0,
 *     message: "Phoenix probe disabled.",
 *     projectCount: 0,
 *     projects: [],
 *     promptCount: 0,
 *     serverInsufficientStorage: false,
 *     status: "passed",
 *     version: null
 *   }),
 *   schemaVersion: "agent-effectiveness-doctor/v1",
 *   summary,
 *   target: "dankserver"
 * })
 * console.log(report.summary.status)
 * ```
 * @category models
 * @since 0.0.0
 */
export class AgentEffectivenessDoctorReport extends S.Class<AgentEffectivenessDoctorReport>(
  $I`AgentEffectivenessDoctorReport`
)(
  {
    aiMetrics: AgentEffectivenessAiMetricsSection,
    dataRoot: S.String,
    generatedAt: S.String,
    jsdocWorkerEval: AgentEffectivenessJsdocWorkerSection,
    phoenix: AgentEffectivenessPhoenixSection,
    schemaVersion: S.String,
    summary: AgentEffectivenessDoctorSummary,
    target: AiMetricsDeployTarget,
  },
  $I.annote("AgentEffectivenessDoctorReport", {
    description: "Report-only trust gate for repo agent-effectiveness evidence.",
  })
) {}

/**
 * One local-only annotation row that could be written to Phoenix later.
 *
 * @example
 * ```ts
 * import { AgentEffectivenessPlannedAnnotation } from "@beep/repo-ai-metrics"
 *
 * const annotation = AgentEffectivenessPlannedAnnotation.make({
 *   annotationId: "ai-metrics:scorecard:scorecard-1:scorecard.total_score",
 *   metadata: { configSnapshotId: "config-1" },
 *   name: "scorecard.total_score",
 *   optimization: "maximize",
 *   source: "ai-metrics",
 *   targetKind: "scorecard",
 *   targetRef: "scorecard-1",
 *   value: 0.91
 * })
 * console.log(annotation.metadata.configSnapshotId)
 * ```
 * @category models
 * @since 0.0.0
 */
export class AgentEffectivenessPlannedAnnotation extends S.Class<AgentEffectivenessPlannedAnnotation>(
  $I`AgentEffectivenessPlannedAnnotation`
)(
  {
    annotationId: S.String,
    metadata: S.Record(S.String, S.String).pipe(
      S.withConstructorDefault(Effect.succeed({})),
      S.withDecodingDefaultKey(Effect.succeed({}))
    ),
    name: S.String,
    optimization: S.String,
    source: S.String,
    targetKind: S.String,
    targetRef: S.String,
    value: AgentEffectivenessAnnotationValue,
  },
  $I.annote("AgentEffectivenessPlannedAnnotation", {
    description: "Sanitized planned annotation row for future Phoenix mutation phases.",
  })
) {}

/**
 * Dry-run annotation plan for Phase 1.
 *
 * @example
 * ```ts
 * import {
 *   AgentEffectivenessAnnotationPlan,
 *   AgentEffectivenessAiMetricsSection,
 *   AgentEffectivenessDoctorReport,
 *   AgentEffectivenessDoctorSummary,
 *   AgentEffectivenessJsdocWorkerSection,
 *   AgentEffectivenessPhoenixSection,
 *   AgentEffectivenessPlannedAnnotation
 * } from "@beep/repo-ai-metrics"
 *
 * const summary = AgentEffectivenessDoctorSummary.make({
 *   failures: [],
 *   status: "passed",
 *   unavailable: [],
 *   warnings: []
 * })
 * const doctor = AgentEffectivenessDoctorReport.make({
 *   aiMetrics: AgentEffectivenessAiMetricsSection.make({
 *     benchmarkRunCount: 0,
 *     dataRoot: ".beep/ai-metrics",
 *     derivedDuckDbPath: ".beep/ai-metrics/derived/ai-metrics.duckdb",
 *     labelCount: 0,
 *     latestForwarder: null,
 *     latestScorecard: null,
 *     message: "AI-metrics evidence is present.",
 *     sourceCoverage: [],
 *     status: "passed",
 *     unavailableMetrics: []
 *   }),
 *   dataRoot: ".beep/ai-metrics",
 *   generatedAt: "2026-05-20T00:00:00.000Z",
 *   jsdocWorkerEval: AgentEffectivenessJsdocWorkerSection.make({
 *     cleanupDeleteStatus: null,
 *     cleanupStopStatus: null,
 *     completedPackets: 1,
 *     failedPackets: 0,
 *     message: "JSDoc worker-eval completed.",
 *     otlpStatus: null,
 *     policyViolationCodes: [],
 *     reportPath: "goals/jsdoc-worker-eval/ops/manifest.json",
 *     selectedPackets: 1,
 *     status: "passed",
 *     timedOutPackets: 0
 *   }),
 *   phoenix: AgentEffectivenessPhoenixSection.make({
 *     baseUrl: "https://phoenix.example.test",
 *     datasetCount: 0,
 *     evaluatorCount: 0,
 *     message: "Phoenix probe disabled.",
 *     projectCount: 0,
 *     projects: [],
 *     promptCount: 0,
 *     serverInsufficientStorage: false,
 *     status: "passed",
 *     version: null
 *   }),
 *   schemaVersion: "agent-effectiveness-doctor/v1",
 *   summary,
 *   target: "dankserver"
 * })
 * const plan = AgentEffectivenessAnnotationPlan.make({
 *   annotations: [
 *     AgentEffectivenessPlannedAnnotation.make({
 *       annotationId: "agent-effectiveness-doctor:loop:phase1:agent.loop.status",
 *       metadata: {},
 *       name: "agent.loop.status",
 *       optimization: "maximize",
 *       source: "agent-effectiveness-doctor",
 *       targetKind: "loop",
 *       targetRef: "phase1",
 *       value: "passed"
 *     })
 *   ],
 *   doctor,
 *   generatedAt: "2026-05-20T00:00:00.000Z",
 *   mutationPolicy: "local-only-no-phoenix-mutation",
 *   schemaVersion: "agent-effectiveness-annotation-plan/v1",
 *   summary
 * })
 * console.log(plan.annotations.length)
 * ```
 * @category models
 * @since 0.0.0
 */
export class AgentEffectivenessAnnotationPlan extends S.Class<AgentEffectivenessAnnotationPlan>(
  $I`AgentEffectivenessAnnotationPlan`
)(
  {
    annotations: S.Array(AgentEffectivenessPlannedAnnotation),
    doctor: AgentEffectivenessDoctorReport,
    generatedAt: S.String,
    mutationPolicy: S.String,
    schemaVersion: S.String,
    summary: AgentEffectivenessDoctorSummary,
  },
  $I.annote("AgentEffectivenessAnnotationPlan", {
    description: "Local-only dry-run annotation plan for the agent-effectiveness loop.",
  })
) {}

/**
 * One validation finding for an annotation plan.
 *
 * @example
 * ```ts
 * import { AgentEffectivenessAnnotationCheckFinding } from "@beep/repo-ai-metrics"
 *
 * const finding = AgentEffectivenessAnnotationCheckFinding.make({
 *   annotationId: "plan.metadata",
 *   code: "private-home-path",
 *   message: "Plan payload contains forbidden private-home-path content."
 * })
 * console.log(finding.code)
 * ```
 * @category models
 * @since 0.0.0
 */
export class AgentEffectivenessAnnotationCheckFinding extends S.Class<AgentEffectivenessAnnotationCheckFinding>(
  $I`AgentEffectivenessAnnotationCheckFinding`
)(
  {
    annotationId: S.String,
    code: S.String,
    message: S.String,
  },
  $I.annote("AgentEffectivenessAnnotationCheckFinding", {
    description: "Privacy or schema finding emitted while checking a dry-run annotation plan.",
  })
) {}

/**
 * Report emitted by `agent-effectiveness annotations check`.
 *
 * @example
 * ```ts
 * import { AgentEffectivenessAnnotationCheckReport } from "@beep/repo-ai-metrics"
 *
 * const report = AgentEffectivenessAnnotationCheckReport.make({
 *   annotationCount: 3,
 *   findings: [],
 *   generatedAt: "2026-05-20T00:00:00.000Z",
 *   schemaVersion: "agent-effectiveness-annotation-check/v1",
 *   status: "passed"
 * })
 * console.log(report.findings.length)
 * ```
 * @category models
 * @since 0.0.0
 */
export class AgentEffectivenessAnnotationCheckReport extends S.Class<AgentEffectivenessAnnotationCheckReport>(
  $I`AgentEffectivenessAnnotationCheckReport`
)(
  {
    annotationCount: S.Finite,
    findings: S.Array(AgentEffectivenessAnnotationCheckFinding),
    generatedAt: S.String,
    schemaVersion: S.String,
    status: AgentEffectivenessStatus,
  },
  $I.annote("AgentEffectivenessAnnotationCheckReport", {
    description: "Report-only privacy/schema check result for a local annotation plan.",
  })
) {}

/**
 * Dedicated Phoenix project namespace for the agent-effectiveness loop.
 *
 * @example
 * ```ts
 * import { AGENT_EFFECTIVENESS_PHOENIX_PROJECT } from "@beep/repo-ai-metrics"
 *
 * const projectName = AGENT_EFFECTIVENESS_PHOENIX_PROJECT
 * console.log(projectName === "beep-agent-effectiveness")
 * ```
 * @category constants
 * @since 0.0.0
 */
export const AGENT_EFFECTIVENESS_PHOENIX_PROJECT = "beep-agent-effectiveness";

/**
 * Confirmation token required before live Phoenix writes.
 *
 * @example
 * ```ts
 * import { AGENT_EFFECTIVENESS_PHOENIX_WRITE_CONFIRMATION } from "@beep/repo-ai-metrics"
 *
 * const confirmed = AGENT_EFFECTIVENESS_PHOENIX_WRITE_CONFIRMATION === "agent-effectiveness-phoenix-write"
 * console.log(confirmed)
 * ```
 * @category constants
 * @since 0.0.0
 */
export const AGENT_EFFECTIVENESS_PHOENIX_WRITE_CONFIRMATION = "agent-effectiveness-phoenix-write";

/**
 * Phoenix dataset kinds owned by the agent-effectiveness loop.
 *
 * @example
 * ```ts
 * import { AgentEffectivenessDatasetKind } from "@beep/repo-ai-metrics"
 *
 * console.log(AgentEffectivenessDatasetKind.Enum["agent-loop-health"])
 * ```
 * @category models
 * @since 0.0.0
 */
export const AgentEffectivenessDatasetKind = LiteralKit([
  "agent-config-snapshots",
  "agent-loop-health",
  "agent-outcomes",
  "jsdoc-worker-model-suitability",
  "source-coverage",
]).pipe(
  $I.annoteSchema("AgentEffectivenessDatasetKind", {
    description: "Phoenix dataset kinds owned by the agent-effectiveness loop.",
  })
);

/**
 * Type for {@link AgentEffectivenessDatasetKind}.
 *
 * @example
 * ```ts
 * import { AgentEffectivenessDatasetKind } from "@beep/repo-ai-metrics"
 *
 * const kind: AgentEffectivenessDatasetKind = "agent-loop-health"
 * console.log(AgentEffectivenessDatasetKind.is["agent-loop-health"](kind))
 * ```
 * @category models
 * @since 0.0.0
 */
export type AgentEffectivenessDatasetKind = typeof AgentEffectivenessDatasetKind.Type;

/**
 * One sanitized example destined for a Phoenix dataset.
 *
 * @example
 * ```ts
 * import { AgentEffectivenessDatasetExample } from "@beep/repo-ai-metrics"
 *
 * const example = AgentEffectivenessDatasetExample.make({ id: "loop", input: { status: "passed" } })
 * console.log(example.id)
 * ```
 * @category models
 * @since 0.0.0
 */
export class AgentEffectivenessDatasetExample extends S.Class<AgentEffectivenessDatasetExample>(
  $I`AgentEffectivenessDatasetExample`
)(
  {
    id: S.String,
    input: S.Record(S.String, S.Unknown),
    metadata: S.Record(S.String, S.Unknown).pipe(
      S.withConstructorDefault(Effect.succeed({})),
      S.withDecodingDefaultKey(Effect.succeed({}))
    ),
    output: S.Record(S.String, S.Unknown).pipe(
      S.withConstructorDefault(Effect.succeed({})),
      S.withDecodingDefaultKey(Effect.succeed({}))
    ),
    split: S.String.pipe(
      S.withConstructorDefault(Effect.succeed("current")),
      S.withDecodingDefaultKey(Effect.succeed("current"))
    ),
  },
  $I.annote("AgentEffectivenessDatasetExample", {
    description: "Sanitized, aggregate-only example destined for a Phoenix dataset.",
  })
) {}

/**
 * One repo-owned Phoenix dataset specification.
 *
 * @example
 * ```ts
 * import { AgentEffectivenessDatasetSpec } from "@beep/repo-ai-metrics"
 *
 * const spec = AgentEffectivenessDatasetSpec.make({
 *   description: "Loop health.",
 *   examples: [],
 *   kind: "agent-loop-health",
 *   name: "agent-loop-health-v1"
 * })
 * console.log(spec.name)
 * ```
 * @category models
 * @since 0.0.0
 */
export class AgentEffectivenessDatasetSpec extends S.Class<AgentEffectivenessDatasetSpec>(
  $I`AgentEffectivenessDatasetSpec`
)(
  {
    description: S.String,
    examples: S.Array(AgentEffectivenessDatasetExample),
    kind: AgentEffectivenessDatasetKind,
    name: S.String,
  },
  $I.annote("AgentEffectivenessDatasetSpec", {
    description: "Repo-owned Phoenix dataset specification for the agent-effectiveness loop.",
  })
) {}

/**
 * Full Phoenix dataset bundle derived from a doctor report.
 *
 * @example
 * ```ts
 * import { AgentEffectivenessDatasetBundle } from "@beep/repo-ai-metrics"
 *
 * const bundle = AgentEffectivenessDatasetBundle.make({
 *   datasets: [],
 *   generatedAt: "2026-05-20T00:00:00.000Z",
 *   projectName: "beep-agent-effectiveness",
 *   schemaVersion: "agent-effectiveness-datasets/v1"
 * })
 * console.log(bundle.projectName)
 * ```
 * @category models
 * @since 0.0.0
 */
export class AgentEffectivenessDatasetBundle extends S.Class<AgentEffectivenessDatasetBundle>(
  $I`AgentEffectivenessDatasetBundle`
)(
  {
    datasets: S.Array(AgentEffectivenessDatasetSpec),
    generatedAt: S.String,
    projectName: S.String,
    schemaVersion: S.String,
  },
  $I.annote("AgentEffectivenessDatasetBundle", {
    description: "Full Phoenix dataset bundle derived from agent-effectiveness doctor evidence.",
  })
) {}

/**
 * Prompt roles used by repo-owned agent-effectiveness prompt templates.
 *
 * @example
 * ```ts
 * import { AgentEffectivenessPromptRole } from "@beep/repo-ai-metrics"
 *
 * console.log(AgentEffectivenessPromptRole.Enum.user)
 * ```
 * @category models
 * @since 0.0.0
 */
export const AgentEffectivenessPromptRole = LiteralKit(["system", "user"]).pipe(
  $I.annoteSchema("AgentEffectivenessPromptRole", {
    description: "Prompt roles used by repo-owned agent-effectiveness prompt templates.",
  })
);

/**
 * Type for {@link AgentEffectivenessPromptRole}.
 *
 * @example
 * ```ts
 * import { AgentEffectivenessPromptRole } from "@beep/repo-ai-metrics"
 *
 * const role: AgentEffectivenessPromptRole = "user"
 * console.log(AgentEffectivenessPromptRole.is.user(role))
 * ```
 * @category models
 * @since 0.0.0
 */
export type AgentEffectivenessPromptRole = typeof AgentEffectivenessPromptRole.Type;

/**
 * One repo-owned Phoenix prompt message.
 *
 * @example
 * ```ts
 * import { AgentEffectivenessPromptMessage } from "@beep/repo-ai-metrics"
 *
 * const message = AgentEffectivenessPromptMessage.make({ content: "Review {{caseId}}", role: "user" })
 * console.log(message.role)
 * ```
 * @category models
 * @since 0.0.0
 */
export class AgentEffectivenessPromptMessage extends S.Class<AgentEffectivenessPromptMessage>(
  $I`AgentEffectivenessPromptMessage`
)(
  {
    content: S.String,
    role: AgentEffectivenessPromptRole,
  },
  $I.annote("AgentEffectivenessPromptMessage", {
    description: "One repo-owned Phoenix prompt message.",
  })
) {}

/**
 * Repo-owned Phoenix prompt specification.
 *
 * @example
 * ```ts
 * import { AgentEffectivenessPromptSpec } from "@beep/repo-ai-metrics"
 *
 * const spec = AgentEffectivenessPromptSpec.make({
 *   description: "Review evaluator.",
 *   messages: [],
 *   modelName: "gpt-4o-mini",
 *   name: "agent-effectiveness-review-evaluator-v1"
 * })
 * console.log(spec.name)
 * ```
 * @category models
 * @since 0.0.0
 */
export class AgentEffectivenessPromptSpec extends S.Class<AgentEffectivenessPromptSpec>(
  $I`AgentEffectivenessPromptSpec`
)(
  {
    description: S.String,
    messages: S.Array(AgentEffectivenessPromptMessage),
    modelName: S.String,
    name: S.String,
  },
  $I.annote("AgentEffectivenessPromptSpec", {
    description: "Repo-owned Phoenix prompt specification for deterministic evaluation workflows.",
  })
) {}

/**
 * Full repo-owned Phoenix prompt bundle.
 *
 * @example
 * ```ts
 * import { AgentEffectivenessPromptBundle } from "@beep/repo-ai-metrics"
 *
 * const bundle = AgentEffectivenessPromptBundle.make({
 *   generatedAt: "2026-05-20T00:00:00.000Z",
 *   projectName: "beep-agent-effectiveness",
 *   prompts: [],
 *   schemaVersion: "agent-effectiveness-prompts/v1"
 * })
 * console.log(bundle.projectName)
 * ```
 * @category models
 * @since 0.0.0
 */
export class AgentEffectivenessPromptBundle extends S.Class<AgentEffectivenessPromptBundle>(
  $I`AgentEffectivenessPromptBundle`
)(
  {
    generatedAt: S.String,
    projectName: S.String,
    prompts: S.Array(AgentEffectivenessPromptSpec),
    schemaVersion: S.String,
  },
  $I.annote("AgentEffectivenessPromptBundle", {
    description: "Full repo-owned Phoenix prompt bundle for the agent-effectiveness loop.",
  })
) {}

/**
 * Deterministic experiment plan entry.
 *
 * @example
 * ```ts
 * import { AgentEffectivenessExperimentSpec } from "@beep/repo-ai-metrics"
 *
 * const spec = AgentEffectivenessExperimentSpec.make({
 *   datasetName: "agent-loop-health-v1",
 *   description: "Deterministic loop-health readback.",
 *   name: "agent-loop-health-deterministic-v1"
 * })
 * console.log(spec.datasetName)
 * ```
 * @category models
 * @since 0.0.0
 */
export class AgentEffectivenessExperimentSpec extends S.Class<AgentEffectivenessExperimentSpec>(
  $I`AgentEffectivenessExperimentSpec`
)(
  {
    datasetName: S.String,
    description: S.String,
    metadata: S.Record(S.String, S.Unknown).pipe(
      S.withConstructorDefault(Effect.succeed({})),
      S.withDecodingDefaultKey(Effect.succeed({}))
    ),
    name: S.String,
  },
  $I.annote("AgentEffectivenessExperimentSpec", {
    description: "Deterministic experiment plan entry that performs no new model work.",
  })
) {}

/**
 * Deterministic experiment bundle derived from dataset specs.
 *
 * @example
 * ```ts
 * import { AgentEffectivenessExperimentBundle } from "@beep/repo-ai-metrics"
 *
 * const bundle = AgentEffectivenessExperimentBundle.make({
 *   experiments: [],
 *   generatedAt: "2026-05-20T00:00:00.000Z",
 *   projectName: "beep-agent-effectiveness",
 *   schemaVersion: "agent-effectiveness-experiments/v1"
 * })
 * console.log(bundle.projectName)
 * ```
 * @category models
 * @since 0.0.0
 */
export class AgentEffectivenessExperimentBundle extends S.Class<AgentEffectivenessExperimentBundle>(
  $I`AgentEffectivenessExperimentBundle`
)(
  {
    experiments: S.Array(AgentEffectivenessExperimentSpec),
    generatedAt: S.String,
    projectName: S.String,
    schemaVersion: S.String,
  },
  $I.annote("AgentEffectivenessExperimentBundle", {
    description: "Deterministic experiment bundle derived from agent-effectiveness dataset specs.",
  })
) {}

/**
 * `dryRun`/`confirmToken` options bundle for
 * {@link AgentEffectivenessPhoenixSyncInput.new}'s data-first/data-last dual.
 *
 * @category models
 * @since 0.0.0
 */
type AgentEffectivenessPhoenixSyncNewOptions = {
  readonly dryRun: boolean;
  readonly confirmToken?: string | undefined;
};

/**
 * Input for syncing agent-effectiveness evidence to Phoenix.
 *
 * @example
 * ```ts
 * import { AgentEffectivenessPhoenixSyncInput } from "@beep/repo-ai-metrics"
 *
 * const input = AgentEffectivenessPhoenixSyncInput.make({ dryRun: true })
 * console.log(input.dryRun)
 * ```
 * @category models
 * @since 0.0.0
 */
export class AgentEffectivenessPhoenixSyncInput extends S.Class<AgentEffectivenessPhoenixSyncInput>(
  $I`AgentEffectivenessPhoenixSyncInput`
)(
  {
    annotationPlan: AgentEffectivenessAnnotationPlanInput.pipe(
      S.withConstructorDefault(Effect.succeed(AgentEffectivenessAnnotationPlanInput.make({}))),
      S.withDecodingDefaultKey(Effect.succeed(AgentEffectivenessAnnotationPlanInput.make({})))
    ),
    confirmToken: S.String.pipe(S.optionalKey),
    dryRun: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(true)),
      S.withDecodingDefaultKey(Effect.succeed(true))
    ),
  },
  $I.annote("AgentEffectivenessPhoenixSyncInput", {
    description:
      "Input for guarded Phoenix sync of agent-effectiveness datasets, prompts, experiments, and annotations.",
  })
) {
  static readonly new: {
    (
      annotationPlan: AgentEffectivenessAnnotationPlanInput,
      options: AgentEffectivenessPhoenixSyncNewOptions
    ): AgentEffectivenessPhoenixSyncInput;
    (
      options: AgentEffectivenessPhoenixSyncNewOptions
    ): (annotationPlan: AgentEffectivenessAnnotationPlanInput) => AgentEffectivenessPhoenixSyncInput;
  } = dual(2, (annotationPlan, { confirmToken, dryRun }) =>
    AgentEffectivenessPhoenixSyncInput.make({
      annotationPlan,
      dryRun,
      ...(P.isUndefined(confirmToken) ? {} : { confirmToken }),
    })
  );
}

/**
 * Result from a guarded Phoenix sync attempt.
 *
 * @example
 * ```ts
 * import { AgentEffectivenessPhoenixSyncResult } from "@beep/repo-ai-metrics"
 *
 * const result = AgentEffectivenessPhoenixSyncResult.make({
 *   annotationCount: 0,
 *   datasetCount: 0,
 *   dryRun: true,
 *   experimentCount: 0,
 *   mutationPolicy: "dry-run",
 *   promptCount: 0,
 *   skippedAnnotationCount: 0,
 *   status: "passed",
 *   writtenDatasetIds: [],
 *   writtenExperimentIds: [],
 *   writtenPromptVersionIds: []
 * })
 * console.log(result.mutationPolicy)
 * ```
 * @category models
 * @since 0.0.0
 */
export class AgentEffectivenessPhoenixSyncResult extends S.Class<AgentEffectivenessPhoenixSyncResult>(
  $I`AgentEffectivenessPhoenixSyncResult`
)(
  {
    annotationCount: S.Finite,
    datasetCount: S.Finite,
    dryRun: S.Boolean,
    experimentCount: S.Finite,
    mutationPolicy: S.String,
    promptCount: S.Finite,
    skippedAnnotationCount: S.Finite,
    status: AgentEffectivenessStatus,
    writtenDatasetIds: S.Array(S.String),
    writtenExperimentIds: S.Array(S.String),
    writtenPromptVersionIds: S.Array(S.String),
  },
  $I.annote("AgentEffectivenessPhoenixSyncResult", {
    description: "Result from a guarded Phoenix sync attempt.",
  })
) {}

class SourceCoverageRow extends S.Class<SourceCoverageRow>($I`SourceCoverageRow`)(
  {
    acceptedEvents: S.Finite,
    lastTimestamp: S.NullOr(S.String),
    rejectedLines: S.Finite,
    sourceFileCount: S.Finite,
    sourceKind: S.String,
    totalLines: S.Finite,
  },
  $I.annote("SourceCoverageRow", {
    description: "Internal DuckDB source coverage row.",
  })
) {}

class ForwarderSummaryRow extends S.Class<ForwarderSummaryRow>($I`ForwarderSummaryRow`)(
  {
    archiveObjectCount: S.Finite,
    completedAtEpochMillis: S.Finite,
    configSnapshotId: S.String,
    ingestRunId: S.String,
    sourceFileCount: S.Finite,
    target: AiMetricsDeployTarget,
    turnCount: S.Finite,
  },
  $I.annote("ForwarderSummaryRow", {
    description: "Internal DuckDB forwarder summary row.",
  })
) {}

class ScorecardSummaryRow extends S.Class<ScorecardSummaryRow>($I`ScorecardSummaryRow`)(
  {
    benchmarkRunCount: S.Finite,
    completionReady: S.Boolean,
    configSnapshotId: S.String,
    coverageGapsJson: S.String,
    labelCount: S.Finite,
    scorecardId: S.String,
    taskCount: S.Finite,
    totalScore: S.Finite,
    windowEndEpochMillis: S.Finite,
    windowStartEpochMillis: S.Finite,
  },
  $I.annote("ScorecardSummaryRow", {
    description: "Internal DuckDB scorecard summary row.",
  })
) {}

class CountRow extends S.Class<CountRow>($I`CountRow`)(
  {
    count: S.Finite,
  },
  $I.annote("CountRow", {
    description: "Internal DuckDB count row.",
  })
) {}

class OutcomeLabelAnnotationRow extends S.Class<OutcomeLabelAnnotationRow>($I`OutcomeLabelAnnotationRow`)(
  {
    agentTaskId: S.String,
    followUpFix: S.Boolean,
    interventionCount: S.Finite,
    labelId: S.String,
    passed: S.Boolean,
    qualityGate: S.String,
    rating: S.Finite,
  },
  $I.annote("OutcomeLabelAnnotationRow", {
    description: "Internal row used to plan outcome label annotations.",
  })
) {}

class BenchmarkRunAnnotationRow extends S.Class<BenchmarkRunAnnotationRow>($I`BenchmarkRunAnnotationRow`)(
  {
    benchmarkCaseId: S.String,
    benchmarkRunId: S.String,
    configSnapshotId: S.String,
    elapsedMs: S.Finite,
    passed: S.Boolean,
    qualityGate: S.String,
  },
  $I.annote("BenchmarkRunAnnotationRow", {
    description: "Internal row used to plan benchmark annotations.",
  })
) {}

class WorkerEvalSummary extends S.Class<WorkerEvalSummary>($I`WorkerEvalSummary`)(
  {
    completed: S.Finite,
    failed: S.Finite,
    selectedPackets: S.Finite,
    timedOut: S.Finite,
  },
  $I.annote("WorkerEvalSummary", {
    description: "Internal minimal JSDoc worker-eval summary.",
  })
) {}

class WorkerEvalPolicyViolationObject extends S.Class<WorkerEvalPolicyViolationObject>(
  $I`WorkerEvalPolicyViolationObject`
)(
  {
    code: S.String,
  },
  $I.annote("WorkerEvalPolicyViolationObject", {
    description: "Internal minimal JSDoc worker-eval policy violation row.",
  })
) {}

const WorkerEvalPolicyViolation = S.Union([S.String, WorkerEvalPolicyViolationObject]).pipe(
  $I.annoteSchema("WorkerEvalPolicyViolation", {
    description: "Internal worker-eval policy violation code in either legacy object or current string form.",
  })
);

class WorkerEvalPacket extends S.Class<WorkerEvalPacket>($I`WorkerEvalPacket`)(
  {
    policyViolationCodes: S.Array(S.String).pipe(
      S.withConstructorDefault(Effect.succeed([])),
      S.withDecodingDefaultKey(Effect.succeed([]))
    ),
  },
  $I.annote("WorkerEvalPacket", {
    description: "Internal minimal JSDoc worker-eval packet row.",
  })
) {}

class WorkerEvalReport extends S.Class<WorkerEvalReport>($I`WorkerEvalReport`)(
  {
    packets: S.Array(WorkerEvalPacket).pipe(
      S.withConstructorDefault(Effect.succeed([])),
      S.withDecodingDefaultKey(Effect.succeed([]))
    ),
    policyViolations: S.Array(WorkerEvalPolicyViolation).pipe(
      S.withConstructorDefault(Effect.succeed([])),
      S.withDecodingDefaultKey(Effect.succeed([]))
    ),
    summary: WorkerEvalSummary,
  },
  $I.annote("WorkerEvalReport", {
    description: "Internal minimal nested JSDoc worker eval report.",
  })
) {}

class RunpodWorkerCleanup extends S.Class<RunpodWorkerCleanup>($I`RunpodWorkerCleanup`)(
  {
    deleteStatus: S.String,
    stopStatus: S.String,
  },
  $I.annote("RunpodWorkerCleanup", {
    description: "Internal Runpod worker cleanup status wrapper.",
  })
) {}

class RunpodWorkerOtlp extends S.Class<RunpodWorkerOtlp>($I`RunpodWorkerOtlp`)(
  {
    status: S.String,
  },
  $I.annote("RunpodWorkerOtlp", {
    description: "Internal Runpod worker OTLP export status wrapper.",
  })
) {}

class RunpodWorkerEvalReport extends S.Class<RunpodWorkerEvalReport>($I`RunpodWorkerEvalReport`)(
  {
    cleanup: RunpodWorkerCleanup,
    otlp: RunpodWorkerOtlp,
    workerEval: WorkerEvalReport,
  },
  $I.annote("RunpodWorkerEvalReport", {
    description: "Internal minimal Runpod worker-eval wrapper report.",
  })
) {}

class WorkerEvalManifestEvidence extends S.Class<WorkerEvalManifestEvidence>($I`WorkerEvalManifestEvidence`)(
  {
    raw: S.String,
  },
  $I.annote("WorkerEvalManifestEvidence", {
    description: "Internal initiative manifest evidence row used to resolve the latest worker-eval report.",
  })
) {}

class WorkerEvalManifest extends S.Class<WorkerEvalManifest>($I`WorkerEvalManifest`)(
  {
    evidence: S.Array(WorkerEvalManifestEvidence),
  },
  $I.annote("WorkerEvalManifest", {
    description: "Internal JSDoc worker-eval manifest shape used by the agent-effectiveness default.",
  })
) {}

class PhoenixGraphqlProjectNode extends S.Class<PhoenixGraphqlProjectNode>($I`PhoenixGraphqlProjectNode`)(
  {
    hasTraces: S.Boolean,
    name: S.String,
    recordCount: S.Finite,
    spanAnnotationNames: S.Array(S.String),
    sessionAnnotationNames: S.Array(S.String),
    traceAnnotationsNames: S.Array(S.String),
    traceCount: S.Finite,
  },
  $I.annote("PhoenixGraphqlProjectNode", {
    description: "Internal Phoenix GraphQL project node.",
  })
) {}

class PhoenixGraphqlProjectEdge extends S.Class<PhoenixGraphqlProjectEdge>($I`PhoenixGraphqlProjectEdge`)(
  {
    node: PhoenixGraphqlProjectNode,
  },
  $I.annote("PhoenixGraphqlProjectEdge", {
    description: "Internal Phoenix GraphQL project edge.",
  })
) {}

class PhoenixGraphqlProjectsConnection extends S.Class<PhoenixGraphqlProjectsConnection>(
  $I`PhoenixGraphqlProjectsConnection`
)(
  {
    edges: S.Array(PhoenixGraphqlProjectEdge),
  },
  $I.annote("PhoenixGraphqlProjectsConnection", {
    description: "Internal Phoenix GraphQL projects connection.",
  })
) {}

class PhoenixGraphqlServerStatus extends S.Class<PhoenixGraphqlServerStatus>($I`PhoenixGraphqlServerStatus`)(
  {
    insufficientStorage: S.Boolean,
  },
  $I.annote("PhoenixGraphqlServerStatus", {
    description: "Internal Phoenix GraphQL server status.",
  })
) {}

class PhoenixGraphqlData extends S.Class<PhoenixGraphqlData>($I`PhoenixGraphqlData`)(
  {
    datasetCount: S.Finite,
    evaluatorCount: S.Finite,
    projectCount: S.Finite,
    projects: PhoenixGraphqlProjectsConnection,
    promptCount: S.Finite,
    serverStatus: PhoenixGraphqlServerStatus,
  },
  $I.annote("PhoenixGraphqlData", {
    description: "Internal Phoenix GraphQL inventory data payload.",
  })
) {}

class PhoenixGraphqlResponse extends S.Class<PhoenixGraphqlResponse>($I`PhoenixGraphqlResponse`)(
  {
    data: PhoenixGraphqlData,
  },
  $I.annote("PhoenixGraphqlResponse", {
    description: "Internal Phoenix GraphQL inventory response.",
  })
) {}

const decodeSourceCoverageRows = S.decodeUnknownEffect(S.Array(SourceCoverageRow));
const decodeForwarderSummaryRows = S.decodeUnknownEffect(S.Array(ForwarderSummaryRow));
const decodeScorecardSummaryRows = S.decodeUnknownEffect(S.Array(ScorecardSummaryRow));
const decodeCountRows = S.decodeUnknownEffect(S.Array(CountRow));
const decodeOutcomeLabelAnnotationRows = S.decodeUnknownEffect(S.Array(OutcomeLabelAnnotationRow));
const decodeBenchmarkRunAnnotationRows = S.decodeUnknownEffect(S.Array(BenchmarkRunAnnotationRow));
const decodeWorkerEvalManifestJson = S.decodeUnknownEffect(S.fromJsonString(WorkerEvalManifest));
const decodeRunpodWorkerEvalReportJson = S.decodeUnknownEffect(S.fromJsonString(RunpodWorkerEvalReport));
const decodePhoenixGraphqlResponse = S.decodeUnknownEffect(PhoenixGraphqlResponse);
const encodeDoctorReportJson = S.encodeUnknownEffect(S.fromJsonString(AgentEffectivenessDoctorReport));
const encodeAnnotationPlanJson = S.encodeUnknownEffect(S.fromJsonString(AgentEffectivenessAnnotationPlan));
const encodeAnnotationPlanJsonSync = S.encodeUnknownSync(S.fromJsonString(AgentEffectivenessAnnotationPlan));
const decodeUnknownJsonSync = S.decodeUnknownSync(S.UnknownFromJsonString);
const encodeAnnotationCheckJson = S.encodeUnknownEffect(S.fromJsonString(AgentEffectivenessAnnotationCheckReport));
const encodeDatasetBundleJson = S.encodeUnknownEffect(S.fromJsonString(AgentEffectivenessDatasetBundle));
const encodePromptBundleJson = S.encodeUnknownEffect(S.fromJsonString(AgentEffectivenessPromptBundle));
const encodeExperimentBundleJson = S.encodeUnknownEffect(S.fromJsonString(AgentEffectivenessExperimentBundle));
const encodePhoenixSyncResultJson = S.encodeUnknownEffect(S.fromJsonString(AgentEffectivenessPhoenixSyncResult));
const decodeCoverageGapsJson = S.decodeUnknownEffect(S.fromJsonString(S.Array(S.String)));
const currentIsoTimestamp = DateTime.now.pipe(Effect.map(DateTime.formatIso));

const sectionStatus = (
  status: AgentEffectivenessStatus,
  label: string,
  message: string
): {
  readonly failures: ReadonlyArray<string>;
  readonly unavailable: ReadonlyArray<string>;
  readonly warnings: ReadonlyArray<string>;
} =>
  AgentEffectivenessStatus.$match(status, {
    failed: () => ({ failures: [`${label}: ${message}`], unavailable: [], warnings: [] }),
    passed: () => ({ failures: [], unavailable: [], warnings: [] }),
    unavailable: () => ({ failures: [], unavailable: [`${label}: ${message}`], warnings: [] }),
    warning: () => ({ failures: [], unavailable: [], warnings: [`${label}: ${message}`] }),
  });

const aggregateSummary = (
  sections: ReadonlyArray<{
    readonly label: string;
    readonly message: string;
    readonly status: AgentEffectivenessStatus;
  }>
): AgentEffectivenessDoctorSummary => {
  const folded = pipe(
    sections,
    A.reduce(
      {
        failures: A.empty<string>(),
        unavailable: A.empty<string>(),
        warnings: A.empty<string>(),
      },
      (acc, section) => {
        const current = sectionStatus(section.status, section.label, section.message);
        return {
          failures: [...acc.failures, ...current.failures],
          unavailable: [...acc.unavailable, ...current.unavailable],
          warnings: [...acc.warnings, ...current.warnings],
        };
      }
    )
  );

  const status = Match.value(folded).pipe(
    Match.when(
      ({ failures }) => A.isReadonlyArrayNonEmpty(failures),
      () => AgentEffectivenessStatus.Enum.failed
    ),
    Match.when(
      ({ unavailable, warnings }) => A.isReadonlyArrayNonEmpty(warnings) || A.isReadonlyArrayNonEmpty(unavailable),
      () => AgentEffectivenessStatus.Enum.warning
    ),
    Match.orElse(() => AgentEffectivenessStatus.Enum.passed)
  );

  return AgentEffectivenessDoctorSummary.make({ ...folded, status });
};

// crispen: retained as `A | null` for the two NullOr wire fields (latestScorecard/latestForwarder),
// whose S.NullOr schema and `=== null` consumers require the null boundary; fold to Option only when
// those fields become S.OptionFromNullOr.
const firstOrNull: <A>(values: ReadonlyArray<A>) => A | null = flow(A.head, O.getOrNull);

const dataRootDuckDbPath = (dataRoot: string): string => `${dataRoot}/derived/ai-metrics.duckdb`;
const normalizePathSeparators = Str.replace(/\\/gu, "/");
const isWorkerEvalManifestPath = flow(normalizePathSeparators, Str.endsWith("/ops/manifest.json"));

// Strip terminal control sequences (ANSI CSI/OSC/other ESC sequences, BEL) and
// remaining C0/C1 control characters from untrusted report strings before they
// are interpolated into human-readable doctor messages. Without this, attacker
// controlled policy-violation codes from a worker-eval artifact could inject
// escape sequences (output spoofing, screen clearing, hyperlink/clipboard
// manipulation) into the developer terminal that renders the message.
const stripTerminalControlSequences: (value: string) => string = flow(
  // OSC sequences: ESC ] ... terminated by BEL (\u0007) or ST (ESC \\).
  Str.replace(/\u001B\][\s\S]*?(?:\u0007|\u001B\\)/gu, ""),
  // CSI sequences: ESC [ params intermediates final-byte.
  Str.replace(/\u001B\[[0-?]*[ -/]*[@-~]/gu, ""),
  // Any other two-byte ESC sequence (ESC + a single final byte).
  Str.replace(/\u001B[@-Z\\-_]/gu, ""),
  // Remaining C0 controls (incl. BEL, CR, LF, lone ESC) and DEL/C1 controls.
  Str.replace(/[\u0000-\u001F\u007F-\u009F]/gu, "")
);
const normalizeAnnotationIdSuffix = flow(Str.replace(/[^A-Za-z0-9._-]+/gu, "-"), Str.replace(/^-+|-+$/gu, ""));

const annotationIdSuffixPart = (value: string): string => {
  const normalized = normalizeAnnotationIdSuffix(value);
  return Str.isNonEmpty(normalized) ? normalized : "value";
};

const readJsonFile = Effect.fn("AiMetrics.agentEffectiveness.readJsonFile")(function* (filePath: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const absolutePath = path.resolve(filePath);
  return yield* fs.readFileString(absolutePath);
});

const latestWorkerEvalRawPath = (manifest: WorkerEvalManifest): O.Option<string> =>
  pipe(
    manifest.evidence,
    A.findLast((entry) => Str.endsWith(".json")(entry.raw) && Str.includes("worker-eval")(entry.raw)),
    O.map((entry) => entry.raw)
  );

const resolveWorkerEvalReportPath = Effect.fn("AiMetrics.agentEffectiveness.resolveWorkerEvalReportPath")(function* (
  workerEvalReportPath: string
) {
  const path = yield* Path.Path;
  const absolutePath = path.resolve(workerEvalReportPath);
  if (!isWorkerEvalManifestPath(absolutePath)) {
    return absolutePath;
  }

  const manifest = yield* readJsonFile(absolutePath).pipe(Effect.flatMap(decodeWorkerEvalManifestJson), Effect.option);
  if (O.isNone(manifest)) {
    return absolutePath;
  }

  return pipe(
    latestWorkerEvalRawPath(manifest.value),
    O.map((rawPath) => path.resolve(path.dirname(path.dirname(absolutePath)), rawPath)),
    O.getOrElse(() => absolutePath)
  );
});

const buildPhoenixUnavailable = (
  input: AgentEffectivenessDoctorInput,
  message: string
): AgentEffectivenessPhoenixSection =>
  AgentEffectivenessPhoenixSection.make({
    baseUrl: input.phoenixBaseUrl,
    datasetCount: 0,
    evaluatorCount: 0,
    message,
    projectCount: 0,
    projects: [],
    promptCount: 0,
    serverInsufficientStorage: false,
    status: AgentEffectivenessStatus.Enum.unavailable,
    version: null,
  });

const probePhoenix = Effect.fn("AiMetrics.agentEffectiveness.probePhoenix")(function* (
  input: AgentEffectivenessDoctorInput
) {
  if (input.noPhoenix) {
    return buildPhoenixUnavailable(input, "Phoenix probe disabled by --no-phoenix.");
  }

  const client = yield* HttpClient.HttpClient;
  const root = yield* client.get(input.phoenixBaseUrl).pipe(Effect.option);
  const projects = yield* client.get(`${input.phoenixBaseUrl}/projects`).pipe(Effect.option);

  if (O.isNone(root) || O.isNone(projects)) {
    return buildPhoenixUnavailable(input, "Phoenix endpoint was not reachable.");
  }

  if (
    root.value.status < 200 ||
    root.value.status >= 400 ||
    projects.value.status < 200 ||
    projects.value.status >= 400
  ) {
    return buildPhoenixUnavailable(input, "Phoenix endpoint returned a non-success status.");
  }

  const request = yield* HttpClientRequest.bodyJson(HttpClientRequest.post(`${input.phoenixBaseUrl}/graphql`), {
    query: phoenixInventoryQuery,
  }).pipe(Effect.option);

  if (O.isNone(request)) {
    return buildPhoenixUnavailable(input, "Phoenix GraphQL request could not be encoded.");
  }

  const response = yield* client
    .execute(pipe(request.value, HttpClientRequest.accept("application/json")))
    .pipe(Effect.option);

  if (O.isNone(response) || response.value.status < 200 || response.value.status >= 300) {
    return buildPhoenixUnavailable(input, "Phoenix GraphQL inventory query failed.");
  }

  const inventory = yield* HttpClientResponse.schemaBodyJson(S.Unknown)(response.value).pipe(
    Effect.flatMap(decodePhoenixGraphqlResponse),
    Effect.option
  );

  if (O.isNone(inventory)) {
    return buildPhoenixUnavailable(input, "Phoenix GraphQL inventory response could not be decoded.");
  }

  const version =
    root.value.headers["x-phoenix-server-version"] ?? projects.value.headers["x-phoenix-server-version"] ?? null;
  const data = inventory.value.data;
  const projectsList = pipe(
    data.projects.edges,
    A.map((edge) =>
      AgentEffectivenessPhoenixProject.make({
        hasTraces: edge.node.hasTraces,
        name: edge.node.name,
        recordCount: edge.node.recordCount,
        spanAnnotationNames: edge.node.spanAnnotationNames,
        sessionAnnotationNames: edge.node.sessionAnnotationNames,
        traceAnnotationNames: edge.node.traceAnnotationsNames,
        traceCount: edge.node.traceCount,
      })
    )
  );
  const hasTraceBearingProject = pipe(
    projectsList,
    A.some((project) => project.hasTraces)
  );

  return AgentEffectivenessPhoenixSection.make({
    baseUrl: input.phoenixBaseUrl,
    datasetCount: data.datasetCount,
    evaluatorCount: data.evaluatorCount,
    message: hasTraceBearingProject
      ? "Phoenix is reachable and has trace-bearing projects."
      : "Phoenix is reachable but no trace-bearing projects were reported.",
    projectCount: data.projectCount,
    projects: projectsList,
    promptCount: data.promptCount,
    serverInsufficientStorage: data.serverStatus.insufficientStorage,
    status:
      data.serverStatus.insufficientStorage || !hasTraceBearingProject
        ? AgentEffectivenessStatus.Enum.warning
        : AgentEffectivenessStatus.Enum.passed,
    version,
  });
});

const queryAiMetricsSection = Effect.fn("AiMetrics.agentEffectiveness.queryAiMetricsSection")(function* (
  input: AgentEffectivenessDoctorInput,
  duckDbPath: string
) {
  const duckdb = yield* DuckDb;
  const sourceRows = yield* duckdb
    .query(
      `SELECT source_kind AS "sourceKind",
              count(*)::INTEGER AS "sourceFileCount", sum(total_lines)::INTEGER AS "totalLines", sum(accepted_events)::INTEGER AS "acceptedEvents", sum(rejected_lines)::INTEGER AS "rejectedLines", max(last_timestamp) AS "lastTimestamp"
       FROM ai_metrics_source_files
       GROUP BY source_kind
       ORDER BY source_kind`
    )
    .pipe(Effect.flatMap(decodeSourceCoverageRows));
  const forwarderRows = yield* duckdb
    .query(
      `SELECT ingest_run_id      AS "ingestRunId",
              target             AS "target",
              config_snapshot_id AS "configSnapshotId",
              completed_at_epoch_ms::DOUBLE AS "completedAtEpochMillis", source_file_count::INTEGER AS "sourceFileCount", archive_object_count::INTEGER AS "archiveObjectCount", turn_count::INTEGER AS "turnCount"
       FROM ai_metrics_ingest_runs
       ORDER BY completed_at_epoch_ms DESC LIMIT 1`
    )
    .pipe(Effect.flatMap(decodeForwarderSummaryRows));
  const scorecardRows = yield* duckdb
    .query(
      `SELECT scorecard_id       AS "scorecardId",
              config_snapshot_id AS "configSnapshotId",
              window_start_epoch_ms::DOUBLE AS "windowStartEpochMillis", window_end_epoch_ms::DOUBLE AS "windowEndEpochMillis", total_score::DOUBLE AS "totalScore", task_count::INTEGER AS "taskCount", label_count::INTEGER AS "labelCount", benchmark_run_count::INTEGER AS "benchmarkRunCount", completion_ready AS "completionReady",
              coverage_gaps_json AS "coverageGapsJson"
       FROM ai_metrics_scorecards
       ORDER BY window_end_epoch_ms DESC LIMIT 1`
    )
    .pipe(Effect.flatMap(decodeScorecardSummaryRows));
  const labelCountRows = yield* duckdb
    .query(`SELECT count(*) ::INTEGER AS "count"
            FROM ai_metrics_outcome_labels`)
    .pipe(Effect.flatMap(decodeCountRows));
  const benchmarkCountRows = yield* duckdb
    .query(`SELECT count(*) ::INTEGER AS "count"
            FROM ai_metrics_benchmark_runs`)
    .pipe(Effect.flatMap(decodeCountRows));

  const latestScorecard = firstOrNull(scorecardRows);
  const coverageGaps =
    latestScorecard === null
      ? []
      : yield* decodeCoverageGapsJson(latestScorecard.coverageGapsJson).pipe(
          Effect.orElseSucceed(() => ["invalid_coverage_gaps_json"])
        );
  const scorecard =
    latestScorecard === null
      ? null
      : AgentEffectivenessScorecardSummary.make({
          benchmarkRunCount: latestScorecard.benchmarkRunCount,
          completionReady: latestScorecard.completionReady,
          configSnapshotId: latestScorecard.configSnapshotId,
          coverageGaps,
          labelCount: latestScorecard.labelCount,
          scorecardId: latestScorecard.scorecardId,
          taskCount: latestScorecard.taskCount,
          totalScore: latestScorecard.totalScore,
          windowEndEpochMillis: latestScorecard.windowEndEpochMillis,
          windowStartEpochMillis: latestScorecard.windowStartEpochMillis,
        });
  const sourceCoverage = pipe(
    sourceRows,
    A.map((row) =>
      AgentEffectivenessSourceCoverage.make({
        acceptedEvents: row.acceptedEvents,
        lastTimestamp: row.lastTimestamp,
        rejectedLines: row.rejectedLines,
        sourceFileCount: row.sourceFileCount,
        sourceKind: row.sourceKind,
        totalLines: row.totalLines,
      })
    )
  );
  const latestForwarderRow = firstOrNull(forwarderRows);
  const latestForwarder =
    latestForwarderRow === null
      ? null
      : AgentEffectivenessForwarderSummary.make({
          archiveObjectCount: latestForwarderRow.archiveObjectCount,
          completedAtEpochMillis: latestForwarderRow.completedAtEpochMillis,
          configSnapshotId: latestForwarderRow.configSnapshotId,
          ingestRunId: latestForwarderRow.ingestRunId,
          sourceFileCount: latestForwarderRow.sourceFileCount,
          target: latestForwarderRow.target,
          turnCount: latestForwarderRow.turnCount,
        });
  const labelCount = A.head(labelCountRows).pipe(
    O.map((row) => row.count),
    O.getOrElse(() => 0)
  );
  const benchmarkRunCount = A.head(benchmarkCountRows).pipe(
    O.map((row) => row.count),
    O.getOrElse(() => 0)
  );
  const unavailableMetrics = ["provider_model_token_cost"];
  const missingCore = latestForwarder === null || scorecard === null || A.isReadonlyArrayEmpty(sourceCoverage);
  const readinessWarnings =
    scorecard === null
      ? ["no_scorecard"]
      : [
          ...(scorecard.completionReady ? [] : ["scorecard_not_completion_ready"]),
          ...(scorecard.labelCount > 0 ? [] : ["no_labels"]),
          ...(scorecard.benchmarkRunCount > 0 ? [] : ["no_benchmark_runs"]),
          ...scorecard.coverageGaps,
        ];

  return AgentEffectivenessAiMetricsSection.make({
    benchmarkRunCount,
    dataRoot: input.dataRoot,
    derivedDuckDbPath: duckDbPath,
    labelCount,
    latestForwarder,
    latestScorecard: scorecard,
    message: pipe(
      [
        pipe(
          missingCore,
          O.liftPredicate(P.isTruthy),
          O.as("AI-metrics derived storage is present but core evidence is incomplete.")
        ),
        pipe(
          readinessWarnings,
          O.liftPredicate(A.isReadonlyArrayNonEmpty),
          O.as(`AI-metrics evidence is present with readiness warnings: ${A.join(readinessWarnings, ", ")}.`)
        ),
      ],
      O.firstSomeOf,
      O.getOrElse(() => "AI-metrics derived evidence is present and completion-ready.")
    ),
    sourceCoverage,
    status:
      missingCore || A.isReadonlyArrayNonEmpty(readinessWarnings)
        ? AgentEffectivenessStatus.Enum.warning
        : AgentEffectivenessStatus.Enum.passed,
    unavailableMetrics,
  });
});

const buildAiMetricsSection = Effect.fn("AiMetrics.agentEffectiveness.buildAiMetricsSection")(function* (
  input: AgentEffectivenessDoctorInput
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const duckDbPath = path.resolve(dataRootDuckDbPath(input.dataRoot));
  const exists = yield* fs.exists(duckDbPath).pipe(Effect.orElseSucceed(() => false));

  if (!exists) {
    return AgentEffectivenessAiMetricsSection.make({
      benchmarkRunCount: 0,
      dataRoot: input.dataRoot,
      derivedDuckDbPath: duckDbPath,
      labelCount: 0,
      latestForwarder: null,
      latestScorecard: null,
      message: "AI-metrics DuckDB evidence was not found at the selected data root.",
      sourceCoverage: [],
      status: AgentEffectivenessStatus.Enum.unavailable,
      unavailableMetrics: ["provider_model_token_cost"],
    });
  }

  return yield* queryAiMetricsSection(input, duckDbPath).pipe(
    Effect.orElseSucceed(() =>
      AgentEffectivenessAiMetricsSection.make({
        benchmarkRunCount: 0,
        dataRoot: input.dataRoot,
        derivedDuckDbPath: duckDbPath,
        labelCount: 0,
        latestForwarder: null,
        latestScorecard: null,
        message: "AI-metrics DuckDB evidence could not be queried.",
        sourceCoverage: [],
        status: AgentEffectivenessStatus.Enum.unavailable,
        unavailableMetrics: ["provider_model_token_cost"],
      })
    )
  );
});

const buildJsdocWorkerSection = Effect.fn("AiMetrics.agentEffectiveness.buildJsdocWorkerSection")(function* (
  input: AgentEffectivenessDoctorInput
) {
  const fs = yield* FileSystem.FileSystem;
  const reportPath = yield* resolveWorkerEvalReportPath(input.workerEvalReportPath);
  const exists = yield* fs.exists(reportPath).pipe(Effect.orElseSucceed(() => false));

  if (!exists) {
    return AgentEffectivenessJsdocWorkerSection.make({
      cleanupDeleteStatus: null,
      cleanupStopStatus: null,
      completedPackets: 0,
      failedPackets: 0,
      message: "JSDoc worker-eval report was not found.",
      otlpStatus: null,
      policyViolationCodes: [],
      reportPath,
      selectedPackets: 0,
      status: AgentEffectivenessStatus.Enum.unavailable,
      timedOutPackets: 0,
    });
  }

  const decoded = yield* readJsonFile(reportPath).pipe(Effect.flatMap(decodeRunpodWorkerEvalReportJson), Effect.option);

  if (O.isNone(decoded)) {
    return AgentEffectivenessJsdocWorkerSection.make({
      cleanupDeleteStatus: null,
      cleanupStopStatus: null,
      completedPackets: 0,
      failedPackets: 0,
      message: "JSDoc worker-eval report could not be decoded.",
      otlpStatus: null,
      policyViolationCodes: [],
      reportPath,
      selectedPackets: 0,
      status: AgentEffectivenessStatus.Enum.unavailable,
      timedOutPackets: 0,
    });
  }

  const summary = decoded.value.workerEval.summary;
  const policyViolationCodes = pipe(
    [
      ...pipe(
        decoded.value.workerEval.policyViolations,
        A.map((violation) => (P.isString(violation) ? violation : violation.code))
      ),
      ...pipe(
        decoded.value.workerEval.packets,
        A.flatMap((packet) => packet.policyViolationCodes)
      ),
    ],
    // Untrusted report strings: strip terminal control sequences before they are
    // joined into the human-readable message or echoed to any terminal/JSON sink.
    A.map(stripTerminalControlSequences),
    A.dedupe
  );
  const hasFailures = summary.failed > 0 || summary.timedOut > 0;
  const hasWarnings = A.isReadonlyArrayNonEmpty(policyViolationCodes);

  return AgentEffectivenessJsdocWorkerSection.make({
    cleanupDeleteStatus: decoded.value.cleanup.deleteStatus,
    cleanupStopStatus: decoded.value.cleanup.stopStatus,
    completedPackets: summary.completed,
    failedPackets: summary.failed,
    message: pipe(
      [
        pipe(hasFailures, O.liftPredicate(P.isTruthy), O.as("JSDoc worker-eval contains failed or timed-out packets.")),
        pipe(
          hasWarnings,
          O.liftPredicate(P.isTruthy),
          O.as(`JSDoc worker-eval completed with policy warnings: ${A.join(policyViolationCodes, ", ")}.`)
        ),
      ],
      O.firstSomeOf,
      O.getOrElse(() => "JSDoc worker-eval completed without policy violations.")
    ),
    otlpStatus: decoded.value.otlp.status,
    policyViolationCodes,
    reportPath,
    selectedPackets: summary.selectedPackets,
    status: pipe(
      [
        pipe(hasFailures, O.liftPredicate(P.isTruthy), O.as(AgentEffectivenessStatus.Enum.failed)),
        pipe(hasWarnings, O.liftPredicate(P.isTruthy), O.as(AgentEffectivenessStatus.Enum.warning)),
      ],
      O.firstSomeOf,
      O.getOrElse(() => AgentEffectivenessStatus.Enum.passed)
    ),
    timedOutPackets: summary.timedOut,
  });
});

/**
 * Build the report-only Phase 1 agent-effectiveness doctor report.
 *
 * @effects
 * - Reads Phoenix health and GraphQL inventory unless `noPhoenix` disables the probe.
 * - Reads the local AI-metrics DuckDB file when derived storage exists.
 * - Reads the JSDoc worker-eval manifest or report from the selected path.
 * - Captures the current clock time for the report timestamp.
 * @example
 * ```ts
 * import { AgentEffectivenessDoctorInput, makeAgentEffectivenessDoctorReport } from "@beep/repo-ai-metrics"
 * import { Effect } from "effect"
 * const program = makeAgentEffectivenessDoctorReport(
 *   AgentEffectivenessDoctorInput.make({ noPhoenix: true })
 * )
 * const status = Effect.map(program, (report) => report.summary.status)
 * console.log(status)
 * ```
 * @category services
 * @since 0.0.0
 */
export const makeAgentEffectivenessDoctorReport: (
  input?: AgentEffectivenessDoctorInput
) => Effect.Effect<
  AgentEffectivenessDoctorReport,
  never,
  DuckDb | FileSystem.FileSystem | HttpClient.HttpClient | Path.Path
> = Effect.fn("AiMetrics.makeAgentEffectivenessDoctorReport")(function* (
  input: AgentEffectivenessDoctorInput = AgentEffectivenessDoctorInput.make({})
) {
  const [phoenix, aiMetrics, jsdocWorkerEval] = yield* Effect.all(
    [probePhoenix(input), buildAiMetricsSection(input), buildJsdocWorkerSection(input)] as const,
    { concurrency: 3 }
  );
  const summary = aggregateSummary([
    { label: "phoenix", message: phoenix.message, status: phoenix.status },
    { label: "aiMetrics", message: aiMetrics.message, status: aiMetrics.status },
    {
      label: "jsdocWorkerEval",
      message: jsdocWorkerEval.message,
      status: jsdocWorkerEval.status,
    },
  ]);
  const generatedAt = yield* currentIsoTimestamp;

  return AgentEffectivenessDoctorReport.make({
    aiMetrics,
    dataRoot: input.dataRoot,
    generatedAt,
    jsdocWorkerEval,
    phoenix,
    schemaVersion: "agent-effectiveness-doctor/v1",
    summary,
    target: input.target,
  });
});

const annotation = ({
  idSuffix,
  metadata = {},
  name,
  optimization,
  source,
  targetKind,
  targetRef,
  value,
}: {
  readonly idSuffix?: string;
  readonly metadata?: Record<string, string>;
  readonly name: string;
  readonly optimization: string;
  readonly source: string;
  readonly targetKind: string;
  readonly targetRef: string;
  readonly value: AgentEffectivenessAnnotationValue;
}): AgentEffectivenessPlannedAnnotation => {
  const baseAnnotationId = `${source}:${targetKind}:${targetRef}:${name}`;
  const annotationId = pipe(
    O.fromUndefinedOr(idSuffix),
    O.map((suffix) => `${baseAnnotationId}:${annotationIdSuffixPart(suffix)}`),
    O.getOrElse(() => baseAnnotationId)
  );
  return AgentEffectivenessPlannedAnnotation.make({
    annotationId,
    metadata,
    name,
    optimization,
    source,
    targetKind,
    targetRef,
    value,
  });
};

const sourceCoverageAnnotations = (
  doctor: AgentEffectivenessDoctorReport
): ReadonlyArray<AgentEffectivenessPlannedAnnotation> =>
  pipe(
    doctor.aiMetrics.sourceCoverage,
    A.flatMap((coverage) => [
      annotation({
        metadata: { sourceKind: coverage.sourceKind },
        name: "agent.source.file_count",
        optimization: "maximize",
        source: "ai-metrics",
        targetKind: "source",
        targetRef: coverage.sourceKind,
        value: coverage.sourceFileCount,
      }),
      annotation({
        metadata: { sourceKind: coverage.sourceKind },
        name: "agent.source.accepted_events",
        optimization: "maximize",
        source: "ai-metrics",
        targetKind: "source",
        targetRef: coverage.sourceKind,
        value: coverage.acceptedEvents,
      }),
    ])
  );

const scorecardAnnotations = (
  doctor: AgentEffectivenessDoctorReport
): ReadonlyArray<AgentEffectivenessPlannedAnnotation> => {
  const scorecard = doctor.aiMetrics.latestScorecard;
  if (scorecard === null) {
    return [];
  }

  return [
    annotation({
      metadata: { configSnapshotId: scorecard.configSnapshotId },
      name: "scorecard.completion_ready",
      optimization: "maximize",
      source: "ai-metrics",
      targetKind: "scorecard",
      targetRef: scorecard.scorecardId,
      value: scorecard.completionReady,
    }),
    annotation({
      metadata: { configSnapshotId: scorecard.configSnapshotId },
      name: "scorecard.total_score",
      optimization: "maximize",
      source: "ai-metrics",
      targetKind: "scorecard",
      targetRef: scorecard.scorecardId,
      value: scorecard.totalScore,
    }),
    ...pipe(
      scorecard.coverageGaps,
      A.map((gap) =>
        annotation({
          idSuffix: gap,
          metadata: { gap },
          name: "scorecard.gap",
          optimization: "minimize",
          source: "ai-metrics",
          targetKind: "scorecard",
          targetRef: scorecard.scorecardId,
          value: gap,
        })
      )
    ),
  ];
};

const workerAnnotations = (
  doctor: AgentEffectivenessDoctorReport
): ReadonlyArray<AgentEffectivenessPlannedAnnotation> => [
  annotation({
    metadata: { reportPathHash: "repo-relative-jsdoc-worker-eval-report" },
    name: "worker.completed_packets",
    optimization: "maximize",
    source: "jsdoc-worker-eval",
    targetKind: "worker-report",
    targetRef: "jsdoc-worker-eval-latest",
    value: doctor.jsdocWorkerEval.completedPackets,
  }),
  annotation({
    metadata: { reportPathHash: "repo-relative-jsdoc-worker-eval-report" },
    name: "worker.failed_packets",
    optimization: "minimize",
    source: "jsdoc-worker-eval",
    targetKind: "worker-report",
    targetRef: "jsdoc-worker-eval-latest",
    value: doctor.jsdocWorkerEval.failedPackets,
  }),
  ...pipe(
    doctor.jsdocWorkerEval.policyViolationCodes,
    A.map((code) =>
      annotation({
        idSuffix: code,
        metadata: { code },
        name: "worker.policy_violation",
        optimization: "minimize",
        source: "jsdoc-worker-eval",
        targetKind: "worker-report",
        targetRef: "jsdoc-worker-eval-latest",
        value: code,
      })
    )
  ),
];

const loopHealthAnnotations = (
  doctor: AgentEffectivenessDoctorReport
): ReadonlyArray<AgentEffectivenessPlannedAnnotation> => [
  annotation({
    name: "agent.loop.status",
    optimization: "maximize",
    source: "agent-effectiveness-doctor",
    targetKind: "loop",
    targetRef: "phase1",
    value: doctor.summary.status,
  }),
  annotation({
    name: "agent.loop.warning_count",
    optimization: "minimize",
    source: "agent-effectiveness-doctor",
    targetKind: "loop",
    targetRef: "phase1",
    value: A.length(doctor.summary.warnings),
  }),
  annotation({
    name: "agent.loop.unavailable_count",
    optimization: "minimize",
    source: "agent-effectiveness-doctor",
    targetKind: "loop",
    targetRef: "phase1",
    value: A.length(doctor.summary.unavailable),
  }),
];

const queryAnnotationRows = Effect.fn("AiMetrics.agentEffectiveness.queryAnnotationRows")(function* (
  input: AgentEffectivenessAnnotationPlanInput,
  doctor: AgentEffectivenessDoctorReport
) {
  if (doctor.aiMetrics.status === AgentEffectivenessStatus.Enum.unavailable) {
    return A.empty<AgentEffectivenessPlannedAnnotation>();
  }

  const duckdb = yield* DuckDb;
  const labelRows = yield* duckdb
    .query(
      `SELECT label_id      AS "labelId",
              agent_task_id AS "agentTaskId",
              rating::DOUBLE AS "rating", passed AS "passed",
              quality_gate  AS "qualityGate",
              intervention_count::INTEGER AS "interventionCount", follow_up_fix AS "followUpFix"
       FROM ai_metrics_outcome_labels
       ORDER BY labeled_at_epoch_ms DESC
         LIMIT $limit`,
      { limit: input.annotationLimit }
    )
    .pipe(Effect.flatMap(decodeOutcomeLabelAnnotationRows));
  const benchmarkRows = yield* duckdb
    .query(
      `SELECT benchmark_run_id   AS "benchmarkRunId",
              benchmark_case_id  AS "benchmarkCaseId",
              config_snapshot_id AS "configSnapshotId",
              elapsed_ms::DOUBLE AS "elapsedMs", passed AS "passed",
              quality_gate       AS "qualityGate"
       FROM ai_metrics_benchmark_runs
       ORDER BY recorded_at_epoch_ms DESC
         LIMIT $limit`,
      { limit: input.annotationLimit }
    )
    .pipe(Effect.flatMap(decodeBenchmarkRunAnnotationRows));
  const labelAnnotations = pipe(
    labelRows,
    A.flatMap((row) => [
      annotation({
        idSuffix: row.labelId,
        metadata: { labelId: row.labelId, qualityGate: row.qualityGate },
        name: "agent.outcome.passed",
        optimization: "maximize",
        source: "ai-metrics",
        targetKind: "agent-task",
        targetRef: row.agentTaskId,
        value: row.passed,
      }),
      annotation({
        idSuffix: row.labelId,
        metadata: { labelId: row.labelId, qualityGate: row.qualityGate },
        name: "agent.outcome.rating",
        optimization: "maximize",
        source: "ai-metrics",
        targetKind: "agent-task",
        targetRef: row.agentTaskId,
        value: row.rating,
      }),
      annotation({
        idSuffix: row.labelId,
        metadata: { labelId: row.labelId, qualityGate: row.qualityGate },
        name: "agent.interventions",
        optimization: "minimize",
        source: "ai-metrics",
        targetKind: "agent-task",
        targetRef: row.agentTaskId,
        value: row.interventionCount,
      }),
      annotation({
        idSuffix: row.labelId,
        metadata: { labelId: row.labelId, qualityGate: row.qualityGate },
        name: "agent.follow_up_fix",
        optimization: "minimize",
        source: "ai-metrics",
        targetKind: "agent-task",
        targetRef: row.agentTaskId,
        value: row.followUpFix,
      }),
    ])
  );
  const benchmarkAnnotations = pipe(
    benchmarkRows,
    A.flatMap((row) => [
      annotation({
        metadata: {
          benchmarkCaseId: row.benchmarkCaseId,
          configSnapshotId: row.configSnapshotId,
        },
        name: "benchmark.passed",
        optimization: "maximize",
        source: "ai-metrics",
        targetKind: "benchmark-run",
        targetRef: row.benchmarkRunId,
        value: row.passed,
      }),
      annotation({
        metadata: {
          benchmarkCaseId: row.benchmarkCaseId,
          configSnapshotId: row.configSnapshotId,
        },
        name: "benchmark.elapsed_ms",
        optimization: "minimize",
        source: "ai-metrics",
        targetKind: "benchmark-run",
        targetRef: row.benchmarkRunId,
        value: row.elapsedMs,
      }),
    ])
  );

  return [...labelAnnotations, ...benchmarkAnnotations];
});

/**
 * Build a sanitized local-only annotation plan.
 *
 * @effects
 * - Builds the doctor report, including its Phoenix, DuckDB, worker-eval, and clock reads.
 * - Reads outcome-label and benchmark-run rows from derived DuckDB storage when available.
 * - Performs no Phoenix mutation; the result is a local dry-run annotation plan.
 * @example
 * ```ts
 * import {
 *   AgentEffectivenessAnnotationPlanInput,
 *   AgentEffectivenessDoctorInput,
 *   makeAgentEffectivenessAnnotationPlan
 * } from "@beep/repo-ai-metrics"
 * import { Effect } from "effect"
 * const program = makeAgentEffectivenessAnnotationPlan(
 *   AgentEffectivenessAnnotationPlanInput.make({
 *     annotationLimit: 10,
 *     doctor: AgentEffectivenessDoctorInput.make({ noPhoenix: true })
 *   })
 * )
 * const annotationCount = Effect.map(program, (plan) => plan.annotations.length)
 * console.log(annotationCount)
 * ```
 * @category services
 * @since 0.0.0
 */
export const makeAgentEffectivenessAnnotationPlan: (
  input?: AgentEffectivenessAnnotationPlanInput
) => Effect.Effect<
  AgentEffectivenessAnnotationPlan,
  never,
  DuckDb | FileSystem.FileSystem | HttpClient.HttpClient | Path.Path
> = Effect.fn("AiMetrics.makeAgentEffectivenessAnnotationPlan")(function* (
  input: AgentEffectivenessAnnotationPlanInput = AgentEffectivenessAnnotationPlanInput.make({})
) {
  const doctor = yield* makeAgentEffectivenessDoctorReport(input.doctor);
  const storageAnnotations = yield* queryAnnotationRows(input, doctor).pipe(Effect.orElseSucceed(() => []));
  const annotations = [
    ...loopHealthAnnotations(doctor),
    ...sourceCoverageAnnotations(doctor),
    ...scorecardAnnotations(doctor),
    ...workerAnnotations(doctor),
    ...storageAnnotations,
  ];
  const generatedAt = yield* currentIsoTimestamp;

  return AgentEffectivenessAnnotationPlan.make({
    annotations,
    doctor,
    generatedAt,
    mutationPolicy: "local-only-no-phoenix-mutation",
    schemaVersion: "agent-effectiveness-annotation-plan/v1",
    summary: doctor.summary,
  });
});

const datasetNameFor = Match.type<AgentEffectivenessDatasetKind>().pipe(
  Match.when("agent-config-snapshots", () => "agent-config-snapshots-v1"),
  Match.when("agent-loop-health", () => "agent-loop-health-v1"),
  Match.when("agent-outcomes", () => "agent-outcomes-v1"),
  Match.when("jsdoc-worker-model-suitability", () => "jsdoc-worker-model-suitability-v1"),
  Match.when("source-coverage", () => "source-coverage-v1"),
  Match.exhaustive
);

const datasetExample = ({
  id,
  input,
  metadata = {},
  output = {},
  split = "current",
}: {
  readonly id: string;
  readonly input: Record<string, unknown>;
  readonly metadata?: Record<string, unknown>;
  readonly output?: Record<string, unknown>;
  readonly split?: string;
}): AgentEffectivenessDatasetExample =>
  AgentEffectivenessDatasetExample.make({
    id,
    input,
    metadata,
    output,
    split,
  });

const datasetSpec = ({
  description,
  examples,
  kind,
}: {
  readonly description: string;
  readonly examples: ReadonlyArray<AgentEffectivenessDatasetExample>;
  readonly kind: AgentEffectivenessDatasetKind;
}): AgentEffectivenessDatasetSpec =>
  AgentEffectivenessDatasetSpec.make({
    description,
    examples,
    kind,
    name: datasetNameFor(kind),
  });

const loopHealthDataset = (doctor: AgentEffectivenessDoctorReport): AgentEffectivenessDatasetSpec =>
  datasetSpec({
    description: "Aggregate loop health for the repo agent-effectiveness initiative.",
    examples: [
      datasetExample({
        id: "loop-health-current",
        input: {
          generatedAt: doctor.generatedAt,
          schemaVersion: doctor.schemaVersion,
          target: doctor.target,
        },
        output: {
          failureCount: A.length(doctor.summary.failures),
          status: doctor.summary.status,
          unavailableCount: A.length(doctor.summary.unavailable),
          warningCount: A.length(doctor.summary.warnings),
        },
      }),
    ],
    kind: "agent-loop-health",
  });

const outcomesDataset = (doctor: AgentEffectivenessDoctorReport): AgentEffectivenessDatasetSpec => {
  const scorecard = doctor.aiMetrics.latestScorecard;
  return datasetSpec({
    description: "Aggregate outcome-label and scorecard readiness evidence.",
    examples: [
      datasetExample({
        id: "agent-outcomes-current",
        input: {
          benchmarkRunCount: doctor.aiMetrics.benchmarkRunCount,
          labelCount: doctor.aiMetrics.labelCount,
        },
        output:
          scorecard === null
            ? { completionReady: false, scorecardPresent: false }
            : {
                completionReady: scorecard.completionReady,
                scorecardId: scorecard.scorecardId,
                scorecardPresent: true,
                totalScore: scorecard.totalScore,
              },
      }),
    ],
    kind: "agent-outcomes",
  });
};

const configSnapshotsDataset = (doctor: AgentEffectivenessDoctorReport): AgentEffectivenessDatasetSpec => {
  const forwarder = doctor.aiMetrics.latestForwarder;
  return datasetSpec({
    description: "Aggregate configuration snapshot evidence for ingested agent metrics.",
    examples: [
      datasetExample({
        id: "config-snapshot-current",
        input: {
          dataRoot: doctor.dataRoot,
          target: doctor.target,
        },
        output:
          forwarder === null
            ? { configSnapshotPresent: false }
            : {
                archiveObjectCount: forwarder.archiveObjectCount,
                configSnapshotId: forwarder.configSnapshotId,
                configSnapshotPresent: true,
                ingestRunId: forwarder.ingestRunId,
                turnCount: forwarder.turnCount,
              },
      }),
    ],
    kind: "agent-config-snapshots",
  });
};

const sourceCoverageDataset = (doctor: AgentEffectivenessDoctorReport): AgentEffectivenessDatasetSpec =>
  datasetSpec({
    description: "Aggregate source coverage evidence for local AI-metrics ingestion.",
    examples: pipe(
      doctor.aiMetrics.sourceCoverage,
      A.map((coverage) =>
        datasetExample({
          id: `source-coverage-${annotationIdSuffixPart(coverage.sourceKind)}`,
          input: {
            sourceKind: coverage.sourceKind,
          },
          output: {
            acceptedEvents: coverage.acceptedEvents,
            lastTimestamp: coverage.lastTimestamp,
            rejectedLines: coverage.rejectedLines,
            sourceFileCount: coverage.sourceFileCount,
            totalLines: coverage.totalLines,
          },
        })
      )
    ),
    kind: "source-coverage",
  });

const jsdocWorkerDataset = (doctor: AgentEffectivenessDoctorReport): AgentEffectivenessDatasetSpec =>
  datasetSpec({
    description: "Aggregate JSDoc worker-eval suitability evidence without raw draft bodies.",
    examples: [
      datasetExample({
        id: "jsdoc-worker-model-suitability-current",
        input: {
          reportPathHash: "repo-relative-jsdoc-worker-eval-report",
        },
        output: {
          completedPackets: doctor.jsdocWorkerEval.completedPackets,
          failedPackets: doctor.jsdocWorkerEval.failedPackets,
          policyViolationCodes: doctor.jsdocWorkerEval.policyViolationCodes,
          selectedPackets: doctor.jsdocWorkerEval.selectedPackets,
          status: doctor.jsdocWorkerEval.status,
          timedOutPackets: doctor.jsdocWorkerEval.timedOutPackets,
        },
      }),
    ],
    kind: "jsdoc-worker-model-suitability",
  });

/**
 * Build the Phoenix dataset bundle from a doctor report.
 *
 * @param doctor - Doctor report used to derive sanitized aggregate Phoenix datasets.
 * @returns Phoenix dataset bundle generated from the doctor report.
 * @example
 * ```ts
 * import {
 *   AgentEffectivenessDoctorInput,
 *   makeAgentEffectivenessDatasetBundle,
 *   makeAgentEffectivenessDoctorReport
 * } from "@beep/repo-ai-metrics"
 * import { Effect } from "effect"
 *
 * const program = makeAgentEffectivenessDoctorReport(
 *   AgentEffectivenessDoctorInput.make({ noPhoenix: true })
 * ).pipe(Effect.map(makeAgentEffectivenessDatasetBundle))
 * const datasetNames = Effect.map(program, (bundle) => bundle.datasets.map((dataset) => dataset.name))
 * console.log(datasetNames)
 * ```
 * @category services
 * @since 0.0.0
 */
export const makeAgentEffectivenessDatasetBundle: (
  doctor: AgentEffectivenessDoctorReport
) => AgentEffectivenessDatasetBundle = (doctor) =>
  AgentEffectivenessDatasetBundle.make({
    datasets: [
      loopHealthDataset(doctor),
      outcomesDataset(doctor),
      configSnapshotsDataset(doctor),
      sourceCoverageDataset(doctor),
      jsdocWorkerDataset(doctor),
    ],
    generatedAt: doctor.generatedAt,
    projectName: AGENT_EFFECTIVENESS_PHOENIX_PROJECT,
    schemaVersion: "agent-effectiveness-datasets/v1",
  });

/**
 * Build the repo-owned Phoenix prompt bundle.
 *
 * @param generatedAt - ISO timestamp to assign to the generated prompt bundle.
 * @returns Repo-owned Phoenix prompt bundle for agent-effectiveness review.
 * @example
 * ```ts
 * import { makeAgentEffectivenessPromptBundle } from "@beep/repo-ai-metrics"
 *
 * const bundle = makeAgentEffectivenessPromptBundle("2026-05-20T00:00:00.000Z")
 * const promptNames = bundle.prompts.map((prompt) => prompt.name)
 * console.log(promptNames)
 * ```
 * @category services
 * @since 0.0.0
 */
export const makeAgentEffectivenessPromptBundle: (generatedAt: string) => AgentEffectivenessPromptBundle = (
  generatedAt
) =>
  AgentEffectivenessPromptBundle.make({
    generatedAt,
    projectName: AGENT_EFFECTIVENESS_PHOENIX_PROJECT,
    prompts: [
      AgentEffectivenessPromptSpec.make({
        description: "Repo-owned review prompt for deterministic agent-effectiveness case summaries.",
        messages: [
          AgentEffectivenessPromptMessage.make({
            content: "You review sanitized aggregate agent-effectiveness evidence. Do not request raw transcripts.",
            role: "system",
          }),
          AgentEffectivenessPromptMessage.make({
            content: "Evaluate {{datasetName}} example {{exampleId}} using only aggregate fields.",
            role: "user",
          }),
        ],
        modelName: "gpt-4o-mini",
        name: "agent-effectiveness-review-evaluator-v1",
      }),
      AgentEffectivenessPromptSpec.make({
        description: "Repo-owned prompt for source coverage review over sanitized source aggregates.",
        messages: [
          AgentEffectivenessPromptMessage.make({
            content: "You review source coverage aggregates and identify coverage gaps.",
            role: "system",
          }),
          AgentEffectivenessPromptMessage.make({
            content: "Review source kind {{sourceKind}} with accepted event count {{acceptedEvents}}.",
            role: "user",
          }),
        ],
        modelName: "gpt-4o-mini",
        name: "agent-effectiveness-source-coverage-review-v1",
      }),
    ],
    schemaVersion: "agent-effectiveness-prompts/v1",
  });

/**
 * Build deterministic experiment specs from a dataset bundle.
 *
 * @param datasetBundle - Dataset bundle used to derive one experiment per dataset.
 * @returns Deterministic Phoenix experiment bundle for the supplied datasets.
 * @example
 * ```ts
 * import {
 *   AgentEffectivenessDatasetBundle,
 *   makeAgentEffectivenessExperimentBundle
 * } from "@beep/repo-ai-metrics"
 *
 * const datasetBundle = AgentEffectivenessDatasetBundle.make({
 *   datasets: [],
 *   generatedAt: "2026-05-20T00:00:00.000Z",
 *   projectName: "beep-agent-effectiveness",
 *   schemaVersion: "agent-effectiveness-datasets/v1"
 * })
 * const experimentBundle = makeAgentEffectivenessExperimentBundle(datasetBundle)
 * console.log(experimentBundle.experiments.length)
 * ```
 * @category services
 * @since 0.0.0
 */
export const makeAgentEffectivenessExperimentBundle: (
  datasetBundle: AgentEffectivenessDatasetBundle
) => AgentEffectivenessExperimentBundle = (datasetBundle) =>
  AgentEffectivenessExperimentBundle.make({
    experiments: pipe(
      datasetBundle.datasets,
      A.map((dataset) =>
        AgentEffectivenessExperimentSpec.make({
          datasetName: dataset.name,
          description: `Deterministic readback experiment for ${dataset.name}.`,
          metadata: {
            datasetKind: dataset.kind,
            projectName: datasetBundle.projectName,
            source: "agent-effectiveness-loop",
          },
          name: `${dataset.kind}-deterministic-v1`,
        })
      )
    ),
    generatedAt: datasetBundle.generatedAt,
    projectName: datasetBundle.projectName,
    schemaVersion: "agent-effectiveness-experiments/v1",
  });

const toPhoenixDatasetCreateInput = (dataset: AgentEffectivenessDatasetSpec): PhoenixDatasetCreateInput =>
  PhoenixDatasetCreateInput.make({
    description: dataset.description,
    examples: pipe(
      dataset.examples,
      A.map((example) =>
        PhoenixDatasetExample.make({
          id: example.id,
          input: example.input,
          metadata: example.metadata,
          output: example.output,
          splits: example.split,
        })
      )
    ),
    name: dataset.name,
  });

const datasetSelectorFor = (dataset: AgentEffectivenessDatasetSpec): PhoenixDatasetSelector =>
  PhoenixDatasetSelector.make({ kind: "dataset-name", value: dataset.name });

const phoenixNotFoundStatusPattern = /\b404\b/u;

const isDatasetNotFoundCause = (cause: string): boolean => {
  const normalized = Str.toLowerCase(cause);
  // Matches Phoenix SDK dataset miss messages (`Dataset with name ... not found`)
  // plus HTTP status messages such as `URL: 404 Not Found`.
  return Str.contains(normalized, "not found") || phoenixNotFoundStatusPattern.test(normalized);
};

const isDatasetNotFoundError = (error: PhoenixError): boolean =>
  error.operation === "getDatasetInfo" &&
  error.reason === "transport" &&
  pipe(O.fromUndefinedOr(error.cause), O.exists(isDatasetNotFoundCause));

const findPhoenixDatasetInfo = Effect.fn("AiMetrics.findPhoenixDatasetInfo")(function* (
  phoenix: PhoenixShape,
  selector: PhoenixDatasetSelector
) {
  return yield* phoenix.getDatasetInfo(selector).pipe(
    Effect.map(O.some),
    Effect.catchIf(isDatasetNotFoundError, () => Effect.succeed(O.none()))
  );
});

const syncPhoenixDataset = Effect.fn("AiMetrics.syncPhoenixDataset")(function* (
  phoenix: PhoenixShape,
  dataset: AgentEffectivenessDatasetSpec
) {
  const input = toPhoenixDatasetCreateInput(dataset);
  const selector = datasetSelectorFor(dataset);
  const existing = yield* findPhoenixDatasetInfo(phoenix, selector);

  if (O.isSome(existing)) {
    const appended = yield* phoenix.appendDatasetExamples(
      PhoenixDatasetAppendInput.make({
        dataset: selector,
        examples: input.examples,
      })
    );
    return {
      createExperiment: false,
      datasetId: appended.datasetId,
    };
  }

  const created = yield* phoenix.createDataset(input);
  return {
    createExperiment: true,
    datasetId: created.datasetId,
  };
});

const toPhoenixPromptCreateInput = (prompt: AgentEffectivenessPromptSpec): PhoenixPromptCreateInput =>
  PhoenixPromptCreateInput.make({
    description: prompt.description,
    metadata: {
      projectName: AGENT_EFFECTIVENESS_PHOENIX_PROJECT,
      source: "agent-effectiveness-loop",
    },
    modelName: prompt.modelName,
    name: prompt.name,
    template: pipe(
      prompt.messages,
      A.map((message) =>
        PhoenixPromptChatMessage.make({
          content: message.content,
          role: message.role,
        })
      )
    ),
    versionDescription: `${prompt.name} checked in by @beep/repo-ai-metrics.`,
  });

const isPhoenixAnnotationTargetKind = (value: string): value is PhoenixAnnotationTargetKindType =>
  PhoenixAnnotationTargetKind.is.span(value) ||
  PhoenixAnnotationTargetKind.is.session(value) ||
  PhoenixAnnotationTargetKind.is.trace(value);

const plannedAnnotationToPhoenix = (
  annotation: AgentEffectivenessPlannedAnnotation
): O.Option<PhoenixAnnotationInput> => {
  if (!isPhoenixAnnotationTargetKind(annotation.targetKind)) {
    return O.none();
  }

  const valueFields = P.isNumber(annotation.value)
    ? { score: annotation.value }
    : { label: P.isBoolean(annotation.value) ? (annotation.value ? "true" : "false") : annotation.value };

  return O.some(
    PhoenixAnnotationInput.make({
      identifier: annotation.annotationId,
      metadata: {
        optimization: annotation.optimization,
        source: annotation.source,
        ...annotation.metadata,
      },
      name: annotation.name,
      targetId: annotation.targetRef,
      targetKind: annotation.targetKind,
      ...valueFields,
    })
  );
};

const unconfirmedSyncResult = ({
  datasetBundle,
  dryRun,
  experimentBundle,
  mutationPolicy,
  phoenixAnnotations,
  plannedAnnotationCount,
  promptBundle,
  status,
}: {
  readonly datasetBundle: AgentEffectivenessDatasetBundle;
  readonly dryRun: boolean;
  readonly experimentBundle: AgentEffectivenessExperimentBundle;
  readonly mutationPolicy: string;
  readonly phoenixAnnotations: ReadonlyArray<PhoenixAnnotationInput>;
  readonly plannedAnnotationCount: number;
  readonly promptBundle: AgentEffectivenessPromptBundle;
  readonly status: AgentEffectivenessStatus;
}): AgentEffectivenessPhoenixSyncResult =>
  AgentEffectivenessPhoenixSyncResult.make({
    annotationCount: A.length(phoenixAnnotations),
    datasetCount: A.length(datasetBundle.datasets),
    dryRun,
    experimentCount: A.length(experimentBundle.experiments),
    mutationPolicy,
    promptCount: A.length(promptBundle.prompts),
    skippedAnnotationCount: plannedAnnotationCount - A.length(phoenixAnnotations),
    status,
    writtenDatasetIds: [],
    writtenExperimentIds: [],
    writtenPromptVersionIds: [],
  });

/**
 * Sync agent-effectiveness datasets, prompts, experiments, and resolved annotations to Phoenix.
 *
 * @remarks
 * This function defaults to dry-run. Live writes require
 * {@link AGENT_EFFECTIVENESS_PHOENIX_WRITE_CONFIRMATION}.
 * @effects
 * - In dry-run mode, reads local doctor and annotation evidence but does not mutate Phoenix.
 * - In confirmed live mode, creates or appends Phoenix datasets, creates prompts and experiments, and writes valid trace/session/span annotations.
 * - Blocks live writes unless the confirmation token matches {@link AGENT_EFFECTIVENESS_PHOENIX_WRITE_CONFIRMATION}.
 * @example
 * ```ts
 * import { AgentEffectivenessPhoenixSyncInput, syncAgentEffectivenessPhoenix } from "@beep/repo-ai-metrics"
 * import { Effect } from "effect"
 * const program = syncAgentEffectivenessPhoenix(
 *   AgentEffectivenessPhoenixSyncInput.make({ dryRun: true })
 * )
 * const mutationPolicy = Effect.map(program, (result) => result.mutationPolicy)
 * console.log(mutationPolicy)
 * ```
 * @category services
 * @since 0.0.0
 */
export const syncAgentEffectivenessPhoenix: (
  input?: AgentEffectivenessPhoenixSyncInput
) => Effect.Effect<
  AgentEffectivenessPhoenixSyncResult,
  AgentEffectivenessError,
  DuckDb | FileSystem.FileSystem | HttpClient.HttpClient | Path.Path | Phoenix
> = Effect.fn("AiMetrics.syncAgentEffectivenessPhoenix")(function* (
  input: AgentEffectivenessPhoenixSyncInput = AgentEffectivenessPhoenixSyncInput.make({})
) {
  const plan = yield* makeAgentEffectivenessAnnotationPlan(input.annotationPlan);
  const datasetBundle = makeAgentEffectivenessDatasetBundle(plan.doctor);
  const promptBundle = makeAgentEffectivenessPromptBundle(plan.generatedAt);
  const experimentBundle = makeAgentEffectivenessExperimentBundle(datasetBundle);
  const phoenixAnnotations = pipe(plan.annotations, A.map(plannedAnnotationToPhoenix), A.getSomes);
  const confirmed = !input.dryRun && input.confirmToken === AGENT_EFFECTIVENESS_PHOENIX_WRITE_CONFIRMATION;
  const annotationCheck = makeAgentEffectivenessAnnotationCheckReport(plan);

  if (annotationCheck.status === AgentEffectivenessStatus.Enum.failed) {
    return unconfirmedSyncResult({
      datasetBundle,
      dryRun: input.dryRun,
      experimentBundle,
      mutationPolicy: input.dryRun ? "dry-run-annotation-check-failed" : "blocked-annotation-check-failed",
      phoenixAnnotations,
      plannedAnnotationCount: A.length(plan.annotations),
      promptBundle,
      status: AgentEffectivenessStatus.Enum.failed,
    });
  }

  const datasetFindings = checkDatasetBundle(datasetBundle);
  if (A.isReadonlyArrayNonEmpty(datasetFindings)) {
    return unconfirmedSyncResult({
      datasetBundle,
      dryRun: input.dryRun,
      experimentBundle,
      mutationPolicy: input.dryRun ? "dry-run-dataset-check-failed" : "blocked-dataset-check-failed",
      phoenixAnnotations,
      plannedAnnotationCount: A.length(plan.annotations),
      promptBundle,
      status: AgentEffectivenessStatus.Enum.failed,
    });
  }

  if (input.dryRun) {
    return unconfirmedSyncResult({
      datasetBundle,
      dryRun: true,
      experimentBundle,
      mutationPolicy: "dry-run-no-phoenix-mutation",
      phoenixAnnotations,
      plannedAnnotationCount: A.length(plan.annotations),
      promptBundle,
      status: AgentEffectivenessStatus.Enum.passed,
    });
  }

  if (!confirmed) {
    return unconfirmedSyncResult({
      datasetBundle,
      dryRun: false,
      experimentBundle,
      mutationPolicy: "blocked-missing-confirmation-token",
      phoenixAnnotations,
      plannedAnnotationCount: A.length(plan.annotations),
      promptBundle,
      status: AgentEffectivenessStatus.Enum.failed,
    });
  }

  const phoenix = yield* Phoenix;
  const datasetResults = yield* Effect.forEach(
    datasetBundle.datasets,
    (dataset) => syncPhoenixDataset(phoenix, dataset),
    { concurrency: 1 }
  ).pipe(
    Effect.mapError((cause) =>
      AgentEffectivenessError.make({
        cause,
        message: "Failed to sync agent-effectiveness datasets to Phoenix.",
      })
    )
  );
  const promptResults = yield* Effect.forEach(
    promptBundle.prompts,
    (prompt) => phoenix.createPrompt(toPhoenixPromptCreateInput(prompt)),
    { concurrency: 1 }
  ).pipe(
    Effect.mapError((cause) =>
      AgentEffectivenessError.make({
        cause,
        message: "Failed to write agent-effectiveness prompts to Phoenix.",
      })
    )
  );
  const experimentResults = yield* Effect.forEach(
    pipe(
      datasetBundle.datasets,
      A.zip(datasetResults),
      A.map(([dataset, result]) =>
        result.createExperiment
          ? O.some({
              dataset,
              datasetId: result.datasetId,
            })
          : O.none()
      ),
      A.getSomes
    ),
    ({ dataset, datasetId }) =>
      phoenix.createExperiment(
        PhoenixExperimentCreateInput.make({
          datasetId,
          experimentDescription: `Deterministic readback experiment for ${dataset.name}.`,
          experimentMetadata: {
            datasetKind: dataset.kind,
            projectName: datasetBundle.projectName,
            source: "agent-effectiveness-loop",
          },
          experimentName: `${dataset.kind}-deterministic-v1`,
        })
      ),
    { concurrency: 1 }
  ).pipe(
    Effect.mapError((cause) =>
      AgentEffectivenessError.make({
        cause,
        message: "Failed to create agent-effectiveness Phoenix experiments.",
      })
    )
  );
  const annotationResults = yield* Effect.forEach(phoenixAnnotations, phoenix.addAnnotation, { concurrency: 1 }).pipe(
    Effect.mapError((cause) =>
      AgentEffectivenessError.make({
        cause,
        message: "Failed to write resolved agent-effectiveness annotations to Phoenix.",
      })
    )
  );

  return AgentEffectivenessPhoenixSyncResult.make({
    annotationCount: A.length(annotationResults),
    datasetCount: A.length(datasetResults),
    dryRun: false,
    experimentCount: A.length(experimentResults),
    mutationPolicy: "confirmed-phoenix-write",
    promptCount: A.length(promptResults),
    skippedAnnotationCount: A.length(plan.annotations) - A.length(phoenixAnnotations),
    status: AgentEffectivenessStatus.Enum.passed,
    writtenDatasetIds: pipe(
      datasetResults,
      A.map((result) => result.datasetId)
    ),
    writtenExperimentIds: pipe(
      experimentResults,
      A.map((result) => result.experimentId)
    ),
    writtenPromptVersionIds: pipe(
      promptResults,
      A.map((result) => result.promptVersionId)
    ),
  });
});

const forbiddenPatterns = [
  // Private home/user paths across platforms. Each leaks the local username (and
  // often project/customer directory names) and must be blocked before a dataset
  // is written to a remote Phoenix endpoint. Covers POSIX `/home/<user>`, macOS
  // `/Users/<user>`, Windows `<Drive>:\Users\<user>` (and forward-slash form),
  // tilde home (`~/` or `~user/`), and the `%USERPROFILE%`/`%HOMEPATH%` env refs.
  { code: "private-home-path", pattern: /\/home\/[A-Za-z0-9_.-]+/u },
  { code: "private-home-path", pattern: /\/Users\/[A-Za-z0-9_.-]+/u },
  { code: "private-home-path", pattern: /[A-Za-z]:[\\/]Users[\\/][A-Za-z0-9_.-]+/u },
  { code: "private-home-path", pattern: /(?:^|[\s"'`(=:])~[\\/]/u },
  { code: "private-home-path", pattern: /(?:^|[\s"'`(=:])~[A-Za-z0-9_.-]+[\\/]/u },
  { code: "private-home-path", pattern: /%(?:USERPROFILE|HOMEPATH|HOMEDRIVE)%/iu },
  { code: "onepassword-ref", pattern: /op:\/\//u },
  // Deliberately require assignment-shaped labels or key-like values here. Standalone words like TOKEN can appear
  // in benign policy/status labels, and broader matching produced false positives on metrics such as provider_model_token_cost.
  {
    code: "secret-shaped-value",
    pattern: /(?:\b(?:SECRET|TOKEN|API[_-]?KEY)\b\s*[=:]|sk-[A-Za-z0-9_-]{12,})/iu,
  },
  { code: "raw-worker-draft", pattern: /draftJsDoc|@example|```ts/u },
] as const;

const decodeUnknownRecordOption = S.decodeUnknownOption(UnknownRecord);
const maxPrivacyScanDepth = 16;

const checkText = (
  annotationId: string,
  value: string,
  subject = "Annotation"
): ReadonlyArray<AgentEffectivenessAnnotationCheckFinding> =>
  pipe(
    forbiddenPatterns,
    A.filter((entry) => entry.pattern.test(value)),
    A.map((entry) =>
      AgentEffectivenessAnnotationCheckFinding.make({
        annotationId,
        code: entry.code,
        message: `${subject} contains forbidden ${entry.code} content.`,
      })
    )
  );

const depthFinding = (subjectId: string, subject: string): ReadonlyArray<AgentEffectivenessAnnotationCheckFinding> => [
  AgentEffectivenessAnnotationCheckFinding.make({
    annotationId: subjectId,
    code: "max-nested-depth",
    message: `${subject} exceeds the maximum privacy scan depth.`,
  }),
];

function checkUnknownText(
  subjectId: string,
  value: unknown,
  subject: string,
  depth = 0
): ReadonlyArray<AgentEffectivenessAnnotationCheckFinding> {
  if (depth > maxPrivacyScanDepth) {
    return depthFinding(subjectId, subject);
  }

  if (P.isString(value)) {
    return checkText(subjectId, value, subject);
  }

  if (A.isArray(value)) {
    return pipe(
      value,
      A.flatMap((entry, index) => checkUnknownText(`${subjectId}[${index}]`, entry, subject, depth + 1))
    );
  }

  const record = decodeUnknownRecordOption(value);
  if (O.isSome(record)) {
    return checkRecordText(subjectId, record.value, subject, depth + 1);
  }

  return [];
}

function checkRecordText(
  subjectId: string,
  record: Readonly<Record<string, unknown>>,
  subject: string,
  depth = 0
): ReadonlyArray<AgentEffectivenessAnnotationCheckFinding> {
  if (depth > maxPrivacyScanDepth) {
    return depthFinding(subjectId, subject);
  }

  return pipe(
    R.toEntries(record),
    A.flatMap(([key, value]) => {
      const entryId = `${subjectId}.${key}`;
      return [...checkText(entryId, key, subject), ...checkUnknownText(entryId, value, subject, depth)];
    })
  );
}

const checkPlanPayload = (
  plan: AgentEffectivenessAnnotationPlan
): ReadonlyArray<AgentEffectivenessAnnotationCheckFinding> =>
  checkUnknownText("plan", decodeUnknownJsonSync(encodeAnnotationPlanJsonSync(plan)), "Plan payload");

const checkDatasetExample = (
  dataset: AgentEffectivenessDatasetSpec,
  example: AgentEffectivenessDatasetExample
): ReadonlyArray<AgentEffectivenessAnnotationCheckFinding> => {
  const subject = "Dataset example";
  const subjectId = `dataset:${dataset.name}:example:${example.id}`;
  return [
    ...checkText(subjectId, dataset.description, subject),
    ...checkText(subjectId, dataset.kind, subject),
    ...checkText(subjectId, dataset.name, subject),
    ...checkText(subjectId, example.id, subject),
    ...checkText(subjectId, example.split, subject),
    ...checkRecordText(subjectId, example.input, subject),
    ...checkRecordText(subjectId, example.metadata, subject),
    ...checkRecordText(subjectId, example.output, subject),
  ];
};

const checkDatasetBundle = (
  bundle: AgentEffectivenessDatasetBundle
): ReadonlyArray<AgentEffectivenessAnnotationCheckFinding> =>
  pipe(
    bundle.datasets,
    A.flatMap((dataset) =>
      pipe(
        dataset.examples,
        A.flatMap((example) => checkDatasetExample(dataset, example))
      )
    )
  );

const checkAnnotation = (
  annotation: AgentEffectivenessPlannedAnnotation
): ReadonlyArray<AgentEffectivenessAnnotationCheckFinding> => {
  const metadataFindings = pipe(
    R.toEntries(annotation.metadata),
    A.flatMap(([key, value]) => [
      ...checkText(annotation.annotationId, key),
      ...checkUnknownText(annotation.annotationId, value, "Annotation"),
    ])
  );
  const valueFindings = P.isString(annotation.value) ? checkText(annotation.annotationId, annotation.value) : [];
  return [
    ...checkText(annotation.annotationId, annotation.annotationId),
    ...checkText(annotation.annotationId, annotation.name),
    ...checkText(annotation.annotationId, annotation.source),
    ...checkText(annotation.annotationId, annotation.targetKind),
    ...checkText(annotation.annotationId, annotation.targetRef),
    ...metadataFindings,
    ...valueFindings,
  ];
};

const duplicateAnnotationIdFindings = (
  annotations: ReadonlyArray<AgentEffectivenessPlannedAnnotation>
): ReadonlyArray<AgentEffectivenessAnnotationCheckFinding> => {
  let seen = R.empty<string, true>();
  const duplicatedIds = pipe(
    annotations,
    A.filter((annotation) => {
      const duplicated = R.has(seen, annotation.annotationId);
      seen = R.set(seen, annotation.annotationId, true);
      return duplicated;
    }),
    A.map((annotation) => annotation.annotationId),
    A.dedupe
  );
  return pipe(
    duplicatedIds,
    A.map((annotationId) =>
      AgentEffectivenessAnnotationCheckFinding.make({
        annotationId,
        code: "duplicate-annotation-id",
        message: "Annotation id must be unique within the local plan.",
      })
    )
  );
};

/**
 * Check a local annotation plan for Phase 1 privacy and schema safety.
 *
 * @param plan - Local annotation plan to inspect for private or forbidden payload fields.
 * @returns Report-only validation summary that never mutates Phoenix or local evidence.
 * @example
 * ```ts
 * import {
 *   AgentEffectivenessAnnotationPlanInput,
 *   makeAgentEffectivenessAnnotationCheckReport,
 *   makeAgentEffectivenessAnnotationPlan
 * } from "@beep/repo-ai-metrics"
 * import { Effect } from "effect"
 *
 * const program = makeAgentEffectivenessAnnotationPlan(
 *   AgentEffectivenessAnnotationPlanInput.make({})
 * ).pipe(Effect.map(makeAgentEffectivenessAnnotationCheckReport))
 * const status = Effect.map(program, (report) => report.status)
 * console.log(status)
 * ```
 * @category services
 * @since 0.0.0
 */
export const makeAgentEffectivenessAnnotationCheckReport: (
  plan: AgentEffectivenessAnnotationPlan
) => AgentEffectivenessAnnotationCheckReport = (plan) => {
  const findings = [
    ...pipe(plan.annotations, A.flatMap(checkAnnotation)),
    ...checkPlanPayload(plan),
    ...duplicateAnnotationIdFindings(plan.annotations),
  ];
  return AgentEffectivenessAnnotationCheckReport.make({
    annotationCount: A.length(plan.annotations),
    findings,
    generatedAt: plan.generatedAt,
    schemaVersion: "agent-effectiveness-annotation-check/v1",
    status: A.isReadonlyArrayNonEmpty(findings)
      ? AgentEffectivenessStatus.Enum.failed
      : AgentEffectivenessStatus.Enum.passed,
  });
};

/**
 * Encode a doctor report as JSON.
 *
 * @example
 * ```ts
 * import {
 *   AgentEffectivenessDoctorInput,
 *   agentEffectivenessDoctorReportToJson,
 *   makeAgentEffectivenessDoctorReport
 * } from "@beep/repo-ai-metrics"
 * import { Effect } from "effect"
 *
 * const program = makeAgentEffectivenessDoctorReport(
 *   AgentEffectivenessDoctorInput.make({ noPhoenix: true })
 * ).pipe(Effect.flatMap(agentEffectivenessDoctorReportToJson))
 * const hasSchemaVersion = Effect.map(program, (json) => json.includes("agent-effectiveness-doctor/v1"))
 * console.log(hasSchemaVersion)
 * ```
 * @category encoding
 * @since 0.0.0
 */
export const agentEffectivenessDoctorReportToJson: (
  report: AgentEffectivenessDoctorReport
) => Effect.Effect<string, AgentEffectivenessError> = Effect.fn("AiMetrics.agentEffectivenessDoctorReportToJson")(
  (report) =>
    encodeDoctorReportJson(report).pipe(
      Effect.mapError((cause) =>
        AgentEffectivenessError.make({
          cause,
          message: "Failed to encode agent-effectiveness doctor report as JSON.",
        })
      )
    )
);

/**
 * Encode an annotation plan as JSON.
 *
 * @example
 * ```ts
 * import {
 *   AgentEffectivenessAnnotationPlanInput,
 *   agentEffectivenessAnnotationPlanToJson,
 *   makeAgentEffectivenessAnnotationPlan
 * } from "@beep/repo-ai-metrics"
 * import { Effect } from "effect"
 *
 * const program = makeAgentEffectivenessAnnotationPlan(
 *   AgentEffectivenessAnnotationPlanInput.make({})
 * ).pipe(Effect.flatMap(agentEffectivenessAnnotationPlanToJson))
 * const hasMutationPolicy = Effect.map(program, (json) => json.includes("local-only-no-phoenix-mutation"))
 * console.log(hasMutationPolicy)
 * ```
 * @category encoding
 * @since 0.0.0
 */
export const agentEffectivenessAnnotationPlanToJson: (
  plan: AgentEffectivenessAnnotationPlan
) => Effect.Effect<string, AgentEffectivenessError> = Effect.fn("AiMetrics.agentEffectivenessAnnotationPlanToJson")(
  (plan) =>
    encodeAnnotationPlanJson(plan).pipe(
      Effect.mapError((cause) =>
        AgentEffectivenessError.make({
          cause,
          message: "Failed to encode agent-effectiveness annotation plan as JSON.",
        })
      )
    )
);

/**
 * Encode an annotation-check report as JSON.
 *
 * @example
 * ```ts
 * import {
 *   AgentEffectivenessAnnotationCheckReport,
 *   agentEffectivenessAnnotationCheckReportToJson
 * } from "@beep/repo-ai-metrics"
 * import { Effect } from "effect"
 *
 * const report = AgentEffectivenessAnnotationCheckReport.make({
 *   annotationCount: 0,
 *   findings: [],
 *   generatedAt: "2026-05-20T00:00:00.000Z",
 *   schemaVersion: "agent-effectiveness-annotation-check/v1",
 *   status: "passed"
 * })
 * const json = Effect.runPromise(agentEffectivenessAnnotationCheckReportToJson(report))
 * console.log(json)
 * ```
 * @category encoding
 * @since 0.0.0
 */
export const agentEffectivenessAnnotationCheckReportToJson: (
  report: AgentEffectivenessAnnotationCheckReport
) => Effect.Effect<string, AgentEffectivenessError> = Effect.fn(
  "AiMetrics.agentEffectivenessAnnotationCheckReportToJson"
)((report) =>
  encodeAnnotationCheckJson(report).pipe(
    Effect.mapError((cause) =>
      AgentEffectivenessError.make({
        cause,
        message: "Failed to encode agent-effectiveness annotation-check report as JSON.",
      })
    )
  )
);

/**
 * Encode a dataset bundle as JSON.
 *
 * @example
 * ```ts
 * import {
 *   AgentEffectivenessDatasetBundle,
 *   agentEffectivenessDatasetBundleToJson
 * } from "@beep/repo-ai-metrics"
 * import { Effect } from "effect"
 *
 * const bundle = AgentEffectivenessDatasetBundle.make({
 *   datasets: [],
 *   generatedAt: "2026-05-20T00:00:00.000Z",
 *   projectName: "beep-agent-effectiveness",
 *   schemaVersion: "agent-effectiveness-datasets/v1"
 * })
 * const json = Effect.runPromise(agentEffectivenessDatasetBundleToJson(bundle))
 * console.log(json)
 * ```
 * @category encoding
 * @since 0.0.0
 */
export const agentEffectivenessDatasetBundleToJson: (
  bundle: AgentEffectivenessDatasetBundle
) => Effect.Effect<string, AgentEffectivenessError> = Effect.fn("AiMetrics.agentEffectivenessDatasetBundleToJson")(
  (bundle) =>
    encodeDatasetBundleJson(bundle).pipe(
      Effect.mapError((cause) =>
        AgentEffectivenessError.make({
          cause,
          message: "Failed to encode agent-effectiveness dataset bundle as JSON.",
        })
      )
    )
);

/**
 * Encode a prompt bundle as JSON.
 *
 * @example
 * ```ts
 * import {
 *   agentEffectivenessPromptBundleToJson,
 *   makeAgentEffectivenessPromptBundle
 * } from "@beep/repo-ai-metrics"
 * import { Effect } from "effect"
 *
 * const bundle = makeAgentEffectivenessPromptBundle("2026-05-20T00:00:00.000Z")
 * const json = Effect.runPromise(agentEffectivenessPromptBundleToJson(bundle))
 * console.log(json)
 * ```
 * @category encoding
 * @since 0.0.0
 */
export const agentEffectivenessPromptBundleToJson: (
  bundle: AgentEffectivenessPromptBundle
) => Effect.Effect<string, AgentEffectivenessError> = Effect.fn("AiMetrics.agentEffectivenessPromptBundleToJson")(
  (bundle) =>
    encodePromptBundleJson(bundle).pipe(
      Effect.mapError((cause) =>
        AgentEffectivenessError.make({
          cause,
          message: "Failed to encode agent-effectiveness prompt bundle as JSON.",
        })
      )
    )
);

/**
 * Encode an experiment bundle as JSON.
 *
 * @example
 * ```ts
 * import {
 *   AgentEffectivenessDatasetBundle,
 *   agentEffectivenessExperimentBundleToJson,
 *   makeAgentEffectivenessExperimentBundle
 * } from "@beep/repo-ai-metrics"
 * import { Effect } from "effect"
 *
 * const datasetBundle = AgentEffectivenessDatasetBundle.make({
 *   datasets: [],
 *   generatedAt: "2026-05-20T00:00:00.000Z",
 *   projectName: "beep-agent-effectiveness",
 *   schemaVersion: "agent-effectiveness-datasets/v1"
 * })
 * const bundle = makeAgentEffectivenessExperimentBundle(datasetBundle)
 * const json = Effect.runPromise(agentEffectivenessExperimentBundleToJson(bundle))
 * console.log(json)
 * ```
 * @category encoding
 * @since 0.0.0
 */
export const agentEffectivenessExperimentBundleToJson: (
  bundle: AgentEffectivenessExperimentBundle
) => Effect.Effect<string, AgentEffectivenessError> = Effect.fn("AiMetrics.agentEffectivenessExperimentBundleToJson")(
  (bundle) =>
    encodeExperimentBundleJson(bundle).pipe(
      Effect.mapError((cause) =>
        AgentEffectivenessError.make({
          cause,
          message: "Failed to encode agent-effectiveness experiment bundle as JSON.",
        })
      )
    )
);

/**
 * Encode a Phoenix sync result as JSON.
 *
 * @example
 * ```ts
 * import {
 *   AgentEffectivenessPhoenixSyncResult,
 *   agentEffectivenessPhoenixSyncResultToJson
 * } from "@beep/repo-ai-metrics"
 * import { Effect } from "effect"
 *
 * const result = AgentEffectivenessPhoenixSyncResult.make({
 *   annotationCount: 0,
 *   datasetCount: 0,
 *   dryRun: true,
 *   experimentCount: 0,
 *   mutationPolicy: "dry-run-no-phoenix-mutation",
 *   promptCount: 0,
 *   skippedAnnotationCount: 0,
 *   status: "passed",
 *   writtenDatasetIds: [],
 *   writtenExperimentIds: [],
 *   writtenPromptVersionIds: []
 * })
 * const json = Effect.runPromise(agentEffectivenessPhoenixSyncResultToJson(result))
 * console.log(json)
 * ```
 * @category encoding
 * @since 0.0.0
 */
export const agentEffectivenessPhoenixSyncResultToJson: (
  result: AgentEffectivenessPhoenixSyncResult
) => Effect.Effect<string, AgentEffectivenessError> = Effect.fn("AiMetrics.agentEffectivenessPhoenixSyncResultToJson")(
  (result) =>
    encodePhoenixSyncResultJson(result).pipe(
      Effect.mapError((cause) =>
        AgentEffectivenessError.make({
          cause,
          message: "Failed to encode agent-effectiveness Phoenix sync result as JSON.",
        })
      )
    )
);
