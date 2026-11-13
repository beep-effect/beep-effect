import { fcRuns } from "@beep/test-utils";
import { describe, it } from "@effect/vitest";
import { assertFalse, assertNone, assertTrue, deepStrictEqual, strictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import { identity, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import {
  AbsoluteValue,
  Addition,
  DatePart,
  DatePartExtraction,
  DerivedProperty,
  Division,
  Greatest,
  Least,
  LinkedSelection,
  Multiplication,
  Negation,
  OwnProperty,
  SelectedApproximateDistinct,
  SelectedApproximatePercentile,
  SelectedAverage,
  SelectedCount,
  SelectedExactDistinct,
  SelectedList,
  SelectedMax,
  SelectedMin,
  SelectedPropertyOperation,
  SelectedSet,
  SelectedSum,
  SelectedValue,
  Subtraction,
} from "../src/DerivedProperty/index.ts";
import { Equals, eq, isNotNull, isNull, toSelector } from "../src/Filter/index.ts";
import {
  DerivedPropertyApiName,
  EntityTypeApiName,
  InterfaceLinkTypeApiName,
  InterfaceTypeApiName,
  LinkTypeApiName,
  ObjectRid,
  ObjectSetRid,
  ObjectTypeApiName,
  PropertyApiName,
} from "../src/Identifier/index.ts";
import {
  abs,
  aggregate,
  BaseObjectSet,
  BaseTypesObjectSet,
  baseType,
  CollectLimitExceeded,
  checkDerivedProperty,
  checkObjectSet,
  currentObject,
  DerivedObjectSet,
  DerivedPropertiesInOperand,
  DifferenceObjectSet,
  dividedBy,
  EntityType,
  extractPart,
  FilteredObjectSet,
  foldDerivedProperty,
  foldObjectSet,
  greatest,
  hasDerivedProperties,
  InterfaceBaseObjectSet,
  InterfaceEntityType,
  InterfaceLinkTraversal,
  IntersectionObjectSet,
  interfaceType,
  intersect,
  LinkTraversal,
  least,
  MethodInputObjectSet,
  minus,
  NarrowedObjectSet,
  NearestNeighborsObjectSet,
  NearestNeighborsQuery,
  NeighborCountOutOfRange,
  narrowTo,
  nearestNeighbors,
  negate,
  ObjectEntityType,
  ObjectSet,
  ObjectSetArgument,
  ObjectSetFinding,
  OrderBy,
  OrderByFields,
  OrderByRelevance,
  objectSetLimits,
  objects,
  objectType,
  PropertyOrdering,
  plus,
  SavedObjectSet,
  SortDirection,
  StaticObjectSet,
  saved,
  selectProperty,
  subtract,
  TextQuery,
  TooFewOperands,
  times,
  traverse,
  traverseInterfaceLink,
  UnionObjectSet,
  union,
  VectorQuery,
  where,
  withProperties,
} from "../src/ObjectSet/index.ts";
import { PropertyByName, TitleProperty } from "../src/Property/index.ts";

// ---------------------------------------------------------------------------
// Laws shared by every named schema
// ---------------------------------------------------------------------------

const generated = <T, E>(name: string, schema: S.Codec<T, E>, runs: number): void => {
  const is = S.is(schema);
  it.prop(`${name}: generated values satisfy the schema guard`, [Arbitrary.schema(schema)], ([value]) => is(value), {
    arbitrary: fcRuns(runs),
  });
};

// Every schema of these two modules, the ones that hold a filter included: encode then decode is the identity. A
// comparison operand is the wire scalar that carries it, so a filter round-trips exactly wherever it sits.
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

const rejects =
  <T, E>(schema: S.Codec<T, E>) =>
  (input: unknown): Effect.Effect<boolean> =>
    Effect.map(Effect.exit(S.decodeUnknownEffect(schema)(input)), Exit.isFailure);

const expectRejected = <T, E>(schema: S.Codec<T, E>) =>
  Effect.fnUntraced(function* (inputs: ReadonlyArray<unknown>) {
    const verdicts = yield* Effect.forEach(inputs, rejects(schema));
    deepStrictEqual(
      verdicts,
      A.map(inputs, () => true)
    );
  });

// Decodes a wire fixture, compares it with the expected domain value and encodes both back to the fixture.
const expectFixture = <T, E>(schema: S.Codec<T, E>) =>
  Effect.fnUntraced(function* (wire: E, domain: T) {
    const decoded = yield* S.decodeEffect(schema)(wire);
    assertTrue(S.toEquivalence(schema)(decoded, domain));
    const fromDecoded = yield* S.encodeEffect(schema)(decoded);
    const fromDomain = yield* S.encodeEffect(schema)(domain);
    deepStrictEqual(fromDecoded, wire);
    deepStrictEqual(fromDomain, wire);
  });

const sameSet = S.toEquivalence(ObjectSet);
const sameDefinition = S.toEquivalence(DerivedProperty);
const sameEntityType = S.toEquivalence(EntityType);
const setFixture = expectFixture(ObjectSet);
const definitionFixture = expectFixture(DerivedProperty);
const orderFixture = expectFixture(OrderBy);
const rejectsSets = expectRejected(ObjectSet);
const rejectsDefinitions = expectRejected(DerivedProperty);
const rejectsOrderings = expectRejected(OrderBy);
const encodeSet = S.encodeEffect(ObjectSet);
const decodeOrdering = S.decodeUnknownEffect(OrderBy);
const encodeOrdering = S.encodeEffect(OrderBy);

const allTrue = (verdicts: ReadonlyArray<boolean>): void =>
  deepStrictEqual(
    verdicts,
    A.map(verdicts, () => true)
  );

// ---------------------------------------------------------------------------
// Shared values
// ---------------------------------------------------------------------------

const storedRid = "ri.object-set.main.object-set.c32ccba5-1a55-4cfe-ad71-160c4c77a053";
const firstObject = "ri.phonograph2-objects.main.object.e9a5a0d0-4a1f-4a2b-8e3c-000000000001";
const secondObject = "ri.phonograph2-objects.main.object.e9a5a0d0-4a1f-4a2b-8e3c-000000000002";

const employees = objectType("Employee");
const isNullWire = { type: "isNull", field: "lead", value: true };
const people = interfaceType("Person");
const stored = saved(storedRid);
const own = (name: string): DerivedProperty => selectProperty(currentObject, name);
const leadOf = pipe(currentObject, traverse("lead"));
const reports = pipe(currentObject, traverse("peeps"));
const leadName = selectProperty(leadOf, "fullName");
const derivedEmployees = withProperties(employees, { leadName });

// ---------------------------------------------------------------------------
// Wire fixtures
// ---------------------------------------------------------------------------

// packages/shared.test/src/stubs/objectSets.ts: `employeeObjectSet`.
const employeeWire: ObjectSet.Encoded = {
  type: "filter",
  objectSet: { type: "base", objectType: "Employee" },
  where: { type: "eq", field: "employeeId", value: 50030 },
};

// The same stub pivoted twice, as `pivotTo("lead").pivotTo("peeps")` compiles it.
const chainWire: ObjectSet.Encoded = {
  type: "searchAround",
  objectSet: {
    type: "searchAround",
    objectSet: employeeWire,
    link: "lead",
  },
  link: "peeps",
};

// packages/client/src/util/extractRdpDefinition.test.ts (`objectSetWithRdps`) plus the definition asserted by
// "add produces correct wire format" in packages/client/src/derivedProperties/createWithPropertiesObjectSet.test.ts.
const sumWire: DerivedProperty.Encoded = {
  type: "add",
  properties: [
    {
      type: "selection",
      objectSet: { type: "searchAround", objectSet: { type: "methodInput" }, link: "lead" },
      operation: { type: "get", selectedPropertyApiName: "employeeId" },
    },
    { type: "property", apiName: "employeeId" },
  ],
};

const derivedWire: ObjectSet.Encoded = {
  type: "withProperties",
  objectSet: {
    type: "searchAround",
    objectSet: { type: "base", objectType: "BaseType" },
    link: "testLink1",
  },
  derivedProperties: {
    myRdp: {
      type: "selection",
      objectSet: { type: "searchAround", objectSet: { type: "methodInput" }, link: "testLink2" },
      operation: { type: "get", selectedPropertyApiName: "testProperty" },
    },
    derivedPropertyName: sumWire,
  },
};

const pooledWire: ObjectSet.Encoded = {
  type: "union",
  objectSets: [
    { type: "static", objects: [firstObject, secondObject] },
    { type: "reference", reference: storedRid },
  ],
};

// packages/shared.test/src/stubs/interfaceObjectSetRequest.ts: `baseObjectSetFullObject.objectSet`.
const fullObjectsWire: ObjectSet.Encoded = {
  type: "intersect",
  objectSets: [
    { type: "interfaceBase", interfaceType: "FooInterface" },
    { type: "interfaceBase", interfaceType: "FooInterface", includeAllBaseObjectProperties: true },
  ],
};

// The node `nearestNeighbors("coffee", 3, "vectorProperty")` compiles to.
const nearestWire: ObjectSet.Encoded = {
  type: "nearestNeighbors",
  objectSet: { type: "base", objectType: "Document" },
  propertyIdentifier: { type: "property", apiName: "vectorProperty" },
  numNeighbors: 3,
  query: { type: "text", value: "coffee" },
};

const everyOperationWire: DerivedProperty.Encoded = {
  type: "greatest",
  properties: [
    {
      type: "subtract",
      left: {
        type: "selection",
        objectSet: { type: "searchAround", objectSet: { type: "methodInput" }, link: "peeps" },
        operation: { type: "approximatePercentile", selectedPropertyApiName: "salary", approximatePercentile: 50 },
      },
      right: {
        type: "negate",
        property: { type: "absoluteValue", property: { type: "property", apiName: "salary" } },
      },
    },
    {
      type: "divide",
      left: {
        type: "multiply",
        properties: [
          { type: "property", apiName: "hours" },
          { type: "property", apiName: "hourlyRate" },
        ],
      },
      right: {
        type: "least",
        properties: [
          {
            type: "selection",
            objectSet: { type: "searchAround", objectSet: { type: "methodInput" }, link: "peeps" },
            operation: { type: "collectSet", selectedPropertyApiName: "office", limit: 100 },
          },
          { type: "extract", property: { type: "property", apiName: "startDate" }, part: "YEARS" },
        ],
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// Literal domains and leaf records
// ---------------------------------------------------------------------------

describe("literal domains", () => {
  lawful("DatePart", DatePart);
  lawful("SortDirection", SortDirection);

  it("pairs every wire date part with one domain literal, in wire order", () => {
    deepStrictEqual(DatePart.Pairs, [
      ["DAYS", "days"],
      ["MONTHS", "months"],
      ["QUARTERS", "quarters"],
      ["YEARS", "years"],
    ]);
    deepStrictEqual(SortDirection.literals, ["asc", "desc"]);
  });

  it.effect(
    "rejects a date part and a sort direction the wire does not define",
    Effect.fnUntraced(function* () {
      yield* expectRejected(DatePart)(["WEEKS", "years", "year", ""]);
      yield* expectRejected(SortDirection)(["ASC", "ascending", ""]);
      yield* expectRejected(EntityTypeApiName)(["", 7]);
    })
  );
});

describe("EntityType", () => {
  lawful("ObjectEntityType", ObjectEntityType);
  lawful("InterfaceEntityType", InterfaceEntityType);
  lawful("EntityType", EntityType);

  it("constructs every case and tells them apart", () => {
    const samples: ReadonlyArray<EntityType> = [
      EntityType.cases.object.make({ apiName: ObjectTypeApiName.make("Employee") }),
      EntityType.cases.interface.make({ apiName: InterfaceTypeApiName.make("Person") }),
    ];
    const tags: ReadonlyArray<string> = EntityType.discriminants;
    deepStrictEqual(
      A.map(
        samples,
        EntityType.match({ object: ({ type }): string => type, interface: ({ type }): string => type })
      ),
      tags
    );
    deepStrictEqual(A.map(samples, EntityType.guards.object), [true, false]);
    deepStrictEqual(A.map(samples, EntityType.guards.interface), [false, true]);
  });
});

describe("NearestNeighborsQuery", () => {
  lawful("VectorQuery", VectorQuery);
  lawful("TextQuery", TextQuery);
  lawful("NearestNeighborsQuery", NearestNeighborsQuery);

  it.effect(
    "decodes and re-encodes both wire shapes exactly",
    Effect.fnUntraced(function* () {
      const fixture = expectFixture(NearestNeighborsQuery);
      yield* fixture({ type: "vector", value: [0.25, -1, 3] }, VectorQuery.make({ value: [0.25, -1, 3] }));
      yield* fixture({ type: "text", value: "coffee" }, TextQuery.make({ value: "coffee" }));
    })
  );

  it("constructs every case and tells them apart", () => {
    const samples: ReadonlyArray<NearestNeighborsQuery> = [
      NearestNeighborsQuery.cases.vector.make({ value: [1, 2] }),
      NearestNeighborsQuery.cases.text.make({ value: "coffee" }),
    ];
    deepStrictEqual(
      A.map(
        samples,
        NearestNeighborsQuery.match({ vector: ({ value }) => A.length(value), text: ({ value }) => value.length })
      ),
      [2, 6]
    );
    deepStrictEqual(A.map(samples, NearestNeighborsQuery.guards.vector), [true, false]);
  });

  it.effect(
    "rejects a vector with a component that is not a finite number and an untagged query",
    Effect.fnUntraced(function* () {
      yield* expectRejected(NearestNeighborsQuery)([
        { type: "vector", value: [1, "2"] },
        { type: "vector", value: [Number.POSITIVE_INFINITY] },
        { type: "text", value: 7 },
        { value: "coffee" },
        "coffee",
      ]);
    })
  );
});

// ---------------------------------------------------------------------------
// Ordering
// ---------------------------------------------------------------------------

describe("OrderBy", () => {
  lawful("PropertyOrdering", PropertyOrdering);
  lawful("OrderByRelevance", OrderByRelevance);
  lawful("OrderByFields", OrderByFields);
  lawful("OrderBy", OrderBy);

  const byName = PropertyOrdering.make({ property: PropertyApiName.make("a"), direction: O.some("asc") });
  const byDate = PropertyOrdering.make({ property: PropertyApiName.make("b"), direction: O.some("desc") });

  it.effect(
    "decodes and re-encodes the two shapes OSDK sends exactly",
    Effect.fnUntraced(function* () {
      yield* orderFixture({ orderType: "relevance", fields: [] }, OrderByRelevance.make({}));
      yield* orderFixture(
        {
          fields: [
            { field: "a", direction: "asc" },
            { field: "b", direction: "desc" },
          ],
        },
        OrderByFields.make({ fields: [byName, byDate] })
      );
      yield* orderFixture(
        { fields: [{ field: "a" }] },
        OrderByFields.make({ fields: [PropertyOrdering.make({ property: PropertyApiName.make("a") })] })
      );
    })
  );

  it("defaults the direction of a sort key to none", () => {
    assertNone(PropertyOrdering.make({ property: PropertyApiName.make("a") }).direction);
  });

  it.effect(
    "lets listed fields win over a stated order type and drops a redundant one on the way out",
    Effect.fnUntraced(function* () {
      const overruled = yield* decodeOrdering({ orderType: "relevance", fields: [{ field: "a", direction: "asc" }] });
      const explicit = yield* decodeOrdering({ orderType: "fields", fields: [{ field: "a", direction: "asc" }] });
      const expected = OrderByFields.make({ fields: [byName] });
      const sameOrdering = S.toEquivalence(OrderBy);
      assertTrue(sameOrdering(overruled, expected));
      assertTrue(sameOrdering(explicit, expected));
      const wire = yield* encodeOrdering(explicit);
      deepStrictEqual(wire, { fields: [{ field: "a", direction: "asc" }] });
    })
  );

  it("constructs every case and matches exhaustively", () => {
    const samples: ReadonlyArray<OrderBy> = [
      OrderBy.cases.relevance.make({}),
      OrderBy.cases.fields.make({ fields: [byName, byDate] }),
    ];
    const tags: ReadonlyArray<string> = OrderBy.discriminants;
    deepStrictEqual(
      A.map(samples, (sample) => sample.type),
      tags
    );
    deepStrictEqual(
      A.map(samples, OrderBy.match({ relevance: () => 0, fields: ({ fields }) => A.length(fields) })),
      [0, 2]
    );
    deepStrictEqual(A.map(samples, OrderBy.guards.relevance), [true, false]);
  });

  it.effect(
    "rejects an ordering without fields, an unknown order type and an unknown direction",
    Effect.fnUntraced(function* () {
      yield* rejectsOrderings([
        {},
        { orderType: "relevance" },
        { orderType: "score", fields: [] },
        { fields: [{ field: "a", direction: "sideways" }] },
        { fields: [{ field: "" }] },
        { fields: [{ direction: "asc" }] },
      ]);
    })
  );
});

// ---------------------------------------------------------------------------
// Operations over linked objects
// ---------------------------------------------------------------------------

describe("SelectedPropertyOperation", () => {
  lawful("SelectedValue", SelectedValue);
  lawful("SelectedCount", SelectedCount);
  lawful("SelectedSum", SelectedSum);
  lawful("SelectedAverage", SelectedAverage);
  lawful("SelectedMin", SelectedMin);
  lawful("SelectedMax", SelectedMax);
  lawful("SelectedApproximateDistinct", SelectedApproximateDistinct);
  lawful("SelectedExactDistinct", SelectedExactDistinct);
  lawful("SelectedApproximatePercentile", SelectedApproximatePercentile);
  lawful("SelectedList", SelectedList);
  lawful("SelectedSet", SelectedSet);
  lawful("SelectedPropertyOperation", SelectedPropertyOperation);

  const samples: ReadonlyArray<SelectedPropertyOperation> = [
    SelectedPropertyOperation.cases.get.make({ property: PropertyApiName.make("salary") }),
    SelectedPropertyOperation.cases.count.make({}),
    SelectedPropertyOperation.cases.sum.make({ property: PropertyApiName.make("salary") }),
    SelectedPropertyOperation.cases.avg.make({ property: PropertyApiName.make("salary") }),
    SelectedPropertyOperation.cases.min.make({ property: PropertyApiName.make("salary") }),
    SelectedPropertyOperation.cases.max.make({ property: PropertyApiName.make("salary") }),
    SelectedPropertyOperation.cases.approximateDistinct.make({ property: PropertyApiName.make("salary") }),
    SelectedPropertyOperation.cases.exactDistinct.make({ property: PropertyApiName.make("salary") }),
    SelectedPropertyOperation.cases.approximatePercentile.make({
      property: PropertyApiName.make("salary"),
      percentile: 0.95,
    }),
    SelectedPropertyOperation.cases.collectList.make({ property: PropertyApiName.make("salary"), limit: 10 }),
    SelectedPropertyOperation.cases.collectSet.make({ property: PropertyApiName.make("salary"), limit: 20 }),
  ];

  it("constructs every case, matches exhaustively and gives each case exactly one guard", () => {
    const tags: ReadonlyArray<string> = SelectedPropertyOperation.discriminants;
    const tagOf = SelectedPropertyOperation.match({
      get: ({ type }): string => type,
      count: ({ type }): string => type,
      sum: ({ type }): string => type,
      avg: ({ type }): string => type,
      min: ({ type }): string => type,
      max: ({ type }): string => type,
      approximateDistinct: ({ type }): string => type,
      exactDistinct: ({ type }): string => type,
      approximatePercentile: ({ type }): string => type,
      collectList: ({ type }): string => type,
      collectSet: ({ type }): string => type,
    });
    deepStrictEqual(A.map(samples, tagOf), tags);
    strictEqual(A.length(tags), 11);
    deepStrictEqual(
      A.map(samples, (sample) =>
        A.length(A.filter(R.values(SelectedPropertyOperation.guards), (guard) => guard(sample)))
      ),
      A.map(samples, () => 1)
    );
  });

  it("builds through the member statics what the case constructors build", () => {
    const built: ReadonlyArray<SelectedPropertyOperation> = [
      SelectedValue.of("salary"),
      SelectedCount.make({}),
      SelectedSum.of("salary"),
      SelectedAverage.of("salary"),
      SelectedMin.of("salary"),
      SelectedMax.of("salary"),
      SelectedApproximateDistinct.of("salary"),
      SelectedExactDistinct.of("salary"),
      SelectedApproximatePercentile.of("salary", 0.95),
      SelectedList.of("salary", 10),
      SelectedSet.of("salary", 20),
    ];
    deepStrictEqual(built, samples);
  });

  it.effect(
    "encodes every case to its exact wire record and decodes it back",
    Effect.fnUntraced(function* () {
      const fixture = expectFixture(SelectedPropertyOperation);
      const wires: ReadonlyArray<typeof SelectedPropertyOperation.Encoded> = [
        { type: "get", selectedPropertyApiName: "salary" },
        { type: "count" },
        { type: "sum", selectedPropertyApiName: "salary" },
        { type: "avg", selectedPropertyApiName: "salary" },
        { type: "min", selectedPropertyApiName: "salary" },
        { type: "max", selectedPropertyApiName: "salary" },
        { type: "approximateDistinct", selectedPropertyApiName: "salary" },
        { type: "exactDistinct", selectedPropertyApiName: "salary" },
        { type: "approximatePercentile", selectedPropertyApiName: "salary", approximatePercentile: 0.95 },
        { type: "collectList", selectedPropertyApiName: "salary", limit: 10 },
        { type: "collectSet", selectedPropertyApiName: "salary", limit: 20 },
      ];
      yield* Effect.forEach(A.zip(wires, samples), ([wire, sample]) => fixture(wire, sample));
    })
  );

  it.effect(
    "rejects an operation without its property, a fractional limit and an unknown tag",
    Effect.fnUntraced(function* () {
      yield* expectRejected(SelectedPropertyOperation)([
        { type: "get" },
        { type: "sum", selectedPropertyApiName: "" },
        { type: "sum", property: "salary" },
        { type: "collectList", selectedPropertyApiName: "salary" },
        { type: "collectSet", selectedPropertyApiName: "salary", limit: 1.5 },
        { type: "approximatePercentile", selectedPropertyApiName: "salary" },
        { type: "median", selectedPropertyApiName: "salary" },
      ]);
    })
  );
});

// ---------------------------------------------------------------------------
// Derived properties
// ---------------------------------------------------------------------------

describe("DerivedProperty", () => {
  lawful("OwnProperty", OwnProperty);
  lawful("LinkedSelection", LinkedSelection);
  lawful("Addition", Addition);
  lawful("Subtraction", Subtraction);
  lawful("Multiplication", Multiplication);
  lawful("Division", Division);
  lawful("AbsoluteValue", AbsoluteValue);
  lawful("Negation", Negation);
  lawful("Least", Least);
  lawful("Greatest", Greatest);
  lawful("DatePartExtraction", DatePartExtraction);
  lawful("DerivedProperty", DerivedProperty);

  const salary = own("salary");
  const samples: ReadonlyArray<DerivedProperty> = [
    DerivedProperty.cases.property.make({ apiName: PropertyApiName.make("salary") }),
    DerivedProperty.cases.selection.make({ objectSet: leadOf, operation: SelectedValue.of("salary") }),
    DerivedProperty.cases.add.make({ operands: [salary, salary] }),
    DerivedProperty.cases.subtract.make({ left: salary, right: salary }),
    DerivedProperty.cases.multiply.make({ operands: [salary, salary] }),
    DerivedProperty.cases.divide.make({ left: salary, right: salary }),
    DerivedProperty.cases.absoluteValue.make({ operand: salary }),
    DerivedProperty.cases.negate.make({ operand: salary }),
    DerivedProperty.cases.least.make({ operands: [salary, salary] }),
    DerivedProperty.cases.greatest.make({ operands: [salary, salary] }),
    DerivedProperty.cases.extract.make({ operand: own("startDate"), part: "years" }),
  ];

  it("constructs every case, matches exhaustively and gives each case exactly one guard", () => {
    const tags: ReadonlyArray<string> = DerivedProperty.discriminants;
    const tagOf = DerivedProperty.match({
      property: ({ type }): string => type,
      selection: ({ type }): string => type,
      add: ({ type }): string => type,
      subtract: ({ type }): string => type,
      multiply: ({ type }): string => type,
      divide: ({ type }): string => type,
      absoluteValue: ({ type }): string => type,
      negate: ({ type }): string => type,
      least: ({ type }): string => type,
      greatest: ({ type }): string => type,
      extract: ({ type }): string => type,
    });
    deepStrictEqual(A.map(samples, tagOf), tags);
    strictEqual(A.length(tags), 11);
    deepStrictEqual(
      A.map(samples, (sample) => A.length(A.filter(R.values(DerivedProperty.guards), (guard) => guard(sample)))),
      A.map(samples, () => 1)
    );
  });

  it.effect(
    "decodes OSDK's add snapshot, rebuilds it with the builders and encodes both back exactly",
    Effect.fnUntraced(function* () {
      const built = pipe(currentObject, traverse("lead"), selectProperty("employeeId"), plus(own("employeeId")));
      yield* definitionFixture(sumWire, built);
      strictEqual(built.type, "add");
      deepStrictEqual(
        A.map(built.operands, (operand) => operand.type),
        ["selection", "property"]
      );
    })
  );

  it.effect(
    "round-trips one definition that uses every expression and renames every renamed key",
    Effect.fnUntraced(function* () {
      const median = aggregate(reports, SelectedApproximatePercentile.of("salary", 50));
      const offices = aggregate(reports, SelectedSet.of("office", 100));
      const built = greatest(
        minus(median, negate(abs(own("salary")))),
        dividedBy(times(own("hours"), own("hourlyRate")), least(offices, extractPart(own("startDate"), "years")))
      );
      yield* definitionFixture(everyOperationWire, built);
    })
  );

  it.effect(
    "rejects the domain's own key names on the wire, a missing operand and an unknown tag",
    Effect.fnUntraced(function* () {
      yield* rejectsDefinitions([
        { type: "add", operands: [] },
        { type: "add" },
        { type: "subtract", left: { type: "property", apiName: "a" } },
        { type: "negate", operand: { type: "property", apiName: "a" } },
        { type: "extract", property: { type: "property", apiName: "a" }, part: "years" },
        { type: "extract", property: { type: "property", apiName: "a" } },
        { type: "property", apiName: "" },
        { type: "selection", objectSet: { type: "methodInput" } },
        { type: "selection", objectSet: { type: "nowhere" }, operation: { type: "count" } },
        { type: "constant", value: 1 },
      ]);
    })
  );
});

// ---------------------------------------------------------------------------
// Object sets: schema laws
// ---------------------------------------------------------------------------

describe("ObjectSet", () => {
  lawful("BaseObjectSet", BaseObjectSet);
  lawful("InterfaceBaseObjectSet", InterfaceBaseObjectSet);
  lawful("StaticObjectSet", StaticObjectSet);
  lawful("SavedObjectSet", SavedObjectSet);
  lawful("MethodInputObjectSet", MethodInputObjectSet);
  lawful("FilteredObjectSet", FilteredObjectSet);
  lawful("LinkTraversal", LinkTraversal);
  lawful("InterfaceLinkTraversal", InterfaceLinkTraversal);
  lawful("NarrowedObjectSet", NarrowedObjectSet);
  lawful("BaseTypesObjectSet", BaseTypesObjectSet);
  lawful("NearestNeighborsObjectSet", NearestNeighborsObjectSet);
  lawful("DerivedObjectSet", DerivedObjectSet);
  lawful("UnionObjectSet", UnionObjectSet);
  lawful("IntersectionObjectSet", IntersectionObjectSet);
  lawful("DifferenceObjectSet", DifferenceObjectSet);
  lawful("ObjectSet", ObjectSet);

  const samples: ReadonlyArray<ObjectSet> = [
    ObjectSet.cases.base.make({ objectType: ObjectTypeApiName.make("Employee") }),
    ObjectSet.cases.interfaceBase.make({ interfaceType: InterfaceTypeApiName.make("Person") }),
    ObjectSet.cases.static.make({ objects: [ObjectRid.make(firstObject)] }),
    ObjectSet.cases.reference.make({ rid: ObjectSetRid.make(storedRid) }),
    ObjectSet.cases.methodInput.make({}),
    ObjectSet.cases.filter.make({ objectSet: employees, where: isNull("lead") }),
    ObjectSet.cases.searchAround.make({ objectSet: employees, link: LinkTypeApiName.make("lead") }),
    ObjectSet.cases.interfaceLinkSearchAround.make({
      objectSet: people,
      interfaceLink: InterfaceLinkTypeApiName.make("manager"),
    }),
    ObjectSet.cases.asType.make({ objectSet: people, entityType: EntityTypeApiName.make("Employee") }),
    ObjectSet.cases.asBaseObjectTypes.make({ objectSet: people }),
    ObjectSet.cases.nearestNeighbors.make({
      objectSet: employees,
      property: toSelector("embedding"),
      count: 5,
      query: TextQuery.make({ value: "coffee" }),
    }),
    ObjectSet.cases.withProperties.make({
      objectSet: employees,
      derivedProperties: R.fromEntries([[DerivedPropertyApiName.make("leadName"), leadName]]),
    }),
    ObjectSet.cases.union.make({ objectSets: [employees, stored] }),
    ObjectSet.cases.intersect.make({ objectSets: [employees, stored] }),
    ObjectSet.cases.subtract.make({ objectSets: [employees, stored] }),
  ];

  it("constructs every case, matches exhaustively and gives each case exactly one guard", () => {
    const tags: ReadonlyArray<string> = ObjectSet.discriminants;
    const tagOf = ObjectSet.match({
      base: ({ type }): string => type,
      interfaceBase: ({ type }): string => type,
      static: ({ type }): string => type,
      reference: ({ type }): string => type,
      methodInput: ({ type }): string => type,
      filter: ({ type }): string => type,
      searchAround: ({ type }): string => type,
      interfaceLinkSearchAround: ({ type }): string => type,
      asType: ({ type }): string => type,
      asBaseObjectTypes: ({ type }): string => type,
      nearestNeighbors: ({ type }): string => type,
      withProperties: ({ type }): string => type,
      union: ({ type }): string => type,
      intersect: ({ type }): string => type,
      subtract: ({ type }): string => type,
    });
    deepStrictEqual(A.map(samples, tagOf), tags);
    strictEqual(A.length(tags), 15);
    deepStrictEqual(
      A.map(samples, (sample) => A.length(A.filter(R.values(ObjectSet.guards), (guard) => guard(sample)))),
      A.map(samples, () => 1)
    );
    assertTrue(ObjectSet.isAnyOf(["union", "intersect", "subtract"])(union(employees, stored)));
    assertFalse(ObjectSet.isAnyOf(["union", "intersect", "subtract"])(employees));
  });

  it("applies constructor defaults to the optional fields", () => {
    assertNone(people.includeAllBaseObjectProperties);
    assertNone(nearestNeighbors(employees, "coffee", 5, "embedding").similarityThreshold);
  });

  // -------------------------------------------------------------------------
  // Exact wire fixtures
  // -------------------------------------------------------------------------

  it.effect(
    "fixture: a filtered base set decodes to the domain tree and encodes back exactly",
    Effect.fnUntraced(function* () {
      const domain = FilteredObjectSet.make({
        objectSet: BaseObjectSet.make({ objectType: ObjectTypeApiName.make("Employee") }),
        where: Equals.make({
          property: PropertyByName.make({ apiName: PropertyApiName.make("employeeId") }),
          value: 50030,
        }),
      });
      const built = pipe(objectType("Employee"), where(eq("employeeId", 50030)));
      yield* setFixture(employeeWire, domain);
      yield* setFixture(employeeWire, built);
      assertTrue(sameSet(built, domain));
    })
  );

  it.effect(
    "fixture: a search-around chain decodes to nested traversals and encodes back exactly",
    Effect.fnUntraced(function* () {
      const domain = LinkTraversal.make({
        objectSet: LinkTraversal.make({
          objectSet: pipe(objectType("Employee"), where(eq("employeeId", 50030))),
          link: LinkTypeApiName.make("lead"),
        }),
        link: LinkTypeApiName.make("peeps"),
      });
      const built = pipe(objectType("Employee"), where(eq("employeeId", 50030)), traverse("lead"), traverse("peeps"));
      yield* setFixture(chainWire, domain);
      yield* setFixture(chainWire, built);
      assertTrue(sameSet(built, domain));
    })
  );

  it.effect(
    "fixture: derived properties with a selection and a sum decode and encode back exactly",
    Effect.fnUntraced(function* () {
      const myRdp = LinkedSelection.make({
        objectSet: LinkTraversal.make({
          objectSet: MethodInputObjectSet.make({}),
          link: LinkTypeApiName.make("testLink2"),
        }),
        operation: SelectedValue.make({ property: PropertyApiName.make("testProperty") }),
      });
      const derivedPropertyName = Addition.make({
        operands: [
          LinkedSelection.make({
            objectSet: LinkTraversal.make({
              objectSet: MethodInputObjectSet.make({}),
              link: LinkTypeApiName.make("lead"),
            }),
            operation: SelectedValue.make({ property: PropertyApiName.make("employeeId") }),
          }),
          OwnProperty.make({ apiName: PropertyApiName.make("employeeId") }),
        ],
      });
      const domain = DerivedObjectSet.make({
        objectSet: LinkTraversal.make({
          objectSet: BaseObjectSet.make({ objectType: ObjectTypeApiName.make("BaseType") }),
          link: LinkTypeApiName.make("testLink1"),
        }),
        derivedProperties: R.fromEntries([
          [DerivedPropertyApiName.make("myRdp"), myRdp],
          [DerivedPropertyApiName.make("derivedPropertyName"), derivedPropertyName],
        ]),
      });
      const built = pipe(
        objectType("BaseType"),
        traverse("testLink1"),
        withProperties({
          myRdp: pipe(currentObject, traverse("testLink2"), selectProperty("testProperty")),
          derivedPropertyName: pipe(
            currentObject,
            traverse("lead"),
            selectProperty("employeeId"),
            plus(selectProperty(currentObject, "employeeId"))
          ),
        })
      );
      yield* setFixture(derivedWire, domain);
      yield* setFixture(derivedWire, built);
      assertTrue(sameSet(built, domain));
    })
  );

  it.effect(
    "fixture: a union of a static set and a stored set decodes and encodes back exactly",
    Effect.fnUntraced(function* () {
      const domain = UnionObjectSet.make({
        objectSets: [
          StaticObjectSet.make({ objects: [ObjectRid.make(firstObject), ObjectRid.make(secondObject)] }),
          SavedObjectSet.make({ rid: ObjectSetRid.make(storedRid) }),
        ],
      });
      const built = pipe(objects([firstObject, secondObject]), union(saved(storedRid)));
      yield* setFixture(pooledWire, domain);
      yield* setFixture(pooledWire, built);
      assertTrue(sameSet(built, domain));
    })
  );

  it.effect(
    "fixture: the interface full-object intersection keeps the optional flag only where the wire has it",
    Effect.fnUntraced(function* () {
      const foo = interfaceType("FooInterface");
      const full = InterfaceBaseObjectSet.make({
        interfaceType: InterfaceTypeApiName.make("FooInterface"),
        includeAllBaseObjectProperties: O.some(true),
      });
      yield* setFixture(fullObjectsWire, intersect(foo, full));
    })
  );

  it.effect(
    "fixture: a nearest-neighbour search renames its two keys and omits the absent threshold",
    Effect.fnUntraced(function* () {
      const built = pipe(objectType("Document"), nearestNeighbors("coffee", 3, "vectorProperty"));
      yield* setFixture(nearestWire, built);
      const vector = pipe(objectType("Document"), nearestNeighbors([0.5, 0.25], 3, TitleProperty.make({})));
      const wire = yield* encodeSet(vector);
      deepStrictEqual(wire, {
        type: "nearestNeighbors",
        objectSet: { type: "base", objectType: "Document" },
        propertyIdentifier: { type: "titleProperty" },
        numNeighbors: 3,
        query: { type: "vector", value: [0.5, 0.25] },
      });
      const thresholded = NearestNeighborsObjectSet.make({
        objectSet: objectType("Document"),
        property: toSelector("vectorProperty"),
        count: 3,
        similarityThreshold: O.some(0.8),
        query: TextQuery.make({ value: "coffee" }),
      });
      yield* setFixture({ ...nearestWire, similarityThreshold: 0.8 }, thresholded);
    })
  );

  it.effect(
    "fixture: casts and interface link traversals keep the wire's own keys",
    Effect.fnUntraced(function* () {
      const built = pipe(
        interfaceType("Person"),
        traverseInterfaceLink("manager"),
        narrowTo("Employee"),
        (set) => BaseTypesObjectSet.make({ objectSet: set }),
        subtract(saved(storedRid))
      );
      yield* setFixture(
        {
          type: "subtract",
          objectSets: [
            {
              type: "asBaseObjectTypes",
              objectSet: {
                type: "asType",
                objectSet: {
                  type: "interfaceLinkSearchAround",
                  objectSet: { type: "interfaceBase", interfaceType: "Person" },
                  interfaceLink: "manager",
                },
                entityType: "Employee",
              },
            },
            { type: "reference", reference: storedRid },
          ],
        },
        built
      );
    })
  );

  // -------------------------------------------------------------------------
  // Rejections
  // -------------------------------------------------------------------------

  it.effect(
    "rejects empty names, missing sources, the domain's own key names and unknown tags",
    Effect.fnUntraced(function* () {
      yield* rejectsSets([
        { type: "base", objectType: "" },
        { type: "base" },
        { type: "interfaceBase", interfaceType: "Person", includeAllBaseObjectProperties: "yes" },
        { type: "static", objects: [""] },
        { type: "static", objects: "ri.a" },
        { type: "reference", rid: storedRid },
        { type: "filter", objectSet: { type: "base", objectType: "Employee" } },
        { type: "filter", where: { type: "isNull", field: "lead", value: true } },
        { type: "filter", objectSet: { type: "base", objectType: "Employee" }, where: { type: "like", field: "a" } },
        { type: "searchAround", objectSet: { type: "base", objectType: "Employee" }, link: "" },
        { type: "asType", objectSet: { type: "base", objectType: "Employee" } },
        { type: "union", objectSets: [{ type: "base" }] },
        { type: "union", objectSets: { type: "base", objectType: "Employee" } },
        { type: "withProperties", objectSet: { type: "base", objectType: "Employee" } },
        {
          type: "withProperties",
          objectSet: { type: "base", objectType: "Employee" },
          derivedProperties: { leadName: { type: "property" } },
        },
        {
          type: "nearestNeighbors",
          objectSet: { type: "base", objectType: "Document" },
          propertyIdentifier: { type: "property", apiName: "vectorProperty" },
          numNeighbors: 2.5,
          query: { type: "text", value: "coffee" },
        },
        {
          type: "nearestNeighbors",
          objectSet: { type: "base", objectType: "Document" },
          property: { type: "property", apiName: "vectorProperty" },
          count: 3,
          query: { type: "text", value: "coffee" },
        },
        { type: "pivot", objectSet: { type: "base", objectType: "Employee" }, link: "lead" },
        "Employee",
      ]);
    })
  );
});

// ---------------------------------------------------------------------------
// Constructors and combinators
// ---------------------------------------------------------------------------

describe("combinators", () => {
  const seattle = eq("office", "Seattle");

  it("gives the same set whether the source comes first or flows through a pipeline", () => {
    allTrue([
      sameSet(where(employees, seattle), pipe(employees, where(seattle))),
      sameSet(union(employees, stored), pipe(employees, union(stored))),
      sameSet(intersect(employees, stored), pipe(employees, intersect(stored))),
      sameSet(subtract(employees, stored), pipe(employees, subtract(stored))),
      sameSet(traverse(employees, "lead"), pipe(employees, traverse("lead"))),
      sameSet(traverseInterfaceLink(people, "manager"), pipe(people, traverseInterfaceLink("manager"))),
      sameSet(narrowTo(people, "Employee"), pipe(people, narrowTo("Employee"))),
      sameSet(withProperties(employees, { leadName }), pipe(employees, withProperties({ leadName }))),
      sameSet(
        nearestNeighbors(employees, "coffee", 5, "embedding"),
        pipe(employees, nearestNeighbors("coffee", 5, "embedding"))
      ),
      sameDefinition(selectProperty(leadOf, "fullName"), pipe(leadOf, selectProperty("fullName"))),
      sameDefinition(aggregate(reports, SelectedCount.make({})), pipe(reports, aggregate(SelectedCount.make({})))),
      sameDefinition(plus(own("a"), own("b")), pipe(own("a"), plus(own("b")))),
      sameDefinition(minus(own("a"), own("b")), pipe(own("a"), minus(own("b")))),
      sameDefinition(times(own("a"), own("b")), pipe(own("a"), times(own("b")))),
      sameDefinition(dividedBy(own("a"), own("b")), pipe(own("a"), dividedBy(own("b")))),
      sameDefinition(least(own("a"), own("b")), pipe(own("a"), least(own("b")))),
      sameDefinition(greatest(own("a"), own("b")), pipe(own("a"), greatest(own("b")))),
      sameDefinition(extractPart(own("a"), "months"), pipe(own("a"), extractPart("months"))),
    ]);
  });

  it("flattens chained set arithmetic into one node and keeps the first operand first", () => {
    const filtered = where(employees, seattle);
    const tagsOf = (sets: ReadonlyArray<ObjectSet>): ReadonlyArray<string> => A.map(sets, (set) => set.type);
    deepStrictEqual(tagsOf(pipe(employees, union(stored), union(filtered)).objectSets), [
      "base",
      "reference",
      "filter",
    ]);
    deepStrictEqual(tagsOf(pipe(employees, intersect(stored), intersect([filtered, people])).objectSets), [
      "base",
      "reference",
      "filter",
      "interfaceBase",
    ]);
    deepStrictEqual(tagsOf(pipe(employees, subtract(stored), subtract(filtered)).objectSets), [
      "base",
      "reference",
      "filter",
    ]);
    // A different combination is an operand, not something to merge into.
    deepStrictEqual(tagsOf(pipe(employees, union(stored), intersect(filtered)).objectSets), ["union", "filter"]);
  });

  it("combines with no other set into a one-operand node, as OSDK's zero-argument call does", () => {
    deepStrictEqual(
      A.map(union(employees, []).objectSets, (set) => set.type),
      ["base"]
    );
    deepStrictEqual(
      A.map(subtract(employees, []).objectSets, (set) => set.type),
      ["base"]
    );
  });

  it("nests one filter node per call, as the wire expects", () => {
    const twice = pipe(employees, where(seattle), where(isNotNull("lead")));
    strictEqual(twice.type, "filter");
    strictEqual(twice.objectSet.type, "filter");
  });

  it("reads an own property on the current object and a selection anywhere else", () => {
    strictEqual(selectProperty(currentObject, "salary").type, "property");
    strictEqual(selectProperty(leadOf, "salary").type, "selection");
    strictEqual(selectProperty(where(currentObject, seattle), "salary").type, "selection");
    strictEqual(currentObject.type, "methodInput");
  });

  it("flattens chained sums, products, least and greatest but not differences and quotients", () => {
    strictEqual(A.length(pipe(own("a"), plus(own("b")), plus(own("c"))).operands), 3);
    strictEqual(A.length(pipe(own("a"), times(own("b")), times(own("c"))).operands), 3);
    strictEqual(A.length(pipe(own("a"), least(own("b")), least(own("c"))).operands), 3);
    strictEqual(A.length(pipe(own("a"), greatest(own("b")), greatest(own("c"))).operands), 3);
    strictEqual(A.length(pipe(own("a"), plus(own("b")), times(own("c"))).operands), 2);
    strictEqual(pipe(own("a"), minus(own("b")), minus(own("c"))).left.type, "subtract");
    strictEqual(pipe(own("a"), dividedBy(own("b")), dividedBy(own("c"))).left.type, "divide");
  });

  it("brands the names of derived properties and keeps every definition", () => {
    const set = withProperties(employees, { leadName, total: plus(own("salary"), own("bonus")) });
    deepStrictEqual(R.keys(set.derivedProperties), ["leadName", "total"]);
    allTrue(A.map(R.keys(set.derivedProperties), S.is(DerivedPropertyApiName)));
  });
});

// ---------------------------------------------------------------------------
// Folds
// ---------------------------------------------------------------------------

// The algebras that rebuild each node from its already rebuilt children: folding with them is the identity.
const rebuildDefinition: (definition: DerivedProperty) => DerivedProperty = foldDerivedProperty<DerivedProperty>({
  property: identity,
  selection: (definition) =>
    LinkedSelection.make({ objectSet: rebuildSet(definition.objectSet), operation: definition.operation }),
  add: (operands) => Addition.make({ operands }),
  subtract: (left, right) => Subtraction.make({ left, right }),
  multiply: (operands) => Multiplication.make({ operands }),
  divide: (left, right) => Division.make({ left, right }),
  absoluteValue: (operand) => AbsoluteValue.make({ operand }),
  negate: (operand) => Negation.make({ operand }),
  least: (operands) => Least.make({ operands }),
  greatest: (operands) => Greatest.make({ operands }),
  extract: (operand, definition) => DatePartExtraction.make({ operand, part: definition.part }),
});

const rebuildSet: (set: ObjectSet) => ObjectSet = foldObjectSet<ObjectSet>({
  base: identity,
  interfaceBase: identity,
  static: identity,
  reference: identity,
  methodInput: identity,
  filter: (source, set) => FilteredObjectSet.make({ objectSet: source, where: set.where }),
  searchAround: (source, set) => LinkTraversal.make({ objectSet: source, link: set.link }),
  interfaceLinkSearchAround: (source, set) =>
    InterfaceLinkTraversal.make({ objectSet: source, interfaceLink: set.interfaceLink }),
  asType: (source, set) => NarrowedObjectSet.make({ objectSet: source, entityType: set.entityType }),
  asBaseObjectTypes: (source) => BaseTypesObjectSet.make({ objectSet: source }),
  nearestNeighbors: (source, set) =>
    NearestNeighborsObjectSet.make({
      objectSet: source,
      property: set.property,
      count: set.count,
      similarityThreshold: set.similarityThreshold,
      query: set.query,
    }),
  withProperties: (source, set) =>
    DerivedObjectSet.make({ objectSet: source, derivedProperties: R.map(set.derivedProperties, rebuildDefinition) }),
  union: (objectSets) => UnionObjectSet.make({ objectSets }),
  intersect: (objectSets) => IntersectionObjectSet.make({ objectSets }),
  subtract: (objectSets) => DifferenceObjectSet.make({ objectSets }),
});

const sum = (counts: ReadonlyArray<number>): number => A.reduce(counts, 0, (total, count) => total + count);

const countingAlgebra = {
  base: (): number => 1,
  interfaceBase: (): number => 1,
  static: (): number => 1,
  reference: (): number => 1,
  methodInput: (): number => 1,
  filter: (source: number): number => source + 1,
  searchAround: (source: number): number => source + 1,
  interfaceLinkSearchAround: (source: number): number => source + 1,
  asType: (source: number): number => source + 1,
  asBaseObjectTypes: (source: number): number => source + 1,
  nearestNeighbors: (source: number): number => source + 1,
  withProperties: (source: number): number => source + 1,
  union: (operands: ReadonlyArray<number>): number => sum(operands) + 1,
  intersect: (operands: ReadonlyArray<number>): number => sum(operands) + 1,
  subtract: (operands: ReadonlyArray<number>): number => sum(operands) + 1,
};

const setNodes: (set: ObjectSet) => number = foldObjectSet(countingAlgebra);

describe("folds", () => {
  it.prop(
    "foldObjectSet with the rebuilding algebra is the identity",
    [Arbitrary.schema(ObjectSet)],
    ([set]) => sameSet(rebuildSet(set), set),
    { arbitrary: fcRuns(30) }
  );

  it.prop(
    "foldDerivedProperty with the rebuilding algebra is the identity",
    [Arbitrary.schema(DerivedProperty)],
    ([definition]) => sameDefinition(rebuildDefinition(definition), definition),
    { arbitrary: fcRuns(30) }
  );

  it("hands every handler its children already folded, in order", () => {
    const set = pipe(
      employees,
      where(eq("office", "Seattle")),
      traverse("lead"),
      union([stored, pipe(people, narrowTo("Employee"))])
    );
    strictEqual(setNodes(set), 7);
    strictEqual(foldObjectSet(set, { ...countingAlgebra, base: () => 10 }), 16);
    strictEqual(setNodes(derivedEmployees), 2);
  });

  it("folds a derived property bottom-up and treats a selection as a leaf", () => {
    const deepest = (depths: ReadonlyArray<number>): number =>
      A.reduce(depths, 0, (deepestSoFar, depth) => Math.max(deepestSoFar, depth));
    const depth = foldDerivedProperty<number>({
      property: () => 1,
      selection: () => 1,
      add: (operands) => 1 + deepest(operands),
      subtract: (left, right) => 1 + Math.max(left, right),
      multiply: (operands) => 1 + deepest(operands),
      divide: (left, right) => 1 + Math.max(left, right),
      absoluteValue: (operand) => 1 + operand,
      negate: (operand) => 1 + operand,
      least: (operands) => 1 + deepest(operands),
      greatest: (operands) => 1 + deepest(operands),
      extract: (operand) => 1 + operand,
    });
    strictEqual(depth(leadName), 1);
    strictEqual(depth(pipe(own("a"), minus(leadName), abs, negate, plus(own("b")))), 5);
    strictEqual(foldDerivedProperty(extractPart(own("startDate"), "years"), {
      property: ({ apiName }): string => apiName,
      selection: () => "linked",
      add: A.join("+"),
      subtract: (left, right) => `${left}-${right}`,
      multiply: A.join("*"),
      divide: (left, right) => `${left}/${right}`,
      absoluteValue: identity,
      negate: identity,
      least: A.join("<"),
      greatest: A.join(">"),
      extract: (operand, { part }) => `${part} of ${operand}`,
    }), "years of startDate");
  });
});

// ---------------------------------------------------------------------------
// baseType and hasDerivedProperties
// ---------------------------------------------------------------------------

describe("baseType", () => {
  const employeeType = ObjectEntityType.make({ apiName: ObjectTypeApiName.make("Employee") });
  const personType = InterfaceEntityType.make({ apiName: InterfaceTypeApiName.make("Person") });
  const offices = objectType("Office");

  const is = (expected: EntityType) => (set: ObjectSet): boolean =>
    O.match(baseType(set), { onNone: () => false, onSome: (actual) => sameEntityType(actual, expected) });

  const unknown = (set: ObjectSet): boolean => O.isNone(baseType(set));

  it("is the source's type through every node that keeps its objects", () => {
    allTrue([
      is(employeeType)(employees),
      is(personType)(people),
      is(employeeType)(where(employees, isNotNull("lead"))),
      is(employeeType)(nearestNeighbors(employees, "coffee", 5, "embedding")),
      is(employeeType)(derivedEmployees),
      is(personType)(BaseTypesObjectSet.make({ objectSet: people })),
    ]);
  });

  it("is unknown wherever only an ontology could tell", () => {
    allTrue([
      unknown(stored),
      unknown(objects([firstObject])),
      unknown(currentObject),
      unknown(traverse(employees, "lead")),
      unknown(traverseInterfaceLink(people, "manager")),
      unknown(narrowTo(people, "Employee")),
      unknown(where(traverse(employees, "lead"), isNotNull("lead"))),
    ]);
  });

  it("needs every operand of a union to agree", () => {
    allTrue([
      is(employeeType)(union(employees, where(employees, isNotNull("lead")))),
      unknown(union(employees, offices)),
      unknown(union(employees, stored)),
      unknown(union(employees, people)),
      unknown(UnionObjectSet.make({ objectSets: [] })),
    ]);
  });

  it("bounds an intersection by its first typed operand and a difference by its first operand", () => {
    allTrue([
      is(employeeType)(intersect(employees, stored)),
      is(employeeType)(intersect(stored, employees)),
      is(personType)(intersect(people, employees)),
      unknown(intersect(stored, objects([firstObject]))),
      is(employeeType)(subtract(employees, stored)),
      is(employeeType)(subtract(employees, offices)),
      unknown(subtract(stored, employees)),
      unknown(DifferenceObjectSet.make({ objectSets: [] })),
    ]);
  });
});

describe("hasDerivedProperties", () => {
  it("finds derived properties at any depth of the set tree", () => {
    assertFalse(hasDerivedProperties(employees));
    assertFalse(hasDerivedProperties(union(employees, stored)));
    assertTrue(hasDerivedProperties(derivedEmployees));
    assertTrue(hasDerivedProperties(pipe(derivedEmployees, where(isNotNull("leadName")), traverse("lead"))));
    assertTrue(hasDerivedProperties(union(employees, [stored, narrowTo(derivedEmployees, "Person")])));
  });
});

// ---------------------------------------------------------------------------
// Policy
// ---------------------------------------------------------------------------

describe("ObjectSetFinding", () => {
  lawful("DerivedPropertiesInOperand", DerivedPropertiesInOperand);
  lawful("NeighborCountOutOfRange", NeighborCountOutOfRange);
  lawful("CollectLimitExceeded", CollectLimitExceeded);
  lawful("TooFewOperands", TooFewOperands);
  lawful("ObjectSetFinding", ObjectSetFinding);

  it("constructs every case and matches exhaustively", () => {
    const samples: ReadonlyArray<ObjectSetFinding> = [
      ObjectSetFinding.cases.derivedPropertiesInOperand.make({ operator: "union", operand: 1 }),
      ObjectSetFinding.cases.neighborCountOutOfRange.make({ count: 0 }),
      ObjectSetFinding.cases.collectLimitExceeded.make({
        operation: "collectList",
        property: PropertyApiName.make("office"),
        limit: 101,
      }),
      ObjectSetFinding.cases.tooFewOperands.make({ operator: "add", operands: 1 }),
    ];
    const tags: ReadonlyArray<string> = ObjectSetFinding.discriminants;
    deepStrictEqual(
      A.map(
        samples,
        ObjectSetFinding.match({
          derivedPropertiesInOperand: ({ type }): string => type,
          neighborCountOutOfRange: ({ type }): string => type,
          collectLimitExceeded: ({ type }): string => type,
          tooFewOperands: ({ type }): string => type,
        })
      ),
      tags
    );
    deepStrictEqual(
      A.map(samples, (sample) => A.length(A.filter(R.values(ObjectSetFinding.guards), (guard) => guard(sample)))),
      A.map(samples, () => 1)
    );
  });
});

describe("checkObjectSet", () => {
  it("states the documented limits", () => {
    deepStrictEqual(objectSetLimits, { minNeighbors: 1, maxNeighbors: 500, maxCollected: 100, minOperands: 2 });
  });

  it("finds nothing wrong with the wire fixtures' sets", () => {
    deepStrictEqual(checkObjectSet(pipe(employees, where(eq("employeeId", 50030)), traverse("lead"))), []);
    deepStrictEqual(checkObjectSet(union(objects([firstObject]), stored)), []);
    deepStrictEqual(checkObjectSet(derivedEmployees), []);
    // Derived properties attached after combining are fine: the operands themselves carry none.
    deepStrictEqual(checkObjectSet(withProperties(union(employees, stored), { leadName })), []);
  });

  it("reports each operand of a union, intersection or difference that carries derived properties", () => {
    deepStrictEqual(checkObjectSet(union(employees, derivedEmployees)), [
      DerivedPropertiesInOperand.make({ operator: "union", operand: 1 }),
    ]);
    deepStrictEqual(checkObjectSet(intersect(derivedEmployees, stored)), [
      DerivedPropertiesInOperand.make({ operator: "intersect", operand: 0 }),
    ]);
    deepStrictEqual(
      checkObjectSet(
        subtract(where(derivedEmployees, isNotNull("leadName")), [stored, traverse(derivedEmployees, "lead")])
      ),
      [
        DerivedPropertiesInOperand.make({ operator: "subtract", operand: 0 }),
        DerivedPropertiesInOperand.make({ operator: "subtract", operand: 2 }),
      ]
    );
  });

  it("reports a neighbour count outside 1 to 500 and accepts both ends of the range", () => {
    const search = (count: number): ObjectSet => nearestNeighbors(objectType("Document"), "coffee", count, "embedding");
    deepStrictEqual(checkObjectSet(search(0)), [NeighborCountOutOfRange.make({ count: 0 })]);
    deepStrictEqual(checkObjectSet(search(501)), [NeighborCountOutOfRange.make({ count: 501 })]);
    deepStrictEqual(checkObjectSet(search(-3)), [NeighborCountOutOfRange.make({ count: -3 })]);
    deepStrictEqual(checkObjectSet(search(1)), []);
    deepStrictEqual(checkObjectSet(search(500)), []);
  });

  it("reports a collection limit above 100 and accepts 100", () => {
    const collected = (operation: SelectedPropertyOperation): ObjectSet =>
      withProperties(employees, { offices: aggregate(reports, operation) });
    deepStrictEqual(checkObjectSet(collected(SelectedList.of("office", 101))), [
      CollectLimitExceeded.make({ operation: "collectList", property: PropertyApiName.make("office"), limit: 101 }),
    ]);
    deepStrictEqual(checkObjectSet(collected(SelectedSet.of("office", 5000))), [
      CollectLimitExceeded.make({ operation: "collectSet", property: PropertyApiName.make("office"), limit: 5000 }),
    ]);
    deepStrictEqual(checkObjectSet(collected(SelectedList.of("office", 100))), []);
    deepStrictEqual(checkObjectSet(collected(SelectedSet.of("office", 100))), []);
    deepStrictEqual(checkObjectSet(collected(SelectedSum.of("salary"))), []);
  });

  it("reports a sum, product, least or greatest with fewer than two operands", () => {
    deepStrictEqual(checkDerivedProperty(Addition.make({ operands: [own("a")] })), [
      TooFewOperands.make({ operator: "add", operands: 1 }),
    ]);
    deepStrictEqual(checkDerivedProperty(Multiplication.make({ operands: [] })), [
      TooFewOperands.make({ operator: "multiply", operands: 0 }),
    ]);
    deepStrictEqual(checkDerivedProperty(Least.make({ operands: [own("a")] })), [
      TooFewOperands.make({ operator: "least", operands: 1 }),
    ]);
    deepStrictEqual(checkDerivedProperty(Greatest.make({ operands: [own("a")] })), [
      TooFewOperands.make({ operator: "greatest", operands: 1 }),
    ]);
    deepStrictEqual(checkDerivedProperty(plus(own("a"), own("b"))), []);
    deepStrictEqual(checkDerivedProperty(minus(abs(own("a")), negate(extractPart(own("b"), "days")))), []);
  });

  it("looks inside derived properties and the object sets their selections read through", () => {
    const nearby = pipe(currentObject, traverse("documents"), nearestNeighbors("coffee", 0, "embedding"));
    const nested = pipe(
      employees,
      withProperties({
        score: dividedBy(
          aggregate(nearby, SelectedList.of("title", 300)),
          Addition.make({ operands: [aggregate(union(reports, derivedEmployees), SelectedCount.make({}))] })
        ),
      }),
      where(isNotNull("score"))
    );
    deepStrictEqual(checkObjectSet(nested), [
      CollectLimitExceeded.make({ operation: "collectList", property: PropertyApiName.make("title"), limit: 300 }),
      NeighborCountOutOfRange.make({ count: 0 }),
      TooFewOperands.make({ operator: "add", operands: 1 }),
      DerivedPropertiesInOperand.make({ operator: "union", operand: 1 }),
    ]);
  });

  it("reports an outer set's finding before the findings of the sets it is built from", () => {
    const search = nearestNeighbors(objectType("Document"), "coffee", 0, "embedding");
    deepStrictEqual(checkObjectSet(union(search, derivedEmployees)), [
      DerivedPropertiesInOperand.make({ operator: "union", operand: 1 }),
      NeighborCountOutOfRange.make({ count: 0 }),
    ]);
  });
});

// ---------------------------------------------------------------------------
// Object-set arguments
// ---------------------------------------------------------------------------

describe("ObjectSetArgument", () => {
  lawful("ObjectSetArgument", ObjectSetArgument);

  it.effect(
    "reads text as the identifier of a stored set and a record as an inline definition, and writes each back",
    Effect.fnUntraced(function* () {
      const inlineWire = { type: "filter", objectSet: { type: "base", objectType: "Employee" }, where: isNullWire };
      const stored = yield* S.decodeEffect(ObjectSetArgument)(storedRid);
      const inline = yield* S.decodeUnknownEffect(ObjectSetArgument)(inlineWire);
      deepStrictEqual(stored, ObjectSetRid.make(storedRid));
      deepStrictEqual(inline, ObjectSet.cases.filter.make({ objectSet: employees, where: isNull("lead") }));
      const wire = yield* Effect.forEach([stored, inline], (value) => S.encodeEffect(ObjectSetArgument)(value));
      deepStrictEqual<unknown>(wire, [storedRid, inlineWire]);
    })
  );

  it("keeps the two spellings apart: an identifier is no definition and a definition is no identifier", () => {
    const stored = ObjectSetRid.make(storedRid);
    assertTrue(S.is(ObjectSetArgument)(stored) && S.is(ObjectSetArgument)(employees));
    assertFalse(S.is(ObjectSet)(stored));
    assertFalse(S.is(ObjectSetRid)(employees));
  });

  it.effect(
    "rejects the empty identifier and anything that is neither text nor an object-set definition",
    Effect.fnUntraced(function* () {
      const verdicts = yield* Effect.forEach(
        ["", 7, null, [storedRid], { type: "base" }, { type: "everything" }, { rid: storedRid }],
        rejects(ObjectSetArgument)
      );
      deepStrictEqual(verdicts, A.map(verdicts, () => true));
    })
  );
});
