/**
 * Settle vocabulary shared by the settle loop and the watch stream: the
 * expected-context census, the settle verdict and the census membership test.
 *
 * **Details**
 *
 * Split from `Settle.ts` so the watch stream and merge-readiness policy read
 * the verdict without importing the settle loop's git and `gh` reads
 * (beep-cli-composition W1b).
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { HeavyAdmission } from "../../Ci/HeavyAdmission.ts";
import { YeetSettleReason } from "./CheckOutcome.ts";

const $I = $RepoCliId.create("commands/Yeet/internal/Settle.schemas");

const yeetExpectedContextCensusGatedDefault = A.empty<string>();

/**
 * How the expected contexts line up against the reported checks.
 *
 * **Details**
 *
 * - `matched`: expected contexts that a reported check names exactly.
 * - `unmatched`: expected contexts with no exact match but at least one matrix
 *   child (`<context> (<variant>)`) reported — tolerated by name, children
 *   waited for.
 * - `missing`: expected contexts with neither an exact match nor a child.
 * - `pending`: reported checks still pending that hold the settle: matched
 *   contexts, matrix children of unmatched contexts, and every `--required` row.
 * - `gated`: expected contexts of a gated family moved out of `missing` and
 *   `pending` while the head's admission verdict is `hold` (ttc B8); empty
 *   otherwise.
 *
 * Every list is sorted so equal censuses render identically.
 *
 * **Example** (Construct a census)
 *
 * ```ts
 * import { YeetExpectedContextCensus } from "@beep/repo-cli/test/Yeet"
 *
 * const census = YeetExpectedContextCensus.make({ matched: ["Lint"], unmatched: ["Test Unit"], pending: [], missing: [] })
 * console.log(census.unmatched) // [ "Test Unit" ]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetExpectedContextCensus extends S.Opaque<YeetExpectedContextCensus, { readonly brand: unique symbol }>()(
  S.Struct({
    matched: S.Array(S.String),
    unmatched: S.Array(S.String),
    pending: S.Array(S.String),
    missing: S.Array(S.String),
    gated: S.Array(S.String).pipe(
      S.withConstructorDefault(Effect.succeed(yeetExpectedContextCensusGatedDefault)),
      S.withDecodingDefaultTypeKey(Effect.succeed(yeetExpectedContextCensusGatedDefault))
    ),
  }).pipe(
    $I.annoteSchema("YeetExpectedContextCensus", {
      description:
        "Expected contexts partitioned into matched, tolerated-unmatched, and missing, plus the pending checks that hold the settle.",
    })
  )
) {}

const matrixChildPrefix = (context: string): string => `${context} (`;

/**
 * Whether a reported check name is a matrix child of an expected context.
 *
 * **Details**
 *
 * GitHub reports a matrix job as `<context> (<axis>)`, so a child is any name
 * that starts with the context followed by ` (`.
 *
 * **Example** (A matrix child of `Test Unit`)
 *
 * ```ts
 * import { isMatrixChildOf } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(isMatrixChildOf("Test Unit", "Test Unit (unit-a)")) // true
 * console.log(isMatrixChildOf("Test Unit", "Test Unit Extra")) // false
 * ```
 *
 * @param context - The expected context name.
 * @param name - The reported check name.
 * @returns Whether `name` is a matrix child of `context`.
 * @category predicates
 * @since 0.0.0
 */
export const isMatrixChildOf: {
  (name: string): (context: string) => boolean;
  (context: string, name: string): boolean;
} = dual(2, (context: string, name: string): boolean => Str.startsWith(matrixChildPrefix(context))(name));

/**
 * The settle rule's answer for one poll.
 *
 * **Details**
 *
 * `settled` says the required census is complete for this head. `reason` is
 * the wait reason the gate line names: `registration`, `required-pending` or
 * `heavy-not-admitted` while unsettled, `settle-timeout` when the budget
 * expired unsettled (never while held, see {@link yeetSettleVerdictIsHeld}),
 * `closeout-pending` when settled but no closeout artifact binds the head, and
 * `None` when settled with the closeout bound — the state in which merge
 * readiness is evaluated.
 *
 * **Example** (A settled head awaiting closeout)
 *
 * ```ts
 * import { YeetExpectedContextCensus, YeetSettleVerdict } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const verdict = YeetSettleVerdict.make({
 *   settled: true,
 *   reason: O.some("closeout-pending"),
 *   census: YeetExpectedContextCensus.make({ matched: ["Lint"], unmatched: [], pending: [], missing: [] }),
 *   waitedMs: 90_000,
 *   timeoutMs: 1_800_000
 * })
 * console.log(verdict.settled) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetSettleVerdict extends S.Opaque<YeetSettleVerdict, { readonly brand: unique symbol }>()(
  S.Struct({
    settled: S.Boolean,
    reason: YeetSettleReason.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    census: YeetExpectedContextCensus,
    waitedMs: S.Finite,
    timeoutMs: S.Finite,
    budgetApplies: S.Boolean.pipe(
      S.withDecodingDefaultKey(Effect.succeed(true)),
      S.withConstructorDefault(Effect.succeed(true))
    ),
    admission: HeavyAdmission.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
  }).pipe(
    $I.annoteSchema("YeetSettleVerdict", {
      description:
        "Whether the required census settled, the wait reason the gate line names, the census behind it, whether the registration budget still applies, and the heavy admission it was judged under.",
    })
  )
) {}

/**
 * Whether the settle census treats a reported check name as required: an
 * expected context matched by exact name, or a matrix child of a tolerated
 * expected parent (`Test Unit (unit-a)` under `Test Unit`).
 *
 * **Details**
 *
 * `gh pr checks --required` lists only exact context names, so a failed
 * matrix child of a required parent carries `required: false` from GitHub.
 * The merge loop's red triage and the watch's failure census both consult
 * this rule alongside that flag, so a required parent's children count as
 * required in every consumer. `None` (no settle verdict yet) requires nothing.
 *
 * **Example** (A matrix child of a required parent)
 *
 * ```ts
 * import { YeetExpectedContextCensus, YeetSettleVerdict, yeetSettleCensusRequires } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const census = YeetExpectedContextCensus.make({ matched: ["Lint"], unmatched: ["Test Unit"], pending: [], missing: [] })
 * const verdict = O.some(YeetSettleVerdict.make({ settled: false, reason: O.some("required-pending"), census, waitedMs: 1, timeoutMs: 1 }))
 * console.log(yeetSettleCensusRequires(verdict, "Test Unit (unit-a)")) // true
 * console.log(yeetSettleCensusRequires(verdict, "Vercel")) // false
 * ```
 *
 * @param verdict - The head's settle verdict, when one has been derived.
 * @param name - The reported check name.
 * @returns Whether the census requires that name.
 * @category predicates
 * @since 0.0.0
 */
export const yeetSettleCensusRequires: {
  (name: string): (verdict: O.Option<YeetSettleVerdict>) => boolean;
  (verdict: O.Option<YeetSettleVerdict>, name: string): boolean;
} = dual(2, (verdict: O.Option<YeetSettleVerdict>, name: string): boolean =>
  O.exists(
    verdict,
    (value) =>
      A.contains(value.census.matched, name) ||
      A.some(value.census.unmatched, (parent) => isMatrixChildOf(parent, name))
  )
);
