/**
 * Proof: `sanitizedToolkit` suppresses raw tool `parameters` from reaching
 * span attributes end-to-end through the real `McpServer.callTool` dispatch
 * surface — not just the low-level `withSanitizedToolSpan` primitive tested
 * in `SanitizedSpan.test.ts` — including when dispatch happens later, outside
 * the effect that registered the toolkit (mirrors how a real stdio transport
 * loop invokes `callTool` from its own, separately-scoped request handling).
 *
 * @since 0.0.0
 */
import { sanitizedToolkit } from "@beep/mcp-kit";
import { assert, describe, layer } from "@effect/vitest";
import { Effect, Layer } from "effect";
import * as S from "effect/Schema";
import * as Tracer from "effect/Tracer";
import { Tool, Toolkit } from "effect/unstable/ai";
import * as McpServer from "effect/unstable/ai/McpServer";

const FixtureTool = Tool.make("fixture_tool", {
  parameters: S.Struct({ secret: S.String }),
  success: S.String,
});

const FixtureToolkit = Toolkit.make(FixtureTool);

const FixtureHandlersLive = FixtureToolkit.toLayer({
  fixture_tool: (params: { readonly secret: string }) => Effect.succeed(`ok:${params.secret}`),
});

interface RecordedAttribute {
  readonly key: string;
  readonly value: unknown;
}

const makeRecordingTracer = (): { readonly tracer: Tracer.Tracer; readonly captured: Array<RecordedAttribute> } => {
  const captured: Array<RecordedAttribute> = [];
  const tracer = Tracer.make({
    span: (options) => {
      const span = new Tracer.NativeSpan(options);
      const original = span.attribute.bind(span);
      span.attribute = (key: string, value: unknown) => {
        captured.push({ key, value });
        original(key, value);
      };
      return span;
    },
  });
  return { captured, tracer };
};

const registrationLayer = sanitizedToolkit(FixtureToolkit).pipe(Layer.provide(FixtureHandlersLive));
const fullLayer = Layer.mergeAll(McpServer.McpServer.layer, registrationLayer);

describe("sanitizedToolkit", () => {
  layer(fullLayer)("with the fixture toolkit registered via sanitizedToolkit", (it) => {
    it.effect("suppresses raw tool parameters from reaching span attributes on real McpServer dispatch", () =>
      Effect.gen(function* () {
        const { captured, tracer } = makeRecordingTracer();
        const server = yield* McpServer.McpServer;

        // No explicit span wrap at this call site -- proves sanitization is
        // baked into the registered handler itself, not dependent on ambient
        // tracer state at layer-build time (the layer above is memoized and
        // built once, shared across both tests in this suite).
        const result = yield* Effect.withTracer(
          server.callTool({ name: "fixture_tool", arguments: { secret: "super-secret-value" } }),
          tracer
        );

        assert.isFalse(result.isError);

        const parameterAttribute = captured.find((entry) => entry.key === "parameters");
        assert.isUndefined(parameterAttribute);

        const toolAttribute = captured.find((entry) => entry.key === "tool");
        assert.strictEqual(toolAttribute?.value, "fixture_tool");
      })
    );

    it.effect("still dispatches successfully and preserves the tool's real result", () =>
      Effect.gen(function* () {
        const server = yield* McpServer.McpServer;
        const result = yield* server.callTool({ name: "fixture_tool", arguments: { secret: "value" } });

        assert.isFalse(result.isError);
        const [first] = result.content;
        assert.strictEqual(first?.type, "text");
        assert.strictEqual((first as { readonly text: string }).text, '"ok:value"');
      })
    );
  });
});
