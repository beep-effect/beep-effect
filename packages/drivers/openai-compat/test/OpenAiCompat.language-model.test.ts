import {
  decodeChatCompletionChunk,
  decodeChatCompletionResponse,
  makeFromProvider,
  model as makeLanguageModel,
  OpenAiCompatAssistantDelta,
  OpenAiCompatAssistantMessage,
  OpenAiCompatChatCompletionChoice,
  OpenAiCompatChatCompletionChunk,
  OpenAiCompatChatCompletionChunkChoice,
  OpenAiCompatChatCompletionRequest,
  OpenAiCompatChatCompletionResponse,
  OpenAiCompatChatMessage,
  OpenAiCompatClient,
  OpenAiCompatClientOptions,
  OpenAiCompatLanguageModelConfig,
  OpenAiCompatResponseFormat,
  OpenAiCompatUsage,
  OpenAiCompatUserChatMessage,
} from "@beep/openai-compat";
import { PosInt } from "@beep/schema/Int";
import { NonNegativeInt } from "@beep/schema/Number";
import { UnitInterval } from "@beep/schema/UnitInterval";
import { fcRuns } from "@beep/test-utils";
import { A } from "@beep/utils";
import { expect, layer } from "@effect/vitest";
import { Effect, Layer, pipe, Redacted, Ref, Result, Stream } from "effect";
import * as Eq from "effect/Equal";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";
import * as AiError from "effect/unstable/ai/AiError";
import * as Prompt from "effect/unstable/ai/Prompt";
import * as Tool from "effect/unstable/ai/Tool";
import * as Toolkit from "effect/unstable/ai/Toolkit";
import * as HttpClient from "effect/unstable/http/HttpClient";
import * as HttpClientResponse from "effect/unstable/http/HttpClientResponse";
import type { TUnsafe } from "@beep/types";
import type * as HttpClientError from "effect/unstable/http/HttpClientError";
import type * as HttpClientRequest from "effect/unstable/http/HttpClientRequest";

const ClientOptionsArbitrary = S.toArbitrary(OpenAiCompatClientOptions)(fc);
const LanguageModelConfigArbitrary = S.toArbitrary(OpenAiCompatLanguageModelConfig)(fc);
const ChatMessageArbitrary = S.toArbitrary(OpenAiCompatChatMessage)(fc);
const ResponseFormatArbitrary = S.toArbitrary(OpenAiCompatResponseFormat)(fc);
const RequestArbitrary = S.toArbitrary(OpenAiCompatChatCompletionRequest)(fc);
const ResponseArbitrary = S.toArbitrary(OpenAiCompatChatCompletionResponse)(fc);
const ChunkArbitrary = S.toArbitrary(OpenAiCompatChatCompletionChunk)(fc);

const encodeClientOptions = S.encodeResult(OpenAiCompatClientOptions);
const decodeClientOptions = S.decodeUnknownResult(OpenAiCompatClientOptions);
const encodeLanguageModelConfig = S.encodeResult(OpenAiCompatLanguageModelConfig);
const decodeLanguageModelConfig = S.decodeUnknownResult(OpenAiCompatLanguageModelConfig);
const encodeChatMessage = S.encodeResult(OpenAiCompatChatMessage);
const decodeChatMessage = S.decodeUnknownResult(OpenAiCompatChatMessage);
const encodeResponseFormat = S.encodeResult(OpenAiCompatResponseFormat);
const decodeResponseFormat = S.decodeUnknownResult(OpenAiCompatResponseFormat);
const encodeRequest = S.encodeResult(OpenAiCompatChatCompletionRequest);
const decodeRequest = S.decodeUnknownResult(OpenAiCompatChatCompletionRequest);
const encodeResponse = S.encodeResult(OpenAiCompatChatCompletionResponse);
const decodeResponse = S.decodeUnknownResult(OpenAiCompatChatCompletionResponse);
const encodeChunk = S.encodeResult(OpenAiCompatChatCompletionChunk);
const decodeChunk = S.decodeUnknownResult(OpenAiCompatChatCompletionChunk);

const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E | E2, RIn | Exclude<R, ROut>> =>
    Effect.scoped(Layer.build(layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

const nonNegativeInt = NonNegativeInt.make;
const userMessage = (content = ""): OpenAiCompatUserChatMessage =>
  OpenAiCompatUserChatMessage.make({ content, role: "user" });

const assertRoundTrip = <A>(
  encode: (value: A) => Result.Result<unknown, unknown>,
  decode: (value: unknown) => Result.Result<A, unknown>,
  value: A
): void => {
  const encoded = Result.getOrThrow(encode(value));
  expect(Eq.equals(Result.getOrThrow(decode(encoded)), value)).toBe(true);
};

const makeResponse = (content: string, finishReason: string | null = "stop"): OpenAiCompatChatCompletionResponse =>
  OpenAiCompatChatCompletionResponse.make({
    choices: [
      OpenAiCompatChatCompletionChoice.make({
        finish_reason: O.fromNullishOr(finishReason),
        index: nonNegativeInt(0),
        message: O.some(
          OpenAiCompatAssistantMessage.make({
            content: O.some(content),
            role: "assistant",
            tool_calls: O.none(),
          })
        ),
      }),
    ],
    usage: O.some(
      OpenAiCompatUsage.make({
        completion_tokens: O.some(nonNegativeInt(2)),
        prompt_tokens: O.some(nonNegativeInt(1)),
        prompt_tokens_details: O.none(),
        total_tokens: O.some(nonNegativeInt(3)),
      })
    ),
  });

type TestRespond = (
  request: HttpClientRequest.HttpClientRequest
) => Effect.Effect<Response, HttpClientError.HttpClientError>;

const makeHttpClientLayer = (respond: TestRespond): Layer.Layer<HttpClient.HttpClient> =>
  Layer.effect(
    HttpClient.HttpClient,
    Effect.succeed(
      HttpClient.make((request) =>
        pipe(
          respond(request),
          Effect.map((response) => HttpClientResponse.fromWeb(request, response))
        )
      )
    )
  );

const makeOpenAiCompatClientLayer = (respond: TestRespond) =>
  OpenAiCompatClient.makeLayer(OpenAiCompatClientOptions.make({ apiKey: O.some(Redacted.make("test-key")) })).pipe(
    Layer.provide(makeHttpClientLayer(respond))
  );

layer(Layer.empty as Layer.Layer<TUnsafe.Any>)("OpenAiCompat language model", (it) => {
  it.effect(
    "supports data-last codecs and model construction",
    Effect.fnUntraced(function* () {
      const response = yield* decodeChatCompletionResponse()(Result.getOrThrow(encodeResponse(makeResponse("hello"))));
      const chunk = yield* decodeChatCompletionChunk()({
        choices: [{ delta: { content: "hello", role: "assistant" }, index: 0 }],
      });

      expect(response.choices).toHaveLength(1);
      expect(chunk.choices).toHaveLength(1);
      expect(makeLanguageModel()("compat-model")).toBeDefined();
    })
  );

  it("keeps encoded OpenAI-compatible schema wire shapes byte-identical", () => {
    const clientOptions = OpenAiCompatClientOptions.make({
      headers: O.some({ "X-Provider": "test" }),
    });
    const languageModelConfig = OpenAiCompatLanguageModelConfig.make({
      maxTokens: O.some(PosInt.make(128)),
      parallelToolCalls: O.some(false),
      seed: O.some(nonNegativeInt(4)),
      temperature: O.some(0.2),
      topP: O.some(UnitInterval.make(0.8)),
      user: O.some("user-1"),
    });
    const request = OpenAiCompatChatCompletionRequest.make({
      max_tokens: PosInt.make(128),
      messages: [userMessage("Hello")],
      model: "compat-model",
      seed: nonNegativeInt(4),
      temperature: null,
      top_p: UnitInterval.make(0.8),
    });
    const response = makeResponse("ok");
    const chunk = OpenAiCompatChatCompletionChunk.make({
      choices: [
        OpenAiCompatChatCompletionChunkChoice.make({
          delta: O.some(OpenAiCompatAssistantDelta.make({ content: O.some("hi"), role: "assistant" })),
          finish_reason: O.some("stop"),
          index: nonNegativeInt(0),
        }),
      ],
      usage: O.none(),
    });

    expect(Result.getOrThrow(encodeClientOptions(clientOptions))).toEqual({
      apiUrl: "https://api.openai.com/v1",
      headers: { "X-Provider": "test" },
    });
    expect(Result.getOrThrow(encodeLanguageModelConfig(languageModelConfig))).toEqual({
      maxTokens: 128,
      parallelToolCalls: false,
      seed: 4,
      strictJsonSchema: true,
      temperature: 0.2,
      topP: 0.8,
      user: "user-1",
    });
    expect(Result.getOrThrow(encodeRequest(request))).toEqual({
      max_tokens: 128,
      messages: [{ content: "Hello", role: "user" }],
      model: "compat-model",
      seed: 4,
      temperature: null,
      top_p: 0.8,
    });
    expect(Result.getOrThrow(encodeResponse(response))).toEqual({
      choices: [
        {
          finish_reason: "stop",
          index: 0,
          message: {
            content: "ok",
            role: "assistant",
          },
        },
      ],
      usage: {
        completion_tokens: 2,
        prompt_tokens: 1,
        total_tokens: 3,
      },
    });
    expect(Result.getOrThrow(encodeChunk(chunk))).toEqual({
      choices: [
        {
          delta: {
            content: "hi",
            role: "assistant",
          },
          finish_reason: "stop",
          index: 0,
        },
      ],
    });
  });

  it("round-trips schema-derived OpenAI-compatible payloads through encoded form", () =>
    fc.assert(
      fc.property(
        ClientOptionsArbitrary,
        LanguageModelConfigArbitrary,
        ChatMessageArbitrary,
        ResponseFormatArbitrary,
        RequestArbitrary,
        ResponseArbitrary,
        ChunkArbitrary,
        (clientOptions, config, message, responseFormat, request, response, chunk) => {
          expect(request.messages.length).toBeGreaterThan(0);
          assertRoundTrip(encodeClientOptions, decodeClientOptions, clientOptions);
          assertRoundTrip(encodeLanguageModelConfig, decodeLanguageModelConfig, config);
          assertRoundTrip(encodeChatMessage, decodeChatMessage, message);
          assertRoundTrip(encodeResponseFormat, decodeResponseFormat, responseFormat);
          assertRoundTrip(encodeRequest, decodeRequest, request);
          assertRoundTrip(encodeResponse, decodeResponse, response);
          assertRoundTrip(encodeChunk, decodeChunk, chunk);
        }
      ),
      fcRuns(25)
    ));

  it.effect(
    "translates Effect prompts into chat completion requests",
    Effect.fnUntraced(function* () {
      const requests = yield* Ref.make<ReadonlyArray<OpenAiCompatChatCompletionRequest>>([]);
      const languageModel = yield* makeFromProvider({
        model: "compat-model",
        moduleName: "OpenAiCompatLanguageModelTest",
        provider: {
          createChatCompletion: (request) =>
            pipe(Ref.update(requests, A.append(request)), Effect.as(makeResponse("hello from compat"))),
          streamChatCompletion: () => Stream.empty,
        },
      });

      const response = yield* languageModel.generateText({ prompt: "hello" });
      const captured = yield* Ref.get(requests);

      expect(response.text).toBe("hello from compat");
      expect(response.finishReason).toBe("stop");
      expect(response.usage.inputTokens.total).toBe(1);
      expect(captured).toHaveLength(1);
      expect(captured[0]?.model).toBe("compat-model");
      expect(captured[0]?.messages).toEqual([{ content: [{ text: "hello", type: "text" }], role: "user" }]);
    })
  );

  it.effect(
    "decodes tool calls from chat completion responses",
    Effect.fnUntraced(function* () {
      const languageModel = yield* makeFromProvider({
        model: "compat-model",
        moduleName: "OpenAiCompatLanguageModelTest",
        provider: {
          createChatCompletion: () =>
            Effect.succeed({
              choices: [
                {
                  finish_reason: O.some("tool_calls"),
                  index: nonNegativeInt(0),
                  message: O.some({
                    content: O.none(),
                    role: "assistant",
                    tool_calls: O.some([
                      {
                        function: {
                          arguments: '{"city":"Austin"}',
                          name: "weather",
                        },
                        id: "call_1",
                        type: "function",
                      },
                    ]),
                  }),
                },
              ],
              usage: O.none(),
            }),
          streamChatCompletion: () => Stream.empty,
        },
      });

      const WeatherTool = Tool.make("weather", {
        parameters: S.Struct({ city: S.String }),
        success: S.String,
      });
      const response = yield* languageModel.generateText({
        disableToolCallResolution: true,
        prompt: "weather",
        toolkit: Toolkit.make(WeatherTool),
      });

      expect(response.finishReason).toBe("tool-calls");
      expect(response.toolCalls[0]?.id).toBe("call_1");
      expect(response.toolCalls[0]?.name).toBe("weather");
      expect(response.toolCalls[0]?.params).toEqual({ city: "Austin" });
    })
  );

  it.effect(
    "streams chat completion chunks as Effect AI stream parts",
    Effect.fnUntraced(function* () {
      const chunk = (content: string, finishReason?: string | null): OpenAiCompatChatCompletionChunk => ({
        choices: [
          {
            delta: O.some({ content: O.some(content), role: "assistant", tool_calls: O.none() }),
            finish_reason: O.fromNullishOr(finishReason),
            index: nonNegativeInt(0),
          },
        ],
        usage: O.none(),
      });
      const languageModel = yield* makeFromProvider({
        model: "compat-model",
        moduleName: "OpenAiCompatLanguageModelTest",
        provider: {
          createChatCompletion: () => Effect.succeed(makeResponse("unused")),
          streamChatCompletion: () => Stream.make(chunk("hi "), chunk("there", "stop")),
        },
      });

      const parts = yield* pipe(
        languageModel.streamText({ prompt: "hello" }),
        Stream.runCollect,
        Effect.map(A.fromIterable)
      );

      expect(A.map(parts, (part) => part.type)).toEqual([
        "text-start",
        "text-delta",
        "text-delta",
        "text-end",
        "finish",
      ]);
      expect(
        pipe(
          parts,
          A.filter((part) => part.type === "text-delta"),
          A.map((part) => part.delta),
          A.join("")
        )
      ).toBe("hi there");
    })
  );

  it.effect(
    "emits streamed finish after the trailing usage chunk",
    Effect.fnUntraced(function* () {
      const textChunk = (content: string): OpenAiCompatChatCompletionChunk => ({
        choices: [
          {
            delta: O.some({ content: O.some(content), role: "assistant", tool_calls: O.none() }),
            finish_reason: O.none(),
            index: nonNegativeInt(0),
          },
        ],
        usage: O.none(),
      });
      const finishChunk: OpenAiCompatChatCompletionChunk = {
        choices: [
          {
            delta: O.some({ content: O.none(), tool_calls: O.none() }),
            finish_reason: O.some("stop"),
            index: nonNegativeInt(0),
          },
        ],
        usage: O.none(),
      };
      const usageChunk: OpenAiCompatChatCompletionChunk = {
        choices: [],
        usage: O.some({
          completion_tokens: O.some(nonNegativeInt(5)),
          prompt_tokens: O.some(nonNegativeInt(3)),
          prompt_tokens_details: O.none(),
          total_tokens: O.some(nonNegativeInt(8)),
        }),
      };
      const languageModel = yield* makeFromProvider({
        model: "compat-model",
        moduleName: "OpenAiCompatLanguageModelTest",
        provider: {
          createChatCompletion: () => Effect.succeed(makeResponse("unused")),
          streamChatCompletion: () => Stream.make(textChunk("hello"), finishChunk, usageChunk),
        },
      });

      const parts = yield* pipe(
        languageModel.streamText({ prompt: "hello" }),
        Stream.runCollect,
        Effect.map(A.fromIterable)
      );
      const finish = pipe(
        parts,
        A.findFirst((part) => part.type === "finish"),
        O.getOrThrow
      );
      if (finish.type !== "finish") {
        return yield* Effect.die("Expected streamed parts to include a finish part.");
      }

      expect(A.map(parts, (part) => part.type)).toEqual(["text-start", "text-delta", "text-end", "finish"]);
      expect(finish.usage.inputTokens.total).toBe(3);
      expect(finish.usage.outputTokens.total).toBe(5);
    })
  );

  it.effect(
    "decodes partial streaming tool-call deltas",
    Effect.fnUntraced(function* () {
      const chunk = yield* decodeChatCompletionChunk({
        choices: [
          {
            delta: {
              tool_calls: [
                {
                  function: {
                    arguments: '{"city"',
                  },
                  index: nonNegativeInt(0),
                },
              ],
            },
            index: nonNegativeInt(0),
          },
        ],
      });
      const toolCalls = pipe(
        chunk.choices,
        A.head,
        O.flatMap((choice) => choice.delta),
        O.flatMap((delta) => delta.tool_calls),
        O.getOrElse(A.empty)
      );

      expect(toolCalls[0]?.id).toBeUndefined();
      expect(toolCalls[0]?.function?.name).toBeUndefined();
      expect(toolCalls[0]?.function?.arguments).toBe('{"city"');
    })
  );

  it.effect(
    "buffers streaming tool-call argument deltas until JSON is complete",
    Effect.fnUntraced(function* () {
      const chunk = (
        toolCalls: OpenAiCompatChatCompletionChunk["choices"][number]["delta"],
        finishReason?: string
      ): OpenAiCompatChatCompletionChunk => ({
        choices: [
          {
            delta: toolCalls,
            finish_reason: O.fromUndefinedOr(finishReason),
            index: nonNegativeInt(0),
          },
        ],
        id: "chatcmpl_test",
        usage: O.none(),
      });
      const WeatherTool = Tool.make("weather", {
        parameters: S.Struct({ city: S.String }),
        success: S.String,
      });
      const languageModel = yield* makeFromProvider({
        model: "compat-model",
        moduleName: "OpenAiCompatLanguageModelTest",
        provider: {
          createChatCompletion: () => Effect.succeed(makeResponse("unused")),
          streamChatCompletion: () =>
            Stream.make(
              chunk(
                O.some({
                  content: O.none(),
                  role: "assistant",
                  tool_calls: O.some([
                    {
                      function: {
                        arguments: '{"city"',
                        name: "weather",
                      },
                      id: "call_1",
                      index: nonNegativeInt(0),
                      type: "function",
                    },
                  ]),
                })
              ),
              chunk(
                O.some({
                  content: O.none(),
                  tool_calls: O.some([
                    {
                      function: {
                        arguments: ':"Austin"}',
                      },
                      index: nonNegativeInt(0),
                    },
                  ]),
                }),
                "tool_calls"
              )
            ),
        },
      });

      const parts = yield* pipe(
        languageModel.streamText({
          disableToolCallResolution: true,
          prompt: "weather",
          toolkit: Toolkit.make(WeatherTool),
        }),
        Stream.runCollect,
        Effect.map(A.fromIterable)
      );
      const toolCall = pipe(
        parts,
        A.findFirst((part) => part.type === "tool-call"),
        O.getOrThrow
      );
      if (toolCall.type !== "tool-call") {
        return yield* Effect.die("Expected streamed parts to include a completed tool call.");
      }

      expect(A.map(parts, (part) => part.type)).toEqual([
        "tool-params-start",
        "tool-params-delta",
        "tool-params-delta",
        "tool-params-end",
        "tool-call",
        "finish",
      ]);
      expect(toolCall.params).toEqual({ city: "Austin" });
    })
  );

  it.effect(
    "rejects non-image file parts before provider calls",
    Effect.fnUntraced(function* () {
      const languageModel = yield* makeFromProvider({
        model: "compat-model",
        moduleName: "OpenAiCompatLanguageModelTest",
        provider: {
          createChatCompletion: () => Effect.die("provider should not be called"),
          streamChatCompletion: () => Stream.empty,
        },
      });

      const error = yield* pipe(
        languageModel.generateText({
          prompt: Prompt.make([
            {
              content: [
                Prompt.filePart({
                  data: new URL("https://example.com/document.pdf"),
                  mediaType: "application/pdf",
                }),
              ],
              role: "user",
            },
          ]),
        }),
        Effect.flip
      );

      expect(AiError.isAiError(error)).toBe(true);
      expect(error.method).toBe("prepareMessages");
      expect(error.reason._tag).toBe("UnsupportedSchemaError");
      expect(error.reason.message).toContain("application/pdf");
    })
  );

  it.effect(
    "maps tool schema conversion failures to UnsupportedSchemaError before provider calls",
    Effect.fnUntraced(function* () {
      const languageModel = yield* makeFromProvider({
        model: "compat-model",
        moduleName: "OpenAiCompatLanguageModelTest",
        provider: {
          createChatCompletion: () => Effect.die("provider should not be called"),
          streamChatCompletion: () => Stream.empty,
        },
      });
      const UnsupportedTool = Tool.make("unsupported_schema", {
        parameters: S.Unknown,
        success: S.String,
      });

      const error = yield* pipe(
        languageModel.generateText({
          prompt: "use tool",
          toolkit: Toolkit.make(UnsupportedTool),
        }),
        Effect.flip
      );

      expect(AiError.isAiError(error)).toBe(true);
      expect(error.method).toBe("prepareTools");
      expect(error.reason._tag).toBe("UnsupportedSchemaError");
    })
  );

  it.effect(
    "maps structured response schema conversion failures to UnsupportedSchemaError before provider calls",
    Effect.fnUntraced(function* () {
      const languageModel = yield* makeFromProvider({
        model: "compat-model",
        moduleName: "OpenAiCompatLanguageModelTest",
        provider: {
          createChatCompletion: () => Effect.die("provider should not be called"),
          streamChatCompletion: () => Stream.empty,
        },
      });

      const error = yield* pipe(
        languageModel.generateObject({
          prompt: "return object",
          schema: S.Record(S.String, S.Symbol),
        }),
        Effect.flip
      );

      expect(AiError.isAiError(error)).toBe(true);
      expect(error.method).toBe("prepareResponseFormat");
      expect(error.reason._tag).toBe("UnsupportedSchemaError");
    })
  );

  it.effect(
    "maps JSON body encoding failures to AiError",
    Effect.fnUntraced(function* () {
      const request = OpenAiCompatChatCompletionRequest.make({
        messages: [userMessage()],
        model: "compat-model",
        stream_options: {
          retry_after: 1n,
        },
      });

      const error = yield* pipe(
        Effect.gen(function* () {
          const client = yield* OpenAiCompatClient;
          return yield* client.createChatCompletion(request).pipe(Effect.flip);
        }),
        provideScopedLayer(makeOpenAiCompatClientLayer(() => Effect.die("body encoding should fail before execute")))
      );

      expect(AiError.isAiError(error)).toBe(true);
      expect(error.method).toBe("createChatCompletion");
      expect(error.reason._tag).toBe("InvalidRequestError");
    })
  );

  it.effect(
    "maps non-2xx client responses without exposing response bodies",
    Effect.fnUntraced(function* () {
      const request = OpenAiCompatChatCompletionRequest.make({
        messages: [userMessage()],
        model: "compat-model",
      });

      const error = yield* pipe(
        Effect.gen(function* () {
          const client = yield* OpenAiCompatClient;
          return yield* client.createChatCompletion(request).pipe(Effect.flip);
        }),
        provideScopedLayer(
          makeOpenAiCompatClientLayer(() =>
            Effect.succeed(
              new Response('{"secret":"prompt text"}', {
                status: 401,
              })
            )
          )
        )
      );

      expect(AiError.isAiError(error)).toBe(true);
      expect(error.method).toBe("createChatCompletion");
      expect(error.reason._tag).toBe("AuthenticationError");
      expect(error.reason.message).not.toContain("prompt text");
    })
  );

  it.effect(
    "rejects stream responses whose leading content type is not text/event-stream",
    Effect.fnUntraced(function* () {
      const request = OpenAiCompatChatCompletionRequest.make({
        messages: [userMessage()],
        model: "compat-model",
      });

      const error = yield* pipe(
        Effect.gen(function* () {
          const client = yield* OpenAiCompatClient;
          return yield* client.streamChatCompletion(request).pipe(Stream.runCollect, Effect.flip);
        }),
        provideScopedLayer(
          makeOpenAiCompatClientLayer(() =>
            Effect.succeed(
              new Response("{}", {
                headers: {
                  "content-type": "application/json; note=text/event-stream",
                },
              })
            )
          )
        )
      );

      expect(AiError.isAiError(error)).toBe(true);
      expect(error.method).toBe("streamChatCompletion");
      expect(error.reason._tag).toBe("InvalidOutputError");
    })
  );

  it.effect(
    "sets operation-specific Accept headers and allows configured overrides",
    Effect.fnUntraced(function* () {
      const capturedHeaders = yield* Ref.make<ReadonlyArray<Record<string, string>>>([]);
      const jsonBody =
        '{"choices":[{"finish_reason":"stop","index":0,"message":{"content":"ok","role":"assistant","tool_calls":[]}}],"usage":{"completion_tokens":2,"prompt_tokens":1,"total_tokens":3}}';
      const defaultLayer = OpenAiCompatClient.makeLayer(
        OpenAiCompatClientOptions.make({ apiKey: O.some(Redacted.make("test-key")) })
      ).pipe(
        Layer.provide(
          makeHttpClientLayer((request) =>
            pipe(
              Ref.update(capturedHeaders, A.append(request.headers)),
              Effect.as(
                request.headers.accept === "text/event-stream"
                  ? new Response("data: [DONE]\n\n", {
                      headers: { "content-type": "text/event-stream" },
                    })
                  : new Response(jsonBody, {
                      headers: { "content-type": "application/json" },
                    })
              )
            )
          )
        )
      );
      const request = OpenAiCompatChatCompletionRequest.make({
        messages: [userMessage()],
        model: "compat-model",
      });

      yield* pipe(
        Effect.gen(function* () {
          const client = yield* OpenAiCompatClient;
          yield* client.createChatCompletion(request);
          yield* client.streamChatCompletion(request).pipe(Stream.runCollect);
        }),
        provideScopedLayer(defaultLayer)
      );

      const defaults = yield* Ref.get(capturedHeaders);
      expect(defaults[0]?.accept).toBe("application/json");
      expect(defaults[1]?.accept).toBe("text/event-stream");

      const overrideHeaders = yield* Ref.make<ReadonlyArray<Record<string, string>>>([]);
      const overrideLayer = OpenAiCompatClient.makeLayer(
        OpenAiCompatClientOptions.make({
          apiKey: O.some(Redacted.make("test-key")),
          headers: O.some({ Accept: "application/vnd.compat+json" }),
        })
      ).pipe(
        Layer.provide(
          makeHttpClientLayer((request) =>
            pipe(
              Ref.update(overrideHeaders, A.append(request.headers)),
              Effect.as(
                new Response(jsonBody, {
                  headers: { "content-type": "application/json" },
                })
              )
            )
          )
        )
      );

      yield* pipe(
        Effect.gen(function* () {
          const client = yield* OpenAiCompatClient;
          yield* client.createChatCompletion(request);
        }),
        provideScopedLayer(overrideLayer)
      );

      const overridden = yield* Ref.get(overrideHeaders);
      expect(overridden[0]?.accept).toBe("application/vnd.compat+json");
    })
  );

  it.effect(
    "maps SSE retry directives to typed AiError",
    Effect.fnUntraced(function* () {
      const request = OpenAiCompatChatCompletionRequest.make({
        messages: [userMessage()],
        model: "compat-model",
      });

      const error = yield* pipe(
        Effect.gen(function* () {
          const client = yield* OpenAiCompatClient;
          return yield* client.streamChatCompletion(request).pipe(Stream.runCollect, Effect.flip);
        }),
        provideScopedLayer(
          makeOpenAiCompatClientLayer(() =>
            Effect.succeed(
              new Response("retry: 1000\n\n", {
                headers: {
                  "content-type": "text/event-stream",
                },
              })
            )
          )
        )
      );

      expect(AiError.isAiError(error)).toBe(true);
      expect(error.method).toBe("streamChatCompletion");
      expect(error.reason._tag).toBe("InvalidOutputError");
    })
  );

  it.effect(
    "maps SSE decoding failures to typed AiError",
    Effect.fnUntraced(function* () {
      const request = OpenAiCompatChatCompletionRequest.make({
        messages: [userMessage()],
        model: "compat-model",
      });

      // `Sse.decode` fails only when a pending event outgrows its 10 MiB
      // `maxEventSize`, so the body is a single `data:` field past that bound
      // with no blank line to flush it.
      const oversizedEvent = `data: ${"x".repeat(10 * 1024 * 1024)}`;

      const error = yield* pipe(
        Effect.gen(function* () {
          const client = yield* OpenAiCompatClient;
          return yield* client.streamChatCompletion(request).pipe(Stream.runCollect, Effect.flip);
        }),
        provideScopedLayer(
          makeOpenAiCompatClientLayer(() =>
            Effect.succeed(
              new Response(oversizedEvent, {
                headers: {
                  "content-type": "text/event-stream",
                },
              })
            )
          )
        )
      );

      expect(AiError.isAiError(error)).toBe(true);
      expect(error.method).toBe("streamChatCompletion");
      expect(error.reason._tag).toBe("InvalidOutputError");
      // Proves the decoding reason survives the mapping rather than being
      // flattened into a generic stream failure.
      expect(String(error)).toContain("EventTooLarge");
    })
  );
});
