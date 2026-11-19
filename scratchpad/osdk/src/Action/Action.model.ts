/**
 * Actions: what an action type declares, what a request to apply one carries and what comes back.
 *
 * **Details**
 *
 * OSDK keeps two models of an action. The wire one is faithful but untyped
 * where it matters (`DataValue = any`), and the client one inverts `required`
 * into `nullable`, erases list parameters into a `multiplicity` flag, renames
 * `date` to `datetime` and regroups result edits into five arrays. Here there
 * is one model whose encoded side is the Foundry JSON:
 *
 * - {@link ActionParameterType} is the wire's own recursive union of 22 cases,
 *   in which a list is a type like any other.
 * - {@link ActionArguments} separates the three intents a parameter can have
 *   in a request (leave untouched, clear, set) instead of overloading
 *   `undefined` and `null`.
 * - {@link ActionEdits} and {@link ActionValidation} are tagged unions all the
 *   way down, so reading a result is an exhaustive match.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import * as R from "@beep/utils/Record";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Match from "effect/Match";
import * as S from "effect/Schema";
import * as Tuple from "effect/Tuple";
import { SizeBytes } from "../Attachment/Attachment.model.ts";
import {
  AnyType,
  AttachmentType,
  BinaryType,
  BooleanType,
  ByteType,
  CipherTextType,
  DateType,
  DecimalType,
  DoubleType,
  FloatType,
  GeohashType,
  GeoShapeType,
  IntegerType,
  LongType,
  MarkingType,
  MediaReferenceType,
  ObjectTypeReferenceType,
  ScenarioReferenceType,
  ShortType,
  StringType,
  TimeSeriesReferenceType,
  TimestampType,
  UnsupportedType,
  VectorType,
} from "../DataType/DataType.model.ts";
import { ActionParameterTypeKind } from "../DataType/DataType.values.ts";
import {
  ActionTypeApiName,
  ActionTypeRid,
  InterfaceTypeApiName,
  LinkTypeApiName,
  ObjectTypeApiName,
  ParameterId,
  StructFieldApiName,
  ValueTypeApiName,
  ValueTypeRid,
} from "../Identifier/Identifier.model.ts";
import { RecursiveArraySizeHint } from "../internal/RecursionHint.ts";
import { ReleaseStatus, TypeClass } from "../Metadata/Metadata.values.ts";
import {
  ActionEditsKind,
  ActionOperationKind,
  AllowedValuesKind,
  ApplyActionMode,
  BatchObjectEditKind,
  BatchReturnEditsMode,
  ConstraintBoundKind,
  DatetimeBoundKind,
  EvaluatedConstraintKind,
  ObjectEditKind,
  OntologyDataTypeKind,
  RelativeDatetimeTense,
  RelativeDatetimeUnit,
  ReturnEditsMode,
  StructFieldConstraintKind,
  ValidationResult,
} from "./Action.values.ts";

const $I = $ScratchpadId.create("osdk/Action/Action.model");

const suspendedParameterType = S.suspend(
  (): S.Codec<ActionParameterType, ActionParameterType.Encoded> => ActionParameterType
);

const suspendedOntologyDataType = S.suspend(
  (): S.Codec<OntologyDataType, OntologyDataType.Encoded> => OntologyDataType
);

// -----------------------------------------------------------------------------
// Reference and composite types shared by parameters and struct fields
// -----------------------------------------------------------------------------

/**
 * Type of a parameter or struct field that holds one object of a given object type.
 *
 * **Details**
 *
 * The wire names the object type twice, as `objectApiName` and as
 * `objectTypeApiName`. Both are required and both are kept, because nothing
 * on the wire promises they are equal. The value is the object's primary key.
 *
 * @category models
 * @since 0.0.0
 */
export class ObjectParameterType extends S.Opaque<ObjectParameterType, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("object"),
    objectApiName: ObjectTypeApiName.annotateKey({ description: "Object type of the referenced object." }),
    objectTypeApiName: ObjectTypeApiName.annotateKey({
      description: "Object type of the referenced object, as the wire repeats it.",
    }),
  }).pipe(
    $I.annoteSchema("ObjectParameterType", {
      description: "Type of a parameter or struct field that holds one object of a given object type.",
    })
  )
) {}

/**
 * Companion namespace for {@link ObjectParameterType}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ObjectParameterType {
  /**
   * Encoded (wire) form of {@link ObjectParameterType}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "object";
    readonly objectApiName: ObjectTypeApiName.Encoded;
    readonly objectTypeApiName: ObjectTypeApiName.Encoded;
  }
}

/**
 * Type of a parameter or struct field that holds a set of objects, optionally of a known object type.
 *
 * @category models
 * @since 0.0.0
 */
export class ObjectSetParameterType extends S.Opaque<ObjectSetParameterType, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("objectSet"),
    objectApiName: S.OptionFromOptionalKey(ObjectTypeApiName).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Object type of the set's members, when the platform states it." })
    ),
    objectTypeApiName: S.OptionFromOptionalKey(ObjectTypeApiName).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Object type of the set's members, as the wire repeats it." })
    ),
  }).pipe(
    $I.annoteSchema("ObjectSetParameterType", {
      description: "Type of a parameter or struct field that holds a set of objects.",
    })
  )
) {}

/**
 * Companion namespace for {@link ObjectSetParameterType}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ObjectSetParameterType {
  /**
   * Encoded (wire) form of {@link ObjectSetParameterType}: an unstated object type is an absent key.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "objectSet";
    readonly objectApiName?: ObjectTypeApiName.Encoded;
    readonly objectTypeApiName?: ObjectTypeApiName.Encoded;
  }
}

/**
 * One named field of a struct parameter.
 *
 * **Details**
 *
 * `required` is the wire's own boolean. OSDK inverts it into `nullable`; here
 * a field that is not required is simply one whose argument may be absent.
 *
 * @category models
 * @since 0.0.0
 */
export class StructParameterField extends S.Opaque<StructParameterField, { readonly brand: unique symbol }>()(
  S.Struct({
    name: StructFieldApiName.annotateKey({ description: "Name of the field within its struct." }),
    fieldType: suspendedOntologyDataType.annotateKey({ description: "Type of the field's value." }),
    required: S.Boolean.annotateKey({ description: "Whether a struct value must carry this field." }),
  }).pipe($I.annoteSchema("StructParameterField", { description: "One named field of a struct parameter." }))
) {}

/**
 * Companion namespace for {@link StructParameterField}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace StructParameterField {
  /**
   * Encoded form of {@link StructParameterField}, declared explicitly because the type is recursive.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly name: StructFieldApiName.Encoded;
    readonly fieldType: OntologyDataType.Encoded;
    readonly required: boolean;
  }
}

/**
 * Type of a parameter or struct field that holds a record with named, individually typed fields.
 *
 * **Details**
 *
 * OSDK reduces this case to a record from field name to a scalar tag and
 * rejects anything nested. The wire allows any ontology data type per field,
 * structs included, and that is what is kept.
 *
 * @category models
 * @since 0.0.0
 */
export class StructParameterType extends S.Opaque<StructParameterType, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("struct"),
    fields: S.Array(StructParameterField)
      .check(RecursiveArraySizeHint)
      .annotateKey({ description: "Fields of the struct, in declaration order." }),
  }).pipe(
    $I.annoteSchema("StructParameterType", {
      description: "Type of a parameter or struct field that holds a record with named, individually typed fields.",
    })
  )
) {}

/**
 * Companion namespace for {@link StructParameterType}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace StructParameterType {
  /**
   * Encoded form of {@link StructParameterType}, declared explicitly because the type is recursive.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "struct";
    readonly fields: ReadonlyArray<StructParameterField.Encoded>;
  }
}

// -----------------------------------------------------------------------------
// Ontology data types (the universe of struct parameter fields)
// -----------------------------------------------------------------------------

/**
 * Ontology data type of a homogeneous list.
 *
 * **Details**
 *
 * The wire key is `itemType`; here it is `elementType`, the one name every
 * list descriptor in this library uses for it.
 *
 * @category models
 * @since 0.0.0
 */
export class OntologyArrayType extends S.Opaque<OntologyArrayType, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("array"),
    elementType: suspendedOntologyDataType.annotateKey({ description: "Type of every element." }),
  }).pipe(
    S.encodeKeys({ elementType: "itemType" }),
    $I.annoteSchema("OntologyArrayType", { description: "Ontology data type of a homogeneous list." })
  )
) {}

/**
 * Companion namespace for {@link OntologyArrayType}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace OntologyArrayType {
  /**
   * Encoded form of {@link OntologyArrayType}, declared explicitly because the type is recursive.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "array";
    readonly itemType: OntologyDataType.Encoded;
  }
}

/**
 * Ontology data type of a collection without duplicates.
 *
 * @category models
 * @since 0.0.0
 */
export class OntologySetType extends S.Opaque<OntologySetType, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("set"),
    elementType: suspendedOntologyDataType.annotateKey({ description: "Type of every member." }),
  }).pipe(
    S.encodeKeys({ elementType: "itemType" }),
    $I.annoteSchema("OntologySetType", { description: "Ontology data type of a collection without duplicates." })
  )
) {}

/**
 * Companion namespace for {@link OntologySetType}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace OntologySetType {
  /**
   * Encoded form of {@link OntologySetType}, declared explicitly because the type is recursive.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "set";
    readonly itemType: OntologyDataType.Encoded;
  }
}

/**
 * Ontology data type of a lookup from keys of one type to values of another.
 *
 * @category models
 * @since 0.0.0
 */
export class OntologyMapType extends S.Opaque<OntologyMapType, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("map"),
    keyType: suspendedOntologyDataType.annotateKey({ description: "Type of every key." }),
    valueType: suspendedOntologyDataType.annotateKey({ description: "Type of every value." }),
  }).pipe(
    $I.annoteSchema("OntologyMapType", {
      description: "Ontology data type of a lookup from keys of one type to values of another.",
    })
  )
) {}

/**
 * Companion namespace for {@link OntologyMapType}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace OntologyMapType {
  /**
   * Encoded form of {@link OntologyMapType}, declared explicitly because the type is recursive.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "map";
    readonly keyType: OntologyDataType.Encoded;
    readonly valueType: OntologyDataType.Encoded;
  }
}

/**
 * Everything a field of a struct parameter can hold: 17 leaf types, three collections, structs and object references.
 *
 * **Details**
 *
 * This is the wire's `OntologyDataType`, the universe that predates typed
 * action parameters. In the current contract it is reachable only through the
 * fields of a {@link StructParameterType}.
 *
 * **Example** (Ask whether a field type is a collection)
 *
 * ```ts import.meta.vitest name="Ask whether a field type is a collection"
 * import { StringType } from "@beep/scratchpad/osdk/src/DataType/index"
 * import { OntologyDataType, OntologySetType } from "@beep/scratchpad/osdk/src/Action/index"
 *
 * const isCollection = OntologyDataType.isAnyOf(["array", "set", "map"])
 * const tags = OntologySetType.make({ elementType: StringType.make({}) })
 * const verdicts = [isCollection(tags), isCollection(StringType.make({})), OntologyDataType.guards.set(tags)]
 * verdicts // => [true, false, true]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const OntologyDataType = OntologyDataTypeKind.mapMembers(() =>
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
    BinaryType,
    MarkingType,
    CipherTextType,
    MediaReferenceType,
    OntologyArrayType,
    OntologySetType,
    OntologyMapType,
    StructParameterType,
    ObjectParameterType,
    ObjectSetParameterType,
    AnyType,
    UnsupportedType
  )
).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("OntologyDataType", {
    description: "Everything a field of a struct action parameter can hold.",
  })
);

/**
 * Runtime type of {@link OntologyDataType}.
 *
 * @category models
 * @since 0.0.0
 */
export type OntologyDataType =
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
  | BinaryType
  | MarkingType
  | CipherTextType
  | MediaReferenceType
  | OntologyArrayType
  | OntologySetType
  | OntologyMapType
  | StructParameterType
  | ObjectParameterType
  | ObjectSetParameterType
  | AnyType
  | UnsupportedType;

/**
 * Companion namespace for {@link OntologyDataType}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace OntologyDataType {
  /**
   * Encoded (wire) form of {@link OntologyDataType}, declared explicitly because the union is recursive.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded =
    | BooleanType.Encoded
    | ByteType.Encoded
    | ShortType.Encoded
    | IntegerType.Encoded
    | LongType.Encoded
    | FloatType.Encoded
    | DoubleType.Encoded
    | DecimalType.Encoded
    | StringType.Encoded
    | DateType.Encoded
    | TimestampType.Encoded
    | BinaryType.Encoded
    | MarkingType.Encoded
    | CipherTextType.Encoded
    | MediaReferenceType.Encoded
    | OntologyArrayType.Encoded
    | OntologySetType.Encoded
    | OntologyMapType.Encoded
    | StructParameterType.Encoded
    | ObjectParameterType.Encoded
    | ObjectSetParameterType.Encoded
    | AnyType.Encoded
    | UnsupportedType.Encoded;
}

// -----------------------------------------------------------------------------
// Action parameter types
// -----------------------------------------------------------------------------

/**
 * Type of a parameter that holds a homogeneous list.
 *
 * **Details**
 *
 * The wire key is `subType`; here it is `elementType`. OSDK erases this case
 * into a `multiplicity: true` flag beside the element's tag, which collapses a
 * list of lists into a list.
 *
 * @category models
 * @since 0.0.0
 */
export class ArrayParameterType extends S.Opaque<ArrayParameterType, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("array"),
    elementType: suspendedParameterType.annotateKey({ description: "Parameter type of every element." }),
  }).pipe(
    S.encodeKeys({ elementType: "subType" }),
    $I.annoteSchema("ArrayParameterType", { description: "Type of a parameter that holds a homogeneous list." })
  )
) {}

/**
 * Companion namespace for {@link ArrayParameterType}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ArrayParameterType {
  /**
   * Encoded form of {@link ArrayParameterType}, declared explicitly because the type is recursive.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "array";
    readonly subType: ActionParameterType.Encoded;
  }
}

/**
 * Type of a parameter that holds one object addressed through an interface it implements.
 *
 * **Details**
 *
 * The value names the concrete object type and the primary key, because an
 * interface alone does not identify an object.
 *
 * @category models
 * @since 0.0.0
 */
export class InterfaceObjectParameterType extends S.Opaque<
  InterfaceObjectParameterType,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    type: S.tag("interfaceObject"),
    interfaceTypeApiName: S.OptionFromOptionalKey(InterfaceTypeApiName).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Interface the object must implement, when the platform states it." })
    ),
  }).pipe(
    $I.annoteSchema("InterfaceObjectParameterType", {
      description: "Type of a parameter that holds one object addressed through an interface it implements.",
    })
  )
) {}

/**
 * Companion namespace for {@link InterfaceObjectParameterType}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace InterfaceObjectParameterType {
  /**
   * Encoded (wire) form of {@link InterfaceObjectParameterType}: an unstated interface is an absent key.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "interfaceObject";
    readonly interfaceTypeApiName?: InterfaceTypeApiName.Encoded;
  }
}

/**
 * Everything a parameter of an action can hold: 15 leaf types, lists, structs and five kinds of reference.
 *
 * **Details**
 *
 * Compared with property types there is no `byte`, `short`, `float`,
 * `geopoint`, `cipherText`, `geotimeSeriesReference` or `timeseries`;
 * parameters add `geohash`, `timeSeriesReference` and references to objects,
 * object sets, interface objects, object types and scenarios.
 *
 * **Example** (Render a parameter type with one recursive match)
 *
 * ```ts import.meta.vitest name="Render a parameter type with one recursive match"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { ActionParameterType } from "@beep/scratchpad/osdk/src/Action/index"
 *
 * const render: (type: ActionParameterType) => string = ActionParameterType.matchOrElse(
 *   {
 *     array: ({ elementType }) => `list of ${render(elementType)}`,
 *     object: ({ objectTypeApiName }) => `one ${objectTypeApiName}`,
 *   },
 *   ({ type }) => type
 * )
 * const employees = await Effect.runPromise(
 *   S.decodeUnknownEffect(ActionParameterType)({
 *     type: "array",
 *     subType: { type: "object", objectApiName: "Employee", objectTypeApiName: "Employee" },
 *   })
 * )
 * render(employees) // => "list of one Employee"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ActionParameterType = ActionParameterTypeKind.mapMembers(() =>
  Tuple.make(
    BooleanType,
    IntegerType,
    LongType,
    DoubleType,
    DecimalType,
    StringType,
    DateType,
    TimestampType,
    MarkingType,
    AttachmentType,
    MediaReferenceType,
    GeoShapeType,
    GeohashType,
    TimeSeriesReferenceType,
    VectorType,
    ArrayParameterType,
    StructParameterType,
    ObjectParameterType,
    ObjectSetParameterType,
    InterfaceObjectParameterType,
    ObjectTypeReferenceType,
    ScenarioReferenceType
  )
).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("ActionParameterType", {
    description: "Everything a parameter of an action can hold: leaf types, lists, structs and references.",
  })
);

/**
 * Runtime type of {@link ActionParameterType}.
 *
 * @category models
 * @since 0.0.0
 */
export type ActionParameterType =
  | BooleanType
  | IntegerType
  | LongType
  | DoubleType
  | DecimalType
  | StringType
  | DateType
  | TimestampType
  | MarkingType
  | AttachmentType
  | MediaReferenceType
  | GeoShapeType
  | GeohashType
  | TimeSeriesReferenceType
  | VectorType
  | ArrayParameterType
  | StructParameterType
  | ObjectParameterType
  | ObjectSetParameterType
  | InterfaceObjectParameterType
  | ObjectTypeReferenceType
  | ScenarioReferenceType;

/**
 * Companion namespace for {@link ActionParameterType}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ActionParameterType {
  /**
   * Encoded (wire) form of {@link ActionParameterType}, declared explicitly because the union is recursive.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded =
    | BooleanType.Encoded
    | IntegerType.Encoded
    | LongType.Encoded
    | DoubleType.Encoded
    | DecimalType.Encoded
    | StringType.Encoded
    | DateType.Encoded
    | TimestampType.Encoded
    | MarkingType.Encoded
    | AttachmentType.Encoded
    | MediaReferenceType.Encoded
    | GeoShapeType.Encoded
    | GeohashType.Encoded
    | TimeSeriesReferenceType.Encoded
    | VectorType.Encoded
    | ArrayParameterType.Encoded
    | StructParameterType.Encoded
    | ObjectParameterType.Encoded
    | ObjectSetParameterType.Encoded
    | InterfaceObjectParameterType.Encoded
    | ObjectTypeReferenceType.Encoded
    | ScenarioReferenceType.Encoded;
}

// -----------------------------------------------------------------------------
// Configured parameter validation (published with the action type)
// -----------------------------------------------------------------------------

/**
 * A bound whose value is a literal.
 *
 * @category models
 * @since 0.0.0
 */
export class StaticBound extends S.Opaque<StaticBound, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("static"),
    value: S.Json.annotateKey({ description: "The literal bound, in the wire encoding of the parameter's type." }),
  }).pipe($I.annoteSchema("StaticBound", { description: "A bound whose value is a literal." }))
) {}

/**
 * Companion namespace for {@link StaticBound}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace StaticBound {
  /**
   * Encoded (wire) form of {@link StaticBound}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "static";
    readonly value: typeof S.Json.Encoded;
  }
}

/**
 * A bound whose value is the number of elements of another list parameter.
 *
 * @category models
 * @since 0.0.0
 */
export class ParameterLengthBound extends S.Opaque<ParameterLengthBound, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("parameterLength"),
    parameterId: ParameterId.annotateKey({ description: "List parameter whose element count is the bound." }),
  }).pipe(
    $I.annoteSchema("ParameterLengthBound", {
      description: "A bound whose value is the number of elements of another list parameter.",
    })
  )
) {}

/**
 * Companion namespace for {@link ParameterLengthBound}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ParameterLengthBound {
  /**
   * Encoded (wire) form of {@link ParameterLengthBound}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "parameterLength";
    readonly parameterId: ParameterId.Encoded;
  }
}

/**
 * A bound whose value is the value of another parameter.
 *
 * @category models
 * @since 0.0.0
 */
export class ParameterValueBound extends S.Opaque<ParameterValueBound, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("parameterValue"),
    parameterId: ParameterId.annotateKey({ description: "Parameter whose value is the bound." }),
  }).pipe(
    $I.annoteSchema("ParameterValueBound", {
      description: "A bound whose value is the value of another parameter.",
    })
  )
) {}

/**
 * Companion namespace for {@link ParameterValueBound}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ParameterValueBound {
  /**
   * Encoded (wire) form of {@link ParameterValueBound}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "parameterValue";
    readonly parameterId: ParameterId.Encoded;
  }
}

/**
 * Where a configured bound takes its value from: a literal or another parameter of the same action.
 *
 * **Gotchas**
 *
 * A referenced parameter is not guaranteed to be published with the action
 * type, so a consumer must tolerate a reference it cannot resolve.
 *
 * **Example** (Find the parameter a bound depends on)
 *
 * ```ts import.meta.vitest name="Find the parameter a bound depends on"
 * import * as O from "effect/Option"
 * import { ParameterId } from "@beep/scratchpad/osdk/src/Identifier/index"
 * import { ConstraintBound, ParameterValueBound, StaticBound } from "@beep/scratchpad/osdk/src/Action/index"
 *
 * const dependency = ConstraintBound.match({
 *   static: () => O.none<string>(),
 *   parameterLength: ({ parameterId }) => O.some<string>(parameterId),
 *   parameterValue: ({ parameterId }) => O.some<string>(parameterId),
 * })
 * const dependencies = [
 *   dependency(StaticBound.make({ value: 10 })),
 *   dependency(ParameterValueBound.make({ parameterId: ParameterId.make("budget") })),
 * ]
 * dependencies // => [O.none(), O.some("budget")]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ConstraintBound = ConstraintBoundKind.mapMembers(() =>
  Tuple.make(StaticBound, ParameterLengthBound, ParameterValueBound)
).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("ConstraintBound", {
    description: "Where a configured bound takes its value from: a literal or another parameter of the same action.",
  })
);

/**
 * Runtime type of {@link ConstraintBound}.
 *
 * @category models
 * @since 0.0.0
 */
export type ConstraintBound = typeof ConstraintBound.Type;

/**
 * Companion namespace for {@link ConstraintBound}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ConstraintBound {
  /**
   * Encoded (wire) form of {@link ConstraintBound}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded =
    | StaticBound.Encoded
    | ParameterLengthBound.Encoded
    | ParameterValueBound.Encoded;
}

/**
 * A date or timestamp bound equal to the moment the action is evaluated.
 *
 * @category models
 * @since 0.0.0
 */
export class NowBound extends S.Opaque<NowBound, { readonly brand: unique symbol }>()(
  S.Struct({ type: S.tag("now") }).pipe(
    $I.annoteSchema("NowBound", {
      description: "A date or timestamp bound equal to the moment the action is evaluated.",
    })
  )
) {}

/**
 * Companion namespace for {@link NowBound}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace NowBound {
  /**
   * Encoded (wire) form of {@link NowBound}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "now";
  }
}

/**
 * A date or timestamp bound fixed at configuration time or taken from another parameter.
 *
 * @category models
 * @since 0.0.0
 */
export class FixedDatetimeBound extends S.Opaque<FixedDatetimeBound, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("fixed"),
    value: ConstraintBound.annotateKey({ description: "Source of the ISO 8601 date or timestamp." }),
  }).pipe(
    $I.annoteSchema("FixedDatetimeBound", {
      description: "A date or timestamp bound fixed at configuration time or taken from another parameter.",
    })
  )
) {}

/**
 * Companion namespace for {@link FixedDatetimeBound}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace FixedDatetimeBound {
  /**
   * Encoded (wire) form of {@link FixedDatetimeBound}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "fixed";
    readonly value: ConstraintBound.Encoded;
  }
}

/**
 * A date or timestamp bound expressed as an offset from the moment the action is evaluated.
 *
 * @category models
 * @since 0.0.0
 */
export class RelativeDatetimeBound extends S.Opaque<RelativeDatetimeBound, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("relative"),
    duration: S.String.annotateKey({ description: "Magnitude of the offset, as the wire's string." }),
    unit: RelativeDatetimeUnit.annotateKey({ description: "Unit the magnitude is counted in." }),
    tense: RelativeDatetimeTense.annotateKey({ description: "Whether the offset points forward or back." }),
  }).pipe(
    $I.annoteSchema("RelativeDatetimeBound", {
      description: "A date or timestamp bound expressed as an offset from the moment the action is evaluated.",
    })
  )
) {}

/**
 * Companion namespace for {@link RelativeDatetimeBound}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace RelativeDatetimeBound {
  /**
   * Encoded (wire) form of {@link RelativeDatetimeBound}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "relative";
    readonly duration: string;
    readonly unit: RelativeDatetimeUnit.Encoded;
    readonly tense: RelativeDatetimeTense.Encoded;
  }
}

/**
 * How a configured date or timestamp bound is expressed.
 *
 * **Example** (Describe a datetime bound)
 *
 * ```ts import.meta.vitest name="Describe a datetime bound"
 * import { DatetimeBound, NowBound, RelativeDatetimeBound } from "@beep/scratchpad/osdk/src/Action/index"
 *
 * const describeBound = DatetimeBound.match({
 *   now: () => "now",
 *   fixed: () => "a fixed instant",
 *   relative: ({ duration, unit, tense }) => `${duration} ${unit} in the ${tense}`,
 * })
 * const lastWeek = RelativeDatetimeBound.make({ duration: "1", unit: "week", tense: "past" })
 * const descriptions = [describeBound(NowBound.make({})), describeBound(lastWeek)]
 * descriptions // => ["now", "1 week in the past"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const DatetimeBound = DatetimeBoundKind.mapMembers(() =>
  Tuple.make(NowBound, FixedDatetimeBound, RelativeDatetimeBound)
).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("DatetimeBound", { description: "How a configured date or timestamp bound is expressed." })
);

/**
 * Runtime type of {@link DatetimeBound}.
 *
 * @category models
 * @since 0.0.0
 */
export type DatetimeBound = typeof DatetimeBound.Type;

/**
 * Companion namespace for {@link DatetimeBound}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace DatetimeBound {
  /**
   * Encoded (wire) form of {@link DatetimeBound}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded =
    | NowBound.Encoded
    | FixedDatetimeBound.Encoded
    | RelativeDatetimeBound.Encoded;
}

/**
 * One labelled choice of a parameter restricted to a fixed set of values.
 *
 * @category models
 * @since 0.0.0
 */
export class AllowedValueOption extends S.Opaque<AllowedValueOption, { readonly brand: unique symbol }>()(
  S.Struct({
    displayName: S.String.annotateKey({ description: "Human-readable label of the choice." }),
    value: S.Json.annotateKey({ description: "The value the choice stands for, in the wire encoding." }),
  }).pipe(
    $I.annoteSchema("AllowedValueOption", {
      description: "One labelled choice of a parameter restricted to a fixed set of values.",
    })
  )
) {}

/**
 * Companion namespace for {@link AllowedValueOption}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace AllowedValueOption {
  /**
   * Encoded (wire) form of {@link AllowedValueOption}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly displayName: string;
    readonly value: typeof S.Json.Encoded;
  }
}

/**
 * Rule that a parameter's value must be one of a fixed set of labelled options.
 *
 * @category models
 * @since 0.0.0
 */
export class OneOfAllowedValues extends S.Opaque<OneOfAllowedValues, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("oneOf"),
    options: S.Array(AllowedValueOption).annotateKey({ description: "The configured choices." }),
    otherValuesAllowed: S.Boolean.annotateKey({
      description: "Whether a value outside the choices is still accepted.",
    }),
  }).pipe(
    $I.annoteSchema("OneOfAllowedValues", {
      description: "Rule that a parameter's value must be one of a fixed set of labelled options.",
    })
  )
) {}

/**
 * Companion namespace for {@link OneOfAllowedValues}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace OneOfAllowedValues {
  /**
   * Encoded (wire) form of {@link OneOfAllowedValues}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "oneOf";
    readonly options: ReadonlyArray<AllowedValueOption.Encoded>;
    readonly otherValuesAllowed: boolean;
  }
}

/**
 * Rule that a numeric parameter's value must fall within a range.
 *
 * @category models
 * @since 0.0.0
 */
export class RangeAllowedValues extends S.Opaque<RangeAllowedValues, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("range"),
    gt: S.OptionFromOptionalKey(ConstraintBound).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Exclusive lower bound, when configured." })
    ),
    gte: S.OptionFromOptionalKey(ConstraintBound).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Inclusive lower bound, when configured." })
    ),
    lt: S.OptionFromOptionalKey(ConstraintBound).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Exclusive upper bound, when configured." })
    ),
    lte: S.OptionFromOptionalKey(ConstraintBound).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Inclusive upper bound, when configured." })
    ),
  }).pipe(
    $I.annoteSchema("RangeAllowedValues", {
      description: "Rule that a numeric parameter's value must fall within a range.",
    })
  )
) {}

/**
 * Companion namespace for {@link RangeAllowedValues}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace RangeAllowedValues {
  /**
   * Encoded (wire) form of {@link RangeAllowedValues}: each unconfigured bound is an absent key.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "range";
    readonly gt?: ConstraintBound.Encoded;
    readonly gte?: ConstraintBound.Encoded;
    readonly lt?: ConstraintBound.Encoded;
    readonly lte?: ConstraintBound.Encoded;
  }
}

/**
 * Rule that a date or timestamp parameter's value must fall within a range.
 *
 * @category models
 * @since 0.0.0
 */
export class DatetimeAllowedValues extends S.Opaque<DatetimeAllowedValues, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("datetime"),
    gt: S.OptionFromOptionalKey(DatetimeBound).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Exclusive lower bound, when configured." })
    ),
    gte: S.OptionFromOptionalKey(DatetimeBound).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Inclusive lower bound, when configured." })
    ),
    lt: S.OptionFromOptionalKey(DatetimeBound).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Exclusive upper bound, when configured." })
    ),
    lte: S.OptionFromOptionalKey(DatetimeBound).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Inclusive upper bound, when configured." })
    ),
  }).pipe(
    $I.annoteSchema("DatetimeAllowedValues", {
      description: "Rule that a date or timestamp parameter's value must fall within a range.",
    })
  )
) {}

/**
 * Companion namespace for {@link DatetimeAllowedValues}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace DatetimeAllowedValues {
  /**
   * Encoded (wire) form of {@link DatetimeAllowedValues}: each unconfigured bound is an absent key.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "datetime";
    readonly gt?: DatetimeBound.Encoded;
    readonly gte?: DatetimeBound.Encoded;
    readonly lt?: DatetimeBound.Encoded;
    readonly lte?: DatetimeBound.Encoded;
  }
}

/**
 * Rule that a string parameter's value must respect length bounds, a regular expression, or both.
 *
 * @category models
 * @since 0.0.0
 */
export class TextAllowedValues extends S.Opaque<TextAllowedValues, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("text"),
    gte: S.OptionFromOptionalKey(S.Finite).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Minimum length, inclusive, when configured." })
    ),
    lte: S.OptionFromOptionalKey(S.Finite).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Maximum length, inclusive, when configured." })
    ),
    regex: S.OptionFromOptionalKey(S.String).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Regular expression the value must match, when configured." })
    ),
    configuredFailureMessage: S.OptionFromOptionalKey(S.String).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Message shown when the regular expression does not match." })
    ),
  }).pipe(
    $I.annoteSchema("TextAllowedValues", {
      description: "Rule that a string parameter's value must respect length bounds, a regular expression, or both.",
    })
  )
) {}

/**
 * Companion namespace for {@link TextAllowedValues}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace TextAllowedValues {
  /**
   * Encoded (wire) form of {@link TextAllowedValues}: each unconfigured rule is an absent key.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "text";
    readonly gte?: number;
    readonly lte?: number;
    readonly regex?: string;
    readonly configuredFailureMessage?: string;
  }
}

/**
 * Rule that a markdown parameter's value must respect length bounds.
 *
 * @category models
 * @since 0.0.0
 */
export class MarkdownAllowedValues extends S.Opaque<MarkdownAllowedValues, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("markdown"),
    gte: S.OptionFromOptionalKey(S.Finite).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Minimum length, inclusive, when configured." })
    ),
    lte: S.OptionFromOptionalKey(S.Finite).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Maximum length, inclusive, when configured." })
    ),
  }).pipe(
    $I.annoteSchema("MarkdownAllowedValues", {
      description: "Rule that a markdown parameter's value must respect length bounds.",
    })
  )
) {}

/**
 * Companion namespace for {@link MarkdownAllowedValues}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace MarkdownAllowedValues {
  /**
   * Encoded (wire) form of {@link MarkdownAllowedValues}: each unconfigured bound is an absent key.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "markdown";
    readonly gte?: number;
    readonly lte?: number;
  }
}

/**
 * Rule that an attachment parameter's file must not exceed a size.
 *
 * @category models
 * @since 0.0.0
 */
export class AttachmentAllowedValues extends S.Opaque<AttachmentAllowedValues, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("attachment"),
    maxSizeBytes: S.OptionFromOptionalKey(SizeBytes).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Largest accepted file size, when configured." })
    ),
  }).pipe(
    $I.annoteSchema("AttachmentAllowedValues", {
      description: "Rule that an attachment parameter's file must not exceed a size.",
    })
  )
) {}

/**
 * Companion namespace for {@link AttachmentAllowedValues}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace AttachmentAllowedValues {
  /**
   * Encoded (wire) form of {@link AttachmentAllowedValues}: the size limit travels as decimal text and is an absent key
   * when unconfigured.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "attachment";
    readonly maxSizeBytes?: SizeBytes.Encoded;
  }
}

/**
 * Rule that a parameter's value must conform to one version of a value type.
 *
 * @category models
 * @since 0.0.0
 */
export class ValueTypeAllowedValues extends S.Opaque<ValueTypeAllowedValues, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("valueType"),
    apiName: ValueTypeApiName.annotateKey({ description: "Name of the value type." }),
    rid: ValueTypeRid.annotateKey({ description: "Resource identifier of the value type." }),
    versionId: S.NonEmptyString.annotateKey({ description: "Version of the value type the value must conform to." }),
  }).pipe(
    $I.annoteSchema("ValueTypeAllowedValues", {
      description: "Rule that a parameter's value must conform to one version of a value type.",
    })
  )
) {}

/**
 * Companion namespace for {@link ValueTypeAllowedValues}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ValueTypeAllowedValues {
  /**
   * Encoded (wire) form of {@link ValueTypeAllowedValues}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "valueType";
    readonly apiName: ValueTypeApiName.Encoded;
    readonly rid: ValueTypeRid.Encoded;
    readonly versionId: string;
  }
}

/**
 * Rule that a parameter must be omitted or empty.
 *
 * @category models
 * @since 0.0.0
 */
export class MustBeEmptyAllowedValues extends S.Opaque<MustBeEmptyAllowedValues, { readonly brand: unique symbol }>()(
  S.Struct({ type: S.tag("mustBeEmpty") }).pipe(
    $I.annoteSchema("MustBeEmptyAllowedValues", { description: "Rule that a parameter must be omitted or empty." })
  )
) {}

/**
 * Companion namespace for {@link MustBeEmptyAllowedValues}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace MustBeEmptyAllowedValues {
  /**
   * Encoded (wire) form of {@link MustBeEmptyAllowedValues}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "mustBeEmpty";
  }
}

/**
 * The allowed-values rule an action type configures on one of its parameters.
 *
 * **Details**
 *
 * This is configuration, published with the action type, whose bounds may
 * still point at other parameters. What a concrete value was checked against
 * is the separate {@link EvaluatedConstraint}, whose bounds are resolved.
 *
 * **Example** (Tell whether a rule restricts length)
 *
 * ```ts import.meta.vitest name="Tell whether a rule restricts length"
 * import * as O from "effect/Option"
 * import { AllowedValues, MustBeEmptyAllowedValues, TextAllowedValues } from "@beep/scratchpad/osdk/src/Action/index"
 *
 * const restrictsLength = AllowedValues.matchOrElse(
 *   {
 *     text: ({ gte, lte }) => O.isSome(gte) || O.isSome(lte),
 *     markdown: ({ gte, lte }) => O.isSome(gte) || O.isSome(lte),
 *   },
 *   () => false
 * )
 * const verdicts = [
 *   restrictsLength(TextAllowedValues.make({ lte: O.some(280) })),
 *   restrictsLength(MustBeEmptyAllowedValues.make({})),
 * ]
 * verdicts // => [true, false]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AllowedValues = AllowedValuesKind.mapMembers(() =>
  Tuple.make(
    OneOfAllowedValues,
    RangeAllowedValues,
    DatetimeAllowedValues,
    TextAllowedValues,
    MarkdownAllowedValues,
    AttachmentAllowedValues,
    ValueTypeAllowedValues,
    MustBeEmptyAllowedValues
  )
).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("AllowedValues", {
    description: "The allowed-values rule an action type configures on one of its parameters.",
  })
);

/**
 * Runtime type of {@link AllowedValues}.
 *
 * @category models
 * @since 0.0.0
 */
export type AllowedValues = typeof AllowedValues.Type;

/**
 * Companion namespace for {@link AllowedValues}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace AllowedValues {
  /**
   * Encoded (wire) form of {@link AllowedValues}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded =
    | OneOfAllowedValues.Encoded
    | RangeAllowedValues.Encoded
    | DatetimeAllowedValues.Encoded
    | TextAllowedValues.Encoded
    | MarkdownAllowedValues.Encoded
    | AttachmentAllowedValues.Encoded
    | ValueTypeAllowedValues.Encoded
    | MustBeEmptyAllowedValues.Encoded;
}

/**
 * Inclusive bounds an action type configures on the number of elements of a list parameter.
 *
 * @category models
 * @since 0.0.0
 */
export class ArraySizeBounds extends S.Opaque<ArraySizeBounds, { readonly brand: unique symbol }>()(
  S.Struct({
    gte: S.OptionFromOptionalKey(S.Finite).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Minimum number of elements, inclusive, when configured." })
    ),
    lte: S.OptionFromOptionalKey(S.Finite).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Maximum number of elements, inclusive, when configured." })
    ),
  }).pipe(
    $I.annoteSchema("ArraySizeBounds", {
      description: "Inclusive bounds an action type configures on the number of elements of a list parameter.",
    })
  )
) {}

/**
 * Companion namespace for {@link ArraySizeBounds}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ArraySizeBounds {
  /**
   * Encoded (wire) form of {@link ArraySizeBounds}: each unconfigured bound is an absent key.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly gte?: number;
    readonly lte?: number;
  }
}

/**
 * The constraints an action type configures on one parameter: which values, and for a list, how many.
 *
 * @category models
 * @since 0.0.0
 */
export class ParameterConstraints extends S.Opaque<ParameterConstraints, { readonly brand: unique symbol }>()(
  S.Struct({
    allowedValues: S.OptionFromOptionalKey(AllowedValues).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Rule restricting the parameter's values, when configured." })
    ),
    arraySize: S.OptionFromOptionalKey(ArraySizeBounds).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Bounds on the number of elements of a list parameter, when configured." })
    ),
  }).pipe(
    $I.annoteSchema("ParameterConstraints", {
      description: "The constraints an action type configures on one parameter.",
    })
  )
) {}

/**
 * Companion namespace for {@link ParameterConstraints}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ParameterConstraints {
  /**
   * Encoded (wire) form of {@link ParameterConstraints}: each unconfigured constraint is an absent key.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly allowedValues?: AllowedValues.Encoded;
    readonly arraySize?: ArraySizeBounds.Encoded;
  }
}

/**
 * Validation metadata an action type publishes for one parameter.
 *
 * **Details**
 *
 * The wire wraps the constraints in a `defaultValidation` key, leaving room
 * for conditional overrides that the contract does not expose yet. The wrapper
 * is kept so such a key can be added without moving anything.
 *
 * @category models
 * @since 0.0.0
 */
export class ParameterValidation extends S.Opaque<ParameterValidation, { readonly brand: unique symbol }>()(
  S.Struct({
    // Constraints that apply when no conditional override does.
    // (Bare: annotating the key of a class would type the field as its un-branded record.)
    defaultValidation: ParameterConstraints,
  }).pipe(
    $I.annoteSchema("ParameterValidation", {
      description: "Validation metadata an action type publishes for one parameter.",
    })
  )
) {}

/**
 * Companion namespace for {@link ParameterValidation}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ParameterValidation {
  /**
   * Encoded (wire) form of {@link ParameterValidation}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly defaultValidation: ParameterConstraints.Encoded;
  }
}

// -----------------------------------------------------------------------------
// Action types
// -----------------------------------------------------------------------------

/**
 * A parameter as declared on an action type: its type plus everything that describes it.
 *
 * **Details**
 *
 * The parameter's identifier is the key under which the action type stores
 * this record, so it is not repeated here. `required` is the wire's own
 * boolean; OSDK publishes its negation as `nullable`.
 *
 * **Example** (Declare a required string parameter)
 *
 * ```ts import.meta.vitest name="Declare a required string parameter"
 * import * as O from "effect/Option"
 * import { StringType } from "@beep/scratchpad/osdk/src/DataType/index"
 * import { ActionParameter } from "@beep/scratchpad/osdk/src/Action/index"
 *
 * const newTitle = ActionParameter.make({ displayName: "New Title", dataType: StringType.make({}), required: true })
 * const summary = [newTitle.dataType.type, O.isNone(newTitle.validation), newTitle.typeClasses.length]
 * summary // => ["string", true, 0]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ActionParameter extends S.Opaque<ActionParameter, { readonly brand: unique symbol }>()(
  S.Struct({
    displayName: S.String.annotateKey({ description: "Human-readable name." }),
    description: S.OptionFromOptionalKey(S.String).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "What the parameter means." })
    ),
    dataType: ActionParameterType.annotateKey({ description: "What the parameter holds." }),
    required: S.Boolean.annotateKey({ description: "Whether a request must supply an argument for it." }),
    typeClasses: S.Array(TypeClass).pipe(
      S.withConstructorDefault(Effect.succeed(A.empty<TypeClass>())),
      S.withDecodingDefaultKey(Effect.succeed(A.empty<TypeClass.Encoded>())),
      S.annotateKey({ description: "Free-form rendering and behavior hints for client applications." })
    ),
    validation: S.OptionFromOptionalKey(ParameterValidation).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Constraints configured on the parameter, when the platform publishes them." })
    ),
  }).pipe(
    $I.annoteSchema("ActionParameter", {
      description: "A parameter as declared on an action type: its type plus everything that describes it.",
    })
  )
) {}

/**
 * Companion namespace for {@link ActionParameter}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ActionParameter {
  /**
   * Encoded (wire) form of {@link ActionParameter}: `typeClasses` may be absent and then decodes as empty.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly displayName: string;
    readonly description?: string;
    readonly dataType: ActionParameterType.Encoded;
    readonly required: boolean;
    readonly typeClasses?: ReadonlyArray<TypeClass.Encoded>;
    readonly validation?: ParameterValidation.Encoded;
  }
}

/**
 * Declares that an action may create objects of one object type.
 *
 * @category models
 * @since 0.0.0
 */
export class CreateObjectOperation extends S.Opaque<CreateObjectOperation, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("createObject"),
    objectTypeApiName: ObjectTypeApiName.annotateKey({ description: "Object type of the created objects." }),
  }).pipe(
    $I.annoteSchema("CreateObjectOperation", {
      description: "Declares that an action may create objects of one object type.",
    })
  )
) {}

/**
 * Companion namespace for {@link CreateObjectOperation}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace CreateObjectOperation {
  /**
   * Encoded (wire) form of {@link CreateObjectOperation}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "createObject";
    readonly objectTypeApiName: ObjectTypeApiName.Encoded;
  }
}

/**
 * Declares that an action may modify objects of one object type.
 *
 * @category models
 * @since 0.0.0
 */
export class ModifyObjectOperation extends S.Opaque<ModifyObjectOperation, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("modifyObject"),
    objectTypeApiName: ObjectTypeApiName.annotateKey({ description: "Object type of the modified objects." }),
  }).pipe(
    $I.annoteSchema("ModifyObjectOperation", {
      description: "Declares that an action may modify objects of one object type.",
    })
  )
) {}

/**
 * Companion namespace for {@link ModifyObjectOperation}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ModifyObjectOperation {
  /**
   * Encoded (wire) form of {@link ModifyObjectOperation}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "modifyObject";
    readonly objectTypeApiName: ObjectTypeApiName.Encoded;
  }
}

/**
 * Declares that an action may delete objects of one object type.
 *
 * @category models
 * @since 0.0.0
 */
export class DeleteObjectOperation extends S.Opaque<DeleteObjectOperation, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("deleteObject"),
    objectTypeApiName: ObjectTypeApiName.annotateKey({ description: "Object type of the deleted objects." }),
  }).pipe(
    $I.annoteSchema("DeleteObjectOperation", {
      description: "Declares that an action may delete objects of one object type.",
    })
  )
) {}

/**
 * Companion namespace for {@link DeleteObjectOperation}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace DeleteObjectOperation {
  /**
   * Encoded (wire) form of {@link DeleteObjectOperation}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "deleteObject";
    readonly objectTypeApiName: ObjectTypeApiName.Encoded;
  }
}

/**
 * Declares that an action may create links of one link type, named from both of its sides.
 *
 * @category models
 * @since 0.0.0
 */
export class CreateLinkOperation extends S.Opaque<CreateLinkOperation, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("createLink"),
    linkTypeApiNameAtoB: LinkTypeApiName.annotateKey({ description: "Name of the link as seen from side A." }),
    linkTypeApiNameBtoA: LinkTypeApiName.annotateKey({ description: "Name of the link as seen from side B." }),
    aSideObjectTypeApiName: ObjectTypeApiName.annotateKey({ description: "Object type on side A." }),
    bSideObjectTypeApiName: ObjectTypeApiName.annotateKey({ description: "Object type on side B." }),
  }).pipe(
    $I.annoteSchema("CreateLinkOperation", {
      description: "Declares that an action may create links of one link type, named from both of its sides.",
    })
  )
) {}

/**
 * Companion namespace for {@link CreateLinkOperation}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace CreateLinkOperation {
  /**
   * Encoded (wire) form of {@link CreateLinkOperation}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "createLink";
    readonly linkTypeApiNameAtoB: LinkTypeApiName.Encoded;
    readonly linkTypeApiNameBtoA: LinkTypeApiName.Encoded;
    readonly aSideObjectTypeApiName: ObjectTypeApiName.Encoded;
    readonly bSideObjectTypeApiName: ObjectTypeApiName.Encoded;
  }
}

/**
 * Declares that an action may delete links of one link type, named from both of its sides.
 *
 * @category models
 * @since 0.0.0
 */
export class DeleteLinkOperation extends S.Opaque<DeleteLinkOperation, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("deleteLink"),
    linkTypeApiNameAtoB: LinkTypeApiName.annotateKey({ description: "Name of the link as seen from side A." }),
    linkTypeApiNameBtoA: LinkTypeApiName.annotateKey({ description: "Name of the link as seen from side B." }),
    aSideObjectTypeApiName: ObjectTypeApiName.annotateKey({ description: "Object type on side A." }),
    bSideObjectTypeApiName: ObjectTypeApiName.annotateKey({ description: "Object type on side B." }),
  }).pipe(
    $I.annoteSchema("DeleteLinkOperation", {
      description: "Declares that an action may delete links of one link type, named from both of its sides.",
    })
  )
) {}

/**
 * Companion namespace for {@link DeleteLinkOperation}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace DeleteLinkOperation {
  /**
   * Encoded (wire) form of {@link DeleteLinkOperation}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "deleteLink";
    readonly linkTypeApiNameAtoB: LinkTypeApiName.Encoded;
    readonly linkTypeApiNameBtoA: LinkTypeApiName.Encoded;
    readonly aSideObjectTypeApiName: ObjectTypeApiName.Encoded;
    readonly bSideObjectTypeApiName: ObjectTypeApiName.Encoded;
  }
}

/**
 * Declares that an action may create objects through one interface type.
 *
 * @category models
 * @since 0.0.0
 */
export class CreateInterfaceObjectOperation extends S.Opaque<
  CreateInterfaceObjectOperation,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    type: S.tag("createInterfaceObject"),
    interfaceTypeApiName: InterfaceTypeApiName.annotateKey({ description: "Interface the created objects implement." }),
  }).pipe(
    $I.annoteSchema("CreateInterfaceObjectOperation", {
      description: "Declares that an action may create objects through one interface type.",
    })
  )
) {}

/**
 * Companion namespace for {@link CreateInterfaceObjectOperation}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace CreateInterfaceObjectOperation {
  /**
   * Encoded (wire) form of {@link CreateInterfaceObjectOperation}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "createInterfaceObject";
    readonly interfaceTypeApiName: InterfaceTypeApiName.Encoded;
  }
}

/**
 * Declares that an action may modify objects through one interface type.
 *
 * @category models
 * @since 0.0.0
 */
export class ModifyInterfaceObjectOperation extends S.Opaque<
  ModifyInterfaceObjectOperation,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    type: S.tag("modifyInterfaceObject"),
    interfaceTypeApiName: InterfaceTypeApiName.annotateKey({
      description: "Interface the modified objects implement.",
    }),
  }).pipe(
    $I.annoteSchema("ModifyInterfaceObjectOperation", {
      description: "Declares that an action may modify objects through one interface type.",
    })
  )
) {}

/**
 * Companion namespace for {@link ModifyInterfaceObjectOperation}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ModifyInterfaceObjectOperation {
  /**
   * Encoded (wire) form of {@link ModifyInterfaceObjectOperation}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "modifyInterfaceObject";
    readonly interfaceTypeApiName: InterfaceTypeApiName.Encoded;
  }
}

/**
 * Declares that an action may delete objects through one interface type.
 *
 * @category models
 * @since 0.0.0
 */
export class DeleteInterfaceObjectOperation extends S.Opaque<
  DeleteInterfaceObjectOperation,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    type: S.tag("deleteInterfaceObject"),
    interfaceTypeApiName: InterfaceTypeApiName.annotateKey({ description: "Interface the deleted objects implement." }),
  }).pipe(
    $I.annoteSchema("DeleteInterfaceObjectOperation", {
      description: "Declares that an action may delete objects through one interface type.",
    })
  )
) {}

/**
 * Companion namespace for {@link DeleteInterfaceObjectOperation}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace DeleteInterfaceObjectOperation {
  /**
   * Encoded (wire) form of {@link DeleteInterfaceObjectOperation}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "deleteInterfaceObject";
    readonly interfaceTypeApiName: InterfaceTypeApiName.Encoded;
  }
}

/**
 * The link types of one object type that applying a scenario may edit.
 *
 * @category models
 * @since 0.0.0
 */
export class ScenarioLinkScope extends S.Opaque<ScenarioLinkScope, { readonly brand: unique symbol }>()(
  S.Struct({
    objectTypeApiName: ObjectTypeApiName.annotateKey({ description: "Object type the link types start from." }),
    linkTypes: S.Array(LinkTypeApiName).annotateKey({ description: "Link types of that object type in scope." }),
  }).pipe(
    $I.annoteSchema("ScenarioLinkScope", {
      description: "The link types of one object type that applying a scenario may edit.",
    })
  )
) {}

/**
 * Companion namespace for {@link ScenarioLinkScope}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ScenarioLinkScope {
  /**
   * Encoded (wire) form of {@link ScenarioLinkScope}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly objectTypeApiName: ObjectTypeApiName.Encoded;
    readonly linkTypes: ReadonlyArray<LinkTypeApiName.Encoded>;
  }
}

/**
 * Declares that an action merges the edits staged on a scenario into the ontology.
 *
 * **Details**
 *
 * The scenario arrives through a parameter of type `scenarioReference`. The
 * object and link types its edits may touch are enumerated here, because the
 * scenario itself is not known until the action is applied.
 *
 * @category models
 * @since 0.0.0
 */
export class ApplyScenarioOperation extends S.Opaque<ApplyScenarioOperation, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("applyScenario"),
    scenarioParameter: ParameterId.annotateKey({ description: "Parameter that carries the scenario reference." }),
    objectTypeApiNames: S.Array(ObjectTypeApiName).annotateKey({
      description: "Object types the scenario's edits may touch.",
    }),
    linkTypes: S.Array(ScenarioLinkScope).annotateKey({ description: "Link types the scenario's edits may touch." }),
  }).pipe(
    $I.annoteSchema("ApplyScenarioOperation", {
      description: "Declares that an action merges the edits staged on a scenario into the ontology.",
    })
  )
) {}

/**
 * Companion namespace for {@link ApplyScenarioOperation}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ApplyScenarioOperation {
  /**
   * Encoded (wire) form of {@link ApplyScenarioOperation}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "applyScenario";
    readonly scenarioParameter: ParameterId.Encoded;
    readonly objectTypeApiNames: ReadonlyArray<ObjectTypeApiName.Encoded>;
    readonly linkTypes: ReadonlyArray<ScenarioLinkScope.Encoded>;
  }
}

/**
 * One effect an action type declares it may have: which object, link or interface types it touches, and how.
 *
 * **Details**
 *
 * This is the summary an action type carries in `operations` (the wire's
 * `LogicRule`). It says which types are touched, not which parameter feeds
 * which property; that detail lives in the separate full logic rules.
 *
 * **Example** (Ask whether an operation creates anything)
 *
 * ```ts import.meta.vitest name="Ask whether an operation creates anything"
 * import { ObjectTypeApiName } from "@beep/scratchpad/osdk/src/Identifier/index"
 * import { ActionOperation, ModifyObjectOperation } from "@beep/scratchpad/osdk/src/Action/index"
 *
 * const creates = ActionOperation.isAnyOf(["createObject", "createLink", "createInterfaceObject"])
 * const promote = ModifyObjectOperation.make({ objectTypeApiName: ObjectTypeApiName.make("Employee") })
 * const verdicts = [creates(promote), ActionOperation.guards.modifyObject(promote)]
 * verdicts // => [false, true]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ActionOperation = ActionOperationKind.mapMembers(() =>
  Tuple.make(
    CreateObjectOperation,
    ModifyObjectOperation,
    DeleteObjectOperation,
    CreateLinkOperation,
    DeleteLinkOperation,
    CreateInterfaceObjectOperation,
    ModifyInterfaceObjectOperation,
    DeleteInterfaceObjectOperation,
    ApplyScenarioOperation
  )
).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("ActionOperation", {
    description: "One effect an action type declares it may have on object, link or interface types.",
  })
);

/**
 * Runtime type of {@link ActionOperation}.
 *
 * @category models
 * @since 0.0.0
 */
export type ActionOperation = typeof ActionOperation.Type;

/**
 * Companion namespace for {@link ActionOperation}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ActionOperation {
  /**
   * Encoded (wire) form of {@link ActionOperation}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded =
    | CreateObjectOperation.Encoded
    | ModifyObjectOperation.Encoded
    | DeleteObjectOperation.Encoded
    | CreateLinkOperation.Encoded
    | DeleteLinkOperation.Encoded
    | CreateInterfaceObjectOperation.Encoded
    | ModifyInterfaceObjectOperation.Encoded
    | DeleteInterfaceObjectOperation.Encoded
    | ApplyScenarioOperation.Encoded;
}

/**
 * An action type: a named, parameterised edit of the ontology.
 *
 * **Example** (Decode an action type and list its required parameters)
 *
 * ```ts import.meta.vitest name="Decode an action type and list its required parameters"
 * import * as Effect from "effect/Effect"
 * import * as R from "effect/Record"
 * import * as S from "effect/Schema"
 * import { ActionType } from "@beep/scratchpad/osdk/src/Action/index"
 *
 * const action = await Effect.runPromise(
 *   S.decodeUnknownEffect(ActionType)({
 *     apiName: "promoteEmployee",
 *     rid: "ri.ontology.main.action-type.7ed72754-7491-428a-bb18-4d7296eb2168",
 *     status: "ACTIVE",
 *     parameters: {
 *       employeeId: { displayName: "Employee ID", dataType: { type: "integer" }, required: true, typeClasses: [] },
 *       newTitle: { displayName: "New Title", dataType: { type: "string" }, required: false, typeClasses: [] },
 *     },
 *     operations: [{ type: "modifyObject", objectTypeApiName: "Employee" }],
 *   })
 * )
 * const requiredParameters = R.keys(R.filter(action.parameters, (parameter) => parameter.required))
 * requiredParameters // => ["employeeId"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ActionType extends S.Opaque<ActionType, { readonly brand: unique symbol }>()(
  S.Struct({
    apiName: ActionTypeApiName.annotateKey({ description: "Name under which the action is applied." }),
    rid: ActionTypeRid.annotateKey({ description: "Resource identifier of the action type." }),
    displayName: S.OptionFromOptionalKey(S.String).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Human-readable name." })
    ),
    description: S.OptionFromOptionalKey(S.String).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "What applying the action does." })
    ),
    toolDescription: S.OptionFromOptionalKey(S.String).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "What the action does, phrased for a language model that may call it." })
    ),
    status: ReleaseStatus.annotateKey({ description: "How far along its lifecycle the action type is." }),
    parameters: S.Record(ParameterId, ActionParameter).annotateKey({
      description: "Parameters a request may supply, by identifier.",
    }),
    operations: S.Array(ActionOperation).annotateKey({
      description: "Effects the action declares it may have on the ontology.",
    }),
  }).pipe(
    $I.annoteSchema("ActionType", {
      description: "An action type: a named, parameterised edit of the ontology.",
    })
  )
) {}

/**
 * Companion namespace for {@link ActionType}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ActionType {
  /**
   * Encoded (wire) form of {@link ActionType}: each unstated name or description is an absent key.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly apiName: ActionTypeApiName.Encoded;
    readonly rid: ActionTypeRid.Encoded;
    readonly displayName?: string;
    readonly description?: string;
    readonly toolDescription?: string;
    readonly status: ReleaseStatus.Encoded;
    readonly parameters: R.ReadonlyRecord<ParameterId.Encoded, ActionParameter.Encoded>;
    readonly operations: ReadonlyArray<ActionOperation.Encoded>;
  }
}

// -----------------------------------------------------------------------------
// Requests
// -----------------------------------------------------------------------------

/**
 * A value that sets a parameter: any JSON value except a top-level `null`.
 *
 * **Details**
 *
 * `null` is excluded because in a request it is not a value but an intent
 * (clear the parameter), which {@link ActionArguments} models separately.
 * Nulls nested inside an array or a struct value are ordinary data.
 *
 * **Example** (Reject null as a value)
 *
 * ```ts import.meta.vitest name="Reject null as a value"
 * import * as S from "effect/Schema"
 * import { ArgumentValue } from "@beep/scratchpad/osdk/src/Action/index"
 *
 * const isValue = S.is(ArgumentValue)
 * const verdicts = [isValue("NYC"), isValue({ city: "NYC", zipcode: null }), isValue(null)]
 * verdicts // => [true, true, false]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ArgumentValue = S.Union([S.String, S.Finite, S.Boolean, S.Array(S.Json), S.JsonObject]).pipe(
  $I.annoteSchema("ArgumentValue", {
    description: "A value that sets a parameter: any JSON value except a top-level null.",
  })
);

/**
 * Runtime type of {@link ArgumentValue}.
 *
 * @category models
 * @since 0.0.0
 */
export type ArgumentValue = typeof ArgumentValue.Type;

/**
 * Companion namespace for {@link ArgumentValue}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ArgumentValue {
  /**
   * Encoded (wire) form of {@link ArgumentValue}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof ArgumentValue.Encoded;
}

/**
 * The arguments of one application of an action, by parameter identifier.
 *
 * **Details**
 *
 * A parameter has three possible intents, and the wire spells two of them
 * with the same JSON position. Here each is a distinct value:
 *
 * | Intent | Domain | Wire |
 * | --- | --- | --- |
 * | leave untouched (prefills apply) | key absent | key absent |
 * | clear the value | `Option.none()` | `null` |
 * | set a value | `Option.some(value)` | the value |
 *
 * OSDK separates the first two only by `undefined` versus `null`, and declares
 * a `NULL_VALUE` sentinel that nothing consumes.
 *
 * **Example** (Read the intent of each argument)
 *
 * ```ts import.meta.vitest name="Read the intent of each argument"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as R from "effect/Record"
 * import * as S from "effect/Schema"
 * import { ParameterId } from "@beep/scratchpad/osdk/src/Identifier/index"
 * import { ActionArguments } from "@beep/scratchpad/osdk/src/Action/index"
 *
 * const args = await Effect.runPromise(S.decodeUnknownEffect(ActionArguments)({ title: "Director", manager: null }))
 * const intent = (id: string) =>
 *   O.match(R.get(args, ParameterId.make(id)), {
 *     onNone: () => "untouched",
 *     onSome: O.match({ onNone: () => "clear", onSome: () => "set" }),
 *   })
 * const intents = [intent("title"), intent("manager"), intent("salary")]
 * intents // => ["set", "clear", "untouched"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ActionArguments = S.Record(ParameterId, S.OptionFromNullOr(ArgumentValue)).pipe(
  $I.annoteSchema("ActionArguments", {
    description: "The arguments of one application of an action: absent leaves untouched, none clears, some sets.",
  })
);

/**
 * Runtime type of {@link ActionArguments}.
 *
 * @category models
 * @since 0.0.0
 */
export type ActionArguments = typeof ActionArguments.Type;

/**
 * Companion namespace for {@link ActionArguments}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ActionArguments {
  /**
   * Encoded (wire) form of {@link ActionArguments}: an untouched parameter is an absent key and a cleared one is
   * `null`.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = R.ReadonlyRecord<ParameterId.Encoded, ArgumentValue.Encoded | null>;
}

/**
 * How a single action should be applied: whether to execute it and which edits to report.
 *
 * **Details**
 *
 * Both keys are optional on the wire and the platform documents their
 * defaults (execute, report no edits). Those defaults are the constructor
 * defaults and the decoding defaults, so a decoded request always states what
 * it means and an encoded one always says it explicitly. OSDK forbids asking
 * for validation only and for edits at once; that is a rule of its client,
 * not of the wire, so it is not enforced here.
 *
 * **Example** (Rely on the documented defaults)
 *
 * ```ts import.meta.vitest name="Rely on the documented defaults"
 * import { ApplyActionOptions } from "@beep/scratchpad/osdk/src/Action/index"
 *
 * const options = ApplyActionOptions.make({})
 * const summary = [options.mode, options.returnEdits]
 * summary // => ["validateAndExecute", "none"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ApplyActionOptions extends S.Opaque<ApplyActionOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    mode: ApplyActionMode.pipe(
      S.withConstructorDefault(Effect.succeed<ApplyActionMode>("validateAndExecute")),
      S.withDecodingDefaultKey(Effect.succeed<ApplyActionMode.Encoded>("VALIDATE_AND_EXECUTE")),
      S.annotateKey({ description: "Whether to only validate the action or also execute it." })
    ),
    returnEdits: ReturnEditsMode.pipe(
      S.withConstructorDefault(Effect.succeed<ReturnEditsMode>("none")),
      S.withDecodingDefaultKey(Effect.succeed<ReturnEditsMode.Encoded>("NONE")),
      S.annotateKey({ description: "Which edits the response should list." })
    ),
  }).pipe(
    $I.annoteSchema("ApplyActionOptions", {
      description: "How a single action should be applied: whether to execute it and which edits to report.",
    })
  )
) {}

/**
 * Companion namespace for {@link ApplyActionOptions}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ApplyActionOptions {
  /**
   * Encoded (wire) form of {@link ApplyActionOptions}: either key may be absent and then decodes as its documented
   * default.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly mode?: ApplyActionMode.Encoded;
    readonly returnEdits?: ReturnEditsMode.Encoded;
  }
}

/**
 * A request to apply one action.
 *
 * **Example** (Encode a request that sets one parameter and clears another)
 *
 * ```ts import.meta.vitest name="Encode a request that sets one parameter and clears another"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { ParameterId } from "@beep/scratchpad/osdk/src/Identifier/index"
 * import { ApplyActionRequest } from "@beep/scratchpad/osdk/src/Action/index"
 *
 * const request = ApplyActionRequest.make({
 *   parameters: { [ParameterId.make("officeId")]: O.some("NYC"), [ParameterId.make("capacity")]: O.none() },
 * })
 * const wire = await Effect.runPromise(S.encodeEffect(ApplyActionRequest)(request))
 * wire.parameters // => { officeId: "NYC", capacity: null }
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ApplyActionRequest extends S.Opaque<ApplyActionRequest, { readonly brand: unique symbol }>()(
  S.Struct({
    parameters: ActionArguments.annotateKey({ description: "Arguments of the application." }),
    options: ApplyActionOptions.pipe(
      S.withConstructorDefault(Effect.sync(() => ApplyActionOptions.make({}))),
      S.withDecodingDefaultKey(Effect.succeed({})),
      S.annotateKey({ description: "How the action should be applied." })
    ),
  }).pipe($I.annoteSchema("ApplyActionRequest", { description: "A request to apply one action." }))
) {}

/**
 * Companion namespace for {@link ApplyActionRequest}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ApplyActionRequest {
  /**
   * Encoded (wire) form of {@link ApplyActionRequest}: `options` may be absent and then decodes as the defaults.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly parameters: ActionArguments.Encoded;
    readonly options?: ApplyActionOptions.Encoded;
  }
}

/**
 * How a batch of actions should be applied: only which edits to report, since a batch cannot be validated alone.
 *
 * @category models
 * @since 0.0.0
 */
export class BatchApplyActionOptions extends S.Opaque<BatchApplyActionOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    returnEdits: BatchReturnEditsMode.pipe(
      S.withConstructorDefault(Effect.succeed<BatchReturnEditsMode>("none")),
      S.withDecodingDefaultKey(Effect.succeed<BatchReturnEditsMode.Encoded>("NONE")),
      S.annotateKey({ description: "Which edits the response should list." })
    ),
  }).pipe(
    $I.annoteSchema("BatchApplyActionOptions", {
      description: "How a batch of actions should be applied: which edits to report.",
    })
  )
) {}

/**
 * Companion namespace for {@link BatchApplyActionOptions}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace BatchApplyActionOptions {
  /**
   * Encoded (wire) form of {@link BatchApplyActionOptions}: `returnEdits` may be absent and then decodes as its
   * documented default.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly returnEdits?: BatchReturnEditsMode.Encoded;
  }
}

/**
 * One application within a batch: its arguments.
 *
 * @category models
 * @since 0.0.0
 */
export class BatchApplyActionItem extends S.Opaque<BatchApplyActionItem, { readonly brand: unique symbol }>()(
  S.Struct({
    parameters: ActionArguments.annotateKey({ description: "Arguments of this application." }),
  }).pipe($I.annoteSchema("BatchApplyActionItem", { description: "One application within a batch: its arguments." }))
) {}

/**
 * Companion namespace for {@link BatchApplyActionItem}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace BatchApplyActionItem {
  /**
   * Encoded (wire) form of {@link BatchApplyActionItem}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly parameters: ActionArguments.Encoded;
  }
}

/**
 * A request to apply the same action several times, each with its own arguments.
 *
 * **Example** (Encode a batch of two applications)
 *
 * ```ts import.meta.vitest name="Encode a batch of two applications"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { ParameterId } from "@beep/scratchpad/osdk/src/Identifier/index"
 * import { BatchApplyActionItem, BatchApplyActionRequest } from "@beep/scratchpad/osdk/src/Action/index"
 *
 * const officeId = ParameterId.make("officeId")
 * const request = BatchApplyActionRequest.make({
 *   requests: [
 *     BatchApplyActionItem.make({ parameters: { [officeId]: O.some("NYC") } }),
 *     BatchApplyActionItem.make({ parameters: { [officeId]: O.some("SEA") } }),
 *   ],
 * })
 * const wire = await Effect.runPromise(S.encodeEffect(BatchApplyActionRequest)(request))
 * wire.requests // => [{ parameters: { officeId: "NYC" } }, { parameters: { officeId: "SEA" } }]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BatchApplyActionRequest extends S.Opaque<BatchApplyActionRequest, { readonly brand: unique symbol }>()(
  S.Struct({
    requests: S.Array(BatchApplyActionItem).annotateKey({ description: "The applications, in order." }),
    options: BatchApplyActionOptions.pipe(
      S.withConstructorDefault(Effect.sync(() => BatchApplyActionOptions.make({}))),
      S.withDecodingDefaultKey(Effect.succeed({})),
      S.annotateKey({ description: "How the batch should be applied." })
    ),
  }).pipe(
    $I.annoteSchema("BatchApplyActionRequest", {
      description: "A request to apply the same action several times, each with its own arguments.",
    })
  )
) {}

/**
 * Companion namespace for {@link BatchApplyActionRequest}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace BatchApplyActionRequest {
  /**
   * Encoded (wire) form of {@link BatchApplyActionRequest}: `options` may be absent and then decodes as the defaults.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly requests: ReadonlyArray<BatchApplyActionItem.Encoded>;
    readonly options?: BatchApplyActionOptions.Encoded;
  }
}

// -----------------------------------------------------------------------------
// Edits
// -----------------------------------------------------------------------------

/**
 * Which object an edit touched: its object type and primary key.
 *
 * **Details**
 *
 * The primary key is carried as JSON because a result names no ontology to
 * type it against. The typed locator of an object belongs to the `Object`
 * concept.
 *
 * @category models
 * @since 0.0.0
 */
export class EditedObject extends S.Opaque<EditedObject, { readonly brand: unique symbol }>()(
  S.Struct({
    objectType: ObjectTypeApiName.annotateKey({ description: "Object type of the object." }),
    primaryKey: S.Json.annotateKey({ description: "Primary key of the object, in its wire encoding." }),
  }).pipe(
    $I.annoteSchema("EditedObject", {
      description: "Which object an edit touched: its object type and primary key.",
    })
  )
) {}

/**
 * Companion namespace for {@link EditedObject}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace EditedObject {
  /**
   * Encoded (wire) form of {@link EditedObject}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly objectType: ObjectTypeApiName.Encoded;
    readonly primaryKey: typeof S.Json.Encoded;
  }
}

/**
 * Reports that an object was created.
 *
 * @category models
 * @since 0.0.0
 */
export class AddedObject extends S.Opaque<AddedObject, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("addObject"),
    objectType: ObjectTypeApiName.annotateKey({ description: "Object type of the created object." }),
    primaryKey: S.Json.annotateKey({ description: "Primary key of the created object, in its wire encoding." }),
  }).pipe($I.annoteSchema("AddedObject", { description: "Reports that an object was created." }))
) {}

/**
 * Companion namespace for {@link AddedObject}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace AddedObject {
  /**
   * Encoded (wire) form of {@link AddedObject}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "addObject";
    readonly objectType: ObjectTypeApiName.Encoded;
    readonly primaryKey: typeof S.Json.Encoded;
  }
}

/**
 * Reports that an object was modified.
 *
 * @category models
 * @since 0.0.0
 */
export class ModifiedObject extends S.Opaque<ModifiedObject, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("modifyObject"),
    objectType: ObjectTypeApiName.annotateKey({ description: "Object type of the modified object." }),
    primaryKey: S.Json.annotateKey({ description: "Primary key of the modified object, in its wire encoding." }),
  }).pipe($I.annoteSchema("ModifiedObject", { description: "Reports that an object was modified." }))
) {}

/**
 * Companion namespace for {@link ModifiedObject}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ModifiedObject {
  /**
   * Encoded (wire) form of {@link ModifiedObject}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "modifyObject";
    readonly objectType: ObjectTypeApiName.Encoded;
    readonly primaryKey: typeof S.Json.Encoded;
  }
}

/**
 * Reports that an object was deleted.
 *
 * @category models
 * @since 0.0.0
 */
export class DeletedObject extends S.Opaque<DeletedObject, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("deleteObject"),
    objectType: ObjectTypeApiName.annotateKey({ description: "Object type of the deleted object." }),
    primaryKey: S.Json.annotateKey({ description: "Primary key of the deleted object, in its wire encoding." }),
  }).pipe($I.annoteSchema("DeletedObject", { description: "Reports that an object was deleted." }))
) {}

/**
 * Companion namespace for {@link DeletedObject}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace DeletedObject {
  /**
   * Encoded (wire) form of {@link DeletedObject}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "deleteObject";
    readonly objectType: ObjectTypeApiName.Encoded;
    readonly primaryKey: typeof S.Json.Encoded;
  }
}

/**
 * Reports that a link was created between two objects.
 *
 * @category models
 * @since 0.0.0
 */
export class AddedLink extends S.Opaque<AddedLink, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("addLink"),
    linkTypeApiNameAtoB: LinkTypeApiName.annotateKey({ description: "Name of the link as seen from side A." }),
    linkTypeApiNameBtoA: LinkTypeApiName.annotateKey({ description: "Name of the link as seen from side B." }),
    // Object on side A. (Bare: annotating the key of a class would type the field as its un-branded record.)
    aSideObject: EditedObject,
    // Object on side B. (Bare: annotating the key of a class would type the field as its un-branded record.)
    bSideObject: EditedObject,
  }).pipe($I.annoteSchema("AddedLink", { description: "Reports that a link was created between two objects." }))
) {}

/**
 * Companion namespace for {@link AddedLink}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace AddedLink {
  /**
   * Encoded (wire) form of {@link AddedLink}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "addLink";
    readonly linkTypeApiNameAtoB: LinkTypeApiName.Encoded;
    readonly linkTypeApiNameBtoA: LinkTypeApiName.Encoded;
    readonly aSideObject: EditedObject.Encoded;
    readonly bSideObject: EditedObject.Encoded;
  }
}

/**
 * Reports that a link between two objects was deleted.
 *
 * @category models
 * @since 0.0.0
 */
export class DeletedLink extends S.Opaque<DeletedLink, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("deleteLink"),
    linkTypeApiNameAtoB: LinkTypeApiName.annotateKey({ description: "Name of the link as seen from side A." }),
    linkTypeApiNameBtoA: LinkTypeApiName.annotateKey({ description: "Name of the link as seen from side B." }),
    // Object on side A. (Bare: annotating the key of a class would type the field as its un-branded record.)
    aSideObject: EditedObject,
    // Object on side B. (Bare: annotating the key of a class would type the field as its un-branded record.)
    bSideObject: EditedObject,
  }).pipe($I.annoteSchema("DeletedLink", { description: "Reports that a link between two objects was deleted." }))
) {}

/**
 * Companion namespace for {@link DeletedLink}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace DeletedLink {
  /**
   * Encoded (wire) form of {@link DeletedLink}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "deleteLink";
    readonly linkTypeApiNameAtoB: LinkTypeApiName.Encoded;
    readonly linkTypeApiNameBtoA: LinkTypeApiName.Encoded;
    readonly aSideObject: EditedObject.Encoded;
    readonly bSideObject: EditedObject.Encoded;
  }
}

/**
 * One edit an applied action reports: an object or a link that was added, modified or deleted.
 *
 * **Details**
 *
 * The result names identities only. The request-side edits of a transaction
 * are a different vocabulary that carries property values.
 *
 * **Example** (Count the objects an edit touches)
 *
 * ```ts import.meta.vitest name="Count the objects an edit touches"
 * import { ObjectTypeApiName } from "@beep/scratchpad/osdk/src/Identifier/index"
 * import { AddedObject, ObjectEdit } from "@beep/scratchpad/osdk/src/Action/index"
 *
 * const touchedObjects = ObjectEdit.match({
 *   addObject: () => 1,
 *   modifyObject: () => 1,
 *   deleteObject: () => 1,
 *   addLink: () => 2,
 *   deleteLink: () => 2,
 * })
 * const office = AddedObject.make({ objectType: ObjectTypeApiName.make("Office"), primaryKey: "NYC" })
 * touchedObjects(office) // => 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ObjectEdit = ObjectEditKind.mapMembers(() =>
  Tuple.make(AddedObject, ModifiedObject, DeletedObject, AddedLink, DeletedLink)
).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("ObjectEdit", {
    description: "One edit an applied action reports: an object or a link that was added, modified or deleted.",
  })
);

/**
 * Runtime type of {@link ObjectEdit}.
 *
 * @category models
 * @since 0.0.0
 */
export type ObjectEdit = typeof ObjectEdit.Type;

/**
 * Companion namespace for {@link ObjectEdit}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ObjectEdit {
  /**
   * Encoded (wire) form of {@link ObjectEdit}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded =
    | AddedObject.Encoded
    | ModifiedObject.Encoded
    | DeletedObject.Encoded
    | AddedLink.Encoded
    | DeletedLink.Encoded;
}

/**
 * One edit a batch of applied actions reports: the subset of {@link ObjectEdit} without deletions.
 *
 * **Example** (Reject a deletion in a batch result)
 *
 * ```ts import.meta.vitest name="Reject a deletion in a batch result"
 * import * as S from "effect/Schema"
 * import { BatchObjectEdit, ObjectEdit } from "@beep/scratchpad/osdk/src/Action/index"
 *
 * const deletion = { type: "deleteObject", objectType: "Office", primaryKey: "NYC" }
 * const verdicts = [S.is(S.toEncoded(ObjectEdit))(deletion), S.is(S.toEncoded(BatchObjectEdit))(deletion)]
 * verdicts // => [true, false]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const BatchObjectEdit = BatchObjectEditKind.mapMembers(() =>
  Tuple.make(AddedObject, ModifiedObject, AddedLink)
).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("BatchObjectEdit", {
    description: "One edit a batch of applied actions reports: an object added or modified, or a link added.",
  })
);

/**
 * Runtime type of {@link BatchObjectEdit}.
 *
 * @category models
 * @since 0.0.0
 */
export type BatchObjectEdit = typeof BatchObjectEdit.Type;

/**
 * Companion namespace for {@link BatchObjectEdit}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace BatchObjectEdit {
  /**
   * Encoded (wire) form of {@link BatchObjectEdit}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded =
    | AddedObject.Encoded
    | ModifiedObject.Encoded
    | AddedLink.Encoded;
}

/**
 * Every edit an applied action made, with how many of each kind there were.
 *
 * @category models
 * @since 0.0.0
 */
export class ObjectEdits extends S.Opaque<ObjectEdits, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("edits"),
    edits: S.Array(ObjectEdit).annotateKey({ description: "The edits, in the order the platform reports them." }),
    addedObjectCount: S.Natural.annotateKey({ description: "Number of objects created." }),
    modifiedObjectsCount: S.Natural.annotateKey({ description: "Number of objects modified." }),
    deletedObjectsCount: S.Natural.annotateKey({ description: "Number of objects deleted." }),
    addedLinksCount: S.Natural.annotateKey({ description: "Number of links created." }),
    deletedLinksCount: S.Natural.annotateKey({ description: "Number of links deleted." }),
  }).pipe(
    $I.annoteSchema("ObjectEdits", {
      description: "Every edit an applied action made, with how many of each kind there were.",
    })
  )
) {}

/**
 * Companion namespace for {@link ObjectEdits}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ObjectEdits {
  /**
   * Encoded (wire) form of {@link ObjectEdits}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "edits";
    readonly edits: ReadonlyArray<ObjectEdit.Encoded>;
    readonly addedObjectCount: number;
    readonly modifiedObjectsCount: number;
    readonly deletedObjectsCount: number;
    readonly addedLinksCount: number;
    readonly deletedLinksCount: number;
  }
}

/**
 * Every edit a batch of applied actions made, with how many of each kind there were.
 *
 * **Gotchas**
 *
 * A batch never lists deletions, yet it still reports how many there were.
 *
 * @category models
 * @since 0.0.0
 */
export class BatchObjectEdits extends S.Opaque<BatchObjectEdits, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("edits"),
    edits: S.Array(BatchObjectEdit).annotateKey({ description: "The edits, in the order the platform reports them." }),
    addedObjectCount: S.Natural.annotateKey({ description: "Number of objects created." }),
    modifiedObjectsCount: S.Natural.annotateKey({ description: "Number of objects modified." }),
    deletedObjectsCount: S.Natural.annotateKey({ description: "Number of objects deleted." }),
    addedLinksCount: S.Natural.annotateKey({ description: "Number of links created." }),
    deletedLinksCount: S.Natural.annotateKey({ description: "Number of links deleted." }),
  }).pipe(
    $I.annoteSchema("BatchObjectEdits", {
      description: "Every edit a batch of applied actions made, with how many of each kind there were.",
    })
  )
) {}

/**
 * Companion namespace for {@link BatchObjectEdits}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace BatchObjectEdits {
  /**
   * Encoded (wire) form of {@link BatchObjectEdits}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "edits";
    readonly edits: ReadonlyArray<BatchObjectEdit.Encoded>;
    readonly addedObjectCount: number;
    readonly modifiedObjectsCount: number;
    readonly deletedObjectsCount: number;
    readonly addedLinksCount: number;
    readonly deletedLinksCount: number;
  }
}

/**
 * The object types an action edited, reported when there are too many edits to list one by one.
 *
 * @category models
 * @since 0.0.0
 */
export class LargeScaleEdits extends S.Opaque<LargeScaleEdits, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("largeScaleEdits"),
    editedObjectTypes: S.Array(ObjectTypeApiName).annotateKey({ description: "Object types with at least one edit." }),
  }).pipe(
    $I.annoteSchema("LargeScaleEdits", {
      description: "The object types an action edited, reported when there are too many edits to list one by one.",
    })
  )
) {}

/**
 * Companion namespace for {@link LargeScaleEdits}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace LargeScaleEdits {
  /**
   * Encoded (wire) form of {@link LargeScaleEdits}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "largeScaleEdits";
    readonly editedObjectTypes: ReadonlyArray<ObjectTypeApiName.Encoded>;
  }
}

/**
 * What an applied action changed: either every edit, or only the edited object types when there are too many.
 *
 * **Details**
 *
 * OSDK regroups the edit list into five arrays, drops three of the five
 * counts and intersects a derived `editedObjectTypes` onto both cases. Here
 * the wire's two cases stay as they are and the derived view is the function
 * {@link editedObjectTypes}.
 *
 * **Example** (Report how much an action changed)
 *
 * ```ts import.meta.vitest name="Report how much an action changed"
 * import { ObjectTypeApiName } from "@beep/scratchpad/osdk/src/Identifier/index"
 * import { ActionEdits, LargeScaleEdits } from "@beep/scratchpad/osdk/src/Action/index"
 *
 * const describeEdits = ActionEdits.match({
 *   edits: ({ edits }) => `${edits.length} edits`,
 *   largeScaleEdits: ({ editedObjectTypes }) => `many edits across ${editedObjectTypes.length} object types`,
 * })
 * const bulk = LargeScaleEdits.make({ editedObjectTypes: [ObjectTypeApiName.make("Employee")] })
 * describeEdits(bulk) // => "many edits across 1 object types"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ActionEdits = ActionEditsKind.mapMembers(() => Tuple.make(ObjectEdits, LargeScaleEdits)).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("ActionEdits", {
    description: "What an applied action changed: every edit, or only the edited object types when there are too many.",
  })
);

/**
 * Runtime type of {@link ActionEdits}.
 *
 * @category models
 * @since 0.0.0
 */
export type ActionEdits = typeof ActionEdits.Type;

/**
 * Companion namespace for {@link ActionEdits}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ActionEdits {
  /**
   * Encoded (wire) form of {@link ActionEdits}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded =
    | ObjectEdits.Encoded
    | LargeScaleEdits.Encoded;
}

/**
 * What a batch of applied actions changed: every edit, or only the edited object types when there are too many.
 *
 * **Example** (Decode a batch result that only names object types)
 *
 * ```ts import.meta.vitest name="Decode a batch result that only names object types"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { BatchActionEdits } from "@beep/scratchpad/osdk/src/Action/index"
 *
 * const edits = await Effect.runPromise(
 *   S.decodeUnknownEffect(BatchActionEdits)({ type: "largeScaleEdits", editedObjectTypes: ["Employee"] })
 * )
 * BatchActionEdits.guards.largeScaleEdits(edits) // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const BatchActionEdits = ActionEditsKind.mapMembers(() => Tuple.make(BatchObjectEdits, LargeScaleEdits)).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("BatchActionEdits", {
    description: "What a batch of applied actions changed: every edit, or only the edited object types.",
  })
);

/**
 * Runtime type of {@link BatchActionEdits}.
 *
 * @category models
 * @since 0.0.0
 */
export type BatchActionEdits = typeof BatchActionEdits.Type;

/**
 * Companion namespace for {@link BatchActionEdits}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace BatchActionEdits {
  /**
   * Encoded (wire) form of {@link BatchActionEdits}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded =
    | BatchObjectEdits.Encoded
    | LargeScaleEdits.Encoded;
}

const touchedObjectTypes: (edit: ObjectEdit) => ReadonlyArray<ObjectTypeApiName> = ObjectEdit.match({
  addObject: ({ objectType }) => A.of(objectType),
  modifyObject: ({ objectType }) => A.of(objectType),
  deleteObject: ({ objectType }) => A.of(objectType),
  addLink: ({ aSideObject, bSideObject }) => A.make(aSideObject.objectType, bSideObject.objectType),
  deleteLink: ({ aSideObject, bSideObject }) => A.make(aSideObject.objectType, bSideObject.objectType),
});

const distinctObjectTypes = (edits: ReadonlyArray<ObjectEdit>): ReadonlyArray<ObjectTypeApiName> =>
  A.dedupe(A.flatMap(edits, touchedObjectTypes));

/**
 * The distinct object types an applied action or batch touched, in first-seen order.
 *
 * **Details**
 *
 * For a list of edits this is every object type named by an object edit or by
 * either side of a link edit. For large-scale edits it is the list the
 * platform already reports. It replaces the `editedObjectTypes` field OSDK
 * computes and intersects onto its results.
 *
 * **Example** (List the object types an action touched)
 *
 * ```ts import.meta.vitest name="List the object types an action touched"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { ActionEdits, editedObjectTypes } from "@beep/scratchpad/osdk/src/Action/index"
 *
 * const edits = await Effect.runPromise(
 *   S.decodeUnknownEffect(ActionEdits)({
 *     type: "edits",
 *     edits: [
 *       { type: "addObject", primaryKey: "NYC", objectType: "Office" },
 *       { type: "addObject", primaryKey: "50032", objectType: "Employee" },
 *       {
 *         type: "addLink",
 *         linkTypeApiNameAtoB: "occupants",
 *         linkTypeApiNameBtoA: "office",
 *         aSideObject: { primaryKey: "NYC", objectType: "Office" },
 *         bSideObject: { primaryKey: "50032", objectType: "Employee" },
 *       },
 *     ],
 *     addedObjectCount: 2,
 *     modifiedObjectsCount: 0,
 *     deletedObjectsCount: 0,
 *     addedLinksCount: 1,
 *     deletedLinksCount: 0,
 *   })
 * )
 * editedObjectTypes(edits) // => ["Office", "Employee"]
 * ```
 *
 * @category folding
 * @since 0.0.0
 */
export const editedObjectTypes: (edits: ActionEdits | BatchActionEdits) => ReadonlyArray<ObjectTypeApiName> =
  Match.type<ActionEdits | BatchActionEdits>().pipe(
    Match.discriminatorsExhaustive("type")({
      edits: ({ edits }) => distinctObjectTypes(edits),
      largeScaleEdits: ({ editedObjectTypes: objectTypes }) => objectTypes,
    })
  );

// -----------------------------------------------------------------------------
// Validation
// -----------------------------------------------------------------------------

// The wire types every evaluated bound as `any`: by the time a constraint is evaluated its bounds are
// already resolved to values of the parameter's own type, which only an ontology can name.
const evaluatedBounds = {
  lt: S.OptionFromOptionalKey(S.Json).pipe(
    S.withConstructorDefault(Effect.succeedNone),
    S.annotateKey({ description: "Exclusive upper bound, when the constraint has one." })
  ),
  lte: S.OptionFromOptionalKey(S.Json).pipe(
    S.withConstructorDefault(Effect.succeedNone),
    S.annotateKey({ description: "Inclusive upper bound, when the constraint has one." })
  ),
  gt: S.OptionFromOptionalKey(S.Json).pipe(
    S.withConstructorDefault(Effect.succeedNone),
    S.annotateKey({ description: "Exclusive lower bound, when the constraint has one." })
  ),
  gte: S.OptionFromOptionalKey(S.Json).pipe(
    S.withConstructorDefault(Effect.succeedNone),
    S.annotateKey({ description: "Inclusive lower bound, when the constraint has one." })
  ),
};

/**
 * Constraint that the number of elements of a list value falls within a range.
 *
 * @category models
 * @since 0.0.0
 */
export class ArraySizeConstraint extends S.Opaque<ArraySizeConstraint, { readonly brand: unique symbol }>()(
  S.Struct({ type: S.tag("arraySize"), ...evaluatedBounds }).pipe(
    $I.annoteSchema("ArraySizeConstraint", {
      description: "Constraint that the number of elements of a list value falls within a range.",
    })
  )
) {}

/**
 * Companion namespace for {@link ArraySizeConstraint}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ArraySizeConstraint {
  /**
   * Encoded (wire) form of {@link ArraySizeConstraint}: each bound the constraint lacks is an absent key.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "arraySize";
    readonly lt?: typeof S.Json.Encoded;
    readonly lte?: typeof S.Json.Encoded;
    readonly gt?: typeof S.Json.Encoded;
    readonly gte?: typeof S.Json.Encoded;
  }
}

/**
 * Constraint that the value is the user id of a member of one of the configured groups.
 *
 * @category models
 * @since 0.0.0
 */
export class GroupMemberConstraint extends S.Opaque<GroupMemberConstraint, { readonly brand: unique symbol }>()(
  S.Struct({ type: S.tag("groupMember") }).pipe(
    $I.annoteSchema("GroupMemberConstraint", {
      description: "Constraint that the value is the user id of a member of one of the configured groups.",
    })
  )
) {}

/**
 * Companion namespace for {@link GroupMemberConstraint}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace GroupMemberConstraint {
  /**
   * Encoded (wire) form of {@link GroupMemberConstraint}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "groupMember";
  }
}

/**
 * Constraint that the value is a property value of an object found in an object set.
 *
 * @category models
 * @since 0.0.0
 */
export class ObjectPropertyValueConstraint extends S.Opaque<
  ObjectPropertyValueConstraint,
  { readonly brand: unique symbol }
>()(
  S.Struct({ type: S.tag("objectPropertyValue") }).pipe(
    $I.annoteSchema("ObjectPropertyValueConstraint", {
      description: "Constraint that the value is a property value of an object found in an object set.",
    })
  )
) {}

/**
 * Companion namespace for {@link ObjectPropertyValueConstraint}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ObjectPropertyValueConstraint {
  /**
   * Encoded (wire) form of {@link ObjectPropertyValueConstraint}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "objectPropertyValue";
  }
}

/**
 * Constraint that the value is the primary key of an object found in an object set.
 *
 * @category models
 * @since 0.0.0
 */
export class ObjectQueryResultConstraint extends S.Opaque<
  ObjectQueryResultConstraint,
  { readonly brand: unique symbol }
>()(
  S.Struct({ type: S.tag("objectQueryResult") }).pipe(
    $I.annoteSchema("ObjectQueryResultConstraint", {
      description: "Constraint that the value is the primary key of an object found in an object set.",
    })
  )
) {}

/**
 * Companion namespace for {@link ObjectQueryResultConstraint}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ObjectQueryResultConstraint {
  /**
   * Encoded (wire) form of {@link ObjectQueryResultConstraint}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "objectQueryResult";
  }
}

/**
 * One choice of a parameter evaluated against a fixed set of options.
 *
 * @category models
 * @since 0.0.0
 */
export class ParameterOption extends S.Opaque<ParameterOption, { readonly brand: unique symbol }>()(
  S.Struct({
    displayName: S.OptionFromOptionalKey(S.String).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Human-readable label of the choice, when it has one." })
    ),
    value: S.OptionFromOptionalKey(S.Json).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "The value the choice stands for, in its wire encoding." })
    ),
  }).pipe(
    $I.annoteSchema("ParameterOption", {
      description: "One choice of a parameter evaluated against a fixed set of options.",
    })
  )
) {}

/**
 * Companion namespace for {@link ParameterOption}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ParameterOption {
  /**
   * Encoded (wire) form of {@link ParameterOption}: an unstated label or value is an absent key.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly displayName?: string;
    readonly value?: typeof S.Json.Encoded;
  }
}

/**
 * Constraint that the value is one of a fixed set of options, unless other values are allowed too.
 *
 * @category models
 * @since 0.0.0
 */
export class OneOfConstraint extends S.Opaque<OneOfConstraint, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("oneOf"),
    options: S.Array(ParameterOption).annotateKey({ description: "The choices the value was evaluated against." }),
    otherValuesAllowed: S.Boolean.annotateKey({
      description: "Whether a value outside the choices is still accepted.",
    }),
  }).pipe(
    $I.annoteSchema("OneOfConstraint", {
      description: "Constraint that the value is one of a fixed set of options, unless other values are allowed too.",
    })
  )
) {}

/**
 * Companion namespace for {@link OneOfConstraint}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace OneOfConstraint {
  /**
   * Encoded (wire) form of {@link OneOfConstraint}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "oneOf";
    readonly options: ReadonlyArray<ParameterOption.Encoded>;
    readonly otherValuesAllowed: boolean;
  }
}

/**
 * Constraint that the value falls within a range.
 *
 * @category models
 * @since 0.0.0
 */
export class RangeConstraint extends S.Opaque<RangeConstraint, { readonly brand: unique symbol }>()(
  S.Struct({ type: S.tag("range"), ...evaluatedBounds }).pipe(
    $I.annoteSchema("RangeConstraint", { description: "Constraint that the value falls within a range." })
  )
) {}

/**
 * Companion namespace for {@link RangeConstraint}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace RangeConstraint {
  /**
   * Encoded (wire) form of {@link RangeConstraint}: each bound the constraint lacks is an absent key.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "range";
    readonly lt?: typeof S.Json.Encoded;
    readonly lte?: typeof S.Json.Encoded;
    readonly gt?: typeof S.Json.Encoded;
    readonly gte?: typeof S.Json.Encoded;
  }
}

/**
 * Constraint that the length of a string value falls within a range, which the platform always treats as inclusive.
 *
 * @category models
 * @since 0.0.0
 */
export class StringLengthConstraint extends S.Opaque<StringLengthConstraint, { readonly brand: unique symbol }>()(
  S.Struct({ type: S.tag("stringLength"), ...evaluatedBounds }).pipe(
    $I.annoteSchema("StringLengthConstraint", {
      description: "Constraint that the length of a string value falls within a range.",
    })
  )
) {}

/**
 * Companion namespace for {@link StringLengthConstraint}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace StringLengthConstraint {
  /**
   * Encoded (wire) form of {@link StringLengthConstraint}: each bound the constraint lacks is an absent key.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "stringLength";
    readonly lt?: typeof S.Json.Encoded;
    readonly lte?: typeof S.Json.Encoded;
    readonly gt?: typeof S.Json.Encoded;
    readonly gte?: typeof S.Json.Encoded;
  }
}

/**
 * Constraint that a string value matches a regular expression.
 *
 * @category models
 * @since 0.0.0
 */
export class StringRegexMatchConstraint extends S.Opaque<
  StringRegexMatchConstraint,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    type: S.tag("stringRegexMatch"),
    regex: S.String.annotateKey({ description: "The regular expression the value must match." }),
    configuredFailureMessage: S.OptionFromOptionalKey(S.String).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Message configured for when the value does not match." })
    ),
  }).pipe(
    $I.annoteSchema("StringRegexMatchConstraint", {
      description: "Constraint that a string value matches a regular expression.",
    })
  )
) {}

/**
 * Companion namespace for {@link StringRegexMatchConstraint}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace StringRegexMatchConstraint {
  /**
   * Encoded (wire) form of {@link StringRegexMatchConstraint}: an unconfigured failure message is an absent key.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "stringRegexMatch";
    readonly regex: string;
    readonly configuredFailureMessage?: string;
  }
}

/**
 * Marks a constraint that could not be evaluated because something it depends on is missing or invalid.
 *
 * **Details**
 *
 * This happens when a parameter's allowed values are defined by another
 * parameter, or by an object set, that is itself missing or invalid.
 *
 * @category models
 * @since 0.0.0
 */
export class UnevaluableConstraint extends S.Opaque<UnevaluableConstraint, { readonly brand: unique symbol }>()(
  S.Struct({ type: S.tag("unevaluable") }).pipe(
    $I.annoteSchema("UnevaluableConstraint", {
      description: "A constraint that could not be evaluated because something it depends on is missing or invalid.",
    })
  )
) {}

/**
 * Companion namespace for {@link UnevaluableConstraint}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace UnevaluableConstraint {
  /**
   * Encoded (wire) form of {@link UnevaluableConstraint}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "unevaluable";
  }
}

/**
 * A constraint one field of a struct parameter was evaluated against.
 *
 * **Example** (Decode a struct field constraint)
 *
 * ```ts import.meta.vitest name="Decode a struct field constraint"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { StructFieldConstraint } from "@beep/scratchpad/osdk/src/Action/index"
 *
 * const constraint = await Effect.runPromise(
 *   S.decodeUnknownEffect(StructFieldConstraint)({ type: "stringRegexMatch", regex: "^[0-9]{5}$" })
 * )
 * StructFieldConstraint.guards.stringRegexMatch(constraint) // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const StructFieldConstraint = StructFieldConstraintKind.mapMembers(() =>
  Tuple.make(
    ObjectQueryResultConstraint,
    OneOfConstraint,
    RangeConstraint,
    StringLengthConstraint,
    StringRegexMatchConstraint
  )
).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("StructFieldConstraint", {
    description: "A constraint one field of a struct parameter was evaluated against.",
  })
);

/**
 * Runtime type of {@link StructFieldConstraint}.
 *
 * @category models
 * @since 0.0.0
 */
export type StructFieldConstraint = typeof StructFieldConstraint.Type;

/**
 * Companion namespace for {@link StructFieldConstraint}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace StructFieldConstraint {
  /**
   * Encoded (wire) form of {@link StructFieldConstraint}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded =
    | ObjectQueryResultConstraint.Encoded
    | OneOfConstraint.Encoded
    | RangeConstraint.Encoded
    | StringLengthConstraint.Encoded
    | StringRegexMatchConstraint.Encoded;
}

/**
 * The verdict on one field of a struct argument and the constraints it was evaluated against.
 *
 * @category models
 * @since 0.0.0
 */
export class StructFieldEvaluation extends S.Opaque<StructFieldEvaluation, { readonly brand: unique symbol }>()(
  S.Struct({
    result: ValidationResult.annotateKey({ description: "Whether the field's value satisfies its constraints." }),
    evaluatedConstraints: S.Array(StructFieldConstraint).annotateKey({
      description: "Constraints the field's value was evaluated against.",
    }),
    required: S.Boolean.annotateKey({ description: "Whether the struct value must carry this field." }),
  }).pipe(
    $I.annoteSchema("StructFieldEvaluation", {
      description: "The verdict on one field of a struct argument and the constraints it was evaluated against.",
    })
  )
) {}

/**
 * Companion namespace for {@link StructFieldEvaluation}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace StructFieldEvaluation {
  /**
   * Encoded (wire) form of {@link StructFieldEvaluation}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly result: ValidationResult.Encoded;
    readonly evaluatedConstraints: ReadonlyArray<StructFieldConstraint.Encoded>;
    readonly required: boolean;
  }
}

/**
 * Evaluation of a struct argument, field by field.
 *
 * @category models
 * @since 0.0.0
 */
export class StructConstraint extends S.Opaque<StructConstraint, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("struct"),
    structFields: S.Record(StructFieldApiName, StructFieldEvaluation).annotateKey({
      description: "Evaluation of each field, by field name.",
    }),
  }).pipe($I.annoteSchema("StructConstraint", { description: "Evaluation of a struct argument, field by field." }))
) {}

/**
 * Companion namespace for {@link StructConstraint}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace StructConstraint {
  /**
   * Encoded (wire) form of {@link StructConstraint}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "struct";
    readonly structFields: R.ReadonlyRecord<StructFieldApiName.Encoded, StructFieldEvaluation.Encoded>;
  }
}

/**
 * Evaluation of one entry of a list argument: today always the evaluation of a struct.
 *
 * **Example** (Decode the evaluation of one list entry)
 *
 * ```ts import.meta.vitest name="Decode the evaluation of one list entry"
 * import * as Effect from "effect/Effect"
 * import * as R from "effect/Record"
 * import * as S from "effect/Schema"
 * import { ArrayEntryConstraint } from "@beep/scratchpad/osdk/src/Action/index"
 *
 * const entry = await Effect.runPromise(
 *   S.decodeUnknownEffect(ArrayEntryConstraint)({
 *     type: "struct",
 *     structFields: { city: { result: "VALID", evaluatedConstraints: [], required: true } },
 *   })
 * )
 * R.keys(entry.structFields) // => ["city"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ArrayEntryConstraint = EvaluatedConstraintKind.pick(["struct"])
  .mapMembers(() => Tuple.make(StructConstraint))
  .pipe(
    S.toTaggedUnion("type"),
    $I.annoteSchema("ArrayEntryConstraint", {
      description: "Evaluation of one entry of a list argument: today always the evaluation of a struct.",
    })
  );

/**
 * Runtime type of {@link ArrayEntryConstraint}.
 *
 * @category models
 * @since 0.0.0
 */
export type ArrayEntryConstraint = typeof ArrayEntryConstraint.Type;

/**
 * Companion namespace for {@link ArrayEntryConstraint}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ArrayEntryConstraint {
  /**
   * Encoded (wire) form of {@link ArrayEntryConstraint}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded =
    | StructConstraint.Encoded;
}

/**
 * Evaluation of a list argument, entry by entry.
 *
 * @category models
 * @since 0.0.0
 */
export class ArrayConstraint extends S.Opaque<ArrayConstraint, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("array"),
    entries: S.Array(ArrayEntryConstraint).annotateKey({ description: "Evaluation of each entry, in order." }),
  }).pipe($I.annoteSchema("ArrayConstraint", { description: "Evaluation of a list argument, entry by entry." }))
) {}

/**
 * Companion namespace for {@link ArrayConstraint}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ArrayConstraint {
  /**
   * Encoded (wire) form of {@link ArrayConstraint}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "array";
    readonly entries: ReadonlyArray<ArrayEntryConstraint.Encoded>;
  }
}

/**
 * A constraint an argument was evaluated against when its action was validated.
 *
 * **Details**
 *
 * Which constraints apply is decided per request, from the other arguments.
 * Bounds are already resolved values, carried as JSON because only the
 * parameter's type says how to read them. OSDK's own copy of this union omits
 * the `struct` and `array` cases the platform sends.
 *
 * **Example** (Explain a constraint to a user)
 *
 * ```ts import.meta.vitest name="Explain a constraint to a user"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { EvaluatedConstraint } from "@beep/scratchpad/osdk/src/Action/index"
 *
 * const explain = EvaluatedConstraint.matchOrElse(
 *   {
 *     oneOf: ({ options }) => `pick one of ${options.length} options`,
 *     stringRegexMatch: ({ regex }) => `must match ${regex}`,
 *     unevaluable: () => "fix the other parameters first",
 *   },
 *   ({ type }) => type
 * )
 * const constraint = await Effect.runPromise(
 *   S.decodeUnknownEffect(EvaluatedConstraint)({
 *     type: "oneOf",
 *     options: [{ displayName: "New York", value: "NYC" }, { value: "SEA" }],
 *     otherValuesAllowed: false,
 *   })
 * )
 * explain(constraint) // => "pick one of 2 options"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const EvaluatedConstraint = EvaluatedConstraintKind.mapMembers(() =>
  Tuple.make(
    ArraySizeConstraint,
    GroupMemberConstraint,
    ObjectPropertyValueConstraint,
    ObjectQueryResultConstraint,
    OneOfConstraint,
    RangeConstraint,
    StringLengthConstraint,
    StringRegexMatchConstraint,
    UnevaluableConstraint,
    StructConstraint,
    ArrayConstraint
  )
).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("EvaluatedConstraint", {
    description: "A constraint an argument was evaluated against when its action was validated.",
  })
);

/**
 * Runtime type of {@link EvaluatedConstraint}.
 *
 * @category models
 * @since 0.0.0
 */
export type EvaluatedConstraint = typeof EvaluatedConstraint.Type;

/**
 * Companion namespace for {@link EvaluatedConstraint}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace EvaluatedConstraint {
  /**
   * Encoded (wire) form of {@link EvaluatedConstraint}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded =
    | ArraySizeConstraint.Encoded
    | GroupMemberConstraint.Encoded
    | ObjectPropertyValueConstraint.Encoded
    | ObjectQueryResultConstraint.Encoded
    | OneOfConstraint.Encoded
    | RangeConstraint.Encoded
    | StringLengthConstraint.Encoded
    | StringRegexMatchConstraint.Encoded
    | UnevaluableConstraint.Encoded
    | StructConstraint.Encoded
    | ArrayConstraint.Encoded;
}

/**
 * The verdict on one submission criterion: a precondition configured on the action type as a whole.
 *
 * @category models
 * @since 0.0.0
 */
export class SubmissionCriterion extends S.Opaque<SubmissionCriterion, { readonly brand: unique symbol }>()(
  S.Struct({
    result: ValidationResult.annotateKey({ description: "Whether the criterion is met." }),
    configuredFailureMessage: S.OptionFromOptionalKey(S.String).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Message configured for when the criterion is not met." })
    ),
  }).pipe(
    $I.annoteSchema("SubmissionCriterion", {
      description: "The verdict on one submission criterion: a precondition configured on the action type as a whole.",
    })
  )
) {}

/**
 * Companion namespace for {@link SubmissionCriterion}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace SubmissionCriterion {
  /**
   * Encoded (wire) form of {@link SubmissionCriterion}: an unconfigured failure message is an absent key.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly result: ValidationResult.Encoded;
    readonly configuredFailureMessage?: string;
  }
}

/**
 * The verdict on one argument and the constraints it was evaluated against.
 *
 * @category models
 * @since 0.0.0
 */
export class ParameterEvaluation extends S.Opaque<ParameterEvaluation, { readonly brand: unique symbol }>()(
  S.Struct({
    result: ValidationResult.annotateKey({ description: "Whether the argument satisfies its constraints." }),
    evaluatedConstraints: S.Array(EvaluatedConstraint).annotateKey({
      description: "Constraints the argument was evaluated against.",
    }),
    required: S.Boolean.annotateKey({ description: "Whether the request must supply this argument." }),
    defaultValue: S.OptionFromOptionalKey(S.Json).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Value the platform would prefill, in its wire encoding, when there is one." })
    ),
  }).pipe(
    $I.annoteSchema("ParameterEvaluation", {
      description: "The verdict on one argument and the constraints it was evaluated against.",
    })
  )
) {}

/**
 * Companion namespace for {@link ParameterEvaluation}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ParameterEvaluation {
  /**
   * Encoded (wire) form of {@link ParameterEvaluation}: a missing default value is an absent key.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly result: ValidationResult.Encoded;
    readonly evaluatedConstraints: ReadonlyArray<EvaluatedConstraint.Encoded>;
    readonly required: boolean;
    readonly defaultValue?: typeof S.Json.Encoded;
  }
}

/**
 * The outcome of validating an action: an overall verdict, the submission criteria and every parameter's evaluation.
 *
 * **Details**
 *
 * A response with HTTP status 200 does not mean the action was applied: an
 * `invalid` verdict here means nothing was executed. OSDK turns that case
 * into a thrown `ActionValidationError`; here it is a value to match on.
 *
 * **Example** (List the parameters that failed validation)
 *
 * ```ts import.meta.vitest name="List the parameters that failed validation"
 * import * as Effect from "effect/Effect"
 * import * as R from "effect/Record"
 * import * as S from "effect/Schema"
 * import { ActionValidation } from "@beep/scratchpad/osdk/src/Action/index"
 *
 * const validation = await Effect.runPromise(
 *   S.decodeUnknownEffect(ActionValidation)({
 *     result: "INVALID",
 *     submissionCriteria: [],
 *     parameters: {
 *       officeId: { result: "VALID", evaluatedConstraints: [], required: true },
 *       capacity: { result: "INVALID", evaluatedConstraints: [{ type: "range", gte: 1 }], required: false },
 *     },
 *   })
 * )
 * const failed = R.keys(R.filter(validation.parameters, (parameter) => parameter.result === "invalid"))
 * failed // => ["capacity"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ActionValidation extends S.Opaque<ActionValidation, { readonly brand: unique symbol }>()(
  S.Struct({
    result: ValidationResult.annotateKey({ description: "Whether the action as a whole may be applied." }),
    submissionCriteria: S.Array(SubmissionCriterion).annotateKey({
      description: "Verdict on each precondition configured on the action type.",
    }),
    parameters: S.Record(ParameterId, ParameterEvaluation).annotateKey({
      description: "Evaluation of each parameter, by identifier.",
    }),
  }).pipe(
    $I.annoteSchema("ActionValidation", {
      description: "The outcome of validating an action: an overall verdict, the criteria and every parameter.",
    })
  )
) {}

/**
 * Companion namespace for {@link ActionValidation}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ActionValidation {
  /**
   * Encoded (wire) form of {@link ActionValidation}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly result: ValidationResult.Encoded;
    readonly submissionCriteria: ReadonlyArray<SubmissionCriterion.Encoded>;
    readonly parameters: R.ReadonlyRecord<ParameterId.Encoded, ParameterEvaluation.Encoded>;
  }
}

// -----------------------------------------------------------------------------
// Responses
// -----------------------------------------------------------------------------

/**
 * The response to applying one action.
 *
 * **Details**
 *
 * Every part is optional on the wire. `edits` is present only when the request
 * asked for edits and the action ran; a validate-only request is answered with
 * `validation` alone.
 *
 * **Example** (Decode a response that carries neither validation nor edits)
 *
 * ```ts import.meta.vitest name="Decode a response that carries neither validation nor edits"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { ApplyActionResponse } from "@beep/scratchpad/osdk/src/Action/index"
 *
 * const response = await Effect.runPromise(S.decodeUnknownEffect(ApplyActionResponse)({}))
 * const absent = [O.isNone(response.validation), O.isNone(response.edits), O.isNone(response.operationId)]
 * absent // => [true, true, true]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ApplyActionResponse extends S.Opaque<ApplyActionResponse, { readonly brand: unique symbol }>()(
  S.Struct({
    operationId: S.OptionFromOptionalKey(S.String).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Identifier of the executed operation, when the platform reports it." })
    ),
    validation: S.OptionFromOptionalKey(ActionValidation).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Outcome of validating the action, when reported." })
    ),
    edits: S.OptionFromOptionalKey(ActionEdits).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "What the action changed, when the request asked for edits." })
    ),
  }).pipe($I.annoteSchema("ApplyActionResponse", { description: "The response to applying one action." }))
) {}

/**
 * Companion namespace for {@link ApplyActionResponse}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ApplyActionResponse {
  /**
   * Encoded (wire) form of {@link ApplyActionResponse}: each unreported part is an absent key.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly operationId?: string;
    readonly validation?: ActionValidation.Encoded;
    readonly edits?: ActionEdits.Encoded;
  }
}

/**
 * The response to applying a batch of actions: only edits, because a batch reports no validation.
 *
 * @category models
 * @since 0.0.0
 */
export class BatchApplyActionResponse extends S.Opaque<BatchApplyActionResponse, { readonly brand: unique symbol }>()(
  S.Struct({
    edits: S.OptionFromOptionalKey(BatchActionEdits).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "What the batch changed, when the request asked for edits." })
    ),
  }).pipe(
    $I.annoteSchema("BatchApplyActionResponse", {
      description: "The response to applying a batch of actions: only edits, because a batch reports no validation.",
    })
  )
) {}

/**
 * Companion namespace for {@link BatchApplyActionResponse}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace BatchApplyActionResponse {
  /**
   * Encoded (wire) form of {@link BatchApplyActionResponse}: unreported edits are an absent key.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly edits?: BatchActionEdits.Encoded;
  }
}
