/**
 * Builds deterministic relation names and RQBv2 relation configurations.
 *
 * Dialect assemblers provide resolved tables and foreign-key edges; this
 * module turns that graph into forward, reverse, and junction relations.
 *
 * @since 0.0.0
 */

import { is as isDrizzleEntity, Relation, RelationsBuilderColumn } from "drizzle-orm";
import { reduce } from "effect/Array";
import { dual } from "effect/Function";
import { fromUndefinedOr, getOrElse } from "effect/Option";
import { hasProperty, isFunction } from "effect/Predicate";
import { empty, get, set } from "effect/Record";
import { capitalize, slice } from "effect/String";
import { camelCase } from "../internal/case.ts";
import { findSqlNameCollision, sqlNameIssue } from "./names.ts";
import type { AnyRelation, RelationsBuilder, RelationsBuilderConfig, Schema } from "drizzle-orm";
import type * as Meta from "./Meta.ts";
import type { Dialect } from "./names.ts";

/**
 * Resolved directed foreign-key edge used during assembly.
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export interface Edge {
  readonly optional: boolean;
  readonly reference: Meta.References;
  readonly relationName: string;
  readonly sourceField: string;
  readonly sourceKey: string;
  readonly targetField: string;
  readonly targetKey: string;
}

/**
 * Two foreign-key edges forming a narrow junction table.
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export interface Junction {
  readonly key: string;
  readonly left: Edge;
  readonly right: Edge;
}

/**
 * Derive a forward relation name from an id field.
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const relationName = (fieldName: string): string =>
  fieldName.endsWith("Id") ? slice(0, -2)(fieldName) : `${fieldName}Relation`;

/** Stable alias shared by forward and reverse relations. */
/** @internal */
const relationAlias = (edge: Edge): string => `${edge.sourceKey}_${edge.sourceField}_${edge.targetKey}`;

/** Deliberately narrow pluralization used by deterministic relation names. */
/** @internal */
const plural = (value: string): string => `${camelCase(value)}s`;

/** Derive the reverse relation name for one edge. */
/** @internal */
const reverseRelationName = (edge: Edge, edges: ReadonlyArray<Edge>): string => {
  const ambiguous =
    edges.filter((candidate) => candidate.sourceKey === edge.sourceKey && candidate.targetKey === edge.targetKey)
      .length > 1;
  if (edge.sourceKey === edge.targetKey && edge.relationName.startsWith("parent")) {
    return `child${capitalize(slice(6)(edge.relationName))}s`;
  }
  const base = plural(edge.sourceKey);
  return ambiguous ? `${base}By${capitalize(edge.relationName)}` : base;
};

/** Structural model surface needed by the shared relation assembler. */
/** @internal */
interface RelationModel {
  readonly sql: {
    readonly tableName: string;
    readonly fields: Readonly<Record<string, unknown>>;
  };
}

/**
 * Model registry consumed by the shared relation assembler.
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export interface RelationModels {
  readonly [key: string]: RelationModel;
}

/**
 * Tagged dialect error callback used by the shared relation assembler.
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export type AssemblyFailure = (message: string, sourceTable: string, fieldName: string, targetTable: string) => never;

/**
 * Reject duplicate physical table names before dialect projection.
 * @internal
 * @category validation
 * @since 0.0.0
 */
export const validatePhysicalTableNames: {
  (dialect: Dialect, fail: AssemblyFailure): (models: RelationModels) => void;
  (models: RelationModels, dialect: Dialect, fail: AssemblyFailure): void;
} = dual(3, (models: RelationModels, dialect: Dialect, fail: AssemblyFailure): void => {
  const entries = Object.entries(models).map(([key, model]): readonly [string, string] => [key, model.sql.tableName]);
  const collision = findSqlNameCollision(entries, dialect);
  if (collision !== undefined) {
    fail(
      `Physical table name '${collision.name}' collides with '${collision.firstOwner}' after dialect normalization to '${collision.canonical}'.`,
      collision.secondOwner,
      "(tableName)",
      collision.firstOwner
    );
  }
  entries.forEach(([key, name]) => {
    const issue = sqlNameIssue(name, dialect);
    if (issue !== undefined) fail(`Physical table name '${name}' ${issue}.`, key, "(tableName)", key);
  });
});

/**
 * Named schema-global SQL object used by dialect namespace validation.
 * @internal
 * @category models
 * @since 0.0.0
 */
export interface SchemaName {
  readonly kind: string;
  readonly name: string;
  readonly owner: string;
}

/**
 * Validate one dialect's complete schema-global object namespace.
 * @internal
 * @category validation
 * @since 0.0.0
 */
export const validateSchemaNames: {
  (dialect: Dialect, fail: AssemblyFailure): (names: ReadonlyArray<SchemaName>) => void;
  (names: ReadonlyArray<SchemaName>, dialect: Dialect, fail: AssemblyFailure): void;
} = dual(3, (names: ReadonlyArray<SchemaName>, dialect: Dialect, fail: AssemblyFailure): void => {
  const entries = names.map(({ owner, name }): readonly [string, string] => [owner, name]);
  const collision = findSqlNameCollision(entries, dialect);
  if (collision !== undefined) {
    fail(
      `Schema-global name '${collision.name}' collides with '${collision.firstOwner}' after dialect normalization to '${collision.canonical}'.`,
      collision.secondOwner,
      "(schema namespace)",
      collision.firstOwner
    );
  }
  names.forEach(({ owner, name, kind }) => {
    const issue = sqlNameIssue(name, dialect);
    if (issue !== undefined) fail(`${kind} name '${name}' ${issue}.`, owner, "(schema namespace)", owner);
  });
});

const throughRelationName = (targetKey: string, junctionKey: string): string =>
  `${plural(targetKey)}Through${capitalize(camelCase(junctionKey))}`;

const addRelation = (
  models: RelationModels,
  config: Record<string, Record<string, AnyRelation>>,
  tableKey: string,
  name: string,
  fieldName: string,
  targetTable: string,
  relation: AnyRelation,
  fail: AssemblyFailure
): Record<string, Record<string, AnyRelation>> => {
  const model = getOrElse(fromUndefinedOr(models[tableKey]), () =>
    fail("Relation source model is missing from EffectDrizzle.schema.", tableKey, fieldName, targetTable)
  );
  const relations = getOrElse(get(config, tableKey), () => empty<string, AnyRelation>());
  if (hasProperty(model.sql.fields, name) || hasProperty(relations, name)) {
    return fail(
      `Relation name '${tableKey}.${name}' collides with an existing field or relation.`,
      tableKey,
      fieldName,
      targetTable
    );
  }
  return set(config, tableKey, set(relations, name, relation));
};

const invokeRelationFactory = (
  factory: unknown,
  options: unknown,
  message: string,
  sourceTable: string,
  fieldName: string,
  targetTable: string,
  fail: AssemblyFailure
): AnyRelation => {
  if (!isFunction(factory)) return fail(message, sourceTable, fieldName, targetTable);
  const relation: unknown = Reflect.apply(factory, undefined, [options]);
  return isDrizzleEntity(relation, Relation) ? relation : fail(message, sourceTable, fieldName, targetTable);
};

/**
 * Build the dialect-neutral direct, reverse, and junction relation configuration.
 *
 * @internal
 * @category constructors
 * @since 0.0.0
 */
export const makeRelationsConfig: {
  <Tables extends Schema>(
    tables: Tables,
    edges: ReadonlyArray<Edge>,
    junctions: ReadonlyArray<Junction>,
    fail: AssemblyFailure
  ): (models: RelationModels) => (helpers: RelationsBuilder<Tables>) => RelationsBuilderConfig<Tables>;
  <Tables extends Schema>(
    models: RelationModels,
    tables: Tables,
    edges: ReadonlyArray<Edge>,
    junctions: ReadonlyArray<Junction>,
    fail: AssemblyFailure
  ): (helpers: RelationsBuilder<Tables>) => RelationsBuilderConfig<Tables>;
} = dual(
  5,
  <Tables extends Schema>(
    models: RelationModels,
    _tables: Tables,
    edges: ReadonlyArray<Edge>,
    junctions: ReadonlyArray<Junction>,
    fail: AssemblyFailure
  ): ((helpers: RelationsBuilder<Tables>) => RelationsBuilderConfig<Tables>) =>
    (helpers) => {
      const direct = reduce(edges, empty<string, Record<string, AnyRelation>>(), (config, edge) => {
        const source = helpers[edge.sourceKey];
        const target = helpers[edge.targetKey];
        const one: unknown = getOrElse(get(helpers.one, edge.targetKey), () =>
          fail("defineRelations helper is missing a resolved table.", edge.sourceKey, edge.sourceField, edge.targetKey)
        );
        const many: unknown = getOrElse(get(helpers.many, edge.sourceKey), () =>
          fail(
            "defineRelations reverse-many helper is missing a resolved table.",
            edge.targetKey,
            edge.sourceField,
            edge.sourceKey
          )
        );
        if (!hasProperty(source, edge.sourceField) || !hasProperty(target, edge.targetField)) {
          return fail(
            "defineRelations helper is missing a resolved table.",
            edge.sourceKey,
            edge.sourceField,
            edge.targetKey
          );
        }
        const alias = relationAlias(edge);
        const withForward = addRelation(
          models,
          config,
          edge.sourceKey,
          edge.relationName,
          edge.sourceField,
          edge.targetKey,
          invokeRelationFactory(
            one,
            {
              from: source[edge.sourceField],
              to: target[edge.targetField],
              optional: edge.optional,
              alias,
            },
            "defineRelations helper is missing a resolved table.",
            edge.sourceKey,
            edge.sourceField,
            edge.targetKey,
            fail
          ),
          fail
        );
        return addRelation(
          models,
          withForward,
          edge.targetKey,
          reverseRelationName(edge, edges),
          edge.sourceField,
          edge.sourceKey,
          invokeRelationFactory(
            many,
            { alias },
            "defineRelations reverse-many helper is missing a resolved table.",
            edge.targetKey,
            edge.sourceField,
            edge.sourceKey,
            fail
          ),
          fail
        );
      });

      return reduce(junctions, direct, (config, junction) => {
        const junctionTable = helpers[junction.key];
        const leftTable = helpers[junction.left.targetKey];
        const rightTable = helpers[junction.right.targetKey];
        const manyRight: unknown = getOrElse(get(helpers.many, junction.right.targetKey), () =>
          fail(
            "defineRelations through helper is missing the right target table.",
            junction.left.targetKey,
            junction.left.sourceField,
            junction.right.targetKey
          )
        );
        const manyLeft: unknown = getOrElse(get(helpers.many, junction.left.targetKey), () =>
          fail(
            "defineRelations through helper is missing the left target table.",
            junction.right.targetKey,
            junction.right.sourceField,
            junction.left.targetKey
          )
        );
        if (
          !hasProperty(leftTable, junction.left.targetField) ||
          !hasProperty(rightTable, junction.right.targetField) ||
          !hasProperty(junctionTable, junction.left.sourceField) ||
          !hasProperty(junctionTable, junction.right.sourceField)
        ) {
          return fail(
            "defineRelations through helper is missing a resolved junction column.",
            junction.key,
            "(composite primary key)",
            "(junction)"
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
            "(junction)"
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
          invokeRelationFactory(
            manyRight,
            {
              from: leftColumn.through(junctionLeftColumn),
              to: rightColumn.through(junctionRightColumn),
              alias,
            },
            "defineRelations through helper is missing the right target table.",
            junction.left.targetKey,
            junction.left.sourceField,
            junction.right.targetKey,
            fail
          ),
          fail
        );
        return addRelation(
          models,
          withRight,
          junction.right.targetKey,
          throughRelationName(junction.left.targetKey, junction.key),
          junction.right.sourceField,
          junction.left.targetKey,
          invokeRelationFactory(
            manyLeft,
            {
              from: rightColumn.through(junctionRightColumn),
              to: leftColumn.through(junctionLeftColumn),
              alias,
            },
            "defineRelations through helper is missing the left target table.",
            junction.right.targetKey,
            junction.right.sourceField,
            junction.left.targetKey,
            fail
          ),
          fail
        );
      });
    }
);
