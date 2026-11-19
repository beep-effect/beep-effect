/**
 * The policy slot of a report: coverage thresholds, an error budget and a
 * maximum warning count, each recorded as a breach when it is not met.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $GateReportId } from "@beep/identity/packages";
import { flow } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { optionalSlot } from "./internal/slots.ts";
import { Count, Text } from "./Scalars.ts";
import { CoverageMetric } from "./Vocabulary.ts";

const $I = $GateReportId.create("Policy");

const Percent = S.Finite.check(S.isBetween({ minimum: 0, maximum: 100 })).pipe(
  $I.annoteSchema("Percent", {
    description: "A percentage between 0 and 100.",
  })
);

/**
 * One policy the run did not meet.
 *
 * **Details**
 *
 * Widens upstream's coverage threshold violations and glob shortfalls
 * (`pattern`) with an error budget and a warning limit. Any breach makes the
 * outcome `policy-violation` unless a failure outranks it.
 *
 * **Example** (Build a coverage breach)
 *
 * ```ts
 * import { PolicyBreach } from "@beep/gate-report/Policy";
 *
 * const breach = PolicyBreach.cases.CoverageBreach.make({ metric: "lines", expected: 80, actual: 72 });
 * console.log(breach._tag); // CoverageBreach
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PolicyBreach = S.TaggedUnion({
  CoverageBreach: { metric: CoverageMetric, expected: Percent, actual: Percent, pattern: optionalSlot(Text) },
  ErrorBudgetBreach: { budget: Count, actual: Count },
  WarningLimitBreach: { maximum: Count, actual: Count },
}).pipe(
  $I.annoteSchema("PolicyBreach", {
    description: "One policy the run did not meet: a coverage threshold, an error budget or a warning limit.",
  })
);

/**
 * Type of {@link PolicyBreach}.
 *
 * @category models
 * @since 0.0.0
 */
export type PolicyBreach = typeof PolicyBreach.Type;

/**
 * The policy slot of a report: every breach the run recorded.
 *
 * **Details**
 *
 * Replaces upstream `CoverageRenderState`; coverage, the error budget and the
 * warning limit share one slot.
 *
 * **Example** (Build an empty policy slot)
 *
 * ```ts
 * import { PolicyRenderState } from "@beep/gate-report/Policy";
 *
 * console.log(PolicyRenderState.make({ breaches: [] }).breaches.length); // 0
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class PolicyRenderState extends S.Opaque<PolicyRenderState, { readonly brand: unique symbol }>()(
  S.Struct({
    breaches: S.Array(PolicyBreach),
  }).pipe(
    $I.annoteSchema("PolicyRenderState", {
      description: "The policy slot of a report: coverage, error budget and warning limit breaches.",
    })
  )
) {}

const patternSuffix: (pattern: O.Option<string>) => string = flow(
  O.map((glob) => ` (${glob})`),
  O.getOrElse(() => "")
);

const percent = (value: number): string => `${Math.round(value * 10) / 10}%`;

/**
 * The one console line a breach renders as.
 *
 * **Example** (Render a coverage breach)
 *
 * ```ts
 * import { PolicyBreach, breachLine } from "@beep/gate-report/Policy";
 *
 * console.log(breachLine(PolicyBreach.cases.CoverageBreach.make({ metric: "lines", expected: 80, actual: 72 })));
 * // coverage lines 72% < 80%
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export const breachLine: (breach: PolicyBreach) => string = PolicyBreach.match({
  CoverageBreach: (breach) =>
    `coverage ${breach.metric} ${percent(breach.actual)} < ${percent(breach.expected)}${patternSuffix(breach.pattern)}`,
  ErrorBudgetBreach: (breach) => `error budget: ${breach.actual} errors > ${breach.budget} allowed`,
  WarningLimitBreach: (breach) => `warnings: ${breach.actual} > ${breach.maximum} allowed`,
});
