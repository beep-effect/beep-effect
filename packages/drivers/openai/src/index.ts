/**
 * Product-neutral Effect layers for OpenAI language and embedding models.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Package version published by the `@beep/openai` entry point.
 *
 * **Example** (Build a package coordinate)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { VERSION } from "@beep/openai"
 *
 * strictEqual(`@beep/openai@${VERSION}`, "@beep/openai@0.0.0")
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const VERSION = "0.0.0";

/**
 * Schema-backed OpenAI environment bindings, defaults, and model options.
 *
 * @category configuration
 * @since 0.0.0
 */
export * from "./OpenAi.config.ts";
/**
 * Error types surfaced by the OpenAI driver boundary.
 *
 * @category errors
 * @since 0.0.0
 */
export * from "./OpenAi.errors.ts";
/**
 * OpenAI client, language-model, and embedding-model Layer factories.
 *
 * @category layers
 * @since 0.0.0
 */
export * from "./OpenAi.service.ts";
