/**
 * Console adapter that routes repo-cli output through the process streams.
 *
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { A, P } from "@beep/utils";
import { dual } from "effect/Function";
import { toStringUnknown } from "effect/Inspectable";
import * as MutableRef from "effect/MutableRef";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import type * as Console from "effect/Console";

const $I = $RepoCliId.create("internal/cli/Stdout");

/**
 * Identifies the independent process output FIFOs.
 *
 * **Example** (Identify stdout)
 *
 * ```ts
 * import { ProcessStreamName } from "@beep/repo-cli/test/Cli"
 *
 * console.log(ProcessStreamName.is.stdout("stdout")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ProcessStreamName = LiteralKit(["stdout", "stderr"]).pipe(
  $I.annoteSchema("ProcessStreamName", { description: "Process output stream owning an independent line FIFO." })
);

/**
 * A process output stream name.
 *
 * **Example** (Choose an output stream)
 *
 * ```ts
 * import type { ProcessStreamName } from "@beep/repo-cli/test/Cli"
 *
 * const stream: ProcessStreamName = "stdout"
 * console.log(stream)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ProcessStreamName = typeof ProcessStreamName.Type;

/**
 * Records the first write error on a stream and the number of abandoned lines, including the aborted line.
 *
 * **Details**
 *
 * First means the first error recorded by a line's failure path, latched at the `fail` boundary.
 * A line whose callback completed before its write threw is delivered and records nothing.
 * Later lines on that stream are counted, never re-recorded.
 *
 * **Example** (Describe a lost line)
 *
 * ```ts
 * import { StreamWriteFailure } from "@beep/repo-cli/test/Cli"
 *
 * const failure = StreamWriteFailure.make({ stream: "stdout", message: "EPIPE", droppedLines: 1 })
 * console.log(failure.droppedLines) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class StreamWriteFailure extends S.Class<StreamWriteFailure>($I`StreamWriteFailure`)(
  { stream: ProcessStreamName, message: S.String, droppedLines: S.Int.check(S.isGreaterThan(0)) },
  $I.annote("StreamWriteFailure", { description: "First process stream write error and count of abandoned lines." })
) {}

const formatArgs = (args: ReadonlyArray<unknown>): string =>
  A.join(
    A.map(args, (arg) => (P.isString(arg) ? arg : toStringUnknown(arg))),
    " "
  );

const causeMessage = (cause: unknown): string => (cause instanceof Error ? cause.message : String(cause));

/**
 * Writes one chunk and reports its completion exactly once, as an optional error message.
 *
 * **Details**
 *
 * The stream callback may fire more than once or not at all, and `write` may throw synchronously
 * before the callback is registered. This helper collapses all of those into a single `onDone`
 * call: a duplicate callback is ignored, and a synchronous throw is reported as `O.some(message)`.
 * Both the console line writers and the JSON stdout writer chunk through it.
 *
 * **Example** (Write one chunk and observe its completion)
 *
 * ```ts
 * import { writeChunkOnce } from "@beep/repo-cli/test/Cli"
 * import * as O from "effect/Option"
 *
 * writeChunkOnce(process.stdout, new TextEncoder().encode("hello\n"), (failure) => {
 *   console.log(O.isNone(failure))
 * })
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export const writeChunkOnce: {
  (chunk: Uint8Array, onDone: (failure: O.Option<string>) => void): (stream: NodeJS.WriteStream) => void;
  (stream: NodeJS.WriteStream, chunk: Uint8Array, onDone: (failure: O.Option<string>) => void): void;
} = dual(3, (stream: NodeJS.WriteStream, chunk: Uint8Array, onDone: (failure: O.Option<string>) => void): void => {
  const called = MutableRef.make(false);
  const settle = (failure: O.Option<string>): void => {
    if (MutableRef.get(called)) {
      return;
    }
    MutableRef.set(called, true);
    onDone(failure);
  };
  try {
    stream.write(chunk, (error?: Error | null) => settle(O.map(O.fromNullishOr(error), (cause) => cause.message)));
  } catch (cause) {
    settle(O.some(causeMessage(cause)));
  }
});

// Count queued lines, including the active line until its final chunk callback fires.
const inflightWrites = MutableRef.make(0);
const drainWaiters = MutableRef.make<ReadonlyArray<() => void>>(A.empty());
const utf8Encoder = new TextEncoder();
const STREAM_CHUNK_SIZE_BYTES = 8 * 1024;

const settleWrite = (): void => {
  MutableRef.update(inflightWrites, (n) => Math.max(0, n - 1));
  if (MutableRef.get(inflightWrites) > 0) {
    return;
  }
  const waiters = MutableRef.get(drainWaiters);
  MutableRef.set(drainWaiters, A.empty());
  for (const waiter of waiters) {
    waiter();
  }
};

const makeLineWriter = (name: ProcessStreamName, stream: () => NodeJS.WriteStream, marker: (line: string) => void) => {
  const queue = MutableRef.make<ReadonlyArray<() => void>>(A.empty());
  const failure = MutableRef.make<O.Option<StreamWriteFailure>>(O.none());
  const failed = (): boolean => failure.pipe(MutableRef.get, O.isSome);
  const dropLine = (): void => {
    MutableRef.update(
      failure,
      O.map((value) =>
        StreamWriteFailure.make({
          ...value,
          droppedLines: value.droppedLines + 1,
        })
      )
    );
  };
  const recordFailure = (message: string): void => {
    MutableRef.set(failure, O.some(StreamWriteFailure.make({ stream: name, message, droppedLines: 1 })));
    marker(`[beep-cli] ${name} write failed: ${message}; later ${name} lines are dropped`);
  };
  const startNext = (): void => {
    A.match(MutableRef.get(queue), {
      onEmpty: () => undefined,
      onNonEmpty: ([start]) => start(),
    });
  };

  const write = (args: ReadonlyArray<unknown>): void => {
    MutableRef.incrementAndGet(inflightWrites);
    if (failed()) {
      dropLine();
      settleWrite();
      return;
    }
    const bytes = utf8Encoder.encode(`${formatArgs(args)}\n`);
    const offset = MutableRef.make(0);
    // writeChunkOnce reports each chunk exactly once, so a line reaches fail or
    // complete at most once; a done flag here would never be read.
    const complete = (): void => {
      // Drop this line only if it is the head, without a separate branch.
      MutableRef.update(
        queue,
        A.dropWhile((line) => line === start)
      );
      startNext();
      settleWrite();
    };
    const fail = (message: string): void => {
      recordFailure(message);
      complete();
    };
    const writeNext = (failure: O.Option<string>): void => {
      if (O.isSome(failure)) {
        fail(failure.value);
        return;
      }
      if (failed()) {
        dropLine();
        complete();
        return;
      }
      const start = MutableRef.get(offset);
      if (start >= bytes.byteLength) {
        complete();
        return;
      }
      MutableRef.set(offset, start + STREAM_CHUNK_SIZE_BYTES);
      // Each chunk owns its once-only completion; a duplicate callback must not advance a later chunk.
      writeChunkOnce(stream(), bytes.subarray(start, start + STREAM_CHUNK_SIZE_BYTES), writeNext);
    };
    const idle = A.isReadonlyArrayEmpty(MutableRef.get(queue));
    const start = (): void => writeNext(O.none());
    MutableRef.update(queue, A.append(start));
    if (idle) {
      startNext();
    }
  };
  return { write, failure, failed, recordFailure };
};

const stdoutWriter = makeLineWriter(
  "stdout",
  () => process.stdout,
  (line) => {
    if (!stderrWriter.failed()) {
      stderrWriter.write([line]);
    }
  }
);
const stderrWriter = makeLineWriter(
  "stderr",
  () => process.stderr,
  (line) => {
    if (!stdoutWriter.failed()) {
      stdoutWriter.write([line]);
    }
  }
);
const writeStdoutLine = stdoutWriter.write;
const writeStderrLine = stderrWriter.write;
const currentFailure = (): O.Option<StreamWriteFailure> =>
  O.orElse(MutableRef.get(stdoutWriter.failure), () => MutableRef.get(stderrWriter.failure));

/**
 * Writes a raw teardown notice, falling back to the other stream after a synchronous throw.
 *
 * **Details**
 *
 * These best-effort writes are untracked. A write accepted with backpressure still returns true;
 * false means both streams threw synchronously.
 *
 * **Example** (Send a teardown notice)
 *
 * ```ts
 * import { writeBestEffortLine } from "@beep/repo-cli/test/Cli"
 *
 * const accepted = writeBestEffortLine(process.stderr, process.stdout, "exiting\n")
 * console.log(accepted)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export const writeBestEffortLine: {
  (fallback: NodeJS.WriteStream, line: string): (preferred: NodeJS.WriteStream) => boolean;
  (preferred: NodeJS.WriteStream, fallback: NodeJS.WriteStream, line: string): boolean;
} = dual(3, (preferred: NodeJS.WriteStream, fallback: NodeJS.WriteStream, line: string): boolean => {
  try {
    preferred.write(line);
    return true;
  } catch {
    try {
      fallback.write(line);
      return true;
    } catch {
      return false;
    }
  }
});

/**
 * Records an external writer's first failure and sends the existing marker to the sibling stream.
 *
 * **Details**
 *
 * The first failure counts one dropped line. Repeated notifications on a failed stream do nothing.
 * The drain reports this record alongside failures from the console line writers.
 *
 * **Example** (Report a failed stdout payload)
 *
 * ```ts
 * import { noteProcessStreamWriteFailure, drainProcessStreams } from "@beep/repo-cli/test/Cli"
 *
 * noteProcessStreamWriteFailure("stdout", "EPIPE")
 * drainProcessStreams((failure) => console.log(failure))
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export const noteProcessStreamWriteFailure: {
  (message: string): (stream: ProcessStreamName) => void;
  (stream: ProcessStreamName, message: string): void;
} = dual(2, (stream: ProcessStreamName, message: string): void => {
  const writer = ProcessStreamName.is.stdout(stream) ? stdoutWriter : stderrWriter;
  if (!writer.failed()) {
    writer.recordFailure(message);
  }
});

/**
 * Clears process stream failure records and their dropped-line counts between tests.
 *
 * **Gotchas**
 *
 * Call only when both queues and the in-flight counter are empty.
 *
 * **Example** (Reset after draining a test)
 *
 * ```ts
 * import { drainProcessStreams, resetProcessStreamStateForTesting } from "@beep/repo-cli/test/Cli"
 *
 * drainProcessStreams(() => {
 *   resetProcessStreamStateForTesting()
 *   console.log("stream state reset")
 * })
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const resetProcessStreamStateForTesting = (): void => {
  MutableRef.set(stdoutWriter.failure, O.none());
  MutableRef.set(stderrWriter.failure, O.none());
};

const noop = (): void => undefined;

/**
 * A Console whose `log`, `info`, and `debug` lines go through `process.stdout.write` and whose
 * `error`, `warn`, `trace`, and failed `assert` lines go through `process.stderr.write`. Grouping,
 * counting, and timing calls render their arguments as plain lines or nothing at all.
 *
 * **Details**
 *
 * Each stream has a FIFO queue of UTF-8 lines. Writes contain at most 8 KiB of bytes; each
 * completion callback starts the next chunk, preserving order across log calls on the same stream;
 * stdout and stderr are independent FIFOs, with one exception: a write failure on one stream enqueues
 * its marker line on the other stream's FIFO, where it is chunked, tracked by the drain, and counted
 * as a dropped line if that stream fails before the marker is written. Before chunking, a single
 * multi-megabyte write lost its tail under Bun on hosted runners even with its callback tracked;
 * the bounded chunks and per-stream FIFO exist to remove that hazard.
 *
 * **Example** (Provide the stream console to a program)
 *
 * ```ts
 * import { streamConsole } from "@beep/repo-cli/test/Cli"
 * import { Console, Effect } from "effect"
 *
 * const program = Console.log("hello").pipe(Effect.provideService(Console.Console, streamConsole))
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export const streamConsole: Console.Console = {
  assert: (condition, ...args) => {
    if (!condition) {
      writeStderrLine(["Assertion failed:", ...args]);
    }
  },
  clear: noop,
  count: noop,
  countReset: noop,
  debug: (...args) => writeStdoutLine(args),
  dir: (item) => writeStdoutLine([item]),
  dirxml: (...args) => writeStdoutLine(args),
  error: (...args) => writeStderrLine(args),
  group: (...args) => writeStdoutLine(args),
  groupCollapsed: (...args) => writeStdoutLine(args),
  groupEnd: noop,
  info: (...args) => writeStdoutLine(args),
  log: (...args) => writeStdoutLine(args),
  table: (tabularData) => writeStdoutLine([tabularData]),
  time: noop,
  timeEnd: noop,
  timeLog: (label, ...args) => writeStdoutLine([label, ...args]),
  trace: (...args) => writeStderrLine(args),
  warn: (...args) => writeStderrLine(args),
};

/**
 * Continue once every tracked line has reached the kernel or been abandoned after a write error. Used
 * before a forced process exit so a queued render is not dropped.
 *
 * **Details**
 *
 * Reports the first failure, preferring stdout when both streams fail, or `O.none()` on success.
 *
 * **Gotchas**
 *
 * There is no watchdog or timeout: a slow pipe reader is legitimate backpressure, and the CLI
 * must not truncate its own output on a timer. A missing callback therefore keeps the drain pending.
 * Only writes made through `streamConsole` are tracked; a raw `process.stdout.write` elsewhere
 * is not waited for. When nothing is in flight the continuation runs synchronously.
 *
 * **Example** (Drain before exiting)
 *
 * ```ts
 * import { drainProcessStreams } from "@beep/repo-cli/test/Cli"
 *
 * drainProcessStreams(() => console.log("drained"))
 * ```
 *
 * @param onDrained - Continuation invoked once every tracked write has completed.
 * @category services
 * @since 0.0.0
 */
export const drainProcessStreams = (onDrained: (failure: O.Option<StreamWriteFailure>) => void): void => {
  if (MutableRef.get(inflightWrites) === 0) {
    onDrained(currentFailure());
    return;
  }
  MutableRef.update(
    drainWaiters,
    A.append(() => onDrained(currentFailure()))
  );
};
