import {
  extractPracticeKgPathEvidence,
  extractPracticeKgReferences,
  PracticeKgMatterLookupRequest,
  PracticeKgMatterLookupResult,
  PracticeKgMatterResolution,
} from "@beep/law-practice-use-cases/server";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { Effect } from "effect";
import * as S from "effect/Schema";

const decodeResult = S.decodeUnknownEffect(PracticeKgMatterLookupResult);

describe("practice KG matter-lookup contract", () => {
  it("extracts docket, application, and patent references from free text", () => {
    expect(
      extractPracticeKgReferences(
        "RE: Office Action for 11111.20001us01 (App. No. 87/654,321, now US 12,345,678) - see also 20001EP02 and 20001EP02"
      )
    ).toStrictEqual(["11111.20001US01", "20001EP02", "87/654,321", "US 12,345,678"]);
  });

  it("ignores bare digit runs, decimals, and longer numbers", () => {
    expect(
      extractPracticeKgReferences(
        "Invoice 20001 for $1,234,567,890.00 mailed to 55401; ratio 3.14159US is not a docket"
      )
    ).toStrictEqual([]);
  });

  it("keeps the national-stage suffix on a docket reference", () => {
    expect(extractPracticeKgReferences("File 10109WO02-US1 today")).toStrictEqual(["10109WO02-US1"]);
  });

  it("extracts every country stage the practice files in", () => {
    expect(
      extractPracticeKgReferences("Annuities: 11111.20001BR01, 20001ZA01, 20001ea01 and 20001WO01-CA1; not 20001INCH")
    ).toStrictEqual(["11111.20001BR01", "20001EA01", "20001WO01-CA1", "20001ZA01"]);
  });

  it("never reads the attorney's dotted matter number as a reference", () => {
    expect(extractPracticeKgReferences("20001US01 - 11111.00053")).toStrictEqual(["20001US01"]);
  });

  it("joins the client folder to the docket and keeps the matter number apart", () => {
    const evidence = extractPracticeKgPathEvidence(
      "Clients\\Example Client 11111\\20001US01 - 11111.00053\\OA re 20002EP01.pdf"
    );
    expect(evidence.clientNumber).toBe("11111");
    expect(evidence.dockets).toStrictEqual(["20001US01"]);
    expect(evidence.familyKeys).toStrictEqual(["11111.20001"]);
    expect(evidence.attorneyMatterNumbers).toStrictEqual(["11111.00053"]);
  });

  it("lets a client-keyed docket decide the matter key", () => {
    const evidence = extractPracticeKgPathEvidence("Clients/Example Client 11111/Misc/22222.20003WO01 filing.pdf");
    expect(evidence.dockets).toStrictEqual(["20003WO01"]);
    expect(evidence.familyKeys).toStrictEqual(["22222.20003"]);
  });

  it("returns no matter key for a matter-number folder without a docket", () => {
    const evidence = extractPracticeKgPathEvidence("Clients/Example Client 11111/Trade Mark - 11111.00008/notes.docx");
    expect(evidence.familyKeys).toStrictEqual([]);
    expect(evidence.attorneyMatterNumbers).toStrictEqual(["11111.00008"]);
    expect(extractPracticeKgPathEvidence("Firm/20001US01 memo.pdf").clientNumber).toBeNull();
  });

  it.effect(
    "round-trips a lookup result and rejects an unknown resolution",
    Effect.fnUntraced(function* () {
      const request = PracticeKgMatterLookupRequest.make({ reference: "11111.20001US01" });
      const result = yield* decodeResult({
        bundleVersion: "2026-10-06-01",
        matters: [],
        reference: request.reference,
        resolution: "none",
      });
      expect(result.resolution).toBe(PracticeKgMatterResolution.Enum.none);
      const rejected = yield* Effect.exit(
        decodeResult({ bundleVersion: "2026-10-06-01", matters: [], reference: "x", resolution: "probably" })
      );
      expect(rejected._tag).toBe("Failure");
    })
  );
});
