/**
 * Query types: the signature of a function published through the ontology, and the shapes of its arguments and results.
 *
 * **Details**
 *
 * OSDK re-declares the wire's query data type as a second union: a `nullable`
 * flag on every member, a `map` where the wire has an entry set, a record where
 * the wire has a field list, and payload keys named after their own tag. It
 * converts between the two with hand-written recursion that looks for a
 * union's `null` member by comparing a tag against JavaScript `null`, so a
 * union that lists `null` first cannot be converted at all.
 * {@link QueryDataType} keeps the wire's one recursive union of 26 cases.
 * Nullability stays what the wire says it is, a union with the `null` tag, and
 * is read with {@link nonNullAlternative}. A type that refers to itself does so
 * by name through {@link TypeReferenceType}, resolved against its
 * {@link QueryType} with {@link resolveTypeReference}.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { dual, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Tuple from "effect/Tuple";
import {
  AttachmentType,
  BooleanType,
  DateType,
  DoubleType,
  FloatType,
  GeoShapeType,
  IntegerType,
  LongType,
  MediaReferenceType,
  NullType,
  StringType,
  TimestampType,
  UnsupportedType,
  VoidType,
} from "../DataType/DataType.model.ts";
import { DataTypeKind, QueryDataTypeKind } from "../DataType/DataType.values.ts";
import {
  FunctionRid,
  FunctionVersion,
  InterfaceTypeApiName,
  ObjectTypeApiName,
  ParameterId,
  QueryApiName,
} from "../Identifier/Identifier.model.ts";
import { RecursiveArraySizeHint } from "../internal/RecursionHint.ts";
import { ScalarValue } from "../Value/Value.model.ts";

const $I = $ScratchpadId.create("osdk/Query/Query.model");

const suspendedQueryDataType = S.suspend((): S.Codec<QueryDataType, QueryDataType.Encoded> => QueryDataType);

// -----------------------------------------------------------------------------
// Identifiers local to queries
// -----------------------------------------------------------------------------

/**
 * Name under which a query type stores one of its data types, so that the type can be referred to, even by itself.
 *
 * @category identifiers
 * @since 0.0.0
 */
export const TypeReferenceId = S.NonEmptyString.pipe(
  S.brand("TypeReferenceId"),
  $I.annoteSchema("TypeReferenceId", {
    description: "Name under which a query type stores one of its data types, so the type can be referred to by name.",
  })
);

/**
 * Runtime type of {@link TypeReferenceId}.
 *
 * @category identifiers
 * @since 0.0.0
 */
export type TypeReferenceId = typeof TypeReferenceId.Type;

/**
 * Name of one field of a struct passed to or returned by a query.
 *
 * @category identifiers
 * @since 0.0.0
 */
export const QueryStructFieldName = S.NonEmptyString.pipe(
  S.brand("QueryStructFieldName"),
  $I.annoteSchema("QueryStructFieldName", {
    description: "Name of one field of a struct passed to or returned by a query.",
  })
);

/**
 * Runtime type of {@link QueryStructFieldName}.
 *
 * @category identifiers
 * @since 0.0.0
 */
export type QueryStructFieldName = typeof QueryStructFieldName.Type;

// -----------------------------------------------------------------------------
// Aggregation type descriptors
// -----------------------------------------------------------------------------

const AggregationBoundKind = DataTypeKind.pick(["integer", "double", "date", "timestamp"]);

const AggregationValueKind = DataTypeKind.pick(["double", "date", "timestamp"]);

const AggregationKeyKind = LiteralKit(["boolean", "integer", "double", "string", "date", "timestamp", "range"]);

/**
 * What the bounds of a range key can be: whole or fractional numbers, calendar dates or instants.
 *
 * **Example** (List the orderable bound types)
 *
 * ```ts import.meta.vitest name="List the orderable bound types"
 * import { QueryAggregationBoundType } from "@beep/scratchpad/osdk/src/Query/index"
 *
 * QueryAggregationBoundType.discriminants // => ["integer", "double", "date", "timestamp"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const QueryAggregationBoundType = AggregationBoundKind.mapMembers(() =>
  Tuple.make(IntegerType, DoubleType, DateType, TimestampType)
).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("QueryAggregationBoundType", {
    description: "What the bounds of a range key can be: numbers, calendar dates or instants.",
  })
);

/**
 * Runtime type of {@link QueryAggregationBoundType}.
 *
 * @category models
 * @since 0.0.0
 */
export type QueryAggregationBoundType = typeof QueryAggregationBoundType.Type;

/**
 * Key type of groups that are keyed by a range of values instead of one value.
 *
 * **Details**
 *
 * The wire key is `subType`; here it is `boundType`, because it types the two
 * bounds of the range and not a part of it.
 *
 * @category models
 * @since 0.0.0
 */
export class QueryAggregationRangeKeyType extends S.Opaque<
  QueryAggregationRangeKeyType,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    type: S.tag("range"),
    boundType: QueryAggregationBoundType.annotateKey({ description: "Data type of the start and end of each range." }),
  }).pipe(
    S.encodeKeys({ boundType: "subType" }),
    $I.annoteSchema("QueryAggregationRangeKeyType", {
      description: "Key type of groups that are keyed by a range of values instead of one value.",
    })
  )
) {}

/**
 * What the groups of an aggregation can be keyed by: one scalar, or a range of an orderable scalar.
 *
 * **Example** (Tell range keys from scalar keys)
 *
 * ```ts import.meta.vitest name="Tell range keys from scalar keys"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { QueryAggregationKeyType } from "@beep/scratchpad/osdk/src/Query/index"
 *
 * const describe = QueryAggregationKeyType.match({
 *   boolean: () => "boolean",
 *   integer: () => "integer",
 *   double: () => "double",
 *   string: () => "string",
 *   date: () => "date",
 *   timestamp: () => "timestamp",
 *   range: ({ boundType }) => `range of ${boundType.type}`,
 * })
 * const key = await Effect.runPromise(
 *   S.decodeUnknownEffect(QueryAggregationKeyType)({ type: "range", subType: { type: "timestamp" } })
 * )
 * describe(key) // => "range of timestamp"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const QueryAggregationKeyType = AggregationKeyKind.mapMembers(() =>
  Tuple.make(BooleanType, IntegerType, DoubleType, StringType, DateType, TimestampType, QueryAggregationRangeKeyType)
).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("QueryAggregationKeyType", {
    description: "What the groups of an aggregation can be keyed by: one scalar, or a range of an orderable scalar.",
  })
);

/**
 * Runtime type of {@link QueryAggregationKeyType}.
 *
 * @category models
 * @since 0.0.0
 */
export type QueryAggregationKeyType = typeof QueryAggregationKeyType.Type;

/**
 * What an aggregation can measure for each group: a number, a calendar date or an instant.
 *
 * **Example** (List the measurable value types)
 *
 * ```ts import.meta.vitest name="List the measurable value types"
 * import { QueryAggregationValueType } from "@beep/scratchpad/osdk/src/Query/index"
 *
 * QueryAggregationValueType.discriminants // => ["double", "date", "timestamp"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const QueryAggregationValueType = AggregationValueKind.mapMembers(() =>
  Tuple.make(DoubleType, DateType, TimestampType)
).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("QueryAggregationValueType", {
    description: "What an aggregation can measure for each group: a number, a calendar date or an instant.",
  })
);

/**
 * Runtime type of {@link QueryAggregationValueType}.
 *
 * @category models
 * @since 0.0.0
 */
export type QueryAggregationValueType = typeof QueryAggregationValueType.Type;

/**
 * Key and value types of the inner grouping of a three-dimensional aggregation.
 *
 * **Details**
 *
 * The wire nests a two-dimensional aggregation here without its `type` tag,
 * so this record has the same two fields as {@link TwoDimensionalAggregationType}
 * and no discriminator.
 *
 * @category models
 * @since 0.0.0
 */
export class NestedAggregationType extends S.Opaque<NestedAggregationType, { readonly brand: unique symbol }>()(
  S.Struct({
    keyType: QueryAggregationKeyType.annotateKey({ description: "What the inner groups are keyed by." }),
    valueType: QueryAggregationValueType.annotateKey({ description: "What is measured for each inner group." }),
  }).pipe(
    $I.annoteSchema("NestedAggregationType", {
      description: "Key and value types of the inner grouping of a three-dimensional aggregation.",
    })
  )
) {}

/**
 * Query data type of a grouped measurement: one value per group key.
 *
 * @category models
 * @since 0.0.0
 */
export class TwoDimensionalAggregationType extends S.Opaque<
  TwoDimensionalAggregationType,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    type: S.tag("twoDimensionalAggregation"),
    keyType: QueryAggregationKeyType.annotateKey({ description: "What the groups are keyed by." }),
    valueType: QueryAggregationValueType.annotateKey({ description: "What is measured for each group." }),
  }).pipe(
    $I.annoteSchema("TwoDimensionalAggregationType", {
      description: "Query data type of a grouped measurement: one value per group key.",
    })
  )
) {}

/**
 * Query data type of a measurement grouped twice: one value per pair of outer and inner group keys.
 *
 * @category models
 * @since 0.0.0
 */
export class ThreeDimensionalAggregationType extends S.Opaque<
  ThreeDimensionalAggregationType,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    type: S.tag("threeDimensionalAggregation"),
    keyType: QueryAggregationKeyType.annotateKey({ description: "What the outer groups are keyed by." }),
    // Key and value types of the grouping inside each outer group.
    // (Bare: annotating the key of a class would type the field as its un-branded record.)
    valueType: NestedAggregationType,
  }).pipe(
    $I.annoteSchema("ThreeDimensionalAggregationType", {
      description: "Query data type of a measurement grouped twice: one value per pair of outer and inner keys.",
    })
  )
) {}

// -----------------------------------------------------------------------------
// Composite query data types
// -----------------------------------------------------------------------------

/**
 * Query data type of an ordered list.
 *
 * **Details**
 *
 * The wire key is `subType`; here it is `elementType`, as for array properties.
 *
 * @category models
 * @since 0.0.0
 */
export class QueryArrayType extends S.Opaque<QueryArrayType, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("array"),
    elementType: suspendedQueryDataType.annotateKey({ description: "Data type of every element." }),
  }).pipe(
    S.encodeKeys({ elementType: "subType" }),
    $I.annoteSchema("QueryArrayType", { description: "Query data type of an ordered list." })
  )
) {}

/**
 * Companion namespace for {@link QueryArrayType}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace QueryArrayType {
  /**
   * Encoded form of {@link QueryArrayType}, declared explicitly because the type is recursive.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "array";
    readonly subType: QueryDataType.Encoded;
  }
}

/**
 * Query data type of a collection without duplicates, which travels as a JSON array.
 *
 * **Details**
 *
 * The wire key is `subType`; here it is `elementType`.
 *
 * @category models
 * @since 0.0.0
 */
export class QuerySetType extends S.Opaque<QuerySetType, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("set"),
    elementType: suspendedQueryDataType.annotateKey({ description: "Data type of every element." }),
  }).pipe(
    S.encodeKeys({ elementType: "subType" }),
    $I.annoteSchema("QuerySetType", {
      description: "Query data type of a collection without duplicates, which travels as a JSON array.",
    })
  )
) {}

/**
 * Companion namespace for {@link QuerySetType}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace QuerySetType {
  /**
   * Encoded form of {@link QuerySetType}, declared explicitly because the type is recursive.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "set";
    readonly subType: QueryDataType.Encoded;
  }
}

/**
 * Query data type of a map, which travels as a list of key and value entries so that keys need not be strings.
 *
 * **Details**
 *
 * OSDK renames this tag to `map` and hands the caller a plain record, which
 * turns every key into a string. The wire's own name and shape are kept here.
 *
 * @category models
 * @since 0.0.0
 */
export class EntrySetType extends S.Opaque<EntrySetType, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("entrySet"),
    keyType: suspendedQueryDataType.annotateKey({ description: "Data type of every entry's key." }),
    valueType: suspendedQueryDataType.annotateKey({ description: "Data type of every entry's value." }),
  }).pipe(
    $I.annoteSchema("EntrySetType", {
      description: "Query data type of a map, which travels as a list of key and value entries.",
    })
  )
) {}

/**
 * Companion namespace for {@link EntrySetType}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace EntrySetType {
  /**
   * Encoded form of {@link EntrySetType}, declared explicitly because the type is recursive.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "entrySet";
    readonly keyType: QueryDataType.Encoded;
    readonly valueType: QueryDataType.Encoded;
  }
}

/**
 * One named field of a struct passed to or returned by a query.
 *
 * @category models
 * @since 0.0.0
 */
export class QueryStructField extends S.Opaque<QueryStructField, { readonly brand: unique symbol }>()(
  S.Struct({
    name: QueryStructFieldName.annotateKey({ description: "Name of the field within its struct." }),
    fieldType: suspendedQueryDataType.annotateKey({ description: "Data type of the field's value." }),
  }).pipe(
    $I.annoteSchema("QueryStructField", {
      description: "One named field of a struct passed to or returned by a query.",
    })
  )
) {}

/**
 * Companion namespace for {@link QueryStructField}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace QueryStructField {
  /**
   * Encoded form of {@link QueryStructField}, declared explicitly because the type is recursive.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly name: string;
    readonly fieldType: QueryDataType.Encoded;
  }
}

/**
 * Query data type of a record with named, individually typed fields.
 *
 * **Details**
 *
 * A field is optional exactly when its type is a union with the `null` tag;
 * the field list carries no separate flag.
 *
 * @category models
 * @since 0.0.0
 */
export class QueryStructType extends S.Opaque<QueryStructType, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("struct"),
    fields: S.Array(QueryStructField)
      .check(RecursiveArraySizeHint)
      .annotateKey({ description: "Fields of the struct, in declaration order." }),
  }).pipe(
    $I.annoteSchema("QueryStructType", {
      description: "Query data type of a record with named, individually typed fields.",
    })
  )
) {}

/**
 * Companion namespace for {@link QueryStructType}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace QueryStructType {
  /**
   * Encoded form of {@link QueryStructType}, declared explicitly because the type is recursive.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "struct";
    readonly fields: ReadonlyArray<QueryStructField.Encoded>;
  }
}

/**
 * Query data type of a value that is one of several alternatives.
 *
 * **Details**
 *
 * This is also the only way a query says a value may be missing: one of the
 * alternatives is the `null` tag. Read that with {@link nonNullAlternative}.
 *
 * @category models
 * @since 0.0.0
 */
export class QueryUnionType extends S.Opaque<QueryUnionType, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("union"),
    unionTypes: S.Array(suspendedQueryDataType)
      .check(RecursiveArraySizeHint)
      .annotateKey({ description: "The alternatives, in declaration order." }),
  }).pipe(
    $I.annoteSchema("QueryUnionType", {
      description: "Query data type of a value that is one of several alternatives.",
    })
  )
) {}

/**
 * Companion namespace for {@link QueryUnionType}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace QueryUnionType {
  /**
   * Encoded form of {@link QueryUnionType}, declared explicitly because the type is recursive.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "union";
    readonly unionTypes: ReadonlyArray<QueryDataType.Encoded>;
  }
}

// -----------------------------------------------------------------------------
// Ontology reference query data types
// -----------------------------------------------------------------------------

/**
 * Query data type of a reference to one object, which travels as that object's primary key.
 *
 * **Gotchas**
 *
 * The wire states the object type twice, under `objectApiName` and
 * `objectTypeApiName`, with the same meaning. Both keys are required, so both
 * are kept; OSDK reads `objectTypeApiName`.
 *
 * @category models
 * @since 0.0.0
 */
export class ObjectReferenceType extends S.Opaque<ObjectReferenceType, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("object"),
    objectApiName: ObjectTypeApiName.annotateKey({
      description: "Object type of the referenced object, as the wire repeats it under a second key.",
    }),
    objectTypeApiName: ObjectTypeApiName.annotateKey({ description: "Object type of the referenced object." }),
  }).pipe(
    $I.annoteSchema("ObjectReferenceType", {
      description: "Query data type of a reference to one object, which travels as that object's primary key.",
    })
  )
) {}

/**
 * Query data type of a set of objects, which travels as an object set definition or its resource identifier.
 *
 * **Gotchas**
 *
 * As for {@link ObjectReferenceType}, the wire states the object type under
 * two keys. Here both are optional.
 *
 * @category models
 * @since 0.0.0
 */
export class ObjectSetType extends S.Opaque<ObjectSetType, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("objectSet"),
    objectApiName: S.OptionFromOptionalKey(ObjectTypeApiName).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Object type of the set's members, as the wire repeats it under a second key." })
    ),
    objectTypeApiName: S.OptionFromOptionalKey(ObjectTypeApiName).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Object type of the set's members, when the query fixes one." })
    ),
  }).pipe(
    $I.annoteSchema("ObjectSetType", {
      description: "Query data type of a set of objects, which travels as an object set definition or its identifier.",
    })
  )
) {}

/**
 * Query data type of a reference to one object seen through an interface.
 *
 * **Details**
 *
 * The value names the concrete object type and the primary key together,
 * because an interface alone does not say which object type a key belongs to.
 *
 * @category models
 * @since 0.0.0
 */
export class InterfaceObjectReferenceType extends S.Opaque<
  InterfaceObjectReferenceType,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    type: S.tag("interfaceObject"),
    interfaceTypeApiName: S.OptionFromOptionalKey(InterfaceTypeApiName).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Interface the referenced object implements, when the query fixes one." })
    ),
  }).pipe(
    $I.annoteSchema("InterfaceObjectReferenceType", {
      description: "Query data type of a reference to one object seen through an interface.",
    })
  )
) {}

/**
 * Query data type of a set of objects that all implement one interface.
 *
 * @category models
 * @since 0.0.0
 */
export class InterfaceObjectSetType extends S.Opaque<InterfaceObjectSetType, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("interfaceObjectSet"),
    interfaceTypeApiName: InterfaceTypeApiName.annotateKey({
      description: "Interface every member of the set implements.",
    }),
  }).pipe(
    $I.annoteSchema("InterfaceObjectSetType", {
      description: "Query data type of a set of objects that all implement one interface.",
    })
  )
) {}

/**
 * Query data type that stands for another one, stored by name on the enclosing query type.
 *
 * **Details**
 *
 * This by-name indirection is the only way a query data type can contain
 * itself, for example a tree node whose children are tree nodes. Look the name
 * up with {@link resolveTypeReference}.
 *
 * @category models
 * @since 0.0.0
 */
export class TypeReferenceType extends S.Opaque<TypeReferenceType, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("typeReference"),
    typeId: TypeReferenceId.annotateKey({ description: "Name of the referenced type on the enclosing query type." }),
  }).pipe(
    $I.annoteSchema("TypeReferenceType", {
      description: "Query data type that stands for another one, stored by name on the enclosing query type.",
    })
  )
) {}

// -----------------------------------------------------------------------------
// The query data type union
// -----------------------------------------------------------------------------

/**
 * Everything a query parameter or a query output can hold: 26 cases, five of which contain further data types.
 *
 * **Details**
 *
 * Compared with properties, queries have no byte, short, decimal or binary,
 * and they add sets, entry sets, unions, object and interface references,
 * aggregations, by-name type references and the unit tags `null` and `void`.
 *
 * **Example** (Decode a list type and classify it)
 *
 * ```ts import.meta.vitest name="Decode a list type and classify it"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { QueryDataType } from "@beep/scratchpad/osdk/src/Query/index"
 *
 * const isCollection = QueryDataType.isAnyOf(["array", "set", "entrySet"])
 * const names = await Effect.runPromise(
 *   S.decodeUnknownEffect(QueryDataType)({ type: "array", subType: { type: "string" } })
 * )
 * const element = QueryDataType.guards.array(names) ? names.elementType.type : "none"
 * const facts = [isCollection(names), element, QueryDataType.discriminants.length]
 * facts // => [true, "string", 26]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const QueryDataType = QueryDataTypeKind.mapMembers(() =>
  Tuple.make(
    BooleanType,
    IntegerType,
    LongType,
    FloatType,
    DoubleType,
    StringType,
    DateType,
    TimestampType,
    AttachmentType,
    MediaReferenceType,
    GeoShapeType,
    QueryArrayType,
    QuerySetType,
    EntrySetType,
    QueryStructType,
    QueryUnionType,
    ObjectReferenceType,
    ObjectSetType,
    InterfaceObjectReferenceType,
    InterfaceObjectSetType,
    TwoDimensionalAggregationType,
    ThreeDimensionalAggregationType,
    TypeReferenceType,
    NullType,
    VoidType,
    UnsupportedType
  )
).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("QueryDataType", {
    description: "Everything a query parameter or a query output can hold.",
  })
);

/**
 * Runtime type of {@link QueryDataType}.
 *
 * @category models
 * @since 0.0.0
 */
export type QueryDataType =
  | BooleanType
  | IntegerType
  | LongType
  | FloatType
  | DoubleType
  | StringType
  | DateType
  | TimestampType
  | AttachmentType
  | MediaReferenceType
  | GeoShapeType
  | QueryArrayType
  | QuerySetType
  | EntrySetType
  | QueryStructType
  | QueryUnionType
  | ObjectReferenceType
  | ObjectSetType
  | InterfaceObjectReferenceType
  | InterfaceObjectSetType
  | TwoDimensionalAggregationType
  | ThreeDimensionalAggregationType
  | TypeReferenceType
  | NullType
  | VoidType
  | UnsupportedType;

/**
 * Companion namespace for {@link QueryDataType}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace QueryDataType {
  /**
   * Encoded (wire) form of {@link QueryDataType}, declared explicitly because the union is recursive.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded =
    | (typeof BooleanType)["Encoded"]
    | (typeof IntegerType)["Encoded"]
    | (typeof LongType)["Encoded"]
    | (typeof FloatType)["Encoded"]
    | (typeof DoubleType)["Encoded"]
    | (typeof StringType)["Encoded"]
    | (typeof DateType)["Encoded"]
    | (typeof TimestampType)["Encoded"]
    | (typeof AttachmentType)["Encoded"]
    | (typeof MediaReferenceType)["Encoded"]
    | (typeof GeoShapeType)["Encoded"]
    | QueryArrayType.Encoded
    | QuerySetType.Encoded
    | EntrySetType.Encoded
    | QueryStructType.Encoded
    | QueryUnionType.Encoded
    | (typeof ObjectReferenceType)["Encoded"]
    | (typeof ObjectSetType)["Encoded"]
    | (typeof InterfaceObjectReferenceType)["Encoded"]
    | (typeof InterfaceObjectSetType)["Encoded"]
    | (typeof TwoDimensionalAggregationType)["Encoded"]
    | (typeof ThreeDimensionalAggregationType)["Encoded"]
    | (typeof TypeReferenceType)["Encoded"]
    | (typeof NullType)["Encoded"]
    | (typeof VoidType)["Encoded"]
    | (typeof UnsupportedType)["Encoded"];
}

const isNullType = QueryDataType.guards.null;

/**
 * Reads a data type as "this or nothing": the alternative that remains once the `null` tag is set aside.
 *
 * **Details**
 *
 * A query says a value may be missing by wrapping its type in a union with the
 * `null` tag. The result is `some` exactly when the type is such a union and
 * something other than `null` remains: the one remaining member, or a union
 * of the remaining members when there are several. It is `none` for every
 * type that is not a union containing `null`, and for a union of nothing but
 * `null`. Only the union's own members are inspected, so a projection that
 * recurses reads nested unions at their own level.
 *
 * OSDK looks for the `null` member with `type != null`, a comparison against
 * JavaScript `null` that every member passes. It therefore always picks the
 * first member, and a union listing `null` first fails to convert. Matching on
 * the tag makes the position irrelevant.
 *
 * **Example** (Read an optional integer whichever way round it is declared)
 *
 * ```ts import.meta.vitest name="Read an optional integer whichever way round it is declared"
 * import * as O from "effect/Option"
 * import { IntegerType, NullType } from "@beep/scratchpad/osdk/src/DataType/index"
 * import { nonNullAlternative, QueryUnionType } from "@beep/scratchpad/osdk/src/Query/index"
 *
 * const read = (unionTypes: QueryUnionType["unionTypes"]) =>
 *   O.match(nonNullAlternative(QueryUnionType.make({ unionTypes })), {
 *     onNone: () => "required",
 *     onSome: (alternative) => `optional ${alternative.type}`,
 *   })
 * const readings = [
 *   read([NullType.make({}), IntegerType.make({})]),
 *   read([IntegerType.make({}), NullType.make({})]),
 *   read([IntegerType.make({})]),
 * ]
 * readings // => ["optional integer", "optional integer", "required"]
 * ```
 *
 * @param dataType - The data type to read.
 * @returns The non-null alternative when the type is a union with the `null` tag, otherwise none.
 * @category getters
 * @since 0.0.0
 */
export const nonNullAlternative: (dataType: QueryDataType) => O.Option<QueryDataType> = QueryDataType.matchOrElse(
  {
    union: ({ unionTypes }) =>
      A.some(unionTypes, isNullType)
        ? pipe(
            A.filter(unionTypes, P.not(isNullType)),
            A.match({
              onEmpty: O.none<QueryDataType>,
              onNonEmpty: (alternatives) =>
                O.some<QueryDataType>(
                  alternatives.length === 1
                    ? A.headNonEmpty(alternatives)
                    : QueryUnionType.make({ unionTypes: alternatives })
                ),
            })
          )
        : O.none<QueryDataType>(),
  },
  O.none<QueryDataType>
);

// -----------------------------------------------------------------------------
// Query definitions
// -----------------------------------------------------------------------------

/**
 * One parameter of a query: what it accepts and whether the caller must supply it.
 *
 * **Details**
 *
 * The parameter's own identifier is the key under which the query type stores
 * this record, so it is not repeated here.
 *
 * **Gotchas**
 *
 * `required` and a union with the `null` tag are two separate statements on
 * the wire. OSDK discards `required` and reads optionality from the union
 * alone; both are kept here.
 *
 * @category models
 * @since 0.0.0
 */
export class QueryParameter extends S.Opaque<QueryParameter, { readonly brand: unique symbol }>()(
  S.Struct({
    description: S.OptionFromOptionalKey(S.String).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "What the parameter means." })
    ),
    dataType: QueryDataType.annotateKey({ description: "What the parameter accepts." }),
    required: S.Boolean.annotateKey({ description: "Whether a call must supply the parameter." }),
  }).pipe(
    $I.annoteSchema("QueryParameter", {
      description: "One parameter of a query: what it accepts and whether the caller must supply it.",
    })
  )
) {}

/**
 * The signature of a query at one version: its parameters, its output and the types they refer to by name.
 *
 * **Details**
 *
 * A query is a function published through the ontology, which is why its
 * resource identifier and version are those of a function. Every published
 * version has its own signature. "The latest version" is not a version: a
 * caller asks for it by not naming one.
 *
 * **Example** (Decode a query type and read its signature)
 *
 * ```ts import.meta.vitest name="Decode a query type and read its signature"
 * import * as Effect from "effect/Effect"
 * import * as R from "effect/Record"
 * import * as S from "effect/Schema"
 * import { QueryType } from "@beep/scratchpad/osdk/src/Query/index"
 *
 * const addOne = await Effect.runPromise(
 *   S.decodeUnknownEffect(QueryType)({
 *     apiName: "addOne",
 *     parameters: { n: { dataType: { type: "integer" }, required: true } },
 *     output: { type: "integer" },
 *     rid: "ri.function-registry.main.function.abd64ff3-276e-48c5-afee-5a6ef0b2ea47",
 *     version: "0.0.9",
 *   })
 * )
 * const signature = [R.keys(addOne.parameters), addOne.output.type, addOne.version, R.size(addOne.typeReferences)]
 * signature // => [["n"], "integer", "0.0.9", 0]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class QueryType extends S.Opaque<QueryType, { readonly brand: unique symbol }>()(
  S.Struct({
    apiName: QueryApiName.annotateKey({ description: "Name under which the query is called." }),
    description: S.OptionFromOptionalKey(S.String).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "What the query does." })
    ),
    displayName: S.OptionFromOptionalKey(S.String).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Human-readable name." })
    ),
    parameters: S.Record(ParameterId, QueryParameter).pipe(
      S.withConstructorDefault(Effect.succeed(R.empty<ParameterId, QueryParameter>())),
      S.annotateKey({ description: "Parameters of the query, keyed by their identifier." })
    ),
    output: QueryDataType.annotateKey({ description: "What the query returns." }),
    rid: FunctionRid.annotateKey({ description: "Resource identifier of the function behind the query." }),
    version: FunctionVersion.annotateKey({ description: "Version of the function this signature belongs to." }),
    typeReferences: S.Record(TypeReferenceId, QueryDataType).pipe(
      S.withConstructorDefault(Effect.succeed(R.empty<TypeReferenceId, QueryDataType>())),
      S.withDecodingDefaultKey(Effect.succeed(R.empty<string, QueryDataType.Encoded>())),
      S.annotateKey({
        description: "Data types the parameters and the output refer to by name, which lets a type contain itself.",
      })
    ),
  }).pipe(
    $I.annoteSchema("QueryType", {
      description: "The signature of a query at one version: its parameters, its output and the types they name.",
    })
  )
) {}

/**
 * Looks up the data type a by-name reference stands for on its query type.
 *
 * **Details**
 *
 * The lookup is one step and total: an unknown name is `none`, where OSDK
 * throws `Unknown typeReference`. The result may itself be a reference, or
 * contain the reference that was just resolved; that is how a recursive type
 * is spelled, so a caller that unfolds references decides how deep to go.
 *
 * **Example** (Unfold a recursive tree node one level)
 *
 * ```ts import.meta.vitest name="Unfold a recursive tree node one level"
 * import * as Effect from "effect/Effect"
 * import { pipe } from "effect/Function"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import {
 *   QueryType,
 *   resolveTypeReference,
 *   TypeReferenceId,
 *   TypeReferenceType,
 * } from "@beep/scratchpad/osdk/src/Query/index"
 *
 * const walkTree = await Effect.runPromise(
 *   S.decodeUnknownEffect(QueryType)({
 *     apiName: "walkTree",
 *     parameters: {},
 *     output: { type: "typeReference", typeId: "tree-node" },
 *     rid: "ri.function-registry.main.function.d4f69e63-9531-55ff-0a1c-4896e0a0bee5",
 *     version: "0.1.0",
 *     typeReferences: {
 *       "tree-node": {
 *         type: "struct",
 *         fields: [
 *           {
 *             name: "children",
 *             fieldType: { type: "array", subType: { type: "typeReference", typeId: "tree-node" } },
 *           },
 *         ],
 *       },
 *     },
 *   })
 * )
 * const tagOf = (name: string) =>
 *   pipe(
 *     walkTree,
 *     resolveTypeReference(TypeReferenceType.make({ typeId: TypeReferenceId.make(name) })),
 *     O.match({ onNone: () => "unknown", onSome: (dataType) => dataType.type })
 *   )
 * const tags = [tagOf("tree-node"), tagOf("forest")]
 * tags // => ["struct", "unknown"]
 * ```
 *
 * @param queryType - The query type whose named types are searched.
 * @param reference - The by-name reference to resolve.
 * @returns The referenced data type, or none when the query type does not define the name.
 * @category getters
 * @since 0.0.0
 */
export const resolveTypeReference: {
  (reference: TypeReferenceType): (queryType: QueryType) => O.Option<QueryDataType>;
  (queryType: QueryType, reference: TypeReferenceType): O.Option<QueryDataType>;
} = dual(
  2,
  (queryType: QueryType, reference: TypeReferenceType): O.Option<QueryDataType> =>
    R.get(queryType.typeReferences, reference.typeId)
);

// -----------------------------------------------------------------------------
// Aggregation values
// -----------------------------------------------------------------------------

/**
 * A range key of an aggregation: from an inclusive start value to an exclusive end value.
 *
 * **Details**
 *
 * Either bound may be absent, which leaves the range open on that side, but
 * not both. The wire record marks both keys optional and says no more; the
 * rule that one must be present is the one OSDK's own range type states. The
 * bounds are scalars of the type the aggregation's range key declares, held as
 * the wire scalar that carries them: a date or an instant bound is its text.
 *
 * **Example** (Accept a half-open range and reject an unbounded one)
 *
 * ```ts import.meta.vitest name="Accept a half-open range and reject an unbounded one"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { QueryRange } from "@beep/scratchpad/osdk/src/Query/index"
 *
 * const decode = S.decodeUnknownOption(QueryRange)
 * const verdicts = [
 *   O.isSome(decode({ startValue: "2010-10-01T00:00:00Z" })),
 *   O.isSome(decode({ startValue: 0, endValue: 10 })),
 *   O.isSome(decode({})),
 * ]
 * verdicts // => [true, true, false]
 * ```
 *
 * @invariant At least one of `startValue` and `endValue` is present.
 * @category models
 * @since 0.0.0
 */
export class QueryRange extends S.Opaque<QueryRange, { readonly brand: unique symbol }>()(
  S.Struct({
    startValue: S.OptionFromOptionalKey(ScalarValue).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Inclusive lower bound, absent when the range is open below." })
    ),
    endValue: S.OptionFromOptionalKey(ScalarValue).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Exclusive upper bound, absent when the range is open above." })
    ),
  })
    .check(
      S.makeFilter(
        ({ startValue, endValue }) => O.isSome(startValue) || O.isSome(endValue),
        $I.annote("QueryRangeBoundCheck", {
          title: "Bounded Query Range",
          description: "A range that states its start, its end or both.",
          message: "A range needs a startValue, an endValue or both",
        })
      )
    )
    .pipe(
      $I.annoteSchema("QueryRange", {
        description: "A range key of an aggregation: from an inclusive start value to an exclusive end value.",
      })
    )
) {}

/**
 * What one group of an aggregation is keyed by: a scalar, or a range of scalars.
 *
 * **Example** (Decode both kinds of key)
 *
 * ```ts import.meta.vitest name="Decode both kinds of key"
 * import * as Effect from "effect/Effect"
 * import * as P from "effect/Predicate"
 * import * as S from "effect/Schema"
 * import { QueryAggregationKey } from "@beep/scratchpad/osdk/src/Query/index"
 *
 * const decode = S.decodeUnknownEffect(QueryAggregationKey)
 * const keys = await Effect.runPromise(Effect.all([decode("Q-AFN"), decode({ startValue: 0, endValue: 10 })]))
 * const kinds = [P.isString(keys[0]), P.isObject(keys[1])]
 * kinds // => [true, true]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const QueryAggregationKey = S.Union([ScalarValue, QueryRange]).pipe(
  $I.annoteSchema("QueryAggregationKey", {
    description: "What one group of an aggregation is keyed by: a scalar, or a range of scalars.",
  })
);

/**
 * Runtime type of {@link QueryAggregationKey}.
 *
 * @category models
 * @since 0.0.0
 */
export type QueryAggregationKey = typeof QueryAggregationKey.Type;

/**
 * One group of an aggregation: its key and the value measured for it.
 *
 * @category models
 * @since 0.0.0
 */
export class QueryAggregationGroup extends S.Opaque<QueryAggregationGroup, { readonly brand: unique symbol }>()(
  S.Struct({
    key: QueryAggregationKey.annotateKey({ description: "What the group is keyed by." }),
    value: ScalarValue.annotateKey({ description: "The value measured for the group." }),
  }).pipe(
    $I.annoteSchema("QueryAggregationGroup", {
      description: "One group of an aggregation: its key and the value measured for it.",
    })
  )
) {}

/**
 * One outer group of an aggregation grouped twice: its key and the inner groups found under it.
 *
 * @category models
 * @since 0.0.0
 */
export class NestedQueryAggregationGroup extends S.Opaque<
  NestedQueryAggregationGroup,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    key: QueryAggregationKey.annotateKey({ description: "What the outer group is keyed by." }),
    groups: S.Array(QueryAggregationGroup).annotateKey({ description: "Inner groups found under the outer key." }),
  }).pipe(
    $I.annoteSchema("NestedQueryAggregationGroup", {
      description: "One outer group of an aggregation grouped twice: its key and the inner groups found under it.",
    })
  )
) {}

/**
 * A grouped measurement passed to or returned by a query: one value per group key.
 *
 * **Details**
 *
 * OSDK strips the `groups` envelope and hands the caller a bare array. The
 * envelope is kept here, so the value is exactly what travels.
 *
 * **Example** (Decode a two-dimensional aggregation)
 *
 * ```ts import.meta.vitest name="Decode a two-dimensional aggregation"
 * import * as A from "effect/Array"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { TwoDimensionalAggregation } from "@beep/scratchpad/osdk/src/Query/index"
 *
 * const aggregation = await Effect.runPromise(
 *   S.decodeUnknownEffect(TwoDimensionalAggregation)({
 *     groups: [
 *       { key: "Q-AFN", value: 1 },
 *       { key: "Q-AFO", value: 2 },
 *     ],
 *   })
 * )
 * const values = A.map(aggregation.groups, (group) => group.value)
 * values // => [1, 2]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TwoDimensionalAggregation extends S.Opaque<TwoDimensionalAggregation, { readonly brand: unique symbol }>()(
  S.Struct({
    groups: S.Array(QueryAggregationGroup).annotateKey({
      description: "The groups, in the order the query produced them.",
    }),
  }).pipe(
    $I.annoteSchema("TwoDimensionalAggregation", {
      description: "A grouped measurement passed to or returned by a query: one value per group key.",
    })
  )
) {}

/**
 * A measurement grouped twice, passed to or returned by a query: one value per pair of outer and inner keys.
 *
 * **Example** (Decode a three-dimensional aggregation with a range key)
 *
 * ```ts import.meta.vitest name="Decode a three-dimensional aggregation with a range key"
 * import * as A from "effect/Array"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { ThreeDimensionalAggregation } from "@beep/scratchpad/osdk/src/Query/index"
 *
 * const aggregation = await Effect.runPromise(
 *   S.decodeUnknownEffect(ThreeDimensionalAggregation)({
 *     groups: [
 *       {
 *         key: "Q-AFN",
 *         groups: [{ key: { startValue: "2010-10-01T00:00:00Z", endValue: "2010-10-02T00:00:00Z" }, value: 65 }],
 *       },
 *       { key: "Q-AFO", groups: [] },
 *     ],
 *   })
 * )
 * const sizes = A.map(aggregation.groups, (outer) => outer.groups.length)
 * sizes // => [1, 0]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ThreeDimensionalAggregation extends S.Opaque<
  ThreeDimensionalAggregation,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    groups: S.Array(NestedQueryAggregationGroup).annotateKey({
      description: "The outer groups, in the order the query produced them.",
    }),
  }).pipe(
    $I.annoteSchema("ThreeDimensionalAggregation", {
      description: "A measurement grouped twice: one value per pair of outer and inner group keys.",
    })
  )
) {}

// -----------------------------------------------------------------------------
// Execution
// -----------------------------------------------------------------------------

/**
 * The arguments of one query call, keyed by parameter.
 *
 * **Details**
 *
 * Without the query type in hand an argument is only JSON. A parameter may be
 * left out of the record, which is not the same message as supplying `null`.
 * The version to run is not part of this body; a call that names none runs
 * the latest.
 *
 * **Example** (Send one argument)
 *
 * ```ts import.meta.vitest name="Send one argument"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { ExecuteQueryRequest } from "@beep/scratchpad/osdk/src/Query/index"
 *
 * const request = await Effect.runPromise(
 *   S.decodeUnknownEffect(ExecuteQueryRequest)({ parameters: { people: ["Brad", "George", "Ryan"] } })
 * )
 * const wire = await Effect.runPromise(S.encodeEffect(ExecuteQueryRequest)(request))
 * wire // => { parameters: { people: ["Brad", "George", "Ryan"] } }
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ExecuteQueryRequest extends S.Opaque<ExecuteQueryRequest, { readonly brand: unique symbol }>()(
  S.Struct({
    parameters: S.Record(ParameterId, S.Json).pipe(
      S.withConstructorDefault(Effect.succeed(R.empty<ParameterId, S.Json>())),
      S.annotateKey({ description: "Arguments of the call, keyed by parameter identifier." })
    ),
  }).pipe(
    $I.annoteSchema("ExecuteQueryRequest", { description: "The arguments of one query call, keyed by parameter." })
  )
) {}

/**
 * The result of one query call.
 *
 * @category models
 * @since 0.0.0
 */
export class ExecuteQueryResponse extends S.Opaque<ExecuteQueryResponse, { readonly brand: unique symbol }>()(
  S.Struct({
    value: S.Json.annotateKey({ description: "What the query returned, shaped by the query type's output." }),
  }).pipe($I.annoteSchema("ExecuteQueryResponse", { description: "The result of one query call." }))
) {}

const QueryStreamEventKind = LiteralKit(["data", "error"]);

/**
 * One batch of results of a streaming query call.
 *
 * @category models
 * @since 0.0.0
 */
export class QueryStreamData extends S.Opaque<QueryStreamData, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("data"),
    value: S.Json.annotateKey({ description: "The batch, shaped by the query type's output." }),
  }).pipe($I.annoteSchema("QueryStreamData", { description: "One batch of results of a streaming query call." }))
) {}

/**
 * Notice, sent in place of further results, that a streaming query call failed while running.
 *
 * @category models
 * @since 0.0.0
 */
export class QueryStreamFailure extends S.Opaque<QueryStreamFailure, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("error"),
    errorCode: S.String.annotateKey({ description: "Broad class of the failure, such as an invalid argument." }),
    errorName: S.String.annotateKey({ description: "Specific name of the failure." }),
    errorInstanceId: S.String.annotateKey({ description: "Identifier of this occurrence, for support requests." }),
    errorDescription: S.OptionFromOptionalKey(S.String).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Human-readable account of the failure." })
    ),
    parameters: S.Record(S.String, S.Json).pipe(
      S.withConstructorDefault(Effect.succeed(R.empty<string, S.Json>())),
      S.annotateKey({ description: "Named details of the failure, verbatim." })
    ),
  }).pipe(
    $I.annoteSchema("QueryStreamFailure", {
      description: "Notice that a streaming query call failed while running.",
    })
  )
) {}

/**
 * One server-sent event of a streaming query call: a batch of results, or the failure that ended the call.
 *
 * **Details**
 *
 * A query that does not stream emits exactly one `data` event.
 *
 * **Example** (Fold a stream event)
 *
 * ```ts import.meta.vitest name="Fold a stream event"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { QueryStreamEvent } from "@beep/scratchpad/osdk/src/Query/index"
 *
 * const summarize = QueryStreamEvent.match({
 *   data: () => "batch",
 *   error: ({ errorName }) => `failed: ${errorName}`,
 * })
 * const event = await Effect.runPromise(
 *   S.decodeUnknownEffect(QueryStreamEvent)({
 *     type: "error",
 *     errorCode: "INVALID_ARGUMENT",
 *     errorName: "QueryRuntimeError",
 *     errorInstanceId: "b2ae7b3e-2c89-42f5-a762-68957a9c039d",
 *     parameters: {},
 *   })
 * )
 * summarize(event) // => "failed: QueryRuntimeError"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const QueryStreamEvent = QueryStreamEventKind.mapMembers(() =>
  Tuple.make(QueryStreamData, QueryStreamFailure)
).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("QueryStreamEvent", {
    description: "One server-sent event of a streaming query call: a batch of results, or the failure that ended it.",
  })
);

/**
 * Runtime type of {@link QueryStreamEvent}.
 *
 * @category models
 * @since 0.0.0
 */
export type QueryStreamEvent = typeof QueryStreamEvent.Type;

/**
 * Names the signature of one function: by resource identifier, at a stated version or at the latest.
 *
 * **Example** (Ask for the latest version by not naming one)
 *
 * ```ts import.meta.vitest name="Ask for the latest version by not naming one"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { FunctionRid } from "@beep/scratchpad/osdk/src/Identifier/index"
 * import { QueryTypeByRid } from "@beep/scratchpad/osdk/src/Query/index"
 *
 * const latest = QueryTypeByRid.make({
 *   queryTypeRid: FunctionRid.make("ri.function-registry.main.function.9b55870a-63c7-4d48-8f06-9627c0805968"),
 * })
 * const wire = await Effect.runPromise(S.encodeEffect(QueryTypeByRid)(latest))
 * wire // => { queryTypeRid: "ri.function-registry.main.function.9b55870a-63c7-4d48-8f06-9627c0805968" }
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class QueryTypeByRid extends S.Opaque<QueryTypeByRid, { readonly brand: unique symbol }>()(
  S.Struct({
    queryTypeRid: FunctionRid.annotateKey({ description: "Resource identifier of the function behind the query." }),
    functionVersion: S.OptionFromOptionalKey(FunctionVersion).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Version whose signature is wanted, absent to ask for the latest." })
    ),
  }).pipe(
    $I.annoteSchema("QueryTypeByRid", {
      description: "Names the signature of one function: by resource identifier, at a stated version or the latest.",
    })
  )
) {}

/**
 * Asks for the signatures of several functions at once.
 *
 * @category models
 * @since 0.0.0
 */
export class GetQueryTypesByRidRequest extends S.Opaque<GetQueryTypesByRidRequest, { readonly brand: unique symbol }>()(
  S.Struct({
    requests: S.Array(QueryTypeByRid).annotateKey({ description: "The functions whose signatures are wanted." }),
  }).pipe(
    $I.annoteSchema("GetQueryTypesByRidRequest", {
      description: "Asks for the signatures of several functions at once.",
    })
  )
) {}

/**
 * The signatures found for a batch request.
 *
 * @category models
 * @since 0.0.0
 */
export class GetQueryTypesByRidResponse extends S.Opaque<
  GetQueryTypesByRidResponse,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    data: S.Array(QueryType).annotateKey({ description: "The query types that were found." }),
  }).pipe($I.annoteSchema("GetQueryTypesByRidResponse", { description: "The signatures found for a batch request." }))
) {}
