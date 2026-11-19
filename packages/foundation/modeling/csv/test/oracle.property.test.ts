// Strict mode against Effect's own `effect/encoding/Csv`, the only file that imports it: on RFC 4180 text both accept
// the same records, on text with misplaced quotes both refuse, and each reads the other's output back unchanged.

import { Csv } from "@beep/csv/Csv.codec";
import { CsvFixedDelimiter, CsvReadOptions } from "@beep/csv/CsvOptions.schema";
import { CsvTable } from "@beep/csv/CsvTable.schema";
import { describe, expect, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as EffectCsv from "effect/encoding/Csv";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";

const runs = { arbitrary: { runs: 200 } };
const strict = CsvReadOptions.make({ delimiter: CsvFixedDelimiter.make({ delimiter: "," }), quotes: "strict" });

const effectRead = (text: string) =>
  Stream.make(text).pipe(
    Stream.pipeThroughChannel(EffectCsv.decodeString()),
    Stream.runCollect,
    Effect.map((rows) => A.map(rows, (row) => [...(row as ReadonlyArray<string>)])),
    Effect.result
  );

const effectWrite = (records: ReadonlyArray<ReadonlyArray<string>>) =>
  Stream.fromIterable(records).pipe(
    Stream.pipeThroughChannel(EffectCsv.encodeString()),
    Stream.runCollect,
    Effect.map((parts) => A.join(parts, ""))
  );

// Records without blank lines: Effect reads a blank line differently only in what it counts.
const Records = S.Array(S.NonEmptyArray(S.String).check(S.isMinLength(2)));
const quotey = Arbitrary.schema(S.Literals(['"', ",", "\n", "a", "b"]).pipe(S.Array));

describe("strict mode agrees with effect/encoding/Csv", () => {
  it.effect.prop(
    "on Effect's own output, both read the same records",
    [Arbitrary.schema(Records)],
    ([records]) =>
      Effect.gen(function* () {
        const text = yield* effectWrite(records);
        const theirs = yield* effectRead(text);
        const ours = Csv.parseResult(text, strict);
        expect(Result.isSuccess(theirs)).toBe(true);
        expect(Result.isSuccess(ours)).toBe(true);
        if (Result.isSuccess(theirs) && Result.isSuccess(ours))
          expect(ours.success.table.records).toEqual(theirs.success);
      }),
    runs
  );

  it.effect.prop(
    "on our output, Effect reads the same records",
    [Arbitrary.schema(Records)],
    ([records]) =>
      Effect.gen(function* () {
        const text = Csv.stringify(CsvTable.make({ records: records }));
        const theirs = yield* effectRead(text);
        expect(Result.isSuccess(theirs)).toBe(true);
        if (Result.isSuccess(theirs)) expect(theirs.success).toEqual(records);
      }),
    runs
  );

  it.effect.prop(
    "on text with quotes anywhere, both accept or both refuse, and agree when they accept",
    [quotey],
    ([chars]) =>
      Effect.gen(function* () {
        const text = A.join(chars, "");
        const theirs = yield* effectRead(text);
        const ours = Csv.parseResult(text, strict);
        expect(Result.isSuccess(ours)).toBe(Result.isSuccess(theirs));
        if (Result.isSuccess(theirs) && Result.isSuccess(ours))
          expect(ours.success.table.records).toEqual(theirs.success);
      }),
    runs
  );
});
