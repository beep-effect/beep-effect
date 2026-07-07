import { URLStr } from "@beep/schema/URL";
import {
  VENICE_AI_OPERATION_DESCRIPTORS,
  VENICE_API_URL,
  VeniceAI,
  VeniceAIConfigInput,
  VeniceAIRequestOptions,
  VeniceAiChat,
  VeniceAiLanguageModel,
} from "@beep/venice-ai";
import { Redacted } from "effect";
import * as O from "effect/Option";
import { describe, expect, it } from "tstyche";
import type {
  VeniceAIError,
  VeniceAIErrorReason,
  VeniceAIHttpMethod,
  VeniceAIMethod,
  VeniceAIOperationDescriptor,
  VeniceAIOperationId,
  VeniceAIResponse,
  VeniceAIServerSentEvent,
  VeniceAIShape,
  VeniceAIStreamMethod,
} from "@beep/venice-ai";
import type { Effect, Layer, Stream } from "effect";
import type * as LanguageModel from "effect/unstable/ai/LanguageModel";
import type * as AiModel from "effect/unstable/ai/Model";
import type * as HttpClient from "effect/unstable/http/HttpClient";

declare const service: VeniceAIShape;

describe("VeniceAI", () => {
  it("preserves public literal domains", () => {
    const method: VeniceAIHttpMethod = "GET";
    const operation: VeniceAIOperationId = "listModels";
    const reason: VeniceAIErrorReason = "transport";

    expect(method).type.toBeAssignableTo<VeniceAIHttpMethod>();
    expect(operation).type.toBeAssignableTo<VeniceAIOperationId>();
    expect(reason).type.toBeAssignableTo<VeniceAIErrorReason>();

    // @ts-expect-error!
    const invalidOperation: VeniceAIOperationId = "missingOperation";
    void invalidOperation;
  });

  it("preserves service method signatures and error channels", () => {
    const request = VeniceAIRequestOptions.make({ query: O.some({ limit: 1 }) });

    expect(service.listModels).type.toBe<VeniceAIMethod>();
    expect(service.createChatCompletion(request)).type.toBeAssignableTo<
      Effect.Effect<VeniceAIResponse, VeniceAIError>
    >();
    expect(service.streamChatCompletion).type.toBe<VeniceAIStreamMethod>();
    expect(service.streamResponse(request)).type.toBeAssignableTo<
      Stream.Stream<VeniceAIServerSentEvent, VeniceAIError>
    >();
  });

  it("preserves layer and descriptor types", () => {
    expect(VENICE_AI_OPERATION_DESCRIPTORS).type.toBeAssignableTo<ReadonlyArray<VeniceAIOperationDescriptor>>();
    expect(
      VeniceAI.makeLayer(
        VeniceAIConfigInput.make({ apiKey: O.some(Redacted.make("test-key")), baseUrl: URLStr.make(VENICE_API_URL) })
      )
    ).type.toBeAssignableTo<Layer.Layer<VeniceAI, never, HttpClient.HttpClient>>();
    expect(VeniceAI.layer).type.toBeAssignableTo<Layer.Layer<VeniceAI, VeniceAIError>>();
    expect(VeniceAiChat.makeLayer).type.toBeAssignableTo<Layer.Layer<VeniceAiChat, never, VeniceAI>>();
    expect(VeniceAiChat.layer).type.toBeAssignableTo<Layer.Layer<VeniceAiChat, VeniceAIError>>();

    // @ts-expect-error!
    const invalidConfig = VeniceAIConfigInput.make({ apiKey: O.some("test-key") });
    void invalidConfig;
  });

  it("preserves Effect AI language model adapter types", () => {
    expect(VeniceAiLanguageModel.make({ model: "venice-test-model" })).type.toBeAssignableTo<
      Effect.Effect<LanguageModel.Service, never, VeniceAI>
    >();
    expect(VeniceAiLanguageModel.layer({ model: "venice-test-model" })).type.toBeAssignableTo<
      Layer.Layer<LanguageModel.LanguageModel, never, VeniceAI>
    >();
    expect(VeniceAiLanguageModel.model("venice-test-model")).type.toBeAssignableTo<
      AiModel.Model<"venice", LanguageModel.LanguageModel, VeniceAI>
    >();
  });
});
