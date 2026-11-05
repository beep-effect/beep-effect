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
import * as A from "effect/Array";
import * as McpSchema from "effect/ai/McpSchema";
import * as McpServer from "effect/ai/McpServer";
import * as Tool from "effect/ai/Tool";
import * as Toolkit from "effect/ai/Toolkit";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Ref from "effect/Ref";
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
    layer: composeGatedLayers(gatedLayer(hardRegistration, hardSourceLayer)).pipe(
      Layer.provide(ConfigProvider.layer(ConfigProvider.fromUnknown(env))),
      Layer.provideMerge(Layer.mergeAll(McpServer.McpServer.layer, StubMcpClientLayer))
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
        const got = yield* Ref.get(absent.acquisitions);
        assert.strictEqual(got, 0);
        const got1 = yield* Ref.get(absent.executions);
        assert.strictEqual(got1, 0);
        assertFailure(
          Result.mapError(result, (error) => ({ code: error.code, message: error.message })),
          { code: McpSchema.INVALID_PARAMS_ERROR_CODE, message: "Tool 'hard_source_tool' not found" }
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
        const got2 = yield* Ref.get(present.acquisitions);
        assert.strictEqual(got2, 1);
        const got3 = yield* Ref.get(present.executions);
        assert.strictEqual(got3, 0);
        const result = yield* callHardTool;
        const got4 = yield* Ref.get(present.executions);
        assert.strictEqual(got4, 1);
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
