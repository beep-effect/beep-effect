/**
 * Typed transition stream for Yeet monitor watch sessions.
 *
 * **Details**
 *
 * The watch redesign (ship-velocity A1) replaces "read the checks page again
 * and re-print everything" with a stream of state *transitions*: each poll
 * collects one {@link YeetWatchSnapshot}, and {@link diffYeetWatchSnapshots}
 * derives the {@link YeetWatchEvent} rows that describe exactly what changed.
 * Consumers — the operator's terminal, the A2 inbox, the remediation
 * dispatcher — read one NDJSON row per transition instead of scraping output.
 *
 * The module is deliberately split along a boundary/domain seam. GitHub's
 * check `bucket` vocabulary is open-ended in practice (`fail`, `failing`,
 * `cancel`, `cancelled`, `error`, `timed_out`, ...), so snapshots keep the raw
 * strings at the boundary and {@link classifyYeetCheckOutcome} totalizes them
 * into the closed {@link YeetCheckOutcome} domain that events speak. A bucket
 * GitHub invents tomorrow degrades to a conservative classification instead of
 * a decode failure that kills the watch.
 *
 * **Gotchas**
 *
 * Transition detection keys on typed snapshot diffs, never on log-line
 * matching: this repo's own proof logs contain realistic failure prose as
 * fixture output (`yeet monitor failed.` inside a green run), so any consumer
 * that greps rendered text will find failures that never happened. The differ
 * is pure precisely so the whole transition matrix is testable without GitHub.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { Effect, HashMap } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { mergeReadyCriterionHolds, YeetMergeReadyCriteria, YeetMergeReadyCriterion } from "./Verdict.ts";

const $I = $RepoCliId.create("commands/Yeet/internal/WatchStream");

/**
 * Schema version stamped on every emitted watch row.
 *
 * **Example** (Read the version)
 *
 * ```ts
 * import { YEET_WATCH_SCHEMA_VERSION } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(YEET_WATCH_SCHEMA_VERSION) // "yeet-watch/v1"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const YEET_WATCH_SCHEMA_VERSION = "yeet-watch/v1";

/**
 * Closed outcome domain a check occupies from the watch's point of view.
 *
 * **Details**
 *
 * This is the internal vocabulary events speak. The boundary keeps GitHub's
 * raw `bucket`/`state` strings; {@link classifyYeetCheckOutcome} maps them
 * here totally, so downstream code matches on four cases instead of an
 * open-ended string set.
 *
 * **Example** (Check an outcome)
 *
 * ```ts
 * import { YeetCheckOutcome } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(YeetCheckOutcome.is.fail("fail")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const YeetCheckOutcome = LiteralKit(["pending", "pass", "fail", "skip"]).pipe(
  $I.annoteSchema("YeetCheckOutcome", {
    title: "Yeet Check Outcome",
    description: "Closed classification of one PR check's state within a watch snapshot.",
  })
);

/**
 * Closed outcome domain a check occupies from the watch's point of view.
 *
 * @category type-level
 * @since 0.0.0
 */
export type YeetCheckOutcome = typeof YeetCheckOutcome.Type;

// The contains-lists mirror yeet status's classifiers (Status.ts), which have
// watched these strings in the field since the monitor existed. Order matters:
// failure evidence wins over pending evidence, because a cancelled-while-queued
// check reports both.
const FAILING_BUCKETS: ReadonlyArray<string> = ["fail", "failing", "cancel", "cancelled", "error", "timed_out"];
const FAILING_STATES: ReadonlyArray<string> = ["failure", "cancelled", "error", "timed_out"];
const PENDING_BUCKETS: ReadonlyArray<string> = ["pending", "running", "queued", "waiting"];
const PENDING_STATES: ReadonlyArray<string> = ["pending", "in_progress", "queued", "waiting"];
const SKIP_BUCKETS: ReadonlyArray<string> = ["skipping", "skipped", "neutral"];

/**
 * One check's raw classification evidence as GitHub reports it.
 *
 * @category models
 * @since 0.0.0
 */
export class YeetCheckSignal extends S.Class<YeetCheckSignal>($I`YeetCheckSignal`)(
  {
    bucket: S.String,
    state: S.String,
  },
  $I.annote("YeetCheckSignal", {
    description: "Raw bucket and state strings for one check, as gh pr checks --json reports them.",
  })
) {}

/**
 * Totalize one raw check payload into the closed outcome domain.
 *
 * **Details**
 *
 * Classification is deliberately conservative for vocabulary GitHub has not
 * shown us yet: anything that carries neither failure, pending, nor skip
 * evidence classifies as `pass` only when its state says so, and otherwise
 * falls back to `pending` — the one outcome the watch will revisit rather
 * than conclude on.
 *
 * **Example** (Classify a cancelled check)
 *
 * ```ts
 * import { classifyYeetCheckOutcome, YeetCheckSignal } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(classifyYeetCheckOutcome(YeetCheckSignal.make({ bucket: "cancel", state: "CANCELLED" }))) // "fail"
 * ```
 *
 * @param check - Raw `bucket` and `state` strings as `gh pr checks --json` reports them.
 * @returns The closed outcome the watch acts on.
 * @category mapping
 * @since 0.0.0
 */
export const classifyYeetCheckOutcome = (check: YeetCheckSignal): YeetCheckOutcome => {
  const bucket = Str.toLowerCase(check.bucket);
  const state = Str.toLowerCase(check.state);
  if (A.contains(FAILING_BUCKETS, bucket) || A.contains(FAILING_STATES, state)) {
    return YeetCheckOutcome.Enum.fail;
  }
  if (A.contains(PENDING_BUCKETS, bucket) || A.contains(PENDING_STATES, state)) {
    return YeetCheckOutcome.Enum.pending;
  }
  if (A.contains(SKIP_BUCKETS, bucket) || state === "skipped") {
    return YeetCheckOutcome.Enum.skip;
  }
  if (bucket === "pass" || state === "success") {
    return YeetCheckOutcome.Enum.pass;
  }
  return YeetCheckOutcome.Enum.pending;
};

/**
 * One check within a watch snapshot: its classified outcome plus its record.
 *
 * **Details**
 *
 * `link`, `workflow`, and the raw `signal` are the check's own record as
 * `gh pr checks` reported it, preserved so a failure capsule derives from the
 * failing check's record instead of a classifier pass over composite output.
 * They default (null link/workflow, empty signal) so synthetic snapshots in
 * differ tests stay terse; the collector always fills them from the live row.
 *
 * @category models
 * @since 0.0.0
 */
export class YeetWatchCheck extends S.Class<YeetWatchCheck>($I`YeetWatchCheck`)(
  {
    name: S.NonEmptyString,
    outcome: YeetCheckOutcome,
    required: S.Boolean.pipe(S.withConstructorDefault(Effect.succeed(true))),
    link: S.NullOr(S.String).pipe(S.withConstructorDefault(Effect.succeed(null))),
    signal: YeetCheckSignal.pipe(
      S.withConstructorDefault(Effect.succeed(YeetCheckSignal.make({ bucket: "", state: "" })))
    ),
    workflow: S.NullOr(S.String).pipe(S.withConstructorDefault(Effect.succeed(null))),
  },
  $I.annote("YeetWatchCheck", {
    description: "One PR check's name, classified outcome, and raw record within a watch snapshot.",
  })
) {}

/**
 * One review thread within a watch snapshot: its identity and resolution.
 *
 * @category models
 * @since 0.0.0
 */
export class YeetWatchThread extends S.Class<YeetWatchThread>($I`YeetWatchThread`)(
  {
    id: S.NonEmptyString,
    isResolved: S.Boolean,
  },
  $I.annote("YeetWatchThread", {
    description: "One PR review thread's identity and resolution state within a watch snapshot.",
  })
) {}

/**
 * Everything one watch poll observed about the pull request.
 *
 * **Details**
 *
 * The snapshot is the unit of comparison: the poller collects one per tick and
 * the differ derives events from consecutive pairs. `mergeable` and `state`
 * stay raw strings for the same reason buckets do — GitHub's vocabulary there
 * (`MERGEABLE`/`CONFLICTING`/`UNKNOWN`, `OPEN`/`MERGED`/`CLOSED`) is an
 * interoperability surface, not this module's domain.
 *
 * **Example** (Construct an empty snapshot)
 *
 * ```ts
 * import { YeetWatchSnapshot } from "@beep/repo-cli/test/Yeet"
 *
 * const snapshot = YeetWatchSnapshot.make({
 *   checks: [],
 *   headSha: "abc123",
 *   mergeable: "MERGEABLE",
 *   prNumber: 751,
 *   state: "OPEN",
 *   threads: []
 * })
 *
 * console.log(snapshot.headSha) // "abc123"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetWatchSnapshot extends S.Class<YeetWatchSnapshot>($I`YeetWatchSnapshot`)(
  {
    checks: S.Array(YeetWatchCheck),
    headSha: S.NonEmptyString,
    mergeable: S.String,
    mergeStateStatus: S.String.pipe(S.withConstructorDefault(Effect.succeed("UNKNOWN"))),
    prNumber: S.Finite,
    state: S.String,
    threads: S.Array(YeetWatchThread),
    criteria: YeetMergeReadyCriteria.pipe(
      S.withConstructorDefault(
        Effect.succeed(
          YeetMergeReadyCriteria.make({
            prOpen: false,
            notDraft: false,
            closeoutRun: false,
            requiredChecksGreen: false,
            threadsResolved: false,
            mergeable: false,
            mergeStateAcceptable: false,
            reviewDecisionAcceptable: false,
            greptileScore: O.none(),
          })
        )
      )
    ),
  },
  $I.annote("YeetWatchSnapshot", {
    description: "Everything one yeet watch poll observed about the pull request.",
  })
) {}

/**
 * The watch began: the first snapshot's identity, before any transition.
 *
 * @category models
 * @since 0.0.0
 */
export class YeetWatchStarted extends S.Class<YeetWatchStarted>($I`YeetWatchStarted`)(
  {
    kind: S.tag("watch-started"),
    schemaVersion: S.Literal(YEET_WATCH_SCHEMA_VERSION).pipe(
      S.withConstructorDefault(Effect.succeed(YEET_WATCH_SCHEMA_VERSION))
    ),
    at: S.String,
    headSha: S.NonEmptyString,
    checks: S.Finite,
  },
  $I.annote("YeetWatchStarted", {
    description: "First row of a watch stream: the head under watch and how many checks it carries.",
  })
) {}

/**
 * One check moved between outcomes.
 *
 * **Details**
 *
 * `from` is absent for a check's first observation — a lane that registers
 * mid-watch arrives as a transition from nothing rather than being silently
 * folded into the baseline.
 *
 * @category models
 * @since 0.0.0
 */
export class YeetCheckTransition extends S.Class<YeetCheckTransition>($I`YeetCheckTransition`)(
  {
    kind: S.tag("check-transition"),
    schemaVersion: S.Literal(YEET_WATCH_SCHEMA_VERSION).pipe(
      S.withConstructorDefault(Effect.succeed(YEET_WATCH_SCHEMA_VERSION))
    ),
    at: S.String,
    headSha: S.NonEmptyString,
    name: S.NonEmptyString,
    from: S.NullOr(YeetCheckOutcome),
    required: S.Boolean.pipe(S.withConstructorDefault(Effect.succeed(true))),
    to: YeetCheckOutcome,
  },
  $I.annote("YeetCheckTransition", {
    description: "One PR check moved between classified outcomes (from null = first observation).",
  })
) {}

/**
 * A review thread appeared or changed resolution state.
 *
 * @category models
 * @since 0.0.0
 */
export class YeetThreadTransition extends S.Class<YeetThreadTransition>($I`YeetThreadTransition`)(
  {
    kind: S.tag("thread-transition"),
    schemaVersion: S.Literal(YEET_WATCH_SCHEMA_VERSION).pipe(
      S.withConstructorDefault(Effect.succeed(YEET_WATCH_SCHEMA_VERSION))
    ),
    at: S.String,
    headSha: S.NonEmptyString,
    threadId: S.NonEmptyString,
    to: LiteralKit(["opened", "resolved", "unresolved"]),
  },
  $I.annote("YeetThreadTransition", {
    description: "A review thread appeared (opened), was resolved, or was re-opened (unresolved).",
  })
) {}

/**
 * The PR's mergeability answer changed.
 *
 * @category models
 * @since 0.0.0
 */
export class YeetMergeabilityChanged extends S.Class<YeetMergeabilityChanged>($I`YeetMergeabilityChanged`)(
  {
    kind: S.tag("mergeability-changed"),
    schemaVersion: S.Literal(YEET_WATCH_SCHEMA_VERSION).pipe(
      S.withConstructorDefault(Effect.succeed(YEET_WATCH_SCHEMA_VERSION))
    ),
    at: S.String,
    headSha: S.NonEmptyString,
    from: S.String,
    to: S.String,
  },
  $I.annote("YeetMergeabilityChanged", {
    description: "GitHub's mergeability answer for the PR changed between polls.",
  })
) {}

/**
 * One truthful merge-readiness criterion flipped between watch polls.
 *
 * **Example** (Describe a required-check recovery)
 *
 * ```ts
 * import { YeetMergeReadyCriterionChanged } from "@beep/repo-cli/test/Yeet"
 *
 * const event = YeetMergeReadyCriterionChanged.make({
 *   at: "2026-08-27T00:00:00Z", criterion: "required-checks-green",
 *   from: false, headSha: "abc123", to: true
 * })
 * console.log(event.to) // true
 * ```
 *
 * @category events
 * @since 0.0.0
 */
export class YeetMergeReadyCriterionChanged extends S.Class<YeetMergeReadyCriterionChanged>(
  $I`YeetMergeReadyCriterionChanged`
)(
  {
    kind: S.tag("merge-ready-criterion-changed"),
    schemaVersion: S.Literal(YEET_WATCH_SCHEMA_VERSION).pipe(
      S.withConstructorDefault(Effect.succeed(YEET_WATCH_SCHEMA_VERSION))
    ),
    at: S.String,
    headSha: S.NonEmptyString,
    criterion: YeetMergeReadyCriterion,
    from: S.Boolean,
    to: S.Boolean,
  },
  $I.annote("YeetMergeReadyCriterionChanged", {
    description: "One truthful merge-readiness criterion flipped between watch polls.",
  })
) {}

/**
 * The PR's head moved: a new push supersedes the watched wave.
 *
 * @category models
 * @since 0.0.0
 */
export class YeetHeadChanged extends S.Class<YeetHeadChanged>($I`YeetHeadChanged`)(
  {
    kind: S.tag("head-changed"),
    schemaVersion: S.Literal(YEET_WATCH_SCHEMA_VERSION).pipe(
      S.withConstructorDefault(Effect.succeed(YEET_WATCH_SCHEMA_VERSION))
    ),
    at: S.String,
    from: S.NonEmptyString,
    to: S.NonEmptyString,
  },
  $I.annote("YeetHeadChanged", {
    description: "The PR head moved to a new SHA; transitions before it belong to a superseded wave.",
  })
) {}

/**
 * Reasons a watch stream ends.
 *
 * **Example** (Check a reason)
 *
 * ```ts
 * import { YeetWatchEndReason } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(YeetWatchEndReason.is["all-terminal"]("all-terminal")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const YeetWatchEndReason = LiteralKit(["all-terminal", "pr-merged", "pr-closed", "poll-error"]).pipe(
  $I.annoteSchema("YeetWatchEndReason", {
    title: "Yeet Watch End Reason",
    description: "Why a yeet watch stream ended.",
  })
);

/**
 * Reasons a watch stream ends.
 *
 * @category type-level
 * @since 0.0.0
 */
export type YeetWatchEndReason = typeof YeetWatchEndReason.Type;

/**
 * The watch ended, with the reason and the final failure census.
 *
 * @category models
 * @since 0.0.0
 */
export class YeetWatchEnded extends S.Class<YeetWatchEnded>($I`YeetWatchEnded`)(
  {
    kind: S.tag("watch-ended"),
    schemaVersion: S.Literal(YEET_WATCH_SCHEMA_VERSION).pipe(
      S.withConstructorDefault(Effect.succeed(YEET_WATCH_SCHEMA_VERSION))
    ),
    at: S.String,
    headSha: S.NonEmptyString,
    reason: YeetWatchEndReason,
    failing: S.Finite,
  },
  $I.annote("YeetWatchEnded", {
    description: "Last row of a watch stream: why it ended and how many checks were failing.",
  })
) {}

/**
 * One row of the watch stream.
 *
 * **Details**
 *
 * Every member carries `schemaVersion`, `at`, and a discriminating `kind`, so
 * a consumer can decode line-by-line without context and route on `kind` with
 * an exhaustive match.
 *
 * @category models
 * @since 0.0.0
 */
export const YeetWatchEvent = S.Union([
  YeetWatchStarted,
  YeetCheckTransition,
  YeetThreadTransition,
  YeetMergeabilityChanged,
  YeetMergeReadyCriterionChanged,
  YeetHeadChanged,
  YeetWatchEnded,
]).pipe(
  $I.annoteSchema("YeetWatchEvent", {
    title: "Yeet Watch Event",
    description: "One typed row of the yeet monitor watch transition stream.",
  })
);

/**
 * One row of the watch stream.
 *
 * @category type-level
 * @since 0.0.0
 */
export type YeetWatchEvent = typeof YeetWatchEvent.Type;

const encodeWatchEvent = S.encodeUnknownEffect(S.fromJsonString(YeetWatchEvent));

/**
 * Render one watch event as its NDJSON line.
 *
 * **Details**
 *
 * The stream contract is one JSON document per line on stdout; human-facing
 * prose belongs on stderr. Encoding goes through the schema so the emitted
 * shape is exactly the declared one — a consumer can decode any line with
 * {@link YeetWatchEvent} and an out-of-date consumer can key on
 * `schemaVersion`.
 *
 * **Example** (Render a head change)
 *
 * ```ts
 * import { renderYeetWatchEventLine, YeetHeadChanged } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 *
 * const line = renderYeetWatchEventLine(YeetHeadChanged.make({ at: "2026-08-17T00:00:00Z", from: "aaa", to: "bbb" }))
 *
 * console.log(Effect.isEffect(line)) // true
 * ```
 *
 * @param event - The event to render.
 * @returns The event as a single-line JSON string.
 * @category formatting
 * @since 0.0.0
 */
export const renderYeetWatchEventLine = (event: YeetWatchEvent): Effect.Effect<string, S.SchemaError> =>
  encodeWatchEvent(event);

const checkOutcomes = (snapshot: YeetWatchSnapshot): HashMap.HashMap<string, YeetCheckOutcome> =>
  HashMap.fromIterable(A.map(snapshot.checks, (check) => [check.name, check.outcome] as const));

const threadStates = (snapshot: YeetWatchSnapshot): HashMap.HashMap<string, boolean> =>
  HashMap.fromIterable(A.map(snapshot.threads, (thread) => [thread.id, thread.isResolved] as const));

/**
 * The differ's input: two consecutive snapshots plus the row timestamp.
 *
 * @category models
 * @since 0.0.0
 */
export class YeetWatchDiffInput extends S.Class<YeetWatchDiffInput>($I`YeetWatchDiffInput`)(
  {
    at: S.String,
    next: YeetWatchSnapshot,
    prev: YeetWatchSnapshot,
  },
  $I.annote("YeetWatchDiffInput", {
    description: "Two consecutive watch snapshots plus the timestamp stamped on derived events.",
  })
) {}

/**
 * Derive the transition events between two consecutive snapshots.
 *
 * **Details**
 *
 * The differ is pure and total: given the previous and next snapshots plus the
 * row timestamp, it returns every event the change implies, in a stable order
 * (head movement first, then check transitions in the next snapshot's check
 * order, then thread transitions, then mergeability). When the head moved, the
 * check and thread diffs are suppressed — those transitions belong to the new
 * wave's own baseline, and emitting them against the old wave would attribute
 * a fresh push's pending checks to the superseded head.
 *
 * **Gotchas**
 *
 * A check that disappears from the rollup (GitHub dropped it, a workflow was
 * renamed) emits nothing: the stream reports observed states, not absence.
 * The consumer that cares about disappearance is the terminal-condition
 * evaluator, which reads the whole snapshot anyway.
 *
 * **Example** (One check goes red)
 *
 * ```ts
 * import { diffYeetWatchSnapshots, YeetWatchCheck, YeetWatchSnapshot } from "@beep/repo-cli/test/Yeet"
 *
 * const prev = YeetWatchSnapshot.make({
 *   checks: [YeetWatchCheck.make({ name: "Check", outcome: "pending" })],
 *   headSha: "abc",
 *   mergeable: "MERGEABLE",
 *   prNumber: 751,
 *   state: "OPEN",
 *   threads: []
 * })
 * const next = YeetWatchSnapshot.make({
 *   checks: [YeetWatchCheck.make({ name: "Check", outcome: "fail" })],
 *   headSha: "abc",
 *   mergeable: "MERGEABLE",
 *   prNumber: 751,
 *   state: "OPEN",
 *   threads: []
 * })
 *
 * console.log(diffYeetWatchSnapshots(YeetWatchDiffInput.make({ at: "2026-08-17T00:00:00Z", next, prev })).length) // 1
 * ```
 *
 * @param input - The previous and next snapshots plus the timestamp stamped on
 * every derived event.
 * @returns The events describing what changed, possibly empty.
 * @category mapping
 * @since 0.0.0
 */
export const diffYeetWatchSnapshots = (input: YeetWatchDiffInput): ReadonlyArray<YeetWatchEvent> => {
  const { at, next, prev } = input;
  if (prev.headSha !== next.headSha) {
    return [YeetHeadChanged.make({ at, from: prev.headSha, to: next.headSha })];
  }

  const previousChecks = checkOutcomes(prev);
  // A.flatMap over A.filterMap: v4 filterMap takes a Result-returning Filter,
  // and an Option-returning callback compiles while silently yielding [].
  const checkEvents = A.flatMap(next.checks, (check): ReadonlyArray<YeetWatchEvent> => {
    const before = HashMap.get(previousChecks, check.name);
    return O.isSome(before) && before.value === check.outcome
      ? A.empty()
      : [
          YeetCheckTransition.make({
            at,
            headSha: next.headSha,
            name: check.name,
            from: O.getOrNull(before),
            required: check.required,
            to: check.outcome,
          }),
        ];
  });

  const previousThreads = threadStates(prev);
  const threadEvents = A.flatMap(next.threads, (thread): ReadonlyArray<YeetWatchEvent> => {
    const before = HashMap.get(previousThreads, thread.id);
    const to = O.match(before, {
      onNone: () => (thread.isResolved ? O.none<"opened" | "resolved" | "unresolved">() : O.some("opened" as const)),
      onSome: (wasResolved) =>
        wasResolved === thread.isResolved
          ? O.none<"opened" | "resolved" | "unresolved">()
          : O.some(thread.isResolved ? ("resolved" as const) : ("unresolved" as const)),
    });
    return O.match(to, {
      onNone: A.empty<YeetWatchEvent>,
      onSome: (state) => [YeetThreadTransition.make({ at, headSha: next.headSha, threadId: thread.id, to: state })],
    });
  });

  const mergeabilityEvents: ReadonlyArray<YeetWatchEvent> =
    prev.mergeable === next.mergeable
      ? A.empty()
      : [YeetMergeabilityChanged.make({ at, headSha: next.headSha, from: prev.mergeable, to: next.mergeable })];

  const criteriaEvents = A.flatMap(YeetMergeReadyCriterion.Options, (criterion): ReadonlyArray<YeetWatchEvent> => {
    const before = mergeReadyCriterionHolds(prev.criteria, criterion);
    const after = mergeReadyCriterionHolds(next.criteria, criterion);
    return before === after
      ? A.empty()
      : [
          YeetMergeReadyCriterionChanged.make({
            at,
            criterion,
            from: before,
            headSha: next.headSha,
            to: after,
          }),
        ];
  });

  return A.appendAll(A.appendAll(A.appendAll(checkEvents, threadEvents), mergeabilityEvents), criteriaEvents);
};

/**
 * Decide whether a snapshot ends the watch, and why.
 *
 * **Details**
 *
 * A closed or merged PR ends the watch regardless of check state. Otherwise
 * the watch ends when no check is pending — including the degenerate zero-
 * check snapshot. The evaluator itself is deliberately memoryless about the
 * registration gap: the watch loop owns the bounded patience that keeps a
 * zero-check answer from being believed while a push's checks are still
 * registering.
 *
 * **Example** (A merged PR ends the watch)
 *
 * ```ts
 * import { yeetWatchEndReason, YeetWatchSnapshot } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const snapshot = YeetWatchSnapshot.make({
 *   checks: [],
 *   headSha: "abc",
 *   mergeable: "UNKNOWN",
 *   prNumber: 751,
 *   state: "MERGED",
 *   threads: []
 * })
 *
 * console.log(O.getOrNull(yeetWatchEndReason(snapshot))) // "pr-merged"
 * ```
 *
 * @param snapshot - The snapshot to evaluate.
 * @returns The end reason, or none while the watch should continue.
 * @category predicates
 * @since 0.0.0
 */
export const yeetWatchEndReason = (snapshot: YeetWatchSnapshot): O.Option<YeetWatchEndReason> => {
  const state = Str.toUpperCase(snapshot.state);
  if (state === "MERGED") {
    return O.some(YeetWatchEndReason.Enum["pr-merged"]);
  }
  if (state === "CLOSED") {
    return O.some(YeetWatchEndReason.Enum["pr-closed"]);
  }
  return A.some(snapshot.checks, (check) => YeetCheckOutcome.is.pending(check.outcome))
    ? O.none()
    : O.some(YeetWatchEndReason.Enum["all-terminal"]);
};

/**
 * Count the failing checks in a snapshot.
 *
 * **Example** (Count a red snapshot)
 *
 * ```ts
 * import { countYeetWatchFailures, YeetWatchCheck, YeetWatchSnapshot } from "@beep/repo-cli/test/Yeet"
 *
 * const snapshot = YeetWatchSnapshot.make({
 *   checks: [YeetWatchCheck.make({ name: "Check", outcome: "fail" })],
 *   headSha: "abc",
 *   mergeable: "MERGEABLE",
 *   prNumber: 751,
 *   state: "OPEN",
 *   threads: []
 * })
 *
 * console.log(countYeetWatchFailures(snapshot)) // 1
 * ```
 *
 * @param snapshot - The snapshot to count within.
 * @returns How many checks classify as `fail`.
 * @category getters
 * @since 0.0.0
 */
export const countYeetWatchFailures = (snapshot: YeetWatchSnapshot): number =>
  A.length(A.filter(snapshot.checks, (check) => YeetCheckOutcome.is.fail(check.outcome)));
