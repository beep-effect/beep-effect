/**
 * Gate run history as pure data: one observation of an item in one run, the
 * evidence a label is decided from, the history configuration, the one flaky
 * rule, the label classifier, the fix-loop delta, and the typed error a
 * history store fails with.
 *
 * **Details**
 *
 * Ports upstream `classifyTest` (`packages/sdk/src/utils/classify-test.ts`)
 * and the window of `HistoryTrackerLive` (`packages/engine/src/layers/HistoryTrackerLive.ts`)
 * with the rules of `goals/gate-run-history`: the lane and main series are
 * separate, there is one flaky rule (two outcomes on one input), `recovered`
 * holds for one run, and the window is configuration.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $GateReportId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { dual, pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { RunDelta } from "./ConsoleDocument.ts";
import { fingerprint } from "./ItemKey.ts";
import { optionalSlot } from "./internal/slots.ts";
import { Count, DurationMs, IsoInstant, Text } from "./Scalars.ts";
import type { GateReport } from "./GateReport.ts";
import type { Item } from "./Item.ts";
import type { HistoryLabel, ItemOutcome } from "./Vocabulary.ts";

const $I = $GateReportId.create("History");

/**
 * **Example** (Check an origin)
 *
 * ```ts
 * import { ObservationOrigin } from "@beep/gate-report/History";
 *
 * console.log(ObservationOrigin.is.hosted("hosted")); // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ObservationOrigin = LiteralKit(["local", "hosted"]).pipe(
  $I.annoteSchema("ObservationOrigin", {
    description: "Where an observation was made: a local run or a hosted CI run.",
  })
);

/**
 * @category models
 * @since 0.0.0
 */
export type ObservationOrigin = typeof ObservationOrigin.Type;

/**
 * **Details**
 *
 * A warned or skipped item is no observation.
 *
 * **Example** (Read the outcomes)
 *
 * ```ts
 * import { ObservedOutcome } from "@beep/gate-report/History";
 *
 * console.log(ObservedOutcome.literals); // ["passed", "failed"]
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ObservedOutcome = LiteralKit(["passed", "failed"]).pipe(
  $I.annoteSchema("ObservedOutcome", {
    description: "The outcome history records for an item: passed or failed.",
  })
);

/**
 * @category models
 * @since 0.0.0
 */
export type ObservedOutcome = typeof ObservedOutcome.Type;

/**
 * **Details**
 *
 * Each attempt of a runner retry is its own observation on the run's input
 * fingerprint, numbered from 0 by `attempt`.
 *
 * **Example** (Build an observation)
 *
 * ```ts
 * import { Observation } from "@beep/gate-report/History";
 * import * as DateTime from "effect/DateTime";
 *
 * const observation = Observation.make({
 *   runId: "r1",
 *   inputFingerprint: "abc",
 *   branch: "feature/a",
 *   origin: "local",
 *   outcome: "failed",
 *   attempt: 0,
 *   at: DateTime.makeUnsafe(0),
 * });
 * console.log(observation.outcome); // failed
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class Observation extends S.Opaque<Observation, { readonly brand: unique symbol }>()(
  S.Struct({
    runId: Text,
    inputFingerprint: Text,
    head: optionalSlot(Text),
    branch: Text,
    origin: ObservationOrigin,
    outcome: ObservedOutcome,
    attempt: Count,
    at: IsoInstant,
  }).pipe(
    $I.annoteSchema("Observation", {
      description:
        "One passed or failed outcome of one item in one run, with the run's input, head, branch and origin.",
    })
  )
) {}

/**
 * **Details**
 *
 * `current` holds the report's own attempts of the item. `lane` is the
 * series `L`: the item's earlier local observations on the report's branch,
 * newest first, at most the window. `main` is the baseline `M`: the item's
 * hosted observations at the lane's merge base, absent when no hosted main
 * report reaches the lane, and empty when the baseline report does not hold
 * the item.
 *
 * **Example** (Evidence with no history)
 *
 * ```ts
 * import { SeriesEvidence } from "@beep/gate-report/History";
 *
 * console.log(SeriesEvidence.make({ current: [], lane: [] }).lane.length); // 0
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class SeriesEvidence extends S.Opaque<SeriesEvidence, { readonly brand: unique symbol }>()(
  S.Struct({
    current: Observation.pipe(S.Array),
    lane: Observation.pipe(S.Array),
    main: optionalSlot(Observation.pipe(S.Array)),
  }).pipe(
    $I.annoteSchema("SeriesEvidence", {
      description: "The current attempts, the lane series and the main baseline one item's label is decided from.",
    })
  )
) {}

const PositiveInt = S.Int.check(S.isGreaterThanOrEqualTo(1));

/**
 * **Details**
 *
 * `window` is `W`, the observations per series per branch the reader uses
 * and the retention keeps (default 10). `retainRuns` keeps the newest runs
 * per gate, subject and branch (default 200). `deadlineMs` is the deadline
 * of the label and delta read and the cap of each store lock wait in an open
 * or a read (default 250). A busy open or a contended migration retries
 * `retryAttempts` times in all (default 5) on a jittered exponential
 * schedule from `retryBaseMs` (default 50).
 *
 * **Example** (Read the defaults)
 *
 * ```ts
 * import { HistoryConfig } from "@beep/gate-report/History";
 *
 * const config = HistoryConfig.make({});
 * console.log(config.window, config.retainRuns, config.deadlineMs); // 10 200 250
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class HistoryConfig extends S.Opaque<HistoryConfig, { readonly brand: unique symbol }>()(
  S.Struct({
    window: PositiveInt.pipe(S.withConstructorDefault(Effect.succeed(10))),
    retainRuns: PositiveInt.pipe(S.withConstructorDefault(Effect.succeed(200))),
    deadlineMs: DurationMs.pipe(S.withConstructorDefault(Effect.succeed(250))),
    retryAttempts: PositiveInt.pipe(S.withConstructorDefault(Effect.succeed(5))),
    retryBaseMs: DurationMs.pipe(S.withConstructorDefault(Effect.succeed(50))),
  }).pipe(
    $I.annoteSchema("HistoryConfig", {
      description: "The history window, run retention, read deadline and open retry schedule.",
    })
  )
) {}

/**
 * **Example** (Check a reason)
 *
 * ```ts
 * import { GateHistoryErrorReason } from "@beep/gate-report/History";
 *
 * console.log(GateHistoryErrorReason.is["open-busy"]("open-busy")); // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const GateHistoryErrorReason = LiteralKit([
  "open-busy",
  "open-failed",
  "migrate-failed",
  "write-failed",
  "read-deadline",
]).pipe(
  $I.annoteSchema("GateHistoryErrorReason", {
    description:
      "Why a history store operation failed: a busy or failed open, a failed migration or write, or a missed read deadline.",
  })
);

/**
 * @category models
 * @since 0.0.0
 */
export type GateHistoryErrorReason = typeof GateHistoryErrorReason.Type;

/**
 * **Details**
 *
 * The driver's own error never crosses a history store's port: the store
 * translates it into this error and keeps the driver's message.
 *
 * **Example** (Build the error)
 *
 * ```ts
 * import { GateHistoryError } from "@beep/gate-report/History";
 *
 * const error = GateHistoryError.make({ reason: "open-busy", message: "database is locked" });
 * console.log(error.reason); // open-busy
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class GateHistoryError extends S.TaggedError<GateHistoryError, { readonly brand: unique symbol }>(
  $I`GateHistoryError`
)(
  "GateHistoryError",
  { reason: GateHistoryErrorReason, message: S.String },
  $I.annoteError<GateHistoryError>("GateHistoryError", {
    description: "A history store operation failed, with its reason and the underlying message.",
  })
) {}

const isObserved = (outcome: ItemOutcome): outcome is ObservedOutcome => outcome === "passed" || outcome === "failed";

/**
 * The outcomes history records for an item in its run: each attempt when
 * the runner retried it, else its outcome; warned and skipped record none.
 *
 * **Example** (A retried pass)
 *
 * ```ts
 * import { observedOutcomes } from "@beep/gate-report/History";
 * import { Item } from "@beep/gate-report/Item";
 * import { ItemKey } from "@beep/gate-report/ItemKey";
 * import * as O from "effect/Option";
 *
 * const item = Item.make({
 *   key: ItemKey.cases.TestKey.make({ file: "a.test.ts", fullName: "adds" }),
 *   unit: "a.test.ts", path: [], name: "adds", outcome: "passed",
 *   attempts: O.some(["failed", "passed"]),
 * });
 * console.log(observedOutcomes(item)); // ["failed", "passed"]
 * ```
 *
 * @param item - the item whose run outcomes are read
 * @returns the passed and failed outcomes in attempt order
 * @category utilities
 * @since 0.0.0
 */
export const observedOutcomes = (item: Item): ReadonlyArray<ObservedOutcome> =>
  A.filter(
    O.getOrElse(item.attempts, () => A.of(item.outcome)),
    isObserved
  );

const outcomesByInput = (observations: ReadonlyArray<Observation>): HashMap.HashMap<string, HashSet.HashSet<string>> =>
  A.reduce(observations, HashMap.empty<string, HashSet.HashSet<string>>(), (byInput, observation) =>
    HashMap.set(
      byInput,
      observation.inputFingerprint,
      HashSet.add(
        O.getOrElse(HashMap.get(byInput, observation.inputFingerprint), () => HashSet.empty<string>()),
        observation.outcome
      )
    )
  );

/**
 * The one flaky rule: two observations on the same input fingerprint
 * disagree, one failed and one passed.
 *
 * **Details**
 *
 * A fail and a pass on different inputs are a code change, not flakiness.
 * The label, the history queries and the flake-quarantine reconciliation all
 * call this function.
 *
 * **Example** (One input, two outcomes)
 *
 * ```ts
 * import { Observation, isFlaky } from "@beep/gate-report/History";
 * import * as DateTime from "effect/DateTime";
 *
 * const on = (outcome: "passed" | "failed", attempt: number) =>
 *   Observation.make({ runId: "r1", inputFingerprint: "x", branch: "a", origin: "local", outcome, attempt, at: DateTime.makeUnsafe(0) });
 * console.log(isFlaky([on("failed", 0), on("passed", 1)])); // true
 * ```
 *
 * @param observations - every observation the rule considers
 * @returns whether some input fingerprint saw both a pass and a fail
 * @category predicates
 * @since 0.0.0
 */
export const isFlaky = (observations: ReadonlyArray<Observation>): boolean =>
  pipe(
    HashMap.values(outcomesByInput(observations)),
    A.fromIterable,
    A.some((outcomes) => HashSet.size(outcomes) > 1)
  );

const headFailed = (series: ReadonlyArray<Observation>): boolean =>
  O.exists(A.head(series), (observation) => observation.outcome === "failed");

const holds =
  (outcome: ObservedOutcome) =>
  (series: ReadonlyArray<Observation>): boolean =>
    A.some(series, (observation) => observation.outcome === outcome);

const allEvidence = (evidence: SeriesEvidence): ReadonlyArray<Observation> => [
  ...evidence.current,
  ...evidence.lane,
  ...O.getOrElse(evidence.main, A.empty),
];

const introduced = (evidence: SeriesEvidence): boolean =>
  O.exists(evidence.main, holds("passed")) || holds("passed")(evidence.lane);

const failedLabel = (evidence: SeriesEvidence): O.Option<HistoryLabel> => {
  if (O.exists(evidence.main, holds("failed"))) return O.some("red-on-main");
  if (headFailed(evidence.lane)) return O.some("persistent");
  return introduced(evidence) ? O.some("introduced-on-lane") : O.none();
};

const passedLabel = (evidence: SeriesEvidence): O.Option<HistoryLabel> =>
  headFailed(evidence.lane) ? O.some("recovered") : O.none();

/**
 * The history label of an item, first match wins.
 *
 * **Details**
 *
 * A failed item is `flaky` when {@link isFlaky} holds over its attempts,
 * `L` and `M`; else `red-on-main` when it failed in `M`; else `persistent`
 * when the newest observation in `L` failed; else `introduced-on-lane` when
 * it passed in `M` or `L` holds a pass; else it has no label. A passed item
 * is `flaky` under the same rule (a retried pass), else `recovered` only when
 * the newest observation in `L` failed, so `recovered` holds for the first
 * green run after a red alone. Warned and skipped items have no label.
 *
 * **Example** (A failure the lane saw pass)
 *
 * ```ts
 * import { Observation, SeriesEvidence, classifyItem } from "@beep/gate-report/History";
 * import * as DateTime from "effect/DateTime";
 * import * as O from "effect/Option";
 *
 * const passed = Observation.make({
 *   runId: "r0", inputFingerprint: "x0", branch: "a", origin: "local", outcome: "passed", attempt: 0, at: DateTime.makeUnsafe(0),
 * });
 * const label = classifyItem("failed", SeriesEvidence.make({ current: [], lane: [passed] }));
 * console.log(O.getOrNull(label)); // introduced-on-lane
 * ```
 *
 * @param outcome - the item's outcome in the current run
 * @param evidence - the current attempts, the lane series and the main baseline
 * @returns the label, or none when nothing can be decided
 * @category utilities
 * @since 0.0.0
 */
export const classifyItem: {
  (outcome: ItemOutcome, evidence: SeriesEvidence): O.Option<HistoryLabel>;
  (evidence: SeriesEvidence): (outcome: ItemOutcome) => O.Option<HistoryLabel>;
} = dual(2, (outcome: ItemOutcome, evidence: SeriesEvidence): O.Option<HistoryLabel> => {
  if (!isObserved(outcome)) return O.none();
  if (isFlaky(allEvidence(evidence))) return O.some("flaky");
  return outcome === "failed" ? failedLabel(evidence) : passedLabel(evidence);
});

/**
 * One failed item of a run, as the delta counts it: its key fingerprint and
 * the unit it hangs off.
 *
 * **Example** (Build a failure)
 *
 * ```ts
 * import { DeltaFailure } from "@beep/gate-report/History";
 *
 * console.log(DeltaFailure.make({ fingerprint: "test|1:a", unit: "a.test.ts" }).unit); // a.test.ts
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class DeltaFailure extends S.Opaque<DeltaFailure, { readonly brand: unique symbol }>()(
  S.Struct({
    fingerprint: Text,
    unit: Text,
  }).pipe(
    $I.annoteSchema("DeltaFailure", {
      description: "A failed item's key fingerprint and its unit, as the fix-loop delta counts it.",
    })
  )
) {}

/**
 * **Details**
 *
 * `unobserved` holds the fingerprints of the items that neither passed nor
 * failed (skipped or warned), so a failure that is skipped or warned now is
 * not counted as fixed.
 *
 * **Example** (A run with no failures)
 *
 * ```ts
 * import { DeltaRun } from "@beep/gate-report/History";
 *
 * console.log(DeltaRun.make({ units: ["a.test.ts"], failed: [] }).failed.length); // 0
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class DeltaRun extends S.Opaque<DeltaRun, { readonly brand: unique symbol }>()(
  S.Struct({
    units: S.Array(Text),
    failed: S.Array(DeltaFailure),
    unobserved: S.Array(Text).pipe(S.withConstructorDefault(Effect.succeed([]))),
  }).pipe(
    $I.annoteSchema("DeltaRun", {
      description: "The units one run checked, its failed items and the items it reported without deciding them.",
    })
  )
) {}

/**
 * The checked unit an item is counted under: its own unit when the report
 * declares it, else the report's one package unit when it declares exactly
 * one (a check gate declares the package and hangs its diagnostics off their
 * files), else the item's own unit.
 *
 * **Example** (A diagnostic under its package)
 *
 * ```ts
 * import { GateReport, Totals, Unit } from "@beep/gate-report/GateReport";
 * import { checkedUnitOf } from "@beep/gate-report/History";
 * import { Item } from "@beep/gate-report/Item";
 * import { ItemKey } from "@beep/gate-report/ItemKey";
 * import * as DateTime from "effect/DateTime";
 *
 * const report = GateReport.make({
 *   gate: "check", subject: "@beep/glob", itemKind: "diagnostic", runId: "r1",
 *   startedAt: DateTime.makeUnsafe(0), durationMs: 0, inputFingerprint: "x",
 *   reason: "failed", outcome: "some-fail", units: [Unit.make({ id: "@beep/glob", kind: "package" })],
 *   items: [], totals: Totals.make({}),
 * });
 * const item = Item.make({
 *   key: ItemKey.cases.DiagnosticKey.make({ file: "src/a.ts", code: "TS2322", shape: "x" }),
 *   unit: "src/a.ts", path: [], name: "x", outcome: "failed",
 * });
 * console.log(checkedUnitOf(report, item)); // @beep/glob
 * ```
 *
 * @param report - the run the item belongs to
 * @param item - the item to place
 * @returns the id of the checked unit the item counts under
 * @category utilities
 * @since 0.0.0
 */
export const checkedUnitOf: {
  (report: GateReport, item: Item): string;
  (item: Item): (report: GateReport) => string;
} = dual(2, (report: GateReport, item: Item): string => {
  if (A.some(report.units, (unit) => unit.id === item.unit)) return item.unit;
  return pipe(
    A.filter(report.units, (unit) => unit.kind === "package"),
    O.liftPredicate((packages) => packages.length === 1),
    O.flatMap(A.head),
    O.match({ onNone: () => item.unit, onSome: (unit) => unit.id })
  );
});

/**
 * The delta's view of a report: the units it checked (those it declares and
 * those its items hang off), its failed items, each under
 * {@link checkedUnitOf}, and the items that neither passed nor failed.
 *
 * **Example** (Read a report)
 *
 * ```ts
 * import { GateReport, Totals } from "@beep/gate-report/GateReport";
 * import { deltaRunOf } from "@beep/gate-report/History";
 * import * as DateTime from "effect/DateTime";
 *
 * const report = GateReport.make({
 *   gate: "test", subject: "@beep/glob", itemKind: "test", runId: "r1",
 *   startedAt: DateTime.makeUnsafe(0), durationMs: 0, inputFingerprint: "x",
 *   reason: "passed", outcome: "all-pass", units: [], items: [], totals: Totals.make({}),
 * });
 * console.log(deltaRunOf(report).failed.length); // 0
 * ```
 *
 * @param report - the run to read
 * @returns the units the run checked, its failed items and its undecided ones
 * @category constructors
 * @since 0.0.0
 */
export const deltaRunOf = (report: GateReport): DeltaRun =>
  DeltaRun.make({
    units: A.dedupe([
      ...A.map(report.units, (unit) => unit.id),
      ...A.map(report.items, (item) => checkedUnitOf(report, item)),
    ]),
    failed: pipe(
      report.items,
      A.filter((item) => item.outcome === "failed"),
      A.map((item) => DeltaFailure.make({ fingerprint: fingerprint(item.key), unit: checkedUnitOf(report, item) }))
    ),
    unobserved: pipe(
      report.items,
      A.filter((item) => !isObserved(item.outcome)),
      A.map((item) => fingerprint(item.key))
    ),
  });

const failedIn = (run: DeltaRun, checked: HashSet.HashSet<string>): HashSet.HashSet<string> =>
  pipe(
    run.failed,
    A.filter((failure) => HashSet.has(checked, failure.unit)),
    A.map((failure) => failure.fingerprint),
    HashSet.fromIterable
  );

/**
 * The fix-loop delta between the previous run and this one, over the units
 * both checked.
 *
 * **Details**
 *
 * `fixed` failed before and passed or is absent now, so an item skipped or
 * warned now is not fixed; `stillFailing` failed in both; `new` failed now and
 * did not fail before. Items in units only
 * one run checked are not counted, and `scopeDiffers` then says so.
 *
 * **Example** (One fixed, one new)
 *
 * ```ts
 * import { DeltaFailure, DeltaRun, deltaOf } from "@beep/gate-report/History";
 *
 * const before = DeltaRun.make({ units: ["u"], failed: [DeltaFailure.make({ fingerprint: "a", unit: "u" })] });
 * const after = DeltaRun.make({ units: ["u"], failed: [DeltaFailure.make({ fingerprint: "b", unit: "u" })] });
 * const delta = deltaOf(before, after);
 * console.log(delta.fixed, delta.stillFailing, delta.new); // 1 0 1
 * ```
 *
 * @param previous - the newest earlier run of the same gate and subject on the branch
 * @param current - the run being reported
 * @returns the fixed, still failing and new counts and whether the scopes differ
 * @category utilities
 * @since 0.0.0
 */
export const deltaOf: {
  (previous: DeltaRun, current: DeltaRun): RunDelta;
  (current: DeltaRun): (previous: DeltaRun) => RunDelta;
} = dual(2, (previous: DeltaRun, current: DeltaRun): RunDelta => {
  const before = HashSet.fromIterable(previous.units);
  const after = HashSet.fromIterable(current.units);
  const checked = HashSet.intersection(before, after);
  const failedBefore = failedIn(previous, checked);
  const failedAfter = failedIn(current, checked);
  const undecided = HashSet.fromIterable(current.unobserved);
  return RunDelta.make({
    fixed: HashSet.size(HashSet.difference(failedBefore, HashSet.union(failedAfter, undecided))),
    stillFailing: HashSet.size(HashSet.intersection(failedBefore, failedAfter)),
    new: HashSet.size(HashSet.difference(failedAfter, failedBefore)),
    scopeDiffers: HashSet.size(checked) !== HashSet.size(before) || HashSet.size(checked) !== HashSet.size(after),
  });
});
