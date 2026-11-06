/**
 * Owned synthetic ACK transport; it never commits a lifecycle observation.
 * @packageDocumentation
 * @since 0.0.0
 */
import { createServer } from "node:net";
import * as A from "effect/Array";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { failure } from "../internal/cursor-lifecycle-schemas.ts";
import type { Socket } from "node:net";

/**
 * Accept one bounded synthetic callback and return the configured test ACK.
 * **Example** (Inspect the transport fixture without listening)
 * ```ts
 * import { makeLifecycleAckServer } from "@beep/repo-ai-metrics/test/lifecycle-ack-server"
 * console.log(typeof makeLifecycleAckServer)
 * ```
 * @category testing
 * @since 0.0.0
 */
export const makeLifecycleAckServer = Effect.fn("LifecycleTest.syntheticAckServer")(function* (
  reply: string,
  hold: boolean
) {
  const fs = yield* FileSystem.FileSystem;
  const directory = yield* fs.makeTempDirectoryScoped({ prefix: "ack-contract-" });
  yield* fs.chmod(directory, 0o700);
  const canonical = yield* fs.realPath(directory);
  const path = `${canonical}/s`;
  const seen = yield* Deferred.make<void>();
  let received = "";
  let receivedBytes = 0;
  let sockets: ReadonlyArray<Socket> = [];
  const server = yield* Effect.acquireRelease(
    Effect.sync(() =>
      createServer({ allowHalfOpen: true }, (socket) => {
        sockets = A.append(sockets, socket);
        socket.on("data", (chunk: Uint8Array) => {
          receivedBytes += chunk.byteLength;
          if (receivedBytes > 8192) socket.destroy();
          else received += new TextDecoder().decode(chunk);
        });
        socket.once("end", () => {
          Deferred.doneUnsafe(seen, Effect.void);
          if (!hold) socket.end(reply);
        });
        socket.once("error", () => socket.destroy());
      })
    ),
    (server) =>
      Effect.callback<void>((resume) => {
        A.forEach(sockets, (socket) => socket.destroy());
        server.close(() => resume(Effect.void));
      })
  );
  yield* Effect.callback<void, ReturnType<typeof failure>>((resume) => {
    server.once("error", () => resume(Effect.fail(failure("transport"))));
    server.listen(path, () => resume(Effect.void));
  });
  return { path, received: Effect.sync(() => received), awaitRequest: Deferred.await(seen) };
});
