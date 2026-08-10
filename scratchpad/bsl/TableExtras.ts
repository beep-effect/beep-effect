/** Typed table-level PostgreSQL constraints and indexes. */
import { $ScratchpadId } from "@beep/identity";
import { SchemaUtils } from "@beep/schema";
import { SQL, sql } from "drizzle-orm";
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
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import type * as Field from "./Field.ts";

const $I = $ScratchpadId.create("bsl/TableExtras");

/**
 * A bound Drizzle column retaining its originating BSL field in a phantom.
 *
 * **Example** (Accept a bound column)
 *
 * ```ts
 * import type { BoundColumn } from "./TableExtras.ts"
 *
 * declare const column: BoundColumn
 * console.log(column.name)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type BoundColumn<I extends Field.Input = Field.Input> =
  ExtraConfigColumn & {
    readonly "~bsl.field"?: I;
  };

/**
 * Key-preserving bound-column projection supplied to table-extra callbacks.
 *
 * **Example** (Read a projected key)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import type { BoundColumns } from "./TableExtras.ts"
 *
 * declare const columns: BoundColumns<{ readonly name: typeof S.String }>
 * console.log(columns.name.name)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type BoundColumns<F extends { readonly [key: string]: Field.Input }> = {
  readonly [K in keyof F & string]: BoundColumn<F[K]>;
};

type AnyBoundColumn = BoundColumn;
const BoundColumnSchema = S.declare<AnyBoundColumn>(
  (input): input is AnyBoundColumn => P.isObject(input),
  {
    identifier: $I`BoundColumnSchema`,
    title: "Bound PostgreSQL Column",
    description:
      "A Drizzle extra-config column bound to a projected BSL table.",
  }
);
const NonEmptyColumns = S.TupleWithRest(S.Tuple([BoundColumnSchema]), [
  BoundColumnSchema,
]);
type NonEmptyColumns = typeof NonEmptyColumns.Type;
const CompositeColumns = S.TupleWithRest(
  S.Tuple([BoundColumnSchema, BoundColumnSchema]),
  [BoundColumnSchema]
);
type CompositeColumns = typeof CompositeColumns.Type;
const IndexMethod = S.declare<PgIndexMethod>(P.isString, {
  identifier: $I`IndexMethod`,
  title: "PostgreSQL Index Method",
  description: "A PostgreSQL index access method accepted by Drizzle.",
});

/**
 * Schema for a named composite unique constraint.
 *
 * **Example** (Construct a composite unique node)
 *
 * ```ts
 * import { CompositeUnique } from "./TableExtras.ts"
 * import type { BoundColumn } from "./TableExtras.ts"
 *
 * declare const column: BoundColumn
 * console.log(CompositeUnique.make({ name: "slug_unique", columns: [column, column] })._tag)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CompositeUnique = S.TaggedStruct("compositeUnique", {
  name: S.NonEmptyString,
  columns: CompositeColumns,
}).pipe(
  $I.annoteSchema("CompositeUnique", {
    description: "Named PostgreSQL composite unique constraint.",
  })
);
/**
 * Decoded composite-unique descriptor.
 *
 * @category models
 * @since 0.0.0
 */
export type CompositeUnique = typeof CompositeUnique.Type;

/**
 * Schema for a named composite primary key.
 *
 * **Example** (Construct a composite primary-key node)
 *
 * ```ts
 * import { CompositePrimaryKey } from "./TableExtras.ts"
 * import type { BoundColumn } from "./TableExtras.ts"
 *
 * declare const column: BoundColumn
 * console.log(CompositePrimaryKey.make({ name: "membership_pk", columns: [column, column] })._tag)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CompositePrimaryKey = S.TaggedStruct("compositePrimaryKey", {
  name: S.NonEmptyString,
  columns: CompositeColumns,
}).pipe(
  $I.annoteSchema("CompositePrimaryKey", {
    description: "Named PostgreSQL composite primary key.",
  })
);
/**
 * Decoded composite-primary-key descriptor.
 *
 * @category models
 * @since 0.0.0
 */
export type CompositePrimaryKey = typeof CompositePrimaryKey.Type;

/**
 * Schema for a PostgreSQL index descriptor.
 *
 * **Example** (Construct an index node)
 *
 * ```ts
 * import { Index } from "./TableExtras.ts"
 * import type { BoundColumn } from "./TableExtras.ts"
 *
 * declare const column: BoundColumn
 * console.log(Index.make({ name: "slug_idx", columns: [column], using: "btree", where: undefined })._tag)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Index = S.TaggedStruct("index", {
  name: S.NonEmptyString,
  columns: NonEmptyColumns,
  using: S.UndefinedOr(IndexMethod),
  where: S.UndefinedOr(S.instanceOf(SQL<boolean>)),
}).pipe(
  $I.annoteSchema("Index", {
    description: "Named PostgreSQL index descriptor.",
  })
);
/**
 * Decoded PostgreSQL index descriptor.
 *
 * @category models
 * @since 0.0.0
 */
export type Index = typeof Index.Type;

/**
 * Schema for a typed SQL check constraint.
 *
 * **Example** (Construct a typed check)
 *
 * ```ts
 * import { sql } from "drizzle-orm"
 * import { Check } from "./TableExtras.ts"
 *
 * console.log(Check.make({ name: "positive", expression: sql<boolean>`value > 0` })._tag)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Check = S.TaggedStruct("check", {
  name: S.NonEmptyString,
  expression: S.instanceOf(SQL<boolean>),
}).pipe(
  $I.annoteSchema("Check", {
    description: "Typed PostgreSQL check constraint.",
  })
);
/**
 * Decoded typed-check descriptor.
 *
 * @category models
 * @since 0.0.0
 */
export type Check = typeof Check.Type;

/**
 * Schema for an explicit raw-SQL check escape hatch.
 *
 * **Example** (Construct a raw check)
 *
 * ```ts
 * import { UnsafeCheckSql } from "./TableExtras.ts"
 *
 * console.log(UnsafeCheckSql.make({ name: "positive", sql: "value > 0" })._tag)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const UnsafeCheckSql = S.TaggedStruct("unsafeCheckSql", {
  name: S.NonEmptyString,
  sql: S.String,
}).pipe(
  $I.annoteSchema("UnsafeCheckSql", {
    description: "Explicit raw-SQL check constraint escape hatch.",
  })
);
/**
 * Decoded raw-SQL check descriptor.
 *
 * @category models
 * @since 0.0.0
 */
export type UnsafeCheckSql = typeof UnsafeCheckSql.Type;

/**
 * Complete tagged algebra of table-level PostgreSQL extra configuration.
 *
 * **Example** (Recognize an extra-config node)
 *
 * ```ts
 * import { Node, UnsafeCheckSql } from "./TableExtras.ts"
 *
 * console.log(Node.is(UnsafeCheckSql.make({ name: "positive", sql: "value > 0" }))) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Node = S.Union([
  CompositeUnique,
  CompositePrimaryKey,
  Index,
  Check,
  UnsafeCheckSql,
]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("Node", {
    description: "Complete table-level PostgreSQL extra-config algebra.",
  }),
  SchemaUtils.withCodecStatics
);
/**
 * Decoded table-extra node union.
 *
 * @category models
 * @since 0.0.0
 */
export type Node = typeof Node.Type;

/**
 * Model callback evaluated over Drizzle-bound columns.
 *
 * @category models
 * @since 0.0.0
 */
export type Callback<F extends { readonly [key: string]: Field.Input }> = (
  columns: BoundColumns<F>
) => ReadonlyArray<Node>;

/**
 * Construct a named composite unique constraint.
 *
 * **Example** (Declare composite uniqueness)
 *
 * ```ts
 * import { compositeUnique } from "./TableExtras.ts"
 * import type { BoundColumn } from "./TableExtras.ts"
 *
 * declare const left: BoundColumn
 * declare const right: BoundColumn
 * console.log(compositeUnique("left_right_unique", [left, right]).name)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const compositeUnique = (
  name: string,
  columns: CompositeColumns
): CompositeUnique => CompositeUnique.make({ name, columns });

/**
 * Construct a named composite primary key.
 *
 * **Example** (Declare a composite primary key)
 *
 * ```ts
 * import { compositePrimaryKey } from "./TableExtras.ts"
 * import type { BoundColumn } from "./TableExtras.ts"
 *
 * declare const left: BoundColumn
 * declare const right: BoundColumn
 * console.log(compositePrimaryKey("membership_pk", [left, right]).name)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const compositePrimaryKey = (
  name: string,
  columns: CompositeColumns
): CompositePrimaryKey => CompositePrimaryKey.make({ name, columns });

/**
 * Construct a named PostgreSQL index with optional method and predicate.
 *
 * **Example** (Declare a btree index)
 *
 * ```ts
 * import { index } from "./TableExtras.ts"
 * import type { BoundColumn } from "./TableExtras.ts"
 *
 * declare const column: BoundColumn
 * console.log(index("slug_idx", [column], { using: "btree" }).using) // "btree"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const index = (
  name: string,
  columns: NonEmptyColumns,
  options?: { readonly using?: PgIndexMethod; readonly where?: SQL<boolean> }
): Index =>
  Index.make({ name, columns, using: options?.using, where: options?.where });

/**
 * Construct a typed SQL check expression.
 *
 * **Example** (Declare a typed check)
 *
 * ```ts
 * import { sql } from "drizzle-orm"
 * import { check } from "./TableExtras.ts"
 *
 * const positive = sql<boolean>`value > 0`
 * console.log(check(positive, "positive")._tag) // "check"
 * console.log(check("positive")(positive)._tag) // "check"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const check: {
  (name: string): (expression: SQL<boolean>) => Check;
  (expression: SQL<boolean>, name: string): Check;
} = dual(
  2,
  (expression: SQL<boolean>, name: string): Check =>
    Check.make({ name, expression })
);

/**
 * Construct an explicitly unsafe raw-SQL check constraint.
 *
 * **Example** (Declare a raw check)
 *
 * ```ts
 * import { unsafeCheckSql } from "./TableExtras.ts"
 *
 * console.log(unsafeCheckSql("positive", "value > 0")._tag) // "unsafeCheckSql"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const unsafeCheckSql = (name: string, value: string): UnsafeCheckSql =>
  UnsafeCheckSql.make({ name, sql: value });

const emitIndex = (node: Index): PgTableExtraConfigValue => {
  const on = drizzleIndex(node.name);
  const builder = O.match(O.fromUndefinedOr(node.using), {
    onNone: () => on.on(...node.columns),
    onSome: (using) => on.using(using, ...node.columns),
  });
  return O.match(O.fromUndefinedOr(node.where), {
    onNone: () => builder,
    onSome: (where) => builder.where(where),
  });
};

/**
 * Compile a typed node to the installed Drizzle extra-config builder.
 *
 * **Example** (Compile a raw check node)
 *
 * ```ts
 * import { emit, unsafeCheckSql } from "./TableExtras.ts"
 *
 * console.log(emit(unsafeCheckSql("positive", "value > 0")) !== undefined) // true
 * ```
 *
 * @category conversions
 * @since 0.0.0
 */
export const emit: (node: Node) => PgTableExtraConfigValue = Node.match({
  check: (node) => drizzleCheck(node.name, node.expression),
  compositePrimaryKey: (node) =>
    drizzlePrimaryKey({ name: node.name, columns: [...node.columns] }),
  compositeUnique: (node) => drizzleUnique(node.name).on(...node.columns),
  index: emitIndex,
  unsafeCheckSql: (node) => drizzleCheck(node.name, sql.raw(node.sql)),
});
