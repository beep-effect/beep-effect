/**
 * Test seams inside `Journal.changes`.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $JsonlId } from "@beep/identity/packages";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";

const $I = $JsonlId.create("internal/changesSeam");

/**
 * An effect `changes` runs right after it reads whether the journal is already
 * terminal or closed, and before it acts on that answer.
 *
 * **Details**
 *
 * Defaults to `Effect.void`. Regression tests provide an effect that appends a
 * terminal envelope or closes the journal at exactly this point, so the race
 * between the terminal read and the hub subscription is driven
 * deterministically instead of by timing.
 *
 * **Example** (Run an effect at the terminal check)
 *
 * ```ts
 * import { AfterTerminalCheck } from "@beep/jsonl/internal/changesSeam"
 * import * as Effect from "effect/Effect"
 *
 * const program = Effect.provideService(
 *   Effect.flatten(AfterTerminalCheck),
 *   AfterTerminalCheck,
 *   Effect.log("terminal state read")
 * )
 * ```
 *
 * @internal
 * @category testing
 * @since 0.0.0
 */
export const AfterTerminalCheck: Context.Reference<Effect.Effect<void>> = Context.Reference<Effect.Effect<void>>(
  $I`AfterTerminalCheck`,
  { defaultValue: () => Effect.void }
);
