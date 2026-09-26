/**
 * Chain folding over immutable ledger rows linked by `previousRowId`.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

import { A, O } from "@beep/utils";
import { dual } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import type { HarnessLedgerRow } from "@beep/repo-ai-metrics";

/**
 * Ids of every row some later row supersedes.
 *
 * @internal
 * @param rows - Ledger rows in any order; only their `previousRowId` links are read.
 * @returns The `rowId` of every row named as a predecessor, i.e. every row that is no longer a chain head.
 * @category queries
 * @since 0.0.0
 */
export const supersededRowIds = (rows: ReadonlyArray<HarnessLedgerRow>): HashSet.HashSet<string> =>
  HashSet.fromIterable(A.getSomes(A.map(rows, (row) => row.previousRowId)));

/**
 * The row that supersedes `rowId`, when one exists.
 *
 * @internal
 * @category queries
 * @since 0.0.0
 */
export const successorOf: {
  (rowId: string): (rows: ReadonlyArray<HarnessLedgerRow>) => O.Option<HarnessLedgerRow>;
  (rows: ReadonlyArray<HarnessLedgerRow>, rowId: string): O.Option<HarnessLedgerRow>;
} = dual(
  2,
  (rows: ReadonlyArray<HarnessLedgerRow>, rowId: string): O.Option<HarnessLedgerRow> =>
    A.findFirst(rows, (row) => O.contains(row.previousRowId, rowId))
);

/**
 * The latest row of every chain, in ledger order.
 *
 * @internal
 * @param rows - Ledger rows in ledger (file) order.
 * @returns The rows no later row supersedes, keeping their original relative order.
 * @category queries
 * @since 0.0.0
 */
export const chainHeads = (rows: ReadonlyArray<HarnessLedgerRow>): ReadonlyArray<HarnessLedgerRow> => {
  const superseded = supersededRowIds(rows);
  return A.filter(rows, (row) => !HashSet.has(superseded, row.rowId));
};

/**
 * Number of rows in the chain ending at `head`.
 *
 * **Details**
 *
 * Walks `previousRowId` links back from `head`, stopping at a missing
 * predecessor and after at most `rows.length` steps so a malformed cycle
 * terminates.
 *
 * @internal
 * @category queries
 * @since 0.0.0
 */
export const chainLength: {
  (head: HarnessLedgerRow): (rows: ReadonlyArray<HarnessLedgerRow>) => number;
  (rows: ReadonlyArray<HarnessLedgerRow>, head: HarnessLedgerRow): number;
} = dual(2, (rows: ReadonlyArray<HarnessLedgerRow>, head: HarnessLedgerRow): number => {
  const byId = HashMap.fromIterable(A.map(rows, (row) => [row.rowId, row] as const));
  let length = 1;
  let cursor = head.previousRowId;
  // Bounded by the row count so a malformed cycle cannot loop forever.
  while (O.isSome(cursor) && length <= A.length(rows)) {
    const previous = HashMap.get(byId, cursor.value);
    if (O.isNone(previous)) {
      break;
    }
    length += 1;
    cursor = previous.value.previousRowId;
  }
  return length;
});
