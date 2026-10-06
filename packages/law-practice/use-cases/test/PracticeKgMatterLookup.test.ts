import {
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
