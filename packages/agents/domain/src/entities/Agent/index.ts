/**
 * Agent entity subpath exports.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Agent entity schema exports.
 *
 * **Example** (Import Agent entity type)
 *
 * ```ts
 * import { Agent } from "@beep/agents-domain/entities/Agent"
 *
 * console.log(Agent.definition.entityId.entityType)
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export * from "./Agent.model.ts";
/**
 * Agent value-schema exports.
 *
 * **Example** (Check AgentMode deterministic fixture)
 *
 * ```ts
 * import { AgentMode } from "@beep/agents-domain/entities/Agent"
 *
 * console.log(AgentMode.is.deterministic_fixture("deterministic_fixture"))
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export * from "./Agent.values.ts";
