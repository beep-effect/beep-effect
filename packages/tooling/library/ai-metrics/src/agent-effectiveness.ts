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
import { Defect, LiteralKit, SchemaUtils, UnknownRecord } from "@beep/schema";
import { UnknownFromJsonString } from "@beep/schema/Unknown";
import { A, O, P, Str } from "@beep/utils";
import { DateTime, Duration, Effect, FileSystem, flow, HashMap, Match, Path, pipe, Result } from "effect";
import { dual } from "effect/Function";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as HttpClient from "effect/unstable/http/HttpClient";
import * as HttpClientRequest from "effect/unstable/http/HttpClientRequest";
import * as HttpClientResponse from "effect/unstable/http/HttpClientResponse";
import { AiMetricsDeployTarget, CountRow } from "./models.ts";
import type { PhoenixError, PhoenixShape } from "@beep/phoenix";

const $I = $RepoAiMetricsId.create("agent-effectiveness");
const defaultPhoenixBaseUrl = "https://dankserver.tailc7c348.ts.net:8447";
/**
 * Stable default pointer used to locate the latest checked-in JSDoc worker-eval evidence.
 *
 * **Details**
 *
 * The path stays repo-relative on purpose: worker-eval evidence is checked in and
 * travels with the clone, unlike the AI-metrics data root, which is resolved per
 * machine. It also points at the packet's manifest rather than a report, so the
 * doctor follows the manifest to whichever worker-eval report is newest instead
 * of pinning one filename that goes stale on the next run.
 *
 * **Example** (Confirming the doctor's default evidence pointer)
 *
 * ```ts
 * import {
 *   AgentEffectivenessDoctorInput,
 *   DEFAULT_AGENT_EFFECTIVENESS_WORKER_EVAL_REPORT_PATH
 * } from "@beep/repo-ai-metrics"
 *
 * const input = AgentEffectivenessDoctorInput.make({
 *   dataRoot: "/home/dev/.local/state/beep/ai-metrics"
 * })
 *
 * console.log(input.workerEvalReportPath === DEFAULT_AGENT_EFFECTIVENESS_WORKER_EVAL_REPORT_PATH) // true
 * ```
 *
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
        traceAnnotationsNames
        spanAnnotationNames
        sessionAnnotationNames
      }
    }
  }
}
`;

/**
 * Per-project aggregates, split out of the inventory query on purpose.
 *
 * `hasTraces`, `recordCount` and `traceCount` are aggregates over the spans
 * table. On a large store they do not return: measured against a 20 GiB
 * phoenix.db they exceeded 55s while the identity-only query above answered in
 * ~7ms. Because they were in the same document, one slow field took the whole
 * doctor's Phoenix section down to `unavailable` — the tool built to read
 * Phoenix could not read Phoenix precisely when there was most to read.
 *
 * Keeping them in a second, separately-timed request means a store too big to
 * aggregate degrades to "counts unavailable" instead of "Phoenix unavailable".
 */
const phoenixProjectStatsQuery = `
query AgentEffectivenessPhoenixProjectStats {
  projects(first: 20) {
    edges {
      node {
        name
        hasTraces
        recordCount
        traceCount
      }
    }
  }
}
`;

/**
 * Ceiling on the per-project aggregate query, in seconds.
 *
 * Deliberately short: these numbers are advisory, and the doctor is more useful
 * fast-and-partial than slow-and-complete.
 */
const phoenixProjectStatsTimeoutSeconds = 10;

const phoenixProjectStatsTimeout = Duration.seconds(phoenixProjectStatsTimeoutSeconds);

/**
 * Status emitted by agent-effectiveness reports.
 *
 * **Details**
 *
 * `unavailable` is distinct from `failed`: it means a section had no evidence to
 * judge — Phoenix was unreachable or disabled, derived storage was never built,
 * a worker-eval report was missing — whereas `failed` means evidence was read and
 * it was bad. The doctor is a report-only trust gate, so neither status blocks a
 * caller.
 *
 * **Gotchas**
 *
 * `unavailable` is a section status that never reaches a summary. Rolling
 * sections up yields `failed` when any section failed, `warning` when any section
 * warned *or* was unavailable, and `passed` otherwise — so missing evidence
 * surfaces as a summary warning, with the section itself naming what was absent.
 *
 * **Example** (Branching on a section status)
 *
 * ```ts
 * import { AgentEffectivenessStatus } from "@beep/repo-ai-metrics"
 *
 * console.log(AgentEffectivenessStatus.is.passed("passed")) // true
 * console.log(AgentEffectivenessStatus.Enum.unavailable) // unavailable
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AgentEffectivenessStatus = LiteralKit(["passed", "warning", "failed", "unavailable"]).pipe(
  $I.annoteSchema("AgentEffectivenessStatus", {
    description: "Non-blocking status used by agent-effectiveness trust-gate reports.",
  })
);

/**
 * Decoded status carried by every agent-effectiveness section and summary.
 *
 * **Details**
 *
 * The union of the four literals, so a variable of this type accepts any status
 * and the per-member guards on the runtime value narrow it further.
 *
 * @see {@link AgentEffectivenessStatus} for the runtime schema, its `Enum`, and its guards.
 * @category models
 * @since 0.0.0
 */
export type AgentEffectivenessStatus = typeof AgentEffectivenessStatus.Type;

/**
 * Optimization directions accepted by planned agent-effectiveness metrics.
 *
 * **Example** (Select a minimizing metric)
 *
 * ```ts
 * import { AgentEffectivenessAnnotationOptimization } from "@beep/repo-ai-metrics"
 *
 * console.log(AgentEffectivenessAnnotationOptimization.Enum.minimize) // minimize
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AgentEffectivenessAnnotationOptimization = LiteralKit(["maximize", "minimize"]).pipe(
  $I.annoteSchema("AgentEffectivenessAnnotationOptimization", {
    description: "Direction that counts as better for a planned agent-effectiveness metric.",
  })
);

/**
 * Decoded optimization direction carried by a planned annotation.
 *
 * @see {@link AgentEffectivenessAnnotationOptimization} for the runtime schema and literal helpers.
 * @category models
 * @since 0.0.0
 */
export type AgentEffectivenessAnnotationOptimization = typeof AgentEffectivenessAnnotationOptimization.Type;

/**
 * Local evidence targets that an annotation plan can describe.
 *
 * **Example** (Select an agent task target)
 *
 * ```ts
 * import { AgentEffectivenessAnnotationTargetKind } from "@beep/repo-ai-metrics"
 *
 * console.log(AgentEffectivenessAnnotationTargetKind.Enum["agent-task"]) // agent-task
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AgentEffectivenessAnnotationTargetKind = LiteralKit([
  "agent-task",
  "benchmark-run",
  "loop",
  "scorecard",
  "source",
  "worker-report",
]).pipe(
  $I.annoteSchema("AgentEffectivenessAnnotationTargetKind", {
    description: "Local evidence target kinds supported by an agent-effectiveness annotation plan.",
  })
);

/**
 * Decoded local target kind carried by a planned annotation.
 *
 * @see {@link AgentEffectivenessAnnotationTargetKind} for the runtime schema and literal helpers.
 * @category models
 * @since 0.0.0
 */
export type AgentEffectivenessAnnotationTargetKind = typeof AgentEffectivenessAnnotationTargetKind.Type;

/**
 * Repo-owned evidence sources that can produce planned annotations.
 *
 * **Example** (Select AI-metrics evidence)
 *
 * ```ts
 * import { AgentEffectivenessAnnotationSource } from "@beep/repo-ai-metrics"
 *
 * console.log(AgentEffectivenessAnnotationSource.Enum["ai-metrics"]) // ai-metrics
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AgentEffectivenessAnnotationSource = LiteralKit([
  "agent-effectiveness-doctor",
  "ai-metrics",
  "jsdoc-worker-eval",
]).pipe(
  $I.annoteSchema("AgentEffectivenessAnnotationSource", {
    description: "Repo-owned evidence sources that can produce planned agent-effectiveness annotations.",
  })
);

/**
 * Decoded evidence source carried by a planned annotation.
 *
 * @see {@link AgentEffectivenessAnnotationSource} for the runtime schema and literal helpers.
 * @category models
 * @since 0.0.0
 */
export type AgentEffectivenessAnnotationSource = typeof AgentEffectivenessAnnotationSource.Type;

/**
 * Mutation outcomes recorded by annotation plans and Phoenix sync attempts.
 *
 * **Example** (Record a dry run)
 *
 * ```ts
 * import { AgentEffectivenessMutationPolicy } from "@beep/repo-ai-metrics"
 *
 * console.log(AgentEffectivenessMutationPolicy.Enum["dry-run-no-phoenix-mutation"])
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AgentEffectivenessMutationPolicy = LiteralKit([
  "blocked-annotation-check-failed",
  "blocked-dataset-check-failed",
  "blocked-missing-confirmation-token",
  "confirmed-phoenix-write",
  "dry-run-annotation-check-failed",
  "dry-run-dataset-check-failed",
  "dry-run-no-phoenix-mutation",
  "local-only-no-phoenix-mutation",
]).pipe(
  $I.annoteSchema("AgentEffectivenessMutationPolicy", {
    description: "How an annotation plan or Phoenix sync result handled remote mutation.",
  })
);

/**
 * Decoded mutation outcome carried by a plan or sync result.
 *
 * @see {@link AgentEffectivenessMutationPolicy} for the runtime schema and literal helpers.
 * @category models
 * @since 0.0.0
 */
export type AgentEffectivenessMutationPolicy = typeof AgentEffectivenessMutationPolicy.Type;

/**
 * Stable codes emitted by the annotation privacy and schema check.
 *
 * **Example** (Identify a duplicate annotation)
 *
 * ```ts
 * import { AgentEffectivenessAnnotationCheckFindingCode } from "@beep/repo-ai-metrics"
 *
 * console.log(AgentEffectivenessAnnotationCheckFindingCode.Enum["duplicate-annotation-id"])
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AgentEffectivenessAnnotationCheckFindingCode = LiteralKit([
  "duplicate-annotation-id",
  "max-nested-depth",
  "onepassword-ref",
  "plan-encode-failed",
  "private-home-path",
  "raw-worker-draft",
  "secret-shaped-value",
]).pipe(
  $I.annoteSchema("AgentEffectivenessAnnotationCheckFindingCode", {
    description: "Closed finding codes emitted by the annotation privacy and schema check.",
  })
);

/**
 * Decoded code carried by an annotation-check finding.
 *
 * @see {@link AgentEffectivenessAnnotationCheckFindingCode} for the runtime schema and literal helpers.
 * @category models
 * @since 0.0.0
 */
export type AgentEffectivenessAnnotationCheckFindingCode = typeof AgentEffectivenessAnnotationCheckFindingCode.Type;

/**
 * Compatibility versions recognized for agent-effectiveness JSON artifacts.
 *
 * **Example** (Read the dataset artifact version)
 *
 * ```ts
 * import { AgentEffectivenessArtifactSchemaVersion } from "@beep/repo-ai-metrics"
 *
 * console.log(AgentEffectivenessArtifactSchemaVersion.Enum["agent-effectiveness-datasets/v1"])
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AgentEffectivenessArtifactSchemaVersion = LiteralKit([
  "agent-effectiveness-annotation-check/v1",
  "agent-effectiveness-annotation-plan/v1",
  "agent-effectiveness-datasets/v1",
  "agent-effectiveness-doctor/v1",
  "agent-effectiveness-experiments/v1",
  "agent-effectiveness-prompts/v1",
]).pipe(
  $I.annoteSchema("AgentEffectivenessArtifactSchemaVersion", {
    description: "Compatibility versions for persisted agent-effectiveness JSON artifacts.",
  })
);

/**
 * Decoded compatibility version carried by an agent-effectiveness artifact.
 *
 * @see {@link AgentEffectivenessArtifactSchemaVersion} for the runtime schema and literal helpers.
 * @category models
 * @since 0.0.0
 */
export type AgentEffectivenessArtifactSchemaVersion = typeof AgentEffectivenessArtifactSchemaVersion.Type;

/**
 * Primitive annotation value allowed in local Phase 1 plans.
 *
 * **Details**
 *
 * Annotation values are deliberately restricted to a string, a finite number, or
 * a boolean. Nested objects and arrays are excluded because a planned annotation
 * is scanned for forbidden tokens before it can be written, and a flat primitive
 * is scannable without walking arbitrary structure. Metrics land as finite
 * numbers, statuses as strings.
 *
 * **Example** (Checking a planned metric value)
 *
 * ```ts
 * import { AgentEffectivenessAnnotationValue } from "@beep/repo-ai-metrics"
 *
 * console.log(AgentEffectivenessAnnotationValue.is(0.98)) // true
 * console.log(AgentEffectivenessAnnotationValue.is({ score: 0.98 })) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AgentEffectivenessAnnotationValue = S.Union([S.String, S.Finite, S.Boolean]).pipe(
  $I.annoteSchema("AgentEffectivenessAnnotationValue", {
    description: "Sanitized primitive value allowed in an agent-effectiveness annotation plan.",
  }),
  SchemaUtils.withCodecStatics(["is"])
);

/**
 * Decoded value accepted by a planned annotation.
 *
 * **Details**
 *
 * `string | number | boolean`, narrowed from the schema union. A value of this
 * type still has to survive the plan's privacy check before it can be written,
 * so the type bounds shape rather than content.
 *
 * @see {@link AgentEffectivenessAnnotationValue} for the runtime schema and its guard.
 * @category models
 * @since 0.0.0
 */
export type AgentEffectivenessAnnotationValue = typeof AgentEffectivenessAnnotationValue.Type;

/**
 * Error raised by agent-effectiveness report helpers.
 *
 * **Details**
 *
 * This covers the encode and decode boundaries — rendering a report or plan as
 * JSON, and reading one back — rather than the doctor itself. Building a doctor
 * report never fails: an unreachable Phoenix or a missing worker-eval report
 * becomes an `unavailable` section, so the absence of evidence is reported rather
 * than raised.
 *
 * **Example** (Reporting a failed encode)
 *
 * ```ts
 * import { AgentEffectivenessError } from "@beep/repo-ai-metrics"
 *
 * const error = AgentEffectivenessError.make({
 *   cause: "decode failed",
 *   message: "Failed to encode agent-effectiveness evidence."
 * })
 *
 * console.log(error._tag) // AgentEffectivenessError
 * console.log(error.message)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class AgentEffectivenessError extends S.TaggedError<AgentEffectivenessError>($I`AgentEffectivenessError`)(
  "AgentEffectivenessError",
  {
    cause: Defect({ includeStack: true }),
    message: S.String,
  },
  $I.annoteError<AgentEffectivenessError>("AgentEffectivenessError", {
    description: "Typed failure raised while encoding or decoding agent-effectiveness reports.",
  })
) {}

const agentEffectivenessFailure =
  (message: string) =>
  (cause: unknown): AgentEffectivenessError =>
    AgentEffectivenessError.make({ cause, message });

/**
 * Input for the Phase 1 agent-effectiveness doctor.
 *
 * **Gotchas**
 *
 * `dataRoot` is required. The doctor reports on whichever store it is pointed
 * at, so a default here would let it certify a store nobody named; the CLI
 * resolves the root once, by precedence, through `resolveAiMetricsDataRoot`.
 *
 * **Example** (Pointing the doctor at a resolved store)
 *
 * ```ts
 * import { AgentEffectivenessDoctorInput } from "@beep/repo-ai-metrics"
 *
 * const input = AgentEffectivenessDoctorInput.make({
 *   dataRoot: "/home/dev/.local/state/beep/ai-metrics"
 * })
 *
 * console.log(input.target) // "dankserver"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AgentEffectivenessDoctorInput extends S.Class<AgentEffectivenessDoctorInput>(
  $I`AgentEffectivenessDoctorInput`
)(
  {
    dataRoot: S.String,
    noPhoenix: SchemaUtils.BoolKeyDefaultFalse,
    phoenixBaseUrl: S.String.pipe(SchemaUtils.withKeyDefaults(defaultPhoenixBaseUrl)),
    target: AiMetricsDeployTarget.pipe(SchemaUtils.withKeyDefaults(AiMetricsDeployTarget.Enum.dankserver)),
    workerEvalReportPath: S.String.pipe(
      SchemaUtils.withKeyDefaults(DEFAULT_AGENT_EFFECTIVENESS_WORKER_EVAL_REPORT_PATH)
    ),
  },
  $I.annote("AgentEffectivenessDoctorInput", {
    description: "Local, no-mutation inputs used to build the agent-effectiveness doctor report.",
  })
) {}

/**
 * Input for building a dry-run annotation plan.
 *
 * **Gotchas**
 *
 * `doctor` is required, and so is the data root it carries. Defaulting the
 * nested doctor input would reintroduce, one level down, the very thing the
 * data-root precedence removed: a plan built against a store nobody named.
 *
 * **Example** (Bounding a plan to a resolved store)
 *
 * ```ts
 * import { AgentEffectivenessAnnotationPlanInput, AgentEffectivenessDoctorInput } from "@beep/repo-ai-metrics"
 *
 * const input = AgentEffectivenessAnnotationPlanInput.make({
 *   doctor: AgentEffectivenessDoctorInput.make({
 *     dataRoot: "/home/dev/.local/state/beep/ai-metrics"
 *   })
 * })
 *
 * console.log(input.annotationLimit) // 50
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AgentEffectivenessAnnotationPlanInput extends S.Class<AgentEffectivenessAnnotationPlanInput>(
  $I`AgentEffectivenessAnnotationPlanInput`
)(
  {
    annotationLimit: S.Int.pipe(SchemaUtils.withKeyDefaults(defaultAnnotationLimit)),
    doctor: AgentEffectivenessDoctorInput,
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
 * **Details**
 *
 * A counts-and-names row read from Phoenix's GraphQL inventory: no span bodies,
 * prompts, or trace payloads cross into it. The three annotation-name arrays are
 * separate because Phoenix scopes annotations to traces, spans, and sessions
 * independently, and the doctor uses them to tell whether the repo's own
 * annotation names are already present on a project.
 *
 * **Gotchas**
 *
 * `hasTraces`, `recordCount`, and `traceCount` come from a separately-timed
 * aggregate query and are null when that query did not return — unmeasured, not
 * zero. The section's `message` names why it did not return.
 *
 * **Example** (Reading one project out of the inventory)
 *
 * ```ts
 * import { AgentEffectivenessPhoenixProject } from "@beep/repo-ai-metrics"
 *
 * const project = AgentEffectivenessPhoenixProject.make({
 *   name: "beep-agent-effectiveness",
 *   spanAnnotationNames: ["scorecard.total_score"],
 *   sessionAnnotationNames: [],
 *   traceAnnotationNames: ["agent.loop.status"],
 * })
 *
 * console.log(project.traceAnnotationNames) // [ "agent.loop.status" ]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AgentEffectivenessPhoenixProject extends S.Class<AgentEffectivenessPhoenixProject>(
  $I`AgentEffectivenessPhoenixProject`
)(
  {
    hasTraces: S.OptionFromNullOr(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    name: S.String,
    recordCount: S.OptionFromNullOr(S.Finite).pipe(SchemaUtils.withNoneDefault),
    spanAnnotationNames: S.Array(S.String),
    sessionAnnotationNames: S.Array(S.String),
    traceAnnotationNames: S.Array(S.String),
    traceCount: S.OptionFromNullOr(S.Finite).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("AgentEffectivenessPhoenixProject", {
    description: "Sanitized Phoenix project inventory row used by the agent-effectiveness doctor.",
  })
) {}

/**
 * Read-only Phoenix health and inventory section.
 *
 * **Details**
 *
 * Probing Phoenix only reads: two reachability `GET`s followed by one GraphQL
 * inventory query, never a mutation. `serverInsufficientStorage` is Phoenix's own
 * storage alarm, surfaced here because a Phoenix that still answers queries while
 * out of disk will drop later writes.
 *
 * **Gotchas**
 *
 * Every count is zero whenever the probe could not complete, so an unreachable
 * server and a genuinely empty one look alike in the numbers — read `status` and
 * `message` first, since they carry the distinction. `version` is read from the
 * `x-phoenix-server-version` response header and is therefore null for a
 * reachable server that does not send it, not only for an unreachable one.
 *
 * **Example** (Recording a reachable Phoenix)
 *
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
 * })
 *
 * console.log(section.status) // passed
 * ```
 *
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
    version: S.OptionFromNullOr(S.String).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("AgentEffectivenessPhoenixSection", {
    description: "Non-mutating Phoenix readiness section for the agent-effectiveness doctor.",
  })
) {}

/**
 * Source coverage row derived from AI-metrics storage.
 *
 * **Details**
 *
 * One row per transcript source kind, aggregated across every ingested file of
 * that kind. `acceptedEvents` against `totalLines` is the useful ratio: it says
 * how much of what was read the ingest pipeline could actually understand, which
 * is the early signal that a provider changed its transcript format.
 *
 * **Gotchas**
 *
 * `totalLines` counts non-empty transcript lines, not raw file lines — blanks are
 * stripped before anything is counted. `rejectedLines` is then derived as
 * `totalLines - acceptedEvents` rather than tallied on its own, so it means "not
 * decodable as an event" and lumps genuinely malformed lines together with
 * well-formed ones the decoder does not recognize.
 *
 * **Example** (Measuring how much of a source was understood)
 *
 * ```ts
 * import { AgentEffectivenessSourceCoverage } from "@beep/repo-ai-metrics"
 *
 * const coverage = AgentEffectivenessSourceCoverage.make({
 *   acceptedEvents: 48,
 *   rejectedLines: 2,
 *   sourceFileCount: 3,
 *   sourceKind: "codex",
 *   totalLines: 50
 * })
 *
 * console.log(coverage.acceptedEvents / coverage.totalLines) // 0.96
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AgentEffectivenessSourceCoverage extends S.Class<AgentEffectivenessSourceCoverage>(
  $I`AgentEffectivenessSourceCoverage`
)(
  {
    acceptedEvents: S.Finite,
    lastTimestamp: S.OptionFromNullOr(S.String).pipe(SchemaUtils.withNoneDefault),
    rejectedLines: S.Finite,
    sourceFileCount: S.Finite,
    sourceKind: S.String,
    totalLines: S.Finite,
  },
  $I.annote("AgentEffectivenessSourceCoverage", {
    description: "Aggregate source coverage for one transcript source kind.",
  })
) {
  static readonly decodeRowsEffect = S.decodeUnknownEffect(S.Array(AgentEffectivenessSourceCoverage));
}

/**
 * Latest forwarder summary from derived AI-metrics storage.
 *
 * **Details**
 *
 * The most recent completed ingest run, describing how much was taken in rather
 * than what it contained: file, archive-object, and turn counts, plus the
 * configuration snapshot that run was executed under. `configSnapshotId` is what
 * makes a run comparable to another — two runs with different snapshot ids were
 * produced by differently configured agents.
 *
 * **Example** (Reading the last completed ingest)
 *
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
 *
 * console.log(summary.turnCount) // 12
 * ```
 *
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
) {
  static readonly decodeRowsEffect = S.decodeUnknownEffect(S.Array(AgentEffectivenessForwarderSummary));
}

/**
 * Latest scorecard summary from derived AI-metrics storage.
 *
 * **Details**
 *
 * A scorecard grades a bounded window rather than all history, which is why the
 * window bounds travel with the score: `totalScore` is only meaningful alongside
 * the window and the `configSnapshotId` it was computed under. `completionReady`
 * is the scorecard's own judgment that it had enough labelled evidence to be
 * trusted, and `coverageGaps` names what was missing when it did not.
 *
 * **Gotchas**
 *
 * A low `totalScore` and an untrustworthy one are different problems. Check
 * `completionReady` before reading the score — a scorecard computed over too few
 * labels still reports a number.
 *
 * **Example** (Reading a window's score with its caveats)
 *
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
 *
 * console.log(summary.completionReady) // true
 * console.log(summary.coverageGaps.length) // 0
 * ```
 *
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
 * **Details**
 *
 * What the local derived store can currently answer. `unavailableMetrics` is the
 * honest half of the section: it names metrics the store cannot supply at all —
 * per-provider token cost, for instance — so a reader can tell a metric that is
 * zero from one that was never captured. `dataRoot` records which store was
 * consulted, since it is resolved per machine rather than fixed.
 *
 * **Gotchas**
 *
 * The section is reported as `unavailable` when derived storage does not exist
 * yet, and in that state every count is zero and both `latestForwarder` and
 * `latestScorecard` are null. That is "not built", not "built and empty".
 *
 * **Example** (Recording a store that was never derived)
 *
 * ```ts
 * import { AgentEffectivenessAiMetricsSection } from "@beep/repo-ai-metrics"
 *
 * const section = AgentEffectivenessAiMetricsSection.make({
 *   benchmarkRunCount: 0,
 *   dataRoot: "/home/dev/.local/state/beep/ai-metrics",
 *   derivedDuckDbPath: "/home/dev/.local/state/beep/ai-metrics/derived/ai-metrics.duckdb",
 *   labelCount: 0,
 *   message: "AI-metrics evidence has not been derived yet.",
 *   sourceCoverage: [],
 *   status: "unavailable",
 *   unavailableMetrics: ["provider_model_token_cost"]
 * })
 *
 * console.log(section.unavailableMetrics) // [ "provider_model_token_cost" ]
 * ```
 *
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
    latestForwarder: S.OptionFromNullOr(AgentEffectivenessForwarderSummary).pipe(SchemaUtils.withNoneDefault),
    latestScorecard: S.OptionFromNullOr(AgentEffectivenessScorecardSummary).pipe(SchemaUtils.withNoneDefault),
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
 * **Details**
 *
 * Read-only evidence from the last JSDoc worker-eval run. `selectedPackets`
 * against `completedPackets`, `failedPackets`, and `timedOutPackets` is the shape
 * that matters — a run that selected more packets than it completed left work
 * unaccounted for. `policyViolationCodes` carries codes rather than messages so
 * the section stays free of worker output text.
 *
 * **Gotchas**
 *
 * `reportPath` is the path actually read, which is not necessarily the path that
 * was requested: pointing the doctor at a packet manifest makes it follow the
 * manifest to the newest worker-eval report and record that resolved path here.
 * The cleanup and OTLP status fields are null when the run did not report them.
 *
 * **Example** (Recording a clean worker-eval run)
 *
 * ```ts
 * import { AgentEffectivenessJsdocWorkerSection } from "@beep/repo-ai-metrics"
 *
 * const section = AgentEffectivenessJsdocWorkerSection.make({
 *   completedPackets: 50,
 *   failedPackets: 0,
 *   message: "JSDoc worker-eval completed without policy violations.",
 *   policyViolationCodes: [],
 *   reportPath: "goals/jsdoc-worker-eval/ops/manifest.json",
 *   selectedPackets: 50,
 *   status: "passed",
 *   timedOutPackets: 0
 * })
 *
 * console.log(section.completedPackets === section.selectedPackets) // true
 * console.log(section.policyViolationCodes.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AgentEffectivenessJsdocWorkerSection extends S.Class<AgentEffectivenessJsdocWorkerSection>(
  $I`AgentEffectivenessJsdocWorkerSection`
)(
  {
    cleanupDeleteStatus: S.OptionFromNullOr(S.String).pipe(SchemaUtils.withNoneDefault),
    cleanupStopStatus: S.OptionFromNullOr(S.String).pipe(SchemaUtils.withNoneDefault),
    completedPackets: S.Finite,
    failedPackets: S.Finite,
    message: S.String,
    otlpStatus: S.OptionFromNullOr(S.String).pipe(SchemaUtils.withNoneDefault),
    policyViolationCodes: S.Array(S.String).pipe(SchemaUtils.withEmptyArrayDefaults<string>()),
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
 * **Details**
 *
 * Folds the three sections into one verdict plus the labelled messages behind it.
 * `status` is `failed` when any section failed, `warning` when any section warned
 * or was unavailable, and `passed` only when all three reported evidence and
 * liked it. Each entry is prefixed with its section label, so the summary alone
 * says which section is responsible.
 *
 * **Gotchas**
 *
 * A `warning` summary with an empty `warnings` array is normal, not a
 * contradiction: an unavailable section degrades the status while its message
 * lands in `unavailable`. Reading only `warnings` on a warning summary can
 * therefore turn up nothing.
 *
 * **Example** (Explaining a warning caused by a disabled probe)
 *
 * ```ts
 * import { AgentEffectivenessDoctorSummary } from "@beep/repo-ai-metrics"
 *
 * const summary = AgentEffectivenessDoctorSummary.make({
 *   failures: [],
 *   status: "warning",
 *   unavailable: ["phoenix: Phoenix probe disabled by --no-phoenix."],
 *   warnings: []
 * })
 *
 * console.log(summary.status) // warning
 * console.log(summary.unavailable[0]) // phoenix: Phoenix probe disabled by --no-phoenix.
 * ```
 *
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
 * **Details**
 *
 * The whole trust gate in one value: three independent evidence sections —
 * Phoenix, local AI-metrics storage, JSDoc worker-eval — plus the summary that
 * folds them. Building it mutates nothing and cannot fail, so a section that
 * could not be read reports itself as unavailable instead of collapsing the
 * report. `schemaVersion` is what lets a stored report be compared against one
 * produced by a later build.
 *
 * **Example** (Assembling a fully passing report)
 *
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
 *     dataRoot: "/home/dev/.local/state/beep/ai-metrics",
 *     derivedDuckDbPath: "/home/dev/.local/state/beep/ai-metrics/derived/ai-metrics.duckdb",
 *     labelCount: 0,
 *     message: "AI-metrics evidence is present.",
 *     sourceCoverage: [],
 *     status: "passed",
 *     unavailableMetrics: []
 *   }),
 *   dataRoot: "/home/dev/.local/state/beep/ai-metrics",
 *   generatedAt: "2026-05-20T00:00:00.000Z",
 *   jsdocWorkerEval: AgentEffectivenessJsdocWorkerSection.make({
 *     completedPackets: 1,
 *     failedPackets: 0,
 *     message: "JSDoc worker-eval completed.",
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
 *   }),
 *   schemaVersion: "agent-effectiveness-doctor/v1",
 *   summary,
 *   target: "dankserver"
 * })
 *
 * console.log(report.summary.status) // passed
 * console.log(report.aiMetrics.unavailableMetrics.length) // 0
 * ```
 *
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
    schemaVersion: S.Literals(
      AgentEffectivenessArtifactSchemaVersion.pickOptions(["agent-effectiveness-doctor/v1"])
    ).pipe(
      SchemaUtils.withConstantDefault(AgentEffectivenessArtifactSchemaVersion.Enum["agent-effectiveness-doctor/v1"])
    ),
    summary: AgentEffectivenessDoctorSummary,
    target: AiMetricsDeployTarget,
  },
  $I.annote("AgentEffectivenessDoctorReport", {
    description: "Report-only trust gate for repo agent-effectiveness evidence.",
  })
) {
  static readonly encodeJsonEffect = S.encodeUnknownEffect(S.fromJsonString(AgentEffectivenessDoctorReport));
}

/**
 * One local-only annotation row that could be written to Phoenix later.
 *
 * **Details**
 *
 * A planned annotation is inert: it describes a write without performing one.
 * `annotationId` is composed as `source:targetKind:targetRef:name` rather than
 * generated, which makes it stable across runs — replanning the same evidence
 * yields the same id, so a later write phase can be idempotent. `optimization`
 * records the direction that counts as better for the metric, since Phoenix
 * cannot infer that from a bare number.
 *
 * **Gotchas**
 *
 * `metadata` is a flat string-to-string record, and both it and `value` are
 * scanned for forbidden tokens before a plan is allowed to be written. Putting a
 * path or an operator-supplied string in metadata is what makes a plan fail its
 * own check.
 *
 * **Example** (Planning one scorecard annotation)
 *
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
 *
 * console.log(annotation.metadata.configSnapshotId) // config-1
 * console.log(annotation.value) // 0.91
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AgentEffectivenessPlannedAnnotation extends S.Class<AgentEffectivenessPlannedAnnotation>(
  $I`AgentEffectivenessPlannedAnnotation`
)(
  {
    annotationId: S.String,
    metadata: S.Record(S.String, S.String).pipe(SchemaUtils.withKeyDefaults({})),
    name: S.String,
    optimization: AgentEffectivenessAnnotationOptimization,
    source: AgentEffectivenessAnnotationSource,
    targetKind: AgentEffectivenessAnnotationTargetKind,
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
 * **Details**
 *
 * The plan carries the doctor report it was derived from, so a reviewer can see
 * the evidence and the annotations it produced in one value without re-running
 * the doctor. `mutationPolicy` records that this generation wrote nothing to
 * Phoenix — it is a claim about how the plan was produced, not a switch that
 * governs a later write.
 *
 * **Example** (Deriving a plan from passing evidence)
 *
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
 *     dataRoot: "/home/dev/.local/state/beep/ai-metrics",
 *     derivedDuckDbPath: "/home/dev/.local/state/beep/ai-metrics/derived/ai-metrics.duckdb",
 *     labelCount: 0,
 *     message: "AI-metrics evidence is present.",
 *     sourceCoverage: [],
 *     status: "passed",
 *     unavailableMetrics: []
 *   }),
 *   dataRoot: "/home/dev/.local/state/beep/ai-metrics",
 *   generatedAt: "2026-05-20T00:00:00.000Z",
 *   jsdocWorkerEval: AgentEffectivenessJsdocWorkerSection.make({
 *     completedPackets: 1,
 *     failedPackets: 0,
 *     message: "JSDoc worker-eval completed.",
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
 *
 * console.log(plan.annotations.length) // 1
 * console.log(plan.mutationPolicy) // local-only-no-phoenix-mutation
 * ```
 *
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
    mutationPolicy: AgentEffectivenessMutationPolicy,
    schemaVersion: S.Literals(
      AgentEffectivenessArtifactSchemaVersion.pickOptions(["agent-effectiveness-annotation-plan/v1"])
    ).pipe(
      SchemaUtils.withConstantDefault(
        AgentEffectivenessArtifactSchemaVersion.Enum["agent-effectiveness-annotation-plan/v1"]
      )
    ),
    summary: AgentEffectivenessDoctorSummary,
  },
  $I.annote("AgentEffectivenessAnnotationPlan", {
    description: "Local-only dry-run annotation plan for the agent-effectiveness loop.",
  })
) {
  static readonly encodeJsonEffect = S.encodeUnknownEffect(S.fromJsonString(AgentEffectivenessAnnotationPlan));
  static readonly encodeJsonResult = S.encodeUnknownResult(S.fromJsonString(AgentEffectivenessAnnotationPlan));
}

/**
 * One validation finding for an annotation plan.
 *
 * **Details**
 *
 * `code` names the class of problem — a private home path, a 1Password
 * reference, a secret-shaped value, raw worker draft text — so findings can be
 * counted and compared without parsing prose. `annotationId` locates the finding:
 * it is the offending annotation's id, or a synthetic subject such as
 * `plan.metadata` when the problem is in the plan envelope rather than in one row.
 *
 * **Gotchas**
 *
 * `message` names the class of content that matched and never quotes the match,
 * so a finding stays safe to print and log. Locating the actual offending text
 * means going back to the plan.
 *
 * **Example** (Reading a privacy finding)
 *
 * ```ts
 * import { AgentEffectivenessAnnotationCheckFinding } from "@beep/repo-ai-metrics"
 *
 * const finding = AgentEffectivenessAnnotationCheckFinding.make({
 *   annotationId: "plan.metadata",
 *   code: "private-home-path",
 *   message: "Plan payload contains forbidden private-home-path content."
 * })
 *
 * console.log(finding.code) // private-home-path
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AgentEffectivenessAnnotationCheckFinding extends S.Class<AgentEffectivenessAnnotationCheckFinding>(
  $I`AgentEffectivenessAnnotationCheckFinding`
)(
  {
    annotationId: S.String,
    code: AgentEffectivenessAnnotationCheckFindingCode,
    message: S.String,
  },
  $I.annote("AgentEffectivenessAnnotationCheckFinding", {
    description: "Privacy or schema finding emitted while checking a dry-run annotation plan.",
  })
) {}

/**
 * Report emitted by `agent-effectiveness annotations check`.
 *
 * **Details**
 *
 * The verdict on whether a plan is safe to write: `annotationCount` says how much
 * was inspected and `findings` says what was wrong with it. An empty `findings`
 * with a non-zero `annotationCount` is the meaningful pass — it distinguishes a
 * plan that was checked and cleared from an empty plan that had nothing to check.
 *
 * **Example** (Recording a plan that cleared its check)
 *
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
 *
 * console.log(report.status) // passed
 * console.log(report.findings.length) // 0
 * ```
 *
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
    schemaVersion: S.Literals(
      AgentEffectivenessArtifactSchemaVersion.pickOptions(["agent-effectiveness-annotation-check/v1"])
    ).pipe(
      SchemaUtils.withConstantDefault(
        AgentEffectivenessArtifactSchemaVersion.Enum["agent-effectiveness-annotation-check/v1"]
      )
    ),
    status: AgentEffectivenessStatus,
  },
  $I.annote("AgentEffectivenessAnnotationCheckReport", {
    description: "Report-only privacy/schema check result for a local annotation plan.",
  })
) {
  static readonly encodeJsonEffect = S.encodeUnknownEffect(S.fromJsonString(AgentEffectivenessAnnotationCheckReport));
}

/**
 * Dedicated Phoenix project namespace for the agent-effectiveness loop.
 *
 * **Details**
 *
 * The loop writes into a project of its own rather than into whichever project
 * happens to be receiving traces, so repo-owned datasets, prompts, and
 * experiments never mix with application telemetry. Every bundle this module
 * builds stamps this name into its `projectName`.
 *
 * **Example** (Finding the loop's own project in an inventory)
 *
 * ```ts
 * import { AGENT_EFFECTIVENESS_PHOENIX_PROJECT, AgentEffectivenessDatasetBundle } from "@beep/repo-ai-metrics"
 *
 * const bundle = AgentEffectivenessDatasetBundle.make({
 *   datasets: [],
 *   generatedAt: "2026-05-20T00:00:00.000Z",
 *   projectName: AGENT_EFFECTIVENESS_PHOENIX_PROJECT,
 *   schemaVersion: "agent-effectiveness-datasets/v1"
 * })
 *
 * console.log(bundle.projectName) // beep-agent-effectiveness
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const AGENT_EFFECTIVENESS_PHOENIX_PROJECT = "beep-agent-effectiveness";

/**
 * Confirmation token required before live Phoenix writes.
 *
 * **Details**
 *
 * Writing to Phoenix takes two independent acts: clearing the dry-run flag and
 * supplying this exact token. The token is a fixed, non-guessable-by-accident
 * string precisely so that a `dryRun: false` reached by a defaulted or
 * misremembered argument still cannot mutate a live Phoenix instance.
 *
 * **Example** (Arming a real write)
 *
 * ```ts
 * import {
 *   AGENT_EFFECTIVENESS_PHOENIX_WRITE_CONFIRMATION,
 *   AgentEffectivenessAnnotationPlanInput,
 *   AgentEffectivenessDoctorInput,
 *   AgentEffectivenessPhoenixSyncInput
 * } from "@beep/repo-ai-metrics"
 *
 * const input = AgentEffectivenessPhoenixSyncInput.make({
 *   annotationPlan: AgentEffectivenessAnnotationPlanInput.make({
 *     doctor: AgentEffectivenessDoctorInput.make({
 *       dataRoot: "/home/dev/.local/state/beep/ai-metrics"
 *     })
 *   }),
 *   confirmToken: AGENT_EFFECTIVENESS_PHOENIX_WRITE_CONFIRMATION,
 *   dryRun: false
 * })
 *
 * console.log(input.dryRun) // false
 * ```
 *
 * @see {@link AgentEffectivenessPhoenixSyncInput} for the sync input that consumes this token.
 * @category constants
 * @since 0.0.0
 */
export const AGENT_EFFECTIVENESS_PHOENIX_WRITE_CONFIRMATION = "agent-effectiveness-phoenix-write";

/**
 * Phoenix dataset kinds owned by the agent-effectiveness loop.
 *
 * **Details**
 *
 * A closed set, because these are the datasets the repo creates and keeps
 * current in Phoenix rather than an open catalogue of anything a caller might
 * upload. Each kind maps to one dataset the loop derives from doctor evidence,
 * and the kind is what names the dataset and its deterministic experiment.
 *
 * **Example** (Naming a dataset by its kind)
 *
 * ```ts
 * import { AgentEffectivenessDatasetKind } from "@beep/repo-ai-metrics"
 *
 * console.log(AgentEffectivenessDatasetKind.Enum["agent-loop-health"]) // agent-loop-health
 * console.log(AgentEffectivenessDatasetKind.Options.length) // 5
 * ```
 *
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
 * Decoded dataset kind carried by a dataset specification.
 *
 * **Details**
 *
 * The union of the five owned kinds. A value of this type is already known to
 * name a repo-owned dataset, so consumers can switch on it exhaustively without
 * a fallback branch.
 *
 * @see {@link AgentEffectivenessDatasetKind} for the runtime schema, its `Enum`, and its guards.
 * @category models
 * @since 0.0.0
 */
export type AgentEffectivenessDatasetKind = typeof AgentEffectivenessDatasetKind.Type;

/**
 * One sanitized example destined for a Phoenix dataset.
 *
 * **Details**
 *
 * Examples carry aggregates and statuses, never transcript content: the loop
 * publishes what the evidence measured, not what an agent said. `metadata`,
 * `output`, and `split` all default, so a row that only records an input needs
 * just `id` and `input`, and unlabelled rows land together in the `"current"`
 * split.
 *
 * **Example** (Recording a loop-health row)
 *
 * ```ts
 * import { AgentEffectivenessDatasetExample } from "@beep/repo-ai-metrics"
 *
 * const example = AgentEffectivenessDatasetExample.make({ id: "loop", input: { status: "passed" } })
 *
 * console.log(example.id) // loop
 * console.log(example.split) // current
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AgentEffectivenessDatasetExample extends S.Class<AgentEffectivenessDatasetExample>(
  $I`AgentEffectivenessDatasetExample`
)(
  {
    id: S.String,
    input: S.Record(S.String, S.Unknown),
    metadata: S.Record(S.String, S.Unknown).pipe(SchemaUtils.withKeyDefaults({})),
    output: S.Record(S.String, S.Unknown).pipe(SchemaUtils.withKeyDefaults({})),
    split: S.String.pipe(SchemaUtils.withKeyDefaults("current")),
  },
  $I.annote("AgentEffectivenessDatasetExample", {
    description: "Sanitized, aggregate-only example destined for a Phoenix dataset.",
  })
) {}

/**
 * One repo-owned Phoenix dataset specification.
 *
 * **Details**
 *
 * A dataset described in full — identity, prose, and rows — so that syncing is a
 * matter of applying the spec rather than assembling it against a live Phoenix.
 * `kind` is the closed classification and `name` is the versioned Phoenix
 * identity, which is why both exist: the kind survives a version bump of the
 * name.
 *
 * **Example** (Specifying an empty loop-health dataset)
 *
 * ```ts
 * import { AgentEffectivenessDatasetSpec } from "@beep/repo-ai-metrics"
 *
 * const spec = AgentEffectivenessDatasetSpec.make({
 *   description: "Loop health.",
 *   examples: [],
 *   kind: "agent-loop-health",
 *   name: "agent-loop-health-v1"
 * })
 *
 * console.log(spec.name) // agent-loop-health-v1
 * console.log(spec.kind) // agent-loop-health
 * ```
 *
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
 * **Details**
 *
 * Every dataset the loop owns, derived in one pass from a single doctor report,
 * so the bundle is a consistent snapshot rather than datasets assembled at
 * different moments. `generatedAt` timestamps the derivation and `projectName`
 * fixes which Phoenix project the whole bundle belongs to.
 *
 * **Example** (Describing a bundle's destination)
 *
 * ```ts
 * import { AgentEffectivenessDatasetBundle } from "@beep/repo-ai-metrics"
 *
 * const bundle = AgentEffectivenessDatasetBundle.make({
 *   datasets: [],
 *   generatedAt: "2026-05-20T00:00:00.000Z",
 *   projectName: "beep-agent-effectiveness",
 *   schemaVersion: "agent-effectiveness-datasets/v1"
 * })
 *
 * console.log(bundle.projectName) // beep-agent-effectiveness
 * ```
 *
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
    schemaVersion: S.Literals(
      AgentEffectivenessArtifactSchemaVersion.pickOptions(["agent-effectiveness-datasets/v1"])
    ).pipe(
      SchemaUtils.withConstantDefault(AgentEffectivenessArtifactSchemaVersion.Enum["agent-effectiveness-datasets/v1"])
    ),
  },
  $I.annote("AgentEffectivenessDatasetBundle", {
    description: "Full Phoenix dataset bundle derived from agent-effectiveness doctor evidence.",
  })
) {
  static readonly encodeJsonEffect = S.encodeUnknownEffect(S.fromJsonString(AgentEffectivenessDatasetBundle));
}

/**
 * Prompt roles used by repo-owned agent-effectiveness prompt templates.
 *
 * **Details**
 *
 * Only `system` and `user`. The repo authors prompt templates, never transcripts,
 * so there is no assistant role to represent — a stored template holds the
 * instruction and the question, and the model's reply belongs to an experiment
 * run rather than to the template.
 *
 * **Example** (Tagging a template message)
 *
 * ```ts
 * import { AgentEffectivenessPromptRole } from "@beep/repo-ai-metrics"
 *
 * console.log(AgentEffectivenessPromptRole.Enum.user) // user
 * console.log(AgentEffectivenessPromptRole.Options.length) // 2
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AgentEffectivenessPromptRole = LiteralKit(["system", "user"]).pipe(
  $I.annoteSchema("AgentEffectivenessPromptRole", {
    description: "Prompt roles used by repo-owned agent-effectiveness prompt templates.",
  })
);

/**
 * Decoded role carried by a prompt template message.
 *
 * **Details**
 *
 * `"system" | "user"`, so a message's role is exhaustively handled by two
 * branches with no assistant case to guard against.
 *
 * @see {@link AgentEffectivenessPromptRole} for the runtime schema, its `Enum`, and its guards.
 * @category models
 * @since 0.0.0
 */
export type AgentEffectivenessPromptRole = typeof AgentEffectivenessPromptRole.Type;

/**
 * One repo-owned Phoenix prompt message.
 *
 * **Details**
 *
 * `content` is a template rather than a finished prompt: `{{name}}` placeholders
 * are left intact for Phoenix to substitute at run time, which is what lets one
 * stored template serve every row of a dataset.
 *
 * **Example** (Authoring a templated user turn)
 *
 * ```ts
 * import { AgentEffectivenessPromptMessage } from "@beep/repo-ai-metrics"
 *
 * const message = AgentEffectivenessPromptMessage.make({ content: "Review {{caseId}}", role: "user" })
 *
 * console.log(message.role) // user
 * console.log(message.content.includes("{{caseId}}")) // true
 * ```
 *
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
 * **Details**
 *
 * The template plus the model it was written against. `modelName` travels with
 * the prompt because an evaluator prompt tuned for one model is not
 * interchangeable across models, and a stored version that lost its model would
 * not be reproducible.
 *
 * **Example** (Specifying an evaluator prompt)
 *
 * ```ts
 * import { AgentEffectivenessPromptSpec } from "@beep/repo-ai-metrics"
 *
 * const spec = AgentEffectivenessPromptSpec.make({
 *   description: "Review evaluator.",
 *   messages: [],
 *   modelName: "gpt-4o-mini",
 *   name: "agent-effectiveness-review-evaluator-v1"
 * })
 *
 * console.log(spec.name) // agent-effectiveness-review-evaluator-v1
 * ```
 *
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
 * **Details**
 *
 * Every prompt template the loop owns, generated together so the set stays
 * internally consistent. Unlike the dataset bundle, prompts are authored rather
 * than derived from doctor evidence, so this bundle's content does not change
 * with the state of the local store.
 *
 * **Example** (Describing a prompt bundle's destination)
 *
 * ```ts
 * import { AgentEffectivenessPromptBundle } from "@beep/repo-ai-metrics"
 *
 * const bundle = AgentEffectivenessPromptBundle.make({
 *   generatedAt: "2026-05-20T00:00:00.000Z",
 *   projectName: "beep-agent-effectiveness",
 *   prompts: [],
 *   schemaVersion: "agent-effectiveness-prompts/v1"
 * })
 *
 * console.log(bundle.projectName) // beep-agent-effectiveness
 * ```
 *
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
    schemaVersion: S.Literals(
      AgentEffectivenessArtifactSchemaVersion.pickOptions(["agent-effectiveness-prompts/v1"])
    ).pipe(
      SchemaUtils.withConstantDefault(AgentEffectivenessArtifactSchemaVersion.Enum["agent-effectiveness-prompts/v1"])
    ),
  },
  $I.annote("AgentEffectivenessPromptBundle", {
    description: "Full repo-owned Phoenix prompt bundle for the agent-effectiveness loop.",
  })
) {
  static readonly encodeJsonEffect = S.encodeUnknownEffect(S.fromJsonString(AgentEffectivenessPromptBundle));
}

/**
 * Deterministic experiment plan entry.
 *
 * **Details**
 *
 * A readback over an existing dataset: the experiment performs no new model work
 * and therefore costs nothing per run and returns the same result for the same
 * dataset. It exists so that evidence already in Phoenix is exercised through
 * the experiment surface without inference spend.
 *
 * **Example** (Planning a readback over one dataset)
 *
 * ```ts
 * import { AgentEffectivenessExperimentSpec } from "@beep/repo-ai-metrics"
 *
 * const spec = AgentEffectivenessExperimentSpec.make({
 *   datasetName: "agent-loop-health-v1",
 *   description: "Deterministic loop-health readback.",
 *   name: "agent-loop-health-deterministic-v1"
 * })
 *
 * console.log(spec.datasetName) // agent-loop-health-v1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AgentEffectivenessExperimentSpec extends S.Class<AgentEffectivenessExperimentSpec>(
  $I`AgentEffectivenessExperimentSpec`
)(
  {
    datasetName: S.String,
    description: S.String,
    metadata: S.Record(S.String, S.Unknown).pipe(SchemaUtils.withKeyDefaults({})),
    name: S.String,
  },
  $I.annote("AgentEffectivenessExperimentSpec", {
    description: "Deterministic experiment plan entry that performs no new model work.",
  })
) {}

/**
 * Deterministic experiment bundle derived from dataset specs.
 *
 * **Details**
 *
 * One experiment per dataset in the matching dataset bundle, which is why this
 * is derived rather than authored: the experiment set follows whatever datasets
 * were generated, and an experiment never outlives the dataset it reads.
 *
 * **Example** (Describing an experiment bundle's destination)
 *
 * ```ts
 * import { AgentEffectivenessExperimentBundle } from "@beep/repo-ai-metrics"
 *
 * const bundle = AgentEffectivenessExperimentBundle.make({
 *   experiments: [],
 *   generatedAt: "2026-05-20T00:00:00.000Z",
 *   projectName: "beep-agent-effectiveness",
 *   schemaVersion: "agent-effectiveness-experiments/v1"
 * })
 *
 * console.log(bundle.projectName) // beep-agent-effectiveness
 * ```
 *
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
    schemaVersion: S.Literals(
      AgentEffectivenessArtifactSchemaVersion.pickOptions(["agent-effectiveness-experiments/v1"])
    ).pipe(
      SchemaUtils.withConstantDefault(
        AgentEffectivenessArtifactSchemaVersion.Enum["agent-effectiveness-experiments/v1"]
      )
    ),
  },
  $I.annote("AgentEffectivenessExperimentBundle", {
    description: "Deterministic experiment bundle derived from agent-effectiveness dataset specs.",
  })
) {
  static readonly encodeJsonEffect = S.encodeUnknownEffect(S.fromJsonString(AgentEffectivenessExperimentBundle));
}

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
 * **Gotchas**
 *
 * `annotationPlan` is required all the way down to its doctor input's data
 * root. A Phoenix sync writes evidence derived from a local store, so the store
 * it reads is named by the operator rather than defaulted here.
 *
 * **Example** (Preparing a dry-run sync)
 *
 * ```ts
 * import {
 *   AgentEffectivenessAnnotationPlanInput,
 *   AgentEffectivenessDoctorInput,
 *   AgentEffectivenessPhoenixSyncInput
 * } from "@beep/repo-ai-metrics"
 *
 * const input = AgentEffectivenessPhoenixSyncInput.make({
 *   annotationPlan: AgentEffectivenessAnnotationPlanInput.make({
 *     doctor: AgentEffectivenessDoctorInput.make({
 *       dataRoot: "/home/dev/.local/state/beep/ai-metrics"
 *     })
 *   }),
 *   dryRun: true
 * })
 *
 * console.log(input.dryRun) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AgentEffectivenessPhoenixSyncInput extends S.Class<AgentEffectivenessPhoenixSyncInput>(
  $I`AgentEffectivenessPhoenixSyncInput`
)(
  {
    annotationPlan: AgentEffectivenessAnnotationPlanInput,
    confirmToken: S.String.pipe(S.optionalKey),
    dryRun: SchemaUtils.BoolKeyDefaultTrue,
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
 * **Details**
 *
 * The counts and the written ids answer different questions. Counts describe
 * what the sync considered; the `written*Ids` arrays describe what Phoenix
 * actually accepted, and they are empty on a dry run even when the counts are
 * not. `skippedAnnotationCount` covers planned annotations that could not be
 * expressed as Phoenix annotations — a target kind Phoenix does not model, for
 * instance — so a sync that wrote fewer annotations than it planned says so
 * rather than reporting a clean pass.
 *
 * **Example** (Reading back a dry run)
 *
 * ```ts
 * import { AgentEffectivenessPhoenixSyncResult } from "@beep/repo-ai-metrics"
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
 *
 * console.log(result.mutationPolicy) // dry-run-no-phoenix-mutation
 * console.log(result.writtenDatasetIds.length) // 0
 * ```
 *
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
    mutationPolicy: AgentEffectivenessMutationPolicy,
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
) {
  static readonly encodeJsonEffect = S.encodeUnknownEffect(S.fromJsonString(AgentEffectivenessPhoenixSyncResult));
}

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
) {
  static readonly decodeRowsEffect = S.decodeUnknownEffect(S.Array(ScorecardSummaryRow));
}

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
) {
  static readonly decodeRowsEffect = S.decodeUnknownEffect(S.Array(OutcomeLabelAnnotationRow));
}

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
) {
  static readonly decodeRowsEffect = S.decodeUnknownEffect(S.Array(BenchmarkRunAnnotationRow));
}

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
    policyViolationCodes: S.Array(S.String).pipe(SchemaUtils.withEmptyArrayDefaults<string>()),
  },
  $I.annote("WorkerEvalPacket", {
    description: "Internal minimal JSDoc worker-eval packet row.",
  })
) {}

class WorkerEvalReport extends S.Class<WorkerEvalReport>($I`WorkerEvalReport`)(
  {
    packets: S.Array(WorkerEvalPacket).pipe(SchemaUtils.withEmptyArrayDefaults<WorkerEvalPacket>()),
    policyViolations: S.Array(WorkerEvalPolicyViolation).pipe(
      SchemaUtils.withEmptyArrayDefaults<typeof WorkerEvalPolicyViolation.Type>()
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
) {
  static readonly decodeJsonEffect = S.decodeUnknownEffect(S.fromJsonString(RunpodWorkerEvalReport));
}

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
) {
  static readonly decodeJsonEffect = S.decodeUnknownEffect(S.fromJsonString(WorkerEvalManifest));
}

class PhoenixGraphqlProjectNode extends S.Class<PhoenixGraphqlProjectNode>($I`PhoenixGraphqlProjectNode`)(
  {
    name: S.String,
    spanAnnotationNames: S.Array(S.String),
    sessionAnnotationNames: S.Array(S.String),
    traceAnnotationsNames: S.Array(S.String),
  },
  $I.annote("PhoenixGraphqlProjectNode", {
    description: "Internal Phoenix GraphQL project node (identity and annotation names only).",
  })
) {}

class PhoenixGraphqlProjectStatsNode extends S.Class<PhoenixGraphqlProjectStatsNode>(
  $I`PhoenixGraphqlProjectStatsNode`
)(
  {
    hasTraces: S.Boolean,
    name: S.String,
    recordCount: S.Finite,
    traceCount: S.Finite,
  },
  $I.annote("PhoenixGraphqlProjectStatsNode", {
    description: "Internal Phoenix GraphQL per-project aggregate node.",
  })
) {}

class PhoenixGraphqlProjectStatsEdge extends S.Class<PhoenixGraphqlProjectStatsEdge>(
  $I`PhoenixGraphqlProjectStatsEdge`
)(
  {
    node: PhoenixGraphqlProjectStatsNode,
  },
  $I.annote("PhoenixGraphqlProjectStatsEdge", {
    description: "Internal Phoenix GraphQL per-project aggregate edge.",
  })
) {}

class PhoenixGraphqlProjectStatsConnection extends S.Class<PhoenixGraphqlProjectStatsConnection>(
  $I`PhoenixGraphqlProjectStatsConnection`
)(
  {
    edges: S.Array(PhoenixGraphqlProjectStatsEdge),
  },
  $I.annote("PhoenixGraphqlProjectStatsConnection", {
    description: "Internal Phoenix GraphQL per-project aggregate connection.",
  })
) {}

class PhoenixGraphqlProjectStatsData extends S.Class<PhoenixGraphqlProjectStatsData>(
  $I`PhoenixGraphqlProjectStatsData`
)(
  {
    projects: PhoenixGraphqlProjectStatsConnection,
  },
  $I.annote("PhoenixGraphqlProjectStatsData", {
    description: "Internal Phoenix GraphQL per-project aggregate payload.",
  })
) {}

class PhoenixGraphqlProjectStatsResponse extends S.Class<PhoenixGraphqlProjectStatsResponse>(
  $I`PhoenixGraphqlProjectStatsResponse`
)(
  {
    data: PhoenixGraphqlProjectStatsData,
  },
  $I.annote("PhoenixGraphqlProjectStatsResponse", {
    description: "Internal Phoenix GraphQL per-project aggregate response.",
  })
) {
  static readonly decodeEffect = S.decodeUnknownEffect(PhoenixGraphqlProjectStatsResponse);
}

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
) {
  static readonly decodeEffect = S.decodeUnknownEffect(PhoenixGraphqlResponse);
}

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

const dataRootDuckDbPath = (dataRoot: string): string => `${dataRoot}/derived/ai-metrics.duckdb`;
const unavailableAiMetrics = ["provider_model_token_cost"];
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

  const manifest = yield* readJsonFile(absolutePath).pipe(
    Effect.flatMap(WorkerEvalManifest.decodeJsonEffect),
    Effect.option
  );
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
  });

const buildAiMetricsUnavailable = (
  input: AgentEffectivenessDoctorInput,
  derivedDuckDbPath: string,
  message: string
): AgentEffectivenessAiMetricsSection =>
  AgentEffectivenessAiMetricsSection.make({
    benchmarkRunCount: 0,
    dataRoot: input.dataRoot,
    derivedDuckDbPath,
    labelCount: 0,
    message,
    sourceCoverage: [],
    status: AgentEffectivenessStatus.Enum.unavailable,
    unavailableMetrics: unavailableAiMetrics,
  });

const buildJsdocWorkerUnavailable = (reportPath: string, message: string): AgentEffectivenessJsdocWorkerSection =>
  AgentEffectivenessJsdocWorkerSection.make({
    completedPackets: 0,
    failedPackets: 0,
    message,
    reportPath,
    selectedPackets: 0,
    status: AgentEffectivenessStatus.Enum.unavailable,
    timedOutPackets: 0,
  });

const isReachableHttpStatus = (status: number): boolean => status >= 200 && status < 400;
const isOkHttpStatus = (status: number): boolean => status >= 200 && status < 300;

const probePhoenixEndpoints = Effect.fn("AiMetrics.agentEffectiveness.probePhoenixEndpoints")(function* (
  client: HttpClient.HttpClient,
  baseUrl: string
) {
  const root = yield* client.get(baseUrl).pipe(Effect.option);
  const projects = yield* client.get(`${baseUrl}/projects`).pipe(Effect.option);

  if (O.isNone(root) || O.isNone(projects)) {
    return { _tag: "Unavailable" as const, message: "Phoenix endpoint was not reachable." };
  }

  return isReachableHttpStatus(root.value.status) && isReachableHttpStatus(projects.value.status)
    ? { _tag: "Available" as const, projects: projects.value, root: root.value }
    : { _tag: "Unavailable" as const, message: "Phoenix endpoint returned a non-success status." };
});

const queryPhoenixInventory = Effect.fn("AiMetrics.agentEffectiveness.queryPhoenixInventory")(function* (
  client: HttpClient.HttpClient,
  baseUrl: string
) {
  const request = yield* HttpClientRequest.bodyJson(HttpClientRequest.post(`${baseUrl}/graphql`), {
    query: phoenixInventoryQuery,
  }).pipe(Effect.option);
  if (O.isNone(request)) {
    return { _tag: "Unavailable" as const, message: "Phoenix GraphQL request could not be encoded." };
  }

  const response = yield* client
    .execute(pipe(request.value, HttpClientRequest.accept("application/json")))
    .pipe(Effect.option);
  if (O.isNone(response) || !isOkHttpStatus(response.value.status)) {
    return { _tag: "Unavailable" as const, message: "Phoenix GraphQL inventory query failed." };
  }

  const inventory = yield* HttpClientResponse.schemaBodyJson(S.Unknown)(response.value).pipe(
    Effect.flatMap(PhoenixGraphqlResponse.decodeEffect),
    Effect.option
  );
  return O.match(inventory, {
    onNone: () => ({
      _tag: "Unavailable" as const,
      message: "Phoenix GraphQL inventory response could not be decoded.",
    }),
    onSome: (value) => ({ _tag: "Available" as const, value }),
  });
});

const queryPhoenixProjectStats = (client: HttpClient.HttpClient, baseUrl: string) =>
  HttpClientRequest.bodyJson(HttpClientRequest.post(`${baseUrl}/graphql`), {
    query: phoenixProjectStatsQuery,
  }).pipe(
    Effect.mapError(() => "the aggregate query could not be encoded"),
    Effect.flatMap((statsRequest) =>
      client
        .execute(pipe(statsRequest, HttpClientRequest.accept("application/json")))
        .pipe(Effect.mapError(() => "Phoenix could not be reached for the aggregate query"))
    ),
    Effect.filterOrFail(
      (statsResponse) => isOkHttpStatus(statsResponse.status),
      (statsResponse) => `Phoenix answered the aggregate query with HTTP ${statsResponse.status}`
    ),
    Effect.flatMap((statsResponse) =>
      HttpClientResponse.schemaBodyJson(S.Unknown)(statsResponse).pipe(
        Effect.flatMap(PhoenixGraphqlProjectStatsResponse.decodeEffect),
        Effect.mapError(() => "the aggregate response could not be decoded")
      )
    ),
    Effect.timeoutOption(phoenixProjectStatsTimeout),
    Effect.flatMap(
      O.match({
        onNone: () => Effect.fail(`the aggregate query exceeded its ${phoenixProjectStatsTimeoutSeconds}s budget`),
        onSome: Effect.succeed<PhoenixGraphqlProjectStatsResponse>,
      })
    ),
    Effect.result
  );

const phoenixReachableMessage = (statsUnmeasuredReason: O.Option<string>, hasTraceBearingProject: boolean): string =>
  pipe(
    statsUnmeasuredReason,
    O.match({
      onNone: () =>
        hasTraceBearingProject
          ? "Phoenix is reachable and has trace-bearing projects."
          : "Phoenix is reachable but no trace-bearing projects were reported.",
      onSome: (reason) => `Phoenix is reachable; per-project trace counts are unmeasured because ${reason}.`,
    })
  );

const probePhoenix = Effect.fn("AiMetrics.agentEffectiveness.probePhoenix")(function* (
  input: AgentEffectivenessDoctorInput
) {
  if (input.noPhoenix) {
    return buildPhoenixUnavailable(input, "Phoenix probe disabled by --no-phoenix.");
  }

  const client = yield* HttpClient.HttpClient;
  const endpoints = yield* probePhoenixEndpoints(client, input.phoenixBaseUrl);
  if (endpoints._tag === "Unavailable") {
    return buildPhoenixUnavailable(input, endpoints.message);
  }

  const inventory = yield* queryPhoenixInventory(client, input.phoenixBaseUrl);
  if (inventory._tag === "Unavailable") {
    return buildPhoenixUnavailable(input, inventory.message);
  }

  // Aggregates run as their own bounded request. A store too large to aggregate
  // must still yield a reachable, readable inventory, so every failure mode here
  // -- encode, transport, non-2xx, decode, timeout -- degrades the counts to
  // unmeasured rather than reporting Phoenix as down. Each mode carries its own
  // operator-facing reason: a single "timed out" label would send an operator
  // hunting store size when Phoenix actually rejected the query or was
  // unreachable.
  const stats = yield* queryPhoenixProjectStats(client, input.phoenixBaseUrl);

  const statsByProjectName = pipe(
    stats,
    Result.getSuccess,
    O.map((resolved) =>
      pipe(
        resolved.data.projects.edges,
        A.map((edge) => [edge.node.name, edge.node] as const),
        HashMap.fromIterable
      )
    )
  );

  const version = O.firstSomeOf([
    O.fromUndefinedOr(endpoints.root.headers["x-phoenix-server-version"]),
    O.fromUndefinedOr(endpoints.projects.headers["x-phoenix-server-version"]),
  ]);
  const data = inventory.value.data;
  const projectsList = pipe(
    data.projects.edges,
    A.map((edge) => {
      const nodeStats = pipe(statsByProjectName, O.flatMap(HashMap.get(edge.node.name)));
      return AgentEffectivenessPhoenixProject.make({
        hasTraces: pipe(
          nodeStats,
          O.map((resolved) => resolved.hasTraces)
        ),
        name: edge.node.name,
        recordCount: pipe(
          nodeStats,
          O.map((resolved) => resolved.recordCount)
        ),
        spanAnnotationNames: edge.node.spanAnnotationNames,
        sessionAnnotationNames: edge.node.sessionAnnotationNames,
        traceAnnotationNames: edge.node.traceAnnotationsNames,
        traceCount: pipe(
          nodeStats,
          O.map((resolved) => resolved.traceCount)
        ),
      });
    })
  );
  const statsUnmeasuredReason = Result.getFailure(stats);
  const hasTraceBearingProject = pipe(
    projectsList,
    A.some((project) =>
      pipe(
        project.hasTraces,
        O.getOrElse(() => false)
      )
    )
  );

  return AgentEffectivenessPhoenixSection.make({
    baseUrl: input.phoenixBaseUrl,
    datasetCount: data.datasetCount,
    evaluatorCount: data.evaluatorCount,
    message: phoenixReachableMessage(statsUnmeasuredReason, hasTraceBearingProject),
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
    .pipe(Effect.flatMap(AgentEffectivenessSourceCoverage.decodeRowsEffect));
  const forwarderRows = yield* duckdb
    .query(
      `SELECT ingest_run_id      AS "ingestRunId",
              target             AS "target",
              config_snapshot_id AS "configSnapshotId",
              completed_at_epoch_ms::DOUBLE AS "completedAtEpochMillis", source_file_count::INTEGER AS "sourceFileCount", archive_object_count::INTEGER AS "archiveObjectCount", turn_count::INTEGER AS "turnCount"
       FROM ai_metrics_ingest_runs
       ORDER BY completed_at_epoch_ms DESC LIMIT 1`
    )
    .pipe(Effect.flatMap(AgentEffectivenessForwarderSummary.decodeRowsEffect));
  const scorecardRows = yield* duckdb
    .query(
      `SELECT scorecard_id       AS "scorecardId",
              config_snapshot_id AS "configSnapshotId",
              window_start_epoch_ms::DOUBLE AS "windowStartEpochMillis", window_end_epoch_ms::DOUBLE AS "windowEndEpochMillis", total_score::DOUBLE AS "totalScore", task_count::INTEGER AS "taskCount", label_count::INTEGER AS "labelCount", benchmark_run_count::INTEGER AS "benchmarkRunCount", completion_ready AS "completionReady",
              coverage_gaps_json AS "coverageGapsJson"
       FROM ai_metrics_scorecards
       ORDER BY window_end_epoch_ms DESC LIMIT 1`
    )
    .pipe(Effect.flatMap(ScorecardSummaryRow.decodeRowsEffect));
  const labelCountRows = yield* duckdb
    .query(`SELECT count(*) ::INTEGER AS "count"
            FROM ai_metrics_outcome_labels`)
    .pipe(Effect.flatMap(CountRow.decodeRowsEffect));
  const benchmarkCountRows = yield* duckdb
    .query(`SELECT count(*) ::INTEGER AS "count"
            FROM ai_metrics_benchmark_runs`)
    .pipe(Effect.flatMap(CountRow.decodeRowsEffect));

  const latestScorecard = A.head(scorecardRows);
  const coverageGaps = yield* pipe(
    latestScorecard,
    O.map((scorecard) =>
      decodeCoverageGapsJson(scorecard.coverageGapsJson).pipe(
        Effect.orElseSucceed(() => ["invalid_coverage_gaps_json"])
      )
    ),
    O.getOrElse(() => Effect.succeed(A.empty<string>()))
  );
  const scorecard = pipe(
    latestScorecard,
    O.map((latest) =>
      AgentEffectivenessScorecardSummary.make({
        benchmarkRunCount: latest.benchmarkRunCount,
        completionReady: latest.completionReady,
        configSnapshotId: latest.configSnapshotId,
        coverageGaps,
        labelCount: latest.labelCount,
        scorecardId: latest.scorecardId,
        taskCount: latest.taskCount,
        totalScore: latest.totalScore,
        windowEndEpochMillis: latest.windowEndEpochMillis,
        windowStartEpochMillis: latest.windowStartEpochMillis,
      })
    )
  );
  const sourceCoverage = sourceRows;
  const latestForwarder = A.head(forwarderRows);
  const labelCount = A.head(labelCountRows).pipe(
    O.map((row) => row.count),
    O.getOrElse(() => 0)
  );
  const benchmarkRunCount = A.head(benchmarkCountRows).pipe(
    O.map((row) => row.count),
    O.getOrElse(() => 0)
  );
  const missingCore = O.isNone(latestForwarder) || O.isNone(scorecard) || A.isReadonlyArrayEmpty(sourceCoverage);
  const readinessWarnings = pipe(
    scorecard,
    O.match({
      onNone: () => ["no_scorecard"],
      onSome: (latest) => [
        ...(latest.completionReady ? [] : ["scorecard_not_completion_ready"]),
        ...(latest.labelCount > 0 ? [] : ["no_labels"]),
        ...(latest.benchmarkRunCount > 0 ? [] : ["no_benchmark_runs"]),
        ...latest.coverageGaps,
      ],
    })
  );

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
    unavailableMetrics: unavailableAiMetrics,
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
    return buildAiMetricsUnavailable(
      input,
      duckDbPath,
      "AI-metrics DuckDB evidence was not found at the selected data root."
    );
  }

  return yield* queryAiMetricsSection(input, duckDbPath).pipe(
    Effect.orElseSucceed(() =>
      buildAiMetricsUnavailable(input, duckDbPath, "AI-metrics DuckDB evidence could not be queried.")
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
    return buildJsdocWorkerUnavailable(reportPath, "JSDoc worker-eval report was not found.");
  }

  const decoded = yield* readJsonFile(reportPath).pipe(
    Effect.flatMap(RunpodWorkerEvalReport.decodeJsonEffect),
    Effect.option
  );

  if (O.isNone(decoded)) {
    return buildJsdocWorkerUnavailable(reportPath, "JSDoc worker-eval report could not be decoded.");
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
    cleanupDeleteStatus: O.some(decoded.value.cleanup.deleteStatus),
    cleanupStopStatus: O.some(decoded.value.cleanup.stopStatus),
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
    otlpStatus: O.some(decoded.value.otlp.status),
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
 * **Details**
 *
 * The three evidence sections are probed concurrently and each absorbs its own
 * failure, which is why the error channel is `never`: an unreachable Phoenix, a
 * store that was never derived, and a missing worker-eval report all become
 * `unavailable` sections rather than a failed effect. The summary is then folded
 * from whatever the sections reported.
 *
 * **Gotchas**
 *
 * A successful effect is not a passing report. The verdict lives in
 * `summary.status`, so a caller that only checks for success will treat a
 * `failed` doctor as fine.
 *
 * **Example** (Running the doctor with the Phoenix probe disabled)
 *
 * ```ts
 * import { AgentEffectivenessDoctorInput, makeAgentEffectivenessDoctorReport } from "@beep/repo-ai-metrics"
 * import { Effect } from "effect"
 *
 * const dataRoot = "/home/dev/.local/state/beep/ai-metrics"
 *
 * const status = makeAgentEffectivenessDoctorReport(
 *   AgentEffectivenessDoctorInput.make({ dataRoot, noPhoenix: true })
 * ).pipe(Effect.map((report) => report.summary.status))
 *
 * console.log(Effect.isEffect(status)) // true
 * ```
 *
 * @effects Reads Phoenix health and GraphQL inventory unless `noPhoenix` disables the probe, the
 * local AI-metrics DuckDB file when derived storage exists, and the worker-eval manifest or report
 * at the selected path. Writes nothing.
 * @category services
 * @since 0.0.0
 */
export const makeAgentEffectivenessDoctorReport: (
  input: AgentEffectivenessDoctorInput
) => Effect.Effect<
  AgentEffectivenessDoctorReport,
  never,
  DuckDb | FileSystem.FileSystem | HttpClient.HttpClient | Path.Path
> = Effect.fn("AiMetrics.makeAgentEffectivenessDoctorReport")(function* (input: AgentEffectivenessDoctorInput) {
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
  readonly optimization: AgentEffectivenessAnnotationOptimization;
  readonly source: AgentEffectivenessAnnotationSource;
  readonly targetKind: AgentEffectivenessAnnotationTargetKind;
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
        optimization: AgentEffectivenessAnnotationOptimization.Enum.maximize,
        source: AgentEffectivenessAnnotationSource.Enum["ai-metrics"],
        targetKind: AgentEffectivenessAnnotationTargetKind.Enum.source,
        targetRef: coverage.sourceKind,
        value: coverage.sourceFileCount,
      }),
      annotation({
        metadata: { sourceKind: coverage.sourceKind },
        name: "agent.source.accepted_events",
        optimization: AgentEffectivenessAnnotationOptimization.Enum.maximize,
        source: AgentEffectivenessAnnotationSource.Enum["ai-metrics"],
        targetKind: AgentEffectivenessAnnotationTargetKind.Enum.source,
        targetRef: coverage.sourceKind,
        value: coverage.acceptedEvents,
      }),
    ])
  );

const scorecardAnnotations = (
  doctor: AgentEffectivenessDoctorReport
): ReadonlyArray<AgentEffectivenessPlannedAnnotation> =>
  pipe(
    doctor.aiMetrics.latestScorecard,
    O.match({
      onNone: A.empty<AgentEffectivenessPlannedAnnotation>,
      onSome: (scorecard) => [
        annotation({
          metadata: { configSnapshotId: scorecard.configSnapshotId },
          name: "scorecard.completion_ready",
          optimization: AgentEffectivenessAnnotationOptimization.Enum.maximize,
          source: AgentEffectivenessAnnotationSource.Enum["ai-metrics"],
          targetKind: AgentEffectivenessAnnotationTargetKind.Enum.scorecard,
          targetRef: scorecard.scorecardId,
          value: scorecard.completionReady,
        }),
        annotation({
          metadata: { configSnapshotId: scorecard.configSnapshotId },
          name: "scorecard.total_score",
          optimization: AgentEffectivenessAnnotationOptimization.Enum.maximize,
          source: AgentEffectivenessAnnotationSource.Enum["ai-metrics"],
          targetKind: AgentEffectivenessAnnotationTargetKind.Enum.scorecard,
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
              optimization: AgentEffectivenessAnnotationOptimization.Enum.minimize,
              source: AgentEffectivenessAnnotationSource.Enum["ai-metrics"],
              targetKind: AgentEffectivenessAnnotationTargetKind.Enum.scorecard,
              targetRef: scorecard.scorecardId,
              value: gap,
            })
          )
        ),
      ],
    })
  );

const workerAnnotations = (
  doctor: AgentEffectivenessDoctorReport
): ReadonlyArray<AgentEffectivenessPlannedAnnotation> => [
  annotation({
    metadata: { reportPathHash: "repo-relative-jsdoc-worker-eval-report" },
    name: "worker.completed_packets",
    optimization: AgentEffectivenessAnnotationOptimization.Enum.maximize,
    source: AgentEffectivenessAnnotationSource.Enum["jsdoc-worker-eval"],
    targetKind: AgentEffectivenessAnnotationTargetKind.Enum["worker-report"],
    targetRef: "jsdoc-worker-eval-latest",
    value: doctor.jsdocWorkerEval.completedPackets,
  }),
  annotation({
    metadata: { reportPathHash: "repo-relative-jsdoc-worker-eval-report" },
    name: "worker.failed_packets",
    optimization: AgentEffectivenessAnnotationOptimization.Enum.minimize,
    source: AgentEffectivenessAnnotationSource.Enum["jsdoc-worker-eval"],
    targetKind: AgentEffectivenessAnnotationTargetKind.Enum["worker-report"],
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
        optimization: AgentEffectivenessAnnotationOptimization.Enum.minimize,
        source: AgentEffectivenessAnnotationSource.Enum["jsdoc-worker-eval"],
        targetKind: AgentEffectivenessAnnotationTargetKind.Enum["worker-report"],
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
    optimization: AgentEffectivenessAnnotationOptimization.Enum.maximize,
    source: AgentEffectivenessAnnotationSource.Enum["agent-effectiveness-doctor"],
    targetKind: AgentEffectivenessAnnotationTargetKind.Enum.loop,
    targetRef: "phase1",
    value: doctor.summary.status,
  }),
  annotation({
    name: "agent.loop.warning_count",
    optimization: AgentEffectivenessAnnotationOptimization.Enum.minimize,
    source: AgentEffectivenessAnnotationSource.Enum["agent-effectiveness-doctor"],
    targetKind: AgentEffectivenessAnnotationTargetKind.Enum.loop,
    targetRef: "phase1",
    value: A.length(doctor.summary.warnings),
  }),
  annotation({
    name: "agent.loop.unavailable_count",
    optimization: AgentEffectivenessAnnotationOptimization.Enum.minimize,
    source: AgentEffectivenessAnnotationSource.Enum["agent-effectiveness-doctor"],
    targetKind: AgentEffectivenessAnnotationTargetKind.Enum.loop,
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
    .pipe(Effect.flatMap(OutcomeLabelAnnotationRow.decodeRowsEffect));
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
    .pipe(Effect.flatMap(BenchmarkRunAnnotationRow.decodeRowsEffect));
  const labelAnnotations = pipe(
    labelRows,
    A.flatMap((row) => [
      annotation({
        idSuffix: row.labelId,
        metadata: { labelId: row.labelId, qualityGate: row.qualityGate },
        name: "agent.outcome.passed",
        optimization: AgentEffectivenessAnnotationOptimization.Enum.maximize,
        source: AgentEffectivenessAnnotationSource.Enum["ai-metrics"],
        targetKind: AgentEffectivenessAnnotationTargetKind.Enum["agent-task"],
        targetRef: row.agentTaskId,
        value: row.passed,
      }),
      annotation({
        idSuffix: row.labelId,
        metadata: { labelId: row.labelId, qualityGate: row.qualityGate },
        name: "agent.outcome.rating",
        optimization: AgentEffectivenessAnnotationOptimization.Enum.maximize,
        source: AgentEffectivenessAnnotationSource.Enum["ai-metrics"],
        targetKind: AgentEffectivenessAnnotationTargetKind.Enum["agent-task"],
        targetRef: row.agentTaskId,
        value: row.rating,
      }),
      annotation({
        idSuffix: row.labelId,
        metadata: { labelId: row.labelId, qualityGate: row.qualityGate },
        name: "agent.interventions",
        optimization: AgentEffectivenessAnnotationOptimization.Enum.minimize,
        source: AgentEffectivenessAnnotationSource.Enum["ai-metrics"],
        targetKind: AgentEffectivenessAnnotationTargetKind.Enum["agent-task"],
        targetRef: row.agentTaskId,
        value: row.interventionCount,
      }),
      annotation({
        idSuffix: row.labelId,
        metadata: { labelId: row.labelId, qualityGate: row.qualityGate },
        name: "agent.follow_up_fix",
        optimization: AgentEffectivenessAnnotationOptimization.Enum.minimize,
        source: AgentEffectivenessAnnotationSource.Enum["ai-metrics"],
        targetKind: AgentEffectivenessAnnotationTargetKind.Enum["agent-task"],
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
        optimization: AgentEffectivenessAnnotationOptimization.Enum.maximize,
        source: AgentEffectivenessAnnotationSource.Enum["ai-metrics"],
        targetKind: AgentEffectivenessAnnotationTargetKind.Enum["benchmark-run"],
        targetRef: row.benchmarkRunId,
        value: row.passed,
      }),
      annotation({
        metadata: {
          benchmarkCaseId: row.benchmarkCaseId,
          configSnapshotId: row.configSnapshotId,
        },
        name: "benchmark.elapsed_ms",
        optimization: AgentEffectivenessAnnotationOptimization.Enum.minimize,
        source: AgentEffectivenessAnnotationSource.Enum["ai-metrics"],
        targetKind: AgentEffectivenessAnnotationTargetKind.Enum["benchmark-run"],
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
 * **Details**
 *
 * Runs the doctor, then derives annotations from every section it produced —
 * loop health, source coverage, scorecards, worker-eval — and appends rows read
 * from derived storage when it exists. Nothing is written to Phoenix; the result
 * describes writes that a later phase could perform.
 *
 * **Gotchas**
 *
 * Storage-derived annotations degrade silently: if the derived-storage read
 * fails, the plan is still produced, just without those rows. A short plan can
 * therefore mean thin evidence rather than a healthy loop, so read the embedded
 * doctor report alongside the annotation count.
 *
 * **Example** (Planning annotations without touching Phoenix)
 *
 * ```ts
 * import {
 *   AgentEffectivenessAnnotationPlanInput,
 *   AgentEffectivenessDoctorInput,
 *   makeAgentEffectivenessAnnotationPlan
 * } from "@beep/repo-ai-metrics"
 * import { Effect } from "effect"
 *
 * const dataRoot = "/home/dev/.local/state/beep/ai-metrics"
 *
 * const annotationCount = makeAgentEffectivenessAnnotationPlan(
 *   AgentEffectivenessAnnotationPlanInput.make({
 *     annotationLimit: 10,
 *     doctor: AgentEffectivenessDoctorInput.make({ dataRoot, noPhoenix: true })
 *   })
 * ).pipe(Effect.map((plan) => plan.annotations.length))
 *
 * console.log(Effect.isEffect(annotationCount)) // true
 * ```
 *
 * @effects Performs the doctor's reads plus outcome-label and benchmark-run reads from derived
 * DuckDB storage when available. Performs no Phoenix mutation.
 * @see {@link makeAgentEffectivenessDoctorReport} for the evidence this plan is derived from.
 * @category services
 * @since 0.0.0
 */
export const makeAgentEffectivenessAnnotationPlan: (
  input: AgentEffectivenessAnnotationPlanInput
) => Effect.Effect<
  AgentEffectivenessAnnotationPlan,
  never,
  DuckDb | FileSystem.FileSystem | HttpClient.HttpClient | Path.Path
> = Effect.fn("AiMetrics.makeAgentEffectivenessAnnotationPlan")(function* (
  input: AgentEffectivenessAnnotationPlanInput
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
    mutationPolicy: AgentEffectivenessMutationPolicy.Enum["local-only-no-phoenix-mutation"],
    summary: doctor.summary,
  });
});

const datasetNameFor = (kind: AgentEffectivenessDatasetKind): string => `${kind}-v1`;

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

const outcomesDataset = (doctor: AgentEffectivenessDoctorReport): AgentEffectivenessDatasetSpec =>
  datasetSpec({
    description: "Aggregate outcome-label and scorecard readiness evidence.",
    examples: [
      datasetExample({
        id: "agent-outcomes-current",
        input: {
          benchmarkRunCount: doctor.aiMetrics.benchmarkRunCount,
          labelCount: doctor.aiMetrics.labelCount,
        },
        output: pipe(
          doctor.aiMetrics.latestScorecard,
          O.match({
            onNone: () => ({ completionReady: false, scorecardPresent: false }),
            onSome: (scorecard) => ({
              completionReady: scorecard.completionReady,
              scorecardId: scorecard.scorecardId,
              scorecardPresent: true,
              totalScore: scorecard.totalScore,
            }),
          })
        ),
      }),
    ],
    kind: "agent-outcomes",
  });

const configSnapshotsDataset = (doctor: AgentEffectivenessDoctorReport): AgentEffectivenessDatasetSpec =>
  datasetSpec({
    description: "Aggregate configuration snapshot evidence for ingested agent metrics.",
    examples: [
      datasetExample({
        id: "config-snapshot-current",
        input: {
          dataRoot: doctor.dataRoot,
          target: doctor.target,
        },
        output: pipe(
          doctor.aiMetrics.latestForwarder,
          O.match({
            onNone: () => ({ configSnapshotPresent: false }),
            onSome: (forwarder) => ({
              archiveObjectCount: forwarder.archiveObjectCount,
              configSnapshotId: forwarder.configSnapshotId,
              configSnapshotPresent: true,
              ingestRunId: forwarder.ingestRunId,
              turnCount: forwarder.turnCount,
            }),
          })
        ),
      }),
    ],
    kind: "agent-config-snapshots",
  });

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
            lastTimestamp: pipe(
              coverage.lastTimestamp,
              O.match({ onNone: () => null, onSome: (timestamp) => timestamp })
            ),
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
 * **Details**
 *
 * A pure projection of evidence already gathered: the bundle always contains one
 * dataset per owned kind, and it inherits the report's `generatedAt` rather than
 * taking a fresh clock reading, so the bundle is timestamped with the moment the
 * evidence was collected rather than the moment it was reshaped.
 *
 * **Gotchas**
 *
 * A dataset is always present even when the section behind it had nothing to
 * report, in which case it is present with no examples. Test dataset membership
 * by row count, not by looking for a missing dataset.
 *
 * **Example** (Deriving datasets from a fresh doctor run)
 *
 * ```ts
 * import {
 *   AgentEffectivenessDoctorInput,
 *   makeAgentEffectivenessDatasetBundle,
 *   makeAgentEffectivenessDoctorReport
 * } from "@beep/repo-ai-metrics"
 * import { Effect } from "effect"
 *
 * const dataRoot = "/home/dev/.local/state/beep/ai-metrics"
 *
 * const datasetCount = makeAgentEffectivenessDoctorReport(
 *   AgentEffectivenessDoctorInput.make({ dataRoot, noPhoenix: true })
 * ).pipe(
 *   Effect.map(makeAgentEffectivenessDatasetBundle),
 *   Effect.map((bundle) => bundle.datasets.length)
 * )
 *
 * console.log(Effect.isEffect(datasetCount)) // true
 * ```
 *
 * @param doctor - Report supplying every dataset's rows; its `generatedAt` is copied onto the bundle
 * rather than replaced with a fresh reading.
 * @returns One dataset per owned kind, in a fixed order, each present even when the section behind it
 * produced no rows.
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
  });

/**
 * Build the repo-owned Phoenix prompt bundle.
 *
 * **Details**
 *
 * The prompt set is authored in this function rather than derived from evidence,
 * so the same timestamp always yields the same bundle. Both templates instruct
 * the reviewing model to work from aggregates and to refuse raw transcripts,
 * which is what keeps a Phoenix-side evaluation inside the same privacy envelope
 * as the datasets it reads.
 *
 * **Example** (Generating the authored prompt set)
 *
 * ```ts
 * import { makeAgentEffectivenessPromptBundle } from "@beep/repo-ai-metrics"
 *
 * const bundle = makeAgentEffectivenessPromptBundle("2026-05-20T00:00:00.000Z")
 *
 * console.log(bundle.prompts.length) // 2
 * console.log(bundle.prompts.map((prompt) => prompt.name))
 * // [ "agent-effectiveness-review-evaluator-v1", "agent-effectiveness-source-coverage-review-v1" ]
 * ```
 *
 * @param generatedAt - ISO-8601 timestamp stamped onto the bundle; it is recorded verbatim, not parsed.
 * @returns The same authored prompt set on every call; only the timestamp varies between bundles.
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
  });

/**
 * Build deterministic experiment specs from a dataset bundle.
 *
 * **Details**
 *
 * Exactly one experiment per dataset in the supplied bundle, so an empty dataset
 * bundle yields an empty experiment bundle. The experiments perform no model
 * work, which makes generating and re-generating them free of inference cost.
 *
 * **Example** (Deriving experiments from an empty dataset bundle)
 *
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
 *
 * console.log(experimentBundle.experiments.length) // 0
 * ```
 *
 * @param datasetBundle - Datasets to derive experiments from; its `projectName` and `generatedAt` are
 * carried onto the result so both bundles describe the same derivation.
 * @returns One experiment per supplied dataset, in the dataset bundle's order; an empty dataset bundle
 * yields an empty experiment bundle.
 * @see {@link makeAgentEffectivenessDatasetBundle} for the dataset bundle these experiments read.
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

const findPhoenixDatasetInfo = Effect.fn("AiMetrics.findPhoenixDatasetInfo")(
  (phoenix: PhoenixShape, selector: PhoenixDatasetSelector) =>
    phoenix.getDatasetInfo(selector).pipe(
      Effect.asSome,
      Effect.catchIf(isDatasetNotFoundError, () => Effect.succeedNone)
    )
);

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

const toPhoenixExperimentCreateInput = (
  experiment: AgentEffectivenessExperimentSpec,
  datasetId: string
): PhoenixExperimentCreateInput =>
  PhoenixExperimentCreateInput.make({
    datasetId,
    experimentDescription: experiment.description,
    experimentMetadata: experiment.metadata,
    experimentName: experiment.name,
  });

const isPhoenixAnnotationTargetKind = S.is(PhoenixAnnotationTargetKind);

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
  readonly mutationPolicy: AgentEffectivenessMutationPolicy;
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

const annotationCheckFailurePolicy = (dryRun: boolean): AgentEffectivenessMutationPolicy =>
  dryRun
    ? AgentEffectivenessMutationPolicy.Enum["dry-run-annotation-check-failed"]
    : AgentEffectivenessMutationPolicy.Enum["blocked-annotation-check-failed"];

const datasetCheckFailurePolicy = (dryRun: boolean): AgentEffectivenessMutationPolicy =>
  dryRun
    ? AgentEffectivenessMutationPolicy.Enum["dry-run-dataset-check-failed"]
    : AgentEffectivenessMutationPolicy.Enum["blocked-dataset-check-failed"];

/**
 * Sync agent-effectiveness datasets, prompts, experiments, and resolved annotations to Phoenix.
 *
 * **Details**
 *
 * The sync rebuilds everything it needs from the local store — plan, datasets,
 * prompts, experiments — so it always writes a consistent set rather than
 * reconciling against whatever Phoenix currently holds. Writing is gated twice
 * over: `dryRun` must be false *and* `confirmToken` must equal
 * {@link AGENT_EFFECTIVENESS_PHOENIX_WRITE_CONFIRMATION}. Failing either gate is
 * not an error; the sync returns a result whose `mutationPolicy` records why
 * nothing was written.
 *
 * The plan's privacy check runs before any write, and a failed check blocks the
 * write even when both gates were satisfied.
 *
 * **Gotchas**
 *
 * `dryRun` defaults to true, so an input built without naming it never writes.
 * Planned annotations whose target kind Phoenix does not model are dropped rather
 * than rejected, landing in `skippedAnnotationCount` — a sync can therefore
 * report success while writing fewer annotations than were planned.
 *
 * **Example** (Previewing a sync without writing)
 *
 * ```ts
 * import {
 *   AgentEffectivenessAnnotationPlanInput,
 *   AgentEffectivenessDoctorInput,
 *   AgentEffectivenessPhoenixSyncInput,
 *   syncAgentEffectivenessPhoenix
 * } from "@beep/repo-ai-metrics"
 * import { Effect } from "effect"
 *
 * const annotationPlan = AgentEffectivenessAnnotationPlanInput.make({
 *   doctor: AgentEffectivenessDoctorInput.make({
 *     dataRoot: "/home/dev/.local/state/beep/ai-metrics"
 *   })
 * })
 *
 * const mutationPolicy = syncAgentEffectivenessPhoenix(
 *   AgentEffectivenessPhoenixSyncInput.make({ annotationPlan, dryRun: true })
 * ).pipe(Effect.map((result) => result.mutationPolicy))
 *
 * console.log(Effect.isEffect(mutationPolicy)) // true
 * ```
 *
 * @effects In dry-run or unconfirmed mode, reads local doctor and annotation evidence and mutates
 * nothing. In confirmed live mode, creates or appends Phoenix datasets and creates prompts,
 * experiments, and trace/session/span annotations.
 * @see {@link AGENT_EFFECTIVENESS_PHOENIX_WRITE_CONFIRMATION} for the token that unlocks live writes.
 * @category services
 * @since 0.0.0
 */
export const syncAgentEffectivenessPhoenix: (
  input: AgentEffectivenessPhoenixSyncInput
) => Effect.Effect<
  AgentEffectivenessPhoenixSyncResult,
  AgentEffectivenessError,
  DuckDb | FileSystem.FileSystem | HttpClient.HttpClient | Path.Path | Phoenix
> = Effect.fn("AiMetrics.syncAgentEffectivenessPhoenix")(function* (input: AgentEffectivenessPhoenixSyncInput) {
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
      mutationPolicy: annotationCheckFailurePolicy(input.dryRun),
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
      mutationPolicy: datasetCheckFailurePolicy(input.dryRun),
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
      mutationPolicy: AgentEffectivenessMutationPolicy.Enum["dry-run-no-phoenix-mutation"],
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
      mutationPolicy: AgentEffectivenessMutationPolicy.Enum["blocked-missing-confirmation-token"],
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
  ).pipe(Effect.mapError(agentEffectivenessFailure("Failed to sync agent-effectiveness datasets to Phoenix.")));
  const promptResults = yield* Effect.forEach(
    promptBundle.prompts,
    (prompt) => phoenix.createPrompt(toPhoenixPromptCreateInput(prompt)),
    { concurrency: 1 }
  ).pipe(Effect.mapError(agentEffectivenessFailure("Failed to write agent-effectiveness prompts to Phoenix.")));
  const experimentResults = yield* Effect.forEach(
    pipe(
      experimentBundle.experiments,
      A.zip(datasetResults),
      A.map(([experiment, result]) =>
        result.createExperiment
          ? O.some({
              experiment,
              datasetId: result.datasetId,
            })
          : O.none()
      ),
      A.getSomes
    ),
    ({ datasetId, experiment }) => phoenix.createExperiment(toPhoenixExperimentCreateInput(experiment, datasetId)),
    { concurrency: 1 }
  ).pipe(Effect.mapError(agentEffectivenessFailure("Failed to create agent-effectiveness Phoenix experiments.")));
  const annotationResults = yield* Effect.forEach(phoenixAnnotations, phoenix.addAnnotation, { concurrency: 1 }).pipe(
    Effect.mapError(agentEffectivenessFailure("Failed to write resolved agent-effectiveness annotations to Phoenix."))
  );

  return AgentEffectivenessPhoenixSyncResult.make({
    annotationCount: A.length(annotationResults),
    datasetCount: A.length(datasetResults),
    dryRun: false,
    experimentCount: A.length(experimentResults),
    mutationPolicy: AgentEffectivenessMutationPolicy.Enum["confirmed-phoenix-write"],
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
  Result.match(
    pipe(
      AgentEffectivenessAnnotationPlan.encodeJsonResult(plan),
      Result.flatMap(UnknownFromJsonString.decodeUnknownResult)
    ),
    {
      onFailure: () => [
        AgentEffectivenessAnnotationCheckFinding.make({
          annotationId: "plan",
          code: AgentEffectivenessAnnotationCheckFindingCode.Enum["plan-encode-failed"],
          message: "Plan payload could not be encoded for scanning.",
        }),
      ],
      onSuccess: (payload) => checkUnknownText("plan", payload, "Plan payload"),
    }
  );

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
  const duplicatedIds = pipe(
    annotations,
    A.groupBy((annotation) => annotation.annotationId),
    R.filter((group) => A.length(group) > 1),
    R.toEntries,
    A.map(([annotationId]) => annotationId)
  );
  return pipe(
    duplicatedIds,
    A.map((annotationId) =>
      AgentEffectivenessAnnotationCheckFinding.make({
        annotationId,
        code: AgentEffectivenessAnnotationCheckFindingCode.Enum["duplicate-annotation-id"],
        message: "Annotation id must be unique within the local plan.",
      })
    )
  );
};

/**
 * Check a local annotation plan for Phase 1 privacy and schema safety.
 *
 * **Details**
 *
 * Three independent checks feed one report: each annotation is scanned for
 * forbidden content, the plan envelope is scanned as a whole, and annotation ids
 * are checked for duplicates. Any finding at all makes the report `failed` —
 * there is no severity ladder here, because every forbidden pattern is a reason
 * not to publish.
 *
 * **Gotchas**
 *
 * The check is pure and report-only: it never redacts, never drops the offending
 * annotation, and never mutates the plan. A caller that ignores the report can
 * still hand the same plan to a sync, which is why the sync re-runs this check
 * itself before writing.
 *
 * **Example** (Checking a plan before considering a write)
 *
 * ```ts
 * import {
 *   AgentEffectivenessAnnotationPlanInput,
 *   AgentEffectivenessDoctorInput,
 *   makeAgentEffectivenessAnnotationCheckReport,
 *   makeAgentEffectivenessAnnotationPlan
 * } from "@beep/repo-ai-metrics"
 * import { Effect } from "effect"
 *
 * const status = makeAgentEffectivenessAnnotationPlan(
 *   AgentEffectivenessAnnotationPlanInput.make({
 *     doctor: AgentEffectivenessDoctorInput.make({
 *       dataRoot: "/home/dev/.local/state/beep/ai-metrics"
 *     })
 *   })
 * ).pipe(
 *   Effect.map(makeAgentEffectivenessAnnotationCheckReport),
 *   Effect.map((report) => report.status)
 * )
 *
 * console.log(Effect.isEffect(status)) // true
 * ```
 *
 * @param plan - Plan whose annotations, envelope, and annotation ids are all inspected; it is read
 * only, never redacted or rewritten.
 * @returns A report that is `failed` when even one finding was produced and `passed` only when none
 * were; its `generatedAt` is the plan's, not the moment of the check.
 * @see {@link AgentEffectivenessAnnotationCheckFinding} for what a single finding records.
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
    status: A.isReadonlyArrayNonEmpty(findings)
      ? AgentEffectivenessStatus.Enum.failed
      : AgentEffectivenessStatus.Enum.passed,
  });
};

/**
 * Encode a doctor report as JSON.
 *
 * **Details**
 *
 * Encoding runs through the report schema rather than a raw stringify, so the
 * output is the schema's encoded shape and a field that cannot be encoded fails
 * the effect instead of vanishing from the payload.
 *
 * **Gotchas**
 *
 * The report records the `dataRoot` it inspected, so the JSON contains a local
 * path. It is operator output, not a deploy-safe payload.
 *
 * **Example** (Rendering a doctor run for operator output)
 *
 * ```ts
 * import {
 *   AgentEffectivenessDoctorInput,
 *   agentEffectivenessDoctorReportToJson,
 *   makeAgentEffectivenessDoctorReport
 * } from "@beep/repo-ai-metrics"
 * import { Effect } from "effect"
 *
 * const dataRoot = "/home/dev/.local/state/beep/ai-metrics"
 *
 * const hasSchemaVersion = makeAgentEffectivenessDoctorReport(
 *   AgentEffectivenessDoctorInput.make({ dataRoot, noPhoenix: true })
 * ).pipe(
 *   Effect.flatMap(agentEffectivenessDoctorReportToJson),
 *   Effect.map((json) => json.includes("agent-effectiveness-doctor/v1"))
 * )
 *
 * console.log(Effect.isEffect(hasSchemaVersion)) // true
 * ```
 *
 * @category encoding
 * @since 0.0.0
 */
export const agentEffectivenessDoctorReportToJson: (
  report: AgentEffectivenessDoctorReport
) => Effect.Effect<string, AgentEffectivenessError> = Effect.fn("AiMetrics.agentEffectivenessDoctorReportToJson")(
  (report) =>
    AgentEffectivenessDoctorReport.encodeJsonEffect(report).pipe(
      Effect.mapError(agentEffectivenessFailure("Failed to encode agent-effectiveness doctor report as JSON."))
    )
);

/**
 * Encode an annotation plan as JSON.
 *
 * **Details**
 *
 * The encoded plan embeds the whole doctor report it was derived from, so the
 * JSON is a self-contained review artifact: an operator reading it can see the
 * evidence and the annotations together without re-running the doctor.
 *
 * **Gotchas**
 *
 * Encoding is not the privacy check. A plan carrying forbidden content encodes
 * happily — run {@link makeAgentEffectivenessAnnotationCheckReport} first if the
 * JSON is going anywhere but local operator output.
 *
 * **Example** (Rendering a plan for review)
 *
 * ```ts
 * import {
 *   AgentEffectivenessAnnotationPlanInput,
 *   AgentEffectivenessDoctorInput,
 *   agentEffectivenessAnnotationPlanToJson,
 *   makeAgentEffectivenessAnnotationPlan
 * } from "@beep/repo-ai-metrics"
 * import { Effect } from "effect"
 *
 * const hasMutationPolicy = makeAgentEffectivenessAnnotationPlan(
 *   AgentEffectivenessAnnotationPlanInput.make({
 *     doctor: AgentEffectivenessDoctorInput.make({
 *       dataRoot: "/home/dev/.local/state/beep/ai-metrics"
 *     })
 *   })
 * ).pipe(
 *   Effect.flatMap(agentEffectivenessAnnotationPlanToJson),
 *   Effect.map((json) => json.includes("local-only-no-phoenix-mutation"))
 * )
 *
 * console.log(Effect.isEffect(hasMutationPolicy)) // true
 * ```
 *
 * @category encoding
 * @since 0.0.0
 */
export const agentEffectivenessAnnotationPlanToJson: (
  plan: AgentEffectivenessAnnotationPlan
) => Effect.Effect<string, AgentEffectivenessError> = Effect.fn("AiMetrics.agentEffectivenessAnnotationPlanToJson")(
  (plan) =>
    AgentEffectivenessAnnotationPlan.encodeJsonEffect(plan).pipe(
      Effect.mapError(agentEffectivenessFailure("Failed to encode agent-effectiveness annotation plan as JSON."))
    )
);

/**
 * Encode an annotation-check report as JSON.
 *
 * **Details**
 *
 * Findings name the class of content that matched and never quote it, so unlike
 * the plan it judges, an encoded check report is safe to print, log, or attach
 * to CI output even when the check failed.
 *
 * **Example** (Rendering a passing check report)
 *
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
 *
 * Effect.runPromise(agentEffectivenessAnnotationCheckReportToJson(report)).then((json: string) =>
 *   console.log(json)
 * )
 * ```
 *
 * @category encoding
 * @since 0.0.0
 */
export const agentEffectivenessAnnotationCheckReportToJson: (
  report: AgentEffectivenessAnnotationCheckReport
) => Effect.Effect<string, AgentEffectivenessError> = Effect.fn(
  "AiMetrics.agentEffectivenessAnnotationCheckReportToJson"
)((report) =>
  AgentEffectivenessAnnotationCheckReport.encodeJsonEffect(report).pipe(
    Effect.mapError(agentEffectivenessFailure("Failed to encode agent-effectiveness annotation-check report as JSON."))
  )
);

/**
 * Encode a dataset bundle as JSON.
 *
 * **Details**
 *
 * The encoded bundle is the reviewable form of what a sync would upload, so
 * diffing two encodings across runs shows exactly what a live write would change
 * in Phoenix.
 *
 * **Example** (Rendering a bundle before syncing it)
 *
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
 *
 * Effect.runPromise(agentEffectivenessDatasetBundleToJson(bundle)).then((json: string) =>
 *   console.log(json)
 * )
 * ```
 *
 * @category encoding
 * @since 0.0.0
 */
export const agentEffectivenessDatasetBundleToJson: (
  bundle: AgentEffectivenessDatasetBundle
) => Effect.Effect<string, AgentEffectivenessError> = Effect.fn("AiMetrics.agentEffectivenessDatasetBundleToJson")(
  (bundle) =>
    AgentEffectivenessDatasetBundle.encodeJsonEffect(bundle).pipe(
      Effect.mapError(agentEffectivenessFailure("Failed to encode agent-effectiveness dataset bundle as JSON."))
    )
);

/**
 * Encode a prompt bundle as JSON.
 *
 * **Details**
 *
 * Template placeholders survive encoding unsubstituted, so the JSON holds the
 * prompts as Phoenix will store them rather than as any one run would render
 * them.
 *
 * **Example** (Rendering the authored prompt set)
 *
 * ```ts
 * import {
 *   agentEffectivenessPromptBundleToJson,
 *   makeAgentEffectivenessPromptBundle
 * } from "@beep/repo-ai-metrics"
 * import { Effect } from "effect"
 *
 * const bundle = makeAgentEffectivenessPromptBundle("2026-05-20T00:00:00.000Z")
 *
 * Effect.runPromise(agentEffectivenessPromptBundleToJson(bundle)).then((json: string) =>
 *   console.log(json)
 * )
 * ```
 *
 * @category encoding
 * @since 0.0.0
 */
export const agentEffectivenessPromptBundleToJson: (
  bundle: AgentEffectivenessPromptBundle
) => Effect.Effect<string, AgentEffectivenessError> = Effect.fn("AiMetrics.agentEffectivenessPromptBundleToJson")(
  (bundle) =>
    AgentEffectivenessPromptBundle.encodeJsonEffect(bundle).pipe(
      Effect.mapError(agentEffectivenessFailure("Failed to encode agent-effectiveness prompt bundle as JSON."))
    )
);

/**
 * Encode an experiment bundle as JSON.
 *
 * **Details**
 *
 * Experiments reference their dataset by name rather than embedding its rows, so
 * the encoded bundle stays small and reading it tells you which datasets a sync
 * expects to already exist.
 *
 * **Example** (Rendering experiments derived from a dataset bundle)
 *
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
 *
 * Effect.runPromise(agentEffectivenessExperimentBundleToJson(bundle)).then((json: string) =>
 *   console.log(json)
 * )
 * ```
 *
 * @category encoding
 * @since 0.0.0
 */
export const agentEffectivenessExperimentBundleToJson: (
  bundle: AgentEffectivenessExperimentBundle
) => Effect.Effect<string, AgentEffectivenessError> = Effect.fn("AiMetrics.agentEffectivenessExperimentBundleToJson")(
  (bundle) =>
    AgentEffectivenessExperimentBundle.encodeJsonEffect(bundle).pipe(
      Effect.mapError(agentEffectivenessFailure("Failed to encode agent-effectiveness experiment bundle as JSON."))
    )
);

/**
 * Encode a Phoenix sync result as JSON.
 *
 * **Details**
 *
 * This is the audit record of a sync attempt. Because `mutationPolicy` and the
 * written-id arrays are encoded alongside the counts, the JSON distinguishes a
 * run that wrote from one that was blocked, which the counts alone cannot do.
 *
 * **Example** (Recording a dry run as an audit artifact)
 *
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
 *
 * Effect.runPromise(agentEffectivenessPhoenixSyncResultToJson(result)).then((json: string) =>
 *   console.log(json)
 * )
 * ```
 *
 * @category encoding
 * @since 0.0.0
 */
export const agentEffectivenessPhoenixSyncResultToJson: (
  result: AgentEffectivenessPhoenixSyncResult
) => Effect.Effect<string, AgentEffectivenessError> = Effect.fn("AiMetrics.agentEffectivenessPhoenixSyncResultToJson")(
  (result) =>
    AgentEffectivenessPhoenixSyncResult.encodeJsonEffect(result).pipe(
      Effect.mapError(agentEffectivenessFailure("Failed to encode agent-effectiveness Phoenix sync result as JSON."))
    )
);
