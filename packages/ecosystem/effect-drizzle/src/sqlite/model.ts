/**
 * Builds SQLite-aware Effect model classes from schema-owned fields.
 *
 * Encoded carriers are classified into SQLite storage classes, then the same
 * metadata drives model variants, Drizzle projection, and relation assembly.
 *
 * @since 0.0.0
 */
// fallow-ignore-file code-duplication -- pg/sqlite are deliberately mirrored dialect implementations; shared logic lives in src/core and the remaining parallelism is per-dialect vocabulary that must evolve independently (doc 14 family; review at next dialect addition)
import { last, reduce } from "effect/Array";
import { dual } from "effect/Function";
import { fromUndefinedOr, getOrElse, getOrUndefined, match, none, orElse, some } from "effect/Option";
import { isFunction, isNotUndefined, isNumber, isString, isUint8Array } from "effect/Predicate";
import { empty, set } from "effect/Record";
import { Finite, flip, is, makeFilter, optionalKey } from "effect/Schema";
import { split } from "effect/String";
import { VariantSchema } from "effect/unstable/schema";
import * as Field from "../core/Field.ts";
import * as Meta from "../core/Meta.ts";
import { ModelInvariantError } from "../core/model.ts";
import { assertSqlName, assertUniqueSqlNames } from "../core/names.ts";
import { factory as V } from "../core/variant.ts";
import { snakeCase } from "../internal/case.ts";
import { withStatics } from "../internal/statics.ts";
import * as SqliteColumn from "./Column.ts";
import * as Derive from "./derive.ts";
import * as TableExtras from "./extras.ts";
import type { Annotations, Struct as StructSchema, Top } from "effect/Schema";
import type { AnyModel as CoreAnyModel } from "../core/model.ts";
import type { ValidateDerivedSqlName, ValidateSqlName } from "../core/names.ts";
import type { Variant } from "../core/variant.ts";

/** Shared variant helpers exposed by the SQLite model surface.
 * @category models
 * @since 0.0.0
 */
export {
  extract,
  FieldExcept,
  FieldOnly,
  fieldEvolve,
  Variant,
  VariantField,
} from "../core/variant.ts";
/** Internal dialect re-export of the shared model invariant error.
 * @internal
 * @category errors
 * @since 0.0.0
 */
export { ModelInvariantError };

/**
 * Describes the string-keyed field record accepted by SQLite {@link Model}.
 *
 * **Details**
 *
 * Each property is either an Effect schema or a field carrying SQLite metadata.
 *
 * **Example** (Describe SQLite fields)
 *
 * ```ts
 * import { String } from "effect/Schema"
 * import type { FieldsInput } from "@beep/effect-drizzle/sqlite"
 *
 * type UserFields = { readonly name: typeof String }
 * type Accepted = UserFields extends FieldsInput ? true : false // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
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

/** Metadata exposed after SQLite derivation and automatic EntityId references. */
type ResolvedMetaOf<I extends Field.Input> = Meta.Merge<
  Field.MetaFrom<I>,
  { readonly column: Derive.ResolvedColumn<I>; readonly references: AutoRef<I> }
>;

/**
 * Projects every declared field to its resolved SQLite metadata.
 *
 * **Details**
 *
 * Explicit metadata, storage-class derivation, and EntityId references merge
 * without losing field keys.
 *
 * **Example** (Project SQLite field metadata)
 *
 * ```ts
 * import { String } from "effect/Schema"
 * import type { ColumnsOf } from "@beep/effect-drizzle/sqlite"
 *
 * type Columns = ColumnsOf<{ readonly displayName: typeof String }>
 * type Column = Columns["displayName"]["column"] // => SQLite text descriptor
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
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
        readonly insert: M["hasDefault"] extends true
          ? optionalKey<Sch>
          : M["primaryKey"] extends true
            ? M["column"] extends SqliteColumn.Integer<"number">
              ? optionalKey<Sch>
              : Sch
            : Sch;
        readonly update: optionalKey<Sch>;
        readonly json: Sch;
        readonly jsonCreate: Sch;
        readonly jsonUpdate: Sch;
      }>
    : M["generated"] extends Meta.GeneratedIdentityAlways
      ? VariantSchema.Field<{ readonly select: Sch; readonly update: Sch; readonly json: Sch }>
      : VariantSchema.Field<{ readonly select: Sch; readonly json: Sch }>;

/**
 * Applies SQL write strategy to a SQLite field's six model variants.
 *
 * **Details**
 *
 * Defaults make inserts optional, generated expressions are read-only,
 * identity row locators remain available on update, and optimistic versions
 * are required on update.
 *
 * **Gotchas**
 *
 * Update membership for a database-assigned id is locator policy, not permission
 * to modify the primary key. Explicit variant fields keep their own membership.
 *
 * **Example** (Infer SQLite update membership)
 *
 * ```ts
 * import { String } from "effect/Schema"
 * import type { EffectiveSchema } from "@beep/effect-drizzle/sqlite"
 *
 * type NameField = EffectiveSchema<typeof String>
 * type Update = NameField["schemas"]["update"] // => optional String schema
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type EffectiveSchema<I extends Field.Input> =
  Field.SchemaFrom<I> extends VariantSchema.Field.Any
    ? Field.SchemaFrom<I>
    : Field.SchemaFrom<I> extends Top
      ? PlainVariants<Field.SchemaFrom<I>, ResolvedMetaOf<I>>
      : never;

/** Variant-aware schema record exposed by SQLite model inference. */
type UnwrappedFields<F extends FieldsInput> = {
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

type ValidateSpecFamily<I extends Field.Input> =
  Exclude<Field.MetaFrom<I>["column"], undefined> extends { readonly dialect: infer Dialect }
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
  ? null extends Field.EncodedOf<I>
    ? Field.SqlTypeError<"version fields cannot be nullable">
    : Field.MetaFrom<I>["column"] extends SqliteColumn.Integer<"number">
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

/**
 * Validates per-field and whole-model SQLite invariants at compile time.
 *
 * **Details**
 *
 * Accepted keys reduce to `unknown`. Rejections carry a readable
 * `~effect-drizzle.error` on the offending key or complete model.
 *
 * **Gotchas**
 *
 * SQLite rejects every array dimension and every descriptor from another
 * dialect; those constraints are part of the type result, not runtime flags.
 *
 * **Example** (Inspect SQLite validation results)
 *
 * ```ts
 * import { Date as DateSchema, String } from "effect/Schema"
 * import type { ValidateFields } from "@beep/effect-drizzle/sqlite"
 *
 * type Accepted = ValidateFields<{ readonly name: typeof String }>
 * // => { readonly name: unknown }
 *
 * type Rejected = ValidateFields<{ readonly createdAt: typeof DateSchema }>
 * // => createdAt carries ~effect-drizzle.error:
 * // "this field's encoded type does not derive a SQLite column — add explicit sqlite metadata"
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export type ValidateFields<F extends FieldsInput> = {
  readonly [K in keyof F]: ValidateSpecFamily<F[K]> &
    ValidateDimensions<F[K]> &
    ValidateResolvedColumn<F[K]> &
    ValidateVersion<F[K]> &
    ValidateSqlName<Lowercase<K & string>, "model field derives an invalid SQLite column name">;
} & (IsUnion<PrimaryKeyKeys<F>> extends true
  ? Field.SqlTypeError<"model declares multiple inline primary keys — use Table.compositePrimaryKey">
  : unknown) &
  (IsUnion<VersionKeys<F>> extends true
    ? Field.SqlTypeError<"model declares multiple optimistic-version fields">
    : unknown);

/**
 * Diagnostic returned when Model omits its self type.
 *
 * @category validation
 * @since 0.0.0
 */
export type MissingSelfGeneric =
  "Missing `Self` generic — use `class Self extends sqlite.Model<Self>(identifier)({ ... }) {}`";

/**
 * Captures SQLite metadata statics attached to every generated model.
 *
 * **Details**
 *
 * `sql` retains the table name, original fields, resolved columns, and optional
 * extras callback used by projection and assembly.
 *
 * **Example** (Inspect static field types)
 *
 * ```ts
 * import { String } from "effect/Schema"
 * import type { Statics } from "@beep/effect-drizzle/sqlite"
 *
 * type UserStatics = Statics<{ readonly name: typeof String }>
 * type Fields = UserStatics["sql"]["fields"]
 * // => { readonly name: typeof String }
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
 * Combines an Effect variant class with resolved SQLite statics.
 *
 * **Details**
 *
 * The constructor represents selected rows and the six operation schemas are
 * exposed as statics beside the SQL metadata.
 *
 * **Example** (Name a SQLite model class)
 *
 * ```ts
 * import { String } from "effect/Schema"
 * import type { ModelClass } from "@beep/effect-drizzle/sqlite"
 *
 * interface User { readonly name: string }
 * type Generated = ModelClass<User, { readonly name: typeof String }>
 * type Insert = Generated["insert"]["Type"] // => { readonly name: string }
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ModelClass<Self, F extends FieldsInput> = VariantSchema.Class<
  Self,
  UnwrappedFields<F>,
  StructSchema<VariantSchema.ExtractFields<"select", UnwrappedFields<F>, true>>
> & { readonly [Va in Variant]: VariantSchema.Extract<Va, VariantSchema.Struct<UnwrappedFields<F>>> } & Statics<F>;

/**
 * Structural model bound accepted by SQLite projectors and assembly.
 *
 * **When to use**
 *
 * Use as a generic constraint when exact model fields do not need preservation.
 *
 * **Example** (Accept any SQLite model)
 *
 * ```ts
 * import { String } from "effect/Schema"
 * import { Model, type AnyModel } from "@beep/effect-drizzle/sqlite"
 *
 * const tableName = (model: AnyModel) => model.sql.tableName
 * class User extends Model<User>("User")({ name: String }) {}
 *
 * tableName(User) // => "user"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
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

const physicalColumnEntry = ([key, input]: [string, Field.Input]): readonly [string, string] => {
  const meta = Field.from(input).meta;
  return [key, getOrElse(fromUndefinedOr(meta.columnName), () => snakeCase(key))];
};

const validateModelNames = (tableName: string, fields: FieldsInput): void => {
  assertSqlName(tableName, "sqlite", "SQLite table name");
  assertUniqueSqlNames(Object.entries(fields).map(physicalColumnEntry), "sqlite", "SQLite column name");
};

const validateLiteralDefault = (field: Field.Any, select: Top, column: SqliteColumn.Spec, fieldName: string): void => {
  if (!Meta.Default.$is("value")(field.meta.default)) return;
  const value = field.meta.default.value;
  if (!is(flip(select))(value)) {
    throw ModelInvariantError.make({
      message: `Literal default for '${fieldName}' is rejected by the field's encoded schema.`,
      fieldName,
    });
  }
  if (isNumber(value) && !Number.isFinite(value)) {
    throw ModelInvariantError.make({
      message: `Literal default for '${fieldName}' must be a finite number.`,
      fieldName,
    });
  }
  if (isString(value) && value.includes("\0")) {
    throw ModelInvariantError.make({
      message: `Literal default for '${fieldName}' cannot contain NUL.`,
      fieldName,
    });
  }
  if (SqliteColumn.Spec.guards.blob(column) && column.mode === "buffer" && isUint8Array(value)) {
    throw ModelInvariantError.make({
      message: `BLOB literal defaults are not safely rendered; use unsafeDefaultSql for trusted SQL.`,
      fieldName,
    });
  }
};

const resolveReferences = (meta: Meta.Meta, select: unknown, fieldName: string): Meta.References | undefined => {
  const derived =
    !meta.primaryKey && Derive.isEntityIdLike(select)
      ? some<Meta.References>({
          tableName: select.tableName,
          columnName: "id",
          onDelete: undefined,
          onUpdate: undefined,
        })
      : none<Meta.References>();
  const resolved = fromUndefinedOr(meta.references).pipe(
    orElse(() => derived),
    getOrUndefined
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
    return V.Field({ select: schema, update: schema, json: schema });
  }
  if (meta.generated !== false) return V.Field({ select: schema, json: schema });
  const insertOptional =
    meta.hasDefault ||
    (meta.primaryKey &&
      meta.column !== undefined &&
      SqliteColumn.isSpec(meta.column) &&
      SqliteColumn.Spec.guards.integer(meta.column) &&
      meta.column.mode === "number");
  return V.Field({
    select: schema,
    insert: insertOptional ? optionalKey(schema) : schema,
    update: optionalKey(schema),
    json: schema,
    jsonCreate: schema,
    jsonUpdate: schema,
  });
};

const finiteRealSchema = (schema: Field.AnySchema): Field.AnySchema => {
  const accepts = is(Finite);
  const refine = (current: Top): Top =>
    flip(
      flip(current).check(
        makeFilter<unknown>((value) => value === null || accepts(value), {
          identifier: "@beep/effect-drizzle/SqliteRealDomain",
          title: "SQLite REAL domain",
          description: "Excludes non-finite numbers that bun:sqlite cannot bind faithfully.",
          message: "SQLite REAL requires a finite encoded number.",
        })
      )
    );
  return VariantSchema.isField(schema)
    ? V.fieldEvolve(schema, {
        select: refine,
        insert: refine,
        update: refine,
        json: refine,
        jsonCreate: refine,
        jsonUpdate: refine,
      })
    : refine(schema);
};

/**
 * Shared runtime seam used by bare SQLite models and SQLite kit entities.
 *
 * @internal
 * @category constructors
 * @since 0.0.0
 */
export const makeModelClass: {
  <Self, const F extends FieldsInput>(
    fields: F,
    annotations: Annotations.Annotations | undefined,
    extras: TableExtras.Callback<F> | undefined
  ): (identifier: string) => ModelClass<Self, F>;
  <Self, const F extends FieldsInput>(
    identifier: string,
    fields: F,
    annotations: Annotations.Annotations | undefined,
    extras: TableExtras.Callback<F> | undefined
  ): ModelClass<Self, F>;
} = dual(
  4,
  (
    identifier: string,
    fields: FieldsInput,
    annotations: Annotations.Annotations | undefined,
    extras: TableExtras.Callback<FieldsInput> | undefined
  ): object => {
    const tableName = deriveTableName(identifier);
    validateModelNames(tableName, fields);
    const fieldCount = Object.keys(fields).length;
    if (fieldCount === 0 || fieldCount > 2_000) {
      throw ModelInvariantError.make({
        message: `SQLite models require from 1 through 2,000 columns; '${identifier}' declares ${fieldCount}.`,
        fieldName: "(model)",
      });
    }
    const state = reduce(
      Object.entries(fields),
      {
        columns: empty<string, Meta.Meta<SqliteColumn.Spec>>(),
        primaryKeys: 0,
        versionFields: 0,
        ordinaryColumns: 0,
        schemaFields: empty<string, Field.AnySchema>(),
      },
      function collectSqliteModelState(state, [key, input]) {
        const field = Field.from(input);
        if (field.meta.version && VariantSchema.isField(field.schema)) {
          throw ModelInvariantError.make({
            message: `Version field '${key}' cannot use an explicit VariantSchema.Field.`,
            fieldName: key,
          });
        }
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
        if (
          ((SqliteColumn.Spec.guards.text(classified.column) && classified.column.mode === "json") ||
            (SqliteColumn.Spec.guards.blob(classified.column) && classified.column.mode === "json")) &&
          !Derive.isStructuralJson(field.schema)
        ) {
          throw ModelInvariantError.make({
            message: `SQLite JSON field '${key}' requires an array- or record-encoded schema.`,
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
        if (field.meta.version && classified.nullable) {
          throw ModelInvariantError.make({
            message: `Version field '${key}' cannot be nullable.`,
            fieldName: key,
          });
        }
        if (field.meta.version && (field.meta.identity !== false || field.meta.generated !== false)) {
          throw ModelInvariantError.make({
            message: `Version field '${key}' cannot use identity or generated-column semantics.`,
            fieldName: key,
          });
        }
        validateLiteralDefault(field, select, classified.column, key);
        const resolved = Meta.merge(field.meta, {
          column: classified.column,
          references: resolveReferences(field.meta, select, key),
        });
        const faithfulSchema = SqliteColumn.Spec.guards.real(classified.column)
          ? finiteRealSchema(field.schema)
          : field.schema;
        return {
          columns: set(state.columns, key, resolved),
          primaryKeys: state.primaryKeys + (field.meta.primaryKey ? 1 : 0),
          versionFields: state.versionFields + (field.meta.version ? 1 : 0),
          ordinaryColumns: state.ordinaryColumns + (field.meta.generated === false ? 1 : 0),
          schemaFields: set(state.schemaFields, key, effectiveSchema(faithfulSchema, resolved)),
        };
      }
    );
    if (state.primaryKeys > 1) {
      throw ModelInvariantError.make({
        message: `Model '${identifier}' declares multiple inline primary keys.`,
        fieldName: "(model)",
      });
    }
    if (state.ordinaryColumns === 0) {
      throw ModelInvariantError.make({
        message: `SQLite model '${identifier}' must declare at least one non-generated column.`,
        fieldName: "(model)",
      });
    }
    if (state.versionFields > 1) {
      throw ModelInvariantError.make({
        message: `Model '${identifier}' declares multiple optimistic-version fields.`,
        fieldName: "(model)",
      });
    }
    const harvested = Object.entries(state.columns).flatMap(
      ([key, meta]): ReadonlyArray<readonly [string, Meta.IndexIntent, string]> => {
        if (meta.indexed === false) return [];
        const intent = meta.indexed;
        const physical = getOrElse(fromUndefinedOr(meta.columnName), () => snakeCase(key));
        const name = getOrElse(
          fromUndefinedOr(intent.name),
          () => `${tableName}_${physical}_${intent.unique ? "unique_idx" : "btree_idx"}`
        );
        return [[key, intent, name]];
      }
    );
    if (harvested.length > 0) {
      assertUniqueSqlNames(
        harvested.map(([key, , name]): readonly [string, string] => [key, name]),
        "sqlite",
        "SQLite colocated index name"
      );
    }
    const composedExtras: TableExtras.Callback<FieldsInput> | undefined =
      harvested.length === 0
        ? extras
        : (columns) => [
            ...harvested.map(([key, intent, name]) =>
              intent.unique ? TableExtras.uniqueIndex(name, [columns[key]]) : TableExtras.index(name, [columns[key]])
            ),
            ...match(fromUndefinedOr(extras), {
              onNone: () => [],
              onSome: (callback) => callback(columns),
            }),
          ];
    const Base = V.Class<object>(identifier)(state.schemaFields, annotations);
    return withStatics(Base, () => ({ sql: { tableName, fields, columns: state.columns, extras: composedExtras } }));
  }
);

/**
 * Builds a SQLite model class whose schemas own resolved storage metadata.
 *
 * **When to use**
 *
 * Use when standalone SQLite models and tables opt out of kit defaults;
 * use a SQLite kit's `Entity` for invariant shared fields.
 *
 * **Details**
 *
 * The final identifier segment becomes a snake-case table name. The model
 * factory derives SQLite storage classes, variants, references, and table extras
 * from one field declaration.
 *
 * **Gotchas**
 *
 * SQLite has no array columns. Database-assigned keys must be number-mode
 * `INTEGER PRIMARY KEY`, and PostgreSQL descriptors are rejected.
 *
 * **Example** (Define a SQLite model)
 *
 * ```ts
 * import { String } from "effect/Schema"
 * import { Model } from "@beep/effect-drizzle/sqlite"
 *
 * class User extends Model<User>("User")({ name: String }) {}
 *
 * User.sql.tableName // => "user"
 * Object.keys(User.insert.fields) // => ["name"]
 * ```
 *
 * @see {@link ValidateFields} for SQLite model invariants.
 * @category factories
 * @since 0.0.0
 */
export function Model<Self = never, const Identifier extends string = string>(
  identifier: Identifier & ValidateDerivedSqlName<Identifier, "Model identifier derives an invalid SQLite table name">
): <const F extends FieldsInput>(
  fields: F & ValidateFields<F>,
  annotationsOrExtras?: Annotations.Annotations | TableExtras.Callback<F>
) => [Self] extends [never] ? MissingSelfGeneric : ModelClass<Self, F>;
export function Model(identifier: string): unknown {
  return (
    fields: FieldsInput,
    annotationsOrExtras?: Annotations.Annotations | TableExtras.Callback<FieldsInput>
  ): object =>
    makeModelClass(
      identifier,
      fields,
      isFunction(annotationsOrExtras) ? undefined : annotationsOrExtras,
      isFunction(annotationsOrExtras) ? annotationsOrExtras : undefined
    );
}
