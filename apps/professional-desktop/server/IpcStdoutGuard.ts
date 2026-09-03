// Run the side-effect-only stdout patch before application and sidecar services
// load. The IPC stdio integration test proves its functional utility imports do

// not leak bytes onto the protocol stream before the patch is installed.
import * as P from "@beep/utils/Predicate";
// Run the side-effect-only stdout patch before application and sidecar services
// load. The IPC stdio integration test proves its functional utility imports do
// not leak bytes onto the protocol stream before the patch is installed.
import * as BunStdio from "@effect/platform-bun/BunStdio";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Sink from "effect/Sink";
import * as Stdio from "effect/Stdio";
import { ipcTransport, protocolStdout } from "./IpcStdoutGuard.prelude.ts";

// Re-export the single transport flag so main.ts selects the transport from the
// same value the stdout guard keys off, never a second CHAT_TRANSPORT read.
export { ipcTransport };

const writeProtocolStdout = (chunk: string | Uint8Array): Effect.Effect<void> =>
  Effect.callback<void>((resume) => {
    protocolStdout.write(chunk, (error?: Error | null) =>
      resume(P.isUndefined(error) || P.isNull(error) ? Effect.void : Effect.die(error))
    );
  });

const IpcStdioLive: Layer.Layer<Stdio.Stdio> = Layer.effect(
  Stdio.Stdio,
  Effect.map(Stdio.Stdio, (stdio) =>
    Stdio.make({
      args: stdio.args,
      stdin: stdio.stdin,
      stdout: () => Sink.forEach(writeProtocolStdout),
      stderr: stdio.stderr,
    })
  )
).pipe(Layer.provide(BunStdio.layer));

/**
 * Stdio layer for the sidecar RPC transport.
 *
 * In HTTP mode this is the normal Bun stdio service. In IPC mode stdout is
 * guarded (see `IpcStdoutGuard.prelude.ts`) so only the RPC protocol sink writes
 * to stdout; console and stray direct stdout writes are diverted to stderr to keep
 * ndjson framing clean.
 *
 * @category layers
 * @since 0.0.0
 */
export const SidecarStdioLive: Layer.Layer<Stdio.Stdio> = ipcTransport ? IpcStdioLive : BunStdio.layer;
