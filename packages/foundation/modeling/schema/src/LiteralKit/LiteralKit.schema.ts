/**
 * Schema-backed literal toolkit helpers for mixed literal types.
 *
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { $SchemaId } from "@beep/identity/packages";
import { TaggedErrorClass } from "@beep/schema/TaggedErrorClass";
import { A } from "@beep/utils";
import { HashMap, HashSet, Match, pipe } from "effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { isNonNegative } from "../Number.ts";
import type { TaggedErrorClassFromFields } from "@beep/schema/TaggedErrorClass";
import type { SchemaAST, Struct, Unify } from "effect";

const $I = $SchemaId.create("LiteralKit");

type Literals = A.NonEmptyReadonlyArray<SchemaAST.LiteralValue>;
type EnumMappingEntry<Literal extends SchemaAST.LiteralValue = SchemaAST.LiteralValue> = readonly [Literal, string];
type EnumMappings<L extends Literals = Literals> = A.NonEmptyReadonlyArray<EnumMappingEntry<L[number]>>;

/**
 * Maps a literal value to its string key representation used in `Enum`, `is`,
 * `$match`, and `thunk` objects.
 *
 * Key format by type:
 * - boolean: `"true"` or `"false"`
 * - bigint: `"bigint${value}n"` (e.g., `1n` becomes `"bigint1n"`)
 * - number: `"number${value}"` (e.g., `200` becomes `"number200"`)
 * - string: as-is (e.g., `"pending"` stays `"pending"`)
 *
 * @example
 * ```ts
 * import type { LiteralToKey } from "@beep/schema/LiteralKit"
 *
 * const key = "number200" satisfies LiteralToKey<200>
 * console.log(key)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type LiteralToKey<L extends SchemaAST.LiteralValue> = L extends boolean
  ? L extends true
    ? "true"
    : "false"
  : L extends bigint
    ? `bigint${L}n`
    : L extends number
      ? `number${L}`
      : L & string;

type DefaultEnumType<L extends Literals> = {
  readonly [K in L[number] as LiteralToKey<K>]: K;
};

type EnumMappingPair<M extends EnumMappings> = M[number];

type MappedEnumType<M extends EnumMappings> = {
  readonly [Pair in EnumMappingPair<M> as Pair[1]]: Pair[0];
};

type EnumType<L extends Literals, M extends EnumMappings<L> | undefined = undefined> =
  M extends EnumMappings<L> ? MappedEnumType<M> : DefaultEnumType<L>;

type HelperKey<
  Literal extends SchemaAST.LiteralValue,
  M extends EnumMappings | undefined = undefined,
> = M extends EnumMappings ? Extract<EnumMappingPair<M>, readonly [Literal, string]>[1] : LiteralToKey<Literal>;

type HelperKeys<L extends Literals, M extends EnumMappings<L> | undefined = undefined> = HelperKey<L[number], M>;

type IsGuards<L extends Literals, M extends EnumMappings<L> | undefined = undefined> = {
  readonly [K in L[number] as HelperKey<K, M>]: (i: unknown) => i is K;
};

type MatchCases<L extends Literals, M extends EnumMappings<L> | undefined = undefined> = {
  readonly [K in L[number] as HelperKey<K, M>]: (value: K) => unknown;
};

type Thunks<L extends Literals, M extends EnumMappings<L> | undefined = undefined> = {
  readonly [K in L[number] as HelperKey<K, M>]: () => K;
};

type HasFixedLength<T extends ReadonlyArray<unknown>> = number extends T["length"] ? false : true;

type HasDuplicateMappedLiterals<M extends ReadonlyArray<EnumMappingEntry>> = M extends readonly [
  infer Head extends EnumMappingEntry,
  ...infer Rest extends ReadonlyArray<EnumMappingEntry>,
]
  ? Head[0] extends Rest[number][0]
    ? true
    : HasDuplicateMappedLiterals<Rest>
  : false;

type HasDuplicateMappedKeys<M extends ReadonlyArray<EnumMappingEntry>> = M extends readonly [
  infer Head extends EnumMappingEntry,
  ...infer Rest extends ReadonlyArray<EnumMappingEntry>,
]
  ? Head[1] extends Rest[number][1]
    ? true
    : HasDuplicateMappedKeys<Rest>
  : false;

type AllLiteralsMapped<L extends Literals, M extends ReadonlyArray<EnumMappingEntry<L[number]>>> =
  Exclude<L[number], M[number][0]> extends never ? true : false;

type ValidEnumMapping<L extends Literals, M extends EnumMappings<L>> =
  HasFixedLength<M> extends true
    ? HasDuplicateMappedLiterals<M> extends true
      ? never
      : HasDuplicateMappedKeys<M> extends true
        ? never
        : AllLiteralsMapped<L, M> extends true
          ? M
          : never
    : AllLiteralsMapped<L, M> extends true
      ? M
      : never;

/**
 * Valid keys for a MatchCases object derived from the literal set.
 */
type MatchKeys<L extends Literals, M extends EnumMappings<L> | undefined = undefined> = HelperKeys<L, M>;

/**
 * Extract the union of return types from a Cases object.
 * Uses conditional inference to avoid TS2536 when indexing Cases
 * with remapped keys that TS can't prove are valid indices.
 */
type MatchReturn<Cases> = {
  [K in keyof Cases]: Cases[K] extends (...args: ReadonlyArray<unknown>) => infer R ? R : never;
}[keyof Cases];

type MatchFn<L extends Literals, M extends EnumMappings<L> | undefined = undefined> = {
  <const Cases extends MatchCases<L, M>>(
    cases: Cases & { readonly [K in Exclude<keyof Cases, MatchKeys<L, M>>]: never }
  ): (value: L[number]) => Unify.Unify<MatchReturn<Cases>>;
  <const Cases extends MatchCases<L, M>>(
    value: L[number],
    cases: Cases & { readonly [K in Exclude<keyof Cases, MatchKeys<L, M>>]: never }
  ): Unify.Unify<MatchReturn<Cases>>;
};

type PropertyKeyLiteral = Extract<SchemaAST.LiteralValue, PropertyKey>;
type PropertyKeyLiteralArray = A.NonEmptyReadonlyArray<PropertyKeyLiteral>;

type PropertyKeyLiterals<L extends Literals> = {
  readonly [I in keyof L]: Extract<L[I], PropertyKeyLiteral>;
};

type StructFields = Readonly<Record<string, S.Top>>;

type TaggedUnionCases<L extends PropertyKeyLiteralArray, M extends EnumMappings<L> | undefined = undefined> = {
  readonly [K in L[number] as HelperKey<K, M>]: StructFields;
};

type TaggedUnionCaseFields<
  L extends PropertyKeyLiteralArray,
  Tag extends string,
  M extends EnumMappings<L> | undefined = undefined,
  Cases extends TaggedUnionCases<L, M> = TaggedUnionCases<L, M>,
  Literal extends L[number] = L[number],
> = Struct.Simplify<{ readonly [K in Tag]: S.tag<Literal> } & Cases[HelperKey<Literal, M> & keyof Cases]>;

type TaggedUnionMember<
  L extends PropertyKeyLiteralArray,
  Tag extends string,
  M extends EnumMappings<L> | undefined = undefined,
  Cases extends TaggedUnionCases<L, M> = TaggedUnionCases<L, M>,
  Literal extends L[number] = L[number],
> = Literal extends L[number]
  ? S.Struct<TaggedUnionCaseFields<L, Tag, M, Cases, Literal>> & {
      readonly Type: Struct.Simplify<{ readonly [K in Tag]: Literal }>;
    }
  : never;

type TaggedUnionMembers<
  L extends PropertyKeyLiteralArray,
  Tag extends string,
  M extends EnumMappings<L> | undefined = undefined,
  Cases extends TaggedUnionCases<L, M> = TaggedUnionCases<L, M>,
> = {
  readonly [I in keyof L]: L[I] extends infer Literal extends L[number]
    ? TaggedUnionMember<L, Tag, M, Cases, Literal>
    : never;
};

type NoTagCollision<Tag extends string, Cases extends Record<string, StructFields>> = {
  readonly [K in keyof Cases]: Cases[K] & { readonly [P in Tag]?: never };
};

type ToTaggedUnionFn<L extends PropertyKeyLiteralArray, M extends EnumMappings<L> | undefined = undefined> = <
  const Tag extends string,
>(
  tag: Tag
) => <const Cases extends TaggedUnionCases<L, M>>(
  cases: Cases & NoTagCollision<Tag, Cases> & { readonly [K in Exclude<keyof Cases, HelperKeys<L, M>>]: never }
) => S.toTaggedUnion<Tag, TaggedUnionMembers<L, Tag, M, Cases>>;

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Converts a literal value to its string key at runtime using the
 * {@link LiteralToKey} mapping rules.
 *
 * @example
 * ```ts
 * import { matchLiteral } from "@beep/schema/LiteralKit"
 *
 * const keys = [matchLiteral("pending"), matchLiteral(200), matchLiteral(true), matchLiteral(BigInt(1))]
 * console.log(keys) // ["pending", "number200", "true", "bigint1n"]
 * ```
 *
 * @since 0.0.0
 * @category utilities
 */
export const matchLiteral = <L extends SchemaAST.LiteralValue>(literal: L): LiteralToKey<L> =>
  Match.value(literal).pipe(
    Match.when(P.isBoolean, () => (literal === true ? "true" : "false")),
    Match.when(P.isBigInt, () => `bigint${literal}n` as const),
    Match.when(P.isNumber, () => `number${literal}` as const),
    Match.when(P.isString, () => literal),
    Match.orElseAbsurd
  ) as LiteralToKey<L>;

const makeDefaultEnum = <L extends Literals>(literals: L): DefaultEnumType<L> =>
  A.reduce({} as DefaultEnumType<L>, (acc, literal: L[number]) => ({
    ...acc,
    [matchLiteral(literal)]: literal,
  }))(literals);

const makeMappedEnum = <M extends EnumMappings>(mapping: M): MappedEnumType<M> =>
  A.reduce({} as MappedEnumType<M>, (acc, entry: M[number]) => {
    const [literal, mappedKey] = entry;
    return {
      ...acc,
      [mappedKey]: literal,
    };
  })(mapping);

const helperKey = (literal: SchemaAST.LiteralValue, mapping: ReadonlyArray<EnumMappingEntry> | undefined): string =>
  mapping === undefined
    ? matchLiteral(literal)
    : pipe(
        mapping,
        A.findFirst(([candidate]) => hasSameLiteral(candidate, literal)),
        O.map(([, mappedKey]) => mappedKey),
        O.getOrElse(() => matchLiteral(literal))
      );

const makeGuards = <L extends Literals, M extends EnumMappings<L> | undefined = undefined>(
  literals: L,
  mapping?: M
): IsGuards<L, M> =>
  pipe(
    literals,
    A.reduce({} as IsGuards<L, M>, (acc, literal) => ({
      ...acc,
      [helperKey(literal, mapping)]: (i: unknown) => i === literal,
    }))
  );

const makeThunks = <L extends Literals, M extends EnumMappings<L> | undefined = undefined>(
  literals: L,
  mapping?: M
): Thunks<L, M> =>
  pipe(
    literals,
    A.reduce({} as Thunks<L, M>, (acc, literal) => ({
      ...acc,
      [helperKey(literal, mapping)]: () => literal,
    }))
  );

const LiteralValueSchema = S.Union([S.String, S.BigInt, S.Boolean, S.Finite]);
const makeLiteralKitErrorBase = <Self, Name extends string, Fields extends S.Struct.Fields>(
  name: Name,
  fields: Fields,
  title: string,
  description: string
): TaggedErrorClassFromFields<Self, Name, Fields> =>
  TaggedErrorClass<Self>($I.make(name as never))(
    name,
    fields,
    $I.annote(name as never, {
      title,
      description,
    })
  );
const LiteralNotInSetErrorFields = {
  literals: S.Array(LiteralValueSchema),
  input: S.Array(LiteralValueSchema),
} satisfies S.Struct.Fields;
const LiteralNotInSetErrorBase: TaggedErrorClassFromFields<
  LiteralNotInSetError,
  "LiteralNotInSetError",
  typeof LiteralNotInSetErrorFields
> = makeLiteralKitErrorBase(
  "LiteralNotInSetError",
  LiteralNotInSetErrorFields,
  "Not In Literals Error",
  "Error thrown when an input value is not found in the provided literals array."
);
const LiteralKitKeyCollisionErrorFields = {
  key: S.String,
  existing: LiteralValueSchema,
  incoming: LiteralValueSchema,
} satisfies S.Struct.Fields;
const LiteralKitKeyCollisionErrorBase: TaggedErrorClassFromFields<
  LiteralKitKeyCollisionError,
  "LiteralKitKeyCollisionError",
  typeof LiteralKitKeyCollisionErrorFields
> = makeLiteralKitErrorBase(
  "LiteralKitKeyCollisionError",
  LiteralKitKeyCollisionErrorFields,
  "LiteralKit Key Collision Error",
  "Different literals encoded to the same LiteralKit helper key."
);
const LiteralKitEnumMappingDuplicateLiteralErrorFields = {
  literal: LiteralValueSchema,
  firstIndex: S.Int.check(isNonNegative),
  secondIndex: S.Int.check(isNonNegative),
} satisfies S.Struct.Fields;
const LiteralKitEnumMappingDuplicateLiteralErrorBase: TaggedErrorClassFromFields<
  LiteralKitEnumMappingDuplicateLiteralError,
  "LiteralKitEnumMappingDuplicateLiteralError",
  typeof LiteralKitEnumMappingDuplicateLiteralErrorFields
> = makeLiteralKitErrorBase(
  "LiteralKitEnumMappingDuplicateLiteralError",
  LiteralKitEnumMappingDuplicateLiteralErrorFields,
  "LiteralKit Enum Mapping Duplicate Literal Error",
  "The same source literal appeared more than once in a manual LiteralKit enum mapping."
);
const LiteralKitEnumMappingCoverageErrorFields = {
  literals: S.Array(LiteralValueSchema),
  mappingLiterals: S.Array(LiteralValueSchema),
  missing: S.Array(LiteralValueSchema),
  unexpected: S.Array(LiteralValueSchema),
} satisfies S.Struct.Fields;
const LiteralKitEnumMappingCoverageErrorBase: TaggedErrorClassFromFields<
  LiteralKitEnumMappingCoverageError,
  "LiteralKitEnumMappingCoverageError",
  typeof LiteralKitEnumMappingCoverageErrorFields
> = makeLiteralKitErrorBase(
  "LiteralKitEnumMappingCoverageError",
  LiteralKitEnumMappingCoverageErrorFields,
  "LiteralKit Enum Mapping Coverage Error",
  "A manual LiteralKit enum mapping did not exactly match the provided literal set."
);
const LiteralKitTaggedUnionLiteralErrorFields = {
  literal: LiteralValueSchema,
} satisfies S.Struct.Fields;
const LiteralKitTaggedUnionLiteralErrorBase: TaggedErrorClassFromFields<
  LiteralKitTaggedUnionLiteralError,
  "LiteralKitTaggedUnionLiteralError",
  typeof LiteralKitTaggedUnionLiteralErrorFields
> = makeLiteralKitErrorBase(
  "LiteralKitTaggedUnionLiteralError",
  LiteralKitTaggedUnionLiteralErrorFields,
  "LiteralKit Tagged Union Literal Error",
  "LiteralKit.toTaggedUnion only supports literals that can be used as object property keys."
);

/**
 * Error thrown when an input value is not found in the provided literals
 * array, typically when `omitOptions` removes every literal and cannot return
 * a non-empty result.
 *
 * @example
 * ```ts
 * import { LiteralNotInSetError } from "@beep/schema/LiteralKit"
 *
 * const error = LiteralNotInSetError.make({
 *   literals: ["ready"],
 *   input: ["blocked"]
 * })
 * console.log(error.input.includes("blocked")) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class LiteralNotInSetError extends LiteralNotInSetErrorBase {}

/**
 * Error thrown when different literals encode to the same helper key via
 * {@link LiteralToKey} mapping.
 *
 * @example
 * ```ts
 * import { LiteralKitKeyCollisionError } from "@beep/schema/LiteralKit"
 *
 * const error = LiteralKitKeyCollisionError.make({
 *   key: "number1",
 *   existing: "number1",
 *   incoming: 1
 * })
 * console.log(error.key) // "number1"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class LiteralKitKeyCollisionError extends LiteralKitKeyCollisionErrorBase {}

type SeenLiteralKeys = HashMap.HashMap<string, SchemaAST.LiteralValue>;

/**
 * Error thrown when the same source literal appears more than once in a manual
 * enum mapping provided to {@link LiteralKit}.
 *
 * @example
 * ```ts
 * import { LiteralKitEnumMappingDuplicateLiteralError } from "@beep/schema/LiteralKit"
 *
 * const error = LiteralKitEnumMappingDuplicateLiteralError.make({
 *   literal: "ready",
 *   firstIndex: 0,
 *   secondIndex: 2
 * })
 * console.log(error.secondIndex) // 2
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class LiteralKitEnumMappingDuplicateLiteralError extends LiteralKitEnumMappingDuplicateLiteralErrorBase {}

/**
 * Error thrown when a manual enum mapping does not exactly cover the provided
 * literal set (has missing or unexpected entries).
 *
 * @example
 * ```ts
 * import { LiteralKitEnumMappingCoverageError } from "@beep/schema/LiteralKit"
 *
 * const error = LiteralKitEnumMappingCoverageError.make({
 *   literals: ["read", "write"],
 *   mappingLiterals: ["read"],
 *   missing: ["write"],
 *   unexpected: []
 * })
 * console.log(error.missing.includes("write")) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class LiteralKitEnumMappingCoverageError extends LiteralKitEnumMappingCoverageErrorBase {}

/**
 * Error thrown when `LiteralKit.toTaggedUnion` receives a literal that cannot
 * act as an object property key.
 *
 * @example
 * ```ts
 * import { LiteralKitTaggedUnionLiteralError } from "@beep/schema/LiteralKit"
 *
 * const error = LiteralKitTaggedUnionLiteralError.make({
 *   literal: BigInt(1)
 * })
 * console.log(typeof error.literal) // "bigint"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class LiteralKitTaggedUnionLiteralError extends LiteralKitTaggedUnionLiteralErrorBase {}

const validateLiteralKeys = <L extends Literals>(literals: L): void =>
  void pipe(
    literals,
    A.reduce(HashMap.empty<string, SchemaAST.LiteralValue>(), (seen, literal): SeenLiteralKeys => {
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

const hasSameLiteral = (left: SchemaAST.LiteralValue, right: SchemaAST.LiteralValue): boolean => Object.is(left, right);

const hasLiteral = (values: ReadonlyArray<SchemaAST.LiteralValue>, literal: SchemaAST.LiteralValue): boolean =>
  pipe(
    values,
    A.some((value) => hasSameLiteral(value, literal))
  );

const validateEnumMapping = <L extends Literals>(
  literals: L,
  enumMapping: ReadonlyArray<EnumMappingEntry<L[number]>>
): EnumMappings<L> => {
  if (!A.isReadonlyArrayNonEmpty(enumMapping)) {
    throw LiteralKitEnumMappingCoverageError.make({
      literals,
      mappingLiterals: [],
      missing: literals,
      unexpected: [],
    });
  }

  pipe(
    enumMapping,
    A.reduce(
      {
        keys: HashMap.empty<string, SchemaAST.LiteralValue>(),
        literals: HashMap.empty<SchemaAST.LiteralValue, number>(),
      } as const,
      (state, [literal, mappedKey], index) => {
        const seenLiteral = HashMap.get(state.literals, literal);
        if (O.isSome(seenLiteral)) {
          throw LiteralKitEnumMappingDuplicateLiteralError.make({
            literal,
            firstIndex: seenLiteral.value,
            secondIndex: index,
          });
        }

        const existingKey = HashMap.get(state.keys, mappedKey);
        if (O.isSome(existingKey) && !Object.is(existingKey.value, literal)) {
          throw LiteralKitKeyCollisionError.make({
            key: mappedKey,
            existing: existingKey.value,
            incoming: literal,
          });
        }

        return {
          keys: HashMap.set(state.keys, mappedKey, literal),
          literals: HashMap.set(state.literals, literal, index),
        } as const;
      }
    )
  );

  const mappingLiterals = pipe(
    enumMapping,
    A.map(([literal]) => literal)
  );
  const missing = pipe(
    literals,
    A.filter((literal) => !hasLiteral(mappingLiterals, literal))
  );
  const unexpected = pipe(
    mappingLiterals,
    A.filter((literal) => !hasLiteral(literals, literal))
  );

  if (A.isReadonlyArrayNonEmpty(missing) || A.isReadonlyArrayNonEmpty(unexpected)) {
    throw LiteralKitEnumMappingCoverageError.make({
      literals,
      mappingLiterals,
      missing,
      unexpected,
    });
  }

  return enumMapping;
};

const makeOptionsFns = <L extends Literals>(
  literals: L
): {
  readonly pickOptions: <LSubset extends A.NonEmptyReadonlyArray<L[number]>>(subset: LSubset) => LSubset;
  readonly omitOptions: <LSubset extends A.NonEmptyReadonlyArray<L[number]>>(
    subset: LSubset
  ) => A.NonEmptyReadonlyArray<Exclude<L[number], LSubset[number]>>;
} => ({
  pickOptions: <LSubset extends A.NonEmptyReadonlyArray<L[number]>>(subset: LSubset): LSubset => subset,
  omitOptions: <LSubset extends A.NonEmptyReadonlyArray<L[number]>>(
    subset: LSubset
  ): A.NonEmptyReadonlyArray<Exclude<L[number], LSubset[number]>> => {
    const keySet: HashSet.HashSet<SchemaAST.LiteralValue> = HashSet.fromIterable(subset);
    const isExcluded = (literal: L[number]): literal is Exclude<L[number], LSubset[number]> =>
      !HashSet.has(literal)(keySet);
    const isResult = (
      i: ReadonlyArray<Exclude<L[number], LSubset[number]>>
    ): i is A.NonEmptyReadonlyArray<Exclude<L[number], LSubset[number]>> => A.isReadonlyArrayNonEmpty(i);
    const result = A.filter(literals, isExcluded);

    if (!isResult(result)) {
      throw LiteralNotInSetError.make({ literals, input: result });
    }
    return result;
  },
});

function buildMatch<L extends Literals, M extends EnumMappings<L> | undefined = undefined>(_: L, mapping?: M) {
  function $match<const Cases extends MatchCases<L, M>>(
    cases: Cases & { readonly [K in Exclude<keyof Cases, MatchKeys<L, M>>]: never }
  ): (value: L[number]) => Unify.Unify<MatchReturn<Cases>>;
  function $match<const Cases extends MatchCases<L, M>>(
    value: L[number],
    cases: Cases & { readonly [K in Exclude<keyof Cases, MatchKeys<L, M>>]: never }
  ): Unify.Unify<MatchReturn<Cases>>;
  function $match(...args: Array<unknown>): unknown {
    if (args.length === 1) {
      const cases = args[0] as Record<string, (value: L[number]) => unknown>;
      return (value: L[number]) => {
        const key = helperKey(value, mapping);
        return cases[key](value);
      };
    }
    const value = args[0] as L[number];
    const cases = args[1] as Record<string, (value: L[number]) => unknown>;
    const key = helperKey(value, mapping);
    return cases[key](value);
  }

  return $match;
}

const attachHelperDescriptors = <T extends object>(schema: T, descriptors: PropertyDescriptorMap): T => {
  const originalAnnotate = Reflect.get(schema, "annotate");

  return Object.defineProperties(schema, {
    ...descriptors,
    ...(P.isFunction(originalAnnotate)
      ? {
          annotate: {
            value(annotation: unknown) {
              return attachHelperDescriptors(originalAnnotate.call(schema, annotation), descriptors);
            },
            enumerable: false,
            writable: false,
            configurable: true,
          },
        }
      : {}),
  }) as T;
};

/**
 * Runtime literal kit type that augments `Schema.Literals` with convenience
 * helpers: `Options`, `Enum`, `is`, `pickOptions`, `omitOptions`, `$match`,
 * `thunk`, and `toTaggedUnion`.
 *
 * Supports mixed literal types (`string | number | boolean | bigint`) with
 * keys mapped via {@link LiteralToKey}, or via the manual mapping when one is
 * supplied to {@link LiteralKit}.
 *
 * @category models
 * @since 0.0.0
 */
type LiteralKitBase<L extends Literals, M extends EnumMappings<L> | undefined = undefined> = S.Literals<L> & {
  readonly Options: L;
  readonly is: IsGuards<L, M>;
  readonly Enum: EnumType<L, M>;
  readonly pickOptions: <LSubset extends A.NonEmptyReadonlyArray<L[number]>>(subset: LSubset) => LSubset;
  readonly omitOptions: <LSubset extends A.NonEmptyReadonlyArray<L[number]>>(
    subset: LSubset
  ) => A.NonEmptyReadonlyArray<Exclude<L[number], LSubset[number]>>;
  readonly $match: MatchFn<L, M>;
  readonly thunk: Thunks<L, M>;
  readonly toTaggedUnion: L[number] extends PropertyKeyLiteral
    ? ToTaggedUnionFn<PropertyKeyLiterals<L>, M extends EnumMappings<PropertyKeyLiterals<L>> ? M : undefined>
    : never;
};

/**
 * @since 0.0.0
 */
/**
 * Runtime literal kit returned by {@link LiteralKit}.
 *
 * @example
 * ```ts
 * import { LiteralKit, type LiteralKit as LiteralKitType } from "@beep/schema/LiteralKit"
 *
 * const Status = LiteralKit(["ready", "blocked"])
 * console.log(Status.Enum.ready satisfies LiteralKitType<readonly ["ready", "blocked"]>["Enum"]["ready"])
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export interface LiteralKit<L extends Literals, M extends EnumMappings<L> | undefined = undefined>
  extends LiteralKitBase<L, M> {
  readonly Rebuild: LiteralKit<L, M>;
}

/**
 * Builds a literal schema kit from a non-empty tuple of mixed literals.
 *
 * @example
 * ```typescript
 * import { LiteralKit } from "@beep/schema";
 * import * as S from "effect/Schema";
 *
 * const Status = LiteralKit([1, 20n, true, false, "hello"]);
 *
 * Status.Enum.number1;       // 1
 * Status.Enum.bigint20n;     // 20n
 * Status.Enum.true;          // true
 * Status.is.number1(42);     // false
 * Status.is.hello("hello");  // true
 *
 * const matchResult = Status.$match(Status.Enum.number1, {
 *   number1: () => "one",
 *   bigint20n: () => "twenty",
 *   true: () => "yes",
 *   false: () => "no",
 *   hello: () => "greeting",
 * });
 * console.log(matchResult)
 *
 * const EventKind = LiteralKit(["created", "deleted"]);
 *
 * const Event = EventKind.toTaggedUnion("kind")({
 *   created: {
 *     id: S.String
 *   },
 *   deleted: {
 *     id: S.String
 *   }
 * });
 * const event = S.decodeUnknownSync(Event)({ kind: "created", id: "evt_1" })
 * console.log(event.kind)
 *
 * const StatusKeys = LiteralKit(
 *   ["one", "two"],
 *   [["one", "ONE"], ["two", "TWO"]]
 * );
 *
 * StatusKeys.Enum.ONE; // "one"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export function LiteralKit<const L extends Literals>(literals: L): LiteralKit<L>;
/**
 * Builds a literal schema kit with a custom key mapping for `.Enum`.
 *
 * @example
 * ```ts
 * import { LiteralKit } from "@beep/schema/LiteralKit"
 *
 * const StatusKeys = LiteralKit(
 *   ["one", "two"],
 *   [["one", "ONE"], ["two", "TWO"]]
 * )
 *
 * console.log(StatusKeys.Enum.ONE) // "one"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export function LiteralKit<const L extends Literals, const M extends EnumMappings<L>>(
  literals: L,
  enumMapping: M & ValidEnumMapping<L, M>
): LiteralKit<L, M>;
/**
 * Implementation signature for {@link LiteralKit}; see the overloads above for
 * the public call shapes.
 *
 * @example
 * ```ts
 * import { LiteralKit } from "@beep/schema/LiteralKit"
 *
 * const Status = LiteralKit(["ready", "blocked"])
 * console.log(Status.Options.includes("ready"))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export function LiteralKit<const L extends Literals, const M extends EnumMappings<L> | undefined = undefined>(
  literals: L,
  enumMapping?: M extends EnumMappings<L> ? ValidEnumMapping<L, M> : never
): LiteralKit<L, M> {
  validateLiteralKeys(literals);
  const validatedEnumMapping = enumMapping === undefined ? undefined : validateEnumMapping(literals, enumMapping);
  const base = S.Literals(literals);

  const is = makeGuards(literals, validatedEnumMapping);
  const { pickOptions, omitOptions } = makeOptionsFns(literals);
  const $match = buildMatch(literals, validatedEnumMapping);
  const Enum = validatedEnumMapping === undefined ? makeDefaultEnum(literals) : makeMappedEnum(validatedEnumMapping);
  const thunk = makeThunks(literals, validatedEnumMapping);
  const toTaggedUnion =
    <const Tag extends string>(tag: Tag) =>
    <const Cases extends Record<string, StructFields>>(cases: Cases) => {
      const union = base.mapMembers((members) => {
        const literalMembers: ReadonlyArray<S.Literal<L[number]>> = members;

        return A.map(literalMembers, (member) => {
          if (!P.isPropertyKey(member.literal)) {
            throw LiteralKitTaggedUnionLiteralError.make({
              literal: member.literal,
            });
          }

          return S.Struct({
            [tag]: S.tag(member.literal),
            ...cases[helperKey(member.literal, validatedEnumMapping)],
          });
        });
      });

      return S.toTaggedUnion(tag)(
        union as unknown as S.Union<ReadonlyArray<S.Top & { readonly Type: { readonly [K in Tag]: PropertyKey } }>>
      );
    };

  const readonlyProperty = <T>(value: T): PropertyDescriptor => ({
    value,
    enumerable: true,
    writable: false,
    configurable: false,
  });

  return attachHelperDescriptors(base, {
    Options: readonlyProperty(literals),
    is: readonlyProperty(is),
    Enum: readonlyProperty(Enum),
    pickOptions: readonlyProperty(pickOptions),
    omitOptions: readonlyProperty(omitOptions),
    $match: readonlyProperty($match),
    thunk: readonlyProperty(thunk),
    toTaggedUnion: readonlyProperty(toTaggedUnion),
  }) as LiteralKit<L, M>;
}
