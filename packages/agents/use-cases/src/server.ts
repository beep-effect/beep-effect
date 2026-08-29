/**
 * Server-only agents use-case exports.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Server-only provider-instance ports and implementation factory.
 *
 * **Example** (Access ProviderInstance ProviderProbe)
 *
 * ```ts
 * import { ProviderInstance } from "@beep/agents-use-cases/server"
 * console.log(ProviderInstance.ProviderProbe)
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export * as ProviderInstance from "./entities/ProviderInstance/server.ts";
/**
 * Direct server-only provider-instance port and factory exports.
 *
 * **Example** (Import ProviderProbe directly)
 *
 * ```ts
 * import { ProviderProbe } from "@beep/agents-use-cases/server"
 * console.log(ProviderProbe)
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export * from "./entities/ProviderInstance/server.ts";
/**
 * Server-only assistant-turn use-case exports.
 *
 * **Example** (Create BlockRepairFailed error)
 *
 * ```ts
 * import { AssistantTurn } from "@beep/agents-use-cases/server"
 *
 * const error = AssistantTurn.BlockRepairFailed.make({ message: "repair call failed" })
 * console.log(error.message)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export * as AssistantTurn from "./processes/AssistantTurn/server.ts";
/**
 * Direct server-only assistant-turn exports.
 *
 * **Example** (Inspect BlockRepairFailed tag)
 *
 * ```ts
 * import { BlockRepairFailed } from "@beep/agents-use-cases/server"
 *
 * const error = BlockRepairFailed.make({ message: "repair call failed" })
 * console.log(error._tag) // "BlockRepairFailed"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export * from "./processes/AssistantTurn/server.ts";
