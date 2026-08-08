/**
 * AI metrics command suite.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import {
  AiMetricsDeployTarget,
  AiMetricsParquetExportMode,
  AiMetricsQualityGateStatus,
  AiMetricsTool,
  AiMetricsTranscriptSource,
} from "@beep/repo-ai-metrics";
import { pipe } from "effect";
import { Command, Flag } from "effect/unstable/cli";
import { jsonFlag } from "../../internal/cli/Flags.ts";
import { printLines } from "../../internal/cli/Printer.ts";
import { runAiMetricsProgram } from "./AIMetrics.errors.ts";
import { defaultP7MirrorRemoteRoot, defaultP7MirrorSshHost } from "./AIMetrics.schemas.ts";
import { makeForwarderRunProgram, makeForwarderTimerProgram, makeOtlpExportProgram } from "./internal/Forwarder.ts";
import {
  makeConfigSnapshotProgram,
  makeIngestProgram,
  makePrivacyCheckProgram,
  makeSourcesDiscoverProgram,
} from "./internal/Ingest.ts";
import {
  makeInstallApplyProgram,
  makeInstallComposeProgram,
  makeInstallDoctorProgram,
  makeInstallPlanProgram,
  makeInstallPreviewProgram,
} from "./internal/Install.ts";
import { makeMirrorBuildProgram, makeMirrorStatusProgram, makeMirrorSyncProgram } from "./internal/Mirror.ts";
import {
  makeArchiveDrillProgram,
  makeRetentionEnforceProgram,
  makeRetentionListProgram,
  makeRetentionMutationProgram,
  makeRetentionRestoreDrillProgram,
} from "./internal/Retention.ts";
import {
  makeBenchmarkCaseAddProgram,
  makeBenchmarkCaseListProgram,
  makeBenchmarkCompareProgram,
  makeBenchmarkRunProgram,
  makeLabelAddProgram,
  makeLabelQueueProgram,
  makeWeeklyReportProgram,
} from "./internal/Scorecard.ts";

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
    json: jsonFlag,
    otlpBaseUrl: otlpBaseUrlFlag,
    rawArchiveKeySecretRef: rawArchiveKeySecretRefFlag,
    target: targetFlag,
  },
  ({ dataRoot, hashSaltSecretRef, json, otlpBaseUrl, rawArchiveKeySecretRef, target }) =>
    runAiMetricsProgram(
      makeOtlpExportProgram({
        dataRoot,
        hashSaltSecretRef,
        json,
        otlpBaseUrl,
        rawArchiveKeySecretRef,
        target,
      })
    )
).pipe(Command.withDescription("Export redacted derived AI metrics spans through OTLP"));

const otlpCommand = Command.make("otlp", {}, () =>
  printLines(["AI metrics OTLP commands:", "- bun run beep ai-metrics otlp export --target local"])
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
 * import { Command } from "effect/unstable/cli"
 * import { Effect } from "effect"
 *
 * const run = Command.run(aiMetricsCommand, { version: "0.0.0" })
 * console.log(Effect.isEffect(run)) // true
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
