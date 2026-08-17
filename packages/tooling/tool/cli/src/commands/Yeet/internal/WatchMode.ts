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
import { Console, DateTime, Duration, Effect } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { runRepoCommandCapture } from "../../../internal/repo-run/index.ts";
import { YeetCommandError } from "../Yeet.errors.ts";
import { NO_CHECKS_REPORTED } from "./MonitorChecks.ts";
import { dispatchYeetCheckFailure, supersedeYeetDispatchState } from "./Remediation.ts";
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
  yeetWatchEndReason,
} from "./WatchStream.ts";
import type { FileSystem, Path } from "effect";
import type { ChildProcessSpawner } from "effect/unstable/process";
import type { RepoRunContext } from "../../../internal/repo-run/index.ts";
import type { YeetWatchEvent } from "./WatchStream.ts";

const $I = $RepoCliId.create("commands/Yeet/internal/WatchMode");

class WatchPullRequestView extends S.Class<WatchPullRequestView>($I`WatchPullRequestView`)(
  {
    headRefOid: S.NonEmptyString,
    id: S.NonEmptyString,
    mergeable: S.NullOr(S.String),
    number: S.Finite,
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

class WatchThreadsDocument extends S.Class<WatchThreadsDocument>($I`WatchThreadsDocument`)(
  {
    data: S.Struct({
      node: S.NullOr(
        S.Struct({
          reviewThreads: S.Struct({ nodes: S.Array(WatchThreadNode) }),
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
  "query($id:ID!){node(id:$id){... on PullRequest{reviewThreads(first:100){nodes{id isResolved}}}}}";

// gh renders an absent link or workflow as "" in some check sources (plain
// commit statuses); the domain speaks null for "the record has no such field".
const presentOrNull = (value: string | null): string | null =>
  P.isNotNull(value) && Str.isNonEmpty(value) ? value : null;

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
): Effect.fn.Return<YeetWatchSnapshot, YeetCommandError, ChildProcessSpawner.ChildProcessSpawner> {
  const viewResult = yield* runRepoCommandCapture(
    "gh",
    ["pr", "view", "--json", "id,number,state,mergeable,headRefOid"],
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

  const checksResult = yield* runRepoCommandCapture(
    "gh",
    ["pr", "checks", "--json", "name,state,bucket,link,workflow"],
    context.repoRoot
  ).pipe(Effect.mapError(YeetCommandError.new("Failed to read PR checks for yeet watch.")));
  if (checksResult.exitCode !== 0 && !NO_CHECKS_REPORTED.test(checksResult.output)) {
    return yield* YeetCommandError.make({
      message: `yeet watch could not read PR checks: ${checksResult.output}`,
      exitCode: 1,
    });
  }
  const checkRows =
    checksResult.exitCode === 0
      ? yield* decodeCheckRows(checksResult.output).pipe(
          Effect.mapError(YeetCommandError.new("Failed to decode gh pr checks JSON for yeet watch."))
        )
      : A.empty<WatchCheckRow>();

  const threadsResult = yield* runRepoCommandCapture(
    "gh",
    ["api", "graphql", "-f", `query=${watchThreadsQuery}`, "-F", `id=${view.id}`],
    context.repoRoot
  ).pipe(Effect.mapError(YeetCommandError.new("Failed to read PR review threads for yeet watch.")));
  if (threadsResult.exitCode !== 0) {
    return yield* YeetCommandError.make({
      message: `yeet watch could not read PR review threads: ${threadsResult.output}`,
      exitCode: 1,
    });
  }
  const threadNodes = yield* decodeThreadsDocument(threadsResult.output).pipe(
    Effect.map((document) => document.data.node?.reviewThreads.nodes ?? A.empty<WatchThreadNode>()),
    Effect.mapError(YeetCommandError.new("Failed to decode PR review threads JSON for yeet watch."))
  );

  return YeetWatchSnapshot.make({
    checks: A.map(checkRows, (row) => {
      const signal = YeetCheckSignal.make({ bucket: row.bucket, state: row.state });
      return YeetWatchCheck.make({
        name: row.name,
        outcome: classifyYeetCheckOutcome(signal),
        link: presentOrNull(row.link),
        signal,
        workflow: presentOrNull(row.workflow),
      });
    }),
    headSha: view.headRefOid,
    mergeable: view.mergeable ?? "UNKNOWN",
    prNumber: view.number,
    state: view.state,
    threads: A.map(threadNodes, (node) => YeetWatchThread.make({ id: node.id, isResolved: node.isResolved })),
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
const convergeYeetWatchDispatch = (
  context: RepoRunContext,
  snapshot: YeetWatchSnapshot,
  at: string
): Effect.Effect<void, never, FileSystem.FileSystem | Path.Path> =>
  Effect.forEach(
    A.filter(snapshot.checks, (check) => YeetCheckOutcome.is.fail(check.outcome)),
    (check) => dispatchYeetCheckFailure(context.repoRoot, snapshot, check, at),
    { discard: true }
  );

// How many consecutive zero-check polls the watch sits through before it
// believes an empty rollup. GitHub registers a push's checks a few seconds
// after gh starts answering "no checks reported"; ending the watch on that
// window would report a green settle for a wave whose checks never ran. Ten
// polls at the 10s interval ≈ the ~95s patience the classic monitor's
// registration backoff (MonitorChecks) grants the same gap.
const YEET_WATCH_REGISTRATION_PATIENCE = 10;

/**
 * Poll the pull request and stream one NDJSON row per state transition.
 *
 * **Details**
 *
 * The loop collects a snapshot, emits `watch-started`, then polls on the given
 * interval: each poll's snapshot diffs against the previous one, every derived
 * event is emitted in order, and the inbox converges to the snapshot's failing
 * set on the same tick. The stream ends when the snapshot is terminal —
 * merged, closed, or no check pending — with a final `watch-ended` row
 * carrying the failure census, which is also the returned count so the
 * command can exit non-zero on a red wave. One exception: a zero-check OPEN
 * snapshot within {@link collectYeetWatchSnapshot}'s registration gap is
 * polled through for a bounded number of ticks instead of ending the watch as
 * a green `all-terminal` while the push's checks are still registering.
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
 * hard — there is nothing to truncate before `watch-started`.
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
 * @param config - Poll interval in milliseconds.
 * @returns The final `watch-ended` row: the end reason plus the failure census.
 * @category services
 * @since 0.0.0
 */
export const runYeetWatchStream = Effect.fn("Yeet.runYeetWatchStream")(function* (
  context: RepoRunContext,
  config: { readonly intervalMillis: number }
): Effect.fn.Return<
  YeetWatchEnded,
  YeetCommandError,
  ChildProcessSpawner.ChildProcessSpawner | FileSystem.FileSystem | Path.Path
> {
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

  while (true) {
    const end = yeetWatchEndReason(current);
    // A zero-check OPEN snapshot inside the registration window is not a
    // verdict: gh answers "no checks reported" for seconds after a push, and
    // believing it would end the watch green while the wave's checks are
    // about to run. Merged/closed endings pass through regardless.
    const awaitingRegistration =
      O.isSome(end) &&
      YeetWatchEndReason.is["all-terminal"](end.value) &&
      A.isReadonlyArrayEmpty(current.checks) &&
      emptyPolls <= YEET_WATCH_REGISTRATION_PATIENCE;
    if (O.isSome(end) && !awaitingRegistration) {
      const ended = YeetWatchEnded.make({
        at: yield* isoNow,
        failing: countYeetWatchFailures(current),
        headSha: current.headSha,
        reason: end.value,
      });
      yield* emitWatchEvent(ended);
      return ended;
    }
    if (awaitingRegistration) {
      yield* Console.error(
        `[yeet] no checks registered for head ${Str.slice(0, 7)(current.headSha)} yet (${emptyPolls}/${YEET_WATCH_REGISTRATION_PATIENCE}); continuing to poll.`
      );
    }

    yield* Effect.sleep(Duration.millis(config.intervalMillis));
    const polled = yield* collectYeetWatchSnapshot(context).pipe(
      Effect.map(O.some),
      Effect.catch((error) =>
        Console.error(`[yeet] watch poll failed: ${error.message}`).pipe(Effect.as(O.none<YeetWatchSnapshot>()))
      )
    );
    if (O.isNone(polled)) {
      const ended = YeetWatchEnded.make({
        at: yield* isoNow,
        failing: countYeetWatchFailures(current),
        headSha: current.headSha,
        reason: "poll-error",
      });
      yield* emitWatchEvent(ended);
      return ended;
    }
    const next = polled.value;
    const observedAt = yield* isoNow;
    const events = diffYeetWatchSnapshots(YeetWatchDiffInput.make({ at: observedAt, next, prev: current }));
    yield* Effect.forEach(events, emitWatchEvent, { discard: true });
    if (next.headSha !== current.headSha) {
      yield* supersedeYeetDispatchState(context.repoRoot, next.headSha, next.prNumber, observedAt);
    }
    yield* convergeYeetWatchDispatch(context, next, observedAt);
    emptyPolls = A.isReadonlyArrayEmpty(next.checks) ? emptyPolls + 1 : 0;
    current = next;
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
