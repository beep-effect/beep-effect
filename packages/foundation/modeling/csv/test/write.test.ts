import { Csv } from "@beep/csv/Csv.codec";
import { CsvWriteOptions } from "@beep/csv/CsvOptions.schema";
import { CsvTable } from "@beep/csv/CsvTable.schema";
import { describe, it } from "@effect/vitest";
import { assertSuccess, deepStrictEqual, notDeepStrictEqual, strictEqual } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import { outcomeOfRead, readWith, runs, thenFail, untilFailure, utf8 } from "./support.ts";
import type { CsvRecord } from "@beep/csv/CsvTable.schema";

const guarded = CsvWriteOptions.make({ formulaGuard: "apostrophe" });
const one = (cell: string) => ({ records: [[cell]] as const });

describe("the formula guard defuses exactly the OWASP CSV-injection first characters", () => {
  for (const [label, cell] of [
    ["an equals sign", "=SUM(A1:A9)"],
    ["a plus sign", "+1"],
    ["a minus sign", "-40"],
    ["an at sign", "@cmd"],
    ["a tab", "\t=1"],
    ["a carriage return", "\r=1"],
  ] as const) {
    it(`defuses a cell that starts with ${label}`, () => {
      assertSuccess(outcomeOfRead(Csv.parseResult(Csv.stringify(one(cell), guarded), readWith(","))), [[`'${cell}`]]);
    });
  }

  for (const [label, cell] of [
    ["plain text", "Bolt"],
    ["a space before =", " =1"],
    ["a full-width equals sign", "＝1+1"],
    ["= after the first character", "a=b"],
  ] as const) {
    it(`leaves a cell with ${label} as it is (only the first character counts)`, () => {
      strictEqual(Csv.stringify(one(cell), guarded), `${cell}\r\n`);
    });
  }

  it("leaves every cell alone under none, the default", () => {
    strictEqual(Csv.stringify(one("=SUM(A1:A9)")), "=SUM(A1:A9)\r\n");
  });

  it("makes a guarded table read back changed, so the round trip holds only without it", () => {
    const table = CsvTable.make({ records: [["-1", "x"]] });
    notDeepStrictEqual(
      outcomeOfRead(Csv.parseResult(Csv.stringify(table, guarded), readWith(","))),
      Result.succeed(table.records)
    );
  });
});

describe("write options", () => {
  const table = {
    records: [
      ["SKU", "Name"],
      ["BRK-040", "Bracket"],
    ] as const,
  };

  it("spell a BOM, full quoting, LF and no final terminator as asked", () => {
    strictEqual(
      Csv.stringify(
        table,
        CsvWriteOptions.make({ bom: true, quoteStyle: "always", terminator: "LF", finalTerminator: false })
      ),
      '\uFEFF"SKU","Name"\n"BRK-040","Bracket"'
    );
  });

  it("write a record of one empty cell as a quoted empty cell, not as a blank line", () => {
    strictEqual(Csv.stringify({ records: [[""], ["a"]] }), '""\r\na\r\n');
  });

  it("write an empty table as empty text, final terminator or not", () => {
    strictEqual(Csv.stringify({ records: [] }), "");
  });
});

describe("the writing channels", () => {
  it.effect.prop(
    "encodeString and encode, however the records are batched, give stringify's text and bytes",
    [
      Arbitrary.schema(CsvTable),
      Arbitrary.schema(CsvWriteOptions),
      Arbitrary.schema(S.Int.check(S.isBetween({ minimum: 1, maximum: 4 }))),
    ],
    ([table, options, batch]) =>
      Effect.gen(function* () {
        const records = Stream.fromIterable(table.records).pipe(Stream.rechunk(batch));
        const text = yield* records.pipe(Stream.pipeThroughChannel(Csv.encodeString(options)), Stream.runCollect);
        strictEqual(A.join(text, ""), Csv.stringify(table, options));
        const bytes = yield* records.pipe(Stream.pipeThroughChannel(Csv.encode(options)), Stream.runCollect);
        deepStrictEqual(Uint8Array.from(A.flatMap(bytes, (chunk) => [...chunk])), Csv.stringifyBytes(table, options));
      }),
    runs
  );

  it.effect("a failing upstream fails both channels with its error, with no final terminator or BOM before it", () =>
    Effect.gen(function* () {
      const options = CsvWriteOptions.make({ bom: true });
      const written: ReadonlyArray<CsvRecord> = [["a", "b"]];
      const text = yield* untilFailure(
        thenFail(written, "io").pipe(Stream.pipeThroughChannel(Csv.encodeString<string>(options)))
      );
      deepStrictEqual(text, [Result.succeed("\uFEFFa,b"), Result.fail("io")]);
      const nothing = yield* untilFailure(
        thenFail([], "io").pipe(Stream.pipeThroughChannel(Csv.encodeString<string>(options)))
      );
      deepStrictEqual(nothing, [Result.fail("io")]);
      const bytes = yield* untilFailure(
        thenFail(written, "io").pipe(Stream.pipeThroughChannel(Csv.encode<string>(options)))
      );
      deepStrictEqual(bytes, [Result.succeed(utf8("\uFEFFa,b")), Result.fail("io")]);
    })
  );
});
