// Every field typed by an Opaque schema keeps the Opaque's nominal type. Key-annotating an Opaque field
// (`.pipe(S.annotateKey(...))`) rebuilds it as the bare inner struct and silently drops the brand, so these
// assertions fail to compile if one comes back; the package typecheck (`beep:check:tests`) is what runs them.

import { Csv } from "@beep/csv/Csv.codec";
import { CsvCodecOptions } from "@beep/csv/CsvOptions.schema";
import { describe, expectTypeOf, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Result from "effect/Result";
import type { CsvWarning, StrayQuote } from "@beep/csv/CsvDiagnostic.schema";
import type { CsvLimits, CsvReadOptions, CsvWriteOptions } from "@beep/csv/CsvOptions.schema";
import type { CsvTextSpan } from "@beep/csv/CsvPosition.schema";
import type { CsvNoted, CsvRead } from "@beep/csv/CsvRead.schema";
import type { CsvRecordSlice, CsvTable } from "@beep/csv/CsvTable.schema";
import type { MachineState, RawRecord } from "@beep/csv/internal/machine";

describe("Opaque fields keep their brands", () => {
  it("in reads, options, findings and the engine's records", () => {
    expectTypeOf<CsvRead["table"]>().toEqualTypeOf<CsvTable>();
    expectTypeOf<CsvNoted["warnings"][number]>().toEqualTypeOf<CsvWarning>();
    expectTypeOf<CsvReadOptions["limits"]>().toEqualTypeOf<CsvLimits>();
    expectTypeOf<CsvCodecOptions["read"]>().toEqualTypeOf<CsvReadOptions>();
    expectTypeOf<CsvCodecOptions["write"]>().toEqualTypeOf<CsvWriteOptions>();
    expectTypeOf<CsvRecordSlice["span"]>().toEqualTypeOf<CsvTextSpan>();
    expectTypeOf<StrayQuote["at"]>().toEqualTypeOf<CsvTextSpan>();
    expectTypeOf<RawRecord["span"]>().toEqualTypeOf<CsvTextSpan>();
    expectTypeOf<MachineState["width"]>().not.toBeAny();
    const read = Csv.parseResult("a,b\n", CsvCodecOptions.default.read);
    assertTrue(Result.isSuccess(read), "the read succeeds");
    expectTypeOf(read.success.table).toEqualTypeOf<CsvTable>();
  });
});
