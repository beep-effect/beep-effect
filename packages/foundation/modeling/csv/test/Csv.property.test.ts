// The laws: a table written and read back is the same table; canonical text read and written back is the same text;
// and reading in pieces, split anywhere (inside a BOM, a `sep=` line, a UTF-8 sequence or a CRLF), gives what
// reading at once gives.

import { Csv } from "@beep/csv/Csv.codec";
import { CsvDelimiter, CsvReadOptions, CsvTerminator, CsvWriteOptions } from "@beep/csv/CsvOptions.schema";
import { CsvTable } from "@beep/csv/CsvTable.schema";
import { describe, it } from "@effect/vitest";
import { assertSuccess, assertTrue, deepStrictEqual, strictEqual } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import { constVoid } from "effect/Function";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import {
  byteConfigs,
  cuts,
  messyText,
  outcomeOfRead,
  pieces,
  rawBytes,
  readConfigs,
  readWith,
  readWithRules,
  runs,
  streamBytes,
  streamText,
  utf8,
} from "./support.ts";
import type { CsvParseError } from "@beep/csv/CsvError.errors";

const tables = Arbitrary.schema(CsvTable);
const streamRows = <Row extends S.Top & { readonly DecodingServices: never }>(row: Row, text: string) =>
  Stream.make(utf8(text)).pipe(Stream.pipeThroughChannel(Csv.decodeSchema(row)()), Stream.runCollect);

const pieceSizes = Arbitrary.schema(S.Int.check(S.isBetween({ minimum: 1, maximum: 64 })));

describe("round trip", () => {
  for (const delimiter of CsvDelimiter.literals) {
    for (const terminator of CsvTerminator.literals) {
      it.prop(
        `decode(encode(t)) = t, ${delimiter === "\t" ? "tab" : delimiter} ${terminator}`,
        [tables],
        ([table]) => {
          const options = CsvWriteOptions.make({ delimiter, terminator });
          const text = Csv.stringify(table, options);
          const read = Result.map(Csv.parseResult(text, readWith(delimiter)), (done) => done.table);
          assertSuccess(
            Result.map(read, (back) => back.records),
            table.records
          );
          strictEqual(
            Csv.stringify(
              Result.getOrElse(read, () => table),
              options
            ),
            text
          );
        },
        runs
      );
    }
  }

  it.prop(
    "decode(encode(t)) = t under any write options without the formula guard",
    [tables, Arbitrary.schema(CsvWriteOptions)],
    ([table, written]) => {
      const options = CsvWriteOptions.make({ ...written, formulaGuard: "none" });
      const read = Csv.parseResult(Csv.stringify(table, options), readWith(options.delimiter));
      assertSuccess(
        Result.map(read, (done) => done.table.records),
        table.records
      );
    },
    runs
  );

  it.effect.prop(
    "the default text codec reads back what it writes",
    [tables],
    ([table]) =>
      Effect.gen(function* () {
        const text = yield* S.encodeEffect(Csv.CsvFromString)(table);
        const streamed = yield* S.decodeEffect(Csv.CsvFromString)(text);
        deepStrictEqual(streamed.records, table.records);
      }),
    runs
  );

  it.effect.prop(
    "the default bytes codec reads back what it writes, and refuses what UTF-8 cannot carry",
    [tables],
    ([table]) =>
      Effect.gen(function* () {
        const fromBytes = Csv.fromBytes();
        const back = yield* S.encodeEffect(fromBytes)(table).pipe(
          Effect.flatMap(S.decodeEffect(fromBytes)),
          Effect.result
        );
        if (Csv.stringify(table).isWellFormed())
          assertSuccess(
            Result.map(back, (read) => read.records),
            table.records
          );
        else assertTrue(Result.isFailure(back), "the table is refused");
      }),
    runs
  );

  it.effect("the bytes codec refuses a lone surrogate instead of writing U+FFFD", () =>
    Effect.gen(function* () {
      const encoded = yield* Effect.result(S.encodeEffect(Csv.fromBytes())(CsvTable.make({ records: [["\ud800"]] })));
      assertTrue(Result.isFailure(encoded), "the table is refused");
    })
  );

  it.effect("the default codec does not split cells by a delimiter it does not write", () =>
    Effect.gen(function* () {
      const table = CsvTable.make({ records: [["a;b;c"], ["d;e;f"]] });
      const text = yield* S.encodeEffect(Csv.CsvFromString)(table);
      strictEqual(text, "a;b;c\r\nd;e;f\r\n");
      const streamed = yield* S.decodeEffect(Csv.CsvFromString)(text);
      deepStrictEqual(streamed.records, table.records);
    })
  );
});

describe("chunk invariance", () => {
  for (const [name, options] of R.toEntries(readConfigs)) {
    it.prop(
      `reading bytes in pieces gives the read at once, warnings and their spans included (${name})`,
      [messyText, pieceSizes],
      ([text, pieceChars]) => {
        const bytes = utf8(text);
        const diagnosticsOf = Result.mapError((error: CsvParseError) => error.diagnostics);
        deepStrictEqual(
          diagnosticsOf(Csv.parseBytesInPiecesResult(bytes, { options, pieceChars, onPiece: constVoid })),
          diagnosticsOf(Csv.parseBytesResult(bytes, options))
        );
      },
      runs
    );

    it.effect.prop(
      `the text channel, cut anywhere, gives the read at once (${name})`,
      [messyText, cuts],
      ([text, cutLengths]) =>
        Effect.gen(function* () {
          const chunks = pieces(text.length, cutLengths, (from, to) => Str.slice(from, to)(text));
          const streamed = yield* streamText(chunks, options);
          deepStrictEqual(streamed, outcomeOfRead(Csv.parseResult(text, options)));
        }),
      runs
    );

    for (const [decoding, encoding] of R.toEntries(byteConfigs)) {
      it.effect.prop(
        `the bytes channel, cut anywhere, gives the read at once (${name}, ${decoding})`,
        [messyText, cuts],
        ([text, cutLengths]) =>
          Effect.gen(function* () {
            const read = CsvReadOptions.make({ ...options, encoding });
            const bytes = utf8(text);
            const chunks = pieces(bytes.length, cutLengths, (from, to) => bytes.subarray(from, to));
            const streamed = yield* streamBytes(chunks, read);
            deepStrictEqual(streamed, outcomeOfRead(Csv.parseBytesResult(bytes, read)));
          }),
        runs
      );
    }
  }

  // Raw bytes, valid UTF-8 or not, under the decodings whose window holds the whole input. The caps stay wide: a
  // stream reports the first fatal finding in input order, so a passed text cap ahead of bytes UTF-8 refuses fails it
  // differently from the whole read, which decodes first (the `Csv.decode` Gotchas).
  for (const [name, options] of R.toEntries({ fixed: readConfigs.fixed, detect: readConfigs.detect })) {
    for (const [decoding, encoding] of R.toEntries({
      fixedUtf8: byteConfigs.fixedUtf8,
      detectDefault: byteConfigs.detectDefault,
    })) {
      it.effect.prop(
        `the bytes channel over raw bytes, cut anywhere, gives the read at once (${name}, ${decoding})`,
        [rawBytes, cuts],
        ([bytes, cutLengths]) =>
          Effect.gen(function* () {
            const read = CsvReadOptions.make({ ...options, encoding });
            const chunks = pieces(bytes.length, cutLengths, (from, to) => bytes.subarray(from, to));
            const streamed = yield* streamBytes(chunks, read);
            deepStrictEqual(streamed, outcomeOfRead(Csv.parseBytesResult(bytes, read)));
          }),
        runs
      );
    }
  }

  it.effect("a sep= line split across chunks is still the sep= line", () =>
    Effect.gen(function* () {
      const options = readWithRules(";", { excelSepHint: true });
      const splitInside = yield* streamText(["se", "p=,\na,b\n"], options);
      assertSuccess(splitInside, [["a", "b"]]);
      const splitInsideCrlf = yield* streamText(["sep=,\r", "\na,b\n"], options);
      assertSuccess(splitInsideCrlf, [["a", "b"]]);
    })
  );

  it.effect("a BOM after an empty first chunk is still the file's BOM", () =>
    Effect.gen(function* () {
      const streamed = yield* streamText(["", "\uFEFFa,b\n"], readWith(","));
      assertSuccess(streamed, [["a", "b"]]);
    })
  );
});

describe("decodeSchema", () => {
  it.effect("decodes rows through the header view", () =>
    Effect.gen(function* () {
      const Row = S.Struct({ SKU: S.String, Qty: S.FiniteFromString });
      const rows = yield* streamRows(Row, "SKU,Qty\nBRK-040,12\nBLT-0042,3\n");
      deepStrictEqual(rows, [
        { SKU: "BRK-040", Qty: 12 },
        { SKU: "BLT-0042", Qty: 3 },
      ]);
    })
  );
});
