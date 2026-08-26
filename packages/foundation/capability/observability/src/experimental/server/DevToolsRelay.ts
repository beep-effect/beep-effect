/**
 * Experimental Effect devtools relay helpers for server-side diagnostics.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ObservabilityId } from "@beep/identity/packages";
import { NonNegativeInt } from "@beep/schema";
import { A, thunk0 } from "@beep/utils";
import { Clock, Context, Effect, HashMap, Layer, Match, MutableRef, Queue } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as DevToolsServer from "effect/unstable/devtools/DevToolsServer";
import * as SocketServer from "effect/unstable/socket/SocketServer";
import { decodeNonNegativeInt } from "../../internal/decode.ts";
import type * as DevToolsSchema from "effect/unstable/devtools/DevToolsSchema";

const $I = $ObservabilityId.create("experimental/server/DevToolsRelay");
const maxSpanEvents = 200;

/**
 * Summary of the in-memory relay state.
 *
 * **Example** (Make zero-count snapshot)
 *
 * ```ts import.meta.vitest name="Make zero-count snapshot"
 * import { NonNegativeInt } from "@beep/schema"
 * import * as S from "effect/Schema"
 * import { DevToolsSnapshot } from "@beep/observability/experimental/server"
 *
 * const count = S.decodeUnknownSync(NonNegativeInt)(0)
 * const snapshot = DevToolsSnapshot.make({
 *   lastUpdatedAtMs: count,
 *   metricCount: count,
 *   spanCount: count,
 *   spanEventCount: count
 * })
 * snapshot.spanCount // => 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DevToolsSnapshot extends S.Class<DevToolsSnapshot>($I`DevToolsSnapshot`)(
  {
    spanCount: NonNegativeInt,
    spanEventCount: NonNegativeInt,
    metricCount: NonNegativeInt,
    lastUpdatedAtMs: NonNegativeInt,
  },
  $I.annote("DevToolsSnapshot", {
    description: "Summary of the in-memory relay state.",
  })
) {}

/**
 * Service for ingesting and snapshotting devtools traffic.
 *
 * **Example** (Yield relay snapshot)
 *
 * ```typescript
 * import { Effect } from "effect"
 * import { DevToolsRelayService } from "@beep/observability/experimental/server"
 *
 * const program = Effect.gen(function* () {
 *   const relay = yield* DevToolsRelayService
 *   return yield* relay.snapshot
 * })
 *
 * console.log(program)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class DevToolsRelayService extends Context.Service<
  DevToolsRelayService,
  {
    readonly ingest: (request: DevToolsSchema.Request.WithoutPing) => Effect.Effect<void>;
    readonly snapshot: Effect.Effect<DevToolsSnapshot>;
    readonly latestSpans: Effect.Effect<ReadonlyArray<DevToolsSchema.Span>>;
    readonly latestMetrics: Effect.Effect<O.Option<DevToolsSchema.MetricsSnapshot>>;
    readonly clear: Effect.Effect<void>;
    readonly address: Effect.Effect<SocketServer.Address>;
  }
>()("@beep/observability/experimental/server/DevToolsRelay/DevToolsRelayService") {}

type RelayState = {
  readonly spans: HashMap.HashMap<string, DevToolsSchema.Span>;
  readonly spanEvents: ReadonlyArray<DevToolsSchema.SpanEvent>;
  readonly metrics: O.Option<DevToolsSchema.MetricsSnapshot>;
  readonly lastUpdatedAtMs: number;
};

const emptyRelayState = (lastUpdatedAtMs: number): RelayState => ({
  spans: HashMap.empty(),
  spanEvents: A.empty(),
  metrics: O.none(),
  lastUpdatedAtMs,
});

const toSpanKey = (span: Pick<DevToolsSchema.Span, "traceId" | "spanId">): string => `${span.traceId}:${span.spanId}`;

/**
 * Create the in-memory relay service without starting a socket server.
 *
 * **Example** (Layer effect constructor)
 *
 * ```typescript
 * import { Layer } from "effect"
 * import { DevToolsRelayService, makeDevToolsRelayService } from "@beep/observability/experimental/server"
 * import * as SocketServer from "effect/unstable/socket/SocketServer"
 *
 * const RelayLive: Layer.Layer<DevToolsRelayService, never, SocketServer.SocketServer> =
 *   Layer.effect(DevToolsRelayService, makeDevToolsRelayService)
 * console.log(RelayLive)
 * ```
 *
 * @effects Requires `SocketServer.SocketServer`, reads the clock, and returns an in-memory relay service.
 * @category constructors
 * @since 0.0.0
 */
export const makeDevToolsRelayService: Effect.Effect<
  DevToolsRelayService["Service"],
  never,
  SocketServer.SocketServer
> = Effect.gen(function* () {
  const server = yield* SocketServer.SocketServer;
  const initialUpdatedAtMs = yield* Clock.currentTimeMillis;
  const state = MutableRef.make<RelayState>(emptyRelayState(initialUpdatedAtMs));

  const ingest = Effect.fn("DevToolsRelayService.ingest")((request: DevToolsSchema.Request.WithoutPing) =>
    Clock.currentTimeMillis.pipe(
      Effect.flatMap(
        Effect.fnUntraced(function* (lastUpdatedAtMs) {
          return yield* Effect.sync(() => {
            const current = MutableRef.get(state);
            const next: RelayState = Match.value(request).pipe(
              Match.tags({
                Span: (span) => ({
                  ...current,
                  spans: HashMap.set(current.spans, toSpanKey(span), span),
                  lastUpdatedAtMs,
                }),
                SpanEvent: (spanEvent) => ({
                  ...current,
                  spanEvents: pipeAppendLimited(current.spanEvents, spanEvent),
                  lastUpdatedAtMs,
                }),
              }),
              Match.orElse((metrics) => ({
                ...current,
                metrics: O.some(metrics),
                lastUpdatedAtMs,
              }))
            );

            MutableRef.set(state, next);
          });
        })
      )
    )
  );
  const snapshot = Effect.fn("DevToolsRelayService.snapshot")(() =>
    Effect.sync(() => {
      const current = MutableRef.get(state);
      const metricCount = O.match(current.metrics, {
        onNone: thunk0,
        onSome: (snapshot) => snapshot.metrics.length,
      });

      return DevToolsSnapshot.make({
        spanCount: decodeNonNegativeInt(HashMap.size(current.spans)),
        spanEventCount: decodeNonNegativeInt(current.spanEvents.length),
        metricCount: decodeNonNegativeInt(metricCount),
        lastUpdatedAtMs: decodeNonNegativeInt(current.lastUpdatedAtMs),
      });
    })
  );
  const latestSpans = Effect.fn("DevToolsRelayService.latestSpans")(() =>
    Effect.sync(() => A.fromIterable(HashMap.values(MutableRef.get(state).spans)))
  );
  const latestMetrics = Effect.fn("DevToolsRelayService.latestMetrics")(() =>
    Effect.sync(() => MutableRef.get(state).metrics)
  );
  const clear = Effect.fn("DevToolsRelayService.clear")(() =>
    Clock.currentTimeMillis.pipe(
      Effect.flatMap(
        Effect.fnUntraced(function* (lastUpdatedAtMs) {
          return yield* Effect.sync(() => void MutableRef.set(state, emptyRelayState(lastUpdatedAtMs)));
        })
      )
    )
  );
  const address = Effect.fn("DevToolsRelayService.address")(() => Effect.sync(() => server.address));

  return DevToolsRelayService.of({
    ingest,
    snapshot: snapshot(),
    latestSpans: latestSpans(),
    latestMetrics: latestMetrics(),
    clear: clear(),
    address: address(),
  });
});

const pipeAppendLimited = <A>(values: ReadonlyArray<A>, value: A): ReadonlyArray<A> => {
  const appended = A.append(values, value);
  return appended.length <= maxSpanEvents ? appended : A.takeRight(appended, maxSpanEvents);
};

/**
 * Start a websocket relay using `DevToolsServer.run`.
 *
 * **Example** (Provide relay server layer)
 *
 * ```typescript
 * import { Effect } from "effect"
 * import { DevToolsRelayService, layerDevToolsRelayServer } from "@beep/observability/experimental/server"
 *
 * const snapshot = Effect.gen(function* () {
 *   const relay = yield* DevToolsRelayService
 *   return yield* relay.snapshot
 * }).pipe(Effect.provide(layerDevToolsRelayServer))
 *
 * console.log(snapshot)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const layerDevToolsRelayServer: Layer.Layer<
  DevToolsRelayService,
  SocketServer.SocketServerError,
  SocketServer.SocketServer
> = Layer.effect(DevToolsRelayService, makeDevToolsRelayService).pipe(
  Layer.tap((services) => {
    const relay = Context.get(services, DevToolsRelayService);

    return DevToolsServer.run(
      Effect.fnUntraced(function* (client) {
        yield* client.send({ _tag: "MetricsRequest" });

        while (true) {
          const request = yield* Queue.take(client.queue);
          yield* relay.ingest(request);
        }
      })
    ).pipe(Effect.forkScoped);
  })
);
