import { OntologyConfigLive, OntologyMcpConfigLive } from "@beep/ontology-config/layer";
import { OntologyConfig, OntologyMcpConfig } from "@beep/ontology-config/server";
import { describe, expect, it } from "@effect/vitest";
import { Cause, ConfigProvider, Effect, Exit, Layer } from "effect";

const configLayer = (configuration: Readonly<Record<string, string>>) =>
  OntologyConfigLive.pipe(Layer.provide(ConfigProvider.layer(ConfigProvider.fromUnknown(configuration))));

const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E | E2, RIn | Exclude<R, ROut>> =>
    Effect.scoped(Layer.build(layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

describe("OntologyConfigLive", () => {
  it.effect(
    "resolves the required ontology workspace root",
    Effect.fnUntraced(function* () {
      const config = yield* OntologyConfig.pipe(
        provideScopedLayer(configLayer({ ONTOLOGY_WORKSPACE_ROOT: "/srv/ontology" }))
      );

      expect(config.workspaceRoot).toBe("/srv/ontology");
    })
  );

  it.effect(
    "keeps missing and empty configuration in the typed failure channel",
    Effect.fnUntraced(function* () {
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

const mcpConfigLayer = (configuration: Readonly<Record<string, string>>) =>
  OntologyMcpConfigLive.pipe(Layer.provide(ConfigProvider.layer(ConfigProvider.fromUnknown(configuration))));

describe("OntologyMcpConfigLive", () => {
  it.effect(
    "leaves mutation registration off when unset",
    Effect.fnUntraced(function* () {
      const config = yield* OntologyMcpConfig.pipe(provideScopedLayer(mcpConfigLayer({})));

      expect(config.mutationsEnabled).toBe(false);
    })
  );

  it.effect(
    "enables mutation registration when explicitly set",
    Effect.fnUntraced(function* () {
      const config = yield* OntologyMcpConfig.pipe(
        provideScopedLayer(mcpConfigLayer({ ONTOLOGY_MCP_MUTATIONS_ENABLED: "true" }))
      );

      expect(config.mutationsEnabled).toBe(true);
    })
  );

  it.effect(
    "keeps a malformed flag in the typed failure channel rather than defaulting to off",
    Effect.fnUntraced(function* () {
      // Silently reading a typo as `false` would be safe but dishonest: the
      // operator asked for something and got no signal that it was ignored.
      const exit = yield* Effect.exit(
        OntologyMcpConfig.pipe(provideScopedLayer(mcpConfigLayer({ ONTOLOGY_MCP_MUTATIONS_ENABLED: "maybe" })))
      );

      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isFailure(exit)) {
        expect(Cause.hasFails(exit.cause)).toBe(true);
        expect(Cause.hasDies(exit.cause)).toBe(false);
      }
    })
  );
});
