import { Csv } from "@beep/csv/Csv.codec";
import {
  CsvFatal,
  LimitExceeded,
  RaggedRecord,
  UnterminatedQuote,
  WarningsTruncated,
} from "@beep/csv/CsvDiagnostic.schema";
import {
  CsvDetectEncoding,
  CsvLimits,
  CsvReadOptions,
  CsvTerminator,
  CsvWriteOptions,
  MAX_DETECT_WINDOW,
} from "@beep/csv/CsvOptions.schema";
import { CsvTextSpan } from "@beep/csv/CsvPosition.schema";
import { CsvRead } from "@beep/csv/CsvRead.schema";
import { CsvRecordSlice, CsvTable } from "@beep/csv/CsvTable.schema";
import { Machine } from "@beep/csv/internal/machine";
import { textSteps } from "@beep/csv/internal/stream";
import { describe, it, vi } from "@effect/vitest";
import {
  assertFailure,
  assertSome,
  assertSuccess,
  assertTrue,
  deepStrictEqual,
  strictEqual,
} from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { constVoid, flow } from "effect/Function";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import {
  cuts,
  fatalFindings,
  messyText,
  outcomeOfRead,
  pieces,
  readConfigs,
  readWith,
  readWithRules,
  runs,
  streamBytes,
  streamPieces,
  streamText,
  untilFailure,
  utf8,
} from "./support.ts";
import type { CsvFatalFinding } from "@beep/csv/CsvDiagnostic.schema";
import type { CsvRecord } from "@beep/csv/CsvTable.schema";

const kindAndCapOf = (finding: CsvFatalFinding): string =>
  finding.kind === "LimitExceeded" ? `${finding.kind}:${finding.limit}` : finding.kind;

const failedWith = flow(fatalFindings, Result.mapError(A.map(kindAndCapOf)));

const limited = (limits: Partial<CsvLimits>) => readWithRules(",", { limits: CsvLimits.make(limits) });

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
    assertFailure(Csv.parseResult(`"${Str.repeat(200_000)("a,b\n")}`).pipe(outcomeOfRead, fatalFindings), [
      UnterminatedQuote.make({
        at: CsvTextSpan.make({ offset: 0, length: 1, line: 0, character: 0 }),
        record: 0,
        field: 0,
      }),
    ]);
  });

  it("a record of 100,001 cells", () => {
    assertFailure(Csv.parseResult(`${Str.repeat(100_000)(",")}\n`).pipe(outcomeOfRead, failedWith), [
      "LimitExceeded:fieldsPerRecord",
    ]);
  });
});

describe("the record-length cap counts a record's text, not its line break", () => {
  it("a four-unit record passes a cap of four however it ends, and a five-unit one fails", () => {
    const capped = limited({ maxRecordLength: 4 });
    for (const text of ["abcd", "abcd\n", "abcd\r\n", "abcd\r", '"ab"\r\n', '"a\n"\n'])
      assertSuccess(
        Result.map(Csv.parseResult(text, capped), (done) => done.table.records.length),
        1
      );
    assertFailure(Csv.parseResult("abcde\n", capped).pipe(outcomeOfRead, failedWith), ["LimitExceeded:recordLength"]);
  });

  it.prop(
    "a table passes a cap of its longest written record under every terminator, and fails one unit under it",
    [Arbitrary.schema(CsvTable), Arbitrary.schema(CsvTerminator)],
    ([table, terminator]) => {
      const options = CsvWriteOptions.make({ terminator });
      const unterminated = CsvWriteOptions.make({ terminator, finalTerminator: false });
      const longest = A.reduce(table.records, 1, (most, record) =>
        Num.max(most, Csv.stringify({ records: [record] }, unterminated).length)
      );
      const text = Csv.stringify(table, options);
      assertTrue(Result.isSuccess(Csv.parseResult(text, limited({ maxRecordLength: longest }))), "the read passes");
      if (longest > 1)
        assertFailure(
          Csv.parseResult(text, limited({ maxRecordLength: longest - 1 })).pipe(outcomeOfRead, failedWith),
          ["LimitExceeded:recordLength"]
        );
    },
    runs
  );
});

describe("every cap, read at once, in one-character pieces and through both channels", () => {
  const capCasesAsWideAsTheirFirstRecordSoPaddingChangesOnlyThePaddingRow = [
    ["records", { maxRecords: 10 }, Str.repeat(11)("a,b\n")],
    ["fieldsPerRecord", { maxFieldsPerRecord: 5 }, "a,b,c,d,e,f\n"],
    ["fieldLength", { maxFieldLength: 10 }, `a,${Str.repeat(11)("x")}\n`],
    ["recordLength", { maxRecordLength: 20 }, `${A.join(A.replicate("abcd", 6), ",")}\n`],
    ["textLength", { maxTextLength: 20 }, Str.repeat(7)("a,b\n")],
    ["paddingCells", { maxPaddingCells: 10 }, `a,b,c\n${Str.repeat(6)("a\n")}`],
  ] as const;
  for (const [name, limits, text] of capCasesAsWideAsTheirFirstRecordSoPaddingChangesOnlyThePaddingRow) {
    it.effect(`${name} fails the same everywhere`, () =>
      Effect.gen(function* () {
        const options = readWithRules(",", { ragged: "pad", limits: CsvLimits.make(limits) });
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

describe("the padding cap bounds padding and nothing else", () => {
  const padded = (maxPaddingCells: number) =>
    readWithRules(",", { ragged: "pad", limits: CsvLimits.make({ maxPaddingCells }) });
  const text = `${A.join(A.replicate("h", 1000), ",")}\n${Str.repeat(10)("x\n")}`;

  it("short records are padded within the cap and refused past it, at the record that passes it", () => {
    assertSuccess(
      Result.map(outcomeOfRead(Csv.parseResult(text, padded(9_990))), A.map(A.length)),
      A.replicate(1000, 11)
    );
    const refused = Csv.parseResult(text, padded(3_996)).pipe(outcomeOfRead, fatalFindings);
    assertFailure(refused, [
      LimitExceeded.make({ limit: "paddingCells", maximum: 3996, at: CsvTextSpan.locate(text, 2008, 2) }),
    ]);
  });

  it.effect("cells read from text never count: a read of more cells than the cap, none padded, passes", () =>
    Effect.gen(function* () {
      const unpadded = Str.repeat(6)("a,b\n");
      const options = padded(1);
      const whole = outcomeOfRead(Csv.parseResult(unpadded, options));
      assertSuccess(whole, A.replicate(["a", "b"], 6));
      const units = pieces(unpadded.length, A.replicate(1, unpadded.length), (from, to) =>
        Str.slice(from, to)(unpadded)
      );
      const streamed = yield* streamText(units, options);
      deepStrictEqual(streamed, whole);
    })
  );

  it.prop(
    "a read that does not pad reads the same under the smallest padding cap as under the default",
    [messyText, Arbitrary.schema(S.Literals(["keep", "reject"]))],
    ([text, ragged]) => {
      const tightest = readWithRules(",", { ragged, limits: CsvLimits.make({ maxPaddingCells: 1 }) });
      deepStrictEqual(
        outcomeOfRead(Csv.parseResult(text, tightest)),
        outcomeOfRead(Csv.parseResult(text, readWithRules(",", { ragged })))
      );
    },
    runs
  );
});

describe("the text-length cap bounds every position a read reports, a stream's too, which has no length of its own", () => {
  const capped = limited({ maxTextLength: 20 });
  const units = (text: string) =>
    pieces(text.length, A.replicate(1, text.length), (from, to) => Str.slice(from, to)(text));

  it.effect("a stream of exactly the cap passes; one unit more fails at the cap, after the records before it", () =>
    Effect.gen(function* () {
      const text = Str.repeat(5)("abc\n");
      const atTheCap = yield* streamText(units(text), capped);
      assertSuccess(atTheCap, A.replicate(["abc"], 5));
      const emitted = yield* untilFailure(
        streamPieces(units(`${text}x`)).pipe(Stream.pipeThroughChannel(Csv.decodeString(capped)))
      );
      deepStrictEqual(
        A.map(
          emitted,
          Result.mapBoth({
            onSuccess: (slice) => slice.cells,
            onFailure: (error): ReadonlyArray<CsvFatal> => error.diagnostics,
          })
        ),
        [
          ...A.replicate(Result.succeed<CsvRecord>(["abc"]), 5),
          Result.fail<ReadonlyArray<CsvFatal>>([
            CsvFatal.make({
              finding: LimitExceeded.make({
                limit: "textLength",
                maximum: 20,
                at: CsvTextSpan.make({ offset: 20, length: 0, line: 5, character: 0 }),
              }),
            }),
          ]),
        ]
      );
    })
  );

  it.effect("a record ended by a lone CR inside the cap is emitted before the cap fails; a CRLF past it is not", () =>
    Effect.gen(function* () {
      const cappedAtTwo = limited({ maxTextLength: 2 });
      const emitted = (
        chunks: ReadonlyArray<string>
      ): Effect.Effect<ReadonlyArray<Result.Result<CsvRecord, ReadonlyArray<string>>>> =>
        untilFailure(streamPieces(chunks).pipe(Stream.pipeThroughChannel(Csv.decodeString(cappedAtTwo)))).pipe(
          Effect.map(
            A.map(
              Result.mapBoth({
                onSuccess: (slice) => slice.cells,
                onFailure: (error) => A.map(error.diagnostics, (fatal) => kindAndCapOf(fatal.finding)),
              })
            )
          )
        );
      for (const chunks of [["a\rX"], ["a\r", "X"], ["a", "\r", "X"]]) {
        const read = yield* emitted(chunks);
        deepStrictEqual(read, [Result.succeed<CsvRecord>(["a"]), Result.fail(["LimitExceeded:textLength"])]);
      }
      for (const chunks of [["a\r\n"], ["a\r", "\n"]]) {
        const read = yield* emitted(chunks);
        deepStrictEqual(read, [Result.fail(["LimitExceeded:textLength"])]);
      }
      assertSuccess(outcomeOfRead(Csv.parseResult("a\r", cappedAtTwo)), [["a"]]);
    })
  );

  it.effect.prop(
    "every slice a capped stream emits, and every finding's span, is valid and within the cap",
    [messyText, cuts, Arbitrary.schema(S.Int.check(S.isBetween({ minimum: 1, maximum: 40 })))],
    ([text, cutLengths, maxTextLength]) =>
      Effect.gen(function* () {
        const options = readWithRules(",", { limits: CsvLimits.make({ maxTextLength }) });
        const chunks = pieces(text.length, cutLengths, (from, to) => Str.slice(from, to)(text));
        const emitted = yield* untilFailure(
          streamPieces(chunks).pipe(Stream.pipeThroughChannel(Csv.decodeString(options)))
        );
        const spans = A.flatMap(emitted, (result) =>
          Result.match(result, {
            onSuccess: (slice) => {
              assertTrue(S.is(CsvRecordSlice)(slice), "the slice is valid");
              return [slice.span];
            },
            onFailure: (error) =>
              A.flatMap(error.diagnostics, ({ finding }) =>
                finding.kind === "LimitExceeded" || finding.kind === "UnterminatedQuote" ? [finding.at] : []
              ),
          })
        );
        assertTrue(
          A.every(spans, (span) => S.is(CsvTextSpan)(span) && span.offset + span.length <= maxTextLength),
          "every span is within the cap"
        );
      }),
    runs
  );
});

describe("linear cost (one test at a time: its spies would count concurrent tests' calls)", {
  concurrent: false,
}, () => {
  const wide = `${Str.repeat(40_000)("a,")}a\n`;

  const spying = <Spy extends { readonly mockRestore: () => void }, A, E>(
    spyOn: () => Spy,
    use: (spy: Spy) => Effect.Effect<A, E>
  ): Effect.Effect<A, E> =>
    Effect.acquireUseRelease(Effect.sync(spyOn), use, (spy) => Effect.sync(() => spy.mockRestore()));

  const machinesStarted = <A, E>(effect: Effect.Effect<A, E>) =>
    spying(
      () => vi.spyOn(Machine, "start"),
      (start) => Effect.map(effect, (value) => ({ value, started: start.mock.calls.length }))
    );

  it.effect(
    "a record of 40,001 cells read in 8-character pieces is read by one machine, not copied into a new one per piece (about 16 s)",
    () =>
      Effect.gen(function* () {
        const { value: read, started } = yield* machinesStarted(
          Effect.sync(() =>
            Csv.parseBytesInPiecesResult(utf8(wide), { options: readWith(","), pieceChars: 8, onPiece: constVoid })
          )
        );
        assertSuccess(
          Result.map(read, (done) => done.table.records[0]?.length),
          40_001
        );
        strictEqual(started, 1);
      })
  );

  it.effect("the same record dripped through the text channel in 8-character chunks is read by one machine", () =>
    Effect.gen(function* () {
      const chunks = pieces(wide.length, A.replicate(8, wide.length / 8 + 1), (from, to) => Str.slice(from, to)(wide));
      const { value: streamed, started } = yield* machinesStarted(streamText(chunks, readWith(",")));
      assertSuccess(
        Result.map(streamed, (records) => records[0]?.length),
        40_001
      );
      strictEqual(started, 1);
    })
  );

  it.prop(
    "the text channel holds an undecided start in at most 7 units (a BOM and a sep= line up to its CR), and the text after it as the chunks that came, joined once, not rebuilt per chunk (about 6 s for a 256K-character start)",
    [messyText, cuts],
    ([text, cutLengths]) => {
      for (const options of [readConfigs.detect, CsvReadOptions.make({ excelSepHint: true })]) {
        const steps = textSteps(options);
        A.reduce(
          pieces(text.length, cutLengths, (from, to) => Str.slice(from, to)(text)),
          steps.initial(),
          (pending, chunk) => {
            const held = pending.phase === "sniffing" ? pending.pieces.length : 0;
            const [next] = steps.step(pending, [chunk]);
            if (next.phase === "opening")
              assertTrue(next.head.length <= 7, `an undecided start of ${next.head.length}`);
            if (next.phase === "sniffing") {
              strictEqual(next.length, Num.sumAll(A.map(next.pieces, Str.length)));
              if (pending.phase === "sniffing") {
                strictEqual(next.pieces.length, held + 1);
                assertSome(A.last(next.pieces), chunk);
              }
            }
            return next;
          }
        );
      }
    },
    runs
  );

  it.effect(
    "a wide detect window filled in small chunks copies each byte at most twice, not the whole window per chunk (1 MiB in 256-byte chunks copied about 2 GiB)",
    () =>
      Effect.gen(function* () {
        const options = CsvReadOptions.make({ encoding: CsvDetectEncoding.make({ window: MAX_DETECT_WINDOW }) });
        const bytes = utf8(Str.repeat(64 * 1024)("a,b\n"));
        const chunks = pieces(bytes.length, A.replicate(256, bytes.length / 256 + 1), (from, to) =>
          bytes.subarray(from, to)
        );
        const { streamed, copied } = yield* spying(
          () => vi.spyOn(Uint8Array.prototype, "set"),
          (set) =>
            Effect.map(streamBytes(chunks, options), (streamed) => ({
              streamed,
              copied: Num.sumAll(A.map(set.mock.calls, ([source]) => source.length)),
            }))
        );
        assertSuccess(Result.map(streamed, A.length), 64 * 1024);
        assertTrue(copied <= 2 * bytes.length, `copied ${copied} bytes of ${bytes.length}`);
      })
  );

  it("a flood of warnings keeps the first maxWarnings and counts the rest in one WarningsTruncated", () => {
    const read = Csv.parseResult(Str.repeat(100_000)('a"\n'));
    assertTrue(Result.isSuccess(read), "the read succeeds");
    const warnings = CsvRead.warnings(read.success);
    deepStrictEqual(warnings.length, 1_001);
    assertSome(
      O.map(A.last(warnings), (warning) => warning.finding),
      WarningsTruncated.make({ kept: 1_000, dropped: 99_000 })
    );
  });

  it("the cap counts every kind of warning, ragged records included", () => {
    const read = Csv.parseResult("a,b\nc\nd\ne\n", limited({ maxWarnings: 1 }));
    assertSuccess(
      Result.map(read, (done) => A.map(CsvRead.warnings(done), (warning) => warning.finding.kind)),
      ["RaggedRecord", "WarningsTruncated"]
    );
  });

  it("a change of line ending past the cap is counted and not kept, pinned by example since the properties seldom mix line endings after the cap", () => {
    const read = Csv.parseResult("a,b\r\nc\r\nd,e\n", limited({ maxWarnings: 1 }));
    assertSuccess(
      Result.map(read, (done) => A.map(CsvRead.warnings(done), (warning) => warning.finding)),
      [
        RaggedRecord.make({
          at: CsvTextSpan.make({ offset: 5, length: 3, line: 1, character: 0 }),
          record: 1,
          expected: 2,
          actual: 1,
        }),
        WarningsTruncated.make({ kept: 1, dropped: 1 }),
      ]
    );
  });
});
