/**
 * Yeet quality feedback and commit/push command.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { findRepoRoot } from "@beep/repo-utils";
import { Fn, LiteralKit, SchemaUtils } from "@beep/schema";
import { UUID } from "@beep/schema/String";
import { O } from "@beep/utils";
import { ConfigProvider, Console, DateTime, Duration, Effect, Match, Path, pipe } from "effect";
import * as A from "effect/Array";
import { Argument, Command, Flag } from "effect/cli";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { configStringOption } from "../../internal/cli/EnvConfig.ts";
import { yeetStateRootEnvVar, yeetStateRootFlag } from "../../internal/cli/Flags.ts";
import { readContainedFileStringNoFollow } from "../../internal/cli/FsGuards.ts";
import { processStartIdentityForPid } from "../../internal/repo-run/ProcessIdentity.ts";
import { runRepoCommandCapture } from "../../internal/repo-run/RepoRun.executor.ts";
import { WorktreeRemovalServiceLive } from "../Worktree/Worktree.service.ts";
import { writeYeetAckReceipt, YeetAckObservedResolution, YeetAckReceipt } from "./internal/Ack.ts";
import { runYeetEconomicsCommand } from "./internal/Economics.ts";
import {
  runYeetFallowFeedback,
  runYeetFallowFixtureCheck,
  runYeetPlanContractCheck,
} from "./internal/FallowFeedback.ts";
import { validateProofJobDetach } from "./internal/Guards.ts";
import { runYeet } from "./internal/Handler.ts";
import { YeetInboxSeverity, yeetProofJobRowId } from "./internal/Inbox.ts";
import { runYeetInboxAck, runYeetInboxAppend, runYeetInboxList } from "./internal/InboxPorcelain.ts";
import { renderYeetPrWaveLine } from "./internal/InboxView.ts";
import { YEET_SETTLE_TIMEOUT_DEFAULT_MILLIS, YeetUntilReadyPolicy } from "./internal/MonitorPolicy.ts";
import { DEFAULT_YEET_PACKET_DIR, YeetProofTier } from "./internal/Planner.ts";
import {
  rejectYeetUntilEventPairing,
  rejectYeetUntilReadyPairing,
  runYeetMerge,
  runYeetMergeLoop,
  runYeetReplyPass,
  runYeetSweep,
  runYeetWatchLoop,
} from "./internal/Porcelain.ts";
import {
  isSettledProofJob,
  isTerminalProofJobPhase,
  ProofJobExitCode,
  ProofJobRecord,
  ProofJobRequest,
  ProofJobServiceResult,
  ProofJobSubmission,
  ProofJobSubmitter,
  ProofJobSystemdResult,
  ProofJobWaitOptions,
  ProofJobWaitOutcome,
  proofJobSettledWaitOutcome,
  proofJobUnitName,
  proofJobWaitExitFor,
} from "./internal/ProofJob.ts";
import { ProofJobLauncher, ProofJobWaitResult, reportProofJobCommand } from "./internal/ProofJobLauncher.ts";
import { runYeetProofReportCommand } from "./internal/ProofShadow.ts";
import { PositiveInt, ResumeOptions } from "./internal/Resume.schemas.ts";
import { parsePrRef, runYeetResume } from "./internal/Resume.ts";
import { YeetCommandError } from "./Yeet.errors.ts";
import { YeetRunOptions } from "./Yeet.schemas.ts";
import type { YeetRunMode } from "./internal/Planner.ts";
import type { ProofJobLauncherShape } from "./internal/ProofJobLauncher.ts";

const $I = $RepoCliId.create("commands/Yeet/Yeet.command");
const decodeOptionalPositiveInt = S.decodeEffect(S.Option(PositiveInt));

const baseFlag = Flag.String("base").pipe(
  Flag.withDescription("Base ref for affected feedback planning"),
  Flag.withDefault("origin/main")
);

const retireFlag = Flag.Boolean("retire").pipe(
  Flag.withDefault(false),
  Flag.withDescription(
    "Inside a linked worktree whose PR is MERGED: archive-retire this worktree into its owning clone, delete the branch, then sweep the clone"
  )
);

const laneFlag = Flag.String("lane").pipe(
  Flag.optional,
  Flag.withDescription(
    "With --retire: the linked worktree to retire when the command runs from its owning clone (default: the worktree the command runs in)"
  )
);

const branchFlag = Flag.String("branch").pipe(
  Flag.withDescription("Sweep this branch instead of the checked-out one, so a second pass can finish a merged branch"),
  Flag.withDefault("")
);

const headFlag = Flag.String("head").pipe(
  Flag.withDescription("Head ref for affected feedback planning"),
  Flag.withDefault("HEAD")
);

const jsonFlag = Flag.Boolean("json").pipe(Flag.withDefault(false), Flag.withDescription("Render plan output as JSON"));

const resumeListFlag = Flag.Boolean("list").pipe(
  Flag.withDefault(false),
  Flag.withDescription("List every locally recorded agent for the pull request")
);
const resumePrintFlag = Flag.Boolean("print").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Print the resolved local command without executing it")
);
const resumeForceFlag = Flag.Boolean("force").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Resume even when the recorded Claude session is already live")
);
const resumeAgentFlag = Flag.Int("agent").pipe(
  Flag.optional,
  Flag.withDescription("Select a one-based agent from the newest-first ledger")
);

const provideYeetStateRoot = Effect.fn("Yeet.provideStateRoot")(function* <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  stateRoot: O.Option<string>
) {
  return yield* O.match(stateRoot, {
    onNone: () => effect,
    onSome: (root) =>
      Effect.flatMap(ConfigProvider.ConfigProvider, (current) =>
        effect.pipe(
          Effect.provideService(
            ConfigProvider.ConfigProvider,
            ConfigProvider.orElse(ConfigProvider.fromUnknown({ [yeetStateRootEnvVar]: root }), current)
          )
        )
      ),
  });
});

const packetDirFlag = Flag.String("packet-dir").pipe(
  Flag.withDescription("Ignored directory for yeet run context, logs, and packets"),
  Flag.withDefault(DEFAULT_YEET_PACKET_DIR)
);

const planFlag = Flag.Boolean("plan").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Print the yeet plan without running commands")
);

const messageFlag = Flag.String("message").pipe(
  Flag.withDescription("Conventional commit message required before publish"),
  Flag.withDefault("")
);

const fastFlag = Flag.Boolean("fast").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Skip local full pre-push proof only when paired with --monitor on a PR branch")
);

const startPrEarlyFlag = Flag.Boolean("start-pr-early").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Push with hooks skipped before full local proof, then run proof and monitor hosted checks")
);

const monitorFlag = Flag.Boolean("monitor").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Monitor hosted PR checks after publish instead of stopping at push")
);

const untilReadyFlag = Flag.Boolean("until-ready").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Settle required checks and run read-first closeout, then exit when merge-ready")
);

const untilMergedFlag = Flag.Boolean("until-merged").pipe(
  Flag.withDefault(false),
  Flag.withDescription(
    "Keep monitoring across pushes until the PR merges or closes, rerunning known-flake jobs once per job per head SHA and sweeping the clone on merge"
  )
);

const summaryFlag = Flag.Boolean("summary").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Print a compact operator summary after monitor or closeout reads")
);

const remoteFlag = Flag.Boolean("remote").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Include live GitHub PR and check data in yeet status")
);

const tierFlag = Flag.ChoiceWithValue("tier", [
  ["full", "full"],
  ["cheap-gates", "cheap-gates"],
  ["review-fix", "review-fix"],
]).pipe(
  Flag.withDescription("Local proof tier for verify; publish always uses full"),
  Flag.withDefault("full" as const)
);

const mergedFlag = Flag.Boolean("merged").pipe(
  Flag.withDefault(false),
  Flag.withDescription(
    "Prove the merge preview of HEAD with the base ref — the tree hosted CI runs — instead of the branch tree"
  )
);

const ciParityFlag = Flag.Boolean("ci-parity").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Run the exact affected CI battery in an installed merge-preview worktree")
);

const collectAllFlag = Flag.Boolean("collect-all").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Run every local preflight wave after failures instead of stopping before later waves")
);

const noFailFastFlag = Flag.Boolean("no-fail-fast").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Keep launching local gates after a precise red to collect the full diagnostic picture")
);

const amendFlag = Flag.Boolean("amend").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Amend the current local commit during publish")
);

const stagedOnlyFlag = Flag.Boolean("staged-only").pipe(
  Flag.withDefault(false),
  Flag.withDescription(
    "Publish exactly the staged index: stash unstaged/untracked residue after commit, prove the clean tree, restore after push"
  )
);

const allowStaleBaseFlag = Flag.Boolean("allow-stale-base").pipe(
  Flag.withDefault(false),
  Flag.withDescription(
    "Proceed with publish even when branch files overlap commits landed on the base since merge-base"
  )
);

const prFlag = Flag.Boolean("pr").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Create a ready (non-draft) pull request after the push succeeds, unless one is already open")
);

const noEditFlag = Flag.Boolean("no-edit").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Reuse the current commit message with --amend during publish")
);

const reuseVerifiedFlag = Flag.Boolean("reuse-verified").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Skip publish proof only when durable Yeet full-proof state exactly matches")
);

const pushOnlyFlag = Flag.Boolean("push-only").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Push an already-verified clean commit without committing or rerunning local proof")
);

const botsFlag = Flag.String("bots").pipe(
  Flag.withDescription(
    "Comma-separated PR review bots to classify and gate during closeout (default greptile; pass greptile,coderabbit,chatgpt to restore the legacy lineup)"
  ),
  Flag.withDefault("greptile")
);

const requireGreptileScoreFlag = Flag.String("require-greptile-score").pipe(
  Flag.withDescription("Required Greptile score, for example 5/5; empty disables the gate"),
  Flag.withDefault("")
);

const requireGreptileIssuesFlag = Flag.Int("require-greptile-issues").pipe(
  Flag.withDescription("Required Greptile open issue count; negative disables the gate"),
  Flag.withDefault(-1)
);

const requireReviewCommentsFlag = Flag.Int("require-review-comments").pipe(
  Flag.withDescription("Required unresolved actionable PR review comment count; negative disables the gate"),
  Flag.withDefault(-1)
);

const replyThreadFlag = Flag.String("reply-thread").pipe(
  Flag.withDescription("Review thread id to reply to during closeout; requires --reply-body"),
  Flag.withDefault("")
);

const replyBodyFlag = Flag.String("reply-body").pipe(
  Flag.withDescription("Reply body posted to --reply-thread during closeout"),
  Flag.withDefault("")
);

const resolveThreadsFlag = Flag.String("resolve-threads").pipe(
  Flag.withDescription("Comma-separated review thread ids to resolve during closeout"),
  Flag.withDefault("")
);

const retriggerGreptileFlag = Flag.Boolean("retrigger-greptile").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Post the explicit Greptile retrigger comment after reading current PR state")
);

const fallowFromFlag = Flag.String("from").pipe(
  Flag.withDescription("Directory containing Fallow advisory envelopes"),
  Flag.withDefault(".beep/fallow")
);

const fallowEmitFlag = Flag.String("emit").pipe(
  Flag.withDescription("QualityIssueIndex output path for Fallow advisory feedback"),
  Flag.withDefault(".beep/yeet/fallow-quality-issues.json")
);

const fallowAdvisoryFlag = Flag.Boolean("advisory").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Keep every Fallow-derived Yeet issue nonblocking")
);

const fallowRunStartedAtFlag = Flag.String("run-started-at").pipe(
  Flag.withDescription("Reject advisory envelopes generated before this Yeet run timestamp"),
  Flag.withDefault("")
);

const fallowAssertFlag = Flag.String("assert").pipe(
  Flag.withDescription("Comma-separated fixture assertions to enforce"),
  Flag.withDefault("")
);

const fromStdinFlag = Flag.Boolean("from-stdin").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Read a Yeet plan JSON document from stdin")
);

const expectStepIdFlag = Flag.String("expect-step-id").pipe(
  Flag.withDescription("Required plan step id"),
  Flag.withDefault("")
);

const expectStepLabelFlag = Flag.String("expect-step-label").pipe(
  Flag.withDescription("Required plan step label"),
  Flag.withDefault("")
);

const expectCommandFlag = Flag.String("expect-command").pipe(
  Flag.withDescription("Required plan step command"),
  Flag.withDefault("")
);

const expectArgsFlag = Flag.String("expect-args").pipe(
  Flag.withDescription("Required plan step args rendered as a space-separated string"),
  Flag.withDefault("")
);

const inboxUnackedFlag = Flag.Boolean("unacked").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Show only rows without an ack receipt")
);

const inboxSeverityFlagChoices: ReadonlyArray<readonly ["all" | YeetInboxSeverity, "all" | YeetInboxSeverity]> = [
  ["all", "all"],
  ...A.map(YeetInboxSeverity.Options, (tier) => [tier, tier] as const),
];

const inboxSeverityFlag = Flag.ChoiceWithValue("severity", inboxSeverityFlagChoices).pipe(
  Flag.withDescription("Show only rows of this severity tier"),
  Flag.withDefault("all" as const)
);

const inboxFixShaFlag = Flag.String("fix-sha").pipe(
  Flag.withDescription("Acknowledge the row as fixed by this commit"),
  Flag.withDefault("")
);

const inboxEnvironmentOnlyFlag = Flag.Boolean("environment-only").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Acknowledge the row as environmental rather than a repository-code defect; requires --reason")
);

const inboxWontfixFlag = Flag.Boolean("wontfix").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Acknowledge the row as deliberately not fixed; requires --reason")
);

const inboxReasonFlag = Flag.String("reason").pipe(
  Flag.withDescription("Why an environment-only, wontfix, or waiver resolution applies"),
  Flag.withDefault("")
);

const inboxThreadUrlFlag = Flag.String("thread-url").pipe(
  Flag.withDescription("Acknowledge the row as continued in this review thread"),
  Flag.withDefault("")
);

const inboxWaiveFlag = Flag.Boolean("waive").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Temporarily waive the row; requires actor, shard, reason, and expiry")
);

const inboxActorFlag = Flag.String("actor").pipe(
  Flag.withDescription("Actor accountable for an expiring waiver"),
  Flag.withDefault("")
);

const inboxExpiresAtFlag = Flag.String("expires-at").pipe(
  Flag.withDescription("ISO timestamp after which a waiver stops acknowledging the row"),
  Flag.withDefault("")
);

const inboxShardFlag = Flag.String("shard").pipe(
  Flag.withDescription("Named local shard or required context covered by a waiver"),
  Flag.withDefault("")
);

const inboxRowStdinFlag = Flag.Boolean("from-stdin").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Read one inbox row JSON document from stdin")
);

const inboxAckIdArgument = Argument.String("id").pipe(
  Argument.withDescription("Inbox row id to acknowledge, as printed by yeet inbox list")
);

const inboxListFlags = {
  json: jsonFlag,
  severity: inboxSeverityFlag,
  unacked: inboxUnackedFlag,
} as const;

const sharedFlags = {
  base: baseFlag,
  collectAll: collectAllFlag,
  head: headFlag,
  json: jsonFlag,
  noFailFast: noFailFastFlag,
  packetDir: packetDirFlag,
  plan: planFlag,
  tier: tierFlag,
} as const;

const detachedFlags = {
  detach: Flag.Boolean("detach").pipe(
    Flag.withDefault(false),
    Flag.withDescription("Submit a durable systemd proof job")
  ),
  jobMaxRuntime: Flag.String("job-max-runtime").pipe(
    Flag.withDefault(""),
    Flag.withDescription("Detached job runtime ceiling, for example '1 hour'")
  ),
};

const verifyFlags = {
  ...detachedFlags,
  ...sharedFlags,
  ciParity: ciParityFlag,
  merged: mergedFlag,
} as const;

const publishFlags = {
  ...detachedFlags,
  ...sharedFlags,
  allowStaleBase: allowStaleBaseFlag,
  amend: amendFlag,
  fast: fastFlag,
  message: messageFlag,
  monitor: monitorFlag,
  noEdit: noEditFlag,
  pr: prFlag,
  pushOnly: pushOnlyFlag,
  reuseVerified: reuseVerifiedFlag,
  stagedOnly: stagedOnlyFlag,
  stateRoot: yeetStateRootFlag,
  startPrEarly: startPrEarlyFlag,
  summary: summaryFlag,
} as const;

const watchFlag = Flag.Boolean("watch").pipe(
  Flag.withDefault(false),
  Flag.withDescription(
    "Stream one NDJSON row per PR state transition until the PR settles, instead of the blocking check watch"
  )
);

const untilEventFlag = Flag.Boolean("until-event").pipe(
  Flag.withDefault(false),
  Flag.withDescription(
    "With --watch: exit on the first actionable event batch (a failing check immediately, new PR comments after a short settle window) so a supervising session is woken the moment there is something to act on"
  )
);

const settleTimeoutFlag = Flag.String("settle-timeout").pipe(
  Flag.withDefault(""),
  Flag.withDescription("Maximum wait for required checks to register and settle (default 30 minutes; loop modes only)")
);

const decodeDurationFromString = S.decodeEffect(S.DurationFromString);
const decodePositiveMillis = S.decodeEffect(S.Finite.pipe(S.check(S.isGreaterThan(0))));

/**
 * Decode a positive finite monitor duration, accepting compact units.
 *
 * **Details**
 *
 * An empty flag selects the thirty-minute default. Compact seconds, minutes,
 * and hours normalize before the Effect duration codec decodes them.
 *
 * **Example** (Decode thirty minutes)
 *
 * ```ts
 * import { yeetMonitorDurationMillis } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 *
 * const program = yeetMonitorDurationMillis("30m")
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param value - Duration flag text.
 * @returns Positive finite milliseconds, or a typed command error.
 * @category codecs
 * @since 0.0.0
 */
export const yeetMonitorDurationMillis = Effect.fn("Yeet.monitorDurationMillis")(
  function* (value: string) {
    const text = Str.trim(value);
    if (Str.isEmpty(text)) return YEET_SETTLE_TIMEOUT_DEFAULT_MILLIS;
    const normalized = pipe(
      text,
      Str.replace(/^([0-9]+(?:\.[0-9]+)?)s$/u, "$1 seconds"),
      Str.replace(/^([0-9]+(?:\.[0-9]+)?)m$/u, "$1 minutes"),
      Str.replace(/^([0-9]+(?:\.[0-9]+)?)h$/u, "$1 hours")
    );
    const duration = yield* decodeDurationFromString(normalized);
    const millis = Duration.toMillis(duration);
    return yield* decodePositiveMillis(millis);
  },
  Effect.mapError(YeetCommandError.new("--settle-timeout requires a positive finite duration."))
);

const monitorFlags = {
  ...detachedFlags,
  ...sharedFlags,
  summary: summaryFlag,
  stateRoot: yeetStateRootFlag,
  settleTimeout: settleTimeoutFlag,
  untilEvent: untilEventFlag,
  untilMerged: untilMergedFlag,
  untilReady: untilReadyFlag,
  watch: watchFlag,
} as const;

const porcelainFlags = {
  base: baseFlag,
  head: headFlag,
  packetDir: packetDirFlag,
} as const;

const sweepFlags = {
  ...porcelainFlags,
  branch: branchFlag,
  json: jsonFlag,
  lane: laneFlag,
  plan: planFlag,
  retire: retireFlag,
} as const;

const closeoutFlags = {
  ...detachedFlags,
  ...sharedFlags,
  bots: botsFlag,
  replyBody: replyBodyFlag,
  replyThread: replyThreadFlag,
  requireGreptileIssues: requireGreptileIssuesFlag,
  requireGreptileScore: requireGreptileScoreFlag,
  requireReviewComments: requireReviewCommentsFlag,
  resolveThreads: resolveThreadsFlag,
  retriggerGreptile: retriggerGreptileFlag,
  summary: summaryFlag,
} as const;

const statusFlags = {
  ...sharedFlags,
  remote: remoteFlag,
} as const;

class SharedOptions extends S.Class<SharedOptions>($I`SharedOptions`)(
  {
    detach: S.Boolean.pipe(SchemaUtils.withKeyDefaults(false)),
    jobMaxRuntime: S.String.pipe(SchemaUtils.withKeyDefaults("")),
    allowStaleBase: S.Boolean.pipe(SchemaUtils.withKeyDefaults(false)),
    amend: S.Boolean.pipe(SchemaUtils.withKeyDefaults(false)),
    base: S.String,
    bots: S.String.pipe(SchemaUtils.withKeyDefaults("greptile")),
    ciParity: S.Boolean.pipe(SchemaUtils.withKeyDefaults(false)),
    collectAll: S.Boolean.pipe(SchemaUtils.withKeyDefaults(false)),
    fast: S.Boolean.pipe(SchemaUtils.withKeyDefaults(false)),
    head: S.String,
    json: S.Boolean,
    merged: S.Boolean.pipe(SchemaUtils.withKeyDefaults(false)),
    monitor: S.Boolean.pipe(SchemaUtils.withKeyDefaults(false)),
    noFailFast: S.Boolean.pipe(SchemaUtils.withKeyDefaults(false)),
    noEdit: S.Boolean.pipe(SchemaUtils.withKeyDefaults(false)),
    packetDir: S.String,
    plan: S.Boolean,
    pr: S.Boolean.pipe(SchemaUtils.withKeyDefaults(false)),
    pushOnly: S.Boolean.pipe(SchemaUtils.withKeyDefaults(false)),
    remote: S.Boolean.pipe(SchemaUtils.withKeyDefaults(false)),
    replyBody: S.String.pipe(SchemaUtils.withKeyDefaults("")),
    replyThread: S.String.pipe(SchemaUtils.withKeyDefaults("")),
    requireGreptileIssues: S.optionalKey(S.Finite),
    requireGreptileScore: S.String.pipe(SchemaUtils.withKeyDefaults("")),
    requireReviewComments: S.optionalKey(S.Finite),
    resolveThreads: S.String.pipe(SchemaUtils.withKeyDefaults("")),
    retriggerGreptile: S.Boolean.pipe(SchemaUtils.withKeyDefaults(false)),
    reuseVerified: S.Boolean.pipe(SchemaUtils.withKeyDefaults(false)),
    stagedOnly: S.Boolean.pipe(SchemaUtils.withKeyDefaults(false)),
    startPrEarly: S.Boolean.pipe(SchemaUtils.withKeyDefaults(false)),
    summary: S.Boolean.pipe(SchemaUtils.withKeyDefaults(false)),
    tier: YeetProofTier.pipe(SchemaUtils.withKeyDefaults("full")),
  },
  $I.annote("SharedOptions", {
    description: "CLI option bag shared by Yeet commands before handler defaults are applied.",
  })
) {}
type SharedOptionsInput = (typeof SharedOptions)["~type.make.in"];

const runYeetMode = (mode: YeetRunMode, options: SharedOptionsInput & { readonly message?: string }) => {
  const sharedOptions = SharedOptions.make(options);
  if (sharedOptions.detach) return submitDetachedProofJob(mode, sharedOptions);
  if (Str.isNonEmpty(sharedOptions.jobMaxRuntime))
    return Effect.fail(YeetCommandError.make({ message: "--job-max-runtime requires --detach." }));

  return runYeet(
    YeetRunOptions.make({
      ...sharedOptions,
      allowStaleBase: sharedOptions.allowStaleBase,
      amend: sharedOptions.amend,
      bots: sharedOptions.bots,
      ciParity: sharedOptions.ciParity,
      collectAll: sharedOptions.collectAll || sharedOptions.noFailFast,
      fast: sharedOptions.fast,
      merged: sharedOptions.merged,
      message: options.message ?? "",
      mode,
      monitor: sharedOptions.monitor,
      noEdit: sharedOptions.noEdit,
      pr: sharedOptions.pr,
      pushOnly: sharedOptions.pushOnly,
      remote: sharedOptions.remote,
      replyBody: sharedOptions.replyBody,
      replyThread: sharedOptions.replyThread,
      requireGreptileIssues: sharedOptions.requireGreptileIssues ?? -1,
      requireGreptileScore: sharedOptions.requireGreptileScore,
      requireReviewComments: sharedOptions.requireReviewComments ?? -1,
      resolveThreads: sharedOptions.resolveThreads,
      retriggerGreptile: sharedOptions.retriggerGreptile,
      reuseVerified: sharedOptions.reuseVerified,
      stagedOnly: sharedOptions.stagedOnly,
      startPrEarly: sharedOptions.startPrEarly,
      summary: sharedOptions.summary,
      tier: sharedOptions.tier,
    })
  ).pipe(Effect.asVoid);
};

const jobIdArgument = Argument.String("jobId").pipe(Argument.withSchema(UUID));
const decodeDuration = S.decodeEffect(S.DurationFromString);
const encodeProofJobRecordJson = S.encodeEffect(S.fromJsonString(ProofJobRecord));
const encodeProofJobListJson = S.encodeEffect(ProofJobRecord.pipe(S.Array, S.fromJsonString));
const encodeProofJobStatusJson = S.encodeEffect(
  S.fromJsonString(S.Struct({ record: ProofJobRecord, telemetry: S.NullOr(S.String) }))
);
const isPositiveFiniteDuration = S.is(S.Finite.check(S.isGreaterThan(0)));
const decodeServiceResultOption = S.decodeUnknownOption(ProofJobServiceResult);
const decodeExitCodeOption = S.decodeUnknownOption(ProofJobExitCode);
const durationMillis = Effect.fn("Yeet.jobDuration")(function* (text: string) {
  const normalized = pipe(
    text,
    Str.replace(/^(\d+(?:\.\d+)?)\s*ms$/u, "$1 millis"),
    Str.replace(/^(\d+(?:\.\d+)?)\s*s$/u, "$1 seconds"),
    Str.replace(/^(\d+(?:\.\d+)?)\s*m$/u, "$1 minutes"),
    Str.replace(/^(\d+(?:\.\d+)?)\s*h$/u, "$1 hours"),
    Str.replace(/^(\d+(?:\.\d+)?)\s*d$/u, "$1 days")
  );
  const duration = yield* decodeDuration(normalized).pipe(
    Effect.mapError(YeetCommandError.new("Expected a duration such as '30 seconds'."))
  );
  const millis = Duration.toMillis(duration);
  if (!isPositiveFiniteDuration(millis))
    return yield* YeetCommandError.make({ message: "Job duration must be positive and finite." });
  return millis;
});
const jobRoot = () => findRepoRoot().pipe(Effect.mapError(YeetCommandError.new("Failed to locate job checkout.")));
const renderJob = Effect.fn("Yeet.renderJob")(function* (record: ProofJobRecord, json: boolean) {
  if (json) {
    yield* Console.log(
      yield* encodeProofJobRecordJson(record).pipe(
        Effect.mapError(YeetCommandError.new("Failed to encode job record."))
      )
    );
    return;
  }
  yield* Console.log(
    `job ${record.jobId}: ${record.phase}\nunit: ${record.unit.unitName}\nlog: ${record.unit.logPath}\nbun run beep yeet job wait ${record.jobId}`
  );
});
const submitDetachedProofJob = Effect.fn("Yeet.submitDetached")(function* (mode: YeetRunMode, options: SharedOptions) {
  yield* validateProofJobDetach(options.plan);
  const root = yield* jobRoot();
  const path = yield* Path.Path;
  const git = Effect.fnUntraced(function* (args: ReadonlyArray<string>) {
    const result = yield* runRepoCommandCapture(
      "git",
      args,
      root,
      O.getSomesStruct({ PATH: yield* configStringOption("PATH") })
    ).pipe(Effect.mapError(YeetCommandError.new("Failed to read detached job git coordinates.")));
    if (result.exitCode !== 0) return yield* YeetCommandError.make({ message: result.output });
    return Str.trim(result.output);
  });
  const branch = yield* git(["rev-parse", "--abbrev-ref", "HEAD"]);
  const head = yield* git(["rev-parse", "--verify", options.head]);
  const entrypoint = O.fromUndefinedOr(process.argv[1]);
  if (O.isNone(entrypoint)) return yield* YeetCommandError.make({ message: "Cannot detach without a CLI entrypoint." });
  const words = A.dropWhile(A.drop(process.argv, 2), (word) => word === "--");
  if (A.head(words).pipe(O.getOrElse(() => "")) !== "yeet")
    return yield* YeetCommandError.make({ message: "Cannot detach: original argv must begin with yeet." });
  const maxRuntimeSeconds = Str.isEmpty(options.jobMaxRuntime)
    ? O.none<number>()
    : O.some(Math.ceil((yield* durationMillis(options.jobMaxRuntime)) / 1000));
  const launcher = yield* ProofJobLauncher.make(root);
  const record = yield* launcher.submit(
    ProofJobSubmission.make({
      request: ProofJobRequest.make({
        mode,
        argv: A.drop(words, 1),
        checkout: root,
        branch,
        base: options.base,
        head,
        forwardedEnvNames: [],
      }),
      submitter: ProofJobSubmitter.make({
        pid: process.pid,
        cwd: process.cwd(),
        procStart: yield* processStartIdentityForPid(process.pid),
      }),
      execPath: process.execPath,
      entrypoint: path.resolve(process.cwd(), entrypoint.value),
      maxRuntimeSeconds,
    })
  );
  yield* renderJob(record, options.json);
});
const requireJob = Effect.fn("Yeet.requireJob")(function* (launcher: ProofJobLauncherShape, id: UUID) {
  const result = yield* launcher.read(id);
  if (O.isNone(result)) return yield* YeetCommandError.make({ message: `Unknown proof job ${id}.` });
  return result.value;
});
const jobListCommand = Command.make(
  "list",
  { json: jsonFlag },
  Effect.fn("Yeet.jobList")(function* (options) {
    const launcher = yield* ProofJobLauncher.make(yield* jobRoot());
    const records = yield* launcher.list;
    if (options.json) {
      yield* Console.log(
        yield* encodeProofJobListJson(records).pipe(Effect.mapError(YeetCommandError.new("Failed to encode jobs.")))
      );
    } else for (const record of records) yield* renderJob(record, false);
  })
);
const jobStatusCommand = Command.make(
  "status",
  { jobId: jobIdArgument, json: jsonFlag, ack: Flag.Boolean("ack").pipe(Flag.withDefault(false)) },
  Effect.fn("Yeet.jobStatus")(function* (options) {
    const root = yield* jobRoot();
    const launcher = yield* ProofJobLauncher.make(root);
    const record = yield* requireJob(launcher, options.jobId);
    const live = isTerminalProofJobPhase(record.phase)
      ? O.none<string>()
      : yield* runRepoCommandCapture(
          "systemctl",
          ["--user", "show", record.unit.unitName, "-p", "ActiveState,SubState,MainPID,MemoryPeak"],
          root,
          O.getSomesStruct({ PATH: yield* configStringOption("PATH") })
        ).pipe(
          Effect.mapError(YeetCommandError.new("Failed to read job telemetry.")),
          Effect.map((result) => (result.exitCode === 0 ? O.some(result.output) : O.none<string>()))
        );
    if (options.json) {
      yield* Console.log(
        yield* encodeProofJobStatusJson({ record, telemetry: O.getOrNull(live) }).pipe(
          Effect.mapError(YeetCommandError.new("Failed to encode job status."))
        )
      );
    } else {
      yield* renderJob(record, false);
      if (!isTerminalProofJobPhase(record.phase)) yield* Console.log(O.getOrElse(live, () => "unit not loaded"));
    }
    if (options.ack && isSettledProofJob(record)) {
      yield* writeYeetAckReceipt(
        root,
        YeetAckReceipt.make({
          id: yeetProofJobRowId(record),
          ackedAt: yield* DateTime.now.pipe(Effect.map(DateTime.formatIso)),
          resolution: YeetAckObservedResolution.make({ via: "job-status" }),
        })
      );
    }
  })
);
const jobWaitCommand = Command.make(
  "wait",
  { jobId: jobIdArgument, json: jsonFlag, timeout: Flag.String("timeout").pipe(Flag.withDefault("")) },
  Effect.fn("Yeet.jobWait")(function* (options) {
    const launcher = yield* ProofJobLauncher.make(yield* jobRoot());
    const timeoutMs = Str.isEmpty(options.timeout) ? O.none<number>() : O.some(yield* durationMillis(options.timeout));
    const result = yield* launcher.wait(options.jobId, ProofJobWaitOptions.make({ timeoutMs }));
    yield* renderJob(result.record, options.json);
    const outcome = ProofJobWaitResult.match(result, {
      settled: ({ record }) => Effect.succeed(proofJobSettledWaitOutcome(record)),
      // The wave rows stay unacknowledged; the gate line names them and the
      // re-run. JSON mode keeps stdout the record, so the line goes to stderr.
      wave: ({ record, wave }) => {
        const line = renderYeetPrWaveLine(wave, "job-wait", `bun run beep yeet job wait ${record.jobId}`);
        return (options.json ? Console.error(line) : Console.log(line)).pipe(Effect.as(ProofJobWaitOutcome.Enum.wave));
      },
    });
    const exit = proofJobWaitExitFor(yield* outcome);
    if (exit.exitCode !== 0)
      return yield* YeetCommandError.make({
        message: `Proof job ${result.record.jobId}: ${exit.summary}.`,
        exitCode: exit.exitCode,
      });
  })
);
const jobLogsCommand = Command.make(
  "logs",
  { jobId: jobIdArgument, tail: Flag.Int("tail").pipe(Flag.withDefault(100)) },
  Effect.fn("Yeet.jobLogs")(function* (options) {
    if (options.tail < 0) return yield* YeetCommandError.make({ message: "--tail must be nonnegative." });
    const root = yield* jobRoot();
    const record = yield* requireJob(yield* ProofJobLauncher.make(root), options.jobId);
    const read = yield* readContainedFileStringNoFollow(root, record.unit.logPath).pipe(
      Effect.mapError(YeetCommandError.new("Failed to read job log."))
    );
    const text = O.getOrElse(read.contents, () => "");
    const lines = Str.endsWith("\n")(text) ? A.dropRight(Str.split(text, "\n"), 1) : Str.split(text, "\n");
    yield* Console.log(A.join(A.takeRight(lines, options.tail), "\n"));
  })
);
const jobCancelCommand = Command.make(
  "cancel",
  { jobId: jobIdArgument },
  Effect.fn("Yeet.jobCancel")(function* (options) {
    const launcher = yield* ProofJobLauncher.make(yield* jobRoot());
    const outcome = yield* launcher.cancel(options.jobId);
    yield* Console.log(outcome);
    if (outcome === "stop-failed")
      return yield* YeetCommandError.make({ message: "systemctl could not stop the job." });
  })
);
/**
 * Fence accidental finalization by same-user processes; these environment
 * checks are an accident fence, not an authorization boundary.
 */
const jobFinalizeCommand = Command.make(
  "finalize",
  { jobId: jobIdArgument },
  Effect.fn("Yeet.jobFinalize")(function* (options) {
    for (const [name, expected] of [
      ["BEEP_YEET_JOB_ID", options.jobId],
      ["BEEP_YEET_JOB_UNIT", proofJobUnitName(options.jobId)],
    ] as const) {
      if (!O.contains(yield* configStringOption(name), expected))
        return yield* YeetCommandError.make({ message: `${name} does not match the proof job.` });
    }
    const launcher = yield* ProofJobLauncher.make(yield* jobRoot());
    const record = yield* requireJob(launcher, options.jobId);
    const invocationId = yield* configStringOption("INVOCATION_ID");
    if (
      O.isSome(record.unit.invocationId) &&
      O.isSome(invocationId) &&
      record.unit.invocationId.value !== invocationId.value
    )
      return yield* YeetCommandError.make({ message: "INVOCATION_ID does not match the proof job." });
    const serviceResult = yield* configStringOption("SERVICE_RESULT");
    const exitCode = yield* configStringOption("EXIT_CODE");
    const result = ProofJobSystemdResult.make({
      serviceResult: O.getOrElse(O.flatMap(serviceResult, decodeServiceResultOption), () => "unknown"),
      exitCode: O.flatMap(exitCode, decodeExitCodeOption),
      exitStatus: yield* configStringOption("EXIT_STATUS"),
      invocationId,
      finalizedAt: yield* DateTime.now.pipe(Effect.map(DateTime.formatIso)),
    });
    yield* launcher.finalize(options.jobId, result);
  })
).pipe(Command.unlisted);
const yeetJobCommand = Command.make("job").pipe(
  Command.withDescription("Observe and manage durable detached proof jobs"),
  Command.withSubcommands([
    jobListCommand,
    jobStatusCommand,
    jobWaitCommand,
    jobLogsCommand,
    jobCancelCommand,
    jobFinalizeCommand,
  ])
);

const yeetVerifyCommand = Command.make("verify", verifyFlags, (options) => runYeetMode("verify", options)).pipe(
  Command.withDescription("Run the canonical pre-push proof without duplicate affected feedback")
);

const yeetRepairCommand = Command.make("repair", { ...sharedFlags, ...detachedFlags }, (options) =>
  runYeetMode("repair", options)
).pipe(Command.withDescription("Run deterministic fixers and artifact generators, then affected feedback"));

const yeetPublishCommand = Command.make("publish", publishFlags, ({ stateRoot, ...options }) =>
  provideYeetStateRoot(runYeetMode("publish", options), stateRoot)
).pipe(Command.withDescription("Commit reviewed staged changes, prove the commit, then push"));

const YeetMonitorCommandRoute = LiteralKit([
  "classic",
  "invalid-until-event",
  "invalid-until-ready",
  "ready-loop",
  "invalid-settle-timeout",
  "merge-loop",
  "watch",
]);

const SelectYeetMonitorCommandRoute = Fn({
  input: S.Struct({
    plan: S.Boolean,
    settleTimeout: S.String.pipe(SchemaUtils.withKeyDefaults("")),
    untilEvent: S.Boolean,
    untilMerged: S.Boolean,
    untilReady: S.Boolean.pipe(SchemaUtils.withKeyDefaults(false)),
    watch: S.Boolean,
  }),
  output: YeetMonitorCommandRoute,
}).pipe(
  $I.annoteSchema("SelectYeetMonitorCommandRoute", {
    description: "Selects the monitor runtime from the four parsed mode switches.",
  })
);

/**
 * Select the runtime route for a parsed `yeet monitor` invocation.
 *
 * **Details**
 *
 * Legal plan-mode requests retain the classic planner. Readiness mode rejects
 * every other loop mode before planning or remote work. Outside plan mode,
 * `untilEvent` is valid only with watch mode and never with the merge loop.
 * Keeping the precedence in one pure selector makes the CLI pairing contract
 * directly testable without executing a monitor.
 *
 * **Example** (Select event watch mode)
 *
 * ```ts
 * import { yeetMonitorCommandRoute } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(yeetMonitorCommandRoute({ plan: false, untilEvent: true, untilMerged: false, watch: true })) // "watch"
 * ```
 *
 * @param options - Parsed monitor mode switches and the optional settle duration.
 * @returns The monitor implementation the handler should construct.
 * @category utilities
 * @since 0.0.0
 */
export const yeetMonitorCommandRoute = SelectYeetMonitorCommandRoute.implementSync((options) =>
  Match.value(options).pipe(
    Match.when(
      (value) => Str.isNonEmpty(value.settleTimeout) && !value.untilMerged && !value.untilReady && !value.watch,
      () => YeetMonitorCommandRoute.Enum["invalid-settle-timeout"]
    ),
    Match.when(
      (value) => value.untilReady && (value.untilMerged || value.untilEvent || value.watch),
      () => YeetMonitorCommandRoute.Enum["invalid-until-ready"]
    ),
    Match.when({ plan: true }, () => YeetMonitorCommandRoute.Enum.classic),
    Match.when({ untilEvent: true, untilMerged: true }, () => YeetMonitorCommandRoute.Enum["invalid-until-event"]),
    Match.when({ untilEvent: true, watch: false }, () => YeetMonitorCommandRoute.Enum["invalid-until-event"]),
    Match.when({ untilReady: true }, () => YeetMonitorCommandRoute.Enum["ready-loop"]),
    Match.when({ untilMerged: true }, () => YeetMonitorCommandRoute.Enum["merge-loop"]),
    Match.when({ watch: true }, () => YeetMonitorCommandRoute.Enum.watch),
    Match.orElse(() => YeetMonitorCommandRoute.Enum.classic)
  )
);

// The porcelain monitor loops write no run verdict, so inside a detached job they record their
// own outcome; the classic monitor records it through the run verdict like verify does.
const reportDetachedMonitor = Effect.fnUntraced(function* <A, E, R>(self: Effect.Effect<A, E, R>) {
  if (O.isNone(yield* configStringOption("BEEP_YEET_JOB_ID"))) return yield* self;
  return yield* reportProofJobCommand(yield* jobRoot(), self);
});

const yeetMonitorCommand = Command.make(
  "monitor",
  monitorFlags,
  Effect.fn("Yeet.monitorCommand")(function* ({
    stateRoot,
    settleTimeout,
    untilEvent,
    untilMerged,
    untilReady,
    watch,
    ...options
  }) {
    if (options.detach) return yield* provideYeetStateRoot(runYeetMode("monitor", options), stateRoot);
    const route = yeetMonitorCommandRoute({
      plan: options.plan,
      settleTimeout,
      untilEvent,
      untilMerged,
      untilReady,
      watch,
    });
    const settleTimeoutMs = yield* yeetMonitorDurationMillis(settleTimeout);
    return yield* provideYeetStateRoot(
      {
        "invalid-settle-timeout": Effect.fail(
          YeetCommandError.make({
            message: "--settle-timeout requires --until-merged, --until-ready, or --watch.",
            exitCode: 1,
          })
        ),
        classic: runYeetMode("monitor", options),
        "invalid-until-event": rejectYeetUntilEventPairing,
        "invalid-until-ready": rejectYeetUntilReadyPairing,
        "ready-loop": reportDetachedMonitor(
          runYeetMergeLoop(options, { policy: YeetUntilReadyPolicy.make({ settleTimeoutMs }) }).pipe(Effect.asVoid)
        ),
        "merge-loop": reportDetachedMonitor(runYeetMergeLoop(options, { settleTimeoutMs }).pipe(Effect.asVoid)),
        watch: reportDetachedMonitor(runYeetWatchLoop(options, untilEvent, { settleTimeoutMs })),
      }[route],
      stateRoot
    );
  })
).pipe(Command.withDescription("Monitor hosted PR checks for the current branch"));

const yeetSweepCommand = Command.make("sweep", sweepFlags, (options) => runYeetSweep(options)).pipe(
  Command.withDescription(
    "Reset the clone after a merge: prune refs, fast-forward main, delete merged branches; --retire first archive-retires the linked worktree it runs in"
  ),
  Command.provide(WorktreeRemovalServiceLive)
);

const yeetMergeCommand = Command.make("merge", porcelainFlags, (options) => runYeetMerge(options)).pipe(
  Command.withDescription("Squash-merge this branch's pull request, confirm MERGED, then sweep the clone")
);

const yeetReplyCommand = Command.make("reply", porcelainFlags, (options) => runYeetReplyPass(options)).pipe(
  Command.withDescription("Post and resolve the drafted review-thread replies for this branch's pull request")
);

const yeetCloseoutCommand = Command.make("closeout", closeoutFlags, (options) => runYeetMode("closeout", options)).pipe(
  Command.withDescription("Inspect PR review threads and bot gates for merge closeout")
);

const yeetStatusCommand = Command.make("status", statusFlags, (options) => runYeetMode("status", options)).pipe(
  Command.withDescription("Summarize local Yeet operator status for the current branch")
);

const yeetResumeCommand = Command.make(
  "resume",
  {
    ref: Argument.String("number|url").pipe(Argument.withDescription("Pull request number or GitHub pull request URL")),
    list: resumeListFlag,
    print: resumePrintFlag,
    force: resumeForceFlag,
    json: jsonFlag,
    agent: resumeAgentFlag,
    stateRoot: yeetStateRootFlag,
  },
  ({ ref, list, print, force, json, agent, stateRoot }) =>
    parsePrRef(ref).pipe(
      Effect.flatMap((parsed) =>
        decodeOptionalPositiveInt(agent).pipe(
          Effect.mapError(() =>
            YeetCommandError.make({ message: "Agent selection must be a positive one-based integer.", exitCode: 4 })
          ),
          Effect.flatMap((validatedAgent) =>
            provideYeetStateRoot(
              runYeetResume(ResumeOptions.make({ ref: parsed, list, print, force, json, agent: validatedAgent })),
              stateRoot
            )
          )
        )
      )
    )
).pipe(Command.withDescription("Resume an agent session recorded for a pull request"));

const yeetPrePushHookCommand = Command.make("pre-push-hook", sharedFlags, (options) =>
  runYeetMode("pre-push-hook", options)
).pipe(Command.withDescription("Reuse exact Yeet full-proof state for git pre-push hooks when safe"));

const yeetFallowFeedbackCommand = Command.make(
  "fallow-feedback",
  {
    advisory: fallowAdvisoryFlag,
    emit: fallowEmitFlag,
    from: fallowFromFlag,
    runStartedAt: fallowRunStartedAtFlag,
  },
  ({ advisory, emit, from, runStartedAt }) => runYeetFallowFeedback({ advisory, emit, from, runStartedAt })
).pipe(Command.withDescription("Convert Fallow advisory envelopes into a Yeet QualityIssueIndex"));

const yeetFallowFixtureCheckCommand = Command.make(
  "fallow-fixture-check",
  {
    assert: fallowAssertFlag,
    emit: fallowEmitFlag,
    fixturePath: Argument.String("fixture-path").pipe(
      Argument.withDescription("Fallow report-envelope fixture document")
    ),
  },
  ({ assert, emit, fixturePath }) => runYeetFallowFixtureCheck({ assertions: assert, emit, fixturePath })
).pipe(Command.withDescription("Verify Fallow envelope fixtures map into Yeet quality issues"));

const yeetInboxListCommand = Command.make("list", inboxListFlags, runYeetInboxList).pipe(
  Command.withDescription("List the checkout's failure inbox rows joined with ack state and wave liveness")
);

const yeetInboxAckCommand = Command.make(
  "ack",
  {
    observed: Flag.Boolean("observed").pipe(Flag.withDefault(false)),
    actor: inboxActorFlag,
    environmentOnly: inboxEnvironmentOnlyFlag,
    expiresAt: inboxExpiresAtFlag,
    fixSha: inboxFixShaFlag,
    id: inboxAckIdArgument,
    reason: inboxReasonFlag,
    shard: inboxShardFlag,
    threadUrl: inboxThreadUrlFlag,
    waive: inboxWaiveFlag,
    wontfix: inboxWontfixFlag,
  },
  runYeetInboxAck
).pipe(
  Command.withDescription(
    "Acknowledge one inbox row with a fix, environment-only attribution, wontfix, thread, or attributed expiring waiver"
  )
);

const yeetInboxAppendCommand = Command.make("append", { fromStdin: inboxRowStdinFlag }, runYeetInboxAppend).pipe(
  Command.withDescription("Append one typed failure row from stdin to the checkout's inbox")
);

const yeetInboxCommand = Command.make("inbox", inboxListFlags, runYeetInboxList).pipe(
  Command.withDescription("Read and acknowledge the checkout's typed failure inbox"),
  Command.withSubcommands([yeetInboxListCommand, yeetInboxAckCommand, yeetInboxAppendCommand])
);

const proofReportJsonFlag = Flag.Boolean("json").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Render the proof shadow report as JSON (proof-shadow-report/v1)")
);

const yeetProofReportCommand = Command.make(
  "proof-report",
  { json: proofReportJsonFlag },
  runYeetProofReportCommand
).pipe(
  Command.withDescription(
    "Print the proof-ledger shadow report: sample size, would-have-reused lanes, disagreements, and the enforcement bar"
  )
);

const yeetEconomicsCommand = Command.make(
  "economics",
  {
    json: Flag.Boolean("json").pipe(
      Flag.withDefault(false),
      Flag.withDescription("Render the economics report as JSON (yeet-economics/v1)")
    ),
    branch: Flag.String("branch").pipe(
      Flag.optional,
      Flag.withDescription("Read only this branch's run directory instead of every run in the checkout")
    ),
    fleet: Flag.Boolean("fleet").pipe(
      Flag.withDefault(false),
      Flag.withDescription(
        "Add every sibling beep-effect* checkout, beep-effect*-worktrees lane, and clone .claude/worktrees lane under the projects root"
      )
    ),
    packetDir: packetDirFlag,
  },
  runYeetEconomicsCommand
).pipe(
  Command.withDescription(
    "Print where the checkout's proof minutes went: attempt mixes, wrapper and inner lanes, first failure, red-to-green episodes, and terminations"
  )
);

const yeetPlanContractCheckCommand = Command.make(
  "plan-contract-check",
  {
    expectArgs: expectArgsFlag,
    expectCommand: expectCommandFlag,
    expectStepId: expectStepIdFlag,
    expectStepLabel: expectStepLabelFlag,
    fromStdin: fromStdinFlag,
  },
  ({ expectArgs, expectCommand, expectStepId, expectStepLabel, fromStdin }) =>
    runYeetPlanContractCheck({ expectArgs, expectCommand, expectStepId, expectStepLabel, fromStdin })
).pipe(Command.withDescription("Assert a Yeet plan contains an exact named step"));

/**
 * Command that repairs, verifies, or publishes repository work through Yeet.
 *
 * **Example** (Wire the yeet command)
 *
 * ```ts
 * import { yeetCommand } from "@beep/repo-cli/commands/Yeet"
 * import { Command } from "effect/cli"
 * import * as Effect from "effect/Effect"
 *
 * const run = Command.run(yeetCommand, { version: "0.0.0" })
 * console.log(Effect.isEffect(run)) // true
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const yeetCommand = Command.make("yeet", publishFlags, ({ stateRoot, ...options }) =>
  provideYeetStateRoot(runYeetMode("publish", options), stateRoot)
).pipe(
  Command.withDescription("Repair, verify, or publish repository work with canonical quality proof"),
  Command.withSubcommands([
    yeetVerifyCommand,
    yeetRepairCommand,
    yeetPublishCommand,
    yeetMonitorCommand,
    yeetCloseoutCommand,
    yeetStatusCommand,
    yeetResumeCommand,
    yeetSweepCommand,
    yeetMergeCommand,
    yeetReplyCommand,
    yeetInboxCommand,
    yeetJobCommand,
    yeetProofReportCommand,
    yeetEconomicsCommand,
    yeetPrePushHookCommand,
    yeetFallowFeedbackCommand,
    yeetFallowFixtureCheckCommand,
    yeetPlanContractCheckCommand,
  ])
);
