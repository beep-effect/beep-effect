/**
 * Schema-backed mapped literal toolkit helpers for reversible literal pairs.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { $SchemaId } from "@beep/identity/packages";
import { A } from "@beep/utils";
import { HashMap, pipe } from "effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { LiteralKit, LiteralKitKeyCollisionError, matchLiteral } from "../LiteralKit/index.ts";
import { isNonNegative } from "../Number.ts";
import type { SchemaAST } from "effect";
import type { LiteralKit as LiteralKitSchema, LiteralToKey } from "../LiteralKit/index.ts";

const $I = $SchemaId.create("MappedLiteralKit");
const MappedLiteralDuplicateErrorFields = {
  side: S.Literals(["from", "to"]),
  literal: S.Union([S.String, S.BigInt, S.Boolean, S.Finite]),
  firstIndex: S.Int.check(isNonNegative),
  secondIndex: S.Int.check(isNonNegative),
} satisfies S.Struct.Fields;

type LiteralValue = SchemaAST.LiteralValue;
type Literals = A.NonEmptyReadonlyArray<LiteralValue>;
type MappedPair = readonly [LiteralValue, LiteralValue];
type MappedPairs = A.NonEmptyReadonlyArray<MappedPair>;

type FromLiterals<M extends MappedPairs> = {
  readonly [I in keyof M]: M[I] extends readonly [infer From extends LiteralValue, LiteralValue] ? From : never;
};

type ToLiterals<M extends MappedPairs> = {
  readonly [I in keyof M]: M[I] extends readonly [LiteralValue, infer To extends LiteralValue] ? To : never;
};

type PairUnion<M extends MappedPairs> = M[number];

type ForwardEnumMap<M extends MappedPairs> = {
  readonly [Pair in PairUnion<M> as LiteralToKey<Pair[0]>]: Pair[1];
};

type ReverseEnumMap<M extends MappedPairs> = {
  readonly [Pair in PairUnion<M> as LiteralToKey<Pair[1]>]: Pair[0];
};

type DirectionalHelpers<From extends Literals, Enum extends Record<string, LiteralValue>> = {
  readonly Options: LiteralKitSchema<From>["Options"];
  readonly is: LiteralKitSchema<From>["is"];
  readonly Enum: Enum;
  readonly pickOptions: LiteralKitSchema<From>["pickOptions"];
  readonly omitOptions: LiteralKitSchema<From>["omitOptions"];
  readonly $match: LiteralKitSchema<From>["$match"];
};

type TransformedLiteralsSchema<
  From extends Literals,
  To extends { readonly [I in keyof From]: LiteralValue },
> = S.Union<{ readonly [I in keyof From]: S.decodeTo<S.Literal<To[I]>, S.Literal<From[I]>> }>;

type DirectionalKit<
  From extends Literals,
  To extends { readonly [I in keyof From]: LiteralValue },
  Enum extends Record<string, LiteralValue>,
> = TransformedLiteralsSchema<From, To> & DirectionalHelpers<From, Enum>;

/**
 * Error thrown when `MappedLiteralKit` receives duplicate literals on the
 * `from` or `to` side of the mapping.
 *
 * **Example** (Construct duplicate mapping error)
 *
 * ```ts
 * import { MappedLiteralDuplicateError } from "@beep/schema/MappedLiteralKit"
 *
 * const error = MappedLiteralDuplicateError.make({
 *   side: "to",
 *   literal: "200",
 *   firstIndex: 0,
 *   secondIndex: 1
 * })
 * console.log(error.side) // "to"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class MappedLiteralDuplicateError extends S.TaggedError<MappedLiteralDuplicateError>(
  $I.make("MappedLiteralDuplicateError")
)(
  "MappedLiteralDuplicateError",
  MappedLiteralDuplicateErrorFields,
  $I.annote("MappedLiteralDuplicateError", {
    title: "Mapped Literal Duplicate Error",
    description: "Thrown when mapped literal entries are not one-to-one.",
  })
) {}

type SeenState = {
  readonly from: HashMap.HashMap<LiteralValue, number>;
  readonly to: HashMap.HashMap<LiteralValue, number>;
};

type SeenLiteralKeys = HashMap.HashMap<string, LiteralValue>;

const makeForwardEnum = <M extends MappedPairs>(mappings: M): ForwardEnumMap<M> =>
  A.reduce({} as ForwardEnumMap<M>, (acc, entry: M[number]) => {
    const [fromLiteral, toLiteral] = entry;
    return {
      ...acc,
      [matchLiteral(fromLiteral)]: toLiteral,
    };
  })(mappings);

const makeReverseEnum = <M extends MappedPairs>(mappings: M): ReverseEnumMap<M> =>
  A.reduce({} as ReverseEnumMap<M>, (acc, entry: M[number]) => {
    const [fromLiteral, toLiteral] = entry;
    return {
      ...acc,
      [matchLiteral(toLiteral)]: fromLiteral,
    };
  })(mappings);

const validateMappings = <M extends MappedPairs>(mappings: M): void =>
  void pipe(
    mappings,
    A.reduce(
      {
        from: HashMap.empty<LiteralValue, number>(),
        to: HashMap.empty<LiteralValue, number>(),
      } satisfies SeenState,
      (state, [fromLiteral, toLiteral], index): SeenState => {
        const seenFrom = HashMap.get(state.from, fromLiteral);
        if (O.isSome(seenFrom)) {
          throw MappedLiteralDuplicateError.make({
            side: "from",
            literal: fromLiteral,
            firstIndex: seenFrom.value,
            secondIndex: index,
          });
        }

        const seenTo = HashMap.get(state.to, toLiteral);
        if (O.isSome(seenTo)) {
          throw MappedLiteralDuplicateError.make({
            side: "to",
            literal: toLiteral,
            firstIndex: seenTo.value,
            secondIndex: index,
          });
        }

        return {
          from: HashMap.set(state.from, fromLiteral, index),
          to: HashMap.set(state.to, toLiteral, index),
        };
      }
    )
  );

const validateHelperKeys = <L extends Literals>(literals: L): void =>
  void pipe(
    literals,
    A.reduce(HashMap.empty<string, LiteralValue>(), (seen, literal): SeenLiteralKeys => {
      const key = matchLiteral(literal);
      const existing = HashMap.get(seen, key);

      if (O.isSome(existing) && !Object.is(existing.value, literal)) {
        throw LiteralKitKeyCollisionError.make({
          key,
          existing: existing.value,
          incoming: literal,
        });
      }

      return HashMap.set(seen, key, literal);
    })
  );

const splitMappings = <M extends MappedPairs>(
  mappings: M
): {
  readonly from: FromLiterals<M>;
  readonly to: ToLiterals<M>;
} => ({
  from: pipe(
    mappings,
    A.map(([from]) => from)
  ) as FromLiterals<M>,
  to: pipe(
    mappings,
    A.map(([_, to]) => to)
  ) as ToLiterals<M>,
});

const attachHelperDescriptors = <T extends object>(
  schema: T,
  makeDescriptors: (schema: T) => PropertyDescriptorMap
): T => {
  const originalAnnotate = Reflect.get(schema, "annotate");
  const descriptors = makeDescriptors(schema);

  return Object.defineProperties(schema, {
    ...descriptors,
    ...(P.isFunction(originalAnnotate)
      ? {
          annotate: {
            value(annotation: unknown) {
              return attachHelperDescriptors(originalAnnotate.call(schema, annotation) as T, makeDescriptors);
            },
            enumerable: false,
            writable: false,
            configurable: true,
          },
        }
      : {}),
  }) as T;
};

const makeDirectionalKit = <
  From extends Literals,
  To extends { readonly [I in keyof From]: LiteralValue },
  Enum extends Record<string, LiteralValue>,
>(
  from: From,
  to: To,
  Enum: Enum
): DirectionalKit<From, To, Enum> => {
  const base = S.Literals(from).transform(to);
  const literalKit = LiteralKit(from);
  const readonlyProperty = <T>(value: T): PropertyDescriptor => ({
    value,
    enumerable: true,
    writable: false,
    configurable: false,
  });

  return attachHelperDescriptors(base, () => ({
    Options: readonlyProperty(literalKit.Options),
    is: readonlyProperty(literalKit.is),
    Enum: readonlyProperty(Enum),
    pickOptions: readonlyProperty(literalKit.pickOptions),
    omitOptions: readonlyProperty(literalKit.omitOptions),
    $match: readonlyProperty(literalKit.$match),
  })) as DirectionalKit<From, To, Enum>;
};

/**
 * Runtime mapped literal kit that augments transformed literal schemas with directional helpers.
 *
 * **Details**
 *
 * - `decode` maps `From` literals to `To` literals.
 * - `encode` maps `To` literals back to `From` literals.
 * - Top-level helpers (`Enum`, `is`, `$match`, etc.) are aliases of `From`.
 * - Both sides must be unique by literal value and by `LiteralToKey` helper key encoding.
 *
 * **Example** (Map SQL state literals)
 *
 * ```typescript
 * import { MappedLiteralKit } from "@beep/schema";
 * import * as S from "effect/Schema";
 *
 * const SqlState = MappedLiteralKit([
 *   ["SUCCESSFUL_COMPLETION", "00000"],
 *   ["WARNING", "01000"]
 * ] as const);
 *
 * S.decodeSync(SqlState)("SUCCESSFUL_COMPLETION"); // "00000"
 * S.encodeSync(SqlState)("00000"); // "SUCCESSFUL_COMPLETION"
 *
 * SqlState.From.Enum.SUCCESSFUL_COMPLETION; // "00000"
 * SqlState.To.Enum["00000"]; // "SUCCESSFUL_COMPLETION"
 * SqlState.Enum.WARNING; // "01000"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
type ForwardDirectionalKit<M extends MappedPairs> = DirectionalKit<FromLiterals<M>, ToLiterals<M>, ForwardEnumMap<M>>;
type ReverseDirectionalKit<M extends MappedPairs> = DirectionalKit<ToLiterals<M>, FromLiterals<M>, ReverseEnumMap<M>>;

/**
 * Runtime type for the value returned by the {@link MappedLiteralKit}
 * constructor. Contains `From` and `To` directional helpers and the original
 * `Pairs`.
 *
 * @category models
 * @since 0.0.0
 */
type MappedLiteralKitBase<M extends MappedPairs> = ForwardDirectionalKit<M> & {
  readonly From: ForwardDirectionalKit<M>;
  readonly To: ReverseDirectionalKit<M>;
  readonly Pairs: M;
};

/**
 * @since 0.0.0
 */
/**
 * Runtime mapped literal kit returned by {@link MappedLiteralKit}.
 *
 * **Example** (Type mapped kit pairs)
 *
 * ```ts
 * import { MappedLiteralKit } from "@beep/schema/MappedLiteralKit"
 *
 * const Status = MappedLiteralKit([["OK", 200], ["NOT_FOUND", 404]])
 * const pairsLength: MappedLiteralKit<typeof Status.Pairs>["Pairs"]["length"] = Status.Pairs.length
 * console.log(pairsLength)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export interface MappedLiteralKit<M extends MappedPairs> extends MappedLiteralKitBase<M> {
  annotate(annotations: S.Annotations.Bottom<this["Type"], this["~type.parameters"]>): MappedLiteralKit<M>;
  readonly Rebuild: MappedLiteralKit<M>;
}

/**
 * Builds a mapped literal schema kit from a non-empty tuple of literal pairs.
 *
 * **Details**
 *
 * Requires one-to-one mappings. Exact duplicate literals on either side throw
 * {@link MappedLiteralDuplicateError}. Helper-key collisions on either side
 * throw {@link LiteralKitKeyCollisionError}.
 *
 * **Example** (Build HTTP status mapping)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { MappedLiteralKit } from "@beep/schema/MappedLiteralKit"
 *
 * const HttpStatus = MappedLiteralKit([
 *   ["OK", "200"],
 *   ["NOT_FOUND", "404"]
 * ])
 *
 * S.decodeSync(HttpStatus)("OK")       // "200"
 * S.encodeSync(HttpStatus)("200")      // "OK"
 * HttpStatus.From.Enum.OK              // "200"
 * HttpStatus.To.Enum["200"]            // "OK"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export function MappedLiteralKit<const M extends MappedPairs>(mappings: M): MappedLiteralKit<M> {
  validateMappings(mappings);
  const { from, to } = splitMappings(mappings);
  validateHelperKeys(from);
  validateHelperKeys(to);
  const forwardEnum = makeForwardEnum(mappings);
  const reverseEnum = makeReverseEnum(mappings);

  const From = makeDirectionalKit(from, to, forwardEnum);
  const To = makeDirectionalKit(to, from, reverseEnum);

  const readonlyProperty = <T>(value: T): PropertyDescriptor => ({
    value,
    enumerable: true,
    writable: false,
    configurable: false,
  });

  return attachHelperDescriptors(From, (schema) => ({
    Options: readonlyProperty(From.Options),
    is: readonlyProperty(From.is),
    Enum: readonlyProperty(From.Enum),
    pickOptions: readonlyProperty(From.pickOptions),
    omitOptions: readonlyProperty(From.omitOptions),
    $match: readonlyProperty(From.$match),
    From: readonlyProperty(schema),
    To: readonlyProperty(To),
    Pairs: readonlyProperty(mappings),
  })) as MappedLiteralKit<M>;
}
