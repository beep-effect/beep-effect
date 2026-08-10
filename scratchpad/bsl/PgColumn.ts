/**
 * Postgres column spec algebra.
 *
 * A discriminated union describing which Drizzle pg builder a column compiles
 * to, with each member carrying its literal config. Each descriptor owns a
 * `toDrizzleBuilder` companion static; `Spec.toDrizzleBuilder` exhaustively
 * dispatches to those member compilers, while `Spec.fromSchemaAST` performs the
 * inverse derivation for unambiguous encoded carriers.
 *
 * The vocabulary covers the column kinds the current projector and fixtures
 * need. Extending it requires one descriptor and one compiler branch; add an
 * AST branch only when a bare encoded carrier derives that descriptor.
 */
import { $ScratchpadId } from "@beep/identity";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import type { SQL } from "drizzle-orm";
import type {
  AnyPgColumnBuilder,
  PgBigInt53Builder,
  PgBigInt64Builder,
  PgBigSerial53Builder,
  PgBigSerial64Builder,
  PgCharBuilder,
  PgEnum,
  PgIntegerBuilder,
  PgJsonBuilder,
  PgNumericBuilder,
  PgRealBuilder,
  PgSmallIntBuilder,
  PgSmallSerialBuilder,
} from "drizzle-orm/pg-core";
import {
  bigint,
  bigserial,
  boolean,
  bytea,
  char,
  customType,
  date,
  doublePrecision,
  integer,
  json,
  jsonb,
  numeric,
  pgEnum,
  real,
  serial,
  smallint,
  smallserial,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { Match } from "effect";
import * as A from "effect/Array";
import * as Eq from "effect/Equal";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as AST from "effect/SchemaAST";
import * as T from "effect/Tuple";

const $I = $ScratchpadId.create("bsl/PgColumn");

/**
 * Identity-generation mode understood by integer-family PostgreSQL columns.
 *
 * **Example** (Check an identity mode)
 *
 * ```ts
 * import { IdentityMode } from "./PgColumn.ts"
 *
 * console.log(IdentityMode.is.always("always")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const IdentityMode = LiteralKit(["always", "byDefault", false]).pipe(
  $I.annoteSchema("IdentityMode", {
    description:
      "PostgreSQL identity-generation mode, or false when identity generation is disabled.",
  })
);

/**
 * Identity-generation literal represented by {@link IdentityMode}.
 *
 * @category models
 * @since 0.0.0
 */
export type IdentityMode = typeof IdentityMode.Type;

/**
 * PostgreSQL array depth carried by BSL field metadata.
 *
 * @category schemas
 * @since 0.0.0
 */
export const ArrayDimension = LiteralKit([0, 1, 2, 3, 4, 5]).pipe(
  $I.annoteSchema("ArrayDimension", {
    description: "PostgreSQL scalar or array depth supported by Drizzle rc4.",
  })
);
/**
 * PostgreSQL scalar or array depth.
 *
 * @category models
 * @since 0.0.0
 */
export type ArrayDimension = typeof ArrayDimension.Type;

/**
 * Drizzle rc4 array-dimension spelling accepted by `.array(...)`.
 *
 * @category schemas
 * @since 0.0.0
 */
export const ArrayDimensionString = LiteralKit([
  "[]",
  "[][]",
  "[][][]",
  "[][][][]",
  "[][][][][]",
]).pipe(
  $I.annoteSchema("ArrayDimensionString", {
    description: "Literal PostgreSQL array suffixes supported by Drizzle rc4.",
  })
);
/**
 * Drizzle rc4 array-dimension suffix.
 *
 * @category models
 * @since 0.0.0
 */
export type ArrayDimensionString = typeof ArrayDimensionString.Type;

/**
 * Convert a Drizzle array suffix to its numeric depth.
 *
 * @category models
 * @since 0.0.0
 */
export type DimensionOf<Suffix extends ArrayDimensionString> =
  Suffix extends "[]"
    ? 1
    : Suffix extends "[][]"
    ? 2
    : Suffix extends "[][][]"
    ? 3
    : Suffix extends "[][][][]"
    ? 4
    : 5;

/**
 * Fluent Drizzle builder surface used after a column spec is compiled.
 *
 * **Details**
 *
 * Drizzle's concrete builder classes differ by carrier, so projection code
 * consumes only their shared metadata methods.
 *
 * @category models
 * @since 0.0.0
 */
export interface DrizzleBuilder extends AnyPgColumnBuilder {
  notNull(): DrizzleBuilder;
  primaryKey(): DrizzleBuilder;
  unique(name?: string): DrizzleBuilder;
  default(value: unknown): DrizzleBuilder;
  generatedAlwaysAs(value: SQL): DrizzleBuilder;
  array(): DrizzleBuilder;
  array(dimensions: ArrayDimensionString): DrizzleBuilder;
}

const applyIdentity = (
  builder:
    | PgIntegerBuilder
    | PgSmallIntBuilder
    | PgBigInt53Builder
    | PgBigInt64Builder,
  kind: Exclude<IdentityMode, false>
): DrizzleBuilder =>
  kind === "always"
    ? builder.generatedAlwaysAsIdentity()
    : builder.generatedByDefaultAsIdentity();

/**
 * PostgreSQL storage identity, distinct from the TypeScript carrier.
 *
 * **Example** (Check a database identity)
 *
 * ```ts
 * import { DbIdent } from "./PgColumn.ts"
 *
 * console.log(DbIdent.is("uuid")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const DbIdent = S.Union([
  LiteralKit([
    "text",
    "varchar",
    "char",
    "uuid",
    "integer",
    "smallint",
    "bigint",
    "numeric",
    "doublePrecision",
    "real",
    "boolean",
    "json",
    "jsonb",
    "date",
    "timestamp",
    "timestamptz",
    "bytea",
  ]),
  S.TemplateLiteral(['entityId<"', S.NonEmptyString, '">']),
  S.TemplateLiteral(["enum<", S.String, ">"]),
  S.TemplateLiteral(["custom<", S.String, ">"]),
  S.TemplateLiteral([
    "array<",
    S.String,
    ",",
    LiteralKit([1, 2, 3, 4, 5]),
    ">",
  ]),
]).pipe(
  $I.annoteSchema("DbIdent", {
    description:
      "PostgreSQL storage identity carried by a BSL column descriptor.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Database-identity literal represented by {@link DbIdent}.
 *
 * @category models
 * @since 0.0.0
 */
export type DbIdent = typeof DbIdent.Type;

/**
 * SQL identity used by a number-encoded EntityId belonging to a table.
 *
 * **Example** (Check an EntityId identity)
 *
 * ```ts
 * import { EntityIdIdent } from "./PgColumn.ts"
 *
 * console.log(EntityIdIdent.is('entityId<"user">')) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const EntityIdIdent = S.TemplateLiteral([
  'entityId<"',
  S.NonEmptyString,
  '">',
]).pipe(
  $I.annoteSchema("EntityIdIdent", {
    description:
      "SQL identity for a number-encoded EntityId column and its owning table.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Entity-id SQL identity parameterized by its target table name.
 *
 * @category models
 * @since 0.0.0
 */
export type EntityIdIdent<TableName extends string> =
  `entityId<"${TableName}">`;

/**
 * Unbounded PostgreSQL text descriptor.
 *
 * **Example** (Construct a text descriptor)
 *
 * ```ts
 * import { Text } from "./PgColumn.ts"
 *
 * console.log(Text.make({}).kind) // "text"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Text = S.Struct({
  kind: S.tag("text"),
  ident: S.tag("text"),
}).pipe(
  $I.annoteSchema("Text", {
    description: "Unbounded PostgreSQL text column descriptor.",
  }),
  SchemaUtils.withStatics((schema) => ({
    toDrizzleBuilder: (_spec: typeof schema.Type, name: string) => text(name),
  }))
);
/**
 * Decoded text-column descriptor.
 *
 * @category models
 * @since 0.0.0
 */
export type Text = typeof Text.Type;

const ColumnLength = S.Int.check(
  S.isGreaterThan(0, {
    identifier: $I`ColumnLengthPositiveCheck`,
    title: "Positive Column Length",
    description:
      "Checks that a bounded PostgreSQL column length is a positive integer.",
    message: "Expected a positive integer column length.",
  })
);

/**
 * Length-bounded PostgreSQL varchar descriptor.
 *
 * **Example** (Construct a varchar descriptor)
 *
 * ```ts
 * import { Varchar } from "./PgColumn.ts"
 *
 * console.log(Varchar.make({ length: 320 }).length) // 320
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Varchar = S.Struct({
  kind: S.tag("varchar"),
  ident: S.tag("varchar"),
  length: ColumnLength,
}).pipe(
  $I.annoteSchema("Varchar", {
    description: "Length-bounded PostgreSQL varchar column descriptor.",
  }),
  SchemaUtils.withStatics((schema) => ({
    toDrizzleBuilder: ({ length }: typeof schema.Type, name: string) =>
      varchar(name, { length }),
  }))
);
/**
 * Decoded varchar descriptor preserving its length literal.
 *
 * @category models
 * @since 0.0.0
 */
export type Varchar<L extends number = number> = Omit<
  typeof Varchar.Type,
  "length"
> & { readonly length: L };

const EnumValues = S.TupleWithRest(S.Tuple([S.String]), [S.String]).pipe(
  $I.annoteSchema("EnumValues", {
    description:
      "Ordered non-empty string-literal values of a PostgreSQL enum.",
  })
);

/**
 * PostgreSQL named enum descriptor.
 *
 * **Details**
 *
 * An empty `name` is a temporary field-derived marker resolved by the model
 * factory before projection.
 *
 * **Example** (Construct an enum descriptor)
 *
 * ```ts
 * import { Enum } from "./PgColumn.ts"
 *
 * console.log(Enum.make({ name: "status", ident: "enum<status>", values: ["draft", "active"] }).name)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Enum = S.Struct({
  kind: S.tag("enum"),
  ident: S.TemplateLiteral(["enum<", S.String, ">"]),
  name: S.String,
  values: EnumValues,
}).pipe(
  $I.annoteSchema("Enum", {
    description:
      "PostgreSQL named enum descriptor with literal-preserving values.",
  }),
  SchemaUtils.withStatics((schema) => ({
    toDrizzleBuilder: (
      spec: typeof schema.Type,
      name: string,
      shared?: PgEnum<[string, ...string[]]>
    ): DrizzleBuilder =>
      O.getOrElse(O.fromUndefinedOr(shared), () =>
        pgEnum(spec.name, spec.values)
      )(name),
    toDrizzleEnum: (spec: typeof schema.Type): PgEnum<[string, ...string[]]> =>
      pgEnum(spec.name, spec.values),
  }))
);
/**
 * Decoded enum descriptor preserving its name and literal value union.
 *
 * @category models
 * @since 0.0.0
 */
export type Enum<
  Name extends string = string,
  Value extends string = string
> = Omit<typeof Enum.Type, "ident" | "name" | "values"> & {
  readonly ident: `enum<${Name}>`;
  readonly name: Name;
  readonly values: readonly [Value, ...Value[]];
};

/**
 * Drizzle enum instance shared by all columns with one enum name in an assembly.
 *
 * @category models
 * @since 0.0.0
 */
export type EnumInstance = PgEnum<[string, ...string[]]>;

/**
 * Explicit custom PostgreSQL type descriptor.
 *
 * **Example** (Construct a custom descriptor)
 *
 * ```ts
 * import { Custom } from "./PgColumn.ts"
 *
 * console.log(Custom.make({ ident: "custom<tsvector>", sqlType: "tsvector" }).sqlType)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Custom = S.Struct({
  kind: S.tag("custom"),
  ident: S.TemplateLiteral(["custom<", S.String, ">"]),
  sqlType: S.String,
}).pipe(
  $I.annoteSchema("Custom", {
    description: "Explicitly unsafe custom PostgreSQL column descriptor.",
  }),
  SchemaUtils.withStatics((schema) => ({
    toDrizzleBuilder: (
      { sqlType }: typeof schema.Type,
      name: string
    ): DrizzleBuilder =>
      customType<{ data: unknown; driverData: unknown }>({
        dataType: () => sqlType,
      })(name),
  }))
);
/**
 * Decoded custom-column descriptor preserving its SQL type literal.
 *
 * @category models
 * @since 0.0.0
 */
export type Custom<SqlType extends string = string> = Omit<
  typeof Custom.Type,
  "ident" | "sqlType"
> & {
  readonly ident: `custom<${SqlType}>`;
  readonly sqlType: SqlType;
};

/**
 * Drizzle builder produced by the unsafe custom-type escape hatch.
 *
 * @category models
 * @since 0.0.0
 */
export type CustomBuilder = ReturnType<
  ReturnType<typeof customType<{ data: unknown; driverData: unknown }>>
>;

/**
 * PostgreSQL arbitrary-precision numeric descriptor using the string carrier.
 *
 * **Example** (Construct a numeric descriptor)
 *
 * ```ts
 * import { Numeric } from "./PgColumn.ts"
 *
 * console.log(Numeric.make({ precision: 10, scale: 2 }).ident) // "numeric"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Numeric = S.Struct({
  kind: S.tag("numeric"),
  ident: S.tag("numeric"),
  precision: S.UndefinedOr(ColumnLength),
  scale: S.UndefinedOr(S.Natural),
}).pipe(
  $I.annoteSchema("Numeric", {
    description:
      "PostgreSQL numeric descriptor with string carrier precision and scale.",
  }),
  SchemaUtils.withStatics((schema) => ({
    toDrizzleBuilder: (
      { precision, scale }: typeof schema.Type,
      name: string
    ): PgNumericBuilder =>
      Match.value({ precision, scale }).pipe(
        Match.when(
          P.Struct({ precision: P.isNumber, scale: P.isNumber }),
          ({ precision, scale }) =>
            numeric(name, { precision, scale, mode: "string" })
        ),
        Match.when(P.Struct({ precision: P.isNumber }), ({ precision }) =>
          numeric(name, { precision, mode: "string" })
        ),
        Match.when(P.Struct({ scale: P.isNumber }), ({ scale }) =>
          numeric(name, { scale, mode: "string" })
        ),
        Match.orElse(() => numeric(name, { mode: "string" }))
      ),
  }))
);
/**
 * Decoded numeric descriptor preserving precision and scale literals.
 *
 * @category models
 * @since 0.0.0
 */
export type Numeric<
  Precision extends number | undefined = number | undefined,
  Scale extends number | undefined = number | undefined
> = Omit<typeof Numeric.Type, "precision" | "scale"> & {
  readonly precision: Precision;
  readonly scale: Scale;
};

/**
 * PostgreSQL date descriptor with string or JavaScript Date carrier mode.
 *
 * **Example** (Construct a string date descriptor)
 *
 * ```ts
 * import { DateColumn } from "./PgColumn.ts"
 *
 * console.log(DateColumn.make({ mode: "string" }).ident) // "date"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const DateColumn = S.Struct({
  kind: S.tag("date"),
  ident: S.tag("date"),
  mode: LiteralKit(["string", "date"]),
}).pipe(
  $I.annoteSchema("DateColumn", {
    description: "PostgreSQL date descriptor with string or Date carrier mode.",
  }),
  SchemaUtils.withStatics((schema) => ({
    toDrizzleBuilder: (
      { mode }: typeof schema.Type,
      name: string
    ): DrizzleBuilder =>
      mode === "date"
        ? date(name, { mode: "date" })
        : date(name, { mode: "string" }),
  }))
);
/**
 * Decoded date descriptor preserving its carrier mode.
 *
 * @category models
 * @since 0.0.0
 */
export type DateColumn<Mode extends "string" | "date" = "string" | "date"> =
  Omit<typeof DateColumn.Type, "mode"> & { readonly mode: Mode };

/**
 * Fixed-width PostgreSQL char descriptor.
 *
 * **Example** (Construct a char descriptor)
 *
 * ```ts
 * import { Char } from "./PgColumn.ts"
 *
 * console.log(Char.make({ length: 2 }).ident) // "char"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Char = S.Struct({
  kind: S.tag("char"),
  ident: S.tag("char"),
  length: ColumnLength,
}).pipe(
  $I.annoteSchema("Char", {
    description: "Fixed-width PostgreSQL char descriptor.",
  }),
  SchemaUtils.withStatics((schema) => ({
    toDrizzleBuilder: (
      { length }: typeof schema.Type,
      name: string
    ): PgCharBuilder => char(name, { length }),
  }))
);
/**
 * Decoded char descriptor preserving its length literal.
 *
 * @category models
 * @since 0.0.0
 */
export type Char<Length extends number = number> = Omit<
  typeof Char.Type,
  "length"
> & { readonly length: Length };

/**
 * PostgreSQL JSON descriptor distinct from JSONB.
 *
 * **Example** (Construct a JSON descriptor)
 *
 * ```ts
 * import { Json } from "./PgColumn.ts"
 *
 * console.log(Json.make({}).ident) // "json"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Json = S.Struct({
  kind: S.tag("json"),
  ident: S.tag("json"),
}).pipe(
  $I.annoteSchema("Json", {
    description: "PostgreSQL JSON column descriptor distinct from JSONB.",
  }),
  SchemaUtils.withStatics((schema) => ({
    toDrizzleBuilder: (
      _spec: typeof schema.Type,
      name: string
    ): PgJsonBuilder => json(name),
  }))
);
/**
 * Decoded JSON-column descriptor.
 *
 * @category models
 * @since 0.0.0
 */
export type Json = typeof Json.Type;

/**
 * PostgreSQL single-precision real descriptor.
 *
 * **Example** (Construct a real descriptor)
 *
 * ```ts
 * import { Real } from "./PgColumn.ts"
 *
 * console.log(Real.make({}).ident) // "real"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Real = S.Struct({
  kind: S.tag("real"),
  ident: S.tag("real"),
}).pipe(
  $I.annoteSchema("Real", {
    description: "PostgreSQL single-precision real column descriptor.",
  }),
  SchemaUtils.withStatics((schema) => ({
    toDrizzleBuilder: (
      _spec: typeof schema.Type,
      name: string
    ): PgRealBuilder => real(name),
  }))
);
/**
 * Decoded real-column descriptor.
 *
 * @category models
 * @since 0.0.0
 */
export type Real = typeof Real.Type;

/**
 * PostgreSQL bigserial descriptor with number or bigint carrier mode.
 *
 * **Example** (Construct a bigint-mode descriptor)
 *
 * ```ts
 * import { Bigserial } from "./PgColumn.ts"
 *
 * console.log(Bigserial.make({ mode: "bigint" }).ident) // "bigint"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Bigserial = S.Struct({
  kind: S.tag("bigserial"),
  ident: S.tag("bigint"),
  mode: LiteralKit(["number", "bigint"]),
}).pipe(
  $I.annoteSchema("Bigserial", {
    description:
      "PostgreSQL bigserial descriptor with number or bigint carrier mode.",
  }),
  SchemaUtils.withStatics((schema) => ({
    toDrizzleBuilder: (
      { mode }: typeof schema.Type,
      name: string
    ): PgBigSerial53Builder | PgBigSerial64Builder =>
      mode === "number"
        ? bigserial(name, { mode: "number" })
        : bigserial(name, { mode: "bigint" }),
  }))
);
/**
 * Decoded bigserial descriptor preserving its carrier mode.
 *
 * @category models
 * @since 0.0.0
 */
export type Bigserial<Mode extends "number" | "bigint" = "number" | "bigint"> =
  Omit<typeof Bigserial.Type, "mode"> & { readonly mode: Mode };

/**
 * PostgreSQL smallserial descriptor.
 *
 * **Example** (Construct a smallserial descriptor)
 *
 * ```ts
 * import { Smallserial } from "./PgColumn.ts"
 *
 * console.log(Smallserial.make({}).ident) // "smallint"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Smallserial = S.Struct({
  kind: S.tag("smallserial"),
  ident: S.tag("smallint"),
}).pipe(
  $I.annoteSchema("Smallserial", {
    description: "PostgreSQL smallserial column descriptor.",
  }),
  SchemaUtils.withStatics((schema) => ({
    toDrizzleBuilder: (
      _spec: typeof schema.Type,
      name: string
    ): PgSmallSerialBuilder => smallserial(name),
  }))
);
/**
 * Decoded smallserial-column descriptor.
 *
 * @category models
 * @since 0.0.0
 */
export type Smallserial = typeof Smallserial.Type;

/**
 * PostgreSQL UUID descriptor.
 *
 * **Example** (Construct a UUID descriptor)
 *
 * ```ts
 * import { Uuid } from "./PgColumn.ts"
 *
 * console.log(Uuid.make({}).ident) // "uuid"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Uuid = S.Struct({
  kind: S.tag("uuid"),
  ident: S.tag("uuid"),
}).pipe(
  $I.annoteSchema("Uuid", {
    description: "PostgreSQL UUID column descriptor.",
  }),
  SchemaUtils.withStatics((schema) => ({
    toDrizzleBuilder: (_spec: typeof schema.Type, name: string) => uuid(name),
  }))
);
/**
 * Decoded UUID-column descriptor.
 *
 * @category models
 * @since 0.0.0
 */
export type Uuid = typeof Uuid.Type;

/**
 * PostgreSQL integer descriptor with an optional EntityId identity.
 *
 * **Example** (Construct an integer descriptor)
 *
 * ```ts
 * import { Integer } from "./PgColumn.ts"
 *
 * console.log(Integer.make({ ident: "integer" }).kind) // "integer"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Integer = S.Struct({
  kind: S.tag("integer"),
  ident: S.Union([S.Literal("integer"), EntityIdIdent]),
}).pipe(
  $I.annoteSchema("Integer", {
    description:
      "PostgreSQL integer column descriptor with an optional EntityId storage identity.",
  }),
  SchemaUtils.withStatics((schema) => ({
    toDrizzleBuilder: (
      _spec: typeof schema.Type,
      name: string,
      identity: IdentityMode = false
    ): DrizzleBuilder => {
      const builder = integer(name);
      return identity === false ? builder : applyIdentity(builder, identity);
    },
  }))
);
/**
 * Decoded integer descriptor preserving its SQL identity.
 *
 * @category models
 * @since 0.0.0
 */
export type Integer<I extends "integer" | EntityIdIdent<string> = "integer"> =
  Omit<typeof Integer.Type, "ident"> & { readonly ident: I };

/**
 * PostgreSQL smallint descriptor.
 *
 * **Example** (Construct a smallint descriptor)
 *
 * ```ts
 * import { Smallint } from "./PgColumn.ts"
 *
 * console.log(Smallint.make({}).kind) // "smallint"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Smallint = S.Struct({
  kind: S.tag("smallint"),
  ident: S.tag("smallint"),
}).pipe(
  $I.annoteSchema("Smallint", {
    description: "PostgreSQL smallint column descriptor.",
  }),
  SchemaUtils.withStatics((schema) => ({
    toDrizzleBuilder: (
      _spec: typeof schema.Type,
      name: string,
      identity: IdentityMode = false
    ): DrizzleBuilder => {
      const builder = smallint(name);
      return identity === false ? builder : applyIdentity(builder, identity);
    },
  }))
);
/**
 * Decoded smallint-column descriptor.
 *
 * @category models
 * @since 0.0.0
 */
export type Smallint = typeof Smallint.Type;

/**
 * PostgreSQL bigint descriptor with number or bigint carrier mode.
 *
 * **Example** (Construct a bigint descriptor)
 *
 * ```ts
 * import { Bigint } from "./PgColumn.ts"
 *
 * console.log(Bigint.make({ mode: "bigint" }).mode) // "bigint"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Bigint = S.Struct({
  kind: S.tag("bigint"),
  ident: S.tag("bigint"),
  mode: LiteralKit(["number", "bigint"]),
}).pipe(
  $I.annoteSchema("Bigint", {
    description: "PostgreSQL bigint descriptor with its decoded carrier mode.",
  }),
  SchemaUtils.withStatics((schema) => ({
    toDrizzleBuilder: (
      { mode }: typeof schema.Type,
      name: string,
      identity: IdentityMode = false
    ) =>
      Match.value(mode).pipe(
        Match.withReturnType<DrizzleBuilder>(),
        Match.when("number", () => {
          const builder = bigint(name, { mode: "number" });
          return identity === false
            ? builder
            : applyIdentity(builder, identity);
        }),
        Match.when("bigint", () => {
          const builder = bigint(name, { mode: "bigint" });
          return identity === false
            ? builder
            : applyIdentity(builder, identity);
        }),
        Match.exhaustive
      ),
  }))
);
/**
 * Decoded bigint descriptor preserving its JavaScript carrier mode.
 *
 * @category models
 * @since 0.0.0
 */
export type Bigint<M extends "number" | "bigint" = "number" | "bigint"> = Omit<
  typeof Bigint.Type,
  "mode"
> & { readonly mode: M };

/**
 * PostgreSQL serial descriptor.
 *
 * **Example** (Construct a serial descriptor)
 *
 * ```ts
 * import { Serial } from "./PgColumn.ts"
 *
 * console.log(Serial.make({}).ident) // "integer"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Serial = S.Struct({
  kind: S.tag("serial"),
  ident: S.tag("integer"),
}).pipe(
  $I.annoteSchema("Serial", {
    description: "PostgreSQL serial column descriptor.",
  }),
  SchemaUtils.withStatics((schema) => ({
    toDrizzleBuilder: (_spec: typeof schema.Type, name: string) => serial(name),
  }))
);
/**
 * Decoded serial-column descriptor.
 *
 * @category models
 * @since 0.0.0
 */
export type Serial = typeof Serial.Type;

/**
 * PostgreSQL double-precision descriptor.
 *
 * **Example** (Construct a double-precision descriptor)
 *
 * ```ts
 * import { DoublePrecision } from "./PgColumn.ts"
 *
 * console.log(DoublePrecision.make({}).kind) // "doublePrecision"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const DoublePrecision = S.Struct({
  kind: S.tag("doublePrecision"),
  ident: S.tag("doublePrecision"),
}).pipe(
  $I.annoteSchema("DoublePrecision", {
    description: "PostgreSQL double-precision column descriptor.",
  }),
  SchemaUtils.withStatics((schema) => ({
    toDrizzleBuilder: (_spec: typeof schema.Type, name: string) =>
      doublePrecision(name),
  }))
);
/**
 * Decoded double-precision descriptor.
 *
 * @category models
 * @since 0.0.0
 */
export type DoublePrecision = typeof DoublePrecision.Type;

/**
 * PostgreSQL boolean descriptor.
 *
 * **Example** (Construct a boolean descriptor)
 *
 * ```ts
 * import { Bool } from "./PgColumn.ts"
 *
 * console.log(Bool.make({}).kind) // "boolean"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Bool = S.Struct({
  kind: S.tag("boolean"),
  ident: S.tag("boolean"),
}).pipe(
  $I.annoteSchema("Bool", {
    description: "PostgreSQL boolean column descriptor.",
  }),
  SchemaUtils.withStatics((schema) => ({
    toDrizzleBuilder: (_spec: typeof schema.Type, name: string) =>
      boolean(name),
  }))
);
/**
 * Decoded boolean-column descriptor.
 *
 * @category models
 * @since 0.0.0
 */
export type Bool = typeof Bool.Type;

/**
 * PostgreSQL JSONB descriptor.
 *
 * **Example** (Construct a JSONB descriptor)
 *
 * ```ts
 * import { Jsonb } from "./PgColumn.ts"
 *
 * console.log(Jsonb.make({}).ident) // "jsonb"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Jsonb = S.Struct({
  kind: S.tag("jsonb"),
  ident: S.tag("jsonb"),
}).pipe(
  $I.annoteSchema("Jsonb", {
    description: "PostgreSQL JSONB column descriptor.",
  }),
  SchemaUtils.withStatics((schema) => ({
    toDrizzleBuilder: (_spec: typeof schema.Type, name: string) => jsonb(name),
  }))
);
/**
 * Decoded JSONB-column descriptor.
 *
 * @category models
 * @since 0.0.0
 */
export type Jsonb = typeof Jsonb.Type;

/**
 * PostgreSQL timestamp descriptor with carrier and timezone modes.
 *
 * **Example** (Construct a timestamp descriptor)
 *
 * ```ts
 * import { Timestamp } from "./PgColumn.ts"
 *
 * const value = Timestamp.make({ ident: "timestamptz", mode: "string", withTimezone: true })
 * console.log(value.ident) // "timestamptz"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Timestamp = S.Struct({
  kind: S.tag("timestamp"),
  ident: LiteralKit(["timestamp", "timestamptz"]),
  mode: LiteralKit(["date", "string"]),
  withTimezone: S.Boolean,
})
  .check(
    S.makeFilter(
      (value) =>
        Eq.equals(
          value.ident,
          value.withTimezone ? "timestamptz" : "timestamp"
        ),
      {
        identifier: $I`TimestampIdentityCheck`,
        title: "Timestamp Identity",
        description:
          "Checks that timestamp storage identity agrees with its timezone mode.",
        message: "Expected timestamp identity to agree with withTimezone.",
      }
    )
  )
  .pipe(
    $I.annoteSchema("Timestamp", {
      description:
        "PostgreSQL timestamp descriptor with carrier and timezone modes.",
    }),
    SchemaUtils.withStatics((schema) => ({
      toDrizzleBuilder: (
        { mode, withTimezone }: typeof schema.Type,
        name: string
      ) =>
        Match.value(mode).pipe(
          Match.withReturnType<DrizzleBuilder>(),
          Match.when("date", () =>
            timestamp(name, { mode: "date", withTimezone })
          ),
          Match.when("string", () =>
            timestamp(name, { mode: "string", withTimezone })
          ),
          Match.exhaustive
        ),
    }))
  );
/**
 * Decoded timestamp descriptor preserving carrier and timezone modes.
 *
 * @category models
 * @since 0.0.0
 */
export type Timestamp<
  M extends "date" | "string" = "date" | "string",
  TZ extends boolean = boolean
> = Omit<typeof Timestamp.Type, "ident" | "mode" | "withTimezone"> & {
  readonly ident: TZ extends true ? "timestamptz" : "timestamp";
  readonly mode: M;
  readonly withTimezone: TZ;
};

/**
 * PostgreSQL bytea descriptor.
 *
 * **Example** (Construct a bytea descriptor)
 *
 * ```ts
 * import { Bytea } from "./PgColumn.ts"
 *
 * console.log(Bytea.make({}).kind) // "bytea"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Bytea = S.Struct({
  kind: S.tag("bytea"),
  ident: S.tag("bytea"),
}).pipe(
  $I.annoteSchema("Bytea", {
    description: "PostgreSQL bytea column descriptor.",
  }),
  SchemaUtils.withStatics((schema) => ({
    toDrizzleBuilder: (_spec: typeof schema.Type, name: string) => bytea(name),
  }))
);
/**
 * Decoded bytea-column descriptor.
 *
 * @category models
 * @since 0.0.0
 */
export type Bytea = typeof Bytea.Type;

const SpecMembers = T.make(
  Text,
  Varchar,
  Enum,
  Custom,
  Numeric,
  DateColumn,
  Char,
  Json,
  Real,
  Bigserial,
  Smallserial,
  Uuid,
  Integer,
  Smallint,
  Bigint,
  Serial,
  DoublePrecision,
  Bool,
  Jsonb,
  Timestamp,
  Bytea
);

type SpecValue = (typeof SpecMembers)[number]["Type"];

const fromLiteralAST = Match.type<AST.Literal>().pipe(
  Match.withReturnType<O.Option<SpecValue>>(),
  Match.when(P.Struct({ literal: P.isString }), () => Text.makeOption({})),
  Match.when(P.Struct({ literal: P.isNumber }), () =>
    DoublePrecision.makeOption({})
  ),
  Match.when(P.Struct({ literal: P.isBoolean }), () => Bool.makeOption({})),
  Match.orElse(() => O.none())
);

const fromSchemaAST = (
  node: AST.AST,
  visited: ReadonlyArray<AST.AST> = A.empty()
): O.Option<SpecValue> => {
  if (A.some(visited, Eq.equals(node))) return O.none();
  const nextVisited = A.append(visited, node);
  return Match.type<AST.AST>().pipe(
    Match.withReturnType<O.Option<SpecValue>>(),
    Match.tag("String", "TemplateLiteral", () => Text.makeOption({})),
    Match.tag("Objects", "Arrays", () => Jsonb.makeOption({})),
    Match.tags({
      Boolean: () => Bool.makeOption({}),
      BigInt: () => Bigint.makeOption({ mode: "bigint" }),
      Number: () => DoublePrecision.makeOption({}),
      Literal: fromLiteralAST,
      Enum: () => Text.makeOption({}),
      Suspend: ({ thunk }) => fromSchemaAST(thunk(), nextVisited),
    }),
    Match.orElse(() => O.none())
  )(node);
};

/**
 * Complete discriminated union of PostgreSQL descriptors supported by BSL.
 *
 * **Details**
 *
 * `fromSchemaAST` recognizes unambiguous encoded carriers without throwing;
 * `toDrizzleBuilder` exhaustively delegates compilation to member statics.
 *
 * **Example** (Compile a descriptor)
 *
 * ```ts
 * import { Spec, Text } from "./PgColumn.ts"
 *
 * const builder = Spec.toDrizzleBuilder("body")(Text.make({}))
 * console.log(typeof builder.notNull) // "function"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Spec = S.Union(SpecMembers).pipe(
  S.toTaggedUnion("kind"),
  $I.annoteSchema("Spec", {
    description:
      "Complete discriminated union of PostgreSQL column descriptors supported by BSL.",
  }),
  SchemaUtils.withCodecStatics,
  SchemaUtils.withStatics((schema) => ({
    fromSchemaAST: (ast: AST.AST): O.Option<typeof schema.Type> =>
      fromSchemaAST(ast),
    toDrizzleBuilder: dual<
      (
        name: string,
        identity?: IdentityMode
      ) => (spec: typeof schema.Type) => DrizzleBuilder,
      (
        spec: typeof schema.Type,
        name: string,
        identity?: IdentityMode
      ) => DrizzleBuilder
    >(
      (args) => schema.is(args[0]),
      (
        spec: typeof schema.Type,
        name: string,
        identity: IdentityMode = false
      ): DrizzleBuilder =>
        schema.match(spec, {
          text: (self) => Text.toDrizzleBuilder(self, name),
          varchar: (self) => Varchar.toDrizzleBuilder(self, name),
          enum: (self) => Enum.toDrizzleBuilder(self, name),
          custom: (self) => Custom.toDrizzleBuilder(self, name),
          numeric: (self) => Numeric.toDrizzleBuilder(self, name),
          date: (self) => DateColumn.toDrizzleBuilder(self, name),
          char: (self) => Char.toDrizzleBuilder(self, name),
          json: (self) => Json.toDrizzleBuilder(self, name),
          real: (self) => Real.toDrizzleBuilder(self, name),
          bigserial: (self) => Bigserial.toDrizzleBuilder(self, name),
          smallserial: (self) => Smallserial.toDrizzleBuilder(self, name),
          uuid: (self) => Uuid.toDrizzleBuilder(self, name),
          integer: (self) => Integer.toDrizzleBuilder(self, name, identity),
          smallint: (self) => Smallint.toDrizzleBuilder(self, name, identity),
          bigint: (self) => Bigint.toDrizzleBuilder(self, name, identity),
          serial: (self) => Serial.toDrizzleBuilder(self, name),
          doublePrecision: (self) =>
            DoublePrecision.toDrizzleBuilder(self, name),
          boolean: (self) => Bool.toDrizzleBuilder(self, name),
          jsonb: (self) => Jsonb.toDrizzleBuilder(self, name),
          timestamp: (self) => Timestamp.toDrizzleBuilder(self, name),
          bytea: (self) => Bytea.toDrizzleBuilder(self, name),
        })
    ),
  }))
);
/**
 * Complete decoded PostgreSQL column-descriptor union.
 *
 * @category models
 * @since 0.0.0
 */
export type Spec = typeof Spec.Type;

/**
 * Resolve a field-derived enum name while leaving every other descriptor intact.
 *
 * @category models
 * @since 0.0.0
 */
export type ResolveName<C extends Spec, Key extends string> = C extends Enum<
  "",
  infer Value
>
  ? Enum<Key, Value>
  : C;

/**
 * Resolve the empty enum-name marker to the declaring model field key.
 *
 * **Example** (Resolve an implicit enum name)
 *
 * ```ts
 * import { Enum, resolveName } from "./PgColumn.ts"
 *
 * const resolved = resolveName(Enum.make({ name: "", ident: "enum<>", values: ["a"] }), "status")
 * console.log(resolved.name) // "status"
 * ```
 *
 * @category conversions
 * @since 0.0.0
 */
export function resolveName<C extends Spec, const Key extends string>(
  spec: C,
  key: Key
): ResolveName<C, Key>;
export function resolveName(spec: Spec, key: string): Spec {
  return Spec.guards.enum(spec) && Eq.equals(spec.name, "")
    ? Enum.make({ name: key, ident: `enum<${key}>`, values: spec.values })
    : spec;
}

/**
 * Discriminator literal family of every supported column descriptor.
 *
 * **Example** (Name a column kind)
 *
 * ```ts
 * import type { Kind } from "./PgColumn.ts"
 *
 * const kind: Kind = "varchar"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Kind = Spec["kind"];

/**
 * Structural PostgreSQL identity carried by a column spec.
 *
 * @category models
 * @since 0.0.0
 */
export type IdentOf<C extends Spec> = C["ident"];

/**
 * SQL identity including an optional PostgreSQL array depth.
 *
 * @category models
 * @since 0.0.0
 */
export type StorageIdent<
  C extends Spec,
  Dimensions extends ArrayDimension
> = Dimensions extends 0
  ? IdentOf<C>
  : `array<${IdentOf<C>},${Dimensions}>`;

/**
 * Resolve the runtime SQL identity for a scalar or array column.
 *
 * @category getters
 * @since 0.0.0
 */
export const storageIdent = (
  spec: Spec,
  dimensions: ArrayDimension
): DbIdent =>
  dimensions === 0 ? spec.ident : `array<${spec.ident},${dimensions}>`;

/**
 * Wrap a scalar carrier in recursively readonly arrays.
 *
 * @category models
 * @since 0.0.0
 */
export type ArrayCarrier<
  Carrier,
  Dimensions extends ArrayDimension
> = Dimensions extends 0
  ? Carrier
  : Dimensions extends 1
  ? ReadonlyArray<Carrier>
  : Dimensions extends 2
  ? ReadonlyArray<ReadonlyArray<Carrier>>
  : Dimensions extends 3
  ? ReadonlyArray<ReadonlyArray<ReadonlyArray<Carrier>>>
  : Dimensions extends 4
  ? ReadonlyArray<ReadonlyArray<ReadonlyArray<ReadonlyArray<Carrier>>>>
  : ReadonlyArray<
      ReadonlyArray<ReadonlyArray<ReadonlyArray<ReadonlyArray<Carrier>>>>
    >;

/**
 * Bidirectional literal equality used by foreign-key validation.
 *
 * **Example** (Compare SQL identities)
 *
 * ```ts
 * import type { IdentEquals, Text } from "./PgColumn.ts"
 *
 * const equal: IdentEquals<Text, Text> = true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type IdentEquals<A extends Spec, B extends Spec> = [IdentOf<A>] extends [
  IdentOf<B>
]
  ? [IdentOf<B>] extends [IdentOf<A>]
    ? true
    : false
  : false;

/**
 * Column kinds that may carry PostgreSQL identity generation.
 *
 * **Example** (Check an identity-capable kind)
 *
 * ```ts
 * import { IdentityKind } from "./PgColumn.ts"
 *
 * console.log(IdentityKind.is.integer("integer")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const IdentityKind = LiteralKit(["integer", "smallint", "bigint"]).pipe(
  $I.annoteSchema("IdentityKind", {
    description:
      "PostgreSQL integer-family column kinds that support identity generation.",
  })
);
/**
 * Identity-capable column-kind literal represented by {@link IdentityKind}.
 *
 * @category models
 * @since 0.0.0
 */
export type IdentityKind = typeof IdentityKind.Type;

/**
 * TypeScript carrier stored by a descriptor and checked against schema encoding.
 *
 * @category models
 * @since 0.0.0
 */
export type CarrierOf<C extends Spec> = C extends
  | Text
  | Varchar
  | Uuid
  | Enum
  | Char
  | Numeric
  ? string
  : C extends
      | Integer<"integer" | EntityIdIdent<string>>
      | Smallint
      | Serial
      | Smallserial
      | DoublePrecision
      | Real
  ? number
  : C extends Bigint<infer M>
  ? M extends "number"
    ? number
    : bigint
  : C extends Bool
  ? boolean
  : C extends Timestamp<infer M>
  ? M extends "date"
    ? Date
    : string
  : C extends Jsonb
  ? object
  : C extends Json
  ? object
  : C extends DateColumn<infer M>
  ? M extends "date"
    ? Date
    : string
  : C extends Bigserial<infer M>
  ? M extends "number"
    ? number
    : bigint
  : C extends Bytea
  ? Uint8Array
  : C extends Custom
  ? unknown
  : never;

/**
 * Runtime mirror of {@link CarrierOf}, used while assembling foreign keys.
 *
 * **Example** (Check a carrier tag)
 *
 * ```ts
 * import { CarrierTag } from "./PgColumn.ts"
 *
 * console.log(CarrierTag.is.bytes("bytes")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CarrierTag = LiteralKit([
  "string",
  "number",
  "bigint",
  "boolean",
  "object",
  "date",
  "bytes",
  "unknown",
]).pipe(
  $I.annoteSchema("CarrierTag", {
    description:
      "Runtime carrier family used to validate foreign-key compatibility.",
  })
);
/**
 * Runtime carrier-family literal represented by {@link CarrierTag}.
 *
 * **Example** (Name a carrier family)
 *
 * ```ts
 * import type { CarrierTag } from "./PgColumn.ts"
 *
 * const carrier: CarrierTag = "bytes"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type CarrierTag = typeof CarrierTag.Type;

/**
 * Runtime SQL carrier identity including PostgreSQL array depth.
 *
 * @category schemas
 * @since 0.0.0
 */
export const Carrier = S.Struct({
  tag: CarrierTag,
  dimensions: ArrayDimension,
}).pipe(
  $I.annoteSchema("Carrier", {
    description:
      "Runtime scalar carrier family and PostgreSQL array depth used by foreign-key validation.",
  })
);
/**
 * Runtime SQL carrier identity.
 *
 * @category models
 * @since 0.0.0
 */
export type Carrier = typeof Carrier.Type;

/**
 * Return the runtime carrier family for a PostgreSQL descriptor.
 *
 * **Example** (Resolve a carrier family)
 *
 * ```ts
 * import { carrierTag, Uuid } from "./PgColumn.ts"
 *
 * console.log(carrierTag(Uuid.make({}))) // "string"
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const carrierTag = Spec.match({
  text: CarrierTag.thunk.string,
  varchar: CarrierTag.thunk.string,
  enum: CarrierTag.thunk.string,
  custom: CarrierTag.thunk.unknown,
  numeric: CarrierTag.thunk.string,
  date: ({ mode }) => mode,
  char: CarrierTag.thunk.string,
  json: CarrierTag.thunk.object,
  real: CarrierTag.thunk.number,
  bigserial: ({ mode }) => mode,
  smallserial: CarrierTag.thunk.number,
  uuid: CarrierTag.thunk.string,
  integer: CarrierTag.thunk.number,
  smallint: CarrierTag.thunk.number,
  serial: CarrierTag.thunk.number,
  doublePrecision: CarrierTag.thunk.number,
  bigint: ({ mode }) => mode,
  boolean: CarrierTag.thunk.boolean,
  jsonb: CarrierTag.thunk.object,
  timestamp: ({ mode }) => mode,
  bytea: CarrierTag.thunk.bytes,
});

/**
 * Resolve the runtime carrier identity for a scalar or array column.
 *
 * @category getters
 * @since 0.0.0
 */
export const carrier = (
  spec: Spec,
  dimensions: ArrayDimension
): Carrier => Carrier.make({ tag: carrierTag(spec), dimensions });
