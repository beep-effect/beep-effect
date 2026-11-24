/**
 * The pure classifiers of a report: which total an item counts toward, the
 * run outcome with its extended precedence, the run shape, and the verdict
 * word.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $GateReportId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as A from "effect/Array";
import { pipe } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Str from "effect/String";
import { Totals } from "./GateReport.ts";
import { ItemKey } from "./ItemKey.ts";
import { FailureKind, ItemOutcome, RunReason, UnitKind } from "./Vocabulary.ts";
import type { GateReport } from "./GateReport.ts";
import type { Item } from "./Item.ts";
import type { PolicyRenderState } from "./Policy.ts";
import type { DurationMs } from "./Scalars.ts";
import type { RunOutcome, RunShape } from "./Vocabulary.ts";

const $I = $GateReportId.create("Classify");

/**
 * **Example** (Read the buckets)
 *
 * ```ts
 * import { TallyBucket } from "@beep/gate-report/Classify";
 *
 * console.log(TallyBucket.literals.length); // 9
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const TallyBucket = LiteralKit([
  "passed",
  "failed",
  "warned",
  "skipped",
  "timedOut",
  "loadFailed",
  "hookFailed",
  "unhandled",
  "errored",
]).pipe(
  $I.annoteSchema("TallyBucket", {
    description: "The total an item counts toward in a report's totals.",
  })
);

/**
 * @category models
 * @since 0.0.0
 */
export type TallyBucket = typeof TallyBucket.Type;

const plainFailure = (item: Item): TallyBucket => (ItemKey.guards.FaultKey(item.key) ? "errored" : "failed");

const failedBucket = (item: Item): TallyBucket =>
  pipe(
    item.failureKind,
    O.map(
      FailureKind.match({
        assertion: () => plainFailure(item),
        timeout: (): TallyBucket => "timedOut",
        load: (): TallyBucket => "loadFailed",
        hook: (): TallyBucket => "hookFailed",
        unhandled: (): TallyBucket => "unhandled",
      })
    ),
    O.getOrElse(() => plainFailure(item))
  );

/**
 * The total an item counts toward.
 *
 * **Details**
 *
 * A failed item counts by its failure kind: timeouts, load failures, hook
 * failures and unhandled errors each have their own total, so `failed` stays
 * a pure count of ordinary failures. A failed fault item with no kind is the
 * errored fallback and counts as `errored`.
 *
 * **Example** (Bucket a timed-out test)
 *
 * ```ts
 * import { itemBucket } from "@beep/gate-report/Classify";
 * import { Item } from "@beep/gate-report/Item";
 * import { ItemKey } from "@beep/gate-report/ItemKey";
 * import * as O from "effect/Option";
 *
 * const item = Item.make({
 *   key: ItemKey.cases.TestKey.make({ file: "a.test.ts", fullName: "slow" }),
 *   unit: "a.test.ts",
 *   path: [],
 *   name: "slow",
 *   outcome: "failed",
 *   failureKind: O.some("timeout"),
 * });
 * console.log(itemBucket(item)); // timedOut
 * ```
 *
 * @category domain-logic
 * @since 0.0.0
 */
export const itemBucket = (item: Item): TallyBucket =>
  ItemOutcome.match(item.outcome, {
    passed: (): TallyBucket => "passed",
    warned: (): TallyBucket => "warned",
    skipped: (): TallyBucket => "skipped",
    failed: () => failedBucket(item),
  });

const zeroTally: Readonly<Record<TallyBucket, number>> = {
  passed: 0,
  failed: 0,
  warned: 0,
  skipped: 0,
  timedOut: 0,
  loadFailed: 0,
  hookFailed: 0,
  unhandled: 0,
  errored: 0,
};

/**
 * Count items into their totals.
 *
 * **Example** (Tally no items)
 *
 * ```ts
 * import { tally } from "@beep/gate-report/Classify";
 *
 * const totals = tally({ items: [], collected: 0, durationMs: 5 });
 * console.log(totals.durationMs); // 5
 * ```
 *
 * @category domain-logic
 * @since 0.0.0
 */
export const tally = (input: {
  readonly items: ReadonlyArray<Item>;
  readonly collected: number;
  readonly durationMs: DurationMs;
}): Totals => {
  const counts = A.reduce(input.items, zeroTally, (acc, item) => {
    const bucket = itemBucket(item);
    return { ...acc, [bucket]: acc[bucket] + 1 };
  });
  return Totals.make({ ...counts, collected: input.collected, durationMs: input.durationMs });
};

/**
 * Every failure total summed: failed, timed out, load, hook, unhandled and
 * errored.
 *
 * **Example** (Sum the failures)
 *
 * ```ts
 * import { failureCount } from "@beep/gate-report/Classify";
 * import { Totals } from "@beep/gate-report/GateReport";
 *
 * console.log(failureCount(Totals.make({ failed: 1, timedOut: 2 }))); // 3
 * ```
 *
 * @category domain-logic
 * @since 0.0.0
 */
export const failureCount = (totals: Totals): number =>
  totals.failed + totals.timedOut + totals.loadFailed + totals.hookFailed + totals.unhandled + totals.errored;

const hasBreaches = (policy: O.Option<PolicyRenderState>): boolean =>
  O.exists(policy, (state) => A.isReadonlyArrayNonEmpty(state.breaches));

const settledOutcome = (input: ClassifyOutcomeInput): RunOutcome =>
  hasBreaches(input.policy) ? "policy-violation" : input.totals.warned > 0 ? "warnings-only" : "all-pass";

const passedOutcome = (input: ClassifyOutcomeInput): RunOutcome =>
  failureCount(input.totals) > 0 ? "some-fail" : settledOutcome(input);

type ClassifyOutcomeInput = Pick<GateReport, "reason" | "totals" | "policy">;

/**
 * Classify a run's outcome with the extended precedence.
 *
 * **Details**
 *
 * `cancelled` gives `interrupted`; a `failed` or `errored` reason, or any
 * failure total, gives `some-fail`; a policy breach gives `policy-violation`;
 * warnings and nothing worse give `warnings-only`; otherwise `all-pass`.
 * Failures always beat policy.
 *
 * **Example** (Classify a clean run)
 *
 * ```ts
 * import { classifyOutcome } from "@beep/gate-report/Classify";
 * import { Totals } from "@beep/gate-report/GateReport";
 * import * as O from "effect/Option";
 *
 * console.log(classifyOutcome({ reason: "passed", totals: Totals.make({ passed: 3 }), policy: O.none() }));
 * // all-pass
 * ```
 *
 * @category domain-logic
 * @since 0.0.0
 */
export const classifyOutcome = (input: ClassifyOutcomeInput): RunOutcome =>
  RunReason.match(input.reason, {
    cancelled: (): RunOutcome => "interrupted",
    errored: (): RunOutcome => "some-fail",
    failed: (): RunOutcome => "some-fail",
    passed: () => passedOutcome(input),
  });

const leafUnitIds = (report: GateReport): HashSet.HashSet<string> => {
  const declared = HashSet.fromIterable(
    pipe(
      report.units,
      A.filter((unit) => !UnitKind.is.package(unit.kind)),
      A.map((unit) => unit.id)
    )
  );
  return HashSet.size(declared) > 0
    ? declared
    : HashSet.fromIterable(A.map(itemsOutsideFaults(report), (item) => item.unit));
};

const itemsOutsideFaults = (report: GateReport): ReadonlyArray<Item> =>
  A.filter(report.items, (item) => !ItemKey.guards.FaultKey(item.key));

const soleUnitShape = (report: GateReport): RunShape => (itemsOutsideFaults(report).length === 1 ? "item" : "unit");

const unitShape = (report: GateReport): RunShape => {
  const leaves = HashSet.size(leafUnitIds(report));
  return leaves === 1 ? soleUnitShape(report) : "package";
};

/**
 * Classify how much a run covered.
 *
 * **Details**
 *
 * More than one package unit is `workspace`; more than one leaf unit (a file
 * or a job) is `package`; one leaf unit with one item is `item`; one leaf
 * unit otherwise is `unit`; no leaf unit is `package`. Leaf units come from
 * the declared units, or from the items when none were declared.
 *
 * **Example** (Classify an empty run)
 *
 * ```ts
 * import { classifyShape } from "@beep/gate-report/Classify";
 * import { GateReport, Totals } from "@beep/gate-report/GateReport";
 * import * as DateTime from "effect/DateTime";
 *
 * const report = GateReport.make({
 *   gate: "test", subject: "@beep/glob", itemKind: "test", runId: "r1",
 *   startedAt: DateTime.makeUnsafe(0), durationMs: 0, inputFingerprint: "x",
 *   reason: "errored", outcome: "some-fail", units: [], items: [], totals: Totals.make({}),
 * });
 * console.log(classifyShape(report)); // package
 * ```
 *
 * @category domain-logic
 * @since 0.0.0
 */
export const classifyShape = (report: GateReport): RunShape =>
  A.filter(report.units, (unit) => UnitKind.is.package(unit.kind)).length > 1 ? "workspace" : unitShape(report);

/**
 * The verdict word: the run reason in capitals.
 *
 * **Example** (Read a verdict word)
 *
 * ```ts
 * import { verdictWord } from "@beep/gate-report/Classify";
 *
 * console.log(verdictWord("errored")); // ERRORED
 * ```
 *
 * @category domain-logic
 * @since 0.0.0
 */
export const verdictWord = (reason: RunReason): string => Str.toUpperCase(reason);
