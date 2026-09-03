/**
 * PostgreSQL column descriptors and their colocated Drizzle compilers.
 *
 * @since 0.0.0
 */

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
import { append, contains, empty, isArray, isReadonlyArrayNonEmpty, some as someArray } from "effect/Array";
import { taggedEnum } from "effect/Data";
import { equals } from "effect/Equal";
import { dual } from "effect/Function";
import {
  orElse as matchOrElse,
  tag as matchTag,
  tags as matchTags,
  type as matchType,
  value as matchValue,
  when as matchWhen,
  withReturnType,
} from "effect/Match";
import { fromUndefinedOr, getOrElse, none, some as someOption } from "effect/Option";
import { hasProperty, isBoolean, isNumber, isString, isUndefined, Struct as StructPredicate } from "effect/Predicate";
import { String as StringSchema, TaggedError } from "effect/Schema";
import { declaredFieldsEquivalence } from "../core/declaredFieldsEquivalence.ts";
import { assignStatics } from "../internal/statics.ts";
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
import type { TaggedEnum } from "effect/Data";
import type { Option } from "effect/Option";
import type { AST, Literal } from "effect/SchemaAST";
import type * as Meta from "../core/Meta.ts";

/** Descriptor-construction failure at an author-input seam. */
/** @internal */
class ColumnInvariantError extends TaggedError<ColumnInvariantError>("@beep/effect-drizzle/ColumnInvariantError")(
  "ColumnInvariantError",
  {
    message: StringSchema,
  },
  {
    description: "A PostgreSQL column descriptor violates its shape invariant.",
    toEquivalence: (typeParameters) => declaredFieldsEquivalence<ColumnInvariantError>(typeParameters),
  }
) {}

/** PostgreSQL identity-generation mode. */
/** @internal */
type IdentityMode = Meta.IdentityMode;

/**
 * PostgreSQL scalar or array depth.
 *
 * @category models
 * @since 0.0.0
 */
export type ArrayDimension = Meta.ArrayDimension;

/**
 * Drizzle-supported PostgreSQL array suffix.
 *
 * @category models
 * @since 0.0.0
 */
export type ArrayDimensionString = "[]" | "[][]" | "[][][]" | "[][][][]" | "[][][][][]";

/**
 * Numeric array depth represented by a suffix.
 *
 * @category models
 * @since 0.0.0
 */
export type DimensionOf<Suffix extends ArrayDimensionString> = Suffix extends "[]"
  ? 1
  : Suffix extends "[][]"
    ? 2
    : Suffix extends "[][][]"
      ? 3
      : Suffix extends "[][][][]"
        ? 4
        : 5;

/**
 * Common builder surface used by centralized modifier projection.
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export interface DrizzleBuilder extends AnyPgColumnBuilder {
  array(): DrizzleBuilder;
  array(dimensions: ArrayDimensionString): DrizzleBuilder;
  default(value: unknown): DrizzleBuilder;
  generatedAlwaysAs(value: SQL): DrizzleBuilder;
  notNull(): DrizzleBuilder;
  primaryKey(): DrizzleBuilder;
  unique(name?: string): DrizzleBuilder;
}

const applyIdentity = (
  builder: PgIntegerBuilder | PgSmallIntBuilder | PgBigInt53Builder | PgBigInt64Builder,
  kind: Exclude<IdentityMode, false>
): DrizzleBuilder => (kind === "always" ? builder.generatedAlwaysAsIdentity() : builder.generatedByDefaultAsIdentity());

/**
 * Storage identity for a number-encoded entity id.
 *
 * @category models
 * @since 0.0.0
 */
export type EntityIdIdent<TableName extends string> = `entityId<"${TableName}">`;

type SpecDefinition = {
  text: { readonly dialect: "pg"; readonly kind: "text"; readonly ident: "text" };
  varchar: {
    readonly dialect: "pg";
    readonly kind: "varchar";
    readonly ident: "varchar";
    readonly length: number;
  };
  enum: {
    readonly dialect: "pg";
    readonly kind: "enum";
    readonly ident: `enum<${string}>`;
    readonly name: string;
    readonly values: readonly [string, ...string[]];
  };
  custom: {
    readonly dialect: "pg";
    readonly kind: "custom";
    readonly ident: `custom<${string}>`;
    readonly sqlType: string;
  };
  numeric: {
    readonly dialect: "pg";
    readonly kind: "numeric";
    readonly ident: "numeric";
    readonly precision: number | undefined;
    readonly scale: number | undefined;
  };
  date: {
    readonly dialect: "pg";
    readonly kind: "date";
    readonly ident: "date";
    readonly mode: "string" | "date";
  };
  char: {
    readonly dialect: "pg";
    readonly kind: "char";
    readonly ident: "char";
    readonly length: number;
  };
  json: { readonly dialect: "pg"; readonly kind: "json"; readonly ident: "json" };
  real: { readonly dialect: "pg"; readonly kind: "real"; readonly ident: "real" };
  bigserial: {
    readonly dialect: "pg";
    readonly kind: "bigserial";
    readonly ident: "bigint";
    readonly mode: "number" | "bigint";
  };
  smallserial: {
    readonly dialect: "pg";
    readonly kind: "smallserial";
    readonly ident: "smallint";
  };
  uuid: { readonly dialect: "pg"; readonly kind: "uuid"; readonly ident: "uuid" };
  integer: {
    readonly dialect: "pg";
    readonly kind: "integer";
    readonly ident: "integer" | EntityIdIdent<string>;
  };
  smallint: { readonly dialect: "pg"; readonly kind: "smallint"; readonly ident: "smallint" };
  bigint: {
    readonly dialect: "pg";
    readonly kind: "bigint";
    readonly ident: "bigint";
    readonly mode: "number" | "bigint";
  };
  serial: { readonly dialect: "pg"; readonly kind: "serial"; readonly ident: "integer" };
  doublePrecision: {
    readonly dialect: "pg";
    readonly kind: "doublePrecision";
    readonly ident: "doublePrecision";
  };
  boolean: { readonly dialect: "pg"; readonly kind: "boolean"; readonly ident: "boolean" };
  jsonb: { readonly dialect: "pg"; readonly kind: "jsonb"; readonly ident: "jsonb" };
  timestamp: {
    readonly dialect: "pg";
    readonly kind: "timestamp";
    readonly ident: "timestamp" | "timestamptz";
    readonly mode: "date" | "string";
    readonly withTimezone: boolean;
  };
  bytea: { readonly dialect: "pg"; readonly kind: "bytea"; readonly ident: "bytea" };
};

/**
 * Complete PostgreSQL descriptor algebra exposed through public field inference.
 *
 * @category models
 * @since 0.0.0
 */
export type Spec = TaggedEnum<SpecDefinition>;

/**
 * PostgreSQL text descriptor carried by `text()` fields.
 *
 * @category type-level
 * @since 0.0.0
 */
export type Text = Extract<Spec, { readonly _tag: "text" }>;
/**
 * PostgreSQL variable-length string descriptor carried by `varchar()` fields.
 *
 * @category type-level
 * @since 0.0.0
 */
export type Varchar<L extends number = number> = Omit<Extract<Spec, { readonly _tag: "varchar" }>, "length"> & {
  readonly length: L;
};
/**
 * PostgreSQL named-enum descriptor carried by `enum()` fields.
 *
 * @category type-level
 * @since 0.0.0
 */
export type Enum<Name extends string = string, Value extends string = string> = Omit<
  Extract<Spec, { readonly _tag: "enum" }>,
  "ident" | "name" | "values"
> & {
  readonly ident: `enum<${Name}>`;
  readonly name: Name;
  readonly values: readonly [Value, ...Value[]];
};
/**
 * PostgreSQL custom-column descriptor carried by `custom()` fields.
 *
 * @category type-level
 * @since 0.0.0
 */
export type Custom<SqlType extends string = string> = Omit<
  Extract<Spec, { readonly _tag: "custom" }>,
  "ident" | "sqlType"
> & { readonly ident: `custom<${SqlType}>`; readonly sqlType: SqlType };
/**
 * PostgreSQL numeric descriptor carried by `numeric()` fields.
 *
 * @category type-level
 * @since 0.0.0
 */
export type Numeric<
  Precision extends number | undefined = number | undefined,
  Scale extends number | undefined = number | undefined,
> = Omit<Extract<Spec, { readonly _tag: "numeric" }>, "precision" | "scale"> & {
  readonly precision: Precision;
  readonly scale: Scale;
};
/**
 * PostgreSQL date descriptor carried by `date()` fields.
 *
 * @category type-level
 * @since 0.0.0
 */
export type DateColumn<Mode extends "string" | "date" = "string" | "date"> = Omit<
  Extract<Spec, { readonly _tag: "date" }>,
  "mode"
> & {
  readonly mode: Mode;
};
/**
 * PostgreSQL fixed-length string descriptor carried by `char()` fields.
 *
 * @category type-level
 * @since 0.0.0
 */
export type Char<Length extends number = number> = Omit<Extract<Spec, { readonly _tag: "char" }>, "length"> & {
  readonly length: Length;
};
/**
 * PostgreSQL JSON descriptor carried by `json()` fields.
 *
 * @category type-level
 * @since 0.0.0
 */
export type Json = Extract<Spec, { readonly _tag: "json" }>;
/**
 * PostgreSQL real-number descriptor carried by `real()` fields.
 *
 * @category type-level
 * @since 0.0.0
 */
export type Real = Extract<Spec, { readonly _tag: "real" }>;
/**
 * PostgreSQL bigserial descriptor carried by `bigserial()` fields.
 *
 * @category type-level
 * @since 0.0.0
 */
export type Bigserial<Mode extends "number" | "bigint" = "number" | "bigint"> = Omit<
  Extract<Spec, { readonly _tag: "bigserial" }>,
  "mode"
> & {
  readonly mode: Mode;
};
/**
 * PostgreSQL smallserial descriptor carried by `smallserial()` fields.
 *
 * @category type-level
 * @since 0.0.0
 */
export type Smallserial = Extract<Spec, { readonly _tag: "smallserial" }>;
/**
 * PostgreSQL UUID descriptor carried by `uuid()` fields.
 *
 * @category type-level
 * @since 0.0.0
 */
export type Uuid = Extract<Spec, { readonly _tag: "uuid" }>;
/**
 * PostgreSQL integer descriptor carried by `integer()` fields.
 *
 * @category type-level
 * @since 0.0.0
 */
export type Integer<Ident extends "integer" | EntityIdIdent<string> = "integer" | EntityIdIdent<string>> = Omit<
  Extract<Spec, { readonly _tag: "integer" }>,
  "ident"
> & {
  readonly ident: Ident;
};
/**
 * PostgreSQL smallint descriptor carried by `smallint()` fields.
 *
 * @category type-level
 * @since 0.0.0
 */
export type Smallint = Extract<Spec, { readonly _tag: "smallint" }>;
/**
 * PostgreSQL bigint descriptor carried by `bigint()` fields.
 *
 * @category type-level
 * @since 0.0.0
 */
export type Bigint<Mode extends "number" | "bigint" = "number" | "bigint"> = Omit<
  Extract<Spec, { readonly _tag: "bigint" }>,
  "mode"
> & {
  readonly mode: Mode;
};
/**
 * PostgreSQL serial descriptor carried by `serial()` fields.
 *
 * @category type-level
 * @since 0.0.0
 */
export type Serial = Extract<Spec, { readonly _tag: "serial" }>;
/**
 * PostgreSQL double-precision descriptor carried by `doublePrecision()` fields.
 *
 * @category type-level
 * @since 0.0.0
 */
export type DoublePrecision = Extract<Spec, { readonly _tag: "doublePrecision" }>;
/**
 * PostgreSQL boolean descriptor carried by `boolean()` fields.
 *
 * @category type-level
 * @since 0.0.0
 */
export type Bool = Extract<Spec, { readonly _tag: "boolean" }>;
/**
 * PostgreSQL JSONB descriptor carried by `jsonb()` fields.
 *
 * @category type-level
 * @since 0.0.0
 */
export type Jsonb = Extract<Spec, { readonly _tag: "jsonb" }>;
/**
 * PostgreSQL timestamp descriptor carried by `timestamp()` fields.
 *
 * @category type-level
 * @since 0.0.0
 */
export type Timestamp<Mode extends "date" | "string" = "date" | "string", Timezone extends boolean = boolean> = Omit<
  Extract<Spec, { readonly _tag: "timestamp" }>,
  "ident" | "mode" | "withTimezone"
> & {
  readonly ident: Timezone extends true ? "timestamptz" : "timestamp";
  readonly mode: Mode;
  readonly withTimezone: Timezone;
};
/**
 * PostgreSQL byte-array descriptor carried by `bytea()` fields.
 *
 * @category type-level
 * @since 0.0.0
 */
export type Bytea = Extract<Spec, { readonly _tag: "bytea" }>;

const Constructors = /* @__PURE__ */ taggedEnum<Spec>();

const isPositiveInteger = (value: unknown): value is number => isNumber(value) && Number.isInteger(value) && value > 0;
const isPgNumericScale = (value: unknown): value is number =>
  isNumber(value) && Number.isInteger(value) && value >= -1_000 && value <= 1_000;
const invariant = (message: string): never => {
  throw ColumnInvariantError.make({ message });
};
const requireLength = (length: number): number =>
  isPositiveInteger(length) && length <= 10_485_760
    ? length
    : invariant("PostgreSQL character length must be an integer from 1 through 10,485,760.");

const makeText = (): Text => Constructors.text({ dialect: "pg", kind: "text", ident: "text" });
/**
 * Internal helper `Text`.
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const Text = /* @__PURE__ */ assignStatics(
  { make: (_props: {}) => makeText() },
  { toDrizzleBuilder: (_spec: Text, name: string) => text(name) }
);

function makeVarchar<const Length extends number>(props: { readonly length: Length }): Varchar<Length>;
function makeVarchar(props: { readonly length: number }): Varchar {
  return Constructors.varchar({
    dialect: "pg",
    kind: "varchar",
    ident: "varchar",
    length: requireLength(props.length),
  });
}
/**
 * Internal helper `Varchar`.
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const Varchar = /* @__PURE__ */ assignStatics(
  { make: makeVarchar },
  {
    toDrizzleBuilder: ({ length }: Varchar, name: string) => varchar(name, { length }),
  }
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
  return Constructors.enum({ dialect: "pg", kind: "enum", ...props });
}
/**
 * Drizzle enum instance retained by PostgreSQL schema assembly.
 *
 * @category type-level
 * @since 0.0.0
 */
export type EnumInstance = PgEnum<[string, ...string[]]>;
/**
 * Internal helper `Enum`.
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const Enum = /* @__PURE__ */ assignStatics(
  { make: makeEnum },
  {
    toDrizzleBuilder: (spec: Enum, name: string, shared?: EnumInstance): DrizzleBuilder =>
      getOrElse(fromUndefinedOr(shared), () => pgEnum(spec.name, spec.values))(name),
    toDrizzleEnum: (spec: Enum): EnumInstance => pgEnum(spec.name, spec.values),
  }
);

function makeCustom<const SqlType extends string>(props: {
  readonly ident: `custom<${SqlType}>`;
  readonly sqlType: SqlType;
}): Custom<SqlType>;
function makeCustom(props: { readonly ident: `custom<${string}>`; readonly sqlType: string }): Custom {
  if (props.ident !== `custom<${props.sqlType}>`) {
    return invariant("Custom-column identity must agree with its SQL type.");
  }
  return Constructors.custom({ dialect: "pg", kind: "custom", ...props });
}
/**
 * Drizzle builder type produced for a custom PostgreSQL descriptor.
 *
 * @category type-level
 * @since 0.0.0
 */
export type CustomBuilder = ReturnType<ReturnType<typeof customType<{ data: unknown; driverData: unknown }>>>;
/**
 * Internal helper `Custom`.
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const Custom = /* @__PURE__ */ assignStatics(
  { make: makeCustom },
  {
    toDrizzleBuilder: ({ sqlType }: Custom, name: string): DrizzleBuilder =>
      customType<{ data: unknown; driverData: unknown }>({
        dataType: () => sqlType,
      })(name),
  }
);

function makeNumeric<const Precision extends number | undefined, const Scale extends number | undefined>(props: {
  readonly precision: Precision;
  readonly scale: Scale;
}): Numeric<Precision, Scale>;
function makeNumeric(props: { readonly precision: number | undefined; readonly scale: number | undefined }): Numeric {
  if (
    (isNumber(props.precision) && (!isPositiveInteger(props.precision) || props.precision > 1_000)) ||
    (isNumber(props.scale) && !isPgNumericScale(props.scale))
  ) {
    return invariant("PostgreSQL numeric precision must be from 1 through 1,000 and scale from -1,000 through 1,000.");
  }
  return Constructors.numeric({ dialect: "pg", kind: "numeric", ident: "numeric", ...props });
}
/**
 * Internal helper `Numeric`.
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const Numeric = /* @__PURE__ */ assignStatics(
  { make: makeNumeric },
  {
    toDrizzleBuilder: ({ precision, scale }: Numeric, name: string): PgNumericBuilder =>
      matchValue({ precision, scale }).pipe(
        matchWhen(StructPredicate({ precision: isNumber, scale: isNumber }), ({ precision, scale }) =>
          numeric(name, { precision, scale, mode: "string" })
        ),
        matchWhen(StructPredicate({ precision: isNumber }), ({ precision }) =>
          numeric(name, { precision, mode: "string" })
        ),
        matchWhen(StructPredicate({ scale: isNumber }), ({ scale }) => numeric(name, { scale, mode: "string" })),
        matchOrElse(() => numeric(name, { mode: "string" }))
      ),
  }
);

function makeDate<const Mode extends "string" | "date">(props: { readonly mode: Mode }): DateColumn<Mode>;
function makeDate(props: { readonly mode: "string" | "date" }): DateColumn {
  return Constructors.date({ dialect: "pg", kind: "date", ident: "date", ...props });
}
/**
 * Internal helper `DateColumn`.
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const DateColumn = /* @__PURE__ */ assignStatics(
  { make: makeDate },
  {
    toDrizzleBuilder: ({ mode }: DateColumn, name: string): DrizzleBuilder =>
      mode === "date" ? date(name, { mode: "date" }) : date(name, { mode: "string" }),
  }
);

function makeChar<const Length extends number>(props: { readonly length: Length }): Char<Length>;
function makeChar(props: { readonly length: number }): Char {
  return Constructors.char({
    dialect: "pg",
    kind: "char",
    ident: "char",
    length: requireLength(props.length),
  });
}
/**
 * Internal helper `Char`.
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const Char = /* @__PURE__ */ assignStatics(
  { make: makeChar },
  {
    toDrizzleBuilder: ({ length }: Char, name: string): PgCharBuilder => char(name, { length }),
  }
);

const fixedJson = /* @__PURE__ */ Constructors.json({ dialect: "pg", kind: "json", ident: "json" });
const fixedReal = /* @__PURE__ */ Constructors.real({ dialect: "pg", kind: "real", ident: "real" });
const fixedSmallserial = /* @__PURE__ */ Constructors.smallserial({
  dialect: "pg",
  kind: "smallserial",
  ident: "smallint",
});
const fixedUuid = /* @__PURE__ */ Constructors.uuid({ dialect: "pg", kind: "uuid", ident: "uuid" });
const fixedSmallint = /* @__PURE__ */ Constructors.smallint({
  dialect: "pg",
  kind: "smallint",
  ident: "smallint",
});
const fixedSerial = /* @__PURE__ */ Constructors.serial({
  dialect: "pg",
  kind: "serial",
  ident: "integer",
});
const fixedDoublePrecision = /* @__PURE__ */ Constructors.doublePrecision({
  dialect: "pg",
  kind: "doublePrecision",
  ident: "doublePrecision",
});
const fixedBool = /* @__PURE__ */ Constructors.boolean({
  dialect: "pg",
  kind: "boolean",
  ident: "boolean",
});
const fixedJsonb = /* @__PURE__ */ Constructors.jsonb({
  dialect: "pg",
  kind: "jsonb",
  ident: "jsonb",
});
const fixedBytea = /* @__PURE__ */ Constructors.bytea({
  dialect: "pg",
  kind: "bytea",
  ident: "bytea",
});

/**
 * Internal helper `Json`.
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const Json = /* @__PURE__ */ assignStatics(
  { make: (_props: {}) => fixedJson },
  { toDrizzleBuilder: (_spec: Json, name: string): PgJsonBuilder => json(name) }
);
/**
 * Internal helper `Real`.
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const Real = /* @__PURE__ */ assignStatics(
  { make: (_props: {}) => fixedReal },
  { toDrizzleBuilder: (_spec: Real, name: string): PgRealBuilder => real(name) }
);

function makeBigserial<const Mode extends "number" | "bigint">(props: { readonly mode: Mode }): Bigserial<Mode>;
function makeBigserial(props: { readonly mode: "number" | "bigint" }): Bigserial {
  return Constructors.bigserial({
    dialect: "pg",
    kind: "bigserial",
    ident: "bigint",
    ...props,
  });
}
/**
 * Internal helper `Bigserial`.
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const Bigserial = /* @__PURE__ */ assignStatics(
  { make: makeBigserial },
  {
    toDrizzleBuilder: ({ mode }: Bigserial, name: string): PgBigSerial53Builder | PgBigSerial64Builder =>
      mode === "number" ? bigserial(name, { mode: "number" }) : bigserial(name, { mode: "bigint" }),
  }
);
/**
 * Internal helper `Smallserial`.
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const Smallserial = /* @__PURE__ */ assignStatics(
  { make: (_props: {}) => fixedSmallserial },
  {
    toDrizzleBuilder: (_spec: Smallserial, name: string): PgSmallSerialBuilder => smallserial(name),
  }
);
/**
 * Internal helper `Uuid`.
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const Uuid = /* @__PURE__ */ assignStatics(
  { make: (_props: {}) => fixedUuid },
  { toDrizzleBuilder: (_spec: Uuid, name: string) => uuid(name) }
);

function makeInteger<const Ident extends "integer" | EntityIdIdent<string>>(props: {
  readonly ident: Ident;
}): Integer<Ident>;
function makeInteger(props: { readonly ident: "integer" | EntityIdIdent<string> }): Integer {
  return Constructors.integer({ dialect: "pg", kind: "integer", ...props });
}
/**
 * Internal helper `Integer`.
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const Integer = /* @__PURE__ */ assignStatics(
  { make: makeInteger },
  {
    toDrizzleBuilder: (_spec: Integer, name: string, identity: IdentityMode = false): DrizzleBuilder => {
      const builder = integer(name);
      return identity === false ? builder : applyIdentity(builder, identity);
    },
  }
);
/**
 * Internal helper `Smallint`.
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const Smallint = /* @__PURE__ */ assignStatics(
  { make: (_props: {}) => fixedSmallint },
  {
    toDrizzleBuilder: (_spec: Smallint, name: string, identity: IdentityMode = false): DrizzleBuilder => {
      const builder = smallint(name);
      return identity === false ? builder : applyIdentity(builder, identity);
    },
  }
);

function makeBigint<const Mode extends "number" | "bigint">(props: { readonly mode: Mode }): Bigint<Mode>;
function makeBigint(props: { readonly mode: "number" | "bigint" }): Bigint {
  return Constructors.bigint({ dialect: "pg", kind: "bigint", ident: "bigint", ...props });
}
/**
 * Internal helper `Bigint`.
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const Bigint = /* @__PURE__ */ assignStatics(
  { make: makeBigint },
  {
    toDrizzleBuilder: ({ mode }: Bigint, name: string, identity: IdentityMode = false): DrizzleBuilder =>
      mode === "number"
        ? identity === false
          ? bigint(name, { mode: "number" })
          : applyIdentity(bigint(name, { mode: "number" }), identity)
        : identity === false
          ? bigint(name, { mode: "bigint" })
          : applyIdentity(bigint(name, { mode: "bigint" }), identity),
  }
);
/**
 * Internal helper `Serial`.
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const Serial = /* @__PURE__ */ assignStatics(
  { make: (_props: {}) => fixedSerial },
  { toDrizzleBuilder: (_spec: Serial, name: string) => serial(name) }
);
/**
 * Internal helper `DoublePrecision`.
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const DoublePrecision = /* @__PURE__ */ assignStatics(
  { make: (_props: {}) => fixedDoublePrecision },
  {
    toDrizzleBuilder: (_spec: DoublePrecision, name: string) => doublePrecision(name),
  }
);
/**
 * Internal helper `Bool`.
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const Bool = /* @__PURE__ */ assignStatics(
  { make: (_props: {}) => fixedBool },
  { toDrizzleBuilder: (_spec: Bool, name: string) => boolean(name) }
);
/**
 * Internal helper `Jsonb`.
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const Jsonb = /* @__PURE__ */ assignStatics(
  { make: (_props: {}) => fixedJsonb },
  { toDrizzleBuilder: (_spec: Jsonb, name: string) => jsonb(name) }
);

function makeTimestamp<const Mode extends "date" | "string", const Timezone extends boolean>(props: {
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
  return Constructors.timestamp({ dialect: "pg", kind: "timestamp", ...props });
}
/**
 * Internal helper `Timestamp`.
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const Timestamp = /* @__PURE__ */ assignStatics(
  { make: makeTimestamp },
  {
    toDrizzleBuilder: ({ mode, withTimezone }: Timestamp, name: string): DrizzleBuilder =>
      mode === "date"
        ? timestamp(name, { mode: "date", withTimezone })
        : timestamp(name, { mode: "string", withTimezone }),
  }
);
/**
 * Internal helper `Bytea`.
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const Bytea = /* @__PURE__ */ assignStatics(
  { make: (_props: {}) => fixedBytea },
  { toDrizzleBuilder: (_spec: Bytea, name: string) => bytea(name) }
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

/**
 * Cheap full-enough shape guard for hand-built author descriptors.
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const isSpec = (value: unknown): value is Spec => {
  if (
    !hasProperty(value, "_tag") ||
    !isString(value._tag) ||
    !contains(knownTags, value._tag) ||
    !hasProperty(value, "dialect") ||
    value.dialect !== "pg" ||
    !hasProperty(value, "kind") ||
    value.kind !== value._tag ||
    !hasProperty(value, "ident") ||
    !isString(value.ident)
  ) {
    return false;
  }
  return matchValue(value._tag).pipe(
    matchWhen(
      "varchar",
      () => hasProperty(value, "length") && isPositiveInteger(value.length) && value.length <= 10_485_760
    ),
    matchWhen(
      "char",
      () => hasProperty(value, "length") && isPositiveInteger(value.length) && value.length <= 10_485_760
    ),
    matchWhen(
      "enum",
      () =>
        hasProperty(value, "name") &&
        isString(value.name) &&
        hasProperty(value, "values") &&
        isArray(value.values) &&
        isReadonlyArrayNonEmpty(value.values) &&
        value.values.every(isString) &&
        value.ident === `enum<${value.name}>`
    ),
    matchWhen(
      "custom",
      () => hasProperty(value, "sqlType") && isString(value.sqlType) && value.ident === `custom<${value.sqlType}>`
    ),
    matchWhen(
      "numeric",
      () =>
        hasProperty(value, "precision") &&
        (isUndefined(value.precision) || (isPositiveInteger(value.precision) && value.precision <= 1_000)) &&
        hasProperty(value, "scale") &&
        (isUndefined(value.scale) || isPgNumericScale(value.scale))
    ),
    matchWhen("date", () => hasProperty(value, "mode") && (value.mode === "string" || value.mode === "date")),
    matchWhen("bigserial", () => hasProperty(value, "mode") && (value.mode === "number" || value.mode === "bigint")),
    matchWhen("bigint", () => hasProperty(value, "mode") && (value.mode === "number" || value.mode === "bigint")),
    matchWhen(
      "timestamp",
      () =>
        hasProperty(value, "mode") &&
        (value.mode === "date" || value.mode === "string") &&
        hasProperty(value, "withTimezone") &&
        isBoolean(value.withTimezone) &&
        value.ident === (value.withTimezone ? "timestamptz" : "timestamp")
    ),
    matchOrElse(() => true)
  );
};

const fromLiteralAST = /* @__PURE__ */ (() =>
  matchType<Literal>().pipe(
    withReturnType<Option<Spec>>(),
    matchWhen(StructPredicate({ literal: isString }), () => someOption(Text.make({}))),
    matchWhen(StructPredicate({ literal: isNumber }), () => someOption(DoublePrecision.make({}))),
    matchWhen(StructPredicate({ literal: isBoolean }), () => someOption(Bool.make({}))),
    matchOrElse(() => none())
  ))();

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
    matchOrElse(() => none())
  )(node);
};

const toDrizzleBuilder = /* @__PURE__ */ dual<
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
    })
);

/**
 * Matching, guards, and compilation statics for the union.
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const Spec = /* @__PURE__ */ (() => ({
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
}))();

/**
 * Resolve a field-derived enum name without widening its literals.
 *
 * @category models
 * @since 0.0.0
 */
export type ResolveName<C extends Spec, Key extends string> = C extends Enum<"", infer Value> ? Enum<Key, Value> : C;

/**
 * Internal helper `resolveName`.
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export function resolveName<const Key extends string>(key: Key): <C extends Spec>(spec: C) => ResolveName<C, Key>;
export function resolveName<C extends Spec, const Key extends string>(spec: C, key: Key): ResolveName<C, Key>;
export function resolveName(
  ...args: readonly [key: string] | readonly [spec: Spec, key: string]
): Spec | ((spec: Spec) => Spec) {
  if (args.length === 1) {
    return (spec: Spec) => resolveName(spec, args[0]);
  }
  const [spec, key] = args;
  return Spec.guards.enum(spec) && spec.name === ""
    ? Enum.make({ name: key, ident: `enum<${key}>`, values: spec.values })
    : spec;
}

/** Storage identity selected from a public PostgreSQL descriptor. */
type IdentOf<C extends Spec> = C["ident"];
/**
 * Storage identity inferred for a PostgreSQL descriptor and array depth.
 *
 * @category type-level
 * @since 0.0.0
 */
export type StorageIdent<C extends Spec, Dimensions extends ArrayDimension> = Dimensions extends 0
  ? IdentOf<C>
  : `array<${IdentOf<C>},${Dimensions}>`;

/**
 * Internal helper `storageIdent`.
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export function storageIdent<D extends ArrayDimension>(dimensions: D): <C extends Spec>(spec: C) => StorageIdent<C, D>;
export function storageIdent<C extends Spec, D extends ArrayDimension>(spec: C, dimensions: D): StorageIdent<C, D>;
export function storageIdent(
  ...args: readonly [dimensions: ArrayDimension] | readonly [spec: Spec, dimensions: ArrayDimension]
): string | ((spec: Spec) => string) {
  if (args.length === 1) {
    return (spec: Spec) => storageIdent(spec, args[0]);
  }
  const [spec, dimensions] = args;
  return dimensions === 0 ? spec.ident : `array<${spec.ident},${dimensions}>`;
}

/**
 * Encoded carrier nested to a PostgreSQL array depth.
 *
 * @category type-level
 * @since 0.0.0
 */
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

/**
 * PostgreSQL integer families that support generated identities.
 *
 * @category type-level
 * @since 0.0.0
 */
export type IdentityKind = "integer" | "smallint" | "bigint";
/**
 * Internal helper `isIdentityKind`.
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const isIdentityKind = (value: unknown): value is IdentityKind =>
  value === "integer" || value === "smallint" || value === "bigint";

/**
 * Test whether a descriptor is an integer-family column encoded as `number`.
 * @internal
 * @category guards
 * @since 0.0.0
 */
export const isNumberInteger = (spec: Spec): spec is Integer | Smallint | Bigint<"number"> =>
  Spec.guards.integer(spec) || Spec.guards.smallint(spec) || (Spec.guards.bigint(spec) && spec.mode === "number");

/**
 * Encoded carrier represented by a PostgreSQL descriptor.
 *
 * @category type-level
 * @since 0.0.0
 */
export type CarrierOf<C extends Spec> = C extends Text | Varchar | Uuid | Enum | Char | Numeric
  ? string
  : C extends Integer<"integer" | EntityIdIdent<string>> | Smallint | Serial | Smallserial | DoublePrecision | Real
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

/**
 * Internal type-level shape `CarrierTag`.
 *
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export type CarrierTag = "string" | "number" | "bigint" | "boolean" | "object" | "date" | "bytes" | "unknown";

/**
 * Internal type-level shape `Carrier`.
 *
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export interface Carrier {
  readonly dimensions: ArrayDimension;
  readonly tag: CarrierTag;
}

/** @internal */
const carrierTag = (spec: Spec): CarrierTag => {
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

/**
 * Internal helper `carrier`.
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export function carrier(dimensions: ArrayDimension): (spec: Spec) => Carrier;
export function carrier(spec: Spec, dimensions: ArrayDimension): Carrier;
export function carrier(
  ...args: readonly [dimensions: ArrayDimension] | readonly [spec: Spec, dimensions: ArrayDimension]
): Carrier | ((spec: Spec) => Carrier) {
  if (args.length === 1) {
    return (spec: Spec) => carrier(spec, args[0]);
  }
  const [spec, dimensions] = args;
  return {
    tag: carrierTag(spec),
    dimensions,
  };
}
