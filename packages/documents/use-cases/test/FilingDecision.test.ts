import { FilingDecisionInput } from "@beep/documents-use-cases/aggregates/Document/server";
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { Result } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

describe("@beep/documents-use-cases FilingDecision port", () => {
  it("defaults the text excerpt to none so filename-only callers stay valid", () => {
    const input = FilingDecisionInput.make({
      contentDigest: S.decodeSync(FilingDecisionInput.fields.contentDigest)("abc123"),
      originalFileName: "complaint.pdf",
    });

    expect(O.isNone(input.textExcerpt)).toBe(true);
  });

  it("round-trips the filing decision input with schema-derived arbitraries", () => {
    const decode = S.decodeUnknownResult(FilingDecisionInput);
    const encode = S.encodeResult(FilingDecisionInput);
    const equivalent = S.toEquivalence(FilingDecisionInput);

    fc.assert(
      fc.property(S.toArbitrary(FilingDecisionInput)(fc), (input) => {
        const encoded = Result.getOrThrow(encode(input));
        const decoded = Result.getOrThrow(decode(encoded));

        expect(equivalent(decoded, input)).toBe(true);
      }),
      fcRuns(10)
    );
  });
});
