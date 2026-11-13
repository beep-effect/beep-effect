import * as NodeServices from "@effect/platform-node/NodeServices";
import { expect, it } from "@effect/vitest";
import * as HandlerRegistry from "@proto/tooling/HandlerRegistry";
import * as Effect from "effect/Effect";
import { registry } from "../scripts/Party.registry.ts";

it.effect("the handler registry is exactly what the model generates", () =>
  Effect.flatMap(registry, HandlerRegistry.check).pipe(Effect.provide(NodeServices.layer)),
);

it.effect("the generator refuses a model member with no handler file", () =>
  Effect.gen(function* () {
    const options = yield* registry;
    // Only the Claim Module's files: every other member's handler is missing.
    const refused = yield* HandlerRegistry.plan({ ...options, srcDir: `${options.srcDir}Claim` }).pipe(Effect.flip);
    expect(refused).toMatchObject({ _tag: "MissingHandler", member: "EffectiveParty" });
  }).pipe(Effect.provide(NodeServices.layer)),
);
