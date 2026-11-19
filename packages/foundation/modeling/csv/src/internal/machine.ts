// The only CSV parser in the package: a push machine. `Machine.start(config)` begins a read, `feed(chunk)` reads one
// chunk, `finish()` flushes the last record, and `takeRecords()` / `takeDiagnostics()` hand over what they completed.
// Splitting the input anywhere gives the same records and findings (the chunk-invariance laws in
// Csv.property.test.ts). One machine lives across the chunks of a read and keeps its state in one mutable record, so a
// chunk costs time in its own length, not in the width of the record left open across it. `state()` takes that record
// as a `MachineState` schema value and `Machine.start(config, state)` resumes from one. Engine code never imports the
// `Csv` facade: it returns findings as schema values and the facade decides what fails.

import { $CsvId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Num from "effect/Number";
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
  WarningsTruncated,
} from "../CsvDiagnostic.schema.ts";
import { CsvDelimiter, CsvReadOptions } from "../CsvOptions.schema.ts";
import { CsvIndex, CsvRecordEnd, CsvTextSpan } from "../CsvPosition.schema.ts";
import { CsvCell, CsvRecord } from "../CsvTable.schema.ts";
import { applyTrim, judgeQuote, judgeRagged } from "./rules.ts";
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
    warningsKept: point.pipe(
      S.annotateKey({ description: "Warnings kept so far, at most the warning cap" }),
      S.withConstructorDefault(Effect.succeed(0))
    ),
    warningsDropped: S.Int.check(S.isBetween({ minimum: 0, maximum: Number.MAX_SAFE_INTEGER })).pipe(
      S.annotateKey({ description: "Warnings past the cap, counted but not kept" }),
      S.withConstructorDefault(Effect.succeed(0))
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
    span: CsvTextSpan,
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

// ── the machine ──────────────────────────────────────────────────────────────────────────────────────────────────────

/** Every `MachineState` field but the mode, writable, with the open record's cells as arrays the machine appends to. */
type Working = {
  -readonly [K in Exclude<keyof MachineState, "brand" | "mode" | "cells" | "quoted">]: MachineState[K];
} & { cells: Array<CsvCell>; quoted: Array<boolean> };

/** Engine-built values hold their invariants by construction; the property tests prove them, so `make` skips checks. */
const built = { disableChecks: true } as const;

// crispen: kept as a mutable class — it is one read's working state, mutated once per character run for speed; the
// state leaves it only as the `MachineState` schema value `state()` builds.
/** One read in progress. */
export class Machine {
  /** Where the machine is inside a record. */
  mode: MachineModeName;
  /** Spaces seen after a closing quote, in `afterQuoteSpaces`. */
  spaces: number;
  /** The rest of the state. */
  readonly s: Working;
  private records: Array<RawRecord> = [];
  private diagnostics: Array<CsvDiagnostic> = [];

  /** The rules this read goes by. */
  readonly config: MachineConfig;

  private constructor(config: MachineConfig, state: MachineState) {
    this.config = config;
    const { mode, cells, quoted, ...rest } = state;
    this.mode = mode.mode;
    this.spaces = MachineMode.guards.afterQuoteSpaces(mode) ? mode.spaces : 0;
    this.s = { ...rest, cells: A.copy(cells), quoted: A.copy(quoted) };
  }

  /** A read under `config`, from the start or resumed from a state another machine took. */
  static start(config: MachineConfig, state: MachineState = MachineState.initial): Machine {
    return new Machine(config, state);
  }

  /** Whether a fatal finding stopped the read. */
  get stopped(): boolean {
    return this.s.stopped;
  }

  /** Whether the read sits between records: no record open and none held at a carriage return. */
  get atRecordBoundary(): boolean {
    return !this.s.content && !this.s.held;
  }

  /** The state so far, as a schema value another machine can resume from. */
  state(): MachineState {
    const mode: MachineMode =
      this.mode === "afterQuoteSpaces"
        ? AfterQuoteSpaces.make({ spaces: this.spaces })
        : MachineMode.cases[this.mode].make({});
    return MachineState.make({ ...this.s, mode, cells: A.copy(this.s.cells), quoted: A.copy(this.s.quoted) });
  }

  /** Reads one chunk; `takeRecords` and `takeDiagnostics` then give what it completed. */
  feed(text: string): Machine {
    let i = 0;
    while (i < text.length && !this.s.stopped) {
      if (this.s.held) {
        if (text[i] === "\n") {
          this.releaseHeld(true);
          i += 1;
          continue;
        }
        this.releaseHeld(false);
        if (this.s.stopped) break;
      }
      i = stepFor(this.mode)(this, text, i);
    }
    return this;
  }

  /** Ends the input: flushes the last record, and notes how many warnings went past the cap. */
  finish(): Machine {
    this.end();
    if (!this.s.stopped && this.s.warningsDropped > 0) {
      this.diagnostics.push(
        CsvDiagnostic.cases.warning.make({
          finding: WarningsTruncated.make({ kept: this.s.warningsKept, dropped: this.s.warningsDropped }),
        })
      );
    }
    return this;
  }

  /** The records completed since the last take, in file order. */
  takeRecords(): ReadonlyArray<RawRecord> {
    const records = this.records;
    this.records = [];
    return records;
  }

  /** The findings made since the last take, in file order. */
  takeDiagnostics(): ReadonlyArray<CsvDiagnostic> {
    const diagnostics = this.diagnostics;
    this.diagnostics = [];
    return diagnostics;
  }

  private end(): void {
    if (this.s.stopped) return;
    if (this.s.held) {
      this.releaseHeld(false);
      return;
    }
    if (this.mode === "quoted") {
      const at = this.span(this.s.quoteOffset, 1, this.s.quoteLine, this.s.quoteCharacter);
      this.report(
        CsvDiagnostic.cases.fatal.make({
          finding: UnterminatedQuote.make({ at, record: this.s.record, field: this.s.cells.length }),
        })
      );
      return;
    }
    if (this.mode === "afterQuoteSpaces" && this.config.quotes === "strict") {
      this.quoteFinding(TextAfterClosingQuote.make);
      return;
    }
    if (this.s.content) this.endRecord("EndOfInput");
  }

  span(offset: number, length: number, line: number, character: number): CsvTextSpan {
    return CsvTextSpan.make({ offset, length, line, character }, built);
  }

  here(length: number): CsvTextSpan {
    return this.span(this.s.offset, length, this.s.line, this.s.character);
  }

  report(diagnostic: CsvDiagnostic): void {
    this.diagnostics.push(diagnostic);
    if (diagnostic.severity === "fatal") this.s.stopped = true;
  }

  /** Whether one more warning may be kept; past `maxWarnings` it is only counted, and never built. */
  keepWarning(): boolean {
    if (this.s.warningsKept < this.config.limits.maxWarnings) {
      this.s.warningsKept += 1;
      return true;
    }
    this.s.warningsDropped += 1;
    return false;
  }

  limit(limit: CsvTextLimit, maximum: number, at: CsvTextSpan): void {
    this.report(CsvDiagnostic.cases.fatal.make({ finding: LimitExceeded.make({ limit, maximum, at }) }));
  }

  /** Moves past one consumed unit that is not a line break. */
  advance(units: number): void {
    this.s.offset += units;
    this.s.character += units;
  }

  /** Moves past a line break of `units` units. */
  breakLine(units: number): void {
    this.s.offset += units;
    this.s.line += 1;
    this.s.character = 0;
  }

  /**
   * How many units a character run may take before the next one would pass the field or record cap, at least one: a
   * run stops at the unit that passes a cap, so the cap is found at that unit however the input is cut.
   */
  budget(): number {
    const { maxFieldLength, maxRecordLength } = this.config.limits;
    return Num.max(
      1,
      Num.min(maxFieldLength - this.s.field.length, maxRecordLength - (this.s.offset - this.s.recordOffset)) + 1
    );
  }

  checkField(): void {
    const { maxFieldLength, maxRecordLength } = this.config.limits;
    if (this.s.field.length > maxFieldLength) this.limit("fieldLength", maxFieldLength, this.here(0));
    else if (this.s.offset - this.s.recordOffset > maxRecordLength)
      this.limit("recordLength", maxRecordLength, this.here(0));
  }

  endField(): void {
    this.s.cells.push(applyTrim(this.config.trim, this.s.field, this.s.fieldQuoted));
    this.s.quoted.push(this.s.fieldQuoted);
    this.s.field = "";
    this.s.fieldQuoted = false;
    this.mode = "fieldStart";
    this.spaces = 0;
    const { maxFieldsPerRecord } = this.config.limits;
    if (this.s.cells.length > maxFieldsPerRecord) this.limit("fieldsPerRecord", maxFieldsPerRecord, this.here(0));
    else this.checkField();
  }

  /** Finishes the current record's last field and emits the record with how it ended. */
  endRecord(end: CsvRecordEnd): void {
    if (this.mode !== "fieldStart" || this.s.cells.length === 0 || this.s.content) this.endField();
    if (this.s.stopped) return;
    const cells = this.s.cells;
    const quoted = this.s.quoted;
    const recordIndex = this.s.record;
    const span = this.span(
      this.s.recordOffset,
      this.s.offset - this.s.recordOffset,
      this.s.recordLine,
      this.s.recordCharacter
    );
    this.s.cells = [];
    this.s.quoted = [];
    this.s.content = false;
    this.s.record += 1;
    if (end !== "EndOfInput") {
      O.match(this.s.firstEnd, {
        onNone: () => {
          this.s.firstEnd = O.some(end);
        },
        onSome: (first) => {
          if (first !== end && !this.s.mixedReported) {
            this.s.mixedReported = true;
            if (this.keepWarning())
              this.report(
                CsvDiagnostic.cases.warning.make({ finding: MixedTerminators.make({ at: span, first, other: end }) })
              );
          }
        },
      });
    }
    const blank = cells.length === 1 && cells[0] === "" && quoted[0] === false;
    if (blank && this.config.blankLines === "skip") return;
    if (!A.isArrayNonEmpty(cells) || !A.isArrayNonEmpty(quoted)) return;
    O.match(this.s.width, {
      onNone: () => {
        this.s.width = O.some(cells.length);
      },
      onSome: (width) => {
        if (cells.length !== width) {
          if (this.config.ragged === "reject" || this.keepWarning())
            this.report(
              judgeRagged(
                this.config.ragged,
                RaggedRecord.make({ at: span, record: recordIndex, expected: width, actual: cells.length })
              )
            );
          if (this.config.ragged === "pad") {
            while (cells.length < width) {
              cells.push("");
              quoted.push(false);
            }
          }
        }
      },
    });
    if (this.s.stopped) return;
    this.s.emitted += 1;
    const { maxRecords } = this.config.limits;
    if (this.s.emitted > maxRecords) {
      this.limit("records", maxRecords, span);
      return;
    }
    this.records.push(RawRecord.make({ cells, quoted, record: recordIndex, span, end }, built));
  }

  startRecordIfNeeded(): void {
    if (!this.s.content) {
      this.s.content = true;
      this.s.recordOffset = this.s.offset;
      this.s.recordLine = this.s.line;
      this.s.recordCharacter = this.s.character;
    }
  }

  /** A misplaced quote here, as the finding `make` builds; a lenient warning past the cap is only counted. */
  quoteFinding(make: typeof StrayQuote.make | typeof TextAfterClosingQuote.make): void {
    if (this.config.quotes === "lenient" && !this.keepWarning()) return;
    this.report(
      judgeQuote(this.config.quotes, make({ at: this.here(1), record: this.s.record, field: this.s.cells.length }))
    );
  }

  /** Releases a record held at a carriage return, now that the next unit is known not to be a line feed. */
  releaseHeld(lineFeedFollows: boolean): void {
    if (!this.s.held) return;
    this.s.held = false;
    if (lineFeedFollows) {
      // The CR was already counted as a line break; the LF joins it.
      this.s.offset += 1;
      this.endRecord("CRLF");
    } else {
      this.endRecord("CR");
    }
  }
}

// ── one step per mode ────────────────────────────────────────────────────────────────────────────────────────────────
// Each step reads at `i` and returns where the next step reads. A step that stops the read returns `i`; the loop in
// `Machine.feed` ends on `stopped`.

type Stepper = (run: Machine, text: string, i: number) => number;

/** Before a field or inside an unquoted one. */
const stepPlain: Stepper = (run, text, i) => {
  const c = text[i];
  const delimiter = run.config.delimiter;
  if (c === "\r" || c === "\n") {
    // A blank line: a record of one empty cell.
    if (run.mode === "fieldStart") run.startRecordIfNeeded();
    run.breakLine(1);
    if (c === "\r") run.s.held = true;
    else run.endRecord("LF");
    return i + 1;
  }
  run.startRecordIfNeeded();
  if (c === delimiter) {
    run.endField();
    run.advance(1);
    return i + 1;
  }
  if (c === '"' && run.mode === "fieldStart") {
    run.mode = "quoted";
    run.s.fieldQuoted = true;
    run.s.quoteOffset = run.s.offset;
    run.s.quoteLine = run.s.line;
    run.s.quoteCharacter = run.s.character;
    run.advance(1);
    return i + 1;
  }
  if (c === '"') {
    run.quoteFinding(StrayQuote.make);
    if (run.stopped) return i;
    run.s.field += '"';
    run.advance(1);
    run.checkField();
    return i + 1;
  }
  // A run of ordinary characters, up to the unit that would pass a cap.
  run.mode = "unquoted";
  const stop = Num.min(text.length, i + run.budget());
  let j = i + 1;
  while (j < stop) {
    const d = text[j];
    if (d === delimiter || d === '"' || d === "\r" || d === "\n") break;
    j += 1;
  }
  run.s.field += Str.slice(i, j)(text);
  run.advance(j - i);
  run.checkField();
  return j;
};

/** Inside a quoted field: everything up to the next quote is text, line breaks included. */
const stepQuoted: Stepper = (run, text, i) => {
  if (text[i] === '"') {
    run.mode = "quoteInQuoted";
    run.advance(1);
    return i + 1;
  }
  const s = run.s;
  const stop = Num.min(text.length, i + run.budget());
  let j = i;
  while (j < stop) {
    const d = text[j];
    if (d === '"') break;
    if (d === "\r") {
      s.line += 1;
      s.character = 0;
      s.offset += 1;
      s.crInQuotes = true;
    } else if (d === "\n") {
      if (!s.crInQuotes) s.line += 1;
      s.character = 0;
      s.offset += 1;
      s.crInQuotes = false;
    } else {
      s.crInQuotes = false;
      run.advance(1);
    }
    j += 1;
  }
  s.field += Str.slice(i, j)(text);
  run.checkField();
  return j;
};

/** Just after a quote inside a quoted field: a doubled quote, the field's end, or text after the closing quote. */
const stepQuoteInQuoted: Stepper = (run, text, i) => {
  const c = text[i];
  run.s.crInQuotes = false;
  if (c === '"') {
    run.s.field += '"';
    run.mode = "quoted";
    run.advance(1);
    run.checkField();
    return i + 1;
  }
  if (c === run.config.delimiter) {
    run.endField();
    run.advance(1);
    return i + 1;
  }
  if (c === "\r" || c === "\n") {
    run.mode = "unquoted";
    return i;
  }
  if (c === " ") {
    run.mode = "afterQuoteSpaces";
    run.spaces = 1;
    run.advance(1);
    return i + 1;
  }
  run.quoteFinding(TextAfterClosingQuote.make);
  if (run.stopped) return i;
  run.s.field += '"';
  run.mode = "quoted";
  run.checkField();
  return i;
};

/** Spaces after a closing quote: dropped before a delimiter or line break when lenient, else kept as text. */
const stepAfterQuoteSpaces: Stepper = (run, text, i) => {
  const c = text[i];
  if (c === " ") {
    run.spaces += 1;
    run.advance(1);
    return i + 1;
  }
  if (c === run.config.delimiter || c === "\r" || c === "\n") {
    if (run.config.quotes === "strict") {
      run.quoteFinding(TextAfterClosingQuote.make);
      return i;
    }
    if (c === run.config.delimiter) {
      run.endField();
      run.advance(1);
      return i + 1;
    }
    run.mode = "unquoted";
    return i;
  }
  run.quoteFinding(TextAfterClosingQuote.make);
  if (run.stopped) return i;
  run.s.field += `"${Str.repeat(run.spaces)(" ")}`;
  run.spaces = 0;
  run.checkField();
  if (run.stopped) return i;
  if (c === '"') {
    run.mode = "quoteInQuoted";
    run.advance(1);
    return i + 1;
  }
  run.mode = "quoted";
  return i;
};

/** The step for each mode, chosen once per character run. */
const stepFor: (mode: MachineModeName) => Stepper = MachineModeName.match({
  fieldStart: () => stepPlain,
  unquoted: () => stepPlain,
  quoted: () => stepQuoted,
  quoteInQuoted: () => stepQuoteInQuoted,
  afterQuoteSpaces: () => stepAfterQuoteSpaces,
});
