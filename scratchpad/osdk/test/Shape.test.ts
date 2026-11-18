import { fcRuns } from "@beep/test-utils";
import { describe, it } from "@effect/vitest";
import {
  assertFailure,
  assertFalse,
  assertNone,
  assertSuccess,
  assertTrue,
  deepStrictEqual,
  strictEqual,
  throws,
} from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Tuple from "effect/Tuple";
import { eq } from "../src/Filter/index.ts";
import { LinkTypeApiName, PropertyApiName } from "../src/Identifier/index.ts";
import * as Model from "../src/Model/index.ts";
import {
  intersect,
  ObjectSet,
  OrderByFields,
  objectType,
  PropertyOrdering,
  subtract,
  traverse,
  union,
  where,
} from "../src/ObjectSet/index.ts";
import {
  applyShape,
  canonicalJson,
  DefaultPolicy,
  DefaultValue,
  DerivedLink,
  DerivedLinkName,
  DropIfNullPolicy,
  DroppedByShape,
  deriveLink,
  dropIfNull,
  LinkLimit,
  LinkSetOperation,
  LinkSetOperator,
  linkedShape,
  linkSet,
  NullPolicy,
  RequiredPropertyNull,
  RequirePolicy,
  require,
  SelectPolicy,
  ShapeDefinition,
  ShapeId,
  ShapeLinkSet,
  ShapeRejection,
  ShapeViolation,
  select,
  shape,
  shapeId,
  toObjectSet,
  TransformFailed,
  TransformMissing,
  TransformName,
  TransformPolicy,
  TraversalSegment,
  ViolatedShape,
  withDefault,
  withTransform,
} from "../src/Shape/index.ts";
import type { PropertyTransform, Shape } from "../src/Shape/index.ts";

// -----------------------------------------------------------------------------
// Laws shared by every named schema
// -----------------------------------------------------------------------------

const generated = <T, E>(name: string, schema: S.Codec<T, E>, runs: number): void => {
  const is = S.is(schema);
  it.prop(`${name}: generated values satisfy the schema guard`, [Arbitrary.schema(schema)], ([value]) => is(value), {
    arbitrary: fcRuns(runs),
  });
};

// For schemas that hold no filter: encode then decode is the identity.
const lawful = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  const equivalence = S.toEquivalence(schema);
  const encode = S.encodeEffect(schema);
  const decode = S.decodeEffect(schema);

  generated(name, schema, 50);

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

// For schemas that can hold a link filter. A rich comparison operand (64-bit integer, decimal, date, instant)
// decodes without an ontology as the text it is stored as, so the law is stability of the stored form.
const storedFormStable = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  const encode = S.encodeEffect(schema);
  const decode = S.decodeEffect(schema);

  generated(name, schema, 20);

  it.effect.prop(
    `${name}: decoding its own encoding encodes to the same stored value`,
    [Arbitrary.schema(schema)],
    Effect.fnUntraced(function* ([value]) {
      const stored = yield* encode(value);
      const decoded = yield* decode(stored);
      const again = yield* encode(decoded);
      deepStrictEqual(again, stored);
    }),
    { arbitrary: fcRuns(20) }
  );
};

const rejects =
  <T, E>(schema: S.Codec<T, E>) =>
  (input: unknown): boolean =>
    Result.isFailure(S.decodeUnknownResult(schema)(input));

const allTrue = (verdicts: ReadonlyArray<boolean>): void =>
  deepStrictEqual(
    verdicts,
    A.map(verdicts, () => true)
  );

const named = (property: string): PropertyApiName => PropertyApiName.make(property);

// -----------------------------------------------------------------------------
// Shared values
// -----------------------------------------------------------------------------

const upperCaseOrAnonymous: PropertyTransform = {
  name: "upperCaseOrAnonymous",
  apply: (value) =>
    pipe(
      value,
      O.filter(P.isString),
      O.map(Str.toUpperCase),
      O.getOrElse(() => "ANONYMOUS")
    ),
};

// Constructing an empty transform name throws, which is all a failing transform has to do.
const alwaysThrows: PropertyTransform = { name: "alwaysThrows", apply: () => TransformName.make("") };

const nameOnly = pipe(shape("Employee"), select(["fullName"]));

const reportsInSeattle = ShapeLinkSet.make({
  segments: [TraversalSegment.make({ link: LinkTypeApiName.make("reports") })],
  where: O.some(eq("office", "Seattle")),
  order: O.some(
    OrderByFields.make({
      fields: [PropertyOrdering.make({ property: named("fullName"), direction: O.some("asc") })],
    })
  ),
  limit: O.some(5),
  distinct: true,
  operations: [LinkSetOperation.make({ operator: "subtract", other: linkSet(["peers"]) })],
});

const card = pipe(
  shape("Employee"),
  require(["fullName"]),
  select(["nickname"]),
  dropIfNull(["employeeNumber"]),
  withDefault("office", "Remote"),
  withTransform("badge", upperCaseOrAnonymous),
  deriveLink("reports", reportsInSeattle, nameOnly)
);

// The stored form of `card.definition`, written out in full: encoding always writes the defaulted keys.
const storedCard: ShapeDefinition.Encoded = {
  objectType: "Employee",
  properties: {
    fullName: { type: "require" },
    nickname: { type: "select" },
    employeeNumber: { type: "dropIfNull" },
    office: { type: "withDefault", defaultValue: "Remote" },
    badge: { type: "withTransform", transform: "upperCaseOrAnonymous" },
  },
  links: {
    reports: {
      linkSet: {
        segments: [{ link: "reports" }],
        where: { type: "eq", field: "office", value: "Seattle" },
        order: { fields: [{ field: "fullName", direction: "asc" }] },
        limit: 5,
        distinct: true,
        operations: [
          { operator: "subtract", other: { segments: [{ link: "peers" }], distinct: false, operations: [] } },
        ],
      },
      shape: { objectType: "Employee", properties: { fullName: { type: "select" } }, links: {} },
    },
  },
};

const decodeDefinition = S.decodeEffect(ShapeDefinition);
const decodeUnknownDefinition = S.decodeUnknownEffect(ShapeDefinition);
const encodeDefinition = S.encodeEffect(ShapeDefinition);
const sameDefinition = S.toEquivalence(ShapeDefinition);

const presenceArbitrary = S.Boolean.pipe(S.Array, Arbitrary.schema);

const reversed = (definition: ShapeDefinition): ShapeDefinition =>
  ShapeDefinition.make({
    objectType: definition.objectType,
    properties: R.fromEntries(A.reverse(R.toEntries(definition.properties))),
    links: R.fromEntries(A.reverse(R.toEntries(definition.links))),
  });

// -----------------------------------------------------------------------------
// Laws
// -----------------------------------------------------------------------------

describe("Shape laws", () => {
  lawful("TransformName", TransformName);
  lawful("DerivedLinkName", DerivedLinkName);
  lawful("DefaultValue", DefaultValue);
  lawful("LinkLimit", LinkLimit);
  lawful("ShapeId", ShapeId);
  lawful("SelectPolicy", SelectPolicy);
  lawful("RequirePolicy", RequirePolicy);
  lawful("DropIfNullPolicy", DropIfNullPolicy);
  lawful("DefaultPolicy", DefaultPolicy);
  lawful("TransformPolicy", TransformPolicy);
  lawful("NullPolicy", NullPolicy);
  lawful("TraversalSegment", TraversalSegment);
  lawful("LinkSetOperator", LinkSetOperator);
  lawful("RequiredPropertyNull", RequiredPropertyNull);
  lawful("TransformMissing", TransformMissing);
  lawful("TransformFailed", TransformFailed);
  lawful("ShapeViolation", ShapeViolation);
  lawful("DroppedByShape", DroppedByShape);
  lawful("ViolatedShape", ViolatedShape);
  lawful("ShapeRejection", ShapeRejection);
  storedFormStable("LinkSetOperation", LinkSetOperation);
  storedFormStable("ShapeLinkSet", ShapeLinkSet);
  storedFormStable("DerivedLink", DerivedLink);
  storedFormStable("ShapeDefinition", ShapeDefinition);
});

// -----------------------------------------------------------------------------
// Stored form
// -----------------------------------------------------------------------------

describe("Shape stored form", () => {
  it.effect(
    "a shape definition decodes from its exact stored JSON and encodes back to it",
    Effect.fnUntraced(function* () {
      const decoded = yield* decodeDefinition(storedCard);
      const fromDecoded = yield* encodeDefinition(decoded);
      const fromBuilt = yield* encodeDefinition(card.definition);
      assertTrue(sameDefinition(decoded, card.definition));
      deepStrictEqual(fromDecoded, storedCard);
      deepStrictEqual(fromBuilt, storedCard);
    })
  );

  it.effect(
    "absent keys decode to their defaults",
    Effect.fnUntraced(function* () {
      const definition = yield* decodeDefinition({ objectType: "Employee", properties: {} });
      deepStrictEqual(R.keys(definition.links), A.empty<string>());

      const reached = yield* S.decodeEffect(ShapeLinkSet)({ segments: [{ link: "lead" }] });
      assertFalse(reached.distinct);
      deepStrictEqual(reached.operations, A.empty());
      assertNone(reached.where);
      assertNone(reached.order);
      assertNone(reached.limit);
    })
  );

  it("constructors default everything but the segments of a link set and the properties of a definition", () => {
    const reached = ShapeLinkSet.make({ segments: A.empty() });
    assertFalse(reached.distinct);
    deepStrictEqual(reached.operations, A.empty());
    assertNone(reached.where);
    assertNone(reached.order);
    assertNone(reached.limit);
    deepStrictEqual(
      R.keys(ShapeDefinition.make({ objectType: card.definition.objectType, properties: {} }).links),
      A.empty<string>()
    );
  });

  it.effect(
    "encoding always writes the defaulted keys, so the stored form has one spelling",
    Effect.fnUntraced(function* () {
      const storedLinkSet = yield* S.encodeEffect(ShapeLinkSet)(linkSet(["lead"]));
      const storedDefinition = yield* encodeDefinition(nameOnly.definition);
      deepStrictEqual(storedLinkSet, {
        segments: [{ link: "lead" }],
        distinct: false,
        operations: [],
      });
      deepStrictEqual(storedDefinition, {
        objectType: "Employee",
        properties: { fullName: { type: "select" } },
        links: {},
      });
    })
  );

  it.effect(
    "a property or link under an empty name is not kept",
    Effect.fnUntraced(function* () {
      const definition = yield* decodeUnknownDefinition({
        objectType: "Employee",
        properties: { "": { type: "select" }, fullName: { type: "select" } },
        links: { "": { linkSet: { segments: [] }, shape: { objectType: "Employee", properties: {} } } },
      });
      deepStrictEqual(R.keys(definition.properties), ["fullName"]);
      deepStrictEqual(R.keys(definition.links), A.empty<string>());
    })
  );
});

// -----------------------------------------------------------------------------
// Unions
// -----------------------------------------------------------------------------

describe("Shape unions", () => {
  it("NullPolicy: every case constructs, is guarded and is matched", () => {
    const policies: ReadonlyArray<NullPolicy> = [
      NullPolicy.cases.select.make({}),
      NullPolicy.cases.require.make({}),
      NullPolicy.cases.dropIfNull.make({}),
      NullPolicy.cases.withDefault.make({ defaultValue: 0 }),
      NullPolicy.cases.withTransform.make({ transform: TransformName.make("initials") }),
    ];
    const describePolicy = NullPolicy.match({
      select: () => "select",
      require: () => "require",
      dropIfNull: () => "dropIfNull",
      withDefault: ({ defaultValue }) => `withDefault:${defaultValue}`,
      withTransform: ({ transform }) => `withTransform:${transform}`,
    });
    deepStrictEqual(
      A.map(policies, (policy) => describePolicy(policy)),
      ["select", "require", "dropIfNull", "withDefault:0", "withTransform:initials"]
    );
    deepStrictEqual(
      A.map(policies, (policy) => policy.type),
      A.fromIterable(NullPolicy.discriminants)
    );
    allTrue([
      NullPolicy.guards.select(SelectPolicy.make({})),
      NullPolicy.guards.require(RequirePolicy.make({})),
      NullPolicy.guards.dropIfNull(DropIfNullPolicy.make({})),
      NullPolicy.guards.withDefault(DefaultPolicy.make({ defaultValue: "n/a" })),
      NullPolicy.guards.withTransform(TransformPolicy.make({ transform: TransformName.make("initials") })),
      NullPolicy.isAnyOf(["require", "dropIfNull", "withDefault"])(RequirePolicy.make({})),
      !NullPolicy.isAnyOf(["require", "dropIfNull", "withDefault"])(SelectPolicy.make({})),
      !NullPolicy.guards.select(RequirePolicy.make({})),
    ]);
  });

  it("ShapeViolation: every case constructs, is guarded and is matched", () => {
    const violations: ReadonlyArray<ShapeViolation> = [
      ShapeViolation.cases.requiredPropertyNull.make({ property: named("fullName") }),
      ShapeViolation.cases.transformMissing.make({ property: named("badge"), transform: TransformName.make("label") }),
      ShapeViolation.cases.transformFailed.make({
        property: named("badge"),
        transform: TransformName.make("label"),
        message: "no badge printer",
      }),
    ];
    const explain = ShapeViolation.match({
      requiredPropertyNull: ({ property }) => `${property} was null`,
      transformMissing: ({ property, transform }) => `${property} needs ${transform}`,
      transformFailed: ({ property, message }) => `${property}: ${message}`,
    });
    deepStrictEqual(
      A.map(violations, (violation) => explain(violation)),
      ["fullName was null", "badge needs label", "badge: no badge printer"]
    );
    deepStrictEqual(
      A.map(violations, (violation) => violation.type),
      A.fromIterable(ShapeViolation.discriminants)
    );
    allTrue([
      ShapeViolation.guards.requiredPropertyNull(RequiredPropertyNull.make({ property: named("fullName") })),
      ShapeViolation.guards.transformMissing(
        TransformMissing.make({ property: named("badge"), transform: TransformName.make("label") })
      ),
      ShapeViolation.guards.transformFailed(
        TransformFailed.make({ property: named("badge"), transform: TransformName.make("label"), message: "" })
      ),
      !ShapeViolation.guards.transformFailed(RequiredPropertyNull.make({ property: named("fullName") })),
    ]);
  });

  it("ShapeRejection: every case constructs, is guarded and is matched", () => {
    const rejections: ReadonlyArray<ShapeRejection> = [
      ShapeRejection.cases.dropped.make({ properties: [named("office")] }),
      ShapeRejection.cases.violated.make({ violations: [RequiredPropertyNull.make({ property: named("fullName") })] }),
    ];
    const count = ShapeRejection.match({
      dropped: ({ properties }) => A.length(properties),
      violated: ({ violations }) => A.length(violations) + 10,
    });
    deepStrictEqual(
      A.map(rejections, (rejection) => count(rejection)),
      [1, 11]
    );
    deepStrictEqual(
      A.map(rejections, (rejection) => rejection.type),
      A.fromIterable(ShapeRejection.discriminants)
    );
    allTrue([
      ShapeRejection.guards.dropped(DroppedByShape.make({ properties: [named("office")] })),
      ShapeRejection.guards.violated(
        ViolatedShape.make({ violations: [RequiredPropertyNull.make({ property: named("fullName") })] })
      ),
      !ShapeRejection.guards.violated(DroppedByShape.make({ properties: [named("office")] })),
    ]);
  });

  it("LinkSetOperator: the three operators, each matched", () => {
    deepStrictEqual(LinkSetOperator.literals, ["union", "intersect", "subtract"]);
    const symbol = LinkSetOperator.match({ union: () => "+", intersect: () => "&", subtract: () => "-" });
    deepStrictEqual(
      A.map(LinkSetOperator.literals, (operator) => symbol(operator)),
      ["+", "&", "-"]
    );
  });
});

// -----------------------------------------------------------------------------
// Invariants
// -----------------------------------------------------------------------------

describe("Shape invariants", () => {
  it("a name is never empty", () =>
    allTrue([
      rejects(TransformName)(""),
      rejects(DerivedLinkName)(""),
      rejects(TransformPolicy)({ type: "withTransform", transform: "" }),
      rejects(TraversalSegment)({ link: "" }),
      rejects(ShapeDefinition)({ objectType: "", properties: {} }),
      rejects(RequiredPropertyNull)({ type: "requiredPropertyNull", property: "" }),
    ]));

  it("a default value is never null and always JSON", () =>
    allTrue([
      rejects(DefaultValue)(null),
      rejects(DefaultValue)(undefined),
      rejects(DefaultValue)(Number.NaN),
      rejects(DefaultValue)(() => "computed"),
      rejects(DefaultPolicy)({ type: "withDefault", defaultValue: null }),
      rejects(DefaultPolicy)({ type: "withDefault" }),
      !rejects(DefaultPolicy)({ type: "withDefault", defaultValue: { nested: [null, 1, "a"] } }),
    ]));

  it("a link limit is a positive whole number", () =>
    allTrue([
      rejects(LinkLimit)(0),
      rejects(LinkLimit)(-3),
      rejects(LinkLimit)(2.5),
      rejects(LinkLimit)("5"),
      rejects(ShapeLinkSet)({ segments: [], limit: 0 }),
      !rejects(ShapeLinkSet)({ segments: [], limit: 1 }),
    ]));

  it("a link set combines only through the three operators, and only with a link set", () =>
    allTrue([
      rejects(LinkSetOperator)("difference"),
      rejects(LinkSetOperation)({ operator: "xor", other: { segments: [] } }),
      rejects(LinkSetOperation)({ operator: "union" }),
      rejects(LinkSetOperation)({ operator: "union", other: { segments: [{ link: "" }] } }),
      rejects(ShapeLinkSet)({ segments: [], operations: [{ operator: "union", other: { limit: 3 } }] }),
    ]));

  it("a policy is one of the five, and a definition needs its object type and its properties", () =>
    allTrue([
      rejects(NullPolicy)({ type: "optional" }),
      rejects(NullPolicy)({}),
      rejects(ShapeDefinition)({ objectType: "Employee" }),
      rejects(ShapeDefinition)({ properties: {} }),
      rejects(ShapeDefinition)({ objectType: "Employee", properties: { fullName: { type: "withDefault" } } }),
      rejects(ShapeDefinition)({
        objectType: "Employee",
        properties: {},
        links: { lead: { linkSet: { segments: [] }, shape: { objectType: "Employee" } } },
      }),
    ]));

  it("a rejection always says why", () =>
    allTrue([
      rejects(DroppedByShape)({ type: "dropped", properties: [] }),
      rejects(ViolatedShape)({ type: "violated", violations: [] }),
      rejects(ShapeRejection)({ type: "shaped" }),
      rejects(ShapeViolation)({ type: "dropIfNull", property: "office" }),
    ]));

  it("a shape id is 64 lower-case hex characters", () =>
    allTrue([
      rejects(ShapeId)("1a2b3c4d"),
      rejects(ShapeId)(Str.repeat(64)("G")),
      rejects(ShapeId)(Str.repeat(64)("A")),
      rejects(ShapeId)(Str.repeat(65)("a")),
      !rejects(ShapeId)(Str.repeat(64)("a")),
    ]));
});

// -----------------------------------------------------------------------------
// Building
// -----------------------------------------------------------------------------

describe("Shape builders", () => {
  it("every builder gives the same shape piped or called with the shape first", () => {
    const start = shape("Employee");
    allTrue([
      sameDefinition(select(start, ["a"]).definition, pipe(start, select(["a"])).definition),
      sameDefinition(require(start, ["a"]).definition, pipe(start, require(["a"])).definition),
      sameDefinition(dropIfNull(start, ["a"]).definition, pipe(start, dropIfNull(["a"])).definition),
      sameDefinition(withDefault(start, "a", 1).definition, pipe(start, withDefault("a", 1)).definition),
      sameDefinition(
        withTransform(start, "a", upperCaseOrAnonymous).definition,
        pipe(start, withTransform("a", upperCaseOrAnonymous)).definition
      ),
      sameDefinition(
        deriveLink(start, "lead", linkSet(["lead"]), nameOnly).definition,
        pipe(start, deriveLink("lead", linkSet(["lead"]), nameOnly)).definition
      ),
    ]);
  });

  it("a builder never changes the shape it was given", () => {
    const start = shape("Employee");
    const grown = pipe(start, require(["fullName"]), withTransform("badge", upperCaseOrAnonymous));
    deepStrictEqual(R.keys(start.definition.properties), A.empty<string>());
    deepStrictEqual(R.keys(start.transforms), A.empty<string>());
    deepStrictEqual(R.keys(grown.definition.properties), ["fullName", "badge"]);
  });

  it("a property has one policy: the last one given", () => {
    const rewritten = pipe(shape("Employee"), require(["office"]), withDefault("office", "Remote"), select(["office"]));
    deepStrictEqual(
      A.map(R.toEntries(rewritten.definition.properties), ([property, policy]) => `${property}:${policy.type}`),
      ["office:select"]
    );
  });

  it("a transform puts its name in the definition and its function beside it", () => {
    const transformed = pipe(shape("Employee"), withTransform("fullName", upperCaseOrAnonymous));
    deepStrictEqual(R.keys(transformed.definition.properties), ["fullName"]);
    deepStrictEqual(R.values(transformed.definition.properties), [
      TransformPolicy.make({ transform: TransformName.make("upperCaseOrAnonymous") }),
    ]);
    deepStrictEqual(R.keys(transformed.transforms), ["upperCaseOrAnonymous"]);
  });

  it("a derived link nests the target's definition and adopts its transforms", () => {
    const target = pipe(shape("Employee"), withTransform("fullName", upperCaseOrAnonymous));
    const source = pipe(shape("Employee"), deriveLink("lead", linkSet(["lead"]), target));
    deepStrictEqual(R.keys(source.transforms), ["upperCaseOrAnonymous"]);
    assertTrue(
      pipe(
        linkedShape(source, "lead"),
        O.exists((nested) => sameDefinition(nested.definition, target.definition))
      )
    );
    assertSuccess(
      pipe(
        linkedShape(source, "lead"),
        Result.fromOption(() => "no such link"),
        Result.flatMap((nested) => Result.mapError(applyShape(nested, { fullName: O.some("grace") }), (r) => r.type))
      ),
      { fullName: "GRACE" }
    );
  });

  it("linkedShape finds nothing under an unknown or an empty name, piped or not", () => {
    assertNone(linkedShape(card, "peers"));
    assertNone(linkedShape(card, ""));
    assertNone(pipe(card, linkedShape("lead")));
    assertTrue(pipe(card, linkedShape("reports"), O.isSome));
  });

  it("linkSet follows the named links in order", () => {
    deepStrictEqual(
      A.map(linkSet(["lead", "peers"]).segments, (segment) => segment.link),
      [LinkTypeApiName.make("lead"), LinkTypeApiName.make("peers")]
    );
  });

  it("an empty name is refused where it is given", () => {
    throws(() => shape(""));
    throws(() => select(shape("Employee"), [""]));
    throws(() => withTransform(shape("Employee"), "fullName", { name: "", apply: O.getOrNull }));
    throws(() => deriveLink(shape("Employee"), "", linkSet(["lead"]), nameOnly));
    throws(() => linkSet([""]));
  });
});

// -----------------------------------------------------------------------------
// Applying
// -----------------------------------------------------------------------------

// A property record for a definition: the property at each index is present where `presence` says so.
const recordOf = (definition: ShapeDefinition, presence: ReadonlyArray<boolean>) =>
  R.fromEntries(
    A.map(R.keys(definition.properties), (property, index) =>
      Tuple.make(property, O.exists(A.get(presence, index), (present) => present) ? O.some(index) : O.none())
    )
  );

const outcome = (result: Result.Result<Readonly<Record<string, unknown>>, ShapeRejection>) =>
  Result.match(result, {
    onSuccess: (record) => ({ kind: "shaped", names: A.sort(R.keys(record), Order.String) }),
    onFailure: ShapeRejection.match({
      dropped: ({ properties }) => ({ kind: "dropped", names: A.sort(properties, Order.String) }),
      violated: ({ violations }) => ({
        kind: "violated",
        names: A.sort(
          A.map(violations, (violation) => `${violation.type}:${violation.property}`),
          Order.String
        ),
      }),
    }),
  });

describe("applyShape", () => {
  it("keeps exactly the properties the shape names, each as its policy leaves it", () => {
    assertSuccess(
      applyShape(card, {
        fullName: O.some("Ada Lovelace"),
        nickname: O.none(),
        employeeNumber: O.some(7),
        office: O.none(),
        badge: O.some("ada"),
        salary: O.some(1_000_000),
      }),
      { fullName: "Ada Lovelace", nickname: O.none(), employeeNumber: 7, office: "Remote", badge: "ADA" }
    );
  });

  it("select keeps the option, present or not", () => {
    const selected = pipe(shape("Employee"), select(["nickname"]));
    assertSuccess(applyShape(selected, { nickname: O.some("Ada") }), { nickname: O.some("Ada") });
    assertSuccess(applyShape(selected, { nickname: O.none() }), { nickname: O.none() });
  });

  it("a default replaces a null and leaves a value alone", () => {
    const defaulted = pipe(shape("Employee"), withDefault("office", { city: "Lyon" }));
    assertSuccess(applyShape(defaulted, { office: O.none() }), { office: { city: "Lyon" } });
    assertSuccess(applyShape(defaulted, { office: O.some("Paris") }), { office: "Paris" });
  });

  it("a transform sees a null as none and decides what it becomes", () => {
    const transformed = pipe(shape("Employee"), withTransform("fullName", upperCaseOrAnonymous));
    assertSuccess(applyShape(transformed, { fullName: O.some("ada") }), { fullName: "ADA" });
    assertSuccess(applyShape(transformed, { fullName: O.none() }), { fullName: "ANONYMOUS" });
  });

  it("a property missing from the record counts as null", () => {
    assertSuccess(applyShape(pipe(shape("Employee"), select(["nickname"])), {}), { nickname: O.none() });
    assertSuccess(applyShape(pipe(shape("Employee"), withDefault("office", "Remote")), {}), { office: "Remote" });
    assertFailure(
      applyShape(pipe(shape("Employee"), require(["fullName"])), {}),
      ViolatedShape.make({ violations: [RequiredPropertyNull.make({ property: named("fullName") })] })
    );
    assertFailure(
      applyShape(pipe(shape("Employee"), dropIfNull(["office"])), {}),
      DroppedByShape.make({ properties: [named("office")] })
    );
  });

  it("a bare value is present, and a bare null or undefined is null", () => {
    const mixed = pipe(
      shape("Employee"),
      require(["employeeId"]),
      select(["nickname", "office"]),
      dropIfNull(["badge"])
    );
    assertSuccess(applyShape(mixed, { employeeId: 7, nickname: "Ada", office: null, badge: 0 }), {
      employeeId: 7,
      nickname: O.some("Ada"),
      office: O.none(),
      badge: 0,
    });
    assertFailure(
      applyShape(mixed, { employeeId: null, nickname: undefined, badge: false }),
      ViolatedShape.make({ violations: [RequiredPropertyNull.make({ property: named("employeeId") })] })
    );
    assertFailure(
      applyShape(mixed, { employeeId: 7, badge: undefined }),
      DroppedByShape.make({ properties: [named("badge")] })
    );
  });

  it.effect(
    "takes the properties of a typed model instance as they are, bare primary key included",
    Effect.fnUntraced(function* () {
      const Employee = Model.object({
        apiName: "Employee",
        primaryKey: "employeeId",
        properties: {
          employeeId: Model.required(Model.integer),
          fullName: Model.string,
          office: Model.string,
          nickname: Model.string,
        },
        links: { lead: Model.one("Employee") },
      });
      const employee = yield* S.decodeEffect(Employee.Instance)({
        __apiName: "Employee",
        __primaryKey: 50030,
        employeeId: 50030,
        fullName: "Ada Lovelace",
        office: null,
      });
      const summary = pipe(
        shape(Employee.apiName),
        require([Employee.property("employeeId").name, Employee.property("fullName").name]),
        select([Employee.property("nickname").name]),
        withDefault(Employee.property("office").name, "Remote")
      );
      assertSuccess(applyShape(summary, employee.properties), {
        employeeId: 50030,
        fullName: "Ada Lovelace",
        nickname: O.none(),
        office: "Remote",
      });
    })
  );

  it("a shape with no properties shapes every object to the empty record", () => {
    assertSuccess(applyShape(shape("Employee"), { fullName: O.some("Ada") }), {});
  });

  it("reports every violation at once, in the order the shape lists its properties", () => {
    const strict: Shape = {
      definition: pipe(
        shape("Employee"),
        require(["fullName"]),
        withTransform("badge", alwaysThrows),
        require(["office"]),
        withTransform("initials", { name: "initials", apply: O.getOrNull }),
        select(["nickname"])
      ).definition,
      transforms: { alwaysThrows: alwaysThrows.apply },
    };
    const result = applyShape(strict, { fullName: O.none(), office: O.none(), badge: O.some(7) });
    deepStrictEqual(outcome(result), {
      kind: "violated",
      names: [
        "requiredPropertyNull:fullName",
        "requiredPropertyNull:office",
        "transformFailed:badge",
        "transformMissing:initials",
      ],
    });
    deepStrictEqual(
      pipe(
        Result.getFailure(result),
        O.filter(ShapeRejection.guards.violated),
        O.map(({ violations }) => A.map(violations, (violation) => violation.type))
      ),
      O.some(["requiredPropertyNull", "transformFailed", "requiredPropertyNull", "transformMissing"])
    );
  });

  it("a transform that throws is reported with what it threw, never thrown onward", () => {
    const failing = pipe(shape("Employee"), withTransform("badge", alwaysThrows));
    const violations = pipe(
      Result.getFailure(applyShape(failing, { badge: O.some(1) })),
      O.filter(ShapeRejection.guards.violated),
      O.map(({ violations: found }) => A.filter(found, ShapeViolation.guards.transformFailed))
    );
    assertTrue(
      O.exists(
        violations,
        (found) =>
          A.length(found) === 1 &&
          A.every(
            found,
            (violation) =>
              violation.property === "badge" &&
              violation.transform === "alwaysThrows" &&
              Str.isNonEmpty(violation.message)
          )
      )
    );
  });

  it("a definition decoded without its functions reports each missing transform", () => {
    assertFailure(
      applyShape(
        { definition: card.definition, transforms: {} },
        { fullName: O.some("Ada"), employeeNumber: O.some(1) }
      ),
      ViolatedShape.make({
        violations: [
          TransformMissing.make({ property: named("badge"), transform: TransformName.make("upperCaseOrAnonymous") }),
        ],
      })
    );
  });

  it("drops with every drop-if-null property that was null", () => {
    const droppy = pipe(shape("Employee"), dropIfNull(["office", "employeeNumber", "fullName"]));
    assertFailure(
      applyShape(droppy, { office: O.none(), fullName: O.some("Ada") }),
      DroppedByShape.make({ properties: [named("office"), named("employeeNumber")] })
    );
  });

  it("dropping wins over violating, whichever is listed first", () => {
    const dropFirst = pipe(
      shape("Employee"),
      dropIfNull(["office"]),
      require(["fullName"]),
      withTransform("badge", alwaysThrows)
    );
    const dropLast = pipe(
      shape("Employee"),
      withTransform("badge", alwaysThrows),
      require(["fullName"]),
      dropIfNull(["office"])
    );
    const nothing = { office: O.none(), fullName: O.none(), badge: O.none() };
    const dropped = DroppedByShape.make({ properties: [named("office")] });
    assertFailure(applyShape(dropFirst, nothing), dropped);
    assertFailure(applyShape(dropLast, nothing), dropped);
  });

  it("gives the same answer with the record first in a pipeline", () => {
    const record = { fullName: O.some("Ada"), employeeNumber: O.some(1), badge: O.none() };
    deepStrictEqual(pipe(card, applyShape(record)), applyShape(card, record));
  });

  it.prop(
    "the outcome does not depend on the order a shape lists its properties in",
    [Arbitrary.schema(ShapeDefinition), presenceArbitrary],
    ([definition, presence]) => {
      const record = recordOf(definition, presence);
      deepStrictEqual(
        outcome(applyShape({ definition: reversed(definition), transforms: {} }, record)),
        outcome(applyShape({ definition, transforms: {} }, record))
      );
    },
    { arbitrary: fcRuns(50) }
  );

  it.prop(
    "a shaped record has exactly the shape's properties, and a rejection is never empty",
    [Arbitrary.schema(ShapeDefinition), presenceArbitrary],
    ([definition, presence]) => {
      const record = recordOf(definition, presence);
      const result = outcome(applyShape({ definition, transforms: {} }, record));
      return result.kind === "shaped"
        ? A.length(result.names) === R.size(definition.properties)
        : A.isReadonlyArrayNonEmpty(result.names);
    },
    { arbitrary: fcRuns(50) }
  );
});

// -----------------------------------------------------------------------------
// Link sets as object sets
// -----------------------------------------------------------------------------

describe("toObjectSet", () => {
  const sameSet = S.toEquivalence(ObjectSet);
  const ada = where(objectType("Employee"), eq("employeeId", 50030));
  const inLyon = eq("office", "Lyon");

  it("traverses the segments in order from the source", () => {
    assertTrue(sameSet(toObjectSet(linkSet(["lead", "peers"]), ada), pipe(ada, traverse("lead"), traverse("peers"))));
    assertTrue(sameSet(toObjectSet(linkSet(A.empty()), ada), ada));
  });

  it("combines with each operand, evaluated from the same source, then filters the combined result", () => {
    const reports = ShapeLinkSet.make({
      segments: linkSet(["reports"]).segments,
      where: O.some(inLyon),
      operations: [
        LinkSetOperation.make({ operator: "subtract", other: linkSet(["peers"]) }),
        LinkSetOperation.make({ operator: "union", other: linkSet(["lead"]) }),
        LinkSetOperation.make({ operator: "intersect", other: linkSet(["lead", "reports"]) }),
      ],
    });
    assertTrue(
      sameSet(
        toObjectSet(reports, ada),
        pipe(
          ada,
          traverse("reports"),
          subtract(traverse(ada, "peers")),
          union(traverse(ada, "lead")),
          intersect(pipe(ada, traverse("lead"), traverse("reports"))),
          where(inLyon)
        )
      )
    );
  });

  it("keeps an operand's own filter on the operand", () => {
    const filteredOperand = ShapeLinkSet.make({
      segments: linkSet(["reports"]).segments,
      operations: [
        LinkSetOperation.make({
          operator: "subtract",
          other: ShapeLinkSet.make({ segments: linkSet(["peers"]).segments, where: O.some(inLyon) }),
        }),
      ],
    });
    assertTrue(
      sameSet(
        toObjectSet(filteredOperand, ada),
        pipe(ada, traverse("reports"), subtract(pipe(ada, traverse("peers"), where(inLyon))))
      )
    );
  });

  it("leaves order, limit and distinct beside the object set, and reads the same piped", () => {
    assertTrue(sameSet(toObjectSet(reportsInSeattle, ada), pipe(reportsInSeattle, toObjectSet(ada))));
    assertTrue(
      sameSet(
        toObjectSet(reportsInSeattle, ada),
        pipe(ada, traverse("reports"), subtract(traverse(ada, "peers")), where(eq("office", "Seattle")))
      )
    );
  });
});

// -----------------------------------------------------------------------------
// Identity
// -----------------------------------------------------------------------------

const textOf = (built: Shape) => canonicalJson(built.definition);

const idOf = (built: Shape) => shapeId(built.definition);

const reordered = {
  one: pipe(
    shape("Employee"),
    require(["fullName"]),
    withDefault("address", { city: "Lyon", postcode: "69001" }),
    deriveLink("lead", linkSet(["lead"]), nameOnly),
    deriveLink("peers", linkSet(["peers"]), nameOnly)
  ),
  other: pipe(
    shape("Employee"),
    deriveLink("peers", linkSet(["peers"]), nameOnly),
    deriveLink("lead", linkSet(["lead"]), nameOnly),
    withDefault("address", { postcode: "69001", city: "Lyon" }),
    require(["fullName"])
  ),
};

describe("canonicalJson", () => {
  it.effect(
    "sorts every record's keys and writes nothing else",
    Effect.fnUntraced(function* () {
      const text = yield* textOf(pipe(shape("Employee"), select(["office"]), require(["fullName"])));
      strictEqual(
        text,
        '{"links":{},"objectType":"Employee","properties":{"fullName":{"type":"require"},"office":{"type":"select"}}}'
      );
    })
  );

  it.effect(
    "is the same text whatever order properties, links and default-value fields were written in",
    Effect.fnUntraced(function* () {
      const texts = yield* Effect.forEach([reordered.one, reordered.other], textOf);
      strictEqual(A.length(A.dedupe(texts)), 1);
    })
  );

  it.effect(
    "keeps the order of arrays, because a traversal read backwards is another traversal",
    Effect.fnUntraced(function* () {
      const texts = yield* Effect.forEach(
        [
          pipe(shape("Employee"), deriveLink("far", linkSet(["lead", "peers"]), nameOnly)),
          pipe(shape("Employee"), deriveLink("far", linkSet(["peers", "lead"]), nameOnly)),
        ],
        textOf
      );
      strictEqual(A.length(A.dedupe(texts)), 2);
    })
  );

  it.effect.prop(
    "is unchanged by reversing the order of properties and links",
    [Arbitrary.schema(ShapeDefinition)],
    Effect.fnUntraced(function* ([definition]) {
      const backwards = yield* canonicalJson(reversed(definition));
      const forwards = yield* canonicalJson(definition);
      strictEqual(backwards, forwards);
    }),
    { arbitrary: fcRuns(30) }
  );

  it.effect.prop(
    "is unchanged by storing a definition and reading it back",
    [Arbitrary.schema(ShapeDefinition)],
    Effect.fnUntraced(function* ([definition]) {
      const stored = yield* encodeDefinition(definition);
      const restored = yield* decodeDefinition(stored);
      const after = yield* canonicalJson(restored);
      const before = yield* canonicalJson(definition);
      strictEqual(after, before);
    }),
    { arbitrary: fcRuns(30) }
  );
});

describe("shapeId", () => {
  it.layer(Digest.layerWebCrypto)("with the Web Crypto digest", (it) => {
    it.effect(
      "is the SHA-256 of the canonical JSON, as a shape id",
      Effect.fnUntraced(function* () {
        const id = yield* idOf(pipe(shape("Employee"), require(["fullName"]), select(["office"])));
        // printf '%s' '<the canonical JSON asserted above>' | sha256sum
        strictEqual(id, "675090dcf73d984a3a38fda0856b2b16877c213f2f970e2b6c6da0eca0862564");
        assertTrue(S.is(ShapeId)(id));
      })
    );

    it.effect(
      "two shapes that differ only in a default value have different ids",
      Effect.fnUntraced(function* () {
        const remote = pipe(shape("Employee"), require(["fullName"]), withDefault("office", "Remote"));
        const lyon = pipe(shape("Employee"), require(["fullName"]), withDefault("office", "Lyon"));
        const zero = pipe(shape("Employee"), require(["fullName"]), withDefault("office", 0));
        const zeroText = pipe(shape("Employee"), require(["fullName"]), withDefault("office", "0"));
        const ids = yield* Effect.forEach([remote, lyon, zero, zeroText], idOf);
        const again = yield* Effect.forEach([remote, lyon, zero, zeroText], idOf);
        strictEqual(A.length(A.dedupe(ids)), 4);
        deepStrictEqual(again, ids);
      })
    );

    it.effect(
      "key order does not matter: properties, links and default-value fields",
      Effect.fnUntraced(function* () {
        const ids = yield* Effect.forEach([reordered.one, reordered.other], idOf);
        const cardIds = yield* Effect.forEach([reversed(card.definition), card.definition], shapeId);
        strictEqual(A.length(A.dedupe(ids)), 1);
        strictEqual(A.length(A.dedupe(cardIds)), 1);
      })
    );

    it.effect(
      "anything the definition holds changes the id: object type, policy, link set, nested shape",
      Effect.fnUntraced(function* () {
        const variants = [
          pipe(shape("Employee"), require(["fullName"]), deriveLink("lead", linkSet(["lead"]), nameOnly)),
          pipe(shape("Contractor"), require(["fullName"]), deriveLink("lead", linkSet(["lead"]), nameOnly)),
          pipe(shape("Employee"), select(["fullName"]), deriveLink("lead", linkSet(["lead"]), nameOnly)),
          pipe(shape("Employee"), require(["fullName"]), deriveLink("lead", linkSet(["lead", "lead"]), nameOnly)),
          pipe(shape("Employee"), require(["fullName"]), deriveLink("boss", linkSet(["lead"]), nameOnly)),
          pipe(
            shape("Employee"),
            require(["fullName"]),
            deriveLink("lead", linkSet(["lead"]), pipe(shape("Employee"), require(["fullName"])))
          ),
          pipe(
            shape("Employee"),
            require(["fullName"]),
            deriveLink("lead", ShapeLinkSet.make({ segments: linkSet(["lead"]).segments, distinct: true }), nameOnly)
          ),
          pipe(
            shape("Employee"),
            require(["fullName"]),
            deriveLink(
              "lead",
              ShapeLinkSet.make({ segments: linkSet(["lead"]).segments, where: O.some(eq("office", "Lyon")) }),
              nameOnly
            )
          ),
        ];
        const ids = yield* Effect.forEach(variants, idOf);
        strictEqual(A.length(A.dedupe(ids)), A.length(variants));
      })
    );

    it.effect(
      "a transform takes part through its name and never through its function",
      Effect.fnUntraced(function* () {
        const id = yield* idOf(pipe(shape("Employee"), withTransform("fullName", upperCaseOrAnonymous)));
        const sameNameOtherFunction = yield* idOf(
          pipe(shape("Employee"), withTransform("fullName", { name: upperCaseOrAnonymous.name, apply: O.getOrNull }))
        );
        const otherName = yield* idOf(
          pipe(shape("Employee"), withTransform("fullName", { name: "lowerCase", apply: upperCaseOrAnonymous.apply }))
        );
        const untransformed = yield* idOf(pipe(shape("Employee"), select(["fullName"])));
        strictEqual(sameNameOtherFunction, id);
        strictEqual(A.length(A.dedupe([id, otherName, untransformed])), 3);
      })
    );

    it.effect(
      "a stored definition keeps its id",
      Effect.fnUntraced(function* () {
        const restored = yield* decodeDefinition(storedCard);
        const ids = yield* Effect.forEach([restored, card.definition], shapeId);
        strictEqual(A.length(A.dedupe(ids)), 1);
      })
    );
  });
});
