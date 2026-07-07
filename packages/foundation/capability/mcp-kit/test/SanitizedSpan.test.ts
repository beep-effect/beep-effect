/**
 * Proof: with the sanitized-span wrapper, raw tool `parameters` do not
 * appear in span attributes, even though upstream `Toolkit.ts:263-265`
 * annotates the current span with them unconditionally.
 *
 * @since 0.0.0
 */
import { withSanitizedToolSpan } from "@beep/mcp-kit";
import { assert, describe, it, layer } from "@effect/vitest";
import { Effect } from "effect";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Tracer from "effect/Tracer";
import { Tool, Toolkit } from "effect/unstable/ai";

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

describe("withSanitizedToolSpan", () => {
  layer(FixtureHandlersLive)("with the fixture toolkit mounted", (it) => {
    it.effect("suppresses raw tool parameters from reaching span attributes", () =>
      Effect.gen(function* () {
        const { captured, tracer } = makeRecordingTracer();
        const toolkit = yield* FixtureToolkit;

        const dispatch = Effect.gen(function* () {
          const stream = yield* toolkit.handle("fixture_tool", { secret: "super-secret-value" });
          return yield* Stream.runLast(stream);
        });

        yield* dispatch.pipe(withSanitizedToolSpan("mcp.tool.call"), Effect.withTracer(tracer));

        const parameterAttribute = captured.find((entry) => entry.key === "parameters");
        assert.isUndefined(parameterAttribute);

        const toolAttribute = captured.find((entry) => entry.key === "tool");
        assert.strictEqual(toolAttribute?.value, "fixture_tool");
      })
    );
  });

  it.effect("passes non-redacted attributes through unchanged", () =>
    Effect.gen(function* () {
      const { captured, tracer } = makeRecordingTracer();

      yield* withSanitizedToolSpan(Effect.annotateCurrentSpan("outcome", "ok"), "mcp.tool.call").pipe(
        Effect.withTracer(tracer)
      );

      const outcomeAttribute = captured.find((entry) => entry.key === "outcome");
      assert.strictEqual(outcomeAttribute?.value, "ok");
    })
  );
});
