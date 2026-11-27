import * as A from "effect/Array";
import * as Result from "effect/Result";
import { ListTruncated, XlsxKeptList, XlsxWarning } from "../XlsxDiagnostic.schema.ts";
import type { Caps } from "./container.ts";

/**
 * One read's caps on the lists it keeps, what each has used, and the warnings kept so far.
 *
 * **Details**
 *
 * Every sheet reader of a read is handed the same budget, so a file that names one part from many sheets, or holds
 * many parts, still meets one cap on each list (`XlsxLimits`). An item past its list's cap is dropped and counted,
 * and the warnings end with one `ListTruncated` per list that dropped any.
 *
 * **Gotchas**
 *
 * One budget belongs to one read and is never shared between reads.
 */
// decision: hot-paths-are-mutable-loops
export class ReadBudget {
  /** The stamp each column was last given; a column holding the current row's stamp already has a cell. */
  private readonly stamps: Uint32Array;
  private stamp = 0;
  private sharedFormulaChars = 0;
  private readonly kept: Array<XlsxWarning> = [];
  private readonly used: { [list in XlsxKeptList]: number } = {
    warnings: 0,
    merges: 0,
    hiddenSpans: 0,
    hiddenColumns: 0,
    sharedFormulas: 0,
  };
  private readonly dropped: { [list in XlsxKeptList]: number } = {
    warnings: 0,
    merges: 0,
    hiddenSpans: 0,
    hiddenColumns: 0,
    sharedFormulas: 0,
  };
  private readonly caps: Caps;

  constructor(caps: Caps) {
    this.caps = caps;
    this.stamps = new Uint32Array(Math.max(caps.columns, 1));
  }

  /** Keeps a warning while the read has room for one, and counts it as dropped otherwise. */
  warn(finding: XlsxWarning["finding"]): void {
    if (this.take("warnings")) this.kept.push(XlsxWarning.make({ finding }));
  }

  /** Whether one more item of a list may be kept; when not, it is counted as dropped. */
  take(list: XlsxKeptList): boolean {
    return this.takeUpTo(list, 1) === 1;
  }

  /** How many of `wanted` items of a list may be kept; the rest are counted as dropped. */
  takeUpTo(list: XlsxKeptList, wanted: number): number {
    const granted = Math.min(this.room(list), wanted);
    this.used[list] += granted;
    this.dropped[list] += wanted - granted;
    return granted;
  }

  /** How many more items of a list may be kept. */
  room(list: XlsxKeptList): number {
    return Math.max(this.caps[list] - this.used[list], 0);
  }

  /** Counts formula text handed to a cell that shares a formula; false once the read's cap on it is passed. */
  spendSharedFormula(chars: number): boolean {
    this.sharedFormulaChars += chars;
    return this.sharedFormulaChars <= this.caps.sharedFormulaChars;
  }

  /** A fresh stamp for the next row: no column holds it yet. */
  nextRow(): void {
    this.stamp += 1;
    if (this.stamp === 0xffffffff) {
      this.stamps.fill(0);
      this.stamp = 1;
    }
  }

  /** Marks a column as used in the row in hand; false when it already was, so the cell repeats a column. */
  claim(column: number): boolean {
    if (this.stamps[column] === this.stamp) return false;
    this.stamps[column] = this.stamp;
    return true;
  }

  /** The warnings kept, then one `ListTruncated` per list that dropped items, in the order of `XlsxKeptList`. */
  warnings(): ReadonlyArray<XlsxWarning> {
    const truncated = A.filterMap(XlsxKeptList.literals, (list) =>
      this.dropped[list] > 0
        ? Result.succeed(XlsxWarning.make({ finding: ListTruncated.make({ list, dropped: this.dropped[list] }) }))
        : Result.failVoid
    );
    return A.appendAll(this.kept, truncated);
  }
}
