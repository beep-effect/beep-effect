/**
 * The facade of the package: an .xlsx workbook read from bytes into one model with its findings, written back by
 * value, and the whole round trip as one `effect/Schema` codec. The engine is in `internal/` and hands findings
 * back as data; only this file builds the two errors.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { setOwnProperty } from "@beep/utils/Record";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as MutableHashMap from "effect/MutableHashMap";
import * as MutableHashSet from "effect/MutableHashSet";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as SchemaIssue from "effect/SchemaIssue";
import * as SchemaTransformation from "effect/SchemaTransformation";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import { ReadBudget } from "./internal/budget.ts";
import { bodiesOf, capsOf, partKey, sniffContainer, stop } from "./internal/container.ts";
import { renderGeneral } from "./internal/numberFormat.ts";
import { eventsOf } from "./internal/ooxml.ts";
import { SheetReader } from "./internal/sheet.ts";
import { open } from "./internal/workbookPart.ts";
import { archiveOf, partsOf } from "./internal/writer.ts";
import { MAX_COLUMN, MAX_ROW } from "./XlsxAddress.schema.ts";
import { XlsxBlank, XlsxCell, XlsxNumberFormat, XlsxText } from "./XlsxCell.schema.ts";
import { MissingPart } from "./XlsxDiagnostic.schema.ts";
import { XlsxParseError, XlsxStringifyError } from "./XlsxError.errors.ts";
import {
  XlsxCodecOptions,
  XlsxNamedSheets,
  XlsxReadOptions,
  XlsxSheetChoice,
  XlsxWriteOptions,
} from "./XlsxOptions.schema.ts";
import { XlsxOutline, XlsxRead, XlsxSheetOutline } from "./XlsxRead.schema.ts";
import {
  XlsxRecord,
  XlsxRow,
  XlsxSheetCount,
  XlsxSheetInfo,
  XlsxWorkbook,
  XlsxWorksheet,
} from "./XlsxWorkbook.schema.ts";
import type { RowInput, SheetLayout } from "./internal/sheet.ts";
import type { Opened, SheetEntry } from "./internal/workbookPart.ts";
import type { XlsxRange } from "./XlsxAddress.schema.ts";
import type { XlsxValue } from "./XlsxCell.schema.ts";
import type { XlsxContainer, XlsxFatal } from "./XlsxDiagnostic.schema.ts";
import type { XlsxSheetName } from "./XlsxWorkbook.schema.ts";

// decision: engine-makes-skip-filters
const checked = { disableChecks: true } as const;

const byNumber = Order.mapInput(Order.Number, (row: RowInput) => row.number);

const sortedUniqueRows = (rows: ReadonlyArray<RowInput>, unordered: boolean): ReadonlyArray<RowInput> =>
  unordered ? A.dedupeAdjacentWith(A.sort(rows, byNumber), (a, b) => a.number === b.number) : rows;

const readerOf = (opened: Opened, entry: SheetEntry, budget: ReadBudget): SheetReader =>
  new SheetReader({
    sheet: Str.slice(0, 255)(entry.name),
    path: entry.path,
    styles: opened.styles,
    strings: opened.strings,
    system: opened.dateSystem,
    caps: opened.caps,
    budget,
  });

interface SheetRead {
  readonly layout: SheetLayout;
  readonly rows: ReadonlyArray<RowInput>;
}

const readSheets = Effect.fnUntraced(function* (input: {
  readonly opened: Opened;
  readonly wanted: ReadonlyArray<SheetEntry>;
  readonly keep: boolean;
}) {
  const { opened, keep } = input;
  const budget = new ReadBudget(opened.caps);
  const firstSheetReaderByPart = MutableHashMap.empty<string, SheetReader>();
  for (const entry of input.wanted) {
    const key = partKey(entry.path);
    if (!MutableHashMap.has(firstSheetReaderByPart, key))
      MutableHashMap.set(firstSheetReaderByPart, key, readerOf(opened, entry, budget));
  }
  const reads = MutableHashMap.empty<string, SheetRead>();
  yield* bodiesOf(opened.bytes, (key) => MutableHashMap.has(firstSheetReaderByPart, key)).pipe(
    Stream.mapEffect((part) => {
      const found = MutableHashMap.get(firstSheetReaderByPart, part.key);
      if (O.isNone(found)) return Effect.void;
      const reader = found.value;
      const rows: Array<RowInput> = [];
      return eventsOf({ path: part.path, body: part.body, cellChars: opened.caps.cellChars }).pipe(
        Stream.runForEachArray((events) =>
          Effect.suspend(() => {
            // decision: hot-paths-are-mutable-loops
            for (const event of events) {
              const ended = reader.push(event);
              if (keep) for (const row of ended) rows.push(row);
            }
            return O.isSome(reader.failed) ? Effect.fail(reader.failed.value) : Effect.void;
          })
        ),
        Effect.map(() => {
          MutableHashMap.set(reads, part.key, { layout: reader.finish(), rows });
        })
      );
    }),
    Stream.runDrain
  );
  const readOf = (entry: SheetEntry): O.Option<SheetRead> => MutableHashMap.get(reads, partKey(entry.path));
  return { readOf, warnings: budget.warnings() };
});

const chosen = (opened: Opened, options: XlsxReadOptions): ReadonlyArray<SheetEntry> =>
  XlsxSheetChoice.match(options.sheets, {
    All: () => opened.sheets,
    First: () => A.take(opened.sheets, 1),
    Named: (choice) => {
      const names = MutableHashSet.fromIterable(A.map(choice.names, Str.toLowerCase));
      return A.filter(opened.sheets, (sheet) => MutableHashSet.has(names, Str.toLowerCase(sheet.name)));
    },
  });

const entryNamedIgnoringCase = (opened: Opened, sheet: string): Effect.Effect<SheetEntry, XlsxFatal> => {
  const wanted = Str.toLowerCase(sheet);
  return Effect.fromOption(A.findFirst(opened.sheets, (found) => Str.toLowerCase(found.name) === wanted)).pipe(
    Effect.mapError(() => stop(MissingPart.make({ path: Str.slice(0, 1024)(`the sheet ${sheet}`) })))
  );
};

const infoOf = (entry: SheetEntry, layout: O.Option<SheetLayout>): XlsxSheetInfo =>
  XlsxSheetInfo.make({
    name: entry.name,
    state: entry.state,
    declared: O.flatMap(layout, (found) => found.declared),
  });

const layoutParts = (
  layout: O.Option<SheetLayout>
): { readonly merges: ReadonlyArray<XlsxRange>; readonly hiddenColumns: ReadonlyArray<number> } => ({
  merges: O.getOrElse(
    O.map(layout, (found) => found.merges),
    A.empty
  ),
  hiddenColumns: O.getOrElse(
    O.map(layout, (found) => found.hiddenColumns),
    A.empty
  ),
});

const readWorkbook = Effect.fnUntraced(function* (bytes: Uint8Array, options: XlsxReadOptions) {
  const opened = yield* open({ bytes, caps: capsOf(options.limits) });
  const { readOf, warnings } = yield* readSheets({ opened, wanted: chosen(opened, options), keep: true });
  const sheets = A.map(opened.sheets, (entry) => {
    const read = readOf(entry);
    const layout = O.map(read, (found) => found.layout);
    return {
      info: infoOf(entry, layout),
      rows: O.getOrElse(
        O.map(read, (found) => sortedUniqueRows(found.rows, found.layout.unordered)),
        A.empty
      ),
      ...layoutParts(layout),
    };
  });
  return XlsxRead.make(
    { workbook: { dateSystem: opened.dateSystem, sheets, dropped: opened.dropped }, warnings },
    checked
  );
});

const parseError = (fatal: XlsxFatal): XlsxParseError => XlsxParseError.make({ fatal });

const onlySheet = (read: XlsxReadOptions, sheet: XlsxSheetName): XlsxReadOptions =>
  XlsxReadOptions.make({ limits: read.limits, sheets: XlsxNamedSheets.make({ names: [sheet] }) });

const issue = (error: { readonly message: string }, actual: unknown): SchemaIssue.Issue =>
  new SchemaIssue.InvalidValue({ message: error.message }, actual);

const write = (
  workbook: Pick<XlsxWorkbook, "dateSystem" | "sheets">,
  options: XlsxWriteOptions
): Effect.Effect<Uint8Array, XlsxStringifyError> =>
  Effect.mapError(
    Effect.suspend(() => archiveOf(partsOf(XlsxWorkbook.canonical(workbook)), options.compression)),
    (error) => XlsxStringifyError.make({ reason: error.message, cause: error })
  );

const headingOf = (value: XlsxValue): O.Option<string> =>
  value.kind === "Text" && value.text !== ""
    ? O.some(value.text)
    : value.kind === "Number"
      ? O.some(renderGeneral(value.value))
      : O.none();

type Headings = {
  readonly byColumn: HashMap.HashMap<number, string>;
  readonly inColumnOrder: ReadonlyArray<string>;
};

const byColumn = Order.mapInput(Order.Number, (entry: readonly [number, string]) => entry[0]);

const headingsOf = (
  header: XlsxRow,
  sheet: XlsxSheetName,
  bytes: Uint8Array
): Result.Result<Headings, SchemaIssue.Issue> => {
  const start: Result.Result<
    { readonly byColumn: HashMap.HashMap<number, string>; readonly used: HashSet.HashSet<string> },
    SchemaIssue.Issue
  > = Result.succeed({ byColumn: HashMap.empty(), used: HashSet.empty() });
  return Result.map(
    A.reduce(header.cells, start, (found, cell) =>
      Result.flatMap(found, ({ byColumn, used }) =>
        O.match(headingOf(cell.value), {
          onNone: () =>
            Result.fail(
              issue({ message: `the heading in column ${cell.column + 1} of "${sheet}" is not text` }, bytes)
            ),
          onSome: (heading) =>
            HashSet.has(used, heading)
              ? Result.fail(issue({ message: `the heading ${heading} is used twice` }, bytes))
              : Result.succeed({
                  byColumn: HashMap.set(byColumn, cell.column, heading),
                  used: HashSet.add(used, heading),
                }),
        })
      )
    ),
    (found) => ({
      byColumn: found.byColumn,
      inColumnOrder: A.map(A.sort(HashMap.toEntries(found.byColumn), byColumn), ([, heading]) => heading),
    })
  );
};

const blank = XlsxBlank.make({});

const recordOf = (
  row: XlsxRow,
  headings: Headings,
  sheet: XlsxSheetName,
  bytes: Uint8Array
): Result.Result<XlsxRecord, SchemaIssue.Issue> =>
  O.match(
    A.findFirst(row.cells, (cell) => cell.value.kind !== "Blank" && !HashMap.has(headings.byColumn, cell.column)),
    {
      onSome: (cell) =>
        Result.fail(
          issue(
            { message: `the cell in column ${cell.column + 1} of row ${row.number} of "${sheet}" has no heading` },
            bytes
          )
        ),
      onNone: () => {
        const record: { [heading: string]: XlsxValue } = {};
        for (const heading of headings.inColumnOrder) setOwnProperty(record, heading, blank);
        for (const cell of row.cells) {
          const heading = HashMap.get(headings.byColumn, cell.column);
          if (O.isSome(heading)) setOwnProperty(record, heading.value, cell.value);
        }
        return Result.succeed(record);
      },
    }
  );

const withinRecordValues = (
  headings: Headings,
  sheet: XlsxWorksheet,
  input: { readonly bytes: Uint8Array; readonly maxRecordValues: number }
): Result.Result<Headings, SchemaIssue.Issue> => {
  const values = headings.inColumnOrder.length * (sheet.rows.length - 1);
  return values > input.maxRecordValues
    ? Result.fail(
        issue(
          {
            message: `the records of "${sheet.info.name}" would hold ${values} values, more than the ${input.maxRecordValues} of maxRecordValues`,
          },
          input.bytes
        )
      )
    : Result.succeed(headings);
};

const toRecords = (
  sheet: XlsxWorksheet,
  input: { readonly bytes: Uint8Array; readonly maxRecordValues: number }
): Result.Result<ReadonlyArray<XlsxRecord>, SchemaIssue.Issue> =>
  O.match(A.head(sheet.rows), {
    onNone: () => Result.succeed([]),
    onSome: (header) =>
      headingsOf(header, sheet.info.name, input.bytes).pipe(
        Result.flatMap((headings) => withinRecordValues(headings, sheet, input)),
        Result.flatMap((headings) =>
          Result.all(A.map(A.drop(sheet.rows, 1), (row) => recordOf(row, headings, sheet.info.name, input.bytes)))
        )
      ),
  });

const fromRecords = (
  records: ReadonlyArray<XlsxRecord>,
  name: XlsxSheetName
): Result.Result<XlsxWorkbook, SchemaIssue.Issue> => {
  const headings = A.dedupe(A.flatMap(records, R.keys));
  if (headings.length === 0 && records.length > 0) {
    return Result.fail(issue({ message: "records with no heading cannot be written under a header row" }, records));
  }
  if (headings.length > MAX_COLUMN + 1) {
    return Result.fail(
      issue(
        { message: `the records have ${headings.length} headings, more than the ${MAX_COLUMN + 1} columns of a sheet` },
        records
      )
    );
  }
  if (records.length > MAX_ROW - 1) {
    return Result.fail(
      issue(
        { message: `${records.length} records are more than the ${MAX_ROW - 1} rows below a sheet's header` },
        records
      )
    );
  }
  const header = XlsxRow.make({
    number: 1,
    cells: A.map(headings, (heading, column) => XlsxCell.make({ column, value: XlsxText.make({ text: heading }) })),
  });
  const rows = A.map(records, (record, index) =>
    XlsxRow.make({
      number: index + 2,
      cells: A.getSomes(
        A.map(headings, (heading, column) =>
          O.map(
            O.filter(R.get(record, heading), (value) => value.kind !== "Blank"),
            (value) =>
              value.kind === "Date"
                ? XlsxCell.make({ column, value, format: XlsxNumberFormat.shortDate })
                : XlsxCell.make({ column, value })
          )
        )
      ),
    })
  );
  return Result.succeed(
    XlsxWorkbook.make({
      sheets: [
        XlsxWorksheet.make({
          info: XlsxSheetInfo.make({ name }),
          rows: headings.length === 0 ? [] : [header, ...rows],
        }),
      ],
    })
  );
};

/**
 * An Excel workbook, read and written.
 *
 * **When to use**
 *
 * Use to read .xlsx bytes into an {@link XlsxWorkbook} with its warnings (`parse`), to look at a workbook without
 * keeping its rows (`container`, `outline`, `sheets`, `sheetLayout`), to stream one sheet's rows (`rows`), to write
 * a workbook back (`stringify`), or to treat the round trip as an `effect/Schema` codec (`fromBytes`,
 * `recordsFromBytes`, `sheetFromBytes`) for `S.decodeEffect` and `S.encodeEffect`.
 *
 * **Details**
 *
 * Every read fails with {@link XlsxParseError}, which carries the finding that stopped it. The codecs report the
 * same failure as a schema issue and drop the warnings a read went past; `parse` keeps them. A write fails with
 * {@link XlsxStringifyError} only when the zip writer does; a runtime without `CompressionStream` dies instead.
 *
 * **Example** (Write a workbook and read it back)
 *
 * ```ts import.meta.vitest name="Write a workbook and read it back"
 * import { Xlsx } from "@beep/xlsx/Xlsx.codec"
 * import { XlsxCell, XlsxNumber, XlsxText } from "@beep/xlsx/XlsxCell.schema"
 * import { XlsxRow, XlsxSheetInfo, XlsxWorkbook, XlsxWorksheet } from "@beep/xlsx/XlsxWorkbook.schema"
 * import * as Effect from "effect/Effect"
 *
 * const header = XlsxRow.make({
 *   number: 1,
 *   cells: [
 *     XlsxCell.make({ column: 0, value: XlsxText.make({ text: "SKU" }) }),
 *     XlsxCell.make({ column: 1, value: XlsxText.make({ text: "Quantity" }) })
 *   ]
 * })
 * const line = XlsxRow.make({
 *   number: 2,
 *   cells: [
 *     XlsxCell.make({ column: 0, value: XlsxText.make({ text: "BRK-040" }) }),
 *     XlsxCell.make({ column: 1, value: XlsxNumber.make({ value: 120 }) })
 *   ]
 * })
 * const workbook = XlsxWorkbook.make({
 *   sheets: [XlsxWorksheet.make({ info: XlsxSheetInfo.make({ name: "Items" }), rows: [header, line] })]
 * })
 *
 * const program = Effect.gen(function* () {
 *   const bytes = yield* Xlsx.stringify(workbook)
 *   const read = yield* Xlsx.parse(bytes)
 *   const counts = yield* Xlsx.sheets(bytes)
 *   return {
 *     container: Xlsx.container(bytes),
 *     rows: read.workbook.sheets[0].rows.length,
 *     cells: counts[0]?.cellsWithValues
 *   }
 * })
 *
 * const summary = await Effect.runPromise(program)
 * summary // => { container: "workbook", rows: 2, cells: 4 }
 * ```
 *
 * **Example** (Decode a sheet through a row schema)
 *
 * ```ts import.meta.vitest name="Decode a sheet through a row schema"
 * import { Xlsx } from "@beep/xlsx/Xlsx.codec"
 * import { XlsxNumber, XlsxText } from "@beep/xlsx/XlsxCell.schema"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 *
 * const Item = S.Struct({ SKU: S.toType(XlsxText), Quantity: S.toType(XlsxNumber) })
 * const codec = Xlsx.sheetFromBytes(Item, { sheet: "Items", header: "first" })
 *
 * const program = Effect.gen(function* () {
 *   const bytes = yield* S.encodeEffect(codec)([
 *     { SKU: XlsxText.make({ text: "BRK-040" }), Quantity: XlsxNumber.make({ value: 120 }) },
 *     { SKU: XlsxText.make({ text: "HB-M8-30" }), Quantity: XlsxNumber.make({ value: 1500 }) }
 *   ])
 *   const items = yield* S.decodeEffect(codec)(bytes)
 *   return items.map((item) => `${item.SKU.text} x${item.Quantity.value}`)
 * })
 *
 * const lines = await Effect.runPromise(program)
 * lines // => ["BRK-040 x120", "HB-M8-30 x1500"]
 * ```
 *
 * **Example** (Stream one sheet's rows)
 *
 * ```ts import.meta.vitest name="Stream one sheet's rows"
 * import { Xlsx } from "@beep/xlsx/Xlsx.codec"
 * import { XlsxCell, XlsxNumber, XlsxText } from "@beep/xlsx/XlsxCell.schema"
 * import { XlsxRow, XlsxSheetInfo, XlsxWorkbook, XlsxWorksheet } from "@beep/xlsx/XlsxWorkbook.schema"
 * import * as Effect from "effect/Effect"
 * import * as Stream from "effect/Stream"
 *
 * const header = XlsxRow.make({
 *   number: 1,
 *   cells: [
 *     XlsxCell.make({ column: 0, value: XlsxText.make({ text: "SKU" }) }),
 *     XlsxCell.make({ column: 1, value: XlsxText.make({ text: "Quantity" }) })
 *   ]
 * })
 * const line = XlsxRow.make({
 *   number: 2,
 *   cells: [
 *     XlsxCell.make({ column: 0, value: XlsxText.make({ text: "BRK-040" }) }),
 *     XlsxCell.make({ column: 1, value: XlsxNumber.make({ value: 120 }) })
 *   ]
 * })
 * const workbook = XlsxWorkbook.make({
 *   sheets: [XlsxWorksheet.make({ info: XlsxSheetInfo.make({ name: "Items" }), rows: [header, line] })]
 * })
 *
 * const program = Effect.gen(function* () {
 *   const bytes = yield* Xlsx.stringify(workbook)
 *   const rows = yield* Stream.runCollect(Xlsx.rows(bytes, "items"))
 *   const missing = yield* Effect.flip(Stream.runCollect(Xlsx.rows(bytes, "Notes")))
 *   return { numbers: rows.map((row) => row.number), missing: missing.fatal.finding.kind }
 * })
 *
 * const streamed = await Effect.runPromise(program)
 * streamed // => { numbers: [1, 2], missing: "MissingPart" }
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export class Xlsx {
  private constructor() {}

  /** What a file is, from its first bytes and the names inside. Pure, and reads no part. */
  static container(bytes: Uint8Array): XlsxContainer {
    return sniffContainer(bytes);
  }

  /** Reads a workbook: its sheets with their rows, and the oddities read past. Fails with `XlsxParseError`. */
  static readonly parse = Effect.fn("Xlsx.parse")(
    (bytes: Uint8Array, options: XlsxReadOptions = XlsxReadOptions.default) =>
      Effect.mapError(readWorkbook(bytes, options), parseError)
  );

  /**
   * The workbook without its rows: its date system, and every sheet counted with its merged ranges and hidden
   * columns. One pass over the sheets, none kept.
   */
  static readonly outline = Effect.fn("Xlsx.outline")(function* (
    bytes: Uint8Array,
    options: XlsxReadOptions = XlsxReadOptions.default
  ) {
    const opened = yield* open({ bytes, caps: capsOf(options.limits) });
    const { readOf } = yield* readSheets({ opened, wanted: opened.sheets, keep: false });
    return XlsxOutline.make({
      dateSystem: opened.dateSystem,
      sheets: A.map(opened.sheets, (entry) => {
        const layout = O.map(readOf(entry), (found) => found.layout);
        const counted = (pick: (found: SheetLayout) => number): number => O.getOrElse(O.map(layout, pick), () => 0);
        return XlsxSheetOutline.make({
          count: XlsxSheetCount.make({
            info: infoOf(entry, layout),
            rows: counted((found) => found.rows),
            rowsWithValues: counted((found) => found.rowsWithValues),
            cellsWithValues: counted((found) => found.cellsWithValues),
            lastRow: O.flatMap(layout, (found) => found.lastRow),
          }),
          ...layoutParts(layout),
        });
      }),
    });
  }, Effect.mapError(parseError));

  /** Every sheet counted, none kept: what a sheet chooser shows and what "the sheet with the most data" is. */
  static readonly sheets = Effect.fn("Xlsx.sheets")(
    (bytes: Uint8Array, options: XlsxReadOptions = XlsxReadOptions.default) =>
      Effect.map(Xlsx.outline(bytes, options), (outline) => A.map(outline.sheets, (sheet) => sheet.count))
  );

  /**
   * One sheet's rows as they are read, in the order the file wrote them. A sheet the workbook lacks fails with
   * `MissingPart`. A sheet written out of order can repeat a row number; `parse` keeps the first such row and this
   * stream hands on each. When a cap is passed or the XML is damaged, the rows before it have been emitted and the
   * stream then fails with `XlsxParseError`. The oddities read past are not reported here; `parse` reports them.
   */
  static rows(
    bytes: Uint8Array,
    sheet: string,
    options: XlsxReadOptions = XlsxReadOptions.default
  ): Stream.Stream<XlsxRow, XlsxParseError> {
    return Stream.unwrap(
      Effect.flatMap(open({ bytes, caps: capsOf(options.limits) }), (opened) =>
        Effect.map(entryNamedIgnoringCase(opened, sheet), (entry) => {
          const reader = readerOf(opened, entry, new ReadBudget(opened.caps));
          const key = partKey(entry.path);
          return bodiesOf(bytes, (found) => found === key).pipe(
            Stream.take(1),
            Stream.flatMap((part) => eventsOf({ path: part.path, body: part.body, cellChars: opened.caps.cellChars })),
            Stream.takeWhile(() => O.isNone(reader.failed)),
            Stream.mapAccum(
              () => reader,
              (state, event) => [state, state.push(event)] as const
            ),
            Stream.map((row) => XlsxRow.make(row, checked)),
            Stream.concat(
              Stream.suspend(() => O.match(reader.failed, { onNone: () => Stream.empty, onSome: Stream.fail }))
            )
          );
        })
      )
    ).pipe(Stream.mapError(parseError));
  }

  /** One sheet without its rows: its declared extent, merged ranges and hidden columns. */
  static readonly sheetLayout = Effect.fn("Xlsx.sheetLayout")(function* (
    bytes: Uint8Array,
    sheet: string,
    options: XlsxReadOptions = XlsxReadOptions.default
  ) {
    const opened = yield* open({ bytes, caps: capsOf(options.limits) });
    const entry = yield* entryNamedIgnoringCase(opened, sheet);
    const { readOf } = yield* readSheets({ opened, wanted: [entry], keep: false });
    const layout = O.map(readOf(entry), (found) => found.layout);
    return XlsxWorksheet.make({ info: infoOf(entry, layout), ...layoutParts(layout) });
  }, Effect.mapError(parseError));

  /**
   * Writes a workbook's values as .xlsx bytes, in its canonical form. An Effect, because deflating uses the
   * runtime's `CompressionStream`; a runtime without one dies (as `effect/encoding/Zip` does), so write with
   * `compression: "store"` there. A failure of the zip writer is an `XlsxStringifyError` carrying it as its cause.
   * Sheet names are written as the schema holds them and are not checked against Excel's rules: a name another
   * program wrote comes back as it was, and a workbook meant for Excel should pass `fitsExcel` for each sheet first.
   */
  static readonly stringify = Effect.fn("Xlsx.stringify")(
    (workbook: Pick<XlsxWorkbook, "dateSystem" | "sheets">, options: XlsxWriteOptions = XlsxWriteOptions.default) =>
      write(workbook, options)
  );

  /**
   * The whole round trip as one codec: .xlsx bytes on the encoded side, a workbook on the decoded side. Use it with
   * Effect's effectful decoders and encoders. It has nowhere to put warnings, so it drops them; `parse` keeps them.
   */
  static fromBytes(options: XlsxCodecOptions = XlsxCodecOptions.default): S.Codec<XlsxWorkbook, Uint8Array> {
    return S.Uint8Array.pipe(
      S.decodeTo(
        S.toType(XlsxWorkbook),
        SchemaTransformation.transformEffect({
          decode: (bytes: Uint8Array) =>
            Effect.mapBoth(readWorkbook(bytes, options.read), {
              onSuccess: (read) => read.workbook,
              onFailure: (fatal) => issue(parseError(fatal), bytes),
            }),
          encode: (workbook: XlsxWorkbook) =>
            Effect.mapError(write(workbook, options.write), (error) => issue(error, workbook)),
        })
      )
    );
  }

  /** `fromBytes` with the starting options. */
  static readonly XlsxFromBytes: S.Codec<XlsxWorkbook, Uint8Array> = Xlsx.fromBytes();

  /**
   * One sheet as records under the headings of its first row, each heading an own property and each value what the
   * cell holds. Writing puts the records on one sheet of that name. A header row with a heading that is not text or
   * is used twice, or a cell with a value in a column the header row has no heading for, fails the decode, as do
   * records that would hold more values than `read.limits.maxRecordValues`, blanks included. The named sheet is the
   * one read, whatever `read.sheets` chooses; a sheet that holds no rows gives no records.
   *
   * **Details**
   *
   * Writing puts the headings in the first row and a date under Excel's short date. It refuses records with more
   * headings than a sheet has columns, more records than it has rows below its header, or records with no heading at
   * all (whose header row would be empty, so a read gives no records back), so nothing is written that a read could
   * not give back.
   */
  static recordsFromBytes(
    input: { readonly sheet: XlsxSheetName; readonly header: "first" },
    options: XlsxCodecOptions = XlsxCodecOptions.default
  ): S.Codec<ReadonlyArray<XlsxRecord>, Uint8Array> {
    return S.Uint8Array.pipe(
      S.decodeTo(
        XlsxRecord.pipe(S.Array, S.toType),
        SchemaTransformation.transformEffect({
          decode: (bytes: Uint8Array) =>
            Effect.flatMap(
              Effect.mapError(readWorkbook(bytes, onlySheet(options.read, input.sheet)), (fatal) =>
                issue(parseError(fatal), bytes)
              ),
              (read) =>
                O.match(XlsxWorkbook.sheet(read.workbook, input.sheet), {
                  onNone: () => Effect.fail(issue({ message: `the workbook has no sheet ${input.sheet}` }, bytes)),
                  onSome: (sheet) =>
                    Effect.fromResult(
                      toRecords(sheet, { bytes, maxRecordValues: options.read.limits.maxRecordValues })
                    ),
                })
            ),
          encode: (records: ReadonlyArray<XlsxRecord>) =>
            Effect.flatMap(Effect.fromResult(fromRecords(records, input.sheet)), (workbook) =>
              Effect.mapError(write(workbook, options.write), (error) => issue(error, records))
            ),
        })
      )
    );
  }

  /** One sheet's rows decoded through a row schema, under the headings of its first row. */
  static sheetFromBytes<A, RD = never, RE = never>(
    row: S.Codec<A, XlsxRecord, RD, RE>,
    input: { readonly sheet: XlsxSheetName; readonly header: "first" },
    options: XlsxCodecOptions = XlsxCodecOptions.default
  ): S.Codec<ReadonlyArray<A>, Uint8Array, RD, RE> {
    return Xlsx.recordsFromBytes(input, options).pipe(S.decodeTo(S.Array(row)));
  }
}
