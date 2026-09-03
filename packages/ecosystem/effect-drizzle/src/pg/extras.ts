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
  uniqueIndex as drizzleUniqueIndex,
  PgDialect,
} from "drizzle-orm/pg-core";
import { Match } from "effect";
import { isArray } from "effect/Array";
import { taggedEnum } from "effect/Data";
import { dual } from "effect/Function";
import * as HashSet from "effect/HashSet";
import { fromUndefinedOr, match } from "effect/Option";
import { hasProperty, isObject, isString, isUndefined } from "effect/Predicate";
import { String as StringSchema, TaggedError } from "effect/Schema";
import { declaredFieldsEquivalence } from "../core/declaredFieldsEquivalence.ts";
import * as Meta from "../core/Meta.ts";
import { assertSqlName } from "../core/names.ts";
import type { ExtraConfigColumn, PgIndexMethod, PgTableExtraConfigValue } from "drizzle-orm/pg-core";
import type { TaggedEnum } from "effect/Data";
import type * as Field from "../core/Field.ts";
import type { ValidateSqlName } from "../core/names.ts";

const validateName = (name: string): string => {
  assertSqlName(name, "pg", "PostgreSQL table-extra name");
  return name;
};

/**
 * Failure raised when table-extra structure cannot be represented faithfully.
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export class TableExtraError extends TaggedError<TableExtraError>("@beep/effect-drizzle/pg/TableExtraError")(
  "TableExtraError",
  {
    message: StringSchema,
  },
  {
    description: "A PostgreSQL table-extra declaration violates a database invariant.",
    toEquivalence: (typeParameters) => declaredFieldsEquivalence<TableExtraError>(typeParameters),
  }
) {}

const pgDialect = new PgDialect();
const fail = (message: string): never => {
  throw TableExtraError.make({ message });
};

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
export type BoundColumn<I extends Field.Input = Field.Input, Name extends string = string> = ExtraConfigColumn & {
  readonly "~effect-drizzle.field"?: I;
  readonly "~effect-drizzle.field-name"?: Name;
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
  readonly [K in keyof F & string]: BoundColumn<F[K], K>;
};

type NonEmptyColumns = readonly [BoundColumn, ...BoundColumn[]];
type CompositeColumns = readonly [BoundColumn, BoundColumn, ...BoundColumn[]];

type ColumnField<C> = C extends BoundColumn<infer I, infer _Name> ? I : never;
type ColumnName<C> = C extends BoundColumn<Field.Input, infer Name> ? Name : never;
type ValidateDistinctColumns<
  Columns extends ReadonlyArray<BoundColumn>,
  Seen extends string = never,
> = Columns extends readonly [infer Head extends BoundColumn, ...infer Tail extends ReadonlyArray<BoundColumn>]
  ? ColumnName<Head> extends Seen
    ? Field.SqlTypeError<"table extras cannot repeat a column">
    : ValidateDistinctColumns<Tail, Seen | ColumnName<Head>>
  : unknown;
type ValidatePrimaryKeyColumns<Columns extends ReadonlyArray<BoundColumn>> =
  null extends Field.EncodedOf<ColumnField<Columns[number]>>
    ? Field.SqlTypeError<"composite primary-key columns cannot be nullable">
    : unknown;

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
  uniqueIndex: {
    readonly name: string;
    readonly columns: NonEmptyColumns;
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
 *   uniqueIndex: () => "unique-index",
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
 * Describes a named unique index over one or more PostgreSQL columns.
 *
 * **Example** (Construct a unique index node)
 *
 * ```ts
 * import { String } from "effect/Schema"
 * import { Table } from "@beep/effect-drizzle/pg"
 *
 * const extras: Table.Callback<{ email: typeof String }> = (columns) => [
 *   Table.UniqueIndex.make({
 *     name: "user_email_unique_idx",
 *     columns: [columns.email],
 *     where: undefined
 *   })
 * ]
 *
 * console.log(extras)
 * ```
 *
 * @see {@link uniqueIndex} for the concise constructor.
 * @category models
 * @since 0.0.0
 */
export type UniqueIndex = Extract<Node, { readonly _tag: "uniqueIndex" }>;

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

const Nodes = /* @__PURE__ */ taggedEnum<Node>();
/**
 * Constructs a composite unique-constraint node.
 *
 * **Example** (Infer the constructed node type)
 *
 * ```ts
 * import { Table } from "@beep/effect-drizzle/pg"
 *
 * type Made = ReturnType<typeof Table.CompositeUnique.make> // => tagged compositeUnique node
 * ```
 *
 * @see {@link compositeUnique} for the validated factory used in table extras.
 * @category constructors
 * @since 0.0.0
 */
export const CompositeUnique = { make: Nodes.compositeUnique };
/**
 * Constructs a composite primary-key node.
 *
 * **Example** (Infer the constructed node type)
 *
 * ```ts
 * import { Table } from "@beep/effect-drizzle/pg"
 *
 * type Made = ReturnType<typeof Table.CompositePrimaryKey.make> // => tagged compositePrimaryKey node
 * ```
 *
 * @see {@link compositePrimaryKey} for the validated factory used in table extras.
 * @category constructors
 * @since 0.0.0
 */
export const CompositePrimaryKey = { make: Nodes.compositePrimaryKey };
/**
 * Constructs an index node.
 *
 * **Example** (Infer the constructed node type)
 *
 * ```ts
 * import { Table } from "@beep/effect-drizzle/pg"
 *
 * type Made = ReturnType<typeof Table.Index.make> // => tagged index node
 * ```
 *
 * @see {@link index} for the validated factory used in table extras.
 * @category constructors
 * @since 0.0.0
 */
export const Index = { make: Nodes.index };
/**
 * Constructs a named unique-index node.
 *
 * **Example** (Infer the constructed node type)
 *
 * ```ts
 * import { Table } from "@beep/effect-drizzle/pg"
 * import { pgTable, text } from "drizzle-orm/pg-core"
 *
 * const user = pgTable("user", { email: text("email").notNull() }, (columns) => [
 *   Table.UniqueIndex.make({
 *     name: "user_email_unique_idx",
 *     columns: [columns.email],
 *     where: undefined
 *   })
 * ])
 * console.log(user.email.name)
 * ```
 *
 * @see {@link uniqueIndex} for the validated factory used in table extras.
 * @category constructors
 * @since 0.0.0
 */
export const UniqueIndex = { make: Nodes.uniqueIndex };
/**
 * Constructs a typed check-constraint node.
 *
 * **Example** (Infer the constructed node type)
 *
 * ```ts
 * import { Table } from "@beep/effect-drizzle/pg"
 *
 * type Made = ReturnType<typeof Table.Check.make> // => tagged check node
 * ```
 *
 * @see {@link check} for the validated factory used in table extras.
 * @category constructors
 * @since 0.0.0
 */
export const Check = { make: Nodes.check };
/**
 * Constructs an explicitly unsafe SQL check node.
 *
 * **Example** (Build an unsafe SQL check node)
 *
 * ```ts
 * import { Table } from "@beep/effect-drizzle/pg"
 *
 * const node = Table.UnsafeCheckSql.make({ name: "user_name_check", sql: "name <> ''" })
 * console.log(node._tag) // "unsafeCheckSql"
 * ```
 *
 * @see {@link unsafeCheckSql} for the validated factory used in table extras.
 * @category constructors
 * @since 0.0.0
 */
export const UnsafeCheckSql = { make: Nodes.unsafeCheckSql };

const isNamed = (value: unknown): boolean =>
  hasProperty(value, "name") && isString(value.name) && value.name.length > 0;
const isColumn = isObject;
const hasColumns = (value: unknown, minimum: number): boolean =>
  hasProperty(value, "columns") &&
  isArray(value.columns) &&
  value.columns.length >= minimum &&
  value.columns.every(isColumn);
const hasOptionalWhere = (value: unknown): boolean =>
  hasProperty(value, "where") && (isUndefined(value.where) || isDrizzleEntity(value.where, SQL));
const hasOptionalIndexMethod = (value: unknown): boolean =>
  hasProperty(value, "using") && (isUndefined(value.using) || isString(value.using));
const hasValidNodeDefinition: (value: unknown) => boolean = Match.type<unknown>().pipe(
  Match.when(Nodes.$is("compositeUnique"), (value) => hasColumns(value, 2)),
  Match.when(Nodes.$is("compositePrimaryKey"), (value) => hasColumns(value, 2)),
  Match.when(
    Nodes.$is("index"),
    (value) => hasColumns(value, 1) && hasOptionalIndexMethod(value) && hasOptionalWhere(value)
  ),
  Match.when(Nodes.$is("uniqueIndex"), (value) => hasColumns(value, 1) && hasOptionalWhere(value)),
  Match.when(Nodes.$is("check"), (value) => hasProperty(value, "expression") && isDrizzleEntity(value.expression, SQL)),
  Match.when(Nodes.$is("unsafeCheckSql"), (value) => hasProperty(value, "sql") && isString(value.sql)),
  Match.orElse(() => false)
);

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
export const isNode = (value: unknown): value is Node => isNamed(value) && hasValidNodeDefinition(value);

/**
 * Constructors, guard, and exhaustive matcher for table-extra nodes.
 *
 * **Example** (Construct and recognize a PostgreSQL check)
 *
 * ```ts
 * import { Table } from "@beep/effect-drizzle/pg"
 *
 * const node = Table.UnsafeCheckSql.make({ name: "positive_count", sql: "count > 0" })
 * Table.Node.is(node) // => true
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
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
  columns: BoundColumns<F>
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
export const compositeUnique: {
  <const Columns extends CompositeColumns>(
    columns: Columns & ValidateDistinctColumns<Columns>
  ): <const Name extends string>(
    name: Name & ValidateSqlName<Name, "Table.compositeUnique name must be a lowercase SQL identifier">
  ) => CompositeUnique;
  <const Name extends string, const Columns extends CompositeColumns>(
    name: Name & ValidateSqlName<Name, "Table.compositeUnique name must be a lowercase SQL identifier">,
    columns: Columns & ValidateDistinctColumns<Columns>
  ): CompositeUnique;
} = /* @__PURE__ */ dual(
  2,
  (name: string, columns: CompositeColumns): CompositeUnique =>
    Nodes.compositeUnique({ name: validateName(name), columns })
);

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
export const compositePrimaryKey: {
  <const Columns extends CompositeColumns>(
    columns: Columns & ValidateDistinctColumns<Columns> & ValidatePrimaryKeyColumns<Columns>
  ): <const Name extends string>(
    name: Name & ValidateSqlName<Name, "Table.compositePrimaryKey name must be a lowercase SQL identifier">
  ) => CompositePrimaryKey;
  <const Name extends string, const Columns extends CompositeColumns>(
    name: Name & ValidateSqlName<Name, "Table.compositePrimaryKey name must be a lowercase SQL identifier">,
    columns: Columns & ValidateDistinctColumns<Columns> & ValidatePrimaryKeyColumns<Columns>
  ): CompositePrimaryKey;
} = /* @__PURE__ */ dual(
  2,
  (name: string, columns: CompositeColumns): CompositePrimaryKey =>
    Nodes.compositePrimaryKey({ name: validateName(name), columns })
);

type IndexOptions = { readonly using?: PgIndexMethod; readonly where?: SQL<boolean> };

/**
 * Constructs a PostgreSQL index with an optional method and predicate.
 *
 * **Details**
 *
 * At least one column is required. `where` creates a partial index and `using`
 * selects the PostgreSQL index method.
 *
 * **Gotchas**
 *
 * Partial predicates must render with zero parameters. BSL does not analyze SQL
 * semantics such as function immutability; PostgreSQL validates them when DDL
 * is applied.
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
export const index: {
  <const Columns extends NonEmptyColumns>(
    columns: Columns & ValidateDistinctColumns<Columns>,
    options?: IndexOptions
  ): <const Name extends string>(
    name: Name & ValidateSqlName<Name, "Table.index name must be a lowercase SQL identifier">
  ) => Index;
  <const Name extends string, const Columns extends NonEmptyColumns>(
    name: Name & ValidateSqlName<Name, "Table.index name must be a lowercase SQL identifier">,
    columns: Columns & ValidateDistinctColumns<Columns>,
    options?: IndexOptions
  ): Index;
} = /* @__PURE__ */ dual(
  (args) => isString(args[0]),
  (name: string, columns: NonEmptyColumns, options?: IndexOptions): Index =>
    Nodes.index({
      name: validateName(name),
      columns,
      using: options?.using,
      where: options?.where,
    })
);

type UniqueIndexOptions = { readonly where?: SQL<boolean> };

/**
 * Constructs a named unique index over one or more columns.
 *
 * **When to use**
 *
 * Use when DDL compatibility requires an index rather than a table-level
 * unique constraint.
 *
 * **Example** (Define a public-id unique index)
 *
 * ```ts
 * import { String } from "effect/Schema"
 * import { Table } from "@beep/effect-drizzle/pg"
 *
 * const extras: Table.Callback<{ publicId: typeof String }> = (columns) => [
 *   Table.uniqueIndex("account_public_id_unique_idx", [columns.publicId])
 * ]
 *
 * console.log(extras)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const uniqueIndex: {
  <const Columns extends NonEmptyColumns>(
    columns: Columns & ValidateDistinctColumns<Columns>,
    options?: UniqueIndexOptions
  ): <const Name extends string>(
    name: Name & ValidateSqlName<Name, "Table.uniqueIndex name must be a lowercase SQL identifier">
  ) => UniqueIndex;
  <const Name extends string, const Columns extends NonEmptyColumns>(
    name: Name & ValidateSqlName<Name, "Table.uniqueIndex name must be a lowercase SQL identifier">,
    columns: Columns & ValidateDistinctColumns<Columns>,
    options?: UniqueIndexOptions
  ): UniqueIndex;
} = /* @__PURE__ */ dual(
  (args) => isString(args[0]),
  (name: string, columns: NonEmptyColumns, options?: UniqueIndexOptions): UniqueIndex =>
    Nodes.uniqueIndex({
      name: validateName(name),
      columns,
      where: options?.where,
    })
);

/**
 * Constructs a typed SQL check in data-first or data-last form.
 *
 * **When to use**
 *
 * Use when Drizzle's typed SQL builder can express the constraint.
 *
 * **Gotchas**
 *
 * CHECK expressions must render with zero parameters. BSL does not parse SQL or
 * detect forbidden subqueries; PostgreSQL remains the semantic authority.
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
  <const Name extends string>(
    name: Name & ValidateSqlName<Name, "Table.check name must be a lowercase SQL identifier">
  ): (expression: SQL<boolean>) => Check;
  <const Name extends string>(
    expression: SQL<boolean>,
    name: Name & ValidateSqlName<Name, "Table.check name must be a lowercase SQL identifier">
  ): Check;
} = /* @__PURE__ */ dual(
  2,
  (expression: SQL<boolean>, name: string): Check => Nodes.check({ name: validateName(name), expression })
);

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
export const unsafeCheckSql: {
  (
    value: string
  ): <const Name extends string>(
    name: Name & ValidateSqlName<Name, "Table.unsafeCheckSql name must be a lowercase SQL identifier">
  ) => UnsafeCheckSql;
  <const Name extends string>(
    name: Name & ValidateSqlName<Name, "Table.unsafeCheckSql name must be a lowercase SQL identifier">,
    value: string
  ): UnsafeCheckSql;
} = /* @__PURE__ */ dual(
  2,
  (name: string, value: string): UnsafeCheckSql => Nodes.unsafeCheckSql({ name: validateName(name), sql: value })
);

const emitIndex = (node: Index): PgTableExtraConfigValue => {
  const on = drizzleIndex(node.name);
  const builder = match(fromUndefinedOr(node.using), {
    onNone: () => on.on(...node.columns),
    onSome: (using) => on.using(using, ...node.columns),
  });
  return match(fromUndefinedOr(node.where), {
    onNone: () => builder,
    onSome: (where) => {
      Meta.assertNoSqlParameters(
        pgDialect.sqlToQuery(where).params,
        `PostgreSQL partial-index predicate '${node.name}'`
      );
      return builder.where(where);
    },
  });
};

const emitUniqueIndex = (node: UniqueIndex): PgTableExtraConfigValue => {
  const builder = drizzleUniqueIndex(node.name).on(...node.columns);
  return match(fromUndefinedOr(node.where), {
    onNone: () => builder,
    onSome: (where) => {
      Meta.assertNoSqlParameters(
        pgDialect.sqlToQuery(where).params,
        `PostgreSQL partial unique-index predicate '${node.name}'`
      );
      return builder.where(where);
    },
  });
};

const validateColumns = (node: Node): void => {
  if (!hasProperty(node, "columns") || !isArray(node.columns)) return;
  const names = node.columns.map((column) => column.name);
  if (HashSet.size(HashSet.fromIterable(names)) !== names.length) {
    fail(`PostgreSQL table extra '${node.name}' repeats a physical column.`);
  }
  if (names.length > 32) {
    fail(`PostgreSQL table extra '${node.name}' exceeds the 32-column index limit.`);
  }
  if (Nodes.$is("compositePrimaryKey")(node) && node.columns.some((column) => !column.notNull)) {
    fail(`PostgreSQL composite primary key '${node.name}' contains a nullable column.`);
  }
};

/**
 * Validate a model's complete declared extra set before Drizzle emission.
 *
 * @internal
 * @category constructors
 * @since 0.0.0
 */
export const validateNodes: {
  (inlinePrimaryKeys: number): (nodes: ReadonlyArray<Node>) => void;
  (nodes: ReadonlyArray<Node>, inlinePrimaryKeys: number): void;
} = /* @__PURE__ */ dual(2, (nodes: ReadonlyArray<Node>, inlinePrimaryKeys: number): void => {
  const names = nodes.map((node) => node.name);
  if (HashSet.size(HashSet.fromIterable(names)) !== names.length) {
    fail("PostgreSQL table-extra names must be unique within their owning table.");
  }
  const primaryKeys = inlinePrimaryKeys + nodes.filter(Nodes.$is("compositePrimaryKey")).length;
  if (primaryKeys > 1) {
    fail("A PostgreSQL table can declare at most one primary key across inline and composite forms.");
  }
  nodes.forEach(validateColumns);
});

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
    check: (current) => {
      Meta.assertNoSqlParameters(pgDialect.sqlToQuery(current.expression).params, `PostgreSQL CHECK '${current.name}'`);
      return drizzleCheck(current.name, current.expression);
    },
    compositePrimaryKey: (current) => drizzlePrimaryKey({ name: current.name, columns: [...current.columns] }),
    compositeUnique: (current) => drizzleUnique(current.name).on(...current.columns),
    index: emitIndex,
    uniqueIndex: emitUniqueIndex,
    unsafeCheckSql: (current) => drizzleCheck(current.name, sql.raw(current.sql)),
  });
