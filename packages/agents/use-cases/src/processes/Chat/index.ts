/**
 * Chat wire contract: rpc declarations and client-safe action error.
 *
 * @packageDocumentation
 * @category use-cases
 * @since 0.0.0
 */

/**
 * Chat public action error.
 *
 * @example
 * ```ts
 * import { ChatActionError } from "@beep/agents-use-cases/public"
 *
 * const error = ChatActionError.make({ message: "thread not found" })
 * console.log(error._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export * from "./Chat.errors.ts";
/**
 * Chat rpc declarations and the `ChatRpcs` group.
 *
 * @example
 * ```ts
 * import { ChatRpcs } from "@beep/agents-use-cases/public"
 *
 * console.log([...ChatRpcs.requests.keys()].sort())
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export * from "./Chat.rpc.ts";
