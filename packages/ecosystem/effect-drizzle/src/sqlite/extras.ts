/**
 * Models SQLite table constraints and indexes as typed descriptor nodes.
 *
 * Model callbacks receive bound Drizzle columns, return this small algebra,
 * and defer compilation until the owning table is projected.
 *
 * @since 0.0.0
 */
// fallow-ignore-file code-duplication -- pg/sqlite are deliberately mirrored dialect implementations; shared logic lives in src/core and the remaining parallelism is per-dialect vocabulary that must evolve independently (doc 14 family; review at next dialect addition)

import { is as isDrizzleEntity, SQL, sql } from "drizzle-orm";
import {
  check as drizzleCheck,
  index as drizzleIndex,
  primaryKey as drizzlePrimaryKey,
  unique as drizzleUnique,
  uniqueIndex as drizzleUniqueIndex,
  SQLiteDialect,
} from "drizzle-orm/sqlite-core";
import { Match } from "effect";
import { isArray } from "effect/Array";
import { taggedEnum } from "effect/Data";
import { dual } from "effect/Function";
import { fromUndefinedOr, match } from "effect/Option";
import { hasProperty, isObject, isString } from "effect/Predicate";
import { String as StringSchema, TaggedError } from "effect/Schema";
import { declaredFieldsEquivalence } from "../core/declaredFieldsEquivalence.ts";
import * as Meta from "../core/Meta.ts";
import { assertSqlName } from "../core/names.ts";
import type { SQLiteColumn, SQLiteTableExtraConfigValue } from "drizzle-orm/sqlite-core";
import type { TaggedEnum } from "effect/Data";
import type * as Field from "../core/Field.ts";
import type { ValidateSqlName } from "../core/names.ts";

const validateName = (name: string): string => {
  assertSqlName(name, "sqlite", "SQLite table-extra name");
  return name;
};

/**
 * Failure raised when SQLite table-extra structure cannot be represented faithfully.
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export class TableExtraError extends TaggedError<TableExtraError>("@beep/effect-drizzle/sqlite/TableExtraError")(
  "TableExtraError",
  {
    message: StringSchema,
  },
  {
    description: "A SQLite table-extra declaration violates a database invariant.",
    toEquivalence: (typeParameters) => declaredFieldsEquivalence<TableExtraError>(typeParameters),
  }
) {}

const sqliteDialect = new SQLiteDialect();
const fail = (message: string): never => {
  throw TableExtraError.make({ message });
};

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
export type BoundColumn<I extends Field.Input = Field.Input, Name extends string = string> = SQLiteColumn & {
  readonly "~effect-drizzle.field"?: I;
  readonly "~effect-drizzle.field-name"?: Name;
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
  compositeUnique: { readonly name: string; readonly columns: CompositeColumns };
  compositePrimaryKey: { readonly name: string; readonly columns: CompositeColumns };
  index: {
    readonly name: string;
    readonly columns: NonEmptyColumns;
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
 * Describes a named unique index over one or more SQLite columns.
 *
 * **Example** (Construct a unique index node)
 *
 * ```ts
 * import { String } from "effect/Schema"
 * import { Table } from "@beep/effect-drizzle/sqlite"
 *
 * const extras: Table.Callback<{ publicId: typeof String }> = (columns) => [
 *   Table.uniqueIndex("account_public_id_unique_idx", [columns.publicId])
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

const Nodes = /* @__PURE__ */ taggedEnum<Node>();
const isNamed = (value: unknown): boolean =>
  hasProperty(value, "name") && isString(value.name) && value.name.length > 0;
const hasColumns = (value: unknown, minimum: number): boolean =>
  hasProperty(value, "columns") &&
  isArray(value.columns) &&
  value.columns.length >= minimum &&
  value.columns.every(isObject);
const hasOptionalWhere = (value: unknown): boolean =>
  hasProperty(value, "where") && (value.where === undefined || isDrizzleEntity(value.where, SQL));

const hasValidNodeDefinition: (value: unknown) => boolean = Match.type<unknown>().pipe(
  Match.when(Nodes.$is("compositeUnique"), (value) => hasColumns(value, 2)),
  Match.when(Nodes.$is("compositePrimaryKey"), (value) => hasColumns(value, 2)),
  Match.when(Nodes.$is("index"), (value) => hasColumns(value, 1) && hasOptionalWhere(value)),
  Match.when(Nodes.$is("uniqueIndex"), (value) => hasColumns(value, 1) && hasOptionalWhere(value)),
  Match.when(Nodes.$is("check"), (value) => hasProperty(value, "expression") && isDrizzleEntity(value.expression, SQL)),
  Match.when(Nodes.$is("unsafeCheckSql"), (value) => hasProperty(value, "sql") && isString(value.sql)),
  Match.orElse(() => false)
);

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
export const isNode = (value: unknown): value is Node => isNamed(value) && hasValidNodeDefinition(value);

/**
 * Constructors, guard, and exhaustive matcher for SQLite table-extra nodes.
 *
 * **Example** (Recognize a SQLite extra node)
 *
 * ```ts
 * import { Table } from "@beep/effect-drizzle/sqlite"
 *
 * const node = Table.unsafeCheckSql("positive_count", "count > 0")
 * Table.Node.is(node) // => true
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
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
  columns: BoundColumns<F>
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
type IndexOptions = { readonly where?: SQL<boolean> };

/**
 * Constructs a SQLite index with an optional partial-index predicate.
 *
 * **Gotchas**
 *
 * Partial predicates must render with zero parameters. BSL does not analyze
 * determinism, subqueries, or SQLite's deeper predicate grammar.
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
    Nodes.index({ name: validateName(name), columns, where: options?.where })
);

type UniqueIndexOptions = { readonly where?: SQL<boolean> };

/**
 * Constructs a named unique index over one or more SQLite columns.
 *
 * **When to use**
 *
 * Use when DDL compatibility requires a unique index rather than a table-level
 * unique constraint.
 *
 * **Example** (Define a public-id unique index)
 *
 * ```ts
 * import { String } from "effect/Schema"
 * import { Table } from "@beep/effect-drizzle/sqlite"
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
    Nodes.uniqueIndex({ name: validateName(name), columns, where: options?.where })
);
/**
 * Constructs a typed SQLite check in data-first or data-last form.
 *
 * **When to use**
 *
 * Use when Drizzle's typed SQL builder can express the constraint.
 *
 * **Gotchas**
 *
 * CHECK expressions must render with zero parameters. Carrier typing is not SQL
 * semantic analysis; SQLite remains authoritative for forbidden constructs.
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

const emitUniqueIndex = (node: UniqueIndex): SQLiteTableExtraConfigValue => {
  const builder = drizzleUniqueIndex(node.name).on(...node.columns);
  return match(fromUndefinedOr(node.where), {
    onNone: () => builder,
    onSome: (where) => {
      Meta.assertNoSqlParameters(
        sqliteDialect.sqlToQuery(where).params,
        `SQLite partial-index predicate '${node.name}'`
      );
      return builder.where(where);
    },
  });
};

const emitIndex = (node: Index): SQLiteTableExtraConfigValue => {
  const builder = drizzleIndex(node.name).on(...node.columns);
  return match(fromUndefinedOr(node.where), {
    onNone: () => builder,
    onSome: (where) => {
      Meta.assertNoSqlParameters(
        sqliteDialect.sqlToQuery(where).params,
        `SQLite partial-index predicate '${node.name}'`
      );
      return builder.where(where);
    },
  });
};

const validateColumns = (node: Node): void => {
  if (!hasProperty(node, "columns") || !isArray(node.columns)) return;
  const names = node.columns.map((column) => column.name);
  if (new Set(names).size !== names.length) {
    fail(`SQLite table extra '${node.name}' repeats a physical column.`);
  }
  if (Nodes.$is("compositePrimaryKey")(node) && node.columns.some((column) => !column.notNull)) {
    fail(`SQLite composite primary key '${node.name}' contains a nullable column.`);
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
  if (new Set(names).size !== names.length) {
    fail("SQLite table-extra names must be unique within their owning table.");
  }
  const primaryKeys = inlinePrimaryKeys + nodes.filter(Nodes.$is("compositePrimaryKey")).length;
  if (primaryKeys > 1) {
    fail("A SQLite table can declare at most one primary key across inline and composite forms.");
  }
  nodes.forEach(validateColumns);
});

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
    check: (current) => {
      Meta.assertNoSqlParameters(sqliteDialect.sqlToQuery(current.expression).params, `SQLite CHECK '${current.name}'`);
      return drizzleCheck(current.name, current.expression);
    },
    compositePrimaryKey: (current) => drizzlePrimaryKey({ name: current.name, columns: [...current.columns] }),
    compositeUnique: (current) => drizzleUnique(current.name).on(...current.columns),
    index: emitIndex,
    uniqueIndex: emitUniqueIndex,
    unsafeCheckSql: (current) => drizzleCheck(current.name, sql.raw(current.sql)),
  });
