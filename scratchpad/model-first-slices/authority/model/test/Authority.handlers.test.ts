import * as NodeServices from "@effect/platform-node/NodeServices";
import { it } from "@effect/vitest";
import * as HandlerRegistry from "@proto/tooling/HandlerRegistry";
import * as Effect from "effect/Effect";
import { registry } from "../scripts/Authority.registry.ts";

it.effect("the handler registry is exactly what the model generates", () =>
  Effect.flatMap(registry, HandlerRegistry.check).pipe(Effect.provide(NodeServices.layer)),
);
