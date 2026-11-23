/**
 * The policy slot of a report: coverage thresholds, an error budget and a
 * maximum warning count, each recorded as a breach when it is not met.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $GateReportId } from "@beep/identity/packages";
import * as A from "effect/Array";
import { flow } from "effect/Function";
import * as Num from "effect/Number";
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

const DIGITS: ReadonlyArray<number> = [1, 2, 3, 4, 5, 6];

const atFirstDistinguishingPrecisionElseAsGiven = (actual: number, expected: number): string =>
  O.getOrElse(
    O.map(
      A.findFirst(DIGITS, (digits) => Num.round(actual, digits) !== Num.round(expected, digits)),
      (digits) => `${Num.round(actual, digits)}% < ${Num.round(expected, digits)}%`
    ),
    () => `${actual}% < ${expected}%`
  );

/**
 * The one console line a breach renders as.
 *
 * **Details**
 *
 * Coverage percentages print to one decimal, and with up to six when one
 * decimal would show equal numbers, so `79.99` against `80` reads
 * `79.99% < 80%`. Numbers that six decimals cannot tell apart print as given.
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
    `coverage ${breach.metric} ${atFirstDistinguishingPrecisionElseAsGiven(breach.actual, breach.expected)}${patternSuffix(breach.pattern)}`,
  ErrorBudgetBreach: (breach) => `error budget: ${breach.actual} errors > ${breach.budget} allowed`,
  WarningLimitBreach: (breach) => `warnings: ${breach.actual} > ${breach.maximum} allowed`,
});
