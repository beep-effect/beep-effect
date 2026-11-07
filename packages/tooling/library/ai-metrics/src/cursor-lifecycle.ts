/** Passive Cursor CLI observations. No hooks are installed by this module.
 * @packageDocumentation
 * @since 0.0.0
 */

import { createConnection } from "node:net";
import { Sha256Hex } from "@beep/schema";
import * as Effect from "effect/Effect";
import * as Str from "effect/String";
import { CursorLifecycleRuntime, makeCursorLifecycleCore } from "./internal/cursor-lifecycle-core.ts";
import {
  CursorLifecycleCodecs,
  CursorLifecycleError,
  CursorLifecyclePolicy,
  CursorLifecycleSourceContract,
  failure,
} from "./internal/cursor-lifecycle-schemas.ts";

const { decodeCallback, encodeCallback, decodeAcknowledgement } = CursorLifecycleCodecs;

export { CursorLifecycleError, CursorLifecyclePolicy, CursorLifecycleRuntime };

const nativeSourceContract = CursorLifecycleSourceContract.make({
  pins: [
    {
      suffix: "/2026.11.05-86047df/1212.index.js",
      sha256: Sha256Hex.make("15b18cb92aa4093acc886d1ef6f6f308bc97a9abca69b89cde805f91e9760042"),
    },
    {
      suffix: "/2026.11.05-86047df/5504.index.js",
      sha256: Sha256Hex.make("02ddf6e240a6f229fcf6e2b414479b26dfd4ad64199fd33ce7a872a391d6fe9c"),
    },
  ],
});
/** Build an inert socket handler over an existing durable journal and pause gate.
 * **Details** The host owns the Unix listener, enrollment and journal. The bounded
 * helper owns its Unix listener and observes SO_PEERCRED plus /proc ancestry.
 * Callback text cannot mint root/runtime/assurance fields. The result becomes an
 * ACK only after the existing journal transaction commits. The scoped open method serves one callback at a private ephemeral socket; it never installs hooks. Same-UID peers are nonexclusive source evidence.
 * **Example** (Inspect the bridge factory)
 * ```ts
 * import { makeCursorLifecycleReceiver } from "@beep/repo-ai-metrics/cursor-lifecycle"
 * console.log(typeof makeCursorLifecycleReceiver)
 * ```
 * @param policy - Receiver-owned native-source enrollment; journal/control come from CursorLifecycleRuntime.
 * @returns An Effect building a scoped listener factory from server-owned runtime services.
 * @category services
 * @since 0.0.0
 */
export const makeCursorLifecycleReceiver = (policy: CursorLifecyclePolicy) =>
  makeCursorLifecycleCore(policy, nativeSourceContract);

const callbackFailure = (_error: unknown) => failure("callback");
/**
 * Project bounded native callback input without opening a socket or writing to disk.
 * **Example** (Inspect the transient input projector)
 * ```ts
 * import { projectCursorLifecycleHookInput } from "@beep/repo-ai-metrics/cursor-lifecycle"
 * console.log(typeof projectCursorLifecycleHookInput)
 * ```
 * @param body - Transient bounded native stdin, never a policy or root attestation.
 * @returns Only the existing allowlisted native callback fields encoded for forwarding.
 * @category mapping
 * @since 0.0.0
 */
export const projectCursorLifecycleHookInput = Effect.fn("AiMetrics.cursorLifecycle.projectInput")(function* (
  body: string
) {
  if (new TextEncoder().encode(body).byteLength > 8192) return yield* failure("callback");
  const native = yield* decodeCallback(body).pipe(Effect.mapError(callbackFailure));
  return yield* encodeCallback(native).pipe(Effect.mapError(callbackFailure));
});

/** Project and forward one callback; this function never prints hook output.
 * **Details** Only the positive native envelope reaches the private socket. An
 * uncertain transport response is not replayed here. Cursor fire-and-forget loss
 * remains unknown, and a local receipt is not backend delivery. The caller owns
 * the installed callback command and passes bounded stdin once; no hook is installed.
 * **Example** (Inspect the inert callback bridge)
 * ```ts
 * import { forwardCursorLifecycleHook } from "@beep/repo-ai-metrics/cursor-lifecycle"
 * console.log(typeof forwardCursorLifecycleHook)
 * ```
 * @category services
 * @since 0.0.0
 */
export const forwardCursorLifecycleHook = Effect.fn("AiMetrics.cursorLifecycle.forward")(function* (
  socketPath: string,
  body: string
) {
  if (
    new TextEncoder().encode(body).byteLength > 8192 ||
    !Str.startsWith("/")(socketPath) ||
    new TextEncoder().encode(socketPath).byteLength > 107
  )
    return yield* failure("callback");
  const projected = yield* projectCursorLifecycleHookInput(body);
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
  }).pipe(Effect.timeoutOrElse({ duration: "5 seconds", orElse: () => Effect.fail(failure("transport")) }));
  return yield* decodeAcknowledgement(reply).pipe(Effect.mapError(() => failure("transport")));
});
