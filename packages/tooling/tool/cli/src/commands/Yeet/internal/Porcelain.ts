/**
 * Command-layer runners for the merge-loop porcelain: `yeet sweep`,
 * `yeet merge`, `yeet reply`, and `yeet monitor --until-merged`.
 *
 * **Details**
 *
 * Each engine — {@link executeSweep}, {@link mergePr}, {@link runYeetReply},
 * {@link runYeetMonitorUntilMerged} — takes a hydrated `RepoRunContext` and
 * knows nothing about flags. This module is the seam that turns parsed flag
 * values into that context and renders the result for the operator, so
 * `Yeet.command.ts` stays a declaration of the CLI surface rather than a place
 * where behavior accumulates.
 *
 * **Gotchas**
 *
 * `runYeetMerge` is the only runner here that writes to a pull request, and it
 * exists solely so a human can type it. Nothing in this repository may call it
 * from a monitor, closeout, or publish path — the sweep is safe to automate on a
 * merged-PR detection, the merge itself never is.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Console, Effect } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as Str from "effect/String";
import { failWithReportedExit } from "../../../internal/cli/ExitCodeError.ts";
import { YeetCommandError } from "../Yeet.errors.ts";
import { hydrateYeetReadOnlyContext } from "./Handler.ts";
import { mergePr } from "./Merge.ts";
import { runYeetMonitorUntilMerged } from "./MonitorLoop.ts";
import { renderYeetReplyFailureVerdict, replyReportPathForContext, runYeetReply } from "./Reply.ts";
import { SweepPlanJson, SweepReportJson } from "./Sweep.schemas.ts";
import { executeSweep, overrideSweepBranch, planSweep, renderSweepReport } from "./Sweep.ts";
import type { FileSystem, Path } from "effect";
import type { ChildProcessSpawner } from "effect/unstable/process";
import type { CliReportedExit } from "../../../internal/cli/ExitCodeError.ts";
import type { YeetMonitorTerminalState } from "./MonitorLoop.ts";
import type { ReplyReport } from "./Reply.schemas.ts";
import type { SweepPlan, SweepPlanStep, SweepReport } from "./Sweep.schemas.ts";

/**
 * The parsed flag values every merge-loop subcommand accepts, matching the
 * coordinates `hydrateYeetReadOnlyContext` needs.
 */
interface YeetPorcelainOptions {
  readonly base: string;
  readonly head: string;
  readonly packetDir: string;
}

/**
 * Parsed `yeet sweep` flag values. `plan` is the dry run — observe the clone,
 * build the plan, print it, execute nothing — and `json` selects the artifact
 * codec instead of the operator text, for both the plan and the report. An
 * empty `branch` means "the checked-out branch"; any other value re-aims the
 * sweep through {@link overrideSweepBranch}, which is how a second pass reaches
 * a merged branch the clone is no longer standing on.
 */
interface YeetSweepOptions extends YeetPorcelainOptions {
  readonly branch: string;
  readonly json: boolean;
  readonly plan: boolean;
}

const encodeSweepPlan = (plan: SweepPlan): Effect.Effect<string, YeetCommandError> =>
  SweepPlanJson.encode(plan).pipe(Effect.mapError(YeetCommandError.new("Failed to encode the yeet sweep plan.")));

const encodeSweepReport = (report: SweepReport): Effect.Effect<string, YeetCommandError> =>
  SweepReportJson.encode(report).pipe(Effect.mapError(YeetCommandError.new("Failed to encode the yeet sweep report.")));

const renderSweepPlanStep = (planStep: SweepPlanStep): ReadonlyArray<string> => [
  `  ${planStep.id}: ${planStep.action}${planStep.requiresOperator ? " (needs operator)" : ""}`,
  ...A.map(
    planStep.preconditions,
    (precondition) => `    ${precondition.satisfied ? "ok" : "unmet"}: ${precondition.description}`
  ),
];

const renderSweepPlan = (plan: SweepPlan): string =>
  A.join([`[yeet] sweep plan ${plan.branch} (dry run)`, ...A.flatMap(plan.steps, renderSweepPlanStep)], "\n");

/**
 * Run one post-merge workspace sweep, or print the plan it would run.
 *
 * **Details**
 *
 * A sweep never fails on a step: every outcome is recorded, `needs-operator`
 * outcomes are batched into a handoff block, and the command exits 0 whether the
 * clone was already clean or every step skipped. That is the point — "merged,
 * cleanup skipped: reason" is a success, not a red run.
 *
 * **Example** (Build the sweep runner effect)
 *
 * ```ts
 * import { runYeetSweep } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 *
 * const program = Effect.succeed(runYeetSweep)
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param options - Parsed `yeet sweep` flag values.
 * @returns Void once the plan or the executed report has been printed.
 * @category commands
 * @since 0.0.0
 */
export const runYeetSweep = Effect.fn("Yeet.runSweepCommand")(function* (
  options: YeetSweepOptions
): Effect.fn.Return<
  void,
  YeetCommandError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const hydrated = yield* hydrateYeetReadOnlyContext(options);
  const context = Str.isEmpty(options.branch) ? hydrated : yield* overrideSweepBranch(hydrated, options.branch);
  if (options.plan) {
    const plan = yield* planSweep(context);
    yield* Console.log(options.json ? yield* encodeSweepPlan(plan) : renderSweepPlan(plan));
    return;
  }
  const report = yield* executeSweep(context);
  yield* Console.log(options.json ? yield* encodeSweepReport(report) : renderSweepReport(report));
});

/**
 * Squash-merge the current branch's pull request, then sweep the clone.
 *
 * **Gotchas**
 *
 * Operator-authorized only. The merge is a decision, not a step: no monitor
 * loop, closeout path, or publish flow may reach this runner.
 *
 * **Example** (Build the merge runner effect)
 *
 * ```ts
 * import { runYeetMerge } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 *
 * const program = Effect.succeed(runYeetMerge)
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param options - Parsed `yeet merge` flag values.
 * @returns Void once the merge and its sweep tail have been printed.
 * @category commands
 * @since 0.0.0
 */
export const runYeetMerge = Effect.fn("Yeet.runMergeCommand")(function* (
  options: YeetPorcelainOptions
): Effect.fn.Return<
  void,
  YeetCommandError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const outcome = yield* mergePr(yield* hydrateYeetReadOnlyContext(options));
  yield* Console.log(`[yeet] pull request #${outcome.pullRequestNumber} is ${outcome.state}`);
  yield* Console.log(renderSweepReport(outcome.sweep));
});

/**
 * Post and resolve the drafted review-thread replies for the current branch.
 *
 * **Details**
 *
 * The drafts artifact names its own pull request, so either party — the agent
 * that wrote the drafts or the operator whose auth may post them — can run this
 * from any worktree. Every draft gets its turn: a denied scope or a deleted
 * thread becomes that draft's outcome, never an aborted pass.
 *
 * **Gotchas**
 *
 * The batch running to completion is not the same as the batch succeeding, and
 * this seam is where the two part company. Any `failed` outcome exits non-zero
 * through {@link CliReportedExit}, because an unwritten reply leaves its review
 * thread open — an unresolved thread is a hard merge gate, so an exit-0 pass
 * would hand `yeet reply && bun run beep yeet monitor` a green it has not
 * earned. `stale` is not a failure: the thread was already resolved upstream,
 * so there was nothing to write. The exit is silent by construction — the pass
 * already printed every outcome and the report path, so the sentinel adds the
 * code and the verdict line, not a second rendering of the same failure.
 *
 * **Example** (Build the reply runner effect)
 *
 * ```ts
 * import { runYeetReplyPass } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 *
 * const program = Effect.succeed(runYeetReplyPass)
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param options - Parsed `yeet reply` flag values.
 * @returns Void once every draft was written; a non-zero exit when any failed.
 * @category commands
 * @since 0.0.0
 */
export const runYeetReplyPass = Effect.fn("Yeet.runReplyCommand")(function* (
  options: YeetPorcelainOptions
): Effect.fn.Return<
  void,
  YeetCommandError | CliReportedExit,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const context = yield* hydrateYeetReadOnlyContext(options);
  const report = yield* runYeetReply(context);
  yield* failYeetReplyOnFailedOutcomes(report, yield* replyReportPathForContext(context));
});

/**
 * Exit non-zero when a reply pass left any drafted reply unwritten.
 *
 * **Details**
 *
 * The report is the accounting and this is the verdict read off it. It is a
 * separate function because the decision is the interesting part: which
 * outcomes count as failure (`failed` only — `stale` wrote nothing because
 * there was nothing to write) and what the operator is told. The exit is
 * silent, since the pass already printed every outcome; this adds the verdict
 * line and the code.
 *
 * **Example** (A clean report exits normally)
 *
 * ```ts
 * import { failYeetReplyOnFailedOutcomes, ReplyReport } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 *
 * const report = ReplyReport.make({
 *   schemaVersion: "yeet-reply-report/v1",
 *   prNumber: 558,
 *   createdAt: "2026-08-16T00:00:00.000Z",
 *   outcomes: [],
 * })
 * const verdict = failYeetReplyOnFailedOutcomes(report, "reply-report.json").pipe(Effect.as("clean"))
 * console.log(Effect.runSync(verdict))
 * ```
 *
 * @param report - The report written by one reply pass.
 * @param reportPath - Where that report was written, quoted in the verdict.
 * @returns Void when every draft was written; a reported non-zero exit otherwise.
 * @category commands
 * @since 0.0.0
 */
export const failYeetReplyOnFailedOutcomes = Effect.fn("Yeet.failReplyOnFailedOutcomes")(function* (
  report: ReplyReport,
  reportPath: string
): Effect.fn.Return<void, CliReportedExit> {
  const verdict = renderYeetReplyFailureVerdict(report, reportPath);
  if (O.isNone(verdict)) {
    return;
  }
  yield* Console.error(verdict.value);
  return yield* failWithReportedExit(verdict.value);
});

/**
 * Follow the current branch's pull request through its fix waves until it
 * merges or closes.
 *
 * **Details**
 *
 * This is `yeet monitor --until-merged`. Plain `yeet monitor` exits on the first
 * red wave and has to be re-armed after every push; the loop re-reads status
 * each poll instead, so a mid-session push simply becomes the next budget scope,
 * and the merged path ends in the workspace sweep.
 *
 * **Example** (Build the merge-loop runner effect)
 *
 * ```ts
 * import { runYeetMergeLoop } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 *
 * const program = Effect.succeed(runYeetMergeLoop)
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param options - Parsed `yeet monitor` flag values.
 * @returns The terminal state that ended the loop.
 * @category commands
 * @since 0.0.0
 */
export const runYeetMergeLoop = Effect.fn("Yeet.runMergeLoopCommand")(function* (
  options: YeetPorcelainOptions
): Effect.fn.Return<
  YeetMonitorTerminalState,
  YeetCommandError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  return yield* runYeetMonitorUntilMerged(yield* hydrateYeetReadOnlyContext(options), {});
});
