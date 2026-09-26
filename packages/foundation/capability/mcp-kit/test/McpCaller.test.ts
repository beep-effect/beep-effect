/**
 * Dispatch anchor semantics: absent by default, carried unchanged when host
 * composition provides it for a dispatch, never captured from the layer-build
 * context.
 *
 * @since 0.0.0
 */
import { CurrentMcpDispatchAnchor, McpCallerIdentity, McpDispatchAnchor } from "@beep/mcp-kit";
import { NonNegativeInt } from "@beep/schema";
import { assert, describe, it, layer } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import { Effect, Exit, Layer } from "effect";
import * as McpServer from "effect/ai/McpServer";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FixtureRegistrationsLive } from "./fixtures/FixtureHost.ts";
import { StubMcpClientLayer } from "./fixtures/McpClient.ts";

const anchorReport = (result: { readonly content: ReadonlyArray<unknown> }): string => {
  const [first] = result.content;
  return JSON.parse((first as { readonly text: string }).text) as string;
};

const decodeAnchor = S.decodeUnknownEffect(McpDispatchAnchor);

const fullLayer = Layer.mergeAll(McpServer.McpServer.layer, FixtureRegistrationsLive, StubMcpClientLayer);

describe("dispatch anchor", () => {
  it("is absent by default", () => {
    assert.isTrue(O.isNone(Effect.runSync(CurrentMcpDispatchAnchor)));
  });

  it.effect("brands a non-empty string and rejects an empty one", () =>
    Effect.gen(function* () {
      assert.strictEqual(yield* decodeAnchor("launch:abc"), "launch:abc");
      assertTrue(Exit.isFailure(yield* Effect.exit(decodeAnchor(""))));
    })
  );

  layer(fullLayer)("through sanitized dispatch", (it) => {
    it.effect("dispatch anchor is absent unless provided", () =>
      Effect.gen(function* () {
        const server = yield* McpServer.McpServer;
        const result = yield* server.callTool({ name: "anchor_report", arguments: {} });
        assert.strictEqual(anchorReport(result), "anchor=none");
      })
    );

    it.effect("carries an anchor provided for the dispatch", () =>
      Effect.gen(function* () {
        const server = yield* McpServer.McpServer;
        const result = yield* server
          .callTool({ name: "anchor_report", arguments: {} })
          .pipe(Effect.provideService(CurrentMcpDispatchAnchor, O.some(McpDispatchAnchor.make("anchor-under-test"))));
        assert.strictEqual(anchorReport(result), "anchor-under-test");
      })
    );
  });

  layer(
    Layer.mergeAll(McpServer.McpServer.layer, StubMcpClientLayer, FixtureRegistrationsLive).pipe(
      Layer.provide(Layer.succeed(CurrentMcpDispatchAnchor, O.some(McpDispatchAnchor.make("captured-at-build"))))
    )
  )("with an anchor in the layer-build context", (it) => {
    it.effect("does not leak a build-time anchor into a dispatch", () =>
      Effect.gen(function* () {
        const server = yield* McpServer.McpServer;
        const result = yield* server.callTool({ name: "anchor_report", arguments: {} });
        assert.strictEqual(anchorReport(result), "anchor=none");
      })
    );
  });
});

describe("McpCallerIdentity", () => {
  it("defaults sessionId to None", () => {
    const identity = McpCallerIdentity.make({ clientId: NonNegativeInt.make(3) });
    assert.isTrue(O.isNone(identity.sessionId));
  });
});
