/**
 * Models PostgreSQL table constraints and indexes as typed descriptor nodes.
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
} from "drizzle-orm/pg-core";
import type {
  ExtraConfigColumn,
  PgIndexMethod,
  PgTableExtraConfigValue,
} from "drizzle-orm/pg-core";
import { isArray } from "effect/Array";
import { taggedEnum } from "effect/Data";
import type { TaggedEnum } from "effect/Data";
import { dual } from "effect/Function";
import { fromUndefinedOr, match } from "effect/Option";
import { hasProperty, isObject, isString, isUndefined } from "effect/Predicate";
import type * as Field from "../core/Field.ts";

/**
 * Retains a field's schema type on the Drizzle column exposed to table extras.
 *
 * **Example** (Name a bound PostgreSQL column)
 *
 * ```ts
 * import { String } from "effect/Schema"
 * import type { Table } from "@beep/effect-drizzle/pg"
 *
 * type NameColumn = Table.BoundColumn<typeof String>
 * // => PostgreSQL extra-config column carrying the name field type
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export type BoundColumn<I extends Field.Input = Field.Input> = ExtraConfigColumn & {
  readonly "~effect-drizzle.field"?: I;
};

/**
 * Maps a field record to the key-preserving columns received by table extras.
 *
 * **Example** (Project bound columns)
 *
 * ```ts
 * import { String } from "effect/Schema"
 * import type { Table } from "@beep/effect-drizzle/pg"
 *
 * type Columns = Table.BoundColumns<{ readonly email: typeof String }>
 * type Email = Columns["email"] // => bound PostgreSQL email column
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

/**
 * Represents every PostgreSQL table-extra descriptor accepted from a model.
 *
 * **Details**
 *
 * The closed union contains composite unique and primary keys, indexes, typed
 * checks, and explicitly unsafe raw-SQL checks. The value companion exposes
 * shallow guards and exhaustive matching.
 *
 * **Gotchas**
 *
 * `Node.is` validates the tag and required outer fields, not complete Drizzle
 * column internals. It protects the callback seam rather than decoding input.
 *
 * **Example** (Match a table-extra node)
 *
 * ```ts
 * import { Table } from "@beep/effect-drizzle/pg"
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
 * Describes a named unique constraint over at least two bound columns.
 *
 * **Example** (Construct a composite unique node)
 *
 * ```ts
 * import { String } from "effect/Schema"
 * import { Table } from "@beep/effect-drizzle/pg"
 *
 * const extras: Table.Callback<{ first: typeof String; last: typeof String }> =
 *   (columns) => [Table.CompositeUnique.make({
 *     name: "person_name_unique",
 *     columns: [columns.first, columns.last]
 *   })] // => one compositeUnique node
 * ```
 *
 * @see {@link compositeUnique} for the concise constructor.
 * @category models
 * @since 0.0.0
 */
export type CompositeUnique = Extract<Node, { readonly _tag: "compositeUnique" }>;

/**
 * Describes a named primary key over at least two bound columns.
 *
 * **Example** (Construct a composite primary-key node)
 *
 * ```ts
 * import { Int } from "effect/Schema"
 * import { Table } from "@beep/effect-drizzle/pg"
 *
 * const extras: Table.Callback<{ leftId: typeof Int; rightId: typeof Int }> =
 *   (columns) => [Table.CompositePrimaryKey.make({
 *     name: "membership_pk",
 *     columns: [columns.leftId, columns.rightId]
 *   })] // => one compositePrimaryKey node
 * ```
 *
 * @see {@link compositePrimaryKey} for the concise constructor.
 * @category models
 * @since 0.0.0
 */
export type CompositePrimaryKey = Extract<Node, { readonly _tag: "compositePrimaryKey" }>;

/**
 * Describes a PostgreSQL index, including method and optional predicate.
 *
 * **Example** (Construct an index node)
 *
 * ```ts
 * import { String } from "effect/Schema"
 * import { Table } from "@beep/effect-drizzle/pg"
 *
 * const extras: Table.Callback<{ email: typeof String }> = (columns) => [
 *   Table.Index.make({
 *     name: "user_email_idx",
 *     columns: [columns.email],
 *     using: "btree",
 *     where: undefined
 *   })
 * ] // => one index node
 * ```
 *
 * @see {@link index} for the concise constructor.
 * @category models
 * @since 0.0.0
 */
export type Index = Extract<Node, { readonly _tag: "index" }>;

/**
 * Describes a check backed by a typed Drizzle SQL expression.
 *
 * **When to use**
 *
 * Use when the check can be expressed through Drizzle's typed SQL builder.
 *
 * **Example** (Construct a typed check node)
 *
 * ```ts
 * import { sql } from "drizzle-orm"
 * import { Table } from "@beep/effect-drizzle/pg"
 *
 * Table.Check.make({
 *   name: "positive_count",
 *   expression: sql<boolean>`count > 0`
 * })._tag // => "check"
 * ```
 *
 * @see {@link UnsafeCheckSql} for raw SQL without typed interpolation.
 * @category models
 * @since 0.0.0
 */
export type Check = Extract<Node, { readonly _tag: "check" }>;

/**
 * Describes a raw-SQL check whose safety is owned entirely by the caller.
 *
 * **When to use**
 *
 * Use when only raw SQL can represent the constraint.
 *
 * **Gotchas**
 *
 * The SQL string is emitted verbatim and receives no carrier validation,
 * escaping, or parameterization.
 *
 * **Example** (Construct an unsafe check node)
 *
 * ```ts
 * import { Table } from "@beep/effect-drizzle/pg"
 *
 * Table.UnsafeCheckSql.make({
 *   name: "positive_count",
 *   sql: "count > 0"
 * })._tag // => "unsafeCheckSql"
 * ```
 *
 * @see {@link Check} for typed SQL checks.
 * @category models
 * @since 0.0.0
 */
export type UnsafeCheckSql = Extract<Node, { readonly _tag: "unsafeCheckSql" }>;

const Nodes = taggedEnum<Node>();
export const CompositeUnique = { make: Nodes.compositeUnique };
export const CompositePrimaryKey = { make: Nodes.compositePrimaryKey };
export const Index = { make: Nodes.index };
export const Check = { make: Nodes.check };
export const UnsafeCheckSql = { make: Nodes.unsafeCheckSql };

const isNamed = (value: unknown): boolean =>
  hasProperty(value, "name") && isString(value.name) && value.name.length > 0;
const isColumn = isObject;
const hasColumns = (value: unknown, minimum: number): boolean =>
  hasProperty(value, "columns") &&
  isArray(value.columns) &&
  value.columns.length >= minimum &&
  value.columns.every(isColumn);

/**
 * Guards the tag and required outer shape of an author-returned extra node.
 *
 * **When to use**
 *
 * Use when values cross a hand-built or type-suppressed extras callback boundary.
 *
 * **Gotchas**
 *
 * The check is deliberately shallow; it does not validate Drizzle column
 * internals or execute SQL expressions.
 *
 * **Example** (Guard an unknown extra)
 *
 * ```ts
 * import { Table } from "@beep/effect-drizzle/pg"
 *
 * const candidate: unknown = Table.unsafeCheckSql("positive_count", "count > 0")
 *
 * Table.isNode(candidate) // => true
 * ```
 *
 * @see {@link Node} for constructors and exhaustive matching.
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
          hasProperty(value, "using") &&
          (isUndefined(value.using) || isString(value.using)) &&
          hasProperty(value, "where") &&
          (isUndefined(value.where) || isDrizzleEntity(value.where, SQL))
        : Nodes.$is("check")(value)
          ? hasProperty(value, "expression") && isDrizzleEntity(value.expression, SQL)
          : Nodes.$is("unsafeCheckSql")(value) && hasProperty(value, "sql") && isString(value.sql));

/** Constructors, guard, and exhaustive matcher for table-extra nodes. */
export const Node = {
  $is: Nodes.$is,
  $match: Nodes.$match,
  is: isNode,
  match: Nodes.$match,
};

/**
 * Types a model callback that builds table extras from bound columns.
 *
 * **Details**
 *
 * Column keys and originating field types are preserved. Returned nodes are
 * compiled only after the Drizzle table supplies real bound columns.
 *
 * **Example** (Declare a PostgreSQL extras callback)
 *
 * ```ts
 * import { String } from "effect/Schema"
 * import { Table } from "@beep/effect-drizzle/pg"
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
 * Constructs a named unique constraint over at least two columns.
 *
 * **Example** (Define a composite unique constraint)
 *
 * ```ts
 * import { String } from "effect/Schema"
 * import { Table } from "@beep/effect-drizzle/pg"
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
 * Constructs a named primary key over at least two columns.
 *
 * **When to use**
 *
 * Use with junction or natural-key tables; a model permits only one inline
 * single-column primary key.
 *
 * **Example** (Define a composite primary key)
 *
 * ```ts
 * import { Int } from "effect/Schema"
 * import { Table } from "@beep/effect-drizzle/pg"
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
 * Constructs a PostgreSQL index with an optional method and predicate.
 *
 * **Details**
 *
 * At least one column is required. `where` creates a partial index and `using`
 * selects the PostgreSQL index method.
 *
 * **Example** (Define a partial index)
 *
 * ```ts
 * import { sql } from "drizzle-orm"
 * import { String } from "effect/Schema"
 * import { Table } from "@beep/effect-drizzle/pg"
 *
 * const extras: Table.Callback<{ email: typeof String }> = (columns) => [
 *   Table.index("user_email_idx", [columns.email], {
 *     using: "btree",
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
  options?: { readonly using?: PgIndexMethod; readonly where?: SQL<boolean> },
): Index =>
  Nodes.index({
    name,
    columns,
    using: options?.using,
    where: options?.where,
  });

/**
 * Constructs a typed SQL check in data-first or data-last form.
 *
 * **When to use**
 *
 * Use when Drizzle's typed SQL builder can express the constraint.
 *
 * **Example** (Define a typed check)
 *
 * ```ts
 * import { sql } from "drizzle-orm"
 * import { Table } from "@beep/effect-drizzle/pg"
 *
 * Table.check("positive_count")(sql<boolean>`count > 0`)._tag // => "check"
 * ```
 *
 * @see {@link unsafeCheckSql} for an explicitly raw alternative.
 * @category constructors
 * @since 0.0.0
 */
export const check: {
  (name: string): (expression: SQL<boolean>) => Check;
  (expression: SQL<boolean>, name: string): Check;
} = dual(2, (expression: SQL<boolean>, name: string): Check => Nodes.check({ name, expression }));

/**
 * Constructs an explicitly unsafe raw-SQL check descriptor.
 *
 * **When to use**
 *
 * Use when only raw SQL can represent the constraint.
 *
 * **Gotchas**
 *
 * The statement is emitted verbatim and is not parameterized or escaped.
 *
 * **Example** (Define a raw check)
 *
 * ```ts
 * import { Table } from "@beep/effect-drizzle/pg"
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

const emitIndex = (node: Index): PgTableExtraConfigValue => {
  const on = drizzleIndex(node.name);
  const builder = match(fromUndefinedOr(node.using), {
    onNone: () => on.on(...node.columns),
    onSome: (using) => on.using(using, ...node.columns),
  });
  return match(fromUndefinedOr(node.where), {
    onNone: () => builder,
    onSome: (where) => builder.where(where),
  });
};

/**
 * Compiles one table-extra descriptor to a Drizzle PostgreSQL config value.
 *
 * **Details**
 *
 * Exhaustive tag matching selects the corresponding public Drizzle builder;
 * raw SQL appears only in the explicitly unsafe variant.
 *
 * **Example** (Emit a Drizzle check)
 *
 * ```ts
 * import { Table } from "@beep/effect-drizzle/pg"
 *
 * Table.emit(Table.unsafeCheckSql("positive_count", "count > 0"))
 * // => Drizzle PostgreSQL check builder
 * ```
 *
 * @category mappers
 * @since 0.0.0
 */
export const emit = (node: Node): PgTableExtraConfigValue =>
  Node.$match(node, {
    check: (current) => drizzleCheck(current.name, current.expression),
    compositePrimaryKey: (current) =>
      drizzlePrimaryKey({ name: current.name, columns: [...current.columns] }),
    compositeUnique: (current) => drizzleUnique(current.name).on(...current.columns),
    index: emitIndex,
    unsafeCheckSql: (current) => drizzleCheck(current.name, sql.raw(current.sql)),
  });
