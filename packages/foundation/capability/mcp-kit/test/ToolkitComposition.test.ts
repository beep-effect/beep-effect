/**
 * Fixture proof: a `hard`-gated fixture toolkit vanishes from composition
 * when its env key is absent, and mounts when present.
 *
 * @since 0.0.0
 */
import { composeGatedLayers, gatedLayer, SourceAuthRegistration } from "@beep/mcp-kit";
import { it } from "@beep/test-runner";
import { assert, describe } from "@effect/vitest";
import { assertFailure, assertSuccess } from "@effect/vitest/utils";
import { ConfigProvider, Effect, Layer, Ref } from "effect";
import * as A from "effect/Array";
import { Tool, Toolkit } from "effect/ai";
import * as McpServer from "effect/ai/McpServer";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { StubMcpClientLayer } from "./fixtures/McpClient.ts";

const HardTool = Tool.make("hard_source_tool", {
  description: "Fixture hard-gated tool.",
  success: S.String,
});

const HardToolkit = Toolkit.make(HardTool);

const hardRegistration = SourceAuthRegistration.make({
  name: "Hard Fixture Source",
  envVar: "MCP_KIT_TEST_HARD_KEY",
  gate: "hard",
});

// `composeGatedLayers` decides mount-vs-vanish while its layer builds, so the
// fixture ConfigProvider must be an explicit upstream dependency (not a
// sibling merge) to be visible during that build.
const buildComposedFixture = (env: Record<string, string>) => {
  const acquisitions = Ref.makeUnsafe(0);
  const executions = Ref.makeUnsafe(0);
  const handlers = HardToolkit.toLayer({
    hard_source_tool: () => Ref.update(executions, (count) => count + 1).pipe(Effect.as("ok")),
  });
  const hardSourceLayer = Layer.unwrap(
    Ref.update(acquisitions, (count) => count + 1).pipe(
      Effect.as(McpServer.toolkit(HardToolkit).pipe(Layer.provide(handlers)))
    )
  );
  return {
    acquisitions,
    executions,
    layer: Layer.mergeAll(
      McpServer.McpServer.layer,
      StubMcpClientLayer,
      composeGatedLayers(gatedLayer(hardRegistration, hardSourceLayer)).pipe(
        Layer.provide(ConfigProvider.layer(ConfigProvider.fromUnknown(env)))
      )
    ),
  };
};

const callHardTool = Effect.gen(function* () {
  const server = yield* McpServer.McpServer;
  return yield* server.callTool({ arguments: {}, name: "hard_source_tool" }).pipe(Effect.result);
});

describe("composeGatedLayers (hard gate)", () => {
  const absent = buildComposedFixture({});
  const present = buildComposedFixture({ MCP_KIT_TEST_HARD_KEY: "fixture-secret" });

  it.layer(absent.layer, { timeout: "5 seconds" })("when the credential is absent", (it) => {
    it.effect(
      "vanishes the hard-gated source from composition",
      Effect.fnUntraced(function* () {
        const server = yield* McpServer.McpServer;
        assert.isFalse(A.some(server.tools, ({ tool }) => tool.name === "hard_source_tool"));
        const result = yield* callHardTool;
        assert.strictEqual(yield* Ref.get(absent.acquisitions), 0);
        assert.strictEqual(yield* Ref.get(absent.executions), 0);
        assertFailure(
          Result.mapError(result, (error) => ({ _tag: error._tag, message: error.message })),
          { _tag: "InvalidParams", message: "Tool 'hard_source_tool' not found" }
        );
      })
    );
  });

  it.layer(present.layer, { timeout: "5 seconds" })("when the credential is present", (it) => {
    it.effect(
      "mounts the hard-gated source",
      Effect.fnUntraced(function* () {
        const server = yield* McpServer.McpServer;
        assert.isTrue(A.some(server.tools, ({ tool }) => tool.name === "hard_source_tool"));
        assert.strictEqual(yield* Ref.get(present.acquisitions), 1);
        assert.strictEqual(yield* Ref.get(present.executions), 0);
        const result = yield* callHardTool;
        assert.strictEqual(yield* Ref.get(present.executions), 1);
        assertSuccess(
          Result.map(result, (value) => value.isError),
          false
        );
        if (result._tag === "Success") {
          assert.isFalse(result.success.isError);
        }
      })
    );
  });
});
