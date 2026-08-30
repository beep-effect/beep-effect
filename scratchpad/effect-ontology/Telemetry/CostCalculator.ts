/**
 * LLM Cost Calculator
 *
 * **Details**
 *
 * Calculates estimated costs based on token usage and model pricing.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as P from "effect/Predicate";
import { dual3 } from "../Utils/Dual.ts";

/** Pricing per 1M tokens (as of Dec 2025) */
const PRICING: Record<string, { input: number; output: number }> = {
  // Anthropic - Current models (Claude 4.5)
  "claude-haiku-4-5": { input: 1.0, output: 5.0 },
  "claude-haiku-4-5-20251001": { input: 1.0, output: 5.0 },
  "claude-sonnet-4-5": { input: 3.0, output: 15.0 },
  "claude-opus-4-5": { input: 5.0, output: 25.0 },
  // Anthropic - Legacy models
  "claude-sonnet-4-20250514": { input: 3.0, output: 15.0 },
  "claude-3-5-haiku-20241022": { input: 0.8, output: 4.0 },
  "claude-3-haiku-20240307": { input: 0.25, output: 1.25 },

  // OpenAI
  "gpt-4o": { input: 2.5, output: 10.0 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "gpt-4-turbo": { input: 10.0, output: 30.0 },

  // Google
  "gemini-2.0-flash": { input: 0.1, output: 0.4 },
  "gemini-1.5-pro": { input: 1.25, output: 5.0 },
  "gemini-1.5-flash": { input: 0.075, output: 0.3 },
};

/**
 * Looks up USD pricing per 1M input and output tokens for a known model id.
 *
 * **Example** (Read published model pricing)
 *
 * ```ts
 * import { getPricing } from "@effect-ontology/Telemetry/CostCalculator"
 *
 * console.log(getPricing("claude-sonnet-4-5")) // { input: 3, output: 15 }
 * console.log(getPricing("not-a-model")) // undefined
 * ```
 *
 * @returns USD per 1M tokens, or `undefined` when the model is not in the table.
 * @see {@link calculateCost} for converting token counts into estimated USD.
 * @category observability
 * @since 0.0.0
 */
export const getPricing = (model: string): { input: number; output: number } | undefined => PRICING[model];

/**
 * Estimates USD cost from input and output token counts using published
 * per-1M-token prices.
 *
 * **Example** (Price one million tokens each way)
 *
 * ```ts
 * import { calculateCost } from "@effect-ontology/Telemetry/CostCalculator"
 *
 * console.log(calculateCost("gpt-4o-mini", 1_000_000, 1_000_000)) // 0.75
 * console.log(calculateCost("not-a-model", 1_000_000, 1_000_000)) // 0
 * ```
 *
 * @returns Estimated USD; `0` when {@link getPricing} has no row for the model.
 * @see {@link getPricing} for the per-1M-token table this multiplies.
 * @category observability
 * @since 0.0.0
 */
export const calculateCost = dual3((model: string, inputTokens: number, outputTokens: number): number => {
  const pricing = PRICING[model];
  if (P.not(P.isTruthy)(pricing)) return 0;

  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;
  return inputCost + outputCost;
});
