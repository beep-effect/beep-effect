/**
 * Property types: what a property of an object or interface type can hold, and how a property is described.
 *
 * **Details**
 *
 * OSDK flattens the wire's property type into a scalar tag plus a
 * `multiplicity` flag, renames `date` to `datetime`, splits one `timeseries` tag
 * into three and turns a struct into a bare record, then rebuilds meaning with
 * conditional types. {@link PropertyType} keeps the wire's own shape: one
 * recursive tagged union of 22 cases in which an array and a struct are types
 * like any other. Every later table (value codec, filter operators, metrics,
 * group-bys) is an exhaustive match over this union.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit, MappedLiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as SchemaTransformation from "effect/SchemaTransformation";
import * as Tuple from "effect/Tuple";
import {
  AttachmentType,
  BooleanType,
  ByteType,
  CipherTextType,
  DateType,
  DecimalType,
  DoubleType,
  FloatType,
  GeoPointType,
  GeoShapeType,
  GeotimeSeriesReferenceType,
  IntegerType,
  LongType,
  MarkingType,
  MediaReferenceType,
  ShortType,
  StringType,
  TimeseriesType,
  TimestampType,
  VectorType,
} from "../DataType/DataType.model.ts";
import { PropertyTypeKind } from "../DataType/DataType.values.ts";
import {
  PropertyApiName,
  PropertyTypeRid,
  SharedPropertyTypeApiName,
  SharedPropertyTypeRid,
  StructFieldApiName,
  StructFieldTypeRid,
  ValueTypeApiName,
} from "../Identifier/Identifier.model.ts";
import { RecursiveArraySizeHint } from "../internal/RecursionHint.ts";
import { TypeClass, Visibility } from "../Metadata/Metadata.values.ts";
import { ValueFormat } from "../ValueFormat/ValueFormat.model.ts";

const $I = $ScratchpadId.create("osdk/Property/Property.model");

const suspendedPropertyType = S.suspend((): S.Codec<PropertyType, PropertyType.Encoded> => PropertyType);

// -----------------------------------------------------------------------------
// Composite property types
// -----------------------------------------------------------------------------

/**
 * Which element an array reducer keeps: the first after sorting ascending or descending, nulls last.
 *
 * **Example** (Name the element a decoded direction keeps)
 *
 * ```ts import.meta.vitest name="Name the element a decoded direction keeps"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { ArrayReducerDirection } from "@beep/scratchpad/osdk/src/Property/index"
 *
 * const kept = ArrayReducerDirection.To.match({
 *   ascendingNullsLast: () => "smallest",
 *   descendingNullsLast: () => "largest",
 * })
 * const direction = await Effect.runPromise(S.decodeUnknownEffect(ArrayReducerDirection)("DESCENDING_NULLS_LAST"))
 * kept(direction) // => "largest"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ArrayReducerDirection = MappedLiteralKit([
  ["ASCENDING_NULLS_LAST", "ascendingNullsLast"],
  ["DESCENDING_NULLS_LAST", "descendingNullsLast"],
]).pipe(
  $I.annoteSchema("ArrayReducerDirection", {
    description: "Which element an array reducer keeps: the first after sorting ascending or descending, nulls last.",
  })
);

/**
 * Runtime type of {@link ArrayReducerDirection}.
 *
 * @category models
 * @since 0.0.0
 */
export type ArrayReducerDirection = typeof ArrayReducerDirection.Type;

/**
 * Rule that reduces an array property to a single representative element.
 *
 * @category models
 * @since 0.0.0
 */
export class ArrayReducer extends S.Opaque<ArrayReducer, { readonly brand: unique symbol }>()(
  S.Struct({
    direction: ArrayReducerDirection.annotateKey({ description: "Sort order used to pick the kept element." }),
    field: S.OptionFromOptionalKey(StructFieldApiName).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Struct field to sort by when the elements are structs." })
    ),
  }).pipe(
    $I.annoteSchema("ArrayReducer", {
      description: "Rule that reduces an array property to a single representative element.",
    })
  )
) {}

/**
 * Property type of a homogeneous list.
 *
 * **Details**
 *
 * The wire key is `subType`; here it is `elementType`. OSDK erases this case
 * into a `multiplicity: true` flag beside the element's tag, which is why its
 * nested arrays silently collapse.
 *
 * @category models
 * @since 0.0.0
 */
export class ArrayType extends S.Opaque<ArrayType, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("array"),
    elementType: suspendedPropertyType.annotateKey({ description: "Property type of every element." }),
    reducers: S.Array(ArrayReducer).pipe(
      S.withConstructorDefault(Effect.succeed(A.empty<ArrayReducer>())),
      S.withDecodingDefaultKey(Effect.succeed(A.empty<(typeof ArrayReducer)["Encoded"]>())),
      S.annotateKey({ description: "Rules that reduce the array to one element when a load level asks for it." })
    ),
  }).pipe(
    S.encodeKeys({ elementType: "subType" }),
    $I.annoteSchema("ArrayType", { description: "Property type of a homogeneous list." })
  )
) {}

/**
 * Companion namespace for {@link ArrayType}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ArrayType {
  /**
   * Encoded form of {@link ArrayType}, declared explicitly because the type is recursive.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "array";
    readonly subType: PropertyType.Encoded;
    readonly reducers?: ReadonlyArray<(typeof ArrayReducer)["Encoded"]>;
  }
}

/**
 * One named field of a struct property.
 *
 * @category models
 * @since 0.0.0
 */
export class StructFieldType extends S.Opaque<StructFieldType, { readonly brand: unique symbol }>()(
  S.Struct({
    apiName: StructFieldApiName.annotateKey({ description: "Name of the field within its struct." }),
    rid: StructFieldTypeRid.annotateKey({ description: "Resource identifier of the field type." }),
    dataType: suspendedPropertyType.annotateKey({ description: "Property type of the field's value." }),
    typeClasses: S.Array(TypeClass).pipe(
      S.withConstructorDefault(Effect.succeed(A.empty<TypeClass>())),
      S.withDecodingDefaultKey(Effect.succeed(A.empty<(typeof TypeClass)["Encoded"]>())),
      S.annotateKey({ description: "Free-form rendering and behavior hints for client applications." })
    ),
  }).pipe($I.annoteSchema("StructFieldType", { description: "One named field of a struct property." }))
) {}

/**
 * Companion namespace for {@link StructFieldType}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace StructFieldType {
  /**
   * Encoded form of {@link StructFieldType}, declared explicitly because the type is recursive.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly apiName: string;
    readonly rid: string;
    readonly dataType: PropertyType.Encoded;
    readonly typeClasses?: ReadonlyArray<(typeof TypeClass)["Encoded"]>;
  }
}

/**
 * The "main value" of a struct: the fields that stand for the whole struct when a single value is wanted.
 *
 * @category models
 * @since 0.0.0
 */
export class StructMainValue extends S.Opaque<StructMainValue, { readonly brand: unique symbol }>()(
  S.Struct({
    mainValueType: suspendedPropertyType.annotateKey({ description: "Property type of the extracted main value." }),
    fields: S.Array(StructFieldApiName).annotateKey({ description: "Fields that compose the main value." }),
  }).pipe(
    $I.annoteSchema("StructMainValue", {
      description: "The fields that stand for the whole struct when a single value is wanted.",
    })
  )
) {}

/**
 * Companion namespace for {@link StructMainValue}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace StructMainValue {
  /**
   * Encoded form of {@link StructMainValue}, declared explicitly because the type is recursive.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly mainValueType: PropertyType.Encoded;
    readonly fields: ReadonlyArray<string>;
  }
}

/**
 * Property type of a record with named, individually typed fields.
 *
 * **Details**
 *
 * The wire key is `structFieldTypes`; here it is `fields`. OSDK reduces this
 * case to a bare `Record<field, scalarTag>` with no tag, losing field identity,
 * hints and the main value.
 *
 * @category models
 * @since 0.0.0
 */
export class StructType extends S.Opaque<StructType, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("struct"),
    fields: S.Array(StructFieldType)
      .check(
        RecursiveArraySizeHint,
        S.makeFilter(
          (fields: ReadonlyArray<StructFieldType>) =>
            A.length(A.dedupe(A.map(fields, (field) => field.apiName))) === A.length(fields),
          $I.annote("UniqueStructFieldNamesCheck", {
            title: "Unique struct field names",
            description: "No two fields of a struct share an API name.",
            message: "Expected every struct field to have a distinct API name",
          })
        )
      )
      .annotateKey({ description: "Fields of the struct, in declaration order." }),
    mainValue: S.OptionFromOptionalKey(StructMainValue).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Fields that stand for the whole struct, when configured." })
    ),
  }).pipe(
    S.encodeKeys({ fields: "structFieldTypes" }),
    $I.annoteSchema("StructType", { description: "Property type of a record with named, individually typed fields." })
  )
) {}

/**
 * Companion namespace for {@link StructType}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace StructType {
  /**
   * Encoded form of {@link StructType}, declared explicitly because the type is recursive.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "struct";
    readonly structFieldTypes: ReadonlyArray<StructFieldType.Encoded>;
    readonly mainValue?: StructMainValue.Encoded;
  }
}

// -----------------------------------------------------------------------------
// The property type union
// -----------------------------------------------------------------------------

/**
 * Everything a property of an object or interface type can hold: 20 leaf types, arrays and structs.
 *
 * **Example** (Describe a property type with one exhaustive match)
 *
 * ```ts import.meta.vitest name="Describe a property type with one exhaustive match"
 * import { StringType } from "@beep/scratchpad/osdk/src/DataType/index"
 * import { ArrayType, PropertyType } from "@beep/scratchpad/osdk/src/Property/index"
 *
 * const isCollection = PropertyType.isAnyOf(["array", "struct"])
 * const tags = ArrayType.make({ elementType: StringType.make({}) })
 * const verdicts = [isCollection(tags), isCollection(StringType.make({})), PropertyType.guards.array(tags)]
 * verdicts // => [true, false, true]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PropertyType = PropertyTypeKind.mapMembers(() =>
  Tuple.make(
    BooleanType,
    ByteType,
    ShortType,
    IntegerType,
    LongType,
    FloatType,
    DoubleType,
    DecimalType,
    StringType,
    DateType,
    TimestampType,
    MarkingType,
    CipherTextType,
    AttachmentType,
    MediaReferenceType,
    GeoPointType,
    GeoShapeType,
    GeotimeSeriesReferenceType,
    TimeseriesType,
    VectorType,
    ArrayType,
    StructType
  )
).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("PropertyType", {
    description: "Everything a property of an object or interface type can hold: leaf types, arrays and structs.",
  })
);

/**
 * Runtime type of {@link PropertyType}.
 *
 * @category models
 * @since 0.0.0
 */
export type PropertyType =
  | BooleanType
  | ByteType
  | ShortType
  | IntegerType
  | LongType
  | FloatType
  | DoubleType
  | DecimalType
  | StringType
  | DateType
  | TimestampType
  | MarkingType
  | CipherTextType
  | AttachmentType
  | MediaReferenceType
  | GeoPointType
  | GeoShapeType
  | GeotimeSeriesReferenceType
  | TimeseriesType
  | VectorType
  | ArrayType
  | StructType;

/**
 * Companion namespace for {@link PropertyType}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace PropertyType {
  /**
   * Encoded (wire) form of {@link PropertyType}, declared explicitly because the union is recursive.
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
    | (typeof DecimalType)["Encoded"]
    | (typeof StringType)["Encoded"]
    | (typeof DateType)["Encoded"]
    | (typeof TimestampType)["Encoded"]
    | (typeof MarkingType)["Encoded"]
    | (typeof CipherTextType)["Encoded"]
    | (typeof AttachmentType)["Encoded"]
    | (typeof MediaReferenceType)["Encoded"]
    | (typeof GeoPointType)["Encoded"]
    | (typeof GeoShapeType)["Encoded"]
    | (typeof GeotimeSeriesReferenceType)["Encoded"]
    | (typeof TimeseriesType)["Encoded"]
    | (typeof VectorType)["Encoded"]
    | ArrayType.Encoded
    | StructType.Encoded;
}

// -----------------------------------------------------------------------------
// Property definitions
// -----------------------------------------------------------------------------

const PropertyStatusKind = LiteralKit(["active", "experimental", "example", "deprecated"]);

/**
 * A property in normal use.
 *
 * @category models
 * @since 0.0.0
 */
export class ActiveProperty extends S.Opaque<ActiveProperty, { readonly brand: unique symbol }>()(
  S.Struct({ type: S.tag("active") }).pipe(
    $I.annoteSchema("ActiveProperty", { description: "A property in normal use." })
  )
) {}

/**
 * A property that may still change shape or disappear.
 *
 * @category models
 * @since 0.0.0
 */
export class ExperimentalProperty extends S.Opaque<ExperimentalProperty, { readonly brand: unique symbol }>()(
  S.Struct({ type: S.tag("experimental") }).pipe(
    $I.annoteSchema("ExperimentalProperty", { description: "A property that may still change shape or disappear." })
  )
) {}

/**
 * A property that exists to demonstrate the ontology rather than to carry real data.
 *
 * @category models
 * @since 0.0.0
 */
export class ExampleProperty extends S.Opaque<ExampleProperty, { readonly brand: unique symbol }>()(
  S.Struct({ type: S.tag("example") }).pipe(
    $I.annoteSchema("ExampleProperty", {
      description: "A property that exists to demonstrate the ontology rather than to carry real data.",
    })
  )
) {}

/**
 * A property scheduled for removal, with the reason, the deadline and its replacement when one exists.
 *
 * @category models
 * @since 0.0.0
 */
export class DeprecatedProperty extends S.Opaque<DeprecatedProperty, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("deprecated"),
    message: S.String.annotateKey({ description: "Why the property is deprecated and what to do instead." }),
    deadline: S.String.annotateKey({
      description: "ISO 8601 date or date-time after which the property may be removed.",
    }),
    replacedBy: S.OptionFromOptionalKey(PropertyTypeRid).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Property that supersedes this one." })
    ),
  }).pipe(
    $I.annoteSchema("DeprecatedProperty", {
      description: "A property scheduled for removal, with the reason, the deadline and its replacement.",
    })
  )
) {}

/**
 * Lifecycle status of a property.
 *
 * **Example** (Read the deprecation message when there is one)
 *
 * ```ts import.meta.vitest name="Read the deprecation message when there is one"
 * import { DeprecatedProperty, PropertyStatus } from "@beep/scratchpad/osdk/src/Property/index"
 *
 * const warning = PropertyStatus.match({
 *   active: () => "",
 *   experimental: () => "experimental",
 *   example: () => "example",
 *   deprecated: ({ message, deadline }) => `${message} (until ${deadline})`,
 * })
 * warning(DeprecatedProperty.make({ message: "Use fullName", deadline: "2027-01-01" })) // => "Use fullName (until 2027-01-01)"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PropertyStatus = PropertyStatusKind.mapMembers(() =>
  Tuple.make(ActiveProperty, ExperimentalProperty, ExampleProperty, DeprecatedProperty)
).pipe(S.toTaggedUnion("type"), $I.annoteSchema("PropertyStatus", { description: "Lifecycle status of a property." }));

/**
 * Runtime type of {@link PropertyStatus}.
 *
 * @category models
 * @since 0.0.0
 */
export type PropertyStatus = typeof PropertyStatus.Type;

/**
 * Whether values written through a datasource or an action may be null.
 *
 * **Example** (Decode the wire flag and refuse the domain spelling)
 *
 * ```ts import.meta.vitest name="Decode the wire flag and refuse the domain spelling"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { Nullability } from "@beep/scratchpad/osdk/src/Property/index"
 *
 * const decode = S.decodeUnknownEffect(Nullability)
 * const nullability = await Effect.runPromise(decode("NOT_NULLABLE"))
 * const refused = await Effect.runPromise(Effect.isFailure(decode("notNullable")))
 * const outcome = [nullability, refused]
 * outcome // => ["notNullable", true]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const Nullability = MappedLiteralKit([
  ["NULLABLE", "nullable"],
  ["NOT_NULLABLE", "notNullable"],
]).pipe(
  $I.annoteSchema("Nullability", {
    description: "Whether values written through a datasource or an action may be null.",
  })
);

/**
 * Runtime type of {@link Nullability}.
 *
 * @category models
 * @since 0.0.0
 */
export type Nullability = typeof Nullability.Type;

/**
 * Constraints the platform enforces on a property's values when they are written.
 *
 * **Gotchas**
 *
 * A `notNullable` property can still read as absent for an object that is
 * missing from the datasource mapping, so instance codecs never treat this as
 * a guarantee of presence.
 *
 * @category models
 * @since 0.0.0
 */
export class PropertyDataConstraints extends S.Opaque<PropertyDataConstraints, { readonly brand: unique symbol }>()(
  S.Struct({
    nullability: S.OptionFromOptionalKey(Nullability).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Whether written values may be null, when the ontology states it." })
    ),
  }).pipe(
    $I.annoteSchema("PropertyDataConstraints", {
      description: "Constraints the platform enforces on a property's values when they are written.",
    })
  )
) {}

/**
 * A property as declared on an object type: its type plus everything that describes it.
 *
 * **Details**
 *
 * The property's own API name is the key under which the object type stores
 * this record, so it is not repeated here.
 *
 * **Example** (Declare a property with only what matters)
 *
 * ```ts import.meta.vitest name="Declare a property with only what matters"
 * import * as O from "effect/Option"
 * import { StringType } from "@beep/scratchpad/osdk/src/DataType/index"
 * import { PropertyTypeRid } from "@beep/scratchpad/osdk/src/Identifier/index"
 * import { PropertyDefinition } from "@beep/scratchpad/osdk/src/Property/index"
 *
 * const fullName = PropertyDefinition.make({
 *   dataType: StringType.make({}),
 *   rid: PropertyTypeRid.make("ri.ontology.main.property.full-name"),
 * })
 * const summary = [fullName.dataType.type, O.isNone(fullName.description), fullName.typeClasses.length]
 * summary // => ["string", true, 0]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PropertyDefinition extends S.Opaque<PropertyDefinition, { readonly brand: unique symbol }>()(
  S.Struct({
    dataType: PropertyType.annotateKey({ description: "What the property holds." }),
    rid: PropertyTypeRid.annotateKey({ description: "Resource identifier of the property type." }),
    displayName: S.OptionFromOptionalKey(S.String).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Human-readable name." })
    ),
    description: S.OptionFromOptionalKey(S.String).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "What the property means." })
    ),
    status: S.OptionFromOptionalKey(PropertyStatus).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Lifecycle status, when the ontology exposes it." })
    ),
    visibility: S.OptionFromOptionalKey(Visibility).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Suggested prominence in user interfaces." })
    ),
    valueTypeApiName: S.OptionFromOptionalKey(ValueTypeApiName).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Value type that further constrains the property's values." })
    ),
    valueFormatting: S.OptionFromOptionalKey(ValueFormat).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "How to render values for display." })
    ),
    typeClasses: S.Array(TypeClass).pipe(
      S.withConstructorDefault(Effect.succeed(A.empty<TypeClass>())),
      S.withDecodingDefaultKey(Effect.succeed(A.empty<(typeof TypeClass)["Encoded"]>())),
      S.annotateKey({ description: "Free-form rendering and behavior hints for client applications." })
    ),
    dataConstraints: S.OptionFromOptionalKey(PropertyDataConstraints).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Write-time constraints on the property's values." })
    ),
  }).pipe(
    $I.annoteSchema("PropertyDefinition", {
      description: "A property as declared on an object type: its type plus everything that describes it.",
    })
  )
) {}

/**
 * A property definition reused across object and interface types.
 *
 * @category models
 * @since 0.0.0
 */
export class SharedPropertyType extends S.Opaque<SharedPropertyType, { readonly brand: unique symbol }>()(
  S.Struct({
    rid: SharedPropertyTypeRid.annotateKey({ description: "Resource identifier of the shared property type." }),
    apiName: SharedPropertyTypeApiName.annotateKey({ description: "Name under which types reference it." }),
    displayName: S.String.annotateKey({ description: "Human-readable name." }),
    description: S.OptionFromOptionalKey(S.String).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "What the property means." })
    ),
    dataType: PropertyType.annotateKey({ description: "What the property holds." }),
    valueTypeApiName: S.OptionFromOptionalKey(ValueTypeApiName).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Value type that further constrains the property's values." })
    ),
    valueFormatting: S.OptionFromOptionalKey(ValueFormat).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "How to render values for display." })
    ),
    typeClasses: S.Array(TypeClass).pipe(
      S.withConstructorDefault(Effect.succeed(A.empty<TypeClass>())),
      S.withDecodingDefaultKey(Effect.succeed(A.empty<(typeof TypeClass)["Encoded"]>())),
      S.annotateKey({ description: "Free-form rendering and behavior hints for client applications." })
    ),
  }).pipe(
    $I.annoteSchema("SharedPropertyType", {
      description: "A property definition reused across object and interface types.",
    })
  )
) {}

// -----------------------------------------------------------------------------
// Property selectors
// -----------------------------------------------------------------------------

const LoadLevelKind = LiteralKit(["noLoadLevel", "applyReducers", "extractMainValue", "applyReducersAndExtractMainValue"]);

/**
 * How much of a composite property to load: as stored, reduced to one element, or reduced to its main value.
 *
 * **Details**
 *
 * The wire spells this as a union of four empty records (`{ "type": "applyReducers" }`). Nothing varies
 * but the tag, so the domain value is the tag itself and the record is only the encoding. A load level
 * that does not apply to the property's type is ignored by the platform.
 *
 * **Example** (Decode the wire record into its literal)
 *
 * ```ts import.meta.vitest name="Decode the wire record into its literal"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { PropertyLoadLevel } from "@beep/scratchpad/osdk/src/Property/index"
 *
 * const level = await Effect.runPromise(S.decodeUnknownEffect(PropertyLoadLevel)({ type: "extractMainValue" }))
 * level // => "extractMainValue"
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const PropertyLoadLevel = S.Struct({ type: LoadLevelKind }).pipe(
  S.decodeTo(
    S.toType(LoadLevelKind),
    SchemaTransformation.transform({
      decode: ({ type }) => type,
      encode: (type) => ({ type }),
    })
  ),
  $I.annoteSchema("PropertyLoadLevel", {
    description: "How much of a composite property to load: as stored, reduced to one element, or its main value.",
  })
);

/**
 * Runtime type of {@link PropertyLoadLevel}.
 *
 * @category codecs
 * @since 0.0.0
 */
export type PropertyLoadLevel = typeof PropertyLoadLevel.Type;

const PropertySelectorKind = LiteralKit([
  "property",
  "structField",
  "propertyWithLoadLevel",
  "titleProperty",
  "primaryKeyProperty",
]);

/**
 * Selects a property by its API name.
 *
 * @category models
 * @since 0.0.0
 */
export class PropertyByName extends S.Opaque<PropertyByName, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("property"),
    apiName: PropertyApiName.annotateKey({ description: "Name of the selected property." }),
  }).pipe($I.annoteSchema("PropertyByName", { description: "Selects a property by its API name." }))
) {}

/**
 * Selects one field of a struct property.
 *
 * @category models
 * @since 0.0.0
 */
export class StructFieldOfProperty extends S.Opaque<StructFieldOfProperty, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("structField"),
    propertyApiName: PropertyApiName.annotateKey({ description: "Name of the struct property." }),
    structFieldApiName: StructFieldApiName.annotateKey({ description: "Name of the field within the struct." }),
  }).pipe($I.annoteSchema("StructFieldOfProperty", { description: "Selects one field of a struct property." }))
) {}

/**
 * Selects a property and says how much of it to load.
 *
 * @category models
 * @since 0.0.0
 */
export class PropertyAtLoadLevel extends S.Opaque<PropertyAtLoadLevel, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("propertyWithLoadLevel"),
    selector: S.suspend((): S.Codec<PropertySelector, PropertySelector.Encoded> => PropertySelector).annotateKey({
      description: "The property the load level applies to.",
    }),
    loadLevel: PropertyLoadLevel.annotateKey({ description: "How much of the property to load." }),
  }).pipe(
    S.encodeKeys({ selector: "propertyIdentifier" }),
    $I.annoteSchema("PropertyAtLoadLevel", { description: "Selects a property and says how much of it to load." })
  )
) {}

/**
 * Companion namespace for {@link PropertyAtLoadLevel}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace PropertyAtLoadLevel {
  /**
   * Encoded form of {@link PropertyAtLoadLevel}, declared explicitly because the selector is recursive.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "propertyWithLoadLevel";
    readonly propertyIdentifier: PropertySelector.Encoded;
    readonly loadLevel: (typeof PropertyLoadLevel)["Encoded"];
  }
}

/**
 * Selects whichever property is the object type's title.
 *
 * @category models
 * @since 0.0.0
 */
export class TitleProperty extends S.Opaque<TitleProperty, { readonly brand: unique symbol }>()(
  S.Struct({ type: S.tag("titleProperty") }).pipe(
    $I.annoteSchema("TitleProperty", { description: "Selects whichever property is the object type's title." })
  )
) {}

/**
 * Selects whichever property is the object type's primary key.
 *
 * @category models
 * @since 0.0.0
 */
export class PrimaryKeyProperty extends S.Opaque<PrimaryKeyProperty, { readonly brand: unique symbol }>()(
  S.Struct({ type: S.tag("primaryKeyProperty") }).pipe(
    $I.annoteSchema("PrimaryKeyProperty", {
      description: "Selects whichever property is the object type's primary key.",
    })
  )
) {}

/**
 * Addresses a property, a struct field, or a role (title, primary key) in filters, ordering, selection and aggregation.
 *
 * **Example** (Address a struct field and the title)
 *
 * ```ts import.meta.vitest name="Address a struct field and the title"
 * import { PropertyApiName, StructFieldApiName } from "@beep/scratchpad/osdk/src/Identifier/index"
 * import { PropertySelector, StructFieldOfProperty, TitleProperty } from "@beep/scratchpad/osdk/src/Property/index"
 *
 * const path = PropertySelector.match({
 *   property: ({ apiName }) => apiName,
 *   structField: ({ propertyApiName, structFieldApiName }) => `${propertyApiName}.${structFieldApiName}`,
 *   propertyWithLoadLevel: ({ loadLevel }) => `(${loadLevel})`,
 *   titleProperty: () => "<title>",
 *   primaryKeyProperty: () => "<primaryKey>",
 * })
 * const city = StructFieldOfProperty.make({
 *   propertyApiName: PropertyApiName.make("address"),
 *   structFieldApiName: StructFieldApiName.make("city"),
 * })
 * const paths = [path(city), path(TitleProperty.make({}))]
 * paths // => ["address.city", "<title>"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PropertySelector = PropertySelectorKind.mapMembers(() =>
  Tuple.make(PropertyByName, StructFieldOfProperty, PropertyAtLoadLevel, TitleProperty, PrimaryKeyProperty)
).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("PropertySelector", {
    description: "Addresses a property, a struct field, or a role (title, primary key) of an object type.",
  })
);

/**
 * Runtime type of {@link PropertySelector}.
 *
 * @category models
 * @since 0.0.0
 */
export type PropertySelector =
  | PropertyByName
  | StructFieldOfProperty
  | PropertyAtLoadLevel
  | TitleProperty
  | PrimaryKeyProperty;

/**
 * Companion namespace for {@link PropertySelector}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace PropertySelector {
  /**
   * Encoded (wire) form of {@link PropertySelector}, declared explicitly because the union is recursive.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded =
    | (typeof PropertyByName)["Encoded"]
    | (typeof StructFieldOfProperty)["Encoded"]
    | PropertyAtLoadLevel.Encoded
    | (typeof TitleProperty)["Encoded"]
    | (typeof PrimaryKeyProperty)["Encoded"];
}
