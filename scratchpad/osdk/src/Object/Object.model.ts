/**
 * Object instances: which object a value refers to, and what an object holds.
 *
 * **Details**
 *
 * The wire spells "which object" four ways (a `"<type>:<key>"` string, a
 * `{ objectTypeApiName, primaryKeyValue }` record, the `__apiName` and
 * `__primaryKey` keys of an object, a `{ objectType, primaryKey }` record) and
 * mixes an object's identity into the same flat record as its properties. Here
 * identity is one value, {@link ObjectLocator}, every wire spelling is a codec
 * that decodes to it, and {@link OntologyObject} keeps identity and properties
 * apart.
 *
 * The codecs in this module need no ontology, so property values stay JSON and
 * a primary key is the JSON scalar that carries it. {@link ObjectRecord} is
 * the flat record as it travels, the encoded side of every codec of an object.
 * Projecting an object type to a codec that reads the rich values is
 * `instanceCodec`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as SchemaIssue from "effect/SchemaIssue";
import * as SchemaTransformation from "effect/SchemaTransformation";
import * as Str from "effect/String";
import * as Tuple from "effect/Tuple";
import { ObjectRid, ObjectTypeApiName, PropertyApiName } from "../Identifier/Identifier.model.ts";
import {
  BooleanValue,
  DateValue,
  DoubleValue,
  IntegerValue,
  LongValue,
  ScalarValue,
  StringValue,
  TimestampValue,
} from "../Value/Value.model.ts";

const $I = $ScratchpadId.create("osdk/Object/Object.model");

// -----------------------------------------------------------------------------
// Primary key values
// -----------------------------------------------------------------------------

/**
 * The value that identifies one object within its type, as the wire carries it.
 *
 * **Details**
 *
 * The wire types a primary key as `any`. What travels is one JSON scalar: a
 * string, a finite number or a boolean. That is all a locator can say without
 * the object type in hand, so that is what this schema holds: it is the wire
 * operand `ScalarValue` under the name it has in a locator, `Type` and
 * `Encoded` are the same, and a locator round-trips exactly.
 *
 * A 64-bit integer, a calendar date and an instant are keys too, and they
 * travel as text. Where the key's type is known the rich value is one decode
 * away: the key property of an instance holds it (`instanceCodec`),
 * `operandCodec` of the key property's type reads a wire key as that value, and
 * {@link TypedPrimaryKeyValue} carries its own tag.
 *
 * **Example** (Hold a key as the scalar that travels)
 *
 * ```ts import.meta.vitest name="Hold a key as the scalar that travels"
 * import * as S from "effect/Schema"
 * import { PrimaryKeyValue } from "@beep/scratchpad/osdk/src/Object/index"
 *
 * const isKey = S.is(PrimaryKeyValue)
 * const long = "9007199254740993"
 * const verdicts = [isKey(50030), isKey("NYC"), isKey(long), isKey(BigInt(long)), isKey(null)]
 * verdicts // => [true, true, true, false, false]
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const PrimaryKeyValue = ScalarValue.pipe(
  $I.annoteSchema("PrimaryKeyValue", {
    description: "The value that identifies one object within its type: the JSON scalar the wire carries.",
  })
);

/**
 * Runtime type of {@link PrimaryKeyValue}.
 *
 * @category codecs
 * @since 0.0.0
 */
export type PrimaryKeyValue = typeof PrimaryKeyValue.Type;

const TypedPrimaryKeyKind = LiteralKit([
  "dateValue",
  "stringValue",
  "timestampValue",
  "booleanValue",
  "integerValue",
  "doubleValue",
  "longValue",
]);

/**
 * A primary key that is a calendar date.
 *
 * @category models
 * @since 0.0.0
 */
export class DateKeyValue extends S.Opaque<DateKeyValue, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("dateValue"),
    value: DateValue.annotateKey({ description: "The calendar date that is the key." }),
  }).pipe($I.annoteSchema("DateKeyValue", { description: "A primary key that is a calendar date." }))
) {}

/**
 * A primary key that is text.
 *
 * @category models
 * @since 0.0.0
 */
export class StringKeyValue extends S.Opaque<StringKeyValue, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("stringValue"),
    value: StringValue.annotateKey({ description: "The text that is the key." }),
  }).pipe($I.annoteSchema("StringKeyValue", { description: "A primary key that is text." }))
) {}

/**
 * A primary key that is an instant.
 *
 * @category models
 * @since 0.0.0
 */
export class TimestampKeyValue extends S.Opaque<TimestampKeyValue, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("timestampValue"),
    value: TimestampValue.annotateKey({ description: "The instant that is the key." }),
  }).pipe($I.annoteSchema("TimestampKeyValue", { description: "A primary key that is an instant." }))
) {}

/**
 * A primary key that is a boolean.
 *
 * @category models
 * @since 0.0.0
 */
export class BooleanKeyValue extends S.Opaque<BooleanKeyValue, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("booleanValue"),
    value: BooleanValue.annotateKey({ description: "The boolean that is the key." }),
  }).pipe($I.annoteSchema("BooleanKeyValue", { description: "A primary key that is a boolean." }))
) {}

/**
 * A primary key that is a signed 32-bit integer.
 *
 * @category models
 * @since 0.0.0
 */
export class IntegerKeyValue extends S.Opaque<IntegerKeyValue, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("integerValue"),
    value: IntegerValue.annotateKey({ description: "The 32-bit integer that is the key." }),
  }).pipe($I.annoteSchema("IntegerKeyValue", { description: "A primary key that is a signed 32-bit integer." }))
) {}

/**
 * A primary key that is a finite floating point number.
 *
 * @category models
 * @since 0.0.0
 */
export class DoubleKeyValue extends S.Opaque<DoubleKeyValue, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("doubleValue"),
    value: DoubleValue.annotateKey({ description: "The number that is the key." }),
  }).pipe($I.annoteSchema("DoubleKeyValue", { description: "A primary key that is a finite floating point number." }))
) {}

/**
 * A primary key that is a signed 64-bit integer, sent as a decimal string.
 *
 * @category models
 * @since 0.0.0
 */
export class LongKeyValue extends S.Opaque<LongKeyValue, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("longValue"),
    value: LongValue.annotateKey({ description: "The 64-bit integer that is the key." }),
  }).pipe(
    $I.annoteSchema("LongKeyValue", {
      description: "A primary key that is a signed 64-bit integer, sent as a decimal string.",
    })
  )
) {}

/**
 * A primary key value that says which scalar type it is, so it decodes to its rich value without an ontology.
 *
 * **Details**
 *
 * This is the wire's `PrimaryKeyValueV2`. Where {@link PrimaryKeyValue} holds
 * the bare JSON scalar, the `type` tag here picks the kernel value codec: a
 * `longValue` is a `bigint`, a `dateValue` a `LocalDate`, a `timestampValue` a
 * `DateTime.Utc`. The seven tags are also the wire's own statement of which
 * scalar types can be a key.
 *
 * **Example** (Decode a tagged long key to a bigint)
 *
 * ```ts import.meta.vitest name="Decode a tagged long key to a bigint"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { TypedPrimaryKeyValue } from "@beep/scratchpad/osdk/src/Object/index"
 *
 * const key = await Effect.runPromise(
 *   S.decodeEffect(TypedPrimaryKeyValue)({ type: "longValue", value: "58319870951433" })
 * )
 * const next = TypedPrimaryKeyValue.guards.longValue(key) ? (key.value + BigInt(1)).toString() : ""
 * next // => "58319870951434"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const TypedPrimaryKeyValue = TypedPrimaryKeyKind.mapMembers(() =>
  Tuple.make(
    DateKeyValue,
    StringKeyValue,
    TimestampKeyValue,
    BooleanKeyValue,
    IntegerKeyValue,
    DoubleKeyValue,
    LongKeyValue
  )
).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("TypedPrimaryKeyValue", {
    description:
      "A primary key value tagged with its scalar type, so it decodes to its rich value without an ontology.",
  })
);

/**
 * Runtime type of {@link TypedPrimaryKeyValue}.
 *
 * @category models
 * @since 0.0.0
 */
export type TypedPrimaryKeyValue = typeof TypedPrimaryKeyValue.Type;

// -----------------------------------------------------------------------------
// Which object
// -----------------------------------------------------------------------------

/**
 * Which object: its concrete object type and its primary key.
 *
 * **Details**
 *
 * OSDK has `ObjectSpecifier`, `ObjectIdentifiers` and `OsdkBase` for this one
 * idea, and the wire has four encodings of it. This record is the single
 * domain value. Its own encoded form, `{ objectType, primaryKey }`, is the one
 * action edits use; {@link ObjectSpecifier} and {@link InterfaceObjectLocator}
 * are the other standalone spellings, and {@link OntologyObject} reads it from
 * the reserved keys of an object.
 *
 * The object type is always the concrete one, also when the object was reached
 * through an interface.
 *
 * **Example** (Compare two locators by value)
 *
 * ```ts import.meta.vitest name="Compare two locators by value"
 * import * as S from "effect/Schema"
 * import { ObjectTypeApiName } from "@beep/scratchpad/osdk/src/Identifier/index"
 * import { ObjectLocator } from "@beep/scratchpad/osdk/src/Object/index"
 *
 * const employee = ObjectTypeApiName.make("Employee")
 * const same = S.toEquivalence(ObjectLocator)(
 *   ObjectLocator.make({ objectType: employee, primaryKey: 50030 }),
 *   ObjectLocator.make({ objectType: employee, primaryKey: 50030 })
 * )
 * same // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ObjectLocator extends S.Opaque<ObjectLocator, { readonly brand: unique symbol }>()(
  S.Struct({
    objectType: ObjectTypeApiName.annotateKey({ description: "The concrete object type the object belongs to." }),
    primaryKey: PrimaryKeyValue.annotateKey({ description: "The value that identifies the object within its type." }),
  }).pipe(
    $I.annoteSchema("ObjectLocator", { description: "Which object: its concrete object type and its primary key." })
  )
) {}

/**
 * Codec between the `"<objectType>:<primaryKey>"` string and an {@link ObjectLocator}.
 *
 * **Details**
 *
 * The string splits at the FIRST colon: an object type name never contains
 * one, a key may (`"Flight:AA100:2024-05-01"`). OSDK builds the same string but
 * reads it back with `split(":")[1]`, which truncates such keys.
 *
 * A string carries no JSON type, so the key always decodes to text. The laws
 * are `encode(decode(text)) = text` for every well-formed string, and an exact
 * round trip of the locator when its key is text. Encoding fails for an object
 * type name that contains a colon, because the result could not be split back.
 *
 * **Example** (Keep a key that contains colons)
 *
 * ```ts import.meta.vitest name="Keep a key that contains colons"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { ObjectSpecifier } from "@beep/scratchpad/osdk/src/Object/index"
 *
 * const locator = await Effect.runPromise(S.decodeEffect(ObjectSpecifier)("Flight:AA100:2024-05-01"))
 * const parts = [locator.objectType, locator.primaryKey]
 * parts // => ["Flight", "AA100:2024-05-01"]
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const ObjectSpecifier = S.String.pipe(
  S.decodeTo(
    ObjectLocator,
    SchemaTransformation.transformEffect<typeof ObjectLocator.Encoded, string>({
      decode: (text, options) =>
        pipe(
          Str.indexOf(":")(text),
          O.map((at) => ({ objectType: Str.slice(0, at)(text), primaryKey: Str.slice(at + 1)(text) })),
          Effect.fromOption(
            () =>
              new SchemaIssue.InvalidValue(
                { message: 'Expected an object specifier of the form "<objectType>:<primaryKey>"' },
                text,
                options
              )
          )
        ),
      encode: ({ objectType, primaryKey }, options) =>
        Str.includes(":")(objectType)
          ? Effect.fail(
              new SchemaIssue.InvalidValue(
                { message: "An object type name that contains a colon cannot be written as an object specifier" },
                objectType,
                options
              )
            )
          : Effect.succeed(`${objectType}:${primaryKey}`),
    })
  ),
  $I.annoteSchema("ObjectSpecifier", {
    description: "An object locator written as one string: the object type, a colon, the primary key.",
  })
);

/**
 * Runtime type of {@link ObjectSpecifier}: an {@link ObjectLocator}.
 *
 * @category codecs
 * @since 0.0.0
 */
export type ObjectSpecifier = typeof ObjectSpecifier.Type;

/**
 * Codec between the `{ objectTypeApiName, primaryKeyValue }` record and an {@link ObjectLocator}.
 *
 * **Details**
 *
 * The wire uses this record wherever the object type is not implied by the
 * position: an object passed to an interface-typed action or query parameter,
 * an interface-typed query result, the conflicting objects of a scenario. The
 * wire calls the record itself `ObjectLocator`; here that name belongs to the
 * domain value, and only the key names differ, so this codec decodes to it.
 *
 * **Example** (Read an interface object reference as a locator)
 *
 * ```ts import.meta.vitest name="Read an interface object reference as a locator"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { InterfaceObjectLocator, ObjectSpecifier } from "@beep/scratchpad/osdk/src/Object/index"
 *
 * const locator = await Effect.runPromise(
 *   S.decodeEffect(InterfaceObjectLocator)({ objectTypeApiName: "Employee", primaryKeyValue: "EMP1234" })
 * )
 * const specifier = await Effect.runPromise(S.encodeEffect(ObjectSpecifier)(locator))
 * specifier // => "Employee:EMP1234"
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const InterfaceObjectLocator = ObjectLocator.pipe(
  S.encodeKeys({ objectType: "objectTypeApiName", primaryKey: "primaryKeyValue" }),
  $I.annoteSchema("InterfaceObjectLocator", {
    description: "An object locator written as the record the wire uses where the object type is not implied.",
  })
);

/**
 * Runtime type of {@link InterfaceObjectLocator}: an {@link ObjectLocator}.
 *
 * @category codecs
 * @since 0.0.0
 */
export type InterfaceObjectLocator = typeof InterfaceObjectLocator.Type;

// -----------------------------------------------------------------------------
// Objects
// -----------------------------------------------------------------------------

// The keys the platform reserves in an object's flat record. Everything else is a property.
const ReservedKey = LiteralKit(["__apiName", "__primaryKey", "__rid", "__title", "__score"]);

const isReservedKey = S.is(ReservedKey);

/**
 * An object as it travels: one flat JSON record in which the reserved keys sit beside the property keys.
 *
 * **Details**
 *
 * This is the wire's `OntologyObjectV2` with nothing read into it. `__apiName`
 * and `__primaryKey` are always there; `__rid`, `__title` and `__score` are
 * there when the request asked for them, and the platform may send `null` in
 * their place; every other key is a property value as JSON. `Type` and
 * `Encoded` are the same, so the schema checks a record and changes nothing.
 *
 * It is the row of a page of objects. A transport hands such rows on as they
 * arrived, and the codec a read was given decodes each of them once:
 * {@link OntologyObject} when no ontology is in hand, the result of
 * `InstanceOf` when the object type is known. Both have this record as their
 * encoded side.
 *
 * **Gotchas**
 *
 * An index signature also applies to the reserved keys, so they are plain JSON
 * here: `__apiName` is text, not yet an object type name, and an empty one
 * passes. The codecs that read the record brand it.
 *
 * **Example** (Tell a row from a record that has no identity)
 *
 * ```ts import.meta.vitest name="Tell a row from a record that has no identity"
 * import * as S from "effect/Schema"
 * import { ObjectRecord } from "@beep/scratchpad/osdk/src/Object/index"
 *
 * const isRow = S.is(ObjectRecord)
 * const row = { __apiName: "Office", __primaryKey: "NYC", officeId: "NYC", capacity: 120 }
 * const verdicts = [isRow(row), isRow({ officeId: "NYC" }), isRow({ ...row, __title: 7 })]
 * verdicts // => [true, false, false]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ObjectRecord = S.StructWithRest(
  S.Struct({
    __apiName: S.String,
    __primaryKey: PrimaryKeyValue,
    __rid: S.String.pipe(S.NullOr, S.optionalKey),
    __title: S.String.pipe(S.NullOr, S.optionalKey),
    __score: S.Finite.pipe(S.NullOr, S.optionalKey),
  }),
  [S.Record(S.String, S.Json)]
).pipe(
  $I.annoteSchema("ObjectRecord", {
    description: "An object as it travels: one flat JSON record of reserved keys and property keys.",
  })
);

/**
 * Runtime type of {@link ObjectRecord}.
 *
 * @category models
 * @since 0.0.0
 */
export type ObjectRecord = typeof ObjectRecord.Type;

// The same facts with identity and properties apart. Its encoded side is what the transformation
// below produces from, and flattens back into, the wire record.
const ObjectParts = S.Struct({
  locator: ObjectLocator,
  rid: S.OptionFromOptionalNullOr(ObjectRid).pipe(
    S.withConstructorDefault(Effect.succeedNone),
    S.annotateKey({ description: "Resource identifier of the object, when the request asked for it." })
  ),
  title: S.OptionFromOptionalNullOr(S.String).pipe(
    S.withConstructorDefault(Effect.succeedNone),
    S.annotateKey({ description: "Display title of the object, when it has one." })
  ),
  score: S.OptionFromOptionalNullOr(S.Finite).pipe(
    S.withConstructorDefault(Effect.succeedNone),
    S.annotateKey({ description: "Relevance score, present only when results are ordered by relevance." })
  ),
  properties: S.Record(PropertyApiName, S.Json).annotateKey({
    description: "Every property the platform returned, as JSON, keyed by property name.",
  }),
});

/**
 * An object as the platform returns it when no ontology is in hand: its identity, and its properties as JSON.
 *
 * **Details**
 *
 * The wire sends ONE flat record in which the reserved keys `__apiName`,
 * `__primaryKey`, `__rid`, `__title` and `__score` sit beside the property
 * keys. OSDK renames them to `$`-prefixed keys of the same record. Here the
 * record is split: `locator` says which object, `rid`, `title` and `score` are
 * present only when the request asked for them (or, for the title, when the
 * object has one), and `properties` holds every other key untouched.
 *
 * An absent or `null` reserved key decodes to `None` and is omitted again when
 * encoding. The primary key property stays in `properties` as the platform
 * sent it, beside the copy in `locator`. Link responses send objects that
 * carry the two identity keys and nothing else; they decode to an object with
 * no properties.
 *
 * **Gotchas**
 *
 * Encoding fails when a property is named like a reserved key: the flat record
 * could not hold both.
 *
 * **Example** (Split a flat object into identity and properties)
 *
 * ```ts import.meta.vitest name="Split a flat object into identity and properties"
 * import * as A from "effect/Array"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as R from "effect/Record"
 * import * as S from "effect/Schema"
 * import { OntologyObject } from "@beep/scratchpad/osdk/src/Object/index"
 *
 * const office = await Effect.runPromise(
 *   S.decodeEffect(OntologyObject)({
 *     __apiName: "Office",
 *     __primaryKey: "NYC",
 *     __title: "New York City",
 *     officeId: "NYC",
 *     name: "New York City",
 *   })
 * )
 * const summary = [
 *   office.locator.primaryKey,
 *   O.getOrElse(office.title, () => ""),
 *   O.isNone(office.rid),
 *   A.join(R.keys(office.properties), ","),
 * ]
 * summary // => ["NYC", "New York City", true, "officeId,name"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OntologyObject extends S.Opaque<OntologyObject, { readonly brand: unique symbol }>()(
  ObjectRecord.pipe(
    S.decodeTo(
      ObjectParts,
      SchemaTransformation.transformEffect<typeof ObjectParts.Encoded, ObjectRecord>({
        decode: ({ __apiName, __primaryKey, __rid, __title, __score, ...properties }) =>
          Effect.succeed({
            locator: { objectType: __apiName, primaryKey: __primaryKey },
            rid: __rid,
            title: __title,
            score: __score,
            properties,
          }),
        encode: ({ locator, rid, title, score, properties }, options) =>
          A.match(A.filter(R.keys(properties), isReservedKey), {
            onEmpty: () =>
              Effect.succeed({
                ...properties,
                ...R.filter({ __rid: rid, __title: title, __score: score }, P.isNotNullish),
                __apiName: locator.objectType,
                __primaryKey: locator.primaryKey,
              }),
            onNonEmpty: (reserved) =>
              Effect.fail(
                new SchemaIssue.InvalidValue(
                  { message: `Property names collide with reserved object keys: ${A.join(reserved, ", ")}` },
                  properties,
                  options
                )
              ),
          }),
      })
    ),
    $I.annoteSchema("OntologyObject", {
      description: "An object as the platform returns it: its identity, and its properties as JSON.",
    })
  )
) {}
