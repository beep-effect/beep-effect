/**
 * SQLite storage-class descriptors and their colocated Drizzle compilers.
 *
 * @since 0.0.0
 */

// fallow-ignore-file code-duplication -- pg/sqlite are deliberately mirrored dialect implementations; shared logic lives in src/core and the remaining parallelism is per-dialect vocabulary that must evolve independently (doc 14 family; review at next dialect addition)

import { blob, integer, numeric, real, text } from "drizzle-orm/sqlite-core";
import { append, contains, empty, isArray, isReadonlyArrayNonEmpty, some as someArray } from "effect/Array";
import { taggedEnum } from "effect/Data";
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
import { hasProperty, isBoolean, isNumber, isString, Struct as StructPredicate } from "effect/Predicate";
import { String as StringSchema, TaggedError } from "effect/Schema";
import { declaredFieldsEquivalence } from "../core/declaredFieldsEquivalence.ts";
import { assignStatics } from "../internal/statics.ts";
import type { SQL } from "drizzle-orm";
import type { ColumnBuilderBase } from "drizzle-orm/column-builder";
import type {
  SQLiteBigIntBuilder,
  SQLiteBlobBufferBuilder,
  SQLiteBlobJsonBuilder,
  SQLiteBooleanBuilder,
  SQLiteIntegerBuilder,
  SQLiteNumericBigIntBuilder,
  SQLiteNumericNumberBuilder,
  SQLiteRealBuilder,
  SQLiteTextBuilder,
  SQLiteTextJsonBuilder,
  SQLiteTimestampBuilder,
} from "drizzle-orm/sqlite-core";
import type { TaggedEnum } from "effect/Data";
import type { Option } from "effect/Option";
import type { AST, Literal } from "effect/SchemaAST";
import type * as Meta from "../core/Meta.ts";

/** Failure raised when a SQLite descriptor violates its closed shape. */
/** @internal */
class ColumnInvariantError extends TaggedError<ColumnInvariantError>(
  "@beep/effect-drizzle/sqlite/ColumnInvariantError"
)(
  "ColumnInvariantError",
  {
    message: StringSchema,
  },
  {
    description: "A SQLite column descriptor violates its shape invariant.",
    toEquivalence: (typeParameters) => declaredFieldsEquivalence<ColumnInvariantError>(typeParameters),
  }
) {}

/**
 * SQLite number-encoded EntityId storage identity.
 *
 * @category models
 * @since 0.0.0
 */
export type EntityIdIdent<TableName extends string> = `entityId<"${TableName}">`;
/**
 * SQLite scalar depth retained by public storage inference.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ArrayDimension = Meta.ArrayDimension;

/** SQLite text storage modes retained by public field inference. */
type TextMode = "text" | "json";

/**
 * Modes supported by the installed SQLite integer builder.
 *
 * @category models
 * @since 0.0.0
 */
export type IntegerMode = "number" | "boolean" | "timestamp" | "timestamp_ms";

/**
 * Modes supported by the installed SQLite blob builder.
 *
 * @category models
 * @since 0.0.0
 */
export type BlobMode = "buffer" | "json" | "bigint";

/**
 * Modes supported by the installed SQLite numeric builder.
 *
 * @category models
 * @since 0.0.0
 */
export type NumericMode = "number" | "bigint";

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

/**
 * Complete SQLite descriptor algebra exposed through public field inference.
 *
 * @category models
 * @since 0.0.0
 */
export type Spec = TaggedEnum<SpecDefinition>;

/**
 * SQLite text descriptor carried by `text()` fields.
 *
 * @category type-level
 * @since 0.0.0
 */
export type Text<Mode extends TextMode = TextMode> = Omit<Extract<Spec, { readonly _tag: "text" }>, "mode"> & {
  readonly mode: Mode;
};
/**
 * SQLite enum descriptor carried by `enum()` fields.
 *
 * @category type-level
 * @since 0.0.0
 */
export type Enum<Value extends string = string> = Omit<Extract<Spec, { readonly _tag: "enum" }>, "values"> & {
  readonly values: readonly [Value, ...Value[]];
};
/**
 * SQLite integer descriptor carried by `integer()` fields.
 *
 * @category type-level
 * @since 0.0.0
 */
export type Integer<
  Mode extends IntegerMode = IntegerMode,
  Ident extends "integer" | EntityIdIdent<string> = "integer" | EntityIdIdent<string>,
> = Omit<Extract<Spec, { readonly _tag: "integer" }>, "ident" | "mode"> & {
  readonly ident: Ident;
  readonly mode: Mode;
};
/**
 * SQLite real-number descriptor carried by `real()` fields.
 *
 * @category type-level
 * @since 0.0.0
 */
export type Real = Extract<Spec, { readonly _tag: "real" }>;
/**
 * SQLite blob descriptor carried by `blob()` fields.
 *
 * @category type-level
 * @since 0.0.0
 */
export type Blob<Mode extends BlobMode = BlobMode> = Omit<Extract<Spec, { readonly _tag: "blob" }>, "mode"> & {
  readonly mode: Mode;
};
/**
 * SQLite numeric descriptor carried by `numeric()` fields.
 *
 * @category type-level
 * @since 0.0.0
 */
export type Numeric<Mode extends NumericMode = NumericMode> = Omit<
  Extract<Spec, { readonly _tag: "numeric" }>,
  "mode"
> & { readonly mode: Mode };

/**
 * Broad runtime builder surface used by centralized modifier projection.
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export interface DrizzleBuilder extends ColumnBuilderBase {
  default(value: unknown): DrizzleBuilder;
  generatedAlwaysAs(value: SQL | (() => SQL), config?: { readonly mode?: "virtual" | "stored" }): DrizzleBuilder;
  notNull(): DrizzleBuilder;
  primaryKey(config?: { readonly autoIncrement?: boolean }): DrizzleBuilder;
  unique(name?: string): DrizzleBuilder;
}

const Constructors = /* @__PURE__ */ taggedEnum<Spec>();
const invariant = (message: string): never => {
  throw ColumnInvariantError.make({ message });
};

function makeText<const Mode extends TextMode>(props: { readonly mode: Mode }): Text<Mode>;
function makeText(props: { readonly mode: TextMode }): Text {
  return Constructors.text({ dialect: "sqlite", kind: "text", ident: "text", ...props });
}
/**
 * Internal helper `Text`.
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const Text = /* @__PURE__ */ assignStatics(
  { make: makeText },
  {
    toDrizzleBuilder: (spec: Text, name: string): SQLiteTextBuilder<[string, ...string[]]> | SQLiteTextJsonBuilder =>
      spec.mode === "json" ? text(name, { mode: "json" }) : text(name),
  }
);

function makeEnum<const Value extends string>(props: { readonly values: readonly [Value, ...Value[]] }): Enum<Value>;
function makeEnum(props: { readonly values: readonly [string, ...string[]] }): Enum {
  return Constructors.enum({
    dialect: "sqlite",
    kind: "enum",
    ident: "text",
    values: props.values,
  });
}
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
    toDrizzleBuilder: (spec: Enum, name: string): SQLiteTextBuilder<[string, ...string[]]> =>
      text(name, { enum: spec.values }),
  }
);

function makeInteger<const Mode extends IntegerMode, const Ident extends "integer" | EntityIdIdent<string>>(props: {
  readonly mode: Mode;
  readonly ident: Ident;
}): Integer<Mode, Ident>;
function makeInteger(props: {
  readonly mode: IntegerMode;
  readonly ident: "integer" | EntityIdIdent<string>;
}): Integer {
  return Constructors.integer({ dialect: "sqlite", kind: "integer", ...props });
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
    toDrizzleBuilder: (
      spec: Integer,
      name: string
    ): SQLiteIntegerBuilder | SQLiteBooleanBuilder | SQLiteTimestampBuilder =>
      spec.mode === "boolean"
        ? integer(name, { mode: "boolean" })
        : spec.mode === "timestamp"
          ? integer(name, { mode: "timestamp" })
          : spec.mode === "timestamp_ms"
            ? integer(name, { mode: "timestamp_ms" })
            : integer(name),
  }
);

const fixedReal = /* @__PURE__ */ Constructors.real({ dialect: "sqlite", kind: "real", ident: "real" });
/**
 * Internal helper `Real`.
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const Real = /* @__PURE__ */ assignStatics(
  { make: (_props: {}) => fixedReal },
  { toDrizzleBuilder: (_spec: Real, name: string): SQLiteRealBuilder => real(name) }
);

function makeBlob<const Mode extends BlobMode>(props: { readonly mode: Mode }): Blob<Mode>;
function makeBlob(props: { readonly mode: BlobMode }): Blob {
  return Constructors.blob({ dialect: "sqlite", kind: "blob", ident: "blob", ...props });
}
/**
 * Internal helper `Blob`.
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const Blob = /* @__PURE__ */ assignStatics(
  { make: makeBlob },
  {
    toDrizzleBuilder: (
      spec: Blob,
      name: string
    ): SQLiteBlobBufferBuilder | SQLiteBlobJsonBuilder | SQLiteBigIntBuilder =>
      spec.mode === "buffer"
        ? blob(name, { mode: "buffer" })
        : spec.mode === "bigint"
          ? blob(name, { mode: "bigint" })
          : blob(name, { mode: "json" }),
  }
);

function makeNumeric<const Mode extends NumericMode>(props: { readonly mode: Mode }): Numeric<Mode>;
function makeNumeric(props: { readonly mode: NumericMode }): Numeric {
  return Constructors.numeric({ dialect: "sqlite", kind: "numeric", ident: "numeric", ...props });
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
    toDrizzleBuilder: (spec: Numeric, name: string): SQLiteNumericNumberBuilder | SQLiteNumericBigIntBuilder =>
      spec.mode === "number" ? numeric(name, { mode: "number" }) : numeric(name, { mode: "bigint" }),
  }
);

const knownTags: ReadonlyArray<Spec["_tag"]> = ["text", "enum", "integer", "real", "blob", "numeric"];
const isIntegerIdent = (value: string): boolean => value === "integer" || /^entityId<"[^"\n]+">$/.test(value);

/**
 * Cheap full-enough guard for descriptors crossing author-controlled seams.
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
    value.dialect !== "sqlite" ||
    !hasProperty(value, "kind") ||
    value.kind !== value._tag ||
    !hasProperty(value, "ident") ||
    !isString(value.ident)
  )
    return false;
  if (value._tag === "text") {
    return value.ident === "text" && hasProperty(value, "mode") && (value.mode === "text" || value.mode === "json");
  }
  if (value._tag === "enum") {
    return (
      value.ident === "text" &&
      hasProperty(value, "values") &&
      isArray(value.values) &&
      isReadonlyArrayNonEmpty(value.values) &&
      value.values.every(isString)
    );
  }
  if (value._tag === "integer") {
    return (
      isIntegerIdent(value.ident) &&
      hasProperty(value, "mode") &&
      (value.mode === "number" ||
        value.mode === "boolean" ||
        value.mode === "timestamp" ||
        value.mode === "timestamp_ms")
    );
  }
  if (value._tag === "real") return value.ident === "real";
  if (value._tag === "blob") {
    return (
      value.ident === "blob" &&
      hasProperty(value, "mode") &&
      (value.mode === "buffer" || value.mode === "json" || value.mode === "bigint")
    );
  }
  return (
    value.ident === "numeric" && hasProperty(value, "mode") && (value.mode === "number" || value.mode === "bigint")
  );
};

const fromLiteralAST = /* @__PURE__ */ (() =>
  matchType<Literal>().pipe(
    withReturnType<Option<Spec>>(),
    matchWhen(StructPredicate({ literal: isString }), () => some(Text.make({ mode: "text" }))),
    matchWhen(StructPredicate({ literal: isNumber }), () => some(Real.make({}))),
    matchWhen(StructPredicate({ literal: isBoolean }), () => some(Integer.make({ mode: "boolean", ident: "integer" }))),
    matchOrElse(() => none())
  ))();

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
    matchOrElse(() => none())
  )(node);
};

const toDrizzleBuilder = /* @__PURE__ */ dual<
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
    })
);

/**
 * Guards, exhaustive matching, derivation, and compilation for SQLite specs.
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
    enum: Constructors.$is("enum"),
    integer: Constructors.$is("integer"),
    real: Constructors.$is("real"),
    blob: Constructors.$is("blob"),
    numeric: Constructors.$is("numeric"),
  },
  match: Constructors.$match,
  fromSchemaAST,
  toDrizzleBuilder,
}))();

/**
 * Encoded carrier represented by a SQLite descriptor.
 *
 * @category models
 * @since 0.0.0
 */
export type CarrierOf<C extends Spec> =
  C extends Text<infer Mode>
    ? Mode extends "json"
      ? object
      : string
    : C extends Enum
      ? string
      : C extends Integer<infer Mode>
        ? Mode extends "boolean"
          ? boolean
          : Mode extends "number"
            ? number
            : Date
        : C extends Real
          ? number
          : C extends Blob<infer Mode>
            ? Mode extends "buffer"
              ? Uint8Array
              : Mode extends "bigint"
                ? bigint
                : object
            : C extends Numeric<infer Mode>
              ? Mode extends "string"
                ? string
                : Mode extends "number"
                  ? number
                  : bigint
              : never;

/** Runtime carrier witness used by foreign-key compatibility checks. */
/** @internal */
type CarrierTag = "string" | "number" | "bigint" | "boolean" | "object" | "date" | "bytes";

/** @internal */
const carrierTag = (spec: Spec): CarrierTag =>
  Spec.$match(spec, {
    text: ({ mode }): CarrierTag => (mode === "json" ? "object" : "string"),
    enum: (): CarrierTag => "string",
    integer: ({ mode }): CarrierTag => (mode === "boolean" ? "boolean" : mode === "number" ? "number" : "date"),
    real: (): CarrierTag => "number",
    blob: ({ mode }): CarrierTag => (mode === "buffer" ? "bytes" : mode === "bigint" ? "bigint" : "object"),
    numeric: ({ mode }): CarrierTag => mode,
  });

/**
 * SQLite storage identity used by foreign-key compatibility checks.
 *
 * @category models
 * @since 0.0.0
 */
export type StorageIdent<C extends Spec, Dimensions extends ArrayDimension> = Dimensions extends 0 ? C["ident"] : never;

/**
 * Encoded carrier accepted by SQLite's scalar-only storage model.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ArrayCarrier<Carrier, Dimensions extends ArrayDimension> = Dimensions extends 0 ? Carrier : never;

/**
 * Internal helper `storageIdent`.
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export function storageIdent<Dimensions extends ArrayDimension>(
  dimensions: Dimensions
): <C extends Spec>(spec: C) => StorageIdent<C, Dimensions>;
export function storageIdent<C extends Spec, Dimensions extends ArrayDimension>(
  spec: C,
  dimensions: Dimensions
): StorageIdent<C, Dimensions>;
export function storageIdent(
  ...args: readonly [dimensions: ArrayDimension] | readonly [spec: Spec, dimensions: ArrayDimension]
): string | ((spec: Spec) => string) {
  if (args.length === 1) {
    return (spec: Spec) => storageIdent(spec, args[0]);
  }
  const [spec, dimensions] = args;
  if (dimensions !== 0) return invariant("SQLite storage identities cannot carry array dimensions.");
  return spec.ident;
}

/**
 * Runtime carrier witness used by foreign-key compatibility checks.
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export interface Carrier {
  readonly dimensions: 0;
  readonly tag: CarrierTag;
}
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
  if (dimensions !== 0) return invariant("SQLite carriers cannot carry array dimensions.");
  return { tag: carrierTag(spec), dimensions };
}
