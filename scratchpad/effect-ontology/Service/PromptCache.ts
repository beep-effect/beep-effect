/**
 * Two-message Prompt construction for extraction calls.
 *
 * **Details**
 *
 * Builds a Prompt with a system instruction followed by a user text part.
 * Caching flags are accepted for call-site compatibility and are currently
 * ignored; these helpers do not attach Anthropic `cache_control` metadata.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Prompt } from "effect/unstable/ai";
import type { StructuredPrompt } from "../Prompt/PromptGenerator.ts";
import { dual2, dual3 } from "../Utils/Dual.ts";

/**
 * Build a two-message extraction Prompt from a system instruction and user text.
 *
 * **Details**
 *
 * The helper always emits a system message followed by a user text part. It does
 * not currently attach Anthropic `cache_control` metadata.
 *
 * **Gotchas**
 *
 * `enableCaching` is accepted for call-site compatibility and is ignored. Passing
 * `true` does not mark the system message as ephemeral or otherwise enable
 * provider prompt caching.
 *
 * **Example** (Build a two-message prompt)
 *
 * ```ts
 * import { makeCachedPrompt } from "@effect-ontology/Service/PromptCache"
 *
 * const prompt = makeCachedPrompt(
 *   "You extract ontology-aligned entities.",
 *   "Extract entities from: Ada wrote a program.",
 *   true
 * )
 * console.log(prompt.content.length) // 2
 * console.log(JSON.stringify(prompt).includes("cache_control")) // false
 * ```
 *
 * @param systemMessage - System instruction placed in the first prompt message
 * @param userMessage - Variable user text placed in the second prompt message
 * @param enableCaching - Reserved flag; currently unused by the runtime
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
 * Build a Prompt from a structured system/user pair.
 *
 * **Details**
 *
 * Delegates to {@link makeCachedPrompt} after reading `systemMessage` and
 * `userMessage` from the structured prompt.
 *
 * **Gotchas**
 *
 * `enableCaching` is forwarded unchanged and is currently ignored by
 * {@link makeCachedPrompt}.
 *
 * **Example** (Wrap a structured prompt)
 *
 * ```ts
 * import { StructuredPrompt } from "@effect-ontology/Prompt/PromptGenerator"
 * import { makeCachedPromptFromStructured } from "@effect-ontology/Service/PromptCache"
 *
 * const structured = StructuredPrompt.make({
 *   systemMessage: "You extract ontology-aligned entities.",
 *   userMessage: "Extract entities from: Ada wrote a program."
 * })
 * const prompt = makeCachedPromptFromStructured(structured, false)
 * console.log(prompt.content.length) // 2
 * ```
 *
 * @param structured - Structured prompt with system and user messages
 * @param enableCaching - Reserved flag; currently unused by the runtime
 * @category constructors
 * @since 0.0.0
 */
export const makeCachedPromptFromStructured = dual2(
  (structured: StructuredPrompt, enableCaching: boolean): Prompt.Prompt =>
    makeCachedPrompt(structured.systemMessage, structured.userMessage, enableCaching)
);
