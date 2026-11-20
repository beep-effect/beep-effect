// Strict mode against Effect's own `effect/encoding/Csv`, the only file that imports it: on RFC 4180 text both accept
// the same records, on text with misplaced quotes both refuse, and each reads the other's output back unchanged.

import { Csv } from "@beep/csv/Csv.codec";
import { CsvFixedDelimiter, CsvReadOptions } from "@beep/csv/CsvOptions.schema";
import { CsvRecord, CsvTable } from "@beep/csv/CsvTable.schema";
import { describe, it } from "@effect/vitest";
import { assertSuccess, strictEqual } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as EffectCsv from "effect/encoding/Csv";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import { runs } from "./support.ts";

const strict = CsvReadOptions.make({ delimiter: CsvFixedDelimiter.make({ delimiter: "," }), quotes: "strict" });

const effectRead = (text: string): Effect.Effect<Result.Result<ReadonlyArray<ReadonlyArray<string>>, unknown>> =>
  Stream.make(text).pipe(Stream.pipeThroughChannel(EffectCsv.decodeString()), Stream.runCollect, Effect.result);

const effectWrite = (records: ReadonlyArray<ReadonlyArray<string>>) =>
  Stream.fromIterable(records).pipe(
    Stream.pipeThroughChannel(EffectCsv.encodeString()),
    Stream.runCollect,
    Effect.map((parts) => A.join(parts, ""))
  );

// Records without blank lines: Effect reads a blank line differently only in what it counts.
const Records = S.Array(CsvRecord.check(S.isMinLength(2)));
const quotey = Arbitrary.schema(S.Literals(['"', ",", "\n", "a", "b"]).pipe(S.Array));

describe("strict mode agrees with effect/encoding/Csv", () => {
  it.effect.prop(
    "on Effect's own output, both read the same records",
    [Arbitrary.schema(Records)],
    ([records]) =>
      Effect.gen(function* () {
        const text = yield* effectWrite(records);
        const streamed = yield* effectRead(text);
        assertSuccess(streamed, records);
        assertSuccess(
          Result.map(Csv.parseResult(text, strict), (read) => read.table.records),
          records
        );
      }),
    runs
  );

  it.effect.prop(
    "on our output, Effect reads the same records",
    [Arbitrary.schema(Records)],
    ([records]) =>
      Effect.gen(function* () {
        const streamed = yield* effectRead(Csv.stringify(CsvTable.make({ records })));
        assertSuccess(streamed, records);
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
        const ours = Result.map(Csv.parseResult(text, strict), (read) => read.table.records);
        strictEqual(Result.isSuccess(ours), Result.isSuccess(theirs));
        if (Result.isSuccess(ours)) assertSuccess(theirs, ours.success);
      }),
    runs
  );
});
