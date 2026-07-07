import {
  layer,
  make,
  model,
  OpenAiCompatClient,
  OpenAiCompatClientOptions,
  OpenAiCompatLanguageModelConfig,
} from "@beep/openai-compat";
import { PosInt } from "@beep/schema/Int";
import { Redacted } from "effect";
import * as O from "effect/Option";
import { describe, expect, it } from "tstyche";
import type {
  OpenAiCompatAssistantMessage,
  OpenAiCompatChatCompletionChoice,
  OpenAiCompatChatCompletionChunk,
  OpenAiCompatChatCompletionRequest,
  OpenAiCompatChatCompletionResponse,
  OpenAiCompatClientShape,
  OpenAiCompatUsage,
} from "@beep/openai-compat";
import type { Effect, Layer, Stream } from "effect";
import type * as AiError from "effect/unstable/ai/AiError";
import type * as LanguageModel from "effect/unstable/ai/LanguageModel";
import type * as AiModel from "effect/unstable/ai/Model";
import type * as HttpClient from "effect/unstable/http/HttpClient";

declare const client: OpenAiCompatClientShape;
declare const choice: OpenAiCompatChatCompletionChoice;
declare const request: OpenAiCompatChatCompletionRequest;
declare const response: OpenAiCompatChatCompletionResponse;

describe("OpenAiCompat", () => {
  it("preserves client service signatures", () => {
    expect(client.createChatCompletion(request)).type.toBe<
      Effect.Effect<OpenAiCompatChatCompletionResponse, AiError.AiError>
    >();
    expect(client.streamChatCompletion(request)).type.toBe<
      Stream.Stream<OpenAiCompatChatCompletionChunk, AiError.AiError>
    >();
    expect(
      OpenAiCompatClient.makeLayer(OpenAiCompatClientOptions.make({ apiKey: O.some(Redacted.make("test-key")) }))
    ).type.toBe<Layer.Layer<OpenAiCompatClient, never, HttpClient.HttpClient>>();
  });

  it("preserves language model factory surfaces", () => {
    const config = OpenAiCompatLanguageModelConfig.make({
      maxTokens: O.some(PosInt.make(128)),
      temperature: O.some(0.1),
    });

    expect(make({ config, model: "compat-model" })).type.toBeAssignableTo<
      Effect.Effect<LanguageModel.Service, never, OpenAiCompatClient>
    >();
    expect(layer({ model: "compat-model" })).type.toBeAssignableTo<
      Layer.Layer<LanguageModel.LanguageModel, never, OpenAiCompatClient>
    >();
    expect(model("compat-model")).type.toBeAssignableTo<
      AiModel.Model<"openai-compat", LanguageModel.LanguageModel, OpenAiCompatClient>
    >();
  });

  it("decodes optional response fields into Option values", () => {
    expect(choice.finish_reason).type.toBe<O.Option<string>>();
    expect(choice.message).type.toBe<O.Option<OpenAiCompatAssistantMessage>>();
    expect(response.usage).type.toBe<O.Option<OpenAiCompatUsage>>();
  });
});
