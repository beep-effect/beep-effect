/** Variant-aware SQLite model factory with dialect-family validation. */
import { reduce } from "effect/Array";
import {
  fromUndefinedOr,
  getOrElse,
  getOrUndefined,
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
import { last } from "effect/Array";
import { VariantSchema } from "effect/unstable/schema";
import * as Field from "../core/Field.ts";
import * as Meta from "../core/Meta.ts";
import { type AnyModel as CoreAnyModel, ModelInvariantError } from "../core/model.ts";
import { factory as V, type Variant } from "../core/variant.ts";
import { snakeCase } from "../internal/case.ts";
import { withStatics } from "../internal/statics.ts";
import * as SqliteColumn from "./Column.ts";
import * as Derive from "./derive.ts";
import type * as TableExtras from "./extras.ts";

export { ModelInvariantError };
export {
  extract,
  FieldExcept,
  FieldOnly,
  fieldEvolve,
  Variant,
  VariantField,
  variants,
} from "../core/variant.ts";

/** String-keyed SQLite field declarations. */
export interface FieldsInput {
  readonly [key: string]: Field.Input;
}

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

/** Metadata after SQLite derivation and automatic EntityId references. */
export type ResolvedMetaOf<I extends Field.Input> = Meta.Merge<
  Field.MetaFrom<I>,
  { readonly column: Derive.ResolvedColumn<I>; readonly references: AutoRef<I> }
>;

/** Resolved SQLite metadata for every declared field. */
export type ColumnsOf<F extends FieldsInput> = {
  readonly [K in keyof F]: ResolvedMetaOf<F[K]>;
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
      ? VariantSchema.Field<{ readonly select: Sch; readonly update: Sch; readonly json: Sch }>
      : VariantSchema.Field<{ readonly select: Sch; readonly json: Sch }>;

/** Effective model schema after the common write-strategy truth table. */
export type EffectiveSchema<I extends Field.Input> =
  Field.SchemaFrom<I> extends VariantSchema.Field.Any
    ? Field.SchemaFrom<I>
    : Field.SchemaFrom<I> extends Top
      ? PlainVariants<Field.SchemaFrom<I>, ResolvedMetaOf<I>>
      : never;

export type UnwrappedFields<F extends FieldsInput> = {
  readonly [K in keyof F]: EffectiveSchema<F[K]>;
};

type IsUnionInner<T, U> = T extends unknown ? ([U] extends [T] ? false : true) : never;
type IsUnion<T> = [T] extends [never] ? false : true extends IsUnionInner<T, T> ? true : false;
type PrimaryKeyKeys<F extends FieldsInput> = {
  [K in keyof F]: Field.MetaFrom<F[K]>["primaryKey"] extends true ? K : never;
}[keyof F];
type VersionKeys<F extends FieldsInput> = {
  [K in keyof F]: Field.MetaFrom<F[K]>["version"] extends true ? K : never;
}[keyof F];

type ValidateSpecFamily<I extends Field.Input> = Exclude<
  Field.MetaFrom<I>["column"],
  undefined
> extends { readonly dialect: infer Dialect }
  ? string extends Dialect
    ? unknown
    : Dialect extends "sqlite"
      ? unknown
      : Field.SqlTypeError<"field carries a non-SQLite column descriptor">
  : unknown;
type ValidateDimensions<I extends Field.Input> = Field.MetaFrom<I>["dimensions"] extends 0
  ? unknown
  : Field.SqlTypeError<"SQLite has no array columns; dimensions must be zero">;
type ValidateVersion<I extends Field.Input> = Field.MetaFrom<I>["version"] extends true
  ? Field.MetaFrom<I>["column"] extends SqliteColumn.Integer<"number">
    ? Field.MetaFrom<I>["identity"] extends false
      ? Field.MetaFrom<I>["generated"] extends false
        ? unknown
        : Field.SqlTypeError<"version fields cannot be generated">
      : Field.SqlTypeError<"version fields cannot use db-assigned keys">
    : Field.SqlTypeError<"version fields require sqlite.integer number mode">
  : unknown;
type ValidateResolvedColumn<I extends Field.Input> = Field.Input extends I
  ? unknown
  : [Derive.ResolvedColumn<I>] extends [never]
    ? Field.SqlTypeError<"this field's encoded type does not derive a SQLite column — add explicit sqlite metadata">
    : unknown;

/** Per-key and whole-model SQLite validation. */
export type ValidateFields<F extends FieldsInput> = {
  readonly [K in keyof F]: ValidateSpecFamily<F[K]> &
    ValidateDimensions<F[K]> &
    ValidateResolvedColumn<F[K]> &
    ValidateVersion<F[K]>;
} & (IsUnion<PrimaryKeyKeys<F>> extends true
  ? Field.SqlTypeError<"model declares multiple inline primary keys — use Table.compositePrimaryKey">
  : unknown) & (IsUnion<VersionKeys<F>> extends true
  ? Field.SqlTypeError<"model declares multiple optimistic-version fields">
  : unknown);

/** Diagnostic returned when Model omits its self type. */
export type MissingSelfGeneric =
  "Missing `Self` generic — use `class Self extends sqlite.Model<Self>(identifier)({ ... }) {}`";

/** SQLite metadata statics attached to every generated model. */
export interface Statics<F extends FieldsInput> {
  readonly sql: {
    readonly tableName: string;
    readonly fields: F;
    readonly columns: ColumnsOf<F>;
    readonly extras: TableExtras.Callback<F> | undefined;
  };
}

/** Complete SQLite model class. */
export type ModelClass<Self, F extends FieldsInput> = VariantSchema.Class<
  Self,
  UnwrappedFields<F>,
  StructSchema<VariantSchema.ExtractFields<"select", UnwrappedFields<F>, true>>
> & { readonly [Va in Variant]: VariantSchema.Extract<Va, VariantSchema.Struct<UnwrappedFields<F>>> } &
  Statics<F>;

/** Structural bound accepted by SQLite projectors and assembly. */
export interface AnyModel extends CoreAnyModel {
  readonly sql: {
    readonly tableName: string;
    readonly fields: FieldsInput;
    readonly columns: Record<string, Meta.Meta<SqliteColumn.Spec>>;
    readonly extras: ((columns: never) => ReadonlyArray<TableExtras.Node>) | undefined;
  };
}

const deriveTableName = (identifier: string): string =>
  snakeCase(getOrElse(last(split(identifier, "/")), () => identifier));

const resolveReferences = (
  meta: Meta.Meta,
  select: unknown,
  fieldName: string,
): Meta.References | undefined => {
  const derived = !meta.primaryKey && Derive.isEntityIdLike(select)
    ? some<Meta.References>({
        tableName: select.tableName,
        columnName: "id",
        onDelete: undefined,
        onUpdate: undefined,
      })
    : none<Meta.References>();
  const resolved = fromUndefinedOr(meta.references).pipe(orElse(() => derived), getOrUndefined);
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
    return V.Field({ select: schema, update: schema, json: schema });
  }
  if (meta.generated !== false) return V.Field({ select: schema, json: schema });
  return V.Field({
    select: schema,
    insert: meta.hasDefault ? optionalKey(schema) : schema,
    update: optionalKey(schema),
    json: schema,
    jsonCreate: schema,
    jsonUpdate: schema,
  });
};

/** Shared runtime seam used by bare SQLite models and SQLite kit entities. */
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
      columns: empty<string, Meta.Meta<SqliteColumn.Spec>>(),
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
          if (!SqliteColumn.isSpec(column)) {
            throw ModelInvariantError.make({
              message: `Field '${key}' has an invalid or foreign SQLite column descriptor.`,
              fieldName: key,
            });
          }
          return { column, nullable: Derive.isNullable(field.schema) };
        },
      });
      if (field.meta.dimensions !== 0) {
        throw ModelInvariantError.make({
          message: `SQLite field '${key}' cannot carry array dimensions.`,
          fieldName: key,
        });
      }
      if (field.meta.primaryKey && classified.nullable) {
        throw ModelInvariantError.make({
          message: `Primary key '${key}' derives a nullable encoded representation.`,
          fieldName: key,
        });
      }
      if (
        field.meta.identity !== false &&
        (field.meta.identity !== "byDefault" ||
          !SqliteColumn.Spec.guards.integer(classified.column) ||
          classified.column.mode !== "number" ||
          !field.meta.primaryKey)
      ) {
        throw ModelInvariantError.make({
          message: `SQLite db-assigned key '${key}' must be a number-mode INTEGER PRIMARY KEY.`,
          fieldName: key,
        });
      }
      if (field.meta.generated !== false && (field.meta.hasDefault || isNotUndefined(field.meta.default))) {
        throw ModelInvariantError.make({
          message: `Field '${key}' cannot be both defaulted and generated.`,
          fieldName: key,
        });
      }
      if (
        field.meta.version &&
        (!SqliteColumn.Spec.guards.integer(classified.column) || classified.column.mode !== "number")
      ) {
        throw ModelInvariantError.make({
          message: `Version field '${key}' requires sqlite.integer number mode.`,
          fieldName: key,
        });
      }
      if (field.meta.version && (field.meta.identity !== false || field.meta.generated !== false)) {
        throw ModelInvariantError.make({
          message: `Version field '${key}' cannot use identity or generated-column semantics.`,
          fieldName: key,
        });
      }
      const resolved = Meta.merge(field.meta, {
        column: classified.column,
        references: resolveReferences(field.meta, select, key),
      });
      return {
        columns: set(state.columns, key, resolved),
        primaryKeys: state.primaryKeys + (field.meta.primaryKey ? 1 : 0),
        versionFields: state.versionFields + (field.meta.version ? 1 : 0),
        schemaFields: set(state.schemaFields, key, effectiveSchema(field.schema, resolved)),
      };
    },
  );
  if (state.primaryKeys > 1) {
    throw ModelInvariantError.make({
      message: `Model '${identifier}' declares multiple inline primary keys.`,
      fieldName: "(model)",
    });
  }
  if (state.versionFields > 1) {
    throw ModelInvariantError.make({
      message: `Model '${identifier}' declares multiple optimistic-version fields.`,
      fieldName: "(model)",
    });
  }
  const Base = V.Class<object>(identifier)(state.schemaFields, annotations);
  return withStatics(Base, () => ({ sql: { tableName, fields, columns: state.columns, extras } }));
}

/** Build a variant-aware SQLite model. */
export function Model<Self = never>(identifier: string): <const F extends FieldsInput>(
  fields: F & ValidateFields<F>,
  annotationsOrExtras?: Annotations.Annotations | TableExtras.Callback<F>,
) => [Self] extends [never] ? MissingSelfGeneric : ModelClass<Self, F>;
export function Model(identifier: string): unknown {
  return (
    fields: FieldsInput,
    annotationsOrExtras?: Annotations.Annotations | TableExtras.Callback<FieldsInput>,
  ): object => makeModelClass(
    identifier,
    fields,
    isFunction(annotationsOrExtras) ? undefined : annotationsOrExtras,
    isFunction(annotationsOrExtras) ? annotationsOrExtras : undefined,
  );
}
