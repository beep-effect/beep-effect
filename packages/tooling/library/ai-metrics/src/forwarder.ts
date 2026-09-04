/**
 * Durable local forwarder for repo AI metrics.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoAiMetricsId } from "@beep/identity/packages";
import { Defect, PosInt, SchemaUtils } from "@beep/schema";
import { A, Str } from "@beep/utils";
import * as O from "@beep/utils/Option";
import { Clock, DateTime, Duration, Effect, FileSystem, flow, Order, Path, pipe } from "effect";
import * as S from "effect/Schema";
import { AiMetricsRawArchiveKey, writeEncryptedRawArchiveObject } from "./archive.ts";
import {
  AiMetricsConfigSnapshotInput,
  makeAiMetricsConfigSnapshot,
  writeAiMetricsConfigSnapshotArtifacts,
} from "./config-snapshot.ts";
import { requireAbsoluteAiMetricsDataRoot } from "./data-root.ts";
import {
  AiMetricsDerivedStorageWriteInput,
  AiMetricsDerivedTranscriptRecord,
  AiMetricsParquetExportMode,
  writeAiMetricsDerivedStorage,
} from "./derived-storage.ts";
import { agentEvidenceRoot } from "./hook-pulse.ts";
import {
  HookPulseLeaseReplayInput,
  HookPulseLeaseReplayResult,
  replayHookPulseLeases,
} from "./hook-pulse-lease-replay.ts";
import { AiMetricsIdentityRegistryUpsertInput, upsertAiMetricsIdentityRegistry } from "./identity-registry.ts";
import { summarizeTranscriptText } from "./ingest.ts";
import { AiMetricsInstallInput, makeAiMetricsInstallSpec } from "./install.ts";
import { fileSizeBytes, modifiedAtMillis } from "./internal/file-info.ts";
import { collectJsonlFiles, statOption } from "./internal/jsonl-discovery.ts";
import { normalizedRelativePath, resolveTranscriptSourceRoots } from "./internal/transcript-utils.ts";
import { AiMetricsDeployTarget, AiMetricsTranscriptSource } from "./models.ts";
import { hashPrivateIdentifier, makeAiMetricsPrivacyCheckResult } from "./privacy.ts";
import { shellQuote } from "./shell.ts";

const $I = $RepoAiMetricsId.create("forwarder");
const DEFAULT_MAX_FILES = 200;
const DEFAULT_SESSION_LEASE_TTL = Duration.hours(24);
const absoluteExecutablePathPattern = /^(?:[A-Za-z]:[\\/]|\\\\|\/)/u;
const isAbsoluteExecutablePath = (value: string): boolean => absoluteExecutablePathPattern.test(value);
const AiMetricsForwarderTimerCommandBase = S.NonEmptyArray(S.String);
const AiMetricsForwarderTimerCommand = AiMetricsForwarderTimerCommandBase.pipe(
  S.check(
    S.makeFilter<typeof AiMetricsForwarderTimerCommandBase.Type>(
      (command) =>
        isAbsoluteExecutablePath(command[0])
          ? true
          : {
              path: [0],
              issue: "Forwarder timer command[0] must be an absolute executable path.",
            },
      {
        identifier: $I`AiMetricsForwarderTimerCommandAbsoluteExecutableCheck`,
        title: "AI Metrics Forwarder Timer Command Absolute Executable",
        description: "A forwarder timer command whose executable is pinned to an absolute path.",
        message: "Forwarder timer command[0] must be an absolute executable path.",
      }
    )
  ),
  $I.annoteSchema("AiMetricsForwarderTimerCommand", {
    description: "Forwarder timer command argv with an absolute executable path.",
  })
);

/**
 * Typed failure raised anywhere inside one durable forwarder run.
 *
 * **Details**
 *
 * Every stage of the run — discovery, ingest, archive, derived storage, OTLP
 * export — maps its own failure into this single error so the caller has one
 * tag to handle. The originating failure is preserved in `cause`, and `message`
 * names the stage that failed.
 *
 * **Example** (Constructing the failure)
 *
 * ```ts
 * import { AiMetricsForwarderError } from "@beep/repo-ai-metrics"
 *
 * const error = AiMetricsForwarderError.make({
 *   cause: "boom",
 *   message: "Failed to upsert the AI metrics identity registry."
 * })
 *
 * console.log(error._tag) // "AiMetricsForwarderError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class AiMetricsForwarderError extends S.TaggedError<AiMetricsForwarderError>($I`AiMetricsForwarderError`)(
  "AiMetricsForwarderError",
  {
    cause: Defect({ includeStack: true }),
    message: S.String,
  },
  $I.annoteError<AiMetricsForwarderError>("AiMetricsForwarderError", {
    description: "Typed failure raised by the durable AI metrics forwarder.",
  })
) {}

/**
 * Roots, budgets, and secrets that define one durable forwarder run.
 *
 * **Details**
 *
 * `dataRoot` is optional here but is not defaulted downstream: a `local` run
 * that supplies neither `dataRoot` nor `homeDir` fails rather than writing into
 * whichever clone happens to be the working directory. `maxFiles` and
 * `maxFileBytes` bound one pass, and files they exclude are reported through
 * {@link AiMetricsForwarderSourceCoverage} instead of being dropped silently.
 *
 * **Example** (Configuring a local run)
 *
 * ```ts
 * import { AiMetricsForwarderInput } from "@beep/repo-ai-metrics"
 * import { Option, Redacted } from "effect"
 *
 * const input = AiMetricsForwarderInput.make({
 *   dataRoot: Option.some("/home/dev/.local/state/beep/ai-metrics"),
 *   hashSalt: Option.some("salt"),
 *   homeDir: "/home/dev",
 *   rawArchiveKey: Redacted.make("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="),
 *   repoRoot: "/repo"
 * })
 *
 * console.log(input.parquetExportMode) // "snapshot"
 * console.log(input.target) // "local"
 * ```
 *
 * @see {@link runAiMetricsForwarder} for the run this input drives.
 * @category models
 * @since 0.0.0
 */
export class AiMetricsForwarderInput extends S.Class<AiMetricsForwarderInput>($I`AiMetricsForwarderInput`)(
  {
    agentEvidenceRoot: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    claudeProjectsRoot: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    codexSessionsRoot: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    dataRoot: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    hashSalt: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    hashSaltSecretRef: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    homeDir: S.String,
    includeAll: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(false)),
      S.withDecodingDefaultKey(Effect.succeed(false))
    ),
    maxFiles: S.Natural.pipe(
      S.withConstructorDefault(Effect.succeed(DEFAULT_MAX_FILES)),
      S.withDecodingDefaultKey(Effect.succeed(DEFAULT_MAX_FILES))
    ),
    maxFileBytes: S.OptionFromOptionalKey(S.Natural).pipe(SchemaUtils.withNoneDefault),
    openClawUnitPath: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    parquetExportMode: AiMetricsParquetExportMode.pipe(
      S.withConstructorDefault(Effect.succeed(AiMetricsParquetExportMode.Enum.snapshot)),
      S.withDecodingDefaultKey(Effect.succeed(AiMetricsParquetExportMode.Enum.snapshot))
    ),
    rawArchiveKey: AiMetricsRawArchiveKey,
    rawArchiveKeySecretRef: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    repoRoot: S.String,
    sinceEpochMillis: S.OptionFromOptionalKey(S.Natural).pipe(SchemaUtils.withNoneDefault),
    target: AiMetricsDeployTarget.pipe(
      S.withConstructorDefault(Effect.succeed(AiMetricsDeployTarget.Enum.local)),
      S.withDecodingDefaultKey(Effect.succeed(AiMetricsDeployTarget.Enum.local))
    ),
  },
  $I.annote("AiMetricsForwarderInput", {
    description: "Configurable roots, target, and archive key for one durable AI metrics forwarder run.",
  })
) {}

/**
 * How much of one agent brand's transcript backlog a single run actually covered.
 *
 * **Details**
 *
 * The counts exist to make starvation visible. A shared `maxFiles` budget spent
 * mostly on one brand leaves the other permanently behind, and without
 * `candidateFileCount` beside `includedFileCount` that shows up only as a
 * quietly stale dataset. `limitedByMaxFiles` and `sizeExcludedFileCount`
 * attribute the shortfall to the budget that caused it.
 *
 * **Example** (Detecting a starved source)
 *
 * ```ts
 * import { AiMetricsForwarderSourceCoverage } from "@beep/repo-ai-metrics"
 *
 * const coverage = AiMetricsForwarderSourceCoverage.make({
 *   candidateFileCount: 12,
 *   includedFileCount: 10,
 *   limitedByMaxFiles: true,
 *   sourceKind: "codex"
 * })
 *
 * console.log(coverage.candidateFileCount - coverage.includedFileCount) // 2
 * console.log(coverage.limitedByMaxFiles) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AiMetricsForwarderSourceCoverage extends S.Class<AiMetricsForwarderSourceCoverage>(
  $I`AiMetricsForwarderSourceCoverage`
)(
  {
    candidateFileCount: S.Natural,
    includedFileCount: S.Natural,
    limitedByMaxFiles: S.Boolean,
    sizeExcludedFileCount: S.Natural.pipe(
      S.withConstructorDefault(Effect.succeed(0)),
      S.withDecodingDefaultKey(Effect.succeed(0))
    ),
    sourceKind: AiMetricsTranscriptSource,
  },
  $I.annote("AiMetricsForwarderSourceCoverage", {
    description: "Source-aware file selection counts used to detect maxFiles and maxFileBytes starvation.",
  })
) {}

/**
 * Successful derived OTLP export recorded against a forwarder run.
 *
 * **Details**
 *
 * `spanCount` is the total shipped; `sessionSpanCount` and `turnSpanCount`
 * break it down by span kind, so a run that produced sessions but no turns is
 * distinguishable from one that shipped nothing. Only allowlisted, hashed
 * attributes leave the machine, which is why these counts — not sample payloads
 * — are the export's evidence.
 *
 * **Example** (Reading an export's span breakdown)
 *
 * ```ts
 * import { AiMetricsForwarderOtlpExported } from "@beep/repo-ai-metrics"
 *
 * const exported = AiMetricsForwarderOtlpExported.make({
 *   endpointTraceUrl: "http://127.0.0.1:6006/projects/default/traces",
 *   ingestRunId: "forwarder-1",
 *   sessionSpanCount: 2,
 *   spanCount: 12,
 *   status: "exported",
 *   target: "local",
 *   turnSpanCount: 10
 * })
 *
 * console.log(exported.sessionSpanCount + exported.turnSpanCount) // 12
 * ```
 *
 * @see {@link AiMetricsForwarderOtlpExport} for the tagged union that carries this member.
 * @category models
 * @since 0.0.0
 */
export class AiMetricsForwarderOtlpExported extends S.Class<AiMetricsForwarderOtlpExported>(
  $I`AiMetricsForwarderOtlpExported`
)(
  {
    endpointTraceUrl: S.String,
    ingestRunId: S.String,
    sessionSpanCount: S.Natural,
    spanCount: S.Natural,
    status: S.Literal("exported").pipe(SchemaUtils.withConstantDefault("exported")),
    target: AiMetricsDeployTarget,
    turnSpanCount: S.Natural,
  },
  $I.annote("AiMetricsForwarderOtlpExported", {
    description: "Safe counts recorded when a forwarder run also exports derived AI metrics spans through OTLP.",
  })
) {}

/**
 * Failed derived OTLP export recorded against a forwarder run.
 *
 * **Details**
 *
 * Export failure does not fail the run: the transcripts are already ingested and
 * durable, and an unreachable collector is a transient condition the next run
 * retries. Recording the failure against the same `ingestRunId` is what keeps
 * "ingested but never exported" from looking identical to "never ingested".
 *
 * **Gotchas**
 *
 * `message` is sanitized for storage. Do not put a raw exporter error into it —
 * endpoint errors can carry request bodies.
 *
 * **Example** (Recording an unreachable collector)
 *
 * ```ts
 * import { AiMetricsForwarderOtlpExportFailed } from "@beep/repo-ai-metrics"
 *
 * const failed = AiMetricsForwarderOtlpExportFailed.make({
 *   endpointTraceUrl: "http://127.0.0.1:6006/projects/default/traces",
 *   ingestRunId: "forwarder-1",
 *   message: "Phoenix was unavailable.",
 *   status: "failed",
 *   target: "local"
 * })
 *
 * console.log(failed.status) // "failed"
 * console.log(failed.ingestRunId) // "forwarder-1"
 * ```
 *
 * @see {@link AiMetricsForwarderOtlpExport} for the tagged union that carries this member.
 * @category models
 * @since 0.0.0
 */
export class AiMetricsForwarderOtlpExportFailed extends S.Class<AiMetricsForwarderOtlpExportFailed>(
  $I`AiMetricsForwarderOtlpExportFailed`
)(
  {
    endpointTraceUrl: S.String,
    ingestRunId: S.String,
    message: S.String,
    status: S.Literal("failed").pipe(SchemaUtils.withConstantDefault("failed")),
    target: AiMetricsDeployTarget,
  },
  $I.annote("AiMetricsForwarderOtlpExportFailed", {
    description: "Sanitized failure recorded when post-forwarder derived OTLP export does not complete.",
  })
) {}

/**
 * Whether a run's derived OTLP export succeeded, tagged by its `status` field.
 *
 * **Details**
 *
 * Tagging on `status` rather than carrying a nullable failure message means a
 * reader cannot look at `spanCount` on a failed export: the counts exist only on
 * the `exported` member. A run that never attempted an export omits the field
 * entirely, which is a third state distinct from both members.
 *
 * **Example** (Narrowing an export status)
 *
 * ```ts
 * import {
 *   AiMetricsForwarderOtlpExport,
 *   AiMetricsForwarderOtlpExported
 * } from "@beep/repo-ai-metrics"
 *
 * const exported = AiMetricsForwarderOtlpExported.make({
 *   endpointTraceUrl: "http://127.0.0.1:6006/projects/default/traces",
 *   ingestRunId: "forwarder-1",
 *   sessionSpanCount: 1,
 *   spanCount: 3,
 *   status: "exported",
 *   target: "local",
 *   turnSpanCount: 2
 * })
 *
 * console.log(AiMetricsForwarderOtlpExport.is(exported)) // true
 * console.log(exported.status) // "exported"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const AiMetricsForwarderOtlpExport = S.Union([
  AiMetricsForwarderOtlpExported,
  AiMetricsForwarderOtlpExportFailed,
]).pipe(
  $I.annoteSchema("AiMetricsForwarderOtlpExport", {
    description: "Tagged post-forwarder derived OTLP export status for the same ingest run.",
  }),
  SchemaUtils.withCodecStatics(["is"]),
  (schema) =>
    schema.pipe(
      S.toTaggedUnion("status"),
      SchemaUtils.withStatics(() => ({ is: schema.is }))
    )
);

/**
 * Decoded export status carried by a forwarder run result.
 *
 * **Details**
 *
 * Narrowing on `status` selects between the exported and failed members, so
 * `spanCount` is reachable only after the `"exported"` check.
 *
 * @see {@link AiMetricsForwarderOtlpExport} for the runtime schema and its guard.
 * @category models
 * @since 0.0.0
 */
export type AiMetricsForwarderOtlpExport = typeof AiMetricsForwarderOtlpExport.Type;

/**
 * Counts and storage paths a completed forwarder run is safe to report.
 *
 * **Details**
 *
 * Every field is either a count, a path, or an identifier — nothing derived from
 * transcript content — so the result can be logged, printed by the CLI, or
 * exported without a privacy review. `configSnapshotId` is the join back to the
 * agent-configuration manifest that was in force for the run, which is what
 * makes a metric attributable to a guidance change.
 *
 * **Example** (Reporting a completed run)
 *
 * ```ts
 * import { AiMetricsForwarderRunResult } from "@beep/repo-ai-metrics"
 *
 * const result = AiMetricsForwarderRunResult.make({
 *   archiveObjectCount: 2,
 *   configSnapshotId: "config-1",
 *   duckDbPath: "/home/dev/.local/state/beep/ai-metrics/derived/ai-metrics.duckdb",
 *   ingestRunId: "forwarder-1",
 *   parquetExportMode: "snapshot",
 *   parquetTables: ["ai_metrics_turns"],
 *   rawArchiveDir: "/home/dev/.local/state/beep/ai-metrics/raw",
 *   sourceFileCount: 2,
 *   target: "local",
 *   turnCount: 24
 * })
 *
 * console.log(result.turnCount) // 24
 * console.log(result.sourceCoverage.length) // 0
 * ```
 *
 * @see {@link AiMetricsForwarderSourceCoverage} for the per-brand selection counts this result carries.
 * @category models
 * @since 0.0.0
 */
export class AiMetricsForwarderRunResult extends S.Class<AiMetricsForwarderRunResult>($I`AiMetricsForwarderRunResult`)(
  {
    archiveObjectCount: S.Natural,
    configSnapshotId: S.String,
    duckDbPath: S.String,
    ingestRunId: S.String,
    hookPulseLeaseReplay: S.OptionFromOptionalKey(HookPulseLeaseReplayResult).pipe(SchemaUtils.withNoneDefault),
    otlpExport: S.OptionFromOptionalKey(AiMetricsForwarderOtlpExport).pipe(SchemaUtils.withNoneDefault),
    parquetExportDir: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    parquetExportMode: AiMetricsParquetExportMode,
    parquetTables: S.Array(S.String),
    rawArchiveDir: S.String,
    sourceCoverage: S.Array(AiMetricsForwarderSourceCoverage).pipe(
      S.withConstructorDefault(Effect.succeed([])),
      S.withDecodingDefaultKey(Effect.succeed([]))
    ),
    sourceFileCount: S.Natural,
    target: AiMetricsDeployTarget,
    turnCount: S.Natural,
  },
  $I.annote("AiMetricsForwarderRunResult", {
    description: "Safe counts and storage paths returned by one durable AI metrics forwarder run.",
  })
) {
  static readonly encodeJsonEffect = S.encodeUnknownEffect(S.fromJsonString(AiMetricsForwarderRunResult));
}

/**
 * Parameters for the systemd user timer that owns scheduled forwarder collection.
 *
 * **Details**
 *
 * `command[0]` must be an absolute executable path; the schema refines that,
 * because a unit's `ExecStart` resolves against the unit environment rather than
 * the operator's shell. `intervalMinutes` becomes `OnUnitInactiveSec`, so it is
 * the gap between runs, not a fixed wall-clock period.
 *
 * **Gotchas**
 *
 * `workingDirectory` becomes the unit's `WorkingDirectory`. Any relative path
 * elsewhere in the command binds to it, which is exactly how a data root once
 * ended up inside a clone — pass absolute paths for anything that is stored.
 *
 * **Example** (Describing a timer that runs every half hour)
 *
 * ```ts
 * import { AiMetricsForwarderTimerInput } from "@beep/repo-ai-metrics"
 *
 * const input = AiMetricsForwarderTimerInput.make({
 *   command: ["/usr/bin/bun", "run", "beep", "ai-metrics", "forwarder"],
 *   lockPath: "/tmp/beep-ai-metrics-forwarder.lock",
 *   statusPath: "/tmp/beep-ai-metrics-forwarder.json",
 *   workingDirectory: "/repo"
 * })
 *
 * console.log(input.intervalMinutes) // 30
 * console.log(input.serviceName) // "beep-ai-metrics-forwarder"
 * ```
 *
 * @see {@link renderAiMetricsForwarderTimerPlan} for the units rendered from this input.
 * @category models
 * @since 0.0.0
 */
export class AiMetricsForwarderTimerInput extends S.Class<AiMetricsForwarderTimerInput>(
  $I`AiMetricsForwarderTimerInput`
)(
  {
    command: AiMetricsForwarderTimerCommand,
    hashSaltSecretRef: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    intervalMinutes: S.Int.check(S.isGreaterThan(0)).pipe(
      S.withConstructorDefault(Effect.succeed(30)),
      S.withDecodingDefaultKey(Effect.succeed(30))
    ),
    lockPath: S.String,
    rawArchiveKeySecretRef: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    serviceName: S.String.pipe(
      S.withConstructorDefault(Effect.succeed("beep-ai-metrics-forwarder")),
      S.withDecodingDefaultKey(Effect.succeed("beep-ai-metrics-forwarder"))
    ),
    statusPath: S.String,
    workingDirectory: S.String,
  },
  $I.annote("AiMetricsForwarderTimerInput", {
    description: "Workstation timer parameters for scheduled AI metrics forwarder collection.",
  })
) {}

/**
 * Rendered systemd user units and the operator commands that install them.
 *
 * **Details**
 *
 * The plan is render-only: it produces unit text and a command list for a human
 * to review and run. Nothing in it touches systemd, writes a unit file, or
 * enables a timer.
 *
 * **Gotchas**
 *
 * `installCommands` includes a step that truncates the collector's environment
 * file before repopulating it from the secret store. Running the list without an
 * authenticated secret session destroys the hash salt, which silently breaks
 * every hash join in an existing store. Review the list before running it.
 *
 * **Example** (Inspecting a rendered plan)
 *
 * ```ts
 * import { AiMetricsForwarderTimerPlan } from "@beep/repo-ai-metrics"
 *
 * const plan = AiMetricsForwarderTimerPlan.make({
 *   installCommands: ["systemctl --user enable --now beep-ai-metrics-forwarder.timer"],
 *   lockPath: "/tmp/beep-ai-metrics-forwarder.lock",
 *   serviceUnit: "[Service]\nType=oneshot",
 *   serviceUnitName: "beep-ai-metrics-forwarder.service",
 *   statusPath: "/tmp/beep-ai-metrics-forwarder.json",
 *   timerUnit: "[Timer]\nOnUnitInactiveSec=30m",
 *   timerUnitName: "beep-ai-metrics-forwarder.timer"
 * })
 *
 * console.log(plan.timerUnitName) // "beep-ai-metrics-forwarder.timer"
 * console.log(plan.installCommands.length) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AiMetricsForwarderTimerPlan extends S.Class<AiMetricsForwarderTimerPlan>($I`AiMetricsForwarderTimerPlan`)(
  {
    installCommands: S.Array(S.String),
    lockPath: S.String,
    serviceUnit: S.String,
    serviceUnitName: S.String,
    statusPath: S.String,
    timerUnit: S.String,
    timerUnitName: S.String,
  },
  $I.annote("AiMetricsForwarderTimerPlan", {
    description: "Systemd user timer artifacts that own P6a live collection on the workstation.",
  })
) {
  static readonly encodeJsonEffect = S.encodeUnknownEffect(S.fromJsonString(AiMetricsForwarderTimerPlan));
}

type ForwarderSourceFile = {
  readonly modifiedAtMillis: number;
  readonly relativePath: string;
  readonly sizeBytes: number;
  readonly sourceKind: AiMetricsTranscriptSource;
  readonly sourcePath: string;
};

type ForwarderSourceFiles = {
  readonly files: ReadonlyArray<ForwarderSourceFile>;
  readonly sizeExcludedFileCount: number;
};

type ForwarderSourceSelection = {
  readonly coverage: AiMetricsForwarderSourceCoverage;
  readonly files: ReadonlyArray<ForwarderSourceFile>;
};

const forwarderFailure = (message: string, cause: unknown): AiMetricsForwarderError =>
  AiMetricsForwarderError.make({ cause, message });

const requireForwarderHashSalt = Effect.fn("AiMetrics.forwarder.requireHashSalt")(function* (
  input: AiMetricsForwarderInput
) {
  if (AiMetricsDeployTarget.is.local(input.target) || O.exists(input.hashSalt, flow(Str.trim, Str.isNonEmpty))) {
    return;
  }

  return yield* forwarderFailure(
    "AI metrics non-local forwarder runs require a resolved hash salt value.",
    input.target
  );
});

const systemdUnitFieldValue: (value: string) => string = Str.replace(/[\u0000-\u001f\u007f]/gu, " ");

const safeSystemdUnitNameStem = (value: string): string => {
  const sanitized = pipe(
    value,
    Str.replace(/[^A-Za-z0-9_.@-]/gu, "-"),
    Str.replace(/-+/gu, "-"),
    Str.replace(/^-|-$/gu, "")
  );
  return Str.isNonEmpty(sanitized) ? sanitized : "beep-ai-metrics-forwarder";
};

const shellCommandFromArgv: (argv: ReadonlyArray<string>) => string = flow(A.map(shellQuote), A.join(" "));

/**
 * Render a systemd user timer that repeatedly runs the forwarder with locking and status evidence.
 *
 * **Details**
 *
 * The service takes `lockPath` as a flock so an overrunning collection cannot
 * overlap the next fire, and writes `statusPath` through a `.tmp` sibling and a
 * rename so a reader never observes a partially written status file. Unit-field
 * values are stripped of control characters before interpolation.
 *
 * **Gotchas**
 *
 * Rendering is pure and does nothing to the machine. Every path interpolated
 * into the units must already be absolute — validate a data root with
 * {@link requireAbsoluteAiMetricsDataRoot} before calling, because a relative
 * path inside `ExecStart` silently binds to the unit's `WorkingDirectory`.
 *
 * **Example** (Rendering the units for an operator to review)
 *
 * ```ts
 * import {
 *   AiMetricsForwarderTimerInput,
 *   renderAiMetricsForwarderTimerPlan
 * } from "@beep/repo-ai-metrics"
 *
 * const plan = renderAiMetricsForwarderTimerPlan(
 *   AiMetricsForwarderTimerInput.make({
 *     command: ["/usr/bin/bun", "run", "beep", "ai-metrics", "forwarder"],
 *     lockPath: "/tmp/beep-ai-metrics-forwarder.lock",
 *     statusPath: "/tmp/beep-ai-metrics-forwarder.json",
 *     workingDirectory: "/repo"
 *   })
 * )
 *
 * console.log(plan.serviceUnitName) // "beep-ai-metrics-forwarder.service"
 * console.log(plan.timerUnit.includes("OnUnitInactiveSec=30m")) // true
 * ```
 *
 * @param input - Timer rendering input with service names, command text, status path, and secret references.
 * @returns A render-only systemd timer/service plan for operator installation.
 * @category services
 * @since 0.0.0
 */
export const renderAiMetricsForwarderTimerPlan = (input: AiMetricsForwarderTimerInput): AiMetricsForwarderTimerPlan => {
  const timerInput = AiMetricsForwarderTimerInput.make(input);
  const serviceName = safeSystemdUnitNameStem(timerInput.serviceName);
  const serviceUnitName = `${serviceName}.service`;
  const timerUnitName = `${serviceName}.timer`;
  const statusTmpPath = `${timerInput.statusPath}.tmp`;
  const stderrTmpPath = `${timerInput.statusPath}.stderr.tmp`;
  const envFileShellPath = "~/.config/beep/ai-metrics.env";
  const envFileUnitPath = "%h/.config/beep/ai-metrics.env";
  const command = shellCommandFromArgv(timerInput.command);
  const failureStatusPython =
    'import json,sys; data=open(sys.argv[2],"rb").read(2000).decode("utf-8","replace"); print(json.dumps({"status":"failed","exitCode":int(sys.argv[1]),"stderr":data},separators=(",",":")))';
  const execCommand = pipe(
    [
      "set -euo pipefail",
      `mkdir -p "$(dirname ${shellQuote(timerInput.statusPath)})" "$(dirname ${shellQuote(timerInput.lockPath)})"`,
      "exit_code=0",
      `> ${shellQuote(stderrTmpPath)}`,
      `if flock -n ${shellQuote(timerInput.lockPath)} ${command} > ${shellQuote(statusTmpPath)} 2> ${shellQuote(stderrTmpPath)}; then :; else exit_code=$?; python3 -c ${shellQuote(failureStatusPython)} "$exit_code" ${shellQuote(stderrTmpPath)} > ${shellQuote(statusTmpPath)}; fi`,
      `rm -f ${shellQuote(stderrTmpPath)}`,
      `mv ${shellQuote(statusTmpPath)} ${shellQuote(timerInput.statusPath)}`,
      'exit "$exit_code"',
    ],
    A.join("; ")
  );
  const serviceUnit = pipe(
    [
      "[Unit]",
      "Description=Beep AI metrics forwarder collection",
      "StartLimitBurst=3",
      "StartLimitIntervalSec=30m",
      "",
      "[Service]",
      "Type=oneshot",
      `WorkingDirectory=${systemdUnitFieldValue(timerInput.workingDirectory)}`,
      `EnvironmentFile=${envFileUnitPath}`,
      "# The command pins the Bun executable path captured when this timer was rendered; rerender after changing Bun install paths.",
      `ExecStart=/usr/bin/env bash -lc ${shellQuote(execCommand)}`,
      "Restart=on-failure",
      "RestartSec=5m",
      "",
    ],
    A.join("\n")
  );
  const timerUnit = pipe(
    [
      "[Unit]",
      "Description=Run Beep AI metrics forwarder collection",
      "",
      "[Timer]",
      "OnBootSec=5m",
      `OnUnitInactiveSec=${timerInput.intervalMinutes}m`,
      "RandomizedDelaySec=2m",
      "Persistent=true",
      "",
      "[Install]",
      "WantedBy=timers.target",
      "",
    ],
    A.join("\n")
  );
  const writeEnvFileCommands = [
    `install -m 0600 /dev/null ${envFileShellPath}`,
    ...pipe(
      timerInput.hashSaltSecretRef,
      O.map((secretRef) => [
        `printf 'BEEP_AI_METRICS_HASH_SALT=%s\\n' "$(op read ${shellQuote(secretRef)})" >> ${envFileShellPath}`,
      ]),
      O.getOrElse(A.empty<string>)
    ),
    ...pipe(
      timerInput.rawArchiveKeySecretRef,
      O.map((secretRef) => [
        `printf 'BEEP_AI_METRICS_RAW_ARCHIVE_KEY=%s\\n' "$(op read ${shellQuote(secretRef)})" >> ${envFileShellPath}`,
      ]),
      O.getOrElse(A.empty<string>)
    ),
  ];

  return AiMetricsForwarderTimerPlan.make({
    installCommands: [
      `mkdir -p ~/.config/systemd/user ~/.config/beep "$(dirname ${shellQuote(timerInput.statusPath)})"`,
      ...writeEnvFileCommands,
      `printf '%s\\n' ${shellQuote(serviceUnit)} > ~/.config/systemd/user/${serviceUnitName}`,
      `printf '%s\\n' ${shellQuote(timerUnit)} > ~/.config/systemd/user/${timerUnitName}`,
      `systemctl --user daemon-reload`,
      `systemctl --user enable --now ${timerUnitName}`,
      `systemctl --user status ${timerUnitName}`,
      `journalctl --user -u ${serviceUnitName} -n 80 --no-pager`,
    ],
    lockPath: timerInput.lockPath,
    serviceUnit,
    serviceUnitName,
    statusPath: timerInput.statusPath,
    timerUnit,
    timerUnitName,
  });
};

const isWithinModifiedTimeWindow =
  (input: AiMetricsForwarderInput) =>
  (info: FileSystem.File.Info): boolean =>
    input.includeAll ||
    O.isNone(input.sinceEpochMillis) ||
    O.exists(input.sinceEpochMillis, (since) => modifiedAtMillis(info) >= since);

const isWithinSizeWindow =
  (input: AiMetricsForwarderInput) =>
  (info: FileSystem.File.Info): boolean =>
    O.isNone(input.maxFileBytes) || O.exists(input.maxFileBytes, (maximum) => fileSizeBytes(info) <= maximum);

const sourcePathHashForDiagnostics = Effect.fn("AiMetrics.forwarder.sourcePathHashForDiagnostics")(function* (
  input: AiMetricsForwarderInput,
  sourceFile: ForwarderSourceFile
) {
  return yield* hashPrivateIdentifier(sourceFile.sourcePath, input.hashSalt).pipe(
    Effect.mapError((cause) =>
      forwarderFailure("Failed to hash AI metrics source path for diagnostics.", {
        cause,
        sourceKind: sourceFile.sourceKind,
      })
    )
  );
});

const jsonlSourceFiles = Effect.fn("AiMetrics.forwarder.jsonlSourceFiles")(function* (
  input: AiMetricsForwarderInput,
  root: string,
  sourceKind: AiMetricsTranscriptSource
) {
  const fs = yield* FileSystem.FileSystem;
  const pathApi = yield* Path.Path;
  const sourcePaths = yield* collectJsonlFiles(root);
  const scannedFiles = yield* Effect.forEach(
    sourcePaths,
    Effect.fnUntraced(function* (sourcePath) {
      const info = yield* fs.stat(sourcePath).pipe(Effect.option);
      if (O.isNone(info) || info.value.type !== "File" || !isWithinModifiedTimeWindow(input)(info.value)) {
        return { excludedByMaxFileBytes: false, file: O.none<ForwarderSourceFile>() };
      }

      if (!isWithinSizeWindow(input)(info.value)) {
        return { excludedByMaxFileBytes: true, file: O.none<ForwarderSourceFile>() };
      }

      return {
        excludedByMaxFileBytes: false,
        file: O.some({
          modifiedAtMillis: modifiedAtMillis(info.value),
          relativePath: normalizedRelativePath(sourcePath, { pathApi, root }),
          sizeBytes: fileSizeBytes(info.value),
          sourceKind,
          sourcePath,
        }),
      };
    }),
    { concurrency: 16 }
  );

  return {
    files: pipe(
      scannedFiles,
      A.map((scan) => scan.file),
      A.getSomes
    ),
    sizeExcludedFileCount: pipe(
      scannedFiles,
      A.filter((scan) => scan.excludedByMaxFileBytes),
      A.length
    ),
  };
});

const openClawSourceFiles = Effect.fn("AiMetrics.forwarder.openClawSourceFiles")(function* (
  input: AiMetricsForwarderInput
) {
  const pathApi = yield* Path.Path;
  const unitPath = O.getOrElse(input.openClawUnitPath, () =>
    pathApi.join(input.homeDir, ".config/systemd/user/openclaw-gateway.service")
  );
  const info = yield* statOption(unitPath);
  if (O.isNone(info) || info.value.type !== "File" || !isWithinModifiedTimeWindow(input)(info.value)) {
    return {
      files: A.empty<ForwarderSourceFile>(),
      sizeExcludedFileCount: 0,
    };
  }

  if (!isWithinSizeWindow(input)(info.value)) {
    return {
      files: A.empty<ForwarderSourceFile>(),
      sizeExcludedFileCount: 1,
    };
  }

  return {
    files: A.of({
      modifiedAtMillis: modifiedAtMillis(info.value),
      relativePath: pathApi.basename(unitPath),
      sizeBytes: fileSizeBytes(info.value),
      sourceKind: AiMetricsTranscriptSource.Enum.openclaw,
      sourcePath: unitPath,
    }),
    sizeExcludedFileCount: 0,
  };
});

const byModifiedDescending: Order.Order<ForwarderSourceFile> = Order.mapInput(
  Order.Number,
  (file) => -file.modifiedAtMillis
);

const selectSourceFiles = (
  sourceKind: AiMetricsTranscriptSource,
  sourceFiles: ForwarderSourceFiles,
  maxFiles: number
): ForwarderSourceSelection => {
  const sortedFiles = pipe(sourceFiles.files, A.sort(byModifiedDescending));
  const includedFiles = A.take(sortedFiles, maxFiles);

  return {
    coverage: AiMetricsForwarderSourceCoverage.make({
      candidateFileCount: A.length(sortedFiles),
      includedFileCount: A.length(includedFiles),
      limitedByMaxFiles: A.length(sortedFiles) > A.length(includedFiles),
      sizeExcludedFileCount: sourceFiles.sizeExcludedFileCount,
      sourceKind,
    }),
    files: includedFiles,
  };
};

const discoverForwarderSourceFiles = Effect.fn("AiMetrics.forwarder.discoverSourceFiles")(function* (
  input: AiMetricsForwarderInput
) {
  const pathApi = yield* Path.Path;
  const { claudeRoot, codexRoot } = resolveTranscriptSourceRoots(input, pathApi);
  const [codexFiles, claudeFiles, openClawFiles] = yield* Effect.all(
    [
      jsonlSourceFiles(input, codexRoot, AiMetricsTranscriptSource.Enum.codex),
      jsonlSourceFiles(input, claudeRoot, AiMetricsTranscriptSource.Enum.claude),
      openClawSourceFiles(input),
    ] as const,
    { concurrency: 3 }
  );
  const selections = [
    selectSourceFiles(AiMetricsTranscriptSource.Enum.codex, codexFiles, input.maxFiles),
    selectSourceFiles(AiMetricsTranscriptSource.Enum.claude, claudeFiles, input.maxFiles),
    selectSourceFiles(AiMetricsTranscriptSource.Enum.openclaw, openClawFiles, input.maxFiles),
  ] as const;

  return {
    coverage: A.map(selections, (selection) => selection.coverage),
    files: pipe(
      selections,
      A.flatMap((selection) => selection.files),
      A.sort(byModifiedDescending)
    ),
  };
});

const processSourceFile = Effect.fn("AiMetrics.forwarder.processSourceFile")(
  function* (input: AiMetricsForwarderInput, rawArchiveDir: string, sourceFile: ForwarderSourceFile) {
    const fs = yield* FileSystem.FileSystem;
    const diagnosticSourcePathHash = yield* sourcePathHashForDiagnostics(input, sourceFile);
    const content = yield* fs.readFileString(sourceFile.sourcePath).pipe(
      Effect.mapError((_cause) =>
        forwarderFailure(`Failed to read AI metrics ${sourceFile.sourceKind} source file.`, {
          failure: "source_file_read_failed",
          sourceKind: sourceFile.sourceKind,
          sourcePathHash: diagnosticSourcePathHash,
        })
      )
    );
    const summary = yield* summarizeTranscriptText({
      content,
      hashSalt: input.hashSalt,
      sourceKind: sourceFile.sourceKind,
      sourcePath: sourceFile.sourcePath,
    }).pipe(Effect.mapError((cause) => forwarderFailure("Failed to summarize AI metrics source file.", cause)));
    const archiveObject = yield* writeEncryptedRawArchiveObject({
      content,
      hashSalt: input.hashSalt,
      rawArchiveDir,
      rawArchiveKey: input.rawArchiveKey,
      sourceKind: sourceFile.sourceKind,
      sourcePath: sourceFile.sourcePath,
    }).pipe(
      Effect.mapError((cause) => forwarderFailure("Failed to write encrypted AI metrics raw archive object.", cause))
    );
    const privacy = yield* makeAiMetricsPrivacyCheckResult({
      content,
      hashSalt: input.hashSalt,
      relativePath: O.some(sourceFile.relativePath),
      sourcePath: sourceFile.sourcePath,
      summary,
    }).pipe(Effect.mapError((cause) => forwarderFailure("Failed to build AI metrics privacy projection.", cause)));

    return AiMetricsDerivedTranscriptRecord.make({ archiveObject, privacy });
  },
  (effect, _input, _rawArchiveDir, sourceFile) =>
    effect.pipe(
      Effect.withSpan("repo_ai_metrics.forwarder.process_source_file", {
        attributes: {
          "ai_metrics.source_kind": sourceFile.sourceKind,
        },
      })
    )
);

/**
 * Run durable ingest: encrypted raw archive, DuckDB projection, and Parquet export.
 *
 * **Details**
 *
 * The run records identity before it records data. It resolves the install spec,
 * upserts the canonical root into the identity registry, and only then snapshots
 * configuration, archives raw transcripts, and projects derived rows — so a
 * store can never contain rows whose provenance is unreconstructable.
 * Configuration artifacts are written twice: once before derived storage as a
 * crash record, and again afterwards to promote the diff pointer.
 *
 * **Gotchas**
 *
 * The `DuckDb` requirement is not provided internally. Wrap the run with
 * {@link withAiMetricsDuckDb} so the connection scope closes with the run, and
 * point it at the same data root the input resolves to.
 *
 * **Example** (One local collection pass)
 *
 * ```ts
 * import {
 *   AiMetricsForwarderInput,
 *   aiMetricsDerivedDuckDbPath,
 *   runAiMetricsForwarder,
 *   withAiMetricsDuckDb
 * } from "@beep/repo-ai-metrics"
 * import { NodeServices } from "@effect/platform-node"
 * import { Effect, Option, Redacted } from "effect"
 *
 * const dataRoot = "/home/dev/.local/state/beep/ai-metrics"
 *
 * const input = AiMetricsForwarderInput.make({
 *   dataRoot: Option.some(dataRoot),
 *   homeDir: "/home/dev",
 *   rawArchiveKey: Redacted.make("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="),
 *   repoRoot: "/work/repo"
 * })
 *
 * const program = withAiMetricsDuckDb(
 *   runAiMetricsForwarder(input),
 *   aiMetricsDerivedDuckDbPath(dataRoot)
 * ).pipe(Effect.provide(NodeServices.layer))
 *
 * Effect.runPromise(program).then((result) => console.log(result.turnCount))
 * ```
 *
 * @effects
 * - Scans local Codex, Claude, and OpenClaw source locations.
 * - Upserts the run's canonical root into the identity registry.
 * - Reads selected source files and writes encrypted raw archive objects.
 * - Writes config snapshot artifacts before and after derived storage succeeds.
 * - Upserts derived rows into DuckDB and optionally refreshes Parquet exports.
 * @see {@link AiMetricsForwarderRunResult} for the counts and paths a completed run reports.
 * @category services
 * @since 0.0.0
 */
export const runAiMetricsForwarder = Effect.fn("AiMetrics.runAiMetricsForwarder")(
  function* (input: AiMetricsForwarderInput) {
    const startedAtEpochMillis = yield* Clock.currentTimeMillis;
    yield* requireForwarderHashSalt(input);
    const installSpec = yield* makeAiMetricsInstallSpec(
      AiMetricsInstallInput.make({
        dataRoot: input.dataRoot,
        hashSaltSecretRef: input.hashSaltSecretRef,
        rawArchiveKeySecretRef: input.rawArchiveKeySecretRef,
        target: input.target,
      })
    ).pipe(Effect.mapError((cause) => forwarderFailure("Failed to resolve AI metrics install storage layout.", cause)));
    const pathApi = yield* Path.Path;
    const absoluteDataRoot = yield* requireAbsoluteAiMetricsDataRoot(installSpec.storage.dataRoot).pipe(
      Effect.mapError((cause) => forwarderFailure("Failed to validate the hook-pulse lease data root.", cause))
    );
    const hookPulseLeaseReplay = yield* replayHookPulseLeases(
      HookPulseLeaseReplayInput.make({
        dataRoot: absoluteDataRoot,
        evaluatedAt: DateTime.makeUnsafe({ epochMilliseconds: startedAtEpochMillis }),
        evidenceRoot: O.getOrElse(input.agentEvidenceRoot, () => agentEvidenceRoot(`${input.homeDir}/.local/state`)),
        oipTaint: "unknown",
        ttlMs: PosInt.make(Duration.toMillis(DEFAULT_SESSION_LEASE_TTL)),
      })
    ).pipe(Effect.mapError((cause) => forwarderFailure("Failed to replay hook-pulse session leases.", cause)));
    yield* upsertAiMetricsIdentityRegistry(
      AiMetricsIdentityRegistryUpsertInput.make({
        dataRoot: installSpec.storage.dataRoot,
        ...O.getSomesStruct({ hashSalt: input.hashSalt }),
        homeDir: input.homeDir,
        rootPath: pathApi.resolve(input.repoRoot),
        // Every kind this run scans, so openclaw-derived rows keep source-instance
        // provenance and stay joinable through the registry.
        sourceKinds: [
          AiMetricsTranscriptSource.Enum.codex,
          AiMetricsTranscriptSource.Enum.claude,
          AiMetricsTranscriptSource.Enum.openclaw,
        ],
      })
    ).pipe(Effect.mapError((cause) => forwarderFailure("Failed to upsert the AI metrics identity registry.", cause)));
    const configSnapshotDir = pathApi.join(installSpec.storage.dataRoot, "config-snapshots");
    const configSnapshot = yield* makeAiMetricsConfigSnapshot(
      AiMetricsConfigSnapshotInput.make({
        previousSnapshotPath: O.some(pathApi.join(configSnapshotDir, "latest.json")),
        repoRoot: input.repoRoot,
      })
    ).pipe(Effect.mapError((cause) => forwarderFailure("Failed to build AI metrics config snapshot.", cause)));
    yield* writeAiMetricsConfigSnapshotArtifacts({
      commitLatest: false,
      outputDir: configSnapshotDir,
      result: configSnapshot,
    }).pipe(Effect.mapError((cause) => forwarderFailure("Failed to persist AI metrics config snapshot.", cause)));
    const repoRootHash = yield* hashPrivateIdentifier(pathApi.resolve(input.repoRoot), input.hashSalt).pipe(
      Effect.mapError((cause) => forwarderFailure("Failed to hash AI metrics repo root.", cause))
    );
    const sourceSelection = yield* discoverForwarderSourceFiles(input);
    const records = yield* Effect.forEach(
      sourceSelection.files,
      (sourceFile) => processSourceFile(input, installSpec.storage.rawArchiveDir, sourceFile),
      { concurrency: 4 }
    );
    const ingestRunId = `forwarder-${startedAtEpochMillis}`;
    const derived = yield* writeAiMetricsDerivedStorage(
      AiMetricsDerivedStorageWriteInput.make({
        configSnapshot: configSnapshot.snapshot,
        ingestRunId,
        parquetExportMode: input.parquetExportMode,
        records,
        repoRootHash,
        startedAtEpochMillis,
        storage: installSpec.storage,
        target: input.target,
      })
    ).pipe(Effect.mapError((cause) => forwarderFailure("Failed to write AI metrics derived storage.", cause)));
    yield* writeAiMetricsConfigSnapshotArtifacts({
      outputDir: configSnapshotDir,
      result: configSnapshot,
    }).pipe(Effect.mapError((cause) => forwarderFailure("Failed to commit latest AI metrics config snapshot.", cause)));

    return AiMetricsForwarderRunResult.make({
      archiveObjectCount: derived.archiveObjectCount,
      configSnapshotId: configSnapshot.snapshot.snapshotId,
      duckDbPath: derived.duckDbPath,
      hookPulseLeaseReplay: O.some(hookPulseLeaseReplay),
      ingestRunId: derived.ingestRunId,
      parquetExportDir: derived.parquetExportDir,
      parquetExportMode: derived.parquetExportMode,
      parquetTables: derived.parquetTables,
      rawArchiveDir: installSpec.storage.rawArchiveDir,
      sourceCoverage: sourceSelection.coverage,
      sourceFileCount: derived.sourceFileCount,
      target: input.target,
      turnCount: derived.turnCount,
    });
  },
  (effect, input) =>
    effect.pipe(
      Effect.withSpan("repo_ai_metrics.forwarder.run", {
        attributes: {
          "ai_metrics.include_all": input.includeAll,
          "ai_metrics.max_files": input.maxFiles,
          "ai_metrics.parquet_export_mode": input.parquetExportMode,
          "ai_metrics.target": input.target,
        },
      })
    )
);

/**
 * Encode a forwarder run result as the JSON the CLI prints and the status file stores.
 *
 * **Details**
 *
 * Encoding goes through the schema rather than `JSON.stringify`, so the text
 * round-trips back through {@link AiMetricsForwarderRunResult} and absent
 * optional keys stay absent instead of becoming `undefined`.
 *
 * **Example** (Encoding a completed run for the status file)
 *
 * ```ts
 * import {
 *   AiMetricsForwarderRunResult,
 *   forwarderRunResultToJson
 * } from "@beep/repo-ai-metrics"
 * import { Effect } from "effect"
 *
 * const result = AiMetricsForwarderRunResult.make({
 *   archiveObjectCount: 0,
 *   configSnapshotId: "config-1",
 *   duckDbPath: "/home/dev/.local/state/beep/ai-metrics/derived/ai-metrics.duckdb",
 *   ingestRunId: "forwarder-1",
 *   parquetExportMode: "snapshot",
 *   parquetTables: [],
 *   rawArchiveDir: "/home/dev/.local/state/beep/ai-metrics/raw",
 *   sourceFileCount: 0,
 *   target: "local",
 *   turnCount: 0
 * })
 *
 * const json = Effect.runSync(forwarderRunResultToJson(result))
 *
 * console.log(json.includes("forwarder-1")) // true
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const forwarderRunResultToJson: (
  result: AiMetricsForwarderRunResult
) => Effect.Effect<string, AiMetricsForwarderError> = Effect.fn("AiMetrics.forwarderRunResultToJson")(
  function* (result) {
    return yield* AiMetricsForwarderRunResult.encodeJsonEffect(result).pipe(
      Effect.mapError((cause) => forwarderFailure("Failed to encode AI metrics forwarder result as JSON.", cause))
    );
  }
);

/**
 * Encode a rendered timer plan as JSON for machine-readable operator output.
 *
 * **Details**
 *
 * The unit text is carried as JSON string fields rather than being written to
 * disk, so a caller can diff a proposed plan against the units already
 * installed before changing anything on the machine.
 *
 * **Example** (Encoding a plan for review)
 *
 * ```ts
 * import { AiMetricsForwarderTimerPlan, forwarderTimerPlanToJson } from "@beep/repo-ai-metrics"
 * import { Effect } from "effect"
 *
 * const json = Effect.runSync(
 *   forwarderTimerPlanToJson(
 *     AiMetricsForwarderTimerPlan.make({
 *       installCommands: [],
 *       lockPath: "/tmp/beep-ai-metrics-forwarder.lock",
 *       serviceUnit: "[Service]\nType=oneshot",
 *       serviceUnitName: "beep-ai-metrics-forwarder.service",
 *       statusPath: "/tmp/beep-ai-metrics-forwarder.json",
 *       timerUnit: "[Timer]\nOnUnitInactiveSec=30m",
 *       timerUnitName: "beep-ai-metrics-forwarder.timer"
 *     })
 *   )
 * )
 *
 * console.log(json.includes("beep-ai-metrics-forwarder.timer")) // true
 * ```
 *
 * @see {@link renderAiMetricsForwarderTimerPlan} for the renderer that produces the plan.
 * @category utilities
 * @since 0.0.0
 */
export const forwarderTimerPlanToJson: (
  result: AiMetricsForwarderTimerPlan
) => Effect.Effect<string, AiMetricsForwarderError> = Effect.fn("AiMetrics.forwarderTimerPlanToJson")(
  function* (result) {
    return yield* AiMetricsForwarderTimerPlan.encodeJsonEffect(result).pipe(
      Effect.mapError((cause) => forwarderFailure("Failed to encode AI metrics forwarder timer plan as JSON.", cause))
    );
  }
);
