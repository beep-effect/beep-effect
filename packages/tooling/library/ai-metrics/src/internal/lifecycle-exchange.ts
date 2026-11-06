/** Private bounded exchange shared by native lifecycle forwarders. */
import * as NodeNet from "node:net";
import * as Effect from "effect/Effect";
import * as Str from "effect/String";
import { CursorLifecycleCodecs, failure } from "./cursor-lifecycle-schemas.ts";
import type { CursorLifecycleError } from "./cursor-lifecycle-schemas.ts";

const { decodeAcknowledgement } = CursorLifecycleCodecs;
/** Validate common fixed byte ceilings before either source-specific decoder runs. */
export const validateLifecycleCallbackInput = Effect.fnUntraced(function* (socketPath: string, body: string) {
  if (
    new TextEncoder().encode(body).byteLength > 8192 ||
    !Str.startsWith("/")(socketPath) ||
    new TextEncoder().encode(socketPath).byteLength > 107
  )
    return yield* failure("callback");
});
export const exchangeLifecycle = Effect.fn("AiMetrics.lifecycle.exchange")(function* (
  socketPath: string,
  projected: string,
  timeoutMillis: number
) {
  const reply = yield* Effect.callback<string, CursorLifecycleError>((resume) => {
    const socket = NodeNet.createConnection({ path: socketPath, allowHalfOpen: true });
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
