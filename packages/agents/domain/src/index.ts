/**
 * Agents domain models.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Namespace export for agent-domain entity schemas.
 *
 * @example
 * ```ts
 * import { Entities } from "@beep/agents-domain"
 *
 * console.log(Entities.Agent.definition.entityId.entityType)
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export * as Entities from "./entities/index.ts";
/**
 * Root export for agent-domain entity schemas.
 *
 * @example
 * ```ts
 * import { Agent, Skill } from "@beep/agents-domain"
 *
 * console.log(Agent.definition.entityId.entityType, Skill.definition.entityId.tableName)
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export * from "./entities/index.ts";
/**
 * Namespace export for assistant-content value objects.
 *
 * @example
 * ```ts
 * import { Values } from "@beep/agents-domain"
 * import * as S from "effect/Schema"
 *
 * const block = S.decodeUnknownSync(Values.AssistantBlock)({
 *   type: "paragraph",
 *   children: [{ type: "text", text: "Hello" }],
 * })
 * console.log(block.type)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export * as Values from "./values/index.ts";
/**
 * Root export for assistant-content value objects.
 *
 * @example
 * ```ts
 * import { AssistantContent } from "@beep/agents-domain"
 * import * as S from "effect/Schema"
 *
 * const content = S.decodeUnknownSync(AssistantContent)({ blocks: [] })
 * console.log(content.blocks.length)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export * from "./values/index.ts";
