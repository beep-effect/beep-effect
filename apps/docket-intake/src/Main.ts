/**
 * The docket intake command line over its live wiring.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as BunServices from "@effect/platform-bun/BunServices";
import { Effect, Layer, Logger } from "effect";
import { Command } from "effect/cli";
import { makeCommand } from "./Commands.ts";
import { liveWiring } from "./runtime/Layer.ts";

/**
 * The whole program: parse the command line and run the chosen command. Logs
 * go to standard error, so standard output carries only the JSON lines the
 * commands print.
 *
 * **Example** (Reference the entry program)
 *
 * ```ts
 * import { main } from "../../src/Main.ts"
 *
 * console.log(main)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const main = Effect.scoped(
  Layer.build(
    Layer.effectDiscard(Command.run(makeCommand(liveWiring), { version: "0.0.0" })).pipe(
      Layer.provide(BunServices.layer),
      Layer.provide(Layer.succeed(Logger.LogToStderr, true))
    )
  )
);
