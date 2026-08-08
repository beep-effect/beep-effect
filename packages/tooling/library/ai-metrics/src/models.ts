/**
 * Schema-first AI metrics data models.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoAiMetricsId } from "@beep/identity/packages";
import { LiteralKit, UnknownRecord } from "@beep/schema";
import { Effect } from "effect";
import * as S from "effect/Schema";

const $I = $RepoAiMetricsId.create("models");

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
    agentNicknameHash: S.optionalKey(S.String),
    agentRoleHash: S.optionalKey(S.String),
    forkedFromIdHash: S.optionalKey(S.String),
    parentSessionIdHash: S.optionalKey(S.String),
    parentThreadIdHash: S.optionalKey(S.String),
    sessionIdHash: S.optionalKey(S.String),
    sourceRole: AiMetricsSourceRole,
    threadSpawn: S.optionalKey(S.Boolean),
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
    cost: S.Finite.pipe(S.withConstructorDefault(Effect.succeed(0.1)), S.withDecodingDefaultKey(Effect.succeed(0.1))),
    flow: S.Finite.pipe(S.withConstructorDefault(Effect.succeed(0.2)), S.withDecodingDefaultKey(Effect.succeed(0.2))),
    outcome: S.Finite.pipe(
      S.withConstructorDefault(Effect.succeed(0.7)),
      S.withDecodingDefaultKey(Effect.succeed(0.7))
    ),
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
    gitCommit: S.optionalKey(S.String),
    includedPaths: S.Array(S.String).pipe(
      S.withConstructorDefault(Effect.succeed([])),
      S.withDecodingDefaultKey(Effect.succeed([]))
    ),
    label: S.String,
    previousSnapshotId: S.optionalKey(S.String),
    snapshotId: S.String,
  },
  $I.annote("ConfigSnapshot", {
    description: "Hashed snapshot of Codex, Claude, assistant, and repo guidance configuration with diff attribution.",
  })
) {}

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
 *   sourcePathHash: "source-hash",
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
    configSnapshotId: S.optionalKey(S.String),
    createdAtEpochMillis: S.Finite,
    firstSeenAt: S.optionalKey(S.String),
    lastSeenAt: S.optionalKey(S.String),
    repoRootHash: S.String,
    sourceKind: AiMetricsTranscriptSource,
    sourcePathHash: S.String,
    sourceRole: AiMetricsSourceRole.pipe(
      S.withConstructorDefault(Effect.succeed(AiMetricsSourceRole.Enum.primary)),
      S.withDecodingDefaultKey(Effect.succeed(AiMetricsSourceRole.Enum.primary))
    ),
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
 *   sourcePathHash: "source-hash"
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
    agentTaskId: S.optionalKey(S.String),
    agentNicknameHash: S.optionalKey(S.String),
    agentRoleHash: S.optionalKey(S.String),
    forkedFromIdHash: S.optionalKey(S.String),
    parentSessionIdHash: S.optionalKey(S.String),
    parentThreadIdHash: S.optionalKey(S.String),
    sessionIdHash: S.optionalKey(S.String),
    sourceKind: AiMetricsTranscriptSource,
    sourcePathHash: S.String,
    sourceRole: AiMetricsSourceRole.pipe(
      S.withConstructorDefault(Effect.succeed(AiMetricsSourceRole.Enum.primary)),
      S.withDecodingDefaultKey(Effect.succeed(AiMetricsSourceRole.Enum.primary))
    ),
    startedAt: S.optionalKey(S.String),
    threadSpawn: S.optionalKey(S.Boolean),
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
 *   eventName: "codex.event_msg",
 *   lineNumber: 12,
 *   sourceKind: "codex",
 *   sourcePathHash: "source-hash"
 * })
 * console.log(turn.eventName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AgentTurn extends S.Class<AgentTurn>($I`AgentTurn`)(
  {
    eventName: S.String,
    lineNumber: S.Finite,
    sourceKind: AiMetricsTranscriptSource,
    sourcePathHash: S.String,
    sourceRole: AiMetricsSourceRole.pipe(
      S.withConstructorDefault(Effect.succeed(AiMetricsSourceRole.Enum.primary)),
      S.withDecodingDefaultKey(Effect.succeed(AiMetricsSourceRole.Enum.primary))
    ),
    timestamp: S.optionalKey(S.String),
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
 *
 * const call = ModelCall.make({
 *   callId: "call-1",
 *   latencyMs: 840,
 *   model: "gpt-5",
 *   provider: "openai",
 *   totalTokens: 4096
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
    latencyMs: S.optionalKey(S.Finite),
    model: S.String,
    provider: S.String,
    totalTokens: S.optionalKey(S.Finite),
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
 *
 * const invocation = ToolInvocation.make({
 *   durationMs: 1250,
 *   exitCode: 0,
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
    durationMs: S.optionalKey(S.Finite),
    exitCode: S.optionalKey(S.Finite),
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
 *   rating: 0.9
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
    interventionCount: S.Finite,
    labelId: S.String,
    labeledAtEpochMillis: S.Finite,
    note: S.optionalKey(S.String),
    passed: S.Boolean,
    qualityGate: AiMetricsQualityGateStatus,
    rating: S.Finite,
  },
  $I.annote("OutcomeLabel", {
    description: "Structured manual label used to calibrate deploy-safe AI metrics scorecards.",
  })
) {}

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
    promptRef: S.optionalKey(S.String),
    title: S.String,
  },
  $I.annote("BenchmarkCase", {
    description: "Repeatable coding-agent benchmark case with prompt content stored by hash or external reference.",
  })
) {}

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
    elapsedMs: S.Finite,
    note: S.optionalKey(S.String),
    passed: S.Boolean,
    qualityGate: AiMetricsQualityGateStatus,
    recordedAtEpochMillis: S.Finite,
  },
  $I.annote("BenchmarkRun", {
    description: "Observed result from running one benchmark case against one configuration snapshot.",
  })
) {}

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
    benchmarkRunCount: S.Finite,
    completionReady: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(false)),
      S.withDecodingDefaultKey(Effect.succeed(false))
    ),
    configSnapshotId: S.String,
    costScore: S.Finite,
    coverageGaps: S.Array(S.String),
    flowScore: S.Finite,
    labelCount: S.Finite,
    outcomeScore: S.Finite,
    scorecardId: S.String,
    taskCount: S.Finite,
    totalScore: S.Finite,
    weights: AiMetricsScoreWeights,
    windowEndEpochMillis: S.Finite,
    windowStartEpochMillis: S.Finite,
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
 *   eventNames: ["codex.event_msg"],
 *   rejectedLines: 0,
 *   sourceKind: "codex",
 *   sourcePathHash: "source-hash",
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
    acceptedEvents: S.Finite,
    eventNames: S.Array(S.String),
    firstTimestamp: S.optionalKey(S.String),
    lastTimestamp: S.optionalKey(S.String),
    rejectedLines: S.Finite,
    sourceKind: AiMetricsTranscriptSource,
    sourcePathHash: S.String,
    totalLines: S.Finite,
  },
  $I.annote("TranscriptIngestSummary", {
    description: "Line-count, timestamp, and event-name summary from transcript ingestion with private paths hashed.",
  })
) {}

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
    payload: S.optionalKey(S.Unknown),
    timestamp: S.optionalKey(S.String),
    type: S.String,
  },
  $I.annote("CodexTranscriptLine", {
    description: "Boundary shape decoded from Codex session JSONL lines.",
  })
) {
  static readonly decodeJsonOption = S.decodeUnknownOption(S.fromJsonString(CodexTranscriptLine));
}

/**
 * Minimal external Claude JSONL shape.
 *
 * **Example** (Create Claude transcript line)
 *
 * ```ts
 * import { ClaudeTranscriptLine } from "@beep/repo-ai-metrics"
 * const line = ClaudeTranscriptLine.make({ type: "message" })
 * console.log(line.type)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ClaudeTranscriptLine extends S.Class<ClaudeTranscriptLine>($I`ClaudeTranscriptLine`)(
  {
    cwd: S.optionalKey(S.String),
    message: S.optionalKey(S.Unknown),
    sessionId: S.optionalKey(S.String),
    timestamp: S.optionalKey(S.String),
    type: S.optionalKey(S.String),
  },
  $I.annote("ClaudeTranscriptLine", {
    description: "Boundary shape decoded from Claude Code project JSONL lines.",
  })
) {
  static readonly decodeJsonOption = S.decodeUnknownOption(S.fromJsonString(ClaudeTranscriptLine));
}

/**
 * Minimal external OpenClaw JSONL shape.
 *
 * **Example** (Create OpenClaw transcript line)
 *
 * ```ts
 * import { OpenClawTranscriptLine } from "@beep/repo-ai-metrics"
 * const line = OpenClawTranscriptLine.make({ event: "gateway_metadata" })
 * console.log(line.event)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OpenClawTranscriptLine extends S.Class<OpenClawTranscriptLine>($I`OpenClawTranscriptLine`)(
  {
    event: S.optionalKey(S.String),
    message: S.optionalKey(S.String),
    payload: S.optionalKey(UnknownRecord),
    timestamp: S.optionalKey(S.String),
    type: S.optionalKey(S.String),
  },
  $I.annote("OpenClawTranscriptLine", {
    description: "Boundary shape decoded from OpenClaw JSONL or exported event lines.",
  })
) {
  static readonly decodeJsonOption = S.decodeUnknownOption(S.fromJsonString(OpenClawTranscriptLine));
}
