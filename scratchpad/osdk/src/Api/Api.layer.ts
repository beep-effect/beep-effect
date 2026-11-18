/**
 * The transport over HTTP: where the platform is, how to authenticate, and the port implemented on top of both.
 *
 * **Details**
 *
 * OSDK's client is built from a base URL, a token provider and a `fetch`, and
 * every call threads the three through `foundryPlatformFetch`. Here they are
 * three services. {@link FoundryConnection} says where the platform is and
 * which token opens it. The ambient `HttpClient` of `effect/http` sends the
 * requests, so retries, timeouts, proxies and test doubles are decided by
 * whoever provides it. `OntologyContext` says which ontology, branch,
 * transaction and scenario the requests address.
 *
 * {@link HttpOntologyTransport} derives a client from the declared routes
 * (`OntologyApi`) and implements `OntologyTransport` with it. No path, method
 * or body shape is written here: they all come from the declaration.
 *
 * Every failure of a call lands in one of three typed errors:
 *
 * | What happened | Error |
 * | --- | --- |
 * | The platform answered outside 2xx with its error body | `ApiError`, with the status of the response |
 * | The connection failed, the address was invalid, or an answer outside 2xx carried no error body | `TransportError`, with what the underlying transport raised |
 * | A body did not match its schema, going out or coming in | `DecodeError`, with the schema failure |
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import { identity } from "effect/Function";
import * as HttpClient from "effect/http/HttpClient";
import type * as HttpClientError from "effect/http/HttpClientError";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import type * as HttpClientResponse from "effect/http/HttpClientResponse";
import * as HttpIncomingMessage from "effect/http/HttpIncomingMessage";
import * as HttpApiClient from "effect/http-api/HttpApiClient";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import type {
  ActionArguments,
  ActionValidation,
  ApplyActionResponse,
  BatchApplyActionRequest,
} from "../Action/Action.model.ts";
import { ApplyActionOptions, ApplyActionRequest } from "../Action/Action.model.ts";
import type { AttachmentUpload } from "../Attachment/Attachment.model.ts";
import type { TransportFailure } from "../Client/Client.errors.ts";
import { ApiError, ApiErrorBody, DecodeError, HttpStatus, TransportError } from "../Client/Client.errors.ts";
import type { AggregateObjectSetRequest, LoadObjectsRequest } from "../Client/Client.model.ts";
import { OntologyContext, OntologyTransport } from "../Client/Client.service.ts";
import type {
  ActionTypeApiName,
  AttachmentRid,
  FunctionVersion,
  QueryApiName,
} from "../Identifier/Identifier.model.ts";
import type { LoadLinksRequest } from "../Link/Link.model.ts";
import { OntologyInclusions } from "../Ontology/Ontology.model.ts";
import type { OntologySelection } from "../Ontology/Ontology.model.ts";
import type { ExecuteQueryRequest } from "../Query/Query.model.ts";
import { OntologyApi } from "./Api.definition.ts";

const $I = $ScratchpadId.create("osdk/Api/Api.layer");

// -----------------------------------------------------------------------------
// Where the platform is
// -----------------------------------------------------------------------------

/**
 * Where a Foundry stack is and the token that opens it.
 *
 * **Details**
 *
 * `baseUrl` is the origin every route is appended to. `token` is a bearer
 * token, kept as a `Redacted` value: it prints as `<redacted>`, it never
 * reaches a log, a span or an error of this library, and the schema refuses to
 * encode it, so a settings value cannot be written back out with its secret.
 *
 * **Example** (Read the settings of a stack)
 *
 * ```ts import.meta.vitest name="Read the settings of a stack"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { FoundryConnectionSettings } from "@beep/scratchpad/osdk/src/Api/index"
 *
 * const settings = await Effect.runPromise(
 *   S.decodeUnknownEffect(FoundryConnectionSettings)({ baseUrl: "https://stack.example.com", token: "not-a-real-token" })
 * )
 * const facts = [settings.baseUrl.host, `${settings.token}`]
 * facts // => ["stack.example.com", "<redacted>"]
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export class FoundryConnectionSettings extends S.Opaque<FoundryConnectionSettings, { readonly brand: unique symbol }>()(
  S.Struct({
    baseUrl: S.URLFromString.annotateKey({
      description: "Origin of the Foundry stack that every route is appended to.",
    }),
    token: S.RedactedFromValue(S.NonEmptyString, { disallowEncode: true }).annotateKey({
      description: "Bearer token sent with every request; never logged and never encoded.",
    }),
  }).pipe(
    $I.annoteSchema("FoundryConnectionSettings", {
      description: "Where a Foundry stack is and the token that opens it.",
    })
  )
) {}

/**
 * The Foundry stack a transport talks to, and the token it presents.
 *
 * **Details**
 *
 * The service is a value, a {@link FoundryConnectionSettings}. Provide a
 * different one to send the same program to another stack or under another
 * identity.
 *
 * **Example** (Read the stack a program talks to)
 *
 * ```ts import.meta.vitest name="Read the stack a program talks to"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { FoundryConnection, FoundryConnectionSettings } from "@beep/scratchpad/osdk/src/Api/index"
 *
 * const settings = await Effect.runPromise(
 *   S.decodeUnknownEffect(FoundryConnectionSettings)({ baseUrl: "https://stack.example.com", token: "not-a-real-token" })
 * )
 * const origin = Effect.map(FoundryConnection, ({ baseUrl }) => baseUrl.origin)
 * const answer = await Effect.runPromise(Effect.provideService(origin, FoundryConnection, settings))
 * answer // => "https://stack.example.com"
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class FoundryConnection extends Context.Service<FoundryConnection, FoundryConnectionSettings>()(
  $I`FoundryConnection`
) {}

// -----------------------------------------------------------------------------
// Failures
// -----------------------------------------------------------------------------

// Everything a call through the derived client can fail with: the three typed failures this module
// raises itself, the two failures of the HTTP modules, and the declared error body.
type DerivedFailure =
  | ApiError
  | TransportError
  | DecodeError
  | HttpClientError.HttpClientError
  | S.SchemaError
  | ApiErrorBody;

// The status the declaration files the error body under: an error declared without a status
// annotation answers 500. A declared error has one status, while the platform sends the body
// with many, which is why `refuseErrorAnswer` reads the real one.
const declaredErrorStatus = 500;

const decodeErrorBody = HttpIncomingMessage.schemaBodyJson(ApiErrorBody);
const decodeStatus = S.decodeEffect(HttpStatus);

// What the HTTP modules raised, without the request they raised it for. The request carries the
// `Authorization` header, so it must not travel inside an error of this library.
const withoutRequest = (error: HttpClientError.HttpClientError): unknown =>
  P.isNotUndefined(error.cause) ? error.cause : error.message;

const unreached = (error: HttpClientError.HttpClientError): TransportError =>
  TransportError.make({ message: error.message, cause: withoutRequest(error) });

const unreadable = (error: HttpClientError.HttpClientError | S.SchemaError): DecodeError =>
  DecodeError.make({ message: error.message, cause: S.isSchemaError(error) ? error : withoutRequest(error) });

const fromHttpClientError = (error: HttpClientError.HttpClientError): TransportFailure =>
  Match.valueTags(error.reason, {
    TransportError: () => unreached(error),
    InvalidUrlError: () => unreached(error),
    StatusCodeError: () => unreached(error),
    EncodeError: () => unreadable(error),
    DecodeError: () => unreadable(error),
    EmptyBodyError: () => unreadable(error),
  });

const toTransportFailure: (error: DerivedFailure) => TransportFailure = Match.type<DerivedFailure>().pipe(
  Match.tags({
    ApiError: identity<ApiError>,
    TransportError: identity<TransportError>,
    DecodeError: identity<DecodeError>,
    HttpClientError: fromHttpClientError,
    SchemaError: unreadable,
  }),
  // Not reached while `refuseErrorAnswer` reads every answer outside 2xx first; kept so the mapping
  // is total over what the derived client declares.
  Match.orElse((body) => ApiError.fromBody(declaredErrorStatus, body))
);

// A read of the whole ontology that states no inclusion: both are left to the platform.
const nothingStated = OntologyInclusions.make({});

// Turns an answer outside 2xx into a failure: an `ApiError` when it carries the platform's error
// body, a `TransportError` when it does not (a gateway answering for a platform that is down).
const refuseErrorAnswer = Effect.fnUntraced(function* (response: HttpClientResponse.HttpClientResponse) {
  if (response.status >= 200 && response.status < 300) {
    return response;
  }
  const [status, body] = yield* Effect.all([decodeStatus(response.status), decodeErrorBody(response)]).pipe(
    Effect.mapError((error) =>
      TransportError.make({
        message: `The platform answered HTTP ${response.status} without an error body`,
        cause: S.isSchemaError(error) ? error : withoutRequest(error),
      })
    )
  );
  return yield* ApiError.fromBody(status, body);
});

const requireValidation = (response: ApplyActionResponse): Effect.Effect<ActionValidation, DecodeError> =>
  Effect.fromOption(response.validation, () =>
    DecodeError.make({
      message: "A validate-only application was answered without a validation",
      cause: "validation",
    })
  );

// -----------------------------------------------------------------------------
// The layer
// -----------------------------------------------------------------------------

/**
 * The transport over HTTP: every member of the port sent through the declared routes.
 *
 * **Details**
 *
 * The layer reads three services when it is built. `FoundryConnection` gives
 * the origin and the bearer token, `OntologyContext` the ontology of the route
 * and the `branch`, `transactionId` and `scenarioRid` query parameters, and
 * `HttpClient` sends the requests. Each query parameter is sent only on the
 * routes that accept it: `applyActionBatch` sends no transaction, `loadLinks`
 * sends neither transaction nor scenario, and the attachment routes name no
 * ontology at all.
 *
 * Some members do not have a route of their own:
 *
 * - `loadOntology` uses `GET fullMetadata` without a selection and
 *   `POST metadata` with one. The first carries the inclusions the caller
 *   states as `includeActionTypeFullMetadata` and `includeDatasources`, and
 *   neither parameter when none is stated. The second and `loadLinks` are sent
 *   with `preview=true`, as OSDK sends them.
 * - `validateAction` is `POST apply` with the mode `VALIDATE_ONLY`. An answer
 *   without a validation is a `DecodeError`.
 *
 * Each member runs in a span named after it (`OntologyTransport.loadObjects`
 * and so on) that carries the endpoint and the ontology as attributes, and
 * writes one structured log line when the platform answers or the call fails.
 * The token is in neither.
 *
 * **Gotchas**
 *
 * The scope is read once, when the layer is built. To address another
 * ontology or branch, build the layer again with another `OntologyContext`.
 *
 * **Example** (Call a query through a stubbed HTTP client)
 *
 * ```ts import.meta.vitest name="Call a query through a stubbed HTTP client"
 * import * as Effect from "effect/Effect"
 * import * as HttpClient from "effect/http/HttpClient"
 * import * as HttpClientResponse from "effect/http/HttpClientResponse"
 * import * as Layer from "effect/Layer"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { FoundryConnection, FoundryConnectionSettings, HttpOntologyTransport } from "@beep/scratchpad/osdk/src/Api/index"
 * import { OntologyContext, OntologyScope, OntologyTransport } from "@beep/scratchpad/osdk/src/Client/index"
 * import { OntologyApiName, QueryApiName } from "@beep/scratchpad/osdk/src/Identifier/index"
 * import { ExecuteQueryRequest } from "@beep/scratchpad/osdk/src/Query/index"
 *
 * const settings = await Effect.runPromise(
 *   S.decodeUnknownEffect(FoundryConnectionSettings)({ baseUrl: "https://stack.example.com", token: "not-a-real-token" })
 * )
 * const Platform = Layer.succeed(
 *   HttpClient.HttpClient,
 *   HttpClient.make((request) => Effect.succeed(HttpClientResponse.fromWeb(request, Response.json({ value: 42 }))))
 * )
 * const Transport = HttpOntologyTransport.pipe(
 *   Layer.provide(
 *     Layer.mergeAll(
 *       Platform,
 *       Layer.succeed(FoundryConnection, settings),
 *       Layer.succeed(OntologyContext, OntologyScope.make({ ontology: OntologyApiName.make("default-ontology") }))
 *     )
 *   )
 * )
 * const program = Effect.gen(function* () {
 *   const transport = yield* OntologyTransport
 *   const answer = yield* transport.executeQuery(QueryApiName.make("answer"), ExecuteQueryRequest.make({}), O.none())
 *   return answer.value
 * })
 * const value = await Effect.runPromise(
 *   Effect.scoped(Effect.flatMap(Layer.build(Transport), (context) => Effect.provide(program, context)))
 * )
 * value // => 42
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const HttpOntologyTransport: Layer.Layer<
  OntologyTransport,
  never,
  FoundryConnection | OntologyContext | HttpClient.HttpClient
> = Layer.effect(
  OntologyTransport,
  Effect.gen(function* () {
    const connection = yield* FoundryConnection;
    const scope = yield* OntologyContext;
    const ambient = yield* HttpClient.HttpClient;

    const client = yield* HttpApiClient.makeWith(OntologyApi, {
      baseUrl: connection.baseUrl,
      httpClient: ambient.pipe(
        HttpClient.mapRequest(HttpClientRequest.bearerToken(connection.token)),
        HttpClient.transformResponse(Effect.flatMap(refuseErrorAnswer))
      ),
    });

    const { ontology, branch } = scope;
    const preview = O.some(true);
    const scoped = { branch, transactionId: scope.transaction, scenarioRid: scope.scenario };

    // Runs one request of the derived client inside the current span: names the endpoint and the
    // ontology on the span and on the log lines, and folds every failure into a `TransportFailure`.
    const dispatch = <A>(
      endpoint: string,
      request: Effect.Effect<A, DerivedFailure>
    ): Effect.Effect<A, TransportFailure> =>
      Effect.annotateCurrentSpan({ "foundry.endpoint": endpoint, "foundry.ontology": ontology }).pipe(
        Effect.andThen(request),
        Effect.mapError(toTransportFailure),
        Effect.tap(() => Effect.logDebug("The platform answered")),
        Effect.tapError((failure) =>
          Effect.logWarning("The platform request failed").pipe(
            Effect.annotateLogs({ "foundry.failure": failure._tag, "foundry.reason": failure.message })
          )
        ),
        Effect.annotateLogs({ "foundry.endpoint": endpoint, "foundry.ontology": ontology })
      );

    return OntologyTransport.of({
      loadOntology: Effect.fn("OntologyTransport.loadOntology")(function* (
        selection: O.Option<OntologySelection>,
        inclusions: OntologyInclusions = nothingStated
      ) {
        return yield* O.match(selection, {
          onNone: () =>
            dispatch(
              "ontologies.getFullMetadata",
              client.ontologies.getFullMetadata({
                params: { ontology },
                query: {
                  branch,
                  includeActionTypeFullMetadata: inclusions.includeActionTypeDefinitions,
                  includeDatasources: inclusions.includeDatasources,
                },
              })
            ),
          onSome: (payload) =>
            dispatch(
              "ontologies.loadMetadata",
              client.ontologies.loadMetadata({ params: { ontology }, query: { branch, preview }, payload })
            ),
        });
      }),
      loadObjects: Effect.fn("OntologyTransport.loadObjects")(function* (payload: LoadObjectsRequest) {
        return yield* dispatch(
          "objectSets.load",
          client.objectSets.load({ params: { ontology }, query: scoped, payload })
        );
      }),
      loadLinks: Effect.fn("OntologyTransport.loadLinks")(function* (payload: LoadLinksRequest) {
        return yield* dispatch(
          "objectSets.loadLinks",
          client.objectSets.loadLinks({ params: { ontology }, query: { branch, preview }, payload })
        );
      }),
      aggregate: Effect.fn("OntologyTransport.aggregate")(function* (payload: AggregateObjectSetRequest) {
        return yield* dispatch(
          "objectSets.aggregate",
          client.objectSets.aggregate({ params: { ontology }, query: scoped, payload })
        );
      }),
      applyAction: Effect.fn("OntologyTransport.applyAction")(function* (
        action: ActionTypeApiName,
        payload: ApplyActionRequest
      ) {
        return yield* dispatch(
          "actions.apply",
          client.actions.apply({ params: { ontology, action }, query: scoped, payload })
        );
      }),
      validateAction: Effect.fn("OntologyTransport.validateAction")(function* (
        action: ActionTypeApiName,
        parameters: ActionArguments
      ) {
        const payload = ApplyActionRequest.make({
          parameters,
          options: ApplyActionOptions.make({ mode: "validateOnly" }),
        });
        return yield* dispatch(
          "actions.apply",
          Effect.flatMap(
            client.actions.apply({ params: { ontology, action }, query: scoped, payload }),
            requireValidation
          )
        );
      }),
      applyActionBatch: Effect.fn("OntologyTransport.applyActionBatch")(function* (
        action: ActionTypeApiName,
        payload: BatchApplyActionRequest
      ) {
        return yield* dispatch(
          "actions.applyBatch",
          client.actions.applyBatch({
            params: { ontology, action },
            query: { branch, scenarioRid: scope.scenario },
            payload,
          })
        );
      }),
      executeQuery: Effect.fn("OntologyTransport.executeQuery")(function* (
        queryApiName: QueryApiName,
        payload: ExecuteQueryRequest,
        version: O.Option<FunctionVersion>
      ) {
        return yield* dispatch(
          "queries.execute",
          client.queries.execute({ params: { ontology, queryApiName }, query: { version, ...scoped }, payload })
        );
      }),
      uploadAttachment: Effect.fn("OntologyTransport.uploadAttachment")(function* (
        query: AttachmentUpload,
        payload: Uint8Array
      ) {
        return yield* dispatch("attachments.upload", client.attachments.upload({ query, payload }));
      }),
      readAttachment: Effect.fn("OntologyTransport.readAttachment")(function* (attachmentRid: AttachmentRid) {
        return yield* dispatch("attachments.read", client.attachments.read({ params: { attachmentRid } }));
      }),
    });
  })
);
