import { describe, it } from "@effect/vitest";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as Layer from "effect/Layer";
import * as Scope from "effect/Scope";
import { Socket } from "effect/unstable/socket";
import { beforeEach, expect, vi } from "vitest";
import { TauriIpcSocketLive } from "@/transport/TauriIpcSocket";

const { invoke, listen, unlisten } = vi.hoisted(() => ({ invoke: vi.fn(), listen: vi.fn(), unlisten: vi.fn() }));

vi.mock("@tauri-apps/api/core", () => ({ invoke }));
vi.mock("@tauri-apps/api/event", () => ({ listen }));

describe("TauriIpcSocket", { concurrent: false }, () => {
  beforeEach(() => invoke.mockReset());

  it.effect("ignores close events written to the sidecar socket", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const context = yield* Layer.build(TauriIpcSocketLive);
        const socket = Context.get(context, Socket.Socket);
        const { write } = yield* socket.writer;

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
        const { write } = yield* socket.writer;

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
        const { write } = yield* socket.writer;

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
        const { write } = yield* socket.writer;
        const error = yield* write('{"jsonrpc":"2.0"}\n').pipe(Effect.flip);

        expect(Socket.isSocketError(error)).toBe(true);
        expect(invoke).toHaveBeenCalledTimes(1);
      })
    );
  });

  it.effect("writes batches in order without dropping a partial frame", () => {
    invoke.mockReset();
    invoke.mockImplementation((command: string) =>
      Promise.resolve(command === "sidecar_transport" ? { ipc: true, rpcSessionToken: "batch-token" } : undefined)
    );
    return Effect.scoped(
      Effect.gen(function* () {
        const context = yield* Layer.build(TauriIpcSocketLive);
        const socket = Context.get(context, Socket.Socket);
        const writer = yield* socket.writer;
        yield* writer.writeAll(['{"first":', 'true}\n{"second":true}\n']);
        expect(invoke).toHaveBeenNthCalledWith(2, "sidecar_send", {
          frame: '{"first":true}\n',
          rpcSessionToken: "batch-token",
        });
        expect(invoke).toHaveBeenNthCalledWith(4, "sidecar_send", {
          frame: '{"second":true}\n',
          rpcSessionToken: "batch-token",
        });
      })
    );
  });

  it.effect("acquires listeners before replay and releases suspended pulls with the reader scope", () => {
    invoke.mockReset();
    listen.mockReset();
    unlisten.mockReset();
    listen.mockResolvedValue(unlisten);
    invoke.mockImplementation(() => {
      expect(listen).toHaveBeenCalledTimes(2);
      return Promise.resolve();
    });
    return Effect.gen(function* () {
      const context = yield* Layer.build(TauriIpcSocketLive);
      const socket = Context.get(context, Socket.Socket);
      const scope = yield* Scope.make();
      const reader = yield* Scope.provide(scope)(socket.reader);
      expect(invoke).toHaveBeenCalledWith("sidecar_ipc_ready");
      const waiting = yield* reader.pull.pipe(Effect.flip, Effect.forkChild);
      yield* Effect.yieldNow;
      yield* Scope.close(scope, Exit.void);
      const error = yield* Fiber.join(waiting);
      expect(error.reason._tag).toBe("SocketCloseError");
      expect(unlisten).toHaveBeenCalledTimes(2);
    });
  });

  it.effect("fails reader acquisition when listener registration fails", () => {
    invoke.mockReset();
    listen.mockReset();
    listen.mockRejectedValue("listener unavailable");
    return Effect.gen(function* () {
      const context = yield* Layer.build(TauriIpcSocketLive);
      const socket = Context.get(context, Socket.Socket);
      const error = yield* socket.reader.pipe(Effect.scoped, Effect.flip);
      expect(Socket.isSocketError(error)).toBe(true);
      expect(invoke).not.toHaveBeenCalled();
    });
  });
});
