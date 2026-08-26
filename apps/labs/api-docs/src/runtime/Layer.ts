import * as BunHttpServer from "@effect/platform-bun/BunHttpServer";
import * as BunServices from "@effect/platform-bun/BunServices";
import { Effect, Layer } from "effect";
import { HttpRouter } from "effect/unstable/http";
import { HttpApiBuilder } from "effect/unstable/httpapi";
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

export const ApiLive = Layer.merge(HealthLive, CatalogLive);
