/**
 * Models SQLite table constraints and indexes as typed descriptor nodes.
 *
 * Model callbacks receive bound Drizzle columns, return this small algebra,
 * and defer compilation until the owning table is projected.
 *
 * @since 0.0.0
 */
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

/**
 * Retains a field's schema type on the SQLite column exposed to table extras.
 *
 * **Example** (Name a bound SQLite column)
 *
 * ```ts
 * import { String } from "effect/Schema"
 * import type { Table } from "@beep/effect-drizzle/sqlite"
 *
 * type NameColumn = Table.BoundColumn<typeof String>
 * // => SQLite column carrying the name field type
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export type BoundColumn<I extends Field.Input = Field.Input> = SQLiteColumn & {
  readonly "~effect-drizzle.field"?: I;
};
/**
 * Maps a field record to key-preserving columns received by SQLite extras.
 *
 * **Example** (Project bound SQLite columns)
 *
 * ```ts
 * import { String } from "effect/Schema"
 * import type { Table } from "@beep/effect-drizzle/sqlite"
 *
 * type Columns = Table.BoundColumns<{ readonly email: typeof String }>
 * type Email = Columns["email"] // => bound SQLite email column
 * ```
 *
 * @category projections
 * @since 0.0.0
 */
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

/**
 * Represents every SQLite table-extra descriptor accepted from a model.
 *
 * **Details**
 *
 * The union contains composite unique and primary keys, indexes, typed checks,
 * and explicitly unsafe raw-SQL checks. The value companion supplies shallow
 * guards and exhaustive matching.
 *
 * **Gotchas**
 *
 * `Node.is` validates the tag and outer fields, not complete Drizzle column
 * internals. It guards the callback seam rather than decoding untrusted input.
 *
 * **Example** (Match a SQLite extra node)
 *
 * ```ts
 * import { Table } from "@beep/effect-drizzle/sqlite"
 *
 * const node = Table.unsafeCheckSql("user_name_check", "name <> ''")
 *
 * Table.Node.is(node) // => true
 * Table.Node.match(node, {
 *   check: () => "typed",
 *   compositePrimaryKey: () => "primary",
 *   compositeUnique: () => "unique",
 *   index: () => "index",
 *   unsafeCheckSql: () => "unsafe"
 * }) // => "unsafe"
 * ```
 *
 * @see {@link isNode} for the callback-boundary guard.
 * @category models
 * @since 0.0.0
 */
export type Node = TaggedEnum<NodeDefinition>;

/**
 * Describes a named unique constraint over at least two SQLite columns.
 *
 * **Example** (Name a composite unique node)
 *
 * ```ts
 * import type { Table } from "@beep/effect-drizzle/sqlite"
 *
 * type Node = Table.CompositeUnique // => tagged compositeUnique descriptor
 * ```
 *
 * @see {@link compositeUnique} for construction.
 * @category models
 * @since 0.0.0
 */
export type CompositeUnique = Extract<Node, { readonly _tag: "compositeUnique" }>;

/**
 * Describes a named primary key over at least two SQLite columns.
 *
 * **Example** (Name a composite primary-key node)
 *
 * ```ts
 * import type { Table } from "@beep/effect-drizzle/sqlite"
 *
 * type Node = Table.CompositePrimaryKey // => tagged compositePrimaryKey descriptor
 * ```
 *
 * @see {@link compositePrimaryKey} for construction.
 * @category models
 * @since 0.0.0
 */
export type CompositePrimaryKey = Extract<Node, { readonly _tag: "compositePrimaryKey" }>;

/**
 * Describes a SQLite index with an optional partial-index predicate.
 *
 * **Example** (Name an index node)
 *
 * ```ts
 * import type { Table } from "@beep/effect-drizzle/sqlite"
 *
 * type Node = Table.Index // => tagged index descriptor
 * ```
 *
 * @see {@link index} for construction.
 * @category models
 * @since 0.0.0
 */
export type Index = Extract<Node, { readonly _tag: "index" }>;

/**
 * Describes a check backed by typed Drizzle SQL.
 *
 * **When to use**
 *
 * Use when the constraint can be expressed through Drizzle's SQL builder.
 *
 * **Example** (Name a typed check node)
 *
 * ```ts
 * import type { Table } from "@beep/effect-drizzle/sqlite"
 *
 * type Node = Table.Check // => tagged typed-check descriptor
 * ```
 *
 * @see {@link UnsafeCheckSql} for raw SQL.
 * @category models
 * @since 0.0.0
 */
export type Check = Extract<Node, { readonly _tag: "check" }>;

/**
 * Describes a raw-SQL check owned entirely by the caller.
 *
 * **When to use**
 *
 * Use when only raw SQL can represent the constraint.
 *
 * **Gotchas**
 *
 * The SQL string is emitted verbatim without validation or escaping.
 *
 * **Example** (Name an unsafe check node)
 *
 * ```ts
 * import type { Table } from "@beep/effect-drizzle/sqlite"
 *
 * type Node = Table.UnsafeCheckSql // => tagged raw-SQL check descriptor
 * ```
 *
 * @see {@link Check} for typed SQL checks.
 * @category models
 * @since 0.0.0
 */
export type UnsafeCheckSql = Extract<Node, { readonly _tag: "unsafeCheckSql" }>;

const Nodes = taggedEnum<Node>();
const isNamed = (value: unknown): boolean =>
  hasProperty(value, "name") && isString(value.name) && value.name.length > 0;
const hasColumns = (value: unknown, minimum: number): boolean =>
  hasProperty(value, "columns") &&
  isArray(value.columns) &&
  value.columns.length >= minimum &&
  value.columns.every(isObject);

/**
 * Guards the tag and required outer shape of an author-returned SQLite node.
 *
 * **When to use**
 *
 * Use when values cross a hand-built or type-suppressed extras callback boundary.
 *
 * **Gotchas**
 *
 * The guard is shallow and does not validate Drizzle column internals.
 *
 * **Example** (Guard an unknown SQLite extra)
 *
 * ```ts
 * import { Table } from "@beep/effect-drizzle/sqlite"
 *
 * const candidate: unknown = Table.unsafeCheckSql("positive_count", "count > 0")
 *
 * Table.isNode(candidate) // => true
 * ```
 *
 * @see {@link Node} for matching and constructors.
 * @category guards
 * @since 0.0.0
 */
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

/** Constructors, guard, and exhaustive matcher for SQLite table-extra nodes. */
export const Node = { $is: Nodes.$is, $match: Nodes.$match, is: isNode, match: Nodes.$match };

/**
 * Types a model callback that builds SQLite extras from bound columns.
 *
 * **Details**
 *
 * Field keys remain correlated with columns until table projection compiles the
 * returned descriptor nodes.
 *
 * **Example** (Declare SQLite extras)
 *
 * ```ts
 * import { String } from "effect/Schema"
 * import { Table } from "@beep/effect-drizzle/sqlite"
 *
 * const extras: Table.Callback<{ email: typeof String }> = (columns) => [
 *   Table.index("user_email_idx", [columns.email])
 * ] // => callback producing one index node
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export type Callback<F extends { readonly [key: string]: Field.Input }> = (
  columns: BoundColumns<F>,
) => ReadonlyArray<Node>;

/**
 * Constructs a named unique constraint over at least two SQLite columns.
 *
 * **Example** (Define a composite unique constraint)
 *
 * ```ts
 * import { String } from "effect/Schema"
 * import { Table } from "@beep/effect-drizzle/sqlite"
 *
 * const extras: Table.Callback<{ first: typeof String; last: typeof String }> =
 *   (columns) => [
 *     Table.compositeUnique("person_name_unique", [columns.first, columns.last])
 *   ] // => callback producing one compositeUnique node
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const compositeUnique = (name: string, columns: CompositeColumns): CompositeUnique =>
  Nodes.compositeUnique({ name, columns });
/**
 * Constructs a named primary key over at least two SQLite columns.
 *
 * **When to use**
 *
 * Use with junction or natural-key tables instead of multiple inline keys.
 *
 * **Example** (Define a composite primary key)
 *
 * ```ts
 * import { Int } from "effect/Schema"
 * import { Table } from "@beep/effect-drizzle/sqlite"
 *
 * const extras: Table.Callback<{ leftId: typeof Int; rightId: typeof Int }> =
 *   (columns) => [
 *     Table.compositePrimaryKey("membership_pk", [columns.leftId, columns.rightId])
 *   ] // => callback producing one compositePrimaryKey node
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const compositePrimaryKey = (name: string, columns: CompositeColumns): CompositePrimaryKey =>
  Nodes.compositePrimaryKey({ name, columns });
/**
 * Constructs a SQLite index with an optional partial-index predicate.
 *
 * **Example** (Define a partial SQLite index)
 *
 * ```ts
 * import { sql } from "drizzle-orm"
 * import { String } from "effect/Schema"
 * import { Table } from "@beep/effect-drizzle/sqlite"
 *
 * const extras: Table.Callback<{ email: typeof String }> = (columns) => [
 *   Table.index("user_email_idx", [columns.email], {
 *     where: sql<boolean>`${columns.email} <> ''`
 *   })
 * ] // => callback producing one partial index node
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const index = (
  name: string,
  columns: NonEmptyColumns,
  options?: { readonly where?: SQL<boolean> },
): Index => Nodes.index({ name, columns, where: options?.where });
/**
 * Constructs a typed SQLite check in data-first or data-last form.
 *
 * **When to use**
 *
 * Use when Drizzle's typed SQL builder can express the constraint.
 *
 * **Example** (Define a typed SQLite check)
 *
 * ```ts
 * import { sql } from "drizzle-orm"
 * import { Table } from "@beep/effect-drizzle/sqlite"
 *
 * Table.check("positive_count")(sql<boolean>`count > 0`)._tag // => "check"
 * ```
 *
 * @see {@link unsafeCheckSql} for raw SQL.
 * @category constructors
 * @since 0.0.0
 */
export const check: {
  (name: string): (expression: SQL<boolean>) => Check;
  (expression: SQL<boolean>, name: string): Check;
} = dual(2, (expression: SQL<boolean>, name: string): Check => Nodes.check({ name, expression }));
/**
 * Constructs an explicitly unsafe raw-SQL SQLite check.
 *
 * **When to use**
 *
 * Use when only raw SQL can represent the constraint.
 *
 * **Gotchas**
 *
 * The statement is emitted verbatim and is not parameterized or escaped.
 *
 * **Example** (Define a raw SQLite check)
 *
 * ```ts
 * import { Table } from "@beep/effect-drizzle/sqlite"
 *
 * Table.unsafeCheckSql("positive_count", "count > 0")._tag
 * // => "unsafeCheckSql"
 * ```
 *
 * @see {@link check} for typed SQL checks.
 * @category constructors
 * @since 0.0.0
 */
export const unsafeCheckSql = (name: string, value: string): UnsafeCheckSql =>
  Nodes.unsafeCheckSql({ name, sql: value });

const emitIndex = (node: Index): SQLiteTableExtraConfigValue => {
  const builder = drizzleIndex(node.name).on(...node.columns);
  return match(fromUndefinedOr(node.where), {
    onNone: () => builder,
    onSome: (where) => builder.where(where),
  });
};

/**
 * Compiles one descriptor to a Drizzle SQLite extra-config value.
 *
 * **Details**
 *
 * Exhaustive tag matching selects the public Drizzle builder; raw SQL appears
 * only in the explicitly unsafe variant.
 *
 * **Example** (Emit a SQLite check)
 *
 * ```ts
 * import { Table } from "@beep/effect-drizzle/sqlite"
 *
 * Table.emit(Table.unsafeCheckSql("positive_count", "count > 0"))
 * // => Drizzle SQLite check builder
 * ```
 *
 * @category mappers
 * @since 0.0.0
 */
export const emit = (node: Node): SQLiteTableExtraConfigValue =>
  Node.$match(node, {
    check: (current) => drizzleCheck(current.name, current.expression),
    compositePrimaryKey: (current) =>
      drizzlePrimaryKey({ name: current.name, columns: [...current.columns] }),
    compositeUnique: (current) => drizzleUnique(current.name).on(...current.columns),
    index: emitIndex,
    unsafeCheckSql: (current) => drizzleCheck(current.name, sql.raw(current.sql)),
  });
