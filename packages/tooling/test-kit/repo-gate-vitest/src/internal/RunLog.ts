/**
 * The raw log a test run writes beside its record. A reporter never sees
 * the process streams, so the log holds what Vitest handed the reporter:
 * every line the tests printed through `console`, then every failed item in
 * full (message, diff and stack), which the console prints only in part.
 *
 * @since 0.0.0
 */
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
 * The log text of one run: its console lines, then its failed items in
 * full. A green run with no console output has an empty log.
 *
 * @since 0.0.0
 */
export const runLogText: {
  (logs: ReadonlyArray<VitestConsoleLog>): (report: GateReport) => string;
  (report: GateReport, logs: ReadonlyArray<VitestConsoleLog>): string;
} = dual(
  2,
  (report: GateReport, logs: ReadonlyArray<VitestConsoleLog>): string =>
    `${A.join(A.map(logs, consoleLine), "")}${A.join(
      A.map(
        A.filter(report.items, (item) => ItemOutcome.is.failed(item.outcome)),
        (item) => `${itemBlock(item)}\n`
      ),
      ""
    )}`
);
