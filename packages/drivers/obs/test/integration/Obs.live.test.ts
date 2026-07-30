import { Obs, ObsProtocol } from "@beep/obs";
import { P, Str } from "@beep/utils";
import { describe, expect, it } from "@effect/vitest";
import { Config, Effect, Layer } from "effect";
import { Socket } from "effect/unstable/socket";

const OBS_WEBSOCKET_URL = "ws://127.0.0.1:4455";

/**
 * Runtime-boundary probe deciding skip-vs-run before the suite registers:
 * a raw WebSocket open attempt against the local obs-websocket port. When OBS
 * is not running (or the WebSocket server is disabled) the suite skips
 * cleanly instead of failing.
 */
const probeObsWebSocket = Effect.callback<boolean>((resume) => {
  const ws = new WebSocket(OBS_WEBSOCKET_URL, "obswebsocket.json");
  ws.addEventListener(
    "open",
    () => {
      ws.close(1000);
      resume(Effect.succeed(true));
    },
    { once: true }
  );
  ws.addEventListener("error", () => resume(Effect.succeed(false)), { once: true });
  ws.addEventListener("close", () => resume(Effect.succeed(false)), { once: true });
});

const obsAvailable = await Effect.runPromise(probeObsWebSocket);

describe.skipIf(!obsAvailable)("Obs live integration", () => {
  it.live(
    "connects to the live obs-websocket, verifies the version, and reads record status",
    Effect.fnUntraced(function* () {
      const password = yield* Config.option(Config.redacted("OBS_WEBSOCKET_PASSWORD"));
      const layer = Obs.layer.pipe(
        Layer.provideMerge(ObsProtocol.makeLayer({ password })),
        Layer.provide(Socket.layerWebSocketConstructorGlobal)
      );

      const context = yield* Layer.build(layer);
      yield* Effect.gen(function* () {
        const obs = yield* Effect.service(Obs);

        const running = yield* obs.ensureRunning;
        expect(running.spawned).toBe(false);
        expect(Str.isNonEmpty(running.obsVersion)).toBe(true);
        expect(Str.isNonEmpty(running.obsWebSocketVersion)).toBe(true);

        const status = yield* obs.recordStatus;
        expect(P.isBoolean(status.outputActive)).toBe(true);
        expect(P.isBoolean(status.outputPaused)).toBe(true);
      }).pipe(Effect.provide(context));
    }),
    30_000
  );
});
