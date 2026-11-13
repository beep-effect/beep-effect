import { fcRuns } from "@beep/test-utils";
import { describe, it } from "@effect/vitest";
import { assertFalse, assertNone, assertTrue, deepStrictEqual, strictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Arbitrary from "effect/Arbitrary";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import { identity } from "effect/Function";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { GeotimeSeriesReferenceType } from "../src/DataType/DataType.model.ts";
import { fieldCodec, valueCodec } from "../src/Property/Property.behavior.ts";
import * as GeotimeSeries from "../src/TimeSeries/GeotimeSeries.model.ts";
import {
  GeotimeSeriesById,
  GeotimeSeriesId,
  GeotimeSeriesIntegrationRid,
  GeotimeSeriesReference,
  IntegratedGeotimeSeries,
} from "../src/TimeSeries/GeotimeSeries.model.ts";
import { GeotimeSeriesValue } from "../src/TimeSeries/TimeSeries.model.ts";

// ---------------------------------------------------------------------------
// Laws shared by every named schema
// ---------------------------------------------------------------------------

const lawful = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  const is = S.is(schema);
  const equivalence = S.toEquivalence(schema);
  const encode = S.encodeEffect(schema);
  const decode = S.decodeEffect(schema);

  it.prop(`${name}: generated values satisfy the schema guard`, [Arbitrary.schema(schema)], ([value]) => is(value), {
    arbitrary: fcRuns(50),
  });

  it.effect.prop(
    `${name}: encode then decode is equivalent to the original`,
    [Arbitrary.schema(schema)],
    Effect.fnUntraced(function* ([value]) {
      const encoded = yield* encode(value);
      const decoded = yield* decode(encoded);
      assertTrue(equivalence(decoded, value));
    }),
    { arbitrary: fcRuns(50) }
  );
};

// Decodes an exact wire value, compares the domain value, encodes it back and compares with the wire value.
const wireFixture = <T, E>(name: string, schema: S.Codec<T, E>, wire: NoInfer<E>, expected: NoInfer<T>): void => {
  it.effect(
    `${name}: decodes the wire fixture and encodes it back unchanged`,
    Effect.fnUntraced(function* () {
      const decoded = yield* S.decodeEffect(schema)(wire);
      assertTrue(S.is(schema)(decoded));
      assertTrue(S.toEquivalence(schema)(decoded, expected));
      const encoded = yield* S.encodeEffect(schema)(decoded);
      deepStrictEqual(encoded, wire);
      const fromDomain = yield* S.encodeEffect(schema)(expected);
      deepStrictEqual(fromDomain, wire);
    })
  );
};

const rejects =
  <T, E>(schema: S.Codec<T, E>) =>
  (input: unknown): Effect.Effect<boolean> =>
    Effect.map(Effect.exit(S.decodeUnknownEffect(schema)(input)), Exit.isFailure);

const refusesToEncode =
  <T, E>(schema: S.Codec<T, E>) =>
  (input: unknown): Effect.Effect<boolean> =>
    Effect.map(Effect.exit(S.encodeUnknownEffect(schema)(input)), Exit.isFailure);

type Equals<Left, Right> = (<T>() => T extends Left ? 1 : 2) extends <T>() => T extends Right ? 1 : 2 ? true : false;

// ---------------------------------------------------------------------------
// Fixtures: the three wire shapes a geotime series reference property holds
// ---------------------------------------------------------------------------

const seriesIdText = "employee-50030";
const integrationText = "ri.geotime-catalog.main.integration.401ac022-89eb-4591-8b7e-0a912b9efb44";
const instant = DateTime.makeUnsafe("2021-01-04T05:00:00.000Z");

const seriesId = GeotimeSeriesId.make(seriesIdText);
const sourceRid = GeotimeSeriesIntegrationRid.make(integrationText);

// Shape 1: the bare series id.
const byIdWire = seriesIdText;
const byId = GeotimeSeriesById.make({ geotimeSeriesId: seriesId });

// Shape 2: the series id together with the integration that feeds it.
const integratedWire = { geotimeSeriesId: seriesIdText, geotimeSeriesIntegrationRid: integrationText };
const integrated = IntegratedGeotimeSeries.make({ geotimeSeriesId: seriesId, sourceRid });

// Shape 3: the resolved latest value.
const resolvedWire: typeof GeotimeSeriesValue.Encoded = {
  type: "geotimeSeriesValue",
  position: [102.0, 0.5],
  timestamp: "2021-01-04T05:00:00.000Z",
};
const resolved = GeotimeSeriesValue.make({ position: [102.0, 0.5], timestamp: instant });

// ---------------------------------------------------------------------------
// The module surface
// ---------------------------------------------------------------------------

describe("GeotimeSeries module", () => {
  it("exports two identifiers, the two reference shapes and the union", () => {
    const exported: ReadonlyArray<string> = R.keys(GeotimeSeries);
    deepStrictEqual(A.sort(exported, Order.String), [
      "GeotimeSeriesById",
      "GeotimeSeriesId",
      "GeotimeSeriesIntegrationRid",
      "GeotimeSeriesReference",
      "IntegratedGeotimeSeries",
    ]);
  });

  it("has the three untagged wire shapes as its encoded side and three tagged cases as its domain side", () => {
    type IntegratedWire = { readonly geotimeSeriesId: string; readonly geotimeSeriesIntegrationRid: string };
    const facts: readonly [
      Equals<typeof GeotimeSeriesId.Encoded, string>,
      Equals<typeof GeotimeSeriesIntegrationRid.Encoded, string>,
      Equals<typeof GeotimeSeriesById.Encoded, string>,
      Equals<GeotimeSeriesById["type"], "series">,
      Equals<GeotimeSeriesById["geotimeSeriesId"], GeotimeSeriesId>,
      Equals<typeof IntegratedGeotimeSeries.Encoded, IntegratedWire>,
      Equals<IntegratedGeotimeSeries["type"], "integratedSeries">,
      Equals<IntegratedGeotimeSeries["geotimeSeriesId"], GeotimeSeriesId>,
      Equals<IntegratedGeotimeSeries["sourceRid"], GeotimeSeriesIntegrationRid>,
      Equals<typeof GeotimeSeriesReference.Encoded, string | IntegratedWire | typeof GeotimeSeriesValue.Encoded>,
      Equals<GeotimeSeriesReference, GeotimeSeriesById | IntegratedGeotimeSeries | GeotimeSeriesValue>,
      Equals<GeotimeSeriesReference["type"], "series" | "integratedSeries" | "geotimeSeriesValue">,
      // The two identifier brands are distinct types.
      Equals<GeotimeSeriesId, GeotimeSeriesIntegrationRid>,
    ] = [true, true, true, true, true, true, true, true, true, true, true, true, false];
    deepStrictEqual(facts, [true, true, true, true, true, true, true, true, true, true, true, true, false]);
  });
});

// ---------------------------------------------------------------------------
// Identifiers
// ---------------------------------------------------------------------------

describe("GeotimeSeriesId and GeotimeSeriesIntegrationRid", () => {
  lawful("GeotimeSeriesId", GeotimeSeriesId);
  lawful("GeotimeSeriesIntegrationRid", GeotimeSeriesIntegrationRid);

  wireFixture("GeotimeSeriesId", GeotimeSeriesId, seriesIdText, seriesId);
  wireFixture("GeotimeSeriesIntegrationRid", GeotimeSeriesIntegrationRid, integrationText, sourceRid);

  it.effect(
    "accepts any non-empty text and rejects the empty string and non-strings",
    Effect.fnUntraced(function* () {
      // Wire brands are loose (C10): an identifier is non-empty text, whatever it looks like.
      const loose = yield* Effect.all(
        A.map(["GeotimeSeriesReferencePlaceholder", " ", "a b", "ri.x"], (text) => S.decodeEffect(GeotimeSeriesId)(text))
      );
      deepStrictEqual<ReadonlyArray<string>>(loose, ["GeotimeSeriesReferencePlaceholder", " ", "a b", "ri.x"]);
      const verdicts = yield* Effect.all([
        rejects(GeotimeSeriesId)(""),
        rejects(GeotimeSeriesId)(7),
        rejects(GeotimeSeriesId)(null),
        rejects(GeotimeSeriesIntegrationRid)(""),
        rejects(GeotimeSeriesIntegrationRid)({ rid: integrationText }),
      ]);
      assertTrue(A.every(verdicts, identity));
      assertNone(GeotimeSeriesId.makeOption(""));
      assertNone(GeotimeSeriesIntegrationRid.makeOption(""));
    })
  );
});

// ---------------------------------------------------------------------------
// Shape 1: reference by series id
// ---------------------------------------------------------------------------

describe("GeotimeSeriesById", () => {
  lawful("GeotimeSeriesById", GeotimeSeriesById);

  wireFixture("GeotimeSeriesById", GeotimeSeriesById, byIdWire, byId);
  wireFixture(
    "GeotimeSeriesById with the OSDK stub's placeholder text",
    GeotimeSeriesById,
    "GeotimeSeriesReferencePlaceholder",
    GeotimeSeriesById.make({ geotimeSeriesId: GeotimeSeriesId.make("GeotimeSeriesReferencePlaceholder") })
  );

  it("constructs the tagged case from the id alone", () => {
    deepStrictEqual<unknown>(byId, { type: "series", geotimeSeriesId: seriesIdText });
    strictEqual(byId.type, "series");
    strictEqual(byId.geotimeSeriesId, seriesId);
  });

  it.effect(
    "rejects the empty string, non-strings and the domain record on the wire, and refuses to encode an empty id",
    Effect.fnUntraced(function* () {
      const verdicts = yield* Effect.all([
        rejects(GeotimeSeriesById)(""),
        rejects(GeotimeSeriesById)(50030),
        rejects(GeotimeSeriesById)(null),
        rejects(GeotimeSeriesById)([seriesIdText]),
        // The tagged record is the domain form; on the wire the reference is the bare string.
        rejects(GeotimeSeriesById)({ type: "series", geotimeSeriesId: seriesIdText }),
        rejects(GeotimeSeriesById)(integratedWire),
        refusesToEncode(GeotimeSeriesById)({ type: "series", geotimeSeriesId: "" }),
        refusesToEncode(GeotimeSeriesById)(seriesIdText),
        refusesToEncode(GeotimeSeriesById)({ type: "integratedSeries", geotimeSeriesId: seriesIdText }),
      ]);
      assertTrue(A.every(verdicts, identity));
      const isById = S.is(GeotimeSeriesById);
      deepStrictEqual([isById(byId), isById(seriesIdText), isById(integrated), isById(resolved)], [true, false, false, false]);
    })
  );
});

// ---------------------------------------------------------------------------
// Shape 2: reference by series id and integration
// ---------------------------------------------------------------------------

describe("IntegratedGeotimeSeries", () => {
  lawful("IntegratedGeotimeSeries", IntegratedGeotimeSeries);

  wireFixture("IntegratedGeotimeSeries", IntegratedGeotimeSeries, integratedWire, integrated);

  it("constructs the tagged case and renames the integration key in the domain only", () => {
    deepStrictEqual<unknown>(integrated, {
      type: "integratedSeries",
      geotimeSeriesId: seriesIdText,
      sourceRid: integrationText,
    });
    strictEqual(integrated.sourceRid, sourceRid);
  });

  it.effect(
    "strips undeclared wire keys and writes exactly the two wire keys back",
    Effect.fnUntraced(function* () {
      const decoded = yield* S.decodeUnknownEffect(IntegratedGeotimeSeries)({ ...integratedWire, extra: true });
      const encoded = yield* S.encodeEffect(IntegratedGeotimeSeries)(decoded);
      deepStrictEqual(encoded, integratedWire);
      deepStrictEqual(A.sort(R.keys(encoded), Order.String), ["geotimeSeriesId", "geotimeSeriesIntegrationRid"]);
    })
  );

  it.effect(
    "rejects a missing or empty id or integration, the domain key on the wire and non-records",
    Effect.fnUntraced(function* () {
      const verdicts = yield* Effect.all([
        rejects(IntegratedGeotimeSeries)({ geotimeSeriesId: seriesIdText }),
        rejects(IntegratedGeotimeSeries)({ geotimeSeriesIntegrationRid: integrationText }),
        rejects(IntegratedGeotimeSeries)({ geotimeSeriesId: "", geotimeSeriesIntegrationRid: integrationText }),
        rejects(IntegratedGeotimeSeries)({ geotimeSeriesId: seriesIdText, geotimeSeriesIntegrationRid: "" }),
        rejects(IntegratedGeotimeSeries)({ geotimeSeriesId: seriesIdText, geotimeSeriesIntegrationRid: null }),
        rejects(IntegratedGeotimeSeries)({ geotimeSeriesId: 50030, geotimeSeriesIntegrationRid: integrationText }),
        // `sourceRid` is the domain key, not a wire key.
        rejects(IntegratedGeotimeSeries)({ geotimeSeriesId: seriesIdText, sourceRid: integrationText }),
        rejects(IntegratedGeotimeSeries)(seriesIdText),
        rejects(IntegratedGeotimeSeries)(null),
        rejects(IntegratedGeotimeSeries)([seriesIdText, integrationText]),
        refusesToEncode(IntegratedGeotimeSeries)({ type: "integratedSeries", geotimeSeriesId: seriesIdText }),
        refusesToEncode(IntegratedGeotimeSeries)({
          type: "integratedSeries",
          geotimeSeriesId: seriesIdText,
          sourceRid: "",
        }),
        refusesToEncode(IntegratedGeotimeSeries)(integratedWire),
      ]);
      assertTrue(A.every(verdicts, identity));
    })
  );
});

// ---------------------------------------------------------------------------
// The union of the two references and the resolved value
// ---------------------------------------------------------------------------

describe("GeotimeSeriesReference", () => {
  lawful("GeotimeSeriesReference", GeotimeSeriesReference);

  wireFixture("GeotimeSeriesReference by series id", GeotimeSeriesReference, byIdWire, byId);
  wireFixture("GeotimeSeriesReference by series id and integration", GeotimeSeriesReference, integratedWire, integrated);
  wireFixture("GeotimeSeriesReference resolved to its latest value", GeotimeSeriesReference, resolvedWire, resolved);
  wireFixture(
    "GeotimeSeriesReference resolved to a position with an altitude",
    GeotimeSeriesReference,
    { type: "geotimeSeriesValue", position: [102.0, 0.5, 30], timestamp: "2021-01-04T05:00:00.000Z" },
    GeotimeSeriesValue.make({ position: [102.0, 0.5, 30], timestamp: instant })
  );

  it.effect(
    "decodes each wire shape to its own tagged case",
    Effect.fnUntraced(function* () {
      const decoded = yield* Effect.all(
        A.map([byIdWire, integratedWire, resolvedWire], (wire) => S.decodeEffect(GeotimeSeriesReference)(wire))
      );
      deepStrictEqual(
        A.map(decoded, (reference) => reference.type),
        ["series", "integratedSeries", "geotimeSeriesValue"]
      );
      deepStrictEqual<unknown>(A.take(decoded, 2), [
        { type: "series", geotimeSeriesId: seriesIdText },
        { type: "integratedSeries", geotimeSeriesId: seriesIdText, sourceRid: integrationText },
      ]);
      const encoded = yield* Effect.all(A.map(decoded, (reference) => S.encodeEffect(GeotimeSeriesReference)(reference)));
      deepStrictEqual<unknown>(encoded, [byIdWire, integratedWire, resolvedWire]);
    })
  );

  it("constructs, guards and matches every case", () => {
    const references = {
      series: GeotimeSeriesReference.cases.series.make({ geotimeSeriesId: seriesId }),
      integratedSeries: GeotimeSeriesReference.cases.integratedSeries.make({ geotimeSeriesId: seriesId, sourceRid }),
      geotimeSeriesValue: GeotimeSeriesReference.cases.geotimeSeriesValue.make({
        position: [102.0, 0.5],
        timestamp: instant,
      }),
    };
    const describeReference = GeotimeSeriesReference.match({
      series: ({ geotimeSeriesId }) => `series ${geotimeSeriesId}`,
      integratedSeries: ({ geotimeSeriesId, sourceRid: source }) => `series ${geotimeSeriesId} from ${source}`,
      geotimeSeriesValue: ({ position, timestamp }) => `at ${A.join(A.map(position, (degrees) => `${degrees}`), ",")} on ${DateTime.formatIso(timestamp)}`,
    });
    deepStrictEqual(
      [
        describeReference(references.series),
        describeReference(references.integratedSeries),
        describeReference(references.geotimeSeriesValue),
      ],
      [
        `series ${seriesIdText}`,
        `series ${seriesIdText} from ${integrationText}`,
        "at 102,0.5 on 2021-01-04T05:00:00.000Z",
      ]
    );
    const all: ReadonlyArray<GeotimeSeriesReference> = [
      references.series,
      references.integratedSeries,
      references.geotimeSeriesValue,
    ];
    // Each guard accepts its own case and no other.
    deepStrictEqual(A.map(all, GeotimeSeriesReference.guards.series), [true, false, false]);
    deepStrictEqual(A.map(all, GeotimeSeriesReference.guards.integratedSeries), [false, true, false]);
    deepStrictEqual(A.map(all, GeotimeSeriesReference.guards.geotimeSeriesValue), [false, false, true]);
    const isUnresolved = GeotimeSeriesReference.isAnyOf(["series", "integratedSeries"]);
    deepStrictEqual(A.map(all, isUnresolved), [true, true, false]);
    deepStrictEqual(GeotimeSeriesReference.discriminants, ["series", "integratedSeries", "geotimeSeriesValue"]);
    assertTrue(A.every(all, S.is(GeotimeSeriesReference)));
    // The wire forms are not domain values.
    assertFalse(S.is(GeotimeSeriesReference)(byIdWire));
    assertFalse(S.is(GeotimeSeriesReference)(integratedWire));
  });

  it.effect(
    "generates all three cases",
    Effect.fnUntraced(function* () {
      const samples = yield* Arbitrary.sampleEffect(Arbitrary.schema(GeotimeSeriesReference), { count: 200, seed: 11 });
      const tags: ReadonlyArray<string> = A.dedupe(A.map(samples, (reference) => reference.type));
      deepStrictEqual(A.sort(tags, Order.String), ["geotimeSeriesValue", "integratedSeries", "series"]);
    })
  );

  it.effect(
    "rejects whatever is none of the three wire shapes",
    Effect.fnUntraced(function* () {
      const verdicts = yield* Effect.all([
        rejects(GeotimeSeriesReference)(""),
        rejects(GeotimeSeriesReference)(50030),
        rejects(GeotimeSeriesReference)(true),
        rejects(GeotimeSeriesReference)(null),
        rejects(GeotimeSeriesReference)(undefined),
        rejects(GeotimeSeriesReference)([seriesIdText]),
        rejects(GeotimeSeriesReference)({}),
        rejects(GeotimeSeriesReference)({ geotimeSeriesId: seriesIdText }),
        rejects(GeotimeSeriesReference)({ geotimeSeriesId: "", geotimeSeriesIntegrationRid: integrationText }),
        // The domain's tagged records are not wire shapes.
        rejects(GeotimeSeriesReference)({ type: "series", geotimeSeriesId: seriesIdText }),
        rejects(GeotimeSeriesReference)({ type: "integratedSeries", geotimeSeriesId: seriesIdText, sourceRid: integrationText }),
        // A resolved value needs both its position and its timestamp.
        rejects(GeotimeSeriesReference)({ type: "geotimeSeriesValue", position: [102.0, 0.5] }),
        rejects(GeotimeSeriesReference)({ type: "geotimeSeriesValue", timestamp: "2021-01-04T05:00:00Z" }),
        rejects(GeotimeSeriesReference)({ type: "geotimeSeriesValue", position: [102.0], timestamp: "2021-01-04T05:00:00Z" }),
        rejects(GeotimeSeriesReference)({ type: "geotimeSeriesValue", position: [102.0, 0.5], timestamp: 1609736400000 }),
        refusesToEncode(GeotimeSeriesReference)(byIdWire),
        refusesToEncode(GeotimeSeriesReference)({ type: "series", geotimeSeriesId: "" }),
        refusesToEncode(GeotimeSeriesReference)({ type: "seriesReference", geotimeSeriesId: seriesIdText }),
      ]);
      assertTrue(A.every(verdicts, identity));
    })
  );

  // Law: a resolved geotime series value reads its instant by the rule of a timestamp property, so text that is not
  // an ISO 8601 date-time with a zone designator is rejected.
  it.effect(
    "GeotimeSeriesReference: a resolved value rejects a timestamp that is not an ISO 8601 date-time",
    Effect.fnUntraced(function* () {
      const verdicts = yield* Effect.all([
        rejects(GeotimeSeriesReference)({ type: "geotimeSeriesValue", position: [102.0, 0.5], timestamp: "Jan 4 2021" }),
        rejects(GeotimeSeriesReference)({ type: "geotimeSeriesValue", position: [102.0, 0.5], timestamp: "2021-01-04" }),
      ]);
      assertTrue(A.every(verdicts, identity));
    })
  );
});

// ---------------------------------------------------------------------------
// What a property of this type decodes through `valueCodec`
// ---------------------------------------------------------------------------

describe("a geotimeSeriesReference property", () => {
  const type = GeotimeSeriesReferenceType.make({});
  const codec = valueCodec(type);
  const isReference = S.is(GeotimeSeriesReference);
  const referenceEquivalence = S.toEquivalence(GeotimeSeriesReference);

  it.effect(
    "decodes each wire shape through valueCodec to exactly what GeotimeSeriesReference decodes",
    Effect.fnUntraced(function* () {
      const wires: ReadonlyArray<typeof GeotimeSeriesReference.Encoded> = [
        byIdWire,
        "GeotimeSeriesReferencePlaceholder",
        integratedWire,
        resolvedWire,
      ];
      const verdicts = yield* Effect.forEach(
        wires,
        Effect.fnUntraced(function* (wire) {
          const projected = yield* S.decodeEffect(codec)(wire);
          const direct = yield* S.decodeEffect(GeotimeSeriesReference)(wire);
          const encoded = yield* S.encodeUnknownEffect(codec)(projected);
          deepStrictEqual<unknown>(encoded, wire);
          return isReference(projected) && referenceEquivalence(projected, direct);
        })
      );
      deepStrictEqual(verdicts, [true, true, true, true]);
    })
  );

  it.effect(
    "decodes to the tagged cases, so a caller can tell a reference from a resolved value",
    Effect.fnUntraced(function* () {
      const decoded = yield* Effect.all(
        A.map([byIdWire, integratedWire, resolvedWire], (wire) => S.decodeEffect(codec)(wire))
      );
      const references = A.filter(decoded, isReference);
      strictEqual(A.length(references), 3);
      deepStrictEqual(
        A.map(
          references,
          GeotimeSeriesReference.match({
            series: () => "no latest value yet",
            integratedSeries: () => "no latest value yet",
            geotimeSeriesValue: ({ position }) => `latest at ${A.join(A.map(position, (degrees) => `${degrees}`), ",")}`,
          })
        ),
        ["no latest value yet", "no latest value yet", "latest at 102,0.5"]
      );
    })
  );

  it.effect(
    "generates values of the projected codec that are references and round-trip",
    Effect.fnUntraced(function* () {
      const samples = yield* Arbitrary.sampleEffect(Arbitrary.schema(codec), { count: 60, seed: 5 });
      assertTrue(A.every(samples, isReference));
      const returned = yield* Effect.forEach(
        samples,
        Effect.fnUntraced(function* (sample) {
          const encoded = yield* S.encodeUnknownEffect(codec)(sample);
          const decoded = yield* S.decodeUnknownEffect(codec)(encoded);
          return S.toEquivalence(codec)(decoded, sample);
        })
      );
      assertTrue(A.every(returned, identity));
    })
  );

  it.effect(
    "rejects what is none of the three wire shapes, through valueCodec too",
    Effect.fnUntraced(function* () {
      const verdicts = yield* Effect.all([
        rejects(codec)(""),
        rejects(codec)(7),
        rejects(codec)(null),
        rejects(codec)([seriesIdText]),
        rejects(codec)({ geotimeSeriesId: seriesIdText }),
        rejects(codec)({ type: "geotimeSeriesValue", position: [102.0, 0.5] }),
        rejects(codec)({ type: "series", geotimeSeriesId: seriesIdText }),
      ]);
      assertTrue(A.every(verdicts, identity));
    })
  );

  it.effect(
    "is absent, null or present as an object field",
    Effect.fnUntraced(function* () {
      const Row = S.Struct({ employeeLocation: fieldCodec(type) });
      const absent = yield* S.decodeEffect(Row)({});
      const explicitNull = yield* S.decodeEffect(Row)({ employeeLocation: null });
      const present = yield* S.decodeEffect(Row)({ employeeLocation: byIdWire });
      const presentIntegrated = yield* S.decodeEffect(Row)({ employeeLocation: integratedWire });
      deepStrictEqual<unknown>(
        [absent, explicitNull, present, presentIntegrated],
        [
          { employeeLocation: O.none() },
          { employeeLocation: O.none() },
          { employeeLocation: O.some({ type: "series", geotimeSeriesId: seriesIdText }) },
          {
            employeeLocation: O.some({
              type: "integratedSeries",
              geotimeSeriesId: seriesIdText,
              sourceRid: integrationText,
            }),
          },
        ]
      );
      const encoded = yield* Effect.all(
        A.map([absent, present, presentIntegrated], (row) => S.encodeUnknownEffect(Row)(row))
      );
      deepStrictEqual<unknown>(encoded, [{}, { employeeLocation: byIdWire }, { employeeLocation: integratedWire }]);
      const refused = yield* rejects(Row)({ employeeLocation: "" });
      assertTrue(refused);
    })
  );
});
