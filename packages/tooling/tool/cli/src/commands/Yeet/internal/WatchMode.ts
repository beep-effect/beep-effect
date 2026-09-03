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
 * *converged* to the snapshot — each failing check dispatches through
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
import { Console, DateTime, Duration, Effect, FileSystem, flow, Ref, Result } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { runRepoCommandCapture } from "../../../internal/repo-run/index.ts";
import { YeetCommandError } from "../Yeet.errors.ts";
import { runArtifactPathForContext } from "./ArtifactPaths.ts";
import { PrCloseoutReportJson } from "./Closeout.ts";
import {
  appendYeetInboxRowOnce,
  YeetBaseDriftCapsule,
  YeetBaseDriftRow,
  YeetReviewThreadCapsule,
  YeetReviewThreadRow,
  yeetBaseDriftRowId,
  yeetReviewThreadRowId,
} from "./Inbox.ts";
import { NO_CHECKS_REPORTED } from "./MonitorChecks.ts";
import {
  acknowledgeYeetMonitorComments,
  collectNewYeetMonitorComments,
  openYeetMonitorCommentStream,
  renderYeetMonitorCommentStreamStopped,
  YEET_MONITOR_COMMENT_FAILURE_BUDGET,
} from "./MonitorComments.ts";
import { dispatchYeetCheckFailure, supersedeYeetDispatchState } from "./Remediation.ts";
import { YeetMergeReadyCriteria } from "./Verdict.ts";
import {
  classifyYeetCheckOutcome,
  countYeetWatchFailures,
  diffYeetWatchSnapshots,
  renderYeetWatchEventLine,
  YeetCheckOutcome,
  YeetCheckSignal,
  YeetWatchCheck,
  YeetWatchDiffInput,
  YeetWatchEnded,
  YeetWatchEndReason,
  YeetWatchSnapshot,
  YeetWatchStarted,
  YeetWatchThread,
  yeetWatchCommentEvent,
  yeetWatchEndReason,
} from "./WatchStream.ts";
import type { Path } from "effect";
import type { ChildProcessSpawner } from "effect/unstable/process";
import type { RepoRunContext } from "../../../internal/repo-run/index.ts";
import type { YeetMonitorCommentWatermark } from "./MonitorComments.ts";
import type { YeetWatchEvent } from "./WatchStream.ts";

const $I = $RepoCliId.create("commands/Yeet/internal/WatchMode");

class WatchPullRequestView extends S.Class<WatchPullRequestView>($I`WatchPullRequestView`)(
  {
    headRefOid: S.NonEmptyString,
    id: S.NonEmptyString,
    isDraft: S.Boolean,
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

class WatchThreadNode extends S.Class<WatchThreadNode>($I`WatchThreadNode`)(
  {
    id: S.NonEmptyString,
    isResolved: S.Boolean,
  },
  $I.annote("WatchThreadNode", { description: "One review thread's identity and resolution state." })
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
  "query($id:ID!,$cursor:String){node(id:$id){... on PullRequest{reviewThreads(first:100,after:$cursor){pageInfo{hasNextPage endCursor} nodes{id isResolved}}}}}";

// gh renders an absent link or workflow as "" in some check sources (plain
// commit statuses); the domain speaks null for "the record has no such field".
const presentOrNull = (value: string | null): string | null =>
  P.isNotNull(value) && Str.isNonEmpty(value) ? value : null;

const acceptableWatchMergeStates: ReadonlyArray<string> = ["BEHIND", "CLEAN", "HAS_HOOKS", "UNSTABLE"];

const checksRead = Effect.fn("Yeet.checksRead")(function* (
  context: RepoRunContext,
  required: boolean
): Effect.fn.Return<ReadonlyArray<WatchCheckRow>, YeetCommandError, ChildProcessSpawner.ChildProcessSpawner> {
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

// fallow-ignore-next-line complexity -- the GraphQL cursor and page validity checks form one pagination state machine
const reviewThreadsRead = Effect.fn("Yeet.reviewThreadsRead")(function* (
  context: RepoRunContext,
  pullRequestId: string
) {
  const nodes: Array<WatchThreadNode> = [];
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
    const connection = yield* decodeThreadsDocument(result.output).pipe(
      Effect.map((document) => document.data.node?.reviewThreads),
      Effect.mapError(YeetCommandError.new("Failed to decode PR review threads JSON for yeet watch."))
    );
    if (connection === undefined) return nodes;
    nodes.push(...connection.nodes);
    if (!connection.pageInfo.hasNextPage) return nodes;
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
  ChildProcessSpawner.ChildProcessSpawner | FileSystem.FileSystem | Path.Path
> {
  const viewResult = yield* runRepoCommandCapture(
    "gh",
    ["pr", "view", "--json", "id,number,state,isDraft,mergeable,mergeStateStatus,reviewDecision,headRefOid"],
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

  const threadNodes = yield* reviewThreadsRead(context, view.id);

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
  const threadsResolved =
    A.every(threadNodes, (thread) => thread.isResolved) && !O.exists(closeout, (report) => report.issueCount > 0);
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
        link: presentOrNull(row.link),
        signal,
        workflow: presentOrNull(row.workflow),
      });
    }),
    headSha: view.headRefOid,
    mergeable: view.mergeable ?? "UNKNOWN",
    mergeStateStatus,
    prNumber: view.number,
    state: view.state,
    threads: A.map(threadNodes, (node) => YeetWatchThread.make({ id: node.id, isResolved: node.isResolved })),
    criteria,
  });
});

const isoNow = DateTime.now.pipe(Effect.map(DateTime.formatIso));

const emitWatchEvent = (event: YeetWatchEvent): Effect.Effect<void, YeetCommandError> =>
  renderYeetWatchEventLine(event).pipe(
    Effect.mapError(YeetCommandError.new("Failed to encode a yeet watch event row.")),
    Effect.flatMap(Console.log)
  );

// Converge the inbox to the snapshot: dispatch every check it reports
// failing, passing each failing check's own record — never a name to
// re-resolve, because a rollup can carry two same-named checks. Row ids are
// deterministic and the wave record drops known ids as duplicates, so running
// this on every tick is idempotent — which is also the retry path for a
// capsule whose append failed while its red stayed steady.
const convergeYeetWatchDispatch = Effect.fn("convergeYeetWatchDispatch")(function* (
  context: RepoRunContext,
  snapshot: YeetWatchSnapshot,
  at: string
): Effect.fn.Return<void, never, FileSystem.FileSystem | Path.Path> {
  yield* Effect.forEach(
    A.filter(snapshot.checks, (check) => YeetCheckOutcome.is.fail(check.outcome)),
    (check) => dispatchYeetCheckFailure(context.repoRoot, snapshot, check, at),
    { discard: true }
  );
  yield* Effect.forEach(
    A.filter(snapshot.threads, (thread) => !thread.isResolved),
    (thread) => {
      const capsule = YeetReviewThreadCapsule.make({
        headSha: snapshot.headSha,
        link: null,
        prNumber: snapshot.prNumber,
        threadId: thread.id,
      });
      return appendYeetInboxRowOnce(
        context.repoRoot,
        YeetReviewThreadRow.make({
          capsule,
          checkout: context.repoRoot,
          id: yeetReviewThreadRowId(capsule),
          severity: "P1",
          ts: at,
        })
      ).pipe(
        Effect.catch((error) =>
          Console.error(`[yeet] failed to append review-thread inbox row ${thread.id}: ${error.message}`)
        ),
        Effect.asVoid
      );
    },
    { discard: true }
  );
  if (Str.toUpperCase(snapshot.mergeStateStatus) === "BEHIND") {
    const capsule = YeetBaseDriftCapsule.make({
      base: context.base,
      headSha: snapshot.headSha,
      prNumber: snapshot.prNumber,
    });
    yield* appendYeetInboxRowOnce(
      context.repoRoot,
      YeetBaseDriftRow.make({
        capsule,
        checkout: context.repoRoot,
        id: yeetBaseDriftRowId(capsule),
        severity: "P2",
        ts: at,
      })
    ).pipe(
      Effect.catch((error) => Console.error(`[yeet] failed to append base-drift inbox row: ${error.message}`)),
      Effect.asVoid
    );
  }
});

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
): Effect.fn.Return<WatchCommentSession, never, FileSystem.FileSystem | Path.Path> {
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
  ChildProcessSpawner.ChildProcessSpawner | FileSystem.FileSystem | Path.Path
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
  yield* Effect.forEach(polled.success, flow(yeetWatchCommentEvent(at, snapshot.headSha), emitWatchEvent), {
    discard: true,
  });
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
  emptyPolls: number
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
  const next = polled.value;
  const observedAt = yield* isoNow;
  const events = diffYeetWatchSnapshots(YeetWatchDiffInput.make({ at: observedAt, next, prev }));
  yield* Effect.forEach(events, emitWatchEvent, { discard: true });
  const headChanged = next.headSha !== prev.headSha;
  if (headChanged) {
    yield* supersedeYeetDispatchState(context.repoRoot, next.headSha, next.prNumber, observedAt);
  }
  yield* convergeYeetWatchDispatch(context, next, observedAt);
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
  const eventExit = untilEvent && countYeetWatchFailures(snapshot) > 0;
  if (eventExit || (untilEvent && O.exists(settleTicks, (remaining) => remaining <= 0))) {
    return O.some(YeetWatchEndReason.Enum.event);
  }
  return end;
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
 * An `untilEvent` exit on a failing check keys on the snapshot, not the
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
 * @param config - Poll interval in milliseconds, plus the `untilEvent` exit
 * contract switch.
 * @returns The final `watch-ended` row: the end reason plus the failure census.
 * @category services
 * @since 0.0.0
 */
// fallow-ignore-next-line complexity -- the polling loop owns one coherent snapshot, comment cursor, and exit decision
export const runYeetWatchStream = Effect.fn("Yeet.runYeetWatchStream")(function* (
  context: RepoRunContext,
  config: { readonly intervalMillis: number; readonly untilEvent?: boolean }
): Effect.fn.Return<
  YeetWatchEnded,
  YeetCommandError,
  ChildProcessSpawner.ChildProcessSpawner | FileSystem.FileSystem | Path.Path
> {
  const untilEvent = config.untilEvent === true;
  let current = yield* collectYeetWatchSnapshot(context);
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
  yield* convergeYeetWatchDispatch(context, current, startedAt);
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
    yield* Effect.sleep(Duration.millis(config.intervalMillis));
    const advanced = yield* advanceYeetWatchTick(context, current, emptyPolls);
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
 * @param ended - The end reason and the final failure census.
 * @returns Whether the command should exit non-zero.
 * @category predicates
 * @since 0.0.0
 */
export const yeetWatchExitFailure = (ended: Pick<YeetWatchEnded, "failing" | "reason">): boolean =>
  ended.failing > 0 ||
  YeetWatchEndReason.is["pr-closed"](ended.reason) ||
  YeetWatchEndReason.is["poll-error"](ended.reason);
