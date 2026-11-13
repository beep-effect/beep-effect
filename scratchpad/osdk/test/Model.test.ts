import { LocalDate } from "@beep/schema/LocalDate";
import { describe, it } from "@effect/vitest";
import { assertSome, assertTrue, deepStrictEqual, strictEqual, throws } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Arbitrary from "effect/Arbitrary";
import * as BigDecimal from "effect/BigDecimal";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import { identity } from "effect/Function";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Struct from "effect/Struct";
import * as Tuple from "effect/Tuple";
import {
  AttachmentType,
  BooleanType,
  ByteType,
  CipherTextType,
  DateType,
  DecimalType,
  DoubleType,
  FloatType,
  GeoPointType,
  GeoShapeType,
  GeotimeSeriesReferenceType,
  IntegerType,
  LongType,
  MarkingType,
  MediaReferenceType,
  SensorSeriesItem,
  ShortType,
  StringType,
  TimeseriesType,
  TimestampType,
  VectorType,
} from "../src/DataType/DataType.model.ts";
import { PropertyTypeKind, SharedValueKind } from "../src/DataType/DataType.values.ts";
import { StructFieldApiName, StructFieldTypeRid } from "../src/Identifier/Identifier.model.ts";
import * as Model from "../src/Model/Model.spec.ts";
import { fieldCodec, leafCodec, valueCodec } from "../src/Property/Property.behavior.ts";
import { sharedCodec } from "../src/Value/Value.behavior.ts";
import { ArrayType, PropertyType, StructFieldType, StructType } from "../src/Property/Property.model.ts";
import type { PropertyCodec } from "../src/Object/Object.behavior.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type AnyCodec = S.Codec<unknown, unknown>;

type Equals<Left, Right> = (<T>() => T extends Left ? 1 : 2) extends <T>() => T extends Right ? 1 : 2 ? true : false;

const rejects =
  (schema: AnyCodec) =>
  (input: unknown): Effect.Effect<boolean> =>
    Effect.map(Effect.exit(S.decodeUnknownEffect(schema)(input)), Exit.isFailure);

const structField = (apiName: string, dataType: PropertyType): StructFieldType =>
  StructFieldType.make({
    apiName: StructFieldApiName.make(apiName),
    rid: StructFieldTypeRid.make(`ri.struct.${apiName}`),
    dataType,
  });

// Decodes one wire value with a spec's codec and with the projection of the equivalent property type, and says
// whether the two agree: both refuse, or both accept, decode to equivalent values and encode those identically.
const agreeOn = Effect.fnUntraced(function* (spec: AnyCodec, projected: AnyCodec, wire: unknown) {
  const fromSpec = yield* Effect.exit(S.decodeUnknownEffect(spec)(wire));
  const fromProjection = yield* Effect.exit(S.decodeUnknownEffect(projected)(wire));
  if (Exit.isFailure(fromSpec) || Exit.isFailure(fromProjection)) {
    return Exit.isFailure(fromSpec) && Exit.isFailure(fromProjection);
  }
  const encodedBySpec = yield* S.encodeUnknownEffect(spec)(fromSpec.value);
  const encodedByProjection = yield* S.encodeUnknownEffect(projected)(fromProjection.value);
  const reDecoded = yield* S.decodeUnknownEffect(projected)(encodedBySpec);
  const jsonBySpec = yield* S.decodeUnknownEffect(S.Json)(encodedBySpec);
  const jsonByProjection = yield* S.decodeUnknownEffect(S.Json)(encodedByProjection);
  return (
    S.toEquivalence(projected)(fromSpec.value, fromProjection.value) &&
    S.toEquivalence(spec)(fromSpec.value, fromProjection.value) &&
    S.toEquivalence(projected)(reDecoded, fromProjection.value) &&
    S.is(projected)(fromSpec.value) &&
    S.is(spec)(fromProjection.value) &&
    S.toEquivalence(S.Json)(jsonBySpec, jsonByProjection)
  );
});

const uuid = "401ac022-89eb-4591-8b7e-0a912b9efb44";
const cipherChannel = "ri.bellaso.main.cipher-channel.6d2ae41e-2d55-4b4b-a5dc-b3d22a8b0f2a";

// ---------------------------------------------------------------------------
// One row per property type tag: the spec, the equivalent property type, a wire value and its canonical encoding.
// The wire values are the ones `Property.test.ts` uses for `valueCodec` (09-wire-c-core-geo.md §5.1).
// ---------------------------------------------------------------------------

type Row = readonly [value: AnyCodec, type: PropertyType, wire: unknown, canonical: unknown];

const mediaReferenceWire = {
  mimeType: "application/pdf",
  reference: {
    type: "mediaSetViewItem",
    mediaSetViewItem: {
      mediaSetRid: "ri.mio.main.media-set.4153d42f-ca4b-4e42-8ca5-8e6aa7edb642",
      mediaSetViewRid: "ri.mio.main.view.82a798ad-d637-4595-acc6-987bcf16629b",
      mediaItemRid: "ri.mio.main.media-item.001ec98b-1620-4814-9e17-8e9c4e536225",
    },
  },
};

const lineString = {
  type: "LineString",
  coordinates: [
    [102.0, 0.0],
    [103.0, 1.0],
  ],
};

const nameSpec = Model.struct({ firstName: Model.string, lastName: Model.string });
const nameType = StructType.make({
  fields: [structField("firstName", StringType.make({})), structField("lastName", StringType.make({}))],
});

const perCase: { readonly [K in PropertyTypeKind]: Row } = {
  boolean: [Model.boolean.value, BooleanType.make({}), true, true],
  byte: [Model.byte.value, ByteType.make({}), 31, 31],
  short: [Model.short.value, ShortType.make({}), 8739, 8739],
  integer: [Model.integer.value, IntegerType.make({}), 238940, 238940],
  long: [Model.long.value, LongType.make({}), "58319870951433", "58319870951433"],
  float: [Model.float.value, FloatType.make({}), 3.14159265, 3.14159265],
  double: [Model.double.value, DoubleType.make({}), 3.14159265, 3.14159265],
  decimal: [Model.decimal.value, DecimalType.make({}), "2.718281828", "2.718281828"],
  string: [Model.string.value, StringType.make({}), "Call me Ishmael", "Call me Ishmael"],
  date: [Model.date.value, DateType.make({}), "2021-05-01", "2021-05-01"],
  timestamp: [Model.timestamp.value, TimestampType.make({}), "2021-01-04T05:00:00Z", "2021-01-04T05:00:00.000Z"],
  marking: [
    Model.marking.value,
    MarkingType.make({}),
    "8f6a6b3c-1c2d-4e5f-9a0b-1c2d3e4f5a6b",
    "8f6a6b3c-1c2d-4e5f-9a0b-1c2d3e4f5a6b",
  ],
  cipherText: [
    Model.cipherText.value,
    CipherTextType.make({}),
    `CIPHER::${cipherChannel}::AAAAkdB7::CIPHER`,
    `CIPHER::${cipherChannel}::AAAAkdB7::CIPHER`,
  ],
  attachment: [
    Model.attachment.value,
    AttachmentType.make({}),
    { rid: "ri.blobster.main.attachment.bb32154e-e043-4b00-9461-93136ca96b6f" },
    { rid: "ri.blobster.main.attachment.bb32154e-e043-4b00-9461-93136ca96b6f" },
  ],
  mediaReference: [Model.mediaReference.value, MediaReferenceType.make({}), mediaReferenceWire, mediaReferenceWire],
  geopoint: [
    Model.geopoint.value,
    GeoPointType.make({}),
    { type: "Point", coordinates: [102.0, 0.5] },
    { type: "Point", coordinates: [102.0, 0.5] },
  ],
  geoshape: [Model.geoshape.value, GeoShapeType.make({}), lineString, lineString],
  geotimeSeriesReference: [
    Model.geotimeSeriesReference.value,
    GeotimeSeriesReferenceType.make({}),
    { geotimeSeriesId: "employee-50030", geotimeSeriesIntegrationRid: `ri.geotime-catalog.main.integration.${uuid}` },
    { geotimeSeriesId: "employee-50030", geotimeSeriesIntegrationRid: `ri.geotime-catalog.main.integration.${uuid}` },
  ],
  timeseries: [
    Model.timeseries.value,
    TimeseriesType.make({ itemType: DoubleType.make({}) }),
    { seriesId: "wellPressureSeriesId", syncRid: `ri.time-series-catalog.main.sync.${uuid}` },
    { seriesId: "wellPressureSeriesId", syncRid: `ri.time-series-catalog.main.sync.${uuid}` },
  ],
  vector: [
    Model.vector(6).value,
    VectorType.make({ dimension: 6 }),
    [0.1, 0.3, 0.02, 0.05, 0.8, 0.4],
    [0.1, 0.3, 0.02, 0.05, 0.8, 0.4],
  ],
  array: [
    Model.array(Model.string).value,
    ArrayType.make({ elementType: StringType.make({}) }),
    ["alpha", "bravo", "charlie"],
    ["alpha", "bravo", "charlie"],
  ],
  struct: [nameSpec.value, nameType, { firstName: "Alex", lastName: "Karp" }, { firstName: "Alex", lastName: "Karp" }],
};

// Values that belong to no case, or to the wrong one: every codec pair must give the same verdict on each.
const strays: ReadonlyArray<unknown> = [
  null,
  undefined,
  {},
  [],
  "",
  " ",
  "x",
  "12",
  "0x10",
  "2021-02-30",
  "2021-01-04",
  0,
  -1,
  1.5,
  300,
  40_000,
  3_000_000_000,
  1e39,
  true,
  [1, 2, 3],
  [0.1, 0.3, 0.02, 0.05, 0.8, 0.4, 0.9],
  ["alpha", 7],
  { type: "nope" },
  { firstName: 7 },
  { firstName: null, lastName: "Karp", extra: true },
];

// ---------------------------------------------------------------------------
// The module surface
// ---------------------------------------------------------------------------

describe("Model.spec module", () => {
  it("exports one spec or builder per property type tag, plus required, fieldsOf, typeOf and ReferenceTarget", () => {
    const exported: ReadonlyArray<string> = R.keys(Model);
    const tags: ReadonlyArray<string> = PropertyTypeKind.literals;
    deepStrictEqual(
      A.sort(exported, Order.String),
      A.sort(A.appendAll(tags, ["fieldsOf", "required", "typeOf", "ReferenceTarget"]), Order.String)
    );
    strictEqual(A.length(exported), 26);
  });

  it("names each leaf spec after its tag and makes it optional, with no element and no fields", () => {
    const leaves = [
      Model.boolean,
      Model.byte,
      Model.short,
      Model.integer,
      Model.long,
      Model.float,
      Model.double,
      Model.decimal,
      Model.string,
      Model.date,
      Model.timestamp,
      Model.marking,
      Model.cipherText,
      Model.attachment,
      Model.mediaReference,
      Model.geopoint,
      Model.geoshape,
      Model.geotimeSeriesReference,
      Model.timeseries,
      Model.vector(3),
    ];
    deepStrictEqual<ReadonlyArray<string>>(
      A.map(leaves, (spec) => spec.kind),
      [
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
      ]
    );
    assertTrue(A.every(leaves, (spec) => spec.presence === "optional"));
    // A leaf has the leaf shape and nothing else: no element, no fields. Only a vector spec states a
    // dimension, and it states the one it was built with.
    deepStrictEqual<ReadonlyArray<Model.SpecShape>>(
      A.map(leaves, (spec) => spec.shape),
      A.map(leaves, (spec) => (spec.kind === "vector" ? { type: "vector", dimension: 3 } : { type: "leaf" }))
    );
    assertTrue(A.every(leaves, (spec) => S.isSchema(spec.value) && S.isSchema(spec.field)));
    // Together with `array` and `struct` the specs cover every property type tag exactly once.
    const covered: ReadonlyArray<string> = A.appendAll(
      A.map(leaves, (spec) => spec.kind),
      [Model.array(Model.string).kind, Model.struct({}).kind]
    );
    deepStrictEqual(A.sort(covered, Order.String), A.sort(PropertyTypeKind.literals, Order.String));
  });

  it("carries the tag, the presence and the decoded value type in the type of each spec", () => {
    const requiredLong = Model.required(Model.long);
    const scores = Model.array(Model.double);
    const facts: readonly [
      Equals<typeof Model.string.kind, "string">,
      Equals<typeof Model.string.presence, "optional">,
      Equals<(typeof Model.string.value)["Type"], string>,
      Equals<(typeof Model.long.value)["Type"], bigint>,
      Equals<(typeof Model.long.value)["Encoded"], string | number>,
      Equals<(typeof Model.decimal.value)["Type"], BigDecimal.BigDecimal>,
      Equals<(typeof Model.date.value)["Type"], LocalDate>,
      Equals<(typeof Model.timestamp.value)["Type"], DateTime.Utc>,
      Equals<(typeof Model.string.field)["Type"], O.Option<string>>,
      Equals<typeof requiredLong.kind, "long">,
      Equals<typeof requiredLong.presence, "required">,
      Equals<(typeof requiredLong.field)["Type"], bigint>,
      Equals<typeof scores.kind, "array">,
      Equals<(typeof scores.value)["Type"], ReadonlyArray<number>>,
      Equals<(typeof scores.field)["Type"], O.Option<ReadonlyArray<number>>>,
      typeof Model.string extends Model.PropertySpec ? true : false,
      typeof requiredLong extends Model.PropertySpec<"long"> ? true : false,
      typeof requiredLong extends Model.PropertySpec<"string"> ? true : false,
    ] = [true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, false];
    deepStrictEqual(facts, [
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      false,
    ]);
  });
});

// ---------------------------------------------------------------------------
// Each spec's value codec is the projection of the same tag
// ---------------------------------------------------------------------------

describe("spec value codecs", () => {
  it.effect(
    "decodes the wire fixture of every tag exactly as valueCodec of the same tag does, and encodes it canonically",
    Effect.fnUntraced(function* () {
      const results = yield* Effect.forEach(
        PropertyTypeKind.literals,
        Effect.fnUntraced(function* (kind) {
          const [value, type, wire, canonical] = perCase[kind];
          const projected = valueCodec(type);
          const fromSpec = yield* S.decodeUnknownEffect(value)(wire);
          const fromProjection = yield* S.decodeUnknownEffect(projected)(wire);
          const encodedBySpec = yield* S.encodeUnknownEffect(value)(fromSpec);
          const encodedByProjection = yield* S.encodeUnknownEffect(projected)(fromProjection);
          deepStrictEqual(encodedBySpec, canonical);
          deepStrictEqual(encodedByProjection, canonical);
          const agreed = yield* agreeOn(value, projected, wire);
          return type.type === kind && agreed && S.toEquivalence(projected)(fromSpec, fromProjection);
        })
      );
      strictEqual(A.length(results), 22);
      assertTrue(A.every(results, identity));
    })
  );

  it.effect(
    "gives the same verdict as valueCodec on every other tag's fixture and on values that belong to no tag",
    Effect.fnUntraced(function* () {
      const wires = A.appendAll(
        A.map(PropertyTypeKind.literals, (kind) => perCase[kind][2]),
        strays
      );
      const results = yield* Effect.forEach(
        PropertyTypeKind.literals,
        Effect.fnUntraced(function* (kind) {
          const [value, type] = perCase[kind];
          const projected = valueCodec(type);
          const verdicts = yield* Effect.forEach(wires, (wire) => agreeOn(value, projected, wire));
          return A.every(verdicts, identity);
        })
      );
      strictEqual(A.length(wires), 47);
      deepStrictEqual(
        A.filter(A.zip(PropertyTypeKind.literals, results), ([, agreed]) => !agreed),
        []
      );
    })
  );

  it.effect(
    "accepts and round-trips every value generated from valueCodec of the same tag, and the other way round",
    Effect.fnUntraced(function* () {
      const results = yield* Effect.forEach(
        PropertyTypeKind.literals,
        Effect.fnUntraced(function* (kind) {
          const [value, type] = perCase[kind];
          const projected = valueCodec(type);
          const fromProjection = yield* Arbitrary.sampleEffect(Arbitrary.schema(projected), { count: 20, seed: 13 });
          const fromSpec = yield* Arbitrary.sampleEffect(Arbitrary.schema(value), { count: 20, seed: 13 });
          const samples = A.appendAll(fromProjection, fromSpec);
          const verdicts = yield* Effect.forEach(
            samples,
            Effect.fnUntraced(function* (sample) {
              const wire = yield* S.encodeUnknownEffect(projected)(sample);
              const agreed = yield* agreeOn(value, projected, wire);
              return agreed && S.is(value)(sample) && S.is(projected)(sample);
            })
          );
          return A.length(samples) === 40 && A.every(verdicts, identity);
        })
      );
      deepStrictEqual(
        A.filter(A.zip(PropertyTypeKind.literals, results), ([, agreed]) => !agreed),
        []
      );
    })
  );

  it.effect(
    "decodes scalars to their rich domain values",
    Effect.fnUntraced(function* () {
      const long = yield* S.decodeEffect(Model.long.value)("9007199254740993");
      const lenientLong = yield* S.decodeEffect(Model.long.value)(7);
      const decimal = yield* S.decodeEffect(Model.decimal.value)("12.50");
      const date = yield* S.decodeEffect(Model.date.value)("2021-05-01");
      const timestamp = yield* S.decodeEffect(Model.timestamp.value)("2021-01-04T05:00:00Z");
      const legacyInteger = yield* S.decodeEffect(Model.integer.value)("238940");
      deepStrictEqual([long, lenientLong, legacyInteger], [BigInt("9007199254740993"), BigInt(7), 238940]);
      deepStrictEqual([decimal.value, decimal.scale], [BigInt(1250), 2]);
      deepStrictEqual([date.year, date.month, date.day], [2021, 5, 1]);
      strictEqual(DateTime.toEpochMillis(timestamp), 1609736400000);
      const encoded = yield* Effect.all([
        S.encodeUnknownEffect(Model.long.value)(lenientLong),
        S.encodeUnknownEffect(Model.decimal.value)(decimal),
        S.encodeUnknownEffect(Model.timestamp.value)(timestamp),
      ]);
      deepStrictEqual(encoded, ["7", "12.50", "2021-01-04T05:00:00.000Z"]);
    })
  );
});

// ---------------------------------------------------------------------------
// One table: a leaf spec is its tag and the row of the property's leaf table
// ---------------------------------------------------------------------------

// The leaf spec of every leaf tag. The mapped type makes a tag without a spec a compile error.
const leafSpecs: { readonly [K in keyof typeof leafCodec]: Model.AnyPropertySpec } = {
  boolean: Model.boolean,
  byte: Model.byte,
  short: Model.short,
  integer: Model.integer,
  long: Model.long,
  float: Model.float,
  double: Model.double,
  decimal: Model.decimal,
  string: Model.string,
  date: Model.date,
  timestamp: Model.timestamp,
  marking: Model.marking,
  cipherText: Model.cipherText,
  attachment: Model.attachment,
  mediaReference: Model.mediaReference,
  geopoint: Model.geopoint,
  geoshape: Model.geoshape,
  geotimeSeriesReference: Model.geotimeSeriesReference,
  timeseries: Model.timeseries,
};

describe("leaf specs and the tables they are read from", () => {
  const leafKinds = Struct.keys(leafCodec);

  it("a leaf spec's value codec is the very row of the property's leaf table under its tag", () => {
    strictEqual(A.length(leafKinds), 19);
    deepStrictEqual(
      A.filter(leafKinds, (kind) => leafSpecs[kind].kind !== kind || leafSpecs[kind].value !== leafCodec[kind]),
      []
    );
    // So the runtime projection of the type a leaf spec denotes is the spec's own codec: one value, not two that agree.
    deepStrictEqual(
      A.filter(leafKinds, (kind) => valueCodec(Model.typeOf(leafSpecs[kind])) !== leafSpecs[kind].value),
      []
    );
  });

  it("the spec of a shared tag holds the row every universe reads, and is a value an action exchanges", () => {
    const sharedKinds = A.filter(leafKinds, S.is(SharedValueKind));
    const ownKinds = A.filter(leafKinds, P.not(S.is(SharedValueKind)));
    deepStrictEqual<ReadonlyArray<string>>(ownKinds, [
      "attachment",
      "geopoint",
      "geotimeSeriesReference",
      "timeseries",
    ]);
    strictEqual(A.length(sharedKinds), 15);
    // `member` is what admits a spec to the constructors of typed actions and queries.
    const memberOf = (spec: Model.AnyPropertySpec): O.Option<unknown> =>
      P.hasProperty(spec, "member") ? O.some(spec.member) : O.none();
    deepStrictEqual(
      A.filter(sharedKinds, (kind) => leafSpecs[kind].value !== sharedCodec[kind]),
      []
    );
    assertTrue(A.every(sharedKinds, (kind) => O.contains(memberOf(leafSpecs[kind]), sharedCodec[kind])));
    // A tag only a property reads this way is not one. Nor is an array or a struct, whose parts are held as an
    // object holds them, nor a spec marked as a primary key.
    assertTrue(A.every(ownKinds, (kind) => O.isNone(memberOf(leafSpecs[kind]))));
    deepStrictEqual(
      A.map([Model.array(Model.string), Model.struct({ city: Model.string }), Model.required(Model.string)], memberOf),
      [O.none(), O.none(), O.none()]
    );
    // A vector is read by one rule in every universe, so its spec is exchanged too.
    const embedding = Model.vector(3);
    strictEqual(embedding.member, embedding.value);
    const facts: readonly [
      Equals<typeof Model.long.member, typeof sharedCodec.long>,
      Equals<typeof Model.long.value, typeof leafCodec.long>,
      typeof Model.string extends Model.ExchangeSpec<"string"> ? true : false,
      typeof Model.attachment extends Model.ExchangeSpec ? true : false,
      typeof Model.string extends Model.ValueSpec<"string"> ? true : false,
      typeof Model.attachment extends Model.ValueSpec<"attachment"> ? true : false,
    ] = [true, true, true, false, true, true];
    deepStrictEqual(facts, [true, true, true, false, true, true]);
  });
});

// ---------------------------------------------------------------------------
// typeOf: a spec read back as the property type it denotes
// ---------------------------------------------------------------------------

describe("typeOf", () => {
  const visits = Model.array(
    Model.struct({ on: Model.date, score: Model.vector(2), badges: Model.array(Model.long), place: nameSpec })
  );
  // A spec and its value codec, for every constructor of the module.
  const row = <Value extends AnyCodec>(spec: Model.AnyPropertySpec & { readonly value: Value }) =>
    Tuple.make<readonly [Model.AnyPropertySpec, AnyCodec]>(spec, spec.value);
  const everyConstructor: ReadonlyArray<readonly [Model.AnyPropertySpec, AnyCodec]> = [
    row(Model.boolean),
    row(Model.byte),
    row(Model.short),
    row(Model.integer),
    row(Model.long),
    row(Model.float),
    row(Model.double),
    row(Model.decimal),
    row(Model.string),
    row(Model.date),
    row(Model.timestamp),
    row(Model.marking),
    row(Model.cipherText),
    row(Model.attachment),
    row(Model.mediaReference),
    row(Model.geopoint),
    row(Model.geoshape),
    row(Model.geotimeSeriesReference),
    row(Model.timeseries),
    row(Model.vector(6)),
    row(Model.array(Model.string)),
    row(nameSpec),
    row(Model.struct({})),
    row(Model.required(Model.long)),
    row(visits),
  ];

  it.effect(
    "denotes the member of PropertyType with the spec's tag, for every tag",
    Effect.fnUntraced(function* () {
      deepStrictEqual<ReadonlyArray<string>>(
        A.dedupe(A.map(everyConstructor, ([spec]) => spec.kind)),
        PropertyTypeKind.literals
      );
      assertTrue(A.every(everyConstructor, ([spec]) => Model.typeOf(spec).type === spec.kind));
      // A leaf states nothing but its tag, so it denotes exactly what the bare tag decodes to. A time series is
      // the one leaf type that must say more: the spec does not, so it denotes the item type that claims nothing.
      const plain = A.filter(Struct.keys(leafCodec), (kind) => kind !== "timeseries");
      const bare = yield* Effect.forEach(plain, (kind) => S.decodeEffect(PropertyType)({ type: kind }));
      strictEqual(A.length(plain), 18);
      deepStrictEqual(
        A.map(plain, (kind) => Model.typeOf(leafSpecs[kind])),
        bare
      );
      deepStrictEqual(Model.typeOf(Model.timeseries), TimeseriesType.make({ itemType: SensorSeriesItem.make({}) }));
    })
  );

  it("unfolds a vector, an array and a struct, names a field's rid after the field and ignores presence", () => {
    deepStrictEqual(Model.typeOf(Model.vector(6)), VectorType.make({ dimension: 6 }));
    deepStrictEqual(
      Model.typeOf(Model.array(Model.array(Model.string))),
      ArrayType.make({ elementType: ArrayType.make({ elementType: StringType.make({}) }) })
    );
    const field = (name: string, dataType: PropertyType): StructFieldType =>
      StructFieldType.make({ apiName: StructFieldApiName.make(name), rid: StructFieldTypeRid.make(name), dataType });
    // Fields come in the order they were written.
    deepStrictEqual(
      Model.typeOf(nameSpec),
      StructType.make({ fields: [field("firstName", StringType.make({})), field("lastName", StringType.make({}))] })
    );
    deepStrictEqual(Model.typeOf(Model.struct({})), StructType.make({ fields: [] }));
    deepStrictEqual(Model.typeOf(Model.required(Model.long)), LongType.make({}));
    deepStrictEqual(Model.typeOf(Model.required(Model.array(Model.double))), Model.typeOf(Model.array(Model.double)));
    deepStrictEqual(
      Model.typeOf(visits),
      ArrayType.make({
        elementType: StructType.make({
          fields: [
            field("on", DateType.make({})),
            field("score", VectorType.make({ dimension: 2 })),
            field("badges", ArrayType.make({ elementType: LongType.make({}) })),
            field("place", Model.typeOf(nameSpec)),
          ],
        }),
      })
    );
    // A struct field needs a name: the empty one is refused where the spec is written, as every name of the
    // metamodel is, so typeOf has no struct spec to refuse. A hand-written shape is the only way to state one.
    throws(() => Model.struct({ "": Model.string }));
    throws(() => Model.struct({ city: Model.string, "": Model.array(Model.long) }));
    throws(() => Model.typeOf({ ...nameSpec, shape: { type: "struct", fields: { "": Model.string } } }));
    deepStrictEqual(
      Model.typeOf(Model.struct({ " ": Model.string })),
      StructType.make({ fields: [field(" ", StringType.make({}))] })
    );
  });

  it("takes a spec whose tag and shape are in step, and nothing else", () => {
    const embedding = Model.vector(3);
    // @ts-expect-error a spec tagged a vector states a dimension: a leaf shape is not its shape
    const shapeless: Model.AnyPropertySpec = { ...embedding, shape: { type: "leaf" } };
    // @ts-expect-error nor is the shape of an array the shape of a vector
    const listed: Model.AnyPropertySpec = { ...embedding, shape: Model.array(Model.string).shape };
    // @ts-expect-error a spec of an action or a query is not a property spec
    const exchanged: Model.AnyPropertySpec = { kind: "set", value: S.String, shape: { type: "leaf" } };
    strictEqual(A.length([shapeless, listed, exchanged]), 3);
    deepStrictEqual(
      Model.typeOf({ ...embedding, shape: { type: "vector", dimension: 4 } }),
      VectorType.make({ dimension: 4 })
    );
  });

  // Law: the runtime projection of the type a spec denotes reads the values the spec's own codec reads.
  it.effect(
    "Property.valueCodec(typeOf(spec)) and spec.value agree on generated values, for every spec constructor",
    Effect.fnUntraced(function* () {
      const results = yield* Effect.forEach(
        everyConstructor,
        Effect.fnUntraced(function* ([spec, value]) {
          const projected = valueCodec(Model.typeOf(spec));
          const fromProjection = yield* Arbitrary.sampleEffect(Arbitrary.schema(projected), { count: 20, seed: 17 });
          const fromSpec = yield* Arbitrary.sampleEffect(Arbitrary.schema(value), { count: 20, seed: 17 });
          const samples = A.appendAll(fromProjection, fromSpec);
          const verdicts = yield* Effect.forEach(
            samples,
            Effect.fnUntraced(function* (sample) {
              const wire = yield* S.encodeUnknownEffect(projected)(sample);
              const agreed = yield* agreeOn(value, projected, wire);
              return agreed && S.is(value)(sample) && S.is(projected)(sample);
            })
          );
          // The same verdict on values that belong to no tag. One spec is left out, for one reason: a struct with
          // no fields drops an undeclared key when it is a typed spec and refuses it when it is projected
          // (`S.Record(S.String, S.Never)`, held by `Property.test.ts`). The two rules of a field-less struct are
          // still written twice; what they share is held by the test of that name below.
          const fieldless = spec.kind === "struct" && R.isEmptyRecord(spec.shape.fields);
          const strayVerdicts = yield* Effect.forEach(fieldless ? [] : strays, (stray) =>
            agreeOn(value, projected, stray)
          );
          return A.length(samples) === 40 && A.every(verdicts, identity) && A.every(strayVerdicts, identity);
        })
      );
      strictEqual(A.length(results), 25);
      deepStrictEqual(
        A.filter(A.zip(A.map(everyConstructor, ([spec]) => spec.kind), results), ([, agreed]) => !agreed),
        []
      );
    })
  );
});

// ---------------------------------------------------------------------------
// Presence: `field` is an Option unless the spec is required
// ---------------------------------------------------------------------------

describe("spec fields and required", () => {
  it.effect(
    "decodes an absent key and an explicit null to none, and a present value with the value codec",
    Effect.fnUntraced(function* () {
      const Row = S.Struct({
        nickname: Model.string.field,
        balance: Model.long.field,
        joined: Model.date.field,
        scores: Model.array(Model.double).field,
      });
      const absent = yield* S.decodeEffect(Row)({});
      const explicitNull = yield* S.decodeEffect(Row)({
        nickname: null,
        balance: null,
        joined: null,
        scores: null,
      });
      const none = { nickname: O.none(), balance: O.none(), joined: O.none(), scores: O.none() };
      deepStrictEqual<unknown>(absent, none);
      deepStrictEqual<unknown>(explicitNull, none);
      const present = yield* S.decodeEffect(Row)({
        nickname: "Ishmael",
        balance: "58319870951433",
        joined: "2021-05-01",
        scores: [95.5, 88.2],
      });
      assertSome(present.nickname, "Ishmael");
      assertSome(present.balance, BigInt("58319870951433"));
      assertSome(
        O.map(present.joined, (date) => date.toISOString()),
        "2021-05-01"
      );
      assertSome(present.scores, [95.5, 88.2]);
      // Encoding omits an absent field instead of writing null.
      const encodedAbsent = yield* S.encodeEffect(Row)(absent);
      const encodedNull = yield* S.encodeEffect(Row)(explicitNull);
      const encodedPresent = yield* S.encodeEffect(Row)(present);
      deepStrictEqual<unknown>([encodedAbsent, encodedNull], [{}, {}]);
      deepStrictEqual<unknown>(encodedPresent, {
        nickname: "Ishmael",
        balance: "58319870951433",
        joined: "2021-05-01",
        scores: [95.5, 88.2],
      });
      const refused = yield* Effect.all([
        rejects(Row)({ balance: "" }),
        rejects(Row)({ joined: "2021-02-30" }),
        rejects(Row)({ scores: [95.5, "eighty-eight"] }),
        rejects(Row)({ nickname: 7 }),
      ]);
      assertTrue(A.every(refused, identity));
    })
  );

  it.effect(
    "has the same field codec as fieldCodec of the same tag, for every tag",
    Effect.fnUntraced(function* () {
      // The spec's field wraps the spec's value the way `fieldCodec` wraps `valueCodec`.
      const results = yield* Effect.forEach(
        PropertyTypeKind.literals,
        Effect.fnUntraced(function* (kind) {
          const [value, type, wire, canonical] = perCase[kind];
          const BySpec = S.Struct({ property: S.OptionFromOptionalNullOr(value) });
          const ByProjection = S.Struct({ property: fieldCodec(type) });
          const verdicts = yield* Effect.forEach([{}, { property: null }, { property: wire }, { property: {} }], (row) =>
            agreeOn(BySpec, ByProjection, row)
          );
          const present = yield* S.decodeEffect(BySpec)({ property: wire });
          const encoded = yield* S.encodeUnknownEffect(BySpec)(present);
          deepStrictEqual(encoded, { property: canonical });
          return A.every(verdicts, identity);
        })
      );
      deepStrictEqual(
        A.filter(A.zip(PropertyTypeKind.literals, results), ([, agreed]) => !agreed),
        []
      );
    })
  );

  it.effect(
    "required keeps the tag and the value codec, drops the Option and makes the key mandatory",
    Effect.fnUntraced(function* () {
      const employeeId = Model.required(Model.integer);
      strictEqual(employeeId.kind, "integer");
      strictEqual(employeeId.presence, "required");
      strictEqual(employeeId.value, Model.integer.value);
      // A required field is the bare value codec, not an Option of it.
      strictEqual(employeeId.field, Model.integer.value);
      deepStrictEqual(employeeId.shape, { type: "leaf" });
      const Row = S.Struct({ employeeId: employeeId.field, fullName: Model.string.field });
      const decoded = yield* S.decodeEffect(Row)({ employeeId: 50030 });
      deepStrictEqual<unknown>(decoded, { employeeId: 50030, fullName: O.none() });
      const legacy = yield* S.decodeEffect(Row)({ employeeId: "50030", fullName: "John Doe" });
      deepStrictEqual<unknown>(legacy, { employeeId: 50030, fullName: O.some("John Doe") });
      const encoded = yield* S.encodeEffect(Row)(decoded);
      deepStrictEqual<unknown>(encoded, { employeeId: 50030 });
      const refused = yield* Effect.all([
        rejects(Row)({}),
        rejects(Row)({ fullName: "John Doe" }),
        rejects(Row)({ employeeId: null }),
        rejects(Row)({ employeeId: undefined }),
        rejects(Row)({ employeeId: 1.5 }),
      ]);
      assertTrue(A.every(refused, identity));
      // The optional field of the same spec accepts all of the shapes the required one refuses for absence.
      const Optional = S.Struct({ employeeId: Model.integer.field });
      const accepted = yield* Effect.all([rejects(Optional)({}), rejects(Optional)({ employeeId: null })]);
      deepStrictEqual(accepted, [false, false]);
    })
  );

  it("required keeps the element of an array spec and the fields of a struct spec, and is idempotent", () => {
    const tags = Model.array(Model.string);
    const requiredTags = Model.required(tags);
    strictEqual(requiredTags.kind, "array");
    strictEqual(requiredTags.shape, tags.shape);
    strictEqual(requiredTags.shape.element, Model.string);
    strictEqual(requiredTags.value, tags.value);
    const address = Model.struct({ city: Model.string });
    const requiredAddress = Model.required(address);
    strictEqual(requiredAddress.kind, "struct");
    strictEqual(requiredAddress.shape, address.shape);
    strictEqual(requiredAddress.shape.fields, address.shape.fields);
    const twice = Model.required(requiredAddress);
    deepStrictEqual([twice.presence, twice.kind], ["required", "struct"]);
    strictEqual(twice.field, requiredAddress.field);
  });

  // The platform guarantees a value for the primary key and for nothing else, so a required spec is a
  // primary key's spec. A struct is never a key and none of its fields is guaranteed.
  it("struct accepts optional field specs only: a required field is a compile error", () => {
    const requiredCity = Model.required(Model.string);
    const facts: readonly [
      Equals<typeof requiredCity.presence, "required">,
      Equals<typeof Model.string.presence, "optional">,
      // What `struct` asks of a field: any tag, any codec of a property (one that needs no service), and the
      // optional presence.
      typeof Model.string extends Model.PropertySpec<PropertyTypeKind, PropertyCodec, PropertyCodec, "optional">
        ? true
        : false,
      typeof requiredCity extends Model.PropertySpec<PropertyTypeKind, PropertyCodec, PropertyCodec, "optional">
        ? true
        : false,
      Parameters<typeof Model.struct>[0] extends Readonly<
        Record<string, Model.PropertySpec<PropertyTypeKind, PropertyCodec, PropertyCodec, "optional">>
      >
        ? true
        : false,
    ] = [true, true, true, false, true];
    deepStrictEqual(facts, [true, true, true, false, true]);

    // @ts-expect-error a struct field can be absent, so its spec cannot be required
    Model.struct({ city: requiredCity });
    // @ts-expect-error one required field among optional ones is still refused
    Model.struct({ city: Model.string, zip: Model.required(Model.integer) });
    // @ts-expect-error a required composite field is refused like a required scalar
    Model.struct({ lines: Model.required(Model.array(Model.string)) });
    // @ts-expect-error the rule holds at every depth
    Model.struct({ address: Model.struct({ city: Model.required(Model.string) }) });
    // @ts-expect-error and inside the element of an array
    Model.array(Model.struct({ city: Model.required(Model.string) }));

    // Every field of a struct spec is therefore optional, as data too.
    const address = Model.struct({ city: Model.string, zip: Model.integer, lines: Model.array(Model.string) });
    deepStrictEqual(
      A.map(R.values(address.shape.fields), (field) => field.presence),
      ["optional", "optional", "optional"]
    );
  });
});

// ---------------------------------------------------------------------------
// Composite specs: vector, array and struct
// ---------------------------------------------------------------------------

describe("vector, array and struct specs", () => {
  it.effect(
    "vector enforces the dimension it was built with, when decoding, encoding and generating",
    Effect.fnUntraced(function* () {
      const embedding = Model.vector(3);
      strictEqual(embedding.kind, "vector");
      // The dimension is data in the spec's shape, kept through `required` and absent from composites built around it.
      deepStrictEqual(embedding.shape, { type: "vector", dimension: 3 });
      deepStrictEqual(Model.required(embedding).shape, { type: "vector", dimension: 3 });
      strictEqual(Model.array(embedding).shape.type, "list");
      strictEqual(Model.struct({ embedding }).shape.type, "struct");
      // @ts-expect-error an array spec states its element, not a dimension
      const ofArray: unknown = Model.array(embedding).shape.dimension;
      // @ts-expect-error a struct spec states its fields, not a dimension
      const ofStruct: unknown = Model.struct({ embedding }).shape.dimension;
      deepStrictEqual([ofArray, ofStruct], [undefined, undefined]);
      // A dimension no vector type could state is refused where the spec is written.
      throws(() => Model.vector(0));
      throws(() => Model.vector(-3));
      throws(() => Model.vector(2.5));
      const exact = yield* S.decodeEffect(embedding.value)([0.1, 0.2, 0.3]);
      deepStrictEqual(exact, [0.1, 0.2, 0.3]);
      const verdicts = yield* Effect.all([
        rejects(embedding.value)([]),
        rejects(embedding.value)([0.1, 0.2]),
        rejects(embedding.value)([0.1, 0.2, 0.3, 0.4]),
        rejects(embedding.value)([0.1, 0.2, "0.3"]),
        rejects(embedding.value)([0.1, 0.2, Number.NaN]),
        Effect.map(Effect.exit(S.encodeUnknownEffect(embedding.value)([0.1, 0.2])), Exit.isFailure),
        Effect.map(Effect.exit(S.encodeUnknownEffect(embedding.value)([0.1, 0.2, 0.3, 0.4])), Exit.isFailure),
      ]);
      assertTrue(A.every(verdicts, identity));
      deepStrictEqual(
        [
          S.is(embedding.value)([1, 2, 3]),
          S.is(embedding.value)([1, 2]),
          S.is(Model.vector(2).value)([1, 2]),
          S.is(Model.vector(1).value)([7]),
          S.is(Model.vector(1).value)([]),
        ],
        [true, false, true, true, false]
      );
      const generated = yield* Arbitrary.sampleEffect(Arbitrary.schema(Model.vector(4).value), { count: 30, seed: 4 });
      deepStrictEqual(A.dedupe(A.map(generated, A.length)), [4]);
      // The same dimension as a property type projects to a codec with the same verdicts.
      const projected = valueCodec(VectorType.make({ dimension: 3 }));
      const agreed = yield* Effect.forEach([[0.1, 0.2, 0.3], [0.1, 0.2], [0.1, 0.2, 0.3, 0.4], []], (wire) =>
        agreeOn(embedding.value, projected, wire)
      );
      deepStrictEqual(agreed, [true, true, true, true]);
      // Absent as a field like any other spec.
      const Row = S.Struct({ embedding: embedding.field });
      const absent = yield* S.decodeEffect(Row)({});
      deepStrictEqual<unknown>(absent, { embedding: O.none() });
    })
  );

  it.effect(
    "array remembers its element spec and decodes element by element",
    Effect.fnUntraced(function* () {
      const longs = Model.array(Model.long);
      strictEqual(longs.kind, "array");
      strictEqual(longs.presence, "optional");
      strictEqual(longs.shape.type, "list");
      strictEqual(longs.shape.element, Model.long);
      deepStrictEqual(R.keys(longs.shape), ["type", "element"]);
      const decoded = yield* S.decodeEffect(longs.value)(["1", 2, "9223372036854775807"]);
      deepStrictEqual(decoded, [BigInt(1), BigInt(2), BigInt("9223372036854775807")]);
      const encoded = yield* S.encodeUnknownEffect(longs.value)(decoded);
      deepStrictEqual(encoded, ["1", "2", "9223372036854775807"]);
      const empty = yield* S.decodeEffect(longs.value)([]);
      deepStrictEqual(empty, []);
      const verdicts = yield* Effect.all([
        rejects(longs.value)(["1", null]),
        rejects(longs.value)(["1", 2.5]),
        rejects(longs.value)("1"),
        rejects(longs.value)(null),
        rejects(longs.value)({ 0: "1" }),
      ]);
      assertTrue(A.every(verdicts, identity));
    })
  );

  it.effect(
    "struct remembers its field specs, decodes each field with its own spec and strips undeclared keys",
    Effect.fnUntraced(function* () {
      const payment = Model.struct({
        amount: Model.long,
        paidAt: Model.timestamp,
        year: Model.integer,
      });
      strictEqual(payment.kind, "struct");
      deepStrictEqual(R.keys(payment.shape), ["type", "fields"]);
      strictEqual(payment.shape.type, "struct");
      deepStrictEqual(A.sort(R.keys(payment.shape.fields), Order.String), ["amount", "paidAt", "year"]);
      assertSome(
        O.map(R.get(payment.shape.fields, "amount"), (field) => field.presence),
        "optional"
      );
      strictEqual(O.getOrNull(R.get(payment.shape.fields, "amount")), Model.long);
      strictEqual(O.getOrNull(R.get(payment.shape.fields, "year")), Model.integer);
      const decoded = yield* S.decodeUnknownEffect(payment.value)({
        amount: "58319870951433",
        paidAt: "2021-01-04T05:00:00Z",
        year: "2021",
        undeclared: "dropped",
      });
      assertSome(decoded.amount, BigInt("58319870951433"));
      assertSome(O.map(decoded.paidAt, DateTime.toEpochMillis), 1609736400000);
      assertSome(decoded.year, 2021);
      deepStrictEqual(A.sort(R.keys(decoded), Order.String), ["amount", "paidAt", "year"]);
      const encoded = yield* S.encodeEffect(payment.value)(decoded);
      deepStrictEqual<unknown>(encoded, {
        amount: "58319870951433",
        paidAt: "2021-01-04T05:00:00.000Z",
        year: 2021,
      });
      const partial = yield* S.decodeEffect(payment.value)({ amount: 7, year: null });
      deepStrictEqual<unknown>(partial, { amount: O.some(BigInt(7)), paidAt: O.none(), year: O.none() });
      // No field is guaranteed, so a struct value with none of them is a struct value: every field reads as none.
      const sparse = yield* Effect.all([
        S.decodeEffect(payment.value)({}),
        S.decodeEffect(payment.value)({ amount: null }),
      ]);
      const none = { amount: O.none(), paidAt: O.none(), year: O.none() };
      deepStrictEqual<unknown>(sparse, [none, none]);
      const verdicts = yield* Effect.all([
        rejects(payment.value)({ amount: "" }),
        rejects(payment.value)({ amount: "1", year: 1.5 }),
        rejects(payment.value)({ amount: "1", paidAt: "2021-01-04" }),
        rejects(payment.value)([]),
        rejects(payment.value)("struct"),
        rejects(payment.value)(null),
      ]);
      assertTrue(A.every(verdicts, identity));
    })
  );

  it.effect(
    "array and struct nest in both directions, exactly like the nested property types",
    Effect.fnUntraced(function* () {
      // The `bonusHistory` shape of the OSDK stub: an array of `{ year, amount }` structs.
      const bonusHistory = Model.array(Model.struct({ year: Model.integer, amount: Model.integer }));
      const bonusHistoryType = ArrayType.make({
        elementType: StructType.make({
          fields: [structField("year", IntegerType.make({})), structField("amount", IntegerType.make({}))],
        }),
      });
      const wire = [{ year: 2023, amount: 5000 }, { year: 2024 }, {}];
      const decoded = yield* S.decodeEffect(bonusHistory.value)(wire);
      deepStrictEqual<unknown>(decoded, [
        { year: O.some(2023), amount: O.some(5000) },
        { year: O.some(2024), amount: O.none() },
        { year: O.none(), amount: O.none() },
      ]);
      const encoded = yield* S.encodeEffect(bonusHistory.value)(decoded);
      deepStrictEqual<unknown>(encoded, wire);
      const sameAsProjection = yield* Effect.forEach([wire, [], [{ year: "x" }], [null], {}], (input) =>
        agreeOn(bonusHistory.value, valueCodec(bonusHistoryType), input)
      );
      deepStrictEqual(sameAsProjection, [true, true, true, true, true]);
      strictEqual(bonusHistory.shape.element.kind, "struct");

      // A struct holding an array of arrays and a struct.
      const profile = Model.struct({
        matrix: Model.array(Model.array(Model.long)),
        address: Model.struct({ city: Model.string, zip: Model.integer }),
      });
      const profileWire = { matrix: [["1", "2"], [], ["9223372036854775807"]], address: { city: "NYC" } };
      const nested = yield* S.decodeEffect(profile.value)(profileWire);
      deepStrictEqual<unknown>(nested, {
        matrix: O.some([[BigInt(1), BigInt(2)], [], [BigInt("9223372036854775807")]]),
        address: O.some({ city: O.some("NYC"), zip: O.none() }),
      });
      const nestedEncoded = yield* S.encodeEffect(profile.value)(nested);
      deepStrictEqual<unknown>(nestedEncoded, profileWire);
      // A nested struct that is present with none of its fields is a struct whose fields are all none, not an error.
      const hollow = yield* Effect.all([
        S.decodeEffect(profile.value)({ address: {} }),
        S.decodeEffect(profile.value)({ address: { city: null } }),
      ]);
      const hollowAddress = { matrix: O.none(), address: O.some({ city: O.none(), zip: O.none() }) };
      deepStrictEqual<unknown>(hollow, [hollowAddress, hollowAddress]);
      const verdicts = yield* Effect.all([
        rejects(profile.value)({ matrix: [["1", "x"]] }),
        rejects(profile.value)({ matrix: ["1"] }),
        rejects(profile.value)({ address: { city: 7 } }),
        rejects(profile.value)({ address: "NYC" }),
      ]);
      assertTrue(A.every(verdicts, identity));
    })
  );

  // Law: a struct spec with no fields accepts a record and nothing else, exactly as `valueCodec` does for a struct
  // type with no fields.
  it.effect(
    "a struct spec with no fields accepts only records, like valueCodec of a field-less struct type",
    Effect.fnUntraced(function* () {
      const empty = Model.struct({});
      const projected = valueCodec(StructType.make({ fields: [] }));
      const agreed = yield* Effect.forEach(["not a struct", 42, true, [], {}], (wire) =>
        agreeOn(empty.value, projected, wire)
      );
      deepStrictEqual(agreed, [true, true, true, true, true]);
    })
  );
});

// ---------------------------------------------------------------------------
// fieldsOf: from a record of specs to the fields of a struct
// ---------------------------------------------------------------------------

describe("fieldsOf", () => {
  // The specs a struct may hold: all optional.
  const optionalSpecs = {
    name: Model.string,
    balance: Model.long,
    joined: Model.date,
    tags: Model.array(Model.string),
    address: Model.struct({ city: Model.string, zip: Model.integer }),
  };
  // The specs of an object: the same, plus one required spec, as a primary key is.
  const specs = { ...optionalSpecs, age: Model.required(Model.integer) };
  const fields = Model.fieldsOf(specs);
  const Row = S.Struct(fields);

  it("maps every spec to its own field codec, key by key", () => {
    deepStrictEqual(A.sort(R.keys(fields), Order.String), ["address", "age", "balance", "joined", "name", "tags"]);
    strictEqual(fields.name, specs.name.field);
    strictEqual(fields.age, specs.age.field);
    strictEqual(fields.age, Model.integer.value);
    strictEqual(fields.balance, Model.long.field);
    strictEqual(fields.tags, specs.tags.field);
    strictEqual(fields.address, specs.address.field);
    deepStrictEqual(R.keys(Model.fieldsOf({})), []);
  });

  it("gives the struct the precise type of every field", () => {
    type RowType = typeof Row.Type;
    const facts: readonly [
      Equals<
        RowType,
        {
          readonly name: O.Option<string>;
          readonly age: number;
          readonly balance: O.Option<bigint>;
          readonly joined: O.Option<LocalDate>;
          readonly tags: O.Option<ReadonlyArray<string>>;
          readonly address: O.Option<{ readonly city: O.Option<string>; readonly zip: O.Option<number> }>;
        }
      >,
      Equals<RowType["age"], number>,
      Equals<RowType["balance"], O.Option<bigint>>,
      Equals<keyof RowType, "name" | "age" | "balance" | "joined" | "tags" | "address">,
      // A required key is required on the wire; an optional one may be absent.
      {} extends Pick<typeof Row.Encoded, "age"> ? true : false,
      {} extends Pick<typeof Row.Encoded, "name"> ? true : false,
      Equals<(typeof Row.Encoded)["age"], number | string>,
    ] = [true, true, true, true, false, true, true];
    deepStrictEqual(facts, [true, true, true, true, false, true, true]);
  });

  it.effect(
    "yields a struct whose decoded value has exactly the declared keys",
    Effect.fnUntraced(function* () {
      const minimal = yield* S.decodeUnknownEffect(Row)({ age: 41, undeclared: true, __rid: "ri.x" });
      deepStrictEqual(A.sort(R.keys(minimal), Order.String), ["address", "age", "balance", "joined", "name", "tags"]);
      deepStrictEqual<unknown>(minimal, {
        name: O.none(),
        age: 41,
        balance: O.none(),
        joined: O.none(),
        tags: O.none(),
        address: O.none(),
      });
      const full = yield* S.decodeEffect(Row)({
        name: "Ishmael",
        age: "41",
        balance: 58319870951433,
        joined: "2021-05-01",
        tags: ["a", "b"],
        address: { city: "NYC", zip: null },
      });
      deepStrictEqual(A.sort(R.keys(full), Order.String), ["address", "age", "balance", "joined", "name", "tags"]);
      strictEqual(full.age, 41);
      assertSome(full.name, "Ishmael");
      assertSome(full.balance, BigInt("58319870951433"));
      assertSome(full.tags, ["a", "b"]);
      assertSome(
        O.map(full.address, ({ city, zip }) => [city, O.isNone(zip)]),
        [O.some("NYC"), true]
      );
      // A struct that is present with none of its fields decodes: nothing guarantees a field of a struct.
      const hollow = yield* S.decodeEffect(Row)({ age: 41, address: {} });
      assertSome(hollow.address, { city: O.none(), zip: O.none() });
      const encodedMinimal = yield* S.encodeEffect(Row)(minimal);
      const encodedFull = yield* S.encodeEffect(Row)(full);
      deepStrictEqual<unknown>(encodedMinimal, { age: 41 });
      deepStrictEqual<unknown>(encodedFull, {
        name: "Ishmael",
        age: 41,
        balance: "58319870951433",
        joined: "2021-05-01",
        tags: ["a", "b"],
        address: { city: "NYC" },
      });
      const refused = yield* Effect.all([
        // The one required spec makes its key mandatory; the optional ones never do.
        rejects(Row)({}),
        rejects(Row)({ age: null }),
        rejects(Row)({ name: "Ishmael", balance: 1, joined: "2021-05-01", tags: [], address: {} }),
        rejects(Row)({ age: 41, address: { city: 7 } }),
        rejects(Row)({ age: 41, balance: "" }),
      ]);
      assertTrue(A.every(refused, identity));
    })
  );

  it.effect(
    "is what struct builds its value codec from",
    Effect.fnUntraced(function* () {
      const OptionalRow = S.Struct(Model.fieldsOf(optionalSpecs));
      const viaStruct = Model.struct(optionalSpecs);
      strictEqual(viaStruct.shape.fields, optionalSpecs);
      // @ts-expect-error a record with a required spec projects to fields, but it is not a struct's record
      Model.struct(specs);
      const wires = [
        {},
        { name: "Ishmael", tags: ["a"] },
        { balance: "41", joined: "2021-05-01", address: { zip: 10001 } },
        { address: {} },
        { address: { city: 7 } },
        { tags: "a" },
        null,
      ];
      const agreed = yield* Effect.forEach(wires, (wire) => agreeOn(viaStruct.value, OptionalRow, wire));
      deepStrictEqual(agreed, [true, true, true, true, true, true, true]);
      const accepted = yield* Effect.forEach(wires, (wire) => rejects(viaStruct.value)(wire));
      deepStrictEqual(accepted, [false, false, false, false, true, true, true]);
      const samples = yield* Arbitrary.sampleEffect(Arbitrary.schema(OptionalRow), { count: 25, seed: 21 });
      assertTrue(A.every(samples, S.is(viaStruct.value)));
      assertTrue(
        A.every(samples, (sample) =>
          Order.Array(Order.String)(A.sort(R.keys(sample), Order.String), [
            "address",
            "balance",
            "joined",
            "name",
            "tags",
          ]) === 0
        )
      );
    })
  );
});
