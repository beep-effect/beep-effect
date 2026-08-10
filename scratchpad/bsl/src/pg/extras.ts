/** PostgreSQL table-level descriptor nodes and Drizzle emitters. */
import { is as isDrizzleEntity, SQL, sql } from "drizzle-orm";
import {
  check as drizzleCheck,
  index as drizzleIndex,
  primaryKey as drizzlePrimaryKey,
  unique as drizzleUnique,
} from "drizzle-orm/pg-core";
import type {
  ExtraConfigColumn,
  PgIndexMethod,
  PgTableExtraConfigValue,
} from "drizzle-orm/pg-core";
import * as A from "effect/Array";
import * as Data from "effect/Data";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import type * as Field from "../core/Field.ts";

/** Bound Drizzle column retaining its originating field type. */
export type BoundColumn<I extends Field.Input = Field.Input> = ExtraConfigColumn & {
  readonly "~effect-drizzle.field"?: I;
};

/** Key-preserving columns exposed to an extras callback. */
export type BoundColumns<F extends { readonly [key: string]: Field.Input }> = {
  readonly [K in keyof F & string]: BoundColumn<F[K]>;
};

type NonEmptyColumns = readonly [BoundColumn, ...BoundColumn[]];
type CompositeColumns = readonly [BoundColumn, BoundColumn, ...BoundColumn[]];

type NodeDefinition = {
  compositeUnique: {
    readonly name: string;
    readonly columns: CompositeColumns;
  };
  compositePrimaryKey: {
    readonly name: string;
    readonly columns: CompositeColumns;
  };
  index: {
    readonly name: string;
    readonly columns: NonEmptyColumns;
    readonly using: PgIndexMethod | undefined;
    readonly where: SQL<boolean> | undefined;
  };
  check: { readonly name: string; readonly expression: SQL<boolean> };
  unsafeCheckSql: { readonly name: string; readonly sql: string };
};

/** Complete PostgreSQL table-extra descriptor algebra. */
export type Node = Data.TaggedEnum<NodeDefinition>;
export type CompositeUnique = Extract<Node, { readonly _tag: "compositeUnique" }>;
export type CompositePrimaryKey = Extract<Node, { readonly _tag: "compositePrimaryKey" }>;
export type Index = Extract<Node, { readonly _tag: "index" }>;
export type Check = Extract<Node, { readonly _tag: "check" }>;
export type UnsafeCheckSql = Extract<Node, { readonly _tag: "unsafeCheckSql" }>;

const Nodes = Data.taggedEnum<Node>();
export const CompositeUnique = { make: Nodes.compositeUnique };
export const CompositePrimaryKey = { make: Nodes.compositePrimaryKey };
export const Index = { make: Nodes.index };
export const Check = { make: Nodes.check };
export const UnsafeCheckSql = { make: Nodes.unsafeCheckSql };

const isNamed = (value: unknown): boolean =>
  P.hasProperty(value, "name") && P.isString(value.name) && value.name.length > 0;
const isColumn = P.isObject;
const hasColumns = (value: unknown, minimum: number): boolean =>
  P.hasProperty(value, "columns") &&
  A.isArray(value.columns) &&
  value.columns.length >= minimum &&
  A.every(value.columns, isColumn);

/** Cheap tag/shape guard for author-returned extras callback values. */
export const isNode = (value: unknown): value is Node =>
  isNamed(value) &&
  (Nodes.$is("compositeUnique")(value)
    ? hasColumns(value, 2)
    : Nodes.$is("compositePrimaryKey")(value)
      ? hasColumns(value, 2)
      : Nodes.$is("index")(value)
        ? hasColumns(value, 1) &&
          P.hasProperty(value, "using") &&
          (P.isUndefined(value.using) || P.isString(value.using)) &&
          P.hasProperty(value, "where") &&
          (P.isUndefined(value.where) || isDrizzleEntity(value.where, SQL))
        : Nodes.$is("check")(value)
          ? P.hasProperty(value, "expression") && isDrizzleEntity(value.expression, SQL)
          : Nodes.$is("unsafeCheckSql")(value) &&
            P.hasProperty(value, "sql") &&
            P.isString(value.sql));

/** Constructors and matcher for the table-extra union. */
export const Node = {
  $is: Nodes.$is,
  $match: Nodes.$match,
  is: isNode,
  match: Nodes.$match,
};

/** Table-extra callback accepted by a model. */
export type Callback<F extends { readonly [key: string]: Field.Input }> = (
  columns: BoundColumns<F>,
) => ReadonlyArray<Node>;

/** Construct a named composite unique constraint. */
export const compositeUnique = (name: string, columns: CompositeColumns): CompositeUnique =>
  Nodes.compositeUnique({ name, columns });

/** Construct a named composite primary key. */
export const compositePrimaryKey = (name: string, columns: CompositeColumns): CompositePrimaryKey =>
  Nodes.compositePrimaryKey({ name, columns });

/** Construct a PostgreSQL index descriptor. */
export const index = (
  name: string,
  columns: NonEmptyColumns,
  options?: { readonly using?: PgIndexMethod; readonly where?: SQL<boolean> },
): Index =>
  Nodes.index({
    name,
    columns,
    using: options?.using,
    where: options?.where,
  });

/** Construct a typed SQL check descriptor in data-first or data-last form. */
export const check: {
  (name: string): (expression: SQL<boolean>) => Check;
  (expression: SQL<boolean>, name: string): Check;
} = dual(2, (expression: SQL<boolean>, name: string): Check => Nodes.check({ name, expression }));

/** Construct an explicitly unsafe raw-SQL check descriptor. */
export const unsafeCheckSql = (name: string, value: string): UnsafeCheckSql =>
  Nodes.unsafeCheckSql({ name, sql: value });

const emitIndex = (node: Index): PgTableExtraConfigValue => {
  const on = drizzleIndex(node.name);
  const builder = O.match(O.fromUndefinedOr(node.using), {
    onNone: () => on.on(...node.columns),
    onSome: (using) => on.using(using, ...node.columns),
  });
  return O.match(O.fromUndefinedOr(node.where), {
    onNone: () => builder,
    onSome: (where) => builder.where(where),
  });
};

/** Compile one table-extra descriptor to a Drizzle extra-config value. */
export const emit = (node: Node): PgTableExtraConfigValue =>
  Node.$match(node, {
    check: (current) => drizzleCheck(current.name, current.expression),
    compositePrimaryKey: (current) =>
      drizzlePrimaryKey({ name: current.name, columns: [...current.columns] }),
    compositeUnique: (current) => drizzleUnique(current.name).on(...current.columns),
    index: emitIndex,
    unsafeCheckSql: (current) => drizzleCheck(current.name, sql.raw(current.sql)),
  });
