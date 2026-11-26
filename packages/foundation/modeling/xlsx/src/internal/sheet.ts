import { $XlsxId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as A from "effect/Array";
import * as MutableHashMap from "effect/MutableHashMap";
import * as MutableHashSet from "effect/MutableHashSet";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { MAX_COLUMN, MAX_ROW, XlsxAddress, XlsxRange, XlsxRowNumber } from "../XlsxAddress.schema.ts";
import {
  holdsSomething,
  MAX_FORMULA_CHARS,
  XlsxBlank,
  XlsxBoolean,
  XlsxDate,
  XlsxError,
  XlsxErrorCode,
  XlsxNumber,
  XlsxNumberFormat,
  XlsxText,
  XlsxUnreadable,
} from "../XlsxCell.schema.ts";
import {
  BadAddress,
  DeclaredExtentWrong,
  FictitiousLeapDay,
  FormatNotShown,
  FormulaWithoutResult,
  LimitExceeded,
  RowOutOfOrder,
  UnknownStyle,
  UnreadableCell,
} from "../XlsxDiagnostic.schema.ts";
import { maxSerial, XlsxCalendar } from "../XlsxSerial.schema.ts";
import { XlsxHiddenColumns, XlsxMerges } from "../XlsxWorkbook.schema.ts";
import { stop } from "./container.ts";
import { shifted } from "./formula.ts";
import { isTrue, localName, longerThan, unescaped } from "./ooxml.ts";
import { detached, isXmlSafe } from "./text.ts";
import { StyleFormat, styleOf } from "./workbookPart.ts";
import type { XlsxValue } from "../XlsxCell.schema.ts";
import type { XlsxFatal, XlsxLimit, XlsxWarning } from "../XlsxDiagnostic.schema.ts";
import type { XlsxDateSystem } from "../XlsxSerial.schema.ts";
import type { XlsxRow } from "../XlsxWorkbook.schema.ts";
import type { ReadBudget } from "./budget.ts";
import type { Caps } from "./container.ts";
import type { XmlEvent } from "./ooxml.ts";

const $I = $XlsxId.create("internal/sheet");

const tally = (description: string) => S.Int.check(S.isGreaterThanOrEqualTo(0)).pipe(S.annotateKey({ description }));

/** What a sheet's XML says beside its rows. */
export class SheetLayout extends S.Opaque<SheetLayout, { readonly brand: unique symbol }>()(
  S.Struct({
    cellsWithValues: tally("Cells that hold something"),
    declared: S.Option(XlsxRange).pipe(S.annotateKey({ description: "The extent the sheet declares, if any" })),
    hiddenColumns: XlsxHiddenColumns.pipe(
      S.annotateKey({ description: "The hidden columns, in rising order and each once" })
    ),
    lastRow: S.Option(XlsxRowNumber).pipe(S.annotateKey({ description: "The last row that holds something" })),
    merges: XlsxMerges.pipe(S.annotateKey({ description: "The merged ranges, each once" })),
    rows: tally("Rows the sheet writes, empty ones included"),
    rowsWithValues: tally("Rows with at least one cell that holds something"),
    unordered: S.Boolean.pipe(
      S.annotateKey({ description: "Whether a row came after a later one, so the rows were not handed on in order" })
    ),
  }).pipe($I.annoteSchema("SheetLayout", { description: "What a sheet's XML says beside its rows" }))
) {}

const CellType = LiteralKit(["n", "s", "str", "b", "e", "d", "inlineStr"]).pipe(
  $I.annoteSchema("CellType", {
    description: "A cell's `t` attribute as the reader tells it apart; any other is read as `n`, as Excel reads none",
  })
);

type CellType = typeof CellType.Type;

/** A row as the reader hands it on: the input of `XlsxRow.make`, checked where it leaves the engine. */
export type RowInput = Parameters<typeof XlsxRow.make>[0];
type CellInput = RowInput["cells"][number];

const none: ReadonlyArray<RowInput> = [];
const byColumn = Order.mapInput(Order.Number, (cell: CellInput) => cell.column);
const byStart = Order.mapInput(Order.Number, (span: readonly [first: number, last: number]) => span[0]);
const numberText = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/;
const isoDate = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(\.\d+)?)?Z?)?$/;
const styleIndex = /^\d{1,9}$/;
const sharedIndex = /^\d{1,15}$/;
const general = StyleFormat.general;
const shortDate: StyleFormat = styleOf(XlsxNumberFormat.shortDate);
const blank = XlsxBlank.make({});
// decision: engine-makes-skip-filters
const checked = { disableChecks: true } as const;

const columnsOf = (spans: ReadonlyArray<readonly [first: number, last: number]>, budget: ReadBudget): Array<number> => {
  // decision: hot-paths-are-mutable-loops
  const columns: Array<number> = [];
  const room = budget.room("hiddenColumns");
  let covered = 0;
  let firstColumnNotGiven = 0;
  for (const [first, last] of A.sort(spans, byStart)) {
    const from = Math.max(first, firstColumnNotGiven);
    if (from <= last) covered += last - from + 1;
    for (let column = from; column <= last && columns.length < room; column += 1) columns.push(column);
    firstColumnNotGiven = Math.max(firstColumnNotGiven, last + 1);
  }
  budget.takeUpTo("hiddenColumns", covered);
  return columns;
};
const yes = XlsxBoolean.make({ value: true });
const no = XlsxBoolean.make({ value: false });

const letters: { readonly [letter: string]: number } = R.fromEntries(
  A.map(A.fromIterable("ABCDEFGHIJKLMNOPQRSTUVWXYZ"), (letter, index) => [letter, index + 1] as const)
);

// decision: hot-paths-are-mutable-loops
const columnOfIgnoringRow = (reference: string): number => {
  const start = reference[0] === "$" ? 1 : 0;
  const end = lettersEnd(reference, start);
  const column = oneBasedColumnOf(reference, start, end);
  if (end === start || end - start > 3 || column > MAX_COLUMN + 1) return -1;
  const digits = reference[end] === "$" ? end + 1 : end;
  return digits < reference.length && allDigits(reference, digits) ? column - 1 : -1;
};

const lettersEnd = (reference: string, from: number): number => {
  let i = from;
  while (letters[reference[i] ?? ""] !== undefined) i += 1;
  return i;
};

const oneBasedColumnOf = (reference: string, from: number, to: number): number => {
  let column = 0;
  for (let i = from; i < to; i += 1) column = column * 26 + (letters[reference[i] ?? ""] ?? 0);
  return column;
};

const allDigits = (reference: string, from: number): boolean => {
  for (let i = from; i < reference.length; i += 1) {
    const digit = reference[i] ?? "";
    if (digit < "0" || digit > "9") return false;
  }
  return true;
};

const isCellType = S.is(CellType);
const isErrorCode = S.is(XlsxErrorCode);

const cellTypeOf = (written: string | undefined): CellType => {
  const type = written ?? "n";
  return isCellType(type) ? type : "n";
};

const styleIndexOf = (written: string | undefined): number => {
  if (written === undefined) return -1;
  return styleIndex.test(written) ? Number(written) : -2;
};

type Unreadable = (reason: UnreadableCell["reason"]) => XlsxValue;

const textValue = (value: string): XlsxValue => XlsxText.make({ text: value }, checked);
const writtenText = (raw: string): XlsxValue => textValue(detached(unescaped(raw)));

const booleans: { readonly [text: string]: XlsxValue } = { "1": yes, true: yes, "0": no, false: no };

const booleanOf = (raw: string, unreadable: Unreadable): XlsxValue =>
  O.getOrElse(R.get(booleans, Str.toLowerCase(Str.trim(raw))), () => unreadable("boolean"));

const errorOf = (raw: string, unreadable: Unreadable): XlsxValue =>
  isErrorCode(raw) ? XlsxError.make({ code: raw }) : unreadable("errorCode");

/**
 * Reads one worksheet part. Feed it the part's events with `push`; each call returns the rows that ended in it.
 * `failed` holds the finding that stopped the read, after which events are ignored.
 *
 * **Details**
 * The reader reads one worksheet part: its rows of cells, its merged ranges, its hidden columns and the extent it
 * declares. It hands back each row as its end tag arrives, so a sheet of any length costs one row of memory until
 * the caller keeps the rows. Nothing here trusts the file: a reference that cannot be read is placed after the one
 * before it, and a value that cannot be read is kept as what was written and reported.
 *
 * **Gotchas**
 * - A shared text index is digits only, so no other text (`0x1`, `1e0`, nothing) names an entry.
 * - A hidden `<col>` span is kept as its two ends, never as its columns: one `<col>` of a few bytes may name every
 *   column.
 * - Each cell that shares a formula is handed its whole text, a few bytes of the file costing as much as the
 *   formula, so that text is counted against the read's cap before it is moved. A group already kept takes its new
 *   text in place; a new group needs room under the read's cap, and a group with none is dropped and counted, its
 *   cells keeping the empty formula they wrote.
 * - A date read from an ISO cell under a format that is not a date format is shown as Excel's short date; a number
 *   becomes a date only under a date format, so this touches the ISO case alone.
 * - The calendar schema holds each field of an ISO date to its range (an hour 0 to 23, a minute 0 to 59), so an
 *   impossible time such as T99:99:99 is unreadable rather than carried into a later day. Day 0 is a serial's alone
 *   ("January 0, 1900"); no ISO date names it. A fraction of a second is kept, and must still fall within the
 *   system's last serial.
 */
// decision: hot-paths-are-mutable-loops
export class SheetReader {
  failed: O.Option<XlsxFatal> = O.none();

  private depth = 0;
  private section = "";
  private declared: O.Option<XlsxRange> = O.none();
  private readonly merges: Array<XlsxRange> = [];
  /** The merged ranges already kept, by their reference, so a range written twice is kept once. */
  private readonly mergeKeys = MutableHashSet.empty<string>();
  /** Each hidden `<col>` as the span it names, clamped to the column cap; expanded once, in `finish`. */
  private readonly hiddenSpans: Array<readonly [first: number, last: number]> = [];
  private readonly masters = MutableHashMap.empty<
    string,
    { readonly text: string; readonly column: number; readonly row: number }
  >();
  private readonly notShown = MutableHashMap.empty<string, number>();

  private rowCount = 0;
  private rowsWithValues = 0;
  private cellsWithValues = 0;
  private lastRowWithValues = 0;
  /** The highest row number seen, which tells a row written out of order. */
  private previousRow = 0;
  /** The number of the row written last, which a row that names none follows. */
  private precedingRow = 0;
  private unordered = false;
  private firstColumn = Number.MAX_SAFE_INTEGER;
  private lastColumn = -1;
  private firstRow = 0;

  private inRow = false;
  private rowNumber = 0;
  private rowHidden = false;
  private cells: Array<CellInput> = [];
  private cellsSorted = true;
  /** The highest column kept in the row, which tells a cell written out of order. */
  private lastCellColumn = -1;
  /** The column of the cell written last in the row, blank or not, which a cell that names none follows. */
  private precedingColumn = -1;
  private held = 0;

  private inCell = false;
  private cellColumn = 0;
  private cellType: CellType = "n";
  /** The style index the cell names, -1 when it names none and -2 when what it writes is not a whole number. */
  private cellStyle = -1;
  private cellStyleText = "";
  private cellReference = "";
  // decision: hot-paths-are-mutable-loops
  private target: "" | "v" | "f" | "t" = "";
  private targetDepth = -1;
  private skipDepth = -1;
  private hasValue = false;
  private valueText = "";
  private hasInline = false;
  private inlineText = "";
  private hasFormula = false;
  private formulaText = "";
  private formulaShared = "";

  private readonly sheet: string;
  private readonly path: string;
  private readonly styles: ReadonlyArray<StyleFormat>;
  private readonly strings: ReadonlyArray<string>;
  private readonly system: XlsxDateSystem;
  private readonly lastSerial: number;
  private readonly caps: Caps;
  private readonly budget: ReadBudget;

  constructor(input: {
    readonly sheet: string;
    readonly path: string;
    readonly styles: ReadonlyArray<StyleFormat>;
    readonly strings: ReadonlyArray<string>;
    readonly system: XlsxDateSystem;
    readonly caps: Caps;
    readonly budget: ReadBudget;
  }) {
    this.sheet = input.sheet;
    this.path = input.path;
    this.styles = input.styles;
    this.strings = input.strings;
    this.system = input.system;
    this.lastSerial = maxSerial(input.system);
    this.caps = input.caps;
    this.budget = input.budget;
  }

  /** Takes one event of the part and returns the rows that ended with it. */
  push(event: XmlEvent): ReadonlyArray<RowInput> {
    if (O.isSome(this.failed)) return none;
    // decision: hot-paths-are-mutable-loops
    if (event._tag === "EndElement") return this.end();
    if (event._tag === "Text") this.text(event.text);
    else if (event._tag === "StartElement") {
      this.depth += 1;
      this.start(localName(event.name), event.attributes);
    }
    return none;
  }

  /** Adds a text event to the value, inline text or formula it belongs to, if any. */
  private text(text: string): void {
    if (this.target === "v") this.valueText += text;
    else if (this.target === "t") this.inlineText += text;
    else if (this.target === "f") this.formulaText += text;
  }

  /** Closes the element in hand and returns the row it ended, if it was one. */
  private end(): ReadonlyArray<RowInput> {
    const depth = this.depth;
    this.depth -= 1;
    if (depth === this.targetDepth) {
      this.target = "";
      this.targetDepth = -1;
      return none;
    }
    if (depth === this.skipDepth) {
      this.skipDepth = -1;
      return none;
    }
    if (this.inCell && depth === 4) {
      this.endCell();
      return none;
    }
    if (this.inRow && depth === 3) return this.endRow();
    if (depth === 2) this.section = "";
    return none;
  }

  /** What the sheet's XML said beside its rows, once every event has been pushed. Adds the sheet's own findings. */
  finish(): SheetLayout {
    for (const [code, cells] of this.notShown) {
      this.warn(FormatNotShown.make({ sheet: this.sheet, code: Str.slice(0, 255)(code), cells }));
    }
    const found =
      this.lastRowWithValues === 0
        ? O.none()
        : XlsxRange.makeOption({
            first: XlsxAddress.make({ column: this.firstColumn, row: this.firstRow }),
            last: XlsxAddress.make({ column: this.lastColumn, row: this.lastRowWithValues }),
          });
    if (O.isSome(this.declared) && O.isSome(found)) {
      const declared = this.declared.value;
      if (!XlsxRange.contains(declared, found.value.first) || !XlsxRange.contains(declared, found.value.last)) {
        this.warn(DeclaredExtentWrong.make({ sheet: this.sheet, declared, found }));
      }
    }
    return SheetLayout.make(
      {
        declared: this.declared,
        merges: this.merges,
        hiddenColumns: columnsOf(this.hiddenSpans, this.budget),
        rows: this.rowCount,
        rowsWithValues: this.rowsWithValues,
        cellsWithValues: this.cellsWithValues,
        lastRow: this.lastRowWithValues === 0 ? O.none() : O.some(this.lastRowWithValues),
        unordered: this.unordered,
      },
      checked
    );
  }

  private warn(finding: XlsxWarning["finding"]): void {
    this.budget.warn(finding);
  }

  private fail(limit: XlsxLimit): void {
    this.failed = O.some(stop(LimitExceeded.make({ limit, path: Str.slice(0, 1024)(this.path) })));
  }

  private start(name: string, attributes: Readonly<Record<string, string>>): void {
    const depth = this.depth;
    if (this.skipDepth !== -1) return;
    if (depth === 2) {
      this.startSection(name, attributes);
      return;
    }
    if (depth === 3) {
      this.startSectionChild(name, attributes);
      return;
    }
    if (depth === 4 && this.inRow && name === "c") {
      this.startCell(attributes);
      return;
    }
    if (!this.inCell) return;
    if (depth === 5) this.startCellChild(name, attributes);
    else this.startInlineChild(name);
  }

  /** A child of the worksheet: the section the elements under it belong to. */
  private startSection(name: string, attributes: Readonly<Record<string, string>>): void {
    this.section = name;
    if (name === "dimension") this.declared = XlsxRange.parse(attributes.ref ?? "");
  }

  /** A child of a section: a row, a merged range or a column span. */
  private startSectionChild(name: string, attributes: Readonly<Record<string, string>>): void {
    if (this.section === "sheetData" && name === "row") this.startRow(attributes);
    else if (this.section === "mergeCells" && name === "mergeCell") this.addMerge(attributes.ref ?? "");
    else if (this.section === "cols" && name === "col" && isTrue(attributes.hidden)) this.addHiddenSpan(attributes);
  }

  /** Keeps a merged range once, while the read's cap on merges leaves room. */
  private addMerge(ref: string): void {
    const range = XlsxRange.parse(ref);
    if (O.isNone(range)) return;
    const key = XlsxRange.format(range.value);
    if (MutableHashSet.has(this.mergeKeys, key) || !this.budget.take("merges")) return;
    MutableHashSet.add(this.mergeKeys, key);
    this.merges.push(range.value);
  }

  /** Keeps a hidden `<col>` span, clamped to the column cap. */
  private addHiddenSpan(attributes: Readonly<Record<string, string>>): void {
    const first = Math.max(Number(attributes.min), 1);
    const last = Math.min(Number(attributes.max), this.caps.columns);
    if (Number.isInteger(first) && Number.isInteger(last) && first <= last && this.budget.take("hiddenSpans")) {
      this.hiddenSpans.push([first - 1, last - 1]);
    }
  }

  /** A child of a cell: its value, its formula or its inline string. */
  private startCellChild(name: string, attributes: Readonly<Record<string, string>>): void {
    if (name === "v") {
      this.hasValue = true;
      this.aim("v");
    } else if (name === "f") {
      this.hasFormula = true;
      this.formulaShared = attributes.t === "shared" ? (attributes.si ?? "") : "";
      this.aim("f");
    } else if (name === "is") this.hasInline = true;
  }

  /** An element inside a cell's inline string: its text, or a phonetic run that is skipped whole. */
  private startInlineChild(name: string): void {
    if (!this.hasInline || this.target !== "") return;
    if (name === "rPh") this.skipDepth = this.depth;
    else if (name === "t") this.aim("t");
  }

  /** Sends the text of the element just opened to `target`. */
  private aim(target: "v" | "f" | "t"): void {
    this.target = target;
    this.targetDepth = this.depth;
  }

  /** The row a `<row>` names, or the one after the row written before it when it names none it can read. */
  private rowNumberOf(written: string | undefined): number {
    const next = this.precedingRow + 1;
    if (written === undefined) return next;
    const parsed = Number(written);
    if (Number.isInteger(parsed) && parsed >= 1) return parsed;
    this.warn(BadAddress.make({ sheet: this.sheet, row: Math.min(next, MAX_ROW), raw: Str.slice(0, 255)(written) }));
    return next;
  }

  private startRow(attributes: Readonly<Record<string, string>>): void {
    const number = this.rowNumberOf(attributes.r);
    this.precedingRow = number;
    this.rowCount += 1;
    if (number > MAX_ROW || this.rowCount > this.caps.rows) {
      this.fail("rows");
      return;
    }
    if (number <= this.previousRow) {
      this.unordered = true;
      this.warn(RowOutOfOrder.make({ sheet: this.sheet, row: number }));
    } else this.previousRow = number;
    this.inRow = true;
    this.rowNumber = number;
    this.rowHidden = isTrue(attributes.hidden);
    this.cells = [];
    this.cellsSorted = true;
    this.lastCellColumn = -1;
    this.precedingColumn = -1;
    this.held = 0;
    this.budget.nextRow();
  }

  private endRow(): ReadonlyArray<RowInput> {
    this.inRow = false;
    if (O.isSome(this.failed)) return none;
    if (!this.cellsSorted) this.cells = A.sort(this.cells, byColumn);
    if (this.held > 0) {
      this.rowsWithValues += 1;
      this.cellsWithValues += this.held;
      if (this.firstRow === 0 || this.rowNumber < this.firstRow) this.firstRow = this.rowNumber;
      if (this.rowNumber > this.lastRowWithValues) this.lastRowWithValues = this.rowNumber;
    }
    return [{ number: this.rowNumber, hidden: this.rowHidden, cells: this.cells }];
  }

  /** The column a `<c>` names, or the one after the cell written before it when it names none it can read. */
  private cellColumnOf(written: string | undefined): number {
    const next = this.precedingColumn + 1;
    if (written === undefined) return next;
    const parsed = columnOfIgnoringRow(written);
    if (parsed >= 0) return parsed;
    this.warn(BadAddress.make({ sheet: this.sheet, row: this.rowNumber, raw: Str.slice(0, 255)(written) }));
    return next;
  }

  private startCell(attributes: Readonly<Record<string, string>>): void {
    const written = attributes.r;
    const column = this.cellColumnOf(written);
    this.precedingColumn = column;
    if (column >= this.caps.columns) {
      this.fail("columns");
      return;
    }
    this.inCell = true;
    this.cellColumn = column;
    this.cellReference = written ?? "";
    this.cellType = cellTypeOf(attributes.t);
    this.cellStyleText = attributes.s ?? "";
    this.cellStyle = styleIndexOf(attributes.s);
    this.hasValue = false;
    this.valueText = "";
    this.hasInline = false;
    this.inlineText = "";
    this.hasFormula = false;
    this.formulaText = "";
    this.formulaShared = "";
  }

  private styleFormat(address: () => XlsxAddress): StyleFormat {
    if (this.cellStyle === -1) return this.styles[0] ?? general;
    const style = this.cellStyle >= 0 ? this.styles[this.cellStyle] : undefined;
    if (style !== undefined) return style;
    if (this.styles.length > 0 || this.cellStyle !== 0) {
      this.warn(
        UnknownStyle.make({ sheet: this.sheet, address: address(), style: Str.slice(0, 255)(this.cellStyleText) })
      );
    }
    return general;
  }

  private endCell(): void {
    this.inCell = false;
    if (O.isSome(this.failed)) return;
    const column = this.cellColumn;
    const row = this.rowNumber;
    const address = (): XlsxAddress => XlsxAddress.make({ column, row });
    const formula = this.cellFormula(column, row);
    if (O.isSome(this.failed)) return;
    const style = this.styleFormat(address);
    const raw = this.hasInline ? this.inlineText : this.valueText;
    if (longerThan(raw, this.caps.cellChars)) {
      this.fail("cellChars");
      return;
    }
    const value = this.cellValue(raw, style.dated, (reason) => this.unreadable(raw, reason, address));
    if (value.kind === "Blank" && O.isNone(formula)) return;
    const shown = value.kind === "Date" && !style.dated ? shortDate : style;
    this.note(value, shown, address);
    this.place(column, value, formula, shown.format);
  }

  /** The formula the cell in hand writes, if any; a shared one is shifted from its group's first cell. */
  private cellFormula(column: number, row: number): O.Option<string> {
    if (!this.hasFormula) return O.none();
    const text = this.formulaShared === "" ? this.formulaText : this.sharedFormula(column, row);
    if (O.isSome(this.failed)) return O.none();
    if (text.length > MAX_FORMULA_CHARS * 4) {
      this.fail("cellChars");
      return O.none();
    }
    return O.some(text.length <= MAX_FORMULA_CHARS && isXmlSafe(text) ? text : "");
  }

  /** The text of a cell in a shared formula group: its own when it is the group's first cell, else the shifted first. */
  private sharedFormula(column: number, row: number): string {
    const text = this.formulaText;
    if (text !== "") {
      this.keepMaster(text, column, row);
      return text;
    }
    const master = MutableHashMap.get(this.masters, this.formulaShared);
    if (O.isNone(master)) return text;
    if (!this.budget.spendSharedFormula(master.value.text.length)) {
      this.fail("sharedFormulaChars");
      return text;
    }
    return shifted({ formula: master.value.text, columns: column - master.value.column, rows: row - master.value.row });
  }

  private keepMaster(text: string, column: number, row: number): void {
    if (MutableHashMap.has(this.masters, this.formulaShared) || this.budget.take("sharedFormulas")) {
      MutableHashMap.set(this.masters, this.formulaShared, { text, column, row });
    }
  }

  /** The value the cell in hand holds, read by its type. */
  private cellValue(raw: string, dated: boolean, unreadable: Unreadable): XlsxValue {
    const written = this.hasValue || this.hasInline;
    const ifWritten = (read: () => XlsxValue): XlsxValue => (written ? read() : blank);
    return CellType.match(this.cellType, {
      inlineStr: () => (this.hasInline ? writtenText(raw) : blank),
      s: () => ifWritten(() => this.sharedString(raw, unreadable)),
      str: () => ifWritten(() => writtenText(raw)),
      b: () => ifWritten(() => booleanOf(raw, unreadable)),
      e: () => ifWritten(() => errorOf(raw, unreadable)),
      d: () => ifWritten(() => this.isoDate(raw, unreadable)),
      n: () => ifWritten(() => this.number(raw, dated, unreadable)),
    });
  }

  private unreadable(raw: string, reason: UnreadableCell["reason"], address: () => XlsxAddress): XlsxValue {
    this.warn(UnreadableCell.make({ sheet: this.sheet, address: address(), reason }));
    return XlsxUnreadable.make({ raw: detached(unescaped(raw)) }, checked);
  }

  private sharedString(raw: string, unreadable: Unreadable): XlsxValue {
    const written = Str.trim(raw);
    const shared = sharedIndex.test(written) ? this.strings[Number(written)] : undefined;
    return shared === undefined ? unreadable("sharedString") : textValue(shared);
  }

  private isoDate(raw: string, unreadable: Unreadable): XlsxValue {
    const serial = O.fromNullishOr(isoDate.exec(Str.trim(raw))).pipe(
      O.filter((found) => found[3] !== "00"),
      O.flatMap((found) => this.serialOfIso(found)),
      O.filter((moment) => moment <= this.lastSerial)
    );
    return O.match(serial, {
      onNone: () => unreadable("date"),
      onSome: (moment): XlsxValue => XlsxDate.make({ serial: moment }, checked),
    });
  }

  private serialOfIso(found: RegExpExecArray): O.Option<number> {
    return XlsxCalendar.makeOption({
      year: Number(found[1]),
      month: Number(found[2]),
      day: Number(found[3]),
      hour: Number(found[4] ?? "0"),
      minute: Number(found[5] ?? "0"),
      second: Number(found[6] ?? "0"),
    }).pipe(
      O.flatMap((calendar) => XlsxCalendar.toSerial(calendar, this.system)),
      O.map((whole) => whole + Number(found[7] ?? "0") / 86_400)
    );
  }

  private number(raw: string, dated: boolean, unreadable: Unreadable): XlsxValue {
    const trimmed = Str.trim(raw);
    if (trimmed === "") return blank;
    const number = numberText.test(trimmed) ? Number(trimmed) : Number.NaN;
    if (!Number.isFinite(number)) return unreadable("number");
    return dated && number >= 0 && number <= this.lastSerial
      ? XlsxDate.make({ serial: number }, checked)
      : XlsxNumber.make({ value: number }, checked);
  }

  /** Reports what the cell's value says about the sheet: a formula with no result, a fictitious day, a hidden format. */
  private note(value: XlsxValue, style: StyleFormat, address: () => XlsxAddress): void {
    if (value.kind === "Blank") this.warn(FormulaWithoutResult.make({ sheet: this.sheet, address: address() }));
    else if (value.kind === "Date") this.noteDate(value.serial, style, address);
    else if (value.kind === "Number" && style.notShown && !style.dated) this.countNotShown(style.format.code);
  }

  private noteDate(serial: number, style: StyleFormat, address: () => XlsxAddress): void {
    if (this.system === "1900" && Math.floor(serial) === 60) {
      this.warn(FictitiousLeapDay.make({ sheet: this.sheet, address: address() }));
    }
    if (style.notShown) this.countNotShown(style.format.code);
  }

  /** Adds the cell to its row, unless its column is already used there. */
  private place(column: number, value: XlsxValue, formula: O.Option<string>, format: XlsxNumberFormat): void {
    if (!this.budget.claim(column)) {
      this.warn(
        BadAddress.make({ sheet: this.sheet, row: this.rowNumber, raw: Str.slice(0, 255)(this.cellReference) })
      );
      return;
    }
    if (column <= this.lastCellColumn) this.cellsSorted = false;
    else this.lastCellColumn = column;
    if (holdsSomething(value)) {
      this.held += 1;
      this.firstColumn = Math.min(this.firstColumn, column);
      this.lastColumn = Math.max(this.lastColumn, column);
    }
    this.cells.push({ column, value, formula, format });
  }

  private countNotShown(code: string): void {
    MutableHashMap.set(this.notShown, code, O.getOrElse(MutableHashMap.get(this.notShown, code), () => 0) + 1);
  }
}
