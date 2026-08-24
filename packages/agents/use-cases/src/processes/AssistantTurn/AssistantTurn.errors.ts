/**
 * Client-safe errors for the assistant-turn generation kernel.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $AgentsUseCasesId } from "@beep/identity/packages";
import { Effect, flow } from "effect";
import * as S from "effect/Schema";

const $I = $AgentsUseCasesId.create("processes/AssistantTurn/AssistantTurn.errors");

const TurnGenerationErrorFields = {
  message: S.String,
} satisfies S.Struct.Fields;
const sameTurnGenerationErrorFields = S.toEquivalence(S.TaggedStruct("TurnGenerationError", TurnGenerationErrorFields));
const sameTurnGenerationError = (self: TurnGenerationError, that: TurnGenerationError): boolean =>
  sameTurnGenerationErrorFields(self, that);

/**
 * Public action failure raised when an assistant turn cannot be generated.
 * This is the client-safe error a turn kernel implementation may fail with.
 *
 * **Example** (Creating a TurnGenerationError)
 *
 * ```ts
 * import { TurnGenerationError } from "@beep/agents-use-cases/public"
 *
 * console.log(TurnGenerationError.make({ message: "turn generation failed" }))
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class TurnGenerationError extends S.TaggedError<TurnGenerationError>($I`TurnGenerationError`)(
  "TurnGenerationError",
  TurnGenerationErrorFields,
  $I.annoteClass<
    S.declare<TurnGenerationError>,
    readonly [S.TaggedStruct<"TurnGenerationError", typeof TurnGenerationErrorFields>]
  >("TurnGenerationError", {
    description: "Raised when an assistant turn cannot be generated from the supplied history.",

    toEquivalence: () => sameTurnGenerationError,
  })
) {
  static readonly new = (message: string) => TurnGenerationError.make({ message });

  static readonly failEffect = flow(this.new, Effect.fail);

  static readonly failEffectThunk = flow(this.failEffect, (effect) => () => effect);
}
