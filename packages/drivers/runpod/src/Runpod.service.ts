/**
 * Effect service for Runpod REST API v1 operations.
 *
 * @packageDocumentation
 * @since 0.1.0
 */

import { $RunpodId } from "@beep/identity";
import { SchemaUtils } from "@beep/schema";
import { A, O, Str } from "@beep/utils";
import { Config, Context, Effect, Layer, Match, pipe, Result, SchemaGetter } from "effect";
import { dual } from "effect/Function";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { FetchHttpClient } from "effect/unstable/http";
import * as HttpClient from "effect/unstable/http/HttpClient";
import * as HttpClientRequest from "effect/unstable/http/HttpClientRequest";
import * as G from "./_generated/Runpod.operations.gen.ts";
import { RUNPOD_API_URL, RunpodConfigInput, RunpodConfigUrl } from "./Runpod.config.ts";
import { RunpodError, RunpodHttpStatusCode } from "./Runpod.errors.ts";
import type { Redacted } from "effect";
import type * as HttpClientResponse from "effect/unstable/http/HttpClientResponse";

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
 * Scalar query values accepted by Runpod request models and raw requests.
 *
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
 * Type for {@link RunpodQueryScalar}.
 *
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

const RunpodQueryScalarArray = S.Array(RunpodQueryScalar).pipe(SchemaUtils.withCodecStatics(["is"]));

/**
 * Query value accepted by the raw Runpod request escape hatch.
 *
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
  }),
  SchemaUtils.withCodecStatics(["decodeUnknownOption"])
);

/**
 * Type for {@link RunpodQueryValue}.
 *
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

/**
 * Raw Runpod HTTP request escape hatch for endpoints ahead of the checked-in OpenAPI document.
 *
 * **Example** (Make raw GET request)
 *
 * ```ts
 * import { RunpodRawRequest } from "@beep/runpod"
 *
 * const request = RunpodRawRequest.make({
 *   method: "GET",
 *   path: "/health"
 * })
 * console.log(request.path)
 * ```
 *
 * @category models
 * @since 0.1.0
 */
export class RunpodRawRequest extends S.Class<RunpodRawRequest>($I`RunpodRawRequest`)(
  {
    authenticated: S.Boolean.pipe(SchemaUtils.withKeyDefaults(true)),
    body: S.OptionFromOptionalKey(S.Unknown).pipe(SchemaUtils.withNoneDefault),
    headers: S.Record(S.String, S.String).pipe(SchemaUtils.withKeyDefaults(R.empty())),
    method: G.RunpodHttpMethod,
    path: RunpodRawPath,
    query: S.Record(S.String, RunpodQueryValue).pipe(SchemaUtils.withKeyDefaults(R.empty())),
  },
  $I.annote("RunpodRawRequest", {
    description: "Raw Runpod HTTP request escape hatch for endpoints ahead of the checked-in OpenAPI document.",
  })
) {}

/**
 * Raw Runpod HTTP response returned by {@link Runpod.raw}.
 *
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
export class RunpodRawResponse extends S.Class<RunpodRawResponse>($I`RunpodRawResponse`)(
  {
    body: S.optionalKey(S.Unknown),
    headers: S.Record(S.String, S.String),
    status: RunpodHttpStatusCode,
    text: S.optionalKey(S.String),
  },
  $I.annote("RunpodRawResponse", {
    description: "Raw Runpod HTTP response returned by the raw escape hatch.",
  })
) {}

/**
 * Public service shape for generated Runpod operations plus the raw request escape hatch.
 *
 * **Example** (Type raw request parameter)
 *
 * ```ts
 * import type { RunpodShape } from "@beep/runpod"
 * import { RunpodRawRequest } from "@beep/runpod"
 *
 * type RawRequest = Parameters<RunpodShape["raw"]>[0]
 *
 * const request: RawRequest = RunpodRawRequest.make({ method: "GET", path: "/health" })
 * console.log(request.path)
 * ```
 *
 * @category services
 * @since 0.1.0
 */
export interface RunpodShape extends G.RunpodOperationsShape<RunpodError> {
  readonly raw: (request: RunpodRawRequest) => Effect.Effect<RunpodRawResponse, RunpodError>;
}

class ResolvedRunpodConfig extends S.Class<ResolvedRunpodConfig>($I`ResolvedRunpodConfig`)(
  {
    apiKey: S.String.pipe(S.Redacted, S.Option),
    apiUrl: S.String,
    headers: S.Record(S.String, S.String),
  },
  $I.annote("ResolvedRunpodConfig", {
    description: "Resolved runtime configuration for the Runpod service.",
  })
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

interface JsonOperationSpec<Request, Response> extends VoidOperationSpec<Request> {
  readonly response: S.ConstraintDecoder<Response>;
}

interface VoidOperationSpec<Request> {
  readonly descriptor: G.RunpodOperationDescriptor;
  readonly request: S.ConstraintDecoder<Request>;
}

const resolveConfig = (config: RunpodConfigInput): ResolvedRunpodConfig =>
  ResolvedRunpodConfig.make({
    apiKey: O.fromUndefinedOr(config.apiKey),
    apiUrl: RunpodConfigUrl.decodeUnknownSync(config.apiUrl),
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
  if (RunpodQueryScalarArray.is(value)) {
    return pipe(value, A.map(queryScalarToString));
  }

  return A.make(queryScalarToString(value));
};

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

const requireStringField = Effect.fnUntraced(function* (
  descriptor: G.RunpodOperationDescriptor,
  request: unknown,
  key: string
): Effect.fn.Return<string, RunpodError> {
  return yield* pipe(
    readProperty(request, key),
    O.filter(P.isString),
    Effect.fromOption(() => RunpodError.fromDescriptor(descriptor, "request encoding"))
  );
});

const applyPathParams = Effect.fn("Runpod.applyPathParams")(function* (
  descriptor: G.RunpodOperationDescriptor,
  request: unknown
) {
  const params = yield* Effect.forEach(
    descriptor.pathParams,
    (param) =>
      pipe(
        requireStringField(descriptor, request, param),
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
    return yield* RunpodError.fromDescriptor(descriptor, "request encoding");
  }

  return path;
});

const decodeRequest = Effect.fnUntraced(function* <Request>(
  descriptor: G.RunpodOperationDescriptor,
  requestSchema: S.ConstraintDecoder<Request>,
  request: Request
): Effect.fn.Return<Request, RunpodError> {
  return yield* pipe(
    S.decodeUnknownEffect(requestSchema)(request),
    Effect.mapError((cause) => RunpodError.fromDescriptor(descriptor, "request encoding", { cause }))
  );
});

const queryEntry: {
  (request: unknown, key: string): O.Option<readonly [string, string | ReadonlyArray<string>]>;
  (key: string): (request: unknown) => O.Option<readonly [string, string | ReadonlyArray<string>]>;
} = dual(
  2,
  (request: unknown, key: string): O.Option<readonly [string, string | ReadonlyArray<string>]> =>
    pipe(
      readProperty(request, key),
      O.flatMap(RunpodQueryValue.decodeUnknownOption),
      O.map(queryValueToStrings),
      O.filter(A.isReadonlyArrayNonEmpty),
      O.map((values) => [key, A.length(values) === 1 ? values[0] : values] as const)
    )
);

const requestQuery = (descriptor: G.RunpodOperationDescriptor, request: unknown): RunpodUrlParams =>
  pipe(
    descriptor.queryParams,
    A.map((key) => queryEntry(request, key)),
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
      onSome: (token) => Effect.succeedSome(token),
    })
  );
});

const defaultAcceptHeader = (descriptor: G.RunpodOperationDescriptor): string => {
  if (descriptor.responseBody === "text") {
    // Runpod currently marks only `/docs` as text and serves rendered HTML there.
    return "text/html";
  }

  return descriptor.responseBody === "json" ? "application/json" : "*/*";
};

const addHeaders = (
  request: HttpClientRequest.HttpClientRequest,
  config: ResolvedRunpodConfig,
  descriptor: G.RunpodOperationDescriptor,
  token: O.Option<Redacted.Redacted>,
  headers: Readonly<Record<string, string>> = {}
): HttpClientRequest.HttpClientRequest =>
  pipe(
    request,
    HttpClientRequest.accept(defaultAcceptHeader(descriptor)),
    HttpClientRequest.setHeaders(config.headers),
    HttpClientRequest.setHeaders(headers),
    (currentRequest) =>
      pipe(
        token,
        O.match({
          onNone: () => currentRequest,
          onSome: (value) => pipe(currentRequest, HttpClientRequest.bearerToken(value)),
        })
      )
  );

const addJsonBody = Effect.fnUntraced(function* (
  descriptor: G.RunpodOperationDescriptor,
  request: HttpClientRequest.HttpClientRequest,
  decodedRequest: unknown
): Effect.fn.Return<HttpClientRequest.HttpClientRequest, RunpodError> {
  if (descriptor.requestBody === "none") {
    return request;
  }

  return yield* pipe(
    readProperty(decodedRequest, "body"),
    O.match({
      onNone: () =>
        descriptor.requestBodyRequired
          ? Effect.fail(RunpodError.fromDescriptor(descriptor, "request encoding"))
          : Effect.succeed(request),
      onSome: (body) =>
        pipe(
          HttpClientRequest.bodyJson(request, body),
          Effect.mapError((cause) => RunpodError.fromDescriptor(descriptor, "request encoding", { cause }))
        ),
    })
  );
});

const buildRequest = Effect.fn("Runpod.buildRequest")(function* <Request>(
  config: ResolvedRunpodConfig,
  descriptor: G.RunpodOperationDescriptor,
  requestSchema: S.ConstraintDecoder<Request>,
  request: Request
) {
  const decodedRequest = yield* decodeRequest(descriptor, requestSchema, request);
  const path = yield* applyPathParams(descriptor, decodedRequest);
  const token = yield* selectToken(config, descriptor);

  const baseRequest = addHeaders(
    HttpClientRequest.make(descriptor.method)(`${config.apiUrl}${path}`, {
      urlParams: requestQuery(descriptor, decodedRequest),
    }),
    config,
    descriptor,
    token
  );

  return yield* addJsonBody(descriptor, baseRequest, decodedRequest);
});

const executeRawResponse = Effect.fn("Runpod.executeRawResponse")(function* (
  client: HttpClient.HttpClient,
  descriptor: G.RunpodOperationDescriptor,
  request: HttpClientRequest.HttpClientRequest
) {
  return yield* client.execute(request).pipe(
    Effect.mapError((cause) => RunpodError.fromDescriptor(descriptor, "transport", { cause })),
    Effect.tapError(logDriverFailure("transport"))
  );
});

const ensureSuccessStatus = Effect.fnUntraced(function* (
  descriptor: G.RunpodOperationDescriptor,
  response: HttpClientResponse.HttpClientResponse
): Effect.fn.Return<HttpClientResponse.HttpClientResponse, RunpodError> {
  if (response.status >= 200 && response.status < 300) {
    return response;
  }

  const error = RunpodError.fromDescriptor(descriptor, "response status", { status: response.status });
  yield* logStatusFailure(error);
  return yield* error;
});

const decodeJsonResponse = Effect.fnUntraced(function* <Response>(
  descriptor: G.RunpodOperationDescriptor,
  responseSchema: S.ConstraintDecoder<Response>,
  response: HttpClientResponse.HttpClientResponse
): Effect.fn.Return<Response, RunpodError> {
  const body = yield* response.json.pipe(
    Effect.mapError((cause) => RunpodError.fromDescriptor(descriptor, "response decoding", { cause }))
  );

  return yield* pipe(
    S.decodeEffect(responseSchema)(body),
    Effect.mapError((cause) => RunpodError.fromDescriptor(descriptor, "response decoding", { cause }))
  );
});

const decodeTextResponse = Effect.fnUntraced(function* (
  descriptor: G.RunpodOperationDescriptor,
  response: HttpClientResponse.HttpClientResponse
): Effect.fn.Return<string, RunpodError> {
  return yield* response.text.pipe(
    Effect.mapError((cause) => RunpodError.fromDescriptor(descriptor, "response decoding", { cause }))
  );
});

const executeOperationResponse = Effect.fnUntraced(function* <Request>(
  client: HttpClient.HttpClient,
  config: ResolvedRunpodConfig,
  spec: VoidOperationSpec<Request>,
  request: Request
): Effect.fn.Return<HttpClientResponse.HttpClientResponse, RunpodError> {
  const httpRequest = yield* buildRequest(config, spec.descriptor, spec.request, request);
  const response = yield* executeRawResponse(client, spec.descriptor, httpRequest);
  return yield* ensureSuccessStatus(spec.descriptor, response);
});

const executeJsonOperation = Effect.fn("Runpod.executeJsonOperation")(function* <Request, Response>(
  client: HttpClient.HttpClient,
  config: ResolvedRunpodConfig,
  spec: JsonOperationSpec<Request, Response>,
  request: Request
): Effect.fn.Return<Response, RunpodError> {
  const successfulResponse = yield* executeOperationResponse(client, config, spec, request);
  return yield* decodeJsonResponse(spec.descriptor, spec.response, successfulResponse);
});

const executeTextOperation = Effect.fn("Runpod.executeTextOperation")(function* <Request>(
  client: HttpClient.HttpClient,
  config: ResolvedRunpodConfig,
  spec: JsonOperationSpec<Request, string>,
  request: Request
): Effect.fn.Return<string, RunpodError> {
  const successfulResponse = yield* executeOperationResponse(client, config, spec, request);
  return yield* decodeTextResponse(spec.descriptor, successfulResponse);
});

const executeVoidOperation = Effect.fn("Runpod.executeVoidOperation")(function* <Request>(
  client: HttpClient.HttpClient,
  config: ResolvedRunpodConfig,
  spec: VoidOperationSpec<Request>,
  request: Request
): Effect.fn.Return<void, RunpodError> {
  yield* executeOperationResponse(client, config, spec, request);
});

const requiredJsonOperation = <Request, Response>(
  client: HttpClient.HttpClient,
  config: ResolvedRunpodConfig,
  spec: JsonOperationSpec<Request, Response>
) =>
  Effect.fnUntraced(function* (request: Request): Effect.fn.Return<Response, RunpodError> {
    return yield* executeJsonOperation(client, config, spec, request).pipe(operationSpan(spec.descriptor));
  });

const optionalJsonOperation = <Request, Response>(
  client: HttpClient.HttpClient,
  config: ResolvedRunpodConfig,
  spec: JsonOperationSpec<Request, Response>,
  defaultRequest: () => Request
) =>
  Effect.fnUntraced(function* (request?: Request): Effect.fn.Return<Response, RunpodError> {
    return yield* executeJsonOperation(client, config, spec, request ?? defaultRequest()).pipe(
      operationSpan(spec.descriptor)
    );
  });

const optionalTextOperation = <Request>(
  client: HttpClient.HttpClient,
  config: ResolvedRunpodConfig,
  spec: JsonOperationSpec<Request, string>,
  defaultRequest: () => Request
) =>
  Effect.fnUntraced(function* (request?: Request): Effect.fn.Return<string, RunpodError> {
    return yield* executeTextOperation(client, config, spec, request ?? defaultRequest()).pipe(
      operationSpan(spec.descriptor)
    );
  });

const requiredVoidOperation = <Request>(
  client: HttpClient.HttpClient,
  config: ResolvedRunpodConfig,
  spec: VoidOperationSpec<Request>
) =>
  Effect.fnUntraced(function* (request: Request): Effect.fn.Return<void, RunpodError> {
    return yield* executeVoidOperation(client, config, spec, request).pipe(operationSpan(spec.descriptor));
  });

const operationSpan =
  (descriptor: G.RunpodOperationDescriptor) =>
  <A, E>(effect: Effect.Effect<A, E>): Effect.Effect<A, E> =>
    effect.pipe(
      Effect.tapError((error) => (RunpodError.is(error) ? logDriverFailure("operation")(error) : Effect.void)),
      Effect.withSpan("Runpod.operation", {
        attributes: {
          method: descriptor.method,
          methodName: descriptor.methodName,
          operationId: descriptor.operationId,
          path: descriptor.path,
          provider: "runpod",
        },
      })
    );

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
        [key, pipe(value, queryValueToStrings, (values) => (A.length(values) === 1 ? values[0] : values))] as const
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
            RunpodError.raw({
              cause,
              method: rawRequest.method,
              path: rawRequest.path,
              reason: "request encoding",
            })
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
      onNone: () => Effect.fail(RunpodError.raw({ method: request.method, path: request.path, reason: "config" })),
      onSome: (token) => Effect.succeedSome(token),
    })
  );
});

const rawResponseBody = Effect.fnUntraced(function* (
  request: RunpodRawRequest,
  response: HttpClientResponse.HttpClientResponse
): Effect.fn.Return<RunpodRawResponse, RunpodError> {
  const contentType = response.headers["content-type"] ?? "";

  if (Str.includes("application/json")(contentType)) {
    return yield* response.json.pipe(
      Effect.map((body) =>
        RunpodRawResponse.make({
          body,
          headers: response.headers,
          status: response.status,
        })
      ),
      Effect.mapError((cause) =>
        RunpodError.raw({
          cause,
          method: request.method,
          path: request.path,
          reason: "response decoding",
        })
      )
    );
  }

  return yield* response.text.pipe(
    Effect.map((text) =>
      RunpodRawResponse.make({
        body: text,
        headers: response.headers,
        status: response.status,
        text,
      })
    ),
    Effect.mapError((cause) =>
      RunpodError.raw({
        cause,
        method: request.method,
        path: request.path,
        reason: "response decoding",
      })
    )
  );
});

const executeRawRequest = Effect.fn("Runpod.raw")(function* (
  client: HttpClient.HttpClient,
  config: ResolvedRunpodConfig,
  rawRequest: RunpodRawRequest
) {
  const decodedRequest = yield* pipe(
    S.decodeEffect(RunpodRawRequest)(rawRequest),
    Effect.mapError((cause) =>
      RunpodError.raw({
        cause,
        method: rawRequest.method,
        path: rawRequest.path,
        reason: "request encoding",
      })
    )
  );
  const token = yield* rawToken(config, decodedRequest);
  const requestWithHeaders = pipe(
    HttpClientRequest.make(decodedRequest.method)(`${config.apiUrl}${decodedRequest.path}`, {
      urlParams: rawUrlParams(decodedRequest),
    }),
    HttpClientRequest.setHeaders(config.headers),
    HttpClientRequest.setHeaders(decodedRequest.headers),
    (request) =>
      pipe(
        token,
        O.match({
          onNone: () => request,
          onSome: (value) => pipe(request, HttpClientRequest.bearerToken(value)),
        })
      )
  );
  const httpRequest = yield* addRawBody(requestWithHeaders, decodedRequest);
  const response = yield* client.execute(httpRequest).pipe(
    Effect.mapError((cause) =>
      RunpodError.raw({
        cause,
        method: decodedRequest.method,
        path: decodedRequest.path,
        reason: "transport",
      })
    ),
    Effect.tapError(logDriverFailure("transport"))
  );

  return yield* rawResponseBody(decodedRequest, response);
});

const makeService = (client: HttpClient.HttpClient, config: ResolvedRunpodConfig): RunpodShape => ({
  createContainerRegistryAuth: requiredJsonOperation(
    client,
    config,
    G.RUNPOD_OPERATION_SPECS.createContainerRegistryAuth
  ),
  createEndpoint: requiredJsonOperation(client, config, G.RUNPOD_OPERATION_SPECS.createEndpoint),
  createNetworkVolume: requiredJsonOperation(client, config, G.RUNPOD_OPERATION_SPECS.createNetworkVolume),
  createPod: requiredJsonOperation(client, config, G.RUNPOD_OPERATION_SPECS.createPod),
  createTemplate: requiredJsonOperation(client, config, G.RUNPOD_OPERATION_SPECS.createTemplate),
  deleteContainerRegistryAuth: requiredVoidOperation(
    client,
    config,
    G.RUNPOD_OPERATION_SPECS.deleteContainerRegistryAuth
  ),
  deleteEndpoint: requiredVoidOperation(client, config, G.RUNPOD_OPERATION_SPECS.deleteEndpoint),
  deleteNetworkVolume: requiredVoidOperation(client, config, G.RUNPOD_OPERATION_SPECS.deleteNetworkVolume),
  deletePod: requiredVoidOperation(client, config, G.RUNPOD_OPERATION_SPECS.deletePod),
  deleteTemplate: requiredVoidOperation(client, config, G.RUNPOD_OPERATION_SPECS.deleteTemplate),
  endpointBilling: optionalJsonOperation(client, config, G.RUNPOD_OPERATION_SPECS.endpointBilling, () =>
    G.EndpointBillingRequest.make({})
  ),
  getContainerRegistryAuth: requiredJsonOperation(client, config, G.RUNPOD_OPERATION_SPECS.getContainerRegistryAuth),
  getDocs: optionalTextOperation(client, config, G.RUNPOD_OPERATION_SPECS.getDocs, () => G.GetDocsRequest.make({})),
  getEndpoint: requiredJsonOperation(client, config, G.RUNPOD_OPERATION_SPECS.getEndpoint),
  getNetworkVolume: requiredJsonOperation(client, config, G.RUNPOD_OPERATION_SPECS.getNetworkVolume),
  getOpenAPI: optionalJsonOperation(client, config, G.RUNPOD_OPERATION_SPECS.getOpenAPI, () =>
    G.GetOpenAPIRequest.make({})
  ),
  getPod: requiredJsonOperation(client, config, G.RUNPOD_OPERATION_SPECS.getPod),
  getTemplate: requiredJsonOperation(client, config, G.RUNPOD_OPERATION_SPECS.getTemplate),
  listContainerRegistryAuths: optionalJsonOperation(
    client,
    config,
    G.RUNPOD_OPERATION_SPECS.listContainerRegistryAuths,
    () => G.ListContainerRegistryAuthsRequest.make({})
  ),
  listEndpoints: optionalJsonOperation(client, config, G.RUNPOD_OPERATION_SPECS.listEndpoints, () =>
    G.ListEndpointsRequest.make({})
  ),
  listNetworkVolumes: optionalJsonOperation(client, config, G.RUNPOD_OPERATION_SPECS.listNetworkVolumes, () =>
    G.ListNetworkVolumesRequest.make({})
  ),
  listPods: optionalJsonOperation(client, config, G.RUNPOD_OPERATION_SPECS.listPods, () => G.ListPodsRequest.make({})),
  listTemplates: optionalJsonOperation(client, config, G.RUNPOD_OPERATION_SPECS.listTemplates, () =>
    G.ListTemplatesRequest.make({})
  ),
  networkVolumeBilling: optionalJsonOperation(client, config, G.RUNPOD_OPERATION_SPECS.networkVolumeBilling, () =>
    G.NetworkVolumeBillingRequest.make({})
  ),
  podBilling: optionalJsonOperation(client, config, G.RUNPOD_OPERATION_SPECS.podBilling, () =>
    G.PodBillingRequest.make({})
  ),
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
  resetPod: requiredVoidOperation(client, config, G.RUNPOD_OPERATION_SPECS.resetPod),
  restartPod: requiredVoidOperation(client, config, G.RUNPOD_OPERATION_SPECS.restartPod),
  startPod: requiredVoidOperation(client, config, G.RUNPOD_OPERATION_SPECS.startPod),
  stopPod: requiredVoidOperation(client, config, G.RUNPOD_OPERATION_SPECS.stopPod),
  updateEndpoint: requiredJsonOperation(client, config, G.RUNPOD_OPERATION_SPECS.updateEndpoint),
  updateEndpointViaPost: requiredJsonOperation(client, config, G.RUNPOD_OPERATION_SPECS.updateEndpointViaPost),
  updateNetworkVolume: requiredJsonOperation(client, config, G.RUNPOD_OPERATION_SPECS.updateNetworkVolume),
  updateNetworkVolumeViaPost: requiredJsonOperation(
    client,
    config,
    G.RUNPOD_OPERATION_SPECS.updateNetworkVolumeViaPost
  ),
  updatePod: requiredJsonOperation(client, config, G.RUNPOD_OPERATION_SPECS.updatePod),
  updatePodViaPost: requiredJsonOperation(client, config, G.RUNPOD_OPERATION_SPECS.updatePodViaPost),
  updateTemplate: requiredJsonOperation(client, config, G.RUNPOD_OPERATION_SPECS.updateTemplate),
  updateTemplateViaPost: requiredJsonOperation(client, config, G.RUNPOD_OPERATION_SPECS.updateTemplateViaPost),
});

const makeRunpodFromConfig = Effect.fn("Runpod.makeRunpodFromConfig")(function* (
  config: ResolvedRunpodConfig
): Effect.fn.Return<RunpodShape, never, HttpClient.HttpClient> {
  const client = yield* HttpClient.HttpClient;
  return Runpod.of(makeService(client, config));
});

const makeRunpodFromEnvironment = Effect.fn("Runpod.makeRunpodFromEnvironment")(function* () {
  const apiKey = yield* Config.redacted("RUNPOD_API_KEY").pipe(Config.option);
  const apiUrl = yield* Config.string("RUNPOD_API_URL").pipe(Config.withDefault(RUNPOD_API_URL));

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
 * Effect service for all documented Runpod REST API v1 operations.
 *
 * **Example** (Create Runpod service layer)
 *
 * ```ts
 * import { Runpod, RunpodConfigInput } from "@beep/runpod"
 *
 * const layer = Runpod.makeLayer(
 *   RunpodConfigInput.make({ apiUrl: "https://rest.runpod.io/v1" })
 * )
 * console.log(layer)
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
