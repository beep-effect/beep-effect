/**
 * xAI API driver package.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Package version for `@beep/xai`.
 *
 * **Example** (Build package coordinate)
 *
 * ```ts
 * import { VERSION } from "@beep/xai"
 *
 * const packageCoordinate = `@beep/xai@${VERSION}`
 * console.log(packageCoordinate) // "@beep/xai@0.0.0"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const VERSION = "0.0.0" as const;

/**
 * Runtime configuration exports for the xAI driver.
 *
 * **Example** (Make empty config)
 *
 * ```ts
 * import { XAiConfigInput } from "@beep/xai"
 *
 * const config = XAiConfigInput.make({})
 * console.log(config)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export * from "./XAi.config.ts";
/**
 * Error exports for the xAI driver.
 *
 * **Example** (Create config error)
 *
 * ```ts
 * import { XAiError } from "@beep/xai"
 *
 * const error = XAiError.config()
 * console.log(error)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export * from "./XAi.errors.ts";
/**
 * Model exports for the xAI driver.
 *
 * **Example** (Make request options)
 *
 * ```ts
 * import { XAiRequestOptions } from "@beep/xai"
 *
 * const request = XAiRequestOptions.make({})
 * console.log(request)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export * from "./XAi.models.ts";
/**
 * Service exports for the xAI driver.
 *
 * **Example** (Access service layer)
 *
 * ```ts
 * import { XAi } from "@beep/xai"
 *
 * const layer = XAi.layer
 * console.log(layer)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export * from "./XAi.service.ts";
/**
 * Endpoint manifest exports for the xAI driver.
 *
 * **Example** (Log endpoints length)
 *
 * ```ts
 * import { XAI_ENDPOINTS } from "@beep/xai"
 *
 * console.log(XAI_ENDPOINTS.length)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export * from "./XAiEndpoints.models.ts";
/**
 * Effect AI language-model adapter exports for xAI chat completions.
 *
 * **Example** (Create grok-3 model)
 *
 * ```ts
 * import { XAiLanguageModel } from "@beep/xai"
 *
 * const aiModel = XAiLanguageModel.model("grok-3")
 * console.log(aiModel)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export * as XAiLanguageModel from "./XAiLanguageModel.service.ts";
