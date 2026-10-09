import * as Semaphore from "effect/Semaphore";

/**
 * One Ink mount at a time, process-wide: a `CliUi.run` screen, or one run of a live view.
 *
 * **Details**
 *
 * Ink keys its instances by stdout and owns raw mode on the one terminal, so concurrent mounts are meaningless, and
 * serializing them keeps each mount's save-and-restore of Ink's colour level well nested.
 *
 * **Example** (Construct a serialized mount)
 *
 * ```ts
 * import { mountPermit } from "@beep/scratchpad/effected/cli/ui/internal/mountPermit"
 * import * as Effect from "effect/Effect"
 * const program = mountPermit.withPermit(Effect.succeed("mounted"))
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @internal
 * @category concurrency
 * @since 0.0.0
 */
export const mountPermit = Semaphore.makeUnsafe(1);
