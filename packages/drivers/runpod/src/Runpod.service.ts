/**
 * Effect service for Runpod REST API v2 operations.
 *
 * @packageDocumentation
 * @since 0.1.0
 */

import { $RunpodId } from "@beep/identity";
import { A, O, Str } from "@beep/utils";
import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Sse from "effect/encoding/Sse";
import { pipe } from "effect/Function";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as SchemaGetter from "effect/SchemaGetter";
import * as Stream from "effect/Stream";
import * as G from "./_generated/Runpod.operations.gen.ts";
import { RUNPOD_API_URL, RunpodConfigInput, RunpodConfigUrl } from "./Runpod.config.ts";
import {
  RunpodError,
  RunpodErrorOptionsInput,
  RunpodHttpStatusCode,
  RunpodProblemFromProblemDetails,
  RunpodRawErrorOptions,
} from "./Runpod.errors.ts";
import type * as HttpClientError from "effect/http/HttpClientError";
import type * as HttpClientResponse from "effect/http/HttpClientResponse";
import type * as Redacted from "effect/Redacted";
import type * as SchemaAST from "effect/SchemaAST";
import type * as Models from "./_generated/Runpod.models.gen.ts";
import type { RunpodErrorReason } from "./Runpod.errors.ts";

const $I = $RunpodId.create("Runpod.service");
const normalizeRawPath = (path: string): string => (Str.startsWith("/")(path) ? path : `/${path}`);
const RunpodRawPath = S.String.pipe(
  S.decodeTo(S.String, {
    decode: SchemaGetter.transform(normalizeRawPath),
    encode: SchemaGetter.transform(normalizeRawPath),
  }),
  $I.annoteSchema("RunpodRawPath", {
    description: "Raw Runpod request path normalized with a leading slash.",
  })
);

/**
 * **Example** (Inspect query scalar AST)
 *
 * ```ts
 * import { RunpodQueryScalar } from "@beep/runpod"
 *
 * console.log(RunpodQueryScalar.ast)
 * ```
 *
 * @category models
 * @since 0.1.0
 */
export const RunpodQueryScalar = S.Union([S.Boolean, S.Finite, S.String]).pipe(
  $I.annoteSchema("RunpodQueryScalar", {
    description: "Scalar query values accepted by Runpod request models and raw requests.",
  })
);

/**
 * **Example** (Assign scalar query value)
 *
 * ```ts
 * import type { RunpodQueryScalar } from "@beep/runpod"
 *
 * const value: RunpodQueryScalar = "running"
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.1.0
 */
export type RunpodQueryScalar = typeof RunpodQueryScalar.Type;

const RunpodQueryScalarArray = S.Array(RunpodQueryScalar);

/**
 * **Example** (Inspect query value AST)
 *
 * ```ts
 * import { RunpodQueryValue } from "@beep/runpod"
 *
 * console.log(RunpodQueryValue.ast)
 * ```
 *
 * @category models
 * @since 0.1.0
 */
export const RunpodQueryValue = S.Union([RunpodQueryScalar, RunpodQueryScalarArray]).pipe(
  $I.annoteSchema("RunpodQueryValue", {
    description: "Query value accepted by the raw Runpod request escape hatch.",
  })
);

/**
 * **Example** (Assign array query value)
 *
 * ```ts
 * import type { RunpodQueryValue } from "@beep/runpod"
 *
 * const value: RunpodQueryValue = ["running", "stopped"]
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.1.0
 */
export type RunpodQueryValue = typeof RunpodQueryValue.Type;

const runpodRawRequestHeadersDefault = R.empty();
const runpodRawRequestQueryDefault = R.empty();
/**
 * **Details**
 *
 * `path` is relative to the configured base URL (`https://api.runpod.io/v2`
 * by default), so `/pods` addresses `https://api.runpod.io/v2/pods`.
 *
 * **Example** (Make raw GET request)
 *
 * ```ts
 * import { RunpodRawRequest } from "@beep/runpod"
 *
 * const request = RunpodRawRequest.make({
 *   method: "GET",
 *   path: "/catalog/gpus"
 * })
 * console.log(request.path)
 * ```
 *
 * @category models
 * @since 0.1.0
 */
export class RunpodRawRequest extends S.Opaque<RunpodRawRequest, { readonly brand: unique symbol }>()(
  S.Struct({
    authenticated: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(true)),
      S.withDecodingDefaultTypeKey(Effect.succeed(true))
    ),
    body: S.OptionFromOptionalKey(S.Unknown).pipe(S.withConstructorDefault(Effect.succeedNone)),
    headers: S.Record(S.String, S.String).pipe(
      S.withConstructorDefault(Effect.succeed(runpodRawRequestHeadersDefault)),
      S.withDecodingDefaultTypeKey(Effect.succeed(runpodRawRequestHeadersDefault))
    ),
    method: G.RunpodHttpMethod,
    path: RunpodRawPath,
    query: S.Record(S.String, RunpodQueryValue).pipe(
      S.withConstructorDefault(Effect.succeed(runpodRawRequestQueryDefault)),
      S.withDecodingDefaultTypeKey(Effect.succeed(runpodRawRequestQueryDefault))
    ),
  }).pipe(
    $I.annoteSchema("RunpodRawRequest", {
      description: "Raw Runpod HTTP request escape hatch for endpoints ahead of the checked-in OpenAPI document.",
    })
  )
) {}
const decodeRunpodRawRequest = S.decodeEffect(RunpodRawRequest);

/**
 * **Example** (Make raw HTTP response)
 *
 * ```ts
 * import { RunpodRawResponse } from "@beep/runpod"
 *
 * const response = RunpodRawResponse.make({
 *   headers: {},
 *   status: 200,
 *   text: "ok"
 * })
 * console.log(response.status)
 * ```
 *
 * @category models
 * @since 0.1.0
 */
export class RunpodRawResponse extends S.Opaque<RunpodRawResponse, { readonly brand: unique symbol }>()(
  S.Struct({
    body: S.optionalKey(S.Unknown),
    headers: S.Record(S.String, S.String),
    status: RunpodHttpStatusCode,
    text: S.optionalKey(S.String),
  }).pipe(
    $I.annoteSchema("RunpodRawResponse", {
      description: "Raw Runpod HTTP response returned by the raw escape hatch.",
    })
  )
) {}

/**
 * Public service shape for generated Runpod operations plus the raw request escape hatch.
 *
 * **Details**
 *
 * Every generated operation takes its `<Operation>Params` request and fails
 * with {@link RunpodError}. Cursor-paginated lists also expose a
 * `<method>Stream` member that follows `pagination.nextCursor` and emits the
 * items of every page. Log operations return a `Stream` of Server-Sent Events;
 * a server `retry:` directive ends that stream with a `transport` error, and
 * the caller resumes from the last event with the `lastEventId` request field.
 *
 * **Example** (Type raw request parameter)
 *
 * ```ts
 * import type { RunpodShape } from "@beep/runpod"
 * import { RunpodRawRequest } from "@beep/runpod"
 *
 * type RawRequest = Parameters<RunpodShape["raw"]>[0]
 *
 * const request: RawRequest = RunpodRawRequest.make({ method: "GET", path: "/catalog/gpus" })
 * console.log(request.path)
 * ```
 *
 * @category services
 * @since 0.1.0
 */
export interface RunpodShape extends G.RunpodOperationsShape<RunpodError> {
  readonly raw: (request: RunpodRawRequest) => Effect.Effect<RunpodRawResponse, RunpodError>;
}

class ResolvedRunpodConfig extends S.Opaque<ResolvedRunpodConfig, { readonly brand: unique symbol }>()(
  S.Struct({
    apiKey: S.String.pipe(S.Redacted, S.Option),
    apiUrl: S.String,
    headers: S.Record(S.String, S.String),
  }).pipe(
    $I.annoteSchema("ResolvedRunpodConfig", {
      description: "Resolved runtime configuration for the Runpod service.",
    })
  )
) {}

const RunpodUrlParamValue = S.Union([S.String, S.Array(S.String)]).pipe(
  $I.annoteSchema("RunpodUrlParamValue", {
    description: "URL parameter value generated from a Runpod request query value.",
  })
);

type RunpodUrlParamValue = typeof RunpodUrlParamValue.Type;

const RunpodUrlParams = S.Record(S.String, RunpodUrlParamValue).pipe(
  $I.annoteSchema("RunpodUrlParams", {
    description: "URL parameters generated from a Runpod request query object.",
  })
);

type RunpodUrlParams = typeof RunpodUrlParams.Type;

const RunpodJsonQueryValue = S.fromJsonString(S.Unknown);
const encodeJsonQueryValue = S.encodeUnknownEffect(RunpodJsonQueryValue);
const decodeQueryScalar = S.decodeUnknownOption(RunpodQueryScalar);
const decodeQueryValue = S.decodeUnknownOption(RunpodQueryValue);
const decodeProblem = S.decodeUnknownEffect(RunpodProblemFromProblemDetails);

const PAGINATION_CURSOR_FIELD = "cursor";

const resolveConfig = (config: RunpodConfigInput): ResolvedRunpodConfig =>
  ResolvedRunpodConfig.make({
    apiKey: O.fromUndefinedOr(config.apiKey),
    apiUrl: Result.getOrThrow(S.decodeResult(RunpodConfigUrl)(config.apiUrl)),
    headers: config.headers,
  });

const queryScalarToString = (value: RunpodQueryScalar): string =>
  Match.type<RunpodQueryScalar>().pipe(
    Match.when(P.isBoolean, (boolean) => (boolean ? "true" : "false")),
    Match.when(P.isNumber, (number) => `${number}`),
    Match.when(P.isString, (text) => text),
    Match.exhaustive
  )(value);

const queryValueToStrings = (value: RunpodQueryValue): ReadonlyArray<string> => {
  if (S.is(RunpodQueryScalarArray)(value)) {
    return pipe(value, A.map(queryScalarToString));
  }

  return A.make(queryScalarToString(value));
};

const singleOrMany = (values: A.NonEmptyReadonlyArray<string>): RunpodUrlParamValue =>
  A.isReadonlyArrayEmpty(A.tailNonEmpty(values)) ? A.headNonEmpty(values) : values;

const readProperty = (value: unknown, key: PropertyKey): O.Option<unknown> => {
  if (!P.isObject(value)) {
    return O.none();
  }

  return O.fromUndefinedOr(
    Result.getOrElse(
      Result.try(() => Reflect.get(value, key)),
      () => undefined
    )
  );
};

const scalarField = (encoded: unknown, field: string): O.Option<string> =>
  pipe(readProperty(encoded, field), O.flatMap(decodeQueryScalar), O.map(queryScalarToString));

const encodingError =
  (descriptor: G.RunpodOperationDescriptor) =>
  (cause?: unknown): RunpodError =>
    RunpodError.fromDescriptor(descriptor, "request encoding", RunpodErrorOptionsInput.make({ cause }));

const rejectExcessRequestKeys: SchemaAST.ParseOptions = { onExcessProperty: "error" };

const encodeRequest = Effect.fnUntraced(function* <Request>(
  descriptor: G.RunpodOperationDescriptor,
  requestSchema: S.ConstraintCodec<Request, unknown>,
  request: unknown
): Effect.fn.Return<unknown, RunpodError> {
  return yield* pipe(
    S.encodeUnknownEffect(requestSchema)(request, rejectExcessRequestKeys),
    Effect.mapError(encodingError(descriptor))
  );
});

const applyPathParams = Effect.fn("Runpod.applyPathParams")(function* (
  descriptor: G.RunpodOperationDescriptor,
  encoded: unknown
) {
  const params = yield* Effect.forEach(
    descriptor.pathParams,
    (param) =>
      pipe(
        scalarField(encoded, param),
        Effect.fromOption(() => encodingError(descriptor)()),
        Effect.map((value) => [param, value] as const)
      ),
    { concurrency: 1 }
  );

  const path = pipe(
    params,
    A.reduce(descriptor.path, (currentPath, [key, value]) =>
      pipe(currentPath, Str.replace(`{${key}}`, encodeURIComponent(value)))
    )
  );

  if (Str.includes("{")(path)) {
    return yield* encodingError(descriptor)();
  }

  return path;
});

type RunpodQueryEntry = readonly [string, RunpodUrlParamValue];

const queryStrings = (value: unknown): O.Option<A.NonEmptyReadonlyArray<string>> =>
  pipe(decodeQueryValue(value), O.map(queryValueToStrings), O.filter(A.isReadonlyArrayNonEmpty));

const queryEntryValue = (
  descriptor: G.RunpodOperationDescriptor,
  parameter: G.RunpodQueryParameter,
  value: unknown
): Effect.Effect<O.Option<RunpodQueryEntry>, RunpodError> =>
  Match.value(parameter.encoding).pipe(
    Match.when("json", () =>
      encodeJsonQueryValue(value).pipe(
        Effect.mapBoth({
          onFailure: encodingError(descriptor),
          onSuccess: (json): O.Option<RunpodQueryEntry> => O.some([parameter.name, json]),
        })
      )
    ),
    Match.when("comma", () =>
      Effect.succeed(O.map(queryStrings(value), (values): RunpodQueryEntry => [parameter.name, A.join(values, ",")]))
    ),
    Match.when("repeat", () =>
      Effect.succeed(O.map(queryStrings(value), (values): RunpodQueryEntry => [parameter.name, singleOrMany(values)]))
    ),
    Match.exhaustive
  );

const queryEntry = (
  descriptor: G.RunpodOperationDescriptor,
  encoded: unknown,
  parameter: G.RunpodQueryParameter
): Effect.Effect<O.Option<RunpodQueryEntry>, RunpodError> =>
  pipe(
    readProperty(encoded, parameter.field),
    O.match({
      onNone: () => Effect.succeedNone,
      onSome: (value) => queryEntryValue(descriptor, parameter, value),
    })
  );

const requestQuery = Effect.fnUntraced(function* (
  descriptor: G.RunpodOperationDescriptor,
  encoded: unknown
): Effect.fn.Return<RunpodUrlParams, RunpodError> {
  const entries = yield* Effect.forEach(
    descriptor.queryParams,
    (parameter) => queryEntry(descriptor, encoded, parameter),
    { concurrency: 1 }
  );

  return R.fromEntries(A.getSomes(entries));
});

const requestHeaders = (descriptor: G.RunpodOperationDescriptor, encoded: unknown): Readonly<Record<string, string>> =>
  pipe(
    descriptor.headerParams,
    A.map((parameter) =>
      pipe(
        scalarField(encoded, parameter.field),
        O.map((value) => [parameter.name, value] as const)
      )
    ),
    A.getSomes,
    R.fromEntries
  );

const selectToken = Effect.fnUntraced(function* (
  config: ResolvedRunpodConfig,
  descriptor: G.RunpodOperationDescriptor
): Effect.fn.Return<O.Option<Redacted.Redacted>, RunpodError> {
  if (!descriptor.authenticated) {
    return O.none();
  }

  return yield* pipe(
    config.apiKey,
    O.match({
      onNone: () => Effect.fail(RunpodError.fromDescriptor(descriptor, "config")),
      onSome: Effect.succeedSome,
    })
  );
});

const hasResponseBody =
  (body: G.RunpodResponseBodyKind) =>
  (descriptor: G.RunpodOperationDescriptor): boolean =>
    A.some(descriptor.responses, (response) => response.body === body);

const defaultAcceptHeader = (descriptor: G.RunpodOperationDescriptor): string =>
  Match.value(descriptor).pipe(
    Match.when(hasResponseBody("json"), () => "application/json"),
    Match.when(hasResponseBody("event-stream"), () => "text/event-stream"),
    Match.when(hasResponseBody("text"), () => "text/plain"),
    Match.orElse(() => "*/*")
  );

const withToken =
  (token: O.Option<Redacted.Redacted>) =>
  (request: HttpClientRequest.HttpClientRequest): HttpClientRequest.HttpClientRequest =>
    pipe(
      token,
      O.match({
        onNone: () => request,
        onSome: (value) => pipe(request, HttpClientRequest.bearerToken(value)),
      })
    );

const addJsonBody = Effect.fnUntraced(function* (
  descriptor: G.RunpodOperationDescriptor,
  request: HttpClientRequest.HttpClientRequest,
  encoded: unknown
): Effect.fn.Return<HttpClientRequest.HttpClientRequest, RunpodError> {
  if (descriptor.requestBody === "none") {
    return request;
  }

  return yield* pipe(
    readProperty(encoded, "body"),
    O.match({
      onNone: () =>
        descriptor.requestBodyRequired ? Effect.fail(encodingError(descriptor)()) : Effect.succeed(request),
      onSome: (body) => pipe(HttpClientRequest.bodyJson(request, body), Effect.mapError(encodingError(descriptor))),
    })
  );
});

const buildRequest = Effect.fn("Runpod.buildRequest")(function* (
  config: ResolvedRunpodConfig,
  descriptor: G.RunpodOperationDescriptor,
  encoded: unknown
) {
  const path = yield* applyPathParams(descriptor, encoded);
  const urlParams = yield* requestQuery(descriptor, encoded);
  const token = yield* selectToken(config, descriptor);

  const baseRequest = pipe(
    HttpClientRequest.make(descriptor.method)(`${config.apiUrl}${path}`, { urlParams }),
    HttpClientRequest.accept(defaultAcceptHeader(descriptor)),
    HttpClientRequest.setHeaders(config.headers),
    HttpClientRequest.setHeaders(requestHeaders(descriptor, encoded)),
    withToken(token)
  );

  return yield* addJsonBody(descriptor, baseRequest, encoded);
});

const executeHttp = Effect.fn("Runpod.executeHttp")(function* (
  client: HttpClient.HttpClient,
  descriptor: G.RunpodOperationDescriptor,
  request: HttpClientRequest.HttpClientRequest
) {
  return yield* client.execute(request).pipe(
    Effect.mapError((cause) =>
      RunpodError.fromDescriptor(descriptor, "transport", RunpodErrorOptionsInput.make({ cause }))
    ),
    Effect.tapError(logDriverFailure("transport"))
  );
});

const isJsonContentType = (response: HttpClientResponse.HttpClientResponse): boolean =>
  pipe(
    O.fromUndefinedOr(response.headers["content-type"]),
    O.exists((contentType) => pipe(contentType, Str.includes("json")))
  );

const PROBLEM_BODY_READ_TIMEOUT = "5 seconds";

const readProblem = (response: HttpClientResponse.HttpClientResponse) =>
  isJsonContentType(response)
    ? response.json.pipe(
        Effect.flatMap(decodeProblem),
        Effect.option,
        Effect.timeoutOption(PROBLEM_BODY_READ_TIMEOUT),
        Effect.map(O.flatten)
      )
    : Effect.succeedNone;

const ensureSuccessStatus = Effect.fnUntraced(function* (
  descriptor: G.RunpodOperationDescriptor,
  response: HttpClientResponse.HttpClientResponse
): Effect.fn.Return<HttpClientResponse.HttpClientResponse, RunpodError> {
  if (response.status >= 200 && response.status < 300) {
    return response;
  }

  const problem = yield* readProblem(response);
  const error = RunpodError.fromDescriptor(
    descriptor,
    "response status",
    RunpodErrorOptionsInput.make({ status: response.status, ...O.getSomesStruct({ problem }) })
  );
  yield* logStatusFailure(error);
  return yield* error;
});

const decodingError =
  (descriptor: G.RunpodOperationDescriptor) =>
  (cause?: unknown): RunpodError =>
    RunpodError.fromDescriptor(descriptor, "response decoding", RunpodErrorOptionsInput.make({ cause }));

const responseFor = (descriptor: G.RunpodOperationDescriptor, status: number): O.Option<G.RunpodOperationResponse> =>
  pipe(
    descriptor.responses,
    A.findFirst((response) => response.status === `${status}`),
    O.orElse(() => A.head(descriptor.responses))
  );

const readResponseBody = (
  declared: G.RunpodOperationResponse,
  response: HttpClientResponse.HttpClientResponse
): Effect.Effect<unknown, HttpClientError.HttpClientError> =>
  Match.value(declared.body).pipe(
    Match.when("json", () => response.json),
    Match.when("text", () => response.text),
    Match.when("event-stream", () => response.text),
    Match.when("none", () => Effect.undefined),
    Match.exhaustive
  );

const decodeOperationResponse = Effect.fnUntraced(function* <Request, Response>(
  spec: G.RunpodOperationSpec<Request, Response>,
  response: HttpClientResponse.HttpClientResponse
): Effect.fn.Return<Response, RunpodError> {
  const declared = yield* pipe(
    responseFor(spec.descriptor, response.status),
    Effect.fromOption(() => decodingError(spec.descriptor)())
  );
  const decoder = yield* pipe(
    R.get(spec.responses, declared.status),
    Effect.fromOption(() => decodingError(spec.descriptor)())
  );
  const body = yield* pipe(readResponseBody(declared, response), Effect.mapError(decodingError(spec.descriptor)));

  return yield* pipe(S.decodeUnknownEffect(decoder)(body), Effect.mapError(decodingError(spec.descriptor)));
});

const executeEncoded = Effect.fnUntraced(function* <Request, Response>(
  client: HttpClient.HttpClient,
  config: ResolvedRunpodConfig,
  spec: G.RunpodOperationSpec<Request, Response>,
  encoded: unknown
): Effect.fn.Return<Response, RunpodError> {
  const httpRequest = yield* buildRequest(config, spec.descriptor, encoded);
  const response = yield* executeHttp(client, spec.descriptor, httpRequest);
  const successfulResponse = yield* ensureSuccessStatus(spec.descriptor, response);
  return yield* decodeOperationResponse(spec, successfulResponse);
});

const executeOperation = Effect.fn("Runpod.executeOperation")(function* <Request, Response>(
  client: HttpClient.HttpClient,
  config: ResolvedRunpodConfig,
  spec: G.RunpodOperationSpec<Request, Response>,
  request: unknown
): Effect.fn.Return<Response, RunpodError> {
  const encoded = yield* encodeRequest(spec.descriptor, spec.request, request);
  return yield* executeEncoded(client, config, spec, encoded);
});

const withCursor = (encoded: unknown, cursor: string): O.Option<unknown> =>
  pipe(
    encoded,
    O.liftPredicate(P.isObject),
    O.map((request) => ({ ...request, [PAGINATION_CURSOR_FIELD]: cursor }))
  );

const nextPageRequest = (
  descriptor: G.RunpodOperationDescriptor,
  encoded: unknown,
  pagination: Models.Pagination
): Effect.Effect<O.Option<unknown>, RunpodError> =>
  pipe(
    O.fromNullOr(pagination.nextCursor),
    O.filter(() => pagination.hasNextPage),
    O.match({
      onNone: () => Effect.succeedNone,
      onSome: (cursor) =>
        O.contains(readProperty(encoded, PAGINATION_CURSOR_FIELD), cursor)
          ? Effect.fail(RunpodError.fromDescriptor(descriptor, "pagination"))
          : Effect.succeed(withCursor(encoded, cursor)),
    })
  );

const paginateOperation = <Request, Page extends { readonly pagination: Models.Pagination }, Item>(
  client: HttpClient.HttpClient,
  config: ResolvedRunpodConfig,
  spec: G.RunpodOperationSpec<Request, Page>,
  items: (page: Page) => ReadonlyArray<Item>,
  request: unknown
): Stream.Stream<Item, RunpodError> =>
  Stream.unwrap(
    pipe(
      encodeRequest(spec.descriptor, spec.request, request),
      Effect.map((first) =>
        Stream.paginate(first, (encoded) =>
          pipe(
            executeEncoded(client, config, spec, encoded),
            Effect.flatMap((page) =>
              Effect.map(
                nextPageRequest(spec.descriptor, encoded, page.pagination),
                (next) => [items(page), next] as const
              )
            )
          )
        )
      )
    )
  );

const eventStreamReason = Match.type<HttpClientError.HttpClientError | Sse.Retry | Sse.SseError>().pipe(
  Match.tag("SseError", (): RunpodErrorReason => "response decoding"),
  Match.orElse((): RunpodErrorReason => "transport")
);

const eventStreamOperation = <Request>(
  client: HttpClient.HttpClient,
  config: ResolvedRunpodConfig,
  spec: G.RunpodOperationSpec<Request, unknown>,
  request: unknown
): Stream.Stream<Sse.Event, RunpodError> =>
  Stream.unwrap(
    Effect.gen(function* () {
      const encoded = yield* encodeRequest(spec.descriptor, spec.request, request);
      const httpRequest = yield* buildRequest(config, spec.descriptor, encoded);
      const response = yield* executeHttp(client, spec.descriptor, httpRequest);
      const successfulResponse = yield* ensureSuccessStatus(spec.descriptor, response);

      return successfulResponse.stream.pipe(
        Stream.decodeText(),
        Stream.pipeThroughChannel(Sse.decode()),
        Stream.mapError((cause) =>
          RunpodError.fromDescriptor(spec.descriptor, eventStreamReason(cause), RunpodErrorOptionsInput.make({ cause }))
        )
      );
    })
  );

const requestOrDefault = <Request>(
  request: Request | undefined,
  defaultRequest: (() => Request) | undefined
): O.Option<Request> =>
  pipe(
    O.fromUndefinedOr(request),
    O.orElse(() => O.map(O.fromUndefinedOr(defaultRequest), (make) => make()))
  );

const operationAttributes = (descriptor: G.RunpodOperationDescriptor) => ({
  method: descriptor.method,
  methodName: descriptor.methodName,
  operationId: descriptor.operationId,
  path: descriptor.path,
  provider: "runpod",
});

const operationSpan =
  (descriptor: G.RunpodOperationDescriptor) =>
  <A, E>(effect: Effect.Effect<A, E>): Effect.Effect<A, E> =>
    effect.pipe(
      Effect.tapError((error) => (RunpodError.is(error) ? logDriverFailure("operation")(error) : Effect.void)),
      Effect.withSpan("Runpod.operation", { attributes: operationAttributes(descriptor) })
    );

const streamSpan =
  (descriptor: G.RunpodOperationDescriptor) =>
  <A>(stream: Stream.Stream<A, RunpodError>): Stream.Stream<A, RunpodError> =>
    stream.pipe(
      Stream.tapError(logDriverFailure("operation")),
      Stream.withSpan("Runpod.stream", { attributes: operationAttributes(descriptor) })
    );

const makeFactory = (
  client: HttpClient.HttpClient,
  config: ResolvedRunpodConfig
): G.RunpodOperationFactory<RunpodError> => ({
  effect:
    <Request, Response>(spec: G.RunpodOperationSpec<Request, Response>, defaultRequest?: () => Request) =>
    (request?: Request): Effect.Effect<Response, RunpodError> =>
      executeOperation(client, config, spec, O.getOrUndefined(requestOrDefault(request, defaultRequest))).pipe(
        operationSpan(spec.descriptor)
      ),
  eventStream:
    <Request>(spec: G.RunpodOperationSpec<Request, unknown>, defaultRequest?: () => Request) =>
    (request?: Request): Stream.Stream<Sse.Event, RunpodError> =>
      eventStreamOperation(client, config, spec, O.getOrUndefined(requestOrDefault(request, defaultRequest))).pipe(
        streamSpan(spec.descriptor)
      ),
  paginate:
    <Request, Page extends { readonly pagination: Models.Pagination }, Item>(
      spec: G.RunpodOperationSpec<Request, Page>,
      items: (page: Page) => ReadonlyArray<Item>,
      defaultRequest?: () => Request
    ) =>
    (request?: Request): Stream.Stream<Item, RunpodError> =>
      paginateOperation(client, config, spec, items, O.getOrUndefined(requestOrDefault(request, defaultRequest))).pipe(
        streamSpan(spec.descriptor)
      ),
});

const diagnosticsFor = (event: string, error: RunpodError): Readonly<Record<string, unknown>> => ({
  event,
  provider: "runpod",
  reason: error.reason,
  ...O.getSomesStruct({
    cause: error.cause,
    method: error.method,
    methodName: error.methodName,
    operationId: error.operationId,
    path: error.path,
    problemDetail: O.flatMap(error.problem, (problem) => problem.detail),
    problemTitle: O.flatMap(error.problem, (problem) => problem.title),
    status: error.status,
  }),
});

const logDriverFailure = (event: string) =>
  Effect.fnUntraced(function* (error: RunpodError): Effect.fn.Return<void> {
    yield* Effect.logDebug(diagnosticsFor(event, error));
  });

const logStatusFailure = Effect.fnUntraced(function* (error: RunpodError): Effect.fn.Return<void> {
  yield* Effect.logWarning(diagnosticsFor("response-status", error));
});

const rawUrlParams = (request: RunpodRawRequest): RunpodUrlParams =>
  pipe(
    request.query,
    R.toEntries,
    A.map(
      ([key, value]) =>
        [
          key,
          pipe(value, queryValueToStrings, (values) =>
            A.isReadonlyArrayNonEmpty(values) ? singleOrMany(values) : values
          ),
        ] as const
    ),
    R.fromEntries
  );

const addRawBody = Effect.fnUntraced(function* (
  request: HttpClientRequest.HttpClientRequest,
  rawRequest: RunpodRawRequest
): Effect.fn.Return<HttpClientRequest.HttpClientRequest, RunpodError> {
  return yield* pipe(
    rawRequest.body,
    O.match({
      onNone: () => Effect.succeed(request),
      onSome: (body) =>
        pipe(
          HttpClientRequest.bodyJson(request, body),
          Effect.mapError((cause) =>
            RunpodError.raw(
              RunpodRawErrorOptions.make({
                cause,
                method: rawRequest.method,
                path: rawRequest.path,
                reason: "request encoding",
              })
            )
          )
        ),
    })
  );
});

const rawToken = Effect.fnUntraced(function* (
  config: ResolvedRunpodConfig,
  request: RunpodRawRequest
): Effect.fn.Return<O.Option<Redacted.Redacted>, RunpodError> {
  if (!request.authenticated) {
    return O.none();
  }

  return yield* pipe(
    config.apiKey,
    O.match({
      onNone: () =>
        Effect.fail(
          RunpodError.raw(RunpodRawErrorOptions.make({ method: request.method, path: request.path, reason: "config" }))
        ),
      onSome: Effect.succeedSome,
    })
  );
});

const rawResponseBody = Effect.fnUntraced(function* (
  request: RunpodRawRequest,
  response: HttpClientResponse.HttpClientResponse
): Effect.fn.Return<RunpodRawResponse, RunpodError> {
  const rawDecodingError = (cause: unknown): RunpodError =>
    RunpodError.raw(
      RunpodRawErrorOptions.make({
        cause,
        method: request.method,
        path: request.path,
        reason: "response decoding",
      })
    );

  if (isJsonContentType(response)) {
    return yield* response.json.pipe(
      Effect.mapBoth({
        onFailure: rawDecodingError,
        onSuccess: (body) =>
          RunpodRawResponse.make({
            body,
            headers: response.headers,
            status: response.status,
          }),
      })
    );
  }

  return yield* response.text.pipe(
    Effect.mapBoth({
      onFailure: rawDecodingError,
      onSuccess: (text) =>
        RunpodRawResponse.make({
          body: text,
          headers: response.headers,
          status: response.status,
          text,
        }),
    })
  );
});

const executeRawRequest = Effect.fn("Runpod.raw")(function* (
  client: HttpClient.HttpClient,
  config: ResolvedRunpodConfig,
  rawRequest: RunpodRawRequest
) {
  const decodedRequest = yield* pipe(
    decodeRunpodRawRequest(rawRequest),
    Effect.mapError((cause) =>
      RunpodError.raw(
        RunpodRawErrorOptions.make({
          cause,
          method: rawRequest.method,
          path: rawRequest.path,
          reason: "request encoding",
        })
      )
    )
  );
  const token = yield* rawToken(config, decodedRequest);
  const requestWithHeaders = pipe(
    HttpClientRequest.make(decodedRequest.method)(`${config.apiUrl}${decodedRequest.path}`, {
      urlParams: rawUrlParams(decodedRequest),
    }),
    HttpClientRequest.setHeaders(config.headers),
    HttpClientRequest.setHeaders(decodedRequest.headers),
    withToken(token)
  );
  const httpRequest = yield* addRawBody(requestWithHeaders, decodedRequest);
  const response = yield* client.execute(httpRequest).pipe(
    Effect.mapError((cause) =>
      RunpodError.raw(
        RunpodRawErrorOptions.make({
          cause,
          method: decodedRequest.method,
          path: decodedRequest.path,
          reason: "transport",
        })
      )
    ),
    Effect.tapError(logDriverFailure("transport"))
  );

  return yield* rawResponseBody(decodedRequest, response);
});

const makeService = (client: HttpClient.HttpClient, config: ResolvedRunpodConfig): RunpodShape => ({
  ...G.makeRunpodOperations(makeFactory(client, config)),
  raw: Effect.fnUntraced(function* (request): Effect.fn.Return<RunpodRawResponse, RunpodError> {
    return yield* executeRawRequest(client, config, request).pipe(
      Effect.withSpan("Runpod.raw", {
        attributes: {
          method: request.method,
          path: request.path,
          provider: "runpod",
        },
      })
    );
  }),
});

const makeRunpodFromConfig = Effect.fn("Runpod.makeRunpodFromConfig")(function* (
  config: ResolvedRunpodConfig
): Effect.fn.Return<RunpodShape, never, HttpClient.HttpClient> {
  const client = yield* HttpClient.HttpClient;
  return Runpod.of(makeService(client, config));
});

const makeRunpodFromEnvironment = Effect.fn("Runpod.makeRunpodFromEnvironment")(function* () {
  const apiKey = yield* Config.Redacted("RUNPOD_API_KEY").pipe(Config.option);
  const apiUrl = yield* Config.String("RUNPOD_API_URL").pipe(Config.withDefault(RUNPOD_API_URL));

  return yield* makeRunpodFromConfig(
    resolveConfig(
      RunpodConfigInput.make({
        apiUrl,
        ...O.getSomesStruct({ apiKey }),
      })
    )
  );
});

/**
 * Effect service for every documented Runpod REST API v2 operation.
 *
 * **Gotchas**
 *
 * Request bodies are closed. `<Operation>Params.make` drops unknown keys like
 * any schema constructor, but a key written onto a constructed body fails with
 * reason `request encoding` instead of going out silently dropped (Runpod would
 * answer 422). Index-signature fields such as `env` still accept any key. An
 * operation that has no default request also fails that way when called
 * without one.
 *
 * A failure's RFC 9457 problem body is read for at most 5 seconds. A body that
 * stays open, as a proxy holding a 503 can, or that is not a readable problem
 * leaves the `RunpodError` with its status only. A paginated stream fails with
 * reason `pagination` when a page hands back the cursor it was requested with,
 * instead of requesting that page forever.
 *
 * **Example** (Create Runpod service layer)
 *
 * ```ts
 * import { Runpod, RunpodConfigInput } from "@beep/runpod"
 *
 * const layer = Runpod.makeLayer(
 *   RunpodConfigInput.make({ apiUrl: "https://api.runpod.io/v2" })
 * )
 * console.log(layer)
 * ```
 *
 * **Example** (Read every pod across pages)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as Stream from "effect/Stream"
 * import { Runpod } from "@beep/runpod"
 *
 * const program = Effect.gen(function* () {
 *   const runpod = yield* Runpod
 *   return yield* Stream.runCollect(runpod.listPodsStream())
 * })
 * console.log(program)
 * ```
 *
 * @category services
 * @since 0.1.0
 */
export class Runpod extends Context.Service<Runpod, RunpodShape>()($I`Runpod`) {
  /**
   * Build a Runpod layer from explicit runtime configuration.
   *
   * @category layers
   * @since 0.1.0
   */
  static readonly makeLayer = (
    config = RunpodConfigInput.make({})
  ): Layer.Layer<Runpod, never, HttpClient.HttpClient> =>
    Layer.effect(Runpod, makeRunpodFromConfig(resolveConfig(config)));

  /**
   * Live Runpod layer backed by `RUNPOD_API_KEY` and optional `RUNPOD_API_URL`.
   *
   * @category layers
   * @since 0.1.0
   */
  static readonly layer: Layer.Layer<Runpod, RunpodError> = Layer.effect(
    Runpod,
    makeRunpodFromEnvironment().pipe(Effect.mapError(RunpodError.config))
  ).pipe(Layer.provide(FetchHttpClient.layer));
}
