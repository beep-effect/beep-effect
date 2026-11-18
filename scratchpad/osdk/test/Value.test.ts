import { daysInMonth, LocalDate } from "@beep/schema/LocalDate";
import { fcRuns } from "@beep/test-utils";
import { describe, it } from "@effect/vitest";
import { assertFalse, assertTrue, deepStrictEqual, strictEqual } from "@effect/vitest/utils";
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
import * as Str from "effect/String";
import * as Action from "../src/Action/index.ts";
import * as Agent from "../src/Agent/index.ts";
import { CipherText } from "../src/CipherText/index.ts";
import {
  ActionParameterTypeKind,
  PropertyTypeKind,
  QueryDataTypeKind,
  SharedValueKind,
} from "../src/DataType/index.ts";
import { GeoJsonObject } from "../src/Geo/index.ts";
import { MarkingId } from "../src/Identifier/index.ts";
import { MediaReference } from "../src/Media/index.ts";
import * as Property from "../src/Property/index.ts";
import * as Query from "../src/Query/index.ts";
import * as Value from "../src/Value/index.ts";
import {
  BinaryValue,
  BooleanValue,
  ByteValue,
  DateValue,
  DecimalValue,
  DoubleValue,
  FloatValue,
  IntegerValue,
  LongValue,
  MarkingValue,
  ScalarValue,
  ShortValue,
  StringValue,
  sharedCodec,
  TimestampValue,
  VectorOf,
  VectorValue,
} from "../src/Value/index.ts";

// ---------------------------------------------------------------------------
// Laws shared by every named schema
// ---------------------------------------------------------------------------

const generates = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  const is = S.is(schema);

  it.prop(`${name}: generated values satisfy the schema guard`, [Arbitrary.schema(schema)], ([value]) => is(value), {
    arbitrary: fcRuns(50),
  });
};

const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>, arbitrary: Arbitrary.Arbitrary<T>): void => {
  const equivalence = S.toEquivalence(schema);
  const encode = S.encodeEffect(schema);
  const decode = S.decodeEffect(schema);

  it.effect.prop(
    `${name}: encode then decode is equivalent to the original`,
    [arbitrary],
    Effect.fnUntraced(function* ([value]) {
      const encoded = yield* encode(value);
      const decoded = yield* decode(encoded);
      assertTrue(equivalence(decoded, value));
    }),
    { arbitrary: fcRuns(50) }
  );
};

const lawful = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  generates(name, schema);
  roundTrips(name, schema, Arbitrary.schema(schema));
};

// One row of the wire's JSON encoding table: the documented example decodes to the domain value, and both the decoded
// value and the hand-built domain value encode to the canonical wire form.
const tableRow = <T, E>(
  row: string,
  schema: S.Codec<T, E>,
  wire: NoInfer<E>,
  expected: NoInfer<T>,
  canonical: NoInfer<E>
): void => {
  it.effect(
    `${row}: decodes the documented example and encodes it canonically`,
    Effect.fnUntraced(function* () {
      const decoded = yield* S.decodeEffect(schema)(wire);
      assertTrue(S.is(schema)(decoded));
      assertTrue(S.toEquivalence(schema)(decoded, expected));
      const encoded = yield* S.encodeEffect(schema)(decoded);
      deepStrictEqual(encoded, canonical);
      const fromDomain = yield* S.encodeEffect(schema)(expected);
      deepStrictEqual(fromDomain, canonical);
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

const instant = DateTime.makeUnsafe("2021-01-04T05:00:00.000Z");
const mayFirst = LocalDate.make({ year: 2021, month: 5, day: 1 });
const euler = BigDecimal.fromStringUnsafe("2.718281828");
const longExample = BigInt("58319870951433");
const longMaximum = BigInt("9223372036854775807");
const longMinimum = BigInt("-9223372036854775808");

// ---------------------------------------------------------------------------
// The module surface
// ---------------------------------------------------------------------------

describe("Value module", () => {
  it("exports one codec per scalar tag, the vector rule, the operand union and the shared table", () => {
    const exported: ReadonlyArray<string> = R.keys(Value);
    deepStrictEqual(A.sort(exported, Order.String), [
      "BinaryValue",
      "BooleanValue",
      "ByteValue",
      "DateValue",
      "DecimalValue",
      "DoubleValue",
      "FloatValue",
      "IntegerValue",
      "LongValue",
      "MarkingValue",
      "ScalarValue",
      "ShortValue",
      "StringValue",
      "TimestampValue",
      "VectorOf",
      "VectorValue",
      "sharedCodec",
    ]);
  });

  it("has the documented JSON encoding as each encoded side and the rich value as each domain side", () => {
    const facts: readonly [
      Equals<typeof BooleanValue.Encoded, boolean | "true" | "false">,
      Equals<BooleanValue, boolean>,
      Equals<typeof ByteValue.Encoded, number | string>,
      Equals<ByteValue, number>,
      Equals<typeof ShortValue.Encoded, number | string>,
      Equals<typeof IntegerValue.Encoded, number | string>,
      Equals<typeof FloatValue.Encoded, number | string>,
      Equals<typeof DoubleValue.Encoded, number | string>,
      Equals<DoubleValue, number>,
      // Long and decimal travel as strings; decoding is also lenient towards a JSON number.
      Equals<typeof LongValue.Encoded, string | number>,
      Equals<LongValue, bigint>,
      Equals<typeof DecimalValue.Encoded, string | number>,
      Equals<DecimalValue, BigDecimal.BigDecimal>,
      Equals<typeof DateValue.Encoded, string>,
      Equals<DateValue, LocalDate>,
      Equals<typeof TimestampValue.Encoded, string>,
      Equals<TimestampValue, DateTime.Utc>,
      Equals<typeof BinaryValue.Encoded, string>,
      Equals<typeof MarkingValue.Encoded, string>,
      Equals<MarkingValue, MarkingId>,
      Equals<typeof VectorValue.Encoded, ReadonlyArray<number>>,
      Equals<typeof ScalarValue.Encoded, string | number | boolean>,
      Equals<ScalarValue, string | number | boolean>,
    ] = [
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
      true,
      true,
      true,
      true,
      true,
      true,
    ];
    assertTrue(A.every(facts, identity));
  });
});

// ---------------------------------------------------------------------------
// The shared table: one row per tag every universe reads alike
// ---------------------------------------------------------------------------

describe("sharedCodec", () => {
  it("has exactly the tags of SharedValueKind, in the kit's order", () => {
    const keys: ReadonlyArray<string> = R.keys(sharedCodec);
    deepStrictEqual(keys, A.fromIterable<string>(SharedValueKind.literals));
    strictEqual(A.length(keys), 16);
    assertTrue(A.every(SharedValueKind.literals, (tag) => S.isSchema(sharedCodec[tag])));
  });

  it("holds the codec declared for each tag, as that very value and with that very type", () => {
    // One pair per row: the row, and the codec the tag is documented to have.
    const rows: ReadonlyArray<readonly [unknown, unknown]> = [
      [sharedCodec.boolean, BooleanValue],
      [sharedCodec.byte, ByteValue],
      [sharedCodec.short, ShortValue],
      [sharedCodec.integer, IntegerValue],
      [sharedCodec.long, LongValue],
      [sharedCodec.float, FloatValue],
      [sharedCodec.double, DoubleValue],
      [sharedCodec.decimal, DecimalValue],
      [sharedCodec.string, StringValue],
      [sharedCodec.date, DateValue],
      [sharedCodec.timestamp, TimestampValue],
      [sharedCodec.binary, BinaryValue],
      [sharedCodec.marking, MarkingValue],
      [sharedCodec.cipherText, CipherText],
      [sharedCodec.mediaReference, MediaReference],
      [sharedCodec.geoshape, GeoJsonObject],
    ];
    strictEqual(A.length(rows), A.length(SharedValueKind.literals));
    assertTrue(A.every(rows, ([row, codec]) => row === codec));
    const facts: readonly [
      Equals<typeof sharedCodec.long, typeof LongValue>,
      Equals<(typeof sharedCodec.long)["Type"], bigint>,
      Equals<(typeof sharedCodec.decimal)["Type"], BigDecimal.BigDecimal>,
      Equals<(typeof sharedCodec.date)["Type"], LocalDate>,
      Equals<(typeof sharedCodec.timestamp)["Type"], DateTime.Utc>,
      Equals<(typeof sharedCodec.binary)["Type"], Uint8Array>,
      Equals<(typeof sharedCodec.cipherText)["Type"], CipherText>,
      Equals<(typeof sharedCodec.mediaReference)["Type"], MediaReference>,
      Equals<keyof typeof sharedCodec, SharedValueKind>,
    ] = [true, true, true, true, true, true, true, true, true];
    assertTrue(A.every(facts, identity));
    // @ts-expect-error an attachment is read differently by a property and by an argument, so it has no row
    const absent: unknown = sharedCodec.attachment;
    strictEqual(absent, undefined);
  });

  // Law: a universe never reads a shared tag its own way. For every universe and every shared tag it has, the
  // codec its projection gives the bare tag is the row of the shared table: the same value, not an equal one.
  // A universe that writes a row of its own for a shared tag, or a table that loses one, fails here.
  const readsTheSharedTable = <Type>(
    universe: string,
    tags: ReadonlyArray<string>,
    type: S.Codec<Type, unknown>,
    project: (type: Type) => S.Codec<unknown, unknown>,
    expected: number
  ): void => {
    it.effect(
      `${universe}: the projection gives each of its ${expected} shared tags the row of the shared table`,
      Effect.fnUntraced(function* () {
        const shared = A.filter(SharedValueKind.literals, (tag) => A.contains(tags, tag));
        strictEqual(A.length(shared), expected);
        const projected = yield* Effect.forEach(shared, (tag) =>
          Effect.map(S.decodeEffect(type)({ type: tag }), project)
        );
        deepStrictEqual(
          A.filter(A.zip(shared, projected), ([tag, codec]) => codec !== sharedCodec[tag]),
          []
        );
      })
    );
  };

  readsTheSharedTable("property", PropertyTypeKind.literals, Property.PropertyType, Property.valueCodec, 15);
  readsTheSharedTable(
    "action parameter",
    ActionParameterTypeKind.literals,
    Action.ActionParameterType,
    Action.argumentCodec,
    11
  );
  readsTheSharedTable(
    "struct parameter field",
    Action.OntologyDataTypeKind.literals,
    Action.OntologyDataType,
    Action.fieldValueCodec,
    15
  );
  readsTheSharedTable("query", QueryDataTypeKind.literals, Query.QueryDataType, Query.valueCodec({}), 10);
  readsTheSharedTable("agent", Agent.AgentDataTypeKind.literals, Agent.AgentDataType, Agent.valueCodec, 9);

  it("each universe's leaf table holds the shared rows as they are and adds only tags the shared table lacks", () => {
    const sharedTags: ReadonlyArray<string> = SharedValueKind.literals;
    const tables: ReadonlyArray<Readonly<Record<string, unknown>>> = [
      Property.leafCodec,
      Action.leafCodec,
      Query.leafCodec,
    ];
    const shared: Readonly<Record<string, unknown>> = sharedCodec;
    const isSharedRow = ([tag, codec]: readonly [string, unknown]): boolean =>
      !A.contains(sharedTags, tag) || codec === R.get(shared, tag).pipe(O.getOrNull);
    assertTrue(A.every(tables, (table) => A.every(R.toEntries(table), isSharedRow)));
    // What each universe reads for itself, by tag.
    const own = (table: Readonly<Record<string, unknown>>) => A.difference(R.keys(table), sharedTags);
    deepStrictEqual(A.map(tables, own), [
      ["attachment", "geopoint", "geotimeSeriesReference", "timeseries"],
      [
        "attachment",
        "geohash",
        "timeSeriesReference",
        "object",
        "objectSet",
        "interfaceObject",
        "objectType",
        "scenarioReference",
        "map",
        "any",
        "unsupported",
      ],
      ["attachment", "object", "objectSet", "interfaceObject", "interfaceObjectSet", "null", "void", "unsupported"],
    ]);
    // The one tag two universes read differently, which is why it has no shared row.
    const [ofProperty, ofAction, ofQuery]: ReadonlyArray<unknown> = [
      Property.leafCodec.attachment,
      Action.leafCodec.attachment,
      Query.leafCodec.attachment,
    ];
    assertFalse(ofProperty === ofAction);
    strictEqual(ofAction, ofQuery);
  });

  it.effect(
    "VectorOf holds a vector to its dimension when decoding, encoding and generating",
    Effect.fnUntraced(function* () {
      const embedding = VectorOf(3);
      const exact = yield* S.decodeEffect(embedding)([0.1, 0.2, 0.3]);
      deepStrictEqual(exact, [0.1, 0.2, 0.3]);
      const verdicts = yield* Effect.all([
        rejects(embedding)([0.1, 0.2]),
        rejects(embedding)([0.1, 0.2, 0.3, 0.4]),
        rejects(embedding)([0.1, 0.2, "0.3"]),
        refusesToEncode(embedding)([0.1, 0.2]),
      ]);
      assertTrue(A.every(verdicts, identity));
      const generated = yield* Arbitrary.sampleEffect(Arbitrary.schema(VectorOf(4)), { count: 30, seed: 4 });
      deepStrictEqual(A.dedupe(A.map(generated, A.length)), [4]);
    })
  );
});

// ---------------------------------------------------------------------------
// The wire's JSON encoding table (09-wire-c-core-geo.md §5.1): every scalar row
// ---------------------------------------------------------------------------

describe("JSON encoding table, scalar rows", () => {
  tableRow("Boolean | boolean | true", BooleanValue, true, true, true);
  tableRow("Boolean | boolean | false", BooleanValue, false, false, false);
  tableRow("Byte | number | 31", ByteValue, 31, 31, 31);
  tableRow('Date | ISO 8601 local date | "2021-05-01"', DateValue, "2021-05-01", mayFirst, "2021-05-01");
  tableRow('Decimal | string | "2.718281828"', DecimalValue, "2.718281828", euler, "2.718281828");
  tableRow("Double | number | 3.14159265", DoubleValue, 3.14159265, 3.14159265, 3.14159265);
  tableRow("Float | number | 3.14159265", FloatValue, 3.14159265, 3.14159265, 3.14159265);
  tableRow("Integer | number | 238940", IntegerValue, 238940, 238940, 238940);
  tableRow('Long | string | "58319870951433"', LongValue, "58319870951433", longExample, "58319870951433");
  tableRow("Short | number | 8739", ShortValue, 8739, 8739, 8739);
  tableRow('String | string | "Call me Ishmael"', StringValue, "Call me Ishmael", "Call me Ishmael", "Call me Ishmael");
  // The documented example has no milliseconds; the canonical re-encoding does.
  tableRow(
    'Timestamp | ISO 8601 UTC date-time | "2021-01-04T05:00:00Z"',
    TimestampValue,
    "2021-01-04T05:00:00Z",
    instant,
    "2021-01-04T05:00:00.000Z"
  );
  tableRow(
    "Vector | array of numbers | [0.1,0.3,0.02,0.05,0.8,0.4]",
    VectorValue,
    [0.1, 0.3, 0.02, 0.05, 0.8, 0.4],
    [0.1, 0.3, 0.02, 0.05, 0.8, 0.4],
    [0.1, 0.3, 0.02, 0.05, 0.8, 0.4]
  );

  // "For backwards compatibility, the Boolean, Byte, Double, Float, Integer, and Short types can also be encoded as
  // JSON strings." Decoding accepts the string; encoding always emits the JSON-native value.
  tableRow('Boolean, legacy string "true"', BooleanValue, "true", true, true);
  tableRow('Boolean, legacy string "false"', BooleanValue, "false", false, false);
  tableRow('Byte, legacy string "31"', ByteValue, "31", 31, 31);
  tableRow('Short, legacy string "8739"', ShortValue, "8739", 8739, 8739);
  tableRow('Integer, legacy string "238940"', IntegerValue, "238940", 238940, 238940);
  tableRow('Float, legacy string "3.14159265"', FloatValue, "3.14159265", 3.14159265, 3.14159265);
  tableRow('Double, legacy string "3.14159265"', DoubleValue, "3.14159265", 3.14159265, 3.14159265);
  tableRow('Byte, legacy string "-128"', ByteValue, "-128", -128, -128);
  tableRow('Double, legacy string with an exponent "1.5e3"', DoubleValue, "1.5e3", 1500, 1500);

  // The opposite leniency: long and decimal are documented as strings, and a JSON number is also read. Encoding
  // always emits the documented string.
  tableRow("Long, lenient JSON number 58319870951433", LongValue, 58319870951433, longExample, "58319870951433");
  tableRow("Decimal, lenient JSON number 2.718281828", DecimalValue, 2.718281828, euler, "2.718281828");

  it.effect(
    "extends neither leniency to date, timestamp, vector or string",
    Effect.fnUntraced(function* () {
      const verdicts = yield* Effect.all([
        rejects(DateValue)(20210501),
        rejects(TimestampValue)(1609736400000),
        rejects(VectorValue)(["0.1", "0.3"]),
        rejects(VectorValue)("[0.1,0.3]"),
        rejects(StringValue)(42),
        rejects(StringValue)(true),
      ]);
      assertTrue(A.every(verdicts, identity));
    })
  );
});

// ---------------------------------------------------------------------------
// Booleans
// ---------------------------------------------------------------------------

describe("BooleanValue", () => {
  lawful("BooleanValue", BooleanValue);

  it.effect(
    "rejects every other spelling of truth",
    Effect.fnUntraced(function* () {
      const verdicts = yield* Effect.all([
        rejects(BooleanValue)("TRUE"),
        rejects(BooleanValue)("True"),
        rejects(BooleanValue)("yes"),
        rejects(BooleanValue)("1"),
        rejects(BooleanValue)(""),
        rejects(BooleanValue)(1),
        rejects(BooleanValue)(0),
        rejects(BooleanValue)(null),
      ]);
      assertTrue(A.every(verdicts, identity));
      deepStrictEqual([S.is(BooleanValue)(true), S.is(BooleanValue)("true")], [true, false]);
    })
  );
});

// ---------------------------------------------------------------------------
// Bounded integers
// ---------------------------------------------------------------------------

describe("ByteValue, ShortValue and IntegerValue", () => {
  lawful("ByteValue", ByteValue);
  lawful("ShortValue", ShortValue);
  lawful("IntegerValue", IntegerValue);

  it.effect(
    "accepts both ends of each signed range, as numbers and as legacy strings",
    Effect.fnUntraced(function* () {
      const decodeByte = S.decodeEffect(ByteValue);
      const decodeShort = S.decodeEffect(ShortValue);
      const decodeInteger = S.decodeEffect(IntegerValue);
      const bytes = yield* Effect.all(A.map([-128, 127, "-128", "127"], (wire) => decodeByte(wire)));
      const shorts = yield* Effect.all(A.map([-32768, 32767, "-32768", "32767"], (wire) => decodeShort(wire)));
      const integers = yield* Effect.all(
        A.map([-2147483648, 2147483647, "-2147483648", "2147483647"], (wire) => decodeInteger(wire))
      );
      deepStrictEqual(bytes, [-128, 127, -128, 127]);
      deepStrictEqual(shorts, [-32768, 32767, -32768, 32767]);
      deepStrictEqual(integers, [-2147483648, 2147483647, -2147483648, 2147483647]);
    })
  );

  it.effect(
    "rejects one past each end of each signed range, as numbers and as legacy strings",
    Effect.fnUntraced(function* () {
      const verdicts = yield* Effect.all([
        rejects(ByteValue)(-129),
        rejects(ByteValue)(128),
        rejects(ByteValue)("-129"),
        rejects(ByteValue)("128"),
        rejects(ShortValue)(-32769),
        rejects(ShortValue)(32768),
        rejects(ShortValue)("-32769"),
        rejects(ShortValue)("32768"),
        rejects(IntegerValue)(-2147483649),
        rejects(IntegerValue)(2147483648),
        rejects(IntegerValue)("-2147483649"),
        rejects(IntegerValue)("2147483648"),
      ]);
      assertTrue(A.every(verdicts, identity));
      deepStrictEqual(
        [S.is(ByteValue)(128), S.is(ShortValue)(32768), S.is(IntegerValue)(2147483648), S.is(IntegerValue)(2147483647)],
        [false, false, false, true]
      );
    })
  );

  it.effect(
    "rejects fractions, non-finite numbers and text that is not a number",
    Effect.fnUntraced(function* () {
      const codecs = [ByteValue, ShortValue, IntegerValue];
      const counterExamples: ReadonlyArray<unknown> = [
        1.5,
        "1.5",
        Number.NaN,
        Number.POSITIVE_INFINITY,
        "NaN",
        "Infinity",
        "abc",
        "1_0",
        "١٢",
        true,
        null,
        [1],
      ];
      const verdicts = yield* Effect.all(
        A.flatMap(codecs, (codec) => A.map(counterExamples, (input) => rejects(codec)(input)))
      );
      assertTrue(A.every(verdicts, identity));
    })
  );

  it.effect(
    "refuses to encode a value outside the range",
    Effect.fnUntraced(function* () {
      const verdicts = yield* Effect.all([
        refusesToEncode(ByteValue)(128),
        refusesToEncode(ShortValue)(-32769),
        refusesToEncode(IntegerValue)(2147483648),
        refusesToEncode(IntegerValue)(0.5),
      ]);
      assertTrue(A.every(verdicts, identity));
    })
  );

  // Law: a legacy numeric string is read only when it is a base-10 number; nothing is coerced to zero.
  it.effect(
    "numeric codecs: reject an empty or blank string instead of reading it as zero",
    Effect.fnUntraced(function* () {
      const verdicts = yield* Effect.all([
        rejects(ByteValue)(""),
        rejects(ShortValue)(""),
        rejects(IntegerValue)(""),
        rejects(IntegerValue)(" "),
        rejects(FloatValue)(""),
        rejects(DoubleValue)(""),
      ]);
      assertTrue(A.every(verdicts, identity));
    })
  );

  // Law: the JavaScript-only spellings that no JSON producer writes ("0x10", "0b11", "0o17") are not numbers here.
  it.effect(
    "numeric codecs: reject hexadecimal, binary and octal spellings",
    Effect.fnUntraced(function* () {
      const verdicts = yield* Effect.all([
        rejects(ByteValue)("0x10"),
        rejects(IntegerValue)("0x10"),
        rejects(IntegerValue)("0b11"),
        rejects(IntegerValue)("0o17"),
        rejects(DoubleValue)("0x10"),
      ]);
      assertTrue(A.every(verdicts, identity));
    })
  );

  it.effect(
    "numeric codecs: reject every string outside the base-10 grammar, for all five numeric codecs",
    Effect.fnUntraced(function* () {
      const codecs = [ByteValue, ShortValue, IntegerValue, FloatValue, DoubleValue];
      const outsideTheGrammar = [
        "",
        " ",
        "\t",
        " 12",
        "12 ",
        "1 2",
        "+5",
        "--1",
        "-",
        ".",
        "e5",
        "1e",
        "1e+",
        "1.2.3",
        "0x10",
        "0X10",
        "0b11",
        "0o17",
        "1_0",
        "1,5",
        "Infinity",
        "-Infinity",
        "NaN",
        "١٢",
      ];
      const verdicts = yield* Effect.all(
        A.flatMap(codecs, (codec) => A.map(outsideTheGrammar, (text) => rejects(codec)(text)))
      );
      strictEqual(A.length(verdicts), 120);
      assertTrue(A.every(verdicts, identity));
    })
  );

  it.effect(
    "numeric codecs: read every spelling the base-10 grammar admits and encode the JSON number",
    Effect.fnUntraced(function* () {
      const decodeInteger = S.decodeEffect(IntegerValue);
      const decodeDouble = S.decodeEffect(DoubleValue);
      // Optional sign, digits, optional fraction (a bare trailing or leading point included), optional exponent.
      const integers = yield* Effect.all(
        A.map(["31", "-31", "-0", "00031", "31.", "31.0", "3.1e1", "31E0", "310e-1"], (wire) => decodeInteger(wire))
      );
      deepStrictEqual(integers, [31, -31, -0, 31, 31, 31, 31, 31, 31]);
      const doubles = yield* Effect.all(
        A.map([".5", "-.5", "5.", "0.5", "-1.5E-3", "1e3", "1E+3", "2.50"], (wire) => decodeDouble(wire))
      );
      deepStrictEqual(doubles, [0.5, -0.5, 5, 0.5, -0.0015, 1000, 1000, 2.5]);
      const encoded = yield* Effect.all(A.map(doubles, (double) => S.encodeEffect(DoubleValue)(double)));
      deepStrictEqual(encoded, [0.5, -0.5, 5, 0.5, -0.0015, 1000, 1000, 2.5]);
      // The grammar admits the text; the numeric range and integrality checks still apply to what it spells.
      const verdicts = yield* Effect.all([
        rejects(IntegerValue)(".5"),
        rejects(IntegerValue)("3.1"),
        rejects(ByteValue)("1e3"),
        rejects(DoubleValue)("1e400"),
        rejects(FloatValue)("1e39"),
      ]);
      assertTrue(A.every(verdicts, identity));
    })
  );
});

// ---------------------------------------------------------------------------
// 64-bit integers
// ---------------------------------------------------------------------------

describe("LongValue", () => {
  lawful("LongValue", LongValue);

  it.effect(
    "accepts both ends of the signed 64-bit range and keeps every digit",
    Effect.fnUntraced(function* () {
      const maximum = yield* S.decodeEffect(LongValue)("9223372036854775807");
      const minimum = yield* S.decodeEffect(LongValue)("-9223372036854775808");
      const beyondSafe = yield* S.decodeEffect(LongValue)("9007199254740993");
      deepStrictEqual([maximum, minimum, beyondSafe], [longMaximum, longMinimum, BigInt("9007199254740993")]);
      const encodeLong = S.encodeEffect(LongValue);
      const encoded = yield* Effect.all(A.map([maximum, minimum, beyondSafe], (long) => encodeLong(long)));
      deepStrictEqual(encoded, ["9223372036854775807", "-9223372036854775808", "9007199254740993"]);
    })
  );

  it.effect(
    "rejects one past each end of the signed 64-bit range",
    Effect.fnUntraced(function* () {
      const verdicts = yield* Effect.all([
        rejects(LongValue)("9223372036854775808"),
        rejects(LongValue)("-9223372036854775809"),
        rejects(LongValue)("99999999999999999999999999"),
        refusesToEncode(LongValue)(longMaximum + BigInt(1)),
        refusesToEncode(LongValue)(longMinimum - BigInt(1)),
      ]);
      assertTrue(A.every(verdicts, identity));
      deepStrictEqual(
        [S.is(LongValue)(longMaximum), S.is(LongValue)(longMaximum + BigInt(1)), S.is(LongValue)(12)],
        [true, false, false]
      );
    })
  );

  it.effect(
    "rejects every string that is not a plain decimal integer",
    Effect.fnUntraced(function* () {
      const counterExamples: ReadonlyArray<unknown> = [
        "",
        " ",
        " 12 ",
        "+5",
        "1.5",
        "12.0",
        "12.",
        "1e2",
        "0x10",
        "0b11",
        "0o17",
        "1_000",
        "twelve",
        "١٢",
        null,
        true,
        [12],
        { value: "12" },
      ];
      const verdicts = yield* Effect.all(A.map(counterExamples, rejects(LongValue)));
      assertTrue(A.every(verdicts, identity));
    })
  );

  // The wire documents a long as a string. Decoding is also lenient towards a JSON integer; the canonical encoding
  // stays the string.
  it.effect(
    "reads a JSON integer as the same long and writes it back as the decimal string",
    Effect.fnUntraced(function* () {
      const decodeLong = S.decodeEffect(LongValue);
      const encodeLong = S.encodeEffect(LongValue);
      const wires = [12, -12, 0, -0, 58319870951433, Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER];
      const decoded = yield* Effect.all(A.map(wires, (wire) => decodeLong(wire)));
      deepStrictEqual(decoded, [
        BigInt(12),
        BigInt(-12),
        BigInt(0),
        BigInt(0),
        longExample,
        BigInt("9007199254740991"),
        BigInt("-9007199254740991"),
      ]);
      const encoded = yield* Effect.all(A.map(decoded, (long) => encodeLong(long)));
      deepStrictEqual(encoded, [
        "12",
        "-12",
        "0",
        "0",
        "58319870951433",
        "9007199254740991",
        "-9007199254740991",
      ]);
      // A JSON number and the string that spells it decode to the same long.
      const fromText = yield* decodeLong("58319870951433");
      const fromNumber = yield* decodeLong(58319870951433);
      strictEqual(fromNumber, fromText);
    })
  );

  it.effect(
    "rejects a JSON number that is not an integer a double holds exactly",
    Effect.fnUntraced(function* () {
      const verdicts = yield* Effect.all([
        rejects(LongValue)(1.5),
        rejects(LongValue)(-0.5),
        rejects(LongValue)(Number.NaN),
        rejects(LongValue)(Number.POSITIVE_INFINITY),
        // One past the largest integer a double holds exactly: the digits were already lost in transit.
        rejects(LongValue)(9007199254740992),
        rejects(LongValue)(-9007199254740992),
        rejects(LongValue)(1e20),
        rejects(LongValue)(1e21),
        rejects(LongValue)(9223372036854775807),
      ]);
      assertTrue(A.every(verdicts, identity));
      // The number is a wire spelling only: the domain value is always a bigint.
      deepStrictEqual([S.is(LongValue)(12), S.is(LongValue)("12"), S.is(LongValue)(BigInt(12))], [false, false, true]);
    })
  );

  it.effect(
    "encodes negative zero as zero",
    Effect.fnUntraced(function* () {
      const zero = yield* S.decodeEffect(LongValue)("-0");
      const encoded = yield* S.encodeEffect(LongValue)(zero);
      deepStrictEqual([zero, encoded], [BigInt(0), "0"]);
    })
  );
});

// ---------------------------------------------------------------------------
// Floating point numbers
// ---------------------------------------------------------------------------

describe("FloatValue and DoubleValue", () => {
  lawful("FloatValue", FloatValue);
  lawful("DoubleValue", DoubleValue);

  it.effect(
    "rejects non-finite numbers and text that is not a number",
    Effect.fnUntraced(function* () {
      const codecs = [FloatValue, DoubleValue];
      const counterExamples: ReadonlyArray<unknown> = [
        Number.NaN,
        Number.POSITIVE_INFINITY,
        Number.NEGATIVE_INFINITY,
        "abc",
        "1,5",
        "1e400",
        true,
        null,
        [1.5],
      ];
      const verdicts = yield* Effect.all(
        A.flatMap(codecs, (codec) => A.map(counterExamples, (input) => rejects(codec)(input)))
      );
      assertTrue(A.every(verdicts, identity));
    })
  );

  // DOUBTFUL DESIGN (report): the platform's serialisation writes the three non-finite doubles as the JSON strings
  // "NaN", "Infinity" and "-Infinity". `S.Finite` refuses them, so an object holding one cannot be decoded at all.
  // This pins the current choice; C10 says to narrow only what the wire guarantees.
  it.effect(
    "refuses the wire's string spellings of the non-finite doubles",
    Effect.fnUntraced(function* () {
      const verdicts = yield* Effect.all([
        rejects(DoubleValue)("NaN"),
        rejects(DoubleValue)("Infinity"),
        rejects(DoubleValue)("-Infinity"),
        rejects(FloatValue)("NaN"),
      ]);
      assertTrue(A.every(verdicts, identity));
    })
  );

  it("keeps negative zero and the extremes of a double", () => {
    deepStrictEqual(
      [S.is(DoubleValue)(-0), S.is(DoubleValue)(Number.MAX_VALUE), S.is(DoubleValue)(Number.MIN_VALUE)],
      [true, true, true]
    );
  });

  // Law: a float value is a finite number whose magnitude a 32-bit float can hold.
  it("FloatValue: rejects a magnitude no 32-bit float can hold", () => {
    assertFalse(S.is(FloatValue)(1e39));
  });

  it.effect(
    "FloatValue: accepts both ends of the 32-bit range and rejects the next double beyond each",
    Effect.fnUntraced(function* () {
      const largest = 3.4028234663852886e38;
      const nextAbove = 3.402823466385289e38;
      const decodeFloat = S.decodeEffect(FloatValue);
      const decoded = yield* Effect.all(
        A.map([largest, -largest, "3.4028234663852886e38", "-3.4028234663852886e38", 0, -0, Number.MIN_VALUE], (wire) =>
          decodeFloat(wire)
        )
      );
      deepStrictEqual(decoded, [largest, -largest, largest, -largest, 0, -0, Number.MIN_VALUE]);
      const verdicts = yield* Effect.all([
        rejects(FloatValue)(nextAbove),
        rejects(FloatValue)(-nextAbove),
        rejects(FloatValue)(3.4028235e38),
        rejects(FloatValue)(1e39),
        rejects(FloatValue)(-1e39),
        rejects(FloatValue)(Number.MAX_VALUE),
        rejects(FloatValue)("3.4028235e38"),
        rejects(FloatValue)("1e39"),
        refusesToEncode(FloatValue)(nextAbove),
        refusesToEncode(FloatValue)(-1e39),
      ]);
      assertTrue(A.every(verdicts, identity));
      deepStrictEqual(
        [S.is(FloatValue)(largest), S.is(FloatValue)(-largest), S.is(FloatValue)(nextAbove), S.is(FloatValue)(-nextAbove)],
        [true, true, false, false]
      );
      // The range is what separates the two codecs: a double keeps the magnitudes a float refuses.
      deepStrictEqual([S.is(DoubleValue)(nextAbove), S.is(DoubleValue)(1e39)], [true, true]);
    })
  );

  it.prop(
    "FloatValue: every generated value is within the 32-bit range",
    [Arbitrary.schema(FloatValue)],
    ([value]) => value >= -3.4028234663852886e38 && value <= 3.4028234663852886e38,
    { arbitrary: fcRuns(200) }
  );
});

// ---------------------------------------------------------------------------
// Decimals
// ---------------------------------------------------------------------------

describe("DecimalValue", () => {
  lawful("DecimalValue", DecimalValue);

  const decodeDecimal = S.decodeEffect(DecimalValue);
  const decimalEquivalence = S.toEquivalence(DecimalValue);
  // The encoded side also admits a JSON number (the decode leniency), but encoding always writes the string: this
  // fails, and so does every test built on it, if a number is ever written.
  const encodeDecimal = Effect.fnUntraced(function* (decimal: BigDecimal.BigDecimal) {
    const encoded = yield* S.encodeEffect(DecimalValue)(decimal);
    return yield* S.decodeUnknownEffect(S.String)(encoded);
  });
  const isPlainDecimalText = S.is(S.String.check(S.isPattern(/^-?\d+(?:\.\d+)?$/)));
  // Zero at a negative scale is left out of the fixed-point law: see the defect below.
  const writtenCanonically = Arbitrary.filter(
    Arbitrary.schema(DecimalValue),
    ({ value, scale }) => value !== BigInt(0) || scale >= 0
  );

  it.effect(
    "keeps digits a double would lose",
    Effect.fnUntraced(function* () {
      const precise = yield* decodeDecimal("12345678901234567890.123456789");
      const expected = BigDecimal.make(BigInt("12345678901234567890123456789"), 9);
      assertTrue(decimalEquivalence(precise, expected));
      const encoded = yield* encodeDecimal(precise);
      strictEqual(encoded, "12345678901234567890.123456789");
    })
  );

  // Law: a decimal is written back with the scale it was read with. Equal numbers of different scale stay equal as
  // numbers and distinct on the wire.
  it.effect(
    "preserves the scale it was given, so trailing zeros survive a round trip",
    Effect.fnUntraced(function* () {
      const padded = yield* decodeDecimal("12.50");
      const plain = yield* decodeDecimal("12.5");
      assertTrue(decimalEquivalence(padded, plain));
      deepStrictEqual([padded.scale, plain.scale], [2, 1]);
      const encoded = yield* Effect.all([encodeDecimal(padded), encodeDecimal(plain)]);
      deepStrictEqual(encoded, ["12.50", "12.5"]);
      const wires = ["0.00", "0", "-0.0", "100", "100.000", "-7.10", "0.000001", "1000000"];
      const decoded = yield* Effect.all(A.map(wires, (wire) => decodeDecimal(wire)));
      const written = yield* Effect.all(A.map(decoded, (decimal) => encodeDecimal(decimal)));
      // Only the sign of a zero is not kept: "-0.0" is the number zero at scale one.
      deepStrictEqual(written, ["0.00", "0", "0.0", "100", "100.000", "-7.10", "0.000001", "1000000"]);
      deepStrictEqual(
        A.map(decoded, (decimal) => decimal.scale),
        [2, 0, 1, 0, 3, 2, 6, 0]
      );
      // A domain value built by hand encodes with its own scale too.
      const fromDomain = yield* Effect.all([
        encodeDecimal(BigDecimal.make(BigInt(1250), 2)),
        encodeDecimal(BigDecimal.make(BigInt(-5), 3)),
        encodeDecimal(BigDecimal.make(BigInt(0), 2)),
        encodeDecimal(BigDecimal.make(BigInt(-1), 0)),
      ]);
      deepStrictEqual(fromDomain, ["12.50", "-0.005", "0.00", "-1"]);
    })
  );

  it.effect.prop(
    "DecimalValue: plain decimal text is a fixed point of decode then encode",
    [writtenCanonically],
    Effect.fnUntraced(function* ([decimal]) {
      const text = yield* encodeDecimal(decimal);
      const again = yield* decodeDecimal(text);
      const rewritten = yield* encodeDecimal(again);
      strictEqual(rewritten, text);
      assertTrue(decimalEquivalence(again, decimal));
      // A fraction keeps its scale; a negative scale is written out as trailing integer zeros, which is scale zero.
      strictEqual(again.scale, decimal.scale > 0 ? decimal.scale : 0);
    }),
    { arbitrary: fcRuns(100) }
  );

  it.effect(
    "reads the plain-text spellings with a bare point or leading zeros and writes them in full",
    Effect.fnUntraced(function* () {
      const decoded = yield* Effect.all(A.map([".5", "-.5", "5.", "00.10", "007"], (wire) => decodeDecimal(wire)));
      const encoded = yield* Effect.all(A.map(decoded, (decimal) => encodeDecimal(decimal)));
      deepStrictEqual(encoded, ["0.5", "-0.5", "5", "0.10", "7"]);
    })
  );

  it.effect(
    "rejects text that is not a plain decimal",
    Effect.fnUntraced(function* () {
      const counterExamples: ReadonlyArray<unknown> = [
        "",
        " ",
        " 2.5",
        "2.5 ",
        "+2.5",
        "--2.5",
        "-",
        ".",
        "abc",
        "0x10",
        "0b11",
        "NaN",
        "Infinity",
        "1,5",
        "1.2.3",
        "1_000",
        "١٢",
        null,
        true,
        ["2.5"],
        { value: "2.5" },
      ];
      const verdicts = yield* Effect.all(A.map(counterExamples, rejects(DecimalValue)));
      assertTrue(A.every(verdicts, identity));
    })
  );

  // Law: the wire form of a decimal is plain text with every digit written; an exponent is refused on decode and
  // never produced on encode.
  it.effect(
    "refuses exponent notation on decode",
    Effect.fnUntraced(function* () {
      const verdicts = yield* Effect.all([
        rejects(DecimalValue)("1.50e3"),
        rejects(DecimalValue)("25e-4"),
        rejects(DecimalValue)("1e3"),
        rejects(DecimalValue)("1E3"),
        rejects(DecimalValue)("1e+21"),
        rejects(DecimalValue)("1e0"),
      ]);
      assertTrue(A.every(verdicts, identity));
    })
  );

  it.effect(
    "DecimalValue: encodes a plain decimal string whatever the scale",
    Effect.fnUntraced(function* () {
      const manyFractionDigits = yield* decodeDecimal("12345678901234567890.123456789012345678");
      const sixteenFractionDigits = yield* decodeDecimal("0.0000000000000001");
      const encoded = yield* Effect.all([
        encodeDecimal(manyFractionDigits),
        encodeDecimal(sixteenFractionDigits),
        encodeDecimal(BigDecimal.make(BigInt(1), -21)),
      ]);
      deepStrictEqual(encoded, [
        "12345678901234567890.123456789012345678",
        "0.0000000000000001",
        "1000000000000000000000",
      ]);
    })
  );

  it.effect.prop(
    "DecimalValue: the encoded text never carries an exponent",
    [Arbitrary.schema(DecimalValue)],
    Effect.fnUntraced(function* ([decimal]) {
      const text = yield* encodeDecimal(decimal);
      assertTrue(isPlainDecimalText(text));
    }),
    { arbitrary: fcRuns(200) }
  );

  // Law: a decimal zero is written as the single digit "0" whatever its scale, so encoding it is a fixed point.
  it.effect(
    "DecimalValue: writes zero as a single digit at a negative scale",
    Effect.fnUntraced(function* () {
      const encoded = yield* Effect.all([
        encodeDecimal(BigDecimal.make(BigInt(0), -3)),
        encodeDecimal(BigDecimal.make(BigInt(0), -1)),
      ]);
      deepStrictEqual(encoded, ["0", "0"]);
    })
  );

  // Law: the empty string is not a number.
  it.effect(
    "DecimalValue: rejects the empty string instead of reading it as zero",
    Effect.fnUntraced(function* () {
      const refused = yield* rejects(DecimalValue)("");
      assertTrue(refused);
    })
  );

  // Law: the scale is bounded to 4096 digits in both directions, on decode, on encode and in the guard, so encoding
  // can never be asked to write an astronomically long number.
  it.effect(
    "bounds the scale to 4096 digits either way",
    Effect.fnUntraced(function* () {
      const atTheBound = `0.${Str.repeat(4096)("0")}`;
      const beyondTheBound = `0.${Str.repeat(4097)("0")}`;
      const decoded = yield* decodeDecimal(atTheBound);
      strictEqual(decoded.scale, 4096);
      const encoded = yield* encodeDecimal(decoded);
      strictEqual(encoded, atTheBound);
      const smallest = yield* encodeDecimal(BigDecimal.make(BigInt(1), 4096));
      const largest = yield* encodeDecimal(BigDecimal.make(BigInt(1), -4096));
      deepStrictEqual([Str.length(smallest), Str.length(largest)], [4098, 4097]);
      strictEqual(largest, `1${Str.repeat(4096)("0")}`);
      const verdicts = yield* Effect.all([
        rejects(DecimalValue)(beyondTheBound),
        refusesToEncode(DecimalValue)(BigDecimal.make(BigInt(1), 4097)),
        refusesToEncode(DecimalValue)(BigDecimal.make(BigInt(1), -4097)),
        // The bound is checked before any digit is written: this would otherwise be a gigabyte of zeros.
        refusesToEncode(DecimalValue)(BigDecimal.make(BigInt(1), 1_000_000_000)),
        refusesToEncode(DecimalValue)(BigDecimal.make(BigInt(1), -1_000_000_000)),
      ]);
      assertTrue(A.every(verdicts, identity));
      deepStrictEqual(
        [
          S.is(DecimalValue)(BigDecimal.make(BigInt(1), 4096)),
          S.is(DecimalValue)(BigDecimal.make(BigInt(1), 4097)),
          S.is(DecimalValue)(BigDecimal.make(BigInt(1), -4096)),
          S.is(DecimalValue)(BigDecimal.make(BigInt(1), -4097)),
        ],
        [true, false, true, false]
      );
      // An integer written out in full has scale zero however long it is: only the fraction is bounded on decode.
      const long = yield* decodeDecimal(`1${Str.repeat(5000)("0")}`);
      strictEqual(long.scale, 0);
    })
  );

  it.prop(
    "DecimalValue: every generated value has a scale within the bound",
    [Arbitrary.schema(DecimalValue)],
    ([{ scale }]) => scale <= 4096 && scale >= -4096,
    { arbitrary: fcRuns(200) }
  );

  // The wire documents a decimal as a string. Decoding is also lenient towards a JSON number; the canonical encoding
  // stays the plain decimal string.
  it.effect(
    "reads a finite JSON number as the decimal its shortest text spells and writes the plain string",
    Effect.fnUntraced(function* () {
      const wires = [2.5, -2.5, 0, -0, 100, 1.1, 2.718281828, 0.000001, 1e20, 0.1 + 0.2];
      const decoded = yield* Effect.all(A.map(wires, (wire) => decodeDecimal(wire)));
      deepStrictEqual(
        A.map(decoded, (decimal) => [decimal.value, decimal.scale]),
        [
          [BigInt(25), 1],
          [BigInt(-25), 1],
          [BigInt(0), 0],
          [BigInt(0), 0],
          [BigInt(100), 0],
          [BigInt(11), 1],
          [BigInt(2718281828), 9],
          [BigInt(1), 6],
          [BigInt("100000000000000000000"), 0],
          [BigInt("30000000000000004"), 17],
        ]
      );
      const encoded = yield* Effect.all(A.map(decoded, (decimal) => encodeDecimal(decimal)));
      deepStrictEqual(encoded, [
        "2.5",
        "-2.5",
        "0",
        "0",
        "100",
        "1.1",
        "2.718281828",
        "0.000001",
        "100000000000000000000",
        "0.30000000000000004",
      ]);
      // A JSON number and the string that spells it decode to the same decimal.
      const fromText = yield* decodeDecimal("2.718281828");
      const fromNumber = yield* decodeDecimal(2.718281828);
      assertTrue(decimalEquivalence(fromNumber, fromText));
      const verdicts = yield* Effect.all([
        rejects(DecimalValue)(Number.NaN),
        rejects(DecimalValue)(Number.POSITIVE_INFINITY),
        rejects(DecimalValue)(Number.NEGATIVE_INFINITY),
      ]);
      assertTrue(A.every(verdicts, identity));
      // The number is a wire spelling only: the domain value is always a BigDecimal.
      deepStrictEqual([S.is(DecimalValue)(2.5), S.is(DecimalValue)("2.5"), S.is(DecimalValue)(euler)], [false, false, true]);
    })
  );

  // Law: every finite JSON number decodes as a decimal, including the magnitudes JavaScript prints with an exponent
  // (1e21 and above, and below 1e-6).
  it.effect(
    "DecimalValue: reads a finite JSON number whose JavaScript text has an exponent",
    Effect.fnUntraced(function* () {
      const tiny = yield* decodeDecimal(1e-7);
      const huge = yield* decodeDecimal(1e21);
      const encoded = yield* Effect.all([encodeDecimal(tiny), encodeDecimal(huge)]);
      deepStrictEqual(encoded, ["0.0000001", "1000000000000000000000"]);
    })
  );
});

// ---------------------------------------------------------------------------
// Text, markings, bytes and vectors
// ---------------------------------------------------------------------------

describe("StringValue, MarkingValue, BinaryValue and VectorValue", () => {
  lawful("StringValue", StringValue);
  lawful("MarkingValue", MarkingValue);
  lawful("BinaryValue", BinaryValue);
  lawful("VectorValue", VectorValue);

  it.effect(
    "accepts any text as a string value, including the empty string",
    Effect.fnUntraced(function* () {
      const decodeString = S.decodeEffect(StringValue);
      const decoded = yield* Effect.all(
        A.map(["", " ", "Call me Ishmael", "true", "42"], (wire) => decodeString(wire))
      );
      deepStrictEqual(decoded, ["", " ", "Call me Ishmael", "true", "42"]);
      const verdicts = yield* Effect.all([
        rejects(StringValue)(42),
        rejects(StringValue)(null),
        rejects(StringValue)([]),
      ]);
      assertTrue(A.every(verdicts, identity));
    })
  );

  it.effect(
    "decodes a marking value to a marking identifier and rejects the empty string",
    Effect.fnUntraced(function* () {
      const marking = yield* S.decodeEffect(MarkingValue)("8f6a6b3c-1c2d-4e5f-9a0b-1c2d3e4f5a6b");
      const encoded = yield* S.encodeEffect(MarkingValue)(marking);
      strictEqual(marking, MarkingId.make("8f6a6b3c-1c2d-4e5f-9a0b-1c2d3e4f5a6b"));
      strictEqual(encoded, "8f6a6b3c-1c2d-4e5f-9a0b-1c2d3e4f5a6b");
      const verdicts = yield* Effect.all([rejects(MarkingValue)(""), rejects(MarkingValue)(7)]);
      assertTrue(A.every(verdicts, identity));
    })
  );

  it.effect(
    "decodes base64 text to bytes and encodes the bytes back",
    Effect.fnUntraced(function* () {
      const bytes = yield* S.decodeEffect(BinaryValue)("aGVsbG8=");
      deepStrictEqual(A.fromIterable(bytes), [104, 101, 108, 108, 111]);
      const encoded = yield* S.encodeEffect(BinaryValue)(bytes);
      strictEqual(encoded, "aGVsbG8=");
      const empty = yield* S.decodeEffect(BinaryValue)("");
      strictEqual(A.length(A.fromIterable(empty)), 0);
      const verdicts = yield* Effect.all([
        rejects(BinaryValue)("aGVsbG8"),
        rejects(BinaryValue)("not base64!"),
        rejects(BinaryValue)("aGVs bG8="),
        rejects(BinaryValue)([104, 101]),
      ]);
      assertTrue(A.every(verdicts, identity));
    })
  );

  it.effect(
    "accepts a vector of any length and rejects components that are not finite numbers",
    Effect.fnUntraced(function* () {
      const empty = yield* S.decodeEffect(VectorValue)([]);
      deepStrictEqual(empty, []);
      const verdicts = yield* Effect.all([
        rejects(VectorValue)([Number.NaN]),
        rejects(VectorValue)([0.1, Number.POSITIVE_INFINITY]),
        rejects(VectorValue)([0.1, null]),
        rejects(VectorValue)(["0.1"]),
        rejects(VectorValue)({ 0: 0.1 }),
        rejects(VectorValue)(0.1),
      ]);
      assertTrue(A.every(verdicts, identity));
    })
  );
});

// ---------------------------------------------------------------------------
// Calendar dates
// ---------------------------------------------------------------------------

describe("DateValue", () => {
  lawful("DateValue", DateValue);

  it.effect(
    "decodes leap days and both ends of the supported years",
    Effect.fnUntraced(function* () {
      const decodeDate = S.decodeEffect(DateValue);
      const encodeDate = S.encodeEffect(DateValue);
      const decoded = yield* Effect.all(
        A.map(["2020-02-29", "2000-02-29", "0001-01-01", "9999-12-31"], (wire) => decodeDate(wire))
      );
      deepStrictEqual(
        A.map(decoded, (date) => [date.year, date.month, date.day]),
        [
          [2020, 2, 29],
          [2000, 2, 29],
          [1, 1, 1],
          [9999, 12, 31],
        ]
      );
      const encoded = yield* Effect.all(A.map(decoded, (date) => encodeDate(date)));
      deepStrictEqual(encoded, ["2020-02-29", "2000-02-29", "0001-01-01", "9999-12-31"]);
    })
  );

  it.effect(
    "rejects dates no calendar has and strings that are not YYYY-MM-DD",
    Effect.fnUntraced(function* () {
      const counterExamples: ReadonlyArray<unknown> = [
        "2021-02-29",
        "2021-02-30",
        "1900-02-29",
        "2021-04-31",
        "2021-13-01",
        "2021-00-10",
        "2021-01-00",
        "0000-01-01",
        "2021-5-1",
        "21-05-01",
        "2021/05/01",
        "20210501",
        "2021-05-01T00:00:00Z",
        " 2021-05-01",
        "",
        null,
      ];
      const verdicts = yield* Effect.all(A.map(counterExamples, rejects(DateValue)));
      assertTrue(A.every(verdicts, identity));
    })
  );

  it("is a calendar date, never an instant", () => {
    const isDate = S.is(DateValue);
    deepStrictEqual([isDate(mayFirst), isDate(instant), isDate("2021-05-01")], [true, false, false]);
  });

  // Law: the domain side admits only days their month has, so every value the guard accepts encodes and decodes.
  it("DateValue: the guard rejects a day its month does not have", () => {
    const accepted = O.exists(LocalDate.makeOption({ year: 2021, month: 2, day: 30 }), S.is(DateValue));
    assertFalse(accepted);
  });

  it.effect(
    "accepts the last day of every month and rejects the day after, in a common year and in a leap year",
    Effect.fnUntraced(function* () {
      const pad = Str.padStart(2, "0");
      const lastDays = (february: number) => [31, february, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
      const edges = (year: number, february: number) =>
        A.map(lastDays(february), (day, index) => ({
          last: `${year}-${pad(`${index + 1}`)}-${pad(`${day}`)}`,
          after: `${year}-${pad(`${index + 1}`)}-${pad(`${day + 1}`)}`,
        }));
      const all = A.appendAll(edges(2021, 28), edges(2024, 29));
      strictEqual(A.length(all), 24);
      const decodeDate = S.decodeEffect(DateValue);
      const encodeDate = S.encodeEffect(DateValue);
      const decoded = yield* Effect.all(A.map(all, ({ last }) => decodeDate(last)));
      const encoded = yield* Effect.all(A.map(decoded, (date) => encodeDate(date)));
      deepStrictEqual(
        encoded,
        A.map(all, ({ last }) => last)
      );
      const refused = yield* Effect.all(A.map(all, ({ after }) => rejects(DateValue)(after)));
      assertTrue(A.every(refused, identity));
    })
  );

  it.effect(
    "applies the Gregorian leap-year rule to 29 February: every fourth year, not centuries, except every 400th",
    Effect.fnUntraced(function* () {
      const leapYears = ["2020", "2024", "2000", "2400", "1600", "0004"];
      const commonYears = ["2021", "2022", "2023", "1900", "2100", "2200", "0001"];
      const decodeDate = S.decodeEffect(DateValue);
      const decoded = yield* Effect.all(A.map(leapYears, (year) => decodeDate(`${year}-02-29`)));
      deepStrictEqual(
        A.map(decoded, (date) => [date.month, date.day]),
        A.replicate([2, 29], 6)
      );
      const refused = yield* Effect.all(A.map(commonYears, (year) => rejects(DateValue)(`${year}-02-29`)));
      assertTrue(A.every(refused, identity));
      // 28 February exists in every year.
      const always = yield* Effect.all(A.map(commonYears, (year) => decodeDate(`${year}-02-28`)));
      strictEqual(A.length(always), 7);
    })
  );

  it.effect(
    "refuses to encode or guard a calendar date whose day its month does not have",
    Effect.fnUntraced(function* () {
      const impossible = A.getSomes([
        LocalDate.makeOption({ year: 2021, month: 2, day: 29 }),
        LocalDate.makeOption({ year: 2021, month: 2, day: 30 }),
        LocalDate.makeOption({ year: 2021, month: 4, day: 31 }),
        LocalDate.makeOption({ year: 1900, month: 2, day: 29 }),
      ]);
      // `LocalDate` itself bounds the day by 31 only, so all four exist as values; the property value codec refuses them.
      strictEqual(A.length(impossible), 4);
      const verdicts = yield* Effect.all(A.map(impossible, refusesToEncode(DateValue)));
      assertTrue(A.every(verdicts, identity));
      deepStrictEqual(A.map(impossible, S.is(DateValue)), [false, false, false, false]);
      const possible = A.getSomes([
        LocalDate.makeOption({ year: 2020, month: 2, day: 29 }),
        LocalDate.makeOption({ year: 2021, month: 4, day: 30 }),
      ]);
      deepStrictEqual(A.map(possible, S.is(DateValue)), [true, true]);
    })
  );

  it.prop(
    "DateValue: every generated date exists in its month",
    [Arbitrary.schema(DateValue)],
    ([{ year, month, day }]) => day <= daysInMonth(year, month),
    { arbitrary: fcRuns(300) }
  );
});

// ---------------------------------------------------------------------------
// Instants
// ---------------------------------------------------------------------------

describe("TimestampValue", () => {
  lawful("TimestampValue", TimestampValue);

  const decodeTimestamp = S.decodeEffect(TimestampValue);
  const encodeTimestamp = S.encodeEffect(TimestampValue);
  const isCanonicalInstantText = S.is(
    S.String.check(S.isPattern(/^(?:\d{4}|[+-]\d{6})-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/))
  );

  it.effect(
    "decodes an instant written with an offset to the same UTC instant",
    Effect.fnUntraced(function* () {
      const withOffset = yield* decodeTimestamp("2021-01-04T07:00:00+02:00");
      const withMillis = yield* decodeTimestamp("2021-01-04T05:00:00.000Z");
      deepStrictEqual(
        [DateTime.toEpochMillis(withOffset), DateTime.toEpochMillis(withMillis)],
        [1609736400000, 1609736400000]
      );
      const encoded = yield* encodeTimestamp(withOffset);
      strictEqual(encoded, "2021-01-04T05:00:00.000Z");
    })
  );

  // DOUBTFUL DESIGN (report): `DateTime.Utc` holds milliseconds. A wire instant with micro- or nanoseconds decodes,
  // but the extra digits are dropped, so reading a timestamp and writing it back changes the stored value.
  it.effect(
    "truncates digits finer than a millisecond",
    Effect.fnUntraced(function* () {
      const precise = yield* decodeTimestamp("2021-01-04T05:00:00.123456Z");
      const encoded = yield* encodeTimestamp(precise);
      strictEqual(encoded, "2021-01-04T05:00:00.123Z");
    })
  );

  it.effect(
    "rejects an epoch number, the empty string and an impossible month",
    Effect.fnUntraced(function* () {
      const verdicts = yield* Effect.all([
        rejects(TimestampValue)(1609736400000),
        rejects(TimestampValue)(""),
        rejects(TimestampValue)("2021-13-01T00:00:00Z"),
        rejects(TimestampValue)("not a timestamp"),
        rejects(TimestampValue)(null),
      ]);
      assertTrue(A.every(verdicts, identity));
      const isTimestamp = S.is(TimestampValue);
      deepStrictEqual(
        [isTimestamp(instant), isTimestamp(mayFirst), isTimestamp("2021-01-04T05:00:00Z")],
        [true, false, false]
      );
    })
  );

  // Law: only ISO 8601 date-time text with a zone designator is an instant; whatever else the JavaScript date parser
  // would read ("Jan 4 2021", a bare date, "1") is refused.
  it.effect(
    "TimestampValue: rejects text that is not an ISO 8601 date-time",
    Effect.fnUntraced(function* () {
      const verdicts = yield* Effect.all([
        rejects(TimestampValue)("Jan 4 2021"),
        rejects(TimestampValue)("2021-01-04"),
        rejects(TimestampValue)("1"),
      ]);
      assertTrue(A.every(verdicts, identity));
    })
  );

  it.effect(
    "requires the extended format with a T separator and a zone designator",
    Effect.fnUntraced(function* () {
      const outsideTheGrammar = [
        // No zone designator: a local time is not an instant.
        "2021-01-04T05:00:00",
        "2021-01-04T05:00:00.000",
        // Separator and designator are upper-case letters, with nothing around the text.
        "2021-01-04t05:00:00Z",
        "2021-01-04T05:00:00z",
        "2021-01-04 05:00:00Z",
        " 2021-01-04T05:00:00Z",
        "2021-01-04T05:00:00Z ",
        // Every field has its full width.
        "2021-1-4T05:00:00Z",
        "21-01-04T05:00:00Z",
        "2021-01-04T5:00:00Z",
        "2021-01-04T05:00:0Z",
        "2021-01-04T05Z",
        "20210104T050000Z",
        "2021-01-04T05:00:00.Z",
        // An offset has hours and minutes.
        "2021-01-04T05:00:00+02",
        "2021-01-04T05:00:00+2:00",
        "2021-01-04T05:00:00 +02:00",
        "2021-01-04T05:00:00UTC",
        "2021-01-04T05:00:00GMT",
        // A year beyond four digits needs the signed six-digit form.
        "10000-01-01T00:00:00Z",
        "+10000-01-01T00:00:00Z",
        "+2021-01-04T05:00:00Z",
        "-2021-01-04T05:00:00Z",
        "",
      ];
      const verdicts = yield* Effect.all(A.map(outsideTheGrammar, rejects(TimestampValue)));
      strictEqual(A.length(verdicts), 24);
      assertTrue(A.every(verdicts, identity));
    })
  );

  it.effect(
    "rejects fields the grammar admits but no clock or calendar has",
    Effect.fnUntraced(function* () {
      const verdicts = yield* Effect.all([
        rejects(TimestampValue)("2021-13-01T00:00:00Z"),
        rejects(TimestampValue)("2021-00-01T00:00:00Z"),
        rejects(TimestampValue)("2021-01-32T00:00:00Z"),
        rejects(TimestampValue)("2021-01-00T00:00:00Z"),
        rejects(TimestampValue)("2021-01-04T25:00:00Z"),
        rejects(TimestampValue)("2021-01-04T05:60:00Z"),
        rejects(TimestampValue)("2021-01-04T05:00:60Z"),
        rejects(TimestampValue)("2021-01-04T05:00:00+24:00"),
        rejects(TimestampValue)("2021-01-04T05:00:00+25:00"),
        rejects(TimestampValue)("2021-01-04T05:00:00+02:60"),
        // Negative zero is not a year, and the last representable instant is the end of the range.
        rejects(TimestampValue)("-000000-01-01T00:00:00Z"),
        rejects(TimestampValue)("+275760-09-13T00:00:00.001Z"),
        rejects(TimestampValue)("-271821-04-19T23:59:59Z"),
      ]);
      assertTrue(A.every(verdicts, identity));
    })
  );

  it.effect(
    "reads every zone designator and every precision to the same UTC instant, and writes one canonical form",
    Effect.fnUntraced(function* () {
      const spellings = [
        "2021-01-04T05:00:00Z",
        "2021-01-04T05:00Z",
        "2021-01-04T05:00:00.0Z",
        "2021-01-04T05:00:00.000Z",
        "2021-01-04T05:00:00.000000000Z",
        "2021-01-04T05:00:00+00:00",
        "2021-01-04T05:00:00-00:00",
        "2021-01-04T07:00:00+02:00",
        "2021-01-04T07:00:00+0200",
        "2021-01-04T00:00:00-05:00",
        "2021-01-04T10:30:00+05:30",
        "2021-01-03T19:15:00-09:45",
        "2021-01-05T04:59:00+23:59",
        "+002021-01-04T05:00:00Z",
      ];
      const decoded = yield* Effect.all(A.map(spellings, (wire) => decodeTimestamp(wire)));
      deepStrictEqual(A.map(decoded, DateTime.toEpochMillis), A.replicate(1609736400000, 14));
      const encoded = yield* Effect.all(A.map(decoded, (timestamp) => encodeTimestamp(timestamp)));
      deepStrictEqual(encoded, A.replicate("2021-01-04T05:00:00.000Z", 14));
    })
  );

  it.effect(
    "reads four-digit years from 0000 through 9999 and the signed six-digit form beyond them",
    Effect.fnUntraced(function* () {
      const wires = [
        "0000-01-01T00:00:00Z",
        "0001-01-01T00:00:00Z",
        "1969-12-31T23:59:59.999Z",
        "1970-01-01T00:00:00Z",
        "9999-12-31T23:59:59.999Z",
        "+010000-01-01T00:00:00Z",
        "-000001-01-01T00:00:00Z",
        "+275760-09-13T00:00:00Z",
        "-271821-04-20T00:00:00Z",
      ];
      const decoded = yield* Effect.all(A.map(wires, (wire) => decodeTimestamp(wire)));
      deepStrictEqual(A.map(decoded, DateTime.toEpochMillis), [
        -62167219200000,
        -62135596800000,
        -1,
        0,
        253402300799999,
        253402300800000,
        -62198755200000,
        8640000000000000,
        -8640000000000000,
      ]);
      const encoded = yield* Effect.all(A.map(decoded, (timestamp) => encodeTimestamp(timestamp)));
      deepStrictEqual(encoded, [
        "0000-01-01T00:00:00.000Z",
        "0001-01-01T00:00:00.000Z",
        "1969-12-31T23:59:59.999Z",
        "1970-01-01T00:00:00.000Z",
        "9999-12-31T23:59:59.999Z",
        "+010000-01-01T00:00:00.000Z",
        "-000001-01-01T00:00:00.000Z",
        "+275760-09-13T00:00:00.000Z",
        "-271821-04-20T00:00:00.000Z",
      ]);
      // The canonical form of an expanded year is itself readable: decoding it gives the same instant back.
      const again = yield* Effect.all(A.map(encoded, (wire) => decodeTimestamp(wire)));
      deepStrictEqual(A.map(again, DateTime.toEpochMillis), A.map(decoded, DateTime.toEpochMillis));
    })
  );

  it.effect.prop(
    "TimestampValue: the canonical encoding matches the ISO 8601 grammar and is a fixed point",
    [Arbitrary.schema(TimestampValue)],
    Effect.fnUntraced(function* ([timestamp]) {
      const text = yield* encodeTimestamp(timestamp);
      assertTrue(isCanonicalInstantText(text));
      const again = yield* decodeTimestamp(text);
      const rewritten = yield* encodeTimestamp(again);
      strictEqual(rewritten, text);
    }),
    { arbitrary: fcRuns(200) }
  );

  // Law: a timestamp whose date names a day its month does not have is rejected, never rolled into the next month.
  it.effect(
    "TimestampValue: rejects a day its month does not have",
    Effect.fnUntraced(function* () {
      const verdicts = yield* Effect.all([
        rejects(TimestampValue)("2021-02-30T00:00:00Z"),
        rejects(TimestampValue)("2021-02-29T00:00:00Z"),
        rejects(TimestampValue)("2021-04-31T00:00:00Z"),
      ]);
      assertTrue(A.every(verdicts, identity));
    })
  );

  // The other side of the same defect, pinned so that the fix is a visible change: a real leap day is read as itself.
  it.effect(
    "reads 29 February of a leap year as that day",
    Effect.fnUntraced(function* () {
      const leapDay = yield* decodeTimestamp("2020-02-29T12:00:00Z");
      const encoded = yield* encodeTimestamp(leapDay);
      strictEqual(encoded, "2020-02-29T12:00:00.000Z");
    })
  );
});

// ---------------------------------------------------------------------------
// The operand union
// ---------------------------------------------------------------------------

describe("ScalarValue", () => {
  // The strict law: Type and Encoded are the same three JSON scalars, so the codec is its own inverse.
  lawful("ScalarValue", ScalarValue);

  const decodeScalar = S.decodeEffect(ScalarValue);
  const encodeScalar = S.encodeEffect(ScalarValue);

  it.effect.prop(
    "ScalarValue: every operand is a JSON scalar and is its own wire form in both directions",
    [Arbitrary.schema(ScalarValue)],
    Effect.fnUntraced(function* ([value]) {
      const encoded = yield* encodeScalar(value);
      const decoded = yield* decodeScalar(encoded);
      strictEqual(encoded, value);
      strictEqual(decoded, value);
      assertTrue(P.isString(decoded) || P.isNumber(decoded) || P.isBoolean(decoded));
    }),
    { arbitrary: fcRuns(200) }
  );

  // The tier that has no property type in hand holds the wire scalar. A rich value is not one: the compiler
  // refuses it where an operand is expected, and the codec refuses it in both directions.
  it.effect(
    "a rich value is not a wire operand: not for the compiler, the guard, the encoder or the decoder",
    Effect.fnUntraced(function* () {
      const operand = (value: ScalarValue): ScalarValue => value;
      deepStrictEqual([operand("2021-05-01"), operand(3.5), operand(true)], ["2021-05-01", 3.5, true]);
      const rich: ReadonlyArray<unknown> = [longExample, euler, mayFirst, instant];
      // @ts-expect-error a 64-bit integer travels as text: the bigint is not a wire operand
      const long: ScalarValue = longExample;
      // @ts-expect-error a decimal travels as text: the BigDecimal is not a wire operand
      const decimal: ScalarValue = euler;
      // @ts-expect-error a calendar date travels as text: the LocalDate is not a wire operand
      const date: ScalarValue = mayFirst;
      // @ts-expect-error an instant travels as text: the DateTime is not a wire operand
      const timestamp: ScalarValue = instant;
      deepStrictEqual<ReadonlyArray<unknown>>([long, decimal, date, timestamp], rich);
      deepStrictEqual(A.map(rich, S.is(ScalarValue)), [false, false, false, false]);
      const refused = yield* Effect.all(A.map(rich, refusesToEncode(ScalarValue)));
      deepStrictEqual(refused, [true, true, true, true]);
      const rejected = yield* Effect.all(A.map(rich, rejects(ScalarValue)));
      deepStrictEqual(rejected, [true, true, true, true]);
    })
  );

  // A rich value reaches the wire tier through the codec of its own type, and that codec is where its one
  // canonical spelling is decided.
  it.effect(
    "the codec of each rich type writes its one canonical wire spelling, and that spelling is a wire operand",
    Effect.fnUntraced(function* () {
      const encoded = yield* Effect.all([
        S.encodeEffect(StringValue)("Call me Ishmael"),
        S.encodeEffect(DoubleValue)(3.5),
        S.encodeEffect(BooleanValue)(true),
        S.encodeEffect(LongValue)(longExample),
        S.encodeEffect(DecimalValue)(BigDecimal.fromStringUnsafe("2.50")),
        S.encodeEffect(DateValue)(mayFirst),
        S.encodeEffect(TimestampValue)(instant),
      ]);
      deepStrictEqual(encoded, [
        "Call me Ishmael",
        3.5,
        true,
        "58319870951433",
        // A decimal operand keeps the scale it was given.
        "2.50",
        "2021-05-01",
        "2021-01-04T05:00:00.000Z",
      ]);
      deepStrictEqual(A.map(encoded, S.is(ScalarValue)), [true, true, true, true, true, true, true]);
      const operands = yield* Effect.all(A.map(encoded, (wire) => decodeScalar(wire)));
      deepStrictEqual(operands, encoded);
    })
  );

  // The bounds of a rich operand are the bounds of its own codec: the wire tier adds none and loosens none, and a
  // JSON number stays a number.
  it.effect(
    "a rich operand is bounded by its own codec, and a JSON number stays a number on decode",
    Effect.fnUntraced(function* () {
      const decoded = yield* Effect.all(A.map([58319870951433, 2.5, 1e21], (wire) => decodeScalar(wire)));
      deepStrictEqual(decoded, [58319870951433, 2.5, 1e21]);
      const impossibleDates = A.getSomes([LocalDate.makeOption({ year: 2021, month: 2, day: 30 })]);
      strictEqual(A.length(impossibleDates), 1);
      const verdicts = yield* Effect.all([
        refusesToEncode(DecimalValue)(BigDecimal.make(BigInt(1), 4097)),
        refusesToEncode(LongValue)(longMinimum - BigInt(1)),
        ...A.map(impossibleDates, refusesToEncode(DateValue)),
      ]);
      assertTrue(A.every(verdicts, identity));
      deepStrictEqual(
        [
          S.is(DecimalValue)(BigDecimal.make(BigInt(1), 4096)),
          S.is(DecimalValue)(BigDecimal.make(BigInt(1), 4097)),
          A.some(impossibleDates, S.is(DateValue)),
        ],
        [true, false, false]
      );
      const plain = yield* S.encodeEffect(DecimalValue)(BigDecimal.make(BigInt(1), -21));
      strictEqual(plain, "1000000000000000000000");
      assertTrue(S.is(ScalarValue)(plain));
    })
  );

  // A string that spells a date, a long, a decimal, an instant or a boolean is text here; only a property's own
  // value codec reads the rich type.
  it.effect(
    "decodes a JSON string to text whatever it spells, a JSON number to a number and a JSON boolean to a boolean",
    Effect.fnUntraced(function* () {
      const texts = ["2021-05-01", "58319870951433", "2.718281828", "2021-01-04T05:00:00Z", "true", "31", ""];
      const decodedTexts = yield* Effect.all(A.map(texts, (wire) => decodeScalar(wire)));
      deepStrictEqual(decodedTexts, texts);
      const decodedNatives = yield* Effect.all(A.map([3.5, 238940, -0.25, true, false], (wire) => decodeScalar(wire)));
      deepStrictEqual(decodedNatives, [3.5, 238940, -0.25, true, false]);
    })
  );

  it.effect(
    "the property's own codec reads the rich value back from the operand it wrote",
    Effect.fnUntraced(function* () {
      const wireDate = yield* Effect.flatMap(S.encodeEffect(DateValue)(mayFirst), decodeScalar);
      const wireLong = yield* Effect.flatMap(S.encodeEffect(LongValue)(longExample), decodeScalar);
      const wireInstant = yield* Effect.flatMap(S.encodeEffect(TimestampValue)(instant), decodeScalar);
      const date = yield* S.decodeUnknownEffect(DateValue)(wireDate);
      const long = yield* S.decodeUnknownEffect(LongValue)(wireLong);
      const timestamp = yield* S.decodeUnknownEffect(TimestampValue)(wireInstant);
      assertTrue(S.toEquivalence(DateValue)(date, mayFirst));
      strictEqual(long, longExample);
      assertTrue(S.toEquivalence(TimestampValue)(timestamp, instant));
    })
  );

  it.effect(
    "rejects null, records, arrays and non-finite numbers, and refuses to encode a bigint of any size",
    Effect.fnUntraced(function* () {
      const verdicts = yield* Effect.all([
        rejects(ScalarValue)(null),
        rejects(ScalarValue)(undefined),
        rejects(ScalarValue)({}),
        rejects(ScalarValue)([]),
        rejects(ScalarValue)({ type: "stringValue", value: "x" }),
        rejects(ScalarValue)(Number.NaN),
        rejects(ScalarValue)(Number.POSITIVE_INFINITY),
        refusesToEncode(ScalarValue)(longMaximum + BigInt(1)),
        refusesToEncode(ScalarValue)(longMaximum),
        refusesToEncode(ScalarValue)(Number.NaN),
        refusesToEncode(ScalarValue)(null),
      ]);
      assertTrue(A.every(verdicts, identity));
    })
  );

  it("guards the three JSON scalars and nothing else", () => {
    const operands: ReadonlyArray<unknown> = ["text", 3.5, false, "58319870951433", "2021-05-01"];
    deepStrictEqual(A.map(operands, S.is(ScalarValue)), [true, true, true, true, true]);
    const strangers: ReadonlyArray<unknown> = [null, undefined, {}, [], Number.NaN, longMaximum + BigInt(1)];
    deepStrictEqual(A.map(strangers, S.is(ScalarValue)), [false, false, false, false, false, false]);
  });
});
