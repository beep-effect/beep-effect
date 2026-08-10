/**
 * Reusable Effect layer helpers for tests.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Effect, Layer } from "effect";

/**
 * Provide a layer to an effect inside a scoped lifetime.
 *
 * **Details**
 *
 * This is the test-friendly counterpart to `Effect.provide` for layers that
 * allocate resources and need their finalizers to run after the assertion body.
 *
 * **Example** (Provide layer in scoped lifetime)
 *
 * ```ts
 * import { provideScopedLayer } from "@beep/test-utils"
 * import { Effect, Layer } from "effect"
 *
 * const layer = Layer.empty
 * const program = Effect.void.pipe(provideScopedLayer(layer))
 * console.log(program)
 * ```
 *
 * @param layer - Layer to build inside the scoped test lifetime.
 * @returns A data-last provider for the supplied layer.
 * @category layers
 * @since 0.0.0
 */
export const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E | E2, RIn | Exclude<R, ROut>> =>
    Effect.scoped(Layer.build(layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));
