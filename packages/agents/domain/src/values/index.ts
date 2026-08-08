/**
 * Agents domain value-object exports.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Root export for assistant-content value-object schemas and mapping helpers.
 *
 * **Example** (Decode AssistantBlock schema)
 *
 * ```ts
 * import { AssistantBlock } from "@beep/agents-domain/values"
 * import * as S from "effect/Schema"
 *
 * const block = S.decodeUnknownSync(AssistantBlock)({
 *   type: "paragraph",
 *   children: [{ type: "text", text: "Hello" }],
 * })
 * console.log(block.type)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export * from "./AssistantContent/index.ts";
