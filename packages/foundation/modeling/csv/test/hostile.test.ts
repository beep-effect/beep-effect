// Hostile input fails typed, with its finding and position, never as a defect or a stack overflow; every cap holds
// the same whether the input is read at once, in one-character pieces or through a channel; and no input makes a read
// cost more than linear time or memory, wide records and floods of warnings included.

import { Csv } from "@beep/csv/Csv.codec";
import { UnterminatedQuote, WarningsTruncated } from "@beep/csv/CsvDiagnostic.schema";
import { CsvLimits } from "@beep/csv/CsvOptions.schema";
import { CsvTextSpan } from "@beep/csv/CsvPosition.schema";
import { CsvRead } from "@beep/csv/CsvRead.schema";
import { describe, it } from "@effect/vitest";
import { assertFailure, assertSome, assertSuccess, assertTrue, deepStrictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { constVoid } from "effect/Function";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as Str from "effect/String";
import { outcomeOfRead, pieces, readWith, readWithRules, streamBytes, streamText, utf8 } from "./support.ts";
import type { CsvFatalFinding } from "@beep/csv/CsvDiagnostic.schema";
import type { Outcome } from "./support.ts";

/** A fatal finding as its kind, and its cap when it is one. */
const summary = (finding: CsvFatalFinding): string =>
  finding.kind === "LimitExceeded" ? `${finding.kind}:${finding.limit}` : finding.kind;

const failedWith = (streamed: Outcome) =>
  Result.mapError(
    streamed,
    A.map((fatal) => summary(fatal.finding))
  );

const limited = (limits: Partial<CsvLimits>) => readWithRules(",", { limits: CsvLimits.make(limits) });

/** Milliseconds a thunk takes. */
const timed = (thunk: () => void): number => {
  const started = performance.now();
  thunk();
  return performance.now() - started;
};

describe("hostile input", () => {
  it("a 20 MiB cell exceeds the field-length cap", () => {
    assertFailure(Csv.parseResult(`a,${Str.repeat(20 * 1024 * 1024)("x")}\n`).pipe(outcomeOfRead, failedWith), [
      "LimitExceeded:fieldLength",
    ]);
  });

  it("100,001 records under a cap of 100,000", () => {
    assertFailure(
      Csv.parseResult(Str.repeat(100_001)("a,b\n"), limited({ maxRecords: 100_000 })).pipe(outcomeOfRead, failedWith),
      ["LimitExceeded:records"]
    );
  });

  it("an unclosed quote at the start of a large file names where it opened", () => {
    assertFailure(
      Result.mapError(
        outcomeOfRead(Csv.parseResult(`"${Str.repeat(200_000)("a,b\n")}`)),
        A.map((f) => f.finding)
      ),
      [
        UnterminatedQuote.make({
          at: CsvTextSpan.make({ offset: 0, length: 1, line: 0, character: 0 }),
          record: 0,
          field: 0,
        }),
      ]
    );
  });

  it("a record of 100,001 cells", () => {
    assertFailure(Csv.parseResult(`${Str.repeat(100_000)(",")}\n`).pipe(outcomeOfRead, failedWith), [
      "LimitExceeded:fieldsPerRecord",
    ]);
  });
});

describe("every cap, read at once, in one-character pieces and through both channels", () => {
  for (const [name, limits, text] of [
    ["records", { maxRecords: 10 }, Str.repeat(11)("a,b\n")],
    ["fieldsPerRecord", { maxFieldsPerRecord: 5 }, "a,b,c,d,e,f\n"],
    ["fieldLength", { maxFieldLength: 10 }, `a,${Str.repeat(11)("x")}\n`],
    ["recordLength", { maxRecordLength: 20 }, `${A.join(A.replicate("abcd", 6), ",")}\n`],
  ] as const) {
    it.effect(`${name} fails the same everywhere`, () =>
      Effect.gen(function* () {
        const options = limited(limits);
        const whole = outcomeOfRead(Csv.parseResult(text, options));
        assertFailure(failedWith(whole), [`LimitExceeded:${name}`]);
        const bytes = utf8(text);
        deepStrictEqual(
          outcomeOfRead(Csv.parseBytesInPiecesResult(bytes, { options, pieceChars: 1, onPiece: constVoid })),
          whole
        );
        const units = pieces(text.length, A.replicate(1, text.length), (from, to) => Str.slice(from, to)(text));
        const fromText = yield* streamText(units, options);
        deepStrictEqual(fromText, whole);
        const octets = pieces(bytes.length, A.replicate(1, bytes.length), (from, to) => bytes.subarray(from, to));
        const fromBytes = yield* streamBytes(octets, options);
        deepStrictEqual(fromBytes, whole);
      })
    );
  }
});

describe("linear cost", () => {
  const wide = `${Str.repeat(40_000)("a,")}a\n`;

  it("a record of 40,001 cells read in 8-character pieces costs time in the input, not its width", () => {
    let read: Result.Result<CsvRead, unknown> = Result.fail(undefined);
    const ms = timed(() => {
      read = Csv.parseBytesInPiecesResult(utf8(wide), { options: readWith(","), pieceChars: 8, onPiece: constVoid });
    });
    assertSuccess(
      Result.map(read, (done) => done.table.records[0]?.length),
      40_001
    );
    // Copying the open record each piece took about 16 s here; one machine across the pieces takes milliseconds.
    assertTrue(ms < 2_000);
  });

  it.effect("the same record dripped through the text channel in 8-character chunks", () =>
    Effect.gen(function* () {
      const chunks = pieces(wide.length, A.replicate(8, wide.length / 8 + 1), (from, to) => Str.slice(from, to)(wide));
      const started = performance.now();
      const streamed = yield* streamText(chunks, readWith(","));
      assertSuccess(
        Result.map(streamed, (records) => records[0]?.length),
        40_001
      );
      assertTrue(performance.now() - started < 5_000);
    })
  );

  it("a flood of warnings keeps the first maxWarnings and counts the rest in one WarningsTruncated", () => {
    let read: Result.Result<CsvRead, unknown> = Result.fail(undefined);
    const ms = timed(() => {
      read = Csv.parseResult(Str.repeat(100_000)('a"\n'));
    });
    assertTrue(Result.isSuccess(read), "the read succeeds");
    const warnings = CsvRead.warnings(read.success);
    deepStrictEqual(warnings.length, 1_001);
    assertSome(
      O.map(A.last(warnings), (warning) => warning.finding),
      WarningsTruncated.make({ kept: 1_000, dropped: 99_000 })
    );
    assertTrue(ms < 5_000);
  });

  it("the cap counts every kind of warning, ragged records included", () => {
    const read = Csv.parseResult("a,b\nc\nd\ne\n", limited({ maxWarnings: 1 }));
    assertSuccess(
      Result.map(read, (done) => A.map(CsvRead.warnings(done), (warning) => warning.finding.kind)),
      ["RaggedRecord", "WarningsTruncated"]
    );
  });
});
