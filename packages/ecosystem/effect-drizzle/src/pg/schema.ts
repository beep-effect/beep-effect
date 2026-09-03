/**
 * Assembles PostgreSQL models into validated Drizzle schema objects.
 *
 * The assembler resolves foreign keys, shares enum instances, projects tables,
 * and derives RQBv2 relations from the same model metadata graph.
 *
 * @since 0.0.0
 */

import { defineRelations, is as isDrizzleEntity } from "drizzle-orm";
import { PgColumn as DrizzlePgColumn, foreignKey, getTableConfig, uniqueKeyName } from "drizzle-orm/pg-core";
import {
  contains,
  findFirst,
  flatMap as flatMapArray,
  forEach,
  get as getArray,
  getSomes,
  head,
  reduce,
} from "effect/Array";
import { equals } from "effect/Equal";
import {
  exists,
  flatMap as flatMapOption,
  fromUndefinedOr,
  getOrElse,
  isSome,
  map,
  match,
  none,
  some,
} from "effect/Option";
import { hasProperty, isUndefined } from "effect/Predicate";
import { empty, get as getRecord, set } from "effect/Record";
import { String as StringSchema, TaggedError } from "effect/Schema";
import { toLowerCase } from "effect/String";
import {
  makeRelationsConfig,
  relationName,
  validatePhysicalTableNames,
  validateSchemaNames,
} from "../core/assembly.ts";
import { declaredFieldsEquivalence } from "../core/declaredFieldsEquivalence.ts";
import * as Field from "../core/Field.ts";
import * as Meta from "../core/Meta.ts";
import { snakeCase } from "../internal/case.ts";
import * as PgColumn from "./Column.ts";
import * as Derive from "./derive.ts";
import { toPgTableWithOptions } from "./table.ts";
import type { RelationsBuilder, RelationsBuilderConfig } from "drizzle-orm";
import type { Option } from "effect/Option";
import type { Edge, Junction, SchemaName } from "../core/assembly.ts";
import type { AnyModel, FieldsInput } from "./model.ts";
import type { EnumRegistry, TableOf } from "./table.ts";

/**
 * Reports a cross-model reference or enum conflict during schema assembly.
 *
 * **Details**
 *
 * The error retains source table, field, and target table so a dynamic or
 * type-suppressed model registry can be traced back to its declaration.
 *
 * **Example** (Construct an assembly error)
 *
 * ```ts
 * import { SchemaAssemblyError } from "@beep/effect-drizzle/pg"
 *
 * const error = SchemaAssemblyError.make({
 *   message: "missing target",
 *   sourceTable: "user",
 *   fieldName: "orgId",
 *   targetTable: "organization"
 * })
 * error._tag // => "SchemaAssemblyError"
 * error.fieldName // => "orgId"
 * ```
 *
 * @see {@link schema} for the assembly boundary that raises this error.
 * @category errors
 * @since 0.0.0
 */
export class SchemaAssemblyError extends TaggedError<SchemaAssemblyError>("@beep/effect-drizzle/SchemaAssemblyError")(
  "SchemaAssemblyError",
  {
    message: StringSchema,
    sourceTable: StringSchema,
    fieldName: StringSchema,
    targetTable: StringSchema,
  },
  {
    description: "A @beep/effect-drizzle cross-table reference could not be resolved or validated.",
    toEquivalence: (typeParameters) => declaredFieldsEquivalence<SchemaAssemblyError>(typeParameters),
  }
) {}

/**
 * Describes the string-keyed model registry accepted by {@link schema}.
 *
 * **Details**
 *
 * Registry keys become the stable keys of projected tables and relation helpers;
 * each model retains its independently derived SQL table name.
 *
 * **Example** (Accept a model registry)
 *
 * ```ts
 * import { String } from "effect/Schema"
 * import { Model } from "@beep/effect-drizzle"
 * import type { ModelRecord } from "@beep/effect-drizzle/pg"
 *
 * class User extends Model<User>("User")({ name: String }) {}
 * type Models = { readonly user: typeof User }
 * type Accepted = Models extends ModelRecord ? true : false // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface ModelRecord {
  readonly [key: string]: AnyModel;
}

type FieldsOf<M> = M extends {
  readonly sql: { readonly fields: infer F extends FieldsInput };
}
  ? F
  : never;
type ColumnsOf<M> = M extends { readonly sql: { readonly columns: infer C } } ? C : never;
type SpecAt<M, K extends PropertyKey> = K extends keyof ColumnsOf<M>
  ? ColumnsOf<M>[K] extends { readonly column: infer C extends PgColumn.Spec }
    ? C
    : never
  : never;

type DimensionsAt<M, K extends PropertyKey> = K extends keyof ColumnsOf<M>
  ? ColumnsOf<M>[K] extends {
      readonly dimensions: infer D extends PgColumn.ArrayDimension;
    }
    ? D
    : never
  : never;

type StorageIdentEquals<
  A extends PgColumn.Spec,
  ADimensions extends PgColumn.ArrayDimension,
  B extends PgColumn.Spec,
  BDimensions extends PgColumn.ArrayDimension,
> = [PgColumn.StorageIdent<A, ADimensions>] extends [PgColumn.StorageIdent<B, BDimensions>]
  ? [PgColumn.StorageIdent<B, BDimensions>] extends [PgColumn.StorageIdent<A, ADimensions>]
    ? true
    : false
  : false;

type StorageCarrierEquals<
  A extends PgColumn.Spec,
  ADimensions extends PgColumn.ArrayDimension,
  B extends PgColumn.Spec,
  BDimensions extends PgColumn.ArrayDimension,
> = [PgColumn.ArrayCarrier<PgColumn.CarrierOf<A>, ADimensions>] extends [
  PgColumn.ArrayCarrier<PgColumn.CarrierOf<B>, BDimensions>,
]
  ? [PgColumn.ArrayCarrier<PgColumn.CarrierOf<B>, BDimensions>] extends [
      PgColumn.ArrayCarrier<PgColumn.CarrierOf<A>, ADimensions>,
    ]
    ? true
    : false
  : false;

type ReferenceFailure<Models extends ModelRecord, M, K extends keyof FieldsOf<M>> = K extends keyof ColumnsOf<M>
  ? ColumnsOf<M>[K] extends { readonly references: infer Ref }
    ? Ref extends Meta.References<infer TargetTable, infer TargetColumn>
      ? TargetTable extends keyof Models
        ? TargetColumn extends keyof FieldsOf<Models[TargetTable]>
          ? SpecAt<M, K> extends infer SourceSpec extends PgColumn.Spec
            ? SpecAt<Models[TargetTable], TargetColumn> extends infer TargetSpec extends PgColumn.Spec
              ? StorageIdentEquals<
                  SourceSpec,
                  DimensionsAt<M, K>,
                  TargetSpec,
                  DimensionsAt<Models[TargetTable], TargetColumn>
                > extends true
                ? StorageCarrierEquals<
                    SourceSpec,
                    DimensionsAt<M, K>,
                    TargetSpec,
                    DimensionsAt<Models[TargetTable], TargetColumn>
                  > extends true
                  ? Meta.IsUniqueKey<ColumnsOf<Models[TargetTable]>[TargetColumn]> extends true
                    ? never
                    : Field.SqlTypeError<"foreign-key target must be primary-key or unique">
                  : Field.SqlTypeError<"foreign-key encoded carriers are incompatible">
                : Field.SqlTypeError<"foreign-key SQL identities do not match">
              : Field.SqlTypeError<"foreign-key target has no resolved column">
            : Field.SqlTypeError<"foreign-key source has no resolved column">
          : Field.SqlTypeError<"foreign-key target column is missing">
        : Field.SqlTypeError<`foreign-key target table '${TargetTable}' is missing from EffectDrizzle.schema`>
      : never
    : never
  : never;

type SchemaFailures<Models extends ModelRecord> = {
  readonly [ModelKey in keyof Models]: {
    readonly [FieldKey in keyof FieldsOf<Models[ModelKey]>]: ReferenceFailure<Models, Models[ModelKey], FieldKey>;
  }[keyof FieldsOf<Models[ModelKey]>];
}[keyof Models];

/**
 * Reduces a model registry to `unknown` or a readable foreign-key diagnostic.
 *
 * **Details**
 *
 * Validation compares both SQL identity and encoded carrier, including array
 * depth and EntityId identity, for every declared reference.
 *
 * **Example** (Inspect reference validation)
 *
 * ```ts
 * import { Int, String } from "effect/Schema"
 * import { Model } from "@beep/effect-drizzle"
 * import { integer, primaryKey, references, text, type ValidateSchema } from "@beep/effect-drizzle/pg"
 *
 * class UserId {
 *   static readonly tableName = "user"
 *   static readonly entityType = "User"
 * }
 * class User extends Model<User>("User")({ id: Int.pipe(integer(), primaryKey()) }) {}
 * class Membership extends Model<Membership>("Membership")({
 *   userId: Int.pipe(integer(), references(UserId))
 * }) {}
 * class Broken extends Model<Broken>("Broken")({
 *   userId: String.pipe(text(), references(UserId))
 * }) {}
 *
 * type Accepted = ValidateSchema<{ user: typeof User; membership: typeof Membership }>
 * // => unknown
 * type Rejected = ValidateSchema<{ user: typeof User; broken: typeof Broken }>
 * // => ~effect-drizzle.error: "foreign-key SQL identities do not match"
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export type ValidateSchema<Models extends ModelRecord> = [SchemaFailures<Models>] extends [never]
  ? unknown
  : SchemaFailures<Models>;

/**
 * Projects model-registry keys to their exact Drizzle PostgreSQL table types.
 *
 * **Example** (Name a projected registry)
 *
 * ```ts
 * import type { ModelRecord, TablesOf } from "@beep/effect-drizzle/pg"
 *
 * type Tables = TablesOf<ModelRecord>
 * type UserTable = Tables["user"] // => projected PostgreSQL table
 * ```
 *
 * @category projections
 * @since 0.0.0
 */
export type TablesOf<Models extends ModelRecord> = {
  readonly [K in keyof Models]: TableOf<Models[K]>;
};

/**
 * Types the RQBv2 relation-builder callback derived for a model registry.
 *
 * **Details**
 *
 * Forward, reverse, and recognized two-key junction relations share the same
 * key-preserving table projection.
 *
 * **Example** (Name a relation config)
 *
 * ```ts
 * import type { ModelRecord, RelationsConfig } from "@beep/effect-drizzle/pg"
 *
 * type Config = RelationsConfig<ModelRecord>
 * // => callback from typed tables to an RQBv2 relation configuration
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type RelationsConfig<Models extends ModelRecord> = (
  helpers: RelationsBuilder<TablesOf<Models>>
) => RelationsBuilderConfig<TablesOf<Models>>;

/**
 * Describes the complete PostgreSQL assembly returned by {@link schema}.
 *
 * **Details**
 *
 * The assembly retains source models, shared enum instances, projected tables,
 * a collision-safe combined Drizzle export record, the reusable relation
 * callback, and Drizzle's processed relation object.
 *
 * **Example** (Read assembled tables)
 *
 * ```ts
 * import type { Assembly, ModelRecord } from "@beep/effect-drizzle/pg"
 *
 * type UserAssembly = Assembly<ModelRecord>
 * type Tables = UserAssembly["tables"] // => key-preserving Drizzle tables
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface Assembly<Models extends ModelRecord> {
  readonly drizzleSchema: Readonly<Record<string, unknown>>;
  readonly enums: EnumRegistry;
  readonly models: Models;
  readonly relations: ReturnType<typeof defineRelations>;
  readonly relationsConfig: RelationsConfig<Models>;
  readonly tables: TablesOf<Models>;
}

const fail = (message: string, sourceTable: string, fieldName: string, targetTable: string): never => {
  throw SchemaAssemblyError.make({
    message,
    sourceTable,
    fieldName,
    targetTable,
  });
};

const targetFieldKey = (model: AnyModel, columnName: string): Option<string> =>
  hasProperty(model.sql.fields, columnName)
    ? some(columnName)
    : findFirst(Object.keys(model.sql.columns), (key) =>
        exists(
          getRecord(model.sql.columns, key),
          (meta) => meta.columnName === columnName || snakeCase(key) === columnName
        )
      );

const resolveTarget = (
  entries: ReadonlyArray<readonly [string, AnyModel]>,
  reference: Meta.References,
  sourceKey: string,
  sourceField: string
): readonly [string, AnyModel] => {
  const exact = findFirst(entries, ([key]) => key === reference.tableName);
  if (isSome(exact)) return exact.value;
  const physical = entries.filter(([, model]) => model.sql.tableName === reference.tableName);
  if (physical.length === 1) {
    return getOrElse(head(physical), () =>
      fail("Resolved physical table target disappeared.", sourceKey, sourceField, reference.tableName)
    );
  }
  if (physical.length > 1) {
    return fail(
      `Reference target table '${reference.tableName}' is ambiguous across registry keys.`,
      sourceKey,
      sourceField,
      reference.tableName
    );
  }
  return fail(
    `Reference target table '${reference.tableName}' is missing from EffectDrizzle.schema.`,
    sourceKey,
    sourceField,
    reference.tableName
  );
};

const collectEnums = (models: ModelRecord): EnumRegistry =>
  reduce(Object.entries(models), empty<string, PgColumn.EnumInstance>(), (enums, [modelKey, model]) =>
    reduce(Object.entries(model.sql.columns), enums, (current, [fieldName, meta]) => {
      const column = meta.column;
      if (!PgColumn.Spec.guards.enum(column)) return current;
      if (column.name === "") {
        return fail("Enum name was not resolved during model construction.", modelKey, fieldName, "(enum)");
      }
      return match(getRecord(current, column.name), {
        onNone: () => set(current, column.name, PgColumn.Enum.toDrizzleEnum(column)),
        onSome: (existing) => {
          if (!equals(existing.enumValues, column.values)) {
            return fail(
              `PostgreSQL enum '${column.name}' is declared with incompatible values.`,
              modelKey,
              fieldName,
              column.name
            );
          }
          return current;
        },
      });
    })
  );

const collectEdges = (models: ModelRecord): ReadonlyArray<Edge> => {
  const entries = Object.entries(models);
  return flatMapArray(entries, ([sourceKey, model]) =>
    getSomes(
      Object.keys(model.sql.fields).map((sourceField) =>
        map(
          flatMapOption(getRecord(model.sql.columns, sourceField), (meta) => fromUndefinedOr(meta.references)),
          function collectPgEdge(reference) {
            const [targetKey, targetModel] = resolveTarget(entries, reference, sourceKey, sourceField);
            const targetField = getOrElse(targetFieldKey(targetModel, reference.columnName), () =>
              fail(
                `Reference target column '${reference.columnName}' is missing from '${reference.tableName}'.`,
                sourceKey,
                sourceField,
                reference.tableName
              )
            );
            const sourceMeta = getOrElse(getRecord(model.sql.columns, sourceField), () =>
              fail(
                "Foreign-key source metadata must be resolved before assembly.",
                sourceKey,
                sourceField,
                reference.tableName
              )
            );
            const targetMeta = getOrElse(getRecord(targetModel.sql.columns, targetField), () =>
              fail(
                "Foreign-key target metadata must be resolved before assembly.",
                sourceKey,
                sourceField,
                reference.tableName
              )
            );
            const sourceSpec = getOrElse(fromUndefinedOr(sourceMeta.column), () =>
              fail(
                "Foreign-key source column must be resolved before assembly.",
                sourceKey,
                sourceField,
                reference.tableName
              )
            );
            const targetSpec = getOrElse(fromUndefinedOr(targetMeta.column), () =>
              fail(
                "Foreign-key target column must be resolved before assembly.",
                sourceKey,
                sourceField,
                reference.tableName
              )
            );
            if (!Meta.isUniqueKey(targetMeta)) {
              fail(
                `Foreign key '${sourceKey}.${sourceField}' must target a primary key, unique field, or single-column unique index, got '${targetKey}.${targetField}'.`,
                sourceKey,
                sourceField,
                reference.tableName
              );
            }
            if (
              PgColumn.storageIdent(sourceSpec, sourceMeta.dimensions) !==
                PgColumn.storageIdent(targetSpec, targetMeta.dimensions) ||
              !equals(
                PgColumn.carrier(sourceSpec, sourceMeta.dimensions),
                PgColumn.carrier(targetSpec, targetMeta.dimensions)
              )
            ) {
              fail(
                `Foreign key '${sourceKey}.${sourceField}' (${PgColumn.storageIdent(
                  sourceSpec,
                  sourceMeta.dimensions
                )}) cannot reference '${targetKey}.${targetField}' (${PgColumn.storageIdent(
                  targetSpec,
                  targetMeta.dimensions
                )}).`,
                sourceKey,
                sourceField,
                reference.tableName
              );
            }
            const sourceSchema = getOrElse(fromUndefinedOr(model.sql.fields[sourceField]), () =>
              fail("Foreign-key source field is missing.", sourceKey, sourceField, reference.tableName)
            );
            const optional = Derive.isNullable(Field.from(sourceSchema).schema);
            if ((reference.onDelete === "set null" || reference.onUpdate === "set null") && !optional) {
              fail(
                `Foreign key '${sourceKey}.${sourceField}' uses SET NULL but its source schema is not nullable.`,
                sourceKey,
                sourceField,
                reference.tableName
              );
            }
            if (
              (reference.onDelete === "set default" || reference.onUpdate === "set default") &&
              !sourceMeta.hasDefault
            ) {
              fail(
                `Foreign key '${sourceKey}.${sourceField}' uses SET DEFAULT without a declared database default.`,
                sourceKey,
                sourceField,
                reference.tableName
              );
            }
            return {
              sourceKey,
              sourceField,
              targetKey,
              targetField,
              relationName: relationName(sourceField),
              optional,
              reference,
            };
          }
        )
      )
    )
  );
};

const collectJunctions = (
  tables: Readonly<Record<string, TableOf<AnyModel>>>,
  edges: ReadonlyArray<Edge>
): ReadonlyArray<Junction> =>
  getSomes(
    Object.entries(tables).map(([key, table]) => {
      const primaryKeys = getTableConfig(table).primaryKeys;
      if (primaryKeys.length !== 1) return none();
      const columns = primaryKeys[0]?.columns;
      if (isUndefined(columns) || columns.length !== 2) return none();
      const columnNames = columns.map((column) => column.name);
      const candidates = edges.filter((edge) => edge.sourceKey === key);
      const primaryEdges = candidates.filter((edge) => {
        if (!hasProperty(table, edge.sourceField)) return false;
        const column = table[edge.sourceField];
        return isDrizzleEntity(column, DrizzlePgColumn) && contains(columnNames, column.name);
      });
      if (
        primaryEdges.length !== 2 ||
        !columnNames.every((name) =>
          primaryEdges.some((edge) => {
            if (!hasProperty(table, edge.sourceField)) return false;
            const column = table[edge.sourceField];
            return isDrizzleEntity(column, DrizzlePgColumn) ? column.name === name : false;
          })
        )
      ) {
        return none();
      }
      const left = getOrElse(head(primaryEdges), () =>
        fail("Junction is missing its first foreign-key edge.", key, "(composite primary key)", "(junction)")
      );
      const right = getOrElse(getArray(primaryEdges, 1), () =>
        fail("Junction is missing its second foreign-key edge.", key, "(composite primary key)", "(junction)")
      );
      return left.targetKey === right.targetKey ? none() : some({ key, left, right });
    })
  );

const named = (owner: string, kind: string, name: string | undefined): ReadonlyArray<SchemaName> =>
  name === undefined ? [] : [{ owner, kind, name }];

const collectSchemaNames = (
  tables: Readonly<Record<string, TableOf<AnyModel>>>,
  enums: EnumRegistry
): ReadonlyArray<SchemaName> => [
  ...Object.entries(enums).map(([name]): SchemaName => ({ owner: `enum:${name}`, kind: "enum type", name })),
  ...Object.entries(tables).flatMap(([key, table]) => {
    const config = getTableConfig(table);
    return [
      { owner: `table:${key}`, kind: "table", name: config.name },
      ...config.indexes.flatMap((value, index) => named(`index:${key}:${index}`, "index", value.config.name)),
      ...config.primaryKeys.flatMap((value, index) =>
        named(`primary-key:${key}:${index}`, "primary-key constraint", value.getName())
      ),
      ...config.uniqueConstraints.flatMap((value, index) =>
        named(`unique:${key}:${index}`, "unique constraint", value.getName())
      ),
      ...config.columns
        .filter((column) => column.primary)
        .map(
          (_, index): SchemaName => ({
            owner: `inline-primary-key:${key}:${index}`,
            kind: "primary-key constraint",
            name: `${config.name}_pkey`,
          })
        ),
      ...config.columns
        .filter((column) => column.isUnique)
        .map(
          (column, index): SchemaName => ({
            owner: `inline-unique:${key}:${index}`,
            kind: "unique constraint",
            name: column.uniqueName ?? uniqueKeyName(table, [column.name]),
          })
        ),
      ...config.checks.map(
        (value, index): SchemaName => ({ owner: `check:${key}:${index}`, kind: "check constraint", name: value.name })
      ),
      ...config.foreignKeys.map(
        (value, index): SchemaName => ({
          owner: `foreign-key:${key}:${index}`,
          kind: "foreign-key constraint",
          name: toLowerCase(value.getName()),
        })
      ),
    ];
  }),
];

/**
 * Assembles models into shared enums, wired tables, and RQBv2 relations.
 *
 * **When to use**
 *
 * Use when two or more models share references or enums, or when callers need
 * one Drizzle schema object for migrations and relational queries. Use
 * `toPgTable` for a standalone model without cross-model wiring.
 *
 * **Details**
 *
 * Assembly validates every foreign key, interns one PostgreSQL enum instance
 * per enum name, projects all tables, applies declared extras, then derives
 * forward, reverse, and junction relations in deterministic order.
 *
 * **Gotchas**
 *
 * Models using the same enum name must declare identical values. Foreign-key
 * equality includes SQL identity, encoded carrier, and array depth rather than
 * accepting merely assignable TypeScript values. Self-referential junctions
 * emit direct and reverse relations only; through-relation naming is deferred.
 * References resolve an exact registry key first, otherwise one unique physical
 * table name. Physical table names must be unique across the registry.
 * Compile-time validation recognizes registry keys; physical-name fallback is
 * runtime-only until model statics preserve literal table names.
 *
 * **Example** (Assemble one model)
 *
 * ```ts
 * import { String } from "effect/Schema"
 * import { getTableName } from "drizzle-orm"
 * import { Model } from "@beep/effect-drizzle"
 * import { schema } from "@beep/effect-drizzle/pg"
 *
 * class User extends Model<User>("User")({ name: String }) {}
 * const assembly = schema({ user: User })
 *
 * getTableName(assembly.tables.user) // => "user"
 * ```
 *
 * @see {@link ValidateSchema} for the compile-time reference check.
 * @category factories
 * @since 0.0.0
 */
export function schema<const Models extends ModelRecord>(models: Models & ValidateSchema<Models>): Assembly<Models>;
export function schema(models: ModelRecord): unknown {
  validatePhysicalTableNames(models, "pg", fail);
  const enums = collectEnums(models);
  const edges = collectEdges(models);
  // Drizzle evaluates extra-config callbacks lazily. Reassigning this registry
  // lets callbacks created for earlier tables see forward and self references
  // after every table has been projected.
  let runtimeTables = empty<string, TableOf<AnyModel>>();

  forEach(Object.entries(models), ([key, model]) => {
    runtimeTables = set(
      runtimeTables,
      key,
      toPgTableWithOptions({
        model,
        additionalExtras: (columns) =>
          edges
            .filter((edge) => edge.sourceKey === key)
            .map((edge) => {
              const targetTable = getOrElse(getRecord(runtimeTables, edge.targetKey), () =>
                fail("Resolved foreign-key table or column is unavailable.", key, edge.sourceField, edge.targetKey)
              );
              if (!hasProperty(targetTable, edge.targetField)) {
                return fail(
                  "Resolved foreign-key table or column is unavailable.",
                  key,
                  edge.sourceField,
                  edge.targetKey
                );
              }
              const targetColumn = targetTable[edge.targetField];
              if (!isDrizzleEntity(targetColumn, DrizzlePgColumn)) {
                return fail(
                  "Resolved foreign-key target is not a PostgreSQL column.",
                  key,
                  edge.sourceField,
                  edge.targetKey
                );
              }
              const builder = match(fromUndefinedOr(edge.reference.name), {
                onNone: () =>
                  foreignKey({
                    columns: [columns[edge.sourceField]],
                    foreignColumns: [targetColumn],
                  }),
                onSome: (name) =>
                  foreignKey({
                    columns: [columns[edge.sourceField]],
                    foreignColumns: [targetColumn],
                    name,
                  }),
              });
              const withDelete = match(fromUndefinedOr(edge.reference.onDelete), {
                onNone: () => builder,
                onSome: (action) => builder.onDelete(action),
              });
              return match(fromUndefinedOr(edge.reference.onUpdate), {
                onNone: () => withDelete,
                onSome: (action) => withDelete.onUpdate(action),
              });
            }),
        enums,
      })
    );
  });

  const tables = runtimeTables;
  validateSchemaNames(collectSchemaNames(tables, enums), "pg", fail);
  const junctions = collectJunctions(tables, edges);
  const relationsConfig = makeRelationsConfig(models, tables, edges, junctions, fail);
  const drizzleSchema = reduce(Object.entries(enums), empty<string, unknown>(), (combined, [name, value]) =>
    set(combined, `enum:${name}`, value)
  );
  const combined = reduce(Object.entries(tables), drizzleSchema, (current, [key, value]) =>
    set(current, `table:${key}`, value)
  );

  return {
    models,
    enums,
    tables,
    drizzleSchema: combined,
    relationsConfig,
    relations: defineRelations(tables, relationsConfig),
  };
}
