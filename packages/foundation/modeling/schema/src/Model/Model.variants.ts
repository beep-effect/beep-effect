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
   * **Details**
   *
   * It supports common variants for database and JSON apis.
   *
   * **Example** (Group model variant schemas)
   *
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
   * **Example** (Empty Field definition)
   *
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
   * **Example** (Exclude insert and update)
   *
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
   * **Example** (JSON-only string field)
   *
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
   * **Example** (Empty variant struct)
   *
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
   * **Example** (Tagged A and B union)
   *
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
   * **Example** (Extract insert schema)
   *
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
   * **Example** (Empty fieldEvolve mappers)
   *
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
 * **Example** (Access Account fields type)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import * as Model from "@beep/schema/Model"
 *
 * class Account extends Model.Class<Account>("Account")({ id: S.String }) {}
 * const fields: Model.Any["fields"] = Account.fields
 * console.log(Object.keys(fields))
 * ```
 *
 * @category models
 * @since 0.0.0
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
 * **Example** (Satisfy insert database key)
 *
 * ```ts
 * import type { VariantsDatabase } from "@beep/schema/Model"
 *
 * const variant = "insert" satisfies VariantsDatabase
 * console.log(variant)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type VariantsDatabase = "select" | "insert" | "update";

/**
 * Union of JSON variant keys: `"json"`, `"jsonCreate"`, `"jsonUpdate"`.
 *
 * **Example** (Satisfy jsonCreate key)
 *
 * ```ts
 * import type { VariantsJson } from "@beep/schema/Model"
 *
 * const variant = "jsonCreate" satisfies VariantsJson
 * console.log(variant)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type VariantsJson = "json" | "jsonCreate" | "jsonUpdate";

/**
 * Union of all model variant keys.
 *
 * **Example** (Satisfy jsonUpdate key)
 *
 * ```ts
 * import type { Variant } from "@beep/schema/Model"
 *
 * const variant = "jsonUpdate" satisfies Variant
 * console.log(variant)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Variant = (typeof modelVariants)[number];

/**
 * Default model variant used as the class schema.
 *
 * **Example** (Satisfy select default key)
 *
 * ```ts
 * import type { DefaultVariant } from "@beep/schema/Model"
 *
 * const variant = "select" satisfies DefaultVariant
 * console.log(variant)
 * ```
 *
 * @category models
 * @since 0.0.0
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
 * **Example** (Account ClassShape check)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import * as Model from "@beep/schema/Model"
 *
 * class Account extends Model.Class<Account>("Account")({ id: S.String }) {}
 * type AccountShape = Model.ClassShape<Account, { readonly id: typeof S.String }>
 * console.log(Account satisfies AccountShape)
 * ```
 *
 * @category models
 * @since 0.0.0
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
   * A base class used for creating domain model schemas.
   *
   * **Example** (Group class insert schema)
   *
   * ```ts
   * import * as Model from "@beep/schema/Model"
   *
   * export class Group extends Model.Class<Group>("Group")({}) {}
   * console.log(Group.insert)
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  Class,
  /**
   * Extract the schema for a specific variant from a variant struct.
   *
   * **Example** (Extract insert schema)
   *
   * ```ts
   * import * as Model from "@beep/schema/Model"
   *
   * const fields = Model.Struct({})
   * const InsertSchema = Model.extract(fields, "insert")
   * console.log(InsertSchema)
   * ```
   *
   * @category getters
   * @since 0.0.0
   */
  extract,
  /**
   * Define a variant-aware field by supplying a schema per variant key.
   *
   * **Example** (Empty Field definition)
   *
   * ```ts
   * import * as Model from "@beep/schema/Model"
   *
   * const status = Model.Field({})
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
   * **Example** (Exclude insert and update)
   *
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
   * **Example** (JSON-only string field)
   *
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
   * Transform variant schemas inside an existing field using per-variant mappers.
   *
   * **Example** (Empty fieldEvolve mappers)
   *
   * ```ts
   * import * as Model from "@beep/schema/Model"
   *
   * const makeOptional = Model.fieldEvolve({})
   * console.log(makeOptional)
   * ```
   *
   * @category mapping
   * @since 0.0.0
   */
  fieldEvolve,
  /**
   * Create a raw variant struct without producing a class.
   *
   * **Example** (Empty variant struct)
   *
   * ```ts
   * import * as Model from "@beep/schema/Model"
   *
   * const groupFields = Model.Struct({})
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
   * **Example** (Tagged A and B union)
   *
   * ```ts
   * import * as S from "effect/Schema"
   * import * as Model from "@beep/schema/Model"
   *
   * const a = Model.Struct({ _tag: S.tag("A"), value: S.String })
   * const b = Model.Struct({ _tag: S.tag("B"), count: S.Finite })
   * const AB = Model.Union([a, b])
   * console.log(AB)
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  Union,
};

/**
 * Extract the raw variant field record from a variant struct.
 *
 * **Example** (Raw fields from struct)
 *
 * ```ts
 * import * as Model from "@beep/schema/Model"
 *
 * const s = Model.Struct({})
 *
 * const raw = Model.fields(s)
 * console.log(raw)
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const fields: <A extends VariantSchema.Struct<TUnsafe.Any>>(self: A) => A[typeof VariantSchema.TypeId] =
  VariantSchema.fields;

/**
 * Wrap a value so it overrides the default generated by an {@link Overridable} field.
 *
 * **Example** (Group class with Override)
 *
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
 * @category constructors
 * @since 0.0.0
 */
export const Override: <A>(value: A) => A & Brand<"Override"> = VariantSchema.Override;

/**
 * Schema whose constructor can supply a generated default unless callers pass
 * {@link Override}.
 *
 * **Example** (Overridable name default)
 *
 * ```ts
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import * as Model from "@beep/schema/Model"
 *
 * const Name = Model.Overridable(S.String, { defaultValue: Effect.succeed("anonymous") })
 * console.log(S.isSchema(Name))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export interface Overridable<S extends S.Top & S.WithoutConstructorDefault> extends VariantSchema.Overridable<S> {}

/**
 * Upstream-compatible spelling for {@link Overridable}.
 *
 * **Example** (Overrideable name default)
 *
 * ```ts
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import * as Model from "@beep/schema/Model"
 *
 * const Name = Model.Overrideable(S.String, { defaultValue: Effect.succeed("anonymous") })
 * console.log(S.isSchema(Name))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export interface Overrideable<S extends S.Top & S.WithoutConstructorDefault> extends VariantSchema.Overridable<S> {}

/**
 * Build an `Overridable` schema that falls back to `defaultValue` during
 * constructor creation.
 *
 * **Example** (Overridable name default)
 *
 * ```ts
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import * as Model from "@beep/schema/Model"
 *
 * const Name = Model.Overridable(S.String, { defaultValue: Effect.succeed("anonymous") })
 * console.log(S.isSchema(Name))
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const Overridable: typeof VariantSchema.Overridable = VariantSchema.Overridable;

/**
 * Upstream-compatible spelling for {@link Overridable}.
 *
 * **Example** (Overrideable name default)
 *
 * ```ts
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import * as Model from "@beep/schema/Model"
 *
 * const Name = Model.Overrideable(S.String, { defaultValue: Effect.succeed("anonymous") })
 * console.log(S.isSchema(Name))
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const Overrideable: typeof Overridable = Overridable;
