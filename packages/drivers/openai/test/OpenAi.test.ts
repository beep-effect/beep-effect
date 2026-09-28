import {
  OPENAI_DEFAULT_EMBEDDING_MODEL,
  OPENAI_DEFAULT_MODEL,
  OpenAiEmbeddingModelOptions,
  OpenAiLanguageModelOptions,
} from "@beep/openai";
import { PosInt } from "@beep/schema";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { describe, expect } from "@effect/vitest";
import { assertFailure } from "@effect/vitest/utils";
import { Result } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as Eq from "effect/Equal";
import * as S from "effect/Schema";

const EmbeddingModelOptionsArbitrary = Arbitrary.schema(OpenAiEmbeddingModelOptions);
const LanguageModelOptionsArbitrary = Arbitrary.schema(OpenAiLanguageModelOptions);

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
    assertFailure(
      decodeLanguageModelOptions({ model: "" }).pipe(Result.mapError((error) => error._tag)),
      "SchemaError"
    );
    assertFailure(
      decodeEmbeddingModelOptions({ dimensions: 1536, model: "" }).pipe(Result.mapError((error) => error._tag)),
      "SchemaError"
    );
    assertFailure(
      decodeEmbeddingModelOptions({ dimensions: 0 }).pipe(Result.mapError((error) => error._tag)),
      "SchemaError"
    );
    assertFailure(
      decodeEmbeddingModelOptions({ dimensions: -1 }).pipe(Result.mapError((error) => error._tag)),
      "SchemaError"
    );
    assertFailure(decodeEmbeddingModelOptions({}).pipe(Result.mapError((error) => error._tag)), "SchemaError");
  });

  it.prop(
    "round-trips schema-derived OpenAI options through encoded form",
    [EmbeddingModelOptionsArbitrary, LanguageModelOptionsArbitrary],
    ([embeddingOptions, languageOptions]) => {
      const decodedEmbeddingOptions = Result.getOrThrow(
        decodeEmbeddingModelOptions(Result.getOrThrow(encodeEmbeddingModelOptions(embeddingOptions)))
      );
      const decodedLanguageOptions = Result.getOrThrow(
        decodeLanguageModelOptions(Result.getOrThrow(encodeLanguageModelOptions(languageOptions)))
      );

      expect(Eq.equals(decodedEmbeddingOptions, embeddingOptions)).toBe(true);
      expect(Eq.equals(decodedLanguageOptions, languageOptions)).toBe(true);
    },
    { arbitrary: fcRuns(50) }
  );
});
