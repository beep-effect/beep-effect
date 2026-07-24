/**
 * Fixture proof: a `hard`-gated fixture toolkit vanishes from composition
 * when its env key is absent, and mounts when present.
 *
 * @since 0.0.0
 */
import { composeGatedLayers, gatedLayer, SourceAuthRegistration } from "@beep/mcp-kit";
import { assert, describe, layer } from "@effect/vitest";
import { ConfigProvider, Effect, Layer } from "effect";
import * as S from "effect/Schema";
import { Tool, Toolkit } from "effect/unstable/ai";
import * as McpServer from "effect/unstable/ai/McpServer";

const HardTool = Tool.make("hard_source_tool", {
  description: "Fixture hard-gated tool.",
  success: S.String,
});

const HardToolkit = Toolkit.make(HardTool);

const HardToolkitHandlersLive = HardToolkit.toLayer({
  hard_source_tool: () => Effect.succeed("ok"),
});

const hardSourceLayer = McpServer.toolkit(HardToolkit).pipe(Layer.provide(HardToolkitHandlersLive));

const hardRegistration = SourceAuthRegistration.make({
  name: "Hard Fixture Source",
  envVar: "MCP_KIT_TEST_HARD_KEY",
  gate: "hard",
});

// `composeGatedLayers` decides mount-vs-vanish while its layer builds, so the
// fixture ConfigProvider must be an explicit upstream dependency (not a
// sibling merge) to be visible during that build.
const buildComposedLayer = (env: Record<string, string>) =>
  Layer.mergeAll(
    McpServer.McpServer.layer,
    composeGatedLayers(gatedLayer(hardRegistration, hardSourceLayer)).pipe(
      Layer.provide(ConfigProvider.layer(ConfigProvider.fromUnknown(env)))
    )
  );

const callHardTool = Effect.gen(function* () {
  const server = yield* McpServer.McpServer;
  return yield* server.callTool({ arguments: {}, name: "hard_source_tool" }).pipe(Effect.result);
});

describe("composeGatedLayers (hard gate)", () => {
  layer(buildComposedLayer({}))("when the credential is absent", (it) => {
    it.effect(
      "vanishes the hard-gated source from composition",
      Effect.fnUntraced(function* () {
        const result = yield* callHardTool;
        assert.strictEqual(result._tag, "Failure");
      })
    );
  });

  layer(buildComposedLayer({ MCP_KIT_TEST_HARD_KEY: "fixture-secret" }))("when the credential is present", (it) => {
    it.effect(
      "mounts the hard-gated source",
      Effect.fnUntraced(function* () {
        const result = yield* callHardTool;
        assert.strictEqual(result._tag, "Success");
        if (result._tag === "Success") {
          assert.isFalse(result.success.isError);
        }
      })
    );
  });
});
