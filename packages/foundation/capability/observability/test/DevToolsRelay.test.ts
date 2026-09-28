import { DevToolsRelayService, makeDevToolsRelayService } from "@beep/observability/experimental/server";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertSome } from "@effect/vitest/utils";
import { Effect, Layer } from "effect";
import * as DevToolsSchema from "effect/devtools/DevToolsSchema";
import * as NetAddress from "effect/net/NetAddress";
import * as O from "effect/Option";
import * as SocketServer from "effect/socket/SocketServer";
import type * as Socket from "effect/socket/Socket";

const fakeSocketServerRun = Effect.fn("DevToolsRelayTest.fakeSocketServerRun")(
  <R, E, A>(_handler: (socket: Socket.Socket) => Effect.Effect<A, E, R>) => Effect.never
);

const fakeSocketServer = SocketServer.SocketServer.of({
  address: NetAddress.inetAddressFromIpStringUnsafe("127.0.0.1", 3437),
  run: fakeSocketServerRun,
});

const relayTestLayer = Layer.effect(DevToolsRelayService, makeDevToolsRelayService).pipe(
  Layer.provide(Layer.succeed(SocketServer.SocketServer, fakeSocketServer))
);

describe("DevToolsRelay", () => {
  it.layer(relayTestLayer, { timeout: "10 seconds" })((it) => {
    it.effect("ingests spans, events, and metrics snapshots", () =>
      Effect.gen(function* () {
        const relay = yield* DevToolsRelayService;

        yield* relay.ingest({
          _tag: "Span",
          spanId: "span-1",
          traceId: "trace-1",
          name: "example",
          sampled: true,
          attributes: new Map(),
          status: {
            _tag: "Started",
            startTime: 1n,
          },
          parent: O.none(),
        });
        yield* relay.ingest({
          _tag: "SpanEvent",
          traceId: "trace-1",
          spanId: "span-1",
          name: "tick",
          startTime: 2n,
          attributes: undefined,
        });
        yield* relay.ingest({
          _tag: "MetricsSnapshot",
          metrics: [],
        });

        const snapshot = yield* relay.snapshot;

        expect(snapshot.spanCount).toBe(1);
        expect(snapshot.spanEventCount).toBe(1);
        expect(snapshot.metricCount).toBe(0);

        const metrics = DevToolsSchema.MetricsSnapshot.make({
          metrics: [
            DevToolsSchema.Counter.make({
              id: "test-relay-requests",
              description: undefined,
              attributes: { route: "/health" },
              state: { count: 7, incremental: true },
            }),
          ],
        });
        yield* relay.ingest(metrics);
        const latestMetrics = yield* relay.latestMetrics;
        const populated = yield* relay.snapshot;
        assertSome(latestMetrics, metrics);
        expect(populated.metricCount).toBe(1);
        expect(populated.spanCount).toBe(1);
        expect(populated.spanEventCount).toBe(1);
      })
    );
  });
});
