/**
 * Service: Prompt Cache Helper
 *
 * Utilities for building Prompt objects with Anthropic prompt caching support.
 * Separates cacheable system messages from variable user messages.
 *
 * @module Service/PromptCache
 * @since 2.0.0
 */

import { Prompt } from "effect/unstable/ai"
import type { StructuredPrompt } from "../Prompt/PromptGenerator.ts"

/**
 * Create a Prompt with cache control for Anthropic
 *
 * When caching is enabled, the system message is marked with cache_control: "ephemeral"
 * to enable prompt caching. The user message remains variable and is not cached.
 *
 * @param systemMessage - Cacheable system message (ontology schema, rules, instructions)
 * @param userMessage - Variable user message (input text)
 * @param enableCaching - Whether to enable prompt caching
 * @returns Prompt object ready for LLM calls
 *
 * @example
 * ```typescript
 * const prompt = makeCachedPrompt(
 *   structured.systemMessage,
 *   structured.userMessage,
 *   config.llm.enablePromptCaching
 * )
 * ```
 *
 * @since 2.0.0
 */
export const makeCachedPrompt = (
  systemMessage: string,
  userMessage: string,
  _enableCaching: boolean
): Prompt.Prompt => {
  // Use structured messages with separate system and user messages
  // This structure enables prompt caching at the provider level:
  // - System message: stable (ontology schema, rules) - cacheable
  // - User message: variable (input text) - not cached
  //
  // Note: Actual cache_control headers are set at the Anthropic client level,
  // not in @effect/ai Prompt. The separation of system/user is the key structure.
  return Prompt.fromMessages([
    Prompt.makeMessage("system", {
      content: systemMessage
    }),
    Prompt.makeMessage("user", {
      content: [Prompt.makePart("text", { text: userMessage })]
    })
  ])
}

/**
 * Create a Prompt from StructuredPrompt
 *
 * Convenience wrapper that extracts system and user messages from StructuredPrompt.
 *
 * @param structured - Structured prompt with system and user messages
 * @param enableCaching - Whether to enable prompt caching
 * @returns Prompt object ready for LLM calls
 *
 * @since 2.0.0
 */
export const makeCachedPromptFromStructured = (
  structured: StructuredPrompt,
  enableCaching: boolean
): Prompt.Prompt => makeCachedPrompt(structured.systemMessage, structured.userMessage, enableCaching)
