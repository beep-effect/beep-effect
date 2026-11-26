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

describe("the decoded side keeps its nominal types: an Opaque field or element is that Opaque, not its struct", () => {
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
