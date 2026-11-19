// One worksheet part, read event by event: its rows of cells, its merged ranges, its hidden columns and the extent
// it declares. A reader is fed the part's XML events and hands back each row as its end tag arrives, so a sheet of
// any length costs one row of memory until the caller keeps the rows. Nothing here trusts the file: a reference
// that cannot be read is placed after the one before it, and a value that cannot be read is kept as what was
// written and reported.
import { $XlsxId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as A from "effect/Array";
import * as MutableHashMap from "effect/MutableHashMap";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { MAX_COLUMN, MAX_ROW, XlsxAddress, XlsxColumn, XlsxRange, XlsxRowNumber } from "../XlsxAddress.schema.ts";
import {
  holdsSomething,
  MAX_FORMULA_CHARS,
  XlsxBlank,
  XlsxBoolean,
  XlsxError,
  XlsxErrorCode,
  XlsxNumberFormat,
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
  XlsxWarning,
} from "../XlsxDiagnostic.schema.ts";
import { MAX_SERIAL } from "../XlsxSerial.schema.ts";
import { stop } from "./container.ts";
import { shifted } from "./formula.ts";
import { isTrue, localName, unescaped } from "./ooxml.ts";
import { serialOf } from "./serial.ts";
import { isXmlSafe } from "./text.ts";
import { detached, trusted } from "./trusted.ts";
import { StyleFormat, styleOf } from "./workbookPart.ts";
import type { XlsxCell, XlsxDate, XlsxNumber, XlsxText, XlsxUnreadable, XlsxValue } from "../XlsxCell.schema.ts";
import type { XlsxFatal, XlsxLimit } from "../XlsxDiagnostic.schema.ts";
import type { XlsxRow } from "../XlsxWorkbook.schema.ts";
import type { Caps } from "./container.ts";
import type { XmlEvent } from "./ooxml.ts";

const $I = $XlsxId.create("internal/sheet");

const tally = (description: string) => S.Int.check(S.isGreaterThanOrEqualTo(0)).pipe(S.annotateKey({ description }));

/** What a sheet's XML says beside its rows. */
export class SheetLayout extends S.Opaque<SheetLayout, { readonly brand: unique symbol }>()(
  S.Struct({
    cellsWithValues: tally("Cells that hold something"),
    declared: S.Option(XlsxRange).pipe(S.annotateKey({ description: "The extent the sheet declares, if any" })),
    hiddenColumns: S.Array(XlsxColumn).pipe(
      S.annotateKey({ description: "The hidden columns as the sheet lists them, repeats included" })
    ),
    lastRow: S.Option(XlsxRowNumber).pipe(S.annotateKey({ description: "The last row that holds something" })),
    merges: S.Array(XlsxRange).pipe(S.annotateKey({ description: "The merged ranges" })),
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

const none: ReadonlyArray<XlsxRow> = [];
const byColumn = Order.mapInput(Order.Number, (cell: XlsxCell) => cell.column);
const numberText = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/;
const isoDate = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?Z?)?$/;
const general = StyleFormat.general;
const shortDate: StyleFormat = styleOf(XlsxNumberFormat.make({ id: 14, code: "m/d/yy" }));
const blank = XlsxBlank.make({});
const yes = XlsxBoolean.make({ value: true });
const no = XlsxBoolean.make({ value: false });

const letters: { readonly [letter: string]: number } = R.fromEntries(
  A.map(A.fromIterable("ABCDEFGHIJKLMNOPQRSTUVWXYZ"), (letter, index) => [letter, index + 1] as const)
);

/**
 * The 0-based column of a cell reference such as `B7`, or -1 when it is not one. Read for every cell of every
 * sheet, so it is a loop over the letters with no pattern and no allocation; the row comes from the row element.
 */
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
export class SheetReader {
  readonly warnings: Array<XlsxWarning> = [];
  failed: O.Option<XlsxFatal> = O.none();

  private depth = 0;
  private section = "";
  private declared: O.Option<XlsxRange> = O.none();
  private readonly merges: Array<XlsxRange> = [];
  private readonly hiddenColumns: Array<number> = [];
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
  private cells: Array<XlsxCell> = [];
  private cellsSorted = true;
  private lastCellColumn = -1;
  private held = 0;

  private inCell = false;
  private cellColumn = 0;
  private cellType: CellType = "n";
  private cellStyle = -1;
  private cellReference = "";
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
  private readonly date1904: boolean;
  private readonly caps: Caps;

  constructor(input: {
    readonly sheet: string;
    readonly path: string;
    readonly styles: ReadonlyArray<StyleFormat>;
    readonly strings: ReadonlyArray<string>;
    readonly date1904: boolean;
    readonly caps: Caps;
  }) {
    this.sheet = input.sheet;
    this.path = input.path;
    this.styles = input.styles;
    this.strings = input.strings;
    this.date1904 = input.date1904;
    this.caps = input.caps;
  }

  /** Takes one event of the part and returns the rows that ended with it. */
  push(event: XmlEvent): ReadonlyArray<XlsxRow> {
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
    // Built without `make`: the hidden columns of a hostile sheet can run to every column once per `<col>`, and each
    // field here is one the reader has bounded as it counted.
    return trusted<SheetLayout>({
      declared: this.declared,
      merges: this.merges,
      hiddenColumns: this.hiddenColumns,
      rows: this.rowCount,
      rowsWithValues: this.rowsWithValues,
      cellsWithValues: this.cellsWithValues,
      lastRow: this.lastRowWithValues === 0 ? O.none() : O.some(this.lastRowWithValues),
      unordered: this.unordered,
    });
  }

  private warn(finding: XlsxWarning["finding"]): void {
    if (this.warnings.length < 10_000) this.warnings.push(XlsxWarning.make({ finding }));
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
        if (O.isSome(range)) this.merges.push(range.value);
      } else if (this.section === "cols" && name === "col" && isTrue(attributes.hidden)) {
        const first = Number(attributes.min);
        const last = Math.min(Number(attributes.max), this.caps.columns);
        if (Number.isInteger(first) && Number.isInteger(last)) {
          for (let column = Math.max(first, 1); column <= last; column += 1) this.hiddenColumns.push(column - 1);
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
  }

  private endRow(): ReadonlyArray<XlsxRow> {
    this.inRow = false;
    if (O.isSome(this.failed)) return none;
    if (!this.cellsSorted) this.cells = A.sort(this.cells, byColumn);
    if (this.held > 0) {
      this.rowsWithValues += 1;
      this.cellsWithValues += this.held;
      if (this.firstRow === 0 || this.rowNumber < this.firstRow) this.firstRow = this.rowNumber;
      if (this.rowNumber > this.lastRowWithValues) this.lastRowWithValues = this.rowNumber;
    }
    return [trusted<XlsxRow>({ number: this.rowNumber, hidden: this.rowHidden, cells: this.cells })];
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
    this.cellStyle = style === undefined ? -1 : Number(style);
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
    const style = this.styles[this.cellStyle];
    if (style !== undefined) return style;
    if (this.styles.length > 0 || this.cellStyle !== 0) {
      this.warn(
        UnknownStyle.make({
          sheet: this.sheet,
          address: address(),
          style: Number.isInteger(this.cellStyle) && this.cellStyle >= 0 ? this.cellStyle : 0,
        })
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
        if (text !== "") MutableHashMap.set(this.masters, this.formulaShared, { text, column, row });
        else {
          const master = MutableHashMap.get(this.masters, this.formulaShared);
          if (O.isSome(master)) {
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
      return trusted<XlsxUnreadable>({
        kind: "Unreadable",
        raw: detached(S.is(XlsxErrorCode)(written) ? `'${written}` : written),
      });
    };
    const written = this.hasValue || this.hasInline;
    const dated = style.dated;
    const value: XlsxValue = CellType.match(this.cellType, {
      inlineStr: () => (this.hasInline ? trusted<XlsxText>({ kind: "Text", text: detached(unescaped(raw)) }) : blank),
      s: () => {
        if (!written) return blank;
        const index = Number(Str.trim(raw));
        const text = Number.isInteger(index) && index >= 0 ? this.strings[index] : undefined;
        return text === undefined ? unreadable("sharedString") : trusted<XlsxText>({ kind: "Text", text });
      },
      str: () => (written ? trusted<XlsxText>({ kind: "Text", text: detached(unescaped(raw)) }) : blank),
      b: () => {
        if (!written) return blank;
        const text = Str.toLowerCase(Str.trim(raw));
        return text === "1" || text === "true" ? yes : text === "0" || text === "false" ? no : unreadable("boolean");
      },
      e: () => (written ? (S.is(XlsxErrorCode)(raw) ? XlsxError.make({ code: raw }) : unreadable("errorCode")) : blank),
      d: () => {
        if (!written) return blank;
        const found = isoDate.exec(Str.trim(raw));
        const serial = O.filter(
          found === null
            ? O.none()
            : serialOf({
                parts: {
                  year: Number(found[1]),
                  month: Number(found[2]),
                  day: Number(found[3]),
                  hour: Number(found[4] ?? "0"),
                  minute: Number(found[5] ?? "0"),
                  second: Number(found[6] ?? "0"),
                },
                date1904: this.date1904,
              }),
          (moment) => moment <= MAX_SERIAL
        );
        return O.match(serial, {
          onNone: () => unreadable("date"),
          onSome: (moment) => trusted<XlsxDate>({ kind: "Date", serial: moment }),
        });
      },
      n: () => {
        const text = Str.trim(raw);
        if (!written || text === "") return blank;
        const number = numberText.test(text) ? Number(text) : Number.NaN;
        if (!Number.isFinite(number)) return unreadable("number");
        return dated && number >= 0 && number <= MAX_SERIAL
          ? trusted<XlsxDate>({ kind: "Date", serial: number })
          : trusted<XlsxNumber>({ kind: "Number", value: number });
      },
    });
    // A date read from an ISO cell under a format that is not a date format is shown as Excel's short date; a number
    // becomes a date only under a date format, so this touches the ISO case alone.
    if (value.kind === "Date" && !dated) style = shortDate;
    if (value.kind === "Blank") {
      if (O.isNone(formula)) return;
      this.warn(FormulaWithoutResult.make({ sheet: this.sheet, address: address() }));
    } else if (value.kind === "Date") {
      if (!this.date1904 && Math.floor(value.serial) === 60) {
        this.warn(FictitiousLeapDay.make({ sheet: this.sheet, address: address() }));
      }
      if (style.notShown) this.countNotShown(style.format.code);
    } else if (value.kind === "Number" && style.notShown && !style.dated) this.countNotShown(style.format.code);
    if (column <= this.lastCellColumn) {
      for (const cell of this.cells) {
        if (cell.column === column) {
          this.warn(BadAddress.make({ sheet: this.sheet, row, raw: Str.slice(0, 255)(this.cellReference) }));
          return;
        }
      }
      this.cellsSorted = false;
    } else this.lastCellColumn = column;
    if (holdsSomething(value)) {
      this.held += 1;
      if (column < this.firstColumn) this.firstColumn = column;
      if (column > this.lastColumn) this.lastColumn = column;
    }
    this.cells.push(trusted<XlsxCell>({ column, value, formula, format: style.format }));
  }

  private countNotShown(code: string): void {
    MutableHashMap.set(this.notShown, code, O.getOrElse(MutableHashMap.get(this.notShown, code), () => 0) + 1);
  }
}
