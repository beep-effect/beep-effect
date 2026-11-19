// The decoded side keeps every nominal type: a field or an array element of an Opaque schema is that Opaque, never
// the struct inside it. `annotateKey` on an Opaque rebuilds the inner struct and drops the brand, so this file fails
// to type-check if one comes back.

import { XlsxCalendar } from "@beep/xlsx/XlsxSerial.schema";
import { XlsxRow, XlsxWorkbook } from "@beep/xlsx/XlsxWorkbook.schema";
import { describe, expectTypeOf, it } from "@effect/vitest";
import type { XlsxAddress, XlsxRange } from "@beep/xlsx/XlsxAddress.schema";
import type { XlsxCell, XlsxNumberFormat } from "@beep/xlsx/XlsxCell.schema";
import type { XlsxFatal, XlsxWarning } from "@beep/xlsx/XlsxDiagnostic.schema";
import type { XlsxParseError } from "@beep/xlsx/XlsxError.errors";
import type { XlsxCodecOptions, XlsxLimits, XlsxReadOptions, XlsxWriteOptions } from "@beep/xlsx/XlsxOptions.schema";
import type { XlsxOutline, XlsxRead, XlsxSheetOutline } from "@beep/xlsx/XlsxRead.schema";
import type { XlsxDroppedPart, XlsxSheetCount, XlsxSheetInfo, XlsxWorksheet } from "@beep/xlsx/XlsxWorkbook.schema";
import type * as O from "effect/Option";

describe("the decoded side keeps its nominal types", () => {
  it("in the workbook", () => {
    expectTypeOf<XlsxWorkbook["sheets"][number]>().toEqualTypeOf<XlsxWorksheet>();
    expectTypeOf<XlsxWorkbook["dropped"][number]>().toEqualTypeOf<XlsxDroppedPart>();
    expectTypeOf<XlsxWorksheet["info"]>().toEqualTypeOf<XlsxSheetInfo>();
    expectTypeOf<XlsxWorksheet["rows"][number]>().toEqualTypeOf<XlsxRow>();
    expectTypeOf<XlsxWorksheet["merges"][number]>().toEqualTypeOf<XlsxRange>();
    expectTypeOf<XlsxRow["cells"][number]>().toEqualTypeOf<XlsxCell>();
    expectTypeOf<XlsxCell["format"]>().toEqualTypeOf<XlsxNumberFormat>();
    expectTypeOf<XlsxRange["first"]>().toEqualTypeOf<XlsxAddress>();
    expectTypeOf<XlsxSheetCount["info"]>().toEqualTypeOf<XlsxSheetInfo>();
  });

  it("in what a read returns and how it fails", () => {
    expectTypeOf<XlsxRead["workbook"]>().toEqualTypeOf<XlsxWorkbook>();
    expectTypeOf<XlsxRead["warnings"][number]>().toEqualTypeOf<XlsxWarning>();
    expectTypeOf<XlsxOutline["sheets"][number]>().toEqualTypeOf<XlsxSheetOutline>();
    expectTypeOf<XlsxSheetOutline["count"]>().toEqualTypeOf<XlsxSheetCount>();
    expectTypeOf<XlsxParseError["fatal"]>().toEqualTypeOf<XlsxFatal>();
  });

  it("in the options and the helpers", () => {
    expectTypeOf<XlsxReadOptions["limits"]>().toEqualTypeOf<XlsxLimits>();
    expectTypeOf<XlsxCodecOptions["read"]>().toEqualTypeOf<XlsxReadOptions>();
    expectTypeOf<XlsxCodecOptions["write"]>().toEqualTypeOf<XlsxWriteOptions>();
    expectTypeOf(XlsxWorkbook.sheet).returns.toEqualTypeOf<O.Option<XlsxWorksheet>>();
    expectTypeOf(XlsxRow.cellAt).returns.toEqualTypeOf<O.Option<XlsxCell>>();
    expectTypeOf(XlsxCalendar.fromSerial).returns.toEqualTypeOf<O.Option<XlsxCalendar>>();
  });
});
