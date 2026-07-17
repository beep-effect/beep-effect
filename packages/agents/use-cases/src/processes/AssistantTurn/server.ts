/**
 * Server-only assistant-turn generation exports.
 *
 * @packageDocumentation
 * @category errors
 * @since 0.0.0
 */

/**
 * Server-only repair port errors.
 *
 * @example
 * ```ts
 * import { AssistantTurn } from "@beep/agents-use-cases/server"
 *
 * const error = AssistantTurn.BlockRepairFailed.make({ message: "repair call failed" })
 * console.log(error._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export * from "./AssistantTurn.repair-errors.ts";
