import { fcRuns } from "@beep/test-utils";
import { describe, it } from "@effect/vitest";
import {
  assertInclude,
  assertNone,
  assertSome,
  assertTrue,
  deepStrictEqual,
  strictEqual,
  throws,
} from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Arbitrary from "effect/Arbitrary";
import * as BigDecimal from "effect/BigDecimal";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import { identity } from "effect/Function";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { StringType } from "../src/DataType/DataType.model.ts";
import { ValueTypeKind } from "../src/DataType/DataType.values.ts";
import { PropertyApiName, ValueTypeApiName, ValueTypeRid } from "../src/Identifier/Identifier.model.ts";
import { DecimalValue, LongValue, TimestampValue } from "../src/Value/index.ts";
import {
  ArrayConstraint,
  constraintCheck,
  EnumConstraint,
  LengthConstraint,
  OntologyValueType,
  RegexConstraint,
  RidConstraint,
  StructConstraint,
  StructFieldName,
  UuidConstraint,
  ValueRangeConstraint,
  ValueTypeArray,
  ValueTypeConstraint,
  ValueTypeConstraintKind,
  ValueTypeDecimal,
  ValueTypeFieldType,
  ValueTypeMap,
  ValueTypeOptional,
  ValueTypeReference,
  ValueTypeStatus,
  ValueTypeStruct,
  ValueTypeStructField,
  ValueTypeUnion,
  ValueTypeVersion,
} from "../src/ValueType/index.ts";

// ---------------------------------------------------------------------------
// Laws shared by every named schema
// ---------------------------------------------------------------------------

const generatesMembers = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  const is = S.is(schema);
  it.prop(`${name}: generated values satisfy the schema guard`, [Arbitrary.schema(schema)], ([value]) => is(value), {
    arbitrary: fcRuns(50),
  });
};

// Every schema here: a value has exactly one wire spelling and that spelling decodes back to it. That includes the
// schemas that hold a scalar bound or option, which is the wire scalar itself.
const lawful = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  const equivalence = S.toEquivalence(schema);
  const encode = S.encodeEffect(schema);
  const decode = S.decodeEffect(schema);

  generatesMembers(name, schema);

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

const rejects =
  <T, E>(schema: S.Codec<T, E>) =>
  (input: unknown): Effect.Effect<boolean> =>
    Effect.map(Effect.exit(S.decodeUnknownEffect(schema)(input)), Exit.isFailure);

type Equals<Left, Right> = (<T>() => T extends Left ? 1 : 2) extends <T>() => T extends Right ? 1 : 2 ? true : false;
type Assignable<From, To> = [From] extends [To] ? true : false;

const text = StringType.make({});
const street = StructFieldName.make("street");

// ---------------------------------------------------------------------------
// Names, versions and status
// ---------------------------------------------------------------------------

describe("names, versions and status", () => {
  lawful("StructFieldName", StructFieldName);
  lawful("ValueTypeVersion", ValueTypeVersion);
  lawful("ValueTypeStatus", ValueTypeStatus);

  it("pairs each wire status with one domain literal, in wire order", () => {
    deepStrictEqual(ValueTypeStatus.Pairs, [
      ["ACTIVE", "active"],
      ["DEPRECATED", "deprecated"],
    ]);
  });

  it.effect(
    "decodes each wire status and encodes it back",
    Effect.fnUntraced(function* () {
      const decoded = yield* Effect.forEach(["ACTIVE", "DEPRECATED"], (wire) =>
        S.decodeUnknownEffect(ValueTypeStatus)(wire)
      );
      deepStrictEqual(decoded, ["active", "deprecated"]);
      const encoded = yield* Effect.forEach(decoded, (status) => S.encodeEffect(ValueTypeStatus)(status));
      deepStrictEqual(encoded, ["ACTIVE", "DEPRECATED"]);
    })
  );

  it("matches every domain status exhaustively through the reverse kit", () => {
    const statuses: ReadonlyArray<ValueTypeStatus> = ["active", "deprecated"];
    const usable = ValueTypeStatus.To.match({ active: () => true, deprecated: () => false });
    deepStrictEqual(A.map(statuses, usable), [true, false]);
  });

  it.effect(
    "rejects empty names, empty versions, domain literals on the wire and unknown statuses",
    Effect.fnUntraced(function* () {
      const verdicts = yield* Effect.all([
        rejects(StructFieldName)(""),
        rejects(ValueTypeVersion)(""),
        rejects(ValueTypeStatus)("active"),
        rejects(ValueTypeStatus)("EXPERIMENTAL"),
      ]);
      assertTrue(A.every(verdicts, identity));
    })
  );

  it.effect(
    "accepts a version that is not a semantic version, because the wire only promises a string",
    Effect.fnUntraced(function* () {
      const version = yield* S.decodeEffect(ValueTypeVersion)("draft-7");
      strictEqual(version, ValueTypeVersion.make("draft-7"));
    })
  );
});

// ---------------------------------------------------------------------------
// Base types
// ---------------------------------------------------------------------------

describe("ValueTypeFieldType", () => {
  lawful("ValueTypeDecimal", ValueTypeDecimal);
  lawful("ValueTypeArray", ValueTypeArray);
  lawful("ValueTypeMap", ValueTypeMap);
  lawful("ValueTypeStructField", ValueTypeStructField);
  lawful("ValueTypeStruct", ValueTypeStruct);
  lawful("ValueTypeUnion", ValueTypeUnion);
  lawful("ValueTypeOptional", ValueTypeOptional);
  lawful("ValueTypeReference", ValueTypeReference);
  lawful("ValueTypeFieldType", ValueTypeFieldType);

  const decodeFieldType = S.decodeEffect(ValueTypeFieldType);
  const encodeFieldType = S.encodeEffect(ValueTypeFieldType);
  const fieldTypeEquivalence = S.toEquivalence(ValueTypeFieldType);

  it("declares hand-written encoded types that agree with the schemas", () => {
    const facts: readonly [
      Assignable<typeof ValueTypeFieldType.Encoded, ValueTypeFieldType.Encoded>,
      Assignable<ValueTypeFieldType.Encoded, typeof ValueTypeFieldType.Encoded>,
      Assignable<typeof ValueTypeArray.Encoded, ValueTypeArray.Encoded>,
      Assignable<ValueTypeArray.Encoded, typeof ValueTypeArray.Encoded>,
      Assignable<typeof ValueTypeMap.Encoded, ValueTypeMap.Encoded>,
      Assignable<ValueTypeMap.Encoded, typeof ValueTypeMap.Encoded>,
      Assignable<typeof ValueTypeStructField.Encoded, ValueTypeStructField.Encoded>,
      Assignable<ValueTypeStructField.Encoded, typeof ValueTypeStructField.Encoded>,
      Assignable<typeof ValueTypeStruct.Encoded, ValueTypeStruct.Encoded>,
      Assignable<ValueTypeStruct.Encoded, typeof ValueTypeStruct.Encoded>,
      Assignable<typeof ValueTypeUnion.Encoded, ValueTypeUnion.Encoded>,
      Assignable<ValueTypeUnion.Encoded, typeof ValueTypeUnion.Encoded>,
      Assignable<typeof ValueTypeOptional.Encoded, ValueTypeOptional.Encoded>,
      Assignable<ValueTypeOptional.Encoded, typeof ValueTypeOptional.Encoded>,
      Equals<typeof ValueTypeDecimal.Encoded, { readonly type: "decimal" }>,
      Equals<typeof ValueTypeReference.Encoded, { readonly type: "reference" }>,
      Equals<ValueTypeArray["elementType"], O.Option<ValueTypeFieldType>>,
      Equals<ValueTypeStructField["name"], O.Option<StructFieldName>>,
      Equals<ValueTypeFieldType["type"], ValueTypeKind>,
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
    ];
    assertTrue(A.every(facts, identity));
  });

  const everyFieldType: ReadonlyArray<ValueTypeFieldType> = [
    ValueTypeFieldType.cases.boolean.make({}),
    ValueTypeFieldType.cases.byte.make({}),
    ValueTypeFieldType.cases.short.make({}),
    ValueTypeFieldType.cases.integer.make({}),
    ValueTypeFieldType.cases.long.make({}),
    ValueTypeFieldType.cases.float.make({}),
    ValueTypeFieldType.cases.double.make({}),
    ValueTypeFieldType.cases.decimal.make({}),
    ValueTypeFieldType.cases.string.make({}),
    ValueTypeFieldType.cases.date.make({}),
    ValueTypeFieldType.cases.timestamp.make({}),
    ValueTypeFieldType.cases.binary.make({}),
    ValueTypeFieldType.cases.array.make({ elementType: O.some(text) }),
    ValueTypeFieldType.cases.map.make({ keyType: O.some(text), valueType: O.some(ValueTypeDecimal.make({})) }),
    ValueTypeFieldType.cases.struct.make({
      fields: [ValueTypeStructField.make({ name: O.some(street), fieldType: O.some(text) })],
    }),
    ValueTypeFieldType.cases.union.make({ memberTypes: [text, ValueTypeReference.make({})] }),
    ValueTypeFieldType.cases.optional.make({ wrappedType: O.some(text) }),
    ValueTypeFieldType.cases.reference.make({}),
  ];

  it("has one case per value-type tag, in the kit's order", () => {
    deepStrictEqual(R.keys(ValueTypeFieldType.cases), A.fromIterable<string>(ValueTypeKind.literals));
    strictEqual(A.length(ValueTypeKind.literals), 18);
  });

  it("constructs every case through .cases and folds each with one exhaustive match", () => {
    const tagOf = ValueTypeFieldType.match({
      boolean: ({ type }) => type,
      byte: ({ type }) => type,
      short: ({ type }) => type,
      integer: ({ type }) => type,
      long: ({ type }) => type,
      float: ({ type }) => type,
      double: ({ type }) => type,
      decimal: ({ type }) => type,
      string: ({ type }) => type,
      date: ({ type }) => type,
      timestamp: ({ type }) => type,
      binary: ({ type }) => type,
      array: ({ type }) => type,
      map: ({ type }) => type,
      struct: ({ type }) => type,
      union: ({ type }) => type,
      optional: ({ type }) => type,
      reference: ({ type }) => type,
    });
    deepStrictEqual(A.map(everyFieldType, tagOf), A.fromIterable<ValueTypeKind>(ValueTypeKind.literals));
    assertTrue(A.every(everyFieldType, S.is(ValueTypeFieldType)));
  });

  it("measures nesting with a recursive exhaustive match", () => {
    const childDepth = O.match({ onNone: () => 0, onSome: (child: ValueTypeFieldType) => depth(child) });
    const deepest = (children: ReadonlyArray<number>): number =>
      A.reduce(children, 0, (most, next) => Math.max(most, next));
    const depth = (fieldType: ValueTypeFieldType): number =>
      ValueTypeFieldType.match(fieldType, {
        boolean: () => 0,
        byte: () => 0,
        short: () => 0,
        integer: () => 0,
        long: () => 0,
        float: () => 0,
        double: () => 0,
        decimal: () => 0,
        string: () => 0,
        date: () => 0,
        timestamp: () => 0,
        binary: () => 0,
        array: ({ elementType }) => 1 + childDepth(elementType),
        map: ({ keyType, valueType }) => 1 + Math.max(childDepth(keyType), childDepth(valueType)),
        struct: ({ fields }) => 1 + deepest(A.map(fields, (field) => childDepth(field.fieldType))),
        union: ({ memberTypes }) => 1 + deepest(A.map(memberTypes, depth)),
        optional: ({ wrappedType }) => 1 + childDepth(wrappedType),
        reference: () => 0,
      });
    const streetField = ValueTypeStructField.make({ name: O.some(street), fieldType: O.some(text) });
    const nested = ValueTypeOptional.make({
      wrappedType: O.some(
        ValueTypeArray.make({ elementType: O.some(ValueTypeStruct.make({ fields: [streetField] })) })
      ),
    });
    deepStrictEqual([depth(text), depth(ValueTypeArray.make({})), depth(nested)], [0, 1, 3]);
  });

  it("answers membership questions with guards and isAnyOf", () => {
    const isComposite = ValueTypeFieldType.isAnyOf(["array", "map", "struct", "union", "optional"]);
    deepStrictEqual(A.map(everyFieldType, isComposite), [
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      true,
      true,
      true,
      true,
      true,
      false,
    ]);
    assertTrue(ValueTypeFieldType.guards.decimal(ValueTypeDecimal.make({})));
    assertTrue(!ValueTypeFieldType.guards.decimal(text));
  });

  // Written from the wire declaration of `ValueTypeFieldType` (18 members; every child key optional).
  const everyFieldTypeWire: ReadonlyArray<ValueTypeFieldType.Encoded> = [
    { type: "boolean" },
    { type: "byte" },
    { type: "short" },
    { type: "integer" },
    { type: "long" },
    { type: "float" },
    { type: "double" },
    { type: "decimal" },
    { type: "string" },
    { type: "date" },
    { type: "timestamp" },
    { type: "binary" },
    { type: "array", subType: { type: "string" } },
    { type: "array" },
    { type: "map", keyType: { type: "string" }, valueType: { type: "optional", wrappedType: { type: "integer" } } },
    { type: "map" },
    {
      type: "struct",
      fields: [
        { name: "street", fieldType: { type: "string" } },
        { name: "unit" },
        { fieldType: { type: "long" } },
        {},
      ],
    },
    { type: "union", memberTypes: [{ type: "date" }, { type: "timestamp" }, { type: "reference" }] },
    { type: "union", memberTypes: [] },
    { type: "optional", wrappedType: { type: "array", subType: { type: "array", subType: { type: "double" } } } },
    { type: "optional" },
    { type: "reference" },
  ];

  it.effect(
    "decodes every wire base type and encodes it back to the same JSON",
    Effect.fnUntraced(function* () {
      const decoded = yield* Effect.forEach(everyFieldTypeWire, (wire) => decodeFieldType(wire));
      const encoded = yield* Effect.forEach(decoded, (fieldType) => encodeFieldType(fieldType));
      deepStrictEqual(encoded, everyFieldTypeWire);
    })
  );

  it.effect(
    "renames the wire's subType to elementType and turns absent children into none",
    Effect.fnUntraced(function* () {
      const wire: ValueTypeFieldType.Encoded = { type: "array", subType: { type: "string" } };
      const listOfText = yield* decodeFieldType(wire);
      assertTrue(fieldTypeEquivalence(listOfText, ValueTypeArray.make({ elementType: O.some(text) })));
      deepStrictEqual(listOfText, ValueTypeArray.make({ elementType: O.some(text) }));

      const bare = yield* S.decodeEffect(ValueTypeArray)({ type: "array" });
      assertNone(bare.elementType);
      const bareWire = yield* S.encodeEffect(ValueTypeArray)(bare);
      deepStrictEqual(bareWire, { type: "array" });

      const domainKeyOnTheWire = yield* S.decodeUnknownEffect(ValueTypeArray)({
        type: "array",
        elementType: { type: "string" },
      });
      assertNone(domainKeyOnTheWire.elementType);
    })
  );

  it.effect(
    "decodes a struct whose fields omit a name, a type or both",
    Effect.fnUntraced(function* () {
      const wire: ValueTypeStruct.Encoded = {
        type: "struct",
        fields: [{ name: "street", fieldType: { type: "string" } }, { name: "unit" }, {}],
      };
      const struct = yield* S.decodeEffect(ValueTypeStruct)(wire);
      deepStrictEqual(
        A.map(struct.fields, (field) => [O.isSome(field.name), O.isSome(field.fieldType)]),
        [
          [true, true],
          [true, false],
          [false, false],
        ]
      );
      const first = A.head(struct.fields);
      assertSome(
        O.flatMap(first, (field) => field.name),
        street
      );
      assertSome(
        O.flatMap(first, (field) => field.fieldType),
        text
      );
    })
  );

  it.effect(
    "keeps the decimal free of a precision and scale the wire does not have",
    Effect.fnUntraced(function* () {
      const decimal = yield* S.decodeUnknownEffect(ValueTypeFieldType)({ type: "decimal", precision: 10, scale: 2 });
      deepStrictEqual(decimal, ValueTypeDecimal.make({}));
      const wire = yield* encodeFieldType(decimal);
      deepStrictEqual(wire, { type: "decimal" });
    })
  );

  it.effect(
    "decodes child lists longer than the arbitrary size hint",
    Effect.fnUntraced(function* () {
      const members = A.makeBy(7, (): ValueTypeFieldType.Encoded => ({ type: "string" }));
      const union = yield* S.decodeEffect(ValueTypeUnion)({ type: "union", memberTypes: members });
      strictEqual(A.length(union.memberTypes), 7);
    })
  );

  it("applies constructor defaults: every child type starts absent", () => {
    assertNone(ValueTypeArray.make({}).elementType);
    assertNone(ValueTypeMap.make({}).keyType);
    assertNone(ValueTypeMap.make({}).valueType);
    assertNone(ValueTypeOptional.make({}).wrappedType);
    assertNone(ValueTypeStructField.make({}).name);
    assertNone(ValueTypeStructField.make({}).fieldType);
  });

  it.effect(
    "rejects tags outside the value-type universe, missing lists and malformed children",
    Effect.fnUntraced(function* () {
      const verdicts = yield* Effect.all([
        rejects(ValueTypeFieldType)({ type: "geopoint" }),
        rejects(ValueTypeFieldType)({ type: "marking" }),
        rejects(ValueTypeFieldType)({ type: "set" }),
        rejects(ValueTypeFieldType)({ type: "typeReference", typeId: "x" }),
        rejects(ValueTypeFieldType)({}),
        rejects(ValueTypeFieldType)("string"),
        rejects(ValueTypeFieldType)({ type: "struct" }),
        rejects(ValueTypeFieldType)({ type: "union" }),
        rejects(ValueTypeFieldType)({ type: "array", subType: { type: "nope" } }),
        rejects(ValueTypeFieldType)({ type: "array", subType: null }),
        rejects(ValueTypeFieldType)({ type: "struct", fields: [{ name: "" }] }),
        rejects(ValueTypeFieldType)({ type: "optional", wrappedType: { type: "map", keyType: 1 } }),
      ]);
      assertTrue(A.every(verdicts, identity));
    })
  );
});

// ---------------------------------------------------------------------------
// Constraints
// ---------------------------------------------------------------------------

describe("ValueTypeConstraint", () => {
  lawful("ValueTypeConstraintKind", ValueTypeConstraintKind);
  lawful("StructConstraint", StructConstraint);
  lawful("RegexConstraint", RegexConstraint);
  lawful("LengthConstraint", LengthConstraint);
  lawful("RidConstraint", RidConstraint);
  lawful("UuidConstraint", UuidConstraint);
  lawful("ValueRangeConstraint", ValueRangeConstraint);
  lawful("EnumConstraint", EnumConstraint);
  lawful("ArrayConstraint", ArrayConstraint);
  lawful("ValueTypeConstraint", ValueTypeConstraint);

  const decodeConstraint = S.decodeEffect(ValueTypeConstraint);
  const encodeConstraint = S.encodeEffect(ValueTypeConstraint);
  const constraintEquivalence = S.toEquivalence(ValueTypeConstraint);

  it("declares hand-written encoded types that agree with the schemas", () => {
    const facts: readonly [
      Assignable<typeof ValueTypeConstraint.Encoded, ValueTypeConstraint.Encoded>,
      Assignable<ValueTypeConstraint.Encoded, typeof ValueTypeConstraint.Encoded>,
      Assignable<typeof ArrayConstraint.Encoded, ArrayConstraint.Encoded>,
      Assignable<ArrayConstraint.Encoded, typeof ArrayConstraint.Encoded>,
      Equals<
        typeof LengthConstraint.Encoded,
        { readonly type: "length"; readonly minimumLength?: number; readonly maximumLength?: number }
      >,
      Equals<
        typeof ValueRangeConstraint.Encoded,
        {
          readonly type: "range";
          readonly minimumValue?: string | number | boolean;
          readonly maximumValue?: string | number | boolean;
        }
      >,
      Equals<
        typeof EnumConstraint.Encoded,
        { readonly type: "enum"; readonly options: ReadonlyArray<string | number | boolean | null> }
      >,
      Equals<
        typeof RegexConstraint.Encoded,
        { readonly type: "regex"; readonly pattern: string; readonly partialMatch: boolean }
      >,
      Equals<ArrayConstraint["valueConstraint"], O.Option<ValueTypeConstraint>>,
      Equals<ValueTypeConstraint["type"], ValueTypeConstraintKind>,
    ] = [true, true, true, true, true, true, true, true, true, true];
    assertTrue(A.every(facts, identity));
  });

  const everyConstraint: ReadonlyArray<ValueTypeConstraint> = [
    ValueTypeConstraint.cases.struct.make({
      properties: R.singleton(PropertyApiName.make("street"), ValueTypeApiName.make("streetLine")),
    }),
    ValueTypeConstraint.cases.regex.make({ pattern: "^[A-Z]{3}$", partialMatch: false }),
    ValueTypeConstraint.cases.unsupported.make({ unsupportedType: "geoBounds" }),
    ValueTypeConstraint.cases.array.make({ maximumSize: O.some(3), valueConstraint: O.some(UuidConstraint.make({})) }),
    ValueTypeConstraint.cases.length.make({ minimumLength: O.some(1) }),
    ValueTypeConstraint.cases.range.make({ minimumValue: O.some(0) }),
    ValueTypeConstraint.cases.rid.make({}),
    ValueTypeConstraint.cases.uuid.make({}),
    ValueTypeConstraint.cases.enum.make({ options: [O.some("brown"), O.none()] }),
  ];

  it("has one case per constraint kind, in the kit's order", () => {
    deepStrictEqual(R.keys(ValueTypeConstraint.cases), A.fromIterable<string>(ValueTypeConstraintKind.literals));
    deepStrictEqual(ValueTypeConstraintKind.literals, [
      "struct",
      "regex",
      "unsupported",
      "array",
      "length",
      "range",
      "rid",
      "uuid",
      "enum",
    ]);
  });

  it("constructs every case through .cases and folds each with one exhaustive match", () => {
    const kindOf = ValueTypeConstraint.match({
      struct: ({ type }) => type,
      regex: ({ type }) => type,
      unsupported: ({ type }) => type,
      array: ({ type }) => type,
      length: ({ type }) => type,
      range: ({ type }) => type,
      rid: ({ type }) => type,
      uuid: ({ type }) => type,
      enum: ({ type }) => type,
    });
    deepStrictEqual(
      A.map(everyConstraint, kindOf),
      A.fromIterable<ValueTypeConstraintKind>(ValueTypeConstraintKind.literals)
    );
    assertTrue(A.every(everyConstraint, S.is(ValueTypeConstraint)));
    assertTrue(ValueTypeConstraint.guards.range(ValueRangeConstraint.atLeast(0)));
    assertTrue(!ValueTypeConstraint.guards.range(LengthConstraint.atLeast(0)));
    const isTextRule = ValueTypeConstraint.isAnyOf(["regex", "length", "rid", "uuid"]);
    deepStrictEqual(A.map(everyConstraint, isTextRule), [false, true, false, false, true, false, true, true, false]);
  });

  // Written from the wire declaration of `ValueTypeConstraint` (9 members) and its payload records.
  const everyConstraintWire: ReadonlyArray<ValueTypeConstraint.Encoded> = [
    { type: "struct", properties: { street: "streetLine", zip: "zipCode" } },
    { type: "struct", properties: {} },
    { type: "regex", pattern: "^[A-Z]{3}$", partialMatch: false },
    { type: "regex", pattern: "", partialMatch: true },
    { type: "unsupported", unsupportedType: "geoBounds", params: { precision: "7" } },
    {
      type: "array",
      minimumSize: 1,
      maximumSize: 5,
      uniqueValues: true,
      valueConstraint: { type: "length", maximumLength: 10 },
    },
    { type: "array", uniqueValues: false },
    {
      type: "array",
      uniqueValues: false,
      valueConstraint: { type: "array", uniqueValues: true, valueConstraint: { type: "enum", options: [1, 2, null] } },
    },
    { type: "length", minimumLength: 1, maximumLength: 64 },
    { type: "length", maximumLength: 0 },
    { type: "length" },
    { type: "range", minimumValue: 0, maximumValue: 100 },
    { type: "range", minimumValue: "2020-01-01" },
    { type: "range", maximumValue: "9223372036854775807" },
    { type: "rid" },
    { type: "uuid" },
    { type: "enum", options: [true, null] },
    { type: "enum", options: [] },
  ];

  it.effect(
    "decodes every wire constraint and encodes it back to the same JSON",
    Effect.fnUntraced(function* () {
      const decoded = yield* Effect.forEach(everyConstraintWire, (wire) => decodeConstraint(wire));
      const encoded = yield* Effect.forEach(decoded, (constraint) => encodeConstraint(constraint));
      deepStrictEqual(encoded, everyConstraintWire);
    })
  );

  it.effect(
    "decodes an array constraint into sizes, uniqueness and the rule for each element",
    Effect.fnUntraced(function* () {
      const wire: ValueTypeConstraint.Encoded = {
        type: "array",
        minimumSize: 1,
        maximumSize: 5,
        uniqueValues: true,
        valueConstraint: { type: "length", maximumLength: 10 },
      };
      const decoded = yield* decodeConstraint(wire);
      const expected = ArrayConstraint.make({
        minimumSize: O.some(1),
        maximumSize: O.some(5),
        uniqueValues: true,
        valueConstraint: O.some(LengthConstraint.atMost(10)),
      });
      assertTrue(constraintEquivalence(decoded, expected));
      deepStrictEqual(decoded, expected);
    })
  );

  it.effect(
    "decodes a null enum option to none and encodes it back to null",
    Effect.fnUntraced(function* () {
      const wire: typeof EnumConstraint.Encoded = { type: "enum", options: [true, null] };
      const decoded = yield* S.decodeEffect(EnumConstraint)(wire);
      deepStrictEqual(decoded.options, [O.some(true), O.none()]);
      const encoded = yield* S.encodeEffect(EnumConstraint)(decoded);
      deepStrictEqual(encoded, wire);
    })
  );

  it.effect(
    "decodes struct constraint keys and values to their brands",
    Effect.fnUntraced(function* () {
      const wire: typeof StructConstraint.Encoded = { type: "struct", properties: { street: "streetLine" } };
      const decoded = yield* S.decodeEffect(StructConstraint)(wire);
      assertSome(R.get(decoded.properties, PropertyApiName.make("street")), ValueTypeApiName.make("streetLine"));
      const verdicts = yield* Effect.all([
        rejects(StructConstraint)({ type: "struct", properties: { street: "" } }),
        rejects(StructConstraint)({ type: "struct" }),
      ]);
      assertTrue(A.every(verdicts, identity));
    })
  );

  it("builds length constraints from one bound, two bounds or an exact length", () => {
    deepStrictEqual(
      [
        LengthConstraint.atLeast(1),
        LengthConstraint.atMost(64),
        LengthConstraint.between(1, 64),
        LengthConstraint.exactly(2),
      ],
      [
        LengthConstraint.make({ minimumLength: O.some(1) }),
        LengthConstraint.make({ maximumLength: O.some(64) }),
        LengthConstraint.make({ minimumLength: O.some(1), maximumLength: O.some(64) }),
        LengthConstraint.make({ minimumLength: O.some(2), maximumLength: O.some(2) }),
      ]
    );
    assertNone(LengthConstraint.atLeast(1).maximumLength);
    assertNone(LengthConstraint.atMost(64).minimumLength);
    throws(() => LengthConstraint.atLeast(-1));
    throws(() => LengthConstraint.atMost(2.5));
    throws(() => LengthConstraint.between(0, Number.NaN));
  });

  it("builds range constraints from one bound or two", () => {
    deepStrictEqual(
      [
        ValueRangeConstraint.atLeast(0),
        ValueRangeConstraint.atMost("2029-12-31"),
        ValueRangeConstraint.between(0, 100),
      ],
      [
        ValueRangeConstraint.make({ minimumValue: O.some(0) }),
        ValueRangeConstraint.make({ maximumValue: O.some("2029-12-31") }),
        ValueRangeConstraint.make({ minimumValue: O.some(0), maximumValue: O.some(100) }),
      ]
    );
    assertNone(ValueRangeConstraint.atLeast(0).maximumValue);
    assertNone(ValueRangeConstraint.atMost(0).minimumValue);
  });

  it.effect(
    "holds a rich bound as the wire scalar its own codec writes, and decodes it back unchanged",
    Effect.fnUntraced(function* () {
      const least = yield* S.encodeEffect(LongValue)(BigInt("-9007199254740993"));
      const most = yield* S.encodeEffect(LongValue)(BigInt("9007199254740993"));
      const since = yield* S.encodeEffect(TimestampValue)(DateTime.makeUnsafe("2021-01-04T05:00:00Z"));
      const ceiling = yield* S.encodeEffect(DecimalValue)(BigDecimal.fromStringUnsafe("12.50"));
      const ranges = [
        ValueRangeConstraint.between(least, most),
        ValueRangeConstraint.atLeast(since),
        ValueRangeConstraint.atMost(ceiling),
      ];
      const wire = yield* Effect.forEach(ranges, (range) => S.encodeEffect(ValueRangeConstraint)(range));
      deepStrictEqual(wire, [
        { type: "range", minimumValue: "-9007199254740993", maximumValue: "9007199254740993" },
        { type: "range", minimumValue: "2021-01-04T05:00:00.000Z" },
        // A decimal bound is written as plain decimal text with the scale it was given.
        { type: "range", maximumValue: "12.50" },
      ]);
      const decoded = yield* Effect.forEach(wire, (range) => S.decodeEffect(ValueRangeConstraint)(range));
      deepStrictEqual(decoded, ranges);
      deepStrictEqual(decoded, [
        ValueRangeConstraint.between("-9007199254740993", "9007199254740993"),
        ValueRangeConstraint.atLeast("2021-01-04T05:00:00.000Z"),
        ValueRangeConstraint.atMost("12.50"),
      ]);
    })
  );

  it("refuses a rich value as a bound: the constraint holds the wire scalar", () => {
    // @ts-expect-error a 64-bit bound is the text it travels as, not a bigint
    throws(() => ValueRangeConstraint.atMost(BigInt("9007199254740993")));
    // @ts-expect-error an instant bound is the text it travels as, not a DateTime
    throws(() => ValueRangeConstraint.atLeast(DateTime.makeUnsafe("2021-01-04T05:00:00Z")));
    // @ts-expect-error a decimal bound is the text it travels as, not a BigDecimal
    throws(() => ValueRangeConstraint.between(0, BigDecimal.fromStringUnsafe("12.50")));
  });

  it("applies constructor defaults: no bounds, no uniqueness and no element rule", () => {
    const bare = ArrayConstraint.make({});
    assertNone(bare.minimumSize);
    assertNone(bare.maximumSize);
    assertNone(bare.valueConstraint);
    strictEqual(bare.uniqueValues, false);
    const length = LengthConstraint.make({});
    assertNone(length.minimumLength);
    assertNone(length.maximumLength);
  });

  it("refuses to construct a range with no bound", () => {
    assertNone(ValueRangeConstraint.makeOption({}));
    assertSome(ValueRangeConstraint.makeOption({ maximumValue: O.some(1) }), ValueRangeConstraint.atMost(1));
    throws(() => ValueRangeConstraint.make({}));
  });

  it.effect(
    "rejects a range with no bound, negative or fractional sizes and lengths, and non-scalar operands",
    Effect.fnUntraced(function* () {
      const verdicts = yield* Effect.all([
        rejects(ValueTypeConstraint)({ type: "range" }),
        rejects(ValueRangeConstraint)({ type: "range" }),
        rejects(ValueTypeConstraint)({ type: "range", minimumValue: { value: 1 } }),
        rejects(ValueTypeConstraint)({ type: "range", minimumValue: null }),
        rejects(ValueTypeConstraint)({ type: "range", maximumValue: [1] }),
        rejects(ValueTypeConstraint)({ type: "length", minimumLength: -1 }),
        rejects(ValueTypeConstraint)({ type: "length", maximumLength: 1.5 }),
        rejects(ValueTypeConstraint)({ type: "length", maximumLength: "8" }),
        rejects(ValueTypeConstraint)({ type: "array", uniqueValues: false, minimumSize: -1 }),
        rejects(ValueTypeConstraint)({ type: "array", uniqueValues: false, maximumSize: 0.5 }),
        rejects(ValueTypeConstraint)({ type: "enum", options: [{}] }),
        rejects(ValueTypeConstraint)({ type: "enum", options: [["a"]] }),
        rejects(ValueTypeConstraint)({ type: "enum" }),
      ]);
      assertTrue(A.every(verdicts, identity));
    })
  );

  it.effect(
    "rejects missing required keys, unknown kinds and malformed nested constraints",
    Effect.fnUntraced(function* () {
      const verdicts = yield* Effect.all([
        rejects(ValueTypeConstraint)({ type: "array" }),
        rejects(ValueTypeConstraint)({ type: "array", uniqueValues: "yes" }),
        rejects(ValueTypeConstraint)({ type: "array", uniqueValues: true, valueConstraint: { type: "range" } }),
        rejects(ValueTypeConstraint)({ type: "array", uniqueValues: true, valueConstraint: { type: "oneOf" } }),
        rejects(ValueTypeConstraint)({ type: "regex", pattern: "a" }),
        rejects(ValueTypeConstraint)({ type: "regex", partialMatch: true }),
        rejects(ValueTypeConstraint)({ type: "unsupported" }),
        rejects(ValueTypeConstraint)({ type: "oneOf", options: [] }),
        rejects(ValueTypeConstraint)({ type: "stringLength", lte: 3 }),
        rejects(ValueTypeConstraint)({}),
      ]);
      assertTrue(A.every(verdicts, identity));
    })
  );

  it.effect(
    "keeps an unmodelled constraint instead of failing",
    Effect.fnUntraced(function* () {
      const wire: ValueTypeConstraint.Encoded = {
        type: "unsupported",
        unsupportedType: "geoBounds",
        params: { precision: "7" },
      };
      const decoded = yield* decodeConstraint(wire);
      assertTrue(ValueTypeConstraint.guards.unsupported(decoded));
      const encoded = yield* encodeConstraint(decoded);
      deepStrictEqual(encoded, wire);
    })
  );
});

// ---------------------------------------------------------------------------
// The value type record
// ---------------------------------------------------------------------------

describe("OntologyValueType", () => {
  lawful("OntologyValueType", OntologyValueType);

  const decodeValueType = S.decodeEffect(OntologyValueType);
  const encodeValueType = S.encodeEffect(OntologyValueType);
  const valueTypeEquivalence = S.toEquivalence(OntologyValueType);

  // Copied verbatim from the `valueTypes` record of osdk-ts `packages/e2e.generated.catchall/ontology.json`.
  const colorValueTypeWire: typeof OntologyValueType.Encoded = {
    apiName: "colorValueType",
    description: "A value type for specific colors",
    displayName: "Color Value Type",
    rid: "ri.a.b.c.d",
    version: "1.0.0",
    fieldType: {
      type: "string",
    },
    constraints: [
      {
        type: "enum",
        options: ["brown", "found.com", 'it\'s "cool"'],
      },
      {
        type: "enum",
        options: ["brown", 'it\'s "cool"', "blue"],
      },
    ],
  };

  const booleanValueTypeWire: typeof OntologyValueType.Encoded = {
    apiName: "booleanValueType",
    description: "A value type for boolean values",
    displayName: "Boolean Value Type",
    rid: "ri.a.b.c.d",
    version: "1.0.0",
    fieldType: {
      type: "boolean",
    },
    constraints: [
      {
        type: "enum",
        options: [true, null],
      },
    ],
  };

  // Written from the wire declaration of `OntologyValueType`, using every key it has.
  const postalAddressWire: typeof OntologyValueType.Encoded = {
    apiName: "postalAddress",
    displayName: "Postal address",
    description: "A deliverable address",
    rid: "ri.ontology.main.value-type.postal-address",
    status: "DEPRECATED",
    fieldType: {
      type: "struct",
      fields: [
        { name: "street", fieldType: { type: "string" } },
        { name: "lines", fieldType: { type: "array", subType: { type: "string" } } },
        { name: "floor", fieldType: { type: "optional", wrappedType: { type: "integer" } } },
      ],
    },
    version: "2.1.0",
    constraints: [
      { type: "struct", properties: { street: "streetLine" } },
      { type: "unsupported", unsupportedType: "deliverability", params: {} },
    ],
  };

  it.effect(
    "decodes the color value type fixture to its domain value and encodes it back exactly",
    Effect.fnUntraced(function* () {
      const decoded = yield* decodeValueType(colorValueTypeWire);
      const expected = OntologyValueType.make({
        apiName: ValueTypeApiName.make("colorValueType"),
        displayName: "Color Value Type",
        description: O.some("A value type for specific colors"),
        rid: ValueTypeRid.make("ri.a.b.c.d"),
        fieldType: text,
        version: ValueTypeVersion.make("1.0.0"),
        constraints: [
          EnumConstraint.make({ options: [O.some("brown"), O.some("found.com"), O.some('it\'s "cool"')] }),
          EnumConstraint.make({ options: [O.some("brown"), O.some('it\'s "cool"'), O.some("blue")] }),
        ],
      });
      assertTrue(valueTypeEquivalence(decoded, expected));
      deepStrictEqual(decoded, expected);
      assertNone(decoded.status);
      const encoded = yield* encodeValueType(decoded);
      deepStrictEqual(encoded, colorValueTypeWire);
    })
  );

  it.effect(
    "decodes the boolean value type fixture, null option included, and encodes it back exactly",
    Effect.fnUntraced(function* () {
      const decoded = yield* decodeValueType(booleanValueTypeWire);
      strictEqual(decoded.apiName, ValueTypeApiName.make("booleanValueType"));
      strictEqual(decoded.fieldType.type, "boolean");
      assertSome(decoded.description, "A value type for boolean values");
      deepStrictEqual(decoded.constraints, [EnumConstraint.make({ options: [O.some(true), O.none()] })]);
      const encoded = yield* encodeValueType(decoded);
      deepStrictEqual(encoded, booleanValueTypeWire);
    })
  );

  it.effect(
    "decodes a value type that uses every key and encodes it back exactly",
    Effect.fnUntraced(function* () {
      const decoded = yield* decodeValueType(postalAddressWire);
      assertSome(decoded.status, "deprecated");
      strictEqual(decoded.version, ValueTypeVersion.make("2.1.0"));
      assertTrue(ValueTypeFieldType.guards.struct(decoded.fieldType));
      deepStrictEqual(
        A.map(decoded.constraints, (constraint) => constraint.type),
        ["struct", "unsupported"]
      );
      const encoded = yield* encodeValueType(decoded);
      deepStrictEqual(encoded, postalAddressWire);
    })
  );

  it("has the wire record as its encoded side and brands, options and domain literals as its domain side", () => {
    const facts: readonly [
      Equals<(typeof OntologyValueType.Encoded)["status"], "ACTIVE" | "DEPRECATED" | undefined>,
      Equals<(typeof OntologyValueType.Encoded)["fieldType"], ValueTypeFieldType.Encoded>,
      Equals<(typeof OntologyValueType.Encoded)["constraints"], ReadonlyArray<ValueTypeConstraint.Encoded>>,
      Equals<OntologyValueType["status"], O.Option<"active" | "deprecated">>,
      Equals<OntologyValueType["description"], O.Option<string>>,
      Equals<OntologyValueType["apiName"], ValueTypeApiName>,
      Equals<OntologyValueType["version"], ValueTypeVersion>,
    ] = [true, true, true, true, true, true, true];
    assertTrue(A.every(facts, identity));
  });

  it.effect(
    "defaults constraints to none in the constructor only: the wire key stays required",
    Effect.fnUntraced(function* () {
      const bare = OntologyValueType.make({
        apiName: ValueTypeApiName.make("plainText"),
        displayName: "Plain text",
        rid: ValueTypeRid.make("ri.ontology.main.value-type.plain-text"),
        fieldType: text,
        version: ValueTypeVersion.make("0.1.0"),
      });
      deepStrictEqual(bare.constraints, []);
      assertNone(bare.description);
      assertNone(bare.status);
      const wire = yield* encodeValueType(bare);
      deepStrictEqual(wire, {
        apiName: "plainText",
        displayName: "Plain text",
        rid: "ri.ontology.main.value-type.plain-text",
        fieldType: { type: "string" },
        version: "0.1.0",
        constraints: [],
      });
      const withoutConstraints = yield* rejects(OntologyValueType)({
        apiName: "plainText",
        displayName: "Plain text",
        rid: "ri.ontology.main.value-type.plain-text",
        fieldType: { type: "string" },
        version: "0.1.0",
      });
      assertTrue(withoutConstraints);
    })
  );

  it.effect(
    "rejects empty identifiers, an empty version, an unknown status and invalid parts",
    Effect.fnUntraced(function* () {
      const verdicts = yield* Effect.all([
        rejects(OntologyValueType)({ ...colorValueTypeWire, apiName: "" }),
        rejects(OntologyValueType)({ ...colorValueTypeWire, rid: "" }),
        rejects(OntologyValueType)({ ...colorValueTypeWire, version: "" }),
        rejects(OntologyValueType)({ ...colorValueTypeWire, status: "active" }),
        rejects(OntologyValueType)({ ...colorValueTypeWire, status: "ENDORSED" }),
        rejects(OntologyValueType)({ ...colorValueTypeWire, fieldType: { type: "geoshape" } }),
        rejects(OntologyValueType)({ ...colorValueTypeWire, constraints: [{ type: "range" }] }),
        rejects(OntologyValueType)({ ...colorValueTypeWire, description: null }),
      ]);
      assertTrue(A.every(verdicts, identity));
    })
  );
});

// ---------------------------------------------------------------------------
// Constraints as schema checks
// ---------------------------------------------------------------------------

describe("constraintCheck", () => {
  // Applies the projected check to each input, or reports that the constraint has no exact check.
  const verdicts = (
    constraint: ValueTypeConstraint,
    baseKind: ValueTypeKind,
    inputs: ReadonlyArray<unknown>
  ): O.Option<ReadonlyArray<boolean>> =>
    O.map(constraintCheck(constraint, baseKind), (rule) => A.map(inputs, S.is(S.Unknown.check(rule))));

  const expressibleOn = (constraint: ValueTypeConstraint): ReadonlyArray<ValueTypeKind> =>
    A.filter(ValueTypeKind.literals, (baseKind) => O.isSome(constraintCheck(constraint, baseKind)));

  const numberKinds: ReadonlyArray<ValueTypeKind> = ["byte", "short", "integer", "float", "double"];
  const jsonNativeKinds: ReadonlyArray<ValueTypeKind> = [
    "boolean",
    "byte",
    "short",
    "integer",
    "float",
    "double",
    "string",
  ];
  const noKinds: ReadonlyArray<ValueTypeKind> = [];

  it("regex: matches the whole text unless partialMatch, on text only", () => {
    const whole = RegexConstraint.make({ pattern: "[A-Z]{3}", partialMatch: false });
    const part = RegexConstraint.make({ pattern: "[A-Z]{3}", partialMatch: true });
    const alternation = RegexConstraint.make({ pattern: "a|b", partialMatch: false });
    assertSome(verdicts(whole, "string", ["ABC", "ABCD", "xABCx", "", 5]), [true, false, false, false, false]);
    assertSome(verdicts(part, "string", ["ABC", "ABCD", "xABCx", "ab", 5]), [true, true, true, false, false]);
    assertSome(verdicts(alternation, "string", ["a", "b", "ab", "xa"]), [true, true, false, false]);
    deepStrictEqual(expressibleOn(whole), ["string"]);
  });

  it("regex: yields none for a pattern the engine cannot compile", () => {
    assertNone(constraintCheck(RegexConstraint.make({ pattern: "(", partialMatch: true }), "string"));
    assertNone(constraintCheck(RegexConstraint.make({ pattern: "a++", partialMatch: false }), "string"));
  });

  it("length: bounds text length inclusively from one side or both, on text only", () => {
    assertSome(verdicts(LengthConstraint.atLeast(2), "string", ["", "a", "ab", "abc", 22]), [
      false,
      false,
      true,
      true,
      false,
    ]);
    assertSome(verdicts(LengthConstraint.atMost(2), "string", ["", "ab", "abc"]), [true, true, false]);
    assertSome(verdicts(LengthConstraint.between(2, 3), "string", ["a", "ab", "abc", "abcd"]), [
      false,
      true,
      true,
      false,
    ]);
    assertSome(verdicts(LengthConstraint.exactly(0), "string", ["", "a"]), [true, false]);
    deepStrictEqual(expressibleOn(LengthConstraint.atLeast(2)), ["string"]);
  });

  it("length: yields none when it states no bound, because it constrains nothing", () => {
    deepStrictEqual(expressibleOn(LengthConstraint.make({})), noKinds);
  });

  it("range: bounds numbers inclusively from one side or both, on the number kinds only", () => {
    assertSome(verdicts(ValueRangeConstraint.between(0, 100), "integer", [-1, 0, 50, 100, 101, "50"]), [
      false,
      true,
      true,
      true,
      false,
      false,
    ]);
    assertSome(verdicts(ValueRangeConstraint.atLeast(0.5), "double", [0.25, 0.5, 9]), [false, true, true]);
    assertSome(verdicts(ValueRangeConstraint.atMost(-1), "short", [-2, -1, 0]), [true, true, false]);
    deepStrictEqual(expressibleOn(ValueRangeConstraint.between(0, 100)), numberKinds);
  });

  it("range: yields none when a stated bound is not a number", () => {
    deepStrictEqual(expressibleOn(ValueRangeConstraint.atLeast("2020-01-01")), noKinds);
    deepStrictEqual(expressibleOn(ValueRangeConstraint.between(0, "100")), noKinds);
    deepStrictEqual(expressibleOn(ValueRangeConstraint.atMost("9007199254740993")), noKinds);
    assertNone(constraintCheck(ValueRangeConstraint.between(0, 100), "long"));
    assertNone(constraintCheck(ValueRangeConstraint.between(0, 100), "decimal"));
  });

  it("enum: allows exactly the listed options on kinds whose values are JSON-native", () => {
    const colors = EnumConstraint.make({ options: [O.some("brown"), O.some("blue"), O.none()] });
    const flags = EnumConstraint.make({ options: [O.some(true), O.none()] });
    const sizes = EnumConstraint.make({ options: [O.some(1), O.some(2)] });
    const nothing = EnumConstraint.make({ options: [] });
    assertSome(verdicts(colors, "string", ["brown", "blue", "red", "BROWN", null]), [true, true, false, false, false]);
    assertSome(verdicts(flags, "boolean", [true, false]), [true, false]);
    assertSome(verdicts(sizes, "integer", [1, 2, 3, "1"]), [true, true, false, false]);
    assertSome(verdicts(nothing, "string", ["", "brown"]), [false, false]);
    deepStrictEqual(expressibleOn(colors), jsonNativeKinds);
  });

  it("struct: has no check without the projection of its fields", () => {
    const rule = StructConstraint.make({
      properties: R.singleton(PropertyApiName.make("street"), ValueTypeApiName.make("streetLine")),
    });
    deepStrictEqual(expressibleOn(rule), noKinds);
  });

  it("array: has no check without the projection of its elements", () => {
    const rule = ArrayConstraint.make({ maximumSize: O.some(3), valueConstraint: O.some(LengthConstraint.atMost(8)) });
    deepStrictEqual(expressibleOn(rule), noKinds);
  });

  it("unsupported: has no check, by definition", () => {
    const rule = ValueTypeConstraint.cases.unsupported.make({ unsupportedType: "geoBounds" });
    deepStrictEqual(expressibleOn(rule), noKinds);
  });

  it("rid: has no check, because the wire does not state the grammar", () => {
    deepStrictEqual(expressibleOn(RidConstraint.make({})), noKinds);
  });

  it("uuid: has no check, because the wire does not state the grammar", () => {
    deepStrictEqual(expressibleOn(UuidConstraint.make({})), noKinds);
  });

  it.prop(
    "is total: every constraint against every base kind yields a check or none",
    [Arbitrary.schema(ValueTypeConstraint), Arbitrary.schema(ValueTypeKind)],
    ([constraint, baseKind]) => {
      const check = constraintCheck(constraint, baseKind);
      return O.isNone(check) || ValueTypeConstraint.isAnyOf(["regex", "length", "range", "enum"])(constraint);
    },
    { arbitrary: fcRuns(100) }
  );

  it("agrees in its data-first and data-last forms", () => {
    const rule = LengthConstraint.between(2, 3);
    const inputs = ["a", "ab", "abcd"];
    const dataLast = O.map(constraintCheck("string")(rule), (check) => A.map(inputs, S.is(S.Unknown.check(check))));
    deepStrictEqual(dataLast, verdicts(rule, "string", inputs));
    assertNone(constraintCheck("integer")(rule));
  });

  it("annotates each check with an identifier, a title, a description and a message", () => {
    const annotationsOf = (constraint: ValueTypeConstraint, baseKind: ValueTypeKind) =>
      O.map(constraintCheck(constraint, baseKind), (check) => [
        check.annotations?.identifier,
        check.annotations?.title,
        check.annotations?.description,
        check.annotations?.message,
      ]);
    assertSome(annotationsOf(RegexConstraint.make({ pattern: "^a", partialMatch: true }), "string"), [
      "@beep/scratchpad/osdk/ValueType/ValueType.behavior/RegexConstraintCheck",
      "Regex Constraint",
      "Text that contains a match for the pattern ^a.",
      "Expected text matching the pattern ^a",
    ]);
    assertSome(annotationsOf(LengthConstraint.between(2, 3), "string"), [
      "@beep/scratchpad/osdk/ValueType/ValueType.behavior/LengthConstraintCheck",
      "Length Constraint",
      "Text between 2 and 3 long, both inclusive.",
      "Expected text with a length between 2 and 3",
    ]);
    assertSome(annotationsOf(ValueRangeConstraint.atLeast(0), "integer"), [
      "@beep/scratchpad/osdk/ValueType/ValueType.behavior/ValueRangeConstraintCheck",
      "Value Range Constraint",
      "A number of 0 or more.",
      "Expected a number of 0 or more",
    ]);
    assertSome(annotationsOf(EnumConstraint.make({ options: [O.some("a"), O.none()] }), "string"), [
      "@beep/scratchpad/osdk/ValueType/ValueType.behavior/EnumConstraintCheck",
      "Enum Constraint",
      "One of 1 allowed values.",
      "Expected one of the 1 allowed values",
    ]);
  });

  const Code = S.String.check(
    O.getOrThrow(constraintCheck(RegexConstraint.make({ pattern: "[A-Z]{3}", partialMatch: false }), "string"))
  );
  const Nickname = S.String.check(O.getOrThrow(constraintCheck(LengthConstraint.between(2, 5), "string")));
  const Percentage = S.Finite.check(O.getOrThrow(constraintCheck(ValueRangeConstraint.between(0, 100), "double")));

  it.prop(
    "keeps the built-in check's generation hints, so refined codecs still derive arbitraries",
    [Arbitrary.schema(Code), Arbitrary.schema(Nickname), Arbitrary.schema(Percentage)],
    ([code, nickname, percentage]) =>
      /^[A-Z]{3}$/.test(code) &&
      nickname.length >= 2 &&
      nickname.length <= 5 &&
      percentage >= 0 &&
      percentage <= 100,
    { arbitrary: fcRuns(50) }
  );

  it.effect(
    "fails decoding with the check's own message",
    Effect.fnUntraced(function* () {
      const error = yield* Effect.flip(S.decodeEffect(Nickname)("a"));
      assertInclude(error.message, "Expected text with a length between 2 and 5");
      const AnyNickname = S.Unknown.check(O.getOrThrow(constraintCheck(LengthConstraint.atMost(5), "string")));
      const wrongType = yield* rejects(AnyNickname)(7);
      assertTrue(wrongType);
    })
  );
});
