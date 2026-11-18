/**
 * Type-tag records shared by more than one type universe.
 *
 * **Details**
 *
 * A type descriptor is a record whose `type` field names its kind. The scalar
 * and reference tags below are identical wherever they appear (a property, an
 * action parameter, a query output), so each is declared once here and reused
 * by every universe's union. Composite tags (`array`, `struct`, `set`, ...)
 * recurse into their own universe and are declared with that universe.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { constTrue, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as SchemaTransformation from "effect/SchemaTransformation";
import * as Tuple from "effect/Tuple";
import { PropertyTypeRid } from "../Identifier/Identifier.model.ts";
import { HostedEmbeddingModel, MarkingKind, VectorSimilarity } from "./DataType.values.ts";

const $I = $ScratchpadId.create("osdk/DataType/DataType.model");

// -----------------------------------------------------------------------------
// Scalars
// -----------------------------------------------------------------------------

/**
 * Tag of a true-or-false value.
 *
 * **Example** (Construct a tag record)
 *
 * ```ts import.meta.vitest name="Construct a tag record"
 * import { BooleanType } from "@beep/scratchpad/osdk/src/DataType/index"
 *
 * const tag = BooleanType.make({})
 * tag.type // => "boolean"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BooleanType extends S.Opaque<BooleanType, { readonly brand: unique symbol }>()(
  S.Struct({ type: S.tag("boolean") }).pipe(
    $I.annoteSchema("BooleanType", { description: "Type tag of a true-or-false value." })
  )
) {}

/**
 * Tag of a signed 8-bit integer.
 *
 * @category models
 * @since 0.0.0
 */
export class ByteType extends S.Opaque<ByteType, { readonly brand: unique symbol }>()(
  S.Struct({ type: S.tag("byte") }).pipe(
    $I.annoteSchema("ByteType", { description: "Type tag of a signed 8-bit integer." })
  )
) {}

/**
 * Tag of a signed 16-bit integer.
 *
 * @category models
 * @since 0.0.0
 */
export class ShortType extends S.Opaque<ShortType, { readonly brand: unique symbol }>()(
  S.Struct({ type: S.tag("short") }).pipe(
    $I.annoteSchema("ShortType", { description: "Type tag of a signed 16-bit integer." })
  )
) {}

/**
 * Tag of a signed 32-bit integer.
 *
 * @category models
 * @since 0.0.0
 */
export class IntegerType extends S.Opaque<IntegerType, { readonly brand: unique symbol }>()(
  S.Struct({ type: S.tag("integer") }).pipe(
    $I.annoteSchema("IntegerType", { description: "Type tag of a signed 32-bit integer." })
  )
) {}

/**
 * Tag of a signed 64-bit integer, which travels as a string because JSON numbers cannot hold it.
 *
 * @category models
 * @since 0.0.0
 */
export class LongType extends S.Opaque<LongType, { readonly brand: unique symbol }>()(
  S.Struct({ type: S.tag("long") }).pipe(
    $I.annoteSchema("LongType", {
      description: "Type tag of a signed 64-bit integer, which travels as a string.",
    })
  )
) {}

/**
 * Tag of a 32-bit floating point number.
 *
 * @category models
 * @since 0.0.0
 */
export class FloatType extends S.Opaque<FloatType, { readonly brand: unique symbol }>()(
  S.Struct({ type: S.tag("float") }).pipe(
    $I.annoteSchema("FloatType", { description: "Type tag of a 32-bit floating point number." })
  )
) {}

/**
 * Tag of a 64-bit floating point number.
 *
 * @category models
 * @since 0.0.0
 */
export class DoubleType extends S.Opaque<DoubleType, { readonly brand: unique symbol }>()(
  S.Struct({ type: S.tag("double") }).pipe(
    $I.annoteSchema("DoubleType", { description: "Type tag of a 64-bit floating point number." })
  )
) {}

/**
 * Tag of an arbitrary-precision decimal, optionally bounded by precision and scale.
 *
 * @invariant When both are present, `scale` does not exceed `precision`.
 * @category models
 * @since 0.0.0
 */
export class DecimalType extends S.Opaque<DecimalType, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("decimal"),
    precision: S.OptionFromOptionalKey(S.Int.check(S.isGreaterThanOrEqualTo(1))).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Total number of significant digits, when bounded." })
    ),
    scale: S.OptionFromOptionalKey(S.Int.check(S.isGreaterThanOrEqualTo(0))).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Number of digits after the decimal point, when bounded." })
    ),
  }).pipe(
    S.check(
      S.makeFilter(
        ({ precision, scale }) =>
          pipe(
            O.all([precision, scale]),
            O.match({ onNone: constTrue, onSome: ([digits, fraction]) => fraction <= digits })
          ),
        $I.annote("DecimalScaleWithinPrecisionCheck", {
          title: "Scale within precision",
          description: "When both are stated, the scale does not exceed the precision.",
          message: "Expected the decimal scale to be at most its precision",
        })
      )
    ),
    $I.annoteSchema("DecimalType", {
      description: "Type tag of an arbitrary-precision decimal, optionally bounded by precision and scale.",
    })
  )
) {}

/**
 * Tag of Unicode text.
 *
 * @category models
 * @since 0.0.0
 */
export class StringType extends S.Opaque<StringType, { readonly brand: unique symbol }>()(
  S.Struct({ type: S.tag("string") }).pipe($I.annoteSchema("StringType", { description: "Type tag of Unicode text." }))
) {}

/**
 * Tag of a calendar date with no time of day and no zone.
 *
 * @category models
 * @since 0.0.0
 */
export class DateType extends S.Opaque<DateType, { readonly brand: unique symbol }>()(
  S.Struct({ type: S.tag("date") }).pipe(
    $I.annoteSchema("DateType", { description: "Type tag of a calendar date with no time of day and no zone." })
  )
) {}

/**
 * Tag of an instant on the UTC timeline.
 *
 * @category models
 * @since 0.0.0
 */
export class TimestampType extends S.Opaque<TimestampType, { readonly brand: unique symbol }>()(
  S.Struct({ type: S.tag("timestamp") }).pipe(
    $I.annoteSchema("TimestampType", { description: "Type tag of an instant on the UTC timeline." })
  )
) {}

/**
 * Tag of raw bytes.
 *
 * @category models
 * @since 0.0.0
 */
export class BinaryType extends S.Opaque<BinaryType, { readonly brand: unique symbol }>()(
  S.Struct({ type: S.tag("binary") }).pipe($I.annoteSchema("BinaryType", { description: "Type tag of raw bytes." }))
) {}

// -----------------------------------------------------------------------------
// Security and references
// -----------------------------------------------------------------------------

/**
 * Tag of a security marking identifier, optionally narrowed to one marking subtype.
 *
 * @category models
 * @since 0.0.0
 */
export class MarkingType extends S.Opaque<MarkingType, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("marking"),
    markingType: S.OptionFromOptionalKey(MarkingKind).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Marking subtype, absent when the platform does not expose it." })
    ),
  }).pipe(
    $I.annoteSchema("MarkingType", {
      description: "Type tag of a security marking identifier, optionally narrowed to one marking subtype.",
    })
  )
) {}

/**
 * Tag of an encrypted string, optionally naming the cipher channel used for new values.
 *
 * @category models
 * @since 0.0.0
 */
export class CipherTextType extends S.Opaque<CipherTextType, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("cipherText"),
    defaultCipherChannel: S.OptionFromOptionalKey(S.NonEmptyString).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Resource identifier of the cipher channel that encrypts new values." })
    ),
  }).pipe(
    $I.annoteSchema("CipherTextType", {
      description: "Type tag of an encrypted string, optionally naming the cipher channel used for new values.",
    })
  )
) {}

/**
 * Tag of a reference to an uploaded file attachment.
 *
 * @category models
 * @since 0.0.0
 */
export class AttachmentType extends S.Opaque<AttachmentType, { readonly brand: unique symbol }>()(
  S.Struct({ type: S.tag("attachment") }).pipe(
    $I.annoteSchema("AttachmentType", { description: "Type tag of a reference to an uploaded file attachment." })
  )
) {}

/**
 * Tag of a reference to an item in a media set.
 *
 * @category models
 * @since 0.0.0
 */
export class MediaReferenceType extends S.Opaque<MediaReferenceType, { readonly brand: unique symbol }>()(
  S.Struct({ type: S.tag("mediaReference") }).pipe(
    $I.annoteSchema("MediaReferenceType", { description: "Type tag of a reference to an item in a media set." })
  )
) {}

// -----------------------------------------------------------------------------
// Geospatial and series
// -----------------------------------------------------------------------------

/**
 * Tag of a single point on the globe.
 *
 * @category models
 * @since 0.0.0
 */
export class GeoPointType extends S.Opaque<GeoPointType, { readonly brand: unique symbol }>()(
  S.Struct({ type: S.tag("geopoint") }).pipe(
    $I.annoteSchema("GeoPointType", { description: "Type tag of a single point on the globe." })
  )
) {}

/**
 * Tag of an arbitrary geometry on the globe.
 *
 * @category models
 * @since 0.0.0
 */
export class GeoShapeType extends S.Opaque<GeoShapeType, { readonly brand: unique symbol }>()(
  S.Struct({ type: S.tag("geoshape") }).pipe(
    $I.annoteSchema("GeoShapeType", { description: "Type tag of an arbitrary geometry on the globe." })
  )
) {}

/**
 * Tag of a point supplied to an action, which the platform stores as a geohash.
 *
 * @category models
 * @since 0.0.0
 */
export class GeohashType extends S.Opaque<GeohashType, { readonly brand: unique symbol }>()(
  S.Struct({ type: S.tag("geohash") }).pipe(
    $I.annoteSchema("GeohashType", {
      description: "Type tag of a point supplied to an action, which the platform stores as a geohash.",
    })
  )
) {}

/**
 * Tag of a reference to a geotime series: positions of one tracked entity over time.
 *
 * @category models
 * @since 0.0.0
 */
export class GeotimeSeriesReferenceType extends S.Opaque<
  GeotimeSeriesReferenceType,
  { readonly brand: unique symbol }
>()(
  S.Struct({ type: S.tag("geotimeSeriesReference") }).pipe(
    $I.annoteSchema("GeotimeSeriesReferenceType", {
      description: "Type tag of a reference to a geotime series: positions of one tracked entity over time.",
    })
  )
) {}

/**
 * Tag of a reference to a time series supplied to an action.
 *
 * @category models
 * @since 0.0.0
 */
export class TimeSeriesReferenceType extends S.Opaque<TimeSeriesReferenceType, { readonly brand: unique symbol }>()(
  S.Struct({ type: S.tag("timeSeriesReference") }).pipe(
    $I.annoteSchema("TimeSeriesReferenceType", {
      description: "Type tag of a reference to a time series supplied to an action.",
    })
  )
) {}

const TimeSeriesItemKind = LiteralKit(["string", "double", "numericOrNonNumeric"]);

/**
 * Sensor time series whose points are numeric or categorical depending on the sensor.
 *
 * **Details**
 *
 * When `isNonNumericProperty` names a boolean property, that property says which
 * kind a given object's series is; otherwise the kind is inferred from the
 * points returned.
 *
 * @category models
 * @since 0.0.0
 */
export class SensorSeriesItem extends S.Opaque<SensorSeriesItem, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("numericOrNonNumeric"),
    isNonNumericProperty: S.OptionFromOptionalKey(PropertyTypeRid).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Boolean property that tells whether an object's series is categorical." })
    ),
  }).pipe(
    S.encodeKeys({ isNonNumericProperty: "isNonNumericPropertyTypeId" }),
    $I.annoteSchema("SensorSeriesItem", {
      description: "Sensor time series whose points are numeric or categorical depending on the sensor.",
    })
  )
) {}

/**
 * What the points of a time series property hold.
 *
 * **Details**
 *
 * A categorical series is tagged with the ordinary `string` tag and a numeric
 * one with the ordinary `double` tag, exactly as the wire does; only the sensor
 * case needs a record of its own.
 *
 * **Example** (Branch on the kind of series)
 *
 * ```ts import.meta.vitest name="Branch on the kind of series"
 * import { DoubleType, TimeSeriesItem } from "@beep/scratchpad/osdk/src/DataType/index"
 *
 * const describe = TimeSeriesItem.match({
 *   string: () => "categorical",
 *   double: () => "numeric",
 *   numericOrNonNumeric: () => "sensor",
 * })
 * describe(DoubleType.make({})) // => "numeric"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const TimeSeriesItem = TimeSeriesItemKind.mapMembers(() =>
  Tuple.make(StringType, DoubleType, SensorSeriesItem)
).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("TimeSeriesItem", { description: "What the points of a time series property hold." })
);

/**
 * Runtime type of {@link TimeSeriesItem}.
 *
 * @category models
 * @since 0.0.0
 */
export type TimeSeriesItem = typeof TimeSeriesItem.Type;

/**
 * Tag of a time series property, which holds a reference to a series rather than the points themselves.
 *
 * @category models
 * @since 0.0.0
 */
export class TimeseriesType extends S.Opaque<TimeseriesType, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("timeseries"),
    itemType: TimeSeriesItem.annotateKey({ description: "What the points of the referenced series hold." }),
  }).pipe(
    $I.annoteSchema("TimeseriesType", {
      description: "Type tag of a time series property, which holds a reference to a series.",
    })
  )
) {}

const EmbeddingSourceKind = LiteralKit(["lms", "foundryLiveDeployment"]);

/**
 * Embedding produced by a platform-hosted language model.
 *
 * @category models
 * @since 0.0.0
 */
export class HostedEmbedding extends S.Opaque<HostedEmbedding, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("lms"),
    model: HostedEmbeddingModel.annotateKey({ description: "The hosted model that produces the embedding." }),
  }).pipe(
    S.encodeKeys({ model: "value" }),
    $I.annoteSchema("HostedEmbedding", { description: "Embedding produced by a platform-hosted language model." })
  )
) {}

/**
 * Embedding produced by a model the user deployed, addressed by its deployment.
 *
 * @category models
 * @since 0.0.0
 */
export class DeployedEmbedding extends S.Opaque<DeployedEmbedding, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("foundryLiveDeployment"),
    rid: S.OptionFromOptionalKey(S.NonEmptyString).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Resource identifier of the live deployment." })
    ),
    inputParamName: S.OptionFromOptionalKey(S.NonEmptyString).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Name of the deployment input that receives the text." })
    ),
    outputParamName: S.OptionFromOptionalKey(S.NonEmptyString).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Name of the deployment output that carries the vector." })
    ),
  }).pipe(
    $I.annoteSchema("DeployedEmbedding", {
      description: "Embedding produced by a model the user deployed, addressed by its deployment.",
    })
  )
) {}

/**
 * Where the vectors of a vector property come from.
 *
 * **Example** (Name the model behind a hosted embedding)
 *
 * ```ts import.meta.vitest name="Name the model behind a hosted embedding"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { EmbeddingSource } from "@beep/scratchpad/osdk/src/DataType/index"
 *
 * const describe = EmbeddingSource.match({
 *   lms: ({ model }) => `hosted ${model}`,
 *   foundryLiveDeployment: () => "deployed by the user",
 * })
 * const source = await Effect.runPromise(
 *   S.decodeUnknownEffect(EmbeddingSource)({ type: "lms", value: "TEXT_EMBEDDING_3_SMALL" })
 * )
 * describe(source) // => "hosted textEmbedding3Small"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const EmbeddingSource =EmbeddingSourceKind.mapMembers(() => Tuple.make(HostedEmbedding, DeployedEmbedding)).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("EmbeddingSource", { description: "Where the vectors of a vector property come from." })
);

/**
 * Runtime type of {@link EmbeddingSource}.
 *
 * @category models
 * @since 0.0.0
 */
export type EmbeddingSource = typeof EmbeddingSource.Type;

// The wire wraps each similarity function as `{ value?: ENUM }`; the domain keeps the bare literal
// and drops wrappers whose value the server omitted.
const WireSimilarity = VectorSimilarity.pipe(S.toEncoded);
type WireSimilarity = typeof WireSimilarity.Type;
const SimilarityFunctions = S.Array(S.Struct({ value: S.OptionFromOptionalKey(WireSimilarity) })).pipe(
  S.decodeTo(
    S.Array(VectorSimilarity),
    SchemaTransformation.transform<ReadonlyArray<WireSimilarity>, ReadonlyArray<{ readonly value: O.Option<WireSimilarity> }>>({
      decode: (wrappers) => A.getSomes(A.map(wrappers, (wrapper) => wrapper.value)),
      encode: A.map((value) => ({ value: O.some(value) })),
    })
  )
);

/**
 * Tag of a fixed-size vector of floats used for similarity search.
 *
 * @invariant `dimension` is a positive integer.
 * @category models
 * @since 0.0.0
 */
export class VectorType extends S.Opaque<VectorType, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("vector"),
    dimension: S.Int.check(S.isGreaterThanOrEqualTo(1)).annotateKey({
      description: "Number of components every vector of this property has.",
    }),
    supportsSearchWith: SimilarityFunctions.pipe(
      S.withConstructorDefault(Effect.succeed(A.empty<VectorSimilarity>())),
      S.withDecodingDefaultKey(Effect.succeed(A.empty<{ readonly value?: WireSimilarity }>())),
      S.annotateKey({ description: "Similarity functions the property is indexed for." })
    ),
    embeddingModel: S.OptionFromOptionalKey(EmbeddingSource).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Model that produces the vectors, when the platform computes them." })
    ),
  }).pipe(
    $I.annoteSchema("VectorType", {
      description: "Type tag of a fixed-size vector of floats used for similarity search.",
    })
  )
) {}

// -----------------------------------------------------------------------------
// Unit and escape tags
// -----------------------------------------------------------------------------

/**
 * Tag of the null value, used by queries to make a union nullable.
 *
 * @category models
 * @since 0.0.0
 */
export class NullType extends S.Opaque<NullType, { readonly brand: unique symbol }>()(
  S.Struct({ type: S.tag("null") }).pipe(
    $I.annoteSchema("NullType", { description: "Type tag of the null value, used by queries to make a union nullable." })
  )
) {}

/**
 * Tag of a query output that returns nothing.
 *
 * @category models
 * @since 0.0.0
 */
export class VoidType extends S.Opaque<VoidType, { readonly brand: unique symbol }>()(
  S.Struct({ type: S.tag("void") }).pipe(
    $I.annoteSchema("VoidType", { description: "Type tag of a query output that returns nothing." })
  )
) {}

/**
 * Tag of a value of any type, found only in the legacy ontology data types.
 *
 * @category models
 * @since 0.0.0
 */
export class AnyType extends S.Opaque<AnyType, { readonly brand: unique symbol }>()(
  S.Struct({ type: S.tag("any") }).pipe(
    $I.annoteSchema("AnyType", {
      description: "Type tag of a value of any type, found only in the legacy ontology data types.",
    })
  )
) {}

/**
 * Tag of an action parameter that names an object type rather than an object.
 *
 * @category models
 * @since 0.0.0
 */
export class ObjectTypeReferenceType extends S.Opaque<ObjectTypeReferenceType, { readonly brand: unique symbol }>()(
  S.Struct({ type: S.tag("objectType") }).pipe(
    $I.annoteSchema("ObjectTypeReferenceType", {
      description: "Type tag of an action parameter that names an object type rather than an object.",
    })
  )
) {}

/**
 * Tag of an action parameter that names a scenario, an isolated what-if overlay of edits.
 *
 * @category models
 * @since 0.0.0
 */
export class ScenarioReferenceType extends S.Opaque<ScenarioReferenceType, { readonly brand: unique symbol }>()(
  S.Struct({ type: S.tag("scenarioReference") }).pipe(
    $I.annoteSchema("ScenarioReferenceType", {
      description: "Type tag of an action parameter that names a scenario.",
    })
  )
) {}

/**
 * Tag of a type the platform knows but this contract does not model, kept so decoding never loses it.
 *
 * @category models
 * @since 0.0.0
 */
export class UnsupportedType extends S.Opaque<UnsupportedType, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("unsupported"),
    unsupportedType: S.String.annotateKey({ description: "Platform name of the unmodelled type." }),
    params: S.Record(S.String, S.String).pipe(
      S.withConstructorDefault(Effect.succeed({})),
      S.annotateKey({ description: "Parameters of the unmodelled type, verbatim." })
    ),
  }).pipe(
    $I.annoteSchema("UnsupportedType", {
      description: "Type tag of a type the platform knows but this contract does not model.",
    })
  )
) {}
