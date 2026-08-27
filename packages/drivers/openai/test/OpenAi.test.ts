import {
  OPENAI_DEFAULT_EMBEDDING_MODEL,
  OPENAI_DEFAULT_MODEL,
  OpenAiEmbeddingModelOptions,
  OpenAiLanguageModelOptions,
} from "@beep/openai";
import { PosInt } from "@beep/schema";
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { Result } from "effect";
import * as Eq from "effect/Equal";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const EmbeddingModelOptionsArbitrary = S.toArbitrary(OpenAiEmbeddingModelOptions)(fc);
const LanguageModelOptionsArbitrary = S.toArbitrary(OpenAiLanguageModelOptions)(fc);

const encodeEmbeddingModelOptions = S.encodeResult(OpenAiEmbeddingModelOptions);
const decodeEmbeddingModelOptions = S.decodeUnknownResult(OpenAiEmbeddingModelOptions);
const encodeLanguageModelOptions = S.encodeResult(OpenAiLanguageModelOptions);
const decodeLanguageModelOptions = S.decodeUnknownResult(OpenAiLanguageModelOptions);

describe("@beep/openai", () => {
  it("pins defaults from the upstream OpenAI model unions", () => {
    expect(OPENAI_DEFAULT_MODEL).toBe("gpt-4o-mini");
    expect(OPENAI_DEFAULT_EMBEDDING_MODEL).toBe("text-embedding-3-small");
  });

  it("keeps encoded OpenAI option wire shapes byte-identical", () => {
    const defaultLanguageOptions = OpenAiLanguageModelOptions.make({});
    const explicitLanguageOptions = OpenAiLanguageModelOptions.make({ model: "gpt-4.1-mini" });
    const defaultEmbeddingOptions = OpenAiEmbeddingModelOptions.make({ dimensions: PosInt.make(1536) });
    const explicitEmbeddingOptions = OpenAiEmbeddingModelOptions.make({
      dimensions: PosInt.make(3072),
      model: "text-embedding-3-large",
    });

    expect(Result.getOrThrow(encodeLanguageModelOptions(defaultLanguageOptions))).toEqual({
      model: OPENAI_DEFAULT_MODEL,
    });
    expect(Result.getOrThrow(encodeLanguageModelOptions(explicitLanguageOptions))).toEqual({
      model: "gpt-4.1-mini",
    });
    expect(Result.getOrThrow(encodeEmbeddingModelOptions(defaultEmbeddingOptions))).toEqual({
      dimensions: 1536,
      model: OPENAI_DEFAULT_EMBEDDING_MODEL,
    });
    expect(Result.getOrThrow(encodeEmbeddingModelOptions(explicitEmbeddingOptions))).toEqual({
      dimensions: 3072,
      model: "text-embedding-3-large",
    });
  });

  it("rejects empty model identifiers and non-positive embedding dimensions", () => {
    expect(Result.isFailure(decodeLanguageModelOptions({ model: "" }))).toBe(true);
    expect(Result.isFailure(decodeEmbeddingModelOptions({ dimensions: 1536, model: "" }))).toBe(true);
    expect(Result.isFailure(decodeEmbeddingModelOptions({ dimensions: 0 }))).toBe(true);
    expect(Result.isFailure(decodeEmbeddingModelOptions({ dimensions: -1 }))).toBe(true);
    expect(Result.isFailure(decodeEmbeddingModelOptions({}))).toBe(true);
  });

  it("round-trips schema-derived OpenAI options through encoded form", () =>
    fc.assert(
      fc.property(
        EmbeddingModelOptionsArbitrary,
        LanguageModelOptionsArbitrary,
        (embeddingOptions, languageOptions) => {
          const decodedEmbeddingOptions = Result.getOrThrow(
            decodeEmbeddingModelOptions(Result.getOrThrow(encodeEmbeddingModelOptions(embeddingOptions)))
          );
          const decodedLanguageOptions = Result.getOrThrow(
            decodeLanguageModelOptions(Result.getOrThrow(encodeLanguageModelOptions(languageOptions)))
          );

          expect(Eq.equals(decodedEmbeddingOptions, embeddingOptions)).toBe(true);
          expect(Eq.equals(decodedLanguageOptions, languageOptions)).toBe(true);
        }
      ),
      fcRuns(50)
    ));
});
