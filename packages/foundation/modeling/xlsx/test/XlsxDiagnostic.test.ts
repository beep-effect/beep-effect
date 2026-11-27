import { XlsxAddress, XlsxRange } from "@beep/xlsx/XlsxAddress.schema";
import {
  BadAddress,
  DamagedArchive,
  DamagedXml,
  DeclaredExtentWrong,
  DirectoryMismatch,
  DuplicatePart,
  describeFinding,
  FictitiousLeapDay,
  FormatNotShown,
  FormulaWithoutResult,
  LimitExceeded,
  ListTruncated,
  MissingPart,
  NoSheets,
  NotAWorkbook,
  RowOutOfOrder,
  UnknownStyle,
  UnreadableCell,
} from "@beep/xlsx/XlsxDiagnostic.schema";
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as O from "effect/Option";

const b2 = XlsxAddress.make({ column: 1, row: 2 });
const extent = XlsxRange.make({ first: XlsxAddress.make({ column: 0, row: 1 }), last: b2 });

describe("describeFinding", () => {
  it("states the sentence of every kind of finding once, naming its part or cell", () => {
    const findings = [
      NotAWorkbook.make({ container: "encrypted" }),
      MissingPart.make({ path: "xl/styles.xml" }),
      DuplicatePart.make({ path: "xl/workbook.xml" }),
      DirectoryMismatch.make({ reason: "entry 2" }),
      DamagedArchive.make({ damage: "Truncated", reason: "short read" }),
      DamagedXml.make({ path: "xl/workbook.xml", line: 3, column: 7, reason: "unclosed tag" }),
      LimitExceeded.make({ limit: "rows", path: "xl/worksheets/sheet1.xml" }),
      NoSheets.make({}),
      UnreadableCell.make({ sheet: "Items", address: b2, reason: "number" }),
      BadAddress.make({ sheet: "Items", row: 4, raw: "ZZZZ1" }),
      RowOutOfOrder.make({ sheet: "Items", row: 2 }),
      UnknownStyle.make({ sheet: "Items", address: b2, style: "9" }),
      FormatNotShown.make({ sheet: "Items", code: "[DBNum1]0", cells: 3 }),
      FormulaWithoutResult.make({ sheet: "Items", address: b2 }),
      FictitiousLeapDay.make({ sheet: "Items", address: b2 }),
      ListTruncated.make({ list: "merges", dropped: 5 }),
      DeclaredExtentWrong.make({ sheet: "Items", declared: extent, found: O.some(extent) }),
      DeclaredExtentWrong.make({ sheet: "Items", declared: extent, found: O.none() }),
    ];
    expect(
      A.map(findings, describeFinding),
      "every kind is stated here: the fixtures and property tests reach only the kinds a read happens to produce"
    ).toEqual([
      "the file is not an .xlsx workbook (encrypted)",
      "the part xl/styles.xml is missing",
      "the archive holds xl/workbook.xml twice",
      "the archive's directory names other entries: entry 2",
      "the archive is damaged (Truncated): short read",
      "xl/workbook.xml is not well-formed at 3:7: unclosed tag",
      "the file went past its cap on rows in xl/worksheets/sheet1.xml",
      "the workbook has no sheet",
      'B2 on "Items" could not be read as a number',
      'a reference in row 4 of "Items" cannot be used: ZZZZ1',
      'row 2 of "Items" was written after a later row',
      'B2 on "Items" names style 9, which the workbook does not have',
      '3 cells of "Items" have the format [DBNum1]0, which is not rendered',
      'the formula in B2 on "Items" has no saved result',
      'B2 on "Items" holds 29 February 1900, a day that never was',
      "5 merges went past the read's cap and were dropped",
      '"Items" declares A1:B2 and holds A1:B2',
      '"Items" declares A1:B2 and holds nothing',
    ]);
  });
});
