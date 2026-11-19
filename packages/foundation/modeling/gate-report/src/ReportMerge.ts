/**
 * Fold two runs of one gate over one subject into one report: the runs a
 * single script invocation made, such as a Bun run of most files followed by
 * a Node run of the one file that needs Node.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as A from "effect/Array";
import { dual, pipe } from "effect/Function";
import * as O from "effect/Option";
import { classifyOutcome, tally } from "./Classify.ts";
import { GateReport } from "./GateReport.ts";
import { fingerprint } from "./ItemKey.ts";
import { PolicyRenderState } from "./Policy.ts";
import { StrayOutput } from "./StrayOutput.ts";
import { worstReason } from "./Vocabulary.ts";
import type { Unit } from "./GateReport.ts";
import type { Item } from "./Item.ts";

// Each id once, the first run's unit kept: both runs declare the package unit.
const mergeUnits = (earlier: ReadonlyArray<Unit>, later: ReadonlyArray<Unit>): ReadonlyArray<Unit> =>
  A.dedupeWith(A.appendAll(earlier, later), (left, right) => left.id === right.id);

// Each key once: a key both runs report keeps the later run's result, in the earlier run's place.
const mergeItems = (earlier: ReadonlyArray<Item>, later: ReadonlyArray<Item>): ReadonlyArray<Item> => {
  const laterOf = (item: Item) => A.findFirst(later, (next) => fingerprint(next.key) === fingerprint(item.key));
  const replaced = A.map(earlier, (item) => O.getOrElse(laterOf(item), () => item));
  const added = A.filter(
    later,
    (item) => !A.some(earlier, (prior) => fingerprint(prior.key) === fingerprint(item.key))
  );
  return A.appendAll(replaced, added);
};

const mergePolicy = (
  earlier: O.Option<PolicyRenderState>,
  later: O.Option<PolicyRenderState>
): O.Option<PolicyRenderState> =>
  pipe(
    A.getSomes([earlier, later]),
    A.flatMap((state) => state.breaches),
    O.liftPredicate(A.isReadonlyArrayNonEmpty),
    O.flatMap((breaches) => PolicyRenderState.makeOption({ breaches })),
    O.orElse(() => O.orElse(earlier, () => later))
  );

const mergeStrayOutput = (earlier: O.Option<StrayOutput>, later: O.Option<StrayOutput>): O.Option<StrayOutput> =>
  O.match(earlier, {
    onNone: () => later,
    onSome: (first) =>
      O.match(later, {
        onNone: () => earlier,
        onSome: (second) =>
          StrayOutput.makeOption({
            total: first.total + second.total,
            stdout: first.stdout + second.stdout,
            stderr: first.stderr + second.stderr,
            bytes: first.bytes + second.bytes,
            samples: A.appendAll(first.samples, second.samples),
          }),
      }),
  });

const merge = (earlier: GateReport, later: GateReport): GateReport => {
  const items = mergeItems(earlier.items, later.items);
  const durationMs = earlier.durationMs + later.durationMs;
  const reason = worstReason([earlier.reason, later.reason]);
  const totals = tally({ items, collected: earlier.totals.collected + later.totals.collected, durationMs });
  const policy = mergePolicy(earlier.policy, later.policy);
  return GateReport.make({
    ...earlier,
    durationMs,
    reason,
    outcome: classifyOutcome({ reason, totals, policy }),
    units: mergeUnits(earlier.units, later.units),
    items,
    totals,
    policy,
    strayOutput: mergeStrayOutput(earlier.strayOutput, later.strayOutput),
  });
};

/**
 * Fold a later run of the same gate and subject into an earlier one.
 *
 * **Details**
 *
 * Units and items are concatenated, each unit id and item key once: a key
 * both runs report keeps the later run's result in the earlier run's place.
 * Totals are recounted from the items by {@link tally}, with the collected
 * counts and durations summed; the reason is the worse of the two by
 * {@link worstReason}, and the outcome is classified from those. Policy
 * breaches and stray output add up. The run id, start, fingerprint, head and
 * branch stay the earlier run's, so the record names the invocation's first
 * run.
 *
 * **Example** (Fold a second run into the first)
 *
 * ```ts
 * import { GateReport, Totals } from "@beep/gate-report/GateReport";
 * import { mergeReports } from "@beep/gate-report/ReportMerge";
 * import * as DateTime from "effect/DateTime";
 *
 * const run = (runId: string, durationMs: number) =>
 *   GateReport.make({
 *     gate: "test", subject: "@beep/glob", itemKind: "test", runId,
 *     startedAt: DateTime.makeUnsafe(0), durationMs, inputFingerprint: "x",
 *     reason: "passed", outcome: "all-pass", units: [], items: [], totals: Totals.make({ collected: 1 }),
 *   });
 * const merged = mergeReports(run("r1", 10), run("r2", 5));
 * console.log(merged.runId, merged.durationMs, merged.totals.collected); // r1 15 2
 * ```
 *
 * @param earlier - The report the invocation's earlier runs left.
 * @param later - The report of the run that just finished.
 * @returns One report of both runs.
 * @category combinators
 * @since 0.0.0
 */
export const mergeReports: {
  (later: GateReport): (earlier: GateReport) => GateReport;
  (earlier: GateReport, later: GateReport): GateReport;
} = dual(2, merge);
