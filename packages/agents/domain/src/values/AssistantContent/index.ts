/**
 * AssistantContent value-object exports.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * AssistantContent Markdown projection helpers.
 *
 * **Example** (Convert content to document)
 *
 * ```ts
 * import { assistantContentToDocument } from "@beep/agents-domain/values/AssistantContent"
 *
 * const document = assistantContentToDocument([
 *   { type: "paragraph", children: [{ type: "text", text: "Hello" }] },
 * ])
 * console.log(document._tag)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export * from "./AssistantContent.behavior.ts";
/**
 * AssistantContent schema model exports.
 *
 * **Example** (Decode empty AssistantContent)
 *
 * ```ts
 * import { AssistantContent } from "@beep/agents-domain/values/AssistantContent"
 * import * as S from "effect/Schema"
 *
 * const content = S.decodeUnknownSync(AssistantContent)({ blocks: [] })
 * console.log(content.blocks.length)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export * from "./AssistantContent.model.ts";
