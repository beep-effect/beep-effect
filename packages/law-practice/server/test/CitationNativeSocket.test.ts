import * as NodeURL from "node:url";
import {
  acquireCitationNativeLease,
  makeCitationNativeProcessAdmission,
} from "@beep/law-practice-server/internal/Citation/NativeAdmission";
import {
  makeCitationNativeProcessOwner,
  withCitationNativeProcess,
} from "@beep/law-practice-server/internal/Citation/NativeProcess";
import { makeCitationNativeSocket } from "@beep/law-practice-server/internal/Citation/NativeSocket";
import { CitationRegexWorkerFailure } from "@beep/law-practice-server/internal/Citation/RegexWorkerProtocol";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { it } from "@beep/test-runner";
import * as BunServices from "@effect/platform-bun/BunServices";
import { expect } from "@effect/vitest";
import { assertNone, assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Deferred from "effect/Deferred";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as PlatformError from "effect/PlatformError";
import * as ChildProcess from "effect/process/ChildProcess";
import { ChildProcessSpawner } from "effect/process/ChildProcessSpawner";
import * as RpcClient from "effect/rpc/RpcClient";
import * as RpcSerialization from "effect/rpc/RpcSerialization";
import * as Schedule from "effect/Schedule";
import * as Scope from "effect/Scope";
import * as Sink from "effect/Sink";
import * as Stream from "effect/Stream";
import * as Socket from "effect/socket/Socket";
import { CitationNativeSocketTestRpcs } from "./CitationNativeSocket.protocol.ts";
import { citationBunTestExecutable, makeCitationObservedSpawner } from "./CitationNativeSpawner.fixtures.ts";
import type { CitationSafetyLimitExceeded } from "@beep/law-practice-use-cases/server";
import type { ChildProcessHandle } from "effect/process/ChildProcessSpawner";

const fail = (reason: CitationRegexWorkerFailure["reason"]) => CitationRegexWorkerFailure.make({ reason });
const serialization = RpcSerialization.layerSchemaBinary({ maxFrameSize: 262_144, fingerprintPayloads: true });
const command = Effect.fnUntraced(function* (empty = false) {
  const executable = yield* citationBunTestExecutable;
  return ChildProcess.make(
    executable,
    empty === true
      ? ["--no-env-file", "--no-install", "-e", ""]
      : [
          "--no-env-file",
          "--no-install",
          NodeURL.fileURLToPath(new URL("./CitationNativeSocket.entry.ts", import.meta.url)),
        ],
    {
      env: {},
      extendEnv: false,
      shell: false,
      detached: false,
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
      killSignal: "SIGKILL",
      forceKillAfter: Duration.zero,
    }
  );
});
const client = Effect.fnUntraced(function* (child: ChildProcessHandle) {
  const socket = yield* makeCitationNativeSocket(child);
  const context = yield* Layer.build(serialization);
  const protocol = yield* RpcClient.makeProtocolSocket({
    retryTransientErrors: false,
    retryPolicy: Schedule.recurs(0),
  }).pipe(Effect.provideService(Socket.Socket, socket), Effect.provideContext(context));
  const rpc = yield* RpcClient.make(CitationNativeSocketTestRpcs).pipe(
    Effect.provideService(RpcClient.Protocol, protocol)
  );
  // Allow the supplied protocol's scoped run fiber to register its client
  // before an immediately failing local stream can broadcast terminal status.
  yield* Effect.yieldNow;
  return rpc;
});

it.layer(BunServices.layer, { excludeTestServices: true })("owned process with supplied Effect RPC transport", (it) => {
  it.effect("preserves exact UTF-16 across repeated calls and publishes only after physical retirement", () =>
    Effect.gen(function* () {
      const { limits } = yield* defaultCitationEnginePolicy;
      const admission = yield* makeCitationNativeProcessAdmission(limits);
      const observed = yield* makeCitationObservedSpawner();
      const owner = yield* makeCitationNativeProcessOwner<CitationRegexWorkerFailure | CitationSafetyLimitExceeded>(
        limits,
        "extract",
        fail
      ).pipe(Effect.provideService(ChildProcessSpawner, observed.spawner));
      const childCommand = yield* command();
      const values = ["plain", "😀 e\u0301", "\ud800x\udc00", "\u0000\r\n", ""];
      const returned = yield* withCitationNativeProcess(
        owner,
        acquireCitationNativeLease(admission, "extract", false, fail),
        () => fail("channel-failed"),
        (operation) =>
          Effect.gen(function* () {
            yield* operation.acquire;
            const child = yield* operation.start(childCommand);
            return yield* Effect.scoped(
              Effect.gen(function* () {
                const rpc = yield* client(child);
                return yield* Effect.forEach(values, (text) => rpc.Echo({ text }), { concurrency: 1 });
              })
            );
          })
      );
      expect(returned).toEqual(values);
      const physical = yield* observed.snapshot;
      const state = yield* admission.snapshot;
      expect(physical).toEqual({ spawned: 1, confirmed: 1 });
      expect(state).toMatchObject({ active: 0, quarantined: 0 });
    })
  );
  it.effect("distinguishes a direct stdout failure from EOF without retaining private causes", () =>
    Effect.gen(function* () {
      const spawner = yield* ChildProcessSpawner;
      const childCommand = yield* command();
      const child = yield* spawner.spawn(childCommand);
      const privateError = PlatformError.systemError({
        module: "ChildProcess",
        method: "read",
        _tag: "Unknown",
        cause: "PRIVATE-STDOUT",
      });
      for (const [stdout, tag] of [
        [Stream.fail(privateError), "SocketReadError"],
        [Stream.empty, "SocketCloseError"],
      ] as const) {
        const socket = yield* makeCitationNativeSocket({ ...child, stdout });
        const reader = yield* socket.reader;
        const error = yield* reader.pull.pipe(Effect.flip);
        expect(error.reason._tag).toBe(tag);
        if (error.reason._tag === "SocketReadError") expect(error.reason.cause).toBeUndefined();
      }
    })
  );
  it.effect("writes batches in order and closes the stdin queue before rejecting later writes", () =>
    Effect.gen(function* () {
      const spawner = yield* ChildProcessSpawner;
      const childCommand = yield* command();
      const child = yield* spawner.spawn(childCommand);
      const completed = yield* Deferred.make<ReadonlyArray<Uint8Array>>();
      const stdin = Sink.collect<Uint8Array>().pipe(
        Sink.mapEffect((chunks) => Deferred.succeed(completed, chunks).pipe(Effect.asVoid))
      );
      const socket = yield* makeCitationNativeSocket({ ...child, stdin });
      const writer = yield* socket.writer;
      yield* writer.writeAll(["first", new TextEncoder().encode("second")]);
      yield* writer.write(new Socket.CloseEvent());
      const chunks = yield* Deferred.await(completed);
      expect(A.map(chunks, (chunk) => new TextDecoder().decode(chunk))).toEqual(["first", "second"]);
      const failure = yield* writer.write("PRIVATE-AFTER-CLOSE").pipe(Effect.flip);
      expect(failure.reason._tag).toBe("SocketCloseError");
    })
  );
  it.effect("bounds encoded strings and batches before queueing while allowing exact bytes and close", () =>
    Effect.gen(function* () {
      const spawner = yield* ChildProcessSpawner;
      const childCommand = yield* command();
      const child = yield* spawner.spawn(childCommand);
      const completed = yield* Deferred.make<ReadonlyArray<Uint8Array>>();
      const stdin = Sink.collect<Uint8Array>().pipe(
        Sink.mapEffect((chunks) => Deferred.succeed(completed, chunks).pipe(Effect.asVoid))
      );
      const socket = yield* makeCitationNativeSocket({ ...child, stdin }, 4);
      const writer = yield* socket.writer;
      for (const write of [writer.write("😀x"), writer.writeAll([new Uint8Array(5)])]) {
        const failure = yield* write.pipe(Effect.flip);
        expect(failure.reason._tag).toBe("SocketWriteError");
      }
      yield* writer.writeAll(["😀", new Uint8Array([1, 2, 3, 4])]);
      yield* writer.write(new Socket.CloseEvent());
      const chunks = yield* Deferred.await(completed);
      expect(A.map(chunks, (chunk) => chunk.byteLength)).toEqual([4, 4]);
    })
  );
  it.effect("keeps stdin failure sticky for a subsequent direct write", () =>
    Effect.gen(function* () {
      const spawner = yield* ChildProcessSpawner;
      const childCommand = yield* command();
      const child = yield* spawner.spawn(childCommand);
      const socket = yield* makeCitationNativeSocket({
        ...child,
        stdin: Sink.fail(
          PlatformError.systemError({
            module: "ChildProcess",
            method: "write",
            _tag: "Unknown",
            cause: "PRIVATE-STDIN",
          })
        ),
      });
      const writer = yield* socket.writer;
      const reader = yield* socket.reader;
      const first = yield* reader.pull.pipe(Effect.flip);
      expect(first.reason._tag).toBe("SocketWriteError");
      const next = yield* writer.write("PRIVATE-SOURCE").pipe(Effect.flip);
      expect(next.reason._tag).toBe("SocketWriteError");
      if (next.reason._tag === "SocketWriteError") expect(next.reason.cause).toBeUndefined();
    })
  );
  it.effect("keeps the supervisor responsive and retires a synchronously blocked child on deadline", () =>
    Effect.gen(function* () {
      const { limits } = yield* defaultCitationEnginePolicy;
      const admission = yield* makeCitationNativeProcessAdmission(limits);
      const observed = yield* makeCitationObservedSpawner();
      const owner = yield* makeCitationNativeProcessOwner<CitationRegexWorkerFailure | CitationSafetyLimitExceeded>(
        limits,
        "extract",
        fail
      ).pipe(Effect.provideService(ChildProcessSpawner, observed.spawner));
      const childCommand = yield* command();
      yield* withCitationNativeProcess(
        owner,
        acquireCitationNativeLease(admission, "extract", false, fail),
        () => fail("channel-failed"),
        (operation) =>
          Effect.gen(function* () {
            yield* operation.acquire;
            const child = yield* operation.start(childCommand);
            yield* Effect.scoped(
              Effect.gen(function* () {
                const rpc = yield* client(child);
                const echoed = yield* rpc.Echo({ text: "ready" });
                expect(echoed).toBe("ready");
                const blocked = yield* rpc.Busy().pipe(Effect.forkChild);
                const marker = yield* Stream.runHead(child.stderr).pipe(Effect.timeout(Duration.seconds(5)));
                assertTrue(O.isSome(marker));
                const running = yield* child.isRunning;
                expect(running).toBe(true);
                const result = yield* Fiber.join(blocked).pipe(Effect.timeoutOption(Duration.millis(100)));
                assertNone(result);
              })
            );
          })
      );
      const physical = yield* observed.snapshot;
      const state = yield* admission.snapshot;
      expect(physical).toEqual({ spawned: 1, confirmed: 1 });
      expect(state).toMatchObject({ active: 0, quarantined: 0 });
    })
  );
  it.effect("physically retires non-cooperative work when its caller cancels", () =>
    Effect.gen(function* () {
      const { limits } = yield* defaultCitationEnginePolicy;
      const admission = yield* makeCitationNativeProcessAdmission(limits);
      const observed = yield* makeCitationObservedSpawner();
      const owner = yield* makeCitationNativeProcessOwner<CitationRegexWorkerFailure | CitationSafetyLimitExceeded>(
        limits,
        "extract",
        fail
      ).pipe(Effect.provideService(ChildProcessSpawner, observed.spawner));
      const childCommand = yield* command();
      const ready = yield* Deferred.make<void>();
      const running = yield* withCitationNativeProcess(
        owner,
        acquireCitationNativeLease(admission, "extract", false, fail),
        () => fail("channel-failed"),
        (operation) =>
          Effect.gen(function* () {
            yield* operation.acquire;
            const child = yield* operation.start(childCommand);
            yield* Effect.scoped(
              Effect.gen(function* () {
                const rpc = yield* client(child);
                yield* rpc.Echo({ text: "ready" });
                const busy = yield* rpc.Busy().pipe(Effect.forkChild);
                const marker = yield* Stream.runHead(child.stderr).pipe(Effect.timeout(Duration.seconds(5)));
                assertTrue(O.isSome(marker));
                yield* Deferred.succeed(ready, undefined);
                yield* Fiber.join(busy);
              })
            );
          })
      ).pipe(Effect.forkChild);
      // The child's test-only stderr marker confirms entry into the synchronous
      // handler. Interrupt the owning invocation, then inspect its terminal Exit.
      yield* Deferred.await(ready);
      yield* Fiber.interrupt(running);
      const exit = yield* Fiber.await(running);
      expect(Exit.hasInterrupts(exit)).toBe(true);
      const physical = yield* observed.snapshot;
      const state = yield* admission.snapshot;
      expect(physical).toEqual({ spawned: 1, confirmed: 1 });
      expect(state).toMatchObject({ active: 0, quarantined: 0 });
    })
  );
  it.effect("wakes an independently suspended pull when only its reader scope closes", () =>
    Effect.gen(function* () {
      const spawner = yield* ChildProcessSpawner;
      const childCommand = yield* command();
      const child = yield* spawner.spawn(childCommand);
      const socket = yield* makeCitationNativeSocket(child);
      const readerScope = yield* Scope.make();
      const reader = yield* socket.reader.pipe(Effect.provideService(Scope.Scope, readerScope));
      const pending = yield* reader.pull.pipe(Effect.result, Effect.forkChild);
      yield* Effect.yieldNow;
      yield* Scope.close(readerScope, Exit.void);
      const result = yield* Fiber.join(pending).pipe(Effect.timeout(Duration.seconds(1)));
      expect(result._tag).toBe("Failure");
      const running = yield* child.isRunning;
      expect(running).toBe(true);
    })
  );
  it.effect("fails a pending RPC on stdin failure while stdout and the child remain open", () =>
    Effect.gen(function* () {
      const spawner = yield* ChildProcessSpawner;
      const childCommand = yield* command();
      const child = yield* spawner.spawn(childCommand);
      let refuse = false;
      const rpc = yield* client({
        ...child,
        stdin: child.stdin.pipe(
          Sink.mapInputEffect((bytes: Uint8Array) =>
            Effect.suspend(() =>
              refuse
                ? Effect.fail(PlatformError.systemError({ module: "ChildProcess", method: "write", _tag: "Unknown" }))
                : Effect.succeed(bytes)
            )
          )
        ),
      });
      const ready = yield* rpc.Echo({ text: "ready" });
      expect(ready).toBe("ready");
      refuse = true;
      const failure = yield* rpc
        .Echo({ text: "private-source" })
        .pipe(Effect.flip, Effect.timeout(Duration.seconds(1)));
      expect(failure._tag).toBe("RpcClientError");
      expect(failure.message).not.toContain("private-source");
      const running = yield* child.isRunning;
      expect(running).toBe(true);
    })
  );
  it.effect("rejects a call after the stdin consumer fails during connection setup", () =>
    Effect.gen(function* () {
      const spawner = yield* ChildProcessSpawner;
      const childCommand = yield* command();
      const child = yield* spawner.spawn(childCommand);
      const rpc = yield* client({
        ...child,
        stdin: Sink.fail(PlatformError.systemError({ module: "ChildProcess", method: "write", _tag: "Unknown" })),
      });
      const exit = yield* rpc.Echo({ text: "private-source" }).pipe(Effect.exit, Effect.timeout(Duration.seconds(1)));
      expect(exit._tag).toBe("Failure");
    })
  );
  it.effect("bounds queued writes and releases a suspended offer when its writer scope closes", () =>
    Effect.gen(function* () {
      const spawner = yield* ChildProcessSpawner;
      const childCommand = yield* command();
      const child = yield* spawner.spawn(childCommand);
      // Deliberately withhold sink consumption to isolate adapter backpressure.
      const socket = yield* makeCitationNativeSocket({ ...child, stdin: Sink.never.pipe(Sink.map(() => undefined)) });
      const writerScope = yield* Scope.make();
      const writer = yield* socket.writer.pipe(Effect.provideService(Scope.Scope, writerScope));
      yield* Effect.forEach(A.range(1, 8), () => writer.write("queued"), { concurrency: 1, discard: true });
      const completed = yield* Deferred.make<void>();
      const pending = yield* writer
        .write("ninth")
        .pipe(Effect.ensuring(Deferred.succeed(completed, undefined)), Effect.result, Effect.forkChild);
      yield* Effect.yieldNow;
      const before = yield* Deferred.isDone(completed);
      expect(before).toBe(false);
      yield* Scope.close(writerScope, Exit.void);
      const result = yield* Fiber.join(pending).pipe(Effect.timeout(Duration.seconds(1)));
      expect(result._tag).toBe("Failure");
    })
  );
  it.effect("fails an in-flight request when stdout closes without a reply", () =>
    Effect.gen(function* () {
      const spawner = yield* ChildProcessSpawner;
      const childCommand = yield* command(true);
      const child = yield* spawner.spawn(childCommand);
      const rpc = yield* client(child);
      const failure = yield* rpc
        .Echo({ text: "private-source" })
        .pipe(Effect.flip, Effect.timeout(Duration.seconds(5)));
      expect(failure._tag).toBe("RpcClientError");
      expect(failure.message).not.toContain("private-source");
    })
  );
});
