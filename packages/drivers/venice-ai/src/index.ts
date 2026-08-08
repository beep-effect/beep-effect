/**
 * Venice AI driver package exports.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Public Venice AI driver exports.
 *
 * **Example** (Import VeniceAI service)
 *
 * ```ts
 * import { VeniceAI } from "@beep/venice-ai"
 *
 * const service = VeniceAI
 * console.log(service)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export * from "./VeniceAI.service.ts";
/**
 * Effect AI language-model adapter exports for Venice chat completions.
 *
 * **Example** (Create Venice language model)
 *
 * ```ts
 * import { VeniceAiLanguageModel } from "@beep/venice-ai"
 *
 * const aiModel = VeniceAiLanguageModel.model("llama-3.3-70b")
 * console.log(aiModel)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export * as VeniceAiLanguageModel from "./VeniceAiLanguageModel.service.ts";

/**
 * Current version of the `@beep/venice-ai` package.
 *
 * **Example** (Log package version)
 *
 * ```ts
 * import { VERSION } from "@beep/venice-ai"
 *
 * console.log(VERSION)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const VERSION = "0.0.0";
