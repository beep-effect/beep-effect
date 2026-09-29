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
import * as S from "effect/Schema";
import { LiteralKit, matchLiteral } from "../LiteralKit/index.ts";
import { isNonNegative } from "../Number.ts";
import type { SchemaAST } from "effect";
import type { LiteralKit as LiteralKitSchema, LiteralToKey } from "../LiteralKit/index.ts";

const $I = $SchemaId.create("MappedLiteralKit");
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
  readonly is: LiteralKitSchema<From>["is"];
  readonly Enum: Enum;
  readonly $match: LiteralKitSchema<From>["$match"];
};

type TransformedLiteralsSchema<
  From extends Literals,
  To extends { readonly [I in keyof From]: LiteralValue },
> = S.Union<{ readonly [I in keyof From]: S.decodeTo<S.Literal<To[I]>, S.Literal<From[I]>> }>;

/**
 * One direction of a {@link MappedLiteralKit}: the transformed literal union
 * plus keyed helpers (`is`, `Enum`, `$match`) over its encoded literals.
 *
 * **Details**
 *
 * `Rebuild` is the direction itself, so `annotate`, `annotateKey`, and
 * `check` keep the helpers. The literal tuple of a direction is derived from
 * the owning kit's `Pairs`.
 *
 * **Example** (Read the reverse direction)
 *
 * ```ts
 * import { MappedLiteralKit } from "@beep/schema/MappedLiteralKit"
 *
 * const Status = MappedLiteralKit([["OK", 200], ["NOT_FOUND", 404]])
 * console.log(Status.To.Enum.number404) // "NOT_FOUND"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface DirectionalKit<
  From extends Literals,
  To extends { readonly [I in keyof From]: LiteralValue },
  Enum extends Record<string, LiteralValue>,
> extends TransformedLiteralsSchema<From, To>,
    DirectionalHelpers<From, Enum> {
  readonly Rebuild: DirectionalKit<From, To, Enum>;
}

/**
 * Error thrown when `MappedLiteralKit` receives duplicate literals on the
 * `from` or `to` side of the mapping.
 *
 * **Example** (Construct duplicate mapping error)
 *
 * ```ts import.meta.vitest name="Construct duplicate mapping error"
 * import { MappedLiteralDuplicateError } from "@beep/schema/MappedLiteralKit"
 *
 * const error = MappedLiteralDuplicateError.make({
 *   side: "to",
 *   literal: "200",
 *   firstIndex: 0,
 *   secondIndex: 1
 * })
 * error.side // => "to"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class MappedLiteralDuplicateError extends S.TaggedError<MappedLiteralDuplicateError>(
  $I.make("MappedLiteralDuplicateError")
)(
  "MappedLiteralDuplicateError",
  {
    side: S.Literals(["from", "to"]),
    literal: S.Union([S.String, S.BigInt, S.Boolean, S.Finite]),
    firstIndex: S.Int.check(isNonNegative),
    secondIndex: S.Int.check(isNonNegative),
  },
  $I.annoteError<MappedLiteralDuplicateError>("MappedLiteralDuplicateError", {
    title: "Mapped Literal Duplicate Error",
    description: "Thrown when mapped literal entries are not one-to-one.",
  })
) {}

type SeenState = {
  readonly from: HashMap.HashMap<LiteralValue, number>;
  readonly to: HashMap.HashMap<LiteralValue, number>;
};

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

/**
 * Attach the directional statics and keep them attached across every
 * derivation: upstream's `annotate`, `annotateKey` and `check` all return
 * `this.rebuild(ast)`, so the instance-level `rebuild` re-attaches them.
 */
const attachHelperDescriptors = <T extends S.Top>(
  schema: T,
  makeDescriptors: (schema: T) => PropertyDescriptorMap
): T => {
  const upstreamRebuild: (ast: SchemaAST.AST) => S.Top = schema.rebuild;

  return Object.defineProperties(schema, {
    ...makeDescriptors(schema),
    rebuild: {
      value(this: S.Top, ast: SchemaAST.AST): S.Top {
        return attachHelperDescriptors(upstreamRebuild.call(this, ast) as T, makeDescriptors);
      },
      enumerable: false,
      writable: false,
      configurable: true,
    },
  });
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
    is: readonlyProperty(literalKit.is),
    Enum: readonlyProperty(Enum),
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
 * - Top-level helpers (`Enum`, `is`, `$match`) are aliases of `From`.
 * - Both sides must be unique by literal value.
 * - The helpers survive `annotate`, `annotateKey`, and `check` on the kit and
 *   on its `From` / `To` directions.
 *
 * **Example** (Map SQL state literals)
 *
 * ```ts import.meta.vitest name="Map SQL state literals"
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
 * {@link MappedLiteralDuplicateError}. The literal tuple of either side is
 * derived from `Pairs`, for example `A.map(Kit.Pairs, ([from]) => from)`.
 *
 * **Example** (Build HTTP status mapping)
 *
 * ```ts import.meta.vitest name="Build HTTP status mapping"
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
    is: readonlyProperty(From.is),
    Enum: readonlyProperty(From.Enum),
    $match: readonlyProperty(From.$match),
    From: readonlyProperty(schema),
    To: readonlyProperty(To),
    Pairs: readonlyProperty(mappings),
  })) as MappedLiteralKit<M>;
}
