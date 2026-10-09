import {
  ANTHROPIC_DEFAULT_APPROXIMATE_PRICE,
  ANTHROPIC_DEFAULT_MAX_TOKENS,
  ANTHROPIC_DEFAULT_MODEL,
  AnthropicApproximatePrice,
  AnthropicLanguageModelLive,
  AnthropicLanguageModelOptions,
  AnthropicTurnPlan,
  makeAnthropicLanguageModelLayer,
  makeAnthropicLanguageModelLiveLayer,
  RepairError,
} from "@beep/anthropic";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { describe, expect } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import { AiError } from "effect/ai";
import * as LanguageModel from "effect/ai/LanguageModel";
import * as Config from "effect/Config";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Result from "effect/Result";
import * as S from "effect/Schema";

const PosInt = S.Int.check(S.isGreaterThan(0, { message: "Expected a positive integer" }));

const ApproximatePriceArbitrary = Arbitrary.schema(AnthropicApproximatePrice);
const LanguageModelOptionsArbitrary = Arbitrary.schema(AnthropicLanguageModelOptions);
const RepairErrorArbitrary = Arbitrary.schema(RepairError);

const encodeApproximatePrice = S.encodeResult(AnthropicApproximatePrice);
const decodeApproximatePrice = S.decodeUnknownResult(AnthropicApproximatePrice);
const encodeLanguageModelOptions = S.encodeResult(AnthropicLanguageModelOptions);
const decodeLanguageModelOptions = S.decodeUnknownResult(AnthropicLanguageModelOptions);
const encodeRepairError = S.encodeResult(RepairError);
const decodeRepairError = S.decodeUnknownResult(RepairError);

const sameApproximatePrice = S.toEquivalence(AnthropicApproximatePrice);
const sameLanguageModelOptions = S.toEquivalence(AnthropicLanguageModelOptions);
const sameRepairError = S.toEquivalence(RepairError);

describe("@beep/anthropic", () => {
  it("pins the generated-catalog-safe default model", () => {
    expect(ANTHROPIC_DEFAULT_MODEL).toBe("claude-opus-4-6");
    expect(ANTHROPIC_DEFAULT_APPROXIMATE_PRICE.model).toBe(ANTHROPIC_DEFAULT_MODEL);
  });

  it("builds live layers and the acquisition retry plan", () => {
    expect(AnthropicLanguageModelLive).toBeDefined();
    expect(makeAnthropicLanguageModelLayer()).toBeDefined();
    expect(makeAnthropicLanguageModelLayer(AnthropicLanguageModelOptions.make({ temperature: 0 }))).toBeDefined();
    expect(makeAnthropicLanguageModelLiveLayer({ temperature: 0 })).toBeDefined();
    expect(AnthropicTurnPlan).toBeDefined();
  });

  it("keeps encoded Anthropic schema wire shapes byte-identical", () => {
    const price = AnthropicApproximatePrice.make({
      inputPerMillionTokensUsd: 15,
      model: ANTHROPIC_DEFAULT_MODEL,
      outputPerMillionTokensUsd: 75,
    });
    const defaultedOptions = AnthropicLanguageModelOptions.make({});
    const explicitOptions = AnthropicLanguageModelOptions.make({
      maxTokens: PosInt.make(1024),
      model: "claude-opus-4-6",
    });
    const error = RepairError.make({
      message: "repair call failed",
      operation: "generate_tool_json",
    });

    expect(Result.getOrThrow(encodeApproximatePrice(price))).toEqual({
      inputPerMillionTokensUsd: 15,
      model: ANTHROPIC_DEFAULT_MODEL,
      outputPerMillionTokensUsd: 75,
    });
    expect(Result.getOrThrow(encodeLanguageModelOptions(defaultedOptions))).toEqual({
      maxTokens: ANTHROPIC_DEFAULT_MAX_TOKENS,
      model: ANTHROPIC_DEFAULT_MODEL,
    });
    expect(Result.getOrThrow(encodeLanguageModelOptions(explicitOptions))).toEqual({
      maxTokens: 1024,
      model: "claude-opus-4-6",
    });
    expect(Result.getOrThrow(encodeRepairError(error))).toEqual({
      _tag: "RepairError",
      message: "repair call failed",
      operation: "generate_tool_json",
    });
  });

  it.prop(
    "round-trips schema-derived Anthropic payloads through encoded form",
    [ApproximatePriceArbitrary, LanguageModelOptionsArbitrary, RepairErrorArbitrary],
    ([price, options, error]) => {
      expect(price.inputPerMillionTokensUsd).toBeGreaterThanOrEqual(0);
      expect(price.outputPerMillionTokensUsd).toBeGreaterThanOrEqual(0);
      expect(options.maxTokens).toBeGreaterThan(0);
      expect(error.message.length).toBeGreaterThan(0);
      expect(error.operation.length).toBeGreaterThan(0);

      expect(
        sameApproximatePrice(
          Result.getOrThrow(decodeApproximatePrice(Result.getOrThrow(encodeApproximatePrice(price)))),
          price
        )
      ).toBe(true);
      expect(
        sameLanguageModelOptions(
          Result.getOrThrow(decodeLanguageModelOptions(Result.getOrThrow(encodeLanguageModelOptions(options)))),
          options
        )
      ).toBe(true);
      expect(
        sameRepairError(Result.getOrThrow(decodeRepairError(Result.getOrThrow(encodeRepairError(error)))), error)
      ).toBe(true);
    },
    { arbitrary: fcRuns(50) }
  );
});

const fixtureConfig = ConfigProvider.layer(
  ConfigProvider.fromUnknown({ AI_ANTHROPIC_API_KEY: "fixture-key", AI_ANTHROPIC_MODEL: "claude-fixture" })
);

describe("@beep/anthropic live model with request settings", () => {
  it.layer(makeAnthropicLanguageModelLiveLayer({ temperature: 0 }).pipe(Layer.provide(fixtureConfig)), {
    timeout: "5 seconds",
  })("acquisition", (it) => {
    it.effect(
      "acquires the configured model without calling the provider, and retries only retryable provider errors",
      Effect.fnUntraced(function* () {
        const model = yield* LanguageModel.LanguageModel;
        const configError = yield* Effect.flip(Config.String("FIXTURE_MISSING").parse(ConfigProvider.fromUnknown({})));
        const providerError = AiError.make({
          method: "generateText",
          module: "Anthropic",
          reason: AiError.UnknownError.make({ description: "fixture failure" }),
        });
        const retry = A.headNonEmpty(AnthropicTurnPlan.steps).while;
        const retried = yield* Effect.forEach([configError, providerError], (error) =>
          retry === undefined ? Effect.succeed(true) : retry(error)
        );

        expect(model).toBeDefined();
        expect(retried).toStrictEqual([false, providerError.isRetryable]);
      })
    );
  });
});
