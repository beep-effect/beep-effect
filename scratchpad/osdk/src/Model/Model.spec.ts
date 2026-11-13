/**
 * Typed property specs: the static twin of the property type union.
 *
 * **Details**
 *
 * `valueCodec` turns a property type known only at runtime into a codec whose
 * static type is necessarily `unknown`. A spec is the same pairing made at
 * authoring time, so the compiler sees it: each leaf constant is its tag and
 * the row `Property.leafCodec` holds under that tag, read by key, so the spec
 * and the runtime projection cannot name two codecs for one tag. A record of
 * specs therefore becomes a precisely typed struct schema with one
 * heterogeneous map and no conditional types. This is what replaces OSDK's
 * property-definition generics, its six value-mapping tables and its
 * `Osdk.Instance` type algebra.
 *
 * Every spec of the typed layer is a {@link ValueSpec}: a tag, a value codec
 * and a {@link SpecShape} that says what the codec was built from. A
 * {@link PropertySpec} adds how the value stands as a key of an object, an
 * {@link ExchangeSpec} how it stands as a field of a struct an action or a
 * query exchanges, and a parameter spec (in `Model.action.ts`) whether a
 * request must supply it. {@link typeOf} reads a property spec back as the
 * `PropertyType` it denotes.
 *
 * Specs are deliberately rid-free. They describe what code relies on (names,
 * tags, codecs); a conformance policy checks them against the ontology the
 * server actually serves.
 *
 * A spec is optional unless it is marked {@link required}, and the only place
 * a required spec is accepted is the primary key of an object model. The
 * platform guarantees a value for the key and for nothing else, so a spec that
 * claimed more would narrow `Option<Value>` to `Value` with nothing to check
 * it. `Model.object` and {@link struct} therefore reject one at compile time.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import * as A from "effect/Array";
import { pipe } from "effect/Function";
import * as Match from "effect/Match";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Struct from "effect/Struct";
import { SensorSeriesItem, TimeseriesType, VectorType } from "../DataType/DataType.model.ts";
import {
  InterfaceTypeApiName,
  ObjectTypeApiName,
  StructFieldApiName,
  StructFieldTypeRid,
} from "../Identifier/Identifier.model.ts";
import { leafCodec } from "../Property/Property.behavior.ts";
import { ArrayType, PropertyType, StructFieldType, StructType } from "../Property/Property.model.ts";
import { VectorOf } from "../Value/Value.model.ts";
import type * as O from "effect/Option";
import type { DataTypeKind, PropertyTypeKind, SharedValueKind } from "../DataType/DataType.values.ts";
import type { PropertyCodec } from "../Object/Object.behavior.ts";

const $I = $ScratchpadId.create("osdk/Model/Model.spec");

// -----------------------------------------------------------------------------
// One spec representation
// -----------------------------------------------------------------------------

/**
 * Name of the object type or interface a reference ranges over.
 *
 * **Example** (Accept the name of an object type or of an interface)
 *
 * ```ts import.meta.vitest name="Accept the name of an object type or of an interface"
 * import * as S from "effect/Schema"
 * import * as Model from "@beep/scratchpad/osdk/src/Model/index"
 *
 * const accepts = S.is(Model.ReferenceTarget)
 * const verdicts = [accepts("Employee"), accepts("")]
 * verdicts // => [true, false]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ReferenceTarget = S.Union([ObjectTypeApiName, InterfaceTypeApiName]).pipe(
  $I.annoteSchema("ReferenceTarget", {
    description: "API name of the object type or interface a reference ranges over.",
  })
);

/**
 * Runtime type of {@link ReferenceTarget}.
 *
 * @category models
 * @since 0.0.0
 */
export type ReferenceTarget = typeof ReferenceTarget.Type;

/**
 * What a spec is made of, besides its tag and codec: the specs it nests and what it refers to.
 *
 * **Details**
 *
 * A spec is compared with a served type without running its codec, so what
 * the codec was built from is kept beside it as data, under one tag per way of
 * building: nothing for a leaf, the dimension of a vector, the element of an
 * array, list or set, the fields of a struct, the key and value of a map, the
 * value a nullable wraps, the alternatives of a union and the target of a
 * reference. A property spec has one of the first four; the specs of actions
 * and queries use all eight.
 *
 * @category models
 * @since 0.0.0
 */
export type SpecShape =
  | { readonly type: "leaf" }
  | { readonly type: "vector"; readonly dimension: number }
  | { readonly type: "list"; readonly element: ValueSpec }
  | { readonly type: "struct"; readonly fields: Readonly<Record<string, ValueSpec>> }
  | { readonly type: "entries"; readonly key: ValueSpec; readonly value: ValueSpec }
  | { readonly type: "nullable"; readonly inner: ValueSpec }
  | { readonly type: "union"; readonly alternatives: ReadonlyArray<ValueSpec> }
  | { readonly type: "reference"; readonly target: O.Option<ReferenceTarget> };

/**
 * A type tag paired, at authoring time, with the codec of its values and with what that codec was built from.
 *
 * **Details**
 *
 * This is the one representation every spec of the typed layer refines.
 * `value` is the codec of one present value wherever it stands alone. `shape`
 * is its structure as data. A {@link PropertySpec} adds how the value stands
 * as a key of an object, an {@link ExchangeSpec} how it stands as a field of a
 * struct an action or a query exchanges, and a `ParameterSpec` whether a
 * request must supply it.
 *
 * @typeParam Kind - The type tag, kept as a literal.
 * @typeParam Value - The codec of one present value.
 * @category models
 * @since 0.0.0
 */
export interface ValueSpec<Kind extends DataTypeKind = DataTypeKind, Value extends S.Top = S.Top> {
  readonly kind: Kind;
  readonly value: Value;
  readonly shape: SpecShape;
}

/**
 * A value spec an action or a query can exchange: an argument, a result, an element or a field of a struct.
 *
 * **Details**
 *
 * `member` is the codec of the value as a field of a struct. It is `value`
 * itself except for a nullable value, which may also be left out of a struct
 * that is read. Having it is what admits a spec to the constructors of typed
 * actions and queries. The specs built in `Model.action.ts` and
 * `Model.query.ts` have it, and so do the property specs whose values every
 * universe reads alike (the leaf constants of the shared tags, and
 * {@link vector}). A property spec an argument would read differently does
 * not: `Model.attachment` reads a reference record where an argument is the
 * bare identifier, and {@link array} and {@link struct} hold their parts the
 * way an object does.
 *
 * @typeParam Kind - The type tag, kept as a literal.
 * @typeParam Value - The codec of one value.
 * @typeParam Member - The codec of the value as a field of a struct.
 * @category models
 * @since 0.0.0
 */
export interface ExchangeSpec<
  Kind extends DataTypeKind = DataTypeKind,
  Value extends S.Top = S.Top,
  Member extends S.Top = S.Top,
> extends ValueSpec<Kind, Value> {
  readonly member: Member;
}

// The tags of a property type that holds no other type: the keys of the property's leaf table.
type LeafKind = keyof typeof leafCodec;

// The shape a property spec of each tag has. Tag and shape are in step by type, so a spec that is
// tagged a vector and states no dimension cannot be written.
type PropertyShapes = Readonly<Record<LeafKind, { readonly type: "leaf" }>> & {
  readonly vector: { readonly type: "vector"; readonly dimension: number };
  readonly array: { readonly type: "list"; readonly element: AnyPropertySpec };
  readonly struct: { readonly type: "struct"; readonly fields: Readonly<Record<string, AnyPropertySpec>> };
};

/**
 * A property type paired, at authoring time, with the codecs it precipitates.
 *
 * **Details**
 *
 * It is a {@link ValueSpec} declared as a property. `field` is the codec of
 * the property as a key of an object record: absent-or-null on the wire and an
 * `Option` in the domain by default, or `value` itself once the spec is marked
 * {@link required}, which only a primary key may be; `presence` says which, as
 * data and in the type. `shape` is typed by the tag: a leaf has none, a vector
 * states its dimension, an array holds the spec of its elements and a struct
 * the specs of its fields. So a spec can be compared structurally with a
 * served property type without running its codecs, and {@link typeOf} is
 * total.
 *
 * Both codecs are bounded by `PropertyCodec` of the `Object` concept: a
 * property value is read and written with no service. That is what lets the
 * one instance codec (`InstanceOf`) take the struct these specs precipitate.
 *
 * @typeParam Kind - The property type tag, kept as a literal so operators can be restricted by tag.
 * @typeParam Value - The codec of one present value; it needs no service.
 * @typeParam Field - The codec of the property as a record key; it needs no service.
 * @typeParam Presence - Whether the property may be absent.
 * @category models
 * @since 0.0.0
 */
export interface PropertySpec<
  Kind extends PropertyTypeKind = PropertyTypeKind,
  Value extends PropertyCodec = PropertyCodec,
  Field extends PropertyCodec = PropertyCodec,
  Presence extends "optional" | "required" = "optional" | "required",
> extends ValueSpec<Kind, Value> {
  readonly presence: Presence;
  readonly field: Field;
  readonly shape: PropertyShapes[Kind];
}

/**
 * A property spec of whichever tag, with its tag and its shape in step.
 *
 * **Details**
 *
 * `PropertySpec<Kind>` is the spec of one tag. This is their union over every
 * tag: what an array holds as its element, what a struct holds under each
 * field, and what {@link typeOf} and `Model.conformance` read. Every spec the
 * constructors of this module build is one of its members.
 *
 * @typeParam Presence - Whether the property may be absent.
 * @category models
 * @since 0.0.0
 */
export type AnyPropertySpec<Presence extends "optional" | "required" = "optional" | "required"> = {
  readonly [Kind in PropertyTypeKind]: PropertySpec<Kind, PropertyCodec, PropertyCodec, Presence>;
}[PropertyTypeKind];

const property = <const Kind extends PropertyTypeKind, Value extends PropertyCodec>(
  kind: Kind,
  value: Value,
  shape: PropertyShapes[Kind]
): PropertySpec<Kind, Value, S.OptionFromOptionalNullOr<Value>, "optional"> => ({
  kind,
  presence: "optional",
  value,
  field: S.OptionFromOptionalNullOr(value),
  shape,
});

// A property spec whose values an action or a query reads with the very same codec is also a value
// they exchange.
const exchanged = <Kind extends PropertyTypeKind, Value extends PropertyCodec, Field extends PropertyCodec>(
  spec: PropertySpec<Kind, Value, Field, "optional">
): PropertySpec<Kind, Value, Field, "optional"> & ExchangeSpec<Kind, Value, Value> => ({
  ...spec,
  member: spec.value,
});

const leafShape: PropertyShapes[LeafKind] = { type: "leaf" };

// A leaf spec is its tag and the row of the property's leaf table under that tag.
const leaf = <const Kind extends LeafKind>(kind: Kind) => property(kind, leafCodec[kind], leafShape);

// The row of a shared tag is the row every universe reads (`sharedCodec` of `Value`), so its spec is
// also a value an action or a query exchanges. A tag outside the shared table does not compile here.
const sharedLeaf = <const Kind extends LeafKind & SharedValueKind>(kind: Kind) => exchanged(leaf(kind));

/**
 * Spec of a `boolean` property.
 *
 * **Example** (Decode a boolean value)
 *
 * ```ts import.meta.vitest name="Decode a boolean value"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import * as Model from "@beep/scratchpad/osdk/src/Model/index"
 *
 * const flag = await Effect.runPromise(S.decodeUnknownEffect(Model.boolean.value)(true))
 * flag // => true
 * ```
 * @category constructors
 * @since 0.0.0
 */
export const boolean = sharedLeaf("boolean");

/**
 * Spec of a `byte` property.
 *
 * **Example** (Decode a byte and refuse a number out of its range)
 *
 * ```ts import.meta.vitest name="Decode a byte and refuse a number out of its range"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import * as Model from "@beep/scratchpad/osdk/src/Model/index"
 *
 * const tiny = await Effect.runPromise(S.decodeUnknownEffect(Model.byte.value)(31))
 * const facts = [tiny, S.is(Model.byte.value)(300)]
 * facts // => [31, false]
 * ```
 * @category constructors
 * @since 0.0.0
 */
export const byte = sharedLeaf("byte");

/**
 * Spec of a `short` property.
 *
 * **Example** (Decode a short value)
 *
 * ```ts import.meta.vitest name="Decode a short value"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import * as Model from "@beep/scratchpad/osdk/src/Model/index"
 *
 * const year = await Effect.runPromise(S.decodeUnknownEffect(Model.short.value)(8739))
 * const facts = [Model.short.kind, year]
 * facts // => ["short", 8739]
 * ```
 * @category constructors
 * @since 0.0.0
 */
export const short = sharedLeaf("short");

/**
 * Spec of an `integer` property.
 *
 * **Example** (Decode an integer the platform sent as text)
 *
 * ```ts import.meta.vitest name="Decode an integer the platform sent as text"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import * as Model from "@beep/scratchpad/osdk/src/Model/index"
 *
 * const count = await Effect.runPromise(S.decodeUnknownEffect(Model.integer.value)("238940"))
 * count // => 238940
 * ```
 * @category constructors
 * @since 0.0.0
 */
export const integer = sharedLeaf("integer");

/**
 * Spec of a `long` property, whose values are `bigint`.
 *
 * **Example** (Decode a long past the safe integer range)
 *
 * ```ts import.meta.vitest name="Decode a long past the safe integer range"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import * as Model from "@beep/scratchpad/osdk/src/Model/index"
 *
 * const badge = await Effect.runPromise(S.decodeUnknownEffect(Model.long.value)("9007199254740993"))
 * badge // => BigInt("9007199254740993")
 * ```
 * @category constructors
 * @since 0.0.0
 */
export const long = sharedLeaf("long");

/**
 * Spec of a `float` property.
 *
 * **Example** (Decode a float value)
 *
 * ```ts import.meta.vitest name="Decode a float value"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import * as Model from "@beep/scratchpad/osdk/src/Model/index"
 *
 * const ratio = await Effect.runPromise(S.decodeUnknownEffect(Model.float.value)(1.5))
 * const facts = [Model.float.kind, ratio]
 * facts // => ["float", 1.5]
 * ```
 * @category constructors
 * @since 0.0.0
 */
export const float = sharedLeaf("float");

/**
 * Spec of a `double` property.
 *
 * **Example** (Decode a double value)
 *
 * ```ts import.meta.vitest name="Decode a double value"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import * as Model from "@beep/scratchpad/osdk/src/Model/index"
 *
 * const measure = await Effect.runPromise(S.decodeUnknownEffect(Model.double.value)(3.14159265))
 * const facts = [Model.double.kind, measure]
 * facts // => ["double", 3.14159265]
 * ```
 * @category constructors
 * @since 0.0.0
 */
export const double = sharedLeaf("double");

/**
 * Spec of a `decimal` property, whose values are `BigDecimal`.
 *
 * **Example** (Decode a decimal with its scale)
 *
 * ```ts import.meta.vitest name="Decode a decimal with its scale"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import * as Model from "@beep/scratchpad/osdk/src/Model/index"
 *
 * const amount = await Effect.runPromise(S.decodeUnknownEffect(Model.decimal.value)("12.50"))
 * const parts = [amount.value, amount.scale]
 * parts // => [BigInt(1250), 2]
 * ```
 * @category constructors
 * @since 0.0.0
 */
export const decimal = sharedLeaf("decimal");

/**
 * Spec of a `string` property.
 *
 * **Example** (Read the codec types a spec carries)
 *
 * ```ts import.meta.vitest name="Read the codec types a spec carries"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import * as Model from "@beep/scratchpad/osdk/src/Model/index"
 *
 * const Row = S.Struct({ title: Model.string.field, id: Model.required(Model.integer).field })
 * const row = await Effect.runPromise(S.decodeUnknownEffect(Row)({ id: 7 }))
 * const summary = [row.id, O.isNone(row.title)]
 * summary // => [7, true]
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const string = sharedLeaf("string");

/**
 * Spec of a `date` property, whose values are calendar dates.
 *
 * **Example** (Decode a calendar date)
 *
 * ```ts import.meta.vitest name="Decode a calendar date"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import * as Model from "@beep/scratchpad/osdk/src/Model/index"
 *
 * const day = await Effect.runPromise(S.decodeUnknownEffect(Model.date.value)("2021-05-01"))
 * const parts = [day.year, day.month, day.day]
 * parts // => [2021, 5, 1]
 * ```
 * @category constructors
 * @since 0.0.0
 */
export const date = sharedLeaf("date");

/**
 * Spec of a `timestamp` property, whose values are UTC instants.
 *
 * **Example** (Decode an instant)
 *
 * ```ts import.meta.vitest name="Decode an instant"
 * import * as DateTime from "effect/DateTime"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import * as Model from "@beep/scratchpad/osdk/src/Model/index"
 *
 * const moment = await Effect.runPromise(S.decodeUnknownEffect(Model.timestamp.value)("2021-01-04T05:00:00Z"))
 * DateTime.toEpochMillis(moment) // => 1609736400000
 * ```
 * @category constructors
 * @since 0.0.0
 */
export const timestamp = sharedLeaf("timestamp");

/**
 * Spec of a `marking` property.
 *
 * **Example** (Decode a marking identifier)
 *
 * ```ts import.meta.vitest name="Decode a marking identifier"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import * as Model from "@beep/scratchpad/osdk/src/Model/index"
 *
 * const clearance = await Effect.runPromise(
 *   S.decodeUnknownEffect(Model.marking.value)("8f6a6b3c-1c2d-4e5f-9a0b-1c2d3e4f5a6b")
 * )
 * const facts = [Model.marking.kind, `${clearance}`]
 * facts // => ["marking", "8f6a6b3c-1c2d-4e5f-9a0b-1c2d3e4f5a6b"]
 * ```
 * @category constructors
 * @since 0.0.0
 */
export const marking = sharedLeaf("marking");

/**
 * Spec of a `cipherText` property.
 *
 * **Example** (Decode cipher text into its parts)
 *
 * ```ts import.meta.vitest name="Decode cipher text into its parts"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import * as Model from "@beep/scratchpad/osdk/src/Model/index"
 *
 * const channel = "ri.bellaso.main.cipher-channel.6d2ae41e-2d55-4b4b-a5dc-b3d22a8b0f2a"
 * const secret = await Effect.runPromise(
 *   S.decodeUnknownEffect(Model.cipherText.value)(`CIPHER::${channel}::AAAAkdB7::CIPHER`)
 * )
 * secret.ciphertext // => "AAAAkdB7"
 * ```
 * @category constructors
 * @since 0.0.0
 */
export const cipherText = sharedLeaf("cipherText");

/**
 * Spec of an `attachment` property.
 *
 * **Example** (Decode an attachment reference)
 *
 * ```ts import.meta.vitest name="Decode an attachment reference"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import * as Model from "@beep/scratchpad/osdk/src/Model/index"
 *
 * const file = await Effect.runPromise(
 *   S.decodeUnknownEffect(Model.attachment.value)({
 *     rid: "ri.blobster.main.attachment.bb32154e-e043-4b00-9461-93136ca96b6f",
 *   })
 * )
 * const facts = [Model.attachment.kind, `${file.rid}`]
 * facts // => ["attachment", "ri.blobster.main.attachment.bb32154e-e043-4b00-9461-93136ca96b6f"]
 * ```
 * @category constructors
 * @since 0.0.0
 */
export const attachment = leaf("attachment");

/**
 * Spec of a `mediaReference` property.
 *
 * **Example** (Decode a media reference)
 *
 * ```ts import.meta.vitest name="Decode a media reference"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import * as Model from "@beep/scratchpad/osdk/src/Model/index"
 *
 * const picture = await Effect.runPromise(
 *   S.decodeUnknownEffect(Model.mediaReference.value)({
 *     mimeType: "application/pdf",
 *     reference: {
 *       type: "mediaSetViewItem",
 *       mediaSetViewItem: {
 *         mediaSetRid: "ri.mio.main.media-set.4153d42f-ca4b-4e42-8ca5-8e6aa7edb642",
 *         mediaSetViewRid: "ri.mio.main.view.82a798ad-d637-4595-acc6-987bcf16629b",
 *         mediaItemRid: "ri.mio.main.media-item.001ec98b-1620-4814-9e17-8e9c4e536225",
 *       },
 *     },
 *   })
 * )
 * const facts = [picture.reference.type, `${picture.mimeType}`]
 * facts // => ["mediaSetViewItem", "application/pdf"]
 * ```
 * @category constructors
 * @since 0.0.0
 */
export const mediaReference = sharedLeaf("mediaReference");

/**
 * Spec of a `geopoint` property.
 *
 * **Example** (Decode a GeoJSON point)
 *
 * ```ts import.meta.vitest name="Decode a GeoJSON point"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import * as Model from "@beep/scratchpad/osdk/src/Model/index"
 *
 * const place = await Effect.runPromise(
 *   S.decodeUnknownEffect(Model.geopoint.value)({ type: "Point", coordinates: [102.0, 0.5] })
 * )
 * place.coordinates // => [102.0, 0.5]
 * ```
 * @category constructors
 * @since 0.0.0
 */
export const geopoint = leaf("geopoint");

/**
 * Spec of a `geoshape` property, whose values are any GeoJSON object.
 *
 * **Example** (Decode a GeoJSON line)
 *
 * ```ts import.meta.vitest name="Decode a GeoJSON line"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import * as Model from "@beep/scratchpad/osdk/src/Model/index"
 *
 * const outline = await Effect.runPromise(
 *   S.decodeUnknownEffect(Model.geoshape.value)({
 *     type: "LineString",
 *     coordinates: [
 *       [102.0, 0.0],
 *       [103.0, 1.0],
 *     ],
 *   })
 * )
 * outline.type // => "LineString"
 * ```
 * @category constructors
 * @since 0.0.0
 */
export const geoshape = sharedLeaf("geoshape");

/**
 * Spec of a `geotimeSeriesReference` property.
 *
 * **Example** (Decode a geotime series reference into its tagged form)
 *
 * ```ts import.meta.vitest name="Decode a geotime series reference into its tagged form"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import * as Model from "@beep/scratchpad/osdk/src/Model/index"
 *
 * const track = await Effect.runPromise(
 *   S.decodeUnknownEffect(Model.geotimeSeriesReference.value)({
 *     geotimeSeriesId: "employee-50030",
 *     geotimeSeriesIntegrationRid: "ri.geotime-catalog.main.integration.401ac022-89eb-4591-8b7e-0a912b9efb44",
 *   })
 * )
 * track.type // => "integratedSeries"
 * ```
 * @category constructors
 * @since 0.0.0
 */
export const geotimeSeriesReference = leaf("geotimeSeriesReference");

/**
 * Spec of a `timeseries` property, whose value is a reference to the series.
 *
 * **Example** (Decode a time series reference into its tagged form)
 *
 * ```ts import.meta.vitest name="Decode a time series reference into its tagged form"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import * as Model from "@beep/scratchpad/osdk/src/Model/index"
 *
 * const pressure = await Effect.runPromise(
 *   S.decodeUnknownEffect(Model.timeseries.value)({
 *     seriesId: "wellPressureSeriesId",
 *     syncRid: "ri.time-series-catalog.main.sync.401ac022-89eb-4591-8b7e-0a912b9efb44",
 *   })
 * )
 * pressure.type // => "qualifiedSeries"
 * ```
 * @category constructors
 * @since 0.0.0
 */
export const timeseries = leaf("timeseries");

/**
 * Spec of a `vector` property with exactly `dimension` components.
 *
 * **Details**
 *
 * The dimension is enforced by the value codec (`VectorOf` of `Value`, the
 * rule every universe reads a vector by) and also kept in the spec's shape as
 * data, so a model can be compared with the dimension a server stores. An
 * action reads a vector by the same rule, so the spec is also a value an
 * action exchanges.
 *
 * **Example** (Read the dimension of a vector spec)
 *
 * ```ts import.meta.vitest name="Read the dimension of a vector spec"
 * import * as S from "effect/Schema"
 * import * as Model from "@beep/scratchpad/osdk/src/Model/index"
 *
 * const embedding = Model.vector(3)
 * const accepts = S.is(embedding.value)
 * const facts = [embedding.shape.dimension, accepts([1, 2, 3]), accepts([1, 2])]
 * facts // => [3, true, false]
 * ```
 *
 * @param dimension - Number of components every vector has.
 * @throws When `dimension` is not a positive integer, which no vector type has.
 * @category constructors
 * @since 0.0.0
 */
export const vector = (dimension: number) => {
  // The metamodel is asked what a dimension is, so a spec cannot state one no vector type could.
  const declared = VectorType.make({ dimension }).dimension;
  return exchanged(property("vector", VectorOf(declared), { type: "vector", dimension: declared }));
};

/**
 * Spec of an `array` property whose elements follow `element`.
 *
 * **Example** (Nest an array spec)
 *
 * ```ts import.meta.vitest name="Nest an array spec"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import * as Model from "@beep/scratchpad/osdk/src/Model/index"
 *
 * const tags = Model.array(Model.string)
 * const decoded = await Effect.runPromise(S.decodeUnknownEffect(tags.value)(["alpha", "bravo"]))
 * const summary = [tags.kind, decoded.length, tags.shape.element === Model.string]
 * summary // => ["array", 2, true]
 * ```
 *
 * @param element - Spec of every element.
 * @category constructors
 * @since 0.0.0
 */
export const array = <Element extends AnyPropertySpec>(element: Element) =>
  property("array", S.Array<Element["value"]>(element.value), { type: "list", element });

interface FieldOf extends Struct.Lambda {
  <Kind extends PropertyTypeKind, Value extends PropertyCodec, Field extends PropertyCodec>(
    spec: PropertySpec<Kind, Value, Field>
  ): Field;
  readonly "~lambda.out": this["~lambda.in"] extends PropertySpec<PropertyTypeKind, PropertyCodec, infer Field>
    ? Field
    : never;
}

/**
 * Maps a record of specs to the record of their field codecs, key by key.
 *
 * **Details**
 *
 * This is the whole type-level mechanism of the typed layer: a heterogeneous
 * map from `effect/Struct`. Passing its result to `S.Struct` yields a struct
 * schema whose `Type` and `Encoded` are exact for every key.
 *
 * **Example** (Build a struct schema from a record of specs)
 *
 * ```ts import.meta.vitest name="Build a struct schema from a record of specs"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import * as Model from "@beep/scratchpad/osdk/src/Model/index"
 *
 * const specs = { sku: Model.required(Model.string), stock: Model.integer, weight: Model.double }
 * const Row = S.Struct(Model.fieldsOf(specs))
 * const row = await Effect.runPromise(S.decodeUnknownEffect(Row)({ sku: "PQ-7", stock: 12 }))
 * const summary = [row.sku, O.getOrElse(row.stock, () => 0), O.isNone(row.weight)]
 * summary // => ["PQ-7", 12, true]
 * ```
 *
 * @param specs - The specs to project, keyed by the name each field gets.
 * @category projections
 * @since 0.0.0
 */
export const fieldsOf: <const Specs extends Readonly<Record<string, PropertySpec>>>(
  specs: Specs
) => { [K in keyof Specs]: Struct.Apply<FieldOf, Specs[K]> } = Struct.map(Struct.lambda<FieldOf>((spec) => spec.field));

// A struct schema with no fields accepts any non-null value. The check keeps a field-less struct
// spec honest: its value is still a record, never text, a number or an array.
const StructIsRecord = S.makeFilter(
  P.isObject,
  $I.annote("StructIsRecordCheck", {
    title: "Struct is a record",
    description: "A struct value is a record of named fields.",
    message: "Expected a record of named fields",
  })
);

/**
 * Spec of a `struct` property with the given named field specs.
 *
 * **Details**
 *
 * Every field spec must be optional. The platform does not promise that a
 * struct value has any of its fields, so a field marked {@link required} is a
 * compile error: it would type a field as always present with nothing to check
 * the claim, and one sparse struct would then fail the whole object.
 *
 * **Gotchas**
 *
 * A field needs a name. The empty name is refused here, where the spec is
 * written, as `StructFieldApiName` refuses it in a served struct type, so
 * every struct spec denotes a struct type and `typeOf` has no spec to refuse.
 *
 * **Example** (Decode a struct value with an absent field)
 *
 * ```ts import.meta.vitest name="Decode a struct value with an absent field"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import * as Model from "@beep/scratchpad/osdk/src/Model/index"
 *
 * const address = Model.struct({ city: Model.string, postcode: Model.string })
 * const decoded = await Effect.runPromise(S.decodeUnknownEffect(address.value)({ city: "Lyon" }))
 * const summary = [O.getOrElse(decoded.city, () => ""), O.isNone(decoded.postcode)]
 * summary // => ["Lyon", true]
 * ```
 *
 * @param fields - Spec of each field, keyed by the field's API name.
 * @throws When a field is declared under the empty name, which no struct type has.
 * @category constructors
 * @since 0.0.0
 */
export const struct = <const Specs extends Readonly<Record<string, AnyPropertySpec<"optional">>>>(fields: Specs) => {
  // The metamodel is asked what a field name is, so a spec cannot name a field no struct type could.
  A.forEach(R.keys(fields), (name) => StructFieldApiName.make(name));
  return property("struct", S.Struct(fieldsOf(fields)).check(StructIsRecord), { type: "struct", fields });
};

/**
 * Marks the primary key's spec as always present: its field codec becomes its value codec.
 *
 * **Details**
 *
 * It exists for the primary key and is accepted nowhere else. The key is the
 * one value the platform guarantees: an object cannot exist without it. Every
 * other property can read as absent, even one the ontology marks not-nullable
 * (an object missing from the datasource mapping still omits it), and so can
 * every field of a struct. Narrowing one of those from `Option<Value>` to
 * `Value` would be a claim nothing checks: not the wire, and not the
 * conformance policy, which compares names, tags and links but never presence.
 * So the narrowing is not available: `Model.object` takes a required spec for
 * its `primaryKey` and only optional specs for every other property,
 * `Model.struct` takes only optional specs, and both say so in their types.
 *
 * **Example** (Mark the primary key and nothing else)
 *
 * ```ts import.meta.vitest name="Mark the primary key and nothing else"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import * as Model from "@beep/scratchpad/osdk/src/Model/index"
 *
 * const Office = Model.object({
 *   apiName: "Office",
 *   primaryKey: "officeId",
 *   properties: { officeId: Model.required(Model.string), capacity: Model.integer },
 *   links: {},
 * })
 * const office = await Effect.runPromise(
 *   S.decodeEffect(Office.Instance)({ __apiName: "Office", __primaryKey: "LYS", officeId: "LYS" })
 * )
 * const { officeId, capacity } = office.properties
 * const facts = [Office.properties.officeId.presence, officeId, O.isNone(capacity)]
 * facts // => ["required", "LYS", true]
 * ```
 *
 * @param spec - The spec of the primary key.
 * @category combinators
 * @since 0.0.0
 */
export const required = <Kind extends PropertyTypeKind, Value extends PropertyCodec, Field extends PropertyCodec>(
  spec: PropertySpec<Kind, Value, Field>
): PropertySpec<Kind, Value, Value, "required"> => ({
  kind: spec.kind,
  presence: "required",
  value: spec.value,
  field: spec.value,
  shape: spec.shape,
});

/**
 * The property type a spec denotes: a projection to the metamodel, total over the specs the constructors build.
 *
 * **Details**
 *
 * A spec is a property type written at authoring time, and this reads it back
 * as data: a leaf is the member of `PropertyType` with the spec's tag, a
 * vector states its dimension, an array's element type is the type of its
 * element spec, and a struct has one field per field spec, in the order they
 * were written. So `Property.valueCodec(Model.typeOf(spec))` reads the same
 * values as `spec.value`, and `Model.conformance` is a comparison of two
 * property types.
 *
 * **Gotchas**
 *
 * A spec states less than a served type does. It is rid-free and does not
 * say what the points of a time series hold. The projection fills in the
 * least it can: the `rid` of a struct field is the field's own name, and a
 * time series holds `numericOrNonNumeric` points, the item type that claims
 * neither kind. Nothing else a served type may carry (a marking subtype, a
 * cipher channel, a decimal's precision, an embedding model) is stated.
 * Compare the result by structure, as `Model.conformance` does, and not for
 * equality with a served type.
 *
 * Total means over what `Model.vector`, `Model.struct` and the other
 * constructors return: each refuses, where the spec is written, what no
 * property type could state (a dimension that is not a positive integer, a
 * field with the empty name). A spec object written by hand with such a
 * shape is refused here instead, as the metamodel refuses it.
 *
 * **Example** (Read a nested spec back as a property type)
 *
 * ```ts import.meta.vitest name="Read a nested spec back as a property type"
 * import * as A from "effect/Array"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import * as Model from "@beep/scratchpad/osdk/src/Model/index"
 * import { PropertyType, valueCodec } from "@beep/scratchpad/osdk/src/Property/index"
 *
 * const visits = Model.array(Model.struct({ on: Model.date, score: Model.vector(2) }))
 * const type = Model.typeOf(visits)
 * const element = PropertyType.guards.array(type) ? type.elementType : type
 * const fields = PropertyType.guards.struct(element)
 *   ? A.map(element.fields, (field) => [field.apiName, field.rid, field.dataType.type])
 *   : []
 * const day = await Effect.runPromise(S.decodeUnknownEffect(valueCodec(type))([{ on: "2021-05-01" }]))
 * const facts = [type.type, fields, S.is(visits.value)(day)]
 * facts // => ["array", [["on", "on", "date"], ["score", "score", "vector"]], true]
 * ```
 *
 * @param spec - The property spec to read.
 * @category projections
 * @since 0.0.0
 */
export const typeOf = (spec: AnyPropertySpec): PropertyType =>
  pipe(
    Match.value(spec),
    Match.discriminators("kind")({
      vector: ({ shape }) => VectorType.make({ dimension: shape.dimension }),
      array: ({ shape }) => ArrayType.make({ elementType: typeOf(shape.element) }),
      struct: ({ shape }) =>
        StructType.make({
          fields: A.map(R.toEntries(shape.fields), ([name, field]) =>
            StructFieldType.make({
              apiName: StructFieldApiName.make(name),
              rid: StructFieldTypeRid.make(name),
              dataType: typeOf(field),
            })
          ),
        }),
      timeseries: () => TimeseriesType.make({ itemType: SensorSeriesItem.make({}) }),
    }),
    // Every other tag is a leaf whose type states nothing a spec could: the member of the union with that tag.
    Match.orElse((leaf) => PropertyType.cases[leaf.kind].make({}))
  );
