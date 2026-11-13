/**
 * GeoJSON (RFC 7946) geometry, features and the distance measure used by geospatial filters.
 *
 * **Details**
 *
 * The platform carries geospatial values as GeoJSON in the WGS 84 reference
 * system: a position is `[longitude, latitude]` in decimal degrees, optionally
 * followed by a height in metres. The schemas here are that wire format, with
 * the rules the specification states only in prose (coordinate ranges, minimum
 * sizes, closed rings) turned into checks, so a malformed shape is rejected
 * where it enters instead of by the server. GeoJSON `type` tags are PascalCase
 * on the wire and stay that way.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit, MappedLiteralKit, SchemaUtils } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { constFalse } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as SchemaGetter from "effect/SchemaGetter";
import * as SchemaParser from "effect/SchemaParser";
import * as SchemaTransformation from "effect/SchemaTransformation";
import * as Tuple from "effect/Tuple";
import { RecursiveArraySizeHint } from "../internal/RecursionHint.ts";

const $I = $ScratchpadId.create("osdk/Geo/Geo.model");

// -----------------------------------------------------------------------------
// Coordinates
// -----------------------------------------------------------------------------

/**
 * East-west angle of a position in WGS 84 decimal degrees, positive east of the prime meridian.
 *
 * **Example** (Reject a longitude off the globe)
 *
 * ```ts import.meta.vitest name="Reject a longitude off the globe"
 * import * as S from "effect/Schema"
 * import { Longitude } from "@beep/scratchpad/osdk/src/Geo/index"
 *
 * const accepts = S.is(Longitude)
 * const verdicts = [accepts(-122.4194), accepts(180), accepts(180.5)]
 * verdicts // => [true, true, false]
 * ```
 *
 * @invariant The value lies in the inclusive range -180 through 180.
 * @category models
 * @since 0.0.0
 */
export const Longitude = S.Finite.check(
  S.isBetween(
    { minimum: -180, maximum: 180 },
    $I.annote("LongitudeRangeCheck", {
      title: "Longitude Range",
      description: "A longitude in decimal degrees within the inclusive range -180 through 180.",
      expected: "a longitude between -180 and 180 degrees",
      message: "Expected a longitude between -180 and 180 degrees",
    })
  )
).pipe(
  $I.annoteSchema("Longitude", {
    description: "East-west angle in WGS 84 decimal degrees, positive east of the prime meridian.",
  })
);

/**
 * Runtime type of {@link Longitude}.
 *
 * @category models
 * @since 0.0.0
 */
export type Longitude = typeof Longitude.Type;

/**
 * North-south angle of a position in WGS 84 decimal degrees, positive north of the equator.
 *
 * **Example** (Reject a latitude past the pole)
 *
 * ```ts import.meta.vitest name="Reject a latitude past the pole"
 * import * as S from "effect/Schema"
 * import { Latitude } from "@beep/scratchpad/osdk/src/Geo/index"
 *
 * const accepts = S.is(Latitude)
 * const verdicts = [accepts(37.7749), accepts(-90), accepts(90.5)]
 * verdicts // => [true, true, false]
 * ```
 *
 * @invariant The value lies in the inclusive range -90 through 90.
 * @category models
 * @since 0.0.0
 */
export const Latitude = S.Finite.check(
  S.isBetween(
    { minimum: -90, maximum: 90 },
    $I.annote("LatitudeRangeCheck", {
      title: "Latitude Range",
      description: "A latitude in decimal degrees within the inclusive range -90 through 90.",
      expected: "a latitude between -90 and 90 degrees",
      message: "Expected a latitude between -90 and 90 degrees",
    })
  )
).pipe(
  $I.annoteSchema("Latitude", {
    description: "North-south angle in WGS 84 decimal degrees, positive north of the equator.",
  })
);

/**
 * Runtime type of {@link Latitude}.
 *
 * @category models
 * @since 0.0.0
 */
export type Latitude = typeof Latitude.Type;

/**
 * Height of a position in metres above the WGS 84 ellipsoid.
 *
 * **Example** (Accept a height below the ellipsoid)
 *
 * ```ts import.meta.vitest name="Accept a height below the ellipsoid"
 * import * as S from "effect/Schema"
 * import { Altitude } from "@beep/scratchpad/osdk/src/Geo/index"
 *
 * const accepts = S.is(Altitude)
 * const verdicts = [accepts(8848.86), accepts(-430.5), accepts(Number.POSITIVE_INFINITY)]
 * verdicts // => [true, true, false]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const Altitude = S.Finite.pipe(
  $I.annoteSchema("Altitude", {
    description: "Height in metres above the WGS 84 ellipsoid; negative below it.",
  })
);

/**
 * Runtime type of {@link Altitude}.
 *
 * @category models
 * @since 0.0.0
 */
export type Altitude = typeof Altitude.Type;

// Generation follows the specification's "should not exceed three elements"; decoding follows its
// "must have two or more", so the predicate always passes.
const PositionArityHint = S.makeFilter<ReadonlyArray<unknown>>(
  () => true,
  $I.annote("PositionArityHint", {
    title: "Position Arity Hint",
    description: "Keeps derived arbitrary positions to at most three elements without constraining decoded values.",
    arbitraryConstraint: { maxLength: 3 },
  })
);

const PositionElements = S.TupleWithRest(S.Tuple([Longitude, Latitude]), [Altitude]).check(PositionArityHint);

/**
 * One location on the globe: `[longitude, latitude]`, optionally followed by an altitude.
 *
 * **Details**
 *
 * Longitude comes first, which is the opposite of how coordinates are usually
 * spoken; the `longitude`, `latitude` and `altitude` statics read a position by
 * name. A producer may append elements after the altitude. The specification
 * gives them no meaning and lets a reader ignore them, so they decode and
 * encode untouched instead of failing a whole payload.
 *
 * **Example** (Read a position by name)
 *
 * ```ts import.meta.vitest name="Read a position by name"
 * import * as O from "effect/Option"
 * import { Position } from "@beep/scratchpad/osdk/src/Geo/index"
 *
 * const summit = Position.make([86.925, 27.9881, 8848.86])
 * const ferryBuilding = Position.make([-122.3937, 37.7955])
 * const read = [
 *   Position.longitude(summit),
 *   Position.latitude(summit),
 *   O.getOrElse(Position.altitude(summit), () => 0),
 *   O.isNone(Position.altitude(ferryBuilding)),
 * ]
 * read // => [86.925, 27.9881, 8848.86, true]
 * ```
 *
 * @invariant The first element is a {@link Longitude} and the second a {@link Latitude}.
 * @category models
 * @since 0.0.0
 */
export const Position = PositionElements.pipe(
  $I.annoteSchema("Position", {
    description: "One location on the globe: longitude, then latitude, then an optional altitude in metres.",
  }),
  SchemaUtils.withStatics(() => ({
    /** East-west angle of a position: its first element. */
    longitude: (position: typeof PositionElements.Type): number => position[0],
    /** North-south angle of a position: its second element. */
    latitude: (position: typeof PositionElements.Type): number => position[1],
    /** Height of a position in metres: its third element, when present. */
    altitude: (position: typeof PositionElements.Type): O.Option<number> => A.get(position, 2),
  }))
);

/**
 * Runtime type of {@link Position}.
 *
 * @category models
 * @since 0.0.0
 */
export type Position = typeof Position.Type;

// -----------------------------------------------------------------------------
// Bounding box
// -----------------------------------------------------------------------------

// [west, south, east, north]
const FlatBoundingBox = S.Tuple([Longitude, Latitude, Longitude, Latitude]);
// [west, south, lowest, east, north, highest]
const SolidBoundingBox = S.Tuple([Longitude, Latitude, Altitude, Longitude, Latitude, Altitude]);

/**
 * Extent of a geometry: its south-west corner followed by its north-east corner.
 *
 * **Details**
 *
 * Four numbers `[west, south, east, north]` bound a flat geometry; six numbers
 * `[west, south, lowest, east, north, highest]` bound one with altitudes. A box
 * that crosses the antimeridian has `west` greater than `east`, so the two
 * longitudes are not ordered.
 *
 * The statics convert between a box and the corner pair that the platform's
 * bounding-box filters send: `topLeft` is `[west, north]`, `bottomRight` is
 * `[east, south]`, and `fromCorners` builds the flat box back from them.
 *
 * **Example** (Take the corners a bounding-box filter sends)
 *
 * ```ts import.meta.vitest name="Take the corners a bounding-box filter sends"
 * import { BoundingBox } from "@beep/scratchpad/osdk/src/Geo/index"
 *
 * const bayArea = BoundingBox.make([-122.52, 37.7, -122.35, 37.83])
 * const corners = [BoundingBox.topLeft(bayArea), BoundingBox.bottomRight(bayArea)]
 * corners // => [[-122.52, 37.83], [-122.35, 37.7]]
 * ```
 *
 * **Example** (Rebuild a box from its corners)
 *
 * ```ts import.meta.vitest name="Rebuild a box from its corners"
 * import { BoundingBox } from "@beep/scratchpad/osdk/src/Geo/index"
 *
 * const box = BoundingBox.fromCorners([-122.52, 37.83], [-122.35, 37.7])
 * box // => [-122.52, 37.7, -122.35, 37.83]
 * ```
 *
 * @invariant A box has exactly four or exactly six elements.
 * @category models
 * @since 0.0.0
 */
export const BoundingBox = S.Union([FlatBoundingBox, SolidBoundingBox]).pipe(
  $I.annoteSchema("BoundingBox", {
    description: "Extent of a geometry: its south-west corner followed by its north-east corner, in two or three axes.",
  }),
  SchemaUtils.withStatics(() => ({
    /** North-west corner `[west, north]`, the `topLeft` of a bounding-box filter. */
    topLeft: (box: typeof FlatBoundingBox.Type | typeof SolidBoundingBox.Type): Position =>
      box.length === 4 ? [box[0], box[3]] : [box[0], box[4]],
    /** South-east corner `[east, south]`, the `bottomRight` of a bounding-box filter. */
    bottomRight: (box: typeof FlatBoundingBox.Type | typeof SolidBoundingBox.Type): Position =>
      box.length === 4 ? [box[2], box[1]] : [box[3], box[1]],
    /** Flat box spanned by a north-west and a south-east corner; altitudes are dropped. */
    fromCorners: (topLeft: Position, bottomRight: Position): typeof FlatBoundingBox.Type => [
      topLeft[0],
      bottomRight[1],
      bottomRight[0],
      topLeft[1],
    ],
  }))
);

/**
 * Runtime type of {@link BoundingBox}.
 *
 * @category models
 * @since 0.0.0
 */
export type BoundingBox = typeof BoundingBox.Type;

const BoundingBoxField = S.OptionFromOptionalKey(BoundingBox).pipe(
  S.withConstructorDefault(Effect.succeedNone),
  S.annotateKey({ description: "Extent of the object, when its producer included one." })
);

// -----------------------------------------------------------------------------
// Paths and rings
// -----------------------------------------------------------------------------

/**
 * Positions of a line string: an open path of two or more positions.
 *
 * **Example** (Reject a path with a single position)
 *
 * ```ts import.meta.vitest name="Reject a path with a single position"
 * import * as S from "effect/Schema"
 * import { LineStringCoordinates } from "@beep/scratchpad/osdk/src/Geo/index"
 *
 * const accepts = S.is(LineStringCoordinates)
 * const verdicts = [accepts([[102, 0], [103, 1]]), accepts([[102, 0]])]
 * verdicts // => [true, false]
 * ```
 *
 * @invariant A path has at least two positions.
 * @category models
 * @since 0.0.0
 */
export const LineStringCoordinates = S.Array(Position)
  .check(
    S.isMinLength(
      2,
      $I.annote("LineStringSizeCheck", {
        title: "Line String Size",
        description: "A path of at least two positions.",
        expected: "at least two positions",
        message: "A line string needs at least two positions",
      })
    )
  )
  .pipe(
    $I.annoteSchema("LineStringCoordinates", {
      description: "Positions of a line string: an open path of two or more positions.",
    })
  );

/**
 * Runtime type of {@link LineStringCoordinates}.
 *
 * @category models
 * @since 0.0.0
 */
export type LineStringCoordinates = typeof LineStringCoordinates.Type;

const RingPositions = S.Array(Position);

// The constructive shape of a ring: its distinct vertices. A ring is these plus the first one again.
const RingVertices = S.TupleWithRest(S.Tuple([Position, Position, Position]), [Position]);

const positionEquivalence = S.toEquivalence(Position);

const closeRing = (vertices: typeof RingVertices.Type): ReadonlyArray<Position> => A.append(vertices, vertices[0]);

const isClosedRing = (ring: ReadonlyArray<Position>): boolean =>
  O.getOrElse(O.zipWith(A.head(ring), A.last(ring), positionEquivalence), constFalse);

const LinearRingSizeCheck = S.isMinLength(
  4,
  $I.annote("LinearRingSizeCheck", {
    title: "Linear Ring Size",
    description: "A ring of at least four positions: three vertices and the first one repeated.",
    expected: "at least four positions",
    message: "A linear ring needs at least four positions",
  })
);

const LinearRingClosedCheck = S.makeFilter(
  isClosedRing,
  $I.annote("LinearRingClosedCheck", {
    title: "Closed Linear Ring",
    description: "A ring whose last position repeats its first.",
    expected: "a ring that ends at the position it starts from",
    message: "A linear ring must end at the position it starts from",
  })
);

/**
 * Boundary of a polygon: a closed path of four or more positions whose last position repeats the first.
 *
 * **Details**
 *
 * Both rules are checks on the schema, so an open or degenerate ring never
 * reaches a filter or an edit. A random list of positions is almost never
 * closed, so the schema also tells generators how to build one: take three or
 * more vertices and repeat the first. `fromVertices` is that same construction
 * for callers, which removes the most common GeoJSON mistake (forgetting to
 * close the ring).
 *
 * The right-hand rule (exterior rings counter-clockwise, holes clockwise) is a
 * recommendation readers must not rely on, and it is not checked.
 *
 * **Example** (Close a ring from its vertices)
 *
 * ```ts import.meta.vitest name="Close a ring from its vertices"
 * import { LinearRing } from "@beep/scratchpad/osdk/src/Geo/index"
 *
 * const triangle = LinearRing.fromVertices([[0, 0], [4, 0], [0, 3]])
 * triangle // => [[0, 0], [4, 0], [0, 3], [0, 0]]
 * ```
 *
 * **Example** (Reject open and degenerate rings)
 *
 * ```ts import.meta.vitest name="Reject open and degenerate rings"
 * import * as S from "effect/Schema"
 * import { LinearRing } from "@beep/scratchpad/osdk/src/Geo/index"
 *
 * const accepts = S.is(LinearRing)
 * const verdicts = [
 *   accepts([[0, 0], [4, 0], [0, 3], [0, 0]]),
 *   accepts([[0, 0], [4, 0], [0, 3], [1, 1]]),
 *   accepts([[0, 0], [4, 0], [0, 0]]),
 * ]
 * verdicts // => [true, false, false]
 * ```
 *
 * @invariant A ring has at least four positions and its last position equals its first.
 * @category models
 * @since 0.0.0
 */
export const LinearRing = S.declareConstructor<ReadonlyArray<Position>>()(
  [RingPositions],
  ([positions]) => {
    const parse = SchemaParser.decodeUnknownEffect(positions);
    return (input, _, options) => parse(input, options);
  },
  $I.annoteClass<typeof RingPositions, readonly [typeof RingPositions]>("LinearRing", {
    expected: "an array of positions",
    toCodec: ([positions]) => S.link<ReadonlyArray<Position>>()(positions, SchemaTransformation.passthrough()),
    toCodecArbitrary: () =>
      S.link<ReadonlyArray<Position>>()(RingVertices, {
        decode: SchemaGetter.transform(closeRing),
        encode: SchemaGetter.forbiddenEncoding,
      }),
  })
)
  .check(LinearRingSizeCheck, LinearRingClosedCheck)
  .pipe(
    $I.annoteSchema("LinearRing", {
      description: "Boundary of a polygon: a closed path of four or more positions whose last repeats the first.",
    }),
    S.overrideToEquivalence(() => S.toEquivalence(RingPositions)),
    SchemaUtils.withStatics(() => ({
      /** Ring through three or more vertices, closed by repeating the first one. */
      fromVertices: closeRing,
    }))
  );

/**
 * Runtime type of {@link LinearRing}.
 *
 * @category models
 * @since 0.0.0
 */
export type LinearRing = typeof LinearRing.Type;

// -----------------------------------------------------------------------------
// Geometry
// -----------------------------------------------------------------------------

/**
 * Every `type` tag a GeoJSON object can carry.
 *
 * **Example** (Split the tags into geometries and the rest)
 *
 * ```ts import.meta.vitest name="Split the tags into geometries and the rest"
 * import { GeoJsonKind, GeometryKind } from "@beep/scratchpad/osdk/src/Geo/index"
 *
 * const sizes = [GeoJsonKind.literals.length, GeometryKind.literals.length]
 * sizes // => [9, 7]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const GeoJsonKind = LiteralKit([
  "Point",
  "MultiPoint",
  "LineString",
  "MultiLineString",
  "Polygon",
  "MultiPolygon",
  "GeometryCollection",
  "Feature",
  "FeatureCollection",
]).pipe(
  $I.annoteSchema("GeoJsonKind", {
    description: "Every type tag a GeoJSON object can carry: the seven geometries, a feature and a feature collection.",
  })
);

/**
 * Runtime type of {@link GeoJsonKind}.
 *
 * @category models
 * @since 0.0.0
 */
export type GeoJsonKind = typeof GeoJsonKind.Type;

/**
 * The `type` tags that name a geometry: every GeoJSON tag except the two feature tags.
 *
 * **Example** (Tell a geometry tag from a feature tag)
 *
 * ```ts import.meta.vitest name="Tell a geometry tag from a feature tag"
 * import * as S from "effect/Schema"
 * import { GeometryKind } from "@beep/scratchpad/osdk/src/Geo/index"
 *
 * const isGeometryKind = S.is(GeometryKind)
 * const verdicts = [isGeometryKind("Polygon"), isGeometryKind("Feature")]
 * verdicts // => [true, false]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const GeometryKind = GeoJsonKind.pick([
  "Point",
  "MultiPoint",
  "LineString",
  "MultiLineString",
  "Polygon",
  "MultiPolygon",
  "GeometryCollection",
]).pipe(
  $I.annoteSchema("GeometryKind", {
    description: "Type tags that name a geometry: every GeoJSON tag except the two feature tags.",
  })
);

/**
 * Runtime type of {@link GeometryKind}.
 *
 * @category models
 * @since 0.0.0
 */
export type GeometryKind = typeof GeometryKind.Type;

/**
 * A single position on the globe; the value of a geopoint property.
 *
 * @category models
 * @since 0.0.0
 */
export class GeoPoint extends S.Opaque<GeoPoint, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("Point"),
    coordinates: Position.annotateKey({ description: "Where the point is." }),
    bbox: BoundingBoxField,
  }).pipe($I.annoteSchema("GeoPoint", { description: "A single position on the globe." }))
) {}

/**
 * A set of unconnected positions.
 *
 * @category models
 * @since 0.0.0
 */
export class MultiPoint extends S.Opaque<MultiPoint, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("MultiPoint"),
    coordinates: S.Array(Position).annotateKey({ description: "The positions, in no particular order." }),
    bbox: BoundingBoxField,
  }).pipe($I.annoteSchema("MultiPoint", { description: "A set of unconnected positions." }))
) {}

/**
 * An open path through two or more positions.
 *
 * **Details**
 *
 * This is the only geometry whose `coordinates` the wire contract lets a
 * producer omit, so the field is an `Option` here and nowhere else.
 *
 * @category models
 * @since 0.0.0
 */
export class LineString extends S.Opaque<LineString, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("LineString"),
    coordinates: S.OptionFromOptionalKey(LineStringCoordinates).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "The path, in travel order; absent when the producer sent none." })
    ),
    bbox: BoundingBoxField,
  }).pipe($I.annoteSchema("LineString", { description: "An open path through two or more positions." }))
) {}

/**
 * A set of open paths.
 *
 * @category models
 * @since 0.0.0
 */
export class MultiLineString extends S.Opaque<MultiLineString, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("MultiLineString"),
    coordinates: S.Array(LineStringCoordinates).annotateKey({ description: "One path per line string." }),
    bbox: BoundingBoxField,
  }).pipe($I.annoteSchema("MultiLineString", { description: "A set of open paths." }))
) {}

const PolygonRings = S.Array(LinearRing);

/**
 * An area bounded by one exterior ring and any number of holes.
 *
 * @category models
 * @since 0.0.0
 */
export class Polygon extends S.Opaque<Polygon, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("Polygon"),
    coordinates: PolygonRings.annotateKey({
      description: "The exterior ring first, then one ring per hole.",
    }),
    bbox: BoundingBoxField,
  }).pipe(
    $I.annoteSchema("Polygon", { description: "An area bounded by one exterior ring and any number of holes." })
  )
) {}

/**
 * A set of polygons.
 *
 * @category models
 * @since 0.0.0
 */
export class MultiPolygon extends S.Opaque<MultiPolygon, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("MultiPolygon"),
    coordinates: S.Array(PolygonRings).annotateKey({
      description: "One list of rings per polygon: its exterior ring first, then its holes.",
    }),
    bbox: BoundingBoxField,
  }).pipe($I.annoteSchema("MultiPolygon", { description: "A set of polygons." }))
) {}

const GeometryMember = S.suspend((): S.Codec<Geometry.Type, Geometry.Encoded> => Geometry);

/**
 * A heterogeneous set of geometries, which may itself contain collections.
 *
 * **Details**
 *
 * The specification advises against nesting collections and against using one
 * where a single multi-part geometry would do, but both are valid and decode.
 *
 * @category models
 * @since 0.0.0
 */
export class GeometryCollection extends S.Opaque<GeometryCollection, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("GeometryCollection"),
    geometries: S.Array(GeometryMember)
      .check(RecursiveArraySizeHint)
      .annotateKey({ description: "The member geometries, of any kind." }),
    bbox: BoundingBoxField,
  }).pipe(
    $I.annoteSchema("GeometryCollection", {
      description: "A heterogeneous set of geometries, which may itself contain collections.",
    })
  )
) {}

/**
 * Companion namespace of {@link GeometryCollection}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace GeometryCollection {
  /**
   * Wire form of {@link GeometryCollection}, written out because the collection contains geometries recursively.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "GeometryCollection";
    readonly geometries: ReadonlyArray<Geometry.Encoded>;
    readonly bbox?: typeof BoundingBox.Encoded;
  }
}

/**
 * Any GeoJSON geometry: a shape on the globe without attached properties.
 *
 * **Example** (Branch on the kind of geometry)
 *
 * ```ts import.meta.vitest name="Branch on the kind of geometry"
 * import { Geometry, LinearRing, Polygon } from "@beep/scratchpad/osdk/src/Geo/index"
 *
 * const dimension = Geometry.match({
 *   Point: () => "position",
 *   MultiPoint: () => "position",
 *   LineString: () => "path",
 *   MultiLineString: () => "path",
 *   Polygon: () => "area",
 *   MultiPolygon: () => "area",
 *   GeometryCollection: () => "mixed",
 * })
 * const triangle = Polygon.make({ coordinates: [LinearRing.fromVertices([[0, 0], [4, 0], [0, 3]])] })
 * dimension(triangle) // => "area"
 * ```
 *
 * **Example** (Decode a wire geometry)
 *
 * ```ts import.meta.vitest name="Decode a wire geometry"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { Geometry } from "@beep/scratchpad/osdk/src/Geo/index"
 *
 * const geometry = await Effect.runPromise(
 *   S.decodeUnknownEffect(Geometry)({ type: "Point", coordinates: [-122.4194, 37.7749] })
 * )
 * Geometry.guards.Point(geometry) // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const Geometry = GeometryKind.mapMembers(() =>
  Tuple.make(GeoPoint, MultiPoint, LineString, MultiLineString, Polygon, MultiPolygon, GeometryCollection)
).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("Geometry", {
    description: "Any GeoJSON geometry: a shape on the globe without attached properties.",
  })
);

/**
 * Runtime type of {@link Geometry}.
 *
 * @category models
 * @since 0.0.0
 */
export type Geometry = Geometry.Type;

/**
 * Decoded and wire forms of {@link Geometry}, written out because geometry collections make the union recursive.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace Geometry {
  /**
   * A decoded geometry of any kind.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = GeoPoint | MultiPoint | LineString | MultiLineString | Polygon | MultiPolygon | GeometryCollection;
  /**
   * A geometry of any kind as GeoJSON.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded =
    | typeof GeoPoint.Encoded
    | typeof MultiPoint.Encoded
    | typeof LineString.Encoded
    | typeof MultiLineString.Encoded
    | typeof Polygon.Encoded
    | typeof MultiPolygon.Encoded
    | GeometryCollection.Encoded;
}

// -----------------------------------------------------------------------------
// Features
// -----------------------------------------------------------------------------

/**
 * A geometry with free-form properties attached: one spatially located thing.
 *
 * **Details**
 *
 * `properties` and `id` are whatever JSON the producer chose; the wire contract
 * does not constrain either. A feature without a location omits `geometry`.
 *
 * @category models
 * @since 0.0.0
 */
export class Feature extends S.Opaque<Feature, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("Feature"),
    geometry: S.OptionFromOptionalKey(Geometry).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Where the feature is, absent for a feature without a location." })
    ),
    properties: S.JsonObject.pipe(
      S.withConstructorDefault(Effect.succeed({})),
      S.annotateKey({ description: "Free-form attributes of the feature, by name." })
    ),
    id: S.OptionFromOptionalKey(S.Json).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Identifier the producer commonly uses for the feature, when it has one." })
    ),
    bbox: BoundingBoxField,
  }).pipe(
    $I.annoteSchema("Feature", {
      description: "A geometry with free-form properties attached: one spatially located thing.",
    })
  )
) {}

/**
 * A list of features.
 *
 * @category models
 * @since 0.0.0
 */
export class FeatureCollection extends S.Opaque<FeatureCollection, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("FeatureCollection"),
    features: S.Array(Feature).annotateKey({ description: "The features, in the producer's order." }),
    bbox: BoundingBoxField,
  }).pipe($I.annoteSchema("FeatureCollection", { description: "A list of features." }))
) {}

/**
 * Any GeoJSON object: a geometry, a feature or a feature collection; the value of a geoshape property.
 *
 * **Example** (Encode a feature to GeoJSON)
 *
 * ```ts import.meta.vitest name="Encode a feature to GeoJSON"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { Feature, GeoJsonObject, GeoPoint } from "@beep/scratchpad/osdk/src/Geo/index"
 *
 * const pier = Feature.make({
 *   geometry: O.some(GeoPoint.make({ coordinates: [-122.4, 37.8] })),
 *   properties: { pier: 1 },
 * })
 * const wire = await Effect.runPromise(S.encodeEffect(GeoJsonObject)(pier))
 * wire // => { type: "Feature", geometry: { type: "Point", coordinates: [-122.4, 37.8] }, properties: { pier: 1 } }
 * ```
 *
 * **Example** (Separate features from bare geometries)
 *
 * ```ts import.meta.vitest name="Separate features from bare geometries"
 * import { FeatureCollection, GeoJsonObject, GeoPoint } from "@beep/scratchpad/osdk/src/Geo/index"
 *
 * const carriesProperties = GeoJsonObject.isAnyOf(["Feature", "FeatureCollection"])
 * const verdicts = [
 *   carriesProperties(FeatureCollection.make({ features: [] })),
 *   carriesProperties(GeoPoint.make({ coordinates: [0, 0] })),
 * ]
 * verdicts // => [true, false]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const GeoJsonObject = GeoJsonKind.mapMembers(() =>
  Tuple.make(
    GeoPoint,
    MultiPoint,
    LineString,
    MultiLineString,
    Polygon,
    MultiPolygon,
    GeometryCollection,
    Feature,
    FeatureCollection
  )
).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("GeoJsonObject", {
    description: "Any GeoJSON object: a geometry, a feature or a feature collection.",
  })
);

/**
 * Runtime type of {@link GeoJsonObject}.
 *
 * @category models
 * @since 0.0.0
 */
export type GeoJsonObject = typeof GeoJsonObject.Type;

// -----------------------------------------------------------------------------
// Distance
// -----------------------------------------------------------------------------

/**
 * Unit of a {@link Distance}, decoded from the wire's upper-case enum.
 *
 * **Example** (Decode a wire unit)
 *
 * ```ts import.meta.vitest name="Decode a wire unit"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { DistanceUnit } from "@beep/scratchpad/osdk/src/Geo/index"
 *
 * const unit = await Effect.runPromise(S.decodeUnknownEffect(DistanceUnit)("NAUTICAL_MILES"))
 * unit // => "nauticalMiles"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const DistanceUnit = MappedLiteralKit([
  ["MILLIMETERS", "millimeters"],
  ["CENTIMETERS", "centimeters"],
  ["METERS", "meters"],
  ["KILOMETERS", "kilometers"],
  ["INCHES", "inches"],
  ["FEET", "feet"],
  ["YARDS", "yards"],
  ["MILES", "miles"],
  ["NAUTICAL_MILES", "nauticalMiles"],
]).pipe(
  $I.annoteSchema("DistanceUnit", {
    description: "Unit of length a distance is expressed in: metric, imperial or nautical.",
  })
);

/**
 * Runtime type of {@link DistanceUnit}.
 *
 * @category models
 * @since 0.0.0
 */
export type DistanceUnit = typeof DistanceUnit.Type;

/**
 * A length with its unit: the radius of a "within distance of" filter.
 *
 * **Example** (Build a distance and encode it for the wire)
 *
 * ```ts import.meta.vitest name="Build a distance and encode it for the wire"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { Distance } from "@beep/scratchpad/osdk/src/Geo/index"
 *
 * const radius = Distance.kilometers(5)
 * const wire = await Effect.runPromise(S.encodeEffect(Distance)(radius))
 * wire // => { value: 5, unit: "KILOMETERS" }
 * ```
 *
 * @invariant `value` is zero or greater.
 * @category models
 * @since 0.0.0
 */
export class Distance extends S.Opaque<Distance, { readonly brand: unique symbol }>()(
  S.Struct({
    value: S.Finite.check(
      S.isGreaterThanOrEqualTo(
        0,
        $I.annote("DistanceValueCheck", {
          title: "Distance Value",
          description: "A length of zero or more units.",
          expected: "a length of zero or more",
          message: "A distance cannot be negative",
        })
      )
    ).annotateKey({ description: "How many units long the distance is." }),
    unit: DistanceUnit.annotateKey({ description: "Unit the value is expressed in." }),
  }).pipe(
    $I.annoteSchema("Distance", {
      description: "A non-negative length with its unit, as used by distance filters.",
    })
  )
) {
  /**
   * Builds a distance from a value and the unit it is expressed in.
   *
   * **Example** (Build a distance in a chosen unit)
   *
   * ```ts import.meta.vitest name="Build a distance in a chosen unit"
   * import { Distance } from "@beep/scratchpad/osdk/src/Geo/index"
   *
   * const leg = Distance.of(12.5, "nauticalMiles")
   * const parts = [leg.value, leg.unit]
   * parts // => [12.5, "nauticalMiles"]
   * ```
   *
   * @throws When `value` is negative or not finite.
   * @category constructors
   * @since 0.0.0
   */
  static of(value: number, unit: DistanceUnit): Distance {
    return Distance.make({ value, unit });
  }

  /**
   * Builds a distance in millimetres.
   *
   * @category constructors
   * @since 0.0.0
   */
  static millimeters(value: number): Distance {
    return Distance.of(value, "millimeters");
  }

  /**
   * Builds a distance in centimetres.
   *
   * @category constructors
   * @since 0.0.0
   */
  static centimeters(value: number): Distance {
    return Distance.of(value, "centimeters");
  }

  /**
   * Builds a distance in metres.
   *
   * @category constructors
   * @since 0.0.0
   */
  static meters(value: number): Distance {
    return Distance.of(value, "meters");
  }

  /**
   * Builds a distance in kilometres.
   *
   * @category constructors
   * @since 0.0.0
   */
  static kilometers(value: number): Distance {
    return Distance.of(value, "kilometers");
  }

  /**
   * Builds a distance in inches.
   *
   * @category constructors
   * @since 0.0.0
   */
  static inches(value: number): Distance {
    return Distance.of(value, "inches");
  }

  /**
   * Builds a distance in feet.
   *
   * @category constructors
   * @since 0.0.0
   */
  static feet(value: number): Distance {
    return Distance.of(value, "feet");
  }

  /**
   * Builds a distance in yards.
   *
   * @category constructors
   * @since 0.0.0
   */
  static yards(value: number): Distance {
    return Distance.of(value, "yards");
  }

  /**
   * Builds a distance in statute miles.
   *
   * @category constructors
   * @since 0.0.0
   */
  static miles(value: number): Distance {
    return Distance.of(value, "miles");
  }

  /**
   * Builds a distance in nautical miles.
   *
   * @category constructors
   * @since 0.0.0
   */
  static nauticalMiles(value: number): Distance {
    return Distance.of(value, "nauticalMiles");
  }
}
