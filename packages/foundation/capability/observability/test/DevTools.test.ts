import {
  DevToolsSpanFilter,
  LayerFilteredDevToolsOptions,
  layerFilteredDevToolsTracer,
} from "@beep/observability/server";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertFalse, assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as DevToolsClient from "effect/devtools/DevToolsClient";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import type * as DevToolsSchema from "effect/devtools/DevToolsSchema";

const decodeDevToolsSpanFilterOption = S.decodeOption(DevToolsSpanFilter);
const decodeLayerFilteredDevToolsOptionsOption = S.decodeOption(LayerFilteredDevToolsOptions);

type DevToolsMessage = DevToolsSchema.Span | DevToolsSchema.SpanEvent;

const makeRecordingClient = () => {
  const messages: Array<DevToolsMessage> = [];
  const layer = Layer.succeed(
    DevToolsClient.DevToolsClient,
    DevToolsClient.DevToolsClient.of({
      sendUnsafe: (message) => {
        messages.push(message);
      },
    })
  );
  return { messages, layer };
};

const describeMessage = (message: DevToolsMessage) =>
  message._tag === "SpanEvent"
    ? { tag: message._tag, name: message.name, attributes: undefined, status: undefined }
    : {
        tag: message._tag,
        name: message.name,
        attributes: Object.fromEntries(message.attributes),
        status: message.status._tag,
      };

describe("DevTools", () => {
  it("models span filters and layer options as executable schemas", () => {
    const shouldPublish = DevToolsSpanFilter.implementSync((name) => name === "Http.server");
    const options = {
      shouldPublish,
      url: "ws://localhost:34437",
    };

    assertTrue(shouldPublish("Http.server"));
    assertFalse(shouldPublish("Sql.query"));
    pipe(decodeDevToolsSpanFilterOption(shouldPublish), O.isSome, assertTrue);
    pipe(decodeLayerFilteredDevToolsOptionsOption(options), O.isSome, assertTrue);
  });

  it.effect(
    "publishes start, event and end snapshots only for accepted spans",
    Effect.fnUntraced(function* () {
      const client = makeRecordingClient();
      const traced = Effect.gen(function* () {
        const span = yield* Effect.currentSpan;
        span.event("checkpoint", 1n, { step: 1 });
        yield* Effect.annotateCurrentSpan("late", true);
      });

      const tracerLayer = layerFilteredDevToolsTracer((name) => name === "published").pipe(Layer.provide(client.layer));
      yield* Layer.build(tracerLayer).pipe(
        Effect.flatMap((context) =>
          Effect.provideContext(
            Effect.all([
              traced.pipe(Effect.withSpan("published", { attributes: { early: true } })),
              traced.pipe(Effect.withSpan("filtered")),
            ]),
            context
          )
        ),
        Effect.scoped
      );

      // `withSpan` attributes land after creation; the start snapshot keeps its own copy.
      expect(A.map(client.messages, describeMessage)).toStrictEqual([
        { tag: "Span", name: "published", attributes: {}, status: "Started" },
        { tag: "SpanEvent", name: "checkpoint", attributes: undefined, status: undefined },
        { tag: "Span", name: "published", attributes: { early: true, late: true }, status: "Ended" },
      ]);
    })
  );
});
