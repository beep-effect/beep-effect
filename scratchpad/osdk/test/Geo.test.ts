import { fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import {
  Altitude,
  BoundingBox,
  Distance,
  DistanceUnit,
  Feature,
  FeatureCollection,
  GeoJsonKind,
  GeoJsonObject,
  Geometry,
  GeometryCollection,
  GeometryKind,
  GeoPoint,
  Latitude,
  LinearRing,
  LineString,
  LineStringCoordinates,
  Longitude,
  MultiLineString,
  MultiPoint,
  MultiPolygon,
  Polygon,
  Position,
} from "../src/Geo/index.ts";

// -----------------------------------------------------------------------------
// Law helpers
// -----------------------------------------------------------------------------

/** Registers the two derived laws every named schema must satisfy. */
const laws = <Schema extends S.Codec<unknown>>(name: string, schema: Schema): void => {
  const arbitrary = Arbitrary.schema(schema);
  const isValue = S.is(schema);
  const equivalent = S.toEquivalence(schema);
  const encode = S.encodeUnknownEffect(schema);
  const decode = S.decodeUnknownEffect(schema);

  it.prop(`${name}: generated values satisfy the schema guard`, [arbitrary], ([value]) => isValue(value), {
    arbitrary: fcRuns(50),
  });

  it.effect.prop(
    `${name}: encoding then decoding returns an equivalent value`,
    [arbitrary],
    Effect.fnUntraced(function* ([value]) {
      const encoded = yield* encode(value);
      const decoded = yield* decode(encoded);
      expect(equivalent(decoded, value)).toBe(true);
    }),
    { arbitrary: fcRuns(50) }
  );
};

/** Decodes an exact wire value, compares the domain value, encodes it back and compares the wire value. */
const expectWireRoundTrip = Effect.fnUntraced(function* <Schema extends S.Codec<unknown>>(
  schema: Schema,
  wire: Schema["Encoded"],
  domain: Schema["Type"]
) {
  const decoded = yield* S.decodeEffect(schema)(wire);
  expect(decoded).toEqual(domain);
  const encoded = yield* S.encodeEffect(schema)(decoded);
  expect(encoded).toEqual(wire);
});

const rejects =
  <Schema extends S.Codec<unknown>>(schema: Schema) =>
  (input: unknown): boolean =>
    Result.isFailure(S.decodeUnknownResult(schema)(input));

const failureMessage = <Schema extends S.Codec<unknown>>(schema: Schema, input: unknown) =>
  Effect.map(Effect.flip(S.decodeUnknownEffect(schema)(input)), (error) => error.message);

const isPosition = S.is(Position);
const isBoundingBox = S.is(BoundingBox);
const isLinearRing = S.is(LinearRing);

// -----------------------------------------------------------------------------
// Shared values
// -----------------------------------------------------------------------------

const triangle = LinearRing.fromVertices([
  [100, 0],
  [101, 0],
  [100, 1],
]);

const origin = GeoPoint.make({ coordinates: [0, 0] });

// -----------------------------------------------------------------------------
// (a) + (b) Derived laws
// -----------------------------------------------------------------------------

describe("Geo derived laws", () => {
  laws("Longitude", Longitude);
  laws("Latitude", Latitude);
  laws("Altitude", Altitude);
  laws("Position", Position);
  laws("BoundingBox", BoundingBox);
  laws("LineStringCoordinates", LineStringCoordinates);
  laws("LinearRing", LinearRing);
  laws("GeoJsonKind", GeoJsonKind);
  laws("GeometryKind", GeometryKind);
  laws("GeoPoint", GeoPoint);
  laws("MultiPoint", MultiPoint);
  laws("LineString", LineString);
  laws("MultiLineString", MultiLineString);
  laws("Polygon", Polygon);
  laws("MultiPolygon", MultiPolygon);
  laws("GeometryCollection", GeometryCollection);
  laws("Geometry", Geometry);
  laws("Feature", Feature);
  laws("FeatureCollection", FeatureCollection);
  laws("GeoJsonObject", GeoJsonObject);
  laws("DistanceUnit", DistanceUnit);
  laws("Distance", Distance);

  it.prop(
    "generated positions keep to two or three elements",
    [Arbitrary.schema(Position)],
    ([position]) => A.length(position) === 2 || A.length(position) === 3,
    { arbitrary: fcRuns(50) }
  );

  it.prop(
    "generated rings are closed by construction, not by luck",
    [Arbitrary.schema(LinearRing)],
    ([ring]) => {
      expect(A.length(ring)).toBeGreaterThanOrEqual(4);
      expect(A.last(ring)).toEqual(A.head(ring));
    },
    { arbitrary: fcRuns(50) }
  );
});

// -----------------------------------------------------------------------------
// (c) Exact wire fixtures
// -----------------------------------------------------------------------------

describe("Geo wire fixtures", () => {
  it.effect(
    "property values: the documented geopoint and geoshape examples",
    Effect.fnUntraced(function* () {
      yield* expectWireRoundTrip(
        GeoPoint,
        { type: "Point", coordinates: [102, 0.5] },
        GeoPoint.make({ coordinates: [102, 0.5] })
      );
      yield* expectWireRoundTrip(
        GeoJsonObject,
        {
          type: "LineString",
          coordinates: [
            [102, 0],
            [103, 1],
          ],
        },
        LineString.make({
          coordinates: O.some(
            LineStringCoordinates.make([
              [102, 0],
              [103, 1],
            ])
          ),
        })
      );
    })
  );

  it.effect(
    "Position: longitude, latitude and an optional altitude",
    Effect.fnUntraced(function* () {
      yield* expectWireRoundTrip(Position, [102, 0.5], [102, 0.5]);
      yield* expectWireRoundTrip(Position, [86.925, 27.9881, 8848.86], [86.925, 27.9881, 8848.86]);
      const summit = yield* S.decodeEffect(Position)([86.925, 27.9881, 8848.86]);
      expect(Position.longitude(summit)).toBe(86.925);
      expect(Position.latitude(summit)).toBe(27.9881);
      expect(Position.altitude(summit)).toEqual(O.some(8848.86));
      expect(Position.altitude(Position.make([102, 0.5]))).toEqual(O.none());
    })
  );

  it.effect(
    "Position: elements after the altitude are carried through untouched",
    Effect.fnUntraced(function* () {
      yield* expectWireRoundTrip(Position, [102, 0.5, 30, 1_600_000_000], [102, 0.5, 30, 1_600_000_000]);
    })
  );

  it.effect(
    "BoundingBox: four numbers for a flat extent, six with altitudes",
    Effect.fnUntraced(function* () {
      yield* expectWireRoundTrip(BoundingBox, [-122.52, 37.7, -122.35, 37.83], [-122.52, 37.7, -122.35, 37.83]);
      yield* expectWireRoundTrip(BoundingBox, [100, 0, -100, 105, 1, 0], [100, 0, -100, 105, 1, 0]);
    })
  );

  it.effect(
    "Point: the tag is PascalCase and an absent bbox is none",
    Effect.fnUntraced(function* () {
      const wire: typeof GeoPoint.Encoded = { type: "Point", coordinates: [-122.4194, 37.7749] };
      yield* expectWireRoundTrip(GeoPoint, wire, GeoPoint.make({ coordinates: [-122.4194, 37.7749] }));
      const point = yield* S.decodeEffect(GeoPoint)(wire);
      expect(point.type).toBe("Point");
      expect(O.isNone(point.bbox)).toBe(true);
    })
  );

  it.effect(
    "MultiPoint: positions with a bbox",
    Effect.fnUntraced(function* () {
      yield* expectWireRoundTrip(
        MultiPoint,
        {
          type: "MultiPoint",
          coordinates: [
            [100, 0],
            [101, 1],
          ],
          bbox: [100, 0, 101, 1],
        },
        MultiPoint.make({
          coordinates: [
            [100, 0],
            [101, 1],
          ],
          bbox: O.some(BoundingBox.make([100, 0, 101, 1])),
        })
      );
    })
  );

  it.effect(
    "LineString: coordinates may be absent on the wire",
    Effect.fnUntraced(function* () {
      yield* expectWireRoundTrip(
        LineString,
        {
          type: "LineString",
          coordinates: [
            [100, 0],
            [101, 1],
          ],
        },
        LineString.make({
          coordinates: O.some(
            LineStringCoordinates.make([
              [100, 0],
              [101, 1],
            ])
          ),
        })
      );
      yield* expectWireRoundTrip(LineString, { type: "LineString" }, LineString.make({}));
    })
  );

  it.effect(
    "MultiLineString: one path per line string",
    Effect.fnUntraced(function* () {
      yield* expectWireRoundTrip(
        MultiLineString,
        {
          type: "MultiLineString",
          coordinates: [
            [
              [100, 0],
              [101, 1],
            ],
            [
              [102, 2],
              [103, 3],
            ],
          ],
        },
        MultiLineString.make({
          coordinates: [
            [
              [100, 0],
              [101, 1],
            ],
            [
              [102, 2],
              [103, 3],
            ],
          ],
        })
      );
    })
  );

  it.effect(
    "Polygon: the value of a withinPolygon filter, exterior ring then a hole",
    Effect.fnUntraced(function* () {
      const exterior = LinearRing.fromVertices([
        [100, 0],
        [101, 0],
        [101, 1],
        [100, 1],
      ]);
      const hole = LinearRing.fromVertices([
        [100.8, 0.8],
        [100.8, 0.2],
        [100.2, 0.2],
        [100.2, 0.8],
      ]);
      yield* expectWireRoundTrip(
        Polygon,
        {
          type: "Polygon",
          coordinates: [
            [
              [100, 0],
              [101, 0],
              [101, 1],
              [100, 1],
              [100, 0],
            ],
            [
              [100.8, 0.8],
              [100.8, 0.2],
              [100.2, 0.2],
              [100.2, 0.8],
              [100.8, 0.8],
            ],
          ],
        },
        Polygon.make({ coordinates: [exterior, hole] })
      );
    })
  );

  it.effect(
    "MultiPolygon: one list of rings per polygon",
    Effect.fnUntraced(function* () {
      yield* expectWireRoundTrip(
        MultiPolygon,
        {
          type: "MultiPolygon",
          coordinates: [
            [
              [
                [100, 0],
                [101, 0],
                [100, 1],
                [100, 0],
              ],
            ],
          ],
        },
        MultiPolygon.make({ coordinates: [[triangle]] })
      );
    })
  );

  it.effect(
    "GeometryCollection: nested collections decode recursively",
    Effect.fnUntraced(function* () {
      const wire: GeometryCollection.Encoded = {
        type: "GeometryCollection",
        geometries: [
          { type: "Point", coordinates: [100, 0] },
          {
            type: "LineString",
            coordinates: [
              [101, 0],
              [102, 1],
            ],
          },
          { type: "GeometryCollection", geometries: [{ type: "Point", coordinates: [0, 0] }] },
        ],
      };
      const collection = yield* S.decodeEffect(GeometryCollection)(wire);
      expect(collection).toEqual(
        GeometryCollection.make({
          geometries: [
            GeoPoint.make({ coordinates: [100, 0] }),
            LineString.make({
              coordinates: O.some(
                LineStringCoordinates.make([
                  [101, 0],
                  [102, 1],
                ])
              ),
            }),
            GeometryCollection.make({ geometries: [origin] }),
          ],
        })
      );
      expect(A.map(collection.geometries, (geometry) => geometry.type)).toEqual([
        "Point",
        "LineString",
        "GeometryCollection",
      ]);
      const encoded = yield* S.encodeEffect(GeometryCollection)(collection);
      expect(encoded).toEqual(wire);
    })
  );

  it.effect(
    "Feature: geometry, free-form properties, id and bbox",
    Effect.fnUntraced(function* () {
      yield* expectWireRoundTrip(
        Feature,
        {
          type: "Feature",
          id: "ferry-building",
          geometry: { type: "Point", coordinates: [-122.3937, 37.7955] },
          properties: { name: "Ferry Building", floors: 3, open: true, tags: ["landmark", "terminal"], owner: null },
          bbox: [-122.3941, 37.7951, -122.3933, 37.7959],
        },
        Feature.make({
          id: O.some("ferry-building"),
          geometry: O.some(GeoPoint.make({ coordinates: [-122.3937, 37.7955] })),
          properties: { name: "Ferry Building", floors: 3, open: true, tags: ["landmark", "terminal"], owner: null },
          bbox: O.some(BoundingBox.make([-122.3941, 37.7951, -122.3933, 37.7959])),
        })
      );
    })
  );

  it.effect(
    "Feature: a feature without a location omits geometry",
    Effect.fnUntraced(function* () {
      yield* expectWireRoundTrip(
        Feature,
        { type: "Feature", id: 7, properties: {} },
        Feature.make({ id: O.some(7) })
      );
    })
  );

  it.effect(
    "FeatureCollection: features keep their order",
    Effect.fnUntraced(function* () {
      yield* expectWireRoundTrip(
        FeatureCollection,
        {
          type: "FeatureCollection",
          features: [
            { type: "Feature", geometry: { type: "Point", coordinates: [102, 0.5] }, properties: { prop0: "value0" } },
            { type: "Feature", properties: { prop0: "value1" } },
          ],
          bbox: [100, 0, 105, 1],
        },
        FeatureCollection.make({
          features: [
            Feature.make({
              geometry: O.some(GeoPoint.make({ coordinates: [102, 0.5] })),
              properties: { prop0: "value0" },
            }),
            Feature.make({ properties: { prop0: "value1" } }),
          ],
          bbox: O.some(BoundingBox.make([100, 0, 105, 1])),
        })
      );
    })
  );

  it.effect(
    "GeoJsonObject and Geometry decode the same geometry to the same member",
    Effect.fnUntraced(function* () {
      const wire: typeof GeoPoint.Encoded = { type: "Point", coordinates: [-122.4194, 37.7749] };
      const asObject = yield* S.decodeEffect(GeoJsonObject)(wire);
      const asGeometry = yield* S.decodeEffect(Geometry)(wire);
      expect(asObject).toEqual(asGeometry);
      expect(GeoJsonObject.guards.Point(asObject)).toBe(true);
      const encoded = yield* S.encodeEffect(GeoJsonObject)(asObject);
      expect(encoded).toEqual(wire);
    })
  );

  it.effect(
    "DistanceUnit: every wire unit maps to its lower-camel plural",
    Effect.fnUntraced(function* () {
      const wireUnits: ReadonlyArray<typeof DistanceUnit.Encoded> = [
        "MILLIMETERS",
        "CENTIMETERS",
        "METERS",
        "KILOMETERS",
        "INCHES",
        "FEET",
        "YARDS",
        "MILES",
        "NAUTICAL_MILES",
      ];
      const units = yield* Effect.forEach(wireUnits, (unit) => S.decodeEffect(DistanceUnit)(unit));
      expect(units).toEqual([
        "millimeters",
        "centimeters",
        "meters",
        "kilometers",
        "inches",
        "feet",
        "yards",
        "miles",
        "nauticalMiles",
      ]);
      const encoded = yield* Effect.forEach(units, (unit) => S.encodeEffect(DistanceUnit)(unit));
      expect(encoded).toEqual(wireUnits);
      expect(A.map(DistanceUnit.Pairs, ([wire]) => wire)).toEqual(wireUnits);
    })
  );

  it.effect(
    "Distance: a value and a wire unit",
    Effect.fnUntraced(function* () {
      yield* expectWireRoundTrip(Distance, { value: 5, unit: "KILOMETERS" }, Distance.kilometers(5));
      yield* expectWireRoundTrip(Distance, { value: 0, unit: "NAUTICAL_MILES" }, Distance.of(0, "nauticalMiles"));
    })
  );

  it.effect(
    "withinBoundingBox value: corner points derived from a bounding box",
    Effect.fnUntraced(function* () {
      const box = BoundingBox.make([-122.52, 37.7, -122.35, 37.83]);
      const topLeft = yield* S.encodeEffect(GeoPoint)(GeoPoint.make({ coordinates: BoundingBox.topLeft(box) }));
      const bottomRight = yield* S.encodeEffect(GeoPoint)(
        GeoPoint.make({ coordinates: BoundingBox.bottomRight(box) })
      );
      expect({ topLeft, bottomRight }).toEqual({
        topLeft: { type: "Point", coordinates: [-122.52, 37.83] },
        bottomRight: { type: "Point", coordinates: [-122.35, 37.7] },
      });
    })
  );

  it.effect(
    "withinDistanceOf value: a center point and a distance",
    Effect.fnUntraced(function* () {
      const CenterPoint = S.Struct({ center: GeoPoint, distance: Distance });
      yield* expectWireRoundTrip(
        CenterPoint,
        {
          center: { type: "Point", coordinates: [-122.4194, 37.7749] },
          distance: { value: 5, unit: "KILOMETERS" },
        },
        {
          center: GeoPoint.make({ coordinates: [-122.4194, 37.7749] }),
          distance: Distance.of(5, "kilometers"),
        }
      );
    })
  );
});

// -----------------------------------------------------------------------------
// Constructor defaults, decoding and encoded output
// -----------------------------------------------------------------------------

describe("Geo constructors", () => {
  it("fills the tag and leaves optional members empty", () => {
    expect(origin.type).toBe("Point");
    expect(origin.bbox).toEqual(O.none());
    expect(LineString.make({}).coordinates).toEqual(O.none());
    const feature = Feature.make({});
    expect(feature.geometry).toEqual(O.none());
    expect(feature.id).toEqual(O.none());
    expect(feature.properties).toEqual({});
  });

  it.effect(
    "encodes absent members as absent keys",
    Effect.fnUntraced(function* () {
      const point = yield* S.encodeEffect(GeoPoint)(origin);
      expect(point).toEqual({ type: "Point", coordinates: [0, 0] });
      const feature = yield* S.encodeEffect(Feature)(Feature.make({}));
      expect(feature).toEqual({ type: "Feature", properties: {} });
    })
  );

  it("does not default properties when decoding", () => {
    expect(rejects(Feature)({ type: "Feature" })).toBe(true);
  });

  it("builds a distance per unit", () => {
    const built = [
      Distance.millimeters(1),
      Distance.centimeters(1),
      Distance.meters(1),
      Distance.kilometers(1),
      Distance.inches(1),
      Distance.feet(1),
      Distance.yards(1),
      Distance.miles(1),
      Distance.nauticalMiles(1),
    ];
    expect(A.map(built, (distance) => distance.unit)).toEqual(A.map(DistanceUnit.Pairs, ([, unit]) => unit));
    expect(A.every(built, (distance) => distance.value === 1)).toBe(true);
    expect(Distance.of(2.5, "miles")).toEqual(Distance.miles(2.5));
  });

  it("refuses to build a negative distance", () => {
    expect(() => Distance.meters(-1)).toThrow();
  });
});

// -----------------------------------------------------------------------------
// Helpers on bounding boxes and rings
// -----------------------------------------------------------------------------

describe("Geo helpers", () => {
  it("takes the corners of a flat box", () => {
    const box = BoundingBox.make([-122.52, 37.7, -122.35, 37.83]);
    expect(BoundingBox.topLeft(box)).toEqual([-122.52, 37.83]);
    expect(BoundingBox.bottomRight(box)).toEqual([-122.35, 37.7]);
  });

  it("takes the corners of a box with altitudes and drops the altitudes", () => {
    const box = BoundingBox.make([100, 0, -100, 105, 1, 250]);
    expect(BoundingBox.topLeft(box)).toEqual([100, 1]);
    expect(BoundingBox.bottomRight(box)).toEqual([105, 0]);
  });

  it("rebuilds a flat box from its corners", () => {
    expect(BoundingBox.fromCorners([-122.52, 37.83], [-122.35, 37.7])).toEqual([-122.52, 37.7, -122.35, 37.83]);
  });

  it.prop(
    "corners of any box are valid positions that rebuild its flat extent",
    [Arbitrary.schema(BoundingBox)],
    ([box]) => {
      const topLeft = BoundingBox.topLeft(box);
      const bottomRight = BoundingBox.bottomRight(box);
      expect(isPosition(topLeft)).toBe(true);
      expect(isPosition(bottomRight)).toBe(true);
      const flat = BoundingBox.fromCorners(topLeft, bottomRight);
      expect(isBoundingBox(flat)).toBe(true);
      expect(BoundingBox.topLeft(flat)).toEqual(topLeft);
      expect(BoundingBox.bottomRight(flat)).toEqual(bottomRight);
    },
    { arbitrary: fcRuns(50) }
  );

  it("closes a ring by repeating its first vertex", () => {
    expect(triangle).toEqual([
      [100, 0],
      [101, 0],
      [100, 1],
      [100, 0],
    ]);
    expect(isLinearRing(triangle)).toBe(true);
  });

  it.prop(
    "any three or more vertices close into a valid ring",
    [Arbitrary.schema(S.TupleWithRest(S.Tuple([Position, Position, Position]), [Position]))],
    ([vertices]) => {
      const ring = LinearRing.fromVertices(vertices);
      expect(isLinearRing(ring)).toBe(true);
      expect(A.length(ring)).toBe(A.length(vertices) + 1);
    },
    { arbitrary: fcRuns(50) }
  );
});

// -----------------------------------------------------------------------------
// (d) Union cases, guards and exhaustive matching
// -----------------------------------------------------------------------------

describe("Geo unions", () => {
  const geometries = [
    Geometry.cases.Point.make({ coordinates: [0, 0] }),
    Geometry.cases.MultiPoint.make({
      coordinates: [
        [0, 0],
        [1, 1],
      ],
    }),
    Geometry.cases.LineString.make({
      coordinates: O.some(
        LineStringCoordinates.make([
          [0, 0],
          [1, 1],
        ])
      ),
    }),
    Geometry.cases.MultiLineString.make({
      coordinates: [
        [
          [0, 0],
          [1, 1],
        ],
      ],
    }),
    Geometry.cases.Polygon.make({ coordinates: [triangle] }),
    Geometry.cases.MultiPolygon.make({ coordinates: [[triangle]] }),
    Geometry.cases.GeometryCollection.make({ geometries: [origin] }),
  ];

  const objects = [
    GeoJsonObject.cases.Point.make({ coordinates: [0, 0] }),
    GeoJsonObject.cases.MultiPoint.make({ coordinates: [[0, 0]] }),
    GeoJsonObject.cases.LineString.make({}),
    GeoJsonObject.cases.MultiLineString.make({ coordinates: [] }),
    GeoJsonObject.cases.Polygon.make({ coordinates: [triangle] }),
    GeoJsonObject.cases.MultiPolygon.make({ coordinates: [[triangle]] }),
    GeoJsonObject.cases.GeometryCollection.make({ geometries: [] }),
    GeoJsonObject.cases.Feature.make({ geometry: O.some(origin), properties: { name: "origin" } }),
    GeoJsonObject.cases.FeatureCollection.make({ features: [Feature.make({})] }),
  ];

  const geometryKind = Geometry.match({
    Point: () => "Point",
    MultiPoint: () => "MultiPoint",
    LineString: () => "LineString",
    MultiLineString: () => "MultiLineString",
    Polygon: () => "Polygon",
    MultiPolygon: () => "MultiPolygon",
    GeometryCollection: () => "GeometryCollection",
  });

  const objectKind = GeoJsonObject.match({
    Point: () => "Point",
    MultiPoint: () => "MultiPoint",
    LineString: () => "LineString",
    MultiLineString: () => "MultiLineString",
    Polygon: () => "Polygon",
    MultiPolygon: () => "MultiPolygon",
    GeometryCollection: () => "GeometryCollection",
    Feature: () => "Feature",
    FeatureCollection: () => "FeatureCollection",
  });

  it("Geometry has one case per geometry tag, in tag order", () => {
    expect(A.map(geometries, geometryKind)).toEqual(GeometryKind.literals);
    expect(A.map(geometries, (geometry) => geometry.type)).toEqual(GeometryKind.literals);
    expect(A.every(geometries, S.is(Geometry))).toBe(true);
  });

  it("GeoJsonObject has one case per GeoJSON tag, in tag order", () => {
    expect(A.map(objects, objectKind)).toEqual(GeoJsonKind.literals);
    expect(A.map(objects, (object) => object.type)).toEqual(GeoJsonKind.literals);
    expect(A.every(objects, S.is(GeoJsonObject))).toBe(true);
  });

  it("every guard accepts its own case and no other", () => {
    expect(A.map(geometries, (geometry) => Geometry.guards[geometry.type](geometry))).toEqual(
      A.map(geometries, () => true)
    );
    expect(A.map(objects, (object) => GeoJsonObject.guards[object.type](object))).toEqual(A.map(objects, () => true));
    expect(A.length(A.filter(geometries, Geometry.guards.Polygon))).toBe(1);
    expect(A.length(A.filter(objects, GeoJsonObject.guards.Feature))).toBe(1);
  });

  it("isAnyOf separates features from bare geometries", () => {
    const carriesProperties = GeoJsonObject.isAnyOf(["Feature", "FeatureCollection"]);
    expect(A.map(objects, carriesProperties)).toEqual([false, false, false, false, false, false, false, true, true]);
    expect(A.every(A.filter(objects, (object) => !carriesProperties(object)), S.is(Geometry))).toBe(true);
  });

  it("the geometry tags are the GeoJSON tags without the feature tags", () => {
    expect(GeoJsonKind.literals).toEqual([...GeometryKind.literals, "Feature", "FeatureCollection"]);
  });

  it("matches a distance unit from either side of the mapping", () => {
    expect(DistanceUnit.From.Enum.NAUTICAL_MILES).toBe("nauticalMiles");
    expect(DistanceUnit.To.Enum.nauticalMiles).toBe("NAUTICAL_MILES");
    const isMetric = DistanceUnit.To.match({
      millimeters: () => true,
      centimeters: () => true,
      meters: () => true,
      kilometers: () => true,
      inches: () => false,
      feet: () => false,
      yards: () => false,
      miles: () => false,
      nauticalMiles: () => false,
    });
    expect(isMetric(Distance.kilometers(5).unit)).toBe(true);
    expect(isMetric(Distance.feet(5).unit)).toBe(false);
  });
});

// -----------------------------------------------------------------------------
// (e) Invariants reject counter-examples
// -----------------------------------------------------------------------------

describe("Geo invariants", () => {
  it("coordinates stay on the globe", () => {
    expect(A.map([180.0001, -180.0001, Number.NaN], rejects(Longitude))).toEqual([true, true, true]);
    expect(A.map([90.0001, -90.0001, Number.NaN], rejects(Latitude))).toEqual([true, true, true]);
    expect(A.map([Number.POSITIVE_INFINITY, Number.NaN, "12"], rejects(Altitude))).toEqual([true, true, true]);
    expect(A.map([180, -180, 0], rejects(Longitude))).toEqual([false, false, false]);
    expect(A.map([90, -90, 0], rejects(Latitude))).toEqual([false, false, false]);
  });

  it("a position needs a longitude and a latitude, in that order", () => {
    const rejected = A.map(
      [[], [102], [181, 0], [0, 91], ["102", 0], [102, 0, Number.POSITIVE_INFINITY], { 0: 102, 1: 0 }],
      rejects(Position)
    );
    expect(rejected).toEqual([true, true, true, true, true, true, true]);
    // [37.7749, -122.4194] is latitude-first: the second element is out of the latitude range.
    expect(rejects(Position)([37.7749, -122.4194])).toBe(true);
    expect(rejects(Position)([-122.4194, 37.7749])).toBe(false);
  });

  it("a bounding box has exactly four or six in-range numbers", () => {
    const rejected = A.map(
      [
        [],
        [0, 0],
        [0, 0, 1, 1, 2],
        [0, 0, 0, 1, 1, 1, 2],
        [0, -91, 1, 1],
        [-181, 0, 1, 1],
        [0, 0, 0, 181, 1, 0],
      ],
      rejects(BoundingBox)
    );
    expect(rejected).toEqual([true, true, true, true, true, true, true]);
    // A box that crosses the antimeridian has west greater than east and is valid.
    expect(rejects(BoundingBox)([177, -20, -178, -16])).toBe(false);
  });

  it("a line string path needs two positions", () => {
    expect(rejects(LineStringCoordinates)([[100, 0]])).toBe(true);
    expect(rejects(LineStringCoordinates)([])).toBe(true);
    expect(rejects(LineString)({ type: "LineString", coordinates: [[100, 0]] })).toBe(true);
    expect(rejects(MultiLineString)({ type: "MultiLineString", coordinates: [[[100, 0]]] })).toBe(true);
  });

  it.effect(
    "a ring needs four positions",
    Effect.fnUntraced(function* () {
      const message = yield* failureMessage(LinearRing, [
        [100, 0],
        [101, 0],
        [100, 0],
      ]);
      expect(message).toContain("A linear ring needs at least four positions");
    })
  );

  it.effect(
    "a ring must end where it starts",
    Effect.fnUntraced(function* () {
      const message = yield* failureMessage(LinearRing, [
        [100, 0],
        [101, 0],
        [101, 1],
        [100, 1],
      ]);
      expect(message).toContain("A linear ring must end at the position it starts from");
    })
  );

  it("a ring whose ends differ only in altitude is not closed", () => {
    expect(
      rejects(LinearRing)([
        [100, 0, 10],
        [101, 0, 10],
        [100, 1, 10],
        [100, 0, 20],
      ])
    ).toBe(true);
    expect(
      rejects(LinearRing)([
        [100, 0, 10],
        [101, 0, 10],
        [100, 1, 10],
        [100, 0, 10],
      ])
    ).toBe(false);
  });

  it.effect(
    "a ring reports the position that is off the globe",
    Effect.fnUntraced(function* () {
      const message = yield* failureMessage(LinearRing, [
        [100, 0],
        [101, 0],
        [100, 95],
        [100, 0],
      ]);
      expect(message).toContain("Expected a latitude between -90 and 90 degrees");
      expect(message).toContain("[2][1]");
      expect(rejects(LinearRing)("not a ring")).toBe(true);
    })
  );

  it("polygons reject open rings wherever they are nested", () => {
    const open = [
      [100, 0],
      [101, 0],
      [101, 1],
      [100, 1],
    ];
    expect(rejects(Polygon)({ type: "Polygon", coordinates: [open] })).toBe(true);
    expect(rejects(MultiPolygon)({ type: "MultiPolygon", coordinates: [[open]] })).toBe(true);
    expect(
      rejects(GeometryCollection)({
        type: "GeometryCollection",
        geometries: [{ type: "GeometryCollection", geometries: [{ type: "Polygon", coordinates: [open] }] }],
      })
    ).toBe(true);
    expect(
      rejects(Feature)({ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [open] } })
    ).toBe(true);
  });

  it("tags are exact", () => {
    expect(rejects(Geometry)({ type: "point", coordinates: [0, 0] })).toBe(true);
    expect(rejects(Geometry)({ type: "Circle", coordinates: [0, 0] })).toBe(true);
    expect(rejects(Geometry)({ type: "Feature", properties: {} })).toBe(true);
    expect(rejects(GeoJsonObject)({ type: "Feature", properties: {} })).toBe(false);
    expect(rejects(GeoPoint)({ type: "MultiPoint", coordinates: [0, 0] })).toBe(true);
    expect(rejects(GeometryKind)("Feature")).toBe(true);
    expect(rejects(GeoJsonKind)("Topology")).toBe(true);
  });

  it("feature properties are a JSON object", () => {
    expect(rejects(Feature)({ type: "Feature", properties: ["not", "an", "object"] })).toBe(true);
    expect(rejects(Feature)({ type: "Feature", properties: { when: undefined } })).toBe(true);
    expect(rejects(FeatureCollection)({ type: "FeatureCollection", features: [{ type: "Point" }] })).toBe(true);
  });

  it.effect(
    "a distance is non-negative, finite and in a known wire unit",
    Effect.fnUntraced(function* () {
      const message = yield* failureMessage(Distance, { value: -1, unit: "METERS" });
      expect(message).toContain("A distance cannot be negative");
      const rejected = A.map(
        [
          { value: Number.POSITIVE_INFINITY, unit: "METERS" },
          { value: 5, unit: "PARSECS" },
          { value: 5, unit: "kilometers" },
          { value: "5", unit: "KILOMETERS" },
          { value: 5 },
        ],
        rejects(Distance)
      );
      expect(rejected).toEqual([true, true, true, true, true]);
      expect(rejects(DistanceUnit)("nauticalMiles")).toBe(true);
    })
  );
});
