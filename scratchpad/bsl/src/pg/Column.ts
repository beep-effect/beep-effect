/** PostgreSQL column descriptors and their colocated Drizzle compilers. */
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
import {
  orElse as matchOrElse,
  tag as matchTag,
  tags as matchTags,
  type as matchType,
  value as matchValue,
  when as matchWhen,
  withReturnType,
} from "effect/Match";
import {
  append,
  contains,
  empty,
  isArray,
  isReadonlyArrayNonEmpty,
  some as someArray,
} from "effect/Array";
import { taggedEnum } from "effect/Data";
import type { TaggedEnum } from "effect/Data";
import { equals } from "effect/Equal";
import { dual } from "effect/Function";
import { fromUndefinedOr, getOrElse, none, some as someOption } from "effect/Option";
import type { Option } from "effect/Option";
import {
  Struct as StructPredicate,
  hasProperty,
  isBoolean,
  isNumber,
  isString,
  isUndefined,
} from "effect/Predicate";
import { String as StringSchema, TaggedError } from "effect/Schema";
import type { AST, Literal } from "effect/SchemaAST";
import type * as Meta from "../core/Meta.ts";
import { assignStatics } from "../internal/statics.ts";

/** Descriptor-construction failure at an author-input seam. */
export class ColumnInvariantError extends TaggedError<ColumnInvariantError>(
  "@beep/effect-drizzle/ColumnInvariantError",
)(
  "ColumnInvariantError",
  { message: StringSchema },
  {
    description: "A PostgreSQL column descriptor violates its shape invariant.",
  },
) {}

/** PostgreSQL identity-generation mode. */
export type IdentityMode = Meta.IdentityMode;

/** PostgreSQL scalar or array depth. */
export type ArrayDimension = Meta.ArrayDimension;

/** Drizzle-supported PostgreSQL array suffix. */
export type ArrayDimensionString = "[]" | "[][]" | "[][][]" | "[][][][]" | "[][][][][]";

/** Numeric array depth represented by a suffix. */
export type DimensionOf<Suffix extends ArrayDimensionString> = Suffix extends "[]"
  ? 1
  : Suffix extends "[][]"
    ? 2
    : Suffix extends "[][][]"
      ? 3
      : Suffix extends "[][][][]"
        ? 4
        : 5;

/** Common builder surface used by centralized modifier projection. */
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
  builder: PgIntegerBuilder | PgSmallIntBuilder | PgBigInt53Builder | PgBigInt64Builder,
  kind: Exclude<IdentityMode, false>,
): DrizzleBuilder =>
  kind === "always" ? builder.generatedAlwaysAsIdentity() : builder.generatedByDefaultAsIdentity();

/** Storage identity for a number-encoded entity id. */
export type EntityIdIdent<TableName extends string> = `entityId<"${TableName}">`;

/** Storage identities supported by the PostgreSQL implementation. */
export type DbIdent =
  | "text"
  | "varchar"
  | "char"
  | "uuid"
  | "integer"
  | "smallint"
  | "bigint"
  | "numeric"
  | "doublePrecision"
  | "real"
  | "boolean"
  | "json"
  | "jsonb"
  | "date"
  | "timestamp"
  | "timestamptz"
  | "bytea"
  | EntityIdIdent<string>
  | `enum<${string}>`
  | `custom<${string}>`
  | `array<${string},${1 | 2 | 3 | 4 | 5}>`;

type SpecDefinition = {
  text: { readonly kind: "text"; readonly ident: "text" };
  varchar: {
    readonly kind: "varchar";
    readonly ident: "varchar";
    readonly length: number;
  };
  enum: {
    readonly kind: "enum";
    readonly ident: `enum<${string}>`;
    readonly name: string;
    readonly values: readonly [string, ...string[]];
  };
  custom: {
    readonly kind: "custom";
    readonly ident: `custom<${string}>`;
    readonly sqlType: string;
  };
  numeric: {
    readonly kind: "numeric";
    readonly ident: "numeric";
    readonly precision: number | undefined;
    readonly scale: number | undefined;
  };
  date: {
    readonly kind: "date";
    readonly ident: "date";
    readonly mode: "string" | "date";
  };
  char: {
    readonly kind: "char";
    readonly ident: "char";
    readonly length: number;
  };
  json: { readonly kind: "json"; readonly ident: "json" };
  real: { readonly kind: "real"; readonly ident: "real" };
  bigserial: {
    readonly kind: "bigserial";
    readonly ident: "bigint";
    readonly mode: "number" | "bigint";
  };
  smallserial: {
    readonly kind: "smallserial";
    readonly ident: "smallint";
  };
  uuid: { readonly kind: "uuid"; readonly ident: "uuid" };
  integer: {
    readonly kind: "integer";
    readonly ident: "integer" | EntityIdIdent<string>;
  };
  smallint: { readonly kind: "smallint"; readonly ident: "smallint" };
  bigint: {
    readonly kind: "bigint";
    readonly ident: "bigint";
    readonly mode: "number" | "bigint";
  };
  serial: { readonly kind: "serial"; readonly ident: "integer" };
  doublePrecision: {
    readonly kind: "doublePrecision";
    readonly ident: "doublePrecision";
  };
  boolean: { readonly kind: "boolean"; readonly ident: "boolean" };
  jsonb: { readonly kind: "jsonb"; readonly ident: "jsonb" };
  timestamp: {
    readonly kind: "timestamp";
    readonly ident: "timestamp" | "timestamptz";
    readonly mode: "date" | "string";
    readonly withTimezone: boolean;
  };
  bytea: { readonly kind: "bytea"; readonly ident: "bytea" };
};

/** Complete internal PostgreSQL descriptor algebra. */
export type Spec = TaggedEnum<SpecDefinition>;

export type Text = Extract<Spec, { readonly _tag: "text" }>;
export type Varchar<L extends number = number> = Omit<
  Extract<Spec, { readonly _tag: "varchar" }>,
  "length"
> & {
  readonly length: L;
};
export type Enum<Name extends string = string, Value extends string = string> = Omit<
  Extract<Spec, { readonly _tag: "enum" }>,
  "ident" | "name" | "values"
> & {
  readonly ident: `enum<${Name}>`;
  readonly name: Name;
  readonly values: readonly [Value, ...Value[]];
};
export type Custom<SqlType extends string = string> = Omit<
  Extract<Spec, { readonly _tag: "custom" }>,
  "ident" | "sqlType"
> & { readonly ident: `custom<${SqlType}>`; readonly sqlType: SqlType };
export type Numeric<
  Precision extends number | undefined = number | undefined,
  Scale extends number | undefined = number | undefined,
> = Omit<Extract<Spec, { readonly _tag: "numeric" }>, "precision" | "scale"> & {
  readonly precision: Precision;
  readonly scale: Scale;
};
export type DateColumn<Mode extends "string" | "date" = "string" | "date"> = Omit<
  Extract<Spec, { readonly _tag: "date" }>,
  "mode"
> & {
  readonly mode: Mode;
};
export type Char<Length extends number = number> = Omit<
  Extract<Spec, { readonly _tag: "char" }>,
  "length"
> & {
  readonly length: Length;
};
export type Json = Extract<Spec, { readonly _tag: "json" }>;
export type Real = Extract<Spec, { readonly _tag: "real" }>;
export type Bigserial<Mode extends "number" | "bigint" = "number" | "bigint"> = Omit<
  Extract<Spec, { readonly _tag: "bigserial" }>,
  "mode"
> & {
  readonly mode: Mode;
};
export type Smallserial = Extract<Spec, { readonly _tag: "smallserial" }>;
export type Uuid = Extract<Spec, { readonly _tag: "uuid" }>;
export type Integer<
  Ident extends "integer" | EntityIdIdent<string> = "integer" | EntityIdIdent<string>,
> = Omit<Extract<Spec, { readonly _tag: "integer" }>, "ident"> & {
  readonly ident: Ident;
};
export type Smallint = Extract<Spec, { readonly _tag: "smallint" }>;
export type Bigint<Mode extends "number" | "bigint" = "number" | "bigint"> = Omit<
  Extract<Spec, { readonly _tag: "bigint" }>,
  "mode"
> & {
  readonly mode: Mode;
};
export type Serial = Extract<Spec, { readonly _tag: "serial" }>;
export type DoublePrecision = Extract<Spec, { readonly _tag: "doublePrecision" }>;
export type Bool = Extract<Spec, { readonly _tag: "boolean" }>;
export type Jsonb = Extract<Spec, { readonly _tag: "jsonb" }>;
export type Timestamp<
  Mode extends "date" | "string" = "date" | "string",
  Timezone extends boolean = boolean,
> = Omit<Extract<Spec, { readonly _tag: "timestamp" }>, "ident" | "mode" | "withTimezone"> & {
  readonly ident: Timezone extends true ? "timestamptz" : "timestamp";
  readonly mode: Mode;
  readonly withTimezone: Timezone;
};
export type Bytea = Extract<Spec, { readonly _tag: "bytea" }>;

const Constructors = taggedEnum<Spec>();

const isPositiveInteger = (value: unknown): value is number =>
  isNumber(value) && Number.isInteger(value) && value > 0;
const isNatural = (value: unknown): value is number =>
  isNumber(value) && Number.isInteger(value) && value >= 0;
const invariant = (message: string): never => {
  throw ColumnInvariantError.make({ message });
};
const requireLength = (length: number): number =>
  isPositiveInteger(length) ? length : invariant("Column length must be a positive integer.");

const makeText = (): Text => Constructors.text({ kind: "text", ident: "text" });
export const Text = assignStatics(
  { make: (_props: {}) => makeText() },
  { toDrizzleBuilder: (_spec: Text, name: string) => text(name) },
);

function makeVarchar<const Length extends number>(props: {
  readonly length: Length;
}): Varchar<Length>;
function makeVarchar(props: { readonly length: number }): Varchar {
  return Constructors.varchar({
    kind: "varchar",
    ident: "varchar",
    length: requireLength(props.length),
  });
}
export const Varchar = assignStatics(
  { make: makeVarchar },
  {
    toDrizzleBuilder: ({ length }: Varchar, name: string) => varchar(name, { length }),
  },
);

function makeEnum<const Name extends string, const Value extends string>(props: {
  readonly ident: `enum<${Name}>`;
  readonly name: Name;
  readonly values: readonly [Value, ...Value[]];
}): Enum<Name, Value>;
function makeEnum(props: {
  readonly ident: `enum<${string}>`;
  readonly name: string;
  readonly values: readonly [string, ...string[]];
}): Enum {
  if (props.ident !== `enum<${props.name}>`) {
    return invariant("Enum identity must agree with its name.");
  }
  return Constructors.enum({ kind: "enum", ...props });
}
export type EnumInstance = PgEnum<[string, ...string[]]>;
export const Enum = assignStatics(
  { make: makeEnum },
  {
    toDrizzleBuilder: (spec: Enum, name: string, shared?: EnumInstance): DrizzleBuilder =>
      getOrElse(fromUndefinedOr(shared), () => pgEnum(spec.name, spec.values))(name),
    toDrizzleEnum: (spec: Enum): EnumInstance => pgEnum(spec.name, spec.values),
  },
);

function makeCustom<const SqlType extends string>(props: {
  readonly ident: `custom<${SqlType}>`;
  readonly sqlType: SqlType;
}): Custom<SqlType>;
function makeCustom(props: {
  readonly ident: `custom<${string}>`;
  readonly sqlType: string;
}): Custom {
  if (props.ident !== `custom<${props.sqlType}>`) {
    return invariant("Custom-column identity must agree with its SQL type.");
  }
  return Constructors.custom({ kind: "custom", ...props });
}
export type CustomBuilder = ReturnType<
  ReturnType<typeof customType<{ data: unknown; driverData: unknown }>>
>;
export const Custom = assignStatics(
  { make: makeCustom },
  {
    toDrizzleBuilder: ({ sqlType }: Custom, name: string): DrizzleBuilder =>
      customType<{ data: unknown; driverData: unknown }>({
        dataType: () => sqlType,
      })(name),
  },
);

function makeNumeric<
  const Precision extends number | undefined,
  const Scale extends number | undefined,
>(props: { readonly precision: Precision; readonly scale: Scale }): Numeric<Precision, Scale>;
function makeNumeric(props: {
  readonly precision: number | undefined;
  readonly scale: number | undefined;
}): Numeric {
  if (
    (isNumber(props.precision) && !isPositiveInteger(props.precision)) ||
    (isNumber(props.scale) && !isNatural(props.scale))
  ) {
    return invariant("Numeric precision must be positive and scale natural.");
  }
  return Constructors.numeric({ kind: "numeric", ident: "numeric", ...props });
}
export const Numeric = assignStatics(
  { make: makeNumeric },
  {
    toDrizzleBuilder: ({ precision, scale }: Numeric, name: string): PgNumericBuilder =>
      matchValue({ precision, scale }).pipe(
        matchWhen(
          StructPredicate({ precision: isNumber, scale: isNumber }),
          ({ precision, scale }) => numeric(name, { precision, scale, mode: "string" }),
        ),
        matchWhen(StructPredicate({ precision: isNumber }), ({ precision }) =>
          numeric(name, { precision, mode: "string" }),
        ),
        matchWhen(StructPredicate({ scale: isNumber }), ({ scale }) =>
          numeric(name, { scale, mode: "string" }),
        ),
        matchOrElse(() => numeric(name, { mode: "string" })),
      ),
  },
);

function makeDate<const Mode extends "string" | "date">(props: {
  readonly mode: Mode;
}): DateColumn<Mode>;
function makeDate(props: { readonly mode: "string" | "date" }): DateColumn {
  return Constructors.date({ kind: "date", ident: "date", ...props });
}
export const DateColumn = assignStatics(
  { make: makeDate },
  {
    toDrizzleBuilder: ({ mode }: DateColumn, name: string): DrizzleBuilder =>
      mode === "date" ? date(name, { mode: "date" }) : date(name, { mode: "string" }),
  },
);

function makeChar<const Length extends number>(props: { readonly length: Length }): Char<Length>;
function makeChar(props: { readonly length: number }): Char {
  return Constructors.char({
    kind: "char",
    ident: "char",
    length: requireLength(props.length),
  });
}
export const Char = assignStatics(
  { make: makeChar },
  {
    toDrizzleBuilder: ({ length }: Char, name: string): PgCharBuilder => char(name, { length }),
  },
);

const fixed = {
  Json: Constructors.json({ kind: "json", ident: "json" }),
  Real: Constructors.real({ kind: "real", ident: "real" }),
  Smallserial: Constructors.smallserial({
    kind: "smallserial",
    ident: "smallint",
  }),
  Uuid: Constructors.uuid({ kind: "uuid", ident: "uuid" }),
  Smallint: Constructors.smallint({ kind: "smallint", ident: "smallint" }),
  Serial: Constructors.serial({ kind: "serial", ident: "integer" }),
  DoublePrecision: Constructors.doublePrecision({
    kind: "doublePrecision",
    ident: "doublePrecision",
  }),
  Bool: Constructors.boolean({ kind: "boolean", ident: "boolean" }),
  Jsonb: Constructors.jsonb({ kind: "jsonb", ident: "jsonb" }),
  Bytea: Constructors.bytea({ kind: "bytea", ident: "bytea" }),
};

export const Json = assignStatics(
  { make: (_props: {}) => fixed.Json },
  { toDrizzleBuilder: (_spec: Json, name: string): PgJsonBuilder => json(name) },
);
export const Real = assignStatics(
  { make: (_props: {}) => fixed.Real },
  { toDrizzleBuilder: (_spec: Real, name: string): PgRealBuilder => real(name) },
);

function makeBigserial<const Mode extends "number" | "bigint">(props: {
  readonly mode: Mode;
}): Bigserial<Mode>;
function makeBigserial(props: { readonly mode: "number" | "bigint" }): Bigserial {
  return Constructors.bigserial({
    kind: "bigserial",
    ident: "bigint",
    ...props,
  });
}
export const Bigserial = assignStatics(
  { make: makeBigserial },
  {
    toDrizzleBuilder: (
      { mode }: Bigserial,
      name: string,
    ): PgBigSerial53Builder | PgBigSerial64Builder =>
      mode === "number" ? bigserial(name, { mode: "number" }) : bigserial(name, { mode: "bigint" }),
  },
);
export const Smallserial = assignStatics(
  { make: (_props: {}) => fixed.Smallserial },
  {
    toDrizzleBuilder: (_spec: Smallserial, name: string): PgSmallSerialBuilder => smallserial(name),
  },
);
export const Uuid = assignStatics(
  { make: (_props: {}) => fixed.Uuid },
  { toDrizzleBuilder: (_spec: Uuid, name: string) => uuid(name) },
);

function makeInteger<const Ident extends "integer" | EntityIdIdent<string>>(props: {
  readonly ident: Ident;
}): Integer<Ident>;
function makeInteger(props: { readonly ident: "integer" | EntityIdIdent<string> }): Integer {
  return Constructors.integer({ kind: "integer", ...props });
}
export const Integer = assignStatics(
  { make: makeInteger },
  {
    toDrizzleBuilder: (
      _spec: Integer,
      name: string,
      identity: IdentityMode = false,
    ): DrizzleBuilder => {
      const builder = integer(name);
      return identity === false ? builder : applyIdentity(builder, identity);
    },
  },
);
export const Smallint = assignStatics(
  { make: (_props: {}) => fixed.Smallint },
  {
    toDrizzleBuilder: (
      _spec: Smallint,
      name: string,
      identity: IdentityMode = false,
    ): DrizzleBuilder => {
      const builder = smallint(name);
      return identity === false ? builder : applyIdentity(builder, identity);
    },
  },
);

function makeBigint<const Mode extends "number" | "bigint">(props: {
  readonly mode: Mode;
}): Bigint<Mode>;
function makeBigint(props: { readonly mode: "number" | "bigint" }): Bigint {
  return Constructors.bigint({ kind: "bigint", ident: "bigint", ...props });
}
export const Bigint = assignStatics(
  { make: makeBigint },
  {
    toDrizzleBuilder: (
      { mode }: Bigint,
      name: string,
      identity: IdentityMode = false,
    ): DrizzleBuilder =>
      mode === "number"
        ? identity === false
          ? bigint(name, { mode: "number" })
          : applyIdentity(bigint(name, { mode: "number" }), identity)
        : identity === false
          ? bigint(name, { mode: "bigint" })
          : applyIdentity(bigint(name, { mode: "bigint" }), identity),
  },
);
export const Serial = assignStatics(
  { make: (_props: {}) => fixed.Serial },
  { toDrizzleBuilder: (_spec: Serial, name: string) => serial(name) },
);
export const DoublePrecision = assignStatics(
  { make: (_props: {}) => fixed.DoublePrecision },
  {
    toDrizzleBuilder: (_spec: DoublePrecision, name: string) => doublePrecision(name),
  },
);
export const Bool = assignStatics(
  { make: (_props: {}) => fixed.Bool },
  { toDrizzleBuilder: (_spec: Bool, name: string) => boolean(name) },
);
export const Jsonb = assignStatics(
  { make: (_props: {}) => fixed.Jsonb },
  { toDrizzleBuilder: (_spec: Jsonb, name: string) => jsonb(name) },
);

function makeTimestamp<
  const Mode extends "date" | "string",
  const Timezone extends boolean,
>(props: {
  readonly ident: Timezone extends true ? "timestamptz" : "timestamp";
  readonly mode: Mode;
  readonly withTimezone: Timezone;
}): Timestamp<Mode, Timezone>;
function makeTimestamp(props: {
  readonly ident: "timestamp" | "timestamptz";
  readonly mode: "date" | "string";
  readonly withTimezone: boolean;
}): Timestamp {
  const expected = props.withTimezone ? "timestamptz" : "timestamp";
  if (props.ident !== expected) {
    return invariant("Timestamp identity must agree with withTimezone.");
  }
  return Constructors.timestamp({ kind: "timestamp", ...props });
}
export const Timestamp = assignStatics(
  { make: makeTimestamp },
  {
    toDrizzleBuilder: ({ mode, withTimezone }: Timestamp, name: string): DrizzleBuilder =>
      mode === "date"
        ? timestamp(name, { mode: "date", withTimezone })
        : timestamp(name, { mode: "string", withTimezone }),
  },
);
export const Bytea = assignStatics(
  { make: (_props: {}) => fixed.Bytea },
  { toDrizzleBuilder: (_spec: Bytea, name: string) => bytea(name) },
);

const knownTags: ReadonlyArray<Spec["_tag"]> = [
  "text",
  "varchar",
  "enum",
  "custom",
  "numeric",
  "date",
  "char",
  "json",
  "real",
  "bigserial",
  "smallserial",
  "uuid",
  "integer",
  "smallint",
  "bigint",
  "serial",
  "doublePrecision",
  "boolean",
  "jsonb",
  "timestamp",
  "bytea",
];

/** Cheap full-enough shape guard for hand-built author descriptors. */
export const isSpec = (value: unknown): value is Spec => {
  if (
    !hasProperty(value, "_tag") ||
    !isString(value._tag) ||
    !contains(knownTags, value._tag) ||
    !hasProperty(value, "kind") ||
    value.kind !== value._tag ||
    !hasProperty(value, "ident") ||
    !isString(value.ident)
  ) {
    return false;
  }
  return matchValue(value._tag).pipe(
    matchWhen("varchar", () => hasProperty(value, "length") && isPositiveInteger(value.length)),
    matchWhen("char", () => hasProperty(value, "length") && isPositiveInteger(value.length)),
    matchWhen(
      "enum",
      () =>
        hasProperty(value, "name") &&
        isString(value.name) &&
        hasProperty(value, "values") &&
        isArray(value.values) &&
        isReadonlyArrayNonEmpty(value.values) &&
        value.values.every(isString) &&
        value.ident === `enum<${value.name}>`,
    ),
    matchWhen(
      "custom",
      () =>
        hasProperty(value, "sqlType") &&
        isString(value.sqlType) &&
        value.ident === `custom<${value.sqlType}>`,
    ),
    matchWhen(
      "numeric",
      () =>
        hasProperty(value, "precision") &&
        (isUndefined(value.precision) || isPositiveInteger(value.precision)) &&
        hasProperty(value, "scale") &&
        (isUndefined(value.scale) || isNatural(value.scale)),
    ),
    matchWhen(
      "date",
      () => hasProperty(value, "mode") && (value.mode === "string" || value.mode === "date"),
    ),
    matchWhen(
      "bigserial",
      () => hasProperty(value, "mode") && (value.mode === "number" || value.mode === "bigint"),
    ),
    matchWhen(
      "bigint",
      () => hasProperty(value, "mode") && (value.mode === "number" || value.mode === "bigint"),
    ),
    matchWhen(
      "timestamp",
      () =>
        hasProperty(value, "mode") &&
        (value.mode === "date" || value.mode === "string") &&
        hasProperty(value, "withTimezone") &&
        isBoolean(value.withTimezone) &&
        value.ident === (value.withTimezone ? "timestamptz" : "timestamp"),
    ),
    matchOrElse(() => true),
  );
};

const fromLiteralAST = matchType<Literal>().pipe(
  withReturnType<Option<Spec>>(),
  matchWhen(StructPredicate({ literal: isString }), () => someOption(Text.make({}))),
  matchWhen(StructPredicate({ literal: isNumber }), () => someOption(DoublePrecision.make({}))),
  matchWhen(StructPredicate({ literal: isBoolean }), () => someOption(Bool.make({}))),
  matchOrElse(() => none()),
);

const fromSchemaAST = (node: AST, visited: ReadonlyArray<AST> = empty()): Option<Spec> => {
  if (someArray(visited, equals(node))) return none();
  const nextVisited = append(visited, node);
  return matchType<AST>().pipe(
    withReturnType<Option<Spec>>(),
    matchTag("String", "TemplateLiteral", () => someOption(Text.make({}))),
    matchTag("Objects", "Arrays", () => someOption(Jsonb.make({}))),
    matchTags({
      Boolean: () => someOption(Bool.make({})),
      BigInt: () => someOption(Bigint.make({ mode: "bigint" })),
      Number: () => someOption(DoublePrecision.make({})),
      Literal: fromLiteralAST,
      Enum: () => someOption(Text.make({})),
      Suspend: ({ thunk }) => fromSchemaAST(thunk(), nextVisited),
    }),
    matchOrElse(() => none()),
  )(node);
};

const toDrizzleBuilder = dual<
  (name: string, identity?: IdentityMode) => (spec: Spec) => DrizzleBuilder,
  (spec: Spec, name: string, identity?: IdentityMode) => DrizzleBuilder
>(
  (args) => isSpec(args[0]),
  (spec: Spec, name: string, identity: IdentityMode = false): DrizzleBuilder =>
    Constructors.$match(spec, {
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
      doublePrecision: (self) => DoublePrecision.toDrizzleBuilder(self, name),
      boolean: (self) => Bool.toDrizzleBuilder(self, name),
      jsonb: (self) => Jsonb.toDrizzleBuilder(self, name),
      timestamp: (self) => Timestamp.toDrizzleBuilder(self, name),
      bytea: (self) => Bytea.toDrizzleBuilder(self, name),
    }),
);

/** Matching, guards, and compilation statics for the union. */
export const Spec = {
  $is: Constructors.$is,
  $match: Constructors.$match,
  is: isSpec,
  guards: {
    text: Constructors.$is("text"),
    varchar: Constructors.$is("varchar"),
    enum: Constructors.$is("enum"),
    custom: Constructors.$is("custom"),
    numeric: Constructors.$is("numeric"),
    date: Constructors.$is("date"),
    char: Constructors.$is("char"),
    json: Constructors.$is("json"),
    real: Constructors.$is("real"),
    bigserial: Constructors.$is("bigserial"),
    smallserial: Constructors.$is("smallserial"),
    uuid: Constructors.$is("uuid"),
    integer: Constructors.$is("integer"),
    smallint: Constructors.$is("smallint"),
    bigint: Constructors.$is("bigint"),
    serial: Constructors.$is("serial"),
    doublePrecision: Constructors.$is("doublePrecision"),
    boolean: Constructors.$is("boolean"),
    jsonb: Constructors.$is("jsonb"),
    timestamp: Constructors.$is("timestamp"),
    bytea: Constructors.$is("bytea"),
  },
  match: Constructors.$match,
  fromSchemaAST,
  toDrizzleBuilder,
};

/** Resolve a field-derived enum name without widening its literals. */
export type ResolveName<C extends Spec, Key extends string> =
  C extends Enum<"", infer Value> ? Enum<Key, Value> : C;

export function resolveName<C extends Spec, const Key extends string>(
  spec: C,
  key: Key,
): ResolveName<C, Key>;
export function resolveName(spec: Spec, key: string): Spec {
  return Spec.guards.enum(spec) && spec.name === ""
    ? Enum.make({ name: key, ident: `enum<${key}>`, values: spec.values })
    : spec;
}

export type Kind = Spec["kind"];
export type IdentOf<C extends Spec> = C["ident"];
export type StorageIdent<C extends Spec, Dimensions extends ArrayDimension> = Dimensions extends 0
  ? IdentOf<C>
  : `array<${IdentOf<C>},${Dimensions}>`;

export function storageIdent<C extends Spec, D extends ArrayDimension>(
  spec: C,
  dimensions: D,
): StorageIdent<C, D>;
export function storageIdent(spec: Spec, dimensions: ArrayDimension): string {
  return dimensions === 0 ? spec.ident : `array<${spec.ident},${dimensions}>`;
}

export type ArrayCarrier<Carrier, Dimensions extends ArrayDimension> = Dimensions extends 0
  ? Carrier
  : Dimensions extends 1
    ? ReadonlyArray<Carrier>
    : Dimensions extends 2
      ? ReadonlyArray<ReadonlyArray<Carrier>>
      : Dimensions extends 3
        ? ReadonlyArray<ReadonlyArray<ReadonlyArray<Carrier>>>
        : Dimensions extends 4
          ? ReadonlyArray<ReadonlyArray<ReadonlyArray<ReadonlyArray<Carrier>>>>
          : ReadonlyArray<ReadonlyArray<ReadonlyArray<ReadonlyArray<ReadonlyArray<Carrier>>>>>;

export type IdentEquals<A extends Spec, B extends Spec> = [IdentOf<A>] extends [IdentOf<B>]
  ? [IdentOf<B>] extends [IdentOf<A>]
    ? true
    : false
  : false;

export type IdentityKind = "integer" | "smallint" | "bigint";
export const isIdentityKind = (value: unknown): value is IdentityKind =>
  value === "integer" || value === "smallint" || value === "bigint";

export type CarrierOf<C extends Spec> = C extends Text | Varchar | Uuid | Enum | Char | Numeric
  ? string
  : C extends
        | Integer<"integer" | EntityIdIdent<string>>
        | Smallint
        | Serial
        | Smallserial
        | DoublePrecision
        | Real
    ? number
    : C extends Bigint<infer Mode>
      ? Mode extends "number"
        ? number
        : bigint
      : C extends Bool
        ? boolean
        : C extends Timestamp<infer Mode>
          ? Mode extends "date"
            ? Date
            : string
          : C extends Jsonb | Json
            ? object
            : C extends DateColumn<infer Mode>
              ? Mode extends "date"
                ? Date
                : string
              : C extends Bigserial<infer Mode>
                ? Mode extends "number"
                  ? number
                  : bigint
                : C extends Bytea
                  ? Uint8Array
                  : C extends Custom
                    ? unknown
                    : never;

export type CarrierTag =
  | "string"
  | "number"
  | "bigint"
  | "boolean"
  | "object"
  | "date"
  | "bytes"
  | "unknown";

export interface Carrier {
  readonly tag: CarrierTag;
  readonly dimensions: ArrayDimension;
}

export const carrierTag = (spec: Spec): CarrierTag => {
  const string = (): CarrierTag => "string";
  const number = (): CarrierTag => "number";
  return Spec.$match(spec, {
    text: string,
    varchar: string,
    enum: string,
    custom: (): CarrierTag => "unknown",
    numeric: string,
    date: ({ mode }): CarrierTag => mode,
    char: string,
    json: (): CarrierTag => "object",
    real: number,
    bigserial: ({ mode }): CarrierTag => mode,
    smallserial: number,
    uuid: string,
    integer: number,
    smallint: number,
    serial: number,
    doublePrecision: number,
    bigint: ({ mode }): CarrierTag => mode,
    boolean: (): CarrierTag => "boolean",
    jsonb: (): CarrierTag => "object",
    timestamp: ({ mode }): CarrierTag => mode,
    bytea: (): CarrierTag => "bytes",
  });
};

export const carrier = (spec: Spec, dimensions: ArrayDimension): Carrier => ({
  tag: carrierTag(spec),
  dimensions,
});
