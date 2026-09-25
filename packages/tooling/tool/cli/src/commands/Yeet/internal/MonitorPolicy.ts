/**
 * Loop policies, terminal outcomes, the exit-code table, and the per-head
 * timeline shared by `yeet monitor --until-merged` and `--until-ready`
 * (ttc B7).
 *
 * **Details**
 *
 * One poll loop serves two policies. `until-merged` follows the pull request
 * to `MERGED` (then sweeps) or `CLOSED`; `until-ready` ends the first poll on
 * which merge readiness is `yes`, and otherwise ends on a closed PR, on a
 * settle timeout, or when the consecutive poll-error budget is spent. A
 * required red and a base conflict are not terminal under `until-ready`
 * (pr-event-awareness D16): the loop converges them into inbox rows, re-pins
 * the wave per head, and keeps polling across the fix push, while
 * `yeet job wait` hands control back on the wave. An attached `until-ready`
 * run has no job to wait on, so it ends itself with `wave` (exit 2) on the
 * first new wake-set row on its pull request: any P0 row, or a P1
 * `review-thread` or `pr-comment` row. Optional checks never decide readiness
 * or a failure terminal in either policy; an optional red is still written as
 * a P1 inbox row, but it never wakes a waiter (ttc ruling 42). The exit code
 * and the operator summary for every terminal state live in one table so the
 * CLI, the inbox row, and the tests read the same data.
 *
 * **Gotchas**
 *
 * This module is a leaf: it imports nothing from the other Yeet internals so
 * `Status.ts` (the snapshot carries the timeline) and `MonitorLoop.ts` (the
 * loop consumes the policy) can both depend on it without a cycle.
 *
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { DateTime, Duration, Effect, HashSet, Match, pipe } from "effect";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $RepoCliId.create("commands/Yeet/internal/MonitorPolicy");

/**
 * Default `--settle-timeout`: thirty minutes, matching bors-ng's
 * `prerun_timeout_sec` precedent for "every configured status has reported".
 *
 * **Example** (Read the default)
 *
 * ```ts
 * import { YEET_SETTLE_TIMEOUT_DEFAULT_MILLIS } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(YEET_SETTLE_TIMEOUT_DEFAULT_MILLIS) // 1800000
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const YEET_SETTLE_TIMEOUT_DEFAULT_MILLIS = 30 * 60_000;

/**
 * Consecutive failed polls the merge loop tolerates before ending with
 * `poll-error-budget`. A transient GraphQL or `gh pr view` error is retried on
 * the next tick; five in a row is an outage, not a blip.
 *
 * **Example** (Read the budget)
 *
 * ```ts
 * import { YEET_MONITOR_POLL_ERROR_BUDGET } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(YEET_MONITOR_POLL_ERROR_BUDGET) // 5
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const YEET_MONITOR_POLL_ERROR_BUDGET = 5;

/**
 * Every way a merge loop can end, across both policies.
 *
 * **Details**
 *
 * `merged` and `closed` are pull-request states. `ready` is the
 * `--until-ready` success terminal. `wave` is the attached `--until-ready`
 * hand-back: a new P0/P1 inbox wave landed on the pull request and the loop
 * stops so the operator can fix and re-run it. `settle-timeout` and
 * `poll-error-budget` are the failure terminals; which terminals a policy
 * admits is {@link yeetMonitorPolicyTerminals}, and a loop's, with `wave`, is
 * {@link yeetMonitorLoopTerminals}. A required red is not a
 * terminal state by itself: a detached loop keeps polling past it and
 * `yeet job wait` returns on the wave instead.
 *
 * **Example** (List the terminal states)
 *
 * ```ts
 * import { YeetMonitorTerminalState } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(YeetMonitorTerminalState.Options.length) // 6
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const YeetMonitorTerminalState = LiteralKit([
  "merged",
  "closed",
  "ready",
  "wave",
  "settle-timeout",
  "poll-error-budget",
]).pipe(
  $I.annoteSchema("YeetMonitorTerminalState", {
    title: "Yeet Monitor Terminal State",
    description: "The state that ended a merge loop.",
  })
);

/**
 * Every way a merge loop can end.
 *
 * @category type-level
 * @since 0.0.0
 */
export type YeetMonitorTerminalState = typeof YeetMonitorTerminalState.Type;

/**
 * Whether a merge loop runs attached to the operator's command or detached
 * inside a proof job.
 *
 * **Details**
 *
 * The porcelain decides it from `BEEP_YEET_JOB_ID`, which only a job's unit
 * sets. `detached` loops keep polling through an inbox wave, because
 * `yeet job wait` on the job carries it back. An `attached` `--until-ready`
 * loop has no job to wait on, so it ends with `wave` itself.
 *
 * **Example** (List the attachments)
 *
 * ```ts
 * import { YeetMonitorAttachment } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(YeetMonitorAttachment.Options) // ["attached", "detached"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const YeetMonitorAttachment = LiteralKit(["attached", "detached"]).pipe(
  $I.annoteSchema("YeetMonitorAttachment", {
    title: "Yeet Monitor Attachment",
    description: "Whether a merge loop runs attached to the operator's command or detached inside a proof job.",
  })
);

/**
 * Whether a merge loop runs attached or detached.
 *
 * @category type-level
 * @since 0.0.0
 */
export type YeetMonitorAttachment = typeof YeetMonitorAttachment.Type;

/**
 * Follow the pull request until it merges or closes; announce readiness once
 * per head on the way.
 *
 * @category models
 * @since 0.0.0
 */
export class YeetUntilMergedPolicy extends S.Class<YeetUntilMergedPolicy>($I`YeetUntilMergedPolicy`)(
  {
    kind: S.tag("until-merged"),
    settleTimeoutMs: S.Finite.pipe(S.withConstructorDefault(Effect.succeed(YEET_SETTLE_TIMEOUT_DEFAULT_MILLIS))),
  },
  $I.annote("YeetUntilMergedPolicy", {
    description: "Loop policy that ends only on MERGED (after the sweep) or CLOSED.",
  })
) {}

/**
 * End on the first poll where merge readiness is `yes`; fail on a closed PR, a
 * settle timeout, or a spent poll-error budget. Required reds and base
 * conflicts become inbox rows and the loop keeps polling.
 *
 * @category models
 * @since 0.0.0
 */
export class YeetUntilReadyPolicy extends S.Class<YeetUntilReadyPolicy>($I`YeetUntilReadyPolicy`)(
  {
    kind: S.tag("until-ready"),
    settleTimeoutMs: S.Finite.pipe(S.withConstructorDefault(Effect.succeed(YEET_SETTLE_TIMEOUT_DEFAULT_MILLIS))),
  },
  $I.annote("YeetUntilReadyPolicy", {
    description: "Loop policy that ends with exit 0 on the first merge-ready poll.",
  })
) {}

/**
 * The loop policy `yeet monitor` runs under.
 *
 * **Example** (Decode an until-ready policy)
 *
 * ```ts
 * import { YeetMonitorLoopPolicy } from "@beep/repo-cli/test/Yeet"
 * import * as S from "effect/Schema"
 *
 * const policy = S.decodeUnknownSync(YeetMonitorLoopPolicy)({ kind: "until-ready", settleTimeoutMs: 60_000 })
 * console.log(policy.kind) // "until-ready"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const YeetMonitorLoopPolicy = S.Union([YeetUntilMergedPolicy, YeetUntilReadyPolicy]).pipe(
  S.toTaggedUnion("kind"),
  $I.annoteSchema("YeetMonitorLoopPolicy", {
    description: "Which terminal the merge loop is following: the merge itself, or merge readiness.",
  })
);

/**
 * The loop policy `yeet monitor` runs under.
 *
 * @category type-level
 * @since 0.0.0
 */
export type YeetMonitorLoopPolicy = typeof YeetMonitorLoopPolicy.Type;

/**
 * The terminal states one policy admits.
 *
 * **Details**
 *
 * This is the set for a detached loop, and every policy-level question
 * (does readiness end the loop, does a merge) reads it. `wave` is never in it:
 * only an attached `until-ready` loop ends on a wave, which
 * {@link yeetMonitorLoopTerminals} adds.
 *
 * **Example** (An until-merged loop never ends on readiness)
 *
 * ```ts
 * import { yeetMonitorPolicyTerminals, YeetUntilMergedPolicy } from "@beep/repo-cli/test/Yeet"
 * import { HashSet } from "effect"
 *
 * const terminals = yeetMonitorPolicyTerminals(YeetUntilMergedPolicy.make({}))
 * console.log(HashSet.has(terminals, "ready")) // false
 * console.log(HashSet.has(terminals, "merged")) // true
 * ```
 *
 * @param policy - The loop policy.
 * @returns The set of terminal states that end a loop under that policy.
 * @category utilities
 * @since 0.0.0
 */
export const yeetMonitorPolicyTerminals = (policy: YeetMonitorLoopPolicy): HashSet.HashSet<YeetMonitorTerminalState> =>
  Match.value(policy).pipe(
    Match.discriminator("kind")("until-merged", () =>
      HashSet.make<ReadonlyArray<YeetMonitorTerminalState>>("merged", "closed", "settle-timeout", "poll-error-budget")
    ),
    Match.discriminator("kind")("until-ready", () =>
      HashSet.make<ReadonlyArray<YeetMonitorTerminalState>>(
        "ready",
        "merged",
        "closed",
        "settle-timeout",
        "poll-error-budget"
      )
    ),
    Match.exhaustive
  );

/**
 * Whether a loop under this policy converges the inbox on every poll.
 *
 * **Details**
 *
 * `until-ready` is the canonical detached babysit, so it is the producer of
 * the inbox wave: each poll writes `check-failed`, `review-thread` and
 * `base-drift` rows from the status snapshot and re-pins the wave record on
 * every new head. `until-merged` keeps its contract and writes no wave rows.
 *
 * **Example** (Only the readiness loop converges)
 *
 * ```ts
 * import { yeetMonitorPolicyConverges, YeetUntilMergedPolicy, YeetUntilReadyPolicy } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(yeetMonitorPolicyConverges(YeetUntilReadyPolicy.make({}))) // true
 * console.log(yeetMonitorPolicyConverges(YeetUntilMergedPolicy.make({}))) // false
 * ```
 *
 * @param policy - The loop policy.
 * @returns `true` when the loop writes inbox rows and pins the wave record.
 * @category utilities
 * @since 0.0.0
 */
export const yeetMonitorPolicyConverges = (policy: YeetMonitorLoopPolicy): boolean =>
  Match.value(policy).pipe(
    Match.discriminator("kind")("until-merged", () => false),
    Match.discriminator("kind")("until-ready", () => true),
    Match.exhaustive
  );

/**
 * The terminal states one loop admits: its policy's, plus `wave` for an
 * attached loop that converges the inbox.
 *
 * **Details**
 *
 * An attached `until-ready` loop writes inbox rows with no job for
 * `yeet job wait` to return on, so it hands a new wave back itself and exits
 * 2. A detached loop keeps polling through the wave, and an `until-merged`
 * loop writes no rows, so neither admits `wave`.
 *
 * **Example** (Only the attached readiness loop ends on a wave)
 *
 * ```ts
 * import { yeetMonitorLoopTerminals, YeetUntilMergedPolicy, YeetUntilReadyPolicy } from "@beep/repo-cli/test/Yeet"
 * import * as HashSet from "effect/HashSet"
 *
 * console.log(HashSet.has(yeetMonitorLoopTerminals(YeetUntilReadyPolicy.make({}), "attached"), "wave")) // true
 * console.log(HashSet.has(yeetMonitorLoopTerminals(YeetUntilReadyPolicy.make({}), "detached"), "wave")) // false
 * console.log(HashSet.has(yeetMonitorLoopTerminals(YeetUntilMergedPolicy.make({}), "attached"), "wave")) // false
 * ```
 *
 * @param policy - What the loop follows: the merge itself, or merge readiness.
 * @param attachment - Whether the loop runs attached or inside a proof job.
 * @returns The set of terminal states that end that loop.
 * @category utilities
 * @since 0.0.0
 */
export const yeetMonitorLoopTerminals: {
  (attachment: YeetMonitorAttachment): (policy: YeetMonitorLoopPolicy) => HashSet.HashSet<YeetMonitorTerminalState>;
  (policy: YeetMonitorLoopPolicy, attachment: YeetMonitorAttachment): HashSet.HashSet<YeetMonitorTerminalState>;
} = dual(
  2,
  (policy: YeetMonitorLoopPolicy, attachment: YeetMonitorAttachment): HashSet.HashSet<YeetMonitorTerminalState> => {
    const terminals = yeetMonitorPolicyTerminals(policy);
    return YeetMonitorAttachment.$match(attachment, {
      attached: () =>
        yeetMonitorPolicyConverges(policy) ? HashSet.add(terminals, YeetMonitorTerminalState.Enum.wave) : terminals,
      detached: () => terminals,
    });
  }
);

/**
 * One row of the exit-code table: the terminal state, the process exit code,
 * and the operator summary printed with it.
 *
 * @category models
 * @since 0.0.0
 */
export class YeetMonitorExit extends S.Class<YeetMonitorExit>($I`YeetMonitorExit`)(
  {
    terminal: YeetMonitorTerminalState,
    exitCode: S.Finite,
    summary: S.NonEmptyString,
  },
  $I.annote("YeetMonitorExit", {
    description: "Exit code and operator summary for one merge-loop terminal state.",
  })
) {}

/**
 * The exit code and summary for a terminal state — the one table the CLI
 * route, the inbox row, and the tests read.
 *
 * **Example** (Readiness exits zero, a settle timeout exits one)
 *
 * ```ts
 * import { yeetMonitorExitFor } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(yeetMonitorExitFor("ready").exitCode) // 0
 * console.log(yeetMonitorExitFor("settle-timeout").exitCode) // 1
 * ```
 *
 * @param terminal - The state that ended the loop.
 * @returns The exit-code row for that state.
 * @category utilities
 * @since 0.0.0
 */
export const yeetMonitorExitFor = (terminal: YeetMonitorTerminalState): YeetMonitorExit =>
  Match.value(terminal).pipe(
    Match.when("merged", () =>
      YeetMonitorExit.make({
        terminal: "merged",
        exitCode: 0,
        summary: "pull request is MERGED; the post-merge workspace sweep ran",
      })
    ),
    Match.when("ready", () =>
      YeetMonitorExit.make({
        terminal: "ready",
        exitCode: 0,
        summary: "merge-ready: yes; every hard criterion is green; hand the pull request to the operator",
      })
    ),
    Match.when("wave", () =>
      YeetMonitorExit.make({
        terminal: "wave",
        exitCode: 2,
        summary:
          "a new P0/P1 inbox wave landed on the pull request; the rows stay in the inbox; fix, publish, then re-run the same monitor command",
      })
    ),
    Match.when("closed", () =>
      YeetMonitorExit.make({ terminal: "closed", exitCode: 1, summary: "pull request is CLOSED without merging" })
    ),
    Match.when("settle-timeout", () =>
      YeetMonitorExit.make({
        terminal: "settle-timeout",
        exitCode: 1,
        summary: "the required census did not settle within --settle-timeout",
      })
    ),
    Match.when("poll-error-budget", () =>
      YeetMonitorExit.make({
        terminal: "poll-error-budget",
        exitCode: 1,
        summary: `${YEET_MONITOR_POLL_ERROR_BUDGET} consecutive poll errors exhausted the budget`,
      })
    ),
    Match.exhaustive
  );

/**
 * The whole exit-code table, one row per terminal state.
 *
 * **Example** (Every terminal has exactly one row)
 *
 * ```ts
 * import { yeetMonitorExitTable, YeetMonitorTerminalState } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(yeetMonitorExitTable.length === YeetMonitorTerminalState.Options.length) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const yeetMonitorExitTable: ReadonlyArray<YeetMonitorExit> = A.map(
  YeetMonitorTerminalState.Options,
  yeetMonitorExitFor
);

/**
 * The instants the loop stamps while following one head.
 *
 * **Details**
 *
 * `firstObservedAt` is the poll that first saw the head. `pushedAt` is the head
 * commit's committer date (yeet publish commits and pushes in one step, so it
 * approximates the push). `redAt` is GitHub's `completedAt` for the first
 * failing required check the loop saw on the head (the red as GitHub observed
 * it, not as the poll did); an optional red never stamps it. `redLane` names
 * that check, the lane its P0 `check-failed` row carries, and is stamped
 * together with `redAt` (`yeetHeadTimelineStampRed`), so the push → row → ack
 * join follows the same red. `redAt`, `redLane`, `settledAt`, `closeoutAt`,
 * and `readyAt` are stamped on first observation and never overwritten; a
 * head change starts a new timeline.
 *
 * **Gotchas**
 *
 * A timeline encoded before `redLane` existed decodes with `redAt` and no
 * `redLane`; the join then falls back to the head's earliest P0 row.
 *
 * **Example** (Construct a timeline)
 *
 * ```ts
 * import { YeetHeadTimeline } from "@beep/repo-cli/test/Yeet"
 *
 * const timeline = YeetHeadTimeline.make({ headSha: "abc123", firstObservedAt: "2026-09-16T00:00:00.000Z" })
 * console.log(timeline.readyAt._tag) // "None"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetHeadTimeline extends S.Class<YeetHeadTimeline>($I`YeetHeadTimeline`)(
  {
    headSha: S.NonEmptyString,
    firstObservedAt: S.String,
    pushedAt: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    redAt: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    redLane: S.NonEmptyString.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    settledAt: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    closeoutAt: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    readyAt: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  },
  $I.annote("YeetHeadTimeline", {
    description: "Push, first-red, settle, closeout, and ready instants for one pull request head.",
  })
) {}

/**
 * The required red that stamps a head's red: which check, and when.
 *
 * **Details**
 *
 * `lane` is the failing required check's name, the same string its P0
 * `check-failed` inbox row carries as the capsule lane. `at` is GitHub's
 * `completedAt` for that check.
 *
 * **Example** (Name the red)
 *
 * ```ts
 * import { YeetHeadRed } from "@beep/repo-cli/test/Yeet"
 *
 * const red = YeetHeadRed.make({ at: "2026-09-25T12:01:00Z", lane: "Check" })
 * console.log(red.lane) // "Check"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetHeadRed extends S.Class<YeetHeadRed>($I`YeetHeadRed`)(
  {
    at: S.String,
    lane: S.NonEmptyString,
  },
  $I.annote("YeetHeadRed", {
    description: "The failing required check that stamps a head's red, and GitHub's completedAt for it.",
  })
) {}

/**
 * Stamp a head's red and the check that set it, keeping the first red.
 *
 * **Details**
 *
 * `redAt` and `redLane` are written together or not at all: once a red is
 * stamped, a later red leaves both untouched, so the lane always names the
 * check whose instant `redAt` holds.
 *
 * **Example** (The first red wins, lane and all)
 *
 * ```ts
 * import { YeetHeadRed, YeetHeadTimeline, yeetHeadTimelineStampRed } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const timeline = YeetHeadTimeline.make({ headSha: "abc123", firstObservedAt: "2026-09-16T00:00:00.000Z" })
 * const once = yeetHeadTimelineStampRed(timeline, YeetHeadRed.make({ at: "2026-09-16T00:05:00Z", lane: "Check" }))
 * const twice = yeetHeadTimelineStampRed(once, YeetHeadRed.make({ at: "2026-09-16T00:06:00Z", lane: "Lint" }))
 * console.log(O.getOrNull(twice.redAt), O.getOrNull(twice.redLane)) // "2026-09-16T00:05:00Z" "Check"
 * ```
 *
 * @param timeline - The head timeline receiving the stamp.
 * @param red - The first failing required check and its `completedAt`.
 * @returns The stamped timeline, unchanged when a red was already stamped.
 * @category utilities
 * @since 0.0.0
 */
export const yeetHeadTimelineStampRed: {
  (red: YeetHeadRed): (timeline: YeetHeadTimeline) => YeetHeadTimeline;
  (timeline: YeetHeadTimeline, red: YeetHeadRed): YeetHeadTimeline;
} = dual(
  2,
  (timeline: YeetHeadTimeline, red: YeetHeadRed): YeetHeadTimeline =>
    O.match(timeline.redAt, {
      onNone: () => YeetHeadTimeline.make({ ...timeline, redAt: O.some(red.at), redLane: O.some(red.lane) }),
      onSome: () => timeline,
    })
);

/**
 * The timeline instants the loop stamps after first observation.
 *
 * **Details**
 *
 * The red is not one of them: it carries its check too, so it is stamped
 * through `yeetHeadTimelineStampRed`.
 *
 * @category models
 * @since 0.0.0
 */
export const YeetHeadTimelineStamp = LiteralKit(["settledAt", "closeoutAt", "readyAt"]).pipe(
  $I.annoteSchema("YeetHeadTimelineStamp", {
    description: "Which timeline instant a loop event stamps.",
  })
);

/**
 * The timeline instants the loop stamps after first observation.
 *
 * @category type-level
 * @since 0.0.0
 */
export type YeetHeadTimelineStamp = typeof YeetHeadTimelineStamp.Type;

/**
 * Stamp one instant on a head timeline, keeping the first observation.
 *
 * **Example** (The first stamp wins)
 *
 * ```ts
 * import { YeetHeadTimeline, yeetHeadTimelineStamp } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const timeline = YeetHeadTimeline.make({ headSha: "abc123", firstObservedAt: "2026-09-16T00:00:00.000Z" })
 * const once = yeetHeadTimelineStamp(timeline, "settledAt", "2026-09-16T00:05:00.000Z")
 * const twice = yeetHeadTimelineStamp(once, "settledAt", "2026-09-16T00:06:00.000Z")
 * console.log(O.getOrNull(twice.settledAt)) // "2026-09-16T00:05:00.000Z"
 * ```
 *
 * @param timeline - The head timeline receiving the stamp.
 * @param stamp - Which instant to stamp.
 * @param at - The ISO instant.
 * @returns The stamped timeline, unchanged when the instant was already set.
 * @category utilities
 * @since 0.0.0
 */
export const yeetHeadTimelineStamp: {
  (stamp: YeetHeadTimelineStamp, at: string): (timeline: YeetHeadTimeline) => YeetHeadTimeline;
  (timeline: YeetHeadTimeline, stamp: YeetHeadTimelineStamp, at: string): YeetHeadTimeline;
} = dual(
  3,
  (timeline: YeetHeadTimeline, stamp: YeetHeadTimelineStamp, at: string): YeetHeadTimeline =>
    Match.value(stamp).pipe(
      Match.when("settledAt", () =>
        YeetHeadTimeline.make({ ...timeline, settledAt: O.orElseSome(timeline.settledAt, () => at) })
      ),
      Match.when("closeoutAt", () =>
        YeetHeadTimeline.make({ ...timeline, closeoutAt: O.orElseSome(timeline.closeoutAt, () => at) })
      ),
      Match.when("readyAt", () =>
        YeetHeadTimeline.make({ ...timeline, readyAt: O.orElseSome(timeline.readyAt, () => at) })
      ),
      Match.exhaustive
    )
);

const epochMillis = (iso: string): O.Option<number> => pipe(DateTime.make(iso), O.map(DateTime.toEpochMillis));

/**
 * Wall-clock from push to ready, when both instants are known.
 *
 * **Example** (Twelve minutes from push to ready)
 *
 * ```ts
 * import { YeetHeadTimeline, yeetPushToReadyMillis } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const timeline = YeetHeadTimeline.make({
 *   headSha: "abc123",
 *   firstObservedAt: "2026-09-16T00:00:30.000Z",
 *   pushedAt: O.some("2026-09-16T00:00:00.000Z"),
 *   readyAt: O.some("2026-09-16T00:12:00.000Z")
 * })
 * console.log(O.getOrNull(yeetPushToReadyMillis(timeline))) // 720000
 * ```
 *
 * @param timeline - The stamped instants of the head being followed.
 * @returns Milliseconds from push to ready, or `None` while either is unknown.
 * @category getters
 * @since 0.0.0
 */
export const yeetPushToReadyMillis = (timeline: YeetHeadTimeline): O.Option<number> =>
  pipe(
    O.all({ pushed: O.flatMap(timeline.pushedAt, epochMillis), ready: O.flatMap(timeline.readyAt, epochMillis) }),
    O.map(({ pushed, ready }) => Math.max(0, ready - pushed))
  );

const renderInstant = (label: string, value: O.Option<string>): string =>
  `${label} ${O.getOrElse(value, () => "unknown")}`;

/**
 * Render the timeline half of the final gate line.
 *
 * **Example** (Render a complete timeline)
 *
 * ```ts
 * import { renderYeetHeadTimeline, YeetHeadTimeline } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const timeline = YeetHeadTimeline.make({
 *   headSha: "abc123",
 *   firstObservedAt: "2026-09-16T00:00:30.000Z",
 *   pushedAt: O.some("2026-09-16T00:00:00.000Z"),
 *   settledAt: O.some("2026-09-16T00:10:00.000Z"),
 *   closeoutAt: O.some("2026-09-16T00:10:30.000Z"),
 *   readyAt: O.some("2026-09-16T00:12:00.000Z")
 * })
 * console.log(renderYeetHeadTimeline(timeline))
 * // push→ready 12m (pushed 2026-09-16T00:00:00.000Z, settled 2026-09-16T00:10:00.000Z, closeout 2026-09-16T00:10:30.000Z, ready 2026-09-16T00:12:00.000Z)
 * ```
 *
 * @param timeline - The stamped instants of the head being followed.
 * @returns One clause naming the push-to-ready wall clock and every stamped instant.
 * @category formatting
 * @since 0.0.0
 */
export const renderYeetHeadTimeline = (timeline: YeetHeadTimeline): string => {
  const wallClock = O.match(yeetPushToReadyMillis(timeline), {
    onNone: () => "push→ready unknown",
    onSome: (millis) => `push→ready ${Duration.format(Duration.millis(millis))}`,
  });
  const instants = A.join(
    [
      renderInstant("pushed", timeline.pushedAt),
      renderInstant("settled", timeline.settledAt),
      renderInstant("closeout", timeline.closeoutAt),
      renderInstant("ready", timeline.readyAt),
    ],
    ", "
  );
  return `${wallClock} (${instants})`;
};

/**
 * The stages of one head's push → row → ack timeline, in the order they happen.
 *
 * **Details**
 *
 * `pushed` is the head's committer date, `red` is GitHub's `completedAt` for
 * the first failing required check, `row` is when that check's P0
 * `check-failed` inbox row was written, `injected` is when a harness session
 * was first handed that row (the inbox hook's `firstSeenAt`), and `acked` is
 * the row's ack receipt.
 *
 * **Example** (Check a stage)
 *
 * ```ts
 * import { YeetPushToAckStage } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(YeetPushToAckStage.is.injected("injected")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const YeetPushToAckStage = LiteralKit(["pushed", "red", "row", "injected", "acked"]).pipe(
  $I.annoteSchema("YeetPushToAckStage", {
    description: "One stage of a head's push → row → ack timeline.",
  })
);

/**
 * The stages of one head's push → row → ack timeline.
 *
 * @category type-level
 * @since 0.0.0
 */
export type YeetPushToAckStage = typeof YeetPushToAckStage.Type;

/**
 * One head's push → row → ack timeline, joined from the stamps that exist.
 *
 * **Details**
 *
 * The chain follows the first required red: `red` is that red's instant, and
 * `row`, `injected`, and `acked` all belong to its P0 `check-failed` row, so an
 * optional red's P1 row never lends the chain a stage. Every stage is
 * optional: a head with no required red has only `pushed`, a row the owning
 * session never saw has no `injected`, and a row superseded by a push is often
 * never acked. An absent stage renders as `-`, never as a failure.
 *
 * **Example** (A head with no red)
 *
 * ```ts
 * import { YeetPushToAckTimeline } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const timeline = YeetPushToAckTimeline.make({ headSha: "abc1234", pushedAt: O.some("2026-09-25T12:00:00Z") })
 * console.log(timeline.rowAt._tag) // "None"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetPushToAckTimeline extends S.Class<YeetPushToAckTimeline>($I`YeetPushToAckTimeline`)(
  {
    headSha: S.NonEmptyString,
    pushedAt: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    redAt: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    rowAt: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    injectedAt: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    ackedAt: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  },
  $I.annote("YeetPushToAckTimeline", {
    description: "Push, first-red, row-written, row-injected, and acked instants for one pull request head.",
  })
) {}

const pushToAckInstant = (timeline: YeetPushToAckTimeline, stage: YeetPushToAckStage): O.Option<string> =>
  Match.value(stage).pipe(
    Match.when("pushed", () => timeline.pushedAt),
    Match.when("red", () => timeline.redAt),
    Match.when("row", () => timeline.rowAt),
    Match.when("injected", () => timeline.injectedAt),
    Match.when("acked", () => timeline.ackedAt),
    Match.exhaustive
  );

const renderElapsed = (from: number, to: number): string => Duration.format(Duration.millis(to - from));

// A stage stamped before the stage printed ahead of it is anchored on the push
// instead, so the line never shows a negative or clamped-to-zero gap.
const renderStageDelta = (pushed: O.Option<number>, previous: O.Option<number>, millis: O.Option<number>): string =>
  O.match(O.all({ from: previous, to: millis }), {
    onNone: () => "",
    onSome: ({ from, to }) =>
      to >= from
        ? ` (+${renderElapsed(from, to)})`
        : O.match(
            O.filter(pushed, (push) => push <= to),
            {
              onNone: () => "",
              onSome: (push) => ` (push +${renderElapsed(push, to)})`,
            }
          ),
  });

const renderPushToAckStage = (
  pushed: O.Option<number>,
  previous: O.Option<number>,
  stage: YeetPushToAckStage,
  instant: O.Option<string>
): readonly [O.Option<number>, string] =>
  O.match(instant, {
    onNone: () => [previous, `${stage} -`] as const,
    onSome: (value) => {
      const millis = epochMillis(value);
      return [
        O.orElse(millis, () => previous),
        `${stage} ${value}${renderStageDelta(pushed, previous, millis)}`,
      ] as const;
    },
  });

/**
 * Render one head's push → row → ack timeline as one clause.
 *
 * **Details**
 *
 * Stages print in order; an absent stage prints `-`. The `row`, `injected`,
 * and `acked` stages are the first required red's P0 row, as
 * `loadYeetPushToAckTimeline` joins them. A present stage after an earlier
 * present stage carries `(+<duration>)`, the wall clock since the nearest
 * earlier stamped stage, so the red → row and row → injected gaps read
 * straight off the line.
 *
 * A stage stamped before that earlier stage (GitHub's clock against the local
 * one, or a row that is not this red's) never prints a negative or
 * clamped-to-zero gap: it keeps its absolute instant and carries
 * `(push +<duration>)`, the wall clock since `pushed`, instead. When `pushed`
 * is absent or later still, the stage prints its instant alone. The stage
 * after it still measures from it, the stamped stage printed just before.
 *
 * **Example** (Absent stages render as a dash)
 *
 * ```ts
 * import { renderYeetPushToAckTimeline, YeetPushToAckTimeline } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const timeline = YeetPushToAckTimeline.make({
 *   headSha: "abc1234def",
 *   pushedAt: O.some("2026-09-25T12:00:00Z"),
 *   redAt: O.some("2026-09-25T12:10:00Z"),
 *   rowAt: O.some("2026-09-25T12:10:20Z")
 * })
 * console.log(renderYeetPushToAckTimeline(timeline))
 * // push→row→ack abc1234: pushed 2026-09-25T12:00:00Z, red 2026-09-25T12:10:00Z (+10m), row 2026-09-25T12:10:20Z (+20s), injected -, acked -
 * ```
 *
 * @param timeline - The joined stamps for one head.
 * @returns One clause naming the head and every stage, `-` for the absent ones.
 * @category formatting
 * @since 0.0.0
 */
export const renderYeetPushToAckTimeline = (timeline: YeetPushToAckTimeline): string => {
  const pushed = O.flatMap(timeline.pushedAt, epochMillis);
  const [, clauses] = A.mapAccum(YeetPushToAckStage.Options, O.none<number>(), (previous, stage) =>
    renderPushToAckStage(pushed, previous, stage, pushToAckInstant(timeline, stage))
  );
  return `push→row→ack ${Str.slice(0, 7)(timeline.headSha)}: ${A.join(clauses, ", ")}`;
};
