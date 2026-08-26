/**
 * Schemas for Effect `MutableHashSet` values.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { $SchemaId } from "@beep/identity/packages";
import { A, Str } from "@beep/utils";
import * as O from "@beep/utils/Option";
import {
  Effect,
  MutableHashSet as MutableHashSet_,
  pipe,
  SchemaIssue,
  SchemaParser,
  SchemaTransformation,
} from "effect";
import * as S from "effect/Schema";

const $I = $SchemaId.create("MutableHashSet");

const formatValues = <A>(values: ReadonlyArray<A>, formatValue: (value: A) => string): string =>
  pipe(values, A.map(formatValue), A.sort(Str.Order), A.join(", "));

const makeMutableHashSetEquivalence =
  <A>(equivalence: (self: A, that: A) => boolean) =>
  (self: Iterable<A>, that: Iterable<A>): boolean => {
    const selfValues = A.fromIterable(self);
    const thatValues = A.fromIterable(that);

    return (
      selfValues.length === thatValues.length &&
      pipe(
        selfValues,
        A.every((selfValue) =>
          pipe(
            thatValues,
            A.some((thatValue) => equivalence(selfValue, thatValue))
          )
        )
      )
    );
  };

/**
 * Iso representation (serializable value array) used by
 * {@link MutableHashSetFromSelf} for round-tripping.
 *
 * **Example** (Satisfies value-array iso type)
 *
 * ```ts
 * import type { MutableHashSetIso } from "@beep/schema/MutableHashSet"
 * import * as S from "effect/Schema"
 *
 * const values = ["a", "b"] satisfies MutableHashSetIso<typeof S.String>
 * console.log(values.length)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type MutableHashSetIso<Value extends S.Top> = ReadonlyArray<Value["Iso"]>;

/**
 * Schema for validating an existing `MutableHashSet` instance.
 *
 * **Example** (Validates existing MutableHashSet)
 *
 * ```ts
 * import { MutableHashSet } from "effect"
 * import * as S from "effect/Schema"
 * import { MutableHashSetFromSelf } from "@beep/schema/MutableHashSet"
 *
 * const SetSchema = MutableHashSetFromSelf(S.String)
 * const set = MutableHashSet.fromIterable(["a", "b"])
 * console.log(S.is(SetSchema)(set))
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export interface MutableHashSetFromSelf<Value extends S.Top>
  extends S.declareConstructor<
    MutableHashSet_.MutableHashSet<Value["Type"]>,
    MutableHashSet_.MutableHashSet<Value["Encoded"]>,
    readonly [Value],
    MutableHashSetIso<Value>
  > {
  readonly Rebuild: this;
  readonly value: Value;
}

/**
 * Schema for transforming arrays into `MutableHashSet` instances.
 *
 * **Example** (Decodes array to MutableHashSet)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { MutableHashSet } from "@beep/schema/MutableHashSet"
 *
 * const StringSet = MutableHashSet(S.String)
 * const decoded = S.decodeUnknownSync(StringSet)(["a", "b", "a"])
 * console.log(decoded)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export interface MutableHashSet<Value extends S.Top>
  extends S.decodeTo<MutableHashSetFromSelf<S.toType<Value>>, S.$Array<Value>> {
  readonly Rebuild: this;
  readonly value: Value;
}

/**
 * Type guard for Effect `MutableHashSet` values.
 *
 * **Example** (Guards MutableHashSet values)
 *
 * ```ts import.meta.vitest name="Guards MutableHashSet values"
 * import { MutableHashSet } from "effect"
 * import { isMutableHashSet } from "@beep/schema/MutableHashSet"
 *
 * isMutableHashSet(MutableHashSet.empty()) // => true
 * isMutableHashSet(new Set()) // => false
 * ```
 *
 * @param value - Unknown input to test.
 * @returns `true` when `value` is a `MutableHashSet`.
 * @category guards
 * @since 0.0.0
 */
export const isMutableHashSet = <Value>(value: unknown): value is MutableHashSet_.MutableHashSet<Value> =>
  MutableHashSet_.isMutableHashSet(value);

/**
 * Schema for validating existing `MutableHashSet` instances while applying the
 * provided member schema to each element.
 *
 * **Example** (Decodes existing set members)
 *
 * ```ts
 * import { MutableHashSet } from "effect"
 * import * as S from "effect/Schema"
 * import { MutableHashSetFromSelf } from "@beep/schema/MutableHashSet"
 *
 * const SetSchema = MutableHashSetFromSelf(S.String)
 * const set = MutableHashSet.fromIterable(["a", "b"])
 * const decoded = S.decodeUnknownSync(SetSchema)(set)
 * console.log(MutableHashSet.has(decoded, "a"))
 * ```
 *
 * @param value - Element schema for set members.
 * @returns Schema whose encoded side is another `MutableHashSet` carrying the
 * encoded member type.
 * @category validation
 * @since 0.0.0
 */
export const MutableHashSetFromSelf = <Value extends S.Top>(value: Value): MutableHashSetFromSelf<Value> => {
  const schema = S.declareConstructor<
    MutableHashSet_.MutableHashSet<Value["Type"]>,
    MutableHashSet_.MutableHashSet<Value["Encoded"]>,
    MutableHashSetIso<Value>
  >()(
    [value],
    ([value]) => {
      const values = S.Array(value);

      return (input, ast, options) => {
        if (!MutableHashSet_.isMutableHashSet(input)) {
          return Effect.fail(new SchemaIssue.InvalidType(ast));
        }

        return Effect.mapBothEager(SchemaParser.decodeEffect(values)(A.fromIterable(input), options), {
          onSuccess: MutableHashSet_.fromIterable,
          onFailure: (issue) => new SchemaIssue.Composite(ast, [new SchemaIssue.Pointer(["values"], issue)]),
        });
      };
    },
    {
      typeConstructor: {
        _tag: "effect/MutableHashSet",
      },
      generation: {
        runtime: "MutableHashSetFromSelf(?)",
        Type: "MutableHashSet.MutableHashSet<?>",
        importDeclaration: 'import * as MutableHashSet from "effect/MutableHashSet"',
      },
      expected: "MutableHashSet",
      description: "Schema for existing MutableHashSet instances.",
      toCodec: ([value]) =>
        S.link<MutableHashSet_.MutableHashSet<Value["Encoded"]>>()(
          S.Array(value),
          SchemaTransformation.transform({
            decode: MutableHashSet_.fromIterable,
            encode: A.fromIterable,
          })
        ),
      toArbitrary:
        ([value]) =>
        (fc, ctx) => {
          const constraint = ctx.constraint ?? {};
          const constraints = O.getSomesStruct({
            minLength: O.fromUndefinedOr(constraint.minLength),
            maxLength: O.fromUndefinedOr(constraint.maxLength),
          });
          const minLength = constraints.minLength ?? 0;
          const terminalValues =
            minLength === 0
              ? fc.constant<Array<Value["Type"]>>([])
              : value.terminal === undefined
                ? undefined
                : fc.array(value.terminal, { ...constraints, maxLength: minLength });
          const values = fc.array(value.arbitrary, constraints);
          const arbitraryValues =
            terminalValues === undefined || ctx.recursion === undefined
              ? values
              : fc.oneof(ctx.recursion, terminalValues, values);
          return {
            arbitrary: arbitraryValues.map(MutableHashSet_.fromIterable),
            terminal: terminalValues?.map(MutableHashSet_.fromIterable),
          };
        },
      toEquivalence: ([value]) => makeMutableHashSetEquivalence(value),
      toFormatter:
        ([value]) =>
        (set) => {
          const size = MutableHashSet_.size(set);
          if (size === 0) {
            return "MutableHashSet(0) {}";
          }

          return `MutableHashSet(${size}) { ${formatValues(A.fromIterable(set), value)} }`;
        },
    }
  );

  return S.make<MutableHashSetFromSelf<Value>>(schema.ast, { value }).pipe(
    $I.annoteSchema("MutableHashSetFromSelf", {
      description: "Schema for validating existing MutableHashSet runtime values.",
    })
  );
};

/**
 * Schema for decoding arrays into `MutableHashSet` instances and encoding sets
 * back to arrays.
 *
 * **Example** (Round-trips set via arrays)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { MutableHashSet } from "@beep/schema/MutableHashSet"
 *
 * const StringSet = MutableHashSet(S.String)
 *
 * const decoded = S.decodeUnknownSync(StringSet)(["a", "b", "a"])
 * const encoded = S.encodeSync(StringSet)(decoded)
 * console.log(encoded)
 * ```
 *
 * @param value - Element schema for set members.
 * @returns Array-backed schema for mutable hash sets.
 * @category validation
 * @since 0.0.0
 */
export const MutableHashSet = <Value extends S.Top>(value: Value): MutableHashSet<Value> => {
  const schema = S.Array(value).pipe(
    S.decodeTo(
      MutableHashSetFromSelf(S.toType(value)),
      SchemaTransformation.transform({
        decode: MutableHashSet_.fromIterable,
        encode: A.fromIterable,
      })
    )
  );

  return S.make<MutableHashSet<Value>>(schema.ast, {
    from: schema.from,
    to: schema.to,
    value,
  }).pipe(
    $I.annoteSchema("MutableHashSet", {
      description: "Array-backed schema for Effect MutableHashSet values.",
    })
  );
};
