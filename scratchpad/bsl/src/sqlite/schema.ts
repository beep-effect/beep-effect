/**
 * Assembles SQLite models into validated Drizzle schema objects.
 *
 * The assembler resolves foreign keys, projects tables, and derives RQBv2
 * relations while preserving SQLite's storage-class constraints.
 *
 * @since 0.0.0
 */
import {
  defineRelations,
  is as isDrizzleEntity,
  type RelationsBuilder,
  type RelationsBuilderConfig,
} from "drizzle-orm";
import { foreignKey, SQLiteColumn as DrizzleSqliteColumn } from "drizzle-orm/sqlite-core";
import { getTableConfig } from "drizzle-orm/sqlite-core";
import {
  contains,
  findFirst,
  flatMap as flatMapArray,
  forEach,
  get as getArray,
  getSomes,
  head,
} from "effect/Array";
import { equals } from "effect/Equal";
import {
  exists,
  flatMap as flatMapOption,
  fromUndefinedOr,
  getOrElse,
  map,
  match,
  none,
  some,
} from "effect/Option";
import type { Option } from "effect/Option";
import { hasProperty, isUndefined } from "effect/Predicate";
import { empty, get as getRecord, set } from "effect/Record";
import { String as StringSchema, TaggedError } from "effect/Schema";
import {
  type Edge,
  type Junction,
  makeRelationsConfig,
  relationName,
} from "../core/assembly.ts";
import { snakeCase } from "../internal/case.ts";
import * as Derive from "./derive.ts";
import * as Field from "../core/Field.ts";
import type { AnyModel, FieldsInput } from "./model.ts";
import * as Meta from "../core/Meta.ts";
import * as SqliteColumn from "./Column.ts";
import { type TableOf, toSqliteTable } from "./table.ts";

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
export class SchemaAssemblyError extends TaggedError<SchemaAssemblyError>(
  "@beep/effect-drizzle/SchemaAssemblyError",
)(
  "SchemaAssemblyError",
  {
    message: StringSchema,
    sourceTable: StringSchema,
    fieldName: StringSchema,
    targetTable: StringSchema,
  },
  {
    description: "A @beep/effect-drizzle cross-table reference could not be resolved or validated.",
  },
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

type ReferenceFailure<
  Models extends ModelRecord,
  M,
  K extends keyof FieldsOf<M>,
> = K extends keyof ColumnsOf<M>
  ? ColumnsOf<M>[K] extends { readonly references: infer Ref }
    ? Ref extends Meta.References<infer TargetTable, infer TargetColumn>
      ? TargetTable extends keyof Models
        ? TargetColumn extends keyof FieldsOf<Models[TargetTable]>
          ? SpecAt<M, K> extends infer SourceSpec extends SqliteColumn.Spec
            ? SpecAt<Models[TargetTable], TargetColumn> extends infer TargetSpec extends
                SqliteColumn.Spec
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
                  ? never
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
    readonly [FieldKey in keyof FieldsOf<Models[ModelKey]>]: ReferenceFailure<
      Models,
      Models[ModelKey],
      FieldKey
    >;
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
  helpers: RelationsBuilder<TablesOf<Models>>,
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
  readonly tables: TablesOf<Models>;
  readonly relationsConfig: RelationsConfig<Models>;
  readonly relations: ReturnType<typeof defineRelations>;
}

const fail = (
  message: string,
  sourceTable: string,
  fieldName: string,
  targetTable: string,
): never => {
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
          (meta) => meta.columnName === columnName || snakeCase(key) === columnName,
        ),
      );

const collectEdges = (models: ModelRecord): ReadonlyArray<Edge> => {
  const entries = Object.entries(models);
  return flatMapArray(entries, ([sourceKey, model]) =>
    getSomes(
      Object.keys(model.sql.fields).map((sourceField) =>
        map(
          flatMapOption(getRecord(model.sql.columns, sourceField), (meta) =>
            fromUndefinedOr(meta.references),
          ),
          (reference) => {
            const [targetKey, targetModel] = getOrElse(
              findFirst(
                entries,
                ([key, target]) =>
                  key === reference.tableName || target.sql.tableName === reference.tableName,
              ),
              () =>
                fail(
                  `Reference target table '${reference.tableName}' is missing from EffectDrizzle.schema.`,
                  sourceKey,
                  sourceField,
                  reference.tableName,
                ),
            );
            const targetField = getOrElse(targetFieldKey(targetModel, reference.columnName), () =>
              fail(
                `Reference target column '${reference.columnName}' is missing from '${reference.tableName}'.`,
                sourceKey,
                sourceField,
                reference.tableName,
              ),
            );
            const sourceMeta = getOrElse(getRecord(model.sql.columns, sourceField), () =>
              fail(
                "Foreign-key source metadata must be resolved before assembly.",
                sourceKey,
                sourceField,
                reference.tableName,
              ),
            );
            const targetMeta = getOrElse(getRecord(targetModel.sql.columns, targetField), () =>
              fail(
                "Foreign-key target metadata must be resolved before assembly.",
                sourceKey,
                sourceField,
                reference.tableName,
              ),
            );
            const sourceSpec = getOrElse(fromUndefinedOr(sourceMeta.column), () =>
              fail(
                "Foreign-key source column must be resolved before assembly.",
                sourceKey,
                sourceField,
                reference.tableName,
              ),
            );
            const targetSpec = getOrElse(fromUndefinedOr(targetMeta.column), () =>
              fail(
                "Foreign-key target column must be resolved before assembly.",
                sourceKey,
                sourceField,
                reference.tableName,
              ),
            );
            if (
              SqliteColumn.storageIdent(sourceSpec, sourceMeta.dimensions) !==
                SqliteColumn.storageIdent(targetSpec, targetMeta.dimensions) ||
              !equals(
                SqliteColumn.carrier(sourceSpec, sourceMeta.dimensions),
                SqliteColumn.carrier(targetSpec, targetMeta.dimensions),
              )
            ) {
              fail(
                `Foreign key '${sourceKey}.${sourceField}' (${SqliteColumn.storageIdent(
                  sourceSpec,
                  sourceMeta.dimensions,
                )}) cannot reference '${targetKey}.${targetField}' (${SqliteColumn.storageIdent(
                  targetSpec,
                  targetMeta.dimensions,
                )}).`,
                sourceKey,
                sourceField,
                reference.tableName,
              );
            }
            const sourceSchema = getOrElse(fromUndefinedOr(model.sql.fields[sourceField]), () =>
              fail(
                "Foreign-key source field is missing.",
                sourceKey,
                sourceField,
                reference.tableName,
              ),
            );
            return {
              sourceKey,
              sourceField,
              targetKey,
              targetField,
              relationName: relationName(sourceField),
              optional: Derive.isNullable(Field.from(sourceSchema).schema),
              reference,
            };
          },
        ),
      ),
    ),
  );
};

const collectJunctions = (
  tables: Readonly<Record<string, TableOf<AnyModel>>>,
  edges: ReadonlyArray<Edge>,
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
          }),
        )
      ) {
        return none();
      }
      const left = getOrElse(head(primaryEdges), () =>
        fail(
          "Junction is missing its first foreign-key edge.",
          key,
          "(composite primary key)",
          "(junction)",
        ),
      );
      const right = getOrElse(getArray(primaryEdges, 1), () =>
        fail(
          "Junction is missing its second foreign-key edge.",
          key,
          "(composite primary key)",
          "(junction)",
        ),
      );
      return left.targetKey === right.targetKey ? none() : some({ key, left, right });
    }),
  );

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
export function schema<const Models extends ModelRecord>(
  models: Models & ValidateSchema<Models>,
): Assembly<Models>;
export function schema(models: ModelRecord): unknown {
  const edges = collectEdges(models);
  // Drizzle evaluates extra-config callbacks lazily. Reassigning this registry
  // lets callbacks created for earlier tables see forward and self references
  // after every table has been projected.
  let runtimeTables = empty<string, TableOf<AnyModel>>();

  forEach(Object.entries(models), ([key, model]) => {
    runtimeTables = set(
      runtimeTables,
      key,
      toSqliteTable(
        model,
        (columns) =>
          edges
            .filter((edge) => edge.sourceKey === key)
            .map((edge) => {
              const targetTable = getOrElse(getRecord(runtimeTables, edge.targetKey), () =>
                fail(
                  "Resolved foreign-key table or column is unavailable.",
                  key,
                  edge.sourceField,
                  edge.targetKey,
                ),
              );
              if (!hasProperty(targetTable, edge.targetField)) {
                return fail(
                  "Resolved foreign-key table or column is unavailable.",
                  key,
                  edge.sourceField,
                  edge.targetKey,
                );
              }
              const targetColumn = targetTable[edge.targetField];
              if (!isDrizzleEntity(targetColumn, DrizzleSqliteColumn)) {
                return fail(
                  "Resolved foreign-key target is not a SQLite column.",
                  key,
                  edge.sourceField,
                  edge.targetKey,
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
      ),
    );
  });

  const tables = runtimeTables;
  const junctions = collectJunctions(tables, edges);
  const relationsConfig = makeRelationsConfig(models, tables, edges, junctions, fail);

  return {
    models,
    tables,
    relationsConfig,
    relations: defineRelations(tables, relationsConfig),
  };
}
