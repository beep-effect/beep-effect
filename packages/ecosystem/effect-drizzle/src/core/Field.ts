/**
 * The `@beep/effect-drizzle` field node: one correlated value owning an Effect schema AND its
 * SQL metadata, with both visible to the type system.
 *
 * This is the load-bearing design decision of the experiment. Effect v4
 * annotations cannot carry type-visible metadata (`.annotate` returns
 * `Rebuild`), so — following the `VariantSchema.Field` precedent — the field
 * is a small pipeable wrapper `{ schema, meta }` whose combinators transform
 * both the runtime value and the phantom generics without loss.
 *
 * @since 0.0.0
 */

import { dual } from "effect/Function";
import { pipeArguments } from "effect/Pipeable";
import { hasProperty } from "effect/Predicate";
import * as Meta from "./Meta.ts";
import type { Pipeable } from "effect/Pipeable";
import type { Top } from "effect/Schema";
import type { VariantSchema } from "effect/unstable/schema";

/**
 * Runtime marker carried by every `@beep/effect-drizzle` field wrapper.
 *
 * @category symbols
 * @since 0.0.0
 */
const TypeId: unique symbol = Symbol.for("@beep/effect-drizzle/Field");
/**
 * Type of the runtime `@beep/effect-drizzle` field marker.
 *
 * @category symbols
 * @since 0.0.0
 */
type TypeId = typeof TypeId;

/**
 * Schema forms a `@beep/effect-drizzle` field can wrap.
 *
 * **Gotchas**
 *
 * Effect's current usable existential is `VariantSchema.Field<any>`. Its
 * structural `Field.Any` marker omits `schemas` and `pipe`, while a concrete
 * config is invariant and rejects valid literal variant records. This mirrors
 * Effect's own erased-field boundary rather than widening `@beep/effect-drizzle` data.
 *
 * @category models
 * @since 0.0.0
 */
// biome-ignore lint/suspicious/noExplicitAny: Effect uses Field<any> at invariant variant-field existential boundaries.
export type AnySchema = Top | VariantSchema.Field<any>;

/**
 * Pipeable carrier correlating one schema with its inferred SQL metadata.
 *
 * @category models
 * @since 0.0.0
 */
export interface Field<out Sch extends AnySchema, out M extends Meta.Meta> extends Pipeable {
  readonly meta: M;
  readonly schema: Sch;
  readonly [TypeId]: TypeId;
}

/**
 * Existential field carrier exposed through public combinator inference.
 *
 * @category models
 * @since 0.0.0
 */
export type Any = Field<AnySchema, Meta.Meta>;

/**
 * Bare schema, variant field, or existing field accepted by public combinators.
 *
 * @category models
 * @since 0.0.0
 */
export type Input = AnySchema | Any;

const Proto = {
  [TypeId]: TypeId,
  pipe(this: Any) {
    return pipeArguments(this, arguments);
  },
};

/**
 * Construct the correlated schema-and-metadata field wrapper.
 *
 * @internal
 * @category constructors
 * @since 0.0.0
 */
export const make: {
  <const M extends Meta.Meta>(meta: M): <const Sch extends AnySchema>(schema: Sch) => Field<Sch, M>;
  <const Sch extends AnySchema, const M extends Meta.Meta>(schema: Sch, meta: M): Field<Sch, M>;
} = dual(2, <const Sch extends AnySchema, const M extends Meta.Meta>(schema: Sch, meta: M): Field<Sch, M> => {
  const self = Object.create(Proto);
  self.schema = schema;
  self.meta = meta;
  return self;
});

/**
 * Test whether an unknown value is a `@beep/effect-drizzle` field wrapper.
 *
 * @internal
 * @category guards
 * @since 0.0.0
 */
const isField = (u: unknown): u is Any => hasProperty(u, TypeId);

/**
 * Schema type obtained by normalizing an {@link Input}.
 *
 * @category models
 * @since 0.0.0
 */
export type SchemaFrom<I extends Input> = I extends Field<infer Sch, Meta.Meta> ? Sch : Extract<I, AnySchema>;

/**
 * The metadata type an input resolves to; bare schemas start at {@link Meta.Empty}.
 *
 * @category models
 * @since 0.0.0
 */
export type MetaFrom<I extends Input> = I extends Field<AnySchema, infer M> ? M : Meta.Empty;

/**
 * Normalize a bare schema, variant field, or existing field into one wrapper.
 *
 * @internal
 * @category constructors
 * @since 0.0.0
 */
export function from<I extends Input>(input: I): Field<SchemaFrom<I>, MetaFrom<I>>;
/**
 * Internal helper `from`.
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export function from(input: Input): Any {
  if (isField(input)) {
    return input;
  }
  return make(input, Meta.empty);
}

/**
 * Field type produced after applying a metadata patch to an input.
 *
 * @category models
 * @since 0.0.0
 */
export type Patched<I extends Input, Patch extends Meta.Patch> = Field<SchemaFrom<I>, Meta.Merge<MetaFrom<I>, Patch>>;

/**
 * Apply a meta patch to any Input. This is the single runtime seam every
 * combinator goes through, so the merge logic and its type correlation live
 * in exactly one place.
 *
 * @internal
 * @category combinators
 * @since 0.0.0
 */
export const patch: {
  <const Patch extends Meta.Patch>(p: Patch): <I extends Input>(input: I) => Patched<I, Patch>;
  <I extends Input, const Patch extends Meta.Patch>(input: I, p: Patch): Patched<I, Patch>;
} = dual(2, <I extends Input, const Patch extends Meta.Patch>(input: I, p: Patch): Patched<I, Patch> => {
  const f = from(input);
  return make(f.schema, Meta.merge(f.meta, p));
});

// ---------------------------------------------------------------------------
// Encoded-type extraction (the SQL-facing side of an Input)
// ---------------------------------------------------------------------------

/**
 * Encoded database-facing type of an input; variant fields use `select`.
 *
 * @category models
 * @since 0.0.0
 */
export type EncodedOf<I extends Input> = SchemaEncoded<SchemaFrom<I>>;

type SchemaEncoded<Sch> =
  Sch extends VariantSchema.Field<infer Config>
    ? Config extends { readonly select: infer Sel }
      ? Sel extends Top
        ? Sel["Encoded"]
        : never
      : never
    : Sch extends Top
      ? Sch["Encoded"]
      : never;

// ---------------------------------------------------------------------------
// Combinator parameter validation
// ---------------------------------------------------------------------------

/**
 * Carrier for compile-time `@beep/effect-drizzle` diagnostics at a combinator callsite.
 *
 * **Details**
 *
 * When a constraint fails, its message literal appears in the assignability
 * diagnostic on the offending pipe call.
 *
 * @category errors
 * @since 0.0.0
 */
export interface SqlTypeError<Msg extends string> {
  readonly "~effect-drizzle.error": Msg;
}

/**
 * Validate an input's non-null encoded carrier against an allowed SQL carrier.
 *
 * @category validation
 * @since 0.0.0
 */
export type ValidateEncoded<I extends Input, Allowed, Msg extends string> = [Exclude<EncodedOf<I>, null>] extends [
  Allowed,
]
  ? unknown
  : SqlTypeError<Msg>;

/**
 * Validates that an Input's encoded type does not admit `null`. Used by
 * `primaryKey()` so a nullable primary key fails at the pipe callsite.
 */
/**
 * Reject inputs whose encoded database representation admits `null`.
 *
 * @category validation
 * @since 0.0.0
 */
export type ValidateNonNullable<I extends Input, Msg extends string> = [EncodedOf<I>] extends [
  NonNullable<EncodedOf<I>>,
]
  ? unknown
  : SqlTypeError<Msg>;

type ArrayCarrier<Carrier, Dimensions extends 1 | 2 | 3 | 4 | 5> = Dimensions extends 1
  ? ReadonlyArray<Carrier>
  : Dimensions extends 2
    ? ReadonlyArray<ReadonlyArray<Carrier>>
    : Dimensions extends 3
      ? ReadonlyArray<ReadonlyArray<ReadonlyArray<Carrier>>>
      : Dimensions extends 4
        ? ReadonlyArray<ReadonlyArray<ReadonlyArray<ReadonlyArray<Carrier>>>>
        : ReadonlyArray<ReadonlyArray<ReadonlyArray<ReadonlyArray<ReadonlyArray<Carrier>>>>>;

/**
 * Validate that an array element declaration owns one scalar column spec.
 *
 * @category validation
 * @since 0.0.0
 */
export type ValidateArrayElement<I extends Input> = MetaFrom<I>["column"] extends undefined
  ? SqlTypeError<"pg.array requires an element schema with an explicit base column combinator">
  : MetaFrom<I>["dimensions"] extends 0
    ? unknown
    : SqlTypeError<"pg.array element declarations must be scalar">;

/**
 * Validate an outer schema against an element carrier and declared array depth.
 *
 * @category validation
 * @since 0.0.0
 */
export type ValidateArrayEncoded<I extends Input, Element extends Input, Dimensions extends 1 | 2 | 3 | 4 | 5> = [
  Exclude<EncodedOf<I>, null>,
] extends [ArrayCarrier<EncodedOf<Element>, Dimensions>]
  ? [ArrayCarrier<EncodedOf<Element>, Dimensions>] extends [Exclude<EncodedOf<I>, null>]
    ? unknown
    : SqlTypeError<"pg.array outer schema must exactly match the element carrier at the declared depth">
  : SqlTypeError<"pg.array outer schema must exactly match the element carrier at the declared depth">;
