import { describe, it } from "@effect/vitest";
import { Context, Effect, Layer } from "effect";
import { Socket } from "effect/unstable/socket";
import { TauriIpcSocketLive } from "@/transport/TauriIpcSocket";

describe("TauriIpcSocket", () => {
  it.effect("ignores close events written to the sidecar socket", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const context = yield* Layer.build(TauriIpcSocketLive);
        const socket = Context.get(context, Socket.Socket);
        const write = yield* socket.writer;

        yield* write(new Socket.CloseEvent());
      })
    )
  );
});
