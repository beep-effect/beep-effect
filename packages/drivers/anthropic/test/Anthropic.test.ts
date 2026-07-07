import {
  ANTHROPIC_DEFAULT_APPROXIMATE_PRICE,
  ANTHROPIC_DEFAULT_MAX_TOKENS,
  ANTHROPIC_DEFAULT_MODEL,
  AnthropicApproximatePrice,
  AnthropicLanguageModelLive,
  AnthropicLanguageModelOptions,
  AnthropicTurnPlan,
  makeAnthropicLanguageModelLayer,
  RepairError,
} from "@beep/anthropic";
import { PosInt } from "@beep/schema";
import { describe, expect, it } from "@effect/vitest";
import { Result } from "effect";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const ApproximatePriceArbitrary = S.toArbitrary(AnthropicApproximatePrice);
const LanguageModelOptionsArbitrary = S.toArbitrary(AnthropicLanguageModelOptions);
const RepairErrorArbitrary = S.toArbitrary(RepairError);

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

  it("round-trips schema-derived Anthropic payloads through encoded form", () =>
    fc.assert(
      fc.property(
        ApproximatePriceArbitrary,
        LanguageModelOptionsArbitrary,
        RepairErrorArbitrary,
        (price, options, error) => {
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
        }
      ),
      { numRuns: 50 }
    ));
});
