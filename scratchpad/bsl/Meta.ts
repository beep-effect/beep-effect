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
import { $ScratchpadId } from "@beep/identity";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { Struct } from "@beep/utils";
import { SQL } from "drizzle-orm";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as PgColumn from "./PgColumn.ts";

const $I = $ScratchpadId.create("bsl/Meta");

/**
 * Foreign-key referential action shared by Drizzle's SQL dialects.
 *
 * **Example** (Check a referential action)
 *
 * ```ts
 * import { FkAction } from "./Meta.ts"
 *
 * console.log(FkAction.is.cascade("cascade")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FkAction = LiteralKit([
  "cascade",
  "restrict",
  "no action",
  "set null",
  "set default",
]).pipe(
  $I.annoteSchema("FkAction", {
    description:
      "Referential action applied when a PostgreSQL foreign-key target changes.",
  })
);
/**
 * Referential-action literal represented by {@link FkAction}.
 *
 * @category models
 * @since 0.0.0
 */
export type FkAction = typeof FkAction.Type;

/**
 * Foreign-key target resolved from EntityId statics or set explicitly.
 *
 * **Example** (Construct a reference)
 *
 * ```ts
 * import { References } from "./Meta.ts"
 *
 * const reference = References.make({
 *   tableName: "organization",
 *   columnName: "id",
 *   onDelete: "cascade",
 *   onUpdate: undefined
 * })
 * console.log(reference.tableName) // "organization"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const References = S.Struct({
  tableName: S.NonEmptyString,
  columnName: S.NonEmptyString,
  onDelete: S.UndefinedOr(FkAction),
  onUpdate: S.UndefinedOr(FkAction),
}).pipe(
  $I.annoteSchema("References", {
    description:
      "Resolved PostgreSQL foreign-key target and its referential actions.",
  }),
  SchemaUtils.withCodecStatics
);
/**
 * Decoded foreign-key target with literal table and column names.
 *
 * @category models
 * @since 0.0.0
 */
export type References<
  TableName extends string = string,
  ColumnName extends string = string
> = Omit<typeof References.Type, "tableName" | "columnName"> & {
  readonly tableName: TableName;
  readonly columnName: ColumnName;
};

/**
 * PostgreSQL `GENERATED ... AS IDENTITY` mode.
 *
 * **Example** (Check an identity mode)
 *
 * ```ts
 * import { Identity } from "./Meta.ts"
 *
 * console.log(Identity.is.byDefault("byDefault")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Identity = PgColumn.IdentityMode;
/**
 * Identity-generation literal represented by {@link Identity}.
 *
 * @category models
 * @since 0.0.0
 */
export type Identity = typeof Identity.Type;

/**
 * Typed PostgreSQL server-default descriptor.
 *
 * **Example** (Construct a literal default)
 *
 * ```ts
 * import { Default } from "./Meta.ts"
 *
 * const value = Default.cases.value.make({ value: "active" })
 * console.log(value._tag) // "value"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Default = S.TaggedUnion({
  sqlExpr: { expression: S.instanceOf(SQL) },
  value: { value: S.Unknown },
  now: {},
  unsafeSql: { sql: S.String },
}).pipe(
  $I.annoteSchema("Default", {
    description: "Typed PostgreSQL server-default descriptor.",
  }),
  SchemaUtils.withCodecStatics
);
/**
 * Decoded tagged default descriptor.
 *
 * @category models
 * @since 0.0.0
 */
export type Default = typeof Default.Type;
/**
 * Typed SQL-expression default descriptor.
 *
 * @category models
 * @since 0.0.0
 */
export type DefaultSqlExpr<Carrier> = Omit<
  typeof Default.cases.sqlExpr.Type,
  "expression"
> & {
  readonly expression: SQL<Carrier>;
};
/**
 * Literal-value default descriptor.
 *
 * @category models
 * @since 0.0.0
 */
export type DefaultValue<Encoded> = Omit<
  typeof Default.cases.value.Type,
  "value"
> & {
  readonly value: Encoded;
};
/**
 * Current-time default descriptor.
 *
 * @category models
 * @since 0.0.0
 */
export type DefaultNow = typeof Default.cases.now.Type;
/**
 * Explicitly unsafe raw-SQL default descriptor.
 *
 * @category models
 * @since 0.0.0
 */
export type UnsafeDefaultSql = typeof Default.cases.unsafeSql.Type;

/**
 * Typed generated-column descriptor, including identity-always generation.
 *
 * **Example** (Construct identity generation)
 *
 * ```ts
 * import { Generated } from "./Meta.ts"
 *
 * console.log(Generated.cases.identityAlways.make({})._tag) // "identityAlways"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Generated = S.TaggedUnion({
  sqlExpr: { expression: S.instanceOf(SQL) },
  unsafeSql: { sql: S.String },
  identityAlways: {},
}).pipe(
  $I.annoteSchema("Generated", {
    description: "Typed PostgreSQL generated-column descriptor.",
  }),
  SchemaUtils.withCodecStatics
);
/**
 * Decoded tagged generated-column descriptor.
 *
 * @category models
 * @since 0.0.0
 */
export type Generated = typeof Generated.Type;
/**
 * Typed SQL-expression generated-column descriptor.
 *
 * @category models
 * @since 0.0.0
 */
export type GeneratedSqlExpr<Carrier> = Omit<
  typeof Generated.cases.sqlExpr.Type,
  "expression"
> & {
  readonly expression: SQL<Carrier>;
};
/**
 * Explicitly unsafe raw-SQL generated descriptor.
 *
 * @category models
 * @since 0.0.0
 */
export type UnsafeGeneratedSql = typeof Generated.cases.unsafeSql.Type;
/**
 * Identity-always generated descriptor.
 *
 * @category models
 * @since 0.0.0
 */
export type GeneratedIdentityAlways =
  typeof Generated.cases.identityAlways.Type;

/**
 * The SQL intent record. Every member is literal-typed so conditional types
 * downstream (`PgBuilderFor`) resolve to exact drizzle builder brands.
 *
 * **Example** (Construct SQL metadata)
 *
 * ```ts
 * import { Meta, empty } from "./Meta.ts"
 *
 * console.log(Meta.is(empty)) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Meta = S.Struct({
  column: S.UndefinedOr(PgColumn.Spec),
  primaryKey: S.Boolean,
  unique: S.Boolean,
  identity: Identity,
  hasDefault: S.Boolean,
  default: S.UndefinedOr(Default),
  generated: S.Union([Generated, S.Literal(false)]),
  version: S.Boolean,
  columnName: S.UndefinedOr(S.String),
  references: S.UndefinedOr(References),
}).pipe(
  $I.annoteSchema("Meta", {
    description: "Literal-preserving SQL intent carried by a BSL field.",
  }),
  SchemaUtils.withCodecStatics
);
/**
 * Decoded metadata record represented by {@link Meta}.
 *
 * @category models
 * @since 0.0.0
 */
export type Meta = typeof Meta.Type;

/**
 * Exact metadata schema for the state every bare field starts with.
 *
 * **Example** (Construct empty metadata)
 *
 * ```ts
 * import { Empty } from "./Meta.ts"
 *
 * console.log(Empty.make({
 *   column: undefined,
 *   primaryKey: false,
 *   unique: false,
 *   identity: false,
 *   hasDefault: false,
 *   default: undefined,
 *   generated: false,
 *   version: false,
 *   columnName: undefined,
 *   references: undefined
 * }).primaryKey) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Empty = S.Struct({
  column: S.Undefined,
  primaryKey: S.Literal(false),
  unique: S.Literal(false),
  identity: S.Literal(false),
  hasDefault: S.Literal(false),
  default: S.Undefined,
  generated: S.Literal(false),
  version: S.Literal(false),
  columnName: S.Undefined,
  references: S.Undefined,
}).pipe(
  $I.annoteSchema("Empty", {
    description: "Canonical SQL metadata state for a bare schema field.",
  })
);
/**
 * Decoded initial metadata represented by {@link Empty}.
 *
 * @category models
 * @since 0.0.0
 */
export type Empty = typeof Empty.Type;

/**
 * Canonical metadata value for a bare schema field.
 *
 * **Example** (Read bare-field metadata)
 *
 * ```ts
 * import { empty } from "./Meta.ts"
 *
 * console.log(empty.generated) // false
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const empty: Empty = Empty.make({
  column: undefined,
  primaryKey: false,
  unique: false,
  identity: false,
  hasDefault: false,
  default: undefined,
  generated: false,
  version: false,
  columnName: undefined,
  references: undefined,
});

/**
 * Partial metadata update produced by a field combinator.
 *
 * @category models
 * @since 0.0.0
 */
export type Patch = { readonly [K in keyof Meta]?: Meta[K] };

/**
 * Literal-preserving merge: patch keys replace, everything else survives.
 * Combinators return `Field<S, Merge<M, P>>` so metadata accumulates through
 * a pipe chain without widening.
 *
 * **Example** (Preserve a literal patch)
 *
 * ```ts
 * import type { Empty, Merge } from "./Meta.ts"
 *
 * type PrimaryKeyMeta = Merge<Empty, { readonly primaryKey: true }>
 * declare const metadata: PrimaryKeyMeta
 * const primaryKey: true = metadata.primaryKey
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Merge<M extends Meta, P extends Patch> = {
  readonly [K in keyof Meta]: K extends keyof P
    ? P[K] extends undefined
      ? M[K]
      : Exclude<P[K], undefined>
    : M[K];
};

function mergeField<
  const M extends Meta,
  const P extends Patch,
  K extends keyof Meta
>(current: M[K], patch: P, key: K): Merge<M, P>[K];
function mergeField(
  current: Meta[keyof Meta],
  patch: Patch,
  key: keyof Meta
): Meta[keyof Meta] {
  return O.getOrElse(O.fromUndefinedOr(patch[key]), () => current);
}

/**
 * Merge a literal-preserving metadata patch into an existing value.
 *
 * **Example** (Set primary-key intent)
 *
 * ```ts
 * import { empty, merge } from "./Meta.ts"
 *
 * console.log(merge(empty, { primaryKey: true }).primaryKey) // true
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const merge = <const M extends Meta, const P extends Patch>(
  meta: M,
  patch: P
): Merge<M, P> => {
  const evolver = {
    column: (current: M["column"]) => mergeField(current, patch, "column"),
    primaryKey: (current: M["primaryKey"]) =>
      mergeField(current, patch, "primaryKey"),
    unique: (current: M["unique"]) => mergeField(current, patch, "unique"),
    identity: (current: M["identity"]) =>
      mergeField(current, patch, "identity"),
    hasDefault: (current: M["hasDefault"]) =>
      mergeField(current, patch, "hasDefault"),
    default: (current: M["default"]) => mergeField(current, patch, "default"),
    generated: (current: M["generated"]) =>
      mergeField(current, patch, "generated"),
    version: (current: M["version"]) =>
      mergeField(current, patch, "version"),
    columnName: (current: M["columnName"]) =>
      mergeField(current, patch, "columnName"),
    references: (current: M["references"]) =>
      mergeField(current, patch, "references"),
  };
  return Struct.evolve<Meta, typeof evolver>(meta, evolver);
};
