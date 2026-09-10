/**
 * Reusable Effect layer helpers for tests.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Effect, Layer } from "effect";

/**
 * Provide a pure stub layer to an effect inside a scoped lifetime.
 *
 * **When to use**
 *
 * Use with pure `Layer.succeed` or `Layer.mock` stubs for individual assertion bodies.
 *
 * **Details**
 *
 * Each execution builds the supplied layer in a new scope. For allocating or
 * effectful fixtures, register the layer with `it.layer` from
 * `@beep/test-utils/Vitest` so the test block owns its lifetime. Use an inner
 * `Effect.scoped` only for resources that must be released during an assertion body.
 *
 * **Example** (Provide a pure service stub)
 *
 * ```ts
 * import { provideScopedLayer } from "@beep/test-utils"
 * import { Context, Effect, Layer } from "effect"
 *
 * class Greeting extends Context.Service<Greeting, { readonly message: string }>()(
 *   "@beep/test-utils/examples/Layer/Greeting"
 * ) {}
 *
 * const stub = Layer.succeed(Greeting, Greeting.of({ message: "Hello" }))
 * const program = Greeting.use(({ message }) => Effect.succeed(message)).pipe(
 *   provideScopedLayer(stub)
 * )
 * Effect.runSync(program) // "Hello"
 * ```
 *
 * @param layer - Pure stub layer to build for the assertion body.
 * @returns A data-last provider for the supplied layer.
 * @category layers
 * @since 0.0.0
 */
export const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E | E2, RIn | Exclude<R, ROut>> =>
    Effect.scoped(Layer.build(layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));
