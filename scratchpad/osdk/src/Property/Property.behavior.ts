/**
 * Projections from a property type to the codecs of its values, and from a selector to the type it addresses.
 *
 * **Details**
 *
 * This is the hinge of the whole library. A {@link PropertyType} is data; the
 * functions here turn that data into schemas. {@link leafCodec} is the table
 * of the leaf types: the rows every universe shares (`sharedCodec` of `Value`)
 * and the rows only a property has. {@link valueCodec} unfolds a vector, an
 * array and a struct and reads every other type from that table by its tag,
 * so adding a property type is a compile error until its value codec exists,
 * and every consumer (instances, filters, typed specs) inherits the new case
 * for free. {@link operandCodec} reads the
 * scalar a filter or a range bound carries as a value of the property it is
 * compared with, which {@link operandType} names. {@link selectedType} is the
 * one reading of a selector against a table of properties that the filter
 * check and the aggregation check share.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as A from "effect/Array";
import { dual, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Struct from "effect/Struct";
import * as Tuple from "effect/Tuple";
import { AttachmentReference } from "../Attachment/Attachment.model.ts";
import { PropertyTypeKind } from "../DataType/DataType.values.ts";
import { GeoPoint } from "../Geo/Geo.model.ts";
import { structCodec } from "../internal/ProjectedCodec.ts";
import { GeotimeSeriesReference } from "../TimeSeries/GeotimeSeries.model.ts";
import { TimeSeriesReference } from "../TimeSeries/TimeSeries.model.ts";
import { sharedCodec } from "../Value/Value.behavior.ts";
import { ScalarValue, VectorOf } from "../Value/Value.model.ts";
import { PropertySelector, PropertyType } from "./Property.model.ts";
import type { PropertyApiName, StructFieldApiName } from "../Identifier/Identifier.model.ts";
import type { PropertyDefinition } from "./Property.model.ts";

// The tags of a property type that holds no other type: every tag but the three `valueCodec` unfolds.
const LeafKind = PropertyTypeKind.omit(["vector", "array", "struct"]);

/**
 * The codec of one value of each leaf property type, keyed by the type's tag.
 *
 * **Details**
 *
 * A leaf type is one whose codec does not depend on anything the type states:
 * every property type but a vector, an array and a struct. The table is the
 * rows every universe shares (`sharedCodec` of `Value`) plus the four rows
 * only a property has: an attachment (a reference record, where an argument
 * holds the identifier), a point, and the two series references. Its keys are
 * exactly the leaf tags, each with the type of its own codec. {@link valueCodec}
 * reads it, and the leaf specs of `Model` are built from it by key, so the
 * runtime projection and the typed layer cannot name two codecs for one tag.
 *
 * **Example** (Count the leaf rows and find one in the shared table)
 *
 * ```ts import.meta.vitest name="Count the leaf rows and find one in the shared table"
 * import * as A from "effect/Array"
 * import * as R from "effect/Record"
 * import { leafCodec } from "@beep/scratchpad/osdk/src/Property/index"
 * import { sharedCodec } from "@beep/scratchpad/osdk/src/Value/index"
 *
 * const tags: ReadonlyArray<string> = R.keys(leafCodec)
 * const facts = [tags.length, A.contains(tags, "vector"), leafCodec.date === sharedCodec.date]
 * facts // => [19, false, true]
 * ```
 *
 * @category projections
 * @since 0.0.0
 */
export const leafCodec = Struct.pick(
  {
    ...sharedCodec,
    attachment: AttachmentReference,
    geopoint: GeoPoint,
    geotimeSeriesReference: GeotimeSeriesReference,
    timeseries: TimeSeriesReference,
  },
  LeafKind.literals
);

/**
 * The codec of one value of the given property type: wire JSON on the encoded side, domain value on the type side.
 *
 * **Details**
 *
 * A leaf type is read from {@link leafCodec} by its tag. The three other
 * types are unfolded, and the facts they state precipitate into the codec: a vector's `dimension`
 * becomes an exact length check, an array's element type becomes the element
 * codec, and a struct's fields become a struct codec whose fields are optional
 * on the wire and `Option` in the domain. The static type is necessarily loose
 * (`unknown`), because the type is only known at runtime; statically typed
 * codecs come from the typed property specs in `Model`, which pair each builder
 * with the same codecs used here.
 *
 * **Example** (Project an array-of-timestamps type to its codec)
 *
 * ```ts import.meta.vitest name="Project an array-of-timestamps type to its codec"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { TimestampType } from "@beep/scratchpad/osdk/src/DataType/index"
 * import { ArrayType, valueCodec } from "@beep/scratchpad/osdk/src/Property/index"
 *
 * const codec = valueCodec(ArrayType.make({ elementType: TimestampType.make({}) }))
 * const decoded = await Effect.runPromise(S.decodeUnknownEffect(codec)(["2021-01-04T05:00:00Z"]))
 * const wire = await Effect.runPromise(S.encodeUnknownEffect(codec)(decoded))
 * wire // => ["2021-01-04T05:00:00.000Z"]
 * ```
 *
 * @category projections
 * @since 0.0.0
 */
export const valueCodec: (type: PropertyType) => S.Codec<unknown, unknown> = PropertyType.matchOrElse(
  {
    vector: ({ dimension }) => VectorOf(dimension),
    array: ({ elementType }) => S.Array(valueCodec(elementType)),
    struct: ({ fields }) =>
      structCodec(A.map(fields, (field) => Tuple.make(field.apiName, fieldCodec(field.dataType)))),
  },
  (leaf) => leafCodec[leaf.type]
);

/**
 * The codec of a property as a field of a record: possibly absent on the wire, an `Option` in the domain.
 *
 * **Details**
 *
 * The platform omits null properties from object JSON, and some paths send an
 * explicit `null`. Decoding accepts both as `None`; encoding omits the key.
 * This replaces OSDK's `T | undefined` plus its vestigial strict / not-strict
 * nullability machinery with one value.
 *
 * **Example** (Decode an absent field to none)
 *
 * ```ts import.meta.vitest name="Decode an absent field to none"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { StringType } from "@beep/scratchpad/osdk/src/DataType/index"
 * import { fieldCodec } from "@beep/scratchpad/osdk/src/Property/index"
 *
 * const Row = S.Struct({ nickname: fieldCodec(StringType.make({})) })
 * const row = await Effect.runPromise(S.decodeUnknownEffect(Row)({}))
 * O.isNone(row.nickname) // => true
 * ```
 *
 * @category projections
 * @since 0.0.0
 */
export const fieldCodec = (type: PropertyType) => S.OptionFromOptionalNullOr(valueCodec(type));

/**
 * The type a comparison with a property of the given type is made against: the type itself, or an array's element type.
 *
 * **Details**
 *
 * An operator applied to an array property tests the elements of the array:
 * the wire has no wrapper for "some element is less than 5", it is `lt` on the
 * array property itself. So the operand of an array is an operand of its
 * element type, at any depth, and every other type is compared as itself. The
 * operand codec, the operand table of the filter policy and the in-memory
 * transport all read this one rule.
 *
 * **Example** (Look through an array of arrays to what its operands are compared with)
 *
 * ```ts import.meta.vitest name="Look through an array of arrays to what its operands are compared with"
 * import { DateType, StringType } from "@beep/scratchpad/osdk/src/DataType/index"
 * import { ArrayType, operandType } from "@beep/scratchpad/osdk/src/Property/index"
 *
 * const calendar = ArrayType.make({ elementType: ArrayType.make({ elementType: DateType.make({}) }) })
 * const tags = [operandType(calendar).type, operandType(StringType.make({})).type]
 * tags // => ["date", "string"]
 * ```
 *
 * @param type - The type of the property an operator is applied to.
 * @category projections
 * @since 0.0.0
 */
export const operandType = (type: PropertyType): PropertyType =>
  PropertyType.guards.array(type) ? operandType(type.elementType) : type;

/**
 * The codec of a comparison operand of the given property type: the wire scalar encoded, the property's value decoded.
 *
 * **Details**
 *
 * A filter, a range bound and an object locator hold an operand as the wire
 * scalar that carries it (`ScalarValue`), because no property type is in hand
 * where they are decoded. This projection is the reading a type adds: the same
 * scalar, decoded by the property's own {@link valueCodec}. The operand of a
 * `long` property is a `bigint`, of a `decimal` property a `BigDecimal`, of a
 * `date` property a `LocalDate`, of a `timestamp` property a `DateTime.Utc`,
 * and encoding writes the canonical wire scalar back. The typed filter
 * constructors of `Model` write their operands this way, and the in-memory
 * transport reads them this way before it compares.
 *
 * The value in question is a value of {@link operandType}: for an array
 * property an operand is one element, not a list.
 *
 * **Gotchas**
 *
 * The projection asks one thing of a type: does a value of it travel as one
 * scalar. A struct, a geometry, a vector, an attachment and a media reference
 * do not, so the codec projected from such a type decodes no scalar and
 * encodes no value: no operand is a value of the property. The filter policy
 * still admits a text operand for an attachment, a media reference and a
 * vector, as OSDK's fallback filter does. That text is not a value of the
 * property, so it stays text and no codec reads it. A series reference has a
 * bare-identifier form beside its record forms; only that form is an operand.
 *
 * **Example** (Read a wire operand as a value of the property it is compared with)
 *
 * ```ts import.meta.vitest name="Read a wire operand as a value of the property it is compared with"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { DateType, LongType } from "@beep/scratchpad/osdk/src/DataType/index"
 * import { ArrayType, operandCodec } from "@beep/scratchpad/osdk/src/Property/index"
 *
 * const badge = await Effect.runPromise(S.decodeEffect(operandCodec(LongType.make({})))("9007199254740993"))
 * const hired = operandCodec(ArrayType.make({ elementType: DateType.make({}) }))
 * const day = await Effect.runPromise(S.decodeEffect(hired)("2021-01-04"))
 * const wire = await Effect.runPromise(S.encodeEffect(hired)(day))
 * const facts = [badge, [day.year, day.month, day.day], wire, O.isNone(S.decodeOption(hired)("4 January"))]
 * facts // => [BigInt("9007199254740993"), [2021, 1, 4], "2021-01-04", true]
 * ```
 *
 * @param type - The type of the property the operand is compared with.
 * @category projections
 * @since 0.0.0
 */
export const operandCodec = (type: PropertyType): S.Codec<unknown, ScalarValue> =>
  ScalarValue.pipe(S.decodeTo(valueCodec(operandType(type))));

// -----------------------------------------------------------------------------
// Selector -> the type it addresses
// -----------------------------------------------------------------------------

const structFieldType = (type: PropertyType, field: StructFieldApiName): O.Option<PropertyType> =>
  PropertyType.matchOrElse(
    type,
    {
      struct: ({ fields }) =>
        O.map(
          A.findFirst(fields, (candidate) => candidate.apiName === field),
          (found) => found.dataType
        ),
      // A field of an array of structs is addressed with the same selector as a field of a struct.
      array: ({ elementType }) => structFieldType(elementType, field),
    },
    O.none<PropertyType>
  );

const selectIn = (properties: Readonly<Record<PropertyApiName, PropertyDefinition>>) => {
  const select: (selector: PropertySelector) => O.Option<O.Option<PropertyType>> = PropertySelector.match({
    property: ({ apiName }) => O.map(R.get(properties, apiName), (definition) => O.some(definition.dataType)),
    structField: ({ propertyApiName, structFieldApiName }) =>
      pipe(
        R.get(properties, propertyApiName),
        O.flatMap((definition) => structFieldType(definition.dataType, structFieldApiName)),
        O.map(O.some)
      ),
    // A load level changes how much of a composite is loaded, so the effective type is the platform's call.
    propertyWithLoadLevel: ({ selector }) => O.map(select(selector), O.none<PropertyType>),
    // Which property plays a role is a fact of the object type, not of its property table.
    titleProperty: () => O.some(O.none<PropertyType>()),
    primaryKeyProperty: () => O.some(O.none<PropertyType>()),
  });
  return select;
};

/**
 * The type of what a selector addresses in a table of properties, in two layers.
 *
 * **Details**
 *
 * The outer `Option` answers "is it declared": none when the selector names a
 * property, or a field of a struct, that the table does not hold. The inner
 * `Option` answers "can its type be read from the table": none for the title
 * and primary-key selectors, whose target is a fact of the object type and not
 * of its property table, and for a selector with a load level, whose effective
 * type the platform decides. A field of an array of structs is addressed like
 * a field of a struct.
 *
 * **Example** (Tell an undeclared property from one whose type the table cannot give)
 *
 * ```ts import.meta.vitest name="Tell an undeclared property from one whose type the table cannot give"
 * import * as O from "effect/Option"
 * import * as R from "effect/Record"
 * import { IntegerType } from "@beep/scratchpad/osdk/src/DataType/index"
 * import { PropertyApiName, PropertyTypeRid } from "@beep/scratchpad/osdk/src/Identifier/index"
 * import { PropertyByName, PropertyDefinition, TitleProperty, selectedType } from "@beep/scratchpad/osdk/src/Property/index"
 *
 * const rid = PropertyTypeRid.make("ri.ontology.main.property.example")
 * const properties = R.fromEntries([
 *   [PropertyApiName.make("age"), PropertyDefinition.make({ dataType: IntegerType.make({}), rid })],
 * ])
 * const named = (apiName: string) => PropertyByName.make({ apiName: PropertyApiName.make(apiName) })
 * const tagOf = O.map(O.map((type: { readonly type: string }) => type.type))
 * const answers = [
 *   tagOf(selectedType(named("age"), properties)),
 *   tagOf(selectedType(named("nickname"), properties)),
 *   tagOf(selectedType(TitleProperty.make({}), properties)),
 * ]
 * answers // => [O.some(O.some("integer")), O.none(), O.some(O.none())]
 * ```
 *
 * @category projections
 * @since 0.0.0
 */
export const selectedType: {
  (
    properties: Readonly<Record<PropertyApiName, PropertyDefinition>>
  ): (selector: PropertySelector) => O.Option<O.Option<PropertyType>>;
  (
    selector: PropertySelector,
    properties: Readonly<Record<PropertyApiName, PropertyDefinition>>
  ): O.Option<O.Option<PropertyType>>;
} = dual(
  2,
  (
    selector: PropertySelector,
    properties: Readonly<Record<PropertyApiName, PropertyDefinition>>
  ): O.Option<O.Option<PropertyType>> => selectIn(properties)(selector)
);
