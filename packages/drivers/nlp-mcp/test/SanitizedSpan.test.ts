/**
 * Proof: `NlpToolkit`'s dispatch, mounted via `sanitizedToolkit` (the
 * `mcp-host-retrofit` fix for the `Toolkit.ts:263-265` raw-`parameters` span
 * leak, `standards/architecture/12-observability.md` §3), does not leak a
 * tool call's raw request payload onto span attributes, while the call still
 * dispatches through the real `NlpToolkit`/`WinkNlpToolkitLive` production
 * code.
 *
 * @since 0.0.0
 */
import { sanitizedToolkit } from "@beep/mcp-kit";
import { NlpToolkit } from "@beep/nlp-processing/Tools/NlpToolkit";
import { WinkNlpToolkitLive } from "@beep/wink";
import { assert, describe, layer } from "@effect/vitest";
import { Effect, Layer } from "effect";
import * as Tracer from "effect/Tracer";
import * as McpServer from "effect/unstable/ai/McpServer";

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

const registrationLayer = sanitizedToolkit(NlpToolkit).pipe(Layer.provide(WinkNlpToolkitLive));
const fullLayer = Layer.mergeAll(McpServer.McpServer.layer, registrationLayer);

describe("nlp-mcp sanitized dispatch", () => {
  layer(fullLayer)("with NlpToolkit mounted via sanitizedToolkit", (it) => {
    it.effect("does not leak the raw Tokenize request text onto span attributes", () =>
      Effect.gen(function* () {
        const { captured, tracer } = makeRecordingTracer();
        const server = yield* McpServer.McpServer;

        const result = yield* Effect.withTracer(
          server.callTool({ name: "Tokenize", arguments: { text: "super-secret-document-text" } }),
          tracer
        );

        assert.isFalse(result.isError);

        const parameterAttribute = captured.find((entry) => entry.key === "parameters");
        assert.isUndefined(parameterAttribute);

        const toolAttribute = captured.find((entry) => entry.key === "tool");
        assert.strictEqual(toolAttribute?.value, "Tokenize");
      })
    );
  });
});
