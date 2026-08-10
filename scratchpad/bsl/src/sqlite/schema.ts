/** Cross-model SQLite assembly: typed FK validation, DDL, and RQBv2 relations. */
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
 * Error raised when a cross-model reference cannot be resolved or validated.
 *
 * **Example** (Construct an assembly error)
 *
 * ```ts
 * import { SchemaAssemblyError } from "./schema.ts"
 *
 * const error = SchemaAssemblyError.make({
 *   message: "missing target",
 *   sourceTable: "user",
 *   fieldName: "orgId",
 *   targetTable: "organization"
 * })
 * console.log(error._tag) // "SchemaAssemblyError"
 * ```
 *
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
 * String-keyed collection of @beep/effect-drizzle models accepted by {@link schema}.
 *
 * **Example** (Accept a model registry)
 *
 * ```ts
 * import {  } from "effect/Record"
 * import type { ModelRecord } from "./schema.ts"
 *
 * const names = (models: ModelRecord) => Object.keys(models)
 * console.log(names)
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
 * No-op on success or a readable carrier for incompatible references.
 *
 * @category validation
 * @since 0.0.0
 */
export type ValidateSchema<Models extends ModelRecord> = [SchemaFailures<Models>] extends [never]
  ? unknown
  : SchemaFailures<Models>;

/**
 * Key-preserving Drizzle table projection of a @beep/effect-drizzle model registry.
 *
 * **Example** (Name a projected registry)
 *
 * ```ts
 * import type { ModelRecord, TablesOf } from "./schema.ts"
 *
 * type Tables = TablesOf<ModelRecord>
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type TablesOf<Models extends ModelRecord> = {
  readonly [K in keyof Models]: TableOf<Models[K]>;
};

/**
 * Drizzle RQBv2 relation-builder callback for a @beep/effect-drizzle model registry.
 *
 * **Example** (Name a relation config)
 *
 * ```ts
 * import type { ModelRecord, RelationsConfig } from "./schema.ts"
 *
 * type Config = RelationsConfig<ModelRecord>
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type RelationsConfig<Models extends ModelRecord> = (
  helpers: RelationsBuilder<TablesOf<Models>>,
) => RelationsBuilderConfig<TablesOf<Models>>;

/**
 * Complete cross-model @beep/effect-drizzle assembly returned by {@link schema}.
 *
 * **Example** (Read assembled tables)
 *
 * ```ts
 * import type { Assembly, ModelRecord } from "./schema.ts"
 *
 * declare const assembly: Assembly<ModelRecord>
 * console.log(assembly.tables)
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
 * Assemble models into mutually wired Drizzle tables and RQBv2 relations.
 *
 * **Example** (Assemble one model)
 *
 * ```ts
 * import { String } from "effect/Schema"
 * import { Model } from "./model.ts"
 * import { schema } from "./schema.ts"
 *
 * class User extends Model<User>("User")({ name: String }) {}
 * console.log(schema({ user: User }).tables.user !== undefined) // true
 * ```
 *
 * @category constructors
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
