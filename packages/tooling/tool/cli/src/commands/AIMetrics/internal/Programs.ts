/**
 * AI metrics command suite.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { DuckDb, DuckDbConnectionOptions } from "@beep/duckdb";
import { $RepoCliId } from "@beep/identity/packages";
import {
  AiMetricsBenchmarkCaseInput,
  AiMetricsBenchmarkRunInput,
  AiMetricsConfigSnapshotInput,
  AiMetricsDataRootInput,
  AiMetricsDeployTarget,
  AiMetricsForwarderInput,
  AiMetricsForwarderOtlpExported,
  AiMetricsForwarderOtlpExportFailed,
  AiMetricsForwarderRunResult,
  AiMetricsForwarderTimerInput,
  AiMetricsInstallDoctorInput,
  AiMetricsInstallDoctorStatus,
  AiMetricsInstallInput,
  AiMetricsInstallSpec,
  AiMetricsLabelQueueInput,
  AiMetricsMirrorBundleInput,
  AiMetricsMirrorBundleManifest,
  AiMetricsNonNegativeInteger,
  AiMetricsOtlpEndpointSpec,
  AiMetricsOtlpExportInput,
  AiMetricsOtlpSpanSender,
  AiMetricsOutcomeLabelInput,
  AiMetricsParquetExportMode,
  AiMetricsPrivacyMode,
  AiMetricsQualityGateStatus,
  AiMetricsRating,
  AiMetricsRetentionEnforcementPolicy,
  AiMetricsRetentionMutationMode,
  AiMetricsRetentionRestoreDrillInput,
  AiMetricsRetentionSelector,
  AiMetricsSourceDiscoveryInput,
  AiMetricsTool,
  AiMetricsTranscriptSource,
  AiMetricsWeeklyReportInput,
  addAiMetricsOutcomeLabel,
  agentEvidenceRoot,
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
  listAiMetricsDirectoryFileInfo,
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
  readEncryptedRawArchiveEnvelope,
  recordAiMetricsBenchmarkRun,
  renderAiMetricsForwarderTimerPlan,
  renderAiMetricsLocalPhoenixCompose,
  requireAbsoluteAiMetricsDataRoot,
  resolveAiMetricsDataRoot,
  runAiMetricsForwarder,
  runAiMetricsOtlpExport,
  runAiMetricsRetentionCompact,
  runAiMetricsRetentionDelete,
  runAiMetricsRetentionRestoreDrill,
  shellQuote,
  sourceDiscoveryToJson,
  summarizeTranscriptText,
  summaryToJson,
  upsertAiMetricsBenchmarkCase,
  withAiMetricsDuckDb,
} from "@beep/repo-ai-metrics";
import { UnknownFromJsonString } from "@beep/schema/Unknown";
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
  Match,
  Order,
  Path,
  pipe,
  Redacted,
} from "effect";
import * as S from "effect/Schema";
import { aiMetricsDataRootEnvVar } from "../../../internal/cli/Flags.ts";
import { printLines } from "../../../internal/cli/Printer.ts";
import { AiMetricsCommandError, AiMetricsStatusExit } from "../AIMetrics.errors.ts";
import type {
  AiMetricsForwarderOtlpExport,
  AiMetricsInstallDoctorResult,
  AiMetricsInstallPlan,
  AiMetricsOtlpExportResult,
  AiMetricsRetentionEnforcementResult,
} from "@beep/repo-ai-metrics";

const $I = $RepoCliId.create("commands/AIMetrics/internal/Programs");
const decodeNonNegativeInteger = S.decodeUnknownEffect(AiMetricsNonNegativeInteger);
const decodeRating = S.decodeUnknownEffect(AiMetricsRating);

const encodeJson = UnknownFromJsonString.encodeUnknownEffect;
const encodeInstallSpecJson = S.encodeUnknownEffect(S.fromJsonString(AiMetricsInstallSpec));
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

const readInputFile = Effect.fn("AIMetrics.readInputFile")(function* (input: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const absolutePath = path.resolve(input);
  const content = yield* fs
    .readFileString(absolutePath)
    .pipe(
      Effect.mapError((cause) => AiMetricsCommandError.make({ cause, message: "Failed to read transcript input." }))
    );

  return {
    absolutePath,
    content,
  };
});

const encodeCommandJson = flow(
  encodeJson,
  Effect.mapError((cause) =>
    AiMetricsCommandError.make({ cause, message: "Failed to encode AI metrics command output as JSON." })
  )
);

const encodeInstallSpecCommandJson = flow(
  encodeInstallSpecJson,
  Effect.mapError((cause) =>
    AiMetricsCommandError.make({ cause, message: "Failed to encode AI metrics install spec as JSON." })
  )
);

const readOptionalConfigString: (key: string) => Effect.Effect<O.Option<string>, AiMetricsCommandError> = Effect.fn(
  "AIMetrics.readOptionalConfigString"
)((key) =>
  ConfigProvider.ConfigProvider.use(pipe(Config.string(key), Config.option).parse).pipe(
    Effect.mapError((cause) =>
      AiMetricsCommandError.make({ cause, message: `Failed to read ${key} from the Effect config provider.` })
    )
  )
);

const readOptionalRedactedConfigString: (
  key: string
) => Effect.Effect<O.Option<Redacted.Redacted>, AiMetricsCommandError> = Effect.fn(
  "AIMetrics.readOptionalRedactedConfigString"
)((key) =>
  ConfigProvider.ConfigProvider.use(pipe(key, Config.redacted, Config.option).parse).pipe(
    Effect.mapError((cause) =>
      AiMetricsCommandError.make({ cause, message: `Failed to read ${key} from the Effect config provider.` })
    )
  )
);

const nonBlankOption = (value: O.Option<string>): O.Option<string> => O.filter(value, flow(Str.trim, Str.isNonEmpty));

const resolveHomeDir = Effect.fn("AIMetrics.resolveHomeDir")(function* (homeDir: O.Option<string>) {
  const supplied = nonBlankOption(homeDir);
  if (O.isSome(supplied)) {
    return supplied.value;
  }

  // `Config.string` accepts an exported-but-empty variable, so a blank `HOME`
  // has to be rejected here; letting it through resolves the canonical store to
  // `/.local/state/beep/ai-metrics`, which is absolute and therefore invisible
  // to every downstream absolute-path guard.
  const envHome = nonBlankOption(yield* readOptionalConfigString("HOME"));
  if (O.isSome(envHome)) {
    return envHome.value;
  }

  return yield* AiMetricsCommandError.make({
    cause: "HOME",
    message: "Unable to resolve a home directory. Pass --home-dir explicitly.",
  });
});

const resolveAgentEvidenceRoot = Effect.fn("AIMetrics.resolveAgentEvidenceRoot")(function* (homeDir: string) {
  const path = yield* Path.Path;
  const configuredRoot = nonBlankOption(yield* readOptionalConfigString("BEEP_AGENT_EVIDENCE_ROOT"));
  const stateHome = nonBlankOption(yield* readOptionalConfigString("XDG_STATE_HOME"));
  const resolved = O.getOrElse(configuredRoot, () =>
    agentEvidenceRoot(O.getOrElse(stateHome, () => path.join(homeDir, ".local/state")))
  );
  if (path.isAbsolute(resolved)) return resolved;
  return yield* AiMetricsCommandError.make({
    cause: resolved,
    message: "BEEP_AGENT_EVIDENCE_ROOT and XDG_STATE_HOME must resolve to an absolute path.",
  });
});

const resolveRepoRoot = Effect.fn("AIMetrics.resolveRepoRoot")(function* (repoRoot: O.Option<string>) {
  const path = yield* Path.Path;
  return path.resolve(O.isSome(repoRoot) ? repoRoot.value : process.cwd());
});

const requireAbsoluteDataRoot = (path: string) =>
  requireAbsoluteAiMetricsDataRoot(path).pipe(
    Effect.mapError((error) =>
      AiMetricsCommandError.make({
        cause: error.cause,
        message: `${error.message} Pass an absolute --data-root or ${aiMetricsDataRootEnvVar}.`,
      })
    )
  );

/**
 * Resolve the AI metrics data root every `ai-metrics` program reads and writes.
 *
 * **Details**
 *
 * Precedence is `--data-root`, then `BEEP_AI_METRICS_DATA_ROOT`, then the deploy
 * target's default, where `local` means `${XDG_STATE_HOME:-$HOME/.local/state}/beep/ai-metrics`
 * and `dankserver` means `/srv/data/ai-metrics`. The flag carries the
 * environment rung through `Flag.withFallbackConfig`, and the environment is
 * also read here into the schema's `envDataRoot` key, so callers that pass
 * `O.none()` directly — `install preview` and `install compose` — still honor
 * `BEEP_AI_METRICS_DATA_ROOT` instead of silently rendering the target default.
 *
 * **Gotchas**
 *
 * The home directory is resolved lazily: the first pass omits it, and only a
 * `None` — which the resolver returns exactly when the XDG rung won and had no
 * state home to hang beneath — costs a `HOME` read. Reading `HOME` eagerly
 * would fail `--target dankserver` runs in environments that have none, and
 * restating the precedence table here to decide would leave two copies of it to
 * drift apart. Relative values are refused here, for every command: a relative
 * root would rebind the store to each process working directory, splitting the
 * canonical store back into clone-local trees and letting destructive retention
 * target a tree the operator never meant.
 *
 * **Example** (Resolving an operator flag)
 *
 * ```ts
 * import { AiMetricsDeployTarget } from "@beep/repo-ai-metrics"
 * import { resolveDataRoot } from "@beep/repo-cli/commands/AIMetrics/internal/Programs"
 * import * as O from "@beep/utils/Option"
 * import { Effect } from "effect"
 *
 * const program = resolveDataRoot(O.some("/srv/store"), AiMetricsDeployTarget.Enum.local)
 *
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param dataRoot - `--data-root`, already carrying the `BEEP_AI_METRICS_DATA_ROOT` fallback.
 * @param target - Deploy target whose default applies when no root is supplied.
 * @returns The resolved data root path.
 * @category utilities
 * @since 0.0.0
 */
const resolveDataRoot = Effect.fn("AIMetrics.resolveDataRoot")(function* (
  dataRoot: O.Option<string>,
  target: AiMetricsDeployTarget
) {
  const flagDataRoot = nonBlankOption(dataRoot);
  const envDataRoot = yield* readOptionalConfigString(aiMetricsDataRootEnvVar);
  const stateHome = yield* readOptionalConfigString("XDG_STATE_HOME");
  const makeInput = (homeDir: O.Option<string>) =>
    AiMetricsDataRootInput.make({
      envDataRoot,
      flagDataRoot,
      homeDir,
      stateHome,
      target,
    });
  const missingHomeDir = O.none<string>();
  const probe = pipe(missingHomeDir, makeInput, resolveAiMetricsDataRoot);
  if (O.isSome(probe)) {
    return yield* requireAbsoluteDataRoot(probe.value.path);
  }

  const homeDir = O.some(yield* resolveHomeDir(missingHomeDir));
  const resolved = pipe(homeDir, makeInput, resolveAiMetricsDataRoot);
  if (O.isNone(resolved)) {
    return yield* AiMetricsCommandError.make({
      cause: "HOME",
      message: "Unable to resolve a home directory. Pass --home-dir explicitly.",
    });
  }

  return yield* requireAbsoluteDataRoot(resolved.value.path);
});

const resolveHashSalt = Effect.fn("AIMetrics.resolveHashSalt")(function* (hashSalt: O.Option<string>) {
  if (O.isSome(hashSalt)) {
    return hashSalt;
  }

  return yield* readOptionalConfigString("BEEP_AI_METRICS_HASH_SALT");
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

/**
 * Option schema for the RequireHashSaltForTarget AI metrics helper.
 *
 * **Example** (Inspect the RequireHashSaltForTargetOptions schema)
 *
 * ```ts
 * import { RequireHashSaltForTargetOptions } from "@beep/repo-cli/commands/AIMetrics/internal/Programs"
 *
 * console.log(RequireHashSaltForTargetOptions.ast !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
class RequireHashSaltForTargetOptions extends S.Class<RequireHashSaltForTargetOptions>(
  $I`RequireHashSaltForTargetOptions`
)(
  {
    hashSalt: S.Option(S.String),
    target: AiMetricsDeployTarget,
  },
  $I.annote("RequireHashSaltForTargetOptions", {
    description: "Resolved hash salt and deployment target for commands that require path hashing.",
  })
) {}

const requireHashSaltForTarget = Effect.fn("AIMetrics.requireHashSaltForTarget")(function* ({
  hashSalt,
  target,
}: RequireHashSaltForTargetOptions) {
  if (target === AiMetricsDeployTarget.Enum.local || O.exists(hashSalt, flow(Str.trim, Str.isNonEmpty))) {
    return hashSalt;
  }

  return yield* AiMetricsCommandError.make({
    cause: target,
    message: "Non-local AI metrics commands require --hash-salt or BEEP_AI_METRICS_HASH_SALT.",
  });
});

/**
 * Option schema for the RequireHashSaltSecretRefForTarget AI metrics helper.
 *
 * **Example** (Inspect the RequireHashSaltSecretRefForTargetOptions schema)
 *
 * ```ts
 * import { RequireHashSaltSecretRefForTargetOptions } from "@beep/repo-cli/commands/AIMetrics/internal/Programs"
 *
 * console.log(RequireHashSaltSecretRefForTargetOptions.ast !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
class RequireHashSaltSecretRefForTargetOptions extends S.Class<RequireHashSaltSecretRefForTargetOptions>(
  $I`RequireHashSaltSecretRefForTargetOptions`
)(
  {
    hashSaltSecretRef: S.UndefinedOr(S.String),
    target: AiMetricsDeployTarget,
  },
  $I.annote("RequireHashSaltSecretRefForTargetOptions", {
    description: "Resolved hash-salt secret reference and deployment target for install planning.",
  })
) {}

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

/**
 * Option schema for the RequireRawArchiveKeySecretRefForTarget AI metrics helper.
 *
 * **Example** (Inspect the RequireRawArchiveKeySecretRefForTargetOptions schema)
 *
 * ```ts
 * import { RequireRawArchiveKeySecretRefForTargetOptions } from "@beep/repo-cli/commands/AIMetrics/internal/Programs"
 *
 * console.log(RequireRawArchiveKeySecretRefForTargetOptions.ast !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
class RequireRawArchiveKeySecretRefForTargetOptions extends S.Class<RequireRawArchiveKeySecretRefForTargetOptions>(
  $I`RequireRawArchiveKeySecretRefForTargetOptions`
)(
  {
    rawArchiveKeySecretRef: S.UndefinedOr(S.String),
    target: AiMetricsDeployTarget,
  },
  $I.annote("RequireRawArchiveKeySecretRefForTargetOptions", {
    description: "Resolved raw-archive key secret reference and deployment target for install planning.",
  })
) {}

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

/**
 * Option schema for the ParseWindow AI metrics helper.
 *
 * **Example** (Inspect the ParseWindowOptions schema)
 *
 * ```ts
 * import { ParseWindowOptions } from "@beep/repo-cli/commands/AIMetrics/internal/Programs"
 *
 * console.log(ParseWindowOptions.ast !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
class ParseWindowOptions extends S.Class<ParseWindowOptions>($I`ParseWindowOptions`)(
  {
    since: S.Option(S.String),
    until: S.Option(S.String),
  },
  $I.annote("ParseWindowOptions", {
    description: "Optional inclusive lower and exclusive upper timestamp flags for report windows.",
  })
) {}

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

/**
 * Option schema for the ParseRetentionSelector AI metrics helper.
 *
 * **Example** (Inspect the ParseRetentionSelectorOptions schema)
 *
 * ```ts
 * import { ParseRetentionSelectorOptions } from "@beep/repo-cli/commands/AIMetrics/internal/Programs"
 *
 * console.log(ParseRetentionSelectorOptions.ast !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
class ParseRetentionSelectorOptions extends ParseWindowOptions.extend<ParseRetentionSelectorOptions>(
  $I`ParseRetentionSelectorOptions`
)(
  {
    before: S.Option(S.String),
    dataRoot: S.Option(S.String),
  },
  $I.annote("ParseRetentionSelectorOptions", {
    description: "Retention selector flags before they are normalized into an epoch-millis policy window.",
  })
) {}

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
    // Retention is a local-first operator surface with no `--target` flag, so the
    // fallback rung is always the workstation's XDG store.
    dataRoot: yield* resolveDataRoot(dataRoot, AiMetricsDeployTarget.Enum.local),
    beforeEpochMillis,
    sinceEpochMillis,
    untilEpochMillis,
  });
});

const hasRetentionWindow = (selector: AiMetricsRetentionSelector): boolean =>
  O.isSome(selector.beforeEpochMillis) || O.isSome(selector.sinceEpochMillis) || O.isSome(selector.untilEpochMillis);

const retentionWindowUpper = (selector: AiMetricsRetentionSelector): O.Option<number> =>
  O.orElse(selector.beforeEpochMillis, () => selector.untilEpochMillis);

const hasBoundedRetentionMutationWindow = (selector: AiMetricsRetentionSelector): boolean =>
  O.isSome(selector.beforeEpochMillis) || (O.isSome(selector.sinceEpochMillis) && O.isSome(selector.untilEpochMillis));

const hasOrderedRetentionMutationWindow = (selector: AiMetricsRetentionSelector): boolean =>
  O.getOrElse(
    O.zipWith(selector.sinceEpochMillis, retentionWindowUpper(selector), (lower, upper) => lower < upper),
    () => true
  );

const parseChecks = (checks: string): ReadonlyArray<string> =>
  pipe(Str.split(checks, ","), A.map(Str.trim), A.filter(Str.isNonEmpty));

/**
 * Option schema for the MakeCommandInstallInput AI metrics helper.
 *
 * **Example** (Inspect the MakeCommandInstallInputOptions schema)
 *
 * ```ts
 * import { MakeCommandInstallInputOptions } from "@beep/repo-cli/commands/AIMetrics/internal/Programs"
 *
 * console.log(MakeCommandInstallInputOptions.ast !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
class MakeCommandInstallInputOptions extends S.Class<MakeCommandInstallInputOptions>(
  $I`MakeCommandInstallInputOptions`
)(
  {
    dataRoot: S.String,
    defaultTool: S.optionalKey(AiMetricsTool),
    hashSaltSecretRef: S.Option(S.String),
    privacyMode: S.optionalKey(AiMetricsPrivacyMode),
    rawArchiveKeySecretRef: S.Option(S.String),
    target: AiMetricsDeployTarget,
  },
  $I.annote("MakeCommandInstallInputOptions", {
    description: "CLI install flags, with the data root already resolved, before secret references are resolved.",
  })
) {}

// `defaultTool` and `privacyMode` are the only divergences among the install-shaped
// commands; omitting them keeps `AiMetricsInstallInput`'s own constructor defaults.
const makeCommandInstallInput = Effect.fn("AIMetrics.makeCommandInstallInput")(function* ({
  dataRoot,
  defaultTool,
  hashSaltSecretRef,
  privacyMode,
  rawArchiveKeySecretRef,
  target,
}: MakeCommandInstallInputOptions) {
  const resolvedHashSaltSecretRef = yield* requireHashSaltSecretRefForTarget({
    hashSaltSecretRef: yield* resolveHashSaltSecretRef(hashSaltSecretRef),
    target,
  });
  const resolvedRawArchiveKeySecretRef = yield* requireRawArchiveKeySecretRefForTarget({
    rawArchiveKeySecretRef: yield* resolveRawArchiveKeySecretRef(rawArchiveKeySecretRef),
    target,
  });

  return AiMetricsInstallInput.make({
    dataRoot: O.some(dataRoot),
    ...O.getSomesStruct({
      defaultTool: O.fromUndefinedOr(defaultTool),
      privacyMode: O.fromUndefinedOr(privacyMode),
    }),
    hashSaltSecretRef: O.fromUndefinedOr(resolvedHashSaltSecretRef),
    rawArchiveKeySecretRef: O.fromUndefinedOr(resolvedRawArchiveKeySecretRef),
    target,
  });
});

/**
 * Option schema for the MakeCommandInstallSpec AI metrics helper.
 *
 * **Example** (Inspect the MakeCommandInstallSpecOptions schema)
 *
 * ```ts
 * import { MakeCommandInstallSpecOptions } from "@beep/repo-cli/commands/AIMetrics/internal/Programs"
 *
 * console.log(MakeCommandInstallSpecOptions.ast !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
class MakeCommandInstallSpecOptions extends S.Class<MakeCommandInstallSpecOptions>($I`MakeCommandInstallSpecOptions`)(
  {
    dataRoot: S.String,
    defaultTool: S.optionalKey(AiMetricsTool),
    hashSaltSecretRef: S.Option(S.String),
    privacyMode: S.optionalKey(AiMetricsPrivacyMode),
    rawArchiveKeySecretRef: S.Option(S.String),
    target: AiMetricsDeployTarget,
  },
  $I.annote("MakeCommandInstallSpecOptions", {
    description: "CLI install flags, with the data root already resolved, used to build a concrete install spec.",
  })
) {}

const makeCommandInstallSpec = Effect.fn("AIMetrics.makeCommandInstallSpec")(function* (
  options: MakeCommandInstallSpecOptions
) {
  return yield* makeAiMetricsInstallSpec(yield* makeCommandInstallInput(options));
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

/**
 * Option schema for the MakeInstallPreviewProgram AI metrics helper.
 *
 * **Example** (Inspect the MakeInstallPreviewProgramOptions schema)
 *
 * ```ts
 * import { MakeInstallPreviewProgramOptions } from "@beep/repo-cli/commands/AIMetrics/internal/Programs"
 *
 * console.log(MakeInstallPreviewProgramOptions.ast !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
class MakeInstallPreviewProgramOptions extends S.Class<MakeInstallPreviewProgramOptions>(
  $I`MakeInstallPreviewProgramOptions`
)(
  {
    hashSaltSecretRef: S.Option(S.String),
    json: S.Boolean,
    rawArchiveKeySecretRef: S.Option(S.String),
    target: AiMetricsDeployTarget,
    tool: AiMetricsTool,
  },
  $I.annote("MakeInstallPreviewProgramOptions", {
    description: "CLI flags for rendering an AI metrics install spec preview.",
  })
) {}

const makeInstallPreviewProgram = Effect.fn("AIMetrics.makeInstallPreviewProgram")(function* ({
  hashSaltSecretRef,
  json,
  rawArchiveKeySecretRef,
  target,
  tool,
}: MakeInstallPreviewProgramOptions) {
  const spec = yield* makeCommandInstallSpec({
    dataRoot: yield* resolveDataRoot(O.none(), target),
    defaultTool: tool,
    hashSaltSecretRef,
    privacyMode: AiMetricsPrivacyMode.Enum.encrypted_raw_redacted_ui,
    rawArchiveKeySecretRef,
    target,
  });

  yield* renderInstallSpec(spec, json);
});

/**
 * Option schema for the MakeInstallComposeProgram AI metrics helper.
 *
 * **Example** (Inspect the MakeInstallComposeProgramOptions schema)
 *
 * ```ts
 * import { MakeInstallComposeProgramOptions } from "@beep/repo-cli/commands/AIMetrics/internal/Programs"
 *
 * console.log(MakeInstallComposeProgramOptions.ast !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
class MakeInstallComposeProgramOptions extends S.Class<MakeInstallComposeProgramOptions>(
  $I`MakeInstallComposeProgramOptions`
)(
  {
    json: S.Boolean,
    target: AiMetricsDeployTarget,
    tool: AiMetricsTool,
  },
  $I.annote("MakeInstallComposeProgramOptions", {
    description: "CLI flags for rendering a local compose file for an AI metrics backend.",
  })
) {}

const makeInstallComposeProgram = Effect.fn("AIMetrics.makeInstallComposeProgram")(function* ({
  json,
  target,
  tool,
}: MakeInstallComposeProgramOptions) {
  const spec = yield* makeAiMetricsInstallSpec(
    AiMetricsInstallInput.make({
      dataRoot: O.some(yield* resolveDataRoot(O.none(), target)),
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

/**
 * Option schema for the MakeInstallPlanProgram AI metrics helper.
 *
 * **Example** (Inspect the MakeInstallPlanProgramOptions schema)
 *
 * ```ts
 * import { MakeInstallPlanProgramOptions } from "@beep/repo-cli/commands/AIMetrics/internal/Programs"
 *
 * console.log(MakeInstallPlanProgramOptions.ast !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
class MakeInstallPlanProgramOptions extends S.Class<MakeInstallPlanProgramOptions>($I`MakeInstallPlanProgramOptions`)(
  {
    dataRoot: S.Option(S.String),
    hashSaltSecretRef: S.Option(S.String),
    json: S.Boolean,
    rawArchiveKeySecretRef: S.Option(S.String),
    target: AiMetricsDeployTarget,
  },
  $I.annote("MakeInstallPlanProgramOptions", {
    description: "CLI flags for producing an AI metrics install plan.",
  })
) {}

const makeInstallPlanProgram = Effect.fn("AIMetrics.makeInstallPlanProgram")(function* ({
  dataRoot,
  hashSaltSecretRef,
  json,
  rawArchiveKeySecretRef,
  target,
}: MakeInstallPlanProgramOptions) {
  const input = yield* makeCommandInstallInput({
    dataRoot: yield* resolveDataRoot(dataRoot, target),
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

/**
 * Option schema for the MakeInstallDoctorProgram AI metrics helper.
 *
 * **Example** (Inspect the MakeInstallDoctorProgramOptions schema)
 *
 * ```ts
 * import { MakeInstallDoctorProgramOptions } from "@beep/repo-cli/commands/AIMetrics/internal/Programs"
 *
 * console.log(MakeInstallDoctorProgramOptions.ast !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
class MakeInstallDoctorProgramOptions extends S.Class<MakeInstallDoctorProgramOptions>(
  $I`MakeInstallDoctorProgramOptions`
)(
  {
    all: S.Boolean,
    dataRoot: S.Option(S.String),
    hashSalt: S.Option(S.String),
    hashSaltSecretRef: S.Option(S.String),
    homeDir: S.Option(S.String),
    json: S.Boolean,
    maxFileBytes: S.Option(S.Finite),
    maxFiles: S.Finite,
    openClawUnit: S.Option(S.String),
    rawArchiveKeySecretRef: S.Option(S.String),
    repoRoot: S.Option(S.String),
    since: S.Option(S.String),
    target: AiMetricsDeployTarget,
  },
  $I.annote("MakeInstallDoctorProgramOptions", {
    description: "CLI flags for checking AI metrics install readiness and source discovery.",
  })
) {}

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
    dataRoot: yield* resolveDataRoot(dataRoot, target),
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
      maxFileBytes,
      maxFiles,
      repoRoot: yield* resolveRepoRoot(repoRoot),
      target: AiMetricsDeployTarget.Enum.local,
      hashSalt: resolvedHashSalt,
      sinceEpochMillis: O.fromUndefinedOr(sinceEpochMillis),
      openClawUnitPath: openClawUnit,
    })
  );
  const result = yield* makeAiMetricsInstallDoctorResult(
    AiMetricsInstallDoctorInput.make({
      install,
      sourceDiscovery: O.some(sourceDiscovery),
    })
  );

  yield* renderInstallDoctor(result, json);
  if (result.status === AiMetricsInstallDoctorStatus.Enum.failed) {
    return yield* AiMetricsStatusExit.make({
      message: "AI metrics install doctor reported a failed status.",
    });
  }
});

/**
 * Option schema for the MakeInstallApplyProgram AI metrics helper.
 *
 * **Example** (Inspect the MakeInstallApplyProgramOptions schema)
 *
 * ```ts
 * import { MakeInstallApplyProgramOptions } from "@beep/repo-cli/commands/AIMetrics/internal/Programs"
 *
 * console.log(MakeInstallApplyProgramOptions.ast !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
class MakeInstallApplyProgramOptions extends S.Class<MakeInstallApplyProgramOptions>(
  $I`MakeInstallApplyProgramOptions`
)(
  {
    dataRoot: S.Option(S.String),
    dryRun: S.Boolean,
    hashSaltSecretRef: S.Option(S.String),
    json: S.Boolean,
    rawArchiveKeySecretRef: S.Option(S.String),
    target: AiMetricsDeployTarget,
  },
  $I.annote("MakeInstallApplyProgramOptions", {
    description: "CLI flags for dry-running an AI metrics install apply plan.",
  })
) {}

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
    dataRoot: yield* resolveDataRoot(dataRoot, target),
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

/**
 * Option schema for the MakeIngestProgram AI metrics helper.
 *
 * **Example** (Inspect the MakeIngestProgramOptions schema)
 *
 * ```ts
 * import { MakeIngestProgramOptions } from "@beep/repo-cli/commands/AIMetrics/internal/Programs"
 *
 * console.log(MakeIngestProgramOptions.ast !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
class MakeIngestProgramOptions extends S.Class<MakeIngestProgramOptions>($I`MakeIngestProgramOptions`)(
  {
    hashSalt: S.Option(S.String),
    input: S.String,
    json: S.Boolean,
    source: AiMetricsTranscriptSource,
    target: AiMetricsDeployTarget,
  },
  $I.annote("MakeIngestProgramOptions", {
    description: "CLI flags for summarizing a transcript file into AI metrics ingest output.",
  })
) {}

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
    hashSalt: resolvedHashSalt,
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
  const stat = yield* fs
    .stat(inputPath)
    .pipe(
      Effect.mapError((cause) => AiMetricsCommandError.make({ cause, message: "Failed to inspect privacy input." }))
    );

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
    const childPaths = A.map(entries, (entry) => path.join(currentPath, entry));

    return A.flatten(yield* Effect.forEach(childPaths, walk));
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
    (filePath) =>
      fs
        .readFileString(filePath)
        .pipe(
          Effect.mapError((cause) => AiMetricsCommandError.make({ cause, message: "Failed to read transcript input." }))
        ),
    { concurrency: 8 }
  );

  return {
    absolutePath,
    content: pipe(chunks, A.join("\n")),
  };
});

/**
 * Option schema for the MakeSourcesDiscoverProgram AI metrics helper.
 *
 * **Example** (Inspect the MakeSourcesDiscoverProgramOptions schema)
 *
 * ```ts
 * import { MakeSourcesDiscoverProgramOptions } from "@beep/repo-cli/commands/AIMetrics/internal/Programs"
 *
 * console.log(MakeSourcesDiscoverProgramOptions.ast !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
class MakeSourcesDiscoverProgramOptions extends S.Class<MakeSourcesDiscoverProgramOptions>(
  $I`MakeSourcesDiscoverProgramOptions`
)(
  {
    all: S.Boolean,
    hashSalt: S.Option(S.String),
    homeDir: S.Option(S.String),
    json: S.Boolean,
    maxFileBytes: S.Option(S.Finite),
    maxFiles: S.Finite,
    openClawUnit: S.Option(S.String),
    repoRoot: S.Option(S.String),
    since: S.Option(S.String),
    target: AiMetricsDeployTarget,
  },
  $I.annote("MakeSourcesDiscoverProgramOptions", {
    description: "CLI flags for discovering transcript sources available to AI metrics.",
  })
) {}

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
      maxFileBytes,
      maxFiles,
      repoRoot: yield* resolveRepoRoot(repoRoot),
      target,
      hashSalt: resolvedHashSalt,
      sinceEpochMillis: O.fromUndefinedOr(sinceEpochMillis),
      openClawUnitPath: openClawUnit,
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

/**
 * Option schema for the MakeConfigSnapshotProgram AI metrics helper.
 *
 * **Example** (Inspect the MakeConfigSnapshotProgramOptions schema)
 *
 * ```ts
 * import { MakeConfigSnapshotProgramOptions } from "@beep/repo-cli/commands/AIMetrics/internal/Programs"
 *
 * console.log(MakeConfigSnapshotProgramOptions.ast !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
class MakeConfigSnapshotProgramOptions extends S.Class<MakeConfigSnapshotProgramOptions>(
  $I`MakeConfigSnapshotProgramOptions`
)(
  {
    json: S.Boolean,
    repoRoot: S.Option(S.String),
  },
  $I.annote("MakeConfigSnapshotProgramOptions", {
    description: "CLI flags for capturing repository configuration into an AI metrics snapshot.",
  })
) {}

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

/**
 * Option schema for the MakePrivacyCheckProgram AI metrics helper.
 *
 * **Example** (Inspect the MakePrivacyCheckProgramOptions schema)
 *
 * ```ts
 * import { MakePrivacyCheckProgramOptions } from "@beep/repo-cli/commands/AIMetrics/internal/Programs"
 *
 * console.log(MakePrivacyCheckProgramOptions.ast !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
class MakePrivacyCheckProgramOptions extends S.Class<MakePrivacyCheckProgramOptions>(
  $I`MakePrivacyCheckProgramOptions`
)(
  {
    hashSalt: S.Option(S.String),
    input: S.String,
    json: S.Boolean,
    source: AiMetricsTranscriptSource,
  },
  $I.annote("MakePrivacyCheckProgramOptions", {
    description: "CLI flags for checking transcript privacy before derived AI metrics use.",
  })
) {}

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
    hashSalt: resolvedHashSalt,
    sourceKind: source,
    sourcePath: absolutePath,
  });
  const result = yield* makeAiMetricsPrivacyCheckResult({
    content,
    hashSalt: resolvedHashSalt,
    relativePath: O.none(),
    sourcePath: absolutePath,
    summary,
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
    hookPulseLeaseReplay: result.hookPulseLeaseReplay,
    ingestRunId: result.ingestRunId,
    otlpExport: O.some(otlpExport),
    parquetExportDir: result.parquetExportDir,
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
    ...O.getSomesStruct({ hookPulseLeaseReplay: result.hookPulseLeaseReplay }),
    ingestRunId: result.ingestRunId,
    ...O.getSomesStruct({ otlpExport: result.otlpExport }),
    ...O.getSomesStruct({ parquetExportDir: result.parquetExportDir }),
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

// The run id comes from the forwarder pass, not from the export result. Export no longer
// carries one: it drains every pending turn regardless of which run committed it, so a run
// id on the result would have described the request rather than the batch.
const forwarderOtlpExported = (
  ingestRunId: string,
  result: AiMetricsOtlpExportResult
): AiMetricsForwarderOtlpExported =>
  AiMetricsForwarderOtlpExported.make({
    endpointTraceUrl: result.endpointTraceUrl,
    ingestRunId,
    sessionSpanCount: result.sessionSpanCount,
    spanCount: result.spanCount,
    status: "exported",
    target: result.target,
    turnSpanCount: result.turnSpanCount,
  });

const forwarderOtlpExportFailureMessage =
  "OTLP export did not complete after the forwarder run. Pending spans remain uncheckpointed for retry.";

/**
 * Option schema for the ForwarderOtlpExportFailed AI metrics helper.
 *
 * **Example** (Inspect the ForwarderOtlpExportFailedOptions schema)
 *
 * ```ts
 * import { ForwarderOtlpExportFailedOptions } from "@beep/repo-cli/commands/AIMetrics/internal/Programs"
 *
 * console.log(ForwarderOtlpExportFailedOptions.ast !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
class ForwarderOtlpExportFailedOptions extends S.Class<ForwarderOtlpExportFailedOptions>(
  $I`ForwarderOtlpExportFailedOptions`
)(
  {
    endpoint: AiMetricsOtlpEndpointSpec,
    forwarderResult: AiMetricsForwarderRunResult,
    message: S.String,
    target: AiMetricsDeployTarget,
  },
  $I.annote("ForwarderOtlpExportFailedOptions", {
    description: "Forwarder run context used to render a derived OTLP export failure payload.",
  })
) {}

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

/**
 * Option schema for the ExportForwarderDerivedOtlp AI metrics helper.
 *
 * **Example** (Inspect the ExportForwarderDerivedOtlpOptions schema)
 *
 * ```ts
 * import { ExportForwarderDerivedOtlpOptions } from "@beep/repo-cli/commands/AIMetrics/internal/Programs"
 *
 * console.log(ExportForwarderDerivedOtlpOptions.ast !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
class ExportForwarderDerivedOtlpOptions extends S.Class<ExportForwarderDerivedOtlpOptions>(
  $I`ExportForwarderDerivedOtlpOptions`
)(
  {
    endpoint: AiMetricsOtlpEndpointSpec,
    forwarderResult: AiMetricsForwarderRunResult,
    target: AiMetricsDeployTarget,
  },
  $I.annote("ExportForwarderDerivedOtlpOptions", {
    description: "Forwarder run context required to export derived OTLP spans.",
  })
) {}

const exportForwarderDerivedOtlp = Effect.fn("AIMetrics.exportForwarderDerivedOtlp")(function* ({
  endpoint,
  forwarderResult,
  target,
}: ExportForwarderDerivedOtlpOptions) {
  return yield* runAiMetricsOtlpExport(
    AiMetricsOtlpExportInput.make({
      duckDbPath: forwarderResult.duckDbPath,
      endpoint,
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
      onSuccess: (result) => Effect.succeed(forwarderOtlpExported(forwarderResult.ingestRunId, result)),
    })
  );
});

const attachForwarderOtlpExport = Effect.fn("AIMetrics.attachForwarderOtlpExport")(function* (
  enabled: boolean,
  spec: AiMetricsInstallSpec,
  otlpBaseUrl: O.Option<string>,
  forwarderResult: AiMetricsForwarderRunResult,
  target: AiMetricsDeployTarget
) {
  if (!enabled) return forwarderResult;
  const endpoint = yield* defaultServiceEndpoint(spec, otlpBaseUrl);
  const duckDbLayer = DuckDb.makeNodeLayer(DuckDbConnectionOptions.make({ databasePath: spec.storage.duckDbPath }));
  const otlpExit = yield* Effect.scoped(
    Layer.build(Layer.mergeAll(duckDbLayer, AiMetricsOtlpSpanSender.layer)).pipe(
      Effect.flatMap((context) =>
        exportForwarderDerivedOtlp({ endpoint, forwarderResult, target }).pipe(Effect.provide(context))
      )
    )
  ).pipe(Effect.exit);
  const otlpExport = Exit.isFailure(otlpExit)
    ? forwarderOtlpExportFailed({ endpoint, forwarderResult, message: forwarderOtlpExportFailureMessage, target })
    : otlpExit.value;
  if (Exit.isFailure(otlpExit)) {
    yield* Console.error(`ai-metrics: OTLP export failed after forwarder run: ${forwarderOtlpExportFailureMessage}`);
  }
  return forwarderRunResultWithOtlpExport(forwarderResult, otlpExport);
});

const enforceForwarderRetention = Effect.fn("AIMetrics.enforceForwarderRetention")(function* (
  enabled: boolean,
  spec: AiMetricsInstallSpec,
  maxSnapshotExports: number
) {
  if (!enabled) return O.none();
  const result = yield* enforceAiMetricsRetentionPolicy(
    AiMetricsRetentionEnforcementPolicy.make({
      dataRoot: spec.storage.dataRoot,
      dryRun: false,
      maxSnapshotExports,
    })
  );
  return O.some(result);
});

const logForwarderOptionalOutputs = Effect.fn("AIMetrics.logForwarderOptionalOutputs")(function* (
  result: AiMetricsForwarderRunResult,
  retentionEnforcement: O.Option<AiMetricsRetentionEnforcementResult>
) {
  if (O.isSome(result.parquetExportDir)) yield* Console.log(`parquet export: ${result.parquetExportDir.value}`);
  if (O.isSome(retentionEnforcement)) {
    yield* Console.log(
      `retention enforcement: deleted=${retentionEnforcement.value.deletedDerivedExportCount} kept=${retentionEnforcement.value.keptDerivedExportCount}`
    );
  }
  if (O.isSome(result.otlpExport)) {
    yield* Console.log(`otlp export: ${result.otlpExport.value.status}`);
    if (result.otlpExport.value.status === "exported") {
      yield* Console.log(`otlp spans: ${result.otlpExport.value.spanCount}`);
      yield* Console.log(`otlp sessions: ${result.otlpExport.value.sessionSpanCount}`);
      yield* Console.log(`otlp turns: ${result.otlpExport.value.turnSpanCount}`);
    } else {
      yield* Console.log(`otlp failure: ${result.otlpExport.value.message}`);
    }
  }
});

const renderForwarderRunResult = Effect.fn("AIMetrics.renderForwarderRunResult")(function* (
  json: boolean,
  target: AiMetricsDeployTarget,
  result: AiMetricsForwarderRunResult,
  retentionEnforcement: O.Option<AiMetricsRetentionEnforcementResult>
) {
  if (json) {
    yield* Console.log(yield* forwarderRunCommandToJson(result, retentionEnforcement));
    return;
  }
  yield* Console.log(`ai-metrics forwarder: target=${target}`);
  yield* Console.log(`ingest run: ${result.ingestRunId}`);
  yield* Console.log(`source files: ${result.sourceFileCount}`);
  yield* Console.log(`archive objects: ${result.archiveObjectCount}`);
  yield* Console.log(`turns: ${result.turnCount}`);
  if (O.isSome(result.hookPulseLeaseReplay)) {
    const replay = result.hookPulseLeaseReplay.value;
    yield* Console.log(
      `hook leases: files=${replay.enumeratedFileCount} sessions=${replay.sessionCount} active=${replay.openLeaseCount} tombstoned=${replay.tombstonedSessionCount} quarantined=${replay.quarantinedSessionCount}`
    );
  }
  yield* Console.log(`raw archive: ${result.rawArchiveDir}`);
  yield* Effect.forEach(
    result.sourceCoverage,
    (source) =>
      Console.log(
        `${source.sourceKind}: included=${source.includedFileCount} candidates=${source.candidateFileCount} limited=${source.limitedByMaxFiles}`
      ),
    { discard: true }
  );
  yield* Console.log(`derived duckdb: ${result.duckDbPath}`);
  yield* Console.log(`parquet mode: ${result.parquetExportMode}`);
  yield* logForwarderOptionalOutputs(result, retentionEnforcement);
});

/**
 * Option schema for the MakeForwarderRunProgram AI metrics helper.
 *
 * **Example** (Inspect the MakeForwarderRunProgramOptions schema)
 *
 * ```ts
 * import { MakeForwarderRunProgramOptions } from "@beep/repo-cli/commands/AIMetrics/internal/Programs"
 *
 * console.log(MakeForwarderRunProgramOptions.ast !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
class MakeForwarderRunProgramOptions extends S.Class<MakeForwarderRunProgramOptions>(
  $I`MakeForwarderRunProgramOptions`
)(
  {
    all: S.Boolean,
    dataRoot: S.Option(S.String),
    hashSalt: S.Option(S.String),
    hashSaltSecretRef: S.Option(S.String),
    homeDir: S.Option(S.String),
    json: S.Boolean,
    maxFileBytes: S.Option(S.Finite),
    maxFiles: S.Finite,
    openClawUnit: S.Option(S.String),
    otlp: S.Boolean,
    otlpBaseUrl: S.Option(S.String),
    parquetExportMode: AiMetricsParquetExportMode,
    rawArchiveKeySecretRef: S.Option(S.String),
    repoRoot: S.Option(S.String),
    retentionEnforce: S.Boolean,
    retentionMaxSnapshotExports: S.Finite,
    since: S.Option(S.String),
    target: AiMetricsDeployTarget,
  },
  $I.annote("MakeForwarderRunProgramOptions", {
    description: "CLI flags for running the AI metrics forwarder and optional derived exports.",
  })
) {}

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
  const resolvedDataRoot = yield* resolveDataRoot(dataRoot, target);
  // The install input carries the target-guarded secret references forward: both keys are
  // `optionalKey` with no constructor default, so reading them back off the input yields
  // exactly what the guards produced, `undefined` included.
  const installInput = yield* makeCommandInstallInput({
    dataRoot: resolvedDataRoot,
    hashSaltSecretRef,
    rawArchiveKeySecretRef,
    target,
  });
  const spec = yield* makeAiMetricsInstallSpec(installInput);
  const resolvedRawArchiveKey = yield* resolveRawArchiveKey();
  const sinceEpochMillis = all ? undefined : yield* parseSinceEpochMillis(since);
  const resolvedHomeDir = yield* resolveHomeDir(homeDir);
  const forwarderInput = AiMetricsForwarderInput.make({
    agentEvidenceRoot: O.some(yield* resolveAgentEvidenceRoot(resolvedHomeDir)),
    dataRoot: O.some(resolvedDataRoot),
    hashSalt: resolvedHashSalt,
    hashSaltSecretRef: installInput.hashSaltSecretRef,
    rawArchiveKeySecretRef: installInput.rawArchiveKeySecretRef,
    homeDir: resolvedHomeDir,
    includeAll: all,
    maxFileBytes,
    maxFiles,
    openClawUnitPath: openClawUnit,
    parquetExportMode,
    rawArchiveKey: resolvedRawArchiveKey,
    repoRoot: yield* resolveRepoRoot(repoRoot),
    sinceEpochMillis: O.fromUndefinedOr(sinceEpochMillis),
    target,
  });
  const duckDbLayer = DuckDb.makeNodeLayer(DuckDbConnectionOptions.make({ databasePath: spec.storage.duckDbPath }));
  const forwarderResult = yield* Effect.scoped(
    Layer.build(duckDbLayer).pipe(
      Effect.flatMap((context) => runAiMetricsForwarder(forwarderInput).pipe(Effect.provide(context)))
    )
  );
  const result = yield* attachForwarderOtlpExport(otlp, spec, otlpBaseUrl, forwarderResult, target);
  const retentionEnforcement = yield* enforceForwarderRetention(retentionEnforce, spec, retentionMaxSnapshotExports);
  yield* renderForwarderRunResult(json, target, result, retentionEnforcement);
});

/**
 * Option schema for the MakeForwarderTimerProgram AI metrics helper.
 *
 * **Example** (Inspect the MakeForwarderTimerProgramOptions schema)
 *
 * ```ts
 * import { MakeForwarderTimerProgramOptions } from "@beep/repo-cli/commands/AIMetrics/internal/Programs"
 *
 * console.log(MakeForwarderTimerProgramOptions.ast !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
class MakeForwarderTimerProgramOptions extends S.Class<MakeForwarderTimerProgramOptions>(
  $I`MakeForwarderTimerProgramOptions`
)(
  {
    dataRoot: S.Option(S.String),
    hashSaltSecretRef: S.Option(S.String),
    intervalMinutes: S.Finite,
    json: S.Boolean,
    maxFileBytes: S.Finite,
    maxFiles: S.Finite,
    otlpBaseUrl: S.Option(S.String),
    parquetExportMode: AiMetricsParquetExportMode,
    rawArchiveKeySecretRef: S.Option(S.String),
    repoRoot: S.Option(S.String),
    retentionEnforce: S.Boolean,
    retentionMaxSnapshotExports: S.Finite,
    target: AiMetricsDeployTarget,
  },
  $I.annote("MakeForwarderTimerProgramOptions", {
    description: "CLI flags for rendering the AI metrics forwarder systemd timer plan.",
  })
) {}

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
  const spec = yield* makeCommandInstallSpec({
    dataRoot: yield* resolveDataRoot(dataRoot, target),
    hashSaltSecretRef,
    rawArchiveKeySecretRef,
    target,
  });
  // `statusPath` and `--data-root` are both interpolated into the unit's
  // `ExecStart`, where a relative path would bind to `WorkingDirectory` -- the
  // exact mechanism that put the canonical store inside a clone. Refuse to render
  // anything before the root is proven absolute.
  yield* requireAbsoluteAiMetricsDataRoot(spec.storage.dataRoot).pipe(
    Effect.mapError((cause) =>
      AiMetricsCommandError.make({
        cause,
        message: "AI metrics forwarder timer units require an absolute --data-root.",
      })
    )
  );
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
      hashSaltSecretRef: O.fromUndefinedOr(resolvedHashSaltSecretRef),
      intervalMinutes,
      lockPath: "%t/beep-ai-metrics-forwarder.lock",
      rawArchiveKeySecretRef: O.fromUndefinedOr(resolvedRawArchiveKeySecretRef),
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

/**
 * Option schema for the MakeOtlpExportProgram AI metrics helper.
 *
 * **Example** (Inspect the MakeOtlpExportProgramOptions schema)
 *
 * ```ts
 * import { MakeOtlpExportProgramOptions } from "@beep/repo-cli/commands/AIMetrics/internal/Programs"
 *
 * console.log(MakeOtlpExportProgramOptions.ast !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
class MakeOtlpExportProgramOptions extends S.Class<MakeOtlpExportProgramOptions>($I`MakeOtlpExportProgramOptions`)(
  {
    dataRoot: S.Option(S.String),
    hashSaltSecretRef: S.Option(S.String),
    json: S.Boolean,
    otlpBaseUrl: S.Option(S.String),
    rawArchiveKeySecretRef: S.Option(S.String),
    target: AiMetricsDeployTarget,
  },
  $I.annote("MakeOtlpExportProgramOptions", {
    description: "CLI flags for exporting every pending derived AI metrics turn to the configured OTLP endpoint.",
  })
) {}

const makeOtlpExportProgram = Effect.fn("AIMetrics.makeOtlpExportProgram")(function* ({
  dataRoot,
  hashSaltSecretRef,
  json,
  otlpBaseUrl,
  rawArchiveKeySecretRef,
  target,
}: MakeOtlpExportProgramOptions) {
  const spec = yield* makeCommandInstallSpec({
    dataRoot: yield* resolveDataRoot(dataRoot, target),
    hashSaltSecretRef,
    rawArchiveKeySecretRef,
    target,
  });
  const endpoint = yield* defaultServiceEndpoint(spec, otlpBaseUrl);
  const input = AiMetricsOtlpExportInput.make({
    duckDbPath: spec.storage.duckDbPath,
    endpoint,
    target,
  });
  // The same entry point the forwarder uses. Reading, delivering, and marking used to be
  // spelled out separately here, which is how marking ended up wired into this command
  // only and never into the forwarder. One path now, and it cannot be half-used.
  const result = yield* Effect.scoped(
    Layer.build(
      Layer.mergeAll(
        DuckDb.makeNodeLayer(DuckDbConnectionOptions.make({ databasePath: spec.storage.duckDbPath })),
        AiMetricsOtlpSpanSender.layer
      )
    ).pipe(Effect.flatMap((context) => runAiMetricsOtlpExport(input).pipe(Effect.provide(context))))
  );

  if (json) {
    yield* Console.log(yield* otlpExportResultToJson(result));
    return;
  }

  yield* printLines([
    `ai-metrics otlp export: target=${target}`,
    `spans: ${result.spanCount}`,
    `sessions: ${result.sessionSpanCount}`,
    `turns: ${result.turnSpanCount}`,
    `trace endpoint: ${result.endpointTraceUrl}`,
  ]);
});

/**
 * Option schema for the MakeBenchmarkRunProgram AI metrics helper.
 *
 * **Example** (Inspect the MakeBenchmarkRunProgramOptions schema)
 *
 * ```ts
 * import { MakeBenchmarkRunProgramOptions } from "@beep/repo-cli/commands/AIMetrics/internal/Programs"
 *
 * console.log(MakeBenchmarkRunProgramOptions.ast !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
class MakeBenchmarkRunProgramOptions extends S.Class<MakeBenchmarkRunProgramOptions>(
  $I`MakeBenchmarkRunProgramOptions`
)(
  {
    caseId: S.String,
    configSnapshotId: S.String,
    dataRoot: S.Option(S.String),
    elapsedMs: S.Finite,
    hashSaltSecretRef: S.Option(S.String),
    json: S.Boolean,
    note: S.Option(S.String),
    passed: S.Boolean,
    qualityGate: AiMetricsQualityGateStatus,
    rawArchiveKeySecretRef: S.Option(S.String),
    target: AiMetricsDeployTarget,
  },
  $I.annote("MakeBenchmarkRunProgramOptions", {
    description: "CLI flags for recording one benchmark run in AI metrics storage.",
  })
) {}

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
    dataRoot: yield* resolveDataRoot(dataRoot, target),
    hashSaltSecretRef,
    rawArchiveKeySecretRef,
    target,
  });
  const validElapsedMs = yield* decodeNonNegativeInteger(elapsedMs).pipe(
    Effect.mapError((cause) =>
      AiMetricsCommandError.make({
        cause,
        message: "AI metrics elapsed milliseconds must be greater than or equal to 0.",
      })
    )
  );
  const input = AiMetricsBenchmarkRunInput.make({
    benchmarkCaseId: caseId,
    configSnapshotId,
    elapsedMs: validElapsedMs,
    note,
    passed,
    qualityGate,
  });
  const result = yield* recordAiMetricsBenchmarkRun(input).pipe(withAiMetricsDuckDb(spec.storage.duckDbPath));

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

/**
 * Option schema for the MakeLabelQueueProgram AI metrics helper.
 *
 * **Example** (Inspect the MakeLabelQueueProgramOptions schema)
 *
 * ```ts
 * import { MakeLabelQueueProgramOptions } from "@beep/repo-cli/commands/AIMetrics/internal/Programs"
 *
 * console.log(MakeLabelQueueProgramOptions.ast !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
class MakeLabelQueueProgramOptions extends S.Class<MakeLabelQueueProgramOptions>($I`MakeLabelQueueProgramOptions`)(
  {
    dataRoot: S.Option(S.String),
    hashSaltSecretRef: S.Option(S.String),
    json: S.Boolean,
    limit: S.Finite,
    rawArchiveKeySecretRef: S.Option(S.String),
    since: S.Option(S.String),
    target: AiMetricsDeployTarget,
    until: S.Option(S.String),
  },
  $I.annote("MakeLabelQueueProgramOptions", {
    description: "CLI flags for selecting unlabeled AI metrics tasks within a time window.",
  })
) {}

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
    dataRoot: yield* resolveDataRoot(dataRoot, target),
    hashSaltSecretRef,
    rawArchiveKeySecretRef,
    target,
  });
  const window = yield* parseWindow({
    since,
    until,
  });
  const result = yield* queueAiMetricsLabels(
    AiMetricsLabelQueueInput.make({
      limit,
      target,
      windowEndEpochMillis: window.windowEndEpochMillis,
      windowStartEpochMillis: window.windowStartEpochMillis,
    })
  ).pipe(withAiMetricsDuckDb(spec.storage.duckDbPath));

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

/**
 * Option schema for the MakeLabelAddProgram AI metrics helper.
 *
 * **Example** (Inspect the MakeLabelAddProgramOptions schema)
 *
 * ```ts
 * import { MakeLabelAddProgramOptions } from "@beep/repo-cli/commands/AIMetrics/internal/Programs"
 *
 * console.log(MakeLabelAddProgramOptions.ast !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
class MakeLabelAddProgramOptions extends S.Class<MakeLabelAddProgramOptions>($I`MakeLabelAddProgramOptions`)(
  {
    dataRoot: S.Option(S.String),
    followUpFix: S.Boolean,
    hashSaltSecretRef: S.Option(S.String),
    interventions: S.Finite,
    json: S.Boolean,
    note: S.Option(S.String),
    passed: S.Boolean,
    qualityGate: AiMetricsQualityGateStatus,
    rating: S.Finite,
    rawArchiveKeySecretRef: S.Option(S.String),
    target: AiMetricsDeployTarget,
    taskId: S.String,
  },
  $I.annote("MakeLabelAddProgramOptions", {
    description: "CLI flags for adding one human outcome label to an AI metrics task.",
  })
) {}

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
    dataRoot: yield* resolveDataRoot(dataRoot, target),
    hashSaltSecretRef,
    rawArchiveKeySecretRef,
    target,
  });
  const validInterventions = yield* decodeNonNegativeInteger(interventions).pipe(
    Effect.mapError((cause) =>
      AiMetricsCommandError.make({
        cause,
        message: "AI metrics intervention count must be greater than or equal to 0.",
      })
    )
  );
  const validRating = yield* decodeRating(rating).pipe(
    Effect.mapError((cause) =>
      AiMetricsCommandError.make({
        cause,
        message: "AI metrics outcome labels require --rating between 1 and 5.",
      })
    )
  );
  const input = AiMetricsOutcomeLabelInput.make({
    agentTaskId: taskId,
    followUpFix,
    interventionCount: validInterventions,
    note,
    passed,
    qualityGate,
    rating: validRating,
  });
  const result = yield* addAiMetricsOutcomeLabel(input).pipe(withAiMetricsDuckDb(spec.storage.duckDbPath));

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

/**
 * Option schema for the MakeBenchmarkCaseAddProgram AI metrics helper.
 *
 * **Example** (Inspect the MakeBenchmarkCaseAddProgramOptions schema)
 *
 * ```ts
 * import { MakeBenchmarkCaseAddProgramOptions } from "@beep/repo-cli/commands/AIMetrics/internal/Programs"
 *
 * console.log(MakeBenchmarkCaseAddProgramOptions.ast !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
class MakeBenchmarkCaseAddProgramOptions extends S.Class<MakeBenchmarkCaseAddProgramOptions>(
  $I`MakeBenchmarkCaseAddProgramOptions`
)(
  {
    caseId: S.String,
    checks: S.String,
    dataRoot: S.Option(S.String),
    hashSaltSecretRef: S.Option(S.String),
    json: S.Boolean,
    promptHash: S.String,
    promptRef: S.Option(S.String),
    rawArchiveKeySecretRef: S.Option(S.String),
    target: AiMetricsDeployTarget,
    title: S.String,
  },
  $I.annote("MakeBenchmarkCaseAddProgramOptions", {
    description: "CLI flags for upserting a benchmark case used by AI metrics scoring.",
  })
) {}

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
    dataRoot: yield* resolveDataRoot(dataRoot, target),
    hashSaltSecretRef,
    rawArchiveKeySecretRef,
    target,
  });
  const result = yield* upsertAiMetricsBenchmarkCase(
    AiMetricsBenchmarkCaseInput.make({
      benchmarkCaseId: caseId,
      expectedChecks: parseChecks(checks),
      promptHash,
      title,
      promptRef,
    })
  ).pipe(withAiMetricsDuckDb(spec.storage.duckDbPath));

  if (json) {
    yield* Console.log(yield* aiMetricsBenchmarkCaseToJson(result));
    return;
  }

  yield* printLines([
    `ai-metrics benchmark case add: ${result.benchmarkCaseId}`,
    `checks: ${A.length(result.expectedChecks)}`,
  ]);
});

/**
 * Option schema for the MakeBenchmarkCaseListProgram AI metrics helper.
 *
 * **Example** (Inspect the MakeBenchmarkCaseListProgramOptions schema)
 *
 * ```ts
 * import { MakeBenchmarkCaseListProgramOptions } from "@beep/repo-cli/commands/AIMetrics/internal/Programs"
 *
 * console.log(MakeBenchmarkCaseListProgramOptions.ast !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
class MakeBenchmarkCaseListProgramOptions extends S.Class<MakeBenchmarkCaseListProgramOptions>(
  $I`MakeBenchmarkCaseListProgramOptions`
)(
  {
    dataRoot: S.Option(S.String),
    hashSaltSecretRef: S.Option(S.String),
    json: S.Boolean,
    rawArchiveKeySecretRef: S.Option(S.String),
    target: AiMetricsDeployTarget,
  },
  $I.annote("MakeBenchmarkCaseListProgramOptions", {
    description: "CLI flags for listing benchmark cases from AI metrics storage.",
  })
) {}

const makeBenchmarkCaseListProgram = Effect.fn("AIMetrics.makeBenchmarkCaseListProgram")(function* ({
  dataRoot,
  hashSaltSecretRef,
  json,
  rawArchiveKeySecretRef,
  target,
}: MakeBenchmarkCaseListProgramOptions) {
  const spec = yield* makeCommandInstallSpec({
    dataRoot: yield* resolveDataRoot(dataRoot, target),
    hashSaltSecretRef,
    rawArchiveKeySecretRef,
    target,
  });
  const result = yield* listAiMetricsBenchmarkCases.pipe(withAiMetricsDuckDb(spec.storage.duckDbPath));

  if (json) {
    yield* Console.log(yield* aiMetricsBenchmarkCaseListToJson(result));
    return;
  }

  yield* printLines([
    `ai-metrics benchmark case list: ${A.length(result.cases)}`,
    ...A.map(result.cases, (benchmarkCase) => `${benchmarkCase.benchmarkCaseId}: ${benchmarkCase.title}`),
  ]);
});

/**
 * Option schema for the MakeWeeklyReportProgram AI metrics helper.
 *
 * **Example** (Inspect the MakeWeeklyReportProgramOptions schema)
 *
 * ```ts
 * import { MakeWeeklyReportProgramOptions } from "@beep/repo-cli/commands/AIMetrics/internal/Programs"
 *
 * console.log(MakeWeeklyReportProgramOptions.ast !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
class MakeWeeklyReportProgramOptions extends S.Class<MakeWeeklyReportProgramOptions>(
  $I`MakeWeeklyReportProgramOptions`
)(
  {
    dataRoot: S.Option(S.String),
    hashSaltSecretRef: S.Option(S.String),
    json: S.Boolean,
    rawArchiveKeySecretRef: S.Option(S.String),
    since: S.Option(S.String),
    target: AiMetricsDeployTarget,
    until: S.Option(S.String),
  },
  $I.annote("MakeWeeklyReportProgramOptions", {
    description: "CLI flags for generating a weekly AI metrics scorecard report.",
  })
) {}

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
    dataRoot: yield* resolveDataRoot(dataRoot, target),
    hashSaltSecretRef,
    rawArchiveKeySecretRef,
    target,
  });
  const window = yield* parseWindow({
    since,
    until,
  });
  const result = yield* generateAiMetricsWeeklyReport(
    AiMetricsWeeklyReportInput.make({
      reportDir: path.join(spec.storage.dataRoot, "reports"),
      target,
      windowEndEpochMillis: window.windowEndEpochMillis,
      windowStartEpochMillis: window.windowStartEpochMillis,
    })
  ).pipe(withAiMetricsDuckDb(spec.storage.duckDbPath));

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

class CapturedCommandResult extends S.Class<CapturedCommandResult>($I`CapturedCommandResult`)(
  {
    args: S.Array(S.String),
    command: S.String,
    exitCode: S.Finite,
    stderr: S.String,
    stdout: S.String,
  },
  $I.annote("CapturedCommandResult", {
    description: "Captured process output used by AI metrics mirror shell workflows.",
  })
) {}

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
  const captured = CapturedCommandResult.make({
    args,
    command,
    exitCode: result.exitCode,
    stderr: decodeBytes(result.stderr),
    stdout: decodeBytes(result.stdout),
  });

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
  target,
}: {
  readonly bundle: string;
  readonly dataRoot: O.Option<string>;
  readonly target: AiMetricsDeployTarget;
}) {
  if (bundle !== "latest") {
    return bundle;
  }

  return yield* locateLatestAiMetricsMirrorBundle(yield* resolveDataRoot(dataRoot, target));
});

const readMirrorManifest = Effect.fn("AIMetrics.readMirrorManifest")(function* (manifestPath: string) {
  const fs = yield* FileSystem.FileSystem;
  const content = yield* fs
    .readFileString(manifestPath)
    .pipe(
      Effect.mapError((cause) =>
        AiMetricsCommandError.make({ cause, message: "Failed to read AI metrics mirror manifest JSON." })
      )
    );
  return yield* AiMetricsMirrorBundleManifest.decodeJsonEffect(content).pipe(
    Effect.mapError((cause) =>
      AiMetricsCommandError.make({ cause, message: "Failed to parse AI metrics mirror manifest JSON." })
    )
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
  const path = yield* Path.Path;
  const files = yield* listAiMetricsDirectoryFileInfo(bundleDir).pipe(
    Effect.mapError((error) =>
      AiMetricsCommandError.make({
        cause: error.cause,
        message: Match.value(error.operation).pipe(
          Match.when("inspect", () => "Failed to inspect AI metrics mirror bundle file inventory."),
          Match.when("read", () => "Failed to read AI metrics mirror bundle file inventory."),
          Match.exhaustive
        ),
      })
    )
  );
  return pipe(
    files,
    A.map(([absolutePath]) => pipe(path.relative(bundleDir, absolutePath), Str.replace(/\\/gu, "/"))),
    A.sort(Order.String)
  );
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
      dataRoot: yield* resolveDataRoot(dataRoot, target),
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

class MakeMirrorSyncProgramOpts extends S.Class<MakeMirrorSyncProgramOpts>($I`MakeMirrorSyncProgramOpts`)(
  {
    bundle: S.String,
    confirm: S.Option(S.String),
    dataRoot: S.Option(S.String),
    host: S.String,
    json: S.Boolean,
    remoteRoot: S.String,
    target: AiMetricsDeployTarget,
  },
  $I.annote("MakeMirrorSyncProgramOpts", {
    description: "",
  })
) {}

const requireMirrorSyncConfirmation = Effect.fn("AIMetrics.requireMirrorSyncConfirmation")(function* (
  confirm: O.Option<string>
) {
  if (O.isNone(confirm)) return false;
  if (confirm.value !== p7MirrorConfirmToken) {
    return yield* AiMetricsCommandError.make({
      cause: confirm.value,
      message: `AI metrics mirror sync confirmation must be "${p7MirrorConfirmToken}".`,
    });
  }
  return true;
});

const renderMirrorSyncPlan = Effect.fn("AIMetrics.renderMirrorSyncPlan")(function* (
  json: boolean,
  bundleDir: string,
  remoteRoot: string,
  plannedCommands: ReadonlyArray<string>
) {
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
  if (!json) yield* Effect.forEach(plannedCommands, Console.log, { discard: true });
});

const renderMirrorSyncResult = Effect.fn("AIMetrics.renderMirrorSyncResult")(function* (
  json: boolean,
  bundleDir: string,
  host: string,
  remoteRoot: string,
  results: ReadonlyArray<CapturedCommandResult>
) {
  if (json) {
    yield* Console.log(yield* encodeCommandJson({ bundleDir, dryRun: false, remoteRoot, results, status: "synced" }));
    return;
  }
  yield* Console.log(`ai-metrics mirror sync: synced ${bundleDir} -> ${host}:${remoteRoot}`);
});

const makeMirrorSyncProgram = Effect.fn("AIMetrics.makeMirrorSyncProgram")(function* ({
  bundle,
  confirm,
  dataRoot,
  host,
  json,
  remoteRoot,
  target,
}: MakeMirrorSyncProgramOpts) {
  const bundleDir = yield* resolveMirrorBundleDir({
    bundle,
    dataRoot,
    target,
  });
  yield* validateLocalMirrorBundle({
    bundleDir,
    remoteRoot,
    target,
  });
  const confirmed = yield* requireMirrorSyncConfirmation(confirm);

  const mkdirArgs = [host, `mkdir -p ${shellQuote(remoteRoot)}`];
  const rsyncArgs = ["-az", "--delete", `${bundleDir}/`, `${host}:${remoteRoot}/`];
  const plannedCommands = [commandText("ssh", mkdirArgs), commandText("rsync", rsyncArgs)];

  if (!confirmed) {
    yield* renderMirrorSyncPlan(json, bundleDir, remoteRoot, plannedCommands);
    return;
  }

  const mkdir = yield* runCapturedCommand("ssh", mkdirArgs);
  const rsync = yield* runCapturedCommand("rsync", rsyncArgs);
  yield* renderMirrorSyncResult(json, bundleDir, host, remoteRoot, [mkdir, rsync]);
});

class MakeMirrorStatusProgramParams extends S.Class<MakeMirrorStatusProgramParams>($I`MakeMirrorStatusProgramParams`)(
  {
    host: S.String,
    json: S.Boolean,
    remoteRoot: S.String,
    target: AiMetricsDeployTarget,
  },
  $I.annote("MakeMirrorStatusProgramParams", {
    description: "Parameters for the `ai-metrics mirror status` command.",
  })
) {}

const makeMirrorStatusProgram = Effect.fn("AIMetrics.makeMirrorStatusProgram")(function* ({
  host,
  json,
  remoteRoot,
  target,
}: MakeMirrorStatusProgramParams) {
  const manifestPath = `${remoteRoot}/manifest.json`;
  const captured = yield* runCapturedCommand("ssh", [host, `cat ${shellQuote(manifestPath)}`]);
  const manifest = yield* AiMetricsMirrorBundleManifest.decodeJsonEffect(captured.stdout).pipe(
    Effect.mapError((cause) =>
      AiMetricsCommandError.make({ cause, message: "Failed to parse remote AI metrics mirror manifest JSON." })
    )
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

class ConfirmRetentionMutationParams extends S.Class<ConfirmRetentionMutationParams>(
  $I`ConfirmRetentionMutationParams`
)(
  {
    confirm: S.Option(S.String),
    selector: AiMetricsRetentionSelector,
  },
  $I.annote("ConfirmRetentionMutationParams", {
    description: "Parameters for the `ai-metrics confirm retention mutation` command.",
  })
) {}

const confirmRetentionMutation = Effect.fn("AIMetrics.confirmRetentionMutation")(function* ({
  confirm,
  selector,
}: ConfirmRetentionMutationParams) {
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

class MakeRetentionListProgramParams extends S.Class<MakeRetentionListProgramParams>(
  $I`MakeRetentionListProgramParams`
)(
  {
    before: S.Option(S.String),
    dataRoot: S.Option(S.String),
    json: S.Boolean,
    since: S.Option(S.String),
    until: S.Option(S.String),
  },
  $I.annote("MakeRetentionListProgramParams", {
    description: "Parameters for the `ai-metrics retention list` command.",
  })
) {}

const makeRetentionListProgram = Effect.fn("AIMetrics.makeRetentionListProgram")(function* ({
  before,
  dataRoot,
  json,
  since,
  until,
}: MakeRetentionListProgramParams) {
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

class MakeRetentionMutationProgramParams extends S.Class<MakeRetentionMutationProgramParams>(
  $I`MakeRetentionMutationProgramParams`
)(
  {
    before: S.Option(S.String),
    confirm: S.Option(S.String),
    dataRoot: S.Option(S.String),
    json: S.Boolean,
    mode: AiMetricsRetentionMutationMode,
    since: S.Option(S.String),
    until: S.Option(S.String),
  },
  $I.annote("MakeRetentionMutationProgramParams", {
    description: "Parameters for the `ai-metrics retention mutation` command.",
  })
) {}

const makeRetentionMutationProgram = Effect.fn("AIMetrics.makeRetentionMutationProgram")(function* ({
  before,
  confirm,
  dataRoot,
  json,
  mode,
  since,
  until,
}: MakeRetentionMutationProgramParams) {
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
      // Retention enforce has no `--target` flag; the fallback rung is the
      // workstation's XDG store, matching `parseRetentionSelector`.
      dataRoot: yield* resolveDataRoot(dataRoot, AiMetricsDeployTarget.Enum.local),
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
      hashSalt,
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
    dataRoot: yield* resolveDataRoot(dataRoot, target),
    hashSaltSecretRef,
    rawArchiveKeySecretRef,
    target,
  });
  const rawArchiveKey = yield* resolveRawArchiveKey();
  const result = yield* Effect.gen(function* () {
    const duckdb = yield* DuckDb;
    const rows = yield* duckdb
      .query(`SELECT archive_object_id AS      "archiveObjectId",
                     archive_path AS           "archivePath",
                     plaintext_content_hash AS "plaintextContentHash"
              FROM ai_metrics_raw_archive_objects
              ORDER BY encrypted_at_epoch_ms
                DESC LIMIT 1`)
      .pipe(
        Effect.mapError((cause) =>
          AiMetricsCommandError.make({
            cause,
            message: "Failed to select an AI metrics archive object for the decrypt drill.",
          })
        )
      );
    const decoded = yield* decodeArchiveDrillRows(rows).pipe(
      Effect.mapError((cause) =>
        AiMetricsCommandError.make({ cause, message: "Failed to decode AI metrics archive drill rows." })
      )
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
  }).pipe(withAiMetricsDuckDb(spec.storage.duckDbPath));

  if (json) {
    yield* Console.log(yield* encodeCommandJson(result));
    return;
  }

  yield* Console.log(`ai-metrics archive drill: target=${target}`);
  yield* Console.log(`archive object: ${result.archiveObjectId}`);
  yield* Console.log(`decrypted bytes: ${result.decryptedByteCount}`);
  yield* Console.log(`plaintext hash matches: ${result.plaintextHashMatches}`);
});

export {
  defaultP7MirrorRemoteRoot,
  defaultP7MirrorSshHost,
  ExportForwarderDerivedOtlpOptions,
  ForwarderOtlpExportFailedOptions,
  hasBoundedRetentionMutationWindow,
  hasOrderedRetentionMutationWindow,
  hasRetentionWindow,
  MakeBenchmarkCaseAddProgramOptions,
  MakeBenchmarkCaseListProgramOptions,
  MakeBenchmarkRunProgramOptions,
  MakeCommandInstallInputOptions,
  MakeCommandInstallSpecOptions,
  MakeConfigSnapshotProgramOptions,
  MakeForwarderRunProgramOptions,
  MakeForwarderTimerProgramOptions,
  MakeIngestProgramOptions,
  MakeInstallApplyProgramOptions,
  MakeInstallComposeProgramOptions,
  MakeInstallDoctorProgramOptions,
  MakeInstallPlanProgramOptions,
  MakeInstallPreviewProgramOptions,
  MakeLabelAddProgramOptions,
  MakeLabelQueueProgramOptions,
  MakeOtlpExportProgramOptions,
  MakePrivacyCheckProgramOptions,
  MakeSourcesDiscoverProgramOptions,
  MakeWeeklyReportProgramOptions,
  makeArchiveDrillProgram,
  makeBenchmarkCaseAddProgram,
  makeBenchmarkCaseListProgram,
  makeBenchmarkCompareProgram,
  makeBenchmarkRunProgram,
  makeConfigSnapshotProgram,
  makeForwarderRunProgram,
  makeForwarderTimerProgram,
  makeIngestProgram,
  makeInstallApplyProgram,
  makeInstallComposeProgram,
  makeInstallDoctorProgram,
  makeInstallPlanProgram,
  makeInstallPreviewProgram,
  makeLabelAddProgram,
  makeLabelQueueProgram,
  makeMirrorBuildProgram,
  makeMirrorStatusProgram,
  makeMirrorSyncProgram,
  makeOtlpExportProgram,
  makePrivacyCheckProgram,
  makeRetentionEnforceProgram,
  makeRetentionListProgram,
  makeRetentionMutationProgram,
  makeRetentionRestoreDrillProgram,
  makeSourcesDiscoverProgram,
  makeWeeklyReportProgram,
  ParseRetentionSelectorOptions,
  ParseWindowOptions,
  p7MirrorConfirmToken,
  p7MirrorRawArchiveTable,
  p7MirrorSchemaVersion,
  p7RetentionConfirmToken,
  parseChecks,
  parseEpochMillisOption,
  parseOptionalEpochMillis,
  parseRetentionSelector,
  parseSinceEpochMillis,
  parseWindow,
  RequireHashSaltForTargetOptions,
  RequireHashSaltSecretRefForTargetOptions,
  RequireRawArchiveKeySecretRefForTargetOptions,
  readOptionalConfigString,
  readOptionalRedactedConfigString,
  requireHashSaltForTarget,
  requireHashSaltSecretRefForTarget,
  requireRawArchiveKeySecretRefForTarget,
  resolveDataRoot,
  resolveHashSalt,
  resolveHashSaltSecretRef,
  resolveHomeDir,
  resolveRawArchiveKey,
  resolveRawArchiveKeySecretRef,
  resolveRepoRoot,
};
