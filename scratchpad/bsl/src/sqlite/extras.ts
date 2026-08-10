/** SQLite table-extra descriptors and Drizzle emitters. */
import { is as isDrizzleEntity, SQL, sql } from "drizzle-orm";
import {
  check as drizzleCheck,
  index as drizzleIndex,
  primaryKey as drizzlePrimaryKey,
  unique as drizzleUnique,
} from "drizzle-orm/sqlite-core";
import type { SQLiteColumn, SQLiteTableExtraConfigValue } from "drizzle-orm/sqlite-core";
import { isArray } from "effect/Array";
import { taggedEnum } from "effect/Data";
import type { TaggedEnum } from "effect/Data";
import { dual } from "effect/Function";
import { fromUndefinedOr, match } from "effect/Option";
import { hasProperty, isObject, isString } from "effect/Predicate";
import type * as Field from "../core/Field.ts";

/** Bound SQLite column retaining its originating field type. */
export type BoundColumn<I extends Field.Input = Field.Input> = SQLiteColumn & {
  readonly "~effect-drizzle.field"?: I;
};
export type BoundColumns<F extends { readonly [key: string]: Field.Input }> = {
  readonly [K in keyof F & string]: BoundColumn<F[K]>;
};
type NonEmptyColumns = readonly [BoundColumn, ...BoundColumn[]];
type CompositeColumns = readonly [BoundColumn, BoundColumn, ...BoundColumn[]];

type NodeDefinition = {
  compositeUnique: { readonly name: string; readonly columns: CompositeColumns };
  compositePrimaryKey: { readonly name: string; readonly columns: CompositeColumns };
  index: {
    readonly name: string;
    readonly columns: NonEmptyColumns;
    readonly where: SQL<boolean> | undefined;
  };
  check: { readonly name: string; readonly expression: SQL<boolean> };
  unsafeCheckSql: { readonly name: string; readonly sql: string };
};

/** Complete SQLite table-extra algebra. */
export type Node = TaggedEnum<NodeDefinition>;
export type CompositeUnique = Extract<Node, { readonly _tag: "compositeUnique" }>;
export type CompositePrimaryKey = Extract<Node, { readonly _tag: "compositePrimaryKey" }>;
export type Index = Extract<Node, { readonly _tag: "index" }>;
export type Check = Extract<Node, { readonly _tag: "check" }>;
export type UnsafeCheckSql = Extract<Node, { readonly _tag: "unsafeCheckSql" }>;

const Nodes = taggedEnum<Node>();
const isNamed = (value: unknown): boolean =>
  hasProperty(value, "name") && isString(value.name) && value.name.length > 0;
const hasColumns = (value: unknown, minimum: number): boolean =>
  hasProperty(value, "columns") &&
  isArray(value.columns) &&
  value.columns.length >= minimum &&
  value.columns.every(isObject);

/** Guard author-returned SQLite extra nodes. */
export const isNode = (value: unknown): value is Node =>
  isNamed(value) &&
  (Nodes.$is("compositeUnique")(value)
    ? hasColumns(value, 2)
    : Nodes.$is("compositePrimaryKey")(value)
      ? hasColumns(value, 2)
      : Nodes.$is("index")(value)
        ? hasColumns(value, 1) &&
          hasProperty(value, "where") &&
          (value.where === undefined || isDrizzleEntity(value.where, SQL))
        : Nodes.$is("check")(value)
          ? hasProperty(value, "expression") && isDrizzleEntity(value.expression, SQL)
          : Nodes.$is("unsafeCheckSql")(value) && hasProperty(value, "sql") && isString(value.sql));

export const Node = { $is: Nodes.$is, $match: Nodes.$match, is: isNode, match: Nodes.$match };
export type Callback<F extends { readonly [key: string]: Field.Input }> = (
  columns: BoundColumns<F>,
) => ReadonlyArray<Node>;

/** Construct a named composite unique constraint. */
export const compositeUnique = (name: string, columns: CompositeColumns): CompositeUnique =>
  Nodes.compositeUnique({ name, columns });
/** Construct a named composite primary key. */
export const compositePrimaryKey = (name: string, columns: CompositeColumns): CompositePrimaryKey =>
  Nodes.compositePrimaryKey({ name, columns });
/** Construct a SQLite index, optionally partial through `where`. */
export const index = (
  name: string,
  columns: NonEmptyColumns,
  options?: { readonly where?: SQL<boolean> },
): Index => Nodes.index({ name, columns, where: options?.where });
/** Construct a typed check in data-first or data-last form. */
export const check: {
  (name: string): (expression: SQL<boolean>) => Check;
  (expression: SQL<boolean>, name: string): Check;
} = dual(2, (expression: SQL<boolean>, name: string): Check => Nodes.check({ name, expression }));
/** Construct an explicitly unsafe raw-SQL check. */
export const unsafeCheckSql = (name: string, value: string): UnsafeCheckSql =>
  Nodes.unsafeCheckSql({ name, sql: value });

const emitIndex = (node: Index): SQLiteTableExtraConfigValue => {
  const builder = drizzleIndex(node.name).on(...node.columns);
  return match(fromUndefinedOr(node.where), {
    onNone: () => builder,
    onSome: (where) => builder.where(where),
  });
};

/** Compile one SQLite extra node. */
export const emit = (node: Node): SQLiteTableExtraConfigValue =>
  Node.$match(node, {
    check: (current) => drizzleCheck(current.name, current.expression),
    compositePrimaryKey: (current) =>
      drizzlePrimaryKey({ name: current.name, columns: [...current.columns] }),
    compositeUnique: (current) => drizzleUnique(current.name).on(...current.columns),
    index: emitIndex,
    unsafeCheckSql: (current) => drizzleCheck(current.name, sql.raw(current.sql)),
  });
