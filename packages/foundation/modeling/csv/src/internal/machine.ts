// decision: imperative-engine-loops
// decision: engine-findings-facade-fails
import { $CsvId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Struct from "effect/Struct";
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
import { CsvIndex, CsvRecordEnd, CsvTextSpan, recordEndText } from "../CsvPosition.schema.ts";
import { CsvCell, CsvRecordSlice } from "../CsvTable.schema.ts";
import { applyTrim, judgeQuote, judgeRagged } from "./rules.ts";
import type { CsvTextLimit } from "../CsvDiagnostic.schema.ts";
import type { CsvRecord } from "../CsvTable.schema.ts";

const $I = $CsvId.create("internal/machine");

/** The names of the places the machine can be inside a record. */
export const MachineModeName = LiteralKit([
  "fieldStart",
  "unquoted",
  "quoted",
  "quoteInQuoted",
  "afterQuoteSpaces",
]).pipe($I.annoteSchema("MachineModeName", { description: "The name of a place the machine can be in a record" }));
export type MachineModeName = typeof MachineModeName.Type;

const point = CsvIndex;
/** The state of one read in progress, past where the machine is inside a record. */
export class MachineState extends S.Opaque<MachineState, { readonly brand: unique symbol }>()(
  S.Struct({
    cells: S.Array(CsvCell).pipe(
      S.annotateKey({ description: "The current record's finished cells" }),
      S.withConstructorDefault(Effect.succeed([]))
    ),
    lastQuoted: S.Boolean.pipe(
      S.annotateKey({ description: "Whether the current record's last finished cell was quoted" }),
      S.withConstructorDefault(Effect.succeed(false))
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
    paddingEmitted: point.pipe(
      S.annotateKey({ description: "Empty cells padding has added to the records emitted, at most the padding cap" }),
      S.withConstructorDefault(Effect.succeed(0))
    ),
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
  }).pipe($I.annoteSchema("MachineState", { description: "The state of one read in progress" }))
) {
  /** A fresh read. */
  static readonly initial: MachineState = MachineState.make({});
}

// decision: imperative-engine-loops
interface Completed {
  readonly cells: CsvRecord;
  readonly end: CsvRecordEnd;
  readonly record: number;
  readonly span: {
    readonly offset: number;
    readonly length: number;
    readonly line: number;
    readonly character: number;
  };
}

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

type Working = {
  -readonly [K in Exclude<keyof MachineState, "brand" | "cells">]: MachineState[K];
} & { cells: Array<CsvCell> };

/**
 * Engine-built values hold their invariants by construction, so `make` skips checks: every position is at most the
 * text-length cap, which `Machine.feed` never reads past, and the cap is at most `MAX_TEXT_UNITS`. The property tests
 * prove them.
 */
export const built = { disableChecks: true } as const;

// decision: imperative-engine-loops
/** One read in progress. */
export class Machine {
  /** Where the machine is inside a record. */
  mode: MachineModeName = "fieldStart";
  /** Spaces seen after a closing quote, in `afterQuoteSpaces`. */
  spaces = 0;
  /** The rest of the state. */
  readonly s: Working;
  private records: Array<Completed> = [];
  private diagnostics: Array<CsvDiagnostic> = [];

  /** The rules this read goes by. */
  readonly config: MachineConfig;

  private constructor(config: MachineConfig) {
    this.config = config;
    this.s = { ...MachineState.initial, cells: [] };
  }

  /** A read under `config`, from the start. */
  static start(config: MachineConfig): Machine {
    return new Machine(config);
  }

  /** Whether a fatal finding stopped the read. */
  get stopped(): boolean {
    return this.s.stopped;
  }

  /** Whether the read sits between records: no record open and none held at a carriage return. */
  get atRecordBoundary(): boolean {
    return !this.s.content && !this.s.held;
  }

  /**
   * Reads one chunk; the takes then give what it completed. Units past the text-length cap are not read: the read
   * fails at the first of them, so every position stays within the cap however the input is cut.
   */
  feed(chunk: string): Machine {
    const { maxTextLength } = this.config.limits;
    const room = maxTextLength - this.s.offset;
    const text = chunk.length > room ? Str.slice(0, room)(chunk) : chunk;
    let i = 0;
    while (i < text.length && !this.s.stopped) i = nextStep(this)(this, text, i);
    if (text.length < chunk.length && !this.s.stopped) this.passTextCap(chunk[text.length]);
    return this;
  }

  /**
   * Fails the read at the first unit past the text-length cap. A record held at a carriage return inside the cap
   * ends there unless that unit is the line feed that would join it, so it is emitted first, as a line feed's
   * record is; a CRLF whose line feed is past the cap is not read.
   */
  private passTextCap(next: string | undefined): void {
    if (this.s.held && next !== "\n") this.releaseHeld(false);
    if (!this.s.stopped) this.limit("textLength", this.config.limits.maxTextLength, this.here(0));
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

  /** The cells of the records completed since the last take, in file order. */
  takeCells(): ReadonlyArray<CsvRecord> {
    return A.map(this.takeCompleted(), (completed) => completed.cells);
  }

  /** The records completed since the last take, with where they were, in file order. */
  takeSlices(): ReadonlyArray<CsvRecordSlice> {
    return A.map(this.takeCompleted(), (completed) =>
      CsvRecordSlice.make({ ...completed, span: CsvTextSpan.make(completed.span, built) }, built)
    );
  }

  private takeCompleted(): ReadonlyArray<Completed> {
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

  /**
   * Fails the read when the open field or record has passed its cap. `lineBreak` units at the end are the record's
   * line break, which the record cap does not count.
   */
  checkField(lineBreak = 0): void {
    const { maxFieldLength, maxRecordLength } = this.config.limits;
    if (this.s.field.length > maxFieldLength) this.limit("fieldLength", maxFieldLength, this.here(0));
    else if (this.s.offset - this.s.recordOffset - lineBreak > maxRecordLength)
      this.limit("recordLength", maxRecordLength, this.here(0));
  }

  endField(lineBreak = 0): void {
    this.s.cells.push(applyTrim(this.config.trim, this.s.field, this.s.fieldQuoted));
    this.s.lastQuoted = this.s.fieldQuoted;
    this.s.field = "";
    this.s.fieldQuoted = false;
    this.mode = "fieldStart";
    this.spaces = 0;
    const { maxFieldsPerRecord } = this.config.limits;
    if (this.s.cells.length > maxFieldsPerRecord) this.limit("fieldsPerRecord", maxFieldsPerRecord, this.here(0));
    else this.checkField(lineBreak);
  }

  /** Finishes the current record's last field and emits the record with how it ended. */
  endRecord(end: CsvRecordEnd): void {
    this.closeLastField(end);
    if (this.s.stopped) return;
    const cells = this.s.cells;
    const record = this.s.record;
    const span = {
      offset: this.s.recordOffset,
      length: this.s.offset - this.s.recordOffset,
      line: this.s.recordLine,
      character: this.s.recordCharacter,
    };
    this.s.cells = [];
    this.s.content = false;
    this.s.record += 1;
    this.noteTerminator(end, span);
    if (this.skipsBlank(cells) || !A.isArrayNonEmpty(cells)) return;
    const width = this.fitWidth(cells, record, span);
    if (this.s.stopped) return;
    this.emit({ cells, record, span, end }, width);
  }

  /** Finishes the record's last field before the record is emitted. */
  private closeLastField(end: CsvRecordEnd): void {
    if (this.mode !== "fieldStart" || this.s.cells.length === 0 || this.s.content)
      this.endField(recordEndText(end).length);
  }

  /** Remembers the first line break a record ended with, and warns once when a later one differs. */
  private noteTerminator(end: CsvRecordEnd, span: Completed["span"]): void {
    if (end === "EndOfInput") return;
    O.match(this.s.firstEnd, {
      onNone: () => {
        this.s.firstEnd = O.some(end);
      },
      onSome: (first) => this.noteMixed(first, end, span),
    });
  }

  private noteMixed(first: CsvRecordEnd, other: CsvRecordEnd, span: Completed["span"]): void {
    if (first === other || this.s.mixedReported) return;
    this.s.mixedReported = true;
    if (this.keepWarning())
      this.report(
        CsvDiagnostic.cases.warning.make({
          finding: MixedTerminators.make({ at: CsvTextSpan.make(span, built), first, other }),
        })
      );
  }

  /** Whether a record is a blank line the read skips: one empty, unquoted cell. */
  private skipsBlank(cells: ReadonlyArray<CsvCell>): boolean {
    return this.config.blankLines === "skip" && cells.length === 1 && cells[0] === "" && !this.s.lastQuoted;
  }

  /**
   * How many cells the record is emitted with: the first record sets the width, a ragged one is judged, and a short
   * one is padded to the width when the read pads.
   */
  private fitWidth(cells: CsvRecord, record: number, span: Completed["span"]): number {
    return O.match(this.s.width, {
      onNone: () => {
        this.s.width = O.some(cells.length);
        return cells.length;
      },
      onSome: (width) => (cells.length === width ? width : this.judgeWidth(cells, width, record, span)),
    });
  }

  private judgeWidth(cells: CsvRecord, width: number, record: number, span: Completed["span"]): number {
    if (this.config.ragged === "reject" || this.keepWarning())
      this.report(
        judgeRagged(
          this.config.ragged,
          RaggedRecord.make({ at: CsvTextSpan.make(span, built), record, expected: width, actual: cells.length })
        )
      );
    return this.config.ragged === "pad" ? Num.max(width, cells.length) : cells.length;
  }

  /**
   * Fails the read, and says so, when the record is one past the record cap or its `padding` empty cells would pass
   * the padding cap. Cells read from text never count against the padding cap; the text caps bound them.
   */
  private passesCountCap(completed: Completed, padding: number): boolean {
    const { maxPaddingCells, maxRecords } = this.config.limits;
    if (this.s.emitted > maxRecords) this.limit("records", maxRecords, CsvTextSpan.make(completed.span, built));
    else if (this.s.paddingEmitted + padding > maxPaddingCells)
      this.limit("paddingCells", maxPaddingCells, CsvTextSpan.make(completed.span, built));
    return this.s.stopped;
  }

  /**
   * Hands over a completed record with `width` cells, padded when it has fewer, or fails the read when it is one
   * past the record cap or its padding would pass the padding cap. The caps are checked before the record is padded.
   */
  private emit(completed: Completed, width: number): void {
    const { cells } = completed;
    const padding = Num.max(0, width - cells.length);
    this.s.emitted += 1;
    if (this.passesCountCap(completed, padding)) return;
    this.s.paddingEmitted += padding;
    this.records.push(padding > 0 ? { ...completed, cells: A.appendAll(cells, A.replicate("", padding)) } : completed);
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

  private joinLineFeedToCrAlreadyCountedAsLineBreak(): void {
    this.s.offset += 1;
  }

  /** Releases a record held at a carriage return, now that the next unit is known not to be a line feed. */
  releaseHeld(lineFeedFollows: boolean): void {
    if (!this.s.held) return;
    this.s.held = false;
    if (lineFeedFollows) {
      this.joinLineFeedToCrAlreadyCountedAsLineBreak();
      this.endRecord("CRLF");
    } else {
      this.endRecord("CR");
    }
  }
}

type NextIndexOrSameIndexWhenStopped = number;

type Stepper = (run: Machine, text: string, i: number) => NextIndexOrSameIndexWhenStopped;

const delimit = (run: Machine, i: number): number => {
  run.endField();
  run.advance(1);
  return i + 1;
};

const plainLineBreak = (run: Machine, c: string, i: number): number => {
  if (run.mode === "fieldStart") run.startRecordIfNeeded();
  run.breakLine(1);
  if (c === "\r") run.s.held = true;
  else run.endRecord("LF");
  return i + 1;
};

const openQuote = (run: Machine, i: number): number => {
  run.mode = "quoted";
  run.s.fieldQuoted = true;
  run.s.quoteOffset = run.s.offset;
  run.s.quoteLine = run.s.line;
  run.s.quoteCharacter = run.s.character;
  run.advance(1);
  return i + 1;
};

const strayQuote = (run: Machine, i: number): number => {
  run.quoteFinding(StrayQuote.make);
  if (run.stopped) return i;
  run.s.field += '"';
  run.advance(1);
  run.checkField();
  return i + 1;
};

// decision: imperative-engine-loops
const plainRunEnd = (text: string, i: number, stop: number, delimiter: string): number => {
  let j = i + 1;
  while (j < stop) {
    const d = text[j];
    if (d === delimiter || d === '"' || d === "\r" || d === "\n") return j;
    j += 1;
  }
  return j;
};

const plainRun = (run: Machine, text: string, i: number): number => {
  run.mode = "unquoted";
  const j = plainRunEnd(text, i, Num.min(text.length, i + run.budget()), run.config.delimiter);
  run.s.field += Str.slice(i, j)(text);
  run.advance(j - i);
  run.checkField();
  return j;
};

const stepPlain: Stepper = (run, text, i) => {
  const c = text[i] ?? "";
  if (c === "\r" || c === "\n") return plainLineBreak(run, c, i);
  run.startRecordIfNeeded();
  if (c === run.config.delimiter) return delimit(run, i);
  if (c === '"') return run.mode === "fieldStart" ? openQuote(run, i) : strayQuote(run, i);
  return plainRun(run, text, i);
};

const passQuotedUnitCountingCrlfAsOneLine = (run: Machine, d: string | undefined): void => {
  const s = run.s;
  if (d === "\r") {
    s.line += 1;
    s.character = 0;
    s.offset += 1;
    s.crInQuotes = true;
    return;
  }
  if (d === "\n") {
    if (!s.crInQuotes) s.line += 1;
    s.character = 0;
    s.offset += 1;
    s.crInQuotes = false;
    return;
  }
  s.crInQuotes = false;
  run.advance(1);
};

const stepQuoted: Stepper = (run, text, i) => {
  if (text[i] === '"') {
    run.mode = "quoteInQuoted";
    run.advance(1);
    return i + 1;
  }
  const stop = Num.min(text.length, i + run.budget());
  let j = i;
  while (j < stop && text[j] !== '"') {
    passQuotedUnitCountingCrlfAsOneLine(run, text[j]);
    j += 1;
  }
  run.s.field += Str.slice(i, j)(text);
  run.checkField();
  return j;
};

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
  if (c === run.config.delimiter) return delimit(run, i);
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

const spacesBeforeEnd = (run: Machine, c: string, i: number): number => {
  if (run.config.quotes === "strict") {
    run.quoteFinding(TextAfterClosingQuote.make);
    return i;
  }
  if (c === run.config.delimiter) return delimit(run, i);
  run.mode = "unquoted";
  return i;
};

const textAfterSpaces = (run: Machine, c: string, i: number): number => {
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

const stepAfterQuoteSpaces: Stepper = (run, text, i) => {
  const c = text[i] ?? "";
  if (c === " ") {
    run.spaces += 1;
    run.advance(1);
    return i + 1;
  }
  if (c === run.config.delimiter || c === "\r" || c === "\n") return spacesBeforeEnd(run, c, i);
  return textAfterSpaces(run, c, i);
};

const stepFor: (mode: MachineModeName) => Stepper = MachineModeName.match({
  fieldStart: () => stepPlain,
  unquoted: () => stepPlain,
  quoted: () => stepQuoted,
  quoteInQuoted: () => stepQuoteInQuoted,
  afterQuoteSpaces: () => stepAfterQuoteSpaces,
});

const stepHeld: Stepper = (run, text, i) => {
  const lineFeedFollows = text[i] === "\n";
  run.releaseHeld(lineFeedFollows);
  return lineFeedFollows ? i + 1 : i;
};

const nextStep = (run: Machine): Stepper => (run.s.held ? stepHeld : stepFor(run.mode));
