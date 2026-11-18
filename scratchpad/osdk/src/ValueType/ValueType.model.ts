/**
 * Value types: named, versioned, reusable constrained base types that properties reference by API name.
 *
 * **Details**
 *
 * A property that says `valueTypeApiName: "emailAddress"` inherits a base type
 * and a list of constraints that were declared once. OSDK surfaces only the
 * name. The wire carries the whole definition in three parts, and this module
 * keeps them apart: the base type ({@link ValueTypeFieldType}, a recursive union
 * of 18 tags), the constraints ({@link ValueTypeConstraint}, a union of 9 that
 * recurses through its array case) and the record that names and versions the
 * pair ({@link OntologyValueType}).
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit, MappedLiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Tuple from "effect/Tuple";
import {
  BinaryType,
  BooleanType,
  ByteType,
  DateType,
  DoubleType,
  FloatType,
  IntegerType,
  LongType,
  ShortType,
  StringType,
  TimestampType,
  UnsupportedType,
} from "../DataType/DataType.model.ts";
import { ValueTypeKind } from "../DataType/DataType.values.ts";
import { PropertyApiName, ValueTypeApiName, ValueTypeRid } from "../Identifier/Identifier.model.ts";
import { RecursiveArraySizeHint } from "../internal/RecursionHint.ts";
import { ScalarValue } from "../Value/Value.model.ts";

const $I = $ScratchpadId.create("osdk/ValueType/ValueType.model");

const suspendedFieldType = S.suspend((): S.Codec<ValueTypeFieldType, ValueTypeFieldType.Encoded> => ValueTypeFieldType);

const suspendedConstraint = S.suspend(
  (): S.Codec<ValueTypeConstraint, ValueTypeConstraint.Encoded> => ValueTypeConstraint
);

// -----------------------------------------------------------------------------
// Names and versions
// -----------------------------------------------------------------------------

/**
 * Name of a field inside a struct base type.
 *
 * **Details**
 *
 * This is the platform's dataset-level field name, which the wire keeps
 * distinct from the ontology's struct field API name. A struct value type and
 * a query struct both use it.
 *
 * **Example** (Brand a struct field name)
 *
 * ```ts import.meta.vitest name="Brand a struct field name"
 * import * as S from "effect/Schema"
 * import { StructFieldName } from "@beep/scratchpad/osdk/src/ValueType/index"
 *
 * const isFieldName = S.is(StructFieldName)
 * const verdicts = [isFieldName("street"), isFieldName("")]
 * verdicts // => [true, false]
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const StructFieldName = S.NonEmptyString.pipe(
  S.brand("StructFieldName"),
  $I.annoteSchema("StructFieldName", {
    description: "Name of a field inside a struct base type, as the platform's dataset layer spells it.",
  })
);

/**
 * Runtime type of {@link StructFieldName}.
 *
 * @category identifiers
 * @since 0.0.0
 */
export type StructFieldName = typeof StructFieldName.Type;

/**
 * Version label of a value type.
 *
 * **Details**
 *
 * Authoring tools write a semantic version here, but the wire only promises a
 * string, so the codec asks for nothing more than a non-empty label.
 *
 * **Example** (Brand a value type version)
 *
 * ```ts import.meta.vitest name="Brand a value type version"
 * import * as S from "effect/Schema"
 * import { ValueTypeVersion } from "@beep/scratchpad/osdk/src/ValueType/index"
 *
 * const isVersion = S.is(ValueTypeVersion)
 * const verdicts = [isVersion("1.0.0"), isVersion("draft"), isVersion("")]
 * verdicts // => [true, true, false]
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const ValueTypeVersion = S.NonEmptyString.pipe(
  S.brand("ValueTypeVersion"),
  $I.annoteSchema("ValueTypeVersion", {
    description: "Version label of a value type; a semantic version by authoring convention only.",
  })
);

/**
 * Runtime type of {@link ValueTypeVersion}.
 *
 * @category identifiers
 * @since 0.0.0
 */
export type ValueTypeVersion = typeof ValueTypeVersion.Type;

/**
 * Whether a value type is in normal use or scheduled for removal.
 *
 * **Example** (Decode the wire status into its literal)
 *
 * ```ts import.meta.vitest name="Decode the wire status into its literal"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { ValueTypeStatus } from "@beep/scratchpad/osdk/src/ValueType/index"
 *
 * const status = await Effect.runPromise(S.decodeUnknownEffect(ValueTypeStatus)("DEPRECATED"))
 * status // => "deprecated"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ValueTypeStatus = MappedLiteralKit([
  ["ACTIVE", "active"],
  ["DEPRECATED", "deprecated"],
]).pipe(
  $I.annoteSchema("ValueTypeStatus", {
    description: "Whether a value type is in normal use or scheduled for removal.",
  })
);

/**
 * Runtime type of {@link ValueTypeStatus}.
 *
 * @category models
 * @since 0.0.0
 */
export type ValueTypeStatus = typeof ValueTypeStatus.Type;

// -----------------------------------------------------------------------------
// Base types declared by the value-type universe
// -----------------------------------------------------------------------------

/**
 * Base type of an arbitrary-precision decimal.
 *
 * **Details**
 *
 * The property universe's decimal tag carries an optional precision and scale.
 * This one declares neither, so it is its own record instead of a reuse of the
 * shared tag: a value built here can never encode keys the wire does not have.
 *
 * @category models
 * @since 0.0.0
 */
export class ValueTypeDecimal extends S.Opaque<ValueTypeDecimal, { readonly brand: unique symbol }>()(
  S.Struct({ type: S.tag("decimal") }).pipe(
    $I.annoteSchema("ValueTypeDecimal", {
      description: "Base type of an arbitrary-precision decimal, with no precision or scale of its own.",
    })
  )
) {}

/**
 * Base type of a homogeneous list.
 *
 * **Details**
 *
 * The wire key is `subType`; here it is `elementType`, as in every other
 * universe. The wire leaves the key optional, so an array of unstated elements
 * decodes with no element type.
 *
 * @category models
 * @since 0.0.0
 */
export class ValueTypeArray extends S.Opaque<ValueTypeArray, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("array"),
    elementType: S.OptionFromOptionalKey(suspendedFieldType).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Base type of every element, when the platform states it." })
    ),
  }).pipe(
    S.encodeKeys({ elementType: "subType" }),
    $I.annoteSchema("ValueTypeArray", { description: "Base type of a homogeneous list." })
  )
) {}

/**
 * Companion namespace for {@link ValueTypeArray}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ValueTypeArray {
  /**
   * Encoded form of {@link ValueTypeArray}, declared explicitly because the type is recursive.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "array";
    readonly subType?: ValueTypeFieldType.Encoded;
  }
}

/**
 * Base type of a dictionary from keys of one base type to values of another.
 *
 * @category models
 * @since 0.0.0
 */
export class ValueTypeMap extends S.Opaque<ValueTypeMap, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("map"),
    keyType: S.OptionFromOptionalKey(suspendedFieldType).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Base type of every key, when the platform states it." })
    ),
    valueType: S.OptionFromOptionalKey(suspendedFieldType).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Base type of every value, when the platform states it." })
    ),
  }).pipe(
    $I.annoteSchema("ValueTypeMap", {
      description: "Base type of a dictionary from keys of one base type to values of another.",
    })
  )
) {}

/**
 * Companion namespace for {@link ValueTypeMap}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ValueTypeMap {
  /**
   * Encoded form of {@link ValueTypeMap}, declared explicitly because the type is recursive.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "map";
    readonly keyType?: ValueTypeFieldType.Encoded;
    readonly valueType?: ValueTypeFieldType.Encoded;
  }
}

/**
 * One field of a struct base type: a name and the base type of its value.
 *
 * **Gotchas**
 *
 * The wire leaves both keys optional, unlike a query struct field, so a field
 * can arrive without a name or without a type and still decode.
 *
 * @category models
 * @since 0.0.0
 */
export class ValueTypeStructField extends S.Opaque<ValueTypeStructField, { readonly brand: unique symbol }>()(
  S.Struct({
    name: S.OptionFromOptionalKey(StructFieldName).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Name of the field within its struct, when the platform states it." })
    ),
    fieldType: S.OptionFromOptionalKey(suspendedFieldType).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Base type of the field's value, when the platform states it." })
    ),
  }).pipe(
    $I.annoteSchema("ValueTypeStructField", {
      description: "One field of a struct base type: a name and the base type of its value.",
    })
  )
) {}

/**
 * Companion namespace for {@link ValueTypeStructField}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ValueTypeStructField {
  /**
   * Encoded form of {@link ValueTypeStructField}, declared explicitly because the type is recursive.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly name?: string;
    readonly fieldType?: ValueTypeFieldType.Encoded;
  }
}

/**
 * Base type of a record with named, individually typed fields.
 *
 * @category models
 * @since 0.0.0
 */
export class ValueTypeStruct extends S.Opaque<ValueTypeStruct, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("struct"),
    fields: S.Array(ValueTypeStructField)
      .check(RecursiveArraySizeHint)
      .annotateKey({ description: "Fields of the struct, in declaration order." }),
  }).pipe(
    $I.annoteSchema("ValueTypeStruct", {
      description: "Base type of a record with named, individually typed fields.",
    })
  )
) {}

/**
 * Companion namespace for {@link ValueTypeStruct}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ValueTypeStruct {
  /**
   * Encoded form of {@link ValueTypeStruct}, declared explicitly because the type is recursive.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "struct";
    readonly fields: ReadonlyArray<ValueTypeStructField.Encoded>;
  }
}

/**
 * Base type of a value that is exactly one of several base types.
 *
 * @category models
 * @since 0.0.0
 */
export class ValueTypeUnion extends S.Opaque<ValueTypeUnion, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("union"),
    memberTypes: S.Array(suspendedFieldType)
      .check(RecursiveArraySizeHint)
      .annotateKey({ description: "Base types a value may take, in declaration order." }),
  }).pipe(
    $I.annoteSchema("ValueTypeUnion", {
      description: "Base type of a value that is exactly one of several base types.",
    })
  )
) {}

/**
 * Companion namespace for {@link ValueTypeUnion}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ValueTypeUnion {
  /**
   * Encoded form of {@link ValueTypeUnion}, declared explicitly because the type is recursive.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "union";
    readonly memberTypes: ReadonlyArray<ValueTypeFieldType.Encoded>;
  }
}

/**
 * Base type of a value that may be absent.
 *
 * @category models
 * @since 0.0.0
 */
export class ValueTypeOptional extends S.Opaque<ValueTypeOptional, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("optional"),
    wrappedType: S.OptionFromOptionalKey(suspendedFieldType).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Base type of the value when it is present, when the platform states it." })
    ),
  }).pipe($I.annoteSchema("ValueTypeOptional", { description: "Base type of a value that may be absent." }))
) {}

/**
 * Companion namespace for {@link ValueTypeOptional}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ValueTypeOptional {
  /**
   * Encoded form of {@link ValueTypeOptional}, declared explicitly because the type is recursive.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "optional";
    readonly wrappedType?: ValueTypeFieldType.Encoded;
  }
}

/**
 * Base type that points at another value type without saying which.
 *
 * **Gotchas**
 *
 * The wire record is empty: it has no field naming the referenced value type,
 * so the target cannot be resolved from this descriptor alone.
 *
 * @category models
 * @since 0.0.0
 */
export class ValueTypeReference extends S.Opaque<ValueTypeReference, { readonly brand: unique symbol }>()(
  S.Struct({ type: S.tag("reference") }).pipe(
    $I.annoteSchema("ValueTypeReference", {
      description: "Base type that points at another value type; the wire does not name the target.",
    })
  )
) {}

// -----------------------------------------------------------------------------
// The base type union
// -----------------------------------------------------------------------------

/**
 * The base type a value type constrains: 12 scalars, 5 composites that nest freely and a reference.
 *
 * **Details**
 *
 * Eleven scalar tags are the kernel's shared records. The decimal, the five
 * composites and the reference are declared here because their payloads
 * belong to this universe alone. Every child type is optional on the wire, so
 * every child is an `Option` here.
 *
 * **Example** (Tell composite base types from scalar ones)
 *
 * ```ts import.meta.vitest name="Tell composite base types from scalar ones"
 * import * as O from "effect/Option"
 * import { StringType } from "@beep/scratchpad/osdk/src/DataType/index"
 * import { ValueTypeArray, ValueTypeFieldType } from "@beep/scratchpad/osdk/src/ValueType/index"
 *
 * const isComposite = ValueTypeFieldType.isAnyOf(["array", "map", "struct", "union", "optional"])
 * const tags = ValueTypeArray.make({ elementType: O.some(StringType.make({})) })
 * const verdicts = [isComposite(tags), isComposite(StringType.make({})), ValueTypeFieldType.guards.array(tags)]
 * verdicts // => [true, false, true]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ValueTypeFieldType = ValueTypeKind.mapMembers(() =>
  Tuple.make(
    BooleanType,
    ByteType,
    ShortType,
    IntegerType,
    LongType,
    FloatType,
    DoubleType,
    ValueTypeDecimal,
    StringType,
    DateType,
    TimestampType,
    BinaryType,
    ValueTypeArray,
    ValueTypeMap,
    ValueTypeStruct,
    ValueTypeUnion,
    ValueTypeOptional,
    ValueTypeReference
  )
).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("ValueTypeFieldType", {
    description: "The base type a value type constrains: scalars, composites that nest freely and a reference.",
  })
);

/**
 * Runtime type of {@link ValueTypeFieldType}.
 *
 * @category models
 * @since 0.0.0
 */
export type ValueTypeFieldType =
  | BooleanType
  | ByteType
  | ShortType
  | IntegerType
  | LongType
  | FloatType
  | DoubleType
  | ValueTypeDecimal
  | StringType
  | DateType
  | TimestampType
  | BinaryType
  | ValueTypeArray
  | ValueTypeMap
  | ValueTypeStruct
  | ValueTypeUnion
  | ValueTypeOptional
  | ValueTypeReference;

/**
 * Companion namespace for {@link ValueTypeFieldType}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ValueTypeFieldType {
  /**
   * Encoded (wire) form of {@link ValueTypeFieldType}, declared explicitly because the union is recursive.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded =
    | (typeof BooleanType)["Encoded"]
    | (typeof ByteType)["Encoded"]
    | (typeof ShortType)["Encoded"]
    | (typeof IntegerType)["Encoded"]
    | (typeof LongType)["Encoded"]
    | (typeof FloatType)["Encoded"]
    | (typeof DoubleType)["Encoded"]
    | (typeof ValueTypeDecimal)["Encoded"]
    | (typeof StringType)["Encoded"]
    | (typeof DateType)["Encoded"]
    | (typeof TimestampType)["Encoded"]
    | (typeof BinaryType)["Encoded"]
    | ValueTypeArray.Encoded
    | ValueTypeMap.Encoded
    | ValueTypeStruct.Encoded
    | ValueTypeUnion.Encoded
    | ValueTypeOptional.Encoded
    | (typeof ValueTypeReference)["Encoded"];
}

// -----------------------------------------------------------------------------
// Constraints
// -----------------------------------------------------------------------------

/**
 * The kinds of rule a value type can place on its base type.
 *
 * **Example** (List the constraint kinds in wire order)
 *
 * ```ts import.meta.vitest name="List the constraint kinds in wire order"
 * import { ValueTypeConstraintKind } from "@beep/scratchpad/osdk/src/ValueType/index"
 *
 * const kinds = ValueTypeConstraintKind.literals
 * kinds // => ["struct", "regex", "unsupported", "array", "length", "range", "rid", "uuid", "enum"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ValueTypeConstraintKind = LiteralKit([
  "struct",
  "regex",
  "unsupported",
  "array",
  "length",
  "range",
  "rid",
  "uuid",
  "enum",
]).pipe(
  $I.annoteSchema("ValueTypeConstraintKind", {
    description: "The kinds of rule a value type can place on its base type.",
  })
);

/**
 * Runtime type of {@link ValueTypeConstraintKind}.
 *
 * @category models
 * @since 0.0.0
 */
export type ValueTypeConstraintKind = typeof ValueTypeConstraintKind.Type;

/**
 * Requires each named field of a struct to conform to a value type of its own.
 *
 * **Details**
 *
 * The wire brands the keys as property API names even though they name the
 * fields of the struct being constrained; the brand is kept as the wire has it.
 *
 * @category models
 * @since 0.0.0
 */
export class StructConstraint extends S.Opaque<StructConstraint, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("struct"),
    properties: S.Record(PropertyApiName, ValueTypeApiName).annotateKey({
      description: "Value type each named field must conform to.",
    }),
  }).pipe(
    $I.annoteSchema("StructConstraint", {
      description: "Requires each named field of a struct to conform to a value type of its own.",
    })
  )
) {}

/**
 * Requires text to match a regular expression, wholly or in part.
 *
 * @category models
 * @since 0.0.0
 */
export class RegexConstraint extends S.Opaque<RegexConstraint, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("regex"),
    pattern: S.String.annotateKey({ description: "Regular expression the text is tested against." }),
    partialMatch: S.Boolean.annotateKey({
      description: "Whether a match anywhere in the text is enough; otherwise the whole text must match.",
    }),
  }).pipe(
    $I.annoteSchema("RegexConstraint", {
      description: "Requires text to match a regular expression, wholly or in part.",
    })
  )
) {}

/**
 * Bounds how many elements a list holds, whether they repeat, and what each element must satisfy.
 *
 * @category models
 * @since 0.0.0
 */
export class ArrayConstraint extends S.Opaque<ArrayConstraint, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("array"),
    minimumSize: S.OptionFromOptionalKey(S.Natural).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Fewest elements the list may hold, inclusive." })
    ),
    maximumSize: S.OptionFromOptionalKey(S.Natural).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Most elements the list may hold, inclusive." })
    ),
    uniqueValues: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(false)),
      S.annotateKey({ description: "Whether no two elements may be equal." })
    ),
    valueConstraint: S.OptionFromOptionalKey(suspendedConstraint).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Rule every element must satisfy." })
    ),
  }).pipe(
    $I.annoteSchema("ArrayConstraint", {
      description: "Bounds how many elements a list holds, whether they repeat, and what each must satisfy.",
    })
  )
) {}

/**
 * Companion namespace for {@link ArrayConstraint}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ArrayConstraint {
  /**
   * Encoded form of {@link ArrayConstraint}, declared explicitly because the constraint is recursive.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "array";
    readonly minimumSize?: number;
    readonly maximumSize?: number;
    readonly uniqueValues: boolean;
    readonly valueConstraint?: ValueTypeConstraint.Encoded;
  }
}

/**
 * Bounds the length of a value, both ends inclusive.
 *
 * **Example** (Bound a length from one side or both)
 *
 * ```ts import.meta.vitest name="Bound a length from one side or both"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { LengthConstraint } from "@beep/scratchpad/osdk/src/ValueType/index"
 *
 * const encode = S.encodeEffect(LengthConstraint)
 * const wire = await Effect.runPromise(
 *   Effect.all([encode(LengthConstraint.atLeast(1)), encode(LengthConstraint.exactly(2))])
 * )
 * wire // => [{ type: "length", minimumLength: 1 }, { type: "length", minimumLength: 2, maximumLength: 2 }]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LengthConstraint extends S.Opaque<LengthConstraint, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("length"),
    minimumLength: S.OptionFromOptionalKey(S.Natural).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Shortest length a value may have, inclusive." })
    ),
    maximumLength: S.OptionFromOptionalKey(S.Natural).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Longest length a value may have, inclusive." })
    ),
  }).pipe($I.annoteSchema("LengthConstraint", { description: "Bounds the length of a value, both ends inclusive." }))
) {
  /**
   * A length of `minimum` or more.
   *
   * @throws When `minimum` is negative or not a whole number.
   * @category constructors
   * @since 0.0.0
   */
  static atLeast(minimum: number): LengthConstraint {
    return LengthConstraint.make({ minimumLength: O.some(minimum) });
  }

  /**
   * A length of `maximum` or less.
   *
   * @throws When `maximum` is negative or not a whole number.
   * @category constructors
   * @since 0.0.0
   */
  static atMost(maximum: number): LengthConstraint {
    return LengthConstraint.make({ maximumLength: O.some(maximum) });
  }

  /**
   * A length from `minimum` to `maximum`, both inclusive.
   *
   * @throws When either bound is negative or not a whole number.
   * @category constructors
   * @since 0.0.0
   */
  static between(minimum: number, maximum: number): LengthConstraint {
    return LengthConstraint.make({ minimumLength: O.some(minimum), maximumLength: O.some(maximum) });
  }

  /**
   * A length of exactly `length`.
   *
   * @throws When `length` is negative or not a whole number.
   * @category constructors
   * @since 0.0.0
   */
  static exactly(length: number): LengthConstraint {
    return LengthConstraint.between(length, length);
  }
}

/**
 * Bounds a value from below, from above or both, each end inclusive.
 *
 * **Details**
 *
 * The wire types the bounds as `any`. They are scalars of the value type's
 * base type, held here as the wire scalar that carries them (text, number or
 * boolean): a bound on a 64-bit integer, a decimal, a date or an instant is the
 * text it travels as. The wire calls this record `RangesConstraint`, although
 * it holds one range.
 *
 * **Example** (Bound a value from one side or both)
 *
 * ```ts import.meta.vitest name="Bound a value from one side or both"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { ValueRangeConstraint } from "@beep/scratchpad/osdk/src/ValueType/index"
 *
 * const encode = S.encodeEffect(ValueRangeConstraint)
 * const wire = await Effect.runPromise(
 *   Effect.all([encode(ValueRangeConstraint.atLeast(0)), encode(ValueRangeConstraint.between("2020", "2029"))])
 * )
 * wire // => [{ type: "range", minimumValue: 0 }, { type: "range", minimumValue: "2020", maximumValue: "2029" }]
 * ```
 *
 * @invariant At least one of the two bounds is present.
 * @category models
 * @since 0.0.0
 */
export class ValueRangeConstraint extends S.Opaque<ValueRangeConstraint, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("range"),
    minimumValue: S.OptionFromOptionalKey(ScalarValue).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Smallest value allowed, inclusive." })
    ),
    maximumValue: S.OptionFromOptionalKey(ScalarValue).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Largest value allowed, inclusive." })
    ),
  })
    .check(
      S.makeFilter(
        ({ minimumValue, maximumValue }) => O.isSome(minimumValue) || O.isSome(maximumValue),
        $I.annote("ValueRangeBoundCheck", {
          title: "Value Range Bound",
          description: "A range that states a smallest value, a largest value or both.",
          expected: "a range with at least one bound",
          message: "A range constraint needs a minimum value, a maximum value or both",
        })
      )
    )
    .pipe(
      $I.annoteSchema("ValueRangeConstraint", {
        description: "Bounds a value from below, from above or both, each end inclusive.",
      })
    )
) {
  /**
   * Values of `minimum` or more.
   *
   * @category constructors
   * @since 0.0.0
   */
  static atLeast(minimum: ScalarValue): ValueRangeConstraint {
    return ValueRangeConstraint.make({ minimumValue: O.some(minimum) });
  }

  /**
   * Values of `maximum` or less.
   *
   * @category constructors
   * @since 0.0.0
   */
  static atMost(maximum: ScalarValue): ValueRangeConstraint {
    return ValueRangeConstraint.make({ maximumValue: O.some(maximum) });
  }

  /**
   * Values from `minimum` to `maximum`, both inclusive.
   *
   * @category constructors
   * @since 0.0.0
   */
  static between(minimum: ScalarValue, maximum: ScalarValue): ValueRangeConstraint {
    return ValueRangeConstraint.make({ minimumValue: O.some(minimum), maximumValue: O.some(maximum) });
  }
}

/**
 * Requires text to be a well-formed resource identifier.
 *
 * @category models
 * @since 0.0.0
 */
export class RidConstraint extends S.Opaque<RidConstraint, { readonly brand: unique symbol }>()(
  S.Struct({ type: S.tag("rid") }).pipe(
    $I.annoteSchema("RidConstraint", { description: "Requires text to be a well-formed resource identifier." })
  )
) {}

/**
 * Requires text to be a well-formed universally unique identifier.
 *
 * @category models
 * @since 0.0.0
 */
export class UuidConstraint extends S.Opaque<UuidConstraint, { readonly brand: unique symbol }>()(
  S.Struct({ type: S.tag("uuid") }).pipe(
    $I.annoteSchema("UuidConstraint", {
      description: "Requires text to be a well-formed universally unique identifier.",
    })
  )
) {}

/**
 * Requires a value to be one of a fixed list of options.
 *
 * **Details**
 *
 * The wire allows a `null` entry, which means that having no value is itself
 * an allowed option. Here that entry is `None`, so the scalar options stay
 * free of a null case.
 *
 * @category models
 * @since 0.0.0
 */
export class EnumConstraint extends S.Opaque<EnumConstraint, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("enum"),
    options: ScalarValue.pipe(
      S.OptionFromNullOr,
      S.Array,
      S.annotateKey({ description: "Allowed values; an absent entry means that having no value is allowed." })
    ),
  }).pipe(
    $I.annoteSchema("EnumConstraint", { description: "Requires a value to be one of a fixed list of options." })
  )
) {}

/**
 * A rule a value type places on values of its base type.
 *
 * **Details**
 *
 * Nine kinds, in the wire's own order. `unsupported` is the kernel's escape
 * record: it keeps a constraint this contract does not model instead of
 * failing the whole value type. Only `array` recurses, through the rule it
 * places on each element.
 *
 * **Example** (Describe a constraint with one exhaustive match)
 *
 * ```ts import.meta.vitest name="Describe a constraint with one exhaustive match"
 * import * as A from "effect/Array"
 * import * as O from "effect/Option"
 * import {
 *   ArrayConstraint,
 *   LengthConstraint,
 *   UuidConstraint,
 *   ValueTypeConstraint,
 * } from "@beep/scratchpad/osdk/src/ValueType/index"
 *
 * const describe: (constraint: ValueTypeConstraint) => string = ValueTypeConstraint.match({
 *   struct: () => "fields conform to value types",
 *   regex: ({ pattern }) => `matches ${pattern}`,
 *   unsupported: ({ unsupportedType }) => `unmodelled (${unsupportedType})`,
 *   array: ({ valueConstraint }) => `each: ${O.match(valueConstraint, { onNone: () => "any", onSome: describe })}`,
 *   length: () => "bounded length",
 *   range: () => "bounded value",
 *   rid: () => "a resource identifier",
 *   uuid: () => "a UUID",
 *   enum: ({ options }) => `one of ${options.length}`,
 * })
 * const rules = [
 *   ArrayConstraint.make({ valueConstraint: O.some(UuidConstraint.make({})) }),
 *   LengthConstraint.atMost(8),
 * ]
 * const sentences = A.map(rules, describe)
 * sentences // => ["each: a UUID", "bounded length"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ValueTypeConstraint = ValueTypeConstraintKind.mapMembers(() =>
  Tuple.make(
    StructConstraint,
    RegexConstraint,
    UnsupportedType,
    ArrayConstraint,
    LengthConstraint,
    ValueRangeConstraint,
    RidConstraint,
    UuidConstraint,
    EnumConstraint
  )
).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("ValueTypeConstraint", {
    description: "A rule a value type places on values of its base type.",
  })
);

/**
 * Runtime type of {@link ValueTypeConstraint}.
 *
 * @category models
 * @since 0.0.0
 */
export type ValueTypeConstraint =
  | StructConstraint
  | RegexConstraint
  | UnsupportedType
  | ArrayConstraint
  | LengthConstraint
  | ValueRangeConstraint
  | RidConstraint
  | UuidConstraint
  | EnumConstraint;

/**
 * Companion namespace for {@link ValueTypeConstraint}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ValueTypeConstraint {
  /**
   * Encoded (wire) form of {@link ValueTypeConstraint}, declared explicitly because the union is recursive.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded =
    | (typeof StructConstraint)["Encoded"]
    | (typeof RegexConstraint)["Encoded"]
    | (typeof UnsupportedType)["Encoded"]
    | ArrayConstraint.Encoded
    | (typeof LengthConstraint)["Encoded"]
    | (typeof ValueRangeConstraint)["Encoded"]
    | (typeof RidConstraint)["Encoded"]
    | (typeof UuidConstraint)["Encoded"]
    | (typeof EnumConstraint)["Encoded"];
}

// -----------------------------------------------------------------------------
// The value type record
// -----------------------------------------------------------------------------

/**
 * A value type as the ontology exposes it: a named, versioned base type together with its constraints.
 *
 * **Details**
 *
 * A property opts in by naming the value type (`valueTypeApiName`); the
 * ontology metadata then lists this record under the same API name. Every
 * constraint applies at once: a value conforms when it satisfies all of them.
 *
 * **Example** (Declare a constrained text type)
 *
 * ```ts import.meta.vitest name="Declare a constrained text type"
 * import * as O from "effect/Option"
 * import { StringType } from "@beep/scratchpad/osdk/src/DataType/index"
 * import { ValueTypeApiName, ValueTypeRid } from "@beep/scratchpad/osdk/src/Identifier/index"
 * import {
 *   LengthConstraint,
 *   OntologyValueType,
 *   RegexConstraint,
 *   ValueTypeVersion,
 * } from "@beep/scratchpad/osdk/src/ValueType/index"
 *
 * const emailAddress = OntologyValueType.make({
 *   apiName: ValueTypeApiName.make("emailAddress"),
 *   displayName: "Email address",
 *   rid: ValueTypeRid.make("ri.ontology.main.value-type.email-address"),
 *   fieldType: StringType.make({}),
 *   version: ValueTypeVersion.make("1.0.0"),
 *   constraints: [LengthConstraint.atMost(254), RegexConstraint.make({ pattern: "^.+@.+$", partialMatch: false })],
 * })
 * const summary = [emailAddress.fieldType.type, emailAddress.constraints.length, O.isNone(emailAddress.status)]
 * summary // => ["string", 2, true]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OntologyValueType extends S.Opaque<OntologyValueType, { readonly brand: unique symbol }>()(
  S.Struct({
    apiName: ValueTypeApiName.annotateKey({ description: "Name under which properties reference the value type." }),
    displayName: S.String.annotateKey({ description: "Human-readable name." }),
    description: S.OptionFromOptionalKey(S.String).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "What values of this type mean." })
    ),
    rid: ValueTypeRid.annotateKey({ description: "Resource identifier of the value type." }),
    status: S.OptionFromOptionalKey(ValueTypeStatus).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Lifecycle status, when the ontology exposes it." })
    ),
    fieldType: ValueTypeFieldType.annotateKey({ description: "Base type the constraints narrow." }),
    version: ValueTypeVersion.annotateKey({ description: "Version of this definition of the value type." }),
    constraints: S.Array(ValueTypeConstraint).pipe(
      S.withConstructorDefault(Effect.succeed(A.empty<ValueTypeConstraint>())),
      S.annotateKey({ description: "Rules a value must satisfy, all at once, to conform." })
    ),
  }).pipe(
    $I.annoteSchema("OntologyValueType", {
      description: "A value type as the ontology exposes it: a named, versioned base type with its constraints.",
    })
  )
) {}
