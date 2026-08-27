/**
 * Error vocabulary exposed by the OpenAI driver boundary.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import type { Config } from "effect";
import type { AiError } from "effect/unstable/ai";

/**
 * Typed failures callers may observe while acquiring or using OpenAI Layers.
 *
 * **Details**
 *
 * Configuration failures come from Effect `Config`; provider, transport, and
 * response failures remain Effect AI's `AiError`. The driver introduces no
 * extra failure mode, so it does not wrap either error in a package-local tag.
 *
 * **Example** (Narrow an Effect AI failure)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import type { OpenAiError } from "@beep/openai"
 * import { AiError } from "effect/unstable/ai"
 *
 * const error: OpenAiError = AiError.make({
 *   method: "createEmbedding",
 *   module: "OpenAiClient",
 *   reason: AiError.UnknownError.make({ description: "provider unavailable" })
 * })
 *
 * strictEqual(error._tag, "AiError")
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export type OpenAiError = Config.ConfigError | AiError.AiError;
