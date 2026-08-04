/**
 * Yeet quality feedback and commit/push command.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";
import { Argument, Command, Flag } from "effect/unstable/cli";
import {
  runYeetFallowFeedback,
  runYeetFallowFixtureCheck,
  runYeetPlanContractCheck,
} from "./internal/FallowFeedback.ts";
import { runYeet } from "./internal/Handler.ts";
import { DEFAULT_YEET_PACKET_DIR, YeetProofTier } from "./internal/Planner.ts";
import { YeetRunOptions } from "./Yeet.schemas.ts";
import type { YeetRunMode } from "./internal/Planner.ts";

const $I = $RepoCliId.create("commands/Yeet/Yeet.command");

const baseFlag = Flag.string("base").pipe(
  Flag.withDescription("Base ref for affected feedback planning"),
  Flag.withDefault("origin/main")
);

const headFlag = Flag.string("head").pipe(
  Flag.withDescription("Head ref for affected feedback planning"),
  Flag.withDefault("HEAD")
);

const jsonFlag = Flag.boolean("json").pipe(Flag.withDescription("Render plan output as JSON"));

const packetDirFlag = Flag.string("packet-dir").pipe(
  Flag.withDescription("Ignored directory for yeet run context, logs, and packets"),
  Flag.withDefault(DEFAULT_YEET_PACKET_DIR)
);

const planFlag = Flag.boolean("plan").pipe(Flag.withDescription("Print the yeet plan without running commands"));

const messageFlag = Flag.string("message").pipe(
  Flag.withDescription("Conventional commit message required before publish"),
  Flag.withDefault("")
);

const fastFlag = Flag.boolean("fast").pipe(
  Flag.withDescription("Skip local full pre-push proof only when paired with --monitor on a PR branch")
);

const startPrEarlyFlag = Flag.boolean("start-pr-early").pipe(
  Flag.withDescription("Push with hooks skipped before full local proof, then run proof and monitor hosted checks")
);

const monitorFlag = Flag.boolean("monitor").pipe(
  Flag.withDescription("Monitor hosted PR checks after publish instead of stopping at push")
);

const summaryFlag = Flag.boolean("summary").pipe(
  Flag.withDescription("Print a compact operator summary after monitor or closeout reads")
);

const remoteFlag = Flag.boolean("remote").pipe(
  Flag.withDescription("Include live GitHub PR and check data in yeet status")
);

const tierFlag = Flag.choiceWithValue("tier", [
  ["full", "full"],
  ["review-fix", "review-fix"],
]).pipe(
  Flag.withDescription("Local proof tier for verify; publish always uses full"),
  Flag.withDefault("full" as const)
);

const collectAllFlag = Flag.boolean("collect-all").pipe(
  Flag.withDescription("Run every local preflight wave after failures instead of stopping before later waves")
);

const amendFlag = Flag.boolean("amend").pipe(Flag.withDescription("Amend the current local commit during publish"));

const stagedOnlyFlag = Flag.boolean("staged-only").pipe(
  Flag.withDescription(
    "Publish exactly the staged index: stash unstaged/untracked residue after commit, prove the clean tree, restore after push"
  )
);

const allowStaleBaseFlag = Flag.boolean("allow-stale-base").pipe(
  Flag.withDescription(
    "Proceed with publish even when branch files overlap commits landed on the base since merge-base"
  )
);

const prFlag = Flag.boolean("pr").pipe(
  Flag.withDescription("Create a ready (non-draft) pull request after the push succeeds, unless one is already open")
);

const noEditFlag = Flag.boolean("no-edit").pipe(
  Flag.withDescription("Reuse the current commit message with --amend during publish")
);

const reuseVerifiedFlag = Flag.boolean("reuse-verified").pipe(
  Flag.withDescription("Skip publish proof only when durable Yeet full-proof state exactly matches")
);

const pushOnlyFlag = Flag.boolean("push-only").pipe(
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

const sharedFlags = {
  base: baseFlag,
  collectAll: collectAllFlag,
  head: headFlag,
  json: jsonFlag,
  packetDir: packetDirFlag,
  plan: planFlag,
  tier: tierFlag,
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
  startPrEarly: startPrEarlyFlag,
  summary: summaryFlag,
} as const;

const monitorFlags = {
  ...sharedFlags,
  summary: summaryFlag,
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
    collectAll: S.Boolean.pipe(SchemaUtils.withKeyDefaults(false)),
    fast: S.Boolean.pipe(SchemaUtils.withKeyDefaults(false)),
    head: S.String,
    json: S.Boolean,
    monitor: S.Boolean.pipe(SchemaUtils.withKeyDefaults(false)),
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
      collectAll: sharedOptions.collectAll,
      fast: sharedOptions.fast,
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

const yeetVerifyCommand = Command.make("verify", sharedFlags, (options) => runYeetMode("verify", options)).pipe(
  Command.withDescription("Run the canonical pre-push proof without duplicate affected feedback")
);

const yeetRepairCommand = Command.make("repair", sharedFlags, (options) => runYeetMode("repair", options)).pipe(
  Command.withDescription("Run deterministic fixers and artifact generators, then affected feedback")
);

const yeetPublishCommand = Command.make("publish", publishFlags, (options) => runYeetMode("publish", options)).pipe(
  Command.withDescription("Commit reviewed staged changes, prove the commit, then push")
);

const yeetMonitorCommand = Command.make("monitor", monitorFlags, (options) => runYeetMode("monitor", options)).pipe(
  Command.withDescription("Monitor hosted PR checks for the current branch")
);

const yeetCloseoutCommand = Command.make("closeout", closeoutFlags, (options) => runYeetMode("closeout", options)).pipe(
  Command.withDescription("Inspect PR review threads and bot gates for merge closeout")
);

const yeetStatusCommand = Command.make("status", statusFlags, (options) => runYeetMode("status", options)).pipe(
  Command.withDescription("Summarize local Yeet operator status for the current branch")
);

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
 * import { Effect } from "effect"
 *
 * const run = Command.run(yeetCommand, { version: "0.0.0" })
 * console.log(Effect.isEffect(run)) // true
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const yeetCommand = Command.make("yeet", publishFlags, (options) => runYeetMode("publish", options)).pipe(
  Command.withDescription("Repair, verify, or publish repository work with canonical quality proof"),
  Command.withSubcommands([
    yeetVerifyCommand,
    yeetRepairCommand,
    yeetPublishCommand,
    yeetMonitorCommand,
    yeetCloseoutCommand,
    yeetStatusCommand,
    yeetPrePushHookCommand,
    yeetFallowFeedbackCommand,
    yeetFallowFixtureCheckCommand,
    yeetPlanContractCheckCommand,
  ])
);
