/**
 * Yeet quality feedback and commit/push command.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { Fn, LiteralKit, SchemaUtils } from "@beep/schema";
import { ConfigProvider, Effect, Match } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { Argument, Command, Flag } from "effect/unstable/cli";
import { yeetStateRootEnvVar, yeetStateRootFlag } from "../../internal/cli/Flags.ts";
import {
  runYeetFallowFeedback,
  runYeetFallowFixtureCheck,
  runYeetPlanContractCheck,
} from "./internal/FallowFeedback.ts";
import { runYeet } from "./internal/Handler.ts";
import { YeetInboxSeverity } from "./internal/Inbox.ts";
import { runYeetInboxAck, runYeetInboxAppend, runYeetInboxList } from "./internal/InboxPorcelain.ts";
import { DEFAULT_YEET_PACKET_DIR, YeetProofTier } from "./internal/Planner.ts";
import {
  rejectYeetUntilEventPairing,
  runYeetMerge,
  runYeetMergeLoop,
  runYeetReplyPass,
  runYeetSweep,
  runYeetWatchLoop,
} from "./internal/Porcelain.ts";
import { PositiveInt, ResumeOptions } from "./internal/Resume.schemas.ts";
import { parsePrRef, runYeetResume } from "./internal/Resume.ts";
import { YeetCommandError } from "./Yeet.errors.ts";
import { YeetRunOptions } from "./Yeet.schemas.ts";
import type { YeetRunMode } from "./internal/Planner.ts";

const $I = $RepoCliId.create("commands/Yeet/Yeet.command");

const baseFlag = Flag.string("base").pipe(
  Flag.withDescription("Base ref for affected feedback planning"),
  Flag.withDefault("origin/main")
);

const branchFlag = Flag.string("branch").pipe(
  Flag.withDescription("Sweep this branch instead of the checked-out one, so a second pass can finish a merged branch"),
  Flag.withDefault("")
);

const headFlag = Flag.string("head").pipe(
  Flag.withDescription("Head ref for affected feedback planning"),
  Flag.withDefault("HEAD")
);

const jsonFlag = Flag.boolean("json").pipe(Flag.withDefault(false), Flag.withDescription("Render plan output as JSON"));

const resumeListFlag = Flag.boolean("list").pipe(
  Flag.withDefault(false),
  Flag.withDescription("List every locally recorded agent for the pull request")
);
const resumePrintFlag = Flag.boolean("print").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Print the resolved local command without executing it")
);
const resumeForceFlag = Flag.boolean("force").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Resume even when the recorded Claude session is already live")
);
const resumeAgentFlag = Flag.integer("agent").pipe(
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

const packetDirFlag = Flag.string("packet-dir").pipe(
  Flag.withDescription("Ignored directory for yeet run context, logs, and packets"),
  Flag.withDefault(DEFAULT_YEET_PACKET_DIR)
);

const planFlag = Flag.boolean("plan").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Print the yeet plan without running commands")
);

const messageFlag = Flag.string("message").pipe(
  Flag.withDescription("Conventional commit message required before publish"),
  Flag.withDefault("")
);

const fastFlag = Flag.boolean("fast").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Skip local full pre-push proof only when paired with --monitor on a PR branch")
);

const startPrEarlyFlag = Flag.boolean("start-pr-early").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Push with hooks skipped before full local proof, then run proof and monitor hosted checks")
);

const monitorFlag = Flag.boolean("monitor").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Monitor hosted PR checks after publish instead of stopping at push")
);

const untilMergedFlag = Flag.boolean("until-merged").pipe(
  Flag.withDefault(false),
  Flag.withDescription(
    "Keep monitoring across pushes until the PR merges or closes, rerunning known-flake jobs once per job per head SHA and sweeping the clone on merge"
  )
);

const summaryFlag = Flag.boolean("summary").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Print a compact operator summary after monitor or closeout reads")
);

const remoteFlag = Flag.boolean("remote").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Include live GitHub PR and check data in yeet status")
);

const tierFlag = Flag.choiceWithValue("tier", [
  ["full", "full"],
  ["cheap-gates", "cheap-gates"],
  ["review-fix", "review-fix"],
]).pipe(
  Flag.withDescription("Local proof tier for verify; publish always uses full"),
  Flag.withDefault("full" as const)
);

const mergedFlag = Flag.boolean("merged").pipe(
  Flag.withDefault(false),
  Flag.withDescription(
    "Prove the merge preview of HEAD with the base ref — the tree hosted CI runs — instead of the branch tree"
  )
);

const ciParityFlag = Flag.boolean("ci-parity").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Run the exact affected CI battery in an installed merge-preview worktree")
);

const collectAllFlag = Flag.boolean("collect-all").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Run every local preflight wave after failures instead of stopping before later waves")
);

const noFailFastFlag = Flag.boolean("no-fail-fast").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Keep launching local gates after a precise red to collect the full diagnostic picture")
);

const amendFlag = Flag.boolean("amend").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Amend the current local commit during publish")
);

const stagedOnlyFlag = Flag.boolean("staged-only").pipe(
  Flag.withDefault(false),
  Flag.withDescription(
    "Publish exactly the staged index: stash unstaged/untracked residue after commit, prove the clean tree, restore after push"
  )
);

const allowStaleBaseFlag = Flag.boolean("allow-stale-base").pipe(
  Flag.withDefault(false),
  Flag.withDescription(
    "Proceed with publish even when branch files overlap commits landed on the base since merge-base"
  )
);

const prFlag = Flag.boolean("pr").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Create a ready (non-draft) pull request after the push succeeds, unless one is already open")
);

const noEditFlag = Flag.boolean("no-edit").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Reuse the current commit message with --amend during publish")
);

const reuseVerifiedFlag = Flag.boolean("reuse-verified").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Skip publish proof only when durable Yeet full-proof state exactly matches")
);

const pushOnlyFlag = Flag.boolean("push-only").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Push an already-verified clean commit without committing or rerunning local proof")
);

const botsFlag = Flag.string("bots").pipe(
  Flag.withDescription(
    "Comma-separated PR review bots to classify and gate during closeout (default greptile; pass greptile,coderabbit,chatgpt to restore the legacy lineup)"
  ),
  Flag.withDefault("greptile")
);

const requireGreptileScoreFlag = Flag.string("require-greptile-score").pipe(
  Flag.withDescription("Required Greptile score, for example 5/5; empty disables the gate"),
  Flag.withDefault("")
);

const requireGreptileIssuesFlag = Flag.integer("require-greptile-issues").pipe(
  Flag.withDescription("Required Greptile open issue count; negative disables the gate"),
  Flag.withDefault(-1)
);

const requireReviewCommentsFlag = Flag.integer("require-review-comments").pipe(
  Flag.withDescription("Required unresolved actionable PR review comment count; negative disables the gate"),
  Flag.withDefault(-1)
);

const replyThreadFlag = Flag.string("reply-thread").pipe(
  Flag.withDescription("Review thread id to reply to during closeout; requires --reply-body"),
  Flag.withDefault("")
);

const replyBodyFlag = Flag.string("reply-body").pipe(
  Flag.withDescription("Reply body posted to --reply-thread during closeout"),
  Flag.withDefault("")
);

const resolveThreadsFlag = Flag.string("resolve-threads").pipe(
  Flag.withDescription("Comma-separated review thread ids to resolve during closeout"),
  Flag.withDefault("")
);

const retriggerGreptileFlag = Flag.boolean("retrigger-greptile").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Post the explicit Greptile retrigger comment after reading current PR state")
);

const fallowFromFlag = Flag.string("from").pipe(
  Flag.withDescription("Directory containing Fallow advisory envelopes"),
  Flag.withDefault(".beep/fallow")
);

const fallowEmitFlag = Flag.string("emit").pipe(
  Flag.withDescription("QualityIssueIndex output path for Fallow advisory feedback"),
  Flag.withDefault(".beep/yeet/fallow-quality-issues.json")
);

const fallowAdvisoryFlag = Flag.boolean("advisory").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Keep every Fallow-derived Yeet issue nonblocking")
);

const fallowRunStartedAtFlag = Flag.string("run-started-at").pipe(
  Flag.withDescription("Reject advisory envelopes generated before this Yeet run timestamp"),
  Flag.withDefault("")
);

const fallowAssertFlag = Flag.string("assert").pipe(
  Flag.withDescription("Comma-separated fixture assertions to enforce"),
  Flag.withDefault("")
);

const fromStdinFlag = Flag.boolean("from-stdin").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Read a Yeet plan JSON document from stdin")
);

const expectStepIdFlag = Flag.string("expect-step-id").pipe(
  Flag.withDescription("Required plan step id"),
  Flag.withDefault("")
);

const expectStepLabelFlag = Flag.string("expect-step-label").pipe(
  Flag.withDescription("Required plan step label"),
  Flag.withDefault("")
);

const expectCommandFlag = Flag.string("expect-command").pipe(
  Flag.withDescription("Required plan step command"),
  Flag.withDefault("")
);

const expectArgsFlag = Flag.string("expect-args").pipe(
  Flag.withDescription("Required plan step args rendered as a space-separated string"),
  Flag.withDefault("")
);

const inboxUnackedFlag = Flag.boolean("unacked").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Show only rows without an ack receipt")
);

const inboxSeverityFlagChoices: ReadonlyArray<readonly ["all" | YeetInboxSeverity, "all" | YeetInboxSeverity]> = [
  ["all", "all"],
  ...A.map(YeetInboxSeverity.Options, (tier) => [tier, tier] as const),
];

const inboxSeverityFlag = Flag.choiceWithValue("severity", inboxSeverityFlagChoices).pipe(
  Flag.withDescription("Show only rows of this severity tier"),
  Flag.withDefault("all" as const)
);

const inboxFixShaFlag = Flag.string("fix-sha").pipe(
  Flag.withDescription("Acknowledge the row as fixed by this commit"),
  Flag.withDefault("")
);

const inboxEnvironmentOnlyFlag = Flag.boolean("environment-only").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Acknowledge the row as environmental rather than a repository-code defect; requires --reason")
);

const inboxWontfixFlag = Flag.boolean("wontfix").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Acknowledge the row as deliberately not fixed; requires --reason")
);

const inboxReasonFlag = Flag.string("reason").pipe(
  Flag.withDescription("Why an environment-only, wontfix, or waiver resolution applies"),
  Flag.withDefault("")
);

const inboxThreadUrlFlag = Flag.string("thread-url").pipe(
  Flag.withDescription("Acknowledge the row as continued in this review thread"),
  Flag.withDefault("")
);

const inboxWaiveFlag = Flag.boolean("waive").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Temporarily waive the row; requires actor, shard, reason, and expiry")
);

const inboxActorFlag = Flag.string("actor").pipe(
  Flag.withDescription("Actor accountable for an expiring waiver"),
  Flag.withDefault("")
);

const inboxExpiresAtFlag = Flag.string("expires-at").pipe(
  Flag.withDescription("ISO timestamp after which a waiver stops acknowledging the row"),
  Flag.withDefault("")
);

const inboxShardFlag = Flag.string("shard").pipe(
  Flag.withDescription("Named local shard or required context covered by a waiver"),
  Flag.withDefault("")
);

const inboxRowStdinFlag = Flag.boolean("from-stdin").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Read one inbox row JSON document from stdin")
);

const inboxAckIdArgument = Argument.string("id").pipe(
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

const verifyFlags = {
  ...sharedFlags,
  ciParity: ciParityFlag,
  merged: mergedFlag,
} as const;

const publishFlags = {
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

const watchFlag = Flag.boolean("watch").pipe(
  Flag.withDefault(false),
  Flag.withDescription(
    "Stream one NDJSON row per PR state transition until the PR settles, instead of the blocking check watch"
  )
);

const untilEventFlag = Flag.boolean("until-event").pipe(
  Flag.withDefault(false),
  Flag.withDescription(
    "With --watch: exit on the first actionable event batch (a failing check immediately, new PR comments after a short settle window) so a supervising session is woken the moment there is something to act on"
  )
);

const monitorFlags = {
  ...sharedFlags,
  summary: summaryFlag,
  stateRoot: yeetStateRootFlag,
  untilEvent: untilEventFlag,
  untilMerged: untilMergedFlag,
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
  plan: planFlag,
} as const;

const closeoutFlags = {
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
  );
};

const yeetVerifyCommand = Command.make("verify", verifyFlags, (options) => runYeetMode("verify", options)).pipe(
  Command.withDescription("Run the canonical pre-push proof without duplicate affected feedback")
);

const yeetRepairCommand = Command.make("repair", sharedFlags, (options) => runYeetMode("repair", options)).pipe(
  Command.withDescription("Run deterministic fixers and artifact generators, then affected feedback")
);

const yeetPublishCommand = Command.make("publish", publishFlags, ({ stateRoot, ...options }) =>
  provideYeetStateRoot(runYeetMode("publish", options), stateRoot)
).pipe(Command.withDescription("Commit reviewed staged changes, prove the commit, then push"));

const YeetMonitorCommandRoute = LiteralKit(["classic", "invalid-until-event", "merge-loop", "watch"]);

const SelectYeetMonitorCommandRoute = Fn({
  input: S.Struct({
    plan: S.Boolean,
    untilEvent: S.Boolean,
    untilMerged: S.Boolean,
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
 * Plan mode always retains the classic planner. Outside plan mode,
 * `untilEvent` is valid only with watch mode and never with the merge loop.
 * Keeping the precedence in one pure selector makes the CLI pairing contract
 * directly testable without executing a monitor.
 *
 * **Example** (Select event watch mode)
 *
 * ```ts
 * import { yeetMonitorCommandRoute } from "@beep/repo-cli/commands/Yeet"
 *
 * console.log(yeetMonitorCommandRoute({ plan: false, untilEvent: true, untilMerged: false, watch: true })) // "watch"
 * ```
 *
 * @param options - The four monitor mode switches parsed by the CLI.
 * @returns The monitor implementation the handler should construct.
 * @category utilities
 * @since 0.0.0
 */
export const yeetMonitorCommandRoute = SelectYeetMonitorCommandRoute.implementSync((options) =>
  Match.value(options).pipe(
    Match.when({ plan: true }, () => YeetMonitorCommandRoute.Enum.classic),
    Match.when({ untilEvent: true, untilMerged: true }, () => YeetMonitorCommandRoute.Enum["invalid-until-event"]),
    Match.when({ untilEvent: true, watch: false }, () => YeetMonitorCommandRoute.Enum["invalid-until-event"]),
    Match.when({ untilMerged: true }, () => YeetMonitorCommandRoute.Enum["merge-loop"]),
    Match.when({ watch: true }, () => YeetMonitorCommandRoute.Enum.watch),
    Match.orElse(() => YeetMonitorCommandRoute.Enum.classic)
  )
);

const yeetMonitorCommand = Command.make(
  "monitor",
  monitorFlags,
  ({ stateRoot, untilEvent, untilMerged, watch, ...options }) => {
    const route = yeetMonitorCommandRoute({ plan: options.plan, untilEvent, untilMerged, watch });
    return provideYeetStateRoot(
      {
        classic: runYeetMode("monitor", options),
        "invalid-until-event": rejectYeetUntilEventPairing,
        "merge-loop": runYeetMergeLoop(options),
        watch: runYeetWatchLoop(options, untilEvent),
      }[route],
      stateRoot
    );
  }
).pipe(Command.withDescription("Monitor hosted PR checks for the current branch"));

const yeetSweepCommand = Command.make("sweep", sweepFlags, (options) => runYeetSweep(options)).pipe(
  Command.withDescription("Reset the clone after a merge: prune refs, fast-forward main, delete merged branches")
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
    ref: Argument.string("number|url").pipe(Argument.withDescription("Pull request number or GitHub pull request URL")),
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
        S.decodeEffect(S.Option(PositiveInt))(agent).pipe(
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
    fixturePath: Argument.string("fixture-path").pipe(
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
 * import { Command } from "effect/unstable/cli"
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
    yeetPrePushHookCommand,
    yeetFallowFeedbackCommand,
    yeetFallowFixtureCheckCommand,
    yeetPlanContractCheckCommand,
  ])
);
