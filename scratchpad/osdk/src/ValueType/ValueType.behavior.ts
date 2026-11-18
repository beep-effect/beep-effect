/**
 * Projection from a value type's constraints to schema checks.
 *
 * **Details**
 *
 * A {@link ValueTypeConstraint} is data that describes a rule. The function
 * here turns that data into the check a schema runs, for exactly the rules a
 * check can state without guessing. Because the result is a check over
 * `unknown` that first confirms the value belongs to the base type's domain,
 * it attaches to any codec, including one whose static type was erased by a
 * runtime projection.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Equal from "effect/Equal";
import { dual, flow, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { ValueTypeKind } from "../DataType/DataType.values.ts";
import { ValueTypeConstraint } from "./ValueType.model.ts";
import type * as SchemaAST from "effect/SchemaAST";
import type { ScalarValue } from "../Value/Value.model.ts";
import type { EnumConstraint, LengthConstraint, RegexConstraint, ValueRangeConstraint } from "./ValueType.model.ts";

const $I = $ScratchpadId.create("osdk/ValueType/ValueType.behavior");

// Base kinds whose domain value is a JSON number, so a numeric bound compares with it directly.
const isNumberKind = S.is(ValueTypeKind.pick(["byte", "short", "integer", "float", "double"]));

// Base kinds whose domain value is the JSON value itself, so an option equals a value without decoding either.
const isJsonNativeKind = S.is(
  ValueTypeKind.pick(["boolean", "byte", "short", "integer", "float", "double", "string"])
);

// Widens a typed built-in check to `unknown` by confirming the value's runtime type first. The built-in's own
// annotations travel with it, so derived arbitraries and JSON Schema still see the pattern or the bounds.
const lift =
  <T>(belongs: P.Refinement<unknown, T>) =>
  (filter: SchemaAST.Filter<T>): SchemaAST.Filter<unknown> =>
    S.makeFilter<unknown>(
      (input, ast, options) => (belongs(input) ? filter.run(input, ast, options) : false),
      filter.annotations
    );

// One or two inclusive bounds select one of three built-in checks; no bound selects none.
const bounded = <Check>(
  minimum: O.Option<number>,
  maximum: O.Option<number>,
  build: {
    readonly atLeast: (minimum: number) => Check;
    readonly atMost: (maximum: number) => Check;
    readonly between: (minimum: number, maximum: number) => Check;
  }
): O.Option<Check> =>
  pipe(
    O.zipWith(minimum, maximum, build.between),
    O.orElse(() => O.map(minimum, build.atLeast)),
    O.orElse(() => O.map(maximum, build.atMost))
  );

const compilePattern = O.liftThrowable((source: string) => new RegExp(source));

const regexFilter = ({ pattern, partialMatch }: RegexConstraint): O.Option<SchemaAST.Filter<string>> =>
  O.map(compilePattern(partialMatch ? pattern : `^(?:${pattern})$`), (regExp) =>
    S.isPattern(
      regExp,
      $I.annote("RegexConstraintCheck", {
        title: "Regex Constraint",
        description: partialMatch
          ? `Text that contains a match for the pattern ${pattern}.`
          : `Text that matches the pattern ${pattern} from start to end.`,
        message: `Expected text matching the pattern ${pattern}`,
      })
    )
  );

const lengthFilter = ({ minimumLength, maximumLength }: LengthConstraint): O.Option<SchemaAST.Filter<string>> =>
  bounded(minimumLength, maximumLength, {
    atLeast: (shortest) =>
      S.isMinLength(
        shortest,
        $I.annote("LengthConstraintCheck", {
          title: "Length Constraint",
          description: `Text at least ${shortest} long.`,
          message: `Expected text with a length of at least ${shortest}`,
        })
      ),
    atMost: (longest) =>
      S.isMaxLength(
        longest,
        $I.annote("LengthConstraintCheck", {
          title: "Length Constraint",
          description: `Text at most ${longest} long.`,
          message: `Expected text with a length of at most ${longest}`,
        })
      ),
    between: (shortest, longest) =>
      S.isBetweenLength(
        shortest,
        longest,
        $I.annote("LengthConstraintCheck", {
          title: "Length Constraint",
          description: `Text between ${shortest} and ${longest} long, both inclusive.`,
          message: `Expected text with a length between ${shortest} and ${longest}`,
        })
      ),
  });

// An absent bound stays absent; a stated bound that is not a JSON number cannot be compared exactly.
const numberBound: (bound: O.Option<ScalarValue>) => O.Option<O.Option<number>> = O.match({
  onNone: () => O.some(O.none()),
  onSome: flow(O.liftPredicate(P.isNumber), O.map(O.some)),
});

const rangeFilter = ({ minimumValue, maximumValue }: ValueRangeConstraint): O.Option<SchemaAST.Filter<number>> =>
  O.flatMap(O.all([numberBound(minimumValue), numberBound(maximumValue)]), ([minimum, maximum]) =>
    bounded(minimum, maximum, {
      atLeast: (least) =>
        S.isGreaterThanOrEqualTo(
          least,
          $I.annote("ValueRangeConstraintCheck", {
            title: "Value Range Constraint",
            description: `A number of ${least} or more.`,
            message: `Expected a number of ${least} or more`,
          })
        ),
      atMost: (most) =>
        S.isLessThanOrEqualTo(
          most,
          $I.annote("ValueRangeConstraintCheck", {
            title: "Value Range Constraint",
            description: `A number of ${most} or less.`,
            message: `Expected a number of ${most} or less`,
          })
        ),
      between: (least, most) =>
        S.isBetween(
          { minimum: least, maximum: most },
          $I.annote("ValueRangeConstraintCheck", {
            title: "Value Range Constraint",
            description: `A number from ${least} to ${most}, both inclusive.`,
            message: `Expected a number from ${least} to ${most}`,
          })
        ),
    })
  );

const enumFilter = ({ options }: EnumConstraint): SchemaAST.Filter<unknown> => {
  const allowed = A.getSomes(options);
  return S.makeFilter<unknown>(
    (input) => A.some(allowed, Equal.equals(input)),
    $I.annote("EnumConstraintCheck", {
      title: "Enum Constraint",
      description: `One of ${A.length(allowed)} allowed values.`,
      message: `Expected one of the ${A.length(allowed)} allowed values`,
    })
  );
};

/**
 * The schema check a constraint amounts to on values of a base type, when a check can state it exactly.
 *
 * **Details**
 *
 * The check runs on the domain value of the base type, after decoding. A
 * mapping is offered only where the domain value and the constraint's operands
 * are the same kind of thing, so nothing is parsed or coerced on the way:
 *
 * | Constraint | Base type | Check |
 * | --- | --- | --- |
 * | `regex` | `string` | the pattern, anchored at both ends unless `partialMatch` |
 * | `length` | `string` | minimum, maximum or both, inclusive |
 * | `range` | `byte`, `short`, `integer`, `float`, `double` with number bounds | minimum, maximum or both, inclusive |
 * | `enum` | the five number kinds, `string` and `boolean` | equality with one of the options |
 *
 * Everything else is `None`: `struct` and `array` need the projection of their
 * parts, `rid` and `uuid` name formats whose exact grammar the wire does not
 * state, `unsupported` is unknown by definition, and a 64-bit integer, decimal,
 * date or instant has a rich domain value that a JSON operand does not equal
 * without decoding it against the base type.
 *
 * **Gotchas**
 *
 * `None` means "not enforced here", never "always satisfied": report it, do not
 * drop it. A `length` constraint with no bound also yields `None`, because it
 * constrains nothing. A pattern is compiled as an ECMAScript regular
 * expression; one the engine rejects yields `None`. An `enum` check ignores the
 * `null` option, which speaks about absent values and not about present ones.
 *
 * **Example** (Refine a text codec with a length constraint)
 *
 * ```ts import.meta.vitest name="Refine a text codec with a length constraint"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { LengthConstraint, UuidConstraint, constraintCheck } from "@beep/scratchpad/osdk/src/ValueType/index"
 *
 * const Code = O.match(constraintCheck(LengthConstraint.between(2, 3), "string"), {
 *   onNone: () => S.String,
 *   onSome: (rule) => S.String.check(rule),
 * })
 * const isCode = S.is(Code)
 * const verdicts = [isCode("ab"), isCode("abcd"), O.isNone(constraintCheck(UuidConstraint.make({}), "string"))]
 * verdicts // => [true, false, true]
 * ```
 *
 * @category projections
 * @since 0.0.0
 */
export const constraintCheck: {
  (baseKind: ValueTypeKind): (constraint: ValueTypeConstraint) => O.Option<SchemaAST.Filter<unknown>>;
  (constraint: ValueTypeConstraint, baseKind: ValueTypeKind): O.Option<SchemaAST.Filter<unknown>>;
} = dual(
  2,
  (constraint: ValueTypeConstraint, baseKind: ValueTypeKind): O.Option<SchemaAST.Filter<unknown>> =>
    ValueTypeConstraint.match(constraint, {
      struct: () => O.none(),
      regex: (rule) => (baseKind === "string" ? O.map(regexFilter(rule), lift(P.isString)) : O.none()),
      unsupported: () => O.none(),
      array: () => O.none(),
      length: (rule) => (baseKind === "string" ? O.map(lengthFilter(rule), lift(P.isString)) : O.none()),
      range: (rule) => (isNumberKind(baseKind) ? O.map(rangeFilter(rule), lift(P.isNumber)) : O.none()),
      rid: () => O.none(),
      uuid: () => O.none(),
      enum: (rule) => (isJsonNativeKind(baseKind) ? O.some(enumFilter(rule)) : O.none()),
    })
);
