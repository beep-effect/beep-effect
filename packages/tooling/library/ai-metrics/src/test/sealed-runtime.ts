/** Private executable copies and real socket peers for native boundary tests.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoAiMetricsId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FileSystem from "effect/FileSystem";
import { identity } from "effect/Function";
import * as O from "effect/Option";
import * as ChildProcess from "effect/process/ChildProcess";
import * as Queue from "effect/Queue";
import * as S from "effect/Schema";
import * as Scope from "effect/Scope";
import * as Semaphore from "effect/Semaphore";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import { hashObservationPayload } from "../internal/native-trace-wire.ts";
import type { ChildProcessHandle } from "effect/process/ChildProcessSpawner";

const $I = $RepoAiMetricsId.create("test/sealed-runtime");
class RuntimeFixtureError extends S.TaggedError<RuntimeFixtureError, { readonly brand: unique symbol }>(
  $I`RuntimeFixtureError`
)(
  "RuntimeFixtureError",
  { reason: S.Literals(["runtime", "transport"]) },
  $I.annote("RuntimeFixtureError", { description: "Payload-free synthetic runtime failure." })
) {}
const failure = (reason: RuntimeFixtureError["reason"]) => RuntimeFixtureError.make({ reason });
/**
 * Observe terminal completion and require the exact owned process handle to be stopped.
 * A scoped signal is not represented as a successful zero exit status.
 * **Example** (Inspect the process observation helper)
 * ```ts
 * import { observeFixtureProcessStopped } from "@beep/repo-ai-metrics/test/sealed-runtime"
 * console.log(typeof observeFixtureProcessStopped)
 * ```
 * @category testing
 * @since 0.0.0
 */
export const observeFixtureProcessStopped = Effect.fn("NativeBoundaryTest.processStopped")(
  function* (child: ChildProcessHandle) {
    yield* child.exitCode.pipe(Effect.result);
    const running = yield* child.isRunning;
    if (running) return yield* failure("runtime");
  },
  Effect.mapError(() => failure("runtime"))
);
// One real process serves serial fixture callbacks, preserving runtime PID/start-ticks for replay.
// Only bounded ACK text leaves stdout; the input channel keeps lost-ACK peers alive until teardown.
/**
 * Fixed synthetic socket peer program shared by private runtime ancestry fixtures.
 * **Example** (Inspect the fixture program without launching it)
 * ```ts
 * import { sealedRuntimeSocketPeerSource } from "@beep/repo-ai-metrics/test/sealed-runtime"
 * console.log(sealedRuntimeSocketPeerSource.length > 0)
 * ```
 * @category testing
 * @since 0.0.0
 */
export const sealedRuntimeSocketPeerSource = String.raw`
const net = require("node:net");
const readline = require("node:readline");
const lines = readline.createInterface({input:process.stdin,crlfDelay:Infinity});
let request;
lines.on("line", line => {
  if(!request) { const split=line.indexOf("|"); request={drop:line.slice(0,split)==="drop",path:line.slice(split+1)}; return; }
  const body=line, {path,drop}=request; request=undefined;
  if(Buffer.byteLength(body,"utf8")>8192)process.exit(1);
  const socket = net.createConnection({path,allowHalfOpen:true});
  let output = "", size = 0;
  socket.once("connect", () => socket.end(body, () => {
    if (drop) { socket.destroy(); process.stdout.write("sent\n"); }
  }));
  socket.on("data", chunk => { size += chunk.length; if(size > 1024) process.exit(1); output += chunk.toString("utf8"); });
  socket.once("end", () => { if(!drop) process.stdout.write(output.replace(/\n$/,"")+"\n"); });
  socket.once("error", () => { if(!drop) process.stdout.write("\n"); });
});
`;

const sealRuntimeCopy = Effect.fnUntraced(function* () {
  const fs = yield* FileSystem.FileSystem;
  const source = yield* fs.realPath(process.execPath);
  const before = yield* fs.stat(source);
  if (before.type !== "File" || before.size > BigInt(268435456)) return yield* failure("runtime");
  const directory = yield* fs.makeTempDirectoryScoped({ prefix: "sealed-runtime-" });
  yield* fs.chmod(directory, 0o700);
  const executable = `${directory}/runtime`;
  // Fresh exclusive directory + copyFile creates distinct bytes/inode, never a hardlink.
  yield* fs.copyFile(source, executable);
  yield* fs.chmod(executable, 0o500);
  const copied = yield* fs.stat(executable);
  const uid = process.getuid?.();
  if (uid === undefined) return yield* failure("runtime");
  const copiedBytes = yield* fs.readFile(executable);
  const sha256 = yield* hashObservationPayload(copiedBytes);
  const sourceBytes = yield* fs.readFile(source);
  const sourceHash = yield* hashObservationPayload(sourceBytes);
  const after = yield* fs.stat(source);
  const canonical = yield* fs.realPath(executable);
  const valid = A.every(
    [
      copied.type === "File",
      (copied.mode & 0o022) === 0,
      O.contains(uid)(copied.uid),
      O.contains(BigInt(1))(copied.nlink),
      O.isSome(before.ino),
      O.isSome(copied.ino),
      before.dev !== copied.dev ||
        O.getOrElse(before.ino, () => -BigInt(1)) !== O.getOrElse(copied.ino, () => -BigInt(1)),
      before.mode === after.mode,
      before.dev === after.dev,
      before.size === after.size,
      O.getOrElse(before.ino, () => -BigInt(1)) === O.getOrElse(after.ino, () => BigInt(-2)),
      sha256 === sourceHash,
      canonical === executable,
    ],
    identity
  );
  if (!valid) return yield* failure("runtime");
  return { executable, sha256, sourceMode: before.mode };
});

/**
 * Copy and seal the actual test executable, then launch that same byte-identical copy as a peer.
 * Source/system/cache permissions are never changed and no hardlink is created.
 * **Example** (Inspect the private fixture factory)
 * ```ts
 * import { makeSealedRuntimeFixture } from "@beep/repo-ai-metrics/test/sealed-runtime"
 * console.log(typeof makeSealedRuntimeFixture)
 * ```
 * @category testing
 * @since 0.0.0
 */
export const makeSealedRuntimeFixture = Effect.fn("NativeBoundaryTest.sealedRuntime")(function* () {
  const parent = yield* Effect.scope;
  const owned = yield* Scope.fork(parent);
  const close = Scope.close(owned, Exit.void);
  return yield* Effect.gen(function* () {
    const sealed = yield* sealRuntimeCopy();
    const { executable } = sealed;
    const commands = yield* Effect.acquireRelease(Queue.bounded<Uint8Array>(1), Queue.shutdown);
    const semaphore = yield* Semaphore.make(1);
    const child = yield* ChildProcess.make(executable, ["--eval", sealedRuntimeSocketPeerSource], {
      extendEnv: false,
      cwd: process.cwd(),
      stdin: Stream.fromQueue(commands),
      stderr: "ignore",
      killSignal: "SIGKILL",
    });
    let count = 0;
    const next = yield* child.stdout.pipe(
      Stream.mapEffect((chunk) => {
        count += chunk.byteLength;
        return count <= 1024 ? Effect.succeed(chunk) : Effect.fail(failure("transport"));
      }),
      Stream.decodeText(),
      Stream.splitLines,
      Stream.rechunk(1),
      Stream.toPull
    );
    const send = Effect.fn("NativeBoundaryTest.socketPeer")(
      function* (socketPath: string, body: string, drop: boolean) {
        if (
          Str.includes("\n")(socketPath) ||
          Str.includes("\n")(body) ||
          new TextEncoder().encode(body).byteLength > 8192
        )
          return yield* failure("transport");
        count = 0;
        yield* Queue.offer(commands, new TextEncoder().encode(`${drop ? "drop" : "ack"}|${socketPath}\n${body}\n`));
        const line = yield* next;
        const reply = `${line[0]}\n`;
        if (drop) {
          if (reply !== "sent\n") return yield* failure("transport");
        }
        return reply;
      },
      semaphore.withPermit,
      Effect.onInterrupt(() => close),
      Effect.timeoutOrElse({ duration: "6 seconds", orElse: () => Effect.fail(failure("transport")) }),
      Effect.mapError(() => failure("transport"))
    );
    // A scope-owned SIGKILL is an exit observation, not an expected zero exit code.
    // Require the exact handle to report stopped; never expose the native command-bearing error.
    const closed = observeFixtureProcessStopped(child);
    return { ...sealed, send, close, closed };
  }).pipe(
    Scope.provide(owned),
    Effect.onError(() => close)
  );
});
