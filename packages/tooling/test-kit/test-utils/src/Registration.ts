/**
 * Values a test module needs while it registers, before any `it.effect` runs.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as Effect from "effect/Effect";

/**
 * Run a requirement-free effect once, synchronously, while a test module
 * registers its suites.
 *
 * **Details**
 *
 * Vitest decides `skipIf`, `runIf` and suite shape while it collects a file,
 * before any `it.effect` body runs. Use this for the few values that decision
 * needs: an opt-in `Config` flag, an optional fixture directory, a per-run
 * table prefix. A test body never calls it; it runs inside `it.effect` and
 * test layers.
 *
 * **Gotchas**
 *
 * A failure or an asynchronous step throws during collection, so the whole
 * file fails loudly instead of silently skipping. Use
 * {@link atRegistrationAsync} for a probe that has to wait, such as a process
 * spawn.
 *
 * **Example** (Gate a suite on an opt-in flag)
 *
 * ```ts
 * import { atRegistration } from "@beep/test-utils/Registration"
 * import * as Config from "effect/Config"
 *
 * const enabled = atRegistration(Config.Boolean("BEEP_EXAMPLE_LIVE").pipe(Config.withDefault(false)))
 * console.log(typeof enabled) // "boolean"
 * ```
 *
 * @param effect - The requirement-free, synchronous effect to run.
 * @returns The value the effect produced.
 * @category testing
 * @since 0.0.0
 */
export const atRegistration = <A, E>(effect: Effect.Effect<A, E>): A => Effect.runSync(effect);

/**
 * Run a requirement-free effect once while a test module registers its
 * suites, waiting for it to finish.
 *
 * **Details**
 *
 * The asynchronous counterpart of {@link atRegistration}, for a registration
 * probe that has to wait, such as checking that a binary is on `PATH`. Await
 * it at the module's top level.
 *
 * **Example** (Probe for an optional tool)
 *
 * ```ts
 * import { atRegistrationAsync } from "@beep/test-utils/Registration"
 * import * as Effect from "effect/Effect"
 *
 * const available = await atRegistrationAsync(Effect.succeed(true))
 * console.log(available) // true
 * ```
 *
 * @param effect - The requirement-free effect to run.
 * @returns A promise of the value the effect produced.
 * @category testing
 * @since 0.0.0
 */
export const atRegistrationAsync = <A, E>(effect: Effect.Effect<A, E>): Promise<A> => Effect.runPromise(effect);
