/**
 * Schema-backed literal toolkit helpers for mixed literal types.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { $SchemaId } from "@beep/identity/packages";
import { A } from "@beep/utils";
import { Match } from "effect";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import type { SchemaAST, Struct, Unify } from "effect";

const $I = $SchemaId.create("LiteralKit");

type Literals = A.NonEmptyReadonlyArray<SchemaAST.LiteralValue>;

/**
 * Maps a literal value to its string key representation used in `Enum`, `is`,
 * `$match`, and `toTaggedUnion` objects.
 *
 * **Details**
 *
 * Key format by type:
 * - boolean: `"true"` or `"false"`
 * - bigint: `"bigint${value}n"` (e.g., `1n` becomes `"bigint1n"`)
 * - number: `"number${value}"` (e.g., `200` becomes `"number200"`)
 * - string: as-is (e.g., `"pending"` stays `"pending"`)
 *
 * **Example** (Number literal key mapping)
 *
 * ```ts
 * import type { LiteralToKey } from "@beep/schema/LiteralKit"
 *
 * const key = "number200" satisfies LiteralToKey<200>
 * console.log(key)
 * ```
 *
 * @category models
 * @since 0.0.0
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

type EnumType<L extends Literals> = {
  readonly [K in L[number] as LiteralToKey<K>]: K;
};

type IsGuards<L extends Literals> = {
  readonly [K in L[number] as LiteralToKey<K>]: (i: unknown) => i is K;
};

type MatchCases<L extends Literals> = {
  readonly [K in L[number] as LiteralToKey<K>]: (value: K) => unknown;
};

/**
 * Valid keys for a MatchCases object derived from the literal set.
 */
type MatchKeys<L extends Literals> = LiteralToKey<L[number]>;

/**
 * Extract the union of return types from a Cases object.
 * Uses conditional inference to avoid TS2536 when indexing Cases
 * with remapped keys that TS can't prove are valid indices.
 */
type MatchReturn<Cases> = {
  [K in keyof Cases]: Cases[K] extends (...args: ReadonlyArray<unknown>) => infer R ? R : never;
}[keyof Cases];

type MatchFn<L extends Literals> = {
  <const Cases extends MatchCases<L>>(
    cases: Cases & { readonly [K in Exclude<keyof Cases, MatchKeys<L>>]: never }
  ): (value: L[number]) => Unify.Unify<MatchReturn<Cases>>;
  <const Cases extends MatchCases<L>>(
    value: L[number],
    cases: Cases & { readonly [K in Exclude<keyof Cases, MatchKeys<L>>]: never }
  ): Unify.Unify<MatchReturn<Cases>>;
};

type PropertyKeyLiteral = Extract<SchemaAST.LiteralValue, PropertyKey>;
type PropertyKeyLiteralArray = A.NonEmptyReadonlyArray<PropertyKeyLiteral>;

type PropertyKeyLiterals<L extends Literals> = {
  readonly [I in keyof L]: Extract<L[I], PropertyKeyLiteral>;
};

type StructFields = Readonly<Record<string, S.Top>>;

type TaggedUnionCases<L extends PropertyKeyLiteralArray> = {
  readonly [K in L[number] as LiteralToKey<K>]: StructFields;
};

type TaggedUnionCaseFields<
  L extends PropertyKeyLiteralArray,
  Tag extends string,
  Cases extends TaggedUnionCases<L> = TaggedUnionCases<L>,
  Literal extends L[number] = L[number],
> = Struct.Simplify<{ readonly [K in Tag]: S.tag<Literal> } & Cases[LiteralToKey<Literal> & keyof Cases]>;

type TaggedUnionMember<
  L extends PropertyKeyLiteralArray,
  Tag extends string,
  Cases extends TaggedUnionCases<L> = TaggedUnionCases<L>,
  Literal extends L[number] = L[number],
> = Literal extends L[number]
  ? S.Struct<TaggedUnionCaseFields<L, Tag, Cases, Literal>> & {
      readonly Type: Struct.Simplify<{ readonly [K in Tag]: Literal }>;
    }
  : never;

type TaggedUnionMembers<
  L extends PropertyKeyLiteralArray,
  Tag extends string,
  Cases extends TaggedUnionCases<L> = TaggedUnionCases<L>,
> = {
  readonly [I in keyof L]: L[I] extends infer Literal extends L[number]
    ? TaggedUnionMember<L, Tag, Cases, Literal>
    : never;
};

type NoTagCollision<Tag extends string, Cases extends Record<string, StructFields>> = {
  readonly [K in keyof Cases]: Cases[K] & { readonly [P in Tag]?: never };
};

type ToTaggedUnionFn<L extends PropertyKeyLiteralArray> = <const Tag extends string>(
  tag: Tag
) => <const Cases extends TaggedUnionCases<L>>(
  cases: Cases & NoTagCollision<Tag, Cases> & { readonly [K in Exclude<keyof Cases, MatchKeys<L>>]: never }
) => S.toTaggedUnion<Tag, TaggedUnionMembers<L, Tag, Cases>>;

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Converts a literal value to its string key at runtime using the
 * {@link LiteralToKey} mapping rules.
 *
 * **Example** (Runtime literal key conversion)
 *
 * ```ts import.meta.vitest name="Runtime literal key conversion"
 * import { matchLiteral } from "@beep/schema/LiteralKit"
 *
 * const keys = [matchLiteral("pending"), matchLiteral(200), matchLiteral(true), matchLiteral(BigInt(1))]
 * keys // => ["pending", "number200", "true", "bigint1n"]
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const matchLiteral = <L extends SchemaAST.LiteralValue>(literal: L): LiteralToKey<L> =>
  Match.value(literal).pipe(
    Match.when(P.isBoolean, () => (literal === true ? "true" : "false")),
    Match.when(P.isBigInt, () => `bigint${literal}n` as const),
    Match.when(P.isNumber, () => `number${literal}` as const),
    Match.when(P.isString, () => literal),
    Match.orElseAbsurd
  ) as LiteralToKey<L>;

const makeEnum = <L extends Literals>(literals: L): EnumType<L> =>
  A.reduce({} as EnumType<L>, (acc, literal: L[number]) => ({
    ...acc,
    [matchLiteral(literal)]: literal,
  }))(literals);

const makeGuards = <L extends Literals>(literals: L): IsGuards<L> =>
  A.reduce({} as IsGuards<L>, (acc, literal: L[number]) => ({
    ...acc,
    [matchLiteral(literal)]: (i: unknown) => i === literal,
  }))(literals);

const LiteralValueSchema = S.Union([S.String, S.BigInt, S.Boolean, S.Finite]);

/**
 * Error thrown when `LiteralKit.toTaggedUnion` receives a literal that cannot
 * act as an object property key.
 *
 * **Example** (Create tagged-union literal error)
 *
 * ```ts import.meta.vitest name="Create tagged-union literal error"
 * import { LiteralKitTaggedUnionLiteralError } from "@beep/schema/LiteralKit"
 *
 * const error = LiteralKitTaggedUnionLiteralError.make({
 *   literal: BigInt(1)
 * })
 * typeof error.literal // => "bigint"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class LiteralKitTaggedUnionLiteralError extends S.TaggedError<LiteralKitTaggedUnionLiteralError>(
  $I.make("LiteralKitTaggedUnionLiteralError")
)(
  "LiteralKitTaggedUnionLiteralError",
  {
    literal: LiteralValueSchema,
  },
  $I.annoteError<LiteralKitTaggedUnionLiteralError>("LiteralKitTaggedUnionLiteralError", {
    title: "LiteralKit Tagged Union Literal Error",
    description: "LiteralKit.toTaggedUnion only supports literals that can be used as object property keys.",
  })
) {}

function buildMatch<L extends Literals>(_: L) {
  function $match<const Cases extends MatchCases<L>>(
    cases: Cases & { readonly [K in Exclude<keyof Cases, MatchKeys<L>>]: never }
  ): (value: L[number]) => Unify.Unify<MatchReturn<Cases>>;
  function $match<const Cases extends MatchCases<L>>(
    value: L[number],
    cases: Cases & { readonly [K in Exclude<keyof Cases, MatchKeys<L>>]: never }
  ): Unify.Unify<MatchReturn<Cases>>;
  function $match(...args: Array<unknown>): unknown {
    if (args.length === 1) {
      const cases = args[0] as Record<string, (value: L[number]) => unknown>;
      // The match cases are exhaustive by construction: every literal key has a handler.
      return (value: L[number]) => cases[matchLiteral(value)]!(value);
    }
    const value = args[0] as L[number];
    const cases = args[1] as Record<string, (value: L[number]) => unknown>;
    // The match cases are exhaustive by construction: every literal key has a handler.
    return cases[matchLiteral(value)]!(value);
  }

  return $match;
}

/**
 * Attach the kit statics and keep them attached across every derivation.
 *
 * Upstream's `annotate`, `annotateKey` and `check` all return
 * `this.rebuild(ast)`, so overriding `rebuild` on the instance re-attaches the
 * statics to whatever the upstream rebuild returns.
 */
const attachHelperDescriptors = <T extends S.Top>(schema: T, descriptors: PropertyDescriptorMap): T => {
  const upstreamRebuild = schema.rebuild;

  return Object.defineProperties(schema, {
    ...descriptors,
    rebuild: {
      value(this: S.Top, ast: SchemaAST.AST): S.Top {
        return attachHelperDescriptors(upstreamRebuild.call(this, ast), descriptors);
      },
      enumerable: false,
      writable: false,
      configurable: true,
    },
  });
};

/**
 * Runtime literal kit returned by {@link LiteralKit}: `Schema.Literals` plus
 * the keyed value helpers `Enum`, `is`, `$match`, and `toTaggedUnion`.
 *
 * **Details**
 *
 * Supports mixed literal types (`string | number | boolean | bigint`) with
 * keys mapped via {@link LiteralToKey}. Everything else, including the literal
 * tuple (`literals`) and subsets (`pick`), comes from upstream
 * `Schema.Literals`. `Rebuild` is the kit itself, so `annotate`,
 * `annotateKey`, and `check` keep the helpers.
 *
 * **Example** (Runtime kit type usage)
 *
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
export interface LiteralKit<L extends Literals> extends S.Literals<L> {
  readonly $match: MatchFn<L>;
  readonly Enum: EnumType<L>;
  readonly is: IsGuards<L>;
  readonly Rebuild: LiteralKit<L>;
  readonly toTaggedUnion: L[number] extends PropertyKeyLiteral ? ToTaggedUnionFn<PropertyKeyLiterals<L>> : never;
}

/**
 * Builds a literal schema kit from a non-empty tuple of mixed literals.
 *
 * **Details**
 *
 * The kit is `Schema.Literals(literals)` with keyed helpers attached. Use
 * upstream members for the rest: `Kit.literals` for the tuple,
 * `Kit.pick([...]).literals` for a subset, `HashSet.fromIterable(Kit.literals)`
 * for a set, and `Function.constant(Kit.Enum.key)` for a thunk. The helpers
 * survive `annotate`, `annotateKey`, and `check`.
 *
 * **Example** (Build mixed literal kit)
 *
 * ```ts import.meta.vitest name="Build mixed literal kit"
 * import { LiteralKit } from "@beep/schema/LiteralKit"
 * import * as S from "effect/Schema"
 *
 * const Status = LiteralKit([1, 20n, true, false, "hello"])
 *
 * Status.Enum.number1 // => 1
 * Status.Enum.bigint20n // => 20n
 * Status.is.hello("hello") // => true
 * Status.is.number1(42) // => false
 * Status.literals // => [1, 20n, true, false, "hello"]
 *
 * Status.$match(Status.Enum.number1, {
 *   number1: () => "one",
 *   bigint20n: () => "twenty",
 *   true: () => "yes",
 *   false: () => "no",
 *   hello: () => "greeting"
 * }) // => "one"
 *
 * const EventKind = LiteralKit(["created", "deleted"])
 * const Event = EventKind.toTaggedUnion("kind")({
 *   created: { id: S.String },
 *   deleted: { id: S.String }
 * })
 * S.is(Event)({ kind: "created", id: "evt_1" }) // => true
 * ```
 *
 * **Example** (Helpers survive derivations)
 *
 * ```ts import.meta.vitest name="Helpers survive derivations"
 * import { LiteralKit } from "@beep/schema/LiteralKit"
 * import * as S from "effect/Schema"
 *
 * const Tier = LiteralKit(["free", "pro", "team"])
 *   .check(S.makeFilter((tier) => tier !== "team" || "team is invite-only"))
 *   .annotate({ description: "Billing tier" })
 *
 * Tier.Enum.pro // => "pro"
 * Tier.is.free("free") // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export function LiteralKit<const L extends Literals>(literals: L): LiteralKit<L> {
  const base = S.Literals(literals);

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

          const key: string = matchLiteral(member.literal);
          return S.Struct({
            [tag]: S.tag(member.literal),
            ...cases[key],
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
    is: readonlyProperty(makeGuards(literals)),
    Enum: readonlyProperty(makeEnum(literals)),
    $match: readonlyProperty(buildMatch(literals)),
    toTaggedUnion: readonlyProperty(toTaggedUnion),
  }) as LiteralKit<L>;
}
