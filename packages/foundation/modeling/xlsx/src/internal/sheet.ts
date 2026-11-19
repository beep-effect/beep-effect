// One worksheet part, read event by event: its rows of cells, its merged ranges, its hidden columns and the extent
// it declares. A reader is fed the part's XML events and hands back each row as its end tag arrives, so a sheet of
// any length costs one row of memory until the caller keeps the rows. Nothing here trusts the file: a reference
// that cannot be read is placed after the one before it, and a value that cannot be read is kept as what was
// written and reported.
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
import { isTrue, localName, unescaped } from "./ooxml.ts";
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

/**
 * The cell types the reader tells apart (the `t` attribute). Any other is read as `n`, a number, which is what Excel
 * does with a cell that has none.
 */
const CellType = LiteralKit(["n", "s", "str", "b", "e", "d", "inlineStr"]).pipe(
  $I.annoteSchema("CellType", { description: "A cell's `t` attribute as the reader tells it apart" })
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
/** A style index as a cell may write one: digits only, nine at most, so it is read exactly and names a style or none. */
const styleIndex = /^\d{1,9}$/;
const general = StyleFormat.general;
const shortDate: StyleFormat = styleOf(XlsxNumberFormat.shortDate);
const blank = XlsxBlank.make({});
// The reader builds every value from parts it has just checked (a finite number, text within the cap, an error code
// from the list), so its constructors skip the filters and keep the shape checked. Every workbook a test reads, from
// a fixture, a generated file or a hostile one, is held to `S.is(XlsxWorkbook)`, which runs them all.
const checked = { disableChecks: true } as const;

/**
 * The hidden columns that `<col>` spans cover, each once and in rising order, as many as the read's cap on hidden
 * columns leaves room for; the columns past it are counted as dropped.
 */
const columnsOf = (spans: ReadonlyArray<readonly [first: number, last: number]>, budget: ReadBudget): Array<number> => {
  // crispen: a sweep over the spans sorted by start; `next` is the first column not yet given, so a column covered
  // by many spans is given once and the work is the spans plus the columns kept, whatever the spans repeat.
  const columns: Array<number> = [];
  const room = budget.room("hiddenColumns");
  let covered = 0;
  let next = 0;
  for (const [first, last] of A.sort(spans, byStart)) {
    const from = Math.max(first, next);
    if (from <= last) covered += last - from + 1;
    for (let column = from; column <= last && columns.length < room; column += 1) columns.push(column);
    next = Math.max(next, last + 1);
  }
  budget.takeUpTo("hiddenColumns", covered);
  return columns;
};
const yes = XlsxBoolean.make({ value: true });
const no = XlsxBoolean.make({ value: false });

const letters: { readonly [letter: string]: number } = R.fromEntries(
  A.map(A.fromIterable("ABCDEFGHIJKLMNOPQRSTUVWXYZ"), (letter, index) => [letter, index + 1] as const)
);

/**
 * The 0-based column of a cell reference such as `B7`, or -1 when it is not one. The row comes from the row element.
 */
// crispen: read for every cell of every sheet, so a loop over the letters with no pattern and no allocation, and -1
// rather than an Option; `XlsxAddress.parse` is the pattern-based reading for anything that is not this hot path.
const columnOf = (reference: string): number => {
  let column = 0;
  let i = 0;
  if (reference[0] === "$") i = 1;
  const start = i;
  while (i < reference.length) {
    const value = letters[reference[i] ?? ""];
    if (value === undefined) break;
    column = column * 26 + value;
    i += 1;
  }
  if (i === start || i - start > 3 || column > MAX_COLUMN + 1) return -1;
  if (reference[i] === "$") i += 1;
  if (i >= reference.length) return -1;
  for (let k = i; k < reference.length; k += 1) {
    const digit = reference[k] ?? "";
    if (digit < "0" || digit > "9") return -1;
  }
  return column - 1;
};

/**
 * Reads one worksheet part. Feed it the part's events with `push`; each call returns the rows that ended in it.
 * `failed` holds the finding that stopped the read, after which events are ignored.
 */
// crispen: a mutable state machine fed one XML event at a time, for every element of every sheet; the fields are the
// parser's position and the row and cell in hand. A reducer over immutable state would allocate per event.
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
  private previousRow = 0;
  private unordered = false;
  private firstColumn = Number.MAX_SAFE_INTEGER;
  private lastColumn = -1;
  private firstRow = 0;

  private inRow = false;
  private rowNumber = 0;
  private rowHidden = false;
  private cells: Array<CellInput> = [];
  private cellsSorted = true;
  private lastCellColumn = -1;
  private held = 0;

  private inCell = false;
  private cellColumn = 0;
  private cellType: CellType = "n";
  /** The style index the cell names, -1 when it names none and -2 when what it writes is not a whole number. */
  private cellStyle = -1;
  private cellStyleText = "";
  private cellReference = "";
  // crispen: the text the next event belongs to; a plain union read on every text event of the sheet.
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
    if (event._tag === "Text") {
      if (this.target === "v") this.valueText += event.text;
      else if (this.target === "t") this.inlineText += event.text;
      else if (this.target === "f") this.formulaText += event.text;
      return none;
    }
    if (event._tag === "StartElement") {
      this.depth += 1;
      this.start(localName(event.name), event.attributes);
      return none;
    }
    if (event._tag !== "EndElement") return none;
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
      this.section = name;
      if (name === "dimension") this.declared = XlsxRange.parse(attributes.ref ?? "");
      return;
    }
    if (depth === 3) {
      if (this.section === "sheetData" && name === "row") this.startRow(attributes);
      else if (this.section === "mergeCells" && name === "mergeCell") {
        const range = XlsxRange.parse(attributes.ref ?? "");
        if (O.isSome(range)) {
          const key = XlsxRange.format(range.value);
          if (!MutableHashSet.has(this.mergeKeys, key) && this.budget.take("merges")) {
            MutableHashSet.add(this.mergeKeys, key);
            this.merges.push(range.value);
          }
        }
      } else if (this.section === "cols" && name === "col" && isTrue(attributes.hidden)) {
        // A span is kept as its two ends, never as its columns: one `<col>` of a few bytes may name every column.
        const first = Math.max(Number(attributes.min), 1);
        const last = Math.min(Number(attributes.max), this.caps.columns);
        if (Number.isInteger(first) && Number.isInteger(last) && first <= last && this.budget.take("hiddenSpans")) {
          this.hiddenSpans.push([first - 1, last - 1]);
        }
      }
      return;
    }
    if (depth === 4 && this.inRow && name === "c") {
      this.startCell(attributes);
      return;
    }
    if (!this.inCell) return;
    if (depth === 5) {
      if (name === "v") {
        this.hasValue = true;
        this.target = "v";
        this.targetDepth = depth;
      } else if (name === "f") {
        this.hasFormula = true;
        this.formulaShared = attributes.t === "shared" ? (attributes.si ?? "") : "";
        this.target = "f";
        this.targetDepth = depth;
      } else if (name === "is") this.hasInline = true;
      return;
    }
    if (this.hasInline && this.target === "") {
      if (name === "rPh") this.skipDepth = depth;
      else if (name === "t") {
        this.target = "t";
        this.targetDepth = depth;
      }
    }
  }

  private startRow(attributes: Readonly<Record<string, string>>): void {
    const written = attributes.r;
    let number = this.previousRow + 1;
    if (written !== undefined) {
      const parsed = Number(written);
      if (Number.isInteger(parsed) && parsed >= 1) number = parsed;
      else
        this.warn(
          BadAddress.make({ sheet: this.sheet, row: Math.min(number, MAX_ROW), raw: Str.slice(0, 255)(written) })
        );
    }
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

  private startCell(attributes: Readonly<Record<string, string>>): void {
    const written = attributes.r;
    let column = this.lastCellColumn + 1;
    if (written !== undefined) {
      const parsed = columnOf(written);
      if (parsed >= 0) column = parsed;
      else this.warn(BadAddress.make({ sheet: this.sheet, row: this.rowNumber, raw: Str.slice(0, 255)(written) }));
    }
    if (column >= this.caps.columns) {
      this.fail("columns");
      return;
    }
    this.inCell = true;
    this.cellColumn = column;
    this.cellReference = written ?? "";
    const type = attributes.t ?? "n";
    this.cellType = S.is(CellType)(type) ? type : "n";
    const style = attributes.s;
    this.cellStyleText = style ?? "";
    // A style index is a whole number the styles table could hold; anything else (a fraction, a sign, an exponent,
    // digits past a safe integer) is no index at all, and is reported as the cell wrote it.
    this.cellStyle = style === undefined ? -1 : styleIndex.test(style) ? Number(style) : -2;
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
    let formula: O.Option<string> = O.none();
    if (this.hasFormula) {
      let text = this.formulaText;
      if (this.formulaShared !== "") {
        if (text !== "") {
          // A group already kept takes its new text in place; a new group needs room under the read's cap, and a
          // group with none is dropped and counted, its cells keeping the empty formula they wrote.
          if (MutableHashMap.has(this.masters, this.formulaShared) || this.budget.take("sharedFormulas")) {
            MutableHashMap.set(this.masters, this.formulaShared, { text, column, row });
          }
        } else {
          const master = MutableHashMap.get(this.masters, this.formulaShared);
          if (O.isSome(master)) {
            // Each cell that shares a formula is handed its whole text, a few bytes of the file costing as much as
            // the formula, so that text is counted against the read's cap before it is moved.
            if (!this.budget.spendSharedFormula(master.value.text.length)) {
              this.fail("sharedFormulaChars");
              return;
            }
            text = shifted({
              formula: master.value.text,
              columns: column - master.value.column,
              rows: row - master.value.row,
            });
          }
        }
      }
      if (text.length > MAX_FORMULA_CHARS * 4) {
        this.fail("cellChars");
        return;
      }
      formula = O.some(text.length <= MAX_FORMULA_CHARS && isXmlSafe(text) ? text : "");
    }
    let style = this.styleFormat(address);
    const raw = this.hasInline ? this.inlineText : this.valueText;
    if (raw.length > this.caps.cellChars) {
      this.fail("cellChars");
      return;
    }
    const unreadable = (reason: UnreadableCell["reason"]): XlsxValue => {
      this.warn(UnreadableCell.make({ sheet: this.sheet, address: address(), reason }));
      const written = unescaped(raw);
      return XlsxUnreadable.make({ raw: detached(S.is(XlsxErrorCode)(written) ? `'${written}` : written) }, checked);
    };
    const text = (value: string): XlsxValue => XlsxText.make({ text: value }, checked);
    const written = this.hasValue || this.hasInline;
    const dated = style.dated;
    const value: XlsxValue = CellType.match(this.cellType, {
      inlineStr: () => (this.hasInline ? text(detached(unescaped(raw))) : blank),
      s: () => {
        if (!written) return blank;
        const index = Number(Str.trim(raw));
        const shared = Number.isInteger(index) && index >= 0 ? this.strings[index] : undefined;
        return shared === undefined ? unreadable("sharedString") : text(shared);
      },
      str: () => (written ? text(detached(unescaped(raw))) : blank),
      b: () => {
        if (!written) return blank;
        const text = Str.toLowerCase(Str.trim(raw));
        return text === "1" || text === "true" ? yes : text === "0" || text === "false" ? no : unreadable("boolean");
      },
      e: () => (written ? (S.is(XlsxErrorCode)(raw) ? XlsxError.make({ code: raw }) : unreadable("errorCode")) : blank),
      d: () => {
        if (!written) return blank;
        // The calendar schema holds each field to its range (an hour 0 to 23, a minute 0 to 59), so an impossible
        // time such as T99:99:99 is unreadable rather than carried into a later day. Day 0 is a serial's alone
        // ("January 0, 1900"); no ISO date names it. A fraction of a second is kept, and must still fall within the
        // system's last serial.
        const serial = O.fromNullishOr(isoDate.exec(Str.trim(raw))).pipe(
          O.filter((found) => found[3] !== "00"),
          O.flatMap((found) =>
            XlsxCalendar.makeOption({
              year: Number(found[1]),
              month: Number(found[2]),
              day: Number(found[3]),
              hour: Number(found[4] ?? "0"),
              minute: Number(found[5] ?? "0"),
              second: Number(found[6] ?? "0"),
            }).pipe(
              O.flatMap((calendar) => XlsxCalendar.toSerial(calendar, this.system)),
              O.map((whole) => whole + Number(found[7] ?? "0") / 86_400)
            )
          ),
          O.filter((moment) => moment <= this.lastSerial)
        );
        return O.match(serial, {
          onNone: () => unreadable("date"),
          onSome: (moment): XlsxValue => XlsxDate.make({ serial: moment }, checked),
        });
      },
      n: () => {
        const trimmed = Str.trim(raw);
        if (!written || trimmed === "") return blank;
        const number = numberText.test(trimmed) ? Number(trimmed) : Number.NaN;
        if (!Number.isFinite(number)) return unreadable("number");
        return dated && number >= 0 && number <= this.lastSerial
          ? XlsxDate.make({ serial: number }, checked)
          : XlsxNumber.make({ value: number }, checked);
      },
    });
    // A date read from an ISO cell under a format that is not a date format is shown as Excel's short date; a number
    // becomes a date only under a date format, so this touches the ISO case alone.
    if (value.kind === "Date" && !dated) style = shortDate;
    if (value.kind === "Blank") {
      if (O.isNone(formula)) return;
      this.warn(FormulaWithoutResult.make({ sheet: this.sheet, address: address() }));
    } else if (value.kind === "Date") {
      if (this.system === "1900" && Math.floor(value.serial) === 60) {
        this.warn(FictitiousLeapDay.make({ sheet: this.sheet, address: address() }));
      }
      if (style.notShown) this.countNotShown(style.format.code);
    } else if (value.kind === "Number" && style.notShown && !style.dated) this.countNotShown(style.format.code);
    // A column already used in this row is a repeat, found by its stamp in one step whatever order the cells
    // came in: the first cell written there is kept and the repeat reported.
    if (!this.budget.claim(column)) {
      this.warn(BadAddress.make({ sheet: this.sheet, row, raw: Str.slice(0, 255)(this.cellReference) }));
      return;
    }
    if (column <= this.lastCellColumn) this.cellsSorted = false;
    else this.lastCellColumn = column;
    if (holdsSomething(value)) {
      this.held += 1;
      if (column < this.firstColumn) this.firstColumn = column;
      if (column > this.lastColumn) this.lastColumn = column;
    }
    this.cells.push({ column, value, formula, format: style.format });
  }

  private countNotShown(code: string): void {
    MutableHashMap.set(this.notShown, code, O.getOrElse(MutableHashMap.get(this.notShown, code), () => 0) + 1);
  }
}
