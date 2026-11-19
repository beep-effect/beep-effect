// The header view: headings become own keys (even `__proto__`), an empty or repeated heading fails with its
// finding, the header is checked once in linear time, and rows written back read back as the same rows.

import { Csv } from "@beep/csv/Csv.codec";
import { DuplicateHeader, EmptyHeader } from "@beep/csv/CsvDiagnostic.schema";
import { CsvRecord } from "@beep/csv/CsvTable.schema";
import { describe, it } from "@effect/vitest";
import { assertFailure, assertSuccess, assertTrue, deepStrictEqual, strictEqual } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import { runs, utf8 } from "./support.ts";

const rowsCodec = Csv.recordsFromString();
const decodeRows = S.decodeResult(rowsCodec);
const encodeRows = S.encodeResult(rowsCodec);

const findingsOf = (text: string) =>
  Stream.make(utf8(text)).pipe(
    Stream.pipeThroughChannel(Csv.decodeSchema(S.Record(S.String, S.String))()),
    Stream.runCollect,
    Effect.result,
    Effect.map(
      Result.mapError((error) => (error._tag === "CsvParseError" ? A.map(error.diagnostics, (d) => d.finding) : error))
    )
  );

describe("headings as keys", () => {
  for (const keys of [
    ["__proto__", "b"],
    ["constructor", "toString"],
  ] as const) {
    it(`${keys[0]} is an own key of an ordinary object`, () => {
      const rows = decodeRows(`${A.join(keys, ",")}\n1,2\n`);
      assertTrue(Result.isSuccess(rows), "the read succeeds");
      const row = rows.success[0];
      deepStrictEqual(Object.getPrototypeOf(row), Object.prototype);
      deepStrictEqual(R.toEntries(row ?? {}), [
        [keys[0], "1"],
        [keys[1], "2"],
      ]);
    });
  }

  it("a Struct target reads a __proto__ column declared with a computed key", () => {
    const Row = S.Struct({ ["__proto__"]: S.String, b: S.String });
    const rows = S.decodeResult(Csv.schema(S.Array(Row)))("__proto__,b\n1,2\n");
    assertTrue(Result.isSuccess(rows), "the read succeeds");
    deepStrictEqual(Object.getOwnPropertyDescriptor(rows.success[0], "__proto__")?.value, "1");
  });

  it("a short record fills its missing cells with empty text; a long one's extra cells are dropped", () => {
    assertSuccess(decodeRows("a,b\n1\n1,2,3\n"), [
      { a: "1", b: "" },
      { a: "1", b: "2" },
    ]);
  });
});

describe("header findings", () => {
  it.effect("an empty heading and a repeated heading are named with their fields", () =>
    Effect.gen(function* () {
      const streamed = yield* findingsOf("a,,a\n1,2,3\n");
      assertFailure(streamed, [
        EmptyHeader.make({ field: 1 }),
        DuplicateHeader.make({ field: 2, firstField: 0, name: "a" }),
      ]);
    })
  );

  it.effect("a bad header fails the channel even with no record after it", () =>
    Effect.gen(function* () {
      const streamed = yield* findingsOf("a,a\n");
      assertFailure(streamed, [DuplicateHeader.make({ field: 1, firstField: 0, name: "a" })]);
    })
  );

  it("the codec fails the same header with the finding's sentence", () => {
    const rows = decodeRows("a,a\n");
    assertTrue(Result.isFailure(rows), "the read fails");
    assertTrue(Str.includes('heading 2 repeats "a" from heading 1')(rows.failure.message));
  });

  it("100,000 headings are checked in linear time, distinct or all empty", () => {
    const distinct = A.join(
      A.makeBy(100_000, (i) => `h${i}`),
      ","
    );
    const started = performance.now();
    assertTrue(Result.isSuccess(decodeRows(`${distinct}\n`)), "the read succeeds");
    const empty = decodeRows(`${Str.repeat(99_999)(",")}\n`);
    assertTrue(Result.isFailure(empty), "the read fails");
    // The quadratic check took about 13 s for the distinct header alone; linear is well under a second for both.
    assertTrue(performance.now() - started < 3_000);
  });
});

describe("writing rows", () => {
  it("a row missing a heading writes an empty cell", () => {
    assertSuccess(encodeRows([{ a: "1", b: "2" }, { a: "3" }]), "a,b\r\n1,2\r\n3,\r\n");
  });

  for (const [name, rows] of [
    ["a later row's unknown key", [{ a: "1" }, { a: "2", b: "3" }]],
    ["a first row with no keys", [{}]],
    ["a first row with an empty key", [{ "": "1" }]],
  ] as const) {
    it(`refuses ${name} rather than lose or garble it`, () => {
      assertTrue(Result.isFailure(encodeRows(rows)), "the rows are refused");
    });
  }

  it.prop(
    "rows read from text, written and read back, are the same rows",
    [
      S.NonEmptyString.check(S.isMaxLength(40)).pipe(S.NonEmptyArray, Arbitrary.schema, Arbitrary.map(A.dedupe)),
      CsvRecord.pipe(S.Array, Arbitrary.schema),
    ],
    ([header, body]) => {
      const text = Csv.stringify({ records: [header, ...body] });
      const rows = decodeRows(text);
      assertTrue(Result.isSuccess(rows), "the read succeeds");
      assertSuccess(Result.flatMap(encodeRows(rows.success), decodeRows), rows.success);
      strictEqual(rows.success.length, body.length);
    },
    runs
  );
});
