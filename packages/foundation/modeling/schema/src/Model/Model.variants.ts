/**
 * Internal schema module support.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as VariantSchema from "../VariantSchema/index.ts";
import type { TUnsafe } from "@beep/types";
import type { Brand } from "effect/Brand";
import type * as S from "effect/Schema";

const modelVariants = ["select", "insert", "update", "json", "jsonCreate", "jsonUpdate"] as const;

const {
  /**
   * A base class used for creating domain model schemas.
   *
   * It supports common variants for database and JSON apis.
   *
   * @example
   * ```ts
   * import * as S from "effect/Schema"
   * import * as Model from "@beep/schema/Model"
   *
   * export const GroupId = S.Finite.pipe(S.brand("GroupId"))
   *
   * export class Group extends Model.Class<Group>("Group")({}) {}
   *
   * // schema used for selects
   * Group
   *
   * // schema used for inserts
   * Group.insert
   *
   * // schema used for updates
   * Group.update
   *
   * // schema used for json api
   * Group.json
   * Group.jsonCreate
   * Group.jsonUpdate
   *
   * // you can also turn them into classes
   * class GroupJson extends S.Class<GroupJson>("GroupJson")(Group.json) {}
   * console.log(GroupJson)
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  Class,
  /**
   * Define a variant-aware field by supplying a schema per variant key.
   *
   * @example
   * ```ts
   * import * as Model from "@beep/schema/Model"
   *
   * const status = Model.Field({})
   *
   * console.log(status)
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  Field,
  /**
   * Create a field present on every variant except the listed ones.
   *
   * @example
   * ```ts
   * import * as S from "effect/Schema"
   * import * as Model from "@beep/schema/Model"
   *
   * const readOnly = Model.FieldExcept(["insert", "update"])(S.String)
   * console.log(readOnly)
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  FieldExcept,
  /**
   * Create a field present only on the listed variants.
   *
   * @example
   * ```ts
   * import * as S from "effect/Schema"
   * import * as Model from "@beep/schema/Model"
   *
   * const jsonOnly = Model.FieldOnly(["json", "jsonCreate"])(S.String)
   * console.log(jsonOnly)
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  FieldOnly,
  /**
   * Create a raw variant struct without producing a class.
   *
   * @example
   * ```ts
   * import * as Model from "@beep/schema/Model"
   *
   * const groupFields = Model.Struct({})
   *
   * console.log(groupFields)
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  Struct,
  /**
   * Create a discriminated union of variant structs with per-variant accessors.
   *
   * @example
   * ```ts
   * import * as S from "effect/Schema"
   * import * as Model from "@beep/schema/Model"
   *
   * const a = Model.Struct({ _tag: S.tag("A"), value: S.String })
   * const b = Model.Struct({ _tag: S.tag("B"), count: S.Finite })
   * const AB = Model.Union([a, b])
   *
   * console.log(AB)
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  Union,
  /**
   * Extract the schema for a specific variant from a variant struct.
   *
   * @example
   * ```ts
   * import * as Model from "@beep/schema/Model"
   *
   * const fields = Model.Struct({})
   *
   * const InsertSchema = Model.extract(fields, "insert")
   * console.log(InsertSchema)
   * ```
   *
   * @category getters
   * @since 0.0.0
   */
  extract,
  /**
   * Transform variant schemas inside an existing field using per-variant mappers.
   *
   * @example
   * ```ts
   * import * as Model from "@beep/schema/Model"
   *
   * const makeOptional = Model.fieldEvolve({})
   *
   * console.log(makeOptional)
   * ```
   *
   * @category mapping
   * @since 0.0.0
   */
  fieldEvolve,
} = VariantSchema.make({
  variants: modelVariants,
  defaultVariant: "select",
});

/**
 * Constraint type satisfied by any Model class produced by {@link Class}.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import * as Model from "@beep/schema/Model"
 *
 * class Account extends Model.Class<Account>("Account")({ id: S.String }) {}
 * const fields: Model.Any["fields"] = Account.fields
 * console.log(Object.keys(fields))
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type Any = S.Top & {
  readonly fields: S.Struct.Fields;
  readonly insert: S.Top;
  readonly update: S.Top;
  readonly json: S.Top;
  readonly jsonCreate: S.Top;
  readonly jsonUpdate: S.Top;
};

/**
 * Union of database variant keys: `"select"`, `"insert"`, `"update"`.
 *
 * @example
 * ```ts
 * import type { VariantsDatabase } from "@beep/schema/Model"
 *
 * const variant = "insert" satisfies VariantsDatabase
 * console.log(variant)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type VariantsDatabase = "select" | "insert" | "update";

/**
 * Union of JSON variant keys: `"json"`, `"jsonCreate"`, `"jsonUpdate"`.
 *
 * @example
 * ```ts
 * import type { VariantsJson } from "@beep/schema/Model"
 *
 * const variant = "jsonCreate" satisfies VariantsJson
 * console.log(variant)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type VariantsJson = "json" | "jsonCreate" | "jsonUpdate";

/**
 * Union of all model variant keys.
 *
 * @example
 * ```ts
 * import type { Variant } from "@beep/schema/Model"
 *
 * const variant = "jsonUpdate" satisfies Variant
 * console.log(variant)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type Variant = (typeof modelVariants)[number];

/**
 * Default model variant used as the class schema.
 *
 * @example
 * ```ts
 * import type { DefaultVariant } from "@beep/schema/Model"
 *
 * const variant = "select" satisfies DefaultVariant
 * console.log(variant)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type DefaultVariant = "select";

type ModelClassCore<Self, Fields extends VariantSchema.Struct.Fields, Inherited> = VariantSchema.Class<
  Self,
  Fields,
  S.Struct<VariantSchema.ExtractFields<DefaultVariant, Fields, true>>,
  Variant,
  DefaultVariant,
  Inherited
> & {
  readonly [V in Variant]: VariantSchema.Extract<
    V,
    VariantSchema.Struct<Fields>,
    V extends DefaultVariant ? true : false
  >;
};

type InheritStaticMembers<C, Static> = C & Pick<Static, Exclude<keyof Static, keyof C>>;

/**
 * Materialized class constructor shape produced by {@link Class}.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import * as Model from "@beep/schema/Model"
 *
 * class Account extends Model.Class<Account>("Account")({ id: S.String }) {}
 * type AccountShape = Model.ClassShape<Account, { readonly id: typeof S.String }>
 * console.log(Account satisfies AccountShape)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type ClassShape<
  Self,
  Fields extends VariantSchema.Struct.Fields,
  Static = {},
  Inherited = {},
> = InheritStaticMembers<ModelClassCore<Self, Fields, Inherited>, Static>;

// Re-export edges: each symbol is documented at its owning declaration above,
// on the destructured binding element bound from `VariantSchema.make(...)`.
export {
  /**
   * @category constructors
   * @since 0.0.0
   */
  Class,
  /**
   * @category getters
   * @since 0.0.0
   */
  extract,
  /**
   * @category constructors
   * @since 0.0.0
   */
  Field,
  /**
   * @category constructors
   * @since 0.0.0
   */
  FieldExcept,
  /**
   * @category constructors
   * @since 0.0.0
   */
  FieldOnly,
  /**
   * @category mapping
   * @since 0.0.0
   */
  fieldEvolve,
  /**
   * @category constructors
   * @since 0.0.0
   */
  Struct,
  /**
   * @category constructors
   * @since 0.0.0
   */
  Union,
};

/**
 * Extract the raw variant field record from a variant struct.
 *
 * @example
 * ```ts
 * import * as Model from "@beep/schema/Model"
 *
 * const s = Model.Struct({})
 *
 * const raw = Model.fields(s)
 * console.log(raw)
 * ```
 *
 * @since 0.0.0
 * @category getters
 */
export const fields: <A extends VariantSchema.Struct<TUnsafe.Any>>(self: A) => A[typeof VariantSchema.TypeId] =
  VariantSchema.fields;

/**
 * Wrap a value so it overrides the default generated by an {@link Overridable} field.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import * as Model from "@beep/schema/Model"
 *
 * const GroupId = S.Finite.pipe(S.brand("GroupId"))
 *
 * class Group extends Model.Class<Group>("Group")({}) {}
 *
 * console.log(Group)
 * ```
 *
 * @since 0.0.0
 * @category constructors
 */
export const Override: <A>(value: A) => A & Brand<"Override"> = VariantSchema.Override;

/**
 * Schema whose constructor can supply a generated default unless callers pass
 * {@link Override}.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import * as Model from "@beep/schema/Model"
 *
 * const Name = Model.Overridable(S.String, { defaultValue: Effect.succeed("anonymous") })
 * console.log(S.isSchema(Name))
 * ```
 *
 * @since 0.0.0
 * @category schemas
 */
export interface Overridable<S extends S.Top & S.WithoutConstructorDefault> extends VariantSchema.Overridable<S> {}

/**
 * Upstream-compatible spelling for {@link Overridable}.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import * as Model from "@beep/schema/Model"
 *
 * const Name = Model.Overrideable(S.String, { defaultValue: Effect.succeed("anonymous") })
 * console.log(S.isSchema(Name))
 * ```
 *
 * @since 0.0.0
 * @category schemas
 */
export interface Overrideable<S extends S.Top & S.WithoutConstructorDefault> extends VariantSchema.Overridable<S> {}

/**
 * Build an `Overridable` schema that falls back to `defaultValue` during
 * constructor creation.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import * as Model from "@beep/schema/Model"
 *
 * const Name = Model.Overridable(S.String, { defaultValue: Effect.succeed("anonymous") })
 * console.log(S.isSchema(Name))
 * ```
 *
 * @since 0.0.0
 * @category constructors
 */
export const Overridable: typeof VariantSchema.Overridable = VariantSchema.Overridable;

/**
 * Upstream-compatible spelling for {@link Overridable}.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import * as Model from "@beep/schema/Model"
 *
 * const Name = Model.Overrideable(S.String, { defaultValue: Effect.succeed("anonymous") })
 * console.log(S.isSchema(Name))
 * ```
 *
 * @since 0.0.0
 * @category constructors
 */
export const Overrideable: typeof Overridable = Overridable;
