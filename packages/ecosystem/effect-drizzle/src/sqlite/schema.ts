/**
 * Assembles SQLite models into validated Drizzle schema objects.
 *
 * The assembler resolves foreign keys, projects tables, and derives RQBv2
 * relations while preserving SQLite's storage-class constraints.
 *
 * @since 0.0.0
 */

// fallow-ignore-file code-duplication -- pg/sqlite are deliberately mirrored dialect implementations; shared logic lives in src/core and the remaining parallelism is per-dialect vocabulary that must evolve independently (doc 14 family; review at next dialect addition)

import { defineRelations, is as isDrizzleEntity } from "drizzle-orm";
import {
  SQLiteColumn as DrizzleSqliteColumn,
  foreignKey,
  getTableConfig,
  uniqueKeyName,
} from "drizzle-orm/sqlite-core";
import { contains, findFirst, flatMap as flatMapArray, forEach, get as getArray, getSomes, head } from "effect/Array";
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
import * as SqliteColumn from "./Column.ts";
import * as Derive from "./derive.ts";
import { toSqliteTableWithOptions } from "./table.ts";
import type { RelationsBuilder, RelationsBuilderConfig } from "drizzle-orm";
import type { Option } from "effect/Option";
import type { Edge, Junction, SchemaName } from "../core/assembly.ts";
import type { AnyModel, FieldsInput } from "./model.ts";
import type { TableOf } from "./table.ts";

/**
 * Reports a cross-model reference failure during SQLite schema assembly.
 *
 * **Details**
 *
 * Source table, field, and target table remain available for diagnosing
 * dynamic or type-suppressed registries.
 *
 * **Example** (Construct an assembly error)
 *
 * ```ts
 * import { SchemaAssemblyError } from "@beep/effect-drizzle/sqlite"
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
 * Describes the string-keyed SQLite model registry accepted by {@link schema}.
 *
 * **Details**
 *
 * Registry keys become projected-table and relation-helper keys while model
 * table names retain their own snake-case derivation.
 *
 * **Example** (Accept a model registry)
 *
 * ```ts
 * import { String } from "effect/Schema"
 * import { Model, type ModelRecord } from "@beep/effect-drizzle/sqlite"
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
  ? ColumnsOf<M>[K] extends { readonly column: infer C extends SqliteColumn.Spec }
    ? C
    : never
  : never;

type DimensionsAt<M, K extends PropertyKey> = K extends keyof ColumnsOf<M>
  ? ColumnsOf<M>[K] extends {
      readonly dimensions: infer D extends SqliteColumn.ArrayDimension;
    }
    ? D
    : never
  : never;

type StorageIdentEquals<
  A extends SqliteColumn.Spec,
  ADimensions extends SqliteColumn.ArrayDimension,
  B extends SqliteColumn.Spec,
  BDimensions extends SqliteColumn.ArrayDimension,
> = [SqliteColumn.StorageIdent<A, ADimensions>] extends [SqliteColumn.StorageIdent<B, BDimensions>]
  ? [SqliteColumn.StorageIdent<B, BDimensions>] extends [SqliteColumn.StorageIdent<A, ADimensions>]
    ? true
    : false
  : false;

type StorageCarrierEquals<
  A extends SqliteColumn.Spec,
  ADimensions extends SqliteColumn.ArrayDimension,
  B extends SqliteColumn.Spec,
  BDimensions extends SqliteColumn.ArrayDimension,
> = [SqliteColumn.ArrayCarrier<SqliteColumn.CarrierOf<A>, ADimensions>] extends [
  SqliteColumn.ArrayCarrier<SqliteColumn.CarrierOf<B>, BDimensions>,
]
  ? [SqliteColumn.ArrayCarrier<SqliteColumn.CarrierOf<B>, BDimensions>] extends [
      SqliteColumn.ArrayCarrier<SqliteColumn.CarrierOf<A>, ADimensions>,
    ]
    ? true
    : false
  : false;

type ReferenceFailure<Models extends ModelRecord, M, K extends keyof FieldsOf<M>> = K extends keyof ColumnsOf<M>
  ? ColumnsOf<M>[K] extends { readonly references: infer Ref }
    ? Ref extends Meta.References<infer TargetTable, infer TargetColumn>
      ? TargetTable extends keyof Models
        ? TargetColumn extends keyof FieldsOf<Models[TargetTable]>
          ? SpecAt<M, K> extends infer SourceSpec extends SqliteColumn.Spec
            ? SpecAt<Models[TargetTable], TargetColumn> extends infer TargetSpec extends SqliteColumn.Spec
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
 * Reduces a SQLite model registry to `unknown` or a readable reference diagnostic.
 *
 * **Details**
 *
 * Validation compares SQLite storage identity and encoded carrier for every
 * declared reference; array depth remains zero by dialect law.
 *
 * **Example** (Inspect SQLite reference validation)
 *
 * ```ts
 * import { Int, String } from "effect/Schema"
 * import { Model, integer, primaryKey, references, text, type ValidateSchema } from "@beep/effect-drizzle/sqlite"
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
 * Projects registry keys to their exact Drizzle SQLite table types.
 *
 * **Example** (Name a projected registry)
 *
 * ```ts
 * import type { ModelRecord, TablesOf } from "@beep/effect-drizzle/sqlite"
 *
 * type Tables = TablesOf<ModelRecord>
 * type UserTable = Tables["user"] // => projected SQLite table
 * ```
 *
 * @category projections
 * @since 0.0.0
 */
export type TablesOf<Models extends ModelRecord> = {
  readonly [K in keyof Models]: TableOf<Models[K]>;
};

/**
 * Types the RQBv2 relation-builder callback derived for a SQLite registry.
 *
 * **Details**
 *
 * Forward, reverse, and recognized two-key junction relations share the same
 * key-preserving table projection.
 *
 * **Example** (Name a relation config)
 *
 * ```ts
 * import type { ModelRecord, RelationsConfig } from "@beep/effect-drizzle/sqlite"
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
 * Describes the complete SQLite assembly returned by {@link schema}.
 *
 * **Details**
 *
 * The assembly retains source models, projected tables, the reusable relation
 * callback, and Drizzle's processed relation object.
 *
 * **Example** (Read assembled tables)
 *
 * ```ts
 * import type { Assembly, ModelRecord } from "@beep/effect-drizzle/sqlite"
 *
 * type UserAssembly = Assembly<ModelRecord>
 * type Tables = UserAssembly["tables"] // => key-preserving Drizzle tables
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface Assembly<Models extends ModelRecord> {
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

const collectEdges = (models: ModelRecord): ReadonlyArray<Edge> => {
  const entries = Object.entries(models);
  return flatMapArray(entries, ([sourceKey, model]) =>
    getSomes(
      Object.keys(model.sql.fields).map((sourceField) =>
        map(
          flatMapOption(getRecord(model.sql.columns, sourceField), (meta) => fromUndefinedOr(meta.references)),
          function collectSqliteEdge(reference) {
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
              SqliteColumn.storageIdent(sourceSpec, sourceMeta.dimensions) !==
                SqliteColumn.storageIdent(targetSpec, targetMeta.dimensions) ||
              !equals(
                SqliteColumn.carrier(sourceSpec, sourceMeta.dimensions),
                SqliteColumn.carrier(targetSpec, targetMeta.dimensions)
              )
            ) {
              fail(
                `Foreign key '${sourceKey}.${sourceField}' (${SqliteColumn.storageIdent(
                  sourceSpec,
                  sourceMeta.dimensions
                )}) cannot reference '${targetKey}.${targetField}' (${SqliteColumn.storageIdent(
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
        return isDrizzleEntity(column, DrizzleSqliteColumn) && contains(columnNames, column.name);
      });
      if (
        primaryEdges.length !== 2 ||
        !columnNames.every((name) =>
          primaryEdges.some((edge) => {
            if (!hasProperty(table, edge.sourceField)) return false;
            const column = table[edge.sourceField];
            return isDrizzleEntity(column, DrizzleSqliteColumn) ? column.name === name : false;
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

const collectSchemaNames = (tables: Readonly<Record<string, TableOf<AnyModel>>>): ReadonlyArray<SchemaName> =>
  Object.entries(tables).flatMap(([key, table]) => {
    const config = getTableConfig(table);
    return [
      { owner: `table:${key}`, kind: "table", name: config.name },
      ...config.indexes.map(
        (value, index): SchemaName => ({ owner: `index:${key}:${index}`, kind: "index", name: value.config.name })
      ),
      ...config.primaryKeys.flatMap((value, index) =>
        named(`primary-key:${key}:${index}`, "primary-key constraint", value.getName())
      ),
      ...config.uniqueConstraints.map(
        (value, index): SchemaName => ({
          owner: `unique:${key}:${index}`,
          kind: "unique constraint",
          name: value.getName(),
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
          name: value.getName(),
        })
      ),
    ];
  });

/**
 * Assembles models into wired SQLite tables and RQBv2 relations.
 *
 * **When to use**
 *
 * Use when models share references or callers need one Drizzle schema object
 * for migrations and relational queries. Use `toSqliteTable` for a standalone
 * model without cross-model wiring.
 *
 * **Details**
 *
 * Assembly validates every foreign key, projects all tables, applies generated
 * enum checks and declared extras, then derives relations deterministically.
 *
 * **Gotchas**
 *
 * SQLite has no native named enum object. Each enum field becomes a table-local
 * `CHECK`, so repeating one logical enum across tables duplicates its constraint.
 * Foreign-key equality still requires matching storage identity and carrier.
 * Self-referential junctions emit direct and reverse relations only;
 * through-relation naming remains deferred. References resolve an exact registry
 * key first, otherwise one unique physical table name. Physical names are unique.
 * Compile-time validation recognizes registry keys; physical-name fallback is
 * runtime-only until model statics preserve literal table names.
 *
 * **Example** (Assemble one model)
 *
 * ```ts
 * import { String } from "effect/Schema"
 * import { getTableName } from "drizzle-orm"
 * import { Model, schema } from "@beep/effect-drizzle/sqlite"
 *
 * class User extends Model<User>("User")({ name: String }) {}
 * const assembly = schema({ user: User })
 *
 * getTableName(assembly.tables.user) // => "user"
 * ```
 *
 * @see {@link ValidateSchema} for compile-time reference validation.
 * @category factories
 * @since 0.0.0
 */
export function schema<const Models extends ModelRecord>(models: Models & ValidateSchema<Models>): Assembly<Models>;
export function schema(models: ModelRecord): unknown {
  validatePhysicalTableNames(models, "sqlite", fail);
  const edges = collectEdges(models);
  // Drizzle evaluates extra-config callbacks lazily. Reassigning this registry
  // lets callbacks created for earlier tables see forward and self references
  // after every table has been projected.
  let runtimeTables = empty<string, TableOf<AnyModel>>();

  forEach(Object.entries(models), ([key, model]) => {
    runtimeTables = set(
      runtimeTables,
      key,
      toSqliteTableWithOptions({
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
              if (!isDrizzleEntity(targetColumn, DrizzleSqliteColumn)) {
                return fail(
                  "Resolved foreign-key target is not a SQLite column.",
                  key,
                  edge.sourceField,
                  edge.targetKey
                );
              }
              const builder = foreignKey({
                columns: [columns[edge.sourceField]],
                foreignColumns: [targetColumn],
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
      })
    );
  });

  const tables = runtimeTables;
  validateSchemaNames(collectSchemaNames(tables), "sqlite", fail);
  const junctions = collectJunctions(tables, edges);
  const relationsConfig = makeRelationsConfig(models, tables, edges, junctions, fail);

  return {
    models,
    tables,
    relationsConfig,
    relations: defineRelations(tables, relationsConfig),
  };
}
