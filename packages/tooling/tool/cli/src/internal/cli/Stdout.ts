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

// Every line written through the stream console registers its completion callback here so the
// exit drain can wait for the bytes to reach the kernel. An empty write's callback is no barrier
// under Bun (a 1 MiB block lost everything past 128 KiB at exit); a real write's callback is.
const inflightWrites = MutableRef.make(0);
const drainWaiters = MutableRef.make<ReadonlyArray<() => void>>(A.empty());

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

const writeLine = (stream: NodeJS.WriteStream, args: ReadonlyArray<unknown>): void => {
  MutableRef.incrementAndGet(inflightWrites);
  stream.write(`${formatArgs(args)}\n`, settleWrite);
};

const noop = (): void => undefined;

/**
 * A Console whose `log`, `info`, and `debug` lines go through `process.stdout.write` and whose
 * `error`, `warn`, `trace`, and failed `assert` lines go through `process.stderr.write`. Grouping,
 * counting, and timing calls render their arguments as plain lines or nothing at all.
 *
 * **Details**
 *
 * The stream path queues a write the kernel pipe buffer cannot take and drains it from the event
 * loop, so a large rendered block arrives whole. A hosted runner kept exactly the first 64 KiB of
 * one `console.log` and dropped the rest, including the Turbo footer naming the failed task.
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
      writeLine(process.stderr, ["Assertion failed:", ...args]);
    }
  },
  clear: noop,
  count: noop,
  countReset: noop,
  debug: (...args) => writeLine(process.stdout, args),
  dir: (item) => writeLine(process.stdout, [item]),
  dirxml: (...args) => writeLine(process.stdout, args),
  error: (...args) => writeLine(process.stderr, args),
  group: (...args) => writeLine(process.stdout, args),
  groupCollapsed: (...args) => writeLine(process.stdout, args),
  groupEnd: noop,
  info: (...args) => writeLine(process.stdout, args),
  log: (...args) => writeLine(process.stdout, args),
  table: (tabularData) => writeLine(process.stdout, [tabularData]),
  time: noop,
  timeEnd: noop,
  timeLog: (label, ...args) => writeLine(process.stdout, [label, ...args]),
  trace: (...args) => writeLine(process.stderr, args),
  warn: (...args) => writeLine(process.stderr, args),
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
