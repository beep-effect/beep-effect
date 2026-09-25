/**
 * Live runtime layer for API documentation routes.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as BunHttpServer from "@effect/platform-bun/BunHttpServer";
import * as BunServices from "@effect/platform-bun/BunServices";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as HttpRouter from "effect/unstable/http/HttpRouter";
import * as HttpApiBuilder from "effect/unstable/httpapi/HttpApiBuilder";
import { Api, Health } from "../Api.ts";
import { CatalogRoutes } from "../Docs.routes.ts";

const handlers = HttpApiBuilder.group(Api, "api-docs", (group) =>
  group.handle("health", () => Effect.succeed(Health.make({ status: "ok" })))
);

const HealthLive = HttpApiBuilder.layer(Api).pipe(
  Layer.provide(handlers),
  Layer.provide(BunHttpServer.layerHttpServices)
);
const CatalogLive = CatalogRoutes.pipe(HttpRouter.provideRequest(BunServices.layer));

/**
 * Live router layer combining the health contract with catalog documentation and raw-spec routes.
 *
 * **Example** (Inspect the application layer)
 *
 * ```ts
 * import { ApiLive } from "@beep/api-docs/src/runtime/Layer"
 * import { Layer } from "effect"
 *
 * console.log(Layer.isLayer(ApiLive)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const ApiLive = Layer.merge(HealthLive, CatalogLive);
