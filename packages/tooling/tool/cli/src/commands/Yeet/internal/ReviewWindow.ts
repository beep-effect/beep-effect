/**
 * The review window of the merge gate: how long a pull request must stay ready
 * for review on its current head before it may merge.
 *
 * **Details**
 *
 * A pull request leaves draft when its content is final, and hosted heavy CI
 * runs while reviewers read it (review-window ruling, 2026-10-06). The merge
 * gate waits after the later of readiness and the head push. A proven GitHub
 * rewrite, or a push that only merges the base and leaves the pull request's
 * own patch identity unchanged (PERIL-09, ruling D12), preserves the earlier
 * push instant; every other push restarts it, and so does a head move whose
 * identity cannot be proven. The uncarried rule uses the most recent "marked
 * ready for review" event and the most recent push to the head.
 * No reviewer is required to post; only the elapsed time and review threads
 * gate. Both instants are read over GitHub REST, and a read that fails yields
 * an `unknown` window, which never satisfies the gate.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Config from "effect/Config";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import { dual, pipe } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { GithubPullRequestRecord, GithubRest } from "../../../internal/github/index.ts";
import { YeetHeadMoveRequest } from "./HeadMove.schemas.ts";
import { YeetHeadMoveClassifier } from "./HeadMove.ts";
import { mergeReadyCriterionHolds, YeetMergeReadyCriterion } from "./Verdict.ts";
import type {
  GithubForcePushRecord,
  GithubRefActivityRecord,
  GithubRefActivityType,
} from "../../../internal/github/GithubRest.ts";
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
 * import * as Duration from "effect/Duration";
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
 * import * as ConfigProvider from "effect/ConfigProvider";
 * import * as Duration from "effect/Duration";
 * import * as Effect from "effect/Effect";
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
 * the push that produced the current head, or the earlier push a proven GitHub
 * rewrite or base merge carries. The window counts from whichever is later.
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

const CarryStepPresenceCheck = S.makeFilter(
  (carry: { readonly rewrites: number; readonly merges: number }) =>
    carry.rewrites + carry.merges > 0 || { path: ["rewrites"], issue: "A carry links at least one head move." },
  $I.annote("CarryStepPresenceCheck", {
    title: "Carry step presence",
    description: "A review-window carry links at least one GitHub rewrite or base merge.",
  })
);

/**
 * Evidence that the current head preserves earlier reviewed patches.
 *
 * **Details**
 *
 * `rewrites` counts linked GitHub rewrites (cascade, restack) and `merges`
 * linked pushes that only merged the base; at least one is positive. A carry
 * built or decoded without `merges` counts none.
 *
 * **Example** (Describe one carried rewrite)
 * ```ts
 * import { YeetReviewWindowCarry } from "@beep/repo-cli/test/Yeet"
 * console.log(YeetReviewWindowCarry.make({ rewrites: 1, rootSha: "root" }).merges) // 0
 * ```
 * @category models
 * @since 0.0.0
 */
export class YeetReviewWindowCarry extends S.Opaque<YeetReviewWindowCarry, { readonly brand: unique symbol }>()(
  S.Struct({
    rewrites: S.Natural,
    merges: S.Natural.pipe(S.withConstructorDefault(Effect.succeed(0)), S.withDecodingDefaultKey(Effect.succeed(0))),
    rootSha: S.NonEmptyString,
  }).pipe(
    S.check(CarryStepPresenceCheck),
    $I.annoteSchema("YeetReviewWindowCarry", {
      description: "Linked GitHub rewrites or base merges preserving the review window.",
    })
  )
) {}

const carriedField = YeetReviewWindowCarry.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone));

class WindowCarryTrail extends S.Opaque<WindowCarryTrail, { readonly brand: unique symbol }>()(
  S.Struct({
    carry: YeetReviewWindowCarry,
    carriedAfters: S.HashSet(S.String),
    rootPushedAt: S.DateTimeUtc,
  }).pipe(
    $I.annoteSchema("WindowCarryTrail", {
      description: "Linked carried heads and the activity instant of their root.",
    })
  )
) {}

class WindowCarryEvidence extends S.Opaque<WindowCarryEvidence, { readonly brand: unique symbol }>()(
  S.Struct({
    carry: YeetReviewWindowCarry,
    carriedAfters: S.HashSet(S.String),
    rootPushedAt: S.DateTimeUtc,
    rootFirstSuite: S.Option(S.DateTimeUtc),
  }).pipe($I.annoteSchema("WindowCarryEvidence", { description: "Trusted root suite and linked rewrite evidence." }))
) {}

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
export class YeetReviewWindowOpen extends S.Opaque<YeetReviewWindowOpen, { readonly brand: unique symbol }>()(
  S.TaggedStruct("open", {
    anchor: YeetReviewWindowAnchor,
    anchoredAt: S.String,
    carried: carriedField,
    remainingMs: S.Finite,
    windowMs: S.Finite,
  }).pipe(
    $I.annoteSchema("YeetReviewWindowOpen", {
      description: "The review window is still running on the current head; the merge gate holds.",
    })
  )
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
export class YeetReviewWindowElapsed extends S.Opaque<YeetReviewWindowElapsed, { readonly brand: unique symbol }>()(
  S.TaggedStruct("elapsed", {
    carried: carriedField,
    anchor: YeetReviewWindowAnchor,
    anchoredAt: S.String,
    windowMs: S.Finite,
  }).pipe(
    $I.annoteSchema("YeetReviewWindowElapsed", {
      description: "The review window has run its full length on the current head.",
    })
  )
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
export class YeetReviewWindowUnknown extends S.Opaque<YeetReviewWindowUnknown, { readonly brand: unique symbol }>()(
  S.TaggedStruct("unknown", { reason: S.NonEmptyString }).pipe(
    $I.annoteSchema("YeetReviewWindowUnknown", {
      description: "The review window could not be established; unknown never satisfies the merge gate.",
    })
  )
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
  readonly carried?: O.Option<YeetReviewWindowCarry>;
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
 * import * as DateTime from "effect/DateTime";
 * import * as Duration from "effect/Duration";
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
  const carried = instants.carried ?? O.none();
  const windowMs = Duration.toMillis(instants.window);
  const remainingMs = windowMs - (DateTime.toEpochMillis(instants.now) - DateTime.toEpochMillis(anchored));
  return remainingMs > 0
    ? YeetReviewWindowOpen.make({ anchor, anchoredAt, remainingMs, windowMs, carried })
    : YeetReviewWindowElapsed.make({ anchor, anchoredAt, windowMs, carried });
};

const anchorLabel = (anchor: YeetReviewWindowAnchor): string =>
  YeetReviewWindowAnchor.match(anchor, {
    "ready-for-review": () => "it was marked ready for review",
    "pr-opened": () => "it was opened ready for review",
    "head-push": () => "the last push",
  });

const wholeMinutes = (millis: number): number => Math.ceil(millis / Duration.toMillis(Duration.minutes(1)));

const carryPart = (count: number, label: string): O.Option<string> =>
  O.liftPredicate(`${count} ${label}`, () => count > 0);

const renderCarry = (carried: O.Option<YeetReviewWindowCarry>): string =>
  O.getOrElse(
    O.map(carried, ({ rewrites, merges, rootSha }) => {
      const steps = A.getSomes([carryPart(rewrites, "GitHub rewrite(s)"), carryPart(merges, "base merge(s)")]);
      return `; carried across ${A.join(steps, " and ")} from ${rootSha}`;
    }),
    () => ""
  );

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
    open: ({ anchor, anchoredAt, remainingMs, windowMs, carried }) =>
      `review window open: ${wholeMinutes(remainingMs)} min left (${wholeMinutes(windowMs)} min after ${anchorLabel(anchor)} at ${anchoredAt})${renderCarry(carried)}`,
    elapsed: ({ anchor, anchoredAt, windowMs, carried }) =>
      `review window elapsed (${wholeMinutes(windowMs)} min after ${anchorLabel(anchor)} at ${anchoredAt})${renderCarry(carried)}`,
    unknown: ({ reason }) => `review window unknown: ${reason}; unknown never counts as elapsed`,
  });

// The pull request and head one review window is read for.
interface YeetReviewWindowTarget {
  readonly headSha: string;
  readonly prNumber: number;
  readonly pull?: GithubPullRequestRecord;
}

/**
 * Shared window decision and the instants used by the REST gate.
 *
 * **Example** (Inspect the evidence schema)
 * ```ts
 * import { YeetReviewWindowEvidence } from "@beep/repo-cli/test/Yeet"
 * console.log(typeof YeetReviewWindowEvidence.make) // "function"
 * ```
 * @category models
 * @since 0.0.0
 */
export class YeetReviewWindowEvidence extends S.Opaque<YeetReviewWindowEvidence, { readonly brand: unique symbol }>()(
  S.Struct({
    result: YeetReviewWindow,
    pushedAt: S.Option(S.DateTimeUtc),
    readyAt: S.Option(S.DateTimeUtc),
    window: S.Duration,
  }).pipe(
    $I.annoteSchema("YeetReviewWindowEvidence", {
      description: "Shared reader instants, configured duration and carry decision.",
    })
  )
) {}

const unknownWindow = (reason: string): YeetReviewWindowEvidence =>
  YeetReviewWindowEvidence.make({
    result: YeetReviewWindowUnknown.make({ reason }),
    pushedAt: O.none(),
    readyAt: O.none(),
    window: YEET_REVIEW_WINDOW_DEFAULT,
  });

const matchesRewriteTime = (at: DateTime.Utc, row: GithubRefActivityRecord): boolean =>
  DateTime.toEpochMillis(at) >= DateTime.toEpochMillis(DateTime.subtract(row.timestamp, { seconds: 60 })) &&
  DateTime.toEpochMillis(at) <= DateTime.toEpochMillis(DateTime.add(row.timestamp, { seconds: 5 }));

const carriesWindowRow = Effect.fn("Yeet.carriesWindowRow")(function* (
  activity: GithubRefActivityRecord,
  headSha: string,
  base: string,
  classifier: YeetHeadMoveClassifier["Service"]
) {
  const move = yield* classifier.classify(YeetHeadMoveRequest.make({ before: activity.before, after: headSha, base }));
  if (move._tag !== "unchanged") return false;
  const committedAt = yield* classifier.committerInstant(activity.after);
  return O.exists(committedAt, (at) => matchesRewriteTime(at, activity));
});

// A base merge carries when its push row moved the branch from the old head and the classifier
// proves the merge left the pull request's own patch unchanged; an unknown verdict never does.
const carriesBaseMergeRow = Effect.fn("Yeet.carriesBaseMergeRow")(function* (
  activity: GithubRefActivityRecord,
  current: string,
  base: string,
  classifier: YeetHeadMoveClassifier["Service"]
) {
  const move = yield* classifier.classifyBaseMerge(
    YeetHeadMoveRequest.make({ before: activity.before, after: current, base })
  );
  return move._tag === "unchanged";
});

// One kind of carried head move: the activity rows it follows, the proof each row needs, and
// how the linked steps are counted.
interface WindowCarryWalk {
  readonly activityType: GithubRefActivityType;
  readonly carries: (activity: GithubRefActivityRecord, current: string) => Effect.Effect<boolean>;
  readonly carryOf: (steps: number, rootSha: string) => YeetReviewWindowCarry;
}

const rewriteWalk = (
  headSha: string,
  base: string,
  classifier: YeetHeadMoveClassifier["Service"]
): WindowCarryWalk => ({
  activityType: "force_push",
  carries: (activity) => carriesWindowRow(activity, headSha, base, classifier),
  carryOf: (rewrites, rootSha) => YeetReviewWindowCarry.make({ rewrites, rootSha }),
});

const baseMergeWalk = (base: string, classifier: YeetHeadMoveClassifier["Service"]): WindowCarryWalk => ({
  activityType: "push",
  carries: (activity, current) => carriesBaseMergeRow(activity, current, base, classifier),
  carryOf: (merges, rootSha) => YeetReviewWindowCarry.make({ rewrites: 0, merges, rootSha }),
});

const walkWindowCarry = Effect.fn("Yeet.walkWindowRewrites")(function* (
  rows: ReadonlyArray<GithubRefActivityRecord>,
  headSha: string,
  walk: WindowCarryWalk
) {
  let current = headSha;
  let carriedAfters = HashSet.empty<string>();
  let row = A.findFirst(rows, (value) => value.after === current);
  while (O.isSome(row) && row.value.activityType === walk.activityType) {
    if (HashSet.has(carriedAfters, current)) return O.none();
    const carries = yield* walk.carries(row.value, current);
    if (!carries) break;
    carriedAfters = HashSet.add(carriedAfters, current);
    current = row.value.before;
    row = A.findFirst(rows, (value) => value.after === current);
  }
  if (HashSet.size(carriedAfters) === 0 || O.isNone(row)) return O.none();
  return O.some(
    WindowCarryTrail.make({
      carry: walk.carryOf(HashSet.size(carriedAfters), current),
      carriedAfters,
      rootPushedAt: row.value.timestamp,
    })
  );
});

const readYeetReviewWindowCarry = Effect.fn("Yeet.readYeetReviewWindowCarry")(function* (
  target: YeetReviewWindowTarget,
  pull: O.Option<GithubPullRequestRecord>,
  classifier: YeetHeadMoveClassifier["Service"],
  baseMerged: boolean
) {
  if (O.isNone(pull) || pull.value.headSha !== target.headSha) return O.none();
  const rest = yield* GithubRest;
  // base.sha is the base at the head's last synchronization, not the local main ref.
  const rows = yield* rest.refActivity(pull.value.headRef).pipe(Effect.option);
  if (O.isNone(rows)) return O.none();
  const base = pull.value.baseSha;
  const walk = baseMerged ? baseMergeWalk(base, classifier) : rewriteWalk(target.headSha, base, classifier);
  const walked = yield* walkWindowCarry(rows.value, target.headSha, walk);
  if (O.isNone(walked)) return O.none();
  const suite = yield* rest.headFirstReceivedAt(walked.value.carry.rootSha).pipe(Effect.option, Effect.map(O.flatten));
  return O.some(WindowCarryEvidence.make({ ...walked.value, rootFirstSuite: suite }));
});

class WindowCarryRead extends S.Opaque<WindowCarryRead, { readonly brand: unique symbol }>()(
  S.Struct({ pull: S.Option(GithubPullRequestRecord), carry: S.Option(WindowCarryEvidence) }).pipe(
    $I.annoteSchema("WindowCarryRead", { description: "One lazy pull read shared by readiness and rewrite evidence." })
  )
) {}

// What the window read already knows when it decides which carry evidence to spend reads on:
// `headParents` is the head's parent list when the timeline it read lists the head as pushed.
class WindowCarryNeeds extends S.Opaque<WindowCarryNeeds, { readonly brand: unique symbol }>()(
  S.Struct({
    openedAt: S.Boolean,
    forcePushes: S.Boolean,
    pushHolds: S.Boolean,
    headParents: S.String.pipe(S.Array, S.Option),
  }).pipe(
    $I.annoteSchema("WindowCarryNeeds", {
      description:
        "Whether the read needs the creation time, saw force pushes and is still held by the push, and the head's parents.",
    })
  )
) {}

// Whether the head may be a base merge, decided without a fetch or another GitHub request, and only
// while the uncarried push still holds the window. The timeline the read already took gives a listed
// head's parents; a head it does not list is read from the local object store only (a commit that is
// not local reads as no merge). Only a two-parent head goes on to the pull read (unless the caller
// supplied the pull), the ref activity read and the proof, which fetches what the checkout lacks.
const probeBaseMerge = (
  headSha: string,
  classifier: O.Option<YeetHeadMoveClassifier["Service"]>,
  needs: WindowCarryNeeds
): Effect.Effect<boolean> =>
  needs.pushHolds && O.isSome(classifier)
    ? O.match(needs.headParents, {
        onSome: (parents) => Effect.succeed(A.length(parents) === 2),
        onNone: () => classifier.value.isLocalMergeCommit(headSha),
      })
    : Effect.succeed(false);

const readWindowPull = (target: YeetReviewWindowTarget, wanted: boolean) =>
  target.pull !== undefined
    ? Effect.succeedSome(target.pull)
    : wanted
      ? GithubRest.use((rest) => rest.pullRequest(target.prNumber)).pipe(Effect.option)
      : Effect.succeedNone;

const readWindowCarry = Effect.fn("Yeet.readWindowCarry")(function* (
  target: YeetReviewWindowTarget,
  needs: WindowCarryNeeds
) {
  const classifier = yield* Effect.serviceOption(YeetHeadMoveClassifier);
  const baseMerged = yield* probeBaseMerge(target.headSha, classifier, needs);
  const carrier = O.filter(classifier, () => needs.forcePushes || baseMerged);
  const pull = yield* readWindowPull(target, O.isSome(carrier) || needs.openedAt);
  const carry = O.isSome(carrier)
    ? yield* readYeetReviewWindowCarry(target, pull, carrier.value, baseMerged)
    : O.none<WindowCarryEvidence>();
  return WindowCarryRead.make({ pull, carry });
});

const reviewWindowPushedAt = (
  forcePushes: ReadonlyArray<GithubForcePushRecord>,
  carry: O.Option<WindowCarryEvidence>,
  firstSuite: DateTime.Utc
): DateTime.Utc => {
  if (O.isNone(carry)) return A.reduce(forcePushes, firstSuite, (at, event) => DateTime.max(at, event.at));
  const evidence = carry.value;
  const root = O.getOrElse(
    O.map(evidence.rootFirstSuite, (at) => DateTime.max(at, evidence.rootPushedAt)),
    () => evidence.rootPushedAt
  );
  return A.reduce(
    A.filter(forcePushes, (event) => !O.exists(event.commitId, (sha) => HashSet.has(evidence.carriedAfters, sha))),
    root,
    (at, event) => DateTime.max(at, event.at)
  );
};

/**
 * Read a pull request's review window from GitHub REST and the Effect clock.
 *
 * **Details**
 *
 * Reads the timeline and current head's first check suite. The pull is reused
 * when supplied, otherwise read lazily for creation time or rewrite evidence.
 * With a classifier, bounded ref activity is walked across proven GitHub
 * rewrites whose committer instants match their activity rows. While the
 * uncarried push still holds the window and the head is a two-parent commit
 * (from the timeline's `committed` events, or else the local object store,
 * never a fetch), the walk follows push rows instead, across merges the
 * classifier proves only merged the synchronized base with the pull request's
 * own patch unchanged; a conflict resolution, a changed patch, a shallow or
 * unreadable history, a failed fetch and an unknown verdict all stop it. The
 * proofs fetch objects the checkout lacks (one `git fetch` bounded at 60
 * seconds, each object at most once per head per checkout per process); the probe
 * never fetches. Every carry
 * terminates at a present root activity row and counts from the later of that
 * row and its optional first suite. Missing links never carry. Unmatched force
 * pushes restart the window, including pushes back to a known commit. Carry
 * is reported only when it moves the push anchor earlier. Failed required
 * reads and invalid `BEEP_YEET_REVIEW_WINDOW` values return `unknown` with the
 * reason. The current time comes from the Effect clock.
 *
 * **Gotchas**
 *
 * A commit pushed to another branch earlier already has check suites, so a
 * plain (non-force) push of it is counted from that first receipt.
 *
 * **Example** (Build the read effect)
 *
 * ```ts
 * import { readYeetReviewWindowEvidence } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(typeof readYeetReviewWindowEvidence) // "function"
 * ```
 *
 * @param target - The pull request number and the head the window is read for.
 * @returns The window decision, push and readiness instants, and configured duration.
 * @category workflows
 * @since 0.0.0
 */
export const readYeetReviewWindowEvidence = Effect.fn("Yeet.readYeetReviewWindowEvidence")(function* (
  target: YeetReviewWindowTarget
): Effect.fn.Return<YeetReviewWindowEvidence, never, GithubRest> {
  const window = yield* YeetReviewWindowDuration.pipe(Effect.option);
  if (O.isNone(window)) {
    return unknownWindow(`${YEET_REVIEW_WINDOW_ENV} is not a duration such as "20 minutes"`);
  }
  const rest = yield* GithubRest;
  const [timeline, suites] = yield* Effect.all(
    [Effect.option(rest.reviewTimeline(target.prNumber)), Effect.option(rest.headFirstReceivedAt(target.headSha))],
    { concurrency: "unbounded" }
  );
  if (O.isNone(timeline)) {
    return unknownWindow(`the timeline of pull request #${target.prNumber} could not be read`);
  }
  if (O.isNone(suites)) {
    return unknownWindow(`the check suites of head ${target.headSha} could not be read`);
  }
  const firstReceivedAt = suites.value;
  if (O.isNone(firstReceivedAt)) {
    return unknownWindow(`head ${target.headSha} has no check suite yet, so its push time is not known`);
  }
  const flippedAt = timeline.value.readyAt;
  const uncarriedPushedAt = reviewWindowPushedAt(timeline.value.forcePushes, O.none(), firstReceivedAt.value);
  const probedAt = yield* DateTime.now;
  const needs = WindowCarryNeeds.make({
    openedAt: O.isNone(flippedAt),
    forcePushes: A.isReadonlyArrayNonEmpty(timeline.value.forcePushes),
    pushHolds: DateTime.isLessThan(probedAt, DateTime.addDuration(uncarriedPushedAt, window.value)),
    headParents: O.map(
      A.findFirst(timeline.value.commits, (commit) => commit.sha === target.headSha),
      (commit) => commit.parents
    ),
  });
  const { pull, carry } = yield* readWindowCarry(target, needs);
  const pushedAt = reviewWindowPushedAt(timeline.value.forcePushes, carry, firstReceivedAt.value);
  const openedAt = O.map(pull, (value) => value.createdAt);
  const ready = pipe(
    O.map(flippedAt, (at) => ({ at, anchor: YeetReviewWindowAnchor.Enum["ready-for-review"] })),
    O.orElse(() => O.map(openedAt, (at) => ({ at, anchor: YeetReviewWindowAnchor.Enum["pr-opened"] })))
  );
  if (O.isNone(ready)) {
    return unknownWindow(`the creation time of pull request #${target.prNumber} could not be read`);
  }
  const result = decideYeetReviewWindow({
    carried: O.filter(carry, () => DateTime.isLessThan(pushedAt, uncarriedPushedAt)).pipe(
      O.map((value) => value.carry)
    ),
    now: yield* DateTime.now,
    pushedAt,
    readyAt: ready.value.at,
    readyAnchor: ready.value.anchor,
    window: window.value,
  });
  return YeetReviewWindowEvidence.make({
    result,
    pushedAt: O.some(pushedAt),
    readyAt: O.some(ready.value.at),
    window: window.value,
  });
});

/**
 * Read the shared review-window decision, including proven rewrite carry.
 *
 * **Example** (Reference the window reader)
 * ```ts
 * import { readYeetReviewWindow } from "@beep/repo-cli/test/Yeet"
 * console.log(typeof readYeetReviewWindow) // "function"
 * ```
 * @param target - Pull number, pinned head, and optional already-read pull.
 * @returns The shared open, elapsed, or unknown decision.
 * @category workflows
 * @since 0.0.0
 */
export const readYeetReviewWindow = Effect.fn("Yeet.readYeetReviewWindow")((target: YeetReviewWindowTarget) =>
  readYeetReviewWindowEvidence(target).pipe(Effect.map((evidence) => evidence.result))
);

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
