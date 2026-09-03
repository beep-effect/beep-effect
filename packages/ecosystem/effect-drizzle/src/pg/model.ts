/**
 * Builds PostgreSQL-aware Effect model classes from schema-owned fields.
 *
 * `class User extends EffectDrizzle.Model<User>(identifier)(fields) {}` produces an
 * Effect schema class (via `@beep/effect-drizzle`'s own `VariantSchema.make` instance — the same
 * six variants as effect's `Model`, so `SqlModel.makeRepository` compatibility
 * stays structural) with `sql` statics carrying the resolved SQL metadata.
 *
 * Whole-model invariants are enforced twice, at different altitudes:
 * - compile time: the `fields` parameter intersects `ValidateFields<F>`, so an
 *   underivable column or a second primary key fails on the offending key with
 *   a `~effect-drizzle.error` message literal;
 * - construction time: runtime checks mirror the same rules (nullable PK,
 *   multiple PKs) as tagged errors, catching hand-built field nodes.
 *
 * @since 0.0.0
 */
import { every, findFirst, last as lastArray, reduce } from "effect/Array";
import { dual } from "effect/Function";
import { fromUndefinedOr, getOrElse, getOrUndefined, isSome, match, none, orElse, some } from "effect/Option";
import { isFunction, isNotUndefined, isNumber, isString, isUint8Array } from "effect/Predicate";
import { empty, set } from "effect/Record";
import { flip, is, optionalKey } from "effect/Schema";
import { split } from "effect/String";
import { VariantSchema } from "effect/unstable/schema";
import * as Field from "../core/Field.ts";
import * as Meta from "../core/Meta.ts";
import { ModelInvariantError } from "../core/model.ts";
import { assertPgEnumLabel, assertSqlName, assertUniqueSqlNames } from "../core/names.ts";
import { factory as V } from "../core/variant.ts";
import { snakeCase } from "../internal/case.ts";
import { withStatics } from "../internal/statics.ts";
import * as PgColumn from "./Column.ts";
import * as Derive from "./derive.ts";
import * as TableExtras from "./extras.ts";
import type { Annotations, Struct as StructSchema, Top } from "effect/Schema";
import type { AnyModel as CoreAnyModel } from "../core/model.ts";
import type { ValidateDerivedSqlName, ValidateSqlName } from "../core/names.ts";
import type { Variant } from "../core/variant.ts";

// Re-export the owning shared variant helpers for the public model surface.
/** Shared variant helpers exposed by the PostgreSQL model surface.
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
// Re-export the owning root error for internal dialect modules.
/** Internal dialect re-export of the shared model invariant error.
 * @internal
 * @category errors
 * @since 0.0.0
 */
export { ModelInvariantError };

/**
 * Describes the string-keyed field record accepted by {@link Model}.
 *
 * **Details**
 *
 * Each property is either an Effect schema or a pipeable field that already
 * carries SQL metadata.
 *
 * **Example** (Declare a field record)
 *
 * ```ts
 * import { String } from "effect/Schema"
 * import type { FieldsInput } from "@beep/effect-drizzle"
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
type ResolvedMetaOf<I extends Field.Input, Key extends string = string> = Meta.Merge<
  Field.MetaFrom<I>,
  {
    readonly column: PgColumn.ResolveName<Derive.ResolvedColumn<I>, Key>;
    readonly references: AutoRef<I>;
  }
>;

/**
 * Projects every declared field to its resolved PostgreSQL metadata.
 *
 * **Details**
 *
 * Keys are preserved while explicit metadata, encoded-carrier derivation,
 * physical names, and EntityId references are merged.
 *
 * **Example** (Project field metadata)
 *
 * ```ts
 * import { String } from "effect/Schema"
 * import type { ColumnsOf } from "@beep/effect-drizzle"
 *
 * type Columns = ColumnsOf<{ readonly displayName: typeof String }>
 * type Column = Columns["displayName"]["column"] // => PostgreSQL text descriptor
 * ```
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
 * Applies SQL write strategy to a field's six Effect model variants.
 *
 * **Details**
 *
 * Ordinary fields appear everywhere, with defaults optional on insert and all
 * ordinary updates optional. Generated expressions are read-only. Identity-
 * always fields remain in update only as row locators, and version fields are
 * optional on insert but required on update.
 *
 * **Gotchas**
 *
 * Identity-always update membership does not authorize changing the identity;
 * repository updates consume it for `WHERE`. Explicit `VariantField` inputs
 * retain their author-defined membership instead of this derived truth table.
 *
 * **Example** (Infer effective membership)
 *
 * ```ts
 * import { String } from "effect/Schema"
 * import type { EffectiveSchema } from "@beep/effect-drizzle"
 *
 * type NameField = EffectiveSchema<typeof String>
 * type Update = NameField["schemas"]["update"] // => optional String schema
 * ```
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
 * Effective variant-aware schema record derived from a `@beep/effect-drizzle` field record.
 *
 * @category models
 * @since 0.0.0
 */
type UnwrappedFields<F extends FieldsInput> = {
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
    ? null extends Field.EncodedOf<I>
      ? Field.SqlTypeError<"version fields cannot be nullable">
      : Field.MetaFrom<I>["dimensions"] extends 0
        ? Field.MetaFrom<I>["column"] extends PgColumn.Integer | PgColumn.Smallint | PgColumn.Bigint<"number">
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

type ValidateSpecFamily<I extends Field.Input> =
  Exclude<Field.MetaFrom<I>["column"], undefined> extends { readonly dialect: infer Dialect }
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
 * import { Date as DateSchema, String } from "effect/Schema"
 * import type { ValidateFields } from "@beep/effect-drizzle"
 *
 * type Accepted = ValidateFields<{ readonly name: typeof String }>
 * // => { readonly name: unknown }
 *
 * type Rejected = ValidateFields<{ readonly createdAt: typeof DateSchema }>
 * // => createdAt carries ~effect-drizzle.error:
 * // "this field's encoded type does not derive a column — add explicit metadata (...)"
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export type ValidateFields<F extends FieldsInput> = {
  readonly [K in keyof F]: ValidateSpecFamily<F[K]> &
    ValidateResolvedColumn<F[K]> &
    ValidateVersionField<F[K]> &
    ValidateArrayField<F[K]> &
    ValidateSqlName<Lowercase<K & string>, "model field derives an invalid PostgreSQL column name">;
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
 * @category errors
 * @since 0.0.0
 */
export type MissingSelfGeneric =
  `Missing \`Self\` generic — use \`class Self extends EffectDrizzle.Model<Self>(identifier)({ ... }) {}\``;

/**
 * Metadata statics attached by `@beep/effect-drizzle` to every generated model class.
 *
 * **Details**
 *
 * `sql` retains the derived table name, original field record, resolved column
 * metadata, and optional table-extras callback.
 *
 * **Example** (Read model statics)
 *
 * ```ts
 * import { String } from "effect/Schema"
 * import type { Statics } from "@beep/effect-drizzle"
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
 * Combines an Effect variant class with resolved SQL statics.
 *
 * **Details**
 *
 * The class constructor represents the select variant and exposes all six
 * operation schemas as statics alongside `sql` metadata.
 *
 * **Example** (Name a generated model type)
 *
 * ```ts
 * import { String } from "effect/Schema"
 * import type { ModelClass } from "@beep/effect-drizzle"
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
> & {
  readonly [Va in Variant]: VariantSchema.Extract<Va, VariantSchema.Struct<UnwrappedFields<F>>>;
} & Statics<F>;

/**
 * Structural model bound accepted by PostgreSQL projectors and assembly.
 *
 * **When to use**
 *
 * Use as a generic constraint for utilities that consume any PostgreSQL model
 * without preserving its exact fields.
 *
 * **Example** (Accept any `@beep/effect-drizzle` model)
 *
 * ```ts
 * import { String } from "effect/Schema"
 * import { Model, type AnyModel } from "@beep/effect-drizzle"
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

const physicalColumnEntry = ([key, input]: [string, Field.Input]): readonly [string, string] => {
  const meta = Field.from(input).meta;
  return [key, getOrElse(fromUndefinedOr(meta.columnName), () => snakeCase(key))];
};

const validateModelNames = (tableName: string, fields: FieldsInput): void => {
  assertSqlName(tableName, "pg", "PostgreSQL table name");
  assertUniqueSqlNames(Object.entries(fields).map(physicalColumnEntry), "pg", "PostgreSQL column name");
};

const validateLiteralDefault = (field: Field.Any, select: Top, column: PgColumn.Spec, fieldName: string): void => {
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
  if (PgColumn.Spec.guards.bytea(column) && isUint8Array(value)) {
    throw ModelInvariantError.make({
      message: `bytea literal defaults are not safely rendered; use unsafeDefaultSql for trusted SQL.`,
      fieldName,
    });
  }
};

const resolveReferences = (meta: Meta.Meta, select: unknown, fieldName: string): Meta.References | undefined => {
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
 * Build one `@beep/effect-drizzle` model class after its public factory has validated the field set.
 *
 * **Details**
 *
 * This is the shared runtime seam used by bare {@link Model} and kit-provided
 * entities. Runtime invariants remain authoritative when types are suppressed.
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
} = /* @__PURE__ */ dual(
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
    if (fieldCount === 0 || fieldCount > 1_600) {
      throw ModelInvariantError.make({
        message: `PostgreSQL models require from 1 through 1,600 columns; '${identifier}' declares ${fieldCount}.`,
        fieldName: "(model)",
      });
    }
    const state = reduce(
      Object.entries(fields),
      {
        columns: empty<string, Meta.Meta<PgColumn.Spec>>(),
        primaryKeys: 0,
        versionFields: 0,
        schemaFields: empty<string, Field.AnySchema>(),
      },
      function collectPgModelState(state, [key, input]) {
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

        if (!PgColumn.Spec.guards.custom(classified.column)) {
          const expected = PgColumn.carrier(field.meta.dimensions)(classified.column);
          const actual = Derive.carrier(field.schema, field.meta.dimensions);
          if (actual.tag !== expected.tag || actual.dimensions !== expected.dimensions) {
            throw ModelInvariantError.make({
              message: `Field '${key}' encodes ${actual.tag}[${actual.dimensions}] but its PostgreSQL column carries ${expected.tag}[${expected.dimensions}].`,
              fieldName: key,
            });
          }
        }

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
        if (field.meta.generated !== false && (field.meta.hasDefault || isNotUndefined(field.meta.default))) {
          throw ModelInvariantError.make({
            message: `Field '${key}' cannot be both defaulted and generated.`,
            fieldName: key,
          });
        }
        if (field.meta.version && !PgColumn.isNumberInteger(classified.column)) {
          throw ModelInvariantError.make({
            message: `Version field '${key}' requires a number-encoded integer-family column.`,
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
        if (PgColumn.Spec.guards.char(classified.column)) {
          const char = classified.column;
          const lengths = Derive.exactLengths(field.schema);
          if (lengths.length === 0 || !every(lengths, (length) => length === char.length)) {
            throw ModelInvariantError.make({
              message: `char(${char.length}) on '${key}' requires an exact matching schema length.`,
              fieldName: key,
            });
          }
        }
        const bounded = PgColumn.Spec.guards.varchar(classified.column)
          ? some({ kind: "varchar", length: classified.column.length })
          : none<{ readonly kind: string; readonly length: number }>();
        if (isSome(bounded)) {
          const incompatible = findFirst(
            Derive.maxLengths(field.schema),
            (maxLength) => maxLength > bounded.value.length
          );
          if (isSome(incompatible)) {
            throw ModelInvariantError.make({
              message: `${bounded.value.kind}(${bounded.value.length}) on '${key}' is narrower than schema maxLength ${incompatible.value}.`,
              fieldName: key,
            });
          }
        }
        validateLiteralDefault(field, select, classified.column, key);
        const resolvedColumn = PgColumn.resolveName(key)(classified.column);
        if (PgColumn.Spec.guards.enum(resolvedColumn)) {
          assertSqlName(resolvedColumn.name, "pg", "PostgreSQL enum name");
          resolvedColumn.values.forEach(assertPgEnumLabel);
        }
        const resolvedMeta = Meta.merge(field.meta, {
          column: resolvedColumn,
          references: resolveReferences(field.meta, select, key),
        });
        return {
          columns: set(state.columns, key, resolvedMeta),
          primaryKeys: state.primaryKeys + (field.meta.primaryKey ? 1 : 0),
          versionFields: state.versionFields + (field.meta.version ? 1 : 0),
          schemaFields: set(state.schemaFields, key, effectiveSchema(field.schema, resolvedMeta)),
        };
      }
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
        "pg",
        "PostgreSQL colocated index name"
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
    return withStatics(Base, () => ({
      sql: { tableName, fields, columns: state.columns, extras: composedExtras },
    }));
  }
);

/**
 * Builds a PostgreSQL model class whose schemas own resolved SQL metadata.
 *
 * **When to use**
 *
 * Use when standalone models and tables intentionally opt out of kit
 * defaults; use a kit's `Entity` factory for invariant shared columns.
 *
 * **Details**
 *
 * The identifier's final segment becomes a snake-case table name. Field
 * schemas drive model variants, Drizzle column metadata, automatic EntityId
 * references, and optional table extras from one declaration. Pass annotations
 * as the second argument and table extras as the third when both are needed.
 *
 * **Gotchas**
 *
 * Supply the class itself as `Self`. PostgreSQL and SQLite column descriptors
 * cannot be mixed, and constructor-time validation still runs if type errors
 * were suppressed.
 *
 * **Example** (Define a `@beep/effect-drizzle` model)
 *
 * ```ts
 * import { String } from "effect/Schema"
 * import { Model } from "@beep/effect-drizzle"
 *
 * class User extends Model<User>("User")({ name: String }) {}
 * User.sql.tableName // => "user"
 * Object.keys(User.insert.fields) // => ["name"]
 * ```
 *
 * @see {@link ValidateFields} for compile-time model invariants.
 * @category factories
 * @since 0.0.0
 */
export function Model<Self = never, const Identifier extends string = string>(
  identifier: Identifier &
    ValidateDerivedSqlName<Identifier, "Model identifier derives an invalid PostgreSQL table name">
): <const F extends FieldsInput>(
  fields: F & ValidateFields<F>,
  annotationsOrExtras?: Annotations.Annotations | TableExtras.Callback<F>,
  extras?: TableExtras.Callback<F>
) => [Self] extends [never] ? MissingSelfGeneric : ModelClass<Self, F>;
export function Model(identifier: string): unknown {
  return (
    fields: FieldsInput,
    annotationsOrExtras?: Annotations.Annotations | TableExtras.Callback<FieldsInput>,
    declaredExtras?: TableExtras.Callback<FieldsInput>
  ): object => {
    const extras = isFunction(annotationsOrExtras) ? annotationsOrExtras : declaredExtras;
    const annotations = isFunction(annotationsOrExtras) ? undefined : annotationsOrExtras;
    return makeModelClass(identifier, fields, annotations, extras);
  };
}
