/**
 * Schema-first AI metrics data models.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoAiMetricsId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils, UnknownRecord } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $RepoAiMetricsId.create("models");
const OptionalTranscriptString = S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault);

/**
 * Numeric count returned by aggregate DuckDB queries.
 *
 * **Example** (Decode a count row)
 *
 * ```ts
 * import { CountRow } from "@beep/repo-ai-metrics"
 * console.log(CountRow.make({ count: 3 }).count)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CountRow extends S.Class<CountRow>($I`CountRow`)(
  { count: S.Int },
  $I.annote("CountRow", { description: "Numeric count returned by an aggregate DuckDB query." })
) {
  static readonly decodeRowsEffect = S.decodeUnknownEffect(S.Array(CountRow));
  static readonly decodeNonEmptyRowsEffect = S.decodeUnknownEffect(S.NonEmptyArray(CountRow));
}

/**
 * Supported deployment targets for the AI metrics stack.
 *
 * **Example** (Log deploy target enum)
 *
 * ```ts
 * import { AiMetricsDeployTarget } from "@beep/repo-ai-metrics"
 * console.log(AiMetricsDeployTarget.Enum.dankserver)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AiMetricsDeployTarget = LiteralKit(["local", "dankserver"]).pipe(
  $I.annoteSchema("AiMetricsDeployTarget", {
    description: "Deploy targets supported by the repo AI metrics install module.",
  })
);

/**
 * Runtime type for {@link AiMetricsDeployTarget}.
 *
 * **Example** (Assign local deploy target)
 *
 * ```ts
 * import type { AiMetricsDeployTarget } from "@beep/repo-ai-metrics"
 * const target: AiMetricsDeployTarget = "local"
 * console.log(target)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type AiMetricsDeployTarget = typeof AiMetricsDeployTarget.Type;

/**
 * Candidate LLM-observability tool identifiers used in the bakeoff.
 *
 * **Example** (Log metrics tool enum)
 *
 * ```ts
 * import { AiMetricsTool } from "@beep/repo-ai-metrics"
 * console.log(AiMetricsTool.Enum.langfuse)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AiMetricsTool = LiteralKit(["langfuse", "phoenix", "opik", "posthog"]).pipe(
  $I.annoteSchema("AiMetricsTool", {
    description: "LLM analytics or evaluation tools that AI metrics exports can target.",
  })
);

/**
 * Runtime type for {@link AiMetricsTool}.
 *
 * **Example** (Assign phoenix tool type)
 *
 * ```ts
 * import type { AiMetricsTool } from "@beep/repo-ai-metrics"
 * const tool: AiMetricsTool = "phoenix"
 * console.log(tool)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type AiMetricsTool = typeof AiMetricsTool.Type;

/**
 * Transcript source kind normalized by the ingest layer.
 *
 * **Example** (Log transcript source enum)
 *
 * ```ts
 * import { AiMetricsTranscriptSource } from "@beep/repo-ai-metrics"
 * console.log(AiMetricsTranscriptSource.Enum.codex)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AiMetricsTranscriptSource = LiteralKit(["codex", "claude", "openclaw"]).pipe(
  $I.annoteSchema("AiMetricsTranscriptSource", {
    description: "AI stack transcript sources supported by the repo ingest layer.",
  })
);

/**
 * Runtime type for {@link AiMetricsTranscriptSource}.
 *
 * **Example** (Assign codex source type)
 *
 * ```ts
 * import type { AiMetricsTranscriptSource } from "@beep/repo-ai-metrics"
 * const source: AiMetricsTranscriptSource = "codex"
 * console.log(source)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type AiMetricsTranscriptSource = typeof AiMetricsTranscriptSource.Type;

/**
 * Canonical reasons a scorecard cannot claim complete measurement coverage.
 *
 * **Example** (Inspect a coverage gap)
 *
 * ```ts
 * import { AiMetricsCoverageGap } from "@beep/repo-ai-metrics"
 * console.log(AiMetricsCoverageGap.Enum.no_tasks)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AiMetricsCoverageGap = LiteralKit([
  "no_tasks",
  "no_labels",
  "no_benchmark_runs",
  "scorecard_completion_credit_blocked",
  "model_call_metrics_unavailable_not_scored",
  "tool_invocation_metrics_unavailable_not_scored",
  "cost_metrics_unavailable_not_scored",
]).pipe(
  $I.annoteSchema("AiMetricsCoverageGap", {
    description: "Canonical AI-metrics scorecard coverage-gap codes.",
  })
);

/**
 * Runtime type for {@link AiMetricsCoverageGap}.
 *
 * @category models
 * @since 0.0.0
 */
export type AiMetricsCoverageGap = typeof AiMetricsCoverageGap.Type;

/**
 * Event names accepted from Codex transcript records.
 *
 * **Example** (Read a Codex event name)
 *
 * ```ts
 * import { CodexTranscriptEventName } from "@beep/repo-ai-metrics"
 *
 * console.log(CodexTranscriptEventName.Enum.assistant_message)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CodexTranscriptEventName = LiteralKit([
  "assistant_message",
  "event",
  "event_msg",
  "response_item",
  "session_meta",
  "turn_context",
  "user_message",
]).pipe(
  SchemaUtils.withStatics((schema) => ({ isAny: S.is(schema) })),
  $I.annoteSchema("CodexTranscriptEventName", {
    description: "Bounded event-name vocabulary accepted from Codex transcript records.",
  })
);

/**
 * Runtime type for {@link CodexTranscriptEventName}.
 *
 * @category models
 * @since 0.0.0
 */
export type CodexTranscriptEventName = typeof CodexTranscriptEventName.Type;

/**
 * Event names accepted from Claude transcript records.
 *
 * **Example** (Read a Claude event name)
 *
 * ```ts
 * import { ClaudeTranscriptEventName } from "@beep/repo-ai-metrics"
 *
 * console.log(ClaudeTranscriptEventName.Enum.assistant)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ClaudeTranscriptEventName = LiteralKit([
  "assistant",
  "message",
  "summary",
  "system",
  "tool_result",
  "tool_use",
  "user",
]).pipe(
  SchemaUtils.withStatics((schema) => ({ isAny: S.is(schema) })),
  $I.annoteSchema("ClaudeTranscriptEventName", {
    description: "Bounded event-name vocabulary accepted from Claude transcript records.",
  })
);

/**
 * Runtime type for {@link ClaudeTranscriptEventName}.
 *
 * @category models
 * @since 0.0.0
 */
export type ClaudeTranscriptEventName = typeof ClaudeTranscriptEventName.Type;

/**
 * Event names accepted from OpenClaw transcript records.
 *
 * **Example** (Read an OpenClaw event name)
 *
 * ```ts
 * import { OpenClawTranscriptEventName } from "@beep/repo-ai-metrics"
 *
 * console.log(OpenClawTranscriptEventName.Enum.tool_call)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const OpenClawTranscriptEventName = LiteralKit([
  "event",
  "gateway_request",
  "gateway_response",
  "message",
  "request",
  "response",
  "session",
  "tool_call",
  "tool_result",
]).pipe(
  SchemaUtils.withStatics((schema) => ({ isAny: S.is(schema) })),
  $I.annoteSchema("OpenClawTranscriptEventName", {
    description: "Bounded event-name vocabulary accepted from OpenClaw transcript records.",
  })
);

/**
 * Runtime type for {@link OpenClawTranscriptEventName}.
 *
 * @category models
 * @since 0.0.0
 */
export type OpenClawTranscriptEventName = typeof OpenClawTranscriptEventName.Type;

/**
 * Normalized event-name vocabulary shared by transcript turns.
 *
 * **Example** (Validate a normalized event name)
 *
 * ```ts
 * import { AiMetricsTranscriptEventName } from "@beep/repo-ai-metrics"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(AiMetricsTranscriptEventName)("assistant_message")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AiMetricsTranscriptEventName = S.Union([
  CodexTranscriptEventName,
  ClaudeTranscriptEventName,
  OpenClawTranscriptEventName,
]).annotate(
  $I.annote("AiMetricsTranscriptEventName", {
    description: "Normalized event names emitted by supported AI transcript sources.",
  })
);

/**
 * Runtime type for {@link AiMetricsTranscriptEventName}.
 *
 * @category models
 * @since 0.0.0
 */
export type AiMetricsTranscriptEventName = typeof AiMetricsTranscriptEventName.Type;

/**
 * Role of a discovered source file within the source's local storage.
 *
 * **Example** (Log source role enum)
 *
 * ```ts
 * import { AiMetricsSourceRole } from "@beep/repo-ai-metrics"
 * console.log(AiMetricsSourceRole.Enum.primary)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AiMetricsSourceRole = LiteralKit(["primary", "subagent", "gateway_metadata"]).pipe(
  $I.annoteSchema("AiMetricsSourceRole", {
    description: "Privacy-safe role of a discovered source file or metadata record.",
  })
);

/**
 * Runtime type for {@link AiMetricsSourceRole}.
 *
 * **Example** (Assign primary source role)
 *
 * ```ts
 * import type { AiMetricsSourceRole } from "@beep/repo-ai-metrics"
 * const role: AiMetricsSourceRole = "primary"
 * console.log(role)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type AiMetricsSourceRole = typeof AiMetricsSourceRole.Type;

/**
 * Privacy-preserving source attribution derived from transcript metadata.
 *
 * **Example** (Create source attribution)
 *
 * ```ts
 * import { AiMetricsSourceAttribution } from "@beep/repo-ai-metrics"
 * console.log(AiMetricsSourceAttribution.make({ sourceRole: "primary" }).sourceRole)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AiMetricsSourceAttribution extends S.Class<AiMetricsSourceAttribution>($I`AiMetricsSourceAttribution`)(
  {
    agentNicknameHash: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    agentRoleHash: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    forkedFromIdHash: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    parentSessionIdHash: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    parentThreadIdHash: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    sessionIdHash: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    sourceRole: AiMetricsSourceRole,
    threadSpawn: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("AiMetricsSourceAttribution", {
    description: "Hash-only metadata that distinguishes primary sessions from delegated subagent work.",
  })
) {}

/**
 * Raw transcript retention and derived-dashboard privacy posture.
 *
 * **Example** (Log privacy mode enum)
 *
 * ```ts
 * import { AiMetricsPrivacyMode } from "@beep/repo-ai-metrics"
 * console.log(AiMetricsPrivacyMode.Enum.encrypted_raw_redacted_ui)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AiMetricsPrivacyMode = LiteralKit(["encrypted_raw_redacted_ui", "raw_tailnet_ui", "redacted_only"]).pipe(
  $I.annoteSchema("AiMetricsPrivacyMode", {
    description: "Privacy boundary for raw transcripts and derived observability UI payloads.",
  })
);

/**
 * Runtime type for {@link AiMetricsPrivacyMode}.
 *
 * **Example** (Assign encrypted privacy mode)
 *
 * ```ts
 * import type { AiMetricsPrivacyMode } from "@beep/repo-ai-metrics"
 * const mode: AiMetricsPrivacyMode = "encrypted_raw_redacted_ui"
 * console.log(mode)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type AiMetricsPrivacyMode = typeof AiMetricsPrivacyMode.Type;

/**
 * OTLP protocol variants supported by the P3 AI metrics backend contract.
 *
 * **Example** (Log OTLP protocol enum)
 *
 * ```ts
 * import { AiMetricsOtlpProtocol } from "@beep/repo-ai-metrics"
 * console.log(AiMetricsOtlpProtocol.Enum["http/protobuf"])
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AiMetricsOtlpProtocol = LiteralKit(["http/protobuf"]).pipe(
  $I.annoteSchema("AiMetricsOtlpProtocol", {
    description: "OTLP wire protocol variants supported by the AI metrics backend contract.",
  })
);

/**
 * Runtime type for {@link AiMetricsOtlpProtocol}.
 *
 * **Example** (Assign HTTP protobuf protocol)
 *
 * ```ts
 * import type { AiMetricsOtlpProtocol } from "@beep/repo-ai-metrics"
 * const protocol: AiMetricsOtlpProtocol = "http/protobuf"
 * console.log(protocol)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type AiMetricsOtlpProtocol = typeof AiMetricsOtlpProtocol.Type;

/**
 * Telemetry signal scope exported to the P3 Phoenix backend.
 *
 * **Example** (Log signal scope enum)
 *
 * ```ts
 * import { AiMetricsOtlpSignalScope } from "@beep/repo-ai-metrics"
 * console.log(AiMetricsOtlpSignalScope.Enum.traces_only)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AiMetricsOtlpSignalScope = LiteralKit(["traces_only"]).pipe(
  $I.annoteSchema("AiMetricsOtlpSignalScope", {
    description: "Telemetry signal scope exported to the AI metrics backend.",
  })
);

/**
 * Runtime type for {@link AiMetricsOtlpSignalScope}.
 *
 * **Example** (Assign traces-only signal scope)
 *
 * ```ts
 * import type { AiMetricsOtlpSignalScope } from "@beep/repo-ai-metrics"
 * const scope: AiMetricsOtlpSignalScope = "traces_only"
 * console.log(scope)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type AiMetricsOtlpSignalScope = typeof AiMetricsOtlpSignalScope.Type;

/**
 * Quality-gate outcome recorded for a labeled task or benchmark run.
 *
 * **Example** (Log quality gate status)
 *
 * ```ts
 * import { AiMetricsQualityGateStatus } from "@beep/repo-ai-metrics"
 * console.log(AiMetricsQualityGateStatus.Enum.passed)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AiMetricsQualityGateStatus = LiteralKit(["passed", "failed", "not_run", "unknown"]).pipe(
  $I.annoteSchema("AiMetricsQualityGateStatus", {
    description: "Bounded quality-gate outcome used by AI metrics labels and benchmark runs.",
  })
);

/**
 * Runtime type for {@link AiMetricsQualityGateStatus}.
 *
 * **Example** (Assign passed gate status)
 *
 * ```ts
 * import type { AiMetricsQualityGateStatus } from "@beep/repo-ai-metrics"
 * const status: AiMetricsQualityGateStatus = "passed"
 * console.log(status)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type AiMetricsQualityGateStatus = typeof AiMetricsQualityGateStatus.Type;

/**
 * Integer rating accepted by AI metrics outcome labels.
 *
 * **Example** (Decode a rating)
 *
 * ```ts
 * import { AiMetricsRating } from "@beep/repo-ai-metrics"
 * import * as S from "effect/Schema"
 *
 * console.log(S.decodeUnknownSync(AiMetricsRating)(5))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const AiMetricsRating = S.Int.check(
  S.isBetween(
    { minimum: 1, maximum: 5 },
    {
      identifier: $I`AiMetricsRatingCheck`,
      title: "AI metrics rating",
      description: "An integer outcome rating from one through five.",
      message: "Expected an integer rating between 1 and 5",
    }
  )
).pipe(
  $I.annoteSchema("AiMetricsRating", {
    description: "Integer outcome rating in the inclusive range from one through five.",
  })
);

/**
 * Non-negative integer used by AI metrics counts and elapsed durations.
 *
 * **Example** (Decode a non-negative count)
 *
 * ```ts
 * import { AiMetricsNonNegativeInteger } from "@beep/repo-ai-metrics"
 * import * as S from "effect/Schema"
 *
 * console.log(S.decodeUnknownSync(AiMetricsNonNegativeInteger)(0))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const AiMetricsNonNegativeInteger = S.Int.check(
  S.isGreaterThanOrEqualTo(0, {
    identifier: $I`AiMetricsNonNegativeIntegerCheck`,
    title: "AI metrics non-negative integer",
    description: "An integer count or elapsed duration that cannot be negative.",
    message: "Expected a non-negative integer",
  })
).pipe(
  $I.annoteSchema("AiMetricsNonNegativeInteger", {
    description: "Non-negative integer used by AI metrics counts and elapsed durations.",
  })
);

const AiMetricsPositiveInteger = S.Int.check(
  S.isGreaterThan(0, {
    identifier: $I`AiMetricsPositiveIntegerCheck`,
    title: "AI metrics positive integer",
    description: "A one-based integer position that must be greater than zero.",
    message: "Expected a positive integer",
  })
).pipe(
  $I.annoteSchema("AiMetricsPositiveInteger", {
    description: "Positive integer used for one-based AI metrics positions.",
  })
);

/**
 * Install-owned OTLP endpoint contract consumed by CLI, local smoke, and IaC.
 *
 * **Example** (Create OTLP endpoint spec)
 *
 * ```ts
 * import { AiMetricsOtlpEndpointSpec } from "@beep/repo-ai-metrics"
 *
 * const endpoint = AiMetricsOtlpEndpointSpec.make({
 *   baseUrl: "http://127.0.0.1:6006",
 *   protocol: "http/protobuf",
 *   resourceAttributes: { "service.name": "beep-ai-metrics" },
 *   signalScope: "traces_only",
 *   traceUrl: "http://127.0.0.1:6006/projects/default/traces"
 * })
 * console.log(endpoint.signalScope)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AiMetricsOtlpEndpointSpec extends S.Class<AiMetricsOtlpEndpointSpec>($I`AiMetricsOtlpEndpointSpec`)(
  {
    baseUrl: S.String,
    protocol: AiMetricsOtlpProtocol,
    resourceAttributes: S.Record(S.String, S.String),
    signalScope: AiMetricsOtlpSignalScope,
    traceUrl: S.String,
  },
  $I.annote("AiMetricsOtlpEndpointSpec", {
    description: "Trace-only OTLP endpoint contract shared by AI metrics installers and exporters.",
  })
) {}

/**
 * Outcome-heavy scorecard weights for coding-agent performance.
 *
 * **Example** (Create default score weights)
 *
 * ```ts
 * import { AiMetricsScoreWeights } from "@beep/repo-ai-metrics"
 * console.log(AiMetricsScoreWeights.make({}).outcome)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AiMetricsScoreWeights extends S.Class<AiMetricsScoreWeights>($I`AiMetricsScoreWeights`)(
  {
    cost: S.Finite.pipe(SchemaUtils.withKeyDefaults(0.1)),
    flow: S.Finite.pipe(SchemaUtils.withKeyDefaults(0.2)),
    outcome: S.Finite.pipe(SchemaUtils.withKeyDefaults(0.7)),
  },
  $I.annote("AiMetricsScoreWeights", {
    description: "Default weighted rubric emphasizing outcomes over flow and cost.",
  })
) {}

/**
 * Versioned snapshot of agent-facing repository configuration.
 *
 * **Example** (Create config snapshot)
 *
 * ```ts
 * import { ConfigSnapshot } from "@beep/repo-ai-metrics"
 *
 * const snapshot = ConfigSnapshot.make({
 *   changedPaths: ["AGENTS.md"],
 *   configHash: "sha256:fixture",
 *   label: "repo-local-agent-config",
 *   snapshotId: "config-fixture"
 * })
 * console.log(snapshot.changedPaths.length)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ConfigSnapshot extends S.Class<ConfigSnapshot>($I`ConfigSnapshot`)(
  {
    changedPaths: S.Array(S.String),
    configHash: S.String,
    gitCommit: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    includedPaths: S.Array(S.String).pipe(SchemaUtils.withEmptyArrayDefaults<string>()),
    label: S.String,
    previousSnapshotId: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    snapshotId: S.String,
  },
  $I.annote("ConfigSnapshot", {
    description: "Hashed snapshot of Codex, Claude, assistant, and repo guidance configuration with diff attribution.",
  })
) {}

const SourceRoleDefaultPrimary = AiMetricsSourceRole.pipe(
  SchemaUtils.withKeyDefaults(AiMetricsSourceRole.Enum.primary)
);

/**
 * Canonical unit of analysis for coding-agent metrics.
 *
 * **Example** (Create agent task)
 *
 * ```ts
 * import { AgentTask } from "@beep/repo-ai-metrics"
 *
 * const task = AgentTask.make({
 *   agentTaskId: "task-1",
 *   createdAtEpochMillis: 1_717_000_000_000,
 *   repoRootHash: "repo-hash",
 *   sourceKind: "codex",
 *   sourcePathHash: "1111111111111111111111111111111111111111111111111111111111111111",
 *   title: "Repair package docs"
 * })
 * console.log(task.sourceRole)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AgentTask extends S.Class<AgentTask>($I`AgentTask`)(
  {
    agentTaskId: S.String,
    configSnapshotId: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    createdAtEpochMillis: S.Natural,
    firstSeenAt: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    lastSeenAt: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    repoRootHash: S.String,
    sourceKind: AiMetricsTranscriptSource,
    sourcePathHash: S.String,
    sourceRole: SourceRoleDefaultPrimary,
    title: S.String,
  },
  $I.annote("AgentTask", {
    description: "Deploy-safe task unit grouped across sessions, turns, commands, labels, and scorecards.",
  })
) {}

/**
 * Session-level transcript metadata under an agent task.
 *
 * **Example** (Create agent session)
 *
 * ```ts
 * import { AgentSession } from "@beep/repo-ai-metrics"
 *
 * const session = AgentSession.make({
 *   agentSessionId: "session-1",
 *   sourceKind: "claude",
 *   sourcePathHash: "1111111111111111111111111111111111111111111111111111111111111111"
 * })
 * console.log(session.sourceRole)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AgentSession extends S.Class<AgentSession>($I`AgentSession`)(
  {
    agentSessionId: S.String,
    agentTaskId: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    ...AiMetricsSourceAttribution.fields,
    sourceKind: AiMetricsTranscriptSource,
    sourcePathHash: S.String,
    sourceRole: SourceRoleDefaultPrimary,
    startedAt: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("AgentSession", {
    description:
      "Transcript session metadata normalized from Codex, Claude, or OpenClaw logs with private paths hashed.",
  })
) {}

/**
 * Turn-level transcript event normalized from local agent logs.
 *
 * **Example** (Create agent turn)
 *
 * ```ts
 * import { AgentTurn } from "@beep/repo-ai-metrics"
 *
 * const turn = AgentTurn.make({
 *   eventName: "event_msg",
 *   lineNumber: 12,
 *   sourceKind: "codex",
 *   sourcePathHash: "1111111111111111111111111111111111111111111111111111111111111111"
 * })
 * console.log(turn.eventName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AgentTurn extends S.Class<AgentTurn>($I`AgentTurn`)(
  {
    eventName: AiMetricsTranscriptEventName,
    lineNumber: AiMetricsPositiveInteger,
    sourceKind: AiMetricsTranscriptSource,
    sourcePathHash: S.String,
    sourceRole: SourceRoleDefaultPrimary,
    timestamp: OptionalTranscriptString,
  },
  $I.annote("AgentTurn", {
    description: "Single normalized transcript line suitable for derived analytics and OTel export.",
  })
) {}

/**
 * Model or provider call measured under an agent task.
 *
 * **Example** (Create model call)
 *
 * ```ts
 * import { ModelCall } from "@beep/repo-ai-metrics"
 * import * as O from "effect/Option"
 *
 * const call = ModelCall.make({
 *   callId: "call-1",
 *   latencyMs: O.some(840),
 *   model: "gpt-5",
 *   provider: "openai",
 *   totalTokens: O.some(4096)
 * })
 * console.log(call.totalTokens)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ModelCall extends S.Class<ModelCall>($I`ModelCall`)(
  {
    callId: S.String,
    latencyMs: S.OptionFromOptionalKey(AiMetricsNonNegativeInteger).pipe(SchemaUtils.withNoneDefault),
    model: S.String,
    provider: S.String,
    totalTokens: S.OptionFromOptionalKey(AiMetricsNonNegativeInteger).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("ModelCall", {
    description: "Provider/model usage, latency, and token measurement for a coding-agent run.",
  })
) {}

/**
 * Tool or shell command invocation measured under an agent task.
 *
 * **Example** (Create tool invocation)
 *
 * ```ts
 * import { ToolInvocation } from "@beep/repo-ai-metrics"
 * import * as O from "effect/Option"
 *
 * const invocation = ToolInvocation.make({
 *   durationMs: O.some(1250),
 *   exitCode: O.some(0),
 *   toolName: "exec_command",
 *   toolRunId: "tool-1"
 * })
 * console.log(invocation.exitCode)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ToolInvocation extends S.Class<ToolInvocation>($I`ToolInvocation`)(
  {
    durationMs: S.OptionFromOptionalKey(AiMetricsNonNegativeInteger).pipe(SchemaUtils.withNoneDefault),
    exitCode: S.OptionFromOptionalKey(S.Int).pipe(SchemaUtils.withNoneDefault),
    toolName: S.String,
    toolRunId: S.String,
  },
  $I.annote("ToolInvocation", {
    description: "Tool or command invocation normalized from transcript events.",
  })
) {}

/**
 * Human label used by the weekly outcome-heavy scorecard.
 *
 * **Example** (Create outcome label)
 *
 * ```ts
 * import { OutcomeLabel } from "@beep/repo-ai-metrics"
 *
 * const label = OutcomeLabel.make({
 *   agentTaskId: "task-1",
 *   followUpFix: false,
 *   interventionCount: 1,
 *   labelId: "label-1",
 *   labeledAtEpochMillis: 1_717_000_000_000,
 *   passed: true,
 *   qualityGate: "passed",
 *   rating: 5
 * })
 * console.log(label.rating)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OutcomeLabel extends S.Class<OutcomeLabel>($I`OutcomeLabel`)(
  {
    agentTaskId: S.String,
    followUpFix: S.Boolean,
    interventionCount: AiMetricsNonNegativeInteger,
    labelId: S.String,
    labeledAtEpochMillis: S.Natural,
    note: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    passed: S.Boolean,
    qualityGate: AiMetricsQualityGateStatus,
    rating: AiMetricsRating,
  },
  $I.annote("OutcomeLabel", {
    description: "Structured manual label used to calibrate deploy-safe AI metrics scorecards.",
  })
) {
  static readonly decodeJsonEffect = S.decodeUnknownEffect(S.fromJsonString(OutcomeLabel));
  static readonly encodeJsonEffect = S.encodeUnknownEffect(S.fromJsonString(OutcomeLabel));
}

/**
 * Repeatable benchmark case for comparing agent configurations.
 *
 * **Example** (Create benchmark case)
 *
 * ```ts
 * import { BenchmarkCase } from "@beep/repo-ai-metrics"
 *
 * const benchmark = BenchmarkCase.make({
 *   benchmarkCaseId: "case-1",
 *   expectedChecks: ["bun run check"],
 *   promptHash: "prompt-hash",
 *   title: "JSDoc repair task"
 * })
 * console.log(benchmark.expectedChecks.length)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BenchmarkCase extends S.Class<BenchmarkCase>($I`BenchmarkCase`)(
  {
    benchmarkCaseId: S.String,
    expectedChecks: S.Array(S.String),
    promptHash: S.String,
    promptRef: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    title: S.String,
  },
  $I.annote("BenchmarkCase", {
    description: "Repeatable coding-agent benchmark case with prompt content stored by hash or external reference.",
  })
) {
  static readonly decodeJsonEffect = S.decodeUnknownEffect(S.fromJsonString(BenchmarkCase));
  static readonly encodeJsonEffect = S.encodeUnknownEffect(S.fromJsonString(BenchmarkCase));
}

/**
 * Benchmark run result under one config snapshot.
 *
 * **Example** (Create benchmark run)
 *
 * ```ts
 * import { BenchmarkRun } from "@beep/repo-ai-metrics"
 *
 * const run = BenchmarkRun.make({
 *   benchmarkCaseId: "case-1",
 *   benchmarkRunId: "run-1",
 *   configSnapshotId: "config-1",
 *   elapsedMs: 42_000,
 *   passed: true,
 *   qualityGate: "passed",
 *   recordedAtEpochMillis: 1_717_000_000_000
 * })
 * console.log(run.elapsedMs)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BenchmarkRun extends S.Class<BenchmarkRun>($I`BenchmarkRun`)(
  {
    benchmarkCaseId: S.String,
    benchmarkRunId: S.String,
    configSnapshotId: S.String,
    elapsedMs: AiMetricsNonNegativeInteger,
    note: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    passed: S.Boolean,
    qualityGate: AiMetricsQualityGateStatus,
    recordedAtEpochMillis: S.Natural,
  },
  $I.annote("BenchmarkRun", {
    description: "Observed result from running one benchmark case against one configuration snapshot.",
  })
) {
  static readonly decodeJsonEffect = S.decodeUnknownEffect(S.fromJsonString(BenchmarkRun));
  static readonly encodeJsonEffect = S.encodeUnknownEffect(S.fromJsonString(BenchmarkRun));
}

/**
 * Derived scorecard for weekly or config-impact review.
 *
 * **Example** (Create weekly scorecard)
 *
 * ```ts
 * import { Scorecard } from "@beep/repo-ai-metrics"
 *
 * const scorecard = Scorecard.make({
 *   benchmarkRunCount: 4,
 *   configSnapshotId: "config-1",
 *   costScore: 0.8,
 *   coverageGaps: [],
 *   flowScore: 0.7,
 *   labelCount: 6,
 *   outcomeScore: 0.9,
 *   scorecardId: "scorecard-1",
 *   taskCount: 10,
 *   totalScore: 0.86,
 *   weights: { cost: 0.1, flow: 0.2, outcome: 0.7 },
 *   windowEndEpochMillis: 1_717_604_800_000,
 *   windowStartEpochMillis: 1_717_000_000_000
 * })
 * console.log(scorecard.completionReady)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Scorecard extends S.Class<Scorecard>($I`Scorecard`)(
  {
    benchmarkRunCount: AiMetricsNonNegativeInteger,
    completionReady: SchemaUtils.BoolKeyDefaultFalse,
    configSnapshotId: S.String,
    costScore: S.Finite,
    coverageGaps: S.Array(AiMetricsCoverageGap),
    flowScore: S.Finite,
    labelCount: AiMetricsNonNegativeInteger,
    outcomeScore: S.Finite,
    scorecardId: S.String,
    taskCount: AiMetricsNonNegativeInteger,
    totalScore: S.Finite,
    weights: AiMetricsScoreWeights,
    windowEndEpochMillis: S.Natural,
    windowStartEpochMillis: S.Natural,
  },
  $I.annote("Scorecard", {
    description: "Outcome-heavy aggregate score for one config snapshot inside a weekly review window.",
  })
) {}

/**
 * Summary produced by transcript ingestion.
 *
 * **Example** (Create ingest summary)
 *
 * ```ts
 * import { TranscriptIngestSummary } from "@beep/repo-ai-metrics"
 *
 * const summary = TranscriptIngestSummary.make({
 *   acceptedEvents: 1,
 *   eventNames: ["event_msg"],
 *   rejectedLines: 0,
 *   sourceKind: "codex",
 *   sourcePathHash: "1111111111111111111111111111111111111111111111111111111111111111",
 *   totalLines: 1
 * })
 * console.log(summary.eventNames)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TranscriptIngestSummary extends S.Class<TranscriptIngestSummary>($I`TranscriptIngestSummary`)(
  {
    acceptedEvents: AiMetricsNonNegativeInteger,
    eventNames: S.Array(S.String),
    firstTimestamp: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    lastTimestamp: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    rejectedLines: AiMetricsNonNegativeInteger,
    sourceKind: AiMetricsTranscriptSource,
    sourcePathHash: S.String,
    totalLines: AiMetricsNonNegativeInteger,
  },
  $I.annote("TranscriptIngestSummary", {
    description: "Line-count, timestamp, and event-name summary from transcript ingestion with private paths hashed.",
  })
) {
  static readonly decodeJsonEffect = S.decodeUnknownEffect(S.fromJsonString(TranscriptIngestSummary));
  static readonly encodeJsonEffect = S.encodeUnknownEffect(S.fromJsonString(TranscriptIngestSummary));
}

/**
 * Minimal external Codex JSONL shape.
 *
 * **Example** (Create Codex transcript line)
 *
 * ```ts
 * import { CodexTranscriptLine } from "@beep/repo-ai-metrics"
 * const line = CodexTranscriptLine.make({ type: "session_meta" })
 * console.log(line.type)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CodexTranscriptLine extends S.Class<CodexTranscriptLine>($I`CodexTranscriptLine`)(
  {
    payload: S.OptionFromOptionalKey(S.Unknown).pipe(SchemaUtils.withNoneDefault),
    timestamp: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    type: S.String,
  },
  $I.annote("CodexTranscriptLine", {
    description: "Boundary shape decoded from Codex session JSONL lines.",
  })
) {
  static readonly decodeJsonOption = S.decodeUnknownOption(S.fromJsonString(CodexTranscriptLine));
  static readonly encodeJsonSync = S.encodeUnknownSync(S.fromJsonString(CodexTranscriptLine));
}

/**
 * Minimal external Claude JSONL shape.
 *
 * **Example** (Create Claude transcript line)
 *
 * ```ts
 * import { ClaudeTranscriptLine } from "@beep/repo-ai-metrics"
 * import * as O from "effect/Option"
 * const line = ClaudeTranscriptLine.make({ type: O.some("message") })
 * console.log(line.type)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ClaudeTranscriptLine extends S.Class<ClaudeTranscriptLine>($I`ClaudeTranscriptLine`)(
  {
    cwd: OptionalTranscriptString,
    message: S.OptionFromOptionalKey(S.Unknown).pipe(SchemaUtils.withNoneDefault),
    sessionId: OptionalTranscriptString,
    timestamp: OptionalTranscriptString,
    type: OptionalTranscriptString,
  },
  $I.annote("ClaudeTranscriptLine", {
    description: "Boundary shape decoded from Claude Code project JSONL lines.",
  })
) {
  static readonly decodeJsonOption = S.decodeUnknownOption(S.fromJsonString(ClaudeTranscriptLine));
  static readonly encodeJsonSync = S.encodeUnknownSync(S.fromJsonString(ClaudeTranscriptLine));
}

/**
 * Minimal external OpenClaw JSONL shape.
 *
 * **Example** (Create OpenClaw transcript line)
 *
 * ```ts
 * import { OpenClawTranscriptLine } from "@beep/repo-ai-metrics"
 * import * as O from "effect/Option"
 * const line = OpenClawTranscriptLine.make({ event: O.some("gateway_metadata") })
 * console.log(line.event)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OpenClawTranscriptLine extends S.Class<OpenClawTranscriptLine>($I`OpenClawTranscriptLine`)(
  {
    event: OptionalTranscriptString,
    message: OptionalTranscriptString,
    payload: S.OptionFromOptionalKey(UnknownRecord).pipe(SchemaUtils.withNoneDefault),
    timestamp: OptionalTranscriptString,
    type: OptionalTranscriptString,
  },
  $I.annote("OpenClawTranscriptLine", {
    description: "Boundary shape decoded from OpenClaw JSONL or exported event lines.",
  })
) {
  static readonly decodeJsonOption = S.decodeUnknownOption(S.fromJsonString(OpenClawTranscriptLine));
  static readonly encodeJsonSync = S.encodeUnknownSync(S.fromJsonString(OpenClawTranscriptLine));
}
