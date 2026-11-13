import { fcRuns } from "@beep/test-utils";
import { describe, it } from "@effect/vitest";
import { assertFalse, assertTrue, deepStrictEqual, strictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Arbitrary from "effect/Arbitrary";
import * as Bool from "effect/Boolean";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import { identity } from "effect/Function";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import {
  ErrorName,
  FoundryBranch,
  LinkTypeApiName,
  ObjectTypeApiName,
  OntologyScenarioRid,
  PropertyApiName,
} from "../src/Identifier/index.ts";
import {
  BulkLink,
  KeyedObjectLocator,
  Link,
  LinkPage,
  LinkState,
  LinkStreamMessage,
  LinkSubscribeRequest,
  LinkSubscribeRequests,
  LinksFromSourceRows,
  LinkUpdate,
  LinkUpdates,
  LoadLinksRequest,
  RefreshLinks,
} from "../src/Link/index.ts";
import { Equals as EqualsFilter } from "../src/Filter/index.ts";
import { ObjectLocator, OntologyObject } from "../src/Object/index.ts";
import { BaseObjectSet, FilteredObjectSet } from "../src/ObjectSet/index.ts";
import { PageToken } from "../src/Page/index.ts";
import { PropertyByName } from "../src/Property/index.ts";
import {
  ClosedByFailure,
  ClosedForReason,
  ClosureReason,
  ObjectLoadingOptions,
  ObjectSetSubscribeRequest,
  ObjectSetSubscribeRequests,
  ObjectSetUpdate,
  ObjectSetUpdates,
  ObjectState,
  ObjectUpdate,
  PrimaryKeyRecord,
  ReferenceUpdate,
  ReferenceValue,
  RefreshObjectSet,
  RequestId,
  StreamFailure,
  StreamFailureArgument,
  StreamMessage,
  SubscribeFailure,
  SubscribeQosRejection,
  SubscribeResponse,
  SubscribeResponses,
  SubscribeSuccess,
  SubscriptionClosed,
  SubscriptionClosureCause,
  SubscriptionId,
  SubscriptionStatus,
} from "../src/Subscription/index.ts";
import type { ObjectSet } from "../src/ObjectSet/index.ts";

// ---------------------------------------------------------------------------
// Laws shared by the named schemas
// ---------------------------------------------------------------------------

const generates = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  const is = S.is(schema);

  it.prop(`${name}: generated values satisfy the schema guard`, [Arbitrary.schema(schema)], ([value]) => is(value), {
    arbitrary: fcRuns(50),
  });
};

const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  const equivalence = S.toEquivalence(schema);
  const encode = S.encodeEffect(schema);
  const decode = S.decodeEffect(schema);

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

// Every named schema keeps both laws, the ones that hold an object or an object locator included: a primary key is
// the wire scalar that carries it.
const lawful = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  generates(name, schema);
  roundTrips(name, schema);
};

// One exact wire record through a codec: it decodes to the expected domain value and encodes back to itself.
const decodesTo = Effect.fnUntraced(function* <T, E>(schema: S.Codec<T, E>, wire: NoInfer<E>, expected: NoInfer<T>) {
  const decoded = yield* S.decodeEffect(schema)(wire);
  assertTrue(S.toEquivalence(schema)(decoded, expected));
  const encoded = yield* S.encodeEffect(schema)(decoded);
  deepStrictEqual(encoded, wire);
});

const rejects =
  <T, E>(schema: S.Codec<T, E>) =>
  (input: unknown): Effect.Effect<boolean> =>
    Effect.map(Effect.exit(S.decodeUnknownEffect(schema)(input)), Exit.isFailure);

// The names of the counter-examples a schema wrongly accepted.
const accepted = (verdicts: Readonly<Record<string, boolean>>): ReadonlyArray<string> =>
  R.keys(R.filter(verdicts, Bool.not));

type Equals<Left, Right> = (<T>() => T extends Left ? 1 : 2) extends <T>() => T extends Right ? 1 : 2 ? true : false;

// ---------------------------------------------------------------------------
// Shared values
// ---------------------------------------------------------------------------

const requestIdText = "00000000-0000-0000-0000-000000000001";
const requestId = RequestId.make(requestIdText);
const subscriptionId = SubscriptionId.make("sub-1");
const employeeType = ObjectTypeApiName.make("Employee");
const officeType = ObjectTypeApiName.make("Office");
const employeeId = PropertyApiName.make("employeeId");
const lead = LinkTypeApiName.make("lead");
const peeps = LinkTypeApiName.make("peeps");
const officeLink = LinkTypeApiName.make("officeLink");
const instant = DateTime.makeUnsafe("2021-01-04T05:00:00.000Z");

// The same two object sets, as the wire spells them and as the domain holds them.
const allEmployees: ObjectSet.Encoded = { type: "base", objectType: "Employee" };
const officesInNewYork: ObjectSet.Encoded = {
  type: "filter",
  objectSet: { type: "base", objectType: "Office" },
  where: { type: "eq", field: "name", value: "New York City" },
};
const everyEmployee: ObjectSet = BaseObjectSet.make({ objectType: employeeType });
const newYorkOffices: ObjectSet = FilteredObjectSet.make({
  objectSet: BaseObjectSet.make({ objectType: officeType }),
  where: EqualsFilter.make({
    property: PropertyByName.make({ apiName: PropertyApiName.make("name") }),
    value: "New York City",
  }),
});

const employee = (primaryKey: number): ObjectLocator => ObjectLocator.make({ objectType: employeeType, primaryKey });
const office = (primaryKey: string): ObjectLocator => ObjectLocator.make({ objectType: officeType, primaryKey });

const keyedEmployee = (primaryKey: number): KeyedObjectLocator =>
  KeyedObjectLocator.make({ objectType: employeeType, primaryKey: R.singleton(employeeId, primaryKey) });

const userClosure: SubscriptionClosureCause = ClosedForReason.make({ reason: "userClosed" });

const objectTypeNotFound = StreamFailure.make({
  error: ErrorName.make("ObjectTypeNotFound"),
  args: [StreamFailureArgument.make({ name: "objectType", value: "Employe" })],
});

// ---------------------------------------------------------------------------
// Laws
// ---------------------------------------------------------------------------

describe("Subscription: laws of every named schema", () => {
  lawful("RequestId", RequestId);
  lawful("SubscriptionId", SubscriptionId);
  lawful("PrimaryKeyRecord", PrimaryKeyRecord);
  lawful("ObjectLoadingOptions", ObjectLoadingOptions);
  // A subscribe request holds an object set, whose filters hold scalar comparands. A comparand is the wire scalar
  // that carries it, so the request keeps the strict law, as the object set itself does.
  lawful("ObjectSetSubscribeRequest", ObjectSetSubscribeRequest);
  lawful("ObjectSetSubscribeRequests", ObjectSetSubscribeRequests);
  lawful("StreamFailureArgument", StreamFailureArgument);
  lawful("StreamFailure", StreamFailure);
  lawful("SubscribeSuccess", SubscribeSuccess);
  lawful("SubscribeFailure", SubscribeFailure);
  lawful("SubscribeQosRejection", SubscribeQosRejection);
  lawful("SubscribeResponse", SubscribeResponse);
  lawful("ObjectState", ObjectState);
  lawful("ReferenceValue", ReferenceValue);
  lawful("ReferenceUpdate", ReferenceUpdate);
  lawful("ClosureReason", ClosureReason);
  lawful("ClosedForReason", ClosedForReason);
  lawful("ClosedByFailure", ClosedByFailure);
  lawful("SubscriptionClosureCause", SubscriptionClosureCause);
  lawful("SubscribeResponses", SubscribeResponses);
  lawful("RefreshObjectSet", RefreshObjectSet);
  lawful("SubscriptionClosed", SubscriptionClosed);
  lawful("SubscriptionStatus", SubscriptionStatus);

  lawful("ObjectUpdate", ObjectUpdate);
  lawful("ObjectSetUpdate", ObjectSetUpdate);
  lawful("ObjectSetUpdates", ObjectSetUpdates);
  lawful("StreamMessage", StreamMessage);
});

describe("Link: laws of every named schema", () => {
  // Holds an object set, so it obeys the object set's law (see the subscribe request above).
  lawful("LoadLinksRequest", LoadLinksRequest);
  lawful("KeyedObjectLocator", KeyedObjectLocator);
  lawful("LinkSubscribeRequest", LinkSubscribeRequest);
  lawful("LinkSubscribeRequests", LinkSubscribeRequests);
  lawful("LinkState", LinkState);
  lawful("LinkUpdate", LinkUpdate);
  lawful("LinkUpdates", LinkUpdates);
  lawful("RefreshLinks", RefreshLinks);
  lawful("LinkStreamMessage", LinkStreamMessage);

  lawful("Link", Link);
  lawful("LinksFromSourceRows", LinksFromSourceRows);
  lawful("LinkPage", LinkPage);
  lawful("BulkLink", BulkLink);

  it.effect.prop(
    "LinksFromSourceRows: encoding nests every link under a row and decoding returns as many, in order",
    [Arbitrary.schema(LinksFromSourceRows)],
    Effect.fnUntraced(function* ([links]) {
      const rows = yield* S.encodeEffect(LinksFromSourceRows)(links);
      strictEqual(
        A.reduce(rows, 0, (count, row) => count + A.length(row.linkedObjects)),
        A.length(links)
      );
      assertTrue(A.every(rows, (row) => A.isReadonlyArrayNonEmpty(row.linkedObjects)));
      const decoded = yield* S.decodeEffect(LinksFromSourceRows)(rows);
      deepStrictEqual(
        A.map(decoded, (link) => link.linkType),
        A.map(links, (link) => link.linkType)
      );
    }),
    { arbitrary: fcRuns(50) }
  );
});

// ---------------------------------------------------------------------------
// Identifiers and literal domains
// ---------------------------------------------------------------------------

describe("Subscription: identifiers and literal domains", () => {
  it("states its domains in the types", () => {
    const facts: readonly [
      Equals<ObjectState, "addedOrUpdated" | "removed">,
      Equals<typeof ObjectState.Encoded, "ADDED_OR_UPDATED" | "REMOVED">,
      Equals<ClosureReason, "userClosed" | "channelClosed">,
      Equals<typeof ClosureReason.Encoded, "USER_CLOSED" | "CHANNEL_CLOSED">,
      Equals<LinkState, "added" | "removed">,
      Equals<typeof LinkState.Encoded, "ADDED" | "REMOVED">,
      Equals<SubscriptionStatus, "preparing" | "subscribed" | "reconnecting" | "expired" | "done" | "error">,
      Equals<
        StreamMessage["type"],
        "subscribeResponses" | "objectSetChanged" | "refreshObjectSet" | "subscriptionClosed"
      >,
      Equals<LinkStreamMessage["type"], "subscribeResponses" | "updates" | "refresh" | "subscriptionClosed">,
      Equals<SubscribeResponse["type"], "success" | "error" | "qos">,
      Equals<ObjectSetUpdate, ObjectUpdate | ReferenceUpdate>,
      Equals<SubscriptionClosureCause, ClosedForReason | ClosedByFailure>,
    ] = [true, true, true, true, true, true, true, true, true, true, true, true];
    assertTrue(A.every(facts, identity));
  });

  it.effect(
    "maps every wire literal to its domain literal and back",
    Effect.fnUntraced(function* () {
      deepStrictEqual(A.fromIterable(ObjectState.Pairs), [
        ["ADDED_OR_UPDATED", "addedOrUpdated"],
        ["REMOVED", "removed"],
      ]);
      deepStrictEqual(A.fromIterable(ClosureReason.Pairs), [
        ["USER_CLOSED", "userClosed"],
        ["CHANNEL_CLOSED", "channelClosed"],
      ]);
      deepStrictEqual(A.fromIterable(LinkState.Pairs), [
        ["ADDED", "added"],
        ["REMOVED", "removed"],
      ]);
      const objectStates = yield* S.decodeEffect(S.Array(ObjectState))(["ADDED_OR_UPDATED", "REMOVED"]);
      deepStrictEqual(objectStates, ["addedOrUpdated", "removed"]);
      const closureReasons = yield* S.encodeEffect(S.Array(ClosureReason))(["userClosed", "channelClosed"]);
      deepStrictEqual(closureReasons, ["USER_CLOSED", "CHANNEL_CLOSED"]);
      const linkStates = yield* S.encodeEffect(S.Array(LinkState))(["removed", "added"]);
      deepStrictEqual(linkStates, ["REMOVED", "ADDED"]);
    })
  );

  it("folds the two states of an object and of a link, and the two reasons, totally", () => {
    const isMember = ObjectState.To.match({ addedOrUpdated: () => true, removed: () => false });
    const delta = LinkState.To.match({ added: () => 1, removed: () => -1 });
    const closedBy = ClosureReason.To.match({ userClosed: () => "user", channelClosed: () => "channel" });
    const objectStates: ReadonlyArray<ObjectState> = ["addedOrUpdated", "removed"];
    const linkStates: ReadonlyArray<LinkState> = ["added", "removed"];
    const closureReasons: ReadonlyArray<ClosureReason> = ["userClosed", "channelClosed"];
    deepStrictEqual(A.map(objectStates, isMember), [true, false]);
    deepStrictEqual(A.map(linkStates, delta), [1, -1]);
    deepStrictEqual(A.map(closureReasons, closedBy), ["user", "channel"]);
  });

  it("lists the six client-side statuses and tells the two final ones apart", () => {
    const isFinal = SubscriptionStatus.match({
      preparing: () => false,
      subscribed: () => false,
      reconnecting: () => false,
      expired: () => false,
      done: () => true,
      error: () => true,
    });
    deepStrictEqual(A.fromIterable(SubscriptionStatus.literals), [
      "preparing",
      "subscribed",
      "reconnecting",
      "expired",
      "done",
      "error",
    ]);
    deepStrictEqual(A.filter(SubscriptionStatus.literals, isFinal), ["done", "error"]);
  });

  it.effect(
    "rejects empty identifiers and literals outside each domain",
    Effect.fnUntraced(function* () {
      const verdicts = yield* Effect.all({
        emptyRequestId: rejects(RequestId)(""),
        emptySubscriptionId: rejects(SubscriptionId)(""),
        emptyBranch: rejects(FoundryBranch)(""),
        emptyErrorName: rejects(ErrorName)(""),
        numericRequestId: rejects(RequestId)(1),
        unknownObjectState: rejects(ObjectState)("CHANGED"),
        domainObjectStateOnTheWire: rejects(ObjectState)("addedOrUpdated"),
        unknownClosureReason: rejects(ClosureReason)("SERVER_CLOSED"),
        unknownLinkState: rejects(LinkState)("UPDATED"),
        domainLinkStateOnTheWire: rejects(LinkState)("added"),
        unknownStatus: rejects(SubscriptionStatus)("closed"),
        nonJsonKeyValue: rejects(PrimaryKeyRecord)({ employeeId: BigInt(1) }),
      });
      deepStrictEqual(accepted(verdicts), []);
    })
  );
});

// ---------------------------------------------------------------------------
// Object-set stream: client to server
// ---------------------------------------------------------------------------

describe("Subscription: subscribe message", () => {
  it.effect(
    "decodes a subscribe message with every optional key and encodes it back unchanged",
    Effect.fnUntraced(function* () {
      const wire: typeof ObjectSetSubscribeRequests.Encoded = {
        id: requestIdText,
        requests: [
          {
            objectSet: allEmployees,
            propertySet: ["employeeId", "fullName"],
            referenceSet: ["employeeLocation"],
            objectLoadingResponseOptions: { shouldLoadObjectRids: true },
          },
          {
            objectSet: officesInNewYork,
            branch: "ri.branch..branch.5a0b0c63-1e0c-4a5b-a1b5-0cf6b5f1b0a1",
            scenarioRid: "ri.ontology.main.scenario.1",
            propertySet: [],
            referenceSet: [],
          },
        ],
      };
      yield* decodesTo(
        ObjectSetSubscribeRequests,
        wire,
        ObjectSetSubscribeRequests.make({
          id: requestId,
          requests: [
            ObjectSetSubscribeRequest.make({
              objectSet: everyEmployee,
              propertySet: [employeeId, PropertyApiName.make("fullName")],
              referenceSet: [PropertyApiName.make("employeeLocation")],
              objectLoadingResponseOptions: O.some(ObjectLoadingOptions.make({ shouldLoadObjectRids: O.some(true) })),
            }),
            ObjectSetSubscribeRequest.make({
              objectSet: newYorkOffices,
              branch: O.some(FoundryBranch.make("ri.branch..branch.5a0b0c63-1e0c-4a5b-a1b5-0cf6b5f1b0a1")),
              scenarioRid: O.some(OntologyScenarioRid.make("ri.ontology.main.scenario.1")),
              propertySet: [],
              referenceSet: [],
            }),
          ],
        })
      );
    })
  );

  it.effect(
    "writes only the keys that are set, so an unsubscribe-all message is an id and an empty list",
    Effect.fnUntraced(function* () {
      const bare = ObjectSetSubscribeRequest.make({ objectSet: everyEmployee, propertySet: [], referenceSet: [] });
      assertTrue(O.isNone(bare.branch) && O.isNone(bare.scenarioRid) && O.isNone(bare.objectLoadingResponseOptions));
      const encodedBare = yield* S.encodeEffect(ObjectSetSubscribeRequest)(bare);
      deepStrictEqual<unknown>(encodedBare, { objectSet: allEmployees, propertySet: [], referenceSet: [] });
      const options = yield* S.encodeEffect(ObjectLoadingOptions)(ObjectLoadingOptions.make({}));
      deepStrictEqual(options, {});
      const nothing = yield* S.encodeEffect(ObjectSetSubscribeRequests)(
        ObjectSetSubscribeRequests.make({ id: requestId, requests: [] })
      );
      deepStrictEqual(nothing, { id: requestIdText, requests: [] });
    })
  );

  it.effect(
    "rejects a request that lacks one of its required lists or its object set",
    Effect.fnUntraced(function* () {
      const verdicts = yield* Effect.all({
        noReferenceSet: rejects(ObjectSetSubscribeRequest)({ objectSet: allEmployees, propertySet: [] }),
        noPropertySet: rejects(ObjectSetSubscribeRequest)({ objectSet: allEmployees, referenceSet: [] }),
        noObjectSet: rejects(ObjectSetSubscribeRequest)({ propertySet: [], referenceSet: [] }),
        objectSetOfUnknownKind: rejects(ObjectSetSubscribeRequest)({
          objectSet: { type: "everything" },
          propertySet: [],
          referenceSet: [],
        }),
        objectSetWithoutItsType: rejects(ObjectSetSubscribeRequest)({
          objectSet: { type: "base" },
          propertySet: [],
          referenceSet: [],
        }),
        objectSetAsRid: rejects(ObjectSetSubscribeRequest)({
          objectSet: "ri.object-set.main.object-set.1",
          propertySet: [],
          referenceSet: [],
        }),
        emptyPropertyName: rejects(ObjectSetSubscribeRequest)({
          objectSet: allEmployees,
          propertySet: [""],
          referenceSet: [],
        }),
        ridsFlagAsText: rejects(ObjectLoadingOptions)({ shouldLoadObjectRids: "true" }),
        noId: rejects(ObjectSetSubscribeRequests)({ requests: [] }),
      });
      deepStrictEqual(accepted(verdicts), []);
    })
  );
});

// ---------------------------------------------------------------------------
// Object-set stream: server to client
// ---------------------------------------------------------------------------

describe("Subscription: answers to a subscribe message", () => {
  it.effect(
    "decodes one answer of each kind, in request order, and encodes it back unchanged",
    Effect.fnUntraced(function* () {
      const wire: typeof StreamMessage.Encoded = {
        type: "subscribeResponses",
        id: requestIdText,
        responses: [
          { type: "success", id: "lead-subscription-id" },
          {
            type: "error",
            errors: [{ error: "ObjectTypeNotFound", args: [{ name: "objectType", value: "Employe" }] }],
          },
          { type: "qos" },
        ],
      };
      yield* decodesTo(
        StreamMessage,
        wire,
        SubscribeResponses.make({
          id: requestId,
          responses: [
            SubscribeSuccess.make({ id: SubscriptionId.make("lead-subscription-id") }),
            SubscribeFailure.make({ errors: [objectTypeNotFound] }),
            SubscribeQosRejection.make({}),
          ],
        })
      );
    })
  );

  it("reaches each of the three answers through cases, guards and a total match", () => {
    const answers: ReadonlyArray<SubscribeResponse> = [
      SubscribeResponse.cases.success.make({ id: subscriptionId }),
      SubscribeResponse.cases.error.make({ errors: [objectTypeNotFound] }),
      SubscribeResponse.cases.qos.make({}),
    ];
    const outcome = SubscribeResponse.match({
      success: ({ id }) => `live as ${id}`,
      error: ({ errors }) => `refused for ${A.length(errors)} reason(s)`,
      qos: () => "retry on another node",
    });
    deepStrictEqual(R.keys(SubscribeResponse.cases), ["success", "error", "qos"]);
    deepStrictEqual(A.map(answers, outcome), ["live as sub-1", "refused for 1 reason(s)", "retry on another node"]);
    deepStrictEqual(A.map(answers, SubscribeResponse.guards.success), [true, false, false]);
    deepStrictEqual(A.map(answers, SubscribeResponse.isAnyOf(["error", "qos"])), [false, true, true]);
  });

  it.effect(
    "pairs each response with its request by position",
    Effect.fnUntraced(function* () {
      const request = yield* S.decodeEffect(ObjectSetSubscribeRequests)({
        id: requestIdText,
        requests: [
          { objectSet: allEmployees, propertySet: ["employeeId"], referenceSet: [] },
          { objectSet: officesInNewYork, propertySet: [], referenceSet: [] },
        ],
      });
      const answer = yield* S.decodeEffect(SubscribeResponses)({
        type: "subscribeResponses",
        id: requestIdText,
        responses: [{ type: "qos" }, { type: "success", id: "sub-2" }],
      });
      strictEqual(answer.id, request.id);
      deepStrictEqual(
        A.map(A.zip(request.requests, answer.responses), ([asked, answered]) => [
          A.length(asked.propertySet),
          answered.type,
        ]),
        [
          [1, "qos"],
          [0, "success"],
        ]
      );
    })
  );

  it.effect(
    "rejects answers that are not one of the three kinds or lack their payload",
    Effect.fnUntraced(function* () {
      const verdicts = yield* Effect.all({
        unknownKind: rejects(SubscribeResponse)({ type: "pending" }),
        successWithoutId: rejects(SubscribeResponse)({ type: "success" }),
        successWithEmptyId: rejects(SubscribeResponse)({ type: "success", id: "" }),
        errorWithoutErrors: rejects(SubscribeResponse)({ type: "error" }),
        httpErrorBody: rejects(SubscribeResponse)({
          type: "error",
          errors: [{ errorCode: "NOT_FOUND", errorName: "ObjectTypeNotFound", errorInstanceId: "1", parameters: {} }],
        }),
        failureArgumentWithoutValue: rejects(StreamFailure)({ error: "ObjectTypeNotFound", args: [{ name: "x" }] }),
        responsesWithoutId: rejects(SubscribeResponses)({ type: "subscribeResponses", responses: [] }),
      });
      deepStrictEqual(accepted(verdicts), []);
    })
  );
});

describe("Subscription: updates to a watched object set", () => {
  it.effect(
    "decodes object and reference updates and encodes them back unchanged",
    Effect.fnUntraced(function* () {
      const wire: typeof StreamMessage.Encoded = {
        type: "objectSetChanged",
        id: "sub-1",
        updates: [
          {
            type: "object",
            state: "ADDED_OR_UPDATED",
            object: { __apiName: "Employee", __primaryKey: 1, employeeId: 1 },
          },
          {
            type: "reference",
            objectType: "Employee",
            primaryKey: { employeeId: "12345" },
            property: "employeeLocation",
            value: { type: "geotimeSeriesValue", position: [100, 20], timestamp: "2021-01-04T05:00:00.000Z" },
          },
          {
            type: "object",
            state: "REMOVED",
            object: {
              __apiName: "Employee",
              __primaryKey: 2,
              __rid: "ri.phonograph2-objects.main.object.2",
              employeeId: 2,
            },
          },
        ],
      };
      const decoded = yield* S.decodeEffect(StreamMessage)(wire);
      const summary = StreamMessage.match(decoded, {
        subscribeResponses: () => A.empty<ReadonlyArray<unknown>>(),
        objectSetChanged: ({ updates }) =>
          A.map(
            updates,
            ObjectSetUpdate.match({
              object: ({ object, state }): ReadonlyArray<unknown> => [
                object.locator.objectType,
                object.locator.primaryKey,
                state,
                O.isSome(object.rid),
                R.keys(object.properties),
              ],
              reference: ({ objectType, primaryKey, property, value }): ReadonlyArray<unknown> => [
                objectType,
                primaryKey,
                property,
                value.position,
                DateTime.toEpochMillis(value.timestamp),
              ],
            })
          ),
        refreshObjectSet: () => A.empty<ReadonlyArray<unknown>>(),
        subscriptionClosed: () => A.empty<ReadonlyArray<unknown>>(),
      });
      deepStrictEqual<unknown>(summary, [
        ["Employee", 1, "addedOrUpdated", false, ["employeeId"]],
        ["Employee", { employeeId: "12345" }, "employeeLocation", [100, 20], DateTime.toEpochMillis(instant)],
        ["Employee", 2, "removed", true, ["employeeId"]],
      ]);
      const encoded = yield* S.encodeEffect(StreamMessage)(decoded);
      deepStrictEqual(encoded, wire);
    })
  );

  it.effect(
    "decodes an object update to the same value its parts construct",
    Effect.fnUntraced(function* () {
      const wire: typeof ObjectSetUpdates.Encoded = {
        type: "objectSetChanged",
        id: "sub-1",
        updates: [
          {
            type: "object",
            state: "ADDED_OR_UPDATED",
            object: { __apiName: "Employee", __primaryKey: 1, employeeId: 1 },
          },
        ],
      };
      yield* decodesTo(
        ObjectSetUpdates,
        wire,
        ObjectSetUpdates.make({
          id: subscriptionId,
          updates: [
            ObjectUpdate.make({
              object: OntologyObject.make({ locator: employee(1), properties: R.singleton(employeeId, 1) }),
              state: "addedOrUpdated",
            }),
          ],
        })
      );
    })
  );

  it("reaches both updates and the one reference value through cases and guards", () => {
    const update = ObjectSetUpdate.cases.object.make({
      object: OntologyObject.make({ locator: employee(1), properties: R.empty() }),
      state: "removed",
    });
    deepStrictEqual(R.keys(ObjectSetUpdate.cases), ["object", "reference"]);
    deepStrictEqual(R.keys(ReferenceValue.cases), ["geotimeSeriesValue"]);
    assertTrue(ObjectSetUpdate.guards.object(update));
    assertFalse(ObjectSetUpdate.guards.reference(update));
    assertTrue(ObjectSetUpdate.isAnyOf(["object"])(update));
    strictEqual(
      ObjectSetUpdate.match(update, { object: ({ state }) => state, reference: () => "reference" }),
      "removed"
    );
  });

  it.effect(
    "rejects updates of another kind, with an unknown state, or whose object cannot be located",
    Effect.fnUntraced(function* () {
      const located = { __apiName: "Employee", __primaryKey: 1 };
      const verdicts = yield* Effect.all({
        unknownKind: rejects(ObjectSetUpdate)({ type: "link", object: located, state: "REMOVED" }),
        unknownState: rejects(ObjectSetUpdate)({ type: "object", object: located, state: "CHANGED" }),
        domainState: rejects(ObjectSetUpdate)({ type: "object", object: located, state: "removed" }),
        // The stub objects of OSDK's own websocket test carry no `__primaryKey`; such an object has no locator.
        objectWithoutPrimaryKey: rejects(ObjectSetUpdate)({
          type: "object",
          object: { __apiName: "Employee", employeeId: 1 },
          state: "ADDED_OR_UPDATED",
        }),
        referenceOfUnknownKind: rejects(ObjectSetUpdate)({
          type: "reference",
          objectType: "Employee",
          primaryKey: { employeeId: 1 },
          property: "employeeLocation",
          value: { type: "timeSeriesValue", value: 1 },
        }),
        referenceWithBareKey: rejects(ObjectSetUpdate)({
          type: "reference",
          objectType: "Employee",
          primaryKey: 1,
          property: "employeeLocation",
          value: { type: "geotimeSeriesValue", position: [100, 20], timestamp: "2021-01-04T05:00:00.000Z" },
        }),
        referenceWithTextTimestamp: rejects(ObjectSetUpdate)({
          type: "reference",
          objectType: "Employee",
          primaryKey: { employeeId: 1 },
          property: "employeeLocation",
          value: { type: "geotimeSeriesValue", position: [100, 20], timestamp: "yesterday" },
        }),
        updatesWithoutSubscription: rejects(ObjectSetUpdates)({ type: "objectSetChanged", updates: [] }),
      });
      deepStrictEqual(accepted(verdicts), []);
    })
  );
});

describe("Subscription: refresh and closure", () => {
  it.effect(
    "decodes a refresh notice and both closure causes and encodes them back unchanged",
    Effect.fnUntraced(function* () {
      const refresh: typeof StreamMessage.Encoded = { type: "refreshObjectSet", id: "sub-1", objectType: "Employee" };
      const closedByUser: typeof StreamMessage.Encoded = {
        type: "subscriptionClosed",
        id: "sub-1",
        cause: { type: "reason", reason: "USER_CLOSED" },
      };
      const closedByFailure: typeof StreamMessage.Encoded = {
        type: "subscriptionClosed",
        id: "sub-1",
        cause: {
          type: "error",
          error: "ObjectSetNotFound",
          args: [{ name: "objectSetRid", value: "ri.object-set.main.object-set.1" }],
        },
      };
      yield* decodesTo(
        StreamMessage,
        refresh,
        RefreshObjectSet.make({ id: subscriptionId, objectType: employeeType })
      );
      yield* decodesTo(
        StreamMessage,
        closedByUser,
        SubscriptionClosed.make({ id: subscriptionId, cause: ClosedForReason.make({ reason: "userClosed" }) })
      );
      yield* decodesTo(
        StreamMessage,
        closedByFailure,
        SubscriptionClosed.make({
          id: subscriptionId,
          cause: ClosedByFailure.make({
            error: ErrorName.make("ObjectSetNotFound"),
            args: [StreamFailureArgument.make({ name: "objectSetRid", value: "ri.object-set.main.object-set.1" })],
          }),
        })
      );
    })
  );

  it("reaches both closure causes and all four messages through cases, guards and a total match", () => {
    const causes: ReadonlyArray<SubscriptionClosureCause> = [
      SubscriptionClosureCause.cases.reason.make({ reason: "channelClosed" }),
      SubscriptionClosureCause.cases.error.make({ error: ErrorName.make("ObjectSetNotFound"), args: [] }),
    ];
    const explain = SubscriptionClosureCause.match({
      reason: ({ reason }) => `closed: ${reason}`,
      error: ({ error, args }) => `failed: ${error} (${A.length(args)})`,
    });
    deepStrictEqual(R.keys(SubscriptionClosureCause.cases), ["reason", "error"]);
    deepStrictEqual(A.map(causes, explain), ["closed: channelClosed", "failed: ObjectSetNotFound (0)"]);
    deepStrictEqual(A.map(causes, SubscriptionClosureCause.guards.error), [false, true]);

    const messages: ReadonlyArray<StreamMessage> = [
      StreamMessage.cases.subscribeResponses.make({ id: requestId, responses: [] }),
      StreamMessage.cases.objectSetChanged.make({ id: subscriptionId, updates: [] }),
      StreamMessage.cases.refreshObjectSet.make({ id: subscriptionId, objectType: employeeType }),
      StreamMessage.cases.subscriptionClosed.make({ id: subscriptionId, cause: userClosure }),
    ];
    const addressedBy = StreamMessage.match({
      subscribeResponses: () => "request",
      objectSetChanged: () => "subscription",
      refreshObjectSet: () => "subscription",
      subscriptionClosed: () => "subscription",
    });
    deepStrictEqual(R.keys(StreamMessage.cases), [
      "subscribeResponses",
      "objectSetChanged",
      "refreshObjectSet",
      "subscriptionClosed",
    ]);
    deepStrictEqual(A.map(messages, addressedBy), ["request", "subscription", "subscription", "subscription"]);
    deepStrictEqual(A.map(messages, StreamMessage.guards.refreshObjectSet), [false, false, true, false]);
    deepStrictEqual(A.map(messages, StreamMessage.isAnyOf(["objectSetChanged", "subscriptionClosed"])), [
      false,
      true,
      false,
      true,
    ]);
  });

  it.effect(
    "rejects messages of the link stream, unknown causes and notices without their subject",
    Effect.fnUntraced(function* () {
      const verdicts = yield* Effect.all({
        linkUpdates: rejects(StreamMessage)({ type: "updates", id: "sub-1", updates: [] }),
        linkRefresh: rejects(StreamMessage)({ type: "refresh", id: "sub-1", linkTypes: ["lead"] }),
        unknownKind: rejects(StreamMessage)({ type: "heartbeat", id: "sub-1" }),
        untagged: rejects(StreamMessage)({ id: "sub-1", objectType: "Employee" }),
        refreshWithoutObjectType: rejects(StreamMessage)({ type: "refreshObjectSet", id: "sub-1" }),
        closedWithoutCause: rejects(StreamMessage)({ type: "subscriptionClosed", id: "sub-1" }),
        unknownCause: rejects(SubscriptionClosureCause)({ type: "timeout" }),
        unknownReason: rejects(SubscriptionClosureCause)({ type: "reason", reason: "SERVER_CLOSED" }),
        failureWithoutArgs: rejects(SubscriptionClosureCause)({ type: "error", error: "ObjectSetNotFound" }),
      });
      deepStrictEqual(accepted(verdicts), []);
    })
  );
});

// ---------------------------------------------------------------------------
// Links: listings
// ---------------------------------------------------------------------------

describe("Link: the paged listing", () => {
  it("states the flattened shape in the types", () => {
    const facts: readonly [
      Equals<LinksFromSourceRows, ReadonlyArray<Link>>,
      Equals<LinkPage["data"], ReadonlyArray<Link>>,
      Equals<Link["source"], ObjectLocator>,
      Equals<Link["target"], ObjectLocator>,
      Equals<LinkPage["nextPageToken"], O.Option<PageToken>>,
      Equals<keyof typeof LoadLinksRequest.Encoded, "objectSet" | "links" | "pageToken" | "includeComputeUsage">,
      Equals<LoadLinksRequest["linkTypes"], ReadonlyArray<LinkTypeApiName>>,
      Equals<BulkLink["targetObjectType"], O.Option<ObjectTypeApiName>>,
      Equals<
        keyof typeof BulkLink.Encoded,
        "object" | "linkApiName" | "otherObjectApiName" | "otherObjectPk"
      >,
    ] = [true, true, true, true, true, true, true, true, true];
    assertTrue(A.every(facts, identity));
  });

  it.effect(
    "flattens a page of rows into one link per pair and encodes it back unchanged",
    Effect.fnUntraced(function* () {
      const wire: typeof LinkPage.Encoded = {
        data: [
          {
            sourceObject: { __apiName: "Employee", __primaryKey: 50030 },
            linkedObjects: [
              { targetObject: { __apiName: "Employee", __primaryKey: 50031 }, linkType: "peeps" },
              { targetObject: { __apiName: "Office", __primaryKey: "NYC" }, linkType: "officeLink" },
            ],
          },
          {
            sourceObject: { __apiName: "Employee", __primaryKey: 50031 },
            linkedObjects: [{ targetObject: { __apiName: "Employee", __primaryKey: 50030 }, linkType: "lead" }],
          },
        ],
        nextPageToken: "v1.000000000000000a",
        computeUsage: 0.25,
      };
      yield* decodesTo(
        LinkPage,
        wire,
        LinkPage.make({
          data: [
            Link.make({ source: employee(50030), target: employee(50031), linkType: peeps }),
            Link.make({ source: employee(50030), target: office("NYC"), linkType: officeLink }),
            Link.make({ source: employee(50031), target: employee(50030), linkType: lead }),
          ],
          nextPageToken: O.some(PageToken.make("v1.000000000000000a")),
          computeUsage: O.some(0.25),
        })
      );
    })
  );

  it.effect(
    "reads the last page as a page without a cursor",
    Effect.fnUntraced(function* () {
      const page = yield* S.decodeEffect(LinkPage)({ data: [] });
      assertTrue(A.isReadonlyArrayEmpty(page.data) && O.isNone(page.nextPageToken) && O.isNone(page.computeUsage));
      const encoded = yield* S.encodeEffect(LinkPage)(LinkPage.make({ data: [] }));
      deepStrictEqual(encoded, { data: [] });
    })
  );

  it.effect(
    "groups only adjacent links of one source when encoding, so the order of links survives",
    Effect.fnUntraced(function* () {
      const links = [
        Link.make({ source: employee(1), target: employee(2), linkType: peeps }),
        Link.make({ source: employee(1), target: office("NYC"), linkType: officeLink }),
        Link.make({ source: employee(2), target: employee(1), linkType: lead }),
        Link.make({ source: employee(1), target: employee(3), linkType: peeps }),
      ];
      const rows = yield* S.encodeEffect(LinksFromSourceRows)(links);
      deepStrictEqual(rows, [
        {
          sourceObject: { __apiName: "Employee", __primaryKey: 1 },
          linkedObjects: [
            { targetObject: { __apiName: "Employee", __primaryKey: 2 }, linkType: "peeps" },
            { targetObject: { __apiName: "Office", __primaryKey: "NYC" }, linkType: "officeLink" },
          ],
        },
        {
          sourceObject: { __apiName: "Employee", __primaryKey: 2 },
          linkedObjects: [{ targetObject: { __apiName: "Employee", __primaryKey: 1 }, linkType: "lead" }],
        },
        {
          sourceObject: { __apiName: "Employee", __primaryKey: 1 },
          linkedObjects: [{ targetObject: { __apiName: "Employee", __primaryKey: 3 }, linkType: "peeps" }],
        },
      ]);
      const decoded = yield* S.decodeEffect(LinksFromSourceRows)(rows);
      assertTrue(S.toEquivalence(LinksFromSourceRows)(decoded, links));
    })
  );

  it.effect(
    "tells sources of the same key but different object types apart",
    Effect.fnUntraced(function* () {
      const rows = yield* S.encodeEffect(LinksFromSourceRows)([
        Link.make({ source: office("1"), target: employee(2), linkType: peeps }),
        Link.make({
          source: ObjectLocator.make({ objectType: employeeType, primaryKey: "1" }),
          target: employee(2),
          linkType: peeps,
        }),
      ]);
      strictEqual(A.length(rows), 2);
    })
  );

  it.effect(
    "drops a row without links and the extra keys of a row's objects, the two things a link does not hold",
    Effect.fnUntraced(function* () {
      const links = yield* S.decodeUnknownEffect(LinksFromSourceRows)([
        { sourceObject: { __apiName: "Employee", __primaryKey: 1 }, linkedObjects: [] },
        {
          sourceObject: { __apiName: "Employee", __primaryKey: 2, __title: "Ada", fullName: "Ada" },
          linkedObjects: [
            { targetObject: { __apiName: "Office", __primaryKey: "NYC", name: "New York" }, linkType: "officeLink" },
          ],
        },
      ]);
      assertTrue(
        S.toEquivalence(LinksFromSourceRows)(links, [
          Link.make({ source: employee(2), target: office("NYC"), linkType: officeLink }),
        ])
      );
      const rows = yield* S.encodeEffect(LinksFromSourceRows)(links);
      deepStrictEqual(rows, [
        {
          sourceObject: { __apiName: "Employee", __primaryKey: 2 },
          linkedObjects: [{ targetObject: { __apiName: "Office", __primaryKey: "NYC" }, linkType: "officeLink" }],
        },
      ]);
    })
  );

  it.effect(
    "rejects rows that cannot be read as links",
    Effect.fnUntraced(function* () {
      const source = { __apiName: "Employee", __primaryKey: 1 };
      const target = { __apiName: "Office", __primaryKey: "NYC" };
      const verdicts = yield* Effect.all({
        rowWithoutSource: rejects(LinksFromSourceRows)([
          { linkedObjects: [{ targetObject: target, linkType: "officeLink" }] },
        ]),
        emptyRowWithoutSource: rejects(LinksFromSourceRows)([{ linkedObjects: [] }]),
        linkedObjectWithoutTarget: rejects(LinksFromSourceRows)([
          { sourceObject: source, linkedObjects: [{ linkType: "officeLink" }] },
        ]),
        linkedObjectWithoutLinkType: rejects(LinksFromSourceRows)([
          { sourceObject: source, linkedObjects: [{ targetObject: target }] },
        ]),
        emptyLinkType: rejects(LinksFromSourceRows)([
          { sourceObject: source, linkedObjects: [{ targetObject: target, linkType: "" }] },
        ]),
        sourceWithoutPrimaryKey: rejects(LinksFromSourceRows)([
          {
            sourceObject: { __apiName: "Employee" },
            linkedObjects: [{ targetObject: target, linkType: "officeLink" }],
          },
        ]),
        rowWithoutLinkedObjects: rejects(LinksFromSourceRows)([{ sourceObject: source }]),
        flatLinksOnTheWire: rejects(LinksFromSourceRows)([
          {
            source: { objectType: "Employee", primaryKey: 1 },
            target: { objectType: "Office", primaryKey: "NYC" },
            linkType: "officeLink",
          },
        ]),
        pageWithoutData: rejects(LinkPage)({ nextPageToken: "v1.next" }),
        pageWithEmptyCursor: rejects(LinkPage)({ data: [], nextPageToken: "" }),
      });
      deepStrictEqual(accepted(verdicts), []);
    })
  );

  it.effect(
    "writes a request's link types under the wire's key and omits what is not set",
    Effect.fnUntraced(function* () {
      const wire: typeof LoadLinksRequest.Encoded = {
        objectSet: allEmployees,
        links: ["lead", "peeps"],
        pageToken: "v1.000000000000000a",
        includeComputeUsage: true,
      };
      yield* decodesTo(
        LoadLinksRequest,
        wire,
        LoadLinksRequest.make({
          objectSet: everyEmployee,
          linkTypes: [lead, peeps],
          pageToken: O.some(PageToken.make("v1.000000000000000a")),
          includeComputeUsage: O.some(true),
        })
      );
      const first = yield* S.encodeEffect(LoadLinksRequest)(
        LoadLinksRequest.make({ objectSet: everyEmployee, linkTypes: [lead] })
      );
      deepStrictEqual<unknown>(first, { objectSet: allEmployees, links: ["lead"] });
      const domainKeyRejected = yield* rejects(LoadLinksRequest)({ objectSet: allEmployees, linkTypes: ["lead"] });
      assertTrue(domainKeyRejected);
      const notAnObjectSet = yield* rejects(LoadLinksRequest)({
        objectSet: { objectType: "Employee" },
        links: ["lead"],
      });
      assertTrue(notAnObjectSet);
    })
  );
});

describe("Link: the bulk listing", () => {
  it.effect(
    "decodes a bulk link under its domain names and encodes it back unchanged",
    Effect.fnUntraced(function* () {
      const wire: typeof BulkLink.Encoded = {
        object: { objectType: "Employee", primaryKey: 50030 },
        linkApiName: "officeLink",
        otherObjectApiName: "Office",
        otherObjectPk: "NYC",
      };
      yield* decodesTo(
        BulkLink,
        wire,
        BulkLink.make({
          source: employee(50030),
          linkType: officeLink,
          targetObjectType: O.some(officeType),
          targetPrimaryKey: "NYC",
        })
      );
    })
  );

  it.effect(
    "reads an absent or null object type of the far end as none and omits it again",
    Effect.fnUntraced(function* () {
      const base = {
        object: { objectType: "Employee", primaryKey: 50030 },
        linkApiName: "officeLink",
        otherObjectPk: 7,
      };
      const fromNull = yield* S.decodeEffect(BulkLink)({ ...base, otherObjectApiName: null });
      const fromAbsent = yield* S.decodeEffect(BulkLink)(base);
      assertTrue(O.isNone(fromNull.targetObjectType) && O.isNone(fromAbsent.targetObjectType));
      assertTrue(S.toEquivalence(BulkLink)(fromNull, fromAbsent));
      const encoded = yield* S.encodeEffect(BulkLink)(fromNull);
      deepStrictEqual<unknown>(encoded, base);
      const verdicts = yield* Effect.all({
        withoutObject: rejects(BulkLink)({ linkApiName: "officeLink", otherObjectPk: 7 }),
        withoutFarKey: rejects(BulkLink)({ object: base.object, linkApiName: "officeLink" }),
        domainKeys: rejects(BulkLink)({ source: base.object, linkType: "officeLink", targetPrimaryKey: 7 }),
      });
      deepStrictEqual(accepted(verdicts), []);
    })
  );
});

// ---------------------------------------------------------------------------
// Links: the link stream
// ---------------------------------------------------------------------------

describe("Link: the link stream", () => {
  it("names the ends of an update like the ends of a link", () => {
    const facts: readonly [
      Equals<keyof typeof LinkUpdate.Encoded, "selectedSide" | "linkType" | "linkedSide" | "state">,
      Equals<LinkUpdate["source"], KeyedObjectLocator>,
      Equals<LinkUpdate["target"], KeyedObjectLocator>,
      Equals<LinkUpdate["state"], "added" | "removed">,
      Equals<KeyedObjectLocator["primaryKey"], PrimaryKeyRecord>,
    ] = [true, true, true, true, true];
    assertTrue(A.every(facts, identity));
  });

  it.effect(
    "decodes a subscribe message for two link types and encodes it back unchanged",
    Effect.fnUntraced(function* () {
      const wire: typeof LinkSubscribeRequests.Encoded = {
        id: requestIdText,
        requests: [
          {
            linkTypes: ["lead"],
            selectedObjects: [
              { objectType: "Employee", primaryKey: { employeeId: 1 } },
              { objectType: "Employee", primaryKey: { employeeId: 2 } },
            ],
          },
          {
            linkTypes: ["peeps"],
            selectedObjects: [{ objectType: "Employee", primaryKey: { employeeId: 3 } }],
          },
        ],
      };
      yield* decodesTo(
        LinkSubscribeRequests,
        wire,
        LinkSubscribeRequests.make({
          id: requestId,
          requests: [
            LinkSubscribeRequest.make({ linkTypes: [lead], selectedObjects: [keyedEmployee(1), keyedEmployee(2)] }),
            LinkSubscribeRequest.make({ linkTypes: [peeps], selectedObjects: [keyedEmployee(3)] }),
          ],
        })
      );
    })
  );

  it.effect(
    "answers a link subscribe message with the object-set stream's record, paired by position",
    Effect.fnUntraced(function* () {
      const wire: typeof LinkStreamMessage.Encoded = {
        id: requestIdText,
        responses: [
          { id: "lead-subscription-id", type: "success" },
          { id: "peeps-subscription-id", type: "success" },
        ],
        type: "subscribeResponses",
      };
      yield* decodesTo(
        LinkStreamMessage,
        wire,
        SubscribeResponses.make({
          id: requestId,
          responses: [
            SubscribeSuccess.make({ id: SubscriptionId.make("lead-subscription-id") }),
            SubscribeSuccess.make({ id: SubscriptionId.make("peeps-subscription-id") }),
          ],
        })
      );
    })
  );

  it.effect(
    "decodes a batch of link updates with the watched object as source and encodes it back unchanged",
    Effect.fnUntraced(function* () {
      const wire: typeof LinkStreamMessage.Encoded = {
        id: "lead-subscription-id",
        type: "updates",
        updates: [
          {
            linkedSide: { objectType: "Employee", primaryKey: { employeeId: 2 } },
            linkType: "lead",
            selectedSide: { objectType: "Employee", primaryKey: { employeeId: 1 } },
            state: "ADDED",
          },
          {
            linkedSide: { objectType: "Employee", primaryKey: { employeeId: 4 } },
            linkType: "peeps",
            selectedSide: { objectType: "Employee", primaryKey: { employeeId: 3 } },
            state: "REMOVED",
          },
        ],
      };
      yield* decodesTo(
        LinkStreamMessage,
        wire,
        LinkUpdates.make({
          id: SubscriptionId.make("lead-subscription-id"),
          updates: [
            LinkUpdate.make({ source: keyedEmployee(1), linkType: lead, target: keyedEmployee(2), state: "added" }),
            LinkUpdate.make({ source: keyedEmployee(3), linkType: peeps, target: keyedEmployee(4), state: "removed" }),
          ],
        })
      );
    })
  );

  it.effect(
    "decodes a refresh notice and a closure and encodes them back unchanged",
    Effect.fnUntraced(function* () {
      const refresh: typeof LinkStreamMessage.Encoded = { type: "refresh", id: "sub-1", linkTypes: ["lead", "peeps"] };
      const closed: typeof LinkStreamMessage.Encoded = {
        type: "subscriptionClosed",
        id: "sub-1",
        cause: { type: "reason", reason: "CHANNEL_CLOSED" },
      };
      yield* decodesTo(LinkStreamMessage, refresh, RefreshLinks.make({ id: subscriptionId, linkTypes: [lead, peeps] }));
      yield* decodesTo(
        LinkStreamMessage,
        closed,
        SubscriptionClosed.make({ id: subscriptionId, cause: ClosedForReason.make({ reason: "channelClosed" }) })
      );
    })
  );

  it("reaches all four messages through cases, guards and a total match", () => {
    const messages: ReadonlyArray<LinkStreamMessage> = [
      LinkStreamMessage.cases.subscribeResponses.make({ id: requestId, responses: [] }),
      LinkStreamMessage.cases.updates.make({ id: subscriptionId, updates: [] }),
      LinkStreamMessage.cases.refresh.make({ id: subscriptionId, linkTypes: [lead] }),
      LinkStreamMessage.cases.subscriptionClosed.make({ id: subscriptionId, cause: userClosure }),
    ];
    const reaction = LinkStreamMessage.match({
      subscribeResponses: ({ responses }) => `${A.length(responses)} answered`,
      updates: ({ updates }) => `${A.length(updates)} changed`,
      refresh: ({ linkTypes }) => `reload ${A.join(linkTypes, ", ")}`,
      subscriptionClosed: ({ cause }) => `closed by ${cause.type}`,
    });
    deepStrictEqual(R.keys(LinkStreamMessage.cases), [
      "subscribeResponses",
      "updates",
      "refresh",
      "subscriptionClosed",
    ]);
    deepStrictEqual(A.map(messages, reaction), ["0 answered", "0 changed", "reload lead", "closed by reason"]);
    deepStrictEqual(A.map(messages, LinkStreamMessage.guards.updates), [false, true, false, false]);
    deepStrictEqual(A.map(messages, LinkStreamMessage.isAnyOf(["refresh", "subscriptionClosed"])), [
      false,
      false,
      true,
      true,
    ]);
  });

  it.effect(
    "rejects messages of the object-set stream, domain key names on the wire and incomplete updates",
    Effect.fnUntraced(function* () {
      const selected = { objectType: "Employee", primaryKey: { employeeId: 1 } };
      const linked = { objectType: "Employee", primaryKey: { employeeId: 2 } };
      const verdicts = yield* Effect.all({
        objectSetChanged: rejects(LinkStreamMessage)({ type: "objectSetChanged", id: "sub-1", updates: [] }),
        refreshObjectSet: rejects(LinkStreamMessage)({ type: "refreshObjectSet", id: "sub-1", objectType: "Employee" }),
        unknownKind: rejects(LinkStreamMessage)({ type: "heartbeat", id: "sub-1" }),
        refreshWithoutLinkTypes: rejects(LinkStreamMessage)({ type: "refresh", id: "sub-1" }),
        domainKeys: rejects(LinkUpdate)({ source: selected, linkType: "lead", target: linked, state: "ADDED" }),
        updateWithoutLinkedSide: rejects(LinkUpdate)({ selectedSide: selected, linkType: "lead", state: "ADDED" }),
        updateWithUnknownState: rejects(LinkUpdate)({
          selectedSide: selected,
          linkType: "lead",
          linkedSide: linked,
          state: "UPDATED",
        }),
        updateWithBareKey: rejects(LinkUpdate)({
          selectedSide: { objectType: "Employee", primaryKey: 1 },
          linkType: "lead",
          linkedSide: linked,
          state: "ADDED",
        }),
        locatorWithoutObjectType: rejects(KeyedObjectLocator)({ primaryKey: { employeeId: 1 } }),
        requestWithoutLinkTypes: rejects(LinkSubscribeRequest)({ selectedObjects: [selected] }),
        requestsWithoutId: rejects(LinkSubscribeRequests)({ requests: [] }),
      });
      deepStrictEqual(accepted(verdicts), []);
    })
  );
});
