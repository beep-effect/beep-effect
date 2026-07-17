/**
 * Assistant-turn generation kernel: contracts, errors, port, and fixture.
 *
 * @packageDocumentation
 * @category use-cases
 * @since 0.0.0
 */

/**
 * Assistant-turn DTO contracts.
 *
 * @example
 * ```ts
 * import { TurnHistoryItem } from "@beep/agents-use-cases/public"
 * import * as S from "effect/Schema"
 *
 * const item = S.decodeUnknownSync(TurnHistoryItem)({ role: "user", text: "Hello" })
 * console.log(item.role)
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export * from "./AssistantTurn.contracts.ts";
/**
 * Assistant-turn public errors.
 *
 * @example
 * ```ts
 * import { TurnGenerationError } from "@beep/agents-use-cases/public"
 *
 * const error = TurnGenerationError.make({ message: "turn generation failed" })
 * console.log(error._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export * from "./AssistantTurn.errors.ts";
/**
 * Assistant-turn generation kernel port.
 *
 * @example
 * ```ts
 * import { AgentTurnKernel } from "@beep/agents-use-cases/public"
 * import { FixtureTurnKernel } from "@beep/agents-use-cases/proof"
 * import { Effect, Stream } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const kernel = yield* AgentTurnKernel
 *   return yield* Stream.runCollect(kernel.streamTurn([{ role: "user", text: "ping" }]))
 * }).pipe(Effect.provide(FixtureTurnKernel))
 *
 * Effect.runPromise(program).then((blocks) => console.log(blocks.length))
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export * from "./AssistantTurn.kernel.ts";
