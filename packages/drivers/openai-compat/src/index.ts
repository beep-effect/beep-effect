/**
 * OpenAI-compatible provider driver exports.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * OpenAI-compatible driver package version.
 *
 * **Example** (Import package VERSION)
 *
 * ```ts
 * import { VERSION } from "@beep/openai-compat"
 *
 * const version: "0.0.0" = VERSION
 *
 * console.log(version)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const VERSION = "0.0.0" as const;

/**
 * OpenAI-compatible schema model exports.
 *
 * **Example** (Build chat completion request)
 *
 * ```ts
 * import { OpenAiCompatChatCompletionRequest, OpenAiCompatUserChatMessage } from "@beep/openai-compat"
 *
 * const request = OpenAiCompatChatCompletionRequest.make({
 *   messages: [OpenAiCompatUserChatMessage.make({ content: "Hello", role: "user" })],
 *   model: "compat-model"
 * })
 * console.log(request)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export * from "./OpenAiCompat.models.ts";
/**
 * OpenAI-compatible HTTP client exports.
 *
 * **Example** (Import OpenAiCompatClient)
 *
 * ```ts
 * import { OpenAiCompatClient } from "@beep/openai-compat"
 *
 * const service = OpenAiCompatClient
 * console.log(service)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export * from "./OpenAiCompatClient.service.ts";
/**
 * Effect AI language-model adapter exports for OpenAI-compatible chat completions.
 *
 * **Example** (Create language model adapter)
 *
 * ```ts
 * import { model } from "@beep/openai-compat"
 *
 * const aiModel = model("compat-model")
 * console.log(aiModel)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export * from "./OpenAiCompatLanguageModel.service.ts";
