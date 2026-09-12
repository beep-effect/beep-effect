/**
 * Console adapter that routes repo-cli output through the process streams.
 *
 * @since 0.0.0
 */

import { A, P } from "@beep/utils";
import { toStringUnknown } from "effect/Inspectable";
import type * as Console from "effect/Console";

const formatArgs = (args: ReadonlyArray<unknown>): string =>
  A.join(
    A.map(args, (arg) => (P.isString(arg) ? arg : toStringUnknown(arg))),
    " "
  );

const writeLine = (stream: NodeJS.WriteStream, args: ReadonlyArray<unknown>): void => {
  stream.write(`${formatArgs(args)}\n`);
};

const noop = (): void => undefined;

/**
 * A Console whose `log`, `info`, and `debug` lines go through `process.stdout.write` and whose
 * `error`, `warn`, `trace`, and failed `assert` lines go through `process.stderr.write`. Grouping,
 * counting, and timing calls render their arguments as plain lines or nothing at all.
 *
 * **Example** (Provide the stream console to a program)
 *
 * ```ts
 * import { streamConsole } from "@beep/repo-cli/internal/cli/Stdout"
 * import { Console, Effect } from "effect"
 *
 * const program = Console.log("hello").pipe(Effect.provideService(Console.Console, streamConsole))
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * **Details**
 *
 * The stream path queues a write the kernel pipe buffer cannot take and drains it from the event
 * loop, so a large rendered block arrives whole. A hosted runner kept exactly the first 64 KiB of
 * one `console.log` and dropped the rest, including the Turbo footer naming the failed task.
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
 * Wait until every write already queued on stdout and stderr has been handed to the kernel, then
 * continue. Used before a forced process exit so a queued render is not dropped.
 *
 * **Example** (Drain before exiting)
 *
 * ```ts
 * import { drainProcessStreams } from "@beep/repo-cli/internal/cli/Stdout"
 *
 * drainProcessStreams(() => console.log("drained"))
 * ```
 *
 * @param onDrained - Continuation invoked once both streams report their queues flushed.
 * @category services
 * @since 0.0.0
 */
export const drainProcessStreams = (onDrained: () => void): void => {
  process.stdout.write("", () => {
    process.stderr.write("", () => onDrained());
  });
};
