/** Cross-model BSL schema assembly: typed FK validation, DDL, and RQBv2 relations. */
import { $ScratchpadId } from "@beep/identity";
import { TaggedErrorClass } from "@beep/schema";
import { Str } from "@beep/utils";
import {
  defineRelations,
  type RelationsBuilder,
  type RelationsBuilderConfig,
} from "drizzle-orm";
import {
  type AnyPgColumn,
  type AnyPgTable,
  foreignKey,
} from "drizzle-orm/pg-core";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Derive from "./derive.ts";
import * as Field from "./Field.ts";
import type { AnyModel, FieldsInput } from "./factory.ts";
import type * as Meta from "./Meta.ts";
import * as PgColumn from "./PgColumn.ts";
import { toPgTable, type TableOf } from "./table.ts";

const $I = $ScratchpadId.create("bsl/schema");

export class SchemaAssemblyError extends TaggedErrorClass<SchemaAssemblyError>($I`SchemaAssemblyError`)(
  "SchemaAssemblyError",
  {
    message: S.String,
    sourceTable: S.String,
    fieldName: S.String,
    targetTable: S.String,
  },
  $I.annote("SchemaAssemblyError", {
    description: "A BSL cross-table reference could not be resolved or validated.",
  })
) {}

export interface ModelRecord {
  readonly [key: string]: AnyModel;
}

type FieldsOf<M> = M extends { readonly bsl: { readonly fields: infer F extends FieldsInput } } ? F : never;
type ColumnsOf<M> = M extends { readonly bsl: { readonly columns: infer C } } ? C : never;
type SpecAt<M, K extends PropertyKey> = K extends keyof ColumnsOf<M>
  ? ColumnsOf<M>[K] extends { readonly column: infer C extends PgColumn.Spec }
    ? C
    : never
  : never;

type CarrierEquals<A extends PgColumn.Spec, B extends PgColumn.Spec> = [PgColumn.CarrierOf<A>] extends [
  PgColumn.CarrierOf<B>,
]
  ? [PgColumn.CarrierOf<B>] extends [PgColumn.CarrierOf<A>]
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

/** No-op on success; readable error carrier on the first incompatible reference union. */
export type ValidateSchema<Models extends ModelRecord> = [SchemaFailures<Models>] extends [never]
  ? unknown
  : SchemaFailures<Models>;

export type TablesOf<Models extends ModelRecord> = {
  readonly [K in keyof Models]: TableOf<Models[K]>;
};

export type RelationsConfig<Models extends ModelRecord> = (
  helpers: RelationsBuilder<TablesOf<Models>>
) => RelationsBuilderConfig<TablesOf<Models>>;

export interface Assembly<Models extends ModelRecord> {
  readonly models: Models;
  readonly tables: TablesOf<Models>;
  readonly relationsConfig: RelationsConfig<Models>;
  readonly relations: ReturnType<typeof defineRelations>;
}

interface Edge {
  readonly sourceKey: string;
  readonly sourceField: string;
  readonly targetKey: string;
  readonly targetField: string;
  readonly relationName: string;
  readonly optional: boolean;
  readonly reference: Meta.References;
}

interface RuntimeRelationHelper {
  readonly one: Record<
    string,
    (config: {
      readonly from: unknown;
      readonly to: unknown;
      readonly optional: boolean;
      readonly alias: string;
    }) => unknown
  >;
  readonly [tableName: string]: unknown;
}

const relationName = (fieldName: string): string =>
  Str.endsWith(fieldName, "Id") ? fieldName.slice(0, -2) : `${fieldName}Relation`;

const fail = (message: string, sourceTable: string, fieldName: string, targetTable: string): never => {
  throw SchemaAssemblyError.make({ message, sourceTable, fieldName, targetTable });
};

const targetFieldKey = (model: AnyModel, columnName: string): string | undefined => {
  if (P.hasProperty(model.bsl.fields, columnName)) return columnName;
  return Object.keys(model.bsl.columns).find((key) => {
    const meta = model.bsl.columns[key];
    return meta?.columnName === columnName || Str.snakeCase(key) === columnName;
  });
};

const collectEdges = (models: ModelRecord): ReadonlyArray<Edge> => {
  const entries = Object.entries(models);
  const edges: Array<Edge> = [];
  for (const [sourceKey, model] of entries) {
    for (const sourceField of Object.keys(model.bsl.fields)) {
      const reference = model.bsl.columns[sourceField]?.references;
      if (reference === undefined) continue;
      const targetEntry = entries.find(
        ([key, target]) => key === reference.tableName || target.bsl.tableName === reference.tableName
      );
      if (targetEntry === undefined) {
        return fail(
          `Reference target table '${reference.tableName}' is missing from Bsl.schema.`,
          sourceKey,
          sourceField,
          reference.tableName
        );
      }
      const [targetKey, targetModel] = targetEntry;
      const targetField = targetFieldKey(targetModel, reference.columnName);
      if (targetField === undefined) {
        return fail(
          `Reference target column '${reference.columnName}' is missing from '${reference.tableName}'.`,
          sourceKey,
          sourceField,
          reference.tableName
        );
      }
      const sourceSpec = model.bsl.columns[sourceField]?.column;
      const targetSpec = targetModel.bsl.columns[targetField]?.column;
      if (sourceSpec === undefined || targetSpec === undefined) {
        return fail("Foreign-key columns must be resolved before assembly.", sourceKey, sourceField, reference.tableName);
      }
      if (sourceSpec.ident !== targetSpec.ident || PgColumn.carrierTag(sourceSpec) !== PgColumn.carrierTag(targetSpec)) {
        fail(
          `Foreign key '${sourceKey}.${sourceField}' (${sourceSpec.ident}) cannot reference '${targetKey}.${targetField}' (${targetSpec.ident}).`,
          sourceKey,
          sourceField,
          reference.tableName
        );
      }
      const sourceSchema = model.bsl.fields[sourceField];
      if (sourceSchema === undefined) {
        return fail("Foreign-key source field is missing.", sourceKey, sourceField, reference.tableName);
      }
      edges.push({
        sourceKey,
        sourceField,
        targetKey,
        targetField,
        relationName: relationName(sourceField),
        optional: Derive.isNullable(Field.from(sourceSchema).schema),
        reference,
      });
    }
  }
  return edges;
};

/** Assemble models into mutually wired Drizzle tables and RQBv2 relations. */
export const schema = <const Models extends ModelRecord>(
  models: Models & ValidateSchema<Models>
): Assembly<Models> => {
  const edges = collectEdges(models);
  const runtimeTables: Record<string, AnyPgTable> = {};

  for (const [key, model] of Object.entries(models)) {
    runtimeTables[key] = toPgTable(model, (columns) =>
      edges
        .filter((edge) => edge.sourceKey === key)
        .map((edge) => {
          const targetTable = runtimeTables[edge.targetKey];
          if (targetTable === undefined || !P.hasProperty(targetTable, edge.targetField)) {
            return fail("Resolved foreign-key table or column is unavailable.", key, edge.sourceField, edge.targetKey);
          }
          // Audited boundary: collectEdges proved the target key resolves to a
          // real column of the target BSL table before any table was built.
          const targetColumn = targetTable[edge.targetField] as AnyPgColumn;
          let builder = foreignKey({
            columns: [columns[edge.sourceField]],
            foreignColumns: [targetColumn],
          });
          if (edge.reference.onDelete !== undefined) builder = builder.onDelete(edge.reference.onDelete);
          if (edge.reference.onUpdate !== undefined) builder = builder.onUpdate(edge.reference.onUpdate);
          return builder;
        })
    );
  }

  // Audited boundary: the loop assigns exactly one TableOf per Models key;
  // dynamic record construction erases that mapped-key correlation.
  const tables = runtimeTables as TablesOf<Models>;
  const relationsConfig: RelationsConfig<Models> = (helpers) => {
    // Audited boundary: installed defineRelations supplies the same table-key
    // and column-key graph represented by TablesOf<Models>; dynamic edges need
    // index access that its fully literal helper type intentionally forbids.
    const r = helpers as unknown as RuntimeRelationHelper;
    const config: Record<string, Record<string, unknown>> = {};
    for (const edge of edges) {
      const source = r[edge.sourceKey];
      const target = r[edge.targetKey];
      const one = r.one[edge.targetKey];
      if (
        !P.hasProperty(source, edge.sourceField) ||
        !P.hasProperty(target, edge.targetField) ||
        one === undefined
      ) {
        return fail("defineRelations helper is missing a resolved table.", edge.sourceKey, edge.sourceField, edge.targetKey);
      }
      const sourceColumn = source[edge.sourceField];
      const targetColumn = target[edge.targetField];
      const relations = config[edge.sourceKey] ?? {};
      relations[edge.relationName] = one({
        from: sourceColumn,
        to: targetColumn,
        optional: edge.optional,
        alias: `${edge.sourceKey}_${edge.sourceField}_${edge.targetKey}`,
      });
      config[edge.sourceKey] = relations;
    }
    // Audited boundary: every config member above is constructed by the
    // installed r.one target factory with matching from/to table columns.
    return config as RelationsBuilderConfig<TablesOf<Models>>;
  };

  return {
    models,
    tables,
    relationsConfig,
    relations: defineRelations(tables, relationsConfig),
  };
};
