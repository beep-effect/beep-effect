/**
 * Defines dialect-neutral SQL intent carried beside Effect schemas.
 *
 * Metadata records defaults, generation, keys, references, and physical
 * naming before a dialect projector compiles those choices to Drizzle.
 *
 * @since 0.0.0
 */
import type { SQL } from "drizzle-orm";
import { taggedEnum } from "effect/Data";
import type { TaggedEnum } from "effect/Data";
import { hasProperty, isString, isUndefined } from "effect/Predicate";
import { String as StringSchema, TaggedError } from "effect/Schema";

/** A typed schema expression rendered bound parameters that DDL cannot carry. */
/** @internal */
export class SqlExpressionError extends TaggedError<SqlExpressionError>(
  "@beep/effect-drizzle/SqlExpressionError",
)(
  "SqlExpressionError",
  { message: StringSchema, context: StringSchema },
  { description: "A schema-level SQL expression contains bound parameters." },
) {}

/** Reject parameters in CHECK, partial-index, generated, and default expressions. */
/** @internal */
// @effect-diagnostics-next-line missingPipeableSignature:off -- Scratchpad prototype API preserves its established call shape.
export const assertNoSqlParameters = (
  params: ReadonlyArray<unknown>,
  context: string,
): void => {
  if (params.length !== 0) {
    throw SqlExpressionError.make({
      message: `${context} cannot contain bound parameters; use a literal SQL fragment or an explicitly unsafe raw-SQL escape hatch.`,
      context,
    });
  }
};

/** Minimal column identity required by the dialect-neutral field wrapper. */
/** @internal */
export interface ColumnSpec {
  readonly dialect: string;
  readonly kind: string;
  readonly ident: string;
}

/** Supported array depth carried by field metadata. */
/** @internal */
export type ArrayDimension = 0 | 1 | 2 | 3 | 4 | 5;

/** Identity-generation intent shared by integer-capable dialects. */
/** @internal */
export type IdentityMode = "always" | "byDefault" | false;

/** Foreign-key referential actions understood by Drizzle. */
/** @internal */
export type FkAction = "cascade" | "restrict" | "no action" | "set null" | "set default";

/** Cheap guard for author-provided referential actions. */
/** @internal */
export const isFkAction = (value: unknown): value is FkAction =>
  value === "cascade" ||
  value === "restrict" ||
  value === "no action" ||
  value === "set null" ||
  value === "set default";

/** Foreign-key target resolved from identity statics or supplied explicitly. */
/** @internal */
export interface References<TableName extends string = string, ColumnName extends string = string> {
  readonly tableName: TableName;
  readonly columnName: ColumnName;
  readonly onDelete: FkAction | undefined;
  readonly onUpdate: FkAction | undefined;
}

/** Cheap shape guard used where references cross an author-input seam. */
/** @internal */
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
/** @internal */
export type Default = TaggedEnum<{
  sqlExpr: { readonly expression: SQL<unknown> };
  value: { readonly value: unknown };
  now: {};
  unsafeSql: { readonly sql: string };
}>;

/** Constructors, guards, and exhaustive matcher for defaults. */
/** @internal */
export const Default = /* @__PURE__ */ taggedEnum<Default>();

/** Typed SQL-expression default descriptor. */
/** @internal */
export type DefaultSqlExpr<Carrier> = Omit<
  Extract<Default, { readonly _tag: "sqlExpr" }>,
  "expression"
> & {
  readonly expression: SQL<Carrier>;
};

/** Literal-value default descriptor. */
/** @internal */
export type DefaultValue<Encoded> = Omit<Extract<Default, { readonly _tag: "value" }>, "value"> & {
  readonly value: Encoded;
};

/** Current-time default descriptor. */
/** @internal */
export type DefaultNow = Extract<Default, { readonly _tag: "now" }>;

/** Explicit raw-SQL default descriptor. */
/** @internal */
export type UnsafeDefaultSql = Extract<Default, { readonly _tag: "unsafeSql" }>;

/** Generated-column descriptor union. */
/** @internal */
export type Generated = TaggedEnum<{
  sqlExpr: { readonly expression: SQL<unknown> };
  unsafeSql: { readonly sql: string };
  identityAlways: {};
}>;

/** Constructors, guards, and exhaustive matcher for generated columns. */
/** @internal */
export const Generated = /* @__PURE__ */ taggedEnum<Generated>();

/** Typed generated SQL-expression descriptor. */
/** @internal */
export type GeneratedSqlExpr<Carrier> = Omit<
  Extract<Generated, { readonly _tag: "sqlExpr" }>,
  "expression"
> & {
  readonly expression: SQL<Carrier>;
};

/** Explicit raw-SQL generated descriptor. */
/** @internal */
export type UnsafeGeneratedSql = Extract<Generated, { readonly _tag: "unsafeSql" }>;

/** Identity-always generated descriptor. */
/** @internal */
export type GeneratedIdentityAlways = Extract<Generated, { readonly _tag: "identityAlways" }>;

/** Literal-preserving SQL intent carried by every field. */
/** @internal */
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
/** @internal */
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
/** @internal */
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
/** @internal */
export type Patch = { readonly [K in keyof Meta]?: Meta[K] };

/** Literal-preserving metadata merge type. */
/** @internal */
export type Merge<M extends Meta, P extends Patch> = {
  readonly [K in keyof Meta]: K extends keyof P
    ? P[K] extends undefined
      ? M[K]
      : Exclude<P[K], undefined>
    : M[K];
};

/** Merge a literal-preserving patch into existing metadata. */
/** @internal */
// @effect-diagnostics-next-line missingPipeableSignature:off -- Scratchpad prototype API preserves its established call shape.
export function merge<const M extends Meta, const P extends Patch>(
  meta: M,
  patch: P,
): Merge<M, P>;
/** @internal */
export function merge(meta: Meta, patch: Patch): Meta {
  return {
    column: isUndefined(patch.column) ? meta.column : patch.column,
    dimensions: isUndefined(patch.dimensions) ? meta.dimensions : patch.dimensions,
    primaryKey: isUndefined(patch.primaryKey) ? meta.primaryKey : patch.primaryKey,
    unique: isUndefined(patch.unique) ? meta.unique : patch.unique,
    identity: isUndefined(patch.identity) ? meta.identity : patch.identity,
    hasDefault: isUndefined(patch.hasDefault) ? meta.hasDefault : patch.hasDefault,
    default: isUndefined(patch.default) ? meta.default : patch.default,
    generated: isUndefined(patch.generated) ? meta.generated : patch.generated,
    version: isUndefined(patch.version) ? meta.version : patch.version,
    columnName: isUndefined(patch.columnName) ? meta.columnName : patch.columnName,
    references: isUndefined(patch.references) ? meta.references : patch.references,
  };
}
