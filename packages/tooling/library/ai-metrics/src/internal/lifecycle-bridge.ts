/** Shared private journal/peer transport; source-specific projection remains separate. */
import * as A from "effect/Array";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import * as ChildProcess from "effect/process/ChildProcess";
import * as Queue from "effect/Queue";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import { CursorLifecycleCodecs, failure, normalizeLifecycleFailure } from "./cursor-lifecycle-schemas.ts";
import { hashObservationPayload } from "./native-trace-wire.ts";
import type * as Context from "effect/Context";
import type { NativeTraceBatch } from "../native-trace.ts";
import type { CursorLifecycleRuntime } from "./cursor-lifecycle-core.ts";
import type {
  CursorLifecycleError,
  CursorLifecyclePolicy,
  CursorLifecycleSourceContract,
} from "./cursor-lifecycle-schemas.ts";

const { encodeJsonValue, decodeReady } = CursorLifecycleCodecs;
const readBoundedInterpreter = Effect.fnUntraced(function* (file: FileSystem.File) {
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const chunk = yield* file.readAlloc(65536);
    if (O.isNone(chunk)) break;
    size += chunk.value.byteLength;
    if (size > 33554432) return yield* failure("enrollment");
    chunks.push(chunk.value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return bytes;
});
const qualifySource = Effect.fnUntraced(function* (
  policy: CursorLifecyclePolicy,
  contract: CursorLifecycleSourceContract,
  helperSource: string
) {
  if (
    policy.sourcePins.length !== 2 ||
    !A.every(contract.pins, (expected) =>
      A.some(policy.sourcePins, (pin) => pin.sha256 === expected.sha256 && Str.endsWith(expected.suffix)(pin.path))
    )
  )
    return yield* failure("enrollment");
  if ((yield* hashObservationPayload(new TextEncoder().encode(helperSource))) !== policy.helperSha256)
    return yield* failure("enrollment");
});
const qualifyInterpreter = Effect.fnUntraced(function* (policy: CursorLifecyclePolicy) {
  const fs = yield* FileSystem.FileSystem;
  // The fixed Python interpreter is root-owned and not writable by this UID.
  // Parent canonicality plus noFollow closes the final-component path gap.
  if ((yield* fs.realPath(policy.pythonExecutable)) !== policy.pythonExecutable) return yield* failure("enrollment");
  const python = yield* fs.open(policy.pythonExecutable, { noFollow: true });
  const before = yield* python.stat;
  if (
    before.type !== "File" ||
    !O.contains(before.uid, 0) ||
    (before.mode & 0o022) !== 0 ||
    before.size > BigInt(33554432)
  )
    return yield* failure("enrollment");
  const bytes = yield* readBoundedInterpreter(python);
  const after = yield* python.stat;
  if (
    O.getOrUndefined(before.ino) !== O.getOrUndefined(after.ino) ||
    before.size !== after.size ||
    (yield* hashObservationPayload(bytes)) !== policy.pythonSha256
  )
    return yield* failure("enrollment");
});
export const makeLifecycleBridge = Effect.fn("AiMetrics.lifecycle.bridge")(function* (
  policy: CursorLifecyclePolicy,
  sourceContract: CursorLifecycleSourceContract,
  runtime: Context.Service.Shape<typeof CursorLifecycleRuntime>,
  helperSource: string,
  publicPolicy: unknown,
  makeBatch: (message: string) => Effect.Effect<NativeTraceBatch, CursorLifecycleError>,
  acknowledgementMillis = 10000,
  socketPathOverride?: string,
  lifetimeMillis = 10000
) {
  const { journal, control } = runtime;
  const open = Effect.fn("AiMetrics.cursorLifecycle.open")(function* () {
    const fs = yield* FileSystem.FileSystem;
    const directory = yield* fs.makeTempDirectoryScoped({ prefix: "cursor-lifecycle-" });
    const socketPath = socketPathOverride ?? `${directory}/s`;
    const ready = yield* Deferred.make<void, CursorLifecycleError>();
    const work = Effect.scoped(
      Effect.gen(function* () {
        yield* qualifySource(policy, sourceContract, helperSource);
        yield* qualifyInterpreter(policy);
        const input = yield* Queue.unbounded<Uint8Array>();
        const encodedPolicy = yield* encodeJsonValue(publicPolicy);
        yield* Queue.offer(input, new TextEncoder().encode(`${encodedPolicy}\n`));
        const child = yield* ChildProcess.make(policy.pythonExecutable, ["-I", "-B", "-c", helperSource, socketPath], {
          extendEnv: false,
          stdin: Stream.fromQueue(input),
          stderr: "ignore",
          killSignal: socketPathOverride === undefined ? "SIGKILL" : "SIGTERM",
          forceKillAfter: socketPathOverride === undefined ? undefined : 200,
        });
        let outputBytes = 0;
        const next = yield* child.stdout.pipe(
          Stream.mapEffect((chunk) => {
            outputBytes += chunk.byteLength;
            return outputBytes > 16384 ? Effect.fail(failure("kernel-binding")) : Effect.succeed(chunk);
          }),
          Stream.decodeText(),
          Stream.splitLines,
          Stream.rechunk(1),
          Stream.toPull
        );
        const readiness = yield* next;
        yield* decodeReady(readiness[0]).pipe(Effect.mapError(() => failure("kernel-binding")));
        yield* Deferred.succeed(ready, undefined);
        const message = yield* next;
        const batch = yield* makeBatch(message[0]);
        const receipt = yield* journal
          .acceptBatch(batch)
          .pipe(
            Effect.timeoutOrElse({ duration: acknowledgementMillis, orElse: () => Effect.fail(failure("transport")) })
          );
        const acknowledgement = yield* encodeJsonValue({
          receiptId: receipt.page.receiptId,
          accepted: receipt.accepted,
          rejected: receipt.rejected,
        });
        yield* Queue.offer(input, new TextEncoder().encode(`${acknowledgement}\n`));
        if ((yield* child.exitCode) !== 0) return yield* failure("transport");
        return receipt;
      })
    ).pipe(Effect.timeoutOrElse({ duration: lifetimeMillis, orElse: () => Effect.fail(failure("transport")) }));
    const running = yield* Effect.forkChild(
      control.run(work).pipe(
        Effect.mapError(normalizeLifecycleFailure),
        Effect.tapError((error) => Deferred.fail(ready, error)),
        Effect.tapCause(() => Deferred.fail(ready, failure("transport")))
      )
    );
    yield* Deferred.await(ready);
    return { socketPath, accept: Fiber.join(running) };
  });
  return { open };
});
