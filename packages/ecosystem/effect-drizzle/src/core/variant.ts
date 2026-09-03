/**
 * Defines the shared Effect model-variant vocabulary for every dialect.
 *
 * One factory keeps select, insert, update, and JSON membership identical
 * across PostgreSQL and SQLite model construction.
 *
 * @since 0.0.0
 */
import { VariantSchema } from "effect/unstable/schema";
import type { Top } from "effect/Schema";
import type { Apply, Lambda } from "effect/Struct";

const variantTuple = <const Values extends readonly [string, ...string[]]>(...values: Values): Values => values;

/** Ordered variant list retained in public declaration inference. */
const variants = variantTuple("select", "insert", "update", "json", "jsonCreate", "jsonUpdate");

/**
 * Names the six model projections shared by both SQL dialects.
 *
 * **Details**
 *
 * `select`, `insert`, and `update` serve database operations; `json`,
 * `jsonCreate`, and `jsonUpdate` serve transport boundaries.
 *
 * **Example** (Select write variants)
 *
 * ```ts
 * import type { Variant } from
 *   "@beep/effect-drizzle"
 *
 * type WriteVariant = Extract<Variant, "insert" | "update"> // => "insert" | "update"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export type Variant = (typeof variants)[number];

/**
 * Guards each supported model projection name for dialect-aware consumers.
 * @category guards
 * @since 0.0.0
 */
export const Variant = {
  is: {
    select: (value: unknown): value is "select" => value === "select",
    insert: (value: unknown): value is "insert" => value === "insert",
    update: (value: unknown): value is "update" => value === "update",
    json: (value: unknown): value is "json" => value === "json",
    jsonCreate: (value: unknown): value is "jsonCreate" => value === "jsonCreate",
    jsonUpdate: (value: unknown): value is "jsonUpdate" => value === "jsonUpdate",
  },
};

/**
 * Internal `VariantSchema` factory from which the public helpers are derived.
 *
 * @internal
 * @category guards
 * @since 0.0.0
 */
export const factory = /* @__PURE__ */ VariantSchema.make({
  variants,
  defaultVariant: "select",
});

/**
 * Assigns distinct schemas to selected model variants.
 *
 * **When to use**
 *
 * Use when a field's database or JSON representation differs by operation and
 * the ordinary default/generated truth table is insufficient.
 *
 * **Details**
 *
 * Only listed variants contain the field. The supplied mapping remains the
 * source of truth instead of being regenerated from SQL metadata.
 *
 * **Example** (Define explicit variant membership)
 *
 * ```ts
 * import { String } from "effect/Schema"
 * import { VariantField } from
 *   "@beep/effect-drizzle"
 *
 * const field = VariantField({ select: String, update: String })
 *
 * Object.keys(field.schemas) // => ["select", "update"]
 * ```
 *
 * @see {@link FieldOnly} for assigning one schema to an inclusion list.
 * @see {@link FieldExcept} for assigning one schema outside an exclusion list.
 * @category constructors
 * @since 0.0.0
 */
export const VariantField = factory.Field;

/**
 * Includes one schema in only the named model variants.
 *
 * **When to use**
 *
 * Use when membership is easier to state as a short inclusion list.
 *
 * **Example** (Keep a field in read variants)
 *
 * ```ts
 * import { String } from "effect/Schema"
 * import { FieldOnly } from
 *   "@beep/effect-drizzle"
 *
 * const field = String.pipe(FieldOnly(["select", "json"]))
 *
 * Object.keys(field.schemas) // => ["select", "json"]
 * ```
 *
 * @see {@link FieldExcept} for the complementary exclusion form.
 * @category combinators
 * @since 0.0.0
 */
export const FieldOnly = factory.FieldOnly;

/**
 * Includes one schema in every model variant except those named.
 *
 * **When to use**
 *
 * Use when membership is easier to state as a short exclusion list.
 *
 * **Example** (Exclude a field from create variants)
 *
 * ```ts
 * import { String } from "effect/Schema"
 * import { FieldExcept } from
 *   "@beep/effect-drizzle"
 *
 * const field = String.pipe(FieldExcept(["insert", "jsonCreate"]))
 *
 * "insert" in field.schemas // => false
 * ```
 *
 * @see {@link FieldOnly} for the complementary inclusion form.
 * @category combinators
 * @since 0.0.0
 */
export const FieldExcept = factory.FieldExcept;

// biome-ignore lint/suspicious/noExplicitAny: Effect uses Field<any> as its invariant variant-field existential.
type FieldEvolveInput = VariantSchema.Field<any> | Top;

type FieldEvolveTransforms = { readonly [Key in Variant]?: (variant: never) => Top };

type FieldEvolveMapping<Self extends FieldEvolveInput> =
  Self extends VariantSchema.Field<infer Schemas>
    ? { readonly [Key in keyof Schemas]?: (variant: Schemas[Key]) => Top }
    : { readonly [Key in Variant]?: (variant: Self) => Top };

type ApplyFieldEvolveTransform<Transform, Input> = Transform extends Lambda
  ? Extract<Apply<Transform, Input>, Top>
  : Transform extends (argument: Input) => infer Result
    ? Extract<Result, Top>
    : Input;

type EvolvedField<Self extends FieldEvolveInput, Mapping extends FieldEvolveTransforms> = VariantSchema.Field<
  Self extends VariantSchema.Field<infer Schemas>
    ? {
        readonly [Key in keyof Schemas]: Key extends keyof Mapping
          ? ApplyFieldEvolveTransform<Mapping[Key], Schemas[Key]>
          : Schemas[Key];
      }
    : {
        readonly [Key in Variant]: Key extends keyof Mapping ? ApplyFieldEvolveTransform<Mapping[Key], Self> : Self;
      }
>;

type FieldEvolve = {
  <const Mapping extends FieldEvolveTransforms>(
    ...args: [f: Mapping]
  ): <Self extends FieldEvolveInput>(self: Self) => EvolvedField<Self, Mapping>;
  <Self extends FieldEvolveInput, const Mapping extends FieldEvolveMapping<Self>>(
    ...args: [self: Self, f: Mapping]
  ): EvolvedField<Self, Mapping>;
};

/**
 * Evolves selected variant schemas while leaving other variants unchanged.
 *
 * **When to use**
 *
 * Use to refine one or more members of an existing variant field without
 * rebuilding its complete membership map.
 *
 * **Example** (Evolve one member)
 *
 * ```ts
 * import { NullOr, String } from "effect/Schema"
 * import { VariantField, fieldEvolve } from
 *   "@beep/effect-drizzle"
 *
 * const field = VariantField({ select: String, update: String }).pipe(
 *   fieldEvolve({ update: NullOr })
 * )
 *
 * field.schemas.update // => NullOr(String)
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const fieldEvolve = factory.fieldEvolve as FieldEvolve;

/**
 * Extracts the schema for one variant from a variant-aware model structure.
 *
 * **When to use**
 *
 * Use when generic code receives a variant structure and needs one concrete
 * operation schema; model classes also expose their common variants as statics.
 *
 * **Example** (Extract an insert schema)
 *
 * ```ts
 * import { String } from "effect/Schema"
 * import { Model, extract } from
 *   "@beep/effect-drizzle"
 *
 * class User extends Model<User>("User")({ name: String }) {}
 *
 * extract(User, "insert") // => schema for User's insert payload
 * ```
 *
 * @category destructors
 * @since 0.0.0
 */
export const extract = factory.extract;
