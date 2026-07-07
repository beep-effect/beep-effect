import { XAi, XAiConfigInput, XAiLanguageModel } from "@beep/xai";
import { Redacted } from "effect";
import * as O from "effect/Option";
import { describe, expect, it } from "tstyche";
import type { XAiError } from "@beep/xai";
import type { Effect, Layer } from "effect";
import type * as LanguageModel from "effect/unstable/ai/LanguageModel";
import type * as AiModel from "effect/unstable/ai/Model";
import type * as HttpClient from "effect/unstable/http/HttpClient";

describe("XAi", () => {
  it("preserves layer types", () => {
    expect(XAi.makeLayer(XAiConfigInput.make({ apiKey: O.some(Redacted.make("test-key")) }))).type.toBeAssignableTo<
      Layer.Layer<XAi, never, HttpClient.HttpClient>
    >();
    expect(XAi.layer).type.toBeAssignableTo<Layer.Layer<XAi, XAiError>>();

    // @ts-expect-error!
    const invalidConfig = XAiConfigInput.make({ apiKey: "test-key" });
    void invalidConfig;
  });

  it("preserves Effect AI language model adapter types", () => {
    expect(XAiLanguageModel.make({ model: "grok-test-model" })).type.toBeAssignableTo<
      Effect.Effect<LanguageModel.Service, never, XAi>
    >();
    expect(XAiLanguageModel.layer({ model: "grok-test-model" })).type.toBeAssignableTo<
      Layer.Layer<LanguageModel.LanguageModel, never, XAi>
    >();
    expect(XAiLanguageModel.model("grok-test-model")).type.toBeAssignableTo<
      AiModel.Model<"xai", LanguageModel.LanguageModel, XAi>
    >();
  });
});
