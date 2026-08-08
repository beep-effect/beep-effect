/**
 * Runtime configuration defaults and schema-backed option models for the
 * Anthropic driver.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $AnthropicId } from "@beep/identity";
import { PosInt, SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $AnthropicId.create("Anthropic.config");
const AnthropicTokenPriceUsd = S.Finite.check(S.isGreaterThanOrEqualTo(0));

/**
 * Environment binding used by {@link AnthropicLive} for the redacted API key.
 *
 * **Details**
 *
 * Store secret-reference strings in local configuration and let Effect Config
 * plus the process environment resolve the actual value; this package never
 * needs callers to pass a raw API key directly.
 *
 * **Example** (Secret reference env binding)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { ANTHROPIC_API_KEY_ENV } from "@beep/anthropic"
 *
 * const localEnv = {
 *   [ANTHROPIC_API_KEY_ENV]: "op://BEEP_SECRETS/Anthropic/API Key",
 * }
 *
 * strictEqual(localEnv.AI_ANTHROPIC_API_KEY, "op://BEEP_SECRETS/Anthropic/API Key")
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const ANTHROPIC_API_KEY_ENV = "AI_ANTHROPIC_API_KEY" as const;

/**
 * Environment binding overriding the model used by the default language-model layer.
 *
 * **Details**
 *
 * When unset, {@link ANTHROPIC_DEFAULT_MODEL} applies. The identifier must be
 * accepted by the generated `@effect/ai-anthropic` catalog, which validates
 * streamed response model ids.
 *
 * **Example** (Override model via env)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { ANTHROPIC_MODEL_ENV } from "@beep/anthropic"
 *
 * const localEnv = {
 *   [ANTHROPIC_MODEL_ENV]: "claude-haiku-4-5",
 * }
 *
 * strictEqual(localEnv.AI_ANTHROPIC_MODEL, "claude-haiku-4-5")
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const ANTHROPIC_MODEL_ENV = "AI_ANTHROPIC_MODEL" as const;

/**
 * Claude model used by the default language-model layer.
 *
 * **Details**
 *
 * The generated `@effect/ai-anthropic` catalog validates streamed response
 * model ids. Keep this pinned until the upstream catalog accepts newer model
 * identifiers.
 *
 * **Example** (Default Claude model id)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { ANTHROPIC_DEFAULT_MODEL } from "@beep/anthropic"
 *
 * const requestDefaults = { model: ANTHROPIC_DEFAULT_MODEL }
 *
 * strictEqual(requestDefaults.model, "claude-opus-4-6")
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const ANTHROPIC_DEFAULT_MODEL = "claude-opus-4-6" as const;

/**
 * Default maximum output-token budget for rich assistant turns.
 *
 * **Example** (Default max tokens option)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { ANTHROPIC_DEFAULT_MAX_TOKENS, AnthropicLanguageModelOptions } from "@beep/anthropic"
 * import { PosInt } from "@beep/schema"
 *
 * const options = AnthropicLanguageModelOptions.make({
 *   maxTokens: PosInt.make(ANTHROPIC_DEFAULT_MAX_TOKENS),
 * })
 *
 * strictEqual(options.maxTokens, 16_384)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const ANTHROPIC_DEFAULT_MAX_TOKENS = 16_384 as const;

/**
 * Maximum acquisition attempts in the default turn execution plan.
 *
 * **Example** (Default exponential backoff schedule)
 *
 * ```ts
 * import { deepStrictEqual } from "node:assert"
 * import { ANTHROPIC_DEFAULT_RETRY_ATTEMPTS, ANTHROPIC_DEFAULT_RETRY_BASE_DELAY_MILLIS } from "@beep/anthropic"
 *
 * const defaultBackoffMillis = Array.from(
 *   { length: ANTHROPIC_DEFAULT_RETRY_ATTEMPTS },
 *   (_, attempt) => ANTHROPIC_DEFAULT_RETRY_BASE_DELAY_MILLIS * 2 ** attempt
 * )
 *
 * deepStrictEqual(defaultBackoffMillis, [250, 500, 1000, 2000])
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const ANTHROPIC_DEFAULT_RETRY_ATTEMPTS = 4 as const;

/**
 * Initial delay, in milliseconds, for the default exponential retry schedule.
 *
 * **Example** (Second retry delay calculation)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { ANTHROPIC_DEFAULT_RETRY_BASE_DELAY_MILLIS } from "@beep/anthropic"
 *
 * const secondRetryDelayMillis = ANTHROPIC_DEFAULT_RETRY_BASE_DELAY_MILLIS * 2
 *
 * strictEqual(secondRetryDelayMillis, 500)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const ANTHROPIC_DEFAULT_RETRY_BASE_DELAY_MILLIS = 250 as const;

/**
 * Static model-price row used for approximate usage attribution.
 *
 * **Details**
 *
 * Values are intentionally marked approximate; `UsageRecord` rows should use
 * them for product attribution, while OTLP remains observability-only.
 *
 * **Example** (Build approximate price row)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { AnthropicApproximatePrice, ANTHROPIC_DEFAULT_MODEL } from "@beep/anthropic"
 *
 * const price = AnthropicApproximatePrice.make({
 *   inputPerMillionTokensUsd: 15,
 *   model: ANTHROPIC_DEFAULT_MODEL,
 *   outputPerMillionTokensUsd: 75,
 * })
 *
 * strictEqual(price.model, ANTHROPIC_DEFAULT_MODEL)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export class AnthropicApproximatePrice extends S.Class<AnthropicApproximatePrice>($I`AnthropicApproximatePrice`)(
  {
    inputPerMillionTokensUsd: AnthropicTokenPriceUsd.annotateKey({
      description: "Approximate USD price per million input tokens for this model.",
    }),
    model: S.String.annotateKey({
      description: "Anthropic model identifier associated with the static price row.",
    }),
    outputPerMillionTokensUsd: AnthropicTokenPriceUsd.annotateKey({
      description: "Approximate USD price per million output tokens for this model.",
    }),
  },
  $I.annote("AnthropicApproximatePrice", {
    description: "Approximate static Anthropic model price used for usage attribution.",
  })
) {}

/**
 * Approximate default price row paired with {@link ANTHROPIC_DEFAULT_MODEL}.
 *
 * **Example** (Default model price values)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { ANTHROPIC_DEFAULT_APPROXIMATE_PRICE, ANTHROPIC_DEFAULT_MODEL } from "@beep/anthropic"
 *
 * strictEqual(ANTHROPIC_DEFAULT_APPROXIMATE_PRICE.model, ANTHROPIC_DEFAULT_MODEL)
 * strictEqual(ANTHROPIC_DEFAULT_APPROXIMATE_PRICE.outputPerMillionTokensUsd, 75)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const ANTHROPIC_DEFAULT_APPROXIMATE_PRICE = AnthropicApproximatePrice.make({
  inputPerMillionTokensUsd: 15,
  model: ANTHROPIC_DEFAULT_MODEL,
  outputPerMillionTokensUsd: 75,
});

/**
 * Schema-backed options accepted by Anthropic language-model layer helpers.
 *
 * **Details**
 *
 * Missing fields are normalized by schema defaults before callers build the
 * fully materialized provider config.
 *
 * **Example** (Make language model options)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { AnthropicLanguageModelOptions } from "@beep/anthropic"
 * import { PosInt } from "@beep/schema"
 *
 * const options = AnthropicLanguageModelOptions.make({
 *   maxTokens: PosInt.make(1024),
 *   model: "claude-opus-4-6",
 * })
 *
 * strictEqual(options.maxTokens, 1024)
 * strictEqual(options.model, "claude-opus-4-6")
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AnthropicLanguageModelOptions extends S.Class<AnthropicLanguageModelOptions>(
  $I`AnthropicLanguageModelOptions`
)(
  {
    maxTokens: SchemaUtils.withKeyDefaults(PosInt, PosInt.make(ANTHROPIC_DEFAULT_MAX_TOKENS)).annotateKey({
      description: "Positive maximum output-token budget forwarded to Anthropic as `max_tokens`.",
    }),
    model: SchemaUtils.withKeyDefaults(S.String, ANTHROPIC_DEFAULT_MODEL).annotateKey({
      description: "Anthropic model identifier used by the language-model layer.",
    }),
  },
  $I.annote("AnthropicLanguageModelOptions", {
    description: "Options accepted by Anthropic language-model layer helpers.",
  })
) {}
