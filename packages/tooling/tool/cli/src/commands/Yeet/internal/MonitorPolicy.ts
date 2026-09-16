/**
 * Loop policies, terminal outcomes, the exit-code table, and the per-head
 * timeline shared by `yeet monitor --until-merged` and `--until-ready`
 * (ttc B7).
 *
 * **Details**
 *
 * One poll loop serves two policies. `until-merged` follows the pull request
 * to `MERGED` (then sweeps) or `CLOSED`; `until-ready` ends the first poll on
 * which merge readiness is `yes`, and otherwise ends on a required red that
 * matched no flake class (or whose rerun is spent), on a closed PR, on a
 * settle timeout, or when the consecutive poll-error budget is spent. Optional
 * checks never affect a terminal state in either policy. The exit code and the
 * operator summary for every terminal state live in one table so the CLI, the
 * inbox row, and the tests read the same data.
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
 * `--until-ready` success terminal. `required-red`, `settle-timeout`, and
 * `poll-error-budget` are the failure terminals; which terminals a policy
 * admits is {@link yeetMonitorPolicyTerminals}.
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
  "required-red",
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
 * End on the first poll where merge readiness is `yes`; fail on a required
 * red, a closed PR, a settle timeout, or a spent poll-error budget.
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
        "closed",
        "required-red",
        "settle-timeout",
        "poll-error-budget"
      )
    ),
    Match.exhaustive
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
 * **Example** (Readiness exits zero, a required red exits one)
 *
 * ```ts
 * import { yeetMonitorExitFor } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(yeetMonitorExitFor("ready").exitCode) // 0
 * console.log(yeetMonitorExitFor("required-red").exitCode) // 1
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
        summary: "merge-ready: every hard criterion is green; hand the pull request to the operator",
      })
    ),
    Match.when("closed", () =>
      YeetMonitorExit.make({ terminal: "closed", exitCode: 1, summary: "pull request is CLOSED without merging" })
    ),
    Match.when("required-red", () =>
      YeetMonitorExit.make({
        terminal: "required-red",
        exitCode: 1,
        summary: "a required check is red and matched no rerunnable flake class, or its one rerun is spent",
      })
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
 * approximates the push). `settledAt`, `closeoutAt`, and `readyAt` are stamped
 * on first observation and never overwritten; a head change starts a new
 * timeline.
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
    settledAt: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    closeoutAt: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    readyAt: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  },
  $I.annote("YeetHeadTimeline", {
    description: "Push, settle, closeout, and ready instants for one pull request head.",
  })
) {}

/**
 * The timeline instants the loop stamps after first observation.
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
