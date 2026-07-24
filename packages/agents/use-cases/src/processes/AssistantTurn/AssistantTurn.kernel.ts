/**
 * The assistant-turn generation kernel port.
 *
 * This is the single port both the (future) Anthropic implementation and the
 * deterministic fixture satisfy: given a plain-text history, stream the next
 * assistant turn as a sequence of indexed blocks. Implementations translate
 * their internal failures into the public {@link TurnGenerationError}.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $AgentsUseCasesId } from "@beep/identity/packages";
import { Context } from "effect";
import type * as Stream from "effect/Stream";
import type { IndexedBlock, TurnHistoryItem } from "./AssistantTurn.contracts.ts";
import type { TurnGenerationError } from "./AssistantTurn.errors.ts";

const $I = $AgentsUseCasesId.create("processes/AssistantTurn/AssistantTurn.kernel");

/**
 * Service shape of the assistant-turn generation kernel.
 *
 * @example
 * ```ts
 * import type { AgentTurnKernelShape } from "@beep/agents-use-cases/public"
 * import { Stream } from "effect"
 *
 * const kernel: AgentTurnKernelShape = {
 *   streamTurn: () => Stream.empty
 * }
 *
 * const stream = kernel.streamTurn([{ role: "user", text: "Summarize this." }])
 * console.log(stream)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export interface AgentTurnKernelShape {
  /**
   * Streams the next generated assistant turn for the supplied prompt history.
   *
   * @since 0.0.0
   */
  readonly streamTurn: (history: ReadonlyArray<TurnHistoryItem>) => Stream.Stream<IndexedBlock, TurnGenerationError>;
}

/**
 * Assistant-turn generation kernel service tag.
 *
 * @example
 * ```ts
 * import { AgentTurnKernel } from "@beep/agents-use-cases/public"
 * import { FixtureTurnKernel } from "@beep/agents-use-cases/proof"
 * import { Effect, Stream } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const kernel = yield* AgentTurnKernel
 *   const blocks = yield* Stream.runCollect(
 *     kernel.streamTurn([{ role: "user", text: "ping" }])
 *   )
 *
 *   return blocks.map((block) => block.index)
 * }).pipe(Effect.provide(FixtureTurnKernel))
 *
 * Effect.runPromise(program).then(console.log) // [0, 1, 2, 3]
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class AgentTurnKernel extends Context.Service<AgentTurnKernel, AgentTurnKernelShape>()($I`AgentTurnKernel`) {}
