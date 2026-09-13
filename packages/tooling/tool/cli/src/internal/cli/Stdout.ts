/**
 * Console adapter that routes repo-cli output through the process streams.
 *
 * @since 0.0.0
 */

import { A, P } from "@beep/utils";
import { toStringUnknown } from "effect/Inspectable";
import * as MutableRef from "effect/MutableRef";
import type * as Console from "effect/Console";

const formatArgs = (args: ReadonlyArray<unknown>): string =>
  A.join(
    A.map(args, (arg) => (P.isString(arg) ? arg : toStringUnknown(arg))),
    " "
  );

// Count queued lines, including the active line until its final chunk callback fires.
const inflightWrites = MutableRef.make(0);
const drainWaiters = MutableRef.make<ReadonlyArray<() => void>>(A.empty());
const utf8Encoder = new TextEncoder();
const STREAM_CHUNK_SIZE_BYTES = 8 * 1024;

const settleWrite = (): void => {
  if (MutableRef.decrementAndGet(inflightWrites) > 0) {
    return;
  }
  const waiters = MutableRef.get(drainWaiters);
  MutableRef.set(drainWaiters, A.empty());
  for (const waiter of waiters) {
    waiter();
  }
};

const makeLineWriter = (stream: () => NodeJS.WriteStream) => {
  const queue = MutableRef.make<ReadonlyArray<() => void>>(A.empty());
  const startNext = (): void => {
    A.match(MutableRef.get(queue), {
      onEmpty: () => undefined,
      onNonEmpty: ([start]) => start(),
    });
  };

  return (args: ReadonlyArray<unknown>): void => {
    const bytes = utf8Encoder.encode(`${formatArgs(args)}\n`);
    const offset = MutableRef.make(0);
    const writeNext = (): void => {
      const start = MutableRef.get(offset);
      if (start >= bytes.byteLength) {
        MutableRef.update(queue, A.drop(1));
        startNext();
        settleWrite();
        return;
      }
      MutableRef.set(offset, start + STREAM_CHUNK_SIZE_BYTES);
      stream().write(bytes.subarray(start, start + STREAM_CHUNK_SIZE_BYTES), writeNext);
    };
    const idle = A.isReadonlyArrayEmpty(MutableRef.get(queue));
    MutableRef.incrementAndGet(inflightWrites);
    MutableRef.update(queue, A.append(writeNext));
    if (idle) {
      startNext();
    }
  };
};

const writeStdoutLine = makeLineWriter(() => process.stdout);
const writeStderrLine = makeLineWriter(() => process.stderr);

const noop = (): void => undefined;

/**
 * A Console whose `log`, `info`, and `debug` lines go through `process.stdout.write` and whose
 * `error`, `warn`, `trace`, and failed `assert` lines go through `process.stderr.write`. Grouping,
 * counting, and timing calls render their arguments as plain lines or nothing at all.
 *
 * **Details**
 *
 * Each stream has a FIFO queue of UTF-8 lines. Writes contain at most 8 KiB of bytes; each
 * completion callback starts the next chunk, preserving order across log calls. Large single
 * writes can lose their tail under Bun on hosted runners, even when their callback is tracked.
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
 * Continue once every line written through the stream console has reached the kernel. Used
 * before a forced process exit so a queued render is not dropped.
 *
 * **Gotchas**
 *
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
export const drainProcessStreams = (onDrained: () => void): void => {
  if (MutableRef.get(inflightWrites) === 0) {
    onDrained();
    return;
  }
  MutableRef.update(drainWaiters, A.append(onDrained));
};
