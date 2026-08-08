/** Typed table-level PostgreSQL constraints and indexes. */
import { Match } from "effect";
import { type SQL, sql } from "drizzle-orm";
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
import type * as Field from "./Field.ts";

/** A bound Drizzle column retaining its originating BSL field in a phantom. */
export type BoundColumn<I extends Field.Input = Field.Input> = ExtraConfigColumn & {
  readonly "~bsl.field"?: I;
};

export type BoundColumns<F extends { readonly [key: string]: Field.Input }> = {
  readonly [K in keyof F & string]: BoundColumn<F[K]>;
};

type AnyBoundColumn = BoundColumn;
type NonEmptyColumns = readonly [AnyBoundColumn, ...Array<AnyBoundColumn>];
type CompositeColumns = readonly [AnyBoundColumn, AnyBoundColumn, ...Array<AnyBoundColumn>];

export interface CompositeUnique {
  readonly _tag: "compositeUnique";
  readonly name: string;
  readonly columns: CompositeColumns;
}

export interface CompositePrimaryKey {
  readonly _tag: "compositePrimaryKey";
  readonly name: string;
  readonly columns: CompositeColumns;
}

export interface Index {
  readonly _tag: "index";
  readonly name: string;
  readonly columns: NonEmptyColumns;
  readonly using: PgIndexMethod | undefined;
  readonly where: SQL<boolean> | undefined;
}

export interface Check {
  readonly _tag: "check";
  readonly name: string;
  readonly expression: SQL<boolean>;
}

export interface UnsafeCheckSql {
  readonly _tag: "unsafeCheckSql";
  readonly name: string;
  readonly sql: string;
}

export type Node = CompositeUnique | CompositePrimaryKey | Index | Check | UnsafeCheckSql;

/** Callback stored by a model and evaluated over Drizzle-bound columns. */
export type Callback<F extends { readonly [key: string]: Field.Input }> = (
  columns: BoundColumns<F>
) => ReadonlyArray<Node>;

/** Named composite unique constraint. */
export const compositeUnique = (name: string, columns: CompositeColumns): CompositeUnique => ({
  _tag: "compositeUnique",
  name,
  columns,
});

/** Named composite primary key. */
export const compositePrimaryKey = (name: string, columns: CompositeColumns): CompositePrimaryKey => ({
  _tag: "compositePrimaryKey",
  name,
  columns,
});

/** Named PostgreSQL index with optional access method and partial predicate. */
export const index = (
  name: string,
  columns: NonEmptyColumns,
  options?: { readonly using?: PgIndexMethod; readonly where?: SQL<boolean> }
): Index => ({
  _tag: "index",
  name,
  columns,
  using: options?.using,
  where: options?.where,
});

/** Typed SQL check expression. */
export const check = (name: string, expression: SQL<boolean>): Check => ({
  _tag: "check",
  name,
  expression,
});

/** Explicit raw-SQL escape hatch for check constraints. */
export const unsafeCheckSql = (name: string, value: string): UnsafeCheckSql => ({
  _tag: "unsafeCheckSql",
  name,
  sql: value,
});

const emitIndex = (node: Index): PgTableExtraConfigValue => {
  const on = drizzleIndex(node.name);
  const builder = node.using === undefined
    ? on.on(...node.columns)
    : on.using(node.using, ...node.columns);
  return node.where === undefined ? builder : builder.where(node.where);
};

/** Compile a typed node to the installed Drizzle rc4 extra-config builder. */
export const emit: (node: Node) => PgTableExtraConfigValue = Match.type<Node>().pipe(
  Match.tagsExhaustive({
    check: (node) => drizzleCheck(node.name, node.expression),
    compositePrimaryKey: (node) => drizzlePrimaryKey({ name: node.name, columns: [...node.columns] }),
    compositeUnique: (node) => drizzleUnique(node.name).on(...node.columns),
    index: emitIndex,
    unsafeCheckSql: (node) => drizzleCheck(node.name, sql.raw(node.sql)),
  })
);
