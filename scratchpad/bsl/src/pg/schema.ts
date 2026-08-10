/** Cross-model @beep/effect-drizzle schema assembly: typed FK validation, DDL, and RQBv2 relations. */
import {
  type AnyRelation,
  defineRelations,
  is as isDrizzleEntity,
  type RelationsBuilder,
  RelationsBuilderColumn,
  type RelationsBuilderConfig,
} from "drizzle-orm";
import { foreignKey, PgColumn as DrizzlePgColumn } from "drizzle-orm/pg-core";
import { getTableConfig } from "drizzle-orm/pg-core";
import * as A from "effect/Array";
import * as Eq from "effect/Equal";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import {
  type Edge,
  type Junction,
  plural,
  relationAlias,
  relationName,
  reverseRelationName,
} from "../core/assembly.ts";
import { camelCase, snakeCase } from "../internal/case.ts";
import * as Derive from "./derive.ts";
import * as Field from "../core/Field.ts";
import type { AnyModel, FieldsInput } from "./model.ts";
import * as Meta from "../core/Meta.ts";
import * as PgColumn from "./Column.ts";
import { type EnumRegistry, type TableOf, toPgTable } from "./table.ts";

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
export class SchemaAssemblyError extends S.TaggedError<SchemaAssemblyError>(
  "@beep/effect-drizzle/SchemaAssemblyError",
)(
  "SchemaAssemblyError",
  {
    message: S.String,
    sourceTable: S.String,
    fieldName: S.String,
    targetTable: S.String,
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
 * import * as R from "effect/Record"
 * import type { ModelRecord } from "./schema.ts"
 *
 * const names = (models: ModelRecord) => R.keys(models)
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

type ReferenceFailure<
  Models extends ModelRecord,
  M,
  K extends keyof FieldsOf<M>,
> = K extends keyof ColumnsOf<M>
  ? ColumnsOf<M>[K] extends { readonly references: infer Ref }
    ? Ref extends Meta.References<infer TargetTable, infer TargetColumn>
      ? TargetTable extends keyof Models
        ? TargetColumn extends keyof FieldsOf<Models[TargetTable]>
          ? SpecAt<M, K> extends infer SourceSpec extends PgColumn.Spec
            ? SpecAt<Models[TargetTable], TargetColumn> extends infer TargetSpec extends
                PgColumn.Spec
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
  readonly enums: EnumRegistry;
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

const targetFieldKey = (model: AnyModel, columnName: string): O.Option<string> =>
  P.hasProperty(model.sql.fields, columnName)
    ? O.some(columnName)
    : A.findFirst(R.keys(model.sql.columns), (key) =>
        O.exists(
          R.get(model.sql.columns, key),
          (meta) => Eq.equals(meta.columnName, columnName) || Eq.equals(snakeCase(key), columnName),
        ),
      );

const collectEnums = (models: ModelRecord): EnumRegistry =>
  A.reduce(
    R.toEntries(models),
    R.empty<string, PgColumn.EnumInstance>(),
    (enums, [modelKey, model]) =>
      A.reduce(R.toEntries(model.sql.columns), enums, (current, [fieldName, meta]) => {
        const column = meta.column;
        if (!PgColumn.Spec.guards.enum(column)) return current;
        if (Eq.equals(column.name, "")) {
          return fail(
            "Enum name was not resolved during model construction.",
            modelKey,
            fieldName,
            "(enum)",
          );
        }
        return O.match(R.get(current, column.name), {
          onNone: () => R.set(current, column.name, PgColumn.Enum.toDrizzleEnum(column)),
          onSome: (existing) => {
            if (!Eq.equals(existing.enumValues, column.values)) {
              return fail(
                `PostgreSQL enum '${column.name}' is declared with incompatible values.`,
                modelKey,
                fieldName,
                column.name,
              );
            }
            return current;
          },
        });
      }),
  );

const collectEdges = (models: ModelRecord): ReadonlyArray<Edge> => {
  const entries = R.toEntries(models);
  return A.flatMap(entries, ([sourceKey, model]) =>
    A.getSomes(
      A.map(R.keys<string, Field.Input>(model.sql.fields), (sourceField) =>
        O.map(
          O.flatMap(R.get(model.sql.columns, sourceField), (meta) =>
            O.fromUndefinedOr(meta.references),
          ),
          (reference) => {
            const [targetKey, targetModel] = O.getOrElse(
              A.findFirst(
                entries,
                ([key, target]) =>
                  Eq.equals(key, reference.tableName) ||
                  Eq.equals(target.sql.tableName, reference.tableName),
              ),
              () =>
                fail(
                  `Reference target table '${reference.tableName}' is missing from EffectDrizzle.schema.`,
                  sourceKey,
                  sourceField,
                  reference.tableName,
                ),
            );
            const targetField = O.getOrElse(targetFieldKey(targetModel, reference.columnName), () =>
              fail(
                `Reference target column '${reference.columnName}' is missing from '${reference.tableName}'.`,
                sourceKey,
                sourceField,
                reference.tableName,
              ),
            );
            const sourceMeta = O.getOrElse(R.get(model.sql.columns, sourceField), () =>
              fail(
                "Foreign-key source metadata must be resolved before assembly.",
                sourceKey,
                sourceField,
                reference.tableName,
              ),
            );
            const targetMeta = O.getOrElse(R.get(targetModel.sql.columns, targetField), () =>
              fail(
                "Foreign-key target metadata must be resolved before assembly.",
                sourceKey,
                sourceField,
                reference.tableName,
              ),
            );
            const sourceSpec = O.getOrElse(O.fromUndefinedOr(sourceMeta.column), () =>
              fail(
                "Foreign-key source column must be resolved before assembly.",
                sourceKey,
                sourceField,
                reference.tableName,
              ),
            );
            const targetSpec = O.getOrElse(O.fromUndefinedOr(targetMeta.column), () =>
              fail(
                "Foreign-key target column must be resolved before assembly.",
                sourceKey,
                sourceField,
                reference.tableName,
              ),
            );
            if (
              !Eq.equals(
                PgColumn.storageIdent(sourceSpec, sourceMeta.dimensions),
                PgColumn.storageIdent(targetSpec, targetMeta.dimensions),
              ) ||
              !Eq.equals(
                PgColumn.carrier(sourceSpec, sourceMeta.dimensions),
                PgColumn.carrier(targetSpec, targetMeta.dimensions),
              )
            ) {
              fail(
                `Foreign key '${sourceKey}.${sourceField}' (${PgColumn.storageIdent(sourceSpec, sourceMeta.dimensions)}) cannot reference '${targetKey}.${targetField}' (${PgColumn.storageIdent(targetSpec, targetMeta.dimensions)}).`,
                sourceKey,
                sourceField,
                reference.tableName,
              );
            }
            const sourceSchema = O.getOrElse(O.fromUndefinedOr(model.sql.fields[sourceField]), () =>
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
  A.getSomes(
    A.map(R.toEntries(tables), ([key, table]) => {
      const primaryKeys = getTableConfig(table).primaryKeys;
      if (primaryKeys.length !== 1) return O.none();
      const columns = primaryKeys[0]?.columns;
      if (P.isUndefined(columns) || columns.length !== 2) return O.none();
      const columnNames = A.map(columns, (column) => column.name);
      const candidates = A.filter(edges, (edge) => Eq.equals(edge.sourceKey, key));
      const primaryEdges = A.filter(candidates, (edge) => {
        if (!P.hasProperty(table, edge.sourceField)) return false;
        const column = table[edge.sourceField];
        return isDrizzleEntity(column, DrizzlePgColumn) && A.contains(columnNames, column.name);
      });
      if (
        primaryEdges.length !== 2 ||
        !A.every(columnNames, (name) =>
          A.some(primaryEdges, (edge) => {
            if (!P.hasProperty(table, edge.sourceField)) return false;
            const column = table[edge.sourceField];
            return isDrizzleEntity(column, DrizzlePgColumn) ? Eq.equals(column.name, name) : false;
          }),
        )
      ) {
        return O.none();
      }
      const left = O.getOrElse(A.head(primaryEdges), () =>
        fail(
          "Junction is missing its first foreign-key edge.",
          key,
          "(composite primary key)",
          "(junction)",
        ),
      );
      const right = O.getOrElse(A.get(primaryEdges, 1), () =>
        fail(
          "Junction is missing its second foreign-key edge.",
          key,
          "(composite primary key)",
          "(junction)",
        ),
      );
      return Eq.equals(left.targetKey, right.targetKey) ? O.none() : O.some({ key, left, right });
    }),
  );

const throughRelationName = (targetKey: string, junctionKey: string): string =>
  `${plural(targetKey)}Through${Str.capitalize(camelCase(junctionKey))}`;

const addRelation = (
  models: ModelRecord,
  config: Record<string, Record<string, AnyRelation>>,
  tableKey: string,
  name: string,
  fieldName: string,
  targetTable: string,
  relation: AnyRelation,
): Record<string, Record<string, AnyRelation>> => {
  const model = O.getOrElse(O.fromUndefinedOr(models[tableKey]), () =>
    fail(
      "Relation source model is missing from EffectDrizzle.schema.",
      tableKey,
      fieldName,
      targetTable,
    ),
  );
  const relations = O.getOrElse(R.get(config, tableKey), () => R.empty<string, AnyRelation>());
  if (P.hasProperty(model.sql.fields, name) || P.hasProperty(relations, name)) {
    return fail(
      `Relation name '${tableKey}.${name}' collides with an existing field or relation.`,
      tableKey,
      fieldName,
      targetTable,
    );
  }
  return R.set(config, tableKey, R.set(relations, name, relation));
};

/**
 * Assemble models into mutually wired Drizzle tables and RQBv2 relations.
 *
 * **Example** (Assemble one model)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { Model } from "./model.ts"
 * import { schema } from "./schema.ts"
 *
 * class User extends Model<User>("User")({ name: S.String }) {}
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
  const enums = collectEnums(models);
  const edges = collectEdges(models);
  // Drizzle evaluates extra-config callbacks lazily. Reassigning this registry
  // lets callbacks created for earlier tables see forward and self references
  // after every table has been projected.
  let runtimeTables = R.empty<string, TableOf<AnyModel>>();

  A.forEach(R.toEntries(models), ([key, model]) => {
    runtimeTables = R.set(
      runtimeTables,
      key,
      toPgTable(
        model,
        (columns) =>
          A.map(
            A.filter(edges, (edge) => Eq.equals(edge.sourceKey, key)),
            (edge) => {
              const targetTable = O.getOrElse(R.get(runtimeTables, edge.targetKey), () =>
                fail(
                  "Resolved foreign-key table or column is unavailable.",
                  key,
                  edge.sourceField,
                  edge.targetKey,
                ),
              );
              if (!P.hasProperty(targetTable, edge.targetField)) {
                return fail(
                  "Resolved foreign-key table or column is unavailable.",
                  key,
                  edge.sourceField,
                  edge.targetKey,
                );
              }
              const targetColumn = targetTable[edge.targetField];
              if (!isDrizzleEntity(targetColumn, DrizzlePgColumn)) {
                return fail(
                  "Resolved foreign-key target is not a PostgreSQL column.",
                  key,
                  edge.sourceField,
                  edge.targetKey,
                );
              }
              const builder = foreignKey({
                columns: [columns[edge.sourceField]],
                foreignColumns: [targetColumn],
              });
              const withDelete = O.match(O.fromUndefinedOr(edge.reference.onDelete), {
                onNone: () => builder,
                onSome: (action) => builder.onDelete(action),
              });
              return O.match(O.fromUndefinedOr(edge.reference.onUpdate), {
                onNone: () => withDelete,
                onSome: (action) => withDelete.onUpdate(action),
              });
            },
          ),
        enums,
      ),
    );
  });

  const tables = runtimeTables;
  const junctions = collectJunctions(tables, edges);
  const relationsConfig = (
    helpers: RelationsBuilder<typeof tables>,
  ): RelationsBuilderConfig<typeof tables> => {
    const direct = A.reduce(
      edges,
      R.empty<string, Record<string, AnyRelation>>(),
      (config, edge) => {
        const source = helpers[edge.sourceKey];
        const target = helpers[edge.targetKey];
        const one = O.getOrElse(R.get(helpers.one, edge.targetKey), () =>
          fail(
            "defineRelations helper is missing a resolved table.",
            edge.sourceKey,
            edge.sourceField,
            edge.targetKey,
          ),
        );
        const many = O.getOrElse(R.get(helpers.many, edge.sourceKey), () =>
          fail(
            "defineRelations reverse-many helper is missing a resolved table.",
            edge.targetKey,
            edge.sourceField,
            edge.sourceKey,
          ),
        );
        if (!P.hasProperty(source, edge.sourceField) || !P.hasProperty(target, edge.targetField)) {
          return fail(
            "defineRelations helper is missing a resolved table.",
            edge.sourceKey,
            edge.sourceField,
            edge.targetKey,
          );
        }
        const sourceColumn = source[edge.sourceField];
        const targetColumn = target[edge.targetField];
        const alias = relationAlias(edge);
        const withForward = addRelation(
          models,
          config,
          edge.sourceKey,
          edge.relationName,
          edge.sourceField,
          edge.targetKey,
          one({
            from: sourceColumn,
            to: targetColumn,
            optional: edge.optional,
            alias,
          }),
        );
        return addRelation(
          models,
          withForward,
          edge.targetKey,
          reverseRelationName(edge, edges),
          edge.sourceField,
          edge.sourceKey,
          many({ alias }),
        );
      },
    );

    return A.reduce(junctions, direct, (config, junction) => {
      const junctionTable = helpers[junction.key];
      const leftTable = helpers[junction.left.targetKey];
      const rightTable = helpers[junction.right.targetKey];
      const manyRight = O.getOrElse(R.get(helpers.many, junction.right.targetKey), () =>
        fail(
          "defineRelations through helper is missing the right target table.",
          junction.left.targetKey,
          junction.left.sourceField,
          junction.right.targetKey,
        ),
      );
      const manyLeft = O.getOrElse(R.get(helpers.many, junction.left.targetKey), () =>
        fail(
          "defineRelations through helper is missing the left target table.",
          junction.right.targetKey,
          junction.right.sourceField,
          junction.left.targetKey,
        ),
      );
      if (
        !P.hasProperty(leftTable, junction.left.targetField) ||
        !P.hasProperty(rightTable, junction.right.targetField) ||
        !P.hasProperty(junctionTable, junction.left.sourceField) ||
        !P.hasProperty(junctionTable, junction.right.sourceField)
      ) {
        return fail(
          "defineRelations through helper is missing a resolved junction column.",
          junction.key,
          "(composite primary key)",
          "(junction)",
        );
      }
      const leftColumn = leftTable[junction.left.targetField];
      const rightColumn = rightTable[junction.right.targetField];
      const junctionLeftColumn = junctionTable[junction.left.sourceField];
      const junctionRightColumn = junctionTable[junction.right.sourceField];
      if (
        !isDrizzleEntity(leftColumn, RelationsBuilderColumn) ||
        !isDrizzleEntity(rightColumn, RelationsBuilderColumn) ||
        !isDrizzleEntity(junctionLeftColumn, RelationsBuilderColumn) ||
        !isDrizzleEntity(junctionRightColumn, RelationsBuilderColumn)
      ) {
        return fail(
          "defineRelations through helper did not expose relation columns.",
          junction.key,
          "(composite primary key)",
          "(junction)",
        );
      }
      const alias = `${junction.key}_${junction.left.targetKey}_${junction.right.targetKey}`;
      const withRight = addRelation(
        models,
        config,
        junction.left.targetKey,
        throughRelationName(junction.right.targetKey, junction.key),
        junction.left.sourceField,
        junction.right.targetKey,
        manyRight({
          from: leftColumn.through(junctionLeftColumn),
          to: rightColumn.through(junctionRightColumn),
          alias,
        }),
      );
      return addRelation(
        models,
        withRight,
        junction.right.targetKey,
        throughRelationName(junction.left.targetKey, junction.key),
        junction.right.sourceField,
        junction.left.targetKey,
        manyLeft({
          from: rightColumn.through(junctionRightColumn),
          to: leftColumn.through(junctionLeftColumn),
          alias,
        }),
      );
    });
  };

  return {
    models,
    enums,
    tables,
    relationsConfig,
    relations: defineRelations(tables, relationsConfig),
  };
}
