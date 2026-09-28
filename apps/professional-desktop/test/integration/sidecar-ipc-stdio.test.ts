/**
 * Sidecar IPC-transport stdio round-trip (gated).
 *
 * Spawns the compiled sidecar artifact in ipc mode (`CHAT_TRANSPORT=ipc`,
 * keyless `CHAT_AGENT=fixture`) and bridges the child's stdio into an Effect
 * {@link Socket} — exactly what `src-tauri/src/lib.rs` does, but from Bun, so no
 * Tauri runtime is required. Driving {@link ChatRpcs} over
 * `RpcClient.layerProtocolSocket` then proves the `RpcServer.layerProtocolStdio`
 * server ↔ socket client ndjson framing carries a streaming `SendMessage` across
 * a real OS pipe (logs ride stderr, so stdout stays a clean frame stream).
 *
 * The in-process handler/streaming proof lives in `sidecar-smoke.test.ts`; this
 * suite is specifically the transport proof. The default integration lane leaves
 * it gated, while the Check workflow's "Professional Desktop IPC Stdio" job
 * builds the sidecar binary and runs this file with `BEEP_TEST_SIDECAR_IPC=1`.
 */

import { ChatRpcs } from "@beep/agents-use-cases/public";
import { it } from "@beep/test-runner";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import { describe, expect } from "@effect/vitest";
import * as Chunk from "effect/Chunk";
import * as Data from "effect/Data";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import { RpcClient, RpcSerialization } from "effect/rpc";
import * as Scope from "effect/Scope";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import { Socket } from "effect/socket";
import { decodeWorkspaceId, userDocument } from "@/chat/ChatFixtures";
import { SidecarReadyMarker } from "@/runtime/Migrations";

const shouldRun = Bun.env.BEEP_TEST_SIDECAR_IPC === "1";
const bootMarker = SidecarReadyMarker;

class SidecarBinaryResolutionError extends Data.TaggedError("SidecarBinaryResolutionError")<{
  readonly message: string;
}> {}

const resolveSidecarBinaryPath = Effect.try({
  try: () => {
    const result = Bun.spawnSync(["rustc", "-vV"], { stdout: "pipe", stderr: "pipe" });
    if (!result.success) {
      throw new Error(`rustc -vV failed: ${result.stderr.toString()}`);
    }
    const triple = result.stdout.toString().match(/host: (\S+)/)?.[1];
    if (triple === undefined) {
      throw new Error("could not determine the target triple from `rustc -vV`");
    }
    return `${process.cwd()}/src-tauri/binaries/sidecar-${triple}`;
  },
  catch: (cause) =>
    new SidecarBinaryResolutionError({
      message: cause instanceof Error ? cause.message : String(cause),
    }),
});

const waitForSidecarBoot = Effect.fn("SidecarIpc.waitForBoot")(function* (stderr: ReadableStream<Uint8Array>) {
  const ready = yield* Deferred.make<void>();
  let buffer = "";
  let readySeen = false;
  const drain = yield* Stream.fromReadableStream({
    evaluate: () => stderr,
    onError: (cause) => cause,
    releaseLockOnEnd: true,
  }).pipe(
    Stream.decodeText(),
    Stream.runForEach(
      Effect.fnUntraced(function* (text) {
        process.stderr.write(text);
        if (!readySeen) {
          buffer += text;
          if (Str.includes(bootMarker)(buffer)) {
            readySeen = true;
            buffer = "";
            yield* Deferred.succeed(ready, undefined);
          } else {
            buffer = Str.takeRight(buffer, bootMarker.length - 1);
          }
        }
      })
    ),
    Effect.orDie,
    Effect.onExit((exit) =>
      Deferred.done(
        ready,
        Exit.isFailure(exit) ? exit : Exit.die(new Error(`sidecar exited before emitting boot marker: ${bootMarker}`))
      )
    ),
    Effect.forkScoped
  );
  yield* Effect.addFinalizer(() => Fiber.join(drain));
  yield* Deferred.await(ready);
});

const ipcStdioProgram = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const dbDir = yield* Effect.acquireRelease(fs.makeTempDirectory({ prefix: "ipc-stdio-" }), (path) =>
    fs.remove(path, { force: true, recursive: true }).pipe(Effect.ignore)
  );
  const ontologyWorkspaceRoot = yield* Effect.acquireRelease(
    fs.makeTempDirectory({ prefix: "ipc-stdio-ontology-" }),
    (path) => fs.remove(path, { force: true, recursive: true }).pipe(Effect.ignore)
  );

  // This child scope closes after process termination, draining stderr before
  // either temporary directory is removed.
  const stderrScope = yield* Scope.fork(yield* Effect.scope);
  // Boot the real sidecar; join its exit when the scope closes.
  const sidecarBinaryPath = yield* resolveSidecarBinaryPath;
  const proc = yield* Effect.acquireRelease(
    Effect.sync(() =>
      Bun.spawn([sidecarBinaryPath], {
        cwd: process.cwd(),
        env: {
          ...process.env,
          CHAT_TRANSPORT: "ipc",
          CHAT_AGENT: "fixture",
          CHAT_DB_PATH: dbDir,
          ONTOLOGY_WORKSPACE_ROOT: ontologyWorkspaceRoot,
        },
        stdin: "pipe",
        stdout: "pipe",
        stderr: "pipe",
      })
    ),
    (child) => Effect.sync(() => child.kill()).pipe(Effect.andThen(Effect.promise(() => child.exited)))
  );
  yield* waitForSidecarBoot(proc.stderr).pipe(Scope.provide(stderrScope), Effect.timeout("20 seconds"));

  // Bridge the child's stdio into an Effect Socket: stdout → inbound frames,
  // stdin ← outbound frames (verbatim ndjson, encoded UTF-8 by fromTransformStream).
  const writable = new WritableStream<Uint8Array>({
    write(chunk) {
      proc.stdin.write(chunk);
      proc.stdin.flush();
    },
  });
  const socketStream: Socket.InputTransformStream = { readable: proc.stdout, writable };
  const SocketLive = Layer.effect(Socket.Socket, Socket.fromTransformStream(Effect.succeed(socketStream)));
  const ProtocolLive = RpcClient.layerProtocolSocket().pipe(Layer.provide([RpcSerialization.layerNdjson, SocketLive]));
  const context = yield* Layer.build(ProtocolLive);

  const program = Effect.gen(function* () {
    const client = yield* RpcClient.make(ChatRpcs);
    const workspaceId = yield* decodeWorkspaceId(1);

    const thread = yield* client.CreateThread({ workspaceId, title: "ipc stdio" });
    expect(thread.title).toBe("ipc stdio");

    const blocks = yield* client
      .SendMessage({ threadId: thread.id, content: userDocument("hello over stdio"), requestId: "ipc-stdio-test" })
      .pipe(Stream.runCollect, Effect.map(Chunk.fromIterable));
    expect(Chunk.size(blocks)).toBeGreaterThan(0);
  });

  // PGlite migrations are already complete; the streamed turn still gets
  // headroom for the fixture agent and RPC framing.
  yield* program.pipe(Effect.provide(context), Effect.timeout("30 seconds"));
});

const ipcStdio = Effect.scoped(
  Effect.gen(function* () {
    const context = yield* Layer.build(BunFileSystem.layer);
    yield* ipcStdioProgram.pipe(Effect.provide(context));
  })
);

if (!shouldRun) {
  describe.skip("Professional desktop sidecar ipc stdio (set BEEP_TEST_SIDECAR_IPC=1)", () => {});
} else {
  describe("Professional desktop sidecar ipc stdio", { concurrent: false }, () => {
    it.live("streams a fixture turn over the stdio rpc transport", () => ipcStdio);
  });
}
