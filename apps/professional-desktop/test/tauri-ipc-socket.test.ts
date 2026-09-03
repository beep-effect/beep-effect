import { describe, it } from "@effect/vitest";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { Socket } from "effect/unstable/socket";
import { beforeEach, expect, vi } from "vitest";
import { TauriIpcSocketLive } from "@/transport/TauriIpcSocket";

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock("@tauri-apps/api/core", () => ({ invoke }));

describe("TauriIpcSocket", { concurrent: false }, () => {
  beforeEach(() => invoke.mockReset());

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

  it.effect("sends complete frames with the probed RPC session token", () => {
    invoke.mockImplementation((command: string) =>
      Promise.resolve(
        command === "sidecar_transport" ? { ipc: true, rpcSessionToken: "test-session-token" } : undefined
      )
    );

    return Effect.scoped(
      Effect.gen(function* () {
        const context = yield* Layer.build(TauriIpcSocketLive);
        const socket = Context.get(context, Socket.Socket);
        const write = yield* socket.writer;

        yield* write('{"jsonrpc":"2.0"}\n');

        expect(invoke).toHaveBeenNthCalledWith(1, "sidecar_transport");
        expect(invoke).toHaveBeenNthCalledWith(2, "sidecar_send", {
          frame: '{"jsonrpc":"2.0"}\n',
          rpcSessionToken: "test-session-token",
        });
      })
    );
  });

  it.effect("buffers text and byte chunks until an outbound frame is complete", () => {
    invoke.mockImplementation((command: string) =>
      Promise.resolve(
        command === "sidecar_transport" ? { ipc: true, rpcSessionToken: "test-session-token" } : undefined
      )
    );

    return Effect.scoped(
      Effect.gen(function* () {
        const context = yield* Layer.build(TauriIpcSocketLive);
        const socket = Context.get(context, Socket.Socket);
        const write = yield* socket.writer;

        yield* write('{"json');
        expect(invoke).not.toHaveBeenCalled();

        yield* write(new TextEncoder().encode('rpc":"2.0"}\n'));
        expect(invoke).toHaveBeenNthCalledWith(1, "sidecar_transport");
        expect(invoke).toHaveBeenNthCalledWith(2, "sidecar_send", {
          frame: '{"jsonrpc":"2.0"}\n',
          rpcSessionToken: "test-session-token",
        });
      })
    );
  });

  it.effect("fails a write when the transport omits its RPC session token", () => {
    invoke.mockResolvedValue({ ipc: true });

    return Effect.scoped(
      Effect.gen(function* () {
        const context = yield* Layer.build(TauriIpcSocketLive);
        const socket = Context.get(context, Socket.Socket);
        const write = yield* socket.writer;
        const error = yield* write('{"jsonrpc":"2.0"}\n').pipe(Effect.flip);

        expect(Socket.isSocketError(error)).toBe(true);
        expect(invoke).toHaveBeenCalledTimes(1);
      })
    );
  });
});
