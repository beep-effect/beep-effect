import { DocumentContentDigest } from "@beep/documents-domain/aggregates/Document";
import { FilingDecisionInput } from "@beep/documents-use-cases/aggregates/Document/server";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { describe } from "@effect/vitest";
import { assertNone, assertTrue } from "@effect/vitest/utils";
import { pipe, Result } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as S from "effect/Schema";

const decodeUnknownFilingDecisionInputResult = S.decodeUnknownResult(FilingDecisionInput);
const encodeFilingDecisionInputResult = S.encodeResult(FilingDecisionInput);

describe("@beep/documents-use-cases FilingDecision port", () => {
  it("defaults the text excerpt to none so filename-only callers stay valid", () => {
    const input = FilingDecisionInput.make({
      contentDigest: DocumentContentDigest.make("abc123"),
      originalFileName: "complaint.pdf",
    });

    assertNone(input.textExcerpt);
  });

  it.prop(
    "round-trips the filing decision input with schema-derived arbitraries",
    { input: Arbitrary.schema(FilingDecisionInput) },
    ({ input }) => {
      const equivalent = S.toEquivalence(FilingDecisionInput);
      const encoded = Result.getOrThrow(encodeFilingDecisionInputResult(input));
      const decoded = Result.getOrThrow(decodeUnknownFilingDecisionInputResult(encoded));
      pipe(equivalent(decoded, input), assertTrue);
    },
    { arbitrary: fcRuns(10) }
  );
});
