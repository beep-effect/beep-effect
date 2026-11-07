/**
 * Private bounded callback validation and exchange shared by native lifecycle forwarders.
 * @packageDocumentation
 * @since 0.0.0
 */
import * as NodeNet from "node:net";
import * as Effect from "effect/Effect";
import * as Str from "effect/String";
import { CursorLifecycleCodecs, failure } from "./cursor-lifecycle-schemas.ts";
import type { CursorLifecycleError } from "./cursor-lifecycle-schemas.ts";

const { decodeAcknowledgement } = CursorLifecycleCodecs;
/**
 * Checks the fixed callback byte ceiling and absolute socket path bounds.
 * This check performs no decoding, socket connection or source admission.
 *
 * **Example** (Inspect the validator from a colocated private module)
 *
 * ```ts
 * import { validateLifecycleCallbackInput } from "./lifecycle-exchange.ts"
 *
 * console.log(typeof validateLifecycleCallbackInput)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const validateLifecycleCallbackInput = Effect.fnUntraced(function* (socketPath: string, body: string) {
  if (
    new TextEncoder().encode(body).byteLength > 8192 ||
    !Str.startsWith("/")(socketPath) ||
    new TextEncoder().encode(socketPath).byteLength > 107
  )
    return yield* failure("callback");
});
/**
 * Exchanges one projected callback for its bounded durable-intake acknowledgement.
 * A transport failure does not prove that the journal did not commit.
 *
 * **Example** (Inspect the transport from a colocated private module without connecting)
 *
 * ```ts
 * import { exchangeLifecycle } from "./lifecycle-exchange.ts"
 *
 * console.log(typeof exchangeLifecycle)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
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
