/**
 * OpenAI-compatible HTTP client service and layer helpers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $OpenaiCompatId } from "@beep/identity";
import { SchemaUtils } from "@beep/schema";
import { decodeJsonString } from "@beep/schema/Json";
import { A, Str } from "@beep/utils";
import { Context, Effect, flow, Layer, Match, pipe, Stream } from "effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as AiError from "effect/unstable/ai/AiError";
import * as Sse from "effect/unstable/encoding/Sse";
import { FetchHttpClient } from "effect/unstable/http";
import * as Headers from "effect/unstable/http/Headers";
import * as HttpClient from "effect/unstable/http/HttpClient";
import * as HttpClientRequest from "effect/unstable/http/HttpClientRequest";
import * as HttpClientResponse from "effect/unstable/http/HttpClientResponse";
import {
  decodeChatCompletionChunk,
  OpenAiCompatChatCompletionRequest,
  OpenAiCompatChatCompletionResponse,
} from "./OpenAiCompat.models.ts";
import type * as HttpBody from "effect/unstable/http/HttpBody";
import type * as HttpClientError from "effect/unstable/http/HttpClientError";
import type { OpenAiCompatChatCompletionChunk } from "./OpenAiCompat.models.ts";

const $I = $OpenaiCompatId.create("OpenAiCompatClient.service");
const moduleName = "OpenAiCompatClient";

/**
 * Runtime configuration accepted by {@link OpenAiCompatClient.makeLayer}.
 *
 * **Example** (Make client options)
 *
 * ```ts
 * import { Redacted } from "effect"
 * import * as O from "effect/Option"
 * import { OpenAiCompatClientOptions } from "@beep/openai-compat"
 *
 * const options = OpenAiCompatClientOptions.make({
 *   apiKey: O.some(Redacted.make("test-key")),
 *   apiUrl: "https://provider.example/v1"
 * })
 *
 * console.log(options)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OpenAiCompatClientOptions extends S.Class<OpenAiCompatClientOptions>($I`OpenAiCompatClientOptions`)(
  {
    apiKey: S.OptionFromOptionalKey(S.String.pipe(S.RedactedFromValue)).pipe(SchemaUtils.withNoneDefault),
    apiUrl: S.String.pipe(SchemaUtils.withKeyDefaults("https://api.openai.com/v1")),
    headers: S.OptionFromOptionalKey(S.Record(S.String, S.String)).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("OpenAiCompatClientOptions", {
    description: "Runtime configuration accepted by the OpenAI-compatible client layer.",
  })
) {}

/**
 * OpenAI-compatible HTTP client service shape.
 *
 * **Example** (Stub client shape)
 *
 * ```ts
 * import { Effect, Stream } from "effect"
 * import {
 *   OpenAiCompatChatCompletionResponse,
 *   type OpenAiCompatClientShape
 * } from "@beep/openai-compat"
 *
 * const client: OpenAiCompatClientShape = {
 *   createChatCompletion: () =>
 *     Effect.succeed(OpenAiCompatChatCompletionResponse.make({ choices: [] })),
 *   streamChatCompletion: () => Stream.empty
 * }
 *
 * console.log(client.createChatCompletion)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export interface OpenAiCompatClientShape {
  readonly createChatCompletion: (
    request: OpenAiCompatChatCompletionRequest
  ) => Effect.Effect<OpenAiCompatChatCompletionResponse, AiError.AiError>;
  readonly streamChatCompletion: (
    request: OpenAiCompatChatCompletionRequest
  ) => Stream.Stream<OpenAiCompatChatCompletionChunk, AiError.AiError>;
}

const makeAiError = (method: string, reason: AiError.AiErrorReason): AiError.AiError =>
  AiError.make({ method, module: moduleName, reason });

const thunkEmptyString = () => "";

const mapSchemaError =
  (method: string) =>
  (cause: S.SchemaError): AiError.AiError =>
    makeAiError(method, AiError.InvalidOutputError.fromSchemaError(cause));

const mapBodyEncodingError =
  (method: string) =>
  (cause: HttpBody.HttpBodyError): AiError.AiError =>
    makeAiError(
      method,
      AiError.InvalidRequestError.make({
        description: `Unable to encode OpenAI-compatible chat completion request body (${cause.reason._tag}).`,
      })
    );

const mapStatusError = (
  method: string,
  reason: HttpClientError.StatusCodeError
): Effect.Effect<never, AiError.AiError> =>
  pipe(
    Effect.logWarning({
      component: moduleName,
      event: "non-2xx-status",
      method,
      status: reason.response.status,
    }),
    Effect.andThen(
      Effect.fail(
        makeAiError(
          method,
          AiError.reasonFromHttpStatus({
            description: "OpenAI-compatible provider returned a non-2xx status.",
            status: reason.response.status,
          })
        )
      )
    )
  );

const mapHttpClientError: {
  (error: HttpClientError.HttpClientError, method: string): Effect.Effect<never, AiError.AiError>;
  (method: string): (error: HttpClientError.HttpClientError) => Effect.Effect<never, AiError.AiError>;
} = dual(
  2,
  (error: HttpClientError.HttpClientError, method: string): Effect.Effect<never, AiError.AiError> =>
    Match.value(error.reason).pipe(
      Match.tags({
        StatusCodeError: (reason) => mapStatusError(method, reason),
        TransportError: (reason) => Effect.fail(makeAiError(method, AiError.NetworkError.fromRequestError(reason))),
        EncodeError: (reason) => Effect.fail(makeAiError(method, AiError.NetworkError.fromRequestError(reason))),
        InvalidUrlError: (reason) => Effect.fail(makeAiError(method, AiError.NetworkError.fromRequestError(reason))),
      }),
      Match.orElse(() =>
        Effect.fail(makeAiError(method, AiError.InvalidOutputError.make({ description: error.message })))
      )
    )
);

const logClientFailure =
  (method: string) =>
  (error: AiError.AiError): Effect.Effect<void> =>
    Effect.logDebug({
      component: moduleName,
      event: "operation-failed",
      method,
      reason: error.reason._tag,
    });

const makeHttpClient = (client: HttpClient.HttpClient, options: OpenAiCompatClientOptions): HttpClient.HttpClient => {
  const withApiKey: (request: HttpClientRequest.HttpClientRequest) => HttpClientRequest.HttpClientRequest = pipe(
    options.apiKey,
    O.match({
      onNone: () => (request) => request,
      onSome: (apiKey) => HttpClientRequest.bearerToken(apiKey),
    })
  );
  const withHeaders: (request: HttpClientRequest.HttpClientRequest) => HttpClientRequest.HttpClientRequest = pipe(
    options.headers,
    O.match({
      onNone: () => (request) => request,
      onSome: (headers) => HttpClientRequest.setHeaders(headers),
    })
  );

  return client.pipe(
    HttpClient.mapRequest((request) =>
      request.pipe(HttpClientRequest.prependUrl(options.apiUrl), withApiKey, withHeaders)
    )
  );
};

const encodeChatCompletionRequest = HttpClientRequest.schemaBodyJson(OpenAiCompatChatCompletionRequest);

const postChatCompletionRequest: {
  (
    request: OpenAiCompatChatCompletionRequest,
    method: string
  ): Effect.Effect<HttpClientRequest.HttpClientRequest, AiError.AiError>;
  (
    method: string
  ): (
    request: OpenAiCompatChatCompletionRequest
  ) => Effect.Effect<HttpClientRequest.HttpClientRequest, AiError.AiError>;
} = dual(
  2,
  (
    request: OpenAiCompatChatCompletionRequest,
    method: string
  ): Effect.Effect<HttpClientRequest.HttpClientRequest, AiError.AiError> =>
    pipe(
      HttpClientRequest.post("/chat/completions"),
      encodeChatCompletionRequest(request),
      Effect.mapError(mapBodyEncodingError(method))
    )
);

const makeStreamingRequest = (request: OpenAiCompatChatCompletionRequest): OpenAiCompatChatCompletionRequest =>
  OpenAiCompatChatCompletionRequest.make({
    ...request,
    // The client can be used directly, so it asserts streaming fields even when the language-model adapter set them.
    stream: true,
    stream_options: {
      include_usage: true,
    },
  });

const contentMediaType: (contentType: string) => string = flow(
  Str.split(";"),
  A.get(0),
  O.getOrElse(thunkEmptyString),
  Str.trim,
  Str.toLowerCase
);

const isSseContentType = (contentType: string): boolean => contentMediaType(contentType) === "text/event-stream";

const ensureSseContentType =
  (method: string) =>
  (
    response: HttpClientResponse.HttpClientResponse
  ): Effect.Effect<HttpClientResponse.HttpClientResponse, AiError.AiError> =>
    pipe(
      Headers.get(response.headers, "content-type"),
      O.filter(isSseContentType),
      O.match({
        onNone: () =>
          Effect.fail(
            makeAiError(
              method,
              AiError.InvalidOutputError.make({
                description: "OpenAI-compatible stream response did not use text/event-stream.",
              })
            )
          ),
        onSome: () => Effect.succeed(response),
      })
    );

const mapSseRetry = (method: string): AiError.AiError =>
  makeAiError(
    method,
    AiError.InvalidOutputError.make({
      description: "OpenAI-compatible stream response included an unsupported SSE retry directive.",
    })
  );

const mapSseError =
  (method: string) =>
  (error: Sse.SseError): AiError.AiError =>
    makeAiError(
      method,
      AiError.InvalidOutputError.make({
        description: `OpenAI-compatible stream response could not be decoded as SSE (${error.reason._tag}).`,
      })
    );

const parseSseData: (data: string) => Effect.Effect<OpenAiCompatChatCompletionChunk, AiError.AiError> = flow(
  decodeJsonString,
  Effect.flatMap(decodeChatCompletionChunk),
  Effect.mapError(mapSchemaError("streamChatCompletion"))
);

const makeService = (client: HttpClient.HttpClient, options: OpenAiCompatClientOptions): OpenAiCompatClientShape => {
  const httpClient = makeHttpClient(client, options);
  const decodeResponse = HttpClientResponse.schemaBodyJson(OpenAiCompatChatCompletionResponse);
  const createChatCompletion: OpenAiCompatClientShape["createChatCompletion"] = flow(
    postChatCompletionRequest("createChatCompletion"),
    Effect.map(HttpClientRequest.setHeaders({ Accept: "application/json" })),
    Effect.flatMap(HttpClient.filterStatusOk(httpClient).execute),
    Effect.flatMap(decodeResponse),
    Effect.catchTags({
      HttpClientError: mapHttpClientError("createChatCompletion"),
      SchemaError: flow(mapSchemaError("createChatCompletion"), Effect.fail),
    }),
    Effect.tapError(logClientFailure("createChatCompletion")),
    Effect.withSpan("OpenAiCompatClient.createChatCompletion", {
      attributes: {
        component: moduleName,
        operation: "createChatCompletion",
      },
    })
  );

  const streamChatCompletion: OpenAiCompatClientShape["streamChatCompletion"] = (request) =>
    pipe(
      Stream.unwrap(
        pipe(
          postChatCompletionRequest(makeStreamingRequest(request), "streamChatCompletion"),
          Effect.map(HttpClientRequest.setHeaders({ Accept: "text/event-stream" })),
          Effect.flatMap(HttpClient.filterStatusOk(httpClient).execute),
          Effect.flatMap(ensureSseContentType("streamChatCompletion")),
          Effect.map((response) =>
            response.stream.pipe(
              Stream.decodeText(),
              Stream.pipeThroughChannel(Sse.decode()),
              Stream.flatMap((event) =>
                event.data === "[DONE]" ? Stream.empty : Stream.fromEffect(parseSseData(event.data))
              ),
              Stream.catchTags({
                HttpClientError: flow(mapHttpClientError("streamChatCompletion"), Stream.fromEffect),
                Retry: () => Stream.fail(mapSseRetry("streamChatCompletion")),
                SseError: flow(mapSseError("streamChatCompletion"), Stream.fail),
              })
            )
          ),
          Effect.catchTag("HttpClientError", mapHttpClientError("streamChatCompletion"))
        )
      ),
      Stream.tapError(logClientFailure("streamChatCompletion")),
      Stream.withSpan("OpenAiCompatClient.streamChatCompletion", {
        attributes: {
          component: moduleName,
          operation: "streamChatCompletion",
        },
      })
    );

  return {
    createChatCompletion,
    streamChatCompletion,
  };
};

/**
 * OpenAI-compatible HTTP client service.
 *
 * **Example** (Yield client service)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { OpenAiCompatClient } from "@beep/openai-compat"
 *
 * const program = Effect.gen(function* () {
 *   const client = yield* OpenAiCompatClient
 *   return client
 * })
 *
 * console.log(program)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class OpenAiCompatClient extends Context.Service<OpenAiCompatClient, OpenAiCompatClientShape>()(
  $I`OpenAiCompatClient`
) {
  /**
   * Builds an OpenAI-compatible client layer from explicit configuration.
   *
   * **Example** (Build client layer)
   *
   * ```ts
   * import { Redacted } from "effect"
   * import * as O from "effect/Option"
   * import { OpenAiCompatClient, OpenAiCompatClientOptions } from "@beep/openai-compat"
   *
   * const layer = OpenAiCompatClient.makeLayer(
   *   OpenAiCompatClientOptions.make({ apiKey: O.some(Redacted.make("test-key")) })
   * )
   *
   * console.log(layer)
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly makeLayer = (
    options = OpenAiCompatClientOptions.make({})
  ): Layer.Layer<OpenAiCompatClient, never, HttpClient.HttpClient> =>
    Layer.effect(
      OpenAiCompatClient,
      Effect.gen(function* () {
        const client = yield* HttpClient.HttpClient;
        return OpenAiCompatClient.of(makeService(client, options));
      })
    );

  /**
   * Live OpenAI-compatible client layer backed by `FetchHttpClient.layer`.
   *
   * **Example** (Use live client layer)
   *
   * ```ts
   * import { OpenAiCompatClient } from "@beep/openai-compat"
   *
   * const layer = OpenAiCompatClient.layer
   *
   * console.log(layer)
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layer: Layer.Layer<OpenAiCompatClient> = OpenAiCompatClient.makeLayer().pipe(
    Layer.provide(FetchHttpClient.layer)
  );
}
