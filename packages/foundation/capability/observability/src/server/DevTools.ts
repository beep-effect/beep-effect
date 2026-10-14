/**
 * Server-side Effect devtools span publishing layers and filters.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ObservabilityId } from "@beep/identity/packages";
import { Fn } from "@beep/schema";
import * as DevToolsClient from "effect/devtools/DevToolsClient";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Socket from "effect/socket/Socket";
import * as Tracer from "effect/Tracer";
import type * as DevToolsSchema from "effect/devtools/DevToolsSchema";

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
  Match.tag("Started", ({ startTime }) => ({ _tag: "Started", startTime })),
  Match.tag("Ended", ({ startTime, endTime, exit }) => ({ _tag: "Ended", startTime, endTime, exit })),
  Match.exhaustive
);

const toDevToolsParentSpan = (parent: O.Option<Tracer.AnySpan>): O.Option<DevToolsSchema.ParentSpan> =>
  O.match(parent, {
    onNone: O.none,
    onSome: (value) =>
      O.some(
        Match.value(value).pipe(
          Match.withReturnType<DevToolsSchema.ParentSpan>(),
          Match.tag("ExternalSpan", ({ spanId, traceId, sampled }) => ({
            _tag: "ExternalSpan",
            spanId,
            traceId,
            sampled,
          })),
          Match.tag("Span", ({ spanId, traceId, name, sampled, attributes, status, parent }) => ({
            _tag: "Span",
            spanId,
            traceId,
            name,
            sampled,
            attributes: new Map(attributes),
            status: toDevToolsSpanStatus(status),
            parent: toDevToolsParentSpan(parent),
          })),
          Match.exhaustive
        )
      ),
  });

const toDevToolsSpan = (span: Tracer.Span): DevToolsSchema.Span => ({
  _tag: "Span",
  spanId: span.spanId,
  traceId: span.traceId,
  name: span.name,
  sampled: span.sampled,
  attributes: new Map(span.attributes),
  status: toDevToolsSpanStatus(span.status),
  parent: toDevToolsParentSpan(span.parent),
});

const makeFilteredDevToolsTracer = Effect.fnUntraced(function* (shouldPublish: DevToolsSpanFilter) {
  const client = yield* DevToolsClient.DevToolsClient;
  const currentTracer = yield* Effect.tracer;

  return Tracer.make({
    span(spanOptions) {
      const span = currentTracer.span(spanOptions);

      if (!shouldPublish(span.name)) {
        return span;
      }

      client.sendUnsafe(toDevToolsSpan(span));

      const originalEvent = span.event;
      span.event = function (this: Tracer.Span, name, startTime, attributes) {
        client.sendUnsafe({
          _tag: "SpanEvent",
          traceId: span.traceId,
          spanId: span.spanId,
          name,
          startTime,
          attributes,
        });
        return originalEvent.call(this, name, startTime, attributes);
      };

      const originalEnd = span.end;
      span.end = function (this: Tracer.Span, endTime, exit) {
        originalEnd.call(this, endTime, exit);
        client.sendUnsafe(toDevToolsSpan(span));
      };

      return span;
    },
    context: currentTracer.context,
  });
});

/**
 * Install a tracer that mirrors selected spans to an existing `DevToolsClient`.
 *
 * **Details**
 *
 * The tracer wraps whichever tracer is current when the layer is built, so
 * provide the exporting tracer (for example OTLP) underneath this layer. For
 * every span accepted by `shouldPublish` it sends the start snapshot, each
 * span event, and the final snapshot when the span ends; rejected spans send
 * nothing. Attribute maps are copied so later mutation does not leak into a
 * snapshot already queued for the client.
 *
 * **Example** (Mirror HTTP spans to a provided client)
 *
 * ```typescript
 * import { layerFilteredDevToolsTracer } from "@beep/observability/server"
 * import { Str } from "@beep/utils"
 * import * as DevToolsClient from "effect/devtools/DevToolsClient"
 * import * as Layer from "effect/Layer"
 *
 * const TracerLive = layerFilteredDevToolsTracer((name: string) => Str.startsWith(name, "Http.")).pipe(
 *   Layer.provide(Layer.succeed(DevToolsClient.DevToolsClient, DevToolsClient.DevToolsClient.of({ sendUnsafe: () => {} })))
 * )
 * console.log(TracerLive)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const layerFilteredDevToolsTracer = (
  shouldPublish: DevToolsSpanFilter
): Layer.Layer<never, never, DevToolsClient.DevToolsClient> =>
  Layer.effect(Tracer.Tracer, makeFilteredDevToolsTracer(shouldPublish));

/**
 * Mirror only selected spans to the Effect devtools websocket.
 *
 * **Details**
 *
 * Publishes span starts, span events, and span ends for spans accepted by
 * `shouldPublish`, matching upstream `DevToolsClient.layerTracer` for those
 * spans. Provide the exporting tracer underneath this layer so devtools wraps it
 * instead of replacing it.
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

  return layerFilteredDevToolsTracer(options.shouldPublish).pipe(Layer.provide(socketClientLayer));
};
