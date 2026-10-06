/**
 * The review window of the merge gate: how long a pull request must stay ready
 * for review on its current head before it may merge.
 *
 * **Details**
 *
 * A pull request leaves draft when its content is final, and hosted heavy CI
 * runs while reviewers read it (review-window ruling, 2026-10-06). The merge
 * gate therefore waits a fixed time after the later of two instants: the most
 * recent "marked ready for review" event and the most recent push to the head.
 * No reviewer is required to post; only the elapsed time and review threads
 * gate. Both instants are read over GitHub REST, and a read that fails yields
 * an `unknown` window, which never satisfies the gate.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { Config, DateTime, Duration, Effect, pipe } from "effect";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { runRepoCommandCapture } from "../../../internal/repo-run/index.ts";
import { mergeReadyCriterionHolds, YeetMergeReadyCriterion } from "./Verdict.ts";
import type * as Crypto from "effect/Crypto";
import type { ChildProcessSpawner } from "effect/process";
import type { RepoRunContext } from "../../../internal/repo-run/index.ts";
import type { YeetMergeReadyCriteria } from "./Verdict.ts";

const $I = $RepoCliId.create("commands/Yeet/internal/ReviewWindow");

/**
 * How long a pull request must stay ready for review on its current head
 * before the merge gate opens, unless the environment overrides it.
 *
 * **Example** (Read the default window)
 *
 * ```ts
 * import { YEET_REVIEW_WINDOW_DEFAULT } from "@beep/repo-cli/test/Yeet"
 * import { Duration } from "effect"
 *
 * console.log(Duration.toMinutes(YEET_REVIEW_WINDOW_DEFAULT)) // 20
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const YEET_REVIEW_WINDOW_DEFAULT: Duration.Duration = Duration.minutes(20);

/**
 * The environment variable that overrides the review window duration.
 *
 * **Example** (Name the override)
 *
 * ```ts
 * import { YEET_REVIEW_WINDOW_ENV } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(YEET_REVIEW_WINDOW_ENV) // "BEEP_YEET_REVIEW_WINDOW"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const YEET_REVIEW_WINDOW_ENV = "BEEP_YEET_REVIEW_WINDOW" as const;

/**
 * The configured review window: the environment override, else the default.
 *
 * **Details**
 *
 * The value is an Effect duration string such as `"20 minutes"`. A value that
 * does not parse fails the config, and the reader reports the window as
 * `unknown` instead of falling back to the default. `"0 seconds"` turns the
 * window off, which is how the ruling is reversed without a code change.
 *
 * **Example** (Resolve the window without an override)
 *
 * ```ts
 * import { YeetReviewWindowDuration } from "@beep/repo-cli/test/Yeet"
 * import { ConfigProvider, Duration, Effect } from "effect"
 *
 * const program = YeetReviewWindowDuration.pipe(
 *   Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown({})),
 *   Effect.map(Duration.toMinutes)
 * )
 * console.log(Effect.runSync(program)) // 20
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const YeetReviewWindowDuration: Config.Config<Duration.Duration> = Config.Duration(YEET_REVIEW_WINDOW_ENV).pipe(
  Config.withDefault(YEET_REVIEW_WINDOW_DEFAULT)
);

/**
 * Which instant the review window is counted from.
 *
 * **Details**
 *
 * `ready-for-review` is the latest "marked ready for review" event, `pr-opened`
 * stands in for it on a pull request that was never a draft, and `head-push` is
 * the push that produced the current head. The window counts from whichever is
 * later.
 *
 * **Example** (List the anchors)
 *
 * ```ts
 * import { YeetReviewWindowAnchor } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(YeetReviewWindowAnchor.literals) // ["ready-for-review", "pr-opened", "head-push"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const YeetReviewWindowAnchor = LiteralKit(["ready-for-review", "pr-opened", "head-push"]).pipe(
  $I.annoteSchema("YeetReviewWindowAnchor", {
    description: "The instant a review window is counted from.",
  })
);

/**
 * Which instant the review window is counted from.
 *
 * @category type-level
 * @since 0.0.0
 */
export type YeetReviewWindowAnchor = typeof YeetReviewWindowAnchor.Type;

/**
 * The review window is still running: the merge gate holds.
 *
 * **Example** (Describe an open window)
 *
 * ```ts
 * import { YeetReviewWindowOpen } from "@beep/repo-cli/test/Yeet"
 *
 * const window = YeetReviewWindowOpen.make({
 *   anchor: "head-push", anchoredAt: "2026-10-06T10:00:00.000Z", remainingMs: 420_000, windowMs: 1_200_000,
 * })
 * console.log(window._tag) // "open"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetReviewWindowOpen extends S.TaggedClass<YeetReviewWindowOpen>($I`YeetReviewWindowOpen`)(
  "open",
  { anchor: YeetReviewWindowAnchor, anchoredAt: S.String, remainingMs: S.Finite, windowMs: S.Finite },
  $I.annote("YeetReviewWindowOpen", {
    description: "The review window is still running on the current head; the merge gate holds.",
  })
) {}

/**
 * The review window has run its full length on the current head.
 *
 * **Example** (Describe an elapsed window)
 *
 * ```ts
 * import { YeetReviewWindowElapsed } from "@beep/repo-cli/test/Yeet"
 *
 * const window = YeetReviewWindowElapsed.make({
 *   anchor: "ready-for-review", anchoredAt: "2026-10-06T10:00:00.000Z", windowMs: 1_200_000,
 * })
 * console.log(window._tag) // "elapsed"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetReviewWindowElapsed extends S.TaggedClass<YeetReviewWindowElapsed>($I`YeetReviewWindowElapsed`)(
  "elapsed",
  { anchor: YeetReviewWindowAnchor, anchoredAt: S.String, windowMs: S.Finite },
  $I.annote("YeetReviewWindowElapsed", {
    description: "The review window has run its full length on the current head.",
  })
) {}

/**
 * The review window could not be established, so it does not satisfy the gate.
 *
 * **Example** (Describe an unknown window)
 *
 * ```ts
 * import { YeetReviewWindowUnknown } from "@beep/repo-cli/test/Yeet"
 *
 * const window = YeetReviewWindowUnknown.make({ reason: "the pull request timeline could not be read" })
 * console.log(window._tag) // "unknown"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetReviewWindowUnknown extends S.TaggedClass<YeetReviewWindowUnknown>($I`YeetReviewWindowUnknown`)(
  "unknown",
  { reason: S.NonEmptyString },
  $I.annote("YeetReviewWindowUnknown", {
    description: "The review window could not be established; unknown never satisfies the merge gate.",
  })
) {}

/**
 * The state of a pull request's review window at one read.
 *
 * **Example** (Decode an unknown window)
 *
 * ```ts
 * import { YeetReviewWindow } from "@beep/repo-cli/test/Yeet"
 * import * as S from "effect/Schema"
 *
 * const window = S.decodeUnknownSync(YeetReviewWindow)({ _tag: "unknown", reason: "timeline unreadable" })
 * console.log(window._tag) // "unknown"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const YeetReviewWindow = S.Union([YeetReviewWindowOpen, YeetReviewWindowElapsed, YeetReviewWindowUnknown]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("YeetReviewWindow", {
    description: "Open, elapsed, or unknown state of the merge gate's review window.",
  })
);

/**
 * The state of a pull request's review window at one read.
 *
 * @category type-level
 * @since 0.0.0
 */
export type YeetReviewWindow = typeof YeetReviewWindow.Type;

/**
 * Whether a review window read satisfies the merge gate.
 *
 * **Details**
 *
 * Only an `elapsed` window does. An unread window (`None`) and an `unknown`
 * one both hold the gate: a missing or failed read is never an elapsed window.
 *
 * **Example** (An unread window holds the gate)
 *
 * ```ts
 * import { yeetReviewWindowElapsed } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * console.log(yeetReviewWindowElapsed(O.none())) // false
 * ```
 *
 * @param window - The review window read, when one was taken.
 * @returns Whether the window has elapsed.
 * @category predicates
 * @since 0.0.0
 */
export const yeetReviewWindowElapsed: (window: O.Option<YeetReviewWindow>) => boolean = O.exists(
  S.is(YeetReviewWindowElapsed)
);

interface YeetReviewWindowInstants {
  // "Now", read from the Effect clock by the caller.
  readonly now: DateTime.Utc;
  // When the current head was pushed.
  readonly pushedAt: DateTime.Utc;
  readonly readyAnchor: Exclude<YeetReviewWindowAnchor, "head-push">;
  // When the pull request last became ready for review, and which event says so.
  readonly readyAt: DateTime.Utc;
  // How long the window runs.
  readonly window: Duration.Duration;
}

/**
 * Decide the review window from its two instants and the current time.
 *
 * **Details**
 *
 * The window counts from the later of the ready-for-review instant and the
 * head push, so a new push restarts it and so does a later flip to ready. It
 * is `open` while less than the window has passed and `elapsed` from the exact
 * instant the full window has passed.
 *
 * **Example** (A push seven minutes ago leaves thirteen minutes)
 *
 * ```ts
 * import { decideYeetReviewWindow } from "@beep/repo-cli/test/Yeet"
 * import { DateTime, Duration } from "effect"
 *
 * const window = decideYeetReviewWindow({
 *   now: DateTime.makeUnsafe("2026-10-06T10:07:00Z"),
 *   pushedAt: DateTime.makeUnsafe("2026-10-06T10:00:00Z"),
 *   readyAt: DateTime.makeUnsafe("2026-10-06T09:00:00Z"),
 *   readyAnchor: "ready-for-review",
 *   window: Duration.minutes(20),
 * })
 * console.log(window._tag === "open" ? window.remainingMs : 0) // 780000
 * ```
 *
 * @param instants - The clock reading, the two anchors, and the window length.
 * @returns The open or elapsed window, naming the anchor it counts from.
 * @category utilities
 * @since 0.0.0
 */
export const decideYeetReviewWindow = (
  instants: YeetReviewWindowInstants
): YeetReviewWindowOpen | YeetReviewWindowElapsed => {
  const pushLater = DateTime.isGreaterThan(instants.pushedAt, instants.readyAt);
  const anchor: YeetReviewWindowAnchor = pushLater ? "head-push" : instants.readyAnchor;
  const anchored = pushLater ? instants.pushedAt : instants.readyAt;
  const anchoredAt = DateTime.formatIso(anchored);
  const windowMs = Duration.toMillis(instants.window);
  const remainingMs = windowMs - (DateTime.toEpochMillis(instants.now) - DateTime.toEpochMillis(anchored));
  return remainingMs > 0
    ? YeetReviewWindowOpen.make({ anchor, anchoredAt, remainingMs, windowMs })
    : YeetReviewWindowElapsed.make({ anchor, anchoredAt, windowMs });
};

const anchorLabel = (anchor: YeetReviewWindowAnchor): string =>
  YeetReviewWindowAnchor.$match(anchor, {
    "ready-for-review": () => "it was marked ready for review",
    "pr-opened": () => "it was opened ready for review",
    "head-push": () => "the last push",
  });

const wholeMinutes = (millis: number): number => Math.ceil(millis / Duration.toMillis(Duration.minutes(1)));

/**
 * Render a review window as the one line status and the monitor print.
 *
 * **Example** (Render an open window)
 *
 * ```ts
 * import { renderYeetReviewWindow, YeetReviewWindowOpen } from "@beep/repo-cli/test/Yeet"
 *
 * const line = renderYeetReviewWindow(
 *   YeetReviewWindowOpen.make({
 *     anchor: "head-push", anchoredAt: "2026-10-06T10:00:00.000Z", remainingMs: 420_000, windowMs: 1_200_000,
 *   })
 * )
 * console.log(line.startsWith("review window open: 7 min left")) // true
 * ```
 *
 * @param window - The review window read.
 * @returns The line naming the state, the time left, and the anchor.
 * @category formatting
 * @since 0.0.0
 */
export const renderYeetReviewWindow = (window: YeetReviewWindow): string =>
  YeetReviewWindow.match(window, {
    open: ({ anchor, anchoredAt, remainingMs, windowMs }) =>
      `review window open: ${wholeMinutes(remainingMs)} min left (${wholeMinutes(windowMs)} min after ${anchorLabel(anchor)} at ${anchoredAt})`,
    elapsed: ({ anchor, anchoredAt, windowMs }) =>
      `review window elapsed (${wholeMinutes(windowMs)} min after ${anchorLabel(anchor)} at ${anchoredAt})`,
    unknown: ({ reason }) => `review window unknown: ${reason}; unknown never counts as elapsed`,
  });

// The pull request and head one review window is read for.
interface YeetReviewWindowTarget {
  readonly headSha: string;
  readonly prNumber: number;
}

// Every non-empty output line as an instant, or `None` when the read failed,
// was clipped, or printed a line that is not an instant. One bad line voids
// the whole read: a partly parsed list could hide the latest event.
const readLines = Effect.fn("YeetReviewWindow.readLines")(function* <Line>(
  context: RepoRunContext,
  args: ReadonlyArray<string>,
  capture: typeof runRepoCommandCapture,
  parse: (line: string) => O.Option<Line>
) {
  return yield* capture("gh", args, context.repoRoot).pipe(
    Effect.map((result) =>
      result.exitCode === 0 && !result.truncated
        ? pipe(Str.split(result.output, "\n"), A.map(Str.trim), A.filter(Str.isNonEmpty), A.map(parse), O.all)
        : O.none<ReadonlyArray<Line>>()
    ),
    Effect.orElseSucceed(O.none<ReadonlyArray<Line>>)
  );
});

const readInstants = (context: RepoRunContext, args: ReadonlyArray<string>, capture: typeof runRepoCommandCapture) =>
  readLines(context, args, capture, DateTime.make);

// The timeline events the window reads, as GitHub names them.
const YeetReviewWindowTimelineEvent = LiteralKit(["ready_for_review", "head_ref_force_pushed"]).pipe(
  $I.annoteSchema("YeetReviewWindowTimelineEvent", {
    description: "A pull request timeline event the review window counts from.",
  })
);

interface TimelineInstant {
  readonly at: DateTime.Utc;
  readonly event: typeof YeetReviewWindowTimelineEvent.Type;
}

// One `<event>\t<created_at>` timeline line.
const parseTimelineLine = (line: string): O.Option<TimelineInstant> => {
  const parts = Str.split(line, "\t");
  return O.all({
    event: O.flatMap(A.get(parts, 0), S.decodeUnknownOption(YeetReviewWindowTimelineEvent)),
    at: O.flatMap(A.get(parts, 1), DateTime.make),
  });
};

const timelineInstants = (
  instants: ReadonlyArray<TimelineInstant>,
  event: typeof YeetReviewWindowTimelineEvent.Type
): ReadonlyArray<DateTime.Utc> =>
  pipe(
    instants,
    A.filter((instant) => instant.event === event),
    A.map((instant) => instant.at)
  );

const latestInstant = (instants: ReadonlyArray<DateTime.Utc>): O.Option<DateTime.Utc> =>
  A.isReadonlyArrayNonEmpty(instants) ? O.some(A.max(instants, DateTime.Order)) : O.none();

const earliestInstant = (instants: ReadonlyArray<DateTime.Utc>): O.Option<DateTime.Utc> =>
  A.isReadonlyArrayNonEmpty(instants) ? O.some(A.min(instants, DateTime.Order)) : O.none();

const unknownWindow = (reason: string): YeetReviewWindow => YeetReviewWindowUnknown.make({ reason });

/**
 * Read a pull request's review window from GitHub REST and the Effect clock.
 *
 * **Details**
 *
 * Three REST reads, none of them GraphQL: the issue timeline for the latest
 * `ready_for_review` and `head_ref_force_pushed` events, the pull request's
 * `created_at` when the timeline has no ready event (it was opened ready), and
 * the head commit's check suites, whose earliest `created_at` is when GitHub
 * first received that commit. The push instant is the later of that first
 * receipt and the latest force-push, so a force-push back to a commit GitHub
 * already knew restarts the window. The current time comes from `Clock`, so a
 * test drives it with `TestClock`. The effect never fails: a failed, clipped,
 * or unparsable read, a head with no check suite, and an invalid
 * `BEEP_YEET_REVIEW_WINDOW` each return `unknown` with the reason.
 *
 * **Gotchas**
 *
 * A commit pushed to another branch earlier already has check suites, so a
 * plain (non-force) push of it is counted from that first receipt.
 *
 * **Example** (Build the read effect)
 *
 * ```ts
 * import { readYeetReviewWindow } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(typeof readYeetReviewWindow) // "function"
 * ```
 *
 * @param context - Repo context whose root resolves the GitHub repository.
 * @param target - The pull request number and the head the window is read for.
 * @param capture - Injectable GitHub runner for tests.
 * @returns The open, elapsed, or unknown review window.
 * @category workflows
 * @since 0.0.0
 */
export const readYeetReviewWindow = Effect.fn("Yeet.readYeetReviewWindow")(function* (
  context: RepoRunContext,
  target: YeetReviewWindowTarget,
  capture: typeof runRepoCommandCapture = runRepoCommandCapture
): Effect.fn.Return<YeetReviewWindow, never, Crypto.Crypto | ChildProcessSpawner.ChildProcessSpawner> {
  const window = yield* YeetReviewWindowDuration.pipe(Effect.option);
  if (O.isNone(window)) {
    return unknownWindow(`${YEET_REVIEW_WINDOW_ENV} is not a duration such as "20 minutes"`);
  }
  const [timeline, suites] = yield* Effect.all(
    [
      readLines(
        context,
        [
          "api",
          "--paginate",
          `repos/{owner}/{repo}/issues/${target.prNumber}/timeline?per_page=100`,
          "--jq",
          '.[] | select(.event == "ready_for_review" or .event == "head_ref_force_pushed") | [.event, .created_at] | @tsv',
        ],
        capture,
        parseTimelineLine
      ),
      readInstants(
        context,
        [
          "api",
          `repos/{owner}/{repo}/commits/${target.headSha}/check-suites?per_page=100`,
          "--jq",
          ".check_suites[].created_at",
        ],
        capture
      ),
    ],
    { concurrency: "unbounded" }
  );
  if (O.isNone(timeline)) {
    return unknownWindow(`the timeline of pull request #${target.prNumber} could not be read`);
  }
  if (O.isNone(suites)) {
    return unknownWindow(`the check suites of head ${target.headSha} could not be read`);
  }
  const firstReceivedAt = earliestInstant(suites.value);
  if (O.isNone(firstReceivedAt)) {
    return unknownWindow(`head ${target.headSha} has no check suite yet, so its push time is not known`);
  }
  // A force-push back to a commit GitHub already knew creates no new check
  // suite, so the latest force-push event is the push instant when it is later.
  const pushedAt = pipe(
    latestInstant(timelineInstants(timeline.value, "head_ref_force_pushed")),
    O.map((forcedAt) => DateTime.max(forcedAt, firstReceivedAt.value)),
    O.getOrElse(() => firstReceivedAt.value)
  );
  const flippedAt = latestInstant(timelineInstants(timeline.value, "ready_for_review"));
  // No ready-for-review event on a pull request that is not a draft: it was
  // opened ready, and its creation is when reviewers could first read it.
  const openedAt = O.isSome(flippedAt)
    ? O.none<DateTime.Utc>()
    : yield* readInstants(
        context,
        ["api", `repos/{owner}/{repo}/pulls/${target.prNumber}`, "--jq", ".created_at"],
        capture
      ).pipe(Effect.map(O.flatMap(latestInstant)));
  const ready = pipe(
    O.map(flippedAt, (at) => ({ at, anchor: YeetReviewWindowAnchor.Enum["ready-for-review"] })),
    O.orElse(() => O.map(openedAt, (at) => ({ at, anchor: YeetReviewWindowAnchor.Enum["pr-opened"] })))
  );
  if (O.isNone(ready)) {
    return unknownWindow(`the creation time of pull request #${target.prNumber} could not be read`);
  }
  return decideYeetReviewWindow({
    now: yield* DateTime.now,
    pushedAt,
    readyAt: ready.value.at,
    readyAnchor: ready.value.anchor,
    window: window.value,
  });
});

/**
 * Whether the review window is the only merge criterion left to establish.
 *
 * **Details**
 *
 * The window costs GitHub REST calls on every poll, and it is named as the
 * blocker only when every other hard criterion holds. Readers therefore take
 * it lazily: while a draft flag, a check, or a thread still blocks, the window
 * stays unread and its criterion stays unsatisfied.
 *
 * **Example** (A pull request with an open thread does not read the window)
 *
 * ```ts
 * import { yeetReviewWindowDue, YeetMergeReadyCriteria } from "@beep/repo-cli/test/Yeet"
 *
 * const criteria = YeetMergeReadyCriteria.make({
 *   prOpen: true, notDraft: true, closeoutRun: true, requiredChecksGreen: true, threadsResolved: false,
 *   mergeable: true, mergeStateAcceptable: true, reviewDecisionAcceptable: true, reviewWindowElapsed: false,
 * })
 * console.log(yeetReviewWindowDue(criteria)) // false
 * ```
 *
 * @param criteria - The merge criteria observed without the review window.
 * @returns Whether every criterion other than the review window holds.
 * @category predicates
 * @since 0.0.0
 */
export const yeetReviewWindowDue = (criteria: YeetMergeReadyCriteria): boolean =>
  A.every(
    YeetMergeReadyCriterion.literals,
    (criterion) =>
      YeetMergeReadyCriterion.is["review-window-elapsed"](criterion) || mergeReadyCriterionHolds(criteria, criterion)
  );

/**
 * The review window detail appended to a "blocked on review-window-elapsed" line.
 *
 * **Example** (Nothing is appended for another blocker)
 *
 * ```ts
 * import { renderYeetReviewWindowHold } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * console.log(renderYeetReviewWindowHold(O.some("threads-resolved"), O.none())) // ""
 * ```
 *
 * @param failing - The criterion the merge-readiness verdict names as its blocker.
 * @param window - The review window read, when one was taken.
 * @returns `": <window line>"` when the review window is the blocker, else an empty string.
 * @category formatting
 * @since 0.0.0
 */
export const renderYeetReviewWindowHold: {
  (window: O.Option<YeetReviewWindow>): (failing: O.Option<YeetMergeReadyCriterion>) => string;
  (failing: O.Option<YeetMergeReadyCriterion>, window: O.Option<YeetReviewWindow>): string;
} = dual(2, (failing: O.Option<YeetMergeReadyCriterion>, window: O.Option<YeetReviewWindow>): string =>
  O.exists(failing, YeetMergeReadyCriterion.is["review-window-elapsed"])
    ? `: ${O.match(window, { onNone: () => "review window not read", onSome: renderYeetReviewWindow })}`
    : Str.empty
);
