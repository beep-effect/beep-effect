/**
 * Server-side Effect devtools span publishing layers and filters.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ObservabilityId } from "@beep/identity/packages";
import { Fn } from "@beep/schema";
import { Effect, Layer, Match, Tracer } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as DevToolsClient from "effect/unstable/devtools/DevToolsClient";
import * as Socket from "effect/unstable/socket/Socket";
import type * as DevToolsSchema from "effect/unstable/devtools/DevToolsSchema";

const $I = $ObservabilityId.create("server/DevTools");

/**
 * Predicate used to decide whether a span should be mirrored to Effect devtools.
 *
 * **Example** (HTTP prefix span filter)
 *
 * ```typescript
 * import { Str } from "@beep/utils"
 * import type { DevToolsSpanFilter } from "@beep/observability/server"
 *
 * const filter: DevToolsSpanFilter = (name) => Str.startsWith(name, "Http.")
 * console.log(filter("Http.server"))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const DevToolsSpanFilter = Fn({
  input: S.String,
  output: S.Boolean,
}).pipe(
  $I.annoteSchema("DevToolsSpanFilter", {
    description: "Predicate used to decide whether a span should be mirrored to Effect devtools.",
  })
);

/**
 * Runtime type for {@link DevToolsSpanFilter}.
 *
 * **Example** (Typed HTTP span filter)
 *
 * ```typescript
 * import { Str } from "@beep/utils"
 * import type { DevToolsSpanFilter } from "@beep/observability/server"
 *
 * const filter: DevToolsSpanFilter = (name) => Str.startsWith(name, "Http.")
 * console.log(filter("Http.server"))
 * // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type DevToolsSpanFilter = typeof DevToolsSpanFilter.Type;

/**
 * Options for mirroring selected spans to the Effect devtools websocket.
 *
 * **Example** (Make filtered options)
 *
 * ```typescript
 * import { LayerFilteredDevToolsOptions } from "@beep/observability/server"
 *
 * const options = LayerFilteredDevToolsOptions.make({
 *   url: "ws://localhost:34437",
 *   shouldPublish: (name: string) => name.startsWith("Http.")
 * })
 * console.log(options.url)
 * // "ws://localhost:34437"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LayerFilteredDevToolsOptions extends S.Class<LayerFilteredDevToolsOptions>(
  $I`LayerFilteredDevToolsOptions`
)(
  {
    url: S.String.annotateKey({
      description: "Devtools websocket URL.",
    }),
    shouldPublish: DevToolsSpanFilter.annotateKey({
      description: "Predicate deciding whether a span should be mirrored.",
    }),
  },
  $I.annote("LayerFilteredDevToolsOptions", {
    description: "Options for mirroring selected spans to the Effect devtools websocket.",
  })
) {}

const toDevToolsSpanStatus = Match.type<Tracer.SpanStatus>().pipe(
  Match.withReturnType<DevToolsSchema.SpanStatus>(),
  Match.tagsExhaustive({
    Started: ({ startTime }) => ({ _tag: "Started", startTime }),
    Ended: ({ startTime, endTime, exit }) => ({ _tag: "Ended", startTime, endTime, exit }),
  })
);

const toDevToolsParentSpan = (parent: O.Option<Tracer.AnySpan>): O.Option<DevToolsSchema.ParentSpan> =>
  O.match(parent, {
    onNone: O.none,
    onSome: (value) =>
      O.some(
        Match.value(value).pipe(
          Match.withReturnType<DevToolsSchema.ParentSpan>(),
          Match.tagsExhaustive({
            ExternalSpan: ({ spanId, traceId, sampled }) => ({ _tag: "ExternalSpan", spanId, traceId, sampled }),
            Span: ({ spanId, traceId, name, sampled, attributes, status, parent }) => ({
              _tag: "Span",
              spanId,
              traceId,
              name,
              sampled,
              attributes,
              status: toDevToolsSpanStatus(status),
              parent: toDevToolsParentSpan(parent),
            }),
          })
        )
      ),
  });

const toDevToolsSpan = (span: Tracer.Span): DevToolsSchema.Span => ({
  _tag: "Span",
  spanId: span.spanId,
  traceId: span.traceId,
  name: span.name,
  sampled: span.sampled,
  attributes: span.attributes,
  status: toDevToolsSpanStatus(span.status),
  parent: toDevToolsParentSpan(span.parent),
});

/**
 * Mirror only selected spans to the Effect devtools websocket.
 *
 * **Example** (Layer publishing all spans)
 *
 * ```typescript
 * import { layerFilteredDevTools } from "@beep/observability/server"
 *
 * const DevToolsLive = layerFilteredDevTools({
 *   shouldPublish: () => true,
 *   url: "ws://localhost:34437"
 * })
 * console.log(DevToolsLive)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const layerFilteredDevTools = (options: LayerFilteredDevToolsOptions): Layer.Layer<never> => {
  const socketClientLayer = DevToolsClient.layer.pipe(
    Layer.provide(Socket.layerWebSocket(options.url)),
    Layer.provide(Socket.layerWebSocketConstructorGlobal)
  );

  return Layer.effect(
    Tracer.Tracer,
    Effect.gen(function* () {
      const client = yield* DevToolsClient.DevToolsClient;
      const currentTracer = yield* Effect.tracer;

      return Tracer.make({
        span(spanOptions) {
          const span = currentTracer.span(spanOptions);

          if (!options.shouldPublish(span.name)) {
            return span;
          }

          client.sendUnsafe(toDevToolsSpan(span));

          return span;
        },
        context: currentTracer.context,
      });
    })
  ).pipe(Layer.provide(socketClientLayer));
};
