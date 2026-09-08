/**
 * Live runtime layer for the CI-operations projection lab.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as BunHttpServer from "@effect/platform-bun/BunHttpServer";
import { Effect, Layer } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";
import { Api, Health } from "../Api.ts";

const handlers = HttpApiBuilder.group(Api, "ciops", (group) =>
  group.handle("health", () => Effect.succeed(Health.make({ status: "ok" })))
);

/**
 * Live router layer for the CI-operations health contract.
 *
 * **Example** (Inspect the application layer)
 *
 * ```ts
 * import { ApiLive } from "@/runtime/Layer"
 * import { Layer } from "effect"
 *
 * console.log(Layer.isLayer(ApiLive)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const ApiLive = HttpApiBuilder.layer(Api).pipe(
  Layer.provide(handlers),
  Layer.provide(BunHttpServer.layerHttpServices)
);
