import { VERSION } from "@beep/ontology-config";
import { OntologyConfigLive, OntologyMcpConfigLive } from "@beep/ontology-config/layer";
import {
  OntologyConfig,
  OntologyMcpConfig,
  OntologyMcpServerConfig,
  OntologyServerConfig,
} from "@beep/ontology-config/server";
import { makeOntologyConfigTest, makeOntologyMcpConfigTest } from "@beep/ontology-config/test";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertFalse, assertTrue } from "@effect/vitest/utils";
import { Cause, ConfigProvider, Effect, Exit, Layer } from "effect";

const configLayer = (configuration: Readonly<Record<string, string>>) =>
  OntologyConfigLive.pipe(Layer.provide(ConfigProvider.layer(ConfigProvider.fromUnknown(configuration))));

describe("OntologyConfigLive", () => {
  it("exposes static test layers and the package version", () => {
    expect(VERSION).toBe("0.0.0");
    expect(Layer.isLayer(makeOntologyConfigTest(OntologyServerConfig.make({ workspaceRoot: "/srv/ontology" })))).toBe(
      true
    );
    expect(Layer.isLayer(makeOntologyMcpConfigTest(OntologyMcpServerConfig.make({ mutationsEnabled: true })))).toBe(
      true
    );
  });

  it.layer(configLayer({ ONTOLOGY_WORKSPACE_ROOT: "/srv/ontology" }), { timeout: "5 seconds" })((it) => {
    it.effect(
      "resolves the required ontology workspace root",
      Effect.fnUntraced(function* () {
        const config = yield* OntologyConfig;

        expect(config.workspaceRoot).toBe("/srv/ontology");
      })
    );
  });

  it.effect(
    "keeps missing and empty configuration in the typed failure channel",
    Effect.fnUntraced(function* () {
      for (const configuration of [{}, { ONTOLOGY_WORKSPACE_ROOT: "" }]) {
        const exit = yield* Effect.exit(Layer.build(configLayer(configuration)));

        assertTrue(Exit.isFailure(exit));
        assertTrue(Cause.hasFails(exit.cause));
        assertFalse(Cause.hasDies(exit.cause));
      }
    })
  );
});

const mcpConfigLayer = (configuration: Readonly<Record<string, string>>) =>
  OntologyMcpConfigLive.pipe(Layer.provide(ConfigProvider.layer(ConfigProvider.fromUnknown(configuration))));

describe("OntologyMcpConfigLive", () => {
  it.layer(mcpConfigLayer({}), { timeout: "5 seconds" })((it) => {
    it.effect(
      "leaves mutation registration off when unset",
      Effect.fnUntraced(function* () {
        const config = yield* OntologyMcpConfig;

        expect(config.mutationsEnabled).toBe(false);
      })
    );
  });

  it.layer(mcpConfigLayer({ ONTOLOGY_MCP_MUTATIONS_ENABLED: "true" }), { timeout: "5 seconds" })((it) => {
    it.effect(
      "enables mutation registration when explicitly set",
      Effect.fnUntraced(function* () {
        const config = yield* OntologyMcpConfig;

        expect(config.mutationsEnabled).toBe(true);
      })
    );
  });

  it.effect(
    "keeps a malformed flag in the typed failure channel rather than defaulting to off",
    Effect.fnUntraced(function* () {
      // Silently reading a typo as `false` would be safe but dishonest: the
      // operator asked for something and got no signal that it was ignored.
      const exit = yield* Effect.exit(Layer.build(mcpConfigLayer({ ONTOLOGY_MCP_MUTATIONS_ENABLED: "maybe" })));

      assertTrue(Exit.isFailure(exit));
      assertTrue(Cause.hasFails(exit.cause));
      assertFalse(Cause.hasDies(exit.cause));
    })
  );
});
