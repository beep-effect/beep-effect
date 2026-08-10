/** Cross-model BSL schema assembly: typed FK validation, DDL, and RQBv2 relations. */
import { $ScratchpadId } from "@beep/identity";
import { TaggedErrorClass } from "@beep/schema";
import { Str } from "@beep/utils";
import {
  type AnyRelation,
  defineRelations,
  is as isDrizzleEntity,
  type RelationsBuilder,
  type RelationsBuilderConfig,
} from "drizzle-orm";
import { foreignKey, PgColumn as DrizzlePgColumn } from "drizzle-orm/pg-core";
import * as A from "effect/Array";
import * as Eq from "effect/Equal";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Derive from "./derive.ts";
import * as Field from "./Field.ts";
import type { AnyModel, FieldsInput } from "./factory.ts";
import * as Meta from "./Meta.ts";
import * as PgColumn from "./PgColumn.ts";
import { type EnumRegistry, type TableOf, toPgTable } from "./table.ts";

const $I = $ScratchpadId.create("bsl/schema");

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
export class SchemaAssemblyError extends TaggedErrorClass<SchemaAssemblyError>(
  $I`SchemaAssemblyError`
)(
  "SchemaAssemblyError",
  {
    message: S.String,
    sourceTable: S.String,
    fieldName: S.String,
    targetTable: S.String,
  },
  $I.annote("SchemaAssemblyError", {
    description:
      "A BSL cross-table reference could not be resolved or validated.",
  })
) {}

/**
 * String-keyed collection of BSL models accepted by {@link schema}.
 *
 * **Example** (Accept a model registry)
 *
 * ```ts
 * import { Struct } from "@beep/utils"
 * import type { ModelRecord } from "./schema.ts"
 *
 * const names = (models: ModelRecord) => Struct.keys(models)
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
  readonly bsl: { readonly fields: infer F extends FieldsInput };
}
  ? F
  : never;
type ColumnsOf<M> = M extends { readonly bsl: { readonly columns: infer C } }
  ? C
  : never;
type SpecAt<M, K extends PropertyKey> = K extends keyof ColumnsOf<M>
  ? ColumnsOf<M>[K] extends { readonly column: infer C extends PgColumn.Spec }
    ? C
    : never
  : never;

type CarrierEquals<A extends PgColumn.Spec, B extends PgColumn.Spec> = [
  PgColumn.CarrierOf<A>
] extends [PgColumn.CarrierOf<B>]
  ? [PgColumn.CarrierOf<B>] extends [PgColumn.CarrierOf<A>]
    ? true
    : false
  : false;

type ReferenceFailure<
  Models extends ModelRecord,
  M,
  K extends keyof FieldsOf<M>
> = K extends keyof ColumnsOf<M>
  ? ColumnsOf<M>[K] extends { readonly references: infer Ref }
    ? Ref extends Meta.References<infer TargetTable, infer TargetColumn>
      ? TargetTable extends keyof Models
        ? TargetColumn extends keyof FieldsOf<Models[TargetTable]>
          ? SpecAt<M, K> extends infer SourceSpec extends PgColumn.Spec
            ? SpecAt<
                Models[TargetTable],
                TargetColumn
              > extends infer TargetSpec extends PgColumn.Spec
              ? PgColumn.IdentEquals<SourceSpec, TargetSpec> extends true
                ? CarrierEquals<SourceSpec, TargetSpec> extends true
                  ? never
                  : Field.BslTypeError<"foreign-key encoded carriers are incompatible">
                : Field.BslTypeError<"foreign-key SQL identities do not match">
              : Field.BslTypeError<"foreign-key target has no resolved column">
            : Field.BslTypeError<"foreign-key source has no resolved column">
          : Field.BslTypeError<"foreign-key target column is missing">
        : Field.BslTypeError<`foreign-key target table '${TargetTable}' is missing from Bsl.schema`>
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
export type ValidateSchema<Models extends ModelRecord> = [
  SchemaFailures<Models>
] extends [never]
  ? unknown
  : SchemaFailures<Models>;

/**
 * Key-preserving Drizzle table projection of a BSL model registry.
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
 * Drizzle RQBv2 relation-builder callback for a BSL model registry.
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
  helpers: RelationsBuilder<TablesOf<Models>>
) => RelationsBuilderConfig<TablesOf<Models>>;

/**
 * Complete cross-model BSL assembly returned by {@link schema}.
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

const Edge = S.Struct({
  sourceKey: S.NonEmptyString,
  sourceField: S.NonEmptyString,
  targetKey: S.NonEmptyString,
  targetField: S.NonEmptyString,
  relationName: S.NonEmptyString,
  optional: S.Boolean,
  reference: Meta.References,
}).pipe(
  $I.annoteSchema("Edge", {
    description:
      "Resolved directed foreign-key edge used for table and relation assembly.",
  })
);
type Edge = typeof Edge.Type;

const relationName = (fieldName: string): string =>
  Str.endsWith("Id")(fieldName)
    ? Str.slice(0, -2)(fieldName)
    : `${fieldName}Relation`;

const fail = (
  message: string,
  sourceTable: string,
  fieldName: string,
  targetTable: string
): never => {
  throw SchemaAssemblyError.make({
    message,
    sourceTable,
    fieldName,
    targetTable,
  });
};

const targetFieldKey = (
  model: AnyModel,
  columnName: string
): O.Option<string> =>
  P.hasProperty(model.bsl.fields, columnName)
    ? O.some(columnName)
    : A.findFirst(R.keys(model.bsl.columns), (key) =>
        O.exists(
          R.get(model.bsl.columns, key),
          (meta) =>
            Eq.equals(meta.columnName, columnName) ||
            Eq.equals(Str.snakeCase(key), columnName)
        )
      );

const collectEnums = (models: ModelRecord): EnumRegistry =>
  A.reduce(
    R.toEntries(models),
    R.empty<string, PgColumn.EnumInstance>(),
    (enums, [modelKey, model]) =>
      A.reduce(
        R.toEntries(model.bsl.columns),
        enums,
        (current, [fieldName, meta]) => {
          const column = meta.column;
          if (!PgColumn.Spec.guards.enum(column)) return current;
          if (Eq.equals(column.name, "")) {
            return fail(
              "Enum name was not resolved during model construction.",
              modelKey,
              fieldName,
              "(enum)"
            );
          }
          return O.match(R.get(current, column.name), {
            onNone: () =>
              R.set(current, column.name, PgColumn.Enum.toDrizzleEnum(column)),
            onSome: (existing) => {
              if (!Eq.equals(existing.enumValues, column.values)) {
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
        }
      )
  );

const collectEdges = (models: ModelRecord): ReadonlyArray<Edge> => {
  const entries = R.toEntries(models);
  return A.flatMap(entries, ([sourceKey, model]) =>
    A.getSomes(
      A.map(R.keys<string, Field.Input>(model.bsl.fields), (sourceField) =>
        O.map(
          O.flatMap(R.get(model.bsl.columns, sourceField), (meta) =>
            O.fromUndefinedOr(meta.references)
          ),
          (reference) => {
            const [targetKey, targetModel] = O.getOrElse(
              A.findFirst(
                entries,
                ([key, target]) =>
                  Eq.equals(key, reference.tableName) ||
                  Eq.equals(target.bsl.tableName, reference.tableName)
              ),
              () =>
                fail(
                  `Reference target table '${reference.tableName}' is missing from Bsl.schema.`,
                  sourceKey,
                  sourceField,
                  reference.tableName
                )
            );
            const targetField = O.getOrElse(
              targetFieldKey(targetModel, reference.columnName),
              () =>
                fail(
                  `Reference target column '${reference.columnName}' is missing from '${reference.tableName}'.`,
                  sourceKey,
                  sourceField,
                  reference.tableName
                )
            );
            const sourceSpec = O.getOrElse(
              O.flatMap(R.get(model.bsl.columns, sourceField), (meta) =>
                O.fromUndefinedOr(meta.column)
              ),
              () =>
                fail(
                  "Foreign-key source column must be resolved before assembly.",
                  sourceKey,
                  sourceField,
                  reference.tableName
                )
            );
            const targetSpec = O.getOrElse(
              O.flatMap(R.get(targetModel.bsl.columns, targetField), (meta) =>
                O.fromUndefinedOr(meta.column)
              ),
              () =>
                fail(
                  "Foreign-key target column must be resolved before assembly.",
                  sourceKey,
                  sourceField,
                  reference.tableName
                )
            );
            if (
              !Eq.equals(sourceSpec.ident, targetSpec.ident) ||
              !Eq.equals(
                PgColumn.carrierTag(sourceSpec),
                PgColumn.carrierTag(targetSpec)
              )
            ) {
              fail(
                `Foreign key '${sourceKey}.${sourceField}' (${sourceSpec.ident}) cannot reference '${targetKey}.${targetField}' (${targetSpec.ident}).`,
                sourceKey,
                sourceField,
                reference.tableName
              );
            }
            const sourceSchema = O.getOrElse(
              O.fromUndefinedOr(model.bsl.fields[sourceField]),
              () =>
                fail(
                  "Foreign-key source field is missing.",
                  sourceKey,
                  sourceField,
                  reference.tableName
                )
            );
            return Edge.make({
              sourceKey,
              sourceField,
              targetKey,
              targetField,
              relationName: relationName(sourceField),
              optional: Derive.isNullable(Field.from(sourceSchema).schema),
              reference,
            });
          }
        )
      )
    )
  );
};

/**
 * Assemble models into mutually wired Drizzle tables and RQBv2 relations.
 *
 * **Example** (Assemble one model)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { Model } from "./factory.ts"
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
  models: Models & ValidateSchema<Models>
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
              const targetTable = O.getOrElse(
                R.get(runtimeTables, edge.targetKey),
                () =>
                  fail(
                    "Resolved foreign-key table or column is unavailable.",
                    key,
                    edge.sourceField,
                    edge.targetKey
                  )
              );
              if (!P.hasProperty(targetTable, edge.targetField)) {
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
              const builder = foreignKey({
                columns: [columns[edge.sourceField]],
                foreignColumns: [targetColumn],
              });
              const withDelete = O.match(
                O.fromUndefinedOr(edge.reference.onDelete),
                {
                  onNone: () => builder,
                  onSome: (action) => builder.onDelete(action),
                }
              );
              return O.match(O.fromUndefinedOr(edge.reference.onUpdate), {
                onNone: () => withDelete,
                onSome: (action) => withDelete.onUpdate(action),
              });
            }
          ),
        enums
      )
    );
  });

  const tables = runtimeTables;
  const relationsConfig = (
    helpers: RelationsBuilder<typeof tables>
  ): RelationsBuilderConfig<typeof tables> =>
    A.reduce(
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
            edge.targetKey
          )
        );
        if (
          !P.hasProperty(source, edge.sourceField) ||
          !P.hasProperty(target, edge.targetField)
        ) {
          return fail(
            "defineRelations helper is missing a resolved table.",
            edge.sourceKey,
            edge.sourceField,
            edge.targetKey
          );
        }
        const sourceColumn = source[edge.sourceField];
        const targetColumn = target[edge.targetField];
        const relations = O.getOrElse(R.get(config, edge.sourceKey), () =>
          R.empty<string, AnyRelation>()
        );
        return R.set(
          config,
          edge.sourceKey,
          R.set(
            relations,
            edge.relationName,
            one({
              from: sourceColumn,
              to: targetColumn,
              optional: edge.optional,
              alias: `${edge.sourceKey}_${edge.sourceField}_${edge.targetKey}`,
            })
          )
        );
      }
    );

  return {
    models,
    enums,
    tables,
    relationsConfig,
    relations: defineRelations(tables, relationsConfig),
  };
}
