// What a lenient read goes past and how it reports it, what a strict read refuses, and the record rules (line breaks,
// ragged records, blank lines, trimming, `sep=` lines, delimiter detection), each with its findings and their spans.

import { Csv } from "@beep/csv/Csv.codec";
import {
  CsvWarning,
  MixedTerminators,
  RaggedRecord,
  StrayQuote,
  TextAfterClosingQuote,
} from "@beep/csv/CsvDiagnostic.schema";
import { CsvLimits, CsvReadOptions } from "@beep/csv/CsvOptions.schema";
import { CsvTextSpan } from "@beep/csv/CsvPosition.schema";
import {
  CsvClean,
  CsvDelimiterDetected,
  CsvDelimiterFallback,
  CsvDelimiterFromSepLine,
  CsvRead,
} from "@beep/csv/CsvRead.schema";
import { describe, it } from "@effect/vitest";
import { assertFailure, assertSome, assertSuccess, assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { fatalFindings, messyText, outcomeOfRead, readWith, readWithRules } from "./support.ts";
import type { CsvWarningFinding } from "@beep/csv/CsvDiagnostic.schema";

const at = (offset: number, length: number, line: number, character: number) =>
  CsvTextSpan.make({ offset, length, line, character });

/** The records and the warnings' findings of a successful read. */
const readOf = (text: string, options = readWith(",")) =>
  Result.map(Csv.parseResult(text, options), (read) => ({
    records: read.table.records,
    warnings: A.map(CsvRead.warnings(read), (warning) => warning.finding),
  }));

const findingsOf = (text: string, options: CsvReadOptions) =>
  Csv.parseResult(text, options).pipe(outcomeOfRead, fatalFindings);

const read = (records: ReadonlyArray<ReadonlyArray<string>>, warnings: ReadonlyArray<CsvWarningFinding> = []) => ({
  records,
  warnings,
});

describe("line breaks", () => {
  it("a lone CR ends a record", () => {
    assertSuccess(
      readOf("a,b\rc,d\r"),
      read([
        ["a", "b"],
        ["c", "d"],
      ])
    );
  });

  it("mixed record endings are reported once, at the first change", () => {
    assertSuccess(
      readOf("a\r\nb\nc\r\nd\n"),
      read([["a"], ["b"], ["c"], ["d"]], [MixedTerminators.make({ at: at(3, 2, 1, 0), first: "CRLF", other: "LF" })])
    );
  });

  it("a span located between the CR and LF of a CRLF is at the start of the next line, as the machine counts", () => {
    assertSuccess(Result.succeed(CsvTextSpan.locate("a\r\nb", 2, 1)), at(2, 1, 1, 0));
    assertSuccess(Result.succeed(CsvTextSpan.locate("a,b\r\nc", 5, 1)), at(5, 1, 1, 0));
  });

  it.prop("a span located at any offset of any text is a valid span", [messyText], ([text]) => {
    for (let offset = 0; offset <= text.length; offset += 1) {
      assertTrue(S.is(CsvTextSpan)(CsvTextSpan.locate(text, offset, 0)));
    }
  });

  it("a line break inside quotes is cell text", () => {
    assertSuccess(readOf('"a\r\nb",c\n'), read([["a\r\nb", "c"]]));
  });
});

describe("misplaced quotes", () => {
  it("a stray quote is read past as text, with its position", () => {
    assertSuccess(
      readOf('a,b"c\n'),
      read([["a", 'b"c']], [StrayQuote.make({ at: at(3, 1, 0, 3), record: 0, field: 1 })])
    );
  });

  it("text after a closing quote keeps the quote and the field quoted", () => {
    assertSuccess(
      readOf('"12"in",bolt\n'),
      read([['12"in', "bolt"]], [TextAfterClosingQuote.make({ at: at(4, 1, 0, 4), record: 0, field: 0 })])
    );
  });

  it("spaces after a closing quote are dropped before a delimiter", () => {
    assertSuccess(readOf('"a"  ,b\n'), read([["a", "b"]]));
  });

  it("strict quotes refuse each of them with the same finding", () => {
    const strict = readWithRules(",", { quotes: "strict" });
    assertFailure(findingsOf('a,b"c\n', strict), [StrayQuote.make({ at: at(3, 1, 0, 3), record: 0, field: 1 })]);
    assertFailure(findingsOf('"a"  ,b\n', strict), [
      TextAfterClosingQuote.make({ at: at(5, 1, 0, 5), record: 0, field: 0 }),
    ]);
  });
});

describe("record rules", () => {
  const ragged = "a,b\nc\nd,e,f\n";

  it("ragged records are kept as written, each reported", () => {
    assertSuccess(
      readOf(ragged),
      read(
        [["a", "b"], ["c"], ["d", "e", "f"]],
        [
          RaggedRecord.make({ at: at(4, 2, 1, 0), record: 1, expected: 2, actual: 1 }),
          RaggedRecord.make({ at: at(6, 6, 2, 0), record: 2, expected: 2, actual: 3 }),
        ]
      )
    );
  });

  it("padding fills short records with empty cells and leaves long ones", () => {
    assertSuccess(
      Result.map(readOf(ragged, readWithRules(",", { ragged: "pad" })), (done) => done.records),
      [
        ["a", "b"],
        ["c", ""],
        ["d", "e", "f"],
      ]
    );
  });

  it("rejecting stops at the first ragged record", () => {
    assertFailure(findingsOf(ragged, readWithRules(",", { ragged: "reject" })), [
      RaggedRecord.make({ at: at(4, 2, 1, 0), record: 1, expected: 2, actual: 1 }),
    ]);
  });

  it("blank lines are records of one empty cell, or skipped; a quoted empty cell never is", () => {
    assertSuccess(readOf("a\n\nb\n"), read([["a"], [""], ["b"]]));
    assertSuccess(readOf("a\n\nb\n", readWithRules(",", { blankLines: "skip" })), read([["a"], ["b"]]));
    assertSuccess(readOf('a\n""\nb\n', readWithRules(",", { blankLines: "skip" })), read([["a"], [""], ["b"]]));
  });

  it("trimming leaves cells, trims only unquoted ones, or trims all", () => {
    const text = '" b ", c \n';
    assertSuccess(readOf(text), read([[" b ", " c "]]));
    assertSuccess(readOf(text, readWithRules(",", { trim: "unquoted" })), read([[" b ", "c"]]));
    assertSuccess(readOf(text, readWithRules(",", { trim: "all" })), read([["b", "c"]]));
  });
});

describe("delimiters", () => {
  it("a sep= line sets the delimiter when asked, and is a record when not", () => {
    assertSuccess(
      Result.map(Csv.parseResult("sep=;\na;b\n", readWithRules(",", { excelSepHint: true })), (done) => [
        done.delimiter,
        done.table.records,
      ]),
      [CsvDelimiterFromSepLine.make({ delimiter: ";" }), [["a", "b"]]]
    );
    assertSuccess(readOf("sep=;\na;b\n"), read([["sep=;"], ["a;b"]]));
  });

  it("detection picks the delimiter that splits the first records consistently, else falls back to commas", () => {
    assertSuccess(
      Result.map(Csv.parseResult("a|b|c\nd|e|f\ng|h|i\n"), (done) => done.delimiter),
      CsvDelimiterDetected.make({ delimiter: "|" })
    );
    assertSuccess(
      Result.map(Csv.parseResult("abc\ndef\n"), (done) => done.delimiter),
      CsvDelimiterFallback.make({})
    );
  });

  it("a cap does not change the detected delimiter: the read fails at the cap instead", () => {
    const options = CsvReadOptions.make({ limits: CsvLimits.make({ maxFieldsPerRecord: 2 }) });
    assertSome(Csv.sniff("a;b;c\nd;e;f\n", options), ";");
    assertFailure(
      Result.mapError(
        findingsOf("a;b;c\nd;e;f\n", options),
        A.map((finding) => finding.kind)
      ),
      ["LimitExceeded"]
    );
  });

  it("a read with nothing odd is clean", () => {
    assertSuccess(
      Result.map(Csv.parseResult("a,b\n", CsvReadOptions.default), (done) => done.outcome),
      CsvClean.make({})
    );
  });
});

describe("warnings", () => {
  it("are what the read went past, in file order", () => {
    assertSuccess(
      Result.map(Csv.parseResult('a"\nb,c\n'), (done) => A.map(CsvRead.warnings(done), (w) => w.severity)),
      ["warning", "warning"]
    );
    assertSuccess(
      Result.map(Csv.parseResult('a"\n'), (done) => CsvRead.warnings(done)),
      [CsvWarning.make({ finding: StrayQuote.make({ at: at(1, 1, 0, 1), record: 0, field: 0 }) })]
    );
  });
});
