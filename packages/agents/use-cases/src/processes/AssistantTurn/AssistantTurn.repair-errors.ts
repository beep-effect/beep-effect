/**
 * Server-only assistant-turn repair port errors.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $AgentsUseCasesId } from "@beep/identity/packages";
import { Effect, flow } from "effect";
import * as S from "effect/Schema";

const $I = $AgentsUseCasesId.create("processes/AssistantTurn/AssistantTurn.repair-errors");

/**
 * Port failure raised when the block-repair adapter cannot complete its repair call.
 *
 * **Example** (Creating a BlockRepairFailed error)
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
export class BlockRepairFailed extends S.TaggedError<BlockRepairFailed>($I`BlockRepairFailed`)(
  "BlockRepairFailed",
  {
    message: S.String,
  },
  $I.annoteError<BlockRepairFailed>("BlockRepairFailed", {
    description: "Raised when the assistant-turn block repair adapter cannot complete its repair call.",
  })
) {
  static readonly new = (message: string) => BlockRepairFailed.make({ message });

  static readonly failEffect = flow(this.new, Effect.fail);

  static readonly is = S.is(BlockRepairFailed);
}
