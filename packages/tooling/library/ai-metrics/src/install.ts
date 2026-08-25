/**
 * Target-agnostic install spec for repo AI metrics.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoAiMetricsId } from "@beep/identity/packages";
import { Defect, LiteralKit, SchemaUtils } from "@beep/schema";
import { A, Str } from "@beep/utils";
import * as O from "@beep/utils/Option";
import { Effect, flow, Match, pipe } from "effect";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { AiMetricsDataRootInput, resolveAiMetricsDataRoot } from "./data-root.ts";
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

const defaultCandidateTools = [AiMetricsTool.Enum.langfuse, AiMetricsTool.Enum.phoenix, AiMetricsTool.Enum.opik];

const defaultPhoenixImage = "arizephoenix/phoenix:latest";

const servicePort = (tool: AiMetricsTool): number =>
  AiMetricsTool.$match(tool, {
    langfuse: () => 3001,
    opik: () => 5173,
    phoenix: () => 6006,
    posthog: () => 8000,
  });

const defaultPublicBaseUrl = (target: AiMetricsDeployTarget): string =>
  target === AiMetricsDeployTarget.Enum.dankserver ? "https://dankserver.tailc7c348.ts.net:8447" : "http://127.0.0.1";

const childPath = (root: string, child: string): string => `${root}/${child}`;

const requireInstallDataRoot = Effect.fn("AiMetrics.requireInstallDataRoot")(function* (input: AiMetricsInstallInput) {
  const resolved = resolveAiMetricsDataRoot(
    AiMetricsDataRootInput.make({
      flagDataRoot: O.filter(input.dataRoot, flow(Str.trim, Str.isNonEmpty)),
      homeDir: O.filter(input.homeDir, flow(Str.trim, Str.isNonEmpty)),
      stateHome: O.filter(input.stateHome, flow(Str.trim, Str.isNonEmpty)),
      target: input.target,
    })
  );

  if (O.isNone(resolved)) {
    return yield* AiMetricsInstallConfigurationError.make({
      cause: { target: input.target },
      message:
        "AI metrics install specs require an explicit dataRoot, or homeDir/stateHome to resolve the XDG data root; there is no clone-relative fallback.",
    });
  }

  return resolved.value.path;
});

const requireSecretRef = Effect.fn("AiMetrics.requireSecretRef")(function* (
  target: AiMetricsDeployTarget,
  secretRef: O.Option<string>,
  missingMessage: string
) {
  const ref = O.filter(secretRef, flow(Str.trim, Str.isNonEmpty));
  if (target === AiMetricsDeployTarget.Enum.local || O.isSome(ref)) {
    return ref;
  }

  return yield* AiMetricsInstallConfigurationError.make({
    cause: { target },
    message: missingMessage,
  });
});

const requireHashSaltSecretRef = Effect.fn("AiMetrics.requireHashSaltSecretRef")(function* (
  target: AiMetricsDeployTarget,
  hashSaltSecretRef: O.Option<string>
) {
  return yield* requireSecretRef(
    target,
    hashSaltSecretRef,
    "AI metrics non-local installs require hashSaltSecretRef so private identifier hashing never uses the local smoke salt."
  );
});

const requireRawArchiveKeySecretRef = Effect.fn("AiMetrics.requireRawArchiveKeySecretRef")(function* (
  target: AiMetricsDeployTarget,
  rawArchiveKeySecretRef: O.Option<string>
) {
  return yield* requireSecretRef(
    target,
    rawArchiveKeySecretRef,
    "AI metrics non-local installs require rawArchiveKeySecretRef so encrypted raw transcripts never depend on inline operator input."
  );
});

/**
 * Typed failure raised when an install spec would be unsafe for the requested target.
 *
 * **Details**
 *
 * Resolution refuses rather than substitutes. A non-local target without secret
 * references, or a local target with no way to resolve a data root, fails here
 * instead of falling back to a value the operator never chose — a silent
 * fallback is what put the canonical store inside a clone in the first place.
 *
 * **Example** (Constructing the failure)
 *
 * ```ts
 * import { AiMetricsInstallConfigurationError } from "@beep/repo-ai-metrics"
 *
 * const error = AiMetricsInstallConfigurationError.make({
 *   cause: "missing secret reference",
 *   message: "dankserver target requires a raw archive key secret reference."
 * })
 *
 * console.log(error._tag) // "AiMetricsInstallConfigurationError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class AiMetricsInstallConfigurationError extends S.TaggedError<AiMetricsInstallConfigurationError>(
  $I`AiMetricsInstallConfigurationError`
)(
  "AiMetricsInstallConfigurationError",
  {
    cause: Defect({ includeStack: true }),
    message: S.String,
  },
  $I.annoteError<AiMetricsInstallConfigurationError>("AiMetricsInstallConfigurationError", {
    description:
      "Typed failure raised when a requested AI metrics install target is missing required safety configuration.",
  })
) {}

/**
 * Operator choices that resolve into a complete install spec.
 *
 * **Details**
 *
 * Every field except the data-root inputs has a safe default, so `make({})`
 * describes a local Phoenix stack with encrypted raw storage and tailnet-only
 * exposure. `dataRoot`, `homeDir`, and `stateHome` feed data-root precedence:
 * supply `dataRoot` to name the store outright, or `homeDir`/`stateHome` to let
 * it resolve under the XDG state home.
 *
 * **Gotchas**
 *
 * A `local` target with none of `dataRoot`, `homeDir`, or `stateHome` fails
 * resolution rather than defaulting. Resolve the root at the process edge.
 *
 * **Example** (The default local stack)
 *
 * ```ts
 * import { AiMetricsInstallInput } from "@beep/repo-ai-metrics"
 * import * as O from "effect/Option"
 *
 * const input = AiMetricsInstallInput.make({ homeDir: O.some("/home/dev") })
 *
 * console.log(input.target) // "local"
 * console.log(input.defaultTool) // "phoenix"
 * console.log(input.tailnetOnly) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AiMetricsInstallInput extends S.Class<AiMetricsInstallInput>($I`AiMetricsInstallInput`)(
  {
    candidateTools: S.Array(AiMetricsTool).pipe(SchemaUtils.withKeyDefaults(defaultCandidateTools)),
    dataRoot: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    defaultTool: AiMetricsTool.pipe(SchemaUtils.withKeyDefaults(AiMetricsTool.Enum.phoenix)),
    hashSaltSecretRef: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    homeDir: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    litellmGatewayEnabled: SchemaUtils.BoolKeyDefaultTrue,
    phoenixImage: S.String.pipe(SchemaUtils.withKeyDefaults(defaultPhoenixImage)),
    privacyMode: AiMetricsPrivacyMode.pipe(
      SchemaUtils.withKeyDefaults(AiMetricsPrivacyMode.Enum.encrypted_raw_redacted_ui)
    ),
    publicBaseUrl: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    rawArchiveKeySecretRef: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    stateHome: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    target: AiMetricsDeployTarget.pipe(SchemaUtils.withKeyDefaults(AiMetricsDeployTarget.Enum.local)),
    tailnetOnly: SchemaUtils.BoolKeyDefaultTrue,
  },
  $I.annote("AiMetricsInstallInput", {
    description: "User-selectable inputs for the target-agnostic AI metrics install module.",
  })
) {}

/**
 * Every path an AI metrics store owns, derived from one data root.
 *
 * **Details**
 *
 * The four sub-paths are pure functions of `dataRoot`, so the layout is fully
 * determined once the root is resolved and no consumer has to re-derive a
 * subdirectory name.
 *
 * **Gotchas**
 *
 * Nothing here brands or validates absoluteness. A relative `dataRoot` produces
 * a relative layout that binds to whatever working directory the process
 * inherits — validate with `requireAbsoluteAiMetricsDataRoot` before rendering
 * any of these paths into a unit file or persisting them.
 *
 * **Example** (Deriving the store's paths)
 *
 * ```ts
 * import { AiMetricsStorageLayout } from "@beep/repo-ai-metrics"
 *
 * const storage = AiMetricsStorageLayout.make({
 *   dataRoot: "/home/dev/.local/state/beep/ai-metrics",
 *   derivedDir: "/home/dev/.local/state/beep/ai-metrics/derived",
 *   duckDbPath: "/home/dev/.local/state/beep/ai-metrics/derived/ai-metrics.duckdb",
 *   parquetDir: "/home/dev/.local/state/beep/ai-metrics/derived/parquet",
 *   rawArchiveDir: "/home/dev/.local/state/beep/ai-metrics/raw"
 * })
 *
 * console.log(storage.duckDbPath.startsWith(storage.derivedDir)) // true
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
 * One observability backend the install can run, with every URL a caller needs.
 *
 * **Details**
 *
 * `internalUrl` is how sibling containers reach the service, `publicUrl` is how
 * the operator reaches it, and `healthUrl` is what readiness polls. Keeping all
 * three resolved here is what lets the same spec describe a local compose stack
 * and a remote deployment without call sites rewriting hostnames.
 *
 * **Example** (Describing a local Phoenix backend)
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
 *
 * console.log(service.tool) // "phoenix"
 * console.log(service.otlp.signalScope) // "traces_only"
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
 * The fully resolved install contract shared by the CLI installer and orchestration.
 *
 * **Details**
 *
 * Nothing in the spec is still a choice: storage paths, service endpoints, the
 * privacy mode, and the operator command list are all decided. That is what
 * lets the same value drive a plan, a doctor run, and a dry-run apply without
 * any of them re-deriving a default and disagreeing.
 *
 * **Example** (A resolved local spec)
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
 *     dataRoot: "/home/dev/.local/state/beep/ai-metrics",
 *     derivedDir: "/home/dev/.local/state/beep/ai-metrics/derived",
 *     duckDbPath: "/home/dev/.local/state/beep/ai-metrics/derived/ai-metrics.duckdb",
 *     parquetDir: "/home/dev/.local/state/beep/ai-metrics/derived/parquet",
 *     rawArchiveDir: "/home/dev/.local/state/beep/ai-metrics/raw"
 *   }),
 *   tailnetOnly: true,
 *   target: "local"
 * })
 *
 * console.log(spec.plannedCommands.length) // 1
 * console.log(spec.storage.dataRoot) // /home/dev/.local/state/beep/ai-metrics
 * ```
 *
 * @see {@link makeAiMetricsInstallSpec} for the resolver that produces this spec.
 * @category models
 * @since 0.0.0
 */
export class AiMetricsInstallSpec extends S.Class<AiMetricsInstallSpec>($I`AiMetricsInstallSpec`)(
  {
    candidateTools: S.Array(AiMetricsTool),
    defaultScoreWeights: AiMetricsScoreWeights,
    defaultTool: AiMetricsTool,
    hashSaltSecretRef: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    litellmGatewayEnabled: S.Boolean,
    plannedCommands: S.Array(S.String),
    privacyMode: AiMetricsPrivacyMode,
    rawArchiveKeySecretRef: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
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
 * What kind of work an install-plan step performs.
 *
 * **Details**
 *
 * The kind is what lets a caller filter a plan without parsing command strings
 * — for example running only the read-only checks, or skipping every step that
 * touches a remote host.
 *
 * **Example** (Selecting the storage steps of a plan)
 *
 * ```ts
 * import { AiMetricsInstallPlanStepKind } from "@beep/repo-ai-metrics"
 *
 * const isStorage = AiMetricsInstallPlanStepKind.is.storage
 *
 * console.log(AiMetricsInstallPlanStepKind.Enum.storage) // "storage"
 * console.log(isStorage("forwarder")) // false
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
 * Decoded step-kind literal carried by each install plan step.
 *
 * @see {@link AiMetricsInstallPlanStepKind} for the runtime schema, its guards, and its enum keys.
 * @category models
 * @since 0.0.0
 */
export type AiMetricsInstallPlanStepKind = typeof AiMetricsInstallPlanStepKind.Type;

const AiMetricsInstallPlanStepOrder = S.Int.check(S.isGreaterThan(0)).pipe(
  $I.annoteSchema("AiMetricsInstallPlanStepOrder", {
    description: "Positive integer ordering index for an AI metrics install plan step.",
  })
);

/**
 * One ordered operation in an install plan, described before anything runs.
 *
 * **Details**
 *
 * `mutatesHost` and `requiresRemote` are the two flags that make a plan
 * reviewable: together they say whether a step changes the local machine,
 * reaches out over the network, or merely reads. `order` is the intended
 * sequence, so a filtered subset still runs in a coherent order.
 *
 * **Example** (A read-only discovery step)
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
 *
 * console.log(step.required) // true
 * console.log(step.mutatesHost) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AiMetricsInstallPlanStep extends S.Class<AiMetricsInstallPlanStep>($I`AiMetricsInstallPlanStep`)(
  {
    command: S.NonEmptyString,
    description: S.NonEmptyString,
    mutatesHost: S.Boolean,
    order: AiMetricsInstallPlanStepOrder,
    required: S.Boolean.pipe(SchemaUtils.withKeyDefaults(true)),
    requiresRemote: S.Boolean,
    stepId: S.NonEmptyString,
    title: S.NonEmptyString,
    kind: AiMetricsInstallPlanStepKind,
  },
  $I.annote("AiMetricsInstallPlanStep", {
    description: "Single ordered operation in the dry-runnable AI metrics install plan.",
  })
) {}

/**
 * The ordered steps an install would perform, produced without performing any of them.
 *
 * **Details**
 *
 * A plan is a description, never an execution. `dryRunOnly` records whether the
 * plan was built for review or for a run an operator intends to carry out, and
 * it travels with the plan so a doctor result cannot be mistaken for evidence
 * that the install actually happened.
 *
 * **Example** (An empty local plan)
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
 *     dataRoot: "/home/dev/.local/state/beep/ai-metrics",
 *     derivedDir: "/home/dev/.local/state/beep/ai-metrics/derived",
 *     duckDbPath: "/home/dev/.local/state/beep/ai-metrics/derived/ai-metrics.duckdb",
 *     parquetDir: "/home/dev/.local/state/beep/ai-metrics/derived/parquet",
 *     rawArchiveDir: "/home/dev/.local/state/beep/ai-metrics/raw"
 *   }),
 *   tailnetOnly: true,
 *   target: "local"
 * })
 *
 * console.log(plan.dryRunOnly) // true
 * console.log(plan.steps.length) // 0
 * ```
 *
 * @see {@link AiMetricsInstallPlanStep} for what each step records.
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
) {
  static readonly encodeJsonEffect = S.encodeEffect(S.fromJsonString(AiMetricsInstallPlan));
}

/**
 * Outcome of a single install doctor check.
 *
 * **Details**
 *
 * `skipped` is distinct from `passed` on purpose: a check that could not run
 * because its evidence was unavailable has proven nothing, and collapsing the
 * two would let a doctor report green on a store it never inspected.
 *
 * **Example** (Telling a skipped check from a passing one)
 *
 * ```ts
 * import { AiMetricsInstallDoctorCheckStatus } from "@beep/repo-ai-metrics"
 *
 * const isPassed = AiMetricsInstallDoctorCheckStatus.is.passed
 *
 * console.log(AiMetricsInstallDoctorCheckStatus.Enum.passed) // "passed"
 * console.log(isPassed("skipped")) // false
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
 * Decoded status literal carried by each install doctor check.
 *
 * @see {@link AiMetricsInstallDoctorCheckStatus} for the runtime schema, its guards, and its enum keys.
 * @category models
 * @since 0.0.0
 */
export type AiMetricsInstallDoctorCheckStatus = typeof AiMetricsInstallDoctorCheckStatus.Type;

/**
 * Aggregate verdict over every install doctor check.
 *
 * **Details**
 *
 * The aggregate is the worst individual outcome, and it has no `skipped`
 * member: a run where every check skipped still has to resolve to one of these
 * three so a caller cannot treat "nothing ran" as a pass.
 *
 * **Example** (Gating on the aggregate verdict)
 *
 * ```ts
 * import { AiMetricsInstallDoctorStatus } from "@beep/repo-ai-metrics"
 *
 * const isFailed = AiMetricsInstallDoctorStatus.is.failed
 *
 * console.log(AiMetricsInstallDoctorStatus.Enum.warning) // "warning"
 * console.log(isFailed("warning")) // false
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
 * Decoded aggregate status carried by an install doctor result.
 *
 * @see {@link AiMetricsInstallDoctorStatus} for the runtime schema, its guards, and its enum keys.
 * @category models
 * @since 0.0.0
 */
export type AiMetricsInstallDoctorStatus = typeof AiMetricsInstallDoctorStatus.Type;

/**
 * One named contract check with its outcome and supporting detail.
 *
 * **Details**
 *
 * `checkId` is a stable dotted identifier, so a caller can suppress or gate on
 * a specific check without matching on prose. `metadata` defaults to empty and
 * holds only string values, which keeps a doctor result printable and safe to
 * attach to CI output.
 *
 * **Example** (A passing storage check)
 *
 * ```ts
 * import { AiMetricsInstallDoctorCheck } from "@beep/repo-ai-metrics"
 *
 * const check = AiMetricsInstallDoctorCheck.make({
 *   checkId: "storage.layout",
 *   message: "Storage layout resolved.",
 *   status: "passed"
 * })
 *
 * console.log(check.checkId) // "storage.layout"
 * console.log(check.status) // "passed"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AiMetricsInstallDoctorCheck extends S.Class<AiMetricsInstallDoctorCheck>($I`AiMetricsInstallDoctorCheck`)(
  {
    checkId: S.NonEmptyString,
    message: S.NonEmptyString,
    metadata: S.Record(S.String, S.String).pipe(SchemaUtils.withKeyDefaults({})),
    status: AiMetricsInstallDoctorCheckStatus,
  },
  $I.annote("AiMetricsInstallDoctorCheck", {
    description: "Single contract validation result emitted by the AI metrics install doctor.",
  })
) {}

/**
 * The install choices and optional discovery evidence a doctor run evaluates.
 *
 * **Details**
 *
 * `sourceDiscovery` is optional because the doctor is useful without it: the
 * contract checks still run, and the source-availability checks report
 * `skipped` rather than inventing an answer.
 *
 * **Example** (Doctoring the default local install)
 *
 * ```ts
 * import { AiMetricsInstallDoctorInput, AiMetricsInstallInput } from "@beep/repo-ai-metrics"
 * import * as O from "effect/Option"
 *
 * const input = AiMetricsInstallDoctorInput.make({
 *   install: AiMetricsInstallInput.make({ homeDir: O.some("/home/dev") })
 * })
 *
 * console.log(input.install.target) // "local"
 * console.log(O.isNone(input.sourceDiscovery)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AiMetricsInstallDoctorInput extends S.Class<AiMetricsInstallDoctorInput>($I`AiMetricsInstallDoctorInput`)(
  {
    install: AiMetricsInstallInput.pipe(SchemaUtils.withKeyDefaults(AiMetricsInstallInput.make({}))),
    sourceDiscovery: S.OptionFromOptionalKey(AiMetricsSourceDiscoveryResult).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("AiMetricsInstallDoctorInput", {
    description: "Install spec and optional source discovery evidence consumed by the P5a doctor.",
  })
) {}

/**
 * Every doctor check, the aggregate verdict, and the plan they were run against.
 *
 * **Details**
 *
 * Carrying the `plan` alongside the checks is what makes the result
 * self-contained: a reader can see both the verdict and the exact configuration
 * that produced it, instead of having to re-resolve the spec and hope it still
 * matches.
 *
 * **Example** (A passing doctor result)
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
 *     dataRoot: "/home/dev/.local/state/beep/ai-metrics",
 *     derivedDir: "/home/dev/.local/state/beep/ai-metrics/derived",
 *     duckDbPath: "/home/dev/.local/state/beep/ai-metrics/derived/ai-metrics.duckdb",
 *     parquetDir: "/home/dev/.local/state/beep/ai-metrics/derived/parquet",
 *     rawArchiveDir: "/home/dev/.local/state/beep/ai-metrics/raw"
 *   }),
 *   tailnetOnly: true,
 *   target: "local"
 * })
 *
 * const result = AiMetricsInstallDoctorResult.make({
 *   availableSourceCount: 1,
 *   checks: [],
 *   plan,
 *   status: "passed",
 *   target: "local"
 * })
 *
 * console.log(result.status) // "passed"
 * console.log(result.plan.storage.dataRoot) // /home/dev/.local/state/beep/ai-metrics
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AiMetricsInstallDoctorResult extends S.Class<AiMetricsInstallDoctorResult>(
  $I`AiMetricsInstallDoctorResult`
)(
  {
    availableSourceCount: S.Natural,
    checks: S.Array(AiMetricsInstallDoctorCheck),
    plan: AiMetricsInstallPlan,
    status: AiMetricsInstallDoctorStatus,
    target: AiMetricsDeployTarget,
  },
  $I.annote("AiMetricsInstallDoctorResult", {
    description: "Aggregate P5a install doctor result with contract and source availability checks.",
  })
) {
  static readonly encodeJsonEffect = S.encodeEffect(S.fromJsonString(AiMetricsInstallDoctorResult));
}

/**
 * Proof that an apply listed its steps and changed nothing.
 *
 * **Details**
 *
 * `dryRun` is the literal `true`, not a boolean. The type itself is the
 * guarantee: there is no value of this class that could describe a run which
 * mutated the host, so a caller cannot mistake one for an executed install.
 *
 * **Example** (Recording a no-op apply)
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
 *     dataRoot: "/home/dev/.local/state/beep/ai-metrics",
 *     derivedDir: "/home/dev/.local/state/beep/ai-metrics/derived",
 *     duckDbPath: "/home/dev/.local/state/beep/ai-metrics/derived/ai-metrics.duckdb",
 *     parquetDir: "/home/dev/.local/state/beep/ai-metrics/derived/parquet",
 *     rawArchiveDir: "/home/dev/.local/state/beep/ai-metrics/raw"
 *   }),
 *   tailnetOnly: true,
 *   target: "local"
 * })
 *
 * const result = AiMetricsInstallApplyDryRunResult.make({
 *   dryRun: true,
 *   message: "No host mutation performed.",
 *   plan,
 *   target: "local"
 * })
 *
 * console.log(result.dryRun) // true
 * console.log(result.message) // "No host mutation performed."
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AiMetricsInstallApplyDryRunResult extends S.Class<AiMetricsInstallApplyDryRunResult>(
  $I`AiMetricsInstallApplyDryRunResult`
)(
  {
    dryRun: S.Literal(true).pipe(SchemaUtils.withConstantDefault(true)),
    message: S.NonEmptyString,
    plan: AiMetricsInstallPlan,
    target: AiMetricsDeployTarget,
  },
  $I.annote("AiMetricsInstallApplyDryRunResult", {
    description: "Dry-run-only P5a apply output that lists the install steps without mutating local or remote state.",
  })
) {
  static readonly encodeJsonEffect = S.encodeEffect(S.fromJsonString(AiMetricsInstallApplyDryRunResult));
}

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

const deploymentRemoteFields = (
  target: AiMetricsDeployTarget
): Pick<AiMetricsInstallPlanStep, "mutatesHost" | "requiresRemote"> => ({
  mutatesHost: target === AiMetricsDeployTarget.Enum.dankserver,
  requiresRemote: target === AiMetricsDeployTarget.Enum.dankserver,
});

const deploymentCommandFlags = (
  target: AiMetricsDeployTarget,
  storage: AiMetricsStorageLayout,
  defaultService: O.Option<AiMetricsServiceSpec>
) =>
  AiMetricsDeployTarget.$match(target, {
    dankserver: () => ({
      collectorDataRoot: ` --data-root ${storage.dataRoot}`,
      otlp: " --otlp",
      otlpBaseUrl: pipe(
        defaultService,
        O.map((service) => ` --otlp-base-url ${service.publicUrl}`),
        O.getOrElse(() => "")
      ),
    }),
    local: () => ({ collectorDataRoot: "", otlp: "", otlpBaseUrl: "" }),
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
  const commandFlags = deploymentCommandFlags(spec.target, spec.storage, defaultService);

  return [
    AiMetricsInstallPlanStep.make({
      command: `mkdir -p ${spec.storage.rawArchiveDir} ${spec.storage.parquetDir}`,
      description: "Create raw archive and derived Parquet directories for the selected target.",
      kind: AiMetricsInstallPlanStepKind.Enum.storage,
      mutatesHost: remote.mutatesHost,
      order: 10,
      requiresRemote: remote.requiresRemote,
      stepId: "storage.prepare",
      title: "Prepare AI metrics storage",
    }),
    AiMetricsInstallPlanStep.make({
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
    AiMetricsInstallPlanStep.make({
      command: "beep-cli ai-metrics sources discover --target local",
      description: "Discover local Codex, Claude Code, and OpenClaw source availability without exposing paths.",
      kind: AiMetricsInstallPlanStepKind.Enum.source_discovery,
      mutatesHost: false,
      order: 30,
      requiresRemote: false,
      stepId: "sources.discover",
      title: "Discover local AI sources",
    }),
    AiMetricsInstallPlanStep.make({
      command: "beep-cli ai-metrics config snapshot",
      description: "Hash repo-local agent-facing configuration for attribution.",
      kind: AiMetricsInstallPlanStepKind.Enum.config_snapshot,
      mutatesHost: false,
      order: 40,
      requiresRemote: false,
      stepId: "config.snapshot",
      title: "Create config snapshot",
    }),
    AiMetricsInstallPlanStep.make({
      command: "beep-cli ai-metrics privacy check --source codex --input ~/.codex/sessions",
      description: "Run a redaction proof against local Codex transcript inputs before derived export.",
      kind: AiMetricsInstallPlanStepKind.Enum.privacy_check,
      mutatesHost: false,
      order: 50,
      requiresRemote: false,
      stepId: "privacy.check",
      title: "Run privacy proof",
    }),
    AiMetricsInstallPlanStep.make({
      command: pipe(
        rawArchiveKeySecretRef,
        O.match({
          onNone: () =>
            withHashSaltSecret(hashSaltSecretRef)(
              `BEEP_AI_METRICS_RAW_ARCHIVE_KEY=<base64-32-byte-key> beep-cli ai-metrics forwarder run --target ${spec.target}${commandFlags.collectorDataRoot}${commandFlags.otlp}${commandFlags.otlpBaseUrl}`
            ),
          onSome: (rawRef) =>
            withHashSaltSecret(hashSaltSecretRef)(
              `${rawArchiveKeyPrefix(rawRef)} beep-cli ai-metrics forwarder run --target ${spec.target}${commandFlags.collectorDataRoot} --raw-archive-key-secret-ref ${shellQuote(rawRef)}${commandFlags.otlp}${commandFlags.otlpBaseUrl}`
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
    AiMetricsInstallPlanStep.make({
      command: installFlags(
        `beep-cli ai-metrics forwarder timer --target ${spec.target}${commandFlags.collectorDataRoot}${commandFlags.otlpBaseUrl}`
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
    AiMetricsInstallPlanStep.make({
      command: installFlags(
        `beep-cli ai-metrics otlp export --target ${spec.target}${commandFlags.collectorDataRoot} --ingest-run latest${commandFlags.otlpBaseUrl}`
      ),
      description: "Export redacted derived spans to the Phoenix OTLP trace endpoint.",
      kind: AiMetricsInstallPlanStepKind.Enum.otlp_export,
      mutatesHost: false,
      order: 70,
      requiresRemote: spec.target === AiMetricsDeployTarget.Enum.dankserver,
      stepId: "otlp.export",
      title: "Export derived OTLP spans",
    }),
    AiMetricsInstallPlanStep.make({
      command: installFlags(
        `beep-cli ai-metrics label queue --target ${spec.target}${commandFlags.collectorDataRoot} --limit 20`
      ),
      description: "Review real tasks that need outcome labels before weekly scoring.",
      kind: AiMetricsInstallPlanStepKind.Enum.label_queue,
      mutatesHost: false,
      order: 80,
      requiresRemote: false,
      stepId: "labels.queue",
      title: "Review outcome label queue",
    }),
    AiMetricsInstallPlanStep.make({
      command: installFlags(
        `beep-cli ai-metrics report weekly --target ${spec.target}${commandFlags.collectorDataRoot}`
      ),
      description: "Generate the weekly config-impact scorecard from derived data.",
      kind: AiMetricsInstallPlanStepKind.Enum.weekly_report,
      mutatesHost: false,
      order: 90,
      requiresRemote: false,
      stepId: "report.weekly",
      title: "Generate weekly scorecard",
    }),
    AiMetricsInstallPlanStep.make({
      command: pipe(
        rawArchiveKeySecretRef,
        O.match({
          onNone: () =>
            withHashSaltSecret(hashSaltSecretRef)(
              `BEEP_AI_METRICS_RAW_ARCHIVE_KEY=<base64-32-byte-key> ${installFlags(`beep-cli ai-metrics archive drill --target ${spec.target}${commandFlags.collectorDataRoot}`)}`
            ),
          onSome: (rawRef) =>
            `${rawArchiveKeyPrefix(rawRef)} ${withHashSaltSecret(hashSaltSecretRef)(
              installFlags(`beep-cli ai-metrics archive drill --target ${spec.target}${commandFlags.collectorDataRoot}`)
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
    AiMetricsInstallPlanStep.make({
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
  services: ReadonlyArray<AiMetricsServiceSpec>
): ReadonlyArray<string> => {
  const commandFlags = deploymentCommandFlags(
    target,
    storage,
    pipe(
      services,
      A.findFirst((service) => service.enabledByDefault)
    )
  );

  return [
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
            `BEEP_AI_METRICS_RAW_ARCHIVE_KEY=<base64-32-byte-key> beep-cli ai-metrics forwarder run --target ${target}${commandFlags.collectorDataRoot}${commandFlags.otlp}${commandFlags.otlpBaseUrl}`
          ),
        onSome: (rawRef) =>
          withHashSaltSecret(hashSaltSecretRef)(
            `${rawArchiveKeyPrefix(rawRef)} beep-cli ai-metrics forwarder run --target ${target}${commandFlags.collectorDataRoot} --raw-archive-key-secret-ref ${shellQuote(rawRef)}${commandFlags.otlp}${commandFlags.otlpBaseUrl}`
          ),
      })
    ),
    withInstallSecretRefFlags(
      hashSaltSecretRef,
      rawArchiveKeySecretRef
    )(
      `beep-cli ai-metrics forwarder timer --target ${target}${commandFlags.collectorDataRoot}${commandFlags.otlpBaseUrl}`
    ),
    withInstallSecretRefFlags(
      hashSaltSecretRef,
      rawArchiveKeySecretRef
    )(
      `beep-cli ai-metrics otlp export --target ${target}${commandFlags.collectorDataRoot} --ingest-run latest${commandFlags.otlpBaseUrl}`
    ),
    withInstallSecretRefFlags(
      hashSaltSecretRef,
      rawArchiveKeySecretRef
    )(`beep-cli ai-metrics label queue --target ${target}${commandFlags.collectorDataRoot} --limit 20`),
    withInstallSecretRefFlags(
      hashSaltSecretRef,
      rawArchiveKeySecretRef
    )(`beep-cli ai-metrics report weekly --target ${target}${commandFlags.collectorDataRoot}`),
    pipe(
      rawArchiveKeySecretRef,
      O.match({
        onNone: () =>
          withHashSaltSecret(hashSaltSecretRef)(
            `BEEP_AI_METRICS_RAW_ARCHIVE_KEY=<base64-32-byte-key> ${withInstallSecretRefFlags(
              hashSaltSecretRef,
              rawArchiveKeySecretRef
            )(`beep-cli ai-metrics archive drill --target ${target}${commandFlags.collectorDataRoot}`)}`
          ),
        onSome: (rawRef) =>
          `${rawArchiveKeyPrefix(rawRef)} ${withHashSaltSecret(hashSaltSecretRef)(
            withInstallSecretRefFlags(
              hashSaltSecretRef,
              rawArchiveKeySecretRef
            )(`beep-cli ai-metrics archive drill --target ${target}${commandFlags.collectorDataRoot}`)
          )}`,
      })
    ),
  ];
};

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

const availableSourceCount = O.match({
  onNone: () => 0,
  onSome: flow(
    (result: AiMetricsSourceDiscoveryResult) => result.sources,
    A.filter((source) => AiMetricsSourceStatus.is.available(source.status)),
    A.length
  ),
});

const sourceStatusMetadata: (result: AiMetricsSourceDiscoveryResult) => Record<string, string> = flow(
  (result) => result.sources,
  A.map((source) => [source.sourceKind, source.status] as const),
  R.fromEntries
);

const initialDoctorStatus: AiMetricsInstallDoctorStatus = AiMetricsInstallDoctorStatus.Enum.passed;

const doctorStatusFor = (checks: ReadonlyArray<AiMetricsInstallDoctorCheck>): AiMetricsInstallDoctorStatus =>
  A.reduce<AiMetricsInstallDoctorCheck, AiMetricsInstallDoctorStatus>(checks, initialDoctorStatus, (aggregate, check) =>
    AiMetricsInstallDoctorCheckStatus.$match(check.status, {
      failed: () => AiMetricsInstallDoctorStatus.Enum.failed,
      passed: () => aggregate,
      skipped: () => aggregate,
      warning: () =>
        AiMetricsInstallDoctorStatus.is.failed(aggregate)
          ? AiMetricsInstallDoctorStatus.Enum.failed
          : AiMetricsInstallDoctorStatus.Enum.warning,
    })
  );

/**
 * Resolve an install spec for the requested AI metrics target.
 *
 * **Details**
 *
 * The storage layout hangs off a data root resolved by
 * {@link resolveAiMetricsDataRoot}: an explicit `dataRoot` first, then the
 * deploy target's default, which for every non-dankserver target is the XDG
 * store beneath `homeDir` or `stateHome`.
 *
 * **Gotchas**
 *
 * There is no clone-relative fallback. A local-target input that supplies
 * neither `dataRoot` nor `homeDir`/`stateHome` fails with
 * {@link AiMetricsInstallConfigurationError} rather than quietly writing the
 * canonical store into whatever directory the process happens to be running in.
 *
 * **Example** (Resolving the layout for an explicit data root)
 *
 * ```ts
 * import { AiMetricsInstallInput, makeAiMetricsInstallSpec } from "@beep/repo-ai-metrics"
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 *
 * const spec = Effect.runSync(
 *   makeAiMetricsInstallSpec(
 *     AiMetricsInstallInput.make({ dataRoot: O.some("/home/dev/.local/state/beep/ai-metrics") })
 *   )
 * )
 *
 * console.log(spec.storage.rawArchiveDir)
 * // /home/dev/.local/state/beep/ai-metrics/raw
 * ```
 *
 * @param input - Operator install preferences; the data root must be resolvable from them.
 * @returns An effect that resolves the normalized install spec consumed by IaC and CLI planning.
 * @category constructors
 * @since 0.0.0
 */
export const makeAiMetricsInstallSpec: (
  input?: AiMetricsInstallInput
) => Effect.Effect<AiMetricsInstallSpec, AiMetricsInstallConfigurationError> = Effect.fn(
  "AiMetrics.makeAiMetricsInstallSpec"
)(function* (input: AiMetricsInstallInput = AiMetricsInstallInput.make({})) {
  const dataRoot = yield* requireInstallDataRoot(input);
  const publicBaseUrl = O.getOrElse(input.publicBaseUrl, () => defaultPublicBaseUrl(input.target));
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
    hashSaltSecretRef,
    litellmGatewayEnabled: input.litellmGatewayEnabled,
    plannedCommands: plannedCommands(input.target, storage, hashSaltSecretRef, rawArchiveKeySecretRef, services),
    privacyMode: input.privacyMode,
    rawArchiveKeySecretRef,
    services,
    stackName: `beep-ai-metrics-${input.target}`,
    storage,
    tailnetOnly: input.tailnetOnly,
    target: input.target,
  });
});

/**
 * Describe every step an install would take, without touching local or remote state.
 *
 * **Details**
 *
 * Planning resolves the spec first, so the same data-root law applies: a local
 * input that supplies neither `dataRoot` nor `homeDir`/`stateHome` fails here
 * rather than producing a plan against an accidental store. The returned plan
 * always carries `dryRunOnly: true`.
 *
 * **Example** (Planning a local install)
 *
 * ```ts
 * import { AiMetricsInstallInput, makeAiMetricsInstallPlan } from "@beep/repo-ai-metrics"
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 *
 * const plan = Effect.runSync(
 *   makeAiMetricsInstallPlan(
 *     AiMetricsInstallInput.make({ dataRoot: O.some("/home/dev/.local/state/beep/ai-metrics") })
 *   )
 * )
 *
 * console.log(plan.dryRunOnly) // true
 * console.log(plan.stackName) // "beep-ai-metrics-local"
 * ```
 *
 * @param input - Operator install preferences for the target plan.
 * @returns A typed, dry-runnable plan consumed by CLI plan, doctor, and apply workflows.
 * @see {@link makeAiMetricsInstallSpec} for the spec resolution this planning builds on.
 * @category constructors
 * @since 0.0.0
 */
export const makeAiMetricsInstallPlan: (
  input?: AiMetricsInstallInput
) => Effect.Effect<AiMetricsInstallPlan, AiMetricsInstallConfigurationError> = Effect.fn(
  "AiMetrics.makeAiMetricsInstallPlan"
)(function* (input: AiMetricsInstallInput = AiMetricsInstallInput.make({})) {
  const spec = yield* makeAiMetricsInstallSpec(input);
  const hashSaltSecretRef = O.filter(spec.hashSaltSecretRef, flow(Str.trim, Str.isNonEmpty));
  const rawArchiveKeySecretRef = O.filter(spec.rawArchiveKeySecretRef, flow(Str.trim, Str.isNonEmpty));
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
 * Check a proposed install against its contract and report a single verdict.
 *
 * **When to use**
 *
 * Use when preparing an apply, or after changing anything about the store's
 * location or secrets. The doctor answers "would this install be coherent"
 * without performing it.
 *
 * **Details**
 *
 * Checks that need source-discovery evidence report `skipped` when
 * `sourceDiscovery` is absent, and the aggregate status is the worst individual
 * outcome. Contract checks still run either way.
 *
 * **Example** (Doctoring a local install)
 *
 * ```ts
 * import {
 *   AiMetricsInstallDoctorInput,
 *   AiMetricsInstallInput,
 *   makeAiMetricsInstallDoctorResult
 * } from "@beep/repo-ai-metrics"
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 *
 * const result = Effect.runSync(
 *   makeAiMetricsInstallDoctorResult(
 *     AiMetricsInstallDoctorInput.make({
 *       install: AiMetricsInstallInput.make({ dataRoot: O.some("/home/dev/.local/state/beep/ai-metrics") })
 *     })
 *   )
 * )
 *
 * console.log(result.target) // "local"
 * console.log(result.availableSourceCount) // 0
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
  const sourceDiscovery = input.sourceDiscovery;
  const sourceCount = availableSourceCount(sourceDiscovery);
  const sourceAvailability = pipe(
    sourceDiscovery,
    O.match({
      onNone: () => ({
        message: "Source discovery evidence was not provided to the install doctor.",
        metadata: {},
        status: AiMetricsInstallDoctorCheckStatus.Enum.warning,
      }),
      onSome: (result) =>
        Match.value(sourceCount).pipe(
          Match.when(
            (count) => count === 0,
            () => ({
              message: "No local Codex, Claude Code, or OpenClaw sources are available.",
              metadata: {
                availableSourceCount: `${sourceCount}`,
                ...sourceStatusMetadata(result),
              },
              status: AiMetricsInstallDoctorCheckStatus.Enum.failed,
            })
          ),
          Match.orElse(() => ({
            message: "At least one local AI source is available for live collection.",
            metadata: {
              availableSourceCount: `${sourceCount}`,
              ...sourceStatusMetadata(result),
            },
            status:
              sourceCount < A.length(result.sources)
                ? AiMetricsInstallDoctorCheckStatus.Enum.warning
                : AiMetricsInstallDoctorCheckStatus.Enum.passed,
          }))
        ),
    })
  );
  const checks = [
    AiMetricsInstallDoctorCheck.make({
      checkId: "install.spec",
      message: "Install spec resolved with schema-first target defaults.",
      metadata: { stackName: plan.stackName, target: plan.target },
      status: AiMetricsInstallDoctorCheckStatus.Enum.passed,
    }),
    AiMetricsInstallDoctorCheck.make({
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
    AiMetricsInstallDoctorCheck.make({
      checkId: "storage.layout",
      message: "Storage layout resolved for raw archive, derived DuckDB, and Parquet snapshots.",
      metadata: { dataRoot: plan.storage.dataRoot },
      status: AiMetricsInstallDoctorCheckStatus.Enum.passed,
    }),
    AiMetricsInstallDoctorCheck.make({
      checkId: "backend.phoenix",
      message: "Phoenix is the only concrete P5a deployment backend; other candidates remain contracts.",
      metadata: { defaultTool: plan.defaultTool },
      status: AiMetricsTool.is.phoenix(plan.defaultTool)
        ? AiMetricsInstallDoctorCheckStatus.Enum.passed
        : AiMetricsInstallDoctorCheckStatus.Enum.failed,
    }),
    AiMetricsInstallDoctorCheck.make({
      checkId: "sources.available",
      ...sourceAvailability,
    }),
    AiMetricsInstallDoctorCheck.make({
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
 * List what a CLI apply would do, and state plainly that it did none of it.
 *
 * **Details**
 *
 * The CLI apply surface is dry-run-only by construction — real remote mutation
 * belongs to the infrastructure stack, not to this command. The returned
 * message says so, so an operator reading terminal output is not left guessing
 * whether the install already happened.
 *
 * **Example** (Listing the CLI-safe steps)
 *
 * ```ts
 * import { AiMetricsInstallInput, makeAiMetricsInstallApplyDryRunResult } from "@beep/repo-ai-metrics"
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 *
 * const result = Effect.runSync(
 *   makeAiMetricsInstallApplyDryRunResult(
 *     AiMetricsInstallInput.make({ dataRoot: O.some("/home/dev/.local/state/beep/ai-metrics") })
 *   )
 * )
 *
 * console.log(result.dryRun) // true
 * console.log(result.plan.dryRunOnly) // true
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
    message: "CLI install apply is dry-run-only; run the Pulumi P5b stack for real remote mutation.",
    plan,
    target: plan.target,
  });
});

/**
 * Encode an install plan as the JSON the CLI emits under `--json`.
 *
 * **Details**
 *
 * Encoding goes through the schema, so the emitted text round-trips back into
 * {@link AiMetricsInstallPlan} and a downstream tool can consume the plan
 * instead of scraping the human-readable rendering.
 *
 * **Example** (Emitting a plan as JSON)
 *
 * ```ts
 * import {
 *   AiMetricsInstallInput,
 *   aiMetricsInstallPlanToJson,
 *   makeAiMetricsInstallPlan
 * } from "@beep/repo-ai-metrics"
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 *
 * const json = Effect.runSync(
 *   makeAiMetricsInstallPlan(
 *     AiMetricsInstallInput.make({ dataRoot: O.some("/home/dev/.local/state/beep/ai-metrics") })
 *   ).pipe(Effect.flatMap(aiMetricsInstallPlanToJson))
 * )
 *
 * console.log(json.includes("beep-ai-metrics-local")) // true
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const aiMetricsInstallPlanToJson: (
  result: AiMetricsInstallPlan
) => Effect.Effect<string, AiMetricsInstallConfigurationError> = encodeInstallContractJson(
  AiMetricsInstallPlan.encodeJsonEffect
)("Failed to encode AI metrics install plan as JSON.");

/**
 * Encode a doctor result as the JSON a CI job can gate on.
 *
 * **Details**
 *
 * The encoded result carries every individual check as well as the aggregate
 * status, so a gate can fail on one specific `checkId` rather than only on the
 * overall verdict.
 *
 * **Example** (Emitting a doctor result as JSON)
 *
 * ```ts
 * import {
 *   AiMetricsInstallDoctorInput,
 *   AiMetricsInstallInput,
 *   aiMetricsInstallDoctorToJson,
 *   makeAiMetricsInstallDoctorResult
 * } from "@beep/repo-ai-metrics"
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 *
 * const json = Effect.runSync(
 *   makeAiMetricsInstallDoctorResult(
 *     AiMetricsInstallDoctorInput.make({
 *       install: AiMetricsInstallInput.make({ dataRoot: O.some("/home/dev/.local/state/beep/ai-metrics") })
 *     })
 *   ).pipe(Effect.flatMap(aiMetricsInstallDoctorToJson))
 * )
 *
 * console.log(json.includes("install.spec")) // true
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const aiMetricsInstallDoctorToJson: (
  result: AiMetricsInstallDoctorResult
) => Effect.Effect<string, AiMetricsInstallConfigurationError> = encodeInstallContractJson(
  AiMetricsInstallDoctorResult.encodeJsonEffect
)("Failed to encode AI metrics install doctor result as JSON.");

/**
 * Encode a dry-run apply result as the JSON the CLI emits under `--json`.
 *
 * **Details**
 *
 * `dryRun` survives encoding as `true`, so a machine reader of the output can
 * assert that the command it invoked did not mutate the host.
 *
 * **Example** (Emitting a dry-run apply as JSON)
 *
 * ```ts
 * import {
 *   AiMetricsInstallInput,
 *   aiMetricsInstallApplyDryRunToJson,
 *   makeAiMetricsInstallApplyDryRunResult
 * } from "@beep/repo-ai-metrics"
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 *
 * const json = Effect.runSync(
 *   makeAiMetricsInstallApplyDryRunResult(
 *     AiMetricsInstallInput.make({ dataRoot: O.some("/home/dev/.local/state/beep/ai-metrics") })
 *   ).pipe(Effect.flatMap(aiMetricsInstallApplyDryRunToJson))
 * )
 *
 * console.log(json.includes("\"dryRun\":true")) // true
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const aiMetricsInstallApplyDryRunToJson: (
  result: AiMetricsInstallApplyDryRunResult
) => Effect.Effect<string, AiMetricsInstallConfigurationError> = encodeInstallContractJson(
  AiMetricsInstallApplyDryRunResult.encodeJsonEffect
)("Failed to encode AI metrics install dry-run result as JSON.");
