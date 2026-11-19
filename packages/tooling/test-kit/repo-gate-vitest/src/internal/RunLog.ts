/**
 * The raw log a test run writes beside its record. A reporter never sees
 * the process streams, so the log holds what Vitest handed the reporter:
 * the lines the tests printed through `console`, up to a bound, then every
 * failed item in full (message, diff and stack), which the console prints
 * only in part.
 *
 * @since 0.0.0
 */
import { plural } from "@beep/gate-report/Format";
import { ItemOutcome } from "@beep/gate-report/Vocabulary";
import * as A from "effect/Array";
import { dual, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Str from "effect/String";
import type { GateReport } from "@beep/gate-report/GateReport";
import type { Item } from "@beep/gate-report/Item";
import type { VitestConsoleLog } from "./VitestShapes.ts";

const consoleLine = (log: VitestConsoleLog): string =>
  `[${log.type}] ${Str.endsWith("\n")(log.content) ? log.content : `${log.content}\n`}`;

/**
 * How many characters of console lines one run's log keeps: 1 MiB of text.
 *
 * @since 0.0.0
 */
export const MAX_CONSOLE_CHARS = 1_048_576;

/**
 * The console lines of the current run, held in bounded memory.
 *
 * @since 0.0.0
 */
export type ConsoleLogBuffer = {
  /** Keep one console line, or count it once the bound is reached. */
  readonly add: (log: VitestConsoleLog) => void;
  /** The kept lines, then one line naming what was dropped, if anything was. */
  readonly text: () => string;
  /** Forget everything: a new run starts. */
  readonly reset: () => void;
};

/**
 * Make a {@link ConsoleLogBuffer} holding at most `maxChars` characters.
 *
 * **Details**
 *
 * Lines are kept whole and in order until the next one would pass the
 * bound. From then on every line is dropped and only counted, so the log
 * holds an unbroken start of the run's output and one closing line with the
 * number of lines and characters it does not hold.
 *
 * @since 0.0.0
 */
export const makeConsoleLogBuffer = (maxChars: number = MAX_CONSOLE_CHARS): ConsoleLogBuffer => {
  const state = { lines: A.empty<string>(), chars: 0, droppedLines: 0, droppedChars: 0 };
  const droppedNote = (): string =>
    state.droppedLines === 0
      ? ""
      : `[gate] not recorded past the ${maxChars}-character bound: ${plural({ count: state.droppedLines, one: "console line", other: "console lines" })}, ${plural({ count: state.droppedChars, one: "character", other: "characters" })}\n`;
  return {
    add: (log) => {
      const line = consoleLine(log);
      if (state.droppedLines === 0 && state.chars + line.length <= maxChars) {
        state.lines.push(line);
        state.chars += line.length;
        return;
      }
      state.droppedLines += 1;
      state.droppedChars += line.length;
    },
    text: () => `${A.join(state.lines, "")}${droppedNote()}`,
    reset: () => {
      state.lines = [];
      state.chars = 0;
      state.droppedLines = 0;
      state.droppedChars = 0;
    },
  };
};

const itemTitle = (item: Item): string => A.join([item.unit, ...item.path, item.name], " > ");

const itemBlock = (item: Item): string =>
  A.join(
    [
      `FAIL ${itemTitle(item)}`,
      ...pipe(
        item.detail,
        O.toArray,
        A.flatMap((detail) => [detail.message, ...O.toArray(detail.diff), ...O.toArray(detail.stack)])
      ),
      "",
    ],
    "\n"
  );

/**
 * The log text of one run: its console text, then its failed items in
 * full. A green run with no console output has an empty log.
 *
 * @since 0.0.0
 */
export const runLogText: {
  (consoleText: string): (report: GateReport) => string;
  (report: GateReport, consoleText: string): string;
} = dual(
  2,
  (report: GateReport, consoleText: string): string =>
    `${consoleText}${A.join(
      A.map(
        A.filter(report.items, (item) => ItemOutcome.is.failed(item.outcome)),
        (item) => `${itemBlock(item)}\n`
      ),
      ""
    )}`
);
