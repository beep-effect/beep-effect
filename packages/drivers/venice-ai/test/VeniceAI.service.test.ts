import { $VeniceAiId } from "@beep/identity";
import { LiteralKit } from "@beep/schema";
import { HttpStatus } from "@beep/schema/HttpStatus";
import { decodeJsonString } from "@beep/schema/Json";
import { NonNegativeInt } from "@beep/schema/Number";
import { URLStr } from "@beep/schema/URL";
import { parseYaml } from "@beep/schema/Yaml";
import { fcRuns } from "@beep/test-utils";
import { A, Str, thunkEmptyStr, thunkTrue } from "@beep/utils";
import {
  VENICE_AI_OPERATION_DESCRIPTORS,
  VENICE_API_URL,
  VeniceAI,
  VeniceAIConfigInput,
  VeniceAIError,
  VeniceAIJsonResponse,
  VeniceAIOperationDescriptor,
  VeniceAIRequestOptions,
  VeniceAIResponse,
  VeniceAIServerSentEvent,
  VeniceAITextResponse,
  VeniceAiChat,
  VeniceAiLanguageModel,
} from "@beep/venice-ai";
import { describe, expect, it, layer } from "@effect/vitest";
import { Context, Effect, Layer, Match, pipe, Redacted, Ref, Stream } from "effect";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";
import * as HttpClient from "effect/unstable/http/HttpClient";
import * as HttpClientError from "effect/unstable/http/HttpClientError";
import * as HttpClientRequest from "effect/unstable/http/HttpClientRequest";
import * as HttpClientResponse from "effect/unstable/http/HttpClientResponse";

const $TestI = $VeniceAiId.create("VeniceAI.service.test");

type CapturedRequest = {
  readonly bodyTag: string;
  readonly bodyText: string | undefined;
  readonly contentType: string | undefined;
  readonly headers: Readonly<Record<string, string>>;
  readonly method: string;
  readonly url: string;
};

type VeniceAITestRespond = (
  request: HttpClientRequest.HttpClientRequest
) => Effect.Effect<Response, HttpClientError.HttpClientError>;

type VeniceAITestHttpShape = {
  readonly captures: Effect.Effect<ReadonlyArray<CapturedRequest>>;
  readonly handle: VeniceAITestRespond;
  readonly reset: Effect.Effect<void>;
  readonly respondWith: (respond: VeniceAITestRespond) => Effect.Effect<void>;
};

class VeniceAITestHttp extends Context.Service<VeniceAITestHttp, VeniceAITestHttpShape>()($TestI`VeniceAITestHttp`) {}

const HttpMethod = LiteralKit(["delete", "get", "patch", "post"]).pipe(
  $TestI.annoteSchema("HttpMethod", {
    description: "HTTP methods used by the Venice AI OpenAPI fixture parser.",
  })
);
const isHttpMethod = S.is(HttpMethod);

class OpenApiRequestBody extends S.Class<OpenApiRequestBody>($TestI`OpenApiRequestBody`)(
  {
    content: S.Record(S.String, S.Unknown),
  },
  $TestI.annote("OpenApiRequestBody", {
    description: "OpenAPI request body fixture shape used by Venice AI driver tests.",
  })
) {}

class OpenApiResponse extends S.Class<OpenApiResponse>($TestI`OpenApiResponse`)(
  {
    content: S.optionalKey(S.Record(S.String, S.Unknown)),
  },
  $TestI.annote("OpenApiResponse", {
    description: "OpenAPI response fixture shape used by Venice AI driver tests.",
  })
) {}

class OpenApiOperation extends S.Class<OpenApiOperation>($TestI`OpenApiOperation`)(
  {
    operationId: S.optionalKey(S.String),
    requestBody: S.optionalKey(OpenApiRequestBody),
    responses: S.Record(S.String, OpenApiResponse),
    security: S.Unknown.pipe(S.Array, S.optionalKey),
    tags: S.String.pipe(S.Array, S.optionalKey),
  },
  $TestI.annote("OpenApiOperation", {
    description: "OpenAPI operation fixture shape used by Venice AI driver tests.",
  })
) {}

class OpenApiSpec extends S.Class<OpenApiSpec>($TestI`OpenApiSpec`)(
  {
    paths: S.Record(S.String, S.Record(S.String, S.Unknown)),
  },
  $TestI.annote("OpenApiSpec", {
    description: "OpenAPI document fixture shape used by Venice AI driver tests.",
  })
) {}

const decodeOpenApiSpec = S.decodeUnknownEffect(OpenApiSpec);
const decodeOpenApiOperation = S.decodeUnknownEffect(OpenApiOperation);
const encodeOpenApiOperation = S.encodeEffect(OpenApiOperation);
const OpenApiOperationArbitrary = S.toArbitrary(OpenApiOperation)(fc);

class PromptBody extends S.Class<PromptBody>($TestI`PromptBody`)(
  {
    model: S.String,
    prompt: S.String,
    stream: S.optionalKey(S.Boolean),
  },
  $TestI.annote("PromptBody", {
    description: "Minimal JSON prompt body fixture shape used by Venice AI driver tests.",
  })
) {}

const decodePromptBody = S.decodeUnknownEffect(PromptBody);
const encodePromptBody = S.encodeEffect(PromptBody);
const PromptBodyArbitrary = S.toArbitrary(PromptBody)(fc);

const decodeVeniceAIConfigInput = S.decodeUnknownEffect(VeniceAIConfigInput);
const encodeVeniceAIConfigInput = S.encodeEffect(VeniceAIConfigInput);
const VeniceAIConfigInputArbitrary = S.toArbitrary(VeniceAIConfigInput)(fc);
const encodeVeniceAIRequestOptions = S.encodeEffect(VeniceAIRequestOptions);
const VeniceAIRequestOptionsArbitrary = S.toArbitrary(VeniceAIRequestOptions)(fc);
const VeniceAIOperationDescriptorArbitrary = S.toArbitrary(VeniceAIOperationDescriptor)(fc);
const encodeVeniceAIResponse = S.encodeEffect(VeniceAIResponse);
const VeniceAIResponseArbitrary = S.toArbitrary(VeniceAIResponse)(fc);
const encodeVeniceAIServerSentEvent = S.encodeEffect(VeniceAIServerSentEvent);
const VeniceAIServerSentEventArbitrary = S.toArbitrary(VeniceAIServerSentEvent)(fc);
const encodeVeniceAIError = S.encodeEffect(VeniceAIError);
const VeniceAIErrorArbitrary = S.toArbitrary(VeniceAIError)(fc);

const expectRoundTrip = <Codec extends S.Codec<unknown, unknown>>(schema: Codec, value: Codec["Type"]): void => {
  const encoded = Effect.runSync(S.encodeEffect(schema)(value));
  const decoded = Effect.runSync(S.decodeUnknownEffect(schema)(encoded));

  expect(Effect.runSync(S.encodeEffect(schema)(decoded))).toEqual(encoded);
  expect(S.toEquivalence(schema)(decoded, value)).toBe(true);
};

const sortStrings = A.sort(Order.String);
const swaggerFile = new URL("../swagger.yaml", import.meta.url);

const descriptorIds = () => sortStrings(A.map(VENICE_AI_OPERATION_DESCRIPTORS, (descriptor) => descriptor.operationId));

const readSwagger = Effect.gen(function* () {
  const raw = yield* Effect.tryPromise({
    try: () => Bun.file(swaggerFile).text(),
    catch: () =>
      VeniceAIError.make({
        path: O.some("swagger.yaml"),
        reason: "request encoding",
      }),
  });
  return yield* decodeOpenApiSpec(parseYaml(raw));
});

const hasOperationId = (operation: unknown): operation is { readonly operationId: string } =>
  P.isObject(operation) && P.hasProperty(operation, "operationId") && P.isString(operation.operationId);

const swaggerOperationIds = Effect.gen(function* () {
  const spec = yield* readSwagger;
  return pipe(
    spec.paths,
    R.toEntries,
    A.flatMap(([path, operations]) =>
      pipe(
        operations,
        R.toEntries,
        A.map(([, operation]) =>
          Match.value(operation).pipe(
            Match.when(hasOperationId, (value) => value.operationId),
            Match.when(
              () => path === "/image/styles",
              () => "listImageStyles"
            ),
            Match.orElse(() => "")
          )
        )
      )
    ),
    A.filter(Str.isNonEmpty),
    sortStrings
  );
});

const swaggerDescriptors = Effect.gen(function* () {
  const spec = yield* readSwagger;
  const rawOperations = pipe(
    spec.paths,
    R.toEntries,
    A.flatMap(([path, operations]) =>
      pipe(
        operations,
        R.toEntries,
        A.filter(([method]) => isHttpMethod(method)),
        A.map(([method, operation]) => ({
          method,
          operation,
          path,
        }))
      )
    ),
    A.sortWith((operation) => `${operation.path}:${operation.method}`, Order.String)
  );

  const descriptors = yield* Effect.forEach(
    rawOperations,

    Effect.fnUntraced(function* ({ method, operation, path }) {
      const decoded = yield* decodeOpenApiOperation(operation);

      return {
        method: Str.toUpperCase(method),
        operationId: decoded.operationId ?? (path === "/image/styles" ? "listImageStyles" : ""),
        path,
        authenticated: pipe(
          O.fromUndefinedOr(decoded.security),
          O.map(A.isReadonlyArrayEmpty),
          O.map((isEmpty) => !isEmpty),
          O.getOrElse(thunkTrue)
        ),
        requestContentTypes: pipe(
          O.fromUndefinedOr(decoded.requestBody),
          O.map((requestBody) => R.keys(requestBody.content)),
          O.getOrElse(A.empty<string>)
        ),
        responseContentTypes: pipe(
          decoded.responses,
          R.toEntries,
          A.flatMap(([, response]) =>
            pipe(O.fromUndefinedOr(response.content), O.map(R.keys), O.getOrElse(A.empty<string>))
          ),
          A.dedupe,
          sortStrings
        ),
        tag: pipe(O.fromUndefinedOr(decoded.tags), O.flatMap(A.get(0)), O.getOrElse(thunkEmptyStr)),
      };
    }),
    { concurrency: 1 }
  );

  return pipe(
    descriptors,
    A.filter((operation) => Str.isNonEmpty(operation.operationId)),
    A.sortWith((operation) => operation.operationId, Order.String)
  );
});

const makeJsonResponse = (body: unknown, status = 200) =>
  Response.json(body, {
    headers: {
      "content-type": "application/json",
    },
    status,
  });

const defaultRespond: VeniceAITestRespond = () => Effect.succeed(makeJsonResponse({ ok: true }));

const bodyTextFor = (request: HttpClientRequest.HttpClientRequest): string | undefined =>
  request.body._tag === "Uint8Array" ? new TextDecoder().decode(request.body.body) : undefined;

const bodyContentTypeFor = (request: HttpClientRequest.HttpClientRequest): string | undefined =>
  request.body._tag === "Empty" ? undefined : request.body.contentType;

const testSetupError = (path: string): VeniceAIError =>
  VeniceAIError.make({
    path: O.some(path),
    reason: "request encoding",
  });

const arrayItemAt = <A>(values: ReadonlyArray<A>, index: number, label: string): Effect.Effect<A, VeniceAIError> =>
  pipe(
    values,
    A.get(index),
    Effect.fromOption(() => testSetupError(label))
  );

const captureAt = (
  captures: ReadonlyArray<CapturedRequest>,
  index: number,
  label: string
): Effect.Effect<CapturedRequest, VeniceAIError> => arrayItemAt(captures, index, label);

const bodyTextFromCapture = (capture: CapturedRequest, label: string): Effect.Effect<string, VeniceAIError> =>
  pipe(
    O.fromUndefinedOr(capture.bodyText),
    Effect.fromOption(() => testSetupError(label))
  );

const VeniceAITestHttpLayer = Layer.effect(
  VeniceAITestHttp,
  Effect.gen(function* () {
    const capturesRef = yield* Ref.make<ReadonlyArray<CapturedRequest>>([]);
    const respondRef = yield* Ref.make<VeniceAITestRespond>(defaultRespond);

    return VeniceAITestHttp.of({
      captures: Ref.get(capturesRef),
      handle: Effect.fn("VeniceAITestHttp.handle")(function* (request) {
        const url = pipe(
          HttpClientRequest.toUrl(request),
          O.map((value) => value.toString()),
          O.getOrElse(() => request.url)
        );

        yield* Ref.update(
          capturesRef,
          A.append({
            bodyTag: request.body._tag,
            bodyText: bodyTextFor(request),
            contentType: bodyContentTypeFor(request),
            headers: request.headers,
            method: request.method,
            url,
          })
        );

        const respond = yield* Ref.get(respondRef);
        return yield* respond(request);
      }),
      reset: Effect.all([Ref.set(capturesRef, []), Ref.set(respondRef, defaultRespond)], { discard: true }),
      respondWith: Effect.fn("VeniceAITestHttp.respondWith")(function* (respond) {
        yield* Ref.set(respondRef, respond);
      }),
    });
  })
);

const TestHttpClientLayer = Layer.effect(
  HttpClient.HttpClient,
  Effect.gen(function* () {
    const testHttp = yield* VeniceAITestHttp;

    return HttpClient.make((request) =>
      Effect.gen(function* () {
        const response = yield* testHttp.handle(request);
        return HttpClientResponse.fromWeb(request, response);
      })
    );
  })
);

const makeVeniceAIUnitLayer = (
  config = VeniceAIConfigInput.make({
    apiKey: O.some(Redacted.make("test-key")),
    baseUrl: URLStr.make(VENICE_API_URL),
  })
) => VeniceAI.makeLayer(config).pipe(Layer.provide(TestHttpClientLayer), Layer.provideMerge(VeniceAITestHttpLayer));

const makeVeniceAIChatUnitLayer = () => VeniceAiChat.makeLayer.pipe(Layer.provideMerge(makeVeniceAIUnitLayer()));

const pathParamsFor = (path: string): Readonly<Record<string, string>> =>
  R.getSomes({
    id: Str.includes("{id}")(path) ? O.some("api-key-id") : O.none(),
    network: Str.includes("{network}")(path) ? O.some("base") : O.none(),
    slug: Str.includes("{slug}")(path) ? O.some("ada") : O.none(),
    walletAddress: Str.includes("{walletAddress}")(path) ? O.some("0xabc") : O.none(),
  });

const concretePathFor = (path: string): string =>
  pipe(
    path,
    Str.replace("{id}", "api-key-id"),
    Str.replace("{network}", "base"),
    Str.replace("{slug}", "ada"),
    Str.replace("{walletAddress}", "0xabc")
  );

const requestFor = (descriptor: (typeof VENICE_AI_OPERATION_DESCRIPTORS)[number]): VeniceAIRequestOptions => {
  const formData = new FormData();
  formData.append("file", new File(["hello"], "hello.txt", { type: "text/plain" }));

  return VeniceAIRequestOptions.make({
    body: pipe(descriptor.requestContentTypes, A.contains("application/json"), (hasJson) =>
      hasJson
        ? O.some({
            model: "venice-uncensored-1-2",
            prompt: "hello",
          })
        : O.none()
    ),
    formData: pipe(descriptor.requestContentTypes, A.contains("multipart/form-data"), (hasMultipart) =>
      hasMultipart ? O.some(formData) : O.none()
    ),
    path: O.some(pathParamsFor(descriptor.path)),
    query: O.some({
      limit: 1,
    }),
  });
};

describe("@beep/venice-ai", () => {
  it("constructs language models in data-last form", () => {
    expect(VeniceAiLanguageModel.model()("venice-uncensored-1-2")).toBeDefined();
  });

  it("round-trips schema-derived OpenAPI fixture and prompt body data", () =>
    fc.assert(
      fc.property(OpenApiOperationArbitrary, PromptBodyArbitrary, (operation, promptBody) => {
        const encodedOperation = Effect.runSync(encodeOpenApiOperation(operation));
        const decodedOperation = Effect.runSync(decodeOpenApiOperation(encodedOperation));
        expect(Effect.runSync(encodeOpenApiOperation(decodedOperation))).toEqual(encodedOperation);

        const encodedPromptBody = Effect.runSync(encodePromptBody(promptBody));
        const decodedPromptBody = Effect.runSync(decodePromptBody(encodedPromptBody));
        expect(Effect.runSync(encodePromptBody(decodedPromptBody))).toEqual(encodedPromptBody);
      }),
      fcRuns(25)
    ));

  it("keeps crispened production schema encoded shapes stable", () => {
    expect(Effect.runSync(encodeVeniceAIConfigInput(VeniceAIConfigInput.make({})))).toEqual({
      baseUrl: VENICE_API_URL,
      headers: {},
    });
    expect(
      Effect.runSync(
        decodeVeniceAIConfigInput({
          baseUrl: `${VENICE_API_URL}///`,
        }).pipe(Effect.flatMap(encodeVeniceAIConfigInput))
      )
    ).toEqual({
      baseUrl: VENICE_API_URL,
      headers: {},
    });
    expect(Effect.runSync(encodeVeniceAIRequestOptions(VeniceAIRequestOptions.make({})))).toEqual({});
    expect(
      Effect.runSync(
        encodeVeniceAIRequestOptions(
          VeniceAIRequestOptions.make({
            body: O.some({ model: "venice-uncensored-1-2" }),
            headers: O.some({ "x-test": "ok" }),
            path: O.some({ id: "api-key-id" }),
            query: O.some({ limit: 1 }),
          })
        )
      )
    ).toEqual({
      body: { model: "venice-uncensored-1-2" },
      headers: { "x-test": "ok" },
      path: { id: "api-key-id" },
      query: { limit: 1 },
    });
    expect(
      Effect.runSync(
        encodeVeniceAIResponse(
          VeniceAIJsonResponse.make({
            body: { ok: true },
            contentType: O.some("application/json"),
            headers: {},
            status: HttpStatus.make(200),
          })
        )
      )
    ).toEqual({
      _tag: "Json",
      body: { ok: true },
      contentType: "application/json",
      headers: {},
      status: 200,
    });
    expect(
      Effect.runSync(
        encodeVeniceAIResponse(
          VeniceAITextResponse.make({
            contentType: O.none(),
            headers: {},
            status: HttpStatus.make(200),
            text: "ok",
          })
        )
      )
    ).toEqual({
      _tag: "Text",
      headers: {},
      status: 200,
      text: "ok",
    });
    expect(
      Effect.runSync(
        encodeVeniceAIServerSentEvent(
          VeniceAIServerSentEvent.make({ data: O.some({ delta: "hello" }), done: false, index: NonNegativeInt.make(0) })
        )
      )
    ).toEqual({
      data: { delta: "hello" },
      done: false,
      index: 0,
    });
    expect(
      Effect.runSync(
        encodeVeniceAIServerSentEvent(VeniceAIServerSentEvent.make({ done: true, index: NonNegativeInt.make(1) }))
      )
    ).toEqual({
      done: true,
      index: 1,
    });
    expect(
      Effect.runSync(
        encodeVeniceAIError(
          VeniceAIError.make({
            reason: "response status",
            status: O.some(HttpStatus.make(500)),
          })
        )
      )
    ).toEqual({
      _tag: "VeniceAIError",
      reason: "response status",
      status: 500,
    });
  });

  it("round-trips crispened production schemas with schema-derived arbitraries", () =>
    fc.assert(
      fc.property(
        VeniceAIConfigInputArbitrary,
        VeniceAIRequestOptionsArbitrary,
        VeniceAIOperationDescriptorArbitrary,
        VeniceAIResponseArbitrary,
        VeniceAIServerSentEventArbitrary,
        VeniceAIErrorArbitrary,
        (config, request, descriptor, response, event, error) => {
          expectRoundTrip(VeniceAIConfigInput, config);
          expectRoundTrip(VeniceAIRequestOptions, request);
          expectRoundTrip(VeniceAIOperationDescriptor, descriptor);
          expectRoundTrip(VeniceAIResponse, response);
          expectRoundTrip(VeniceAIServerSentEvent, event);
          expectRoundTrip(VeniceAIError, error);
        }
      ),
      fcRuns(15)
    ));

  layer(makeVeniceAIUnitLayer())((it) =>
    it.effect(
      "keeps the operation registry and service surface aligned with swagger.yaml",
      Effect.fnUntraced(function* () {
        const testHttp = yield* VeniceAITestHttp;
        yield* testHttp.reset;

        const fromSwagger = yield* swaggerOperationIds;
        expect(descriptorIds()).toEqual(fromSwagger);

        const venice = yield* VeniceAI;
        const serviceKeys = sortStrings(R.keys(venice));

        expect(serviceKeys).toContain("streamChatCompletion");
        expect(serviceKeys).toContain("streamResponse");
        expect(
          pipe(
            serviceKeys,
            A.filter((key) => !Str.startsWith("stream")(key))
          )
        ).toEqual(fromSwagger);
      })
    )
  );

  layer(makeVeniceAIUnitLayer())((it) =>
    it.effect(
      "keeps descriptor metadata aligned with swagger.yaml",
      Effect.fnUntraced(function* () {
        const fromSwagger = yield* swaggerDescriptors;
        const fromRegistry = pipe(
          VENICE_AI_OPERATION_DESCRIPTORS,
          A.map((descriptor) => ({
            authenticated: descriptor.authenticated,
            method: descriptor.method,
            operationId: descriptor.operationId,
            path: descriptor.path,
            requestContentTypes: sortStrings(descriptor.requestContentTypes),
            responseContentTypes: sortStrings(descriptor.responseContentTypes),
            tag: descriptor.tag,
          })),
          A.sortWith((operation) => operation.operationId, Order.String)
        );

        expect(fromRegistry).toEqual(fromSwagger);
      })
    )
  );

  layer(makeVeniceAIUnitLayer())((it) =>
    it.effect(
      "sends every operation with the expected method, path, auth, query, and body mode",
      Effect.fnUntraced(function* () {
        const testHttp = yield* VeniceAITestHttp;
        yield* testHttp.reset;

        const venice = yield* VeniceAI;

        yield* Effect.forEach(
          VENICE_AI_OPERATION_DESCRIPTORS,
          (descriptor) => venice[descriptor.operationId](requestFor(descriptor)),
          {
            concurrency: 1,
            discard: true,
          }
        );

        const captures = yield* testHttp.captures;
        expect(captures).toHaveLength(VENICE_AI_OPERATION_DESCRIPTORS.length);

        yield* Effect.forEach(
          VENICE_AI_OPERATION_DESCRIPTORS,
          (descriptor, index) =>
            Effect.sync(() => {
              const capture = captures[index];
              const expectedAccept = pipe(
                descriptor.responseContentTypes,
                A.get(0),
                O.getOrElse(() => "application/json")
              );

              expect(capture?.method).toBe(descriptor.method);
              expect(capture?.headers.accept).toBe(expectedAccept);
              expect(capture?.headers.authorization).toBe(descriptor.authenticated ? "Bearer test-key" : undefined);
              expect(capture?.url).toContain(`${VENICE_API_URL}${concretePathFor(descriptor.path)}`);
              expect(capture?.url).toContain("limit=1");

              if (pipe(descriptor.requestContentTypes, A.contains("multipart/form-data"))) {
                expect(capture?.bodyTag).toBe("FormData");
              } else if (pipe(descriptor.requestContentTypes, A.contains("application/json"))) {
                expect(capture?.contentType).toContain("application/json");
              } else {
                expect(capture?.bodyTag).toBe("Empty");
              }
            }),
          {
            concurrency: 1,
            discard: true,
          }
        );
      })
    )
  );

  layer(makeVeniceAIUnitLayer())((it) =>
    it.effect(
      "honors request options for headers, accept, path encoding, JSON bodies, and missing path params",
      Effect.fnUntraced(function* () {
        const testHttp = yield* VeniceAITestHttp;
        const venice = yield* VeniceAI;

        yield* testHttp.reset;
        yield* venice.getCharacterBySlug(
          VeniceAIRequestOptions.make({
            accept: "text/csv",
            headers: O.some({ "x-test": "ok" }),
            path: O.some({ slug: "ada lovelace" }),
          })
        );

        const encodedCapture = yield* pipe(
          testHttp.captures,
          Effect.flatMap((captures) => captureAt(captures, 0, "expected encoded path capture"))
        );

        expect(encodedCapture.headers.accept).toBe("text/csv");
        expect(encodedCapture.headers["x-test"]).toBe("ok");
        expect(encodedCapture.url).toContain("/characters/ada%20lovelace");

        yield* testHttp.reset;
        const missingPathError = yield* venice.getCharacterBySlug().pipe(Effect.flip);
        expect(missingPathError.reason).toBe("request encoding");
        expect(O.getOrUndefined(missingPathError.operation)).toBe("getCharacterBySlug");

        yield* testHttp.reset;
        const invalidQueryRequest = { query: O.some({ bad: null }) } as unknown as VeniceAIRequestOptions;
        const invalidQueryError = yield* venice.listModels(invalidQueryRequest).pipe(Effect.flip);
        const capturesAfterInvalidQuery = yield* testHttp.captures;
        expect(invalidQueryError.reason).toBe("request encoding");
        expect(O.getOrUndefined(invalidQueryError.operation)).toBe("listModels");
        expect(capturesAfterInvalidQuery).toHaveLength(0);

        yield* testHttp.reset;
        const unsupportedJsonBodyError = yield* venice
          .listModels(VeniceAIRequestOptions.make({ body: O.some({ ignored: true }) }))
          .pipe(Effect.flip);
        const capturesAfterUnsupportedJsonBody = yield* testHttp.captures;
        expect(unsupportedJsonBodyError.reason).toBe("request encoding");
        expect(O.getOrUndefined(unsupportedJsonBodyError.operation)).toBe("listModels");
        expect(capturesAfterUnsupportedJsonBody).toHaveLength(0);

        yield* testHttp.reset;
        const unsupportedMultipartBodyError = yield* venice
          .listModels(VeniceAIRequestOptions.make({ formData: O.some(new FormData()) }))
          .pipe(Effect.flip);
        const capturesAfterUnsupportedMultipartBody = yield* testHttp.captures;
        expect(unsupportedMultipartBodyError.reason).toBe("request encoding");
        expect(O.getOrUndefined(unsupportedMultipartBodyError.operation)).toBe("listModels");
        expect(capturesAfterUnsupportedMultipartBody).toHaveLength(0);

        yield* testHttp.reset;
        yield* venice.webSearch(
          VeniceAIRequestOptions.make({
            body: O.some({
              model: "venice-uncensored-1-2",
              prompt: "hello",
            }),
          })
        );

        const jsonCapture = yield* pipe(
          testHttp.captures,
          Effect.flatMap((captures) => captureAt(captures, 0, "expected JSON body capture"))
        );
        const body = yield* pipe(
          bodyTextFromCapture(jsonCapture, "expected JSON body text"),
          Effect.flatMap(decodeJsonString),
          Effect.flatMap(decodePromptBody)
        );

        expect(body.prompt).toBe("hello");
      })
    )
  );

  layer(
    makeVeniceAIUnitLayer(
      // Normalization is a decode-side concern: the Type-side constructor now
      // rejects non-normalized URLs, so the raw trailing-slash form decodes.
      Effect.runSync(
        decodeVeniceAIConfigInput({
          apiKey: "test-key",
          baseUrl: "https://example.test/api/v1///",
        })
      )
    )
  )((it) =>
    it.effect(
      "normalizes custom base URLs",
      Effect.fnUntraced(function* () {
        const testHttp = yield* VeniceAITestHttp;
        yield* testHttp.reset;

        const venice = yield* VeniceAI;
        yield* venice.listModels();

        const capture = yield* pipe(
          testHttp.captures,
          Effect.flatMap((captures) => captureAt(captures, 0, "expected custom base URL capture"))
        );

        expect(capture.url).toContain("https://example.test/api/v1/models");
      })
    )
  );

  layer(makeVeniceAIUnitLayer())((it) =>
    it.effect(
      "decodes JSON, text, and binary success responses",
      Effect.fnUntraced(function* () {
        const testHttp = yield* VeniceAITestHttp;
        const venice = yield* VeniceAI;

        yield* testHttp.reset;
        const json = yield* venice.listModels();

        yield* testHttp.reset;
        yield* testHttp.respondWith(() =>
          Effect.succeed(new Response("a,b\n1,2", { headers: { "content-type": "text/csv" } }))
        );
        const text = yield* venice.getBillingUsage();

        yield* testHttp.reset;
        yield* testHttp.respondWith(() =>
          Effect.succeed(new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "image/png" } }))
        );
        const binary = yield* venice.generateImage(requestFor(VENICE_AI_OPERATION_DESCRIPTORS[2]));

        expect(json._tag).toBe("Json");
        expect(text._tag).toBe("Text");
        expect(binary._tag).toBe("Binary");
        expect(json.status).toBe(200);
        expect(O.getOrUndefined(json.contentType)).toContain("application/json");
        if (json._tag === "Json") {
          expect(json.body).toEqual({ ok: true });
        }
        if (text._tag === "Text") {
          expect(text.text).toBe("a,b\n1,2");
          expect(O.getOrUndefined(text.contentType)).toContain("text/csv");
        }
        if (binary._tag !== "Binary") {
          return;
        }
        expect(binary.status).toBe(200);
        expect(O.getOrUndefined(binary.contentType)).toContain("image/png");
        expect(binary.bytes).toEqual(new Uint8Array([1, 2, 3]));
      })
    )
  );

  layer(makeVeniceAIUnitLayer())((it) =>
    it.effect(
      "maps response status, malformed JSON, multipart, transport, and SSE failures",
      Effect.fnUntraced(function* () {
        const testHttp = yield* VeniceAITestHttp;
        const venice = yield* VeniceAI;

        yield* testHttp.reset;
        yield* testHttp.respondWith(() => Effect.succeed(makeJsonResponse({ code: "INSUFFICIENT_BALANCE" }, 402)));
        const statusError = yield* venice
          .topUpX402Balance(requestFor(VENICE_AI_OPERATION_DESCRIPTORS[44]))
          .pipe(Effect.flip);

        yield* testHttp.reset;
        yield* testHttp.respondWith(() =>
          Effect.succeed(new Response("{", { headers: { "content-type": "application/json" } }))
        );
        const malformedError = yield* venice.listModels().pipe(Effect.flip);

        yield* testHttp.reset;
        const multipartError = yield* venice.createTranscription().pipe(Effect.flip);

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
        const transportError = yield* venice.listModels().pipe(Effect.flip);
        const hostileProxyError = VeniceAIError.fromDescriptor(VENICE_AI_OPERATION_DESCRIPTORS[0], "transport", {
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
        const throwingNameError = VeniceAIError.fromDescriptor(VENICE_AI_OPERATION_DESCRIPTORS[0], "transport", {
          cause: {
            get name(): string {
              throw new Error("name getter failed");
            },
          },
        });

        yield* testHttp.reset;
        yield* testHttp.respondWith(() =>
          Effect.succeed(new Response("data: nope\n\n", { headers: { "content-type": "text/event-stream" } }))
        );
        const sseError = yield* venice
          .streamChatCompletion(requestFor(VENICE_AI_OPERATION_DESCRIPTORS[0]))
          .pipe(Stream.runCollect, Effect.flip);

        yield* testHttp.reset;
        yield* testHttp.respondWith(() =>
          Effect.succeed(new Response('{"message":"not sse"}', { headers: { "content-type": "application/json" } }))
        );
        const nonSseError = yield* venice
          .streamChatCompletion(requestFor(VENICE_AI_OPERATION_DESCRIPTORS[0]))
          .pipe(Stream.runCollect, Effect.flip);

        yield* testHttp.reset;
        yield* testHttp.respondWith(() =>
          Effect.succeed(
            new Response('data: {"delta":"hello"}\n\n', {
              headers: { "content-type": "application/json; note=text/event-stream" },
            })
          )
        );
        const spoofedContentTypeError = yield* venice
          .streamChatCompletion(requestFor(VENICE_AI_OPERATION_DESCRIPTORS[0]))
          .pipe(Stream.runCollect, Effect.flip);

        yield* testHttp.reset;
        yield* testHttp.respondWith(() =>
          Effect.succeed(new Response("not-json", { headers: { "content-type": "application/json" } }))
        );
        const jsonError = yield* venice.listModels().pipe(Effect.flip);

        expect(statusError).toBeInstanceOf(VeniceAIError);
        expect(statusError.reason).toBe("response status");
        expect(O.getOrUndefined(statusError.status)).toBe(402);
        expect(O.getOrUndefined(statusError.operation)).toBe("topUpX402Balance");
        expect(O.getOrUndefined(statusError.method)).toBe("POST");
        expect(O.getOrUndefined(statusError.path)).toBe("/x402/top-up");
        expect(malformedError.reason).toBe("response decoding");
        expect(O.getOrUndefined(malformedError.cause)).toBe("HttpClientError:DecodeError");
        expect(multipartError.reason).toBe("multipart encoding");
        expect(transportError.reason).toBe("transport");
        expect(O.getOrUndefined(transportError.cause)).toBe("HttpClientError:TransportError");
        expect(hostileProxyError.reason).toBe("transport");
        expect(O.isNone(hostileProxyError.cause)).toBe(true);
        expect(throwingNameError.reason).toBe("transport");
        expect(O.isNone(throwingNameError.cause)).toBe(true);
        expect(sseError.reason).toBe("sse decoding");
        expect(O.isSome(sseError.cause)).toBe(true);
        expect(nonSseError.reason).toBe("sse decoding");
        expect(O.getOrUndefined(nonSseError.status)).toBe(200);
        expect(spoofedContentTypeError.reason).toBe("sse decoding");
        expect(O.getOrUndefined(spoofedContentTypeError.status)).toBe(200);
        expect(jsonError.reason).toBe("response decoding");
        expect(O.getOrUndefined(jsonError.cause)).toBe("HttpClientError:DecodeError");
      })
    )
  );

  layer(makeVeniceAIUnitLayer())((it) =>
    it.effect(
      "maps language-model transport failures to retryable network errors",
      Effect.fnUntraced(function* () {
        const testHttp = yield* VeniceAITestHttp;
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

        const languageModel = yield* VeniceAiLanguageModel.make({ model: "venice-test-model" });
        const error = yield* languageModel.generateText({ prompt: "hello" }).pipe(Effect.flip);

        expect(error.reason._tag).toBe("NetworkError");
        expect(error.reason.isRetryable).toBe(true);
        if (error.reason._tag !== "NetworkError") {
          return;
        }
        expect(error.reason.request.headers).toEqual({});
        expect(error.reason.description ?? "").not.toContain("test-key");
        expect(error.reason.description ?? "").not.toContain("hello");
      })
    )
  );

  layer(makeVeniceAIUnitLayer())((it) =>
    it.effect(
      "parses SSE streams for chat completions and responses",
      Effect.fnUntraced(function* () {
        const testHttp = yield* VeniceAITestHttp;
        yield* testHttp.reset;
        yield* testHttp.respondWith(() =>
          Effect.succeed(
            new Response('data: {"delta":"hello"}\n\ndata: [DONE]\n\n', {
              headers: { "content-type": "text/event-stream" },
            })
          )
        );

        const venice = yield* VeniceAI;
        const chatEvents = yield* venice
          .streamChatCompletion(requestFor(VENICE_AI_OPERATION_DESCRIPTORS[0]))
          .pipe(Stream.runCollect);
        const responseEvents = yield* venice
          .streamResponse(requestFor(VENICE_AI_OPERATION_DESCRIPTORS[1]))
          .pipe(Stream.runCollect);
        const captures = yield* testHttp.captures;

        const chatEventArray = A.fromIterable(chatEvents);
        const responseEventArray = A.fromIterable(responseEvents);
        const firstChatEvent = yield* arrayItemAt(chatEventArray, 0, "expected first chat SSE event");
        const secondChatEvent = yield* arrayItemAt(chatEventArray, 1, "expected second chat SSE event");
        const firstResponseEvent = yield* arrayItemAt(responseEventArray, 0, "expected first response SSE event");
        const firstCapture = yield* captureAt(captures, 0, "expected chat stream capture");
        const secondCapture = yield* captureAt(captures, 1, "expected response stream capture");

        expect(chatEventArray).toHaveLength(2);
        expect(responseEventArray).toHaveLength(2);
        expect(O.getOrUndefined(firstChatEvent.data)).toEqual({ delta: "hello" });
        expect(firstChatEvent.done).toBe(false);
        expect(firstChatEvent.index).toBe(0);
        expect(secondChatEvent.done).toBe(true);
        expect(secondChatEvent.index).toBe(1);
        expect(O.getOrUndefined(firstResponseEvent.data)).toEqual({ delta: "hello" });
        expect(firstCapture.headers.accept).toBe("text/event-stream");
        expect(firstCapture.bodyText).toContain('"stream":true');
        expect(secondCapture.headers.accept).toBe("text/event-stream");
        expect(secondCapture.bodyText).toContain('"stream":true');
      })
    )
  );

  layer(makeVeniceAIUnitLayer())((it) =>
    it.effect(
      "emits SSE events before the response body closes",
      Effect.fnUntraced(function* () {
        const testHttp = yield* VeniceAITestHttp;
        yield* testHttp.reset;
        yield* testHttp.respondWith(() =>
          Effect.succeed(
            new Response(
              new ReadableStream<Uint8Array>({
                start(controller) {
                  controller.enqueue(new TextEncoder().encode('data: {"delta":"first"}\n\n'));
                },
              }),
              {
                headers: { "content-type": "text/event-stream" },
              }
            )
          )
        );

        const venice = yield* VeniceAI;
        const first = yield* venice
          .streamChatCompletion(requestFor(VENICE_AI_OPERATION_DESCRIPTORS[0]))
          .pipe(Stream.take(1), Stream.runCollect, Effect.timeoutOption("1 second"));

        expect(O.isSome(first)).toBe(true);
        if (O.isNone(first)) {
          return;
        }
        expect(O.getOrUndefined(A.fromIterable(first.value)[0]?.data ?? O.none())).toEqual({ delta: "first" });
      })
    )
  );

  layer(makeVeniceAIChatUnitLayer())((it) =>
    it.effect(
      "delegates the compatibility chat service through VeniceAI",
      Effect.fnUntraced(function* () {
        const testHttp = yield* VeniceAITestHttp;
        const chat = yield* VeniceAiChat;

        yield* testHttp.reset;
        yield* testHttp.respondWith(() =>
          Effect.succeed(
            makeJsonResponse({
              choices: [
                {
                  message: {
                    content: "hello from Venice",
                  },
                },
              ],
            })
          )
        );

        const text = yield* chat.chat("hello");
        expect(text).toBe("hello from Venice");

        yield* testHttp.reset;
        yield* testHttp.respondWith(() =>
          Effect.succeed(new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "image/png" } }))
        );
        const nonJson = yield* chat.chat("hello").pipe(Effect.flip);

        yield* testHttp.reset;
        yield* testHttp.respondWith(() =>
          Effect.succeed(
            makeJsonResponse({
              choices: [],
            })
          )
        );
        const emptyChoices = yield* chat.chat("hello").pipe(Effect.flip);

        yield* testHttp.reset;
        yield* testHttp.respondWith(() =>
          Effect.succeed(
            makeJsonResponse({
              choices: [
                {
                  message: {
                    content: null,
                  },
                },
              ],
            })
          )
        );
        const nullContent = yield* chat.chat("hello").pipe(Effect.flip);

        yield* testHttp.reset;
        yield* testHttp.respondWith(() => Effect.succeed(makeJsonResponse({ choices: [{ message: {} }] })));
        const malformed = yield* chat.chat("hello").pipe(Effect.flip);

        expect(nonJson.reason).toBe("response decoding");
        expect(emptyChoices.reason).toBe("response decoding");
        expect(nullContent.reason).toBe("response decoding");
        expect(malformed.reason).toBe("response decoding");
      })
    )
  );
});
