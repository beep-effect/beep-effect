/**
 * Shared process-entrypoint boundary for the practice KG executables.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { BunRuntime } from "@effect/platform-bun";
import * as BunServices from "@effect/platform-bun/BunServices";
import { Effect, Layer } from "effect";

/**
 * Run a practice KG executable through the shared Bun service boundary when its module is the process entrypoint.
 *
 * @param input - Entrypoint status and Effect program.
 * @category utilities
 * @since 0.0.0
 */
export const runEntrypoint = <A, E>(input: {
  readonly isMain: boolean;
  readonly program: Effect.Effect<A, E, BunServices.BunServices>;
}): void => {
  if (input.isMain) {
    const main = Effect.scoped(Layer.build(Layer.effectDiscard(input.program).pipe(Layer.provide(BunServices.layer))));
    BunRuntime.runMain(main);
  }
};
