/**
 * Dispatch anchor semantics: absent by default, carried unchanged when host
 * composition provides it for a dispatch, never captured from the layer-build
 * context.
 *
 * @since 0.0.0
 */
import { CurrentMcpDispatchAnchor, McpCallerIdentity, McpDispatchAnchor } from "@beep/mcp-kit";
import { it } from "@beep/test-runner";
import { assert, describe } from "@effect/vitest";
import { assertNone, assertTrue } from "@effect/vitest/utils";
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
  it.effect("is absent by default", () =>
    Effect.gen(function* () {
      assertNone(yield* CurrentMcpDispatchAnchor);
    })
  );

  it.effect("brands a non-empty string and rejects an empty one", () =>
    Effect.gen(function* () {
      assert.strictEqual(yield* decodeAnchor("launch:abc"), "launch:abc");
      assertTrue(Exit.isFailure(yield* Effect.exit(decodeAnchor(""))));
    })
  );

  it.layer(fullLayer, { timeout: "5 seconds" })("through sanitized dispatch", (it) => {
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

  it.layer(
    Layer.mergeAll(McpServer.McpServer.layer, StubMcpClientLayer, FixtureRegistrationsLive).pipe(
      Layer.provide(Layer.succeed(CurrentMcpDispatchAnchor, O.some(McpDispatchAnchor.make("captured-at-build"))))
    ),
    { timeout: "5 seconds" }
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
    const identity = McpCallerIdentity.make({ clientId: S.Natural.make(3) });
    assertNone(identity.sessionId);
  });
});
