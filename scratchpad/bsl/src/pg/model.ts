/**
 * The @beep/effect-drizzle model class factory.
 *
 * `class User extends EffectDrizzle.Model<User>($I\`User\`)({ ... }) {}` produces an
 * Effect schema class (via @beep/effect-drizzle's own `VariantSchema.make` instance — the same
 * six variants as effect's `Model`, so `SqlModel.makeRepository` compatibility
 * stays structural) with `sql` statics carrying the resolved SQL metadata.
 *
 * Whole-model invariants are enforced twice, at different altitudes:
 * - compile time: the `fields` parameter intersects `ValidateFields<F>`, so an
 *   underivable column or a second primary key fails on the offending key with
 *   a `~effect-drizzle.error` message literal;
 * - construction time: runtime checks mirror the same rules (nullable PK,
 *   multiple PKs) as tagged errors, catching hand-built field nodes.
 */
import { findFirst, last as lastArray, reduce } from "effect/Array";
import {
  fromUndefinedOr,
  getOrElse,
  getOrUndefined,
  isSome,
  match,
  none,
  orElse,
  some,
} from "effect/Option";
import { isFunction, isNotUndefined } from "effect/Predicate";
import { empty, set } from "effect/Record";
import { optionalKey } from "effect/Schema";
import type { Annotations, Struct as StructSchema, Top } from "effect/Schema";
import { split } from "effect/String";
import { VariantSchema } from "effect/unstable/schema";
import { snakeCase } from "../internal/case.ts";
import { withStatics } from "../internal/statics.ts";
import { factory as V, type Variant } from "../core/variant.ts";
import * as Derive from "./derive.ts";
import * as Field from "../core/Field.ts";
import * as Meta from "../core/Meta.ts";
import { type AnyModel as CoreAnyModel, ModelInvariantError } from "../core/model.ts";
import * as PgColumn from "./Column.ts";
import type * as TableExtras from "./extras.ts";

/**
 * Error raised when resolved model metadata violates a @beep/effect-drizzle invariant.
 *
 * **Example** (Construct a model invariant error)
 *
 * ```ts
 * import { ModelInvariantError } from "./model.ts"
 *
 * const error = ModelInvariantError.make({ message: "invalid primary key", fieldName: "id" })
 * console.log(error._tag) // "ModelInvariantError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export { ModelInvariantError };

/**
 * Fixed @beep/effect-drizzle model-variant domain.
 *
 * **Example** (Check a model variant)
 *
 * ```ts
 * import { Variant } from "./model.ts"
 *
 * console.log(Variant.is.select("select")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export {
  extract,
  FieldExcept,
  FieldOnly,
  fieldEvolve,
  Variant,
  VariantField,
  variants,
} from "../core/variant.ts";

/**
 * String-keyed field declaration accepted by the @beep/effect-drizzle model factory.
 *
 * **Example** (Declare a field record)
 *
 * ```ts
 * import { String } from "effect/Schema"
 * import type { FieldsInput } from "./model.ts"
 *
 * const fields: FieldsInput = { name: String }
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface FieldsInput {
  readonly [key: string]: Field.Input;
}

// ---------------------------------------------------------------------------
// Resolved metadata (explicit meta + derivation + EntityId auto-references)
// ---------------------------------------------------------------------------

type AutoRef<I extends Field.Input> = Field.MetaFrom<I>["references"] extends Meta.References
  ? Field.MetaFrom<I>["references"]
  : Field.MetaFrom<I>["primaryKey"] extends true
    ? undefined
    : Derive.SelectSchemaOf<Field.SchemaFrom<I>> extends Derive.EntityIdLike & {
          readonly tableName: infer TableName extends string;
        }
      ? [Exclude<Field.EncodedOf<I>, null>] extends [number]
        ? Meta.References<TableName, "id">
        : undefined
      : undefined;

/**
 * Metadata after column derivation and automatic reference resolution.
 *
 * @category models
 * @since 0.0.0
 */
export type ResolvedMetaOf<I extends Field.Input, Key extends string = string> = Meta.Merge<
  Field.MetaFrom<I>,
  {
    readonly column: PgColumn.ResolveName<Derive.ResolvedColumn<I>, Key>;
    readonly references: AutoRef<I>;
  }
>;

/**
 * Key-preserving resolved metadata record for a field declaration.
 *
 * @category models
 * @since 0.0.0
 */
export type ColumnsOf<F extends FieldsInput> = {
  readonly [K in keyof F]: ResolvedMetaOf<F[K], K & string>;
};

type PlainVariants<Sch extends Top, M extends Meta.Meta> = M["version"] extends true
  ? VariantSchema.Field<{
      readonly select: Sch;
      readonly insert: optionalKey<Sch>;
      readonly update: Sch;
      readonly json: Sch;
      readonly jsonCreate: Sch;
      readonly jsonUpdate: Sch;
    }>
  : M["generated"] extends false
    ? VariantSchema.Field<{
        readonly select: Sch;
        readonly insert: M["hasDefault"] extends true ? optionalKey<Sch> : Sch;
        readonly update: optionalKey<Sch>;
        readonly json: Sch;
        readonly jsonCreate: Sch;
        readonly jsonUpdate: Sch;
      }>
    : M["generated"] extends Meta.GeneratedIdentityAlways
      ? VariantSchema.Field<{
          readonly select: Sch;
          readonly update: Sch;
          readonly json: Sch;
        }>
      : VariantSchema.Field<{
          readonly select: Sch;
          readonly json: Sch;
        }>;

/**
 * Variant-aware schema after applying @beep/effect-drizzle's default and generated truth table.
 *
 * @category models
 * @since 0.0.0
 */
export type EffectiveSchema<I extends Field.Input> =
  Field.SchemaFrom<I> extends VariantSchema.Field.Any
    ? Field.SchemaFrom<I>
    : Field.SchemaFrom<I> extends Top
      ? PlainVariants<Field.SchemaFrom<I>, ResolvedMetaOf<I>>
      : never;

/**
 * Effective variant-aware schema record derived from a @beep/effect-drizzle field record.
 *
 * **Example** (Unwrap model fields)
 *
 * ```ts
 * import { String } from "effect/Schema"
 * import type { UnwrappedFields } from "./model.ts"
 *
 * type Fields = UnwrappedFields<{ readonly name: typeof String }>
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type UnwrappedFields<F extends FieldsInput> = {
  readonly [K in keyof F]: EffectiveSchema<F[K]>;
};

// ---------------------------------------------------------------------------
// Compile-time model validation (intersection validator)
// ---------------------------------------------------------------------------

type IsUnionInner<T, U> = T extends unknown ? ([U] extends [T] ? false : true) : never;
type IsUnion<T> = [T] extends [never] ? false : true extends IsUnionInner<T, T> ? true : false;

type PrimaryKeyKeys<F extends FieldsInput> = {
  [K in keyof F]: Field.MetaFrom<F[K]>["primaryKey"] extends true ? K : never;
}[keyof F];

type VersionKeys<F extends FieldsInput> = {
  [K in keyof F]: Field.MetaFrom<F[K]>["version"] extends true ? K : never;
}[keyof F];

type ValidateVersionField<I extends Field.Input> = Field.Input extends I
  ? unknown
  : Field.MetaFrom<I>["version"] extends true
  ? Field.MetaFrom<I>["dimensions"] extends 0
    ? Field.MetaFrom<I>["column"] extends {
        readonly kind: PgColumn.IdentityKind;
      }
      ? Field.MetaFrom<I>["generated"] extends false
        ? Field.MetaFrom<I>["identity"] extends false
          ? unknown
          : Field.SqlTypeError<"version fields cannot use identity generation">
        : Field.SqlTypeError<"version fields cannot be generated">
      : Field.SqlTypeError<"version fields require an explicit integer-family column">
    : Field.SqlTypeError<"array fields cannot be optimistic versions">
  : unknown;

type ValidateArrayField<I extends Field.Input> = Field.Input extends I
  ? unknown
  : Field.MetaFrom<I>["dimensions"] extends 0
  ? unknown
  : Field.MetaFrom<I>["primaryKey"] extends true
    ? Field.SqlTypeError<"array fields cannot be primary keys">
    : Field.MetaFrom<I>["identity"] extends false
      ? Field.MetaFrom<I>["version"] extends false
        ? unknown
        : Field.SqlTypeError<"array fields cannot be optimistic versions">
      : Field.SqlTypeError<"array fields cannot use identity generation">;

type ValidateSpecFamily<I extends Field.Input> = Exclude<
  Field.MetaFrom<I>["column"],
  undefined
> extends { readonly dialect: infer Dialect }
  ? string extends Dialect
    ? unknown
    : Dialect extends "pg"
      ? unknown
      : Field.SqlTypeError<"field carries a non-PostgreSQL column descriptor">
  : unknown;

type ValidateResolvedColumn<I extends Field.Input> = Field.Input extends I
  ? unknown
  : [Derive.ResolvedColumn<I>] extends [never]
    ? Field.SqlTypeError<"this field's encoded type does not derive a column — add explicit metadata (pg.integer, pg.timestamp, pg.bytea, ...)">
    : unknown;

/**
 * Per-key and whole-model compile-time validation for a field record.
 *
 * **Details**
 *
 * Success resolves each key to `unknown`; a violation resolves to a
 * `SqlTypeError` whose literal message appears on the offending key.
 *
 * **Example** (Validate a model field record)
 *
 * ```ts
 * import { String } from "effect/Schema"
 * import type { ValidateFields } from "./model.ts"
 *
 * type Valid = ValidateFields<{ readonly name: typeof String }>
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export type ValidateFields<F extends FieldsInput> = {
  readonly [K in keyof F]: ValidateSpecFamily<F[K]> &
    ValidateResolvedColumn<F[K]> &
    ValidateVersionField<F[K]> &
    ValidateArrayField<F[K]>;
} & (IsUnion<PrimaryKeyKeys<F>> extends true
  ? Field.SqlTypeError<"model declares multiple inline primary keys — use Table.compositePrimaryKey in the extras callback">
  : unknown) &
  (IsUnion<VersionKeys<F>> extends true
    ? Field.SqlTypeError<"model declares multiple optimistic-version fields">
    : unknown);

// ---------------------------------------------------------------------------
// The class type
// ---------------------------------------------------------------------------

/**
 * Compile-time diagnostic returned when {@link Model} omits its self type.
 *
 * **Example** (Inspect the diagnostic)
 *
 * ```ts
 * import type { MissingSelfGeneric } from "./model.ts"
 *
 * declare const diagnostic: MissingSelfGeneric
 * console.log(diagnostic)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export type MissingSelfGeneric =
  `Missing \`Self\` generic — use \`class Self extends EffectDrizzle.Model<Self>(identifier)({ ... }) {}\``;

/**
 * @beep/effect-drizzle metadata statics attached to every generated model class.
 *
 * **Example** (Read model statics)
 *
 * ```ts
 * import type { FieldsInput, Statics } from "./model.ts"
 *
 * declare const model: Statics<FieldsInput>
 * console.log(model.sql.tableName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface Statics<F extends FieldsInput> {
  readonly sql: {
    readonly tableName: string;
    readonly fields: F;
    readonly columns: ColumnsOf<F>;
    readonly extras: TableExtras.Callback<F> | undefined;
  };
}

/**
 * Complete Effect variant class plus the @beep/effect-drizzle statics for a field record.
 *
 * **Example** (Name a generated model type)
 *
 * ```ts
 * import type { FieldsInput, ModelClass } from "./model.ts"
 *
 * type Generated = ModelClass<object, FieldsInput>
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ModelClass<Self, F extends FieldsInput> = VariantSchema.Class<
  Self,
  UnwrappedFields<F>,
  StructSchema<VariantSchema.ExtractFields<"select", UnwrappedFields<F>, true>>
> & {
  readonly [Va in Variant]: VariantSchema.Extract<Va, VariantSchema.Struct<UnwrappedFields<F>>>;
} & Statics<F>;

/**
 * Structural bound accepted by the table and cross-model projectors.
 *
 * **Example** (Accept any @beep/effect-drizzle model)
 *
 * ```ts
 * import type { AnyModel } from "./model.ts"
 *
 * const tableName = (model: AnyModel) => model.sql.tableName
 * console.log(tableName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface AnyModel extends CoreAnyModel {
  readonly sql: {
    readonly tableName: string;
    readonly fields: FieldsInput;
    readonly columns: Record<string, Meta.Meta<PgColumn.Spec>>;
    readonly extras: ((columns: never) => ReadonlyArray<TableExtras.Node>) | undefined;
  };
}

// ---------------------------------------------------------------------------
// Runtime factory
// ---------------------------------------------------------------------------

const deriveTableName = (identifier: string): string => {
  const last = getOrElse(lastArray(split(identifier, "/")), () => identifier);
  return snakeCase(last);
};

const resolveReferences = (
  meta: Meta.Meta,
  select: unknown,
  fieldName: string,
): Meta.References | undefined => {
  const explicit = fromUndefinedOr(meta.references);
  const derived =
    !meta.primaryKey && Derive.isEntityIdLike(select)
      ? some<Meta.References>({
          tableName: select.tableName,
          columnName: "id",
          onDelete: undefined,
          onUpdate: undefined,
        })
      : none<Meta.References>();
  const resolved = explicit.pipe(
    orElse(() => derived),
    getOrUndefined,
  );
  if (isNotUndefined(resolved) && !Meta.isReferences(resolved)) {
    throw ModelInvariantError.make({
      message: `Field '${fieldName}' has an invalid reference descriptor.`,
      fieldName,
    });
  }
  return resolved;
};

const effectiveSchema = (schema: Field.AnySchema, meta: Meta.Meta): Field.AnySchema => {
  if (meta.version) {
    const select = Derive.selectSchemaOf(schema);
    return V.Field({
      select,
      insert: optionalKey(select),
      update: select,
      json: select,
      jsonCreate: select,
      jsonUpdate: select,
    });
  }
  if (VariantSchema.isField(schema)) return schema;
  if (Meta.Generated.$is("identityAlways")(meta.generated)) {
    return V.Field({
      select: schema,
      update: schema,
      json: schema,
    });
  }
  if (meta.generated !== false) {
    return V.Field({
      select: schema,
      json: schema,
    });
  }
  return V.Field({
    select: schema,
    insert: meta.hasDefault ? optionalKey(schema) : schema,
    update: optionalKey(schema),
    json: schema,
    jsonCreate: schema,
    jsonUpdate: schema,
  });
};

/**
 * Build one @beep/effect-drizzle model class after its public factory has validated the field set.
 *
 * **Details**
 *
 * This is the shared runtime seam used by bare {@link Model} and kit-provided
 * entities. Runtime invariants remain authoritative when types are suppressed.
 *
 * @category constructors
 * @since 0.0.0
 */
export function makeModelClass<Self, const F extends FieldsInput>(
  identifier: string,
  fields: F,
  annotations: Annotations.Annotations | undefined,
  extras: TableExtras.Callback<F> | undefined,
): ModelClass<Self, F>;
export function makeModelClass(
  identifier: string,
  fields: FieldsInput,
  annotations: Annotations.Annotations | undefined,
  extras: TableExtras.Callback<FieldsInput> | undefined,
): object {
  const tableName = deriveTableName(identifier);
  const state = reduce(
    Object.entries(fields),
    {
      columns: empty<string, Meta.Meta<PgColumn.Spec>>(),
      primaryKeys: 0,
      versionFields: 0,
      schemaFields: empty<string, Field.AnySchema>(),
    },
    (state, [key, input]) => {
      const field = Field.from(input);
      const select = Derive.selectSchemaOf(field.schema);
      const classified = match(fromUndefinedOr(field.meta.column), {
        onNone: () => Derive.classify(field.schema, key),
        onSome: (column) => {
          if (!PgColumn.isSpec(column)) {
            throw ModelInvariantError.make({
              message: `Field '${key}' has an invalid or foreign PostgreSQL column descriptor.`,
              fieldName: key,
            });
          }
          return {
            column,
            nullable: Derive.isNullable(field.schema),
          };
        },
      });

      if (field.meta.primaryKey && classified.nullable) {
        throw ModelInvariantError.make({
          message: `Primary key '${key}' derives a nullable encoded representation.`,
          fieldName: key,
        });
      }
      if (
        field.meta.dimensions !== 0 &&
        (field.meta.primaryKey || field.meta.identity !== false || field.meta.version)
      ) {
        throw ModelInvariantError.make({
          message: `Array field '${key}' cannot use primary-key, identity, or version semantics.`,
          fieldName: key,
        });
      }
      if (field.meta.identity !== false && !PgColumn.isIdentityKind(classified.column.kind)) {
        throw ModelInvariantError.make({
          message: `Identity on '${key}' requires an integer-family column, got '${classified.column.kind}'.`,
          fieldName: key,
        });
      }
      if (
        field.meta.generated !== false &&
        (field.meta.hasDefault || isNotUndefined(field.meta.default))
      ) {
        throw ModelInvariantError.make({
          message: `Field '${key}' cannot be both defaulted and generated.`,
          fieldName: key,
        });
      }
      if (field.meta.version && !PgColumn.isIdentityKind(classified.column.kind)) {
        throw ModelInvariantError.make({
          message: `Version field '${key}' requires an integer-family column, got '${classified.column.kind}'.`,
          fieldName: key,
        });
      }
      if (field.meta.version && (field.meta.identity !== false || field.meta.generated !== false)) {
        throw ModelInvariantError.make({
          message: `Version field '${key}' cannot use identity or generated-column semantics.`,
          fieldName: key,
        });
      }
      const bounded = PgColumn.Spec.guards.varchar(classified.column)
        ? some({ kind: "varchar", length: classified.column.length })
        : PgColumn.Spec.guards.char(classified.column)
          ? some({ kind: "char", length: classified.column.length })
          : none<{ readonly kind: string; readonly length: number }>();
      if (isSome(bounded)) {
        const incompatible = findFirst(
          Derive.maxLengths(field.schema),
          (maxLength) => maxLength > bounded.value.length,
        );
        if (isSome(incompatible)) {
          throw ModelInvariantError.make({
            message: `${bounded.value.kind}(${bounded.value.length}) on '${key}' is narrower than schema maxLength ${incompatible.value}.`,
            fieldName: key,
          });
        }
      }
      const resolvedMeta = Meta.merge(field.meta, {
        column: PgColumn.resolveName(classified.column, key),
        references: resolveReferences(field.meta, select, key),
      });
      return {
        columns: set(state.columns, key, resolvedMeta),
        primaryKeys: state.primaryKeys + (field.meta.primaryKey ? 1 : 0),
        versionFields: state.versionFields + (field.meta.version ? 1 : 0),
        schemaFields: set(state.schemaFields, key, effectiveSchema(field.schema, resolvedMeta)),
      };
    },
  );

  if (state.primaryKeys > 1) {
    throw ModelInvariantError.make({
      message: `Model '${identifier}' declares ${state.primaryKeys} inline primary keys; use Table.compositePrimaryKey in the extras callback.`,
      fieldName: "(model)",
    });
  }

  if (state.versionFields > 1) {
    throw ModelInvariantError.make({
      message: `Model '${identifier}' declares ${state.versionFields} optimistic-version fields; at most one is allowed.`,
      fieldName: "(model)",
    });
  }

  const Base = V.Class<object>(identifier)(state.schemaFields, annotations);
  return withStatics(Base, () => ({
    sql: { tableName, fields, columns: state.columns, extras },
  }));
}

/**
 * Build a variant-aware model class whose fields own their resolved SQL metadata.
 *
 * **Example** (Define a @beep/effect-drizzle model)
 *
 * ```ts
 * import { String } from "effect/Schema"
 * import { Model } from "./model.ts"
 *
 * class User extends Model<User>("User")({ name: String }) {}
 * console.log(User.sql.tableName) // "user"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export function Model<Self = never>(
  identifier: string,
): <const F extends FieldsInput>(
  fields: F & ValidateFields<F>,
  annotationsOrExtras?: Annotations.Annotations | TableExtras.Callback<F>,
) => [Self] extends [never] ? MissingSelfGeneric : ModelClass<Self, F>;
export function Model(identifier: string): unknown {
  return (
    fields: FieldsInput,
    annotationsOrExtras?: Annotations.Annotations | TableExtras.Callback<FieldsInput>,
  ): object => {
    const extras = isFunction(annotationsOrExtras) ? annotationsOrExtras : undefined;
    const annotations = isFunction(annotationsOrExtras) ? undefined : annotationsOrExtras;
    return makeModelClass(identifier, fields, annotations, extras);
  };
}
