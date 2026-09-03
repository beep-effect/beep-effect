/**
 * Effect service for xAI REST and WebSocket API endpoints.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $XaiId } from "@beep/identity";
import { decodeJsonString, encodeJsonString } from "@beep/schema/Json";
import { UnknownFromJsonString } from "@beep/schema/Unknown";
import { A, Str, thunkEmptyStr } from "@beep/utils";
import * as O from "@beep/utils/Option";
import { Config, Context, Effect, flow, Layer, Match, pipe, Queue, Redacted, Stream } from "effect";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import { FetchHttpClient } from "effect/unstable/http";
import * as HttpClient from "effect/unstable/http/HttpClient";
import * as HttpClientRequest from "effect/unstable/http/HttpClientRequest";
import WebSocket from "ws";
import { XAI_API_URL, XAI_MANAGEMENT_API_URL, XAI_WEBSOCKET_URL, XAiConfigInput } from "./XAi.config.ts";
import { XAiError } from "./XAi.errors.ts";
import {
  XAiBinaryResponse,
  XAiJsonResponse,
  XAiNoBodyResponse,
  XAiQueryScalar,
  XAiRequestOptions,
  XAiServerSentEvent,
  XAiTextResponse,
} from "./XAi.models.ts";
import {
  XAI_ENDPOINTS,
  XAiAuthKind,
  XAiEndpointBase,
  XAiRequestBodyKind,
  XAiResponseBodyKind,
} from "./XAiEndpoints.models.ts";
import type * as HttpClientResponse from "effect/unstable/http/HttpClientResponse";
import type { XAiQueryValue, XAiResponse, XAiWebSocketEvent } from "./XAi.models.ts";
import type { XAiEndpointDescriptor, XAiEndpointMethodName } from "./XAiEndpoints.models.ts";

const $I = $XaiId.create("XAi.service");

/**
 * Endpoint method names backed by normal HTTP requests.
 *
 * **Example** (Type listModels method name)
 *
 * ```ts
 * import type { XAiHttpEndpointMethodName } from "@beep/xai"
 *
 * const methodName: XAiHttpEndpointMethodName = "listModels"
 * console.log(methodName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type XAiHttpEndpointMethodName = Exclude<
  XAiEndpointMethodName,
  "connectRealtimeVoice" | "connectStreamingStt" | "connectStreamingTts"
>;

/**
 * Endpoint method names backed by WebSocket sessions.
 *
 * **Example** (Type WebSocket method name)
 *
 * ```ts
 * import type { XAiWebSocketEndpointMethodName } from "@beep/xai"
 *
 * const methodName: XAiWebSocketEndpointMethodName = "connectRealtimeVoice"
 * console.log(methodName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type XAiWebSocketEndpointMethodName = Extract<
  XAiEndpointMethodName,
  "connectRealtimeVoice" | "connectStreamingStt" | "connectStreamingTts"
>;

/**
 * Function shape used by every non-streaming xAI HTTP endpoint method.
 *
 * **Example** (Return NoBody response Effect)
 *
 * ```ts
 * import { Effect } from "effect"
 * import type { XAiEndpointMethod } from "@beep/xai"
 * import { XAiNoBodyResponse } from "@beep/xai"
 *
 * const method: XAiEndpointMethod = () =>
 *   Effect.succeed(new XAiNoBodyResponse({ headers: {}, status: 204 }))
 *
 * const tag = Effect.runSync(Effect.map(method(), (response) => response._tag))
 * console.log(tag) // "NoBody"
 * ```
 *
 * @effects
 * Runs one HTTP-backed xAI endpoint request with already resolved driver
 * configuration. Request, transport, and response failures are reported as
 * `XAiError` values in the Effect error channel.
 * @category models
 * @since 0.0.0
 */
export type XAiEndpointMethod = (request?: XAiRequestOptions) => Effect.Effect<XAiResponse, XAiError, never>;

/**
 * Function shape used by streaming xAI server-sent event helpers.
 *
 * **Example** (Create empty stream method)
 *
 * ```ts
 * import { Stream } from "effect"
 * import type { XAiStreamMethod } from "@beep/xai"
 *
 * const stream: XAiStreamMethod = () => Stream.empty
 *
 * console.log(stream)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type XAiStreamMethod = (request?: XAiRequestOptions) => Stream.Stream<XAiServerSentEvent, XAiError>;

/**
 * Active xAI WebSocket session handle.
 *
 * **Example** (Send JSON session frame)
 *
 * ```ts
 * import type { XAiWebSocketSession } from "@beep/xai"
 *
 * const sendDone = (session: XAiWebSocketSession) => session.sendJson({ type: "audio.done" })
 * console.log(sendDone)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface XAiWebSocketSession {
  readonly close: (code?: number, reason?: string) => Effect.Effect<void, never>;
  readonly events: Stream.Stream<XAiWebSocketEvent>;
  readonly sendBytes: (bytes: Uint8Array) => Effect.Effect<void, XAiError>;
  readonly sendJson: (body: unknown) => Effect.Effect<void, XAiError>;
  readonly sendText: (text: string) => Effect.Effect<void, XAiError>;
}

/**
 * Function shape used by xAI WebSocket endpoint methods.
 *
 * **Example** (Open session and send text)
 *
 * ```ts
 * import { Effect, Stream } from "effect"
 * import type { XAiWebSocketMethod } from "@beep/xai"
 *
 * const connect: XAiWebSocketMethod = () =>
 *   Effect.succeed({
 *     close: () => Effect.void,
 *     events: Stream.empty,
 *     sendBytes: () => Effect.void,
 *     sendJson: () => Effect.void,
 *     sendText: () => Effect.void
 *   })
 *
 * const sent = Effect.runSync(
 *   connect().pipe(
 *     Effect.flatMap((session) => session.sendText("ping")),
 *     Effect.map(() => "sent")
 *   )
 * )
 * console.log(sent) // "sent"
 * ```
 *
 * @effects
 * Opens an xAI WebSocket session. The returned handle writes frames through
 * `sendBytes`, `sendJson`, or `sendText`; connection and frame failures are
 * reported as `XAiError` values in the Effect error channel.
 * @category models
 * @since 0.0.0
 */
export type XAiWebSocketMethod = (request?: XAiRequestOptions) => Effect.Effect<XAiWebSocketSession, XAiError>;

/**
 * Public service shape for every documented xAI endpoint plus SSE helpers.
 *
 * **Example** (Pick service method key)
 *
 * ```ts
 * import type { XAiShape } from "@beep/xai"
 *
 * type XAiServiceKey = keyof XAiShape
 *
 * const key: XAiServiceKey = "listModels"
 * console.log(key)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export type XAiShape = {
  readonly [MethodName in XAiHttpEndpointMethodName]: XAiEndpointMethod;
} & {
  readonly [MethodName in XAiWebSocketEndpointMethodName]: XAiWebSocketMethod;
} & {
  readonly streamAnthropicMessage: XAiStreamMethod;
  readonly streamChatCompletion: XAiStreamMethod;
  readonly streamLegacyCompletion: XAiStreamMethod;
  readonly streamResponse: XAiStreamMethod;
};

type ResolvedXAiConfig = {
  readonly apiKey: O.Option<Redacted.Redacted<string>>;
  readonly apiUrl: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly managementApiKey: O.Option<Redacted.Redacted<string>>;
  readonly managementApiUrl: string;
  readonly websocketUrl: string;
};

const resolveConfig = (config: XAiConfigInput): ResolvedXAiConfig => ({
  apiKey: config.apiKey,
  apiUrl: config.apiUrl,
  headers: config.headers,
  managementApiKey: config.managementApiKey,
  managementApiUrl: config.managementApiUrl,
  websocketUrl: config.websocketUrl,
});

// shared driver boundary idiom; no in-family home; future foundation capability candidate.
// fallow-ignore-next-line code-duplication -- xAI keeps response media classification at its provider HTTP boundary
const isJsonContentType = (contentType: string): boolean => Str.includes("application/json")(contentType);

const isTextContentType = (contentType: string): boolean =>
  Str.startsWith("text/")(contentType) || Str.includes("text/event-stream")(contentType);

const responseContentType = (response: HttpClientResponse.HttpClientResponse): O.Option<string> =>
  O.fromNullishOr(response.headers["content-type"]);

const diagnosticsFor = (event: string, error: XAiError): Readonly<Record<string, unknown>> => ({
  event,
  methodName: O.getOrUndefined(error.methodName),
  path: O.getOrUndefined(error.path),
  provider: "xai",
  reason: error.reason,
  ...O.getSomesStruct({
    cause: error.cause,
    status: error.status,
  }),
});

const logDriverFailure =
  (event: string) =>
  (error: XAiError): Effect.Effect<void> =>
    Effect.logDebug(diagnosticsFor(event, error));

const logStatusFailure = (error: XAiError): Effect.Effect<void> =>
  Effect.logWarning(diagnosticsFor("response-status", error));

const defaultAcceptHeader = (descriptor: XAiEndpointDescriptor): string =>
  XAiResponseBodyKind.$match(descriptor.response, {
    binary: () => "application/octet-stream",
    json: () => "application/json",
    none: () => "application/json",
    sse: () => "text/event-stream",
    websocket: () => "application/json",
  });

const endpointBaseToUrl = (config: ResolvedXAiConfig) =>
  XAiEndpointBase.$match({
    api: () => config.apiUrl,
    management: () => config.managementApiUrl,
    websocket: () => config.websocketUrl,
  });

const baseUrlFor = (config: ResolvedXAiConfig, descriptor: XAiEndpointDescriptor): string =>
  endpointBaseToUrl(config)(descriptor.base);

const selectToken = (
  config: ResolvedXAiConfig,
  descriptor: XAiEndpointDescriptor
): Effect.Effect<Redacted.Redacted<string>, XAiError> =>
  pipe(
    XAiAuthKind.$match(descriptor.auth, {
      "api-key": () => config.apiKey,
      "management-key": () => config.managementApiKey,
    }),
    Effect.fromOption(() => XAiError.fromDescriptor(descriptor, "config"))
  );

// shared driver boundary idiom; no in-family home; future foundation capability candidate.
// fallow-ignore-next-line code-duplication -- xAI keeps path interpolation local to its descriptor-driven request builder
const applyPathParams = (path: string, params: Readonly<Record<string, string>>): string =>
  pipe(
    params,
    R.reduce(path, (currentPath, value, key) => Str.replace(`{${key}}`, encodeURIComponent(value))(currentPath))
  );

const failMissingPathParam = (descriptor: XAiEndpointDescriptor, path: string): Effect.Effect<void, XAiError> =>
  Str.includes("{")(path) ? Effect.fail(XAiError.fromDescriptor(descriptor, "request encoding")) : Effect.void;

const addRequestHeaders = (
  request: HttpClientRequest.HttpClientRequest,
  config: ResolvedXAiConfig,
  descriptor: XAiEndpointDescriptor,
  options: XAiRequestOptions,
  token: Redacted.Redacted<string>
): HttpClientRequest.HttpClientRequest =>
  pipe(
    request,
    HttpClientRequest.accept(options.accept ?? defaultAcceptHeader(descriptor)),
    HttpClientRequest.setHeaders(config.headers),
    HttpClientRequest.setHeaders(options.headers),
    HttpClientRequest.bearerToken(token)
  );

const hasRequestPayload = (options: XAiRequestOptions): boolean =>
  P.isNotUndefined(options.body) || P.isNotUndefined(options.bytes) || P.isNotUndefined(options.formData);

const failUnexpectedRequestPayload = (
  descriptor: XAiEndpointDescriptor,
  options: XAiRequestOptions
): Effect.Effect<void, XAiError> =>
  hasRequestPayload(options) ? Effect.fail(XAiError.fromDescriptor(descriptor, "request encoding")) : Effect.void;

const hasUnexpectedMultipartPayload = (options: XAiRequestOptions): boolean =>
  P.isNotUndefined(options.body) || P.isNotUndefined(options.bytes);

const hasUnexpectedBinaryPayload = (options: XAiRequestOptions): boolean =>
  P.isNotUndefined(options.body) || P.isNotUndefined(options.formData);

const hasUnexpectedJsonPayload = (options: XAiRequestOptions): boolean =>
  P.isNotUndefined(options.bytes) || P.isNotUndefined(options.formData);

const addRequestBody = (
  request: HttpClientRequest.HttpClientRequest,
  descriptor: XAiEndpointDescriptor,
  options: XAiRequestOptions
): Effect.Effect<HttpClientRequest.HttpClientRequest, XAiError> =>
  XAiRequestBodyKind.$match(descriptor.body, {
    binary: () => {
      if (hasUnexpectedBinaryPayload(options)) {
        return Effect.fail(XAiError.fromDescriptor(descriptor, "request encoding"));
      }

      return P.isNotUndefined(options.bytes)
        ? Effect.succeed(HttpClientRequest.bodyUint8Array(request, options.bytes, options.contentType))
        : Effect.fail(XAiError.fromDescriptor(descriptor, "request encoding"));
    },
    json: () => {
      if (hasUnexpectedJsonPayload(options)) {
        return Effect.fail(XAiError.fromDescriptor(descriptor, "request encoding"));
      }

      if (P.isUndefined(options.body)) {
        return Effect.succeed(request);
      }

      return pipe(
        HttpClientRequest.bodyJson(request, options.body),
        Effect.mapError((cause) => XAiError.fromDescriptor(descriptor, "request encoding", { cause }))
      );
    },
    multipart: () => {
      if (hasUnexpectedMultipartPayload(options)) {
        return Effect.fail(XAiError.fromDescriptor(descriptor, "request encoding"));
      }

      return P.isNotUndefined(options.formData)
        ? Effect.succeed(HttpClientRequest.bodyFormData(request, options.formData))
        : Effect.fail(XAiError.fromDescriptor(descriptor, "multipart encoding"));
    },
    none: () => pipe(failUnexpectedRequestPayload(descriptor, options), Effect.as(request)),
    websocket: () => pipe(failUnexpectedRequestPayload(descriptor, options), Effect.as(request)),
  });

const buildRequest = Effect.fn("XAi.buildRequest")(function* (
  config: ResolvedXAiConfig,
  descriptor: XAiEndpointDescriptor,
  options: XAiRequestOptions
) {
  const path = applyPathParams(descriptor.path, options.path);
  yield* failMissingPathParam(descriptor, path);
  const token = yield* selectToken(config, descriptor);

  const request = pipe(
    HttpClientRequest.make(descriptor.method)(`${baseUrlFor(config, descriptor)}${path}`, {
      urlParams: options.query,
    }),
    (baseRequest) => addRequestHeaders(baseRequest, config, descriptor, options, token)
  );

  return yield* addRequestBody(request, descriptor, options);
});

const executeRaw = Effect.fn("XAi.executeRaw")(function* (
  client: HttpClient.HttpClient,
  config: ResolvedXAiConfig,
  descriptor: XAiEndpointDescriptor,
  options: XAiRequestOptions
) {
  const request = yield* buildRequest(config, descriptor, options);

  return yield* client.execute(request).pipe(
    Effect.mapError((cause) => XAiError.fromDescriptor(descriptor, "transport", { cause })),
    Effect.tapError(logDriverFailure("transport"))
  );
});

// shared driver boundary idiom; no in-family home; future foundation capability candidate.
// fallow-ignore-next-line code-duplication -- xAI assembles provider-specific response metadata at its decode boundary
const responseContext = (response: HttpClientResponse.HttpClientResponse) => ({
  contentType: responseContentType(response),
  headers: response.headers,
  status: response.status,
});

const ensureSuccessStatus = (
  descriptor: XAiEndpointDescriptor,
  response: HttpClientResponse.HttpClientResponse
): Effect.Effect<HttpClientResponse.HttpClientResponse, XAiError> =>
  response.status >= 200 && response.status < 300
    ? Effect.succeed(response)
    : pipe(XAiError.fromDescriptor(descriptor, "response status", { status: response.status }), (error) =>
        pipe(logStatusFailure(error), Effect.andThen(Effect.fail(error)))
      );

const contentMediaType: (contentType: string) => string = flow(
  Str.split(";"),
  A.get(0),
  O.getOrElse(thunkEmptyStr),
  Str.trim,
  Str.toLowerCase
);

const isSseContentType = (contentType: string): boolean => contentMediaType(contentType) === "text/event-stream";

const ensureSseContentType = (
  descriptor: XAiEndpointDescriptor,
  response: HttpClientResponse.HttpClientResponse
): Effect.Effect<HttpClientResponse.HttpClientResponse, XAiError> =>
  pipe(
    responseContentType(response),
    O.filter(isSseContentType),
    O.match({
      onNone: () => Effect.fail(XAiError.fromDescriptor(descriptor, "sse decoding")),
      onSome: () => Effect.succeed(response),
    })
  );

const decodeBinaryResponse = (
  descriptor: XAiEndpointDescriptor,
  response: HttpClientResponse.HttpClientResponse
): Effect.Effect<XAiBinaryResponse, XAiError> =>
  pipe(
    response.arrayBuffer,
    Effect.mapError((cause) => XAiError.fromDescriptor(descriptor, "response decoding", { cause })),
    Effect.map((buffer) =>
      XAiBinaryResponse.make({
        bytes: new Uint8Array(buffer),
        ...responseContext(response),
      })
    )
  );

const decodeTextResponse = (
  descriptor: XAiEndpointDescriptor,
  response: HttpClientResponse.HttpClientResponse
): Effect.Effect<XAiTextResponse, XAiError> =>
  pipe(
    response.text,
    Effect.mapError((cause) => XAiError.fromDescriptor(descriptor, "response decoding", { cause })),
    Effect.map((text) =>
      XAiTextResponse.make({
        text,
        ...responseContext(response),
      })
    )
  );

const decodeJsonResponse = (
  descriptor: XAiEndpointDescriptor,
  response: HttpClientResponse.HttpClientResponse
): Effect.Effect<XAiJsonResponse, XAiError> =>
  pipe(
    response.json,
    Effect.mapError((cause) => XAiError.fromDescriptor(descriptor, "response decoding", { cause })),
    Effect.map((body) =>
      XAiJsonResponse.make({
        body,
        ...responseContext(response),
      })
    )
  );

const decodeContentTypedResponse = (
  descriptor: XAiEndpointDescriptor,
  response: HttpClientResponse.HttpClientResponse,
  prefersJson: boolean
): Effect.Effect<XAiResponse, XAiError> => {
  const contentType = O.getOrElse(responseContentType(response), thunkEmptyStr);

  if (isTextContentType(contentType)) {
    return decodeTextResponse(descriptor, response);
  }

  if (prefersJson || isJsonContentType(contentType)) {
    return decodeJsonResponse(descriptor, response);
  }

  return decodeBinaryResponse(descriptor, response);
};

const decodeResponse = Effect.fn("XAi.decodeResponse")(function* (
  descriptor: XAiEndpointDescriptor,
  response: HttpClientResponse.HttpClientResponse
) {
  const successfulResponse = yield* ensureSuccessStatus(descriptor, response);
  return yield* XAiResponseBodyKind.$match(descriptor.response, {
    binary: () => decodeBinaryResponse(descriptor, successfulResponse),
    json: () => decodeContentTypedResponse(descriptor, successfulResponse, true),
    none: () =>
      Effect.succeed(
        XAiNoBodyResponse.make({
          ...responseContext(successfulResponse),
        })
      ),
    sse: () => decodeContentTypedResponse(descriptor, successfulResponse, false),
    websocket: () => decodeContentTypedResponse(descriptor, successfulResponse, false),
  });
});

const executeOperation = (
  client: HttpClient.HttpClient,
  config: ResolvedXAiConfig,
  descriptor: XAiEndpointDescriptor
): XAiEndpointMethod => {
  const operation = Effect.fn(`XAi.${descriptor.methodName}`)(function* (request = XAiRequestOptions.make({})) {
    const response = yield* executeRaw(client, config, descriptor, request);
    return yield* decodeResponse(descriptor, response);
  });

  return (request) =>
    operation(request).pipe(
      Effect.tapError(logDriverFailure("operation")),
      Effect.withSpan("XAi.operation", {
        attributes: {
          methodName: descriptor.methodName,
          path: descriptor.path,
          provider: "xai",
        },
      })
    );
};

const addStreamFlag = (body: unknown): unknown => (P.isObject(body) ? { ...body, stream: true } : { stream: true });

const makeStreamingRequest = (request = XAiRequestOptions.make({})): XAiRequestOptions =>
  XAiRequestOptions.make({
    ...request,
    accept: "text/event-stream",
    body: addStreamFlag(request.body),
  });

const decodeSseJson = decodeJsonString;
const decodeJsonOption = UnknownFromJsonString.decodeUnknownOption;
const encodeJson = encodeJsonString;

// shared driver boundary idiom; no in-family home; future foundation capability candidate.
// fallow-ignore-next-line code-duplication -- xAI keeps data-line parsing local to its provider SSE decoder
const dataLine = (line: string): O.Option<string> =>
  Str.startsWith("data:")(line) ? O.some(Str.trim(Str.slice(5)(line))) : O.none();

const sseBlockData = (block: string): O.Option<string> => {
  const data = pipe(A.fromIterable(Str.linesIterator(block)), A.map(dataLine), A.getSomes, A.join("\n"), Str.trim);
  return Str.isEmpty(data) ? O.none() : O.some(data);
};

const parseSseData = (
  descriptor: XAiEndpointDescriptor,
  data: string,
  index: number
): Effect.Effect<XAiServerSentEvent, XAiError> =>
  data === "[DONE]"
    ? Effect.succeed(XAiServerSentEvent.make({ done: true, index }))
    : pipe(
        decodeSseJson(data),
        Effect.map((decoded) => XAiServerSentEvent.make({ data: decoded, done: false, index })),
        Effect.mapError((cause) => XAiError.fromDescriptor(descriptor, "sse decoding", { cause }))
      );

type SseDataChunk = {
  readonly data: string;
  readonly index: number;
};

type SseLineState = {
  readonly index: number;
  readonly lines: ReadonlyArray<string>;
};

const emptySseLineState = (index = 0): SseLineState => ({
  index,
  lines: A.empty(),
});

const makeSseLineResult = (
  state: SseLineState,
  chunks: ReadonlyArray<SseDataChunk>
): readonly [SseLineState, ReadonlyArray<SseDataChunk>] => [state, chunks];

const collectSseBlock = (state: SseLineState): readonly [SseLineState, ReadonlyArray<SseDataChunk>] =>
  pipe(
    state.lines,
    A.join("\n"),
    sseBlockData,
    O.match({
      onNone: () => makeSseLineResult(emptySseLineState(state.index), A.empty<SseDataChunk>()),
      onSome: (data) => makeSseLineResult(emptySseLineState(state.index + 1), A.make({ data, index: state.index })),
    })
  );

const collectSseLine = (state: SseLineState, line: string): readonly [SseLineState, ReadonlyArray<SseDataChunk>] =>
  Str.isEmpty(Str.trim(line))
    ? collectSseBlock(state)
    : makeSseLineResult({ ...state, lines: A.append(state.lines, line) }, A.empty<SseDataChunk>());

const streamSseData = (
  descriptor: XAiEndpointDescriptor,
  response: HttpClientResponse.HttpClientResponse
): Stream.Stream<XAiServerSentEvent, XAiError> =>
  response.stream.pipe(
    Stream.mapError((cause) => XAiError.fromDescriptor(descriptor, "sse decoding", { cause })),
    Stream.decodeText(),
    Stream.splitLines,
    Stream.mapAccum(emptySseLineState, collectSseLine, { onHalt: (state) => collectSseBlock(state)[1] }),
    Stream.mapEffect(({ data, index }) => parseSseData(descriptor, data, index), { concurrency: 1 })
  );

const streamOperation =
  (client: HttpClient.HttpClient, config: ResolvedXAiConfig, descriptor: XAiEndpointDescriptor): XAiStreamMethod =>
  (request) =>
    Stream.unwrap(
      Effect.gen(function* () {
        const response = yield* executeRaw(client, config, descriptor, makeStreamingRequest(request));
        const successfulResponse = yield* ensureSuccessStatus(descriptor, response);
        const sseResponse = yield* ensureSseContentType(descriptor, successfulResponse);
        return streamSseData(descriptor, sseResponse);
      })
    ).pipe(
      Stream.tapError(logDriverFailure("stream")),
      Stream.withSpan("XAi.stream", {
        attributes: {
          methodName: descriptor.methodName,
          path: descriptor.path,
          provider: "xai",
        },
      })
    );

const rawDataToBytes = (data: WebSocket.RawData): Uint8Array => {
  if (P.isString(data)) {
    return new TextEncoder().encode(data);
  }
  if (A.isArray(data)) {
    return new Uint8Array(Buffer.concat(data));
  }
  return new Uint8Array(data);
};

const rawDataToText = (data: WebSocket.RawData): string => new TextDecoder().decode(rawDataToBytes(data));

const queryScalarToString = (value: XAiQueryScalar): string =>
  Match.type<XAiQueryScalar>().pipe(
    Match.when(P.isString, (text) => text),
    Match.when(P.isNumber, (number) => `${number}`),
    Match.when(P.isBoolean, (boolean) => (boolean ? "true" : "false")),
    Match.when(null, () => "null"),
    Match.exhaustive
  )(value);

const queryValueToStrings = (value: XAiQueryValue): ReadonlyArray<string> => {
  if (A.isArray(value)) {
    return pipe(
      value,
      A.map((entry) => XAiQueryScalar.decodeUnknownOption(entry)),
      A.getSomes,
      A.map(queryScalarToString)
    );
  }

  return pipe(
    XAiQueryScalar.decodeUnknownOption(value),
    O.map((scalar) => A.make(queryScalarToString(scalar))),
    O.getOrElse(A.empty<string>)
  );
};

const parseWebSocketMessage = (data: WebSocket.RawData, isBinary: boolean): XAiWebSocketEvent => {
  if (isBinary) {
    return {
      bytes: rawDataToBytes(data),
      isBinary,
      kind: "message",
    };
  }

  const text = rawDataToText(data);
  return {
    data: O.getOrElse(decodeJsonOption(text), () => text),
    isBinary,
    kind: "message",
    text,
  };
};

const websocketErrorData = (error: Error): { readonly name: string } => ({
  name: Str.isNonEmpty(error.name) ? error.name : "Error",
});

const websocketUrl = Effect.fn("XAi.websocketUrl")(function* (
  config: ResolvedXAiConfig,
  descriptor: XAiEndpointDescriptor,
  options: XAiRequestOptions
) {
  const path = applyPathParams(descriptor.path, options.path);
  yield* failMissingPathParam(descriptor, path);
  const url = yield* Effect.try({
    try: () => new URL(`${baseUrlFor(config, descriptor)}${path}`),
    catch: (cause) => XAiError.fromDescriptor(descriptor, "websocket", { cause }),
  });

  pipe(
    options.query,
    R.reduce(url, (currentUrl, value, key) => {
      for (const entry of queryValueToStrings(value)) {
        currentUrl.searchParams.append(key, entry);
      }

      return currentUrl;
    })
  );

  return url.toString();
});

const connectSocket = Effect.fn("XAi.connectSocket")(function* (
  config: ResolvedXAiConfig,
  descriptor: XAiEndpointDescriptor,
  options: XAiRequestOptions
) {
  const url = yield* websocketUrl(config, descriptor, options);
  const token = yield* selectToken(config, descriptor);
  const headers = {
    ...config.headers,
    ...options.headers,
    authorization: `Bearer ${Redacted.value(token)}`,
  };

  return yield* Effect.callback<WebSocket, XAiError>((resume) => {
    const socket = new WebSocket(url, { headers });
    const cleanup = () => {
      socket.off("open", onOpen);
      socket.off("error", onError);
    };
    const onOpen = () => {
      cleanup();
      resume(Effect.succeed(socket));
    };
    const onError = (cause: Error) => {
      cleanup();
      resume(Effect.fail(XAiError.fromDescriptor(descriptor, "websocket", { cause })));
    };

    socket.once("open", onOpen);
    socket.once("error", onError);

    return Effect.sync(() => {
      cleanup();
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        socket.close();
      }
    });
  });
});

const makeWebSocketEvents = (socket: WebSocket): Stream.Stream<XAiWebSocketEvent> =>
  Stream.callback<XAiWebSocketEvent>((queue) =>
    Effect.acquireRelease(
      Effect.sync(() => {
        const onMessage = (data: WebSocket.RawData, isBinary: boolean) =>
          Queue.offerUnsafe(queue, parseWebSocketMessage(data, isBinary));
        const onClose = (code: number, reason: Buffer) => {
          Queue.offerUnsafe(queue, { code, kind: "close", reason: reason.toString("utf8") });
          Queue.endUnsafe(queue);
        };
        const onError = (error: Error) =>
          Queue.offerUnsafe(queue, { data: websocketErrorData(error), kind: "error", reason: "websocket error" });

        socket.on("message", onMessage);
        socket.on("close", onClose);
        socket.on("error", onError);

        return { onClose, onError, onMessage };
      }),
      ({ onClose, onError, onMessage }) =>
        Effect.sync(() => {
          socket.off("message", onMessage);
          socket.off("close", onClose);
          socket.off("error", onError);
          if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
            socket.close();
          }
        })
    )
  );

const sendSocketText = (
  descriptor: XAiEndpointDescriptor,
  socket: WebSocket,
  text: string
): Effect.Effect<void, XAiError> =>
  Effect.callback<void, XAiError>((resume) =>
    socket.send(text, (error) =>
      resume(
        P.isUndefined(error)
          ? Effect.void
          : Effect.fail(XAiError.fromDescriptor(descriptor, "websocket", { cause: error }))
      )
    )
  );

const sendSocketBytes = (
  descriptor: XAiEndpointDescriptor,
  socket: WebSocket,
  bytes: Uint8Array
): Effect.Effect<void, XAiError> =>
  Effect.callback<void, XAiError>((resume) =>
    socket.send(bytes, { binary: true }, (error) =>
      resume(
        P.isUndefined(error)
          ? Effect.void
          : Effect.fail(XAiError.fromDescriptor(descriptor, "websocket", { cause: error }))
      )
    )
  );

const encodeSocketJson = (descriptor: XAiEndpointDescriptor, body: unknown): Effect.Effect<string, XAiError> =>
  encodeJson(body).pipe(Effect.mapError((cause) => XAiError.fromDescriptor(descriptor, "websocket", { cause })));

const websocketOperation = (config: ResolvedXAiConfig, descriptor: XAiEndpointDescriptor): XAiWebSocketMethod => {
  const operation = Effect.fn(`XAi.${descriptor.methodName}`)(function* (request = XAiRequestOptions.make({})) {
    yield* failUnexpectedRequestPayload(descriptor, request);
    const socket = yield* connectSocket(config, descriptor, request);

    return {
      close: (code?: number, reason?: string) => Effect.sync(() => socket.close(code, reason)),
      events: makeWebSocketEvents(socket),
      sendBytes: (bytes: Uint8Array) => sendSocketBytes(descriptor, socket, bytes),
      sendJson: (body: unknown) =>
        pipe(
          encodeSocketJson(descriptor, body),
          Effect.flatMap((text) => sendSocketText(descriptor, socket, text))
        ),
      sendText: (text: string) => sendSocketText(descriptor, socket, text),
    };
  });

  return (request) =>
    operation(request).pipe(
      Effect.tapError(logDriverFailure("websocket")),
      Effect.withSpan("XAi.websocket", {
        attributes: {
          methodName: descriptor.methodName,
          path: descriptor.path,
          provider: "xai",
        },
      })
    );
};

const endpointByMethodName = Effect.fn("XAi.endpointByMethodName")(function* (methodName: XAiEndpointMethodName) {
  return yield* pipe(
    XAI_ENDPOINTS,
    A.findFirst((descriptor) => descriptor.methodName === methodName),
    Effect.fromOption(() => XAiError.make({ methodName: O.some(methodName), reason: "config" }))
  );
});

const makeService = (client: HttpClient.HttpClient, config: ResolvedXAiConfig): XAiShape => {
  const httpByMethodName = (methodName: XAiHttpEndpointMethodName): XAiEndpointMethod =>
    Effect.fn(`XAi.${methodName}`)(function* (request = XAiRequestOptions.make({})) {
      const descriptor = yield* endpointByMethodName(methodName);
      return yield* executeOperation(client, config, descriptor)(request);
    });
  const websocketByMethodName = (methodName: XAiWebSocketEndpointMethodName): XAiWebSocketMethod =>
    Effect.fn(`XAi.${methodName}`)(function* (request = XAiRequestOptions.make({})) {
      const descriptor = yield* endpointByMethodName(methodName);
      return yield* websocketOperation(config, descriptor)(request);
    });
  const streamByMethodName =
    (methodName: XAiEndpointMethodName): XAiStreamMethod =>
    (request) =>
      Stream.unwrap(
        endpointByMethodName(methodName).pipe(
          Effect.map((descriptor) => streamOperation(client, config, descriptor)(request))
        )
      );

  return {
    addBatchRequests: httpByMethodName("addBatchRequests"),
    addCollectionDocument: httpByMethodName("addCollectionDocument"),
    batchGetCollectionDocuments: httpByMethodName("batchGetCollectionDocuments"),
    cancelBatch: httpByMethodName("cancelBatch"),
    connectRealtimeVoice: websocketByMethodName("connectRealtimeVoice"),
    connectStreamingStt: websocketByMethodName("connectStreamingStt"),
    connectStreamingTts: websocketByMethodName("connectStreamingTts"),
    createAnthropicCompletion: httpByMethodName("createAnthropicCompletion"),
    createAnthropicMessage: httpByMethodName("createAnthropicMessage"),
    createApiKey: httpByMethodName("createApiKey"),
    createBatch: httpByMethodName("createBatch"),
    createChatCompletion: httpByMethodName("createChatCompletion"),
    createCollection: httpByMethodName("createCollection"),
    createCustomVoice: httpByMethodName("createCustomVoice"),
    createLegacyCompletion: httpByMethodName("createLegacyCompletion"),
    createRealtimeClientSecret: httpByMethodName("createRealtimeClientSecret"),
    createResponse: httpByMethodName("createResponse"),
    deleteApiKey: httpByMethodName("deleteApiKey"),
    deleteCollection: httpByMethodName("deleteCollection"),
    deleteCollectionDocument: httpByMethodName("deleteCollectionDocument"),
    deleteCustomVoice: httpByMethodName("deleteCustomVoice"),
    deleteFile: httpByMethodName("deleteFile"),
    deleteResponse: httpByMethodName("deleteResponse"),
    downloadCustomVoiceAudio: httpByMethodName("downloadCustomVoiceAudio"),
    downloadFileContent: httpByMethodName("downloadFileContent"),
    editImage: httpByMethodName("editImage"),
    editVideo: httpByMethodName("editVideo"),
    extendVideo: httpByMethodName("extendVideo"),
    generateImage: httpByMethodName("generateImage"),
    generateVideo: httpByMethodName("generateVideo"),
    getApiKey: httpByMethodName("getApiKey"),
    getApiKeyPropagation: httpByMethodName("getApiKeyPropagation"),
    getBatch: httpByMethodName("getBatch"),
    getBillingInfo: httpByMethodName("getBillingInfo"),
    getCollection: httpByMethodName("getCollection"),
    getCollectionDocument: httpByMethodName("getCollectionDocument"),
    getCustomVoice: httpByMethodName("getCustomVoice"),
    getDeferredChatCompletion: httpByMethodName("getDeferredChatCompletion"),
    getFile: httpByMethodName("getFile"),
    getImageGenerationModel: httpByMethodName("getImageGenerationModel"),
    getLanguageModel: httpByMethodName("getLanguageModel"),
    getModel: httpByMethodName("getModel"),
    getPostpaidSpendingLimits: httpByMethodName("getPostpaidSpendingLimits"),
    getPrepaidBalance: httpByMethodName("getPrepaidBalance"),
    getResponse: httpByMethodName("getResponse"),
    getTtsVoice: httpByMethodName("getTtsVoice"),
    getVideo: httpByMethodName("getVideo"),
    getVideoGenerationModel: httpByMethodName("getVideoGenerationModel"),
    initializeFileUpload: httpByMethodName("initializeFileUpload"),
    listApiKeys: httpByMethodName("listApiKeys"),
    listAuditEvents: httpByMethodName("listAuditEvents"),
    listBatchRequests: httpByMethodName("listBatchRequests"),
    listBatchResults: httpByMethodName("listBatchResults"),
    listBatches: httpByMethodName("listBatches"),
    listCollectionDocuments: httpByMethodName("listCollectionDocuments"),
    listCollections: httpByMethodName("listCollections"),
    listCustomVoices: httpByMethodName("listCustomVoices"),
    listEndpointAcls: httpByMethodName("listEndpointAcls"),
    listFiles: httpByMethodName("listFiles"),
    listImageGenerationModels: httpByMethodName("listImageGenerationModels"),
    listInvoices: httpByMethodName("listInvoices"),
    listLanguageModels: httpByMethodName("listLanguageModels"),
    listModels: httpByMethodName("listModels"),
    listPaymentMethods: httpByMethodName("listPaymentMethods"),
    listTeamModels: httpByMethodName("listTeamModels"),
    listTtsVoices: httpByMethodName("listTtsVoices"),
    listVideoGenerationModels: httpByMethodName("listVideoGenerationModels"),
    previewPostpaidInvoice: httpByMethodName("previewPostpaidInvoice"),
    queryUsage: httpByMethodName("queryUsage"),
    regenerateCollectionDocument: httpByMethodName("regenerateCollectionDocument"),
    rotateApiKey: httpByMethodName("rotateApiKey"),
    searchDocuments: httpByMethodName("searchDocuments"),
    setBillingInfo: httpByMethodName("setBillingInfo"),
    setDefaultPaymentMethod: httpByMethodName("setDefaultPaymentMethod"),
    setPostpaidSpendingLimits: httpByMethodName("setPostpaidSpendingLimits"),
    streamAnthropicMessage: streamByMethodName("createAnthropicMessage"),
    streamChatCompletion: streamByMethodName("createChatCompletion"),
    streamLegacyCompletion: streamByMethodName("createLegacyCompletion"),
    streamResponse: streamByMethodName("createResponse"),
    synthesizeSpeech: httpByMethodName("synthesizeSpeech"),
    tokenizeText: httpByMethodName("tokenizeText"),
    topUpPrepaidBalance: httpByMethodName("topUpPrepaidBalance"),
    transcribeSpeech: httpByMethodName("transcribeSpeech"),
    updateApiKey: httpByMethodName("updateApiKey"),
    updateCollection: httpByMethodName("updateCollection"),
    updateCustomVoice: httpByMethodName("updateCustomVoice"),
    updateFile: httpByMethodName("updateFile"),
    uploadFile: httpByMethodName("uploadFile"),
    uploadFileChunks: httpByMethodName("uploadFileChunks"),
    validateManagementKey: httpByMethodName("validateManagementKey"),
  } satisfies XAiShape;
};

/**
 * Effect service for all documented xAI API endpoints.
 *
 * **Example** (Call listModels via service)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { XAi } from "@beep/xai"
 *
 * const program = Effect.gen(function* () {
 *   const xai = yield* XAi
 *   return yield* xai.listModels()
 * })
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class XAi extends Context.Service<XAi, XAiShape>()($I`XAi`) {
  /**
   * Build an xAI layer from explicit runtime configuration.
   *
   * **Example** (Build layer from config)
   *
   * ```ts
   * import { Redacted } from "effect"
   * import * as O from "effect/Option"
   * import { XAi, XAiConfigInput } from "@beep/xai"
   *
   * const layer = XAi.makeLayer(XAiConfigInput.make({ apiKey: O.some(Redacted.make("test-key")) }))
   * console.log(layer)
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly makeLayer = (config = XAiConfigInput.make({})): Layer.Layer<XAi, never, HttpClient.HttpClient> =>
    Layer.effect(
      XAi,
      Effect.gen(function* () {
        const client = yield* HttpClient.HttpClient;
        return XAi.of(makeService(client, resolveConfig(config)));
      })
    );

  /**
   * Live xAI layer backed by optional API and management credentials.
   *
   * **Example** (Use live service layer)
   *
   * ```ts
   * import { XAi } from "@beep/xai"
   *
   * const layer = XAi.layer
   * console.log(layer)
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layer: Layer.Layer<XAi, XAiError> = Layer.effect(
    XAi,
    Effect.gen(function* () {
      const apiKey = yield* Config.redacted("XAI_API_KEY").pipe(Config.option);
      const managementApiKey = yield* Config.redacted("XAI_MANAGEMENT_API_KEY").pipe(Config.option);
      const apiUrl = yield* Config.string("XAI_API_URL").pipe(Config.withDefault(XAI_API_URL));
      const managementApiUrl = yield* Config.string("XAI_MANAGEMENT_API_URL").pipe(
        Config.withDefault(XAI_MANAGEMENT_API_URL)
      );
      const websocketUrlValue = yield* Config.string("XAI_WEBSOCKET_URL").pipe(Config.withDefault(XAI_WEBSOCKET_URL));
      const client = yield* HttpClient.HttpClient;
      const config = XAiConfigInput.make({
        apiKey,
        apiUrl,
        managementApiKey,
        managementApiUrl,
        websocketUrl: websocketUrlValue,
      });

      return XAi.of(makeService(client, resolveConfig(config)));
    }).pipe(Effect.mapError(XAiError.config))
  ).pipe(Layer.provide(FetchHttpClient.layer));
}
