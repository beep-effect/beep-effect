/**
 * Effect Socket adapter for an already-owned child process's byte streams.
 * RPC envelopes, request routing, codecs and framing belong to Effect RPC.
 * Physical retirement and transferred permits remain with NativeProcess.
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */
import * as Cause from "effect/Cause";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as P from "effect/Predicate";
import * as Queue from "effect/Queue";
import * as Stream from "effect/Stream";
import * as Socket from "effect/socket/Socket";
import type { ChildProcessHandle } from "effect/process/ChildProcessSpawner";

const encoder = new TextEncoder();
// Transport errors deliberately discard platform causes and process/source data.
const closed = () => Socket.SocketError.make({ reason: Socket.SocketCloseError.make({ code: 1006 }) });
const readFailed = () => Socket.SocketError.make({ reason: Socket.SocketReadError.make({ cause: undefined }) });
const writeFailed = () => Socket.SocketError.make({ reason: Socket.SocketWriteError.make({ cause: undefined }) });

/**
 * Connect Effect RPC's supplied socket protocol to an owned process. A single
 * scoped writer preserves stdin across messages and applies bounded queue
 * backpressure; write failures also fail reads so pending calls cannot hang.
 * This adapter neither starts nor kills the child and supplies no exit receipt.
 * @internal
 * @category operations
 * @since 0.0.0
 */
export const makeCitationNativeSocket = Effect.fn("Citation.makeNativeSocket")(function* (child: ChildProcessHandle) {
  const failed = yield* Deferred.make<never, Socket.SocketError>();
  const failure = Deferred.await(failed);
  const healthy = Deferred.isDone(failed).pipe(Effect.flatMap((done) => (done ? failure : Effect.void)));
  return Socket.make({
    reader: Effect.gen(function* () {
      const readerClosed = yield* Deferred.make<never, Socket.SocketError>();
      const pull = yield* Stream.toPull(child.stdout);
      yield* Effect.addFinalizer(() => Deferred.fail(readerClosed, closed()));
      return {
        pull: pull.pipe(
          Effect.mapError((error) => (Cause.isDone(error) ? closed() : readFailed())),
          Effect.raceFirst(failure),
          Effect.raceFirst(Deferred.await(readerClosed))
        ),
        upgrade: Socket.SocketUpgradeError.unsupported,
      };
    }),
    writer: Effect.gen(function* () {
      const queue = yield* Queue.bounded<Uint8Array, Cause.Done>(8);
      yield* Effect.addFinalizer(() => Deferred.fail(failed, closed()));
      yield* Stream.fromQueue(queue).pipe(
        Stream.run(child.stdin),
        Effect.catchCause(() => Deferred.fail(failed, writeFailed())),
        Effect.forkScoped
      );
      const write = Effect.fnUntraced(function* (chunk: Uint8Array | string | Socket.CloseEvent) {
        yield* healthy;
        if (Socket.isCloseEvent(chunk)) {
          yield* Queue.end(queue);
          return;
        }
        const bytes = P.isString(chunk) ? encoder.encode(chunk) : chunk;
        const offered = yield* Queue.offer(queue, bytes).pipe(Effect.raceFirst(failure));
        if (!offered) return yield* closed();
        yield* healthy;
      });
      return {
        write,
        writeAll: Effect.fnUntraced(function* (chunks: ReadonlyArray<Uint8Array | string>) {
          yield* Effect.forEach(chunks, write, { concurrency: 1, discard: true });
        }),
      };
    }),
  });
});
