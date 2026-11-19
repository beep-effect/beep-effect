// The laws: a table written and read back is the same table; canonical text read and written back is the same text;
// and reading in pieces, split anywhere, gives what reading at once gives.

import { Csv } from "@beep/csv/Csv.codec";
import {
  CsvDelimiter,
  CsvFixedDelimiter,
  CsvReadOptions,
  CsvTerminator,
  CsvWriteOptions,
} from "@beep/csv/CsvOptions.schema";
import { CsvTable } from "@beep/csv/CsvTable.schema";
import { describe, expect, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { constVoid } from "effect/Function";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";

const runs = { arbitrary: { runs: 200 } };
const readWith = (delimiter: CsvDelimiter) => CsvReadOptions.make({ delimiter: CsvFixedDelimiter.make({ delimiter }) });

// Text over the characters that matter to CSV, so quotes, delimiters and line breaks meet often.
const messyText = Arbitrary.schema(S.Literals(['"', ",", "\r", "\n", " ", "a", "é", "😀", ";"]).pipe(S.Array));

describe("round trip", () => {
  for (const delimiter of CsvDelimiter.literals) {
    for (const terminator of CsvTerminator.literals) {
      it.prop(
        `decode(encode(t)) = t, ${delimiter === "\t" ? "tab" : delimiter} ${terminator}`,
        [Arbitrary.schema(CsvTable)],
        ([table]) => {
          const text = Csv.stringify(table, CsvWriteOptions.make({ delimiter, terminator }));
          const read = Result.getOrThrow(Csv.parseResult(text, readWith(delimiter)));
          expect(read.table.records).toEqual(table.records);
          expect(Csv.stringify(read.table, CsvWriteOptions.make({ delimiter, terminator }))).toBe(text);
        },
        runs
      );
    }
  }

  it.effect("the Schema codec round-trips", () =>
    Effect.gen(function* () {
      const table = CsvTable.make({
        records: [
          ["SKU", "Name"],
          ["BRK-040", 'Bracket, "40" mm'],
        ],
      });
      const text = yield* S.encodeEffect(Csv.CsvFromString)(table);
      const back = yield* S.decodeEffect(Csv.CsvFromString)(text);
      expect(back.records).toEqual(table.records);
    })
  );
});

describe("chunk invariance", () => {
  it.prop(
    "reading bytes in pieces gives what reading at once gives",
    [messyText, Arbitrary.schema(S.Int.check(S.isBetween({ minimum: 1, maximum: 64 })))],
    ([chars, pieceChars]) => {
      const text = A.join(chars, "");
      const bytes = new TextEncoder().encode(text);
      const whole = Csv.parseBytesResult(bytes, readWith(","));
      const pieces = Csv.parseBytesInPiecesResult(bytes, { options: readWith(","), pieceChars, onPiece: constVoid });
      expect(pieces).toEqual(whole);
    },
    runs
  );

  it.effect.prop(
    "the text channel, chunked anywhere, gives the one-shot records",
    [messyText, Arbitrary.schema(S.Int.check(S.isBetween({ minimum: 1, maximum: 9 })).pipe(S.Array))],
    ([chars, cuts]) =>
      Effect.gen(function* () {
        const text = A.join(chars, "");
        const chunks: Array<string> = [];
        let at = 0;
        for (const cut of cuts) {
          if (at >= text.length) break;
          chunks.push(Str.slice(at, at + cut)(text));
          at += cut;
        }
        if (at < text.length) chunks.push(Str.slice(at)(text));
        const whole = Csv.parseResult(text, readWith(","));
        const streamed = yield* Stream.fromIterable(chunks).pipe(
          Stream.pipeThroughChannel(Csv.decodeString(readWith(","))),
          Stream.runCollect,
          Effect.result
        );
        if (Result.isSuccess(whole)) {
          expect(Result.isSuccess(streamed)).toBe(true);
          if (Result.isSuccess(streamed))
            expect(A.map(streamed.success, (slice) => slice.cells)).toEqual(whole.success.table.records);
        } else expect(Result.isFailure(streamed)).toBe(true);
      }),
    runs
  );

  it.effect.prop(
    "the bytes channel, split inside UTF-8 sequences, gives the one-shot records",
    [messyText, Arbitrary.schema(S.Int.check(S.isBetween({ minimum: 1, maximum: 5 })))],
    ([chars, size]) =>
      Effect.gen(function* () {
        const text = A.join(chars, "");
        const bytes = new TextEncoder().encode(text);
        const chunks: Array<Uint8Array> = [];
        for (let at = 0; at < bytes.length; at += size) chunks.push(bytes.subarray(at, at + size));
        const whole = Csv.parseBytesResult(bytes, readWith(","));
        const streamed = yield* Stream.fromIterable(chunks).pipe(
          Stream.pipeThroughChannel(Csv.decode(readWith(","))),
          Stream.runCollect,
          Effect.result
        );
        if (Result.isSuccess(whole) && Result.isSuccess(streamed)) {
          expect(A.map(streamed.success, (slice) => slice.cells)).toEqual(whole.success.table.records);
        } else expect(Result.isFailure(streamed)).toBe(Result.isFailure(whole));
      }),
    runs
  );
});

describe("decodeSchema", () => {
  it.effect("decodes rows through the header view", () =>
    Effect.gen(function* () {
      const Row = S.Struct({ SKU: S.String, Qty: S.FiniteFromString });
      const bytes = new TextEncoder().encode("SKU,Qty\nBRK-040,12\nBLT-0042,3\n");
      const rows = yield* Stream.make(bytes).pipe(
        Stream.pipeThroughChannel(Csv.decodeSchema(Row)()),
        Stream.runCollect
      );
      expect(rows).toEqual([
        { SKU: "BRK-040", Qty: 12 },
        { SKU: "BLT-0042", Qty: 3 },
      ]);
    })
  );
});
