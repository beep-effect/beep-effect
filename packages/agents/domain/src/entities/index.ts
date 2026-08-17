/**
 * Agents domain entity namespaces.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Agent entity and value-schema exports.
 *
 * **Example** (Access Agent entity type)
 *
 * ```ts
 * import { Agent } from "@beep/agents-domain/entities"
 *
 * console.log(Agent.sql.tableName)
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export * from "./Agent/index.ts";
/**
 * Shared fixture-backed entity field schemas.
 *
 * **Example** (Decode AgentFixtureKey schema)
 *
 * ```ts
 * import { AgentFixtureKey } from "@beep/agents-domain/entities"
 * import * as S from "effect/Schema"
 *
 * console.log(S.decodeUnknownSync(AgentFixtureKey)("agent.reviewer"))
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export * from "./Fixture.values.ts";
/**
 * ProviderInstance entity, value-schema, and behavior exports.
 *
 * **Example** (Access ProviderInstance entity type)
 *
 * ```ts
 * import { ProviderInstance } from "@beep/agents-domain/entities"
 *
 * console.log(ProviderInstance.sql.tableName)
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export * from "./ProviderInstance/index.ts";
/**
 * Skill entity exports.
 *
 * **Example** (Access Skill table name)
 *
 * ```ts
 * import { Skill } from "@beep/agents-domain/entities"
 *
 * console.log(Skill.sql.tableName)
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export * from "./Skill/index.ts";
