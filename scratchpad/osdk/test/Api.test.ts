import { $ScratchpadId } from "@beep/identity/packages";
import { describe, it } from "@effect/vitest";
import { assertFalse, assertNone, assertSome, assertTrue, deepStrictEqual, strictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Formatter from "effect/Formatter";
import * as Headers from "effect/http/Headers";
import type * as HttpBody from "effect/http/HttpBody";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientError from "effect/http/HttpClientError";
import type * as HttpClientRequest from "effect/http/HttpClientRequest";
import * as HttpClientResponse from "effect/http/HttpClientResponse";
import * as HttpApiClient from "effect/http-api/HttpApiClient";
import * as Layer from "effect/Layer";
import * as Logger from "effect/Logger";
import * as MutableRef from "effect/MutableRef";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Redacted from "effect/Redacted";
import * as Ref from "effect/Ref";
import * as References from "effect/References";
import * as S from "effect/Schema";
import * as Semaphore from "effect/Semaphore";
import * as Str from "effect/String";
import * as Tracer from "effect/Tracer";
import * as Tuple from "effect/Tuple";
import { ApplyActionRequest, BatchApplyActionItem, BatchApplyActionRequest } from "../src/Action/index.ts";
import { count, exact } from "../src/Aggregation/index.ts";
import { FoundryConnection, FoundryConnectionSettings, HttpOntologyTransport, OntologyApi } from "../src/Api/index.ts";
import { AttachmentUpload, Filename } from "../src/Attachment/index.ts";
import {
  AggregateObjectSetRequest,
  LoadObjectsRequest,
  OntologyContext,
  OntologyScope,
  OntologyTransport,
  TransportFailure,
} from "../src/Client/index.ts";
import {
  ActionTypeApiName,
  AttachmentRid,
  FoundryBranch,
  FunctionVersion,
  LinkTypeApiName,
  ObjectTypeApiName,
  OntologyApiName,
  OntologyRid,
  OntologyScenarioRid,
  OntologyTransactionId,
  ParameterId,
  PropertyApiName,
  QueryApiName,
} from "../src/Identifier/index.ts";
import { LoadLinksRequest } from "../src/Link/index.ts";
import { BaseObjectSet } from "../src/ObjectSet/index.ts";
import { OntologyInclusions, OntologySelection, VersionedQueryApiName } from "../src/Ontology/index.ts";
import { PageToken } from "../src/Page/index.ts";
import { PropertyByName } from "../src/Property/index.ts";
import { ExecuteQueryRequest } from "../src/Query/index.ts";

const $I = $ScratchpadId.create("osdk/test/Api");

// ---------------------------------------------------------------------------
// A platform that answers from a script and remembers what it was sent
// ---------------------------------------------------------------------------

const origin = "https://stack.example.com";
const token = "test-token-7f3a91c2";

type Reply = (
  request: HttpClientRequest.HttpClientRequest
) => Effect.Effect<HttpClientResponse.HttpClientResponse, HttpClientError.HttpClientError>;

const decodeJsonText = S.decodeEffect(S.fromJsonString(S.Unknown));
const decodeSettings = S.decodeEffect(FoundryConnectionSettings);
const encodeSettings = S.encodeEffect(FoundryConnectionSettings);
const utf8 = new TextDecoder();

// The body of a request as a test wants to compare it: parsed when it is JSON, the bytes otherwise.
const bodyOf = (body: HttpBody.HttpBody): Effect.Effect<unknown> =>
  body._tag === "Uint8Array"
    ? body.contentType === "application/json"
      ? Effect.orDie(decodeJsonText(utf8.decode(body.body)))
      : Effect.succeed(body.body)
    : Effect.succeed(null);

const contentTypeOf = (body: HttpBody.HttpBody): string | null =>
  body._tag === "Uint8Array" ? body.contentType : null;

const record = Effect.fnUntraced(function* (request: HttpClientRequest.HttpClientRequest, url: URL) {
  const body = yield* bodyOf(request.body);
  return {
    method: request.method,
    url: url.toString(),
    authorization: O.getOrNull(Headers.get(request.headers, "authorization")),
    contentType: contentTypeOf(request.body),
    body,
  };
});

type Sent = Effect.Success<ReturnType<typeof record>>;

const nothingSent: Sent = { method: "GET", url: "", authorization: null, contentType: null, body: null };

const json =
  (status: number, body: unknown): Reply =>
  (request) =>
    Effect.succeed(HttpClientResponse.fromWeb(request, Response.json(body, { status })));

const text =
  (status: number, body: string, contentType: string): Reply =>
  (request) =>
    Effect.succeed(
      HttpClientResponse.fromWeb(request, new Response(body, { status, headers: { "content-type": contentType } }))
    );

const bytes =
  (body: Uint8Array<ArrayBuffer>, contentType: string): Reply =>
  (request) =>
    Effect.succeed(
      HttpClientResponse.fromWeb(request, new Response(body, { status: 200, headers: { "content-type": contentType } }))
    );

const empty =
  (status: number): Reply =>
  (request) =>
    Effect.succeed(HttpClientResponse.fromWeb(request, new Response(null, { status })));

const refusedConnection = "connect ECONNREFUSED 10.0.0.1:443";

const unreachable: Reply = (request) =>
  Effect.fail(
    new HttpClientError.HttpClientError({
      reason: new HttpClientError.TransportError({ request, cause: refusedConnection }),
    })
  );

class Wire extends Context.Service<
  Wire,
  {
    readonly client: HttpClient.HttpClient;
    readonly reply: Ref.Ref<Reply>;
    readonly sent: Ref.Ref<Sent>;
    // Tests of this file run concurrently and share one platform: an exchange holds the turn from
    // the moment it scripts the answer until it has read what was sent.
    readonly turn: Semaphore.Semaphore;
  }
>()($I`Wire`) {}

const WireLive = Layer.effect(
  Wire,
  Effect.gen(function* () {
    const reply = yield* Ref.make<Reply>(empty(500));
    const sent = yield* Ref.make(nothingSent);
    const turn = yield* Semaphore.make(1);
    const client = HttpClient.make(
      Effect.fnUntraced(function* (request, url) {
        const recorded = yield* record(request, url);
        yield* Ref.set(sent, recorded);
        const answer = yield* Ref.get(reply);
        return yield* answer(request);
      })
    );
    return Wire.of({ client, reply, sent, turn });
  })
);

// Everything the transport logs and every span it opens, so that tests can read them back.
type OutputOf<L> = L extends Logger.Logger<unknown, infer Output> ? Output : never;
const logged = MutableRef.make(A.empty<OutputOf<typeof Logger.formatStructured>>());
const spans = MutableRef.make(A.empty<Tracer.Span>());

const Recorder = Logger.layer([
  Logger.map(Logger.formatStructured, (entry) => {
    MutableRef.update(logged, A.append(entry));
  }),
]);

const tracer = Tracer.make({
  span(options) {
    const span = Tracer.nativeTracer.span(options);
    MutableRef.update(spans, A.append(span));
    return span;
  },
});

const Observed = Layer.mergeAll(
  Recorder,
  Layer.succeed(Tracer.Tracer, tracer),
  Layer.succeed(References.MinimumLogLevel, "Debug")
);

const Connection = Layer.effect(FoundryConnection, Effect.orDie(decodeSettings({ baseUrl: origin, token })));

const transportIn = (scope: OntologyScope) =>
  HttpOntologyTransport.pipe(
    Layer.provide(
      Layer.effect(
        HttpClient.HttpClient,
        Effect.map(Wire, (wire) => wire.client)
      )
    ),
    Layer.provide(Connection),
    Layer.provide(Layer.succeed(OntologyContext, scope)),
    Layer.provideMerge(WireLive),
    Layer.provideMerge(Observed)
  );

// Scripts the platform's next answer, makes one call, and hands back its outcome with what was sent.
const exchange = Effect.fnUntraced(function* <A, E>(
  reply: Reply,
  call: (transport: OntologyTransport["Service"]) => Effect.Effect<A, E>
) {
  const wire = yield* Wire;
  const transport = yield* OntologyTransport;
  return yield* Semaphore.withPermit(wire.turn)(
    Effect.gen(function* () {
      yield* Ref.set(wire.reply, reply);
      yield* Ref.set(wire.sent, nothingSent);
      const outcome = yield* call(transport);
      const sent = yield* Ref.get(wire.sent);
      return Tuple.make(outcome, sent);
    })
  );
});

// ---------------------------------------------------------------------------
// Fixtures: values of the domain, and the platform's JSON
// ---------------------------------------------------------------------------

const authorization = `Bearer ${token}`;

const everywhere = OntologyScope.make({
  ontology: OntologyApiName.make("default-ontology"),
  branch: O.some(FoundryBranch.make("feature-1")),
  transaction: O.some(OntologyTransactionId.make("txn-42")),
  scenario: O.some(OntologyScenarioRid.make("ri.scenario.1")),
});

const ontologyRid = "ri.ontology.main.ontology.698267cc-6b48-4d98-beff-29beb24e9361";
const byRid = OntologyScope.make({ ontology: OntologyRid.make(ontologyRid) });

const employees = BaseObjectSet.make({ objectType: ObjectTypeApiName.make("Employee") });
const officeId = ParameterId.make("officeId");
const promote = ActionTypeApiName.make("promote-employee");

const loadRequest = LoadObjectsRequest.make({
  objectSet: employees,
  selection: [PropertyByName.make({ apiName: PropertyApiName.make("fullName") })],
  pageSize: O.some(100),
  includeRid: true,
});

const loadRequestWire = {
  objectSet: { type: "base", objectType: "Employee" },
  select: [],
  selectV2: [{ type: "property", apiName: "fullName" }],
  pageSize: 100,
  excludeRid: false,
  snapshot: false,
  loadPropertySecurities: false,
};

const pageWire = {
  data: [{ __apiName: "Employee", __primaryKey: 50030, employeeId: 50030, fullName: "John Doe" }],
  nextPageToken: "v1.next",
  totalCount: "2",
  propertySecurities: [],
};

const ontologyWire = {
  ontology: {
    apiName: "default-ontology",
    displayName: "Ontology",
    description: "The default ontology",
    rid: ontologyRid,
  },
  objectTypes: {},
  actionTypes: {},
  queryTypes: {},
  interfaceTypes: {},
  sharedPropertyTypes: {},
  valueTypes: {},
};

const notFoundWire = {
  errorCode: "NOT_FOUND",
  errorName: "ObjectTypeNotFound",
  errorInstanceId: "b2ae7b3e-2c89-42f5-a762-68957a9c039d",
  parameters: { objectType: "Employe" },
};

const encodeFailure = S.encodeEffect(TransportFailure);

// Every way a failure can be put into words or onto a wire, as one text.
const rendered = Effect.fnUntraced(function* (failure: TransportFailure) {
  const encoded = yield* failure.pipe(encodeFailure, Effect.orDie);
  return A.join(
    [
      failure.message,
      Formatter.format(failure),
      Formatter.format(encoded),
      failure.pipe(Cause.fail, Cause.pretty),
      "cause" in failure ? Formatter.format(failure.cause) : "",
    ],
    "\n"
  );
});

const mentionsToken = Str.includes(token);

// ---------------------------------------------------------------------------
// The declaration
// ---------------------------------------------------------------------------

describe("the declared routes", () => {
  it("spell the platform's paths, with query parameters in the order the routes declare them", () => {
    const address = HttpApiClient.urlBuilder(OntologyApi, { baseUrl: origin });
    const ontology = OntologyApiName.make("o");
    const none = { branch: O.none(), transactionId: O.none(), scenarioRid: O.none() };
    deepStrictEqual(
      [
        address.ontologies.getFullMetadata({
          params: { ontology },
          query: { branch: O.none(), includeActionTypeFullMetadata: O.none(), includeDatasources: O.none() },
        }),
        address.ontologies.getFullMetadata({
          params: { ontology },
          query: {
            branch: O.some(FoundryBranch.make("feature-1")),
            includeActionTypeFullMetadata: O.some(true),
            includeDatasources: O.some(false),
          },
        }),
        address.ontologies.loadMetadata({ params: { ontology }, query: { branch: O.none(), preview: O.some(true) } }),
        address.objectSets.load({ params: { ontology }, query: none }),
        address.objectSets.aggregate({ params: { ontology }, query: none }),
        address.objectSets.loadLinks({ params: { ontology }, query: { branch: O.none(), preview: O.none() } }),
        address.actions.apply({ params: { ontology, action: promote }, query: none }),
        address.actions.applyBatch({
          params: { ontology, action: promote },
          query: { branch: O.none(), scenarioRid: O.none() },
        }),
        address.queries.execute({
          params: { ontology, queryApiName: QueryApiName.make("addOne") },
          query: { version: O.none(), ...none },
        }),
        address.attachments.upload({ query: AttachmentUpload.make({ filename: Filename.make("a b.txt") }) }),
        address.attachments.read({ params: { attachmentRid: AttachmentRid.make("ri.attachments.main.attachment.1") } }),
      ],
      [
        `${origin}/v2/ontologies/o/fullMetadata`,
        `${origin}/v2/ontologies/o/fullMetadata?branch=feature-1&includeActionTypeFullMetadata=true&includeDatasources=false`,
        `${origin}/v2/ontologies/o/metadata?preview=true`,
        `${origin}/v2/ontologies/o/objectSets/loadObjects`,
        `${origin}/v2/ontologies/o/objectSets/aggregate`,
        `${origin}/v2/ontologies/o/objectSets/loadLinks`,
        `${origin}/v2/ontologies/o/actions/promote-employee/apply`,
        `${origin}/v2/ontologies/o/actions/promote-employee/applyBatch`,
        `${origin}/v2/ontologies/o/queries/addOne/execute`,
        `${origin}/v2/ontologies/attachments/upload?filename=a+b.txt`,
        `${origin}/v2/ontologies/attachments/ri.attachments.main.attachment.1/content`,
      ]
    );
  });

  it.effect(
    "keep the token of a connection out of its printed and encoded forms",
    Effect.fnUntraced(function* () {
      const settings = yield* decodeSettings({ baseUrl: origin, token });
      strictEqual(Redacted.value(settings.token), token);
      strictEqual(settings.baseUrl.origin, origin);
      assertFalse(mentionsToken(Formatter.format(settings)));
      const refusals = yield* Effect.all([
        Effect.flip(encodeSettings(settings)),
        Effect.flip(decodeSettings({ baseUrl: "not a url", token })),
        Effect.flip(decodeSettings({ baseUrl: origin, token: "" })),
      ]);
      deepStrictEqual(
        A.map(refusals, (refusal) => refusal._tag),
        ["SchemaError", "SchemaError", "SchemaError"]
      );
    })
  );
});

// ---------------------------------------------------------------------------
// Every member of the port, in a scope that names a branch, a transaction and a scenario
// ---------------------------------------------------------------------------

it.layer(transportIn(everywhere))("the HTTP transport, fully scoped", (it) => {
  it.effect(
    "loadOntology without a selection reads the whole definition with GET",
    Effect.fnUntraced(function* () {
      const [ontology, sent] = yield* exchange(json(200, ontologyWire), (transport) =>
        transport.loadOntology(O.none())
      );
      deepStrictEqual(sent, {
        method: "GET",
        url: `${origin}/v2/ontologies/default-ontology/fullMetadata?branch=feature-1`,
        authorization,
        contentType: null,
        body: null,
      });
      deepStrictEqual(
        [ontology.identity.apiName, ontology.identity.rid, R.size(ontology.objectTypes)],
        ["default-ontology", ontologyRid, 0]
      );
      strictEqual(R.size(ontology.actionTypeDefinitions), 0);
    })
  );

  it.effect(
    "loadOntology without a selection sends the inclusions it is given as query parameters, under the wire's names",
    Effect.fnUntraced(function* () {
      const address = `${origin}/v2/ontologies/default-ontology/fullMetadata?branch=feature-1`;
      const [, both] = yield* exchange(json(200, ontologyWire), (transport) =>
        transport.loadOntology(
          O.none(),
          OntologyInclusions.make({ includeActionTypeDefinitions: O.some(true), includeDatasources: O.some(true) })
        )
      );
      deepStrictEqual(both, {
        method: "GET",
        url: `${address}&includeActionTypeFullMetadata=true&includeDatasources=true`,
        authorization,
        contentType: null,
        body: null,
      });
      // A stated `false` is sent; an inclusion that is not stated is left to the platform.
      const [, refused] = yield* exchange(json(200, ontologyWire), (transport) =>
        transport.loadOntology(O.none(), OntologyInclusions.make({ includeActionTypeDefinitions: O.some(false) }))
      );
      strictEqual(refused.url, `${address}&includeActionTypeFullMetadata=false`);
      const [, datasourcesOnly] = yield* exchange(json(200, ontologyWire), (transport) =>
        transport.loadOntology(O.none(), OntologyInclusions.make({ includeDatasources: O.some(true) }))
      );
      strictEqual(datasourcesOnly.url, `${address}&includeDatasources=true`);
      const [, nothingStated] = yield* exchange(json(200, ontologyWire), (transport) =>
        transport.loadOntology(O.none(), OntologyInclusions.make({}))
      );
      strictEqual(nothingStated.url, address);
    })
  );

  it.effect(
    "loadOntology with a selection does not read the inclusions: the selection states its own in the body",
    Effect.fnUntraced(function* () {
      const selection = OntologySelection.make({
        actionTypes: [ActionTypeApiName.make("promoteEmployeeObject")],
        includeActionTypeDefinitions: O.some(true),
      });
      const [, sent] = yield* exchange(json(200, ontologyWire), (transport) =>
        transport.loadOntology(O.some(selection), OntologyInclusions.make({ includeDatasources: O.some(true) }))
      );
      deepStrictEqual(sent, {
        method: "POST",
        url: `${origin}/v2/ontologies/default-ontology/metadata?branch=feature-1&preview=true`,
        authorization,
        contentType: "application/json",
        body: {
          objectTypes: [],
          linkTypes: [],
          actionTypes: ["promoteEmployeeObject"],
          queryTypes: [],
          interfaceTypes: [],
          includeActionTypeFullMetadata: true,
        },
      });
    })
  );

  it.effect(
    "loadOntology with a selection posts the names it wants",
    Effect.fnUntraced(function* () {
      const selection = OntologySelection.make({
        objectTypes: [ObjectTypeApiName.make("Employee")],
        queryTypes: [VersionedQueryApiName.make("addOne:0.0.9")],
      });
      const [ontology, sent] = yield* exchange(json(200, ontologyWire), (transport) =>
        transport.loadOntology(O.some(selection))
      );
      deepStrictEqual(sent, {
        method: "POST",
        url: `${origin}/v2/ontologies/default-ontology/metadata?branch=feature-1&preview=true`,
        authorization,
        contentType: "application/json",
        body: {
          objectTypes: ["Employee"],
          linkTypes: [],
          actionTypes: [],
          queryTypes: ["addOne:0.0.9"],
          interfaceTypes: [],
        },
      });
      strictEqual(ontology.identity.displayName, "Ontology");
    })
  );

  it.effect(
    "loadObjects posts the load request, decodes the envelope and hands the rows on as the records that arrived",
    Effect.fnUntraced(function* () {
      const [page, sent] = yield* exchange(json(200, pageWire), (transport) => transport.loadObjects(loadRequest));
      deepStrictEqual(sent, {
        method: "POST",
        url: `${origin}/v2/ontologies/default-ontology/objectSets/loadObjects?branch=feature-1&transactionId=txn-42&scenarioRid=ri.scenario.1`,
        authorization,
        contentType: "application/json",
        body: loadRequestWire,
      });
      deepStrictEqual(
        A.map(page.data, (row) => [row.__apiName, row.__primaryKey]),
        [["Employee", 50030]]
      );
      // The port does not read a row: what the facade decodes is the record the platform sent, key for key.
      deepStrictEqual<unknown>(page.data, pageWire.data);
      assertSome(page.nextPageToken, PageToken.make("v1.next"));
      strictEqual(page.totalCount, BigInt(2));
    })
  );

  it.effect(
    "loadLinks posts the link request with the preview switch and without transaction or scenario",
    Effect.fnUntraced(function* () {
      const request = LoadLinksRequest.make({
        objectSet: employees,
        linkTypes: [LinkTypeApiName.make("officeLink")],
      });
      const linksWire = {
        data: [
          {
            sourceObject: { __apiName: "Employee", __primaryKey: 50030 },
            linkedObjects: [{ targetObject: { __apiName: "Office", __primaryKey: "NYC" }, linkType: "officeLink" }],
          },
        ],
        nextPageToken: "v1.next",
      };
      const [page, sent] = yield* exchange(json(200, linksWire), (transport) => transport.loadLinks(request));
      deepStrictEqual(sent, {
        method: "POST",
        url: `${origin}/v2/ontologies/default-ontology/objectSets/loadLinks?branch=feature-1&preview=true`,
        authorization,
        contentType: "application/json",
        body: { objectSet: { type: "base", objectType: "Employee" }, links: ["officeLink"] },
      });
      strictEqual(page.data.length, 1);
      assertSome(page.nextPageToken, PageToken.make("v1.next"));
    })
  );

  it.effect(
    "aggregate posts the aggregation and decodes its rows",
    Effect.fnUntraced(function* () {
      const request = AggregateObjectSetRequest.make({
        objectSet: employees,
        aggregations: [count()],
        groupBy: [exact(PropertyApiName.make("team"), {})],
      });
      const answer = {
        accuracy: "APPROXIMATE",
        data: [{ group: { team: "platform" }, metrics: [{ name: "count", value: 12 }] }],
      };
      const [response, sent] = yield* exchange(json(200, answer), (transport) => transport.aggregate(request));
      deepStrictEqual(sent, {
        method: "POST",
        url: `${origin}/v2/ontologies/default-ontology/objectSets/aggregate?branch=feature-1&transactionId=txn-42&scenarioRid=ri.scenario.1`,
        authorization,
        contentType: "application/json",
        body: {
          objectSet: { type: "base", objectType: "Employee" },
          aggregation: [{ type: "count", name: "count" }],
          groupBy: [{ type: "exact", field: "team" }],
        },
      });
      deepStrictEqual([response.accuracy, response.data.length], ["approximate", 1]);
    })
  );

  it.effect(
    "applyAction posts the arguments with the options spelled out",
    Effect.fnUntraced(function* () {
      const request = ApplyActionRequest.make({
        parameters: { [officeId]: O.some("NYC"), [ParameterId.make("capacity")]: O.none() },
      });
      const [response, sent] = yield* exchange(json(200, {}), (transport) => transport.applyAction(promote, request));
      deepStrictEqual(sent, {
        method: "POST",
        url: `${origin}/v2/ontologies/default-ontology/actions/promote-employee/apply?branch=feature-1&transactionId=txn-42&scenarioRid=ri.scenario.1`,
        authorization,
        contentType: "application/json",
        body: {
          parameters: { officeId: "NYC", capacity: null },
          options: { mode: "VALIDATE_AND_EXECUTE", returnEdits: "NONE" },
        },
      });
      assertNone(response.validation);
      assertNone(response.edits);
    })
  );

  it.effect(
    "validateAction is the apply route in validate-only mode, answered with the validation",
    Effect.fnUntraced(function* () {
      const answer = {
        validation: {
          result: "INVALID",
          submissionCriteria: [],
          parameters: { officeId: { result: "INVALID", evaluatedConstraints: [], required: true } },
        },
      };
      const [validation, sent] = yield* exchange(json(200, answer), (transport) =>
        transport.validateAction(promote, { [officeId]: O.some("XXX") })
      );
      deepStrictEqual(sent, {
        method: "POST",
        url: `${origin}/v2/ontologies/default-ontology/actions/promote-employee/apply?branch=feature-1&transactionId=txn-42&scenarioRid=ri.scenario.1`,
        authorization,
        contentType: "application/json",
        body: {
          parameters: { officeId: "XXX" },
          options: { mode: "VALIDATE_ONLY", returnEdits: "NONE" },
        },
      });
      deepStrictEqual([validation.result, R.keys(validation.parameters)], ["invalid", ["officeId"]]);
    })
  );

  it.effect(
    "validateAction reports an answer without a validation as unreadable",
    Effect.fnUntraced(function* () {
      const [failure] = yield* exchange(json(200, {}), (transport) =>
        Effect.flip(transport.validateAction(promote, { [officeId]: O.some("NYC") }))
      );
      deepStrictEqual(
        [failure._tag, failure.message],
        ["DecodeError", "A validate-only application was answered without a validation"]
      );
    })
  );

  it.effect(
    "applyActionBatch posts every application and sends no transaction",
    Effect.fnUntraced(function* () {
      const request = BatchApplyActionRequest.make({
        requests: [
          BatchApplyActionItem.make({ parameters: { [officeId]: O.some("NYC") } }),
          BatchApplyActionItem.make({ parameters: { [officeId]: O.some("SEA") } }),
        ],
      });
      const [response, sent] = yield* exchange(json(200, {}), (transport) =>
        transport.applyActionBatch(promote, request)
      );
      deepStrictEqual(sent, {
        method: "POST",
        url: `${origin}/v2/ontologies/default-ontology/actions/promote-employee/applyBatch?branch=feature-1&scenarioRid=ri.scenario.1`,
        authorization,
        contentType: "application/json",
        body: {
          requests: [{ parameters: { officeId: "NYC" } }, { parameters: { officeId: "SEA" } }],
          options: { returnEdits: "NONE" },
        },
      });
      assertNone(response.edits);
    })
  );

  it.effect(
    "executeQuery names the version as a query parameter",
    Effect.fnUntraced(function* () {
      const request = ExecuteQueryRequest.make({ parameters: { [ParameterId.make("n")]: 1 } });
      const [response, sent] = yield* exchange(json(200, { value: 2 }), (transport) =>
        transport.executeQuery(QueryApiName.make("addOne"), request, O.some(FunctionVersion.make("0.0.9")))
      );
      deepStrictEqual(sent, {
        method: "POST",
        url: `${origin}/v2/ontologies/default-ontology/queries/addOne/execute?version=0.0.9&branch=feature-1&transactionId=txn-42&scenarioRid=ri.scenario.1`,
        authorization,
        contentType: "application/json",
        body: { parameters: { n: 1 } },
      });
      strictEqual(response.value, 2);
    })
  );

  it.effect(
    "uploadAttachment posts the bytes as they are and names the file in the query",
    Effect.fnUntraced(function* () {
      const content = new Uint8Array([37, 80, 68, 70]);
      const answer = {
        rid: "ri.attachments.main.attachment.bb32154e-e043-4b00-9461-93136ca96b6f",
        filename: "report.pdf",
        sizeBytes: "4",
        mediaType: "application/pdf",
      };
      const [metadata, sent] = yield* exchange(json(200, answer), (transport) =>
        transport.uploadAttachment(AttachmentUpload.make({ filename: Filename.make("report.pdf") }), content)
      );
      deepStrictEqual(sent, {
        method: "POST",
        url: `${origin}/v2/ontologies/attachments/upload?filename=report.pdf`,
        authorization,
        contentType: "application/octet-stream",
        body: content,
      });
      deepStrictEqual(
        [metadata.rid, metadata.filename, metadata.sizeBytes, metadata.mediaType],
        [answer.rid, "report.pdf", BigInt(4), "application/pdf"]
      );
    })
  );

  it.effect(
    "readAttachment gets the content as bytes, whatever its media type",
    Effect.fnUntraced(function* () {
      const content = new Uint8Array([137, 80, 78, 71]);
      const rid = AttachmentRid.make("ri.attachments.main.attachment.bb32154e-e043-4b00-9461-93136ca96b6f");
      const [received, sent] = yield* exchange(bytes(content, "image/png"), (transport) =>
        transport.readAttachment(rid)
      );
      deepStrictEqual(sent, {
        method: "GET",
        url: `${origin}/v2/ontologies/attachments/${rid}/content`,
        authorization,
        contentType: null,
        body: null,
      });
      deepStrictEqual(received, content);
    })
  );

  // -------------------------------------------------------------------------
  // Failures
  // -------------------------------------------------------------------------

  it.effect(
    "an error body becomes an ApiError that carries the status of the response",
    Effect.fnUntraced(function* () {
      const [failure] = yield* exchange(json(404, notFoundWire), (transport) =>
        Effect.flip(transport.loadObjects(loadRequest))
      );
      assertTrue(failure._tag === "ApiError");
      if (failure._tag === "ApiError") {
        deepStrictEqual(
          [failure.status, failure.errorCode, failure.errorName, failure.errorInstanceId, failure.parameters],
          [404, "NOT_FOUND", "ObjectTypeNotFound", "b2ae7b3e-2c89-42f5-a762-68957a9c039d", { objectType: "Employe" }]
        );
        assertNone(failure.errorDescription);
      }
      // The status is the response's, whichever it is: the declaration files the body under one status only.
      const statuses = yield* Effect.forEach([400, 409, 429, 500, 503], (status) =>
        Effect.map(
          exchange(json(status, notFoundWire), (transport) => Effect.flip(transport.loadOntology(O.none()))),
          ([refusal]) => (refusal._tag === "ApiError" ? refusal.status : refusal._tag)
        )
      );
      deepStrictEqual(statuses, [400, 409, 429, 500, 503]);
    })
  );

  it.effect(
    "an answer outside 2xx without an error body becomes a TransportError",
    Effect.fnUntraced(function* () {
      const [bare] = yield* exchange(empty(500), (transport) => Effect.flip(transport.loadObjects(loadRequest)));
      deepStrictEqual(
        [bare._tag, bare.message],
        ["TransportError", "The platform answered HTTP 500 without an error body"]
      );
      const [gateway] = yield* exchange(text(502, "<html>Bad Gateway</html>", "text/html"), (transport) =>
        Effect.flip(
          transport.aggregate(AggregateObjectSetRequest.make({ objectSet: employees, aggregations: [count()] }))
        )
      );
      deepStrictEqual(
        [gateway._tag, gateway.message],
        ["TransportError", "The platform answered HTTP 502 without an error body"]
      );
      const [redirect] = yield* exchange(empty(304), (transport) => Effect.flip(transport.loadOntology(O.none())));
      strictEqual(redirect._tag, "TransportError");
    })
  );

  it.effect(
    "a success body that cannot be read becomes a DecodeError",
    Effect.fnUntraced(function* () {
      const [cut] = yield* exchange(text(200, '{"data": [', "application/json"), (transport) =>
        Effect.flip(transport.loadObjects(loadRequest))
      );
      strictEqual(cut._tag, "DecodeError");
      const [misshapen] = yield* exchange(json(200, { data: "not a list", totalCount: "2" }), (transport) =>
        Effect.flip(transport.loadObjects(loadRequest))
      );
      strictEqual(misshapen._tag, "DecodeError");
      assertTrue("cause" in misshapen && S.isSchemaError(misshapen.cause));
      const [undeclared] = yield* exchange(empty(204), (transport) => Effect.flip(transport.loadObjects(loadRequest)));
      strictEqual(undeclared._tag, "DecodeError");
    })
  );

  it.effect(
    "a connection that fails becomes a TransportError that carries what the transport raised",
    Effect.fnUntraced(function* () {
      const [failure, sent] = yield* exchange(unreachable, (transport) =>
        Effect.flip(transport.loadObjects(loadRequest))
      );
      strictEqual(failure._tag, "TransportError");
      assertTrue("cause" in failure && failure.cause === refusedConnection);
      assertTrue(
        Str.includes("POST https://stack.example.com/v2/ontologies/default-ontology/objectSets/loadObjects")(
          failure.message
        )
      );
      // The request was built and handed to the client before the connection failed.
      strictEqual(sent.authorization, authorization);
    })
  );

  // -------------------------------------------------------------------------
  // The token, the logs and the spans
  // -------------------------------------------------------------------------

  it.effect(
    "the token travels in the Authorization header and in no failure",
    Effect.fnUntraced(function* () {
      const replies = [
        json(404, notFoundWire),
        empty(500),
        text(200, '{"data": [', "application/json"),
        json(200, { data: "not a list" }),
        unreachable,
      ];
      const outcomes = yield* Effect.forEach(replies, (reply) =>
        exchange(reply, (transport) => Effect.flip(transport.loadObjects(loadRequest)))
      );
      deepStrictEqual(
        A.map(outcomes, ([failure, sent]) => [failure._tag, sent.authorization]),
        [
          ["ApiError", authorization],
          ["TransportError", authorization],
          ["DecodeError", authorization],
          ["DecodeError", authorization],
          ["TransportError", authorization],
        ]
      );
      const texts = yield* Effect.forEach(outcomes, ([failure]) => rendered(failure));
      deepStrictEqual(A.map(texts, mentionsToken), [false, false, false, false, false]);
      // No failure keeps the HTTP error it came from, because that error holds the request and its headers.
      deepStrictEqual(
        A.map(outcomes, ([failure]) => "cause" in failure && HttpClientError.isHttpClientError(failure.cause)),
        [false, false, false, false, false]
      );
    })
  );

  it.effect(
    "each call logs its endpoint and ontology, and its failure when it has one, without the token",
    Effect.fnUntraced(function* () {
      // The transport's lines inherit the annotations of the fiber that calls it, which is how this
      // test tells its own lines from those of the tests running beside it.
      const mine = Effect.annotateLogs({ "test.case": "logs" });
      yield* exchange(json(200, pageWire), (transport) => mine(transport.loadObjects(loadRequest)));
      yield* exchange(json(404, notFoundWire), (transport) =>
        transport.loadObjects(loadRequest).pipe(Effect.flip, mine)
      );
      const everyLine = MutableRef.get(logged);
      const lines = A.filter(everyLine, (line) => line.annotations["test.case"] === "logs");
      deepStrictEqual(
        A.map(lines, (line) => [line.level, line.message, line.annotations]),
        [
          [
            "DEBUG",
            "The platform answered",
            { "test.case": "logs", "foundry.endpoint": "objectSets.load", "foundry.ontology": "default-ontology" },
          ],
          [
            "WARN",
            "The platform request failed",
            {
              "test.case": "logs",
              "foundry.endpoint": "objectSets.load",
              "foundry.ontology": "default-ontology",
              "foundry.failure": "ApiError",
              "foundry.reason":
                "ObjectTypeNotFound (NOT_FOUND, HTTP 404, instance b2ae7b3e-2c89-42f5-a762-68957a9c039d)",
            },
          ],
        ]
      );
      assertFalse(A.some(everyLine, (line) => mentionsToken(Formatter.format(line))));
    })
  );

  it.effect(
    "each call runs in a span named after the member, annotated with the endpoint and the ontology",
    Effect.fnUntraced(function* () {
      // A span of this test's own, so that the spans opened under it can be told from the others.
      yield* exchange(json(200, { value: 2 }), (transport) =>
        Effect.withSpan(
          transport.executeQuery(QueryApiName.make("addOne"), ExecuteQueryRequest.make({}), O.none()),
          "Api.test.observed"
        )
      );
      const opened = MutableRef.get(spans);
      const under = (parent: Tracer.Span) =>
        A.filter(opened, (span) => O.exists(span.parent, (above) => above.spanId === parent.spanId));
      const members = A.flatMap(
        A.filter(opened, (span) => span.name === "Api.test.observed"),
        under
      );
      deepStrictEqual(
        A.map(members, (span) => [span.name, R.fromEntries(span.attributes)]),
        [
          [
            "OntologyTransport.executeQuery",
            { "foundry.endpoint": "queries.execute", "foundry.ontology": "default-ontology" },
          ],
        ]
      );
      // The HTTP client opens its own span under the member's. No span of any test says the token.
      assertTrue(A.isArrayNonEmpty(A.flatMap(members, under)));
      assertFalse(A.some(opened, (span) => mentionsToken(Formatter.format(R.fromEntries(span.attributes)))));
    })
  );
});

// ---------------------------------------------------------------------------
// A scope that names only an ontology
// ---------------------------------------------------------------------------

it.layer(transportIn(byRid))("the HTTP transport, scoped to an ontology only", (it) => {
  it.effect(
    "sends no branch, transaction or scenario, and addresses the ontology by its resource identifier",
    Effect.fnUntraced(function* () {
      const [, loaded] = yield* exchange(json(200, pageWire), (transport) => transport.loadObjects(loadRequest));
      const [, executed] = yield* exchange(json(200, { value: 2 }), (transport) =>
        transport.executeQuery(QueryApiName.make("addOne"), ExecuteQueryRequest.make({}), O.none())
      );
      const [, described] = yield* exchange(json(200, ontologyWire), (transport) => transport.loadOntology(O.none()));
      deepStrictEqual(
        [loaded.url, executed.url, described.url],
        [
          `${origin}/v2/ontologies/${ontologyRid}/objectSets/loadObjects`,
          `${origin}/v2/ontologies/${ontologyRid}/queries/addOne/execute`,
          `${origin}/v2/ontologies/${ontologyRid}/fullMetadata`,
        ]
      );
      deepStrictEqual(executed.body, { parameters: {} });
    })
  );
});
