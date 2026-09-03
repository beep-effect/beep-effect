/**
 * Side-effect-only stdout guard prelude for the IPC sidecar transport.
 *
 * `server/main.ts` imports this first, so the stdout diversion below runs before
 * the application runtime and sidecar services evaluate. In IPC mode the sidecar's
 * stdout is the ndjson rpc frame stream the Tauri Rust shell parses, so any stray
 * byte written to stdout during module initialization would corrupt framing; routing
 * every non-protocol sink to stderr up front keeps stdout clean.
 *
 * The real (unpatched) stdout writer is captured and re-exported (via `protocolStdout`)
 * so the protocol sink in `IpcStdoutGuard.ts` can still reach fd 1 deliberately.
 *
 * Known limitation: this guards the realistic sinks (`console.*`,
 * `process.stdout.write`, `Bun.write` targeting `Bun.stdout`) but not raw
 * file-descriptor writes (for example `fs.writeSync(1, …)`). The sidecar IPC stdio
 * integration test asserts stdout stays a clean frame stream as a regression net.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as A from "@beep/utils/Array";
import * as O from "@beep/utils/Option";
import * as P from "@beep/utils/Predicate";
import * as Str from "@beep/utils/Str";
import { pipe } from "effect/Function";
import * as Result from "effect/Result";
/**
 * Whether the sidecar selected stdin/stdout IPC transport.
 *
 * Missing `CHAT_TRANSPORT` values select the default HTTP transport.
 *
 * @example
 * ```ts
 * import { ipcTransport } from "./IpcStdoutGuard.prelude.ts"
 *
 * console.log(ipcTransport)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
// biome-ignore lint/suspicious/noUndeclaredEnvVars: CHAT_TRANSPORT is declared in turbo.json under global.passThroughEnv.
export const ipcTransport = pipe(Bun.env.CHAT_TRANSPORT, O.fromNullishOr, O.exists(Str.equivalence("ipc")));

// Capture the genuine sinks before patching so the protocol writer can bypass the
// guard on purpose and Bun.write can still fan out to stderr.
const originalStdoutWrite: typeof process.stdout.write = process.stdout.write.bind(process.stdout);
const originalBunWrite: typeof Bun.write = Bun.write.bind(Bun);

/**
 * Captured stdout writer reserved for ndjson protocol frames.
 *
 * This bypasses the IPC guard intentionally. Application logs must use the
 * guarded console or stderr paths instead.
 *
 * @example
 * ```ts
 * import { protocolStdout } from "./IpcStdoutGuard.prelude.ts"
 *
 * protocolStdout.write('{"kind":"ping"}\n')
 * ```
 *
 * @effects Writes directly to the process stdout file descriptor.
 * @category protocols
 * @since 0.0.0
 */
export const protocolStdout: { readonly write: typeof originalStdoutWrite } = { write: originalStdoutWrite };

const unprintableConsoleValue = "<unprintable>";

const renderConsoleValue = (value: unknown): string =>
  pipe(
    Result.try(() => Str.String(value)),
    Result.getOrElse(() => unprintableConsoleValue)
  );

const writeConsoleToStderr = (...values: Array<unknown>): void => {
  const line = pipe(
    values,
    A.map(renderConsoleValue),
    A.join(" "),
    O.liftPredicate(Str.isNonEmpty),
    O.map(Str.concat("\n")),
    O.getOrElse(() => "\n")
  );
  process.stderr.write(line);
};

type WriteCallback = (error?: Error | null) => void;

const isWriteCallback = (value: unknown): value is WriteCallback => P.isFunction(value);
const isBufferEncoding = (value: BufferEncoding | WriteCallback | undefined): value is BufferEncoding =>
  P.isString(value);

const writeDirectStdoutToStderr: typeof process.stdout.write = (
  chunk: string | Uint8Array,
  encodingOrCallback?: BufferEncoding | WriteCallback,
  callback?: WriteCallback
): boolean => {
  const done = pipe(
    encodingOrCallback,
    O.liftPredicate(isWriteCallback),
    O.orElse(() => O.fromNullishOr(callback)),
    O.getOrUndefined
  );

  return pipe(
    encodingOrCallback,
    O.liftPredicate(isBufferEncoding),
    O.map((encoding) => process.stderr.write(chunk, encoding, done)),
    O.getOrElse(() => process.stderr.write(chunk, done))
  );
};

const redirectBunStdout = (destination: unknown): unknown => (destination === Bun.stdout ? Bun.stderr : destination);

const writeBunStdoutToStderr = new Proxy(originalBunWrite, {
  apply: (target, thisArg, args) =>
    Reflect.apply(
      target,
      thisArg,
      pipe(
        args,
        A.modify(0, redirectBunStdout),
        O.getOrElse(() => args)
      )
    ),
});

if (ipcTransport) {
  console.log = writeConsoleToStderr;
  console.info = writeConsoleToStderr;
  console.debug = writeConsoleToStderr;
  console.warn = writeConsoleToStderr;
  console.trace = writeConsoleToStderr;
  process.stdout.write = writeDirectStdoutToStderr;
  Bun.write = writeBunStdoutToStderr;
}
