/** Private bounded exchange shared by native lifecycle forwarders. */
import { createConnection } from "node:net";
import * as Effect from "effect/Effect";
import { CursorLifecycleCodecs, failure } from "./cursor-lifecycle-schemas.ts";
import type { CursorLifecycleError } from "./cursor-lifecycle-schemas.ts";

const { decodeAcknowledgement } = CursorLifecycleCodecs;
export const exchangeLifecycle = Effect.fn("AiMetrics.lifecycle.exchange")(function* (
  socketPath: string,
  projected: string,
  timeoutMillis: number
) {
  const reply = yield* Effect.callback<string, CursorLifecycleError>((resume) => {
    const socket = createConnection({ path: socketPath, allowHalfOpen: true });
    let output = "";
    let size = 0;
    socket.once("connect", () => socket.end(projected));
    socket.on("data", (chunk: Uint8Array) => {
      size += chunk.byteLength;
      if (size > 1024) {
        socket.destroy();
        resume(Effect.fail(failure("transport")));
      } else output += new TextDecoder().decode(chunk);
    });
    socket.once("error", () => resume(Effect.fail(failure("transport"))));
    socket.once("end", () => resume(Effect.succeed(output)));
    return Effect.sync(() => socket.destroy());
  }).pipe(Effect.timeoutOrElse({ duration: timeoutMillis, orElse: () => Effect.fail(failure("transport")) }));
  return yield* decodeAcknowledgement(reply).pipe(Effect.mapError(() => failure("transport")));
});
