/**
 * Side-effect-only stdout guard prelude for the IPC sidecar transport.
 *
 * `server/main.ts` imports this first, so the stdout diversion below runs before
 * the effect runtime, the `@beep/*` deps, or their transitive imports can evaluate.
 * Its only import is `effect/Predicate` — a pure leaf module that performs no I/O on
 * load — so nothing writes to stdout before the patch is installed. In IPC mode the
 * sidecar's stdout is the ndjson rpc frame stream the Tauri Rust shell parses, so any
 * stray byte written to stdout during module initialization would corrupt framing;
 * routing every non-protocol sink to stderr up front keeps stdout clean.
 *
 * The real (unpatched) stdout writer is captured and re-exported (via `protocolStdout`)
 * so the protocol sink in `IpcStdoutGuard.ts` can still reach fd 1 deliberately.
 *
 * Known limitation: this guards the realistic sinks (`console.*`,
 * `process.stdout.write`, `Bun.write` targeting `Bun.stdout`) but not raw
 * file-descriptor writes (for example `fs.writeSync(1, …)`). The sidecar IPC stdio
 * integration test asserts stdout stays a clean frame stream as a regression net.
 */
import { A, P, pipe, Str } from "@beep/utils";

// biome-ignore lint/suspicious/noUndeclaredEnvVars: CHAT_TRANSPORT is declared in turbo.json under global.passThroughEnv.
export const ipcTransport = Bun.env.CHAT_TRANSPORT === "ipc";

// Capture the genuine sinks before patching so the protocol writer can bypass the
// guard on purpose and Bun.write can still fan out to stderr.
const originalStdoutWrite: typeof process.stdout.write = process.stdout.write.bind(process.stdout);
const originalBunWrite = Bun.write.bind(Bun);
const originalBunWriteUnknown = originalBunWrite as (
  destination: unknown,
  input: unknown
) => ReturnType<typeof Bun.write>;

// The real stdout writer, exposed on an object (not as a bare exported function) so
// the IPC protocol sink in `IpcStdoutGuard.ts` can deliberately bypass the guard.
export const protocolStdout = { write: originalStdoutWrite } as const;

const writeConsoleToStderr = (...values: Array<unknown>): void => {
  const line = pipe(values, A.map(String), A.join(" "));
  process.stderr.write(Str.isEmpty(line) ? "\n" : `${line}\n`);
};

const writeDirectStdoutToStderr = (
  chunk: string | Uint8Array,
  encodingOrCallback?: BufferEncoding | ((error?: Error | null) => void),
  callback?: (error?: Error | null) => void
): boolean => {
  const done = P.isFunction(encodingOrCallback) ? encodingOrCallback : callback;
  const encoding = P.isString(encodingOrCallback) ? encodingOrCallback : undefined;
  return P.isUndefined(encoding) ? process.stderr.write(chunk, done) : process.stderr.write(chunk, encoding, done);
};

const writeBunStdoutToStderr = ((destination: unknown, input: unknown) =>
  originalBunWriteUnknown(destination === Bun.stdout ? Bun.stderr : destination, input)) as typeof Bun.write;

if (ipcTransport) {
  console.log = writeConsoleToStderr;
  console.info = writeConsoleToStderr;
  console.debug = writeConsoleToStderr;
  console.warn = writeConsoleToStderr;
  console.trace = writeConsoleToStderr;
  process.stdout.write = writeDirectStdoutToStderr as typeof process.stdout.write;
  Bun.write = writeBunStdoutToStderr;
}
