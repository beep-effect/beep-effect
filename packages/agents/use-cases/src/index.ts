/**
 * Agents use-case public entrypoint.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Public runtime SDK contract exports.
 *
 * @example
 * ```ts
 * import { TurnHistoryItem } from "@beep/agents-use-cases"
 * import * as S from "effect/Schema"
 *
 * const item = S.decodeUnknownSync(TurnHistoryItem)({ role: "user", text: "Hello" })
 * console.log(item.role) // "user"
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export * from "./public.ts";
