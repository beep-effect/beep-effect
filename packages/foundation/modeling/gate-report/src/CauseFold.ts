/**
 * The cause-folding table: diagnostic codes whose items are one cascade with
 * one cause, folded to a single console line with the count, the cause and
 * the caller's fix command.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $GateReportId } from "@beep/identity/packages";
import * as A from "effect/Array";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { FoldLine } from "./ConsoleDocument.ts";
import { Item } from "./Item.ts";
import { Text } from "./Scalars.ts";

const $I = $GateReportId.create("CauseFold");

/**
 * One row of the folding table: a diagnostic code and the cause it stands for.
 *
 * **Example** (Build a rule)
 *
 * ```ts
 * import { CauseFoldRule } from "@beep/gate-report/CauseFold";
 *
 * console.log(CauseFoldRule.make({ code: "TS6305", cause: "upstream declarations are not built" }).code); // TS6305
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class CauseFoldRule extends S.Opaque<CauseFoldRule, { readonly brand: unique symbol }>()(
  S.Struct({
    code: Text,
    cause: S.String,
  }).pipe(
    $I.annoteSchema("CauseFoldRule", {
      description: "A diagnostic code whose items are one cascade, and the cause it stands for.",
    })
  )
) {}

/**
 * Fix commands by diagnostic code, supplied by the caller.
 *
 * **Example** (Build fixes)
 *
 * ```ts
 * import { FoldFixes } from "@beep/gate-report/CauseFold";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(FoldFixes)({ TS6305: "bun run build" })); // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FoldFixes = S.Record(S.String, Text).pipe(
  $I.annoteSchema("FoldFixes", {
    description: "The fix command a fold line names, by diagnostic code.",
  })
);

/**
 * Type of {@link FoldFixes}.
 *
 * @category models
 * @since 0.0.0
 */
export type FoldFixes = typeof FoldFixes.Type;

/**
 * The default folding table, TS6305 first.
 *
 * **Details**
 *
 * TS6305 ("Output file has not been built from source file") is the cascade a
 * package check prints when its upstream declarations are not built: one
 * cause, hundreds of lines. The table names causes only; fix commands are
 * repo specifics and come from the caller.
 *
 * **Example** (Read the first rule)
 *
 * ```ts
 * import { defaultCauseFolds } from "@beep/gate-report/CauseFold";
 *
 * console.log(defaultCauseFolds[0].code); // TS6305
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const defaultCauseFolds: A.NonEmptyReadonlyArray<CauseFoldRule> = [
  CauseFoldRule.make({
    code: "TS6305",
    cause: "upstream declarations are not built",
  }),
];

/**
 * The result of folding: fold lines in table order and the items no rule
 * folded, in their original order.
 *
 * **Example** (Build an empty result)
 *
 * ```ts
 * import { FoldResult } from "@beep/gate-report/CauseFold";
 *
 * console.log(FoldResult.make({ folds: [], rest: [] }).folds.length); // 0
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class FoldResult extends S.Opaque<FoldResult, { readonly brand: unique symbol }>()(
  S.Struct({
    folds: S.Array(FoldLine),
    rest: S.Array(Item),
  }).pipe(
    $I.annoteSchema("FoldResult", {
      description: "Fold lines in table order and the items no rule folded.",
    })
  )
) {}

/**
 * What folding reads: the items, the rules in table order and the fixes.
 *
 * **Example** (Build an input)
 *
 * ```ts
 * import { defaultCauseFolds, FoldInput } from "@beep/gate-report/CauseFold";
 *
 * console.log(FoldInput.make({ items: [], rules: defaultCauseFolds, fixes: {} }).rules.length); // 1
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class FoldInput extends S.Opaque<FoldInput, { readonly brand: unique symbol }>()(
  S.Struct({
    items: S.Array(Item),
    rules: S.Array(CauseFoldRule),
    fixes: FoldFixes,
  }).pipe(
    $I.annoteSchema("FoldInput", {
      description: "The items, folding rules and fix commands cause folding reads.",
    })
  )
) {}

/**
 * Fold the items whose code a rule names into one line per rule.
 *
 * **Details**
 *
 * A rule with no matching item produces no line. An item matches the first
 * rule naming its code; a repeated code keeps its first rule.
 *
 * **Example** (Fold nothing)
 *
 * ```ts
 * import { defaultCauseFolds, FoldInput, foldCauses } from "@beep/gate-report/CauseFold";
 *
 * const result = foldCauses(FoldInput.make({ items: [], rules: defaultCauseFolds, fixes: {} }));
 * console.log(result.rest.length); // 0
 * ```
 *
 * @category folding
 * @since 0.0.0
 */
export const foldCauses = (input: FoldInput): FoldResult => {
  const ruled = (item: Item) => O.exists(item.code, (code) => A.some(input.rules, (rule) => rule.code === code));
  const folds = pipe(
    A.dedupeWith(input.rules, (left, right) => left.code === right.code),
    A.map((rule) => ({
      rule,
      count: A.filter(input.items, (item) => O.exists(item.code, (code) => code === rule.code)).length,
    })),
    A.filter((entry) => entry.count > 0),
    A.map(({ rule, count }) =>
      FoldLine.make({ code: rule.code, count, cause: rule.cause, fix: R.get(input.fixes, rule.code) })
    )
  );
  return FoldResult.make({ folds, rest: A.filter(input.items, (item) => !ruled(item)) });
};
