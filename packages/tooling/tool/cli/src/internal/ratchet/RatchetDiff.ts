/**
 * Pure fail-on-growth ratchet diff classification.
 *
 * **Details**
 *
 * Two shapes cover every committed ratchet baseline in the repo CLI:
 *
 * - Set-membership ratchets (Knip) key each finding and fail when the current
 *   set introduces a finding absent from the committed baseline.
 *   {@link diffMembership} reproduces `KnipRatchet.compareFindings`
 *   (introduced / resolved) generically over any keyed finding.
 * - Numeric-totals ratchets (JSDoc inventory) track one non-negative count per
 *   metric and fail when any tracked total grows or a baseline metric is
 *   missing from the current inventory. {@link diffTotals} reproduces
 *   `JSDocRatchet.compareTotals` (increased / decreased / missing) over a
 *   `Record<string, number>`.
 *
 * The schema-first inventory ratchet computes
 * missing/stale via the same membership classification, but keep their bespoke
 * merge, per-diagnostic logging, and strict-failure gating outside this pure
 * core; see the divergence catalog in the wave report.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { A, O, pipe } from "@beep/utils";
import { Order } from "effect";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import type { Equivalence } from "effect";

const $I = $RepoCliId.create("internal/ratchet/RatchetDiff");

/**
 * Classify a current keyed finding set against its committed baseline.
 *
 * **Details**
 *
 * Reproduces `KnipRatchet.compareFindings`: a finding is introduced when no
 * baseline finding is equivalent to it, and resolved when no current finding is
 * equivalent to a baseline finding. Both directions are filtered with the same
 * `equivalence` and re-sorted with `order` so output is deterministic
 * regardless of input ordering. `introduced` (current findings missing from the
 * baseline) is the failure signal; `resolved` (baseline findings no longer
 * present) is the tighten-baseline nudge.
 *
 * **Example** (Diff a membership)
 *
 * ```ts
 * import { diffMembership } from "@beep/repo-cli/test/Ratchet"
 * import { Order } from "effect"
 *
 * const diff = diffMembership({
 *   current: ["a", "c"],
 *   baseline: ["a", "b"],
 *   equivalence: (left: string, right: string) => left === right,
 *   order: Order.String
 * })
 * console.log(diff.introduced) // ["c"]
 * console.log(diff.resolved) // ["b"]
 * ```
 *
 * @param input - Current and baseline finding arrays plus the finding
 * equivalence and total order.
 * @returns The membership diff with introduced, resolved, and both counts.
 * @category classification
 * @since 0.0.0
 */
export const diffMembership = <Finding>(input: {
  readonly current: ReadonlyArray<Finding>;
  readonly baseline: ReadonlyArray<Finding>;
  readonly equivalence: Equivalence.Equivalence<Finding>;
  readonly order: Order.Order<Finding>;
}): {
  readonly currentCount: number;
  readonly baselineCount: number;
  readonly introduced: ReadonlyArray<Finding>;
  readonly resolved: ReadonlyArray<Finding>;
} => {
  const missingFrom = (source: ReadonlyArray<Finding>, target: ReadonlyArray<Finding>): ReadonlyArray<Finding> =>
    pipe(
      source,
      A.filter((finding) => !A.some(target, (candidate) => input.equivalence(candidate, finding))),
      A.sort(input.order)
    );

  return {
    currentCount: A.length(input.current),
    baselineCount: A.length(input.baseline),
    introduced: missingFrom(input.current, input.baseline),
    resolved: missingFrom(input.baseline, input.current),
  };
};

/**
 * Difference for one tracked numeric ratchet total.
 *
 * **Example** (Construct a ratchet total delta)
 *
 * ```ts
 * import { RatchetTotalDelta } from "@beep/repo-cli/test/Ratchet"
 *
 * const delta = RatchetTotalDelta.make({ metric: "missingExportExamples", baseline: 1, current: 2, delta: 1 })
 * console.log(delta.metric)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RatchetTotalDelta extends S.Class<RatchetTotalDelta>($I`RatchetTotalDelta`)(
  {
    metric: S.String,
    baseline: S.Finite,
    current: S.Finite,
    delta: S.Finite,
  },
  $I.annote("RatchetTotalDelta", {
    description: "Difference for one tracked numeric ratchet total.",
  })
) {}

/**
 * Difference between current numeric totals and the committed baseline totals.
 *
 * **Details**
 *
 * `increased` (delta &gt; 0) is the failure signal; `decreased` (delta &lt; 0)
 * is the tighten-baseline nudge; `missing` names baseline metrics absent from
 * the current totals (a separate failure signal). Deltas are sorted by metric.
 *
 * **Example** (Construct a ratchet totals diff)
 *
 * ```ts
 * import { RatchetTotalsDiff } from "@beep/repo-cli/test/Ratchet"
 *
 * const diff = RatchetTotalsDiff.make({
 *   currentTotalCount: 1,
 *   baselineTotalCount: 1,
 *   increased: [],
 *   decreased: [],
 *   missing: []
 * })
 * console.log(diff.increased.length)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RatchetTotalsDiff extends S.Class<RatchetTotalsDiff>($I`RatchetTotalsDiff`)(
  {
    currentTotalCount: S.Finite,
    baselineTotalCount: S.Finite,
    increased: S.Array(RatchetTotalDelta),
    decreased: S.Array(RatchetTotalDelta),
    missing: S.Array(S.String),
  },
  $I.annote("RatchetTotalsDiff", {
    description: "Difference between current numeric totals and the committed baseline totals.",
  })
) {}

const deltaByMetric = Order.mapInput(Order.String, (delta: RatchetTotalDelta) => delta.metric);

const metricDelta = (
  metric: string,
  current: Readonly<Record<string, number>>,
  baseline: Readonly<Record<string, number>>
): O.Option<RatchetTotalDelta> =>
  pipe(
    R.get(current, metric),
    O.map((currentValue) =>
      RatchetTotalDelta.make({
        metric,
        baseline: pipe(
          R.get(baseline, metric),
          O.getOrElse(() => 0)
        ),
        current: currentValue,
        delta:
          currentValue -
          pipe(
            R.get(baseline, metric),
            O.getOrElse(() => 0)
          ),
      })
    )
  );

/**
 * Current and committed baseline numeric totals, keyed by metric name.
 *
 * **Example** (Construct a diff totals input)
 *
 * ```ts
 * import { DiffTotalsInput } from "@beep/repo-cli/test/Ratchet"
 *
 * const input = DiffTotalsInput.make({ current: { examples: 2 }, baseline: { examples: 1 } })
 * console.log(input.current.examples)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DiffTotalsInput extends S.Class<DiffTotalsInput>($I`DiffTotalsInput`)(
  {
    current: S.Record(S.String, S.Finite),
    baseline: S.Record(S.String, S.Finite),
  },
  $I.annote("DiffTotalsInput", {
    description: "Current and committed baseline numeric totals keyed by metric name.",
  })
) {}

/**
 * Classify current numeric totals against the committed baseline totals.
 *
 * **Details**
 *
 * Reproduces `JSDocRatchet.compareTotals`: it walks the baseline metric names
 * in sorted order, computes a delta for each metric present in the current
 * totals (treating an absent baseline entry as `0`), and partitions the deltas
 * into increased and decreased. Baseline metrics with no current entry are
 * reported as `missing`.
 *
 * **Example** (Diff totals)
 *
 * ```ts
 * import { diffTotals } from "@beep/repo-cli/test/Ratchet"
 *
 * const diff = diffTotals({ current: { examples: 2 }, baseline: { examples: 1 } })
 * console.log(diff.increased.map((delta) => delta.metric)) // ["examples"]
 * ```
 *
 * @param input - Current and baseline totals keyed by metric name.
 * @returns The totals diff with increased, decreased, and missing metrics.
 * @category classification
 * @since 0.0.0
 */
export const diffTotals = (input: DiffTotalsInput): RatchetTotalsDiff => {
  const baselineMetricNames = pipe(R.keys(input.baseline), A.sort(Order.String));
  const deltas = pipe(
    baselineMetricNames,
    A.map((metric) => metricDelta(metric, input.current, input.baseline)),
    A.getSomes,
    A.sort(deltaByMetric)
  );

  return RatchetTotalsDiff.make({
    currentTotalCount: A.length(R.keys(input.current)),
    baselineTotalCount: A.length(baselineMetricNames),
    increased: pipe(
      deltas,
      A.filter((delta) => delta.delta > 0),
      A.sort(deltaByMetric)
    ),
    decreased: pipe(
      deltas,
      A.filter((delta) => delta.delta < 0),
      A.sort(deltaByMetric)
    ),
    missing: pipe(
      baselineMetricNames,
      A.filter((metric) => O.isNone(R.get(input.current, metric)))
    ),
  });
};
