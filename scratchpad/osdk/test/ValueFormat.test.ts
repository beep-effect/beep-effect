import { fcRuns } from "@beep/test-utils";
import { describe, it } from "@effect/vitest";
import {
  assertFalse,
  assertInclude,
  assertNone,
  assertSome,
  assertTrue,
  deepStrictEqual,
  strictEqual,
} from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { PropertyApiName } from "../src/Identifier/Identifier.model.ts";
import {
  Affix,
  BooleanValueFormat,
  CurrencyStyle,
  DatetimeFormat,
  DatetimeLocalizedFormat,
  DatetimePreset,
  DatetimeStringFormat,
  DatetimeTimezone,
  DateValueFormat,
  DurationFormatStyle,
  DurationInputUnit,
  DurationPrecision,
  HumanReadableDuration,
  IntlDigitBounds,
  KnownType,
  KnownTypeValueFormat,
  NumberFormat,
  NumberFormatAffix,
  NumberFormatCurrency,
  NumberFormatCustomUnit,
  NumberFormatDuration,
  NumberFormatFixedValues,
  NumberFormatKind,
  NumberFormatOptions,
  NumberFormatRatio,
  NumberFormatScale,
  NumberFormatStandard,
  NumberFormatStandardUnit,
  NumberNotation,
  NumberRatio,
  NumberRoundingMode,
  NumberScale,
  NumberValueFormat,
  PropertyLookup,
  PropertyOrConstant,
  StaticTimezone,
  StringConstant,
  TimecodeDuration,
  TimestampValueFormat,
  UserTimezone,
  ValueFormat,
  ValueFormatKind,
} from "../src/ValueFormat/index.ts";

// -----------------------------------------------------------------------------
// Law and fixture helpers
// -----------------------------------------------------------------------------

/** Laws every named schema obeys: generated values are valid, and the wire form loses nothing. */
const lawsOf = <A, I>(name: string, schema: S.Codec<A, I>) => {
  const arbitrary = Arbitrary.schema(schema);
  const isValid = S.is(schema);
  const isEquivalent = S.toEquivalence(schema);
  const encode = S.encodeEffect(schema);
  const decode = S.decodeEffect(schema);
  describe(`${name} laws`, () => {
    it.prop("generated values satisfy the guard", [arbitrary], ([value]) => isValid(value), {
      arbitrary: fcRuns(50),
    });
    it.effect.prop(
      "encoding then decoding gives an equivalent value",
      [arbitrary],
      Effect.fnUntraced(function* ([value]) {
        const encoded = yield* encode(value);
        const decoded = yield* decode(encoded);
        assertTrue(isEquivalent(decoded, value));
      }),
      { arbitrary: fcRuns(50) }
    );
  });
};

/** Decodes an exact wire value to the expected domain value and encodes it back to the same wire value. */
const wireFixture = <A, I>(name: string, schema: S.Codec<A, I>, wire: NoInfer<I>, expected: NoInfer<A>) =>
  it.effect(
    name,
    Effect.fnUntraced(function* () {
      const decoded = yield* S.decodeEffect(schema)(wire);
      deepStrictEqual(decoded, expected);
      assertTrue(S.toEquivalence(schema)(decoded, expected));
      const encoded = yield* S.encodeEffect(schema)(decoded);
      deepStrictEqual(encoded, wire);
    })
  );

/** Pins both sides of a mapped literal domain and checks the codec follows the table in both directions. */
const literalDomain = <A extends string, I extends string>(
  name: string,
  kit: S.Codec<A, I> & { readonly Pairs: ReadonlyArray<readonly [I, A]> },
  pairs: ReadonlyArray<readonly [NoInfer<I>, NoInfer<A>]>
) =>
  it.effect(
    `${name} maps every wire literal to its domain literal and back`,
    Effect.fnUntraced(function* () {
      const decode = S.decodeEffect(kit);
      const encode = S.encodeEffect(kit);
      const wireLiterals = A.map(pairs, ([wire]) => wire);
      const domainLiterals = A.map(pairs, ([, domain]) => domain);
      deepStrictEqual(A.fromIterable(kit.Pairs), A.fromIterable(pairs));
      const decoded = yield* Effect.forEach(wireLiterals, (wire) => decode(wire));
      deepStrictEqual(decoded, domainLiterals);
      const encoded = yield* Effect.forEach(domainLiterals, (domain) => encode(domain));
      deepStrictEqual(encoded, wireLiterals);
    })
  );

/** Asserts that decoding fails and that the failure names the violated rule. */
const assertRejects = <A, I>(schema: S.Codec<A, I>, input: unknown, fragment: string) =>
  assertInclude(
    pipe(
      S.decodeUnknownResult(schema)(input),
      Result.getFailure,
      O.map((error) => error.message),
      O.getOrUndefined
    ),
    fragment
  );

// -----------------------------------------------------------------------------
// Shared domain values
// -----------------------------------------------------------------------------

const noOptions = NumberFormatOptions.make({});
const constant = (value: string) => PropertyOrConstant.cases.constant.make({ value });
const lookup = (propertyApiName: string) =>
  PropertyOrConstant.cases.propertyType.make({ propertyApiName: PropertyApiName.make(propertyApiName) });

// -----------------------------------------------------------------------------
// Laws
// -----------------------------------------------------------------------------

lawsOf("ValueFormatKind", ValueFormatKind);
lawsOf("NumberFormatKind", NumberFormatKind);
lawsOf("NumberNotation", NumberNotation);
lawsOf("NumberRoundingMode", NumberRoundingMode);
lawsOf("CurrencyStyle", CurrencyStyle);
lawsOf("NumberScale", NumberScale);
lawsOf("NumberRatio", NumberRatio);
lawsOf("DurationPrecision", DurationPrecision);
lawsOf("DurationInputUnit", DurationInputUnit);
lawsOf("DatetimePreset", DatetimePreset);
lawsOf("KnownType", KnownType);

lawsOf("StringConstant", StringConstant);
lawsOf("PropertyLookup", PropertyLookup);
lawsOf("PropertyOrConstant", PropertyOrConstant);
lawsOf("NumberFormatOptions", NumberFormatOptions);
lawsOf("Affix", Affix);
lawsOf("HumanReadableDuration", HumanReadableDuration);
lawsOf("TimecodeDuration", TimecodeDuration);
lawsOf("DurationFormatStyle", DurationFormatStyle);
lawsOf("NumberFormatStandard", NumberFormatStandard);
lawsOf("NumberFormatFixedValues", NumberFormatFixedValues);
lawsOf("NumberFormatCurrency", NumberFormatCurrency);
lawsOf("NumberFormatStandardUnit", NumberFormatStandardUnit);
lawsOf("NumberFormatCustomUnit", NumberFormatCustomUnit);
lawsOf("NumberFormatAffix", NumberFormatAffix);
lawsOf("NumberFormatDuration", NumberFormatDuration);
lawsOf("NumberFormatScale", NumberFormatScale);
lawsOf("NumberFormatRatio", NumberFormatRatio);
lawsOf("NumberFormat", NumberFormat);
lawsOf("DatetimeStringFormat", DatetimeStringFormat);
lawsOf("DatetimeLocalizedFormat", DatetimeLocalizedFormat);
lawsOf("DatetimeFormat", DatetimeFormat);
lawsOf("StaticTimezone", StaticTimezone);
lawsOf("UserTimezone", UserTimezone);
lawsOf("DatetimeTimezone", DatetimeTimezone);
lawsOf("NumberValueFormat", NumberValueFormat);
lawsOf("TimestampValueFormat", TimestampValueFormat);
lawsOf("DateValueFormat", DateValueFormat);
lawsOf("BooleanValueFormat", BooleanValueFormat);
lawsOf("KnownTypeValueFormat", KnownTypeValueFormat);
lawsOf("ValueFormat", ValueFormat);

// -----------------------------------------------------------------------------
// Literal domains
// -----------------------------------------------------------------------------

describe("ValueFormat literal domains", () => {
  it("names the five kinds of formatting rule and the nine number formats", () => {
    deepStrictEqual(A.fromIterable(ValueFormatKind.literals), ["number", "timestamp", "date", "boolean", "knownType"]);
    deepStrictEqual(A.fromIterable(NumberFormatKind.literals), [
      "standard",
      "fixedValues",
      "currency",
      "standardUnit",
      "customUnit",
      "affix",
      "duration",
      "scale",
      "ratio",
    ]);
  });

  literalDomain("NumberNotation", NumberNotation, [
    ["STANDARD", "standard"],
    ["SCIENTIFIC", "scientific"],
    ["ENGINEERING", "engineering"],
    ["COMPACT", "compact"],
  ]);

  literalDomain("NumberRoundingMode", NumberRoundingMode, [
    ["CEIL", "ceil"],
    ["FLOOR", "floor"],
    ["ROUND_CLOSEST", "roundClosest"],
  ]);

  literalDomain("CurrencyStyle", CurrencyStyle, [
    ["STANDARD", "standard"],
    ["COMPACT", "compact"],
  ]);

  literalDomain("NumberScale", NumberScale, [
    ["THOUSANDS", "thousands"],
    ["MILLIONS", "millions"],
    ["BILLIONS", "billions"],
  ]);

  literalDomain("NumberRatio", NumberRatio, [
    ["PERCENTAGE", "percentage"],
    ["PER_MILLE", "perMille"],
    ["BASIS_POINTS", "basisPoints"],
  ]);

  literalDomain("DurationPrecision", DurationPrecision, [
    ["DAYS", "days"],
    ["HOURS", "hours"],
    ["MINUTES", "minutes"],
    ["SECONDS", "seconds"],
    ["AUTO", "auto"],
  ]);

  literalDomain("DurationInputUnit", DurationInputUnit, [
    ["SECONDS", "seconds"],
    ["MILLISECONDS", "milliseconds"],
  ]);

  literalDomain("DatetimePreset", DatetimePreset, [
    ["DATE_FORMAT_RELATIVE_TO_NOW", "dateFormatRelativeToNow"],
    ["DATE_FORMAT_DATE", "dateFormatDate"],
    ["DATE_FORMAT_YEAR_AND_MONTH", "dateFormatYearAndMonth"],
    ["DATE_FORMAT_DATE_TIME", "dateFormatDateTime"],
    ["DATE_FORMAT_DATE_TIME_SHORT", "dateFormatDateTimeShort"],
    ["DATE_FORMAT_TIME", "dateFormatTime"],
    ["DATE_FORMAT_ISO_INSTANT", "dateFormatIsoInstant"],
  ]);

  literalDomain("KnownType", KnownType, [
    ["USER_OR_GROUP_ID", "userOrGroupId"],
    ["RESOURCE_RID", "resourceRid"],
    ["ARTIFACT_GID", "artifactGid"],
  ]);

  it("matches every mapped domain exhaustively by its domain literal", () => {
    const divisorOf = NumberScale.To.match({ thousands: () => 1e3, millions: () => 1e6, billions: () => 1e9 });
    const multiplierOf = NumberRatio.To.match({
      percentage: () => 100,
      perMille: () => 1000,
      basisPoints: () => 10000,
    });
    const millisPer = DurationInputUnit.To.match({ seconds: () => 1000, milliseconds: () => 1 });
    const hasExponent = NumberNotation.To.match({
      standard: () => false,
      scientific: () => true,
      engineering: () => true,
      compact: () => false,
    });
    const showsClock = DatetimePreset.To.match({
      dateFormatRelativeToNow: () => false,
      dateFormatDate: () => false,
      dateFormatYearAndMonth: () => false,
      dateFormatDateTime: () => true,
      dateFormatDateTimeShort: () => true,
      dateFormatTime: () => true,
      dateFormatIsoInstant: () => true,
    });
    deepStrictEqual(
      A.map(NumberScale.Pairs, ([, scale]) => divisorOf(scale)),
      [1e3, 1e6, 1e9]
    );
    deepStrictEqual(
      A.map(NumberRatio.Pairs, ([, ratio]) => multiplierOf(ratio)),
      [100, 1000, 10000]
    );
    deepStrictEqual(
      A.map(DurationInputUnit.Pairs, ([, unit]) => millisPer(unit)),
      [1000, 1]
    );
    deepStrictEqual(
      A.map(NumberNotation.Pairs, ([, notation]) => hasExponent(notation)),
      [false, true, true, false]
    );
    deepStrictEqual(
      A.map(DatetimePreset.Pairs, ([, preset]) => showsClock(preset)),
      [false, false, false, true, true, true, true]
    );
  });

  it("guards the domain literal, not the wire literal", () => {
    assertTrue(S.is(NumberRoundingMode)("roundClosest"));
    assertFalse(S.is(NumberRoundingMode)("ROUND_CLOSEST"));
    assertTrue(S.is(KnownType)("userOrGroupId"));
    assertFalse(S.is(KnownType)("USER_OR_GROUP_ID"));
  });

  it("rejects literals outside a domain, including domain literals sent as wire values", () => {
    assertRejects(NumberNotation, "ROMAN", "NumberNotation");
    assertRejects(NumberNotation, "compact", "NumberNotation");
    assertRejects(NumberRoundingMode, "ROUND_HALF_EVEN", "NumberRoundingMode");
    assertRejects(CurrencyStyle, "NARROW", "CurrencyStyle");
    assertRejects(NumberScale, "TRILLIONS", "NumberScale");
    assertRejects(NumberRatio, "PARTS_PER_MILLION", "NumberRatio");
    assertRejects(DurationPrecision, "MILLISECONDS", "DurationPrecision");
    assertRejects(DurationInputUnit, "MINUTES", "DurationInputUnit");
    assertRejects(DatetimePreset, "DATE_TIME", "DatetimePreset");
    assertRejects(KnownType, "USER_ID", "KnownType");
  });
});

// -----------------------------------------------------------------------------
// PropertyOrConstant
// -----------------------------------------------------------------------------

describe("PropertyOrConstant", () => {
  wireFixture(
    "decodes and re-encodes a constant",
    PropertyOrConstant,
    { type: "constant", value: "USD" },
    constant("USD")
  );

  wireFixture(
    "decodes and re-encodes a sibling property lookup",
    PropertyOrConstant,
    { type: "propertyType", propertyApiName: "currencyCode" },
    lookup("currencyCode")
  );

  it("constructs every case, guards it and matches exhaustively", () => {
    const fixed = constant("meter");
    const read = lookup("unit");
    const describeSource = PropertyOrConstant.match({
      constant: ({ value }) => `constant ${value}`,
      propertyType: ({ propertyApiName }) => `property ${propertyApiName}`,
    });
    deepStrictEqual(R.keys(PropertyOrConstant.cases), ["constant", "propertyType"]);
    assertTrue(PropertyOrConstant.guards.constant(fixed));
    assertFalse(PropertyOrConstant.guards.constant(read));
    assertTrue(PropertyOrConstant.guards.propertyType(read));
    assertFalse(PropertyOrConstant.guards.propertyType(fixed));
    deepStrictEqual([describeSource(fixed), describeSource(read)], ["constant meter", "property unit"]);
  });

  it("accepts an empty constant, because the wire types it as any string", () => {
    assertTrue(S.is(PropertyOrConstant)(constant("")));
  });

  it("rejects a lookup without a property name and an unknown source", () => {
    assertRejects(PropertyOrConstant, { type: "propertyType", propertyApiName: "" }, "length of at least 1");
    assertRejects(PropertyOrConstant, { type: "propertyType" }, "Missing key");
    assertRejects(PropertyOrConstant, { type: "expression", value: "a + b" }, "PropertyOrConstant");
  });
});

// -----------------------------------------------------------------------------
// NumberFormatOptions and Affix
// -----------------------------------------------------------------------------

describe("NumberFormatOptions", () => {
  wireFixture("decodes and re-encodes the empty settings", NumberFormatOptions, {}, noOptions);

  wireFixture(
    "decodes and re-encodes every setting",
    NumberFormatOptions,
    {
      useGrouping: true,
      convertNegativeToParenthesis: false,
      minimumIntegerDigits: 1,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
      minimumSignificantDigits: 1,
      maximumSignificantDigits: 6,
      notation: "SCIENTIFIC",
      roundingMode: "ROUND_CLOSEST",
    },
    NumberFormatOptions.make({
      useGrouping: O.some(true),
      convertNegativeToParenthesis: O.some(false),
      minimumIntegerDigits: O.some(1),
      minimumFractionDigits: O.some(0),
      maximumFractionDigits: O.some(2),
      minimumSignificantDigits: O.some(1),
      maximumSignificantDigits: O.some(6),
      notation: O.some("scientific"),
      roundingMode: O.some("roundClosest"),
    })
  );

  it("defaults every setting to none in the constructor", () => {
    assertNone(noOptions.useGrouping);
    assertNone(noOptions.convertNegativeToParenthesis);
    assertNone(noOptions.minimumIntegerDigits);
    assertNone(noOptions.minimumFractionDigits);
    assertNone(noOptions.maximumFractionDigits);
    assertNone(noOptions.minimumSignificantDigits);
    assertNone(noOptions.maximumSignificantDigits);
    assertNone(noOptions.notation);
    assertNone(noOptions.roundingMode);
  });

  it("requires digit counts to be whole numbers and leaves their range to the separate check", () => {
    assertTrue(S.is(NumberFormatOptions)(NumberFormatOptions.make({ maximumFractionDigits: O.some(250) })));
    assertTrue(S.is(NumberFormatOptions)(NumberFormatOptions.make({ minimumIntegerDigits: O.some(0) })));
    assertRejects(NumberFormatOptions, { maximumFractionDigits: 2.5 }, "maximumFractionDigits");
    assertRejects(NumberFormatOptions, { maximumFractionDigits: "2" }, "maximumFractionDigits");
    assertRejects(NumberFormatOptions, { useGrouping: "yes" }, "useGrouping");
  });

  it("offers the bounds a formatter enforces as a separate check", () => {
    const isRenderable = S.is(NumberFormatOptions.check(IntlDigitBounds));
    assertTrue(isRenderable(noOptions));
    assertTrue(
      isRenderable(
        NumberFormatOptions.make({
          minimumIntegerDigits: O.some(1),
          minimumFractionDigits: O.some(0),
          maximumFractionDigits: O.some(100),
          minimumSignificantDigits: O.some(1),
          maximumSignificantDigits: O.some(21),
        })
      )
    );
    assertFalse(isRenderable(NumberFormatOptions.make({ minimumIntegerDigits: O.some(0) })));
    assertFalse(isRenderable(NumberFormatOptions.make({ minimumIntegerDigits: O.some(22) })));
    assertFalse(isRenderable(NumberFormatOptions.make({ maximumFractionDigits: O.some(101) })));
    assertFalse(isRenderable(NumberFormatOptions.make({ minimumFractionDigits: O.some(-1) })));
    assertFalse(isRenderable(NumberFormatOptions.make({ minimumSignificantDigits: O.some(0) })));
    assertFalse(isRenderable(NumberFormatOptions.make({ maximumSignificantDigits: O.some(22) })));
    assertFalse(
      isRenderable(NumberFormatOptions.make({ minimumFractionDigits: O.some(4), maximumFractionDigits: O.some(2) }))
    );
    assertFalse(
      isRenderable(
        NumberFormatOptions.make({ minimumSignificantDigits: O.some(5), maximumSignificantDigits: O.some(3) })
      )
    );
  });

  it("names the violated bound when decoding with the separate check", () => {
    const Renderable = NumberFormatOptions.check(IntlDigitBounds);
    assertRejects(Renderable, { minimumIntegerDigits: 0 }, "minimumIntegerDigits must be a whole number from 1 to 21");
    assertRejects(Renderable, { maximumFractionDigits: 101 }, "whole numbers from 0 to 100");
    assertRejects(Renderable, { maximumSignificantDigits: 22 }, "whole numbers from 1 to 21");
    assertRejects(
      Renderable,
      { minimumFractionDigits: 4, maximumFractionDigits: 2 },
      "A minimum digit count must not exceed its maximum"
    );
  });
});

describe("Affix", () => {
  wireFixture("decodes and re-encodes an affix with no side", Affix, {}, Affix.make({}));

  wireFixture(
    "decodes and re-encodes both sides",
    Affix,
    { prefix: { type: "constant", value: "USD " }, postfix: { type: "propertyType", propertyApiName: "suffix" } },
    Affix.make({ prefix: O.some(constant("USD ")), postfix: O.some(lookup("suffix")) })
  );

  it("defaults both sides to none in the constructor", () => {
    const bare = Affix.make({});
    assertNone(bare.prefix);
    assertNone(bare.postfix);
  });
});

// -----------------------------------------------------------------------------
// DurationFormatStyle
// -----------------------------------------------------------------------------

describe("DurationFormatStyle", () => {
  wireFixture(
    "decodes and re-encodes a human readable style",
    DurationFormatStyle,
    { type: "humanReadable", showFullUnits: true },
    DurationFormatStyle.cases.humanReadable.make({ showFullUnits: O.some(true) })
  );

  wireFixture(
    "decodes and re-encodes a human readable style without the unit flag",
    DurationFormatStyle,
    { type: "humanReadable" },
    DurationFormatStyle.cases.humanReadable.make({})
  );

  wireFixture(
    "decodes and re-encodes a timecode style",
    DurationFormatStyle,
    { type: "timecode" },
    DurationFormatStyle.cases.timecode.make({})
  );

  it("constructs every case, guards it and matches exhaustively", () => {
    const readable = DurationFormatStyle.cases.humanReadable.make({});
    const timecode = DurationFormatStyle.cases.timecode.make({});
    const example = DurationFormatStyle.match({ humanReadable: () => "1h 1m 1s", timecode: () => "01:01:01" });
    deepStrictEqual(R.keys(DurationFormatStyle.cases), ["humanReadable", "timecode"]);
    assertNone(readable.showFullUnits);
    assertTrue(DurationFormatStyle.guards.humanReadable(readable));
    assertTrue(DurationFormatStyle.guards.timecode(timecode));
    assertFalse(DurationFormatStyle.guards.timecode(readable));
    deepStrictEqual([example(readable), example(timecode)], ["1h 1m 1s", "01:01:01"]);
  });

  it("rejects an unknown style", () => {
    assertRejects(DurationFormatStyle, { type: "iso8601" }, "DurationFormatStyle");
  });
});

// -----------------------------------------------------------------------------
// NumberFormat
// -----------------------------------------------------------------------------

describe("NumberFormat", () => {
  wireFixture(
    "standard",
    NumberFormat,
    { type: "standard", baseFormatOptions: { useGrouping: true, maximumFractionDigits: 2 } },
    NumberFormat.cases.standard.make({
      baseFormatOptions: NumberFormatOptions.make({ useGrouping: O.some(true), maximumFractionDigits: O.some(2) }),
    })
  );

  wireFixture(
    "fixedValues",
    NumberFormat,
    { type: "fixedValues", values: { "1": "First", "2": "Second", "3": "Third" } },
    NumberFormat.cases.fixedValues.make({ values: { "1": "First", "2": "Second", "3": "Third" } })
  );

  wireFixture(
    "currency read from a sibling property",
    NumberFormat,
    {
      type: "currency",
      baseFormatOptions: { minimumFractionDigits: 2, maximumFractionDigits: 2 },
      style: "STANDARD",
      currencyCode: { type: "propertyType", propertyApiName: "currencyCode" },
    },
    NumberFormat.cases.currency.make({
      baseFormatOptions: NumberFormatOptions.make({
        minimumFractionDigits: O.some(2),
        maximumFractionDigits: O.some(2),
      }),
      style: "standard",
      currencyCode: lookup("currencyCode"),
    })
  );

  wireFixture(
    "currency with a fixed code and the compact style",
    NumberFormat,
    {
      type: "currency",
      baseFormatOptions: {},
      style: "COMPACT",
      currencyCode: { type: "constant", value: "USD" },
    },
    NumberFormat.cases.currency.make({ style: "compact", currencyCode: constant("USD") })
  );

  wireFixture(
    "standardUnit",
    NumberFormat,
    {
      type: "standardUnit",
      baseFormatOptions: { maximumFractionDigits: 1 },
      unit: { type: "constant", value: "celsius" },
    },
    NumberFormat.cases.standardUnit.make({
      baseFormatOptions: NumberFormatOptions.make({ maximumFractionDigits: O.some(1) }),
      unit: constant("celsius"),
    })
  );

  wireFixture(
    "customUnit",
    NumberFormat,
    {
      type: "customUnit",
      baseFormatOptions: { useGrouping: true },
      unit: { type: "constant", value: "widgets" },
    },
    NumberFormat.cases.customUnit.make({
      baseFormatOptions: NumberFormatOptions.make({ useGrouping: O.some(true) }),
      unit: constant("widgets"),
    })
  );

  wireFixture(
    "affix (wire key `affix` is the domain key `decoration`)",
    NumberFormat,
    {
      type: "affix",
      baseFormatOptions: { useGrouping: true },
      affix: { prefix: { type: "constant", value: "USD " }, postfix: { type: "constant", value: " total" } },
    },
    NumberFormat.cases.affix.make({
      baseFormatOptions: NumberFormatOptions.make({ useGrouping: O.some(true) }),
      decoration: Affix.make({ prefix: O.some(constant("USD ")), postfix: O.some(constant(" total")) }),
    })
  );

  wireFixture(
    "duration (wire key `baseValue` is the domain key `inputUnit`)",
    NumberFormat,
    {
      type: "duration",
      formatStyle: { type: "humanReadable", showFullUnits: false },
      precision: "MINUTES",
      baseValue: "SECONDS",
    },
    NumberFormat.cases.duration.make({
      formatStyle: DurationFormatStyle.cases.humanReadable.make({ showFullUnits: O.some(false) }),
      precision: O.some("minutes"),
      inputUnit: "seconds",
    })
  );

  wireFixture(
    "duration without a precision",
    NumberFormat,
    { type: "duration", formatStyle: { type: "timecode" }, baseValue: "MILLISECONDS" },
    NumberFormat.cases.duration.make({
      formatStyle: DurationFormatStyle.cases.timecode.make({}),
      inputUnit: "milliseconds",
    })
  );

  wireFixture(
    "scale",
    NumberFormat,
    { type: "scale", scaleType: "THOUSANDS", baseFormatOptions: { maximumFractionDigits: 1 } },
    NumberFormat.cases.scale.make({
      scaleType: "thousands",
      baseFormatOptions: NumberFormatOptions.make({ maximumFractionDigits: O.some(1) }),
    })
  );

  wireFixture(
    "ratio",
    NumberFormat,
    { type: "ratio", ratioType: "BASIS_POINTS", baseFormatOptions: {} },
    NumberFormat.cases.ratio.make({ ratioType: "basisPoints" })
  );

  it("keeps the union's cases in the order of its kind vocabulary", () => {
    deepStrictEqual(R.keys(NumberFormat.cases), A.fromIterable(NumberFormatKind.literals));
    strictEqual(NumberFormat.members.length, 9);
  });

  it("constructs every case, guards it and matches exhaustively", () => {
    const formats = {
      standard: NumberFormat.cases.standard.make({}),
      fixedValues: NumberFormat.cases.fixedValues.make({ values: { "0": "Off", "1": "On" } }),
      currency: NumberFormat.cases.currency.make({ style: "standard", currencyCode: constant("EUR") }),
      standardUnit: NumberFormat.cases.standardUnit.make({ unit: constant("meter") }),
      customUnit: NumberFormat.cases.customUnit.make({ unit: lookup("unit") }),
      affix: NumberFormat.cases.affix.make({ decoration: Affix.make({ prefix: O.some(constant("~")) }) }),
      duration: NumberFormat.cases.duration.make({
        formatStyle: DurationFormatStyle.cases.timecode.make({}),
        inputUnit: "seconds",
      }),
      scale: NumberFormat.cases.scale.make({ scaleType: "millions" }),
      ratio: NumberFormat.cases.ratio.make({ ratioType: "percentage" }),
    };
    const summarize = NumberFormat.match({
      standard: () => "plain",
      fixedValues: ({ values }) => `${R.size(values)} labels`,
      currency: ({ style }) => `${style} currency`,
      standardUnit: () => "standard unit",
      customUnit: () => "custom unit",
      affix: ({ decoration }) => (O.isSome(decoration.prefix) ? "prefixed" : "bare"),
      duration: ({ inputUnit }) => `duration in ${inputUnit}`,
      scale: ({ scaleType }) => `in ${scaleType}`,
      ratio: ({ ratioType }) => `as ${ratioType}`,
    });
    assertTrue(NumberFormat.guards.standard(formats.standard));
    assertTrue(NumberFormat.guards.fixedValues(formats.fixedValues));
    assertTrue(NumberFormat.guards.currency(formats.currency));
    assertTrue(NumberFormat.guards.standardUnit(formats.standardUnit));
    assertTrue(NumberFormat.guards.customUnit(formats.customUnit));
    assertTrue(NumberFormat.guards.affix(formats.affix));
    assertTrue(NumberFormat.guards.duration(formats.duration));
    assertTrue(NumberFormat.guards.scale(formats.scale));
    assertTrue(NumberFormat.guards.ratio(formats.ratio));
    assertFalse(NumberFormat.guards.standardUnit(formats.customUnit));
    deepStrictEqual(
      A.map(R.values(formats), (format) => summarize(format)),
      [
        "plain",
        "2 labels",
        "standard currency",
        "standard unit",
        "custom unit",
        "prefixed",
        "duration in seconds",
        "in millions",
        "as percentage",
      ]
    );
    deepStrictEqual(
      A.map(R.values(formats), (format) => format.type),
      A.fromIterable(NumberFormatKind.literals)
    );
  });

  it("tells the two formats that replace the number from the seven that keep it", () => {
    const replacesNumber = NumberFormat.isAnyOf(["fixedValues", "duration"]);
    assertTrue(replacesNumber(NumberFormat.cases.fixedValues.make({ values: {} })));
    assertFalse(replacesNumber(NumberFormat.cases.standard.make({})));
  });

  it.effect(
    "defaults the base options to no settings in the constructor, and still encodes the required key",
    Effect.fnUntraced(function* () {
      const plain = NumberFormat.cases.standard.make({});
      deepStrictEqual(plain.baseFormatOptions, noOptions);
      const encoded = yield* S.encodeEffect(NumberFormat)(plain);
      deepStrictEqual(encoded, { type: "standard", baseFormatOptions: {} });
    })
  );

  it("requires the base options on the wire for the seven formats that carry them", () => {
    assertRejects(NumberFormat, { type: "standard" }, "Missing key");
    assertRejects(NumberFormat, { type: "scale", scaleType: "THOUSANDS" }, "Missing key");
    assertRejects(NumberFormat, { type: "ratio", ratioType: "PERCENTAGE" }, "Missing key");
    assertRejects(
      NumberFormat,
      { type: "currency", style: "STANDARD", currencyCode: { type: "constant", value: "USD" } },
      "Missing key"
    );
  });

  it("accepts only integer keys in a fixed-value table", () => {
    assertRejects(
      NumberFormat,
      { type: "fixedValues", values: { "1.5": "Between", "2": "Second" } },
      "Every key of a fixed-value table must be an integer"
    );
    assertRejects(
      NumberFormat,
      { type: "fixedValues", values: { first: "First" } },
      "Every key of a fixed-value table must be an integer"
    );
    assertRejects(NumberFormat, { type: "fixedValues", values: { "1": 1 } }, "values");
    assertTrue(S.is(NumberFormat)(NumberFormat.cases.fixedValues.make({ values: { "-3": "Below", "0": "Zero" } })));
  });

  it("rejects the domain's clearer keys on the wire", () => {
    assertRejects(
      NumberFormat,
      { type: "affix", baseFormatOptions: {}, decoration: { prefix: { type: "constant", value: "~" } } },
      "Missing key"
    );
    assertRejects(
      NumberFormat,
      { type: "duration", formatStyle: { type: "timecode" }, inputUnit: "SECONDS" },
      "Missing key"
    );
  });

  it("rejects a number format outside the union, including the wire's orphan basis-points record", () => {
    assertRejects(NumberFormat, { type: "basisPoints", baseFormatOptions: {} }, "NumberFormat");
    assertRejects(NumberFormat, { baseFormatOptions: {} }, "NumberFormat");
  });
});

// -----------------------------------------------------------------------------
// DatetimeFormat and DatetimeTimezone
// -----------------------------------------------------------------------------

describe("DatetimeFormat", () => {
  wireFixture(
    "decodes and re-encodes a pattern",
    DatetimeFormat,
    { type: "stringFormat", pattern: "yyyy-MM-dd HH:mm" },
    DatetimeFormat.cases.stringFormat.make({ pattern: "yyyy-MM-dd HH:mm" })
  );

  wireFixture(
    "decodes and re-encodes a preset (wire key `format` is the domain key `preset`)",
    DatetimeFormat,
    { type: "localizedFormat", format: "DATE_FORMAT_DATE_TIME_SHORT" },
    DatetimeFormat.cases.localizedFormat.make({ preset: "dateFormatDateTimeShort" })
  );

  it("constructs every case, guards it and matches exhaustively", () => {
    const pattern = DatetimeFormat.cases.stringFormat.make({ pattern: "MMM d" });
    const preset = DatetimeFormat.cases.localizedFormat.make({ preset: "dateFormatIsoInstant" });
    const describeFormat = DatetimeFormat.match({
      stringFormat: (format) => `pattern ${format.pattern}`,
      localizedFormat: (format) => `preset ${format.preset}`,
    });
    deepStrictEqual(R.keys(DatetimeFormat.cases), ["stringFormat", "localizedFormat"]);
    assertTrue(DatetimeFormat.guards.stringFormat(pattern));
    assertTrue(DatetimeFormat.guards.localizedFormat(preset));
    assertFalse(DatetimeFormat.guards.localizedFormat(pattern));
    deepStrictEqual([describeFormat(pattern), describeFormat(preset)], ["pattern MMM d", "preset dateFormatIsoInstant"]);
  });

  it("rejects the domain key on the wire, an unknown preset and an unknown format", () => {
    assertRejects(DatetimeFormat, { type: "localizedFormat", preset: "dateFormatDate" }, "Missing key");
    assertRejects(DatetimeFormat, { type: "localizedFormat", format: "DATE_FORMAT_WEEK" }, "DatetimePreset");
    assertRejects(DatetimeFormat, { type: "relativeFormat" }, "DatetimeFormat");
  });
});

describe("DatetimeTimezone", () => {
  wireFixture(
    "decodes and re-encodes a fixed zone",
    DatetimeTimezone,
    { type: "static", zoneId: { type: "constant", value: "America/New_York" } },
    DatetimeTimezone.cases.static.make({ zoneId: constant("America/New_York") })
  );

  wireFixture(
    "decodes and re-encodes a zone read from a sibling property",
    DatetimeTimezone,
    { type: "static", zoneId: { type: "propertyType", propertyApiName: "siteTimezone" } },
    DatetimeTimezone.cases.static.make({ zoneId: lookup("siteTimezone") })
  );

  wireFixture(
    "decodes and re-encodes the viewer's zone",
    DatetimeTimezone,
    { type: "user" },
    DatetimeTimezone.cases.user.make({})
  );

  it("constructs every case, guards it and matches exhaustively", () => {
    const fixed = DatetimeTimezone.cases.static.make({ zoneId: constant("Europe/Rome") });
    const viewer = DatetimeTimezone.cases.user.make({});
    const zoneOf = DatetimeTimezone.match({
      static: ({ zoneId }) => O.some(zoneId),
      user: () => O.none<PropertyOrConstant>(),
    });
    deepStrictEqual(R.keys(DatetimeTimezone.cases), ["static", "user"]);
    assertTrue(DatetimeTimezone.guards.static(fixed));
    assertTrue(DatetimeTimezone.guards.user(viewer));
    assertFalse(DatetimeTimezone.guards.user(fixed));
    assertSome(zoneOf(fixed), constant("Europe/Rome"));
    assertNone(zoneOf(viewer));
  });

  it("rejects a fixed zone without a zone and an unknown zone source", () => {
    assertRejects(DatetimeTimezone, { type: "static" }, "Missing key");
    assertRejects(DatetimeTimezone, { type: "utc" }, "DatetimeTimezone");
  });
});

// -----------------------------------------------------------------------------
// ValueFormat
// -----------------------------------------------------------------------------

describe("ValueFormat", () => {
  wireFixture(
    "number (wire key `numberType` is the domain key `format`)",
    ValueFormat,
    {
      type: "number",
      numberType: {
        type: "currency",
        baseFormatOptions: {
          useGrouping: true,
          convertNegativeToParenthesis: true,
          maximumFractionDigits: 2,
          notation: "COMPACT",
          roundingMode: "FLOOR",
        },
        style: "COMPACT",
        currencyCode: { type: "propertyType", propertyApiName: "currency" },
      },
    },
    ValueFormat.cases.number.make({
      format: NumberFormat.cases.currency.make({
        baseFormatOptions: NumberFormatOptions.make({
          useGrouping: O.some(true),
          convertNegativeToParenthesis: O.some(true),
          maximumFractionDigits: O.some(2),
          notation: O.some("compact"),
          roundingMode: O.some("floor"),
        }),
        style: "compact",
        currencyCode: lookup("currency"),
      }),
    })
  );

  wireFixture(
    "timestamp in a fixed zone",
    ValueFormat,
    {
      type: "timestamp",
      format: { type: "localizedFormat", format: "DATE_FORMAT_DATE_TIME" },
      displayTimezone: { type: "static", zoneId: { type: "constant", value: "America/New_York" } },
    },
    ValueFormat.cases.timestamp.make({
      format: DatetimeFormat.cases.localizedFormat.make({ preset: "dateFormatDateTime" }),
      displayTimezone: DatetimeTimezone.cases.static.make({ zoneId: constant("America/New_York") }),
    })
  );

  wireFixture(
    "timestamp in the viewer's zone",
    ValueFormat,
    {
      type: "timestamp",
      format: { type: "stringFormat", pattern: "yyyy-MM-dd'T'HH:mm" },
      displayTimezone: { type: "user" },
    },
    ValueFormat.cases.timestamp.make({
      format: DatetimeFormat.cases.stringFormat.make({ pattern: "yyyy-MM-dd'T'HH:mm" }),
      displayTimezone: DatetimeTimezone.cases.user.make({}),
    })
  );

  wireFixture(
    "date",
    ValueFormat,
    { type: "date", format: { type: "localizedFormat", format: "DATE_FORMAT_YEAR_AND_MONTH" } },
    ValueFormat.cases.date.make({ format: DatetimeFormat.cases.localizedFormat.make({ preset: "dateFormatYearAndMonth" }) })
  );

  wireFixture(
    "boolean",
    ValueFormat,
    { type: "boolean", valueIfTrue: "Yes", valueIfFalse: "No" },
    ValueFormat.cases.boolean.make({ valueIfTrue: "Yes", valueIfFalse: "No" })
  );

  wireFixture(
    "knownType",
    ValueFormat,
    { type: "knownType", knownType: "USER_OR_GROUP_ID" },
    ValueFormat.cases.knownType.make({ knownType: "userOrGroupId" })
  );

  it("keeps the union's cases in the order of its kind vocabulary", () => {
    deepStrictEqual(R.keys(ValueFormat.cases), A.fromIterable(ValueFormatKind.literals));
    strictEqual(ValueFormat.members.length, 5);
  });

  it("constructs every case, guards it and matches exhaustively", () => {
    const pattern = DatetimeFormat.cases.stringFormat.make({ pattern: "yyyy-MM-dd" });
    const formats = {
      number: ValueFormat.cases.number.make({ format: NumberFormat.cases.standard.make({}) }),
      timestamp: ValueFormat.cases.timestamp.make({
        format: pattern,
        displayTimezone: DatetimeTimezone.cases.user.make({}),
      }),
      date: ValueFormat.cases.date.make({ format: pattern }),
      boolean: ValueFormat.cases.boolean.make({ valueIfTrue: "On", valueIfFalse: "Off" }),
      knownType: ValueFormat.cases.knownType.make({ knownType: "resourceRid" }),
    };
    const summarize = ValueFormat.match({
      number: ({ format }) => `number as ${format.type}`,
      timestamp: ({ displayTimezone }) => `timestamp in the ${displayTimezone.type} zone`,
      date: ({ format }) => `date by ${format.type}`,
      boolean: ({ valueIfFalse, valueIfTrue }) => `${valueIfTrue} or ${valueIfFalse}`,
      knownType: ({ knownType }) => `identifier of a ${knownType}`,
    });
    assertTrue(ValueFormat.guards.number(formats.number));
    assertTrue(ValueFormat.guards.timestamp(formats.timestamp));
    assertTrue(ValueFormat.guards.date(formats.date));
    assertTrue(ValueFormat.guards.boolean(formats.boolean));
    assertTrue(ValueFormat.guards.knownType(formats.knownType));
    assertFalse(ValueFormat.guards.date(formats.timestamp));
    assertTrue(ValueFormat.isAnyOf(["date", "timestamp"])(formats.date));
    assertFalse(ValueFormat.isAnyOf(["date", "timestamp"])(formats.number));
    deepStrictEqual(
      A.map(R.values(formats), (format) => summarize(format)),
      [
        "number as standard",
        "timestamp in the user zone",
        "date by stringFormat",
        "On or Off",
        "identifier of a resourceRid",
      ]
    );
    deepStrictEqual(
      A.map(R.values(formats), (format) => format.type),
      A.fromIterable(ValueFormatKind.literals)
    );
  });

  it("requires a display zone on a timestamp rule", () => {
    assertRejects(ValueFormat, { type: "timestamp", format: { type: "stringFormat", pattern: "yyyy" } }, "Missing key");
  });

  it.effect(
    "gives a date rule no display zone, dropping one the wire should never send",
    Effect.fnUntraced(function* () {
      const input: unknown = {
        type: "date",
        format: { type: "localizedFormat", format: "DATE_FORMAT_DATE" },
        displayTimezone: { type: "user" },
      };
      const decoded = yield* S.decodeUnknownEffect(ValueFormat)(input);
      deepStrictEqual(
        decoded,
        ValueFormat.cases.date.make({ format: DatetimeFormat.cases.localizedFormat.make({ preset: "dateFormatDate" }) })
      );
      const encoded = yield* S.encodeEffect(ValueFormat)(decoded);
      deepStrictEqual(encoded, { type: "date", format: { type: "localizedFormat", format: "DATE_FORMAT_DATE" } });
    })
  );

  it("rejects the domain's clearer key on the wire", () => {
    assertRejects(ValueFormat, { type: "number", format: { type: "standard", baseFormatOptions: {} } }, "Missing key");
  });

  it("rejects a boolean rule missing either text and a known type outside the domain", () => {
    assertRejects(ValueFormat, { type: "boolean", valueIfTrue: "Yes" }, "Missing key");
    assertRejects(ValueFormat, { type: "knownType", knownType: "resourceRid" }, "KnownType");
  });

  it("rejects a rule outside the union and reports where a nested rule is wrong", () => {
    assertRejects(ValueFormat, { type: "string" }, "ValueFormat");
    assertRejects(
      ValueFormat,
      { type: "number", numberType: { type: "basisPoints", baseFormatOptions: {} } },
      '["numberType"]'
    );
    assertRejects(
      ValueFormat,
      {
        type: "number",
        numberType: { type: "fixedValues", values: { one: "First" } },
      },
      '["numberType"]["values"]["one"]'
    );
  });
});

// ---------------------------------------------------------------------------
// Fields that hold another class
// ---------------------------------------------------------------------------

type SameType<Left, Right> = (<T>() => T extends Left ? 1 : 2) extends <T>() => T extends Right ? 1 : 2 ? true : false;

describe("fields that hold another class", () => {
  // Law: a field whose schema is a class is typed as that class, so its value can be handed to anything that asks
  // for the class. Annotating the key of a class would silently type the field as the class's un-branded record.
  it("are typed as the class and never as its un-branded record", () => {
    const facts: readonly [
      SameType<NumberFormatAffix["decoration"], Affix>,
      SameType<NumberFormatStandard["baseFormatOptions"], NumberFormatOptions>,
    ] = [true, true];
    assertTrue(A.every(facts, (fact) => fact));
  });
});
