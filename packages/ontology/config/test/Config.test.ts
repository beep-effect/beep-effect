import { OntologyConfigLive } from "@beep/ontology-config/layer";
import { OntologyConfig } from "@beep/ontology-config/server";
import { describe, expect, it } from "@effect/vitest";
import { Cause, ConfigProvider, Effect, Exit, Layer } from "effect";

const configLayer = (configuration: Readonly<Record<string, string>>) =>
  OntologyConfigLive.pipe(Layer.provide(ConfigProvider.layer(ConfigProvider.fromUnknown(configuration))));

const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E | E2, RIn | Exclude<R, ROut>> =>
    Effect.scoped(Layer.build(layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

describe("OntologyConfigLive", () => {
  it.effect("resolves the required ontology workspace root", () =>
    Effect.gen(function* () {
      const config = yield* OntologyConfig.pipe(
        provideScopedLayer(configLayer({ ONTOLOGY_WORKSPACE_ROOT: "/srv/ontology" }))
      );

      expect(config.workspaceRoot).toBe("/srv/ontology");
    })
  );

  it.effect("keeps missing and empty configuration in the typed failure channel", () =>
    Effect.gen(function* () {
      for (const configuration of [{}, { ONTOLOGY_WORKSPACE_ROOT: "" }]) {
        const exit = yield* Effect.exit(OntologyConfig.pipe(provideScopedLayer(configLayer(configuration))));

        expect(Exit.isFailure(exit)).toBe(true);
        if (Exit.isFailure(exit)) {
          expect(Cause.hasFails(exit.cause)).toBe(true);
          expect(Cause.hasDies(exit.cause)).toBe(false);
        }
      }
    })
  );
});
