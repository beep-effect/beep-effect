/** Internal SQL intent records shared by dialect implementations. */
import type { SQL } from "drizzle-orm";
import { taggedEnum } from "effect/Data";
import type { TaggedEnum } from "effect/Data";
import { fromUndefinedOr, getOrElse } from "effect/Option";
import { hasProperty, isString, isUndefined } from "effect/Predicate";
import { evolve } from "effect/Struct";

/** Minimal column identity required by the dialect-neutral field wrapper. */
export interface ColumnSpec {
  readonly kind: string;
  readonly ident: string;
}

/** Supported array depth carried by field metadata. */
export type ArrayDimension = 0 | 1 | 2 | 3 | 4 | 5;

/** Identity-generation intent shared by integer-capable dialects. */
export type IdentityMode = "always" | "byDefault" | false;

/** Foreign-key referential actions understood by Drizzle. */
export type FkAction = "cascade" | "restrict" | "no action" | "set null" | "set default";

/** Cheap guard for author-provided referential actions. */
export const isFkAction = (value: unknown): value is FkAction =>
  value === "cascade" ||
  value === "restrict" ||
  value === "no action" ||
  value === "set null" ||
  value === "set default";

/** Foreign-key target resolved from identity statics or supplied explicitly. */
export interface References<TableName extends string = string, ColumnName extends string = string> {
  readonly tableName: TableName;
  readonly columnName: ColumnName;
  readonly onDelete: FkAction | undefined;
  readonly onUpdate: FkAction | undefined;
}

/** Cheap shape guard used where references cross an author-input seam. */
export const isReferences = (value: unknown): value is References =>
  hasProperty(value, "tableName") &&
  isString(value.tableName) &&
  value.tableName.length > 0 &&
  hasProperty(value, "columnName") &&
  isString(value.columnName) &&
  value.columnName.length > 0 &&
  hasProperty(value, "onDelete") &&
  (isUndefined(value.onDelete) || isFkAction(value.onDelete)) &&
  hasProperty(value, "onUpdate") &&
  (isUndefined(value.onUpdate) || isFkAction(value.onUpdate));

/** Server-default descriptor union. */
export type Default = TaggedEnum<{
  sqlExpr: { readonly expression: SQL<unknown> };
  value: { readonly value: unknown };
  now: {};
  unsafeSql: { readonly sql: string };
}>;

/** Constructors, guards, and exhaustive matcher for defaults. */
export const Default = taggedEnum<Default>();

/** Typed SQL-expression default descriptor. */
export type DefaultSqlExpr<Carrier> = Omit<
  Extract<Default, { readonly _tag: "sqlExpr" }>,
  "expression"
> & {
  readonly expression: SQL<Carrier>;
};

/** Literal-value default descriptor. */
export type DefaultValue<Encoded> = Omit<Extract<Default, { readonly _tag: "value" }>, "value"> & {
  readonly value: Encoded;
};

/** Current-time default descriptor. */
export type DefaultNow = Extract<Default, { readonly _tag: "now" }>;

/** Explicit raw-SQL default descriptor. */
export type UnsafeDefaultSql = Extract<Default, { readonly _tag: "unsafeSql" }>;

/** Generated-column descriptor union. */
export type Generated = TaggedEnum<{
  sqlExpr: { readonly expression: SQL<unknown> };
  unsafeSql: { readonly sql: string };
  identityAlways: {};
}>;

/** Constructors, guards, and exhaustive matcher for generated columns. */
export const Generated = taggedEnum<Generated>();

/** Typed generated SQL-expression descriptor. */
export type GeneratedSqlExpr<Carrier> = Omit<
  Extract<Generated, { readonly _tag: "sqlExpr" }>,
  "expression"
> & {
  readonly expression: SQL<Carrier>;
};

/** Explicit raw-SQL generated descriptor. */
export type UnsafeGeneratedSql = Extract<Generated, { readonly _tag: "unsafeSql" }>;

/** Identity-always generated descriptor. */
export type GeneratedIdentityAlways = Extract<Generated, { readonly _tag: "identityAlways" }>;

/** Literal-preserving SQL intent carried by every field. */
export interface Meta<C extends ColumnSpec = ColumnSpec> {
  readonly column: C | undefined;
  readonly dimensions: ArrayDimension;
  readonly primaryKey: boolean;
  readonly unique: boolean;
  readonly identity: IdentityMode;
  readonly hasDefault: boolean;
  readonly default: Default | undefined;
  readonly generated: Generated | false;
  readonly version: boolean;
  readonly columnName: string | undefined;
  readonly references: References | undefined;
}

/** Exact initial metadata type for a bare schema field. */
export interface Empty extends Meta {
  readonly column: undefined;
  readonly dimensions: 0;
  readonly primaryKey: false;
  readonly unique: false;
  readonly identity: false;
  readonly hasDefault: false;
  readonly default: undefined;
  readonly generated: false;
  readonly version: false;
  readonly columnName: undefined;
  readonly references: undefined;
}

/** Canonical metadata value for a bare schema field. */
export const empty: Empty = {
  column: undefined,
  dimensions: 0,
  primaryKey: false,
  unique: false,
  identity: false,
  hasDefault: false,
  default: undefined,
  generated: false,
  version: false,
  columnName: undefined,
  references: undefined,
};

/** Partial metadata update produced by a field combinator. */
export type Patch = { readonly [K in keyof Meta]?: Meta[K] };

/** Literal-preserving metadata merge type. */
export type Merge<M extends Meta, P extends Patch> = {
  readonly [K in keyof Meta]: K extends keyof P
    ? P[K] extends undefined
      ? M[K]
      : Exclude<P[K], undefined>
    : M[K];
};

function mergeField<const M extends Meta, const P extends Patch, K extends keyof Meta>(
  current: M[K],
  patch: P,
  key: K,
): Merge<M, P>[K];
function mergeField(current: Meta[keyof Meta], patch: Patch, key: keyof Meta): Meta[keyof Meta] {
  return getOrElse(fromUndefinedOr(patch[key]), () => current);
}

/** Merge a literal-preserving patch into existing metadata. */
export const merge = <const M extends Meta, const P extends Patch>(
  meta: M,
  patch: P,
): Merge<M, P> => {
  const evolver = {
    column: (current: M["column"]) => mergeField(current, patch, "column"),
    dimensions: (current: M["dimensions"]) => mergeField(current, patch, "dimensions"),
    primaryKey: (current: M["primaryKey"]) => mergeField(current, patch, "primaryKey"),
    unique: (current: M["unique"]) => mergeField(current, patch, "unique"),
    identity: (current: M["identity"]) => mergeField(current, patch, "identity"),
    hasDefault: (current: M["hasDefault"]) => mergeField(current, patch, "hasDefault"),
    default: (current: M["default"]) => mergeField(current, patch, "default"),
    generated: (current: M["generated"]) => mergeField(current, patch, "generated"),
    version: (current: M["version"]) => mergeField(current, patch, "version"),
    columnName: (current: M["columnName"]) => mergeField(current, patch, "columnName"),
    references: (current: M["references"]) => mergeField(current, patch, "references"),
  };
  return evolve<Meta, typeof evolver>(meta, evolver);
};
