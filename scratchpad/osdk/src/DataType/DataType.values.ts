/**
 * The one vocabulary of type tags shared by every type universe of an ontology.
 *
 * **Details**
 *
 * Foundry describes data in five overlapping "type algebras": object property
 * types, action parameter types, query data types, value types and the legacy
 * ontology data types. They reuse 44 distinct `type` tags between them. This
 * module names that vocabulary once ({@link DataTypeKind}) and derives every
 * universe and every semantic family as a `pick` of it, so a tag can never be
 * spelled two ways and a table keyed by a subset is checked for totality by the
 * compiler.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit, MappedLiteralKit } from "@beep/schema";

const $I = $ScratchpadId.create("osdk/DataType/DataType.values");

/**
 * Every `type` tag used by any ontology type descriptor.
 *
 * **Example** (Derive a universe from the master vocabulary)
 *
 * ```ts import.meta.vitest name="Derive a universe from the master vocabulary"
 * import { DataTypeKind, PropertyTypeKind } from "@beep/scratchpad/osdk/src/DataType/index"
 *
 * const sizes = [DataTypeKind.literals.length, PropertyTypeKind.literals.length]
 * sizes // => [44, 22]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const DataTypeKind = LiteralKit([
  "boolean",
  "byte",
  "short",
  "integer",
  "long",
  "float",
  "double",
  "decimal",
  "string",
  "date",
  "timestamp",
  "binary",
  "marking",
  "cipherText",
  "attachment",
  "mediaReference",
  "geopoint",
  "geoshape",
  "geohash",
  "geotimeSeriesReference",
  "timeseries",
  "timeSeriesReference",
  "vector",
  "array",
  "set",
  "map",
  "entrySet",
  "struct",
  "union",
  "optional",
  "object",
  "objectSet",
  "interfaceObject",
  "interfaceObjectSet",
  "objectType",
  "scenarioReference",
  "twoDimensionalAggregation",
  "threeDimensionalAggregation",
  "typeReference",
  "reference",
  "null",
  "void",
  "any",
  "unsupported",
]).pipe(
  $I.annoteSchema("DataTypeKind", {
    description: "Every type tag used by any ontology type descriptor, across all five type universes.",
  })
);

/**
 * Runtime type of {@link DataTypeKind}.
 *
 * @category models
 * @since 0.0.0
 */
export type DataTypeKind = typeof DataTypeKind.Type;

// -----------------------------------------------------------------------------
// Universes
// -----------------------------------------------------------------------------

/**
 * Tags a property of an object or interface type may have.
 *
 * **Example** (Find the tags only a property can carry)
 *
 * ```ts import.meta.vitest name="Find the tags only a property can carry"
 * import * as A from "effect/Array"
 * import {
 *   ActionParameterTypeKind,
 *   PropertyTypeKind,
 *   QueryDataTypeKind,
 * } from "@beep/scratchpad/osdk/src/DataType/index"
 *
 * const passedToCode = A.union(ActionParameterTypeKind.literals, QueryDataTypeKind.literals)
 * const propertyOnly = A.difference(PropertyTypeKind.literals, passedToCode)
 * propertyOnly // => ["byte", "short", "cipherText", "geopoint", "geotimeSeriesReference", "timeseries"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PropertyTypeKind = DataTypeKind.pick([
  "boolean",
  "byte",
  "short",
  "integer",
  "long",
  "float",
  "double",
  "decimal",
  "string",
  "date",
  "timestamp",
  "marking",
  "cipherText",
  "attachment",
  "mediaReference",
  "geopoint",
  "geoshape",
  "geotimeSeriesReference",
  "timeseries",
  "vector",
  "array",
  "struct",
]).pipe(
  $I.annoteSchema("PropertyTypeKind", {
    description: "Type tags a property of an object or interface type may have.",
  })
);

/**
 * Runtime type of {@link PropertyTypeKind}.
 *
 * @category models
 * @since 0.0.0
 */
export type PropertyTypeKind = typeof PropertyTypeKind.Type;

/**
 * Tags an action parameter may have.
 *
 * **Example** (Reject the property tags an action cannot take)
 *
 * ```ts import.meta.vitest name="Reject the property tags an action cannot take"
 * import * as S from "effect/Schema"
 * import { ActionParameterTypeKind } from "@beep/scratchpad/osdk/src/DataType/index"
 *
 * const isParameterTag = S.is(ActionParameterTypeKind)
 * const verdicts = [isParameterTag("geohash"), isParameterTag("geopoint"), isParameterTag("float")]
 * verdicts // => [true, false, false]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ActionParameterTypeKind = DataTypeKind.pick([
  "boolean",
  "integer",
  "long",
  "double",
  "decimal",
  "string",
  "date",
  "timestamp",
  "marking",
  "attachment",
  "mediaReference",
  "geoshape",
  "geohash",
  "timeSeriesReference",
  "vector",
  "array",
  "struct",
  "object",
  "objectSet",
  "interfaceObject",
  "objectType",
  "scenarioReference",
]).pipe(
  $I.annoteSchema("ActionParameterTypeKind", {
    description: "Type tags an action parameter may have.",
  })
);

/**
 * Runtime type of {@link ActionParameterTypeKind}.
 *
 * @category models
 * @since 0.0.0
 */
export type ActionParameterTypeKind = typeof ActionParameterTypeKind.Type;

/**
 * Tags a query parameter or query output may have.
 *
 * **Example** (List the tags no other universe uses)
 *
 * ```ts import.meta.vitest name="List the tags no other universe uses"
 * import * as A from "effect/Array"
 * import {
 *   ActionParameterTypeKind,
 *   LegacyDataTypeKind,
 *   PropertyTypeKind,
 *   QueryDataTypeKind,
 *   ValueTypeKind,
 * } from "@beep/scratchpad/osdk/src/DataType/index"
 *
 * const others = [PropertyTypeKind, ActionParameterTypeKind, ValueTypeKind, LegacyDataTypeKind]
 * const usedElsewhere = A.flatMap(others, (universe) => universe.literals)
 * const queryOnly = A.difference(QueryDataTypeKind.literals, usedElsewhere)
 * queryOnly // => ["entrySet", "interfaceObjectSet", "twoDimensionalAggregation", "threeDimensionalAggregation", "typeReference", "null", "void"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const QueryDataTypeKind = DataTypeKind.pick([
  "boolean",
  "integer",
  "long",
  "float",
  "double",
  "string",
  "date",
  "timestamp",
  "attachment",
  "mediaReference",
  "geoshape",
  "array",
  "set",
  "entrySet",
  "struct",
  "union",
  "object",
  "objectSet",
  "interfaceObject",
  "interfaceObjectSet",
  "twoDimensionalAggregation",
  "threeDimensionalAggregation",
  "typeReference",
  "null",
  "void",
  "unsupported",
]).pipe(
  $I.annoteSchema("QueryDataTypeKind", {
    description: "Type tags a query parameter or query output may have.",
  })
);

/**
 * Runtime type of {@link QueryDataTypeKind}.
 *
 * @category models
 * @since 0.0.0
 */
export type QueryDataTypeKind = typeof QueryDataTypeKind.Type;

/**
 * Tags a value type (a reusable constrained base type) may be built from.
 *
 * **Example** (Tell the wrappers from the base types)
 *
 * ```ts import.meta.vitest name="Tell the wrappers from the base types"
 * import * as A from "effect/Array"
 * import { ValueTypeKind } from "@beep/scratchpad/osdk/src/DataType/index"
 *
 * const wrapsAnotherType = ValueTypeKind.matchOrElse(
 *   {
 *     array: () => true,
 *     map: () => true,
 *     struct: () => true,
 *     union: () => true,
 *     optional: () => true,
 *     reference: () => true,
 *   },
 *   () => false
 * )
 * const baseTypes = A.filter(ValueTypeKind.literals, (tag) => !wrapsAnotherType(tag))
 * baseTypes.length // => 12
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ValueTypeKind = DataTypeKind.pick([
  "boolean",
  "byte",
  "short",
  "integer",
  "long",
  "float",
  "double",
  "decimal",
  "string",
  "date",
  "timestamp",
  "binary",
  "array",
  "map",
  "struct",
  "union",
  "optional",
  "reference",
]).pipe(
  $I.annoteSchema("ValueTypeKind", {
    description: "Type tags a value type may be built from.",
  })
);

/**
 * Runtime type of {@link ValueTypeKind}.
 *
 * @category models
 * @since 0.0.0
 */
export type ValueTypeKind = typeof ValueTypeKind.Type;

/**
 * Tags of the legacy ontology data types that version 1 parameters and outputs used.
 *
 * **Details**
 *
 * Kept as a vocabulary only: it is the one universe that owns the `any` tag, and
 * naming it makes "every tag belongs to a universe" checkable. Nothing in the
 * current contract is built on it.
 *
 * **Example** (Check that the five universes cover the vocabulary)
 *
 * ```ts import.meta.vitest name="Check that the five universes cover the vocabulary"
 * import * as A from "effect/Array"
 * import * as S from "effect/Schema"
 * import {
 *   ActionParameterTypeKind,
 *   LegacyDataTypeKind,
 *   PropertyTypeKind,
 *   QueryDataTypeKind,
 *   ValueTypeKind,
 * } from "@beep/scratchpad/osdk/src/DataType/index"
 *
 * const universes = [PropertyTypeKind, ActionParameterTypeKind, QueryDataTypeKind, ValueTypeKind, LegacyDataTypeKind]
 * const covered = A.dedupe(A.flatMap(universes, (universe) => universe.literals))
 * const ownsAny = A.map(universes, (universe) => S.is(universe)("any"))
 * const facts = { covered: covered.length, ownsAny }
 * facts // => { covered: 44, ownsAny: [false, false, false, false, true] }
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const LegacyDataTypeKind = DataTypeKind.pick([
  "boolean",
  "byte",
  "short",
  "integer",
  "long",
  "float",
  "double",
  "decimal",
  "string",
  "date",
  "timestamp",
  "binary",
  "marking",
  "cipherText",
  "mediaReference",
  "array",
  "set",
  "map",
  "struct",
  "object",
  "objectSet",
  "any",
  "unsupported",
]).pipe(
  $I.annoteSchema("LegacyDataTypeKind", {
    description: "Type tags of the legacy ontology data types used by version 1 parameters and outputs.",
  })
);

/**
 * Runtime type of {@link LegacyDataTypeKind}.
 *
 * @category models
 * @since 0.0.0
 */
export type LegacyDataTypeKind = typeof LegacyDataTypeKind.Type;

// -----------------------------------------------------------------------------
// Semantic families
// -----------------------------------------------------------------------------

/**
 * Tags whose values are numbers for the purpose of arithmetic, range comparison and numeric aggregation.
 *
 * **Example** (Tell which numbers travel as text)
 *
 * ```ts import.meta.vitest name="Tell which numbers travel as text"
 * import * as A from "effect/Array"
 * import { NumericKind } from "@beep/scratchpad/osdk/src/DataType/index"
 *
 * const travelsAsText = NumericKind.match({
 *   byte: () => false,
 *   short: () => false,
 *   integer: () => false,
 *   long: () => true,
 *   float: () => false,
 *   double: () => false,
 *   decimal: () => true,
 * })
 * const beyondJsonNumbers = A.filter(NumericKind.literals, travelsAsText)
 * beyondJsonNumbers // => ["long", "decimal"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const NumericKind = DataTypeKind.pick(["byte", "short", "integer", "long", "float", "double", "decimal"]).pipe(
  $I.annoteSchema("NumericKind", {
    description: "Type tags whose values are numbers for arithmetic, range comparison and numeric aggregation.",
  })
);

/**
 * Runtime type of {@link NumericKind}.
 *
 * @category models
 * @since 0.0.0
 */
export type NumericKind = typeof NumericKind.Type;

/**
 * Tags whose values are points in time: a calendar date or an instant.
 *
 * **Example** (Refuse the generated client's name for a date)
 *
 * ```ts import.meta.vitest name="Refuse the generated client's name for a date"
 * import * as S from "effect/Schema"
 * import { TemporalKind } from "@beep/scratchpad/osdk/src/DataType/index"
 *
 * const isTemporal = S.is(TemporalKind)
 * const verdicts = [isTemporal("date"), isTemporal("timestamp"), isTemporal("datetime")]
 * verdicts // => [true, true, false]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const TemporalKind = DataTypeKind.pick(["date", "timestamp"]).pipe(
  $I.annoteSchema("TemporalKind", {
    description: "Type tags whose values are points in time: a calendar date or an instant.",
  })
);

/**
 * Runtime type of {@link TemporalKind}.
 *
 * @category models
 * @since 0.0.0
 */
export type TemporalKind = typeof TemporalKind.Type;

/**
 * Tags whose values are geometry on the globe.
 *
 * **Example** (Leave geohashes and geotime series out of the geometry family)
 *
 * ```ts import.meta.vitest name="Leave geohashes and geotime series out of the geometry family"
 * import * as S from "effect/Schema"
 * import { GeospatialKind } from "@beep/scratchpad/osdk/src/DataType/index"
 *
 * const isGeometry = S.is(GeospatialKind)
 * const verdicts = [isGeometry("geoshape"), isGeometry("geohash"), isGeometry("geotimeSeriesReference")]
 * verdicts // => [true, false, false]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const GeospatialKind = DataTypeKind.pick(["geopoint", "geoshape"]).pipe(
  $I.annoteSchema("GeospatialKind", {
    description: "Type tags whose values are geometry on the globe.",
  })
);

/**
 * Runtime type of {@link GeospatialKind}.
 *
 * @category models
 * @since 0.0.0
 */
export type GeospatialKind = typeof GeospatialKind.Type;

/**
 * Tags a primary key property may have.
 *
 * **Details**
 *
 * This is the union of the two sources that constrain primary keys: the typed
 * wire primary key values (date, string, timestamp, boolean, integer, double,
 * long) and the generated-client contract (which adds short and byte). Composite
 * and reference-like tags are never keys.
 *
 * **Example** (Find the numbers that can never be a key)
 *
 * ```ts import.meta.vitest name="Find the numbers that can never be a key"
 * import * as A from "effect/Array"
 * import { NumericKind, PrimaryKeyKind } from "@beep/scratchpad/osdk/src/DataType/index"
 *
 * const neverKeys = A.difference(NumericKind.literals, PrimaryKeyKind.literals)
 * neverKeys // => ["float", "decimal"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PrimaryKeyKind = DataTypeKind.pick([
  "string",
  "integer",
  "long",
  "short",
  "byte",
  "double",
  "boolean",
  "date",
  "timestamp",
]).pipe(
  $I.annoteSchema("PrimaryKeyKind", {
    description: "Type tags a primary key property may have.",
  })
);

/**
 * Runtime type of {@link PrimaryKeyKind}.
 *
 * @category models
 * @since 0.0.0
 */
export type PrimaryKeyKind = typeof PrimaryKeyKind.Type;

/**
 * Tags whose values every universe that has the tag reads with the same codec.
 *
 * **Details**
 *
 * A `long` is a 64-bit integer written as text whether it is a property, an
 * argument, a query result or an agent value. The same holds for every scalar
 * tag and for three reference-valued ones: a cipher text, a media reference
 * and a geometry. These tags key the one table of value codecs
 * (`sharedCodec` of the `Value` concept), which every projection from a type
 * to a codec reads; a universe writes a row of its own only for the tags that
 * are not here. `attachment` is the tag that keeps it honest: a property holds
 * a reference record and an argument the bare identifier, so it is absent.
 *
 * **Example** (Find the property tags a universe has to read for itself)
 *
 * ```ts import.meta.vitest name="Find the property tags a universe has to read for itself"
 * import * as A from "effect/Array"
 * import { PropertyTypeKind, SharedValueKind } from "@beep/scratchpad/osdk/src/DataType/index"
 *
 * const ownRows = A.difference(PropertyTypeKind.literals, SharedValueKind.literals)
 * ownRows // => ["attachment", "geopoint", "geotimeSeriesReference", "timeseries", "vector", "array", "struct"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SharedValueKind = DataTypeKind.pick([
  "boolean",
  "byte",
  "short",
  "integer",
  "long",
  "float",
  "double",
  "decimal",
  "string",
  "date",
  "timestamp",
  "binary",
  "marking",
  "cipherText",
  "mediaReference",
  "geoshape",
]).pipe(
  $I.annoteSchema("SharedValueKind", {
    description: "Type tags whose values every universe that has the tag reads with the same codec.",
  })
);

/**
 * Runtime type of {@link SharedValueKind}.
 *
 * @category models
 * @since 0.0.0
 */
export type SharedValueKind = typeof SharedValueKind.Type;

// -----------------------------------------------------------------------------
// Literal domains carried by type tags
// -----------------------------------------------------------------------------

/**
 * Subtype of a marking property, decoded from the wire's upper-case enum.
 *
 * **Details**
 *
 * `cbac` is classification-based access control; `mandatory` is a standard
 * non-classification marking such as an organization.
 *
 * **Example** (Decode the wire enum into the domain literal)
 *
 * ```ts import.meta.vitest name="Decode the wire enum into the domain literal"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { MarkingKind } from "@beep/scratchpad/osdk/src/DataType/index"
 *
 * const kind = await Effect.runPromise(S.decodeUnknownEffect(MarkingKind)("CBAC"))
 * kind // => "cbac"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const MarkingKind = MappedLiteralKit([
  ["CBAC", "cbac"],
  ["MANDATORY", "mandatory"],
]).pipe(
  $I.annoteSchema("MarkingKind", {
    description: "Subtype of a marking property: classification-based access control or a mandatory marking.",
  })
);

/**
 * Runtime type of {@link MarkingKind}.
 *
 * @category models
 * @since 0.0.0
 */
export type MarkingKind = typeof MarkingKind.Type;

/**
 * Similarity function a vector property can be searched with.
 *
 * **Example** (Write a similarity function back to its wire name)
 *
 * ```ts import.meta.vitest name="Write a similarity function back to its wire name"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { VectorSimilarity } from "@beep/scratchpad/osdk/src/DataType/index"
 *
 * const similarity = await Effect.runPromise(S.decodeUnknownEffect(VectorSimilarity)("EUCLIDEAN_DISTANCE"))
 * const wire = await Effect.runPromise(S.encodeEffect(VectorSimilarity)("dotProduct"))
 * const pair = [similarity, wire]
 * pair // => ["euclidean", "DOT_PRODUCT"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const VectorSimilarity = MappedLiteralKit([
  ["COSINE_SIMILARITY", "cosine"],
  ["DOT_PRODUCT", "dotProduct"],
  ["EUCLIDEAN_DISTANCE", "euclidean"],
]).pipe(
  $I.annoteSchema("VectorSimilarity", {
    description: "Similarity function a vector property can be searched with.",
  })
);

/**
 * Runtime type of {@link VectorSimilarity}.
 *
 * @category models
 * @since 0.0.0
 */
export type VectorSimilarity = typeof VectorSimilarity.Type;

/**
 * Hosted embedding models that can populate a vector property.
 *
 * **Example** (Decode a model name and refuse the domain spelling on the wire)
 *
 * ```ts import.meta.vitest name="Decode a model name and refuse the domain spelling on the wire"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { HostedEmbeddingModel } from "@beep/scratchpad/osdk/src/DataType/index"
 *
 * const decode = S.decodeUnknownEffect(HostedEmbeddingModel)
 * const model = await Effect.runPromise(decode("BGE_BASE_EN_V1_5"))
 * const refused = await Effect.runPromise(Effect.isFailure(decode("bgeBaseEnV15")))
 * const outcome = [model, refused]
 * outcome // => ["bgeBaseEnV15", true]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const HostedEmbeddingModel = MappedLiteralKit([
  ["OPENAI_TEXT_EMBEDDING_ADA_002", "openAiTextEmbeddingAda002"],
  ["TEXT_EMBEDDING_3_LARGE", "textEmbedding3Large"],
  ["TEXT_EMBEDDING_3_SMALL", "textEmbedding3Small"],
  ["SNOWFLAKE_ARCTIC_EMBED_M", "snowflakeArcticEmbedM"],
  ["INSTRUCTOR_LARGE", "instructorLarge"],
  ["BGE_BASE_EN_V1_5", "bgeBaseEnV15"],
]).pipe(
  $I.annoteSchema("HostedEmbeddingModel", {
    description: "Hosted embedding models that can populate a vector property.",
  })
);

/**
 * Runtime type of {@link HostedEmbeddingModel}.
 *
 * @category models
 * @since 0.0.0
 */
export type HostedEmbeddingModel = typeof HostedEmbeddingModel.Type;
