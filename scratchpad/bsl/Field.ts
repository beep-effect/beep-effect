/**
 * The BSL field node: one correlated value owning an Effect schema AND its
 * SQL metadata, with both visible to the type system.
 *
 * This is the load-bearing design decision of the experiment. Effect v4
 * annotations cannot carry type-visible metadata (`.annotate` returns
 * `Rebuild`), so — following the `VariantSchema.Field` precedent — the field
 * is a small pipeable wrapper `{ schema, meta }` whose combinators transform
 * both the runtime value and the phantom generics without loss.
 */
import * as Pipeable from "effect/Pipeable";
import * as P from "effect/Predicate";
import type * as S from "effect/Schema";
import { VariantSchema } from "effect/unstable/schema";
import * as Meta from "./Meta.ts";

export const TypeId: unique symbol = Symbol.for("@beep/bsl/Field");
export type TypeId = typeof TypeId;

/** Schemas a field can wrap: a plain schema or a variant-aware field. */
export type AnySchema = S.Top | VariantSchema.Field<any>;

export interface Field<out Sch extends AnySchema, out M extends Meta.Meta> extends Pipeable.Pipeable {
  readonly [TypeId]: TypeId;
  readonly schema: Sch;
  readonly meta: M;
}

export type Any = Field<AnySchema, Meta.Meta>;

/** Everything a combinator accepts: bare schema, variant field, or an existing Field. */
export type Input = AnySchema | Any;

const Proto = {
  [TypeId]: TypeId,
  pipe(this: Any) {
    return Pipeable.pipeArguments(this, arguments);
  },
};

export const make = <const Sch extends AnySchema, const M extends Meta.Meta>(schema: Sch, meta: M): Field<Sch, M> => {
  const self = Object.create(Proto);
  self.schema = schema;
  self.meta = meta;
  return self;
};

export const isField = (u: unknown): u is Any => P.hasProperty(u, TypeId);

/** The schema type an Input resolves to. */
export type SchemaFrom<I extends Input> = I extends Field<infer Sch, any> ? Sch : Extract<I, AnySchema>;

/** The meta type an Input resolves to (bare inputs start at Empty). */
export type MetaFrom<I extends Input> = I extends Field<any, infer M> ? M : Meta.Empty;

/** Normalize any Input into a Field. */
export const from = <I extends Input>(input: I): Field<SchemaFrom<I>, MetaFrom<I>> => {
  if (isField(input)) {
    // Audited boundary: isField cannot narrow the generic I; the runtime value
    // is exactly the Field the type computes.
    return input as Field<SchemaFrom<I>, MetaFrom<I>>;
  }
  return make(input as SchemaFrom<I>, Meta.empty as MetaFrom<I>);
};

/** The resulting Field type after applying a meta patch to an Input. */
export type Patched<I extends Input, Patch extends Meta.Patch> = Field<SchemaFrom<I>, Meta.Merge<MetaFrom<I>, Patch>>;

/**
 * Apply a meta patch to any Input. This is the single runtime seam every
 * combinator goes through, so the merge logic and its type correlation live
 * in exactly one place.
 */
export const patch = <I extends Input, const Patch extends Meta.Patch>(input: I, p: Patch): Patched<I, Patch> => {
  const f = from(input);
  return make(f.schema, Meta.merge(f.meta, p));
};

// ---------------------------------------------------------------------------
// Encoded-type extraction (the SQL-facing side of an Input)
// ---------------------------------------------------------------------------

/**
 * The encoded (database-facing) type of an Input. Variant fields contribute
 * their `select` variant — the database row representation.
 */
export type EncodedOf<I extends Input> = SchemaEncoded<SchemaFrom<I>>;

type SchemaEncoded<Sch> = Sch extends VariantSchema.Field<infer Config>
  ? Config extends { readonly select: infer Sel }
    ? Sel extends S.Top
      ? Sel["Encoded"]
      : never
    : never
  : Sch extends S.Top
    ? Sch["Encoded"]
    : never;

// ---------------------------------------------------------------------------
// Combinator parameter validation
// ---------------------------------------------------------------------------

/**
 * Carrier for compile-time BSL diagnostics. When a combinator's input violates
 * its constraint, the parameter type resolves to this interface and the
 * message literal shows up in the assignability error at the pipe callsite.
 */
export interface BslTypeError<Msg extends string> {
  readonly "~bsl.error": Msg;
}

/**
 * Validates that an Input's encoded type (ignoring `null`) is assignable to
 * `Allowed`. Resolves to `unknown` (no-op intersection) on success and to a
 * BslTypeError carrying `Msg` on failure — surfacing the error AT the
 * combinator call, not downstream.
 */
export type ValidateEncoded<I extends Input, Allowed, Msg extends string> = [Exclude<EncodedOf<I>, null>] extends [
  Allowed,
]
  ? unknown
  : BslTypeError<Msg>;

/**
 * Validates that an Input's encoded type does not admit `null`. Used by
 * `primaryKey()` so a nullable primary key fails at the pipe callsite.
 */
export type ValidateNonNullable<I extends Input, Msg extends string> = null extends EncodedOf<I>
  ? BslTypeError<Msg>
  : unknown;
