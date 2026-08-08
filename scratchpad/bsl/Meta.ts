/**
 * BSL SQL metadata algebra.
 *
 * The literal-preserving metadata record carried by every {@link Field}. The
 * `column` member is a discriminated spec union aligned with drizzle rc's pg
 * builder families; everything else is intent that cannot be derived from the
 * schema (keys, defaults, references, physical-name overrides).
 *
 * Nullability is deliberately NOT part of this record — it derives from the
 * schema's encoded AST, which stays the single source of truth.
 */
import type { SQL } from "drizzle-orm";
import type * as PgColumn from "./PgColumn.ts";

/** Foreign-key referential action — identical union across pg/mysql/sqlite in drizzle rc. */
export type FkAction = "cascade" | "restrict" | "no action" | "set null" | "set default";

/** A foreign-key reference resolved from an EntityId schema or set explicitly. */
export interface References<TableName extends string = string, ColumnName extends string = string> {
  readonly tableName: TableName;
  readonly columnName: ColumnName;
  readonly onDelete: FkAction | undefined;
  readonly onUpdate: FkAction | undefined;
}

/** Identity column generation kind (pg `GENERATED ... AS IDENTITY`). */
export type Identity = "always" | "byDefault" | false;

/** Typed server-default descriptions. */
export namespace Default {
  export interface SqlExpr<Carrier> {
    readonly _tag: "sqlExpr";
    readonly expression: SQL<Carrier>;
  }

  export interface Value<Encoded> {
    readonly _tag: "value";
    readonly value: Encoded;
  }

  export interface Now {
    readonly _tag: "now";
  }

  export interface UnsafeSql {
    readonly _tag: "unsafeSql";
    readonly sql: string;
  }

  export type Any = SqlExpr<unknown> | Value<unknown> | Now | UnsafeSql;
}

/** Typed generated-column descriptions. Identity-always is a generated state without an expression. */
export namespace Generated {
  export interface SqlExpr<Carrier> {
    readonly _tag: "sqlExpr";
    readonly expression: SQL<Carrier>;
  }

  export interface UnsafeSql {
    readonly _tag: "unsafeSql";
    readonly sql: string;
  }

  export interface IdentityAlways {
    readonly _tag: "identityAlways";
  }

  export type Any = SqlExpr<unknown> | UnsafeSql | IdentityAlways;
}

/**
 * The SQL intent record. Every member is literal-typed so conditional types
 * downstream (`PgBuilderFor`) resolve to exact drizzle builder brands.
 */
export interface Meta {
  readonly column: PgColumn.Spec | undefined;
  readonly primaryKey: boolean;
  readonly unique: boolean;
  readonly identity: Identity;
  readonly hasDefault: boolean;
  readonly default: Default.Any | undefined;
  readonly generated: Generated.Any | false;
  readonly columnName: string | undefined;
  readonly references: References | undefined;
}

/** The meta every bare schema starts with. */
export interface Empty extends Meta {
  readonly column: undefined;
  readonly primaryKey: false;
  readonly unique: false;
  readonly identity: false;
  readonly hasDefault: false;
  readonly default: undefined;
  readonly generated: false;
  readonly columnName: undefined;
  readonly references: undefined;
}

export const empty: Empty = {
  column: undefined,
  primaryKey: false,
  unique: false,
  identity: false,
  hasDefault: false,
  default: undefined,
  generated: false,
  columnName: undefined,
  references: undefined,
};

/** A partial update produced by a combinator. */
export type Patch = { readonly [K in keyof Meta]?: Meta[K] };

/**
 * Literal-preserving merge: patch keys replace, everything else survives.
 * Combinators return `Field<S, Merge<M, P>>` so metadata accumulates through
 * a pipe chain without widening.
 */
export type Merge<M extends Meta, P extends Patch> = {
  readonly [K in keyof Meta]: K extends keyof P
    ? P[K] extends undefined
      ? M[K]
      : Exclude<P[K], undefined>
    : M[K];
};

/** Runtime merge mirroring {@link Merge}. */
export const merge = <const M extends Meta, const P extends Patch>(meta: M, patch: P): Merge<M, P> => {
  const next = {
    column: patch.column ?? meta.column,
    primaryKey: patch.primaryKey ?? meta.primaryKey,
    unique: patch.unique ?? meta.unique,
    identity: patch.identity ?? meta.identity,
    hasDefault: patch.hasDefault ?? meta.hasDefault,
    default: patch.default ?? meta.default,
    generated: patch.generated ?? meta.generated,
    columnName: patch.columnName ?? meta.columnName,
    references: patch.references ?? meta.references,
  };
  // Audited boundary: the per-key coalescing above implements exactly the
  // Merge mapped type (defined patch keys replace, others survive); TS cannot
  // correlate the two shapes generically.
  return next as Merge<M, P>;
};
