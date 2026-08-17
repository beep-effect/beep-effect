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
import * as S from "effect/Schema";
import { runRepoCommandCapture } from "../../../internal/repo-run/index.ts";
import { YeetCommandError } from "../Yeet.errors.ts";
import { NO_CHECKS_REPORTED } from "./MonitorChecks.ts";
import {
  classifyYeetCheckOutcome,
  countYeetWatchFailures,
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
  yeetWatchEndReason,
} from "./WatchStream.ts";
import type { ChildProcessSpawner } from "effect/unstable/process";
import type { RepoRunContext } from "../../../internal/repo-run/index.ts";
import type { YeetWatchEvent } from "./WatchStream.ts";

const $I = $RepoCliId.create("commands/Yeet/internal/WatchMode");

class WatchPullRequestView extends S.Class<WatchPullRequestView>($I`WatchPullRequestView`)(
  {
    headRefOid: S.NonEmptyString,
    id: S.NonEmptyString,
    mergeable: S.NullOr(S.String),
    state: S.String,
  },
  $I.annote("WatchPullRequestView", {
    description: "The minimal gh pr view payload the watch stream reads.",
  })
) {}

class WatchCheckRow extends S.Class<WatchCheckRow>($I`WatchCheckRow`)(
  {
    bucket: S.String,
    name: S.String,
    state: S.String,
  },
  $I.annote("WatchCheckRow", {
    description: "One raw gh pr checks row: name plus unclassified bucket and state strings.",
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

/**
 * Collect one typed snapshot of the current branch's pull request.
 *
 * **Details**
 *
 * Three reads, same argv surfaces yeet status uses: `gh pr view` for identity
 * and mergeability, `gh pr checks --json name,state,bucket` for the rollup,
 * and one GraphQL thread query for resolution states. Raw bucket/state strings
 * classify into the closed outcome domain at this boundary, so everything
 * downstream speaks {@link YeetWatchSnapshot}.
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
    ["pr", "view", "--json", "id,state,mergeable,headRefOid"],
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
    ["pr", "checks", "--json", "name,state,bucket"],
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
    checks: A.map(checkRows, (row) =>
      YeetWatchCheck.make({
        name: row.name,
        outcome: classifyYeetCheckOutcome(YeetCheckSignal.make({ bucket: row.bucket, state: row.state })),
      })
    ),
    headSha: view.headRefOid,
    mergeable: view.mergeable ?? "UNKNOWN",
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

/**
 * Poll the pull request and stream one NDJSON row per state transition.
 *
 * **Details**
 *
 * The loop collects a snapshot, emits `watch-started`, then polls on the given
 * interval: each poll's snapshot diffs against the previous one and every
 * derived event is emitted in order. The stream ends when the snapshot is
 * terminal — merged, closed, or no check pending — with a final `watch-ended`
 * row carrying the failure census, which is also the returned count so the
 * command can exit non-zero on a red wave.
 *
 * **Gotchas**
 *
 * A head change does not end the stream: the new wave's transitions simply
 * start diffing against the post-change baseline, which is how "a new push
 * supersedes the prior wave" reads in stream form. The consumer that dispatches
 * remediation keys its dedup on `headSha`, so superseded-wave rows cannot leak
 * into the new wave's session.
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
): Effect.fn.Return<YeetWatchEnded, YeetCommandError, ChildProcessSpawner.ChildProcessSpawner> {
  let current = yield* collectYeetWatchSnapshot(context);
  yield* emitWatchEvent(
    YeetWatchStarted.make({
      at: yield* isoNow,
      checks: A.length(current.checks),
      headSha: current.headSha,
    })
  );

  while (true) {
    const end = yeetWatchEndReason(current);
    if (O.isSome(end)) {
      const ended = YeetWatchEnded.make({
        at: yield* isoNow,
        failing: countYeetWatchFailures(current),
        headSha: current.headSha,
        reason: end.value,
      });
      yield* emitWatchEvent(ended);
      return ended;
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
    const events = diffYeetWatchSnapshots(YeetWatchDiffInput.make({ at: yield* isoNow, next, prev: current }));
    yield* Effect.forEach(events, emitWatchEvent, { discard: true });
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
