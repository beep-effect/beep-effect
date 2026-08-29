import { OpenAiEmbeddingModelOptions, OpenAiLanguageModelOptions } from "@beep/openai";
import { PosInt } from "@beep/schema";
import { describe, expect, it } from "@effect/vitest";
import * as S from "effect/Schema";

const sameEmbeddingModelOptions = S.toEquivalence(OpenAiEmbeddingModelOptions);
const sameLanguageModelOptions = S.toEquivalence(OpenAiLanguageModelOptions);

describe("OpenAI declared-field equivalence", () => {
  it("compares embedding options by model and dimensions", () => {
    const a = OpenAiEmbeddingModelOptions.make({ dimensions: PosInt.make(1536) });
    const b = OpenAiEmbeddingModelOptions.make({ dimensions: PosInt.make(1536) });
    const c = OpenAiEmbeddingModelOptions.make({ dimensions: PosInt.make(3072) });

    expect(sameEmbeddingModelOptions(a, b)).toBe(true);
    expect(sameEmbeddingModelOptions(a, c)).toBe(false);
  });

  it("compares language options by model", () => {
    const a = OpenAiLanguageModelOptions.make({ model: "gpt-4o-mini" });
    const b = OpenAiLanguageModelOptions.make({ model: "gpt-4o-mini" });
    const c = OpenAiLanguageModelOptions.make({ model: "gpt-4.1-mini" });

    expect(sameLanguageModelOptions(a, b)).toBe(true);
    expect(sameLanguageModelOptions(a, c)).toBe(false);
  });
});
