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
import { bodiesOf, capsOf, sniffContainer, stop } from "./internal/container.ts";
import { renderGeneral } from "./internal/numberFormat.ts";
import { eventsOf } from "./internal/ooxml.ts";
import { SheetReader } from "./internal/sheet.ts";
import { trusted } from "./internal/trusted.ts";
import { open } from "./internal/workbookPart.ts";
import { archiveOf, partsOf } from "./internal/writer.ts";
import { XlsxBlank, XlsxCell, XlsxNumberFormat, XlsxText, XlsxValue } from "./XlsxCell.schema.ts";
import { MissingPart } from "./XlsxDiagnostic.schema.ts";
import { XlsxParseError, XlsxStringifyError } from "./XlsxError.errors.ts";
import { XlsxCodecOptions, XlsxReadOptions, XlsxSheetChoice, XlsxWriteOptions } from "./XlsxOptions.schema.ts";
import { XlsxOutline, XlsxSheetOutline } from "./XlsxRead.schema.ts";
import { XlsxRow, XlsxSheetCount, XlsxSheetInfo, XlsxWorkbook, XlsxWorksheet } from "./XlsxWorkbook.schema.ts";
import type { SheetLayout } from "./internal/sheet.ts";
import type { Opened, SheetEntry } from "./internal/workbookPart.ts";
import type { XlsxContainer, XlsxFatal, XlsxWarning } from "./XlsxDiagnostic.schema.ts";
import type { XlsxRead } from "./XlsxRead.schema.ts";
import type { XlsxSheetName } from "./XlsxWorkbook.schema.ts";

type ReadOptions = XlsxCodecOptions["read"];
type WriteOptions = XlsxCodecOptions["write"];
type CodecOptions = XlsxCodecOptions | { readonly read: ReadOptions; readonly write: WriteOptions };

/**
 * One row of a sheet under its first row's headings: each heading an own property, each value what the cell holds.
 *
 * **Details**
 *
 * A heading that would be a property of every object, such as `constructor`, is still an own property. A cell the
 * row lacks under a heading reads as {@link XlsxBlank}.
 *
 * @see {@link Xlsx.recordsFromBytes} for the codec that reads and writes records.
 * @category models
 * @since 0.0.0
 */
export type XlsxRecord = { readonly [heading: string]: XlsxValue };

/**
 * A codec bound to a target schema, with its two directions as functions.
 *
 * **Example** (Round-trip a workbook through a bound codec)
 *
 * ```ts
 * import { Xlsx, XlsxSheetInfo, XlsxWorkbook, XlsxWorksheet } from "@beep/xlsx"
 * import * as Effect from "effect/Effect"
 *
 * const codec = Xlsx.bind(Xlsx.XlsxFromBytes)
 * const workbook = XlsxWorkbook.make({ sheets: [XlsxWorksheet.make({ info: XlsxSheetInfo.make({ name: "Items" }) })] })
 *
 * const program = Effect.gen(function* () {
 *   const bytes = yield* codec.encode(workbook)
 *   const back = yield* codec.decode(bytes)
 *   return back.sheets[0].info.name
 * })
 *
 * const name = await Effect.runPromise(program)
 * name // => "Items"
 * ```
 *
 * @see {@link Xlsx.bind} for the constructor.
 * @category models
 * @since 0.0.0
 */
export interface XlsxBoundCodec<T> {
  readonly decode: (bytes: Uint8Array) => Effect.Effect<T, S.SchemaError>;
  readonly encode: (value: T) => Effect.Effect<Uint8Array, S.SchemaError>;
  readonly schema: S.Codec<T, Uint8Array>;
}

const byNumber = Order.mapInput(Order.Number, (row: XlsxRow) => row.number);

/** The rows of a sheet in rising order with no number twice, whatever order the file wrote them in. */
const settled = (rows: Array<XlsxRow>, unordered: boolean): ReadonlyArray<XlsxRow> =>
  unordered ? A.dedupeAdjacentWith(A.sort(rows, byNumber), (a, b) => a.number === b.number) : rows;

const readerOf = (opened: Opened, entry: SheetEntry): SheetReader =>
  new SheetReader({
    sheet: Str.slice(0, 255)(entry.name),
    path: entry.path,
    styles: opened.styles,
    strings: opened.strings,
    date1904: opened.dateSystem === "1904",
    caps: opened.caps,
  });

interface SheetRead {
  layout: O.Option<SheetLayout>;
  readonly reader: SheetReader;
  readonly rows: Array<XlsxRow>;
}

/** Reads the XML of the wanted sheets in one pass over the archive, keeping their rows when asked to. */
const readSheets = Effect.fnUntraced(function* (input: {
  readonly opened: Opened;
  readonly wanted: ReadonlyArray<SheetEntry>;
  readonly keep: boolean;
}) {
  const { opened, keep } = input;
  const reads = MutableHashMap.empty<string, SheetRead>();
  for (const entry of input.wanted) {
    if (!MutableHashMap.has(reads, entry.path)) {
      MutableHashMap.set(reads, entry.path, { reader: readerOf(opened, entry), rows: [], layout: O.none() });
    }
  }
  yield* bodiesOf({ bytes: opened.bytes, wanted: (path) => MutableHashMap.has(reads, path) }).pipe(
    Stream.mapEffect((part) => {
      const found = MutableHashMap.get(reads, part.path);
      if (O.isNone(found)) return Effect.void;
      const read = found.value;
      return eventsOf({ path: part.path, body: part.body, cellChars: opened.caps.cellChars }).pipe(
        Stream.runForEachArray((events) =>
          Effect.suspend(() => {
            for (const event of events) {
              const rows = read.reader.push(event);
              if (keep) for (const row of rows) read.rows.push(row);
            }
            return O.isSome(read.reader.failed) ? Effect.fail(read.reader.failed.value) : Effect.void;
          })
        ),
        Effect.map(() => {
          read.layout = O.some(read.reader.finish());
        })
      );
    }),
    Stream.runDrain
  );
  return reads;
});

const chosen = (opened: Opened, options: ReadOptions): ReadonlyArray<SheetEntry> =>
  XlsxSheetChoice.match(options.sheets, {
    All: () => opened.sheets,
    First: () => A.take(opened.sheets, 1),
    Named: (choice) => {
      const names = MutableHashSet.fromIterable(A.map(choice.names, Str.toLowerCase));
      return A.filter(opened.sheets, (sheet) => MutableHashSet.has(names, Str.toLowerCase(sheet.name)));
    },
  });

const infoOf = (entry: SheetEntry, layout: O.Option<SheetLayout>): XlsxSheetInfo =>
  XlsxSheetInfo.make({
    name: entry.name,
    state: entry.state,
    declared: O.flatMap(layout, (found) => found.declared),
  });

const readWorkbook = Effect.fnUntraced(function* (bytes: Uint8Array, options: ReadOptions) {
  const opened = yield* open({ bytes, caps: capsOf(options.limits) });
  const reads = yield* readSheets({ opened, wanted: chosen(opened, options), keep: true });
  const warnings: Array<XlsxWarning> = [];
  const sheets = A.map(opened.sheets, (entry) => {
    const read = MutableHashMap.get(reads, entry.path);
    const layout = O.flatMap(read, (found) => found.layout);
    if (O.isSome(read)) for (const warning of read.value.reader.warnings) warnings.push(warning);
    return trusted<XlsxWorksheet>({
      info: infoOf(entry, layout),
      rows: O.match(read, {
        onNone: () => [],
        onSome: (found) =>
          settled(
            found.rows,
            O.exists(found.layout, (l) => l.unordered)
          ),
      }),
      merges: O.match(layout, { onNone: () => [], onSome: (found) => found.merges }),
      hiddenColumns: O.match(layout, { onNone: () => [], onSome: (found) => A.dedupe(found.hiddenColumns) }),
    });
  });
  const first = sheets[0];
  if (first === undefined) return yield* Effect.die("a workbook that opened has a sheet");
  return {
    workbook: trusted<XlsxWorkbook>({
      dateSystem: opened.dateSystem,
      sheets: [first, ...A.drop(sheets, 1)],
      dropped: opened.dropped,
    }),
    warnings,
  };
});

const readOf = (found: { readonly workbook: XlsxWorkbook; readonly warnings: ReadonlyArray<XlsxWarning> }): XlsxRead =>
  trusted<XlsxRead>(found);

const parseError = (fatal: XlsxFatal): XlsxParseError => XlsxParseError.make({ fatal });

const issue = (error: { readonly message: string }, actual: unknown): SchemaIssue.Issue =>
  new SchemaIssue.InvalidValue({ message: error.message }, actual);

const write = (
  workbook: Pick<XlsxWorkbook, "dateSystem" | "sheets">,
  options: WriteOptions
): Effect.Effect<Uint8Array, XlsxStringifyError> =>
  Effect.mapError(
    Effect.suspend(() =>
      archiveOf({
        parts: partsOf(XlsxWorkbook.canonical(workbook)),
        method: options.compression === "store" ? "Store" : "Deflate",
      })
    ),
    (error) => XlsxStringifyError.make({ reason: error.message })
  );

const headingOf = (value: XlsxValue): O.Option<string> =>
  value.kind === "Text" && value.text !== ""
    ? O.some(value.text)
    : value.kind === "Number"
      ? O.some(renderGeneral(value.value))
      : O.none();

/** A sheet's rows under the headings of its first row. A heading that is empty or used twice stops the read. */
const toRecords = (sheet: Pick<XlsxWorksheet, "rows" | "info">): Result.Result<ReadonlyArray<XlsxRecord>, string> => {
  const header = sheet.rows[0];
  if (header === undefined) return Result.succeed([]);
  const headings = MutableHashMap.empty<number, string>();
  const used = MutableHashSet.empty<string>();
  for (const cell of header.cells) {
    const heading = headingOf(cell.value);
    if (O.isNone(heading))
      return Result.fail(`the heading in column ${cell.column + 1} of "${sheet.info.name}" is not text`);
    if (MutableHashSet.has(used, heading.value)) return Result.fail(`the heading ${heading.value} is used twice`);
    MutableHashSet.add(used, heading.value);
    MutableHashMap.set(headings, cell.column, heading.value);
  }
  const blank = XlsxBlank.make({});
  return Result.succeed(
    A.map(A.drop(sheet.rows, 1), (row) => {
      const record: { [heading: string]: XlsxValue } = {};
      for (const [, heading] of headings) setOwnProperty(record, heading, blank);
      for (const cell of row.cells) {
        const heading = MutableHashMap.get(headings, cell.column);
        if (O.isSome(heading)) setOwnProperty(record, heading.value, cell.value);
      }
      return record;
    })
  );
};

/** Records as one sheet: the headings of the first record in the first row, a date under Excel's short date. */
const fromRecords = (records: ReadonlyArray<XlsxRecord>, name: XlsxSheetName): XlsxWorkbook => {
  const headings: Array<string> = [];
  const seen = MutableHashSet.empty<string>();
  for (const record of records) {
    for (const heading of R.keys(record)) {
      if (MutableHashSet.has(seen, heading)) continue;
      MutableHashSet.add(seen, heading);
      headings.push(heading);
    }
  }
  const shortDate = XlsxNumberFormat.make({ id: 14, code: "m/d/yy" });
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
                ? XlsxCell.make({ column, value, format: shortDate })
                : XlsxCell.make({ column, value })
          )
        )
      ),
    })
  );
  return XlsxWorkbook.make({
    sheets: [
      XlsxWorksheet.make({ info: XlsxSheetInfo.make({ name }), rows: headings.length === 0 ? [] : [header, ...rows] }),
    ],
  });
};

/**
 * An Excel workbook, read and written.
 *
 * **When to use**
 *
 * Use to read .xlsx bytes into an {@link XlsxWorkbook} with its warnings (`parse`, `parseResult`), to look at a
 * workbook without keeping its rows (`container`, `outline`, `sheets`, `sheetLayout`), to stream one sheet's
 * rows (`rows`), to write a workbook back (`stringify`), or to treat the round trip as an `effect/Schema` codec
 * (`fromBytes`, `recordsFromBytes`, `sheetFromBytes`, `bind`).
 *
 * **Details**
 *
 * Every read fails with {@link XlsxParseError}, which carries the finding that stopped it. The codecs report the
 * same failure as a schema issue and drop the warnings a read went past; `parse` keeps them.
 *
 * **Example** (Write a workbook and read it back)
 *
 * ```ts
 * import { Xlsx, XlsxCell, XlsxNumber, XlsxRow, XlsxSheetInfo, XlsxText, XlsxWorkbook, XlsxWorksheet } from "@beep/xlsx"
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
 * ```ts
 * import { Xlsx, XlsxNumber, XlsxText } from "@beep/xlsx"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 *
 * const Item = S.Struct({ SKU: S.toType(XlsxText), Quantity: S.toType(XlsxNumber) })
 * const codec = Xlsx.bind(Xlsx.sheetFromBytes(Item, { sheet: "Items", header: "first" }))
 *
 * const program = Effect.gen(function* () {
 *   const bytes = yield* codec.encode([
 *     { SKU: XlsxText.make({ text: "BRK-040" }), Quantity: XlsxNumber.make({ value: 120 }) },
 *     { SKU: XlsxText.make({ text: "HB-M8-30" }), Quantity: XlsxNumber.make({ value: 1500 }) }
 *   ])
 *   const items = yield* codec.decode(bytes)
 *   return items.map((item) => `${item.SKU.text} x${item.Quantity.value}`)
 * })
 *
 * const lines = await Effect.runPromise(program)
 * lines // => ["BRK-040 x120", "HB-M8-30 x1500"]
 * ```
 *
 * **Example** (Stream one sheet's rows)
 *
 * ```ts
 * import { Xlsx, XlsxCell, XlsxNumber, XlsxRow, XlsxSheetInfo, XlsxText, XlsxWorkbook, XlsxWorksheet } from "@beep/xlsx"
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
 * **Example** (Read without running an Effect)
 *
 * ```ts
 * import { Xlsx } from "@beep/xlsx"
 * import * as Result from "effect/Result"
 *
 * const result = Xlsx.parseResult(new Uint8Array([0x50, 0x4b, 0x03, 0x04]))
 * Result.isFailure(result) // => true
 * const kind = Result.match(result, { onSuccess: () => "read", onFailure: (error) => error.fatal.finding.kind })
 * kind // => "NotAWorkbook"
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

  /** Reads a workbook: its sheets with their rows, and the oddities read past. */
  static readonly parse = Effect.fn("Xlsx.parse")(
    (bytes: Uint8Array, options: XlsxReadOptions | ReadOptions = XlsxReadOptions.default) =>
      readWorkbook(bytes, options).pipe(Effect.mapBoth({ onSuccess: readOf, onFailure: parseError }))
  );

  /** `parse` as a `Result`: reading has no asynchronous step. */
  static parseResult(
    bytes: Uint8Array,
    options: XlsxReadOptions | ReadOptions = XlsxReadOptions.default
  ): Result.Result<XlsxRead, XlsxParseError> {
    return Effect.runSync(
      readWorkbook(bytes, options).pipe(Effect.mapBoth({ onSuccess: readOf, onFailure: parseError }), Effect.result)
    );
  }

  /**
   * The workbook without its rows: its date system, and every sheet counted with its merged ranges and hidden
   * columns. One pass over the sheets, none kept.
   */
  static readonly outline = Effect.fn("Xlsx.outline")(function* (
    bytes: Uint8Array,
    options: XlsxReadOptions | ReadOptions = XlsxReadOptions.default
  ) {
    const opened = yield* open({ bytes, caps: capsOf(options.limits) });
    const reads = yield* readSheets({ opened, wanted: opened.sheets, keep: false });
    return XlsxOutline.make({
      dateSystem: opened.dateSystem,
      sheets: A.map(opened.sheets, (entry) => {
        const layout = O.flatMap(MutableHashMap.get(reads, entry.path), (found) => found.layout);
        return XlsxSheetOutline.make({
          count: XlsxSheetCount.make({
            info: infoOf(entry, layout),
            rows: O.match(layout, { onNone: () => 0, onSome: (found) => found.rows }),
            rowsWithValues: O.match(layout, { onNone: () => 0, onSome: (found) => found.rowsWithValues }),
            cellsWithValues: O.match(layout, { onNone: () => 0, onSome: (found) => found.cellsWithValues }),
            lastRow: O.flatMap(layout, (found) => found.lastRow),
          }),
          merges: O.match(layout, { onNone: () => [], onSome: (found) => found.merges }),
          hiddenColumns: O.match(layout, { onNone: () => [], onSome: (found) => A.dedupe(found.hiddenColumns) }),
        });
      }),
    });
  }, Effect.mapError(parseError));

  /** Every sheet counted, none kept: what a sheet chooser shows and what "the sheet with the most data" is. */
  static readonly sheets = Effect.fn("Xlsx.sheets")(
    (bytes: Uint8Array, options: XlsxReadOptions | ReadOptions = XlsxReadOptions.default) =>
      Effect.map(Xlsx.outline(bytes, options), (outline) => A.map(outline.sheets, (sheet) => sheet.count))
  );

  /**
   * One sheet's rows as they are read, in the order the file wrote them. A sheet the workbook lacks fails with
   * `MissingPart`. The oddities read past are not reported here; `parse` reports them.
   */
  static rows(
    bytes: Uint8Array,
    sheet: string,
    options: XlsxReadOptions | ReadOptions = XlsxReadOptions.default
  ): Stream.Stream<XlsxRow, XlsxParseError> {
    return Stream.unwrap(
      Effect.map(open({ bytes, caps: capsOf(options.limits) }), (opened) => {
        const entry = A.findFirst(opened.sheets, (found) => Str.toLowerCase(found.name) === Str.toLowerCase(sheet));
        if (O.isNone(entry)) {
          return Stream.fail(stop(MissingPart.make({ path: Str.slice(0, 1024)(`the sheet ${sheet}`) })));
        }
        const reader = readerOf(opened, entry.value);
        return bodiesOf({ bytes, wanted: (path) => path === entry.value.path }).pipe(
          Stream.take(1),
          Stream.flatMap((part) => eventsOf({ path: part.path, body: part.body, cellChars: opened.caps.cellChars })),
          Stream.takeWhile(() => O.isNone(reader.failed)),
          Stream.mapAccum(
            () => reader,
            (state, event) => [state, state.push(event)] as const
          ),
          Stream.concat(
            Stream.suspend(() => O.match(reader.failed, { onNone: () => Stream.empty, onSome: Stream.fail }))
          )
        );
      })
    ).pipe(Stream.mapError(parseError));
  }

  /** One sheet without its rows: its declared extent, merged ranges and hidden columns. */
  static readonly sheetLayout = Effect.fn("Xlsx.sheetLayout")(function* (
    bytes: Uint8Array,
    sheet: string,
    options: XlsxReadOptions | ReadOptions = XlsxReadOptions.default
  ) {
    const opened = yield* open({ bytes, caps: capsOf(options.limits) });
    const entry = A.findFirst(opened.sheets, (found) => Str.toLowerCase(found.name) === Str.toLowerCase(sheet));
    if (O.isNone(entry)) {
      return yield* Effect.fail(stop(MissingPart.make({ path: Str.slice(0, 1024)(`the sheet ${sheet}`) })));
    }
    const reads = yield* readSheets({ opened, wanted: [entry.value], keep: false });
    const layout = O.flatMap(MutableHashMap.get(reads, entry.value.path), (found) => found.layout);
    return XlsxWorksheet.make({
      info: infoOf(entry.value, layout),
      merges: O.match(layout, { onNone: () => [], onSome: (found) => found.merges }),
      hiddenColumns: O.match(layout, { onNone: () => [], onSome: (found) => A.dedupe(found.hiddenColumns) }),
    });
  }, Effect.mapError(parseError));

  /**
   * Writes a workbook's values as .xlsx bytes, in its canonical form. An Effect, because deflating uses the
   * runtime's `CompressionStream`.
   */
  static readonly stringify = Effect.fn("Xlsx.stringify")(
    (
      workbook: Pick<XlsxWorkbook, "dateSystem" | "sheets">,
      options: XlsxWriteOptions | WriteOptions = XlsxWriteOptions.default
    ) => write(workbook, options)
  );

  /**
   * The whole round trip as one codec: .xlsx bytes on the encoded side, a workbook on the decoded side. Use it with
   * Effect's effectful decoders and encoders. It has nowhere to put warnings, so it drops them; `parse` keeps them.
   */
  static fromBytes(options: CodecOptions = XlsxCodecOptions.default): S.Codec<XlsxWorkbook, Uint8Array> {
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
   * cell holds. Writing puts the records on one sheet of that name.
   */
  static recordsFromBytes(
    input: { readonly sheet: XlsxSheetName; readonly header: "first" },
    options: CodecOptions = XlsxCodecOptions.default
  ): S.Codec<ReadonlyArray<XlsxRecord>, Uint8Array> {
    return S.Uint8Array.pipe(
      S.decodeTo(
        S.Record(S.String, XlsxValue).pipe(S.Array, S.toType),
        SchemaTransformation.transformEffect({
          decode: (bytes: Uint8Array) =>
            Effect.flatMap(
              Effect.mapError(readWorkbook(bytes, options.read), (fatal) => issue(parseError(fatal), bytes)),
              (read) =>
                O.match(XlsxWorkbook.sheet(read.workbook, input.sheet), {
                  onNone: () => Effect.fail(issue({ message: `the workbook has no sheet ${input.sheet}` }, bytes)),
                  onSome: (sheet) =>
                    Effect.mapError(Effect.fromResult(toRecords(sheet)), (message) => issue({ message }, bytes)),
                })
            ),
          encode: (records: ReadonlyArray<XlsxRecord>) =>
            Effect.mapError(write(fromRecords(records, input.sheet), options.write), (error) => issue(error, records)),
        })
      )
    );
  }

  /** One sheet's rows decoded through a row schema, under the headings of its first row. */
  static sheetFromBytes<A, RD = never, RE = never>(
    row: S.Codec<A, XlsxRecord, RD, RE>,
    input: { readonly sheet: XlsxSheetName; readonly header: "first" },
    options: CodecOptions = XlsxCodecOptions.default
  ): S.Codec<ReadonlyArray<A>, Uint8Array, RD, RE> {
    return Xlsx.recordsFromBytes(input, options).pipe(S.decodeTo(S.Array(row)));
  }

  /** A codec to a target schema with its two directions as functions. */
  static bind<T>(schema: S.Codec<T, Uint8Array>): XlsxBoundCodec<T> {
    return {
      schema,
      decode: S.decodeEffect(schema),
      encode: S.encodeEffect(schema),
    };
  }
}
