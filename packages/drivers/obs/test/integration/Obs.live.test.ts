import { Obs, ObsProtocol } from "@beep/obs";
import { it } from "@beep/test-runner";
import { O, P, Str } from "@beep/utils";
import { describe, expect } from "@effect/vitest";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Socket from "effect/socket/Socket";
import type { TestContext } from "@effect/vitest";

const OBS_WEBSOCKET_URL = "ws://127.0.0.1:4455";

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
  return Effect.sync(cleanup);
}).pipe(
  Effect.timeoutOption("2 seconds"),
  Effect.tap((available) =>
    O.isNone(available) ? Effect.log("OBS availability phase: transport probe timed out") : Effect.void
  ),
  Effect.map(O.getOrElse(() => false)),
  Effect.withSpan("Obs.live.availability")
);

const LiveObsLayer = Layer.unwrap(
  Effect.gen(function* () {
    const password = yield* Config.option(Config.Redacted("OBS_WEBSOCKET_PASSWORD"));
    return Obs.layer.pipe(
      Layer.provideMerge(ObsProtocol.makeLayer({ password })),
      Layer.provide(Socket.layerWebSocketConstructorGlobal)
    );
  })
);

describe("Obs live integration", () => {
  it.layer(Layer.empty, { excludeTestServices: true, timeout: "30 seconds" })((liveIt) => {
    liveIt.effect(
      "connects to the live obs-websocket, verifies the version, and reads record status",
      Effect.fnUntraced(function* (ctx: TestContext) {
        if (!(yield* probeObsWebSocket)) ctx.skip();
        const body = Effect.gen(function* () {
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
        });
        yield* LiveObsLayer.pipe(
          Layer.build,
          Effect.flatMap((context) => Effect.provideContext(body, context))
        );
      }),
      30_000
    );
  });
});
