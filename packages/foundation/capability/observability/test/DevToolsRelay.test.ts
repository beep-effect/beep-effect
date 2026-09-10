import { DevToolsRelayService, makeDevToolsRelayService } from "@beep/observability/experimental/server";
import { Effect } from "effect";
import * as O from "effect/Option";
import * as NetAddress from "effect/unstable/net/NetAddress";
import * as SocketServer from "effect/unstable/socket/SocketServer";
import { describe, expect, it } from "vitest";
import type * as Socket from "effect/unstable/socket/Socket";

const fakeSocketServerRun = Effect.fn("DevToolsRelayTest.fakeSocketServerRun")(
  <R, E, A>(_handler: (socket: Socket.Socket) => Effect.Effect<A, E, R>) => Effect.never
);

const fakeSocketServer = SocketServer.SocketServer.of({
  address: NetAddress.inetAddressFromIpStringUnsafe("127.0.0.1", 3437),
  run: fakeSocketServerRun,
});

describe("DevToolsRelay", () => {
  it("ingests spans, events, and metrics snapshots", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const snapshot = yield* Effect.gen(function* () {
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

          return yield* relay.snapshot;
        }).pipe(
          Effect.provideServiceEffect(DevToolsRelayService, makeDevToolsRelayService),
          Effect.provideService(SocketServer.SocketServer, fakeSocketServer)
        );

        expect(snapshot.spanCount).toBe(1);
        expect(snapshot.spanEventCount).toBe(1);
        expect(snapshot.metricCount).toBe(0);
      })
    ));
});
