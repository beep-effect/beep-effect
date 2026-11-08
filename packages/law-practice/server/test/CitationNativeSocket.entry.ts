import * as BunRuntime from "@effect/platform-bun/BunRuntime";
import * as BunServices from "@effect/platform-bun/BunServices";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as RpcSerialization from "effect/rpc/RpcSerialization";
import * as RpcServer from "effect/rpc/RpcServer";
import * as Stdio from "effect/Stdio";
import * as Stream from "effect/Stream";
import { CitationNativeSocketTestRpcs } from "./CitationNativeSocket.protocol.ts";

const handlers = CitationNativeSocketTestRpcs.toLayer({
  Echo: ({ text }) => Effect.succeed(text),
  // Deliberate non-cooperative child work: only physical process termination
  // can stop it. This is a qualification control, never production behavior.
  Busy: Effect.fn("SocketFixture.busy")(function* () {
    const stdio = yield* Stdio.Stdio;
    yield* Stream.make("busy").pipe(Stream.run(stdio.stderr({ endOnDone: false })), Effect.orDie);
    return yield* Effect.sync(() => {
      for (;;) {
        /* block only this owned child */
      }
    });
  }),
});
RpcServer.layer(CitationNativeSocketTestRpcs).pipe(
  Layer.provide(handlers),
  Layer.provide(RpcServer.layerProtocolStdio),
  Layer.provide(RpcSerialization.layerSchemaBinary({ maxFrameSize: 262_144, fingerprintPayloads: true })),
  Layer.provide(BunServices.layer),
  Layer.launch,
  BunRuntime.runMain
);
