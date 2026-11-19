// The only CSV parser in the package: a push machine. `push(state, chunk)` reads one chunk and returns the next state
// with the records and findings the chunk completed; `end(state)` flushes the last record. Splitting the input
// anywhere gives the same records and findings (the chunk-invariance law in Csv.property.test.ts). Inside one chunk
// the state lives in local variables, for speed; a `MachineState` value is built only at the chunk's end. Engine code
// never imports the `Csv` facade: it returns findings as schema values and the facade decides what fails.

import { $CsvId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Struct from "effect/Struct";
import * as Tuple from "effect/Tuple";
import {
  CsvDiagnostic,
  LimitExceeded,
  MixedTerminators,
  RaggedRecord,
  StrayQuote,
  TextAfterClosingQuote,
  UnterminatedQuote,
} from "../CsvDiagnostic.schema.ts";
import { applyTrim, CsvDelimiter, CsvReadOptions, judgeQuote, judgeRagged } from "../CsvOptions.schema.ts";
import { CsvIndex, CsvRecordEnd, CsvTextSpan } from "../CsvPosition.schema.ts";
import { CsvCell, CsvRecord } from "../CsvTable.schema.ts";
import type { CsvTextLimit } from "../CsvDiagnostic.schema.ts";

const $I = $CsvId.create("internal/machine");

// ── the state between chunks, as schemas ─────────────────────────────────────────────────────────────────────────────

/** Where the machine is inside a record. */
export class FieldStart extends S.Opaque<FieldStart, { readonly brand: unique symbol }>()(
  S.Struct({ mode: S.tag("fieldStart") }).pipe($I.annoteSchema("FieldStart", { description: "Before a field" }))
) {}
/** Inside a field that did not start with a quote. */
export class Unquoted extends S.Opaque<Unquoted, { readonly brand: unique symbol }>()(
  S.Struct({ mode: S.tag("unquoted") }).pipe($I.annoteSchema("Unquoted", { description: "Inside an unquoted field" }))
) {}
/** Inside a quoted field. */
export class Quoted extends S.Opaque<Quoted, { readonly brand: unique symbol }>()(
  S.Struct({ mode: S.tag("quoted") }).pipe($I.annoteSchema("Quoted", { description: "Inside a quoted field" }))
) {}
/** Just after a quote inside a quoted field: it closes the field or starts a doubled quote. */
export class QuoteInQuoted extends S.Opaque<QuoteInQuoted, { readonly brand: unique symbol }>()(
  S.Struct({ mode: S.tag("quoteInQuoted") }).pipe(
    $I.annoteSchema("QuoteInQuoted", { description: "Just after a quote inside a quoted field" })
  )
) {}
/** Spaces after a closing quote; a delimiter or line break next drops them (papaparse's rule). */
export class AfterQuoteSpaces extends S.Opaque<AfterQuoteSpaces, { readonly brand: unique symbol }>()(
  S.Struct({
    mode: S.tag("afterQuoteSpaces"),
    spaces: CsvIndex.pipe(S.annotateKey({ description: "Spaces seen after the closing quote" })),
  }).pipe($I.annoteSchema("AfterQuoteSpaces", { description: "Spaces after a closing quote" }))
) {}

/** The names of the places the machine can be inside a record. */
export const MachineModeName = LiteralKit([
  "fieldStart",
  "unquoted",
  "quoted",
  "quoteInQuoted",
  "afterQuoteSpaces",
]).pipe($I.annoteSchema("MachineModeName", { description: "The name of a place the machine can be in a record" }));
export type MachineModeName = typeof MachineModeName.Type;

/** Where the machine is inside a record. */
export const MachineMode = MachineModeName.mapMembers(() =>
  Tuple.make(FieldStart, Unquoted, Quoted, QuoteInQuoted, AfterQuoteSpaces)
).pipe(S.toTaggedUnion("mode"), $I.annoteSchema("MachineMode", { description: "Where the machine is in a record" }));
export type MachineMode = typeof MachineMode.Type;

const point = CsvIndex;
/** The machine's state between chunks. */
export class MachineState extends S.Opaque<MachineState, { readonly brand: unique symbol }>()(
  S.Struct({
    mode: MachineMode.pipe(
      S.annotateKey({ description: "Where the machine is inside a record" }),
      S.withConstructorDefault(Effect.sync(() => FieldStart.make({})))
    ),
    cells: S.Array(CsvCell).pipe(
      S.annotateKey({ description: "The current record's finished cells" }),
      S.withConstructorDefault(Effect.succeed([]))
    ),
    quoted: S.Array(S.Boolean).pipe(
      S.annotateKey({ description: "Whether each finished cell was quoted" }),
      S.withConstructorDefault(Effect.succeed([]))
    ),
    field: CsvCell.pipe(
      S.annotateKey({ description: "The current cell's text so far" }),
      S.withConstructorDefault(Effect.succeed(""))
    ),
    fieldQuoted: S.Boolean.pipe(
      S.annotateKey({ description: "Whether the current cell started with a quote" }),
      S.withConstructorDefault(Effect.succeed(false))
    ),
    content: S.Boolean.pipe(
      S.annotateKey({ description: "Whether the current record has consumed any character" }),
      S.withConstructorDefault(Effect.succeed(false))
    ),
    held: S.Boolean.pipe(
      S.annotateKey({ description: "A record ended at a carriage return and waits to see if a line feed follows" }),
      S.withConstructorDefault(Effect.succeed(false))
    ),
    crInQuotes: S.Boolean.pipe(
      S.annotateKey({ description: "The last character was a carriage return inside quotes" }),
      S.withConstructorDefault(Effect.succeed(false))
    ),
    offset: point.pipe(S.annotateKey({ description: "Units consumed" }), S.withConstructorDefault(Effect.succeed(0))),
    line: point.pipe(S.annotateKey({ description: "Current line" }), S.withConstructorDefault(Effect.succeed(0))),
    character: point.pipe(
      S.annotateKey({ description: "Current character in the line" }),
      S.withConstructorDefault(Effect.succeed(0))
    ),
    recordOffset: point.pipe(
      S.annotateKey({ description: "Where the current record started" }),
      S.withConstructorDefault(Effect.succeed(0))
    ),
    recordLine: point.pipe(
      S.annotateKey({ description: "Line of the current record's start" }),
      S.withConstructorDefault(Effect.succeed(0))
    ),
    recordCharacter: point.pipe(
      S.annotateKey({ description: "Character of the current record's start" }),
      S.withConstructorDefault(Effect.succeed(0))
    ),
    quoteOffset: point.pipe(
      S.annotateKey({ description: "Where the open quote is" }),
      S.withConstructorDefault(Effect.succeed(0))
    ),
    quoteLine: point.pipe(
      S.annotateKey({ description: "Line of the open quote" }),
      S.withConstructorDefault(Effect.succeed(0))
    ),
    quoteCharacter: point.pipe(
      S.annotateKey({ description: "Character of the open quote" }),
      S.withConstructorDefault(Effect.succeed(0))
    ),
    record: point.pipe(
      S.annotateKey({ description: "0-based number of the current record" }),
      S.withConstructorDefault(Effect.succeed(0))
    ),
    emitted: point.pipe(S.annotateKey({ description: "Records emitted" }), S.withConstructorDefault(Effect.succeed(0))),
    width: S.Option(CsvIndex).pipe(
      S.annotateKey({ description: "Cells in the first record" }),
      S.withConstructorDefault(Effect.succeedNone)
    ),
    firstEnd: S.Option(CsvRecordEnd).pipe(
      S.annotateKey({ description: "How the first record with a line break ended" }),
      S.withConstructorDefault(Effect.succeedNone)
    ),
    mixedReported: S.Boolean.pipe(
      S.annotateKey({ description: "Whether mixed terminators were reported" }),
      S.withConstructorDefault(Effect.succeed(false))
    ),
    stopped: S.Boolean.pipe(
      S.annotateKey({ description: "A fatal finding stopped the read" }),
      S.withConstructorDefault(Effect.succeed(false))
    ),
  }).pipe($I.annoteSchema("MachineState", { description: "The parser's state between chunks" }))
) {
  /** A fresh read. */
  static readonly initial: MachineState = MachineState.make({});
}

/** A record as the machine emits it: cells, per-cell quoting and how it ended, so a lossless document can follow. */
export class RawRecord extends S.Opaque<RawRecord, { readonly brand: unique symbol }>()(
  S.Struct({
    cells: CsvRecord.pipe(S.annotateKey({ description: "The cells" })),
    quoted: S.NonEmptyArray(S.Boolean).pipe(S.annotateKey({ description: "Whether each cell was quoted" })),
    record: CsvIndex.pipe(S.annotateKey({ description: "0-based record number" })),
    span: CsvTextSpan.pipe(S.annotateKey({ description: "Where the record is" })),
    end: CsvRecordEnd.pipe(S.annotateKey({ description: "How the record ended" })),
  }).pipe($I.annoteSchema("RawRecord", { description: "A record as the machine emits it" }))
) {}

/**
 * The rules the machine reads by: the read options' record rules and caps, with the delimiter settled. Each rule
 * starts at the read options' default, so `MachineConfig.make({ delimiter, limits })` is a lenient read.
 */
export class MachineConfig extends S.Opaque<MachineConfig, { readonly brand: unique symbol }>()(
  S.Struct({
    ...Struct.pick(CsvReadOptions.fields, ["quotes", "ragged", "blankLines", "trim", "limits"]),
    delimiter: CsvDelimiter.pipe(S.annotateKey({ description: "The settled delimiter" })),
  }).pipe($I.annoteSchema("MachineConfig", { description: "The rules the machine reads by" }))
) {}

/** What one step produced: the next state, the records it completed and the findings it made, in file order. */
export class Step extends S.Opaque<Step, { readonly brand: unique symbol }>()(
  S.Struct({
    state: MachineState.pipe(S.annotateKey({ description: "The state to read the next chunk from" })),
    records: S.Array(RawRecord).pipe(S.annotateKey({ description: "The records the step completed" })),
    diagnostics: S.Array(CsvDiagnostic).pipe(S.annotateKey({ description: "The findings the step made" })),
  }).pipe($I.annoteSchema("Step", { description: "What one machine step produced" }))
) {}

// ── the machine ──────────────────────────────────────────────────────────────────────────────────────────────────────

// crispen: kept as a mutable class — it is the per-chunk working copy of `MachineState`, mutated once per character
// for speed; the state crosses chunk boundaries only as the `MachineState` schema value built in `snapshot`.
/** The mutable working copy of a state, for one chunk. */
class Run {
  mode: MachineModeName;
  spaces: number;
  cells: Array<string>;
  quoted: Array<boolean>;
  field: string;
  fieldQuoted: boolean;
  content: boolean;
  held: boolean;
  crInQuotes: boolean;
  offset: number;
  line: number;
  character: number;
  recordOffset: number;
  recordLine: number;
  recordCharacter: number;
  quoteOffset: number;
  quoteLine: number;
  quoteCharacter: number;
  record: number;
  emitted: number;
  width: O.Option<number>;
  firstEnd: O.Option<CsvRecordEnd>;
  mixedReported: boolean;
  stopped: boolean;
  readonly records: Array<RawRecord> = [];
  readonly diagnostics: Array<CsvDiagnostic> = [];

  readonly config: MachineConfig;

  constructor(state: MachineState, config: MachineConfig) {
    this.config = config;
    this.mode = state.mode.mode;
    this.spaces = MachineMode.guards.afterQuoteSpaces(state.mode) ? state.mode.spaces : 0;
    this.cells = A.copy(state.cells);
    this.quoted = A.copy(state.quoted);
    this.field = state.field;
    this.fieldQuoted = state.fieldQuoted;
    this.content = state.content;
    this.held = state.held;
    this.crInQuotes = state.crInQuotes;
    this.offset = state.offset;
    this.line = state.line;
    this.character = state.character;
    this.recordOffset = state.recordOffset;
    this.recordLine = state.recordLine;
    this.recordCharacter = state.recordCharacter;
    this.quoteOffset = state.quoteOffset;
    this.quoteLine = state.quoteLine;
    this.quoteCharacter = state.quoteCharacter;
    this.record = state.record;
    this.emitted = state.emitted;
    this.width = state.width;
    this.firstEnd = state.firstEnd;
    this.mixedReported = state.mixedReported;
    this.stopped = state.stopped;
  }

  snapshot(): Step {
    const mode: MachineMode =
      this.mode === "afterQuoteSpaces"
        ? AfterQuoteSpaces.make({ spaces: this.spaces })
        : MachineMode.cases[this.mode].make({});
    return {
      state: MachineState.make({
        mode,
        cells: this.cells,
        quoted: this.quoted,
        field: this.field,
        fieldQuoted: this.fieldQuoted,
        content: this.content,
        held: this.held,
        crInQuotes: this.crInQuotes,
        offset: this.offset,
        line: this.line,
        character: this.character,
        recordOffset: this.recordOffset,
        recordLine: this.recordLine,
        recordCharacter: this.recordCharacter,
        quoteOffset: this.quoteOffset,
        quoteLine: this.quoteLine,
        quoteCharacter: this.quoteCharacter,
        record: this.record,
        emitted: this.emitted,
        width: this.width,
        firstEnd: this.firstEnd,
        mixedReported: this.mixedReported,
        stopped: this.stopped,
      }),
      records: this.records,
      diagnostics: this.diagnostics,
    };
  }

  span(offset: number, length: number, line: number, character: number): CsvTextSpan {
    return CsvTextSpan.make({ offset, length, line, character });
  }

  here(length: number): CsvTextSpan {
    return this.span(this.offset, length, this.line, this.character);
  }

  report(diagnostic: CsvDiagnostic): void {
    this.diagnostics.push(diagnostic);
    if (diagnostic.severity === "fatal") this.stopped = true;
  }

  limit(limit: CsvTextLimit, maximum: number, at: CsvTextSpan): void {
    this.report(CsvDiagnostic.cases.fatal.make({ finding: LimitExceeded.make({ limit, maximum, at }) }));
  }

  /** Moves past one consumed unit that is not a line break. */
  advance(units: number): void {
    this.offset += units;
    this.character += units;
  }

  /** Moves past a line break of `units` units. */
  breakLine(units: number): void {
    this.offset += units;
    this.line += 1;
    this.character = 0;
  }

  checkField(): void {
    const { maxFieldLength, maxRecordLength } = this.config.limits;
    if (this.field.length > maxFieldLength) this.limit("fieldLength", maxFieldLength, this.here(0));
    else if (this.offset - this.recordOffset > maxRecordLength)
      this.limit("recordLength", maxRecordLength, this.here(0));
  }

  endField(): void {
    const cell = applyTrim(this.config.trim, this.field, this.fieldQuoted);
    this.cells.push(cell);
    this.quoted.push(this.fieldQuoted);
    this.field = "";
    this.fieldQuoted = false;
    this.mode = "fieldStart";
    this.spaces = 0;
    const { maxFieldsPerRecord } = this.config.limits;
    if (this.cells.length > maxFieldsPerRecord) this.limit("fieldsPerRecord", maxFieldsPerRecord, this.here(0));
    else this.checkField();
  }

  /** Finishes the current record's last field and emits the record with how it ended. */
  endRecord(end: CsvRecordEnd): void {
    if (this.mode !== "fieldStart" || this.cells.length === 0 || this.content) this.endField();
    if (this.stopped) return;
    const cells = this.cells;
    const quoted = this.quoted;
    const recordIndex = this.record;
    const span = this.span(this.recordOffset, this.offset - this.recordOffset, this.recordLine, this.recordCharacter);
    this.cells = [];
    this.quoted = [];
    this.content = false;
    this.record += 1;
    if (end !== "EndOfInput") {
      O.match(this.firstEnd, {
        onNone: () => {
          this.firstEnd = O.some(end);
        },
        onSome: (first) => {
          if (first !== end && !this.mixedReported) {
            this.mixedReported = true;
            this.report(
              CsvDiagnostic.cases.warning.make({
                finding: MixedTerminators.make({ at: span, first, other: end }),
              })
            );
          }
        },
      });
    }
    const blank = cells.length === 1 && cells[0] === "" && quoted[0] === false;
    if (blank && this.config.blankLines === "skip") return;
    const [head, ...rest] = cells;
    const [quotedHead, ...quotedRest] = quoted;
    if (head === undefined || quotedHead === undefined) return;
    const record: [string, ...Array<string>] = [head, ...rest];
    const flags: [boolean, ...Array<boolean>] = [quotedHead, ...quotedRest];
    O.match(this.width, {
      onNone: () => {
        this.width = O.some(record.length);
      },
      onSome: (width) => {
        if (record.length !== width) {
          this.report(
            judgeRagged(
              this.config.ragged,
              RaggedRecord.make({ at: span, record: recordIndex, expected: width, actual: record.length })
            )
          );
          if (this.config.ragged === "pad") {
            while (record.length < width) {
              record.push("");
              flags.push(false);
            }
          }
        }
      },
    });
    if (this.stopped) return;
    this.emitted += 1;
    const { maxRecords } = this.config.limits;
    if (this.emitted > maxRecords) {
      this.limit("records", maxRecords, span);
      return;
    }
    this.records.push(RawRecord.make({ cells: record, quoted: flags, record: recordIndex, span, end }));
  }

  startRecordIfNeeded(): void {
    if (!this.content) {
      this.content = true;
      this.recordOffset = this.offset;
      this.recordLine = this.line;
      this.recordCharacter = this.character;
    }
  }

  quoteFinding(kind: "stray" | "after"): void {
    const at = this.here(1);
    const field = this.cells.length;
    const finding =
      kind === "stray"
        ? StrayQuote.make({ at, record: this.record, field })
        : TextAfterClosingQuote.make({ at, record: this.record, field });
    this.report(judgeQuote(this.config.quotes, finding));
  }

  /** Releases a record held at a carriage return, now that the next unit is known not to be a line feed. */
  releaseHeld(lineFeedFollows: boolean): void {
    if (!this.held) return;
    this.held = false;
    if (lineFeedFollows) {
      // The CR was already counted as a line break; the LF joins it.
      this.offset += 1;
      this.endRecord("CRLF");
    } else {
      this.endRecord("CR");
    }
  }

  push(text: string): void {
    const delimiter = this.config.delimiter;
    const length = text.length;
    let i = 0;
    while (i < length && !this.stopped) {
      const c = text[i];
      if (this.held) {
        if (c === "\n") {
          this.releaseHeld(true);
          i += 1;
          continue;
        }
        this.releaseHeld(false);
        if (this.stopped) break;
      }
      switch (this.mode) {
        case "fieldStart":
        case "unquoted": {
          if (c === "\r" || c === "\n") {
            if (this.mode === "fieldStart" && !this.content) {
              // A blank line: a record of one empty cell.
              this.startRecordIfNeeded();
            }
            if (c === "\r") {
              this.breakLine(1);
              this.held = true;
            } else {
              this.breakLine(1);
              this.endRecord("LF");
            }
            i += 1;
            continue;
          }
          this.startRecordIfNeeded();
          if (c === delimiter) {
            this.endField();
            this.advance(1);
            i += 1;
            continue;
          }
          if (c === '"' && this.mode === "fieldStart") {
            this.mode = "quoted";
            this.fieldQuoted = true;
            this.quoteOffset = this.offset;
            this.quoteLine = this.line;
            this.quoteCharacter = this.character;
            this.advance(1);
            i += 1;
            continue;
          }
          if (c === '"') {
            this.quoteFinding("stray");
            if (this.stopped) break;
            this.field += '"';
            this.advance(1);
            i += 1;
            continue;
          }
          // A run of ordinary characters.
          this.mode = "unquoted";
          let j = i + 1;
          while (j < length) {
            const d = text[j];
            if (d === delimiter || d === '"' || d === "\r" || d === "\n") break;
            j += 1;
          }
          this.field += Str.slice(i, j)(text);
          this.advance(j - i);
          i = j;
          this.checkField();
          continue;
        }
        case "quoted": {
          if (c === '"') {
            this.mode = "quoteInQuoted";
            this.advance(1);
            i += 1;
            continue;
          }
          let j = i;
          while (j < length) {
            const d = text[j];
            if (d === '"') break;
            if (d === "\r") {
              this.line += 1;
              this.character = 0;
              this.offset += 1;
              this.crInQuotes = true;
            } else if (d === "\n") {
              if (!this.crInQuotes) {
                this.line += 1;
              }
              this.character = 0;
              this.offset += 1;
              this.crInQuotes = false;
            } else {
              this.crInQuotes = false;
              this.advance(1);
            }
            j += 1;
          }
          this.field += Str.slice(i, j)(text);
          i = j;
          this.checkField();
          continue;
        }
        case "quoteInQuoted": {
          this.crInQuotes = false;
          if (c === '"') {
            this.field += '"';
            this.mode = "quoted";
            this.advance(1);
            i += 1;
            continue;
          }
          if (c === delimiter) {
            this.endField();
            this.advance(1);
            i += 1;
            continue;
          }
          if (c === "\r" || c === "\n") {
            this.mode = "unquoted";
            continue;
          }
          if (c === " ") {
            this.mode = "afterQuoteSpaces";
            this.spaces = 1;
            this.advance(1);
            i += 1;
            continue;
          }
          this.quoteFinding("after");
          if (this.stopped) break;
          this.field += '"';
          this.mode = "quoted";
          continue;
        }
        case "afterQuoteSpaces": {
          if (c === " ") {
            this.spaces += 1;
            this.advance(1);
            i += 1;
            continue;
          }
          if (c === delimiter || c === "\r" || c === "\n") {
            if (this.config.quotes === "strict") {
              this.quoteFinding("after");
              break;
            }
            if (c === delimiter) {
              this.endField();
              this.advance(1);
              i += 1;
            } else {
              this.mode = "unquoted";
            }
            continue;
          }
          this.quoteFinding("after");
          if (this.stopped) break;
          this.field += `"${Str.repeat(this.spaces)(" ")}`;
          this.spaces = 0;
          this.mode = c === '"' ? "quoteInQuoted" : "quoted";
          if (c === '"') {
            this.advance(1);
            i += 1;
          }
          continue;
        }
      }
    }
  }

  end(): void {
    if (this.stopped) return;
    if (this.held) {
      this.releaseHeld(false);
      return;
    }
    if (this.mode === "quoted") {
      const at = this.span(this.quoteOffset, 1, this.quoteLine, this.quoteCharacter);
      this.report(
        CsvDiagnostic.cases.fatal.make({
          finding: UnterminatedQuote.make({ at, record: this.record, field: this.cells.length }),
        })
      );
      return;
    }
    if (this.mode === "afterQuoteSpaces" && this.config.quotes === "strict") {
      this.quoteFinding("after");
      return;
    }
    if (this.content) this.endRecord("EndOfInput");
  }
}

/** Reads one chunk. */
export const push: {
  (chunk: string, config: MachineConfig): (state: MachineState) => Step;
  (state: MachineState, chunk: string, config: MachineConfig): Step;
} = dual(3, (state: MachineState, chunk: string, config: MachineConfig): Step => {
  const run = new Run(state, config);
  run.push(chunk);
  return run.snapshot();
});

/** Flushes the last record at the end of the input. */
export const end: {
  (config: MachineConfig): (state: MachineState) => Step;
  (state: MachineState, config: MachineConfig): Step;
} = dual(2, (state: MachineState, config: MachineConfig): Step => {
  const run = new Run(state, config);
  run.end();
  return run.snapshot();
});
