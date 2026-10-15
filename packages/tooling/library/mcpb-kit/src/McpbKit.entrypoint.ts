/**
 * Process boundary for the executables an `.mcpb` bundle ships and the
 * command-line tools beside them.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { BunRuntime } from "@effect/platform-bun";
import * as BunServices from "@effect/platform-bun/BunServices";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

/**
 * Run a program with the Bun services when its module is the process
 * entrypoint; do nothing when it is imported.
 *
 * **Details**
 *
 * The program runs as a discarded layer effect under `BunRuntime.runMain`, so
 * a failure is logged and the process exits non-zero.
 *
 * **Example** (Skip a program that is not the entrypoint)
 *
 * ```ts
 * import { runMcpbEntrypoint } from "@beep/mcpb-kit"
 * import * as Effect from "effect/Effect"
 *
 * runMcpbEntrypoint({ isMain: false, program: Effect.void })
 * ```
 *
 * @param input - Whether the module is the entrypoint, and the program.
 * @category utilities
 * @since 0.0.0
 */
export const runMcpbEntrypoint = <A, E>(input: {
  readonly isMain: boolean;
  readonly program: Effect.Effect<A, E, BunServices.BunServices>;
}): void => {
  if (input.isMain) {
    const main = input.program.pipe(Layer.effectDiscard, Layer.provide(BunServices.layer), Layer.build, Effect.scoped);
    BunRuntime.runMain(main);
  }
};
