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
  PgIntegerBuilder,
  PgSmallIntBuilder,
} from "drizzle-orm/pg-core";
import {
  bigint,
  boolean,
  bytea,
  doublePrecision,
  integer,
  jsonb,
  serial,
  smallint,
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
    "uuid",
    "integer",
    "smallint",
    "bigint",
    "doublePrecision",
    "boolean",
    "jsonb",
    "timestamp",
    "timestamptz",
    "bytea",
  ]),
  S.TemplateLiteral(['entityId<"', S.NonEmptyString, '">']),
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
export type CarrierOf<C extends Spec> = C extends Text | Varchar | Uuid
  ? string
  : C extends
      | Integer<"integer" | EntityIdIdent<string>>
      | Smallint
      | Serial
      | DoublePrecision
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
  : C extends Bytea
  ? Uint8Array
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
