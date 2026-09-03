import { inspect } from "node:util";
import { encodeJsonString } from "@beep/schema/Json";
import { fcRuns } from "@beep/test-utils";
import { A, Str } from "@beep/utils";
import {
  XAI_API_URL,
  XAI_ENDPOINT_COUNT,
  XAI_ENDPOINT_METHOD_NAMES,
  XAI_ENDPOINTS,
  XAI_MANAGEMENT_API_URL,
  XAi,
  XAiConfigInput,
  XAiEndpoint,
  XAiError,
  XAiErrorOptions,
  XAiHttpBaseUrl,
  XAiHttpStatusCode,
  XAiJsonResponse,
  XAiLanguageModel,
  XAiNoBodyResponse,
  XAiQueryScalar,
  XAiQueryValue,
  XAiRequestOptions,
  XAiResponse,
  XAiServerSentEvent,
  XAiWebSocketBaseUrl,
  XAiWebSocketEvent,
} from "@beep/xai";
import { describe, expect, it, layer } from "@effect/vitest";
import { Context, Effect, Layer, pipe, Redacted, Ref, Result, Stream } from "effect";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";
import * as HttpClient from "effect/unstable/http/HttpClient";
import * as HttpClientError from "effect/unstable/http/HttpClientError";
import * as HttpClientRequest from "effect/unstable/http/HttpClientRequest";
import * as HttpClientResponse from "effect/unstable/http/HttpClientResponse";
import type { XAiEndpointDescriptor, XAiHttpEndpointMethodName } from "@beep/xai";

type XAiHttpEndpointDescriptor = XAiEndpointDescriptor & {
  readonly methodName: XAiHttpEndpointMethodName;
  readonly response: Exclude<XAiEndpointDescriptor["response"], "websocket">;
};

type CapturedRequest = {
  readonly bodyTag: string;
  readonly contentType: string | undefined;
  readonly headers: Readonly<Record<string, string>>;
  readonly method: string;
  readonly url: string;
};

type XAiTestRespond = (
  request: HttpClientRequest.HttpClientRequest
) => Effect.Effect<Response, HttpClientError.HttpClientError>;

type XAiTestHttpShape = {
  readonly captures: Effect.Effect<ReadonlyArray<CapturedRequest>>;
  readonly handle: XAiTestRespond;
  readonly reset: Effect.Effect<void>;
  readonly respondWith: (respond: XAiTestRespond) => Effect.Effect<void>;
};

class XAiTestHttp extends Context.Service<XAiTestHttp, XAiTestHttpShape>()(
  "@beep/xai/test/XAi.service.test/XAiTestHttp"
) {}

const sortStrings = A.sort(Order.String);
const encodeJson = encodeJsonString;

const encode = <Codec extends S.Codec<unknown, unknown>>(schema: Codec, value: Codec["Type"]): Codec["Encoded"] =>
  Result.getOrThrow(S.encodeResult(schema)(value));

const decode = <Codec extends S.Codec<unknown, unknown>>(schema: Codec, value: Codec["Encoded"]): Codec["Type"] =>
  Result.getOrThrow(S.decodeUnknownResult(schema)(value));

const expectRoundTrip = <Codec extends S.Codec<unknown, unknown>>(schema: Codec, value: Codec["Type"]): void => {
  const encoded = encode(schema, value);
  const decoded = decode(schema, encoded);

  expect(encode(schema, decoded)).toEqual(encoded);
};

const ConfigInputArbitrary = S.toArbitrary(XAiConfigInput)(fc);
const EndpointArbitrary = S.toArbitrary(XAiEndpoint)(fc);
const ErrorOptionsArbitrary = S.toArbitrary(XAiErrorOptions)(fc);
const ErrorArbitrary = S.toArbitrary(XAiError)(fc);
const HttpBaseUrlArbitrary = S.toArbitrary(XAiHttpBaseUrl)(fc);
const HttpStatusCodeArbitrary = S.toArbitrary(XAiHttpStatusCode)(fc);
const LanguageModelOptionsArbitrary = S.toArbitrary(XAiLanguageModel.XAiLanguageModelOptions)(fc);
const ModelNameArbitrary = S.toArbitrary(XAiLanguageModel.XAiModelName)(fc);
const QueryScalarArbitrary = S.toArbitrary(XAiQueryScalar)(fc);
const QueryValueArbitrary = S.toArbitrary(XAiQueryValue)(fc);
const ResponseArbitrary = S.toArbitrary(XAiResponse)(fc);
const ServerSentEventArbitrary = S.toArbitrary(XAiServerSentEvent)(fc);
const WebSocketBaseUrlArbitrary = S.toArbitrary(XAiWebSocketBaseUrl)(fc);
const WebSocketEventArbitrary = S.toArbitrary(XAiWebSocketEvent)(fc);

const endpointIds = () => sortStrings(A.map(XAI_ENDPOINTS, (descriptor) => descriptor.id));

const endpointMethodNames = () => sortStrings(A.map(XAI_ENDPOINTS, (descriptor) => descriptor.methodName));

const uniqueStrings = (values: ReadonlyArray<string>): ReadonlyArray<string> => pipe(values, sortStrings, A.dedupe);

const isHttpEndpointDescriptor = (descriptor: XAiEndpointDescriptor): descriptor is XAiHttpEndpointDescriptor =>
  descriptor.response !== "websocket";

const httpDescriptors = (): ReadonlyArray<XAiHttpEndpointDescriptor> =>
  pipe(XAI_ENDPOINTS, A.filter(isHttpEndpointDescriptor));

const realtimeVoiceDescriptor = (): Effect.Effect<XAiEndpointDescriptor, XAiError> =>
  pipe(
    XAI_ENDPOINTS,
    A.findFirst((descriptor) => descriptor.methodName === "connectRealtimeVoice"),
    Effect.fromOption(() => XAiError.make({ reason: "request encoding" }))
  );

const makeJsonResponse = (body: unknown, status = 200) =>
  Response.json(body, {
    headers: {
      "content-type": "application/json",
    },
    status,
  });

const defaultRespond: XAiTestRespond = () => Effect.succeed(makeJsonResponse({ ok: true }));

const XAiTestHttpLayer = Layer.effect(
  XAiTestHttp,
  Effect.gen(function* () {
    const capturesRef = yield* Ref.make<ReadonlyArray<CapturedRequest>>([]);
    const respondRef = yield* Ref.make<XAiTestRespond>(defaultRespond);

    return XAiTestHttp.of({
      captures: Ref.get(capturesRef),
      handle: Effect.fn("XAiTestHttp.handle")(function* (request) {
        const url = pipe(
          HttpClientRequest.toUrl(request),
          O.map((value) => value.toString()),
          O.getOrElse(() => request.url)
        );

        yield* Ref.update(
          capturesRef,
          A.append({
            bodyTag: request.body._tag,
            contentType: "contentType" in request.body ? request.body.contentType : undefined,
            headers: request.headers,
            method: request.method,
            url,
          })
        );

        const respond = yield* Ref.get(respondRef);
        return yield* respond(request);
      }),
      reset: Effect.all([Ref.set(capturesRef, []), Ref.set(respondRef, defaultRespond)], { discard: true }),
      respondWith: Effect.fn("XAiTestHttp.respondWith")(function* (respond) {
        yield* Ref.set(respondRef, respond);
      }),
    });
  })
);

const TestHttpClientLayer = Layer.effect(
  HttpClient.HttpClient,
  Effect.gen(function* () {
    const testHttp = yield* XAiTestHttp;

    return HttpClient.make((request) =>
      Effect.gen(function* () {
        const response = yield* testHttp.handle(request);
        return HttpClientResponse.fromWeb(request, response);
      })
    );
  })
);

const makeXAiUnitLayer = (): Layer.Layer<XAi | XAiTestHttp> =>
  XAi.makeLayer(
    XAiConfigInput.make({
      apiKey: O.some(Redacted.make("api-test-key")),
      apiUrl: XAI_API_URL,
      managementApiKey: O.some(Redacted.make("management-test-key")),
      managementApiUrl: XAI_MANAGEMENT_API_URL,
    })
  ).pipe(Layer.provide(TestHttpClientLayer), Layer.provideMerge(XAiTestHttpLayer));

const makeInvalidWebSocketUrlLayer = (): Layer.Layer<XAi | XAiTestHttp> =>
  XAi.makeLayer(
    XAiConfigInput.make({
      apiKey: O.some(Redacted.make("api-test-key")),
      websocketUrl: "not a url",
    })
  ).pipe(Layer.provide(TestHttpClientLayer), Layer.provideMerge(XAiTestHttpLayer));

const pathParamsFor = (path: string): Readonly<Record<string, string>> =>
  R.getSomes({
    apiKeyId: Str.includes("{apiKeyId}")(path) ? O.some("api-key-id") : O.none(),
    api_key_id: Str.includes("{api_key_id}")(path) ? O.some("api-key-id") : O.none(),
    batch_id: Str.includes("{batch_id}")(path) ? O.some("batch-id") : O.none(),
    collection_id: Str.includes("{collection_id}")(path) ? O.some("collection-id") : O.none(),
    file_id: Str.includes("{file_id}")(path) ? O.some("file-id") : O.none(),
    model_id: Str.includes("{model_id}")(path) ? O.some("model-id") : O.none(),
    request_id: Str.includes("{request_id}")(path) ? O.some("request-id") : O.none(),
    response_id: Str.includes("{response_id}")(path) ? O.some("response-id") : O.none(),
    teamId: Str.includes("{teamId}")(path) ? O.some("team-id") : O.none(),
    team_id: Str.includes("{team_id}")(path) ? O.some("team-id") : O.none(),
    voice_id: Str.includes("{voice_id}")(path) ? O.some("voice-id") : O.none(),
  });

const concretePathFor = (path: string): string =>
  pipe(
    path,
    Str.replace("{apiKeyId}", "api-key-id"),
    Str.replace("{api_key_id}", "api-key-id"),
    Str.replace("{batch_id}", "batch-id"),
    Str.replace("{collection_id}", "collection-id"),
    Str.replace("{file_id}", "file-id"),
    Str.replace("{model_id}", "model-id"),
    Str.replace("{request_id}", "request-id"),
    Str.replace("{response_id}", "response-id"),
    Str.replace("{teamId}", "team-id"),
    Str.replace("{team_id}", "team-id"),
    Str.replace("{voice_id}", "voice-id")
  );

const requestFor = (descriptor: XAiEndpointDescriptor): XAiRequestOptions => {
  const formData = new FormData();
  formData.append("file", new File(["hello"], "hello.txt", { type: "text/plain" }));
  const baseRequest = {
    path: pathParamsFor(descriptor.path),
    query: {
      limit: 1,
    },
  } satisfies ConstructorParameters<typeof XAiRequestOptions>[0];

  if (descriptor.body === "json") {
    return XAiRequestOptions.make({
      ...baseRequest,
      body: { model: "grok-4", prompt: "hello" },
    });
  }

  if (descriptor.body === "binary") {
    return XAiRequestOptions.make({
      ...baseRequest,
      bytes: new Uint8Array([1, 2, 3]),
      contentType: "application/octet-stream",
    });
  }

  return XAiRequestOptions.make({
    ...baseRequest,
    ...R.getSomes({
      formData: descriptor.body === "multipart" ? O.some(formData) : O.none(),
    }),
  });
};

describe("@beep/xai", () => {
  it("constructs language models in data-last form", () => {
    expect(XAiLanguageModel.model()("grok-4")).toBeDefined();
  });

  it("keeps encoded xAI schema wire shapes byte-identical", () => {
    const descriptor = XAI_ENDPOINTS[0];
    if (descriptor === undefined) {
      throw new Error("Expected xAI endpoint manifest to contain at least one endpoint.");
    }

    const decodedConfig = decode(XAiConfigInput, {
      apiKey: "api-test-key",
      apiUrl: "https://api.x.ai///",
      managementApiKey: "management-test-key",
      managementApiUrl: "https://management-api.x.ai///",
      websocketUrl: "wss://api.x.ai///",
    });
    const request = XAiRequestOptions.make({
      query: {
        limit: 10,
      },
    });
    const jsonResponse = XAiJsonResponse.make({
      body: { ok: true },
      contentType: O.some("application/json"),
      headers: {},
      status: 200,
    });
    const noBodyResponse = XAiNoBodyResponse.make({
      headers: {},
      status: 204,
    });
    const errorOptions = XAiErrorOptions.make({
      status: O.some(500),
    });
    const error = XAiError.fromDescriptor(descriptor, "response status", { status: 429 });
    const sseEvent = XAiServerSentEvent.make({
      data: { delta: "hello" },
      done: false,
      index: 0,
    });
    const websocketEvent = decode(XAiWebSocketEvent, {
      code: 1000,
      kind: "close",
      reason: "done",
    });
    const languageModelOptions = XAiLanguageModel.XAiLanguageModelOptions.make({
      model: "grok-3",
    });

    expect(decodedConfig.apiUrl).toBe("https://api.x.ai");
    expect(decodedConfig.managementApiUrl).toBe("https://management-api.x.ai");
    expect(decodedConfig.websocketUrl).toBe("wss://api.x.ai");
    expect(encode(XAiConfigInput, decodedConfig)).toEqual({
      apiKey: "api-test-key",
      apiUrl: "https://api.x.ai",
      headers: {},
      managementApiKey: "management-test-key",
      managementApiUrl: "https://management-api.x.ai",
      websocketUrl: "wss://api.x.ai",
    });
    expect(encode(XAiRequestOptions, request)).toEqual({
      headers: {},
      path: {},
      query: {
        limit: 10,
      },
    });
    expect(encode(XAiResponse, jsonResponse)).toEqual({
      _tag: "Json",
      body: { ok: true },
      contentType: "application/json",
      headers: {},
      status: 200,
    });
    expect(encode(XAiResponse, noBodyResponse)).toEqual({
      _tag: "NoBody",
      headers: {},
      status: 204,
    });
    expect(encode(XAiErrorOptions, errorOptions)).toEqual({
      status: 500,
    });
    expect(encode(XAiError, error)).toEqual({
      _tag: "XAiError",
      endpoint: descriptor.id,
      method: descriptor.method,
      methodName: descriptor.methodName,
      path: descriptor.path,
      reason: "response status",
      status: 429,
    });
    expect(encode(XAiServerSentEvent, sseEvent)).toEqual({
      data: { delta: "hello" },
      done: false,
      index: 0,
    });
    expect(encode(XAiWebSocketEvent, websocketEvent)).toEqual({
      code: 1000,
      kind: "close",
      reason: "done",
    });
    expect(encode(XAiLanguageModel.XAiLanguageModelOptions, languageModelOptions)).toEqual({
      model: "grok-3",
    });
    expect(Result.isFailure(S.decodeResult(XAiHttpBaseUrl)("not a url"))).toBe(true);
    expect(Result.isFailure(S.decodeResult(XAiWebSocketBaseUrl)("https://api.x.ai"))).toBe(true);
    expect(Result.isFailure(S.decodeResult(XAiHttpStatusCode)(99))).toBe(true);
    expect(Result.isFailure(S.decodeResult(XAiWebSocketEvent)({ code: 999, kind: "close" }))).toBe(true);
    expect(Result.isFailure(S.decodeResult(XAiLanguageModel.XAiModelName)(""))).toBe(true);
  });

  it("round-trips crispened xAI schemas through their encoded form", () => {
    fc.assert(
      fc.property(
        ConfigInputArbitrary,
        EndpointArbitrary,
        ErrorOptionsArbitrary,
        ErrorArbitrary,
        HttpBaseUrlArbitrary,
        HttpStatusCodeArbitrary,
        LanguageModelOptionsArbitrary,
        ModelNameArbitrary,
        QueryScalarArbitrary,
        QueryValueArbitrary,
        ResponseArbitrary,
        ServerSentEventArbitrary,
        WebSocketBaseUrlArbitrary,
        WebSocketEventArbitrary,
        (
          config,
          endpoint,
          errorOptions,
          error,
          httpBaseUrl,
          httpStatusCode,
          languageModelOptions,
          modelName,
          queryScalar,
          queryValue,
          response,
          serverSentEvent,
          websocketBaseUrl,
          websocketEvent
        ) => {
          expectRoundTrip(XAiConfigInput, config);
          expectRoundTrip(XAiEndpoint, endpoint);
          expectRoundTrip(XAiErrorOptions, errorOptions);
          expectRoundTrip(XAiError, error);
          expectRoundTrip(XAiHttpBaseUrl, httpBaseUrl);
          expectRoundTrip(XAiHttpStatusCode, httpStatusCode);
          expectRoundTrip(XAiLanguageModel.XAiLanguageModelOptions, languageModelOptions);
          expectRoundTrip(XAiLanguageModel.XAiModelName, modelName);
          expectRoundTrip(XAiQueryScalar, queryScalar);
          expectRoundTrip(XAiQueryValue, queryValue);
          expectRoundTrip(XAiResponse, response);
          expectRoundTrip(XAiServerSentEvent, serverSentEvent);
          expectRoundTrip(XAiWebSocketBaseUrl, websocketBaseUrl);
          expectRoundTrip(XAiWebSocketEvent, websocketEvent);
        }
      ),
      fcRuns(25)
    );
  });

  layer(makeXAiUnitLayer())((it) =>
    it.effect(
      "keeps endpoint manifest and service surface aligned",
      Effect.fnUntraced(function* () {
        expect(XAI_ENDPOINTS).toHaveLength(XAI_ENDPOINT_COUNT);
        expect(XAI_ENDPOINT_METHOD_NAMES).toHaveLength(XAI_ENDPOINT_COUNT);
        expect(uniqueStrings(endpointIds())).toHaveLength(XAI_ENDPOINT_COUNT);
        expect(uniqueStrings(endpointMethodNames())).toHaveLength(XAI_ENDPOINT_COUNT);
        expect(endpointMethodNames()).toEqual(sortStrings(XAI_ENDPOINT_METHOD_NAMES));

        for (const descriptor of XAI_ENDPOINTS) {
          expect(S.is(XAiEndpoint)(descriptor)).toBe(true);
        }

        const xai = yield* XAi;
        const serviceEndpointKeys = pipe(
          R.keys(xai),
          A.filter((key) => !Str.startsWith("stream")(key)),
          sortStrings
        );

        expect(serviceEndpointKeys).toEqual(endpointMethodNames());
        expect(R.keys(xai)).toContain("streamAnthropicMessage");
        expect(R.keys(xai)).toContain("streamChatCompletion");
        expect(R.keys(xai)).toContain("streamLegacyCompletion");
        expect(R.keys(xai)).toContain("streamResponse");
      })
    )
  );

  layer(makeXAiUnitLayer())((it) =>
    it.effect(
      "sends every HTTP endpoint with the expected method, path, auth, query, and body mode",
      Effect.fnUntraced(function* () {
        const testHttp = yield* XAiTestHttp;
        yield* testHttp.reset;

        const xai = yield* XAi;
        const descriptors = httpDescriptors();

        yield* Effect.forEach(descriptors, (descriptor) => xai[descriptor.methodName](requestFor(descriptor)), {
          concurrency: 1,
          discard: true,
        });

        const captures = yield* testHttp.captures;
        expect(captures).toHaveLength(descriptors.length);

        for (const [index, descriptor] of A.entries(descriptors)) {
          const capture = captures[index];
          const expectedBase = descriptor.base === "management" ? XAI_MANAGEMENT_API_URL : XAI_API_URL;
          const expectedToken =
            descriptor.auth === "management-key" ? "Bearer management-test-key" : "Bearer api-test-key";

          expect(capture?.method).toBe(descriptor.method);
          expect(capture?.headers.authorization).toBe(expectedToken);
          expect(capture?.url).toContain(`${expectedBase}${concretePathFor(descriptor.path)}`);
          expect(capture?.url).toContain("limit=1");

          if (descriptor.body === "multipart") {
            expect(capture?.bodyTag).toBe("FormData");
          } else if (descriptor.body === "binary") {
            expect(capture?.bodyTag).not.toBe("Empty");
          } else if (descriptor.body === "json") {
            expect(capture?.contentType).toContain("application/json");
          } else {
            expect(capture?.bodyTag).toBe("Empty");
          }
        }
      })
    )
  );

  layer(makeXAiUnitLayer())((it) =>
    it.effect(
      "maps status, malformed JSON, multipart, and SSE failures",
      Effect.fnUntraced(function* () {
        const testHttp = yield* XAiTestHttp;
        const xai = yield* XAi;

        yield* testHttp.reset;
        yield* testHttp.respondWith(() => Effect.succeed(makeJsonResponse({ error: "bad" }, 429)));
        const statusError = yield* xai.listModels().pipe(Effect.flip);

        yield* testHttp.reset;
        yield* testHttp.respondWith(() =>
          Effect.succeed(new Response("{", { headers: { "content-type": "application/json" } }))
        );
        const malformedError = yield* xai.listModels().pipe(Effect.flip);

        yield* testHttp.reset;
        const multipartError = yield* xai.uploadFile().pipe(Effect.flip);

        yield* testHttp.reset;
        yield* testHttp.respondWith(() =>
          Effect.succeed(new Response("data: nope\n\n", { headers: { "content-type": "text/event-stream" } }))
        );
        const sseError = yield* xai
          .streamChatCompletion(XAiRequestOptions.make({ body: { messages: [], model: "grok-4" } }))
          .pipe(Stream.runCollect, Effect.flip);

        yield* testHttp.reset;
        yield* testHttp.respondWith(() =>
          Effect.succeed(new Response("ok", { headers: { "content-type": "text/plain" } }))
        );
        const nonSseError = yield* xai
          .streamChatCompletion(XAiRequestOptions.make({ body: { messages: [], model: "grok-4" } }))
          .pipe(Stream.runCollect, Effect.flip);

        yield* testHttp.reset;
        yield* testHttp.respondWith(() =>
          Effect.succeed(
            new Response('data: {"delta":"hello"}\n\n', {
              headers: { "content-type": "application/json; note=text/event-stream" },
            })
          )
        );
        const spoofedContentTypeError = yield* xai
          .streamChatCompletion(XAiRequestOptions.make({ body: { messages: [], model: "grok-4" } }))
          .pipe(Stream.runCollect, Effect.flip);

        expect(statusError).toBeInstanceOf(XAiError);
        expect(statusError.reason).toBe("response status");
        expect(O.getOrUndefined(statusError.status)).toBe(429);
        expect(malformedError.reason).toBe("response decoding");
        expect(multipartError.reason).toBe("multipart encoding");
        expect(sseError.reason).toBe("sse decoding");
        expect(nonSseError.reason).toBe("sse decoding");
        expect(spoofedContentTypeError.reason).toBe("sse decoding");
      })
    )
  );

  layer(makeXAiUnitLayer())((it) =>
    it.effect(
      "redacts xAI transport and WebSocket failure causes before rendering",
      Effect.fnUntraced(function* () {
        const testHttp = yield* XAiTestHttp;
        const xai = yield* XAi;

        yield* testHttp.reset;
        yield* testHttp.respondWith((request) =>
          Effect.fail(
            new HttpClientError.HttpClientError({
              reason: new HttpClientError.TransportError({
                request,
              }),
            })
          )
        );
        const transportError = yield* xai.listModels().pipe(Effect.flip);
        const websocketDescriptor = yield* realtimeVoiceDescriptor();
        const websocketError = XAiError.fromDescriptor(websocketDescriptor, "websocket", {
          cause: new Error("Bearer websocket-secret"),
        });
        const hostileProxyError = XAiError.fromDescriptor(websocketDescriptor, "websocket", {
          cause: new Proxy(
            {},
            {
              get() {
                throw new Error("hostile get");
              },
              getOwnPropertyDescriptor() {
                throw new Error("hostile descriptor");
              },
              getPrototypeOf() {
                throw new Error("hostile prototype");
              },
              ownKeys() {
                throw new Error("hostile keys");
              },
            }
          ),
        });
        const throwingNameError = XAiError.fromDescriptor(websocketDescriptor, "websocket", {
          cause: {
            get name(): string {
              throw new Error("name getter failed");
            },
          },
        });
        const transportJson = yield* encodeJson(transportError);
        const websocketJson = yield* encodeJson(websocketError);
        const rendered = A.join(
          [transportJson, inspect(transportError, { depth: 8 }), websocketJson, inspect(websocketError, { depth: 8 })],
          "\n"
        );

        expect(transportError.reason).toBe("transport");
        expect(O.getOrUndefined(transportError.cause)).toBe("HttpClientError:TransportError");
        expect(websocketError.reason).toBe("websocket");
        expect(O.getOrUndefined(websocketError.cause)).toBe("Error");
        expect(hostileProxyError.reason).toBe("websocket");
        expect(O.isNone(hostileProxyError.cause)).toBe(true);
        expect(throwingNameError.reason).toBe("websocket");
        expect(O.isNone(throwingNameError.cause)).toBe(true);
        expect(rendered).not.toContain("Bearer");
        expect(rendered).not.toContain("api-test-key");
        expect(rendered).not.toContain("websocket-secret");
      })
    )
  );

  layer(makeXAiUnitLayer())((it) =>
    it.effect(
      "maps language-model transport failures to retryable network errors",
      Effect.fnUntraced(function* () {
        const testHttp = yield* XAiTestHttp;
        yield* testHttp.reset;
        yield* testHttp.respondWith((request) =>
          Effect.fail(
            new HttpClientError.HttpClientError({
              reason: new HttpClientError.TransportError({
                request,
              }),
            })
          )
        );

        const languageModel = yield* XAiLanguageModel.make({ model: "grok-4" });
        const error = yield* languageModel.generateText({ prompt: "hello" }).pipe(Effect.flip);

        expect(error.reason._tag).toBe("NetworkError");
        expect(error.reason.isRetryable).toBe(true);
        if (error.reason._tag !== "NetworkError") {
          return;
        }
        expect(error.reason.request.headers).toEqual({});
        expect(error.reason.description ?? "").not.toContain("api-test-key");
        expect(error.reason.description ?? "").not.toContain("hello");
      })
    )
  );

  layer(makeXAiUnitLayer())((it) =>
    it.effect(
      "rejects non-JSON chat completion responses in the language model adapter",
      Effect.fnUntraced(function* () {
        const testHttp = yield* XAiTestHttp;
        yield* testHttp.reset;
        yield* testHttp.respondWith(() =>
          Effect.succeed(
            new Response("not json", {
              headers: {
                "content-type": "text/plain",
              },
              status: 200,
            })
          )
        );

        const languageModel = yield* XAiLanguageModel.make({ model: "grok-4" });
        const error = yield* languageModel.generateText({ prompt: "hello" }).pipe(Effect.flip);

        expect(error.reason._tag).toBe("InvalidOutputError");
        expect(inspect(error.reason)).toContain("xAI chat completion returned a Text response instead of JSON.");
      })
    )
  );

  layer(makeXAiUnitLayer())((it) =>
    it.effect(
      "rejects request payloads that do not match the endpoint body mode",
      Effect.fnUntraced(function* () {
        const xai = yield* XAi;

        const noneBodyError = yield* xai.listModels(XAiRequestOptions.make({ body: {} })).pipe(Effect.flip);
        const jsonBodyError = yield* xai
          .createChatCompletion(XAiRequestOptions.make({ bytes: new Uint8Array([1, 2, 3]) }))
          .pipe(Effect.flip);
        const binaryBodyError = yield* xai.uploadFileChunks(XAiRequestOptions.make({ body: {} })).pipe(Effect.flip);
        const multipartBodyError = yield* xai.uploadFile(XAiRequestOptions.make({ body: {} })).pipe(Effect.flip);
        const websocketBodyError = yield* xai
          .connectRealtimeVoice(XAiRequestOptions.make({ body: {} }))
          .pipe(Effect.flip);

        expect(noneBodyError.reason).toBe("request encoding");
        expect(jsonBodyError.reason).toBe("request encoding");
        expect(binaryBodyError.reason).toBe("request encoding");
        expect(multipartBodyError.reason).toBe("request encoding");
        expect(websocketBodyError.reason).toBe("request encoding");
      })
    )
  );

  layer(makeInvalidWebSocketUrlLayer())((it) =>
    it.effect(
      "maps invalid WebSocket URL configuration into a typed driver error",
      Effect.fnUntraced(function* () {
        const xai = yield* XAi;
        const invalidUrlError = yield* xai.connectRealtimeVoice().pipe(Effect.flip);

        expect(invalidUrlError).toBeInstanceOf(XAiError);
        expect(invalidUrlError.reason).toBe("websocket");
      })
    )
  );

  layer(makeXAiUnitLayer())((it) =>
    it.effect(
      "parses SSE streams for chat, responses, and legacy-compatible endpoints",
      Effect.fnUntraced(function* () {
        const testHttp = yield* XAiTestHttp;
        const xai = yield* XAi;
        yield* testHttp.reset;
        yield* testHttp.respondWith(() =>
          Effect.succeed(
            new Response('data: {"delta":"hello"}\n\ndata: [DONE]\n\n', {
              headers: { "content-type": "text/event-stream" },
            })
          )
        );

        const chatEvents = yield* xai
          .streamChatCompletion(XAiRequestOptions.make({ body: { messages: [], model: "grok-4" } }))
          .pipe(Stream.runCollect);
        const responseEvents = yield* xai
          .streamResponse(XAiRequestOptions.make({ body: { input: "hello", model: "grok-4" } }))
          .pipe(Stream.runCollect);
        const legacyEvents = yield* xai
          .streamLegacyCompletion(XAiRequestOptions.make({ body: { model: "grok-2", prompt: "hello" } }))
          .pipe(Stream.runCollect);
        const anthropicEvents = yield* xai
          .streamAnthropicMessage(XAiRequestOptions.make({ body: { max_tokens: 8, messages: [], model: "grok-4" } }))
          .pipe(Stream.runCollect);

        expect(A.fromIterable(chatEvents)).toHaveLength(2);
        expect(A.fromIterable(responseEvents)).toHaveLength(2);
        expect(A.fromIterable(legacyEvents)).toHaveLength(2);
        expect(A.fromIterable(anthropicEvents)).toHaveLength(2);
      })
    )
  );
});
