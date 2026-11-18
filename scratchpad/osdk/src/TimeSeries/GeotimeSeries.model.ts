/**
 * The value of a geotime series reference property.
 *
 * **Details**
 *
 * A geotime series tracks where one entity was over time. A property of this
 * type stores a reference to the series, and some load paths resolve it to the
 * entity's latest position. The wire sends three untagged shapes for the one
 * property type: a bare series identifier, a `{ geotimeSeriesId,
 * geotimeSeriesIntegrationRid }` record, or a resolved
 * `{ type: "geotimeSeriesValue", position, timestamp }` record. OSDK treats
 * anything that is not the resolved record as "no latest value" and drops it.
 * Here all three decode into one tagged union, so nothing is lost.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";
import * as SchemaTransformation from "effect/SchemaTransformation";
import * as Tuple from "effect/Tuple";
import { GeotimeSeriesValue } from "./TimeSeries.model.ts";

const $I = $ScratchpadId.create("osdk/TimeSeries/GeotimeSeries.model");

/**
 * Identifier of one geotime series: the track of a single entity.
 *
 * @category identifiers
 * @since 0.0.0
 */
export const GeotimeSeriesId = S.NonEmptyString.pipe(
  S.brand("GeotimeSeriesId"),
  $I.annoteSchema("GeotimeSeriesId", { description: "Identifier of one geotime series: the track of a single entity." })
);

/**
 * Runtime type of {@link GeotimeSeriesId}.
 *
 * @category identifiers
 * @since 0.0.0
 */
export type GeotimeSeriesId = typeof GeotimeSeriesId.Type;

/**
 * Resource identifier of a geotime series integration, the feed of positions over time.
 *
 * **Details**
 *
 * The same identifier names the integration in two places: a geotime series
 * reference says which integration feeds its series, and a geotime series
 * datasource of an object type says which integration backs its properties.
 *
 * @category identifiers
 * @since 0.0.0
 */
export const GeotimeSeriesIntegrationRid = S.NonEmptyString.pipe(
  S.brand("GeotimeSeriesIntegrationRid"),
  $I.annoteSchema("GeotimeSeriesIntegrationRid", {
    description: "Resource identifier of a geotime series integration, the feed of positions over time.",
  })
);

/**
 * Runtime type of {@link GeotimeSeriesIntegrationRid}.
 *
 * @category identifiers
 * @since 0.0.0
 */
export type GeotimeSeriesIntegrationRid = typeof GeotimeSeriesIntegrationRid.Type;

const GeotimeSeriesReferenceKind = LiteralKit(["series", "integratedSeries", "geotimeSeriesValue"]);

/**
 * Reference to a geotime series by its identifier alone, sent on the wire as a bare string.
 *
 * @category models
 * @since 0.0.0
 */
export class GeotimeSeriesById extends S.Opaque<GeotimeSeriesById, { readonly brand: unique symbol }>()(
  S.NonEmptyString.pipe(
    S.decodeTo(
      S.Struct({
        type: S.tag("series"),
        geotimeSeriesId: GeotimeSeriesId.annotateKey({ description: "The series the property points at." }),
      }),
      SchemaTransformation.transform({
        decode: (geotimeSeriesId) => ({ type: GeotimeSeriesReferenceKind.Enum.series, geotimeSeriesId }),
        encode: ({ geotimeSeriesId }) => geotimeSeriesId,
      })
    ),
    $I.annoteSchema("GeotimeSeriesById", {
      description: "Reference to a geotime series by its identifier alone.",
    })
  )
) {}

/**
 * Reference to a geotime series together with the integration that feeds it.
 *
 * @category models
 * @since 0.0.0
 */
export class IntegratedGeotimeSeries extends S.Opaque<IntegratedGeotimeSeries, { readonly brand: unique symbol }>()(
  S.Struct({ geotimeSeriesId: S.NonEmptyString, geotimeSeriesIntegrationRid: S.NonEmptyString }).pipe(
    S.decodeTo(
      S.Struct({
        type: S.tag("integratedSeries"),
        geotimeSeriesId: GeotimeSeriesId.annotateKey({ description: "The series the property points at." }),
        sourceRid: GeotimeSeriesIntegrationRid.annotateKey({ description: "The integration that feeds the series." }),
      }),
      SchemaTransformation.transform({
        decode: ({ geotimeSeriesId, geotimeSeriesIntegrationRid }) => ({
          type: GeotimeSeriesReferenceKind.Enum.integratedSeries,
          geotimeSeriesId,
          sourceRid: geotimeSeriesIntegrationRid,
        }),
        encode: ({ geotimeSeriesId, sourceRid }) => ({ geotimeSeriesId, geotimeSeriesIntegrationRid: sourceRid }),
      })
    ),
    $I.annoteSchema("IntegratedGeotimeSeries", {
      description: "Reference to a geotime series together with the integration that feeds it.",
    })
  )
) {}

/**
 * What a geotime series reference property holds: a reference to the series, or its latest resolved position.
 *
 * **Example** (Decode every wire shape into one union)
 *
 * ```ts import.meta.vitest name="Decode every wire shape into one union"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { GeotimeSeriesReference } from "@beep/scratchpad/osdk/src/TimeSeries/index"
 *
 * const decode = S.decodeUnknownEffect(GeotimeSeriesReference)
 * const values = await Effect.runPromise(
 *   Effect.all([
 *     decode("track-17"),
 *     decode({ geotimeSeriesId: "track-17", geotimeSeriesIntegrationRid: "ri.gtsr.main.integration.1" }),
 *     decode({ type: "geotimeSeriesValue", position: [102.0, 0.5], timestamp: "2021-01-04T05:00:00Z" }),
 *   ])
 * )
 * values.map((value) => value.type) // => ["series", "integratedSeries", "geotimeSeriesValue"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const GeotimeSeriesReference = GeotimeSeriesReferenceKind.mapMembers(() =>
  Tuple.make(GeotimeSeriesById, IntegratedGeotimeSeries, GeotimeSeriesValue)
).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("GeotimeSeriesReference", {
    description: "What a geotime series reference property holds: a reference to the series, or its latest position.",
  })
);

/**
 * Runtime type of {@link GeotimeSeriesReference}.
 *
 * @category models
 * @since 0.0.0
 */
export type GeotimeSeriesReference = typeof GeotimeSeriesReference.Type;
