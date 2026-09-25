import { Obs, ObsProtocol } from "@beep/obs";
import { it } from "@beep/test-runner";
import { O, P, Str } from "@beep/utils";
import { describe, expect } from "@effect/vitest";
import { Config, Effect, Layer } from "effect";
import { Socket } from "effect/socket";

const OBS_WEBSOCKET_URL = "ws://127.0.0.1:4455";

// Collection is a separate runtime boundary: the named test's watchdog cannot
// bound this availability check. Only transport absence/timeouts skip the case;
// constructor, listener and cleanup defects still fail collection.
const probeObsWebSocket = Effect.callback<boolean>((resume) => {
  const ws = new WebSocket(OBS_WEBSOCKET_URL, "obswebsocket.json");
  const cleanup = () => {
    ws.removeEventListener("open", onOpen);
    ws.removeEventListener("error", onError);
    ws.removeEventListener("close", onClose);
    ws.close(1000);
  };
  const finish = (available: boolean, phase: string) =>
    resume(
      Effect.sync(() => {
        cleanup();
        return available;
      }).pipe(Effect.tap(() => Effect.log(phase)))
    );
  const onOpen = () => finish(true, "OBS availability phase: transport opened");
  const onError = () => finish(false, "OBS availability phase: transport unreachable");
  const onClose = () => finish(false, "OBS availability phase: transport closed before opening");
  ws.addEventListener("open", onOpen, { once: true });
  ws.addEventListener("error", onError, { once: true });
  ws.addEventListener("close", onClose, { once: true });
  // Effect.callback runs this finalizer on timeout/interruption; successful
  // completion removes listeners and closes the socket through finish above.
  return Effect.sync(cleanup);
}).pipe(
  Effect.timeoutOption("2 seconds"),
  Effect.tap((available) =>
    O.isNone(available) ? Effect.log("OBS availability phase: transport probe timed out") : Effect.void
  ),
  Effect.map(O.getOrElse(() => false)),
  Effect.withSpan("Obs.live.availability")
);

const obsAvailable = await Effect.runPromise(probeObsWebSocket);

const LiveObsLayer = Layer.unwrap(
  Effect.gen(function* () {
    const password = yield* Config.option(Config.Redacted("OBS_WEBSOCKET_PASSWORD"));
    return Obs.layer.pipe(
      Layer.provideMerge(ObsProtocol.makeLayer({ password })),
      Layer.provide(Socket.layerWebSocketConstructorGlobal)
    );
  })
);

describe.skipIf(!obsAvailable)("Obs live integration", () => {
  // This is a real external service: exclude TestClock/TestConsole while keeping
  // the instrumented layer-owned connection and the original body timeout.
  it.layer(LiveObsLayer, { excludeTestServices: true, timeout: "30 seconds" })((liveIt) => {
    liveIt.effect(
      "connects to the live obs-websocket, verifies the version, and reads record status",
      Effect.fnUntraced(function* () {
        const obs = yield* Obs;
        yield* Effect.log("OBS live phase: verify connected server version");
        const running = yield* obs.ensureRunning;
        expect(running.spawned).toBe(false);
        expect(Str.isNonEmpty(running.obsVersion)).toBe(true);
        expect(Str.isNonEmpty(running.obsWebSocketVersion)).toBe(true);

        yield* Effect.log("OBS live phase: read recording status");
        const status = yield* obs.recordStatus;
        expect(P.isBoolean(status.outputActive)).toBe(true);
        expect(P.isBoolean(status.outputPaused)).toBe(true);
      }),
      30_000
    );
  });
});
