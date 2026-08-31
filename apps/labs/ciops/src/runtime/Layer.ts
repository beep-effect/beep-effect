import { Effect, Layer } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";
import { Api, Health } from "../Api.ts";

const handlers = HttpApiBuilder.group(Api, "ciops", (group) =>
  group.handle("health", () => Effect.succeed(Health.make({ status: "ok" })))
);

export const ApiLive = HttpApiBuilder.layer(Api).pipe(Layer.provide(handlers));
