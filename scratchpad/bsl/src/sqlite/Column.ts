/** SQLite storage-class descriptors and their colocated Drizzle compilers. */
import type { SQL } from "drizzle-orm";
import type { ColumnBuilderBase } from "drizzle-orm/column-builder";
import {
  blob,
  integer,
  numeric,
  real,
  text,
} from "drizzle-orm/sqlite-core";
import type {
  SQLiteBigIntBuilder,
  SQLiteBlobBufferBuilder,
  SQLiteBlobJsonBuilder,
  SQLiteBooleanBuilder,
  SQLiteIntegerBuilder,
  SQLiteNumericBigIntBuilder,
  SQLiteNumericBuilder,
  SQLiteNumericNumberBuilder,
  SQLiteRealBuilder,
  SQLiteTextBuilder,
  SQLiteTextJsonBuilder,
  SQLiteTimestampBuilder,
} from "drizzle-orm/sqlite-core";
import { append, contains, empty, some as someArray } from "effect/Array";
import { taggedEnum } from "effect/Data";
import type { TaggedEnum } from "effect/Data";
import { equals } from "effect/Equal";
import { dual } from "effect/Function";
import {
  orElse as matchOrElse,
  tags as matchTags,
  type as matchType,
  when as matchWhen,
  withReturnType,
} from "effect/Match";
import { none, some } from "effect/Option";
import type { Option } from "effect/Option";
import {
  Struct as StructPredicate,
  hasProperty,
  isBoolean,
  isNumber,
  isString,
} from "effect/Predicate";
import { String as StringSchema, TaggedError } from "effect/Schema";
import type { AST, Literal } from "effect/SchemaAST";
import type * as Meta from "../core/Meta.ts";
import { assignStatics } from "../internal/statics.ts";

/** Failure raised when a SQLite descriptor violates its closed shape. */
export class ColumnInvariantError extends TaggedError<ColumnInvariantError>(
  "@beep/effect-drizzle/sqlite/ColumnInvariantError",
)(
  "ColumnInvariantError",
  { message: StringSchema },
  { description: "A SQLite column descriptor violates its shape invariant." },
) {}

/** SQLite number-encoded EntityId storage identity. */
export type EntityIdIdent<TableName extends string> = `entityId<"${TableName}">`;
export type ArrayDimension = Meta.ArrayDimension;

/** Modes supported by the installed SQLite text builder. */
export type TextMode = "text" | "json";

/** Modes supported by the installed SQLite integer builder. */
export type IntegerMode = "number" | "boolean" | "timestamp" | "timestamp_ms";

/** Modes supported by the installed SQLite blob builder. */
export type BlobMode = "buffer" | "json" | "bigint";

/** Modes supported by the installed SQLite numeric builder. */
export type NumericMode = "string" | "number" | "bigint";

type SpecDefinition = {
  text: {
    readonly dialect: "sqlite";
    readonly kind: "text";
    readonly ident: "text";
    readonly mode: TextMode;
  };
  enum: {
    readonly dialect: "sqlite";
    readonly kind: "enum";
    readonly ident: "text";
    readonly values: readonly [string, ...string[]];
  };
  integer: {
    readonly dialect: "sqlite";
    readonly kind: "integer";
    readonly ident: "integer" | EntityIdIdent<string>;
    readonly mode: IntegerMode;
  };
  real: {
    readonly dialect: "sqlite";
    readonly kind: "real";
    readonly ident: "real";
  };
  blob: {
    readonly dialect: "sqlite";
    readonly kind: "blob";
    readonly ident: "blob";
    readonly mode: BlobMode;
  };
  numeric: {
    readonly dialect: "sqlite";
    readonly kind: "numeric";
    readonly ident: "numeric";
    readonly mode: NumericMode;
  };
};

/** Complete internal SQLite descriptor algebra. */
export type Spec = TaggedEnum<SpecDefinition>;

export type Text<Mode extends TextMode = TextMode> = Omit<
  Extract<Spec, { readonly _tag: "text" }>,
  "mode"
> & { readonly mode: Mode };
export type Enum<Value extends string = string> = Omit<
  Extract<Spec, { readonly _tag: "enum" }>,
  "values"
> & { readonly values: readonly [Value, ...Value[]] };
export type Integer<
  Mode extends IntegerMode = IntegerMode,
  Ident extends "integer" | EntityIdIdent<string> = "integer" | EntityIdIdent<string>,
> = Omit<Extract<Spec, { readonly _tag: "integer" }>, "ident" | "mode"> & {
  readonly ident: Ident;
  readonly mode: Mode;
};
export type Real = Extract<Spec, { readonly _tag: "real" }>;
export type Blob<Mode extends BlobMode = BlobMode> = Omit<
  Extract<Spec, { readonly _tag: "blob" }>,
  "mode"
> & { readonly mode: Mode };
export type Numeric<Mode extends NumericMode = NumericMode> = Omit<
  Extract<Spec, { readonly _tag: "numeric" }>,
  "mode"
> & { readonly mode: Mode };

/** Broad runtime builder surface used by centralized modifier projection. */
export interface DrizzleBuilder extends ColumnBuilderBase {
  notNull(): DrizzleBuilder;
  primaryKey(config?: { readonly autoIncrement?: boolean }): DrizzleBuilder;
  unique(name?: string): DrizzleBuilder;
  default(value: unknown): DrizzleBuilder;
  generatedAlwaysAs(value: SQL | (() => SQL), config?: { readonly mode?: "virtual" | "stored" }): DrizzleBuilder;
}

const Constructors = taggedEnum<Spec>();
const invariant = (message: string): never => {
  throw ColumnInvariantError.make({ message });
};

function makeText<const Mode extends TextMode>(props: { readonly mode: Mode }): Text<Mode>;
function makeText(props: { readonly mode: TextMode }): Text {
  return Constructors.text({ dialect: "sqlite", kind: "text", ident: "text", ...props });
}
export const Text = assignStatics(
  { make: makeText },
  {
    toDrizzleBuilder: (spec: Text, name: string): SQLiteTextBuilder<[string, ...string[]]> | SQLiteTextJsonBuilder =>
      spec.mode === "json" ? text(name, { mode: "json" }) : text(name),
  },
);

function makeEnum<const Value extends string>(props: {
  readonly values: readonly [Value, ...Value[]];
}): Enum<Value>;
function makeEnum(props: { readonly values: readonly [string, ...string[]] }): Enum {
  return Constructors.enum({
    dialect: "sqlite",
    kind: "enum",
    ident: "text",
    values: props.values,
  });
}
export const Enum = assignStatics(
  { make: makeEnum },
  {
    toDrizzleBuilder: (spec: Enum, name: string): SQLiteTextBuilder<[string, ...string[]]> =>
      text(name, { enum: spec.values }),
  },
);

function makeInteger<
  const Mode extends IntegerMode,
  const Ident extends "integer" | EntityIdIdent<string>,
>(props: { readonly mode: Mode; readonly ident: Ident }): Integer<Mode, Ident>;
function makeInteger(props: {
  readonly mode: IntegerMode;
  readonly ident: "integer" | EntityIdIdent<string>;
}): Integer {
  return Constructors.integer({ dialect: "sqlite", kind: "integer", ...props });
}
export const Integer = assignStatics(
  { make: makeInteger },
  {
    toDrizzleBuilder: (
      spec: Integer,
      name: string,
    ): SQLiteIntegerBuilder | SQLiteBooleanBuilder | SQLiteTimestampBuilder =>
      spec.mode === "boolean"
        ? integer(name, { mode: "boolean" })
        : spec.mode === "timestamp"
          ? integer(name, { mode: "timestamp" })
          : spec.mode === "timestamp_ms"
            ? integer(name, { mode: "timestamp_ms" })
            : integer(name),
  },
);

const fixedReal = Constructors.real({ dialect: "sqlite", kind: "real", ident: "real" });
export const Real = assignStatics(
  { make: (_props: {}) => fixedReal },
  { toDrizzleBuilder: (_spec: Real, name: string): SQLiteRealBuilder => real(name) },
);

function makeBlob<const Mode extends BlobMode>(props: { readonly mode: Mode }): Blob<Mode>;
function makeBlob(props: { readonly mode: BlobMode }): Blob {
  return Constructors.blob({ dialect: "sqlite", kind: "blob", ident: "blob", ...props });
}
export const Blob = assignStatics(
  { make: makeBlob },
  {
    toDrizzleBuilder: (
      spec: Blob,
      name: string,
    ): SQLiteBlobBufferBuilder | SQLiteBlobJsonBuilder | SQLiteBigIntBuilder =>
      spec.mode === "buffer"
        ? blob(name, { mode: "buffer" })
        : spec.mode === "bigint"
          ? blob(name, { mode: "bigint" })
          : blob(name, { mode: "json" }),
  },
);

function makeNumeric<const Mode extends NumericMode>(props: {
  readonly mode: Mode;
}): Numeric<Mode>;
function makeNumeric(props: { readonly mode: NumericMode }): Numeric {
  return Constructors.numeric({ dialect: "sqlite", kind: "numeric", ident: "numeric", ...props });
}
export const Numeric = assignStatics(
  { make: makeNumeric },
  {
    toDrizzleBuilder: (
      spec: Numeric,
      name: string,
    ): SQLiteNumericBuilder | SQLiteNumericNumberBuilder | SQLiteNumericBigIntBuilder =>
      spec.mode === "number"
        ? numeric(name, { mode: "number" })
        : spec.mode === "bigint"
          ? numeric(name, { mode: "bigint" })
          : numeric(name, { mode: "string" }),
  },
);

const knownTags: ReadonlyArray<Spec["_tag"]> = ["text", "enum", "integer", "real", "blob", "numeric"];

/** Cheap full-enough guard for descriptors crossing author-controlled seams. */
export const isSpec = (value: unknown): value is Spec => {
  if (
    !hasProperty(value, "_tag") ||
    !isString(value._tag) ||
    !contains(knownTags, value._tag) ||
    !hasProperty(value, "dialect") ||
    value.dialect !== "sqlite" ||
    !hasProperty(value, "kind") ||
    !isString(value.kind) ||
    !hasProperty(value, "ident") ||
    !isString(value.ident)
  ) return false;
  if (Constructors.$is("text")(value)) return value.mode === "text" || value.mode === "json";
  if (Constructors.$is("enum")(value)) return value.values.length > 0 && value.values.every(isString);
  if (Constructors.$is("integer")(value)) {
    return value.mode === "number" || value.mode === "boolean" || value.mode === "timestamp" || value.mode === "timestamp_ms";
  }
  if (Constructors.$is("real")(value)) return true;
  if (Constructors.$is("blob")(value)) return value.mode === "buffer" || value.mode === "json" || value.mode === "bigint";
  return Constructors.$is("numeric")(value) &&
    (value.mode === "string" || value.mode === "number" || value.mode === "bigint");
};

const fromLiteralAST = matchType<Literal>().pipe(
  withReturnType<Option<Spec>>(),
  matchWhen(StructPredicate({ literal: isString }), () => some(Text.make({ mode: "text" }))),
  matchWhen(StructPredicate({ literal: isNumber }), () => some(Real.make({}))),
  matchWhen(
    StructPredicate({ literal: isBoolean }),
    () => some(Integer.make({ mode: "boolean", ident: "integer" })),
  ),
  matchOrElse(() => none()),
);

const fromSchemaAST = (node: AST, visited: ReadonlyArray<AST> = empty()): Option<Spec> => {
  if (someArray(visited, equals(node))) return none();
  const nextVisited = append(visited, node);
  return matchType<AST>().pipe(
    withReturnType<Option<Spec>>(),
    matchTags({
      String: () => some(Text.make({ mode: "text" })),
      TemplateLiteral: () => some(Text.make({ mode: "text" })),
      Boolean: () => some(Integer.make({ mode: "boolean", ident: "integer" })),
      BigInt: () => some(Blob.make({ mode: "bigint" })),
      Number: () => some(Real.make({})),
      Literal: fromLiteralAST,
      Enum: () => some(Text.make({ mode: "text" })),
      Objects: () => some(Text.make({ mode: "json" })),
      Arrays: () => some(Text.make({ mode: "json" })),
      Suspend: ({ thunk }) => fromSchemaAST(thunk(), nextVisited),
    }),
    matchOrElse(() => none()),
  )(node);
};

const toDrizzleBuilder = dual<
  (name: string) => (spec: Spec) => DrizzleBuilder,
  (spec: Spec, name: string) => DrizzleBuilder
>(
  (args) => isSpec(args[0]),
  (spec: Spec, name: string): DrizzleBuilder =>
    Constructors.$match(spec, {
      text: (self) => Text.toDrizzleBuilder(self, name),
      enum: (self) => Enum.toDrizzleBuilder(self, name),
      integer: (self) => Integer.toDrizzleBuilder(self, name),
      real: (self) => Real.toDrizzleBuilder(self, name),
      blob: (self) => Blob.toDrizzleBuilder(self, name),
      numeric: (self) => Numeric.toDrizzleBuilder(self, name),
    }),
);

/** Guards, exhaustive matching, derivation, and compilation for SQLite specs. */
export const Spec = {
  $is: Constructors.$is,
  $match: Constructors.$match,
  is: isSpec,
  guards: {
    text: Constructors.$is("text"),
    enum: Constructors.$is("enum"),
    integer: Constructors.$is("integer"),
    real: Constructors.$is("real"),
    blob: Constructors.$is("blob"),
    numeric: Constructors.$is("numeric"),
  },
  match: Constructors.$match,
  fromSchemaAST,
  toDrizzleBuilder,
};

/** Encoded carrier represented by a SQLite descriptor. */
export type CarrierOf<C extends Spec> = C extends Text<infer Mode>
  ? Mode extends "json" ? object : string
  : C extends Enum ? string
    : C extends Integer<infer Mode>
      ? Mode extends "boolean" ? boolean : Mode extends "number" ? number : Date
      : C extends Real ? number
        : C extends Blob<infer Mode>
          ? Mode extends "buffer" ? Uint8Array : Mode extends "bigint" ? bigint : object
          : C extends Numeric<infer Mode>
            ? Mode extends "string" ? string : Mode extends "number" ? number : bigint
            : never;

/** Runtime carrier witness used by foreign-key compatibility checks. */
export type CarrierTag = "string" | "number" | "bigint" | "boolean" | "object" | "date" | "bytes";

export const carrierTag = (spec: Spec): CarrierTag =>
  Spec.$match(spec, {
    text: ({ mode }): CarrierTag => mode === "json" ? "object" : "string",
    enum: (): CarrierTag => "string",
    integer: ({ mode }): CarrierTag => mode === "boolean" ? "boolean" : mode === "number" ? "number" : "date",
    real: (): CarrierTag => "number",
    blob: ({ mode }): CarrierTag => mode === "buffer" ? "bytes" : mode === "bigint" ? "bigint" : "object",
    numeric: ({ mode }): CarrierTag => mode,
  });

/** SQLite storage identity used by foreign-key compatibility checks. */
export type StorageIdent<C extends Spec, Dimensions extends ArrayDimension> =
  Dimensions extends 0 ? C["ident"] : never;

export type ArrayCarrier<Carrier, Dimensions extends ArrayDimension> =
  Dimensions extends 0 ? Carrier : never;

export function storageIdent<C extends Spec, Dimensions extends ArrayDimension>(
  spec: C,
  dimensions: Dimensions,
): StorageIdent<C, Dimensions>;
export function storageIdent(spec: Spec, dimensions: ArrayDimension): string {
  if (dimensions !== 0) return invariant("SQLite storage identities cannot carry array dimensions.");
  return spec.ident;
}

/** Runtime carrier witness used by foreign-key compatibility checks. */
export interface Carrier {
  readonly tag: CarrierTag;
  readonly dimensions: 0;
}
export const carrier = (spec: Spec, dimensions: ArrayDimension): Carrier => {
  if (dimensions !== 0) return invariant("SQLite carriers cannot carry array dimensions.");
  return { tag: carrierTag(spec), dimensions };
};
