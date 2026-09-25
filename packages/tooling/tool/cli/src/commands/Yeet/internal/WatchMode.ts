/**
 * The `yeet monitor --watch` transition-stream mode.
 *
 * **Details**
 *
 * This is the runtime half of the watch redesign (ship-velocity A1):
 * {@link collectYeetWatchSnapshot} reads one typed snapshot of the pull
 * request, and {@link runYeetWatchStream} polls, diffs consecutive snapshots
 * through the pure `WatchStream` differ, and emits one NDJSON row per
 * transition on stdout. Prose for the operator goes to stderr, so stdout stays
 * a machine surface a consumer can pipe line-by-line into a decoder.
 *
 * The stream is also the backpressure writer: after every poll the inbox is
 * *converged* to the snapshot through `Converge`, the step it shares with
 * `yeet monitor --until-ready` — each failing check dispatches through
 * `Remediation` on the tick that observed it, appending a failure capsule and
 * advancing the wave record, with deterministic capsule ids making the
 * convergence idempotent. A head change supersedes the wave before the new
 * push's snapshot converges, and a zero-check snapshot inside the
 * registration window is polled through rather than believed.
 *
 * The collector's schemas are deliberately minimal — the watch needs the head,
 * the PR state, mergeability, check names with raw bucket/state strings, and
 * thread resolution. Yeet status owns the richer shapes; duplicating its deep
 * private class chain here would couple the two surfaces for fields the watch
 * never reads.
 *
 * **Gotchas**
 *
 * The stream reports transitions, not summaries: a consumer that wants "is it
 * green now" folds the rows or asks `yeet status --remote`. And the poll clock
 * is injectable because the tests drive the loop with zero delays — wall-clock
 * sleeps in tests are how suites time out under TestClock.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { SchemaUtils } from "@beep/schema";
import { Console, DateTime, Duration, Effect, FileSystem, flow, HashSet, pipe, Ref, Result } from "effect";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { GhActor } from "../../../internal/github/index.ts";
import { runRepoCommandCapture } from "../../../internal/repo-run/index.ts";
import { decideHeavyAdmission, HeavyAdmission, HeavyAdmissionEvent } from "../../Ci/HeavyAdmission.ts";
import { YeetCommandError } from "../Yeet.errors.ts";
import { runArtifactPathForContext } from "./ArtifactPaths.ts";
import { YeetCheckOutcome } from "./CheckOutcome.ts";
import { PrCloseoutReportJson } from "./Closeout.ts";
import { convergeYeetInbox, YeetConvergeObservation } from "./Converge.ts";
import { NO_CHECKS_REPORTED } from "./MonitorChecks.ts";
import {
  acknowledgeYeetMonitorComments,
  collectNewYeetMonitorComments,
  isYeetMonitorThreadComment,
  openYeetMonitorCommentStream,
  renderYeetMonitorCommentStreamStopped,
  YEET_MONITOR_COMMENT_FAILURE_BUDGET,
} from "./MonitorComments.ts";
import { YEET_SETTLE_TIMEOUT_DEFAULT_MILLIS } from "./MonitorPolicy.ts";
import { supersedeYeetDispatchState } from "./Remediation.ts";
import {
  deriveYeetReviewThreadState,
  YeetReviewThreadNewestComment,
  YeetReviewThreadStateInput,
  yeetReviewCommentAuthorKind,
  yeetReviewThreadStateOutstanding,
} from "./ReviewThreadState.ts";
import {
  deriveSettleVerdict,
  readYeetChangedPaths,
  readYeetRulesetRequiredContexts,
  rememberRegistered,
  renderYeetSettleDetail,
  YeetGatedContextFamily,
  YeetRulesetRequiredContexts,
  YeetSettleCheck,
  YeetSettleInput,
  YeetSettleVerdict,
  yeetBaseConflictFor,
  yeetGatedFamiliesFor,
  yeetSettleClockReset,
} from "./Settle.ts";
import { YeetMergeReadyCriteria } from "./Verdict.ts";
import {
  classifyYeetCheckOutcome,
  countYeetWatchFailures,
  countYeetWatchOptionalFailures,
  diffYeetWatchSnapshots,
  renderYeetWatchEventLine,
  YeetCheckSignal,
  YeetWatchCheck,
  YeetWatchDiffInput,
  YeetWatchEnded,
  YeetWatchEndReason,
  YeetWatchSnapshot,
  YeetWatchStarted,
  YeetWatchThread,
  yeetCheckRecordText,
  yeetWatchCommentEvent,
  yeetWatchEndReason,
} from "./WatchStream.ts";
import type { Path } from "effect";
import type * as Crypto from "effect/Crypto";
import type { ChildProcessSpawner } from "effect/unstable/process";
import type { RepoRunContext } from "../../../internal/repo-run/index.ts";
import type { YeetMonitorCommentWatermark } from "./MonitorComments.ts";
import type { YeetWatchEvent } from "./WatchStream.ts";

const $I = $RepoCliId.create("commands/Yeet/internal/WatchMode");

class WatchPullRequestLabel extends S.Class<WatchPullRequestLabel>($I`WatchPullRequestLabel`)(
  { name: S.String },
  $I.annote("WatchPullRequestLabel", { description: "One label on the pull request as gh pr view reports it." })
) {}

class WatchPullRequestView extends S.Class<WatchPullRequestView>($I`WatchPullRequestView`)(
  {
    headRefOid: S.NonEmptyString,
    id: S.NonEmptyString,
    isDraft: S.Boolean,
    labels: S.Array(WatchPullRequestLabel).pipe(SchemaUtils.withKeyDefaults(A.empty<WatchPullRequestLabel>())),
    mergeable: S.NullOr(S.String),
    mergeStateStatus: S.NullOr(S.String),
    number: S.Finite,
    reviewDecision: S.NullOr(S.String),
    state: S.String,
  },
  $I.annote("WatchPullRequestView", {
    description: "The minimal gh pr view payload the watch stream reads.",
  })
) {}

class WatchCheckRow extends S.Class<WatchCheckRow>($I`WatchCheckRow`)(
  {
    bucket: S.String,
    link: S.NullOr(S.String),
    name: S.String,
    state: S.String,
    workflow: S.NullOr(S.String),
  },
  $I.annote("WatchCheckRow", {
    description: "One raw gh pr checks row: name, unclassified bucket/state strings, job link, and workflow.",
  })
) {}

class WatchThreadComment extends S.Class<WatchThreadComment>($I`WatchThreadComment`)(
  { author: GhActor.pipe(S.NullOr, S.optionalKey), createdAt: S.optionalKey(S.String) },
  $I.annote("WatchThreadComment", { description: "One review-thread comment reduced to its author and timestamp." })
) {}

class WatchThreadCommentConnection extends S.Class<WatchThreadCommentConnection>($I`WatchThreadCommentConnection`)(
  { nodes: S.Array(WatchThreadComment).pipe(SchemaUtils.withKeyDefaults(A.empty<WatchThreadComment>())) },
  $I.annote("WatchThreadCommentConnection", { description: "The newest-comment connection of one review thread." })
) {}

// `isOutdated`, `resolvedBy` and `latest` default rather than being required:
// they are what the state rule reads, and a payload recorded before the watch
// asked for them classifies as the conservative unresolved/answered pair
// instead of failing the whole poll.
class WatchThreadNode extends S.Class<WatchThreadNode>($I`WatchThreadNode`)(
  {
    id: S.NonEmptyString,
    isResolved: S.Boolean,
    isOutdated: S.Boolean.pipe(SchemaUtils.withKeyDefaults(false)),
    path: S.NullOr(S.String).pipe(SchemaUtils.withKeyDefaults(null)),
    line: S.NullOr(S.Finite).pipe(SchemaUtils.withKeyDefaults(null)),
    resolvedBy: GhActor.pipe(S.NullOr, S.optionalKey),
    latest: S.optionalKey(WatchThreadCommentConnection),
  },
  $I.annote("WatchThreadNode", { description: "One review thread's identity, resolution, and newest comment." })
) {}

class WatchThreadPageInfo extends S.Class<WatchThreadPageInfo>($I`WatchThreadPageInfo`)(
  {
    endCursor: S.NullOr(S.String),
    hasNextPage: S.Boolean,
  },
  $I.annote("WatchThreadPageInfo", { description: "Cursor metadata for one review-thread page." })
) {}

class WatchThreadsDocument extends S.Class<WatchThreadsDocument>($I`WatchThreadsDocument`)(
  {
    data: S.Struct({
      node: S.NullOr(
        S.Struct({
          author: GhActor.pipe(S.NullOr, S.optionalKey),
          reviewThreads: S.Struct({ nodes: S.Array(WatchThreadNode), pageInfo: WatchThreadPageInfo }),
        })
      ),
    }),
  },
  $I.annote("WatchThreadsDocument", { description: "The GraphQL document shape of the watch's thread query." })
) {}

const decodePullRequestView = S.decodeUnknownEffect(S.fromJsonString(WatchPullRequestView));
const decodeCheckRows = S.decodeUnknownEffect(S.fromJsonString(S.Array(WatchCheckRow)));
const decodeThreadsDocument = S.decodeUnknownEffect(S.fromJsonString(WatchThreadsDocument));

const watchThreadsQuery =
  "query($id:ID!,$cursor:String){node(id:$id){... on PullRequest{author{login} reviewThreads(first:100,after:$cursor){pageInfo{hasNextPage endCursor} nodes{id isResolved isOutdated path line resolvedBy{login} latest:comments(last:1){nodes{author{__typename login} createdAt}}}}}}}";

const acceptableWatchMergeStates: ReadonlyArray<string> = ["BEHIND", "CLEAN", "HAS_HOOKS", "UNSTABLE"];

const checksRead = Effect.fn("Yeet.checksRead")(function* (
  context: RepoRunContext,
  required: boolean
): Effect.fn.Return<
  ReadonlyArray<WatchCheckRow>,
  YeetCommandError,
  Crypto.Crypto | ChildProcessSpawner.ChildProcessSpawner
> {
  const result = yield* runRepoCommandCapture(
    "gh",
    ["pr", "checks", ...(required ? ["--required"] : []), "--json", "name,state,bucket,link,workflow"],
    context.repoRoot
  ).pipe(Effect.mapError(YeetCommandError.new("Failed to read PR checks for yeet watch.")));
  if (result.exitCode !== 0 && !NO_CHECKS_REPORTED.test(result.output)) {
    return yield* YeetCommandError.make({
      message: `yeet watch could not read PR checks: ${result.output}`,
      exitCode: 1,
    });
  }
  return result.exitCode === 0
    ? yield* decodeCheckRows(result.output).pipe(
        Effect.mapError(YeetCommandError.new("Failed to decode gh pr checks JSON for yeet watch."))
      )
    : A.empty<WatchCheckRow>();
});

// The watch reads the same structural facts the status gate classifies on, so
// both surfaces answer "is anything outstanding" with one rule rather than two
// that can disagree about a resolved thread a reviewer has spoken on since.
const watchThreadState = (node: WatchThreadNode, pullRequestAuthor: O.Option<string>) =>
  deriveYeetReviewThreadState(
    YeetReviewThreadStateInput.make({
      threadId: node.id,
      isResolved: node.isResolved,
      isOutdated: node.isOutdated,
      path: O.fromNullishOr(node.path),
      line: O.fromNullishOr(node.line),
      pullRequestAuthor,
      resolvedBy: pipe(
        O.fromUndefinedOr(node.resolvedBy),
        O.flatMap(O.fromNullishOr),
        O.map((actor) => actor.login)
      ),
      newestComment: pipe(
        O.fromUndefinedOr(node.latest),
        O.flatMap((latest) => A.last(latest.nodes)),
        O.flatMap((comment) =>
          O.map(O.fromNullishOr(comment.author), (author) =>
            YeetReviewThreadNewestComment.make({
              authorLogin: author.login,
              authorKind: yeetReviewCommentAuthorKind(O.fromUndefinedOr(author.__typename)),
              createdAt: O.fromUndefinedOr(comment.createdAt),
            })
          )
        )
      ),
    })
  );

// fallow-ignore-next-line complexity -- the GraphQL cursor and page validity checks form one pagination state machine
const reviewThreadsRead = Effect.fn("Yeet.reviewThreadsRead")(function* (
  context: RepoRunContext,
  pullRequestId: string
) {
  const nodes: Array<WatchThreadNode> = [];
  let pullRequestAuthor = O.none<string>();
  let cursor = O.none<string>();
  while (true) {
    const result = yield* runRepoCommandCapture(
      "gh",
      [
        "api",
        "graphql",
        "-f",
        `query=${watchThreadsQuery}`,
        "-F",
        `id=${pullRequestId}`,
        ...O.match(cursor, { onNone: () => [], onSome: (value) => ["-F", `cursor=${value}`] }),
      ],
      context.repoRoot
    ).pipe(Effect.mapError(YeetCommandError.new("Failed to read PR review threads for yeet watch.")));
    if (result.exitCode !== 0) {
      return yield* YeetCommandError.make({
        message: `yeet watch could not read PR review threads: ${result.output}`,
        exitCode: 1,
      });
    }
    const node = yield* decodeThreadsDocument(result.output).pipe(
      Effect.map((document) => document.data.node),
      Effect.mapError(YeetCommandError.new("Failed to decode PR review threads JSON for yeet watch."))
    );
    if (node === null) return { pullRequestAuthor, nodes };
    pullRequestAuthor = O.orElse(pullRequestAuthor, () =>
      pipe(
        O.fromUndefinedOr(node.author),
        O.flatMap(O.fromNullishOr),
        O.map((author) => author.login)
      )
    );
    const connection = node.reviewThreads;
    nodes.push(...connection.nodes);
    if (!connection.pageInfo.hasNextPage) return { pullRequestAuthor, nodes };
    if (connection.pageInfo.endCursor === null || Str.isEmpty(connection.pageInfo.endCursor)) {
      return yield* YeetCommandError.make({
        message: "PR review threads reported another GraphQL page without an end cursor.",
        exitCode: 1,
      });
    }
    cursor = O.some(connection.pageInfo.endCursor);
  }
});

/**
 * Collect one typed snapshot of the current branch's pull request.
 *
 * **Details**
 *
 * Three reads, same argv surfaces yeet status uses: `gh pr view` for identity
 * and mergeability, `gh pr checks --json name,state,bucket,link,workflow` for
 * the rollup, and one GraphQL thread query for resolution states. Raw
 * bucket/state strings classify into the closed outcome domain at this
 * boundary, and each check keeps its own record fields (link, workflow, raw
 * signal) so a failure capsule can derive from the failing check's record, so
 * everything downstream speaks {@link YeetWatchSnapshot}.
 *
 * A PR with zero checks yet is returned as-is; the caller decides whether that
 * ends the watch. Only `gh pr checks`' "no checks reported" exit reads as an
 * empty rollup — that is GitHub's registration gap, and the registration story
 * belongs to the caller's backoff. Every other non-zero read (authentication,
 * rate limit, network) fails the collection: an outage that decoded to an
 * empty rollup would end the watch as a green `all-terminal`, and a thread
 * read that decayed to an empty set would make the next good poll re-report
 * every existing thread as newly opened.
 *
 * **Example** (Build the collector effect)
 *
 * ```ts
 * import { collectYeetWatchSnapshot, RepoRunContext } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 *
 * const context = RepoRunContext.make({
 *   base: "origin/main",
 *   branch: "feature/watch",
 *   cwd: ".",
 *   head: "HEAD",
 *   originalArgv: [],
 *   packetDir: ".beep/yeet",
 *   repoRoot: ".",
 *   turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] }
 * })
 *
 * console.log(Effect.isEffect(collectYeetWatchSnapshot(context))) // true
 * ```
 *
 * @param context - Repo context naming the checkout to read from.
 * @returns The snapshot this poll observed.
 * @category services
 * @since 0.0.0
 */
export const collectYeetWatchSnapshot = Effect.fn("Yeet.collectYeetWatchSnapshot")(function* (
  context: RepoRunContext
): Effect.fn.Return<
  YeetWatchSnapshot,
  YeetCommandError,
  Crypto.Crypto | ChildProcessSpawner.ChildProcessSpawner | FileSystem.FileSystem | Path.Path
> {
  const viewResult = yield* runRepoCommandCapture(
    "gh",
    ["pr", "view", "--json", "id,number,state,isDraft,mergeable,mergeStateStatus,reviewDecision,headRefOid,labels"],
    context.repoRoot
  ).pipe(Effect.mapError(YeetCommandError.new("Failed to read the pull request for yeet watch.")));
  if (viewResult.exitCode !== 0) {
    return yield* YeetCommandError.make({
      message: "yeet monitor --watch requires an open pull request for the current branch.",
      exitCode: 1,
    });
  }
  const view = yield* decodePullRequestView(viewResult.output).pipe(
    Effect.mapError(YeetCommandError.new("Failed to decode gh pr view JSON for yeet watch."))
  );

  const [checkRows, requiredCheckRows] = yield* Effect.all([checksRead(context, false), checksRead(context, true)]);

  const threadPages = yield* reviewThreadsRead(context, view.id);
  const threadStates = A.map(threadPages.nodes, (node) => watchThreadState(node, threadPages.pullRequestAuthor));

  const closeoutPath = yield* runArtifactPathForContext(context, "pr-closeout.json");
  const fs = yield* FileSystem.FileSystem;
  const closeout = yield* fs
    .readFileString(closeoutPath)
    .pipe(Effect.option, Effect.map(O.flatMap(PrCloseoutReportJson.decodeOption)));
  const closeoutRun = O.exists(closeout, (report) =>
    O.exists(report.reviewedHeadSha, (reviewedHeadSha) => reviewedHeadSha === view.headRefOid)
  );
  const requiredChecksGreen =
    A.isReadonlyArrayNonEmpty(requiredCheckRows) &&
    A.every(requiredCheckRows, (row) => {
      const outcome = classifyYeetCheckOutcome(YeetCheckSignal.make({ bucket: row.bucket, state: row.state }));
      return YeetCheckOutcome.is.pass(outcome) || YeetCheckOutcome.is.skip(outcome);
    });
  // Same predicate the status gate uses: a thread the author resolved with a
  // human reviewer speaking last still owes an answer, so a watch that only
  // asked `isResolved` would call the pull request ready while the gate held.
  const threadsResolved =
    !A.some(threadStates, yeetReviewThreadStateOutstanding) && !O.exists(closeout, (report) => report.issueCount > 0);
  const mergeStateStatus = view.mergeStateStatus ?? "UNKNOWN";
  const criteria = YeetMergeReadyCriteria.make({
    prOpen: Str.toUpperCase(view.state) === "OPEN",
    notDraft: !view.isDraft,
    closeoutRun,
    requiredChecksGreen,
    threadsResolved,
    mergeable: Str.toUpperCase(view.mergeable ?? "UNKNOWN") === "MERGEABLE",
    mergeStateAcceptable: A.contains(acceptableWatchMergeStates, Str.toUpperCase(mergeStateStatus)),
    reviewDecisionAcceptable:
      view.reviewDecision === null ||
      Str.isEmpty(view.reviewDecision) ||
      Str.toUpperCase(view.reviewDecision) === "APPROVED",
    greptileScore: O.none(),
  });

  return YeetWatchSnapshot.make({
    checks: A.map(checkRows, (row) => {
      const signal = YeetCheckSignal.make({ bucket: row.bucket, state: row.state });
      return YeetWatchCheck.make({
        name: row.name,
        outcome: classifyYeetCheckOutcome(signal),
        required: A.some(requiredCheckRows, (requiredRow) => requiredRow.name === row.name),
        link: O.getOrNull(yeetCheckRecordText(row.link)),
        signal,
        workflow: O.getOrNull(yeetCheckRecordText(row.workflow)),
      });
    }),
    headSha: view.headRefOid,
    mergeable: view.mergeable ?? "UNKNOWN",
    mergeStateStatus,
    prNumber: view.number,
    state: view.state,
    labels: A.map(view.labels, (label) => label.name),
    threads: A.map(threadStates, (state) => YeetWatchThread.make({ id: state.threadId, state: state.state })),
    criteria,
  });
});

// `settleClockMs` is the origin of `waitedMs`: the first observation of the
// head, moved forward whenever the heavy admission verdict flips so time spent
// held never counts toward the settle budget (ttc B8). `changedPaths` is read
// once per head; `admission` is re-decided every poll from the snapshot's
// labels, the only admission input that changes without a push.
class WatchSettleState extends S.Class<WatchSettleState>($I`WatchSettleState`)(
  {
    headSha: S.NonEmptyString,
    firstObservedMs: S.Finite,
    settleClockMs: S.Finite,
    expected: YeetRulesetRequiredContexts.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    families: S.Array(YeetGatedContextFamily).pipe(SchemaUtils.withKeyDefaults(A.empty<YeetGatedContextFamily>())),
    changedPaths: S.Array(S.String).pipe(SchemaUtils.withKeyDefaults(A.empty<string>())),
    admission: HeavyAdmission.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    // Every check name ever reported for this head: an absent one later is pending, not missing.
    registered: S.HashSet(S.String).pipe(SchemaUtils.withKeyDefaults(HashSet.empty<string>())),
    verdict: YeetSettleVerdict.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  },
  $I.annote("WatchSettleState", {
    description: "One head's cached ruleset, gated families, merge-base diff, admission, and settle clock origin.",
  })
) {}

class WatchSettleStep extends S.Class<WatchSettleStep>($I`WatchSettleStep`)(
  {
    head: WatchSettleState,
    checks: S.Array(YeetSettleCheck),
  },
  $I.annote("WatchSettleStep", {
    description: "One poll's advanced head state plus the checks the settle rule reads, recalled names included.",
  })
) {}

// A new head: read the ruleset and the merge-base diff once, start both clocks.
const newWatchSettleState = Effect.fn("Yeet.newWatchSettleState")(function* (
  context: RepoRunContext,
  config: {
    readonly rulesetRead?: typeof readYeetRulesetRequiredContexts | undefined;
    readonly changedPathsRead?: typeof readYeetChangedPaths | undefined;
  },
  snapshot: YeetWatchSnapshot,
  millis: number
) {
  const expected = yield* (config.rulesetRead ?? readYeetRulesetRequiredContexts)(context);
  return WatchSettleState.make({
    headSha: snapshot.headSha,
    firstObservedMs: millis,
    settleClockMs: millis,
    expected,
    families: O.match(expected, { onNone: A.empty<YeetGatedContextFamily>, onSome: yeetGatedFamiliesFor }),
    changedPaths: yield* (config.changedPathsRead ?? readYeetChangedPaths)(context),
  });
});

// Re-decide heavy admission from this poll's labels (a flip restarts the settle
// clock) and grow the registration memory, keeping remembered-but-absent
// contexts pending; both are reported on stderr, never in the event stream.
const advanceWatchSettleState = Effect.fn("Yeet.advanceWatchSettleState")(function* (
  observed: WatchSettleState,
  snapshot: YeetWatchSnapshot,
  millis: number
) {
  const admission = decideWatchAdmission(snapshot, observed.changedPaths);
  const previousVerdict = O.map(observed.admission, (value) => value.verdict);
  const flipped = O.exists(previousVerdict, (value) => value !== admission.verdict);
  if (flipped) {
    yield* Console.error(`[yeet] heavy admission: ${O.getOrThrow(previousVerdict)} → ${admission.verdict}`);
  }
  const recall = rememberRegistered(
    observed.registered,
    A.map(snapshot.checks, (check) =>
      YeetSettleCheck.make({ name: check.name, outcome: check.outcome, required: check.required })
    )
  );
  if (A.isReadonlyArrayNonEmpty(recall.recalled)) {
    yield* Console.error(
      `[yeet] rollup: ${A.length(recall.recalled)} registered context(s) absent this poll, kept pending`
    );
  }
  return WatchSettleStep.make({
    head: WatchSettleState.make({
      ...observed,
      admission: O.some(admission),
      registered: recall.registered,
      settleClockMs: flipped ? millis : observed.settleClockMs,
    }),
    checks: recall.checks,
  });
});

// The budget resumed (held → admitted, conflict cleared, rollup flap): time
// spent suspended must not expire the very next verdict, so the clock restarts
// and the caller derives again from zero. An admission flip already reset the
// clock this poll, in which case there is nothing further to resume.
const resumeWatchSettleClock = Effect.fn("Yeet.resumeWatchSettleClock")(function* (
  state: WatchSettleState,
  verdict: YeetSettleVerdict,
  millis: number
) {
  if (state.settleClockMs === millis) return state;
  if (!yeetSettleClockReset(state.verdict, verdict)) return state;
  yield* Console.error("[yeet] settle budget resumed; clock reset");
  return WatchSettleState.make({ ...state, settleClockMs: millis });
});

const decideWatchAdmission = (snapshot: YeetWatchSnapshot, changedPaths: ReadonlyArray<string>): HeavyAdmission =>
  decideHeavyAdmission(
    HeavyAdmissionEvent.make({
      eventName: "pull_request",
      labels: snapshot.labels,
      draft: !snapshot.criteria.notDraft,
      changedPaths,
    })
  );

const isoNow = DateTime.now.pipe(Effect.map(DateTime.formatIso));

const emitWatchEvent = (event: YeetWatchEvent): Effect.Effect<void, YeetCommandError> =>
  renderYeetWatchEventLine(event).pipe(
    Effect.mapError(YeetCommandError.new("Failed to encode a yeet watch event row.")),
    Effect.flatMap(Console.log)
  );

// Converge the inbox to the snapshot through the shared `Converge` module:
// each failing check dispatches with its own record, outstanding threads and
// a BEHIND merge state append once. Running this on every tick is idempotent,
// which is also the retry path for a row whose append failed.
const convergeYeetWatchSnapshot = (
  context: RepoRunContext,
  snapshot: YeetWatchSnapshot,
  at: string
): Effect.Effect<void, never, Crypto.Crypto | FileSystem.FileSystem | Path.Path> =>
  convergeYeetInbox(
    context,
    YeetConvergeObservation.make({
      checks: snapshot.checks,
      headSha: snapshot.headSha,
      mergeStateStatus: snapshot.mergeStateStatus,
      prNumber: snapshot.prNumber,
      threads: snapshot.threads,
    }),
    at
  );

// How many consecutive zero-check polls the watch sits through before it
// believes an empty rollup. GitHub registers a push's checks a few seconds
// after gh starts answering "no checks reported"; ending the watch on that
// window would report a green settle for a wave whose checks never ran. Ten
// polls at the 10s interval ≈ the ~95s patience the classic monitor's
// registration backoff (MonitorChecks) grants the same gap.
const YEET_WATCH_REGISTRATION_PATIENCE = 10;

/**
 * How many post-observation polls a comment batch settles for before an
 * `--until-event` session exits.
 *
 * **Details**
 *
 * Review bots post their comments as a burst spread over tens of seconds. An
 * exit on the very first comment would wake the supervisor once per comment;
 * two extra polls at the 10s watch interval ≈ a 20s settle window that hands
 * the supervisor one batch. Nothing is lost either way — the durable watermark
 * means a comment landing after the exit is the next session's first row.
 *
 * **Example** (Read the bound)
 *
 * ```ts
 * import { YEET_WATCH_COMMENT_SETTLE_TICKS } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(YEET_WATCH_COMMENT_SETTLE_TICKS) // 2
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const YEET_WATCH_COMMENT_SETTLE_TICKS = 2;

/**
 * One watch session's comment poller state: the durable watermark plus the
 * consecutive-failure count and the given-up flag.
 */
interface WatchCommentSession {
  readonly failuresRef: Ref.Ref<number>;
  readonly stoppedRef: Ref.Ref<boolean>;
  readonly watermarkRef: Ref.Ref<YeetMonitorCommentWatermark>;
}

const openWatchCommentSession = Effect.fn("Yeet.openWatchCommentSession")(function* (
  context: RepoRunContext,
  pullRequestNumber: number
): Effect.fn.Return<WatchCommentSession, never, Crypto.Crypto | FileSystem.FileSystem | Path.Path> {
  return {
    failuresRef: yield* Ref.make(0),
    stoppedRef: yield* Ref.make(false),
    watermarkRef: yield* openYeetMonitorCommentStream(context, pullRequestNumber),
  };
});

// Poll the comment collections once and emit one `comment-posted` row per new
// comment. Fetch failures degrade this surface alone — they are reported to
// stderr and counted, and after the budget the poller goes quiet for the rest
// of the session — because a REST hiccup must not end a stream whose check
// reads are still healthy. Row-encoding failures still propagate: an
// unencodable row is a programming error, not weather.
const emitWatchCommentRows = Effect.fn("Yeet.emitWatchCommentRows")(function* (
  context: RepoRunContext,
  snapshot: YeetWatchSnapshot,
  session: WatchCommentSession
): Effect.fn.Return<
  number,
  YeetCommandError,
  Crypto.Crypto | ChildProcessSpawner.ChildProcessSpawner | FileSystem.FileSystem | Path.Path
> {
  if (yield* Ref.get(session.stoppedRef)) {
    return 0;
  }
  const polled = yield* Effect.result(collectNewYeetMonitorComments(context, snapshot.prNumber, session.watermarkRef));
  if (Result.isFailure(polled)) {
    const failures = yield* Ref.updateAndGet(session.failuresRef, (count) => count + 1);
    yield* Console.error(
      `[yeet] watch comment poll failed (${failures}/${YEET_MONITOR_COMMENT_FAILURE_BUDGET}): ${polled.failure.message} Check watching is unaffected.`
    );
    if (failures >= YEET_MONITOR_COMMENT_FAILURE_BUDGET) {
      yield* Ref.set(session.stoppedRef, true);
      yield* Console.error(renderYeetMonitorCommentStreamStopped(YEET_MONITOR_COMMENT_FAILURE_BUDGET));
    }
    return 0;
  }
  yield* Ref.set(session.failuresRef, 0);
  const at = yield* isoNow;
  // Review bodies ride the same stream but carry no path, line or thread, so
  // they are acknowledged with the batch and left out of the `comment-posted`
  // rows rather than given invented coordinates.
  yield* Effect.forEach(
    A.filter(polled.success, isYeetMonitorThreadComment),
    flow(yeetWatchCommentEvent(at, snapshot.headSha), emitWatchEvent),
    { discard: true }
  );
  yield* acknowledgeYeetMonitorComments(context, snapshot.prNumber, session.watermarkRef, polled.success);
  return A.length(polled.success);
});

// Advance the settle countdown: a batch's first comment arms the window, and
// every later tick — more comments included — burns one tick without
// extending it, so the exit lands a fixed distance from the first observation.
const advanceSettleTicks = (settleTicks: O.Option<number>, newComments: number): O.Option<number> =>
  newComments > 0 && O.isNone(settleTicks)
    ? O.some(YEET_WATCH_COMMENT_SETTLE_TICKS)
    : O.map(settleTicks, (remaining) => remaining - 1);

// Emit the terminal row and hand it back as the stream's return value.
const emitWatchEnded = Effect.fn("Yeet.emitWatchEnded")(function* (
  snapshot: YeetWatchSnapshot,
  reason: YeetWatchEndReason
) {
  const ended = YeetWatchEnded.make({
    at: yield* isoNow,
    failing: countYeetWatchFailures(snapshot),
    optionalFailing: countYeetWatchOptionalFailures(snapshot),
    headSha: snapshot.headSha,
    reason,
  });
  yield* emitWatchEvent(ended);
  return ended;
});

// A zero-check OPEN snapshot inside the registration window is not a verdict:
// gh answers "no checks reported" for seconds after a push, and believing it
// would end the watch green while the wave's checks are about to run.
// Merged/closed endings pass through regardless.
const watchTickEnd = (snapshot: YeetWatchSnapshot, emptyPolls: number): O.Option<YeetWatchEndReason> =>
  O.filter(
    yeetWatchEndReason(snapshot),
    (reason) =>
      !(
        YeetWatchEndReason.is["all-terminal"](reason) &&
        A.isReadonlyArrayEmpty(snapshot.checks) &&
        emptyPolls <= YEET_WATCH_REGISTRATION_PATIENCE
      )
  );

// One post-sleep tick: poll, emit the diff, supersede on a head change, and
// converge the inbox. `None` means the poll itself failed and the stream must
// end as a typed poll-error.
const advanceYeetWatchTick = Effect.fn("Yeet.advanceYeetWatchTick")(function* (
  context: RepoRunContext,
  prev: YeetWatchSnapshot,
  emptyPolls: number,
  settle: (
    snapshot: YeetWatchSnapshot
  ) => Effect.Effect<YeetWatchSnapshot, never, Crypto.Crypto | ChildProcessSpawner.ChildProcessSpawner>
) {
  const polled = yield* collectYeetWatchSnapshot(context).pipe(
    Effect.asSome,
    Effect.catch((error) =>
      Console.error(`[yeet] watch poll failed: ${error.message}`).pipe(Effect.as(O.none<YeetWatchSnapshot>()))
    )
  );
  if (O.isNone(polled)) {
    return O.none<{ readonly emptyPolls: number; readonly snapshot: YeetWatchSnapshot }>();
  }
  const next = yield* settle(polled.value);
  const observedAt = yield* isoNow;
  const events = diffYeetWatchSnapshots(YeetWatchDiffInput.make({ at: observedAt, next, prev }));
  yield* Effect.forEach(events, emitWatchEvent, { discard: true });
  const headChanged = next.headSha !== prev.headSha;
  if (headChanged) {
    yield* supersedeYeetDispatchState(context.repoRoot, next.headSha, next.prNumber, observedAt);
  }
  yield* convergeYeetWatchSnapshot(context, next, observedAt);
  // The registration window belongs to a head: a new push starts its own
  // patience budget rather than inheriting whatever the superseded head spent.
  return O.some({
    emptyPolls: A.isReadonlyArrayEmpty(next.checks) ? (headChanged ? 1 : emptyPolls + 1) : 0,
    snapshot: next,
  });
});

// Every way a tick can end the stream, most decisive first: terminal PR
// states, then the `--until-event` exits — a red outranks the settle window
// because by the time this runs, the capsule state for the snapshot is already
// converged and every pending comment row is already emitted; a comment batch
// exits only once its settle countdown is spent.
const watchStreamEnd = (
  untilEvent: boolean,
  snapshot: YeetWatchSnapshot,
  emptyPolls: number,
  settleTicks: O.Option<number>
): O.Option<YeetWatchEndReason> => {
  const end = watchTickEnd(snapshot, emptyPolls);
  // A merged or closed PR remains terminal regardless of the check census.
  // For an open PR, a red is the actionable event even if it also made every
  // check terminal; supervisors route the end row by this reason.
  if (
    O.exists(end, (reason) => YeetWatchEndReason.is["pr-merged"](reason) || YeetWatchEndReason.is["pr-closed"](reason))
  ) {
    return end;
  }
  if (O.exists(snapshot.settle, (verdict) => O.contains(verdict.reason, "settle-timeout"))) {
    return O.some(YeetWatchEndReason.Enum["settle-timeout"]);
  }
  const eventExit = untilEvent && countYeetWatchFailures(snapshot) > 0;
  if (eventExit || (untilEvent && O.exists(settleTicks, (remaining) => remaining <= 0))) {
    return O.some(YeetWatchEndReason.Enum.event);
  }
  return O.exists(snapshot.settle, (verdict) => !verdict.settled) ? O.none() : end;
};

// A zero-check snapshot inside the registration window is narrated to stderr
// so the operator sees the patience being spent instead of a silent stall.
const reportWatchRegistrationWait = (snapshot: YeetWatchSnapshot, emptyPolls: number): Effect.Effect<void> =>
  A.isReadonlyArrayEmpty(snapshot.checks)
    ? Console.error(
        `[yeet] no checks registered for head ${Str.slice(0, 7)(snapshot.headSha)} yet (${emptyPolls}/${YEET_WATCH_REGISTRATION_PATIENCE}); continuing to poll.`
      )
    : Effect.void;

/**
 * Poll the pull request and stream one NDJSON row per state transition.
 *
 * **Details**
 *
 * The loop collects a snapshot, emits `watch-started`, then polls on the given
 * interval: each poll's snapshot diffs against the previous one, every derived
 * event is emitted in order, the inbox converges to the snapshot's failing
 * set on the same tick, and the PR's comment collections are polled through
 * the durable branch-scoped watermark — each new review or conversation
 * comment becomes one `comment-posted` row. The stream ends when the snapshot
 * is terminal — merged, closed, or no check pending — with a final
 * `watch-ended` row carrying the failure census, which is also the returned
 * count so the command can exit non-zero on a red wave. One exception: a
 * zero-check OPEN snapshot within {@link collectYeetWatchSnapshot}'s
 * registration gap is polled through for a bounded number of ticks instead of
 * ending the watch as a green `all-terminal` while the push's checks are
 * still registering.
 *
 * Under `untilEvent` the stream additionally exits on the first actionable
 * batch, with the `event` end reason: immediately when the snapshot carries a
 * failing check — a fresh `pending → fail` transition or a red the very first
 * snapshot already contained — and {@link YEET_WATCH_COMMENT_SETTLE_TICKS}
 * polls after the first new comment, so a review bot's burst lands as one
 * batch instead of one wake per comment. Durable state is written before the
 * exit in both cases: the failure capsule converged on the tick that observed
 * the red, and the comment watermark advanced inside the collector — so a
 * supervising session can act, relaunch, and lose nothing.
 *
 * **Gotchas**
 *
 * A head change does not end the stream: the new wave's transitions simply
 * start diffing against the post-change baseline, which is how "a new push
 * supersedes the prior wave" reads in stream form. A head change also
 * supersedes the persisted wave record before the new snapshot converges, and
 * because capsule ids are keyed on `(prNumber, headSha)`, superseded-wave
 * rows cannot leak into the new wave's session.
 *
 * A failed poll after the stream has started does not escape as an untyped
 * error: the stream ends with a `watch-ended` row whose reason is
 * `poll-error`, carrying the last good snapshot's failure census, so a
 * consumer never sees a truncated stream. Only the *initial* collection fails
 * hard — there is nothing to truncate before `watch-started`. Comment-poll
 * failures are softer still: they degrade the comment surface alone, on the
 * classic monitor's consecutive-failure budget, and never end the watch.
 *
 * An `untilEvent` exit on a failing required check keys on the snapshot, not the
 * transition: a relaunched session over a still-red head exits again
 * immediately. That is deliberate — the ritual relaunches the watch after
 * acting (a push moves the head and starts a fresh wave), and a supervisor
 * that re-arms without acting has asked to be told the branch is still red.
 *
 * **Example** (Build the stream effect)
 *
 * ```ts
 * import { RepoRunContext, runYeetWatchStream } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 *
 * const context = RepoRunContext.make({
 *   base: "origin/main",
 *   branch: "feature/watch",
 *   cwd: ".",
 *   head: "HEAD",
 *   originalArgv: [],
 *   packetDir: ".beep/yeet",
 *   repoRoot: ".",
 *   turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] }
 * })
 *
 * console.log(Effect.isEffect(runYeetWatchStream(context, { intervalMillis: 10_000 }))) // true
 * ```
 *
 * @param context - Repo context naming the checkout to watch from.
 * @param config - Poll interval in milliseconds, the `untilEvent` exit
 * contract switch, the settle budget, and the injectable ruleset, merge-base
 * diff, and clock reads.
 * @returns The final `watch-ended` row: the end reason plus the failure census.
 * @category services
 * @since 0.0.0
 */
// fallow-ignore-next-line complexity -- the polling loop owns one coherent snapshot, comment cursor, and exit decision
export const runYeetWatchStream = Effect.fn("Yeet.runYeetWatchStream")(function* (
  context: RepoRunContext,
  config: {
    readonly intervalMillis: number;
    readonly untilEvent?: boolean;
    readonly settleTimeoutMs?: number;
    readonly rulesetRead?: typeof readYeetRulesetRequiredContexts | undefined;
    readonly changedPathsRead?: typeof readYeetChangedPaths | undefined;
    readonly now?: Effect.Effect<DateTime.Utc>;
  }
): Effect.fn.Return<
  YeetWatchEnded,
  YeetCommandError,
  Crypto.Crypto | ChildProcessSpawner.ChildProcessSpawner | FileSystem.FileSystem | Path.Path
> {
  const untilEvent = config.untilEvent === true;
  let head = O.none<WatchSettleState>();
  const settle = Effect.fn("Yeet.watchSettle")(function* (snapshot: YeetWatchSnapshot) {
    const now = yield* config.now ?? DateTime.now;
    const millis = DateTime.toEpochMillis(now);
    if (O.isNone(head) || head.value.headSha !== snapshot.headSha) {
      head = O.some(yield* newWatchSettleState(context, config, snapshot, millis));
    }
    const step = yield* advanceWatchSettleState(O.getOrThrow(head), snapshot, millis);
    const settleAt = (state: WatchSettleState): YeetSettleVerdict =>
      deriveSettleVerdict(
        YeetSettleInput.make({
          expected: state.expected,
          checks: step.checks,
          closeoutBound: snapshot.criteria.closeoutRun,
          waitedMs: millis - state.settleClockMs,
          timeoutMs: config.settleTimeoutMs ?? YEET_SETTLE_TIMEOUT_DEFAULT_MILLIS,
          families: state.families,
          admission: state.admission,
          baseConflict: yeetBaseConflictFor(O.some(snapshot.mergeable), O.some(snapshot.mergeStateStatus)),
        })
      );
    const currentHead = yield* resumeWatchSettleClock(step.head, settleAt(step.head), millis);
    const verdict = settleAt(currentHead);
    head = O.some(WatchSettleState.make({ ...currentHead, verdict: O.some(verdict) }));
    yield* Console.error(`[yeet] ${renderYeetSettleDetail(verdict)}`);
    return YeetWatchSnapshot.make({ ...snapshot, settle: O.some(verdict) });
  });
  let current = yield* collectYeetWatchSnapshot(context).pipe(Effect.flatMap(settle));
  const startedAt = yield* isoNow;
  yield* emitWatchEvent(
    YeetWatchStarted.make({
      at: startedAt,
      checks: A.length(current.checks),
      headSha: current.headSha,
    })
  );
  // Converge the wave record before seeding: a stale record left by a prior
  // push (or a dead PR on the same branch tip) must not capture this wave's
  // first red as a mere queue entry. Both calls are idempotent when nothing
  // changed.
  yield* supersedeYeetDispatchState(context.repoRoot, current.headSha, current.prNumber, startedAt);
  yield* convergeYeetWatchSnapshot(context, current, startedAt);
  let emptyPolls = A.isReadonlyArrayEmpty(current.checks) ? 1 : 0;

  // A red snapshot is already durable after convergence. Do not let a slow
  // comments endpoint delay the immediate `--until-event` wake it promises.
  const initialEnd = watchStreamEnd(untilEvent, current, emptyPolls, O.none());
  if (O.isSome(initialEnd)) {
    return yield* emitWatchEnded(current, initialEnd.value);
  }

  const comments = yield* openWatchCommentSession(context, current.prNumber);
  // The opening poll drains the gap since the last session's watermark, so a
  // comment posted while nothing was watching becomes this session's first
  // batch instead of silently aging.
  let settleTicks = advanceSettleTicks(O.none(), yield* emitWatchCommentRows(context, current, comments));

  while (true) {
    const end = watchStreamEnd(untilEvent, current, emptyPolls, settleTicks);
    if (O.isSome(end)) {
      return yield* emitWatchEnded(current, end.value);
    }
    yield* reportWatchRegistrationWait(current, emptyPolls);
    // Every successful collection passes through settle before entering this loop.
    // A held head has no budget to race: it sleeps the full interval and
    // re-reads the labels, since only the label can move it.
    const verdict = O.getOrThrow(current.settle);
    // A held head reports `budgetApplies: false`, so it keeps the interval here too.
    const sleepMillis = yeetWatchSettleSleepMillis(verdict, config.intervalMillis);
    yield* Effect.sleep(Duration.millis(sleepMillis));
    const advanced = yield* advanceYeetWatchTick(context, current, emptyPolls, settle);
    if (O.isNone(advanced)) {
      return yield* emitWatchEnded(current, YeetWatchEndReason.Enum["poll-error"]);
    }
    current = advanced.value.snapshot;
    emptyPolls = advanced.value.emptyPolls;
    settleTicks = advanceSettleTicks(settleTicks, yield* emitWatchCommentRows(context, current, comments));
  }
});

/**
 * End reasons that exit `yeet monitor --watch` with a failure code even when
 * no check failed.
 *
 * **Example** (A closed PR is a failed watch)
 *
 * ```ts
 * import { yeetWatchExitFailure } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(yeetWatchExitFailure({ failing: 0, reason: "pr-closed" })) // true
 * ```
 *
 * @param ended - The end reason and required failure count; optional failures do not affect the exit.
 * @returns Whether the command should exit non-zero.
 * @category predicates
 * @since 0.0.0
 */
export const yeetWatchExitFailure = (ended: Pick<YeetWatchEnded, "failing" | "reason">): boolean =>
  ended.failing > 0 ||
  YeetWatchEndReason.is["pr-closed"](ended.reason) ||
  YeetWatchEndReason.is["poll-error"](ended.reason) ||
  YeetWatchEndReason.is["settle-timeout"](ended.reason);

/**
 * How long the watch sleeps before its next poll, given the settle verdict.
 *
 * **Details**
 *
 * Only the registration budget shortens a sleep: while no check has registered
 * or an expected context is missing, the sleep is clamped to the remaining
 * budget so `settle-timeout` fires on time. A settled head, or an unsettled
 * head whose required checks have registered and are merely queued (ruling
 * 49), sleeps the normal interval — never the 0 ms spin a spent budget would
 * otherwise produce.
 *
 * **Example** (A registered queued check keeps the normal interval)
 *
 * ```ts
 * import { YeetExpectedContextCensus, YeetSettleVerdict, yeetWatchSettleSleepMillis } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const census = YeetExpectedContextCensus.make({ matched: ["Lint"], unmatched: [], pending: ["Lint"], missing: [] })
 * const queued = YeetSettleVerdict.make({
 *   settled: false, reason: O.some("required-pending"), census, waitedMs: 5_000, timeoutMs: 1_000, budgetApplies: false
 * })
 * const missing = YeetSettleVerdict.make({
 *   settled: false, reason: O.some("required-pending"),
 *   census: YeetExpectedContextCensus.make({ matched: [], unmatched: [], pending: [], missing: ["Lint"] }),
 *   waitedMs: 400, timeoutMs: 1_000, budgetApplies: true
 * })
 * console.log(yeetWatchSettleSleepMillis(queued, 10_000)) // 10000
 * console.log(yeetWatchSettleSleepMillis(missing, 10_000)) // 600
 * ```
 *
 * @param verdict - The settle verdict of the snapshot just observed.
 * @param intervalMillis - The configured poll interval.
 * @returns Milliseconds to sleep before the next poll.
 * @category utilities
 * @since 0.0.0
 */
export const yeetWatchSettleSleepMillis: {
  (intervalMillis: number): (verdict: YeetSettleVerdict) => number;
  (verdict: YeetSettleVerdict, intervalMillis: number): number;
} = dual(2, (verdict: YeetSettleVerdict, intervalMillis: number): number =>
  verdict.settled || !verdict.budgetApplies
    ? intervalMillis
    : Math.min(intervalMillis, Math.max(0, verdict.timeoutMs - verdict.waitedMs))
);
