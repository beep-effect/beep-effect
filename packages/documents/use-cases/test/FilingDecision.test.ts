import { FilingDecisionInput } from "@beep/documents-use-cases/aggregates/Document/server";
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { Result } from "effect";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";

const decodeFilingDecisionInputFieldsContentDigestSync = S.decodeSync(FilingDecisionInput.fields.contentDigest);
const decodeUnknownFilingDecisionInputResult = S.decodeUnknownResult(FilingDecisionInput);
const encodeFilingDecisionInputResult = S.encodeResult(FilingDecisionInput);

describe("@beep/documents-use-cases FilingDecision port", () => {
  it("defaults the text excerpt to none so filename-only callers stay valid", () => {
    const input = FilingDecisionInput.make({
      contentDigest: decodeFilingDecisionInputFieldsContentDigestSync("abc123"),
      originalFileName: "complaint.pdf",
    });

    expect(O.isNone(input.textExcerpt)).toBe(true);
  });

  it("round-trips the filing decision input with schema-derived arbitraries", () => {
    const equivalent = S.toEquivalence(FilingDecisionInput);

    expect(
      Effect.runSync(
        Arbitrary.checkEffect(
          Arbitrary.schema(FilingDecisionInput),
          (input) => {
            const encoded = Result.getOrThrow(encodeFilingDecisionInputResult(input));
            const decoded = Result.getOrThrow(decodeUnknownFilingDecisionInputResult(encoded));

            expect(equivalent(decoded, input)).toBe(true);

            return true;
          },
          fcRuns(10)
        )
      )._tag
    ).toBe("Passed");
  });
});
