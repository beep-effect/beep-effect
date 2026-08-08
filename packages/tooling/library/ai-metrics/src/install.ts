/**
 * Target-agnostic install spec for repo AI metrics.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoAiMetricsId } from "@beep/identity/packages";
import { LiteralKit, TaggedErrorClass } from "@beep/schema";
import { A, Str } from "@beep/utils";
import { Effect, flow, Match, pipe } from "effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import {
  AiMetricsDeployTarget,
  AiMetricsOtlpEndpointSpec,
  AiMetricsOtlpProtocol,
  AiMetricsOtlpSignalScope,
  AiMetricsPrivacyMode,
  AiMetricsScoreWeights,
  AiMetricsTool,
} from "./models.ts";
import { shellQuote } from "./shell.ts";
import { AiMetricsSourceDiscoveryResult, AiMetricsSourceStatus } from "./source-discovery.ts";

const $I = $RepoAiMetricsId.create("install");

const defaultCandidateTools = [
  AiMetricsTool.Enum.langfuse,
  AiMetricsTool.Enum.phoenix,
  AiMetricsTool.Enum.opik,
] as const;

const defaultPhoenixImage = "arizephoenix/phoenix:latest";
const localCollectorDataRoot = ".beep/ai-metrics";

const servicePort = (tool: AiMetricsTool): number =>
  AiMetricsTool.$match(tool, {
    langfuse: () => 3001,
    opik: () => 5173,
    phoenix: () => 6006,
    posthog: () => 8000,
  });

const defaultDataRoot = (target: AiMetricsDeployTarget): string =>
  target === AiMetricsDeployTarget.Enum.dankserver ? "/srv/data/ai-metrics" : ".beep/ai-metrics";

const defaultPublicBaseUrl = (target: AiMetricsDeployTarget): string =>
  target === AiMetricsDeployTarget.Enum.dankserver ? "https://dankserver.tailc7c348.ts.net:8447" : "http://127.0.0.1";

const childPath = (root: string, child: string): string => `${root}/${child}`;

const nonEmptyString = (value: string | undefined): O.Option<string> =>
  value === undefined || Str.isEmpty(Str.trim(value)) ? O.none() : O.some(value);

const requireHashSaltSecretRef = Effect.fn("AiMetrics.requireHashSaltSecretRef")(function* (
  target: AiMetricsDeployTarget,
  hashSaltSecretRef: string | undefined
) {
  const ref = nonEmptyString(hashSaltSecretRef);
  if (target === AiMetricsDeployTarget.Enum.local || O.isSome(ref)) {
    return ref;
  }

  return yield* AiMetricsInstallConfigurationError.make({
    cause: { target },
    message:
      "AI metrics non-local installs require hashSaltSecretRef so private identifier hashing never uses the local smoke salt.",
  });
});

const requireRawArchiveKeySecretRef = Effect.fn("AiMetrics.requireRawArchiveKeySecretRef")(function* (
  target: AiMetricsDeployTarget,
  rawArchiveKeySecretRef: string | undefined
) {
  const ref = nonEmptyString(rawArchiveKeySecretRef);
  if (target === AiMetricsDeployTarget.Enum.local || O.isSome(ref)) {
    return ref;
  }

  return yield* AiMetricsInstallConfigurationError.make({
    cause: { target },
    message:
      "AI metrics non-local installs require rawArchiveKeySecretRef so encrypted raw transcripts never depend on inline operator input.",
  });
});

/**
 * Error raised when an AI metrics install spec would be unsafe for the requested target.
 *
 * **Example** (Create configuration error)
 *
 * ```ts
 * import { AiMetricsInstallConfigurationError } from "@beep/repo-ai-metrics"
 *
 * const error = AiMetricsInstallConfigurationError.make({
 *   cause: "missing secret reference",
 *   message: "dankserver target requires a raw archive key secret reference."
 * })
 * console.log(error.message)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class AiMetricsInstallConfigurationError extends TaggedErrorClass<AiMetricsInstallConfigurationError>(
  $I`AiMetricsInstallConfigurationError`
)(
  "AiMetricsInstallConfigurationError",
  {
    cause: S.Defect({ includeStack: true }),
    message: S.String,
  },
  $I.annote("AiMetricsInstallConfigurationError", {
    description:
      "Typed failure raised when a requested AI metrics install target is missing required safety configuration.",
  })
) {}

/**
 * Input for resolving an AI metrics install spec.
 *
 * **Example** (Make empty install input)
 *
 * ```ts
 * import { AiMetricsInstallInput } from "@beep/repo-ai-metrics"
 * console.log(AiMetricsInstallInput.make({}).target)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AiMetricsInstallInput extends S.Class<AiMetricsInstallInput>($I`AiMetricsInstallInput`)(
  {
    candidateTools: S.Array(AiMetricsTool).pipe(
      S.withConstructorDefault(Effect.succeed(defaultCandidateTools)),
      S.withDecodingDefaultKey(Effect.succeed(defaultCandidateTools))
    ),
    dataRoot: S.optionalKey(S.String),
    defaultTool: AiMetricsTool.pipe(
      S.withConstructorDefault(Effect.succeed(AiMetricsTool.Enum.phoenix)),
      S.withDecodingDefaultKey(Effect.succeed(AiMetricsTool.Enum.phoenix))
    ),
    hashSaltSecretRef: S.optionalKey(S.String),
    litellmGatewayEnabled: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(true)),
      S.withDecodingDefaultKey(Effect.succeed(true))
    ),
    phoenixImage: S.String.pipe(
      S.withConstructorDefault(Effect.succeed(defaultPhoenixImage)),
      S.withDecodingDefaultKey(Effect.succeed(defaultPhoenixImage))
    ),
    privacyMode: AiMetricsPrivacyMode.pipe(
      S.withConstructorDefault(Effect.succeed(AiMetricsPrivacyMode.Enum.encrypted_raw_redacted_ui)),
      S.withDecodingDefaultKey(Effect.succeed(AiMetricsPrivacyMode.Enum.encrypted_raw_redacted_ui))
    ),
    publicBaseUrl: S.optionalKey(S.String),
    rawArchiveKeySecretRef: S.optionalKey(S.String),
    target: AiMetricsDeployTarget.pipe(
      S.withConstructorDefault(Effect.succeed(AiMetricsDeployTarget.Enum.local)),
      S.withDecodingDefaultKey(Effect.succeed(AiMetricsDeployTarget.Enum.local))
    ),
    tailnetOnly: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(true)),
      S.withDecodingDefaultKey(Effect.succeed(true))
    ),
  },
  $I.annote("AiMetricsInstallInput", {
    description: "User-selectable inputs for the target-agnostic AI metrics install module.",
  })
) {}

/**
 * Storage layout resolved for an AI metrics target.
 *
 * **Example** (Build storage layout paths)
 *
 * ```ts
 * import { AiMetricsStorageLayout } from "@beep/repo-ai-metrics"
 *
 * const storage = AiMetricsStorageLayout.make({
 *   dataRoot: ".beep/ai-metrics",
 *   derivedDir: ".beep/ai-metrics/derived",
 *   duckDbPath: ".beep/ai-metrics/derived/ai-metrics.duckdb",
 *   parquetDir: ".beep/ai-metrics/derived/parquet",
 *   rawArchiveDir: ".beep/ai-metrics/raw"
 * })
 * console.log(storage.duckDbPath)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AiMetricsStorageLayout extends S.Class<AiMetricsStorageLayout>($I`AiMetricsStorageLayout`)(
  {
    dataRoot: S.String,
    derivedDir: S.String,
    duckDbPath: S.String,
    parquetDir: S.String,
    rawArchiveDir: S.String,
  },
  $I.annote("AiMetricsStorageLayout", {
    description: "Canonical raw and derived storage paths for an AI metrics target.",
  })
) {}

/**
 * One candidate service in the local bakeoff or promoted install target.
 *
 * **Example** (Make Phoenix service spec)
 *
 * ```ts
 * import { AiMetricsOtlpEndpointSpec, AiMetricsServiceSpec } from "@beep/repo-ai-metrics"
 *
 * const service = AiMetricsServiceSpec.make({
 *   composeServiceName: "phoenix",
 *   enabledByDefault: true,
 *   healthUrl: "http://127.0.0.1:6006/healthz",
 *   image: "arizephoenix/phoenix:latest",
 *   internalUrl: "http://phoenix:6006",
 *   otlp: AiMetricsOtlpEndpointSpec.make({
 *     baseUrl: "http://127.0.0.1:6006",
 *     protocol: "http/protobuf",
 *     resourceAttributes: { "service.name": "beep-ai-metrics" },
 *     signalScope: "traces_only",
 *     traceUrl: "http://127.0.0.1:6006/projects/default/traces"
 *   }),
 *   publicUrl: "http://127.0.0.1:6006",
 *   tool: "phoenix"
 * })
 * console.log(service.tool)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AiMetricsServiceSpec extends S.Class<AiMetricsServiceSpec>($I`AiMetricsServiceSpec`)(
  {
    composeServiceName: S.String,
    enabledByDefault: S.Boolean,
    healthUrl: S.String,
    image: S.String,
    internalUrl: S.String,
    otlp: AiMetricsOtlpEndpointSpec,
    publicUrl: S.String,
    tool: AiMetricsTool,
  },
  $I.annote("AiMetricsServiceSpec", {
    description: "Candidate observability tool endpoint resolved for a target install.",
  })
) {}

/**
 * Resolved target-agnostic install spec for AI metrics.
 *
 * **Example** (Build full install spec)
 *
 * ```ts
 * import {
 *   AiMetricsInstallSpec,
 *   AiMetricsScoreWeights,
 *   AiMetricsStorageLayout
 * } from "@beep/repo-ai-metrics"
 *
 * const spec = AiMetricsInstallSpec.make({
 *   candidateTools: ["phoenix"],
 *   defaultScoreWeights: AiMetricsScoreWeights.make({}),
 *   defaultTool: "phoenix",
 *   litellmGatewayEnabled: true,
 *   plannedCommands: ["bun run beep ai-metrics install plan"],
 *   privacyMode: "encrypted_raw_redacted_ui",
 *   services: [],
 *   stackName: "beep-ai-metrics-local",
 *   storage: AiMetricsStorageLayout.make({
 *     dataRoot: ".beep/ai-metrics",
 *     derivedDir: ".beep/ai-metrics/derived",
 *     duckDbPath: ".beep/ai-metrics/derived/ai-metrics.duckdb",
 *     parquetDir: ".beep/ai-metrics/derived/parquet",
 *     rawArchiveDir: ".beep/ai-metrics/raw"
 *   }),
 *   tailnetOnly: true,
 *   target: "local"
 * })
 * console.log(spec.plannedCommands)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AiMetricsInstallSpec extends S.Class<AiMetricsInstallSpec>($I`AiMetricsInstallSpec`)(
  {
    candidateTools: S.Array(AiMetricsTool),
    defaultScoreWeights: AiMetricsScoreWeights,
    defaultTool: AiMetricsTool,
    hashSaltSecretRef: S.optionalKey(S.String),
    litellmGatewayEnabled: S.Boolean,
    plannedCommands: S.Array(S.String),
    privacyMode: AiMetricsPrivacyMode,
    rawArchiveKeySecretRef: S.optionalKey(S.String),
    services: S.Array(AiMetricsServiceSpec),
    stackName: S.String,
    storage: AiMetricsStorageLayout,
    tailnetOnly: S.Boolean,
    target: AiMetricsDeployTarget,
  },
  $I.annote("AiMetricsInstallSpec", {
    description: "Resolved install/deploy contract shared by the CLI installer and Pulumi orchestration.",
  })
) {}

/**
 * P5a install-plan step kinds.
 *
 * **Example** (Log storage step kind)
 *
 * ```ts
 * import { AiMetricsInstallPlanStepKind } from "@beep/repo-ai-metrics"
 * console.log(AiMetricsInstallPlanStepKind.Enum.storage)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AiMetricsInstallPlanStepKind = LiteralKit([
  "storage",
  "backend",
  "health",
  "source_discovery",
  "config_snapshot",
  "privacy_check",
  "forwarder",
  "forwarder_timer",
  "otlp_export",
  "label_queue",
  "retention_drill",
  "weekly_report",
  "pulumi",
]).pipe(
  $I.annoteSchema("AiMetricsInstallPlanStepKind", {
    description: "Typed step categories emitted by the AI metrics P5a install planner.",
  })
);

/**
 * Runtime type for {@link AiMetricsInstallPlanStepKind}.
 *
 * **Example** (Assign storage kind type)
 *
 * ```ts
 * import type { AiMetricsInstallPlanStepKind } from "@beep/repo-ai-metrics"
 * const kind: AiMetricsInstallPlanStepKind = "storage"
 * console.log(kind)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type AiMetricsInstallPlanStepKind = typeof AiMetricsInstallPlanStepKind.Type;

/**
 * One typed P5a install plan step.
 *
 * **Example** (Make source discovery step)
 *
 * ```ts
 * import { AiMetricsInstallPlanStep } from "@beep/repo-ai-metrics"
 *
 * const step = AiMetricsInstallPlanStep.make({
 *   command: "bun run beep ai-metrics source-discovery",
 *   description: "Collect source availability before forwarding.",
 *   kind: "source_discovery",
 *   mutatesHost: false,
 *   order: 1,
 *   required: true,
 *   requiresRemote: false,
 *   stepId: "source-discovery",
 *   title: "Discover sources"
 * })
 * console.log(step.required)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AiMetricsInstallPlanStep extends S.Class<AiMetricsInstallPlanStep>($I`AiMetricsInstallPlanStep`)(
  {
    command: S.String,
    description: S.String,
    mutatesHost: S.Boolean,
    order: S.Finite,
    required: S.Boolean,
    requiresRemote: S.Boolean,
    stepId: S.String,
    title: S.String,
    kind: AiMetricsInstallPlanStepKind,
  },
  $I.annote("AiMetricsInstallPlanStep", {
    description: "Single ordered operation in the dry-runnable AI metrics install plan.",
  })
) {}

/**
 * Typed P5a install plan for local smoke or dankserver deployment.
 *
 * **Example** (Build dry-run install plan)
 *
 * ```ts
 * import {
 *   AiMetricsInstallPlan,
 *   AiMetricsStorageLayout
 * } from "@beep/repo-ai-metrics"
 *
 * const plan = AiMetricsInstallPlan.make({
 *   defaultTool: "phoenix",
 *   dryRunOnly: true,
 *   services: [],
 *   stackName: "beep-ai-metrics-local",
 *   steps: [],
 *   storage: AiMetricsStorageLayout.make({
 *     dataRoot: ".beep/ai-metrics",
 *     derivedDir: ".beep/ai-metrics/derived",
 *     duckDbPath: ".beep/ai-metrics/derived/ai-metrics.duckdb",
 *     parquetDir: ".beep/ai-metrics/derived/parquet",
 *     rawArchiveDir: ".beep/ai-metrics/raw"
 *   }),
 *   tailnetOnly: true,
 *   target: "local"
 * })
 * console.log(plan.dryRunOnly)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AiMetricsInstallPlan extends S.Class<AiMetricsInstallPlan>($I`AiMetricsInstallPlan`)(
  {
    defaultTool: AiMetricsTool,
    dryRunOnly: S.Boolean,
    services: S.Array(AiMetricsServiceSpec),
    stackName: S.String,
    steps: S.Array(AiMetricsInstallPlanStep),
    storage: AiMetricsStorageLayout,
    tailnetOnly: S.Boolean,
    target: AiMetricsDeployTarget,
  },
  $I.annote("AiMetricsInstallPlan", {
    description: "Contract-first install plan consumed by P5a CLI plan, doctor, and dry-run apply workflows.",
  })
) {}

/**
 * Doctor check status for P5a install contract validation.
 *
 * **Example** (Log passed check status)
 *
 * ```ts
 * import { AiMetricsInstallDoctorCheckStatus } from "@beep/repo-ai-metrics"
 * console.log(AiMetricsInstallDoctorCheckStatus.Enum.passed)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AiMetricsInstallDoctorCheckStatus = LiteralKit(["passed", "warning", "failed", "skipped"]).pipe(
  $I.annoteSchema("AiMetricsInstallDoctorCheckStatus", {
    description: "Bounded status for one AI metrics install doctor check.",
  })
);

/**
 * Runtime type for {@link AiMetricsInstallDoctorCheckStatus}.
 *
 * **Example** (Assign passed status type)
 *
 * ```ts
 * import type { AiMetricsInstallDoctorCheckStatus } from "@beep/repo-ai-metrics"
 * const status: AiMetricsInstallDoctorCheckStatus = "passed"
 * console.log(status)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type AiMetricsInstallDoctorCheckStatus = typeof AiMetricsInstallDoctorCheckStatus.Type;

/**
 * Overall P5a install doctor result status.
 *
 * **Example** (Log warning doctor status)
 *
 * ```ts
 * import { AiMetricsInstallDoctorStatus } from "@beep/repo-ai-metrics"
 * console.log(AiMetricsInstallDoctorStatus.Enum.warning)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AiMetricsInstallDoctorStatus = LiteralKit(["passed", "warning", "failed"]).pipe(
  $I.annoteSchema("AiMetricsInstallDoctorStatus", {
    description: "Aggregate AI metrics install doctor status.",
  })
);

/**
 * Runtime type for {@link AiMetricsInstallDoctorStatus}.
 *
 * **Example** (Assign warning status type)
 *
 * ```ts
 * import type { AiMetricsInstallDoctorStatus } from "@beep/repo-ai-metrics"
 * const status: AiMetricsInstallDoctorStatus = "warning"
 * console.log(status)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type AiMetricsInstallDoctorStatus = typeof AiMetricsInstallDoctorStatus.Type;

/**
 * One P5a install doctor check.
 *
 * **Example** (Make storage layout check)
 *
 * ```ts
 * import { AiMetricsInstallDoctorCheck } from "@beep/repo-ai-metrics"
 *
 * const check = AiMetricsInstallDoctorCheck.make({
 *   checkId: "storage.layout",
 *   message: "Storage layout resolved.",
 *   status: "passed"
 * })
 * console.log(check.metadata)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AiMetricsInstallDoctorCheck extends S.Class<AiMetricsInstallDoctorCheck>($I`AiMetricsInstallDoctorCheck`)(
  {
    checkId: S.String,
    message: S.String,
    metadata: S.Record(S.String, S.String).pipe(
      S.withConstructorDefault(Effect.succeed({})),
      S.withDecodingDefaultKey(Effect.succeed({}))
    ),
    status: AiMetricsInstallDoctorCheckStatus,
  },
  $I.annote("AiMetricsInstallDoctorCheck", {
    description: "Single contract validation result emitted by the AI metrics install doctor.",
  })
) {}

/**
 * Input for P5a install doctor evaluation.
 *
 * **Example** (Make empty doctor input)
 *
 * ```ts
 * import { AiMetricsInstallDoctorInput } from "@beep/repo-ai-metrics"
 * console.log(AiMetricsInstallDoctorInput.make({}))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AiMetricsInstallDoctorInput extends S.Class<AiMetricsInstallDoctorInput>($I`AiMetricsInstallDoctorInput`)(
  {
    install: AiMetricsInstallInput.pipe(
      S.withConstructorDefault(Effect.succeed(AiMetricsInstallInput.make({}))),
      S.withDecodingDefaultKey(Effect.succeed(AiMetricsInstallInput.make({})))
    ),
    sourceDiscovery: S.optionalKey(AiMetricsSourceDiscoveryResult),
  },
  $I.annote("AiMetricsInstallDoctorInput", {
    description: "Install spec and optional source discovery evidence consumed by the P5a doctor.",
  })
) {}

/**
 * P5a install doctor result.
 *
 * **Example** (Build passed doctor result)
 *
 * ```ts
 * import {
 *   AiMetricsInstallDoctorResult,
 *   AiMetricsInstallPlan,
 *   AiMetricsStorageLayout
 * } from "@beep/repo-ai-metrics"
 *
 * const plan = AiMetricsInstallPlan.make({
 *   defaultTool: "phoenix",
 *   dryRunOnly: true,
 *   services: [],
 *   stackName: "beep-ai-metrics-local",
 *   steps: [],
 *   storage: AiMetricsStorageLayout.make({
 *     dataRoot: ".beep/ai-metrics",
 *     derivedDir: ".beep/ai-metrics/derived",
 *     duckDbPath: ".beep/ai-metrics/derived/ai-metrics.duckdb",
 *     parquetDir: ".beep/ai-metrics/derived/parquet",
 *     rawArchiveDir: ".beep/ai-metrics/raw"
 *   }),
 *   tailnetOnly: true,
 *   target: "local"
 * })
 * const result = AiMetricsInstallDoctorResult.make({
 *   availableSourceCount: 1,
 *   checks: [],
 *   plan,
 *   status: "passed",
 *   target: "local"
 * })
 * console.log(result.status)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AiMetricsInstallDoctorResult extends S.Class<AiMetricsInstallDoctorResult>(
  $I`AiMetricsInstallDoctorResult`
)(
  {
    availableSourceCount: S.Finite,
    checks: S.Array(AiMetricsInstallDoctorCheck),
    plan: AiMetricsInstallPlan,
    status: AiMetricsInstallDoctorStatus,
    target: AiMetricsDeployTarget,
  },
  $I.annote("AiMetricsInstallDoctorResult", {
    description: "Aggregate P5a install doctor result with contract and source availability checks.",
  })
) {}

/**
 * P5a dry-run apply result.
 *
 * **Example** (Build dry-run apply result)
 *
 * ```ts
 * import {
 *   AiMetricsInstallApplyDryRunResult,
 *   AiMetricsInstallPlan,
 *   AiMetricsStorageLayout
 * } from "@beep/repo-ai-metrics"
 *
 * const plan = AiMetricsInstallPlan.make({
 *   defaultTool: "phoenix",
 *   dryRunOnly: true,
 *   services: [],
 *   stackName: "beep-ai-metrics-local",
 *   steps: [],
 *   storage: AiMetricsStorageLayout.make({
 *     dataRoot: ".beep/ai-metrics",
 *     derivedDir: ".beep/ai-metrics/derived",
 *     duckDbPath: ".beep/ai-metrics/derived/ai-metrics.duckdb",
 *     parquetDir: ".beep/ai-metrics/derived/parquet",
 *     rawArchiveDir: ".beep/ai-metrics/raw"
 *   }),
 *   tailnetOnly: true,
 *   target: "local"
 * })
 * const result = AiMetricsInstallApplyDryRunResult.make({
 *   dryRun: true,
 *   message: "No host mutation performed.",
 *   plan,
 *   target: "local"
 * })
 * console.log(result.dryRun)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AiMetricsInstallApplyDryRunResult extends S.Class<AiMetricsInstallApplyDryRunResult>(
  $I`AiMetricsInstallApplyDryRunResult`
)(
  {
    dryRun: S.Literal(true),
    message: S.String,
    plan: AiMetricsInstallPlan,
    target: AiMetricsDeployTarget,
  },
  $I.annote("AiMetricsInstallApplyDryRunResult", {
    description: "Dry-run-only P5a apply output that lists the install steps without mutating local or remote state.",
  })
) {}

const makeStorageLayout = (dataRoot: string): AiMetricsStorageLayout =>
  AiMetricsStorageLayout.make({
    dataRoot,
    derivedDir: childPath(dataRoot, "derived"),
    duckDbPath: childPath(dataRoot, "derived/ai-metrics.duckdb"),
    parquetDir: childPath(dataRoot, "derived/parquet"),
    rawArchiveDir: childPath(dataRoot, "raw"),
  });

const serviceImage = (tool: AiMetricsTool, phoenixImage: string): string =>
  AiMetricsTool.$match(tool, {
    langfuse: () => "langfuse/langfuse:latest",
    opik: () => "comet/opik:latest",
    phoenix: () => phoenixImage,
    posthog: () => "posthog/posthog:latest",
  });

const composeServiceName = (tool: AiMetricsTool): string => `ai-metrics-${tool}`;

const servicePublicUrl = (
  target: AiMetricsDeployTarget,
  tool: AiMetricsTool,
  internalUrl: string,
  publicBaseUrl: string
): string => {
  if (target === AiMetricsDeployTarget.Enum.local) {
    return internalUrl;
  }

  if (tool === AiMetricsTool.Enum.phoenix) {
    return publicBaseUrl;
  }

  return `${publicBaseUrl}/ai-metrics/${tool}`;
};

const makeOtlpEndpointSpec = (
  target: AiMetricsDeployTarget,
  tool: AiMetricsTool,
  baseUrl: string
): AiMetricsOtlpEndpointSpec =>
  AiMetricsOtlpEndpointSpec.make({
    baseUrl,
    protocol: AiMetricsOtlpProtocol.Enum["http/protobuf"],
    resourceAttributes: {
      "ai_metrics.target": target,
      "ai_metrics.tool": tool,
      "service.namespace": "beep",
    },
    signalScope: AiMetricsOtlpSignalScope.Enum.traces_only,
    traceUrl: `${baseUrl}/v1/traces`,
  });

const makeServiceSpec =
  (target: AiMetricsDeployTarget, defaultTool: AiMetricsTool, publicBaseUrl: string, phoenixImage: string) =>
  (tool: AiMetricsTool): AiMetricsServiceSpec => {
    const internalUrl = `http://127.0.0.1:${servicePort(tool)}`;
    const publicUrl = servicePublicUrl(target, tool, internalUrl, publicBaseUrl);

    return AiMetricsServiceSpec.make({
      composeServiceName: composeServiceName(tool),
      enabledByDefault: tool === defaultTool,
      healthUrl: publicUrl,
      image: serviceImage(tool, phoenixImage),
      internalUrl,
      otlp: makeOtlpEndpointSpec(target, tool, publicUrl),
      publicUrl,
      tool,
    });
  };

const withHashSaltSecret =
  (hashSaltSecretRef: O.Option<string>) =>
  (command: string): string =>
    pipe(
      hashSaltSecretRef,
      O.match({
        onNone: () => command,
        onSome: (ref) => `BEEP_AI_METRICS_HASH_SALT="$(op read ${shellQuote(ref)})" ${command}`,
      })
    );

const rawArchiveKeyPrefix = (rawRef: string): string =>
  `BEEP_AI_METRICS_RAW_ARCHIVE_KEY="$(op read ${shellQuote(rawRef)})"`;

const withInstallSecretRefFlags =
  (hashSaltSecretRef: O.Option<string>, rawArchiveKeySecretRef: O.Option<string>) =>
  (command: string): string =>
    pipe(
      [
        pipe(
          hashSaltSecretRef,
          O.map((ref) => `--hash-salt-secret-ref ${shellQuote(ref)}`)
        ),
        pipe(
          rawArchiveKeySecretRef,
          O.map((ref) => `--raw-archive-key-secret-ref ${shellQuote(ref)}`)
        ),
      ],
      A.getSomes,
      (flags) =>
        A.match(flags, {
          onEmpty: () => command,
          onNonEmpty: (nonEmptyFlags) => `${command} ${pipe(nonEmptyFlags, A.join(" "))}`,
        })
    );

const planStep = ({
  command,
  description,
  kind,
  mutatesHost,
  order,
  required = true,
  requiresRemote,
  stepId,
  title,
}: {
  readonly command: string;
  readonly description: string;
  readonly kind: AiMetricsInstallPlanStepKind;
  readonly mutatesHost: boolean;
  readonly order: number;
  readonly required?: boolean;
  readonly requiresRemote: boolean;
  readonly stepId: string;
  readonly title: string;
}): AiMetricsInstallPlanStep =>
  AiMetricsInstallPlanStep.make({
    command,
    description,
    kind,
    mutatesHost,
    order,
    required,
    requiresRemote,
    stepId,
    title,
  });

const deploymentRemoteFields = (
  target: AiMetricsDeployTarget
): Pick<AiMetricsInstallPlanStep, "mutatesHost" | "requiresRemote"> => ({
  mutatesHost: target === AiMetricsDeployTarget.Enum.dankserver,
  requiresRemote: target === AiMetricsDeployTarget.Enum.dankserver,
});

const makeInstallPlanSteps = (
  spec: AiMetricsInstallSpec,
  hashSaltSecretRef: O.Option<string>,
  rawArchiveKeySecretRef: O.Option<string>
): ReadonlyArray<AiMetricsInstallPlanStep> => {
  const remote = deploymentRemoteFields(spec.target);
  const installFlags = withInstallSecretRefFlags(hashSaltSecretRef, rawArchiveKeySecretRef);
  const defaultService = pipe(
    spec.services,
    A.findFirst((service) => service.enabledByDefault)
  );
  const otlpBaseUrlFlag = pipe(
    defaultService,
    O.map((service) =>
      spec.target === AiMetricsDeployTarget.Enum.dankserver ? ` --otlp-base-url ${service.publicUrl}` : ""
    ),
    O.getOrElse(() => "")
  );
  const collectorDataRootFlag =
    spec.target === AiMetricsDeployTarget.Enum.dankserver ? ` --data-root ${localCollectorDataRoot}` : "";

  return [
    planStep({
      command: `mkdir -p ${spec.storage.rawArchiveDir} ${spec.storage.parquetDir}`,
      description: "Create raw archive and derived Parquet directories for the selected target.",
      kind: AiMetricsInstallPlanStepKind.Enum.storage,
      mutatesHost: remote.mutatesHost,
      order: 10,
      requiresRemote: remote.requiresRemote,
      stepId: "storage.prepare",
      title: "Prepare AI metrics storage",
    }),
    planStep({
      command:
        spec.target === AiMetricsDeployTarget.Enum.local
          ? "beep-cli ai-metrics install compose --target local"
          : "cd infra && pulumi preview --stack beep-ai-metrics-dankserver",
      description: "Render or preview the Phoenix-only backend deployment.",
      kind: AiMetricsInstallPlanStepKind.Enum.backend,
      mutatesHost: false,
      order: 20,
      requiresRemote: spec.target === AiMetricsDeployTarget.Enum.dankserver,
      stepId: "backend.phoenix.plan",
      title: "Plan Phoenix backend",
    }),
    planStep({
      command: "beep-cli ai-metrics sources discover --target local",
      description: "Discover local Codex, Claude Code, and OpenClaw source availability without exposing paths.",
      kind: AiMetricsInstallPlanStepKind.Enum.source_discovery,
      mutatesHost: false,
      order: 30,
      requiresRemote: false,
      stepId: "sources.discover",
      title: "Discover local AI sources",
    }),
    planStep({
      command: "beep-cli ai-metrics config snapshot",
      description: "Hash repo-local agent-facing configuration for attribution.",
      kind: AiMetricsInstallPlanStepKind.Enum.config_snapshot,
      mutatesHost: false,
      order: 40,
      requiresRemote: false,
      stepId: "config.snapshot",
      title: "Create config snapshot",
    }),
    planStep({
      command: "beep-cli ai-metrics privacy check --source codex --input ~/.codex/sessions",
      description: "Run a redaction proof against local Codex transcript inputs before derived export.",
      kind: AiMetricsInstallPlanStepKind.Enum.privacy_check,
      mutatesHost: false,
      order: 50,
      requiresRemote: false,
      stepId: "privacy.check",
      title: "Run privacy proof",
    }),
    planStep({
      command: pipe(
        rawArchiveKeySecretRef,
        O.match({
          onNone: () =>
            withHashSaltSecret(hashSaltSecretRef)(
              `BEEP_AI_METRICS_RAW_ARCHIVE_KEY=<base64-32-byte-key> beep-cli ai-metrics forwarder run --target ${spec.target}${collectorDataRootFlag}${spec.target === AiMetricsDeployTarget.Enum.dankserver ? " --otlp" : ""}${otlpBaseUrlFlag}`
            ),
          onSome: (rawRef) =>
            withHashSaltSecret(hashSaltSecretRef)(
              `${rawArchiveKeyPrefix(rawRef)} beep-cli ai-metrics forwarder run --target ${spec.target}${collectorDataRootFlag} --raw-archive-key-secret-ref ${shellQuote(rawRef)}${spec.target === AiMetricsDeployTarget.Enum.dankserver ? " --otlp" : ""}${otlpBaseUrlFlag}`
            ),
        })
      ),
      description:
        spec.target === AiMetricsDeployTarget.Enum.dankserver
          ? "Populate local encrypted raw archive objects and export redacted spans to remote Phoenix."
          : "Populate encrypted raw archive objects and redacted derived DuckDB tables.",
      kind: AiMetricsInstallPlanStepKind.Enum.forwarder,
      mutatesHost: false,
      order: 60,
      requiresRemote: remote.requiresRemote,
      stepId: "forwarder.run",
      title: "Run durable forwarder",
    }),
    planStep({
      command: installFlags(
        `beep-cli ai-metrics forwarder timer --target ${spec.target}${collectorDataRootFlag}${otlpBaseUrlFlag}`
      ),
      description:
        "Render the workstation systemd user timer that owns repeated P6a collection with lock, retry, status, and journal evidence.",
      kind: AiMetricsInstallPlanStepKind.Enum.forwarder_timer,
      mutatesHost: false,
      order: 65,
      requiresRemote: false,
      stepId: "forwarder.timer",
      title: "Render forwarder timer",
    }),
    planStep({
      command: installFlags(
        `beep-cli ai-metrics otlp export --target ${spec.target}${collectorDataRootFlag} --ingest-run latest${otlpBaseUrlFlag}`
      ),
      description: "Export redacted derived spans to the Phoenix OTLP trace endpoint.",
      kind: AiMetricsInstallPlanStepKind.Enum.otlp_export,
      mutatesHost: false,
      order: 70,
      requiresRemote: spec.target === AiMetricsDeployTarget.Enum.dankserver,
      stepId: "otlp.export",
      title: "Export derived OTLP spans",
    }),
    planStep({
      command: installFlags(
        `beep-cli ai-metrics label queue --target ${spec.target}${collectorDataRootFlag} --limit 20`
      ),
      description: "Review real tasks that need outcome labels before weekly scoring.",
      kind: AiMetricsInstallPlanStepKind.Enum.label_queue,
      mutatesHost: false,
      order: 80,
      requiresRemote: false,
      stepId: "labels.queue",
      title: "Review outcome label queue",
    }),
    planStep({
      command: installFlags(`beep-cli ai-metrics report weekly --target ${spec.target}${collectorDataRootFlag}`),
      description: "Generate the weekly config-impact scorecard from derived data.",
      kind: AiMetricsInstallPlanStepKind.Enum.weekly_report,
      mutatesHost: false,
      order: 90,
      requiresRemote: false,
      stepId: "report.weekly",
      title: "Generate weekly scorecard",
    }),
    planStep({
      command: pipe(
        rawArchiveKeySecretRef,
        O.match({
          onNone: () =>
            withHashSaltSecret(hashSaltSecretRef)(
              `BEEP_AI_METRICS_RAW_ARCHIVE_KEY=<base64-32-byte-key> ${installFlags(`beep-cli ai-metrics archive drill --target ${spec.target}${collectorDataRootFlag}`)}`
            ),
          onSome: (rawRef) =>
            `${rawArchiveKeyPrefix(rawRef)} ${withHashSaltSecret(hashSaltSecretRef)(
              installFlags(`beep-cli ai-metrics archive drill --target ${spec.target}${collectorDataRootFlag}`)
            )}`,
        })
      ),
      description: "Run a small archive decrypt or restore drill before restarting the credited seven-day proof.",
      kind: AiMetricsInstallPlanStepKind.Enum.retention_drill,
      mutatesHost: false,
      order: 95,
      requiresRemote: false,
      stepId: "archive.drill",
      title: "Run archive drill",
    }),
    planStep({
      command:
        spec.target === AiMetricsDeployTarget.Enum.local
          ? "curl -fsS http://127.0.0.1:6006"
          : pipe(
              defaultService,
              O.map((service) => `tailscale status && curl -fsS ${service.healthUrl}`),
              O.getOrElse(() => "tailscale status && curl -fsS https://dankserver.tailc7c348.ts.net:8447")
            ),
      description: "Verify the Phoenix UI or tailnet route is reachable after P5b apply.",
      kind: AiMetricsInstallPlanStepKind.Enum.health,
      mutatesHost: false,
      order: 100,
      requiresRemote: spec.target === AiMetricsDeployTarget.Enum.dankserver,
      stepId: "health.phoenix",
      title: "Check Phoenix health",
    }),
  ];
};

const plannedCommands = (
  target: AiMetricsDeployTarget,
  storage: AiMetricsStorageLayout,
  hashSaltSecretRef: O.Option<string>,
  rawArchiveKeySecretRef: O.Option<string>,
  publicBaseUrl: string
): ReadonlyArray<string> => [
  `mkdir -p ${storage.rawArchiveDir} ${storage.parquetDir}`,
  "beep-cli ai-metrics install compose --target local > ai-metrics.phoenix.compose.yaml",
  withHashSaltSecret(hashSaltSecretRef)(`beep-cli ai-metrics sources discover --target ${target}`),
  "beep-cli ai-metrics config snapshot",
  withHashSaltSecret(hashSaltSecretRef)("beep-cli ai-metrics privacy check --source codex --input ~/.codex/sessions"),
  pipe(
    rawArchiveKeySecretRef,
    O.match({
      onNone: () =>
        withHashSaltSecret(hashSaltSecretRef)(
          `BEEP_AI_METRICS_RAW_ARCHIVE_KEY=<base64-32-byte-key> beep-cli ai-metrics forwarder run --target ${target}${target === AiMetricsDeployTarget.Enum.dankserver ? ` --data-root ${localCollectorDataRoot} --otlp --otlp-base-url ${publicBaseUrl}` : ""}`
        ),
      onSome: (rawRef) =>
        withHashSaltSecret(hashSaltSecretRef)(
          `${rawArchiveKeyPrefix(rawRef)} beep-cli ai-metrics forwarder run --target ${target}${target === AiMetricsDeployTarget.Enum.dankserver ? ` --data-root ${localCollectorDataRoot}` : ""} --raw-archive-key-secret-ref ${shellQuote(rawRef)}${target === AiMetricsDeployTarget.Enum.dankserver ? ` --otlp --otlp-base-url ${publicBaseUrl}` : ""}`
        ),
    })
  ),
  withInstallSecretRefFlags(
    hashSaltSecretRef,
    rawArchiveKeySecretRef
  )(
    `beep-cli ai-metrics forwarder timer --target ${target}${target === AiMetricsDeployTarget.Enum.dankserver ? ` --data-root ${localCollectorDataRoot} --otlp-base-url ${publicBaseUrl}` : ""}`
  ),
  withInstallSecretRefFlags(
    hashSaltSecretRef,
    rawArchiveKeySecretRef
  )(
    `beep-cli ai-metrics otlp export --target ${target}${target === AiMetricsDeployTarget.Enum.dankserver ? ` --data-root ${localCollectorDataRoot}` : ""} --ingest-run latest${target === AiMetricsDeployTarget.Enum.dankserver ? ` --otlp-base-url ${publicBaseUrl}` : ""}`
  ),
  withInstallSecretRefFlags(
    hashSaltSecretRef,
    rawArchiveKeySecretRef
  )(
    `beep-cli ai-metrics label queue --target ${target}${target === AiMetricsDeployTarget.Enum.dankserver ? ` --data-root ${localCollectorDataRoot}` : ""} --limit 20`
  ),
  withInstallSecretRefFlags(
    hashSaltSecretRef,
    rawArchiveKeySecretRef
  )(
    `beep-cli ai-metrics report weekly --target ${target}${target === AiMetricsDeployTarget.Enum.dankserver ? ` --data-root ${localCollectorDataRoot}` : ""}`
  ),
  pipe(
    rawArchiveKeySecretRef,
    O.match({
      onNone: () =>
        withHashSaltSecret(hashSaltSecretRef)(
          `BEEP_AI_METRICS_RAW_ARCHIVE_KEY=<base64-32-byte-key> ${withInstallSecretRefFlags(
            hashSaltSecretRef,
            rawArchiveKeySecretRef
          )(
            `beep-cli ai-metrics archive drill --target ${target}${target === AiMetricsDeployTarget.Enum.dankserver ? ` --data-root ${localCollectorDataRoot}` : ""}`
          )}`
        ),
      onSome: (rawRef) =>
        `${rawArchiveKeyPrefix(rawRef)} ${withHashSaltSecret(hashSaltSecretRef)(
          withInstallSecretRefFlags(
            hashSaltSecretRef,
            rawArchiveKeySecretRef
          )(
            `beep-cli ai-metrics archive drill --target ${target}${target === AiMetricsDeployTarget.Enum.dankserver ? ` --data-root ${localCollectorDataRoot}` : ""}`
          )
        )}`,
    })
  ),
];

const encodeInstallPlanJson = S.encodeUnknownEffect(S.fromJsonString(AiMetricsInstallPlan));
const encodeInstallDoctorJson = S.encodeUnknownEffect(S.fromJsonString(AiMetricsInstallDoctorResult));
const encodeInstallApplyDryRunJson = S.encodeUnknownEffect(S.fromJsonString(AiMetricsInstallApplyDryRunResult));

const encodeInstallContractJson =
  <A>(encoder: (value: A) => Effect.Effect<string, S.SchemaError>) =>
  (failureMessage: string) =>
  (value: A): Effect.Effect<string, AiMetricsInstallConfigurationError> =>
    encoder(value).pipe(
      Effect.mapError((cause) =>
        AiMetricsInstallConfigurationError.make({
          cause,
          message: failureMessage,
        })
      )
    );

const availableSourceCount = (result: AiMetricsSourceDiscoveryResult | undefined): number =>
  result === undefined
    ? 0
    : pipe(
        result.sources,
        A.filter((source) => source.status === AiMetricsSourceStatus.Enum.available),
        A.length
      );

const sourceStatusMetadata: (result: AiMetricsSourceDiscoveryResult) => Record<string, string> = flow(
  (result) => result.sources,
  A.map((source) => [source.sourceKind, source.status] as const),
  R.fromEntries
);

const hasFailedCheck: (checks: ReadonlyArray<AiMetricsInstallDoctorCheck>) => boolean = flow(
  A.some((check) => check.status === AiMetricsInstallDoctorCheckStatus.Enum.failed)
);

const hasWarningCheck: (checks: ReadonlyArray<AiMetricsInstallDoctorCheck>) => boolean = flow(
  A.some((check) => check.status === AiMetricsInstallDoctorCheckStatus.Enum.warning)
);

const doctorStatusFor = (checks: ReadonlyArray<AiMetricsInstallDoctorCheck>): AiMetricsInstallDoctorStatus => {
  if (hasFailedCheck(checks)) {
    return AiMetricsInstallDoctorStatus.Enum.failed;
  }

  if (hasWarningCheck(checks)) {
    return AiMetricsInstallDoctorStatus.Enum.warning;
  }

  return AiMetricsInstallDoctorStatus.Enum.passed;
};

const check = ({
  checkId,
  message,
  metadata = {},
  status,
}: {
  readonly checkId: string;
  readonly message: string;
  readonly metadata?: Record<string, string>;
  readonly status: AiMetricsInstallDoctorCheckStatus;
}): AiMetricsInstallDoctorCheck =>
  AiMetricsInstallDoctorCheck.make({
    checkId,
    message,
    metadata,
    status,
  });

/**
 * Resolve an install spec for the requested AI metrics target.
 *
 * **Example** (Resolve default install spec)
 *
 * ```ts
 * import { makeAiMetricsInstallSpec } from "@beep/repo-ai-metrics"
 * import { Effect } from "effect"
 * const spec = Effect.runSync(makeAiMetricsInstallSpec())
 * console.log(spec.storage.rawArchiveDir)
 * ```
 *
 * @param input - Optional operator install preferences; omitted fields use the local target defaults.
 * @returns An effect that resolves the normalized install spec consumed by IaC and CLI planning.
 * @category constructors
 * @since 0.0.0
 */
export const makeAiMetricsInstallSpec: (
  input?: AiMetricsInstallInput
) => Effect.Effect<AiMetricsInstallSpec, AiMetricsInstallConfigurationError> = Effect.fn(
  "AiMetrics.makeAiMetricsInstallSpec"
)(function* (input: AiMetricsInstallInput = AiMetricsInstallInput.make({})) {
  const dataRoot = input.dataRoot ?? defaultDataRoot(input.target);
  const publicBaseUrl = input.publicBaseUrl ?? defaultPublicBaseUrl(input.target);
  const hashSaltSecretRef = yield* requireHashSaltSecretRef(input.target, input.hashSaltSecretRef);
  const rawArchiveKeySecretRef = yield* requireRawArchiveKeySecretRef(input.target, input.rawArchiveKeySecretRef);
  const storage = makeStorageLayout(dataRoot);
  const services = A.map(
    input.candidateTools,
    makeServiceSpec(input.target, input.defaultTool, publicBaseUrl, input.phoenixImage)
  );

  return AiMetricsInstallSpec.make({
    candidateTools: input.candidateTools,
    defaultScoreWeights: AiMetricsScoreWeights.make({}),
    defaultTool: input.defaultTool,
    ...(O.isSome(hashSaltSecretRef) ? { hashSaltSecretRef: hashSaltSecretRef.value } : {}),
    litellmGatewayEnabled: input.litellmGatewayEnabled,
    plannedCommands: plannedCommands(input.target, storage, hashSaltSecretRef, rawArchiveKeySecretRef, publicBaseUrl),
    privacyMode: input.privacyMode,
    ...(O.isSome(rawArchiveKeySecretRef) ? { rawArchiveKeySecretRef: rawArchiveKeySecretRef.value } : {}),
    services,
    stackName: `beep-ai-metrics-${input.target}`,
    storage,
    tailnetOnly: input.tailnetOnly,
    target: input.target,
  });
});

/**
 * Resolve the typed P5a install plan for a target without mutating local or remote state.
 *
 * **Example** (Yield default install plan)
 *
 * ```ts
 * import { makeAiMetricsInstallPlan } from "@beep/repo-ai-metrics"
 * import { Effect } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const plan = yield* makeAiMetricsInstallPlan()
 *   console.log(plan.dryRunOnly)
 * })
 * console.log(program)
 * ```
 *
 * @param input - Operator install preferences for the target plan.
 * @returns A typed, dry-runnable plan consumed by CLI plan, doctor, and apply workflows.
 * @category constructors
 * @since 0.0.0
 */
export const makeAiMetricsInstallPlan: (
  input?: AiMetricsInstallInput
) => Effect.Effect<AiMetricsInstallPlan, AiMetricsInstallConfigurationError> = Effect.fn(
  "AiMetrics.makeAiMetricsInstallPlan"
)(function* (input: AiMetricsInstallInput = AiMetricsInstallInput.make({})) {
  const spec = yield* makeAiMetricsInstallSpec(input);
  const hashSaltSecretRef = nonEmptyString(spec.hashSaltSecretRef);
  const rawArchiveKeySecretRef = nonEmptyString(spec.rawArchiveKeySecretRef);
  const steps = makeInstallPlanSteps(spec, hashSaltSecretRef, rawArchiveKeySecretRef);

  return AiMetricsInstallPlan.make({
    defaultTool: spec.defaultTool,
    dryRunOnly: true,
    services: spec.services,
    stackName: spec.stackName,
    steps,
    storage: spec.storage,
    tailnetOnly: spec.tailnetOnly,
    target: spec.target,
  });
});

/**
 * Evaluate the P5a install doctor contract checks.
 *
 * **Example** (Yield default doctor result)
 *
 * ```ts
 * import { makeAiMetricsInstallDoctorResult } from "@beep/repo-ai-metrics"
 * import { Effect } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const result = yield* makeAiMetricsInstallDoctorResult()
 *   console.log(result.status)
 * })
 * console.log(program)
 * ```
 *
 * @param input - Install preferences plus optional source discovery evidence.
 * @returns A typed doctor result with aggregate pass, warning, or failure status.
 * @category constructors
 * @since 0.0.0
 */
export const makeAiMetricsInstallDoctorResult: (
  input?: AiMetricsInstallDoctorInput
) => Effect.Effect<AiMetricsInstallDoctorResult, AiMetricsInstallConfigurationError> = Effect.fn(
  "AiMetrics.makeAiMetricsInstallDoctorResult"
)(function* (input: AiMetricsInstallDoctorInput = AiMetricsInstallDoctorInput.make({})) {
  const plan = yield* makeAiMetricsInstallPlan(input.install);
  const sourceCount = availableSourceCount(input.sourceDiscovery);
  const checks = [
    check({
      checkId: "install.spec",
      message: "Install spec resolved with schema-first target defaults.",
      metadata: { stackName: plan.stackName, target: plan.target },
      status: AiMetricsInstallDoctorCheckStatus.Enum.passed,
    }),
    check({
      checkId: "secrets.refs",
      message:
        plan.target === AiMetricsDeployTarget.Enum.local
          ? "Local target does not require secret-manager references."
          : "Non-local target has required hash salt and raw archive key secret references.",
      status:
        plan.target === AiMetricsDeployTarget.Enum.local
          ? AiMetricsInstallDoctorCheckStatus.Enum.skipped
          : AiMetricsInstallDoctorCheckStatus.Enum.passed,
    }),
    check({
      checkId: "storage.layout",
      message: "Storage layout resolved for raw archive, derived DuckDB, and Parquet snapshots.",
      metadata: { dataRoot: plan.storage.dataRoot },
      status: AiMetricsInstallDoctorCheckStatus.Enum.passed,
    }),
    check({
      checkId: "backend.phoenix",
      message: "Phoenix is the only concrete P5a deployment backend; other candidates remain contracts.",
      metadata: { defaultTool: plan.defaultTool },
      status:
        plan.defaultTool === AiMetricsTool.Enum.phoenix
          ? AiMetricsInstallDoctorCheckStatus.Enum.passed
          : AiMetricsInstallDoctorCheckStatus.Enum.failed,
    }),
    check({
      checkId: "sources.available",
      message: Match.value(input.sourceDiscovery).pipe(
        Match.when(P.isUndefined, () => "Source discovery evidence was not provided to the install doctor."),
        Match.when(
          () => sourceCount === 0,
          () => "No local Codex, Claude Code, or OpenClaw sources are available."
        ),
        Match.orElse(() => "At least one local AI source is available for live collection.")
      ),
      metadata:
        input.sourceDiscovery === undefined
          ? {}
          : {
              availableSourceCount: `${sourceCount}`,
              ...sourceStatusMetadata(input.sourceDiscovery),
            },
      status: Match.value(input.sourceDiscovery).pipe(
        Match.when(P.isUndefined, () => AiMetricsInstallDoctorCheckStatus.Enum.warning),
        Match.when(
          () => sourceCount === 0,
          () => AiMetricsInstallDoctorCheckStatus.Enum.failed
        ),
        Match.when(
          (sourceDiscovery) => sourceCount < A.length(sourceDiscovery.sources),
          () => AiMetricsInstallDoctorCheckStatus.Enum.warning
        ),
        Match.orElse(() => AiMetricsInstallDoctorCheckStatus.Enum.passed)
      ),
    }),
    check({
      checkId: "apply.mode",
      message: "CLI install apply remains dry-run-only; real dankserver mutation is owned by the Pulumi P5b stack.",
      status: AiMetricsInstallDoctorCheckStatus.Enum.passed,
    }),
  ];

  return AiMetricsInstallDoctorResult.make({
    availableSourceCount: sourceCount,
    checks,
    plan,
    status: doctorStatusFor(checks),
    target: plan.target,
  });
});

/**
 * Resolve the P5a dry-run apply result.
 *
 * **Example** (Yield dry-run apply result)
 *
 * ```ts
 * import { makeAiMetricsInstallApplyDryRunResult } from "@beep/repo-ai-metrics"
 * import { Effect } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const result = yield* makeAiMetricsInstallApplyDryRunResult()
 *   console.log(result.dryRun)
 * })
 * console.log(program)
 * ```
 *
 * @param input - Operator install preferences for the dry-run apply.
 * @returns A dry-run-only apply result listing the CLI-safe steps around the Pulumi P5b stack.
 * @category constructors
 * @since 0.0.0
 */
export const makeAiMetricsInstallApplyDryRunResult: (
  input?: AiMetricsInstallInput
) => Effect.Effect<AiMetricsInstallApplyDryRunResult, AiMetricsInstallConfigurationError> = Effect.fn(
  "AiMetrics.makeAiMetricsInstallApplyDryRunResult"
)(function* (input: AiMetricsInstallInput = AiMetricsInstallInput.make({})) {
  const plan = yield* makeAiMetricsInstallPlan(input);

  return AiMetricsInstallApplyDryRunResult.make({
    dryRun: true,
    message: "CLI install apply is dry-run-only; run the Pulumi P5b stack for real remote mutation.",
    plan,
    target: plan.target,
  });
});

/**
 * Render a P5a install plan as JSON.
 *
 * **Example** (Serialize plan to JSON)
 *
 * ```ts
 * import { aiMetricsInstallPlanToJson, makeAiMetricsInstallPlan } from "@beep/repo-ai-metrics"
 * import { Effect } from "effect"
 *
 * const json = Effect.runPromise(
 *   makeAiMetricsInstallPlan().pipe(
 *     Effect.flatMap((plan) => aiMetricsInstallPlanToJson(plan))
 *   )
 * )
 * console.log(json)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const aiMetricsInstallPlanToJson: (
  result: AiMetricsInstallPlan
) => Effect.Effect<string, AiMetricsInstallConfigurationError> = encodeInstallContractJson(encodeInstallPlanJson)(
  "Failed to encode AI metrics install plan as JSON."
);

/**
 * Render a P5a install doctor result as JSON.
 *
 * **Example** (Serialize doctor to JSON)
 *
 * ```ts
 * import { aiMetricsInstallDoctorToJson, makeAiMetricsInstallDoctorResult } from "@beep/repo-ai-metrics"
 * import { Effect } from "effect"
 *
 * const json = Effect.runPromise(
 *   makeAiMetricsInstallDoctorResult().pipe(
 *     Effect.flatMap((result) => aiMetricsInstallDoctorToJson(result))
 *   )
 * )
 * console.log(json)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const aiMetricsInstallDoctorToJson: (
  result: AiMetricsInstallDoctorResult
) => Effect.Effect<string, AiMetricsInstallConfigurationError> = encodeInstallContractJson(encodeInstallDoctorJson)(
  "Failed to encode AI metrics install doctor result as JSON."
);

/**
 * Render a P5a dry-run apply result as JSON.
 *
 * **Example** (Serialize dry-run to JSON)
 *
 * ```ts
 * import {
 *   aiMetricsInstallApplyDryRunToJson,
 *   makeAiMetricsInstallApplyDryRunResult
 * } from "@beep/repo-ai-metrics"
 * import { Effect } from "effect"
 *
 * const json = Effect.runPromise(
 *   makeAiMetricsInstallApplyDryRunResult().pipe(
 *     Effect.flatMap((result) => aiMetricsInstallApplyDryRunToJson(result))
 *   )
 * )
 * console.log(json)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const aiMetricsInstallApplyDryRunToJson: (
  result: AiMetricsInstallApplyDryRunResult
) => Effect.Effect<string, AiMetricsInstallConfigurationError> = encodeInstallContractJson(
  encodeInstallApplyDryRunJson
)("Failed to encode AI metrics install dry-run result as JSON.");
