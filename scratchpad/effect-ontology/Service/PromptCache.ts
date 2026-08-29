/**
 * Service: Prompt Cache Helper
 *
 * **Details**
 *
 * Utilities for building Prompt objects with Anthropic prompt caching support.
 * Separates cacheable system messages from variable user messages.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Prompt } from "effect/unstable/ai";
import type { StructuredPrompt } from "../Prompt/PromptGenerator.ts";
import { dual2, dual3 } from "../Utils/Dual.ts";

/**
 * Create a Prompt with cache control for Anthropic
 *
 * **Details**
 *
 * When caching is enabled, the system message is marked with cache_control: "ephemeral"
 * to enable prompt caching. The user message remains variable and is not cached.
 *
 * **Example** (Use makeCachedPrompt)
 *
 * ```ts
 * import { makeCachedPrompt } from "@effect-ontology/Service/PromptCache"
 *
 * const prompt = makeCachedPrompt(
 *   "You extract ontology-aligned entities.",
 *   "Extract entities from: Ada wrote a program.",
 *   true
 * )
 * console.log(prompt)
 * ```
 *
 * @param systemMessage - Cacheable system message (ontology schema, rules, instructions)
 * @param userMessage - Variable user message (input text)
 * @param enableCaching - Whether to enable prompt caching
 * @returns Prompt object ready for LLM calls
 * @category constructors
 * @since 0.0.0
 */
export const makeCachedPrompt = dual3(
  (systemMessage: string, userMessage: string, _enableCaching: boolean): Prompt.Prompt =>
    Prompt.fromMessages([
      Prompt.makeMessage("system", {
        content: systemMessage,
      }),
      Prompt.makeMessage("user", {
        content: [Prompt.makePart("text", { text: userMessage })],
      }),
    ])
);

/**
 * Create a Prompt from StructuredPrompt
 *
 * **Details**
 *
 * Convenience wrapper that extracts system and user messages from StructuredPrompt.
 *
 * **Example** (Inspect make cached prompt from structured)
 *
 * ```ts
 * import { makeCachedPromptFromStructured } from "@effect-ontology/Service/PromptCache"
 *
 * console.log(makeCachedPromptFromStructured)
 * ```
 *
 * @param structured - Structured prompt with system and user messages
 * @param enableCaching - Whether to enable prompt caching
 * @returns Prompt object ready for LLM calls
 * @category constructors
 * @since 0.0.0
 */
export const makeCachedPromptFromStructured = dual2(
  (structured: StructuredPrompt, enableCaching: boolean): Prompt.Prompt =>
    makeCachedPrompt(structured.systemMessage, structured.userMessage, enableCaching)
);
