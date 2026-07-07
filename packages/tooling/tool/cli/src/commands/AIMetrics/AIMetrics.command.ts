/**
 * AI metrics command suite.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { DuckDb, DuckDbConnectionOptions } from "@beep/duckdb";
import { $RepoCliId } from "@beep/identity/packages";
import { layerNodeSdkServerTraces, ServerObservabilityConfig } from "@beep/observability/server";
import {
  AiMetricsArchiveError,
  AiMetricsBenchmarkCaseInput,
  AiMetricsBenchmarkRunInput,
  AiMetricsConfigSnapshotError,
  AiMetricsConfigSnapshotInput,
  AiMetricsDeployTarget,
  AiMetricsForwarderError,
  AiMetricsForwarderInput,
  AiMetricsForwarderOtlpExported,
  AiMetricsForwarderOtlpExportFailed,
  AiMetricsForwarderRunResult,
  AiMetricsForwarderTimerInput,
  AiMetricsIngestError,
  AiMetricsInstallConfigurationError,
  AiMetricsInstallDoctorInput,
  AiMetricsInstallDoctorStatus,
  AiMetricsInstallInput,
  AiMetricsInstallSpec,
  AiMetricsLabelQueueInput,
  AiMetricsMirrorBundleInput,
  AiMetricsMirrorBundleManifest,
  AiMetricsMirrorError,
  AiMetricsOtlpEndpointSpec,
  AiMetricsOtlpExportError,
  AiMetricsOtlpExportInput,
  AiMetricsOutcomeLabelInput,
  AiMetricsParquetExportMode,
  AiMetricsPrivacyError,
  AiMetricsPrivacyMode,
  AiMetricsQualityGateStatus,
  AiMetricsRetentionEnforcementPolicy,
  AiMetricsRetentionError,
  AiMetricsRetentionRestoreDrillInput,
  AiMetricsRetentionSelector,
  AiMetricsScorecardError,
  AiMetricsSourceDiscoveryError,
  AiMetricsSourceDiscoveryInput,
  AiMetricsTool,
  AiMetricsTranscriptSource,
  AiMetricsWeeklyReportInput,
  addAiMetricsOutcomeLabel,
  aiMetricsBenchmarkCaseListToJson,
  aiMetricsBenchmarkCaseToJson,
  aiMetricsBenchmarkRunToJson,
  aiMetricsInstallApplyDryRunToJson,
  aiMetricsInstallDoctorToJson,
  aiMetricsInstallPlanToJson,
  aiMetricsLabelQueueToJson,
  aiMetricsMirrorBundleToJson,
  aiMetricsOutcomeLabelToJson,
  aiMetricsRetentionEnforcementToJson,
  aiMetricsRetentionInventoryToJson,
  aiMetricsRetentionMutationToJson,
  aiMetricsRetentionRestoreDrillToJson,
  aiMetricsWeeklyReportToJson,
  buildAiMetricsMirrorBundle,
  configSnapshotToJson,
  decryptEncryptedRawArchiveEnvelope,
  discoverAiMetricsSources,
  enforceAiMetricsRetentionPolicy,
  forwarderTimerPlanToJson,
  generateAiMetricsWeeklyReport,
  hashPublicTextSha256,
  listAiMetricsBenchmarkCases,
  listAiMetricsRetentionInventory,
  locateLatestAiMetricsMirrorBundle,
  makeAiMetricsConfigSnapshot,
  makeAiMetricsInstallApplyDryRunResult,
  makeAiMetricsInstallDoctorResult,
  makeAiMetricsInstallPlan,
  makeAiMetricsInstallSpec,
  makeAiMetricsPrivacyCheckResult,
  otlpExportResultToJson,
  privacyCheckToJson,
  queueAiMetricsLabels,
  readAiMetricsOtlpSpanProjections,
  readEncryptedRawArchiveEnvelope,
  recordAiMetricsBenchmarkRun,
  renderAiMetricsForwarderTimerPlan,
  renderAiMetricsLocalPhoenixCompose,
  runAiMetricsForwarder,
  runAiMetricsOtlpExport,
  runAiMetricsOtlpProjectionBatchExport,
  runAiMetricsRetentionCompact,
  runAiMetricsRetentionDelete,
  runAiMetricsRetentionRestoreDrill,
  shellQuote,
  sourceDiscoveryToJson,
  summarizeTranscriptText,
  summaryToJson,
  upsertAiMetricsBenchmarkCase,
} from "@beep/repo-ai-metrics";
import { A, Str } from "@beep/utils";
import * as O from "@beep/utils/Option";
import {
  Clock,
  Config,
  ConfigProvider,
  Console,
  DateTime,
  Duration,
  Effect,
  Exit,
  FileSystem,
  flow,
  Layer,
  Order,
  Path,
  pipe,
  Redacted,
} from "effect";
import * as S from "effect/Schema";
import { Command, Flag } from "effect/unstable/cli";
import { jsonFlag } from "../../internal/cli/Flags.js";
import { printLines } from "../../internal/cli/Printer.js";
import { AiMetricsCommandError, AiMetricsStatusExit } from "./AIMetrics.errors.js";
import type {
  AiMetricsForwarderOtlpExport,
  AiMetricsInstallDoctorResult,
  AiMetricsInstallPlan,
  AiMetricsOtlpExportResult,
  AiMetricsRetentionEnforcementResult,
} from "@beep/repo-ai-metrics";

const $I = $RepoCliId.create("commands/AIMetrics/AIMetrics.command");

const encodeJson = S.encodeUnknownEffect(S.UnknownFromJsonString);
const decodeMirrorManifestJson = S.decodeUnknownEffect(S.fromJsonString(AiMetricsMirrorBundleManifest));
const encodeInstallSpecJson = S.encodeUnknownEffect(S.fromJsonString(AiMetricsInstallSpec));
const localCollectorDataRoot = ".beep/ai-metrics";
const defaultP7MirrorRemoteRoot = "/srv/data/ai-metrics/p7-derived-mirror";
// cspell:words yubi
const defaultP7MirrorSshHost = "dankserver-yubi";
const p7MirrorConfirmToken = "p7-derived-mirror";
const p7MirrorSchemaVersion = "beep.ai_metrics.mirror_bundle.v1";
const p7MirrorRawArchiveTable = "ai_metrics_raw_archive_objects";
const p7RetentionConfirmToken = "p7-retention-window";

class AiMetricsArchiveDrillRow extends S.Class<AiMetricsArchiveDrillRow>($I`AiMetricsArchiveDrillRow`)(
  {
    archiveObjectId: S.String,
    archivePath: S.String,
    plaintextContentHash: S.String,
  },
  $I.annote("AiMetricsArchiveDrillRow", {
    description: "Latest encrypted raw archive row selected for a non-printing decrypt drill.",
  })
) {}

const decodeArchiveDrillRows = S.decodeUnknownEffect(S.Array(AiMetricsArchiveDrillRow));

const inputFlag = Flag.string("input").pipe(
  Flag.withAlias("i"),
  Flag.withDescription("Transcript JSONL file to ingest")
);
const targetFlag = Flag.choiceWithValue("target", [
  ["local", AiMetricsDeployTarget.Enum.local],
  ["dankserver", AiMetricsDeployTarget.Enum.dankserver],
]).pipe(Flag.withDefault(AiMetricsDeployTarget.Enum.local), Flag.withDescription("Install or forwarder target"));
const mirrorTargetFlag = pipe(
  Flag.choiceWithValue("target", [
    ["local", AiMetricsDeployTarget.Enum.local],
    ["dankserver", AiMetricsDeployTarget.Enum.dankserver],
  ]),
  Flag.withDefault(AiMetricsDeployTarget.Enum.dankserver),
  Flag.withDescription("Mirror bundle target")
);
const sourceFlag = Flag.choiceWithValue("source", [
  ["codex", AiMetricsTranscriptSource.Enum.codex],
  ["claude", AiMetricsTranscriptSource.Enum.claude],
  ["openclaw", AiMetricsTranscriptSource.Enum.openclaw],
]).pipe(Flag.withDescription("Transcript source kind"));
const toolFlag = Flag.choiceWithValue("tool", [
  ["langfuse", AiMetricsTool.Enum.langfuse],
  ["phoenix", AiMetricsTool.Enum.phoenix],
  ["opik", AiMetricsTool.Enum.opik],
  ["posthog", AiMetricsTool.Enum.posthog],
]).pipe(Flag.withDefault(AiMetricsTool.Enum.phoenix), Flag.withDescription("Default observability tool"));
const caseFlag = Flag.string("case").pipe(Flag.withDescription("Benchmark case identifier"));
const configFlag = Flag.string("config").pipe(Flag.withDescription("Config snapshot identifier"));
const taskFlag = Flag.string("task").pipe(Flag.withDescription("AI metrics agent task identifier"));
const titleFlag = Flag.string("title").pipe(Flag.withDescription("Human-readable benchmark case title"));
const promptHashFlag = Flag.string("prompt-hash").pipe(Flag.withDescription("Hash of benchmark prompt content"));
const promptRefFlag = Flag.string("prompt-ref").pipe(
  Flag.withDescription("Optional reference to benchmark prompt content"),
  Flag.optional
);
const checksFlag = Flag.string("checks").pipe(
  Flag.withDefault(""),
  Flag.withDescription("Comma-separated benchmark quality checks")
);
const ratingFlag = Flag.integer("rating").pipe(Flag.withDescription("Human rating from 1 to 5"));
const interventionsFlag = Flag.integer("interventions").pipe(
  Flag.withDefault(0),
  Flag.withDescription("Human intervention count")
);
const elapsedMsFlag = Flag.integer("elapsed-ms").pipe(Flag.withDescription("Benchmark elapsed milliseconds"));
const limitFlag = Flag.integer("limit").pipe(Flag.withDefault(20), Flag.withDescription("Maximum rows to return"));
const intervalMinutesFlag = Flag.integer("interval-minutes").pipe(
  Flag.withDefault(30),
  Flag.withDescription("Minutes between scheduled forwarder runs")
);
const passedValueFlag = Flag.choiceWithValue("passed", [
  ["true", true],
  ["false", false],
]).pipe(Flag.withDescription("Whether the task or benchmark passed"));
const followUpFixValueFlag = Flag.choiceWithValue("follow-up-fix", [
  ["true", true],
  ["false", false],
]).pipe(Flag.withDefault(false), Flag.withDescription("Whether a follow-up fix or revert was needed"));
const qualityGateFlag = Flag.choiceWithValue("quality-gate", [
  ["passed", AiMetricsQualityGateStatus.Enum.passed],
  ["failed", AiMetricsQualityGateStatus.Enum.failed],
  ["not_run", AiMetricsQualityGateStatus.Enum.not_run],
  ["unknown", AiMetricsQualityGateStatus.Enum.unknown],
]).pipe(Flag.withDefault(AiMetricsQualityGateStatus.Enum.unknown), Flag.withDescription("Quality-gate outcome"));

const noteFlag = Flag.string("note").pipe(Flag.withDescription("Optional redacted human note"), Flag.optional);

const repoRootFlag = Flag.string("repo-root").pipe(Flag.withDescription("Repository root path"), Flag.optional);

const homeDirFlag = Flag.string("home-dir").pipe(Flag.withDescription("Home directory to scan"), Flag.optional);

const sinceFlag = Flag.string("since").pipe(
  Flag.withDescription("Only include files modified since this ISO timestamp or epoch milliseconds"),
  Flag.optional
);

const untilFlag = Flag.string("until").pipe(
  Flag.withDescription("Only include records before this ISO timestamp or epoch milliseconds"),
  Flag.optional
);

const beforeFlag = Flag.string("before").pipe(
  Flag.withDescription("Retention upper-bound ISO timestamp or epoch milliseconds"),
  Flag.optional
);

const allFlag = Flag.boolean("all").pipe(
  Flag.withDescription("Scan all matching source files instead of the default 7 days")
);

const maxFilesFlag = Flag.integer("max-files").pipe(
  Flag.withDefault(200),
  Flag.withDescription("Maximum files to report per transcript source")
);

const maxFileBytesFlag = Flag.integer("max-file-bytes").pipe(
  Flag.withDescription("Skip transcript source files larger than this byte count"),
  Flag.optional
);

const timerMaxFilesFlag = Flag.integer("max-files").pipe(
  Flag.withDefault(5),
  Flag.withDescription("Maximum files per transcript source for each scheduled forwarder run")
);

const timerMaxFileBytesFlag = Flag.integer("max-file-bytes").pipe(
  Flag.withDefault(8_388_608),
  Flag.withDescription("Maximum source-file byte size for each scheduled forwarder run")
);
const parquetExportModeFlag = Flag.choiceWithValue("parquet-mode", [
  ["none", AiMetricsParquetExportMode.Enum.none],
  ["latest", AiMetricsParquetExportMode.Enum.latest],
  ["snapshot", AiMetricsParquetExportMode.Enum.snapshot],
]).pipe(
  Flag.withDefault(AiMetricsParquetExportMode.Enum.snapshot),
  Flag.withDescription("Parquet export mode for this forwarder run")
);
const timerParquetExportModeFlag = Flag.choiceWithValue("parquet-mode", [
  ["none", AiMetricsParquetExportMode.Enum.none],
  ["latest", AiMetricsParquetExportMode.Enum.latest],
  ["snapshot", AiMetricsParquetExportMode.Enum.snapshot],
]).pipe(
  Flag.withDefault(AiMetricsParquetExportMode.Enum.none),
  Flag.withDescription("Parquet export mode embedded in the rendered forwarder timer command")
);
const retentionEnforceFlag = Flag.boolean("retention-enforce").pipe(
  Flag.withDescription("Remove old per-run Parquet snapshots after a successful forwarder run")
);
const maxSnapshotExportsFlag = Flag.integer("max-snapshot-exports").pipe(
  Flag.withDefault(0),
  Flag.withDescription("Number of per-run Parquet snapshot exports to preserve during retention enforcement")
);
const forwarderRunMaxSnapshotExportsFlag = Flag.integer("max-snapshot-exports").pipe(
  Flag.withDefault(5),
  Flag.withDescription(
    "Per-run Parquet snapshot exports to keep; older snapshots are pruned automatically after each forwarder run"
  )
);
// Accepted but inert: `forwarder run` now always enforces snapshot retention. Retained so that
// already-installed systemd timer units (and any timer-rendered command) that still pass
// --retention-enforce continue to parse instead of failing with an unrecognized-flag error.
const forwarderRunRetentionEnforceCompatFlag = Flag.boolean("retention-enforce").pipe(
  Flag.withDescription(
    "Deprecated no-op: forwarder run always prunes old per-run Parquet snapshots; kept for backward compatibility"
  )
);
const hashSaltFlag = Flag.string("hash-salt").pipe(
  Flag.withDescription("Salt for hashing private paths and session identifiers"),
  Flag.optional
);
const hashSaltSecretRefFlag = Flag.string("hash-salt-secret-ref").pipe(
  Flag.withDescription("Secret reference that resolves BEEP_AI_METRICS_HASH_SALT for non-local install targets"),
  Flag.optional
);
const rawArchiveKeySecretRefFlag = Flag.string("raw-archive-key-secret-ref").pipe(
  Flag.withDescription("Secret reference that resolves BEEP_AI_METRICS_RAW_ARCHIVE_KEY for non-local install targets"),
  Flag.optional
);
const dataRootFlag = Flag.string("data-root").pipe(Flag.withDescription("AI metrics data root"), Flag.optional);
const remoteRootFlag = Flag.string("remote-root").pipe(
  Flag.withDefault(defaultP7MirrorRemoteRoot),
  Flag.withDescription("Remote AI metrics mirror root")
);
const bundleFlag = Flag.string("bundle").pipe(
  Flag.withDefault("latest"),
  Flag.withDescription("Mirror bundle directory, or latest")
);
const hostFlag = Flag.string("host").pipe(
  Flag.withDefault(defaultP7MirrorSshHost),
  Flag.withDescription("SSH host used for P7 mirror sync and status")
);
const confirmFlag = Flag.string("confirm").pipe(
  Flag.withDescription("Confirmation token required for real P7 mirror or retention writes"),
  Flag.optional
);
const restoreRootFlag = Flag.string("restore-root").pipe(Flag.withDescription("Disposable restore drill data root"));
const maxObjectsFlag = Flag.integer("max-objects").pipe(
  Flag.withDefault(1),
  Flag.withDescription("Maximum retained archive objects to restore during a drill")
);
const openClawUnitFlag = Flag.string("openclaw-unit").pipe(
  Flag.withDescription("OpenClaw user systemd unit path"),
  Flag.optional
);

const otlpFlag = Flag.boolean("otlp").pipe(Flag.withDescription("Enable explicit OTLP trace export for this command"));

const dryRunFlag = Flag.boolean("dry-run").pipe(
  Flag.withDescription("Preview install apply steps without changing local or remote state")
);

const otlpBaseUrlFlag = Flag.string("otlp-base-url").pipe(
  Flag.withDescription("Override the install spec OTLP base URL"),
  Flag.optional
);

const ingestRunFlag = Flag.string("ingest-run").pipe(
  Flag.withDefault("latest"),
  Flag.withDescription("Derived ingest run id to export, or latest")
);

const readInputFile = Effect.fn("AIMetrics.readInputFile")(function* (input: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const absolutePath = path.resolve(input);
  const content = yield* fs
    .readFileString(absolutePath)
    .pipe(AiMetricsCommandError.mapError("Failed to read transcript input."));

  return {
    absolutePath,
    content,
  };
});

const encodeCommandJson = flow(
  encodeJson,
  AiMetricsCommandError.mapError("Failed to encode AI metrics command output as JSON.")
);

const encodeInstallSpecCommandJson = flow(
  encodeInstallSpecJson,
  AiMetricsCommandError.mapError("Failed to encode AI metrics install spec as JSON.")
);

const AiMetricsProgramError = S.Union([
  AiMetricsArchiveError,
  AiMetricsCommandError,
  AiMetricsConfigSnapshotError,
  AiMetricsForwarderError,
  AiMetricsIngestError,
  AiMetricsInstallConfigurationError,
  AiMetricsMirrorError,
  AiMetricsOtlpExportError,
  AiMetricsPrivacyError,
  AiMetricsRetentionError,
  AiMetricsScorecardError,
  AiMetricsSourceDiscoveryError,
  AiMetricsStatusExit,
]).pipe(S.toTaggedUnion("_tag"));

type AiMetricsProgramError = typeof AiMetricsProgramError.Type;

const runAiMetricsProgram = <A, R>(
  effect: Effect.Effect<A, AiMetricsProgramError, R>
): Effect.Effect<void, AiMetricsProgramError, R> => effect.pipe(Effect.asVoid);

const readOptionalConfigString: (key: string) => Effect.Effect<O.Option<string>, AiMetricsCommandError> = Effect.fn(
  "AIMetrics.readOptionalConfigString"
)((key) =>
  ConfigProvider.ConfigProvider.use(pipe(Config.string(key), Config.option).parse).pipe(
    AiMetricsCommandError.mapError(`Failed to read ${key} from the Effect config provider.`)
  )
);

const readOptionalRedactedConfigString: (
  key: string
) => Effect.Effect<O.Option<Redacted.Redacted>, AiMetricsCommandError> = Effect.fn(
  "AIMetrics.readOptionalRedactedConfigString"
)((key) =>
  ConfigProvider.ConfigProvider.use(pipe(key, Config.redacted, Config.option).parse).pipe(
    AiMetricsCommandError.mapError(`Failed to read ${key} from the Effect config provider.`)
  )
);

const resolveHomeDir = Effect.fn("AIMetrics.resolveHomeDir")(function* (homeDir: O.Option<string>) {
  if (O.isSome(homeDir)) {
    return homeDir.value;
  }

  const envHome = yield* readOptionalConfigString("HOME");
  if (O.isSome(envHome)) {
    return envHome.value;
  }

  return yield* AiMetricsCommandError.make({
    cause: "HOME",
    message: "Unable to resolve a home directory. Pass --home-dir explicitly.",
  });
});

const resolveRepoRoot = Effect.fn("AIMetrics.resolveRepoRoot")(function* (repoRoot: O.Option<string>) {
  const path = yield* Path.Path;
  return path.resolve(O.isSome(repoRoot) ? repoRoot.value : process.cwd());
});

const resolveHashSalt = Effect.fn("AIMetrics.resolveHashSalt")(function* (hashSalt: O.Option<string>) {
  if (O.isSome(hashSalt)) {
    return hashSalt.value;
  }

  const envSalt = yield* readOptionalConfigString("BEEP_AI_METRICS_HASH_SALT");
  return O.isSome(envSalt) ? envSalt.value : undefined;
});

const resolveHashSaltSecretRef = Effect.fn("AIMetrics.resolveHashSaltSecretRef")(function* (
  hashSaltSecretRef: O.Option<string>
) {
  if (O.isSome(hashSaltSecretRef)) {
    return hashSaltSecretRef.value;
  }

  const envRef = yield* readOptionalConfigString("BEEP_AI_METRICS_HASH_SALT_SECRET_REF");
  return O.isSome(envRef) ? envRef.value : undefined;
});

const resolveRawArchiveKey = Effect.fn("AIMetrics.resolveRawArchiveKey")(function* () {
  const envKey = yield* readOptionalRedactedConfigString("BEEP_AI_METRICS_RAW_ARCHIVE_KEY");
  if (O.isSome(envKey) && Str.isNonEmpty(Str.trim(Redacted.value(envKey.value)))) {
    return envKey.value;
  }

  return yield* AiMetricsCommandError.make({
    cause: "BEEP_AI_METRICS_RAW_ARCHIVE_KEY",
    message: "AI metrics forwarder requires BEEP_AI_METRICS_RAW_ARCHIVE_KEY.",
  });
});

const resolveRawArchiveKeySecretRef = Effect.fn("AIMetrics.resolveRawArchiveKeySecretRef")(function* (
  rawArchiveKeySecretRef: O.Option<string>
) {
  if (O.isSome(rawArchiveKeySecretRef)) {
    return rawArchiveKeySecretRef.value;
  }

  const envRef = yield* readOptionalConfigString("BEEP_AI_METRICS_RAW_ARCHIVE_KEY_SECRET_REF");
  return O.isSome(envRef) ? envRef.value : undefined;
});
type RequireHashSaltForTargetOptions = {
  readonly hashSalt: string | undefined;
  readonly target: AiMetricsDeployTarget;
};
const requireHashSaltForTarget = Effect.fn("AIMetrics.requireHashSaltForTarget")(function* ({
  hashSalt,
  target,
}: RequireHashSaltForTargetOptions) {
  if (target === AiMetricsDeployTarget.Enum.local || (hashSalt !== undefined && Str.isNonEmpty(Str.trim(hashSalt)))) {
    return hashSalt;
  }

  return yield* AiMetricsCommandError.make({
    cause: target,
    message: "Non-local AI metrics commands require --hash-salt or BEEP_AI_METRICS_HASH_SALT.",
  });
});
type RequireHashSaltSecretRefForTargetOptions = {
  readonly hashSaltSecretRef: string | undefined;
  readonly target: AiMetricsDeployTarget;
};
const requireHashSaltSecretRefForTarget = Effect.fn("AIMetrics.requireHashSaltSecretRefForTarget")(function* ({
  hashSaltSecretRef,
  target,
}: RequireHashSaltSecretRefForTargetOptions) {
  if (
    target === AiMetricsDeployTarget.Enum.local ||
    (hashSaltSecretRef !== undefined && Str.isNonEmpty(Str.trim(hashSaltSecretRef)))
  ) {
    return hashSaltSecretRef;
  }

  return yield* AiMetricsCommandError.make({
    cause: target,
    message:
      "Non-local AI metrics install plans require --hash-salt-secret-ref or BEEP_AI_METRICS_HASH_SALT_SECRET_REF.",
  });
});
type RequireRawArchiveKeySecretRefForTargetOptions = {
  readonly rawArchiveKeySecretRef: string | undefined;
  readonly target: AiMetricsDeployTarget;
};
const requireRawArchiveKeySecretRefForTarget = Effect.fn("AIMetrics.requireRawArchiveKeySecretRefForTarget")(
  function* ({ rawArchiveKeySecretRef, target }: RequireRawArchiveKeySecretRefForTargetOptions) {
    if (
      target === AiMetricsDeployTarget.Enum.local ||
      (rawArchiveKeySecretRef !== undefined && Str.isNonEmpty(Str.trim(rawArchiveKeySecretRef)))
    ) {
      return rawArchiveKeySecretRef;
    }

    return yield* AiMetricsCommandError.make({
      cause: target,
      message:
        "Non-local AI metrics install plans require --raw-archive-key-secret-ref or BEEP_AI_METRICS_RAW_ARCHIVE_KEY_SECRET_REF.",
    });
  }
);

const parseEpochMillisOption = (value: string): O.Option<number> => {
  const trimmed = Str.trim(value);
  const parsedEpoch = globalThis.Number(trimmed);
  if (globalThis.Number.isFinite(parsedEpoch)) {
    return O.some(parsedEpoch);
  }

  return pipe(DateTime.make(trimmed), O.map(DateTime.toEpochMillis));
};

const parseSinceEpochMillis = Effect.fn("AIMetrics.parseSinceEpochMillis")(function* (since: O.Option<string>) {
  if (O.isNone(since)) {
    const now = yield* Clock.currentTimeMillis;
    return now - Duration.toMillis(Duration.days(7));
  }

  const parsed = parseEpochMillisOption(since.value);
  if (O.isSome(parsed)) {
    return parsed.value;
  }

  return yield* AiMetricsCommandError.make({
    cause: since.value,
    message: `Invalid --since value "${since.value}". Use an ISO timestamp or epoch milliseconds.`,
  });
});

const parseOptionalEpochMillis = Effect.fn("AIMetrics.parseOptionalEpochMillis")(function* (
  flagName: string,
  value: O.Option<string>
) {
  if (O.isNone(value)) {
    return O.none<number>();
  }

  const parsed = parseEpochMillisOption(value.value);
  if (O.isSome(parsed)) return parsed;

  return yield* AiMetricsCommandError.make({
    cause: value.value,
    message: `Invalid --${flagName} value "${value.value}". Use an ISO timestamp or epoch milliseconds.`,
  });
});
type ParseWindowOptions = {
  readonly since: O.Option<string>;
  readonly until: O.Option<string>;
};
const parseWindow = Effect.fn("AIMetrics.parseWindow")(function* ({ since, until }: ParseWindowOptions) {
  const end = yield* parseOptionalEpochMillis("until", until);
  const windowEndEpochMillis = O.isSome(end) ? end.value : yield* Clock.currentTimeMillis;
  const start = yield* parseOptionalEpochMillis("since", since);
  const windowStartEpochMillis = O.isSome(start)
    ? start.value
    : windowEndEpochMillis - Duration.toMillis(Duration.days(7));

  if (windowStartEpochMillis < windowEndEpochMillis) {
    return {
      windowEndEpochMillis,
      windowStartEpochMillis,
    };
  }

  return yield* AiMetricsCommandError.make({
    cause: {
      windowEndEpochMillis,
      windowStartEpochMillis,
    },
    message: "AI metrics report windows require --since to be before --until.",
  });
});
type ParseRetentionSelectorOptions = {
  readonly before: O.Option<string>;
  readonly dataRoot: O.Option<string>;
  readonly since: O.Option<string>;
  readonly until: O.Option<string>;
};
const parseRetentionSelector = Effect.fn("AIMetrics.parseRetentionSelector")(function* ({
  before,
  dataRoot,
  since,
  until,
}: ParseRetentionSelectorOptions) {
  const beforeEpochMillis = yield* parseOptionalEpochMillis("before", before);
  const sinceEpochMillis = yield* parseOptionalEpochMillis("since", since);
  const untilEpochMillis = yield* parseOptionalEpochMillis("until", until);

  return AiMetricsRetentionSelector.make({
    dataRoot: O.getOrElse(dataRoot, () => localCollectorDataRoot),
    ...O.getSomesStruct({
      beforeEpochMillis,
      sinceEpochMillis,
      untilEpochMillis,
    }),
  });
});

const hasRetentionWindow = (selector: AiMetricsRetentionSelector): boolean =>
  selector.beforeEpochMillis !== undefined ||
  selector.sinceEpochMillis !== undefined ||
  selector.untilEpochMillis !== undefined;

const retentionWindowUpper = (selector: AiMetricsRetentionSelector): number | undefined =>
  selector.beforeEpochMillis ?? selector.untilEpochMillis;

const hasBoundedRetentionMutationWindow = (selector: AiMetricsRetentionSelector): boolean =>
  selector.beforeEpochMillis !== undefined ||
  (selector.sinceEpochMillis !== undefined && selector.untilEpochMillis !== undefined);

const hasOrderedRetentionMutationWindow = (selector: AiMetricsRetentionSelector): boolean => {
  const upper = retentionWindowUpper(selector);
  return selector.sinceEpochMillis === undefined || upper === undefined || selector.sinceEpochMillis < upper;
};

const parseChecks = (checks: string): ReadonlyArray<string> =>
  pipe(Str.split(checks, ","), A.map(Str.trim), A.filter(Str.isNonEmpty));

const p6aCollectorDataRoot = (dataRoot: O.Option<string>, target: AiMetricsDeployTarget): O.Option<string> =>
  O.isSome(dataRoot) || target === AiMetricsDeployTarget.Enum.local ? dataRoot : O.some(localCollectorDataRoot);
type MakeCommandInstallInputOptions = {
  readonly dataRoot: O.Option<string>;
  readonly hashSaltSecretRef: O.Option<string>;
  readonly rawArchiveKeySecretRef: O.Option<string>;
  readonly target: AiMetricsDeployTarget;
};
const makeCommandInstallInput = Effect.fn("AIMetrics.makeCommandInstallInput")(function* ({
  dataRoot,
  hashSaltSecretRef,
  rawArchiveKeySecretRef,
  target,
}: MakeCommandInstallInputOptions) {
  const resolvedDataRoot = O.getOrUndefined(dataRoot);
  const resolvedHashSaltSecretRef = yield* requireHashSaltSecretRefForTarget({
    hashSaltSecretRef: yield* resolveHashSaltSecretRef(hashSaltSecretRef),
    target,
  });
  const resolvedRawArchiveKeySecretRef = yield* requireRawArchiveKeySecretRefForTarget({
    rawArchiveKeySecretRef: yield* resolveRawArchiveKeySecretRef(rawArchiveKeySecretRef),
    target,
  });

  return AiMetricsInstallInput.make({
    ...O.getSomesStruct({ dataRoot: O.fromUndefinedOr(resolvedDataRoot) }),
    ...O.getSomesStruct({ hashSaltSecretRef: O.fromUndefinedOr(resolvedHashSaltSecretRef) }),
    ...O.getSomesStruct({ rawArchiveKeySecretRef: O.fromUndefinedOr(resolvedRawArchiveKeySecretRef) }),
    target,
  });
});
type MakeCommandInstallSpecOptions = {
  readonly dataRoot: O.Option<string>;
  readonly hashSaltSecretRef: O.Option<string>;
  readonly rawArchiveKeySecretRef: O.Option<string>;
  readonly target: AiMetricsDeployTarget;
};
const makeCommandInstallSpec = Effect.fn("AIMetrics.makeCommandInstallSpec")(function* ({
  dataRoot,
  hashSaltSecretRef,
  rawArchiveKeySecretRef,
  target,
}: MakeCommandInstallSpecOptions) {
  return yield* makeAiMetricsInstallSpec(
    yield* makeCommandInstallInput({
      dataRoot,
      hashSaltSecretRef,
      rawArchiveKeySecretRef,
      target,
    })
  );
});

const renderInstallSpec = Effect.fn("AIMetrics.renderInstallSpec")(function* (
  spec: AiMetricsInstallSpec,
  json: boolean
) {
  if (json) {
    yield* Console.log(yield* encodeInstallSpecCommandJson(spec));
    return;
  }

  yield* printLines([
    `AI metrics install preview: ${spec.stackName}`,
    `target: ${spec.target}`,
    `data root: ${spec.storage.dataRoot}`,
    `raw archive: ${spec.storage.rawArchiveDir}`,
    `derived duckdb: ${spec.storage.duckDbPath}`,
    `privacy: ${spec.privacyMode}`,
    `default tool: ${spec.defaultTool}`,
  ]);
});

const defaultServiceEndpoint = Effect.fn("AIMetrics.defaultServiceEndpoint")(function* (
  spec: AiMetricsInstallSpec,
  otlpBaseUrl: O.Option<string>
) {
  const service = pipe(
    spec.services,
    A.findFirst((candidate) => candidate.enabledByDefault)
  );

  if (O.isNone(service)) {
    return yield* AiMetricsCommandError.make({
      cause: spec.defaultTool,
      message: "AI metrics install spec does not contain an enabled backend service.",
    });
  }

  if (O.isNone(otlpBaseUrl)) {
    return service.value.otlp;
  }

  const baseUrl = pipe(otlpBaseUrl.value, Str.replace(/\/+$/u, ""));
  return AiMetricsOtlpEndpointSpec.make({
    baseUrl,
    protocol: service.value.otlp.protocol,
    resourceAttributes: service.value.otlp.resourceAttributes,
    signalScope: service.value.otlp.signalScope,
    traceUrl: `${baseUrl}/v1/traces`,
  });
});

const serverObservabilityConfigFor = (
  target: AiMetricsDeployTarget,
  endpoint: AiMetricsOtlpEndpointSpec
): ServerObservabilityConfig =>
  ServerObservabilityConfig.make({
    devtoolsEnabled: false,
    devtoolsUrl: "ws://localhost:34437",
    environment: target,
    minLogLevel: "Info",
    otlpBaseUrl: endpoint.baseUrl,
    otlpEnabled: true,
    otlpResourceAttributes: endpoint.resourceAttributes,
    prometheusPrefix: "beep_ai_metrics",
    serviceName: "beep-ai-metrics",
    serviceVersion: "0.0.0",
  });
type MakeInstallPreviewProgramOptions = {
  readonly hashSaltSecretRef: O.Option<string>;
  readonly json: boolean;
  readonly rawArchiveKeySecretRef: O.Option<string>;
  readonly target: AiMetricsDeployTarget;
  readonly tool: AiMetricsTool;
};
const makeInstallPreviewProgram = Effect.fn("AIMetrics.makeInstallPreviewProgram")(function* ({
  hashSaltSecretRef,
  json,
  rawArchiveKeySecretRef,
  target,
  tool,
}: MakeInstallPreviewProgramOptions) {
  const resolvedHashSaltSecretRef = yield* requireHashSaltSecretRefForTarget({
    hashSaltSecretRef: yield* resolveHashSaltSecretRef(hashSaltSecretRef),
    target,
  });
  const resolvedRawArchiveKeySecretRef = yield* requireRawArchiveKeySecretRefForTarget({
    rawArchiveKeySecretRef: yield* resolveRawArchiveKeySecretRef(rawArchiveKeySecretRef),
    target,
  });
  const spec = yield* makeAiMetricsInstallSpec(
    AiMetricsInstallInput.make({
      defaultTool: tool,
      ...O.getSomesStruct({ hashSaltSecretRef: O.fromUndefinedOr(resolvedHashSaltSecretRef) }),
      ...O.getSomesStruct({ rawArchiveKeySecretRef: O.fromUndefinedOr(resolvedRawArchiveKeySecretRef) }),
      privacyMode: AiMetricsPrivacyMode.Enum.encrypted_raw_redacted_ui,
      target,
    })
  );

  yield* renderInstallSpec(spec, json);
});
type MakeInstallComposeProgramOptions = {
  readonly json: boolean;
  readonly target: AiMetricsDeployTarget;
  readonly tool: AiMetricsTool;
};
const makeInstallComposeProgram = Effect.fn("AIMetrics.makeInstallComposeProgram")(function* ({
  json,
  target,
  tool,
}: MakeInstallComposeProgramOptions) {
  const spec = yield* makeAiMetricsInstallSpec(
    AiMetricsInstallInput.make({
      defaultTool: tool,
      privacyMode: AiMetricsPrivacyMode.Enum.encrypted_raw_redacted_ui,
      target,
    })
  );
  const compose = yield* renderAiMetricsLocalPhoenixCompose(spec);

  if (json) {
    yield* Console.log(
      yield* encodeCommandJson({
        compose,
        target,
        tool,
      })
    );
    return;
  }

  yield* Console.log(compose);
});

const renderInstallPlan = Effect.fn("AIMetrics.renderInstallPlan")(function* (
  plan: AiMetricsInstallPlan,
  json: boolean
) {
  if (json) {
    yield* Console.log(yield* aiMetricsInstallPlanToJson(plan));
    return;
  }

  yield* printLines([
    `ai-metrics install plan: target=${plan.target}`,
    `stack: ${plan.stackName}`,
    `dry-run-only: ${plan.dryRunOnly}`,
    ...A.map(plan.steps, (step) => `${step.order}. ${step.stepId}: ${step.command}`),
  ]);
});
type MakeInstallPlanProgramOptions = {
  readonly dataRoot: O.Option<string>;
  readonly hashSaltSecretRef: O.Option<string>;
  readonly json: boolean;
  readonly rawArchiveKeySecretRef: O.Option<string>;
  readonly target: AiMetricsDeployTarget;
};
const makeInstallPlanProgram = Effect.fn("AIMetrics.makeInstallPlanProgram")(function* ({
  dataRoot,
  hashSaltSecretRef,
  json,
  rawArchiveKeySecretRef,
  target,
}: MakeInstallPlanProgramOptions) {
  const input = yield* makeCommandInstallInput({
    dataRoot,
    hashSaltSecretRef,
    rawArchiveKeySecretRef,
    target,
  });
  const plan = yield* makeAiMetricsInstallPlan(input);
  yield* renderInstallPlan(plan, json);
});

const renderInstallDoctor = Effect.fn("AIMetrics.renderInstallDoctor")(function* (
  result: AiMetricsInstallDoctorResult,
  json: boolean
) {
  if (json) {
    yield* Console.log(yield* aiMetricsInstallDoctorToJson(result));
    return;
  }

  yield* Console.log(`ai-metrics install doctor: target=${result.target} status=${result.status}`);
  yield* Console.log(`available sources: ${result.availableSourceCount}`);
  for (const check of result.checks) {
    yield* Console.log(`${check.status} ${check.checkId}: ${check.message}`);
  }
});
type MakeInstallDoctorProgramOptions = {
  readonly all: boolean;
  readonly dataRoot: O.Option<string>;
  readonly hashSalt: O.Option<string>;
  readonly hashSaltSecretRef: O.Option<string>;
  readonly homeDir: O.Option<string>;
  readonly json: boolean;
  readonly maxFileBytes: O.Option<number>;
  readonly maxFiles: number;
  readonly openClawUnit: O.Option<string>;
  readonly rawArchiveKeySecretRef: O.Option<string>;
  readonly repoRoot: O.Option<string>;
  readonly since: O.Option<string>;
  readonly target: AiMetricsDeployTarget;
};
const makeInstallDoctorProgram = Effect.fn("AIMetrics.makeInstallDoctorProgram")(function* ({
  all,
  dataRoot,
  hashSalt,
  hashSaltSecretRef,
  homeDir,
  json,
  maxFileBytes,
  maxFiles,
  openClawUnit,
  rawArchiveKeySecretRef,
  repoRoot,
  since,
  target,
}: MakeInstallDoctorProgramOptions) {
  const install = yield* makeCommandInstallInput({
    dataRoot,
    hashSaltSecretRef,
    rawArchiveKeySecretRef,
    target,
  });
  const resolvedHashSalt = yield* resolveHashSalt(hashSalt);
  const sinceEpochMillis = all ? undefined : yield* parseSinceEpochMillis(since);
  const sourceDiscovery = yield* discoverAiMetricsSources(
    AiMetricsSourceDiscoveryInput.make({
      homeDir: yield* resolveHomeDir(homeDir),
      includeAll: all,
      ...(O.isSome(maxFileBytes) ? { maxFileBytes: maxFileBytes.value } : {}),
      maxFiles,
      repoRoot: yield* resolveRepoRoot(repoRoot),
      target: AiMetricsDeployTarget.Enum.local,
      ...O.getSomesStruct({ hashSalt: O.fromUndefinedOr(resolvedHashSalt) }),
      ...O.getSomesStruct({ sinceEpochMillis: O.fromUndefinedOr(sinceEpochMillis) }),
      ...(O.isSome(openClawUnit) ? { openClawUnitPath: openClawUnit.value } : {}),
    })
  );
  const result = yield* makeAiMetricsInstallDoctorResult(
    AiMetricsInstallDoctorInput.make({
      install,
      sourceDiscovery,
    })
  );

  yield* renderInstallDoctor(result, json);
  if (result.status === AiMetricsInstallDoctorStatus.Enum.failed) {
    return yield* AiMetricsStatusExit.make({
      message: "AI metrics install doctor reported a failed status.",
    });
  }
});
type MakeInstallApplyProgramOptions = {
  readonly dataRoot: O.Option<string>;
  readonly dryRun: boolean;
  readonly hashSaltSecretRef: O.Option<string>;
  readonly json: boolean;
  readonly rawArchiveKeySecretRef: O.Option<string>;
  readonly target: AiMetricsDeployTarget;
};
const makeInstallApplyProgram = Effect.fn("AIMetrics.makeInstallApplyProgram")(function* ({
  dataRoot,
  dryRun,
  hashSaltSecretRef,
  json,
  rawArchiveKeySecretRef,
  target,
}: MakeInstallApplyProgramOptions) {
  if (!dryRun) {
    return yield* AiMetricsCommandError.make({
      cause: "install apply",
      message:
        "AI metrics CLI install apply is dry-run-only. Pass --dry-run; real dankserver mutation is owned by the Pulumi P5b stack.",
    });
  }

  const input = yield* makeCommandInstallInput({
    dataRoot,
    hashSaltSecretRef,
    rawArchiveKeySecretRef,
    target,
  });
  const result = yield* makeAiMetricsInstallApplyDryRunResult(input);

  if (json) {
    yield* Console.log(yield* aiMetricsInstallApplyDryRunToJson(result));
    return;
  }

  yield* printLines([
    `ai-metrics install apply: target=${result.target} dry-run=${result.dryRun}`,
    result.message,
    ...A.map(result.plan.steps, (step) => `${step.order}. ${step.stepId}: ${step.command}`),
  ]);
});
type MakeIngestProgramOptions = {
  readonly hashSalt: O.Option<string>;
  readonly input: string;
  readonly json: boolean;
  readonly source: AiMetricsTranscriptSource;
  readonly target: AiMetricsDeployTarget;
};
const makeIngestProgram = Effect.fn("AIMetrics.makeIngestProgram")(function* ({
  hashSalt,
  input,
  json,
  source,
  target,
}: MakeIngestProgramOptions) {
  const { absolutePath, content } = yield* readInputFile(input);
  const resolvedHashSalt = yield* requireHashSaltForTarget({
    hashSalt: yield* resolveHashSalt(hashSalt),
    target,
  });
  const summary = yield* summarizeTranscriptText({
    content,
    ...O.getSomesStruct({ hashSalt: O.fromUndefinedOr(resolvedHashSalt) }),
    sourceKind: source,
    sourcePath: absolutePath,
  });

  if (json) {
    yield* Console.log(yield* summaryToJson(summary));
    return;
  }

  const sourceHash = summary.sourcePathHash;
  yield* printLines([
    `ai-metrics ingest: ${summary.sourceKind} sourceHash=${sourceHash}`,
    `target: ${target}`,
    `lines: ${summary.totalLines}`,
    `accepted events: ${summary.acceptedEvents}`,
    `rejected lines: ${summary.rejectedLines}`,
    `event names: ${pipe(summary.eventNames, A.join(", "))}`,
  ]);
});

const collectJsonlInputFiles = Effect.fn("AIMetrics.collectJsonlInputFiles")(function* (
  inputPath: string
): Effect.fn.Return<ReadonlyArray<string>, AiMetricsCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const stat = yield* fs.stat(inputPath).pipe(AiMetricsCommandError.mapError("Failed to inspect privacy input."));

  if (stat.type === "File") {
    return [inputPath];
  }

  if (stat.type !== "Directory") {
    return yield* AiMetricsCommandError.make({
      cause: stat.type,
      message: "Expected --input to be a transcript file or directory.",
    });
  }

  const walk = Effect.fnUntraced(function* (
    currentPath: string
  ): Effect.fn.Return<ReadonlyArray<string>, never, FileSystem.FileSystem | Path.Path> {
    const info = yield* fs.stat(currentPath).pipe(Effect.option);
    if (O.isNone(info)) {
      return A.empty<string>();
    }

    if (info.value.type === "File") {
      return Str.endsWith(".jsonl")(currentPath) ? A.of(currentPath) : A.empty<string>();
    }

    if (info.value.type !== "Directory") {
      return A.empty<string>();
    }

    const entries = yield* fs.readDirectory(currentPath).pipe(Effect.orElseSucceed(A.empty<string>));
    let files = A.empty<string>();
    for (const entry of entries) {
      files = A.appendAll(files, yield* walk(path.join(currentPath, entry)));
    }

    return files;
  });

  return pipe(yield* walk(inputPath), A.sort(Order.String));
});

const readPrivacyInput = Effect.fn("AIMetrics.readPrivacyInput")(function* (input: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const absolutePath = path.resolve(input);
  const files = yield* collectJsonlInputFiles(absolutePath);
  const chunks = yield* Effect.forEach(
    files,
    (filePath) => fs.readFileString(filePath).pipe(AiMetricsCommandError.mapError("Failed to read transcript input.")),
    { concurrency: 8 }
  );

  return {
    absolutePath,
    content: pipe(chunks, A.join("\n")),
  };
});
type MakeSourcesDiscoverProgramOptions = {
  readonly all: boolean;
  readonly hashSalt: O.Option<string>;
  readonly homeDir: O.Option<string>;
  readonly json: boolean;
  readonly maxFileBytes: O.Option<number>;
  readonly maxFiles: number;
  readonly openClawUnit: O.Option<string>;
  readonly repoRoot: O.Option<string>;
  readonly since: O.Option<string>;
  readonly target: AiMetricsDeployTarget;
};
const makeSourcesDiscoverProgram = Effect.fn("AIMetrics.makeSourcesDiscoverProgram")(function* ({
  all,
  hashSalt,
  homeDir,
  json,
  maxFileBytes,
  maxFiles,
  openClawUnit,
  repoRoot,
  since,
  target,
}: MakeSourcesDiscoverProgramOptions) {
  const resolvedHashSalt = yield* requireHashSaltForTarget({
    hashSalt: yield* resolveHashSalt(hashSalt),
    target,
  });
  const sinceEpochMillis = all ? undefined : yield* parseSinceEpochMillis(since);
  const result = yield* discoverAiMetricsSources(
    AiMetricsSourceDiscoveryInput.make({
      homeDir: yield* resolveHomeDir(homeDir),
      includeAll: all,
      ...(O.isSome(maxFileBytes) ? { maxFileBytes: maxFileBytes.value } : {}),
      maxFiles,
      repoRoot: yield* resolveRepoRoot(repoRoot),
      target,
      ...O.getSomesStruct({ hashSalt: O.fromUndefinedOr(resolvedHashSalt) }),
      ...O.getSomesStruct({ sinceEpochMillis: O.fromUndefinedOr(sinceEpochMillis) }),
      ...(O.isSome(openClawUnit) ? { openClawUnitPath: openClawUnit.value } : {}),
    })
  );

  if (json) {
    yield* Console.log(yield* sourceDiscoveryToJson(result));
    return;
  }

  yield* printLines([
    `ai-metrics sources discover: target=${result.target}`,
    `hash salt: ${result.hashSaltStatus}`,
    `discovered files: ${result.discoveredFileCount}`,
    ...A.map(
      result.sources,
      (source) =>
        `${source.sourceKind}: ${source.status} files=${source.fileCount} candidates=${source.candidateFileCount} limited=${source.limitedByMaxFiles}`
    ),
  ]);
});
type MakeConfigSnapshotProgramOptions = {
  readonly json: boolean;
  readonly repoRoot: O.Option<string>;
};
const makeConfigSnapshotProgram = Effect.fn("AIMetrics.makeConfigSnapshotProgram")(function* ({
  json,
  repoRoot,
}: MakeConfigSnapshotProgramOptions) {
  const result = yield* makeAiMetricsConfigSnapshot(
    AiMetricsConfigSnapshotInput.make({
      repoRoot: yield* resolveRepoRoot(repoRoot),
    })
  );

  if (json) {
    yield* Console.log(yield* configSnapshotToJson(result));
    return;
  }

  yield* printLines([
    `ai-metrics config snapshot: ${result.snapshot.snapshotId}`,
    `files: ${result.fileCount}`,
    `hash: ${result.snapshot.configHash}`,
  ]);
});
type MakePrivacyCheckProgramOptions = {
  readonly hashSalt: O.Option<string>;
  readonly input: string;
  readonly json: boolean;
  readonly source: AiMetricsTranscriptSource;
};
const makePrivacyCheckProgram = Effect.fn("AIMetrics.makePrivacyCheckProgram")(function* ({
  hashSalt,
  input,
  json,
  source,
}: MakePrivacyCheckProgramOptions) {
  const { absolutePath, content } = yield* readPrivacyInput(input);
  const resolvedHashSalt = yield* resolveHashSalt(hashSalt);
  const summary = yield* summarizeTranscriptText({
    content,
    ...O.getSomesStruct({ hashSalt: O.fromUndefinedOr(resolvedHashSalt) }),
    sourceKind: source,
    sourcePath: absolutePath,
  });
  const result = yield* makeAiMetricsPrivacyCheckResult({
    content,
    sourcePath: absolutePath,
    summary,
    ...O.getSomesStruct({ hashSalt: O.fromUndefinedOr(resolvedHashSalt) }),
  });

  if (json) {
    yield* Console.log(yield* privacyCheckToJson(result));
    return;
  }

  yield* printLines([
    `ai-metrics privacy check: ${result.sourceKind}`,
    `hash salt: ${result.hashSaltStatus}`,
    `safe for derived UI: ${result.redaction.safeForDerivedUi}`,
    `accepted events: ${result.sanitized.acceptedEvents}`,
  ]);
});

const forwarderRunResultWithOtlpExport = (
  result: AiMetricsForwarderRunResult,
  otlpExport: AiMetricsForwarderOtlpExport
): AiMetricsForwarderRunResult =>
  AiMetricsForwarderRunResult.make({
    archiveObjectCount: result.archiveObjectCount,
    configSnapshotId: result.configSnapshotId,
    duckDbPath: result.duckDbPath,
    ingestRunId: result.ingestRunId,
    otlpExport,
    ...O.getSomesStruct({ parquetExportDir: O.fromUndefinedOr(result.parquetExportDir) }),
    parquetExportMode: result.parquetExportMode,
    parquetTables: result.parquetTables,
    rawArchiveDir: result.rawArchiveDir,
    sourceCoverage: result.sourceCoverage,
    sourceFileCount: result.sourceFileCount,
    target: result.target,
    turnCount: result.turnCount,
  });

const forwarderRunCommandToJson = Effect.fn("AIMetrics.forwarderRunCommandToJson")(function* (
  result: AiMetricsForwarderRunResult,
  retentionEnforcement: O.Option<AiMetricsRetentionEnforcementResult>
) {
  return yield* encodeCommandJson({
    archiveObjectCount: result.archiveObjectCount,
    configSnapshotId: result.configSnapshotId,
    duckDbPath: result.duckDbPath,
    ingestRunId: result.ingestRunId,
    ...O.getSomesStruct({ otlpExport: O.fromUndefinedOr(result.otlpExport) }),
    ...O.getSomesStruct({ parquetExportDir: O.fromUndefinedOr(result.parquetExportDir) }),
    parquetExportMode: result.parquetExportMode,
    parquetTables: result.parquetTables,
    rawArchiveDir: result.rawArchiveDir,
    ...O.getSomesStruct({ retentionEnforcement }),
    sourceCoverage: result.sourceCoverage,
    sourceFileCount: result.sourceFileCount,
    target: result.target,
    turnCount: result.turnCount,
  });
});

const forwarderOtlpExported = (result: AiMetricsOtlpExportResult): AiMetricsForwarderOtlpExported =>
  AiMetricsForwarderOtlpExported.make({
    endpointTraceUrl: result.endpointTraceUrl,
    ingestRunId: result.ingestRunId,
    sessionSpanCount: result.sessionSpanCount,
    spanCount: result.spanCount,
    status: "exported",
    target: result.target,
    turnSpanCount: result.turnSpanCount,
  });

const forwarderOtlpExportFailureMessage = "OTLP export did not complete after the forwarder run.";
type ForwarderOtlpExportFailedOptions = {
  readonly endpoint: AiMetricsOtlpEndpointSpec;
  readonly forwarderResult: AiMetricsForwarderRunResult;
  readonly message: string;
  readonly target: AiMetricsDeployTarget;
};
const forwarderOtlpExportFailed = ({
  endpoint,
  forwarderResult,
  message,
  target,
}: ForwarderOtlpExportFailedOptions): AiMetricsForwarderOtlpExportFailed =>
  AiMetricsForwarderOtlpExportFailed.make({
    endpointTraceUrl: endpoint.traceUrl,
    ingestRunId: forwarderResult.ingestRunId,
    message,
    status: "failed",
    target,
  });
type ExportForwarderDerivedOtlpOptions = {
  readonly endpoint: AiMetricsOtlpEndpointSpec;
  readonly forwarderResult: AiMetricsForwarderRunResult;
  readonly target: AiMetricsDeployTarget;
};
const exportForwarderDerivedOtlp = Effect.fn("AIMetrics.exportForwarderDerivedOtlp")(function* ({
  endpoint,
  forwarderResult,
  target,
}: ExportForwarderDerivedOtlpOptions) {
  return yield* runAiMetricsOtlpExport(
    AiMetricsOtlpExportInput.make({
      duckDbPath: forwarderResult.duckDbPath,
      endpoint,
      ingestRunId: forwarderResult.ingestRunId,
      target,
    })
  ).pipe(
    Effect.matchEffect({
      onFailure: Effect.fn(function* () {
        yield* Console.error(
          `ai-metrics: OTLP export failed after forwarder run: ${forwarderOtlpExportFailureMessage}`
        );
        return forwarderOtlpExportFailed({
          endpoint,
          forwarderResult,
          message: forwarderOtlpExportFailureMessage,
          target,
        });
      }),
      onSuccess: (result) => Effect.succeed(forwarderOtlpExported(result)),
    })
  );
});
type MakeForwarderRunProgramOptions = {
  readonly all: boolean;
  readonly dataRoot: O.Option<string>;
  readonly hashSalt: O.Option<string>;
  readonly hashSaltSecretRef: O.Option<string>;
  readonly homeDir: O.Option<string>;
  readonly json: boolean;
  readonly maxFileBytes: O.Option<number>;
  readonly maxFiles: number;
  readonly openClawUnit: O.Option<string>;
  readonly otlp: boolean;
  readonly otlpBaseUrl: O.Option<string>;
  readonly parquetExportMode: AiMetricsParquetExportMode;
  readonly rawArchiveKeySecretRef: O.Option<string>;
  readonly repoRoot: O.Option<string>;
  readonly retentionEnforce: boolean;
  readonly retentionMaxSnapshotExports: number;
  readonly since: O.Option<string>;
  readonly target: AiMetricsDeployTarget;
};
const makeForwarderRunProgram = Effect.fn("AIMetrics.makeForwarderRunProgram")(function* ({
  all,
  dataRoot,
  hashSalt,
  hashSaltSecretRef,
  homeDir,
  json,
  maxFileBytes,
  maxFiles,
  openClawUnit,
  otlp,
  otlpBaseUrl,
  parquetExportMode,
  rawArchiveKeySecretRef,
  repoRoot,
  retentionEnforce,
  retentionMaxSnapshotExports,
  since,
  target,
}: MakeForwarderRunProgramOptions) {
  const resolvedHashSalt = yield* requireHashSaltForTarget({
    hashSalt: yield* resolveHashSalt(hashSalt),
    target,
  });
  const resolvedHashSaltSecretRef = yield* requireHashSaltSecretRefForTarget({
    hashSaltSecretRef: yield* resolveHashSaltSecretRef(hashSaltSecretRef),
    target,
  });
  const resolvedRawArchiveKeySecretRef = yield* requireRawArchiveKeySecretRefForTarget({
    rawArchiveKeySecretRef: yield* resolveRawArchiveKeySecretRef(rawArchiveKeySecretRef),
    target,
  });
  const resolvedDataRoot = O.getOrUndefined(p6aCollectorDataRoot(dataRoot, target));
  const spec = yield* makeAiMetricsInstallSpec(
    AiMetricsInstallInput.make({
      ...O.getSomesStruct({ dataRoot: O.fromUndefinedOr(resolvedDataRoot) }),
      ...O.getSomesStruct({ hashSaltSecretRef: O.fromUndefinedOr(resolvedHashSaltSecretRef) }),
      ...O.getSomesStruct({ rawArchiveKeySecretRef: O.fromUndefinedOr(resolvedRawArchiveKeySecretRef) }),
      target,
    })
  );
  const resolvedRawArchiveKey = yield* resolveRawArchiveKey();
  const sinceEpochMillis = all ? undefined : yield* parseSinceEpochMillis(since);
  const forwarderInput = AiMetricsForwarderInput.make({
    ...O.getSomesStruct({ dataRoot: O.fromUndefinedOr(resolvedDataRoot) }),
    ...O.getSomesStruct({ hashSalt: O.fromUndefinedOr(resolvedHashSalt) }),
    ...O.getSomesStruct({ hashSaltSecretRef: O.fromUndefinedOr(resolvedHashSaltSecretRef) }),
    ...O.getSomesStruct({ rawArchiveKeySecretRef: O.fromUndefinedOr(resolvedRawArchiveKeySecretRef) }),
    homeDir: yield* resolveHomeDir(homeDir),
    includeAll: all,
    ...(O.isSome(maxFileBytes) ? { maxFileBytes: maxFileBytes.value } : {}),
    maxFiles,
    ...(O.isSome(openClawUnit) ? { openClawUnitPath: openClawUnit.value } : {}),
    parquetExportMode,
    rawArchiveKey: resolvedRawArchiveKey,
    repoRoot: yield* resolveRepoRoot(repoRoot),
    ...O.getSomesStruct({ sinceEpochMillis: O.fromUndefinedOr(sinceEpochMillis) }),
    target,
  });
  const duckDbLayer = DuckDb.makeNodeLayer(DuckDbConnectionOptions.make({ databasePath: spec.storage.duckDbPath }));
  const forwarderResult = yield* Effect.scoped(
    Layer.build(duckDbLayer).pipe(
      Effect.flatMap((context) => runAiMetricsForwarder(forwarderInput).pipe(Effect.provide(context)))
    )
  );
  let result: AiMetricsForwarderRunResult = forwarderResult;
  if (otlp) {
    const endpoint = yield* defaultServiceEndpoint(spec, otlpBaseUrl);
    const otlpExit = yield* Effect.scoped(
      Layer.build(
        Layer.mergeAll(duckDbLayer, layerNodeSdkServerTraces(serverObservabilityConfigFor(target, endpoint)))
      ).pipe(
        Effect.flatMap((context) =>
          exportForwarderDerivedOtlp({
            endpoint,
            forwarderResult,
            target,
          }).pipe(Effect.provide(context))
        )
      )
    ).pipe(Effect.exit);
    const otlpExport = Exit.isFailure(otlpExit)
      ? forwarderOtlpExportFailed({
          endpoint,
          forwarderResult,
          message: forwarderOtlpExportFailureMessage,
          target,
        })
      : otlpExit.value;

    if (Exit.isFailure(otlpExit)) {
      yield* Console.error(`ai-metrics: OTLP export failed after forwarder run: ${forwarderOtlpExportFailureMessage}`);
    }

    result = forwarderRunResultWithOtlpExport(forwarderResult, otlpExport);
  }
  const retentionEnforcement = retentionEnforce
    ? O.some(
        yield* enforceAiMetricsRetentionPolicy(
          AiMetricsRetentionEnforcementPolicy.make({
            dataRoot: spec.storage.dataRoot,
            dryRun: false,
            maxSnapshotExports: retentionMaxSnapshotExports,
          })
        )
      )
    : O.none();

  if (json) {
    yield* Console.log(yield* forwarderRunCommandToJson(result, retentionEnforcement));
    return;
  }

  yield* Console.log(`ai-metrics forwarder: target=${target}`);
  yield* Console.log(`ingest run: ${result.ingestRunId}`);
  yield* Console.log(`source files: ${result.sourceFileCount}`);
  yield* Console.log(`archive objects: ${result.archiveObjectCount}`);
  yield* Console.log(`turns: ${result.turnCount}`);
  yield* Console.log(`raw archive: ${result.rawArchiveDir}`);
  for (const source of result.sourceCoverage) {
    yield* Console.log(
      `${source.sourceKind}: included=${source.includedFileCount} candidates=${source.candidateFileCount} limited=${source.limitedByMaxFiles}`
    );
  }
  const duckDbLocation = result.duckDbPath;
  yield* Console.log(`derived duckdb: ${duckDbLocation}`);
  yield* Console.log(`parquet mode: ${result.parquetExportMode}`);
  const parquetLocation = O.fromUndefinedOr(result.parquetExportDir);
  if (O.isSome(parquetLocation)) {
    yield* Console.log(`parquet export: ${parquetLocation.value}`);
  }
  if (O.isSome(retentionEnforcement)) {
    yield* Console.log(
      `retention enforcement: deleted=${retentionEnforcement.value.deletedDerivedExportCount} kept=${retentionEnforcement.value.keptDerivedExportCount}`
    );
  }
  const otlpExport = O.fromNullishOr(result.otlpExport);
  if (O.isSome(otlpExport)) {
    yield* Console.log(`otlp export: ${otlpExport.value.status}`);
    if (otlpExport.value.status === "exported") {
      yield* Console.log(`otlp spans: ${otlpExport.value.spanCount}`);
      yield* Console.log(`otlp sessions: ${otlpExport.value.sessionSpanCount}`);
      yield* Console.log(`otlp turns: ${otlpExport.value.turnSpanCount}`);
    } else {
      yield* Console.log(`otlp failure: ${otlpExport.value.message}`);
    }
  }
});
type MakeForwarderTimerProgramOptions = {
  readonly dataRoot: O.Option<string>;
  readonly hashSaltSecretRef: O.Option<string>;
  readonly intervalMinutes: number;
  readonly json: boolean;
  readonly maxFileBytes: number;
  readonly maxFiles: number;
  readonly otlpBaseUrl: O.Option<string>;
  readonly parquetExportMode: AiMetricsParquetExportMode;
  readonly rawArchiveKeySecretRef: O.Option<string>;
  readonly repoRoot: O.Option<string>;
  readonly retentionEnforce: boolean;
  readonly retentionMaxSnapshotExports: number;
  readonly target: AiMetricsDeployTarget;
};
const makeForwarderTimerProgram = Effect.fn("AIMetrics.makeForwarderTimerProgram")(function* ({
  dataRoot,
  hashSaltSecretRef,
  intervalMinutes,
  json,
  maxFileBytes,
  maxFiles,
  otlpBaseUrl,
  parquetExportMode,
  rawArchiveKeySecretRef,
  repoRoot,
  retentionEnforce,
  retentionMaxSnapshotExports,
  target,
}: MakeForwarderTimerProgramOptions) {
  const resolvedDataRoot = p6aCollectorDataRoot(dataRoot, target);
  const spec = yield* makeCommandInstallSpec({
    dataRoot: resolvedDataRoot,
    hashSaltSecretRef,
    rawArchiveKeySecretRef,
    target,
  });
  const endpoint = yield* defaultServiceEndpoint(spec, otlpBaseUrl);
  const resolvedHashSaltSecretRef = yield* requireHashSaltSecretRefForTarget({
    hashSaltSecretRef: yield* resolveHashSaltSecretRef(hashSaltSecretRef),
    target,
  });
  const resolvedRawArchiveKeySecretRef = yield* requireRawArchiveKeySecretRefForTarget({
    rawArchiveKeySecretRef: yield* resolveRawArchiveKeySecretRef(rawArchiveKeySecretRef),
    target,
  });
  const otlpArgs =
    target === AiMetricsDeployTarget.Enum.dankserver ? ["--otlp", "--otlp-base-url", endpoint.baseUrl] : [];
  const plan = renderAiMetricsForwarderTimerPlan(
    AiMetricsForwarderTimerInput.make({
      command: [
        process.execPath,
        "packages/tooling/tool/cli/src/bin.ts",
        "--",
        "ai-metrics",
        "forwarder",
        "run",
        "--target",
        target,
        "--data-root",
        spec.storage.dataRoot,
        ...(resolvedHashSaltSecretRef === undefined ? [] : ["--hash-salt-secret-ref", resolvedHashSaltSecretRef]),
        ...(resolvedRawArchiveKeySecretRef === undefined
          ? []
          : ["--raw-archive-key-secret-ref", resolvedRawArchiveKeySecretRef]),
        ...otlpArgs,
        "--max-file-bytes",
        `${maxFileBytes}`,
        "--max-files",
        `${maxFiles}`,
        "--parquet-mode",
        parquetExportMode,
        // `forwarder run` always enforces retention now, so the rendered timer only needs to pass the
        // keep-N count when the operator opted into a non-default window. The legacy --retention-enforce
        // token is intentionally not emitted (run accepts it as a no-op for older installed units).
        ...(retentionEnforce ? ["--max-snapshot-exports", `${retentionMaxSnapshotExports}`] : []),
        "--json",
      ],
      ...O.getSomesStruct({ hashSaltSecretRef: O.fromUndefinedOr(resolvedHashSaltSecretRef) }),
      intervalMinutes,
      lockPath: "%t/beep-ai-metrics-forwarder.lock",
      ...O.getSomesStruct({ rawArchiveKeySecretRef: O.fromUndefinedOr(resolvedRawArchiveKeySecretRef) }),
      statusPath: `${spec.storage.dataRoot}/forwarder/status/latest.json`,
      workingDirectory: yield* resolveRepoRoot(repoRoot),
    })
  );

  if (json) {
    yield* Console.log(yield* forwarderTimerPlanToJson(plan));
    return;
  }

  yield* printLines([
    `# ${plan.serviceUnitName}`,
    plan.serviceUnit,
    `# ${plan.timerUnitName}`,
    plan.timerUnit,
    "# install commands",
    ...plan.installCommands,
  ]);
});
type MakeOtlpExportProgramOptions = {
  readonly dataRoot: O.Option<string>;
  readonly hashSaltSecretRef: O.Option<string>;
  readonly ingestRunId: string;
  readonly json: boolean;
  readonly otlpBaseUrl: O.Option<string>;
  readonly rawArchiveKeySecretRef: O.Option<string>;
  readonly target: AiMetricsDeployTarget;
};
const makeOtlpExportProgram = Effect.fn("AIMetrics.makeOtlpExportProgram")(function* ({
  dataRoot,
  hashSaltSecretRef,
  ingestRunId,
  json,
  otlpBaseUrl,
  rawArchiveKeySecretRef,
  target,
}: MakeOtlpExportProgramOptions) {
  const resolvedDataRoot = O.getOrUndefined(p6aCollectorDataRoot(dataRoot, target));
  const resolvedHashSaltSecretRef = yield* requireHashSaltSecretRefForTarget({
    hashSaltSecretRef: yield* resolveHashSaltSecretRef(hashSaltSecretRef),
    target,
  });
  const resolvedRawArchiveKeySecretRef = yield* requireRawArchiveKeySecretRefForTarget({
    rawArchiveKeySecretRef: yield* resolveRawArchiveKeySecretRef(rawArchiveKeySecretRef),
    target,
  });
  const spec = yield* makeAiMetricsInstallSpec(
    AiMetricsInstallInput.make({
      ...O.getSomesStruct({ dataRoot: O.fromUndefinedOr(resolvedDataRoot) }),
      ...O.getSomesStruct({ hashSaltSecretRef: O.fromUndefinedOr(resolvedHashSaltSecretRef) }),
      ...O.getSomesStruct({ rawArchiveKeySecretRef: O.fromUndefinedOr(resolvedRawArchiveKeySecretRef) }),
      target,
    })
  );
  const endpoint = yield* defaultServiceEndpoint(spec, otlpBaseUrl);
  const input = AiMetricsOtlpExportInput.make({
    duckDbPath: spec.storage.duckDbPath,
    endpoint,
    ingestRunId,
    target,
  });
  const duckDbLayer = DuckDb.makeNodeLayer(DuckDbConnectionOptions.make({ databasePath: spec.storage.duckDbPath }));
  const batch = yield* Effect.scoped(
    Layer.build(duckDbLayer).pipe(
      Effect.flatMap((context) => readAiMetricsOtlpSpanProjections(input).pipe(Effect.provide(context)))
    )
  );
  const resolvedInput = AiMetricsOtlpExportInput.make({
    duckDbPath: spec.storage.duckDbPath,
    endpoint,
    ingestRunId: batch.ingestRunId,
    target,
  });
  const result = yield* Effect.scoped(
    Layer.build(layerNodeSdkServerTraces(serverObservabilityConfigFor(target, endpoint))).pipe(
      Effect.flatMap((context) =>
        runAiMetricsOtlpProjectionBatchExport(resolvedInput, batch).pipe(Effect.provide(context))
      )
    )
  );

  if (json) {
    yield* Console.log(yield* otlpExportResultToJson(result));
    return;
  }

  yield* printLines([
    `ai-metrics otlp export: target=${target}`,
    `ingest run: ${result.ingestRunId}`,
    `spans: ${result.spanCount}`,
    `sessions: ${result.sessionSpanCount}`,
    `turns: ${result.turnSpanCount}`,
    `trace endpoint: ${result.endpointTraceUrl}`,
  ]);
});
type MakeBenchmarkRunProgramOptions = {
  readonly caseId: string;
  readonly configSnapshotId: string;
  readonly dataRoot: O.Option<string>;
  readonly elapsedMs: number;
  readonly hashSaltSecretRef: O.Option<string>;
  readonly json: boolean;
  readonly note: O.Option<string>;
  readonly passed: boolean;
  readonly qualityGate: AiMetricsQualityGateStatus;
  readonly rawArchiveKeySecretRef: O.Option<string>;
  readonly target: AiMetricsDeployTarget;
};
const makeBenchmarkRunProgram = Effect.fn("AIMetrics.makeBenchmarkRunProgram")(function* ({
  caseId,
  configSnapshotId,
  dataRoot,
  elapsedMs,
  hashSaltSecretRef,
  json,
  note,
  passed,
  qualityGate,
  rawArchiveKeySecretRef,
  target,
}: MakeBenchmarkRunProgramOptions) {
  const spec = yield* makeCommandInstallSpec({
    dataRoot: p6aCollectorDataRoot(dataRoot, target),
    hashSaltSecretRef,
    rawArchiveKeySecretRef,
    target,
  });
  const result = yield* Effect.scoped(
    Layer.build(DuckDb.makeNodeLayer(DuckDbConnectionOptions.make({ databasePath: spec.storage.duckDbPath }))).pipe(
      Effect.flatMap((context) =>
        recordAiMetricsBenchmarkRun(
          AiMetricsBenchmarkRunInput.make({
            benchmarkCaseId: caseId,
            configSnapshotId,
            elapsedMs,
            passed,
            qualityGate,
            ...(O.isSome(note) ? { note: note.value } : {}),
          })
        ).pipe(Effect.provide(context))
      )
    )
  );

  if (json) {
    yield* Console.log(yield* aiMetricsBenchmarkRunToJson(result));
    return;
  }

  yield* printLines([
    `ai-metrics benchmark run: ${result.benchmarkRunId}`,
    `case: ${result.benchmarkCaseId}`,
    `config: ${result.configSnapshotId}`,
    `passed: ${result.passed}`,
  ]);
});

const makeBenchmarkCompareProgram = Effect.fn("AIMetrics.makeBenchmarkCompareProgram")(function* ({
  json,
}: {
  readonly json: boolean;
}) {
  if (json) {
    yield* Console.log(
      yield* encodeCommandJson({
        scoreModel: "outcome-heavy",
        status: "ready-for-derived-runs",
      })
    );
    return;
  }

  yield* Console.log("ai-metrics benchmark compare: outcome-heavy scorecard ready for derived run tables");
});
type MakeLabelQueueProgramOptions = {
  readonly dataRoot: O.Option<string>;
  readonly hashSaltSecretRef: O.Option<string>;
  readonly json: boolean;
  readonly limit: number;
  readonly rawArchiveKeySecretRef: O.Option<string>;
  readonly since: O.Option<string>;
  readonly target: AiMetricsDeployTarget;
  readonly until: O.Option<string>;
};
const makeLabelQueueProgram = Effect.fn("AIMetrics.makeLabelQueueProgram")(function* ({
  dataRoot,
  hashSaltSecretRef,
  json,
  limit,
  rawArchiveKeySecretRef,
  since,
  target,
  until,
}: MakeLabelQueueProgramOptions) {
  const spec = yield* makeCommandInstallSpec({
    dataRoot: p6aCollectorDataRoot(dataRoot, target),
    hashSaltSecretRef,
    rawArchiveKeySecretRef,
    target,
  });
  const window = yield* parseWindow({
    since,
    until,
  });
  const result = yield* Effect.scoped(
    Layer.build(DuckDb.makeNodeLayer(DuckDbConnectionOptions.make({ databasePath: spec.storage.duckDbPath }))).pipe(
      Effect.flatMap((context) =>
        queueAiMetricsLabels(
          AiMetricsLabelQueueInput.make({
            limit,
            target,
            windowEndEpochMillis: window.windowEndEpochMillis,
            windowStartEpochMillis: window.windowStartEpochMillis,
          })
        ).pipe(Effect.provide(context))
      )
    )
  );

  if (json) {
    yield* Console.log(yield* aiMetricsLabelQueueToJson(result));
    return;
  }

  yield* printLines([
    `ai-metrics label queue: target=${target}`,
    `items: ${A.length(result.items)}`,
    ...A.map(result.items, (item) => `${item.agentTaskId} config=${item.configSnapshotId} turns=${item.turnCount}`),
  ]);
});
type MakeLabelAddProgramOptions = {
  readonly dataRoot: O.Option<string>;
  readonly followUpFix: boolean;
  readonly hashSaltSecretRef: O.Option<string>;
  readonly interventions: number;
  readonly json: boolean;
  readonly note: O.Option<string>;
  readonly passed: boolean;
  readonly qualityGate: AiMetricsQualityGateStatus;
  readonly rating: number;
  readonly rawArchiveKeySecretRef: O.Option<string>;
  readonly target: AiMetricsDeployTarget;
  readonly taskId: string;
};
const makeLabelAddProgram = Effect.fn("AIMetrics.makeLabelAddProgram")(function* ({
  dataRoot,
  followUpFix,
  hashSaltSecretRef,
  interventions,
  json,
  note,
  passed,
  qualityGate,
  rating,
  rawArchiveKeySecretRef,
  target,
  taskId,
}: MakeLabelAddProgramOptions) {
  const spec = yield* makeCommandInstallSpec({
    dataRoot: p6aCollectorDataRoot(dataRoot, target),
    hashSaltSecretRef,
    rawArchiveKeySecretRef,
    target,
  });
  const result = yield* Effect.scoped(
    Layer.build(DuckDb.makeNodeLayer(DuckDbConnectionOptions.make({ databasePath: spec.storage.duckDbPath }))).pipe(
      Effect.flatMap((context) =>
        addAiMetricsOutcomeLabel(
          AiMetricsOutcomeLabelInput.make({
            agentTaskId: taskId,
            followUpFix,
            interventionCount: interventions,
            passed,
            qualityGate,
            rating,
            ...(O.isSome(note) ? { note: note.value } : {}),
          })
        ).pipe(Effect.provide(context))
      )
    )
  );

  if (json) {
    yield* Console.log(yield* aiMetricsOutcomeLabelToJson(result));
    return;
  }

  yield* printLines([
    `ai-metrics label add: ${result.labelId}`,
    `task: ${result.agentTaskId}`,
    `passed: ${result.passed}`,
  ]);
});
type MakeBenchmarkCaseAddProgramOptions = {
  readonly caseId: string;
  readonly checks: string;
  readonly dataRoot: O.Option<string>;
  readonly hashSaltSecretRef: O.Option<string>;
  readonly json: boolean;
  readonly promptHash: string;
  readonly promptRef: O.Option<string>;
  readonly rawArchiveKeySecretRef: O.Option<string>;
  readonly target: AiMetricsDeployTarget;
  readonly title: string;
};
const makeBenchmarkCaseAddProgram = Effect.fn("AIMetrics.makeBenchmarkCaseAddProgram")(function* ({
  caseId,
  checks,
  dataRoot,
  hashSaltSecretRef,
  json,
  promptHash,
  promptRef,
  rawArchiveKeySecretRef,
  target,
  title,
}: MakeBenchmarkCaseAddProgramOptions) {
  const spec = yield* makeCommandInstallSpec({
    dataRoot: p6aCollectorDataRoot(dataRoot, target),
    hashSaltSecretRef,
    rawArchiveKeySecretRef,
    target,
  });
  const result = yield* Effect.scoped(
    Layer.build(DuckDb.makeNodeLayer(DuckDbConnectionOptions.make({ databasePath: spec.storage.duckDbPath }))).pipe(
      Effect.flatMap((context) =>
        upsertAiMetricsBenchmarkCase(
          AiMetricsBenchmarkCaseInput.make({
            benchmarkCaseId: caseId,
            expectedChecks: parseChecks(checks),
            promptHash,
            title,
            ...(O.isSome(promptRef) ? { promptRef: promptRef.value } : {}),
          })
        ).pipe(Effect.provide(context))
      )
    )
  );

  if (json) {
    yield* Console.log(yield* aiMetricsBenchmarkCaseToJson(result));
    return;
  }

  yield* printLines([
    `ai-metrics benchmark case add: ${result.benchmarkCaseId}`,
    `checks: ${A.length(result.expectedChecks)}`,
  ]);
});
type MakeBenchmarkCaseListProgramOptions = {
  readonly dataRoot: O.Option<string>;
  readonly hashSaltSecretRef: O.Option<string>;
  readonly json: boolean;
  readonly rawArchiveKeySecretRef: O.Option<string>;
  readonly target: AiMetricsDeployTarget;
};
const makeBenchmarkCaseListProgram = Effect.fn("AIMetrics.makeBenchmarkCaseListProgram")(function* ({
  dataRoot,
  hashSaltSecretRef,
  json,
  rawArchiveKeySecretRef,
  target,
}: MakeBenchmarkCaseListProgramOptions) {
  const spec = yield* makeCommandInstallSpec({
    dataRoot: p6aCollectorDataRoot(dataRoot, target),
    hashSaltSecretRef,
    rawArchiveKeySecretRef,
    target,
  });
  const result = yield* Effect.scoped(
    Layer.build(DuckDb.makeNodeLayer(DuckDbConnectionOptions.make({ databasePath: spec.storage.duckDbPath }))).pipe(
      Effect.flatMap((context) => listAiMetricsBenchmarkCases.pipe(Effect.provide(context)))
    )
  );

  if (json) {
    yield* Console.log(yield* aiMetricsBenchmarkCaseListToJson(result));
    return;
  }

  yield* printLines([
    `ai-metrics benchmark case list: ${A.length(result.cases)}`,
    ...A.map(result.cases, (benchmarkCase) => `${benchmarkCase.benchmarkCaseId}: ${benchmarkCase.title}`),
  ]);
});
type MakeWeeklyReportProgramOptions = {
  readonly dataRoot: O.Option<string>;
  readonly hashSaltSecretRef: O.Option<string>;
  readonly json: boolean;
  readonly rawArchiveKeySecretRef: O.Option<string>;
  readonly since: O.Option<string>;
  readonly target: AiMetricsDeployTarget;
  readonly until: O.Option<string>;
};
const makeWeeklyReportProgram = Effect.fn("AIMetrics.makeWeeklyReportProgram")(function* ({
  dataRoot,
  hashSaltSecretRef,
  json,
  rawArchiveKeySecretRef,
  since,
  target,
  until,
}: MakeWeeklyReportProgramOptions) {
  const path = yield* Path.Path;
  const spec = yield* makeCommandInstallSpec({
    dataRoot: p6aCollectorDataRoot(dataRoot, target),
    hashSaltSecretRef,
    rawArchiveKeySecretRef,
    target,
  });
  const window = yield* parseWindow({
    since,
    until,
  });
  const result = yield* Effect.scoped(
    Layer.build(DuckDb.makeNodeLayer(DuckDbConnectionOptions.make({ databasePath: spec.storage.duckDbPath }))).pipe(
      Effect.flatMap((context) =>
        generateAiMetricsWeeklyReport(
          AiMetricsWeeklyReportInput.make({
            reportDir: path.join(spec.storage.dataRoot, "reports"),
            target,
            windowEndEpochMillis: window.windowEndEpochMillis,
            windowStartEpochMillis: window.windowStartEpochMillis,
          })
        ).pipe(Effect.provide(context))
      )
    )
  );

  if (json) {
    yield* Console.log(yield* aiMetricsWeeklyReportToJson(result));
    return;
  }

  yield* printLines([
    `ai-metrics report weekly: target=${target}`,
    `scorecards: ${A.length(result.document.scores)}`,
    `markdown: ${result.markdownPath}`,
    `json: ${result.jsonPath}`,
  ]);
});

type CapturedCommandResult = {
  readonly args: ReadonlyArray<string>;
  readonly command: string;
  readonly exitCode: number;
  readonly stderr: string;
  readonly stdout: string;
};

const decodeBytes = (bytes: Uint8Array): string => new TextDecoder("utf-8").decode(bytes);

const runCapturedCommand = Effect.fn("AIMetrics.runCapturedCommand")(function* (
  command: string,
  args: ReadonlyArray<string>
) {
  const result = yield* Effect.sync(() =>
    Bun.spawnSync({
      cmd: [command, ...args],
      env: process.env,
      stderr: "pipe",
      stdout: "pipe",
    })
  );
  const captured: CapturedCommandResult = {
    args,
    command,
    exitCode: result.exitCode,
    stderr: decodeBytes(result.stderr),
    stdout: decodeBytes(result.stdout),
  };

  if (result.success) {
    return captured;
  }

  return yield* AiMetricsCommandError.make({
    cause: captured,
    message: `Failed to run ${command} for AI metrics P7 mirror workflow.`,
  });
});

const commandText = (command: string, args: ReadonlyArray<string>): string =>
  pipe([command, ...args], A.map(shellQuote), A.join(" "));

const resolveMirrorBundleDir = Effect.fn("AIMetrics.resolveMirrorBundleDir")(function* ({
  bundle,
  dataRoot,
}: {
  readonly bundle: string;
  readonly dataRoot: O.Option<string>;
}) {
  if (bundle !== "latest") {
    return bundle;
  }

  return yield* locateLatestAiMetricsMirrorBundle(O.getOrElse(dataRoot, () => localCollectorDataRoot));
});

const readMirrorManifest = Effect.fn("AIMetrics.readMirrorManifest")(function* (manifestPath: string) {
  const fs = yield* FileSystem.FileSystem;
  const content = yield* fs
    .readFileString(manifestPath)
    .pipe(AiMetricsCommandError.mapError("Failed to read AI metrics mirror manifest JSON."));
  return yield* decodeMirrorManifestJson(content).pipe(
    AiMetricsCommandError.mapError("Failed to parse AI metrics mirror manifest JSON.")
  );
});

const requireSafeMirrorManifest = Effect.fn("AIMetrics.requireSafeMirrorManifest")(function* ({
  manifest,
  remoteRoot,
  target,
}: {
  readonly manifest: AiMetricsMirrorBundleManifest;
  readonly remoteRoot: string;
  readonly target: AiMetricsDeployTarget;
}) {
  if (manifest.schemaVersion !== p7MirrorSchemaVersion) {
    return yield* AiMetricsCommandError.make({
      cause: manifest.schemaVersion,
      message: `AI metrics mirror manifest schema must be "${p7MirrorSchemaVersion}".`,
    });
  }
  if (!manifest.privacyProof.safe) {
    return yield* AiMetricsCommandError.make({
      cause: manifest.privacyProof,
      message: "AI metrics mirror manifest privacy proof is not safe.",
    });
  }
  if (!A.contains(manifest.omittedTables, p7MirrorRawArchiveTable)) {
    return yield* AiMetricsCommandError.make({
      cause: manifest.omittedTables,
      message: "AI metrics mirror manifest must omit raw archive objects.",
    });
  }
  if (A.contains(manifest.includedTables, p7MirrorRawArchiveTable)) {
    return yield* AiMetricsCommandError.make({
      cause: manifest.includedTables,
      message: "AI metrics mirror manifest must not include raw archive objects.",
    });
  }
  if (manifest.remoteRoot !== remoteRoot) {
    return yield* AiMetricsCommandError.make({
      cause: manifest.remoteRoot,
      message: "AI metrics mirror manifest remote root does not match the command target.",
    });
  }
  if (manifest.target !== target) {
    return yield* AiMetricsCommandError.make({
      cause: manifest.target,
      message: "AI metrics mirror manifest deployment target does not match the command target.",
    });
  }
});

const isAllowedMirrorBundleFile = (relativePath: string): boolean =>
  relativePath === "manifest.json" ||
  relativePath === "status/mirror-status.json" ||
  (Str.startsWith("parquet/")(relativePath) && Str.endsWith(".parquet")(relativePath));

const listMirrorBundleFiles = Effect.fn("AIMetrics.listMirrorBundleFiles")(function* (bundleDir: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const walk = Effect.fnUntraced(function* (
    currentPath: string
  ): Effect.fn.Return<ReadonlyArray<string>, AiMetricsCommandError, FileSystem.FileSystem | Path.Path> {
    const stat = yield* fs
      .stat(currentPath)
      .pipe(AiMetricsCommandError.mapError("Failed to inspect AI metrics mirror bundle file inventory."));
    if (stat.type === "File") {
      return [pipe(path.relative(bundleDir, currentPath), Str.replace(/\\/gu, "/"))];
    }
    if (stat.type !== "Directory") {
      return A.empty<string>();
    }

    const entries = yield* fs
      .readDirectory(currentPath)
      .pipe(AiMetricsCommandError.mapError("Failed to read AI metrics mirror bundle file inventory."));
    const nested = yield* Effect.forEach(entries, (entry) => walk(path.join(currentPath, entry)), { concurrency: 8 });
    return A.flatten(nested);
  });

  return pipe(yield* walk(bundleDir), A.sort(Order.String));
});

const validateLocalMirrorBundle = Effect.fn("AIMetrics.validateLocalMirrorBundle")(function* ({
  bundleDir,
  remoteRoot,
  target,
}: {
  readonly bundleDir: string;
  readonly remoteRoot: string;
  readonly target: AiMetricsDeployTarget;
}) {
  const path = yield* Path.Path;
  const files = yield* listMirrorBundleFiles(bundleDir);
  const disallowedFiles = A.filter(files, (file) => !isAllowedMirrorBundleFile(file));
  if (A.isReadonlyArrayNonEmpty(disallowedFiles)) {
    return yield* AiMetricsCommandError.make({
      cause: disallowedFiles,
      message: "AI metrics mirror bundle contains files outside the sanitized sync contract.",
    });
  }

  const manifest = yield* readMirrorManifest(path.join(bundleDir, "manifest.json"));
  yield* requireSafeMirrorManifest({
    manifest,
    remoteRoot,
    target,
  });
  const expectedParquetFiles = pipe(
    manifest.includedTables,
    A.map((table) => `parquet/${table}.parquet`)
  );
  const missingParquetFiles = pipe(
    expectedParquetFiles,
    A.filter((file) => !A.contains(files, file))
  );
  if (A.isReadonlyArrayNonEmpty(missingParquetFiles)) {
    return yield* AiMetricsCommandError.make({
      cause: missingParquetFiles,
      message: "AI metrics mirror bundle is missing expected sanitized Parquet exports.",
    });
  }
  const unexpectedParquetFiles = pipe(
    files,
    A.filter((file) => Str.startsWith("parquet/")(file) && !A.contains(expectedParquetFiles, file))
  );
  if (A.isReadonlyArrayNonEmpty(unexpectedParquetFiles)) {
    return yield* AiMetricsCommandError.make({
      cause: unexpectedParquetFiles,
      message: "AI metrics mirror bundle contains Parquet files not declared in the manifest.",
    });
  }

  return manifest;
});

const makeMirrorBuildProgram = Effect.fn("AIMetrics.makeMirrorBuildProgram")(function* ({
  dataRoot,
  json,
  remoteRoot,
  target,
}: {
  readonly dataRoot: O.Option<string>;
  readonly json: boolean;
  readonly remoteRoot: string;
  readonly target: AiMetricsDeployTarget;
}) {
  const result = yield* buildAiMetricsMirrorBundle(
    AiMetricsMirrorBundleInput.make({
      dataRoot: O.getOrElse(dataRoot, () => localCollectorDataRoot),
      remoteRoot,
      target,
    })
  );

  if (json) {
    yield* Console.log(yield* aiMetricsMirrorBundleToJson(result));
    return;
  }

  yield* Console.log(`ai-metrics mirror build: ${result.bundleId}`);
  yield* Console.log(`bundle: ${result.bundleDir}`);
  yield* Console.log(`manifest: ${result.manifestPath}`);
  yield* Console.log(`privacy proof: ${result.manifest.privacyProof.safe ? "passed" : "failed"}`);
  yield* Console.log(`tables: ${A.length(result.tables)}`);
});

const makeMirrorSyncProgram = Effect.fn("AIMetrics.makeMirrorSyncProgram")(function* ({
  bundle,
  confirm,
  dataRoot,
  host,
  json,
  remoteRoot,
  target,
}: {
  readonly bundle: string;
  readonly confirm: O.Option<string>;
  readonly dataRoot: O.Option<string>;
  readonly host: string;
  readonly json: boolean;
  readonly remoteRoot: string;
  readonly target: AiMetricsDeployTarget;
}) {
  const bundleDir = yield* resolveMirrorBundleDir({
    bundle,
    dataRoot,
  });
  yield* validateLocalMirrorBundle({
    bundleDir,
    remoteRoot,
    target,
  });
  const dryRun = O.isNone(confirm);
  if (O.isSome(confirm) && confirm.value !== p7MirrorConfirmToken) {
    return yield* AiMetricsCommandError.make({
      cause: confirm.value,
      message: `AI metrics mirror sync confirmation must be "${p7MirrorConfirmToken}".`,
    });
  }

  const mkdirArgs = [host, `mkdir -p ${shellQuote(remoteRoot)}`];
  const rsyncArgs = ["-az", "--delete", `${bundleDir}/`, `${host}:${remoteRoot}/`];
  const plannedCommands = [commandText("ssh", mkdirArgs), commandText("rsync", rsyncArgs)];

  if (dryRun) {
    const result = {
      bundleDir,
      confirmToken: p7MirrorConfirmToken,
      dryRun: true,
      plannedCommands,
      remoteRoot,
      status: "planned",
    };
    yield* Console.log(
      json
        ? yield* encodeCommandJson(result)
        : `ai-metrics mirror sync: dry-run; confirm with --confirm ${p7MirrorConfirmToken}`
    );
    if (!json) {
      for (const command of plannedCommands) yield* Console.log(command);
    }
    return;
  }

  const mkdir = yield* runCapturedCommand("ssh", mkdirArgs);
  const rsync = yield* runCapturedCommand("rsync", rsyncArgs);
  const result = {
    bundleDir,
    dryRun: false,
    remoteRoot,
    results: [mkdir, rsync],
    status: "synced",
  };

  if (json) {
    yield* Console.log(yield* encodeCommandJson(result));
    return;
  }

  yield* Console.log(`ai-metrics mirror sync: synced ${bundleDir} -> ${host}:${remoteRoot}`);
});

const makeMirrorStatusProgram = Effect.fn("AIMetrics.makeMirrorStatusProgram")(function* ({
  host,
  json,
  remoteRoot,
  target,
}: {
  readonly host: string;
  readonly json: boolean;
  readonly remoteRoot: string;
  readonly target: AiMetricsDeployTarget;
}) {
  const manifestPath = `${remoteRoot}/manifest.json`;
  const captured = yield* runCapturedCommand("ssh", [host, `cat ${shellQuote(manifestPath)}`]);
  const manifest = yield* decodeMirrorManifestJson(captured.stdout).pipe(
    AiMetricsCommandError.mapError("Failed to parse remote AI metrics mirror manifest JSON.")
  );
  yield* requireSafeMirrorManifest({
    manifest,
    remoteRoot,
    target,
  });
  const result = {
    host,
    manifest,
    manifestPath,
    remoteRoot,
    status: "available",
  };

  if (json) {
    yield* Console.log(yield* encodeCommandJson(result));
    return;
  }

  yield* Console.log(`ai-metrics mirror status: ${host}:${manifestPath}`);
  yield* Console.log("status: available");
});

const confirmRetentionMutation = Effect.fn("AIMetrics.confirmRetentionMutation")(function* ({
  confirm,
  selector,
}: {
  readonly confirm: O.Option<string>;
  readonly selector: AiMetricsRetentionSelector;
}) {
  if (O.isNone(confirm)) {
    return true;
  }

  if (confirm.value !== p7RetentionConfirmToken) {
    return yield* AiMetricsCommandError.make({
      cause: confirm.value,
      message: `AI metrics retention confirmation must be "${p7RetentionConfirmToken}".`,
    });
  }

  if (!hasBoundedRetentionMutationWindow(selector)) {
    return yield* AiMetricsCommandError.make({
      cause: selector,
      message: "AI metrics retention writes require --before or a bounded --since/--until window.",
    });
  }

  if (!hasOrderedRetentionMutationWindow(selector)) {
    return yield* AiMetricsCommandError.make({
      cause: selector,
      message: "AI metrics retention write window lower bound must be before its upper bound.",
    });
  }

  return false;
});

const makeRetentionListProgram = Effect.fn("AIMetrics.makeRetentionListProgram")(function* ({
  before,
  dataRoot,
  json,
  since,
  until,
}: {
  readonly before: O.Option<string>;
  readonly dataRoot: O.Option<string>;
  readonly json: boolean;
  readonly since: O.Option<string>;
  readonly until: O.Option<string>;
}) {
  const selector = yield* parseRetentionSelector({
    before,
    dataRoot,
    since,
    until,
  });
  const result = yield* listAiMetricsRetentionInventory(selector);

  if (json) {
    yield* Console.log(yield* aiMetricsRetentionInventoryToJson(result));
    return;
  }

  yield* Console.log("ai-metrics retention list");
  yield* Console.log(`raw archive objects: ${result.selectedRawArchiveObjectCount}`);
  yield* Console.log(`derived exports: ${result.selectedDerivedExportCount}`);
  yield* Console.log(`reports: ${result.selectedReportCount}`);
});

const makeRetentionMutationProgram = Effect.fn("AIMetrics.makeRetentionMutationProgram")(function* ({
  before,
  confirm,
  dataRoot,
  json,
  mode,
  since,
  until,
}: {
  readonly before: O.Option<string>;
  readonly confirm: O.Option<string>;
  readonly dataRoot: O.Option<string>;
  readonly json: boolean;
  readonly mode: "compact" | "delete";
  readonly since: O.Option<string>;
  readonly until: O.Option<string>;
}) {
  const selector = yield* parseRetentionSelector({
    before,
    dataRoot,
    since,
    until,
  });
  const dryRun = yield* confirmRetentionMutation({
    confirm,
    selector,
  });
  const result =
    mode === "delete"
      ? yield* runAiMetricsRetentionDelete(selector, dryRun)
      : yield* runAiMetricsRetentionCompact(selector, dryRun);

  if (json) {
    yield* Console.log(yield* aiMetricsRetentionMutationToJson(result));
    return;
  }

  yield* Console.log(`ai-metrics retention ${mode}: dry-run=${result.dryRun}`);
  yield* Console.log(`confirm token: ${p7RetentionConfirmToken}`);
  yield* Console.log(`raw archive objects: ${result.deletedRawArchiveObjectCount}`);
  yield* Console.log(`derived exports: ${result.deletedDerivedExportCount}`);
  yield* Console.log(`reports: ${result.deletedReportCount}`);
});

const makeRetentionEnforceProgram = Effect.fn("AIMetrics.makeRetentionEnforceProgram")(function* ({
  confirm,
  dataRoot,
  json,
  maxSnapshotExports,
}: {
  readonly confirm: O.Option<string>;
  readonly dataRoot: O.Option<string>;
  readonly json: boolean;
  readonly maxSnapshotExports: number;
}) {
  if (O.isSome(confirm) && confirm.value !== p7RetentionConfirmToken) {
    return yield* AiMetricsCommandError.make({
      cause: confirm.value,
      message: `AI metrics retention confirmation must be "${p7RetentionConfirmToken}".`,
    });
  }

  const result = yield* enforceAiMetricsRetentionPolicy(
    AiMetricsRetentionEnforcementPolicy.make({
      dataRoot: O.getOrElse(dataRoot, () => localCollectorDataRoot),
      dryRun: O.isNone(confirm),
      maxSnapshotExports,
    })
  );

  if (json) {
    yield* Console.log(yield* aiMetricsRetentionEnforcementToJson(result));
    return;
  }

  yield* Console.log(`ai-metrics retention enforce: dry-run=${result.dryRun}`);
  yield* Console.log(`confirm token: ${p7RetentionConfirmToken}`);
  yield* Console.log(`max snapshot exports: ${result.maxSnapshotExports}`);
  yield* Console.log(`deleted snapshot exports: ${result.deletedDerivedExportCount}`);
  yield* Console.log(`kept snapshot exports: ${result.keptDerivedExportCount}`);
});

const makeRetentionRestoreDrillProgram = Effect.fn("AIMetrics.makeRetentionRestoreDrillProgram")(function* ({
  before,
  dataRoot,
  hashSalt,
  json,
  maxObjects,
  restoreRoot,
  since,
  until,
}: {
  readonly before: O.Option<string>;
  readonly dataRoot: O.Option<string>;
  readonly hashSalt: O.Option<string>;
  readonly json: boolean;
  readonly maxObjects: number;
  readonly restoreRoot: string;
  readonly since: O.Option<string>;
  readonly until: O.Option<string>;
}) {
  const selector = yield* parseRetentionSelector({
    before,
    dataRoot,
    since,
    until,
  });
  if (!hasRetentionWindow(selector)) {
    return yield* AiMetricsCommandError.make({
      cause: selector,
      message: "AI metrics restore drills require --before or an explicit --since/--until window.",
    });
  }

  const result = yield* runAiMetricsRetentionRestoreDrill(
    AiMetricsRetentionRestoreDrillInput.make({
      ...(O.isSome(hashSalt) ? { hashSalt: hashSalt.value } : {}),
      maxObjects,
      rawArchiveKey: yield* resolveRawArchiveKey(),
      restoreRoot,
      selector,
    })
  );

  if (json) {
    yield* Console.log(yield* aiMetricsRetentionRestoreDrillToJson(result));
    return;
  }

  yield* Console.log(`ai-metrics retention restore-drill: replayed=${result.replayedObjectCount}`);
  yield* Console.log(`hash matches: ${result.hashMatches}`);
  yield* Console.log(`derived duckdb: ${result.derivedDuckDbPath}`);
});

const makeArchiveDrillProgram = Effect.fn("AIMetrics.makeArchiveDrillProgram")(function* ({
  dataRoot,
  hashSaltSecretRef,
  json,
  rawArchiveKeySecretRef,
  target,
}: {
  readonly dataRoot: O.Option<string>;
  readonly hashSaltSecretRef: O.Option<string>;
  readonly json: boolean;
  readonly rawArchiveKeySecretRef: O.Option<string>;
  readonly target: AiMetricsDeployTarget;
}) {
  const spec = yield* makeCommandInstallSpec({
    dataRoot: p6aCollectorDataRoot(dataRoot, target),
    hashSaltSecretRef,
    rawArchiveKeySecretRef,
    target,
  });
  const rawArchiveKey = yield* resolveRawArchiveKey();
  const result = yield* Effect.scoped(
    Layer.build(DuckDb.makeNodeLayer(DuckDbConnectionOptions.make({ databasePath: spec.storage.duckDbPath }))).pipe(
      Effect.flatMap((context) =>
        Effect.gen(function* () {
          const duckdb = yield* DuckDb;
          const rows = yield* duckdb
            .query(`SELECT archive_object_id      AS "archiveObjectId",
                           archive_path           AS "archivePath",
                           plaintext_content_hash AS "plaintextContentHash"
                    FROM ai_metrics_raw_archive_objects
                    ORDER BY encrypted_at_epoch_ms
                        DESC LIMIT 1`)
            .pipe(
              AiMetricsCommandError.mapError("Failed to select an AI metrics archive object for the decrypt drill.")
            );
          const decoded = yield* decodeArchiveDrillRows(rows).pipe(
            AiMetricsCommandError.mapError("Failed to decode AI metrics archive drill rows.")
          );
          const row = A.head(decoded);
          if (O.isNone(row)) {
            return yield* AiMetricsCommandError.make({
              cause: "ai_metrics_raw_archive_objects",
              message: "No AI metrics raw archive object is available for a decrypt drill.",
            });
          }

          const envelope = yield* readEncryptedRawArchiveEnvelope(row.value.archivePath);
          const plaintext = yield* decryptEncryptedRawArchiveEnvelope({
            envelope,
            rawArchiveKey,
          });
          const plaintextHash = yield* hashPublicTextSha256(plaintext);
          const plaintextHashMatches = plaintextHash === row.value.plaintextContentHash;
          if (!plaintextHashMatches) {
            return yield* AiMetricsCommandError.make({
              cause: row.value.archiveObjectId,
              message: "AI metrics archive decrypt drill failed plaintext hash verification.",
            });
          }

          return {
            archiveObjectId: row.value.archiveObjectId,
            decryptedByteCount: new TextEncoder().encode(plaintext).byteLength,
            plaintextHashMatches,
            target,
          };
        }).pipe(Effect.provide(context))
      )
    )
  );

  if (json) {
    yield* Console.log(yield* encodeCommandJson(result));
    return;
  }

  yield* Console.log(`ai-metrics archive drill: target=${target}`);
  yield* Console.log(`archive object: ${result.archiveObjectId}`);
  yield* Console.log(`decrypted bytes: ${result.decryptedByteCount}`);
  yield* Console.log(`plaintext hash matches: ${result.plaintextHashMatches}`);
});

const installPreviewCommand = Command.make(
  "preview",
  {
    hashSaltSecretRef: hashSaltSecretRefFlag,
    json: jsonFlag,
    rawArchiveKeySecretRef: rawArchiveKeySecretRefFlag,
    target: targetFlag,
    tool: toolFlag,
  },
  ({ hashSaltSecretRef, json, rawArchiveKeySecretRef, target, tool }) =>
    runAiMetricsProgram(
      makeInstallPreviewProgram({
        hashSaltSecretRef,
        json,
        rawArchiveKeySecretRef,
        target,
        tool,
      })
    )
).pipe(Command.withDescription("Preview the target-agnostic AI metrics install spec"));

const installPlanCommand = Command.make(
  "plan",
  {
    dataRoot: dataRootFlag,
    hashSaltSecretRef: hashSaltSecretRefFlag,
    json: jsonFlag,
    rawArchiveKeySecretRef: rawArchiveKeySecretRefFlag,
    target: targetFlag,
  },
  ({ dataRoot, hashSaltSecretRef, json, rawArchiveKeySecretRef, target }) =>
    runAiMetricsProgram(
      makeInstallPlanProgram({
        dataRoot,
        hashSaltSecretRef,
        json,
        rawArchiveKeySecretRef,
        target,
      })
    )
).pipe(Command.withDescription("Render the typed P5a AI metrics install plan"));

const installDoctorCommand = Command.make(
  "doctor",
  {
    all: allFlag,
    dataRoot: dataRootFlag,
    hashSalt: hashSaltFlag,
    hashSaltSecretRef: hashSaltSecretRefFlag,
    homeDir: homeDirFlag,
    json: jsonFlag,
    maxFileBytes: maxFileBytesFlag,
    maxFiles: maxFilesFlag,
    openClawUnit: openClawUnitFlag,
    rawArchiveKeySecretRef: rawArchiveKeySecretRefFlag,
    repoRoot: repoRootFlag,
    since: sinceFlag,
    target: targetFlag,
  },
  ({
    all,
    dataRoot,
    hashSalt,
    hashSaltSecretRef,
    homeDir,
    json,
    maxFileBytes,
    maxFiles,
    openClawUnit,
    rawArchiveKeySecretRef,
    repoRoot,
    since,
    target,
  }) =>
    runAiMetricsProgram(
      makeInstallDoctorProgram({
        all,
        dataRoot,
        hashSalt,
        hashSaltSecretRef,
        homeDir,
        json,
        maxFileBytes,
        maxFiles,
        openClawUnit,
        rawArchiveKeySecretRef,
        repoRoot,
        since,
        target,
      })
    )
).pipe(Command.withDescription("Validate the P5a AI metrics install contract without resolving secrets or SSH"));

const installApplyCommand = Command.make(
  "apply",
  {
    dataRoot: dataRootFlag,
    dryRun: dryRunFlag,
    hashSaltSecretRef: hashSaltSecretRefFlag,
    json: jsonFlag,
    rawArchiveKeySecretRef: rawArchiveKeySecretRefFlag,
    target: targetFlag,
  },
  ({ dataRoot, dryRun, hashSaltSecretRef, json, rawArchiveKeySecretRef, target }) =>
    runAiMetricsProgram(
      makeInstallApplyProgram({
        dataRoot,
        dryRun,
        hashSaltSecretRef,
        json,
        rawArchiveKeySecretRef,
        target,
      })
    )
).pipe(Command.withDescription("Dry-run the P5a AI metrics install apply workflow"));

const installComposeCommand = Command.make(
  "compose",
  {
    json: jsonFlag,
    target: targetFlag,
    tool: toolFlag,
  },
  ({ json, target, tool }) =>
    runAiMetricsProgram(
      makeInstallComposeProgram({
        json,
        target,
        tool,
      })
    )
).pipe(Command.withDescription("Render the dedicated local Phoenix compose smoke target"));

const ingestCommand = Command.make(
  "ingest",
  {
    hashSalt: hashSaltFlag,
    input: inputFlag,
    json: jsonFlag,
    source: sourceFlag,
    target: targetFlag,
  },
  ({ hashSalt, input, json, source, target }) =>
    runAiMetricsProgram(
      makeIngestProgram({
        hashSalt,
        input,
        json,
        source,
        target,
      })
    )
).pipe(Command.withDescription("Summarize a Codex, Claude, or OpenClaw JSONL transcript"));

const sourcesDiscoverCommand = Command.make(
  "discover",
  {
    all: allFlag,
    hashSalt: hashSaltFlag,
    homeDir: homeDirFlag,
    json: jsonFlag,
    maxFileBytes: maxFileBytesFlag,
    maxFiles: maxFilesFlag,
    openClawUnit: openClawUnitFlag,
    repoRoot: repoRootFlag,
    since: sinceFlag,
    target: targetFlag,
  },
  ({ all, hashSalt, homeDir, json, maxFileBytes, maxFiles, openClawUnit, repoRoot, since, target }) =>
    runAiMetricsProgram(
      makeSourcesDiscoverProgram({
        all,
        hashSalt,
        homeDir,
        json,
        maxFileBytes,
        maxFiles,
        openClawUnit,
        repoRoot,
        since,
        target,
      })
    )
).pipe(Command.withDescription("Discover Codex, Claude, and OpenClaw local metrics sources"));

const sourcesCommand = Command.make("sources", {}, () =>
  printLines(["AI metrics source commands:", "- bun run beep ai-metrics sources discover --target local"])
).pipe(
  Command.withDescription("AI metrics source discovery workflow"),
  Command.withSubcommands([sourcesDiscoverCommand])
);

const configSnapshotCommand = Command.make(
  "snapshot",
  {
    json: jsonFlag,
    repoRoot: repoRootFlag,
  },
  ({ json, repoRoot }) =>
    runAiMetricsProgram(
      makeConfigSnapshotProgram({
        json,
        repoRoot,
      })
    )
).pipe(Command.withDescription("Hash the repo-local agent-facing configuration snapshot"));

const configCommand = Command.make("config", {}, () =>
  printLines(["AI metrics config commands:", "- bun run beep ai-metrics config snapshot"])
).pipe(
  Command.withDescription("AI metrics configuration attribution workflow"),
  Command.withSubcommands([configSnapshotCommand])
);

const privacyCheckCommand = Command.make(
  "check",
  {
    hashSalt: hashSaltFlag,
    input: inputFlag,
    json: jsonFlag,
    source: sourceFlag,
  },
  ({ hashSalt, input, json, source }) =>
    runAiMetricsProgram(
      makePrivacyCheckProgram({
        hashSalt,
        input,
        json,
        source,
      })
    )
).pipe(Command.withDescription("Prove a transcript projection does not expose raw prompt or output text"));

const privacyCommand = Command.make("privacy", {}, () =>
  printLines([
    "AI metrics privacy commands:",
    "- bun run beep ai-metrics privacy check --source codex --input <file-or-dir>",
  ])
).pipe(Command.withDescription("AI metrics privacy proof workflow"), Command.withSubcommands([privacyCheckCommand]));

const installCommand = Command.make("install", {}, () =>
  printLines([
    "AI metrics install commands:",
    "- bun run beep ai-metrics install preview --target local",
    "- bun run beep ai-metrics install plan --target local",
    "- bun run beep ai-metrics install doctor --target local",
    "- bun run beep ai-metrics install apply --target local --dry-run",
    "- bun run beep ai-metrics install compose --target local",
    "- bun run beep ai-metrics install preview --target dankserver",
  ])
).pipe(
  Command.withDescription("AI metrics install workflow"),
  Command.withSubcommands([
    installPreviewCommand,
    installPlanCommand,
    installDoctorCommand,
    installApplyCommand,
    installComposeCommand,
  ])
);

const forwarderRunCommand = Command.make(
  "run",
  {
    all: allFlag,
    dataRoot: dataRootFlag,
    hashSalt: hashSaltFlag,
    hashSaltSecretRef: hashSaltSecretRefFlag,
    homeDir: homeDirFlag,
    json: jsonFlag,
    maxFileBytes: maxFileBytesFlag,
    maxFiles: maxFilesFlag,
    openClawUnit: openClawUnitFlag,
    otlp: otlpFlag,
    otlpBaseUrl: otlpBaseUrlFlag,
    parquetExportMode: parquetExportModeFlag,
    rawArchiveKeySecretRef: rawArchiveKeySecretRefFlag,
    repoRoot: repoRootFlag,
    // Inert backward-compat flag: parsed and ignored (run always enforces retention).
    retentionEnforce: forwarderRunRetentionEnforceCompatFlag,
    retentionMaxSnapshotExports: forwarderRunMaxSnapshotExportsFlag,
    since: sinceFlag,
    target: targetFlag,
  },
  ({
    all,
    dataRoot,
    hashSalt,
    hashSaltSecretRef,
    homeDir,
    json,
    maxFileBytes,
    maxFiles,
    openClawUnit,
    otlp,
    otlpBaseUrl,
    parquetExportMode,
    rawArchiveKeySecretRef,
    repoRoot,
    retentionMaxSnapshotExports,
    since,
    target,
  }) =>
    runAiMetricsProgram(
      makeForwarderRunProgram({
        all,
        dataRoot,
        hashSalt,
        hashSaltSecretRef,
        homeDir,
        json,
        maxFileBytes,
        maxFiles,
        openClawUnit,
        otlp,
        otlpBaseUrl,
        parquetExportMode,
        rawArchiveKeySecretRef,
        repoRoot,
        // Local forwarder runs always self-prune the per-run Parquet snapshots so the
        // `.beep/ai-metrics/derived/parquet` directory cannot grow unbounded; keep-N is tunable via
        // --max-snapshot-exports. Snapshot retention history is opt-in on the `timer` command instead.
        retentionEnforce: true,
        retentionMaxSnapshotExports,
        since,
        target,
      })
    )
).pipe(
  Command.withDescription("Run durable local transcript ingest into encrypted raw archive and derived DuckDB storage")
);

const forwarderTimerCommand = Command.make(
  "timer",
  {
    dataRoot: dataRootFlag,
    hashSaltSecretRef: hashSaltSecretRefFlag,
    intervalMinutes: intervalMinutesFlag,
    json: jsonFlag,
    maxFileBytes: timerMaxFileBytesFlag,
    maxFiles: timerMaxFilesFlag,
    otlpBaseUrl: otlpBaseUrlFlag,
    parquetExportMode: timerParquetExportModeFlag,
    rawArchiveKeySecretRef: rawArchiveKeySecretRefFlag,
    repoRoot: repoRootFlag,
    retentionEnforce: retentionEnforceFlag,
    retentionMaxSnapshotExports: maxSnapshotExportsFlag,
    target: targetFlag,
  },
  ({
    dataRoot,
    hashSaltSecretRef,
    intervalMinutes,
    json,
    maxFileBytes,
    maxFiles,
    otlpBaseUrl,
    parquetExportMode,
    rawArchiveKeySecretRef,
    repoRoot,
    retentionEnforce,
    retentionMaxSnapshotExports,
    target,
  }) =>
    runAiMetricsProgram(
      makeForwarderTimerProgram({
        dataRoot,
        hashSaltSecretRef,
        intervalMinutes,
        json,
        maxFileBytes,
        maxFiles,
        otlpBaseUrl,
        parquetExportMode,
        rawArchiveKeySecretRef,
        repoRoot,
        retentionEnforce,
        retentionMaxSnapshotExports,
        target,
      })
    )
).pipe(Command.withDescription("Render a workstation systemd user timer for live AI metrics collection"));

const forwarderCommand = Command.make("forwarder", {}, () =>
  printLines([
    "AI metrics forwarder commands:",
    "- bun run beep ai-metrics forwarder run --target local",
    "  (snapshot mode self-prunes to the newest 5 Parquet exports; override with --max-snapshot-exports N)",
    "- bun run beep ai-metrics forwarder timer --target dankserver" +
      " --hash-salt-secret-ref op://TBK/ai-metrics/hash-salt --raw-archive-key-secret-ref op://TBK/ai-metrics/raw-archive-key",
    "- reclaim old snapshots manually: bun run beep ai-metrics retention enforce --max-snapshot-exports 1 --confirm p7-retention-window",
  ])
).pipe(
  Command.withDescription("AI metrics local forwarder workflow"),
  Command.withSubcommands([forwarderRunCommand, forwarderTimerCommand])
);

const otlpExportCommand = Command.make(
  "export",
  {
    dataRoot: dataRootFlag,
    hashSaltSecretRef: hashSaltSecretRefFlag,
    ingestRunId: ingestRunFlag,
    json: jsonFlag,
    otlpBaseUrl: otlpBaseUrlFlag,
    rawArchiveKeySecretRef: rawArchiveKeySecretRefFlag,
    target: targetFlag,
  },
  ({ dataRoot, hashSaltSecretRef, ingestRunId, json, otlpBaseUrl, rawArchiveKeySecretRef, target }) =>
    runAiMetricsProgram(
      makeOtlpExportProgram({
        dataRoot,
        hashSaltSecretRef,
        ingestRunId,
        json,
        otlpBaseUrl,
        rawArchiveKeySecretRef,
        target,
      })
    )
).pipe(Command.withDescription("Export redacted derived AI metrics spans through OTLP"));

const otlpCommand = Command.make("otlp", {}, () =>
  printLines(["AI metrics OTLP commands:", "- bun run beep ai-metrics otlp export --target local --ingest-run latest"])
).pipe(Command.withDescription("AI metrics OTLP export workflow"), Command.withSubcommands([otlpExportCommand]));

const benchmarkRunCommand = Command.make(
  "run",
  {
    caseId: caseFlag,
    configSnapshotId: configFlag,
    dataRoot: dataRootFlag,
    elapsedMs: elapsedMsFlag,
    hashSaltSecretRef: hashSaltSecretRefFlag,
    json: jsonFlag,
    note: noteFlag,
    passed: passedValueFlag,
    qualityGate: qualityGateFlag,
    rawArchiveKeySecretRef: rawArchiveKeySecretRefFlag,
    target: targetFlag,
  },
  ({
    caseId,
    configSnapshotId,
    dataRoot,
    elapsedMs,
    hashSaltSecretRef,
    json,
    note,
    passed,
    qualityGate,
    rawArchiveKeySecretRef,
    target,
  }) =>
    runAiMetricsProgram(
      makeBenchmarkRunProgram({
        caseId,
        configSnapshotId,
        dataRoot,
        elapsedMs,
        hashSaltSecretRef,
        json,
        note,
        passed,
        qualityGate,
        rawArchiveKeySecretRef,
        target,
      })
    )
).pipe(Command.withDescription("Record a benchmark run result for a config snapshot"));

const benchmarkCaseAddCommand = Command.make(
  "add",
  {
    caseId: caseFlag,
    checks: checksFlag,
    dataRoot: dataRootFlag,
    hashSaltSecretRef: hashSaltSecretRefFlag,
    json: jsonFlag,
    promptHash: promptHashFlag,
    promptRef: promptRefFlag,
    rawArchiveKeySecretRef: rawArchiveKeySecretRefFlag,
    target: targetFlag,
    title: titleFlag,
  },
  ({
    caseId,
    checks,
    dataRoot,
    hashSaltSecretRef,
    json,
    promptHash,
    promptRef,
    rawArchiveKeySecretRef,
    target,
    title,
  }) =>
    runAiMetricsProgram(
      makeBenchmarkCaseAddProgram({
        caseId,
        checks,
        dataRoot,
        hashSaltSecretRef,
        json,
        promptHash,
        promptRef,
        rawArchiveKeySecretRef,
        target,
        title,
      })
    )
).pipe(Command.withDescription("Add or replace a deploy-safe benchmark case"));

const benchmarkCaseListCommand = Command.make(
  "list",
  {
    dataRoot: dataRootFlag,
    hashSaltSecretRef: hashSaltSecretRefFlag,
    json: jsonFlag,
    rawArchiveKeySecretRef: rawArchiveKeySecretRefFlag,
    target: targetFlag,
  },
  ({ dataRoot, hashSaltSecretRef, json, rawArchiveKeySecretRef, target }) =>
    runAiMetricsProgram(
      makeBenchmarkCaseListProgram({
        dataRoot,
        hashSaltSecretRef,
        json,
        rawArchiveKeySecretRef,
        target,
      })
    )
).pipe(Command.withDescription("List deploy-safe benchmark cases"));

const benchmarkCaseCommand = Command.make("case", {}, () =>
  printLines([
    "AI metrics benchmark case commands:",
    "- bun run beep ai-metrics benchmark case add --case <id> --title <title> --prompt-hash <hash>",
    "- bun run beep ai-metrics benchmark case list",
  ])
).pipe(
  Command.withDescription("AI metrics benchmark case workflow"),
  Command.withSubcommands([benchmarkCaseAddCommand, benchmarkCaseListCommand])
);

const benchmarkCompareCommand = Command.make(
  "compare",
  {
    json: jsonFlag,
  },
  ({ json }) => runAiMetricsProgram(makeBenchmarkCompareProgram({ json }))
).pipe(Command.withDescription("Compare benchmark runs using the outcome-heavy scorecard model"));

const benchmarkCommand = Command.make("benchmark", {}, () =>
  printLines([
    "AI metrics benchmark commands:",
    "- bun run beep ai-metrics benchmark case add --case <id> --title <title> --prompt-hash <hash>",
    "- bun run beep ai-metrics benchmark run --case <id> --config <snapshot> --passed true",
    "- bun run beep ai-metrics benchmark compare",
  ])
).pipe(
  Command.withDescription("AI metrics benchmark workflow"),
  Command.withSubcommands([benchmarkCaseCommand, benchmarkRunCommand, benchmarkCompareCommand])
);

const labelQueueCommand = Command.make(
  "queue",
  {
    dataRoot: dataRootFlag,
    hashSaltSecretRef: hashSaltSecretRefFlag,
    json: jsonFlag,
    limit: limitFlag,
    rawArchiveKeySecretRef: rawArchiveKeySecretRefFlag,
    since: sinceFlag,
    target: targetFlag,
    until: untilFlag,
  },
  ({ dataRoot, hashSaltSecretRef, json, limit, rawArchiveKeySecretRef, since, target, until }) =>
    runAiMetricsProgram(
      makeLabelQueueProgram({
        dataRoot,
        hashSaltSecretRef,
        json,
        limit,
        rawArchiveKeySecretRef,
        since,
        target,
        until,
      })
    )
).pipe(Command.withDescription("List unlabeled AI metrics tasks"));

const labelAddCommand = Command.make(
  "add",
  {
    dataRoot: dataRootFlag,
    followUpFix: followUpFixValueFlag,
    hashSaltSecretRef: hashSaltSecretRefFlag,
    interventions: interventionsFlag,
    json: jsonFlag,
    note: noteFlag,
    passed: passedValueFlag,
    qualityGate: qualityGateFlag,
    rating: ratingFlag,
    rawArchiveKeySecretRef: rawArchiveKeySecretRefFlag,
    target: targetFlag,
    taskId: taskFlag,
  },
  ({
    dataRoot,
    followUpFix,
    hashSaltSecretRef,
    interventions,
    json,
    note,
    passed,
    qualityGate,
    rating,
    rawArchiveKeySecretRef,
    target,
    taskId,
  }) =>
    runAiMetricsProgram(
      makeLabelAddProgram({
        dataRoot,
        followUpFix,
        hashSaltSecretRef,
        interventions,
        json,
        note,
        passed,
        qualityGate,
        rating,
        rawArchiveKeySecretRef,
        target,
        taskId,
      })
    )
).pipe(Command.withDescription("Add or replace a structured human outcome label"));

const labelCommand = Command.make("label", {}, () =>
  printLines([
    "AI metrics label commands:",
    "- bun run beep ai-metrics label queue",
    "- bun run beep ai-metrics label queue --target dankserver --data-root .beep/ai-metrics --hash-salt-secret-ref op://TBK/ai-metrics/hash-salt --raw-archive-key-secret-ref op://TBK/ai-metrics/raw-archive-key",
    "- bun run beep ai-metrics label add --task <id> --passed true --rating 5",
  ])
).pipe(
  Command.withDescription("AI metrics human label workflow"),
  Command.withSubcommands([labelQueueCommand, labelAddCommand])
);

const reportWeeklyCommand = Command.make(
  "weekly",
  {
    dataRoot: dataRootFlag,
    hashSaltSecretRef: hashSaltSecretRefFlag,
    json: jsonFlag,
    rawArchiveKeySecretRef: rawArchiveKeySecretRefFlag,
    since: sinceFlag,
    target: targetFlag,
    until: untilFlag,
  },
  ({ dataRoot, hashSaltSecretRef, json, rawArchiveKeySecretRef, since, target, until }) =>
    runAiMetricsProgram(
      makeWeeklyReportProgram({
        dataRoot,
        hashSaltSecretRef,
        json,
        rawArchiveKeySecretRef,
        since,
        target,
        until,
      })
    )
).pipe(Command.withDescription("Generate a weekly config-impact scorecard report"));

const reportCommand = Command.make("report", {}, () =>
  printLines([
    "AI metrics report commands:",
    "- bun run beep ai-metrics report weekly",
    "- bun run beep ai-metrics report weekly --target dankserver --data-root .beep/ai-metrics --hash-salt-secret-ref op://TBK/ai-metrics/hash-salt --raw-archive-key-secret-ref op://TBK/ai-metrics/raw-archive-key",
  ])
).pipe(Command.withDescription("AI metrics report workflow"), Command.withSubcommands([reportWeeklyCommand]));

const mirrorBuildCommand = Command.make(
  "build",
  {
    dataRoot: dataRootFlag,
    json: jsonFlag,
    remoteRoot: remoteRootFlag,
    target: mirrorTargetFlag,
  },
  ({ dataRoot, json, remoteRoot, target }) =>
    runAiMetricsProgram(
      makeMirrorBuildProgram({
        dataRoot,
        json,
        remoteRoot,
        target,
      })
    )
).pipe(Command.withDescription("Build a sanitized P7 derived mirror bundle"));

const mirrorSyncCommand = Command.make(
  "sync",
  {
    bundle: bundleFlag,
    confirm: confirmFlag,
    dataRoot: dataRootFlag,
    host: hostFlag,
    json: jsonFlag,
    remoteRoot: remoteRootFlag,
    target: mirrorTargetFlag,
  },
  ({ bundle, confirm, dataRoot, host, json, remoteRoot, target }) =>
    runAiMetricsProgram(
      makeMirrorSyncProgram({
        bundle,
        confirm,
        dataRoot,
        host,
        json,
        remoteRoot,
        target,
      })
    )
).pipe(Command.withDescription("Preview or rsync a sanitized P7 mirror bundle to the remote mirror root"));

const mirrorStatusCommand = Command.make(
  "status",
  {
    host: hostFlag,
    json: jsonFlag,
    remoteRoot: remoteRootFlag,
    target: mirrorTargetFlag,
  },
  ({ host, json, remoteRoot, target }) =>
    runAiMetricsProgram(
      makeMirrorStatusProgram({
        host,
        json,
        remoteRoot,
        target,
      })
    )
).pipe(Command.withDescription("Read the remote sanitized P7 mirror manifest"));

const mirrorCommand = Command.make("mirror", {}, () =>
  printLines([
    "AI metrics mirror commands:",
    "- bun run beep ai-metrics mirror build --target dankserver --data-root .beep/ai-metrics",
    "- bun run beep ai-metrics mirror sync --bundle latest",
    "- bun run beep ai-metrics mirror status",
  ])
).pipe(
  Command.withDescription("AI metrics P7 sanitized derived mirror workflow"),
  Command.withSubcommands([mirrorBuildCommand, mirrorSyncCommand, mirrorStatusCommand])
);

const retentionListCommand = Command.make(
  "list",
  {
    before: beforeFlag,
    dataRoot: dataRootFlag,
    json: jsonFlag,
    since: sinceFlag,
    until: untilFlag,
  },
  ({ before, dataRoot, json, since, until }) =>
    runAiMetricsProgram(
      makeRetentionListProgram({
        before,
        dataRoot,
        json,
        since,
        until,
      })
    )
).pipe(Command.withDescription("List retained AI metrics raw archive, derived, and report artifacts"));

const retentionDeleteCommand = Command.make(
  "delete",
  {
    before: beforeFlag,
    confirm: confirmFlag,
    dataRoot: dataRootFlag,
    json: jsonFlag,
    since: sinceFlag,
    until: untilFlag,
  },
  ({ before, confirm, dataRoot, json, since, until }) =>
    runAiMetricsProgram(
      makeRetentionMutationProgram({
        before,
        confirm,
        dataRoot,
        json,
        mode: "delete",
        since,
        until,
      })
    )
).pipe(Command.withDescription("Dry-run or apply an explicit-window AI metrics retention delete"));

const retentionCompactCommand = Command.make(
  "compact",
  {
    before: beforeFlag,
    confirm: confirmFlag,
    dataRoot: dataRootFlag,
    json: jsonFlag,
    since: sinceFlag,
    until: untilFlag,
  },
  ({ before, confirm, dataRoot, json, since, until }) =>
    runAiMetricsProgram(
      makeRetentionMutationProgram({
        before,
        confirm,
        dataRoot,
        json,
        mode: "compact",
        since,
        until,
      })
    )
).pipe(Command.withDescription("Dry-run or apply an explicit-window AI metrics derived/report compaction"));

const retentionEnforceCommand = Command.make(
  "enforce",
  {
    confirm: confirmFlag,
    dataRoot: dataRootFlag,
    json: jsonFlag,
    maxSnapshotExports: maxSnapshotExportsFlag,
  },
  ({ confirm, dataRoot, json, maxSnapshotExports }) =>
    runAiMetricsProgram(
      makeRetentionEnforceProgram({
        confirm,
        dataRoot,
        json,
        maxSnapshotExports,
      })
    )
).pipe(Command.withDescription("Dry-run or apply preventive AI metrics Parquet snapshot retention"));

const retentionRestoreDrillCommand = Command.make(
  "restore-drill",
  {
    before: beforeFlag,
    dataRoot: dataRootFlag,
    hashSalt: hashSaltFlag,
    json: jsonFlag,
    maxObjects: maxObjectsFlag,
    restoreRoot: restoreRootFlag,
    since: sinceFlag,
    until: untilFlag,
  },
  ({ before, dataRoot, hashSalt, json, maxObjects, restoreRoot, since, until }) =>
    runAiMetricsProgram(
      makeRetentionRestoreDrillProgram({
        before,
        dataRoot,
        hashSalt,
        json,
        maxObjects,
        restoreRoot,
        since,
        until,
      })
    )
).pipe(Command.withDescription("Decrypt and replay retained raw archive objects into disposable derived storage"));

const retentionCommand = Command.make("retention", {}, () =>
  printLines([
    "AI metrics retention commands:",
    "- bun run beep ai-metrics retention list --data-root .beep/ai-metrics",
    "- bun run beep ai-metrics retention restore-drill --restore-root /tmp/ai-metrics-restore --before <iso>",
    "- bun run beep ai-metrics retention enforce --data-root .beep/ai-metrics",
    "- bun run beep ai-metrics retention delete --before <iso>",
    "- bun run beep ai-metrics retention compact --before <iso>",
  ])
).pipe(
  Command.withDescription("AI metrics P7 retention, restore, delete, and compaction workflow"),
  Command.withSubcommands([
    retentionListCommand,
    retentionRestoreDrillCommand,
    retentionEnforceCommand,
    retentionDeleteCommand,
    retentionCompactCommand,
  ])
);

const archiveDrillCommand = Command.make(
  "drill",
  {
    dataRoot: dataRootFlag,
    hashSaltSecretRef: hashSaltSecretRefFlag,
    json: jsonFlag,
    rawArchiveKeySecretRef: rawArchiveKeySecretRefFlag,
    target: targetFlag,
  },
  ({ dataRoot, hashSaltSecretRef, json, rawArchiveKeySecretRef, target }) =>
    runAiMetricsProgram(
      makeArchiveDrillProgram({
        dataRoot,
        hashSaltSecretRef,
        json,
        rawArchiveKeySecretRef,
        target,
      })
    )
).pipe(Command.withDescription("Decrypt one encrypted raw archive object without printing transcript text"));

const archiveCommand = Command.make("archive", {}, () =>
  printLines([
    "AI metrics archive commands:",
    "- bun run beep ai-metrics archive drill",
    `- BEEP_AI_METRICS_RAW_ARCHIVE_KEY="$(op read 'op://TBK/ai-metrics/raw-archive-key')" bun run beep ai-metrics archive drill --target dankserver --data-root .beep/ai-metrics --hash-salt-secret-ref op://TBK/ai-metrics/hash-salt --raw-archive-key-secret-ref op://TBK/ai-metrics/raw-archive-key`,
  ])
).pipe(
  Command.withDescription("AI metrics archive verification workflow"),
  Command.withSubcommands([archiveDrillCommand])
);

/**
 * AI metrics root command.
 *
 * @example
 * ```ts
 * import { aiMetricsCommand } from "@beep/repo-cli/commands/AIMetrics/index"
 * console.log(aiMetricsCommand)
 * ```
 * @category commands
 * @since 0.0.0
 */
export const aiMetricsCommand = Command.make("ai-metrics", {}, () =>
  printLines([
    "AI metrics commands:",
    "- ingest",
    "- sources discover",
    "- config snapshot",
    "- privacy check",
    "- install preview",
    "- forwarder run",
    "- otlp export",
    "- label queue",
    "- label add",
    "- benchmark run",
    "- benchmark compare",
    "- report weekly",
    "- mirror build",
    "- retention list",
    "- archive drill",
  ])
).pipe(
  Command.withDescription("Collect, normalize, and plan deployment for AI-agent metrics"),
  Command.withSubcommands([
    ingestCommand,
    sourcesCommand,
    configCommand,
    privacyCommand,
    installCommand,
    forwarderCommand,
    otlpCommand,
    labelCommand,
    benchmarkCommand,
    reportCommand,
    mirrorCommand,
    retentionCommand,
    archiveCommand,
  ])
);
