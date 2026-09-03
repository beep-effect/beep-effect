/**
 * Defines dialect-neutral SQL intent carried beside Effect schemas.
 *
 * Metadata records defaults, generation, keys, references, and physical
 * naming before a dialect projector compiles those choices to Drizzle.
 *
 * @since 0.0.0
 */

import { taggedEnum } from "effect/Data";
import { dual } from "effect/Function";
import { hasProperty, isString, isUndefined } from "effect/Predicate";
import { String as StringSchema, TaggedError } from "effect/Schema";
import { declaredFieldsEquivalence } from "./declaredFieldsEquivalence.ts";
import type { SQL } from "drizzle-orm";
import type { TaggedEnum } from "effect/Data";

/** A typed schema expression rendered bound parameters that DDL cannot carry. */
/** @internal */
class SqlExpressionError extends TaggedError<SqlExpressionError>("@beep/effect-drizzle/SqlExpressionError")(
  "SqlExpressionError",
  {
    message: StringSchema,
    context: StringSchema,
  },
  {
    description: "A schema-level SQL expression contains bound parameters.",
    toEquivalence: (typeParameters) => declaredFieldsEquivalence<SqlExpressionError>(typeParameters),
  }
) {}

/**
 * Reject parameters in CHECK, partial-index, generated, and default expressions.
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const assertNoSqlParameters: {
  (context: string): (params: ReadonlyArray<unknown>) => void;
  (params: ReadonlyArray<unknown>, context: string): void;
} = /* @__PURE__ */ dual(2, (params: ReadonlyArray<unknown>, context: string): void => {
  if (params.length !== 0) {
    throw SqlExpressionError.make({
      message: `${context} cannot contain bound parameters; use a literal SQL fragment or an explicitly unsafe raw-SQL escape hatch.`,
      context,
    });
  }
});

/**
 * Minimal column identity carried through public field inference.
 *
 * @category models
 * @since 0.0.0
 */
export interface ColumnSpec {
  readonly dialect: string;
  readonly ident: string;
  readonly kind: string;
}

/**
 * Supported array depth carried by field metadata.
 *
 * @category models
 * @since 0.0.0
 */
export type ArrayDimension = 0 | 1 | 2 | 3 | 4 | 5;

/**
 * Identity-generation intent shared by integer-capable dialects.
 *
 * @category models
 * @since 0.0.0
 */
export type IdentityMode = "always" | "byDefault" | false;

/**
 * Foreign-key referential actions understood by Drizzle.
 *
 * @category models
 * @since 0.0.0
 */
export type FkAction = "cascade" | "restrict" | "no action" | "set null" | "set default";

/** Cheap guard for author-provided referential actions. */
/** @internal */
const isFkAction = (value: unknown): value is FkAction =>
  value === "cascade" ||
  value === "restrict" ||
  value === "no action" ||
  value === "set null" ||
  value === "set default";

/**
 * Foreign-key target resolved from identity statics or supplied explicitly.
 *
 * @category models
 * @since 0.0.0
 */
export interface References<TableName extends string = string, ColumnName extends string = string> {
  readonly columnName: ColumnName;
  readonly name?: string;
  readonly onDelete: FkAction | undefined;
  readonly onUpdate: FkAction | undefined;
  readonly tableName: TableName;
}

/**
 * Cheap shape guard used where references cross an author-input seam.
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const isReferences = (value: unknown): value is References =>
  hasProperty(value, "tableName") &&
  isString(value.tableName) &&
  value.tableName.length > 0 &&
  hasProperty(value, "columnName") &&
  isString(value.columnName) &&
  value.columnName.length > 0 &&
  (!hasProperty(value, "name") || isUndefined(value.name) || isString(value.name)) &&
  hasProperty(value, "onDelete") &&
  (isUndefined(value.onDelete) || isFkAction(value.onDelete)) &&
  hasProperty(value, "onUpdate") &&
  (isUndefined(value.onUpdate) || isFkAction(value.onUpdate));

/**
 * Server-default descriptor union.
 *
 * @category models
 * @since 0.0.0
 */
export type Default = TaggedEnum<{
  sqlExpr: { readonly expression: SQL<unknown> };
  value: { readonly value: unknown };
  now: {};
  unsafeSql: { readonly sql: string };
}>;

/**
 * Constructors, guards, and exhaustive matcher for defaults.
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const Default = /* @__PURE__ */ taggedEnum<Default>();

/**
 * Typed SQL-expression default descriptor.
 *
 * @category models
 * @since 0.0.0
 */
export type DefaultSqlExpr<Carrier> = Omit<Extract<Default, { readonly _tag: "sqlExpr" }>, "expression"> & {
  readonly expression: SQL<Carrier>;
};

/**
 * Literal-value default descriptor.
 *
 * @category models
 * @since 0.0.0
 */
export type DefaultValue<Encoded> = Omit<Extract<Default, { readonly _tag: "value" }>, "value"> & {
  readonly value: Encoded;
};

/**
 * Current-time default descriptor.
 *
 * @category models
 * @since 0.0.0
 */
export type DefaultNow = Extract<Default, { readonly _tag: "now" }>;

/**
 * Explicit raw-SQL default descriptor.
 *
 * @category models
 * @since 0.0.0
 */
export type UnsafeDefaultSql = Extract<Default, { readonly _tag: "unsafeSql" }>;

/**
 * Generated-column descriptor union.
 *
 * @category models
 * @since 0.0.0
 */
export type Generated = TaggedEnum<{
  sqlExpr: { readonly expression: SQL<unknown> };
  unsafeSql: { readonly sql: string };
  identityAlways: {};
}>;

/**
 * Constructors, guards, and exhaustive matcher for generated columns.
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const Generated = /* @__PURE__ */ taggedEnum<Generated>();

/**
 * Typed generated SQL-expression descriptor.
 *
 * @category models
 * @since 0.0.0
 */
export type GeneratedSqlExpr<Carrier> = Omit<Extract<Generated, { readonly _tag: "sqlExpr" }>, "expression"> & {
  readonly expression: SQL<Carrier>;
};

/**
 * Explicit raw-SQL generated descriptor.
 *
 * @category models
 * @since 0.0.0
 */
export type UnsafeGeneratedSql = Extract<Generated, { readonly _tag: "unsafeSql" }>;

/**
 * Identity-always generated descriptor.
 *
 * @category models
 * @since 0.0.0
 */
export type GeneratedIdentityAlways = Extract<Generated, { readonly _tag: "identityAlways" }>;

/**
 * Single-column index intent carried on a field until model construction.
 *
 * **Details**
 *
 * `name` pins an explicit index name; `undefined` derives
 * `{table}_{column}_btree_idx` (or `{table}_{column}_unique_idx` when
 * `unique` is set) at model construction. Harvested intents compile through
 * the same table-extras node algebra as callback-declared indexes.
 *
 * **Example** (Read a colocated index intent)
 *
 * ```ts
 * import { String } from "effect/Schema"
 * import { index } from "@beep/effect-drizzle/pg"
 *
 * const field = String.pipe(index())
 * field.meta.indexed // => { name: undefined, unique: false }
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface IndexIntent {
  readonly name: string | undefined;
  readonly unique: boolean;
}

/**
 * Literal-preserving SQL intent exposed by inferred field metadata.
 *
 * @category models
 * @since 0.0.0
 */
export interface Meta<C extends ColumnSpec = ColumnSpec> {
  readonly column: C | undefined;
  readonly columnName: string | undefined;
  readonly default: Default | undefined;
  readonly dimensions: ArrayDimension;
  readonly generated: Generated | false;
  readonly hasDefault: boolean;
  readonly identity: IdentityMode;
  readonly indexed: IndexIntent | false;
  readonly primaryKey: boolean;
  readonly references: References | undefined;
  readonly unique: boolean;
  readonly version: boolean;
}

/**
 * Reports whether metadata guarantees that one column uniquely locates a row.
 *
 * **Details**
 *
 * Primary keys, inline unique constraints, and colocated single-column unique
 * indexes all provide the same locator and foreign-key-target guarantee. A
 * non-unique index does not.
 *
 * **Example** (Recognize a colocated unique index)
 *
 * ```ts
 * import { isUniqueKey } from "@beep/effect-drizzle"
 * import { String } from "effect/Schema"
 * import { uniqueIndex } from "@beep/effect-drizzle/pg"
 *
 * isUniqueKey(String.pipe(uniqueIndex()).meta) // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const isUniqueKey = (meta: Meta): boolean =>
  meta.primaryKey || meta.unique || (meta.indexed !== false && meta.indexed.unique);

/**
 * Type-level counterpart of {@link isUniqueKey}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type IsUniqueKey<M extends Meta> = M extends
  | { readonly primaryKey: true }
  | { readonly unique: true }
  | { readonly indexed: { readonly unique: true } }
  ? true
  : false;

/**
 * Exact initial metadata type inferred for a bare schema field.
 *
 * @category models
 * @since 0.0.0
 */
export interface Empty extends Meta {
  readonly column: undefined;
  readonly columnName: undefined;
  readonly default: undefined;
  readonly dimensions: 0;
  readonly generated: false;
  readonly hasDefault: false;
  readonly identity: false;
  readonly indexed: false;
  readonly primaryKey: false;
  readonly references: undefined;
  readonly unique: false;
  readonly version: false;
}

/**
 * Canonical metadata value for a bare schema field.
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const empty: Empty = {
  column: undefined,
  dimensions: 0,
  primaryKey: false,
  unique: false,
  identity: false,
  hasDefault: false,
  default: undefined,
  generated: false,
  indexed: false,
  version: false,
  columnName: undefined,
  references: undefined,
};

/**
 * Partial metadata update produced by a field combinator.
 *
 * @category models
 * @since 0.0.0
 */
export type Patch = { readonly [K in keyof Meta]?: Meta[K] };

/**
 * Literal-preserving metadata merge type.
 *
 * @category models
 * @since 0.0.0
 */
export type Merge<M extends Meta, P extends Patch> = {
  readonly [K in keyof Meta]: K extends keyof P ? (P[K] extends undefined ? M[K] : Exclude<P[K], undefined>) : M[K];
};

/**
 * Merge a literal-preserving patch into existing metadata.
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const merge: {
  <const P extends Patch>(patch: P): <const M extends Meta>(meta: M) => Merge<M, P>;
  <const M extends Meta, const P extends Patch>(meta: M, patch: P): Merge<M, P>;
} = /* @__PURE__ */ dual(
  2,
  (meta: Meta, patch: Patch): Meta => ({
    column: isUndefined(patch.column) ? meta.column : patch.column,
    dimensions: isUndefined(patch.dimensions) ? meta.dimensions : patch.dimensions,
    primaryKey: isUndefined(patch.primaryKey) ? meta.primaryKey : patch.primaryKey,
    unique: isUndefined(patch.unique) ? meta.unique : patch.unique,
    identity: isUndefined(patch.identity) ? meta.identity : patch.identity,
    hasDefault: isUndefined(patch.hasDefault) ? meta.hasDefault : patch.hasDefault,
    default: isUndefined(patch.default) ? meta.default : patch.default,
    generated: isUndefined(patch.generated) ? meta.generated : patch.generated,
    indexed: isUndefined(patch.indexed) ? meta.indexed : patch.indexed,
    version: isUndefined(patch.version) ? meta.version : patch.version,
    columnName: isUndefined(patch.columnName) ? meta.columnName : patch.columnName,
    references: isUndefined(patch.references) ? meta.references : patch.references,
  })
);
